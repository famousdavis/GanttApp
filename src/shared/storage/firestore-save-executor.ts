// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Firestore save executor — extracted from FirestoreGanttStorageServiceImpl.
// Handles 2-phase batch commits and diff-based saves.

import type { AppData } from '../types/app';
import type { Project, Release } from '../types/models';
import type { FirestoreProjectMeta } from '../types/firestore';
import type { Firestore, WriteBatch } from 'firebase/firestore';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import {
  projectToFirestoreMeta,
  releaseToFirestore,
  appDataToUserSettings,
  appendChangeLogEntry,
} from '../utils/firestore-converters';

/** Compare two releases to detect structural changes. */
export function releaseChanged(prev: Release | undefined, curr: Release): boolean {
  if (!prev) return true;
  return (
    prev.name !== curr.name ||
    prev.startDate !== curr.startDate ||
    prev.earlyFinishDate !== curr.earlyFinishDate ||
    prev.lateFinishDate !== curr.lateFinishDate ||
    prev.hidden !== curr.hidden ||
    prev.status !== curr.status ||
    prev.mostLikelyFinishDate !== curr.mostLikelyFinishDate
  );
}

/** Compare user settings fields between two AppData snapshots. */
export function settingsChanged(prev: AppData | null, curr: AppData): boolean {
  if (!prev) return true;
  return (
    JSON.stringify(prev.chartColors) !== JSON.stringify(curr.chartColors) ||
    prev.activePreset !== curr.activePreset ||
    JSON.stringify(prev.legendLabels) !== JSON.stringify(curr.legendLabels) ||
    prev.showTodayLine !== curr.showTodayLine ||
    // v0.28.0 — without this, changing the status date alone never reaches
    // Firestore (same silent-write-skip class as v12.5 reorder, v15.0 workDays,
    // v16.0 status, v16.1 legendLabels). Regression-tested.
    prev.todayDateOverride !== curr.todayDateOverride ||
    prev.showFinishDateLine !== curr.showFinishDateLine ||
    prev.showMostLikelyLine !== curr.showMostLikelyLine ||
    prev.showMonths !== curr.showMonths ||
    JSON.stringify(prev.chartDisplaySettings) !== JSON.stringify(curr.chartDisplaySettings) ||
    prev.preparedBy !== curr.preparedBy ||
    prev.showPreparedBy !== curr.showPreparedBy ||
    JSON.stringify(prev.exportAttribution) !== JSON.stringify(curr.exportAttribution) ||
    JSON.stringify(prev.globalWorkDays) !== JSON.stringify(curr.globalWorkDays)
  );
}

/**
 * A project a save skipped because this user may only view it (R45, R48),
 * reported so the cloud service can tell the user when the change was theirs
 * (R53).
 */
export interface ViewerSkip {
  projectId: string;
  /** Its name, finish date, work week or legend labels changed. An order shift alone is not a content change. */
  contentChanged: boolean;
  /** The releases the save would have set or deleted under it. */
  releaseIds: string[];
}

/** What phase 2 writes into, and what it compares with. */
interface Phase2 {
  db: Firestore;
  uid: string;
  prev: AppData;
  data: AppData;
  batch: WriteBatch;
  skipped?: ViewerSkip[];
}

function contentChanged(prev: Project, curr: Project): boolean {
  return (
    prev.name !== curr.name ||
    prev.finishDate !== curr.finishDate ||
    JSON.stringify(prev.workDays) !== JSON.stringify(curr.workDays) ||
    JSON.stringify(prev.legendLabels) !== JSON.stringify(curr.legendLabels)
  );
}

/**
 * The release writes a save makes under one project: each release that is
 * new, changed or moved within the project is set (its position is its
 * order), and each removed one deleted.
 */
function releaseWrites(prev: AppData, data: AppData, projectId: string) {
  const prevReleases = prev.releases.filter(r => r.projectId === projectId);
  const currReleases = data.releases.filter(r => r.projectId === projectId);
  const currIds = new Set(currReleases.map(r => r.id));
  const sets = currReleases
    .map((release, index) => ({ release, index, prevIndex: prevReleases.findIndex(r => r.id === release.id) }))
    .filter(({ release, index, prevIndex }) =>
      prevIndex < 0 || prevIndex !== index || releaseChanged(prevReleases[prevIndex], release))
    .map(({ release, index }) => ({ release, index }));
  const deletes = prevReleases.filter(r => !currIds.has(r.id)).map(r => r.id);
  return { sets, deletes };
}

function writeReleases(ctx: Phase2, projectId: string, writes: ReturnType<typeof releaseWrites>): void {
  writes.sets.forEach(({ release, index }) => {
    ctx.batch.set(doc(ctx.db, `ganttapp_projects/${projectId}/releases/${release.id}`), releaseToFirestore(release, index));
  });
  writes.deletes.forEach(id => {
    ctx.batch.delete(doc(ctx.db, `ganttapp_projects/${projectId}/releases/${id}`));
  });
}

/**
 * Phase 2's writes for a project that existed before this save: an update of
 * its document when its content or order changed, then its releases. Under a
 * project this user may only view, none (R45, R48): the rules refuse a
 * viewer's write, and a refused write fails the whole batch and, queued
 * again, every later save. Instead the project is reported as skipped.
 */
