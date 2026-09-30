// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// End to end: a cloud save that fails shows "Cloud sync error: …" in Settings,
// and the next save that succeeds clears it. Nothing of the app is mocked —
// the auth, storage and app-data providers, the cloud service, its save
// executor and the Settings tab are all real. Only firebase/* (an in-memory
// Firestore and a signed-in user) and lib/firebase are replaced: without
// Firebase config, lib/firebase has no app and cloud mode can never start.
//
// Each test reaches the cloud through a different door, because each door
// must hand the error callback on: restoring cloud mode on load, confirming
// the upload prompt, and choosing Cloud in Settings. Each checks both things
// that callback carries: the error, and the all-clear a later good save
// sends. A door that passed on only the errors would leave the message on
// screen after the cloud had recovered.
//
// ⚠️ KNOWN DEFECT these tests pass through: when the storage switches to the
// cloud service, the app-data save effect re-runs and queues the pre-switch
// in-memory state on the new service, which writes it about 200 ms later.
// With no cloud projects that write is the settings document only; in the
// upload test it rewrites the project the upload has just created, with the
// same members, so nothing here observes it. The fixed wait below lets that
// write finish before the failure is armed, so the failure lands on the
// user's own edit. It is a fixed wait, not a wait for that write, so the
// tests stay valid once the defect is fixed and the write no longer happens.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';

const fake = vi.hoisted(() => {
  type Data = Record<string, unknown>;
  type Constraint = { field: string; op: string; value: unknown };
  const state = {
    docs: new Map<string, Data>(),
    failCommits: null as unknown, // while set, every batch commit rejects with it
  };
  const field = (data: Data, path: string) =>
    path.split('.').reduce<unknown>((obj, key) => (obj as Data | undefined)?.[key], data);
  const snapshotOf = (path: string) => ({
    id: path.split('/').pop()!, ref: { path }, data: () => structuredClone(state.docs.get(path)),
  });
  const api = {
    collection: (_db: unknown, path: string) => ({ path }),
    doc: (_db: unknown, path: string) => ({ path }),
    query: (ref: { path: string }, ...constraints: Constraint[]) => ({ path: ref.path, constraints }),
    where: (fieldPath: string, op: string, value: unknown) => ({ field: fieldPath, op, value }),
    getDocs: async (q: { path: string; constraints?: Constraint[] }) => {
      const depth = q.path.split('/').length + 1;
      const docs = Array.from(state.docs.keys())
        .filter((p) => p.startsWith(`${q.path}/`) && p.split('/').length === depth)
        .filter((p) => (q.constraints ?? []).every((c) => (c.op === 'in'
          ? (c.value as unknown[]).includes(field(state.docs.get(p)!, c.field))
          : field(state.docs.get(p)!, c.field) === c.value)))
        .map(snapshotOf);
      return { docs };
    },
    getDoc: async (ref: { path: string }) => {
      const exists = state.docs.has(ref.path);
      return { exists: () => exists, data: () => (exists ? structuredClone(state.docs.get(ref.path)) : undefined) };
    },
    setDoc: async (ref: { path: string }, data: Data) => { state.docs.set(ref.path, structuredClone(data)); },
    deleteDoc: async (ref: { path: string }) => { state.docs.delete(ref.path); },
    writeBatch: () => {
      const ops: { path: string; data?: Data }[] = [];
      return {
        set: (ref: { path: string }, data: Data) => { ops.push({ path: ref.path, data }); },
        delete: (ref: { path: string }) => { ops.push({ path: ref.path }); },
        commit: async () => {
          if (state.failCommits) throw state.failCommits;
          for (const op of ops) {
            if (op.data) state.docs.set(op.path, structuredClone(op.data));
            else state.docs.delete(op.path);
          }
        },
      };
    },
    onSnapshot: () => () => {},
    serverTimestamp: () => 'server-timestamp',
    deleteField: () => ({ deleteField: true }),
    runTransaction: async () => {},
    Timestamp: class Timestamp { toMillis() { return 0; } },
  };
  return { state, api };
});

vi.mock('firebase/firestore', () => fake.api);

