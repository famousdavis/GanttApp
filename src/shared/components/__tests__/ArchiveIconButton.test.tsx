// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArchiveIconButton } from '../ArchiveIconButton';
import { DARK_THEME, LIGHT_THEME } from '../../utils/theme';

const theme = vi.hoisted(() => ({ resolved: 'light' as 'light' | 'dark' }));

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: theme.resolved === 'dark' ? DARK_THEME : LIGHT_THEME,
    resolvedTheme: theme.resolved,
  }),
}));

const stroke = (button: HTMLElement) => button.querySelector('path')?.getAttribute('stroke');

describe('ArchiveIconButton', () => {
  beforeEach(() => {
    theme.resolved = 'light';
  });

  it.each([
    ['archive', 'Archive project'],
    ['unarchive', 'Unarchive project'],
  ] as const)('the %s variant is named %s, in its label and its tooltip', (variant, name) => {
    render(<ArchiveIconButton variant={variant} onClick={() => {}} />);
    expect(screen.getByRole('button', { name })).toHaveAttribute('title', name);
  });

  it('draws a different icon for each variant, a box with an arrow for unarchive', () => {
    const { rerender } = render(<ArchiveIconButton variant="archive" onClick={() => {}} />);
    const archive = screen.getByRole('button').querySelector('path')?.getAttribute('d');
    rerender(<ArchiveIconButton variant="unarchive" onClick={() => {}} />);
    const unarchive = screen.getByRole('button').querySelector('path')?.getAttribute('d');
    expect(archive).toContain('M10 12h4');
    expect(unarchive).toContain('M9 15l3-3 3 3');
    expect(archive).not.toEqual(unarchive);
  });

  it('propagates a custom label and tooltip', () => {
    render(<ArchiveIconButton variant="archive" onClick={() => {}} ariaLabel="Put away" title="Put this away" />);
    expect(screen.getByRole('button', { name: 'Put away' })).toHaveAttribute('title', 'Put this away');
  });

  it('fires onClick when clicked', () => {
    const onClick = vi.fn();
    render(<ArchiveIconButton variant="archive" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['light', '#808080', '#475569', /rgb\(241,\s*245,\s*249\)|#f1f5f9/],
    ['dark', '#9ca3af', '#cbd5e1', /rgba\(148,\s*163,\s*184,\s*0\.15\)/],
  ] as const)('in %s mode it rests grey and turns slate on hover, on a soft slate tile', (mode, rest, hover, background) => {
    theme.resolved = mode;
    render(<ArchiveIconButton variant="archive" onClick={() => {}} />);
    const button = screen.getByRole('button');
    expect(stroke(button)).toBe(rest);
    expect(button.style.background).toBe('transparent');

    fireEvent.mouseEnter(button);
    expect(stroke(button)).toBe(hover);
    expect(button.style.background).toMatch(background);

    fireEvent.mouseLeave(button);
    expect(stroke(button)).toBe(rest);
    expect(button.style.background).toBe('transparent');
  });

  it('turns slate on focus and reverts on blur', () => {
    render(<ArchiveIconButton variant="unarchive" onClick={() => {}} />);
    const button = screen.getByRole('button');

    fireEvent.focus(button);
    expect(stroke(button)).toBe('#475569');

    fireEvent.blur(button);
    expect(stroke(button)).toBe('#808080');
  });

  it('renders disabled and suppresses hover color and click', () => {
    const onClick = vi.fn();
    render(<ArchiveIconButton variant="archive" onClick={onClick} disabled />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button.style.cursor).toBe('not-allowed');

    fireEvent.mouseEnter(button);
    fireEvent.focus(button);
    expect(stroke(button)).toBe('#808080');

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
