// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The cloud storage service's sync behaviour: what it saves, when, what it
// reports through onSaveResult, and what a listener error does to later saves.
//
// Only firebase/firestore and lib/firebase are mocked. The service, the save
// executor and the sharing helpers all run for real against a small in-memory
// Firestore, so these tests see the documents a save actually writes.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Firestore } from 'firebase/firestore';
import type { AppData } from '../../types/app';

const fake = vi.hoisted(() => {
  type Data = Record<string, unknown>;
  type Write = { via: 'batch' | 'setDoc' | 'deleteDoc'; op: 'set' | 'delete'; path: string; data?: Data };
  type Constraint = { field: string; op: string; value: unknown };
  const state = {
    docs: new Map<string, Data>(),
    writes: [] as Write[],
    commits: 0,
    reads: [] as string[],
    // One-shot: the next batch commit awaits this before it applies (and may reject).
    commitHook: null as null | (() => Promise<void>),
    // Runs inside every read, before it resolves.
    readHook: null as null | ((path: string) => void),
    listeners: [] as { path: string; error: (err: unknown) => void; unsub: ReturnType<typeof vi.fn> }[],
    auth: { currentUser: { uid: 'u1' } as { uid: string } | null },
    revoke: null as null | ReturnType<typeof vi.fn>,
    resend: null as null | ReturnType<typeof vi.fn>,
  };
  const field = (data: Data, path: string) =>
    path.split('.').reduce<unknown>((obj, key) => (obj as Data | undefined)?.[key], data);
  const matches = (data: Data, c: Constraint) =>
    c.op === 'in' ? (c.value as unknown[]).includes(field(data, c.field)) : field(data, c.field) === c.value;
  const snapshotOf = (path: string) => ({
    id: path.split('/').pop()!,
    ref: { path },
    data: () => structuredClone(state.docs.get(path)),
  });
  const read = (path: string) => {
    state.reads.push(path);
    state.readHook?.(path);
  };
  class Timestamp {
    constructor(private readonly ms: number) {}
    toMillis() { return this.ms; }
  }
  const api = {
    collection: (_db: unknown, path: string) => ({ path }),
    doc: (_db: unknown, path: string) => ({ path }),
    query: (ref: { path: string }, ...constraints: Constraint[]) => ({ path: ref.path, constraints }),
    where: (fieldPath: string, op: string, value: unknown) => ({ field: fieldPath, op, value }),
    getDocs: async (q: { path: string; constraints?: Constraint[] }) => {
      read(q.path);
      const depth = q.path.split('/').length + 1;
      const docs = Array.from(state.docs.keys())
        .filter((p) => p.startsWith(`${q.path}/`) && p.split('/').length === depth)
        .filter((p) => (q.constraints ?? []).every((c) => matches(state.docs.get(p)!, c)))
        .map(snapshotOf);
      return { docs };
    },
    getDoc: async (ref: { path: string }) => {
      read(ref.path);
      const exists = state.docs.has(ref.path);
      return { exists: () => exists, data: () => (exists ? structuredClone(state.docs.get(ref.path)) : undefined) };
    },
    setDoc: async (ref: { path: string }, data: Data) => {
      state.writes.push({ via: 'setDoc', op: 'set', path: ref.path, data });
      state.docs.set(ref.path, structuredClone(data));
    },
    deleteDoc: async (ref: { path: string }) => {
      state.writes.push({ via: 'deleteDoc', op: 'delete', path: ref.path });
      state.docs.delete(ref.path);
    },
    writeBatch: () => {
      const ops: Write[] = [];
      return {
        set: (ref: { path: string }, data: Data) => { ops.push({ via: 'batch', op: 'set', path: ref.path, data }); },
        delete: (ref: { path: string }) => { ops.push({ via: 'batch', op: 'delete', path: ref.path }); },
        commit: async () => {
          const hook = state.commitHook;
          state.commitHook = null;
          if (hook) await hook();
          state.commits++;
          for (const w of ops) {
            state.writes.push(w);
            if (w.op === 'set') state.docs.set(w.path, structuredClone(w.data!));
            else state.docs.delete(w.path);
          }
        },
      };
    },
    onSnapshot: (q: { path: string }, _next: unknown, error: (err: unknown) => void) => {
      const unsub = vi.fn();
      state.listeners.push({ path: q.path, error, unsub });
      return unsub;
    },
    deleteField: () => ({ deleteField: true }),
    runTransaction: vi.fn(),
    Timestamp,
  };
  return { state, api };
});

vi.mock('firebase/firestore', () => fake.api);

vi.mock('../../../lib/firebase', () => ({
  auth: fake.state.auth,
  db: {},
  isFirebaseAvailable: true,
  getRevokeInvite: () => fake.state.revoke,
  getResendInvite: () => fake.state.resend,
}));

import { FirestoreGanttStorageServiceImpl } from '../firestore-gantt-storage-service';

type Write = (typeof fake.state.writes)[number];

const seedProject = (id: string, name: string, extra: Record<string, unknown> = {}) =>
  fake.state.docs.set(`ganttapp_projects/${id}`, {
    name, owner: 'u1', members: { u1: 'owner' }, schemaVersion: 1,
    createdAt: 'created', updatedAt: 'updated', _changeLog: [], ...extra,
  });
const seedSnapshot = (projectId: string, id: string) =>
  fake.state.docs.set(`ganttapp_projects/${projectId}/snapshots/${id}`, {
    name: id, timestamp: '2026-01-01T00:00:00.000Z', releases: [],
  });
const snapshot = (id: string, projectId: string) =>
  ({ id, projectId, name: id, timestamp: '2026-02-01T00:00:00.000Z', releases: [] });

const projectWrites = (id: string) => fake.state.writes.filter((w) => w.path === `ganttapp_projects/${id}`);
/**
 * 'create' when the executor wrote the project as new, 'update' when it rewrote
 * an existing one, 'delete' when it deleted it (a delete carries no data).
 */
const action = (w: Write) => (w.op === 'delete'
  ? 'delete'
  : (w.data?._changeLog as { action: string }[] | undefined)?.at(-1)?.action);
const listenerOn = (projectId: string) =>
  fake.state.listeners.find((l) => l.path === `ganttapp_projects/${projectId}/releases`)!;
const renamed = (data: AppData, projectId: string, name: string): AppData =>
  ({ ...data, projects: data.projects.map((p) => (p.id === projectId ? { ...p, name } : p)) });
