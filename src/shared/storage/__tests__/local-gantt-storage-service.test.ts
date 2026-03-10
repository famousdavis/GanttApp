// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach } from 'vitest';
import { LocalGanttStorageService } from '../local-gantt-storage-service';
import type { AppData } from '../../types/app';
import type { Snapshot } from '../../types/snapshots';

function makeAppData(overrides: Partial<AppData> = {}): AppData {
  return {
    projects: [{ id: 'p1', name: 'Test Project' }],
    releases: [{
      id: 'r1',
      projectId: 'p1',
      name: 'Release 1',
      startDate: '2026-01-01',
      earlyFinishDate: '2026-02-01',
      lateFinishDate: '2026-03-01',
    }],
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    id: 'snap1',
    projectId: 'p1',
    timestamp: '2026-01-15T10:00:00.000Z',
    name: 'Sprint 1',
    releases: [{
      id: 'r1',
      projectId: 'p1',
      name: 'Release 1',
      startDate: '2026-01-01',
      earlyFinishDate: '2026-02-01',
      lateFinishDate: '2026-03-01',
    }],
    ...overrides,
  };
}

describe('LocalGanttStorageService', () => {
  let service: LocalGanttStorageService;

  beforeEach(() => {
    localStorage.clear();
    service = new LocalGanttStorageService();
  });

  it('has mode "local"', () => {
    expect(service.mode).toBe('local');
  });

  describe('loadAppData', () => {
    it('returns null when no data stored', async () => {
      const result = await service.loadAppData();
      expect(result).toBeNull();
    });

    it('returns validated data when stored', async () => {
      const data = makeAppData();
      localStorage.setItem('ganttAppData', JSON.stringify(data));

      const result = await service.loadAppData();
      expect(result).not.toBeNull();
      expect(result!.projects[0].name).toBe('Test Project');
      expect(result!.releases[0].name).toBe('Release 1');
    });

    it('returns null for invalid JSON', async () => {
      localStorage.setItem('ganttAppData', '{bad');
      const result = await service.loadAppData();
      expect(result).toBeNull();
    });
  });

  describe('saveAppData', () => {
    it('persists data to localStorage', async () => {
      const data = makeAppData();
      await service.saveAppData(data);

      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects[0].name).toBe('Test Project');
    });
  });

  describe('loadSnapshots', () => {
    it('returns empty array when no snapshots stored', async () => {
      const result = await service.loadSnapshots();
      expect(result).toEqual([]);
    });

    it('returns validated snapshots', async () => {
      const snapshots = [makeSnapshot()];
      localStorage.setItem('ganttAppSnapshots', JSON.stringify(snapshots));

      const result = await service.loadSnapshots();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Sprint 1');
    });

    it('filters out invalid snapshots', async () => {
      const data = [makeSnapshot(), { invalid: true }, null];
      localStorage.setItem('ganttAppSnapshots', JSON.stringify(data));

      const result = await service.loadSnapshots();
      expect(result).toHaveLength(1);
    });

    it('returns empty array for non-array data', async () => {
      localStorage.setItem('ganttAppSnapshots', '"not an array"');
      const result = await service.loadSnapshots();
      expect(result).toEqual([]);
    });
  });

  describe('saveSnapshots', () => {
    it('persists snapshots to localStorage', async () => {
      const snapshots = [makeSnapshot()];
      await service.saveSnapshots(snapshots);

      const stored = JSON.parse(localStorage.getItem('ganttAppSnapshots')!);
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('Sprint 1');
    });
  });

  describe('addSnapshot', () => {
    it('adds snapshot and returns updated list', async () => {
      const snapshot = makeSnapshot();
      const result = await service.addSnapshot(snapshot);

      expect(result).not.toBeNull();
      expect(result!).toHaveLength(1);
      expect(result![0].id).toBe('snap1');
    });

    it('appends to existing snapshots', async () => {
      const snap1 = makeSnapshot({ id: 'snap1' });
      const snap2 = makeSnapshot({ id: 'snap2', name: 'Sprint 2' });

      await service.addSnapshot(snap1);
      const result = await service.addSnapshot(snap2);

      expect(result).toHaveLength(2);
    });

    it('returns null when total limit (100) is reached', async () => {
      // Seed 100 snapshots
      const snapshots: Snapshot[] = [];
      for (let i = 0; i < 100; i++) {
        snapshots.push(makeSnapshot({ id: `snap${i}`, projectId: `p${i % 10}` }));
      }
      localStorage.setItem('ganttAppSnapshots', JSON.stringify(snapshots));

      const newSnap = makeSnapshot({ id: 'snap-new', projectId: 'p99' });
      const result = await service.addSnapshot(newSnap);

      expect(result).toBeNull();
    });

    it('returns null when per-project limit (50) is reached', async () => {
      // Seed 50 snapshots for project p1
      const snapshots: Snapshot[] = [];
      for (let i = 0; i < 50; i++) {
        snapshots.push(makeSnapshot({ id: `snap${i}`, projectId: 'p1' }));
      }
      localStorage.setItem('ganttAppSnapshots', JSON.stringify(snapshots));

      const newSnap = makeSnapshot({ id: 'snap-new', projectId: 'p1' });
      const result = await service.addSnapshot(newSnap);

      expect(result).toBeNull();
    });

    it('allows adding when under per-project limit', async () => {
      // Seed 49 snapshots for p1
      const snapshots: Snapshot[] = [];
      for (let i = 0; i < 49; i++) {
        snapshots.push(makeSnapshot({ id: `snap${i}`, projectId: 'p1' }));
      }
      localStorage.setItem('ganttAppSnapshots', JSON.stringify(snapshots));

      const newSnap = makeSnapshot({ id: 'snap-new', projectId: 'p1' });
      const result = await service.addSnapshot(newSnap);

      expect(result).not.toBeNull();
      expect(result!).toHaveLength(50);
    });
  });

  describe('deleteSnapshot', () => {
    it('removes snapshot by id and returns remaining', async () => {
      const snapshots = [
        makeSnapshot({ id: 'snap1' }),
        makeSnapshot({ id: 'snap2', name: 'Sprint 2' }),
      ];
      localStorage.setItem('ganttAppSnapshots', JSON.stringify(snapshots));

      const result = await service.deleteSnapshot('snap1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('snap2');
    });

    it('returns all snapshots when id not found', async () => {
      const snapshots = [makeSnapshot({ id: 'snap1' })];
      localStorage.setItem('ganttAppSnapshots', JSON.stringify(snapshots));

      const result = await service.deleteSnapshot('nonexistent');

      expect(result).toHaveLength(1);
    });
  });

  describe('deleteSnapshotsForProject', () => {
    it('removes all snapshots for a project', async () => {
      const snapshots = [
        makeSnapshot({ id: 'snap1', projectId: 'p1' }),
        makeSnapshot({ id: 'snap2', projectId: 'p1' }),
        makeSnapshot({ id: 'snap3', projectId: 'p2' }),
      ];
      localStorage.setItem('ganttAppSnapshots', JSON.stringify(snapshots));

      const result = await service.deleteSnapshotsForProject('p1');

      expect(result).toHaveLength(1);
      expect(result[0].projectId).toBe('p2');
    });

    it('returns all snapshots when project has none', async () => {
      const snapshots = [makeSnapshot({ id: 'snap1', projectId: 'p1' })];
      localStorage.setItem('ganttAppSnapshots', JSON.stringify(snapshots));

      const result = await service.deleteSnapshotsForProject('p99');

      expect(result).toHaveLength(1);
    });
  });
});
