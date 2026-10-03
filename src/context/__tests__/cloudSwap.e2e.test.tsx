// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// End to end: what reaches the cloud when the app swaps to a new cloud storage
// service — on page load in cloud mode, on the Cloud radio in Settings, and on
// the upload prompt — before, during and after that service's first load.
//
// Nothing of the app is mocked: the auth, storage and app-data providers, the
// cloud service, its save executor and the Settings tab are all real. Only
// firebase/* (an in-memory Firestore with a write log, and a signed-in user)
// and lib/firebase are replaced. Real timers throughout; time is advanced in
// 5 ms act() chunks so no single act() spans a render that matters.
// cloudSwap2.e2e.test.tsx continues this file with the same fake and probes.
//
// The two fixes these tests separate:
// - "the context guard": the app-data context sends no save, updateData save
//   or listener to a storage until a load from that storage has been applied;
// - "the service guard": the cloud service refuses saves until one of its own
//   loads has succeeded, and says so in Settings when the first one fails.
// Each test's comment names the removal(s) it is expected to fail under.
//
// Masked runs: when the first real-time snapshot comes from the cache, its
// save replaces the early one before it is written, so nothing is damaged even
// unfixed. Those tests assert at the queue — the new service's saveAppData must
// not be called before its own loadAppData has resolved — never on the writes.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { AppData } from '../../shared/types/app';

const fake = vi.hoisted(() => {
  type Data = Record<string, unknown>;
  type Write = { op: 'set' | 'delete'; path: string; data?: Data };
  type Constraint = { field: string; op: string; value: unknown };
  type Query = { path: string; constraints?: Constraint[] };
  const config = {
    readDelayMs: 5,
    commitDelayMs: 0,
    /** A read of the settings document is denied: this is how a cloud load fails. */
    denySettingsRead: false,
    /** The production rule: a read of a project document that does not exist is denied. */
    denyMissingProjectGet: true,
    /** 'cache-first': each listener fires once from the cache ~5 ms after it opens. */
    snapshots: 'never' as 'never' | 'cache-first',
    /** The next N reads fail with 'unavailable'. */
    failReads: 0,
    /** How long the server takes to deny a listener on a project the user cannot read. */
    listenerDenialMs: 0,
  };
  const state = { epoch: 0, docs: new Map<string, Data>(), writes: [] as Write[], signedIn: true };
  const coded = (code: string) => Object.assign(new Error(`fake ${code}`), { code });
  /** Runs `work` after `ms` of real time, unless a later test has reset the store. */
  const later = <T,>(ms: number, work: () => T) => {
    const epoch = state.epoch;
    return new Promise<T>((resolve, reject) => {
      setTimeout(() => {
        if (epoch !== state.epoch) return;
        try { resolve(work()); } catch (err) { reject(err); }
      }, ms);
    });
  };
  const failIfArmed = () => {
    if (config.failReads <= 0) return;
    config.failReads--;
    throw coded('unavailable');
  };
  const field = (data: Data, path: string) =>
    path.split('.').reduce<unknown>((obj, key) => (obj as Data | undefined)?.[key], data);
  const matches = (data: Data, c: Constraint) =>
    (c.op === 'in' ? (c.value as unknown[]).includes(field(data, c.field)) : field(data, c.field) === c.value);
  const snapshotOf = (path: string) => ({
    id: path.split('/').pop()!, ref: { path }, data: () => structuredClone(state.docs.get(path)),
  });
  const childrenOf = (q: Query) => {
    const depth = q.path.split('/').length + 1;
    return Array.from(state.docs.keys())
      .filter((p) => p.startsWith(`${q.path}/`) && p.split('/').length === depth)
      .filter((p) => (q.constraints ?? []).every((c) => matches(state.docs.get(p)!, c)))
      .map(snapshotOf);
  };
  const readDoc = (path: string) => {
    failIfArmed();
    const exists = state.docs.has(path);
    if (config.denySettingsRead && path.startsWith('ganttapp_settings/')) throw coded('permission-denied');
    if (!exists && config.denyMissingProjectGet && /^ganttapp_projects\/[^/]+$/.test(path)) {
      throw coded('permission-denied');
    }
    return { exists: () => exists, data: () => (exists ? structuredClone(state.docs.get(path)) : undefined) };
  };
  const apply = (w: Write) => {
    state.writes.push(w);
    if (w.op === 'set') state.docs.set(w.path, structuredClone(w.data!));
    else state.docs.delete(w.path);
  };
  const isMember = (projectPath: string) =>
    !!(state.docs.get(projectPath)?.members as Data | undefined)?.u1;
  const api = {
    collection: (_db: unknown, path: string) => ({ path }),
    doc: (_db: unknown, path: string) => ({ path }),
    query: (ref: { path: string }, ...constraints: Constraint[]) => ({ path: ref.path, constraints }),
    where: (fieldPath: string, op: string, value: unknown) => ({ field: fieldPath, op, value }),
    getDocs: (q: Query) => later(config.readDelayMs, () => { failIfArmed(); return { docs: childrenOf(q) }; }),
    getDoc: (ref: { path: string }) => later(config.readDelayMs, () => readDoc(ref.path)),
    setDoc: async (ref: { path: string }, data: Data, options?: { merge?: boolean }) => {
      const base = options?.merge ? state.docs.get(ref.path) : undefined;
      apply({ op: 'set', path: ref.path, data: { ...base, ...data } });
    },
    deleteDoc: async (ref: { path: string }) => { apply({ op: 'delete', path: ref.path }); },
    writeBatch: () => {
      const ops: Write[] = [];
      return {
        set: (ref: { path: string }, data: Data) => { ops.push({ op: 'set', path: ref.path, data }); },
        delete: (ref: { path: string }) => { ops.push({ op: 'delete', path: ref.path }); },
        commit: () => later(config.commitDelayMs, () => { ops.forEach(apply); }),
      };
    },
    onSnapshot: (q: Query, next: (snap: unknown) => void, error: (err: unknown) => void) => {
      const epoch = state.epoch;
      const fire = (work: () => void) => () => { if (epoch === state.epoch) work(); };
      let timer: ReturnType<typeof setTimeout> | undefined;
      if (!isMember(q.path.replace(/\/releases$/, ''))) {
        timer = setTimeout(fire(() => error(coded('permission-denied'))), config.listenerDenialMs);
      } else if (config.snapshots === 'cache-first') {
        const snap = () => ({ docs: childrenOf(q), metadata: { hasPendingWrites: false, fromCache: true } });
        timer = setTimeout(fire(() => next(snap())), 5);
      }
      return () => clearTimeout(timer);
    },
    serverTimestamp: () => 'server-timestamp',
    deleteField: () => ({ deleteField: true }),
    runTransaction: async () => {},
    Timestamp: class Timestamp { toMillis() { return 0; } },
  };
  const auth = { currentUser: { uid: 'u1' } };
  return { config, state, api, auth };
});

