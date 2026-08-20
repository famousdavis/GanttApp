// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// FirestoreGanttStorageService — cloud mode implementation of GanttStorageService.
// Manages lifecycle (debouncing, disposal, beforeunload) and delegates to:
//   - firestore-save-executor.ts — 2-phase batch commit with diff-based saves
//   - firestore-sharing.ts — project sharing, member management, user profiles

import type { GanttStorageService, StorageMode } from '../types/storage';
import type { AppData } from '../types/app';
import type { Snapshot } from '../types/snapshots';
import type { Release } from '../types/models';
import type {
  FirestoreProjectMeta,
  FirestoreRelease,
  FirestoreSnapshot,
  FirestoreUserSettings,
  PendingInvite,
  ProjectRole,
} from '../types/firestore';
import type { Firestore, QueryDocumentSnapshot, QuerySnapshot } from 'firebase/firestore';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import {
  snapshotToFirestore,
  firestoreToProject,
  firestoreReleasesToFlat,
  userSettingsToAppData,
  firestoreSnapshotToFlat,
} from '../utils/firestore-converters';
import { sanitizeFirebaseError } from '../utils/validation';
import { executeFirestoreSave } from './firestore-save-executor';
import {
  removeCollaborator as removeCollaboratorFn,
  getProjectMembers as getProjectMembersFn,
  listPendingInvites as listPendingInvitesFn,
} from './firestore-sharing';
import { getRevokeInvite, getResendInvite, auth } from '../../lib/firebase';
import { MAX_SNAPSHOTS_TOTAL, MAX_SNAPSHOTS_PER_PROJECT } from './snapshot-limits';

const DEBOUNCE_MS = 200; // v0.27.0 (Pass 3, D1): reduced from 500ms

export interface CloudGanttStorageService extends GanttStorageService {
  subscribeToProject(
    projectId: string,
    callback: (releases: Release[], snapshot: QuerySnapshot) => void
  ): () => void;
  /** Renamed from removeProjectMember in v18.0.0 (D3). */
  removeCollaborator(projectId: string, targetUid: string): Promise<void>;
  getProjectMembers(projectId: string): Promise<{ uid: string; role: ProjectRole; email?: string }[]>;
  /** Bulk invitation pending-list query — see firestore-sharing.listPendingInvites. */
  listPendingInvites(projectId: string): Promise<PendingInvite[]>;
  /** Revoke a pending invitation by token. Owner-only enforced server-side. */
  revokeInvite(tokenId: string): Promise<void>;
  /** Resend an invitation email. Subject to per-invite send-count cap (5). */
  resendInvite(tokenId: string): Promise<void>;
  flushPendingWrites(): Promise<void>;
  /**
   * Cancel pending debounced save without executing. Pending edits discarded.
   * Used by sign-out and cloud→local switch when we want to abandon in-flight
   * writes rather than commit them with about-to-be-revoked credentials.
   */
  cancelPendingSaves(): void;
  dispose(): void;
}

export class FirestoreGanttStorageServiceImpl implements CloudGanttStorageService {
  readonly mode: StorageMode = 'cloud';
  private db: Firestore;
  private uid: string;
  private lastSavedState: AppData | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingData: AppData | null = null;
  private unsubscribers: (() => void)[] = [];
  private beforeUnloadHandler: (() => void) | null = null;
  private pageHideHandler: (() => void) | null = null; // v0.27.0 (Pass 3, D2)
  private disposed = false;
  private onSaveResult?: (error: string | null) => void;

  constructor(
    db: Firestore,
    uid: string,
    onSaveResult?: (error: string | null) => void
  ) {
    this.db = db;
    this.uid = uid;
    this.onSaveResult = onSaveResult;

    // v0.27.0 (Pass 3, D2): register BOTH beforeunload and pagehide with
    // distinct function references so removeEventListener targets each
    // independently. Both handlers are idempotent: whichever fires first
    // clears pendingData; the second finds it null and returns.
    // pagehide also fires on bfcache entry (event.persisted === true), so
    // pending edits are committed before mobile-safari suspends the tab.
    // Known limitations:
    //   - onSnapshot listeners may not resume after bfcache restoration.
    //   - executeSave is fire-and-forget; a fast mobile OS kill can interrupt.
    this.beforeUnloadHandler = () => {
      if (this.pendingData) {
        this.executeSave().catch(() => {});
      }
    };
    this.pageHideHandler = () => {
      if (this.pendingData) {
        this.executeSave().catch(() => {});
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.beforeUnloadHandler);
      window.addEventListener('pagehide', this.pageHideHandler);
    }
  }

