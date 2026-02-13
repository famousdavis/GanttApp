import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChartLegend } from '../ChartLegend';
import { DEFAULT_CHART_COLORS, DEFAULT_DISPLAY_SETTINGS } from '../../../shared/utils/colors';

describe('ChartLegend', () => {
  const defaultProps = {
    chartColors: DEFAULT_CHART_COLORS,
    displaySettings: DEFAULT_DISPLAY_SETTINGS,
    solidBarLabel: 'Design, Code, Test',
    hatchedBarLabel: 'Delivery Uncertainty',
    finishDateLabel: 'Project Finish Date',
    mostLikelyLineLabel: 'Most Likely Finish',
    showTodayLine: false,
    showFinishDateLine: false,
    showMostLikelyLine: false,
    hasProjectFinishDate: false,
    hasMostLikelyReleases: false,
    hasCompletedReleases: false,
    editingLegendLabel: null as 'solid' | 'hatched' | 'finishDate' | 'mostLikelyLine' | null,
    tempLabelValue: '',
    onStartEditLabel: vi.fn(),
    onSaveLabelEdit: vi.fn(),
    onCancelLabelEdit: vi.fn(),
    onTempLabelChange: vi.fn(),
    readOnly: false
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
});
