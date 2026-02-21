// Firebase initialization — conditional on environment variables
// When env vars are missing, exports null values and the app operates in local-only mode.

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { initializeFirestore, memoryLocalCache, type Firestore } from 'firebase/firestore';
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
export const db: Firestore | null = app
  ? initializeFirestore(app, {
      localCache: memoryLocalCache(),
    })
  : null;

export const auth: Auth | null = app ? getAuth(app) : null;

/** True when Firebase SDK is initialized and available. */
export const isFirebaseAvailable: boolean = isFirebaseConfigured && app !== null;
