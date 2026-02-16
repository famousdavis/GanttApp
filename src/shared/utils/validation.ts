// Validation utilities for GanttApp

import { Release, ChartColors, ChartDisplaySettings } from '../types/models';
import { parseDateLocal } from './dates';
import { DEFAULT_CHART_COLORS, DEFAULT_DISPLAY_SETTINGS } from './colors';

// Security constants
const MAX_NAME_LENGTH = 100;
const MAX_ID_LENGTH = 50;

/**
 * Sanitize a string by removing potentially dangerous characters
 * Allows alphanumeric, spaces, common punctuation, and unicode letters
 */
export function sanitizeString(str: string, maxLength: number = MAX_NAME_LENGTH): string {
  if (typeof str !== 'string') return '';
  // Remove control characters and null bytes, trim, and limit length
  return str
    .replace(/[\x00-\x1f\x7f]/g, '') // Remove control characters
    .trim()
    .slice(0, maxLength);
}

/**
 * Validate and sanitize an ID string
 * IDs should only contain safe characters for use in SVG pattern IDs and DOM
 */
export function sanitizeId(id: string): string {
  if (typeof id !== 'string') return '';
  // Allow only alphanumeric, hyphens, and underscores
  return id.replace(/[^a-zA-Z0-9\-_]/g, '').slice(0, MAX_ID_LENGTH);
}

/**
 * Validate a hex color string
 * Returns true if the color is a valid 3, 4, 6, or 8 character hex color
 */
export function isValidHexColor(color: string): boolean {
  if (typeof color !== 'string') return false;
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color);
}

/**
 * Sanitize a color value - returns default if invalid
 */
export function sanitizeColor(color: string, defaultColor: string = '#0070f3'): string {
  if (isValidHexColor(color)) return color.toLowerCase();
  return defaultColor;
}

/**
 * Check if a date string is in valid YYYY-MM-DD format, represents a real calendar date,
 * and is within the allowed year range (2000-2050)
 */
export function isValidDateFormat(dateStr: string): boolean {
  if (!dateStr || dateStr.length !== 10) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;

  // Check year range
  if (dateStr < '2000-01-01' || dateStr > '2050-12-31') return false;

  // Validate actual calendar date (e.g., reject Feb 30, Month 13, Day 32)
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return false;
  }

  return true;
}

/**
 * Validate project name is not empty
 */
export function isProjectNameValid(name: string): boolean {
  return name.trim().length > 0;
}

/**
 * Validate release has all required fields and dates are in correct order
 */
export function isReleaseValid(
  name: string,
  startDate: string,
  earlyFinish: string,
  lateFinish: string
): boolean {
  // Check name
  if (name.trim().length === 0) return false;

  // Check all dates filled
  if (!startDate || !earlyFinish || !lateFinish) return false;

  // Check date logic (using local timezone parsing for consistency)
  const start = parseDateLocal(startDate);
  const early = parseDateLocal(earlyFinish);
  const late = parseDateLocal(lateFinish);

  // Start must be before early
  if (start >= early) return false;

  // Early must be before or equal to late
  if (early > late) return false;

  return true;
}

/**
 * Get user-friendly error message for date validation
 * Only validates fields that have been "touched" (user has left the field)
 */
