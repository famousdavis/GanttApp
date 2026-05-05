// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseImportedData,
  exportSingleProject,
  exportSelectedProjects,
  mergeImportedProjects,
} from '../export';
import { AppData } from '../../types/app';
import type { Snapshot } from '../../types/snapshots';

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
// v19.0 — mergeImportedProjects
// ============================================================================

describe('mergeImportedProjects (v19.0)', () => {
  function makeExisting(): AppData {
    return {
      projects: [
        { id: 'p1', name: 'Existing 1' },
        { id: 'p2', name: 'Existing 2' },
      ],
      releases: [
        { id: 'r1', projectId: 'p1', name: 'r1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01' },
      ],
      preparedBy: 'preserved',
    };
  }

  function makeIncoming(projects: { id: string; name: string }[]): import('../export').ImportResult {
    return {
      appData: {
        projects,
        releases: projects.map(p => ({
          id: `r-${p.id}`, projectId: p.id, name: 'rel',
          startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01',
        })),
      },
      exportType: 'ganttapp-project-export',
    };
  }

  it('accepts all when no IDs collide', () => {
    const existing = makeExisting();
    const incoming = makeIncoming([{ id: 'p3', name: 'New' }, { id: 'p4', name: 'Newer' }]);
    const result = mergeImportedProjects(existing, incoming, []);
    expect(result.skipped).toBe(0);
    expect(result.mergedData.projects.map(p => p.id).sort()).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(result.mergedData.releases).toHaveLength(3);
  });

  it('skips all when every ID collides', () => {
    const existing = makeExisting();
    const incoming = makeIncoming([{ id: 'p1', name: 'Dup' }, { id: 'p2', name: 'Dup' }]);
    const result = mergeImportedProjects(existing, incoming, []);
    expect(result.skipped).toBe(2);
    expect(result.mergedData.projects).toHaveLength(2);
    expect(result.mergedData.releases).toHaveLength(1); // unchanged
  });

  it('skips collisions, accepts the rest', () => {
    const existing = makeExisting();
    const incoming = makeIncoming([{ id: 'p1', name: 'Dup' }, { id: 'p3', name: 'New' }]);
    const result = mergeImportedProjects(existing, incoming, []);
    expect(result.skipped).toBe(1);
    expect(result.mergedData.projects.map(p => p.id).sort()).toEqual(['p1', 'p2', 'p3']);
  });

  it('catches duplicates within the incoming batch itself', () => {
    const existing = makeExisting();
    const incoming = makeIncoming([{ id: 'p3', name: 'A' }, { id: 'p3', name: 'B' }]);
    const result = mergeImportedProjects(existing, incoming, []);
    expect(result.skipped).toBe(1); // second p3 dropped
    expect(result.mergedData.projects.filter(p => p.id === 'p3')).toHaveLength(1);
  });

  it('filters incoming releases to accepted project IDs only', () => {
    const existing = makeExisting();
    const incoming: import('../export').ImportResult = {
      appData: {
        projects: [{ id: 'p1', name: 'Dup' }, { id: 'p3', name: 'New' }],
        releases: [
          { id: 'rA', projectId: 'p1', name: 'should-skip', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01' },
          { id: 'rB', projectId: 'p3', name: 'should-keep', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01' },
        ],
      },
      exportType: 'ganttapp-project-export',
    };
    const result = mergeImportedProjects(existing, incoming, []);
    expect(result.mergedData.releases.map(r => r.id).sort()).toEqual(['r1', 'rB']);
  });

  it('deduplicates incoming snapshots by ID against existing snapshots', () => {
    const existing = makeExisting();
    const existingSnapshots: Snapshot[] = [
      { id: 's1', projectId: 'p1', timestamp: '2026-01-01T00:00:00Z', name: 'old', releases: [] },
    ];
    const incoming: import('../export').ImportResult = {
      appData: {
        projects: [{ id: 'p3', name: 'New' }],
        releases: [],
      },
      snapshots: [
        { id: 's1', projectId: 'p3', timestamp: '2026-01-02T00:00:00Z', name: 'dup', releases: [] }, // dup ID
        { id: 's2', projectId: 'p3', timestamp: '2026-01-03T00:00:00Z', name: 'new', releases: [] },
      ],
      exportType: 'ganttapp-project-export',
    };
    const result = mergeImportedProjects(existing, incoming, existingSnapshots);
    expect(result.mergedSnapshots.map(s => s.id).sort()).toEqual(['s1', 's2']);
  });

  it('only carries over snapshots whose projectId was accepted', () => {
    const existing = makeExisting();
    const incoming: import('../export').ImportResult = {
      appData: {
        projects: [{ id: 'p1', name: 'Dup' }, { id: 'p3', name: 'New' }],
        releases: [],
      },
      snapshots: [
        { id: 's-skip', projectId: 'p1', timestamp: '2026-01-01T00:00:00Z', name: 'a', releases: [] },
        { id: 's-keep', projectId: 'p3', timestamp: '2026-01-02T00:00:00Z', name: 'b', releases: [] },
      ],
      exportType: 'ganttapp-project-export',
    };
    const result = mergeImportedProjects(existing, incoming, []);
    expect(result.mergedSnapshots.map(s => s.id)).toEqual(['s-keep']);
  });

  it('preserves existing global settings untouched', () => {
    const existing = makeExisting();
    const incoming = makeIncoming([{ id: 'p3', name: 'New' }]);
    const result = mergeImportedProjects(existing, incoming, []);
    expect(result.mergedData.preparedBy).toBe('preserved');
  });
});
