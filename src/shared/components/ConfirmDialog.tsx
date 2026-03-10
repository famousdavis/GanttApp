// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// ConfirmDialog — reusable inline or modal confirmation dialog (v12.1).
// Inline mode: card with border, message, button row (StorageSection pattern).
// Modal mode: full-screen overlay with centered dialog, title, description (ProjectsTab pattern).

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
      onClick={btn.onClick}
      disabled={disabled}
      style={style}
    >
      {btn.label}
    </button>
  );
}

export function ConfirmDialog({ message, title, buttons, colors, modal, borderColor }: ConfirmDialogProps) {
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
        <div style={{
          background: colors.surface,
          borderRadius: '12px',
          padding: '2rem',
          maxWidth: '480px',
          width: '90%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}>
          {title && (
            <h3 style={{
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
                : { padding: '0.6rem 1.25rem', background: colors.surface, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: '6px', cursor, fontWeight: '600' as const, fontSize: '0.9rem' };

              return (
                <button key={i} onClick={btn.onClick} disabled={disabled} style={modalBtnStyle}>
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
    <div style={{
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
