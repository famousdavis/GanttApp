// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { AppDataProvider } from '../../../context/AppDataContext';
import { StorageProvider } from '../../../context/StorageContext';
import { AuthProvider } from '../../../context/AuthContext';
import { ThemeProvider } from '../../../context/ThemeContext';
import { ReleasesTab } from '../ReleasesTab';
import { AppData } from '../../../shared/types/app';
import { Project, Release } from '../../../shared/types/models';

// Mock firebase modules
vi.mock('../../../lib/firebase', () => ({
  auth: null,
  db: null,
  isFirebaseAvailable: false,
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

function renderReleasesTab(props: Partial<React.ComponentProps<typeof ReleasesTab>> = {}) {
  const defaultProps = {
    selectedProjectId: 'p1',
    setSelectedProjectId: vi.fn(),
    draggedReleaseId: null,
    onReleaseDragStart: vi.fn(),
    onReleaseDragOver: vi.fn(),
    onReleaseDragEnd: vi.fn(),
    ...props,
  };

  return {
    ...render(
      <TestWrapper>
        <ReleasesTab {...defaultProps} />
      </TestWrapper>
    ),
    props: defaultProps,
  };
}

describe('ReleasesTab', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: null) => void) => {
      callback(null);
      return vi.fn();
    });
  });

  describe('rendering', () => {
    it('shows message when no projects exist', () => {
      renderReleasesTab();
      expect(screen.getByText(/No projects yet/)).toBeTruthy();
    });

    it('renders project selector dropdown', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' }), makeProject({ id: 'p2', name: 'Beta' })],
        releases: [],
      });

      renderReleasesTab();
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeTruthy();
      });
    });

    it('renders empty release state when project has no releases', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      renderReleasesTab();
      await waitFor(() => {
        expect(screen.queryByText(/No projects yet/)).toBeNull();
      });
      expect(screen.getByText(/No releases yet/)).toBeTruthy();
    });

    it('renders release list with names', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [makeRelease({ id: 'r1', name: 'Sprint 1' })],
      });

      renderReleasesTab();
      await waitFor(() => {
        expect(screen.getByText('Sprint 1')).toBeTruthy();
      });
    });

    it('renders form inputs for release name and dates', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [],
      });

      renderReleasesTab();
      await waitFor(() => {
        expect(screen.queryByText(/No projects yet/)).toBeNull();
      });
      expect(screen.getByPlaceholderText('Release name')).toBeTruthy();
      expect(screen.getByText(/Start Date/)).toBeTruthy();
      expect(screen.getByText(/Early Finish/)).toBeTruthy();
      expect(screen.getByText(/Late Finish/)).toBeTruthy();
      expect(screen.getByText(/Most Likely/)).toBeTruthy();
    });
  });

  describe('project selection', () => {
    it('filters releases by selected project', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' }), makeProject({ id: 'p2', name: 'Beta' })],
        releases: [
          makeRelease({ id: 'r1', projectId: 'p1', name: 'Sprint 1' }),
          makeRelease({ id: 'r2', projectId: 'p2', name: 'Sprint 2' }),
        ],
      });

      renderReleasesTab({ selectedProjectId: 'p1' });
      await waitFor(() => {
        expect(screen.getByText('Sprint 1')).toBeTruthy();
      });
      expect(screen.queryByText('Sprint 2')).toBeNull();
    });

    it('calls setSelectedProjectId on dropdown change', async () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' }), makeProject({ id: 'p2', name: 'Beta' })],
        releases: [],
      });

      const { props } = renderReleasesTab();
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeTruthy();
      });
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'p2' } });

      expect(props.setSelectedProjectId).toHaveBeenCalledWith('p2');
    });
  });

  describe('add release form', () => {
    it('renders Add Release button', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [],
      });

      renderReleasesTab();
      await waitFor(() => {
        expect(screen.queryByText(/No projects yet/)).toBeNull();
      });
      expect(screen.getByText('Add Release')).toBeTruthy();
    });

    it('adds release when all fields are valid', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [],
      });

      renderReleasesTab();
      await waitFor(() => {
        expect(screen.queryByText(/No projects yet/)).toBeNull();
      });

      fireEvent.change(screen.getByPlaceholderText('Release name'), { target: { value: 'Sprint 1' } });

      const dateInputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(dateInputs[0], { target: { value: '2026-01-01' } });
      fireEvent.change(dateInputs[1], { target: { value: '2026-03-01' } });
      fireEvent.change(dateInputs[2], { target: { value: '2026-06-01' } });

      fireEvent.click(screen.getByText('Add Release'));

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases).toHaveLength(1);
      expect(stored.releases[0].name).toBe('Sprint 1');
    });
  });

  describe('edit release', () => {
    it('switches to edit mode with pre-filled data when Edit is clicked', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1', name: 'Sprint 1' })],
      });

      renderReleasesTab();
      await waitFor(() => {
        expect(screen.getByText('Sprint 1')).toBeTruthy();
      });
      fireEvent.click(screen.getByText('Edit'));

      const nameInput = screen.getByPlaceholderText('Release name') as HTMLInputElement;
      expect(nameInput.value).toBe('Sprint 1');
      expect(screen.getByText('Update Release')).toBeTruthy();
      expect(screen.getByText('Cancel')).toBeTruthy();
    });

    it('cancels edit and clears form', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1', name: 'Sprint 1' })],
      });

      renderReleasesTab();
      await waitFor(() => {
        expect(screen.getByText('Sprint 1')).toBeTruthy();
      });
      fireEvent.click(screen.getByText('Edit'));
      fireEvent.click(screen.getByText('Cancel'));

      const nameInput = screen.getByPlaceholderText('Release name') as HTMLInputElement;
      expect(nameInput.value).toBe('');
      expect(screen.getByText('Add Release')).toBeTruthy();
    });
  });

  describe('delete release', () => {
    it('shows confirmation dialog on Delete click', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1', name: 'Sprint 1' })],
      });

      renderReleasesTab();
      await waitFor(() => {
        expect(screen.getByText('Sprint 1')).toBeTruthy();
      });
      fireEvent.click(screen.getByText('Delete'));

      expect(screen.getByText('Delete Release')).toBeTruthy();
      expect(screen.getByText(/Delete release "Sprint 1"/)).toBeTruthy();
    });

    it('deletes release when confirmed', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1', name: 'Sprint 1' })],
      });

      renderReleasesTab();
      await waitFor(() => {
        expect(screen.getByText('Sprint 1')).toBeTruthy();
      });
      fireEvent.click(screen.getByText('Delete'));

      // Click the Delete button in the ConfirmDialog
      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[deleteButtons.length - 1]);

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases).toHaveLength(0);
    });
  });

  describe('visibility toggle', () => {
    it('renders Show checkbox for each release', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1' })],
      });

      renderReleasesTab();
      await waitFor(() => {
        expect(screen.getByText('Show')).toBeTruthy();
      });
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeTruthy();
    });

    it('toggles release hidden state on checkbox change', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1' })],
      });

      renderReleasesTab();
      await waitFor(() => {
        expect(screen.getByRole('checkbox')).toBeTruthy();
      });
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;

      // Initially checked (not hidden)
      expect(checkbox.checked).toBe(true);

      fireEvent.click(checkbox);

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases[0].hidden).toBe(true);
    });
  });

  describe('release status control', () => {
    it('renders status control for each release', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1' })],
      });

      renderReleasesTab();
      await waitFor(() => {
        expect(screen.getByText('Not Started')).toBeTruthy();
      });
    });

    it('sets status to complete when Complete is clicked', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1' })],
      });

      renderReleasesTab();
      await waitFor(() => {
        expect(screen.getByText('Not Started')).toBeTruthy();
      });
      fireEvent.click(screen.getByText('Complete'));

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases[0].status).toBe('complete');
    });

    it('shows Complete segment when status is complete', async () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1', status: 'complete' as const })],
      });

      renderReleasesTab();
      await waitFor(() => {
        expect(screen.getByText('Complete')).toBeTruthy();
      });
    });
  });

  describe('work-week warnings (v15.0, v16.3 default Mon–Fri)', () => {
    it('shows warnings by default (Mon–Fri) when globalWorkDays absent from seed (v16.3)', async () => {
      // No globalWorkDays in seeded data — v16.3 falls back to Mon–Fri default,
      // so warnings SHOULD appear (this inverts the pre-v16.3 behavior where the
      // feature was opt-in and silently did nothing until configured).
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [],
      });

      renderReleasesTab();
      await waitFor(() => {
        expect(screen.queryByText(/No projects yet/)).toBeNull();
      });

      // Set Start Date to a Saturday (2026-01-03)
      const dateInputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(dateInputs[0], { target: { value: '2026-01-03' } });

      await waitFor(() => {
        expect(screen.getByText(/Saturday/)).toBeTruthy();
      });
    });

    it('suppresses warnings when project override includes all 7 days', async () => {
      // Opt-out path: set project.workDays to all 7 days — every date becomes a workday.
      seedData({
        projects: [makeProject({ id: 'p1', workDays: [0, 1, 2, 3, 4, 5, 6] })],
        releases: [],
      });

      renderReleasesTab();
      await waitFor(() => {
        expect(screen.queryByText(/No projects yet/)).toBeNull();
      });

      const dateInputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(dateInputs[0], { target: { value: '2026-01-03' } });

      // No warning — Saturday is a workday under this project's override
      expect(screen.queryByText(/Saturday/)).toBeNull();
    });

    it('shows a warning when a release date is on a non-workday', async () => {
      // globalWorkDays: Mon–Fri configured
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [],
        globalWorkDays: [1, 2, 3, 4, 5],
      });

      renderReleasesTab();
      await waitFor(() => {
        expect(screen.queryByText(/No projects yet/)).toBeNull();
      });

      // Set Start Date to a Saturday (2026-01-03)
      const dateInputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(dateInputs[0], { target: { value: '2026-01-03' } });

      // Warning should appear with amber text mentioning Saturday
      await waitFor(() => {
        expect(screen.getByText(/Saturday/)).toBeTruthy();
      });
    });

    it('Save button remains enabled during warning state', async () => {
      // globalWorkDays: Mon–Fri configured
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [],
        globalWorkDays: [1, 2, 3, 4, 5],
      });

      renderReleasesTab();
      await waitFor(() => {
        expect(screen.queryByText(/No projects yet/)).toBeNull();
      });

      // Fill in valid release data with a Saturday start date
      fireEvent.change(screen.getByPlaceholderText('Release name'), { target: { value: 'Sprint 1' } });

      const dateInputs = document.querySelectorAll('input[type="date"]');
      // 2026-01-03 is Saturday, 2026-03-01 is Sunday, 2026-06-01 is Monday
      fireEvent.change(dateInputs[0], { target: { value: '2026-01-03' } });
      fireEvent.change(dateInputs[1], { target: { value: '2026-03-02' } });
      fireEvent.change(dateInputs[2], { target: { value: '2026-06-01' } });

      // Verify warning is shown (non-workday)
      await waitFor(() => {
        expect(screen.getByText(/Saturday/)).toBeTruthy();
      });

      // Add Release button should still be enabled (warnings are non-blocking)
      const addButton = screen.getByText('Add Release');
      expect(addButton.closest('button')?.disabled).toBe(false);
    });
  });
});
