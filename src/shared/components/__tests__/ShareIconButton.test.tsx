// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShareIconButton } from '../ShareIconButton';
import { LIGHT_THEME } from '../../utils/theme';

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: LIGHT_THEME, resolvedTheme: 'light' }),
}));

describe('ShareIconButton', () => {
  // The label and the tooltip differ here so the button's name can only come
  // from its label.
  it('is named by its label and shows its title as the tooltip', () => {
    render(<ShareIconButton onClick={() => {}} ariaLabel="Share project" title="Invite people to this project" />);

    const button = screen.getByRole('button', { name: 'Share project' });
    expect(button).toHaveAttribute('title', 'Invite people to this project');
  });

  it('calls onClick when pressed', () => {
    const onClick = vi.fn();
    render(<ShareIconButton onClick={onClick} ariaLabel="Share project" title="Share project" />);

    fireEvent.click(screen.getByRole('button', { name: 'Share project' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
