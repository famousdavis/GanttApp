// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// A recording stand-in for the three firebase/firestore calls the executor
// makes. Each writeBatch() gets its own number, so tests can tell the
// new-project batch (committed first) from the batch that carries everything
// else. `stored` holds the project documents getDoc() finds.
const fs = vi.hoisted(() => {
  const log: { batch: number; op: 'set' | 'delete' | 'commit'; path?: string; data?: Record<string, unknown> }[] = [];
  const stored = new Map<string, Record<string, unknown>>();
  let batches = 0;
  return {
    log,
    stored,
    getDoc: vi.fn(),
    nextBatch: () => ++batches,
    reset: () => { log.length = 0; stored.clear(); batches = 0; },
  };
});

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, path: string) => ({ path }),
  getDoc: (ref: { path: string }) => fs.getDoc(ref),
  writeBatch: () => {
    const batch = fs.nextBatch();
    return {
      set: (ref: { path: string }, data: Record<string, unknown>) => { fs.log.push({ batch, op: 'set', path: ref.path, data }); },
      delete: (ref: { path: string }) => { fs.log.push({ batch, op: 'delete', path: ref.path }); },
      commit: async () => { fs.log.push({ batch, op: 'commit' }); },
    };
  },
}));

import { executeFirestoreSave, releaseChanged, settingsChanged } from '../firestore-save-executor';
import type { Release, Project } from '../../types/models';
import type { AppData } from '../../types/app';
import type { Firestore } from 'firebase/firestore';

