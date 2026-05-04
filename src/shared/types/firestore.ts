// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Firestore document schemas for cloud storage mode

import type { ProjectLegendLabels } from './models';

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
  order?: number;                       // Display order (0-based), added v12.5
  workDays?: number[];                  // Optional per-project work-week override (v15.0), array of 0..6
  legendLabels?: ProjectLegendLabels;   // Optional per-project legend label overrides (v16.1)
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
  status?: 'not-started' | 'in-progress' | 'complete';
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
    inProgressBar: string;
  };
  legendLabels?: {
    solidBar?: string;
    hatchedBar?: string;
    finishDateLine?: string;
    mostLikelyLine?: string;
    inProgress?: string;
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
    inProgressBar: string;
  };
  activePreset?: string;
  legendLabels?: {
    solidBar?: string;
    hatchedBar?: string;
    finishDateLine?: string;
    mostLikelyLine?: string;
    inProgress?: string;
  };
  showTodayLine?: boolean;
  showFinishDateLine?: boolean;
  showMostLikelyLine?: boolean;
  showMonths?: boolean;
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
  exportAttribution?: { name: string; identifier: string };
  globalWorkDays?: number[];            // Optional global work-week setting (v15.0), array of 0..6
}

export interface ExportAttribution {
  name: string;
  identifier: string;
}

/** Maximum number of changelog entries per project document. */
export const MAX_CHANGELOG_ENTRIES = 50;

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

/**
 * Client-side shape of a spertsuite_invitations document.
 * Timestamps are coerced to milliseconds (number) on read.
 * isVoting included for type correctness — field present in every doc.
 * Never render isVoting in UI; GanttApp has no voting model.
 */
export interface PendingInvite {
  tokenId: string;
  appId: string;
  modelId: string;
  modelName: string;
  inviteeEmail: string;
  role: 'editor' | 'viewer';
  isVoting: boolean;
  inviterUid: string;
  inviterName: string;
  inviterEmail: string;
  status: InvitationStatus;
  createdAt: number;        // millis
  expiresAt: number;        // millis
  acceptedAt?: number;
  acceptedByUid?: string;
  lastEmailSentAt: number;  // millis
  emailSendCount: number;
  updatedAt: number;        // millis
}
