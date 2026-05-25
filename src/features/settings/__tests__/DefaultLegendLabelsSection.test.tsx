// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Tests for DefaultLegendLabelsSection — the v16.2 Settings section that edits
// the 5 global default legend labels with placeholder-driven UX.

import type { ReactElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import { DefaultLegendLabelsSection } from '../DefaultLegendLabelsSection';
import { DEFAULT_LEGEND_LABELS } from '../../../shared/utils/validation';
import { LIGHT_THEME } from '../../../shared/utils/theme';
import { ThemeWrapper } from '../../../test/ThemeWrapper';

const render = (ui: ReactElement, options?: Parameters<typeof rtlRender>[1]) =>
  rtlRender(ui, { wrapper: ThemeWrapper, ...options });

const makeProps = (overrides: Partial<Parameters<typeof DefaultLegendLabelsSection>[0]> = {}) => ({
  colors: LIGHT_THEME,
  solidBarLabel: '',
  setSolidBarLabel: vi.fn(),
  hatchedBarLabel: '',
  setHatchedBarLabel: vi.fn(),
  finishDateLabel: '',
  setFinishDateLabel: vi.fn(),
  mostLikelyLineLabel: '',
  setMostLikelyLineLabel: vi.fn(),
  inProgressLabel: '',
  setInProgressLabel: vi.fn(),
  ...overrides,
});

describe('DefaultLegendLabelsSection', () => {
  it('renders 5 labeled inputs for the 5 global legend labels', () => {
    render(<DefaultLegendLabelsSection {...makeProps()} />);

    expect(screen.getByText('Solid Bar')).toBeInTheDocument();
    expect(screen.getByText('Hatched Bar')).toBeInTheDocument();
    expect(screen.getByText('Project Finish Date')).toBeInTheDocument();
    expect(screen.getByText('Most Likely Finish')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();

    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(5);
  });

  it('shows DEFAULT_LEGEND_LABELS as placeholder on each input for empty state (first-time UX)', () => {
    render(<DefaultLegendLabelsSection {...makeProps()} />);

    const inputs = screen.getAllByRole('textbox');
    expect(inputs[0]).toHaveAttribute('placeholder', DEFAULT_LEGEND_LABELS.solidBar);
    expect(inputs[1]).toHaveAttribute('placeholder', DEFAULT_LEGEND_LABELS.hatchedBar);
    expect(inputs[2]).toHaveAttribute('placeholder', DEFAULT_LEGEND_LABELS.finishDateLine);
    expect(inputs[3]).toHaveAttribute('placeholder', DEFAULT_LEGEND_LABELS.mostLikelyLine);
    expect(inputs[4]).toHaveAttribute('placeholder', DEFAULT_LEGEND_LABELS.inProgress);
  });

  it('renders current state values as input values when customized', () => {
    render(
      <DefaultLegendLabelsSection
        {...makeProps({
          solidBarLabel: 'Build Phase',
          inProgressLabel: 'Active Work',
        })}
      />
    );

    expect((screen.getAllByRole('textbox')[0] as HTMLInputElement).value).toBe('Build Phase');
    expect((screen.getAllByRole('textbox')[4] as HTMLInputElement).value).toBe('Active Work');
    // Other fields remain empty (placeholder visible)
    expect((screen.getAllByRole('textbox')[1] as HTMLInputElement).value).toBe('');
  });

  it('calls the appropriate setter when the user types into an input', () => {
    const setSolidBarLabel = vi.fn();
    const setInProgressLabel = vi.fn();
    render(
      <DefaultLegendLabelsSection
        {...makeProps({ setSolidBarLabel, setInProgressLabel })}
      />
    );

    // v0.27.0 (Pass 4, A3): useBufferedField commits on blur, not on change.
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Design Work' } });
    fireEvent.blur(screen.getAllByRole('textbox')[0]);
    expect(setSolidBarLabel).toHaveBeenCalledWith('Design Work');

    fireEvent.change(screen.getAllByRole('textbox')[4], { target: { value: 'Working On It' } });
    fireEvent.blur(screen.getAllByRole('textbox')[4]);
    expect(setInProgressLabel).toHaveBeenCalledWith('Working On It');
  });

  it('truncates input to 50 characters via sanitizeString', () => {
    const setSolidBarLabel = vi.fn();
    render(<DefaultLegendLabelsSection {...makeProps({ setSolidBarLabel })} />);

    const longInput = 'A'.repeat(60);
    // v0.27.0 (Pass 4, A3): useBufferedField commits on blur, not on change.
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: longInput } });
    fireEvent.blur(screen.getAllByRole('textbox')[0]);

    const calledWith = setSolidBarLabel.mock.calls[0][0];
    expect(calledWith.length).toBeLessThanOrEqual(50);
  });

  it('calling setter with empty string is the "revert to default" flow', () => {
    // When the user clears the input, the setter receives '', which makes the
    // raw state empty and the chart falls back to DEFAULT_LEGEND_LABELS.
    const setSolidBarLabel = vi.fn();
    render(
      <DefaultLegendLabelsSection
        {...makeProps({ solidBarLabel: 'Custom', setSolidBarLabel })}
      />
    );

    // v0.27.0 (Pass 4, A3): useBufferedField commits on blur, not on change.
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '' } });
    fireEvent.blur(screen.getAllByRole('textbox')[0]);
    expect(setSolidBarLabel).toHaveBeenCalledWith('');
  });
});
