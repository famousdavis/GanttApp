// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { isValidDateFormat, isProjectNameValid, isReleaseValid, getDateErrorMessage, getMostLikelyDateError, sanitizeRelease, sanitizeChartColors, sanitizeLegendLabels, validateReleaseDateChange, sanitizeFirebaseError, sanitizeWorkDays, getEffectiveWorkDays, getWorkDayWarning, getDateWarnings } from '../validation';
import type { Project } from '../../types/models';

describe('isValidDateFormat', () => {
  it('accepts valid dates within 2000-2050 range', () => {
    expect(isValidDateFormat('2000-01-01')).toBe(true);
    expect(isValidDateFormat('2026-01-29')).toBe(true);
    expect(isValidDateFormat('2050-12-31')).toBe(true);
    expect(isValidDateFormat('2025-06-15')).toBe(true);
  });

  it('rejects dates outside the 2000-2050 range', () => {
    expect(isValidDateFormat('1999-12-31')).toBe(false);
    expect(isValidDateFormat('2051-01-01')).toBe(false);
    expect(isValidDateFormat('1900-01-01')).toBe(false);
    expect(isValidDateFormat('2100-06-15')).toBe(false);
  });

  it('rejects invalid date string formats', () => {
    expect(isValidDateFormat('01/29/2026')).toBe(false);
    expect(isValidDateFormat('2026/01/29')).toBe(false);
    expect(isValidDateFormat('2026-1-29')).toBe(false);
    expect(isValidDateFormat('2026-01-9')).toBe(false);
    expect(isValidDateFormat('26-01-29')).toBe(false);
    expect(isValidDateFormat('20260-01-29')).toBe(false);
  });

  it('rejects empty and null-like inputs', () => {
    expect(isValidDateFormat('')).toBe(false);
    expect(isValidDateFormat(null as unknown as string)).toBe(false);
    expect(isValidDateFormat(undefined as unknown as string)).toBe(false);
  });

  it('rejects strings with extra whitespace', () => {
    expect(isValidDateFormat(' 2026-01-29')).toBe(false);
    expect(isValidDateFormat('2026-01-29 ')).toBe(false);
    expect(isValidDateFormat(' 2026-01-29 ')).toBe(false);
  });

  it('rejects strings with wrong length but valid pattern', () => {
    expect(isValidDateFormat('2026-01-290')).toBe(false);
  });

  it('rejects invalid calendar dates that match the format pattern', () => {
    expect(isValidDateFormat('2026-13-01')).toBe(false); // Month 13
    expect(isValidDateFormat('2026-01-32')).toBe(false); // Day 32
    expect(isValidDateFormat('2026-02-30')).toBe(false); // Feb 30
    expect(isValidDateFormat('2026-02-29')).toBe(false); // Feb 29 in non-leap year
    expect(isValidDateFormat('2026-04-31')).toBe(false); // April 31
    expect(isValidDateFormat('2026-00-15')).toBe(false); // Month 0
    expect(isValidDateFormat('2026-01-00')).toBe(false); // Day 0
  });

  it('accepts valid leap year date', () => {
    expect(isValidDateFormat('2024-02-29')).toBe(true); // 2024 is a leap year
    expect(isValidDateFormat('2000-02-29')).toBe(true); // 2000 is a leap year
  });

  it('handles boundary dates correctly', () => {
    expect(isValidDateFormat('2000-01-01')).toBe(true);
    expect(isValidDateFormat('2050-12-31')).toBe(true);
  });
});

describe('isProjectNameValid', () => {
  it('accepts non-empty names', () => {
    expect(isProjectNameValid('My Project')).toBe(true);
    expect(isProjectNameValid('a')).toBe(true);
    expect(isProjectNameValid('Project with spaces')).toBe(true);
  });

  it('rejects empty strings', () => {
    expect(isProjectNameValid('')).toBe(false);
  });

  it('rejects whitespace-only strings', () => {
    expect(isProjectNameValid(' ')).toBe(false);
    expect(isProjectNameValid('   ')).toBe(false);
    expect(isProjectNameValid('\t')).toBe(false);
    expect(isProjectNameValid('\n')).toBe(false);
  });

  it('accepts names with leading/trailing whitespace if content exists', () => {
    expect(isProjectNameValid('  Project  ')).toBe(true);
    expect(isProjectNameValid(' a ')).toBe(true);
  });
});

