// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Extracted switch-mode logic for StorageContext.
// switchToCloudMode: one-way upload with existence-based dedup (v12.0).
// switchToLocalMode removed in v12.0 — cloud is the source of truth.

import type { Firestore, WriteBatch } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { GanttStorageService } from '../shared/types/storage';
import { LocalGanttStorageService } from '../shared/storage/local-gantt-storage-service';
import { FirestoreGanttStorageServiceImpl } from '../shared/storage/firestore-gantt-storage-service';
import {
  projectToFirestoreMeta,
  releaseToFirestore,
  appDataToUserSettings,
  snapshotToFirestore,
} from '../shared/utils/firestore-converters';
import { sanitizeString } from '../shared/utils/validation';
import { doc, getDoc, writeBatch } from 'firebase/firestore';

export interface SwitchToCloudResult {
  service: GanttStorageService;
  uploaded: number;
  skipped: number;
}

/**
 * Switch to cloud mode: upload local data to Firestore with existence-based dedup.
 * - If a project already exists in cloud and user is a member → skip (no duplicate)
 * - If a project ID collides with someone else's → generate new ID
 * - If permission-denied (doc doesn't exist or user not member) → generate new ID
 * - Network/transient errors → throw (don't silently create duplicates)
 *
 * Returns { service, uploaded, skipped } so the caller can show results and trigger cleanup.
 * Throws on failure (caller handles error state).
 */
export async function switchToCloudMode(
  firestore: Firestore,
  user: User
): Promise<SwitchToCloudResult> {
  // Load current local data
  const localService = new LocalGanttStorageService();
  const localData = await localService.loadAppData();
  const localSnapshots = await localService.loadSnapshots();

  // Create cloud service
  const cloudService = new FirestoreGanttStorageServiceImpl(firestore, user.uid);

  // Create/update user profile (sanitize defense-in-depth, v12.2)
  await cloudService.createUserProfile(
    sanitizeString(user.displayName ?? 'Unknown'),
    sanitizeString(user.email ?? '')
  );

  let uploaded = 0;
  let skipped = 0;

  // Upload data to Firestore with existence-based dedup.
  if (localData && localData.projects.length > 0) {
    // Dedup check: for each project, check if it already exists in cloud.
    const projectsToUpload: Array<{ project: typeof localData.projects[0]; targetId: string }> = [];

    for (const project of localData.projects) {
      let targetId = project.id;

      try {
        const existing = await getDoc(doc(firestore, `ganttapp_projects/${targetId}`));
        if (existing.exists()) {
          const data = existing.data();
          if (data.members && data.members[user.uid]) {
            // User already has this project in cloud — skip
            skipped++;
            continue;
          }
          // Belongs to someone else — generate new ID
          targetId = crypto.randomUUID();
        }
      } catch (collisionErr: unknown) {
        // Distinguish permission-denied (expected) from transient errors
        const code = (collisionErr as { code?: string })?.code;
        if (code === 'permission-denied') {
          // Doc exists but user isn't a member, OR doc doesn't exist and
          // resource.data is null causing the security rule to fail (§21.13).
          // Either way, generate a new ID to avoid collision.
          targetId = crypto.randomUUID();
        } else {
          // Network error, unavailable, deadline-exceeded, etc.
          // Surface to user — don't silently create duplicates.
          throw new Error(
            `Failed to check project "${sanitizeString(project.name)}": ${collisionErr instanceof Error ? collisionErr.message : 'unknown error'}`
          );
        }
      }

      projectsToUpload.push({ project, targetId });
    }

    // Phase 1: Create project documents + user settings (no subcollections).
    // Subcollection security rules use get() on the parent project doc, so the
    // parent must exist before subcollection writes are evaluated.
    if (projectsToUpload.length > 0) {
      const projectBatch: WriteBatch = writeBatch(firestore);

      projectsToUpload.forEach(({ project, targetId }, index) => {
        const meta = projectToFirestoreMeta({ ...project, id: targetId }, user.uid, undefined, index);
        projectBatch.set(doc(firestore, `ganttapp_projects/${targetId}`), meta);
      });

      // Upload user settings (same batch — no subcollection dependency)
      projectBatch.set(
        doc(firestore, `ganttapp_settings/${user.uid}`),
        appDataToUserSettings(localData)
      );

      await projectBatch.commit();

      // Phase 2: Create release documents (subcollections — parent projects now exist)
      const releasesBatch: WriteBatch = writeBatch(firestore);
      let releaseCount = 0;

      for (const { project, targetId } of projectsToUpload) {
        const projectReleases = localData.releases.filter(r => r.projectId === project.id);
        projectReleases.forEach((release, index) => {
          releasesBatch.set(
            doc(firestore, `ganttapp_projects/${targetId}/releases/${release.id}`),
            releaseToFirestore({ ...release, projectId: targetId }, index)
          );
          releaseCount++;
        });
      }

      if (releaseCount > 0) {
        await releasesBatch.commit();
      }

      // Phase 3: Upload snapshots (subcollections — parent projects now exist)
      const snapshotsToUpload = localSnapshots.filter(snap =>
        projectsToUpload.some(p => p.project.id === snap.projectId)
      );
      if (snapshotsToUpload.length > 0) {
        const snapBatch: WriteBatch = writeBatch(firestore);
        for (const snap of snapshotsToUpload) {
          // Remap projectId if the project was given a new ID
          const mapping = projectsToUpload.find(p => p.project.id === snap.projectId);
          const remappedProjectId = mapping ? mapping.targetId : snap.projectId;
          snapBatch.set(
            doc(firestore, `ganttapp_projects/${remappedProjectId}/snapshots/${snap.id}`),
            snapshotToFirestore({ ...snap, projectId: remappedProjectId })
          );
        }
        await snapBatch.commit();
      }

      uploaded = projectsToUpload.length;
    } else if (skipped > 0) {
      // All projects were skipped (already in cloud), but still upload settings
      const settingsBatch: WriteBatch = writeBatch(firestore);
      settingsBatch.set(
        doc(firestore, `ganttapp_settings/${user.uid}`),
        appDataToUserSettings(localData)
      );
      await settingsBatch.commit();
    }
  }

  return { service: cloudService, uploaded, skipped };
}
