// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';

// Mock firebase modules before importing AuthContext
const mockOnAuthStateChanged = vi.fn();
const mockSignInWithPopup = vi.fn();
const mockSignOut = vi.fn();

vi.mock('../../lib/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  isFirebaseAvailable: true,
  getSendInvitationEmail: () => null,
  getClaimPendingInvitations: () => null,
  getRevokeInvite: () => null,
  getResendInvite: () => null,
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
}));

vi.mock('../../lib/version', () => ({
  TOS_VERSION: '04-05-2026',
  APP_ID: 'ganttapp',
}));

// v0.27.0 (Pass 1, E1): mock the cleanup registry so the new !firebaseUser
// branch's `void runSignOutCleanup()` call is observable. The mock returns a
// resolved Promise (matches the real registry's contract); other existing
// tests that pass `callback(null)` will invoke this mock harmlessly.
vi.mock('../signOutCleanupRegistry', () => ({
  runSignOutCleanup: vi.fn().mockResolvedValue({ wasRegistered: true }),
}));

vi.mock('firebase/auth', () => {
  class MockGoogleAuthProvider {
    addScope = vi.fn();
  }
  class MockOAuthProvider {
    addScope = vi.fn();
    constructor(_providerId: string) {}
  }
  return {
    onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
    signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
    signOut: (...args: unknown[]) => mockSignOut(...args),
    GoogleAuthProvider: MockGoogleAuthProvider,
    OAuthProvider: MockOAuthProvider,
  };
});

import { AuthProvider, useAuth } from '../AuthContext';
import { runSignOutCleanup } from '../signOutCleanupRegistry';

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAuthStateChanged.mockImplementation(() => vi.fn()); // returns unsubscribe
  });

  it('renders children', () => {
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: null) => void) => {
      callback(null);
      return vi.fn();
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current).toBeDefined();
  });

  it('throws when useAuth is used outside AuthProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within AuthProvider');
    consoleSpy.mockRestore();
  });

  it('starts with loading=true when Firebase is available', () => {
    mockOnAuthStateChanged.mockImplementation(() => vi.fn());
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('sets user and loading=false after auth state resolves', async () => {
    const mockUser = { uid: 'test-uid', email: 'test@example.com', providerData: [{ providerId: 'google.com' }] };
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: typeof mockUser) => void) => {
      callback(mockUser);
      return vi.fn();
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    // Wait for async ToS resolution to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.loading).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('calls signInWithPopup for Google sign-in', async () => {
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: null) => void) => {
      callback(null);
      return vi.fn();
    });
    mockSignInWithPopup.mockResolvedValue({ user: { uid: 'new-uid' } });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.signInWithGoogle();
    });
    expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);
  });

  it('calls signInWithPopup for Microsoft sign-in', async () => {
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: null) => void) => {
      callback(null);
      return vi.fn();
    });
    mockSignInWithPopup.mockResolvedValue({ user: { uid: 'new-uid' } });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.signInWithMicrosoft();
    });
    expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);
  });

  // 'calls firebase signOut' test removed in v0.22.2 (S7) — the bare
  // AuthContext.signOut() helper was deleted. Sign-out paths now route
  // through StorageContext.performSignOutWithCleanup, which has its own
  // coverage in StorageContext.test.tsx.

  it('calls runSignOutCleanup when onAuthStateChanged fires with null, and sets user/loading correctly (E1)', async () => {
    // v0.27.0 (Pass 1, E1): externally-revoked session path.
    // Trace: callback(null) → if (!firebaseUser) branch → void runSignOutCleanup()
    //        + setUser(null) + setLoading(false).
    mockOnAuthStateChanged.mockImplementation(
      (_auth: unknown, callback: (user: null) => void) => {
        callback(null);
        return vi.fn();
      },
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() =>
      expect(vi.mocked(runSignOutCleanup)).toHaveBeenCalledTimes(1),
    );
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
  });
});