describe('isReleaseValid', () => {
  it('accepts valid release data with correct date ordering', () => {
    expect(isReleaseValid('v1.0', '2026-01-01', '2026-02-01', '2026-03-01')).toBe(true);
  });

  it('rejects empty release name', () => {
    expect(isReleaseValid('', '2026-01-01', '2026-02-01', '2026-03-01')).toBe(false);
  });

  it('rejects whitespace-only release name', () => {
    expect(isReleaseValid('   ', '2026-01-01', '2026-02-01', '2026-03-01')).toBe(false);
  });

  it('rejects missing start date', () => {
    expect(isReleaseValid('v1.0', '', '2026-02-01', '2026-03-01')).toBe(false);
  });

  it('rejects missing early finish date', () => {
    expect(isReleaseValid('v1.0', '2026-01-01', '', '2026-03-01')).toBe(false);
  });

  it('rejects missing late finish date', () => {
    expect(isReleaseValid('v1.0', '2026-01-01', '2026-02-01', '')).toBe(false);
  });

  it('rejects when start date equals early finish date', () => {
    expect(isReleaseValid('v1.0', '2026-01-01', '2026-01-01', '2026-03-01')).toBe(false);
  });

  it('rejects when start date is after early finish date', () => {
    expect(isReleaseValid('v1.0', '2026-03-01', '2026-01-01', '2026-04-01')).toBe(false);
  });

  it('rejects when early finish is after late finish', () => {
    expect(isReleaseValid('v1.0', '2026-01-01', '2026-04-01', '2026-03-01')).toBe(false);
  });

  it('accepts when early finish equals late finish (zero uncertainty)', () => {
    expect(isReleaseValid('v1.0', '2026-01-01', '2026-02-01', '2026-02-01')).toBe(true);
  });

  it('accepts valid release with trimmed name', () => {
    expect(isReleaseValid('  v1.0  ', '2026-01-01', '2026-02-01', '2026-03-01')).toBe(true);
  });
});

describe('getDateErrorMessage', () => {
  const allTouched = { startDate: true, earlyFinish: true, lateFinish: true };
  const noneTouched = { startDate: false, earlyFinish: false, lateFinish: false };

  it('returns empty string when no fields are touched', () => {
    expect(getDateErrorMessage('2026-01-01', '2026-02-01', '2026-03-01', noneTouched)).toBe('');
  });

  it('returns empty string when all dates are valid', () => {
    expect(getDateErrorMessage('2026-01-01', '2026-02-01', '2026-03-01', allTouched)).toBe('');
  });

  it('returns error for start date out of range', () => {
    const msg = getDateErrorMessage('1999-01-01', '2026-02-01', '2026-03-01', allTouched);
    expect(msg).toBe('Date must be between 2000 and 2050');
  });

  it('returns error for early finish date out of range', () => {
    const msg = getDateErrorMessage('2026-01-01', '2051-02-01', '2026-03-01', allTouched);
    expect(msg).toBe('Date must be between 2000 and 2050');
  });

  it('returns error for late finish date out of range', () => {
    const msg = getDateErrorMessage('2026-01-01', '2026-02-01', '2051-03-01', allTouched);
    expect(msg).toBe('Date must be between 2000 and 2050');
  });

  it('returns error when start date >= early finish', () => {
    const msg = getDateErrorMessage('2026-03-01', '2026-02-01', '2026-04-01', allTouched);
    expect(msg).toBe('Start date must be before the Early finish date');
  });

  it('returns error when start date equals early finish', () => {
    const msg = getDateErrorMessage('2026-02-01', '2026-02-01', '2026-04-01', allTouched);
    expect(msg).toBe('Start date must be before the Early finish date');
  });

  it('returns error when early finish > late finish', () => {
    const msg = getDateErrorMessage('2026-01-01', '2026-04-01', '2026-03-01', allTouched);
    expect(msg).toBe('Early finish date must be before or equal to the Late finish date');
  });

  it('does not check start vs early when earlyFinish is not touched', () => {
    const touched = { startDate: true, earlyFinish: false, lateFinish: true };
    const msg = getDateErrorMessage('2026-03-01', '2026-02-01', '2026-04-01', touched);
    expect(msg).toBe('');
  });

  it('does not check early vs late when lateFinish is not touched', () => {
    const touched = { startDate: true, earlyFinish: true, lateFinish: false };
    const msg = getDateErrorMessage('2026-01-01', '2026-04-01', '2026-03-01', touched);
    expect(msg).toBe('');
  });

  it('returns empty string for incomplete dates even when touched', () => {
    const msg = getDateErrorMessage('2026-01', '2026-02-01', '2026-03-01', allTouched);
    expect(msg).toBe('');
  });

  it('prioritizes range errors over ordering errors', () => {
    // Start date out of range should be caught before start vs early check
    const msg = getDateErrorMessage('1999-01-01', '2026-02-01', '2026-03-01', allTouched);
    expect(msg).toBe('Date must be between 2000 and 2050');
  });
});

