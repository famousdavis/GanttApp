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
  generateId,
} from '../../../shared/utils';
import type {
  ImportResult,
  ImportConflict,
  ConflictAction,
} from '../../../shared/utils/export';
import type { AppData } from '../../../shared/types/app';
import type { Snapshot } from '../../../shared/types/snapshots';
import { cloudRefusal, isCloudDataNotLoadedError } from '../../../shared/storage/cloud-data-not-loaded';
import { isPermissionDenied, isProjectNotSavedError } from '../../../shared/storage/cloud-not-saved';
import { isSnapshotsNotLoadedError } from '../../../shared/storage/snapshots-not-loaded';

// Minimal storage shape — the hook only needs mode, loadSnapshotsStrict and
// canWrite, not the full GanttStorageService. Easier to mock in tests.
interface ImportStorage {
  mode: 'local' | 'cloud';
  loadSnapshotsStrict: () => Promise<Snapshot[]>;
  canWrite: () => boolean;
}

const NOTHING_IMPORTED = 'Nothing was imported.';
const SNAPSHOTS_NOT_LOADED =
  'Nothing was imported, because your saved snapshots could not be loaded from the cloud. Please try again.';
const MERGE_NOT_SAVED =
  "The projects were imported here, but they were not saved to the cloud, so the file's snapshots were not imported.";
const REPLACE_ALL_NOT_SAVED =
  "Your data was replaced here, but the imported projects were not saved to the cloud, so the file's snapshots were not imported.";

/**
 * A merge whose snapshot load could not read every snapshot from the server
 * stopped before anything changed; a refused write means nothing was imported;
 * an imported project's own failed first save means its snapshots were not
 * written (`notSaved`); any other failure keeps its own message, except a
 * refusal by the rules. That reaches here only from the snapshot write, after
 * the import is on screen (the merge's load turns a refused read into
 * SnapshotsNotLoadedError), and the user's access is fine: the batch rewrites
 * the snapshots of a project they may only view.
 */
function importErrorText(err: unknown, notSaved: string): string {
  if (isSnapshotsNotLoadedError(err)) return SNAPSHOTS_NOT_LOADED;
  if (isCloudDataNotLoadedError(err)) return cloudRefusal(NOTHING_IMPORTED);
  if (isProjectNotSavedError(err)) return notSaved;
  if (isPermissionDenied(err)) return 'Projects imported, but snapshots could not be saved.';
  return sanitizeFirebaseError(err);
}

/**
 * In cloud mode an imported project gets an owner, as an added or copied one
 * does (v0.20.1). Export strips owners, so a file carries none. A project this
 * workspace already holds keeps that project's owner (none if it has none);
 * any other gets the signed-in user, whom its first save writes as its owner,
 * so the screen matches the cloud. Without an owner the Share and Delete
 * buttons stay hidden until a reload. Local mode passes no uid: no owner.
 */
export function withImportOwners(imported: AppData, workspace: AppData, ownerUid: string | undefined): AppData {
  if (!ownerUid) return imported;
  const held = new Map(workspace.projects.map((p) => [p.id, p] as const));
  return {
    ...imported,
    projects: imported.projects.map((project) => {
      const existing = held.get(project.id);
      if (!existing) return { ...project, owner: ownerUid };
      const { owner: _incoming, ...rest } = project;
      return existing.owner === undefined ? rest : { ...rest, owner: existing.owner };
    }),
  };
}

/**
 * In cloud mode an imported project this workspace does not hold gets a new
 * id, and so does each of its releases and snapshots (their projectId follows;
 * a snapshot's embedded releases stay as they are), as a merge "copy" already
 * does. The file's ids can name a project the cloud holds under another owner,
 * such as the original of a project someone else exported: kept, the import's
 * first save would update that project, which the rules refuse to a
 * non-member, and every later save would carry it. A project the workspace
 * holds keeps its id. Conflicts are found on the file's ids first; the
 * conflicts and decisions passed in follow the new ids. Local mode passes no
 * uid: nothing changes.
 */