vi.mock('firebase/firestore', () => fake.api);

vi.mock('firebase/auth', () => {
  class GoogleAuthProvider { addScope() {} }
  class OAuthProvider { addScope() {} }
  const user = {
    uid: 'u1', email: 'ann@example.com', displayName: 'Ann Lee', photoURL: null,
    emailVerified: true, providerData: [{ providerId: 'google.com' }],
  };
  const listeners: ((u: typeof user | null) => void)[] = [];
  return {
    // Signed in: the callback fires once, just after mount, as Firebase's does.
    onAuthStateChanged: (_auth: unknown, callback: (u: typeof user | null) => void) => {
      listeners.push(callback);
      const timer = setTimeout(() => callback(fake.state.signedIn ? user : null), 0);
      return () => { clearTimeout(timer); listeners.splice(listeners.indexOf(callback), 1); };
    },
    signInWithPopup: async () => {},
    // Signing out tells every listener, as Firebase's does — once, on the change.
    signOut: async () => {
      if (!fake.state.signedIn) return;
      fake.state.signedIn = false;
      const epoch = fake.state.epoch;
      listeners.slice().forEach((callback) => setTimeout(() => { if (epoch === fake.state.epoch) callback(null); }, 0));
    },
    GoogleAuthProvider,
    OAuthProvider,
  };
});

vi.mock('../../lib/firebase', () => ({
  // The cloud service compares this with its own user before every load and save.
  auth: fake.auth,
  db: {},
  isFirebaseAvailable: true,
  getSendInvitationEmail: () => null,
  getClaimPendingInvitations: () => null,
  getRevokeInvite: () => null,
  getResendInvite: () => null,
}));

import { FullWrapper } from '../../test/FullWrapper';
import { SettingsTab } from '../../features/settings/SettingsTab';
import { TOS_VERSION } from '../../lib/version';
import { useAppData } from '../AppDataContext';
import { useStorage } from '../StorageContext';
import { FirestoreGanttStorageServiceImpl } from '../../shared/storage/firestore-gantt-storage-service';

