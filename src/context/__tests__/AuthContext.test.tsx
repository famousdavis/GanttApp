// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';

// Mock firebase modules before importing AuthContext
const mockOnAuthStateChanged = vi.fn();
const mockSignInWithPopup = vi.fn();
const mockSignOut = vi.fn();

vi.mock('../../lib/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  isFirebaseAvailable: true,
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
}));

vi.mock('../../lib/version', () => ({
  TOS_VERSION: '03-11-2026',
  APP_ID: 'ganttapp',
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

  it('calls firebase signOut', async () => {
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: null) => void) => {
      callback(null);
      return vi.fn();
    });
    mockSignOut.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.signOut();
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