export function getDateErrorMessage(
  startDate: string,
  earlyFinish: string,
  lateFinish: string,
  touchedFields: { startDate: boolean; earlyFinish: boolean; lateFinish: boolean }
): string {
  // Check individual date ranges
  if (touchedFields.startDate && startDate && startDate.length === 10) {
    if (startDate < '2000-01-01' || startDate > '2050-12-31') {
      return 'Date must be between 2000 and 2050';
    }
  }

  if (touchedFields.earlyFinish && earlyFinish && earlyFinish.length === 10) {
    if (earlyFinish < '2000-01-01' || earlyFinish > '2050-12-31') {
      return 'Date must be between 2000 and 2050';
    }
  }

  if (touchedFields.lateFinish && lateFinish && lateFinish.length === 10) {
    if (lateFinish < '2000-01-01' || lateFinish > '2050-12-31') {
      return 'Date must be between 2000 and 2050';
    }
  }

  // Check start vs early only when earlyFinish field has been touched AND both dates are complete
  if (touchedFields.earlyFinish && isValidDateFormat(startDate) && isValidDateFormat(earlyFinish)) {
    const start = parseDateLocal(startDate);
    const early = parseDateLocal(earlyFinish);

    if (start >= early) {
      return 'Start date must be before the Early finish date';
    }
  }

  // Check early vs late only when lateFinish field has been touched AND both dates are complete
  if (touchedFields.lateFinish && isValidDateFormat(earlyFinish) && isValidDateFormat(lateFinish)) {
    const early = parseDateLocal(earlyFinish);
    const late = parseDateLocal(lateFinish);

    if (early > late) {
      return 'Early finish date must be before or equal to the Late finish date';
    }
  }

  return '';
}

/**
 * Validate a single date field change on a release
 * Returns an error message string, or '' if valid
 * Used by inline chart editing (useChartEditing) and useReleases.updateReleaseDate
 */
export function validateReleaseDateChange(
  release: { startDate: string; earlyFinishDate: string; lateFinishDate: string },
  dateType: 'start' | 'early' | 'late' | 'mostLikely',
  newDate: string
): string {
  if (!isValidDateFormat(newDate)) return 'Invalid date format';

  if (dateType === 'mostLikely') {
    const earlyMs = parseDateLocal(release.earlyFinishDate);
    const lateMs = parseDateLocal(release.lateFinishDate);
    const mlMs = parseDateLocal(newDate);
    if (mlMs < earlyMs) return 'Must be >= Early Finish';
    if (mlMs > lateMs) return 'Must be <= Late Finish';
    return '';
  }

  const startDate = dateType === 'start' ? newDate : release.startDate;
  const earlyFinishDate = dateType === 'early' ? newDate : release.earlyFinishDate;
  const lateFinishDate = dateType === 'late' ? newDate : release.lateFinishDate;

  const startMs = parseDateLocal(startDate);
  const earlyMs = parseDateLocal(earlyFinishDate);
  const lateMs = parseDateLocal(lateFinishDate);

  if (startMs >= earlyMs) return 'Start must be before Early Finish';
  if (earlyMs > lateMs) return 'Early Finish must be <= Late Finish';
  return '';
}

// --- Shared sanitization helpers (used by storage.ts, export.ts, snapshots.ts) ---

/**
 * Valid preset theme names
 */
export const VALID_PRESET_NAMES = [
  'Default', 'Professional', 'Colorful', 'Grayscale', 'High Contrast',
  'Forest', 'Ocean', 'Sunset', 'Lavender', 'Earth'
];

/**
 * Sanitize chart colors from untrusted data
 */
export function sanitizeChartColors(colors: unknown): ChartColors {
  if (!colors || typeof colors !== 'object') {
    return DEFAULT_CHART_COLORS;
  }
  const c = colors as Record<string, unknown>;
  return {
    solidBar: sanitizeColor(c.solidBar as string, DEFAULT_CHART_COLORS.solidBar),
    hatchedBar: sanitizeColor(c.hatchedBar as string, DEFAULT_CHART_COLORS.hatchedBar),
    todayLine: sanitizeColor(c.todayLine as string, DEFAULT_CHART_COLORS.todayLine),
    finishDateLine: sanitizeColor(c.finishDateLine as string, DEFAULT_CHART_COLORS.finishDateLine),
    mostLikelyLine: sanitizeColor(c.mostLikelyLine as string, DEFAULT_CHART_COLORS.mostLikelyLine),
    completedBar: sanitizeColor(c.completedBar as string, DEFAULT_CHART_COLORS.completedBar)
  };
}

/**
 * Sanitize display settings from untrusted data
 */
