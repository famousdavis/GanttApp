// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Firebase Authentication context — provides Google/Microsoft SSO
// When Firebase is unavailable, provides a stub context (local-only mode).
// v13.0: ToS acceptance resolution in onAuthStateChanged (Items 4 & 5).

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { auth, db, isFirebaseAvailable } from '../lib/firebase';
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

const TOS_ACCEPTED_KEY = 'spert_tos_accepted_version';
const TOS_WRITE_PENDING_KEY = 'spert_tos_write_pending';

export interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
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
            setUser(firebaseUser);
          }
          // If signed out, onAuthStateChanged fires again with null
        })
        .catch((err) => {
          // Allow through on errors — don't block the user
          console.error('[AuthContext] ToS resolution error:', err);
          setUser(firebaseUser);
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
  };

  return <AuthContext value={value}>{children}</AuthContext>;
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
    // Branch A: Fresh consent — write acceptance to Firestore
    localStorage.removeItem(TOS_WRITE_PENDING_KEY);

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

      // Cache acceptance locally
      localStorage.setItem(TOS_ACCEPTED_KEY, TOS_VERSION);
    } catch (err) {
      // Firestore write failed — allow through, log error
      console.error('[AuthContext] ToS Firestore write failed:', err);
      // Still cache locally since user accepted in the modal
      localStorage.setItem(TOS_ACCEPTED_KEY, TOS_VERSION);
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
    await firebaseSignOut(auth!);
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
