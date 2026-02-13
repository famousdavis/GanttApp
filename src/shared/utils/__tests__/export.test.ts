import { describe, it, expect, vi } from 'vitest';
import { parseImportedData } from '../export';
import { AppData } from '../../types/app';

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
});
