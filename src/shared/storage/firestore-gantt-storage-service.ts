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
import type { Firestore, QuerySnapshot } from 'firebase/firestore';
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
  shareProject as shareProjectFn,
  removeCollaborator as removeCollaboratorFn,
  getProjectMembers as getProjectMembersFn,
  listPendingInvites as listPendingInvitesFn,
} from './firestore-sharing';
import { getRevokeInvite, getResendInvite } from '../../lib/firebase';
import { MAX_SNAPSHOTS_TOTAL, MAX_SNAPSHOTS_PER_PROJECT } from './snapshot-limits';

const DEBOUNCE_MS = 500;

export interface CloudGanttStorageService extends GanttStorageService {
  subscribeToProject(
    projectId: string,
    callback: (releases: Release[], snapshot: QuerySnapshot) => void
  ): () => void;
  shareProject(projectId: string, targetEmail: string, role: ProjectRole): Promise<void>;
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

    // Register beforeunload to flush pending writes when tab closes
    this.beforeUnloadHandler = () => {
      if (this.pendingData) {
        this.executeSave().catch(() => {});
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.beforeUnloadHandler);
    }
  }

  // --- GanttStorageService interface ---

  async loadAppData(): Promise<AppData | null> {
    try {
      // Step 1: List projects (server-side membership filtering via where()).
      // v0.21.0 — constrained query so the Firestore list rule (which is now
      // `allow list: if isAuth()`) safely returns only this user's projects.
      // Previously used an unconstrained getDocs(collection(...)) with the rule
      // `allow list: if isAuth() && request.auth.uid in resource.data.members`
      // — that pattern fails as soon as the collection contains any project
      // the user isn't a member of, because Firestore evaluates list rules
      // against the query shape, not per-doc, and resource.data is undefined
      // for list ops. See cloud-storage-guide/ARCHITECTURE.md §6.5.
      const projectsSnap = await getDocs(
        query(
          collection(this.db, 'ganttapp_projects'),
          where(`members.${this.uid}`, 'in', ['owner', 'editor', 'viewer'])
        )
      );
      const projects: { id: string; meta: FirestoreProjectMeta }[] = [];

      for (const docSnap of projectsSnap.docs) {
        const data = docSnap.data() as FirestoreProjectMeta;
        // Defense-in-depth: server-side where() guarantees membership, but
        // we keep the client-side check to protect against future query-shape
        // regressions. Cost is one map lookup per project.
        if (data.members && data.members[this.uid]) {
          projects.push({ id: docSnap.id, meta: data });
        }
      }

      // Sort projects by order (v12.5 — preserves drag-and-drop reorder)
      projects.sort((a, b) => (a.meta.order ?? 0) - (b.meta.order ?? 0));

      // Step 2: Load releases for each project
      const releasesMap = new Map<string, { id: string; data: FirestoreRelease }[]>();
      for (const project of projects) {
        const releasesSnap = await getDocs(
          collection(this.db, `ganttapp_projects/${project.id}/releases`)
        );
        releasesMap.set(
          project.id,
          releasesSnap.docs.map(d => ({ id: d.id, data: d.data() as FirestoreRelease }))
        );
      }

      // Step 3: Load user settings
      const settingsDoc = await getDoc(doc(this.db, `ganttapp_settings/${this.uid}`));
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

      // v0.21.0 — constrained query (see loadAppData for rationale).
      const projectsSnap = await getDocs(
        query(
          collection(this.db, 'ganttapp_projects'),
          where(`members.${this.uid}`, 'in', ['owner', 'editor', 'viewer'])
        )
      );
      for (const projectDoc of projectsSnap.docs) {
        const data = projectDoc.data() as FirestoreProjectMeta;
        // Defense-in-depth client-side membership check (see loadAppData).
        if (!data.members || !data.members[this.uid]) continue;

        const snapshotsSnap = await getDocs(
          collection(this.db, `ganttapp_projects/${projectDoc.id}/snapshots`)
        );
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

    // v0.21.0 — constrained query (see loadAppData for rationale).
    const projectsSnap = await getDocs(
      query(
        collection(this.db, 'ganttapp_projects'),
        where(`members.${this.uid}`, 'in', ['owner', 'editor', 'viewer'])
      )
    );
    for (const projectDoc of projectsSnap.docs) {
      const data = projectDoc.data() as FirestoreProjectMeta;
      // Defense-in-depth client-side membership check (see loadAppData).
      if (!data.members || !data.members[this.uid]) continue;

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

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
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
        // GanttApp does not maintain a doc-keyed listener tracking map, so
        // there is no entry to remove for re-subscription; a full reconnect
        // mechanism is deferred.
        this.onSaveResult?.(message);
      }
    );

    this.unsubscribers.push(unsubscribe);
    return unsubscribe;
  }

  async shareProject(projectId: string, targetEmail: string, role: ProjectRole): Promise<void> {
    return shareProjectFn(this.db, this.uid, projectId, targetEmail, role);
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
    this.disposed = true;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];

    if (this.beforeUnloadHandler && typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }

    this.lastSavedState = null;
    this.pendingData = null;
  }

  // --- Private ---

  private async executeSave(): Promise<void> {
    const data = this.pendingData;
    if (!data || this.disposed) return;
    this.pendingData = null;

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
      if (!this.disposed && !this.pendingData) {
        this.pendingData = data;
      }
      this.onSaveResult?.(message);
    }
  }
}
