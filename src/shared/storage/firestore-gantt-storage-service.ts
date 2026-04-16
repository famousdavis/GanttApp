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
  removeProjectMember as removeProjectMemberFn,
  getProjectMembers as getProjectMembersFn,
  createUserProfile as createUserProfileFn,
} from './firestore-sharing';

const DEBOUNCE_MS = 500;
const MAX_SNAPSHOTS_TOTAL = 100;
const MAX_SNAPSHOTS_PER_PROJECT = 50;

export interface CloudGanttStorageService extends GanttStorageService {
  subscribeToProject(
    projectId: string,
    callback: (releases: Release[], snapshot: QuerySnapshot) => void
  ): () => void;
  shareProject(projectId: string, targetEmail: string, role: ProjectRole): Promise<void>;
  removeProjectMember(projectId: string, targetUid: string): Promise<void>;
  getProjectMembers(projectId: string): Promise<{ uid: string; role: ProjectRole; email?: string }[]>;
  createUserProfile(displayName: string, email: string): Promise<void>;
  flushPendingWrites(): Promise<void>;
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

  constructor(db: Firestore, uid: string) {
    this.db = db;
    this.uid = uid;

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
      // Step 1: List projects (client-side membership filtering)
      const projectsSnap = await getDocs(collection(this.db, 'ganttapp_projects'));
      const projects: { id: string; meta: FirestoreProjectMeta }[] = [];

      for (const docSnap of projectsSnap.docs) {
        const data = docSnap.data() as FirestoreProjectMeta;
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

      const projectsSnap = await getDocs(collection(this.db, 'ganttapp_projects'));
      for (const projectDoc of projectsSnap.docs) {
        const data = projectDoc.data() as FirestoreProjectMeta;
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

    const projectsSnap = await getDocs(collection(this.db, 'ganttapp_projects'));
    for (const projectDoc of projectsSnap.docs) {
      const data = projectDoc.data() as FirestoreProjectMeta;
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

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const entries = querySnapshot.docs.map(d => ({
        id: d.id,
        data: d.data() as FirestoreRelease,
      }));
      const releases = firestoreReleasesToFlat(projectId, entries);
      callback(releases, querySnapshot);
    });

    this.unsubscribers.push(unsubscribe);
    return unsubscribe;
  }

  async shareProject(projectId: string, targetEmail: string, role: ProjectRole): Promise<void> {
    return shareProjectFn(this.db, this.uid, projectId, targetEmail, role);
  }

  async removeProjectMember(projectId: string, targetUid: string): Promise<void> {
    return removeProjectMemberFn(this.db, this.uid, projectId, targetUid);
  }

  async getProjectMembers(projectId: string): Promise<{ uid: string; role: ProjectRole; email?: string }[]> {
    return getProjectMembersFn(this.db, projectId);
  }

  async createUserProfile(displayName: string, email: string): Promise<void> {
    return createUserProfileFn(this.db, this.uid, displayName, email);
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
    } catch (error) {
      console.error('Failed to save cloud data:', sanitizeFirebaseError(error));
      if (!this.pendingData) {
        this.pendingData = data;
      }
    }
  }
}
