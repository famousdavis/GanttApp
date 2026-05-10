// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PencilIconButton } from '../PencilIconButton';
import { LIGHT_THEME } from '../../utils/theme';

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: LIGHT_THEME, resolvedTheme: 'light' }),
}));

describe('PencilIconButton', () => {
  it('renders an SVG inside a button', () => {
    render(<PencilIconButton onClick={() => {}} />);
    const button = screen.getByRole('button');
    expect(button.querySelector('svg')).not.toBeNull();
  });

  it('uses default aria-label and title of "Edit"', () => {
    render(<PencilIconButton onClick={() => {}} />);
    const button = screen.getByRole('button', { name: 'Edit' });
    expect(button).toHaveAttribute('title', 'Edit');
  });

  it('propagates custom ariaLabel and title', () => {
    render(<PencilIconButton onClick={() => {}} ariaLabel="Edit project" title="Edit this project" />);
    const button = screen.getByRole('button', { name: 'Edit project' });
    expect(button).toHaveAttribute('title', 'Edit this project');
  });

  it('fires onClick when clicked', () => {
    const onClick = vi.fn();
    render(<PencilIconButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('uses gray default and turns blue on mouse enter', () => {
    render(<PencilIconButton onClick={() => {}} />);
    const button = screen.getByRole('button');
    expect(button.querySelector('path')?.getAttribute('stroke')).toBe('#9ca3af');

    fireEvent.mouseEnter(button);
    expect(button.querySelector('path')?.getAttribute('stroke')).toBe('#0070f3');

    fireEvent.mouseLeave(button);
    expect(button.querySelector('path')?.getAttribute('stroke')).toBe('#9ca3af');
  });

  it('turns blue on focus and reverts on blur', () => {
    render(<PencilIconButton onClick={() => {}} />);
    const button = screen.getByRole('button');

    fireEvent.focus(button);
    expect(button.querySelector('path')?.getAttribute('stroke')).toBe('#0070f3');

    fireEvent.blur(button);
    expect(button.querySelector('path')?.getAttribute('stroke')).toBe('#9ca3af');
  });

  it('shows soft blue background tile on hover', () => {
    render(<PencilIconButton onClick={() => {}} />);
    const button = screen.getByRole('button');
    expect(button.style.background).toBe('transparent');

    fireEvent.mouseEnter(button);
    expect(button.style.background).toMatch(/rgb\(239,\s*246,\s*255\)|#eff6ff/);

    fireEvent.mouseLeave(button);
    expect(button.style.background).toBe('transparent');
  });

  it('renders disabled and suppresses hover color and click', () => {
    const onClick = vi.fn();
    render(<PencilIconButton onClick={onClick} disabled />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button.style.cursor).toBe('not-allowed');

    const before = button.querySelector('path')?.getAttribute('stroke');
    fireEvent.mouseEnter(button);
    expect(button.querySelector('path')?.getAttribute('stroke')).toBe(before);

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  // v0.25.0 — `active` prop renders the hover state permanently. Used by ReleasesTab
  // to mark which release row is currently being edited.
  it('renders permanent hover state when active=true (no cursor needed)', () => {
    render(<PencilIconButton onClick={() => {}} active />);
    const button = screen.getByRole('button');
    // Icon stroke is already blue at rest
    expect(button.querySelector('path')?.getAttribute('stroke')).toBe('#0070f3');
    // Background tinted blue at rest
    expect(button.style.background).toMatch(/rgb\(239,\s*246,\s*255\)|#eff6ff/);
  });

  it('disabled overrides active (no visual on disabled buttons)', () => {
    render(<PencilIconButton onClick={() => {}} active disabled />);
    const button = screen.getByRole('button');
    // Stays gray despite active=true
    expect(button.querySelector('path')?.getAttribute('stroke')).toBe('#9ca3af');
    expect(button.style.background).toBe('transparent');
  });
});
