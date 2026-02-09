// Export/Import utilities for GanttApp

import { AppData } from '../types/app';
import { Project, Release, ChartColors, ChartDisplaySettings } from '../types/models';
import { Snapshot } from '../types/snapshots';
import { sanitizeString, sanitizeId, sanitizeColor, isValidDateFormat } from './validation';
import { DEFAULT_CHART_COLORS, DEFAULT_DISPLAY_SETTINGS } from './colors';
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
export function exportData(data: AppData, snapshots?: Snapshot[]): void {
  const exportObj = snapshots && snapshots.length > 0
    ? { ...data, snapshots }
    : data;
  const dataStr = JSON.stringify(exportObj, null, 2);
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
 * Sanitize chart colors from imported data
 */
function sanitizeChartColors(colors: unknown): ChartColors {
  if (!colors || typeof colors !== 'object') {
    return DEFAULT_CHART_COLORS;
  }
  const c = colors as Record<string, unknown>;
  return {
    solidBar: sanitizeColor(c.solidBar as string, DEFAULT_CHART_COLORS.solidBar),
    hatchedBar: sanitizeColor(c.hatchedBar as string, DEFAULT_CHART_COLORS.hatchedBar),
    todayLine: sanitizeColor(c.todayLine as string, DEFAULT_CHART_COLORS.todayLine),
    finishDateLine: sanitizeColor(c.finishDateLine as string, DEFAULT_CHART_COLORS.finishDateLine)
  };
}

/**
 * Sanitize display settings from imported data
 */
function sanitizeDisplaySettings(settings: unknown): ChartDisplaySettings {
  if (!settings || typeof settings !== 'object') {
    return DEFAULT_DISPLAY_SETTINGS;
  }
  const s = settings as Record<string, unknown>;

  const validFontSizes = ['14', '16', '18'];
  const validDateFontSizes = ['11', '13', '15'];
  const validLabelColors = ['#999', '#666', '#333', '#000'];
  const validLineWidths = ['2', '3', '4'];
  const validBarHeights = ['30', '40', '50'];
  const validRowSpacings = ['20', '25', '30'];

  return {
    releaseNameFontSize: validFontSizes.includes(s.releaseNameFontSize as string)
      ? s.releaseNameFontSize as '14' | '16' | '18'
      : DEFAULT_DISPLAY_SETTINGS.releaseNameFontSize,
    dateLabelFontSize: validDateFontSizes.includes(s.dateLabelFontSize as string)
      ? s.dateLabelFontSize as '11' | '13' | '15'
      : DEFAULT_DISPLAY_SETTINGS.dateLabelFontSize,
    dateLabelColor: validLabelColors.includes(s.dateLabelColor as string)
      ? s.dateLabelColor as '#999' | '#666' | '#333' | '#000'
      : DEFAULT_DISPLAY_SETTINGS.dateLabelColor,
    verticalLineWidth: validLineWidths.includes(s.verticalLineWidth as string)
      ? s.verticalLineWidth as '2' | '3' | '4'
      : DEFAULT_DISPLAY_SETTINGS.verticalLineWidth,
    barHeight: validBarHeights.includes(s.barHeight as string)
      ? s.barHeight as '30' | '40' | '50'
      : DEFAULT_DISPLAY_SETTINGS.barHeight,
    rowSpacing: validRowSpacings.includes(s.rowSpacing as string)
      ? s.rowSpacing as '20' | '25' | '30'
      : DEFAULT_DISPLAY_SETTINGS.rowSpacing
  };
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
    const sanitizedReleases: Release[] = [];
    for (const release of imported.releases) {
      if (
        typeof release.id !== 'string' ||
        typeof release.projectId !== 'string' ||
        typeof release.name !== 'string' ||
        typeof release.startDate !== 'string' ||
        typeof release.earlyFinishDate !== 'string' ||
        typeof release.lateFinishDate !== 'string'
      ) {
        return null;
      }

      // Validate all dates
      if (!isValidDateFormat(release.startDate) ||
          !isValidDateFormat(release.earlyFinishDate) ||
          !isValidDateFormat(release.lateFinishDate)) {
        return null;
      }

      const sanitizedRelease: Release = {
        id: sanitizeId(release.id),
        projectId: sanitizeId(release.projectId),
        name: sanitizeString(release.name),
        startDate: release.startDate,
        earlyFinishDate: release.earlyFinishDate,
        lateFinishDate: release.lateFinishDate
      };

      // Handle optional boolean fields
      if (typeof release.hidden === 'boolean') {
        sanitizedRelease.hidden = release.hidden;
      }
      if (typeof release.completed === 'boolean') {
        sanitizedRelease.completed = release.completed;
      }

      // Reject if sanitized ID, projectId or name is empty
      if (!sanitizedRelease.id || !sanitizedRelease.projectId || !sanitizedRelease.name) {
        return null;
      }

      sanitizedReleases.push(sanitizedRelease);
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
    if (typeof imported.activePreset === 'string') {
      const validPresets = ['Default', 'Professional', 'Colorful', 'Grayscale', 'High Contrast',
                           'Forest', 'Ocean', 'Sunset', 'Lavender', 'Earth'];
      if (validPresets.includes(imported.activePreset)) {
        sanitizedData.activePreset = imported.activePreset;
      }
    }

    // Sanitize optional legend labels
    if (imported.legendLabels && typeof imported.legendLabels === 'object') {
      sanitizedData.legendLabels = {
        solidBar: sanitizeString(imported.legendLabels.solidBar || 'Design, Code, Test', 50),
        hatchedBar: sanitizeString(imported.legendLabels.hatchedBar || 'Delivery Uncertainty', 50)
      };
      if (imported.legendLabels.finishDateLine) {
        sanitizedData.legendLabels.finishDateLine = sanitizeString(imported.legendLabels.finishDateLine, 50);
      }
    }

    // Sanitize optional show finish date line toggle
    if (typeof imported.showFinishDateLine === 'boolean') {
      sanitizedData.showFinishDateLine = imported.showFinishDateLine;
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
