// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * CI-gated regression test for the v18.0.0 `spert:models-changed` listener
 * in AppDataContext (LESSONS-LEARNED §17 / Plan Step 12 / Gate 2).
 *
 * The contract under test: dispatching `spert:models-changed` while in cloud
 * mode triggers `loadAppData()` (so the newly-claimed project surfaces) but
 * does NOT trigger `saveAppData()` (which would clobber concurrent edits
 * from other collaborators on the just-claimed project).
 *
 * If this test ever turns red, the save-back guard has regressed and a flag-on
 * deployment will silently overwrite collaborator data on every claim event.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

// Force INVITATIONS_ENABLED on for this test file specifically.
vi.mock('../../lib/feature-flags', () => ({
  INVITATIONS_ENABLED: true,
}));

// Controllable storage mock — driven via the captured handle below.
const mockLoadAppData = vi.fn();
const mockSaveAppData = vi.fn();
const mockLoadSnapshots = vi.fn().mockResolvedValue([]);
const mockSaveSnapshots = vi.fn();

// AppDataContext casts to CloudGanttStorageService when mode === 'cloud' and
// calls subscribeToProject for each project. The mock returns a no-op
// unsubscriber so the real-time-sync effect doesn't crash; we don't need to
// drive the subscription in this test.
const mockSubscribeToProject = vi.fn().mockImplementation(() => () => {});

const mockStorageHandle: { storage: any; mode: 'cloud' | 'local' } = {
  storage: {
    mode: 'cloud' as 'cloud' | 'local',
    loadAppData: mockLoadAppData,
    saveAppData: mockSaveAppData,
    loadSnapshots: mockLoadSnapshots,
    saveSnapshots: mockSaveSnapshots,
    addSnapshot: vi.fn(),
    deleteSnapshot: vi.fn(),
    deleteSnapshotsForProject: vi.fn(),
    // CloudGanttStorageService methods consumed by AppDataContext:
    subscribeToProject: mockSubscribeToProject,
    cancelPendingSaves: vi.fn(),
    flushPendingWrites: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
  },
  mode: 'cloud' as 'cloud' | 'local',
};

vi.mock('../StorageContext', () => ({
  useStorage: () => mockStorageHandle,
  StorageProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// AppDataResetRegistry uses module-level singleton; simplest is to keep it real.
import { AppDataProvider, useAppData } from '../AppDataContext';

function wrapper({ children }: { children: ReactNode }) {
  return <AppDataProvider>{children}</AppDataProvider>;
}

describe("AppDataContext — 'spert:models-changed' listener (CI gate)", () => {
  beforeEach(() => {
    mockLoadAppData.mockReset().mockResolvedValue({
      projects: [{ id: 'p1', name: 'Project 1' }],
      releases: [],
    });
    mockSaveAppData.mockReset().mockResolvedValue(undefined);
    mockLoadSnapshots.mockReset().mockResolvedValue([]);
    mockSaveSnapshots.mockReset().mockResolvedValue(undefined);
  });

  it('reloads on dispatch in cloud mode WITHOUT calling saveAppData', async () => {
    const { result } = renderHook(() => useAppData(), { wrapper });

    // Wait for initial load to settle.
    await waitFor(() => {
      expect(result.current.data.projects).toHaveLength(1);
    });

    // Initial-load count baseline. saveAppData should NOT have fired during
    // the initial hydration either (the existing isInitialLoadRef guard
    // protects this; we record the count to assert no DELTA after dispatch).
    const initialLoadCallCount = mockLoadAppData.mock.calls.length;
    const initialSaveCallCount = mockSaveAppData.mock.calls.length;

    // Simulate a successful invitation claim by dispatching the event.
    mockLoadAppData.mockResolvedValueOnce({
      projects: [
        { id: 'p1', name: 'Project 1' },
        { id: 'p2', name: 'Newly Claimed Project' },
      ],
      releases: [],
    });

    act(() => {
      window.dispatchEvent(
        new CustomEvent('spert:models-changed', {
          detail: { claimed: [{ appId: 'ganttapp', modelId: 'p2', modelName: 'Newly Claimed Project' }] },
        }),
      );
    });

    // Reload was triggered.
    await waitFor(() => {
      expect(mockLoadAppData.mock.calls.length).toBeGreaterThan(initialLoadCallCount);
    });

    // Newly-claimed project surfaces in state.
    await waitFor(() => {
      expect(result.current.data.projects).toHaveLength(2);
      expect(result.current.data.projects[1].id).toBe('p2');
    });

    // The CRITICAL assertion: saveAppData was NOT called as a result of
    // the reload. Any new save call here means the save-back guard has
    // regressed and concurrent collaborator edits would be clobbered.
    expect(mockSaveAppData.mock.calls.length).toBe(initialSaveCallCount);
  });

  it('handles double-dispatch — second event also triggers a reload (isResettingRef gets reset)', async () => {
    const { result } = renderHook(() => useAppData(), { wrapper });
    await waitFor(() => {
      expect(result.current.data.projects).toHaveLength(1);
    });

    const baselineLoad = mockLoadAppData.mock.calls.length;
    const baselineSave = mockSaveAppData.mock.calls.length;

    act(() => {
      window.dispatchEvent(new CustomEvent('spert:models-changed', { detail: { claimed: [] } }));
    });
    await waitFor(() => {
      expect(mockLoadAppData.mock.calls.length).toBe(baselineLoad + 1);
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('spert:models-changed', { detail: { claimed: [] } }));
    });
    await waitFor(() => {
      expect(mockLoadAppData.mock.calls.length).toBe(baselineLoad + 2);
    });

    // Both reloads happened, neither produced a save.
    expect(mockSaveAppData.mock.calls.length).toBe(baselineSave);
  });
});

describe("AppDataContext — 'spert:models-changed' listener — local mode no-op", () => {
  beforeEach(() => {
    mockStorageHandle.storage.mode = 'local';
    mockStorageHandle.mode = 'local';
    mockLoadAppData.mockReset().mockResolvedValue({ projects: [], releases: [] });
    mockSaveAppData.mockReset().mockResolvedValue(undefined);
  });

  it('does NOT reload when storage.mode is local', async () => {
    const { result } = renderHook(() => useAppData(), { wrapper });
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    const baselineLoad = mockLoadAppData.mock.calls.length;

    act(() => {
      window.dispatchEvent(new CustomEvent('spert:models-changed', { detail: { claimed: [] } }));
    });

    // Brief wait — handler runs synchronously, but give React a chance to flush.
    await new Promise((resolve) => setTimeout(resolve, 50));

    // No reload triggered — listener handler short-circuits in local mode.
    expect(mockLoadAppData.mock.calls.length).toBe(baselineLoad);

    // Restore for any subsequent test files (vi.mock state survives the file).
    mockStorageHandle.storage.mode = 'cloud';
    mockStorageHandle.mode = 'cloud';
  });
});
