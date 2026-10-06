// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// End to end: a cloud merge import, or a copy of a project, whose read of the
// saved snapshots fails or is answered from this browser's cache writes no
// snapshot. Both then replace every snapshot of every project this user is a
// member of with the list they read, so a list missing anything deletes what
// it misses. The import stops and changes nothing; the copy keeps the project
// and its releases and copies no snapshots. Each says so.
//
// Nothing of the app is mocked. The providers, the cloud service and its save
// executor, the Projects and Settings tabs and the real hooks all run. Only
// firebase/firestore, firebase/auth and lib/firebase are replaced. The
// Firestore is cloudProjectSync.e2e.test.tsx's in-memory one (:55-:283 at
// 14d922a), with this app's rules, plus:
//   - a log of every getDocs: its path, when it started and ended, and whether
//     it threw, came from the server, or came from the cache;
//   - read failures, chosen by path;
//   - an offline mode: getDocs answers from a frozen copy of the documents with
//     metadata.fromCache true and no error, as @firebase/firestore 4.14.0 does
//     when it cannot reach the server (measured in Node). It is a model: writes
//     are not queued, and the connection comes back when a commit starts.
// Every getDocs answer carries metadata: fromCache is false from the server.
// A pass-through spy on the service's loadAppData records each service, so
// that each is disposed after its test.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor, within, cleanup, configure } from '@testing-library/react';

// A cloud load in jsdom can outlast Testing Library's 1 s default wait on a busy machine.
configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 30000 });
import { useLayoutEffect, useState } from 'react';

