// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveData, loadData, clearData } from '../storage';
import { AppData } from '../../types/app';

describe('storage utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  function makeTestData(overrides: Partial<AppData> = {}): AppData {
    return {
      projects: [{ id: '1', name: 'Test Project' }],
      releases: [
        {
          id: 'r1',
          projectId: '1',
          name: 'Release 1',
          startDate: '2026-01-01',
          earlyFinishDate: '2026-02-01',
          lateFinishDate: '2026-03-01',
        },
      ],
      ...overrides,
    };
  }

  describe('saveData', () => {
    it('saves data to localStorage under the correct key', () => {
      const data = makeTestData();
      saveData(data);

      const stored = localStorage.getItem('ganttAppData');
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!)).toEqual(data);
    });

    it('saves empty data structures', () => {
      const data: AppData = { projects: [], releases: [] };
      saveData(data);

      const stored = localStorage.getItem('ganttAppData');
      expect(JSON.parse(stored!)).toEqual(data);
    });

    it('overwrites previously saved data', () => {
      const data1 = makeTestData({ projects: [{ id: '1', name: 'First' }] });
      const data2 = makeTestData({ projects: [{ id: '2', name: 'Second' }] });

      saveData(data1);
      saveData(data2);

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects[0].name).toBe('Second');
    });

    it('handles localStorage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      // Should not throw
      expect(() => saveData(makeTestData())).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('preserves optional fields like chartColors', () => {
      const data = makeTestData({
        chartColors: {
          solidBar: '#000000',
          hatchedBar: '#111111',
          todayLine: '#222222',
          finishDateLine: '#333333',
          mostLikelyLine: '#444444',
          completedBar: '#90ee90',
          inProgressBar: '#f59e0b',
        },
        activePreset: 'Professional',
      });

      saveData(data);
      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.chartColors).toEqual(data.chartColors);
      expect(stored.activePreset).toBe('Professional');
    });
  });

  describe('loadData', () => {
    it('returns null when no data is stored', () => {
      expect(loadData()).toBeNull();
    });

    it('returns parsed data when valid JSON is stored', () => {
      const data = makeTestData();
      localStorage.setItem('ganttAppData', JSON.stringify(data));

      const loaded = loadData();
      expect(loaded).toEqual(data);
    });

    it('returns null for corrupted JSON data', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorage.setItem('ganttAppData', 'not valid json {{{');

      const loaded = loadData();
      expect(loaded).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('handles localStorage read errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      expect(loadData()).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('clearData', () => {
    it('removes data from localStorage', () => {
      saveData(makeTestData());
      expect(localStorage.getItem('ganttAppData')).not.toBeNull();

      clearData();
      expect(localStorage.getItem('ganttAppData')).toBeNull();
    });

    it('does not throw when no data exists', () => {
      expect(() => clearData()).not.toThrow();
    });

    it('handles localStorage removal errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      expect(() => clearData()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('round-trip tests', () => {
    it('data survives save and load cycle', () => {
      const data = makeTestData({
        chartColors: {
          solidBar: '#ff0000',
          hatchedBar: '#00ff00',
          todayLine: '#0000ff',
          finishDateLine: '#ffff00',
          mostLikelyLine: '#000000',
          completedBar: '#90ee90',
          inProgressBar: '#f59e0b',
        },
        legendLabels: {
          solidBar: 'Custom Solid',
          hatchedBar: 'Custom Hatched',
          finishDateLine: 'Custom Finish',
        },
        showFinishDateLine: false,
        chartDisplaySettings: {
          releaseNameFontSize: '18',
          dateLabelFontSize: '15',
          dateLabelColor: '#333',
          verticalLineWidth: '4',
          barHeight: '30',
          rowSpacing: '30',
        },
      });

      saveData(data);
      const loaded = loadData();
      expect(loaded).toEqual(data);
    });

    it('preserves release hidden and status fields', () => {
      const data = makeTestData({
        releases: [
          {
            id: 'r1',
            projectId: '1',
            name: 'Hidden Release',
            startDate: '2026-01-01',
            earlyFinishDate: '2026-02-01',
            lateFinishDate: '2026-03-01',
            hidden: true,
          },
          {
            id: 'r2',
            projectId: '1',
            name: 'Completed Release',
            startDate: '2026-01-01',
            earlyFinishDate: '2026-02-01',
            lateFinishDate: '2026-03-01',
            hidden: false,
            status: 'complete' as const,
          },
        ],
      });

      saveData(data);
      const loaded = loadData()!;
      expect(loaded.releases[0].hidden).toBe(true);
      expect(loaded.releases[0].status).toBeUndefined();
      expect(loaded.releases[1].hidden).toBe(false);
      expect(loaded.releases[1].status).toBe('complete');
    });

    it('preserves showTodayLine toggle state', () => {
      const data = makeTestData({ showTodayLine: false });
      saveData(data);
      const loaded = loadData()!;
      expect(loaded.showTodayLine).toBe(false);
    });

    it('preserves showMostLikelyLine toggle state', () => {
      const data = makeTestData({ showMostLikelyLine: true });
      saveData(data);
      const loaded = loadData()!;
      expect(loaded.showMostLikelyLine).toBe(true);
    });
  });

  describe('work week fields (v15.0)', () => {
    it('preserves workDays on a project', () => {
      const data = makeTestData({
        projects: [{ id: 'p1', name: 'Test', workDays: [1, 2, 3, 4, 5] }],
      });
      saveData(data);
      const loaded = loadData()!;
      expect(loaded.projects[0].workDays).toEqual([1, 2, 3, 4, 5]);
    });

    it('drops invalid workDays on a project', () => {
      const data = makeTestData({
        projects: [{ id: 'p1', name: 'Test', workDays: ['foo', 99] as unknown as number[] }],
      });
      saveData(data);
      const loaded = loadData()!;
      expect(loaded.projects[0].workDays).toBeUndefined();
    });

    it('preserves globalWorkDays on AppData', () => {
      const data = makeTestData({ globalWorkDays: [0, 6] });
      saveData(data);
      const loaded = loadData()!;
      expect(loaded.globalWorkDays).toEqual([0, 6]);
    });

    it('drops invalid globalWorkDays', () => {
      const data = makeTestData({ globalWorkDays: 'not-an-array' as unknown as number[] });
      saveData(data);
      const loaded = loadData()!;
      expect(loaded.globalWorkDays).toBeUndefined();
    });
  });

  describe('per-project legend labels (v16.1)', () => {
    it('preserves project legendLabels through validateLoadedData', () => {
      const data = makeTestData({
        projects: [{
          id: 'p1',
          name: 'Alpha',
          legendLabels: { solidBar: 'Build Phase', inProgress: 'Active Work' },
        }],
      });
      saveData(data);
      const loaded = loadData()!;
      expect(loaded.projects[0].legendLabels).toEqual({
        solidBar: 'Build Phase',
        inProgress: 'Active Work',
      });
    });

    it('strips invalid legendLabels fields during load', () => {
      const data = makeTestData({
        projects: [{
          id: 'p1',
          name: 'Alpha',
          legendLabels: { solidBar: 42 as unknown as string, hatchedBar: 'Valid' },
        }],
      });
      saveData(data);
      const loaded = loadData()!;
      expect(loaded.projects[0].legendLabels).toEqual({ hatchedBar: 'Valid' });
    });

    it('drops legendLabels entirely when object is empty', () => {
      const data = makeTestData({
        projects: [{ id: 'p1', name: 'Alpha', legendLabels: {} }],
      });
      saveData(data);
      const loaded = loadData()!;
      expect(loaded.projects[0].legendLabels).toBeUndefined();
    });
  });
});
