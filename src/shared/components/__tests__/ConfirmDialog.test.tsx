// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
});
