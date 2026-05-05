// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CloneIconButton } from '../CloneIconButton';
import { LIGHT_THEME } from '../../utils/theme';

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: LIGHT_THEME, resolvedTheme: 'light' }),
}));

// CloneIconButton uses two SVG shapes (rect + path) — assertions check the rect's stroke,
// which is the deterministic primary indicator.
describe('CloneIconButton', () => {
  it('renders an SVG inside a button', () => {
    render(<CloneIconButton onClick={() => {}} />);
    const button = screen.getByRole('button');
    expect(button.querySelector('svg')).not.toBeNull();
  });

  it('uses default aria-label and title of "Clone"', () => {
    render(<CloneIconButton onClick={() => {}} />);
    const button = screen.getByRole('button', { name: 'Clone' });
    expect(button).toHaveAttribute('title', 'Clone');
  });

  it('propagates custom ariaLabel and title', () => {
    render(<CloneIconButton onClick={() => {}} ariaLabel="Clone project" title="Duplicate project" />);
    const button = screen.getByRole('button', { name: 'Clone project' });
    expect(button).toHaveAttribute('title', 'Duplicate project');
  });

  it('fires onClick when clicked', () => {
    const onClick = vi.fn();
    render(<CloneIconButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('uses gray default and turns violet on mouse enter', () => {
    render(<CloneIconButton onClick={() => {}} />);
    const button = screen.getByRole('button');
    expect(button.querySelector('rect')?.getAttribute('stroke')).toBe('#9ca3af');

    fireEvent.mouseEnter(button);
    expect(button.querySelector('rect')?.getAttribute('stroke')).toBe('#8b5cf6');

    fireEvent.mouseLeave(button);
    expect(button.querySelector('rect')?.getAttribute('stroke')).toBe('#9ca3af');
  });

  it('turns violet on focus and reverts on blur', () => {
    render(<CloneIconButton onClick={() => {}} />);
    const button = screen.getByRole('button');

    fireEvent.focus(button);
    expect(button.querySelector('rect')?.getAttribute('stroke')).toBe('#8b5cf6');

    fireEvent.blur(button);
    expect(button.querySelector('rect')?.getAttribute('stroke')).toBe('#9ca3af');
  });

  it('shows soft violet background tile on hover', () => {
    render(<CloneIconButton onClick={() => {}} />);
    const button = screen.getByRole('button');
    expect(button.style.background).toBe('transparent');

    fireEvent.mouseEnter(button);
    expect(button.style.background).toMatch(/rgb\(245,\s*243,\s*255\)|#f5f3ff/);

    fireEvent.mouseLeave(button);
    expect(button.style.background).toBe('transparent');
  });

  it('renders disabled and suppresses hover color and click', () => {
    const onClick = vi.fn();
    render(<CloneIconButton onClick={onClick} disabled />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button.style.cursor).toBe('not-allowed');

    const before = button.querySelector('rect')?.getAttribute('stroke');
    fireEvent.mouseEnter(button);
    expect(button.querySelector('rect')?.getAttribute('stroke')).toBe(before);

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
