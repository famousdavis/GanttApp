// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// v0.28.16 (F6) — what a NAVIGATING blur does.
//
// There is no special navigation path: a blur caused by clicking a snapshot
// chip, a tab, or the project picker is an ordinary blur and commits like any
// other. These tests pin the two consequences that matter, at the same pairing
// pages/index.tsx uses (useSnapshots + useChartEditing, index.tsx:83-84).
//
// They fire blur explicitly before the navigating action, so they prove the
// HANDLER and the ORDER — not the browser's focus behaviour. Whether a click on
// a <button> blurs the editor in Safari is a separate, unmeasured question.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useChartEditing } from '../useChartEditing';
import { useSnapshots } from '../useSnapshots';
import { AppDataProvider, useAppData } from '../../../context/AppDataContext';
import { StorageProvider } from '../../../context/StorageContext';
import { AuthProvider } from '../../../context/AuthContext';
import { ThemeProvider } from '../../../context/ThemeContext';
import { DEFAULT_CHART_COLORS } from '../../../shared/utils/colors';

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

const testRelease = {
  id: 'r1',
  projectId: 'p1',
  name: 'Release 1',
  startDate: '2026-01-01',
  earlyFinishDate: '2026-02-01',
  lateFinishDate: '2026-03-01'
};

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <StorageProvider>
        <ThemeProvider>
          <AppDataProvider>{children}</AppDataProvider>
        </ThemeProvider>
      </StorageProvider>
    </AuthProvider>
  );
}

const LEGEND = {
  solidBar: 'Design, Code, Test',
  hatchedBar: 'Delivery Uncertainty',
};

describe('inline chart edit × snapshot navigation (v0.28.16)', () => {
  beforeEach(() => {
    localStorageMock.clear();
    mockOnAuthStateChanged.mockImplementation((_a: unknown, cb: (u: null) => void) => {
      cb(null);
      return vi.fn();
    });
    vi.spyOn(window, 'prompt').mockReturnValue('Sprint Review');
  });

  const renderAll = () => {
    const useCombined = () => ({
      editing: useChartEditing('p1'),
      snapshots: useSnapshots('p1'),
      appData: useAppData(),
    });
    return renderHook(useCombined, { wrapper });
  };

  type Result = ReturnType<typeof renderAll>['result'];

  const seed = async (result: Result) => {
    await act(async () => {
      result.current.appData.updateData({
        ...result.current.appData.data,
        projects: [{ id: 'p1', name: 'Project 1' }],
        releases: [testRelease],
      });
    });
  };

  const takeSnapshot = async (result: Result) => {
    await act(async () => {
      await result.current.snapshots.saveSnapshot({
        releases: result.current.appData.data.releases.filter(r => r.projectId === 'p1'),
        chartColors: DEFAULT_CHART_COLORS,
        legendLabels: LEGEND,
        preparedBy: '',
      });
    });
  };

  // F6a — the commit lands in LIVE data and never reaches the FROZEN snapshot.
  // A typed change is required: without one the commit is value-identical and
  // the assertion would be vacuous.
  it('commits to live data on a navigating blur without altering the frozen snapshot', async () => {
    const { result } = renderAll();
    await seed(result);
    await takeSnapshot(result);

    const snapId = result.current.snapshots.snapshots[0].id;
    expect(result.current.snapshots.snapshots[0].releases[0].lateFinishDate).toBe('2026-03-01');

    // Open an editor and TYPE a valid change.
    act(() => { result.current.editing.startEditDate('r1', 'late', '2026-03-01'); });
    act(() => { result.current.editing.setTempDateValue('2026-04-15'); });

    // The navigating gesture: blur first, then select the snapshot chip.
    act(() => { result.current.editing.commitDateEdit(); });
    act(() => { result.current.snapshots.setActiveSnapshotId(snapId); });

    // Live data took the edit.
    expect(result.current.appData.data.releases[0].lateFinishDate).toBe('2026-04-15');
    // The frozen snapshot is untouched — snapshots live under their own storage
    // key and updateData never writes them.
    expect(result.current.snapshots.snapshots[0].releases[0].lateFinishDate).toBe('2026-03-01');
    // And the app is now in read-only snapshot view.
    expect(result.current.snapshots.isViewingSnapshot).toBe(true);
    expect(result.current.editing.editingDateInfo).toBeNull();
  });

  // F6b — DIFFERENT ASSERTIONS from F6a. Save Snapshot does not navigate: the
  // blur-commit precedes handleSaveSnapshot, so the new snapshot RECORDS the
  // typed value, and no snapshot becomes selected.
  it('records a blur-committed edit in a snapshot taken by the same gesture', async () => {
    const { result } = renderAll();
    await seed(result);

    act(() => { result.current.editing.startEditDate('r1', 'late', '2026-03-01'); });
    act(() => { result.current.editing.setTempDateValue('2026-06-30'); });

    // Blur commits, then Save Snapshot runs against the committed data.
    act(() => { result.current.editing.commitDateEdit(); });
    await takeSnapshot(result);

    expect(result.current.appData.data.releases[0].lateFinishDate).toBe('2026-06-30');
    expect(result.current.snapshots.snapshots).toHaveLength(1);
    expect(result.current.snapshots.snapshots[0].releases[0].lateFinishDate).toBe('2026-06-30');

    // saveSnapshot never selects the new snapshot, so readOnly never turns on.
    expect(result.current.snapshots.activeSnapshotId).toBeNull();
    expect(result.current.snapshots.isViewingSnapshot).toBe(false);
  });

  // The same navigating blur on a legend label, with §5's dirty check in force:
  // an untouched label writes nothing even though blur now commits.
  it('creates no project override when a legend editor is left by a navigating blur', async () => {
    const { result } = renderAll();
    await seed(result);

    act(() => { result.current.editing.startEditLabel('solid'); });
    act(() => { result.current.editing.saveLabelEdit(); });

    const project = result.current.appData.data.projects.find(p => p.id === 'p1');
    expect(project?.legendLabels).toBeUndefined();
  });
});
