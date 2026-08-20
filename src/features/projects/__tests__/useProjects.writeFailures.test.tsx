// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// v0.28.10 — snapshot write failures in the project hooks must reach the user.
//
// Companion to useSnapshots.writeFailures.test.tsx. Same induced-failure
// technique: throw at the real localStorage boundary for the snapshots key.
//
// ASYMMETRY WITH SITES 1 AND 2, deliberate and asserted below. In both sites
// here the in-memory commit (updateData) happens BEFORE the awaited snapshot
// write, so there is no optimistic update to suppress — the project really is
// deleted, and the clone really does exist. The correct behaviour is therefore
// not "roll back" but "name precisely what did not happen", which is what the
// second test of each pair pins.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { AppDataProvider, useAppData } from '../../../context/AppDataContext';
import { StorageProvider } from '../../../context/StorageContext';
import { AuthProvider } from '../../../context/AuthContext';
import { useProjects } from '../useProjects';

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
const QUOTA_TEXT = 'Storage quota exceeded. Please export your data and clear some space.';

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

function permissionDenied(): Error {
  return Object.assign(new Error('Missing or insufficient permissions.'), {
    code: 'permission-denied',
  });
}
function quotaExceeded(): DOMException {
  return new DOMException('quota', 'QuotaExceededError');
}

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider><StorageProvider><AppDataProvider>{children}</AppDataProvider></StorageProvider></AuthProvider>;
}

function renderProjectsHook() {
  return renderHook(() => {
    const projects = useProjects();
    const { data } = useAppData();
    return { ...projects, data };
  }, { wrapper });
}

const seedSnapshot = {
  id: 'snap1',
  projectId: 'p1',
  timestamp: '2026-01-15T10:00:00.000Z',
  name: 'Sprint 1 Review',
  releases: [],
};

describe('useProjects — snapshot write failures are surfaced (v0.28.10)', () => {
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
    localStorage.setItem('ganttAppData', JSON.stringify({
      projects: [{ id: 'p1', name: 'Alpha' }, { id: 'p2', name: 'Beta' }],
      releases: [{
        id: 'r1', projectId: 'p1', name: 'Release 1',
        startDate: '2026-01-01', earlyFinishDate: '2026-03-01', lateFinishDate: '2026-06-01',
      }],
    }));
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify([seedSnapshot]));
  });

  afterEach(() => { vi.restoreAllMocks(); });

  // ── Site 4 — deleteProject cascade ───────────────────────────────────────
  describe('site 4: deleteProject cascade', () => {
    it('alerts when the cascade snapshot delete is rejected', async () => {
      const { result } = renderProjectsHook();
      await waitFor(() => expect(result.current.data.projects).toHaveLength(2));

      snapshotWriteFailure = permissionDenied();
      await act(async () => {
        await result.current.deleteProject('p1', 'p1', vi.fn());
      });

      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy.mock.calls[0][0]).toBe(
        'Project deleted, but its saved snapshots could not be removed. ' +
        'Permission denied. Please check your account access.'
      );
    });

    it('reports the partial outcome truthfully — the project stays deleted, and selection still resets', async () => {
      const setSelectedProjectId = vi.fn();
      const { result } = renderProjectsHook();
      await waitFor(() => expect(result.current.data.projects).toHaveLength(2));

      snapshotWriteFailure = quotaExceeded();
      await act(async () => {
        await result.current.deleteProject('p1', 'p1', setSelectedProjectId);
      });

      // updateData committed BEFORE the await, so the delete is real. The alert
      // must not imply otherwise, and the post-await selection reset must run.
      expect(result.current.data.projects.map(p => p.id)).toEqual(['p2']);
      expect(setSelectedProjectId).toHaveBeenCalledWith('p2');
      expect(alertSpy.mock.calls[0][0]).toBe(
        `Project deleted, but its saved snapshots could not be removed. ${QUOTA_TEXT}`
      );
    });
  });

  // ── Site 5 — cloneProject snapshot copy ──────────────────────────────────
  describe('site 5: cloneProject snapshot copy', () => {
    it('alerts when the cloned-snapshot write is rejected', async () => {
      const { result } = renderProjectsHook();
      await waitFor(() => expect(result.current.data.projects).toHaveLength(2));

      snapshotWriteFailure = permissionDenied();
      await act(async () => { await result.current.cloneProject('p1'); });

      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy.mock.calls[0][0]).toBe(
        'Project cloned, but its snapshots could not be copied. ' +
        'Permission denied. Please check your account access.'
      );
    });

    it('reports the partial outcome truthfully — the clone itself stands', async () => {
      const { result } = renderProjectsHook();
      await waitFor(() => expect(result.current.data.projects).toHaveLength(2));

      snapshotWriteFailure = quotaExceeded();
      await act(async () => { await result.current.cloneProject('p1'); });

      // The clone + its releases committed before the snapshot write was tried.
      expect(result.current.data.projects).toHaveLength(3);
      expect(result.current.data.projects[1].name).toBe('Alpha - Copy (1)');
      expect(alertSpy.mock.calls[0][0]).toBe(
        `Project cloned, but its snapshots could not be copied. ${QUOTA_TEXT}`
      );
    });
  });
});
