// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExportIconButton } from '../ExportIconButton';
import { LIGHT_THEME } from '../../utils/theme';

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: LIGHT_THEME, resolvedTheme: 'light' }),
}));

describe('ExportIconButton', () => {
  it('renders an SVG inside a button', () => {
    render(<ExportIconButton onClick={() => {}} />);
    const button = screen.getByRole('button');
    expect(button.querySelector('svg')).not.toBeNull();
  });

  it('uses default aria-label and title of "Export"', () => {
    render(<ExportIconButton onClick={() => {}} />);
    const button = screen.getByRole('button', { name: 'Export' });
    expect(button).toHaveAttribute('title', 'Export');
  });

  it('propagates custom ariaLabel and title', () => {
    render(<ExportIconButton onClick={() => {}} ariaLabel="Export project" title="Download project file" />);
    const button = screen.getByRole('button', { name: 'Export project' });
    expect(button).toHaveAttribute('title', 'Download project file');
  });

  it('fires onClick when clicked', () => {
    const onClick = vi.fn();
    render(<ExportIconButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('uses gray default and turns green on mouse enter', () => {
    render(<ExportIconButton onClick={() => {}} />);
    const button = screen.getByRole('button');
    expect(button.querySelector('path')?.getAttribute('stroke')).toBe('#9ca3af');

    fireEvent.mouseEnter(button);
    expect(button.querySelector('path')?.getAttribute('stroke')).toBe('#10b981');

    fireEvent.mouseLeave(button);
    expect(button.querySelector('path')?.getAttribute('stroke')).toBe('#9ca3af');
  });

  it('turns green on focus and reverts on blur', () => {
    render(<ExportIconButton onClick={() => {}} />);
    const button = screen.getByRole('button');

    fireEvent.focus(button);
    expect(button.querySelector('path')?.getAttribute('stroke')).toBe('#10b981');

    fireEvent.blur(button);
    expect(button.querySelector('path')?.getAttribute('stroke')).toBe('#9ca3af');
  });

  it('shows soft green background tile on hover', () => {
    render(<ExportIconButton onClick={() => {}} />);
    const button = screen.getByRole('button');
    expect(button.style.background).toBe('transparent');

    fireEvent.mouseEnter(button);
    expect(button.style.background).toMatch(/rgb\(236,\s*253,\s*245\)|#ecfdf5/);

    fireEvent.mouseLeave(button);
    expect(button.style.background).toBe('transparent');
  });

  it('renders disabled and suppresses hover color and click', () => {
    const onClick = vi.fn();
    render(<ExportIconButton onClick={onClick} disabled />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button.style.cursor).toBe('not-allowed');

    const before = button.querySelector('path')?.getAttribute('stroke');
    fireEvent.mouseEnter(button);
    expect(button.querySelector('path')?.getAttribute('stroke')).toBe(before);

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