  // --- GanttStorageService interface ---

  async loadAppData(): Promise<AppData | null> {
    try {
      // Step 1: List projects via the shared member-scoped helper (v0.22.1).
      const memberDocs = await this.listMemberProjects();
      // v0.27.0 (Pass 6, I1a): bail if user changed during the await.
      if (auth?.currentUser?.uid !== this.uid) return null;
      const projects: { id: string; meta: FirestoreProjectMeta }[] =
        memberDocs.map(d => ({ id: d.id, meta: d.data() }));

      // Sort projects by order (v12.5 — preserves drag-and-drop reorder)
      projects.sort((a, b) => (a.meta.order ?? 0) - (b.meta.order ?? 0));

      // Step 2: Load releases for each project
      const releasesMap = new Map<string, { id: string; data: FirestoreRelease }[]>();
      for (const project of projects) {
        const releasesSnap = await getDocs(
          collection(this.db, `ganttapp_projects/${project.id}/releases`)
        );
        // v0.27.0 (Pass 6, I1a): bail mid-loop if user changed.
        if (auth?.currentUser?.uid !== this.uid) return null;
        releasesMap.set(
          project.id,
          releasesSnap.docs.map(d => ({ id: d.id, data: d.data() as FirestoreRelease }))
        );
      }

      // Step 3: Load user settings
      const settingsDoc = await getDoc(doc(this.db, `ganttapp_settings/${this.uid}`));
      // v0.27.0 (Pass 6, I1a): final uid check before returning data.
      if (auth?.currentUser?.uid !== this.uid) return null;
      const settings = settingsDoc.exists() ? (settingsDoc.data() as FirestoreUserSettings) : null;

      // Reconstruct flat AppData
      const appData: AppData = {
        projects: projects.map(p => firestoreToProject(p.id, p.meta)),
        releases: projects.flatMap(p => {
          const entries = releasesMap.get(p.id) ?? [];
          return firestoreReleasesToFlat(p.id, entries);
        }),
        ...((settings ? userSettingsToAppData(settings) : {}) as Partial<AppData>),
      };

      // Cache for subsequent diff comparisons
      this.lastSavedState = structuredClone(appData);
      return appData;
    } catch (error) {
      console.error('Failed to load cloud data:', sanitizeFirebaseError(error));
      return null;
    }
  }

