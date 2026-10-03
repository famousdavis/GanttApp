// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// StorageContext's own decisions: when it connects to the cloud, what it
// passes along, what it shows, and how it leaves cloud mode.
//
// Mocked: what StorageContext consumes — the signed-in user (useAuth), the
// upload (switchToCloudMode) and the cloud service's constructor, which
// records the arguments it was given. The local service is the real one,
// on jsdom's localStorage.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const auth = vi.hoisted(() => {
  let state: { user: unknown; isAuthenticated: boolean; loading: boolean } =
    { user: null, isAuthenticated: false, loading: false };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (next: Partial<typeof state>) => { state = { ...state, ...next }; listeners.forEach((l) => l()); },
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  };
});

const cloud = vi.hoisted(() => ({
  constructed: [] as { uid: string; onSaveResult: unknown; service: Record<string, unknown> }[],
  switchToCloudMode: vi.fn(),
}));

vi.mock('../../lib/firebase', () => ({
  auth: {},
  db: {},
  isFirebaseAvailable: true,
  getSendInvitationEmail: () => null,
  getClaimPendingInvitations: () => null,
  getRevokeInvite: () => null,
  getResendInvite: () => null,
}));

vi.mock('firebase/auth', () => ({ signOut: vi.fn().mockResolvedValue(undefined) }));

vi.mock('../AuthContext', async () => {
  const { useSyncExternalStore } = await import('react');
  return { useAuth: () => useSyncExternalStore(auth.subscribe, auth.get) };
});

vi.mock('../storage-mode-switch', () => ({ switchToCloudMode: cloud.switchToCloudMode }));

vi.mock('../../shared/storage/firestore-gantt-storage-service', () => ({
  FirestoreGanttStorageServiceImpl: function (_db: unknown, uid: string, onSaveResult: unknown) {
    const service = { mode: 'cloud', uid, cancelPendingSaves: vi.fn(), dispose: vi.fn() };
    cloud.constructed.push({ uid, onSaveResult, service });
    return service;
  },
}));

import { StorageProvider, useStorage } from '../StorageContext';
import { registerAppDataReset } from '../appDataResetRegistry';

const USER = { uid: 'u1', displayName: 'Ann', email: 'ann@example.com' };
const signedIn = { user: USER, isAuthenticated: true, loading: false };
const MODE_KEY = 'ganttapp-storage-mode';
const coded = (code: string) => Object.assign(new Error(`raw ${code} details`), { code });
const cloudService = () => ({ mode: 'cloud' as const, cancelPendingSaves: vi.fn(), dispose: vi.fn() });
const seedLocalProjects = (count: number) => localStorage.setItem('ganttAppData', JSON.stringify({
  projects: Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `P${i}` })), releases: [],
}));

const renderStorage = () => renderHook(() => useStorage(), { wrapper: StorageProvider });

/** Signed in, stored mode 'cloud', nothing local: the mount connects straight to the cloud. */
async function renderRestoredCloud() {
  localStorage.setItem(MODE_KEY, 'cloud');
  auth.set(signedIn);
  const hook = renderStorage();
  await waitFor(() => expect(hook.result.current.mode).toBe('cloud'));
  return { ...hook, restored: cloud.constructed[0] };
}