async function writeExistingProject(ctx: Phase2, project: Project, projectIndex: number): Promise<void> {
  const prevIndex = ctx.prev.projects.findIndex(p => p.id === project.id);
  const changed = contentChanged(ctx.prev.projects[prevIndex], project);
  const metaChanged = changed || prevIndex !== projectIndex;
  const releases = releaseWrites(ctx.prev, ctx.data, project.id);
  if (!metaChanged && releases.sets.length === 0 && releases.deletes.length === 0) return;

  const projectRef = doc(ctx.db, `ganttapp_projects/${project.id}`);
  // The live document: its members and change log for an update, and this
  // user's role in a project they do not own. An owner may write anything,
  // so a project this user owns is read only for an update. A read the rules
  // refuse (the project deleted, or this user removed) fails the save, as the
  // refused write would.
  const owned = project.owner === ctx.uid;
  const existingSnap = metaChanged || !owned ? await getDoc(projectRef) : null;
  const existingMeta = existingSnap?.exists() ? (existingSnap.data() as FirestoreProjectMeta) : null;
  if (!owned && existingMeta?.members?.[ctx.uid] === 'viewer') {
    ctx.skipped?.push({
      projectId: project.id,
      contentChanged: changed,
      releaseIds: [...releases.sets.map(s => s.release.id), ...releases.deletes],
    });
    return;
  }

  if (metaChanged && existingMeta) {
    // Keep the stored members and change log.
    const updated = projectToFirestoreMeta(project, ctx.uid, existingMeta, projectIndex);
    updated._changeLog = appendChangeLogEntry(updated._changeLog ?? [], {
      timestamp: new Date().toISOString(),
      uid: ctx.uid,
      action: 'update',
      target: `project:${project.id}`,
    });
    ctx.batch.set(projectRef, updated);
  }
  writeReleases(ctx, project.id, releases);
}

/**
 * Execute a diff-based save to Firestore using 2-phase batch commits.
 *
 * Phase 1: Create new project documents (must exist before subcollection writes,
 *          because subcollection security rules use get() on the parent).
 * Phase 2: All other operations (updates, releases, deletions, settings).
 *
 * `lastSavedState` is what the cloud held at the last load or save. It is
 * required: against nothing, every project would be written as new (a full
 * set() with only this user as a member) and every setting overwritten.
 *
 * Nothing is written under a project this user may only view; each such
 * project with a change is pushed onto `skipped`, when given. A project
 * delete is never skipped.
 *
 * Returns a deep clone of `data` suitable for caching as lastSavedState: the
 * skipped values are recorded as saved, so no later save retries them.
 */
export async function executeFirestoreSave(
  db: Firestore,
  uid: string,
  data: AppData,
  lastSavedState: AppData,
  skipped?: ViewerSkip[]
): Promise<AppData> {
  const prev = lastSavedState;

  // Determine what changed
  const prevProjectIdList = prev.projects.map(p => p.id);
  const currProjectIdSet = new Set(data.projects.map(p => p.id));

  // Identify new projects — these must be committed first
  const newProjectIds = new Set<string>();

  // Phase 1: Commit new project documents so they exist for subcollection rules.
  const newProjectBatch = writeBatch(db);
  let hasNewProjects = false;

  data.projects.forEach((project, projectIndex) => {
    if (!prevProjectIdList.includes(project.id)) {
      newProjectIds.add(project.id);
      hasNewProjects = true;
      const projectRef = doc(db, `ganttapp_projects/${project.id}`);
      const meta = projectToFirestoreMeta(project, uid, undefined, projectIndex);
      meta._changeLog = appendChangeLogEntry([], {
        timestamp: new Date().toISOString(),
        uid,
        action: 'create',
        target: `project:${project.id}`,
      });
      newProjectBatch.set(projectRef, meta);
    }
  });

  if (hasNewProjects) {
    await newProjectBatch.commit();
  }

  // Phase 2: All other operations (updates, releases, deletions, settings).
  const ctx: Phase2 = { db, uid, prev, data, batch: writeBatch(db), skipped };

  for (let projectIndex = 0; projectIndex < data.projects.length; projectIndex++) {
    const project = data.projects[projectIndex];
    if (newProjectIds.has(project.id)) {
      // Created in phase 1 by this user, its owner: only its releases are left.
      writeReleases(ctx, project.id, releaseWrites(prev, data, project.id));
    } else {
      await writeExistingProject(ctx, project, projectIndex);
    }
  }

  // Handle project deletions
  prevProjectIdList.forEach(prevId => {
    if (!currProjectIdSet.has(prevId)) {
      ctx.batch.delete(doc(db, `ganttapp_projects/${prevId}`));
      // Note: subcollections (releases, snapshots) are not auto-deleted by Firestore
      // They become orphaned but harmless; a cleanup function can handle this later
    }
  });

  // Save user settings if changed
  if (settingsChanged(prev, data)) {
    const settingsRef = doc(db, `ganttapp_settings/${uid}`);
    ctx.batch.set(settingsRef, appDataToUserSettings(data));
  }

  await ctx.batch.commit();
  return structuredClone(data);
}
