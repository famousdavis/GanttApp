// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// v0.28.10 — snapshot write failures must reach the user.
//
// Regression cover for the defect that let v0.28.0's `todayDateOverride` be
// rejected by the Firestore rules for seven days in total silence: the write
// rejected, nothing caught it, and the optimistic state update never ran.
//
// Failures are induced at the REAL storage boundary — localStorage.setItem for
// the snapshots key — so the whole LocalGanttStorageService → LocalStorageDriver
// → hook chain is exercised rather than stubbed. The hook cannot distinguish a
// Firestore rejection from a driver rejection, so a `code`-carrying error is a
// faithful stand-in for the cloud shape.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { useSnapshots } from '../useSnapshots';
import { AppDataProvider } from '../../../context/AppDataContext';
import { StorageProvider } from '../../../context/StorageContext';
import { AuthProvider } from '../../../context/AuthContext';
import { ThemeProvider } from '../../../context/ThemeContext';

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

const SNAPSHOTS_KEY = 'ganttAppSnapshots';

/** Armed by a test to make the next write to the snapshots key reject. */
let snapshotWriteFailure: unknown = null;

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      if (key === SNAPSHOTS_KEY && snapshotWriteFailure) throw snapshotWriteFailure;
      store[key] = value;
    },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

/** The cloud shape: a Firebase error carries `code`; sanitizeFirebaseError maps it. */
function permissionDenied(): Error {
  return Object.assign(new Error('Missing or insufficient permissions.'), {
    code: 'permission-denied',
  });
}

/**
 * The local shape. LocalStorageDriver.save converts a QuotaExceededError into
 * a curated, already-user-facing Error with NO `code`, which sanitizeFirebaseError
 * passes through verbatim. Local is the default storage mode, so this is the more
 * likely real-world trigger.
 */
const QUOTA_TEXT = 'Storage quota exceeded. Please export your data and clear some space.';
function quotaExceeded(): DOMException {
  return new DOMException('quota', 'QuotaExceededError');
}

const existingSnapshot = {
  id: 'snap1',
  projectId: 'p1',
  timestamp: '2026-01-15T10:00:00.000Z',
  name: 'Sprint 1 Review',
  releases: [],
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

const saveParams = {
  releases: [],
  chartColors: {
    solidBar: '#0070f3', hatchedBar: '#79b8ff', todayLine: '#ff0000',
    finishDateLine: '#00ff00', mostLikelyLine: '#ff00ff',
    completedBar: '#90ee90', inProgressBar: '#f59e0b',
  },
  legendLabels: { solidBar: 'Design, Code, Test', hatchedBar: 'Delivery Uncertainty' },
  preparedBy: '',
};

describe('useSnapshots — write failures are surfaced (v0.28.10)', () => {
  let alertSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    snapshotWriteFailure = null;
    localStorage.clear();
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (u: unknown) => void) => {
      cb(null);
      return () => {};
    });
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Site 1 — saveSnapshot ────────────────────────────────────────────────
  describe('site 1: saveSnapshot', () => {
    it('alerts when the write is rejected with permission-denied', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('My Snapshot');
      const { result } = renderHook(() => useSnapshots('p1'), { wrapper });
      await waitFor(() => expect(result.current.snapshots).toEqual([]));

      snapshotWriteFailure = permissionDenied();
      await act(async () => { await result.current.saveSnapshot(saveParams); });

      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy.mock.calls[0][0]).toBe(
        'Snapshot not saved. Permission denied. Please check your account access.'
      );
    });

    it('surfaces the local quota message verbatim rather than a generic one', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('My Snapshot');
      const { result } = renderHook(() => useSnapshots('p1'), { wrapper });
      await waitFor(() => expect(result.current.snapshots).toEqual([]));

      snapshotWriteFailure = quotaExceeded();
      await act(async () => { await result.current.saveSnapshot(saveParams); });

      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy.mock.calls[0][0]).toBe(`Snapshot not saved. ${QUOTA_TEXT}`);
    });

    it('does NOT optimistically add the snapshot to state when the write rejects', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('My Snapshot');
      const { result } = renderHook(() => useSnapshots('p1'), { wrapper });
      await waitFor(() => expect(result.current.snapshots).toEqual([]));

      snapshotWriteFailure = permissionDenied();
      await act(async () => { await result.current.saveSnapshot(saveParams); });

      // The whole point: no phantom snapshot in the bar.
      expect(result.current.snapshots).toEqual([]);
      expect(result.current.allSnapshots).toEqual([]);
    });
  });

  // ── Site 2 — deleteSnapshot ──────────────────────────────────────────────
  describe('site 2: deleteSnapshot', () => {
    it('alerts when the delete is rejected', async () => {
      localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify([existingSnapshot]));
      const { result } = renderHook(() => useSnapshots('p1'), { wrapper });
      await waitFor(() => expect(result.current.snapshots).toHaveLength(1));

      snapshotWriteFailure = permissionDenied();
      await act(async () => { await result.current.deleteSnapshot('snap1'); });

      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy.mock.calls[0][0]).toBe(
        'Snapshot not deleted. Permission denied. Please check your account access.'
      );
    });

    it('does NOT optimistically remove the snapshot from state when the delete rejects', async () => {
      localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify([existingSnapshot]));
      const { result } = renderHook(() => useSnapshots('p1'), { wrapper });
      await waitFor(() => expect(result.current.snapshots).toHaveLength(1));

      snapshotWriteFailure = permissionDenied();
      await act(async () => { await result.current.deleteSnapshot('snap1'); });

      // Mirror of site 1: the snapshot is still stored, so it must still show.
      expect(result.current.snapshots).toHaveLength(1);
      expect(result.current.snapshots[0].id).toBe('snap1');
    });
  });
});
