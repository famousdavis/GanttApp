// localStorage utilities for GanttApp

import { AppData } from '../types/app';
import { sanitizeString, sanitizeId, isValidDateFormat, sanitizeChartColors, sanitizeDisplaySettings, sanitizeRelease, sanitizeLegendLabels, sanitizeExportAttribution, VALID_PRESET_NAMES } from './validation';

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
export function validateLoadedData(data: unknown): AppData | null {
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
    const sanitized = sanitizeRelease(r);
    if (sanitized) {
      validReleases.push(sanitized);
    }
  }

  // Build validated AppData
  const result: AppData = {
    projects: validProjects,
    releases: validReleases
  };

  // Validate optional chart colors
  if (d.chartColors && typeof d.chartColors === 'object') {
    result.chartColors = sanitizeChartColors(d.chartColors);
  }

  // Validate optional preset name
  if (typeof d.activePreset === 'string' && VALID_PRESET_NAMES.includes(d.activePreset)) {
    result.activePreset = d.activePreset;
  }

  // Validate optional legend labels
  if (d.legendLabels && typeof d.legendLabels === 'object') {
    result.legendLabels = sanitizeLegendLabels(d.legendLabels);
  }

  // Validate optional booleans
  if (typeof d.showTodayLine === 'boolean') {
    result.showTodayLine = d.showTodayLine;
  }
  if (typeof d.showFinishDateLine === 'boolean') {
    result.showFinishDateLine = d.showFinishDateLine;
  }
  if (typeof d.showMostLikelyLine === 'boolean') {
    result.showMostLikelyLine = d.showMostLikelyLine;
  }

  // Validate optional prepared by
  if (typeof d.preparedBy === 'string') {
    result.preparedBy = sanitizeString(d.preparedBy, 100);
  }
  if (typeof d.showPreparedBy === 'boolean') {
    result.showPreparedBy = d.showPreparedBy;
  }

  // Validate optional display settings
  if (d.chartDisplaySettings && typeof d.chartDisplaySettings === 'object') {
    result.chartDisplaySettings = sanitizeDisplaySettings(d.chartDisplaySettings);
  }

  // Validate optional export attribution
  if (d.exportAttribution) {
    result.exportAttribution = sanitizeExportAttribution(d.exportAttribution);
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
