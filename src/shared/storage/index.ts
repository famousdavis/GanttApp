// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Barrel exports for storage abstraction layer

export { LocalStorageDriver } from './local-storage-driver';
export { LocalGanttStorageService, clearLocalProjectData } from './local-gantt-storage-service';
export { FirestoreGanttStorageServiceImpl } from './firestore-gantt-storage-service';
export type { CloudGanttStorageService } from './firestore-gantt-storage-service';
export { executeFirestoreSave, releaseChanged, settingsChanged } from './firestore-save-executor';
export { removeCollaborator, getProjectMembers, listPendingInvites } from './firestore-sharing';
