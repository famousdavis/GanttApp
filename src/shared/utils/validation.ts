// Validation utilities for GanttApp

/**
 * Check if a date string is in valid YYYY-MM-DD format
 */
export function isValidDateFormat(dateStr: string): boolean {
  if (!dateStr || dateStr.length !== 10) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
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

  // Check date logic
  const start = new Date(startDate);
  const early = new Date(earlyFinish);
  const late = new Date(lateFinish);

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
  // Check start vs early only when earlyFinish field has been touched AND both dates are complete
  if (touchedFields.earlyFinish && isValidDateFormat(startDate) && isValidDateFormat(earlyFinish)) {
    const start = new Date(startDate);
    const early = new Date(earlyFinish);

    if (start >= early) {
      return 'Start date must be before the Early finish date';
    }
  }

  // Check early vs late only when lateFinish field has been touched AND both dates are complete
  if (touchedFields.lateFinish && isValidDateFormat(earlyFinish) && isValidDateFormat(lateFinish)) {
    const early = new Date(earlyFinish);
    const late = new Date(lateFinish);

    if (early > late) {
      return 'Early finish date must be before or equal to the Late finish date';
    }
  }

  return '';
}
