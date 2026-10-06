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
import { executeFirestoreSave, type ViewerSkip } from './firestore-save-executor';
import { unsentReleaseIds } from './unsent-release-changes';
import {
  removeCollaborator as removeCollaboratorFn,
  getProjectMembers as getProjectMembersFn,
  listPendingInvites as listPendingInvitesFn,
} from './firestore-sharing';
import { getRevokeInvite, getResendInvite, auth } from '../../lib/firebase';
import { MAX_SNAPSHOTS_TOTAL, MAX_SNAPSHOTS_PER_PROJECT } from './snapshot-limits';
import { CLOUD_LOAD_FAILED_MESSAGE, CloudDataNotLoadedError } from './cloud-data-not-loaded';
import { ProjectNotSavedError, VIEWER_CHANGE_NOT_SAVED_MESSAGE } from './cloud-not-saved';
import { SnapshotsNotLoadedError } from './snapshots-not-loaded';

const DEBOUNCE_MS = 200; // v0.27.0 (Pass 3, D1): reduced from 500ms

type ReleaseCallback = (releases: Release[], snapshot: QuerySnapshot) => void;

/** A save between its capture and its settlement. */
interface InFlightSave {
  data: AppData;
  /** The projects the listener's error path pruned while this save was in flight (D). */
  pruned: Set<string>;
  settled: Promise<void>;
}

/** A listener asked for on a project the baseline does not hold yet (B). */
interface DeferredListener {
  projectId: string;
  callback: ReleaseCallback;
  /** Stops the listener once it has started. */
  stop: (() => void) | null;
}

/** `data` without these projects and their releases. */
function withoutProjects(data: AppData, projectIds: Set<string>): AppData {
  if (projectIds.size === 0) return data;
  return {
    ...data,
    projects: data.projects.filter(p => !projectIds.has(p.id)),
    releases: data.releases.filter(r => !projectIds.has(r.projectId)),
  };
}

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
  setAsideLoad(loaded: AppData): void;
}

