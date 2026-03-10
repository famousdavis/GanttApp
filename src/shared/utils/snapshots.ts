// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Snapshot storage utilities for GanttApp

import { Snapshot } from '../types/snapshots';
import { sanitizeString, sanitizeId, isValidDateFormat, sanitizeChartColors, sanitizeRelease, sanitizeLegendLabels } from './validation';

const SNAPSHOTS_KEY = 'ganttAppSnapshots';
const MAX_SNAPSHOTS_TOTAL = 100;
const MAX_SNAPSHOTS_PER_PROJECT = 50;

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

  return snapshot;
}

/**
 * Load all snapshots from localStorage
 */
export function loadSnapshots(): Snapshot[] {
  try {
    const saved = localStorage.getItem(SNAPSHOTS_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    const validated: Snapshot[] = [];
    for (const item of parsed) {
      const snapshot = validateSnapshot(item);
      if (snapshot) {
        validated.push(snapshot);
      }
    }
    return validated;
  } catch (error) {
    console.error('Error loading snapshots from localStorage:', error);
    return [];
  }
}

/**
 * Save all snapshots to localStorage
 */
export function saveSnapshots(snapshots: Snapshot[]): void {
  try {
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
  } catch (error) {
    console.error('Error saving snapshots to localStorage:', error);
  }
}

/**
 * Add a new snapshot. Returns updated snapshot list, or null if limit exceeded.
 */
export function addSnapshot(snapshot: Snapshot): Snapshot[] | null {
  const all = loadSnapshots();

  // Check total limit
  if (all.length >= MAX_SNAPSHOTS_TOTAL) {
    return null;
  }

  // Check per-project limit
  const projectCount = all.filter(s => s.projectId === snapshot.projectId).length;
  if (projectCount >= MAX_SNAPSHOTS_PER_PROJECT) {
    return null;
  }

  all.push(snapshot);
  saveSnapshots(all);
  return all;
}

/**
 * Delete a snapshot by ID. Returns updated snapshot list.
 */
export function deleteSnapshot(snapshotId: string): Snapshot[] {
  const all = loadSnapshots();
  const filtered = all.filter(s => s.id !== snapshotId);
  saveSnapshots(filtered);
  return filtered;
}

/**
 * Get snapshots for a specific project, sorted by timestamp ascending
 */
export function getSnapshotsForProject(snapshots: Snapshot[], projectId: string): Snapshot[] {
  return snapshots
    .filter(s => s.projectId === projectId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * Delete all snapshots for a project (used when project is deleted)
 */
export function deleteSnapshotsForProject(projectId: string): Snapshot[] {
  const all = loadSnapshots();
  const filtered = all.filter(s => s.projectId !== projectId);
  saveSnapshots(filtered);
  return filtered;
}