describe('getMostLikelyDateError', () => {
  it('returns empty string when mostLikely is empty (optional field)', () => {
    expect(getMostLikelyDateError('2026-01-01', '2026-03-01', '')).toBe('');
  });

  it('returns empty string when mostLikely is valid and within range', () => {
    expect(getMostLikelyDateError('2026-01-01', '2026-03-01', '2026-02-01')).toBe('');
  });

  it('returns error when mostLikely is before early finish', () => {
    expect(getMostLikelyDateError('2026-02-01', '2026-04-01', '2026-01-15')).toBe('Must be on or after the Early Finish Date');
  });

  it('returns error when mostLikely is after late finish', () => {
    expect(getMostLikelyDateError('2026-02-01', '2026-04-01', '2026-05-01')).toBe('Must be on or before the Late Finish Date');
  });

  it('accepts mostLikely equal to early finish', () => {
    expect(getMostLikelyDateError('2026-02-01', '2026-04-01', '2026-02-01')).toBe('');
  });

  it('accepts mostLikely equal to late finish', () => {
    expect(getMostLikelyDateError('2026-02-01', '2026-04-01', '2026-04-01')).toBe('');
  });

  it('returns range error for out-of-range date', () => {
    expect(getMostLikelyDateError('2026-02-01', '2026-04-01', '1999-01-01')).toBe('Date must be between 2000 and 2050');
  });

  it('returns empty for partial input (still typing)', () => {
    expect(getMostLikelyDateError('2026-02-01', '2026-04-01', '2026-02')).toBe('');
  });
});

describe('sanitizeRelease - mostLikelyFinishDate', () => {
  const validRelease = {
    id: 'r1',
    projectId: 'p1',
    name: 'Release 1',
    startDate: '2026-01-01',
    earlyFinishDate: '2026-02-01',
    lateFinishDate: '2026-04-01'
  };

  it('includes valid mostLikelyFinishDate in result', () => {
    const result = sanitizeRelease({ ...validRelease, mostLikelyFinishDate: '2026-03-01' });
    expect(result).not.toBeNull();
    expect(result!.mostLikelyFinishDate).toBe('2026-03-01');
  });

  it('drops mostLikelyFinishDate that is before earlyFinishDate', () => {
    const result = sanitizeRelease({ ...validRelease, mostLikelyFinishDate: '2026-01-15' });
    expect(result).not.toBeNull();
    expect(result!.mostLikelyFinishDate).toBeUndefined();
  });

  it('drops mostLikelyFinishDate that is after lateFinishDate', () => {
    const result = sanitizeRelease({ ...validRelease, mostLikelyFinishDate: '2026-05-01' });
    expect(result).not.toBeNull();
    expect(result!.mostLikelyFinishDate).toBeUndefined();
  });

  it('omits mostLikelyFinishDate when not provided', () => {
    const result = sanitizeRelease(validRelease);
    expect(result).not.toBeNull();
    expect(result!.mostLikelyFinishDate).toBeUndefined();
  });
});

describe('sanitizeChartColors - mostLikelyLine', () => {
  it('includes mostLikelyLine from valid input', () => {
    const result = sanitizeChartColors({
      solidBar: '#ff0000',
      hatchedBar: '#00ff00',
      todayLine: '#0000ff',
      finishDateLine: '#ffff00',
      mostLikelyLine: '#dc2626'
    });
    expect(result.mostLikelyLine).toBe('#dc2626');
  });

  it('falls back to default when mostLikelyLine is missing', () => {
    const result = sanitizeChartColors({
      solidBar: '#ff0000',
      hatchedBar: '#00ff00',
      todayLine: '#0000ff',
      finishDateLine: '#ffff00'
    });
    expect(result.mostLikelyLine).toBe('#0070f3');
  });
});

