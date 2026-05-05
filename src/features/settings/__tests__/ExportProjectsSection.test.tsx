// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExportProjectsSection } from '../ExportProjectsSection';
import { LIGHT_THEME } from '../../../shared/utils/theme';
import type { AppData } from '../../../shared/types/app';
import type { Project, Release } from '../../../shared/types/models';

// Mock exportSelectedProjects so we can assert on calls without triggering downloads.
vi.mock('../../../shared/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/utils')>();
  return {
    ...actual,
    exportSelectedProjects: vi.fn().mockResolvedValue({ exported: 0 }),
  };
});

import { exportSelectedProjects } from '../../../shared/utils';

const colors = LIGHT_THEME;

function makeProject(over: Partial<Project> = {}): Project {
  return { id: 'p1', name: 'Project 1', ...over };
}
function makeRelease(over: Partial<Release> = {}): Release {
  return {
    id: 'r1',
    projectId: 'p1',
    name: 'r1',
    startDate: '2026-01-01',
    earlyFinishDate: '2026-02-01',
    lateFinishDate: '2026-03-01',
    ...over,
  };
}

function makeData(over: Partial<AppData> = {}): AppData {
  return {
    projects: [makeProject({ id: 'p1', name: 'Project 1' }), makeProject({ id: 'p2', name: 'Project 2' })],
    releases: [
      makeRelease({ id: 'r1', projectId: 'p1' }),
      makeRelease({ id: 'r2', projectId: 'p2' }),
      makeRelease({ id: 'r3', projectId: 'p2' }),
    ],
    ...over,
  };
}

const mockStorage = {
  loadSnapshots: vi.fn().mockResolvedValue([]),
};

describe('ExportProjectsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when projects=[]', () => {
    render(
      <ExportProjectsSection
        colors={colors}
        projects={[]}
        data={{ projects: [], releases: [] }}
        storage={mockStorage}
      />
    );
    expect(screen.getByText(/No projects to export/)).toBeInTheDocument();
  });

  it('renders project list when projects are provided', () => {
    const data = makeData();
    render(
      <ExportProjectsSection
        colors={colors}
        projects={data.projects}
        data={data}
        storage={mockStorage}
      />
    );
    expect(screen.getByText('Project 1')).toBeInTheDocument();
    expect(screen.getByText('Project 2')).toBeInTheDocument();
  });

  it('shows release count per project', () => {
    const data = makeData();
    render(
      <ExportProjectsSection
        colors={colors}
        projects={data.projects}
        data={data}
        storage={mockStorage}
      />
    );
    // p1 has 1 release, p2 has 2 releases
    expect(screen.getByText('1 release(s)')).toBeInTheDocument();
    expect(screen.getByText('2 release(s)')).toBeInTheDocument();
  });

  it('Select all selects every project', () => {
    const data = makeData();
    render(
      <ExportProjectsSection
        colors={colors}
        projects={data.projects}
        data={data}
        storage={mockStorage}
      />
    );
    const selectAll = screen.getByLabelText(/Select all/);
    fireEvent.click(selectAll);

    const cb1 = screen.getByLabelText('Select Project 1 for export') as HTMLInputElement;
    const cb2 = screen.getByLabelText('Select Project 2 for export') as HTMLInputElement;
    expect(cb1.checked).toBe(true);
    expect(cb2.checked).toBe(true);
    expect(screen.getByLabelText(/Deselect all/)).toBeInTheDocument();
  });

  it('Deselect all clears every selection', () => {
    const data = makeData();
    render(
      <ExportProjectsSection
        colors={colors}
        projects={data.projects}
        data={data}
        storage={mockStorage}
      />
    );
    fireEvent.click(screen.getByLabelText(/Select all/));
    expect(screen.getByLabelText(/Deselect all/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Deselect all/));
    const cb1 = screen.getByLabelText('Select Project 1 for export') as HTMLInputElement;
    expect(cb1.checked).toBe(false);
  });

  it('individual project checkbox toggles selection', () => {
    const data = makeData();
    render(
      <ExportProjectsSection
        colors={colors}
        projects={data.projects}
        data={data}
        storage={mockStorage}
      />
    );
    const cb1 = screen.getByLabelText('Select Project 1 for export') as HTMLInputElement;
    expect(cb1.checked).toBe(false);
    fireEvent.click(cb1);
    expect(cb1.checked).toBe(true);
    fireEvent.click(cb1);
    expect(cb1.checked).toBe(false);
  });

  it('Export button is disabled when no projects are selected', () => {
    const data = makeData();
    render(
      <ExportProjectsSection
        colors={colors}
        projects={data.projects}
        data={data}
        storage={mockStorage}
      />
    );
    const button = screen.getByRole('button', { name: /Export/ });
    expect(button).toBeDisabled();
  });

  it('Export button label shows the selected count', () => {
    const data = makeData();
    render(
      <ExportProjectsSection
        colors={colors}
        projects={data.projects}
        data={data}
        storage={mockStorage}
      />
    );
    fireEvent.click(screen.getByLabelText('Select Project 1 for export'));
    fireEvent.click(screen.getByLabelText('Select Project 2 for export'));
    expect(screen.getByRole('button', { name: 'Export (2)' })).toBeInTheDocument();
  });

  it('clicking Export calls exportSelectedProjects with selected IDs and includeSnapshots=false', async () => {
    const data = makeData();
    render(
      <ExportProjectsSection
        colors={colors}
        projects={data.projects}
        data={data}
        storage={mockStorage}
      />
    );
    fireEvent.click(screen.getByLabelText('Select Project 1 for export'));
    fireEvent.click(screen.getByRole('button', { name: 'Export (1)' }));

    await waitFor(() => {
      expect(exportSelectedProjects).toHaveBeenCalledTimes(1);
    });
    const args = (exportSelectedProjects as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args[0]).toEqual(['p1']);
    expect(args[1]).toBe(data);
    expect(args[2]).toBe(mockStorage);
    expect(args[3]).toEqual({ includeSnapshots: false });
  });

  it('Include snapshots toggle changes the includeSnapshots flag passed', async () => {
    const data = makeData();
    render(
      <ExportProjectsSection
        colors={colors}
        projects={data.projects}
        data={data}
        storage={mockStorage}
      />
    );
    fireEvent.click(screen.getByLabelText('Select Project 1 for export'));
    fireEvent.click(screen.getByLabelText(/Include snapshots/));
    fireEvent.click(screen.getByRole('button', { name: 'Export (1)' }));

    await waitFor(() => {
      expect(exportSelectedProjects).toHaveBeenCalledTimes(1);
    });
    const args = (exportSelectedProjects as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args[3]).toEqual({ includeSnapshots: true });
  });
});
