// localStorage utilities for GanttApp

import { AppData } from '../types/app';
import { sanitizeString, sanitizeId, sanitizeColor, isValidDateFormat } from './validation';
import { DEFAULT_CHART_COLORS } from './colors';

const STORAGE_KEY = 'ganttAppData';

/**
 * Save app data to localStorage
 */
export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving data to localStorage:', error);
  }
}

/**
 * Validate and sanitize loaded data structure
 * This provides defense-in-depth against localStorage tampering
 */
function validateLoadedData(data: unknown): AppData | null {
  if (!data || typeof data !== 'object') return null;

  const d = data as Record<string, unknown>;

  // Validate required arrays exist
  if (!Array.isArray(d.projects) || !Array.isArray(d.releases)) {
    return null;
  }

  // Validate and sanitize projects
  const validProjects = [];
  for (const p of d.projects) {
    if (p && typeof p === 'object') {
      const proj = p as Record<string, unknown>;
      if (typeof proj.id === 'string' && typeof proj.name === 'string') {
        const sanitized = {
          id: sanitizeId(proj.id),
          name: sanitizeString(proj.name),
          ...(typeof proj.finishDate === 'string' && isValidDateFormat(proj.finishDate)
            ? { finishDate: proj.finishDate }
            : {})
        };
        if (sanitized.id && sanitized.name) {
          validProjects.push(sanitized);
        }
      }
    }
  }

  // Validate and sanitize releases
  const validReleases = [];
  for (const r of d.releases) {
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

  // Build validated AppData
  const result: AppData = {
    projects: validProjects,
    releases: validReleases
  };

  // Validate optional chart colors
  if (d.chartColors && typeof d.chartColors === 'object') {
    const colors = d.chartColors as Record<string, unknown>;
    result.chartColors = {
      solidBar: sanitizeColor(colors.solidBar as string, DEFAULT_CHART_COLORS.solidBar),
      hatchedBar: sanitizeColor(colors.hatchedBar as string, DEFAULT_CHART_COLORS.hatchedBar),
      todayLine: sanitizeColor(colors.todayLine as string, DEFAULT_CHART_COLORS.todayLine),
      finishDateLine: sanitizeColor(colors.finishDateLine as string, DEFAULT_CHART_COLORS.finishDateLine)
    };
  }

  // Validate optional preset name
  if (typeof d.activePreset === 'string') {
    const validPresets = ['Default', 'Professional', 'Colorful', 'Grayscale', 'High Contrast',
                         'Forest', 'Ocean', 'Sunset', 'Lavender', 'Earth'];
    if (validPresets.includes(d.activePreset)) {
      result.activePreset = d.activePreset;
    }
  }

  // Validate optional legend labels
  if (d.legendLabels && typeof d.legendLabels === 'object') {
    const labels = d.legendLabels as Record<string, unknown>;
    result.legendLabels = {
      solidBar: typeof labels.solidBar === 'string' ? sanitizeString(labels.solidBar, 50) : 'Design, Code, Test',
      hatchedBar: typeof labels.hatchedBar === 'string' ? sanitizeString(labels.hatchedBar, 50) : 'Delivery Uncertainty'
    };
    if (typeof labels.finishDateLine === 'string') {
      result.legendLabels.finishDateLine = sanitizeString(labels.finishDateLine, 50);
    }
  }

  // Validate optional boolean
  if (typeof d.showFinishDateLine === 'boolean') {
    result.showFinishDateLine = d.showFinishDateLine;
  }

  // Validate optional display settings
  if (d.chartDisplaySettings && typeof d.chartDisplaySettings === 'object') {
    const settings = d.chartDisplaySettings as Record<string, unknown>;
    const validFontSizes = ['14', '16', '18'];
    const validDateFontSizes = ['11', '13', '15'];
    const validLabelColors = ['#999', '#666', '#333', '#000'];
    const validLineWidths = ['2', '3', '4'];

    result.chartDisplaySettings = {
      releaseNameFontSize: validFontSizes.includes(settings.releaseNameFontSize as string)
        ? settings.releaseNameFontSize as '14' | '16' | '18' : '16',
      dateLabelFontSize: validDateFontSizes.includes(settings.dateLabelFontSize as string)
        ? settings.dateLabelFontSize as '11' | '13' | '15' : '13',
      dateLabelColor: validLabelColors.includes(settings.dateLabelColor as string)
        ? settings.dateLabelColor as '#999' | '#666' | '#333' | '#000' : '#666',
      verticalLineWidth: validLineWidths.includes(settings.verticalLineWidth as string)
        ? settings.verticalLineWidth as '2' | '3' | '4' : '2'
    };
  }

  return result;
}

/**
 * Load app data from localStorage
 * Includes validation to protect against localStorage tampering
 */
export function loadData(): AppData | null {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      const parsed = JSON.parse(savedData);
      return validateLoadedData(parsed);
    }
    return null;
  } catch (error) {
    console.error('Error loading data from localStorage:', error);
    return null;
  }
}

/**
 * Clear all app data from localStorage
 */
export function clearData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing data from localStorage:', error);
  }
}