describe('sanitizeChartColors - completedBar', () => {
  it('includes completedBar from valid input', () => {
    const result = sanitizeChartColors({
      solidBar: '#ff0000', hatchedBar: '#00ff00', todayLine: '#0000ff',
      finishDateLine: '#ffff00', mostLikelyLine: '#dc2626', completedBar: '#90ee90'
    });
    expect(result.completedBar).toBe('#90ee90');
  });

  it('falls back to default when completedBar is missing', () => {
    const result = sanitizeChartColors({
      solidBar: '#ff0000', hatchedBar: '#00ff00', todayLine: '#0000ff',
      finishDateLine: '#ffff00', mostLikelyLine: '#dc2626'
    });
    expect(result.completedBar).toBe('#90ee90');
  });

  it('falls back to default when completedBar is invalid', () => {
    const result = sanitizeChartColors({
      solidBar: '#ff0000', hatchedBar: '#00ff00', todayLine: '#0000ff',
      finishDateLine: '#ffff00', mostLikelyLine: '#dc2626', completedBar: 'not-a-color'
    });
    expect(result.completedBar).toBe('#90ee90');
  });
});

describe('sanitizeLegendLabels - mostLikelyLine', () => {
  it('includes mostLikelyLine label from valid input', () => {
    const result = sanitizeLegendLabels({
      solidBar: 'Solid',
      hatchedBar: 'Hatched',
      mostLikelyLine: 'Best Estimate'
    });
    expect(result.mostLikelyLine).toBe('Best Estimate');
  });

  it('omits mostLikelyLine when not provided', () => {
    const result = sanitizeLegendLabels({
      solidBar: 'Solid',
      hatchedBar: 'Hatched'
    });
    expect(result.mostLikelyLine).toBeUndefined();
  });
});

describe('validateReleaseDateChange', () => {
  const baseRelease = {
    startDate: '2026-01-01',
    earlyFinishDate: '2026-02-01',
    lateFinishDate: '2026-03-01'
  };

  it('returns empty string for valid start date change', () => {
    expect(validateReleaseDateChange(baseRelease, 'start', '2025-12-15')).toBe('');
  });

  it('returns error when start >= early', () => {
    expect(validateReleaseDateChange(baseRelease, 'start', '2026-02-01')).toBe('Start must be before Early Finish');
    expect(validateReleaseDateChange(baseRelease, 'start', '2026-03-01')).toBe('Start must be before Early Finish');
  });

  it('returns empty string for valid early date change', () => {
    expect(validateReleaseDateChange(baseRelease, 'early', '2026-01-15')).toBe('');
  });

  it('returns error when early > late', () => {
    expect(validateReleaseDateChange(baseRelease, 'early', '2026-04-01')).toBe('Early Finish must be <= Late Finish');
  });

  it('returns empty string for valid late date change', () => {
    expect(validateReleaseDateChange(baseRelease, 'late', '2026-04-01')).toBe('');
  });

  it('returns error when late < early', () => {
    expect(validateReleaseDateChange(baseRelease, 'late', '2026-01-15')).toBe('Early Finish must be <= Late Finish');
  });

  it('returns empty string for valid mostLikely date', () => {
    expect(validateReleaseDateChange(baseRelease, 'mostLikely', '2026-02-15')).toBe('');
    // Boundary: equal to early
    expect(validateReleaseDateChange(baseRelease, 'mostLikely', '2026-02-01')).toBe('');
    // Boundary: equal to late
    expect(validateReleaseDateChange(baseRelease, 'mostLikely', '2026-03-01')).toBe('');
  });

  it('returns error when mostLikely < early', () => {
    expect(validateReleaseDateChange(baseRelease, 'mostLikely', '2026-01-15')).toBe('Must be >= Early Finish');
  });

  it('returns error when mostLikely > late', () => {
    expect(validateReleaseDateChange(baseRelease, 'mostLikely', '2026-04-01')).toBe('Must be <= Late Finish');
  });

  it('returns error for invalid date format', () => {
    expect(validateReleaseDateChange(baseRelease, 'start', 'not-a-date')).toBe('Invalid date format');
    expect(validateReleaseDateChange(baseRelease, 'mostLikely', '2099-01-01')).toBe('Invalid date format');
  });
});

