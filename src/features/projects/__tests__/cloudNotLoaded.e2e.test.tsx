// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// End to end: what the app does on a visit whose first cloud load failed.
// Nothing on screen then came from the cloud, and the app has nothing to
// compare an edit against, so it must not write anything to the cloud:
// deleting or copying a project, importing, and saving or deleting a
// snapshot are refused with a message saying so, and nothing changes on
// screen that a reload would undo.
//
// Nothing of the app is mocked. The auth, storage and app-data providers,
// the cloud service and its save executor, the Settings tab, and the real
// project, snapshot and import hooks all run. Only firebase/* (an in-memory
// Firestore and a signed-in user) and lib/firebase are replaced. A small
// probe calls the real hooks and shows what is on screen.
//
// The load fails because reading the settings document is refused. Listing
// projects and snapshots still works, which is how a snapshot write could
// still reach the cloud.
//
// Two ways into that state:
// - a visit in cloud mode with nothing stored in this browser. Nothing is on
//   screen, which is enough for the snapshot and import tests;
// - a visit in cloud mode with this browser's own copies of both cloud
//   projects. The upload prompt is confirmed, both are skipped as already in
//   the cloud, and the load that follows fails. The copies stay on screen,
//   and the project delete and copy act on what is on screen.
//
// Downloading every project as a file reads the cloud without changing what
// the app compares its saves with. In the state above the message and the
// refusals stay; after a download in a session whose load succeeded, the next
// save does not delete a project added on another device since the load.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor, within, cleanup, configure } from '@testing-library/react';

// A cloud load in jsdom can outlast Testing Library's 1 s default wait on a busy
// machine (CI, or the whole suite at once); one of these tests timed out there.
configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 20000 });
import { useState } from 'react';

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
  const state = { docs: new Map<string, Data>(), writes: [] as Write[], generation: 0 };
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
import { SettingsTab } from '../../settings/SettingsTab';
import { useAppData } from '../../../context/AppDataContext';
import { useStorage } from '../../../context/StorageContext';
import { useProjects } from '../useProjects';
import { useSnapshots } from '../../chart/useSnapshots';
import { useImportState } from '../hooks/useImportState';
import { FirestoreGanttStorageServiceImpl } from '../../../shared/storage/firestore-gantt-storage-service';
import { DEFAULT_CHART_COLORS } from '../../../shared/utils';
import { TOS_VERSION } from '../../../lib/version';

const REASON = 'Your cloud data did not load, so changes cannot be saved. Reload the page to try again.';
const DELETE_REFUSED = `This project was not deleted. ${REASON}`;
const COPY_REFUSED = `This project was not copied. ${REASON}`;
const IMPORT_REFUSED = `Nothing was imported. ${REASON}`;
const SNAPSHOT_SAVE_REFUSED = `Snapshot not saved. ${REASON}`;
const SNAPSHOT_DELETE_REFUSED = `Snapshot not deleted. ${REASON}`;
const LOAD_FAILED_SHOWN =
  'Cloud sync error: Your cloud data did not load, so changes are not being saved. Reload the page to try again.';
const SAVE_FAILED_SHOWN = 'Cloud sync error: Service temporarily unavailable. Please try again later.';
const SEEING_CLOUD = 'You are now seeing the cloud versions.';
const FAILURE = Object.assign(new Error('raw transport detail'), { code: 'unavailable' });
const MODE_KEY = 'ganttapp-storage-mode';
const S1_PATH = 'ganttapp_projects/p1/snapshots/s1';
const STAMP = '2026-01-01T00:00:00.000Z';

// ---- The cloud: two shared projects, p1 with two snapshots, and a complete settings document.

const releaseDoc = (name: string, order: number) =>
  ({ name, startDate: '2026-02-02', earlyFinishDate: '2026-03-02', lateFinishDate: '2026-04-01', order });
