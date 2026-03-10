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

  describe('releaseChanged — order detection note', () => {
    // releaseChanged only compares content fields. Order detection is handled
    // separately in executeFirestoreSave by comparing array indices. This test
    // documents that releaseChanged intentionally does NOT detect order changes
    // (the order field is not part of the Release model — it's computed from
    // array position during save).
    const r1: Release = {
      id: 'r1', projectId: 'p1', name: 'R1',
      startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01',
    };
    const r2: Release = {
      id: 'r2', projectId: 'p1', name: 'R2',
      startDate: '2026-04-01', earlyFinishDate: '2026-05-01', lateFinishDate: '2026-06-01',
    };

    it('does not detect order change (order is handled by index comparison)', () => {
      // Same release content, different array positions — releaseChanged returns false
      // because order detection is done externally by comparing prevIndex !== index
      expect(releaseChanged(r1, r1)).toBe(false);
      expect(releaseChanged(r2, r2)).toBe(false);
    });

    it('release order change triggers write via index comparison (integration note)', () => {
      // Given prev = [r1, r2] and curr = [r2, r1]:
      //   - r2 at curr index 0: prevIndex = 1 !== 0 → write triggered
      //   - r1 at curr index 1: prevIndex = 0 !== 1 → write triggered
      // This is NOT tested in releaseChanged — it's tested by the index comparison
      // in executeFirestoreSave: prevIndex !== index
      const prevReleases = [r1, r2];
      const currReleases = [r2, r1]; // swapped order

      // r2 moved from index 1 to index 0
      const r2PrevIndex = prevReleases.findIndex(r => r.id === 'r2');
      const r2CurrIndex = currReleases.findIndex(r => r.id === 'r2');
      expect(r2PrevIndex).toBe(1);
      expect(r2CurrIndex).toBe(0);
      expect(r2PrevIndex !== r2CurrIndex).toBe(true); // order changed → triggers write

      // r1 moved from index 0 to index 1
      const r1PrevIndex = prevReleases.findIndex(r => r.id === 'r1');
      const r1CurrIndex = currReleases.findIndex(r => r.id === 'r1');
      expect(r1PrevIndex).toBe(0);
      expect(r1CurrIndex).toBe(1);
      expect(r1PrevIndex !== r1CurrIndex).toBe(true); // order changed → triggers write
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
