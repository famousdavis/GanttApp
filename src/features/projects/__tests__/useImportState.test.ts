// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// v0.26.0 — Smart Import state machine tests (pitfall #59).
// renderHook cases, plus direct tests of withImportOwners and withFreshImportIds. ImportPreviewSection-level rendering is covered by
// ProjectsTab.test.tsx; this file targets the hook's internal state machine
// in isolation, mocking storage + updateData + onReplaceSnapshots.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImportState, withImportOwners, withFreshImportIds } from '../hooks/useImportState';
import type { AppData } from '../../../shared/types/app';
import type { Snapshot } from '../../../shared/types/snapshots';
import type { ImportResult } from '../../../shared/utils/export';

function makeAppData(overrides: Partial<AppData> = {}): AppData {
  return {
    projects: [],
    releases: [],
    ...overrides,
  };
}

interface SetupOptions {
  data?: AppData;
  mode?: 'local' | 'cloud';
  loadSnapshotsStrict?: () => Promise<Snapshot[]>;
  updateData?: (d: AppData) => void;
  onReplaceSnapshots?: (s: Snapshot[]) => Promise<void>;
  appDataLoading?: boolean;
  selectedProjectId?: string;
}

function setup(opts: SetupOptions = {}) {
  const data = opts.data ?? makeAppData();
  const updateData: (d: AppData) => void = opts.updateData ?? vi.fn();
  const onReplaceSnapshots: (s: Snapshot[]) => Promise<void> =
    opts.onReplaceSnapshots ?? vi.fn(() => Promise.resolve());
  const setSelectedProjectId = vi.fn();
  const storage = {
    mode: opts.mode ?? 'local',
    loadSnapshotsStrict: opts.loadSnapshotsStrict ?? (() => Promise.resolve<Snapshot[]>([])),
    canWrite: () => true,
  };

  const { result, rerender } = renderHook(
    (props: { dataOverride?: AppData }) =>
      useImportState({
        data: props.dataOverride ?? data,
        storage,
        updateData,
        onReplaceSnapshots,
        selectedProjectId: opts.selectedProjectId ?? '',
        setSelectedProjectId,
        appDataLoading: opts.appDataLoading ?? false,
      }),
    { initialProps: { dataOverride: undefined } as { dataOverride?: AppData } }
  );

  return { result, rerender, storage, updateData, onReplaceSnapshots, setSelectedProjectId };
}

// Helpers: synthesize ChangeEvent-like objects with a File payload.
function makeFile(payload: unknown): File {
  return new File([JSON.stringify(payload)], 'test.json', { type: 'application/json' });
}

function makeNonJsonFile(): File {
  return new File(['not valid json {{'], 'test.json', { type: 'application/json' });
}

function makeChangeEvent(file: File | null): React.ChangeEvent<HTMLInputElement> {
  // jsdom has no DataTransfer; build a minimal FileList-shaped value instead.
  const files = file ? ([file] as unknown as FileList) : (null as unknown as FileList);
  const input = document.createElement('input');
  input.type = 'file';
  Object.defineProperty(input, 'files', { value: files, writable: false });
  return { target: input, currentTarget: input } as unknown as React.ChangeEvent<HTMLInputElement>;
}

function makeEmptyChangeEvent(): React.ChangeEvent<HTMLInputElement> {
  // What a cancelled file dialog leaves: an input with an empty file list.
  const input = document.createElement('input');
  input.type = 'file';
  Object.defineProperty(input, 'files', { value: [] as unknown as FileList, writable: false });
  return { target: input, currentTarget: input } as unknown as React.ChangeEvent<HTMLInputElement>;
}

// A browser's file input reports the picked file in its value until it is
// cleared; jsdom's cannot hold a file, so the input gets its own value here.
function makePickedFileEvent(file: File): React.ChangeEvent<HTMLInputElement> {
  const event = makeChangeEvent(file);
  let value = 'C:\\fakepath\\test.json';
  Object.defineProperty(event.target, 'value', {
    get: () => value,
    set: (v: string) => { value = v; },
    configurable: true,
  });
  return event;
}

/**
 * Holds every FileReader read until the test finishes it (with the file's real
 * content) or fails it (with the reader's error event), so a test can look at
 * the hook while a file is still being read. Call restore() when done.
 */
function holdFileReads() {
  const realReadAsText = FileReader.prototype.readAsText;
  const held: Array<{ reader: FileReader; blob: Blob }> = [];
  const spy = vi
    .spyOn(FileReader.prototype, 'readAsText')
    .mockImplementation(function (this: FileReader, blob: Blob) {
      held.push({ reader: this, blob });
    });
  const next = () => {
    const read = held.shift();
    if (!read) throw new Error('no read is being held');
    return read;
  };
  return {
    spy,
    finishNext: () => {
      const { reader, blob } = next();
      realReadAsText.call(reader, blob);
    },
    failNext: () => {
      next().reader.dispatchEvent(new ProgressEvent('error'));
    },
    restore: () => spy.mockRestore(),
  };
}

type HookResult = ReturnType<typeof setup>['result'];

/** Starts a pick inside act() and returns its promise without waiting for it. */
function startPick(result: HookResult, event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
  let pick: Promise<void> = Promise.resolve();
  act(() => {
    pick = result.current.handleImport(event) as unknown as Promise<void>;
  });
  return pick;
}

function previewIds(result: HookResult): string[] | undefined {
  return result.current.importPreview?.imported.appData.projects.map((p) => p.id);
}

// Picks an all-projects file holding these projects, opens the Replace All
// confirmation and confirms it.
async function replaceAllWith(result: HookResult, projects: Array<{ id: string; name: string }>) {
  await act(async () => {
    await result.current.handleImport(makeChangeEvent(makeFile({
      _exportType: 'ganttapp-all-projects',
      projects,
      releases: [],
    })));
  });
  act(() => {
    result.current.openReplaceAllConfirm();
  });
  await act(async () => {
    result.current.handleConfirmReplaceAll();
  });
}