  async saveAppData(data: AppData): Promise<void> {
    if (this.disposed) return;
    this.pendingData = data;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.executeSave();
    }, DEBOUNCE_MS);
  }

  /** Immediate save — bypasses debounce for structural mutations. */
  async saveAppDataImmediate(data: AppData): Promise<void> {
    if (this.disposed) return;
    this.pendingData = data;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    await this.executeSave();
  }

  async loadSnapshots(): Promise<Snapshot[]> {
    try {
      const allSnapshots: Snapshot[] = [];

      const memberDocs = await this.listMemberProjects();
      // v0.27.0 (Pass 6, I1a): bail if user changed during the listing await.
      if (auth?.currentUser?.uid !== this.uid) return [];
      for (const projectDoc of memberDocs) {
        const snapshotsSnap = await getDocs(
          collection(this.db, `ganttapp_projects/${projectDoc.id}/snapshots`)
        );
        // v0.27.0 (Pass 6, I1a): bail mid-loop if user changed.
        if (auth?.currentUser?.uid !== this.uid) return [];
        for (const snapDoc of snapshotsSnap.docs) {
          allSnapshots.push(
            firestoreSnapshotToFlat(snapDoc.id, projectDoc.id, snapDoc.data() as FirestoreSnapshot)
          );
        }
      }

      return allSnapshots;
    } catch (error) {
      console.error('Failed to load cloud snapshots:', sanitizeFirebaseError(error));
      return [];
    }
  }

  async saveSnapshots(snapshots: Snapshot[]): Promise<void> {
    const byProject = new Map<string, Snapshot[]>();
    for (const snap of snapshots) {
      const group = byProject.get(snap.projectId) ?? [];
      group.push(snap);
      byProject.set(snap.projectId, group);
    }

    const batch = writeBatch(this.db);

    const memberDocs = await this.listMemberProjects();
    for (const projectDoc of memberDocs) {
      const existingSnaps = await getDocs(
        collection(this.db, `ganttapp_projects/${projectDoc.id}/snapshots`)
      );
      for (const existing of existingSnaps.docs) {
        batch.delete(existing.ref);
      }
    }

    byProject.forEach((projectSnapshots, projectId) => {
      for (const snap of projectSnapshots) {
        const ref = doc(this.db, `ganttapp_projects/${projectId}/snapshots/${snap.id}`);
        batch.set(ref, snapshotToFirestore(snap));
      }
    });

    await batch.commit();
  }

  async addSnapshot(snapshot: Snapshot): Promise<Snapshot[] | null> {
    const all = await this.loadSnapshots();
    if (all.length >= MAX_SNAPSHOTS_TOTAL) return null;

    const projectCount = all.filter(s => s.projectId === snapshot.projectId).length;
    if (projectCount >= MAX_SNAPSHOTS_PER_PROJECT) return null;

    const ref = doc(this.db, `ganttapp_projects/${snapshot.projectId}/snapshots/${snapshot.id}`);
    await setDoc(ref, snapshotToFirestore(snapshot));

    all.push(snapshot);
    return all;
  }

  async deleteSnapshot(snapshotId: string): Promise<Snapshot[]> {
    const all = await this.loadSnapshots();
    const toDelete = all.find(s => s.id === snapshotId);
    if (toDelete) {
      await deleteDoc(
        doc(this.db, `ganttapp_projects/${toDelete.projectId}/snapshots/${snapshotId}`)
      );
    }
    return all.filter(s => s.id !== snapshotId);
  }

  async deleteSnapshotsForProject(projectId: string): Promise<Snapshot[]> {
    const all = await this.loadSnapshots();
    const toDelete = all.filter(s => s.projectId === projectId);
    const batch = writeBatch(this.db);
    for (const snap of toDelete) {
      batch.delete(doc(this.db, `ganttapp_projects/${projectId}/snapshots/${snap.id}`));
    }
    await batch.commit();
    return all.filter(s => s.projectId !== projectId);
  }

  // --- Cloud-specific methods (delegated) ---

  subscribeToProject(
    projectId: string,
    callback: (releases: Release[], snapshot: QuerySnapshot) => void
  ): () => void {
    const releasesRef = collection(this.db, `ganttapp_projects/${projectId}/releases`);
    const q = query(releasesRef);

    // Hold a forward reference so the error callback can call the latest
    // unsubscribe — `unsubscribe` itself isn't initialized until onSnapshot
    // returns, but the error callback may fire on the same tick.
    let unsubscribe: () => void = () => {};

    unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        // v0.27.0 (Pass 6, I1a): uid guard. Discard if the authenticated user
        // has changed since this subscription was set up — e.g., token expired
        // and a different user signed in before dispose() could run. Also fires
        // briefly during user-initiated sign-out (auth.currentUser is cleared
        // before dispose). Acceptable: dispose() cancels subscriptions before
        // firebaseSignOut in performSignOutWithCleanup.
        if (auth?.currentUser?.uid !== this.uid) return;
        const entries = querySnapshot.docs.map(d => ({
          id: d.id,
          data: d.data() as FirestoreRelease,
        }));
        const releases = firestoreReleasesToFlat(projectId, entries);
        callback(releases, querySnapshot);
      },
      (error) => {
        const message = sanitizeFirebaseError(error);
        console.error('Project subscription error:', message);
        // Surface the error through the same channel as auto-save failures.
        this.onSaveResult?.(message);
        // v0.22.2 (S9): on permission-denied, the listener has been
        // permanently rejected (e.g., the owner just removed this user
        // from the project). Tear down the subscription and remove our
        // entry from the unsubscribers list so dispose() doesn't run a
        // dead handle. Other error codes (unavailable, deadline-exceeded)
        // are transient — leave them to the SDK's internal retry.
        const code = (error as { code?: string }).code;
        if (code === 'permission-denied') {
          unsubscribe();
          this.unsubscribers = this.unsubscribers.filter(u => u !== unsubscribe);

          // v0.27.0 (Pass 5, I2): prune driver state BEFORE dispatching the
          // eviction event. Without this, the next executeFirestoreSave diff
          // would treat the revoked project as "removed" and add batch writes
          // to its subcollections → permission-denied → re-queue → infinite
          // save-fail loop until sign-out.
          //
          // Known limitation: if executeSave is already in flight, it captured
          // the old pendingData at function entry. That batch may write to
          // the revoked project's subcollections and fail once with
          // permission-denied. executeSave's own catch logs that and reports it
          // through onSaveResult, which StorageSection renders as a cloud-sync
          // error under Settings -> Storage. Subsequent saves use the pruned
          // state and succeed. The infinite loop is what's fixed.
          if (this.lastSavedState) {
            this.lastSavedState = {
              ...this.lastSavedState,
              projects: this.lastSavedState.projects.filter(p => p.id !== projectId),
              releases: this.lastSavedState.releases.filter(r => r.projectId !== projectId),
            };
          }
          if (this.pendingData) {
            this.pendingData = {
              ...this.pendingData,
              projects: this.pendingData.projects.filter(p => p.id !== projectId),
              releases: this.pendingData.releases.filter(r => r.projectId !== projectId),
            };
          }

          // Notify AppDataContext and useSnapshots to evict in-memory state.
          // Event name is 'ganttapp:' prefixed — app-scoped, not suite-wide.
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('ganttapp:project-revoked', { detail: { projectId } }),
            );
          }
        }
      }
    );

    this.unsubscribers.push(unsubscribe);
    return unsubscribe;
  }

  async removeCollaborator(projectId: string, targetUid: string): Promise<void> {
    return removeCollaboratorFn(this.db, this.uid, projectId, targetUid);
  }

  async getProjectMembers(projectId: string): Promise<{ uid: string; role: ProjectRole; email?: string }[]> {
    return getProjectMembersFn(this.db, projectId);
  }

  async listPendingInvites(projectId: string): Promise<PendingInvite[]> {
    return listPendingInvitesFn(this.db, this.uid, projectId);
  }

  async revokeInvite(tokenId: string): Promise<void> {
    const callable = getRevokeInvite();
    if (!callable) throw new Error('Cloud invitations not configured.');
    await callable({ tokenId });
  }

  async resendInvite(tokenId: string): Promise<void> {
    const callable = getResendInvite();
    if (!callable) throw new Error('Cloud invitations not configured.');
    await callable({ tokenId });
  }

  // --- Lifecycle ---

  async flushPendingWrites(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.pendingData) {
      await this.executeSave();
    }
  }

  /**
   * Cancel any pending debounced save without executing it. Pending edits
   * are intentionally discarded. Idempotent and safe to call after dispose().
   * Used by sign-out and cloud→local switch when we want to abandon in-flight
   * writes rather than commit them with about-to-be-revoked credentials.
   */
  cancelPendingSaves(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingData = null;
  }

  dispose(): void {
    // v0.27.0 (Pass 1 — explicit idempotency): the individual cleanups below
    // are each safe to call repeatedly (null timer, empty unsubscribers, null
    // handler), but an early return makes double-dispose visibly a no-op for
    // future readers and prevents an extra render in the rare double-cleanup
    // path where E1 + user-initiated sign-out both fire performSignOutWithCleanup.
    if (this.disposed) return;
    this.disposed = true;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];

    if (typeof window !== 'undefined') {
      if (this.beforeUnloadHandler) {
        window.removeEventListener('beforeunload', this.beforeUnloadHandler);
        this.beforeUnloadHandler = null;
      }
      // v0.27.0 (Pass 3, D2): mirror unload listener removal.
      if (this.pageHideHandler) {
        window.removeEventListener('pagehide', this.pageHideHandler);
        this.pageHideHandler = null;
      }
    }

    this.lastSavedState = null;
    this.pendingData = null;
  }

  // --- Private ---

  /**
   * List the project documents the current user is a member of.
   *
   * Server-side membership filtering via `where('members.${uid}', 'in', [...])`
   * — this is required because the Firestore `list` rule on
   * `ganttapp_projects` is `allow list: if isAuth()`. An unconstrained
   * `getDocs(collection(...))` would fail as soon as the collection contains
   * any project the user is not a member of, since Firestore evaluates list
   * rules against the query shape (resource.data is undefined for list ops).
   * See cloud-storage-guide/ARCHITECTURE.md §6.5.
   *
   * Defense-in-depth: even though the server-side `where()` guarantees
   * membership, we keep the client-side filter to protect against future
   * query-shape regressions. Cost is one map lookup per project.
   *
   * Extracted in v0.22.1 to dedupe the preamble previously inlined in
   * loadAppData, loadSnapshots, and saveSnapshots.
   */
  private async listMemberProjects(): Promise<QueryDocumentSnapshot<FirestoreProjectMeta>[]> {
    // ⚠️ This filter's SHAPE is a security boundary, not a convenience.
    // firestore.rules constrains `list` on this collection to
    // members[request.auth.uid] in ['owner', 'editor', 'viewer'], and Firestore
    // permits a list query ONLY when its filter PROVES that constraint. Drop or
    // change this filter and you do not get more rows — you get
    // PERMISSION_DENIED, and no project loads at all.
    // Until 2026-08-19 the rule was `allow list: if isAuth()`, which let any
    // signed-in SPERT user read every project in this collection.
    // ⚠️ The rule and this query are pinned together by
    // rules-tests/project-collections-list.test.ts in the spert-landing-page
    // repo (`npm run test:rules`). That test encodes this query AS WRITTEN and
    // lives in a DIFFERENT repository, so it will NOT fail when you edit this
    // line. Change one, change the other.
    const snap = await getDocs(
      query(
        collection(this.db, 'ganttapp_projects'),
        where(`members.${this.uid}`, 'in', ['owner', 'editor', 'viewer'])
      )
    );
    return snap.docs.filter((d) => {
      const data = d.data() as FirestoreProjectMeta;
      return !!(data.members && data.members[this.uid]);
    }) as QueryDocumentSnapshot<FirestoreProjectMeta>[];
  }

  private async executeSave(): Promise<void> {
    const data = this.pendingData;
    if (!data || this.disposed) return;
    this.pendingData = null;

    // v0.27.0 (Pass 6, I1a / save-side): abort without re-queuing if the
    // authenticated user has changed since this save was queued. Without
    // this, a stale save would fire under the new user's auth token, hit
    // Firestore's membership check, fail with permission-denied, re-queue
    // (in the catch block below), and loop forever — same failure shape
    // as I2 (eviction infinite loop).
    if (auth?.currentUser?.uid !== this.uid) return;

    try {
      this.lastSavedState = await executeFirestoreSave(
        this.db, this.uid, data, this.lastSavedState
      );
      // Clear any prior surfaced error after a successful recovery save.
      this.onSaveResult?.(null);
    } catch (error) {
      const message = sanitizeFirebaseError(error);
      console.error('Failed to save cloud data:', message);
      // If disposed, do not re-queue — the caller has moved on (e.g., sign-out
      // or cloud→local switch) and this data is intentionally dropped.
      // v0.27.0 (Pass 6, I1a): also do not re-queue if uid changed mid-save.
      if (
        !this.disposed
        && !this.pendingData
        && auth?.currentUser?.uid === this.uid
      ) {
        this.pendingData = data;
      }
      this.onSaveResult?.(message);
    }
  }
}
