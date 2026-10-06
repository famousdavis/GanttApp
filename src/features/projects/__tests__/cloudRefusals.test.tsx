// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// When the cloud data never loaded, nothing can be saved. Deleting, copying
// and importing projects are refused before anything changes on screen, so
// nothing appears done that a reload would undo. If a snapshot write is
// refused anyway, the message says the action did not happen, never that it
// partly did.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { AppData } from '../../../shared/types/app';
import type { Snapshot } from '../../../shared/types/snapshots';

const ctx = vi.hoisted(() => ({
  data: { projects: [], releases: [] } as AppData,
  updateData: (_d: AppData) => {},
  storage: {} as Record<string, unknown>,
}));

vi.mock('../../../context/AppDataContext', () => ({
  useAppData: () => ({ data: ctx.data, updateData: ctx.updateData }),
}));
vi.mock('../../../context/StorageContext', () => ({ useStorage: () => ({ storage: ctx.storage }) }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));

import { useProjects } from '../useProjects';
import { useImportState } from '../hooks/useImportState';
import { CloudDataNotLoadedError } from '../../../shared/storage/cloud-data-not-loaded';

const REASON = 'Your cloud data did not load, so changes cannot be saved. Reload the page to try again.';
// The refusal the cloud service throws.
const refusal = () => new CloudDataNotLoadedError();
const snapshot = (id: string, projectId: string): Snapshot =>
  ({ id, projectId, name: id, timestamp: '2026-01-01T00:00:00.000Z', releases: [] } as unknown as Snapshot);

function cloudStorage(canWrite: boolean, overrides: Record<string, unknown> = {}) {
  return {
    mode: 'cloud' as const,
    canWrite: () => canWrite,
    loadSnapshots: vi.fn(async () => [snapshot('s1', 'p1')]),
    loadSnapshotsStrict: vi.fn(async () => [snapshot('s1', 'p1')]),
    saveSnapshots: vi.fn(async (_s: Snapshot[]) => {}),
    deleteSnapshotsForProject: vi.fn(async (_id: string) => [] as Snapshot[]),
    ...overrides,
  };
}

describe('projects in a cloud session whose data never loaded', () => {
  let alertSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    ctx.data = { projects: [{ id: 'p1', name: 'Alpha' }], releases: [] };
    ctx.updateData = vi.fn();
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses a delete before anything changes', async () => {
    const storage = cloudStorage(false);
    ctx.storage = storage;
    const setSelected = vi.fn();
    const { result } = renderHook(() => useProjects());

    await act(() => result.current.deleteProject('p1', 'p1', setSelected));

    expect(ctx.updateData).not.toHaveBeenCalled();
    expect(storage.deleteSnapshotsForProject).not.toHaveBeenCalled();
    expect(setSelected).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(`This project was not deleted. ${REASON}`);
  });

  it('refuses a copy before anything changes', async () => {
    const storage = cloudStorage(false);
    ctx.storage = storage;
    const { result } = renderHook(() => useProjects());

    await act(() => result.current.cloneProject('p1'));

    expect(ctx.updateData).not.toHaveBeenCalled();
    expect(storage.saveSnapshots).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(`This project was not copied. ${REASON}`);
  });

  it('says a delete did not happen when the snapshot delete is refused', async () => {
    ctx.storage = cloudStorage(true, { deleteSnapshotsForProject: vi.fn(async () => { throw refusal(); }) });
    const { result } = renderHook(() => useProjects());

    await act(() => result.current.deleteProject('p1', '', vi.fn()));

    expect(alertSpy).toHaveBeenCalledWith(`This project was not deleted. ${REASON}`);
  });

  it('says a copy did not happen when the snapshot copy is refused', async () => {
    ctx.storage = cloudStorage(true, { saveSnapshots: vi.fn(async () => { throw refusal(); }) });
    const { result } = renderHook(() => useProjects());

    await act(() => result.current.cloneProject('p1'));

    expect(alertSpy).toHaveBeenCalledWith(`This project was not copied. ${REASON}`);
  });
});

describe('importing in a cloud session whose data never loaded', () => {
  const projectExport = { _exportType: 'ganttapp-project-export', projects: [{ id: 'p-new', name: 'New' }], releases: [] };
  const legacyExport = { projects: [{ id: 'p-new', name: 'New' }], releases: [] };

  function changeEvent(payload: unknown) {
    const file = new File([JSON.stringify(payload)], 'import.json', { type: 'application/json' });
    const input = document.createElement('input');
    input.type = 'file';
    Object.defineProperty(input, 'files', { value: [file] as unknown as FileList, writable: false });
    return { target: input, currentTarget: input } as unknown as React.ChangeEvent<HTMLInputElement>;
  }

  function setup(storage: ReturnType<typeof cloudStorage>, onReplaceSnapshots = vi.fn(async (_s: Snapshot[]) => {})) {
    const updateData = vi.fn();
    const hook = renderHook(() => useImportState({
      data: { projects: [{ id: 'p1', name: 'Alpha' }], releases: [] },
      storage,
      updateData,
      onReplaceSnapshots,
      selectedProjectId: 'p1',
      setSelectedProjectId: vi.fn(),
      appDataLoading: false,
    }));
    return { ...hook, updateData, onReplaceSnapshots };
  }

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses a merge import before anything changes', async () => {
    const { result, updateData, onReplaceSnapshots } = setup(cloudStorage(false));
    await act(() => result.current.handleImport(changeEvent(projectExport)) as unknown as Promise<void>);
    await act(async () => { result.current.handleConfirmMerge(); });

    expect(updateData).not.toHaveBeenCalled();
    expect(onReplaceSnapshots).not.toHaveBeenCalled();
    expect(result.current.importBanner).toEqual({ kind: 'error', text: `Nothing was imported. ${REASON}` });
  });

  it('refuses a replace-all import before anything changes', async () => {
    const { result, updateData, onReplaceSnapshots } = setup(cloudStorage(false));
    await act(() => result.current.handleImport(changeEvent(legacyExport)) as unknown as Promise<void>);
    await act(async () => { result.current.handleConfirmReplaceAll(); });

    expect(updateData).not.toHaveBeenCalled();
    expect(onReplaceSnapshots).not.toHaveBeenCalled();
    expect(result.current.importBanner).toEqual({ kind: 'error', text: `Nothing was imported. ${REASON}` });
  });

  it('says nothing was imported when the snapshot write is refused', async () => {
    const { result } = setup(cloudStorage(true), vi.fn(async () => { throw refusal(); }));
    await act(() => result.current.handleImport(changeEvent(projectExport)) as unknown as Promise<void>);
    await act(async () => { result.current.handleConfirmMerge(); });

    expect(result.current.importBanner).toEqual({ kind: 'error', text: `Nothing was imported. ${REASON}` });
  });
});
