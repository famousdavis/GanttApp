// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// v0.24.0 — Component tests for ImportPreviewSection.
//
// File-input simulation pattern (documented for the whole import-flow test
// suite): construct a File with `new File([JSON.stringify(...)], 'test.json',
// { type: 'application/json' })`, then drive `<input type="file">` via
// `fireEvent.change(fileInput, { target: { files: [file] } })`. The existing
// ProjectsTab.test.tsx suite uses this exact pattern and it works under jsdom.
//
// Radio assertions: use `getByRole('radio', { name: '<label-text>' })`. For
// HTML `name` attribute checks, fetch the element then call `.getAttribute`.
// Do NOT assert exact useId() values — they are opaque (`:r5:` etc). Assert
// pairing instead (shared `name` within group; htmlFor/id match).

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ImportPreviewSection } from '../ImportPreviewSection';
import { LIGHT_THEME } from '../../../shared/utils/theme';
import type { ImportResult, ImportConflict, ConflictAction } from '../../../shared/utils/export';

function makeImportResult(exportType: ImportResult['exportType'], projects: { id: string; name: string }[]): ImportResult {
  return {
    appData: { projects, releases: [] },
    exportType,
  };
}

function makeConflicts(specs: { incomingId: string; incomingName: string; existingId: string; existingName: string; type: 'id' | 'name' }[]): ImportConflict[] {
  return specs.map(s => ({
    type: s.type,
    incomingProject: { id: s.incomingId, name: s.incomingName },
    existingProject: { id: s.existingId, name: s.existingName },
  }));
}

