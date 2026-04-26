// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// useSignInWithTosGate — encapsulates the Terms-of-Service consent gate that
// must run before Firebase Auth fires. Both SettingsTab and CloudStorageModal
// consume this hook so the load-bearing localStorage flag sequencing
// (TOS_ACCEPTED_KEY → TOS_WRITE_PENDING_KEY → signInWithPopup) cannot drift.
//
// Placed in src/shared/hooks/ rather than src/features/settings/ because it's
// consumed by both a feature (SettingsTab) and a shared component
// (CloudStorageModal). v17.0 placement choice — see plan §1.3.

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { TOS_VERSION } from '../../lib/version';
import { sanitizeFirebaseError } from '../utils/validation';

const TOS_ACCEPTED_KEY = 'spert_tos_accepted_version';
const TOS_WRITE_PENDING_KEY = 'spert_tos_write_pending';

export type SignInProvider = 'google' | 'microsoft';

export interface SignInWithTosGate {
  authError: string | null;
  setAuthError: (msg: string | null) => void;
  signIn: (provider: SignInProvider) => Promise<void>;
  // Render-prop fields the consumer passes to <TosConsentModal>
  tosModalOpen: boolean;
  onTosAccept: () => Promise<void>;
  onTosCancel: () => void;
}

export interface UseSignInWithTosGateOptions {
  /**
   * Optional error normalizer called inside the catch of executeSignIn,
   * before sanitizeFirebaseError. Return `null` to silence (no error
   * displayed; the prior authError is cleared). Return a string to display
   * a custom message. Return `undefined` to fall through to sanitizeFirebaseError.
   */
  normalizeError?: (error: unknown) => string | null | undefined;
}

export function useSignInWithTosGate(
  opts: UseSignInWithTosGateOptions = {}
): SignInWithTosGate {
  const { signInWithGoogle, signInWithMicrosoft } = useAuth();

  const [authError, setAuthError] = useState<string | null>(null);
  const [tosModalOpen, setTosModalOpen] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<SignInProvider | null>(null);

  const executeSignIn = async (provider: SignInProvider) => {
    try {
      if (provider === 'google') {
        await signInWithGoogle();
      } else {
        await signInWithMicrosoft();
      }
      // Successful sign-in clears any prior error.
      setAuthError(null);
    } catch (error) {
      if (opts.normalizeError) {
        const normalized = opts.normalizeError(error);
        if (normalized === null) {
          // Silent: clear any prior error, render no message.
          setAuthError(null);
          return;
        }
        if (typeof normalized === 'string') {
          setAuthError(normalized);
          return;
        }
        // undefined → fall through
      }
      setAuthError(sanitizeFirebaseError(error));
    }
  };

  const signIn = async (provider: SignInProvider) => {
    setAuthError(null);
    const accepted = typeof window !== 'undefined'
      ? localStorage.getItem(TOS_ACCEPTED_KEY)
      : null;
    if (accepted === TOS_VERSION) {
      // ToS already accepted at current version — proceed directly.
      await executeSignIn(provider);
    } else {
      // Show consent modal first.
      setPendingProvider(provider);
      setTosModalOpen(true);
    }
  };

  const onTosAccept = async () => {
    setTosModalOpen(false);
    if (typeof window !== 'undefined') {
      // Load-bearing order: ACCEPTED first, WRITE_PENDING second, THEN sign-in.
      // v13.0 + v16.6 architecture depends on both flags being set before
      // signInWithPopup fires, so AuthContext's onAuthStateChanged Branch A
      // can write the Firestore record.
      localStorage.setItem(TOS_ACCEPTED_KEY, TOS_VERSION);
      localStorage.setItem(TOS_WRITE_PENDING_KEY, 'true');
    }
    if (pendingProvider) {
      const provider = pendingProvider;
      setPendingProvider(null);
      await executeSignIn(provider);
    }
  };

  const onTosCancel = () => {
    setTosModalOpen(false);
    setPendingProvider(null);
  };

  return {
    authError,
    setAuthError,
    signIn,
    tosModalOpen,
    onTosAccept,
    onTosCancel,
  };
}
