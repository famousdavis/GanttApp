// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChartSettings } from '../ChartSettings';
import { ThemeProvider } from '../../../context/ThemeContext';
import { DEFAULT_CHART_COLORS, DEFAULT_DISPLAY_SETTINGS } from '../../../shared/utils/colors';

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('ChartSettings', () => {
  const defaultProps = {
    showColorSettings: false,
    setShowColorSettings: vi.fn(),
    showTodayLine: false,
    setShowTodayLine: vi.fn(),
    showFinishDateLine: false,
    setShowFinishDateLine: vi.fn(),
    hasProjectFinishDate: false,
    hasMostLikelyReleases: false,
    showMostLikelyLine: false,
    setShowMostLikelyLine: vi.fn(),
    showMonths: false,
    setShowMonths: vi.fn(),
    displaySettings: DEFAULT_DISPLAY_SETTINGS,
    setDisplaySettings: vi.fn(),
    chartColors: DEFAULT_CHART_COLORS,
    onColorsChange: vi.fn(),
    activePreset: 'Default',
    preparedBy: '',
    setPreparedBy: vi.fn(),
    showPreparedBy: false,
    setShowPreparedBy: vi.fn()
  };

  it('renders the Chart Settings header', () => {
    renderWithTheme(<ChartSettings {...defaultProps} />);

    expect(screen.getByText(/Chart Settings/)).toBeInTheDocument();
  });

  it('shows collapsed state with down arrow', () => {
    renderWithTheme(<ChartSettings {...defaultProps} showColorSettings={false} />);

    expect(screen.getByText(/▼/)).toBeInTheDocument();
  });

  it('shows expanded state with up arrow', () => {
    renderWithTheme(<ChartSettings {...defaultProps} showColorSettings={true} />);

    expect(screen.getByText(/▲/)).toBeInTheDocument();
  });

  it('calls setShowColorSettings when header is clicked', () => {
    const setShow = vi.fn();
    renderWithTheme(
      <ChartSettings {...defaultProps} showColorSettings={false} setShowColorSettings={setShow} />
    );

    fireEvent.click(screen.getByText(/Chart Settings/));
    expect(setShow).toHaveBeenCalledWith(true);
  });

  it('shows toggle checkboxes when expanded', () => {
    renderWithTheme(
      <ChartSettings {...defaultProps} showColorSettings={true} />
    );

    expect(screen.getByText(/Show Today.*Date/)).toBeInTheDocument();
    expect(screen.getByText('Show Prepared By')).toBeInTheDocument();
  });

  it('shows Show Finish Date checkbox when project has finish date', () => {
    renderWithTheme(
      <ChartSettings {...defaultProps} showColorSettings={true} hasProjectFinishDate={true} />
    );

    expect(screen.getByText('Show Finish Date')).toBeInTheDocument();
  });

  it('hides Show Finish Date checkbox when no finish date', () => {
    renderWithTheme(
      <ChartSettings {...defaultProps} showColorSettings={true} hasProjectFinishDate={false} />
    );

    expect(screen.queryByText('Show Finish Date')).not.toBeInTheDocument();
  });

  it('calls setShowTodayLine when checkbox is toggled', () => {
    const setTodayLine = vi.fn();
    renderWithTheme(
      <ChartSettings {...defaultProps} showColorSettings={true} setShowTodayLine={setTodayLine} />
    );

    // Find the label containing "Show Today's Date" and click its checkbox
    const label = screen.getByText(/Show Today.*Date/).closest('label');
    const checkbox = label?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(setTodayLine).toHaveBeenCalled();
  });

  it('renders Prepared By text input when expanded', () => {
    renderWithTheme(
      <ChartSettings {...defaultProps} showColorSettings={true} preparedBy="William" />
    );

    expect(screen.getByDisplayValue('William')).toBeInTheDocument();
  });

  it('calls setPreparedBy when text input changes', () => {
    const setPrepared = vi.fn();
    renderWithTheme(
      <ChartSettings {...defaultProps} showColorSettings={true} setPreparedBy={setPrepared} />
    );

    const input = screen.getByPlaceholderText('Enter your name');
    fireEvent.change(input, { target: { value: 'Jane' } });
    expect(setPrepared).toHaveBeenCalledWith('Jane');
  });

  it('renders color presets when expanded', () => {
    renderWithTheme(
      <ChartSettings {...defaultProps} showColorSettings={true} />
    );

    expect(screen.getByText('Color Presets')).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getByText('Professional')).toBeInTheDocument();
    expect(screen.getByText('Ocean')).toBeInTheDocument();
  });

  it('calls onColorsChange when a preset is clicked', () => {
    const onColors = vi.fn();
    renderWithTheme(
      <ChartSettings {...defaultProps} showColorSettings={true} onColorsChange={onColors} />
    );

    fireEvent.click(screen.getByText('Forest'));
    expect(onColors).toHaveBeenCalled();
    expect(onColors.mock.calls[0][1]).toBe('Forest');
  });

  it('does not render settings panel when collapsed', () => {
    renderWithTheme(<ChartSettings {...defaultProps} showColorSettings={false} />);

    expect(screen.queryByText('Color Presets')).not.toBeInTheDocument();
    expect(screen.queryByText(/Show Today.*Date/)).not.toBeInTheDocument();
  });

  it('shows Show Most Likely Finish checkbox when releases have ML dates', () => {
    renderWithTheme(
      <ChartSettings {...defaultProps} showColorSettings={true} hasMostLikelyReleases={true} />
    );

    expect(screen.getByText('Show Most Likely Finish')).toBeInTheDocument();
  });

  it('hides Show Most Likely Finish checkbox when no releases have ML dates', () => {
    renderWithTheme(
      <ChartSettings {...defaultProps} showColorSettings={true} hasMostLikelyReleases={false} />
    );

    expect(screen.queryByText('Show Most Likely Finish')).not.toBeInTheDocument();
  });

  it('calls setShowMostLikelyLine when ML checkbox is toggled', () => {
    const setMl = vi.fn();
    renderWithTheme(
      <ChartSettings
        {...defaultProps}
        showColorSettings={true}
        hasMostLikelyReleases={true}
        setShowMostLikelyLine={setMl}
      />
    );

    const label = screen.getByText('Show Most Likely Finish').closest('label');
    const checkbox = label?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(setMl).toHaveBeenCalled();
  });

  it('shows Most Likely color picker when toggle is on', () => {
    renderWithTheme(
      <ChartSettings
        {...defaultProps}
        showColorSettings={true}
        showMostLikelyLine={true}
        hasMostLikelyReleases={true}
      />
    );

    expect(screen.getByText('Most Likely')).toBeInTheDocument();
  });

  it('hides Most Likely color picker when toggle is off', () => {
    renderWithTheme(
      <ChartSettings
        {...defaultProps}
        showColorSettings={true}
        showMostLikelyLine={false}
        hasMostLikelyReleases={true}
      />
    );

    expect(screen.queryByText('Most Likely')).not.toBeInTheDocument();
  });

  it('shows Completed color picker when expanded', () => {
    renderWithTheme(
      <ChartSettings {...defaultProps} showColorSettings={true} />
    );

    expect(screen.getByText('Completed')).toBeInTheDocument();
  });
});
