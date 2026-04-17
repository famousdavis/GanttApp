// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkWeekSelector } from '../WorkWeekSelector';
import { LIGHT_THEME } from '../../utils/theme';

const colors = LIGHT_THEME;

describe('WorkWeekSelector', () => {
  it('renders 7 day chips', () => {
    render(<WorkWeekSelector value={undefined} onChange={vi.fn()} colors={colors} />);
    const group = screen.getByRole('group');
    const buttons = group.querySelectorAll('button');
    expect(buttons).toHaveLength(7);
  });

  it('renders Mon-Fri as selected when value is undefined', () => {
    render(<WorkWeekSelector value={undefined} onChange={vi.fn()} colors={colors} />);
    const buttons = screen.getAllByRole('button');
    // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    expect(buttons[0].getAttribute('aria-pressed')).toBe('false'); // Sunday
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');  // Monday
    expect(buttons[2].getAttribute('aria-pressed')).toBe('true');  // Tuesday
    expect(buttons[3].getAttribute('aria-pressed')).toBe('true');  // Wednesday
    expect(buttons[4].getAttribute('aria-pressed')).toBe('true');  // Thursday
    expect(buttons[5].getAttribute('aria-pressed')).toBe('true');  // Friday
    expect(buttons[6].getAttribute('aria-pressed')).toBe('false'); // Saturday
  });

  it('renders the exact selected days from value', () => {
    render(<WorkWeekSelector value={[0, 6]} onChange={vi.fn()} colors={colors} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');  // Sunday
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false'); // Monday
    expect(buttons[2].getAttribute('aria-pressed')).toBe('false'); // Tuesday
    expect(buttons[3].getAttribute('aria-pressed')).toBe('false'); // Wednesday
    expect(buttons[4].getAttribute('aria-pressed')).toBe('false'); // Thursday
    expect(buttons[5].getAttribute('aria-pressed')).toBe('false'); // Friday
    expect(buttons[6].getAttribute('aria-pressed')).toBe('true');  // Saturday
  });

  it('has aria-label for each day with the full day name', () => {
    render(<WorkWeekSelector value={undefined} onChange={vi.fn()} colors={colors} />);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    dayNames.forEach(name => {
      expect(screen.getByLabelText(name)).toBeTruthy();
    });
  });

  it('sets aria-pressed=true on selected chips', () => {
    render(<WorkWeekSelector value={[1, 2, 3]} onChange={vi.fn()} colors={colors} />);
    expect(screen.getByLabelText('Monday').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText('Tuesday').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText('Wednesday').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText('Thursday').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByLabelText('Friday').getAttribute('aria-pressed')).toBe('false');
  });

  it('clicking a selected chip calls onChange with that day removed, sorted', () => {
    const onChange = vi.fn();
    render(<WorkWeekSelector value={[1, 2, 3, 4, 5]} onChange={onChange} colors={colors} />);
    fireEvent.click(screen.getByLabelText('Monday'));
    expect(onChange).toHaveBeenCalledWith([2, 3, 4, 5]);
  });

  it('clicking an unselected chip calls onChange with that day added, sorted', () => {
    const onChange = vi.fn();
    render(<WorkWeekSelector value={[1, 2, 3, 4, 5]} onChange={onChange} colors={colors} />);
    fireEvent.click(screen.getByLabelText('Sunday'));
    expect(onChange).toHaveBeenCalledWith([0, 1, 2, 3, 4, 5]);
  });

  it('does not call onChange when clicking the last remaining selected chip', () => {
    const onChange = vi.fn();
    render(<WorkWeekSelector value={[3]} onChange={onChange} colors={colors} />);
    fireEvent.click(screen.getByLabelText('Wednesday'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables the last remaining selected chip', () => {
    render(<WorkWeekSelector value={[3]} onChange={vi.fn()} colors={colors} />);
    expect(screen.getByLabelText('Wednesday')).toBeDisabled();
  });

  it('renders placeholder text only when value is undefined and placeholder prop is provided', () => {
    const { rerender } = render(
      <WorkWeekSelector value={undefined} onChange={vi.fn()} colors={colors} placeholder="Uses global default" />
    );
    expect(screen.getByText('Uses global default')).toBeTruthy();

    // With value defined, placeholder should not appear
    rerender(
      <WorkWeekSelector value={[1, 2, 3, 4, 5]} onChange={vi.fn()} colors={colors} placeholder="Uses global default" />
    );
    expect(screen.queryByText('Uses global default')).toBeNull();

    // With value undefined but no placeholder prop, nothing renders
    rerender(
      <WorkWeekSelector value={undefined} onChange={vi.fn()} colors={colors} />
    );
    expect(screen.queryByText('Uses global default')).toBeNull();
  });

  it('renders Reset button only when allowReset=true AND value !== undefined', () => {
    const { rerender } = render(
      <WorkWeekSelector value={[1, 2, 3]} onChange={vi.fn()} colors={colors} allowReset={true} onReset={vi.fn()} />
    );
    expect(screen.getByText('Reset to default')).toBeTruthy();

    // value is undefined — Reset should not appear even if allowReset=true
    rerender(
      <WorkWeekSelector value={undefined} onChange={vi.fn()} colors={colors} allowReset={true} onReset={vi.fn()} />
    );
    expect(screen.queryByText('Reset to default')).toBeNull();
  });

  it('Reset button calls onReset', () => {
    const onReset = vi.fn();
    render(
      <WorkWeekSelector value={[1, 2, 3]} onChange={vi.fn()} colors={colors} allowReset={true} onReset={onReset} />
    );
    fireEvent.click(screen.getByText('Reset to default'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('does not render Reset button when allowReset=false', () => {
    render(
      <WorkWeekSelector value={[1, 2, 3]} onChange={vi.fn()} colors={colors} allowReset={false} onReset={vi.fn()} />
    );
    expect(screen.queryByText('Reset to default')).toBeNull();
  });

  it('onChange receives a sorted array', () => {
    const onChange = vi.fn();
    // Start with [1, 5] — click Sunday (0) to add it
    render(<WorkWeekSelector value={[1, 5]} onChange={onChange} colors={colors} />);
    fireEvent.click(screen.getByLabelText('Sunday'));
    expect(onChange).toHaveBeenCalledWith([0, 1, 5]);
  });

  describe('fallbackDays (v16.4)', () => {
    it('displays fallbackDays when value is undefined', () => {
      // Simulates a project-override selector: user set globalWorkDays to Mon–Sat,
      // project has no override (value undefined) — selector should reflect the live global.
      render(
        <WorkWeekSelector value={undefined} onChange={vi.fn()} colors={colors} fallbackDays={[1, 2, 3, 4, 5, 6]} />
      );
      expect(screen.getByLabelText('Saturday').getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByLabelText('Sunday').getAttribute('aria-pressed')).toBe('false');
      expect(screen.getByLabelText('Monday').getAttribute('aria-pressed')).toBe('true');
    });

    it('prefers fallbackDays over hardcoded Mon–Fri when value is undefined', () => {
      // User globally configured Sun–Thu (e.g. Middle East work week). Project override unset.
      render(
        <WorkWeekSelector value={undefined} onChange={vi.fn()} colors={colors} fallbackDays={[0, 1, 2, 3, 4]} />
      );
      expect(screen.getByLabelText('Sunday').getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByLabelText('Thursday').getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByLabelText('Friday').getAttribute('aria-pressed')).toBe('false');
      expect(screen.getByLabelText('Saturday').getAttribute('aria-pressed')).toBe('false');
    });

    it('value takes precedence over fallbackDays', () => {
      // Project has its own override — it should win, regardless of fallback
      render(
        <WorkWeekSelector value={[0, 6]} onChange={vi.fn()} colors={colors} fallbackDays={[1, 2, 3, 4, 5]} />
      );
      expect(screen.getByLabelText('Sunday').getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByLabelText('Saturday').getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByLabelText('Monday').getAttribute('aria-pressed')).toBe('false');
    });

    it('falls back to hardcoded Mon–Fri when both value and fallbackDays are undefined', () => {
      render(<WorkWeekSelector value={undefined} onChange={vi.fn()} colors={colors} />);
      expect(screen.getByLabelText('Monday').getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByLabelText('Friday').getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByLabelText('Saturday').getAttribute('aria-pressed')).toBe('false');
    });
  });
});
