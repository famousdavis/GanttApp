// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// ErrorBoundary through the page (v0.29.11) — the boundary around the current
// tab must not restart a healthy tab when the selected project changes. An
// import or a delete on the Projects tab can move the selection, and the tab's
// own state (an import's result or error, a draft in the new-project form)
// must survive it. A view that could not be displayed is shown again once the
// selected project changes.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, configure } from '@testing-library/react';
import Home from '../../../../pages/index';
import { FullWrapper } from '../../../test/FullWrapper';
import { useAppData } from '../../../context/AppDataContext';

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

// The real Releases tab, except that it cannot render one project's data.
vi.mock('../../../features/releases/ReleasesTab', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../features/releases/ReleasesTab')>();
  function ReleasesTabFailingForOneProject(props: Parameters<typeof actual.ReleasesTab>[0]) {
    if (props.selectedProjectId === 'proj-unreadable') throw new Error('a value the view cannot render');
    return <actual.ReleasesTab {...props} />;
  }
  return { ...actual, ReleasesTab: ReleasesTabFailingForOneProject };
});

const APP_DATA_KEY = 'ganttAppData';
const SNAPSHOTS_KEY = 'ganttAppSnapshots';
const QUOTA_TEXT = 'Storage quota exceeded. Please export your data and clear some space.';
const REPLACED_ONE = 'All data replaced. 1 project imported.';
const MERGED_ONE = '1 project added.';
const NOTICE_TEXT = 'This view could not be displayed.';

type Stored = Record<string, unknown>;

const release = (id: string, projectId: string, name: string) => ({
  id,
  projectId,
  name,
  startDate: '2026-01-05',
  earlyFinishDate: '2026-02-02',
  lateFinishDate: '2026-03-02',
});

const IMPORTED_PROJECT = { id: 'proj-imported', name: 'Imported Plan' };
const IMPORTED_RELEASE = release('rel-imported', 'proj-imported', 'Imported Release');
const IMPORTED_SNAPSHOT = {
  id: 'snap-imported',
  projectId: 'proj-imported',
  timestamp: '2026-05-01T12:00:00.000Z',
  name: 'Imported Baseline',
  releases: [IMPORTED_RELEASE],
};

function seed(appData: Stored) {
  localStorage.setItem(APP_DATA_KEY, JSON.stringify(appData));
}

function seedAlpha() {
  seed({
    projects: [{ id: 'proj-alpha', name: 'Alpha Platform' }],
    releases: [release('rel-one', 'proj-alpha', 'Release One')],
  });
}

function exportFile(exportType: string, projects: Stored[], releases: Stored[], snapshots: Stored[]): File {
  return new File(
    [JSON.stringify({ _exportType: exportType, projects, releases, snapshots })],
    'import.json',
    { type: 'application/json' }
  );
}

const workspaceFile = (projects: Stored[], releases: Stored[], snapshots: Stored[]) =>
  exportFile('ganttapp-all-projects', projects, releases, snapshots);

const importedWorkspaceFile = () =>
  workspaceFile([IMPORTED_PROJECT], [IMPORTED_RELEASE], [IMPORTED_SNAPSHOT]);

const importedProjectFile = () =>
  exportFile('ganttapp-project-export', [IMPORTED_PROJECT], [IMPORTED_RELEASE], [IMPORTED_SNAPSHOT]);

async function pickFile(file: File) {
  const label = await screen.findByLabelText('Import projects from JSON');
  const input = label.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [file] } });
}

async function replaceViaPreview() {
  fireEvent.click(await screen.findByRole('radio', { name: 'Replace entire workspace' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Replace All Data' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Replace' }));
}

function failSnapshotWrites() {
  const realSetItem = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
    if (key === SNAPSHOTS_KEY) throw new DOMException('full', 'QuotaExceededError');
    return realSetItem.call(this, key, value);
  });
}

// Stands in for a change made outside the tab (an import, a delete, another
// collaborator): removes the first project from the shared data.
function RemoveFirstProject() {
  const { data, updateData } = useAppData();
  const first = data.projects[0];
  const remove = () => {
    if (!first) return;
    updateData({
      ...data,
      projects: data.projects.filter(p => p.id !== first.id),
      releases: data.releases.filter(r => r.projectId !== first.id),
    });
  };
  return <button type="button" onClick={remove}>Remove the first project</button>;
}