const fake = vi.hoisted(() => {
  type Data = Record<string, unknown>;
  type Ref = { path: string };
  type Constraint = { field: string; op: string; value: unknown };
  type Op = { op: 'set' | 'delete'; path: string; data?: Data };
  type Write = Op & { t: number; by: 'app' | 'remote' };
  type Commit = { n: number; ops: string[]; start: number; end: number | null; ok: boolean | null };
  type Listen = {
    path: string; project: string; openedAt: number; existed: boolean; closedAt: number | null; live: boolean;
    view: string | null; next: (snapshot: unknown) => void; error: (err: unknown) => void;
    timers: ReturnType<typeof setTimeout>[];
  };
  const UID = 'u1';
  const defaults = () => ({
    readDelayMs: 0,
    commitDelayMs: 0,
    listenerDenialMs: 0,
    snapshots: 'cache-first' as 'never' | 'cache-first',
    rules: true,
    f14: 'open' as 'open' | 'next',
    failCommits: null as unknown, // while set, every commit rejects with it
    failWhen: null as null | ((paths: string[]) => unknown), // a commit rejects with what this returns
    onRead: null as null | ((path: string) => void), // at the start of every getDoc
    onCommit: null as null | ((paths: string[]) => void), // at the start of every commit
    failReads: null as null | ((path: string) => unknown), // a getDocs rejects with what this returns
    onReadStart: null as null | ((path: string) => void), // at the start of every getDocs, before its delay
    offlineView: null as null | Map<string, Data>, // while set, getDocs answers from this view, fromCache
  });
  const config = defaults();
  const state = {
    docs: new Map<string, Data>(), writes: [] as Write[], commits: [] as Commit[], listens: [] as Listen[],
    pending: [] as Op[][], generation: 0, t0: 0, reads: [] as { path: string; start: number; t: number; outcome: string }[],
  };
  const now = () => Math.round((performance.now() - state.t0) * 10) / 10;
  const denied = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
  const unavailable = () => Object.assign(new Error('raw transport detail'), { code: 'unavailable' });
  const field = (data: Data, path: string) =>
    path.split('.').reduce<unknown>((obj, key) => (obj as Data | undefined)?.[key], data);
  const matches = (data: Data, c: Constraint) =>
    (c.op === 'in' ? (c.value as unknown[]).includes(field(data, c.field)) : field(data, c.field) === c.value);
  const childrenOf = (path: string, docs: Map<string, Data>) => {
    const depth = path.split('/').length + 1;
    return Array.from(docs.keys()).filter((p) => p.startsWith(`${path}/`) && p.split('/').length === depth).sort();
  };
  const parentOf = (path: string) => path.split('/').slice(0, -1).join('/');
  const projectOf = (path: string) => path.split('/').slice(0, 2).join('/');
  const roleOf = (project: Data | undefined) => (project?.members as Data | undefined)?.[UID] as string | undefined;
  const mayWrite = (project: Data | undefined) => ['owner', 'editor'].includes(roleOf(project) ?? '');
  /** The rules, for one write of this user's, against the state before its batch. */
  const allowed = (op: Op, pre: Map<string, Data>): boolean => {
    if (!config.rules) return true;
    if (op.path.startsWith('ganttapp_settings/')) return op.path === `ganttapp_settings/${UID}`;
    if (!op.path.startsWith('ganttapp_projects/')) return true;
    const project = pre.get(projectOf(op.path));
    if (op.path.split('/').length > 2) return mayWrite(project); // a release or a snapshot
    if (op.op === 'delete') return roleOf(project) === 'owner'; // refused for a missing document too
    if (!project) return op.data?.owner === UID && (op.data?.members as Data | undefined)?.[UID] === 'owner';
    if (roleOf(project) === 'owner') return true;
    return roleOf(project) === 'editor' && op.data?.owner === project.owner
      && JSON.stringify(op.data?.members) === JSON.stringify(project.members);
  };
  // Every call waits its configured delay. A call left over from an earlier
  // test never settles, so it cannot reach the next test's documents.
  const pause = async (ms: number) => {
    const generation = state.generation;
    if (ms > 0) await new Promise((resolve) => { setTimeout(resolve, ms); });
    if (generation !== state.generation) await new Promise(() => {});
  };
  /** What a listener on `path` sees: the server's documents with this client's unacknowledged writes laid over them. */
  const viewOf = (path: string) => {
    const docs = new Map(state.docs);
    let hasPendingWrites = false;
    state.pending.forEach((ops) => ops.forEach((o) => {
      if (parentOf(o.path) !== path) return;
      hasPendingWrites = true;
      if (o.op === 'set') docs.set(o.path, o.data!); else docs.delete(o.path);
    }));
    const paths = childrenOf(path, docs);
    return { docs, paths, hasPendingWrites, key: JSON.stringify(paths.map((p) => [p, docs.get(p)])) };
  };
  /** A snapshot is raised when the documents a listener sees change, or as its first. */
  const emit = (l: Listen, first: boolean) => {
    if (!l.live) return;
    const v = viewOf(l.path);
    if (!first && v.key === l.view) return;
    l.view = v.key;
    l.next({
      docs: v.paths.map((p) => ({ id: p.split('/').pop()!, ref: { path: p }, data: () => structuredClone(v.docs.get(p)) })),
      metadata: { hasPendingWrites: v.hasPendingWrites, fromCache: first },
    });
  };
  const refuse = (l: Listen, ms: number) => {
    const generation = state.generation;
    l.timers.push(setTimeout(() => {
      if (generation !== state.generation || !l.live) return;
      l.live = false;
      l.closedAt = now();
      l.error(denied());
    }, ms));
  };
  /** This client's own writes, issued, acknowledged or rolled back. */
  const notifyLocal = (ops: Op[]) => {
    state.listens.forEach((l) => { if (ops.some((o) => parentOf(o.path) === l.path)) emit(l, false); });
  };
  const commit = async (ops: Op[]) => {
    const record: Commit = { n: state.commits.length + 1, ops: ops.map((o) => `${o.op} ${o.path}`), start: now(), end: null, ok: null };
    state.commits.push(record);
    config.onCommit?.(ops.map((o) => o.path));
    state.pending.push(ops);
    notifyLocal(ops);
    const generation = state.generation;
    try {
      await pause(config.commitDelayMs);
      const pre = new Map(state.docs);
      const refusal = config.failCommits ?? config.failWhen?.(ops.map((o) => o.path))
        ?? (ops.every((o) => allowed(o, pre)) ? null : denied());
      record.end = now();
      record.ok = !refusal;
      if (refusal) throw refusal;
      ops.forEach((o) => {
        state.writes.push({ ...o, t: now(), by: 'app' });
        if (o.op === 'set') state.docs.set(o.path, structuredClone(o.data!));
        else state.docs.delete(o.path);
      });
    } finally {
      state.pending = state.pending.filter((p) => p !== ops);
      // The SDK's rollback: its snapshot follows the rejection by about 1 ms.
      if (record.ok === false) setTimeout(() => { if (generation === state.generation) notifyLocal(ops); }, 1);
    }
    notifyLocal(ops);
  };
  const api = {
    collection: (_db: unknown, path: string) => ({ path }),
    doc: (_db: unknown, path: string) => ({ path }),
    query: (ref: Ref, ...constraints: Constraint[]) => ({ path: ref.path, constraints }),
    where: (fieldPath: string, op: string, value: unknown) => ({ field: fieldPath, op, value }),
    getDocs: async (q: { path: string; constraints?: Constraint[] }) => {
      const started = now();
      config.onReadStart?.(q.path);
      await pause(config.readDelayMs);
      const log = (outcome: string) => state.reads.push({ path: q.path, start: started, t: now(), outcome });
      const failure = config.failReads?.(q.path) ?? null;
      if (failure) { log(`threw ${(failure as { code?: string }).code}`); throw failure; }
      // Offline: the SDK answers getDocs from its cache, with no error (measured on 4.14.0).
      const source = config.offlineView ?? state.docs;
      const fromCache = !!config.offlineView;
      if (!fromCache && /^ganttapp_projects\/[^/]+\/(releases|snapshots)$/.test(q.path) && !roleOf(state.docs.get(projectOf(q.path)))) {
        log('threw permission-denied');
        throw denied();
      }
      const docs = childrenOf(q.path, source)
        .filter((p) => (q.constraints ?? []).every((c) => matches(source.get(p)!, c)))
        .map((p) => ({ id: p.split('/').pop()!, ref: { path: p }, data: () => structuredClone(source.get(p)) }));
      log(`${fromCache ? 'cache' : 'server'} ${docs.length}`);
      return { docs, metadata: { fromCache, hasPendingWrites: false } };
    },
    getDoc: async (ref: Ref) => {
      config.onRead?.(ref.path);
      await pause(config.readDelayMs);
      const data = state.docs.get(ref.path);
      // The rules refuse to read a project document this user is not a member of, or that does not exist.
      if (/^ganttapp_projects\/[^/]+$/.test(ref.path) && !roleOf(data)) throw denied();
      return { exists: () => !!data, data: () => (data ? structuredClone(data) : undefined) };
    },
    setDoc: async (ref: Ref, data: Data, options?: { merge?: boolean }) =>
      commit([{ op: 'set', path: ref.path, data: options?.merge ? { ...state.docs.get(ref.path), ...data } : structuredClone(data) }]),
    deleteDoc: async (ref: Ref) => commit([{ op: 'delete', path: ref.path }]),
    writeBatch: () => {
      const ops: Op[] = [];
      return {
        set: (ref: Ref, data: Data) => { ops.push({ op: 'set', path: ref.path, data: structuredClone(data) }); },
        delete: (ref: Ref) => { ops.push({ op: 'delete', path: ref.path }); },
        commit: () => commit(ops),
      };
    },
    // Release listeners. One on a project this user cannot read is refused;
    // otherwise, in 'cache-first' mode, its first snapshot comes from the cache.
    onSnapshot: (q: Ref, next: (snapshot: unknown) => void, error: (err: unknown) => void) => {
      const project = q.path.replace(/\/releases$/, '');
      const l: Listen = {
        path: q.path, project, openedAt: now(), existed: state.docs.has(project), closedAt: null, live: true,
        view: null, next, error, timers: [],
      };
      state.listens.push(l);
      const generation = state.generation;
      if (!roleOf(state.docs.get(project))) refuse(l, config.listenerDenialMs);
      else if (config.snapshots === 'cache-first') {
        l.timers.push(setTimeout(() => { if (generation === state.generation) emit(l, true); }, 5));
      }
      return () => {
        if (l.live) { l.live = false; l.closedAt = now(); }
        l.timers.forEach((t) => clearTimeout(t));
      };
    },
    serverTimestamp: () => 'server-timestamp',
    deleteField: () => ({ deleteField: true }),
    runTransaction: async () => {},
    Timestamp: class Timestamp { toMillis() { return 0; } },
  };
  /** A write by another device or user, committed; it reaches this client's listeners a moment later. */
  const push = (path: string, data: Data | null) => {
    if (data) state.docs.set(path, structuredClone(data)); else state.docs.delete(path);
    state.writes.push({ op: data ? 'set' : 'delete', path, ...(data ? { data } : {}), t: now(), by: 'remote' });
    const generation = state.generation;
    setTimeout(() => {
      if (generation !== state.generation) return;
      state.listens.forEach((l) => {
        if (!l.live || parentOf(path) !== l.path) return;
        // The emulator checks the rules again before it pushes a change.
        if (!roleOf(state.docs.get(l.project))) refuse(l, 0); else emit(l, false);
      });
    }, 1);
  };
  /** The owner removes this user from a project, or the project is deleted elsewhere. */
  const revoke = (projectId: string, how: 'remove' | 'delete') => {
    const path = `ganttapp_projects/${projectId}`;
    const doc = state.docs.get(path)!;
    if (how === 'delete') {
      state.docs.delete(path);
      state.writes.push({ op: 'delete', path, t: now(), by: 'remote' });
    } else {
      const members = { ...(doc.members as Data) };
      delete members[UID];
      state.docs.set(path, { ...doc, members });
      state.writes.push({ op: 'set', path, data: { ...doc, members }, t: now(), by: 'remote' });
    }
    if (config.f14 === 'open') {
      state.listens.forEach((l) => { if (l.live && l.project === path) refuse(l, config.listenerDenialMs); });
    }
  };
  const reset = () => {
    state.generation += 1;
    state.docs.clear();
    state.writes.length = 0;
    state.commits.length = 0;
    state.listens.length = 0;
    state.pending = [];
    state.reads.length = 0;
    state.t0 = performance.now();
    Object.assign(config, defaults());
  };
  return { state, config, api, reset, push, revoke, now, denied, unavailable };
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
  auth: { currentUser: { uid: 'u1' } },
  db: {},
  isFirebaseAvailable: true,
  getSendInvitationEmail: () => null,
  getClaimPendingInvitations: () => null,
  getRevokeInvite: () => null,
  getResendInvite: () => null,
}));

