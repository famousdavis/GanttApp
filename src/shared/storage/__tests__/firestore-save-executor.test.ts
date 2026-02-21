import { describe, it, expect, vi, beforeEach } from 'vitest';
import { releaseChanged, settingsChanged } from '../firestore-save-executor';
import type { Release } from '../../types/models';
import type { AppData } from '../../types/app';

describe('firestore-save-executor', () => {
  describe('releaseChanged', () => {
    const base: Release = {
      id: 'r1', projectId: 'p1', name: 'R1',
      startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01',
    };

    it('returns true when prev is undefined (new release)', () => {
      expect(releaseChanged(undefined, base)).toBe(true);
    });

    it('returns false when releases are identical', () => {
      expect(releaseChanged({ ...base }, { ...base })).toBe(false);
    });

    it('detects name change', () => {
      expect(releaseChanged(base, { ...base, name: 'R2' })).toBe(true);
    });

    it('detects startDate change', () => {
      expect(releaseChanged(base, { ...base, startDate: '2026-01-15' })).toBe(true);
    });

    it('detects earlyFinishDate change', () => {
      expect(releaseChanged(base, { ...base, earlyFinishDate: '2026-02-15' })).toBe(true);
    });

    it('detects lateFinishDate change', () => {
      expect(releaseChanged(base, { ...base, lateFinishDate: '2026-03-15' })).toBe(true);
    });

    it('detects hidden change', () => {
      expect(releaseChanged(base, { ...base, hidden: true })).toBe(true);
    });

    it('detects completed change', () => {
      expect(releaseChanged(base, { ...base, completed: true })).toBe(true);
    });

    it('detects mostLikelyFinishDate change', () => {
      expect(releaseChanged(base, { ...base, mostLikelyFinishDate: '2026-02-15' })).toBe(true);
    });
  });

  describe('settingsChanged', () => {
    const base: AppData = {
      projects: [], releases: [],
      chartColors: { solidBar: '#000', hatchedBar: '#111', todayLine: '#222', finishDateLine: '#333', mostLikelyLine: '#444', completedBar: '#555' },
      activePreset: 'Default',
      showTodayLine: true,
      showFinishDateLine: false,
      showMostLikelyLine: true,
      preparedBy: 'Alice',
      showPreparedBy: true,
    };

    it('returns true when prev is null (first save)', () => {
      expect(settingsChanged(null, base)).toBe(true);
    });

    it('returns false when settings are identical', () => {
      expect(settingsChanged({ ...base }, { ...base })).toBe(false);
    });

    it('detects chartColors change', () => {
      const changed = { ...base, chartColors: { ...base.chartColors!, solidBar: '#fff' } };
      expect(settingsChanged(base, changed)).toBe(true);
    });

    it('detects activePreset change', () => {
      expect(settingsChanged(base, { ...base, activePreset: 'Ocean' })).toBe(true);
    });

    it('detects showTodayLine change', () => {
      expect(settingsChanged(base, { ...base, showTodayLine: false })).toBe(true);
    });

    it('detects preparedBy change', () => {
      expect(settingsChanged(base, { ...base, preparedBy: 'Bob' })).toBe(true);
    });

    it('detects exportAttribution change', () => {
      expect(settingsChanged(base, {
        ...base, exportAttribution: { name: 'Alice', identifier: 'team-1' },
      })).toBe(true);
    });

    it('returns false when exportAttribution is identical', () => {
      const withAttr = { ...base, exportAttribution: { name: 'A', identifier: 'B' } };
      expect(settingsChanged(withAttr, { ...withAttr })).toBe(false);
    });
  });
});
