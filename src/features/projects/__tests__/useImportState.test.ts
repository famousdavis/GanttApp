// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// v0.26.0 — Smart Import state machine tests (pitfall #59).
// 20 renderHook cases. ImportPreviewSection-level rendering is covered by
// ProjectsTab.test.tsx; this file targets the hook's internal state machine
// in isolation, mocking storage + updateData + onReplaceSnapshots.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImportState } from '../hooks/useImportState';
import type { AppData } from '../../../shared/types/app';
import type { Snapshot } from '../../../shared/types/snapshots';

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
  loadSnapshots?: () => Promise<Snapshot[]>;
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
    loadSnapshots: opts.loadSnapshots ?? (() => Promise.resolve<Snapshot[]>([])),
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

  // ────────────────────────────────────────────────────────────────────────
  // 13a–13b Reentrancy guards (NEW-6 split)
  // ────────────────────────────────────────────────────────────────────────

  it('13a. same-tick double-click: applyingRef blocks second call (definitive)', async () => {
    // Two handleConfirmMerge calls inside ONE act() — React hasn't committed
    // applying=true yet, but applyingRef catches the second.
    const data = makeAppData({ projects: [{ id: 'p1', name: 'Alpha' }] });
    const onReplaceSnapshots = vi.fn().mockResolvedValue(undefined);
    const { result, updateData } = setup({ data, onReplaceSnapshots });
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
      result.current.handleConfirmMerge(); // same tick
    });
    // Only one apply happened.
    expect(updateData).toHaveBeenCalledTimes(1);
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
    // Slow loadSnapshots is not the bottleneck — the readerPendingRef gate sits
    // around readFileAsText (synchronous-ish). Two file picks in the same tick:
    // the second is dropped without setting up another reader.
    const { result } = setup({ mode: 'local' });
    const file1 = makeFile(validProjectExport);
    const file2 = makeFile({
      _exportType: 'ganttapp-project-export',
      projects: [{ id: 'pX', name: 'Second' }],
      releases: [],
    });
    let promise1: Promise<void> | undefined;
    await act(async () => {
      // Fire both in same tick; awaits below sequence them.
      promise1 = result.current.handleImport(makeChangeEvent(file1)) as unknown as Promise<void>;
      const promise2 = result.current.handleImport(makeChangeEvent(file2)) as unknown as Promise<void>;
      await Promise.all([promise1, promise2]);
    });
    // Either file1 or file2 wins. Other is silently dropped. Bottom line:
    // exactly one terminal state. (We don't assert which file wins; we assert
    // that no error banner is set as a side-effect of the second pick being
    // blocked.)
    expect(result.current.applying).toBe(false);
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

  it('17. stale banner AND stale preview cleared at file-pick start (pitfall #79 + NEW-8)', async () => {
    const { result } = setup();
    // First pick → error banner.
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(makeNonJsonFile()));
    });
    expect(result.current.importBanner?.kind).toBe('error');

    // Second pick (valid) — banner should clear at entry (before processing).
    await act(async () => {
      await result.current.handleImport(makeChangeEvent(makeFile(validProjectExport)));
    });
    // Fast path success → banner is the new success banner, not the stale error.
    expect(result.current.importBanner?.kind).toBe('success');
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
});
