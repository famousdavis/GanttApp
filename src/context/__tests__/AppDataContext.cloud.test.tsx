// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// AppDataContext cloud-mode integration tests.
// Shared harness across:
//   Pass 2 — I1 sentinel (this file, current pass)
//   Pass 5 — I2 project eviction (added in later pass)
//   Pass 7 — J1/J2 reload loading-state reset (added in later pass)
//
// Cloud mode requires the full provider stack with isFirebaseAvailable: true,
// a signed-in user, ganttapp-storage-mode: 'cloud', and INVITATIONS_ENABLED: true
// (Pass 7 needs the spert:models-changed reload path which is gated on this).
//
// Mocking strategy:
//   - LocalGanttStorageService: real class via vi.importActual
//     (constructor semantics — vi.fn().mockImplementation(arrow) is non-constructable
//     and emits the "vi.fn() mock did not use function or class" vitest warning).
//   - FirestoreGanttStorageServiceImpl: regular function (constructable) that
//     returns the shared mockCloudService.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

// ── vi.hoisted (precedes all vi.mock calls) ─────────────────────────────────
const {
  mockOnAuthStateChanged,
  mockCloudServiceLoadAppData,
  mockCloudService,
} = vi.hoisted(() => {
  const mockCloudServiceLoadAppData = vi.fn();
  return {
    mockOnAuthStateChanged: vi.fn(),
    mockCloudServiceLoadAppData,
    mockCloudService: {
      mode: 'cloud' as const,
      loadAppData: mockCloudServiceLoadAppData,
      saveAppData: vi.fn().mockResolvedValue(undefined),
      loadSnapshots: vi.fn().mockResolvedValue([]),
      saveSnapshots: vi.fn().mockResolvedValue(undefined),
      addSnapshot: vi.fn().mockResolvedValue([]),
      deleteSnapshot: vi.fn().mockResolvedValue([]),
      deleteSnapshotsForProject: vi.fn().mockResolvedValue([]),
      cancelPendingSaves: vi.fn(),
      dispose: vi.fn(),
      subscribeToProject: vi.fn().mockReturnValue(vi.fn()),
      shareProject: vi.fn().mockResolvedValue(undefined),
      removeCollaborator: vi.fn().mockResolvedValue(undefined),
      listMembers: vi.fn().mockResolvedValue([]),
      listPendingInvites: vi.fn().mockResolvedValue([]),
      flushPendingWrites: vi.fn().mockResolvedValue(undefined),
    },
  };
});

// ── Firebase mocks ───────────────────────────────────────────────────────────
vi.mock('../../lib/firebase', () => ({
  auth: { currentUser: { uid: 'user-cloud-1' } },
  db: {},
  isFirebaseAvailable: true,
  getSendInvitationEmail: () => null,
  getClaimPendingInvitations: () => null,
  getRevokeInvite: () => null,
  getResendInvite: () => null,
}));

vi.mock('firebase/auth', () => {
  class MockGoogleAuthProvider {
    addScope = vi.fn();
  }
  class MockOAuthProvider {
    addScope = vi.fn();
    constructor(_id: string) {}
  }
  return {
    onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
    signInWithPopup: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
    GoogleAuthProvider: MockGoogleAuthProvider,
    OAuthProvider: MockOAuthProvider,
  };
});

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({
    exists: () => true,
    data: () => ({ tosVersion: '04-05-2026' }),
  }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  collection: vi.fn(),
  writeBatch: vi.fn(() => ({ set: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) })),
  serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
}));

vi.mock('../../lib/version', () => ({
  TOS_VERSION: '04-05-2026',
  APP_ID: 'ganttapp',
  APP_VERSION: '0.27.0',
}));

// INVITATIONS_ENABLED: true is required for Pass 7's spert:models-changed handler
// to bump reloadCounter. Passes 2 and 5 are unaffected by this flag.
vi.mock('../../lib/feature-flags', () => ({
  INVITATIONS_ENABLED: true,
}));

// FirestoreGanttStorageServiceImpl mock: regular function (constructable).
vi.mock('../../shared/storage/firestore-gantt-storage-service', () => ({
  FirestoreGanttStorageServiceImpl: function () { return mockCloudService; },
}));