const projectDoc = (name: string, order: number) => ({
  name, owner: 'u1', members: { u1: 'owner', u2: 'editor' }, finishDate: null, order, schemaVersion: 1,
  _originRef: 'uid:u1', createdAt: STAMP, updatedAt: STAMP,
  _changeLog: [{ timestamp: STAMP, uid: 'u2', action: 'update', target: 'project:p1' }],
});
const snapshotDoc = (name: string) => ({ name, timestamp: STAMP, releases: [releaseDoc('Design', 0)] });
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

function seedCloud() {
  const docs = fake.state.docs;
  docs.set('ganttapp_projects/p1', projectDoc('Alpha', 0));
  docs.set('ganttapp_projects/p1/releases/r1', releaseDoc('Design', 0));
  docs.set('ganttapp_projects/p1/releases/r2', releaseDoc('Build', 1));
  docs.set(S1_PATH, snapshotDoc('Sprint 1'));
  docs.set('ganttapp_projects/p1/snapshots/s2', snapshotDoc('Sprint 2'));
  docs.set('ganttapp_projects/p2', projectDoc('Beta', 1));
  docs.set('ganttapp_projects/p2/releases/r3', releaseDoc('Launch', 0));
  docs.set('ganttapp_settings/u1', structuredClone(SETTINGS));
}

// This browser's own copies of both cloud projects, under the same ids.
const LOCAL_COPIES = {
  projects: [{ id: 'p1', name: 'Alpha' }, { id: 'p2', name: 'Beta' }],
  releases: [{
    id: 'lr1', projectId: 'p1', name: 'Local Design',
    startDate: '2026-02-02', earlyFinishDate: '2026-03-02', lateFinishDate: '2026-04-01',
  }],
};

// ---- Import files: one project, with a release and a snapshot.

const importedContent = {
  projects: [{ id: 'imp1', name: 'Imported Plan' }],
  releases: [{
    id: 'imr1', projectId: 'imp1', name: 'Imported Release',
    startDate: '2026-05-04', earlyFinishDate: '2026-06-01', lateFinishDate: '2026-06-29',
  }],
  snapshots: [{ id: 'ims1', projectId: 'imp1', name: 'Imported Snap', timestamp: STAMP, releases: [] }],
};
const PROJECT_EXPORT_FILE = { ...importedContent, _exportType: 'ganttapp-project-export' };
const ALL_PROJECTS_FILE = { ...importedContent, preparedBy: 'Imported Person', _exportType: 'ganttapp-all-projects' };

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

// ---- The probe: the real hooks, with a button for each action.

function Probe() {
  const { data, updateData, loading } = useAppData();
  const { storage } = useStorage();
  const [selected, setSelected] = useState('p1');
  const { deleteProject, cloneProject } = useProjects();
  const snapshots = useSnapshots('p1');
  const importer = useImportState({
    data,
    storage,
    updateData,
    onReplaceSnapshots: snapshots.replaceAllSnapshots,
    selectedProjectId: selected,
    setSelectedProjectId: setSelected,
    appDataLoading: loading,
  });
  const saveSnapshot = () => snapshots.saveSnapshot({
    releases: data.releases.filter((r) => r.projectId === 'p1'),
    chartColors: DEFAULT_CHART_COLORS,
    legendLabels: { solidBar: 'Planned', hatchedBar: 'Uncertain' },
    preparedBy: '',
  });
  return (
    <section>
      <ul aria-label="Projects on screen">
        {data.projects.map((p) => <li key={p.id}>{p.name}</li>)}
      </ul>
      <p data-testid="import-banner">{importer.importBanner?.text ?? ''}</p>
      <p data-testid="import-preview">{importer.importPreview?.mode ?? 'none'}</p>
      <input type="file" aria-label="Import file" onChange={importer.handleImport} />
      <button onClick={() => deleteProject('p1', selected, setSelected)}>Delete project p1</button>
      <button onClick={() => cloneProject('p1')}>Copy project p1</button>
      <button onClick={() => cloneProject('p2')}>Copy project p2</button>
      <button onClick={saveSnapshot}>Save a snapshot</button>
      <button onClick={() => snapshots.deleteSnapshot('s1')}>Delete snapshot s1</button>
      <button onClick={importer.handleConfirmMerge}>Confirm the import</button>
      <button onClick={() => importer.onModeChange('replace-all')}>Use replace-all</button>
      <button onClick={importer.openReplaceAllConfirm}>Replace all</button>
      <button onClick={importer.handleConfirmReplaceAll}>Yes, replace everything</button>
    </section>
  );
}

