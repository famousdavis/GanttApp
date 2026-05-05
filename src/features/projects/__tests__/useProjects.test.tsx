// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { AppDataProvider, useAppData } from '../../../context/AppDataContext';
import { StorageProvider } from '../../../context/StorageContext';
import { AuthProvider } from '../../../context/AuthContext';
import { useProjects } from '../useProjects';
import { AppData } from '../../../shared/types/app';
import { Project, Release } from '../../../shared/types/models';

// Mock firebase modules
vi.mock('../../../lib/firebase', () => ({
  auth: null,
  db: null,
  isFirebaseAvailable: false,
  getSendInvitationEmail: () => null,
  getClaimPendingInvitations: () => null,
  getRevokeInvite: () => null,
  getResendInvite: () => null,
}));

const mockOnAuthStateChanged = vi.fn();
vi.mock('firebase/auth', () => {
  class MockGoogleAuthProvider { addScope = vi.fn(); }
  class MockOAuthProvider { addScope = vi.fn(); constructor(_id: string) {} }
  return {
    onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    GoogleAuthProvider: MockGoogleAuthProvider,
    OAuthProvider: MockOAuthProvider,
  };
});

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  collection: vi.fn(),
  writeBatch: vi.fn(() => ({ set: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) })),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider><StorageProvider><AppDataProvider>{children}</AppDataProvider></StorageProvider></AuthProvider>;
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

/** Renders useProjects alongside useAppData so we can wait for async data load. */
function renderProjectsHook() {
  return renderHook(() => {
    const projects = useProjects();
    const { data } = useAppData();
    return { ...projects, data };
  }, { wrapper });
}

