import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useChartCalculations } from '../useChartCalculations';
import { Release } from '../../../shared/types/models';

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

describe('useChartCalculations', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('dimensions', () => {
    it('calculates chart height based on release count', () => {
      const releases = [makeRelease({ id: 'r1' }), makeRelease({ id: 'r2' }), makeRelease({ id: 'r3' })];
      const { result } = renderHook(() => useChartCalculations(releases));

      // 3 releases * 60 rowHeight + 80 = 260
      expect(result.current.dimensions.chartHeight).toBe(260);
    });

    it('returns fixed dimensions for chart width and margins', () => {
      const releases = [makeRelease()];
      const { result } = renderHook(() => useChartCalculations(releases));

      expect(result.current.dimensions.chartWidth).toBe(900);
      expect(result.current.dimensions.leftMargin).toBe(230);
      expect(result.current.dimensions.rightMargin).toBe(30);
      expect(result.current.dimensions.topMargin).toBe(50);
      expect(result.current.dimensions.barHeight).toBe(30);
      expect(result.current.dimensions.rowHeight).toBe(60);
    });

    it('increases height with more releases', () => {
      const oneRelease = [makeRelease()];
      const threeReleases = [
        makeRelease({ id: 'r1' }),
        makeRelease({ id: 'r2' }),
        makeRelease({ id: 'r3' }),
      ];

      const { result: result1 } = renderHook(() => useChartCalculations(oneRelease));
      const { result: result3 } = renderHook(() => useChartCalculations(threeReleases));

      expect(result3.current.dimensions.chartHeight).toBeGreaterThan(result1.current.dimensions.chartHeight);
      expect(result3.current.dimensions.chartHeight - result1.current.dimensions.chartHeight).toBe(120); // 2 * 60
    });
  });

  describe('dateInfo', () => {
    it('calculates min and max dates from releases', () => {
      const releases = [
        makeRelease({ startDate: '2026-01-01', lateFinishDate: '2026-06-01' }),
        makeRelease({ id: 'r2', startDate: '2026-03-01', lateFinishDate: '2026-09-01' }),
      ];
      const { result } = renderHook(() => useChartCalculations(releases));

      const minDate = new Date(result.current.dateInfo.minDate);
      const maxDate = new Date(result.current.dateInfo.maxDate);

      expect(minDate.getFullYear()).toBe(2026);
      expect(minDate.getMonth()).toBe(0); // January
      expect(maxDate.getMonth()).toBe(8); // September
    });

    it('calculates dateRange as difference between min and max', () => {
      const releases = [makeRelease({ startDate: '2026-01-01', lateFinishDate: '2026-06-01' })];
      const { result } = renderHook(() => useChartCalculations(releases));

      expect(result.current.dateInfo.dateRange).toBe(
        result.current.dateInfo.maxDate - result.current.dateInfo.minDate
      );
      expect(result.current.dateInfo.dateRange).toBeGreaterThan(0);
    });

    it('determines if today is within chart range', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 2, 15)); // March 15, 2026

      const releases = [makeRelease({ startDate: '2026-01-01', lateFinishDate: '2026-06-01' })];
      const { result } = renderHook(() => useChartCalculations(releases));

      expect(result.current.dateInfo.todayInRange).toBe(true);
      expect(result.current.dateInfo.todayX).not.toBeNull();
    });

    it('sets todayX to null when today is outside chart range', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2027, 0, 1)); // January 1, 2027

      const releases = [makeRelease({ startDate: '2026-01-01', lateFinishDate: '2026-06-01' })];
      const { result } = renderHook(() => useChartCalculations(releases));

      expect(result.current.dateInfo.todayInRange).toBe(false);
      expect(result.current.dateInfo.todayX).toBeNull();
    });

    it('includes quarter boundaries within the date range', () => {
      const releases = [makeRelease({ startDate: '2026-01-01', lateFinishDate: '2026-12-31' })];
      const { result } = renderHook(() => useChartCalculations(releases));

      // Full year should have 4 quarter boundaries (Jan 1, Apr 1, Jul 1, Oct 1)
      expect(result.current.dateInfo.quarterBoundaries.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('finishDateInfo', () => {
    it('returns finishDateInRange false when no finish date provided', () => {
      const releases = [makeRelease()];
      const { result } = renderHook(() => useChartCalculations(releases));

      expect(result.current.finishDateInfo.finishDateInRange).toBe(false);
      expect(result.current.finishDateInfo.finishDateX).toBeNull();
    });

    it('calculates finish date position when in range', () => {
      const releases = [makeRelease({ startDate: '2026-01-01', lateFinishDate: '2026-12-01' })];
      const { result } = renderHook(() => useChartCalculations(releases, '2026-06-01'));

      expect(result.current.finishDateInfo.finishDateInRange).toBe(true);
      expect(result.current.finishDateInfo.finishDateX).not.toBeNull();
    });

    it('returns null position when finish date is outside range', () => {
      const releases = [makeRelease({ startDate: '2026-01-01', lateFinishDate: '2026-06-01' })];
      const { result } = renderHook(() => useChartCalculations(releases, '2027-01-01'));

      expect(result.current.finishDateInfo.finishDateInRange).toBe(false);
      expect(result.current.finishDateInfo.finishDateX).toBeNull();
    });
  });

  describe('dateToX', () => {
    it('converts start date to left margin position', () => {
      const releases = [makeRelease({ startDate: '2026-01-01', lateFinishDate: '2026-06-01' })];
      const { result } = renderHook(() => useChartCalculations(releases));

      const x = result.current.dateToX('2026-01-01');
      // Start date should map to leftMargin
      expect(x).toBe(result.current.dimensions.leftMargin);
    });

    it('converts end date to rightmost position', () => {
      const releases = [makeRelease({ startDate: '2026-01-01', lateFinishDate: '2026-06-01' })];
      const { result } = renderHook(() => useChartCalculations(releases));

      const x = result.current.dateToX('2026-06-01');
      const expectedRight = result.current.dimensions.chartWidth - result.current.dimensions.rightMargin;
      expect(x).toBe(expectedRight);
    });

    it('converts mid-range date to proportional position', () => {
      const releases = [makeRelease({ startDate: '2026-01-01', lateFinishDate: '2026-07-01' })];
      const { result } = renderHook(() => useChartCalculations(releases));

      const leftX = result.current.dateToX('2026-01-01');
      const rightX = result.current.dateToX('2026-07-01');
      const midX = result.current.dateToX('2026-04-01');

      // Mid date should be roughly between left and right
      expect(midX).toBeGreaterThan(leftX);
      expect(midX).toBeLessThan(rightX);
    });

    it('returns increasing X values for chronologically ordered dates', () => {
      const releases = [makeRelease({ startDate: '2026-01-01', lateFinishDate: '2026-12-01' })];
      const { result } = renderHook(() => useChartCalculations(releases));

      const x1 = result.current.dateToX('2026-02-01');
      const x2 = result.current.dateToX('2026-05-01');
      const x3 = result.current.dateToX('2026-09-01');

      expect(x1).toBeLessThan(x2);
      expect(x2).toBeLessThan(x3);
    });

    it('returns a finite number when all dates are the same (zero dateRange)', () => {
      const sameDate = '2026-03-01';
      const releases = [makeRelease({ startDate: sameDate, earlyFinishDate: sameDate, lateFinishDate: sameDate })];
      const { result } = renderHook(() => useChartCalculations(releases));

      const x = result.current.dateToX(sameDate);
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isNaN(x)).toBe(false);

      // Should place at center of drawable area
      const center = result.current.dimensions.leftMargin +
        (result.current.dimensions.chartWidth - result.current.dimensions.leftMargin - result.current.dimensions.rightMargin) / 2;
      expect(x).toBe(center);
    });
  });
});
