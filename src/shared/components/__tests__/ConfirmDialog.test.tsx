// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, createEvent } from '@testing-library/react';
import { ConfirmDialog } from '../ConfirmDialog';
import type { ConfirmDialogButton } from '../ConfirmDialog';
import { LIGHT_THEME } from '../../utils/theme';

const colors = LIGHT_THEME;

function makeButtons(overrides?: Partial<ConfirmDialogButton>[]): ConfirmDialogButton[] {
  const defaults: ConfirmDialogButton[] = [
    { label: 'Confirm', onClick: vi.fn(), variant: 'primary' },
    { label: 'Cancel', onClick: vi.fn(), variant: 'secondary' },
  ];
  if (!overrides) return defaults;
  return defaults.map((btn, i) => ({ ...btn, ...overrides[i] }));
}

describe('ConfirmDialog', () => {
  // === Inline mode (default) ===

  it('renders message text in inline mode', () => {
    render(
      <ConfirmDialog
        message="Upload projects to cloud?"
        buttons={makeButtons()}
        colors={colors}
      />
    );
    expect(screen.getByText('Upload projects to cloud?')).toBeInTheDocument();
  });

  it('renders ReactNode message', () => {
    render(
      <ConfirmDialog
        message={<span>You have <strong>3</strong> projects.</span>}
        buttons={makeButtons()}
        colors={colors}
      />
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/projects/)).toBeInTheDocument();
  });

  it('renders all buttons', () => {
    render(
      <ConfirmDialog
        message="Test"
        buttons={makeButtons()}
        colors={colors}
      />
    );
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onClick when button is clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        message="Test"
        buttons={[
          { label: 'Yes', onClick: onConfirm, variant: 'primary' },
          { label: 'No', onClick: onCancel, variant: 'secondary' },
        ]}
        colors={colors}
      />
    );
    fireEvent.click(screen.getByText('Yes'));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('disables button when disabled is true', () => {
    render(
      <ConfirmDialog
        message="Test"
        buttons={[
          { label: 'Upload', onClick: vi.fn(), variant: 'primary', disabled: true },
          { label: 'Skip', onClick: vi.fn(), variant: 'secondary' },
        ]}
        colors={colors}
      />
    );
    expect(screen.getByText('Upload')).toBeDisabled();
    expect(screen.getByText('Skip')).not.toBeDisabled();
  });

  it('applies danger button styling (red background)', () => {
    render(
      <ConfirmDialog
        message="Test"
        buttons={[
          { label: 'Delete', onClick: vi.fn(), variant: 'danger' },
        ]}
        colors={colors}
      />
    );
    const btn = screen.getByText('Delete');
    expect(btn.style.background).toContain('229, 62, 62');
    expect(btn.style.color).toBe('white');
  });

  it('applies primary button styling (blue outline)', () => {
    render(
      <ConfirmDialog
        message="Test"
        buttons={[
          { label: 'Upload', onClick: vi.fn(), variant: 'primary' },
        ]}
        colors={colors}
      />
    );
    const btn = screen.getByText('Upload');
    expect(btn.style.color).toContain('0, 112, 243');
    expect(btn.style.background).toBe('transparent');
  });

  it('applies custom borderColor to inline card', () => {
    const { container } = render(
      <ConfirmDialog
        message="Danger zone"
        buttons={makeButtons()}
        colors={colors}
        borderColor="#e53e3e"
      />
    );
    // The outer wrapper div contains an inner card div
    const outerWrapper = container.firstChild as HTMLElement;
    const card = outerWrapper.firstChild as HTMLElement;
    expect(card.style.borderColor).toContain('229, 62, 62');
  });

  it('does not render title in inline mode', () => {
    render(
      <ConfirmDialog
        message="Test"
        title="Should Not Appear"
        buttons={makeButtons()}
        colors={colors}
      />
    );
    // Title is only shown in modal mode
    expect(screen.queryByText('Should Not Appear')).not.toBeInTheDocument();
  });

  // === Modal mode ===

  it('renders overlay in modal mode', () => {
    const { container } = render(
      <ConfirmDialog
        message="Replace all data?"
        title="Replace All Data"
        buttons={makeButtons()}
        colors={colors}
        modal
      />
    );
    // Check for fixed overlay
    const overlay = container.firstChild as HTMLElement;
    expect(overlay.style.position).toBe('fixed');
    expect(overlay.style.zIndex).toBe('9999');
  });

  it('renders title in modal mode', () => {
    render(
      <ConfirmDialog
        message="This will replace everything."
        title="Replace All Data"
        buttons={makeButtons()}
        colors={colors}
        modal
      />
    );
    expect(screen.getByText('Replace All Data')).toBeInTheDocument();
    expect(screen.getByText('This will replace everything.')).toBeInTheDocument();
  });

  it('calls modal button onClick', () => {
    const onReplace = vi.fn();
    render(
      <ConfirmDialog
        message="Replace?"
        title="Confirm"
        buttons={[
          { label: 'Cancel', onClick: vi.fn(), variant: 'secondary' },
          { label: 'Replace', onClick: onReplace, variant: 'danger' },
        ]}
        colors={colors}
        modal
      />
    );
    fireEvent.click(screen.getByText('Replace'));
    expect(onReplace).toHaveBeenCalledOnce();
  });

  it('renders modal danger button with correct styling', () => {
    render(
      <ConfirmDialog
        message="Test"
        buttons={[
          { label: 'Delete', onClick: vi.fn(), variant: 'danger' },
        ]}
        colors={colors}
        modal
      />
    );
    const btn = screen.getByText('Delete');
    expect(btn.style.background).toContain('220, 53, 69');
    expect(btn.style.color).toBe('white');
  });

  // v19.0 — modal-mode 'primary' variant is filled blue (was previously
  // unhandled and rendered as the secondary outline by accident).
  it('renders modal primary button as filled blue with white text', () => {
    render(
      <ConfirmDialog
        message="Add these projects?"
        title="Add Projects to Workspace"
        buttons={[
          { label: 'Cancel', onClick: vi.fn(), variant: 'secondary' },
          { label: 'Add Projects', onClick: vi.fn(), variant: 'primary' },
        ]}
        colors={colors}
        modal
      />
    );
    const primaryBtn = screen.getByRole('button', { name: 'Add Projects' });
    // #0070f3 → rgb(0, 112, 243)
    expect(primaryBtn.style.background).toContain('0, 112, 243');
    expect(primaryBtn.style.color).toBe('white');
    // jsdom serializes the `border: 'none'` shorthand as borderStyle: 'none'
    expect(primaryBtn.style.borderStyle).toBe('none');
  });
});


