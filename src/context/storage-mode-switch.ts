// Extracted switch-mode logic for StorageContext.
// Two pure-ish async functions: switchToCloudMode and switchToLocalMode.

import type { Firestore, WriteBatch } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { GanttStorageService } from '../shared/types/storage';
import type { CloudGanttStorageService } from '../shared/storage/firestore-gantt-storage-service';
import { LocalGanttStorageService } from '../shared/storage/local-gantt-storage-service';
import { FirestoreGanttStorageServiceImpl } from '../shared/storage/firestore-gantt-storage-service';
import {
  projectToFirestoreMeta,
  releaseToFirestore,
  appDataToUserSettings,
  snapshotToFirestore,
} from '../shared/utils/firestore-converters';
import { doc, writeBatch } from 'firebase/firestore';

/**
 * Switch to cloud mode: upload local data to Firestore, return new cloud service.
 * Throws on failure (caller handles error state).
 */
export async function switchToCloudMode(
  firestore: Firestore,
  user: User
): Promise<GanttStorageService> {
  // Load current local data
  const localService = new LocalGanttStorageService();
  const localData = await localService.loadAppData();
  const localSnapshots = await localService.loadSnapshots();

  // Create cloud service
  const cloudService = new FirestoreGanttStorageServiceImpl(firestore, user.uid);

  // Create/update user profile
  await cloudService.createUserProfile(
    user.displayName ?? 'Unknown',
    user.email ?? ''
  );

  // Upload data to Firestore in phases.
  // Phase 1: Create project documents + user settings (no subcollections).
  // Subcollection security rules use get() on the parent project doc, so the
  // parent must exist before subcollection writes are evaluated.
  if (localData && localData.projects.length > 0) {
    const projectBatch: WriteBatch = writeBatch(firestore);

    for (const project of localData.projects) {
      const meta = projectToFirestoreMeta(project, user.uid);
      projectBatch.set(doc(firestore, `ganttapp_projects/${project.id}`), meta);
    }

    // Upload user settings (same batch — no subcollection dependency)
    projectBatch.set(
      doc(firestore, `ganttapp_settings/${user.uid}`),
      appDataToUserSettings(localData)
    );

    await projectBatch.commit();

    // Phase 2: Create release documents (subcollections — parent projects now exist)
    const releasesBatch: WriteBatch = writeBatch(firestore);
    let releaseCount = 0;

    for (const project of localData.projects) {
      const projectReleases = localData.releases.filter(r => r.projectId === project.id);
      projectReleases.forEach((release, index) => {
        releasesBatch.set(
          doc(firestore, `ganttapp_projects/${project.id}/releases/${release.id}`),
          releaseToFirestore(release, index)
        );
        releaseCount++;
      });
    }

    if (releaseCount > 0) {
      await releasesBatch.commit();
    }

    // Phase 3: Upload snapshots (subcollections — parent projects now exist)
    if (localSnapshots.length > 0) {
      const snapBatch: WriteBatch = writeBatch(firestore);
      for (const snap of localSnapshots) {
        snapBatch.set(
          doc(firestore, `ganttapp_projects/${snap.projectId}/snapshots/${snap.id}`),
          snapshotToFirestore(snap)
        );
      }
      await snapBatch.commit();
    }
  }

  return cloudService;
}

/**
 * Switch to local mode: download cloud data, flush, dispose, return new local service.
 * Throws on failure (caller handles error state).
 */
export async function switchToLocalMode(
  currentStorage: GanttStorageService
): Promise<GanttStorageService> {
  const currentIsCloud = currentStorage.mode === 'cloud';

  if (currentIsCloud) {
    // Load data from cloud before switching
    const cloudData = await currentStorage.loadAppData();
    const cloudSnapshots = await currentStorage.loadSnapshots();

    // Flush pending writes and dispose cloud service
    const cloudService = currentStorage as CloudGanttStorageService;
    await cloudService.flushPendingWrites();
    cloudService.dispose();

    // Save to local
    const localService = new LocalGanttStorageService();
    if (cloudData) {
      await localService.saveAppData(cloudData);
    }
    if (cloudSnapshots.length > 0) {
      await localService.saveSnapshots(cloudSnapshots);
    }

    return localService;
  }

  return new LocalGanttStorageService();
}
