// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrashIconButton } from '../TrashIconButton';
import { LIGHT_THEME } from '../../utils/theme';

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: LIGHT_THEME, resolvedTheme: 'light' }),
}));

describe('TrashIconButton', () => {
  it('renders an SVG inside a button', () => {
    render(<TrashIconButton onClick={() => {}} />);
    const button = screen.getByRole('button');
    expect(button.querySelector('svg')).not.toBeNull();
  });

  it('uses default aria-label and title of "Delete"', () => {
    render(<TrashIconButton onClick={() => {}} />);
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button).toHaveAttribute('title', 'Delete');
  });

  it('propagates custom ariaLabel and title', () => {
    render(<TrashIconButton onClick={() => {}} ariaLabel="Delete project" title="Delete this project" />);
    const button = screen.getByRole('button', { name: 'Delete project' });
    expect(button).toHaveAttribute('title', 'Delete this project');
  });

  it('fires onClick when clicked', () => {
    const onClick = vi.fn();
    render(<TrashIconButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('changes icon color on mouse enter (hover red)', () => {
    render(<TrashIconButton onClick={() => {}} />);
    const button = screen.getByRole('button');
    const path = button.querySelector('path');
    const defaultStroke = path?.getAttribute('stroke');

    fireEvent.mouseEnter(button);
    const hoverStroke = button.querySelector('path')?.getAttribute('stroke');
    expect(hoverStroke).toBe('#ef4444');
    expect(hoverStroke).not.toBe(defaultStroke);

    fireEvent.mouseLeave(button);
    const restoredStroke = button.querySelector('path')?.getAttribute('stroke');
    expect(restoredStroke).toBe(defaultStroke);
  });

  it('shows soft red background tile on hover', () => {
    render(<TrashIconButton onClick={() => {}} />);
    const button = screen.getByRole('button');
    expect(button.style.background).toBe('transparent');

    fireEvent.mouseEnter(button);
    // jsdom normalizes the hex to rgb form
    expect(button.style.background).toMatch(/rgb\(254,\s*242,\s*242\)|#fef2f2/);

    fireEvent.mouseLeave(button);
    expect(button.style.background).toBe('transparent');
  });

  it('renders with disabled state and does not change color on hover', () => {
    const onClick = vi.fn();
    render(<TrashIconButton onClick={onClick} disabled />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();

    const defaultStroke = button.querySelector('path')?.getAttribute('stroke');
    fireEvent.mouseEnter(button);
    const afterHoverStroke = button.querySelector('path')?.getAttribute('stroke');
    expect(afterHoverStroke).toBe(defaultStroke);
  });
});