// ==========================================================================
// v0.28.21 — focus management (Brief 09 §2a). F7, F8, F9, F11, F15.
//
// ⚠️ TWO OF THESE ROWS HAD TO BE REWRITTEN BEFORE THEY COULD FAIL AT ALL.
//
// F8 originally asserted only "focus returns to the invoker". With no focus
// management, focus never LEAVES the invoker, so that passed trivially — a
// correct restore and a total absence of handling were indistinguishable. It
// now asserts the precondition too: focus must have entered the dialog first.
//
// F11 originally asserted "focus stays inside on Tab". jsdom does not traverse
// on Tab at all — measured: focus is unchanged after a Tab keydown — so that
// was true no matter what the code did. It now asserts the TRAP's own
// observable behaviour: preventDefault, and focus moved by the handler.
// That is why the implementation must move focus itself.
// ==========================================================================
describe('ConfirmDialog — focus management (v0.28.21)', () => {
  const destructive = [
    { label: 'Replace', onClick: vi.fn(), variant: 'danger' as const },
    { label: 'Cancel', onClick: vi.fn(), variant: 'secondary' as const },
  ];

  function withInvoker(): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = 'Replace All Data';
    document.body.appendChild(b);
    b.focus();
    return b;
  }

  it('F7 — opening a modal dialog moves focus inside it', () => {
    render(<ConfirmDialog modal title="Replace All Data" message="cannot be undone" buttons={destructive} colors={colors} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('F7b — focus lands on the non-destructive button, so a stray Enter cancels', () => {
    render(<ConfirmDialog modal title="Replace All Data" message="cannot be undone" buttons={destructive} colors={colors} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('F8 — closing restores focus to the element captured at open time', () => {
    const invoker = withInvoker();
    const { unmount } = render(<ConfirmDialog modal title="Replace All Data" message="x" buttons={destructive} colors={colors} />);
    // ⚠️ Precondition. Without it this row passes on code that never moves focus.
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(invoker);
    unmount();
    expect(document.activeElement).toBe(invoker);
    invoker.remove();
  });

  it('F11 — Tab at the last focusable is handled BY THE TRAP, not by the browser', () => {
    render(<ConfirmDialog modal title="t" message="x" buttons={destructive} colors={colors} />);
    const dialog = screen.getByRole('dialog');
    const btns = Array.from(dialog.querySelectorAll('button'));
    const last = btns[btns.length - 1];
    last.focus();
    const ev = createEvent.keyDown(last, { key: 'Tab' });
    fireEvent(last, ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(btns[0]);
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('F11b — Shift+Tab at the first focusable wraps to the last', () => {
    render(<ConfirmDialog modal title="t" message="x" buttons={destructive} colors={colors} />);
    const dialog = screen.getByRole('dialog');
    const btns = Array.from(dialog.querySelectorAll('button'));
    btns[0].focus();
    const ev = createEvent.keyDown(btns[0], { key: 'Tab', shiftKey: true });
    fireEvent(btns[0], ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(btns[btns.length - 1]);
  });

  it('F9 — a NON-blocking inline dialog does not move focus and is not trapped', () => {
    const invoker = withInvoker();
    const { container } = render(<ConfirmDialog message="Upload them to the cloud?" buttons={makeButtons()} colors={colors} />);
    // Control: the harness really did render an inline dialog with buttons.
    expect(container.querySelectorAll('button').length).toBeGreaterThan(0);
    expect(document.activeElement).toBe(invoker);
    // Not trapped: a Tab keydown is left entirely to the browser.
    const btn = container.querySelector('button')!;
    const ev = createEvent.keyDown(btn, { key: 'Tab' });
    fireEvent(btn, ev);
    expect(ev.defaultPrevented).toBe(false);
    invoker.remove();
  });

  it('F15 — a BLOCKING inline dialog takes focus but is still not trapped', () => {
    const invoker = withInvoker();
    const { container } = render(<ConfirmDialog blocking message="Keep a local copy?" buttons={makeButtons()} colors={colors} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(invoker);
    // No trap: inline dialogs never claim Tab, even when they take focus. The
    // enclosing surface (e.g. CloudStorageModal) is the boundary.
    const btn = container.querySelector('button')!;
    const ev = createEvent.keyDown(btn, { key: 'Tab' });
    fireEvent(btn, ev);
    expect(ev.defaultPrevented).toBe(false);
    invoker.remove();
  });

  it('modal dialog exposes dialog semantics, not a bare div', () => {
    render(<ConfirmDialog modal title="Replace All Data" message="x" buttons={destructive} colors={colors} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe(screen.getByText('Replace All Data').id);
  });
});
