// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { AppDataProvider } from '../../../context/AppDataContext';
import { StorageProvider } from '../../../context/StorageContext';
import { AuthProvider } from '../../../context/AuthContext';
import { ThemeProvider } from '../../../context/ThemeContext';
import { ProjectsTab } from '../ProjectsTab';
import { AppData } from '../../../shared/types/app';
import { Project, Release } from '../../../shared/types/models';

// Lets a test stand in for what ProjectsTab reads from the auth, storage and
// app-data contexts. Left null, each hook is the real one, read from the real
// providers, so the tests that do not set it see no difference.
const ctxOverride = vi.hoisted(() => ({
  signedInUser: null as { uid: string } | null,
  auth: null as Record<string, unknown> | null,
  storage: null as Record<string, unknown> | null,
  appData: null as Record<string, unknown> | null,
}));

vi.mock('../../../context/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../context/AuthContext')>();
  type Auth = ReturnType<typeof actual.useAuth>;
  const useAuth = (): Auth => {
    if (ctxOverride.auth) return ctxOverride.auth as unknown as Auth;
    const real = actual.useAuth();
    if (!ctxOverride.signedInUser) return real;
    return { ...real, user: ctxOverride.signedInUser as unknown as Auth['user'], isAuthenticated: true };
  };
  return { ...actual, useAuth };
});

vi.mock('../../../context/StorageContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../context/StorageContext')>();
  type Storage = ReturnType<typeof actual.useStorage>;
  const useStorage = (): Storage => (ctxOverride.storage as unknown as Storage | null) ?? actual.useStorage();
  return { ...actual, useStorage };
});

vi.mock('../../../context/AppDataContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../context/AppDataContext')>();
  type AppDataValue = ReturnType<typeof actual.useAppData>;
  const useAppData = (): AppDataValue =>
    (ctxOverride.appData as unknown as AppDataValue | null) ?? actual.useAppData();
  return { ...actual, useAppData };
});

// Mock firebase modules
vi.mock('../../../lib/firebase', () => ({
  auth: null,
  db: null,
  isFirebaseAvailable: false,
  getSendInvitationEmail: () => null,
  getClaimPendingInvitations: () => null,
  getRevokeInvite: () => null,
  getResendInvite: () => null,
}));

const mockOnAuthStateChanged = vi.fn();
vi.mock('firebase/auth', () => {
  class MockGoogleAuthProvider { addScope = vi.fn(); }
  class MockOAuthProvider { addScope = vi.fn(); constructor(_id: string) {} }
  return {
    onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    GoogleAuthProvider: MockGoogleAuthProvider,
    OAuthProvider: MockOAuthProvider,
  };
});

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  collection: vi.fn(),
  writeBatch: vi.fn(() => ({ set: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) })),
}));

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Test Project',
    ...overrides,
  };
}

function makeRelease(overrides: Partial<Release> = {}): Release {
  return {
    id: 'r1',
    projectId: 'p1',
    name: 'Release 1',
    startDate: '2026-01-01',
    earlyFinishDate: '2026-03-01',
    lateFinishDate: '2026-06-01',
    ...overrides,
  };
}

function seedData(data: AppData) {
  localStorage.setItem('ganttAppData', JSON.stringify(data));
}

function TestWrapper({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <StorageProvider>
        <ThemeProvider>
          <AppDataProvider>
            {children}
          </AppDataProvider>
        </ThemeProvider>
      </StorageProvider>
    </AuthProvider>
  );
}

function renderProjectsTab(props: Partial<React.ComponentProps<typeof ProjectsTab>> = {}) {
  const defaultProps = {
    selectedProjectId: 'p1',
    setSelectedProjectId: vi.fn(),
    setActiveTab: vi.fn(),
    draggedProjectId: null,
    onProjectDragStart: vi.fn(),
    onProjectDragOver: vi.fn(),
    onProjectDragEnd: vi.fn(),
    onReplaceSnapshots: vi.fn().mockResolvedValue(undefined),
    ...props,
  };

  return {
    ...render(
      <TestWrapper>
        <ProjectsTab {...defaultProps} />
      </TestWrapper>
    ),
    props: defaultProps,
  };
}

