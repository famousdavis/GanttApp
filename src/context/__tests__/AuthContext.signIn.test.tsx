// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// What AuthProvider does as a signed-in user resolves: the terms-of-service
// check (recording a fresh acceptance, or checking a returning user's), the
// profile it writes, and the invitations it claims. Also: sign-in when
// Firebase is not configured.
//
// Firestore is an in-memory fake keyed by document path, so getDoc sees what
// setDoc wrote and { merge: true } keeps the fields already stored. The
// sign-out cleanup registry is the real module.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Mock } from 'vitest';
import type { User } from 'firebase/auth';
import { format } from 'node:util';

type DocData = Record<string, unknown>;
type DocRef = { path: string };

const h = vi.hoisted(() => {
  const store = new Map<string, DocData>();
  const failures = { read: new Map<string, Error>(), write: new Map<string, Error>() };
  return {
    store,
    failures,
    SERVER_TIMESTAMP: Object.freeze({ sentinel: 'serverTimestamp' }),
    AUTH: { name: 'auth' },
    DB: { name: 'db' },
    state: { firebaseAvailable: true, claim: null as Mock | null },
    onAuthStateChanged: vi.fn(),
    signInWithPopup: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
    getDoc: vi.fn(async (ref: DocRef) => {
      const failure = failures.read.get(ref.path);
      if (failure) throw failure;
      const data = store.get(ref.path);
      return { exists: () => data !== undefined, data: () => (data === undefined ? undefined : { ...data }) };
    }),
    setDoc: vi.fn(async (ref: DocRef, data: DocData, options?: { merge?: boolean }) => {
      const failure = failures.write.get(ref.path);
      if (failure) throw failure;
      store.set(ref.path, options?.merge ? { ...store.get(ref.path), ...data } : { ...data });
    }),
  };
});

vi.mock('../../lib/firebase', () => ({
  get auth() { return h.state.firebaseAvailable ? h.AUTH : null; },
  get db() { return h.state.firebaseAvailable ? h.DB : null; },
  get isFirebaseAvailable() { return h.state.firebaseAvailable; },
  getClaimPendingInvitations: () => h.state.claim,
  getSendInvitationEmail: () => null,
  getRevokeInvite: () => null,
  getResendInvite: () => null,
}));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, path: string) => ({ path }),
  getDoc: h.getDoc,
  setDoc: h.setDoc,
  serverTimestamp: () => h.SERVER_TIMESTAMP,
}));

vi.mock('firebase/auth', () => {
  class MockGoogleAuthProvider {
    addScope = vi.fn();
  }
  class MockOAuthProvider {
    addScope = vi.fn();
  }
  return {
    onAuthStateChanged: h.onAuthStateChanged,
    signInWithPopup: h.signInWithPopup,
    signOut: h.signOut,
    GoogleAuthProvider: MockGoogleAuthProvider,
    OAuthProvider: MockOAuthProvider,
  };
});

// These tests exercise the invitation claim, which only runs with the flag on.
vi.mock('../../lib/feature-flags', () => ({ INVITATIONS_ENABLED: true }));

import { AuthProvider, useAuth } from '../AuthContext';
import { registerSignOutCleanup } from '../signOutCleanupRegistry';
import { TOS_VERSION, APP_ID } from '../../lib/version';

const ACCEPTED_KEY = 'spert_tos_accepted_version';
const PENDING_KEY = 'spert_tos_write_pending';
const OLDER_VERSION = '03-11-2026';
const UID = 'uid-ada';
const ACCEPTANCE_PATH = `users/${UID}`;

function makeUser(overrides: Record<string, unknown> = {}): User {
  return {
    uid: UID,
    email: 'ada@example.com',
    displayName: 'Ada Lovelace',
    photoURL: 'https://example.com/ada.png',
    emailVerified: true,
    providerData: [{ providerId: 'google.com' }],
    ...overrides,
  } as unknown as User;
}

function firebaseError(code: string): Error {
  return Object.assign(new Error(`Firestore failed: ${code}`), { code });
}

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

/** Render the provider with `user` as the auth state, and wait until loading ends. */
async function signIn(user: User) {
  h.onAuthStateChanged.mockImplementation((_auth: unknown, callback: (u: User) => void) => {
    callback(user);
    return vi.fn();
  });
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result;
}

function writesTo(path: string) {
  return h.setDoc.mock.calls.filter(([ref]) => ref.path === path);
}

function expectProfileOnBothPaths(payload: DocData) {
  ['ganttapp_profiles', 'spertsuite_profiles'].forEach((collection) => {
    const path = `${collection}/${UID}`;
    expect(writesTo(path), path).toStrictEqual([[{ path }, payload, { merge: true }]]);
  });
}

