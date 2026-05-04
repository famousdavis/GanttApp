// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Firebase Authentication context — provides Google/Microsoft SSO
// When Firebase is unavailable, provides a stub context (local-only mode).
// v13.0: ToS acceptance resolution in onAuthStateChanged (Items 4 & 5).

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { auth, db, isFirebaseAvailable, getClaimPendingInvitations } from '../lib/firebase';
import { TOS_VERSION, APP_ID } from '../lib/version';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  OAuthProvider,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { sanitizeFirebaseError, sanitizeString } from '../shared/utils/validation';
import { denormalizeLastFirst } from '../lib/auth-name';
import { INVITATIONS_ENABLED } from '../lib/feature-flags';
import { runSignOutCleanup } from './signOutCleanupRegistry';

const TOS_ACCEPTED_KEY = 'spert_tos_accepted_version';
const TOS_WRITE_PENDING_KEY = 'spert_tos_write_pending';

export interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  /**
   * Mirror of isFirebaseAvailable. Used by InvitationBanner (and any other
   * consumer) to gate sign-in CTAs without re-importing the lib constant.
   */
  firebaseAvailable: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('openid');
googleProvider.addScope('profile');
googleProvider.addScope('email');

const microsoftProvider = new OAuthProvider('microsoft.com');
microsoftProvider.addScope('openid');
microsoftProvider.addScope('profile');
microsoftProvider.addScope('email');

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(isFirebaseAvailable);

  useEffect(() => {
    if (!isFirebaseAvailable || !auth) return;

    /**
     * Single-exit-point pattern (v18.0.0 / D2): every auth-state path that
     * resolves to a signed-in user runs profile write + claim-pending in
     * the same order. Profile write is fire-and-forget so setUser is not
     * blocked by Firestore latency.
     */
    function setUserAndClaim(firebaseUser: FirebaseUser): void {
      void writeUserProfile(firebaseUser).catch((err) => {
        console.error('[AuthContext] writeUserProfile failed:', err);
      });
      setUser(firebaseUser);
      claimPendingInvitationsAndNotify(firebaseUser);
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser || !db) {
        setUser(firebaseUser);
        setLoading(false);
        return;
      }

      // Resolve ToS acceptance before completing auth state transition
      handleTosResolution(firebaseUser)
        .then((signedOut) => {
          if (!signedOut) {
            setUserAndClaim(firebaseUser);
          }
          // If signed out, onAuthStateChanged fires again with null
        })
        .catch((err) => {
          // Allow through on errors — don't block the user
          console.error('[AuthContext] ToS resolution error:', sanitizeFirebaseError(err));
          setUserAndClaim(firebaseUser);
        })
        .finally(() => {
          setLoading(false);
        });
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!isFirebaseAvailable || !auth) {
      throw new Error('Firebase is not configured. Cloud features are unavailable.');
    }
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signInWithMicrosoft = useCallback(async () => {
    if (!isFirebaseAvailable || !auth) {
      throw new Error('Firebase is not configured. Cloud features are unavailable.');
    }
    await signInWithPopup(auth, microsoftProvider);
  }, []);

  const signOut = useCallback(async () => {
    if (!isFirebaseAvailable || !auth) {
      throw new Error('Firebase is not configured. Cloud features are unavailable.');
    }
    await firebaseSignOut(auth);
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    signInWithGoogle,
    signInWithMicrosoft,
    signOut,
    isAuthenticated: user !== null,
    firebaseAvailable: isFirebaseAvailable,
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

/**
 * Writes the user's profile to ganttapp_profiles + spertsuite_profiles.
 * Note: callers (see setUserAndClaim) invoke this fire-and-forget — setUser
 * fires before this Promise resolves. Downstream consumers that depend on
 * profile existence must read Firestore directly; do not assume
 * "user is set ⇒ profile exists in ganttapp_profiles."
 *
 * Dual-write is the canonical pattern (D2, v18.0.0):
 *   - ganttapp_profiles/{uid}    — app-specific (legacy, used by ShareDialog email lookup)
 *   - spertsuite_profiles/{uid}  — suite-wide (used by sendInvitationEmail email→uid resolution)
 *
 * displayName is denormalized via auth-name's denormalizeLastFirst() to
 * fix Microsoft AD's "Last, First" format. Email is lowercased. Both
 * additionally pass through sanitizeString as defense-in-depth.
 */
async function writeUserProfile(firebaseUser: FirebaseUser): Promise<void> {
  if (!isFirebaseAvailable || !db) return;
  const normalizedName = sanitizeString(denormalizeLastFirst(firebaseUser.displayName ?? ''));
  const normalizedEmail = sanitizeString((firebaseUser.email ?? '').toLowerCase());
  const payload = {
    displayName: normalizedName,
    email: normalizedEmail,
    photoURL: firebaseUser.photoURL ?? null,
    updatedAt: serverTimestamp(),
  };
  // Parallel writes — neither blocks the other on Firestore latency.
  await Promise.all([
    setDoc(doc(db, `ganttapp_profiles/${firebaseUser.uid}`), payload, { merge: true }),
    setDoc(doc(db, `spertsuite_profiles/${firebaseUser.uid}`), payload, { merge: true }),
  ]);
}

/**
 * Fire the bulk-invitation claim callable, then dispatch a custom event
 * so AppDataContext can reload its project list. No-op when the flag is
 * off or Firebase is unavailable. Errors are logged with the uid (for
 * triage) but never bubble — the user's auth flow must not block on this.
 *
 * Event name 'spert:models-changed' is a suite-wide contract — do not rename.
 */
function claimPendingInvitationsAndNotify(firebaseUser: FirebaseUser): void {
  if (!INVITATIONS_ENABLED) return;
  const callable = getClaimPendingInvitations();
  if (!callable) return;
  void callable({})
    .then((res) => {
      const claimed = res.data?.claimed ?? [];
      if (claimed.length > 0 && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('spert:models-changed', { detail: { claimed } }),
        );
      }
    })
    .catch((err: unknown) => {
      console.error(
        '[AuthContext] claimPendingInvitations failed for uid', firebaseUser.uid,
        '— code:', (err as { code?: string }).code ?? 'unknown',
      );
    });
}

/**
 * Resolve ToS acceptance for an authenticated user.
 *
 * Branch A (pending write): User just accepted ToS in the consent modal and signed in.
 *   - Write acceptance record to Firestore users/{uid}.
 *
 * Branch B (returning user): Existing session restored on page load.
 *   - Verify ToS version is current; sign out if not.
 *
 * Returns true if the user was signed out (version mismatch), false otherwise.
 */
async function handleTosResolution(firebaseUser: FirebaseUser): Promise<boolean> {
  const writePending = localStorage.getItem(TOS_WRITE_PENDING_KEY);

  if (writePending === 'true') {
    // Branch A: Fresh consent — write acceptance to Firestore.
    // v16.6 (TOS-WRITE-ORPHAN fix): remove TOS_WRITE_PENDING_KEY only AFTER
    // the Firestore write succeeds. If the write fails (network, transient
    // Firestore error), leave the pending flag set so the next sign-in
    // retries Branch A. Previously the flag was cleared before the write,
    // which orphaned local "accepted" state from the missing Firestore
    // record across SPERT Suite apps.
    try {
      const userRef = doc(db!, `users/${firebaseUser.uid}`);
      const existingDoc = await getDoc(userRef);
      const authProvider = firebaseUser.providerData[0]?.providerId ?? 'unknown';

      if (!existingDoc.exists()) {
        // Case (a): Document missing — full write including appId
        await setDoc(userRef, {
          acceptedAt: serverTimestamp(),
          tosVersion: TOS_VERSION,
          privacyPolicyVersion: TOS_VERSION,
          appId: APP_ID,
          authProvider,
        });
      } else {
        const data = existingDoc.data();
        if (data.tosVersion !== TOS_VERSION) {
          // Case (b): Doc exists, version differs — update WITHOUT appId
          await setDoc(userRef, {
            acceptedAt: serverTimestamp(),
            tosVersion: TOS_VERSION,
            privacyPolicyVersion: TOS_VERSION,
            authProvider,
          }, { merge: true });
        }
        // Case (c): Doc exists, version matches — skip write
      }

      // Success path: clear pending flag AND cache acceptance.
      localStorage.removeItem(TOS_WRITE_PENDING_KEY);
      localStorage.setItem(TOS_ACCEPTED_KEY, TOS_VERSION);
    } catch (err) {
      // Firestore write failed — keep TOS_WRITE_PENDING_KEY set so next
      // sign-in retries Branch A. Do NOT set TOS_ACCEPTED_KEY (would cause
      // subsequent sign-ins to skip Branch A and skip the retry). Allow
      // the user through — the app still functions locally.
      console.error('[AuthContext] ToS Firestore write failed, will retry on next sign-in:', err);
    }

    return false; // User was not signed out
  }

  // Branch B: Returning user — verify ToS version
  const localVersion = localStorage.getItem(TOS_ACCEPTED_KEY);

  if (localVersion === TOS_VERSION) {
    // Local cache says current — trust it, skip Firestore check
    return false;
  }

  // Local version missing or outdated — check Firestore
  try {
    const userRef = doc(db!, `users/${firebaseUser.uid}`);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const data = userDoc.data();
      if (data.tosVersion === TOS_VERSION) {
        // Firestore says current — cache locally, proceed
        localStorage.setItem(TOS_ACCEPTED_KEY, TOS_VERSION);
        return false;
      }
    }

    // Document missing OR version differs — sign out
    console.warn('[AuthContext] ToS version mismatch — signing user out');
    // v16.6: route through the centralized cleanup helper registered by
    // StorageContext. If the registry is empty (StorageProvider not yet
    // mounted — early boot edge case), fall back to firebaseSignOut so
    // the user is still signed out.
    const cleanup = await runSignOutCleanup();
    if (!cleanup.wasRegistered && auth) {
      await firebaseSignOut(auth);
    }
    localStorage.removeItem(TOS_ACCEPTED_KEY);
    return true; // User was signed out

  } catch (err) {
    // Firestore read failed — allow through (don't block on transient errors)
    console.error('[AuthContext] ToS Firestore check failed, allowing through:', err);
    return false;
  }
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
