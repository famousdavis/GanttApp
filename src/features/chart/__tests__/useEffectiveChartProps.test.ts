import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEffectiveChartProps } from '../useEffectiveChartProps';
import { Snapshot } from '../../../shared/types';
import { DEFAULT_CHART_COLORS } from '../../../shared/utils/colors';

const liveData = {
  releases: [
    {
      id: 'r1',
      projectId: 'p1',
      name: 'Release 1',
      startDate: '2026-01-01',
      earlyFinishDate: '2026-02-01',
      lateFinishDate: '2026-03-01'
    }
  ],
  chartColors: DEFAULT_CHART_COLORS,
  labels: { solidBar: 'Design', hatchedBar: 'Uncertainty', finishDateLine: 'Finish', mostLikelyLine: 'Most Likely Finish' },
  preparedBy: 'William',
  finishDate: '2026-06-30'
};

const snapshotColors = {
  solidBar: '#ff0000',
  hatchedBar: '#00ff00',
  todayLine: '#0000ff',
  finishDateLine: '#ffff00',
  mostLikelyLine: '#000000'
};

const mockSnapshot: Snapshot = {
  id: 'snap1',
  projectId: 'p1',
  timestamp: '2026-01-15T10:00:00.000Z',
  name: 'Sprint 1 Review',
  releases: [
    {
      id: 'r1',
      projectId: 'p1',
      name: 'Snapshot Release 1',
      startDate: '2026-01-01',
      earlyFinishDate: '2026-01-15',
      lateFinishDate: '2026-02-01'
    }
  ],
  chartColors: snapshotColors,
  legendLabels: { solidBar: 'Snap Design', hatchedBar: 'Snap Uncertainty', finishDateLine: 'Snap Finish' },
  preparedBy: 'Jane',
  projectFinishDate: '2026-05-15'
};

describe('useEffectiveChartProps', () => {
  it('returns live data when no snapshot is active', () => {
    const { result } = renderHook(() => useEffectiveChartProps(null, liveData));

    expect(result.current.releases).toBe(liveData.releases);
    expect(result.current.colors).toBe(liveData.chartColors);
    expect(result.current.labels).toBe(liveData.labels);
    expect(result.current.preparedBy).toBe('William');
    expect(result.current.finishDate).toBe('2026-06-30');
    expect(result.current.datePreparedOverride).toBeUndefined();
  });

  it('returns snapshot data when a snapshot is active', () => {
    const { result } = renderHook(() => useEffectiveChartProps(mockSnapshot, liveData));

    expect(result.current.releases).toBe(mockSnapshot.releases);
    expect(result.current.colors).toBe(snapshotColors);
    expect(result.current.labels).toEqual({
      solidBar: 'Snap Design',
      hatchedBar: 'Snap Uncertainty',
      finishDateLine: 'Snap Finish'
    });
    expect(result.current.preparedBy).toBe('Jane');
    expect(result.current.finishDate).toBe('2026-05-15');
  });

  it('provides datePreparedOverride for snapshot view', () => {
    const { result } = renderHook(() => useEffectiveChartProps(mockSnapshot, liveData));

    // Should be a formatted date string from the snapshot timestamp
    expect(result.current.datePreparedOverride).toBeTruthy();
    expect(result.current.datePreparedOverride).toContain('2026');
    expect(result.current.datePreparedOverride).toContain('January');
  });

  it('falls back to live chartColors when snapshot has none', () => {
    const snapshotWithoutColors: Snapshot = {
      ...mockSnapshot,
      chartColors: undefined
    };

    const { result } = renderHook(() => useEffectiveChartProps(snapshotWithoutColors, liveData));

    expect(result.current.colors).toBe(liveData.chartColors);
  });

  it('falls back to live labels when snapshot has none', () => {
    const snapshotWithoutLabels: Snapshot = {
      ...mockSnapshot,
      legendLabels: undefined
    };

    const { result } = renderHook(() => useEffectiveChartProps(snapshotWithoutLabels, liveData));

    expect(result.current.labels).toBe(liveData.labels);
  });

  it('falls back to live preparedBy when snapshot has none', () => {
    const snapshotWithoutPreparedBy: Snapshot = {
      ...mockSnapshot,
      preparedBy: undefined
    };

    const { result } = renderHook(() => useEffectiveChartProps(snapshotWithoutPreparedBy, liveData));

    expect(result.current.preparedBy).toBe('William');
  });

  it('falls back to live finishDate when snapshot has none', () => {
    const snapshotWithoutFinishDate: Snapshot = {
      ...mockSnapshot,
      projectFinishDate: undefined
    };

    const { result } = renderHook(() => useEffectiveChartProps(snapshotWithoutFinishDate, liveData));

    expect(result.current.finishDate).toBe('2026-06-30');
  });

  it('handles undefined live finishDate', () => {
    const liveWithoutFinish = { ...liveData, finishDate: undefined };
    const { result } = renderHook(() => useEffectiveChartProps(null, liveWithoutFinish));

    expect(result.current.finishDate).toBeUndefined();
  });

  it('returns live mostLikelyLine label when no snapshot', () => {
    const { result } = renderHook(() => useEffectiveChartProps(null, liveData));

    expect(result.current.labels.mostLikelyLine).toBe('Most Likely Finish');
  });

  it('returns snapshot mostLikelyLine label from snapshot', () => {
    const snapshotWithMlLabel: Snapshot = {
      ...mockSnapshot,
      legendLabels: { solidBar: 'Snap Design', hatchedBar: 'Snap Uncertainty', finishDateLine: 'Snap Finish', mostLikelyLine: 'Snap ML' }
    };
    const { result } = renderHook(() => useEffectiveChartProps(snapshotWithMlLabel, liveData));

    expect(result.current.labels.mostLikelyLine).toBe('Snap ML');
  });
});
