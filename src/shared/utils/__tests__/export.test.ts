// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseImportedData,
  exportSingleProject,
  exportSelectedProjects,
  detectImportConflicts,
  conflictsEqual,
  applyImportDecisions,
  type ImportConflict,
  type ConflictAction,
  type ImportResult,
} from '../export';
import { AppData } from '../../types/app';
import type { Project } from '../../types/models';
import type { Snapshot } from '../../types/snapshots';
import { MAX_NAME_LENGTH } from '../validation';

describe('parseImportedData', () => {
  function makeValidExport(): AppData {
    return {
      projects: [
        { id: '1', name: 'Project A' },
        { id: '2', name: 'Project B', finishDate: '2026-06-01' },
      ],
      releases: [
        {
          id: 'r1',
          projectId: '1',
          name: 'Release 1.0',
          startDate: '2026-01-01',
          earlyFinishDate: '2026-02-01',
          lateFinishDate: '2026-03-01',
        },
      ],
    };
  }

  it('parses valid JSON with projects and releases arrays', () => {
    const data = makeValidExport();
    const json = JSON.stringify(data);

    const result = parseImportedData(json);
    expect(result).not.toBeNull();
    expect(result!.appData).toEqual(data);
    expect(result!.snapshots).toBeUndefined();
  });

  it('returns null for invalid JSON', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(parseImportedData('not json {{')).toBeNull();
    consoleSpy.mockRestore();
  });

  it('returns null when projects array is missing', () => {
    const json = JSON.stringify({ releases: [] });
    expect(parseImportedData(json)).toBeNull();
  });

  it('returns null when releases array is missing', () => {
    const json = JSON.stringify({ projects: [] });
    expect(parseImportedData(json)).toBeNull();
  });

  it('returns null when projects is not an array', () => {
    const json = JSON.stringify({ projects: 'not-array', releases: [] });
    expect(parseImportedData(json)).toBeNull();
  });

  it('returns null when releases is not an array', () => {
    const json = JSON.stringify({ projects: [], releases: 'not-array' });
    expect(parseImportedData(json)).toBeNull();
  });

  it('accepts empty projects and releases arrays', () => {
    const json = JSON.stringify({ projects: [], releases: [] });
    const result = parseImportedData(json);
    expect(result).not.toBeNull();
    expect(result!.appData).toEqual({ projects: [], releases: [] });
  });

  it('preserves optional fields in imported data', () => {
    const data: AppData = {
      projects: [{ id: '1', name: 'Test' }],
      releases: [],
      chartColors: {
        solidBar: '#ff0000',
        hatchedBar: '#00ff00',
        todayLine: '#0000ff',
        finishDateLine: '#ffff00',
        mostLikelyLine: '#000000',
        completedBar: '#90ee90',
        inProgressBar: '#f59e0b',
      },
      activePreset: 'Sunset',
      legendLabels: {
        solidBar: 'Custom Label',
        hatchedBar: 'Custom Hatched',
        finishDateLine: 'Target Date',
      },
      showFinishDateLine: true,
      chartDisplaySettings: {
        releaseNameFontSize: '18',
        dateLabelFontSize: '15',
        dateLabelColor: '#000',
        verticalLineWidth: '4',
        barHeight: '50',
        rowSpacing: '30',
      },
    };

    const json = JSON.stringify(data);
    const result = parseImportedData(json);
    expect(result).not.toBeNull();
    expect(result!.appData).toEqual(data);
  });

  it('accepts data with extra unknown fields (forward compatibility)', () => {
    const json = JSON.stringify({
      projects: [{ id: '1', name: 'Test' }],
      releases: [],
      futureField: 'some value',
      anotherField: 42,
    });

    const result = parseImportedData(json);
    expect(result).not.toBeNull();
    expect(result!.appData.projects).toHaveLength(1);
  });

  it('returns null for empty string', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(parseImportedData('')).toBeNull();
    consoleSpy.mockRestore();
  });

  it('round-trips with JSON.stringify and parseImportedData', () => {
    const original = makeValidExport();
    const json = JSON.stringify(original, null, 2);
    const parsed = parseImportedData(json);
    expect(parsed).not.toBeNull();
    expect(parsed!.appData).toEqual(original);
  });

  it('imports snapshots when present in the file', () => {
    const data = {
      projects: [{ id: '1', name: 'Test' }],
      releases: [],
      snapshots: [{
        id: 'snap1',
        projectId: '1',
        timestamp: '2026-01-15T10:00:00.000Z',
        name: 'Sprint 1 Review',
        releases: [{
          id: 'r1',
          projectId: '1',
          name: 'Release 1.0',
          startDate: '2026-01-01',
          earlyFinishDate: '2026-02-01',
          lateFinishDate: '2026-03-01',
        }],
      }],
    };
    const json = JSON.stringify(data);
    const result = parseImportedData(json);
    expect(result).not.toBeNull();
    expect(result!.snapshots).toHaveLength(1);
    expect(result!.snapshots![0].name).toBe('Sprint 1 Review');
  });

  it('silently skips invalid snapshots without rejecting the import', () => {
    const data = {
      projects: [{ id: '1', name: 'Test' }],
      releases: [],
      snapshots: [
        { id: 'snap1', projectId: '1', timestamp: '2026-01-15T10:00:00.000Z', name: 'Valid', releases: [] },
        { id: 123, name: 'Invalid — missing fields' },
        'not an object',
      ],
    };
    const json = JSON.stringify(data);
    const result = parseImportedData(json);
    expect(result).not.toBeNull();
    expect(result!.snapshots).toHaveLength(1);
    expect(result!.snapshots![0].name).toBe('Valid');
  });

  it('rejects projects missing required id field', () => {
    const json = JSON.stringify({
      projects: [{ name: 'Missing ID' }],
      releases: [],
    });
    expect(parseImportedData(json)).toBeNull();
  });

  it('rejects projects missing required name field', () => {
    const json = JSON.stringify({
      projects: [{ id: '1' }],
      releases: [],
    });
    expect(parseImportedData(json)).toBeNull();
  });

  it('rejects releases missing required fields', () => {
    const json = JSON.stringify({
      projects: [{ id: '1', name: 'Test' }],
      releases: [{ id: 'r1', name: 'Release' }], // missing projectId, dates
    });
    expect(parseImportedData(json)).toBeNull();
  });

  it('rejects projects with non-string id', () => {
    const json = JSON.stringify({
      projects: [{ id: 123, name: 'Test' }],
      releases: [],
    });
    expect(parseImportedData(json)).toBeNull();
  });

  it('rejects releases with non-string date fields', () => {
    const json = JSON.stringify({
      projects: [{ id: '1', name: 'Test' }],
      releases: [{
        id: 'r1',
        projectId: '1',
        name: 'Release',
        startDate: 20260101,
        earlyFinishDate: '2026-02-01',
        lateFinishDate: '2026-03-01',
      }],
    });
    expect(parseImportedData(json)).toBeNull();
  });

  it('preserves showTodayLine boolean in imported data', () => {
    const json = JSON.stringify({
      projects: [{ id: '1', name: 'Test' }],
      releases: [],
      showTodayLine: false,
    });
    const result = parseImportedData(json);
    expect(result).not.toBeNull();
    expect(result!.appData.showTodayLine).toBe(false);
  });

  it('preserves showMostLikelyLine boolean in imported data', () => {
    const json = JSON.stringify({
      projects: [{ id: '1', name: 'Test' }],
      releases: [],
      showMostLikelyLine: true,
    });
    const result = parseImportedData(json);
    expect(result).not.toBeNull();
    expect(result!.appData.showMostLikelyLine).toBe(true);
  });

  it('preserves a valid todayDateOverride in imported data (v0.28.0)', () => {
    const json = JSON.stringify({
      projects: [{ id: '1', name: 'Test' }],
      releases: [],
      todayDateOverride: '2026-08-19',
    });
    const result = parseImportedData(json);
    expect(result).not.toBeNull();
    expect(result!.appData.todayDateOverride).toBe('2026-08-19');
  });

  it('drops an invalid todayDateOverride on import (v0.28.0)', () => {
    for (const bad of ['08/19/2026', '2026-02-30', '1999-01-01', 42, null]) {
      const json = JSON.stringify({
        projects: [{ id: '1', name: 'Test' }],
        releases: [],
        todayDateOverride: bad,
      });
      const result = parseImportedData(json);
      expect(result).not.toBeNull();
      expect(result!.appData.todayDateOverride).toBeUndefined();
    }
  });

  it('ignores non-boolean showTodayLine values', () => {
    const json = JSON.stringify({
      projects: [{ id: '1', name: 'Test' }],
      releases: [],
      showTodayLine: 'yes',
    });
    const result = parseImportedData(json);
    expect(result).not.toBeNull();
    expect(result!.appData.showTodayLine).toBeUndefined();
  });
});

