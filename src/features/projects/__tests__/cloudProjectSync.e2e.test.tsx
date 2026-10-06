// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// End to end: a project created in a cloud session that loaded normally,
// whether added, copied or imported, stays on screen and is written to the
// cloud, and what comes with that.
//
// Nothing of the app is mocked. The providers, the cloud service and its save
// executor, the Projects and Settings tabs and the real hooks all run. Only
// firebase/* (an in-memory Firestore with this app's rules, and a signed-in
// user) and lib/firebase are replaced. The save executor is wrapped, not
// replaced: each save's capture and settlement are logged and its result is
// passed through unchanged.
//
// The fake starts from cloudNotLoaded.e2e.test.tsx's at 1d00e21 (:44-:153) and
// adds what this file needs:
//   - the rules (spert-landing-page firestore.rules :308-:353 at bc9e7a4), checked
//     for each batch on the state before it, all or nothing;
//   - listener refusals after `listenerDenialMs` (ported from cloudSwap2.e2e);
//   - a revoke, in two forms: it refuses the project's open listeners ('open'),
//     or only the next listen and the next change pushed to them ('next'), which
//     is what the emulator did (Brief 16 Phase A, F14);
//   - commits that fail, persistently or when a predicate says so;
//   - first snapshots from the cache by default, and changes pushed by another
//     device to the open listeners;
//   - latency compensation: while a batch is in its commit delay, a listener
//     whose documents it changes sees them with hasPendingWrites. After the
//     commit no snapshot follows unless the documents differ, since nothing in
//     the app asks for metadata changes. A refused batch's writes are rolled back
//     about 1 ms after the commit rejects, and every listener whose documents
//     change hears of it (measured in Phase A, 3/3);
//   - logs: every listen (opened when, on a project whose document existed or
//     not, closed when), every write and commit, timed.
//
// Removals named in the comments: B (no listener before confirmation), S (the
// snapshot wait), D (an acknowledgement does not undo a revoke), V (the viewer
// guard; its project-document part and its release part), H (the unsent-changes
// guard; its comparison and its in-flight part), R50 (the Delete gate), R53 (the
// viewer's message), R54 (an import's owners). Each comment names the removals
// the test failed under when each was applied alone to v0.29.1, every test run
// against each; "by reading" marks a claim no removal was run for. The wrong
// builds of the release's design check (wrong-A, wrong-E, wrong-U, wrong-H) are
// tabled with the release's report, not here. "Needs the rules" marks a test
// that fails with the fake's rules off even when nothing is removed.

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
  });
  const config = defaults();
  const state = {
    docs: new Map<string, Data>(), writes: [] as Write[], commits: [] as Commit[], listens: [] as Listen[],
    pending: [] as Op[][], generation: 0, t0: 0,
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
      await pause(config.readDelayMs);
      if (/^ganttapp_projects\/[^/]+\/(releases|snapshots)$/.test(q.path) && !roleOf(state.docs.get(projectOf(q.path)))) {
        throw denied();
      }
      const docs = childrenOf(q.path, state.docs)
        .filter((p) => (q.constraints ?? []).every((c) => matches(state.docs.get(p)!, c)))
        .map((p) => ({ id: p.split('/').pop()!, ref: { path: p }, data: () => structuredClone(state.docs.get(p)) }));
      return { docs };
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
    state.t0 = performance.now();
    Object.assign(config, defaults());
  };
  return { state, config, api, reset, push, revoke, now, denied, unavailable };
});

// Every save the service runs: when it captured its data, when it settled, and how.
const saves = vi.hoisted(() => ({
  log: [] as { n: number; capturedAt: number; settledAt: number | null; ok: boolean | null; projects: string[] }[],
}));

vi.mock('firebase/firestore', () => fake.api);

vi.mock('../../../shared/storage/firestore-save-executor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/storage/firestore-save-executor')>();
  return {
    ...actual,
    executeFirestoreSave: (...args: Parameters<typeof actual.executeFirestoreSave>) => {
      const entry = {
        n: saves.log.length + 1, capturedAt: fake.now(), settledAt: null as number | null, ok: null as boolean | null,
        projects: args[2].projects.map((p) => p.id),
      };
      saves.log.push(entry);
      return actual.executeFirestoreSave(...args).then(
        (result) => { entry.settledAt = fake.now(); entry.ok = true; return result; },
        (err: unknown) => { entry.settledAt = fake.now(); entry.ok = false; throw err; },
      );
    },
  };
});

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
import { DEFAULT_CHART_COLORS } from '../../../shared/utils';
import { TOS_VERSION } from '../../../lib/version';
import type { AppData } from '../../../shared/types/app';

const MODE_KEY = 'ganttapp-storage-mode';
const STAMP = '2026-01-01T00:00:00.000Z';
const SYNC_ERROR = /Cloud sync error/;
const VIEWER_NOT_SAVED_SHOWN = 'Cloud sync error: You can only view this project, so your change was not saved.';
const CLONE_NOT_SAVED = 'Project cloned, but its snapshots were not copied, because the copy was not saved to the cloud.';
const MERGE_NOT_SAVED =
  "The projects were imported here, but they were not saved to the cloud, so the file's snapshots were not imported.";
const REPLACE_ALL_NOT_SAVED =
  "Your data was replaced here, but the imported projects were not saved to the cloud, so the file's snapshots were not imported.";
const SNAPSHOT_NOT_SAVED = 'Snapshot not saved, because this project has not been saved to the cloud.';
const CLONE_SNAPSHOTS_REFUSED = 'Project cloned, but its snapshots could not be copied.';
const IMPORT_SNAPSHOTS_REFUSED = 'Projects imported, but snapshots could not be saved.';
const CLONE_SNAPSHOTS_UNAVAILABLE =
  'Project cloned, but its snapshots could not be copied. Service temporarily unavailable. Please try again later.';

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
 * (release r3). With `editor`: p3 "Editor Plan", owned by u3, this user its
 * editor (release r5). With `viewer`: p4 "Viewer Plan", owned by u3, this user
 * its viewer (release r4), and with `viewerSnapshot` a snapshot s4 under it.
 */
