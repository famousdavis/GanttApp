// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { AppDataProvider, useAppData } from '../../../context/AppDataContext';
import { StorageProvider } from '../../../context/StorageContext';
import { AuthProvider } from '../../../context/AuthContext';
import { useReleases } from '../useReleases';
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

/** Renders useReleases alongside useAppData so we can wait for async data load. */
function renderReleasesHook() {
  return renderHook(() => {
    const releases = useReleases();
    const { data } = useAppData();
    return { ...releases, data };
  }, { wrapper });
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
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: null) => void) => {
      callback(null);
      return vi.fn();
    });
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
    it('updates release fields when valid', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1', projectId: 'p1', name: 'Original' })],
      });

      const { result } = renderReleasesHook();

      await waitFor(() => {
        expect(result.current.data.releases.length).toBe(1);
      });

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

    it('only modifies the targeted release, leaving others unchanged', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [
          makeRelease({ id: 'r1', name: 'First' }),
          makeRelease({ id: 'r2', name: 'Second' }),
        ],
      });

      const { result } = renderReleasesHook();

      await waitFor(() => {
        expect(result.current.data.releases.length).toBe(2);
      });

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
    it('removes release by id', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1' }), makeRelease({ id: 'r2', name: 'Second' })],
      });

      const { result } = renderReleasesHook();

      await waitFor(() => {
        expect(result.current.data.releases.length).toBe(2);
      });

      act(() => {
        result.current.deleteRelease('r1');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases).toHaveLength(1);
      expect(stored.releases[0].id).toBe('r2');
    });

    it('does not affect other releases', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [
          makeRelease({ id: 'r1', name: 'First' }),
          makeRelease({ id: 'r2', name: 'Second' }),
          makeRelease({ id: 'r3', name: 'Third' }),
        ],
      });

      const { result } = renderReleasesHook();

      await waitFor(() => {
        expect(result.current.data.releases.length).toBe(3);
      });

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
        result.current.setTouchedFields({ startDate: true, earlyFinish: true, lateFinish: true, mostLikelyFinish: true });
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
    it('toggles hidden from undefined/false to true', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1' })],
      });

      const { result } = renderReleasesHook();

      await waitFor(() => {
        expect(result.current.data.releases.length).toBe(1);
      });

      act(() => {
        result.current.toggleReleaseHidden('r1');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases[0].hidden).toBe(true);
    });

    it('toggles hidden from true to false', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1', hidden: true })],
      });

      const { result } = renderReleasesHook();

      await waitFor(() => {
        expect(result.current.data.releases.length).toBe(1);
      });

      act(() => {
        result.current.toggleReleaseHidden('r1');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases[0].hidden).toBe(false);
    });
  });

  describe('setReleaseStatus', () => {
    it('sets status to in-progress', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1' })],
      });

      const { result } = renderReleasesHook();

      await waitFor(() => {
        expect(result.current.data.releases.length).toBe(1);
      });

      act(() => {
        result.current.setReleaseStatus('r1', 'in-progress');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases[0].status).toBe('in-progress');
    });

    it('sets status to complete', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1' })],
      });

      const { result } = renderReleasesHook();

      await waitFor(() => {
        expect(result.current.data.releases.length).toBe(1);
      });

      act(() => {
        result.current.setReleaseStatus('r1', 'complete');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases[0].status).toBe('complete');
    });

    it('omits status field when set to not-started', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1', status: 'complete' as const })],
      });

      const { result } = renderReleasesHook();

      await waitFor(() => {
        expect(result.current.data.releases.length).toBe(1);
      });

      act(() => {
        result.current.setReleaseStatus('r1', 'not-started');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases[0].status).toBeUndefined();
    });

    it('transitions from complete back to in-progress', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1', status: 'complete' as const })],
      });

      const { result } = renderReleasesHook();

      await waitFor(() => {
        expect(result.current.data.releases.length).toBe(1);
      });

      act(() => {
        result.current.setReleaseStatus('r1', 'in-progress');
      });

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases[0].status).toBe('in-progress');
    });
  });
});