// ---------------------------------------------------------------------------
// Seeds

const MODE_KEY = 'ganttapp-storage-mode';
const SETTINGS_PATH = 'ganttapp_settings/u1';
/** A complete settings document with no default values, so any rewrite shows. */
const CLOUD_SETTINGS = {
  schemaVersion: 1,
  chartColors: {
    solidBar: '#2c3e50', hatchedBar: '#34495e', todayLine: '#e74c3c', finishDateLine: '#27ae60',
    mostLikelyLine: '#34495e', completedBar: '#90ee90', inProgressBar: '#e67e22',
  },
  activePreset: 'Professional',
  showTodayLine: false,
  showFinishDateLine: false,
  showMostLikelyLine: true,
  showMonths: true,
  chartDisplaySettings: {
    releaseNameFontSize: '18', dateLabelFontSize: '15', dateLabelColor: '#000',
    verticalLineWidth: '4', barHeight: '50', rowSpacing: '30',
  },
  preparedBy: 'Cloud Person',
  showPreparedBy: true,
  exportAttribution: { name: 'Cloud Name', identifier: 'C1' },
  globalWorkDays: [1, 2, 3, 4],
};
const CREATED = '2026-01-02T03:04:05.000Z';
const HISTORY = [{ timestamp: CREATED, uid: 'u1', action: 'create', target: 'project:seed' }];
const SHARED = { u1: 'owner', u2: 'editor' };

const seedSettings = () => fake.state.docs.set(SETTINGS_PATH, structuredClone(CLOUD_SETTINGS));
function seedProject(id: string, name: string, order: number, members: Record<string, string> = { u1: 'owner' }) {
  fake.state.docs.set(`ganttapp_projects/${id}`, {
    name, owner: 'u1', members, order, schemaVersion: 1, finishDate: null, _originRef: 'uid:u1',
    createdAt: CREATED, updatedAt: CREATED, _changeLog: structuredClone(HISTORY),
  });
}
function seedRelease(projectId: string, id: string, name: string, order: number) {
  fake.state.docs.set(`ganttapp_projects/${projectId}/releases/${id}`, {
    name, startDate: '2026-03-02', earlyFinishDate: '2026-04-01', lateFinishDate: '2026-05-01', order,
  });
}
/** Two owned projects; p1 is shared with an editor, u2. */
function seedTwoProjects() {
  seedSettings();
  seedProject('p1', 'Alpha', 0, SHARED);
  seedRelease('p1', 'r1', 'Kickoff', 0);
  seedProject('p2', 'Beta', 1);
  seedRelease('p2', 'r3', 'Launch', 0);
}
const localRelease = (projectId: string, id: string, name: string) => ({
  id, projectId, name, startDate: '2026-03-02', earlyFinishDate: '2026-04-01', lateFinishDate: '2026-05-01',
});
function seedLocal(projects: { id: string; name: string }[], releases: ReturnType<typeof localRelease>[] = []) {
  localStorage.setItem('ganttAppData', JSON.stringify({ projects, releases }));
}
/**
 * A stale local copy of p1. Since it was copied, the cloud gained a project
 * from another device (p9) and a collaborator's release (r2), and r1 was
 * renamed there.
 */
function seedStaleCopyScenario() {
  seedSettings();
  seedProject('p1', 'Alpha', 0, SHARED);
  seedRelease('p1', 'r1', 'Kickoff (renamed in the cloud)', 0);
  seedRelease('p1', 'r2', 'Added by a collaborator', 1);
  seedProject('p9', 'From another device', 1);
  seedRelease('p9', 'r9', 'Elsewhere', 0);
  seedLocal([{ id: 'p1', name: 'Alpha' }], [localRelease('p1', 'r1', 'Kickoff')]);
}

/** A local project never uploaded: the cloud has no document under its id. */
function seedNeverUploaded() {
  seedSettings();
  seedLocal([{ id: 'L1', name: 'Local Plan' }], [localRelease('L1', 'l1r1', 'Local release')]);
}

// ---------------------------------------------------------------------------
// Observing the cloud service: every instance, and the order of its calls

