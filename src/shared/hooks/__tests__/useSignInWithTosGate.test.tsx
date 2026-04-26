// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// useSignInWithTosGate tests — verifies the load-bearing localStorage flag
// sequencing for ToS consent. v13.0 + v16.6 architecture depends on
// TOS_ACCEPTED_KEY → TOS_WRITE_PENDING_KEY → signInWithPopup ordering.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSignInWithTosGate } from '../useSignInWithTosGate';
import { TOS_VERSION } from '../../../lib/version';

const mockSignInWithGoogle = vi.fn();
const mockSignInWithMicrosoft = vi.fn();

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    signInWithGoogle: mockSignInWithGoogle,
    signInWithMicrosoft: mockSignInWithMicrosoft,
  }),
}));

const TOS_ACCEPTED_KEY = 'spert_tos_accepted_version';
const TOS_WRITE_PENDING_KEY = 'spert_tos_write_pending';

describe('useSignInWithTosGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockSignInWithGoogle.mockResolvedValue(undefined);
    mockSignInWithMicrosoft.mockResolvedValue(undefined);
  });

  describe('signIn — ToS already accepted', () => {
    beforeEach(() => {
      localStorage.setItem(TOS_ACCEPTED_KEY, TOS_VERSION);
    });

    it('skips ToS modal and signs in directly with Google', async () => {
      const { result } = renderHook(() => useSignInWithTosGate());
      await act(async () => {
        await result.current.signIn('google');
      });
      expect(result.current.tosModalOpen).toBe(false);
      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
      expect(mockSignInWithMicrosoft).not.toHaveBeenCalled();
    });

    it('skips ToS modal and signs in directly with Microsoft', async () => {
      const { result } = renderHook(() => useSignInWithTosGate());
      await act(async () => {
        await result.current.signIn('microsoft');
      });
      expect(mockSignInWithMicrosoft).toHaveBeenCalledTimes(1);
      expect(mockSignInWithGoogle).not.toHaveBeenCalled();
    });
  });

  describe('signIn — ToS not yet accepted', () => {
    it('opens ToS modal instead of signing in immediately', async () => {
      const { result } = renderHook(() => useSignInWithTosGate());
      await act(async () => {
        await result.current.signIn('google');
      });
      expect(result.current.tosModalOpen).toBe(true);
      expect(mockSignInWithGoogle).not.toHaveBeenCalled();
    });

    it('opens modal when version differs from current TOS_VERSION', async () => {
      localStorage.setItem(TOS_ACCEPTED_KEY, '01-01-1999');
      const { result } = renderHook(() => useSignInWithTosGate());
      await act(async () => {
        await result.current.signIn('google');
      });
      expect(result.current.tosModalOpen).toBe(true);
    });
  });

  describe('onTosAccept — load-bearing localStorage sequence', () => {
    it('writes TOS_ACCEPTED_KEY and TOS_WRITE_PENDING_KEY before signInWithPopup fires', async () => {
      const callOrder: string[] = [];
      mockSignInWithGoogle.mockImplementation(async () => {
        callOrder.push('signIn');
        // At sign-in time both flags must already be set.
        callOrder.push(`accepted=${localStorage.getItem(TOS_ACCEPTED_KEY)}`);
        callOrder.push(`pending=${localStorage.getItem(TOS_WRITE_PENDING_KEY)}`);
      });

      const { result } = renderHook(() => useSignInWithTosGate());
      await act(async () => {
        await result.current.signIn('google');
      });
      expect(result.current.tosModalOpen).toBe(true);

      await act(async () => {
        await result.current.onTosAccept();
      });

      expect(localStorage.getItem(TOS_ACCEPTED_KEY)).toBe(TOS_VERSION);
      expect(localStorage.getItem(TOS_WRITE_PENDING_KEY)).toBe('true');
      expect(callOrder).toEqual([
        'signIn',
        `accepted=${TOS_VERSION}`,
        'pending=true',
      ]);
      expect(result.current.tosModalOpen).toBe(false);
    });
  });

  describe('onTosCancel', () => {
    it('closes modal without writing localStorage flags', async () => {
      const { result } = renderHook(() => useSignInWithTosGate());
      await act(async () => {
        await result.current.signIn('google');
      });
      act(() => {
        result.current.onTosCancel();
      });
      expect(result.current.tosModalOpen).toBe(false);
      expect(localStorage.getItem(TOS_ACCEPTED_KEY)).toBeNull();
      expect(localStorage.getItem(TOS_WRITE_PENDING_KEY)).toBeNull();
      expect(mockSignInWithGoogle).not.toHaveBeenCalled();
    });
  });

  describe('error normalization', () => {
    it('uses sanitizeFirebaseError fallback when no normalizeError is provided', async () => {
      const err: Error & { code?: string } = new Error('original');
      err.code = 'auth/popup-closed-by-user';
      mockSignInWithGoogle.mockRejectedValue(err);

      localStorage.setItem(TOS_ACCEPTED_KEY, TOS_VERSION);
      const { result } = renderHook(() => useSignInWithTosGate());
      await act(async () => {
        await result.current.signIn('google');
      });
      expect(result.current.authError).toBe('Sign-in was cancelled.');
    });

    it('normalizeError returning null silences the error', async () => {
      const err: Error & { code?: string } = new Error('original');
      err.code = 'auth/popup-closed-by-user';
      mockSignInWithGoogle.mockRejectedValue(err);

      localStorage.setItem(TOS_ACCEPTED_KEY, TOS_VERSION);
      const { result } = renderHook(() =>
        useSignInWithTosGate({
          normalizeError: (e) => {
            const code = (e as { code?: string }).code;
            if (code === 'auth/popup-closed-by-user') return null;
            return undefined;
          },
        })
      );
      await act(async () => {
        await result.current.signIn('google');
      });
      expect(result.current.authError).toBeNull();
    });

    it('normalizeError returning a string sets that custom message', async () => {
      const err: Error & { code?: string } = new Error('original');
      err.code = 'auth/popup-blocked';
      mockSignInWithGoogle.mockRejectedValue(err);

      localStorage.setItem(TOS_ACCEPTED_KEY, TOS_VERSION);
      const { result } = renderHook(() =>
        useSignInWithTosGate({
          normalizeError: (e) => {
            const code = (e as { code?: string }).code;
            if (code === 'auth/popup-blocked') return 'Custom popup-blocked message';
            return undefined;
          },
        })
      );
      await act(async () => {
        await result.current.signIn('google');
      });
      expect(result.current.authError).toBe('Custom popup-blocked message');
    });

    it('normalizeError returning undefined falls through to sanitizeFirebaseError', async () => {
      const err: Error & { code?: string } = new Error('boom');
      err.code = 'permission-denied';
      mockSignInWithGoogle.mockRejectedValue(err);

      localStorage.setItem(TOS_ACCEPTED_KEY, TOS_VERSION);
      const { result } = renderHook(() =>
        useSignInWithTosGate({
          normalizeError: () => undefined,
        })
      );
      await act(async () => {
        await result.current.signIn('google');
      });
      expect(result.current.authError).toBe('Permission denied. Please check your account access.');
    });

    it('clears authError on successful sign-in', async () => {
      localStorage.setItem(TOS_ACCEPTED_KEY, TOS_VERSION);
      const { result } = renderHook(() => useSignInWithTosGate());
      // First, set an error manually
      act(() => {
        result.current.setAuthError('previous error');
      });
      expect(result.current.authError).toBe('previous error');
      // Then a successful sign-in clears it
      await act(async () => {
        await result.current.signIn('google');
      });
      expect(result.current.authError).toBeNull();
    });
  });
});