// ---- Helpers

/** Real time, in small steps, so no single act() spans a render that matters. */
const wait = async (ms: number) => {
  for (let t = 0; t < ms; t += 5) await act(() => new Promise<void>((resolve) => { setTimeout(resolve, 5); }));
};

const renderApp = () => render(<FullWrapper><SettingsTab /><Probe /></FullWrapper>);

const projectList = () => screen.getByRole('list', { name: 'Projects on screen' });
const onScreen = () => within(projectList()).queryAllByRole('listitem').map((item) => item.textContent ?? '');

/**
 * Watches the projects on screen from now on. The returned function stops
 * watching and gives every state seen that differed from the starting one,
 * however briefly: a project that appears is soon dropped again when the
 * cloud refuses a listener on a project it does not hold.
 */
function watchScreen() {
  const start = JSON.stringify(onScreen());
  const changed: string[][] = [];
  const observer = new MutationObserver(() => {
    const now = onScreen();
    if (JSON.stringify(now) !== start) changed.push(now);
  });
  observer.observe(projectList(), { childList: true, subtree: true, characterData: true });
  return () => {
    observer.disconnect();
    return changed;
  };
}
const snapshotDocs = () =>
  Object.fromEntries(Array.from(fake.state.docs.entries()).filter(([path]) => path.includes('/snapshots/')));
const snapshotWritesSince = (mark: number) =>
  fake.state.writes.slice(mark).filter((w) => w.path.includes('/snapshots/'));
const cloudProjectIds = () =>
  Array.from(fake.state.docs.keys()).filter((p) => /^ganttapp_projects\/[^/]+$/.test(p)).map((p) => p.split('/')[1]).sort();

