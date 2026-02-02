import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { AppDataProvider, useAppData } from '../../../context/AppDataContext';
import { useProjects } from '../useProjects';
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

describe('useProjects', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('initializes with empty projectName', () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      expect(result.current.projectName).toBe('');
    });

    it('initializes with empty projectFinishDate', () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      expect(result.current.projectFinishDate).toBe('');
    });

    it('initializes with null editingProjectId', () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      expect(result.current.editingProjectId).toBeNull();
    });
  });

  describe('addProject', () => {
    it('adds project with generated id and trimmed name', () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      const setSelectedProjectId = vi.fn();

      act(() => {
        result.current.setProjectName('  New Project  ');
      });

      act(() => {
        result.current.addProject('', setSelectedProjectId);
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects).toHaveLength(1);
      expect(stored.projects[0].name).toBe('New Project');
      expect(stored.projects[0].id).toBeTruthy();
    });

    it('adds project with finish date when provided', () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      const setSelectedProjectId = vi.fn();

      act(() => {
        result.current.setProjectName('Project With Date');
        result.current.setProjectFinishDate('2026-12-31');
      });

      act(() => {
        result.current.addProject('', setSelectedProjectId);
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects[0].finishDate).toBe('2026-12-31');
    });

    it('adds project without finish date when not provided', () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      const setSelectedProjectId = vi.fn();

      act(() => {
        result.current.setProjectName('Project No Date');
      });

      act(() => {
        result.current.addProject('', setSelectedProjectId);
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects[0].finishDate).toBeUndefined();
    });

    it('does not add project when name is empty', () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      const setSelectedProjectId = vi.fn();

      act(() => {
        result.current.addProject('', setSelectedProjectId);
      });

      const stored = localStorage.getItem('ganttAppData');
      if (stored) {
        expect(JSON.parse(stored).projects).toHaveLength(0);
      }
    });

    it('does not add project when name is whitespace only', () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      const setSelectedProjectId = vi.fn();

      act(() => {
        result.current.setProjectName('   ');
      });

      act(() => {
        result.current.addProject('', setSelectedProjectId);
      });

      const stored = localStorage.getItem('ganttAppData');
      if (stored) {
        expect(JSON.parse(stored).projects).toHaveLength(0);
      }
    });

    it('clears projectName and projectFinishDate after adding', () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      const setSelectedProjectId = vi.fn();

      act(() => {
        result.current.setProjectName('Test');
        result.current.setProjectFinishDate('2026-06-15');
      });

      act(() => {
        result.current.addProject('', setSelectedProjectId);
      });

      expect(result.current.projectName).toBe('');
      expect(result.current.projectFinishDate).toBe('');
    });

    it('auto-selects the new project when no project is selected', () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      const setSelectedProjectId = vi.fn();

      act(() => {
        result.current.setProjectName('Auto Select');
      });

      act(() => {
        result.current.addProject('', setSelectedProjectId);
      });

      expect(setSelectedProjectId).toHaveBeenCalledTimes(1);
      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(setSelectedProjectId).toHaveBeenCalledWith(stored.projects[0].id);
    });

    it('does not change selection when a project is already selected', () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      const setSelectedProjectId = vi.fn();

      act(() => {
        result.current.setProjectName('Second Project');
      });

      act(() => {
        result.current.addProject('existing-id', setSelectedProjectId);
      });

      expect(setSelectedProjectId).not.toHaveBeenCalled();
    });
  });

  describe('updateProject', () => {
    it('updates project name and finish date', () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Original' })],
        releases: [],
      });

      const { result } = renderHook(() => useProjects(), { wrapper });

      act(() => {
        result.current.startEditProject(makeProject({ id: 'p1', name: 'Original' }));
      });

      act(() => {
        result.current.setProjectName('Updated');
        result.current.setProjectFinishDate('2026-10-15');
      });

      act(() => {
        result.current.updateProject();
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects[0].name).toBe('Updated');
      expect(stored.projects[0].finishDate).toBe('2026-10-15');
    });

    it('removes finish date when cleared (sets undefined)', () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'With Date', finishDate: '2026-12-31' })],
        releases: [],
      });

      const { result } = renderHook(() => useProjects(), { wrapper });

      act(() => {
        result.current.startEditProject(makeProject({ id: 'p1', name: 'With Date', finishDate: '2026-12-31' }));
      });

      act(() => {
        result.current.setProjectFinishDate('');
      });

      act(() => {
        result.current.updateProject();
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects[0].finishDate).toBeUndefined();
    });

    it('does not update when name is empty', () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Keep This' })],
        releases: [],
      });

      const { result } = renderHook(() => useProjects(), { wrapper });

      act(() => {
        result.current.startEditProject(makeProject({ id: 'p1', name: 'Keep This' }));
      });

      act(() => {
        result.current.setProjectName('');
      });

      act(() => {
        result.current.updateProject();
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects[0].name).toBe('Keep This');
    });

    it('does not update when editingProjectId is null', () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Original' })],
        releases: [],
      });

      const { result } = renderHook(() => useProjects(), { wrapper });

      act(() => {
        result.current.setProjectName('Should Not Save');
      });

      act(() => {
        result.current.updateProject();
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects[0].name).toBe('Original');
    });

    it('clears form state after update', () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Original' })],
        releases: [],
      });

      const { result } = renderHook(() => useProjects(), { wrapper });

      act(() => {
        result.current.startEditProject(makeProject({ id: 'p1', name: 'Original' }));
      });

      act(() => {
        result.current.updateProject();
      });

      expect(result.current.projectName).toBe('');
      expect(result.current.projectFinishDate).toBe('');
      expect(result.current.editingProjectId).toBeNull();
    });
  });

  describe('deleteProject', () => {
    it('removes the project from data', () => {
      seedData({
        projects: [makeProject({ id: 'p1' }), makeProject({ id: 'p2', name: 'Second' })],
        releases: [],
      });

      const { result } = renderHook(() => useProjects(), { wrapper });
      const setSelectedProjectId = vi.fn();

      act(() => {
        result.current.deleteProject('p1', 'p2', setSelectedProjectId);
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects).toHaveLength(1);
      expect(stored.projects[0].id).toBe('p2');
    });

    it('cascades: removes all releases belonging to deleted project', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [
          makeRelease({ id: 'r1', projectId: 'p1' }),
          makeRelease({ id: 'r2', projectId: 'p1' }),
          makeRelease({ id: 'r3', projectId: 'p2' }),
        ],
      });

      const { result } = renderHook(() => useProjects(), { wrapper });
      const setSelectedProjectId = vi.fn();

      act(() => {
        result.current.deleteProject('p1', 'p1', setSelectedProjectId);
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases).toHaveLength(1);
      expect(stored.releases[0].id).toBe('r3');
    });

    it('updates selectedProjectId to first remaining project when deleting selected', () => {
      seedData({
        projects: [makeProject({ id: 'p1' }), makeProject({ id: 'p2', name: 'Second' })],
        releases: [],
      });

      const { result } = renderHook(() => useProjects(), { wrapper });
      const setSelectedProjectId = vi.fn();

      act(() => {
        result.current.deleteProject('p1', 'p1', setSelectedProjectId);
      });

      expect(setSelectedProjectId).toHaveBeenCalledWith('p2');
    });

    it('sets selectedProjectId to empty string when deleting last project', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [],
      });

      const { result } = renderHook(() => useProjects(), { wrapper });
      const setSelectedProjectId = vi.fn();

      act(() => {
        result.current.deleteProject('p1', 'p1', setSelectedProjectId);
      });

      expect(setSelectedProjectId).toHaveBeenCalledWith('');
    });
  });

  describe('startEditProject', () => {
    it('populates form with project name and finish date', () => {
      const { result } = renderHook(() => useProjects(), { wrapper });

      act(() => {
        result.current.startEditProject(makeProject({ id: 'p1', name: 'Edit Me', finishDate: '2026-08-01' }));
      });

      expect(result.current.projectName).toBe('Edit Me');
      expect(result.current.projectFinishDate).toBe('2026-08-01');
      expect(result.current.editingProjectId).toBe('p1');
    });

    it('handles project without finish date (sets empty string)', () => {
      const { result } = renderHook(() => useProjects(), { wrapper });

      act(() => {
        result.current.startEditProject(makeProject({ id: 'p1', name: 'No Date' }));
      });

      expect(result.current.projectFinishDate).toBe('');
    });
  });

  describe('cancelEditProject', () => {
    it('clears projectName, projectFinishDate, and editingProjectId', () => {
      const { result } = renderHook(() => useProjects(), { wrapper });

      act(() => {
        result.current.startEditProject(makeProject({ id: 'p1', name: 'In Edit', finishDate: '2026-09-01' }));
      });

      expect(result.current.editingProjectId).toBe('p1');

      act(() => {
        result.current.cancelEditProject();
      });

      expect(result.current.projectName).toBe('');
      expect(result.current.projectFinishDate).toBe('');
      expect(result.current.editingProjectId).toBeNull();
    });
  });
});
