// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Export/Import utilities for GanttApp

import { AppData } from '../types/app';
import { Project } from '../types/models';
import { Snapshot } from '../types/snapshots';
import { sanitizeString, sanitizeId, isValidDateFormat, sanitizeChartColors, sanitizeDisplaySettings, sanitizeRelease, sanitizeLegendLabels, sanitizeExportAttribution, sanitizeWorkDays, sanitizeProjectLegendLabels, VALID_PRESET_NAMES, MAX_NAME_LENGTH } from './validation';
import { validateSnapshot } from './snapshots';
import { generateId } from './dates';

// Maximum limits for imported data to prevent DoS via large files
const MAX_PROJECTS = 50;
const MAX_RELEASES = 500;
const MAX_SNAPSHOTS = 100;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB (increased for snapshots)

export interface ImportResult {
  appData: AppData;
  snapshots?: Snapshot[];
  /**
   * Discriminator set from the file's `_exportType` metadata field (v19.0).
   * - `'ganttapp-all-projects'` → full-workspace export from `exportAllProjects()`
   * - `'ganttapp-project-export'` → single-project or multi-project export from
   *   `exportSingleProject()` / `exportSelectedProjects()` (additive merge import)
   * - `'legacy'` → file from `exportData()` (no `_exportType`) or unrecognized value;
   *   treated as a full-workspace replace by the caller.
   */
  exportType: 'ganttapp-all-projects' | 'ganttapp-project-export' | 'legacy';
}

/**
 * v0.22.2 (S5): strip the cloud-user `owner` UID from each project record
 * before serialization. The UID is meaningful only in cloud mode (gates
 * Share-button visibility, ownership guards); in an exported file it leaks
 * the cloud user's Firebase identity to anyone the file is shared with.
 * On re-import + re-upload, `projectToFirestoreMeta` re-binds `owner` to
 * the current user via `existingMeta?.owner ?? uid`, so round-trip is
 * preserved.
 */
function stripCloudIdentity(projects: Project[]): Project[] {
  return projects.map(({ owner: _owner, ...rest }) => rest);
}

/**
 * Trigger a JSON file download for the given payload.
 * Centralizes the Blob → URL → anchor-click → revoke sequence that all four
 * export entry points (`exportData`, `exportAllProjects`, `exportSingleProject`,
 * `exportSelectedProjects`) need. Single point of change for download UX.
 */
function triggerJsonDownload(payload: Record<string, unknown>, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Slugify a project name for use in a filename.
 * Lowercase, spaces→hyphens, strip non-`[a-z0-9-]`, collapse hyphens, trim, max 40 chars.
 * Falls back to `'project'` if the input reduces to an empty string.
 */
function slugifyProjectName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'project'
  );
}

/**
 * Export app data as JSON file download, optionally including snapshots
 */
export function exportData(data: AppData, snapshots?: Snapshot[], options?: { storageMode?: string; uid?: string }): void {
  // Build export object with optional attribution metadata.
  // v0.22.2 (S5): strip cloud-user owner UID from each project record.
  const baseObj: Record<string, unknown> = { ...data, projects: stripCloudIdentity(data.projects) };
  if (snapshots && snapshots.length > 0) {
    baseObj.snapshots = snapshots;
  }
  if (data.exportAttribution) {
    baseObj._exportedBy = {
      name: data.exportAttribution.name,
      identifier: data.exportAttribution.identifier,
    };
    baseObj._exportedAt = new Date().toISOString();
  }
  // Add storage reference for provenance tracking
  if (options?.storageMode === 'cloud' && options?.uid) {
    baseObj._storageRef = `firestore:uid:${options.uid}`;
  }
  triggerJsonDownload(baseObj, `ganttapp-export-${new Date().toISOString().split('T')[0]}.json`);
}

/**
 * Import app data from JSON file
 * Returns the imported data if valid, null otherwise
 * Includes security sanitization for all imported values
 */