/** Keeps each downloaded file instead of handing it to the browser. */
function captureDownloads(): Blob[] {
  const files: Blob[] = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation((file: Blob | MediaSource) => {
    files.push(file as Blob);
    return `blob:test/${files.length}`;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  return files;
}
const bannerText = () => screen.getByTestId('import-banner').textContent;
const claimEvent = () => act(() => {
  window.dispatchEvent(new CustomEvent('spert:models-changed', { detail: { claimed: [] } }));
});

function chooseImportFile(content: unknown) {
  const file = new File([JSON.stringify(content)], 'import.json', { type: 'application/json' });
  fireEvent.change(screen.getByLabelText('Import file'), { target: { files: [file] } });
}

function commitField(label: string, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input); // the attribution fields commit on blur, not on change
}

/** Waits for a cloud load to fail, then long enough for anything it set off to finish. */
async function settleAfterFailedLoad() {
  await waitFor(() => expect(loads.some((l) => !l.ok)).toBe(true), { timeout: 3000 });
  await wait(300);
}

/** Cloud mode, nothing stored in this browser; the first cloud load fails. */
async function openWithFailedCloudLoad() {
  localStorage.setItem(MODE_KEY, 'cloud');
  fake.config.denySettingsRead = true;
  renderApp();
  await settleAfterFailedLoad();
}

/**
 * Cloud mode with this browser's copies of p1 and p2. The upload prompt is
 * confirmed, both are skipped, and the cloud load after the switch fails.
 */
async function confirmUploadWithFailedCloudLoad() {
  localStorage.setItem(MODE_KEY, 'cloud');
  localStorage.setItem('ganttAppData', JSON.stringify(LOCAL_COPIES));
  fake.config.denySettingsRead = true;
  renderApp();
  fireEvent.click(await screen.findByRole('button', { name: 'Upload to Cloud' }));
  await settleAfterFailedLoad();
}

describe('a visit whose first cloud load failed, end to end', () => {
  let alertSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fake.reset();
    seedCloud();
    localStorage.clear();
    // Satisfy the terms-of-service gate from the local cache, so the user is
    // let through by the check itself rather than by its error fallback.
    localStorage.setItem('spert_tos_accepted_version', TOS_VERSION);
    loads.length = 0;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'prompt').mockReturnValue('Sprint 3');
    trackServices();
  });

  afterEach(() => {
    cleanup();
    disposeServices();
    vi.restoreAllMocks();
  });

  it('refuses to delete a project: its cloud snapshots stay, it stays on screen, and the message says so', async () => {
    // Fails when the check that runs before the delete changes anything is
    // removed: the project then vanishes from the screen, although the cloud
    // service still refuses to delete its snapshots. With that check and the
    // service's refusal both removed, the delete removes the snapshots from
    // the cloud. The service's refusal removed alone changes nothing here:
    // the check refuses first.
    await confirmUploadWithFailedCloudLoad();
    const before = snapshotDocs();
    expect(Object.keys(before)).toEqual([S1_PATH, 'ganttapp_projects/p1/snapshots/s2']);
    expect(onScreen()).toEqual(['Alpha', 'Beta']);

    const screenChanges = watchScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Delete project p1' }));
    await wait(300);

    expect(snapshotDocs()).toEqual(before);
    expect(screenChanges()).toEqual([]);
    expect(alertSpy.mock.calls).toEqual([[DELETE_REFUSED]]);
  });

  it('refuses to copy a project that has snapshots: no snapshot is written and no copy appears', async () => {
    // Fails when the check that runs before the copy changes anything is
    // removed: a copy then appears, although the service still refuses its
    // snapshots. With that check and the service's refusal both removed, the
    // copy writes snapshots to the cloud. The service's refusal removed alone
    // changes nothing here: the check refuses first.
    await confirmUploadWithFailedCloudLoad();
    expect(onScreen()).toEqual(['Alpha', 'Beta']);
    const before = snapshotDocs();
    const mark = fake.state.writes.length;

    const screenChanges = watchScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Copy project p1' }));
    await wait(300);

    expect(snapshotWritesSince(mark)).toEqual([]);
    expect(snapshotDocs()).toEqual(before);
    expect(screenChanges()).toEqual([]);
    expect(alertSpy.mock.calls).toEqual([[COPY_REFUSED]]);
  });

  it('refuses to copy a project that has no snapshots: no copy appears, and the message says so', async () => {
    // A project with no snapshots never reaches a snapshot write, so only
    // the check that runs before the copy changes anything can refuse it,
    // and that check asks the cloud service (the service).
    await confirmUploadWithFailedCloudLoad();
    expect(onScreen()).toEqual(['Alpha', 'Beta']);

    const screenChanges = watchScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Copy project p2' }));
    await wait(300);

    expect(screenChanges()).toEqual([]);
    expect(alertSpy.mock.calls).toEqual([[COPY_REFUSED]]);
  });

  it('refuses to save a snapshot', async () => {
    // Fails when the service's refusal is removed (the service).
    await openWithFailedCloudLoad();
    const before = snapshotDocs();
    const mark = fake.state.writes.length;

    fireEvent.click(screen.getByRole('button', { name: 'Save a snapshot' }));
    await wait(300);

    expect(snapshotWritesSince(mark)).toEqual([]);
    expect(snapshotDocs()).toEqual(before);
    expect(alertSpy.mock.calls).toEqual([[SNAPSHOT_SAVE_REFUSED]]);
  });

  it('refuses to delete a snapshot, so it stays in the cloud', async () => {
    // Fails when the service's refusal is removed (the service).
    await openWithFailedCloudLoad();
    const s1 = fake.state.docs.get(S1_PATH);
    expect(s1).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Delete snapshot s1' }));
    await wait(300);

    expect(fake.state.docs.get(S1_PATH)).toEqual(s1);
    expect(alertSpy.mock.calls).toEqual([[SNAPSHOT_DELETE_REFUSED]]);
  });

  it('refuses a project import: an error, the cloud snapshots unchanged, nothing new on screen', async () => {
    // Fails when the check that runs before the import changes anything is
    // removed: the imported project then appears, although the service still
    // refuses the snapshot write and the message says nothing was imported.
    // With that check and the service's refusal both removed, the import
    // reports success. The service's refusal removed alone changes nothing
    // here: the check refuses first.
    await openWithFailedCloudLoad();
    const before = snapshotDocs();
    const screenChanges = watchScreen();

    chooseImportFile(PROJECT_EXPORT_FILE);
    // In cloud mode an import always shows its preview first.
    await waitFor(() => expect(screen.getByTestId('import-preview')).toHaveTextContent('merge'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm the import' }));
    await waitFor(() => expect(bannerText()).not.toBe(''));
    await wait(100);

    expect(bannerText()).toBe(IMPORT_REFUSED);
    expect(snapshotDocs()).toEqual(before);
    expect(screenChanges()).toEqual([]);
  });

  it('refuses a replace-all import: an error, the cloud snapshots unchanged, the screen unchanged', async () => {
    // Fails under the same removals as the project import above, in the same way.
    await openWithFailedCloudLoad();
    const before = snapshotDocs();
    const screenChanges = watchScreen();

    chooseImportFile(ALL_PROJECTS_FILE);
    await waitFor(() => expect(screen.getByTestId('import-preview')).toHaveTextContent('merge'));
    fireEvent.click(screen.getByRole('button', { name: 'Use replace-all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, replace everything' }));
    await waitFor(() => expect(bannerText()).not.toBe(''));
    await wait(100);

    expect(bannerText()).toBe(IMPORT_REFUSED);
    expect(snapshotDocs()).toEqual(before);
    expect(screenChanges()).toEqual([]);
  });

  it('clears the load-failure message when the user switches to local storage', async () => {
    // The message is the cloud service's report of the failed load (the
    // service). Fails also when switching to local storage stops clearing it.
    await openWithFailedCloudLoad();
    expect(await screen.findByText(LOAD_FAILED_SHOWN)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /Local \(browser only\)/ }));

    await waitFor(() => expect(screen.queryByText(LOAD_FAILED_SHOWN)).toBeNull());
  });

  it('clears the load-failure message when a later load succeeds', async () => {
    // The message is the cloud service's report of the failed load, and a
    // later good load clears it (the service).
    await openWithFailedCloudLoad();
    expect(await screen.findByText(LOAD_FAILED_SHOWN)).toBeInTheDocument();

    fake.config.denySettingsRead = false;
    claimEvent();

    await waitFor(() => expect(onScreen()).toEqual(['Alpha', 'Beta']));
    await waitFor(() => expect(screen.queryByText(LOAD_FAILED_SHOWN)).toBeNull());
  });

  it('a successful load leaves the message of a failed save in place', async () => {
    // Passes before and after the change. It fails if a successful load
    // starts clearing every cloud sync error instead of only its own.
    localStorage.setItem(MODE_KEY, 'cloud');
    renderApp();
    await waitFor(() => expect(onScreen()).toEqual(['Alpha', 'Beta']));
    await wait(400);

    fake.config.failCommits = FAILURE;
    commitField('Name', 'Ann');
    expect(await screen.findByText(SAVE_FAILED_SHOWN)).toBeInTheDocument();

    fake.config.failCommits = null;
    fake.state.docs.set('ganttapp_projects/p3', projectDoc('Gamma', 2));
    const mark = fake.state.writes.length;
    claimEvent();
    await waitFor(() => expect(onScreen()).toContain('Gamma'));
    await wait(300);

    // The reload saved nothing, so no successful save can have cleared the message.
    expect(fake.state.writes.slice(mark)).toEqual([]);
    expect(screen.getByText(SAVE_FAILED_SHOWN)).toBeInTheDocument();
  });
});

