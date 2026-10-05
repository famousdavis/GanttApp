// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// End to end, continued from cloudSwap.e2e.test.tsx (same in-memory Firestore,
// same probes): cloud loads that fail or are set aside by the empty-result
// guard, switches back to Local, the real-time listeners, a direct updateData
// call, and the positive controls that must hold before and after the fix.
//
// Nothing of the app is mocked: the auth, storage and app-data providers, the
// cloud service, its save executor and the Settings tab are all real. Only
// firebase/* (an in-memory Firestore with a write log, and a signed-in user
// who can sign out) and lib/firebase are replaced. Real timers throughout;
// time is advanced in 5 ms act() chunks so no single act() spans a render
// that matters.
//
// The fixes these tests separate:
// - "the context guard": the app-data context sends no save, updateData save
//   or listener to a storage until a load from that storage has been applied;
//   a failed or set-aside cloud load does not count, a local load always does;
// - "the service guard": the cloud service refuses saves until one of its own
//   loads has succeeded, keeps its earlier baseline when a load is set aside,
//   and says so in Settings when the first load does not succeed;
// - "the reset": switching from Cloud to Local with no projects on screen
//   clears the in-memory data first, as sign-out does.
// Each test's comment names the removal(s) it is expected to fail under.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, type RenderResult } from '@testing-library/react';
import { useEffect, useRef, type ReactNode } from 'react';
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
const NOT_LOADED =
  'Cloud sync error: Your cloud data did not load, so changes are not being saved. Reload the page to try again.';
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
/** Settings plus one owned project with a release. */
function seedOneProject() {
  seedSettings();
  seedProject('p1', 'Alpha', 0);
  seedRelease('p1', 'r1', 'Kickoff', 0);
}
const localRelease = (projectId: string, id: string, name: string) => ({
  id, projectId, name, startDate: '2026-03-02', earlyFinishDate: '2026-04-01', lateFinishDate: '2026-05-01',
});
function seedLocal(projects: { id: string; name: string }[], releases: ReturnType<typeof localRelease>[] = []) {
  localStorage.setItem('ganttAppData', JSON.stringify({ projects, releases }));
}
const storedData = (): Record<string, unknown> => JSON.parse(localStorage.getItem('ganttAppData') ?? '{}');
const storedProjects = () => ((storedData().projects ?? []) as { id: string }[]).map((p) => p.id);

// ---------------------------------------------------------------------------
// Observing the cloud service: every instance, and the order of its calls

type Service = FirestoreGanttStorageServiceImpl;
type Kind = 'load-start' | 'load-end' | 'save' | 'subscribe';
const events: { kind: Kind; service: Service; detail: string; writeIndex: number }[] = [];
const services: Service[] = [];
const proto = FirestoreGanttStorageServiceImpl.prototype;
const real = { load: proto.loadAppData, save: proto.saveAppData, subscribe: proto.subscribeToProject };

function record(service: Service, kind: Kind, detail: string) {
  if (!services.includes(service)) services.push(service);
  events.push({ kind, service, detail, writeIndex: fake.state.writes.length });
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
const loadResults = () => events.filter((e) => e.kind === 'load-end').map((e) => e.detail);
const loadsEnded = () => loadResults().length;

// ---------------------------------------------------------------------------
// The cloud, as the tests read it

const writesUnder = (path: string, from = 0) =>
  fake.state.writes.slice(from).filter((w) => w.path === path || w.path.startsWith(`${path}/`));
/** Index into the write log at the swap: everything the upload wrote comes before it. */
const swapWriteIndex = () => events.find((e) => e.kind === 'load-start')?.writeIndex ?? 0;
const projectDoc = (id: string) => fake.state.docs.get(`ganttapp_projects/${id}`);
const settingsDoc = () => fake.state.docs.get(SETTINGS_PATH);

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

const directSave = { calls: 0, loadsEndedAtCall: -1 };
/**
 * Calls updateData once, from the effects of the render that swaps in the
 * cloud service — a microtask later, so after the provider's own effects for
 * that render have run. No screen can do this: the page shows a whole-page
 * "Loading..." during every load.
 */
function DirectSaveProbe() {
  const { storage } = useStorage();
  const { data, updateData } = useAppData();
  const done = useRef(false);
  useEffect(() => {
    if (storage.mode !== 'cloud' || done.current) return;
    done.current = true;
    const next: AppData = { ...data, projects: [...data.projects, { id: 'e10', name: 'Direct Plan' }] };
    queueMicrotask(() => {
      directSave.calls++;
      directSave.loadsEndedAtCall = loadsEnded();
      updateData(next);
    });
  }, [storage, data, updateData]);
  return null;
}

let view: RenderResult | null = null;
function renderApp(extra?: ReactNode) {
  view = render(<FullWrapper><SettingsTab /><Probe />{extra}</FullWrapper>);
  return view;
}
const probeState = () => screen.getByTestId('probe-state').textContent;
const shownProjects = () =>
  Array.from(screen.getByTestId('probe-projects').querySelectorAll('li')).map((li) => li.textContent);

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

/** Records whether any text matching `pattern` is ever on the page. */
function watchText(pattern: RegExp) {
  let seen = false;
  const check = () => { seen = seen || pattern.test(document.body.textContent ?? ''); };
  const observer = new MutationObserver(check);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return () => { check(); observer.disconnect(); return seen; };
}

const cloudRadio = () => screen.getByRole('radio', { name: /Cloud \(sync across devices\)/ }) as HTMLInputElement;
const localRadio = () => screen.getByRole('radio', { name: /Local \(browser only\)/ }) as HTMLInputElement;
const signedIn = () => screen.queryByText(/Signed in as/) !== null && probeState()?.endsWith('ready') === true;

function commitField(label: string, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input); // the attribution fields commit on blur, not on change
}