function seed(options: { empty?: boolean; editor?: boolean; viewer?: boolean; viewerSnapshot?: boolean } = {}) {
  const docs = fake.state.docs;
  docs.set('ganttapp_settings/u1', { schemaVersion: 1, showTodayLine: false });
  if (options.empty) return;
  docs.set('ganttapp_projects/p1', projectDoc('Alpha', 0));
  docs.set('ganttapp_projects/p1/releases/r1', releaseDoc('Design', 0));
  docs.set('ganttapp_projects/p1/releases/r2', releaseDoc('Build', 1));
  docs.set('ganttapp_projects/p1/snapshots/s1', snapshotDoc('Sprint 1'));
  docs.set('ganttapp_projects/p1/snapshots/s2', snapshotDoc('Sprint 2'));
  docs.set('ganttapp_projects/p2', projectDoc('Beta', 1));
  docs.set('ganttapp_projects/p2/releases/r3', releaseDoc('Launch', 0));
  if (options.editor) {
    docs.set('ganttapp_projects/p3', projectDoc('Editor Plan', 2, 'u3', { u3: 'owner', u1: 'editor' }));
    docs.set('ganttapp_projects/p3/releases/r5', releaseDoc('Editor R', 0));
  }
  if (options.viewer) {
    docs.set('ganttapp_projects/p4', projectDoc('Viewer Plan', 3, 'u3', { u3: 'owner', u1: 'viewer' }));
    docs.set('ganttapp_projects/p4/releases/r4', releaseDoc('Viewer R', 0));
    if (options.viewerSnapshot) docs.set('ganttapp_projects/p4/snapshots/s4', snapshotDoc('Viewer Snap'));
  }
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
function allProjectsFile(projects: { id: string; name: string }[], withSnapshot: boolean) {
  return {
    projects,
    releases: projects.map((p) => importedRelease(`${p.id}-r`, p.id)),
    snapshots: withSnapshot ? [importedSnapshot('imp1-s', 'imp1')] : [],
    _exportType: 'ganttapp-all-projects',
  };
}
const IMP1 = { id: 'imp1', name: 'Imported Plan' };

// ---- Every cloud service the app makes, so each is disposed after the test

type Service = FirestoreGanttStorageServiceImpl;
const proto = FirestoreGanttStorageServiceImpl.prototype;
const realLoad = proto.loadAppData;
const realSubscribe = proto.subscribeToProject;
const services = new Set<Service>();
const loads: boolean[] = [];
/** When the app asked the service for each project's listener, whether or not it opened at once. */
const listenRequests: { projectId: string; t: number }[] = [];

function trackServices() {
  vi.spyOn(proto, 'loadAppData').mockImplementation(function (this: Service) {
    services.add(this);
    const result = realLoad.call(this);
    void result.then((data) => { loads.push(data !== null); });
    return result;
  });
  vi.spyOn(proto, 'subscribeToProject').mockImplementation(function (this: Service, ...args: Parameters<Service['subscribeToProject']>) {
    listenRequests.push({ projectId: args[0], t: fake.now() });
    return realSubscribe.apply(this, args);
  });
}

// ---- The app: the Settings and Projects tabs, and a probe for what the
// Releases tab and the project form would do to the data.

type ProbeApi = {
  data: AppData;
  renameRelease: (id: string, name: string) => void;
  addRelease: (projectId: string, id: string, name: string) => void;
  renameProject: (id: string, name: string) => void;
  renameProjectAndRelease: (projectId: string, projectName: string, releaseId: string, releaseName: string) => void;
  moveToTop: (id: string) => void;
  saveSnapshotOfNewest: () => Promise<void>;
};
const probe: { current: ProbeApi | null } = { current: null };
/** The project App has selected, after every commit. */
const selection: { current: string | null } = { current: null };

function Probe() {
  const { data, updateData } = useAppData();
  const newest = data.projects[data.projects.length - 1]?.id ?? '';
  const snapshots = useSnapshots(newest);
  const withReleases = (map: (r: AppData['releases'][number]) => AppData['releases'][number]) =>
    ({ ...data, releases: data.releases.map(map) });
  const api: ProbeApi = {
    data,
    renameRelease: (id, name) => updateData(withReleases((r) => (r.id === id ? { ...r, name } : r))),
    addRelease: (projectId, id, name) => updateData({
      ...data,
      releases: [...data.releases, { ...importedRelease(id, projectId), name }],
    }),
    renameProject: (id, name) => updateData({ ...data, projects: data.projects.map((p) => (p.id === id ? { ...p, name } : p)) }),
    renameProjectAndRelease: (projectId, projectName, releaseId, releaseName) => updateData({
      ...withReleases((r) => (r.id === releaseId ? { ...r, name: releaseName } : r)),
      projects: data.projects.map((p) => (p.id === projectId ? { ...p, name: projectName } : p)),
    }),
    moveToTop: (id) => updateData({
      ...data,
      projects: [...data.projects.filter((p) => p.id === id), ...data.projects.filter((p) => p.id !== id)],
    }),
    saveSnapshotOfNewest: () => snapshots.saveSnapshot({
      releases: data.releases.filter((r) => r.projectId === newest),
      chartColors: DEFAULT_CHART_COLORS,
      legendLabels: { solidBar: 'Planned', hatchedBar: 'Uncertain' },
      preparedBy: '',
    }),
  };
  // After every commit, so each action sees the data on screen; act() flushes it.
  useLayoutEffect(() => { probe.current = api; });
  return null;
}

function App() {
  const [selected, setSelected] = useState('p1');
  const snapshots = useSnapshots(selected);
  // After every commit, as Probe's data; act() flushes it.
  useLayoutEffect(() => { selection.current = selected; });
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
const act$ = (work: () => void) => act(() => { work(); });

const onScreen = () => probe.current!.data.projects.map((p) => p.name);
const idOf = (name: string) => probe.current!.data.projects.find((p) => p.name === name)?.id;
const releaseOnScreen = (id: string) => probe.current!.data.releases.find((r) => r.id === id)?.name;
const cloudDoc = (path: string) => fake.state.docs.get(path);
const cloudReleaseName = (projectId: string, releaseId: string) =>
  cloudDoc(`ganttapp_projects/${projectId}/releases/${releaseId}`)?.name;
const cloudProjectIds = () => Array.from(fake.state.docs.keys())
  .filter((p) => /^ganttapp_projects\/[^/]+$/.test(p)).map((p) => p.split('/')[1]).sort();
const cloudReleaseIdsOf = (projectId: string) => Array.from(fake.state.docs.keys())
  .filter((p) => p.startsWith(`ganttapp_projects/${projectId}/releases/`)).map((p) => p.split('/').pop()).sort();
const cloudSnapshotPaths = () => Array.from(fake.state.docs.keys()).filter((p) => p.includes('/snapshots/')).sort();
/** This app's writes to one document, in order: 'set' or 'delete'. */
const appOps = (path: string) => fake.state.writes.filter((w) => w.by === 'app' && w.path === path).map((w) => w.op);
/** This app's writes to a project's document or anything under it. */
const appWritesUnder = (projectId: string) => fake.state.writes
  .filter((w) => w.by === 'app' && (w.path === `ganttapp_projects/${projectId}` || w.path.startsWith(`ganttapp_projects/${projectId}/`)))
  .map((w) => `${w.op} ${w.path}`);
/** The commits the rules refused, each as its writes. */
const refusedCommits = () => fake.state.commits.filter((c) => c.ok === false).map((c) => c.ops.join(', '));
/** The ids of a project's releases on screen, sorted as cloudReleaseIdsOf sorts. */
const releaseIdsOf = (projectId: string) =>
  probe.current!.data.releases.filter((r) => r.projectId === projectId).map((r) => r.id).sort();
/** Listens opened on a project while its document did not exist (the oracle). */
const earlyListens = (projectId: string) =>
  fake.state.listens.filter((l) => l.project === `ganttapp_projects/${projectId}` && !l.existed).length;
const liveListens = () => {
  const counts: Record<string, number> = {};
  fake.state.listens.filter((l) => l.live).forEach((l) => {
    const id = l.project.split('/')[1];
    counts[id] = (counts[id] ?? 0) + 1;
  });
  return counts;
};
const syncErrorNow = () => screen.queryByText(SYNC_ERROR)?.textContent ?? null;
const bannerText = () => Array.from(document.querySelectorAll('[role="status"], [role="alert"]'))
  .map((e) => e.textContent ?? '').join(' | ');

/** Records whether any text matching `pattern` is ever on the page. */
function watchText(pattern: RegExp) {
  let seen = false;
  const check = () => { seen = seen || pattern.test(document.body.textContent ?? ''); };
  const observer = new MutationObserver(check);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  check();
  return () => { check(); observer.disconnect(); return seen; };
}

function addViaForm(name: string) {
  const input = screen.getByLabelText('Project Name');
  fireEvent.change(input, { target: { value: name } });
  fireEvent.keyDown(input, { key: 'Enter' });
}
function tileOf(name: string): HTMLElement {
  let el: HTMLElement | null = screen.getByLabelText(`Open releases for ${name}`);
  while (el && !el.querySelector('[aria-label="Drag to reorder project"]')) el = el.parentElement;
  return el!;
}
const tileButtons = (name: string) =>
  within(tileOf(name)).queryAllByRole('button').map((b) => b.getAttribute('aria-label')).filter((l) => /^(Share|Delete) project$/.test(l ?? ''));
const cloneViaTile = (name: string) =>
  fireEvent.click(within(tileOf(name)).getByRole('button', { name: 'Clone project' }));
function deleteViaTile(name: string) {
  fireEvent.click(within(tileOf(name)).getByRole('button', { name: 'Delete project' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
}
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
async function replaceAllWith(content: unknown) {
  importFile(content);
  fireEvent.click(await screen.findByLabelText('Replace entire workspace'));
  fireEvent.click(screen.getByRole('button', { name: 'Replace All Data' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Replace' }));
}

const renderApp = () => render(<FullWrapper><App /></FullWrapper>);

/** A cloud session whose load succeeds, quiet: listeners open, their first snapshots in, the echo save settled. */
async function openCloud() {
  localStorage.setItem(MODE_KEY, 'cloud');
  renderApp();
  await waitFor(() => expect(loads.some((ok) => ok)).toBe(true), { timeout: 5000 });
  await wait(400);
}

const revokes: { t: number; projectId: string }[] = [];
const onRevoke = (e: Event) =>
  revokes.push({ t: fake.now(), projectId: (e as CustomEvent<{ projectId: string }>).detail.projectId });

/**
 * The order a revoke achieved: the save in flight when the project was pruned
 * (captured before the prune, settled after it), and the first save captured
 * after the prune (the eviction's).
 */
function achievedOrder(projectId: string) {
  const prune = revokes.find((r) => r.projectId === projectId);
  if (!prune) return null;
  const inFlight = saves.log.find((s) => s.capturedAt < prune.t && (s.settledAt === null || s.settledAt > prune.t));
  const next = saves.log.find((s) => s.capturedAt > prune.t);
  return { prune: prune.t, inFlight, next };
}

/** The cloud service's save debounce. */
const SAVE_DEBOUNCE_MS = 200;

/**
 * The order an add's refusal timing achieved, from the app's listen requests
 * and the save log: when a listen opened at the app's first request for the new
 * project's listener is refused, against the first save after that request (its
 * capture and its settlement) and the save the eviction would queue one
 * debounce after the refusal. At base the listen opens at that request and is
 * refused; with no listener before the project's document exists, none opens
 * then, and the order is the one such a refusal would have met.
 */
function addOrder(projectId: string, denialMs: number) {
  const request = listenRequests.find((r) => r.projectId === projectId);
  if (!request) return 'no listen request';
  const refusalAt = request.t + denialMs;
  const first = saves.log.find((s) => s.capturedAt >= request.t);
  if (!first) return 'no save';
  if (refusalAt < first.capturedAt) return 'before the capture';
  if (first.settledAt === null) return 'not settled';
  if (refusalAt > first.settledAt) return 'after the acknowledgement';
  return first.settledAt < refusalAt + SAVE_DEBOUNCE_MS ? 'ordering 1' : 'ordering 2';
}

describe('a project created in a cloud session that loaded normally, end to end', () => {
  let alertSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fake.reset();
    saves.log.length = 0;
    revokes.length = 0;
    loads.length = 0;
    listenRequests.length = 0;
    probe.current = null;
    selection.current = null;
    localStorage.clear();
    localStorage.setItem('spert_tos_accepted_version', TOS_VERSION);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'prompt').mockReturnValue('Sprint 3');
    window.addEventListener('ganttapp:project-revoked', onRevoke);
    trackServices();
  });

  afterEach(() => {
    cleanup();
    services.forEach((service) => service.dispose());
    services.clear();
    window.removeEventListener('ganttapp:project-revoked', onRevoke);
    vi.restoreAllMocks();
  });

  // ---- §3.1 The new project stays and is written (N1, N2, N6, N7)

  describe('ADD1: an add, warm write stream, at each refusal timing L6 produced', () => {
    it.each([
      // Base: the listen is refused before the save's capture, so the project is never written.
      { label: 'refusal before the capture', snapshots: 'cache-first' as const, denial: 0, commit: 0, order: 'before the capture' },
      // The same with no first snapshot at all (masked).
      { label: 'refusal before the capture, no first snapshot', snapshots: 'never' as const, denial: 0, commit: 0, order: 'before the capture' },
      // Base: refused after the capture, acknowledged before the eviction's save captures (ordering 1): written, then deleted.
      { label: 'refusal in flight, ordering 1', snapshots: 'cache-first' as const, denial: 300, commit: 100, order: 'ordering 1' },
      // Base: the eviction's save captures before the acknowledgement (ordering 2): written and left in the cloud.
      // The refusal comes at 310 ms to leave room on both sides of that order: the first save captures about 210 ms
      // after the listen request (ordering 2 needs at most 310) and settles about 610 ms after it (it needs at least
      // 510, the refusal plus the debounce).
      { label: 'refusal in flight, ordering 2', snapshots: 'cache-first' as const, denial: 310, commit: 200, order: 'ordering 2' },
    ])('$label: the project is written once, stays on screen, and no listener opens before its document exists', async ({ snapshots, denial, commit, order }) => {
      // Fails under: B (each outcome above). Not under S, D, V or H. A run
      // whose timing misses its order fails at the order, before the outcome.
      seed();
      fake.config.snapshots = snapshots;
      await openCloud();
      Object.assign(fake.config, { listenerDenialMs: denial, commitDelayMs: commit });
      const errors = watchText(SYNC_ERROR);
      addViaForm('Gamma');
      const id = idOf('Gamma')!;
      await wait(1100);

      expect(addOrder(id, denial)).toBe(order);
      expect(appOps(`ganttapp_projects/${id}`)).toEqual(['set']);
      expect(onScreen()).toEqual(['Alpha', 'Beta', 'Gamma']);
      expect(earlyListens(id)).toBe(0);
      expect(errors()).toBe(false);
    });
  });

  it('ADD2: a cold write stream (a slow first write) keeps the project too', async () => {
    // Fails under: B.
    seed();
    await openCloud();
    Object.assign(fake.config, { listenerDenialMs: 500, commitDelayMs: 400 });
    const errors = watchText(SYNC_ERROR);
    addViaForm('Gamma');
    const id = idOf('Gamma')!;
    await wait(1600);

    expect(appOps(`ganttapp_projects/${id}`)).toEqual(['set']);
    expect(onScreen()).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(earlyListens(id)).toBe(0);
    expect(errors()).toBe(false);
  });

  it('ADD3: a user with no projects adds a first one', async () => {
    // Fails under: B.
    seed({ empty: true });
    await openCloud();
    const errors = watchText(SYNC_ERROR);
    addViaForm('First');
    const id = idOf('First')!;
    await wait(700);

    expect(appOps(`ganttapp_projects/${id}`)).toEqual(['set']);
    expect(onScreen()).toEqual(['First']);
    expect(earlyListens(id)).toBe(0);
    expect(errors()).toBe(false);
  });

  it('ADD4: a release added at once to the new project is written under it, and under no other', async () => {
    // Fails under: B.
    seed();
    await openCloud();
    const before = { p1: cloudReleaseIdsOf('p1'), p2: cloudReleaseIdsOf('p2') };
    const errors = watchText(SYNC_ERROR);
    addViaForm('Gamma');
    const id = idOf('Gamma')!;
    act$(() => probe.current!.addRelease(id, 'g1', 'Gamma R'));
    await wait(800);

    expect(cloudReleaseIdsOf(id)).toEqual(['g1']);
    expect({ p1: cloudReleaseIdsOf('p1'), p2: cloudReleaseIdsOf('p2') }).toEqual(before);
    expect(onScreen()).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(releaseOnScreen('g1')).toBe('Gamma R');
    expect(errors()).toBe(false);
  });

  it('CP1: a copy of a project with no snapshots is written with its releases, with no alert', async () => {
    // Fails under: B.
    seed();
    await openCloud();
    const errors = watchText(SYNC_ERROR);
    cloneViaTile('Beta');
    const id = idOf('Beta - Copy (1)')!;
    await wait(800);

    expect(appOps(`ganttapp_projects/${id}`)).toEqual(['set']);
    expect(cloudReleaseIdsOf(id)).toHaveLength(1);
    expect(onScreen()).toEqual(['Alpha', 'Beta', 'Beta - Copy (1)']);
    expect(earlyListens(id)).toBe(0);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(errors()).toBe(false);
  });

  it('CP2: a copy of a project with snapshots is written, and so are its snapshot copies, with no alert', async () => {
    // Fails under: B; S (its snapshot batch reaches the cloud before the copy,
    // and the rules refuse it: with the fake's rules off, S's removal passes here).
    seed();
    await openCloud();
    const errors = watchText(SYNC_ERROR);
    cloneViaTile('Alpha');
    const id = idOf('Alpha - Copy (1)')!;
    await wait(1000);

    expect(appOps(`ganttapp_projects/${id}`)).toEqual(['set']);
    expect(cloudSnapshotPaths().filter((p) => p.startsWith(`ganttapp_projects/${id}/`))).toHaveLength(2);
    expect(cloudSnapshotPaths().filter((p) => p.startsWith('ganttapp_projects/p1/'))).toHaveLength(2);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(onScreen()).toEqual(['Alpha', 'Alpha - Copy (1)', 'Beta']);
    expect(earlyListens(id)).toBe(0);
    expect(errors()).toBe(false);
  });

  it('MI1: a merge import adding a project with no snapshot writes it, and the banner is true', async () => {
    // Fails under: B.
    seed();
    await openCloud();
    const errors = watchText(SYNC_ERROR);
    await importAndConfirm(projectExport(IMP1, false));
    await waitFor(() => expect(bannerText()).toContain('1 project added.'));
    await wait(700);

    // In cloud mode the import has a new id, not the file's.
    const id = idOf('Imported Plan')!;
    expect(appOps(`ganttapp_projects/${id}`)).toEqual(['set']);
    expect(cloudReleaseIdsOf(id)).toEqual(releaseIdsOf(id));
    expect(releaseIdsOf(id)).toHaveLength(1);
    expect(onScreen()).toEqual(['Alpha', 'Beta', 'Imported Plan']);
    expect(earlyListens(id)).toBe(0);
    expect(errors()).toBe(false);
  });

  it('MI2: a merge import adding a project with a snapshot writes both, and the banner is true', async () => {
    // Fails under: B; S (with the rules on: measured before the commit delay was added).
    seed();
    await openCloud();
    // The import applies after an await, so its listener opens a macrotask
    // later; without a commit delay the snapshot wait's own save would have
    // written the project by then, and no removal of B could show.
    fake.config.commitDelayMs = 50;
    const errors = watchText(SYNC_ERROR);
    await importAndConfirm(projectExport(IMP1, true));
    await wait(1000);

    // In cloud mode the import and its snapshot have new ids, not the file's.
    const id = idOf('Imported Plan')!;
    expect(appOps(`ganttapp_projects/${id}`)).toEqual(['set']);
    expect(cloudSnapshotPaths().filter((p) => p.startsWith(`ganttapp_projects/${id}/`))).toHaveLength(1);
    expect(bannerText()).toContain('1 project added.');
    expect(onScreen()).toEqual(['Alpha', 'Beta', 'Imported Plan']);
    expect(errors()).toBe(false);
  });

  describe('RA: Replace All, every project owned by this user', () => {
    it.each([
      { label: 'no snapshot in the file', withSnapshot: false },
      { label: 'a snapshot in the file', withSnapshot: true },
    ])('$label: the cloud holds the import and only the import', async ({ withSnapshot }) => {
      // Fails under: B; with a snapshot in the file, S too (with the rules on).
      seed();
      await openCloud();
      const errors = watchText(SYNC_ERROR);
      await replaceAllWith(allProjectsFile([IMP1], withSnapshot));
      await wait(1000);

      // In cloud mode the import has a new id, not the file's.
      const id = idOf('Imported Plan')!;
      expect(cloudProjectIds()).toEqual([id]);
      expect(cloudReleaseIdsOf(id)).toEqual(releaseIdsOf(id));
      expect(releaseIdsOf(id)).toHaveLength(1);
      expect(onScreen()).toEqual(['Imported Plan']);
      expect(bannerText()).toContain('All data replaced. 1 project imported.');
      if (withSnapshot) expect(cloudSnapshotPaths().filter((p) => p.startsWith(`ganttapp_projects/${id}/`))).toHaveLength(1);
      expect(errors()).toBe(false);
    });
  });

  describe('MR: merge import, "Replace existing" on a name conflict, the project owned', () => {
    it.each([
      { label: 'no snapshot in the file', withSnapshot: false },
      { label: 'a snapshot in the file', withSnapshot: true },
    ])('$label: the replacement is written in the replaced project\'s place', async ({ withSnapshot }) => {
      // Fails under: B; with a snapshot in the file, S too (with the rules on);
      // the import's new ids removed (the replacement keeps the file's id).
      seed();
      await openCloud();
      fake.config.commitDelayMs = 50; // as MI2: so that the listener opens while the first save is in flight
      const errors = watchText(SYNC_ERROR);
      importFile(projectExport({ id: 'imp9', name: 'Alpha' }, withSnapshot));
      fireEvent.click(await screen.findByLabelText('Replace existing with imported'));
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Import' }));
      await wait(1000);

      // In cloud mode the replacement has a new id: neither the replaced project's nor the file's.
      const id = idOf('Alpha')!;
      expect(cloudProjectIds()).toEqual([id, 'p2'].sort());
      expect(cloudReleaseIdsOf(id)).toEqual(releaseIdsOf(id));
      expect(releaseIdsOf(id)).toHaveLength(1);
      expect(onScreen()).toEqual(['Alpha', 'Beta']);
      expect(['p1', 'imp9']).not.toContain(id);
      expect(bannerText()).toContain('1 replaced.');
      if (withSnapshot) expect(cloudSnapshotPaths().filter((p) => p.startsWith(`ganttapp_projects/${id}/`))).toHaveLength(1);
      expect(errors()).toBe(false);
    });
  });

  // ---- An import whose project the cloud already holds, under another owner

  describe('an import of a project the cloud holds under another owner, this user not a member', () => {
    // x9 "Their Plan" is u3's, and this user is no member of it, so the
    // workspace does not show it. A file of it is what u3's own export carries.
    // In cloud mode the import is saved as a new project of this user's, under
    // a new id; kept as x9, its first save would update u3's document, which the
    // rules refuse to a non-member, and every later save would carry it.
    const THEIRS = { id: 'x9', name: 'Their Plan' };
    function seedTheirs() {
      fake.state.docs.set('ganttapp_projects/x9', projectDoc('Their Plan', 0, 'u3', { u3: 'owner' }));
      fake.state.docs.set('ganttapp_projects/x9/releases/xr1', releaseDoc('Their Release', 0));
    }
    const ownership = (projectId: string) => {
      const doc = cloudDoc(`ganttapp_projects/${projectId}`);
      return { owner: doc?.owner, members: doc?.members };
    };

    it('a merge import keeps it on screen and saves it as a new project of this user\'s, with its release and snapshot; later saves succeed', async () => {
      // Fails with the import's new ids removed (the file's ids kept).
      seed();
      seedTheirs();
      await openCloud();
      const errors = watchText(SYNC_ERROR);
      await importAndConfirm(projectExport(THEIRS, true));
      await waitFor(() => expect(bannerText()).not.toBe(''));
      await wait(700);
      act$(() => probe.current!.renameRelease('r1', 'Design later'));
      await wait(600);

      expect(onScreen()).toEqual(['Alpha', 'Beta', 'Their Plan']);
      const id = idOf('Their Plan')!;
      expect(id).not.toBe('x9');
      expect(refusedCommits()).toEqual([]);
      expect(ownership(id)).toEqual({ owner: 'u1', members: { u1: 'owner' } });
      expect(releaseIdsOf(id)).toHaveLength(1);
      expect(cloudReleaseIdsOf(id)).toEqual(releaseIdsOf(id));
      expect(cloudSnapshotPaths().filter((p) => p.startsWith(`ganttapp_projects/${id}/`))).toHaveLength(1);
      expect(appWritesUnder('x9')).toEqual([]);
      expect(ownership('x9')).toEqual({ owner: 'u3', members: { u3: 'owner' } });
      expect(cloudReleaseName('p1', 'r1')).toBe('Design later');
      expect(bannerText()).toContain('1 project added.');
      expect(errors()).toBe(false);
    });

    it('a merge "Replace" on a name conflict saves the replacement as a new project of this user\'s; later saves succeed', async () => {
      // Fails with the import's new ids removed (the file's ids kept).
      seed();
      seedTheirs();
      await openCloud();
      const errors = watchText(SYNC_ERROR);
      importFile(projectExport({ id: 'x9', name: 'Alpha' }, false));
      fireEvent.click(await screen.findByLabelText('Replace existing with imported'));
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Import' }));
      await waitFor(() => expect(bannerText()).not.toBe(''));
      await wait(700);
      act$(() => probe.current!.renameRelease('r3', 'Launch later'));
      await wait(600);

      expect(onScreen()).toEqual(['Alpha', 'Beta']);
      const id = idOf('Alpha')!;
      expect(['p1', 'x9']).not.toContain(id);
      expect(refusedCommits()).toEqual([]);
      expect(cloudProjectIds()).toEqual([id, 'p2', 'x9'].sort());
      expect(ownership(id)).toEqual({ owner: 'u1', members: { u1: 'owner' } });
      expect(releaseIdsOf(id)).toHaveLength(1);
      expect(cloudReleaseIdsOf(id)).toEqual(releaseIdsOf(id));
      expect(appWritesUnder('x9')).toEqual([]);
      expect(cloudReleaseName('p2', 'r3')).toBe('Launch later');
      expect(bannerText()).toContain('1 replaced.');
      expect(errors()).toBe(false);
    });

    it('a Replace All saves it as a new project of this user\'s, and keeps the id of a project the workspace holds; later saves succeed', async () => {
      // Fails with the import's new ids removed (the file's ids kept), and when
      // the import selects its first project by the file's id, not the new one.
      seed();
      seedTheirs();
      await openCloud();
      const errors = watchText(SYNC_ERROR);
      await replaceAllWith(allProjectsFile([THEIRS, { id: 'p2', name: 'Beta' }], false));
      await waitFor(() => expect(bannerText()).not.toBe(''));
      await wait(700);
      act$(() => probe.current!.renameRelease('p2-r', 'Launch later'));
      await wait(600);

      expect(onScreen()).toEqual(['Their Plan', 'Beta']);
      const id = idOf('Their Plan')!;
      expect(id).not.toBe('x9');
      // The import selects its first project, under that project's new id.
      expect(selection.current).toBe(id);
      expect(idOf('Beta')).toBe('p2');
      expect(refusedCommits()).toEqual([]);
      expect(cloudProjectIds()).toEqual([id, 'p2', 'x9'].sort());
      expect(ownership(id)).toEqual({ owner: 'u1', members: { u1: 'owner' } });
      expect(releaseIdsOf(id)).toHaveLength(1);
      expect(cloudReleaseIdsOf(id)).toEqual(releaseIdsOf(id));
      expect(appWritesUnder('x9')).toEqual([]);
      expect(cloudReleaseName('p2', 'p2-r')).toBe('Launch later');
      expect(bannerText()).toContain('All data replaced. 2 projects imported.');
      expect(errors()).toBe(false);
    });
  });

  describe('which imported projects get new ids in cloud mode', () => {
    it('the same file imported twice, the first import renamed in between: two projects, and no two releases or snapshots share an id', async () => {
      // Fails with the import's new ids removed: the second import is then the
      // same project, so the preview asks, and its default skips it. With new
      // project ids alone, the two projects share their releases' ids.
      seed();
      await openCloud();
      const errors = watchText(SYNC_ERROR);
      await importAndConfirm(projectExport(IMP1, true));
      await waitFor(() => expect(bannerText()).toContain('1 project added.'));
      await wait(500);
      act$(() => probe.current!.renameProject(idOf('Imported Plan')!, 'First Import'));
      await wait(500);
      await importAndConfirm(projectExport(IMP1, true));
      await waitFor(() => expect(bannerText()).not.toBe(''));
      await wait(700);

      const releaseIds = probe.current!.data.releases.map((r) => r.id);
      expect({
        added: bannerText().includes('1 project added.'),
        projects: onScreen(),
        sharedReleaseIds: releaseIds.filter((id, i) => releaseIds.indexOf(id) !== i),
      }).toEqual({ added: true, projects: ['Alpha', 'Beta', 'First Import', 'Imported Plan'], sharedReleaseIds: [] });
      const first = idOf('First Import')!;
      const second = idOf('Imported Plan')!;
      const snapshotIdsUnder = (projectId: string) =>
        cloudSnapshotPaths().filter((p) => p.startsWith(`ganttapp_projects/${projectId}/`)).map((p) => p.split('/').pop());
      expect([cloudReleaseIdsOf(first), cloudReleaseIdsOf(second)]).toEqual([releaseIdsOf(first), releaseIdsOf(second)]);
      expect([snapshotIdsUnder(first).length, snapshotIdsUnder(second).length]).toEqual([1, 1]);
      expect(snapshotIdsUnder(first)).not.toEqual(snapshotIdsUnder(second));
      expect(refusedCommits()).toEqual([]);
      expect(errors()).toBe(false);
    });

    it('a project the workspace already holds keeps its id: the import asks, and "Replace" writes it in place', async () => {
      // A control: passes before and after. Fails if every imported project gets a new id.
      seed();
      await openCloud();
      const errors = watchText(SYNC_ERROR);
      importFile(projectExport({ id: 'p1', name: 'Alpha' }, false));
      expect(await screen.findByText('Already exists — same project')).toBeTruthy();
      fireEvent.click(screen.getByLabelText('Replace existing with imported'));
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Import' }));
      await waitFor(() => expect(bannerText()).toContain('1 replaced.'));
      await wait(700);

      expect(idOf('Alpha')).toBe('p1');
      expect(releaseIdsOf('p1')).toEqual(['p1-r']);
      expect(cloudProjectIds()).toEqual(['p1', 'p2']);
      expect(cloudReleaseIdsOf('p1')).toEqual(['p1-r']);
      expect(cloudDoc('ganttapp_projects/p1')?.owner).toBe('u1');
      expect(refusedCommits()).toEqual([]);
      expect(errors()).toBe(false);
    });
  });

  it('N6: the new project\'s one listener opens once its document exists, stays open, and brings a remote change to the screen', async () => {
    // Fails under: B.
    seed();
    await openCloud();
    addViaForm('Gamma');
    const id = idOf('Gamma')!;
    await wait(700);
    const firstWrite = fake.state.writes.find((w) => w.path === `ganttapp_projects/${id}`)!;
    const listens = fake.state.listens.filter((l) => l.project === `ganttapp_projects/${id}`);

    expect(listens.map((l) => ({ existed: l.existed, live: l.live }))).toEqual([{ existed: true, live: true }]);
    expect(listens[0].openedAt).toBeGreaterThanOrEqual(firstWrite.t);

    act$(() => fake.push(`ganttapp_projects/${id}/releases/remote1`, releaseDoc('From another device', 0)));
    await wait(50);
    expect(releaseOnScreen('remote1')).toBe('From another device');
  });

  it('L: after a second add, one open listener per project', async () => {
    // Not red at base: there the new projects vanish, so each listener left open
    // is one per project. It fails under a deferral whose unsubscribe only
    // cancels the deferral (wrong-U), which leaves a started listener open.
    seed();
    await openCloud();
    addViaForm('Gamma');
    await wait(600);
    addViaForm('Delta');
    await wait(600);

    const ids = probe.current!.data.projects.map((p) => p.id);
    expect(liveListens()).toEqual(Object.fromEntries(ids.map((id) => [id, 1])));
  });

  // ---- §3.2 A revoke, or a deletion elsewhere (N4, N5), in both of F14's forms

  describe.each(['open', 'next'] as const)('revokes, F14 form "%s"', (form) => {
    /** Revoke p3 (or delete p2), and in the 'next' form push a change so the listener hears of it. */
    function revokeNow(projectId: string, how: 'remove' | 'delete') {
      fake.revoke(projectId, how);
      if (form === 'next') {
        fake.push(`ganttapp_projects/${projectId}/releases/pushed`, releaseDoc('Pushed', 9));
      }
    }
    /** The same, `afterMs` after the next commit starts: timed off the fake, not off the test's waits. */
    function revokeDuringNextCommit(projectId: string, how: 'remove' | 'delete', afterMs: number) {
      let armed = true;
      fake.config.onCommit = () => {
        if (!armed) return;
        armed = false;
        setTimeout(() => revokeNow(projectId, how), afterMs);
      };
    }

    it('RV1: a revoke with no save in flight evicts the project, and later saves succeed', async () => {
      // A control: passes before and after.
      fake.config.f14 = form;
      seed({ editor: true });
      await openCloud();
      act$(() => revokeNow('p3', 'remove'));
      await wait(500);
      expect(onScreen()).toEqual(['Alpha', 'Beta']);

      act$(() => probe.current!.renameRelease('r3', 'Launch v2'));
      await wait(500);
      expect(cloudReleaseName('p2', 'r3')).toBe('Launch v2');
      expect(syncErrorNow()).toBeNull();
    });

    it('RV2: a revoke during an in-flight save, ordering 1: later saves still succeed', async () => {
      // Fails under: D (its acknowledgement filter), with the rules on or off:
      // the write log shows the delete. Asserts the order it achieved: the prune
      // inside the in-flight save, whose acknowledgement lands before the next capture.
      fake.config.f14 = form;
      seed({ editor: true });
      await openCloud();
      fake.config.commitDelayMs = 150;
      revokeDuringNextCommit('p3', 'remove', 50);
      act$(() => probe.current!.renameRelease('r1', 'Design v2'));
      await wait(800);

      const order = achievedOrder('p3');
      expect(order?.inFlight?.ok).toBe(true);
      expect(order!.inFlight!.settledAt!).toBeLessThan(order!.next!.capturedAt);

      act$(() => probe.current!.renameRelease('r3', 'Launch v2'));
      await wait(600);
      // The app never deletes the pruned project (with the rules off, that delete would succeed).
      expect(appOps('ganttapp_projects/p3')).not.toContain('delete');
      expect(cloudReleaseName('p2', 'r3')).toBe('Launch v2');
      expect(syncErrorNow()).toBeNull();
      expect(onScreen()).toEqual(['Alpha', 'Beta']);
    });

    it('RV3: the same, ordering 2 (the next save captures first and is acknowledged last): it heals', async () => {
      // A control: passes before and after.
      fake.config.f14 = form;
      seed({ editor: true });
      await openCloud();
      fake.config.commitDelayMs = 300;
      revokeDuringNextCommit('p3', 'remove', 50);
      act$(() => probe.current!.renameRelease('r1', 'Design v2'));
      await wait(1000);

      const order = achievedOrder('p3');
      expect(order?.inFlight?.ok).toBe(true);
      expect(order!.next!.capturedAt).toBeLessThan(order!.inFlight!.settledAt!);
      expect(order!.next!.settledAt!).toBeGreaterThan(order!.inFlight!.settledAt!);

      act$(() => probe.current!.renameRelease('r3', 'Launch v2'));
      await wait(700);
      expect(cloudReleaseName('p2', 'r3')).toBe('Launch v2');
      expect(syncErrorNow()).toBeNull();
    });

    it('RV4: this user\'s project deleted on another device during an in-flight save: later saves still succeed', async () => {
      // Fails under: D (its acknowledgement filter), with the rules on or off.
      fake.config.f14 = form;
      seed();
      await openCloud();
      fake.config.commitDelayMs = 150;
      revokeDuringNextCommit('p2', 'delete', 50);
      act$(() => probe.current!.renameRelease('r1', 'Design v2'));
      await wait(800);

      const order = achievedOrder('p2');
      expect(order?.inFlight?.ok).toBe(true);
      expect(order!.inFlight!.settledAt!).toBeLessThan(order!.next!.capturedAt);

      act$(() => probe.current!.renameRelease('r2', 'Build v2'));
      await wait(600);
      expect(appOps('ganttapp_projects/p2')).not.toContain('delete');
      expect(cloudReleaseName('p1', 'r2')).toBe('Build v2');
      expect(syncErrorNow()).toBeNull();
      expect(onScreen()).toEqual(['Alpha']);
    });

    it.each([
      { label: 'revoked', projectId: 'p3', releaseId: 'r5', how: 'remove' as const },
      { label: 'deleted elsewhere', projectId: 'p2', releaseId: 'r3', how: 'delete' as const },
    ])('RV5 ($label): a save in flight fails after the eviction\'s save captured; the unload does not bring the project back', async ({ projectId, releaseId, how }) => {
      // Fails under: D's re-queue filter. Needs the rules: without them save A
      // never fails, so the chain cannot form. Red at base only through this chain:
      // save A in flight; the eviction's save B captured; A fails and queues its
      // data again; an unload sends it before any edit.
      fake.config.f14 = form;
      seed({ editor: true });
      await openCloud();
      fake.config.commitDelayMs = 400;
      revokeDuringNextCommit(projectId, how, 50);
      act$(() => probe.current!.renameRelease(releaseId, 'Mine'));
      await wait(1000);
      fake.config.onCommit = null;

      const order = achievedOrder(projectId);
      expect(order?.inFlight?.ok).toBe(false);
      expect(order!.next!.capturedAt).toBeLessThan(order!.inFlight!.settledAt!);
      const before = fake.state.commits.length;

      act$(() => { window.dispatchEvent(new Event('pagehide')); });
      await wait(700);

      const after = fake.state.commits.slice(before);
      expect(after.filter((c) => c.ok === false)).toEqual([]);
      if (how === 'delete') expect(cloudDoc(`ganttapp_projects/${projectId}`)).toBeUndefined();
      expect(syncErrorNow()).toBeNull();
    });
  });

  // ---- §3.3 The unsent-changes guard (R46)

  describe('H1: an edit in a just-copied project, after its first save\'s capture and before its listener\'s first snapshot', () => {
    it.each(['cache-first', 'never'] as const)('first snapshot "%s": the edit stays and is saved', async (snapshots) => {
      // Reachable only once B is in (at base the copy vanishes first). Fails
      // under: B (the copy vanishes); H, with a cached first snapshot only. With
      // none, H's removal passes (a control).
      fake.config.snapshots = snapshots;
      seed();
      await openCloud();
      fake.config.commitDelayMs = 100;
      cloneViaTile('Beta');
      const id = idOf('Beta - Copy (1)')!;
      const releaseId = probe.current!.data.releases.find((r) => r.projectId === id)!.id;
      // 20 ms into the copy's phase 1: after its first save's capture, before its acknowledgement.
      fake.config.onCommit = (paths) => {
        if (paths[0] !== `ganttapp_projects/${id}`) return;
        fake.config.onCommit = null;
        setTimeout(() => probe.current!.renameRelease(releaseId, 'Renamed in the copy'), 20);
      };
      await wait(1100);

      expect(releaseOnScreen(releaseId)).toBe('Renamed in the copy');
      expect(cloudReleaseName(id, releaseId)).toBe('Renamed in the copy');
    });
  });

  it('H2: a release edit, then an add within the debounce: the re-subscription\'s cached snapshot does not undo it', async () => {
    // Fails under: H.
    seed();
    await openCloud();
    act$(() => probe.current!.renameRelease('r1', 'Design v2'));
    addViaForm('Gamma');
    await wait(900);

    expect(releaseOnScreen('r1')).toBe('Design v2');
    expect(cloudReleaseName('p1', 'r1')).toBe('Design v2');
  });

  it('HW (phase 1) / H2 (B6): a remote change lands during phase 1 of the save that holds the edit; the edit stays and is saved', async () => {
    // Fails under: H's in-flight part. The add comes first and the edit ~45 ms
    // later, so one save holds both; another device changes r2 during phase 1.
    // The new project's listen is refused late at base, so phase 1 runs there too.
    seed();
    await openCloud();
    Object.assign(fake.config, { listenerDenialMs: 5000, commitDelayMs: 200 });
    let pushed = false;
    fake.config.onCommit = (paths) => {
      if (!pushed && paths.length === 1 && /^ganttapp_projects\/[^/]+$/.test(paths[0])) {
        pushed = true;
        setTimeout(() => fake.push('ganttapp_projects/p1/releases/r2', releaseDoc('Build (remote)', 1)), 50);
      }
    };
    addViaForm('Gamma');
    await wait(45);
    act$(() => probe.current!.renameRelease('r1', 'Design v2'));
    await wait(1200);
    // One more save, so that whatever the baseline holds is compared once more.
    act$(() => probe.current!.renameRelease('r3', 'Launch v2'));
    await wait(700);

    expect(pushed).toBe(true);
    expect(releaseOnScreen('r1')).toBe('Design v2');
    expect(cloudReleaseName('p1', 'r1')).toBe('Design v2');
    expect(cloudReleaseName('p1', 'r2')).toBe('Build (remote)');
  });

  it('HW (read): a remote change lands during the save\'s read of the project document; the edit stays and is saved', async () => {
    // Fails under: H's in-flight part. The project and a release are renamed in
    // one save, which reads p1's document first (executor :130).
    seed();
    await openCloud();
    fake.config.readDelayMs = 100;
    let pushed = false;
    fake.config.onRead = (path) => {
      if (!pushed && path === 'ganttapp_projects/p1') {
        pushed = true;
        setTimeout(() => fake.push('ganttapp_projects/p1/releases/r2', releaseDoc('Build (remote)', 1)), 20);
      }
    };
    act$(() => probe.current!.renameProjectAndRelease('p1', 'Alpha v2', 'r1', 'Design v2'));
    await wait(900);
    fake.config.onRead = null;
    act$(() => probe.current!.renameRelease('r3', 'Launch v2'));
    await wait(700);

    expect(pushed).toBe(true);
    expect(releaseOnScreen('r1')).toBe('Design v2');
    expect(cloudReleaseName('p1', 'r1')).toBe('Design v2');
  });

  it('HW (R48\'s read): a remote change lands during the role read of a shared project; the edit stays and is saved', async () => {
    // Only on the fix: at base a release-only save reads nothing. Fails under:
    // H's in-flight part.
    seed({ editor: true });
    await openCloud();
    fake.config.readDelayMs = 100;
    let pushed = false;
    fake.config.onRead = (path) => {
      if (!pushed && path === 'ganttapp_projects/p3') {
        pushed = true;
        setTimeout(() => fake.push('ganttapp_projects/p3/releases/r6', releaseDoc('Editor R2 (remote)', 1)), 20);
      }
    };
    act$(() => probe.current!.renameRelease('r5', 'Editor R v2'));
    await wait(900);
    fake.config.onRead = null;
    act$(() => probe.current!.renameRelease('r3', 'Launch v2'));
    await wait(700);

    expect(releaseOnScreen('r5')).toBe('Editor R v2');
    expect(cloudReleaseName('p3', 'r5')).toBe('Editor R v2');
  });

  it('HE: two remote changes to a project within the debounce both reach the screen, and the echo reverts neither', async () => {
    // Passes at base. Fails under wrong-H (the pending save compared with the
    // baseline alone), and under H's comparison removed.
    seed({ editor: true });
    await openCloud();
    act$(() => fake.push('ganttapp_projects/p3/releases/r5', releaseDoc('Editor R v2', 0)));
    await wait(100);
    act$(() => fake.push('ganttapp_projects/p3/releases/r5', releaseDoc('Editor R v3', 0)));
    await wait(800);

    expect(releaseOnScreen('r5')).toBe('Editor R v3');
    expect(cloudReleaseName('p3', 'r5')).toBe('Editor R v3');
  });

  it('HS: an acknowledged edit is not unsent: a remote change arriving while another save is pending is delivered', async () => {
    // Passes at base. Fails under a comparison with "last delivered" alone.
    seed();
    await openCloud();
    act$(() => probe.current!.renameRelease('r1', 'Design v2'));
    await wait(500);
    expect(cloudReleaseName('p1', 'r1')).toBe('Design v2');
    act$(() => probe.current!.renameProject('p2', 'Beta v2'));
    await wait(20);
    act$(() => fake.push('ganttapp_projects/p1/releases/r2', releaseDoc('Build (remote)', 1)));
    await wait(50);

    expect(releaseOnScreen('r2')).toBe('Build (remote)');
  });

  describe('H3: a remote change while this user\'s edit is unsent', () => {
    it('to another release: the edit is saved, and the remote change stays in the cloud', async () => {
      // Fails under: H.
      seed();
      await openCloud();
      act$(() => probe.current!.renameRelease('r1', 'Design v2'));
      await wait(50);
      act$(() => fake.push('ganttapp_projects/p1/releases/r2', releaseDoc('Build (remote)', 1)));
      await wait(700);

      expect(releaseOnScreen('r1')).toBe('Design v2');
      expect(cloudReleaseName('p1', 'r1')).toBe('Design v2');
      expect(cloudReleaseName('p1', 'r2')).toBe('Build (remote)');
    });

    it('to the same release: this user\'s save overwrites it (the cost R46 accepts)', async () => {
      // Fails under: H. Documents H's cost: the unsent edit wins.
      seed();
      await openCloud();
      act$(() => probe.current!.renameRelease('r1', 'Design v2'));
      await wait(50);
      act$(() => fake.push('ganttapp_projects/p1/releases/r1', releaseDoc('Design (remote)', 0)));
      await wait(700);

      expect(releaseOnScreen('r1')).toBe('Design v2');
      expect(cloudReleaseName('p1', 'r1')).toBe('Design v2');
    });
  });

  it('H0: a release added to a new, empty project during its first save is kept (the first-snapshot guard)', async () => {
    // A control: passes before (the listen is refused late here) and after, and
    // with H removed: the first-snapshot guard keeps it.
    seed();
    await openCloud();
    Object.assign(fake.config, { listenerDenialMs: 5000, commitDelayMs: 100 });
    addViaForm('Gamma');
    const id = idOf('Gamma')!;
    fake.config.onCommit = (paths) => {
      if (paths[0] !== `ganttapp_projects/${id}`) return;
      fake.config.onCommit = null;
      setTimeout(() => probe.current!.addRelease(id, 'g1', 'Gamma R'), 20);
    };
    await wait(1100);

    expect(releaseOnScreen('g1')).toBe('Gamma R');
    expect(cloudReleaseIdsOf(id)).toEqual(['g1']);
  });

  // ---- §3.4 The viewer guard (R45, R48), and R53's message

  it('VW1: deleting a project listed above a viewer\'s project: the delete is saved, and later saves succeed', async () => {
    // Fails under: V's project-document part.
    seed({ editor: true, viewer: true });
    await openCloud();
    const viewerMessage = watchText(/You can only view/);
    deleteViaTile('Alpha');
    await wait(600);
    act$(() => probe.current!.renameRelease('r3', 'Launch v2'));
    await wait(600);

    expect(cloudDoc('ganttapp_projects/p1')).toBeUndefined();
    expect(cloudReleaseName('p2', 'r3')).toBe('Launch v2');
    expect(cloudDoc('ganttapp_projects/p4')?.order).toBe(3);
    expect(syncErrorNow()).toBeNull();
    expect(viewerMessage()).toBe(false);
  });

  it('VW2: moving a viewer\'s project: later saves succeed', async () => {
    // Fails under: V's project-document part.
    seed({ editor: true, viewer: true });
    await openCloud();
    const viewerMessage = watchText(/You can only view/);
    act$(() => probe.current!.moveToTop('p4'));
    await wait(600);
    act$(() => probe.current!.renameRelease('r3', 'Launch v2'));
    await wait(600);

    expect(cloudReleaseName('p2', 'r3')).toBe('Launch v2');
    expect(syncErrorNow()).toBeNull();
    expect(viewerMessage()).toBe(false);
  });

  it('VW3: copying a project listed above a viewer\'s project: the copy is written, and later saves succeed', async () => {
    // Reachable only once B is in (at base the copy vanishes first). Fails
    // under: V's project-document part; B (the copy vanishes).
    seed({ editor: true, viewer: true });
    await openCloud();
    cloneViaTile('Beta');
    const id = idOf('Beta - Copy (1)')!;
    await wait(800);
    act$(() => probe.current!.renameRelease('r3', 'Launch v2'));
    await wait(600);

    expect(onScreen()).toContain('Beta - Copy (1)');
    expect(cloudReleaseIdsOf(id)).toHaveLength(1);
    expect(cloudReleaseName('p2', 'r3')).toBe('Launch v2');
    expect(syncErrorNow()).toBeNull();
  });

  describe('DL (R50): Delete is shown only to a project\'s owner in cloud mode, as Share is', () => {
    it.each([
      { label: 'an editor', name: 'Editor Plan', expected: [] as string[] },
      { label: 'a viewer', name: 'Viewer Plan', expected: [] as string[] },
      // A control: passes before and after.
      { label: 'the owner', name: 'Alpha', expected: ['Share project', 'Delete project'] },
    ])('$label of a project sees $expected', async ({ name, expected }) => {
      // The editor's and the viewer's fail under: R50. (The local-mode control
      // is in R54's local test: every tile shows Delete there.)
      seed({ editor: true, viewer: true });
      await openCloud();

      expect(tileButtons(name)).toEqual(expected);
    });
  });

  describe('VW4 (R48): the owner changes a release of a project this user only views', () => {
    it.each([
      { label: 'changes it', path: 'ganttapp_projects/p4/releases/r4', data: releaseDoc('Viewer R v2', 0) },
      { label: 'deletes it', path: 'ganttapp_projects/p4/releases/r4', data: null },
      { label: 'adds one', path: 'ganttapp_projects/p4/releases/r4b', data: releaseDoc('Viewer R2', 1) },
    ])('$label: nothing is written back, later saves succeed, and no message shows', async ({ path, data }) => {
      // Fails under: V's release part (sets for the change and the add, deletes for the delete).
      seed({ editor: true, viewer: true });
      await openCloud();
      const viewerMessage = watchText(/You can only view/);
      const mark = fake.state.writes.length;
      act$(() => fake.push(path, data));
      await wait(600);
      act$(() => probe.current!.renameRelease('r3', 'Launch v2'));
      await wait(600);

      expect(fake.state.commits.filter((c) => c.ok === false)).toEqual([]);
      expect(fake.state.writes.slice(mark).filter((w) => w.by === 'app' && w.path.startsWith('ganttapp_projects/p4'))).toEqual([]);
      expect(cloudReleaseName('p2', 'r3')).toBe('Launch v2');
      expect(syncErrorNow()).toBeNull();
      expect(viewerMessage()).toBe(false);
    });
  });

  describe('R53: a viewer whose own change is not saved is told so', () => {
    it('for a release of the viewer\'s project', async () => {
      // Exists only with the fix. Fails under: R53's report; V's release part
      // (the write is made and refused, so nothing is skipped or reported).
      seed({ viewer: true });
      await openCloud();
      act$(() => probe.current!.renameRelease('r4', 'Viewer R mine'));
      await wait(600);

      expect(syncErrorNow()).toBe(VIEWER_NOT_SAVED_SHOWN);
      expect(cloudReleaseName('p4', 'r4')).toBe('Viewer R');
    });

    it('for the viewer\'s project\'s name', async () => {
      // Exists only with the fix. Fails under: R53's report; V's project-document part.
      seed({ viewer: true });
      await openCloud();
      act$(() => probe.current!.renameProject('p4', 'Viewer Plan mine'));
      await wait(600);

      expect(syncErrorNow()).toBe(VIEWER_NOT_SAVED_SHOWN);
      expect(cloudDoc('ganttapp_projects/p4')?.name).toBe('Viewer Plan');
    });

    it('not for an editor\'s change, which is saved', async () => {
      // A control.
      seed({ editor: true, viewer: true });
      await openCloud();
      const viewerMessage = watchText(/You can only view/);
      act$(() => probe.current!.renameRelease('r5', 'Editor R v2'));
      await wait(600);

      expect(cloudReleaseName('p3', 'r5')).toBe('Editor R v2');
      expect(viewerMessage()).toBe(false);
      expect(syncErrorNow()).toBeNull();
    });

    it('and the next successful save clears it', async () => {
      // Exists only with the fix. Fails under: R53's report; V's release part.
      seed({ viewer: true });
      await openCloud();
      act$(() => probe.current!.renameRelease('r4', 'Viewer R mine'));
      await wait(600);
      expect(syncErrorNow()).toBe(VIEWER_NOT_SAVED_SHOWN);

      act$(() => probe.current!.renameRelease('r3', 'Launch v2'));
      await wait(600);
      expect(cloudReleaseName('p2', 'r3')).toBe('Launch v2');
      expect(syncErrorNow()).toBeNull();
    });
  });

  // ---- R54: an import records its projects' owners, so R50's gate shows Delete

  describe('R54 and R50: what a tile offers after an import, before any reload', () => {
    it('a merge import\'s new project shows Delete and Share', async () => {
      // Fails under: R54 (R50's gate then hides Delete); B (the project vanishes, as at base).
      seed();
      await openCloud();
      await importAndConfirm(projectExport(IMP1, false));
      await wait(800);

      expect(onScreen()).toContain('Imported Plan');
      expect(tileButtons('Imported Plan')).toEqual(['Share project', 'Delete project']);
    });

    it('a merge import\'s copy shows Delete and Share', async () => {
      // Fails under: R54; B (the copy vanishes, as at base).
      seed();
      await openCloud();
      importFile(projectExport({ id: 'imp1', name: 'Alpha' }, false));
      fireEvent.click(await screen.findByRole('button', { name: 'Confirm Import' }));
      await wait(800);

      expect(onScreen()).toContain('Alpha (2)');
      expect(tileButtons('Alpha (2)')).toEqual(['Share project', 'Delete project']);
    });

    it('a Replace All\'s project shows Delete and Share', async () => {
      // Fails under: R54; B (the project vanishes, as at base).
      seed();
      await openCloud();
      await replaceAllWith(allProjectsFile([IMP1], false));
      await wait(800);

      expect(onScreen()).toEqual(['Imported Plan']);
      expect(tileButtons('Imported Plan')).toEqual(['Share project', 'Delete project']);
    });

    it('a Replace All keeps the owner of a project the workspace has as shared, so its tile shows no Delete', async () => {
      // Fails under: R50 (the shared tiles show Delete, as at base); R54 (the
      // imported tile shows neither button); B (the import vanishes). By reading,
      // also under an R54 that gives every imported project this user.
      seed({ editor: true, viewer: true });
      await openCloud();
      await replaceAllWith(allProjectsFile([{ id: 'p3', name: 'Editor Plan' }, { id: 'p4', name: 'Viewer Plan' }, IMP1], false));
      await wait(800);

      expect(onScreen()).toEqual(['Editor Plan', 'Viewer Plan', 'Imported Plan']);
      expect(tileButtons('Editor Plan')).toEqual([]);
      expect(tileButtons('Viewer Plan')).toEqual([]);
      expect(tileButtons('Imported Plan')).toEqual(['Share project', 'Delete project']);
    });

    it('in local mode an import sets no owner, and every tile shows Delete', async () => {
      // A control: passes before and after.
      localStorage.setItem('ganttAppData', JSON.stringify({ projects: [{ id: 'p1', name: 'Alpha', owner: 'u3' }], releases: [] }));
      renderApp();
      await waitFor(() => expect(onScreen()).toEqual(['Alpha']));
      importFile(projectExport(IMP1, false));
      await wait(500);

      expect(onScreen()).toEqual(['Alpha', 'Imported Plan']);
      expect(tileButtons('Alpha')).toEqual(['Delete project']);
      expect(tileButtons('Imported Plan')).toEqual(['Delete project']);
      const stored = JSON.parse(localStorage.getItem('ganttAppData')!) as AppData;
      expect(stored.projects.find((p) => p.id === 'imp1')?.owner).toBeUndefined();
    });
  });

  // ---- R52's texts: what the user is told when a project's own first save failed (a-c), and
  // when the snapshot step is refused to a viewer of a project with snapshots (d)

  describe('texts', () => {
    it('(a) a copy whose own first save failed: the alert says the copy was not saved', async () => {
      // Reachable once B and S are in. Fails under: the copy's catch branch for
      // S's error; S; B.
      seed();
      await openCloud();
      fake.config.failCommits = fake.unavailable();
      cloneViaTile('Alpha');
      await wait(900);

      expect(alertSpy.mock.calls).toEqual([[CLONE_NOT_SAVED]]);
      expect(onScreen()).toContain('Alpha - Copy (1)');
      expect(cloudSnapshotPaths()).toEqual(['ganttapp_projects/p1/snapshots/s1', 'ganttapp_projects/p1/snapshots/s2']);
    });

    it('(b) a merge import whose project\'s first save failed, the file carrying a snapshot', async () => {
      // Reachable once B and S are in. Fails under: the import's catch branch
      // for S's error; S; B.
      seed();
      await openCloud();
      fake.config.failCommits = fake.unavailable();
      await importAndConfirm(projectExport(IMP1, true));
      await wait(900);

      expect(bannerText()).toContain(MERGE_NOT_SAVED);
      expect(onScreen()).toContain('Imported Plan');
    });

    it('(b) a Replace All whose projects\' first save failed, the file carrying a snapshot', async () => {
      // Reachable once B and S are in. Fails under: the import's catch branch
      // for S's error; S.
      seed();
      await openCloud();
      fake.config.failCommits = fake.unavailable();
      await replaceAllWith(allProjectsFile([IMP1], true));
      await wait(900);

      expect(bannerText()).toContain(REPLACE_ALL_NOT_SAVED);
      expect(cloudSnapshotPaths()).toEqual(['ganttapp_projects/p1/snapshots/s1', 'ganttapp_projects/p1/snapshots/s2']);
    });

    it('(c) a snapshot of a project whose first save failed', async () => {
      // Reachable once B and S are in. Fails under: the snapshot catch's branch
      // for S's error; S; B.
      seed();
      await openCloud();
      fake.config.failCommits = fake.unavailable();
      addViaForm('Gamma');
      await wait(50);
      await act(async () => { await probe.current!.saveSnapshotOfNewest(); });
      await wait(300);

      expect(alertSpy.mock.calls).toEqual([[SNAPSHOT_NOT_SAVED]]);
    });

    it('(d) a copy by a viewer of a project with snapshots: the copy is saved; the alert drops the false permission sentence', async () => {
      // Fails at base (that sentence). Fails under: its branch for the rules'
      // refusal; V's project-document part (the copy's own save is refused, so
      // text (a) shows). Needs the rules. The refusal itself stays (routed).
      seed({ viewer: true, viewerSnapshot: true });
      await openCloud();
      cloneViaTile('Alpha');
      const id = idOf('Alpha - Copy (1)')!;
      await wait(1000);

      expect(alertSpy.mock.calls).toEqual([[CLONE_SNAPSHOTS_REFUSED]]);
      expect(appOps(`ganttapp_projects/${id}`)).toEqual(['set']);
    });

    it('(d) a merge import by such a viewer: the banner says the projects were imported and the snapshots were not', async () => {
      // Fails at base: the banner there is the bare permission error. Fails
      // under: its branch for the rules' refusal; B (the import vanishes). Needs the rules.
      seed({ viewer: true, viewerSnapshot: true });
      await openCloud();
      await importAndConfirm(projectExport(IMP1, false));
      await wait(1000);

      expect(bannerText()).toContain(IMPORT_SNAPSHOTS_REFUSED);
      expect(appOps(`ganttapp_projects/${idOf('Imported Plan')}`)).toEqual(['set']);
    });

    it('(d) a Replace All by such a viewer, keeping the viewer\'s project: the same banner', async () => {
      // Fails at base: the banner there is the bare permission error. Fails
      // under: its branch for the rules' refusal. Needs the rules.
      seed({ viewer: true, viewerSnapshot: true });
      await openCloud();
      await replaceAllWith(allProjectsFile([{ id: 'p4', name: 'Viewer Plan' }, IMP1], false));
      await wait(1000);

      expect(bannerText()).toContain(IMPORT_SNAPSHOTS_REFUSED);
    });

    it('any other error from a copy\'s snapshot step keeps today\'s text and its reason', async () => {
      // A control: passes before and after.
      seed();
      await openCloud();
      fake.config.failWhen = (paths) => (paths.some((p) => p.includes('/snapshots/')) ? fake.unavailable() : null);
      cloneViaTile('Alpha');
      await wait(1000);

      expect(alertSpy.mock.calls).toEqual([[CLONE_SNAPSHOTS_UNAVAILABLE]]);
    });
  });

  // ---- §3.5 Local mode, unchanged

  describe('local mode, unchanged', () => {
    const LOCAL = {
      projects: [{ id: 'p1', name: 'Alpha' }, { id: 'p2', name: 'Beta' }],
      releases: [{ id: 'r1', projectId: 'p1', name: 'Design', startDate: '2026-02-02', earlyFinishDate: '2026-03-02', lateFinishDate: '2026-04-01' }],
    };
    const stored = () => JSON.parse(localStorage.getItem('ganttAppData') ?? '{"projects":[]}') as AppData;
    async function openLocal() {
      localStorage.setItem('ganttAppData', JSON.stringify(LOCAL));
      renderApp();
      await waitFor(() => expect(onScreen()).toEqual(['Alpha', 'Beta']));
    }

    it('an add stays and is stored', async () => {
      await openLocal();
      addViaForm('Gamma');
      await wait(300);
      expect(onScreen()).toEqual(['Alpha', 'Beta', 'Gamma']);
      expect(stored().projects.map((p) => p.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
    });

    it('a copy stays and is stored', async () => {
      await openLocal();
      cloneViaTile('Alpha');
      await wait(300);
      expect(onScreen()).toEqual(['Alpha', 'Alpha - Copy (1)', 'Beta']);
      expect(stored().projects.map((p) => p.name)).toEqual(['Alpha', 'Alpha - Copy (1)', 'Beta']);
    });

    it('an import stays and is stored', async () => {
      await openLocal();
      importFile(projectExport(IMP1, false));
      await wait(500);
      expect(onScreen()).toEqual(['Alpha', 'Beta', 'Imported Plan']);
      expect(stored().projects.map((p) => p.name)).toEqual(['Alpha', 'Beta', 'Imported Plan']);
    });

    it('an import keeps the file\'s ids', async () => {
      // A control: passes before and after. Fails if local mode gives an import new ids.
      await openLocal();
      importFile(projectExport(IMP1, true));
      await wait(500);
      expect(idOf('Imported Plan')).toBe('imp1');
      expect(releaseIdsOf('imp1')).toEqual(['imp1-r']);
      expect(stored().projects.map((p) => p.id)).toEqual(['p1', 'p2', 'imp1']);
      const storedSnapshots = JSON.parse(localStorage.getItem('ganttAppSnapshots') ?? '[]') as { id: string; projectId: string }[];
      expect(storedSnapshots.map((s) => [s.id, s.projectId])).toEqual([['imp1-s', 'imp1']]);
    });
  });
});