type Service = FirestoreGanttStorageServiceImpl;
type Kind = 'load-start' | 'load-end' | 'save' | 'subscribe';
const events: { kind: Kind; service: Service; detail: string }[] = [];
const services: Service[] = [];
const proto = FirestoreGanttStorageServiceImpl.prototype;
const real = { load: proto.loadAppData, save: proto.saveAppData, subscribe: proto.subscribeToProject };

function record(service: Service, kind: Kind, detail: string) {
  if (!services.includes(service)) services.push(service);
  events.push({ kind, service, detail });
}

function instrumentCloudService() {
  vi.spyOn(proto, 'loadAppData').mockImplementation(async function (this: Service) {
    record(this, 'load-start', '');
    const result = await real.load.call(this);
    record(this, 'load-end', result ? `${result.projects.length} projects` : 'failed');
    return result;
  });
  vi.spyOn(proto, 'saveAppData').mockImplementation(function (this: Service, data: AppData) {
    record(this, 'save', data.projects.map((p) => p.id).join(',') || 'no projects');
    return real.save.call(this, data);
  });
  vi.spyOn(proto, 'subscribeToProject').mockImplementation(function (this: Service, projectId, callback) {
    record(this, 'subscribe', projectId);
    return real.subscribe.call(this, projectId, callback);
  });
}

/** Calls of `kind` a cloud service received before its own first load resolved. */
function callsBeforeOwnLoad(kind: Kind): string[] {
  const loaded = new Set<Service>();
  const early: string[] = [];
  events.forEach((e) => {
    if (e.kind === 'load-end') loaded.add(e.service);
    if (e.kind === kind && !loaded.has(e.service)) early.push(`service ${services.indexOf(e.service) + 1}: ${kind}(${e.detail})`);
  });
  return early;
}
const loadsEnded = () => events.filter((e) => e.kind === 'load-end').length;

// ---------------------------------------------------------------------------
// The cloud, as the tests read it

