// Snapshot storage utilities for GanttApp

import { Snapshot } from '../types/snapshots';
import { sanitizeString, sanitizeId, sanitizeColor, isValidDateFormat } from './validation';
import { DEFAULT_CHART_COLORS } from './colors';

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
    if (r && typeof r === 'object') {
      const rel = r as Record<string, unknown>;
      if (
        typeof rel.id === 'string' &&
        typeof rel.projectId === 'string' &&
        typeof rel.name === 'string' &&
        typeof rel.startDate === 'string' &&
        typeof rel.earlyFinishDate === 'string' &&
        typeof rel.lateFinishDate === 'string' &&
        isValidDateFormat(rel.startDate) &&
        isValidDateFormat(rel.earlyFinishDate) &&
        isValidDateFormat(rel.lateFinishDate)
      ) {
        const sanitized = {
          id: sanitizeId(rel.id),
          projectId: sanitizeId(rel.projectId),
          name: sanitizeString(rel.name),
          startDate: rel.startDate,
          earlyFinishDate: rel.earlyFinishDate,
          lateFinishDate: rel.lateFinishDate,
          ...(typeof rel.hidden === 'boolean' ? { hidden: rel.hidden } : {}),
          ...(typeof rel.completed === 'boolean' ? { completed: rel.completed } : {})
        };
        if (sanitized.id && sanitized.projectId && sanitized.name) {
          validReleases.push(sanitized);
        }
      }
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
    const colors = s.chartColors as Record<string, unknown>;
    snapshot.chartColors = {
      solidBar: sanitizeColor(colors.solidBar as string, DEFAULT_CHART_COLORS.solidBar),
      hatchedBar: sanitizeColor(colors.hatchedBar as string, DEFAULT_CHART_COLORS.hatchedBar),
      todayLine: sanitizeColor(colors.todayLine as string, DEFAULT_CHART_COLORS.todayLine),
      finishDateLine: sanitizeColor(colors.finishDateLine as string, DEFAULT_CHART_COLORS.finishDateLine)
    };
  }

  // Validate optional legend labels
  if (s.legendLabels && typeof s.legendLabels === 'object') {
    const labels = s.legendLabels as Record<string, unknown>;
    snapshot.legendLabels = {
      solidBar: typeof labels.solidBar === 'string' ? sanitizeString(labels.solidBar, 50) : 'Design, Code, Test',
      hatchedBar: typeof labels.hatchedBar === 'string' ? sanitizeString(labels.hatchedBar, 50) : 'Delivery Uncertainty'
    };
    if (typeof labels.finishDateLine === 'string') {
      snapshot.legendLabels.finishDateLine = sanitizeString(labels.finishDateLine, 50);
    }
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
