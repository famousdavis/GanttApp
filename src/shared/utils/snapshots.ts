// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Snapshot storage utilities for GanttApp

import { Snapshot } from '../types/snapshots';
import { sanitizeString, sanitizeId, isValidDateFormat, sanitizeChartColors, sanitizeRelease, sanitizeLegendLabels } from './validation';

/**
 * Validate and sanitize a single snapshot
 */
export function validateSnapshot(data: unknown): Snapshot | null {
  if (!data || typeof data !== 'object') return null;

  const s = data as Record<string, unknown>;

  // Validate required string fields
  if (
    typeof s.id !== 'string' ||
    typeof s.projectId !== 'string' ||
    typeof s.timestamp !== 'string' ||
    typeof s.name !== 'string'
  ) {
    return null;
  }

  // Validate timestamp is a parseable date
  const timestampDate = new Date(s.timestamp);
  if (isNaN(timestampDate.getTime())) {
    return null;
  }

  // Validate releases array
  if (!Array.isArray(s.releases)) {
    return null;
  }

  // Sanitize and validate each release
  const validReleases = [];
  for (const r of s.releases) {
    const sanitized = sanitizeRelease(r);
    if (sanitized) {
      validReleases.push(sanitized);
    }
  }

  // Build validated snapshot
  const snapshot: Snapshot = {
    id: sanitizeId(s.id),
    projectId: sanitizeId(s.projectId),
    timestamp: s.timestamp,
    name: sanitizeString(s.name, 100),
    releases: validReleases
  };

  // Reject if sanitized ID, projectId, or name is empty
  if (!snapshot.id || !snapshot.projectId || !snapshot.name) {
    return null;
  }

  // Validate optional project finish date
  if (typeof s.projectFinishDate === 'string' && isValidDateFormat(s.projectFinishDate)) {
    snapshot.projectFinishDate = s.projectFinishDate;
  }

  // Validate optional chart colors
  if (s.chartColors && typeof s.chartColors === 'object') {
    snapshot.chartColors = sanitizeChartColors(s.chartColors);
  }

  // Validate optional legend labels
  if (s.legendLabels && typeof s.legendLabels === 'object') {
    snapshot.legendLabels = sanitizeLegendLabels(s.legendLabels);
  }

  // Validate optional preparedBy
  if (typeof s.preparedBy === 'string') {
    snapshot.preparedBy = sanitizeString(s.preparedBy, 100);
  }

  // Validate optional frozen status-date override (v0.28.0)
  if (typeof s.todayDateOverride === 'string' && isValidDateFormat(s.todayDateOverride)) {
    snapshot.todayDateOverride = s.todayDateOverride;
  }

  return snapshot;
}

/**
 * Get snapshots for a specific project, sorted by timestamp descending (newest first)
 */
export function getSnapshotsForProject(snapshots: Snapshot[], projectId: string): Snapshot[] {
  return snapshots
    .filter(s => s.projectId === projectId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
