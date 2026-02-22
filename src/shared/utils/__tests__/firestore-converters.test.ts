import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  projectToFirestoreMeta,
  releaseToFirestore,
  appDataToUserSettings,
  snapshotToFirestore,
  firestoreToProject,
  firestoreReleasesToFlat,
  userSettingsToAppData,
  firestoreSnapshotToFlat,
  firestoreToFlatAppData,
  appendChangeLogEntry,
} from '../firestore-converters';
import { MAX_CHANGELOG_ENTRIES } from '../../types/firestore';
import type { Project, Release } from '../../types/models';
import type { AppData } from '../../types/app';
import type { Snapshot } from '../../types/snapshots';
import type {
  FirestoreProjectMeta,
  FirestoreRelease,
  FirestoreSnapshot,
  FirestoreUserSettings,
  ChangeLogEntry,
} from '../../types/firestore';

const mockProject: Project = { id: 'p1', name: 'Project Alpha', finishDate: '2026-06-30' };
const mockRelease: Release = {
  id: 'r1',
  projectId: 'p1',
  name: 'Release 1',
  startDate: '2026-01-01',
  earlyFinishDate: '2026-03-01',
  lateFinishDate: '2026-04-01',
  hidden: false,
  completed: true,
  mostLikelyFinishDate: '2026-03-15',
};

