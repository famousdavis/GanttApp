// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import { ChartLegend } from '../ChartLegend';
import { DEFAULT_CHART_COLORS, DEFAULT_DISPLAY_SETTINGS } from '../../../shared/utils/colors';
import { ThemeWrapper } from '../../../test/ThemeWrapper';

// ChartLegend uses useTheme() — wrap all renders in ThemeProvider (v16.1).
const render: typeof rtlRender = (ui, options) =>
  rtlRender(ui, { wrapper: ThemeWrapper, ...options });

describe('ChartLegend', () => {
  const defaultProps = {
    chartColors: DEFAULT_CHART_COLORS,
    displaySettings: DEFAULT_DISPLAY_SETTINGS,
    solidBarLabel: 'Design, Code, Test',
    hatchedBarLabel: 'Delivery Uncertainty',
    finishDateLabel: 'Project Finish Date',
    mostLikelyLineLabel: 'Most Likely Finish',
    inProgressLabel: 'In Progress',
    showTodayLine: false,
    showFinishDateLine: false,
    showMostLikelyLine: false,
    hasProjectFinishDate: false,
    hasMostLikelyReleases: false,
    hasCompletedReleases: false,
    hasInProgressReleases: false,
    editingLegendLabel: null as 'solid' | 'hatched' | 'finishDate' | 'mostLikelyLine' | 'inProgress' | null,
    tempLabelValue: '',
    onStartEditLabel: vi.fn(),
    onSaveLabelEdit: vi.fn(),
    onCancelLabelEdit: vi.fn(),
    onTempLabelChange: vi.fn(),
    readOnly: false,
    projectLegendLabels: undefined,
    onClearProjectLabelOverride: vi.fn(),
    hasActiveProject: false,
  };

  it('renders solid bar label', () => {
    render(<ChartLegend {...defaultProps} />);

    expect(screen.getByText('Design, Code, Test')).toBeInTheDocument();
  });

  it('renders hatched bar label', () => {
    render(<ChartLegend {...defaultProps} />);

    expect(screen.getByText('Delivery Uncertainty')).toBeInTheDocument();
  });

  it('shows Today line legend when showTodayLine is true', () => {
    render(<ChartLegend {...defaultProps} showTodayLine={true} />);

    expect(screen.getByText(/Today.*Date/)).toBeInTheDocument();
  });

  it('hides Today line legend when showTodayLine is false', () => {
    render(<ChartLegend {...defaultProps} showTodayLine={false} />);

    expect(screen.queryByText(/Today.*Date/)).not.toBeInTheDocument();
  });

  it('shows finish date legend when both toggle and project finish date exist', () => {
    render(
      <ChartLegend
        {...defaultProps}
        showFinishDateLine={true}
        hasProjectFinishDate={true}
      />
    );

    expect(screen.getByText('Project Finish Date')).toBeInTheDocument();
  });

  it('hides finish date legend when toggle is off', () => {
    render(
      <ChartLegend
        {...defaultProps}
        showFinishDateLine={false}
        hasProjectFinishDate={true}
      />
    );

    expect(screen.queryByText('Project Finish Date')).not.toBeInTheDocument();
  });

  it('hides finish date legend when no project finish date', () => {
    render(
      <ChartLegend
        {...defaultProps}
        showFinishDateLine={true}
        hasProjectFinishDate={false}
      />
    );

    expect(screen.queryByText('Project Finish Date')).not.toBeInTheDocument();
  });

  it('calls onStartEditLabel when solid label is clicked', () => {
    const onStart = vi.fn();
    render(<ChartLegend {...defaultProps} onStartEditLabel={onStart} />);

    fireEvent.click(screen.getByText('Design, Code, Test'));
    expect(onStart).toHaveBeenCalledWith('solid');
  });

  it('calls onStartEditLabel when hatched label is clicked', () => {
    const onStart = vi.fn();
    render(<ChartLegend {...defaultProps} onStartEditLabel={onStart} />);

    fireEvent.click(screen.getByText('Delivery Uncertainty'));
    expect(onStart).toHaveBeenCalledWith('hatched');
  });

  it('shows edit input when editing solid label', () => {
    render(
      <ChartLegend
        {...defaultProps}
        editingLegendLabel="solid"
        tempLabelValue="New Label"
      />
    );

    const input = screen.getByDisplayValue('New Label');
    expect(input).toBeInTheDocument();
  });

  it('shows edit input when editing hatched label', () => {
    render(
      <ChartLegend
        {...defaultProps}
        editingLegendLabel="hatched"
        tempLabelValue="New Hatched"
      />
    );

    const input = screen.getByDisplayValue('New Hatched');
    expect(input).toBeInTheDocument();
  });

  it('does not allow editing in readOnly mode', () => {
    const onStart = vi.fn();
    render(
      <ChartLegend
        {...defaultProps}
        readOnly={true}
        onStartEditLabel={onStart}
      />
    );

    fireEvent.click(screen.getByText('Design, Code, Test'));
    expect(onStart).not.toHaveBeenCalled();
  });

  it('shows Completed legend when hasCompletedReleases is true', () => {
    render(<ChartLegend {...defaultProps} hasCompletedReleases={true} />);

    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('hides Completed legend when hasCompletedReleases is false', () => {
    render(<ChartLegend {...defaultProps} hasCompletedReleases={false} />);

    expect(screen.queryByText('Completed')).not.toBeInTheDocument();
  });

  it('shows In Progress legend when hasInProgressReleases is true', () => {
    render(<ChartLegend {...defaultProps} hasInProgressReleases={true} />);

    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('hides In Progress legend when hasInProgressReleases is false', () => {
    render(<ChartLegend {...defaultProps} hasInProgressReleases={false} />);

    expect(screen.queryByText('In Progress')).not.toBeInTheDocument();
  });

  it('renders custom inProgressLabel when hasInProgressReleases is true', () => {
    render(<ChartLegend {...defaultProps} hasInProgressReleases={true} inProgressLabel="Active Work" />);

    expect(screen.getByText('Active Work')).toBeInTheDocument();
  });

  it('enters edit mode when In Progress label is clicked', () => {
    const onStartEditLabel = vi.fn();
    render(
      <ChartLegend
        {...defaultProps}
        hasInProgressReleases={true}
        onStartEditLabel={onStartEditLabel}
      />
    );

    fireEvent.click(screen.getByText('In Progress'));
    expect(onStartEditLabel).toHaveBeenCalledWith('inProgress');
  });

  it('shows edit input for In Progress label when editing', () => {
    render(
      <ChartLegend
        {...defaultProps}
        hasInProgressReleases={true}
        editingLegendLabel="inProgress"
        tempLabelValue="Active Work"
      />
    );

    const input = screen.getByDisplayValue('Active Work');
    expect(input).toBeInTheDocument();
  });

  it('shows edit input for finish date label when editing', () => {
    render(
      <ChartLegend
        {...defaultProps}
        showFinishDateLine={true}
        hasProjectFinishDate={true}
        editingLegendLabel="finishDate"
        tempLabelValue="Custom Finish"
      />
    );

    expect(screen.getByDisplayValue('Custom Finish')).toBeInTheDocument();
  });

  it('shows Most Likely Finish legend when toggle on and releases have ML dates', () => {
    render(
      <ChartLegend
        {...defaultProps}
        showMostLikelyLine={true}
        hasMostLikelyReleases={true}
      />
    );

    expect(screen.getByText('Most Likely Finish')).toBeInTheDocument();
  });

  it('hides Most Likely Finish legend when toggle is off', () => {
    render(
      <ChartLegend
        {...defaultProps}
        showMostLikelyLine={false}
        hasMostLikelyReleases={true}
      />
    );

    expect(screen.queryByText('Most Likely Finish')).not.toBeInTheDocument();
  });

  it('hides Most Likely Finish legend when no releases have ML dates', () => {
    render(
      <ChartLegend
        {...defaultProps}
        showMostLikelyLine={true}
        hasMostLikelyReleases={false}
      />
    );

    expect(screen.queryByText('Most Likely Finish')).not.toBeInTheDocument();
  });

  it('shows edit input for Most Likely Finish label when editing', () => {
    render(
      <ChartLegend
        {...defaultProps}
        showMostLikelyLine={true}
        hasMostLikelyReleases={true}
        editingLegendLabel="mostLikelyLine"
        tempLabelValue="Best Estimate"
      />
    );

    expect(screen.getByDisplayValue('Best Estimate')).toBeInTheDocument();
  });

  it('calls onStartEditLabel with mostLikelyLine when ML label is clicked', () => {
    const onStart = vi.fn();
    render(
      <ChartLegend
        {...defaultProps}
        showMostLikelyLine={true}
        hasMostLikelyReleases={true}
        onStartEditLabel={onStart}
      />
    );

    fireEvent.click(screen.getByText('Most Likely Finish'));
    expect(onStart).toHaveBeenCalledWith('mostLikelyLine');
  });

  // --- v16.1: per-project legend label overrides ---

  describe('per-project override UI (v16.1)', () => {
    it('renders label in italic when project override is active for that key', () => {
      render(
        <ChartLegend
          {...defaultProps}
          solidBarLabel="Custom Solid"
          projectLegendLabels={{ solidBar: 'Custom Solid' }}
        />
      );
      const span = screen.getByText('Custom Solid');
      expect(span).toHaveStyle({ fontStyle: 'italic' });
    });

    it('renders label in normal style when no project override is active', () => {
      render(
        <ChartLegend {...defaultProps} projectLegendLabels={undefined} />
      );
      const span = screen.getByText('Design, Code, Test');
      expect(span).toHaveStyle({ fontStyle: 'normal' });
    });

    it('shows ↺ reset button when project override is active', () => {
      render(
        <ChartLegend
          {...defaultProps}
          solidBarLabel="Custom Solid"
          projectLegendLabels={{ solidBar: 'Custom Solid' }}
        />
      );
      // Query by title attribute since the button content is ↺
      const buttons = screen.getAllByTitle('Reset to global label');
      expect(buttons).toHaveLength(1);
    });

    it('calls onClearProjectLabelOverride with correct key when reset button clicked', () => {
      const onClear = vi.fn();
      render(
        <ChartLegend
          {...defaultProps}
          solidBarLabel="Custom Solid"
          projectLegendLabels={{ solidBar: 'Custom Solid' }}
          onClearProjectLabelOverride={onClear}
        />
      );
      fireEvent.click(screen.getByTitle('Reset to global label'));
      expect(onClear).toHaveBeenCalledWith('solidBar');
    });

    it('does not show reset button when readOnly', () => {
      render(
        <ChartLegend
          {...defaultProps}
          solidBarLabel="Custom Solid"
          projectLegendLabels={{ solidBar: 'Custom Solid' }}
          readOnly={true}
        />
      );
      expect(screen.queryByTitle('Reset to global label')).not.toBeInTheDocument();
    });

    it('shows project-scope editing hint when hasActiveProject is true', () => {
      render(
        <ChartLegend {...defaultProps} hasActiveProject={true} />
      );
      expect(screen.getByText(/Editing labels saves to this project only/i)).toBeInTheDocument();
    });

    it('does not show editing hint when readOnly', () => {
      render(
        <ChartLegend {...defaultProps} hasActiveProject={true} readOnly={true} />
      );
      expect(screen.queryByText(/Editing labels saves to this project only/i)).not.toBeInTheDocument();
    });

    it('does not show editing hint when no active project', () => {
      render(
        <ChartLegend {...defaultProps} hasActiveProject={false} />
      );
      expect(screen.queryByText(/Editing labels saves to this project only/i)).not.toBeInTheDocument();
    });

    it('reset button passes correct key for each of the five label types', () => {
      const onClear = vi.fn();
      render(
        <ChartLegend
          {...defaultProps}
          showFinishDateLine={true}
          hasProjectFinishDate={true}
          showMostLikelyLine={true}
          hasMostLikelyReleases={true}
          hasInProgressReleases={true}
          solidBarLabel="S"
          hatchedBarLabel="H"
          finishDateLabel="F"
          mostLikelyLineLabel="M"
          inProgressLabel="I"
          projectLegendLabels={{
            solidBar: 'S',
            hatchedBar: 'H',
            finishDateLine: 'F',
            mostLikelyLine: 'M',
            inProgress: 'I',
          }}
          onClearProjectLabelOverride={onClear}
        />
      );
      const buttons = screen.getAllByTitle('Reset to global label');
      expect(buttons).toHaveLength(5);
      // Clicking each in order should pass the correct key.
      // Legend order: Completed → In Progress → Solid → Hatched → Today → Finish Date → Most Likely
      // (Completed is not editable so buttons are: In Progress, Solid, Hatched, Finish Date, Most Likely)
      buttons.forEach(b => fireEvent.click(b));
      const calls = onClear.mock.calls.map(c => c[0]);
      // Assert set of keys (order is based on JSX order in legend)
      expect(new Set(calls)).toEqual(
        new Set(['inProgress', 'solidBar', 'hatchedBar', 'finishDateLine', 'mostLikelyLine'])
      );
    });
  });
});
