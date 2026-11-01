// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSnapshots } from '../useSnapshots';
import { AppDataProvider } from '../../../context/AppDataContext';
import * as StorageModule from '../../../context/StorageContext';
import { StorageProvider } from '../../../context/StorageContext';
import { AuthProvider } from '../../../context/AuthContext';
import { ThemeProvider } from '../../../context/ThemeContext';
import React from 'react';
import type { Snapshot } from '../../../shared/types';

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

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

const testSnapshot = {
  id: 'snap1',
  projectId: 'p1',
  timestamp: '2026-01-15T10:00:00.000Z',
  name: 'Sprint 1 Review',
  releases: [{
    id: 'r1',
    projectId: 'p1',
    name: 'Release 1',
    startDate: '2026-01-01',
    earlyFinishDate: '2026-02-01',
    lateFinishDate: '2026-03-01'
  }]
};

const testSnapshot2 = {
  id: 'snap2',
  projectId: 'p1',
  timestamp: '2026-02-01T10:00:00.000Z',
  name: 'Sprint 2 Review',
  releases: [{
    id: 'r1',
    projectId: 'p1',
    name: 'Release 1 Updated',
    startDate: '2026-01-01',
    earlyFinishDate: '2026-02-15',
    lateFinishDate: '2026-03-15'
  }]
};

const otherProjectSnapshot = {
  id: 'snap3',
  projectId: 'p2',
  timestamp: '2026-01-20T10:00:00.000Z',
  name: 'Other Project Snap',
  releases: []
};

const saveParams = {
  releases: [],
  chartColors: { solidBar: '#0070f3', hatchedBar: '#0070f3', todayLine: '#dc3545', finishDateLine: '#00ff00', mostLikelyLine: '#000000', completedBar: '#90ee90', inProgressBar: '#f59e0b' },
  legendLabels: { solidBar: 'Design', hatchedBar: 'Uncertainty' },
  preparedBy: 'William',
};

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <StorageProvider>
        <ThemeProvider>
          <AppDataProvider>
            {children}
          </AppDataProvider>
        </ThemeProvider>
      </StorageProvider>
    </AuthProvider>
  );
}