// --- sanitizeFirebaseError (v12.2) ---

describe('sanitizeFirebaseError', () => {
  it('returns generic message for non-Error values', () => {
    expect(sanitizeFirebaseError(null)).toBe('An unexpected error occurred.');
    expect(sanitizeFirebaseError('string error')).toBe('An unexpected error occurred.');
    expect(sanitizeFirebaseError(42)).toBe('An unexpected error occurred.');
    expect(sanitizeFirebaseError(undefined)).toBe('An unexpected error occurred.');
  });

  it('passes through plain Error message (no code = app-level error)', () => {
    const err = new Error('Firebase is not configured. Cloud features are unavailable.');
    expect(sanitizeFirebaseError(err)).toBe('Firebase is not configured. Cloud features are unavailable.');
  });

  it('maps permission-denied to friendly message', () => {
    const err = Object.assign(new Error('PERMISSION_DENIED: Missing or insufficient permissions'), { code: 'permission-denied' });
    expect(sanitizeFirebaseError(err)).toBe('Permission denied. Please check your account access.');
  });

  it('maps auth/popup-closed-by-user to friendly message', () => {
    const err = Object.assign(new Error('Firebase: Error (auth/popup-closed-by-user).'), { code: 'auth/popup-closed-by-user' });
    expect(sanitizeFirebaseError(err)).toBe('Sign-in was cancelled.');
  });

  it('maps unavailable to friendly message', () => {
    const err = Object.assign(new Error('The service is currently unavailable'), { code: 'unavailable' });
    expect(sanitizeFirebaseError(err)).toBe('Service temporarily unavailable. Please try again later.');
  });

  it('returns generic message for unknown Firebase error codes', () => {
    const err = Object.assign(new Error('Some internal Firebase error details'), { code: 'unknown/internal-error' });
    expect(sanitizeFirebaseError(err)).toBe('An error occurred. Please try again.');
  });
});

// --- Work-week validation (v15.0) ---