const deferred = () => {
  let reject!: (err: unknown) => void;
  const promise = new Promise<void>((_resolve, rej) => { reject = rej; });
  return { promise, reject };
};
const coded = (code: string, message = `raw ${code} details`) => Object.assign(new Error(message), { code });
const flushSave = () => vi.advanceTimersByTimeAsync(200);

describe('FirestoreGanttStorageServiceImpl — sync behaviour', () => {
  let service: FirestoreGanttStorageServiceImpl;
  let onSaveResult: ReturnType<typeof vi.fn<(error: string | null) => void>>;
  const revoked: string[] = [];
  const onRevoked = (e: Event) => revoked.push((e as CustomEvent<{ projectId: string }>).detail.projectId);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = fake.state;
    s.docs.clear();
    s.writes.length = 0;
    s.reads.length = 0;
    s.listeners.length = 0;
    s.commits = 0;
    s.commitHook = null;
    s.readHook = null;
    s.auth.currentUser = { uid: 'u1' };
    s.revoke = null;
    s.resend = null;
    revoked.length = 0;
    window.addEventListener('ganttapp:project-revoked', onRevoked);
    onSaveResult = vi.fn<(error: string | null) => void>();
    service = new FirestoreGanttStorageServiceImpl({} as Firestore, 'u1', onSaveResult);
  });

  afterEach(() => {
    service.dispose();
    window.removeEventListener('ganttapp:project-revoked', onRevoked);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('unload', () => {
    it('commits pending edits when the page unloads', async () => {
      seedProject('p1', 'Alpha');
      const loaded = (await service.loadAppData())!;
      await service.saveAppData(renamed(loaded, 'p1', 'Renamed'));
      expect(projectWrites('p1')).toEqual([]); // still waiting for the debounce

      window.dispatchEvent(new Event('beforeunload'));
      await vi.advanceTimersByTimeAsync(0);

      expect(projectWrites('p1').map((w) => w.data?.name)).toEqual(['Renamed']);
    });
  });

  describe('loadAppData', () => {
    it('stops reading, and returns null, when the user changes during the project listing', async () => {
      seedProject('p1', 'Alpha');
      fake.state.readHook = (path) => {
        if (path === 'ganttapp_projects') fake.state.auth.currentUser = { uid: 'u2' };
      };
      expect(await service.loadAppData()).toBeNull();
      const reads = fake.state.reads;
      expect(reads.slice(reads.indexOf('ganttapp_projects') + 1)).toEqual([]);
    });

    it("stops reading, and returns null, when the user changes while a project's releases load", async () => {
      seedProject('p1', 'Alpha');
      seedProject('p2', 'Beta');
      fake.state.readHook = (path) => {
        if (path === 'ganttapp_projects/p1/releases') fake.state.auth.currentUser = { uid: 'u2' };
      };
      expect(await service.loadAppData()).toBeNull();
      const reads = fake.state.reads;
      expect(reads.slice(reads.indexOf('ganttapp_projects/p1/releases') + 1)).toEqual([]);
    });

    it('returns null when the user changes while the settings load', async () => {
      seedProject('p1', 'Alpha');
      fake.state.readHook = (path) => {
        if (path === 'ganttapp_settings/u1') fake.state.auth.currentUser = { uid: 'u2' };
      };
      expect(await service.loadAppData()).toBeNull();
      expect(fake.state.reads).toContain('ganttapp_settings/u1');
    });

    it('returns projects in their stored order, a missing order counting as 0', async () => {
      seedProject('p-c', 'C', { order: 1 });
      seedProject('p-b', 'B');
      seedProject('p-a', 'A', { order: 2 });
      expect((await service.loadAppData())!.projects.map((p) => p.id)).toEqual(['p-b', 'p-c', 'p-a']);

      fake.state.docs.clear();
      seedProject('p-b', 'B');
      seedProject('p-c', 'C', { order: 1 });
      expect((await service.loadAppData())!.projects.map((p) => p.id)).toEqual(['p-b', 'p-c']);
    });
  });

  // Snapshot operations, on a load that succeeds (each test loads first:
  // snapshot writes are refused until one has). What they do when the
  // snapshot load itself fails is left to the change that decides it.
  describe('snapshots', () => {
    it('refuses a 51st snapshot for one project, and writes nothing', async () => {
      seedProject('p1', 'Alpha');
      seedProject('p2', 'Beta');
      for (let i = 0; i < 50; i++) seedSnapshot('p1', `s${i}`);
      await service.loadAppData();

      expect(await service.addSnapshot(snapshot('new-2', 'p2'))).toHaveLength(51); // p2 has room
      fake.state.writes.length = 0;
      expect(await service.addSnapshot(snapshot('new-1', 'p1'))).toBeNull();
      expect(fake.state.writes).toEqual([]);
    });

    it("writes a new snapshot under its project and returns the list with it", async () => {
      seedProject('p1', 'Alpha');
      seedSnapshot('p1', 's1');
      await service.loadAppData();

      const result = await service.addSnapshot(snapshot('s2', 'p1'));

      expect(fake.state.writes.map((w) => [w.via, w.path])).toEqual([['setDoc', 'ganttapp_projects/p1/snapshots/s2']]);
      expect(result!.map((s) => s.id)).toEqual(['s1', 's2']);
    });

    it("deletes a snapshot under its own project and returns the rest", async () => {
      seedProject('p1', 'Alpha');
      seedProject('p2', 'Beta');
      seedSnapshot('p1', 's1');
      seedSnapshot('p2', 's2');
      seedSnapshot('p2', 's3');
      await service.loadAppData();

      const rest = await service.deleteSnapshot('s2');

      expect(fake.state.writes.map((w) => [w.via, w.path])).toEqual([['deleteDoc', 'ganttapp_projects/p2/snapshots/s2']]);
      expect(rest.map((s) => s.id)).toEqual(['s1', 's3']);
    });

    it('deletes nothing for an unknown snapshot id', async () => {
      seedProject('p1', 'Alpha');
      seedSnapshot('p1', 's1');
      await service.loadAppData();

      await expect(service.deleteSnapshot('no-such-id')).resolves.toEqual([expect.objectContaining({ id: 's1' })]);
      expect(fake.state.writes).toEqual([]);
    });

    it("deletes only one project's snapshots, in one batch", async () => {
      seedProject('p1', 'Alpha');
      seedProject('p2', 'Beta');
      seedSnapshot('p1', 's1');
      seedSnapshot('p1', 's2');
      seedSnapshot('p2', 's3');
      await service.loadAppData();

      const rest = await service.deleteSnapshotsForProject('p1');

      expect(fake.state.commits).toBe(1);
      expect(fake.state.writes.map((w) => [w.op, w.path])).toEqual([
        ['delete', 'ganttapp_projects/p1/snapshots/s1'],
        ['delete', 'ganttapp_projects/p1/snapshots/s2'],
      ]);
      expect(rest.map((s) => s.id)).toEqual(['s3']);
    });
  });

  // A listener error that is NOT permission-denied (here, 'unavailable').
  //
  // ⚠️ KNOWN DEFECT, asserted first because it is the only visible effect: the
  // error is reported through onSaveResult, the SAME callback a save uses for
  // its own result. So the next successful save reports null and clears the
  // listener's error from the screen while the listener stays dead. A fix that
  // gives listener errors their own channel should change that assertion.
  // Re-subscribing after such an error is parked, not rejected: nothing does it
  // today, and nothing here makes that a requirement.
  //
  // "Nothing pruned" is asserted through what the next save writes. Pruning
  // would make the project look removed, then new: a `create` where an update
  // or nothing belongs.
  describe('listener error other than permission-denied', () => {
    const MAPPED = 'Service temporarily unavailable. Please try again later.';

    it('(a) unchanged data saved after the error: reported, listener kept until dispose, no event, no write', async () => {
      seedProject('p1', 'Alpha');
      const loaded = (await service.loadAppData())!;
      service.subscribeToProject('p1', vi.fn());
      const listener = listenerOn('p1');

      listener.error(coded('unavailable'));

      expect(onSaveResult).toHaveBeenCalledWith(MAPPED);
      expect(listener.unsub).not.toHaveBeenCalled();
      expect(revoked).toEqual([]);

      await service.saveAppData(structuredClone(loaded));
      await flushSave();
      expect(fake.state.commits).toBe(1);
      expect(projectWrites('p1')).toEqual([]);

      service.dispose();
      expect(listener.unsub).toHaveBeenCalledTimes(1);
    });

    it('(b) a change already pending when the error fires is still written as an update', async () => {
      seedProject('p1', 'Alpha');
      const loaded = (await service.loadAppData())!;
      service.subscribeToProject('p1', vi.fn());
      await service.saveAppData(renamed(loaded, 'p1', 'Renamed'));

      listenerOn('p1').error(coded('unavailable'));
      await flushSave();

      expect(projectWrites('p1').map(action)).toEqual(['update']);
    });

    it('(c) a change saved after the error is written as an update', async () => {
      seedProject('p1', 'Alpha');
      const loaded = (await service.loadAppData())!;
      service.subscribeToProject('p1', vi.fn());

      listenerOn('p1').error(coded('unavailable'));
      await service.saveAppData(renamed(loaded, 'p1', 'Renamed'));
      await flushSave();

      expect(projectWrites('p1').map(action)).toEqual(['update']);
    });
  });

  describe('listener error permission-denied', () => {
    it('unsubscribes the listener at once', async () => {
      seedProject('p1', 'Alpha');
      await service.loadAppData();
      service.subscribeToProject('p1', vi.fn());
      const listener = listenerOn('p1');

      listener.error(coded('permission-denied'));

      expect(revoked).toEqual(['p1']);
      expect(listener.unsub).toHaveBeenCalledTimes(1);
    });

    it('does not unsubscribe it a second time at dispose', async () => {
      seedProject('p1', 'Alpha');
      await service.loadAppData();
      service.subscribeToProject('p1', vi.fn());
      const listener = listenerOn('p1');
      listener.error(coded('permission-denied'));
      expect(listener.unsub).toHaveBeenCalledTimes(1);

      service.dispose();

      expect(listener.unsub).toHaveBeenCalledTimes(1);
    });

    it("drops the revoked project from a save that is already pending", async () => {
      seedProject('p1', 'Alpha');
      seedProject('p2', 'Beta');
      const loaded = (await service.loadAppData())!;
      service.subscribeToProject('p1', vi.fn());
      await service.saveAppData(renamed(renamed(loaded, 'p1', 'Alpha 2'), 'p2', 'Beta 2'));

      listenerOn('p1').error(coded('permission-denied'));
      await flushSave();

      expect(projectWrites('p2').map(action)).toEqual(['update']);
      expect(projectWrites('p1')).toEqual([]);
    });

    it('opens no listener before any load, and writes nothing', async () => {
      // A listener opens only on a project the baseline holds, and before a
      // load there is none, so no listener can be refused before a load. (A
      // refused open listener is covered by the two tests above.) A save
      // before any load is refused.
      service.subscribeToProject('p1', vi.fn());
      await service.saveAppData({ projects: [{ id: 'p1', name: 'Alpha' }, { id: 'p2', name: 'Beta' }], releases: [] });
      await flushSave();

      expect(fake.state.listeners).toEqual([]);
      expect(fake.state.writes).toEqual([]);
      expect(revoked).toEqual([]);
    });
  });

  describe('sharing and invitations', () => {
    it("lists this project's members with their emails", async () => {
      seedProject('p1', 'Alpha', { members: { u1: 'owner', u2: 'editor' } });
      seedProject('p2', 'Beta', { members: { u1: 'owner', u3: 'viewer' } });
      fake.state.docs.set('ganttapp_profiles/u1', { email: 'one@example.com' });
      fake.state.docs.set('spertsuite_profiles/u2', { email: 'two@example.com' });

      expect(await service.getProjectMembers('p1')).toEqual([
        { uid: 'u1', role: 'owner', email: 'one@example.com' },
        { uid: 'u2', role: 'editor', email: 'two@example.com' },
      ]);
    });

    it('lists only the invitations this user sent for this project', async () => {
      const invite = (inviterUid: string, modelId: string) =>
        ({ inviterUid, modelId, status: 'pending', inviteeEmail: `${inviterUid}-${modelId}@example.com` });
      fake.state.docs.set('spertsuite_invitations/t1', invite('u1', 'p1'));
      fake.state.docs.set('spertsuite_invitations/t2', invite('u2', 'p1'));
      fake.state.docs.set('spertsuite_invitations/t3', invite('u1', 'p2'));

      expect((await service.listPendingInvites('p1')).map((i) => i.tokenId)).toEqual(['t1']);
    });

    it.each([
      ['revokeInvite', 'revoke'],
      ['resendInvite', 'resend'],
    ] as const)('%s says invitations are not configured when there is no callable', async (method, _callable) => {
      await expect(service[method]('t1')).rejects.toThrow('Cloud invitations not configured.');
    });

    it.each([
      ['revokeInvite', 'revoke'],
      ['resendInvite', 'resend'],
    ] as const)('%s calls its callable with the token', async (method, callable) => {
      fake.state[callable] = vi.fn().mockResolvedValue({ data: {} });
      await service[method]('t1');
      expect(fake.state[callable]).toHaveBeenCalledWith({ tokenId: 't1' });
    });
  });

  describe('save results', () => {
    it('does nothing when the debounce fires after an unload already saved', async () => {
      seedProject('p1', 'Alpha');
      const loaded = (await service.loadAppData())!;
      await service.saveAppData(renamed(loaded, 'p1', 'Renamed'));
      window.dispatchEvent(new Event('pagehide'));
      await vi.advanceTimersByTimeAsync(0);
      expect(fake.state.commits).toBe(1);

      await flushSave(); // the debounce timer the unload save left behind

      expect(fake.state.commits).toBe(1);
      expect(onSaveResult.mock.calls).toEqual([[null]]);
    });

    it('reports a failed save with the mapped message, not the raw one', async () => {
      seedProject('p1', 'Alpha');
      const loaded = (await service.loadAppData())!;
      fake.state.commitHook = () => Promise.reject(coded('permission-denied', 'Missing or insufficient permissions.'));

      await service.saveAppData(renamed(loaded, 'p1', 'Renamed'));
      await flushSave();

      expect(onSaveResult.mock.calls).toEqual([['Permission denied. Please check your account access.']]);
    });

    it('keeps a failed save and sends it at the next unload', async () => {
      seedProject('p1', 'Alpha');
      const loaded = (await service.loadAppData())!;
      fake.state.commitHook = () => Promise.reject(coded('unavailable'));
      await service.saveAppData(renamed(loaded, 'p1', 'Renamed'));
      await flushSave();
      expect(projectWrites('p1')).toEqual([]);

      window.dispatchEvent(new Event('pagehide'));
      await vi.advanceTimersByTimeAsync(0);

      expect(projectWrites('p1').map((w) => w.data?.name)).toEqual(['Renamed']);
      expect(onSaveResult.mock.calls).toEqual([['Service temporarily unavailable. Please try again later.'], [null]]);
    });

    it('lets a newer edit win over a failed save it arrived during', async () => {
      seedProject('p1', 'Alpha');
      const loaded = (await service.loadAppData())!;
      const inFlight = deferred();
      fake.state.commitHook = () => inFlight.promise;
      await service.saveAppData(renamed(loaded, 'p1', 'Older'));
      await flushSave(); // the save of 'Older' is now waiting on its commit

      await service.saveAppData(renamed(loaded, 'p1', 'Newer'));
      inFlight.reject(coded('unavailable'));
      await flushSave();

      expect(projectWrites('p1').map((w) => w.data?.name)).toEqual(['Newer']);
    });

    it('does not keep a failed save once the signed-in user has changed', async () => {
      seedProject('p1', 'Alpha');
      const loaded = (await service.loadAppData())!;
      const inFlight = deferred();
      fake.state.commitHook = () => inFlight.promise;
      await service.saveAppData(renamed(loaded, 'p1', 'Renamed'));
      await flushSave();

      fake.state.auth.currentUser = { uid: 'u2' };
      inFlight.reject(coded('unavailable'));
      await vi.advanceTimersByTimeAsync(0);
      // Switch back only so that a wrongly kept save would get as far as the
      // store, where this test can see it; its own user check stops it otherwise.
      fake.state.auth.currentUser = { uid: 'u1' };
      window.dispatchEvent(new Event('pagehide'));
      await vi.advanceTimersByTimeAsync(0);

      expect(projectWrites('p1')).toEqual([]);
    });

    it('compares the next save with what it last wrote, so saving the same data again writes nothing', async () => {
      seedProject('p1', 'Alpha');
      const loaded = (await service.loadAppData())!;
      await service.saveAppData(renamed(loaded, 'p1', 'Renamed'));
      await flushSave();
      expect(projectWrites('p1')).toHaveLength(1);

      await service.saveAppData(renamed(loaded, 'p1', 'Renamed'));
      await flushSave();

      expect(fake.state.commits).toBe(2);
      expect(projectWrites('p1')).toHaveLength(1);
    });

    it('reports null after a successful save', async () => {
      seedProject('p1', 'Alpha');
      const loaded = (await service.loadAppData())!;
      await service.saveAppData(renamed(loaded, 'p1', 'Renamed'));
      await flushSave();

      expect(projectWrites('p1')).toHaveLength(1);
      expect(onSaveResult.mock.calls).toEqual([[null]]);
    });
  });
});

