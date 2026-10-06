// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportAllProjects } from '../export';

// Mock DOM APIs for file download
const mockClick = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(document, 'createElement').mockReturnValue({
    click: mockClick,
    set href(_v: string) {},
    set download(_v: string) {},
  } as unknown as HTMLAnchorElement);
  vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
  vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

describe('exportAllProjects', () => {
  it('exports all projects as a single JSON download', async () => {
    const mockStorage = {
      readAppData: vi.fn().mockResolvedValue({
        projects: [
          { id: 'p1', name: 'Project 1' },
          { id: 'p2', name: 'Project 2' },
        ],
        releases: [
          { id: 'r1', projectId: 'p1', name: 'Release 1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01' },
        ],
      }),
      loadSnapshots: vi.fn().mockResolvedValue([]),
    };

    const result = await exportAllProjects(mockStorage);

    expect(result.exported).toBe(2);
    expect(mockClick).toHaveBeenCalledTimes(1);
  });

  it('throws when there are no projects', async () => {
    const mockStorage = {
      readAppData: vi.fn().mockResolvedValue({ projects: [], releases: [] }),
      loadSnapshots: vi.fn().mockResolvedValue([]),
    };

    await expect(exportAllProjects(mockStorage)).rejects.toThrow('No projects to export');
  });

  it('throws when readAppData returns null', async () => {
    const mockStorage = {
      readAppData: vi.fn().mockResolvedValue(null),
      loadAppData: vi.fn(),
      loadSnapshots: vi.fn().mockResolvedValue([]),
    };

    await expect(exportAllProjects(mockStorage)).rejects.toThrow('No projects to export');
    // A download reads the cloud without adopting it, so it never falls back to a load.
    expect(mockStorage.loadAppData).not.toHaveBeenCalled();
  });

  it('includes snapshots when they exist', async () => {
    const mockStorage = {
      readAppData: vi.fn().mockResolvedValue({
        projects: [{ id: 'p1', name: 'Project 1' }],
        releases: [],
      }),
      loadSnapshots: vi.fn().mockResolvedValue([
        { id: 'snap1', projectId: 'p1', timestamp: '2026-01-15T10:00:00.000Z', name: 'Sprint 1', releases: [] },
      ]),
    };

    const result = await exportAllProjects(mockStorage);

    expect(result.exported).toBe(1);
    // Verify both readAppData and loadSnapshots were called
    expect(mockStorage.readAppData).toHaveBeenCalledOnce();
    expect(mockStorage.loadSnapshots).toHaveBeenCalledOnce();
  });

  it('includes export attribution when present', async () => {
    const mockStorage = {
      readAppData: vi.fn().mockResolvedValue({
        projects: [{ id: 'p1', name: 'Project 1' }],
        releases: [],
        exportAttribution: { name: 'Test User', identifier: 'test@example.com' },
      }),
      loadSnapshots: vi.fn().mockResolvedValue([]),
    };

    const result = await exportAllProjects(mockStorage);

    expect(result.exported).toBe(1);
    expect(mockClick).toHaveBeenCalledTimes(1);
  });

  it('reads the data for the file, and never loads it: a load changes what later saves are compared with', async () => {
    const data = { projects: [{ id: 'p1', name: 'Project 1' }], releases: [] };
    const mockStorage = {
      readAppData: vi.fn().mockResolvedValue(data),
      loadAppData: vi.fn().mockResolvedValue(data),
      loadSnapshots: vi.fn().mockResolvedValue([]),
    };

    await exportAllProjects(mockStorage);

    expect(mockStorage.loadAppData).not.toHaveBeenCalled();
    expect(mockStorage.readAppData).toHaveBeenCalledOnce();
  });
});