describe('parseImportedData — work week fields (v15.0)', () => {
  it('preserves project.workDays on import', () => {
    const json = JSON.stringify({
      projects: [{ id: '1', name: 'Test', workDays: [1, 2, 3, 4, 5] }],
      releases: [],
    });
    const result = parseImportedData(json);
    expect(result).not.toBeNull();
    expect(result!.appData.projects[0].workDays).toEqual([1, 2, 3, 4, 5]);
  });

  it('preserves globalWorkDays on import', () => {
    const json = JSON.stringify({
      projects: [{ id: '1', name: 'Test' }],
      releases: [],
      globalWorkDays: [0, 6],
    });
    const result = parseImportedData(json);
    expect(result).not.toBeNull();
    expect(result!.appData.globalWorkDays).toEqual([0, 6]);
  });

  it('silently drops invalid workDays on import', () => {
    const json = JSON.stringify({
      projects: [{ id: '1', name: 'Test', workDays: ['foo', 99, -1] }],
      releases: [],
    });
    const result = parseImportedData(json);
    expect(result).not.toBeNull();
    expect(result!.appData.projects[0].workDays).toBeUndefined();
  });

  // v16.1 — per-project legend label overrides
  it('round-trips project legendLabels through parseImportedData', () => {
    const json = JSON.stringify({
      projects: [{
        id: 'p1',
        name: 'With Labels',
        legendLabels: { solidBar: 'Build', hatchedBar: 'Risk', inProgress: 'Active' },
      }],
      releases: [],
    });
    const result = parseImportedData(json);
    expect(result).not.toBeNull();
    expect(result!.appData.projects[0].legendLabels).toEqual({
      solidBar: 'Build',
      hatchedBar: 'Risk',
      inProgress: 'Active',
    });
  });

  it('silently drops invalid project legendLabels on import', () => {
    const json = JSON.stringify({
      projects: [{ id: 'p1', name: 'Test', legendLabels: { solidBar: 42 } }],
      releases: [],
    });
    const result = parseImportedData(json);
    expect(result).not.toBeNull();
    // Invalid field dropped; result is undefined if no valid fields remain
    expect(result!.appData.projects[0].legendLabels).toBeUndefined();
  });
});

// ============================================================================
// v19.0 — exportType discriminator on ImportResult
// ============================================================================