vi.mock('firebase/auth', () => {
  class GoogleAuthProvider { addScope() {} }
  class OAuthProvider { addScope() {} }
  const user = {
    uid: 'u1', email: 'ann@example.com', displayName: 'Ann Lee', photoURL: null,
    emailVerified: true, providerData: [{ providerId: 'google.com' }],
  };
  return {
    // Signed in: the callback fires once, just after mount, as Firebase's does.
    onAuthStateChanged: (_auth: unknown, callback: (u: typeof user) => void) => {
      const timer = setTimeout(() => callback(user), 0);
      return () => clearTimeout(timer);
    },
    signInWithPopup: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
    GoogleAuthProvider,
    OAuthProvider,
  };
});

vi.mock('../../../lib/firebase', () => ({
  // The cloud service compares this with its own user before every load and save.
  auth: { currentUser: { uid: 'u1' } },
  db: {},
  isFirebaseAvailable: true,
  getSendInvitationEmail: () => null,
  getClaimPendingInvitations: () => null,
  getRevokeInvite: () => null,
  getResendInvite: () => null,
}));

import { FullWrapper } from '../../../test/FullWrapper';
import { SettingsTab } from '../SettingsTab';
import { TOS_VERSION } from '../../../lib/version';

const FAILURE = Object.assign(new Error('raw transport detail'), { code: 'unavailable' });
const SHOWN = 'Cloud sync error: Service temporarily unavailable. Please try again later.';

/** Real time, so the debounced save and the swap-time save (see the header) both land. */
const settle = () => act(() => new Promise<void>((resolve) => { setTimeout(resolve, 350); }));

function commitField(label: string, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input); // the attribution fields commit on blur, not on change
}

async function expectCloudMode() {
  await screen.findByText(/Signed in as/);
  await waitFor(() => expect(screen.getByRole('radio', { name: /Cloud \(sync across devices\)/ })).toBeChecked());
  await settle();
}

describe('cloud sync error, end to end', () => {
  beforeEach(() => {
    localStorage.clear();
    fake.state.docs.clear();
    fake.state.failCommits = null;
    // Satisfy the terms-of-service gate from the local cache, so the user is
    // let through by the check itself rather than by its error fallback.
    localStorage.setItem('spert_tos_accepted_version', TOS_VERSION);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('restoring cloud mode on load: a failed save shows the error, and the next good save clears it', async () => {
    localStorage.setItem('ganttapp-storage-mode', 'cloud');
    render(<FullWrapper><SettingsTab /></FullWrapper>);
    await expectCloudMode();
    expect(screen.queryByText(/Cloud sync error/)).toBeNull();

    fake.state.failCommits = FAILURE;
    commitField('Name', 'Ann');
    expect(await screen.findByText(SHOWN)).toBeInTheDocument();

    fake.state.failCommits = null;
    commitField('Identifier', 'Team 1');
    await waitFor(() => expect(screen.queryByText(/Cloud sync error/)).toBeNull());
  });

  it('confirming the upload prompt: a failed save shows the error, and the next good save clears it', async () => {
    localStorage.setItem('ganttapp-storage-mode', 'cloud');
    localStorage.setItem('ganttAppData', JSON.stringify({ projects: [{ id: 'p1', name: 'Alpha' }], releases: [] }));
    render(<FullWrapper><SettingsTab /></FullWrapper>);
    fireEvent.click(await screen.findByRole('button', { name: 'Upload to Cloud' }));
    await expectCloudMode();
    expect(screen.queryByText(/Cloud sync error/)).toBeNull();

    fake.state.failCommits = FAILURE;
    commitField('Name', 'Ann');
    expect(await screen.findByText(SHOWN)).toBeInTheDocument();

    fake.state.failCommits = null;
    commitField('Identifier', 'Team 1');
    await waitFor(() => expect(screen.queryByText(/Cloud sync error/)).toBeNull());
  });

  it('choosing Cloud in Settings: a failed save shows the error, and the next good save clears it', async () => {
    render(<FullWrapper><SettingsTab /></FullWrapper>);
    await screen.findByText(/Signed in as/);
    const cloudRadio = screen.getByRole('radio', { name: /Cloud \(sync across devices\)/ });
    await waitFor(() => expect(cloudRadio).toBeEnabled());
    fireEvent.click(cloudRadio);
    await expectCloudMode();
    expect(screen.queryByText(/Cloud sync error/)).toBeNull();

    fake.state.failCommits = FAILURE;
    commitField('Name', 'Ann');
    expect(await screen.findByText(SHOWN)).toBeInTheDocument();

    fake.state.failCommits = null;
    commitField('Identifier', 'Team 1');
    await waitFor(() => expect(screen.queryByText(/Cloud sync error/)).toBeNull());
  });
});