function defaultProps(overrides: Partial<React.ComponentProps<typeof ImportPreviewSection>> = {}) {
  return {
    imported: makeImportResult('ganttapp-project-export', [{ id: 'inc-1', name: 'Imported' }]),
    conflicts: [] as ImportConflict[],
    decisions: new Map<string, ConflictAction>(),
    mode: 'merge' as const,
    applying: false,
    idPrefix: 'test-prefix',
    colors: LIGHT_THEME,
    onModeChange: vi.fn(),
    onDecisionChange: vi.fn(),
    onConfirm: vi.fn(),
    onRequestReplaceAll: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
}

describe('ImportPreviewSection (v0.24.0)', () => {
  describe('mode: replace-all', () => {
    it('hides conflict list and shows "Replace All Data" button', () => {
      const conflicts = makeConflicts([{ incomingId: 'i1', incomingName: 'Foo', existingId: 'e1', existingName: 'Foo', type: 'id' }]);
      render(
        <ImportPreviewSection
          {...defaultProps({
            imported: makeImportResult('ganttapp-all-projects', [{ id: 'i1', name: 'Foo' }]),
            conflicts,
            decisions: new Map([['i1', 'replace']]),
            mode: 'replace-all',
          })}
        />
      );
      // No conflict UI when in replace-all mode.
      expect(screen.queryByTestId('conflict-group-i1')).toBeNull();
      expect(screen.getByRole('button', { name: 'Replace All Data' })).toBeTruthy();
    });

    it('clicking "Replace All Data" calls onRequestReplaceAll, not onConfirm', () => {
      const onRequestReplaceAll = vi.fn();
      const onConfirm = vi.fn();
      render(
        <ImportPreviewSection
          {...defaultProps({
            imported: makeImportResult('ganttapp-all-projects', [{ id: 'i1', name: 'Foo' }]),
            mode: 'replace-all',
            onRequestReplaceAll,
            onConfirm,
          })}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Replace All Data' }));
      expect(onRequestReplaceAll).toHaveBeenCalled();
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('mode: merge', () => {
    it('shows conflict list and "added at the bottom" text', () => {
      const conflicts = makeConflicts([{ incomingId: 'i1', incomingName: 'Foo', existingId: 'e1', existingName: 'Foo', type: 'name' }]);
      render(
        <ImportPreviewSection
          {...defaultProps({
            imported: makeImportResult('ganttapp-project-export', [
              { id: 'i1', name: 'Foo' },
              { id: 'i2', name: 'New Project' },
            ]),
            conflicts,
            decisions: new Map([['i1', 'copy']]),
            mode: 'merge',
          })}
        />
      );
      expect(screen.getByTestId('conflict-group-i1')).toBeTruthy();
      expect(screen.getByText(/will be added at the bottom/)).toBeTruthy();
    });

    it('shows settings-not-imported hint for ganttapp-all-projects in merge mode', () => {
      render(
        <ImportPreviewSection
          {...defaultProps({
            imported: makeImportResult('ganttapp-all-projects', [{ id: 'i1', name: 'New' }]),
            mode: 'merge',
          })}
        />
      );
      expect(screen.getByText(/Workspace settings.*not imported in Merge mode/)).toBeTruthy();
    });

    it('does not show settings-not-imported hint for ganttapp-project-export', () => {
      render(
        <ImportPreviewSection
          {...defaultProps({
            imported: makeImportResult('ganttapp-project-export', [{ id: 'i1', name: 'New' }]),
            mode: 'merge',
          })}
        />
      );
      expect(screen.queryByText(/Workspace settings.*not imported in Merge mode/)).toBeNull();
    });

    it('clicking "Confirm Merge"/"Confirm Import" calls onConfirm, not onRequestReplaceAll', () => {
      const onConfirm = vi.fn();
      const onRequestReplaceAll = vi.fn();
      render(
        <ImportPreviewSection
          {...defaultProps({
            imported: makeImportResult('ganttapp-project-export', [{ id: 'i1', name: 'New' }]),
            mode: 'merge',
            onConfirm,
            onRequestReplaceAll,
          })}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Import' }));
      expect(onConfirm).toHaveBeenCalled();
      expect(onRequestReplaceAll).not.toHaveBeenCalled();
    });
  });

  describe('applying=true: all interactive controls disabled', () => {
    it('disables Confirm, Replace-All (when in replace mode), Cancel, and mode selector', () => {
      const conflicts = makeConflicts([{ incomingId: 'i1', incomingName: 'Foo', existingId: 'e1', existingName: 'Foo', type: 'id' }]);
      const { rerender } = render(
        <ImportPreviewSection
          {...defaultProps({
            imported: makeImportResult('ganttapp-all-projects', [{ id: 'i1', name: 'Foo' }]),
            conflicts,
            decisions: new Map([['i1', 'replace']]),
            mode: 'merge',
            applying: true,
          })}
        />
      );
      const confirm = screen.getByRole('button', { name: 'Confirm Merge' }) as HTMLButtonElement;
      const cancel = screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement;
      const mergeMode = screen.getByRole('radio', { name: /Merge into workspace/ }) as HTMLInputElement;
      const replaceMode = screen.getByRole('radio', { name: /Replace entire workspace/ }) as HTMLInputElement;
      expect(confirm.disabled).toBe(true);
      expect(cancel.disabled).toBe(true);
      expect(mergeMode.disabled).toBe(true);
      expect(replaceMode.disabled).toBe(true);

      // Switch to replace-all mode and assert Replace All Data is disabled too.
      rerender(
        <ImportPreviewSection
          {...defaultProps({
            imported: makeImportResult('ganttapp-all-projects', [{ id: 'i1', name: 'Foo' }]),
            conflicts,
            decisions: new Map([['i1', 'replace']]),
            mode: 'replace-all',
            applying: true,
          })}
        />
      );
      const replaceBtn = screen.getByRole('button', { name: 'Replace All Data' }) as HTMLButtonElement;
      expect(replaceBtn.disabled).toBe(true);
    });

    it('enables all controls when applying=false', () => {
      render(
        <ImportPreviewSection
          {...defaultProps({
            imported: makeImportResult('ganttapp-all-projects', [{ id: 'i1', name: 'Foo' }]),
            mode: 'merge',
            applying: false,
          })}
        />
      );
      const confirm = screen.getByRole('button', { name: 'Confirm Merge' }) as HTMLButtonElement;
      const cancel = screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement;
      expect(confirm.disabled).toBe(false);
      expect(cancel.disabled).toBe(false);
    });
  });

  it('clicking Cancel calls onCancel', () => {
    const onCancel = vi.fn();
    render(<ImportPreviewSection {...defaultProps({ onCancel })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  describe('radio groups and pairing', () => {
    it('all three radios in a conflict group share the same name attribute; each radio id matches its label htmlFor', () => {
      const conflicts = makeConflicts([{ incomingId: 'inc-1', incomingName: 'Foo', existingId: 'e1', existingName: 'Foo', type: 'name' }]);
      render(
        <ImportPreviewSection
          {...defaultProps({
            imported: makeImportResult('ganttapp-project-export', [{ id: 'inc-1', name: 'Foo' }]),
            conflicts,
            decisions: new Map([['inc-1', 'copy']]),
            mode: 'merge',
            idPrefix: 'pfx',
          })}
        />
      );

      const group = screen.getByTestId('conflict-group-inc-1');
      const skipRadio = within(group).getByRole('radio', { name: 'Keep existing, ignore imported' }) as HTMLInputElement;
      const copyRadio = within(group).getByRole('radio', { name: 'Add as a copy' }) as HTMLInputElement;
      const replaceRadio = within(group).getByRole('radio', { name: 'Replace existing with imported' }) as HTMLInputElement;

      expect(skipRadio.getAttribute('name')).toBe(copyRadio.getAttribute('name'));
      expect(copyRadio.getAttribute('name')).toBe(replaceRadio.getAttribute('name'));
      expect(skipRadio.getAttribute('name')).toMatch(/pfx-conflict-inc-1$/);

      // Each radio's id matches its sibling label's htmlFor. React's `htmlFor`
      // prop renders as the HTML `for` attribute; access via the DOM property.
      for (const radio of [skipRadio, copyRadio, replaceRadio]) {
        const id = radio.id;
        expect(id).toBeTruthy();
        const label = within(group).getByText(
          radio === skipRadio ? 'Keep existing, ignore imported'
          : radio === copyRadio ? 'Add as a copy'
          : 'Replace existing with imported'
        ).closest('label') as HTMLLabelElement | null;
        expect(label?.htmlFor).toBe(id);
      }
    });

    it('clicking a radio calls onDecisionChange with the right action', () => {
      const onDecisionChange = vi.fn();
      const conflicts = makeConflicts([{ incomingId: 'inc-1', incomingName: 'Foo', existingId: 'e1', existingName: 'Foo', type: 'name' }]);
      render(
        <ImportPreviewSection
          {...defaultProps({
            imported: makeImportResult('ganttapp-project-export', [{ id: 'inc-1', name: 'Foo' }]),
            conflicts,
            decisions: new Map([['inc-1', 'copy']]),
            mode: 'merge',
            onDecisionChange,
          })}
        />
      );
      const replaceRadio = screen.getByRole('radio', { name: 'Replace existing with imported' });
      fireEvent.click(replaceRadio);
      expect(onDecisionChange).toHaveBeenCalledWith('inc-1', 'replace');
    });
  });

  describe('ID-conflict UI shows both existing and incoming names', () => {
    it('renders both names side-by-side for type:id conflicts', () => {
      const conflicts = makeConflicts([{ incomingId: 'inc-1', incomingName: 'Alpha v2', existingId: 'inc-1', existingName: 'Alpha v1', type: 'id' }]);
      render(
        <ImportPreviewSection
          {...defaultProps({
            imported: makeImportResult('ganttapp-project-export', [{ id: 'inc-1', name: 'Alpha v2' }]),
            conflicts,
            decisions: new Map([['inc-1', 'skip']]),
            mode: 'merge',
          })}
        />
      );
      const group = screen.getByTestId('conflict-group-inc-1');
      expect(within(group).getByText(/Alpha v1/)).toBeTruthy();
      expect(within(group).getByText(/Alpha v2/)).toBeTruthy();
      expect(within(group).getByText(/Already exists — same project/)).toBeTruthy();
    });

    it('renders only the incoming name and the different-origin label for type:name conflicts', () => {
      const conflicts = makeConflicts([{ incomingId: 'inc-1', incomingName: 'Foo', existingId: 'old-1', existingName: 'Foo', type: 'name' }]);
      render(
        <ImportPreviewSection
          {...defaultProps({
            imported: makeImportResult('ganttapp-project-export', [{ id: 'inc-1', name: 'Foo' }]),
            conflicts,
            decisions: new Map([['inc-1', 'copy']]),
            mode: 'merge',
          })}
        />
      );
      const group = screen.getByTestId('conflict-group-inc-1');
      expect(within(group).getByText(/Already exists — same name, different origin/)).toBeTruthy();
    });
  });

  describe('mode toggle preserves decisions', () => {
    it('mode change does not reset the decisions Map', () => {
      const onModeChange = vi.fn();
      const decisions = new Map<string, ConflictAction>([['inc-1', 'replace']]);
      const { rerender } = render(
        <ImportPreviewSection
          {...defaultProps({
            imported: makeImportResult('ganttapp-all-projects', [{ id: 'inc-1', name: 'Foo' }]),
            conflicts: makeConflicts([{ incomingId: 'inc-1', incomingName: 'Foo', existingId: 'inc-1', existingName: 'Foo', type: 'id' }]),
            decisions,
            mode: 'merge',
            onModeChange,
          })}
        />
      );
      fireEvent.click(screen.getByRole('radio', { name: /Replace entire workspace/ }));
      expect(onModeChange).toHaveBeenCalledWith('replace-all');

      // Parent would update mode prop; decisions prop is unchanged. Re-render
      // simulates that: the decisions Map identity is the same.
      rerender(
        <ImportPreviewSection
          {...defaultProps({
            imported: makeImportResult('ganttapp-all-projects', [{ id: 'inc-1', name: 'Foo' }]),
            conflicts: makeConflicts([{ incomingId: 'inc-1', incomingName: 'Foo', existingId: 'inc-1', existingName: 'Foo', type: 'id' }]),
            decisions,
            mode: 'replace-all',
            onModeChange,
          })}
        />
      );
      // Going back to merge: the same decisions should still apply.
      rerender(
        <ImportPreviewSection
          {...defaultProps({
            imported: makeImportResult('ganttapp-all-projects', [{ id: 'inc-1', name: 'Foo' }]),
            conflicts: makeConflicts([{ incomingId: 'inc-1', incomingName: 'Foo', existingId: 'inc-1', existingName: 'Foo', type: 'id' }]),
            decisions,
            mode: 'merge',
            onModeChange,
          })}
        />
      );
      const replaceRadio = screen.getByRole('radio', { name: 'Replace existing with imported' }) as HTMLInputElement;
      expect(replaceRadio.checked).toBe(true);
    });
  });
});


// ==========================================================================
// v0.28.21 — Escape ownership (Brief 09 §2b). F13, F14, and the suppression gate.
// ==========================================================================
describe('Escape handling (v0.28.21)', () => {
  it('F13 — with nothing suppressing it, Escape still cancels the preview', () => {
    // The v0.26.0 behaviour. A suppression that is too broad silently deletes
    // a shipped accessibility feature, and no other row would notice.
    const onCancel = vi.fn();
    render(<ImportPreviewSection {...defaultProps({ onCancel })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('F14 — Escape while applying is a no-op', () => {
    const onCancel = vi.fn();
    render(<ImportPreviewSection {...defaultProps({ onCancel, applying: true })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('Escape is suppressed while a surface above owns the key', () => {
    const onCancel = vi.fn();
    render(<ImportPreviewSection {...defaultProps({ onCancel, dismissalSuppressed: true })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('suppression is released again when the surface above closes', () => {
    const onCancel = vi.fn();
    const { rerender } = render(<ImportPreviewSection {...defaultProps({ onCancel, dismissalSuppressed: true })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
    rerender(<ImportPreviewSection {...defaultProps({ onCancel, dismissalSuppressed: false })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