export function sanitizeDisplaySettings(settings: unknown): ChartDisplaySettings {
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
 * Sanitize a single release from untrusted data
 * Returns null if the release is invalid
 */
export function sanitizeRelease(rel: unknown): Release | null {
  if (!rel || typeof rel !== 'object') return null;

  const r = rel as Record<string, unknown>;
  if (
    typeof r.id !== 'string' ||
    typeof r.projectId !== 'string' ||
    typeof r.name !== 'string' ||
    typeof r.startDate !== 'string' ||
    typeof r.earlyFinishDate !== 'string' ||
    typeof r.lateFinishDate !== 'string' ||
    !isValidDateFormat(r.startDate) ||
    !isValidDateFormat(r.earlyFinishDate) ||
    !isValidDateFormat(r.lateFinishDate)
  ) {
    return null;
  }

  const sanitized: Release = {
    id: sanitizeId(r.id),
    projectId: sanitizeId(r.projectId),
    name: sanitizeString(r.name),
    startDate: r.startDate,
    earlyFinishDate: r.earlyFinishDate,
    lateFinishDate: r.lateFinishDate,
    ...(typeof r.hidden === 'boolean' ? { hidden: r.hidden } : {}),
    ...(typeof r.completed === 'boolean' ? { completed: r.completed } : {}),
    ...(typeof r.mostLikelyFinishDate === 'string' && isValidDateFormat(r.mostLikelyFinishDate)
      ? { mostLikelyFinishDate: r.mostLikelyFinishDate }
      : {})
  };

  if (!sanitized.id || !sanitized.projectId || !sanitized.name) {
    return null;
  }

  // Cross-field validation: mostLikelyFinishDate must be between early and late
  if (sanitized.mostLikelyFinishDate) {
    const earlyMs = parseDateLocal(sanitized.earlyFinishDate);
    const lateMs = parseDateLocal(sanitized.lateFinishDate);
    const mlMs = parseDateLocal(sanitized.mostLikelyFinishDate);
    if (mlMs < earlyMs || mlMs > lateMs) {
      delete sanitized.mostLikelyFinishDate;
    }
  }

  return sanitized;
}

/**
 * Sanitize legend labels from untrusted data
 */
export function sanitizeLegendLabels(labels: unknown): { solidBar: string; hatchedBar: string; finishDateLine?: string; mostLikelyLine?: string } {
  if (!labels || typeof labels !== 'object') {
    return { solidBar: 'Design, Code, Test', hatchedBar: 'Delivery Uncertainty' };
  }
  const l = labels as Record<string, unknown>;
  const result: { solidBar: string; hatchedBar: string; finishDateLine?: string; mostLikelyLine?: string } = {
    solidBar: typeof l.solidBar === 'string' ? sanitizeString(l.solidBar, 50) : 'Design, Code, Test',
    hatchedBar: typeof l.hatchedBar === 'string' ? sanitizeString(l.hatchedBar, 50) : 'Delivery Uncertainty'
  };
  if (typeof l.finishDateLine === 'string') {
    result.finishDateLine = sanitizeString(l.finishDateLine, 50);
  }
  if (typeof l.mostLikelyLine === 'string') {
    result.mostLikelyLine = sanitizeString(l.mostLikelyLine, 50);
  }
  return result;
}

/**
 * Get user-friendly error message for Most Likely Finish Date validation
 * Returns empty string if valid or if the field is empty (optional field)
 */
export function getMostLikelyDateError(
  earlyFinish: string,
  lateFinish: string,
  mostLikely: string
): string {
  if (!mostLikely) return '';  // Optional field, empty is OK

  if (!isValidDateFormat(mostLikely)) {
    if (mostLikely.length === 10) {
      return 'Date must be between 2000 and 2050';
    }
    return '';  // Still typing
  }

  if (isValidDateFormat(earlyFinish) && isValidDateFormat(lateFinish)) {
    const earlyMs = parseDateLocal(earlyFinish);
    const lateMs = parseDateLocal(lateFinish);
    const mlMs = parseDateLocal(mostLikely);
    if (mlMs < earlyMs) return 'Must be on or after the Early Finish Date';
    if (mlMs > lateMs) return 'Must be on or before the Late Finish Date';
  }

  return '';
}
