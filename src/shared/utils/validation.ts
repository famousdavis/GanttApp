// Validation utilities for GanttApp

import { parseDateLocal } from './dates';

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