// Nothing is saved to the cloud before a load from it has succeeded. A save
// against no baseline writes every project as new (a full set() with only
// this user as a member) and every setting over the stored ones.
describe('FirestoreGanttStorageServiceImpl — no save before a load', () => {
  const LOAD_FAILED = 'Your cloud data did not load, so changes are not being saved. Reload the page to try again.';
  const NOT_LOADED = 'Your cloud data did not load, so changes cannot be saved. Reload the page to try again.';
  // The methods these tests call are reached through optional access, so that
  // against a service without them a test fails at its assertion rather than
  // with a TypeError.
  type LoadApi = {
    setAsideLoad?: (loaded: AppData) => void;
    canWrite?: () => boolean;
    readAppData?: () => Promise<AppData | null>;
  };
  const loadApi = (s: FirestoreGanttStorageServiceImpl) => s as unknown as LoadApi;
  const settingsWrites = () => fake.state.writes.filter((w) => w.path === 'ganttapp_settings/u1');
  const failNextSettingsRead = () => {
    fake.state.readHook = (path) => {
      if (path !== 'ganttapp_settings/u1') return;
      fake.state.readHook = null;
      throw coded('permission-denied');
    };
  };

  let service: FirestoreGanttStorageServiceImpl;
  let onSaveResult: ReturnType<typeof vi.fn<(error: string | null) => void>>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = fake.state;
    s.docs.clear();
    s.writes.length = 0;
    s.reads.length = 0;
    s.listeners.length = 0;
    s.commits = 0;
    s.commitHook = null;
    s.readHook = null;
    s.auth.currentUser = { uid: 'u1' };
    s.docs.set('ganttapp_settings/u1', { preparedBy: 'Cloud Person', showTodayLine: false });
    onSaveResult = vi.fn<(error: string | null) => void>();
    service = new FirestoreGanttStorageServiceImpl({} as Firestore, 'u1', onSaveResult);
  });

  afterEach(() => {
    service.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('writes nothing for a save before the first load, and saves again once a load succeeds', async () => {
    seedProject('p1', 'Alpha');
    await service.saveAppData({ projects: [{ id: 'p1', name: 'Stale' }], releases: [] });
    await flushSave();
    expect(fake.state.writes).toEqual([]);

    const loaded = (await service.loadAppData())!;
    await service.saveAppData(renamed(loaded, 'p1', 'Renamed'));
    await flushSave();
    expect(projectWrites('p1').map(action)).toEqual(['update']);
  });

  it('writes nothing for an immediate save before the first load', async () => {
    seedProject('p1', 'Alpha');
    await service.saveAppDataImmediate({ projects: [{ id: 'p1', name: 'Stale' }], releases: [] });
    expect(fake.state.writes).toEqual([]);
  });

  it('deletes nothing and writes no settings for a save queued before a load that then succeeds', async () => {
    seedProject('p1', 'Alpha');
    await service.saveAppData({ projects: [], releases: [] });
    await service.loadAppData(); // finishes before the debounce
    await flushSave();
    expect(fake.state.writes).toEqual([]);
  });

  it('reports a failed first load in words that say changes are not being saved', async () => {
    failNextSettingsRead();
    expect(await service.loadAppData()).toBeNull();
    expect(onSaveResult.mock.calls).toEqual([[LOAD_FAILED]]);
  });

  // Control: true before this release and after it.
  it('reports nothing for a failed reload after a good load, and keeps saving against that load', async () => {
    seedProject('p1', 'Alpha');
    const loaded = (await service.loadAppData())!;
    failNextSettingsRead();
    expect(await service.loadAppData()).toBeNull();

    await service.saveAppData(renamed(loaded, 'p1', 'Renamed'));
    await flushSave();
    expect(projectWrites('p1').map(action)).toEqual(['update']);
    expect(onSaveResult.mock.calls).toEqual([[null]]);
  });

  // Guards the report above: cannot be red on code that never reports.
  it('does not report a first load that fails after the service was disposed', async () => {
    failNextSettingsRead();
    const load = service.loadAppData();
    service.dispose();
    await load;
    expect(onSaveResult).not.toHaveBeenCalled();
  });

  it('refuses saves after a first load is set aside, and reports it as a failed load', async () => {
    const loaded = (await service.loadAppData())!; // an empty cloud
    loadApi(service).setAsideLoad?.(loaded);

    await service.saveAppData({ projects: [{ id: 'L1', name: 'Local' }], releases: [] });
    await flushSave();
    expect(projectWrites('L1')).toEqual([]);
    expect(onSaveResult.mock.calls).toEqual([[LOAD_FAILED]]);
  });

  it('keeps the earlier baseline when a reload is set aside', async () => {
    seedProject('p1', 'Alpha');
    const first = (await service.loadAppData())!;
    fake.state.docs.delete('ganttapp_projects/p1'); // deleted on another device
    const reload = (await service.loadAppData())!;
    loadApi(service).setAsideLoad?.(reload);

    await service.saveAppData(structuredClone(first));
    await flushSave();
    expect(projectWrites('p1')).toEqual([]); // not re-created
  });

  // Guards against a set-aside that reverts too far: cannot be red on code without one.
  it('changes nothing when the load set aside was already superseded by a newer one', async () => {
    seedProject('p1', 'Alpha');
    const older = (await service.loadAppData())!;
    seedProject('p2', 'Beta');
    const newer = (await service.loadAppData())!;
    loadApi(service).setAsideLoad?.(older);

    await service.saveAppData(renamed(newer, 'p2', 'Beta 2'));
    await flushSave();
    expect(projectWrites('p2').map(action)).toEqual(['update']);
  });

  it('clears its own failed-load report when a later load succeeds', async () => {
    failNextSettingsRead();
    await service.loadAppData();
    await service.loadAppData();
    expect(onSaveResult.mock.calls).toEqual([[LOAD_FAILED], [null]]);
  });

  // Guards the clear above: cannot be red on code that never clears on a load.
  it('does not clear a failed save’s report when a later load succeeds', async () => {
    seedProject('p1', 'Alpha');
    const loaded = (await service.loadAppData())!;
    fake.state.commitHook = () => Promise.reject(coded('unavailable'));
    await service.saveAppData(renamed(loaded, 'p1', 'Renamed'));
    await flushSave();
    await service.loadAppData();
    expect(onSaveResult.mock.calls).toEqual([['Service temporarily unavailable. Please try again later.']]);
  });

  it.each([
    ['saveSnapshots', (s: FirestoreGanttStorageServiceImpl) => s.saveSnapshots([snapshot('s9', 'p1')])],
    ['addSnapshot', (s: FirestoreGanttStorageServiceImpl) => s.addSnapshot(snapshot('s9', 'p1'))],
    ['deleteSnapshot', (s: FirestoreGanttStorageServiceImpl) => s.deleteSnapshot('s1')],
    ['deleteSnapshotsForProject', (s: FirestoreGanttStorageServiceImpl) => s.deleteSnapshotsForProject('p1')],
  ] as const)('refuses %s before a load: it rejects with the not-loaded message and writes nothing', async (_name, write) => {
    seedProject('p1', 'Alpha');
    seedSnapshot('p1', 's1');
    const error = await write(service).then(() => null, (e: unknown) => e as Error & { code?: string });
    expect(error?.message).toBe(NOT_LOADED);
    expect(error?.code).toBeUndefined(); // so sanitizeFirebaseError passes the message through
    expect(fake.state.writes).toEqual([]);
  });

  it('says whether a write may go to the cloud: not before a load, yes after, not after dispose', async () => {
    expect(loadApi(service).canWrite?.()).toBe(false);
    await service.loadAppData();
    expect(loadApi(service).canWrite?.()).toBe(true);
    service.dispose();
    expect(loadApi(service).canWrite?.()).toBe(false);
  });

  it('says a write may not go to the cloud after its first load is set aside', async () => {
    const loaded = (await service.loadAppData())!;
    loadApi(service).setAsideLoad?.(loaded);
    expect(loadApi(service).canWrite?.()).toBe(false);
    expect(settingsWrites()).toEqual([]);
  });

  // The app never queues a save and then sets aside the load it was queued
  // against, so this guards the save routine itself.
  it('drops a save left with nothing to compare against, so a later unload writes nothing stale', async () => {
    seedProject('p1', 'Alpha');
    const loaded = (await service.loadAppData())!;
    await service.saveAppData(renamed(loaded, 'p1', 'Stale'));
    loadApi(service).setAsideLoad?.(loaded);
    await flushSave(); // the save timer runs while there is nothing to compare against
    await service.loadAppData(); // a later load succeeds

    window.dispatchEvent(new Event('beforeunload'));
    await vi.advanceTimersByTimeAsync(0);

    expect(fake.state.writes).toEqual([]);
  });

  // A read for a download returns what a load would, and changes none of what
  // a load changes: the data saves are compared with, the load that may be set
  // aside, and the failed-load report. Between them the tests below watch all
  // three.
  it('reads the cloud after a failed first load, and leaves saving refused and the failure reported', async () => {
    seedProject('p1', 'Alpha');
    failNextSettingsRead();
    await service.loadAppData();

    const read = await loadApi(service).readAppData?.();

    expect(read?.projects.map((p) => p.id)).toEqual(['p1']);
    expect(read?.preparedBy).toBe('Cloud Person');
    expect(loadApi(service).canWrite?.()).toBe(false);
    expect(onSaveResult.mock.calls).toEqual([[LOAD_FAILED]]);
    await service.saveAppData({ projects: [{ id: 'p1', name: 'Stale' }], releases: [] });
    await flushSave();
    expect(fake.state.writes).toEqual([]);
  });

  it('reads the cloud without changing what the next save is compared with', async () => {
    seedProject('p1', 'Alpha');
    const loaded = (await service.loadAppData())!;
    seedProject('p3', 'Gamma'); // added on another device after the load

    const read = await loadApi(service).readAppData?.();
    await service.saveAppData(renamed(loaded, 'p1', 'Renamed'));
    await flushSave();

    expect(read?.projects.map((p) => p.id)).toEqual(['p1', 'p3']);
    expect(projectWrites('p1').map(action)).toEqual(['update']);
    expect(projectWrites('p3')).toEqual([]); // not deleted
  });

  // The app sets a load aside in the continuation that received it, so no read
  // comes between them; this guards the service's own bookkeeping.
  it('reads the cloud without stopping the load before it from being set aside', async () => {
    const loaded = (await service.loadAppData())!; // a first load, of an empty cloud
    seedProject('p3', 'Gamma');

    const read = await loadApi(service).readAppData?.();
    loadApi(service).setAsideLoad?.(loaded);

    expect(read?.projects.map((p) => p.id)).toEqual(['p3']);
    expect(loadApi(service).canWrite?.()).toBe(false);
    expect(onSaveResult.mock.calls).toEqual([[LOAD_FAILED]]);
  });
});

