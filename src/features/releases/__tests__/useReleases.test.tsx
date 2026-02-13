import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { AppDataProvider } from '../../../context/AppDataContext';
import { useReleases } from '../useReleases';
import { AppData } from '../../../shared/types/app';
import { Project, Release } from '../../../shared/types/models';

function wrapper({ children }: { children: ReactNode }) {
  return <AppDataProvider>{children}</AppDataProvider>;
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Test Project',
    ...overrides,
  };
}

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

function seedData(data: AppData) {
  localStorage.setItem('ganttAppData', JSON.stringify(data));
}

describe('useReleases', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('initializes with empty form fields', () => {
      const { result } = renderHook(() => useReleases(), { wrapper });
      expect(result.current.releaseName).toBe('');
      expect(result.current.startDate).toBe('');
      expect(result.current.earlyFinish).toBe('');
      expect(result.current.lateFinish).toBe('');
    });

    it('initializes with null editingReleaseId', () => {
      const { result } = renderHook(() => useReleases(), { wrapper });
      expect(result.current.editingReleaseId).toBeNull();
    });

    it('initializes with all touchedFields false', () => {
      const { result } = renderHook(() => useReleases(), { wrapper });
      expect(result.current.touchedFields).toEqual({
        startDate: false,
        earlyFinish: false,
        lateFinish: false,
        mostLikelyFinish: false,
      });
    });
  });

  describe('addRelease', () => {
    it('adds release with valid data and correct projectId', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [],
      });

      const { result } = renderHook(() => useReleases(), { wrapper });

      act(() => {
        result.current.setReleaseName('New Release');
        result.current.setStartDate('2026-02-01');
        result.current.setEarlyFinish('2026-04-01');
        result.current.setLateFinish('2026-06-01');
      });

      act(() => {
        result.current.addRelease('p1');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases).toHaveLength(1);
      expect(stored.releases[0].name).toBe('New Release');
      expect(stored.releases[0].projectId).toBe('p1');
      expect(stored.releases[0].startDate).toBe('2026-02-01');
      expect(stored.releases[0].earlyFinishDate).toBe('2026-04-01');
      expect(stored.releases[0].lateFinishDate).toBe('2026-06-01');
    });

    it('trims release name before saving', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [],
      });

      const { result } = renderHook(() => useReleases(), { wrapper });

      act(() => {
        result.current.setReleaseName('  Trimmed Name  ');
        result.current.setStartDate('2026-01-01');
        result.current.setEarlyFinish('2026-03-01');
        result.current.setLateFinish('2026-06-01');
      });

      act(() => {
        result.current.addRelease('p1');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases[0].name).toBe('Trimmed Name');
    });

    it('marks all fields as touched before validation', () => {
      const { result } = renderHook(() => useReleases(), { wrapper });

      act(() => {
        result.current.addRelease('p1');
      });

      expect(result.current.touchedFields).toEqual({
        startDate: true,
        earlyFinish: true,
        lateFinish: true,
        mostLikelyFinish: true,
      });
    });

    it('does not add when releaseName is empty', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [],
      });

      const { result } = renderHook(() => useReleases(), { wrapper });

      act(() => {
        result.current.setStartDate('2026-01-01');
        result.current.setEarlyFinish('2026-03-01');
        result.current.setLateFinish('2026-06-01');
      });

      act(() => {
        result.current.addRelease('p1');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases).toHaveLength(0);
    });

    it('does not add when releaseName is whitespace only', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [],
      });

      const { result } = renderHook(() => useReleases(), { wrapper });

      act(() => {
        result.current.setReleaseName('   ');
        result.current.setStartDate('2026-01-01');
        result.current.setEarlyFinish('2026-03-01');
        result.current.setLateFinish('2026-06-01');
      });

      act(() => {
        result.current.addRelease('p1');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases).toHaveLength(0);
    });

    it('does not add when selectedProjectId is empty', () => {
      const { result } = renderHook(() => useReleases(), { wrapper });

      act(() => {
        result.current.setReleaseName('Release');
        result.current.setStartDate('2026-01-01');
        result.current.setEarlyFinish('2026-03-01');
        result.current.setLateFinish('2026-06-01');
      });

      act(() => {
        result.current.addRelease('');
      });

      const stored = localStorage.getItem('ganttAppData');
      if (stored) {
        expect(JSON.parse(stored).releases).toHaveLength(0);
      }
    });

    it('does not add when startDate is empty', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [],
      });

      const { result } = renderHook(() => useReleases(), { wrapper });

      act(() => {
        result.current.setReleaseName('Release');
        result.current.setEarlyFinish('2026-03-01');
        result.current.setLateFinish('2026-06-01');
      });

      act(() => {
        result.current.addRelease('p1');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases).toHaveLength(0);
    });

    it('does not add when dates fail isValidDateFormat', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [],
      });

      const { result } = renderHook(() => useReleases(), { wrapper });

      act(() => {
        result.current.setReleaseName('Release');
        result.current.setStartDate('1999-01-01'); // out of 2000-2050 range
        result.current.setEarlyFinish('2026-03-01');
        result.current.setLateFinish('2026-06-01');
      });

      act(() => {
        result.current.addRelease('p1');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases).toHaveLength(0);
    });

    it('clears form after successful add', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [],
      });

      const { result } = renderHook(() => useReleases(), { wrapper });

      act(() => {
        result.current.setReleaseName('Release');
        result.current.setStartDate('2026-01-01');
        result.current.setEarlyFinish('2026-03-01');
        result.current.setLateFinish('2026-06-01');
      });

      act(() => {
        result.current.addRelease('p1');
      });

      expect(result.current.releaseName).toBe('');
      expect(result.current.startDate).toBe('');
      expect(result.current.earlyFinish).toBe('');
      expect(result.current.lateFinish).toBe('');
      expect(result.current.editingReleaseId).toBeNull();
      expect(result.current.touchedFields).toEqual({
        startDate: false,
        earlyFinish: false,
        lateFinish: false,
        mostLikelyFinish: false,
      });
    });

    it('generates unique id for each release', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [],
      });

      const { result } = renderHook(() => useReleases(), { wrapper });

      act(() => {
        result.current.setReleaseName('First');
        result.current.setStartDate('2026-01-01');
        result.current.setEarlyFinish('2026-03-01');
        result.current.setLateFinish('2026-06-01');
      });

      act(() => {
        result.current.addRelease('p1');
      });

      act(() => {
        result.current.setReleaseName('Second');
        result.current.setStartDate('2026-02-01');
        result.current.setEarlyFinish('2026-04-01');
        result.current.setLateFinish('2026-07-01');
      });

      act(() => {
        result.current.addRelease('p1');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases).toHaveLength(2);
      expect(stored.releases[0].id).not.toBe(stored.releases[1].id);
    });
  });

  describe('updateRelease', () => {
    it('updates release fields when valid', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1', projectId: 'p1', name: 'Original' })],
      });

      const { result } = renderHook(() => useReleases(), { wrapper });

      act(() => {
        result.current.startEditRelease(makeRelease({ id: 'r1', name: 'Original' }));
      });

      act(() => {
        result.current.setReleaseName('Updated');
        result.current.setStartDate('2026-02-01');
        result.current.setEarlyFinish('2026-05-01');
        result.current.setLateFinish('2026-08-01');
      });

      act(() => {
        result.current.updateRelease();
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases[0].name).toBe('Updated');
      expect(stored.releases[0].startDate).toBe('2026-02-01');
      expect(stored.releases[0].earlyFinishDate).toBe('2026-05-01');
      expect(stored.releases[0].lateFinishDate).toBe('2026-08-01');
    });

    it('marks all fields as touched', () => {
      const { result } = renderHook(() => useReleases(), { wrapper });

      act(() => {
        result.current.updateRelease();
      });

      expect(result.current.touchedFields).toEqual({
        startDate: true,
        earlyFinish: true,
        lateFinish: true,
        mostLikelyFinish: true,
      });
    });

    it('does not update when releaseName is empty', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1', name: 'Keep This' })],
      });

      const { result } = renderHook(() => useReleases(), { wrapper });

      act(() => {
        result.current.startEditRelease(makeRelease({ id: 'r1', name: 'Keep This' }));
      });

      act(() => {
        result.current.setReleaseName('');
      });

      act(() => {
        result.current.updateRelease();
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases[0].name).toBe('Keep This');
    });

    it('does not update when editingReleaseId is null', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1', name: 'Original' })],
      });

      const { result } = renderHook(() => useReleases(), { wrapper });

      act(() => {
        result.current.setReleaseName('Should Not Save');
        result.current.setStartDate('2026-01-01');
        result.current.setEarlyFinish('2026-03-01');
        result.current.setLateFinish('2026-06-01');
      });

      act(() => {
        result.current.updateRelease();
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases[0].name).toBe('Original');
    });

    it('does not update when dates fail validation', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1', name: 'Original' })],
      });

      const { result } = renderHook(() => useReleases(), { wrapper });

      act(() => {
        result.current.startEditRelease(makeRelease({ id: 'r1', name: 'Original' }));
      });

      act(() => {
        result.current.setReleaseName('Updated');
        result.current.setStartDate('2051-01-01'); // out of range
        result.current.setEarlyFinish('2026-03-01');
        result.current.setLateFinish('2026-06-01');
      });

      act(() => {
        result.current.updateRelease();
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases[0].name).toBe('Original');
    });

    it('only modifies the targeted release, leaving others unchanged', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [
          makeRelease({ id: 'r1', name: 'First' }),
          makeRelease({ id: 'r2', name: 'Second' }),
        ],
      });

      const { result } = renderHook(() => useReleases(), { wrapper });

      act(() => {
        result.current.startEditRelease(makeRelease({ id: 'r1', name: 'First' }));
      });

      act(() => {
        result.current.setReleaseName('Updated First');
      });

      act(() => {
        result.current.updateRelease();
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases[0].name).toBe('Updated First');
      expect(stored.releases[1].name).toBe('Second');
    });
  });

  describe('deleteRelease', () => {
    it('removes release by id', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1' }), makeRelease({ id: 'r2', name: 'Second' })],
      });

      const { result } = renderHook(() => useReleases(), { wrapper });

      act(() => {
        result.current.deleteRelease('r1');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases).toHaveLength(1);
      expect(stored.releases[0].id).toBe('r2');
    });

    it('does not affect other releases', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [
          makeRelease({ id: 'r1', name: 'First' }),
          makeRelease({ id: 'r2', name: 'Second' }),
          makeRelease({ id: 'r3', name: 'Third' }),
        ],
      });

      const { result } = renderHook(() => useReleases(), { wrapper });

      act(() => {
        result.current.deleteRelease('r2');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases).toHaveLength(2);
      expect(stored.releases[0].name).toBe('First');
      expect(stored.releases[1].name).toBe('Third');
    });
  });

  describe('startEditRelease', () => {
    it('populates form with release data', () => {
      const { result } = renderHook(() => useReleases(), { wrapper });

      act(() => {
        result.current.startEditRelease(makeRelease({
          id: 'r1',
          name: 'Edit Me',
          startDate: '2026-02-15',
          earlyFinishDate: '2026-04-15',
          lateFinishDate: '2026-07-15',
        }));
      });

      expect(result.current.releaseName).toBe('Edit Me');
      expect(result.current.startDate).toBe('2026-02-15');
      expect(result.current.earlyFinish).toBe('2026-04-15');
      expect(result.current.lateFinish).toBe('2026-07-15');
      expect(result.current.editingReleaseId).toBe('r1');
    });
  });

  describe('clearReleaseForm', () => {
    it('resets all form fields and touchedFields', () => {
      const { result } = renderHook(() => useReleases(), { wrapper });

      act(() => {
        result.current.setReleaseName('Some Name');
        result.current.setStartDate('2026-01-01');
        result.current.setEarlyFinish('2026-03-01');
        result.current.setLateFinish('2026-06-01');
        result.current.setTouchedFields({ startDate: true, earlyFinish: true, lateFinish: true });
      });

      act(() => {
        result.current.clearReleaseForm();
      });

      expect(result.current.releaseName).toBe('');
      expect(result.current.startDate).toBe('');
      expect(result.current.earlyFinish).toBe('');
      expect(result.current.lateFinish).toBe('');
      expect(result.current.editingReleaseId).toBeNull();
      expect(result.current.touchedFields).toEqual({
        startDate: false,
        earlyFinish: false,
        lateFinish: false,
        mostLikelyFinish: false,
      });
    });
  });

  describe('toggleReleaseHidden', () => {
    it('toggles hidden from undefined/false to true', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1' })],
      });

      const { result } = renderHook(() => useReleases(), { wrapper });

      act(() => {
        result.current.toggleReleaseHidden('r1');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases[0].hidden).toBe(true);
    });

    it('toggles hidden from true to false', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1', hidden: true })],
      });

      const { result } = renderHook(() => useReleases(), { wrapper });

      act(() => {
        result.current.toggleReleaseHidden('r1');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases[0].hidden).toBe(false);
    });
  });

  describe('toggleReleaseCompleted', () => {
    it('toggles completed from undefined/false to true', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1' })],
      });

      const { result } = renderHook(() => useReleases(), { wrapper });

      act(() => {
        result.current.toggleReleaseCompleted('r1');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases[0].completed).toBe(true);
    });

    it('toggles completed from true to false', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1', completed: true })],
      });

      const { result } = renderHook(() => useReleases(), { wrapper });

      act(() => {
        result.current.toggleReleaseCompleted('r1');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases[0].completed).toBe(false);
    });
  });
});