const cloudWrites = () => fake.state.writes.filter((w) => /^ganttapp_(projects|settings)\//.test(w.path));
const projectDoc = (id: string) => fake.state.docs.get(`ganttapp_projects/${id}`);
const settingsDoc = () => fake.state.docs.get(SETTINGS_PATH);
const cloudProjects = () => Array.from(fake.state.docs.keys())
  .filter((p) => /^ganttapp_projects\/[^/]+$/.test(p))
  .map((p) => ({ id: p.split('/')[1], name: fake.state.docs.get(p)!.name as string }));
/** The id the upload gave a local project (a new one: a read of a missing doc is denied). */
const uploadedIdOf = (localId: string, name: string) => cloudWrites()
  .find((w) => w.op === 'set' && /^ganttapp_projects\/[^/]+$/.test(w.path) && w.data?.name === name
    && !w.path.endsWith(`/${localId}`))?.path.split('/')[1];

// ---------------------------------------------------------------------------
// The app

/** Reads the real hooks, so a test can see what the app holds in memory. */
function Probe() {
  const { data, loading, preparedBy } = useAppData();
  const { mode } = useStorage();
  return (
    <section>
      <p data-testid="probe-state">{`${mode} ${loading ? 'loading' : 'ready'}`}</p>
      <p data-testid="probe-prepared-by">{preparedBy}</p>
      <ul data-testid="probe-projects">{data.projects.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
    </section>
  );
}

let view: RenderResult | null = null;
function renderApp(extra?: ReactNode) {
  view = render(<FullWrapper><SettingsTab /><Probe />{extra}</FullWrapper>);
  return view;
}
const probeState = () => screen.getByTestId('probe-state').textContent;

const tick = () => act(() => new Promise<void>((resolve) => { setTimeout(resolve, 5); }));
/** Real time in 5 ms act() chunks. */
async function wait(ms: number) {
  for (let t = 0; t < ms; t += 5) await tick();
}
async function waitUntil(check: () => boolean, what: string, maxMs = 5000) {
  for (let t = 0; t < maxMs; t += 5) {
    if (check()) return;
    await tick();
  }
  throw new Error(`timed out waiting for ${what}`);
}

const cloudRadio = () => screen.getByRole('radio', { name: /Cloud \(sync across devices\)/ }) as HTMLInputElement;
const signedIn = () => screen.queryByText(/Signed in as/) !== null && probeState()?.endsWith('ready') === true;

/** Page load with the stored mode 'cloud': the mount restores the cloud service. */
async function loadPageInCloudMode() {
  localStorage.setItem(MODE_KEY, 'cloud');
  renderApp();
  await waitUntil(() => loadsEnded() >= 1, 'the first cloud load');
}

/** Settings → Cloud radio, confirming the upload when local projects exist. */
async function chooseCloud() {
  renderApp();
  await waitUntil(() => signedIn() && !cloudRadio().disabled, 'sign-in');
  fireEvent.click(cloudRadio());
  const upload = screen.queryByRole('button', { name: 'Upload to Cloud' });
  if (upload) fireEvent.click(upload);
  await waitUntil(() => loadsEnded() >= 1, 'the first cloud load');
}

/** Stored mode 'cloud' plus local projects: the mount asks, and the test confirms. */
async function confirmUploadPrompt() {
  localStorage.setItem(MODE_KEY, 'cloud');
  renderApp();
  await waitUntil(() => screen.queryByRole('button', { name: 'Upload to Cloud' }) !== null, 'the upload prompt');
  fireEvent.click(screen.getByRole('button', { name: 'Upload to Cloud' }));
  await waitUntil(() => loadsEnded() >= 1, 'the first cloud load');
}

describe('swapping to a cloud storage service', () => {
  beforeEach(() => {
    fake.state.epoch++;
    fake.state.docs.clear();
    fake.state.writes.length = 0;
    fake.state.signedIn = true;
    Object.assign(fake.config, {
      readDelayMs: 5, commitDelayMs: 0, denySettingsRead: false, denyMissingProjectGet: true,
      snapshots: 'never', failReads: 0, listenerDenialMs: 0,
    });
    events.length = 0;
    services.length = 0;
    view = null;
    localStorage.clear();
    localStorage.setItem('spert_tos_accepted_version', TOS_VERSION);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'prompt').mockImplementation(() => null);
    instrumentCloudService();
  });

  afterEach(() => {
    view?.unmount();
    services.forEach((s) => s.dispose());
    vi.restoreAllMocks();
  });

  describe('page load in cloud mode', () => {
    // Fails only when both the context guard and the service guard are removed.
    it('with no projects anywhere, leaves the cloud settings as they were', async () => {
      seedSettings();
      await loadPageInCloudMode();
      await wait(600);

      expect(settingsDoc()).toEqual(CLOUD_SETTINGS);
    });

    // Masked: asserted at the queue. Fails when the context guard is removed.
    it('with two projects and a first snapshot from the cache, queues nothing on the new service before its load', async () => {
      seedTwoProjects();
      fake.config.snapshots = 'cache-first';
      await loadPageInCloudMode();
      await wait(400);

      expect(callsBeforeOwnLoad('save')).toEqual([]);
    });

    // The load finishes before the 200 ms save timer, and no snapshot arrives.
    // Fails only when both the context guard and the service guard are removed.
    it('with two projects and a fast load, deletes no project and leaves the settings', async () => {
      seedTwoProjects();
      await loadPageInCloudMode();
      await wait(600);

      expect(cloudWrites().filter((w) => w.op === 'delete').map((w) => w.path)).toEqual([]);
      expect(projectDoc('p1')).toBeDefined();
      expect(projectDoc('p2')).toBeDefined();
      expect(settingsDoc()).toEqual(CLOUD_SETTINGS);
    });

    // The 200 ms save timer fires before the load (120 ms per read).
    // Fails only when both the context guard and the service guard are removed.
    it('with a slow load, leaves the settings and shows the cloud values', async () => {
      seedTwoProjects();
      fake.config.readDelayMs = 120;
      await loadPageInCloudMode();
      await wait(600);

      expect(settingsDoc()).toEqual(CLOUD_SETTINGS);
      expect(screen.getByTestId('probe-prepared-by').textContent).toBe('Cloud Person');
      expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Cloud Name');
    });

    // The load ends while an early save's commit is in flight (65 ms per read,
    // so the load ends ~260 ms after the swap; 150 ms per commit, so the early
    // save, sent at ~200 ms, is acknowledged at ~350 ms). The first snapshot
    // comes from the cache, so the save it triggers is diffed against what that
    // commit acknowledged, not against the load.
    // Fails only when both the context guard and the service guard are removed.
    it('when the load ends while an early save is committing, the shared project keeps its collaborator and history', async () => {
      seedTwoProjects();
      Object.assign(fake.config, { readDelayMs: 65, commitDelayMs: 150, snapshots: 'cache-first' });
      await loadPageInCloudMode();
      await wait(900);

      expect(projectDoc('p1')?.members).toEqual(SHARED);
      expect(projectDoc('p1')?.createdAt).toBe(CREATED);
      expect(projectDoc('p1')?._changeLog).toEqual(HISTORY);
    });
  });

  describe('the Cloud radio and the upload prompt', () => {
    // Fails only when both the context guard and the service guard are removed.
    it('with no local projects, leaves the cloud settings as they were', async () => {
      seedSettings();
      await chooseCloud();
      await wait(600);

      expect(settingsDoc()).toEqual(CLOUD_SETTINGS);
    });

    // The switch skips p1 (already in the cloud); the 200 ms save timer fires
    // before the load (120 ms per read).
    // Fails only when both the context guard and the service guard are removed.
    it('with a local copy of a shared project and a slow load, the project keeps its collaborator', async () => {
      seedTwoProjects();
      seedLocal([{ id: 'p1', name: 'Alpha (this browser)' }], [localRelease('p1', 'r1', 'Kickoff')]);
      fake.config.readDelayMs = 120;
      await chooseCloud();
      await wait(800);

      expect(projectDoc('p1')?.members).toEqual(SHARED);
    });

    // As above, through the prompt the page shows when the stored mode is
    // 'cloud' and this browser has local projects.
    // Fails only when both the context guard and the service guard are removed.
    it('the upload prompt, confirmed with a local copy of a shared project and a slow load: the project keeps its collaborator', async () => {
      seedTwoProjects();
      seedLocal([{ id: 'p1', name: 'Alpha (this browser)' }], [localRelease('p1', 'r1', 'Kickoff')]);
      fake.config.readDelayMs = 120;
      await confirmUploadPrompt();
      await wait(800);

      expect(projectDoc('p1')?.members).toEqual(SHARED);
    });

    // A stale local copy of p1: the cloud has a project from another device
    // (p9), a collaborator's release (r2) and a rename of r1. The load
    // finishes before the 200 ms save timer, and no snapshot arrives.
    // Fails only when both the context guard and the service guard are removed.
    it('with a stale local copy and a fast load, the other device\'s project, the new release and the rename survive', async () => {
      seedStaleCopyScenario();
      await chooseCloud();
      await wait(600);

      expect(projectDoc('p9')).toBeDefined();
      expect(fake.state.docs.get('ganttapp_projects/p1/releases/r2')).toBeDefined();
      expect(fake.state.docs.get('ganttapp_projects/p1/releases/r1')?.name).toBe('Kickoff (renamed in the cloud)');
    });

    // Masked: asserted at the queue. Fails when the context guard is removed.
    it('with a stale local copy and a first snapshot from the cache, queues nothing on the new service before its load', async () => {
      seedStaleCopyScenario();
      fake.config.snapshots = 'cache-first';
      await chooseCloud();
      await wait(400);

      expect(callsBeforeOwnLoad('save')).toEqual([]);
    });

    // A project never uploaded: the read of its missing doc is denied, so the
    // upload gives it a new id. The 200 ms save timer fires before the load.
    // Fails only when both the context guard and the service guard are removed.
    it('with a never-uploaded project and a slow load, the cloud holds one copy of it', async () => {
      seedNeverUploaded();
      fake.config.readDelayMs = 120;
      await chooseCloud();
      await wait(800);

      expect(cloudProjects().filter((p) => p.name === 'Local Plan')).toHaveLength(1);
    });

    // As above, with the load done before the 200 ms save timer and no snapshot.
    // Fails only when both the context guard and the service guard are removed.
    it('with a never-uploaded project and a fast load, the cloud holds one copy, the uploaded one, with its releases', async () => {
      seedNeverUploaded();
      await chooseCloud();
      await wait(600);
      const uploadedId = uploadedIdOf('L1', 'Local Plan');

      expect(cloudProjects().filter((p) => p.name === 'Local Plan')).toHaveLength(1);
      expect(uploadedId).toBeDefined(); // the upload ran, under a new id
      expect(projectDoc(uploadedId!)).toBeDefined();
      expect(fake.state.docs.get(`ganttapp_projects/${uploadedId}/releases/l1r1`)).toBeDefined();
    });

    // Masked: asserted at the queue. Fails when the context guard is removed.
    it('with a never-uploaded project and a first snapshot from the cache, queues nothing on the new service before its load', async () => {
      seedNeverUploaded();
      fake.config.snapshots = 'cache-first';
      await chooseCloud();
      await wait(400);

      expect(callsBeforeOwnLoad('save')).toEqual([]);
    });
  });
});

