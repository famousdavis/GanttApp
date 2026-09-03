// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// v0.26.0 — Import state machine extracted from ProjectsTab (pitfall #59).
// Hosts the full Smart Import flow: file-pick, parse, conflict detection,
// preview, decision changes, mode toggle, Confirm, Replace-All confirm, and
// banner reset. ProjectsTab consumes the hook and provides only the JSX shell.
//
// See docs/SPEC_DEVIATIONS.md for documented architectural departures from
// the Level 4 import spec (SD-1 closure boundary, SD-2 non-atomic remap,
// SD-5 coarse-grain abort, SD-6 cloneProject divergence, SD-7 aria-busy gap).

import { useState, useRef, useCallback } from 'react';
import type { ChangeEvent, MutableRefObject } from 'react';
import {
  parseImportedData,
  detectImportConflicts,
  conflictsEqual,
  applyImportDecisions,
  sanitizeFirebaseError,
  readFileAsText,
} from '../../../shared/utils';
import type {
  ImportResult,
  ImportConflict,
  ConflictAction,
} from '../../../shared/utils/export';
import type { AppData } from '../../../shared/types/app';
import type { Snapshot } from '../../../shared/types/snapshots';

// Minimal storage shape — the hook only needs mode + loadSnapshots, not the
// full GanttStorageService. Easier to mock in tests.
interface ImportStorage {
  mode: 'local' | 'cloud';
  loadSnapshots: () => Promise<Snapshot[]>;
}

export type ImportMode = 'merge' | 'replace-all';

export type ImportPreviewState = {
  imported: ImportResult;
  conflicts: ImportConflict[];
  decisions: Map<string, ConflictAction>;
  mode: ImportMode;
};

export type ImportBannerState = { kind: 'success' | 'error'; text: string };

interface UseImportStateOptions {
  data: AppData;
  storage: ImportStorage;
  updateData: (data: AppData) => void;
  onReplaceSnapshots: (snapshots: Snapshot[]) => Promise<void>;
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  appDataLoading: boolean;
}

export interface UseImportStateReturn {
  importPreview: ImportPreviewState | null;
  importBanner: ImportBannerState | null;
  replaceAllPending: boolean;
  applying: boolean;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  // Banner Dismiss exception (pitfall #11) — direct setter, not routed through
  // a transition helper. Banner dismiss is not a flow transition.
  setImportBanner: (banner: ImportBannerState | null) => void;
  openReplaceAllConfirm: () => void;
  cancelReplaceAllConfirm: () => void;
  handleConfirmReplaceAll: () => void;
  handleImport: (event: ChangeEvent<HTMLInputElement>) => void;
  handleConfirmMerge: () => void;
  handleImportCancel: () => void;
  onModeChange: (mode: ImportMode) => void;
  onDecisionChange: (projectId: string, action: ConflictAction) => void;
}

// APPLYING CONTRACT (discoverable form in ARCHITECTURE.md → "APPLYING Contract").
//
// applying = true means: "file is being read OR apply is in progress"
//
// Write sites (3): handleImport entry; applyMergeDecisions first sync line
//   after applyingRef guard; applyReplaceAll first sync line after applyingRef
//   guard. (Pitfall #53's "exactly two" is Zustand/applyMerge-specific;
//   IMPORT-DESIGN-GUIDE §"File Reader Defensiveness" explicitly places
//   setApplying at the file-pick boundary for Context-based apps.)
//
// Reset sites (ALL terminal paths MUST go through one of these):
//   showBanner — pre-apply errors, drift-abort, apply failure, apply success
//   showPreview — file resolves to preview
//   clearImportFlow — handleImportCancel (defensive)
//   try/finally in both apply functions — primary reset
//
// Risk: any new terminal path that bypasses all four locks the UI permanently.
//
// Same-tick reentrancy:
//   applyingRef (useRef): definitive guard in apply functions; immune to stale
//     closure because refs are read synchronously at call time.
//   if (applying) return in confirm handlers: belt-and-suspenders UI guard;
//     stale-closure-prone on the same tick before React's commit.
//   readerPendingRef: guards the file-read window specifically.

