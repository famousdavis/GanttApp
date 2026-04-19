// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Storage Context — provides GanttStorageService to the app
// Supports local → cloud one-way upload with existence-based dedup (v12.0).
// Cloud is the source of truth — no cloud→local download on sign-out.
// v12.3: Replaced skip/connectToCloudDirect with cancelUploadPrompt (stays in local mode).

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { signOut as firebaseSignOut } from 'firebase/auth';
import type { AppData } from '../shared/types/app';
import type { GanttStorageService, StorageMode } from '../shared/types/storage';
import { LocalGanttStorageService } from '../shared/storage/local-gantt-storage-service';
import { FirestoreGanttStorageServiceImpl } from '../shared/storage/firestore-gantt-storage-service';
import type { CloudGanttStorageService } from '../shared/storage/firestore-gantt-storage-service';
import { auth, db, isFirebaseAvailable } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { switchToCloudMode } from './storage-mode-switch';
import { sanitizeString, sanitizeFirebaseError } from '../shared/utils/validation';
import { registerSignOutCleanup } from './signOutCleanupRegistry';
import { runAppDataReset } from './appDataResetRegistry';

const STORAGE_MODE_KEY = 'ganttapp-storage-mode';
// v16.5-migration key: set by earlier versions, never read. Removed as a
// one-time migration cleanup inside performSignOutWithCleanup step 7.
const HAS_UPLOADED_KEY_V16_5_LEGACY = 'ganttapp-has-uploaded-to-cloud';

export interface UploadResult {
  uploaded: number;
  skipped: number;
}

interface StorageContextType {
  storage: GanttStorageService;
  mode: StorageMode;
  switchMode: (mode: StorageMode, inMemoryProjectCount?: number) => Promise<UploadResult | void>;
  isSwitching: boolean;
  switchError: string | null;
  uploadResult: UploadResult | null;
  clearUploadResult: () => void;
  needsUploadPrompt: { projectCount: number } | null;
  confirmUploadPrompt: () => Promise<void>;
  cancelUploadPrompt: () => void;

  /**
   * v16.6 — Centralized sign-out helper. Cancels pending cloud writes,
   * clears in-memory AppData state, disposes the cloud service, resets
   * storage mode to 'local', swaps to a fresh LocalGanttStorageService,
   * then signs out of Firebase. Zero arguments (ARCH-2).
   */
  performSignOutWithCleanup: () => Promise<void>;