const reloadModels = () => act(async () => {
  window.dispatchEvent(new CustomEvent('spert:models-changed', { detail: { claimed: [] } }));
});

/** Page load with the stored mode 'cloud': the mount restores the cloud service. */
async function loadPageInCloudMode(extra?: ReactNode) {
  localStorage.setItem(MODE_KEY, 'cloud');
  renderApp(extra);
  await waitUntil(() => loadsEnded() >= 1, 'the first cloud load');
}

/** Settings → Cloud radio, confirming the upload when local projects exist. */
async function chooseCloud(beforeClick?: () => void) {
  renderApp();
  await waitUntil(() => signedIn() && !cloudRadio().disabled, 'sign-in');
  beforeClick?.();
  fireEvent.click(cloudRadio());
  const upload = screen.queryByRole('button', { name: 'Upload to Cloud' });
  if (upload) fireEvent.click(upload);
  await waitUntil(() => loadsEnded() >= 1, 'the first cloud load');
}

describe('cloud loads that fail or are set aside, switches to Local, and controls', () => {
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
    Object.assign(directSave, { calls: 0, loadsEndedAtCall: -1 });
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

  describe('a cloud load that fails', () => {
    // The switch skips p1 (already in the cloud) and uploads nothing to it.
    // The writes: fail only when both the context guard and the service guard
    // are removed. The message: fails when the service guard is removed.
    it('on the Cloud radio, leaves the shared project untouched and says the cloud data did not load', async () => {
      seedSettings();
      seedProject('p1', 'Alpha', 0, SHARED);
      seedRelease('p1', 'r1', 'Kickoff', 0);
      seedLocal([{ id: 'p1', name: 'Alpha (this browser)' }], [localRelease('p1', 'r1', 'Kickoff')]);
      fake.config.denySettingsRead = true;
      await chooseCloud();
      await wait(600);

      expect(loadResults()).toEqual(['failed']);
      expect(projectDoc('p1')?.members).toEqual(SHARED);
      expect(writesUnder('ganttapp_projects/p1', swapWriteIndex())).toEqual([]);
      expect(screen.getByText(NOT_LOADED)).toBeInTheDocument();
    });

    // The writes: fail only when both the context guard and the service guard
    // are removed. The message: fails when the service guard is removed.
    it('on page load, leaves the settings and says the cloud data did not load', async () => {
      seedOneProject();
      fake.config.denySettingsRead = true;
      await loadPageInCloudMode();
      await wait(600);

      expect(loadResults()).toEqual(['failed']);
      expect(settingsDoc()).toEqual(CLOUD_SETTINGS);
      expect(screen.getByText(NOT_LOADED)).toBeInTheDocument();
    });
  });

  describe('a cloud load set aside because it found no projects while some are on screen', () => {
    // Another tab cleared this browser's store after this one loaded L1, so the
    // switch uploads nothing and the cloud load (0 projects) is set aside.
    // With both guards removed, the save queued when the load is set aside
    // writes L1 as new, so the writes assertion fails: since v0.29.1 no listener
    // opens on a project the baseline does not hold, so no denial prunes L1
    // first. (Before v0.29.1 a listener on L1 was denied at 0 ms here, pruning
    // L1, and only the settings assertion failed.)
    // The writes: fail only when both the context guard and the service guard
    // are removed. The message: fails when the service guard is removed, and not
    // when only the context guard is (measured on v0.29.1: no listener opens on
    // L1, so no permission error replaces it).
    it('choosing Cloud writes nothing under the local id, leaves the settings, and says the cloud data did not load', async () => {
      seedSettings();
      seedLocal([{ id: 'L1', name: 'Local Plan' }], [localRelease('L1', 'l1r1', 'Local release')]);
      await chooseCloud(() => localStorage.removeItem('ganttAppData'));
      await wait(600);

      expect(loadResults()).toEqual(['0 projects']);
      expect(writesUnder('ganttapp_projects/L1')).toEqual([]);
      expect(settingsDoc()).toEqual(CLOUD_SETTINGS);
      expect(screen.getByText(NOT_LOADED)).toBeInTheDocument();
    });

    // As above, with the server's denial of any listener on L1 arriving 400 ms
    // after it opens — after the 200 ms save timer. Since v0.29.1 no listener
    // opens on L1, so this test measures as the one above.
    // The writes: fail only when both the context guard and the service guard
    // are removed. The message: as above.
    it('the same, when the server denies the listener on the local id only after the save timer', async () => {
      seedSettings();
      seedLocal([{ id: 'L1', name: 'Local Plan' }], [localRelease('L1', 'l1r1', 'Local release')]);
      fake.config.listenerDenialMs = 400;
      await chooseCloud(() => localStorage.removeItem('ganttAppData'));
      await wait(800);

      expect(loadResults()).toEqual(['0 projects']);
      expect(writesUnder('ganttapp_projects/L1')).toEqual([]);
      expect(settingsDoc()).toEqual(CLOUD_SETTINGS);
      expect(screen.getByText(NOT_LOADED)).toBeInTheDocument();
    });

    // p1 is deleted on another device after a good load; a background reload
    // then finds no projects and is set aside. No edit follows.
    // Fails when the service guard (its earlier baseline kept) is removed: the
    // empty reload then stays the baseline, which does not hold p1, so since
    // v0.29.1 no listener re-opens on p1 and no denial prunes it, and the save
    // re-creates it. (Before v0.29.1 that denial, at 0 ms here, pruned p1 before
    // the 200 ms timer, and this test passed with the guard removed.)
    it('a background reload after another device deleted the only project does not re-create it', async () => {
      seedOneProject();
      fake.config.snapshots = 'cache-first';
      await loadPageInCloudMode();
      await wait(500);
      fake.state.docs.delete('ganttapp_projects/p1');
      const deletedAt = fake.state.writes.length;
      await reloadModels();
      await waitUntil(() => loadsEnded() >= 2, 'the reload');
      await wait(600);

      expect(loadResults()).toEqual(['1 projects', '0 projects']);
      expect(writesUnder('ganttapp_projects/p1', deletedAt).filter((w) => w.op === 'set')).toEqual([]);
      expect(projectDoc('p1')).toBeUndefined();
    });

    // As above, with the server's denial of the re-opened listener arriving
    // 400 ms after it opens — after the 200 ms save timer. The context guard
    // does not see a reload of a storage it has already loaded from.
    // Fails when the service guard (its earlier baseline kept) is removed (with
    // the guard removed, since v0.29.1 no listener re-opens on p1 at all).
    it('the same, when the server denies the re-opened listener only after the save timer', async () => {
      seedOneProject();
      fake.config.snapshots = 'cache-first';
      await loadPageInCloudMode();
      await wait(500);
      fake.state.docs.delete('ganttapp_projects/p1');
      fake.config.listenerDenialMs = 400;
      const deletedAt = fake.state.writes.length;
      await reloadModels();
      await waitUntil(() => loadsEnded() >= 2, 'the reload');
      await wait(800);

      expect(loadResults()).toEqual(['1 projects', '0 projects']);
      expect(writesUnder('ganttapp_projects/p1', deletedAt).filter((w) => w.op === 'set')).toEqual([]);
      expect(projectDoc('p1')).toBeUndefined();
    });
  });

  describe('switching from Cloud to Local with no projects on screen', () => {
    // k1 stands in for a copy this browser kept earlier in the session.
    // Fails only when both the context guard and the reset are removed.
    it('keeps the copy this browser already holds, also after a reload', async () => {
      seedSettings();
      await loadPageInCloudMode();
      await wait(300);
      seedLocal([{ id: 'k1', name: 'Kept Plan' }]);
      fireEvent.click(localRadio());
      await wait(200);

      expect(storedProjects()).toEqual(['k1']);

      view?.unmount();
      renderApp();
      await waitUntil(() => probeState() === 'local ready', 'the local load after the reload');
      expect(shownProjects()).toEqual(['Kept Plan']);
    });

    // Fails when the reset is removed (the context guard does not close it:
    // the empty local load counts, and the in-memory cloud settings follow).
    it('into an empty local store, writes no cloud setting to this browser', async () => {
      seedSettings();
      await loadPageInCloudMode();
      await wait(300);
      localStorage.removeItem('ganttAppData');
      fireEvent.click(localRadio());
      await wait(200);

      expect(storedData().exportAttribution).toBeUndefined();
      expect(storedData().preparedBy).not.toBe('Cloud Person');
    });
  });

  describe('listeners and direct saves before the first cloud load', () => {
    // L1 has never been uploaded, so it gets a new id in the cloud and has no
    // document under its local id. Fails when the context guard is removed.
    it('choosing Cloud with a local project opens no listener before the cloud load, and shows no permission error', async () => {
      seedSettings();
      seedLocal([{ id: 'L1', name: 'Local Plan' }], [localRelease('L1', 'l1r1', 'Local release')]);
      fake.config.snapshots = 'cache-first';
      const permissionErrorShown = watchText(/Cloud sync error: Permission denied/);
      await chooseCloud();
      await wait(400);

      expect(callsBeforeOwnLoad('subscribe')).toEqual([]);
      expect(permissionErrorShown()).toBe(false);
    });

    // Not a user path (see DirectSaveProbe). Fails only when both the context
    // guard and the service guard are removed.
    it('an updateData call before the new cloud service has loaded writes nothing to the cloud', async () => {
      seedOneProject();
      fake.config.readDelayMs = 20;
      await loadPageInCloudMode(<DirectSaveProbe />);
      await wait(600);

      expect(directSave).toEqual({ calls: 1, loadsEndedAtCall: 0 });
      expect(writesUnder('ganttapp_projects/e10')).toEqual([]);
    });
  });

  describe('positive controls: these must pass before and after the fix', () => {
    it('a first-time local user\'s edit is saved in this browser', async () => {
      renderApp();
      await waitUntil(signedIn, 'the local load');
      commitField('Name', 'Ann');
      await wait(50);

      expect(storedData().exportAttribution).toEqual({ name: 'Ann', identifier: '' });
    });

    it('an edit after a successful cloud load is written to the cloud', async () => {
      seedOneProject();
      fake.config.snapshots = 'cache-first';
      await loadPageInCloudMode();
      await wait(500);
      commitField('Name', 'Ann');
      await wait(400);

      expect(settingsDoc()?.exportAttribution).toEqual({ name: 'Ann', identifier: 'C1' });
    });

    it('after a good cloud load, an edit following a background reload that failed is written', async () => {
      seedOneProject();
      fake.config.snapshots = 'cache-first';
      await loadPageInCloudMode();
      await wait(500);
      fake.config.failReads = 1;
      await reloadModels();
      await waitUntil(() => loadsEnded() >= 2, 'the reload');
      await wait(300);
      commitField('Name', 'Ann');
      await wait(400);

      expect(loadResults()).toEqual(['1 projects', 'failed']);
      expect(settingsDoc()?.exportAttribution).toEqual({ name: 'Ann', identifier: 'C1' });
    });

    it('signing out in local mode shows the sign-in buttons and keeps this browser\'s data', async () => {
      seedLocal([{ id: 'L1', name: 'Local Plan' }]);
      renderApp();
      await waitUntil(signedIn, 'sign-in');
      fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));
      await waitUntil(() => screen.queryByRole('button', { name: 'Sign in with Google' }) !== null, 'the sign-in buttons');
      await wait(50);

      expect(storedProjects()).toEqual(['L1']);
      expect(shownProjects()).toEqual(['Local Plan']);
    });

    it('a background reload after a good cloud load reads the cloud again, and the next edit is written', async () => {
      seedOneProject();
      fake.config.snapshots = 'cache-first';
      await loadPageInCloudMode();
      await wait(500);
      fake.state.docs.set('ganttapp_projects/p5', {
        name: 'Shared With Me', owner: 'u2', members: { u2: 'owner', u1: 'editor' }, order: 1, schemaVersion: 1,
        createdAt: CREATED, updatedAt: CREATED, _changeLog: [],
      });
      await reloadModels();
      await waitUntil(() => shownProjects().includes('Shared With Me'), 'the reloaded project');
      commitField('Name', 'Ann');
      await wait(400);

      expect(settingsDoc()?.exportAttribution).toEqual({ name: 'Ann', identifier: 'C1' });
    });
  });
});