export function parseImportedData(fileContent: string): ImportResult | null {
  try {
    // Check file size to prevent DoS
    if (fileContent.length > MAX_FILE_SIZE) {
      console.error('Import file too large');
      return null;
    }

    const imported = JSON.parse(fileContent);

    // Validate top-level structure
    if (
      !imported.projects ||
      !imported.releases ||
      !Array.isArray(imported.projects) ||
      !Array.isArray(imported.releases)
    ) {
      return null;
    }

    // Check array size limits
    if (imported.projects.length > MAX_PROJECTS || imported.releases.length > MAX_RELEASES) {
      console.error('Import data exceeds maximum limits');
      return null;
    }

    // Sanitize and validate projects
    const sanitizedProjects: Project[] = [];
    for (const project of imported.projects) {
      if (typeof project.id !== 'string' || typeof project.name !== 'string') {
        return null;
      }

      const sanitizedProject: Project = {
        id: sanitizeId(project.id),
        name: sanitizeString(project.name)
      };

      // Validate optional finish date
      if (project.finishDate) {
        if (typeof project.finishDate === 'string' && isValidDateFormat(project.finishDate)) {
          sanitizedProject.finishDate = project.finishDate;
        }
      }

      // Validate optional work days override (v15.0)
      if (Array.isArray(project.workDays)) {
        const sanitizedDays = sanitizeWorkDays(project.workDays);
        if (sanitizedDays) sanitizedProject.workDays = sanitizedDays;
      }

      // Validate optional per-project legend labels (v16.1)
      if (project.legendLabels) {
        const sanitizedLabels = sanitizeProjectLegendLabels(project.legendLabels);
        if (sanitizedLabels) sanitizedProject.legendLabels = sanitizedLabels;
      }

      // Reject if sanitized ID or name is empty
      if (!sanitizedProject.id || !sanitizedProject.name) {
        return null;
      }

      sanitizedProjects.push(sanitizedProject);
    }

    // Sanitize and validate releases
    const sanitizedReleases = [];
    for (const release of imported.releases) {
      const sanitized = sanitizeRelease(release);
      if (!sanitized) {
        return null; // Import rejects entirely on any invalid release
      }
      sanitizedReleases.push(sanitized);
    }

    // Build sanitized AppData
    const sanitizedData: AppData = {
      projects: sanitizedProjects,
      releases: sanitizedReleases
    };

    // Sanitize optional chart colors
    if (imported.chartColors) {
      sanitizedData.chartColors = sanitizeChartColors(imported.chartColors);
    }

    // Sanitize optional active preset (only allow known preset names)
    if (typeof imported.activePreset === 'string' && VALID_PRESET_NAMES.includes(imported.activePreset)) {
      sanitizedData.activePreset = imported.activePreset;
    }

    // Sanitize optional legend labels
    if (imported.legendLabels && typeof imported.legendLabels === 'object') {
      sanitizedData.legendLabels = sanitizeLegendLabels(imported.legendLabels);
    }

    // Sanitize optional toggle booleans
    if (typeof imported.showTodayLine === 'boolean') {
      sanitizedData.showTodayLine = imported.showTodayLine;
    }
    if (typeof imported.showFinishDateLine === 'boolean') {
      sanitizedData.showFinishDateLine = imported.showFinishDateLine;
    }
    if (typeof imported.showMostLikelyLine === 'boolean') {
      sanitizedData.showMostLikelyLine = imported.showMostLikelyLine;
    }
    if (typeof imported.showMonths === 'boolean') {
      sanitizedData.showMonths = imported.showMonths;
    }

    // Sanitize optional display settings
    if (imported.chartDisplaySettings) {
      sanitizedData.chartDisplaySettings = sanitizeDisplaySettings(imported.chartDisplaySettings);
    }

    // Sanitize optional prepared by
    if (typeof imported.preparedBy === 'string') {
      sanitizedData.preparedBy = sanitizeString(imported.preparedBy, 100);
    }
    if (typeof imported.showPreparedBy === 'boolean') {
      sanitizedData.showPreparedBy = imported.showPreparedBy;
    }

    // Sanitize optional export attribution
    if (imported.exportAttribution) {
      sanitizedData.exportAttribution = sanitizeExportAttribution(imported.exportAttribution);
    }

    // Sanitize optional global work days (v15.0)
    if (Array.isArray(imported.globalWorkDays)) {
      const sanitized = sanitizeWorkDays(imported.globalWorkDays);
      if (sanitized) sanitizedData.globalWorkDays = sanitized;
    }

    // Determine export type discriminator from the file's _exportType field (v19.0).
    let exportType: ImportResult['exportType'];
    if (imported._exportType === 'ganttapp-all-projects') {
      exportType = 'ganttapp-all-projects';
    } else if (imported._exportType === 'ganttapp-project-export') {
      exportType = 'ganttapp-project-export';
    } else {
      exportType = 'legacy';
    }

    // Parse optional snapshots array
    const result: ImportResult = { appData: sanitizedData, exportType };

    if (Array.isArray(imported.snapshots)) {
      const validatedSnapshots: Snapshot[] = [];
      const snapshotsToProcess = imported.snapshots.slice(0, MAX_SNAPSHOTS);
      for (const rawSnapshot of snapshotsToProcess) {
        const validated = validateSnapshot(rawSnapshot);
        if (validated) {
          validatedSnapshots.push(validated);
        }
        // Invalid snapshots are silently skipped — don't reject the entire import
      }
      if (validatedSnapshots.length > 0) {
        result.snapshots = validatedSnapshots;
      }
    }

    return result;
  } catch (error) {
    console.error('Error parsing imported data:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Export all projects as a single combined JSON file.
 * Loads all data from the current storage service and produces one download.
 * File is compatible with the existing import flow (same shape as AppData + snapshots).
 */
export async function exportAllProjects(
  storage: { loadAppData: () => Promise<AppData | null>; loadSnapshots: () => Promise<Snapshot[]> }
): Promise<{ exported: number }> {
  const appData = await storage.loadAppData();
  if (!appData || appData.projects.length === 0) {
    throw new Error('No projects to export.');
  }

  const snapshots = await storage.loadSnapshots();

  // v0.22.2 (S5): strip cloud-user owner UID from each project record.
  const exportObj: Record<string, unknown> = {
    ...appData,
    projects: stripCloudIdentity(appData.projects),
    _exportedAt: new Date().toISOString(),
    _exportType: 'ganttapp-all-projects',
  };

  if (snapshots.length > 0) {
    exportObj.snapshots = snapshots;
  }

  if (appData.exportAttribution) {
    exportObj._exportedBy = {
      name: appData.exportAttribution.name,
      identifier: appData.exportAttribution.identifier,
    };
  }

  triggerJsonDownload(exportObj, `ganttapp-all-projects-${new Date().toISOString().split('T')[0]}.json`);

  return { exported: appData.projects.length };
}

/**
 * Export a single project as a portable JSON file (v19.0).
 *
 * Contains the project record + its releases + (optionally) its snapshots only.
 * Excludes all global settings (chartColors, displaySettings, attribution, etc.) so
 * importing into another workspace does not clobber the recipient's configuration.
 *
 * Tagged `_exportType: 'ganttapp-project-export'` so `parseImportedData()` can
 * route it to the additive merge path on import.
 *
 * Throws if the projectId is not found.
 */
export async function exportSingleProject(
  projectId: string,
  data: AppData,
  storage: { loadSnapshots: () => Promise<Snapshot[]> },
  options?: {
    includeSnapshots?: boolean;
    storageMode?: string;
    uid?: string;
  }
): Promise<void> {
  const project = data.projects.find(p => p.id === projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  const releases = data.releases.filter(r => r.projectId === projectId);

  let snapshots: Snapshot[] | undefined;
  if (options?.includeSnapshots) {
    const all = await storage.loadSnapshots();
    snapshots = all.filter(s => s.projectId === projectId);
  }

  // v0.22.2 (S5): strip cloud-user owner UID from the project record.
  const exportObj: Record<string, unknown> = {
    projects: stripCloudIdentity([project]),
    releases,
    _exportType: 'ganttapp-project-export',
    _exportedAt: new Date().toISOString(),
  };

  if (snapshots && snapshots.length > 0) {
    exportObj.snapshots = snapshots;
  }

  if (data.exportAttribution) {
    exportObj._exportedBy = {
      name: data.exportAttribution.name,
      identifier: data.exportAttribution.identifier,
    };
  }

  if (options?.storageMode === 'cloud' && options?.uid) {
    exportObj._storageRef = `firestore:uid:${options.uid}`;
  }

  triggerJsonDownload(
    exportObj,
    `ganttapp-${slugifyProjectName(project.name)}-${new Date().toISOString().split('T')[0]}.json`
  );
}

/**
 * Export multiple selected projects as a single JSON file (v19.0).
 *
 * Same shape as `exportSingleProject` (no global settings, `_exportType:
 * 'ganttapp-project-export'`). Used by the Settings → Export Projects section.
 *
 * Throws if `projectIds` is empty. Returns the count of projects exported.
 */
export async function exportSelectedProjects(
  projectIds: string[],
  data: AppData,
  storage: { loadSnapshots: () => Promise<Snapshot[]> },
  options?: {
    includeSnapshots?: boolean;
    storageMode?: string;
    uid?: string;
  }
): Promise<{ exported: number }> {
  if (projectIds.length === 0) {
    throw new Error('No projects selected');
  }

  const idSet = new Set(projectIds);
  const projects = data.projects.filter(p => idSet.has(p.id));
  const releases = data.releases.filter(r => idSet.has(r.projectId));

  let snapshots: Snapshot[] | undefined;
  if (options?.includeSnapshots) {
    const all = await storage.loadSnapshots();
    snapshots = all.filter(s => idSet.has(s.projectId));
  }

  // v0.22.2 (S5): strip cloud-user owner UID from each project record.
  const exportObj: Record<string, unknown> = {
    projects: stripCloudIdentity(projects),
    releases,
    _exportType: 'ganttapp-project-export',
    _exportedAt: new Date().toISOString(),
  };

  if (snapshots && snapshots.length > 0) {
    exportObj.snapshots = snapshots;
  }

  if (data.exportAttribution) {
    exportObj._exportedBy = {
      name: data.exportAttribution.name,
      identifier: data.exportAttribution.identifier,
    };
  }

  if (options?.storageMode === 'cloud' && options?.uid) {
    exportObj._storageRef = `firestore:uid:${options.uid}`;
  }

  triggerJsonDownload(exportObj, `ganttapp-projects-export-${new Date().toISOString().split('T')[0]}.json`);

  return { exported: projects.length };
}

// ============================================================================
// v0.24.0 — Smart Import with Per-Project Conflict Resolution
// ============================================================================

/**
 * A conflict between an incoming project and an existing project.
 * `type: 'id'` means the IDs match (same project). `type: 'name'` means the
 * lowercased-trimmed names match but the IDs differ (coincidental name collision).
 * If both match, only `'id'` is reported.
 */
export type ImportConflict = {
  type: 'id' | 'name';
  incomingProject: Project;
  existingProject: Project;
};

export type ConflictAction = 'skip' | 'copy' | 'replace';

export type ImportDecisionResult = {
  added: number;
  skipped: number;
  copied: number;
  replaced: number;
  /**
   * Keyed by EXISTING project ID → incoming project ID that replaced it.
   * Only populated for NAME conflicts (existing.id ≠ incoming.id).
   * ID conflicts produce no entry (existing.id === incoming.id, no remap needed).
   * Every entry signals a genuine ID change the call site must act on.
   */
  replacedIdMap: Map<string, string>;
};

export type ApplyImportResult = {
  mergedData: AppData;
  mergedSnapshots: Snapshot[];
  result: ImportDecisionResult;
};

/**
 * Detect conflicts between an incoming import and the existing workspace.
 * Returns one entry per conflicting incoming project.
 *
 * - ID match → `type: 'id'`
 * - Lowercased-trimmed name match (with no ID match) → `type: 'name'`
 * - Both match → `'id'` only
 * - No match → no entry
 *
 * Name-match resolution uses first-insert-wins: if two existing projects share
 * a lowercased-trimmed name, the FIRST one in array order is returned for any
 * name conflict (GanttApp does not enforce project-name uniqueness).
 *
 * Incoming projects are evaluated against the existing workspace only — two
 * incoming projects sharing a name with each other are not flagged.
 */
export function detectImportConflicts(
  incoming: ImportResult,
  existing: AppData
): ImportConflict[] {
  const idMap = new Map<string, Project>();
  for (const p of existing.projects) {
    idMap.set(p.id, p);
  }
  // First-insert-wins preserves first-match semantics on name collisions.
  const nameMap = new Map<string, Project>();
  for (const p of existing.projects) {
    const key = p.name.trim().toLowerCase();
    if (!nameMap.has(key)) nameMap.set(key, p);
  }

  const conflicts: ImportConflict[] = [];
  for (const incomingProject of incoming.appData.projects) {
    const idHit = idMap.get(incomingProject.id);
    if (idHit) {
      conflicts.push({ type: 'id', incomingProject, existingProject: idHit });
      continue;
    }
    const nameKey = incomingProject.name.trim().toLowerCase();
    const nameHit = nameMap.get(nameKey);
    if (nameHit) {
      conflicts.push({ type: 'name', incomingProject, existingProject: nameHit });
    }
  }
  return conflicts;
}

/**
 * Returns true iff `a` and `b` represent the same multiset of
 * (incomingProject.id, type, existingProject.id) tuples. Order-independent.
 * Used to detect workspace drift between preview and apply.
 */
export function conflictsEqual(a: ImportConflict[], b: ImportConflict[]): boolean {
  if (a.length !== b.length) return false;
  const tupleKey = (c: ImportConflict) =>
    `${c.incomingProject.id}${c.type}${c.existingProject.id}`;
  const counts = new Map<string, number>();
  for (const c of a) counts.set(tupleKey(c), (counts.get(tupleKey(c)) ?? 0) + 1);
  for (const c of b) {
    const k = tupleKey(c);
    const n = counts.get(k);
    if (!n) return false;
    if (n === 1) counts.delete(k); else counts.set(k, n - 1);
  }
  return counts.size === 0;
}

/**
 * Suffix appended to project names when action is 'copy'.
 * NOTE: differs from cloneProject in useProjects.ts, which uses " - Copy (N)"
 * (starting at N=1, iterating up to N=99). Import-copy is unconditional " (2)"
 * — simpler, but intentionally divergent from the clone UX. Do not "fix" this
 * without a deliberate UX decision.
 */
const COPY_SUFFIX = ' (2)';

/**
 * Apply per-project decisions to produce a merged AppData and snapshot list.
 *
 * Caller contract:
 * - `decisions` is keyed by incoming project ID. Function does not clone it;
 *   the caller must not mutate during apply.
 * - Missing decisions key for a detected conflict → treated as 'skip'
 *   (safe-by-default; project, releases, AND snapshots all excluded).
 * - Conflicts are recomputed internally; caller does not pass them in.
 *
 * Slot-preservation: 'replace' actions substitute the existing slot in place,
 * preserving array index and existingProject.owner. This avoids
 * executeFirestoreSave's prevIndex !== index reorder detection triggering
 * spurious cloud writes.
 *
 * Snapshot cap policy: bypasses MAX_SNAPSHOTS_TOTAL, consistent with the
 * existing replace-all import path. Diverges from cloneProject, which enforces
 * the cap and drops snapshots with an alert. Import is a bulk restore operation;
 * the cap is intentionally bypassed.
 *
 * Embedded snapshot.releases handling on 'copy': leave entirely untouched. It
 * is a frozen historical record. Its embedded `projectId` values are
 * intentionally left at the original (pre-copy) project ID. Confirmed safe:
 * snapshot.releases[*].projectId is consumed only by useEffectiveChartProps.ts
 * as a frozen render input, never joined against live Project.id.
 *
 * Global settings (chartColors, legendLabels, displaySettings, etc.) are
 * preserved untouched from `existing`.
 */
export function applyImportDecisions(
  existing: AppData,
  incoming: ImportResult,
  existingSnapshots: Snapshot[],
  decisions: Map<string, ConflictAction>,
  idGenerator: () => string = generateId
): ApplyImportResult {
  const conflicts = detectImportConflicts(incoming, existing);
  const conflictByIncomingId = new Map<string, ImportConflict>();
  for (const c of conflicts) conflictByIncomingId.set(c.incomingProject.id, c);

  const incomingReleasesByProjectId = new Map<string, typeof incoming.appData.releases>();
  for (const r of incoming.appData.releases) {
    const list = incomingReleasesByProjectId.get(r.projectId) ?? [];
    list.push(r);
    incomingReleasesByProjectId.set(r.projectId, list);
  }
  const incomingSnapshotsByProjectId = new Map<string, Snapshot[]>();
  for (const s of incoming.snapshots ?? []) {
    const list = incomingSnapshotsByProjectId.get(s.projectId) ?? [];
    list.push(s);
    incomingSnapshotsByProjectId.set(s.projectId, list);
  }

  const resolvedAction = (incomingProjectId: string): ConflictAction | 'added' => {
    const conflict = conflictByIncomingId.get(incomingProjectId);
    if (!conflict) return 'added';
    // Missing-key fallback: treat as 'skip' (safe-by-default).
    return decisions.get(incomingProjectId) ?? 'skip';
  };

  let added = 0;
  let skipped = 0;
  let copied = 0;
  let replaced = 0;
  const replacedIdMap = new Map<string, string>();

  // Pass 1: pre-compute the winning-replace map.
  // First-wins is determined by incoming.appData.projects array order, NOT
  // decisions.entries() insertion order — these can differ if the user made
  // decisions in a different order than the projects appear in the file.
  const winningReplaceBySlotId = new Map<string, Project>();
  const downgradedReplaceIncomingIds = new Set<string>();
  for (const incomingProject of incoming.appData.projects) {
    const action = resolvedAction(incomingProject.id);
    if (action !== 'replace') continue;
    const conflict = conflictByIncomingId.get(incomingProject.id);
    if (!conflict) continue; // 'replace' on a non-conflict is degenerate; treat as no-op.
    const slotId = conflict.existingProject.id;
    if (winningReplaceBySlotId.has(slotId)) {
      // Same slot already claimed by an earlier-in-array incoming project.
      downgradedReplaceIncomingIds.add(incomingProject.id);
      skipped += 1;
      continue;
    }
    winningReplaceBySlotId.set(slotId, incomingProject);
  }

  // Pass 2: slot substitution. Iterate existing.projects; substitute or keep.
  const mergedProjects: Project[] = [];
  const mergedReleases: typeof existing.releases = [];
  const removedExistingProjectIds = new Set<string>();
  for (const existingProject of existing.projects) {
    const winner = winningReplaceBySlotId.get(existingProject.id);
    if (winner) {
      // Substitute in place; preserve existingProject.owner if defined.
      // If owner is undefined, leave incoming with no owner — never fabricate.
      const substituted: Project = { ...winner };
      if (existingProject.owner !== undefined) {
        substituted.owner = existingProject.owner;
      } else {
        delete substituted.owner;
      }
      mergedProjects.push(substituted);
      removedExistingProjectIds.add(existingProject.id);

      const conflict = conflictByIncomingId.get(winner.id);
      if (conflict && conflict.type === 'name') {
        // Name-conflict replace genuinely remaps existing.id → incoming.id.
        replacedIdMap.set(existingProject.id, winner.id);
      }
      replaced += 1;

      // Bring in the incoming project's releases (slot substitution removes
      // the existing project's releases entirely — they're rebuilt from the
      // incoming file). 'replace' does NOT dedup snapshots; full substitution.
      const winnerReleases = incomingReleasesByProjectId.get(winner.id) ?? [];
      for (const r of winnerReleases) mergedReleases.push(r);
    } else {
      mergedProjects.push(existingProject);
    }
  }

  // Releases of other existing projects (not replaced) are preserved.
  for (const r of existing.releases) {
    if (!removedExistingProjectIds.has(r.projectId)) {
      mergedReleases.push(r);
    }
  }

  // Pass 3: append copies, then non-conflicting 'added'.
  // Snapshot handling for both passes is collected here.
  const mergedSnapshots: Snapshot[] = [];
  // 'replace' snapshots: bring in incoming snapshots for replaced slots; drop
  // existing snapshots whose projectId was removed.
  for (const s of existingSnapshots) {
    if (!removedExistingProjectIds.has(s.projectId)) {
      mergedSnapshots.push(s);
    }
  }
  removedExistingProjectIds.forEach(slotId => {
    const winner = winningReplaceBySlotId.get(slotId);
    if (!winner) return;
    const incomingSnaps = incomingSnapshotsByProjectId.get(winner.id) ?? [];
    for (const s of incomingSnaps) mergedSnapshots.push(s);
  });

  // 'copy' pass — append in incoming.appData.projects array order.
  for (const incomingProject of incoming.appData.projects) {
    if (resolvedAction(incomingProject.id) !== 'copy') continue;
    const newId = idGenerator();
    const truncated = incomingProject.name
      .slice(0, MAX_NAME_LENGTH - COPY_SUFFIX.length)
      .trimEnd();
    const copyName = truncated + COPY_SUFFIX;
    const copyProject: Project = { ...incomingProject, id: newId, name: copyName };
    // Do NOT set owner on copy.
    delete copyProject.owner;
    mergedProjects.push(copyProject);

    // Releases: regenerate every id; update projectId.
    const srcReleases = incomingReleasesByProjectId.get(incomingProject.id) ?? [];
    for (const r of srcReleases) {
      mergedReleases.push({ ...r, id: idGenerator(), projectId: newId });
    }

    // Snapshots: regenerate snapshot.id and top-level snapshot.projectId.
    // Embedded snapshot.releases[] left entirely untouched — frozen historical
    // record; only consumed by useEffectiveChartProps.ts as render input.
    // NOTE: snapshot ID regeneration means importing the same file twice via
    // 'copy' doubles snapshot counts — consistent with the cap-bypass policy.
    const srcSnaps = incomingSnapshotsByProjectId.get(incomingProject.id) ?? [];
    for (const s of srcSnaps) {
      mergedSnapshots.push({ ...s, id: idGenerator(), projectId: newId });
    }

    copied += 1;
  }

  // 'added' pass — non-conflicting incoming projects appended at end.
  // Snapshot dedup by ID on this path only (not on 'replace').
  const existingSnapshotIds = new Set<string>();
  for (const s of mergedSnapshots) existingSnapshotIds.add(s.id);
  for (const incomingProject of incoming.appData.projects) {
    if (resolvedAction(incomingProject.id) !== 'added') continue;
    mergedProjects.push(incomingProject);
    const srcReleases = incomingReleasesByProjectId.get(incomingProject.id) ?? [];
    for (const r of srcReleases) mergedReleases.push(r);
    const srcSnaps = incomingSnapshotsByProjectId.get(incomingProject.id) ?? [];
    for (const s of srcSnaps) {
      if (existingSnapshotIds.has(s.id)) continue;
      existingSnapshotIds.add(s.id);
      mergedSnapshots.push(s);
    }
    added += 1;
  }

  // Count 'skip' from explicit decisions + missing-key fallback.
  for (const incomingProject of incoming.appData.projects) {
    if (downgradedReplaceIncomingIds.has(incomingProject.id)) continue;
    if (resolvedAction(incomingProject.id) === 'skip') skipped += 1;
  }

  return {
    mergedData: {
      ...existing,
      projects: mergedProjects,
      releases: mergedReleases,
    },
    mergedSnapshots,
    result: { added, skipped, copied, replaced, replacedIdMap },
  };
}

/**
 * Read a file and return its contents as string
 * Returns a Promise that resolves with the file content
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      resolve(content);
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsText(file);
  });
}
