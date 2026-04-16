// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReleaseStatusControl } from '../ReleaseStatusControl';
import { LIGHT_THEME } from '../../../shared/utils/theme';

describe('ReleaseStatusControl', () => {
  const defaultProps = {
    value: 'not-started' as const,
    onChange: vi.fn(),
    colors: LIGHT_THEME,
  };

  it('renders three segments', () => {
    render(<ReleaseStatusControl {...defaultProps} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
  });

  it('marks Not Started as active when value is not-started', () => {
    render(<ReleaseStatusControl {...defaultProps} value="not-started" />);

    const button = screen.getByText('Not Started');
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks In Progress as active when value is in-progress', () => {
    render(<ReleaseStatusControl {...defaultProps} value="in-progress" />);

    const button = screen.getByText('In Progress');
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks Complete as active when value is complete', () => {
    render(<ReleaseStatusControl {...defaultProps} value="complete" />);

    const button = screen.getByText('Complete');
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onChange with correct status on click', () => {
    const onChange = vi.fn();
    render(<ReleaseStatusControl {...defaultProps} onChange={onChange} />);

    fireEvent.click(screen.getByText('In Progress'));
    expect(onChange).toHaveBeenCalledWith('in-progress');
  });

  it('has role=group and aria-label', () => {
    render(<ReleaseStatusControl {...defaultProps} />);

    const group = screen.getByRole('group');
    expect(group).toHaveAttribute('aria-label', 'Release status');
  });

  it('applies amber background to active In Progress segment', () => {
    render(<ReleaseStatusControl {...defaultProps} value="in-progress" />);

    const button = screen.getByText('In Progress');
    // DOM normalizes hex to rgb()
    expect(button.style.background).toBe('rgb(245, 158, 11)');
  });

  it('applies green background to active Complete segment', () => {
    render(<ReleaseStatusControl {...defaultProps} value="complete" />);

    const button = screen.getByText('Complete');
    // DOM normalizes hex to rgb()
    expect(button.style.background).toBe('rgb(40, 167, 69)');
  });
});
