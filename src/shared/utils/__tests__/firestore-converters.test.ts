// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

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
  status: 'complete' as const,
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

    it('includes order when provided', () => {
      const meta = projectToFirestoreMeta(mockProject, 'uid-1', undefined, 3);
      expect(meta.order).toBe(3);
    });

    it('omits order when not provided', () => {
      const meta = projectToFirestoreMeta(mockProject, 'uid-1');
      expect(meta.order).toBeUndefined();
    });

    // v16.1 — per-project legend label overrides
    it('includes legendLabels when non-empty', () => {
      const project: Project = { id: 'p-lbl', name: 'With Labels', legendLabels: { solidBar: 'Custom', inProgress: 'Active' } };
      const meta = projectToFirestoreMeta(project, 'uid-1');
      expect(meta.legendLabels).toEqual({ solidBar: 'Custom', inProgress: 'Active' });
    });

    it('omits legendLabels when undefined', () => {
      const project: Project = { id: 'p-no-lbl', name: 'No Labels' };
      const meta = projectToFirestoreMeta(project, 'uid-1');
      expect(meta.legendLabels).toBeUndefined();
    });

    it('omits legendLabels when empty object', () => {
      const project: Project = { id: 'p-empty', name: 'Empty Labels', legendLabels: {} };
      const meta = projectToFirestoreMeta(project, 'uid-1');
      expect(meta.legendLabels).toBeUndefined();
    });
  });

  // --- releaseToFirestore ---

  describe('releaseToFirestore', () => {
    it('converts a release with all optional fields', () => {
      const result = releaseToFirestore(mockRelease, 0);
      expect(result.name).toBe('Release 1');
      expect(result.order).toBe(0);
      expect(result.hidden).toBe(false);
      expect(result.status).toBe('complete');
      expect(result.mostLikelyFinishDate).toBe('2026-03-15');
      expect((result as unknown as Record<string, unknown>).id).toBeUndefined();
      expect((result as unknown as Record<string, unknown>).projectId).toBeUndefined();
    });

    it('omits undefined optional fields', () => {
      const minimal: Release = {
        id: 'r2', projectId: 'p1', name: 'Min',
        startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01',
      };
      const result = releaseToFirestore(minimal, 3);
      expect(result.order).toBe(3);
      expect(result.hidden).toBeUndefined();
      expect(result.status).toBeUndefined();
      expect(result.mostLikelyFinishDate).toBeUndefined();
    });
  });

  // --- appDataToUserSettings ---

  describe('appDataToUserSettings', () => {
    it('extracts settings from full AppData', () => {
      const data: AppData = {
        projects: [],
        releases: [],
        chartColors: { solidBar: '#000', hatchedBar: '#111', todayLine: '#222', finishDateLine: '#333', mostLikelyLine: '#444', completedBar: '#555', inProgressBar: '#f59e0b' },
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

    it('tags every settings write with schemaVersion: 1 (K2)', () => {
      // v0.27.0 (Pass 8, K2): forward-compat. Future schema bumps gain a
      // migration hook in userSettingsToAppData.
      const result = appDataToUserSettings({ projects: [], releases: [] });
      expect(result.schemaVersion).toBe(1);
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

    // v16.1 — per-project legend label overrides
    it('returns legendLabels when present in meta', () => {
      const meta: FirestoreProjectMeta = {
        name: 'WithLabels', owner: 'uid-1', members: { 'uid-1': 'owner' },
        schemaVersion: 1, createdAt: '', updatedAt: '',
        legendLabels: { solidBar: 'Build', inProgress: 'Active' },
      };
      const project = firestoreToProject('p-lbl', meta);
      expect(project.legendLabels).toEqual({ solidBar: 'Build', inProgress: 'Active' });
    });

    it('omits legendLabels when absent from meta', () => {
      const meta: FirestoreProjectMeta = {
        name: 'NoLabels', owner: 'uid-1', members: { 'uid-1': 'owner' },
        schemaVersion: 1, createdAt: '', updatedAt: '',
      };
      const project = firestoreToProject('p-no-lbl', meta);
      expect(project.legendLabels).toBeUndefined();
    });

    it('round-trips legendLabels through projectToFirestoreMeta → firestoreToProject', () => {
      const original: Project = {
        id: 'p-rt',
        name: 'Round Trip',
        legendLabels: {
          solidBar: 'Build',
          hatchedBar: 'Risk',
          finishDateLine: 'Due',
          mostLikelyLine: 'Target',
          inProgress: 'Active',
        },
      };
      const meta = projectToFirestoreMeta(original, 'uid-1');
      const restored = firestoreToProject(original.id, meta);
      expect(restored.legendLabels).toEqual(original.legendLabels);
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
        chartColors: { solidBar: '#000', hatchedBar: '#111', todayLine: '#222', finishDateLine: '#333', mostLikelyLine: '#444', completedBar: '#555', inProgressBar: '#f59e0b' },
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
      expect((result as unknown as Record<string, unknown>).id).toBeUndefined();
      expect((result as unknown as Record<string, unknown>).projectId).toBeUndefined();
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
      expect(roundTripped.status).toBe(mockRelease.status);
      expect(roundTripped.mostLikelyFinishDate).toBe(mockRelease.mostLikelyFinishDate);
    });
  });

  // --- Legacy completed → status migration (v16.0) ---

  describe('firestoreReleasesToFlat — completed migration', () => {
    it('migrates completed: true to status: complete', () => {
      const entries: { id: string; data: FirestoreRelease }[] = [
        {
          id: 'r1',
          data: {
            name: 'Legacy',
            startDate: '2026-01-01',
            earlyFinishDate: '2026-02-01',
            lateFinishDate: '2026-03-01',
            order: 0,
            completed: true,
          } as any,
        },
      ];
      const releases = firestoreReleasesToFlat('p1', entries);
      expect(releases[0].status).toBe('complete');
    });
  });

  describe('firestoreSnapshotToFlat — completed migration', () => {
    it('migrates completed: true to status: complete in snapshot releases', () => {
      const fsSnapshot: FirestoreSnapshot = {
        name: 'Legacy Snapshot',
        timestamp: '2026-02-15T10:00:00.000Z',
        releases: [
          {
            name: 'R1',
            startDate: '2026-01-01',
            earlyFinishDate: '2026-02-01',
            lateFinishDate: '2026-03-01',
            order: 0,
            completed: true,
          } as any,
        ],
      };
      const snap = firestoreSnapshotToFlat('snap1', 'p1', fsSnapshot);
      expect(snap.releases[0].status).toBe('complete');
    });
  });

  // --- Work-week fields (v15.0) ---

  describe('projectToFirestoreMeta — workDays', () => {
    it('includes workDays when set', () => {
      const project: Project = { id: 'p1', name: 'P', workDays: [1, 2, 3] };
      const meta = projectToFirestoreMeta(project, 'u1');
      expect(meta.workDays).toEqual([1, 2, 3]);
    });

    it('omits workDays when undefined', () => {
      const project: Project = { id: 'p1', name: 'P' };
      const meta = projectToFirestoreMeta(project, 'u1');
      expect(meta.workDays).toBeUndefined();
    });

    it('omits workDays when empty array', () => {
      const project: Project = { id: 'p1', name: 'P', workDays: [] };
      const meta = projectToFirestoreMeta(project, 'u1');
      expect(meta.workDays).toBeUndefined();
    });
  });

  describe('firestoreToProject — workDays', () => {
    it('sanitizes and includes workDays', () => {
      const meta: FirestoreProjectMeta = {
        name: 'P', owner: 'u1', members: { u1: 'owner' },
        schemaVersion: 1, createdAt: '', updatedAt: '',
        workDays: [0, 5, 6],
      };
      const project = firestoreToProject('p1', meta);
      expect(project.workDays).toEqual([0, 5, 6]);
    });

    it('drops invalid workDays from Firestore meta', () => {
      const meta: FirestoreProjectMeta = {
        name: 'P', owner: 'u1', members: { u1: 'owner' },
        schemaVersion: 1, createdAt: '', updatedAt: '',
        workDays: [99, -1] as number[],
      };
      const project = firestoreToProject('p1', meta);
      expect(project.workDays).toBeUndefined();
    });
  });

  describe('appDataToUserSettings — globalWorkDays', () => {
    it('includes globalWorkDays when set', () => {
      const data: AppData = { projects: [], releases: [], globalWorkDays: [1, 2, 3, 4, 5] };
      const settings = appDataToUserSettings(data);
      expect(settings.globalWorkDays).toEqual([1, 2, 3, 4, 5]);
    });

    it('omits globalWorkDays when undefined', () => {
      const data: AppData = { projects: [], releases: [] };
      const settings = appDataToUserSettings(data);
      expect(settings.globalWorkDays).toBeUndefined();
    });
  });

  describe('userSettingsToAppData — globalWorkDays', () => {
    it('sanitizes and includes globalWorkDays', () => {
      const settings = { globalWorkDays: [0, 6] } as FirestoreUserSettings;
      const partial = userSettingsToAppData(settings);
      expect(partial.globalWorkDays).toEqual([0, 6]);
    });

    it('drops invalid globalWorkDays', () => {
      const settings = { globalWorkDays: ['bad'] as unknown as number[] } as FirestoreUserSettings;
      const partial = userSettingsToAppData(settings);
      expect(partial.globalWorkDays).toBeUndefined();
    });
  });

  // --- status date override (v0.28.0) ---

  describe('todayDateOverride — user settings (v0.28.0)', () => {
    it('includes the override when set', () => {
      const data: AppData = { projects: [], releases: [], todayDateOverride: '2026-08-19' };
      expect(appDataToUserSettings(data).todayDateOverride).toBe('2026-08-19');
    });

    it('omits the override when unset or empty', () => {
      expect(appDataToUserSettings({ projects: [], releases: [] }).todayDateOverride).toBeUndefined();
      expect(appDataToUserSettings({ projects: [], releases: [], todayDateOverride: '' }).todayDateOverride).toBeUndefined();
    });

    it('reads the override back from Firestore', () => {
      const settings = { todayDateOverride: '2026-08-19' } as FirestoreUserSettings;
      expect(userSettingsToAppData(settings).todayDateOverride).toBe('2026-08-19');
    });

    it('drops an invalid override coming back from Firestore', () => {
      for (const bad of ['08/19/2026', '2026-02-30', '1999-01-01']) {
        const settings = { todayDateOverride: bad } as FirestoreUserSettings;
        expect(userSettingsToAppData(settings).todayDateOverride).toBeUndefined();
      }
    });

    it('round-trips through both converters', () => {
      const data: AppData = { projects: [], releases: [], todayDateOverride: '2026-12-01' };
      const back = userSettingsToAppData(appDataToUserSettings(data));
      expect(back.todayDateOverride).toBe('2026-12-01');
    });
  });

  describe('todayDateOverride — snapshots (v0.28.0)', () => {
    const baseSnapshot: Snapshot = {
      id: 'snap1', projectId: 'p1', name: 'Sprint 1',
      timestamp: '2026-02-15T10:00:00.000Z', releases: [],
    };

    it('freezes the override onto the Firestore snapshot', () => {
      const result = snapshotToFirestore({ ...baseSnapshot, todayDateOverride: '2026-02-15' });
      expect(result.todayDateOverride).toBe('2026-02-15');
    });

    it('omits the override for a snapshot saved without one', () => {
      expect(snapshotToFirestore(baseSnapshot).todayDateOverride).toBeUndefined();
    });

    it('reads a frozen override back', () => {
      const snap = firestoreSnapshotToFlat('snap1', 'p1', {
        name: 'Sprint 1', timestamp: '2026-02-15T10:00:00.000Z', releases: [],
        todayDateOverride: '2026-02-15',
      });
      expect(snap.todayDateOverride).toBe('2026-02-15');
    });

    it('drops an invalid frozen override', () => {
      const snap = firestoreSnapshotToFlat('snap1', 'p1', {
        name: 'Sprint 1', timestamp: '2026-02-15T10:00:00.000Z', releases: [],
        todayDateOverride: 'not-a-date',
      });
      expect(snap.todayDateOverride).toBeUndefined();
    });

    it('leaves a pre-v0.28.0 snapshot document without the field', () => {
      const snap = firestoreSnapshotToFlat('snap1', 'p1', {
        name: 'Legacy', timestamp: '2026-02-15T10:00:00.000Z', releases: [],
      });
      expect(snap.todayDateOverride).toBeUndefined();
    });
  });

  // --- Whole results ---
  //
  // Each test below compares a converter's whole result with toStrictEqual,
  // which, unlike toEqual, counts a key whose value is undefined. On the write
  // side that is the difference between a document that saves and one that
  // does not: src/lib/firebase.ts builds Firestore without
  // ignoreUndefinedProperties, so a set() holding an undefined field value is
  // rejected. A false flag, an empty preparedBy and order 0 are values, not
  // "not set", and must survive both ways. The colours, labels and display
  // settings below are valid, so the read-side sanitizers return them as they
  // are.

  const colours = (): NonNullable<AppData['chartColors']> => ({
    solidBar: '#112233', hatchedBar: '#445566', todayLine: '#778899', finishDateLine: '#aabbcc',
    mostLikelyLine: '#ddeeff', completedBar: '#123456', inProgressBar: '#654321',
  });
  const labels = (): NonNullable<AppData['legendLabels']> => ({
    solidBar: 'Build', hatchedBar: 'Risk', finishDateLine: 'Due', mostLikelyLine: 'Target', inProgress: 'Active',
  });
  const display = (): NonNullable<AppData['chartDisplaySettings']> => ({
    releaseNameFontSize: '18', dateLabelFontSize: '15', dateLabelColor: '#333',
    verticalLineWidth: '4', barHeight: '50', rowSpacing: '30',
  });

  describe('projectToFirestoreMeta — whole document', () => {
    it('writes no optional key, and a null finish date, for a project with nothing optional set', () => {
      expect(projectToFirestoreMeta({ id: 'p1', name: 'Alpha' }, 'uid-1')).toStrictEqual({
        name: 'Alpha',
        owner: 'uid-1',
        members: { 'uid-1': 'owner' },
        finishDate: null,
        schemaVersion: 1,
        _originRef: 'uid:uid-1',
        _changeLog: [],
        createdAt: '2026-02-20T12:00:00.000Z',
        updatedAt: '2026-02-20T12:00:00.000Z',
      });
    });

    it('writes order 0 for the first project in the list', () => {
      expect(projectToFirestoreMeta({ id: 'p1', name: 'Alpha' }, 'uid-1', undefined, 0)).toStrictEqual({
        name: 'Alpha',
        owner: 'uid-1',
        members: { 'uid-1': 'owner' },
        finishDate: null,
        order: 0,
        schemaVersion: 1,
        _originRef: 'uid:uid-1',
        _changeLog: [],
        createdAt: '2026-02-20T12:00:00.000Z',
        updatedAt: '2026-02-20T12:00:00.000Z',
      });
    });

    it('keeps the stored origin, owner, members, change log and creation time when another member saves the project', () => {
      const stored: Partial<FirestoreProjectMeta> = {
        owner: 'uid-owner',
        members: { 'uid-owner': 'owner', 'uid-editor': 'editor' },
        _originRef: 'uid:uid-owner',
        _changeLog: [{ timestamp: '2026-01-01T00:00:00.000Z', uid: 'uid-owner', action: 'create', target: 'project:p1' }],
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      const project: Project = {
        id: 'p1', name: 'Alpha', finishDate: '2026-06-30', workDays: [1, 2, 3, 4, 5, 6], legendLabels: { solidBar: 'Build' },
      };
      expect(projectToFirestoreMeta(project, 'uid-editor', stored, 2)).toStrictEqual({
        name: 'Alpha',
        owner: 'uid-owner',
        members: { 'uid-owner': 'owner', 'uid-editor': 'editor' },
        finishDate: '2026-06-30',
        order: 2,
        workDays: [1, 2, 3, 4, 5, 6],
        legendLabels: { solidBar: 'Build' },
        schemaVersion: 1,
        _originRef: 'uid:uid-owner',
        _changeLog: [{ timestamp: '2026-01-01T00:00:00.000Z', uid: 'uid-owner', action: 'create', target: 'project:p1' }],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-02-20T12:00:00.000Z',
      });
    });
  });

  describe('releaseToFirestore — whole document', () => {
    const plain: Release = {
      id: 'r1', projectId: 'p1', name: 'R1',
      startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01',
    };

    it('writes no optional key for a release with nothing optional set', () => {
      expect(releaseToFirestore(plain, 0)).toStrictEqual({
        name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01', order: 0,
      });
    });

    it('writes hidden: false for a release that is shown on the chart', () => {
      expect(releaseToFirestore({ ...plain, hidden: false }, 0)).toStrictEqual({
        name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01', hidden: false, order: 0,
      });
    });
  });

  describe('appDataToUserSettings — whole document', () => {
    it('writes every setting it is given, with the schema version', () => {
      const data: AppData = {
        projects: [], releases: [],
        chartColors: colours(),
        activePreset: 'Ocean',
        legendLabels: labels(),
        showTodayLine: true,
        todayDateOverride: '2026-08-19',
        showFinishDateLine: true,
        showMostLikelyLine: true,
        showMonths: true,
        chartDisplaySettings: display(),
        preparedBy: 'Ann',
        showPreparedBy: true,
        exportAttribution: { name: 'Ann', identifier: 'T1' },
        globalWorkDays: [1, 2, 3, 4, 5],
      };
      expect(appDataToUserSettings(data)).toStrictEqual({
        schemaVersion: 1,
        chartColors: colours(),
        activePreset: 'Ocean',
        legendLabels: labels(),
        showTodayLine: true,
        todayDateOverride: '2026-08-19',
        showFinishDateLine: true,
        showMostLikelyLine: true,
        showMonths: true,
        chartDisplaySettings: display(),
        preparedBy: 'Ann',
        showPreparedBy: true,
        exportAttribution: { name: 'Ann', identifier: 'T1' },
        globalWorkDays: [1, 2, 3, 4, 5],
      });
    });

    it('writes a setting turned off as false, and a cleared preparedBy as an empty string', () => {
      const data: AppData = {
        projects: [], releases: [],
        showTodayLine: false, showFinishDateLine: false, showMostLikelyLine: false, showMonths: false,
        preparedBy: '', showPreparedBy: false,
      };
      expect(appDataToUserSettings(data)).toStrictEqual({
        schemaVersion: 1,
        showTodayLine: false, showFinishDateLine: false, showMostLikelyLine: false, showMonths: false,
        preparedBy: '', showPreparedBy: false,
      });
    });

    it('writes only the schema version when no setting is set', () => {
      expect(appDataToUserSettings({ projects: [], releases: [] })).toStrictEqual({ schemaVersion: 1 });
    });
  });

  describe('snapshotToFirestore — whole document', () => {
    it('writes every field of a snapshot, and its releases with their places as their order', () => {
      const snapshot: Snapshot = {
        id: 'snap1', projectId: 'p1', name: 'Sprint 3', timestamp: '2026-02-15T10:00:00.000Z',
        releases: [
          {
            id: 'r1', projectId: 'p1', name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01',
            hidden: true, status: 'in-progress', mostLikelyFinishDate: '2026-02-15',
          },
          { id: 'r2', projectId: 'p1', name: 'R2', startDate: '2026-03-01', earlyFinishDate: '2026-04-01', lateFinishDate: '2026-05-01' },
        ],
        projectFinishDate: '2026-06-30',
        chartColors: colours(),
        legendLabels: labels(),
        preparedBy: 'Ann',
        todayDateOverride: '2026-02-15',
      };
      expect(snapshotToFirestore(snapshot)).toStrictEqual({
        name: 'Sprint 3',
        timestamp: '2026-02-15T10:00:00.000Z',
        releases: [
          {
            name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01',
            hidden: true, status: 'in-progress', mostLikelyFinishDate: '2026-02-15', order: 0,
          },
          { name: 'R2', startDate: '2026-03-01', earlyFinishDate: '2026-04-01', lateFinishDate: '2026-05-01', order: 1 },
        ],
        projectFinishDate: '2026-06-30',
        chartColors: colours(),
        legendLabels: labels(),
        preparedBy: 'Ann',
        todayDateOverride: '2026-02-15',
      });
    });

    it('writes a cleared preparedBy as an empty string, and a shown release as hidden: false', () => {
      const snapshot: Snapshot = {
        id: 'snap2', projectId: 'p1', name: 'Sprint 4', timestamp: '2026-02-15T10:00:00.000Z',
        releases: [{
          id: 'r1', projectId: 'p1', name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01', hidden: false,
        }],
        preparedBy: '',
      };
      expect(snapshotToFirestore(snapshot)).toStrictEqual({
        name: 'Sprint 4',
        timestamp: '2026-02-15T10:00:00.000Z',
        releases: [{ name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01', hidden: false, order: 0 }],
        preparedBy: '',
      });
    });

    it('writes no optional key for a snapshot with nothing optional set', () => {
      const snapshot: Snapshot = {
        id: 'snap3', projectId: 'p1', name: 'Sprint 5', timestamp: '2026-02-15T10:00:00.000Z',
        releases: [{ id: 'r1', projectId: 'p1', name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01' }],
      };
      expect(snapshotToFirestore(snapshot)).toStrictEqual({
        name: 'Sprint 5',
        timestamp: '2026-02-15T10:00:00.000Z',
        releases: [{ name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01', order: 0 }],
      });
    });
  });

  describe('firestoreToProject — whole result', () => {
    it('reads back the project fields of a stored project, and none of its bookkeeping', () => {
      const meta: FirestoreProjectMeta = {
        name: 'Alpha', owner: 'uid-1', members: { 'uid-1': 'owner', 'uid-2': 'viewer' },
        finishDate: '2026-06-30', order: 3, workDays: [1, 2, 3, 4, 5, 6], legendLabels: { solidBar: 'Build', inProgress: 'Active' },
        schemaVersion: 1, _originRef: 'uid:uid-1', _changeLog: [],
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
      };
      expect(firestoreToProject('p1', meta)).toStrictEqual({
        id: 'p1',
        name: 'Alpha',
        finishDate: '2026-06-30',
        workDays: [1, 2, 3, 4, 5, 6],
        legendLabels: { solidBar: 'Build', inProgress: 'Active' },
        owner: 'uid-1',
      });
    });

    it('cleans a stored project name: control characters and surrounding spaces are removed', () => {
      const meta: FirestoreProjectMeta = {
        name: ' \tAlpha\u0007 Launch \n', owner: 'uid-1', members: { 'uid-1': 'owner' },
        schemaVersion: 1, createdAt: '', updatedAt: '',
      };
      expect(firestoreToProject('p1', meta)).toStrictEqual({ id: 'p1', name: 'Alpha Launch', owner: 'uid-1' });
    });

    it('reads no optional key from a stored project with nothing optional set', () => {
      const meta: FirestoreProjectMeta = {
        name: 'Alpha', owner: 'uid-1', members: { 'uid-1': 'owner' }, schemaVersion: 1, createdAt: '', updatedAt: '',
      };
      expect(firestoreToProject('p1', meta)).toStrictEqual({ id: 'p1', name: 'Alpha', owner: 'uid-1' });
    });
  });

  describe('firestoreReleasesToFlat — whole result', () => {
    const entry = (data: FirestoreRelease) => [{ id: 'r1', data }];

    it('reads back every field of a stored release, and not its order', () => {
      const releases = firestoreReleasesToFlat('p1', entry({
        name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01',
        hidden: true, status: 'in-progress', mostLikelyFinishDate: '2026-02-15', order: 0,
      }));
      expect(releases).toStrictEqual([{
        id: 'r1', projectId: 'p1', name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01',
        hidden: true, status: 'in-progress', mostLikelyFinishDate: '2026-02-15',
      }]);
    });

    it('reads a stored hidden: false back as false', () => {
      const releases = firestoreReleasesToFlat('p1', entry({
        name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01', hidden: false, order: 0,
      }));
      expect(releases).toStrictEqual([{
        id: 'r1', projectId: 'p1', name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01', hidden: false,
      }]);
    });

    it('cleans a stored release name: control characters and surrounding spaces are removed', () => {
      const releases = firestoreReleasesToFlat('p1', entry({
        name: '\n Release\u0007 One\t ', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01', order: 0,
      }));
      expect(releases).toStrictEqual([{
        id: 'r1', projectId: 'p1', name: 'Release One', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01',
      }]);
    });

    it('reads no optional key from a stored release with nothing optional set', () => {
      const releases = firestoreReleasesToFlat('p1', entry({
        name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01', order: 0,
      }));
      expect(releases).toStrictEqual([{
        id: 'r1', projectId: 'p1', name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01',
      }]);
    });
  });

  describe('userSettingsToAppData — whole result', () => {
    it('reads back every stored setting, and not the schema version', () => {
      const settings: FirestoreUserSettings = {
        schemaVersion: 1,
        chartColors: colours(),
        activePreset: 'Ocean',
        legendLabels: labels(),
        showTodayLine: true,
        todayDateOverride: '2026-08-19',
        showFinishDateLine: true,
        showMostLikelyLine: true,
        showMonths: true,
        chartDisplaySettings: display(),
        preparedBy: 'Ann',
        showPreparedBy: true,
        exportAttribution: { name: 'Ann', identifier: 'T1' },
        globalWorkDays: [1, 2, 3, 4, 5],
      };
      expect(userSettingsToAppData(settings)).toStrictEqual({
        chartColors: colours(),
        activePreset: 'Ocean',
        legendLabels: labels(),
        showTodayLine: true,
        todayDateOverride: '2026-08-19',
        showFinishDateLine: true,
        showMostLikelyLine: true,
        showMonths: true,
        chartDisplaySettings: display(),
        preparedBy: 'Ann',
        showPreparedBy: true,
        exportAttribution: { name: 'Ann', identifier: 'T1' },
        globalWorkDays: [1, 2, 3, 4, 5],
      });
    });

    it('reads a setting stored as false back as false, and a stored empty preparedBy as an empty string', () => {
      const settings: FirestoreUserSettings = {
        schemaVersion: 1,
        showTodayLine: false, showFinishDateLine: false, showMostLikelyLine: false, showMonths: false,
        preparedBy: '', showPreparedBy: false,
      };
      expect(userSettingsToAppData(settings)).toStrictEqual({
        showTodayLine: false, showFinishDateLine: false, showMostLikelyLine: false, showMonths: false,
        preparedBy: '', showPreparedBy: false,
      });
    });

    it('reads no setting from a settings document that holds only its schema version', () => {
      expect(userSettingsToAppData({ schemaVersion: 1 })).toStrictEqual({});
    });
  });

  describe('firestoreSnapshotToFlat — whole result', () => {
    it('reads back every field of a stored snapshot, each release given an id from the snapshot id and its place', () => {
      const stored: FirestoreSnapshot = {
        name: 'Sprint 3',
        timestamp: '2026-02-15T10:00:00.000Z',
        releases: [
          {
            name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01',
            hidden: true, status: 'in-progress', mostLikelyFinishDate: '2026-02-15', order: 0,
          },
          { name: 'R2', startDate: '2026-03-01', earlyFinishDate: '2026-04-01', lateFinishDate: '2026-05-01', order: 1 },
        ],
        projectFinishDate: '2026-06-30',
        chartColors: colours(),
        legendLabels: labels(),
        preparedBy: 'Ann',
        todayDateOverride: '2026-02-15',
      };
      expect(firestoreSnapshotToFlat('snap1', 'p1', stored)).toStrictEqual({
        id: 'snap1',
        projectId: 'p1',
        name: 'Sprint 3',
        timestamp: '2026-02-15T10:00:00.000Z',
        releases: [
          {
            id: 'snap1-r0', projectId: 'p1', name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01',
            hidden: true, status: 'in-progress', mostLikelyFinishDate: '2026-02-15',
          },
          { id: 'snap1-r1', projectId: 'p1', name: 'R2', startDate: '2026-03-01', earlyFinishDate: '2026-04-01', lateFinishDate: '2026-05-01' },
        ],
        projectFinishDate: '2026-06-30',
        chartColors: colours(),
        legendLabels: labels(),
        preparedBy: 'Ann',
        todayDateOverride: '2026-02-15',
      });
    });

    it('reads a stored empty preparedBy back as an empty string, and a stored hidden: false as false', () => {
      const stored: FirestoreSnapshot = {
        name: 'Sprint 4',
        timestamp: '2026-02-15T10:00:00.000Z',
        releases: [{ name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01', hidden: false, order: 0 }],
        preparedBy: '',
      };
      expect(firestoreSnapshotToFlat('snap2', 'p1', stored)).toStrictEqual({
        id: 'snap2',
        projectId: 'p1',
        name: 'Sprint 4',
        timestamp: '2026-02-15T10:00:00.000Z',
        releases: [{
          id: 'snap2-r0', projectId: 'p1', name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01', hidden: false,
        }],
        preparedBy: '',
      });
    });

    it('puts releases stored out of order back in their order', () => {
      const release = (name: string, startDate: string, order: number): FirestoreRelease => ({
        name, startDate, earlyFinishDate: '2026-06-01', lateFinishDate: '2026-07-01', order,
      });
      const stored: FirestoreSnapshot = {
        name: 'Sprint 5',
        timestamp: '2026-02-15T10:00:00.000Z',
        releases: [release('Second', '2026-02-01', 1), release('First', '2026-01-01', 0), release('Third', '2026-03-01', 2)],
      };
      const snap = firestoreSnapshotToFlat('snap3', 'p1', stored);
      expect(snap.releases.map(r => [r.id, r.name, r.startDate])).toStrictEqual([
        ['snap3-r0', 'First', '2026-01-01'],
        ['snap3-r1', 'Second', '2026-02-01'],
        ['snap3-r2', 'Third', '2026-03-01'],
      ]);
    });

    it('cleans the stored names of a snapshot and of its releases', () => {
      const stored: FirestoreSnapshot = {
        name: '\tSprint\u0007 6 \n',
        timestamp: '2026-02-15T10:00:00.000Z',
        releases: [{ name: ' Release\u0007 One\n', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01', order: 0 }],
      };
      expect(firestoreSnapshotToFlat('snap4', 'p1', stored)).toStrictEqual({
        id: 'snap4',
        projectId: 'p1',
        name: 'Sprint 6',
        timestamp: '2026-02-15T10:00:00.000Z',
        releases: [{
          id: 'snap4-r0', projectId: 'p1', name: 'Release One', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01',
        }],
      });
    });

    it('reads no optional key from a stored snapshot with nothing optional set', () => {
      const stored: FirestoreSnapshot = {
        name: 'Sprint 7',
        timestamp: '2026-02-15T10:00:00.000Z',
        releases: [{ name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01', order: 0 }],
      };
      expect(firestoreSnapshotToFlat('snap5', 'p1', stored)).toStrictEqual({
        id: 'snap5',
        projectId: 'p1',
        name: 'Sprint 7',
        timestamp: '2026-02-15T10:00:00.000Z',
        releases: [{
          id: 'snap5-r0', projectId: 'p1', name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01',
        }],
      });
    });
  });

  describe('firestoreToFlatAppData — whole result', () => {
    const meta = (name: string): FirestoreProjectMeta => ({
      name, owner: 'uid-1', members: { 'uid-1': 'owner' }, schemaVersion: 1, createdAt: '', updatedAt: '',
    });
    const stored = (name: string): FirestoreRelease => ({
      name, startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01', order: 0,
    });

    it('reads a project and a release with nothing optional set, and no settings document, with no optional key', () => {
      const appData = firestoreToFlatAppData(
        [{ id: 'p1', meta: meta('Alpha') }],
        new Map([['p1', [{ id: 'r1', data: stored('R1') }]]]),
        null,
      );
      expect(appData).toStrictEqual({
        projects: [{ id: 'p1', name: 'Alpha', owner: 'uid-1' }],
        releases: [{ id: 'r1', projectId: 'p1', name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01' }],
      });
    });

    it('reads a project that has no entry in the releases map as a project with no releases', () => {
      // Beta has no entry in the map at all.
      const releasesMap = new Map([['p1', [{ id: 'r1', data: stored('R1') }]]]);
      let appData: AppData | undefined;
      expect(() => {
        appData = firestoreToFlatAppData([{ id: 'p1', meta: meta('Alpha') }, { id: 'p2', meta: meta('Beta') }], releasesMap, null);
      }).not.toThrow();
      expect(appData).toStrictEqual({
        projects: [{ id: 'p1', name: 'Alpha', owner: 'uid-1' }, { id: 'p2', name: 'Beta', owner: 'uid-1' }],
        releases: [{ id: 'r1', projectId: 'p1', name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01' }],
      });
    });
  });
});
