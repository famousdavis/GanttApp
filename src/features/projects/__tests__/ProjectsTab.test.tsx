// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
    it('calls setActiveTab and setSelectedProjectId on View Releases click', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      const { props } = renderProjectsTab();
      await waitFor(() => {
        expect(screen.getByText('View Releases')).toBeTruthy();
      });
      fireEvent.click(screen.getByText('View Releases'));

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

  describe('import warning dialog', () => {
    function createValidFile(data: object): File {
      const content = JSON.stringify(data);
      return new File([content], 'test.json', { type: 'application/json' });
    }

    it('shows modal dialog when importing with existing data', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [makeRelease({ id: 'r1', projectId: 'p1' })],
      });

      renderProjectsTab();

      // Wait for async data to load before triggering import
      await waitFor(() => {
        expect(screen.getByText('Alpha')).toBeTruthy();
      });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createValidFile({
        projects: [{ id: 'p2', name: 'Beta' }],
        releases: [{ id: 'r2', projectId: 'p2', name: 'R2', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01' }]
      });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Replace All Data')).toBeTruthy();
        expect(screen.getByText(/replace all existing projects/)).toBeTruthy();
      });
    });

    it('applies import when Replace button is clicked', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      vi.spyOn(window, 'alert').mockImplementation(() => {});
      renderProjectsTab();

      // Wait for async data to load
      await waitFor(() => {
        expect(screen.getByText('Alpha')).toBeTruthy();
      });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createValidFile({
        projects: [{ id: 'p2', name: 'Beta' }],
        releases: []
      });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Replace All Data')).toBeTruthy();
      });

      fireEvent.click(screen.getByText('Replace'));

      await waitFor(() => {
        const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
        expect(stored.projects[0].name).toBe('Beta');
      });
    });

    it('aborts import when Cancel button is clicked', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      renderProjectsTab();

      // Wait for async data to load
      await waitFor(() => {
        expect(screen.getByText('Alpha')).toBeTruthy();
      });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createValidFile({
        projects: [{ id: 'p2', name: 'Beta' }],
        releases: []
      });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Replace All Data')).toBeTruthy();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText('Replace All Data')).toBeNull();
      });

      // Original data should remain
      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects[0].name).toBe('Alpha');
    });

    it('skips modal dialog when no existing data', async () => {
      seedData({ projects: [], releases: [] });

      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      renderProjectsTab();

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createValidFile({
        projects: [{ id: 'p2', name: 'Beta' }],
        releases: []
      });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('imported successfully'));
      });

      // Modal should not have appeared
      expect(screen.queryByText('Replace All Data')).toBeNull();

      alertSpy.mockRestore();
    });

    it('calls onReplaceSnapshots with imported snapshots via Replace modal (v16.7)', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      vi.spyOn(window, 'alert').mockImplementation(() => {});
      const onReplaceSnapshots = vi.fn().mockResolvedValue(undefined);
      renderProjectsTab({ onReplaceSnapshots });

      await waitFor(() => {
        expect(screen.getByText('Alpha')).toBeTruthy();
      });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const snapshot = {
        id: 'snap1',
        projectId: 'p2',
        timestamp: '2026-04-01T10:00:00.000Z',
        name: 'Sprint 1',
        releases: [],
      };
      const file = createValidFile({
        projects: [{ id: 'p2', name: 'Beta' }],
        releases: [],
        snapshots: [snapshot],
      });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Replace All Data')).toBeTruthy();
      });

      fireEvent.click(screen.getByText('Replace'));

      await waitFor(() => {
        expect(onReplaceSnapshots).toHaveBeenCalledTimes(1);
      });
      const passed = onReplaceSnapshots.mock.calls[0][0];
      expect(passed).toHaveLength(1);
      expect(passed[0].id).toBe('snap1');
    });

    it('calls onReplaceSnapshots with [] when imported file has no snapshots (v16.7)', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      vi.spyOn(window, 'alert').mockImplementation(() => {});
      const onReplaceSnapshots = vi.fn().mockResolvedValue(undefined);
      renderProjectsTab({ onReplaceSnapshots });

      await waitFor(() => {
        expect(screen.getByText('Alpha')).toBeTruthy();
      });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createValidFile({
        projects: [{ id: 'p2', name: 'Beta' }],
        releases: [],
      });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Replace All Data')).toBeTruthy();
      });

      fireEvent.click(screen.getByText('Replace'));

      await waitFor(() => {
        expect(onReplaceSnapshots).toHaveBeenCalledTimes(1);
      });
      expect(onReplaceSnapshots.mock.calls[0][0]).toEqual([]);
    });

    it('calls onReplaceSnapshots on no-existing-data skip-modal path (v16.7)', async () => {
      seedData({ projects: [], releases: [] });

      vi.spyOn(window, 'alert').mockImplementation(() => {});
      const onReplaceSnapshots = vi.fn().mockResolvedValue(undefined);
      renderProjectsTab({ onReplaceSnapshots });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const snapshot = {
        id: 'snap1',
        projectId: 'p2',
        timestamp: '2026-04-01T10:00:00.000Z',
        name: 'Sprint 1',
        releases: [],
      };
      const file = createValidFile({
        projects: [{ id: 'p2', name: 'Beta' }],
        releases: [],
        snapshots: [snapshot],
      });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(onReplaceSnapshots).toHaveBeenCalledTimes(1);
      });
      const passed = onReplaceSnapshots.mock.calls[0][0];
      expect(passed).toHaveLength(1);
      expect(passed[0].id).toBe('snap1');
      expect(screen.queryByText('Replace All Data')).toBeNull();
    });
  });

  // v19.0 — _exportType discriminator routing
  describe('import routing by _exportType (v19.0)', () => {
    function createValidFile(data: object): File {
      const content = JSON.stringify(data);
      return new File([content], 'test.json', { type: 'application/json' });
    }

    it('shows merge confirm dialog for _exportType: ganttapp-project-export', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });
      renderProjectsTab();
      await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createValidFile({
        _exportType: 'ganttapp-project-export',
        projects: [{ id: 'p2', name: 'Beta' }],
        releases: [],
      });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Add Projects to Workspace')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Add Projects' })).toBeTruthy();
      });
      // Replace-all dialog should NOT be shown for project-export files
      expect(screen.queryByText('Replace All Data')).toBeNull();
    });

    it('shows replace-all confirm dialog for _exportType: ganttapp-all-projects', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });
      renderProjectsTab();
      await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createValidFile({
        _exportType: 'ganttapp-all-projects',
        projects: [{ id: 'p2', name: 'Beta' }],
        releases: [],
      });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Replace All Data')).toBeTruthy();
      });
      expect(screen.queryByText('Add Projects to Workspace')).toBeNull();
    });

    it('shows replace-all confirm dialog for legacy file (no _exportType)', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });
      renderProjectsTab();
      await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createValidFile({
        projects: [{ id: 'p2', name: 'Beta' }],
        releases: [],
      });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Replace All Data')).toBeTruthy();
      });
    });

    it('merge "Add Projects" button merges into existing workspace', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });
      vi.spyOn(window, 'alert').mockImplementation(() => {});
      const onReplaceSnapshots = vi.fn().mockResolvedValue(undefined);
      renderProjectsTab({ onReplaceSnapshots });

      await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createValidFile({
        _exportType: 'ganttapp-project-export',
        projects: [{ id: 'p2', name: 'Beta' }],
        releases: [],
      });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Add Projects' })).toBeTruthy();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Add Projects' }));

      await waitFor(() => {
        const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
        expect(stored.projects.map((p: Project) => p.name).sort()).toEqual(['Alpha', 'Beta']);
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