// LocalGanttStorageService: keep real class via vi.importActual.
vi.mock('../../shared/storage/local-gantt-storage-service', async () => {
  const actual = await vi.importActual<
    typeof import('../../shared/storage/local-gantt-storage-service')
  >('../../shared/storage/local-gantt-storage-service');
  return {
    ...actual,
    clearLocalProjectData: vi.fn(),
  };
});

// ── Imports (after all vi.mock calls) ────────────────────────────────────────
import { AppDataProvider, useAppData } from '../AppDataContext';
import { StorageProvider } from '../StorageContext';
import { AuthProvider } from '../AuthContext';

// ── Shared fixtures ──────────────────────────────────────────────────────────
const mockUser = {
  uid: 'user-cloud-1',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: null,
  emailVerified: true,
  providerData: [{ providerId: 'google.com' }],
};

function wrapper({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <StorageProvider>
        <AppDataProvider>{children}</AppDataProvider>
      </StorageProvider>
    </AuthProvider>
  );
}

// ── Global beforeEach ────────────────────────────────────────────────────────
beforeEach(() => {
  localStorage.clear();
  // clearAllMocks preserves the factory implementations set in vi.mock blocks
  // above (resetAllMocks would wipe them and re-arming the constructor mock
  // is fragile — vi.fn().mockImplementation(arrow) is non-constructable).
  // Pass 2's per-describe override of subscribeToProject is set fresh in its
  // own describe-level beforeEach so it does not need a global reset.
  vi.clearAllMocks();

  // Re-arm method-level defaults after clearAllMocks.
  mockCloudService.saveAppData.mockResolvedValue(undefined);
  mockCloudService.loadSnapshots.mockResolvedValue([]);
  mockCloudService.subscribeToProject.mockReturnValue(vi.fn());

  // Prevent handleTosResolution Branch B from auto-triggering cleanup.
  localStorage.setItem('spert_tos_accepted_version', '04-05-2026');
  // Cloud mode: triggers the restoration effect in StorageContext.
  localStorage.setItem('ganttapp-storage-mode', 'cloud');

  mockOnAuthStateChanged.mockImplementation(
    (_auth: unknown, callback: (user: typeof mockUser) => void) => {
      callback(mockUser);
      return vi.fn();
    },
  );

  // Default: resolves with one project and one release.
  // Tests can override via mockResolvedValue / mockReturnValueOnce.
  mockCloudServiceLoadAppData.mockResolvedValue({
    projects: [{ id: 'p1', name: 'Project 1' }],
    releases: [
      {
        id: 'r1',
        projectId: 'p1',
        name: 'R1',
        startDate: '2026-01-01',
        earlyFinishDate: '2026-02-01',
        lateFinishDate: '2026-03-01',
      },
    ],
  });
});

// ── Pass 2 tests: I1 sentinel ────────────────────────────────────────────────
type Release = {
  id: string;
  projectId: string;
  name: string;
  startDate: string;
  earlyFinishDate: string;
  lateFinishDate: string;
};

type SnapshotCb = (
  releases: Release[],
  snap: { metadata: { hasPendingWrites: boolean } },
) => void;