import { FullWrapper } from '../../../test/FullWrapper';
import { SettingsTab } from '../../settings/SettingsTab';
import { ProjectsTab } from '../ProjectsTab';
import { useAppData } from '../../../context/AppDataContext';
import { useSnapshots } from '../../chart/useSnapshots';
import { FirestoreGanttStorageServiceImpl } from '../../../shared/storage/firestore-gantt-storage-service';
import { TOS_VERSION } from '../../../lib/version';
import type { AppData } from '../../../shared/types/app';

const MODE_KEY = 'ganttapp-storage-mode';
const STAMP = '2026-01-01T00:00:00.000Z';
const NOT_IMPORTED =
  'Nothing was imported, because your saved snapshots could not be loaded from the cloud. Please try again.';
const NOT_COPIED =
  'Project cloned, but its snapshots were not copied, because your saved snapshots could not be loaded from the cloud.';
const NEVER_LOADED =
  'Nothing was imported. Your cloud data did not load, so changes cannot be saved. Reload the page to try again.';

// ---- The cloud

const releaseDoc = (name: string, order: number) =>
  ({ name, startDate: '2026-02-02', earlyFinishDate: '2026-03-02', lateFinishDate: '2026-04-01', order });
const projectDoc = (name: string, order: number, owner = 'u1', members: Record<string, string> = { u1: 'owner', u2: 'editor' }) => ({
  name, owner, members, finishDate: null, order, schemaVersion: 1, _originRef: `uid:${owner}`,
  createdAt: STAMP, updatedAt: STAMP, _changeLog: [],
});
const snapshotDoc = (name: string) => ({ name, timestamp: STAMP, releases: [releaseDoc('Design', 0)] });