describe('the Projects tab when an import or a delete moves the selected project', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the result of a Replace All into an empty workspace', async () => {
    render(<Home />, { wrapper: FullWrapper });
    await pickFile(importedWorkspaceFile());
    expect(await screen.findByText(REPLACED_ONE)).toBeInTheDocument();
    expect(screen.getByText('Imported Plan')).toBeInTheDocument();
  });

  it('shows the error of a Replace All into an empty workspace whose snapshot write fails', async () => {
    failSnapshotWrites();
    render(<Home />, { wrapper: FullWrapper });
    await pickFile(importedWorkspaceFile());
    // The data was applied, so the snapshot write was reached.
    await screen.findByText('Imported Plan');
    expect(await screen.findByText(QUOTA_TEXT)).toBeInTheDocument();
  });

  it('shows the result of a Replace All whose file does not hold the selected project', async () => {
    seedAlpha();
    render(<Home />, { wrapper: FullWrapper });
    await screen.findByText('Alpha Platform');
    await pickFile(workspaceFile(
      [{ id: 'proj-other', name: 'Other Plan' }],
      [release('rel-other', 'proj-other', 'Other Release')],
      []
    ));
    await replaceViaPreview();
    expect(await screen.findByText(REPLACED_ONE)).toBeInTheDocument();
    expect(screen.queryByText('Alpha Platform')).not.toBeInTheDocument();
  });

  it('shows the result of a Replace All whose file keeps the selected project', async () => {
    seedAlpha();
    render(<Home />, { wrapper: FullWrapper });
    await screen.findByText('Alpha Platform');
    await pickFile(workspaceFile(
      [{ id: 'proj-alpha', name: 'Alpha Restored' }],
      [release('rel-one', 'proj-alpha', 'Release One')],
      []
    ));
    await replaceViaPreview();
    expect(await screen.findByText(REPLACED_ONE)).toBeInTheDocument();
    expect(screen.getByText('Alpha Restored')).toBeInTheDocument();
  });

  it('keeps a draft in the new-project form when the selected project is deleted', async () => {
    seed({
      projects: [{ id: 'proj-alpha', name: 'Alpha Platform' }, { id: 'proj-beta', name: 'Beta Platform' }],
      releases: [],
    });
    render(<Home />, { wrapper: FullWrapper });
    await screen.findByText('Alpha Platform');
    fireEvent.change(screen.getByPlaceholderText('Project name'), { target: { value: 'Draft Gamma' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete project' })[0]);
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Alpha Platform')).not.toBeInTheDocument());
    expect(screen.getByText('Beta Platform')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Project name')).toHaveValue('Draft Gamma');
  });

  it('shows the result of a project file merged into an empty workspace', async () => {
    render(<Home />, { wrapper: FullWrapper });
    await pickFile(importedProjectFile());
    expect(await screen.findByText(MERGED_ONE)).toBeInTheDocument();
    expect(screen.getByText('Imported Plan')).toBeInTheDocument();
  });

  it('shows the error of a project file merged into an empty workspace whose snapshot write fails', async () => {
    failSnapshotWrites();
    render(<Home />, { wrapper: FullWrapper });
    await pickFile(importedProjectFile());
    // The data was applied, so the snapshot write was reached.
    await screen.findByText('Imported Plan');
    expect(await screen.findByText(QUOTA_TEXT)).toBeInTheDocument();
  });
});

describe('a view that could not be displayed', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    // React reports a caught render error to console.error, as does the boundary.
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is shown again for the newly selected project when the selection changes from outside the tab', async () => {
    seed({
      projects: [{ id: 'proj-unreadable', name: 'Unreadable Plan' }, { id: 'proj-working', name: 'Working Plan' }],
      releases: [
        release('rel-unreadable', 'proj-unreadable', 'Unreadable Release'),
        release('rel-working', 'proj-working', 'Working Release'),
      ],
    });
    render(<><Home /><RemoveFirstProject /></>, { wrapper: FullWrapper });
    await screen.findByText('Unreadable Plan');
    fireEvent.click(screen.getByRole('button', { name: 'Releases' }));
    expect(await screen.findByText(NOTICE_TEXT)).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledWith('[GanttApp] view error:', 'a value the view cannot render', expect.any(String));

    fireEvent.click(screen.getByRole('button', { name: 'Remove the first project' }));
    expect(await screen.findByText('Working Release')).toBeInTheDocument();
    expect(screen.queryByText(NOTICE_TEXT)).not.toBeInTheDocument();
  });
});
