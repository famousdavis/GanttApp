import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { AppDataProvider } from '../../../context/AppDataContext';
import { ThemeProvider } from '../../../context/ThemeContext';
import { ProjectsTab } from '../ProjectsTab';
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

function TestWrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AppDataProvider>
        {children}
      </AppDataProvider>
    </ThemeProvider>
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
  });

  describe('rendering', () => {
    it('renders empty state when no projects exist', () => {
      renderProjectsTab();
      expect(screen.getByText(/No projects yet/)).toBeTruthy();
    });

    it('renders project list when projects exist', () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' }), makeProject({ id: 'p2', name: 'Beta' })],
        releases: [],
      });

      renderProjectsTab();
      expect(screen.getByText('Alpha')).toBeTruthy();
      expect(screen.getByText('Beta')).toBeTruthy();
    });

    it('shows release count for each project', () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [
          makeRelease({ id: 'r1', projectId: 'p1' }),
          makeRelease({ id: 'r2', projectId: 'p1', name: 'Release 2' }),
        ],
      });

      renderProjectsTab();
      expect(screen.getByText(/2 releases/)).toBeTruthy();
    });

    it('shows finish date for projects that have one', () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha', finishDate: '2026-12-31' })],
        releases: [],
      });

      renderProjectsTab();
      expect(screen.getByText(/finish:/)).toBeTruthy();
    });

    it('renders Export and Import buttons', () => {
      renderProjectsTab();
      expect(screen.getByText(/Export/)).toBeTruthy();
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
    it('shows Update and Cancel buttons in edit mode', () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      renderProjectsTab();
      fireEvent.click(screen.getByText('Edit'));

      expect(screen.getByText('Update')).toBeTruthy();
      expect(screen.getByText('Cancel')).toBeTruthy();
    });

    it('loads project data into form when Edit is clicked', () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      renderProjectsTab();
      fireEvent.click(screen.getByText('Edit'));

      const nameInput = screen.getByPlaceholderText('Project name') as HTMLInputElement;
      expect(nameInput.value).toBe('Alpha');
    });

    it('cancels edit and clears form on Cancel click', () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      renderProjectsTab();
      fireEvent.click(screen.getByText('Edit'));
      fireEvent.click(screen.getByText('Cancel'));

      const nameInput = screen.getByPlaceholderText('Project name') as HTMLInputElement;
      expect(nameInput.value).toBe('');
      expect(screen.getByText('Add Project')).toBeTruthy();
    });
  });

  describe('delete project', () => {
    it('shows confirmation dialog on Delete click', () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderProjectsTab();
      fireEvent.click(screen.getByText('Delete'));

      expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Alpha'));
    });

    it('deletes project when confirmed', () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderProjectsTab();
      fireEvent.click(screen.getByText('Delete'));

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects).toHaveLength(0);
    });

    it('does not delete when confirmation is cancelled', () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderProjectsTab();
      fireEvent.click(screen.getByText('Delete'));

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects).toHaveLength(1);
    });
  });

  describe('navigation', () => {
    it('calls setActiveTab and setSelectedProjectId on View Releases click', () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      const { props } = renderProjectsTab();
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
    it('disables Export button when no projects exist', () => {
      renderProjectsTab();
      const exportButton = screen.getByText(/Export/);
      expect(exportButton.closest('button')?.disabled).toBe(true);
    });

    it('enables Export button when projects exist', () => {
      seedData({
        projects: [makeProject({ id: 'p1', name: 'Alpha' })],
        releases: [],
      });

      renderProjectsTab();
      const exportButton = screen.getByText(/Export/);
      expect(exportButton.closest('button')?.disabled).toBe(false);
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
  });
});
