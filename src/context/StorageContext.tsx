// Storage Context — provides GanttStorageService to the app
// Supports local ↔ cloud mode switching with data migration.

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { GanttStorageService, StorageMode } from '../shared/types/storage';
import { LocalGanttStorageService } from '../shared/storage/local-gantt-storage-service';
import { FirestoreGanttStorageServiceImpl } from '../shared/storage/firestore-gantt-storage-service';
import type { CloudGanttStorageService } from '../shared/storage/firestore-gantt-storage-service';
import { db, isFirebaseAvailable } from '../lib/firebase';
import { useAuth } from './AuthContext';
import {
  projectToFirestoreMeta,
  releaseToFirestore,
  appDataToUserSettings,
  snapshotToFirestore,
} from '../shared/utils/firestore-converters';
import { doc, setDoc, collection, writeBatch } from 'firebase/firestore';

const STORAGE_MODE_KEY = 'ganttapp-storage-mode';

interface StorageContextType {
  storage: GanttStorageService;
  mode: StorageMode;
  switchMode: (mode: StorageMode) => Promise<void>;
  isSwitching: boolean;
  switchError: string | null;
}

const StorageContext = createContext<StorageContextType | undefined>(undefined);

export function StorageProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();

  // Lazy initializer ensures stable reference — prevents infinite re-render loops
  // in AppDataContext's [storage] dependency
  const [storage, setStorage] = useState<GanttStorageService>(
    () => new LocalGanttStorageService()
  );
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const restoredRef = useRef(false);

  // Mode restoration on mount — if user was in cloud mode and is still authenticated
  useEffect(() => {
    if (restoredRef.current) return;
    const storedMode = localStorage.getItem(STORAGE_MODE_KEY);
    if (storedMode !== 'cloud') return;
    if (!isFirebaseAvailable || !db) return;
    if (!isAuthenticated || !user) return;

    restoredRef.current = true;
    const cloudService = new FirestoreGanttStorageServiceImpl(db, user.uid);

    // Update lastLogin
    cloudService.createUserProfile(
      user.displayName ?? 'Unknown',
      user.email ?? ''
    ).catch((err) => console.error('[StorageContext] createUserProfile failed:', err));

    setStorage(cloudService);
  }, [isAuthenticated, user]);

  const switchMode = useCallback(async (newMode: StorageMode) => {
    setIsSwitching(true);
    setSwitchError(null);

    try {
      if (newMode === 'cloud') {
        // --- Switch to cloud ---
        if (!isFirebaseAvailable || !db) {
          throw new Error('Firebase is not configured. Cloud features are unavailable.');
        }
        if (!user) {
          throw new Error('You must sign in before switching to cloud storage.');
        }

        // Capture narrowed references for use in nested closures
        const firestore = db;
        const authUser = user;

        // Confirm with user
        const confirmed = window.confirm(
          'Upload your local data to the cloud? Your local data will remain as a backup.'
        );
        if (!confirmed) {
          setIsSwitching(false);
          return;
        }

        // Load current local data
        const localService = new LocalGanttStorageService();
        const localData = await localService.loadAppData();
        const localSnapshots = await localService.loadSnapshots();

        // Create cloud service
        const cloudService = new FirestoreGanttStorageServiceImpl(firestore, authUser.uid);

        // Create/update user profile
        await cloudService.createUserProfile(
          authUser.displayName ?? 'Unknown',
          authUser.email ?? ''
        );

        // Upload data to Firestore in phases.
        // Phase 1: Create project documents + user settings (no subcollections).
        // Subcollection security rules use get() on the parent project doc, so the
        // parent must exist before subcollection writes are evaluated.
        if (localData && localData.projects.length > 0) {
          const projectBatch = writeBatch(firestore);

          for (const project of localData.projects) {
            const meta = projectToFirestoreMeta(project, authUser.uid);
            projectBatch.set(doc(firestore, `ganttapp_projects/${project.id}`), meta);
          }

          // Upload user settings (same batch — no subcollection dependency)
          projectBatch.set(
            doc(firestore, `ganttapp_settings/${authUser.uid}`),
            appDataToUserSettings(localData)
          );

          await projectBatch.commit();

          // Phase 2: Create release documents (subcollections — parent projects now exist)
          const releasesBatch = writeBatch(firestore);
          let releaseCount = 0;

          for (const project of localData.projects) {
            const projectReleases = localData.releases.filter(r => r.projectId === project.id);
            projectReleases.forEach((release, index) => {
              releasesBatch.set(
                doc(firestore, `ganttapp_projects/${project.id}/releases/${release.id}`),
                releaseToFirestore(release, index)
              );
              releaseCount++;
            });
          }

          if (releaseCount > 0) {
            await releasesBatch.commit();
          }

          // Phase 3: Upload snapshots (subcollections — parent projects now exist)
          if (localSnapshots.length > 0) {
            const snapBatch = writeBatch(firestore);
            for (const snap of localSnapshots) {
              snapBatch.set(
                doc(firestore, `ganttapp_projects/${snap.projectId}/snapshots/${snap.id}`),
                snapshotToFirestore(snap)
              );
            }
            await snapBatch.commit();
          }
        }

        localStorage.setItem(STORAGE_MODE_KEY, 'cloud');
        setStorage(cloudService);

      } else {
        // --- Switch to local ---
        const currentIsCloud = storage.mode === 'cloud';

        if (currentIsCloud) {
          const confirmed = window.confirm(
            'Download your owned projects to local storage? Shared projects will not be downloaded.'
          );
          if (!confirmed) {
            setIsSwitching(false);
            return;
          }

          // Load data from cloud before switching
          const cloudData = await storage.loadAppData();
          const cloudSnapshots = await storage.loadSnapshots();

          // Flush pending writes and dispose cloud service
          const cloudService = storage as CloudGanttStorageService;
          await cloudService.flushPendingWrites();
          cloudService.dispose();

          // Save to local
          const localService = new LocalGanttStorageService();
          if (cloudData) {
            await localService.saveAppData(cloudData);
          }
          if (cloudSnapshots.length > 0) {
            await localService.saveSnapshots(cloudSnapshots);
          }

          setStorage(localService);
        } else {
          setStorage(new LocalGanttStorageService());
        }

        localStorage.setItem(STORAGE_MODE_KEY, 'local');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Mode switch failed';
      setSwitchError(message);
      console.error('Mode switch error:', error);
    } finally {
      setIsSwitching(false);
    }
  }, [storage, user]);

  return (
    <StorageContext value={{ storage, mode: storage.mode, switchMode, isSwitching, switchError }}>
      {children}
    </StorageContext>
  );
}

export function useStorage(): StorageContextType {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error('useStorage must be used within StorageProvider');
  return ctx;
}