describe('firestore-save-executor', () => {
  describe('releaseChanged', () => {
    const base: Release = {
      id: 'r1', projectId: 'p1', name: 'R1',
      startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01',
    };

    it('returns true when prev is undefined (new release)', () => {
      expect(releaseChanged(undefined, base)).toBe(true);
    });

    it('returns false when releases are identical', () => {
      expect(releaseChanged({ ...base }, { ...base })).toBe(false);
    });

    it('detects name change', () => {
      expect(releaseChanged(base, { ...base, name: 'R2' })).toBe(true);
    });

    it('detects startDate change', () => {
      expect(releaseChanged(base, { ...base, startDate: '2026-01-15' })).toBe(true);
    });

    it('detects earlyFinishDate change', () => {
      expect(releaseChanged(base, { ...base, earlyFinishDate: '2026-02-15' })).toBe(true);
    });

    it('detects lateFinishDate change', () => {
      expect(releaseChanged(base, { ...base, lateFinishDate: '2026-03-15' })).toBe(true);
    });

    it('detects hidden change', () => {
      expect(releaseChanged(base, { ...base, hidden: true })).toBe(true);
    });

    it('detects status change', () => {
      expect(releaseChanged(base, { ...base, status: 'in-progress' as const })).toBe(true);
    });

    it('detects status change from undefined to in-progress', () => {
      const prev = { ...base };
      const curr = { ...base, status: 'in-progress' as const };
      expect(releaseChanged(prev, curr)).toBe(true);
    });

    it('does not detect change when status is same', () => {
      const prev = { ...base, status: 'complete' as const };
      const curr = { ...base, status: 'complete' as const };
      expect(releaseChanged(prev, curr)).toBe(false);
    });

    it('detects mostLikelyFinishDate change', () => {
      expect(releaseChanged(base, { ...base, mostLikelyFinishDate: '2026-02-15' })).toBe(true);
    });
  });

  describe('releaseChanged — order detection note', () => {
    // releaseChanged only compares content fields. Order detection is handled
    // separately in executeFirestoreSave by comparing array indices. This test
    // documents that releaseChanged intentionally does NOT detect order changes
    // (the order field is not part of the Release model — it's computed from
    // array position during save).
    const r1: Release = {
      id: 'r1', projectId: 'p1', name: 'R1',
      startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01',
    };
    const r2: Release = {
      id: 'r2', projectId: 'p1', name: 'R2',
      startDate: '2026-04-01', earlyFinishDate: '2026-05-01', lateFinishDate: '2026-06-01',
    };

    it('does not detect order change (order is handled by index comparison)', () => {
      // Same release content, different array positions — releaseChanged returns false
      // because order detection is done externally by comparing prevIndex !== index
      expect(releaseChanged(r1, r1)).toBe(false);
      expect(releaseChanged(r2, r2)).toBe(false);
    });
  });

  describe('settingsChanged', () => {
    const base: AppData = {
      projects: [], releases: [],
      chartColors: { solidBar: '#000', hatchedBar: '#111', todayLine: '#222', finishDateLine: '#333', mostLikelyLine: '#444', completedBar: '#555', inProgressBar: '#f59e0b' },
      activePreset: 'Default',
      showTodayLine: true,
      showFinishDateLine: false,
      showMostLikelyLine: true,
      preparedBy: 'Alice',
      showPreparedBy: true,
    };

    it('returns true when prev is null (first save)', () => {
      expect(settingsChanged(null, base)).toBe(true);
    });

    it('returns false when settings are identical', () => {
      expect(settingsChanged({ ...base }, { ...base })).toBe(false);
    });

    it('detects chartColors change', () => {
      const changed = { ...base, chartColors: { ...base.chartColors!, solidBar: '#fff' } };
      expect(settingsChanged(base, changed)).toBe(true);
    });

    it('detects activePreset change', () => {
      expect(settingsChanged(base, { ...base, activePreset: 'Ocean' })).toBe(true);
    });

    it('detects showTodayLine change', () => {
      expect(settingsChanged(base, { ...base, showTodayLine: false })).toBe(true);
    });

    it('detects preparedBy change', () => {
      expect(settingsChanged(base, { ...base, preparedBy: 'Bob' })).toBe(true);
    });

    // v0.28.0 regression guard. Without the todayDateOverride comparison in
    // settingsChanged, setting a status date is a no-op for cloud users: it
    // saves locally, never writes to Firestore, and is gone on reload. Same
    // silent-write-skip class as v12.5 reorder / v15.0 workDays / v16.1
    // legendLabels. Do NOT delete these three tests.
    it('detects todayDateOverride being set', () => {
      expect(settingsChanged(base, { ...base, todayDateOverride: '2026-08-19' })).toBe(true);
    });

    it('detects todayDateOverride being cleared', () => {
      const withOverride = { ...base, todayDateOverride: '2026-08-19' };
      expect(settingsChanged(withOverride, { ...base, todayDateOverride: undefined })).toBe(true);
    });

    it('detects todayDateOverride being changed to a different date', () => {
      const withOverride = { ...base, todayDateOverride: '2026-08-19' };
      expect(settingsChanged(withOverride, { ...withOverride, todayDateOverride: '2026-08-26' })).toBe(true);
    });

    it('returns false when todayDateOverride is identical', () => {
      const withOverride = { ...base, todayDateOverride: '2026-08-19' };
      expect(settingsChanged(withOverride, { ...withOverride })).toBe(false);
    });

    it('detects exportAttribution change', () => {
      expect(settingsChanged(base, {
        ...base, exportAttribution: { name: 'Alice', identifier: 'team-1' },
      })).toBe(true);
    });

    it('returns false when exportAttribution is identical', () => {
      const withAttr = { ...base, exportAttribution: { name: 'A', identifier: 'B' } };
      expect(settingsChanged(withAttr, { ...withAttr })).toBe(false);
    });

    it('detects globalWorkDays change', () => {
      expect(settingsChanged(base, {
        ...base, globalWorkDays: [1, 2, 3, 4, 5],
      })).toBe(true);
    });

    it('does not flag identical globalWorkDays as changed', () => {
      const withDays = { ...base, globalWorkDays: [1, 2, 3, 4, 5] };
      expect(settingsChanged(withDays, { ...withDays, globalWorkDays: [1, 2, 3, 4, 5] })).toBe(false);
    });
  });

  // executeFirestoreSave, run for real against a recording Firestore stand-in.
  // Until these existed, the write/no-write decisions below were tested only
  // through copies of the executor's comparisons, so deleting a comparison from
  // the executor passed every test. A missing comparison throws nothing: the
  // edit saves locally, never reaches Firestore, and is gone on the next load
  // (v12.5 reorder, v15.0 workDays and v16.1 legendLabels were all this bug).
  describe('executeFirestoreSave', () => {
    const db = {} as Firestore;
    const UID = 'editor-uid';
    const OWNER = 'owner-uid';

    const release = (id: string, projectId = 'p1', name = id.toUpperCase()): Release => ({
      id, projectId, name,
      startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01',
    });
    // The stored project document: owned by someone else, shared with UID as an editor.
    const storedMeta = (id: string, name: string) => ({
      name, owner: OWNER, members: { [OWNER]: 'owner', [UID]: 'editor' },
      schemaVersion: 1, _originRef: `uid:${OWNER}`, createdAt: 'created-at', updatedAt: 'updated-at',
      _changeLog: [{ timestamp: 't0', uid: OWNER, action: 'create', target: `project:${id}` }],
    });
    const state = (projects: Project[], releases: Release[] = [], extra: Partial<AppData> = {}): AppData =>
      ({ projects, releases, ...extra });
    const alpha: Project = { id: 'p1', name: 'Alpha' };

    const sets = (path: string) => fs.log.filter(e => e.op === 'set' && e.path === path);
    const releaseSets = () => fs.log.filter(e => e.op === 'set' && e.path!.includes('/releases/'));
    const deletes = () => fs.log.filter(e => e.op === 'delete').map(e => e.path);
    const commits = () => fs.log.filter(e => e.op === 'commit').map(e => e.batch);

    beforeEach(() => {
      fs.reset();
      fs.getDoc.mockReset();
      fs.getDoc.mockImplementation(async (ref: { path: string }) => ({
        exists: () => fs.stored.has(ref.path),
        data: () => fs.stored.get(ref.path),
      }));
      fs.stored.set('ganttapp_projects/p1', storedMeta('p1', 'Alpha'));
      fs.stored.set('ganttapp_projects/p2', storedMeta('p2', 'Beta'));
    });

    it('commits a new project, with a create entry, in its own batch before everything else', async () => {
      const next = state([alpha, { id: 'p9', name: 'New' }], [release('r9', 'p9')]);
      await executeFirestoreSave(db, UID, next, state([alpha]));

      const created = sets('ganttapp_projects/p9');
      expect(created).toHaveLength(1);
      expect(created[0].batch).toBe(1);
      expect(created[0].data).toMatchObject({ name: 'New', owner: UID, members: { [UID]: 'owner' }, order: 1 });
      expect(created[0].data!._changeLog).toEqual([
        expect.objectContaining({ uid: UID, action: 'create', target: 'project:p9' }),
      ]);
      // The release rides in batch 2, which commits only after batch 1 has:
      // subcollection rules read the parent project document.
      expect(sets('ganttapp_projects/p9/releases/r9').map(e => e.batch)).toEqual([2]);
      expect(commits()).toEqual([1, 2]);
    });

    it.each([
      ['name', alpha, { ...alpha, name: 'Renamed' }, { name: 'Renamed' }],
      ['finishDate', alpha, { ...alpha, finishDate: '2026-06-30' }, { finishDate: '2026-06-30' }],
      ['workDays', { ...alpha, workDays: [1, 2, 3, 4, 5] }, { ...alpha, workDays: [1, 2, 3, 4, 5, 6] }, { workDays: [1, 2, 3, 4, 5, 6] }],
    ])('rewrites an existing project whose %s changed', async (_field, before, after, written) => {
      await executeFirestoreSave(db, UID, state([after]), state([before]));
      const writes = sets('ganttapp_projects/p1');
      expect(writes).toHaveLength(1);
      expect(writes[0].data).toMatchObject(written);
    });

    // Per-project legend labels. Six shapes of edit, one of them no edit.
    it.each([
      ['a label changes', true, { solidBar: 'A' }, { solidBar: 'B' }],
      ['nothing changes', false, { solidBar: 'A', hatchedBar: 'B' }, { solidBar: 'A', hatchedBar: 'B' }],
      ['labels are added', true, undefined, { solidBar: 'X' }],
      ['labels are cleared', true, { solidBar: 'X' }, undefined],
      ['a key is added', true, { solidBar: 'A' }, { solidBar: 'A', hatchedBar: 'B' }],
      ['a key is removed', true, { solidBar: 'A', hatchedBar: 'B' }, { solidBar: 'A' }],
    ])('legendLabels — %s: project rewritten = %s', async (_edit, rewritten, before, after) => {
      const withLabels = (labels: Project['legendLabels']): Project => ({ ...alpha, ...(labels && { legendLabels: labels }) });
      await executeFirestoreSave(db, UID, state([withLabels(after)]), state([withLabels(before)]));

      expect(commits()).toEqual([2]);
      const writes = sets('ganttapp_projects/p1');
      expect(writes).toHaveLength(rewritten ? 1 : 0);
      if (rewritten) expect(writes[0].data!.legendLabels).toEqual(after);
    });

    it('rewrites both projects, each with its new order, when two projects swap places', async () => {
      const beta: Project = { id: 'p2', name: 'Beta' };
      await executeFirestoreSave(db, UID, state([beta, alpha]), state([alpha, beta]));
      expect(sets('ganttapp_projects/p2').map(e => e.data!.order)).toEqual([0]);
      expect(sets('ganttapp_projects/p1').map(e => e.data!.order)).toEqual([1]);
    });

    it('keeps the stored owner and members, and appends an update entry, when it rewrites a project', async () => {
      await executeFirestoreSave(db, UID, state([{ ...alpha, name: 'Renamed' }]), state([alpha]));
      const writes = sets('ganttapp_projects/p1');
      expect(writes).toHaveLength(1);
      expect(writes[0].data).toMatchObject({
        owner: OWNER,
        members: { [OWNER]: 'owner', [UID]: 'editor' },
        createdAt: 'created-at',
      });
      expect(writes[0].data!._changeLog).toEqual([
        { timestamp: 't0', uid: OWNER, action: 'create', target: 'project:p1' },
        expect.objectContaining({ uid: UID, action: 'update', target: 'project:p1' }),
      ]);
    });

    it('writes nothing for a changed project whose document is gone', async () => {
      fs.stored.delete('ganttapp_projects/p1');
      await executeFirestoreSave(db, UID, state([{ ...alpha, name: 'Renamed' }]), state([alpha]));
      // It looked for the document, found none, and wrote nothing.
      expect(fs.getDoc).toHaveBeenCalledWith({ path: 'ganttapp_projects/p1' });
      expect(sets('ganttapp_projects/p1')).toEqual([]);
    });

    it('neither reads nor rewrites an unchanged project that stayed in place', async () => {
      const unchanged = state([alpha]);
      await executeFirestoreSave(db, UID, structuredClone(unchanged), unchanged);
      expect(commits()).toEqual([2]);
      expect(fs.getDoc).not.toHaveBeenCalled();
      expect(sets('ganttapp_projects/p1')).toEqual([]);
    });

    it('writes a new release with its position as its order', async () => {
      await executeFirestoreSave(db, UID, state([alpha], [release('r1'), release('r2')]), state([alpha], [release('r1')]));
      expect(releaseSets().map(e => [e.path, e.data!.order])).toEqual([['ganttapp_projects/p1/releases/r2', 1]]);
    });

    it('rewrites a release whose content changed in place', async () => {
      await executeFirestoreSave(db, UID, state([alpha], [release('r1', 'p1', 'Changed')]), state([alpha], [release('r1')]));
      expect(releaseSets().map(e => [e.path, e.data!.name, e.data!.order])).toEqual([
        ['ganttapp_projects/p1/releases/r1', 'Changed', 0],
      ]);
    });

    it('rewrites both releases, each with its new order, when two releases swap places', async () => {
      await executeFirestoreSave(db, UID, state([alpha], [release('r2'), release('r1')]), state([alpha], [release('r1'), release('r2')]));
      expect(releaseSets().map(e => [e.path, e.data!.order])).toEqual([
        ['ganttapp_projects/p1/releases/r2', 0],
        ['ganttapp_projects/p1/releases/r1', 1],
      ]);
    });

    it('does not rewrite releases that are unchanged and in place', async () => {
      const before = state([alpha], [release('r1'), release('r2')]);
      await executeFirestoreSave(db, UID, structuredClone(before), before);
      expect(commits()).toEqual([2]);
      expect(releaseSets()).toEqual([]);
    });

    it('deletes a release that was removed, and only that one', async () => {
      await executeFirestoreSave(db, UID, state([alpha], [release('r1')]), state([alpha], [release('r1'), release('r2')]));
      expect(deletes()).toEqual(['ganttapp_projects/p1/releases/r2']);
    });

    it('deletes a project that was removed', async () => {
      await executeFirestoreSave(db, UID, state([alpha]), state([alpha, { id: 'p2', name: 'Beta' }]));
      expect(deletes()).toEqual(['ganttapp_projects/p2']);
    });

    it('writes the settings document only when a setting changed', async () => {
      const before = state([], [], { showTodayLine: true, preparedBy: 'Ann' });
      const after = { ...before, showTodayLine: false };
      await executeFirestoreSave(db, UID, after, before);
      expect(sets(`ganttapp_settings/${UID}`)).toHaveLength(1);

      fs.reset();
      await executeFirestoreSave(db, UID, structuredClone(after), after);
      expect(commits()).toEqual([2]);
      expect(sets(`ganttapp_settings/${UID}`)).toEqual([]);
    });

    // Every setting holds a value, as in a returning user's saved state. Each
    // row below changes one setting alone: if the executor stopped comparing
    // that setting, the settings document would not be written and the change
    // would be gone on the next load.
    const everySetting = state([], [], {
      chartColors: {
        solidBar: '#000', hatchedBar: '#111', todayLine: '#222', finishDateLine: '#333',
        mostLikelyLine: '#444', completedBar: '#555', inProgressBar: '#666',
      },
      activePreset: 'Default',
      legendLabels: { solidBar: 'Build', hatchedBar: 'Risk' },
      showTodayLine: true,
      todayDateOverride: '2026-08-19',
      showFinishDateLine: true,
      showMostLikelyLine: false,
      showMonths: false,
      chartDisplaySettings: {
        releaseNameFontSize: '14', dateLabelFontSize: '11', dateLabelColor: '#666',
        verticalLineWidth: '2', barHeight: '30', rowSpacing: '25',
      },
      preparedBy: 'Ann',
      showPreparedBy: false,
      exportAttribution: { name: 'Ann', identifier: 'T1' },
      globalWorkDays: [1, 2, 3, 4, 5],
    });

    it.each([
      ['chartColors', { chartColors: { ...everySetting.chartColors!, solidBar: '#fff' } }],
      ['activePreset', { activePreset: 'Ocean' }],
      ['legendLabels', { legendLabels: { solidBar: 'Build', hatchedBar: 'Delay' } }],
      ['showTodayLine', { showTodayLine: false }],
      ['todayDateOverride', { todayDateOverride: '2026-08-26' }],
      ['showFinishDateLine', { showFinishDateLine: false }],
      ['showMostLikelyLine', { showMostLikelyLine: true }],
      ['showMonths', { showMonths: true }],
      ['chartDisplaySettings', { chartDisplaySettings: { ...everySetting.chartDisplaySettings!, barHeight: '50' } }],
      ['preparedBy', { preparedBy: 'Bob' }],
      ['showPreparedBy', { showPreparedBy: true }],
      ['exportAttribution', { exportAttribution: { name: 'Ann', identifier: 'T2' } }],
      ['globalWorkDays', { globalWorkDays: [1, 2, 3, 4, 5, 6] }],
    ] as [string, Partial<AppData>][])('writes the settings document when only %s changes', async (_field, change) => {
      await executeFirestoreSave(db, UID, { ...everySetting, ...change }, structuredClone(everySetting));
      expect(sets(`ganttapp_settings/${UID}`)).toHaveLength(1);
    });

    // In production the copy a save is compared with is a structuredClone of
    // the last save, so every object and array in it is a different object
    // from the one in memory even when nothing changed. A comparison made by
    // reference would see a change in each of them and rewrite the document.
    it('writes no settings document when nothing changed and the saved copy is a clone', async () => {
      await executeFirestoreSave(db, UID, everySetting, structuredClone(everySetting));
      expect(commits()).toEqual([2]); // the save ran to its commit
      expect(sets(`ganttapp_settings/${UID}`)).toEqual([]);
    });

    it('does not rewrite an unchanged project with a finish date, work week and labels when another project changed', async () => {
      const detailed: Project = {
        ...alpha, finishDate: '2026-06-30', workDays: [1, 2, 3, 4, 5, 6], legendLabels: { solidBar: 'S', hatchedBar: 'H' },
      };
      const beta: Project = { id: 'p2', name: 'Beta' };
      await executeFirestoreSave(db, UID, state([detailed, { ...beta, name: 'Renamed' }]), structuredClone(state([detailed, beta])));
      expect(sets('ganttapp_projects/p2')).toHaveLength(1); // the project that changed is rewritten
      expect(sets('ganttapp_projects/p1')).toEqual([]);
    });
  });
});

describe('executeFirestoreSave — the baseline is required', () => {
  // The guard here is the type check (npm run typecheck): without what the
  // cloud last held, a save would write every project as new and every setting
  // over the stored ones, so a null baseline must not compile. The closure is
  // never called.
  it('rejects a null baseline at compile time', () => {
    const data: AppData = { projects: [], releases: [] };
    // @ts-expect-error — a save needs a baseline: what the cloud held at the last load or save.
    const saveAgainstNothing = () => executeFirestoreSave({} as Firestore, 'u1', data, null);
    expect(typeof saveAgainstNothing).toBe('function');
  });
});