describe('parseImportedData — exportType discriminator (v19.0)', () => {
  it('sets exportType to "ganttapp-all-projects" when _exportType matches', () => {
    const json = JSON.stringify({
      projects: [{ id: 'p1', name: 'Test' }],
      releases: [],
      _exportType: 'ganttapp-all-projects',
    });
    const result = parseImportedData(json);
    expect(result?.exportType).toBe('ganttapp-all-projects');
  });

  it('sets exportType to "ganttapp-project-export" when _exportType matches', () => {
    const json = JSON.stringify({
      projects: [{ id: 'p1', name: 'Test' }],
      releases: [],
      _exportType: 'ganttapp-project-export',
    });
    const result = parseImportedData(json);
    expect(result?.exportType).toBe('ganttapp-project-export');
  });

  it('sets exportType to "legacy" when _exportType is absent', () => {
    const json = JSON.stringify({
      projects: [{ id: 'p1', name: 'Test' }],
      releases: [],
    });
    const result = parseImportedData(json);
    expect(result?.exportType).toBe('legacy');
  });

  it('sets exportType to "legacy" when _exportType is unrecognized', () => {
    const json = JSON.stringify({
      projects: [{ id: 'p1', name: 'Test' }],
      releases: [],
      _exportType: 'something-else',
    });
    const result = parseImportedData(json);
    expect(result?.exportType).toBe('legacy');
  });
});

// ============================================================================
// v19.0 — download-helper test setup (DOM API mocks)
// ============================================================================

const mockClick = vi.fn();
let lastDownloadName: string | undefined;
let lastBlobContent: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  lastDownloadName = undefined;
  lastBlobContent = undefined;

  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'a') {
      return {
        click: mockClick,
        set href(_v: string) {},
        set download(v: string) { lastDownloadName = v; },
      } as unknown as HTMLAnchorElement;
    }
    return document.createElement(tag);
  });
  vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as unknown as Node);
  vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as unknown as Node);
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:mock');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

  // Spy on Blob constructor to capture the JSON content
  const OriginalBlob = global.Blob;
  global.Blob = class extends OriginalBlob {
    constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
      super(parts, options);
      if (parts && parts.length > 0 && typeof parts[0] === 'string') {
        lastBlobContent = parts[0];
      }
    }
  } as unknown as typeof Blob;
});

// ============================================================================
// v19.0 — exportSingleProject
// ============================================================================

