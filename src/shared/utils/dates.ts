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
