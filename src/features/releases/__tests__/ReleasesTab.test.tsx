import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReactNode } from 'react';
import { AppDataProvider } from '../../../context/AppDataContext';
import { ReleasesTab } from '../ReleasesTab';
import { AppData } from '../../../shared/types/app';
import { Project, Release } from '../../../shared/types/models';

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
      <AppDataProvider>
        <ReleasesTab {...defaultProps} />
      </AppDataProvider>
    ),
    props: defaultProps,
  };
}

describe('ReleasesTab', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('shows message when no projects exist', () => {
      renderReleasesTab();
      expect(screen.getByText(/No projects yet/)).toBeTruthy();
    });

    it('renders project selector dropdown', () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' }), makeProject({ id: 'p2', name: 'Beta' })],
        releases: [],
      });

      renderReleasesTab();
      const select = screen.getByRole('combobox');
      expect(select).toBeTruthy();
    });

    it('renders empty release state when project has no releases', () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      renderReleasesTab();
      expect(screen.getByText(/No releases yet/)).toBeTruthy();
    });

    it('renders release list with names', () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [makeRelease({ id: 'r1', name: 'Sprint 1' })],
      });

      renderReleasesTab();
      expect(screen.getByText('Sprint 1')).toBeTruthy();
    });

    it('renders form inputs for release name and dates', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [],
      });

      renderReleasesTab();
      expect(screen.getByPlaceholderText('Release name')).toBeTruthy();
      expect(screen.getByText('Start Date')).toBeTruthy();
      expect(screen.getByText('Early Finish Date')).toBeTruthy();
      expect(screen.getByText('Late Finish Date')).toBeTruthy();
    });
  });

  describe('project selection', () => {
    it('filters releases by selected project', () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' }), makeProject({ id: 'p2', name: 'Beta' })],
        releases: [
          makeRelease({ id: 'r1', projectId: 'p1', name: 'Sprint 1' }),
          makeRelease({ id: 'r2', projectId: 'p2', name: 'Sprint 2' }),
        ],
      });

      renderReleasesTab({ selectedProjectId: 'p1' });
      expect(screen.getByText('Sprint 1')).toBeTruthy();
      expect(screen.queryByText('Sprint 2')).toBeNull();
    });

    it('calls setSelectedProjectId on dropdown change', () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' }), makeProject({ id: 'p2', name: 'Beta' })],
        releases: [],
      });

      const { props } = renderReleasesTab();
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'p2' } });

      expect(props.setSelectedProjectId).toHaveBeenCalledWith('p2');
    });
  });

  describe('add release form', () => {
    it('renders Add Release button', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [],
      });

      renderReleasesTab();
      expect(screen.getByText('Add Release')).toBeTruthy();
    });

    it('adds release when all fields are valid', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [],
      });

      renderReleasesTab();

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
    it('switches to edit mode with pre-filled data when Edit is clicked', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1', name: 'Sprint 1' })],
      });

      renderReleasesTab();
      fireEvent.click(screen.getByText('Edit'));

      const nameInput = screen.getByPlaceholderText('Release name') as HTMLInputElement;
      expect(nameInput.value).toBe('Sprint 1');
      expect(screen.getByText('Update Release')).toBeTruthy();
      expect(screen.getByText('Cancel')).toBeTruthy();
    });

    it('cancels edit and clears form', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1', name: 'Sprint 1' })],
      });

      renderReleasesTab();
      fireEvent.click(screen.getByText('Edit'));
      fireEvent.click(screen.getByText('Cancel'));

      const nameInput = screen.getByPlaceholderText('Release name') as HTMLInputElement;
      expect(nameInput.value).toBe('');
      expect(screen.getByText('Add Release')).toBeTruthy();
    });
  });

  describe('delete release', () => {
    it('shows confirmation dialog on Delete click', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1', name: 'Sprint 1' })],
      });

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderReleasesTab();
      fireEvent.click(screen.getByText('Delete'));

      expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Sprint 1'));
    });

    it('deletes release when confirmed', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1', name: 'Sprint 1' })],
      });

      vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderReleasesTab();
      fireEvent.click(screen.getByText('Delete'));

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases).toHaveLength(0);
    });
  });

  describe('visibility toggle', () => {
    it('renders Show checkbox for each release', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1' })],
      });

      renderReleasesTab();
      expect(screen.getByText('Show')).toBeTruthy();
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeTruthy();
    });

    it('toggles release hidden state on checkbox change', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1' })],
      });

      renderReleasesTab();
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;

      // Initially checked (not hidden)
      expect(checkbox.checked).toBe(true);

      fireEvent.click(checkbox);

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases[0].hidden).toBe(true);
    });
  });

  describe('completion toggle', () => {
    it('renders Mark Done button for each release', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1' })],
      });

      renderReleasesTab();
      expect(screen.getByText('Mark Done')).toBeTruthy();
    });

    it('toggles to Done state', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1' })],
      });

      renderReleasesTab();
      fireEvent.click(screen.getByText('Mark Done'));

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.releases[0].completed).toBe(true);
    });

    it('shows checkmark when completed', () => {
      seedData({
        projects: [makeProject({ id: 'p1' })],
        releases: [makeRelease({ id: 'r1', completed: true })],
      });

      renderReleasesTab();
      expect(screen.getByText(/Done/)).toBeTruthy();
    });
  });
});
