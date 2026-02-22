// Export/Import utilities for GanttApp

import { AppData } from '../types/app';
import { Project } from '../types/models';
import { Snapshot } from '../types/snapshots';
import { sanitizeString, sanitizeId, isValidDateFormat, sanitizeChartColors, sanitizeDisplaySettings, sanitizeRelease, sanitizeLegendLabels, sanitizeExportAttribution, VALID_PRESET_NAMES } from './validation';
import { validateSnapshot } from './snapshots';

// Maximum limits for imported data to prevent DoS via large files
const MAX_PROJECTS = 50;
const MAX_RELEASES = 500;
const MAX_SNAPSHOTS = 100;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB (increased for snapshots)

export interface ImportResult {
  appData: AppData;
  snapshots?: Snapshot[];
}

/**
 * Export app data as JSON file download, optionally including snapshots
 */
export function exportData(data: AppData, snapshots?: Snapshot[], options?: { storageMode?: string; uid?: string }): void {
  // Build export object with optional attribution metadata
  const baseObj: Record<string, unknown> = { ...data };
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
  const dataStr = JSON.stringify(baseObj, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gantt-data-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

    // Parse optional snapshots array
    const result: ImportResult = { appData: sanitizedData };

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
    console.error('Error parsing imported data:', error);
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

  const exportObj: Record<string, unknown> = {
    ...appData,
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

  const dataStr = JSON.stringify(exportObj, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ganttapp-all-projects-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { exported: appData.projects.length };
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