describe('downloading every project as a file, end to end', () => {
  let alertSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fake.reset();
    seedCloud();
    localStorage.clear();
    // The terms-of-service gate, satisfied from the local cache as above.
    localStorage.setItem('spert_tos_accepted_version', TOS_VERSION);
    loads.length = 0;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    trackServices();
  });

  afterEach(() => {
    cleanup();
    disposeServices();
    vi.restoreAllMocks();
  });

  it('after a failed first load, leaves the message and the refusals in place, and a delete still changes nothing', async () => {
    // The download reads the cloud for its file and nothing more. Fails when
    // the download reads by loading, or when its read takes what it read as
    // the data saves are compared with: the message then goes, the prompt
    // says the cloud versions are on screen when this browser's copies are,
    // and the delete is no longer refused, so it removes the project's
    // snapshots from the cloud.
    await confirmUploadWithFailedCloudLoad();
    expect(await screen.findByText(LOAD_FAILED_SHOWN)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download these copies' })).toBeInTheDocument();
    const service = loads.find((l) => !l.ok)!.service;
    const before = snapshotDocs();
    const files = captureDownloads();

    // The cloud can be read again, so the download's read succeeds: a file
    // is made only from a read that found projects.
    fake.config.denySettingsRead = false;
    fireEvent.click(screen.getByRole('button', { name: 'Download All Projects as JSON' }));
    await waitFor(() => expect(files).toHaveLength(1));
    await wait(100);
    const afterDownload = {
      message: screen.queryByText(LOAD_FAILED_SHOWN) !== null,
      canWrite: service.canWrite(),
      prompt: screen.queryByRole('button', { name: 'Download these copies' }) !== null,
      seeingCloud: screen.queryByText(SEEING_CLOUD) !== null,
    };

    const screenChanges = watchScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Delete project p1' }));
    await wait(300);

    // One assertion, so that a failure shows every part of what happened.
    expect({
      ...afterDownload,
      snapshots: Object.keys(snapshotDocs()),
      screenChanges: screenChanges(),
      alerts: alertSpy.mock.calls,
    }).toEqual({
      message: true, canWrite: false, prompt: true, seeingCloud: false,
      snapshots: Object.keys(before), screenChanges: [], alerts: [[DELETE_REFUSED]],
    });
  });

  it('in a session whose load succeeded, the next save deletes no project added on another device', async () => {
    // The screen does not show a project added elsewhere after the load, so
    // a save compared with a read that holds it deletes it. Fails when the
    // download reads by loading, or when its read takes what it read as the
    // data saves are compared with. The first live update comes from the
    // cache, as in a browser.
    fake.config.snapshots = 'cache-first';
    localStorage.setItem(MODE_KEY, 'cloud');
    renderApp();
    await waitFor(() => expect(onScreen()).toEqual(['Alpha', 'Beta']));
    await wait(400);
    expect(cloudProjectIds()).toEqual(['p1', 'p2']);

    fake.state.docs.set('ganttapp_projects/p3', projectDoc('Gamma', 2));
    fake.state.docs.set('ganttapp_projects/p3/releases/r9', releaseDoc('Elsewhere', 0));
    const files = captureDownloads();
    fireEvent.click(screen.getByRole('button', { name: 'Download All Projects as JSON' }));
    await waitFor(() => expect(files).toHaveLength(1));

    commitField('Name', 'Ann');
    await wait(400);

    const settings = fake.state.docs.get('ganttapp_settings/u1') as { exportAttribution?: { name: string } };
    expect({
      editSaved: settings.exportAttribution?.name,
      projects: cloudProjectIds(),
      itsRelease: fake.state.docs.has('ganttapp_projects/p3/releases/r9'),
    }).toEqual({ editSaved: 'Ann', projects: ['p1', 'p2', 'p3'], itsRelease: true });
  });
});
