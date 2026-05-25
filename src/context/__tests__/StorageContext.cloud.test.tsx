// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// StorageContext cloud-mode tests for Pass 1 (F1/F3/E2-gap):
// verify clearLocalProjectData is called on sign-out from cloud mode but NOT
// from local mode. Closes the cross-user data leak where switchToCloudMode
// would have read stale localStorage and uploaded the previous user's data.
//
// Mocking strategy:
//   - LocalGanttStorageService: preserved as the real class via vi.importActual
//     (jsdom localStorage is sufficient for local-mode behavior). Only the
//     standalone clearLocalProjectData export is replaced with a spy.
//   - FirestoreGanttStorageServiceImpl: replaced with a regular function (not
//     vi.fn() with an arrow — vitest warns that arrows are not constructable).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

// ── vi.hoisted: all mock-internal refs ───────────────────────────────────────
const {
  mockOnAuthStateChanged,
  mockCloudService,
  clearLocalProjectDataMock,
} = vi.hoisted(() => ({
  mockOnAuthStateChanged: vi.fn(),
  mockCloudService: {
    mode: 'cloud' as const,
    cancelPendingSaves: vi.fn(),
    dispose: vi.fn(),
    loadAppData: vi.fn().mockResolvedValue(null),
    saveAppData: vi.fn().mockResolvedValue(undefined),
    loadSnapshots: vi.fn().mockResolvedValue([]),
    saveSnapshots: vi.fn().mockResolvedValue(undefined),
    addSnapshot: vi.fn().mockResolvedValue([]),
    deleteSnapshot: vi.fn().mockResolvedValue([]),
    deleteSnapshotsForProject: vi.fn().mockResolvedValue([]),
    subscribeToProject: vi.fn().mockReturnValue(vi.fn()),
    shareProject: vi.fn().mockResolvedValue(undefined),
    removeCollaborator: vi.fn().mockResolvedValue(undefined),
    listMembers: vi.fn().mockResolvedValue([]),
    listPendingInvites: vi.fn().mockResolvedValue([]),
    flushPendingWrites: vi.fn().mockResolvedValue(undefined),
  },
  clearLocalProjectDataMock: vi.fn(),
}));

// ── vi.mock blocks (hoisted automatically) ───────────────────────────────────
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

vi.mock('../../lib/feature-flags', () => ({
  INVITATIONS_ENABLED: false,
}));

// FirestoreGanttStorageServiceImpl mock: regular function (constructable),
// NOT vi.fn().mockImplementation(arrow) which vitest flags as non-constructable.
vi.mock('../../shared/storage/firestore-gantt-storage-service', () => ({
  FirestoreGanttStorageServiceImpl: function () { return mockCloudService; },
}));

// LocalGanttStorageService: keep the real class via vi.importActual.
// Only replace the standalone clearLocalProjectData export with a spy.
vi.mock('../../shared/storage/local-gantt-storage-service', async () => {
  const actual = await vi.importActual<
    typeof import('../../shared/storage/local-gantt-storage-service')
  >('../../shared/storage/local-gantt-storage-service');
  return {
    ...actual,
    clearLocalProjectData: clearLocalProjectDataMock,
  };
});

// ── Imports (after all vi.mock calls) ────────────────────────────────────────
import { StorageProvider, useStorage } from '../StorageContext';
import { AuthProvider } from '../AuthContext';

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
      <StorageProvider>{children}</StorageProvider>
    </AuthProvider>
  );
}

describe('StorageContext — cloud mode sign-out (F1/F3/E2-gap)', () => {
  beforeEach(() => {
    localStorage.clear();
    // vi.clearAllMocks() preserves the factory implementations in the vi.mock
    // blocks (resetAllMocks wipes them and re-arming is fragile).
    vi.clearAllMocks();

    // Re-arm method-level defaults that were cleared by clearAllMocks.
    mockCloudService.loadAppData.mockResolvedValue(null);
    mockCloudService.loadSnapshots.mockResolvedValue([]);
    mockCloudService.subscribeToProject.mockReturnValue(vi.fn());

    // Prevent handleTosResolution Branch B from auto-triggering cleanup during
    // setup: signal that the cached ToS version matches.
    localStorage.setItem('spert_tos_accepted_version', '04-05-2026');

    mockOnAuthStateChanged.mockImplementation(
      (_auth: unknown, callback: (user: typeof mockUser) => void) => {
        callback(mockUser);
        return vi.fn();
      },
    );
  });

  it('calls clearLocalProjectData when signing out from cloud mode (F1/F3/E2-gap)', async () => {
    // Trigger cloud restoration: storage mode key is 'cloud', user signed in,
    // no ganttAppData in localStorage → direct cloud connect (no upload prompt).
    localStorage.setItem('ganttapp-storage-mode', 'cloud');

    const { result } = renderHook(() => useStorage(), { wrapper });
    await waitFor(() => expect(result.current.mode).toBe('cloud'));

    await act(async () => {
      await result.current.performSignOutWithCleanup();
    });

    expect(clearLocalProjectDataMock).toHaveBeenCalledTimes(1);
    expect(result.current.mode).toBe('local');
    expect(mockCloudService.cancelPendingSaves).toHaveBeenCalledTimes(1);
    expect(mockCloudService.dispose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call clearLocalProjectData when signing out from local mode', async () => {
    // No 'ganttapp-storage-mode' key → restoration effect short-circuits;
    // stays in local mode.
    const { result } = renderHook(() => useStorage(), { wrapper });
    await waitFor(() => expect(result.current.mode).toBe('local'));

    await act(async () => {
      await result.current.performSignOutWithCleanup();
    });

    // In local mode, the only copy of the user's data lives in localStorage —
    // clearing would destroy it. The conditional `if (storage.mode === 'cloud')`
    // must skip clearLocalProjectData here.
    expect(clearLocalProjectDataMock).not.toHaveBeenCalled();
  });
});