/**
 * This user's p1 "Alpha" (releases r1, r2; snapshots s1, s2) and p2 "Beta"
 * (release r3; snapshot s5), and u3's p3 "Editor Plan", this user its editor
 * (release r5; u3's snapshot s3). The member list reads them in that order.
 */
function seed() {
  const docs = fake.state.docs;
  docs.set('ganttapp_settings/u1', { schemaVersion: 1, showTodayLine: false });
  docs.set('ganttapp_projects/p1', projectDoc('Alpha', 0));
  docs.set('ganttapp_projects/p1/releases/r1', releaseDoc('Design', 0));
  docs.set('ganttapp_projects/p1/releases/r2', releaseDoc('Build', 1));
  docs.set('ganttapp_projects/p1/snapshots/s1', snapshotDoc('Sprint 1'));
  docs.set('ganttapp_projects/p1/snapshots/s2', snapshotDoc('Sprint 2'));
  docs.set('ganttapp_projects/p2', projectDoc('Beta', 1));
  docs.set('ganttapp_projects/p2/releases/r3', releaseDoc('Launch', 0));
  docs.set('ganttapp_projects/p2/snapshots/s5', snapshotDoc('Beta Snap'));
  docs.set('ganttapp_projects/p3', projectDoc('Editor Plan', 2, 'u3', { u3: 'owner', u1: 'editor' }));
  docs.set('ganttapp_projects/p3/releases/r5', releaseDoc('Editor R', 0));
  docs.set('ganttapp_projects/p3/snapshots/s3', snapshotDoc('Owner Snap'));
}