describe('ProjectsTab', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: null) => void) => {
      callback(null);
      return vi.fn();
    });
  });

  describe('rendering', () => {
    it('renders empty state when no projects exist', () => {
      renderProjectsTab();
      expect(screen.getByText(/No projects yet/)).toBeTruthy();
    });

    it('renders project list when projects exist', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' }), makeProject({ id: 'p2', name: 'Beta' })],
        releases: [],
      });

      renderProjectsTab();
      await waitFor(() => {
        expect(screen.getByText('Alpha')).toBeTruthy();
      });
      expect(screen.getByText('Beta')).toBeTruthy();
    });

    it('shows release count for each project', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [
          makeRelease({ id: 'r1', projectId: 'p1' }),
          makeRelease({ id: 'r2', projectId: 'p1', name: 'Release 2' }),
        ],
      });

      renderProjectsTab();
      await waitFor(() => {
        expect(screen.getByText(/2 releases/)).toBeTruthy();
      });
    });

    it('shows finish date for projects that have one', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha', finishDate: '2026-12-31' })],
        releases: [],
      });

      renderProjectsTab();
      await waitFor(() => {
        expect(screen.getByText(/finish:/)).toBeTruthy();
      });
    });

    it('renders Import button at zero projects (Export All hidden)', () => {
      renderProjectsTab();
      // v19.0 — Import always visible, Export All hidden when no projects.
      expect(screen.getByText(/Import/)).toBeTruthy();
      expect(screen.queryByText(/Export All/)).toBeNull();
    });

    it('renders Export All and Import in toolbar when projects exist (v19.0)', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });
      renderProjectsTab();
      await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());
      expect(screen.getByText(/Export All/)).toBeTruthy();
      expect(screen.getByText(/Import/)).toBeTruthy();
    });
  });

  describe('add project form', () => {
    it('renders project name input', () => {
      renderProjectsTab();
      expect(screen.getByPlaceholderText('Project name')).toBeTruthy();
    });

    it('renders Add Project button', () => {
      renderProjectsTab();
      expect(screen.getByText('Add Project')).toBeTruthy();
    });

    it('adds project when name is entered and button is clicked', () => {
      renderProjectsTab({ selectedProjectId: '' });

      const input = screen.getByPlaceholderText('Project name');
      fireEvent.change(input, { target: { value: 'New Project' } });
      fireEvent.click(screen.getByText('Add Project'));

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects).toHaveLength(1);
      expect(stored.projects[0].name).toBe('New Project');
    });

    it('clears input after adding project', () => {
      renderProjectsTab({ selectedProjectId: '' });

      const input = screen.getByPlaceholderText('Project name') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'New Project' } });
      fireEvent.click(screen.getByText('Add Project'));

      expect(input.value).toBe('');
    });
  });

  describe('edit project', () => {
    // v19.0 — Edit is now a PencilIconButton with aria-label="Edit project".
    // window.scrollTo isn't defined in jsdom, so mock it for these tests.
    beforeEach(() => {
      vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    });

    it('shows Update and Cancel buttons in edit mode', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      renderProjectsTab();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Edit project' })).toBeTruthy();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Edit project' }));

      expect(screen.getByText('Update')).toBeTruthy();
      expect(screen.getByText('Cancel')).toBeTruthy();
    });

    it('loads project data into form when Edit is clicked', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      renderProjectsTab();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Edit project' })).toBeTruthy();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Edit project' }));

      const nameInput = screen.getByPlaceholderText('Project name') as HTMLInputElement;
      expect(nameInput.value).toBe('Alpha');
    });

    it('cancels edit and clears form on Cancel click', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      renderProjectsTab();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Edit project' })).toBeTruthy();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Edit project' }));
      fireEvent.click(screen.getByText('Cancel'));

      const nameInput = screen.getByPlaceholderText('Project name') as HTMLInputElement;
      expect(nameInput.value).toBe('');
      expect(screen.getByText('Add Project')).toBeTruthy();
    });

    it('calls window.scrollTo when Edit pencil is clicked (v19.0)', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      renderProjectsTab();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Edit project' })).toBeTruthy();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Edit project' }));
      expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
    });
  });

  describe('delete project', () => {
    it('shows confirmation dialog on Delete click', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      renderProjectsTab();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Delete project' })).toBeTruthy();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));

      expect(screen.getByText('Delete Project')).toBeTruthy();
      expect(screen.getByText(/Delete project "Alpha"/)).toBeTruthy();
    });

    it('deletes project when confirmed', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      renderProjectsTab();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Delete project' })).toBeTruthy();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));

      // Click the Delete button in the ConfirmDialog
      fireEvent.click(screen.getByText('Delete'));

      await waitFor(() => {
        const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
        expect(stored.projects).toHaveLength(0);
      });
    });

    it('does not delete when confirmation is cancelled', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      renderProjectsTab();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Delete project' })).toBeTruthy();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));

      // Click Cancel in the ConfirmDialog
      fireEvent.click(screen.getByText('Cancel'));

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects).toHaveLength(1);
    });
  });

  describe('navigation', () => {
    it('calls setActiveTab and setSelectedProjectId on tile click', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      const { props } = renderProjectsTab();
      await waitFor(() => {
        expect(screen.getByLabelText('Open releases for Alpha')).toBeTruthy();
      });
      fireEvent.click(screen.getByLabelText('Open releases for Alpha'));

      expect(props.setActiveTab).toHaveBeenCalledWith('releases');
      expect(props.setSelectedProjectId).toHaveBeenCalledWith('p1');
    });
  });

  describe('finish date validation', () => {
    it('shows error for date outside 2000-2050 range', () => {
      renderProjectsTab();

      const dateInputs = document.querySelectorAll('input[type="date"]');
      const finishDateInput = dateInputs[0] as HTMLInputElement;

      fireEvent.change(finishDateInput, { target: { value: '1999-01-01' } });
      fireEvent.blur(finishDateInput);

      expect(screen.getByText('Date must be between 2000 and 2050')).toBeTruthy();
    });

    it('clears error when date is emptied', () => {
      renderProjectsTab();

      const dateInputs = document.querySelectorAll('input[type="date"]');
      const finishDateInput = dateInputs[0] as HTMLInputElement;

      fireEvent.change(finishDateInput, { target: { value: '1999-01-01' } });
      fireEvent.blur(finishDateInput);
      expect(screen.getByText('Date must be between 2000 and 2050')).toBeTruthy();

      fireEvent.change(finishDateInput, { target: { value: '' } });
      fireEvent.blur(finishDateInput);
      expect(screen.queryByText('Date must be between 2000 and 2050')).toBeNull();
    });
  });

  describe('export', () => {
    it('hides Export All button entirely when no projects exist (v19.0)', () => {
      renderProjectsTab();
      // v19.0 — semantic shift: button is no longer rendered (was previously rendered & disabled).
      expect(screen.queryByText(/Export All/)).toBeNull();
    });

    it('renders Export All button when projects exist', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      renderProjectsTab();
      await waitFor(() => {
        expect(screen.getByText('Alpha')).toBeTruthy();
      });
      expect(screen.getByText(/Export All/)).toBeTruthy();
    });

    // v19.0 — per-tile ExportIconButton on each project tile
    it('renders an ExportIconButton on each project tile (v19.0)', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });
      renderProjectsTab();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Export project' })).toBeTruthy();
      });
    });

    it('renders a CloneIconButton on each project tile (v19.0)', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });
      renderProjectsTab();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Clone project' })).toBeTruthy();
      });
    });

    it('clones a project when CloneIconButton is clicked (v19.0)', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });
      renderProjectsTab();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Clone project' })).toBeTruthy();
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Clone project' }));
      });
      await waitFor(() => {
        const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
        expect(stored.projects).toHaveLength(2);
        expect(stored.projects[1].name).toBe('Alpha - Copy (1)');
      });
    });
  });

  // v0.24.0 — Smart Import with Per-Project Conflict Resolution.
  // File-input simulation pattern: construct a File and drive `<input type="file">`
  // via fireEvent.change. Documented at top of ImportPreviewSection.test.tsx.
  describe('Smart Import flow (v0.24.0)', () => {
    function createFile(data: object): File {
      return new File([JSON.stringify(data)], 'test.json', { type: 'application/json' });
    }

    describe('Fast Path 1: ganttapp-project-export with zero conflicts', () => {
      it('applies immediately, no preview, success banner', async () => {
        seedData({
          projects: [makeProject({ id: 'p1', name: 'Alpha' })],
          releases: [],
        });
        renderProjectsTab();
        await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file = createFile({
          _exportType: 'ganttapp-project-export',
          projects: [{ id: 'p2', name: 'Beta' }],
          releases: [],
        });
        fireEvent.change(fileInput, { target: { files: [file] } });

        // No preview rendered.
        expect(screen.queryByTestId('import-preview-section')).toBeNull();
        // Success banner via role=status.
        await waitFor(() => {
          expect(screen.getByRole('status')).toBeTruthy();
        });
        const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
        expect(stored.projects.map((p: Project) => p.name).sort()).toEqual(['Alpha', 'Beta']);
      });
    });

    describe('Fast Path 2: empty workspace + replace-all-shape file', () => {
      it('applies immediately via applyReplaceAll, no preview', async () => {
        seedData({ projects: [], releases: [] });
        const onReplaceSnapshots = vi.fn().mockResolvedValue(undefined);
        renderProjectsTab({ onReplaceSnapshots });

        // Wait for AppDataContext to finish loading so !appDataLoading gate passes.
        await waitFor(() => {
          expect(screen.getByText(/No projects yet/)).toBeTruthy();
        });

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file = createFile({
          _exportType: 'ganttapp-all-projects',
          projects: [{ id: 'p2', name: 'Beta' }],
          releases: [],
        });
        fireEvent.change(fileInput, { target: { files: [file] } });

        await waitFor(() => {
          expect(onReplaceSnapshots).toHaveBeenCalledTimes(1);
        });
        expect(screen.queryByTestId('import-preview-section')).toBeNull();
        expect(screen.queryByText(/replace all existing projects/i)).toBeNull(); // modal not shown
      });
    });

    describe('Preview rendering', () => {
      it('renders preview for ganttapp-project-export with conflicts; no mode selector', async () => {
        seedData({
          projects: [makeProject({ id: 'p1', name: 'Alpha' })],
          releases: [],
        });
        renderProjectsTab();
        await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file = createFile({
          _exportType: 'ganttapp-project-export',
          projects: [{ id: 'p1', name: 'Alpha' }],
          releases: [],
        });
        fireEvent.change(fileInput, { target: { files: [file] } });

        await waitFor(() => {
          expect(screen.getByTestId('import-preview-section')).toBeTruthy();
        });
        expect(screen.queryByRole('radio', { name: /Merge into workspace/ })).toBeNull();
        expect(screen.getByRole('button', { name: 'Confirm Import' })).toBeTruthy();
      });

      it('renders preview with mode selector for ganttapp-all-projects + non-empty workspace; default merge mode', async () => {
        seedData({
          projects: [makeProject({ id: 'p1', name: 'Alpha' })],
          releases: [],
        });
        renderProjectsTab();
        await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file = createFile({
          _exportType: 'ganttapp-all-projects',
          projects: [{ id: 'p1', name: 'Alpha' }, { id: 'p2', name: 'Beta' }],
          releases: [],
        });
        fireEvent.change(fileInput, { target: { files: [file] } });

        await waitFor(() => {
          expect(screen.getByTestId('import-preview-section')).toBeTruthy();
        });
        const mergeRadio = screen.getByRole('radio', { name: /Merge into workspace/ }) as HTMLInputElement;
        expect(mergeRadio.checked).toBe(true);
        expect(screen.getByRole('button', { name: 'Confirm Merge' })).toBeTruthy();
      });

      it('renders preview with default replace-all mode for legacy file + non-empty workspace', async () => {
        seedData({
          projects: [makeProject({ id: 'p1', name: 'Alpha' })],
          releases: [],
        });
        renderProjectsTab();
        await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file = createFile({
          projects: [{ id: 'p2', name: 'Beta' }],
          releases: [],
        });
        fireEvent.change(fileInput, { target: { files: [file] } });

        await waitFor(() => {
          expect(screen.getByTestId('import-preview-section')).toBeTruthy();
        });
        const replaceRadio = screen.getByRole('radio', { name: /Replace entire workspace/ }) as HTMLInputElement;
        expect(replaceRadio.checked).toBe(true);
        expect(screen.getByRole('button', { name: 'Replace All Data' })).toBeTruthy();
      });
    });

    describe('Replace-All modal gate', () => {
      it('clicking Replace All Data opens ConfirmDialog; confirm applies, modal closes', async () => {
        seedData({
          projects: [makeProject({ id: 'p1', name: 'Alpha' })],
          releases: [],
        });
        const onReplaceSnapshots = vi.fn().mockResolvedValue(undefined);
        renderProjectsTab({ onReplaceSnapshots });
        await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file = createFile({
          projects: [{ id: 'p2', name: 'Beta' }],
          releases: [],
        });
        fireEvent.change(fileInput, { target: { files: [file] } });

        await waitFor(() => {
          expect(screen.getByTestId('import-preview-section')).toBeTruthy();
        });
        fireEvent.click(screen.getByRole('button', { name: 'Replace All Data' }));

        // Modal renders.
        await waitFor(() => {
          expect(screen.getByText(/replace all existing projects/i)).toBeTruthy();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Replace' }));

        await waitFor(() => {
          // Modal gone, preview gone, banner appears.
          expect(screen.queryByText(/replace all existing projects/i)).toBeNull();
        });
        const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
        expect(stored.projects[0].name).toBe('Beta');
      });

      it('cancel on Replace modal leaves preview intact', async () => {
        seedData({
          projects: [makeProject({ id: 'p1', name: 'Alpha' })],
          releases: [],
        });
        renderProjectsTab();
        await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file = createFile({
          projects: [{ id: 'p2', name: 'Beta' }],
          releases: [],
        });
        fireEvent.change(fileInput, { target: { files: [file] } });

        await waitFor(() => {
          expect(screen.getByTestId('import-preview-section')).toBeTruthy();
        });
        fireEvent.click(screen.getByRole('button', { name: 'Replace All Data' }));
        await waitFor(() => {
          expect(screen.getByText(/replace all existing projects/i)).toBeTruthy();
        });

        // Click Cancel in the modal — there are now two Cancel buttons in the
        // DOM (modal + preview). Pick the one inside the modal.
        const modalText = screen.getByText(/replace all existing projects/i);
        const modalContainer = modalText.closest('div')?.parentElement?.parentElement as HTMLElement;
        fireEvent.click(within(modalContainer).getByRole('button', { name: 'Cancel' }));

        // Modal gone, preview remains.
        await waitFor(() => {
          expect(screen.queryByText(/replace all existing projects/i)).toBeNull();
        });
        expect(screen.getByTestId('import-preview-section')).toBeTruthy();
        // Original data untouched.
        const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
        expect(stored.projects[0].name).toBe('Alpha');
      });
    });

    describe('Confirm Merge applies decisions', () => {
      it('non-conflicting project: confirmed merge adds project and shows banner', async () => {
        seedData({
          projects: [makeProject({ id: 'p1', name: 'Alpha' })],
          releases: [],
        });
        renderProjectsTab();
        await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        // ganttapp-all-projects + non-empty workspace → preview shown (not Fast Path).
        const file = createFile({
          _exportType: 'ganttapp-all-projects',
          projects: [{ id: 'p2', name: 'Beta' }],
          releases: [],
        });
        fireEvent.change(fileInput, { target: { files: [file] } });

        await waitFor(() => expect(screen.getByTestId('import-preview-section')).toBeTruthy());
        fireEvent.click(screen.getByRole('button', { name: 'Confirm Merge' }));

        await waitFor(() => {
          expect(screen.getByRole('status')).toBeTruthy();
        });
        const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
        expect(stored.projects.map((p: Project) => p.name).sort()).toEqual(['Alpha', 'Beta']);
      });
    });

    describe('Cancel clears preview and file input', () => {
      it('clicking Cancel removes preview from DOM and empties the file input', async () => {
        seedData({
          projects: [makeProject({ id: 'p1', name: 'Alpha' })],
          releases: [],
        });
        renderProjectsTab();
        await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file = createFile({
          _exportType: 'ganttapp-project-export',
          projects: [{ id: 'p1', name: 'Alpha' }],
          releases: [],
        });
        // jsdom keeps a file input's value empty whatever `files` holds, where a
        // browser shows the picked file's name. Give this input the browser's
        // behaviour, so the test can see whether Cancel empties it (an input
        // still holding the file would not fire a change for the same file again).
        let shownValue = `C:\\fakepath\\${file.name}`;
        Object.defineProperty(fileInput, 'value', {
          configurable: true,
          get: () => shownValue,
          set: (v: string) => { shownValue = v; },
        });
        fireEvent.change(fileInput, { target: { files: [file] } });

        await waitFor(() => expect(screen.getByTestId('import-preview-section')).toBeTruthy());
        expect(fileInput.value).toBe('C:\\fakepath\\test.json');

        // Cancel button is in the preview (no modal yet).
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        await waitFor(() => {
          expect(screen.queryByTestId('import-preview-section')).toBeNull();
        });
        expect(fileInput.value).toBe('');
      });
    });

    describe('Smart ID-conflict defaults (pitfall #22 — v0.26.0)', () => {
      it('ALL ID conflicts default to skip (regardless of name match); name conflict → copy', async () => {
        seedData({
          projects: [
            makeProject({ id: 'p1', name: 'Alpha' }),       // ID conflict, names match
            makeProject({ id: 'p2', name: 'Beta original' }), // ID conflict, names differ
            makeProject({ id: 'p4', name: 'Gamma' }),       // for name conflict
          ],
          releases: [],
        });
        renderProjectsTab();
        await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file = createFile({
          _exportType: 'ganttapp-project-export',
          projects: [
            { id: 'p1', name: 'Alpha' },        // type:id, names match — v0.26.0: defaults to 'skip'
            { id: 'p2', name: 'Beta renamed' }, // type:id, names differ → 'skip'
            { id: 'p5', name: 'Gamma' },        // type:name (different ID, same name as p4) → 'copy'
          ],
          releases: [],
        });
        fireEvent.change(fileInput, { target: { files: [file] } });

        await waitFor(() => expect(screen.getByTestId('import-preview-section')).toBeTruthy());

        // p1 group → 'skip' default checked (was conditional 'replace' in v0.24.0; pitfall #22).
        // Matching names is not evidence the import is newer than the workspace.
        const p1Group = screen.getByTestId('conflict-group-p1');
        const p1Skip = within(p1Group).getByRole('radio', { name: 'Keep existing, ignore imported' }) as HTMLInputElement;
        expect(p1Skip.checked).toBe(true);

        // p2 group → 'skip' default checked (consistent with v0.24.0 behavior for diverged names).
        const p2Group = screen.getByTestId('conflict-group-p2');
        const p2Skip = within(p2Group).getByRole('radio', { name: 'Keep existing, ignore imported' }) as HTMLInputElement;
        expect(p2Skip.checked).toBe(true);

        // p5 group → 'copy' default checked (unchanged from v0.24.0).
        const p5Group = screen.getByTestId('conflict-group-p5');
        const p5Copy = within(p5Group).getByRole('radio', { name: 'Add as a copy' }) as HTMLInputElement;
        expect(p5Copy.checked).toBe(true);
      });
    });

    describe('showPreview resets replaceAllPending', () => {
      it('picking a new file while Replace-All modal is open dismisses the modal and re-renders preview', async () => {
        seedData({
          projects: [makeProject({ id: 'p1', name: 'Alpha' })],
          releases: [],
        });
        renderProjectsTab();
        await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file1 = createFile({
          projects: [{ id: 'p2', name: 'Beta' }],
          releases: [],
        });
        fireEvent.change(fileInput, { target: { files: [file1] } });
        await waitFor(() => expect(screen.getByTestId('import-preview-section')).toBeTruthy());

        // Open the Replace-All modal.
        fireEvent.click(screen.getByRole('button', { name: 'Replace All Data' }));
        await waitFor(() => {
          expect(screen.getByText(/replace all existing projects/i)).toBeTruthy();
        });

        // Pick a new file while the modal is open.
        const file2 = createFile({
          _exportType: 'ganttapp-project-export',
          projects: [{ id: 'p3', name: 'Gamma' }],
          releases: [],
        });
        fireEvent.change(fileInput, { target: { files: [file2] } });

        // The Replace-All modal text should be gone (Fast Path 1 triggered or
        // a fresh preview was shown). Either way the modal is dismissed.
        await waitFor(() => {
          expect(screen.queryByText(/replace all existing projects/i)).toBeNull();
        });
      });
    });

    describe('Invalid file shows error banner', () => {
      it('non-JSON file → error banner with exact text "Invalid file format"', async () => {
        renderProjectsTab();

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file = new File(['not valid json {{'], 'bad.json', { type: 'application/json' });
        fireEvent.change(fileInput, { target: { files: [file] } });

        await waitFor(() => {
          expect(screen.getByRole('alert')).toBeTruthy();
        });
        expect(screen.getByText('Invalid file format')).toBeTruthy();
      });
    });
  });

  describe('work week selector (v15.0)', () => {
    it('renders WorkWeekSelector in the Add Project form', () => {
      renderProjectsTab();
      const group = screen.getByRole('group', { name: /work week/i });
      expect(group).toBeTruthy();
    });

    it('renders "custom work week" indicator in list row when project.workDays is set', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha', workDays: [1, 2, 3] })],
        releases: [],
      });

      renderProjectsTab();
      await waitFor(() => {
        expect(screen.getByText('Alpha')).toBeTruthy();
      });
      expect(screen.getByText(/custom work week/)).toBeTruthy();
    });

    it('does NOT render "custom work week" indicator when workDays is undefined', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      renderProjectsTab();
      await waitFor(() => {
        expect(screen.getByText('Alpha')).toBeTruthy();
      });
      expect(screen.queryByText(/custom work week/)).toBeNull();
    });
  });
});


