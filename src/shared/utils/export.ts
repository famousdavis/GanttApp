// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Export/Import utilities for GanttApp

import { AppData } from '../types/app';
import { Project } from '../types/models';
import { Snapshot } from '../types/snapshots';
import { sanitizeString, sanitizeId, isValidDateFormat, sanitizeChartColors, sanitizeDisplaySettings, sanitizeRelease, sanitizeLegendLabels, sanitizeExportAttribution, sanitizeWorkDays, sanitizeProjectLegendLabels, VALID_PRESET_NAMES } from './validation';
import { validateSnapshot } from './snapshots';

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

/**
 * Merge incoming projects into the existing workspace (v19.0).
 *
 * Used by the additive import path. Projects whose `id` already exists in
 * `existing.projects` are skipped (count returned). Releases and snapshots are
 * filtered to the accepted project IDs only. Snapshots are deduplicated against
 * `existingSnapshots` by snapshot ID.
 *
 * Note: this bypasses the MAX_SNAPSHOTS_TOTAL cap. This is consistent with the
 * existing applyImport (replace-all) path, which also calls onReplaceSnapshots
 * directly and bypasses the cap.
 *
 * Existing global settings (chartColors, displaySettings, attribution, etc.)
 * are preserved untouched — only `projects` and `releases` are extended.
 */
export function mergeImportedProjects(
  existing: AppData,
  incoming: ImportResult,
  existingSnapshots: Snapshot[]
): {
  mergedData: AppData;
  mergedSnapshots: Snapshot[];
  skipped: number;
} {
  const seenIds = new Set(existing.projects.map(p => p.id));
  const accepted: typeof existing.projects = [];
  let skipped = 0;
  for (const project of incoming.appData.projects) {
    if (seenIds.has(project.id)) {
      skipped += 1;
      continue;
    }
    accepted.push(project);
    seenIds.add(project.id); // also catches duplicates within the incoming batch
  }

  const acceptedIds = new Set(accepted.map(p => p.id));
  const acceptedReleases = incoming.appData.releases.filter(r => acceptedIds.has(r.projectId));

  const mergedSnapshots: Snapshot[] = [...existingSnapshots];
  if (incoming.snapshots && incoming.snapshots.length > 0) {
    const existingSnapshotIds = new Set(existingSnapshots.map(s => s.id));
    for (const snapshot of incoming.snapshots) {
      if (!acceptedIds.has(snapshot.projectId)) continue;
      if (existingSnapshotIds.has(snapshot.id)) continue; // dedup by ID
      mergedSnapshots.push(snapshot);
    }
  }

  return {
    mergedData: {
      ...existing,
      projects: [...existing.projects, ...accepted],
      releases: [...existing.releases, ...acceptedReleases],
    },
    mergedSnapshots,
    skipped,
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
