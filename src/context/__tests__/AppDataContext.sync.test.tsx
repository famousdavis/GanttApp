// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// AppDataContext's loading, saving and real-time sync, driven through the one
// thing it consumes: the storage service from useStorage(). That hook is
// replaced by a small store so a test can swap the service mid-session, the
// way sign-in, sign-out and the storage switch do.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { AppData } from '../../shared/types/app';
import type { Project, Release } from '../../shared/types/models';

const current = vi.hoisted(() => {
  let storage: unknown = null;
  const listeners = new Set<() => void>();
  return {
    get: () => storage,
    set: (next: unknown) => { storage = next; listeners.forEach((l) => l()); },
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  };
});

vi.mock('../StorageContext', async () => {
  const { useSyncExternalStore } = await import('react');
  return { useStorage: () => ({ storage: useSyncExternalStore(current.subscribe, current.get) }) };
});

import { AppDataProvider, useAppData } from '../AppDataContext';

type SnapshotCallback = (releases: Release[], snap: { metadata: { hasPendingWrites: boolean } }) => void;

function makeStorage(mode: 'local' | 'cloud', load: AppData | null | (() => Promise<AppData | null>)) {
  const listeners = new Map<string, SnapshotCallback>();
  const unsubs: ReturnType<typeof vi.fn>[] = [];
  return {
    mode,
    loadAppData: vi.fn(typeof load === 'function' ? load : async () => structuredClone(load)),
    saveAppData: vi.fn(async (_data: AppData) => {}),
    subscribeToProject: vi.fn((projectId: string, callback: SnapshotCallback) => {
      listeners.set(projectId, callback);
      const unsub = vi.fn();
      unsubs.push(unsub);
      return unsub;
    }),
    listeners,
    unsubs,
  };
}
type FakeStorage = ReturnType<typeof makeStorage>;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
};
const project = (id: string): Project => ({ id, name: id.toUpperCase() });
const release = (id: string, projectId: string, name = id): Release => ({
  id, projectId, name, startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01',
});
const SERVER = { metadata: { hasPendingWrites: false } };
const LOCAL_ECHO = { metadata: { hasPendingWrites: true } };
const activeListeners = (s: FakeStorage) => s.unsubs.filter((u) => u.mock.calls.length === 0).length;