export function useImportState({
  data,
  storage,
  updateData,
  onReplaceSnapshots,
  selectedProjectId,
  setSelectedProjectId,
  appDataLoading,
}: UseImportStateOptions): UseImportStateReturn {
  const [importPreview, setImportPreview] = useState<ImportPreviewState | null>(null);
  const [importBanner, setImportBanner] = useState<ImportBannerState | null>(null);
  const [replaceAllPending, setReplaceAllPending] = useState(false);
  const [applying, setApplying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const readerPendingRef = useRef(false);
  const applyingRef = useRef(false); // same-tick guard, immune to stale closure

  // The three permitted state transitions. Banner dismiss uses raw setter
  // (pitfall #11 exception, marked with `// raw setter` in callers).
  const showPreview = useCallback((state: ImportPreviewState) => {
    setImportBanner(null);
    setReplaceAllPending(false);
    setApplying(false);
    setImportPreview(state);
  }, []);

  const showBanner = useCallback((banner: ImportBannerState) => {
    setImportPreview(null);
    setReplaceAllPending(false);
    setApplying(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setImportBanner(banner);
  }, []);

  const clearImportFlow = useCallback(() => {
    setImportPreview(null);
    setReplaceAllPending(false);
    setApplying(false);
  }, []);

  // Default decisions for a fresh preview (pitfall #22, v0.26.0):
  // - type:'id' → 'skip' UNCONDITIONALLY (matching names not evidence the
  //   import is newer; spec pitfall #22).
  // - type:'name' → 'copy'.
  const computeDefaultDecisions = useCallback(
    (conflicts: ImportConflict[]): Map<string, ConflictAction> => {
      const m = new Map<string, ConflictAction>();
      for (const c of conflicts) {
        m.set(c.incomingProject.id, c.type === 'id' ? 'skip' : 'copy');
      }
      return m;
    },
    []
  );

  const applyMergeDecisions = useCallback(
    async (
      imported: ImportResult,
      decisions: Map<string, ConflictAction>,
      originalConflicts: ImportConflict[]
    ) => {
      // Same-tick guard (ref-based, immune to stale closure).
      if (applyingRef.current) return;
      applyingRef.current = true;
      setApplying(true); // write site 2 of 3
      try {
        const existingSnapshots = await storage.loadSnapshots();
        // Authoritative stale-data guard — the await above is where a real-time
        // onSnapshot can fire and mutate `data`. Pre-click guard in
        // handleConfirmMerge is a fast early-exit for the non-cloud case.
        const freshConflicts = detectImportConflicts(imported, data);
        if (!conflictsEqual(freshConflicts, originalConflicts)) {
          // Fast Path 1 has no preview window — use a genericized message.
          const msg =
            originalConflicts.length === 0
              ? 'The workspace changed during import. Please try again.'
              : 'The workspace changed while the preview was open. Please review your import again.';
          showBanner({ kind: 'error', text: msg });
          return;
        }
        const { mergedData, mergedSnapshots, result } = applyImportDecisions(
          data, imported, existingSnapshots, decisions, freshConflicts
        );
        // NOTE: partial-apply window — updateData may persist before
        // onReplaceSnapshots rejects. Acceptable; matches pre-v0.24.0 behavior.
        updateData(mergedData);
        await onReplaceSnapshots(mergedSnapshots);
        // replacedIdMap contains only name-conflict remappings (existing.id ≠ incoming.id).
        const newId = result.replacedIdMap.get(selectedProjectId);
        if (newId) setSelectedProjectId(newId);
        const parts: string[] = [];
        if (result.added > 0)    parts.push(`${result.added} project${result.added !== 1 ? 's' : ''} added`);
        if (result.copied > 0)   parts.push(`${result.copied} copied`);
        if (result.replaced > 0) parts.push(`${result.replaced} replaced`);
        if (result.skipped > 0)  parts.push(`${result.skipped} skipped`);
        const text = parts.length > 0 ? parts.join(', ') + '.' : 'No projects were imported.';
        showBanner({ kind: 'success', text });
      } catch (err) {
        showBanner({ kind: 'error', text: sanitizeFirebaseError(err) });
      } finally {
        // Guarantee reset even after unexpected throw (pitfall #27).
        // showBanner on non-throw paths also resets; this is the safety net.
        applyingRef.current = false;
        setApplying(false);
      }
    },
    [data, storage, selectedProjectId, setSelectedProjectId, updateData, onReplaceSnapshots, showBanner]
  );

  const applyReplaceAll = useCallback(
    async (imported: ImportResult) => {
      if (applyingRef.current) return;
      applyingRef.current = true;
      setApplying(true); // write site 3 of 3
      // SD-7: setApplying(true) followed immediately by synchronous
      // updateData() — aria-busy may not be observed by assistive tech on
      // this path (pitfall #86). Deferred; see docs/SPEC_DEVIATIONS.md.
      try {
        updateData(imported.appData);
        await onReplaceSnapshots(imported.snapshots ?? []);
        if (imported.appData.projects.length > 0) {
          setSelectedProjectId(imported.appData.projects[0].id);
        }
        const n = imported.appData.projects.length;
        const text =
          n > 0
            ? `All data replaced. ${n} project${n !== 1 ? 's' : ''} imported.`
            : 'All data replaced.';
        showBanner({ kind: 'success', text });
      } catch (err) {
        showBanner({ kind: 'error', text: sanitizeFirebaseError(err) });
      } finally {
        applyingRef.current = false;
        setApplying(false);
      }
    },
    [updateData, onReplaceSnapshots, setSelectedProjectId, showBanner]
  );

  const handleImport = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      // Re-entrancy guard (pitfall #48).
      if (readerPendingRef.current) return;
      // Clear stale error (pitfall #79) and stale preview (NEW-8) FIRST,
      // before any processing.
      setImportBanner(null);
      setImportPreview(null);
      readerPendingRef.current = true;
      // Write site 1 of 3 — immediate UI feedback at file-pick boundary
      // (design guide §"File Reader Defensiveness").
      setApplying(true);
      fileInputRef.current = event.target;

      try {
        const content = await readFileAsText(file);
        readerPendingRef.current = false;
        const imported = parseImportedData(content);

        if (!imported) {
          showBanner({ kind: 'error', text: 'Invalid file format' });
          return;
        }

        const conflicts = detectImportConflicts(imported, data);

        // Fast Path 1: ganttapp-project-export with zero conflicts → apply.
        // Cloud guard (pitfall #69): during Firestore hydration the in-memory
        // projects array may be briefly empty; without this gate we'd silently
        // create duplicates once cloud data arrives. Cloud always shows preview.
        if (
          imported.exportType === 'ganttapp-project-export' &&
          conflicts.length === 0 &&
          storage.mode === 'local'
        ) {
          await applyMergeDecisions(imported, new Map(), []);
          return;
        }

        // Fast Path 2: full-workspace replace into empty workspace.
        // !appDataLoading gate prevents silent Replace-All against a still-
        // loading workspace. Cloud guard (pitfall #69), same rationale.
        const isReplaceAllShape =
          imported.exportType === 'ganttapp-all-projects' ||
          imported.exportType === 'legacy';
        if (
          isReplaceAllShape &&
          data.projects.length === 0 &&
          !appDataLoading &&
          storage.mode === 'local'
        ) {
          await applyReplaceAll(imported);
          return;
        }

        // Otherwise: show the preview. Initial mode:
        // - 'ganttapp-project-export' → 'merge' (no replace-all path)
        // - 'ganttapp-all-projects'   → 'merge' (new format; no established habit)
        // - 'legacy'                  → 'replace-all' (every legacy file is replace-all today)
        const initialMode: ImportMode =
          imported.exportType === 'legacy' ? 'replace-all' : 'merge';
        showPreview({
          imported,
          conflicts,
          decisions: computeDefaultDecisions(conflicts),
          mode: initialMode,
        });
      } catch (error) {
        readerPendingRef.current = false;
        console.error('Error importing file:', error instanceof Error ? error.message : 'Unknown error');
        showBanner({ kind: 'error', text: 'Error importing file' });
      }
    },
    [
      data,
      storage,
      appDataLoading,
      applyMergeDecisions,
      applyReplaceAll,
      computeDefaultDecisions,
      showBanner,
      showPreview,
    ]
  );

  const handleConfirmMerge = useCallback(() => {
    // Belt-and-suspenders UI-layer guard; applyingRef in applyMergeDecisions
    // is the definitive same-tick protection.
    if (applying) return;
    if (!importPreview) return;
    // Pre-async early-exit guard: catches the common non-cloud case cheaply.
    // Authoritative check runs again inside applyMergeDecisions after
    // loadSnapshots.
    const freshConflicts = detectImportConflicts(importPreview.imported, data);
    if (!conflictsEqual(freshConflicts, importPreview.conflicts)) {
      showBanner({
        kind: 'error',
        text: 'The workspace changed while the preview was open. Please review your import again.',
      });
      return;
    }
    // Capture before fire-and-forget to avoid cross-await closure dependency.
    const originalConflicts = importPreview.conflicts;
    void applyMergeDecisions(importPreview.imported, importPreview.decisions, originalConflicts);
  }, [applying, importPreview, data, applyMergeDecisions, showBanner]);

  const handleConfirmReplaceAll = useCallback(() => {
    if (applying) return;
    if (!importPreview) return;
    // Capture imported before any state mutation — protects against future
    // modifications that could clear importPreview while applyReplaceAll is in
    // flight (equivalent to pendingPreviewRef pattern; pitfall #54 N/A for the
    // current implementation but the capture preserves the invariant).
    const imported = importPreview.imported;
    setReplaceAllPending(false); // modal dismisses before async starts
    void applyReplaceAll(imported);
  }, [applying, importPreview, applyReplaceAll]);

  const openReplaceAllConfirm = useCallback(() => setReplaceAllPending(true), []);
  const cancelReplaceAllConfirm = useCallback(() => setReplaceAllPending(false), []);

  const handleImportCancel = useCallback(() => {
    clearImportFlow();
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [clearImportFlow]);

  const onModeChange = useCallback((mode: ImportMode) => {
    // Preserves decisions — pitfall #17.
    setImportPreview(prev => (prev ? { ...prev, mode } : null));
  }, []);

  const onDecisionChange = useCallback(
    (projectId: string, action: ConflictAction) => {
      setImportPreview(prev => {
        if (!prev) return null;
        // MUST clone the Map — mutating in place does not trigger re-render (pitfall #19).
        const decisions = new Map(prev.decisions);
        decisions.set(projectId, action);
        return { ...prev, decisions };
      });
    },
    []
  );

  return {
    importPreview,
    importBanner,
    replaceAllPending,
    applying,
    fileInputRef,
    setImportBanner,
    openReplaceAllConfirm,
    cancelReplaceAllConfirm,
    handleConfirmReplaceAll,
    handleImport,
    handleConfirmMerge,
    handleImportCancel,
    onModeChange,
    onDecisionChange,
  };
}