const validProjectExport = {
  _exportType: 'ganttapp-project-export',
  projects: [{ id: 'p-new', name: 'New Project' }],
  releases: [],
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('useImportState — state machine', () => {
  // ────────────────────────────────────────────────────────────────────────
  // 1–2 Parse/file errors
  // ────────────────────────────────────────────────────────────────────────

  it('1. error banner on JSON parse failure', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(makeNonJsonFile()));
    });
    expect(result.current.importBanner?.kind).toBe('error');
    expect(result.current.importBanner?.text).toBe('Invalid file format');
    expect(result.current.importPreview).toBeNull();
    expect(result.current.applying).toBe(false);
  });

  it('2. error banner when parseImportedData returns null (missing projects array)', async () => {
    const { result } = setup();
    const malformed = { foo: 'bar' }; // no projects/releases arrays
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(makeFile(malformed)));
    });
    expect(result.current.importBanner?.kind).toBe('error');
    expect(result.current.importBanner?.text).toBe('Invalid file format');
  });

  // ────────────────────────────────────────────────────────────────────────
  // 3–4 Fast paths + cloud guard
  // ────────────────────────────────────────────────────────────────────────

  it('3. fast path fires in local mode, zero conflicts — no preview, success banner', async () => {
    const updateData = vi.fn();
    const onReplaceSnapshots = vi.fn().mockResolvedValue(undefined);
    const { result } = setup({ mode: 'local', updateData, onReplaceSnapshots });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(makeFile(validProjectExport)));
    });
    expect(result.current.importPreview).toBeNull();
    expect(result.current.importBanner?.kind).toBe('success');
    expect(updateData).toHaveBeenCalledTimes(1);
  });

  it('4. fast path SUPPRESSED in cloud mode → shows preview instead (pitfall #69)', async () => {
    const updateData = vi.fn();
    const { result } = setup({ mode: 'cloud', updateData });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(makeFile(validProjectExport)));
    });
    // Cloud + zero conflicts → preview, not fast-path apply.
    expect(result.current.importPreview).not.toBeNull();
    expect(result.current.importBanner).toBeNull();
    expect(updateData).not.toHaveBeenCalled();
  });

  // ────────────────────────────────────────────────────────────────────────
  // 5–9 Preview and decision flow
  // ────────────────────────────────────────────────────────────────────────

  it('5. shows preview when conflicts exist', async () => {
    const data = makeAppData({ projects: [{ id: 'p1', name: 'Existing' }] });
    const { result } = setup({ data });
    const file = makeFile({
      _exportType: 'ganttapp-project-export',
      projects: [{ id: 'p1', name: 'Incoming' }],
      releases: [],
    });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(file));
    });
    expect(result.current.importPreview).not.toBeNull();
    expect(result.current.importPreview!.conflicts.length).toBe(1);
    expect(result.current.importPreview!.conflicts[0].type).toBe('id');
  });

  it('6. ID conflict defaults to skip; name conflict defaults to copy (pitfall #22 / H1)', async () => {
    const data = makeAppData({
      projects: [
        { id: 'p1', name: 'Alpha' },
        { id: 'p4', name: 'Gamma' },
      ],
    });
    const { result } = setup({ data });
    const file = makeFile({
      _exportType: 'ganttapp-project-export',
      projects: [
        { id: 'p1', name: 'Alpha' },       // type:id, names match — defaults to 'skip' (v0.26.0)
        { id: 'p5', name: 'Gamma' },       // type:name (diff ID, same name) → 'copy'
      ],
      releases: [],
    });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(file));
    });
    const decisions = result.current.importPreview!.decisions;
    expect(decisions.get('p1')).toBe('skip');
    expect(decisions.get('p5')).toBe('copy');
  });

  it('7. handleConfirmMerge → success banner with correct counts', async () => {
    const data = makeAppData({ projects: [{ id: 'p1', name: 'Alpha' }] });
    const { result } = setup({ data });
    const file = makeFile({
      _exportType: 'ganttapp-project-export',
      projects: [
        { id: 'p1', name: 'Alpha' }, // ID conflict; default 'skip'
        { id: 'p2', name: 'Beta' },  // non-conflict → 'added'
      ],
      releases: [],
    });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(file));
    });
    await act(async () => {
      result.current.handleConfirmMerge();
    });
    expect(result.current.importBanner?.kind).toBe('success');
    expect(result.current.importBanner!.text).toContain('added');
    expect(result.current.importBanner!.text).toContain('skipped');
  });

  it('8. all-skip → banner shows skip count (pitfall #71)', async () => {
    const data = makeAppData({ projects: [{ id: 'p1', name: 'Alpha' }] });
    const { result } = setup({ data });
    const file = makeFile({
      _exportType: 'ganttapp-project-export',
      projects: [{ id: 'p1', name: 'Alpha' }], // ID conflict → defaults to skip
      releases: [],
    });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(file));
    });
    await act(async () => {
      result.current.handleConfirmMerge();
    });
    expect(result.current.importBanner?.kind).toBe('success');
    expect(result.current.importBanner!.text).toMatch(/1 skipped/);
  });

  it('9. Cancel from preview → idle: no preview, no banner', async () => {
    const data = makeAppData({ projects: [{ id: 'p1', name: 'Alpha' }] });
    const { result } = setup({ data });
    const file = makeFile({
      _exportType: 'ganttapp-project-export',
      projects: [{ id: 'p1', name: 'Alpha' }],
      releases: [],
    });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(file));
    });
    expect(result.current.importPreview).not.toBeNull();
    act(() => {
      result.current.handleImportCancel();
    });
    expect(result.current.importPreview).toBeNull();
    expect(result.current.importBanner).toBeNull();
    expect(result.current.applying).toBe(false);
  });

  // ────────────────────────────────────────────────────────────────────────
  // 10–12 Drift and apply safety
  // ────────────────────────────────────────────────────────────────────────

  it('10. drift abort → error banner when conflicts change between preview and confirm', async () => {
    // Open preview against data with 1 conflict; mutate data so the conflict
    // set differs; confirm should drift-abort.
    const initialData = makeAppData({ projects: [{ id: 'p1', name: 'Alpha' }] });
    const { result, rerender } = setup({ data: initialData });
    const file = makeFile({
      _exportType: 'ganttapp-project-export',
      projects: [{ id: 'p1', name: 'Alpha' }],
      releases: [],
    });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(file));
    });
    expect(result.current.importPreview).not.toBeNull();

    // Mutate the data closure (simulate peer delete).
    const driftedData = makeAppData({ projects: [] }); // 'p1' deleted
    rerender({ dataOverride: driftedData });

    await act(async () => {
      result.current.handleConfirmMerge();
    });
    expect(result.current.importBanner?.kind).toBe('error');
    expect(result.current.importBanner!.text).toMatch(/workspace changed/);
  });

  it('11. applying=false after successful apply (try/finally — pitfall #27)', async () => {
    const { result } = setup({ mode: 'local' });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(makeFile(validProjectExport)));
    });
    expect(result.current.applying).toBe(false);
  });

  it('12. applying=false after failed apply (try/finally — pitfall #27)', async () => {
    const data = makeAppData({ projects: [{ id: 'p1', name: 'Alpha' }] });
    const onReplaceSnapshots = vi.fn().mockRejectedValue(new Error('write failed'));
    const { result } = setup({ data, onReplaceSnapshots });
    const file = makeFile({
      _exportType: 'ganttapp-project-export',
      projects: [{ id: 'p2', name: 'Beta' }],
      releases: [],
    });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(file));
    });
    await act(async () => {
      result.current.handleConfirmMerge();
    });
    // Apply failed; banner is error; applying must have reset.
    expect(result.current.importBanner?.kind).toBe('error');
    expect(result.current.applying).toBe(false);
  });

  // v0.28.10 — SITE 3 GUARD. This is the reason useSnapshots.replaceAllSnapshots
  // is deliberately left WITHOUT a try/catch while its four siblings gained one.
  //
  // A rejected onReplaceSnapshots is already surfaced here, with its message, by
  // this hook's own catch. Catching inside the hook instead would stop the
  // rejection propagating, control would fall through to the SUCCESS banner, and
  // the user would be told the import worked while the snapshot write had failed.
  // If this test ever fails, do not "fix" the hook — read the deleted comment.
  it('12b. rejected onReplaceSnapshots surfaces its message via the error banner (v0.28.10)', async () => {
    const quotaText = 'Storage quota exceeded. Please export your data and clear some space.';
    const data = makeAppData({ projects: [{ id: 'p1', name: 'Alpha' }] });
    const onReplaceSnapshots = vi.fn().mockRejectedValue(new Error(quotaText));
    const { result } = setup({ data, onReplaceSnapshots });
    const file = makeFile({
      _exportType: 'ganttapp-project-export',
      projects: [{ id: 'p2', name: 'Beta' }],
      releases: [],
    });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(file));
    });
    await act(async () => {
      result.current.handleConfirmMerge();
    });

    expect(onReplaceSnapshots).toHaveBeenCalled();
    expect(result.current.importBanner?.kind).toBe('error');
    // Not a generic message, and emphatically not a success banner.
    expect(result.current.importBanner?.text).toBe(quotaText);
  });

  // ────────────────────────────────────────────────────────────────────────
  // 13a–13b Reentrancy guards (NEW-6 split)
  // ────────────────────────────────────────────────────────────────────────

  it('13a. same-tick double-click: applyingRef blocks second call (definitive)', async () => {
    // Two handleConfirmMerge calls inside ONE act() — React hasn't committed
    // applying=true yet, so the handler's own `applying` check passes both
    // times; only applyingRef in the apply can stop the second.
    // Cloud mode, so this file opens a preview. In local mode it takes the
    // fast path at pick time, Confirm has no preview to confirm, and both
    // calls return before they reach the apply.
    const data = makeAppData({ projects: [{ id: 'p1', name: 'Alpha' }] });
    const loadSnapshotsStrict = vi.fn(() => Promise.resolve<Snapshot[]>([]));
    const onReplaceSnapshots = vi.fn().mockResolvedValue(undefined);
    const { result, updateData } = setup({ data, mode: 'cloud', loadSnapshotsStrict, onReplaceSnapshots });
    const file = makeFile({
      _exportType: 'ganttapp-project-export',
      projects: [{ id: 'p2', name: 'Beta' }],
      releases: [],
    });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(file));
    });
    expect(previewIds(result)).toEqual(['p2']);
    await act(async () => {
      result.current.handleConfirmMerge();
      result.current.handleConfirmMerge(); // same tick
    });
    // The apply ran to the end, and only once.
    expect(result.current.importBanner).toEqual({ kind: 'success', text: '1 project added.' });
    expect(loadSnapshotsStrict).toHaveBeenCalledTimes(1);
    expect(updateData).toHaveBeenCalledTimes(1);
    expect(onReplaceSnapshots).toHaveBeenCalledTimes(1);
  });

  it('13b. post-commit double-click: applying state blocks second call (UI-layer guard)', async () => {
    // First confirm completes (commit). Second confirm sees applying=false
    // because the apply finished — but importPreview is null after the first
    // success path resolved (showBanner clears it). The if (!importPreview) return
    // is what actually blocks the second call here. We assert no second
    // updateData call.
    const data = makeAppData({ projects: [{ id: 'p1', name: 'Alpha' }] });
    const { result, updateData } = setup({ data });
    const file = makeFile({
      _exportType: 'ganttapp-project-export',
      projects: [{ id: 'p2', name: 'Beta' }],
      releases: [],
    });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(file));
    });
    // Confirm 1 — separate act() block so React commits.
    await act(async () => {
      result.current.handleConfirmMerge();
    });
    // Confirm 2 — importPreview is now null, second call no-ops.
    await act(async () => {
      result.current.handleConfirmMerge();
    });
    expect(updateData).toHaveBeenCalledTimes(1);
  });

  // ────────────────────────────────────────────────────────────────────────
  // 14 readerPendingRef
  // ────────────────────────────────────────────────────────────────────────

  it('14. readerPendingRef: concurrent file picks during read are ignored (pitfall #48)', async () => {
    // The first pick's read is held open, so the second pick lands while it is
    // still pending. The second pick must start no reader of its own, and only
    // the first file's project may land.
    const reads = holdFileReads();
    try {
      const { result, updateData } = setup({ mode: 'local' });
      const file1 = makeFile(validProjectExport);
      const file2 = makeFile({
        _exportType: 'ganttapp-project-export',
        projects: [{ id: 'pX', name: 'Second' }],
        releases: [],
      });
      const pick1 = startPick(result, makeChangeEvent(file1));
      const pick2 = startPick(result, makeChangeEvent(file2));
      // The first read is under way; the second pick started none.
      expect(result.current.applying).toBe(true);
      expect(reads.spy).toHaveBeenCalledTimes(1);
      expect(reads.spy.mock.calls[0][0]).toBe(file1);

      await act(async () => {
        reads.finishNext();
        await Promise.all([pick1, pick2]);
      });
      expect(result.current.importBanner).toEqual({ kind: 'success', text: '1 project added.' });
      expect(updateData).toHaveBeenCalledTimes(1);
      expect(vi.mocked(updateData).mock.calls[0][0].projects.map((p) => p.id)).toEqual(['p-new']);
      expect(result.current.applying).toBe(false);
    } finally {
      reads.restore();
    }
  });

  // ────────────────────────────────────────────────────────────────────────
  // 15–17 Decision state management
  // ────────────────────────────────────────────────────────────────────────

  it('15. mode toggle preserves decisions (pitfall #17)', async () => {
    // Trigger a preview, then change a decision, then toggle mode — decision survives.
    const data = makeAppData({ projects: [{ id: 'p1', name: 'Alpha' }] });
    const { result } = setup({ data });
    const file = makeFile({
      _exportType: 'ganttapp-all-projects',
      projects: [{ id: 'p1', name: 'Alpha' }],
      releases: [],
    });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(file));
    });
    act(() => {
      result.current.onDecisionChange('p1', 'replace');
    });
    expect(result.current.importPreview!.decisions.get('p1')).toBe('replace');
    act(() => {
      result.current.onModeChange('replace-all');
    });
    // Mode changed; decision unchanged.
    expect(result.current.importPreview!.mode).toBe('replace-all');
    expect(result.current.importPreview!.decisions.get('p1')).toBe('replace');
  });

  it('16. onDecisionChange produces a new Map reference (pitfall #19)', async () => {
    const data = makeAppData({ projects: [{ id: 'p1', name: 'Alpha' }] });
    const { result } = setup({ data });
    const file = makeFile({
      _exportType: 'ganttapp-project-export',
      projects: [{ id: 'p1', name: 'Alpha' }],
      releases: [],
    });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(file));
    });
    const before = result.current.importPreview!.decisions;
    act(() => {
      result.current.onDecisionChange('p1', 'replace');
    });
    const after = result.current.importPreview!.decisions;
    expect(after).not.toBe(before); // new reference
    expect(after.get('p1')).toBe('replace');
  });

  it('17. stale banner AND stale preview cleared at file-pick start, while the file is still being read (pitfall #79 + NEW-8)', async () => {
    // Every read is held, so each pick can be checked while its file is still
    // being read: whatever the read ends in replaces the old state anyway, so
    // only a look during the read shows the pick itself cleared it. Cloud mode,
    // so a valid file opens a preview, which is the third pick's stale state.
    const reads = holdFileReads();
    try {
      const { result } = setup({ mode: 'cloud' });

      // First pick → error banner.
      let pick = startPick(result, makeChangeEvent(makeNonJsonFile()));
      await act(async () => {
        reads.finishNext();
        await pick;
      });
      expect(result.current.importBanner).toEqual({ kind: 'error', text: 'Invalid file format' });

      // Second pick: the stale banner is gone before its file has been read.
      pick = startPick(result, makeChangeEvent(makeFile(validProjectExport)));
      expect(result.current.applying).toBe(true);
      expect(result.current.importBanner).toBeNull();
      await act(async () => {
        reads.finishNext();
        await pick;
      });
      expect(previewIds(result)).toEqual(['p-new']);

      // Third pick: the stale preview is gone before its file has been read.
      pick = startPick(result, makeChangeEvent(makeFile({
        _exportType: 'ganttapp-project-export',
        projects: [{ id: 'p-third', name: 'Third' }],
        releases: [],
      })));
      expect(result.current.applying).toBe(true);
      expect(result.current.importPreview).toBeNull();
      await act(async () => {
        reads.finishNext();
        await pick;
      });
      expect(previewIds(result)).toEqual(['p-third']);
    } finally {
      reads.restore();
    }
  });

  // ────────────────────────────────────────────────────────────────────────
  // 18–20 handleConfirmReplaceAll
  // ────────────────────────────────────────────────────────────────────────

  it('18. handleConfirmReplaceAll → applies replace-all and shows success banner', async () => {
    const data = makeAppData({ projects: [{ id: 'p1', name: 'Existing' }] });
    const { result, updateData } = setup({ data });
    const file = makeFile({
      _exportType: 'ganttapp-all-projects',
      projects: [{ id: 'p2', name: 'New' }],
      releases: [],
    });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(file));
    });
    // Preview is showing in merge mode by default for ganttapp-all-projects.
    act(() => {
      result.current.openReplaceAllConfirm();
    });
    expect(result.current.replaceAllPending).toBe(true);
    await act(async () => {
      result.current.handleConfirmReplaceAll();
    });
    expect(updateData).toHaveBeenCalledTimes(1);
    expect(result.current.importBanner?.kind).toBe('success');
    expect(result.current.importBanner!.text).toContain('replaced');
    expect(result.current.replaceAllPending).toBe(false);
  });

  it('19. handleConfirmReplaceAll double-click guard (applyingRef + importPreview null)', async () => {
    const data = makeAppData({ projects: [{ id: 'p1', name: 'Existing' }] });
    const { result, updateData } = setup({ data });
    const file = makeFile({
      _exportType: 'ganttapp-all-projects',
      projects: [{ id: 'p2', name: 'New' }],
      releases: [],
    });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(file));
    });
    act(() => {
      result.current.openReplaceAllConfirm();
    });
    await act(async () => {
      result.current.handleConfirmReplaceAll();
      result.current.handleConfirmReplaceAll(); // same tick
    });
    expect(updateData).toHaveBeenCalledTimes(1);
  });

  it('20. cancelReplaceAllConfirm: replaceAllPending=false, importPreview intact', async () => {
    const data = makeAppData({ projects: [{ id: 'p1', name: 'Existing' }] });
    const { result } = setup({ data });
    const file = makeFile({
      _exportType: 'ganttapp-all-projects',
      projects: [{ id: 'p2', name: 'New' }],
      releases: [],
    });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(file));
    });
    act(() => {
      result.current.openReplaceAllConfirm();
    });
    expect(result.current.replaceAllPending).toBe(true);
    expect(result.current.importPreview).not.toBeNull();
    act(() => {
      result.current.cancelReplaceAllConfirm();
    });
    expect(result.current.replaceAllPending).toBe(false);
    expect(result.current.importPreview).not.toBeNull(); // preview survives
  });

  // ────────────────────────────────────────────────────────────────────────
  // 21–25 The merge's result: selection and banner text
  // ────────────────────────────────────────────────────────────────────────

  it('21. a replace decision on a name conflict moves the selection to the project that replaced it', async () => {
    const data = makeAppData({ projects: [{ id: 'p1', name: 'Alpha' }] });
    const { result, updateData, setSelectedProjectId } = setup({ data, selectedProjectId: 'p1' });
    const file = makeFile({
      _exportType: 'ganttapp-project-export',
      projects: [{ id: 'p9', name: 'Alpha' }], // same name, other id → name conflict
      releases: [],
    });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(file));
    });
    expect(result.current.importPreview?.conflicts.map((c) => c.type)).toEqual(['name']);
    act(() => {
      result.current.onDecisionChange('p9', 'replace');
    });
    await act(async () => {
      result.current.handleConfirmMerge();
    });
    expect(result.current.importBanner).toEqual({ kind: 'success', text: '1 replaced.' });
    expect(vi.mocked(updateData).mock.calls[0][0].projects.map((p) => p.id)).toEqual(['p9']);
    // The selected project p1 is gone; the selection follows it to p9.
    expect(setSelectedProjectId).toHaveBeenCalledTimes(1);
    expect(setSelectedProjectId).toHaveBeenCalledWith('p9');
  });

  it('22. a merge banner says "2 projects added" for two and "1 project added" for one', async () => {
    const two = setup({ mode: 'local' });
    await act(async () => {
      await two.result.current.handleImport(makeChangeEvent(makeFile({
        _exportType: 'ganttapp-project-export',
        projects: [{ id: 'p-a', name: 'A' }, { id: 'p-b', name: 'B' }],
        releases: [],
      })));
    });
    expect(two.result.current.importBanner).toEqual({ kind: 'success', text: '2 projects added.' });

    const one = setup({ mode: 'local' });
    await act(async () => {
      await one.result.current.handleImport(makeChangeEvent(makeFile(validProjectExport)));
    });
    expect(one.result.current.importBanner).toEqual({ kind: 'success', text: '1 project added.' });
  });

  it('23. a merge banner joins its parts with a comma', async () => {
    const data = makeAppData({ projects: [{ id: 'p1', name: 'Alpha' }] });
    const { result } = setup({ data });
    const file = makeFile({
      _exportType: 'ganttapp-project-export',
      projects: [
        { id: 'p1', name: 'Alpha' }, // ID conflict; default 'skip'
        { id: 'p2', name: 'Beta' },  // no conflict → added
      ],
      releases: [],
    });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(file));
    });
    await act(async () => {
      result.current.handleConfirmMerge();
    });
    expect(result.current.importBanner).toEqual({ kind: 'success', text: '1 project added, 1 skipped.' });
  });

  it('24. a merge banner counts the copies it made', async () => {
    const data = makeAppData({
      projects: [
        { id: 'p1', name: 'Alpha' },
        { id: 'p2', name: 'Beta' },
      ],
    });
    const { result, updateData } = setup({ data });
    const file = makeFile({
      _exportType: 'ganttapp-project-export',
      projects: [
        { id: 'p8', name: 'Alpha' }, // name conflicts; default 'copy'
        { id: 'p9', name: 'Beta' },
      ],
      releases: [],
    });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(file));
    });
    await act(async () => {
      result.current.handleConfirmMerge();
    });
    expect(vi.mocked(updateData).mock.calls[0][0].projects.map((p) => p.name)).toEqual([
      'Alpha', 'Beta', 'Alpha (2)', 'Beta (2)',
    ]);
    expect(result.current.importBanner).toEqual({ kind: 'success', text: '2 copied.' });
  });

  it('25. a merge of a file with no projects says "No projects were imported."', async () => {
    const { result, updateData } = setup({ mode: 'local' });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(makeFile({
        _exportType: 'ganttapp-project-export',
        projects: [],
        releases: [],
      })));
    });
    // The merge ran (fast path: no conflicts, local mode) and changed nothing.
    expect(updateData).toHaveBeenCalledTimes(1);
    expect(vi.mocked(updateData).mock.calls[0][0].projects).toEqual([]);
    expect(result.current.importBanner).toEqual({ kind: 'success', text: 'No projects were imported.' });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 26–27 Replace All's result
  // ────────────────────────────────────────────────────────────────────────

  it('26. Replace All with a file of no projects says "All data replaced." and leaves the selection alone', async () => {
    const data = makeAppData({ projects: [{ id: 'p1', name: 'Existing' }] });
    const { result, updateData, setSelectedProjectId } = setup({ data, selectedProjectId: 'p1' });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(makeFile({
        _exportType: 'ganttapp-all-projects',
        projects: [],
        releases: [],
      })));
    });
    expect(previewIds(result)).toEqual([]);
    act(() => {
      result.current.openReplaceAllConfirm();
    });
    await act(async () => {
      result.current.handleConfirmReplaceAll();
    });
    expect(vi.mocked(updateData).mock.calls[0][0].projects).toEqual([]);
    expect(result.current.importBanner).toEqual({ kind: 'success', text: 'All data replaced.' });
    expect(setSelectedProjectId).not.toHaveBeenCalled();
  });

  it('27. Replace All whose snapshot write fails shows an error banner, not a success', async () => {
    const onReplaceSnapshots = vi.fn().mockRejectedValue(new Error('The disk is full.'));
    const { result, updateData } = setup({ mode: 'local', onReplaceSnapshots });
    // An empty local workspace: the file is applied at pick time (Replace All fast path).
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(makeFile({
        _exportType: 'ganttapp-all-projects',
        projects: [{ id: 'p2', name: 'New' }],
        releases: [],
      })));
    });
    expect(updateData).toHaveBeenCalledTimes(1);
    expect(onReplaceSnapshots).toHaveBeenCalledTimes(1);
    expect(result.current.importBanner?.text).toBe('The disk is full.');
    expect(result.current.importBanner?.kind).toBe('error');
  });

  // ────────────────────────────────────────────────────────────────────────
  // 28–30 The file pick itself
  // ────────────────────────────────────────────────────────────────────────

  it('28. a change with no file (a cancelled file dialog) leaves the import as it was', async () => {
    const data = makeAppData({ projects: [{ id: 'p1', name: 'Alpha' }] });
    const { result } = setup({ data, mode: 'cloud' });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(makeFile({
        _exportType: 'ganttapp-project-export',
        projects: [{ id: 'p2', name: 'Beta' }],
        releases: [],
      })));
    });
    const preview = result.current.importPreview;
    expect(previewIds(result)).toEqual(['p2']);

    await act(async () => {
      await result.current.handleImport(makeEmptyChangeEvent());
    });
    expect(result.current.importPreview).toBe(preview);
    expect(result.current.importBanner).toBeNull();
    expect(result.current.applying).toBe(false);
  });

  it('29. a file that cannot be read shows "Error importing file" and ends the busy state', async () => {
    const reads = holdFileReads();
    try {
      const { result, updateData } = setup({ mode: 'local' });
      const pick = startPick(result, makeChangeEvent(makeFile(validProjectExport)));
      expect(result.current.applying).toBe(true);
      await act(async () => {
        reads.failNext();
        await pick;
      });
      expect(result.current.importBanner).toEqual({ kind: 'error', text: 'Error importing file' });
      expect(result.current.applying).toBe(false);
      expect(updateData).not.toHaveBeenCalled();
    } finally {
      reads.restore();
    }
  });

  it('30. after a file that cannot be read, the next import still runs', async () => {
    const { result, updateData } = setup({ mode: 'local' });
    const reads = holdFileReads();
    try {
      const pick = startPick(result, makeChangeEvent(makeFile({
        _exportType: 'ganttapp-project-export',
        projects: [{ id: 'p-unread', name: 'Unread' }],
        releases: [],
      })));
      await act(async () => {
        reads.failNext();
        await pick;
      });
      expect(result.current.importBanner?.text).toBe('Error importing file');
    } finally {
      reads.restore();
    }
    // Reads are real again: the next pick reads its file and imports it.
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(makeFile(validProjectExport)));
    });
    expect(result.current.importBanner).toEqual({ kind: 'success', text: '1 project added.' });
    expect(updateData).toHaveBeenCalledTimes(1);
    expect(vi.mocked(updateData).mock.calls[0][0].projects.map((p) => p.id)).toEqual(['p-new']);
  });

  // ────────────────────────────────────────────────────────────────────────
  // 31–35 Confirm, Replace All and the file input
  // ────────────────────────────────────────────────────────────────────────

  it('31. a conflict that changed since the preview stops Confirm before the snapshot load', async () => {
    // Aborting the whole import when a conflict changed since the preview is a
    // known deviation (docs/SPEC_DEVIATIONS.md SD-5: the spec asks for a
    // per-decision fallback), and a fix of it will change this test. The part
    // that says the strict snapshot load is not called does not depend on that:
    // the check before the load is what stops it. The same message also comes
    // from the repeat of this check after the load, so only the load tells the
    // two apart.
    const before = makeAppData({ projects: [{ id: 'p1', name: 'Alpha' }] });
    const loadSnapshotsStrict = vi.fn(() => Promise.resolve<Snapshot[]>([]));
    const { result, rerender, updateData, onReplaceSnapshots } = setup({ data: before, loadSnapshotsStrict });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(makeFile({
        _exportType: 'ganttapp-project-export',
        projects: [{ id: 'p9', name: 'Alpha' }], // name conflict with p1
        releases: [],
      })));
    });
    expect(result.current.importPreview?.conflicts.map((c) => c.type)).toEqual(['name']);

    // Someone renames p1 while the preview is open: the conflict is gone.
    rerender({ dataOverride: makeAppData({ projects: [{ id: 'p1', name: 'Alpha (old)' }] }) });
    await act(async () => {
      result.current.handleConfirmMerge();
    });
    expect(result.current.importBanner).toEqual({
      kind: 'error',
      text: 'The workspace changed while the preview was open. Please review your import again.',
    });
    expect(loadSnapshotsStrict).not.toHaveBeenCalled();
    expect(updateData).not.toHaveBeenCalled();
    expect(onReplaceSnapshots).not.toHaveBeenCalled();
  });

  it('31b. a conflict replaced by another, so their number is the same, also stops Confirm before the snapshot load', async () => {
    // As in test 31, the abort is the deviation SD-5 records, and only the
    // strict load tells the check before the load from its repeat after it.
    // Here the number of conflicts does not change, only which project the
    // file's project conflicts with.
    const before = makeAppData({ projects: [{ id: 'p1', name: 'Alpha' }, { id: 'p2', name: 'Beta' }] });
    const loadSnapshotsStrict = vi.fn(() => Promise.resolve<Snapshot[]>([]));
    const { result, rerender, updateData, onReplaceSnapshots } = setup({ data: before, loadSnapshotsStrict });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(makeFile({
        _exportType: 'ganttapp-project-export',
        projects: [{ id: 'p9', name: 'Alpha' }], // name conflict with p1
        releases: [],
      })));
    });
    expect(result.current.importPreview?.conflicts.map((c) => [c.type, c.existingProject.id])).toEqual([['name', 'p1']]);

    // While the preview is open, p1 is renamed away and p2 is renamed to the
    // file's name: still one name conflict, now with p2.
    rerender({ dataOverride: makeAppData({ projects: [{ id: 'p1', name: 'Alpha (old)' }, { id: 'p2', name: 'Alpha' }] }) });
    await act(async () => {
      result.current.handleConfirmMerge();
    });
    expect(result.current.importBanner).toEqual({
      kind: 'error',
      text: 'The workspace changed while the preview was open. Please review your import again.',
    });
    expect(loadSnapshotsStrict).not.toHaveBeenCalled();
    expect(updateData).not.toHaveBeenCalled();
    expect(onReplaceSnapshots).not.toHaveBeenCalled();
  });

  it('32. no fast Replace All while the workspace is still loading: the preview shows instead', async () => {
    const { result, updateData, onReplaceSnapshots } = setup({ mode: 'local', appDataLoading: true });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(makeFile({
        _exportType: 'ganttapp-all-projects',
        projects: [{ id: 'p2', name: 'New' }],
        releases: [],
      })));
    });
    expect(previewIds(result)).toEqual(['p2']);
    expect(result.current.importPreview?.mode).toBe('merge');
    expect(result.current.importBanner).toBeNull();
    expect(updateData).not.toHaveBeenCalled();
    expect(onReplaceSnapshots).not.toHaveBeenCalled();
  });

  it('33. Replace All closes its confirmation before the apply starts', async () => {
    let finishWrite: () => void = () => {};
    const onReplaceSnapshots = vi.fn(() => new Promise<void>((resolve) => { finishWrite = resolve; }));
    const data = makeAppData({ projects: [{ id: 'p1', name: 'Existing' }] });
    const { result, updateData } = setup({ data, onReplaceSnapshots });
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(makeFile({
        _exportType: 'ganttapp-all-projects',
        projects: [{ id: 'p2', name: 'New' }],
        releases: [],
      })));
    });
    act(() => {
      result.current.openReplaceAllConfirm();
    });
    expect(result.current.replaceAllPending).toBe(true);

    act(() => {
      result.current.handleConfirmReplaceAll();
    });
    // The apply is under way (its snapshot write is still pending), and the
    // confirmation is already closed.
    expect(updateData).toHaveBeenCalledTimes(1);
    expect(onReplaceSnapshots).toHaveBeenCalledTimes(1);
    expect(result.current.applying).toBe(true);
    expect(result.current.importBanner).toBeNull();
    expect(result.current.replaceAllPending).toBe(false);

    await act(async () => {
      finishWrite();
    });
    expect(result.current.importBanner).toEqual({ kind: 'success', text: 'All data replaced. 1 project imported.' });
  });

  it('34. a banner clears the file input, so the same file can be picked again', async () => {
    const { result } = setup();
    const event = makePickedFileEvent(makeNonJsonFile());
    expect(event.target.value).toBe('C:\\fakepath\\test.json');
    await act(async () => {
      await result.current.handleImport(event);
    });
    expect(result.current.importBanner).toEqual({ kind: 'error', text: 'Invalid file format' });
    expect(event.target.value).toBe('');
  });

  it('34b. a success banner clears the file input too', async () => {
    const { result } = setup();
    const event = makePickedFileEvent(makeFile(validProjectExport));
    expect(event.target.value).toBe('C:\\fakepath\\test.json');
    await act(async () => {
      await result.current.handleImport(event);
    });
    expect(result.current.importBanner?.kind).toBe('success');
    expect(event.target.value).toBe('');
  });

  it('35. a second Replace All runs after the first one finished', async () => {
    const data = makeAppData({ projects: [{ id: 'p1', name: 'Existing' }] });
    const { result, updateData, setSelectedProjectId } = setup({ data });

    await replaceAllWith(result, [{ id: 'p2', name: 'First' }]);
    expect(result.current.importBanner).toEqual({ kind: 'success', text: 'All data replaced. 1 project imported.' });

    await replaceAllWith(result, [{ id: 'p3', name: 'Second' }, { id: 'p4', name: 'Third' }]);
    expect(result.current.importBanner).toEqual({ kind: 'success', text: 'All data replaced. 2 projects imported.' });
    expect(updateData).toHaveBeenCalledTimes(2);
    expect(vi.mocked(updateData).mock.calls[1][0].projects.map((p) => p.id)).toEqual(['p3', 'p4']);
    expect(setSelectedProjectId).toHaveBeenLastCalledWith('p3');
  });

  it('35b. a Replace All runs after an earlier one failed', async () => {
    const data = makeAppData({ projects: [{ id: 'p1', name: 'Existing' }] });
    const onReplaceSnapshots = vi.fn()
      .mockRejectedValueOnce(new Error('Snapshot write failed'))
      .mockResolvedValue(undefined);
    const { result, updateData, setSelectedProjectId } = setup({ data, onReplaceSnapshots });

    await replaceAllWith(result, [{ id: 'p2', name: 'First' }]);
    expect(result.current.importBanner).toEqual({ kind: 'error', text: 'Snapshot write failed' });

    await replaceAllWith(result, [{ id: 'p3', name: 'Second' }]);
    expect(result.current.importBanner).toEqual({ kind: 'success', text: 'All data replaced. 1 project imported.' });
    expect(onReplaceSnapshots).toHaveBeenCalledTimes(2);
    expect(vi.mocked(updateData).mock.calls[1][0].projects.map((p) => p.id)).toEqual(['p3']);
    expect(setSelectedProjectId).toHaveBeenLastCalledWith('p3');
  });

  it('35c. a Replace All runs after an earlier one was refused', async () => {
    const data = makeAppData({ projects: [{ id: 'p1', name: 'Existing' }] });
    const { result, storage, updateData, setSelectedProjectId } = setup({ data });

    storage.canWrite = () => false;
    await replaceAllWith(result, [{ id: 'p2', name: 'First' }]);
    expect(result.current.importBanner?.kind).toBe('error');
    expect(updateData).not.toHaveBeenCalled();

    storage.canWrite = () => true;
    await replaceAllWith(result, [{ id: 'p3', name: 'Second' }]);
    expect(result.current.importBanner).toEqual({ kind: 'success', text: 'All data replaced. 1 project imported.' });
    expect(updateData).toHaveBeenCalledTimes(1);
    expect(vi.mocked(updateData).mock.calls[0][0].projects.map((p) => p.id)).toEqual(['p3']);
    expect(setSelectedProjectId).toHaveBeenLastCalledWith('p3');
  });
});

