// Storage Context — provides GanttStorageService to the app
// Supports local ↔ cloud mode switching with data migration.

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { GanttStorageService, StorageMode } from '../shared/types/storage';
import { LocalGanttStorageService } from '../shared/storage/local-gantt-storage-service';
import { FirestoreGanttStorageServiceImpl } from '../shared/storage/firestore-gantt-storage-service';
import { db, isFirebaseAvailable } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { switchToCloudMode, switchToLocalMode } from './storage-mode-switch';

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
        if (!isFirebaseAvailable || !db) {
          throw new Error('Firebase is not configured. Cloud features are unavailable.');
        }
        if (!user) {
          throw new Error('You must sign in before switching to cloud storage.');
        }

        const confirmed = window.confirm(
          'Upload your local data to the cloud? Your local data will remain as a backup.'
        );
        if (!confirmed) {
          setIsSwitching(false);
          return;
        }

        const cloudService = await switchToCloudMode(db, user);
        localStorage.setItem(STORAGE_MODE_KEY, 'cloud');
        setStorage(cloudService);

      } else {
        if (storage.mode === 'cloud') {
          const confirmed = window.confirm(
            'Download your owned projects to local storage? Shared projects will not be downloaded.'
          );
          if (!confirmed) {
            setIsSwitching(false);
            return;
          }
        }

        const localService = await switchToLocalMode(storage);
        localStorage.setItem(STORAGE_MODE_KEY, 'local');
        setStorage(localService);
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
