// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Firebase initialization — conditional on environment variables
// When env vars are missing, exports null values and the app operates in local-only mode.

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { initializeFirestore, getFirestore, memoryLocalCache, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** True when all required Firebase env vars are present. */
const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

const app: FirebaseApp | null = isFirebaseConfigured
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0])
  : null;

// Use initializeFirestore (not getFirestore) for cache config.
// memoryLocalCache avoids IndexedDB persistence issues (stale security rule
// decisions cached across rule deployments). Offline support is not needed —
// GanttApp's local mode handles offline use cases.
// On HMR re-evaluation, initializeFirestore throws if already called — fall back to getFirestore.
function getOrInitFirestore(firebaseApp: FirebaseApp): Firestore {
  try {
    return initializeFirestore(firebaseApp, { localCache: memoryLocalCache() });
  } catch {
    return getFirestore(firebaseApp);
  }
}

export const db: Firestore | null = app ? getOrInitFirestore(app) : null;

export const auth: Auth | null = app ? getAuth(app) : null;

/** True when Firebase SDK is initialized and available. */
export const isFirebaseAvailable: boolean = isFirebaseConfigured && app !== null;
