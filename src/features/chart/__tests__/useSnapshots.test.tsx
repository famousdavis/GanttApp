// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSnapshots } from '../useSnapshots';
import { AppDataProvider } from '../../../context/AppDataContext';
import { StorageProvider } from '../../../context/StorageContext';
import { AuthProvider } from '../../../context/AuthContext';
import { ThemeProvider } from '../../../context/ThemeContext';
import React from 'react';

// Mock firebase modules
vi.mock('../../../lib/firebase', () => ({
  auth: null,
  db: null,
  isFirebaseAvailable: false,
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

  // --- v16.2 Risk 1 regression guard ---
  // The snapshot-save code path at pages/index.tsx (handleSaveSnapshot) MUST pass
  // EFFECTIVE label values to saveSnapshot(), not raw (possibly empty) AppDataContext
  // state. A snapshot taken today with empty global state should display the hardcoded
  // defaults forever, not empty strings.
  //
  // useSnapshots.saveSnapshot is a pure pass-through of its legendLabels argument —
  // the regression risk lives in the CALLER (handleSaveSnapshot). pages/index.tsx
  // isn't unit-testable here, so this test documents the CONTRACT by exercising the
  // same raw-or-default computation that handleSaveSnapshot performs.
  it('snapshot save contract: caller builds legendLabels from raw || DEFAULT_LEGEND_LABELS (Risk 1)', async () => {
    // Import the DEFAULT_LEGEND_LABELS constant used by pages/index.tsx
    const { DEFAULT_LEGEND_LABELS } = await import('../../../shared/utils/validation');

    // Simulate the state at first-time user time-of-snapshot: raw state is all empty
    const emptyRawState = {
      solidBarLabel: '',
      hatchedBarLabel: '',
      finishDateLabel: '',
      mostLikelyLineLabel: '',
      inProgressLabel: '',
    };

    // THIS is the exact same computation handleSaveSnapshot performs in pages/index.tsx.
    // If a future refactor regresses this to pass raw state, the snapshot would freeze
    // empty strings and render as blank labels — the symptom is invisible until someone
    // opens that snapshot weeks/months later.
    const legendLabelsForSnapshot = {
      solidBar: emptyRawState.solidBarLabel || DEFAULT_LEGEND_LABELS.solidBar,
      hatchedBar: emptyRawState.hatchedBarLabel || DEFAULT_LEGEND_LABELS.hatchedBar,
      finishDateLine: emptyRawState.finishDateLabel || DEFAULT_LEGEND_LABELS.finishDateLine,
      mostLikelyLine: emptyRawState.mostLikelyLineLabel || DEFAULT_LEGEND_LABELS.mostLikelyLine,
      inProgress: emptyRawState.inProgressLabel || DEFAULT_LEGEND_LABELS.inProgress,
    };

    // Assert the payload that pages/index.tsx produces from empty state is well-formed:
    // every label is a non-empty string matching the hardcoded default.
    expect(legendLabelsForSnapshot.solidBar).toBe('Design, Code, Test');
    expect(legendLabelsForSnapshot.hatchedBar).toBe('Delivery Uncertainty');
    expect(legendLabelsForSnapshot.finishDateLine).toBe('Project Finish Date');
    expect(legendLabelsForSnapshot.mostLikelyLine).toBe('Most Likely Finish');
    expect(legendLabelsForSnapshot.inProgress).toBe('In Progress');

    // Now verify saveSnapshot stores them faithfully (no surprises in the hook):
    localStorageMock.setItem('ganttAppData', JSON.stringify({
      projects: [{ id: 'p1', name: 'Project 1' }],
      releases: [],
    }));
    localStorageMock.setItem('ganttAppSnapshots', JSON.stringify([]));

    vi.spyOn(window, 'prompt').mockReturnValue('Regression Guard Snapshot');

    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    await act(async () => {
      await result.current.saveSnapshot({
        releases: [],
        chartColors: {
          solidBar: '#0070f3', hatchedBar: '#0070f3', todayLine: '#dc3545',
          finishDateLine: '#00ff00', mostLikelyLine: '#000000',
          completedBar: '#90ee90', inProgressBar: '#f59e0b',
        },
        legendLabels: legendLabelsForSnapshot,
        preparedBy: '',
      });
    });

    const saved = result.current.snapshots.find(s => s.name === 'Regression Guard Snapshot');
    expect(saved).toBeDefined();
    // Snapshot preserves exactly the effective values — never empty strings.
    expect(saved?.legendLabels?.solidBar).toBe('Design, Code, Test');
    expect(saved?.legendLabels?.hatchedBar).toBe('Delivery Uncertainty');
    expect(saved?.legendLabels?.finishDateLine).toBe('Project Finish Date');
    expect(saved?.legendLabels?.mostLikelyLine).toBe('Most Likely Finish');
    expect(saved?.legendLabels?.inProgress).toBe('In Progress');
  });
});