describe('withImportOwners', () => {
  it('in cloud mode, a project the workspace holds without an owner stays without one', () => {
    // The app's paths do not reach this case today: every cloud project loads
    // with its owner, and local mode passes no uid. The function's comment
    // promises it, so it is tested here directly.
    const workspace = makeAppData({ projects: [{ id: 'p-held', name: 'Held' }] });
    const imported = makeAppData({
      projects: [
        // Export writes no owner, but a hand-edited file can carry one.
        { id: 'p-held', name: 'Held, from the file', owner: 'uid-other' },
        { id: 'p-new', name: 'New' },
      ],
    });
    const out = withImportOwners(imported, workspace, 'uid-me');
    const byId = new Map(out.projects.map((p) => [p.id, p] as const));
    // An owner uid was passed: a project the workspace does not hold gets it.
    expect(byId.get('p-new')?.owner).toBe('uid-me');
    // The held project has no owner, not even an undefined one, and not the file's.
    expect(byId.get('p-held')?.name).toBe('Held, from the file');
    expect(Object.keys(byId.get('p-held') ?? {}).sort()).toEqual(['id', 'name']);
  });
});

describe('withFreshImportIds', () => {
  it('in cloud mode, gives each release and snapshot of a project the workspace does not hold an id of its own', () => {
    const release = (id: string, projectId: string) => ({
      id, projectId, name: `Release ${id}`, startDate: '2026-01-05', earlyFinishDate: '2026-02-02', lateFinishDate: '2026-03-02',
    });
    const snapshot = (id: string, projectId: string): Snapshot => ({
      id, projectId, name: `Snapshot ${id}`, timestamp: '2026-01-01T00:00:00Z', releases: [],
    });
    const workspace = makeAppData({ projects: [{ id: 'p-held', name: 'Held' }] });
    const imported: ImportResult = {
      exportType: 'ganttapp-project-export',
      appData: makeAppData({
        projects: [{ id: 'p-new', name: 'New' }, { id: 'p-held', name: 'Held, from the file' }],
        releases: [release('r1', 'p-new'), release('r2', 'p-new'), release('r-held', 'p-held')],
      }),
      snapshots: [snapshot('s1', 'p-new'), snapshot('s2', 'p-new'), snapshot('s-held', 'p-held')],
    };
    const fileIds = ['p-new', 'p-held', 'r1', 'r2', 'r-held', 's1', 's2', 's-held'];

    const out = withFreshImportIds(imported, workspace, 'uid-me').imported;
    const newProjectId = out.appData.projects[0].id;
    expect(fileIds).not.toContain(newProjectId);
    expect(out.appData.projects[0].name).toBe('New');

    // Both releases and both snapshots of the new project follow it, each with
    // an id of its own: none shared, none the project's, none from the file.
    const renewed = [
      ...out.appData.releases.filter((r) => r.projectId === newProjectId),
      ...(out.snapshots ?? []).filter((s) => s.projectId === newProjectId),
    ];
    expect(renewed.map((item) => item.name)).toEqual(['Release r1', 'Release r2', 'Snapshot s1', 'Snapshot s2']);
    const ids = renewed.map((item) => item.id);
    expect(new Set(ids).size).toBe(4);
    expect(ids).not.toContain(newProjectId);
    expect(ids.filter((id) => fileIds.includes(id))).toEqual([]);

    // The held project, its release and its snapshot keep their ids.
    expect(out.appData.projects[1]).toEqual({ id: 'p-held', name: 'Held, from the file' });
    expect(out.appData.releases.filter((r) => r.projectId === 'p-held')).toEqual([release('r-held', 'p-held')]);
    expect((out.snapshots ?? []).filter((s) => s.projectId === 'p-held')).toEqual([snapshot('s-held', 'p-held')]);
  });
});
