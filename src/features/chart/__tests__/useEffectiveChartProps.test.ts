// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

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
  labels: { solidBar: 'Design', hatchedBar: 'Uncertainty', finishDateLine: 'Finish', mostLikelyLine: 'Most Likely Finish', inProgress: 'In Progress' },
  preparedBy: 'William',
  finishDate: '2026-06-30'
};

const snapshotColors = {
  solidBar: '#ff0000',
  hatchedBar: '#00ff00',
  todayLine: '#0000ff',
  finishDateLine: '#ffff00',
  mostLikelyLine: '#000000',
  completedBar: '#90ee90',
  inProgressBar: '#f59e0b'
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
    const { result } = renderHook(() => useEffectiveChartProps(null, liveData, undefined));

    expect(result.current.releases).toBe(liveData.releases);
    expect(result.current.colors).toBe(liveData.chartColors);
    // v16.1: labels are now merged via resolveLabel into a fresh object — use toEqual (value equality)
    // instead of toBe (reference equality). Contents are identical when no project override exists.
    expect(result.current.labels).toEqual(liveData.labels);
    expect(result.current.preparedBy).toBe('William');
    expect(result.current.finishDate).toBe('2026-06-30');
    expect(result.current.datePreparedOverride).toBeUndefined();
  });

  it('returns snapshot data when a snapshot is active', () => {
    const { result } = renderHook(() => useEffectiveChartProps(mockSnapshot, liveData, undefined));

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
    const { result } = renderHook(() => useEffectiveChartProps(mockSnapshot, liveData, undefined));

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

    const { result } = renderHook(() => useEffectiveChartProps(snapshotWithoutColors, liveData, undefined));

    expect(result.current.colors).toBe(liveData.chartColors);
  });

  it('falls back to live labels when snapshot has none', () => {
    const snapshotWithoutLabels: Snapshot = {
      ...mockSnapshot,
      legendLabels: undefined
    };

    const { result } = renderHook(() => useEffectiveChartProps(snapshotWithoutLabels, liveData, undefined));

    // v16.1: snapshot falls through to mergedLabels (fresh object); value-equal but not reference-equal
    expect(result.current.labels).toEqual(liveData.labels);
  });

  it('falls back to live preparedBy when snapshot has none', () => {
    const snapshotWithoutPreparedBy: Snapshot = {
      ...mockSnapshot,
      preparedBy: undefined
    };

    const { result } = renderHook(() => useEffectiveChartProps(snapshotWithoutPreparedBy, liveData, undefined));

    expect(result.current.preparedBy).toBe('William');
  });

  it('falls back to live finishDate when snapshot has none', () => {
    const snapshotWithoutFinishDate: Snapshot = {
      ...mockSnapshot,
      projectFinishDate: undefined
    };

    const { result } = renderHook(() => useEffectiveChartProps(snapshotWithoutFinishDate, liveData, undefined));

    expect(result.current.finishDate).toBe('2026-06-30');
  });

  it('handles undefined live finishDate', () => {
    const liveWithoutFinish = { ...liveData, finishDate: undefined };
    const { result } = renderHook(() => useEffectiveChartProps(null, liveWithoutFinish, undefined));

    expect(result.current.finishDate).toBeUndefined();
  });

  it('returns live mostLikelyLine label when no snapshot', () => {
    const { result } = renderHook(() => useEffectiveChartProps(null, liveData, undefined));

    expect(result.current.labels.mostLikelyLine).toBe('Most Likely Finish');
  });

  it('returns snapshot mostLikelyLine label from snapshot', () => {
    const snapshotWithMlLabel: Snapshot = {
      ...mockSnapshot,
      legendLabels: { solidBar: 'Snap Design', hatchedBar: 'Snap Uncertainty', finishDateLine: 'Snap Finish', mostLikelyLine: 'Snap ML' }
    };
    const { result } = renderHook(() => useEffectiveChartProps(snapshotWithMlLabel, liveData, undefined));

    expect(result.current.labels.mostLikelyLine).toBe('Snap ML');
  });

  // --- v16.1: per-project legend label overrides ---

  describe('per-project label overrides (v16.1)', () => {
    it('merges project override into labels when no snapshot', () => {
      const { result } = renderHook(() => useEffectiveChartProps(null, liveData, { solidBar: 'Project Solid' }));

      expect(result.current.labels.solidBar).toBe('Project Solid');
    });

    it('falls through to global label when project override is undefined for a key', () => {
      const { result } = renderHook(() => useEffectiveChartProps(null, liveData, { solidBar: 'Override' }));

      // hatchedBar is not overridden — should return global
      expect(result.current.labels.hatchedBar).toBe('Uncertainty');
    });

    it('snapshot labels win over project override when both present', () => {
      // mockSnapshot already has legendLabels set
      const projectOverride = { solidBar: 'Project Solid', hatchedBar: 'Project Hatched' };
      const { result } = renderHook(() => useEffectiveChartProps(mockSnapshot, liveData, projectOverride));

      // Snapshot labels win
      expect(result.current.labels.solidBar).toBe('Snap Design');
      expect(result.current.labels.hatchedBar).toBe('Snap Uncertainty');
    });

    it('project override applies when snapshot has no frozen labels', () => {
      const snapshotWithoutLabels: Snapshot = { ...mockSnapshot, legendLabels: undefined };
      const projectOverride = { solidBar: 'Project Solid' };
      const { result } = renderHook(() => useEffectiveChartProps(snapshotWithoutLabels, liveData, projectOverride));

      // Snapshot has no labels, project override wins over global
      expect(result.current.labels.solidBar).toBe('Project Solid');
      // Other keys fall through to global
      expect(result.current.labels.hatchedBar).toBe('Uncertainty');
    });

    it('resolves all five keys independently', () => {
      const projectOverride = { solidBar: 'PS', inProgress: 'PI' };
      const { result } = renderHook(() => useEffectiveChartProps(null, liveData, projectOverride));

      expect(result.current.labels.solidBar).toBe('PS');          // override
      expect(result.current.labels.hatchedBar).toBe('Uncertainty'); // global
      expect(result.current.labels.finishDateLine).toBe('Finish'); // global
      expect(result.current.labels.mostLikelyLine).toBe('Most Likely Finish'); // global
      expect(result.current.labels.inProgress).toBe('PI');         // override
    });

    it('ignores empty project override object (all global)', () => {
      const { result } = renderHook(() => useEffectiveChartProps(null, liveData, {}));

      expect(result.current.labels.solidBar).toBe('Design');
      expect(result.current.labels.hatchedBar).toBe('Uncertainty');
    });
  });
});