// ---- Import files

const importedRelease = (id: string, projectId: string) => ({
  id, projectId, name: 'Imported Release', startDate: '2026-05-04', earlyFinishDate: '2026-06-01', lateFinishDate: '2026-06-29',
});
const importedSnapshot = (id: string, projectId: string) => ({ id, projectId, name: 'Imported Snap', timestamp: STAMP, releases: [] });
function projectExport(project: { id: string; name: string }, withSnapshot: boolean) {
  return {
    projects: [project],
    releases: [importedRelease(`${project.id}-r`, project.id)],
    snapshots: withSnapshot ? [importedSnapshot(`${project.id}-s`, project.id)] : [],
    _exportType: 'ganttapp-project-export',
  };
}
const IMP1 = { id: 'imp1', name: 'Imported Plan' };

// ---- Every cloud service the app makes, so each is disposed after the test

type Service = FirestoreGanttStorageServiceImpl;
const proto = FirestoreGanttStorageServiceImpl.prototype;
const realLoad = proto.loadAppData;
const services = new Set<Service>();
const loads: boolean[] = [];

function trackServices() {
  vi.spyOn(proto, 'loadAppData').mockImplementation(function (this: Service) {
    services.add(this);
    const result = realLoad.call(this);
    void result.then((data) => { loads.push(data !== null); });
    return result;
  });
}

// ---- The app: the Settings and Projects tabs, and a probe for the data on screen

const probe: { current: AppData | null } = { current: null };

function Probe() {
  const { data } = useAppData();
  // After every commit; act() flushes it.
  useLayoutEffect(() => { probe.current = data; });
  return null;
}

function App() {
  const [selected, setSelected] = useState('p1');
  const snapshots = useSnapshots(selected);
  return (
    <>
      <SettingsTab />
      <ProjectsTab
        selectedProjectId={selected}
        setSelectedProjectId={setSelected}
        setActiveTab={() => {}}
        draggedProjectId={null}
        onProjectDragStart={() => {}}
        onProjectDragOver={() => {}}
        onProjectDragEnd={() => {}}
        onReplaceSnapshots={snapshots.replaceAllSnapshots}
      />
      <Probe />
    </>
  );
}

// ---- Helpers

/** Real time, in small steps, so no single act() spans a render that matters. */
const wait = async (ms: number) => {
  for (let t = 0; t < ms; t += 5) await act(() => new Promise<void>((resolve) => { setTimeout(resolve, 5); }));
};

const onScreen = () => probe.current!.projects.map((p) => p.name);
const idOf = (name: string) => probe.current!.projects.find((p) => p.name === name)?.id;
/** Every document under ganttapp_projects (projects, releases and snapshots), as it is now. */
const projectTree = () => new Map(Array.from(fake.state.docs)
  .filter(([path]) => path.startsWith('ganttapp_projects/'))
  .map(([path, data]) => [path, structuredClone(data)] as const));
const snapshotsIn = (tree: Map<string, unknown>) => new Map(Array.from(tree).filter(([path]) => path.includes('/snapshots/')));
/** The snapshot paths in a tree, sorted, outside one project or inside it. */
const snapshotPaths = (tree: Map<string, unknown>, projectId: string, inside: boolean) => Array.from(snapshotsIn(tree).keys())
  .filter((p) => p.startsWith(`ganttapp_projects/${projectId}/`) === inside).sort();
const cloudReleaseIdsOf = (projectId: string) => Array.from(fake.state.docs.keys())
  .filter((p) => p.startsWith(`ganttapp_projects/${projectId}/releases/`)).map((p) => p.split('/').pop()).sort();