export function withFreshImportIds(
  imported: ImportResult,
  workspace: AppData,
  ownerUid: string | undefined,
  conflicts: ImportConflict[] = [],
  decisions: Map<string, ConflictAction> = new Map()
): { imported: ImportResult; conflicts: ImportConflict[]; decisions: Map<string, ConflictAction> } {
  if (!ownerUid) return { imported, conflicts, decisions };
  const held = new Set(workspace.projects.map((p) => p.id));
  const ids = new Map<string, string>();
  imported.appData.projects.forEach((p) => { if (!held.has(p.id)) ids.set(p.id, generateId()); });
  const fresh = (id: string) => ids.get(id) ?? id;
  const renew = <T extends { id: string; projectId: string }>(item: T): T =>
    (ids.has(item.projectId) ? { ...item, id: generateId(), projectId: fresh(item.projectId) } : item);
  return {
    imported: {
      ...imported,
      appData: {
        ...imported.appData,
        projects: imported.appData.projects.map((p) => ({ ...p, id: fresh(p.id) })),
        releases: imported.appData.releases.map(renew),
      },
      snapshots: imported.snapshots?.map(renew),
    },
    conflicts: conflicts.map((c) => ({ ...c, incomingProject: { ...c.incomingProject, id: fresh(c.incomingProject.id) } })),
    decisions: new Map(Array.from(decisions.entries()).map(([id, action]) => [fresh(id), action] as const)),
  };
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
  /** The signed-in user's uid in cloud mode, for the imported projects' owners; undefined in local mode. */
  ownerUid?: string;
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
  ownerUid,
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
        // Refused before anything changes on screen when nothing can be saved
        // (a cloud session whose data never loaded), and before the snapshot
        // load, so the message is the one that says to reload.
        if (!storage.canWrite()) {
          showBanner({ kind: 'error', text: cloudRefusal(NOTHING_IMPORTED) });
          return;
        }
        // Strict: onReplaceSnapshots below replaces every snapshot with this
        // list, so a list missing anything would delete it. Rejects otherwise.
        const existingSnapshots = await storage.loadSnapshotsStrict();
        // This check cannot see a change made during the await above: `data` is
        // the value of the render this callback was created in, and
        // handleConfirmMerge compared that same `data` with the same conflicts
        // just before calling here, so the two always agree on that path. Fast
        // Path 1 passes no conflicts, found from the same `data`. It repeats
        // handleConfirmMerge's check; a change while loading goes unseen (SD-1).
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
        const incoming = withFreshImportIds(imported, data, ownerUid, freshConflicts, decisions);
        const { mergedData, mergedSnapshots, result } = applyImportDecisions(
          data, incoming.imported, existingSnapshots, incoming.decisions, incoming.conflicts
        );
        // Again: a sign-out or a switch to Local can dispose the service during the load; apply nothing then.
        if (!storage.canWrite()) {
          showBanner({ kind: 'error', text: cloudRefusal(NOTHING_IMPORTED) });
          return;
        }
        // NOTE: partial-apply window — updateData may persist before
        // onReplaceSnapshots rejects. Acceptable; matches pre-v0.24.0 behavior.
        updateData(withImportOwners(mergedData, data, ownerUid));
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
        showBanner({ kind: 'error', text: importErrorText(err, MERGE_NOT_SAVED) });
      } finally {
        // Guarantee reset even after unexpected throw (pitfall #27).
        // showBanner on non-throw paths also resets; this is the safety net.
        applyingRef.current = false;
        setApplying(false);
      }
    },
    [data, storage, selectedProjectId, setSelectedProjectId, updateData, onReplaceSnapshots, showBanner, ownerUid]
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
        if (!storage.canWrite()) {
          showBanner({ kind: 'error', text: cloudRefusal(NOTHING_IMPORTED) });
          return;
        }
        const { imported: incoming } = withFreshImportIds(imported, data, ownerUid);
        updateData(withImportOwners(incoming.appData, data, ownerUid));
        await onReplaceSnapshots(incoming.snapshots ?? []);
        if (incoming.appData.projects.length > 0) {
          setSelectedProjectId(incoming.appData.projects[0].id);
        }
        const n = incoming.appData.projects.length;
        const text =
          n > 0
            ? `All data replaced. ${n} project${n !== 1 ? 's' : ''} imported.`
            : 'All data replaced.';
        showBanner({ kind: 'success', text });
      } catch (err) {
        showBanner({ kind: 'error', text: importErrorText(err, REPLACE_ALL_NOT_SAVED) });
      } finally {
        applyingRef.current = false;
        setApplying(false);
      }
    },
    [data, storage, updateData, onReplaceSnapshots, setSelectedProjectId, showBanner, ownerUid]
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
    // Pre-async early-exit guard. applyMergeDecisions repeats it after its
    // snapshot load, on the same `data`, so it sees no change made meanwhile (SD-1).
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
