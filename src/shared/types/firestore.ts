// Firestore document schemas for cloud storage mode

export type ProjectRole = 'owner' | 'editor' | 'viewer';

export interface ChangeLogEntry {
  timestamp: string;                    // ISO 8601
  uid: string;                          // Firebase uid of the actor
  action: 'create' | 'update' | 'delete' | 'import' | 'cloud-migration' | 'local-migration';
  target: string;                       // e.g., "release:r1", "project:p1" (enhancement over ARCHITECTURE.md §9.1)
}

export interface FirestoreProjectMeta {
  name: string;
  owner: string;                        // Firebase uid
  members: Record<string, ProjectRole>; // { uid: 'owner' | 'editor' | 'viewer' }
  finishDate?: string | null;           // YYYY-MM-DD or null if not set
  schemaVersion: number;                // starts at 1
  _originRef?: string;                  // e.g., "uid:abc123"
  _changeLog?: ChangeLogEntry[];        // capped at 50 entries per project (oldest trimmed on overflow)
  createdAt: string;                    // ISO 8601
  updatedAt: string;                    // ISO 8601
}

export interface FirestoreRelease {
  name: string;
  startDate: string;
  earlyFinishDate: string;
  lateFinishDate: string;
  hidden?: boolean;
  completed?: boolean;
  mostLikelyFinishDate?: string;
  order: number;                        // explicit ordering (0-based)
}

export interface FirestoreSnapshot {
  name: string;
  timestamp: string;
  releases: FirestoreRelease[];         // embedded (same as local snapshots)
  projectFinishDate?: string;
  chartColors?: {
    solidBar: string;
    hatchedBar: string;
    todayLine: string;
    finishDateLine: string;
    mostLikelyLine: string;
    completedBar: string;
  };
  legendLabels?: {
    solidBar: string;
    hatchedBar: string;
    finishDateLine?: string;
    mostLikelyLine?: string;
  };
  preparedBy?: string;
}

export interface FirestoreUserProfile {
  displayName: string;
  email: string;
  createdAt: string;                    // ISO 8601
  lastLogin: string;                    // ISO 8601
}

export interface FirestoreUserSettings {
  chartColors?: {
    solidBar: string;
    hatchedBar: string;
    todayLine: string;
    finishDateLine: string;
    mostLikelyLine: string;
    completedBar: string;
  };
  activePreset?: string;
  legendLabels?: {
    solidBar: string;
    hatchedBar: string;
    finishDateLine?: string;
    mostLikelyLine?: string;
  };
  showTodayLine?: boolean;
  showFinishDateLine?: boolean;
  showMostLikelyLine?: boolean;
  chartDisplaySettings?: {
    releaseNameFontSize: string;
    dateLabelFontSize: string;
    dateLabelColor: string;
    verticalLineWidth: string;
    barHeight: string;
    rowSpacing: string;
  };
  preparedBy?: string;
  showPreparedBy?: boolean;
}

export interface ExportAttribution {
  name: string;
  identifier: string;
}

/** Maximum number of changelog entries per project document. */
export const MAX_CHANGELOG_ENTRIES = 50;