describe('subscribeToProject data-loss guard sentinel (I1)', () => {
  let capturedCallbacks: Map<string, SnapshotCb>;

  beforeEach(() => {
    capturedCallbacks = new Map();
    // Per-describe override. The global beforeEach's vi.clearAllMocks() only
    // clears call history, so this mockImplementation persists across the
    // Pass 2 tests inside this describe. capturedCallbacks is reassigned
    // each test in this beforeEach, so each test gets a fresh Map.
    mockCloudService.subscribeToProject.mockImplementation(
      (projectId: string, callback: SnapshotCb) => {
        capturedCallbacks.set(projectId, callback);
        return vi.fn();
      },
    );

    mockCloudServiceLoadAppData.mockResolvedValue({
      projects: [{ id: 'p1', name: 'Project 1' }],
      releases: [
        {
          id: 'r1',
          projectId: 'p1',
          name: 'R1',
          startDate: '2026-01-01',
          earlyFinishDate: '2026-02-01',
          lateFinishDate: '2026-03-01',
        },
      ],
    });
  });

  it('blocks the first empty snapshot when in-memory already has releases (guard fires once)', async () => {
    const { result } = renderHook(() => useAppData(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(capturedCallbacks.has('p1')).toBe(true));
    expect(result.current.data.releases).toHaveLength(1);

    // First snapshot with 0 releases (cold-load race scenario)
    await act(async () => {
      capturedCallbacks.get('p1')!([], { metadata: { hasPendingWrites: false } });
    });

    // Guard fires on first snapshot: releases still present
    expect(result.current.data.releases).toHaveLength(1);
    expect(result.current.data.releases[0].id).toBe('r1');
  });

  it('allows a subsequent empty snapshot to propagate (sentinel fires only once)', async () => {
    const { result } = renderHook(() => useAppData(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(capturedCallbacks.has('p1')).toBe(true));

    // First snapshot WITH a release — marks sentinel as seen
    await act(async () => {
      capturedCallbacks.get('p1')!(
        [
          {
            id: 'r1',
            projectId: 'p1',
            name: 'R1',
            startDate: '2026-01-01',
            earlyFinishDate: '2026-02-01',
            lateFinishDate: '2026-03-01',
          },
        ],
        { metadata: { hasPendingWrites: false } },
      );
    });

    // Second snapshot with 0 releases (collaborator deleted all)
    await act(async () => {
      capturedCallbacks.get('p1')!([], { metadata: { hasPendingWrites: false } });
    });

    // Guard did NOT fire: deletion propagated correctly
    expect(result.current.data.releases.filter(r => r.projectId === 'p1')).toHaveLength(0);
  });
});

// ── Pass 5 tests: I2 eviction ────────────────────────────────────────────────
describe('project eviction on ganttapp:project-revoked (I2)', () => {
  beforeEach(() => {
    mockCloudServiceLoadAppData.mockResolvedValue({
      projects: [
        { id: 'p1', name: 'Project 1' },
        { id: 'p2', name: 'Project 2' },
      ],
      releases: [
        {
          id: 'r1',
          projectId: 'p1',
          name: 'R1',
          startDate: '2026-01-01',
          earlyFinishDate: '2026-02-01',
          lateFinishDate: '2026-03-01',
        },
        {
          id: 'r2',
          projectId: 'p2',
          name: 'R2',
          startDate: '2026-01-01',
          earlyFinishDate: '2026-02-01',
          lateFinishDate: '2026-03-01',
        },
      ],
    });
  });

  it('removes project and its releases from state when ganttapp:project-revoked fires', async () => {
    const { result } = renderHook(() => useAppData(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data.projects).toHaveLength(2);
    expect(result.current.data.releases).toHaveLength(2);

    // Handler is gated on storage.mode === 'cloud' — satisfied by this harness.
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('ganttapp:project-revoked', { detail: { projectId: 'p1' } }),
      );
    });

    expect(result.current.data.projects).toHaveLength(1);
    expect(result.current.data.projects[0].id).toBe('p2');
    expect(result.current.data.releases.filter(r => r.projectId === 'p1')).toHaveLength(0);
    expect(result.current.data.releases.filter(r => r.projectId === 'p2')).toHaveLength(1);
  });

  it('leaves other projects intact when one project is revoked', async () => {
    const { result } = renderHook(() => useAppData(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('ganttapp:project-revoked', { detail: { projectId: 'p1' } }),
      );
    });

    expect(result.current.data.projects).toHaveLength(1);
    expect(result.current.data.projects[0].id).toBe('p2');
    expect(result.current.data.releases).toHaveLength(1);
    expect(result.current.data.releases[0].id).toBe('r2');
  });
});

// ── Pass 7 tests: J1/J2 reload ───────────────────────────────────────────────
describe('loading resets to true on reload cycle (J1/J2)', () => {
  it('flips loading true→false during a reload triggered by spert:models-changed', async () => {
    // Phase 1: initial load resolves immediately.
    mockCloudServiceLoadAppData.mockResolvedValue(null);
    const { result } = renderHook(() => useAppData(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Phase 2: queue a deferred promise for the NEXT loadAppData call.
    // The spert:models-changed handler bumps reloadCounter, which re-runs
    // the load effect; the J1/J2 fix sets loading: true at the top.
    let resolveReload!: () => void;
    mockCloudServiceLoadAppData.mockReturnValueOnce(
      new Promise<null>((res) => {
        resolveReload = () => res(null);
      }),
    );

    await act(async () => {
      window.dispatchEvent(new CustomEvent('spert:models-changed'));
    });

    // J1/J2 fix: loading must be true during the async gap.
    await waitFor(() => expect(result.current.loading).toBe(true));

    // Phase 3: resolve the deferred load.
    await act(async () => {
      resolveReload();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
  });
});