describe('useProjects', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: null) => void) => {
      callback(null);
      return vi.fn();
    });
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

    it('omits owner field in local mode (v0.20.1)', () => {
      // Regression for v0.20.1: addProject only seeds `owner` in cloud mode.
      // Local mode stores plain Project objects with no owner.
      const { result } = renderHook(() => useProjects(), { wrapper });
      const setSelectedProjectId = vi.fn();

      act(() => {
        result.current.setProjectName('Local-mode Project');
      });

      act(() => {
        result.current.addProject('', setSelectedProjectId);
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects[0].owner).toBeUndefined();
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
    it('updates project name and finish date', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Original' })],
        releases: [],
      });

      const { result } = renderProjectsHook();

      await waitFor(() => {
        expect(result.current.data.projects.length).toBe(1);
      });

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

    it('removes finish date when cleared (sets undefined)', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'With Date', finishDate: '2026-12-31' })],
        releases: [],
      });

      const { result } = renderProjectsHook();

      await waitFor(() => {
        expect(result.current.data.projects.length).toBe(1);
      });

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
    it('removes the project from data', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' }), makeProject({ id: 'p2', name: 'Second' })],
        releases: [],
      });

      const { result } = renderProjectsHook();
      const setSelectedProjectId = vi.fn();

      await waitFor(() => {
        expect(result.current.data.projects.length).toBe(2);
      });

      await act(async () => {
        await result.current.deleteProject('p1', 'p2', setSelectedProjectId);
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects).toHaveLength(1);
      expect(stored.projects[0].id).toBe('p2');
    });

    it('cascades: removes all releases belonging to deleted project', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [
          makeRelease({ id: 'r1', projectId: 'p1' }),
          makeRelease({ id: 'r2', projectId: 'p1' }),
          makeRelease({ id: 'r3', projectId: 'p2' }),
        ],
      });

      const { result } = renderProjectsHook();
      const setSelectedProjectId = vi.fn();

      await waitFor(() => {
        expect(result.current.data.projects.length).toBe(1);
      });

      await act(async () => {
        await result.current.deleteProject('p1', 'p1', setSelectedProjectId);
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases).toHaveLength(1);
      expect(stored.releases[0].id).toBe('r3');
    });

    it('updates selectedProjectId to first remaining project when deleting selected', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' }), makeProject({ id: 'p2', name: 'Second' })],
        releases: [],
      });

      const { result } = renderProjectsHook();
      const setSelectedProjectId = vi.fn();

      await waitFor(() => {
        expect(result.current.data.projects.length).toBe(2);
      });

      await act(async () => {
        await result.current.deleteProject('p1', 'p1', setSelectedProjectId);
      });

      expect(setSelectedProjectId).toHaveBeenCalledWith('p2');
    });

    it('sets selectedProjectId to empty string when deleting last project', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [],
      });

      const { result } = renderProjectsHook();
      const setSelectedProjectId = vi.fn();

      await waitFor(() => {
        expect(result.current.data.projects.length).toBe(1);
      });

      await act(async () => {
        await result.current.deleteProject('p1', 'p1', setSelectedProjectId);
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

  describe('projectWorkDays (v15.0)', () => {
    it('projectWorkDays state initializes as undefined', () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      expect(result.current.projectWorkDays).toBeUndefined();
    });

    it('addProject includes workDays when set', () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      const setSelectedProjectId = vi.fn();

      act(() => {
        result.current.setProjectName('Work Days Project');
        result.current.setProjectWorkDays([1, 2, 3, 4, 5]);
      });

      act(() => {
        result.current.addProject('', setSelectedProjectId);
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects[0].workDays).toEqual([1, 2, 3, 4, 5]);
    });

    it('addProject omits workDays when undefined', () => {
      const { result } = renderHook(() => useProjects(), { wrapper });
      const setSelectedProjectId = vi.fn();

      act(() => {
        result.current.setProjectName('No Work Days');
      });

      act(() => {
        result.current.addProject('', setSelectedProjectId);
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects[0].workDays).toBeUndefined();
    });

    it('updateProject clears workDays when state is undefined', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Has Days', workDays: [1, 2, 3] })],
        releases: [],
      });

      const { result } = renderProjectsHook();

      await waitFor(() => {
        expect(result.current.data.projects.length).toBe(1);
      });

      act(() => {
        result.current.startEditProject(makeProject({ id: 'p1', name: 'Has Days', workDays: [1, 2, 3] }));
      });

      act(() => {
        result.current.setProjectWorkDays(undefined);
      });

      act(() => {
        result.current.updateProject();
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects[0].workDays).toBeUndefined();
    });

    it('startEditProject populates projectWorkDays from project.workDays', () => {
      const { result } = renderHook(() => useProjects(), { wrapper });

      act(() => {
        result.current.startEditProject(makeProject({ id: 'p1', name: 'Custom Week', workDays: [0, 1, 2, 3, 4] }));
      });

      expect(result.current.projectWorkDays).toEqual([0, 1, 2, 3, 4]);
    });

    it('cancelEditProject resets projectWorkDays to undefined', () => {
      const { result } = renderHook(() => useProjects(), { wrapper });

      act(() => {
        result.current.startEditProject(makeProject({ id: 'p1', name: 'Custom', workDays: [1, 2, 3] }));
      });

      expect(result.current.projectWorkDays).toEqual([1, 2, 3]);

      act(() => {
        result.current.cancelEditProject();
      });

      expect(result.current.projectWorkDays).toBeUndefined();
    });
  });

  // ==========================================================================
  // v19.0 — cloneProject
  // ==========================================================================
  describe('cloneProject (v19.0)', () => {
    it('clones a project with " - Copy (1)" suffix on first clone', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Source' })],
        releases: [],
      });

      const { result } = renderProjectsHook();
      await waitFor(() => expect(result.current.data.projects.length).toBe(1));

      await act(async () => {
        await result.current.cloneProject('p1');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects).toHaveLength(2);
      expect(stored.projects.map((p: Project) => p.name)).toEqual(['Source', 'Source - Copy (1)']);
    });

    it('does not propagate source.owner to the clone in local mode (v0.20.1)', async () => {
      // Regression for v0.20.1 Gap C: cloneProject must not blindly carry
      // source.owner into the clone. In local mode, owner should be omitted.
      // (In cloud mode it's rebound to the current user.uid, but this test
      // runs with isFirebaseAvailable=false → local mode.)
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Source', owner: 'foreign-uid-from-shared-project' })],
        releases: [],
      });

      const { result } = renderProjectsHook();
      await waitFor(() => expect(result.current.data.projects.length).toBe(1));

      await act(async () => {
        await result.current.cloneProject('p1');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      const clone = stored.projects.find((p: Project) => p.name === 'Source - Copy (1)');
      expect(clone).toBeDefined();
      expect(clone.owner).toBeUndefined();
    });

    it('uses " - Copy (2)" when " - Copy (1)" already exists', async () => {
      seedData({
        projects: [
          makeProject({ id: 'p1', name: 'Source' }),
          makeProject({ id: 'p2', name: 'Source - Copy (1)' }),
        ],
        releases: [],
      });

      const { result } = renderProjectsHook();
      await waitFor(() => expect(result.current.data.projects.length).toBe(2));

      await act(async () => {
        await result.current.cloneProject('p1');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      const cloneNames = stored.projects.map((p: Project) => p.name).filter((n: string) => n.startsWith('Source - Copy'));
      expect(cloneNames).toContain('Source - Copy (1)');
      expect(cloneNames).toContain('Source - Copy (2)');
    });

    it('skips through " - Copy (1)" through " - Copy (3)" to land on " - Copy (4)"', async () => {
      seedData({
        projects: [
          makeProject({ id: 'p1', name: 'Source' }),
          makeProject({ id: 'p2', name: 'Source - Copy (1)' }),
          makeProject({ id: 'p3', name: 'Source - Copy (2)' }),
          makeProject({ id: 'p4', name: 'Source - Copy (3)' }),
        ],
        releases: [],
      });

      const { result } = renderProjectsHook();
      await waitFor(() => expect(result.current.data.projects.length).toBe(4));

      await act(async () => {
        await result.current.cloneProject('p1');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects.map((p: Project) => p.name)).toContain('Source - Copy (4)');
    });

    it('inserts the cloned project immediately after the source', async () => {
      seedData({
        projects: [
          makeProject({ id: 'p1', name: 'First' }),
          makeProject({ id: 'p2', name: 'Source' }),
          makeProject({ id: 'p3', name: 'Last' }),
        ],
        releases: [],
      });

      const { result } = renderProjectsHook();
      await waitFor(() => expect(result.current.data.projects.length).toBe(3));

      await act(async () => {
        await result.current.cloneProject('p2');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects.map((p: Project) => p.name)).toEqual([
        'First', 'Source', 'Source - Copy (1)', 'Last',
      ]);
    });

    it('clones releases with new IDs and the cloned project ID', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Source' })],
        releases: [
          makeRelease({ id: 'r1', projectId: 'p1', name: 'Rel 1' }),
          makeRelease({ id: 'r2', projectId: 'p1', name: 'Rel 2' }),
        ],
      });

      const { result } = renderProjectsHook();
      await waitFor(() => expect(result.current.data.projects.length).toBe(1));

      await act(async () => {
        await result.current.cloneProject('p1');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      const cloned = stored.projects.find((p: Project) => p.name === 'Source - Copy (1)');
      const clonedReleases = stored.releases.filter((r: Release) => r.projectId === cloned.id);
      expect(clonedReleases).toHaveLength(2);
      expect(clonedReleases.map((r: Release) => r.name).sort()).toEqual(['Rel 1', 'Rel 2']);
      // New IDs (different from source)
      const clonedIds = clonedReleases.map((r: Release) => r.id);
      expect(clonedIds).not.toContain('r1');
      expect(clonedIds).not.toContain('r2');
    });

    it('does nothing when projectId is unknown (no throw, no data change)', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Source' })],
        releases: [],
      });

      const { result } = renderProjectsHook();
      await waitFor(() => expect(result.current.data.projects.length).toBe(1));

      await act(async () => {
        await result.current.cloneProject('does-not-exist');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects).toHaveLength(1);
    });

    it('does not call saveSnapshots when source has zero snapshots', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Source' })],
        releases: [],
      });

      const { result } = renderProjectsHook();
      await waitFor(() => expect(result.current.data.projects.length).toBe(1));

      await act(async () => {
        await result.current.cloneProject('p1');
      });

      const storedSnapshots = localStorage.getItem('ganttAppSnapshots');
      // Either null (never written) or an empty array — both indicate no clone snapshot write
      if (storedSnapshots) {
        expect(JSON.parse(storedSnapshots)).toEqual([]);
      }
    });

    it('clones snapshots when the source has them and cap allows', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Source' })],
        releases: [],
      });
      // Seed two snapshots for the source project
      const snapshots = [
        { id: 's1', projectId: 'p1', timestamp: '2026-01-01T00:00:00Z', name: 'Snap 1', releases: [] },
        { id: 's2', projectId: 'p1', timestamp: '2026-01-02T00:00:00Z', name: 'Snap 2', releases: [] },
      ];
      localStorage.setItem('ganttAppSnapshots', JSON.stringify(snapshots));

      const { result } = renderProjectsHook();
      await waitFor(() => expect(result.current.data.projects.length).toBe(1));

      await act(async () => {
        await result.current.cloneProject('p1');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      const cloned = stored.projects.find((p: Project) => p.name === 'Source - Copy (1)');
      const allSnapshots = JSON.parse(localStorage.getItem('ganttAppSnapshots')!);
      expect(allSnapshots).toHaveLength(4); // 2 original + 2 cloned
      const clonedSnaps = allSnapshots.filter((s: { projectId: string }) => s.projectId === cloned.id);
      expect(clonedSnaps).toHaveLength(2);
      // New IDs
      expect(clonedSnaps.map((s: { id: string }) => s.id)).not.toContain('s1');
      expect(clonedSnaps.map((s: { id: string }) => s.id)).not.toContain('s2');
    });

    it('skips snapshot cloning and alerts when it would exceed the cap', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Source' })],
        releases: [],
      });
      // Seed 99 snapshots (cap = 100). Source has 2 → would be 101, over cap.
      const snapshots = [];
      for (let i = 0; i < 97; i += 1) {
        snapshots.push({ id: `other-${i}`, projectId: 'p2', timestamp: '2026-01-01T00:00:00Z', name: `Other ${i}`, releases: [] });
      }
      snapshots.push({ id: 's1', projectId: 'p1', timestamp: '2026-01-01T00:00:00Z', name: 'Snap 1', releases: [] });
      snapshots.push({ id: 's2', projectId: 'p1', timestamp: '2026-01-02T00:00:00Z', name: 'Snap 2', releases: [] });
      localStorage.setItem('ganttAppSnapshots', JSON.stringify(snapshots));

      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      const { result } = renderProjectsHook();
      await waitFor(() => expect(result.current.data.projects.length).toBe(1));

      await act(async () => {
        await result.current.cloneProject('p1');
      });

      // Project + releases still cloned
      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects).toHaveLength(2);

      // Alert was fired
      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy.mock.calls[0][0]).toMatch(/snapshots/i);

      // Snapshots NOT cloned (still 99)
      const allSnapshots = JSON.parse(localStorage.getItem('ganttAppSnapshots')!);
      expect(allSnapshots).toHaveLength(99);

      alertSpy.mockRestore();
    });
  });
});