/** The getDocs calls since a mark, each as "path outcome", in the order they ended. */
const readsSince = (from: number) => fake.state.reads.slice(from).map((r) => `${r.path} ${r.outcome}`);
/** The commits attempted since a mark, each as its writes. */
const commitsSince = (from: number) => fake.state.commits.slice(from).map((c) => c.ops.join(', '));
/** Where the test begins its action: the commit and read counts, and the cloud's documents. */
const markNow = () => ({ commits: fake.state.commits.length, reads: fake.state.reads.length, tree: projectTree() });

/** The import's banner: its role and its text, without the Dismiss button. */
function importBanner() {
  const banner = screen.queryByRole('button', { name: 'Dismiss notification' })?.parentElement;
  return banner ? { role: banner.getAttribute('role'), text: banner.querySelector('span')?.textContent ?? null } : null;
}

function tileOf(name: string): HTMLElement {
  let el: HTMLElement | null = screen.getByLabelText(`Open releases for ${name}`);
  while (el && !el.querySelector('[aria-label="Drag to reorder project"]')) el = el.parentElement;
  return el!;
}
const cloneViaTile = (name: string) =>
  fireEvent.click(within(tileOf(name)).getByRole('button', { name: 'Clone project' }));
function importFile(content: unknown) {
  const input = document.querySelector<HTMLInputElement>('label[aria-label="Import projects from JSON"] input[type="file"]')!;
  const file = new File([JSON.stringify(content)], 'import.json', { type: 'application/json' });
  fireEvent.change(input, { target: { files: [file] } });
}
/** In cloud mode every import opens the preview (Fast Path 1 is local only): confirm it. */
async function importAndConfirm(content: unknown) {
  importFile(content);
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm Import' }));
}

const renderApp = () => render(<FullWrapper><App /></FullWrapper>);

/** A cloud session whose load succeeds, quiet: listeners open, their first snapshots in, the echo save settled. */
async function openCloud() {
  localStorage.setItem(MODE_KEY, 'cloud');
  renderApp();
  await waitFor(() => expect(loads.some((ok) => ok)).toBe(true), { timeout: 5000 });
  await wait(400);
}

/** A cloud session whose first load fails (its settings read is refused, every time), so nothing can be saved. */
async function openNeverLoaded() {
  fake.config.onRead = (path) => { if (path === 'ganttapp_settings/u1') throw fake.unavailable(); };
  localStorage.setItem(MODE_KEY, 'cloud');
  renderApp();
  await waitFor(() => expect(loads).toContain(false), { timeout: 5000 });
  await wait(300);
}

/** The next getDocs of `path` throws `error`; any read after it succeeds. */
function failNextRead(path: string, error: unknown) {
  const fault = { hit: false };
  fake.config.failReads = (p) => {
    if (fault.hit || p !== path) return null;
    fault.hit = true;
    return error;
  };
  return fault;
}

/** u3 removes this user from p3 as the next read of p3's snapshots starts; the rules then refuse that read. */
function revokeAtNextP3Read() {
  // The listener hears of the revoke only with a later change, so no eviction runs during the test.
  fake.config.f14 = 'next';
  let armed = true;
  fake.config.onReadStart = (path) => {
    if (!armed || path !== 'ganttapp_projects/p3/snapshots') return;
    armed = false;
    fake.revoke('p3', 'remove');
  };
}
/** The tree before the revoke, with the revoke applied: u1 gone from p3's members. */
function withP3Revoked(tree: Map<string, unknown>) {
  const after = new Map(tree);
  const p3 = structuredClone(tree.get('ganttapp_projects/p3')) as { members: Record<string, string> };
  delete p3.members.u1;
  after.set('ganttapp_projects/p3', p3);
  return after;
}

/**
 * u3 saves s9 under p3, which this browser's cache does not hold. Then the
 * connection drops: reads come from the cache as it was, with no error, until a
 * commit starts, when the connection comes back.
 */
async function goOfflineWithStaleCache() {
  const cached = new Map(fake.state.docs);
  fake.push('ganttapp_projects/p3/snapshots/s9', snapshotDoc('Collaborator Snap'));
  await wait(20);
  fake.config.offlineView = cached;
  fake.config.commitDelayMs = 100;
  fake.config.onCommit = () => { fake.config.offlineView = null; };
}

let alertSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fake.reset();
  loads.length = 0;
  probe.current = null;
  localStorage.clear();
  localStorage.setItem('spert_tos_accepted_version', TOS_VERSION);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  vi.spyOn(window, 'prompt').mockReturnValue('Sprint 3');
  trackServices();
});

afterEach(() => {
  cleanup();
  services.forEach((service) => service.dispose());
  services.clear();
  vi.restoreAllMocks();
});

const alerts = () => (alertSpy.mock.calls as unknown[][]).map((call) => String(call[0]));

// ---- The merge import

const FORMS = [
  { form: 'no snapshot in the file', withSnapshot: false },
  { form: 'a snapshot in the file', withSnapshot: true },
];

describe.each(FORMS)('a cloud merge import, $form, whose snapshot load does not get every snapshot from the server', ({ withSnapshot }) => {
  it('stops when a later project\'s read fails after an earlier one succeeded, and changes nothing', async () => {
    seed();
    await openCloud();
    failNextRead('ganttapp_projects/p2/snapshots', fake.unavailable());
    const start = markNow();
    await importAndConfirm(projectExport(IMP1, withSnapshot));
    await wait(1200);

    // Positive control: the fault hit the import's own load, after p1's read succeeded.
    expect(readsSince(start.reads).slice(0, 3)).toEqual([
      'ganttapp_projects server 3', 'ganttapp_projects/p1/snapshots server 2', 'ganttapp_projects/p2/snapshots threw unavailable',
    ]);
    expect(importBanner()).toEqual({ role: 'alert', text: NOT_IMPORTED });
    expect(commitsSince(start.commits)).toEqual([]);
    expect(projectTree()).toEqual(start.tree);
    expect(onScreen()).toEqual(['Alpha', 'Beta', 'Editor Plan']);
  });

  it('stops when this user is removed from a shared project while the load reads it, and does not say the projects were imported', async () => {
    seed();
    await openCloud();
    revokeAtNextP3Read();
    const start = markNow();
    await importAndConfirm(projectExport(IMP1, withSnapshot));
    await wait(1200);

    // Positive control: the rules refused the import's own read of p3, after the revoke.
    expect(readsSince(start.reads).slice(0, 4)).toEqual([
      'ganttapp_projects server 3', 'ganttapp_projects/p1/snapshots server 2',
      'ganttapp_projects/p2/snapshots server 1', 'ganttapp_projects/p3/snapshots threw permission-denied',
    ]);
    expect(importBanner()).toEqual({ role: 'alert', text: NOT_IMPORTED });
    expect(commitsSince(start.commits)).toEqual([]);
    expect(projectTree()).toEqual(withP3Revoked(start.tree));
    expect(onScreen()).toEqual(['Alpha', 'Beta', 'Editor Plan']);
  });

  it('stops when the load is answered from a cache that lacks a collaborator\'s snapshot, and changes nothing', async () => {
    seed();
    await openCloud();
    await goOfflineWithStaleCache();
    const start = markNow();
    await importAndConfirm(projectExport(IMP1, withSnapshot));
    await wait(1500);

    // Positive control: the import's own load was answered from the cache.
    expect(readsSince(start.reads)[0]).toBe('ganttapp_projects cache 3');
    expect(importBanner()).toEqual({ role: 'alert', text: NOT_IMPORTED });
    expect(commitsSince(start.commits)).toEqual([]);
    expect(projectTree()).toEqual(start.tree);
    expect(onScreen()).toEqual(['Alpha', 'Beta', 'Editor Plan']);
  });
});

describe('a cloud merge import in a session whose data never loaded', () => {
  it('is refused with the message for that, before any snapshot is read', async () => {
    seed();
    await openNeverLoaded();
    const fault = failNextRead('ganttapp_projects/p1/snapshots', fake.unavailable());
    const start = markNow();
    await importAndConfirm(projectExport(IMP1, true));
    await waitFor(() => expect(importBanner()).not.toBeNull());
    await wait(300);

    // Positive control: the first load failed, and none succeeded since.
    expect(loads).not.toContain(true);
    expect(importBanner()).toEqual({ role: 'alert', text: NEVER_LOADED });
    expect(readsSince(start.reads)).toEqual([]);
    expect(fault.hit).toBe(false);
    expect(commitsSince(start.commits)).toEqual([]);
    expect(projectTree()).toEqual(start.tree);
  });
});