function renderAppData(storage: FakeStorage) {
  current.set(storage);
  return renderHook(() => useAppData(), { wrapper: AppDataProvider });
}
async function renderLoaded(storage: FakeStorage) {
  const hook = renderAppData(storage);
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('AppDataContext — loading, saving and sync', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loading', () => {
    it('ignores a load that finishes after the storage changed, and keeps loading until the new one does', async () => {
      const stale = deferred<AppData | null>();
      const fresh = deferred<AppData | null>();
      const { result } = renderAppData(makeStorage('local', () => stale.promise));
      act(() => current.set(makeStorage('local', () => fresh.promise)));

      await act(async () => { stale.resolve({ projects: [project('stale')], releases: [] }); });
      expect(result.current.data.projects).toEqual([]);
      expect(result.current.loading).toBe(true);

      await act(async () => { fresh.resolve({ projects: [project('fresh')], releases: [] }); });
      expect(result.current.data.projects.map((p) => p.id)).toEqual(['fresh']);
      expect(result.current.loading).toBe(false);
    });

    it('does not let an empty load replace projects already in memory', async () => {
      const { result } = await renderLoaded(makeStorage('local', { projects: [project('p1')], releases: [] }));
      expect(result.current.data.projects.map((p) => p.id)).toEqual(['p1']);

      const empty = makeStorage('local', { projects: [], releases: [] });
      act(() => current.set(empty));
      await waitFor(() => expect(empty.loadAppData).toHaveBeenCalled());
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.data.projects.map((p) => p.id)).toEqual(['p1']);
    });

    it.each([
      ['solid bar', { hatchedBar: 'H' }, 'hatchedBarLabel', 'H', 'solidBarLabel'],
      ['hatched bar', { solidBar: 'S' }, 'solidBarLabel', 'S', 'hatchedBarLabel'],
    ] as const)('leaves the %s label empty when the stored labels have none', async (_label, legendLabels, present, value, missing) => {
      const { result } = await renderLoaded(makeStorage('local', { projects: [], releases: [], legendLabels }));
      expect(result.current[present]).toBe(value); // the stored labels were read
      expect(result.current[missing]).toBe('');
    });

    it('restores a stored showTodayLine of false', async () => {
      const { result } = await renderLoaded(makeStorage('local', { projects: [], releases: [], showTodayLine: false }));
      expect(result.current.showTodayLine).toBe(false);
    });

    it('restores a stored showMonths', async () => {
      const { result } = await renderLoaded(makeStorage('local', { projects: [], releases: [], showMonths: true }));
      expect(result.current.showMonths).toBe(true);
    });

    it('keeps the Mon–Fri work week when the stored one is invalid', async () => {
      const { result } = await renderLoaded(makeStorage('local', {
        projects: [], releases: [], showMonths: true, globalWorkDays: [9, 10],
      }));
      expect(result.current.showMonths).toBe(true); // the stored settings were read
      expect(result.current.globalWorkDays).toEqual([1, 2, 3, 4, 5]);
    });

    it('ends loading, with nothing loaded, when the load fails', async () => {
      const { result } = renderAppData(makeStorage('local', () => Promise.reject(new Error('disk error'))));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.data).toEqual({ projects: [], releases: [] });
    });
  });

  describe('saving', () => {
    it.each([
      ['setSolidBarLabel', 'solidBar'],
      ['setFinishDateLabel', 'finishDateLine'],
      ['setMostLikelyLineLabel', 'mostLikelyLine'],
      ['setInProgressLabel', 'inProgress'],
    ] as const)('%s saves the label under legendLabels.%s', async (setter, key) => {
      const storage = makeStorage('local', { projects: [], releases: [] });
      const { result } = await renderLoaded(storage);

      act(() => result.current[setter]('Custom'));

      await waitFor(() => expect(storage.saveAppData).toHaveBeenCalled());
      expect(storage.saveAppData.mock.calls.at(-1)![0].legendLabels).toEqual({ [key]: 'Custom' });
    });

    it('saves edits again after a reload triggered by an invitation claim', async () => {
      const storage = makeStorage('cloud', { projects: [], releases: [] });
      const { result } = await renderLoaded(storage);
      act(() => result.current.setPreparedBy('Before'));
      await waitFor(() => expect(storage.saveAppData).toHaveBeenCalledWith(expect.objectContaining({ preparedBy: 'Before' })));

      act(() => { window.dispatchEvent(new CustomEvent('spert:models-changed')); });
      await waitFor(() => expect(storage.loadAppData).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(result.current.loading).toBe(false));
      storage.saveAppData.mockClear();

      act(() => result.current.setPreparedBy('After'));
      await waitFor(() => expect(storage.saveAppData).toHaveBeenCalledWith(expect.objectContaining({ preparedBy: 'After' })));
    });

    // Signing out of the cloud removes the local copy, so the new local service
    // loads nothing. When that empty load settles, the app also saves its
    // cleared state once (no projects, default settings), before any edit.
    // Whether that save should happen is not settled, so this test asserts
    // nothing about it either way: it checks only that the user's own next
    // edit is saved.
    it('saves edits again after a sign-out reset whose local load finds nothing', async () => {
      const { result } = await renderLoaded(makeStorage('cloud', { projects: [project('p1')], releases: [] }));
      const local = makeStorage('local', null);

      act(() => { result.current.clearAllData(); current.set(local); });
      await waitFor(() => expect(local.loadAppData).toHaveBeenCalled());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => result.current.setPreparedBy('After sign-out'));
      await waitFor(() => expect(local.saveAppData).toHaveBeenCalledWith(expect.objectContaining({ preparedBy: 'After sign-out' })));
    });
  });

  describe('cloud sync', () => {
    it("ignores a snapshot that is only the echo of this browser's own pending write", async () => {
      const storage = makeStorage('cloud', { projects: [project('p1')], releases: [release('r1', 'p1')] });
      const { result } = await renderLoaded(storage);
      await waitFor(() => expect(storage.listeners.has('p1')).toBe(true));

      act(() => storage.listeners.get('p1')!([release('r1', 'p1', 'Echo')], LOCAL_ECHO));
      expect(result.current.data.releases.map((r) => r.name)).toEqual(['r1']);

      act(() => storage.listeners.get('p1')!([release('r1', 'p1', 'Server')], SERVER));
      expect(result.current.data.releases.map((r) => r.name)).toEqual(['Server']);
    });

    it('evicts a revoked project only in cloud mode', async () => {
      const { result } = await renderLoaded(makeStorage('local', { projects: [project('p1')], releases: [] }));
      act(() => { window.dispatchEvent(new CustomEvent('ganttapp:project-revoked', { detail: { projectId: 'p1' } })); });
      expect(result.current.data.projects.map((p) => p.id)).toEqual(['p1']);

      const cloudStorage = makeStorage('cloud', { projects: [project('p1')], releases: [] });
      act(() => current.set(cloudStorage));
      await waitFor(() => expect(cloudStorage.loadAppData).toHaveBeenCalled());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => { window.dispatchEvent(new CustomEvent('ganttapp:project-revoked', { detail: { projectId: 'p1' } })); });
      expect(result.current.data.projects).toEqual([]);
    });

    it('unsubscribes every listener when the project set changes, the storage changes, or it unmounts', async () => {
      const first = makeStorage('cloud', { projects: [project('p1'), project('p2')], releases: [] });
      const { result, unmount } = await renderLoaded(first);
      await waitFor(() => expect(first.subscribeToProject).toHaveBeenCalledTimes(2));

      act(() => result.current.setData({ ...result.current.data, projects: [project('p1'), project('p2'), project('p3')] }));
      expect(first.unsubs.slice(0, 2).map((u) => u.mock.calls.length)).toEqual([1, 1]);
      expect(activeListeners(first)).toBe(3);

      const second = makeStorage('cloud', { projects: [project('p1')], releases: [] });
      act(() => current.set(second));
      expect(activeListeners(first)).toBe(0);
      await waitFor(() => expect(activeListeners(second)).toBe(1));

      unmount();
      expect(activeListeners(second)).toBe(0);
    });

    it('treats the first snapshot after a storage change as a first snapshot again', async () => {
      const r1 = release('r1', 'p1');
      const first = makeStorage('cloud', { projects: [project('p1')], releases: [r1] });
      const { result } = await renderLoaded(first);
      await waitFor(() => expect(first.listeners.has('p1')).toBe(true));
      act(() => first.listeners.get('p1')!([release('r1', 'p1', 'Renamed')], SERVER));
      expect(result.current.data.releases.map((r) => r.name)).toEqual(['Renamed']); // snapshots apply

      const second = makeStorage('cloud', { projects: [project('p1')], releases: [r1] });
      act(() => current.set(second));
      await waitFor(() => expect(second.listeners.has('p1')).toBe(true));
      await waitFor(() => expect(result.current.loading).toBe(false));

      // An empty FIRST snapshot is the cold-load race: it must not wipe p1's releases.
      act(() => second.listeners.get('p1')!([], SERVER));
      expect(result.current.data.releases.map((r) => r.id)).toEqual(['r1']);
    });

    it('does not re-subscribe when projects are only reordered', async () => {
      const storage = makeStorage('cloud', { projects: [project('p1'), project('p2')], releases: [] });
      const { result } = await renderLoaded(storage);
      await waitFor(() => expect(storage.subscribeToProject).toHaveBeenCalledTimes(2));

      act(() => result.current.setData({ ...result.current.data, projects: [project('p2'), project('p1')] }));

      expect(storage.subscribeToProject).toHaveBeenCalledTimes(2);
      expect(activeListeners(storage)).toBe(2);
    });

    it('holds no listener while a reload is in progress', async () => {
      const reload = deferred<AppData | null>();
      const data: AppData = { projects: [project('p1')], releases: [] };
      const storage = makeStorage('cloud', data);
      storage.loadAppData.mockResolvedValueOnce(structuredClone(data)).mockReturnValueOnce(reload.promise);
      const { result } = await renderLoaded(storage);
      await waitFor(() => expect(activeListeners(storage)).toBe(1));

      act(() => { window.dispatchEvent(new CustomEvent('spert:models-changed')); });
      await waitFor(() => expect(result.current.loading).toBe(true));
      expect(activeListeners(storage)).toBe(0);

      await act(async () => { reload.resolve(structuredClone(data)); });
      await waitFor(() => expect(activeListeners(storage)).toBe(1));
    });
  });
});

