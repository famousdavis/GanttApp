// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Firestore save executor — extracted from FirestoreGanttStorageServiceImpl.
// Handles 2-phase batch commits and diff-based saves.

import type { AppData } from '../types/app';
import type { Release } from '../types/models';
import type { FirestoreProjectMeta } from '../types/firestore';
import type { Firestore } from 'firebase/firestore';
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
    prev.completed !== curr.completed ||
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
    prev.showFinishDateLine !== curr.showFinishDateLine ||
    prev.showMostLikelyLine !== curr.showMostLikelyLine ||
    prev.showMonths !== curr.showMonths ||
    JSON.stringify(prev.chartDisplaySettings) !== JSON.stringify(curr.chartDisplaySettings) ||
    prev.preparedBy !== curr.preparedBy ||
    prev.showPreparedBy !== curr.showPreparedBy ||
    JSON.stringify(prev.exportAttribution) !== JSON.stringify(curr.exportAttribution)
  );
}

/**
 * Execute a diff-based save to Firestore using 2-phase batch commits.
 *
 * Phase 1: Create new project documents (must exist before subcollection writes,
 *          because subcollection security rules use get() on the parent).
 * Phase 2: All other operations (updates, releases, deletions, settings).
 *
 * Returns a deep clone of `data` suitable for caching as lastSavedState.
 */
export async function executeFirestoreSave(
  db: Firestore,
  uid: string,
  data: AppData,
  lastSavedState: AppData | null
): Promise<AppData> {
  const prev = lastSavedState;

  // Determine what changed
  const prevProjectIdList = prev?.projects.map(p => p.id) ?? [];
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
  const batch = writeBatch(db);

  for (let projectIndex = 0; projectIndex < data.projects.length; projectIndex++) {
    const project = data.projects[projectIndex];
    const projectRef = doc(db, `ganttapp_projects/${project.id}`);

    if (!newProjectIds.has(project.id)) {
      // Existing project — check if name/finishDate/order changed
      const prevProject = prev?.projects.find(p => p.id === project.id);
      const prevProjectIndex = prev?.projects.findIndex(p => p.id === project.id) ?? -1;
      const contentChanged = prevProject && (prevProject.name !== project.name || prevProject.finishDate !== project.finishDate);
      const orderChanged = prevProjectIndex !== projectIndex;

      if (contentChanged || orderChanged) {
        // Load existing meta to preserve members/changelog
        const existingSnap = await getDoc(projectRef);
        if (existingSnap.exists()) {
          const existingMeta = existingSnap.data() as FirestoreProjectMeta;
          const updated = projectToFirestoreMeta(project, uid, existingMeta, projectIndex);
          updated._changeLog = appendChangeLogEntry(updated._changeLog ?? [], {
            timestamp: new Date().toISOString(),
            uid,
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

    // Add or update releases (includes order change detection)
    currReleases.forEach((release, index) => {
      const releaseRef = doc(db, `ganttapp_projects/${project.id}/releases/${release.id}`);
      const prevRelease = prevReleases.find(r => r.id === release.id);
      const prevIndex = prevReleases.findIndex(r => r.id === release.id);

      if (!prevReleaseIdList.includes(release.id) || releaseChanged(prevRelease, release) || prevIndex !== index) {
        batch.set(releaseRef, releaseToFirestore(release, index));
      }
    });

    // Delete removed releases
    prevReleases.forEach(prevRelease => {
      if (!currReleaseIdSet.has(prevRelease.id)) {
        batch.delete(doc(db, `ganttapp_projects/${project.id}/releases/${prevRelease.id}`));
      }
    });
  }

  // Handle project deletions
  prevProjectIdList.forEach(prevId => {
    if (!currProjectIdSet.has(prevId)) {
      batch.delete(doc(db, `ganttapp_projects/${prevId}`));
      // Note: subcollections (releases, snapshots) are not auto-deleted by Firestore
      // They become orphaned but harmless; a cleanup function can handle this later
    }
  });

  // Save user settings if changed
  if (settingsChanged(prev, data)) {
    const settingsRef = doc(db, `ganttapp_settings/${uid}`);
    batch.set(settingsRef, appDataToUserSettings(data));
  }

  await batch.commit();
  return structuredClone(data);
}