// ---- The copy

describe('a cloud copy of a project with snapshots, whose snapshot load does not get every snapshot from the server', () => {
  it('keeps the copy and its releases when a read fails, copies no snapshots, and says so', async () => {
    seed();
    await openCloud();
    failNextRead('ganttapp_projects/p2/snapshots', fake.unavailable());
    const start = markNow();
    cloneViaTile('Alpha');
    const id = idOf('Alpha - Copy (1)')!;
    await wait(1200);

    // Positive control: the fault hit the copy's own load, after p1's read succeeded.
    expect(readsSince(start.reads).slice(0, 3)).toEqual([
      'ganttapp_projects server 3', 'ganttapp_projects/p1/snapshots server 2', 'ganttapp_projects/p2/snapshots threw unavailable',
    ]);
    expect(alerts()).toEqual([NOT_COPIED]);
    expect(commitsSince(start.commits).filter((c) => c.includes('/snapshots/'))).toEqual([]);
    expect(onScreen()).toEqual(['Alpha', 'Alpha - Copy (1)', 'Beta', 'Editor Plan']);
    expect(fake.state.docs.has(`ganttapp_projects/${id}`)).toBe(true);
    expect(cloudReleaseIdsOf(id)).toHaveLength(2);
    expect(snapshotsIn(projectTree())).toEqual(snapshotsIn(start.tree));
  });

  it('keeps the copy and its releases when the load is answered from a stale cache, and keeps the collaborator\'s snapshot', async () => {
    seed();
    await openCloud();
    await goOfflineWithStaleCache();
    const start = markNow();
    cloneViaTile('Alpha');
    const id = idOf('Alpha - Copy (1)')!;
    await wait(1500);

    // Positive control: the copy's own load was answered from the cache.
    expect(readsSince(start.reads)[0]).toBe('ganttapp_projects cache 3');
    expect(alerts()).toEqual([NOT_COPIED]);
    expect(commitsSince(start.commits).filter((c) => c.includes('/snapshots/'))).toEqual([]);
    expect(onScreen()).toEqual(['Alpha', 'Alpha - Copy (1)', 'Beta', 'Editor Plan']);
    expect(fake.state.docs.has(`ganttapp_projects/${id}`)).toBe(true);
    expect(cloudReleaseIdsOf(id)).toHaveLength(2);
    expect(snapshotsIn(projectTree())).toEqual(snapshotsIn(start.tree));
    expect(fake.state.docs.has('ganttapp_projects/p3/snapshots/s9')).toBe(true);
  });
});

// ---- Positive controls: every read from the server

describe('a cloud merge import and a copy whose snapshot loads all come from the server', () => {
  it('the import writes the project and its snapshot, keeps every other snapshot, and says so', async () => {
    seed();
    await openCloud();
    const start = markNow();
    await importAndConfirm(projectExport(IMP1, true));
    await waitFor(() => expect(importBanner()).toEqual({ role: 'status', text: '1 project added.' }));
    await wait(700);

    const id = idOf('Imported Plan')!;
    expect(readsSince(start.reads).filter((r) => r.includes(' cache '))).toEqual([]);
    expect(fake.state.docs.has(`ganttapp_projects/${id}`)).toBe(true);
    expect(snapshotPaths(projectTree(), id, true)).toHaveLength(1);
    expect(snapshotPaths(projectTree(), id, false)).toEqual(snapshotPaths(start.tree, id, false));
    expect(onScreen()).toEqual(['Alpha', 'Beta', 'Editor Plan', 'Imported Plan']);
  });

  it('the copy writes the project, its releases and its snapshot copies, keeps every other snapshot, with no alert', async () => {
    seed();
    await openCloud();
    const start = markNow();
    cloneViaTile('Alpha');
    const id = idOf('Alpha - Copy (1)')!;
    await wait(1200);

    expect(readsSince(start.reads).filter((r) => r.includes(' cache '))).toEqual([]);
    expect(alerts()).toEqual([]);
    expect(cloudReleaseIdsOf(id)).toHaveLength(2);
    expect(snapshotPaths(projectTree(), id, true)).toHaveLength(2);
    expect(snapshotPaths(projectTree(), id, false)).toEqual(snapshotPaths(start.tree, id, false));
  });
});