const cleanups: Array<() => void> = [];

function registerCleanupSpy() {
  const cleanup = vi.fn().mockResolvedValue(undefined);
  cleanups.push(registerSignOutCleanup(cleanup));
  return cleanup;
}

function listenForModelsChanged() {
  const onModelsChanged = vi.fn<(event: CustomEvent) => void>();
  const listener = (event: Event) => onModelsChanged(event as CustomEvent);
  window.addEventListener('spert:models-changed', listener);
  cleanups.push(() => window.removeEventListener('spert:models-changed', listener));
  return onModelsChanged;
}

function loggedErrors(): string {
  return vi.mocked(console.error).mock.calls.map((args) => format(...args)).join('\n');
}

/** Let pending promise callbacks (the claim's) run. */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  h.store.clear();
  h.failures.read.clear();
  h.failures.write.clear();
  h.state.firebaseAvailable = true;
  h.state.claim = null;
  registerSignOutCleanup(async () => {})(); // start with nothing registered
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.restoreAllMocks();
});

describe('AuthProvider when a user signs in', () => {
  describe('recording a fresh terms acceptance', () => {
    beforeEach(() => {
      localStorage.setItem(PENDING_KEY, 'true');
    });

    it('records a full acceptance with the app and sign-in provider when the account has none', async () => {
      const user = makeUser({ providerData: [{ providerId: 'microsoft.com' }] });
      const result = await signIn(user);

      expect(result.current.user).toBe(user);
      expect(writesTo(ACCEPTANCE_PATH)).toHaveLength(1);
      const record = {
        acceptedAt: h.SERVER_TIMESTAMP,
        tosVersion: TOS_VERSION,
        privacyPolicyVersion: TOS_VERSION,
        appId: APP_ID,
        authProvider: 'microsoft.com',
      };
      expect(writesTo(ACCEPTANCE_PATH)[0][1]).toStrictEqual(record);
      expect(h.store.get(ACCEPTANCE_PATH)).toStrictEqual(record);
    });

    it('updates an outdated acceptance by merge, leaving the app that first recorded it', async () => {
      h.store.set(ACCEPTANCE_PATH, {
        acceptedAt: 'earlier',
        tosVersion: OLDER_VERSION,
        privacyPolicyVersion: OLDER_VERSION,
        appId: 'spertahp',
        authProvider: 'microsoft.com',
      });
      await signIn(makeUser());

      expect(writesTo(ACCEPTANCE_PATH)).toHaveLength(1);
      const [, data, options] = writesTo(ACCEPTANCE_PATH)[0];
      expect(data).toStrictEqual({
        acceptedAt: h.SERVER_TIMESTAMP,
        tosVersion: TOS_VERSION,
        privacyPolicyVersion: TOS_VERSION,
        authProvider: 'google.com',
      });
      expect(options).toStrictEqual({ merge: true });
      expect(h.store.get(ACCEPTANCE_PATH)).toStrictEqual({
        acceptedAt: h.SERVER_TIMESTAMP,
        tosVersion: TOS_VERSION,
        privacyPolicyVersion: TOS_VERSION,
        appId: 'spertahp',
        authProvider: 'google.com',
      });
    });

    it('leaves an acceptance that is already current unwritten', async () => {
      h.store.set(ACCEPTANCE_PATH, { tosVersion: TOS_VERSION, appId: 'spertahp' });
      await signIn(makeUser());

      expect(h.getDoc).toHaveBeenCalledWith({ path: ACCEPTANCE_PATH }); // the record was read
      expect(localStorage.getItem(PENDING_KEY)).toBeNull(); // and the acceptance completed
      expect(writesTo(ACCEPTANCE_PATH)).toHaveLength(0);
    });

    it.each([
      ['created', undefined],
      ['updated', { tosVersion: OLDER_VERSION }],
      ['already current', { tosVersion: TOS_VERSION }],
    ] as const)('clears the pending flag and caches the accepted version once the record is %s', async (_state, existing) => {
      if (existing) h.store.set(ACCEPTANCE_PATH, { ...existing });
      const user = makeUser();
      const result = await signIn(user);

      expect(result.current.user).toBe(user);
      expect(localStorage.getItem(PENDING_KEY)).toBeNull();
      expect(localStorage.getItem(ACCEPTED_KEY)).toBe(TOS_VERSION);
    });

    it('keeps the pending flag, caches nothing, and still signs in when the acceptance cannot be written', async () => {
      h.failures.write.set(ACCEPTANCE_PATH, firebaseError('unavailable'));
      const user = makeUser();
      const result = await signIn(user);

      expect(writesTo(ACCEPTANCE_PATH)).toHaveLength(1); // the write was attempted
      expect(result.current.user).toBe(user);
      expect(localStorage.getItem(PENDING_KEY)).toBe('true');
      expect(localStorage.getItem(ACCEPTED_KEY)).toBeNull();
    });

    it('records the sign-in provider as unknown when the account has no provider data', async () => {
      await signIn(makeUser({ providerData: [] }));

      expect(writesTo(ACCEPTANCE_PATH)).toHaveLength(1);
      expect(writesTo(ACCEPTANCE_PATH)[0][1]).toStrictEqual({
        acceptedAt: h.SERVER_TIMESTAMP,
        tosVersion: TOS_VERSION,
        privacyPolicyVersion: TOS_VERSION,
        appId: APP_ID,
        authProvider: 'unknown',
      });
    });
  });

  describe('checking the terms a returning user accepted', () => {
    it('signs in and caches the version when the stored acceptance is current', async () => {
      h.store.set(ACCEPTANCE_PATH, { tosVersion: TOS_VERSION });
      const cleanup = registerCleanupSpy();
      const user = makeUser();
      const result = await signIn(user);

      expect(result.current.user).toBe(user);
      expect(localStorage.getItem(ACCEPTED_KEY)).toBe(TOS_VERSION);
      expect(cleanup).not.toHaveBeenCalled();
    });

    it('signs out through the registered cleanup and forgets the cached version when the stored acceptance is outdated', async () => {
      localStorage.setItem(ACCEPTED_KEY, OLDER_VERSION);
      h.store.set(ACCEPTANCE_PATH, { tosVersion: OLDER_VERSION });
      const cleanup = registerCleanupSpy();
      const result = await signIn(makeUser());

      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(h.signOut).not.toHaveBeenCalled();
      expect(localStorage.getItem(ACCEPTED_KEY)).toBeNull();
      expect(result.current.user).toBeNull();
    });

    it('signs out through the registered cleanup when the account has no acceptance record', async () => {
      localStorage.setItem(ACCEPTED_KEY, OLDER_VERSION);
      const cleanup = registerCleanupSpy();
      const result = await signIn(makeUser());

      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem(ACCEPTED_KEY)).toBeNull();
      expect(result.current.user).toBeNull();
    });

    it('signs out through Firebase directly when no sign-out cleanup is registered', async () => {
      h.store.set(ACCEPTANCE_PATH, { tosVersion: OLDER_VERSION });
      const result = await signIn(makeUser());

      expect(h.signOut).toHaveBeenCalledTimes(1);
      expect(h.signOut).toHaveBeenCalledWith(h.AUTH);
      expect(result.current.user).toBeNull();
    });

    it('still signs in, caching nothing, when the acceptance record cannot be read', async () => {
      h.failures.read.set(ACCEPTANCE_PATH, firebaseError('unavailable'));
      const cleanup = registerCleanupSpy();
      const user = makeUser();
      const result = await signIn(user);

      expect(h.getDoc).toHaveBeenCalledWith({ path: ACCEPTANCE_PATH });
      expect(result.current.user).toBe(user);
      expect(localStorage.getItem(ACCEPTED_KEY)).toBeNull();
      expect(cleanup).not.toHaveBeenCalled();
    });

    it('still signs in, and ends loading, when browser storage throws during the terms check', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('The operation is insecure.');
      });
      const user = makeUser();
      const result = await signIn(user);

      expect(result.current.loading).toBe(false);
      expect(result.current.user).toBe(user);
    });
  });

  describe('writing the profile', () => {
    beforeEach(() => {
      localStorage.setItem(ACCEPTED_KEY, TOS_VERSION); // terms already accepted in this browser
    });

    it('writes the same profile to the app and suite profile collections by merge, keeping fields already stored', async () => {
      h.store.set(`ganttapp_profiles/${UID}`, { createdAt: 'first-sign-in', lastLogin: 'earlier' });
      h.store.set(`spertsuite_profiles/${UID}`, { createdAt: 'first-sign-in' });
      await signIn(makeUser());

      const payload = {
        displayName: 'Ada Lovelace',
        email: 'ada@example.com',
        photoURL: 'https://example.com/ada.png',
        updatedAt: h.SERVER_TIMESTAMP,
      };
      expectProfileOnBothPaths(payload);
      expect(h.store.get(`ganttapp_profiles/${UID}`)).toStrictEqual({ createdAt: 'first-sign-in', lastLogin: 'earlier', ...payload });
      expect(h.store.get(`spertsuite_profiles/${UID}`)).toStrictEqual({ createdAt: 'first-sign-in', ...payload });
    });

    it('lowercases the email in both profiles', async () => {
      await signIn(makeUser({ email: 'Ada.Lovelace@Example.COM' }));

      expectProfileOnBothPaths({
        displayName: 'Ada Lovelace',
        email: 'ada.lovelace@example.com',
        photoURL: 'https://example.com/ada.png',
        updatedAt: h.SERVER_TIMESTAMP,
      });
    });

    it('turns a Last, First display name into First Last in both profiles', async () => {
      await signIn(makeUser({ displayName: 'Lovelace, Ada' }));

      expectProfileOnBothPaths({
        displayName: 'Ada Lovelace',
        email: 'ada@example.com',
        photoURL: 'https://example.com/ada.png',
        updatedAt: h.SERVER_TIMESTAMP,
      });
    });

    it('writes an empty email and a null photo for an account that has neither', async () => {
      await signIn(makeUser({ email: null, photoURL: undefined }));

      expectProfileOnBothPaths({
        displayName: 'Ada Lovelace',
        email: '',
        photoURL: null,
        updatedAt: h.SERVER_TIMESTAMP,
      });
    });
  });

  describe('claiming invitations', () => {
    beforeEach(() => {
      localStorage.setItem(ACCEPTED_KEY, TOS_VERSION); // terms already accepted in this browser
    });

    it('announces claimed projects in a spert:models-changed event', async () => {
      const claimed = [{ appId: 'ganttapp', modelId: 'p-1', modelName: 'Apollo' }];
      h.state.claim = vi.fn().mockResolvedValue({ data: { claimed } });
      const onModelsChanged = listenForModelsChanged();
      await signIn(makeUser());

      await waitFor(() => expect(onModelsChanged).toHaveBeenCalledTimes(1));
      expect(onModelsChanged.mock.calls[0][0].detail).toStrictEqual({ claimed });
    });

    it('sends no event when nothing was claimed', async () => {
      h.state.claim = vi.fn().mockResolvedValue({ data: { claimed: [] } });
      const onModelsChanged = listenForModelsChanged();
      await signIn(makeUser());

      expect(h.state.claim).toHaveBeenCalledTimes(1);
      await flush();
      expect(onModelsChanged).not.toHaveBeenCalled();
    });

    it('logs a failed claim with its error code but never the user id', async () => {
      const uid = 'uid-7f3a9c2e';
      // The error's own message carries the uid, so logging the error itself would leak it too.
      const failure = Object.assign(new Error(`no pending invitations for ${uid}`), { code: 'functions/permission-denied' });
      h.state.claim = vi.fn().mockRejectedValue(failure);
      await signIn(makeUser({ uid }));

      await waitFor(() => expect(loggedErrors()).toContain('claimPendingInvitations failed'));
      expect(loggedErrors()).toContain('functions/permission-denied');
      expect(loggedErrors()).not.toContain(uid);
    });

    it('claims pending invitations for a verified email', async () => {
      h.state.claim = vi.fn().mockResolvedValue({ data: { claimed: [] } });
      await signIn(makeUser({ emailVerified: true }));

      expect(h.state.claim).toHaveBeenCalledTimes(1);
      expect(h.state.claim).toHaveBeenCalledWith({});
    });

    it('does not try to claim invitations for an unverified email', async () => {
      h.state.claim = vi.fn().mockResolvedValue({ data: { claimed: [] } });
      const user = makeUser({ emailVerified: false });
      const result = await signIn(user);

      expect(result.current.user).toBe(user);
      expect(writesTo(`ganttapp_profiles/${UID}`)).toHaveLength(1); // the sign-in steps ran
      expect(h.state.claim).not.toHaveBeenCalled();
    });
  });
});

describe('AuthProvider when Firebase is not configured', () => {
  it.each([
    ['Google', 'signInWithGoogle'],
    ['Microsoft', 'signInWithMicrosoft'],
  ] as const)('%s sign-in says Firebase is not configured and opens no popup', async (_provider, method) => {
    h.state.firebaseAvailable = false;
    const { result } = renderHook(() => useAuth(), { wrapper });

    const outcome = await result.current[method]().then(
      () => 'signed in',
      (error: Error) => error.message,
    );
    expect(outcome).toBe('Firebase is not configured. Cloud features are unavailable.');
    expect(h.signInWithPopup).not.toHaveBeenCalled();
  });
});