describe('StorageContext — cloud connection and switching', () => {
  beforeEach(() => {
    localStorage.clear();
    cloud.constructed.length = 0;
    cloud.switchToCloudMode.mockReset();
    auth.set({ user: null, isAuthenticated: false, loading: false });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('restoring cloud mode on load', () => {
    it('shows and clears save errors reported by the restored cloud service', async () => {
      const { result, restored } = await renderRestoredCloud();

      act(() => (restored.onSaveResult as (e: string | null) => void)('Sync failed'));
      expect(result.current.saveError).toBe('Sync failed');
      act(() => (restored.onSaveResult as (e: string | null) => void)(null));
      expect(result.current.saveError).toBeNull();
    });

    it('connects only once, however often the signed-in user object changes', async () => {
      const { result } = await renderRestoredCloud();
      expect(cloud.constructed).toHaveLength(1);

      act(() => auth.set({ user: { ...USER } })); // e.g. a token refresh
      expect(cloud.constructed).toHaveLength(1);
      expect(result.current.mode).toBe('cloud');
    });

    it('stays local, with no prompt, while signed out — and prompts once signed in', async () => {
      localStorage.setItem(MODE_KEY, 'cloud');
      seedLocalProjects(1);
      const { result } = renderStorage();

      expect(result.current.needsUploadPrompt).toBeNull();
      expect(result.current.mode).toBe('local');
      expect(cloud.constructed).toEqual([]);

      act(() => auth.set(signedIn));
      await waitFor(() => expect(result.current.needsUploadPrompt).toEqual({ projectCount: 1 }));
    });

    it('asks before uploading local projects, with their count, and does not connect yet', async () => {
      localStorage.setItem(MODE_KEY, 'cloud');
      seedLocalProjects(2);
      auth.set(signedIn);
      const { result } = renderStorage();

      await waitFor(() => expect(result.current.needsUploadPrompt).toEqual({ projectCount: 2 }));
      expect(cloud.constructed).toEqual([]);
      expect(result.current.mode).toBe('local');
    });
  });

  describe('the upload prompt', () => {
    async function renderWithPrompt() {
      localStorage.setItem(MODE_KEY, 'cloud');
      seedLocalProjects(2);
      auth.set(signedIn);
      const hook = renderStorage();
      await waitFor(() => expect(hook.result.current.needsUploadPrompt).not.toBeNull());
      return hook;
    }

    it('on confirm, uploads with its save-result callback, stores cloud mode, shows the result and swaps', async () => {
      const { result } = await renderWithPrompt();
      const uploaded = cloudService();
      cloud.switchToCloudMode.mockResolvedValue({ service: uploaded, uploaded: 2, skipped: 0 });
      // The prompt only appears when the stored mode already reads 'cloud', so
      // reset it (as another tab switching to local would) to see this write.
      localStorage.setItem(MODE_KEY, 'local');

      await act(() => result.current.confirmUploadPrompt());

      expect(cloud.switchToCloudMode).toHaveBeenCalledWith({}, USER, expect.any(Function));
      expect(localStorage.getItem(MODE_KEY)).toBe('cloud');
      expect(result.current.uploadResult).toEqual({ uploaded: 2, skipped: 0 });
      expect(result.current.storage).toBe(uploaded);
      expect(result.current.needsUploadPrompt).toBeNull();
      // The callback it passed is this context's: it drives saveError.
      act(() => cloud.switchToCloudMode.mock.calls[0][2]('Sync failed'));
      expect(result.current.saveError).toBe('Sync failed');
    });

    it('on a failed upload, shows the mapped error, stops switching and stays local', async () => {
      const { result } = await renderWithPrompt();
      cloud.switchToCloudMode.mockRejectedValue(coded('unavailable'));

      await act(() => result.current.confirmUploadPrompt());

      expect(result.current.switchError).toBe('Service temporarily unavailable. Please try again later.');
      expect(result.current.isSwitching).toBe(false);
      expect(result.current.mode).toBe('local');
    });

    it('clears the upload result on request', async () => {
      const { result } = await renderWithPrompt();
      cloud.switchToCloudMode.mockResolvedValue({ service: cloudService(), uploaded: 2, skipped: 1 });
      await act(() => result.current.confirmUploadPrompt());
      expect(result.current.uploadResult).toEqual({ uploaded: 2, skipped: 1 });

      act(() => result.current.clearUploadResult());

      expect(result.current.uploadResult).toBeNull();
    });
  });

  describe('switching to cloud', () => {
    it('refuses without a signed-in user', async () => {
      const { result } = renderStorage();

      await act(() => result.current.switchMode('cloud'));

      expect(result.current.switchError).toBe('You must sign in before switching to cloud storage.');
      expect(cloud.switchToCloudMode).not.toHaveBeenCalled();
    });

    it('uploads with its save-result callback, stores cloud mode, shows and returns the counts, and swaps', async () => {
      auth.set(signedIn);
      const { result } = renderStorage();
      const uploaded = cloudService();
      cloud.switchToCloudMode.mockResolvedValue({ service: uploaded, uploaded: 1, skipped: 2 });

      let returned: unknown;
      await act(async () => { returned = await result.current.switchMode('cloud'); });

      expect(returned).toEqual({ uploaded: 1, skipped: 2 });
      expect(cloud.switchToCloudMode).toHaveBeenCalledWith({}, USER, expect.any(Function));
      expect(localStorage.getItem(MODE_KEY)).toBe('cloud');
      expect(result.current.uploadResult).toEqual({ uploaded: 1, skipped: 2 });
      expect(result.current.storage).toBe(uploaded);
      act(() => cloud.switchToCloudMode.mock.calls[0][2]('Sync failed'));
      expect(result.current.saveError).toBe('Sync failed');
    });

    it('shows a Firebase error mapped, not raw', async () => {
      auth.set(signedIn);
      const { result } = renderStorage();
      cloud.switchToCloudMode.mockRejectedValue(coded('permission-denied'));

      await act(() => result.current.switchMode('cloud'));

      expect(result.current.switchError).toBe('Permission denied. Please check your account access.');
    });

    it('clears the previous error when a new switch starts', async () => {
      const { result } = renderStorage();
      await act(() => result.current.switchMode('cloud')); // fails: nobody is signed in
      expect(result.current.switchError).not.toBeNull();

      await act(() => result.current.switchMode('local'));

      expect(result.current.switchError).toBeNull();
    });

    it('leaves no error from an earlier attempt once a switch to cloud succeeds', async () => {
      const { result } = renderStorage();
      await act(() => result.current.switchMode('cloud')); // fails: nobody is signed in
      expect(result.current.switchError).not.toBeNull();

      act(() => auth.set(signedIn));
      cloud.switchToCloudMode.mockResolvedValue({ service: cloudService(), uploaded: 0, skipped: 0 });
      await act(() => result.current.switchMode('cloud'));

      expect(result.current.mode).toBe('cloud'); // the second attempt went through
      expect(result.current.switchError).toBeNull();
    });
  });

  describe('leaving cloud mode', () => {
    it('with projects in memory, asks keep-or-discard with their count and keeps the cloud service', async () => {
      const { result, restored } = await renderRestoredCloud();

      await act(() => result.current.switchMode('local', 3));

      expect(result.current.needsCloudToLocalPrompt).toEqual({ projectCount: 3 });
      expect(result.current.mode).toBe('cloud');
      expect(result.current.isSwitching).toBe(false);
      expect(restored.service.dispose).not.toHaveBeenCalled();
    });

    it('with no projects in memory, cancels and disposes the cloud service and goes local', async () => {
      const { result, restored } = await renderRestoredCloud();

      await act(() => result.current.switchMode('local', 0));

      expect(restored.service.cancelPendingSaves).toHaveBeenCalledTimes(1);
      expect(restored.service.dispose).toHaveBeenCalledTimes(1);
      expect(result.current.mode).toBe('local');
      expect(localStorage.getItem(MODE_KEY)).toBe('local');
    });

    it('Keep Local Copy writes the projects without their cloud owner', async () => {
      const { result } = await renderRestoredCloud();

      await act(() => result.current.confirmKeepLocalCopy({
        projects: [{ id: 'p1', name: 'Alpha', owner: 'u1' }, { id: 'p2', name: 'Beta', owner: 'u9' }],
        releases: [],
      }));

      const written = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(written.projects).toEqual([{ id: 'p1', name: 'Alpha' }, { id: 'p2', name: 'Beta' }]);
    });

    it('Keep Local Copy then cancels and disposes the cloud service, clears memory, swaps and closes the prompt', async () => {
      const { result, restored } = await renderRestoredCloud();
      const reset = vi.fn();
      const deregister = registerAppDataReset(reset);
      await act(() => result.current.switchMode('local', 1));
      expect(result.current.needsCloudToLocalPrompt).not.toBeNull();

      await act(() => result.current.confirmKeepLocalCopy({ projects: [{ id: 'p1', name: 'Alpha' }], releases: [] }));

      expect(restored.service.cancelPendingSaves).toHaveBeenCalledTimes(1);
      expect(restored.service.dispose).toHaveBeenCalledTimes(1);
      expect(reset).toHaveBeenCalledTimes(1);
      expect(result.current.mode).toBe('local');
      expect(await result.current.storage.loadAppData()).toMatchObject({ projects: [{ id: 'p1', name: 'Alpha' }] });
      expect(localStorage.getItem(MODE_KEY)).toBe('local');
      expect(result.current.needsCloudToLocalPrompt).toBeNull();
      deregister();
    });

    it('Discard cancels and disposes the cloud service, clears memory, swaps to local, writes nothing and closes the prompt', async () => {
      const { result, restored } = await renderRestoredCloud();
      const reset = vi.fn();
      const deregister = registerAppDataReset(reset);
      await act(() => result.current.switchMode('local', 1));
      expect(result.current.needsCloudToLocalPrompt).not.toBeNull();

      await act(() => result.current.confirmDiscardCloudData());

      expect(restored.service.cancelPendingSaves).toHaveBeenCalledTimes(1);
      expect(restored.service.dispose).toHaveBeenCalledTimes(1);
      expect(reset).toHaveBeenCalledTimes(1);
      expect(result.current.mode).toBe('local');
      expect(localStorage.getItem(MODE_KEY)).toBe('local');
      expect(result.current.needsCloudToLocalPrompt).toBeNull();
      expect(localStorage.getItem('ganttAppData')).toBeNull();
      deregister();
    });
  });

  describe('signing out', () => {
    it('clears a shown save error', async () => {
      const { result, restored } = await renderRestoredCloud();
      act(() => (restored.onSaveResult as (e: string | null) => void)('Sync failed'));
      expect(result.current.saveError).toBe('Sync failed');

      await act(() => result.current.performSignOutWithCleanup());

      expect(result.current.saveError).toBeNull();
    });

    it('clears a shown switch error', async () => {
      const { result } = renderStorage();
      await act(() => result.current.switchMode('cloud')); // fails: nobody is signed in
      expect(result.current.switchError).not.toBeNull();

      await act(() => result.current.performSignOutWithCleanup());

      expect(result.current.switchError).toBeNull();
    });
  });
});

describe('StorageContext — leaving and joining the cloud cleanly', () => {
  const report = (entry: { onSaveResult: unknown }, message: string | null) =>
    act(() => (entry.onSaveResult as (e: string | null) => void)(message));
  const switchResult = (uploaded: string[], skipped: string[]) => ({
    service: cloudService(),
    uploaded: uploaded.length,
    skipped: skipped.length,
    uploadedProjects: uploaded.map((id) => ({ id, name: id.toUpperCase() })),
    skippedProjects: skipped.map((id) => ({ id, localName: id.toUpperCase(), cloudName: id.toUpperCase() })),
  });
  const seedMixedLocal = () => {
    localStorage.setItem('ganttAppData', JSON.stringify({
      projects: [{ id: 'p0', name: 'P0' }, { id: 'p1', name: 'P1' }],
      releases: [
        { id: 'r0', projectId: 'p0', name: 'R0', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01' },
        { id: 'r1', projectId: 'p1', name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01' },
      ],
      preparedBy: 'Local Person',
    }));
    localStorage.setItem('ganttAppSnapshots', JSON.stringify([
      { id: 's0', projectId: 'p0', name: 'S0', timestamp: '2026-01-01T00:00:00.000Z', releases: [] },
      { id: 's1', projectId: 'p1', name: 'S1', timestamp: '2026-01-01T00:00:00.000Z', releases: [] },
    ]));
  };
  const stored = () => ({
    data: JSON.parse(localStorage.getItem('ganttAppData') ?? 'null'),
    snapshots: JSON.parse(localStorage.getItem('ganttAppSnapshots') ?? 'null'),
  });
  const deferredResult = () => {
    let resolve!: (value: unknown) => void;
    const promise = new Promise((res) => { resolve = res; });
    return { promise, resolve };
  };
  const startSwitch: Record<string, (r: ReturnType<typeof useStorage>) => Promise<unknown>> = {
    'the Cloud radio': (r) => r.switchMode('cloud'),
    'the upload prompt': (r) => r.confirmUploadPrompt(),
  };
  async function renderBeforeSwitch(door: string) {
    if (door === 'the upload prompt') localStorage.setItem(MODE_KEY, 'cloud');
    auth.set(signedIn);
    const hook = renderStorage();
    if (door === 'the upload prompt') await waitFor(() => expect(hook.result.current.needsUploadPrompt).not.toBeNull());
    return hook;
  }

  beforeEach(() => {
    localStorage.clear();
    cloud.constructed.length = 0;
    cloud.switchToCloudMode.mockReset();
    auth.set({ user: null, isAuthenticated: false, loading: false });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['switching to Local with no projects in memory', (r: ReturnType<typeof useStorage>) => r.switchMode('local', 0)],
    ['Keep Local Copy', (r: ReturnType<typeof useStorage>) => r.confirmKeepLocalCopy({ projects: [], releases: [] })],
    ['Discard', (r: ReturnType<typeof useStorage>) => r.confirmDiscardCloudData()],
  ])('clears a cloud sync error when leaving the cloud by %s', async (_path, leave) => {
    const { result, restored } = await renderRestoredCloud();
    await report(restored, 'Cloud trouble');
    expect(result.current.saveError).toBe('Cloud trouble');

    await act(() => leave(result.current));

    expect(result.current.saveError).toBeNull();
  });

  it('clears a late report from a disposed cloud service when switching to a new one', async () => {
    const { result, restored } = await renderRestoredCloud();
    await act(() => result.current.switchMode('local', 0));
    await report(restored, 'Late report'); // e.g. a save that was in flight when it was disposed
    expect(result.current.saveError).toBe('Late report');
    cloud.switchToCloudMode.mockResolvedValue(switchResult([], []));

    await act(() => result.current.switchMode('cloud'));

    expect(result.current.saveError).toBeNull();
  });

  it('clears in-memory data before going local when no projects are in memory', async () => {
    const { result } = await renderRestoredCloud();
    const reset = vi.fn();
    const deregister = registerAppDataReset(reset);

    await act(() => result.current.switchMode('local', 0));

    expect(reset).toHaveBeenCalledTimes(1);
    deregister();
  });

  it.each(Object.keys(startSwitch))('after a switch by %s, removes the uploaded projects’ local copies only once it resolves', async (door) => {
    seedMixedLocal();
    const { result } = await renderBeforeSwitch(door);
    const pending = deferredResult();
    cloud.switchToCloudMode.mockReturnValue(pending.promise);

    act(() => { void startSwitch[door](result.current); });
    await waitFor(() => expect(cloud.switchToCloudMode).toHaveBeenCalled());
    expect(stored().data.projects.map((p: { id: string }) => p.id)).toEqual(['p0', 'p1']); // not before

    await act(async () => { pending.resolve(switchResult(['p0'], ['p1'])); });

    await waitFor(() => expect(stored().data.projects.map((p: { id: string }) => p.id)).toEqual(['p1']));
    expect(stored().data.releases.map((r: { id: string }) => r.id)).toEqual(['r1']);
    expect(stored().snapshots.map((s: { id: string }) => s.id)).toEqual(['s1']);
    expect(stored().data.preparedBy).toBe('Local Person'); // the kept copy keeps its settings
  });

  it('clears local project data entirely when every local project was uploaded', async () => {
    seedMixedLocal();
    auth.set(signedIn);
    const { result } = renderStorage();
    cloud.switchToCloudMode.mockResolvedValue(switchResult(['p0', 'p1'], []));

    await act(() => result.current.switchMode('cloud'));

    expect(localStorage.getItem('ganttAppData')).toBeNull();
    expect(localStorage.getItem('ganttAppSnapshots')).toBeNull();
  });
});