// ==========================================================================
// v0.28.21 — Brief 09 §2b. F10, asserting BOTH halves.
//
// ⚠️ A row that asserted only "the preview survives" would pass on a fix that
// suppresses Escape entirely while the modal is open — modal still open,
// preview untouched — which is indistinguishable from a correct fix and leaves
// the user unable to dismiss the confirmation at all.
// ==========================================================================
describe('Escape on the Replace-All confirmation (v0.28.21)', () => {
  function escapeProbeFile(data: object): File {
    return new File([JSON.stringify(data)], 'test.json', { type: 'application/json' });
  }

  it('F10 — Escape dismisses the confirmation AND leaves the preview intact', async () => {
    seedData({ projects: [makeProject({ id: 'p1', name: 'Alpha' })], releases: [] });
    renderProjectsTab();
    await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [escapeProbeFile({ projects: [{ id: 'p2', name: 'Beta' }], releases: [] })] },
    });
    await waitFor(() => expect(screen.getByTestId('import-preview-section')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Replace All Data' }));
    await waitFor(() => expect(screen.getByText(/replace all existing projects/i)).toBeTruthy());

    fireEvent.keyDown(document, { key: 'Escape' });

    // half 1 — the confirmation is dismissed
    await waitFor(() => {
      expect(screen.queryByText(/replace all existing projects/i)).toBeNull();
    });
    // half 2 — the preview and the user's review survive
    expect(screen.queryByTestId('import-preview-section')).toBeTruthy();
    // and nothing was applied
    const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
    expect(stored.projects[0].name).toBe('Alpha');
  });

  it('F10b — Escape a second time, with the modal closed, cancels the preview', async () => {
    seedData({ projects: [makeProject({ id: 'p1', name: 'Alpha' })], releases: [] });
    renderProjectsTab();
    await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [escapeProbeFile({ projects: [{ id: 'p2', name: 'Beta' }], releases: [] })] },
    });
    await waitFor(() => expect(screen.getByTestId('import-preview-section')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Replace All Data' }));
    await waitFor(() => expect(screen.getByText(/replace all existing projects/i)).toBeTruthy());

    fireEvent.keyDown(document, { key: 'Escape' });   // dismisses the confirmation
    await waitFor(() => expect(screen.queryByText(/replace all existing projects/i)).toBeNull());

    fireEvent.keyDown(document, { key: 'Escape' });   // now cancels the preview
    await waitFor(() => expect(screen.queryByTestId('import-preview-section')).toBeNull());
  });
});

