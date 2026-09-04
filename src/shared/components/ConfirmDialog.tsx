// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// ConfirmDialog — reusable inline or modal confirmation dialog (v12.1).
// Inline mode: card with border, message, button row (StorageSection pattern).
// Modal mode: full-screen overlay with centered dialog, title, description (ProjectsTab pattern).

import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import type { ThemeColors } from '../utils/theme';

export interface ConfirmDialogButton {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'danger' | 'secondary';  // primary=blue outline, danger=red fill, secondary=gray outline
  disabled?: boolean;
}

interface ConfirmDialogProps {
  message: string | ReactNode;
  title?: string;             // Shown only in modal variant
  buttons: ConfirmDialogButton[];
  colors: ThemeColors;
  modal?: boolean;             // false=inline (default), true=overlay
  borderColor?: string;        // Override card border color (e.g. red for destructive)
  /**
   * Move focus into the dialog on open and restore it on close.
   *
   * ⚠️ DEFAULTS TO `modal`, AND IS A SEPARATE AXIS FROM IT ON PURPOSE. `modal`
   * decides whether this is a full-screen overlay that owns the viewport, which
   * is the only correct gate for the Tab TRAP. Focus-on-open is a different
   * question: it belongs to any dialog presenting a blocking decision the user
   * just asked for — including inline ones rendered inside an already-modal
   * surface, where a trap would be wrong but taking focus is right.
   *
   * The axis is USER-INITIATED vs SPONTANEOUS, not destructive vs not. A prompt
   * that appears on its own — because an async operation finished — must NOT
   * steal focus from someone mid-task, even when its primary action is
   * destructive. See UploadConfirmFlow for one of each.
   */
  blocking?: boolean;
  /**
   * Escape handler. Modal only. When supplied, the dialog claims Escape in the
   * CAPTURE phase and stops propagation, so document-level listeners belonging
   * to surfaces underneath it do not also fire.
   */
  onEscape?: () => void;
}

/** Enabled buttons inside a dialog root, in DOM order. */
function focusablesIn(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
}

const btnBase = {
  padding: '0.5rem 1.25rem',
  border: 'none',
  borderRadius: '4px',
  fontWeight: '600' as const,
};

function renderButton(btn: ConfirmDialogButton, colors: ThemeColors, index: number) {
  const variant = btn.variant ?? 'secondary';
  const disabled = btn.disabled ?? false;
  const cursor = disabled ? 'not-allowed' : 'pointer';

  const style = variant === 'danger'
    ? { ...btnBase, background: '#e53e3e', color: 'white', cursor }
    : variant === 'primary'
      ? { ...btnBase, background: 'transparent', color: '#0070f3', border: '1px solid #0070f3', cursor }
      : { ...btnBase, background: 'transparent', color: colors.text, border: `1px solid ${colors.border}`, cursor };

  return (
    <button
      key={index}
      data-variant={variant}
      onClick={btn.onClick}
      disabled={disabled}
      style={style}
    >
      {btn.label}
    </button>
  );
}

export function ConfirmDialog({
  message, title, buttons, colors, modal, borderColor, blocking, onEscape,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreTargetRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  // Focus behaviour defaults to `modal` but is independently overridable.
  const takesFocus = blocking ?? Boolean(modal);

  // Hooks must run before the `if (modal)` early return below — putting them
  // inside that branch is a Rules-of-Hooks violation that lint would catch.

  // Focus in on open, back out on close.
  useEffect(() => {
    if (!takesFocus) return;
    const active = document.activeElement;
    restoreTargetRef.current = active instanceof HTMLElement ? active : null;
    const root = dialogRef.current;
    if (root) {
      const btns = focusablesIn(root);
      // Destructive dialogs focus the NON-destructive choice, so that a stray
      // Enter cancels rather than confirms.
      const safe = btns.find((b) => b.dataset.variant !== 'danger');
      (safe ?? btns[0] ?? root).focus();
    }
    return () => {
      const prev = restoreTargetRef.current;
      if (prev && document.contains(prev)) prev.focus();
    };
  }, [takesFocus]);

  // Escape, and the Tab trap. Modal only.
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!onEscape) return;
        e.preventDefault();
        e.stopPropagation();
        onEscape();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const btns = focusablesIn(root);
      if (btns.length === 0) return;
      // ⚠️ CONTRACT: the trap moves focus ITSELF and never relies on the
      // browser's native Tab order. That is what makes the behaviour
      // observable — jsdom does not traverse on Tab, so a trap that merely
      // "lets the browser wrap" is untestable and silently unverified. Do not
      // simplify this back to letting the browser do it.
      e.preventDefault();
      const idx = btns.indexOf(document.activeElement as HTMLButtonElement);
      const last = btns.length - 1;
      let next: number;
      if (e.shiftKey) next = idx <= 0 ? last : idx - 1;
      else next = idx === -1 || idx === last ? 0 : idx + 1;
      btns[next].focus();
    };
    // Capture phase: this dialog sees Escape before any bubble-phase
    // document listener belonging to a surface rendered underneath it.
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [modal, onEscape]);

  if (modal) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}>
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          tabIndex={-1}
          style={{
          background: colors.surface,
          borderRadius: '12px',
          padding: '2rem',
          maxWidth: '480px',
          width: '90%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}>
          {title && (
            <h3 id={titleId} style={{
              fontSize: '1.25rem',
              fontWeight: '700',
              color: colors.text,
              marginBottom: '1rem',
            }}>
              {title}
            </h3>
          )}
          <div style={{
            color: colors.textSecondary,
            lineHeight: '1.6',
            marginBottom: '1.5rem',
            fontSize: '0.95rem',
          }}>
            {message}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            {buttons.map((btn, i) => {
              const variant = btn.variant ?? 'secondary';
              const disabled = btn.disabled ?? false;
              const cursor = disabled ? 'not-allowed' : 'pointer';

              const modalBtnStyle = variant === 'danger'
                ? { padding: '0.6rem 1.25rem', background: '#dc3545', color: 'white', border: 'none', borderRadius: '6px', cursor, fontWeight: '600' as const, fontSize: '0.9rem' }
                : variant === 'primary'
                  ? { padding: '0.6rem 1.25rem', background: '#0070f3', color: 'white', border: 'none', borderRadius: '6px', cursor, fontWeight: '600' as const, fontSize: '0.9rem' }
                  : { padding: '0.6rem 1.25rem', background: colors.surface, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: '6px', cursor, fontWeight: '600' as const, fontSize: '0.9rem' };

              return (
                <button key={i} data-variant={variant} onClick={btn.onClick} disabled={disabled} style={modalBtnStyle}>
                  {btn.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Inline mode (default)
  return (
    <div ref={dialogRef} style={{
      marginTop: '0.5rem',
      paddingLeft: '1.5rem',
    }}>
      <div style={{
        padding: '1rem',
        border: `1px solid ${borderColor ?? colors.border}`,
        borderRadius: '6px',
        background: colors.surface,
      }}>
        <div style={{ color: colors.text, margin: '0 0 0.75rem 0' }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {buttons.map((btn, i) => renderButton(btn, colors, i))}
        </div>
      </div>
    </div>
  );
}