export class FirestoreGanttStorageServiceImpl implements CloudGanttStorageService {
  readonly mode: StorageMode = 'cloud';
  private db: Firestore;
  private uid: string;
  // What the cloud held at the last load or save; each save is a diff
  // against it. Null until a load succeeds, and nothing is written while it
  // is: a diff against nothing writes every project as new (a full set() with
  // only this user as a member) and every setting over the stored ones.
  private lastSavedState: AppData | null = null;
  // The latest load's result as returned, and the baseline (and the
  // listeners' last deliveries) it replaced, so that a load AppDataContext
  // does not apply can be set aside.
  private lastLoad: {
    returned: AppData;
    previous: AppData | null;
    previousDelivered: Map<string, Release[]>;
  } | null = null;
  // True while the message last reported is this service's failed-load one.
  private reportingLoadFailure = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingData: AppData | null = null;
  private unsubscribers: (() => void)[] = [];
  private beforeUnloadHandler: (() => void) | null = null;
  private pageHideHandler: (() => void) | null = null; // v0.27.0 (Pass 3, D2)
  private disposed = false;
  private onSaveResult?: (error: string | null) => void;
  // Every save between its capture and its settlement. Two can be in flight
  // at once: executeSave does not serialise. The snapshot wait (S), the
  // revoke filter (D) and the unsent-changes guard (H) all read it.
  private inFlight = new Set<InFlightSave>();
  // B: listeners asked for on projects the baseline does not hold yet.
  private deferred = new Set<DeferredListener>();
  // H: per project, the releases of the last snapshot its listener delivered
  // with no pending writes.
  private lastDelivered = new Map<string, Release[]>();

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
      const appData = await this.readCloudAppData();
      if (appData) this.adopt(appData);
      return appData;
    } catch (error) {
      console.error('Failed to load cloud data:', sanitizeFirebaseError(error));
      // Saving is refused until a load succeeds; say so, or edits look saved
      // when they are not. A failed reload after a good load changes nothing:
      // saves continue against that load.
      if (!this.lastSavedState) this.reportLoadFailure();
      return null;
    }
  }

  /**
   * What loadAppData returns, read without adopting it: the data saves are
   * compared with, the load that may be set aside and the failed-load report
   * stay as they are.
   */
  async readAppData(): Promise<AppData | null> {
    try {
      return await this.readCloudAppData();
    } catch (error) {
      console.error('Failed to read cloud data:', sanitizeFirebaseError(error));
      return null;
    }
  }

  /**
   * AppDataContext did not apply this load (see GanttStorageService), so put
   * back the baseline from before it. Only the latest load can be set aside:
   * once a newer load or a save has replaced it, it is no longer the baseline.
   * With nothing to put back (a first load), saving stays refused, and that is
   * reported as a failed load.
   */
  setAsideLoad(loaded: AppData): void {
    if (!this.lastLoad || this.lastLoad.returned !== loaded) return;
    this.lastSavedState = this.lastLoad.previous;
    this.lastDelivered = this.lastLoad.previousDelivered;
    this.lastLoad = null;
    if (!this.lastSavedState) this.reportLoadFailure();
  }

  canWrite(): boolean {
    return !this.disposed && this.lastSavedState !== null;
  }

  async saveAppData(data: AppData): Promise<void> {
    // Refused, silently, until a load has succeeded (see lastSavedState).
    if (!this.canWrite()) return;
    this.pendingData = data;
    // A project gone from the screen has no listener to compare with.
    this.lastDelivered.forEach((_releases, projectId) => {
      if (!data.projects.some(p => p.id === projectId)) this.lastDelivered.delete(projectId);
    });

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.executeSave();
    }, DEBOUNCE_MS);
  }

  /** Immediate save — bypasses debounce for structural mutations. */
  async saveAppDataImmediate(data: AppData): Promise<void> {
    if (!this.canWrite()) return;
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

  /**
   * Every snapshot of every project this user is a member of, each read from
   * the server, for an action that then replaces them all: saveSnapshots
   * deletes every snapshot it is not given. Rejects with
   * SnapshotsNotLoadedError, and never returns part of the list, when a read
   * fails (a document the converter cannot read included), when the member
   * list or a project's snapshots are answered from the cache (offline, the
   * SDK answers getDocs from it with no error), or when the signed-in user
   * changes during the reads. loadSnapshots returns [] for the first and last
   * of these, and the cached list for the second.
   */
  async loadSnapshotsStrict(): Promise<Snapshot[]> {
    try {
      const allSnapshots: Snapshot[] = [];
      const memberDocs = await this.listMemberProjects(true);
      if (auth?.currentUser?.uid !== this.uid) throw new SnapshotsNotLoadedError();
      for (const projectDoc of memberDocs) {
        const snapshotsSnap = await getDocs(
          collection(this.db, `ganttapp_projects/${projectDoc.id}/snapshots`)
        );
        if (snapshotsSnap.metadata?.fromCache) throw new SnapshotsNotLoadedError();
        if (auth?.currentUser?.uid !== this.uid) throw new SnapshotsNotLoadedError();
        for (const snapDoc of snapshotsSnap.docs) {
          allSnapshots.push(
            firestoreSnapshotToFlat(snapDoc.id, projectDoc.id, snapDoc.data() as FirestoreSnapshot)
          );
        }
      }
      return allSnapshots;
    } catch (error) {
      console.error('Failed to load cloud snapshots:', sanitizeFirebaseError(error));
      throw new SnapshotsNotLoadedError();
    }
  }

  async saveSnapshots(snapshots: Snapshot[]): Promise<void> {
    this.refuseUntilLoaded();
    const byProject = new Map<string, Snapshot[]>();
    for (const snap of snapshots) {
      const group = byProject.get(snap.projectId) ?? [];
      group.push(snap);
      byProject.set(snap.projectId, group);
    }
    // The projects it writes under, not the member projects it clears.
    await this.waitForFirstSaves(snapshots.map(s => s.projectId));

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
    this.refuseUntilLoaded();
    await this.waitForFirstSaves([snapshot.projectId]);
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
    this.refuseUntilLoaded();
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
    this.refuseUntilLoaded();
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

  /**
   * B: a listener opens only on a project the baseline holds. A listen on a
   * project the cloud does not hold yet (added, copied or imported here) is
   * refused, because the rules read its document, and the refusal evicts it.
   * So it waits for the save that writes the project: it starts once that
   * whole save is acknowledged (not at phase 1, which could show the project
   * before its releases). A save that is dropped or fails starts nothing. The
   * unsubscribe returned cancels the wait, and stops the listener if it started.
   */
  subscribeToProject(projectId: string, callback: ReleaseCallback): () => void {
    if (this.holdsInBaseline(projectId)) return this.openListener(projectId, callback);
    const deferral: DeferredListener = { projectId, callback, stop: null };
    this.deferred.add(deferral);
    return () => {
      this.deferred.delete(deferral);
      deferral.stop?.();
    };
  }

  private openListener(projectId: string, callback: ReleaseCallback): () => void {
    const releasesRef = collection(this.db, `ganttapp_projects/${projectId}/releases`);
    const q = query(releasesRef);

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
        // H (R46): while this browser holds release changes for the project
        // that it has not sent (in the pending save, or in a save in flight
        // until it settles), delivering would replace them on screen, and the
        // save that follows would undo them in the cloud. The snapshot is
        // dropped: a change it carries to the project's other releases shows
        // at the next snapshot, and this user's save overwrites a change to
        // the same release.
        if (this.holdsUnsentReleaseChanges(projectId)) return;
        if (!querySnapshot.metadata?.hasPendingWrites) this.lastDelivered.set(projectId, releases);
        callback(releases, querySnapshot);
      },
      (error) => {
        const message = sanitizeFirebaseError(error);
        console.error('Project subscription error:', message);
        // Surface the error through the same channel as auto-save failures.
        this.report(message);
        // v0.22.2 (S9): on permission-denied, the listener has been
        // permanently rejected (e.g., the owner just removed this user
        // from the project). Tear down the subscription and remove our
        // entry from the unsubscribers list so dispose() doesn't run a
        // dead handle.
        //
        // v0.28.25: per the SDK's onSnapshot contract, no further callbacks
        // follow onError, so whatever the code this listener is finished.
        // Nothing here re-subscribes it, deliberately: any re-subscribe
        // would need a code filter and a backoff. For any code other than
        // permission-denied, the log and onSaveResult above are all that
        // happens; AppDataContext re-creates listeners only when its
        // subscription effect re-runs. In emulator tests (@firebase/firestore
        // 4.14.0 via firebase 12.12.1; Node, and one Chromium run per failure
        // mode), no dropped, stalled or dead connection reached an error
        // callback registered this way. In Node the SDK retried dropped
        // connections itself; in the browser its WebChannel transport
        // re-opened the channel; and the listener caught up afterwards
        // without the app's help, except in Node, where a connection that
        // died without closing stayed silent until the client next wrote.
        const code = (error as { code?: string }).code;
        if (code === 'permission-denied') {
          unsubscribe();
          this.unsubscribers = this.unsubscribers.filter(u => u !== unsubscribe);

          // v0.27.0 (Pass 5, I2): prune driver state BEFORE dispatching the
          // eviction event. Without this, the next executeFirestoreSave diff
          // would treat the revoked project as "removed" and delete it, which
          // the rules refuse (a non-owner's delete, or a delete of a missing
          // document) → re-queue → every later save fails until sign-out.
          //
          // D: a save already in flight captured its data before this prune.
          // Its batch may still fail on the revoked project: its catch reports
          // that through onSaveResult (Settings -> Storage), and queues its data
          // again without the pruned project. If it succeeds, its acknowledgement
          // installs its result without the pruned project too, whichever of it
          // and the next save's capture comes first. Without that, the
          // acknowledgement would put the project back in the baseline and the
          // next save would delete it, refused, every later save failing.
          this.inFlight.forEach(save => save.pruned.add(projectId));
          this.lastDelivered.delete(projectId);
          // A revoke moves the baseline on, so the load before it can no
          // longer be set aside.
          this.lastLoad = null;
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
    this.deferred.clear();
    this.lastDelivered.clear();

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
    this.lastLoad = null;
    this.pendingData = null;
  }

  // --- Private ---

  private report(message: string | null): void {
    this.reportingLoadFailure = message === CLOUD_LOAD_FAILED_MESSAGE;
    this.onSaveResult?.(message);
  }

  private reportLoadFailure(): void {
    if (!this.disposed) this.report(CLOUD_LOAD_FAILED_MESSAGE);
  }

  /** Snapshot writes throw, so the action that asked can say it did not happen. */
  private refuseUntilLoaded(): void {
    if (!this.canWrite()) throw new CloudDataNotLoadedError();
  }

  /**
   * Take a load's result as the data later saves are compared with, keeping
   * the baseline it replaces in case AppDataContext does not apply this load.
   */
  private adopt(appData: AppData): void {
    this.lastLoad = { returned: appData, previous: this.lastSavedState, previousDelivered: this.lastDelivered };
    this.lastSavedState = structuredClone(appData);
    // What the listeners last delivered described the baseline this load replaces.
    this.lastDelivered = new Map();
    // A good load clears this service's own failed-load report, and only
    // that: a failed save's message stays until a save succeeds.
    if (this.reportingLoadFailure) this.report(null);
  }

  /**
   * Read the projects, their releases and the settings. Null when the signed-in
   * user changes during the reads; a failed read throws. Changes nothing.
   */
  private async readCloudAppData(): Promise<AppData | null> {
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
    return {
      projects: projects.map(p => firestoreToProject(p.id, p.meta)),
      releases: projects.flatMap(p => {
        const entries = releasesMap.get(p.id) ?? [];
        return firestoreReleasesToFlat(p.id, entries);
      }),
      ...((settings ? userSettingsToAppData(settings) : {}) as Partial<AppData>),
    };
  }

  /**
   * List the project documents the current user is a member of.
   *
   * Server-side membership filtering via `where('members.${uid}', 'in', [...])`
   * is required by the `list` rule on `ganttapp_projects`. The comment at the
   * top of the method body says why, and what pins the rule and this query
   * together.
   *
   * Defense-in-depth: even though the server-side `where()` guarantees
   * membership, we keep the client-side filter to protect against future
   * query-shape regressions. Cost is one map lookup per project.
   *
   * Extracted in v0.22.1 to dedupe the preamble previously inlined in
   * loadAppData, loadSnapshots, and saveSnapshots.
   *
   * `fromServer` (loadSnapshotsStrict): throw SnapshotsNotLoadedError when the
   * list is answered from the cache, as it is offline, with no error.
   */
  private async listMemberProjects(fromServer = false): Promise<QueryDocumentSnapshot<FirestoreProjectMeta>[]> {
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
    if (fromServer && snap.metadata?.fromCache) throw new SnapshotsNotLoadedError();
    return snap.docs.filter((d) => {
      const data = d.data() as FirestoreProjectMeta;
      return !!(data.members && data.members[this.uid]);
    }) as QueryDocumentSnapshot<FirestoreProjectMeta>[];
  }

  private async executeSave(): Promise<void> {
    const data = this.pendingData;
    const baseline = this.lastSavedState;
    if (!data || this.disposed) return;
    this.pendingData = null;
    // No baseline, so nothing to compare the save with: the load it was queued
    // against has been set aside. The save is dropped rather than kept for the
    // next flush, which would write it against whatever baseline exists by then.
    if (!baseline) return;

    // v0.27.0 (Pass 6, I1a / save-side): abort without re-queuing if the
    // authenticated user has changed since this save was queued. Without
    // this, a stale save would fire under the new user's auth token, hit
    // Firestore's membership check, fail with permission-denied, re-queue
    // (in the catch block below), and loop forever — same failure shape
    // as I2 (eviction infinite loop).
    if (auth?.currentUser?.uid !== this.uid) return;

    // Registered in the turn that captured the data, so the guards that read
    // in-flight saves never miss one.
    let settle!: () => void;
    const save: InFlightSave = {
      data,
      pruned: new Set(),
      settled: new Promise<void>((resolve) => { settle = resolve; }),
    };
    this.inFlight.add(save);
    try {
      const skipped: ViewerSkip[] = [];
      const saved = await executeFirestoreSave(this.db, this.uid, data, baseline, skipped);
      // D: what the cloud holds after this save, less what was pruned meanwhile.
      this.lastSavedState = withoutProjects(saved, save.pruned);
      this.lastLoad = null; // the baseline is now this save's
      this.startDeferred();
      // Clears any prior surfaced error after a successful recovery save,
      // unless the save skipped a viewer's own change (R53).
      this.report(this.viewerChangeSkipped(skipped, data, baseline) ? VIEWER_CHANGE_NOT_SAVED_MESSAGE : null);
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
        // D: without the projects pruned while it was in flight.
        this.pendingData = withoutProjects(data, save.pruned);
      }
      this.report(message);
    } finally {
      this.inFlight.delete(save);
      settle();
    }
  }

  private holdsInBaseline(projectId: string): boolean {
    return !!this.lastSavedState?.projects.some(p => p.id === projectId);
  }

  /** B: open each deferred listener whose project the baseline now holds. */
  private startDeferred(): void {
    if (this.disposed || auth?.currentUser?.uid !== this.uid) return;
    this.deferred.forEach((deferral) => {
      if (!this.holdsInBaseline(deferral.projectId)) return;
      this.deferred.delete(deferral);
      deferral.stop = this.openListener(deferral.projectId, deferral.callback);
    });
  }

  /** H: whether the pending save, or a save in flight, holds release changes of this project not yet sent. */
  private holdsUnsentReleaseChanges(projectId: string): boolean {
    const baseline = this.lastSavedState;
    if (!baseline) return false;
    const delivered = this.lastDelivered.get(projectId);
    const unsent = (data: AppData | null) =>
      !!data && unsentReleaseIds(projectId, data, baseline, delivered).length > 0;
    return unsent(this.pendingData) || Array.from(this.inFlight).some(save => unsent(save.data));
  }

  /**
   * R53: whether a save skipped this user's own change to a project they may
   * only view: a content field, or a release that differs both from the
   * baseline and from what the listener last delivered. A delivered change of
   * the owner's, sent back by the app, and an order shift are not.
   */
  private viewerChangeSkipped(skipped: ViewerSkip[], data: AppData, baseline: AppData): boolean {
    return skipped.some(skip => skip.contentChanged
      || unsentReleaseIds(skip.projectId, data, baseline, this.lastDelivered.get(skip.projectId))
        .some(id => skip.releaseIds.includes(id)));
  }

  private awaitingFirstSave(projectId: string): boolean {
    if (this.holdsInBaseline(projectId)) return false;
    return this.pendingHolds(projectId)
      || Array.from(this.inFlight).some(save => save.data.projects.some(p => p.id === projectId));
  }

  private pendingHolds(projectId: string): boolean {
    return !!this.pendingData?.projects.some(p => p.id === projectId);
  }

  /** Until no save is in flight; each round takes in the saves started meanwhile. */
  private async savesSettled(): Promise<void> {
    while (this.inFlight.size > 0) {
      await Promise.all(Array.from(this.inFlight, save => save.settled));
    }
  }

  /**
   * S: a snapshot write under a project waits for that project's first save,
   * since the rules refuse a snapshot under a project the cloud does not hold.
   * Only a target awaiting its first save waits: one not in the baseline AND
   * in the pending save or a save in flight. (A project added on another
   * device, or shared since the load, is in the cloud but not the baseline.)
   * First it waits until no save is in flight: a save run beside another
   * diffs against the same baseline and repeats its writes. Then it runs the
   * pending save at once if that holds a target, at most once per call, and
   * waits again. It throws if a target is still not in the baseline: its save
   * failed, or it left the pending save before any save took it.
   */
  private async waitForFirstSaves(projectIds: string[]): Promise<void> {
    const waiting = Array.from(new Set(projectIds)).filter(id => this.awaitingFirstSave(id));
    if (waiting.length === 0) return;
    await this.savesSettled();
    if (waiting.some(id => this.awaitingFirstSave(id) && this.pendingHolds(id))) {
      await this.flushPendingWrites();
    }
    await this.savesSettled();
    if (waiting.some(id => !this.holdsInBaseline(id))) throw new ProjectNotSavedError();
  }
}