// ==========================================================================
// The tiles, the toolbar's export and import controls, and the share and
// delete dialogs.
// ==========================================================================

const OWNER_UID = 'owner-uid';

/** The tile (the row) that holds a project's name and its buttons. */
function tileOf(name: string): HTMLElement {
  return screen.getByLabelText(`Open releases for ${name}`).parentElement as HTMLElement;
}

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

function pickImportFile(content: object): HTMLInputElement {
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([JSON.stringify(content)], 'import.json', { type: 'application/json' });
  fireEvent.change(fileInput, { target: { files: [file] } });
  return fileInput;
}

const storedProjectIds = () =>
  (JSON.parse(localStorage.getItem('ganttAppData')!).projects as Project[]).map((p) => p.id);

function resetContextOverrides() {
  ctxOverride.signedInUser = null;
  ctxOverride.auth = null;
  ctxOverride.storage = null;
  ctxOverride.appData = null;
}

describe('ProjectsTab tiles, toolbar and dialogs (local mode)', () => {
  let alertSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    resetContextOverrides();
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    resetContextOverrides();
    vi.restoreAllMocks();
  });

  it("a tile's Export downloads that project alone, with only its releases", async () => {
    seedData({
      projects: [makeProject({ id: 'p1', name: 'Alpha' }), makeProject({ id: 'p2', name: 'Beta' })],
      releases: [
        makeRelease({ id: 'r1', projectId: 'p1', name: 'Alpha launch' }),
        makeRelease({ id: 'r2', projectId: 'p2', name: 'Beta launch' }),
      ],
    });
    const files = captureDownloads();
    renderProjectsTab();
    await waitFor(() => expect(screen.getByText('Beta')).toBeTruthy());

    await act(async () => {
      fireEvent.click(within(tileOf('Beta')).getByRole('button', { name: 'Export project' }));
    });

    await waitFor(() => expect(files).toHaveLength(1));
    const exported = JSON.parse(await files[0].text());
    expect(exported._exportType).toBe('ganttapp-project-export');
    expect(exported.projects?.map((p: Project) => p.name)).toEqual(['Beta']);
    expect(exported.releases?.map((r: Release) => r.name)).toEqual(['Beta launch']);
  });

  it('Export All downloads the projects, their releases and the stored snapshots', async () => {
    // The snapshot read succeeds here. When it fails, the export leaves the
    // snapshots out without saying so (a known defect), so this covers only a
    // complete export.
    seedData({
      projects: [makeProject({ id: 'p1', name: 'Alpha' }), makeProject({ id: 'p2', name: 'Beta' })],
      releases: [
        makeRelease({ id: 'r1', projectId: 'p1', name: 'Alpha launch' }),
        makeRelease({ id: 'r2', projectId: 'p2', name: 'Beta launch' }),
      ],
    });
    localStorage.setItem('ganttAppSnapshots', JSON.stringify([
      { id: 's1', projectId: 'p1', timestamp: '2026-02-01T00:00:00.000Z', name: 'Sprint 4 review', releases: [] },
      { id: 's2', projectId: 'p2', timestamp: '2026-02-02T00:00:00.000Z', name: 'Sprint 5 review', releases: [] },
    ]));
    const files = captureDownloads();
    renderProjectsTab();
    await waitFor(() => expect(screen.getByText('Beta')).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Export all projects as JSON' }));
    });

    await waitFor(() => expect(files).toHaveLength(1));
    const exported = JSON.parse(await files[0].text());
    expect(exported.projects?.map((p: Project) => p.name)).toEqual(['Alpha', 'Beta']);
    expect(exported.releases?.map((r: Release) => r.name)).toEqual(['Alpha launch', 'Beta launch']);
    expect(exported.snapshots?.map((s: { name: string }) => s.name)).toEqual(['Sprint 4 review', 'Sprint 5 review']);
  });

  it('Dismiss hides the import banner', async () => {
    renderProjectsTab();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const badFile = new File(['not valid json {{'], 'bad.json', { type: 'application/json' });
    fireEvent.change(fileInput, { target: { files: [badFile] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid file format'));

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Invalid file format')).toBeNull();
  });

  it("dragging over a tile reports that tile's project", async () => {
    seedData({
      projects: [makeProject({ id: 'p1', name: 'Alpha' }), makeProject({ id: 'p2', name: 'Beta' })],
      releases: [],
    });
    const onProjectDragOver = vi.fn();
    renderProjectsTab({ onProjectDragOver });
    await waitFor(() => expect(screen.getByText('Beta')).toBeTruthy());

    fireEvent.dragOver(tileOf('Beta'));
    expect(onProjectDragOver).toHaveBeenCalledTimes(1);
    expect(onProjectDragOver.mock.calls[0][0]).toHaveProperty('type', 'dragover');
    expect(onProjectDragOver.mock.calls[0][1]).toBe('p2');

    fireEvent.dragOver(tileOf('Alpha'));
    expect(onProjectDragOver).toHaveBeenCalledTimes(2);
    expect(onProjectDragOver.mock.calls[1][1]).toBe('p1');
  });

  it("starting a drag on a tile's handle reports that tile's project", async () => {
    seedData({
      projects: [makeProject({ id: 'p1', name: 'Alpha' }), makeProject({ id: 'p2', name: 'Beta' })],
      releases: [],
    });
    const onProjectDragStart = vi.fn();
    renderProjectsTab({ onProjectDragStart });
    await waitFor(() => expect(screen.getByText('Beta')).toBeTruthy());

    fireEvent.dragStart(within(tileOf('Beta')).getByLabelText('Drag to reorder project'));
    expect(onProjectDragStart).toHaveBeenCalledTimes(1);
    expect(onProjectDragStart).toHaveBeenLastCalledWith('p2');

    fireEvent.dragStart(within(tileOf('Alpha')).getByLabelText('Drag to reorder project'));
    expect(onProjectDragStart).toHaveBeenCalledTimes(2);
    expect(onProjectDragStart).toHaveBeenLastCalledWith('p1');
  });

  it("a tile marks a finish date outside the work week, using the project's own work week first", async () => {
    // The global work week is Monday to Friday by default.
    seedData({
      projects: [
        makeProject({ id: 'p1', name: 'Alpha', finishDate: '2026-05-30' }), // a Saturday
        makeProject({ id: 'p2', name: 'Beta', finishDate: '2026-05-29' }), // a Friday
        // A Saturday, in a project whose own work week includes Saturday.
        makeProject({ id: 'p3', name: 'Gamma', finishDate: '2026-05-30', workDays: [1, 2, 3, 4, 5, 6] }),
      ],
      releases: [],
    });
    renderProjectsTab();
    await waitFor(() => expect(screen.getByText('Gamma')).toBeTruthy());

    expect(within(tileOf('Alpha')).getByText('⚠')).toHaveAttribute(
      'title',
      'Falls on Saturday, which is outside your work week.',
    );
    expect(within(tileOf('Beta')).queryByText('⚠')).toBeNull();
    expect(within(tileOf('Gamma')).queryByText('⚠')).toBeNull();
  });

  it('in local mode no tile offers Share, even for a project the signed-in user owns', async () => {
    ctxOverride.signedInUser = { uid: OWNER_UID };
    seedData({
      projects: [makeProject({ id: 'p1', name: 'Alpha', owner: OWNER_UID })],
      releases: [],
    });
    renderProjectsTab();
    await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());

    const tile = tileOf('Alpha');
    expect(within(tile).getByRole('button', { name: 'Export project' })).toBeTruthy();
    expect(within(tile).getByRole('button', { name: 'Delete project' })).toBeTruthy();
    expect(within(tile).queryByRole('button', { name: 'Share project' })).toBeNull();
  });

  it('the import file input is disabled while a picked file is read', async () => {
    renderProjectsTab();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput.disabled).toBe(false);

    pickImportFile({ _exportType: 'ganttapp-project-export', projects: [{ id: 'p2', name: 'Beta' }], releases: [] });
    // Nothing has been awaited since the pick, so the read is still pending.
    expect(fileInput.disabled).toBe(true);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 project added.'));
    expect(fileInput.disabled).toBe(false);
  });

  it('the Import control is aria-disabled while a picked file is read', async () => {
    renderProjectsTab();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const importControl = fileInput.closest('label') as HTMLElement;
    expect(importControl).toHaveAttribute('aria-label', 'Import projects from JSON');
    expect(importControl).toHaveAttribute('aria-disabled', 'false');

    pickImportFile({ _exportType: 'ganttapp-project-export', projects: [{ id: 'p2', name: 'Beta' }], releases: [] });
    // Nothing has been awaited since the pick, so the read is still pending.
    expect(importControl).toHaveAttribute('aria-disabled', 'true');

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 project added.'));
    expect(importControl).toHaveAttribute('aria-disabled', 'false');
  });

  it("the preview's buttons are disabled while its merge is applying", async () => {
    seedData({ projects: [makeProject({ id: 'p1', name: 'Alpha' })], releases: [] });
    renderProjectsTab();
    await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());

    pickImportFile({ _exportType: 'ganttapp-all-projects', projects: [{ id: 'p2', name: 'Beta' }], releases: [] });
    const preview = await screen.findByTestId('import-preview-section');
    const confirm = within(preview).getByRole('button', { name: 'Confirm Merge' });
    const cancel = within(preview).getByRole('button', { name: 'Cancel' });
    const mergeMode = within(preview).getByRole('radio', { name: /Merge into workspace/ });
    expect(confirm).toBeEnabled();
    expect(cancel).toBeEnabled();
    expect(mergeMode).toBeEnabled();

    fireEvent.click(confirm);
    // The merge waits on the snapshot load, and nothing has been awaited since
    // the click, so the preview is still up with the merge applying.
    expect(screen.getByTestId('import-preview-section')).toBe(preview);
    expect(confirm).toBeDisabled();
    expect(cancel).toBeDisabled();
    expect(mergeMode).toBeDisabled();

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 project added.'));
  });

  it('each tile counts only its own releases', async () => {
    seedData({
      projects: [makeProject({ id: 'p1', name: 'Alpha' }), makeProject({ id: 'p2', name: 'Beta' })],
      releases: [
        makeRelease({ id: 'r1', projectId: 'p1' }),
        makeRelease({ id: 'r2', projectId: 'p1', name: 'Release 2' }),
        makeRelease({ id: 'r3', projectId: 'p2', name: 'Release 3' }),
      ],
    });
    renderProjectsTab();
    await waitFor(() => expect(screen.getByText('Beta')).toBeTruthy());

    expect(tileOf('Alpha')).toHaveTextContent('(2 releases)');
    // The tile says "1 releases" today: it has no singular, which is wrong, and
    // a fix is planned. This checks the count and accepts either wording.
    expect(tileOf('Beta')).toHaveTextContent(/\(1 releases?\b/);
  });

  it('a tile shows its finish date as MM/DD/YYYY', async () => {
    seedData({
      projects: [makeProject({ id: 'p1', name: 'Alpha', finishDate: '2026-12-31' })],
      releases: [],
    });
    renderProjectsTab();
    await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());

    expect(tileOf('Alpha')).toHaveTextContent('(0 releases, finish: 12/31/2026)');
    expect(tileOf('Alpha')).not.toHaveTextContent('2026-12-31');
  });

  it('Cancel on the delete confirmation closes it and deletes nothing', async () => {
    seedData({ projects: [makeProject({ id: 'p1', name: 'Alpha' })], releases: [] });
    renderProjectsTab();
    await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());

    fireEvent.click(within(tileOf('Alpha')).getByRole('button', { name: 'Delete project' }));
    expect(screen.getByText('Delete Project')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(storedProjectIds()).toEqual(['p1']);
    expect(screen.queryByText('Delete Project')).toBeNull();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('deleting the selected project selects the first project that remains', async () => {
    seedData({
      projects: [
        makeProject({ id: 'p1', name: 'Alpha' }),
        makeProject({ id: 'p2', name: 'Beta' }),
        makeProject({ id: 'p3', name: 'Gamma' }),
      ],
      releases: [],
    });
    const setSelectedProjectId = vi.fn();
    renderProjectsTab({ selectedProjectId: 'p1', setSelectedProjectId });
    await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());

    fireEvent.click(within(tileOf('Alpha')).getByRole('button', { name: 'Delete project' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(storedProjectIds()).toEqual(['p2', 'p3']));
    await waitFor(() => expect(setSelectedProjectId).toHaveBeenCalledWith('p2'));
    expect(setSelectedProjectId).toHaveBeenCalledTimes(1);
    expect(alertSpy).not.toHaveBeenCalled();
  });
});

describe('ProjectsTab in cloud mode, with its contexts stood in', () => {
  const ALPHA: Project = { id: 'p1', name: 'Alpha', owner: OWNER_UID };
  const BETA: Project = { id: 'p2', name: 'Beta', owner: OWNER_UID };
  let alertSpy: ReturnType<typeof vi.spyOn>;

  function cloudStorage(canWrite = true) {
    return {
      mode: 'cloud' as const,
      canWrite: () => canWrite,
      loadSnapshots: vi.fn(async () => []),
      loadSnapshotsStrict: vi.fn(async () => []),
      saveSnapshots: vi.fn(async () => {}),
      deleteSnapshotsForProject: vi.fn(async () => []),
      getProjectMembers: vi.fn(async (projectId: string) => [
        { uid: OWNER_UID, role: 'owner' as const, email: `owner-of-${projectId}@example.com` },
      ]),
      listPendingInvites: vi.fn(async () => []),
    };
  }

  /** Renders the tab signed in as the owner of every project, in cloud mode. */
  function renderCloudTab(projects: Project[], storage = cloudStorage()) {
    const updateData = vi.fn();
    const showProjects = (list: Project[]) => {
      ctxOverride.appData = {
        data: { projects: list, releases: [] },
        updateData,
        globalWorkDays: [1, 2, 3, 4, 5],
        loading: false,
      };
    };
    showProjects(projects);
    ctxOverride.storage = { storage, mode: 'cloud' };
    ctxOverride.auth = { user: { uid: OWNER_UID }, loading: false, isAuthenticated: true, firebaseAvailable: true };
    const props = {
      selectedProjectId: 'p1',
      setSelectedProjectId: vi.fn(),
      setActiveTab: vi.fn(),
      draggedProjectId: null,
      onProjectDragStart: vi.fn(),
      onProjectDragOver: vi.fn(),
      onProjectDragEnd: vi.fn(),
      onReplaceSnapshots: vi.fn().mockResolvedValue(undefined),
    };
    const tab = () => (
      <ThemeProvider>
        <ProjectsTab {...props} />
      </ThemeProvider>
    );
    const view = render(tab());
    // The projects change under the open tab, as a change from elsewhere would.
    const projectsBecome = (list: Project[]) => {
      showProjects(list);
      view.rerender(tab());
    };
    return { storage, updateData, projectsBecome };
  }

  async function openShareFor(name: string, projectId: string) {
    fireEvent.click(within(tileOf(name)).getByRole('button', { name: 'Share project' }));
    await screen.findByText('Share Project');
    await screen.findByText(`owner-of-${projectId}@example.com`);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
  }

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    resetContextOverrides();
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    resetContextOverrides();
    vi.restoreAllMocks();
  });

  it('Share on a tile opens the sharing dialog for that project', async () => {
    const { storage } = renderCloudTab([ALPHA, BETA]);

    fireEvent.click(within(tileOf('Beta')).getByRole('button', { name: 'Share project' }));
    const heading = await screen.findByText('Share Project');
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());

    expect(heading.nextElementSibling).toHaveTextContent(/^Beta$/);
    expect(storage.getProjectMembers).toHaveBeenCalledWith('p2');
    expect(storage.getProjectMembers).not.toHaveBeenCalledWith('p1');
    expect(within(heading.parentElement as HTMLElement).getByText('owner-of-p2@example.com')).toBeTruthy();
  });

  it('Close on the sharing dialog closes it', async () => {
    renderCloudTab([ALPHA, BETA]);
    await openShareFor('Beta', 'p2');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(tileOf('Beta')).toBeTruthy();
    expect(screen.queryByText('Share Project')).toBeNull();
  });

  it('a sharing dialog whose project has vanished renders nothing', async () => {
    const { projectsBecome } = renderCloudTab([ALPHA, BETA]);
    await openShareFor('Beta', 'p2');

    projectsBecome([ALPHA]);

    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.queryByText('Beta')).toBeNull();
    expect(screen.queryByText('Share Project')).toBeNull();
  });

  it('a delete confirmation whose project has vanished renders nothing', async () => {
    const { projectsBecome } = renderCloudTab([ALPHA, BETA]);
    fireEvent.click(within(tileOf('Beta')).getByRole('button', { name: 'Delete project' }));
    expect(screen.getByText('Delete project "Beta"? This will also delete all its releases.')).toBeTruthy();

    projectsBecome([ALPHA]);

    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.queryByText('Beta')).toBeNull();
    expect(screen.queryByText('Delete Project')).toBeNull();
  });

  it('Delete closes the confirmation even when the delete is refused', async () => {
    // A cloud session whose data never loaded refuses the delete and keeps the
    // project; the confirmation still closes.
    const { updateData } = renderCloudTab([ALPHA, BETA], cloudStorage(false));
    fireEvent.click(within(tileOf('Alpha')).getByRole('button', { name: 'Delete project' }));
    expect(screen.getByText('Delete Project')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    });

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('This project was not deleted.'));
    expect(updateData).not.toHaveBeenCalled();
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.queryByText('Delete Project')).toBeNull();
  });
});
