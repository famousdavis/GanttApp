// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// End to end: switching to the cloud when this browser holds its own
// projects. A project that was uploaded no longer needs its copy here, so
// that copy is removed as soon as the switch is done. A project that was
// already in the cloud is skipped, and its copy here may differ from the
// cloud version, so the user is asked about it: download this browser's
// version as a file and then remove it, or keep it. The tests follow each
// answer to the next visit.
//
// Nothing of the app is mocked. The auth, storage and app-data providers,
// the cloud service, its save executor and the Settings tab are real. Only
// firebase/* (an in-memory Firestore and a signed-in user) and lib/firebase
// are replaced. The fake refuses to read a project document that does not
// exist, as the production rules do, so every uploaded project gets a new
// id in the cloud. A next visit unmounts the app, disposes its cloud
// services, and renders it again over the same browser storage and cloud.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor, within, cleanup } from '@testing-library/react';

const fake = vi.hoisted(() => {
  type Data = Record<string, unknown>;
  type Ref = { path: string };
  type Constraint = { field: string; op: string; value: unknown };
  type Write = { op: 'set' | 'delete'; path: string; data?: Data };
  const config = {
    readDelayMs: 0,
    commitDelayMs: 0,
    denySettingsRead: false,
    denyMissingProjectGet: true,
    snapshots: 'never' as 'never' | 'cache-first',
    failCommits: null as unknown, // while set, every batch commit rejects with it
  };
  const state = {
    docs: new Map<string, Data>(),
    writes: [] as Write[],
    // Each applied batch: the paths it wrote, and this browser's stored projects at that moment.
    commits: [] as { paths: string[]; local: string | null }[],
    generation: 0,
  };
  const denied = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
  const field = (data: Data, path: string) =>
    path.split('.').reduce<unknown>((obj, key) => (obj as Data | undefined)?.[key], data);
  const matches = (data: Data, c: Constraint) =>
    (c.op === 'in' ? (c.value as unknown[]).includes(field(data, c.field)) : field(data, c.field) === c.value);
  const childrenOf = (path: string) => {
    const depth = path.split('/').length + 1;
    return Array.from(state.docs.keys()).filter((p) => p.startsWith(`${path}/`) && p.split('/').length === depth);
  };
  const snapshotOf = (path: string) => ({
    id: path.split('/').pop()!, ref: { path }, data: () => structuredClone(state.docs.get(path)),
  });
  const isMember = (projectPath: string) => !!(state.docs.get(projectPath)?.members as Data | undefined)?.u1;
  // Every call waits its configured delay. A call left over from an earlier
  // test never settles, so it cannot reach the next test's documents.
  const pause = async (ms: number) => {
    const generation = state.generation;
    if (ms > 0) await new Promise((resolve) => { setTimeout(resolve, ms); });
    if (generation !== state.generation) await new Promise(() => {});
  };
  const apply = (w: Write) => {
    state.writes.push(w);
    if (w.op === 'set') state.docs.set(w.path, structuredClone(w.data!));
    else state.docs.delete(w.path);
  };
  const api = {
    collection: (_db: unknown, path: string) => ({ path }),
    doc: (_db: unknown, path: string) => ({ path }),
    query: (ref: Ref, ...constraints: Constraint[]) => ({ path: ref.path, constraints }),
    where: (fieldPath: string, op: string, value: unknown) => ({ field: fieldPath, op, value }),
    getDocs: async (q: { path: string; constraints?: Constraint[] }) => {
      await pause(config.readDelayMs);
      const docs = childrenOf(q.path)
        .filter((p) => (q.constraints ?? []).every((c) => matches(state.docs.get(p)!, c)))
        .map(snapshotOf);
      return { docs };
    },
    getDoc: async (ref: Ref) => {
      await pause(config.readDelayMs);
      const exists = state.docs.has(ref.path);
      if (config.denySettingsRead && ref.path.startsWith('ganttapp_settings/')) throw denied();
      // The production rules refuse to read a project document that does not exist.
      if (!exists && config.denyMissingProjectGet && /^ganttapp_projects\/[^/]+$/.test(ref.path)) throw denied();
      return { exists: () => exists, data: () => (exists ? structuredClone(state.docs.get(ref.path)) : undefined) };
    },
    setDoc: async (ref: Ref, data: Data, options?: { merge?: boolean }) => {
      await pause(config.commitDelayMs);
      apply({ op: 'set', path: ref.path, data: options?.merge ? { ...state.docs.get(ref.path), ...data } : data });
    },
    deleteDoc: async (ref: Ref) => {
      await pause(config.commitDelayMs);
      apply({ op: 'delete', path: ref.path });
    },
    writeBatch: () => {
      const ops: Write[] = [];
      return {
        set: (ref: Ref, data: Data) => { ops.push({ op: 'set', path: ref.path, data: structuredClone(data) }); },
        delete: (ref: Ref) => { ops.push({ op: 'delete', path: ref.path }); },
        commit: async () => {
          await pause(config.commitDelayMs);
          if (config.failCommits) throw config.failCommits;
          state.commits.push({ paths: ops.map((w) => w.path), local: localStorage.getItem('ganttAppData') });
          ops.forEach((w) => apply(w));
        },
      };
    },
    // Release listeners. A project this user cannot read is refused at once;
    // otherwise, in 'cache-first' mode, one snapshot arrives from the cache.
    onSnapshot: (q: Ref, next: (snapshot: unknown) => void, error: (err: unknown) => void) => {
      const generation = state.generation;
      const live = () => generation === state.generation;
      let timer: ReturnType<typeof setTimeout> | null = null;
      if (!isMember(q.path.replace(/\/releases$/, ''))) {
        timer = setTimeout(() => { if (live()) error(denied()); }, 0);
      } else if (config.snapshots === 'cache-first') {
        timer = setTimeout(() => {
          if (live()) next({ docs: childrenOf(q.path).map(snapshotOf), metadata: { hasPendingWrites: false, fromCache: true } });
        }, 5);
      }
      return () => { if (timer) clearTimeout(timer); };
    },
    serverTimestamp: () => 'server-timestamp',
    deleteField: () => ({ deleteField: true }),
    runTransaction: async () => {},
    Timestamp: class Timestamp { toMillis() { return 0; } },
  };
  const reset = () => {
    state.generation += 1;
    state.docs.clear();
    state.writes.length = 0;
    state.commits.length = 0;
    Object.assign(config, {
      readDelayMs: 0, commitDelayMs: 0, denySettingsRead: false, denyMissingProjectGet: true,
      snapshots: 'never', failCommits: null,
    });
  };
  return { state, config, api, reset };
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
import { useAppData } from '../../../context/AppDataContext';
import { FirestoreGanttStorageServiceImpl } from '../../../shared/storage/firestore-gantt-storage-service';
import { TOS_VERSION } from '../../../lib/version';

// ---- The texts this flow shows.

const DOWNLOAD = 'Download these copies';
const KEEP = 'Keep these copies';
const REMOVE = 'I have saved the file — remove these copies';
const ONE_UPLOADED = '1 project uploaded to the cloud. Its copy in this browser was removed.';
const TWO_UPLOADED = '2 projects uploaded to the cloud. Their copies in this browser were removed.';
const SKIPPED =
  'These projects were already in your cloud, so they were not uploaded. This browser still has its own copy ' +
  'of each, which may differ from the cloud version:';
const SKIPPED_P1 = 'Local Plan (named Cloud Plan in the cloud)';
const SEEING_CLOUD = 'You are now seeing the cloud versions.';
const KEEP_WARNING =
  'If you keep them: the next time you open GanttApp in this browser, it opens in local mode and shows these ' +
  'copies, not your cloud data, and changes are saved only in this browser. To return to your cloud data, open ' +
  "Settings and choose Upload to Cloud: that skips these projects again and replaces your cloud settings with this " +
  "browser's. Cancel there keeps GanttApp in local mode. Signing out now removes the copies from this browser; " +
  'signing out on a later visit leaves them here for anyone who uses it.';
const KEPT = "Kept this browser's copies. GanttApp will ask about them again next time.";
const REMOVED = "This browser's copies were removed.";
// The buttons of today's question after an upload, and of the question that replaces it.
const QUESTION_BUTTONS = ['Clear Local Data', 'Keep Local Copies', DOWNLOAD, KEEP];

const MODE_KEY = 'ganttapp-storage-mode';
const STAMP = '2026-01-01T00:00:00.000Z';

// ---- The cloud

const releaseDoc = (name: string, order: number) =>
  ({ name, startDate: '2026-02-02', earlyFinishDate: '2026-03-02', lateFinishDate: '2026-04-01', order });
const projectDoc = (name: string) => ({
  name, owner: 'u1', members: { u1: 'owner', u2: 'editor' }, finishDate: null, order: 0, schemaVersion: 1,
  _originRef: 'uid:u1', createdAt: STAMP, updatedAt: STAMP,
  _changeLog: [{ timestamp: STAMP, uid: 'u2', action: 'update', target: 'project:p1' }],
});
const SETTINGS = {
  schemaVersion: 1,
  chartColors: {
    solidBar: '#112233', hatchedBar: '#223344', todayLine: '#334455', finishDateLine: '#445566',
    mostLikelyLine: '#556677', completedBar: '#667788', inProgressBar: '#778899',
  },
  legendLabels: { solidBar: 'Cloud Solid', hatchedBar: 'Cloud Hatched' },
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
  globalWorkDays: [1, 2, 3, 4, 5, 6],
};

/** p1, named "Cloud Plan" in the cloud, with its own release and snapshot. */
function seedCloudPlan() {
  const docs = fake.state.docs;
  docs.set('ganttapp_projects/p1', projectDoc('Cloud Plan'));
  docs.set('ganttapp_projects/p1/releases/rc1', releaseDoc('Cloud Release', 0));
  docs.set('ganttapp_projects/p1/snapshots/sc1', { name: 'Cloud Snap', timestamp: STAMP, releases: [releaseDoc('Cloud Release', 0)] });
  docs.set('ganttapp_settings/u1', structuredClone(SETTINGS));
}

// ---- This browser

type Stored = { id: string; projectId: string; name: string };
const localRelease = (id: string, projectId: string, name: string) =>
  ({ id, projectId, name, startDate: '2026-05-04', earlyFinishDate: '2026-06-01', lateFinishDate: '2026-06-29' });
const localSnapshot = (id: string, projectId: string, name: string) =>
  ({ id, projectId, name, timestamp: STAMP, releases: [] });

interface LocalContent {
  projects: { id: string; name: string }[];
  releases: ReturnType<typeof localRelease>[];
  snapshots: ReturnType<typeof localSnapshot>[];
}

function storeLocally({ projects, releases, snapshots }: LocalContent) {
  localStorage.setItem('ganttAppData', JSON.stringify({ projects, releases, preparedBy: 'Local Person' }));
  localStorage.setItem('ganttAppSnapshots', JSON.stringify(snapshots));
}

/** p1, also in the cloud under another name, and L1, never uploaded. */
const MIXED: LocalContent = {
  projects: [{ id: 'p1', name: 'Local Plan' }, { id: 'L1', name: 'Fresh Plan' }],
  releases: [localRelease('lr1', 'p1', 'Local Release'), localRelease('lrL1', 'L1', 'Fresh Release')],
  snapshots: [localSnapshot('ls1', 'p1', 'Local Snap'), localSnapshot('lsL1', 'L1', 'Fresh Snap')],
};
const NORTH: LocalContent = {
  projects: [{ id: 'N1', name: 'North Plan' }],
  releases: [localRelease('nr1', 'N1', 'North Release')],
  snapshots: [localSnapshot('ns1', 'N1', 'North Snap')],
};
const NORTH_AND_SOUTH: LocalContent = {
  projects: [...NORTH.projects, { id: 'N2', name: 'South Plan' }],
  releases: [...NORTH.releases, localRelease('nr2', 'N2', 'South Release')],
  snapshots: [...NORTH.snapshots, localSnapshot('ns2', 'N2', 'South Snap')],
};

function localAppData(): { projects: { id: string; name: string }[]; releases: Stored[] } {
  return JSON.parse(localStorage.getItem('ganttAppData') ?? '{"projects":[],"releases":[]}');
}
const localProjects = () => localAppData().projects.map((p) => [p.id, p.name]);
const projectIdsIn = (stored: string | null) =>
  (JSON.parse(stored ?? '{"projects":[]}') as { projects: { id: string }[] }).projects.map((p) => p.id);
const localReleases = () => localAppData().releases.map((r) => [r.id, r.projectId]);
const localSnapshots = () =>
  (JSON.parse(localStorage.getItem('ganttAppSnapshots') ?? '[]') as Stored[]).map((s) => [s.id, s.projectId]);

const cloudProjects = () => Array.from(fake.state.docs.entries())
  .filter(([path]) => /^ganttapp_projects\/[^/]+$/.test(path))
  .map(([path, data]) => ({ id: path.split('/')[1], name: String(data.name) }));
const cloudProjectNames = () => cloudProjects().map((p) => p.name).sort();

// ---- Every cloud service the app makes, so each is disposed after the test,
// and whether each load succeeded.

type Service = FirestoreGanttStorageServiceImpl;
const proto = FirestoreGanttStorageServiceImpl.prototype;
const realLoad = proto.loadAppData;
const realLoadSnapshots = proto.loadSnapshots;
const services = new Set<Service>();
const loads: { service: Service; ok: boolean }[] = [];

function trackServices() {
  vi.spyOn(proto, 'loadAppData').mockImplementation(function (this: Service) {
    services.add(this);
    const result = realLoad.call(this);
    // Bookkeeping only: the caller gets the same promise, so its timing is unchanged.
    void result.then((data) => { loads.push({ service: this, ok: data !== null }); });
    return result;
  });
  vi.spyOn(proto, 'loadSnapshots').mockImplementation(function (this: Service) {
    services.add(this);
    return realLoadSnapshots.call(this);
  });
}

function disposeServices() {
  services.forEach((service) => service.dispose());
  services.clear();
}

const goodLoads = () => loads.filter((l) => l.ok).length;

// ---- What the user sees

function ScreenProbe() {
  const { data } = useAppData();
  return (
    <ul aria-label="Projects on screen">
      {data.projects.map((p) => <li key={p.id}>{p.name}</li>)}
    </ul>
  );
}

const onScreen = () => within(screen.getByRole('list', { name: 'Projects on screen' }))
  .queryAllByRole('listitem')
  .map((item) => item.textContent ?? '');
// Whitespace is collapsed, and a typographic apostrophe counts as a plain one.
const normalize = (text: string | null) => (text ?? '').replace(/\u2019/g, "'").replace(/\s+/g, ' ').trim();
const pageText = () => normalize(document.body.textContent);
/** The text of every short element that mentions `about`, so a failure shows what was said instead. */
const linesAbout = (about: string) => Array.from(document.body.querySelectorAll('*'))
  .map((el) => normalize(el.textContent))
  .filter((text) => text.includes(about) && text.length < 200);
const questionButtons = () => QUESTION_BUTTONS.filter((name) => screen.queryByRole('button', { name }));
const cloudRadio = () => screen.getByRole('radio', { name: /Cloud \(sync across devices\)/ });
const localRadio = () => screen.getByRole('radio', { name: /Local \(browser only\)/ });

// ---- Helpers

/** Real time, in small steps, so no single act() spans a render that matters. */
const wait = async (ms: number) => {
  for (let t = 0; t < ms; t += 5) await act(() => new Promise<void>((resolve) => { setTimeout(resolve, 5); }));
};

async function openSettings() {
  render(<FullWrapper><SettingsTab /><ScreenProbe /></FullWrapper>);
  await screen.findByText(/Signed in as/);
}

/** Settings: choose Cloud, confirm the upload, and wait until the switch is done. */
async function chooseCloudAndUpload() {
  await waitFor(() => expect(cloudRadio()).toBeEnabled());
  fireEvent.click(cloudRadio());
  fireEvent.click(await screen.findByRole('button', { name: 'Upload to Cloud' }));
  await waitFor(() => expect(cloudRadio()).toBeChecked(), { timeout: 3000 });
}

const waitForOnScreen = (name: string) => waitFor(() => expect(onScreen()).toContain(name), { timeout: 3000 });

/** Waits for a cloud load after the `mark`-th to succeed, then for what it set off to finish. */
async function waitForGoodLoad(mark: number) {
  await waitFor(() => expect(goodLoads()).toBeGreaterThan(mark), { timeout: 3000 });
  await wait(300);
}

/** Closes the page and opens it again over the same browser storage and cloud. */
async function nextVisit() {
  await wait(300);
  cleanup();
  disposeServices();
  await openSettings();
}

/** Answers the question about this browser's copies, if it is asked: download, then remove. */
async function downloadAndRemoveIfAsked() {
  const download = screen.queryByRole('button', { name: DOWNLOAD });
  if (!download) return;
  fireEvent.click(download);
  fireEvent.click(await screen.findByRole('button', { name: REMOVE }));
}

/** Answers the question about this browser's copies, if it is asked: keep them. */
function keepIfAsked() {
  const keep = screen.queryByRole('button', { name: KEEP });
  if (keep) fireEvent.click(keep);
}

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const downloads: Blob[] = [];

type DownloadedFile = { projects: { id: string; name: string }[]; releases: Stored[]; snapshots?: Stored[] };
async function downloadedFile(): Promise<DownloadedFile> {
  await waitFor(() => expect(downloads).toHaveLength(1));
  return JSON.parse(await downloads[0].text());
}

describe('switching to the cloud with projects in this browser, end to end', () => {
  beforeEach(() => {
    fake.reset();
    localStorage.clear();
    // Satisfy the terms-of-service gate from the local cache, so the user is
    // let through by the check itself rather than by its error fallback.
    localStorage.setItem('spert_tos_accepted_version', TOS_VERSION);
    loads.length = 0;
    downloads.length = 0;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    // The download: keep the file instead of handing it to the browser.
    URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
      downloads.push(blob as Blob);
      return `blob:test/${downloads.length}`;
    });
    URL.revokeObjectURL = vi.fn();
    trackServices();
  });

  afterEach(() => {
    cleanup();
    disposeServices();
    vi.restoreAllMocks();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('removes the uploaded copy at once, names the skipped one, and lets the user download it and then remove it', async () => {
    // Fails when the cleanup after a switch to the cloud is removed: the
    // switch result naming each project, the removal of uploaded copies, and
    // the question about the skipped ones (the switch cleanup). The cloud
    // reads are slow here, so the question is on screen before the cloud
    // data is, and the sentence about seeing the cloud versions must wait.
    seedCloudPlan();
    storeLocally(MIXED);
    fake.config.readDelayMs = 100;
    await openSettings();
    await chooseCloudAndUpload();

    await waitFor(() => expect(localProjects()).toEqual([['p1', 'Local Plan']]), { timeout: 500 });
    expect(localReleases()).toEqual([['lr1', 'p1']]);
    expect(localSnapshots()).toEqual([['ls1', 'p1']]);
    // ...and only after its upload: every write of it was committed while this browser still held it.
    const uploadedId = cloudProjects().find((p) => p.name === 'Fresh Plan')!.id;
    const uploadCommits = fake.state.commits.filter((c) => c.paths.some((path) => path.includes(uploadedId)));
    expect(uploadCommits.length).toBeGreaterThan(0);
    expect(uploadCommits.filter((c) => !projectIdsIn(c.local).includes('L1'))).toEqual([]);

    expect(pageText()).toContain(ONE_UPLOADED);
    expect(pageText()).toContain(SKIPPED);
    expect(pageText()).toContain(SKIPPED_P1);
    expect(onScreen()).not.toContain('Cloud Plan'); // the cloud data has not arrived yet
    expect(pageText()).not.toContain(SEEING_CLOUD);

    await waitForOnScreen('Cloud Plan');
    await waitFor(() => expect(pageText()).toContain(SEEING_CLOUD));

    expect(screen.queryByRole('button', { name: REMOVE })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: DOWNLOAD }));
    const file = await downloadedFile();
    expect(file.projects.map((p) => [p.id, p.name])).toEqual([['p1', 'Local Plan']]);
    expect(file.releases.map((r) => [r.id, r.projectId, r.name])).toEqual([['lr1', 'p1', 'Local Release']]);
    expect((file.snapshots ?? []).map((s) => [s.id, s.projectId, s.name])).toEqual([['ls1', 'p1', 'Local Snap']]);

    fireEvent.click(await screen.findByRole('button', { name: REMOVE }));
    await waitFor(() => expect(localStorage.getItem('ganttAppData')).toBeNull());
    expect(localStorage.getItem('ganttAppSnapshots')).toBeNull();
    await waitFor(() => expect(pageText()).toContain(REMOVED));
  });

  it('after downloading and removing the copies, the next visit opens on the cloud data with one document per project', async () => {
    // Fails when the switch cleanup is removed: this browser then still holds
    // the copies, so the next visit stops in local mode to ask about them.
    // The checks on the cloud data also fail when both the context's and the
    // service's guards are removed (both): the save that ran before the first
    // cloud load then wrote this browser's version of the skipped project
    // over the cloud's.
    seedCloudPlan();
    storeLocally(MIXED);
    fake.config.readDelayMs = 60;
    await openSettings();
    await chooseCloudAndUpload();
    await waitForOnScreen('Cloud Plan');
    await downloadAndRemoveIfAsked();

    await nextVisit();
    await waitFor(() => expect(cloudRadio()).toBeChecked());
    await waitForOnScreen('Cloud Plan');
    expect(onScreen().sort()).toEqual(['Cloud Plan', 'Fresh Plan']);
    expect(screen.queryByRole('button', { name: 'Upload to Cloud' })).toBeNull();
    expect(questionButtons()).toEqual([]);
    await wait(300);
    expect(cloudProjectNames()).toEqual(['Cloud Plan', 'Fresh Plan']);
  });

  it('keeping the copies: the warning comes first, the copy stays, and the next visit asks again without duplicating anything', async () => {
    // Fails when the switch cleanup is removed: there is no warning and no
    // Keep to choose. The checks after the second confirm also fail when both
    // the context's and the service's guards are removed (both): the first
    // switch then wrote this browser's version of the project over the
    // cloud's.
    seedCloudPlan();
    storeLocally(MIXED);
    fake.config.readDelayMs = 60;
    await openSettings();
    await chooseCloudAndUpload();
    await waitForOnScreen('Cloud Plan');

    expect(pageText()).toContain(KEEP_WARNING);
    fireEvent.click(screen.getByRole('button', { name: KEEP }));
    await waitFor(() => expect(pageText()).toContain(KEPT));
    expect(localProjects()).toContainEqual(['p1', 'Local Plan']);

    await nextVisit();
    const upload = await screen.findByRole('button', { name: 'Upload to Cloud' });
    expect(localRadio()).toBeChecked();
    expect(onScreen()).toEqual(['Local Plan']);

    fireEvent.click(upload);
    await waitFor(() => expect(pageText()).toContain(SKIPPED), { timeout: 3000 });
    expect(pageText()).toContain(SKIPPED_P1);
    expect(screen.getByRole('button', { name: KEEP })).toBeInTheDocument();
    await waitForOnScreen('Cloud Plan');
    await wait(300);
    expect(cloudProjectNames()).toEqual(['Cloud Plan', 'Fresh Plan']);
  });

  it('keeping the copies, then signing out in the same visit, removes them from this browser', async () => {
    // Passes before and after the change: signing out while the cloud is in
    // use already removes this browser's copies, and the warning says so.
    // This checks that copies the user chose to keep are no exception. Keep
    // is pressed where it is offered; before the change it is not.
    seedCloudPlan();
    storeLocally(MIXED);
    fake.config.readDelayMs = 60;
    await openSettings();
    await chooseCloudAndUpload();
    await waitForOnScreen('Cloud Plan');
    keepIfAsked();

    fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));
    await wait(300);

    expect(localProjects()).not.toContainEqual(['p1', 'Local Plan']);
    expect(localSnapshots()).not.toContainEqual(['ls1', 'p1']);
  });

  it('keeping the copies, then signing out on a later visit, leaves them in this browser', async () => {
    // Passes before and after the change: on a later visit the app is in
    // local mode until the question is answered, and signing out in local
    // mode removes nothing, as the warning says. Keep is pressed where it is
    // offered; before the change it is not.
    seedCloudPlan();
    storeLocally(MIXED);
    fake.config.readDelayMs = 60;
    await openSettings();
    await chooseCloudAndUpload();
    await waitForOnScreen('Cloud Plan');
    keepIfAsked();

    await nextVisit();
    await screen.findByRole('button', { name: 'Upload to Cloud' });
    expect(localRadio()).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));
    await wait(300);

    expect(localProjects()).toContainEqual(['p1', 'Local Plan']);
    expect(localSnapshots()).toContainEqual(['ls1', 'p1']);
  });

  it('every project uploaded: no question, a status line saying so, and no copies left in this browser', async () => {
    // Fails when the switch cleanup is removed: today's question about
    // clearing local data appears instead, and the copies stay.
    fake.state.docs.set('ganttapp_settings/u1', structuredClone(SETTINGS));
    storeLocally(NORTH_AND_SOUTH);
    fake.config.snapshots = 'cache-first';
    await openSettings();
    const mark = goodLoads();
    await chooseCloudAndUpload();
    await waitForGoodLoad(mark);

    expect(questionButtons()).toEqual([]);
    expect(linesAbout('uploaded to the cloud')).toContain(TWO_UPLOADED);
    expect(localStorage.getItem('ganttAppData')).toBeNull();
    expect(localStorage.getItem('ganttAppSnapshots')).toBeNull();
  });

  it('the one project uploaded: the status line speaks of one copy', async () => {
    // Fails when the switch cleanup is removed, as above.
    fake.state.docs.set('ganttapp_settings/u1', structuredClone(SETTINGS));
    storeLocally(NORTH);
    fake.config.snapshots = 'cache-first';
    await openSettings();
    const mark = goodLoads();
    await chooseCloudAndUpload();
    await waitForGoodLoad(mark);

    expect(questionButtons()).toEqual([]);
    expect(linesAbout('uploaded to the cloud')).toContain(ONE_UPLOADED);
    expect(localStorage.getItem('ganttAppData')).toBeNull();
    expect(localStorage.getItem('ganttAppSnapshots')).toBeNull();
  });

  it('a copy kept by an earlier version is uploaded once more, then removed here, and is not uploaded again', async () => {
    // Fails when the switch cleanup is removed: the copy then stays in this
    // browser, and every later confirm would upload it again. Uploading it
    // once more is expected: its id here was never in the cloud, because the
    // earlier upload gave the cloud copy a new id.
    fake.state.docs.set('ganttapp_projects/c-old', projectDoc('Kept Plan'));
    fake.state.docs.set('ganttapp_projects/c-old/releases/kr-old', releaseDoc('Kept Release', 0));
    fake.state.docs.set('ganttapp_settings/u1', structuredClone(SETTINGS));
    storeLocally({
      projects: [{ id: 'K1', name: 'Kept Plan' }],
      releases: [localRelease('kr1', 'K1', 'Kept Release')],
      snapshots: [localSnapshot('ks1', 'K1', 'Kept Snap')],
    });
    localStorage.setItem(MODE_KEY, 'cloud');
    fake.config.snapshots = 'cache-first';
    await openSettings();
    const mark = goodLoads();
    fireEvent.click(await screen.findByRole('button', { name: 'Upload to Cloud' }));
    await waitFor(() => expect(cloudRadio()).toBeChecked(), { timeout: 3000 });
    await waitForGoodLoad(mark);

    const kept = cloudProjects().filter((p) => p.name === 'Kept Plan').map((p) => p.id);
    expect(kept).toHaveLength(2);
    expect(kept).toContain('c-old');
    expect(kept).not.toContain('K1');
    expect(localProjects()).toEqual([]);
    expect(localSnapshots()).toEqual([]);

    const markAgain = goodLoads();
    await nextVisit();
    await waitFor(() => expect(cloudRadio()).toBeChecked());
    await waitForGoodLoad(markAgain);
    expect(screen.queryByRole('button', { name: 'Upload to Cloud' })).toBeNull();
    expect(cloudProjectNames()).toEqual(['Kept Plan', 'Kept Plan']);
  });
});
