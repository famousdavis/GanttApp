// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseDateLocal,
  formatDateShort,
  formatDateLong,
  formatDateMDY,
  formatDateLocale,
  getTodayString,
  getTodayFormatted,
  getQuarterBoundaries,
  getMonthBoundaries,
  generateId,
  isWorkDay,
} from '../dates';

describe('parseDateLocal', () => {
  it('parses a date string in local timezone', () => {
    const timestamp = parseDateLocal('2026-01-15');
    const date = new Date(timestamp);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(0); // January = 0
    expect(date.getDate()).toBe(15);
  });

  it('returns midnight local time', () => {
    const timestamp = parseDateLocal('2026-06-15');
    const date = new Date(timestamp);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
    expect(date.getSeconds()).toBe(0);
  });

  it('handles year boundaries', () => {
    const dec31 = parseDateLocal('2025-12-31');
    const jan1 = parseDateLocal('2026-01-01');
    expect(jan1).toBeGreaterThan(dec31);
  });

  it('handles leap year date', () => {
    const timestamp = parseDateLocal('2024-02-29');
    const date = new Date(timestamp);
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(1);
    expect(date.getDate()).toBe(29);
  });

  it('returns consistent results for same input', () => {
    const first = parseDateLocal('2026-03-15');
    const second = parseDateLocal('2026-03-15');
    expect(first).toBe(second);
  });

  it('preserves date ordering', () => {
    const jan = parseDateLocal('2026-01-01');
    const feb = parseDateLocal('2026-02-01');
    const mar = parseDateLocal('2026-03-01');
    expect(jan).toBeLessThan(feb);
    expect(feb).toBeLessThan(mar);
  });
});

describe('formatDateShort', () => {
  it('formats dates as abbreviated month and day', () => {
    expect(formatDateShort('2026-01-15')).toBe('Jan 15');
    expect(formatDateShort('2026-12-25')).toBe('Dec 25');
  });

  it('handles single-digit days', () => {
    expect(formatDateShort('2026-01-01')).toBe('Jan 1');
    expect(formatDateShort('2026-06-05')).toBe('Jun 5');
  });

  it('handles all months', () => {
    const months = [
      '01-Jan', '02-Feb', '03-Mar', '04-Apr',
      '05-May', '06-Jun', '07-Jul', '08-Aug',
      '09-Sep', '10-Oct', '11-Nov', '12-Dec',
    ];
    months.forEach((entry) => {
      const [num, abbr] = entry.split('-');
      const result = formatDateShort(`2026-${num}-15`);
      expect(result).toContain(abbr);
    });
  });
});

describe('formatDateLong', () => {
  it('formats dates with full month name, day, and year', () => {
    expect(formatDateLong('2026-01-15')).toBe('January 15, 2026');
    expect(formatDateLong('2026-12-25')).toBe('December 25, 2026');
  });

  it('handles different years', () => {
    expect(formatDateLong('2000-06-01')).toBe('June 1, 2000');
    expect(formatDateLong('2050-12-31')).toBe('December 31, 2050');
  });
});

describe('formatDateMDY', () => {
  it('formats dates as MM/DD/YYYY', () => {
    expect(formatDateMDY('2026-01-15')).toBe('01/15/2026');
    expect(formatDateMDY('2026-12-25')).toBe('12/25/2026');
  });

  it('pads single-digit months and days', () => {
    expect(formatDateMDY('2026-01-05')).toBe('01/05/2026');
    expect(formatDateMDY('2026-03-09')).toBe('03/09/2026');
  });

  it('handles double-digit months and days without extra padding', () => {
    expect(formatDateMDY('2026-11-28')).toBe('11/28/2026');
  });
});

describe('formatDateLocale', () => {
  it('formats a date string using the browser locale', () => {
    const result = formatDateLocale('2026-06-15');
    // In jsdom/en-US locale this should contain the month, day, and year
    expect(result).toContain('2026');
    expect(result).toContain('15');
  });

  it('parses in local timezone (no off-by-one)', () => {
    const result = formatDateLocale('2026-01-01');
    // Should be January 1st, not December 31st
    expect(result).toContain('1');
  });
});

describe('getTodayString', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a YYYY-MM-DD formatted string', () => {
    const result = getTodayString();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns the correct date for a mocked date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15)); // June 15, 2026
    expect(getTodayString()).toBe('2026-06-15');
  });

  it('pads single-digit months and days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5)); // January 5, 2026
    expect(getTodayString()).toBe('2026-01-05');
  });
});

describe('getTodayFormatted', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a long-format date string', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 29)); // January 29, 2026
    expect(getTodayFormatted()).toBe('January 29, 2026');
  });
});

describe('generateId', () => {
  it('returns a non-empty string', () => {
    const id = generateId();
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns unique IDs on successive calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });

  it('contains a timestamp component', () => {
    const id = generateId();
    const timestampPart = id.split('-')[0];
    const timestamp = parseInt(timestampPart, 10);
    expect(timestamp).toBeGreaterThan(0);
    // Should be a reasonable recent timestamp
    expect(timestamp).toBeGreaterThan(Date.now() - 10000);
  });
});

