// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Firebase initialization — conditional on environment variables
// When env vars are missing, exports null values and the app operates in local-only mode.

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { initializeFirestore, getFirestore, memoryLocalCache, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';

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

// Cloud Functions instance for invitation callables. Module-scoped so it
// shares lifetime with `app` and `db`. Region matches the deployment in
// spert-landing-page (us-central1). When isFirebaseAvailable is false,
// stays null and the getXxx() helpers below return null.
const functionsInstance: Functions | null = isFirebaseAvailable && app
  ? getFunctions(app, 'us-central1')
  : null;

export interface SendInvitationEmailInput {
  /** Hardcoded string literal per LESSONS-LEARNED §15 — do NOT reference APP_ID. */
  appId: 'ganttapp';
  modelId: string;
  emails: string[];
  role: 'editor' | 'viewer';
  /** GanttApp has no voting model — always false. */
  isVoting: false;
}

export interface SendInvitationEmailOutput {
  /** Emails of existing suite members who were auto-added immediately. */
  added: string[];
  /** Emails of new users who received an invitation email. */
  invited: string[];
  failed: { email: string; reason: string }[];
}

export interface ClaimPendingInvitationsOutput {
  claimed: { appId: string; modelId: string; modelName: string }[];
}

export function getSendInvitationEmail() {
  if (!functionsInstance) return null;
  return httpsCallable<SendInvitationEmailInput, SendInvitationEmailOutput>(
    functionsInstance,
    'sendInvitationEmail',
  );
}

export function getClaimPendingInvitations() {
  if (!functionsInstance) return null;
  return httpsCallable<Record<string, never>, ClaimPendingInvitationsOutput>(
    functionsInstance,
    'claimPendingInvitations',
  );
}

export function getRevokeInvite() {
  if (!functionsInstance) return null;
  return httpsCallable<{ tokenId: string }, { revoked: true }>(
    functionsInstance,
    'revokeInvite',
  );
}

export function getResendInvite() {
  if (!functionsInstance) return null;
  return httpsCallable<{ tokenId: string }, { resent: true; emailSendCount: number }>(
    functionsInstance,
    'resendInvite',
  );
}
// No getUpdateInvite — AHP-specific, not applicable to GanttApp.
