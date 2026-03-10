// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Firebase Authentication context — provides Google/Microsoft SSO
// When Firebase is unavailable, provides a stub context (local-only mode).

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { auth, isFirebaseAvailable } from '../lib/firebase';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  OAuthProvider,
  type User as FirebaseUser,
} from 'firebase/auth';

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
      setUser(firebaseUser);
      setLoading(false);
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

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
