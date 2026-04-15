// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkWeekSection } from '../WorkWeekSection';
import { LIGHT_THEME } from '../../../shared/utils/theme';

const colors = LIGHT_THEME;

describe('WorkWeekSection', () => {
  it('renders the "Work Week" heading', () => {
    render(
      <WorkWeekSection
        colors={colors}
        globalWorkDays={undefined}
        onChange={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.getByText('Work Week')).toBeTruthy();
  });

  it('renders the description paragraph', () => {
    render(
      <WorkWeekSection
        colors={colors}
        globalWorkDays={undefined}
        onChange={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.getByText(/Pick the days of the week/)).toBeTruthy();
  });

  it('renders the WorkWeekSelector with the correct value prop', () => {
    render(
      <WorkWeekSection
        colors={colors}
        globalWorkDays={[0, 6]}
        onChange={vi.fn()}
        onReset={vi.fn()}
      />
    );
    // Sunday (0) and Saturday (6) should be selected
    expect(screen.getByLabelText('Sunday').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText('Saturday').getAttribute('aria-pressed')).toBe('true');
    // Weekdays should not be selected
    expect(screen.getByLabelText('Monday').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByLabelText('Friday').getAttribute('aria-pressed')).toBe('false');
  });

  it('passes onChange through', () => {
    const onChange = vi.fn();
    render(
      <WorkWeekSection
        colors={colors}
        globalWorkDays={[1, 2, 3, 4, 5]}
        onChange={onChange}
        onReset={vi.fn()}
      />
    );
    // Click Sunday to add it
    fireEvent.click(screen.getByLabelText('Sunday'));
    expect(onChange).toHaveBeenCalledWith([0, 1, 2, 3, 4, 5]);
  });

  it('passes onReset through', () => {
    const onReset = vi.fn();
    render(
      <WorkWeekSection
        colors={colors}
        globalWorkDays={[1, 2, 3, 4, 5]}
        onChange={vi.fn()}
        onReset={onReset}
      />
    );
    // Reset button should be visible because globalWorkDays is defined
    fireEvent.click(screen.getByText('Reset to default'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