describe('firestore-converters', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-20T12:00:00.000Z'));
  });

  // --- projectToFirestoreMeta ---

  describe('projectToFirestoreMeta', () => {
    it('creates new meta for a project', () => {
      const meta = projectToFirestoreMeta(mockProject, 'uid-123');
      expect(meta.name).toBe('Project Alpha');
      expect(meta.owner).toBe('uid-123');
      expect(meta.members).toEqual({ 'uid-123': 'owner' });
      expect(meta.finishDate).toBe('2026-06-30');
      expect(meta.schemaVersion).toBe(1);
      expect(meta._originRef).toBe('uid:uid-123');
      expect(meta._changeLog).toEqual([]);
      expect(meta.createdAt).toBe('2026-02-20T12:00:00.000Z');
      expect(meta.updatedAt).toBe('2026-02-20T12:00:00.000Z');
    });

    it('preserves existing meta fields when provided', () => {
      const existing: Partial<FirestoreProjectMeta> = {
        owner: 'uid-original',
        members: { 'uid-original': 'owner', 'uid-123': 'editor' },
        _originRef: 'uid:uid-original',
        _changeLog: [{ timestamp: '2026-01-01T00:00:00.000Z', uid: 'uid-original', action: 'create', target: 'project:p1' }],
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      const meta = projectToFirestoreMeta(mockProject, 'uid-123', existing);
      expect(meta.owner).toBe('uid-original');
      expect(meta.members['uid-123']).toBe('editor');
      expect(meta.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(meta.updatedAt).toBe('2026-02-20T12:00:00.000Z'); // always updated
    });

    it('handles project without finishDate', () => {
      const project: Project = { id: 'p2', name: 'No Date' };
      const meta = projectToFirestoreMeta(project, 'uid-1');
      expect(meta.finishDate).toBeNull();
    });
  });

  // --- releaseToFirestore ---

  describe('releaseToFirestore', () => {
    it('converts a release with all optional fields', () => {
      const result = releaseToFirestore(mockRelease, 0);
      expect(result.name).toBe('Release 1');
      expect(result.order).toBe(0);
      expect(result.hidden).toBe(false);
      expect(result.completed).toBe(true);
      expect(result.mostLikelyFinishDate).toBe('2026-03-15');
      expect((result as Record<string, unknown>).id).toBeUndefined();
      expect((result as Record<string, unknown>).projectId).toBeUndefined();
    });

    it('omits undefined optional fields', () => {
      const minimal: Release = {
        id: 'r2', projectId: 'p1', name: 'Min',
        startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01',
      };
      const result = releaseToFirestore(minimal, 3);
      expect(result.order).toBe(3);
      expect(result.hidden).toBeUndefined();
      expect(result.completed).toBeUndefined();
      expect(result.mostLikelyFinishDate).toBeUndefined();
    });
  });

  // --- appDataToUserSettings ---

  describe('appDataToUserSettings', () => {
    it('extracts settings from full AppData', () => {
      const data: AppData = {
        projects: [],
        releases: [],
        chartColors: { solidBar: '#000', hatchedBar: '#111', todayLine: '#222', finishDateLine: '#333', mostLikelyLine: '#444', completedBar: '#555' },
        activePreset: 'Default',
        showTodayLine: true,
        preparedBy: 'William',
        showPreparedBy: true,
      };
      const settings = appDataToUserSettings(data);
      expect(settings.chartColors?.solidBar).toBe('#000');
      expect(settings.activePreset).toBe('Default');
      expect(settings.showTodayLine).toBe(true);
      expect(settings.preparedBy).toBe('William');
    });

    it('omits undefined fields', () => {
      const data: AppData = { projects: [], releases: [] };
      const settings = appDataToUserSettings(data);
      expect(settings.chartColors).toBeUndefined();
      expect(settings.activePreset).toBeUndefined();
      expect(settings.showTodayLine).toBeUndefined();
    });

    it('includes exportAttribution when present', () => {
      const data: AppData = {
        projects: [], releases: [],
        exportAttribution: { name: 'Alice', identifier: 'student-42' },
      };
      const settings = appDataToUserSettings(data);
      expect(settings.exportAttribution).toEqual({ name: 'Alice', identifier: 'student-42' });
    });

    it('includes empty-string preparedBy (Bug #2: was dropped by truthy check)', () => {
      const data: AppData = { projects: [], releases: [], preparedBy: '' };
      const settings = appDataToUserSettings(data);
      expect(settings.preparedBy).toBe('');
    });
  });

  // --- firestoreToProject ---

  describe('firestoreToProject', () => {
    it('converts Firestore meta back to Project', () => {
      const meta: FirestoreProjectMeta = {
        name: 'Alpha', owner: 'uid-1', members: { 'uid-1': 'owner' },
        schemaVersion: 1, createdAt: '', updatedAt: '', finishDate: '2026-06-30',
      };
      const project = firestoreToProject('p1', meta);
      expect(project).toEqual({ id: 'p1', name: 'Alpha', finishDate: '2026-06-30', owner: 'uid-1' });
    });

    it('omits finishDate when missing', () => {
      const meta: FirestoreProjectMeta = {
        name: 'Beta', owner: 'uid-1', members: { 'uid-1': 'owner' },
        schemaVersion: 1, createdAt: '', updatedAt: '',
      };
      const project = firestoreToProject('p2', meta);
      expect(project).toEqual({ id: 'p2', name: 'Beta', owner: 'uid-1' });
    });

    // v12.2: Security — owner field sanitization
    it('sanitizes owner with control characters', () => {
      const meta: FirestoreProjectMeta = {
        name: 'Test', owner: 'uid-1\x00<script>', members: { 'uid-1': 'owner' },
        schemaVersion: 1, createdAt: '', updatedAt: '',
      };
      const project = firestoreToProject('p3', meta);
      // sanitizeId strips non-alphanumeric/hyphen/underscore chars
      expect(project.owner).toBe('uid-1script');
    });

    it('truncates oversized owner to 50 chars', () => {
      const longOwner = 'a'.repeat(100);
      const meta: FirestoreProjectMeta = {
        name: 'Test', owner: longOwner, members: {},
        schemaVersion: 1, createdAt: '', updatedAt: '',
      };
      const project = firestoreToProject('p4', meta);
      expect(project.owner).toBe('a'.repeat(50));
    });
  });

  // --- firestoreReleasesToFlat ---

  describe('firestoreReleasesToFlat', () => {
    it('converts and sorts releases by order', () => {
      const entries: { id: string; data: FirestoreRelease }[] = [
        { id: 'r2', data: { name: 'B', startDate: '2026-02-01', earlyFinishDate: '2026-03-01', lateFinishDate: '2026-04-01', order: 1 } },
        { id: 'r1', data: { name: 'A', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01', order: 0 } },
      ];
      const releases = firestoreReleasesToFlat('p1', entries);
      expect(releases).toHaveLength(2);
      expect(releases[0].id).toBe('r1');
      expect(releases[0].name).toBe('A');
      expect(releases[0].projectId).toBe('p1');
      expect(releases[1].id).toBe('r2');
    });

    it('handles empty array', () => {
      expect(firestoreReleasesToFlat('p1', [])).toEqual([]);
    });
  });

  // --- userSettingsToAppData ---

  describe('userSettingsToAppData', () => {
    it('converts settings to AppData fields', () => {
      const settings: FirestoreUserSettings = {
        chartColors: { solidBar: '#000', hatchedBar: '#111', todayLine: '#222', finishDateLine: '#333', mostLikelyLine: '#444', completedBar: '#555' },
        showTodayLine: false,
        preparedBy: 'Test',
      };
      const result = userSettingsToAppData(settings);
      expect(result.chartColors?.solidBar).toBe('#000');
      expect(result.showTodayLine).toBe(false);
      expect(result.preparedBy).toBe('Test');
      // Should not have projects/releases
      expect(result.projects).toBeUndefined();
    });

    it('round-trips exportAttribution from Firestore', () => {
      const settings: FirestoreUserSettings = {
        exportAttribution: { name: 'Bob', identifier: 'team-7' },
      };
      const result = userSettingsToAppData(settings);
      expect(result.exportAttribution).toEqual({ name: 'Bob', identifier: 'team-7' });
    });

    it('round-trips empty-string preparedBy from Firestore', () => {
      const settings: FirestoreUserSettings = { preparedBy: '' };
      const result = userSettingsToAppData(settings);
      expect(result.preparedBy).toBe('');
    });
  });

  // --- firestoreSnapshotToFlat ---

  describe('firestoreSnapshotToFlat', () => {
    it('converts a Firestore snapshot to local Snapshot', () => {
      const fsSnapshot: FirestoreSnapshot = {
        name: 'Sprint 1',
        timestamp: '2026-02-15T10:00:00.000Z',
        releases: [
          { name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01', order: 0 },
        ],
        projectFinishDate: '2026-06-30',
        preparedBy: 'William',
      };
      const snap = firestoreSnapshotToFlat('snap1', 'p1', fsSnapshot);
      expect(snap.id).toBe('snap1');
      expect(snap.projectId).toBe('p1');
      expect(snap.name).toBe('Sprint 1');
      expect(snap.releases).toHaveLength(1);
      expect(snap.releases[0].projectId).toBe('p1');
      expect(snap.releases[0].name).toBe('R1');
      expect(snap.projectFinishDate).toBe('2026-06-30');
    });

    it('preserves empty-string preparedBy', () => {
      const fsSnapshot: FirestoreSnapshot = {
        name: 'Sprint 2',
        timestamp: '2026-02-15T10:00:00.000Z',
        releases: [],
        preparedBy: '',
      };
      const snap = firestoreSnapshotToFlat('snap2', 'p1', fsSnapshot);
      expect(snap.preparedBy).toBe('');
    });
  });

  // --- firestoreToFlatAppData (round-trip) ---

  describe('firestoreToFlatAppData', () => {
    it('reconstructs flat AppData from Firestore documents', () => {
      const projects = [
        { id: 'p1', meta: { name: 'Alpha', owner: 'uid-1', members: { 'uid-1': 'owner' as const }, schemaVersion: 1, createdAt: '', updatedAt: '', finishDate: '2026-06-30' } },
      ];
      const releasesMap = new Map([
        ['p1', [
          { id: 'r1', data: { name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01', order: 0 } as FirestoreRelease },
        ]],
      ]);
      const settings: FirestoreUserSettings = { showTodayLine: true, preparedBy: 'William' };

      const appData = firestoreToFlatAppData(projects, releasesMap, settings);
      expect(appData.projects).toHaveLength(1);
      expect(appData.projects[0].name).toBe('Alpha');
      expect(appData.releases).toHaveLength(1);
      expect(appData.releases[0].projectId).toBe('p1');
      expect(appData.showTodayLine).toBe(true);
      expect(appData.preparedBy).toBe('William');
    });

    it('handles null settings', () => {
      const appData = firestoreToFlatAppData([], new Map(), null);
      expect(appData.projects).toEqual([]);
      expect(appData.releases).toEqual([]);
      expect(appData.chartColors).toBeUndefined();
    });
  });

  // --- snapshotToFirestore ---

  describe('snapshotToFirestore', () => {
    it('converts local snapshot to Firestore format', () => {
      const snapshot: Snapshot = {
        id: 'snap1',
        projectId: 'p1',
        name: 'Sprint 1',
        timestamp: '2026-02-15T10:00:00.000Z',
        releases: [mockRelease],
        preparedBy: 'William',
      };
      const result = snapshotToFirestore(snapshot);
      expect(result.name).toBe('Sprint 1');
      expect(result.releases).toHaveLength(1);
      expect(result.releases[0].order).toBe(0);
      expect(result.preparedBy).toBe('William');
      // Should not have id or projectId
      expect((result as Record<string, unknown>).id).toBeUndefined();
      expect((result as Record<string, unknown>).projectId).toBeUndefined();
    });

    it('includes empty-string preparedBy', () => {
      const snapshot: Snapshot = {
        id: 'snap2', projectId: 'p1', name: 'Test',
        timestamp: '2026-02-15T10:00:00.000Z', releases: [],
        preparedBy: '',
      };
      const result = snapshotToFirestore(snapshot);
      expect(result.preparedBy).toBe('');
    });
  });

  // --- appendChangeLogEntry ---

  describe('appendChangeLogEntry', () => {
    const entry: ChangeLogEntry = { timestamp: '2026-02-20T12:00:00.000Z', uid: 'uid-1', action: 'update', target: 'release:r1' };

    it('appends to empty log', () => {
      const result = appendChangeLogEntry([], entry);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(entry);
    });

    it('appends to existing log', () => {
      const existing: ChangeLogEntry[] = [
        { timestamp: '2026-02-19T12:00:00.000Z', uid: 'uid-1', action: 'create', target: 'project:p1' },
      ];
      const result = appendChangeLogEntry(existing, entry);
      expect(result).toHaveLength(2);
    });

    it('trims oldest entries when exceeding cap', () => {
      const existing: ChangeLogEntry[] = Array.from({ length: MAX_CHANGELOG_ENTRIES }, (_, i) => ({
        timestamp: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
        uid: 'uid-1',
        action: 'update' as const,
        target: `release:r${i}`,
      }));
      const result = appendChangeLogEntry(existing, entry);
      expect(result).toHaveLength(MAX_CHANGELOG_ENTRIES);
      expect(result[result.length - 1]).toEqual(entry);
      // First entry should be the second original entry (oldest was trimmed)
      expect(result[0].target).toBe('release:r1');
    });
  });

  // --- Round-trip fidelity ---

  describe('round-trip', () => {
    it('settings → Firestore → settings preserves exportAttribution', () => {
      const data: AppData = {
        projects: [], releases: [],
        exportAttribution: { name: 'Alice', identifier: 'team-42' },
        preparedBy: 'Alice',
      };
      const settings = appDataToUserSettings(data);
      const roundTripped = userSettingsToAppData(settings);
      expect(roundTripped.exportAttribution).toEqual({ name: 'Alice', identifier: 'team-42' });
      expect(roundTripped.preparedBy).toBe('Alice');
    });

    it('project → Firestore → project is equivalent', () => {
      const meta = projectToFirestoreMeta(mockProject, 'uid-1');
      const roundTripped = firestoreToProject('p1', meta);
      expect(roundTripped.id).toBe(mockProject.id);
      expect(roundTripped.name).toBe(mockProject.name);
      expect(roundTripped.finishDate).toBe(mockProject.finishDate);
    });

    it('release → Firestore → release preserves all fields', () => {
      const fsRelease = releaseToFirestore(mockRelease, 0);
      const [roundTripped] = firestoreReleasesToFlat('p1', [{ id: 'r1', data: fsRelease }]);
      expect(roundTripped.id).toBe(mockRelease.id);
      expect(roundTripped.projectId).toBe(mockRelease.projectId);
      expect(roundTripped.name).toBe(mockRelease.name);
      expect(roundTripped.startDate).toBe(mockRelease.startDate);
      expect(roundTripped.earlyFinishDate).toBe(mockRelease.earlyFinishDate);
      expect(roundTripped.lateFinishDate).toBe(mockRelease.lateFinishDate);
      expect(roundTripped.hidden).toBe(mockRelease.hidden);
      expect(roundTripped.completed).toBe(mockRelease.completed);
      expect(roundTripped.mostLikelyFinishDate).toBe(mockRelease.mostLikelyFinishDate);
    });
  });
});