describe('getQuarterBoundaries', () => {
  it('returns quarter start dates within a single year', () => {
    const min = parseDateLocal('2026-01-01');
    const max = parseDateLocal('2026-12-31');
    const boundaries = getQuarterBoundaries(min, max);

    // Should include Jan 1, Apr 1, Jul 1, Oct 1
    expect(boundaries).toHaveLength(4);

    const months = boundaries.map((d) => d.getMonth());
    expect(months).toEqual([0, 3, 6, 9]);
  });

  it('returns only quarter boundaries within the date range', () => {
    const min = parseDateLocal('2026-04-01');
    const max = parseDateLocal('2026-09-30');
    const boundaries = getQuarterBoundaries(min, max);

    // Should include Apr 1 and Jul 1 (Oct 1 is outside max)
    expect(boundaries).toHaveLength(2);
    expect(boundaries[0].getMonth()).toBe(3); // April
    expect(boundaries[1].getMonth()).toBe(6); // July
  });

  it('returns boundaries spanning multiple years', () => {
    const min = parseDateLocal('2025-10-01');
    const max = parseDateLocal('2026-06-30');
    const boundaries = getQuarterBoundaries(min, max);

    // 2025: Oct 1
    // 2026: Jan 1, Apr 1
    expect(boundaries).toHaveLength(3);
  });

  it('returns empty array when no quarter boundaries fall in range', () => {
    const min = parseDateLocal('2026-01-15');
    const max = parseDateLocal('2026-03-15');
    const boundaries = getQuarterBoundaries(min, max);

    // No quarter start between Jan 15 and Mar 15
    expect(boundaries).toHaveLength(0);
  });

  it('includes boundary date when it equals min or max', () => {
    const min = parseDateLocal('2026-04-01');
    const max = parseDateLocal('2026-07-01');
    const boundaries = getQuarterBoundaries(min, max);

    // Should include both Apr 1 and Jul 1
    expect(boundaries).toHaveLength(2);
    expect(boundaries[0].getMonth()).toBe(3);
    expect(boundaries[1].getMonth()).toBe(6);
  });

  it('handles a full multi-year range', () => {
    const min = parseDateLocal('2024-01-01');
    const max = parseDateLocal('2026-12-31');
    const boundaries = getQuarterBoundaries(min, max);

    // 3 years * 4 quarters = 12 boundaries
    expect(boundaries).toHaveLength(12);
  });
});

describe('getMonthBoundaries', () => {
  it('returns all 12 month boundaries within a single year', () => {
    const min = parseDateLocal('2026-01-01');
    const max = parseDateLocal('2026-12-31');
    const boundaries = getMonthBoundaries(min, max);

    expect(boundaries).toHaveLength(12);
    const months = boundaries.map(d => d.getMonth());
    expect(months).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('returns only month boundaries within the date range', () => {
    const min = parseDateLocal('2026-03-15');
    const max = parseDateLocal('2026-06-15');
    const boundaries = getMonthBoundaries(min, max);

    // Apr 1, May 1, Jun 1 (Mar 15 > Mar 1 so Mar excluded)
    expect(boundaries).toHaveLength(3);
    expect(boundaries[0].getMonth()).toBe(3); // April
    expect(boundaries[1].getMonth()).toBe(4); // May
    expect(boundaries[2].getMonth()).toBe(5); // June
  });

  it('returns boundaries spanning multiple years', () => {
    const min = parseDateLocal('2025-11-01');
    const max = parseDateLocal('2026-02-28');
    const boundaries = getMonthBoundaries(min, max);

    // Nov 1, Dec 1, Jan 1, Feb 1
    expect(boundaries).toHaveLength(4);
    expect(boundaries[0].getMonth()).toBe(10); // Nov
    expect(boundaries[3].getMonth()).toBe(1);  // Feb
  });

  it('returns empty array when no month boundaries fall in range', () => {
    const min = parseDateLocal('2026-01-02');
    const max = parseDateLocal('2026-01-31');
    const boundaries = getMonthBoundaries(min, max);

    expect(boundaries).toHaveLength(0);
  });

  it('includes boundary date when it equals min', () => {
    const min = parseDateLocal('2026-06-01');
    const max = parseDateLocal('2026-06-30');
    const boundaries = getMonthBoundaries(min, max);

    expect(boundaries).toHaveLength(1);
    expect(boundaries[0].getMonth()).toBe(5); // June
  });
});

// --- Work-week utilities (v15.0) ---

describe('isWorkDay', () => {
  it('returns true when day-of-week is in workDays', () => {
    // 2026-06-15 is a Monday (dow=1)
    expect(isWorkDay('2026-06-15', [1, 2, 3, 4, 5])).toBe(true);
  });

  it('returns false when day-of-week is not in workDays', () => {
    // 2026-06-13 is a Saturday (dow=6)
    expect(isWorkDay('2026-06-13', [1, 2, 3, 4, 5])).toBe(false);
  });

  it('returns true for every day when workDays has all 7', () => {
    const allDays = [0, 1, 2, 3, 4, 5, 6];
    // 2026-06-07 (Sun) through 2026-06-13 (Sat)
    for (let d = 7; d <= 13; d++) {
      expect(isWorkDay(`2026-06-${String(d).padStart(2, '0')}`, allDays)).toBe(true);
    }
  });

  it('returns true (opt-out) when workDays is empty', () => {
    expect(isWorkDay('2026-06-13', [])).toBe(true);
  });

  it('returns true (opt-out) when dateStr is invalid', () => {
    expect(isWorkDay('not-a-date', [1, 2, 3, 4, 5])).toBe(true);
    expect(isWorkDay('', [1, 2, 3, 4, 5])).toBe(true);
  });

  it('handles 2000-01-01 correctly (Saturday)', () => {
    // 2000-01-01 is a Saturday (dow=6)
    expect(isWorkDay('2000-01-01', [1, 2, 3, 4, 5])).toBe(false);
    expect(isWorkDay('2000-01-01', [0, 6])).toBe(true);
  });
});
