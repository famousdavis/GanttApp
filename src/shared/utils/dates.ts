// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Date utility functions for GanttApp

/**
 * Parse a date string (YYYY-MM-DD) in local timezone
 * Returns the timestamp in milliseconds
 */
export function parseDateLocal(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).getTime();
}

/**
 * Format a date string (YYYY-MM-DD) to short format (e.g., "Jan 15")
 */
export function formatDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format a date string (YYYY-MM-DD) to long format (e.g., "January 15, 2026")
 */
export function formatDateLong(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Format a date string (YYYY-MM-DD) to MM/DD/YYYY format
 */
export function formatDateMDY(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
}

/**
 * Format a date string (YYYY-MM-DD) to browser's default locale format
 * e.g., "1/15/2026" in en-US locale
 */
export function formatDateLocale(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString();
}

/**
 * Get today's date as YYYY-MM-DD string
 */
export function getTodayString(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

/**
 * Get today's date formatted as long text (e.g., "January 15, 2026")
 */
export function getTodayFormatted(): string {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Generate a unique ID using timestamp + random suffix to prevent collisions
 */
let idCounter = 0;
export function generateId(): string {
  idCounter += 1;
  return `${Date.now()}-${idCounter}-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Format a timestamp (milliseconds) to ISO date string (YYYY-MM-DD)
 */
export function formatDateISO(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Check whether a date (YYYY-MM-DD) falls on one of the configured work days.
 * Returns true for invalid/empty inputs or an empty workDays array (feature's opt-out semantics),
 * so this function never double-reports format errors already surfaced by isValidDateFormat.
 * @param dateStr ISO date string
 * @param workDays Array of day-of-week indices (0=Sun ... 6=Sat)
 */
export function isWorkDay(dateStr: string, workDays: number[]): boolean {
  // Opt-out: no workDays configured
  if (!workDays || workDays.length === 0) return true;
  // Lightweight format guard (inlined to avoid a circular import from validation.ts)
  if (!dateStr || dateStr.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return true;
  const dow = new Date(parseDateLocal(dateStr)).getDay();
  return workDays.includes(dow);
}

/**
 * Calculate quarter boundaries for a date range
 * Returns array of Date objects representing quarter starts (Jan 1, Apr 1, Jul 1, Oct 1)
 */
export function getQuarterBoundaries(minDate: number, maxDate: number): Date[] {
  const boundaries: Date[] = [];
  const startYear = new Date(minDate).getFullYear();
  const endYear = new Date(maxDate).getFullYear();

  for (let year = startYear; year <= endYear; year++) {
    [0, 3, 6, 9].forEach(month => {
      const date = new Date(year, month, 1);
      const time = date.getTime();
      if (time >= minDate && time <= maxDate) {
        boundaries.push(date);
      }
    });
  }

  return boundaries;
}

/**
 * Calculate month boundaries for a date range
 * Returns array of Date objects representing the 1st of each month within range
 */
export function getMonthBoundaries(minDate: number, maxDate: number): Date[] {
  const boundaries: Date[] = [];
  const startYear = new Date(minDate).getFullYear();
  const startMonth = new Date(minDate).getMonth();
  const endYear = new Date(maxDate).getFullYear();
  const endMonth = new Date(maxDate).getMonth();

  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const date = new Date(year, month, 1);
    const time = date.getTime();
    if (time >= minDate && time <= maxDate) {
      boundaries.push(date);
    }
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }

  return boundaries;
}