describe('exportSingleProject (v19.0)', () => {
  function makeData(): AppData {
    return {
      projects: [
        { id: 'p1', name: 'Marketing Site' },
        { id: 'p2', name: 'API v2' },
      ],
      releases: [
        { id: 'r1', projectId: 'p1', name: 'Launch', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01' },
        { id: 'r2', projectId: 'p2', name: 'Beta',   startDate: '2026-02-01', earlyFinishDate: '2026-03-01', lateFinishDate: '2026-04-01' },
      ],
      // Global settings that MUST be excluded from per-project exports
      preparedBy: 'William Davis',
      showPreparedBy: true,
      chartColors: {
        solidBar: '#aaaaaa', hatchedBar: '#bbbbbb', todayLine: '#cccccc',
        finishDateLine: '#dddddd', mostLikelyLine: '#eeeeee',
        completedBar: '#fafafa', inProgressBar: '#0a0a0a',
      },
    };
  }

  it('downloads only the named project + its releases', async () => {
    const data = makeData();
    const storage = { loadSnapshots: vi.fn().mockResolvedValue([]) };

    await exportSingleProject('p1', data, storage);

    expect(mockClick).toHaveBeenCalledTimes(1);
    expect(lastBlobContent).toBeDefined();
    const obj = JSON.parse(lastBlobContent!);
    expect(obj.projects).toHaveLength(1);
    expect(obj.projects[0].id).toBe('p1');
    expect(obj.releases).toHaveLength(1);
    expect(obj.releases[0].projectId).toBe('p1');
  });

  it('excludes all global settings from the export object', async () => {
    const data = makeData();
    const storage = { loadSnapshots: vi.fn().mockResolvedValue([]) };

    await exportSingleProject('p1', data, storage);

    const obj = JSON.parse(lastBlobContent!);
    expect(obj.preparedBy).toBeUndefined();
    expect(obj.showPreparedBy).toBeUndefined();
    expect(obj.chartColors).toBeUndefined();
  });

  it('tags the file with _exportType: ganttapp-project-export', async () => {
    const data = makeData();
    const storage = { loadSnapshots: vi.fn().mockResolvedValue([]) };

    await exportSingleProject('p1', data, storage);

    const obj = JSON.parse(lastBlobContent!);
    expect(obj._exportType).toBe('ganttapp-project-export');
  });

  it('throws on unknown projectId', async () => {
    const data = makeData();
    const storage = { loadSnapshots: vi.fn().mockResolvedValue([]) };
    await expect(exportSingleProject('nope', data, storage)).rejects.toThrow('Project not found');
  });

  it('includes only project-matching snapshots when includeSnapshots=true', async () => {
    const data = makeData();
    const snapshots: Snapshot[] = [
      { id: 's1', projectId: 'p1', timestamp: '2026-01-15T00:00:00Z', name: 'p1 snap', releases: [] },
      { id: 's2', projectId: 'p2', timestamp: '2026-01-16T00:00:00Z', name: 'p2 snap', releases: [] },
    ];
    const storage = { loadSnapshots: vi.fn().mockResolvedValue(snapshots) };

    await exportSingleProject('p1', data, storage, { includeSnapshots: true });

    const obj = JSON.parse(lastBlobContent!);
    expect(obj.snapshots).toHaveLength(1);
    expect(obj.snapshots[0].id).toBe('s1');
  });

  it('omits snapshots when includeSnapshots is false or absent', async () => {
    const data = makeData();
    const storage = { loadSnapshots: vi.fn().mockResolvedValue([]) };

    await exportSingleProject('p1', data, storage);

    const obj = JSON.parse(lastBlobContent!);
    expect(obj.snapshots).toBeUndefined();
    expect(storage.loadSnapshots).not.toHaveBeenCalled();
  });

  it('adds _storageRef when cloud storageMode + uid are provided', async () => {
    const data = makeData();
    const storage = { loadSnapshots: vi.fn().mockResolvedValue([]) };

    await exportSingleProject('p1', data, storage, { storageMode: 'cloud', uid: 'user-abc' });

    const obj = JSON.parse(lastBlobContent!);
    expect(obj._storageRef).toBe('firestore:uid:user-abc');
  });

  it('produces a slugified filename', async () => {
    const data = makeData();
    const storage = { loadSnapshots: vi.fn().mockResolvedValue([]) };

    await exportSingleProject('p1', data, storage);

    expect(lastDownloadName).toMatch(/^ganttapp-marketing-site-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('handles names that reduce to empty after slugify by falling back to "project"', async () => {
    const data: AppData = {
      projects: [{ id: 'p1', name: '!!!@@@###' }],
      releases: [],
    };
    const storage = { loadSnapshots: vi.fn().mockResolvedValue([]) };

    await exportSingleProject('p1', data, storage);

    expect(lastDownloadName).toMatch(/^ganttapp-project-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('truncates long names in the slug to 40 chars', async () => {
    const data: AppData = {
      projects: [{ id: 'p1', name: 'a'.repeat(80) }],
      releases: [],
    };
    const storage = { loadSnapshots: vi.fn().mockResolvedValue([]) };

    await exportSingleProject('p1', data, storage);

    // Filename = 'ganttapp-' + slug (40 chars) + '-YYYY-MM-DD.json'
    expect(lastDownloadName).toMatch(/^ganttapp-a{40}-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

// ============================================================================
// v19.0 — exportSelectedProjects
// ============================================================================

describe('exportSelectedProjects (v19.0)', () => {
  function makeData(): AppData {
    return {
      projects: [
        { id: 'p1', name: 'A' },
        { id: 'p2', name: 'B' },
        { id: 'p3', name: 'C' },
      ],
      releases: [
        { id: 'r1', projectId: 'p1', name: 'r1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01' },
        { id: 'r2', projectId: 'p2', name: 'r2', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01' },
        { id: 'r3', projectId: 'p3', name: 'r3', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01' },
      ],
      preparedBy: 'global-only',
    };
  }

  it('throws when projectIds is empty', async () => {
    const data = makeData();
    const storage = { loadSnapshots: vi.fn().mockResolvedValue([]) };
    await expect(exportSelectedProjects([], data, storage)).rejects.toThrow('No projects selected');
  });

  it('exports only the selected projects + their releases', async () => {
    const data = makeData();
    const storage = { loadSnapshots: vi.fn().mockResolvedValue([]) };

    const result = await exportSelectedProjects(['p1', 'p3'], data, storage);

    expect(result.exported).toBe(2);
    const obj = JSON.parse(lastBlobContent!);
    expect(obj.projects.map((p: { id: string }) => p.id).sort()).toEqual(['p1', 'p3']);
    expect(obj.releases.map((r: { id: string }) => r.id).sort()).toEqual(['r1', 'r3']);
  });

  it('excludes all global settings', async () => {
    const data = makeData();
    const storage = { loadSnapshots: vi.fn().mockResolvedValue([]) };

    await exportSelectedProjects(['p1'], data, storage);

    const obj = JSON.parse(lastBlobContent!);
    expect(obj.preparedBy).toBeUndefined();
    expect(obj._exportType).toBe('ganttapp-project-export');
  });

  it('includes _storageRef when cloud storageMode + uid are provided', async () => {
    const data = makeData();
    const storage = { loadSnapshots: vi.fn().mockResolvedValue([]) };

    await exportSelectedProjects(['p1'], data, storage, { storageMode: 'cloud', uid: 'u1' });

    const obj = JSON.parse(lastBlobContent!);
    expect(obj._storageRef).toBe('firestore:uid:u1');
  });

  it('produces a multi-project filename', async () => {
    const data = makeData();
    const storage = { loadSnapshots: vi.fn().mockResolvedValue([]) };

    await exportSelectedProjects(['p1', 'p2'], data, storage);

    expect(lastDownloadName).toMatch(/^ganttapp-projects-export-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

// ============================================================================
// v0.24.0 — detectImportConflicts
// ============================================================================

describe('detectImportConflicts (v0.24.0)', () => {
  function makeExisting(projects: Project[]): AppData {
    return { projects, releases: [] };
  }
  function makeIncoming(projects: Project[]): ImportResult {
    return {
      appData: { projects, releases: [] },
      exportType: 'ganttapp-project-export',
    };
  }

  it('reports ID conflict when IDs match', () => {
    const existing = makeExisting([{ id: 'p1', name: 'Alpha' }]);
    const incoming = makeIncoming([{ id: 'p1', name: 'Renamed Alpha' }]);
    const conflicts = detectImportConflicts(incoming, existing);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('id');
    expect(conflicts[0].incomingProject.id).toBe('p1');
    expect(conflicts[0].existingProject.id).toBe('p1');
  });

  it('reports name conflict when names match case-insensitively but IDs differ', () => {
    const existing = makeExisting([{ id: 'p1', name: 'Alpha' }]);
    const incoming = makeIncoming([{ id: 'p2', name: '  alpha ' }]);
    const conflicts = detectImportConflicts(incoming, existing);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('name');
    expect(conflicts[0].existingProject.id).toBe('p1');
    expect(conflicts[0].incomingProject.id).toBe('p2');
  });

  it('reports type:id only when both ID and name match', () => {
    const existing = makeExisting([{ id: 'p1', name: 'Alpha' }]);
    const incoming = makeIncoming([{ id: 'p1', name: 'Alpha' }]);
    const conflicts = detectImportConflicts(incoming, existing);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('id');
  });

  it('returns empty array when no conflicts', () => {
    const existing = makeExisting([{ id: 'p1', name: 'Alpha' }]);
    const incoming = makeIncoming([{ id: 'p2', name: 'Beta' }]);
    expect(detectImportConflicts(incoming, existing)).toEqual([]);
  });

  it('returns first existing project (insertion order) when two existing share a name', () => {
    const existing = makeExisting([
      { id: 'p1', name: 'Duplicate' },
      { id: 'p2', name: 'duplicate' },
    ]);
    const incoming = makeIncoming([{ id: 'p3', name: 'DUPLICATE' }]);
    const conflicts = detectImportConflicts(incoming, existing);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].existingProject.id).toBe('p1'); // first-match semantics
  });

  it('does not flag two incoming projects sharing a name with each other', () => {
    const existing = makeExisting([{ id: 'p1', name: 'Alpha' }]);
    const incoming = makeIncoming([
      { id: 'p10', name: 'New' },
      { id: 'p11', name: 'New' },
    ]);
    expect(detectImportConflicts(incoming, existing)).toEqual([]);
  });
});

// ============================================================================
// v0.24.0 — conflictsEqual
// ============================================================================

describe('conflictsEqual (v0.24.0)', () => {
  const c = (incomingId: string, type: 'id' | 'name', existingId: string): ImportConflict => ({
    type,
    incomingProject: { id: incomingId, name: incomingId },
    existingProject: { id: existingId, name: existingId },
  });

  it('returns true for same conflicts in same order', () => {
    const a = [c('a', 'id', 'a'), c('b', 'name', 'x')];
    const b = [c('a', 'id', 'a'), c('b', 'name', 'x')];
    expect(conflictsEqual(a, b)).toBe(true);
  });

  it('returns true for same conflicts in different order (multiset)', () => {
    const a = [c('a', 'id', 'a'), c('b', 'name', 'x')];
    const b = [c('b', 'name', 'x'), c('a', 'id', 'a')];
    expect(conflictsEqual(a, b)).toBe(true);
  });

  it('returns false when one conflict is added', () => {
    const a = [c('a', 'id', 'a')];
    const b = [c('a', 'id', 'a'), c('b', 'name', 'x')];
    expect(conflictsEqual(a, b)).toBe(false);
  });

  it('returns false when one conflict is removed', () => {
    const a = [c('a', 'id', 'a'), c('b', 'name', 'x')];
    const b = [c('a', 'id', 'a')];
    expect(conflictsEqual(a, b)).toBe(false);
  });

  it('returns false when conflict type changes for same incoming ID', () => {
    const a = [c('a', 'id', 'a')];
    const b = [c('a', 'name', 'a')];
    expect(conflictsEqual(a, b)).toBe(false);
  });

  it('returns false when existingProject.id changes for a name conflict', () => {
    const a = [c('a', 'name', 'x')];
    const b = [c('a', 'name', 'y')];
    expect(conflictsEqual(a, b)).toBe(false);
  });
});

// ============================================================================
// v0.24.0 — applyImportDecisions
// ============================================================================

describe('applyImportDecisions (v0.24.0)', () => {
  function makeDeterministicGen() {
    let n = 0;
    return () => `test-id-${n++}`;
  }

  function rel(id: string, projectId: string) {
    return {
      id,
      projectId,
      name: `rel-${id}`,
      startDate: '2026-01-01',
      earlyFinishDate: '2026-02-01',
      lateFinishDate: '2026-03-01',
    };
  }

  function snap(id: string, projectId: string, releaseProjectIds: string[] = []): Snapshot {
    return {
      id,
      projectId,
      timestamp: '2026-01-01T00:00:00Z',
      name: `snap-${id}`,
      releases: releaseProjectIds.map((pid, i) => ({
        id: `${id}-r${i}`,
        projectId: pid,
        name: 'snap-rel',
        startDate: '2026-01-01',
        earlyFinishDate: '2026-02-01',
        lateFinishDate: '2026-03-01',
      })),
    };
  }

  it("'skip' excludes project, releases, and snapshots; count correct", () => {
    const existing: AppData = {
      projects: [{ id: 'p1', name: 'Alpha' }],
      releases: [rel('r1', 'p1')],
    };
    const incoming: ImportResult = {
      appData: {
        projects: [{ id: 'p1', name: 'Alpha-imported' }],
        releases: [rel('r-incoming', 'p1')],
      },
      snapshots: [snap('s-incoming', 'p1')],
      exportType: 'ganttapp-project-export',
    };
    const conflicts = detectImportConflicts(incoming, existing);
    const result = applyImportDecisions(existing, incoming, [], new Map([['p1', 'skip']]), conflicts);
    expect(result.result.skipped).toBe(1);
    expect(result.result.added).toBe(0);
    expect(result.result.copied).toBe(0);
    expect(result.result.replaced).toBe(0);
    expect(result.mergedData.projects).toEqual([{ id: 'p1', name: 'Alpha' }]);
    expect(result.mergedData.releases).toEqual([rel('r1', 'p1')]);
    expect(result.mergedSnapshots).toEqual([]);
  });

  it('missing decisions key for a conflict treated as skip; project + releases + snapshots all excluded', () => {
    const existing: AppData = {
      projects: [{ id: 'p1', name: 'Alpha' }],
      releases: [rel('r1', 'p1')],
    };
    const incoming: ImportResult = {
      appData: {
        projects: [{ id: 'p1', name: 'Alpha-incoming' }],
        releases: [rel('r-incoming', 'p1')],
      },
      snapshots: [snap('s-incoming', 'p1')],
      exportType: 'ganttapp-project-export',
    };
    // Empty decisions Map — conflict has no entry.
    const conflicts = detectImportConflicts(incoming, existing);
    const result = applyImportDecisions(existing, incoming, [], new Map(), conflicts);
    expect(result.result.skipped).toBe(1);
    expect(result.mergedData.projects).toEqual([{ id: 'p1', name: 'Alpha' }]);
    expect(result.mergedData.releases.find(r => r.id === 'r-incoming')).toBeUndefined();
    expect(result.mergedSnapshots.find(s => s.id === 's-incoming')).toBeUndefined();
  });

  it("'copy' regenerates project ID, appends '(2)' suffix, regenerates release IDs and snapshot top-level IDs; embedded snapshot.releases untouched", () => {
    const existing: AppData = {
      projects: [{ id: 'p1', name: 'Alpha' }],
      releases: [],
    };
    const incoming: ImportResult = {
      appData: {
        projects: [{ id: 'p2', name: 'Alpha' }],  // name conflict
        releases: [rel('r-incoming', 'p2')],
      },
      snapshots: [snap('s-incoming', 'p2', ['p2'])],  // embedded release references original p2
      exportType: 'ganttapp-project-export',
    };
    const gen = makeDeterministicGen();
    const conflicts = detectImportConflicts(incoming, existing);
    const result = applyImportDecisions(existing, incoming, [], new Map([['p2', 'copy']]), conflicts, gen);
    expect(result.result.copied).toBe(1);
    const copyProject = result.mergedData.projects[result.mergedData.projects.length - 1];
    expect(copyProject.id).toBe('test-id-0');
    expect(copyProject.name).toBe('Alpha (2)');
    expect(copyProject.owner).toBeUndefined();
    // Release regenerated with new projectId.
    const copyRel = result.mergedData.releases.find(r => r.projectId === 'test-id-0');
    expect(copyRel).toBeDefined();
    expect(copyRel!.id).not.toBe('r-incoming');
    // Snapshot top-level regenerated; embedded releases untouched.
    const copySnap = result.mergedSnapshots.find(s => s.projectId === 'test-id-0');
    expect(copySnap).toBeDefined();
    expect(copySnap!.id).not.toBe('s-incoming');
    expect(copySnap!.releases[0].projectId).toBe('p2'); // ORIGINAL, untouched
  });

  it("'copy' name truncation: name exactly MAX_NAME_LENGTH chars → result ≤ MAX_NAME_LENGTH", () => {
    const longName = 'x'.repeat(MAX_NAME_LENGTH);
    const existing: AppData = {
      projects: [{ id: 'p1', name: longName }],
      releases: [],
    };
    const incoming: ImportResult = {
      appData: {
        projects: [{ id: 'p2', name: longName }],
        releases: [],
      },
      exportType: 'ganttapp-project-export',
    };
    const conflicts = detectImportConflicts(incoming, existing);
    const result = applyImportDecisions(existing, incoming, [], new Map([['p2', 'copy']]), conflicts, makeDeterministicGen());
    const copyProject = result.mergedData.projects[result.mergedData.projects.length - 1];
    expect(copyProject.name.length).toBeLessThanOrEqual(MAX_NAME_LENGTH);
    expect(copyProject.name.endsWith(' (2)')).toBe(true);
  });

  it("'copy' name truncation: 97, 98, 99 chars → all ≤ MAX_NAME_LENGTH", () => {
    for (const len of [97, 98, 99]) {
      const name = 'a'.repeat(len);
      const existing: AppData = {
        projects: [{ id: 'p1', name }],
        releases: [],
      };
      const incoming: ImportResult = {
        appData: { projects: [{ id: 'p2', name }], releases: [] },
        exportType: 'ganttapp-project-export',
      };
      const conflicts = detectImportConflicts(incoming, existing);
      const result = applyImportDecisions(existing, incoming, [], new Map([['p2', 'copy']]), conflicts, makeDeterministicGen());
      const copyProject = result.mergedData.projects[result.mergedData.projects.length - 1];
      expect(copyProject.name.length).toBeLessThanOrEqual(MAX_NAME_LENGTH);
    }
  });

  it("'copy' when workspace has Foo (2): produces Foo (3) via collision-safe iteration (v0.26.0 — pitfall #84)", () => {
    const existing: AppData = {
      projects: [
        { id: 'p1', name: 'Roadmap' },
        { id: 'p2', name: 'Roadmap (2)' },
      ],
      releases: [],
    };
    const incoming: ImportResult = {
      appData: { projects: [{ id: 'p3', name: 'Roadmap' }], releases: [] },
      exportType: 'ganttapp-project-export',
    };
    const conflicts = detectImportConflicts(incoming, existing);
    const result = applyImportDecisions(existing, incoming, [], new Map([['p3', 'copy']]), conflicts, makeDeterministicGen());
    const copyProject = result.mergedData.projects[result.mergedData.projects.length - 1];
    expect(copyProject.name).toBe('Roadmap (3)'); // iterates past existing 'Roadmap (2)'
  });

  it("two 'copy' decisions in same batch → first Foo (2), second Foo (3) (v0.26.0 — distinct names)", () => {
    const existing: AppData = {
      projects: [{ id: 'p1', name: 'Foo' }],
      releases: [],
    };
    const incoming: ImportResult = {
      appData: {
        projects: [
          { id: 'p2', name: 'Foo' },
          { id: 'p3', name: 'Foo' },
        ],
        releases: [],
      },
      exportType: 'ganttapp-project-export',
    };
    const gen = makeDeterministicGen();
    const conflicts = detectImportConflicts(incoming, existing);
    const result = applyImportDecisions(existing, incoming, [], new Map<string, ConflictAction>([['p2', 'copy'], ['p3', 'copy']]), conflicts, gen);
    const names = result.mergedData.projects.map(p => p.name);
    expect(names).toContain('Foo (2)');
    expect(names).toContain('Foo (3)');
    const copies = result.mergedData.projects.filter(p => /^Foo \(\d+\)$/.test(p.name));
    expect(copies).toHaveLength(2);
    expect(new Set(copies.map(p => p.name)).size).toBe(2); // names are distinct
  });

  it("three 'copy' decisions in same batch → Foo (2), Foo (3), Foo (4) (v0.26.0)", () => {
    const existing: AppData = {
      projects: [{ id: 'p1', name: 'Foo' }],
      releases: [],
    };
    const incoming: ImportResult = {
      appData: {
        projects: [
          { id: 'p2', name: 'Foo' },
          { id: 'p3', name: 'Foo' },
          { id: 'p4', name: 'Foo' },
        ],
        releases: [],
      },
      exportType: 'ganttapp-project-export',
    };
    const conflicts = detectImportConflicts(incoming, existing);
    const result = applyImportDecisions(
      existing, incoming, [],
      new Map<string, ConflictAction>([['p2', 'copy'], ['p3', 'copy'], ['p4', 'copy']]),
      conflicts, makeDeterministicGen()
    );
    const names = result.mergedData.projects.map(p => p.name);
    expect(names).toContain('Foo (2)');
    expect(names).toContain('Foo (3)');
    expect(names).toContain('Foo (4)');
  });

  it("'copy' iteration covers (2)..(99); workspace with Foo (2)..(50) → produces Foo (51) (v0.26.0)", () => {
    const existing: AppData = {
      projects: [
        { id: 'p1', name: 'Foo' },
        ...Array.from({ length: 49 }, (_, i) => ({ id: `pn${i}`, name: `Foo (${i + 2})` })),
      ],
      releases: [],
    };
    const incoming: ImportResult = {
      appData: { projects: [{ id: 'p-incoming', name: 'Foo' }], releases: [] },
      exportType: 'ganttapp-project-export',
    };
    const conflicts = detectImportConflicts(incoming, existing);
    const result = applyImportDecisions(existing, incoming, [], new Map([['p-incoming', 'copy']]), conflicts, makeDeterministicGen());
    const copyProject = result.mergedData.projects[result.mergedData.projects.length - 1];
    expect(copyProject.name).toBe('Foo (51)');
  });

  it("'replace' on ID conflict: slot-preserved, existing releases/snapshots removed, others unchanged, owner preserved, replacedIdMap empty", () => {
    const existing: AppData = {
      projects: [
        { id: 'p1', name: 'Alpha', owner: 'user-A' },
        { id: 'p2', name: 'Beta' },
      ],
      releases: [rel('r1', 'p1'), rel('r2', 'p2')],
    };
    const existingSnaps: Snapshot[] = [snap('s1', 'p1'), snap('s2', 'p2')];
    const incoming: ImportResult = {
      appData: {
        projects: [{ id: 'p1', name: 'Alpha-new' }],
        releases: [rel('r-new', 'p1')],
      },
      exportType: 'ganttapp-project-export',
    };
    const conflicts = detectImportConflicts(incoming, existing);
    const result = applyImportDecisions(existing, incoming, existingSnaps, new Map([['p1', 'replace']]), conflicts);
    expect(result.result.replaced).toBe(1);
    expect(result.mergedData.projects[0].id).toBe('p1');
    expect(result.mergedData.projects[0].name).toBe('Alpha-new');
    expect(result.mergedData.projects[0].owner).toBe('user-A'); // preserved
    expect(result.mergedData.projects[1].id).toBe('p2'); // unchanged
    expect(result.mergedData.releases.find(r => r.id === 'r1')).toBeUndefined(); // existing removed
    expect(result.mergedData.releases.find(r => r.id === 'r2')).toBeDefined(); // other unchanged
    expect(result.mergedData.releases.find(r => r.id === 'r-new')).toBeDefined();
    expect(result.mergedSnapshots.find(s => s.id === 's1')).toBeUndefined();
    expect(result.mergedSnapshots.find(s => s.id === 's2')).toBeDefined();
    expect(result.result.replacedIdMap.size).toBe(0); // ID conflict → no remap entry
  });

  it("'replace' on ID conflict when existing has no owner: incoming has no owner (no fabricated UID)", () => {
    const existing: AppData = {
      projects: [{ id: 'p1', name: 'Alpha' }],
      releases: [],
    };
    const incoming: ImportResult = {
      appData: { projects: [{ id: 'p1', name: 'Alpha-new', owner: 'leaked-uid' }], releases: [] },
      exportType: 'ganttapp-project-export',
    };
    const conflicts = detectImportConflicts(incoming, existing);
    const result = applyImportDecisions(existing, incoming, [], new Map([['p1', 'replace']]), conflicts);
    expect(result.mergedData.projects[0].owner).toBeUndefined();
  });

  it("'replace' on name conflict: slot-preserved, releases/snapshots swapped, owner preserved, replacedIdMap directional", () => {
    const existing: AppData = {
      projects: [
        { id: 'old-1', name: 'Alpha', owner: 'user-A' },
        { id: 'old-2', name: 'Beta' },
      ],
      releases: [rel('r-old1', 'old-1'), rel('r-old2', 'old-2')],
    };
    const existingSnaps: Snapshot[] = [snap('s-old1', 'old-1'), snap('s-old2', 'old-2')];
    const incoming: ImportResult = {
      appData: {
        projects: [{ id: 'new-1', name: 'Alpha' }],
        releases: [rel('r-new1', 'new-1')],
      },
      exportType: 'ganttapp-project-export',
    };
    const conflicts = detectImportConflicts(incoming, existing);
    const result = applyImportDecisions(existing, incoming, existingSnaps, new Map([['new-1', 'replace']]), conflicts);
    expect(result.result.replaced).toBe(1);
    expect(result.mergedData.projects[0].id).toBe('new-1');
    expect(result.mergedData.projects[0].owner).toBe('user-A');
    expect(result.mergedData.projects[1].id).toBe('old-2'); // unchanged
    expect(result.mergedData.releases.find(r => r.id === 'r-old1')).toBeUndefined();
    expect(result.mergedData.releases.find(r => r.id === 'r-old2')).toBeDefined();
    expect(result.mergedSnapshots.find(s => s.id === 's-old1')).toBeUndefined();
    expect(result.mergedSnapshots.find(s => s.id === 's-old2')).toBeDefined();
    expect(result.result.replacedIdMap.get('old-1')).toBe('new-1');
    expect(result.result.replacedIdMap.get('new-1')).toBeUndefined(); // reverse absent
  });

  it("multi-replace-same-slot: first-in-array-order wins regardless of decisions Map insertion order", () => {
    const existing: AppData = {
      projects: [{ id: 'p1', name: 'Target' }],
      releases: [],
    };
    const incoming: ImportResult = {
      appData: {
        projects: [
          { id: 'p1', name: 'First-by-array' },       // type:id, first in array
          { id: 'p2', name: 'Target' },               // type:name, second in array
        ],
        releases: [],
      },
      exportType: 'ganttapp-project-export',
    };
    // Insert p2 decision FIRST in Map iteration order.
    const decisions = new Map<string, ConflictAction>();
    decisions.set('p2', 'replace');
    decisions.set('p1', 'replace');
    const conflicts = detectImportConflicts(incoming, existing);
    const result = applyImportDecisions(existing, incoming, [], decisions, conflicts);
    expect(result.result.replaced).toBe(1);
    expect(result.result.skipped).toBe(1);
    // Winner is p1 (first in incoming.appData.projects array order).
    expect(result.mergedData.projects[0].id).toBe('p1');
    expect(result.mergedData.projects[0].name).toBe('First-by-array');
  });

  it("non-conflicting projects are included, appended at end, counted as 'added'", () => {
    const existing: AppData = {
      projects: [{ id: 'p1', name: 'Alpha' }],
      releases: [],
    };
    const incoming: ImportResult = {
      appData: {
        projects: [{ id: 'p2', name: 'Beta' }, { id: 'p3', name: 'Gamma' }],
        releases: [],
      },
      exportType: 'ganttapp-project-export',
    };
    const conflicts = detectImportConflicts(incoming, existing);
    const result = applyImportDecisions(existing, incoming, [], new Map(), conflicts);
    expect(result.result.added).toBe(2);
    expect(result.mergedData.projects.map(p => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it("snapshot dedup by ID on 'added' path", () => {
    const existing: AppData = {
      projects: [{ id: 'p1', name: 'Alpha' }],
      releases: [],
    };
    const existingSnaps: Snapshot[] = [snap('shared-snap-id', 'p1')];
    const incoming: ImportResult = {
      appData: { projects: [{ id: 'p2', name: 'Beta' }], releases: [] },
      snapshots: [snap('shared-snap-id', 'p2'), snap('new-snap', 'p2')],
      exportType: 'ganttapp-project-export',
    };
    const conflicts = detectImportConflicts(incoming, existing);
    const result = applyImportDecisions(existing, incoming, existingSnaps, new Map(), conflicts);
    expect(result.mergedSnapshots.filter(s => s.id === 'shared-snap-id')).toHaveLength(1);
    expect(result.mergedSnapshots.find(s => s.id === 'new-snap')).toBeDefined();
  });

  it("stray key in decisions (not a conflict) is silently ignored", () => {
    const existing: AppData = {
      projects: [{ id: 'p1', name: 'Alpha' }],
      releases: [],
    };
    const incoming: ImportResult = {
      appData: { projects: [{ id: 'p2', name: 'Beta' }], releases: [] },
      exportType: 'ganttapp-project-export',
    };
    // 'stray-id' does not exist in incoming; should be ignored.
    const conflicts = detectImportConflicts(incoming, existing);
    const result = applyImportDecisions(existing, incoming, [], new Map([['stray-id', 'replace']]), conflicts);
    expect(result.result.added).toBe(1);
    expect(result.result.replaced).toBe(0);
    expect(result.result.skipped).toBe(0);
  });

  it("preserves existing global settings untouched", () => {
    const existing: AppData = {
      projects: [{ id: 'p1', name: 'Alpha' }],
      releases: [],
      preparedBy: 'preserved',
    };
    const incoming: ImportResult = {
      appData: { projects: [{ id: 'p2', name: 'Beta' }], releases: [], preparedBy: 'should-be-ignored' },
      exportType: 'ganttapp-project-export',
    };
    const conflicts = detectImportConflicts(incoming, existing);
    const result = applyImportDecisions(existing, incoming, [], new Map(), conflicts);
    expect(result.mergedData.preparedBy).toBe('preserved');
  });
});
