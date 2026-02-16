import { describe, it, expect } from 'vitest';
import { isValidDateFormat, isProjectNameValid, isReleaseValid, getDateErrorMessage, getMostLikelyDateError, sanitizeRelease, sanitizeChartColors, sanitizeLegendLabels, validateReleaseDateChange } from '../validation';

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
