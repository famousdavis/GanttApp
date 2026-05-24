// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { AppDataProvider } from '../../../context/AppDataContext';
import { StorageProvider } from '../../../context/StorageContext';
import { AuthProvider } from '../../../context/AuthContext';
import { ThemeProvider } from '../../../context/ThemeContext';
import { ProjectsTab } from '../ProjectsTab';
import { AppData } from '../../../shared/types/app';
import { Project, Release } from '../../../shared/types/models';

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
      it('clicking Cancel removes preview from DOM', async () => {
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

        await waitFor(() => expect(screen.getByTestId('import-preview-section')).toBeTruthy());

        // Cancel button is in the preview (no modal yet).
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        await waitFor(() => {
          expect(screen.queryByTestId('import-preview-section')).toBeNull();
        });
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
