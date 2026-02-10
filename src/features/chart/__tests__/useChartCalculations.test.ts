import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useChartCalculations } from '../useChartCalculations';
import { Release, ChartDisplaySettings } from '../../../shared/types/models';
import { DEFAULT_DISPLAY_SETTINGS } from '../../../shared/utils/colors';

function makeRelease(overrides: Partial<Release> = {}): Release {
  return {
    id: 'r1',
    projectId: 'p1',
    name: 'Release 1',
    startDate: '2026-01-01',
    earlyFinishDate: '2026-03-01',
    lateFinishDate: '2026-06-01',
    ...overrides,
  };
}

const defaultSettings: ChartDisplaySettings = DEFAULT_DISPLAY_SETTINGS;

describe('useChartCalculations', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('dimensions', () => {
    it('calculates chart height based on release count and display settings', () => {
      const releases = [makeRelease({ id: 'r1' }), makeRelease({ id: 'r2' }), makeRelease({ id: 'r3' })];
      const { result } = renderHook(() => useChartCalculations(releases, defaultSettings));

      // barHeight=30 + rowSpacing=25 = 55 rowHeight; 3 * 55 + 80 = 245
      expect(result.current.dimensions.chartHeight).toBe(245);
    });

    it('returns fixed dimensions for chart width and margins', () => {
      const releases = [makeRelease()];
      const { result } = renderHook(() => useChartCalculations(releases, defaultSettings));

      expect(result.current.dimensions.chartWidth).toBe(1100);
      expect(result.current.dimensions.leftMargin).toBe(280);
      expect(result.current.dimensions.rightMargin).toBe(50);
      expect(result.current.dimensions.topMargin).toBe(50);
      expect(result.current.dimensions.barHeight).toBe(30);
      expect(result.current.dimensions.rowHeight).toBe(55);
    });

    it('increases height with more releases', () => {
      const oneRelease = [makeRelease()];
      const threeReleases = [
        makeRelease({ id: 'r1' }),
        makeRelease({ id: 'r2' }),
        makeRelease({ id: 'r3' }),
      ];

      const { result: result1 } = renderHook(() => useChartCalculations(oneRelease, defaultSettings));
      const { result: result3 } = renderHook(() => useChartCalculations(threeReleases, defaultSettings));

      expect(result3.current.dimensions.chartHeight).toBeGreaterThan(result1.current.dimensions.chartHeight);
      expect(result3.current.dimensions.chartHeight - result1.current.dimensions.chartHeight).toBe(110); // 2 * 55
    });

    it('respects custom barHeight and rowSpacing from displaySettings', () => {
      const releases = [makeRelease()];
      const customSettings: ChartDisplaySettings = { ...defaultSettings, barHeight: '50', rowSpacing: '30' };
      const { result } = renderHook(() => useChartCalculations(releases, customSettings));

      expect(result.current.dimensions.barHeight).toBe(50);
      expect(result.current.dimensions.rowHeight).toBe(80); // 50 + 30
    });
  });

  describe('dateInfo', () => {
    it('calculates min and max dates from releases', () => {
      const releases = [
        makeRelease({ startDate: '2026-01-01', lateFinishDate: '2026-06-01' }),
        makeRelease({ id: 'r2', startDate: '2026-03-01', lateFinishDate: '2026-09-01' }),
      ];
      const { result } = renderHook(() => useChartCalculations(releases, defaultSettings));

      const minDate = new Date(result.current.dateInfo.minDate);
      const maxDate = new Date(result.current.dateInfo.maxDate);

      expect(minDate.getFullYear()).toBe(2026);
      expect(minDate.getMonth()).toBe(0); // January
      expect(maxDate.getMonth()).toBe(8); // September
    });

    it('calculates dateRange as difference between min and max', () => {
      const releases = [makeRelease({ startDate: '2026-01-01', lateFinishDate: '2026-06-01' })];
      const { result } = renderHook(() => useChartCalculations(releases, defaultSettings));

      expect(result.current.dateInfo.dateRange).toBe(
        result.current.dateInfo.maxDate - result.current.dateInfo.minDate
      );
      expect(result.current.dateInfo.dateRange).toBeGreaterThan(0);
    });

    it('determines if today is within chart range', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 2, 15)); // March 15, 2026

      const releases = [makeRelease({ startDate: '2026-01-01', lateFinishDate: '2026-06-01' })];
      const { result } = renderHook(() => useChartCalculations(releases, defaultSettings));

      expect(result.current.dateInfo.todayInRange).toBe(true);
      expect(result.current.dateInfo.todayX).not.toBeNull();
    });

    it('sets todayX to null when today is outside chart range', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2027, 0, 1)); // January 1, 2027

      const releases = [makeRelease({ startDate: '2026-01-01', lateFinishDate: '2026-06-01' })];
      const { result } = renderHook(() => useChartCalculations(releases, defaultSettings));

      expect(result.current.dateInfo.todayInRange).toBe(false);
      expect(result.current.dateInfo.todayX).toBeNull();
    });

    it('includes quarter boundaries within the date range', () => {
      const releases = [makeRelease({ startDate: '2026-01-01', lateFinishDate: '2026-12-31' })];
      const { result } = renderHook(() => useChartCalculations(releases, defaultSettings));

      // Full year should have 4 quarter boundaries (Jan 1, Apr 1, Jul 1, Oct 1)
      expect(result.current.dateInfo.quarterBoundaries.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('finishDateInfo', () => {
    it('returns finishDateInRange false when no finish date provided', () => {
      const releases = [makeRelease()];
      const { result } = renderHook(() => useChartCalculations(releases, defaultSettings));

      expect(result.current.finishDateInfo.finishDateInRange).toBe(false);
      expect(result.current.finishDateInfo.finishDateX).toBeNull();
    });

    it('calculates finish date position when in range', () => {
      const releases = [makeRelease({ startDate: '2026-01-01', lateFinishDate: '2026-12-01' })];
      const { result } = renderHook(() => useChartCalculations(releases, defaultSettings, '2026-06-01'));

      expect(result.current.finishDateInfo.finishDateInRange).toBe(true);
      expect(result.current.finishDateInfo.finishDateX).not.toBeNull();
    });

    it('returns null position when finish date is outside range', () => {
      const releases = [makeRelease({ startDate: '2026-01-01', lateFinishDate: '2026-06-01' })];
      const { result } = renderHook(() => useChartCalculations(releases, defaultSettings, '2027-01-01'));

      expect(result.current.finishDateInfo.finishDateInRange).toBe(false);
      expect(result.current.finishDateInfo.finishDateX).toBeNull();
    });
  });

  describe('dateToX', () => {
    it('converts start date to left margin position', () => {
      const releases = [makeRelease({ startDate: '2026-01-01', lateFinishDate: '2026-06-01' })];
      const { result } = renderHook(() => useChartCalculations(releases, defaultSettings));

      const x = result.current.dateToX('2026-01-01');
      expect(x).toBe(result.current.dimensions.leftMargin);
    });

    it('converts end date to rightmost position', () => {
      const releases = [makeRelease({ startDate: '2026-01-01', lateFinishDate: '2026-06-01' })];
      const { result } = renderHook(() => useChartCalculations(releases, defaultSettings));

      const x = result.current.dateToX('2026-06-01');
      const expectedRight = result.current.dimensions.chartWidth - result.current.dimensions.rightMargin;
      expect(x).toBe(expectedRight);
    });

    it('converts mid-range date to proportional position', () => {
      const releases = [makeRelease({ startDate: '2026-01-01', lateFinishDate: '2026-07-01' })];
      const { result } = renderHook(() => useChartCalculations(releases, defaultSettings));

      const leftX = result.current.dateToX('2026-01-01');
      const rightX = result.current.dateToX('2026-07-01');
      const midX = result.current.dateToX('2026-04-01');

      expect(midX).toBeGreaterThan(leftX);
      expect(midX).toBeLessThan(rightX);
    });

    it('returns increasing X values for chronologically ordered dates', () => {
      const releases = [makeRelease({ startDate: '2026-01-01', lateFinishDate: '2026-12-01' })];
      const { result } = renderHook(() => useChartCalculations(releases, defaultSettings));

      const x1 = result.current.dateToX('2026-02-01');
      const x2 = result.current.dateToX('2026-05-01');
      const x3 = result.current.dateToX('2026-09-01');

      expect(x1).toBeLessThan(x2);
      expect(x2).toBeLessThan(x3);
    });

    it('returns a finite number when all dates are the same (zero dateRange)', () => {
      const sameDate = '2026-03-01';
      const releases = [makeRelease({ startDate: sameDate, earlyFinishDate: sameDate, lateFinishDate: sameDate })];
      const { result } = renderHook(() => useChartCalculations(releases, defaultSettings));

      const x = result.current.dateToX(sameDate);
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isNaN(x)).toBe(false);

      // Should place at center of drawable area
      const center = result.current.dimensions.leftMargin +
        (result.current.dimensions.chartWidth - result.current.dimensions.leftMargin - result.current.dimensions.rightMargin) / 2;
      expect(x).toBe(center);
    });
  });

  describe('years', () => {
    it('returns all years spanning the date range', () => {
      const releases = [makeRelease({ startDate: '2025-06-01', lateFinishDate: '2027-03-01' })];
      const { result } = renderHook(() => useChartCalculations(releases, defaultSettings));

      expect(result.current.years).toEqual([2025, 2026, 2027]);
    });

    it('returns single year when range is within one year', () => {
      const releases = [makeRelease({ startDate: '2026-01-01', lateFinishDate: '2026-06-01' })];
      const { result } = renderHook(() => useChartCalculations(releases, defaultSettings));

      expect(result.current.years).toEqual([2026]);
    });
  });

  describe('getReleaseColors', () => {
    it('returns chart colors for normal releases', () => {
      const releases = [makeRelease()];
      const { result } = renderHook(() => useChartCalculations(releases, defaultSettings));

      const colors = result.current.getReleaseColors(makeRelease(), { solidBar: '#0070f3', hatchedBar: '#0070f3' });
      expect(colors.solidBar).toBe('#0070f3');
    });

    it('returns completed colors for completed releases', () => {
      const releases = [makeRelease()];
      const { result } = renderHook(() => useChartCalculations(releases, defaultSettings));

      const colors = result.current.getReleaseColors(makeRelease({ completed: true }), { solidBar: '#0070f3', hatchedBar: '#0070f3' });
      expect(colors.solidBar).toBe('#90EE90');
      expect(colors.hatchedBar).toBe('#228B22');
    });
  });
});
