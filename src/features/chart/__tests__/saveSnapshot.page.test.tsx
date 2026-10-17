// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The page's snapshot paths, through the REAL page (pages/index.tsx) rendered
// inside the providers pages/_app.tsx uses, in local mode.
//
// Saving: what a snapshot taken through the chart's Save Snapshot button
// freezes, read back from what was stored (localStorage `ganttAppSnapshots`).
// The labels use three fixtures, each asserting all five keys, because one
// fixture masks another's breakage: a project override hides the global label,
// and a global label hides the default.
//   1. the project overrides all five labels (globals set too, and different);
//   2. no override, a distinct global label for each key;
//   3. no override, empty global labels: each key falls back to its default.
// The other fields share one fixture with distinct values everywhere.
//
// Wiring: an import's snapshots reach the chart (the page passes the snapshot
// hook's replace-all to the Projects tab), and the chart's delete removes a
// snapshot (the page passes the hook's delete to the SnapshotBar).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, configure } from '@testing-library/react';
import Home from '../../../../pages/index';
import { FullWrapper } from '../../../test/FullWrapper';

// The whole page renders in each test: allow for a loaded machine.
configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 20000 });

vi.mock('../../../lib/firebase', () => ({
  auth: null,
  db: null,
  isFirebaseAvailable: false,
  getSendInvitationEmail: () => null,
  getClaimPendingInvitations: () => null,
  getRevokeInvite: () => null,
  getResendInvite: () => null,
}));

vi.mock('firebase/auth', () => {
  class MockGoogleAuthProvider { addScope = vi.fn(); }
  class MockOAuthProvider { addScope = vi.fn(); constructor() {} }
  return {
    onAuthStateChanged: vi.fn((_auth: unknown, callback: (user: null) => void) => {
      callback(null);
      return vi.fn();
    }),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    GoogleAuthProvider: MockGoogleAuthProvider,
    OAuthProvider: MockOAuthProvider,
  };
});

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(),
}));

const APP_DATA_KEY = 'ganttAppData';
const SNAPSHOTS_KEY = 'ganttAppSnapshots';
const SNAPSHOT_NAME = 'Quarter Review';

type Stored = Record<string, unknown>;

function seed(appData: Stored, snapshots?: Stored[]) {
  localStorage.setItem(APP_DATA_KEY, JSON.stringify(appData));
  if (snapshots) localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
}

function storedSnapshots(): Stored[] {
  const raw = localStorage.getItem(SNAPSHOTS_KEY);
  return raw ? (JSON.parse(raw) as Stored[]) : [];
}

const storedSnapshotIds = () => storedSnapshots().map((s) => s.id);

const release = (id: string, projectId: string, name: string, extra: Stored = {}) => ({
  id,
  projectId,
  name,
  startDate: '2026-01-05',
  earlyFinishDate: '2026-02-02',
  lateFinishDate: '2026-03-02',
  ...extra,
});

const PROJECT = { id: 'proj-alpha', name: 'Alpha Platform' };
const ONE_RELEASE = [release('rel-one', 'proj-alpha', 'Release One')];

// Renders the page, opens the chart, saves a snapshot through its button and
// returns the one snapshot that was stored.
async function saveSnapshotThroughThePage(): Promise<Stored> {
  render(<Home />, { wrapper: FullWrapper });
  fireEvent.click(await screen.findByRole('button', { name: 'Gantt Chart' }));
  fireEvent.click(await screen.findByRole('button', { name: /Save Snapshot/ }));
  // The chip appears once the write has resolved.
  await screen.findByRole('button', { name: SNAPSHOT_NAME });
  expect(window.prompt).toHaveBeenCalledTimes(1);
  const stored = storedSnapshots();
  expect(stored).toHaveLength(1);
  expect(stored[0].name).toBe(SNAPSHOT_NAME);
  expect(stored[0].projectId).toBe('proj-alpha');
  return stored[0];
}

const GLOBAL_LABELS = {
  solidBar: 'Global solid label',
  hatchedBar: 'Global hatched label',
  finishDateLine: 'Global finish label',
  mostLikelyLine: 'Global likely label',
  inProgress: 'Global progress label',
};

const PROJECT_LABELS = {
  solidBar: 'Alpha solid override',
  hatchedBar: 'Alpha hatched override',
  finishDateLine: 'Alpha finish override',
  mostLikelyLine: 'Alpha likely override',
  inProgress: 'Alpha progress override',
};