  /**
   * v16.6 (UX-2) — cloud→local transition prompt. When the user clicks
   * Local while signed in with in-memory cloud projects, switchMode sets
   * this instead of swapping immediately. The caller (StorageSection)
   * renders a dialog offering "Keep Local Copy" or "Discard".
   */
  needsCloudToLocalPrompt: { projectCount: number } | null;
  /**
   * v16.6 — "Keep Local Copy" handler. Takes the current AppData snapshot
   * from the caller (ARCH-1 — no snapshot registry), writes it to a new
   * LocalGanttStorageService, then disposes the cloud service and swaps.
   */
  confirmKeepLocalCopy: (currentAppData: AppData) => Promise<void>;
  /**
   * v16.6 — "Discard" handler. Disposes the cloud service and swaps to a
   * fresh LocalGanttStorageService without persisting cloud data.
   */
  confirmDiscardCloudData: () => Promise<void>;
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
  // v16.6 (UX-2): cloud→local keep-or-discard prompt.
  const [needsCloudToLocalPrompt, setNeedsCloudToLocalPrompt] = useState<{ projectCount: number } | null>(null);
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
      setUploadResult({ uploaded: result.uploaded, skipped: result.skipped });
      setStorage(result.service);
    } catch (error) {
      setSwitchError(sanitizeFirebaseError(error));
      console.error('Upload prompt confirm error:', sanitizeFirebaseError(error));
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

  /**
   * v16.6 — Centralized sign-out flow. Step order is load-bearing:
   *   1. cancelPendingSaves on the cloud service (discard, don't flush).
   *   2. runAppDataReset() — clears in-memory AppData state; sets the
   *      isResettingRef flag so the save effect is suppressed during the
   *      reset + subsequent load effect.
   *   3. dispose the cloud service (unsubscribe listeners, remove
   *      beforeunload handler, clear internal state).
   *   4. Reset STORAGE_MODE_KEY to 'local'.
   *   5. setStorage(new LocalGanttStorageService()) — triggers the
   *      [storage] load effect in AppDataContext, which re-lowers
   *      isResettingRef when it settles.
   *   6. Clear stale transition state (isSwitching, switchError,
   *      uploadResult, needsUploadPrompt).
   *   7. Remove the v16.5 dead localStorage key as a one-time migration.
   *   8. firebaseSignOut(auth) — only async step.
   *
   * Steps 1–7 are synchronous. No awaits until step 8.
   */
  const performSignOutWithCleanup = useCallback(async (): Promise<void> => {
    // Step 1: cancel pending cloud writes
    if (storage.mode === 'cloud') {
      (storage as CloudGanttStorageService).cancelPendingSaves();
    }

    // Step 2: clear in-memory AppData state
    runAppDataReset();

    // Step 3: dispose cloud service if active
    if (storage.mode === 'cloud') {
      (storage as CloudGanttStorageService).dispose();
    }

    // Step 4: reset storage mode key
    localStorage.setItem(STORAGE_MODE_KEY, 'local');

    // Step 5: swap to a fresh local service
    setStorage(new LocalGanttStorageService());

    // Step 6: clear stale transition state
    setIsSwitching(false);
    setSwitchError(null);
    setUploadResult(null);
    setNeedsUploadPrompt(null);

    // Step 7: remove v16.5 dead key (one-time migration cleanup for users
    // upgrading from a version that wrote but never read this flag).
    localStorage.removeItem(HAS_UPLOADED_KEY_V16_5_LEGACY);

    // Step 8: Firebase sign-out
    if (auth) {
      await firebaseSignOut(auth);
    }
  }, [storage]);

  // Register the cleanup helper with the module-level registry so
  // AuthContext's ToS-failure path can invoke it without violating
  // the AuthProvider → StorageProvider ordering constraint.
  useEffect(() => {
    const deregister = registerSignOutCleanup(performSignOutWithCleanup);
    return deregister;
  }, [performSignOutWithCleanup]);

  const switchMode = useCallback(async (
    newMode: StorageMode,
    inMemoryProjectCount?: number
  ): Promise<UploadResult | void> => {
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
        setUploadResult({ uploaded: result.uploaded, skipped: result.skipped });
        setStorage(result.service);
        return { uploaded: result.uploaded, skipped: result.skipped };

      } else {
        // v16.6 (UX-2): cloud → local with in-memory projects → prompt.
        // Don't dispose the cloud service yet — the Keep-Local-Copy branch
        // needs it alive so it can call cancelPendingSaves + dispose AFTER
        // the snapshot is written to localStorage.
        if (storage.mode === 'cloud' && (inMemoryProjectCount ?? 0) > 0) {
          setNeedsCloudToLocalPrompt({ projectCount: inMemoryProjectCount as number });
          setIsSwitching(false);
          return;
        }

        // No projects to preserve (or already local). Use sign-out-style
        // cleanup semantics: cancel pending (v16.6) instead of flushing.
        if (storage.mode === 'cloud') {
          const cloudService = storage as CloudGanttStorageService;
          cloudService.cancelPendingSaves();
          cloudService.dispose();
        }

        // Create new local service (loads whatever is already in localStorage)
        const localService = new LocalGanttStorageService();
        localStorage.setItem(STORAGE_MODE_KEY, 'local');
        setStorage(localService);
      }
    } catch (error) {
      setSwitchError(sanitizeFirebaseError(error));
      console.error('Mode switch error:', sanitizeFirebaseError(error));
    } finally {
      setIsSwitching(false);
    }
  }, [storage, user]);

  // v16.6 (UX-2): Keep a local copy of in-memory cloud projects, then swap.
  // currentAppData is passed by the caller (SettingsTab/StorageSection via
  // useAppData()) — no snapshot registry (ARCH-1).
  const confirmKeepLocalCopy = useCallback(async (currentAppData: AppData): Promise<void> => {
    const cloudService = storage as CloudGanttStorageService;

    // Step 1: write the current cloud snapshot to a fresh local service.
    // Do this BEFORE cancel/dispose so we never lose the projects to an
    // error-path short-circuit.
    const localService = new LocalGanttStorageService();
    await localService.saveAppData(currentAppData);

    // Step 2: cancel pending cloud writes (consistent with sign-out semantics).
    if (storage.mode === 'cloud') {
      cloudService.cancelPendingSaves();
    }

    // Step 3: dispose the cloud service.
    if (storage.mode === 'cloud') {
      cloudService.dispose();
    }

    // Step 4: clear in-memory state (save effect suppressed via isResettingRef).
    runAppDataReset();

    // Step 5: swap to the already-populated local service. The [storage]
    // load effect will read the just-written localStorage data back into
    // AppDataContext state.
    setStorage(localService);

    // Step 6: persist mode + clear transition state.
    localStorage.setItem(STORAGE_MODE_KEY, 'local');
    setNeedsCloudToLocalPrompt(null);
    setIsSwitching(false);
  }, [storage]);

  // v16.6 (UX-2): Discard in-memory cloud data. Does not write to
  // localStorage. The new local service loads whatever is already on disk
  // (possibly stale pre-cloud data, possibly empty).
  const confirmDiscardCloudData = useCallback(async (): Promise<void> => {
    const cloudService = storage as CloudGanttStorageService;

    if (storage.mode === 'cloud') {
      cloudService.cancelPendingSaves();
      cloudService.dispose();
    }

    runAppDataReset();
    setStorage(new LocalGanttStorageService());
    localStorage.setItem(STORAGE_MODE_KEY, 'local');
    setNeedsCloudToLocalPrompt(null);
    setIsSwitching(false);
  }, [storage]);

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
      performSignOutWithCleanup,
      needsCloudToLocalPrompt,
      confirmKeepLocalCopy,
      confirmDiscardCloudData,
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