describe('sanitizeWorkDays', () => {
  it('accepts a valid array of day indices', () => {
    expect(sanitizeWorkDays([1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4, 5]);
  });

  it('sorts the result ascending', () => {
    expect(sanitizeWorkDays([5, 1, 3, 2, 4])).toEqual([1, 2, 3, 4, 5]);
  });

  it('dedupes the result', () => {
    expect(sanitizeWorkDays([1, 1, 2, 2, 3])).toEqual([1, 2, 3]);
  });

  it('filters out non-integers', () => {
    expect(sanitizeWorkDays([1, 2.5, 3, NaN])).toEqual([1, 3]);
  });

  it('filters out out-of-range values', () => {
    expect(sanitizeWorkDays([-1, 0, 6, 7, 8])).toEqual([0, 6]);
  });

  it('returns undefined for non-arrays', () => {
    expect(sanitizeWorkDays(null)).toBeUndefined();
    expect(sanitizeWorkDays(undefined)).toBeUndefined();
    expect(sanitizeWorkDays({})).toBeUndefined();
    expect(sanitizeWorkDays('1,2,3')).toBeUndefined();
  });

  it('returns undefined for empty array', () => {
    expect(sanitizeWorkDays([])).toBeUndefined();
  });

  it('returns undefined for arrays with >7 items after dedup', () => {
    // 8 distinct valid values — impossible, only 0-6 exist (7 max)
    // Test with 7 valid + 1 out-of-range: filter leaves 7, which is OK
    expect(sanitizeWorkDays([0, 1, 2, 3, 4, 5, 6])).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('returns undefined when all values get filtered out', () => {
    expect(sanitizeWorkDays([-1, 7, 'foo'])).toBeUndefined();
  });
});

describe('getEffectiveWorkDays', () => {
  it('returns project override when set', () => {
    const project: Project = { id: '1', name: 'P', workDays: [1, 2, 3] };
    expect(getEffectiveWorkDays(project, [1, 2, 3, 4, 5])).toEqual([1, 2, 3]);
  });

  it('falls back to global when project override is undefined', () => {
    const project: Project = { id: '1', name: 'P' };
    expect(getEffectiveWorkDays(project, [1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4, 5]);
  });

  it('falls back to global when project override is empty array', () => {
    const project: Project = { id: '1', name: 'P', workDays: [] };
    expect(getEffectiveWorkDays(project, [0, 6])).toEqual([0, 6]);
  });

  it('returns undefined when both are undefined', () => {
    expect(getEffectiveWorkDays(undefined, undefined)).toBeUndefined();
  });

  it('returns undefined when project is undefined and global is empty', () => {
    expect(getEffectiveWorkDays(undefined, [])).toBeUndefined();
  });
});

describe('getWorkDayWarning', () => {
  it('returns empty string when workDays is undefined', () => {
    expect(getWorkDayWarning('2026-06-13', undefined)).toBe('');
  });

  it('returns empty string when workDays is empty', () => {
    expect(getWorkDayWarning('2026-06-13', [])).toBe('');
  });

  it('returns empty string for a workday', () => {
    // 2026-06-15 = Monday
    expect(getWorkDayWarning('2026-06-15', [1, 2, 3, 4, 5])).toBe('');
  });

  it('returns a warning string for a non-workday', () => {
    // 2026-06-13 = Saturday
    const result = getWorkDayWarning('2026-06-13', [1, 2, 3, 4, 5]);
    expect(result).toContain('Saturday');
    expect(result).toContain('outside your work week');
  });

  it('names the correct day for each day of week', () => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    // 2026-06-07 = Sunday through 2026-06-13 = Saturday
    for (let d = 7; d <= 13; d++) {
      const dateStr = `2026-06-${String(d).padStart(2, '0')}`;
      const result = getWorkDayWarning(dateStr, []); // empty = opt-out
      expect(result).toBe(''); // empty workDays always returns ''
    }
    // With workDays excluding weekends
    for (let d = 7; d <= 13; d++) {
      const dateStr = `2026-06-${String(d).padStart(2, '0')}`;
      const dow = d - 7; // 0=Sun through 6=Sat
      const result = getWorkDayWarning(dateStr, [1, 2, 3, 4, 5]);
      if (dow >= 1 && dow <= 5) {
        expect(result).toBe('');
      } else {
        expect(result).toContain(dayNames[dow]);
      }
    }
  });
});

describe('getDateWarnings', () => {
  const monFri = [1, 2, 3, 4, 5];
  // 2026-06-13 = Saturday, 2026-06-17 = Wednesday, 2026-06-20 = Saturday
  const sat = '2026-06-13';
  const wed = '2026-06-17';
  const sat2 = '2026-06-20';

  it('returns all empty when workDays is undefined', () => {
    expect(getDateWarnings(sat, wed, sat2, '', undefined)).toEqual({
      startDate: '', earlyFinish: '', lateFinish: '', mostLikely: '',
    });
  });

  it('emits warnings for any valid non-workday date regardless of touched state', () => {
    const result = getDateWarnings(sat, wed, sat2, '', monFri);
    expect(result.startDate).toContain('Saturday');
    expect(result.earlyFinish).toBe(''); // Wednesday is a workday
    expect(result.lateFinish).toContain('Saturday');
    expect(result.mostLikely).toBe(''); // empty date
  });

  it('does NOT emit a warning when dateStr fails isValidDateFormat', () => {
    // Partial / invalid input should produce '', confirming isValidDateFormat gate works
    const result = getDateWarnings('2026-06', '', '2026-13-01', 'not-a-date', monFri);
    expect(result.startDate).toBe('');
    expect(result.earlyFinish).toBe('');
    expect(result.lateFinish).toBe('');
    expect(result.mostLikely).toBe('');
  });

  it('emits per-field warnings independently', () => {
    const result = getDateWarnings(sat, wed, sat2, wed, monFri);
    expect(result.startDate).toContain('Saturday');
    expect(result.earlyFinish).toBe('');
    expect(result.lateFinish).toContain('Saturday');
    expect(result.mostLikely).toBe(''); // Wednesday is a workday
  });

  it('emits warning for mostLikely when it is a non-workday', () => {
    const result = getDateWarnings(wed, wed, sat2, sat, monFri);
    expect(result.mostLikely).toContain('Saturday');
  });

  it('skips warnings when the date is invalid (length !== 10)', () => {
    const result = getDateWarnings('2026-06', wed, sat2, '', monFri);
    expect(result.startDate).toBe('');
  });
});
