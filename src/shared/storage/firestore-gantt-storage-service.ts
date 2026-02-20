// FirestoreGanttStorageService — cloud mode implementation of GanttStorageService
// Manages Firestore documents for projects, releases, snapshots, user profile, and settings.
// Includes write debouncing, in-memory diff cache, beforeunload safety, and real-time subscriptions.

import type { GanttStorageService, StorageMode } from '../types/storage';
import type { AppData } from '../types/app';
import type { Snapshot } from '../types/snapshots';
import type { Release } from '../types/models';
import type {
  FirestoreProjectMeta,
  FirestoreRelease,
  FirestoreUserSettings,
  ProjectRole,
  ChangeLogEntry,
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
  projectToFirestoreMeta,
  releaseToFirestore,
  appDataToUserSettings,
  snapshotToFirestore,
  firestoreToProject,
  firestoreReleasesToFlat,
  userSettingsToAppData,
  firestoreSnapshotToFlat,
  appendChangeLogEntry,
} from '../utils/firestore-converters';

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
        // Best effort — synchronous flush via sendBeacon not available for Firestore
        // flushPendingWrites is async but beforeunload can't wait
        this.flushPendingWritesSync();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.beforeUnloadHandler);
    }
  }

  // --- GanttStorageService interface ---

  async loadAppData(): Promise<AppData | null> {
    try {
      // Load all projects where this user is a member
      const projectsSnap = await getDocs(collection(this.db, 'ganttapp/projects'));
      const projects: { id: string; meta: FirestoreProjectMeta }[] = [];

      for (const docSnap of projectsSnap.docs) {
        const data = docSnap.data() as FirestoreProjectMeta;
        if (data.members && data.members[this.uid]) {
          projects.push({ id: docSnap.id, meta: data });
        }
      }

      // Load releases for each project
      const releasesMap = new Map<string, { id: string; data: FirestoreRelease }[]>();
      for (const project of projects) {
        const releasesSnap = await getDocs(
          collection(this.db, `ganttapp/projects/${project.id}/releases`)
        );
        releasesMap.set(
          project.id,
          releasesSnap.docs.map(d => ({ id: d.id, data: d.data() as FirestoreRelease }))
        );
      }

      // Load user settings
      const settingsDoc = await getDoc(doc(this.db, `ganttapp/users/${this.uid}/settings`));
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
      console.error('Failed to load cloud data:', error);
      return null;
    }
  }

  async saveAppData(data: AppData): Promise<void> {
    if (this.disposed) return;
    this.pendingData = data;

    // Debounce writes
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

      // Query all project docs this user has access to
      const projectsSnap = await getDocs(collection(this.db, 'ganttapp/projects'));
      for (const projectDoc of projectsSnap.docs) {
        const data = projectDoc.data() as FirestoreProjectMeta;
        if (!data.members || !data.members[this.uid]) continue;

        const snapshotsSnap = await getDocs(
          collection(this.db, `ganttapp/projects/${projectDoc.id}/snapshots`)
        );
        for (const snapDoc of snapshotsSnap.docs) {
          allSnapshots.push(
            firestoreSnapshotToFlat(snapDoc.id, projectDoc.id, snapDoc.data() as any)
          );
        }
      }

      return allSnapshots;
    } catch (error) {
      console.error('Failed to load cloud snapshots:', error);
      return [];
    }
  }

  async saveSnapshots(snapshots: Snapshot[]): Promise<void> {
    // Group by project and write each group
    const byProject = new Map<string, Snapshot[]>();
    for (const snap of snapshots) {
      const group = byProject.get(snap.projectId) ?? [];
      group.push(snap);
      byProject.set(snap.projectId, group);
    }

    const batch = writeBatch(this.db);

    // Delete all existing snapshots first, then rewrite
    const projectsSnap = await getDocs(collection(this.db, 'ganttapp/projects'));
    for (const projectDoc of projectsSnap.docs) {
      const data = projectDoc.data() as FirestoreProjectMeta;
      if (!data.members || !data.members[this.uid]) continue;

      const existingSnaps = await getDocs(
        collection(this.db, `ganttapp/projects/${projectDoc.id}/snapshots`)
      );
      for (const existing of existingSnaps.docs) {
        batch.delete(existing.ref);
      }
    }

    // Write new snapshots
    byProject.forEach((projectSnapshots, projectId) => {
      for (const snap of projectSnapshots) {
        const ref = doc(this.db, `ganttapp/projects/${projectId}/snapshots/${snap.id}`);
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

    const ref = doc(this.db, `ganttapp/projects/${snapshot.projectId}/snapshots/${snapshot.id}`);
    await setDoc(ref, snapshotToFirestore(snapshot));

    all.push(snapshot);
    return all;
  }

  async deleteSnapshot(snapshotId: string): Promise<Snapshot[]> {
    const all = await this.loadSnapshots();
    const toDelete = all.find(s => s.id === snapshotId);
    if (toDelete) {
      await deleteDoc(
        doc(this.db, `ganttapp/projects/${toDelete.projectId}/snapshots/${snapshotId}`)
      );
    }
    return all.filter(s => s.id !== snapshotId);
  }

  async deleteSnapshotsForProject(projectId: string): Promise<Snapshot[]> {
    const all = await this.loadSnapshots();
    const toDelete = all.filter(s => s.projectId === projectId);
    const batch = writeBatch(this.db);
    for (const snap of toDelete) {
      batch.delete(doc(this.db, `ganttapp/projects/${projectId}/snapshots/${snap.id}`));
    }
    await batch.commit();
    return all.filter(s => s.projectId !== projectId);
  }

  // --- Cloud-specific methods ---

  subscribeToProject(
    projectId: string,
    callback: (releases: Release[], snapshot: QuerySnapshot) => void
  ): () => void {
    const releasesRef = collection(this.db, `ganttapp/projects/${projectId}/releases`);
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
    // Look up user by email
    const usersSnap = await getDocs(collection(this.db, 'ganttapp/users'));
    let targetUid: string | null = null;

    for (const userDoc of usersSnap.docs) {
      const profile = userDoc.data();
      if (profile.email === targetEmail) {
        targetUid = userDoc.id;
        break;
      }
    }

    if (!targetUid) {
      throw new Error(`User with email "${targetEmail}" not found. They must sign in at least once first.`);
    }

    // Update project members
    const projectRef = doc(this.db, `ganttapp/projects/${projectId}`);
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) throw new Error('Project not found');

    const meta = projectSnap.data() as FirestoreProjectMeta;
    meta.members[targetUid] = role;
    meta.updatedAt = new Date().toISOString();
    meta._changeLog = appendChangeLogEntry(meta._changeLog ?? [], {
      timestamp: new Date().toISOString(),
      uid: this.uid,
      action: 'update',
      target: `member:${targetUid}:${role}`,
    });

    await setDoc(projectRef, meta);
  }

  async removeProjectMember(projectId: string, targetUid: string): Promise<void> {
    const projectRef = doc(this.db, `ganttapp/projects/${projectId}`);
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) throw new Error('Project not found');

    const meta = projectSnap.data() as FirestoreProjectMeta;
    if (meta.owner === targetUid) {
      throw new Error('Cannot remove the project owner');
    }

    delete meta.members[targetUid];
    meta.updatedAt = new Date().toISOString();
    meta._changeLog = appendChangeLogEntry(meta._changeLog ?? [], {
      timestamp: new Date().toISOString(),
      uid: this.uid,
      action: 'delete',
      target: `member:${targetUid}`,
    });

    await setDoc(projectRef, meta);
  }

  async getProjectMembers(
    projectId: string
  ): Promise<{ uid: string; role: ProjectRole; email?: string }[]> {
    const projectRef = doc(this.db, `ganttapp/projects/${projectId}`);
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) return [];

    const meta = projectSnap.data() as FirestoreProjectMeta;
    const members: { uid: string; role: ProjectRole; email?: string }[] = [];

    for (const [uid, role] of Object.entries(meta.members)) {
      // Try to load user profile for email
      const profileDoc = await getDoc(doc(this.db, `ganttapp/users/${uid}/profile`));
      const email = profileDoc.exists() ? (profileDoc.data() as any).email : undefined;
      members.push({ uid, role, email });
    }

    return members;
  }

  async createUserProfile(displayName: string, email: string): Promise<void> {
    const profileRef = doc(this.db, `ganttapp/users/${this.uid}/profile`);
    const existing = await getDoc(profileRef);
    const now = new Date().toISOString();

    if (existing.exists()) {
      // Update lastLogin
      await setDoc(profileRef, { ...existing.data(), lastLogin: now, displayName, email }, { merge: true });
    } else {
      await setDoc(profileRef, { displayName, email, createdAt: now, lastLogin: now });
    }
  }

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

    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Unsubscribe all listeners
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];

    // Remove beforeunload handler
    if (this.beforeUnloadHandler && typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }

    // Invalidate cache
    this.lastSavedState = null;
    this.pendingData = null;
  }

  // --- Private helpers ---

  private async executeSave(): Promise<void> {
    const data = this.pendingData;
    if (!data || this.disposed) return;
    this.pendingData = null;

    try {
      const batch = writeBatch(this.db);
      const prev = this.lastSavedState;

      // Determine what changed
      const prevProjectIdList = prev?.projects.map(p => p.id) ?? [];
      const currProjectIdSet = new Set(data.projects.map(p => p.id));

      // Handle project additions and updates
      for (const project of data.projects) {
        const projectRef = doc(this.db, `ganttapp/projects/${project.id}`);

        if (!prevProjectIdList.includes(project.id)) {
          // New project
          const meta = projectToFirestoreMeta(project, this.uid);
          meta._changeLog = appendChangeLogEntry([], {
            timestamp: new Date().toISOString(),
            uid: this.uid,
            action: 'create',
            target: `project:${project.id}`,
          });
          batch.set(projectRef, meta);
        } else {
          // Existing project — check if name/finishDate changed
          const prevProject = prev?.projects.find(p => p.id === project.id);
          if (prevProject && (prevProject.name !== project.name || prevProject.finishDate !== project.finishDate)) {
            // Load existing meta to preserve members/changelog
            const existingSnap = await getDoc(projectRef);
            if (existingSnap.exists()) {
              const existingMeta = existingSnap.data() as FirestoreProjectMeta;
              const updated = projectToFirestoreMeta(project, this.uid, existingMeta);
              updated._changeLog = appendChangeLogEntry(updated._changeLog ?? [], {
                timestamp: new Date().toISOString(),
                uid: this.uid,
                action: 'update',
                target: `project:${project.id}`,
              });
              batch.set(projectRef, updated);
            }
          }
        }

        // Handle releases for this project
        const prevReleases = prev?.releases.filter(r => r.projectId === project.id) ?? [];
        const currReleases = data.releases.filter(r => r.projectId === project.id);
        const prevReleaseIdList = prevReleases.map(r => r.id);
        const currReleaseIdSet = new Set(currReleases.map(r => r.id));

        // Add or update releases
        currReleases.forEach((release, index) => {
          const releaseRef = doc(this.db, `ganttapp/projects/${project.id}/releases/${release.id}`);
          const prevRelease = prevReleases.find(r => r.id === release.id);

          if (!prevReleaseIdList.includes(release.id) || this.releaseChanged(prevRelease, release)) {
            batch.set(releaseRef, releaseToFirestore(release, index));
          }
        });

        // Delete removed releases
        prevReleases.forEach(prevRelease => {
          if (!currReleaseIdSet.has(prevRelease.id)) {
            batch.delete(doc(this.db, `ganttapp/projects/${project.id}/releases/${prevRelease.id}`));
          }
        });
      }

      // Handle project deletions
      prevProjectIdList.forEach(prevId => {
        if (!currProjectIdSet.has(prevId)) {
          batch.delete(doc(this.db, `ganttapp/projects/${prevId}`));
          // Note: subcollections (releases, snapshots) are not auto-deleted by Firestore
          // They become orphaned but harmless; a cleanup function can handle this later
        }
      });

      // Save user settings if changed
      if (this.settingsChanged(prev, data)) {
        const settingsRef = doc(this.db, `ganttapp/users/${this.uid}/settings`);
        batch.set(settingsRef, appDataToUserSettings(data));
      }

      await batch.commit();
      this.lastSavedState = structuredClone(data);
    } catch (error) {
      console.error('Failed to save cloud data:', error);
      // Re-queue for retry
      if (!this.pendingData) {
        this.pendingData = data;
      }
    }
  }

  /** Synchronous best-effort flush for beforeunload — cannot await. */
  private flushPendingWritesSync(): void {
    // Fire and forget — the browser may or may not complete this
    if (this.pendingData) {
      this.executeSave().catch(() => {});
    }
  }

  private releaseChanged(prev: Release | undefined, curr: Release): boolean {
    if (!prev) return true;
    return (
      prev.name !== curr.name ||
      prev.startDate !== curr.startDate ||
      prev.earlyFinishDate !== curr.earlyFinishDate ||
      prev.lateFinishDate !== curr.lateFinishDate ||
      prev.hidden !== curr.hidden ||
      prev.completed !== curr.completed ||
      prev.mostLikelyFinishDate !== curr.mostLikelyFinishDate
    );
  }

  private settingsChanged(prev: AppData | null, curr: AppData): boolean {
    if (!prev) return true;
    return (
      JSON.stringify(prev.chartColors) !== JSON.stringify(curr.chartColors) ||
      prev.activePreset !== curr.activePreset ||
      JSON.stringify(prev.legendLabels) !== JSON.stringify(curr.legendLabels) ||
      prev.showTodayLine !== curr.showTodayLine ||
      prev.showFinishDateLine !== curr.showFinishDateLine ||
      prev.showMostLikelyLine !== curr.showMostLikelyLine ||
      JSON.stringify(prev.chartDisplaySettings) !== JSON.stringify(curr.chartDisplaySettings) ||
      prev.preparedBy !== curr.preparedBy ||
      prev.showPreparedBy !== curr.showPreparedBy
    );
  }
}