// Saves and listeners go only to the storage whose load produced the data on
// screen. A storage swap re-runs the save and listener effects before the new
// storage has loaded anything, while the data on screen still belongs to the
// old one.
describe('AppDataContext — nothing reaches a storage before its load applies', () => {
  const wait = async (ms: number) => {
    for (let t = 0; t < ms; t += 5) await act(() => new Promise<void>((r) => { setTimeout(r, 5); }));
  };
  const withSetAside = (s: FakeStorage) => Object.assign(s, { setAsideLoad: vi.fn((_loaded: AppData) => {}) });

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves nothing to a new storage before its load applies', async () => {
    await renderLoaded(makeStorage('local', { projects: [project('p1')], releases: [] }));
    const load = deferred<AppData | null>();
    const next = makeStorage('cloud', () => load.promise);

    act(() => current.set(next));
    await wait(30);

    expect(next.saveAppData).not.toHaveBeenCalled();
    await act(async () => { load.resolve({ projects: [project('p1')], releases: [] }); });
  });

  it('does not save an edit to a storage whose first load failed', async () => {
    const { result } = await renderLoaded(makeStorage('local', { projects: [project('p1')], releases: [] }));
    const next = makeStorage('cloud', null);
    act(() => current.set(next));
    await waitFor(() => expect(next.loadAppData).toHaveBeenCalled());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setPreparedBy('Edited'));
    await wait(30);

    expect(next.saveAppData).not.toHaveBeenCalled();
  });

  it('does not let updateData save to a storage whose first load failed', async () => {
    const { result } = await renderLoaded(makeStorage('local', { projects: [project('p1')], releases: [] }));
    const next = makeStorage('cloud', null);
    act(() => current.set(next));
    await waitFor(() => expect(next.loadAppData).toHaveBeenCalled());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.updateData({ ...result.current.data, projects: [project('p1'), project('n1')] }));
    await wait(30);

    expect(next.saveAppData).not.toHaveBeenCalled();
    expect(result.current.data.projects.map((p) => p.id)).toEqual(['p1', 'n1']); // the screen still changes
  });

  it('opens no listener on a new storage before its load applies, nor after its first load failed', async () => {
    const { result } = await renderLoaded(makeStorage('local', { projects: [project('p1')], releases: [] }));
    const load = deferred<AppData | null>();
    const next = makeStorage('cloud', () => load.promise);

    act(() => current.set(next));
    await wait(30);
    expect(next.subscribeToProject).not.toHaveBeenCalled();

    await act(async () => { load.resolve(null); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await wait(30);
    expect(next.subscribeToProject).not.toHaveBeenCalled();
  });

  // Control: true before this release and after it.
  it('keeps saving edits to a storage after a failed reload of it', async () => {
    const storage = makeStorage('cloud', { projects: [project('p1')], releases: [] });
    const { result } = await renderLoaded(storage);
    storage.loadAppData.mockResolvedValueOnce(null);

    act(() => { window.dispatchEvent(new CustomEvent('spert:models-changed')); });
    await waitFor(() => expect(storage.loadAppData).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.loading).toBe(false));
    storage.saveAppData.mockClear();

    act(() => result.current.setPreparedBy('After'));
    await waitFor(() => expect(storage.saveAppData).toHaveBeenCalledWith(expect.objectContaining({ preparedBy: 'After' })));
  });

  it('shows a local copy kept in the new local storage and does not overwrite it on the swap', async () => {
    const { result } = await renderLoaded(makeStorage('cloud', { projects: [], releases: [], preparedBy: 'Cloud Person' }));
    const load = deferred<AppData | null>();
    const local = makeStorage('local', () => load.promise);

    act(() => current.set(local));
    await wait(30);
    expect(local.saveAppData).not.toHaveBeenCalled();

    await act(async () => { load.resolve({ projects: [project('k1')], releases: [] }); });
    expect(result.current.data.projects.map((p) => p.id)).toEqual(['k1']);
  });

  it('saves nothing to a new storage whose first load is skipped by the empty-result guard', async () => {
    const { result } = await renderLoaded(makeStorage('local', { projects: [project('p1')], releases: [] }));
    const next = withSetAside(makeStorage('cloud', { projects: [], releases: [] }));
    act(() => current.set(next));
    await waitFor(() => expect(next.loadAppData).toHaveBeenCalled());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setPreparedBy('Edited'));
    await wait(30);

    expect(next.saveAppData).not.toHaveBeenCalled();
    expect(result.current.data.projects.map((p) => p.id)).toEqual(['p1']);
  });

  it('sets an empty load skipped by the guard aside at once, before any timer can run', async () => {
    const storage = withSetAside(makeStorage('cloud', { projects: [project('p1')], releases: [] }));
    const { result } = await renderLoaded(storage);
    const empty: AppData = { projects: [], releases: [] };
    let timerRan = false;
    storage.loadAppData.mockImplementationOnce(async () => {
      setTimeout(() => { timerRan = true; }, 0);
      return empty;
    });
    const timerRanAtSetAside: boolean[] = [];
    storage.setAsideLoad.mockImplementation(() => { timerRanAtSetAside.push(timerRan); });

    act(() => { window.dispatchEvent(new CustomEvent('spert:models-changed')); });
    await waitFor(() => expect(storage.setAsideLoad).toHaveBeenCalledTimes(1));

    expect(storage.setAsideLoad.mock.calls[0][0]).toBe(empty);
    expect(timerRanAtSetAside).toEqual([false]);
    expect(result.current.data.projects.map((p) => p.id)).toEqual(['p1']);
  });

  it('sets aside a load that finishes after the storage was swapped', async () => {
    const load = deferred<AppData | null>();
    const first = withSetAside(makeStorage('cloud', () => load.promise));
    renderAppData(first);
    act(() => current.set(makeStorage('cloud', { projects: [], releases: [] })));

    const late: AppData = { projects: [project('p1')], releases: [] };
    await act(async () => { load.resolve(late); });

    expect(first.setAsideLoad.mock.calls.map((c) => c[0])).toEqual([late]);
    expect(first.setAsideLoad.mock.calls[0]?.[0]).toBe(late);
  });

  it('sets aside a reload that finishes after a newer reload began', async () => {
    const storage = withSetAside(makeStorage('cloud', { projects: [project('p1')], releases: [] }));
    const { result } = await renderLoaded(storage);
    const older = deferred<AppData | null>();
    storage.loadAppData.mockImplementationOnce(() => older.promise);
    act(() => { window.dispatchEvent(new CustomEvent('spert:models-changed')); });
    await waitFor(() => expect(storage.loadAppData).toHaveBeenCalledTimes(2));
    act(() => { window.dispatchEvent(new CustomEvent('spert:models-changed')); });
    await waitFor(() => expect(storage.loadAppData).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const stale: AppData = { projects: [project('p1')], releases: [] };
    await act(async () => { older.resolve(stale); });

    expect(storage.setAsideLoad.mock.calls[0]?.[0]).toBe(stale);
  });
});