describe('useSnapshots', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.restoreAllMocks();
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: null) => void) => {
      callback(null);
      return vi.fn();
    });
  });

  it('returns empty snapshots when none stored', () => {
    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    expect(result.current.snapshots).toEqual([]);
    expect(result.current.activeSnapshotId).toBeNull();
    expect(result.current.activeSnapshot).toBeNull();
    expect(result.current.isViewingSnapshot).toBe(false);
  });

  it('loads snapshots from localStorage on mount', async () => {
    localStorageMock.setItem('ganttAppSnapshots', JSON.stringify([testSnapshot, testSnapshot2]));

    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    await waitFor(() => {
      expect(result.current.snapshots).toHaveLength(2);
    });
    expect(result.current.snapshots[0].name).toBe('Sprint 2 Review');
    expect(result.current.snapshots[1].name).toBe('Sprint 1 Review');
  });

  it('filters snapshots by project ID', async () => {
    localStorageMock.setItem('ganttAppSnapshots', JSON.stringify([testSnapshot, otherProjectSnapshot]));

    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    await waitFor(() => {
      expect(result.current.snapshots).toHaveLength(1);
    });
    expect(result.current.snapshots[0].id).toBe('snap1');
  });

  it('selects a snapshot by ID', async () => {
    localStorageMock.setItem('ganttAppSnapshots', JSON.stringify([testSnapshot]));

    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    await waitFor(() => {
      expect(result.current.snapshots).toHaveLength(1);
    });

    act(() => {
      result.current.setActiveSnapshotId('snap1');
    });

    expect(result.current.activeSnapshotId).toBe('snap1');
    expect(result.current.activeSnapshot).toBeTruthy();
    expect(result.current.activeSnapshot?.name).toBe('Sprint 1 Review');
    expect(result.current.isViewingSnapshot).toBe(true);
  });

  it('returns null activeSnapshot when Current view is selected', async () => {
    localStorageMock.setItem('ganttAppSnapshots', JSON.stringify([testSnapshot]));

    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    await waitFor(() => {
      expect(result.current.snapshots).toHaveLength(1);
    });

    act(() => {
      result.current.setActiveSnapshotId('snap1');
    });

    act(() => {
      result.current.setActiveSnapshotId(null);
    });

    expect(result.current.activeSnapshotId).toBeNull();
    expect(result.current.activeSnapshot).toBeNull();
    expect(result.current.isViewingSnapshot).toBe(false);
  });

  it('resets active snapshot when project changes', async () => {
    localStorageMock.setItem('ganttAppSnapshots', JSON.stringify([testSnapshot]));

    const { result, rerender } = renderHook(
      ({ projectId }) => useSnapshots(projectId),
      { wrapper, initialProps: { projectId: 'p1' } }
    );

    await waitFor(() => {
      expect(result.current.snapshots).toHaveLength(1);
    });

    act(() => {
      result.current.setActiveSnapshotId('snap1');
    });

    expect(result.current.isViewingSnapshot).toBe(true);

    // Switch project
    rerender({ projectId: 'p2' });

    expect(result.current.activeSnapshotId).toBeNull();
    expect(result.current.isViewingSnapshot).toBe(false);
  });

  it('saves a snapshot via prompt', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('My Snapshot');
    localStorageMock.setItem('ganttAppData', JSON.stringify({
      projects: [{ id: 'p1', name: 'Project 1' }],
      releases: []
    }));

    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    await act(async () => {
      await result.current.saveSnapshot({
        releases: [],
        chartColors: { solidBar: '#0070f3', hatchedBar: '#0070f3', todayLine: '#dc3545', finishDateLine: '#00ff00', mostLikelyLine: '#000000', completedBar: '#90ee90', inProgressBar: '#f59e0b' },
        legendLabels: { solidBar: 'Design', hatchedBar: 'Uncertainty' },
        preparedBy: 'William'
      });
    });

    expect(result.current.snapshots).toHaveLength(1);
    expect(result.current.snapshots[0].name).toBe('My Snapshot');
  });

  // v0.28.0 — the status date is frozen into the snapshot so a historical plan
  // keeps drawing its line where it was captured.
  it('freezes the status date onto the snapshot', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Sprint Review');

    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    await act(async () => {
      await result.current.saveSnapshot({
        releases: [],
        chartColors: { solidBar: '#0070f3', hatchedBar: '#0070f3', todayLine: '#dc3545', finishDateLine: '#00ff00', mostLikelyLine: '#000000', completedBar: '#90ee90', inProgressBar: '#f59e0b' },
        legendLabels: { solidBar: 'Design', hatchedBar: 'Uncertainty' },
        preparedBy: 'William',
        todayDateOverride: '2026-08-19'
      });
    });

    expect(result.current.snapshots[0].todayDateOverride).toBe('2026-08-19');
  });

  it('omits the status date key entirely when no override is set', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('No Status Date');

    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    await act(async () => {
      await result.current.saveSnapshot({
        releases: [],
        chartColors: { solidBar: '#0070f3', hatchedBar: '#0070f3', todayLine: '#dc3545', finishDateLine: '#00ff00', mostLikelyLine: '#000000', completedBar: '#90ee90', inProgressBar: '#f59e0b' },
        legendLabels: { solidBar: 'Design', hatchedBar: 'Uncertainty' },
        preparedBy: 'William',
        todayDateOverride: ''
      });
    });

    // Recorded as "drawn at the real date", not as an empty string.
    expect(result.current.snapshots[0].todayDateOverride).toBeUndefined();
    expect('todayDateOverride' in result.current.snapshots[0]).toBe(false);
  });

  it('does not save snapshot when user cancels prompt', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null);

    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    await act(async () => {
      await result.current.saveSnapshot({
        releases: [],
        chartColors: { solidBar: '#0070f3', hatchedBar: '#0070f3', todayLine: '#dc3545', finishDateLine: '#00ff00', mostLikelyLine: '#000000', completedBar: '#90ee90', inProgressBar: '#f59e0b' },
        legendLabels: { solidBar: 'Design', hatchedBar: 'Uncertainty' },
        preparedBy: ''
      });
    });

    expect(result.current.snapshots).toHaveLength(0);
  });

  it('deletes a snapshot directly (confirmation handled by caller)', async () => {
    localStorageMock.setItem('ganttAppSnapshots', JSON.stringify([testSnapshot, testSnapshot2]));

    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    await waitFor(() => {
      expect(result.current.snapshots).toHaveLength(2);
    });

    act(() => {
      result.current.setActiveSnapshotId('snap1');
    });

    await act(async () => {
      await result.current.deleteSnapshot('snap1');
    });

    expect(result.current.snapshots).toHaveLength(1);
    expect(result.current.snapshots[0].id).toBe('snap2');
    expect(result.current.activeSnapshotId).toBeNull();
  });

  it('replaces all snapshots', async () => {
    const newSnapshots = [testSnapshot, testSnapshot2, otherProjectSnapshot];
    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    await act(async () => {
      await result.current.replaceAllSnapshots(newSnapshots);
    });

    expect(result.current.snapshots).toHaveLength(2); // Only p1 snapshots
    expect(result.current.allSnapshots).toHaveLength(3); // All snapshots stored
  });

  it('accumulates multiple snapshots without overwriting', async () => {
    let promptCall = 0;
    vi.spyOn(window, 'prompt').mockImplementation(() => {
      promptCall += 1;
      return `Snapshot ${promptCall}`;
    });
    localStorageMock.setItem('ganttAppData', JSON.stringify({
      projects: [{ id: 'p1', name: 'Project 1' }],
      releases: []
    }));

    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    const saveParams = {
      releases: [],
      chartColors: { solidBar: '#0070f3', hatchedBar: '#0070f3', todayLine: '#dc3545', finishDateLine: '#00ff00', mostLikelyLine: '#000000', completedBar: '#90ee90', inProgressBar: '#f59e0b' },
      legendLabels: { solidBar: 'Design', hatchedBar: 'Uncertainty' },
      preparedBy: 'William'
    };

    // Save first snapshot
    await act(async () => {
      await result.current.saveSnapshot(saveParams);
    });

    expect(result.current.snapshots).toHaveLength(1);
    expect(result.current.snapshots[0].name).toBe('Snapshot 1');

    // Save second snapshot
    await act(async () => {
      await result.current.saveSnapshot(saveParams);
    });

    // Both snapshots must be present with distinct IDs (order not asserted —
    // timestamps may be identical when created in rapid succession)
    expect(result.current.snapshots).toHaveLength(2);
    const names = result.current.snapshots.map(s => s.name).sort();
    expect(names).toEqual(['Snapshot 1', 'Snapshot 2']);
    expect(result.current.snapshots[0].id).not.toBe(result.current.snapshots[1].id);
  });

  it('sorts snapshots by timestamp descending (newest first)', async () => {
    // Store in chronological order
    localStorageMock.setItem('ganttAppSnapshots', JSON.stringify([testSnapshot, testSnapshot2]));

    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    await waitFor(() => {
      expect(result.current.snapshots).toHaveLength(2);
    });

    expect(result.current.snapshots[0].id).toBe('snap2'); // Later timestamp first
    expect(result.current.snapshots[1].id).toBe('snap1');
  });

  // saveSnapshot passes its legendLabels argument through untouched. Which
  // labels the caller passes (defaults, project overrides) is the page's job
  // and is tested through the page, not here.
  it('stores the five legend labels exactly as passed', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Label Pass-through');

    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    await act(async () => {
      await result.current.saveSnapshot({
        ...saveParams,
        legendLabels: {
          solidBar: 'Solid label A',
          hatchedBar: 'Hatched label B',
          finishDateLine: 'Finish label C',
          mostLikelyLine: 'Likely label D',
          inProgress: 'Progress label E',
        },
      });
    });

    const stored: Snapshot[] = JSON.parse(localStorageMock.getItem('ganttAppSnapshots')!);
    expect(stored.map(s => s.name)).toEqual(['Label Pass-through']);
    expect(stored[0].legendLabels).toEqual({
      solidBar: 'Solid label A',
      hatchedBar: 'Hatched label B',
      finishDateLine: 'Finish label C',
      mostLikelyLine: 'Likely label D',
      inProgress: 'Progress label E',
    });
  });

  it("names the snapshot with today's date when the name entered is only spaces", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 6, 4, 12, 0, 0));
    try {
      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('   ');

      const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

      await act(async () => {
        await result.current.saveSnapshot(saveParams);
      });

      // The date offered as the default is the one used.
      expect(promptSpy).toHaveBeenCalledWith('Enter a name for this snapshot (optional):', 'July 4, 2026');
      const stored: Snapshot[] = JSON.parse(localStorageMock.getItem('ganttAppSnapshots')!);
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('July 4, 2026');
    } finally {
      vi.useRealTimers();
    }
  });

  it('at the snapshot limit, says so and adds nothing', async () => {
    // The project already holds the 50 snapshots a project may have, and they
    // load successfully.
    const full = Array.from({ length: 50 }, (_, i) => ({ ...testSnapshot, id: `full-${i}`, name: `Full ${i}` }));
    localStorageMock.setItem('ganttAppSnapshots', JSON.stringify(full));
    vi.spyOn(window, 'prompt').mockReturnValue('One Too Many');
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });
    await waitFor(() => {
      expect(result.current.snapshots).toHaveLength(50);
    });

    await act(async () => {
      await result.current.saveSnapshot(saveParams);
    });

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith('Snapshot limit reached. Delete old snapshots to save new ones.');
    expect(result.current.snapshots).toHaveLength(50);
    expect(result.current.snapshots.some(s => s.name === 'One Too Many')).toBe(false);
    expect(JSON.parse(localStorageMock.getItem('ganttAppSnapshots')!)).toHaveLength(50);
    alertSpy.mockRestore();
  });

  it('discards a snapshot load that finishes after the storage changed', async () => {
    let resolveFirstLoad: (snapshots: Snapshot[]) => void = () => {};
    const firstLoad = new Promise<Snapshot[]>(resolve => { resolveFirstLoad = resolve; });
    const firstStorage = { loadSnapshots: vi.fn(() => firstLoad) };
    const secondStorage = { loadSnapshots: vi.fn(async () => [{ ...testSnapshot, id: 'from-second-storage' }]) };
    let currentStorage: unknown = firstStorage;
    // The hook reads the storage service from its context; stub that context
    // so the service can be swapped while the first load is still pending.
    const useStorageSpy = vi.spyOn(StorageModule, 'useStorage')
      .mockImplementation(() => ({ storage: currentStorage }) as unknown as ReturnType<typeof StorageModule.useStorage>);

    const { result, rerender } = renderHook(() => useSnapshots('p1'));
    expect(firstStorage.loadSnapshots).toHaveBeenCalledTimes(1);

    currentStorage = secondStorage;
    rerender();
    await waitFor(() => {
      expect(result.current.allSnapshots.map(s => s.id)).toEqual(['from-second-storage']);
    });

    // The first storage's load finishes only now, after the swap.
    await act(async () => {
      resolveFirstLoad([{ ...testSnapshot, id: 'from-first-storage' }]);
      await firstLoad;
    });

    expect(result.current.allSnapshots.map(s => s.id)).toEqual(['from-second-storage']);
    useStorageSpy.mockRestore();
  });

  // v0.27.0 (Pass 5, I2): when the cloud driver dispatches the eviction
  // event, useSnapshots removes snapshots for the revoked project from
  // its in-memory state. The handler has no storage.mode gate because
  // the event is only dispatched in cloud mode by the driver.
  it('evicts snapshots for the revoked project on ganttapp:project-revoked (I2)', async () => {
    localStorageMock.setItem(
      'ganttAppSnapshots',
      JSON.stringify([testSnapshot, otherProjectSnapshot]),
    );

    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    // Wait for snapshots to load (allSnapshots has both p1's and p2's)
    await waitFor(() => {
      expect(result.current.allSnapshots).toHaveLength(2);
    });

    // Dispatch eviction for p1
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('ganttapp:project-revoked', { detail: { projectId: 'p1' } }),
      );
    });

    // p1 snapshot evicted; p2 snapshot remains
    expect(result.current.allSnapshots.filter(s => s.projectId === 'p1')).toHaveLength(0);
    expect(result.current.allSnapshots.filter(s => s.projectId === 'p2')).toHaveLength(1);
    expect(result.current.allSnapshots[0].id).toBe('snap3');
  });
});
