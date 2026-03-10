// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Storage Context — provides GanttStorageService to the app
// Supports local → cloud one-way upload with existence-based dedup (v12.0).
// Cloud is the source of truth — no cloud→local download on sign-out.
// v12.3: Replaced skip/connectToCloudDirect with cancelUploadPrompt (stays in local mode).

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { GanttStorageService, StorageMode } from '../shared/types/storage';
import { LocalGanttStorageService } from '../shared/storage/local-gantt-storage-service';
import { FirestoreGanttStorageServiceImpl } from '../shared/storage/firestore-gantt-storage-service';
import type { CloudGanttStorageService } from '../shared/storage/firestore-gantt-storage-service';
import { db, isFirebaseAvailable } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { switchToCloudMode } from './storage-mode-switch';
import { sanitizeString, sanitizeFirebaseError } from '../shared/utils/validation';

const STORAGE_MODE_KEY = 'ganttapp-storage-mode';
const HAS_UPLOADED_KEY = 'ganttapp-has-uploaded-to-cloud';

export interface UploadResult {
  uploaded: number;
  skipped: number;
}

interface StorageContextType {
  storage: GanttStorageService;
  mode: StorageMode;
  switchMode: (mode: StorageMode) => Promise<UploadResult | void>;
  isSwitching: boolean;
  switchError: string | null;
  uploadResult: UploadResult | null;
  clearUploadResult: () => void;
  needsUploadPrompt: { projectCount: number } | null;
  confirmUploadPrompt: () => Promise<void>;
  cancelUploadPrompt: () => void;
}

const StorageContext = createContext<StorageContextType | undefined>(undefined);

export function StorageProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  // Lazy initializer ensures stable reference — prevents infinite re-render loops
  // in AppDataContext's [storage] dependency
  const [storage, setStorage] = useState<GanttStorageService>(
    () => new LocalGanttStorageService()
  );
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [needsUploadPrompt, setNeedsUploadPrompt] = useState<{ projectCount: number } | null>(null);
  const restoredRef = useRef(false);

  const clearUploadResult = useCallback(() => setUploadResult(null), []);

  // Mode restoration on mount — sequenced to avoid race conditions (v12.0)
  // 1. Wait for auth to resolve
  // 2. Check stored mode
  // 3. If 'cloud': check for local projects, decide whether to prompt or connect directly
  useEffect(() => {
    if (restoredRef.current) return;
    if (authLoading) return; // Wait for auth to resolve first

    const storedMode = localStorage.getItem(STORAGE_MODE_KEY);
    if (storedMode !== 'cloud') return;
    if (!isFirebaseAvailable || !db) return;
    if (!isAuthenticated || !user) return;

    restoredRef.current = true;

    // Check if there are local projects that need uploading
    const localRaw = localStorage.getItem('ganttAppData');
    let hasLocalProjects = false;
    let localProjectCount = 0;
    if (localRaw) {
      try {
        const parsed = JSON.parse(localRaw);
        if (Array.isArray(parsed.projects) && parsed.projects.length > 0) {
          hasLocalProjects = true;
          localProjectCount = parsed.projects.length;
        }
      } catch {
        // Invalid JSON — treat as no local projects
      }
    }

    if (hasLocalProjects) {
      // Local projects exist — show upload prompt, stay on local service
      // Don't create cloud driver yet (prevents flash of cloud data)
      setNeedsUploadPrompt({ projectCount: localProjectCount });
    } else {
      // No local projects — connect directly to cloud
      // Covers both "returning user" and "fresh browser" scenarios
      const cloudService = new FirestoreGanttStorageServiceImpl(db, user.uid);
      cloudService.createUserProfile(
        sanitizeString(user.displayName ?? 'Unknown'),
        sanitizeString(user.email ?? '')
      ).catch((err) => console.error('[StorageContext] createUserProfile failed:', err));
      setStorage(cloudService);
    }
  }, [authLoading, isAuthenticated, user]);

  // Handle user confirming the upload prompt
  const confirmUploadPrompt = useCallback(async () => {
    if (!db || !user) return;
    setNeedsUploadPrompt(null);
    setIsSwitching(true);
    setSwitchError(null);

    try {
      const result = await switchToCloudMode(db, user);
      localStorage.setItem(STORAGE_MODE_KEY, 'cloud');
      localStorage.setItem(HAS_UPLOADED_KEY, 'true');
      setUploadResult({ uploaded: result.uploaded, skipped: result.skipped });
      setStorage(result.service);
    } catch (error) {
      setSwitchError(sanitizeFirebaseError(error));
      console.error('Upload prompt confirm error:', error);
    } finally {
      setIsSwitching(false);
    }
  }, [user]);

  // Handle user cancelling the upload prompt — stay in local mode (v12.3)
  const cancelUploadPrompt = useCallback(() => {
    setNeedsUploadPrompt(null);
    // Revert stored mode to 'local' since we're not connecting to cloud
    localStorage.setItem(STORAGE_MODE_KEY, 'local');
  }, []);

  const switchMode = useCallback(async (newMode: StorageMode): Promise<UploadResult | void> => {
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

        const result = await switchToCloudMode(db, user);
        localStorage.setItem(STORAGE_MODE_KEY, 'cloud');
        localStorage.setItem(HAS_UPLOADED_KEY, 'true');
        setUploadResult({ uploaded: result.uploaded, skipped: result.skipped });
        setStorage(result.service);
        return { uploaded: result.uploaded, skipped: result.skipped };

      } else {
        // Switch to local — no data download (cloud is source of truth, v12.0)
        if (storage.mode === 'cloud') {
          // Flush pending writes and dispose cloud service
          const cloudService = storage as CloudGanttStorageService;
          await cloudService.flushPendingWrites();
          cloudService.dispose();
        }

        // Create new local service (loads whatever is already in localStorage)
        const localService = new LocalGanttStorageService();
        localStorage.setItem(STORAGE_MODE_KEY, 'local');
        setStorage(localService);
      }
    } catch (error) {
      setSwitchError(sanitizeFirebaseError(error));
      console.error('Mode switch error:', error);
    } finally {
      setIsSwitching(false);
    }
  }, [storage, user]);

  return (
    <StorageContext value={{
      storage,
      mode: storage.mode,
      switchMode,
      isSwitching,
      switchError,
      uploadResult,
      clearUploadResult,
      needsUploadPrompt,
      confirmUploadPrompt,
      cancelUploadPrompt,
    }}>
      {children}
    </StorageContext>
  );
}

export function useStorage(): StorageContextType {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error('useStorage must be used within StorageProvider');
  return ctx;
}