// A project created here, a revoke during a save, and a snapshot written under
// a new project: the guards that keep each from undoing the others.
//   B: no listener opens on a project the baseline does not hold; it starts
//      once the save that writes the project is acknowledged.
//   S: a snapshot write under a project waits for that project's first save.
//   D: an acknowledgement, or a failed save's re-queue, does not bring back a
//      project pruned while the save was in flight.
describe('FirestoreGanttStorageServiceImpl — new projects, revokes and snapshot writes', () => {
  let service: FirestoreGanttStorageServiceImpl;
  let onSaveResult: ReturnType<typeof vi.fn<(error: string | null) => void>>;
  const revoked: string[] = [];
  const onRevoked = (e: Event) => revoked.push((e as CustomEvent<{ projectId: string }>).detail.projectId);
  const withProject = (data: AppData, id: string, name = id): AppData =>
    ({ ...data, projects: [...data.projects, { id, name, owner: 'u1' }] });
  const listensOn = (projectId: string) =>
    fake.state.listeners.filter((l) => l.path === `ganttapp_projects/${projectId}/releases`);
  const writePaths = () => fake.state.writes.map((w) => `${w.op} ${w.path}`);
  /** A commit hook that waits until `release()` is called; `fail` makes it reject. */
  const hold = () => {
    let release!: () => void;
    let fail!: (err: unknown) => void;
    const promise = new Promise<void>((resolve, reject) => { release = resolve; fail = reject; });
    return { hook: () => promise, release, fail };
  };
  const settled = (p: Promise<unknown>) => {
    const state = { done: false, error: null as unknown };
    p.then(() => { state.done = true; }, (err: unknown) => { state.done = true; state.error = err; });
    return state;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = fake.state;
    s.docs.clear();
    s.writes.length = 0;
    s.reads.length = 0;
    s.listeners.length = 0;
    s.commits = 0;
    s.commitHook = null;
    s.readHook = null;
    s.auth.currentUser = { uid: 'u1' };
    revoked.length = 0;
    window.addEventListener('ganttapp:project-revoked', onRevoked);
    onSaveResult = vi.fn<(error: string | null) => void>();
    service = new FirestoreGanttStorageServiceImpl({} as Firestore, 'u1', onSaveResult);
  });

  afterEach(() => {
    service.dispose();
    window.removeEventListener('ganttapp:project-revoked', onRevoked);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('B: no listener before the project is confirmed', () => {
    it('opens a listener at once on a project the baseline holds', async () => {
      // A control.
      seedProject('p1', 'Alpha');
      await service.loadAppData();
      service.subscribeToProject('p1', vi.fn());
      expect(listensOn('p1')).toHaveLength(1);
    });

    it('opens none on a project the baseline does not hold', async () => {
      // Fails under: B.
      seedProject('p1', 'Alpha');
      await service.loadAppData();
      service.subscribeToProject('p9', vi.fn());
      expect(listensOn('p9')).toHaveLength(0);
    });

    it('opens it once the whole save that writes the project is acknowledged, not at phase 1', async () => {
      // Fails under: B; by reading, also under a B that confirms at phase 1.
      seedProject('p1', 'Alpha');
      const loaded = (await service.loadAppData())!;
      service.subscribeToProject('p9', vi.fn());
      let atPhase2 = -1;
      fake.state.commitHook = async () => {
        // Phase 1 is committing; arm a hook for phase 2, which runs after phase 1 has applied.
        fake.state.commitHook = async () => { atPhase2 = listensOn('p9').length; };
      };
      await service.saveAppData(withProject(loaded, 'p9'));
      await flushSave();

      expect(atPhase2).toBe(0);
      expect(listensOn('p9')).toHaveLength(1);
    });

    it('its unsubscribe before the start drops it, so nothing opens later', async () => {
      // Fails under: B.
      seedProject('p1', 'Alpha');
      const loaded = (await service.loadAppData())!;
      const unsubscribe = service.subscribeToProject('p9', vi.fn());
      unsubscribe();
      await service.saveAppData(withProject(loaded, 'p9'));
      await flushSave();
      expect(listensOn('p9')).toHaveLength(0);
    });

    it('its unsubscribe after the start stops the listener it started', async () => {
      // Passes at base (the listener opened at once there). Fails under wrong-U:
      // an unsubscribe that only cancels the deferral.
      seedProject('p1', 'Alpha');
      const loaded = (await service.loadAppData())!;
      const unsubscribe = service.subscribeToProject('p9', vi.fn());
      await service.saveAppData(withProject(loaded, 'p9'));
      await flushSave();
      expect(listensOn('p9')).toHaveLength(1);

      unsubscribe();
      expect(listensOn('p9')[0].unsub).toHaveBeenCalledTimes(1);
    });

    it('dispose() drops it: nothing opens when the save it was waiting for completes', async () => {
      // Fails under: B; by reading, also under a B whose dispose() keeps its deferrals.
      seedProject('p1', 'Alpha');
      const loaded = (await service.loadAppData())!;
      service.subscribeToProject('p9', vi.fn());
      await service.saveAppData(withProject(loaded, 'p9'));
      const commit = hold();
      fake.state.commitHook = commit.hook;
      await vi.advanceTimersByTimeAsync(200); // the save is in flight, at phase 1
      service.dispose();
      commit.release();
      await vi.advanceTimersByTimeAsync(0);
      expect(listensOn('p9')).toHaveLength(0);
    });

    it('starts nothing when the signed-in user changed before the acknowledgement', async () => {
      // Fails under: B.
      seedProject('p1', 'Alpha');
      const loaded = (await service.loadAppData())!;
      service.subscribeToProject('p9', vi.fn());
      await service.saveAppData(withProject(loaded, 'p9'));
      fake.state.commitHook = async () => { fake.state.auth.currentUser = { uid: 'u2' }; };
      await flushSave();
      expect(listensOn('p9')).toHaveLength(0);
    });

    it('starts nothing after a failed save, and starts after the next save that succeeds', async () => {
      // Fails under: B; by reading, also under a B that starts on any settlement.
      seedProject('p1', 'Alpha');
      const loaded = (await service.loadAppData())!;
      service.subscribeToProject('p9', vi.fn());
      await service.saveAppData(withProject(loaded, 'p9'));
      fake.state.commitHook = async () => { throw coded('unavailable'); };
      await flushSave();
      expect(listensOn('p9')).toHaveLength(0);

      await service.saveAppData(renamed(withProject(loaded, 'p9'), 'p1', 'Alpha 2'));
      await flushSave();
      expect(listensOn('p9')).toHaveLength(1);
    });

    it('starts nothing for a save dropped because its load was set aside', async () => {
      // Fails under: B.
      seedProject('p1', 'Alpha');
      const loaded = (await service.loadAppData())!;
      service.subscribeToProject('p9', vi.fn());
      await service.saveAppData(withProject(loaded, 'p9'));
      service.setAsideLoad(loaded); // the first load: nothing to put back, so saves are refused
      await flushSave();
      expect(listensOn('p9')).toHaveLength(0);
      expect(fake.state.writes).toEqual([]);
    });
  });

  describe('S: a snapshot write waits for its project\'s first save', () => {
    it('saveSnapshots runs the pending first save, then writes the snapshot', async () => {
      // Fails under: S (the snapshot is written before its project).
      seedProject('p1', 'Alpha');
      const loaded = (await service.loadAppData())!;
      await service.saveAppData(withProject(loaded, 'p9'));
      const done = settled(service.saveSnapshots([snapshot('s9', 'p9')]));
      await vi.advanceTimersByTimeAsync(0);

      expect(done).toEqual({ done: true, error: null });
      const paths = writePaths();
      expect(paths.indexOf('set ganttapp_projects/p9')).toBeGreaterThanOrEqual(0);
      expect(paths.indexOf('set ganttapp_projects/p9')).toBeLessThan(paths.indexOf('set ganttapp_projects/p9/snapshots/s9'));
    });

    it('addSnapshot waits the same way', async () => {
      // Fails under: S.
      seedProject('p1', 'Alpha');
      const loaded = (await service.loadAppData())!;
      await service.saveAppData(withProject(loaded, 'p9'));
      const done = settled(service.addSnapshot(snapshot('s9', 'p9')));
      await vi.advanceTimersByTimeAsync(0);

      expect(done).toEqual({ done: true, error: null });
      const paths = writePaths();
      expect(paths.indexOf('set ganttapp_projects/p9')).toBeGreaterThanOrEqual(0);
      expect(paths.indexOf('set ganttapp_projects/p9')).toBeLessThan(paths.indexOf('set ganttapp_projects/p9/snapshots/s9'));
    });

    it('does not wait for a project outside the baseline that no save holds (added elsewhere since the load)', async () => {
      // A control: passes before and after. By reading, it fails under a key of "not in the baseline" alone.
      seedProject('p1', 'Alpha');
      await service.loadAppData();
      seedProject('p8', 'Shared since the load');
      const done = settled(service.saveSnapshots([snapshot('s8', 'p8')]));
      await vi.advanceTimersByTimeAsync(0);

      expect(done).toEqual({ done: true, error: null });
      expect(writePaths()).toContain('set ganttapp_projects/p8/snapshots/s8');
    });

    it('runs no flush while any save is in flight, and writes only after both have settled', async () => {
      // Fails under: S; and under S without its wait for saves in flight.
      seedProject('p1', 'Alpha');
      seedProject('p2', 'Beta');
      const loaded = (await service.loadAppData())!;
      await service.saveAppData(renamed(loaded, 'p2', 'Beta 2'));
      const first = hold();
      fake.state.commitHook = first.hook;
      await vi.advanceTimersByTimeAsync(200); // save A in flight
      await service.saveAppData(withProject(renamed(loaded, 'p2', 'Beta 2'), 'p9'));
      const done = settled(service.saveSnapshots([snapshot('s9', 'p9')]));
      await vi.advanceTimersByTimeAsync(0);

      expect(writePaths().filter((p) => p.includes('p9'))).toEqual([]); // neither the flush nor the snapshot yet
      expect(done.done).toBe(false);

      first.release();
      await vi.advanceTimersByTimeAsync(0);
      const paths = writePaths();
      expect(done).toEqual({ done: true, error: null });
      expect(paths.filter((p) => p === 'set ganttapp_projects/p9')).toHaveLength(1);
      expect(paths.indexOf('set ganttapp_projects/p9')).toBeLessThan(paths.indexOf('set ganttapp_projects/p9/snapshots/s9'));
    });

    it('waits for a debounced save that starts while it waits', async () => {
      // Fails under: S.
      seedProject('p1', 'Alpha');
      const loaded = (await service.loadAppData())!;
      await service.saveAppData(withProject(loaded, 'p9'));
      const flushed = hold();
      fake.state.commitHook = flushed.hook; // the flush's phase 1 is held
      const done = settled(service.saveSnapshots([snapshot('s9', 'p9')]));
      await vi.advanceTimersByTimeAsync(0);
      await service.saveAppData(renamed(withProject(loaded, 'p9'), 'p1', 'Alpha 2'));
      const later = hold();
      await vi.advanceTimersByTimeAsync(0);
      flushed.release();
      fake.state.commitHook = later.hook; // hold the next commit: the first save's phase 2, or the later save
      await vi.advanceTimersByTimeAsync(200);
      expect(done.done).toBe(false);

      later.release();
      await vi.advanceTimersByTimeAsync(400);
      expect(done).toEqual({ done: true, error: null });
      expect(writePaths().at(-1)).toBe('set ganttapp_projects/p9/snapshots/s9');
    });

    it('flushes at most once, then throws an error callers can tell apart, and writes no snapshot', async () => {
      // Fails under: S.
      seedProject('p1', 'Alpha');
      const loaded = (await service.loadAppData())!;
      await service.saveAppData(withProject(loaded, 'p9'));
      let attempts = 0;
      fake.state.commitHook = async () => { attempts += 1; throw coded('unavailable'); };
      const done = settled(service.saveSnapshots([snapshot('s9', 'p9')]));
      await vi.advanceTimersByTimeAsync(0);

      expect(done.done).toBe(true);
      expect((done.error as Error | null)?.name).toBe('ProjectNotSavedError');
      expect(attempts).toBe(1);
      expect(writePaths()).toEqual([]);
    });

    it('throws only once no save is in flight', async () => {
      // Fails under: S; by reading, also under S without its second wait.
      seedProject('p1', 'Alpha');
      seedProject('p2', 'Beta');
      const loaded = (await service.loadAppData())!;
      await service.saveAppData(renamed(loaded, 'p2', 'Beta 2'));
      const other = hold();
      fake.state.commitHook = other.hook;
      await vi.advanceTimersByTimeAsync(200); // an unrelated save in flight
      await service.saveAppData(withProject(renamed(loaded, 'p2', 'Beta 2'), 'p9'));
      const done = settled(service.saveSnapshots([snapshot('s9', 'p9')]));
      other.release();
      fake.state.commitHook = async () => { throw coded('unavailable'); }; // the flush fails
      await vi.advanceTimersByTimeAsync(0);

      expect((done.error as Error | null)?.name).toBe('ProjectNotSavedError');
      expect(writePaths().filter((p) => p.includes('/snapshots/'))).toEqual([]);
    });

    it('does not wait to delete', async () => {
      // A control: a project the cloud never had has no snapshots there. (It
      // fails under wrong-E, whose immediate save writes the project.)
      seedProject('p1', 'Alpha');
      const loaded = (await service.loadAppData())!;
      await service.saveAppData(withProject(loaded, 'p9'));
      const done = settled(service.deleteSnapshotsForProject('p9'));
      await vi.advanceTimersByTimeAsync(0);

      expect(done).toEqual({ done: true, error: null });
      expect(writePaths().filter((p) => p.includes('p9'))).toEqual([]);
    });
  });

  describe('D: an acknowledgement does not undo a revoke', () => {
    it('ordering 1: the in-flight save\'s acknowledgement leaves the pruned project out, so the next save does not delete it', async () => {
      // Fails under: D.
      seedProject('p1', 'Alpha');
      seedProject('p2', 'Beta');
      const loaded = (await service.loadAppData())!;
      service.subscribeToProject('p2', vi.fn());
      await service.saveAppData(renamed(loaded, 'p1', 'Alpha 2'));
      const commit = hold();
      fake.state.commitHook = commit.hook;
      await vi.advanceTimersByTimeAsync(200); // save A in flight
      listenerOn('p2').error(coded('permission-denied'));
      commit.release();
      await vi.advanceTimersByTimeAsync(0); // A acknowledged

      const evicted: AppData = { ...renamed(loaded, 'p1', 'Alpha 3'), projects: renamed(loaded, 'p1', 'Alpha 3').projects.filter((p) => p.id !== 'p2') };
      await service.saveAppData(evicted);
      await flushSave();
      expect(projectWrites('p2')).toEqual([]);
    });

    it('a failed in-flight save queues its data again without the pruned project', async () => {
      // Fails under: D's re-queue filter.
      seedProject('p1', 'Alpha');
      seedProject('p2', 'Beta');
      const loaded = (await service.loadAppData())!;
      service.subscribeToProject('p2', vi.fn());
      await service.saveAppData(renamed(loaded, 'p2', 'Beta 2'));
      const commit = hold();
      fake.state.commitHook = commit.hook;
      await vi.advanceTimersByTimeAsync(200);
      listenerOn('p2').error(coded('permission-denied'));
      commit.fail(coded('permission-denied'));
      await vi.advanceTimersByTimeAsync(0);

      window.dispatchEvent(new Event('beforeunload'));
      await vi.advanceTimersByTimeAsync(0);
      expect(projectWrites('p2')).toEqual([]);
    });

    it('two saves in flight: neither acknowledgement brings the pruned project back', async () => {
      // Fails under: D.
      seedProject('p1', 'Alpha');
      seedProject('p2', 'Beta');
      const loaded = (await service.loadAppData())!;
      service.subscribeToProject('p2', vi.fn());
      await service.saveAppData(renamed(loaded, 'p1', 'Alpha 2'));
      const first = hold();
      fake.state.commitHook = first.hook;
      await vi.advanceTimersByTimeAsync(200);
      await service.saveAppData(renamed(loaded, 'p1', 'Alpha 3'));
      const second = hold();
      fake.state.commitHook = second.hook;
      await vi.advanceTimersByTimeAsync(200); // two saves in flight
      listenerOn('p2').error(coded('permission-denied'));
      first.release();
      await vi.advanceTimersByTimeAsync(0);
      second.release();
      await vi.advanceTimersByTimeAsync(0);

      const evicted: AppData = { ...renamed(loaded, 'p1', 'Alpha 4'), projects: renamed(loaded, 'p1', 'Alpha 4').projects.filter((p) => p.id !== 'p2') };
      await service.saveAppData(evicted);
      await flushSave();
      expect(projectWrites('p2')).toEqual([]);
    });
  });
});
