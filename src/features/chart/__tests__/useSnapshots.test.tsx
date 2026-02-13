import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSnapshots } from '../useSnapshots';
import { AppDataProvider } from '../../../context/AppDataContext';
import { ThemeProvider } from '../../../context/ThemeContext';
import React from 'react';

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
    <ThemeProvider>
      <AppDataProvider>
        {children}
      </AppDataProvider>
    </ThemeProvider>
  );
}

describe('useSnapshots', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.restoreAllMocks();
  });

  it('returns empty snapshots when none stored', () => {
    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    expect(result.current.snapshots).toEqual([]);
    expect(result.current.activeSnapshotId).toBeNull();
    expect(result.current.activeSnapshot).toBeNull();
    expect(result.current.isViewingSnapshot).toBe(false);
  });

  it('loads snapshots from localStorage on mount', () => {
    localStorageMock.setItem('ganttAppSnapshots', JSON.stringify([testSnapshot, testSnapshot2]));

    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    expect(result.current.snapshots).toHaveLength(2);
    expect(result.current.snapshots[0].name).toBe('Sprint 1 Review');
    expect(result.current.snapshots[1].name).toBe('Sprint 2 Review');
  });

  it('filters snapshots by project ID', () => {
    localStorageMock.setItem('ganttAppSnapshots', JSON.stringify([testSnapshot, otherProjectSnapshot]));

    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    expect(result.current.snapshots).toHaveLength(1);
    expect(result.current.snapshots[0].id).toBe('snap1');
  });

  it('selects a snapshot by ID', () => {
    localStorageMock.setItem('ganttAppSnapshots', JSON.stringify([testSnapshot]));

    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    act(() => {
      result.current.setActiveSnapshotId('snap1');
    });

    expect(result.current.activeSnapshotId).toBe('snap1');
    expect(result.current.activeSnapshot).toBeTruthy();
    expect(result.current.activeSnapshot?.name).toBe('Sprint 1 Review');
    expect(result.current.isViewingSnapshot).toBe(true);
  });

  it('returns null activeSnapshot when Current view is selected', () => {
    localStorageMock.setItem('ganttAppSnapshots', JSON.stringify([testSnapshot]));

    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

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

  it('resets active snapshot when project changes', () => {
    localStorageMock.setItem('ganttAppSnapshots', JSON.stringify([testSnapshot]));

    const { result, rerender } = renderHook(
      ({ projectId }) => useSnapshots(projectId),
      { wrapper, initialProps: { projectId: 'p1' } }
    );

    act(() => {
      result.current.setActiveSnapshotId('snap1');
    });

    expect(result.current.isViewingSnapshot).toBe(true);

    // Switch project
    rerender({ projectId: 'p2' });

    expect(result.current.activeSnapshotId).toBeNull();
    expect(result.current.isViewingSnapshot).toBe(false);
  });

  it('saves a snapshot via prompt', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('My Snapshot');
    localStorageMock.setItem('ganttAppData', JSON.stringify({
      projects: [{ id: 'p1', name: 'Project 1' }],
      releases: []
    }));

    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    act(() => {
      result.current.saveSnapshot({
        releases: [],
        chartColors: { solidBar: '#0070f3', hatchedBar: '#0070f3', todayLine: '#dc3545', finishDateLine: '#00ff00', mostLikelyLine: '#000000' },
        legendLabels: { solidBar: 'Design', hatchedBar: 'Uncertainty' },
        preparedBy: 'William'
      });
    });

    expect(result.current.snapshots).toHaveLength(1);
    expect(result.current.snapshots[0].name).toBe('My Snapshot');
  });

  it('does not save snapshot when user cancels prompt', () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null);

    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    act(() => {
      result.current.saveSnapshot({
        releases: [],
        chartColors: { solidBar: '#0070f3', hatchedBar: '#0070f3', todayLine: '#dc3545', finishDateLine: '#00ff00', mostLikelyLine: '#000000' },
        legendLabels: { solidBar: 'Design', hatchedBar: 'Uncertainty' },
        preparedBy: ''
      });
    });

    expect(result.current.snapshots).toHaveLength(0);
  });

  it('deletes a snapshot with confirmation', () => {
    localStorageMock.setItem('ganttAppSnapshots', JSON.stringify([testSnapshot, testSnapshot2]));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    act(() => {
      result.current.setActiveSnapshotId('snap1');
    });

    act(() => {
      result.current.deleteSnapshot('snap1');
    });

    expect(result.current.snapshots).toHaveLength(1);
    expect(result.current.snapshots[0].id).toBe('snap2');
    expect(result.current.activeSnapshotId).toBeNull();
  });

  it('does not delete when user cancels confirmation', () => {
    localStorageMock.setItem('ganttAppSnapshots', JSON.stringify([testSnapshot]));
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    act(() => {
      result.current.deleteSnapshot('snap1');
    });

    expect(result.current.snapshots).toHaveLength(1);
  });

  it('replaces all snapshots', () => {
    const newSnapshots = [testSnapshot, testSnapshot2, otherProjectSnapshot];
    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    act(() => {
      result.current.replaceAllSnapshots(newSnapshots);
    });

    expect(result.current.snapshots).toHaveLength(2); // Only p1 snapshots
    expect(result.current.allSnapshots).toHaveLength(3); // All snapshots stored
  });

  it('sorts snapshots by timestamp ascending', () => {
    // Store in reverse order
    localStorageMock.setItem('ganttAppSnapshots', JSON.stringify([testSnapshot2, testSnapshot]));

    const { result } = renderHook(() => useSnapshots('p1'), { wrapper });

    expect(result.current.snapshots[0].id).toBe('snap1'); // Earlier timestamp first
    expect(result.current.snapshots[1].id).toBe('snap2');
  });
});