describe('pages/index — saving a snapshot through the page', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, 'prompt').mockReturnValue(SNAPSHOT_NAME);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('legend labels', () => {
    it('freezes the project override of every label when the project overrides all five', async () => {
      seed({
        projects: [{ ...PROJECT, legendLabels: PROJECT_LABELS }],
        releases: ONE_RELEASE,
        legendLabels: GLOBAL_LABELS,
      });
      const snapshot = await saveSnapshotThroughThePage();
      expect(snapshot.legendLabels).toEqual(PROJECT_LABELS);
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('freezes the global label of every key when the project has no override', async () => {
      seed({
        projects: [PROJECT],
        releases: ONE_RELEASE,
        legendLabels: GLOBAL_LABELS,
      });
      const snapshot = await saveSnapshotThroughThePage();
      expect(snapshot.legendLabels).toEqual(GLOBAL_LABELS);
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('freezes the default of every key when there is no override and no global label', async () => {
      seed({
        projects: [PROJECT],
        releases: ONE_RELEASE,
        legendLabels: { solidBar: '', hatchedBar: '', finishDateLine: '', mostLikelyLine: '', inProgress: '' },
      });
      const snapshot = await saveSnapshotThroughThePage();
      expect(snapshot.legendLabels).toEqual({
        solidBar: 'Design, Code, Test',
        hatchedBar: 'Delivery Uncertainty',
        finishDateLine: 'Project Finish Date',
        mostLikelyLine: 'Most Likely Finish',
        inProgress: 'In Progress',
      });
      expect(window.alert).not.toHaveBeenCalled();
    });
  });

  describe('the other fields', () => {
    const CHART_COLORS = {
      solidBar: '#123456',
      hatchedBar: '#234567',
      todayLine: '#345678',
      finishDateLine: '#456789',
      mostLikelyLine: '#56789a',
      completedBar: '#6789ab',
      inProgressBar: '#789abc',
    };

    beforeEach(() => {
      seed({
        projects: [
          { ...PROJECT, finishDate: '2026-11-20' },
          { id: 'proj-beta', name: 'Beta Service', finishDate: '2026-12-11' },
        ],
        releases: [
          release('rel-one', 'proj-alpha', 'Release One'),
          release('rel-two', 'proj-alpha', 'Release Two (hidden)', { hidden: true }),
          release('rel-three', 'proj-alpha', 'Release Three'),
          release('rel-beta', 'proj-beta', 'Beta Release'),
        ],
        chartColors: CHART_COLORS,
        preparedBy: 'Pat Planner',
        todayDateOverride: '2026-04-17',
      });
    });

    it('freezes only the visible releases of the selected project', async () => {
      const snapshot = await saveSnapshotThroughThePage();
      const ids = (snapshot.releases as Stored[]).map((r) => r.id);
      expect(ids).toEqual(['rel-one', 'rel-three']);
      expect(ids).not.toContain('rel-two');
      expect(ids).not.toContain('rel-beta');
    });

    it('freezes the selected project finish date', async () => {
      const snapshot = await saveSnapshotThroughThePage();
      expect(snapshot.projectFinishDate).toBe('2026-11-20');
    });

    it('freezes the chart colours', async () => {
      const snapshot = await saveSnapshotThroughThePage();
      expect(snapshot.chartColors).toEqual(CHART_COLORS);
    });

    it('freezes the prepared-by name', async () => {
      const snapshot = await saveSnapshotThroughThePage();
      expect(snapshot.preparedBy).toBe('Pat Planner');
    });

    it('freezes the status date', async () => {
      const snapshot = await saveSnapshotThroughThePage();
      expect(snapshot.todayDateOverride).toBe('2026-04-17');
    });
  });
});

describe('pages/index — snapshot wiring', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows and stores the snapshots of a file imported on the Projects tab', async () => {
    // Empty workspace: a full-workspace file is applied without a preview.
    render(<Home />, { wrapper: FullWrapper });
    const label = await screen.findByLabelText('Import projects from JSON');
    const input = label.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File([JSON.stringify({
      _exportType: 'ganttapp-all-projects',
      projects: [{ id: 'proj-imported', name: 'Imported Plan' }],
      releases: [release('rel-imported', 'proj-imported', 'Imported Release')],
      snapshots: [{
        id: 'snap-imported',
        projectId: 'proj-imported',
        timestamp: '2026-05-01T12:00:00.000Z',
        name: 'Imported Baseline',
        releases: [release('rel-imported', 'proj-imported', 'Imported Release')],
      }],
    })], 'import.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByText('All data replaced. 1 project imported.');
    fireEvent.click(screen.getByRole('button', { name: 'Gantt Chart' }));
    expect(screen.getByRole('button', { name: 'Imported Baseline' })).toBeInTheDocument();
    expect(storedSnapshotIds()).toEqual(['snap-imported']);
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('deletes a snapshot through the chart snapshot bar and its confirmation', async () => {
    seed(
      { projects: [PROJECT], releases: ONE_RELEASE },
      [
        { id: 'snap-keep', projectId: 'proj-alpha', timestamp: '2026-03-01T12:00:00.000Z', name: 'Sprint 3 Review', releases: ONE_RELEASE },
        { id: 'snap-gone', projectId: 'proj-alpha', timestamp: '2026-04-01T12:00:00.000Z', name: 'Sprint 4 Review', releases: ONE_RELEASE },
      ]
    );
    render(<Home />, { wrapper: FullWrapper });
    fireEvent.click(await screen.findByRole('button', { name: 'Gantt Chart' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sprint 4 Review' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete snapshot' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(storedSnapshotIds()).toEqual(['snap-keep']);
      expect(screen.queryByRole('button', { name: 'Sprint 4 Review' })).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'Sprint 3 Review' })).toBeInTheDocument();
    expect(window.alert).not.toHaveBeenCalled();
  });
});
