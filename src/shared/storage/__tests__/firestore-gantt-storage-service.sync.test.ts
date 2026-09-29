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
/** 'create' when the executor wrote the project as new, 'update' when it rewrote an existing one. */
const action = (w: Write) => (w.data?._changeLog as { action: string }[]).at(-1)?.action;
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

  // Snapshot operations, on a load that succeeds. What they do when the
  // snapshot load itself fails is left to the change that decides it.
  describe('snapshots', () => {
    it('refuses a 51st snapshot for one project, and writes nothing', async () => {
      seedProject('p1', 'Alpha');
      seedProject('p2', 'Beta');
      for (let i = 0; i < 50; i++) seedSnapshot('p1', `s${i}`);

      expect(await service.addSnapshot(snapshot('new-2', 'p2'))).toHaveLength(51); // p2 has room
      fake.state.writes.length = 0;
      expect(await service.addSnapshot(snapshot('new-1', 'p1'))).toBeNull();
      expect(fake.state.writes).toEqual([]);
    });

    it("writes a new snapshot under its project and returns the list with it", async () => {
      seedProject('p1', 'Alpha');
      seedSnapshot('p1', 's1');

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

      const rest = await service.deleteSnapshot('s2');

      expect(fake.state.writes.map((w) => [w.via, w.path])).toEqual([['deleteDoc', 'ganttapp_projects/p2/snapshots/s2']]);
      expect(rest.map((s) => s.id)).toEqual(['s1', 's3']);
    });

    it('deletes nothing for an unknown snapshot id', async () => {
      seedProject('p1', 'Alpha');
      seedSnapshot('p1', 's1');

      await expect(service.deleteSnapshot('no-such-id')).resolves.toEqual([expect.objectContaining({ id: 's1' })]);
      expect(fake.state.writes).toEqual([]);
    });

    it("deletes only one project's snapshots, in one batch", async () => {
      seedProject('p1', 'Alpha');
      seedProject('p2', 'Beta');
      seedSnapshot('p1', 's1');
      seedSnapshot('p1', 's2');
      seedSnapshot('p2', 's3');

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

    it('does not throw when nothing has loaded yet, and still prunes the pending save', async () => {
      // Listeners can exist without a successful load: after a failed cloud
      // load, AppDataContext subscribes to the projects it already holds.
      service.subscribeToProject('p1', vi.fn());
      await service.saveAppData({ projects: [{ id: 'p1', name: 'Alpha' }, { id: 'p2', name: 'Beta' }], releases: [] });

      expect(() => listenerOn('p1').error(coded('permission-denied'))).not.toThrow();
      expect(revoked).toEqual(['p1']);

      await flushSave();
      expect(projectWrites('p2').map(action)).toEqual(['create']);
      expect(projectWrites('p1')).toEqual([]);
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
