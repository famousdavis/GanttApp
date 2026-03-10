// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorSwatchPicker } from '../ColorSwatchPicker';
import { ThemeWrapper } from '../../../../test/ThemeWrapper';

describe('ColorSwatchPicker', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders label text', () => {
    render(<ColorSwatchPicker label="Solid Bar Color" value="#0070f3" onChange={mockOnChange} />, { wrapper: ThemeWrapper });
    expect(screen.getByText('Solid Bar Color')).toBeTruthy();
  });

  it('renders color swatch button with current value as background', () => {
    const { container } = render(<ColorSwatchPicker label="Color" value="#ff0000" onChange={mockOnChange} />, { wrapper: ThemeWrapper });
    const mainSwatch = container.querySelector('div[style*="height: 40px"]') as HTMLElement;
    // jsdom converts hex to rgb
    expect(mainSwatch.style.background).toContain('255, 0, 0');
  });

  it('picker dropdown is hidden by default', () => {
    render(<ColorSwatchPicker label="Color" value="#0070f3" onChange={mockOnChange} />, { wrapper: ThemeWrapper });
    expect(screen.queryByText('Custom Color')).toBeNull();
  });

  it('shows picker dropdown when swatch is clicked', () => {
    const { container } = render(<ColorSwatchPicker label="Color" value="#0070f3" onChange={mockOnChange} />, { wrapper: ThemeWrapper });
    const mainSwatch = container.querySelector('div[style*="height: 40px"]') as HTMLElement;
    fireEvent.click(mainSwatch);
    expect(screen.getByText('Custom Color')).toBeTruthy();
  });

  it('hides picker when swatch is clicked again (toggle)', () => {
    const { container } = render(<ColorSwatchPicker label="Color" value="#0070f3" onChange={mockOnChange} />, { wrapper: ThemeWrapper });
    const mainSwatch = container.querySelector('div[style*="height: 40px"]') as HTMLElement;

    fireEvent.click(mainSwatch);
    expect(screen.getByText('Custom Color')).toBeTruthy();

    fireEvent.click(mainSwatch);
    expect(screen.queryByText('Custom Color')).toBeNull();
  });

  it('renders 20 standard color swatches when open', () => {
    const { container } = render(<ColorSwatchPicker label="Color" value="#0070f3" onChange={mockOnChange} />, { wrapper: ThemeWrapper });
    const mainSwatch = container.querySelector('div[style*="height: 40px"]') as HTMLElement;
    fireEvent.click(mainSwatch);

    // 20 standard colors each have a title attribute
    expect(screen.getByTitle('Red')).toBeTruthy();
    expect(screen.getByTitle('Blue')).toBeTruthy();
    expect(screen.getByTitle('Green')).toBeTruthy();
    expect(screen.getByTitle('Black')).toBeTruthy();

    // Count all color swatches (those with title attributes inside the grid)
    const colorSwatches = container.querySelectorAll('div[title]');
    expect(colorSwatches.length).toBe(20);
  });

  it('calls onChange when a standard color swatch is clicked', () => {
    const { container } = render(<ColorSwatchPicker label="Color" value="#0070f3" onChange={mockOnChange} />, { wrapper: ThemeWrapper });
    const mainSwatch = container.querySelector('div[style*="height: 40px"]') as HTMLElement;
    fireEvent.click(mainSwatch);

    fireEvent.click(screen.getByTitle('Red'));
    expect(mockOnChange).toHaveBeenCalledWith('#dc2626');
  });

  it('closes picker after selecting a standard color', () => {
    const { container } = render(<ColorSwatchPicker label="Color" value="#0070f3" onChange={mockOnChange} />, { wrapper: ThemeWrapper });
    const mainSwatch = container.querySelector('div[style*="height: 40px"]') as HTMLElement;
    fireEvent.click(mainSwatch);

    fireEvent.click(screen.getByTitle('Red'));
    expect(screen.queryByText('Custom Color')).toBeNull();
  });

  it('renders custom color input in the dropdown', () => {
    const { container } = render(<ColorSwatchPicker label="Color" value="#0070f3" onChange={mockOnChange} />, { wrapper: ThemeWrapper });
    const mainSwatch = container.querySelector('div[style*="height: 40px"]') as HTMLElement;
    fireEvent.click(mainSwatch);

    const colorInput = container.querySelector('input[type="color"]');
    expect(colorInput).toBeTruthy();
  });

  it('calls onChange when custom color input changes', () => {
    const { container } = render(<ColorSwatchPicker label="Color" value="#0070f3" onChange={mockOnChange} />, { wrapper: ThemeWrapper });
    const mainSwatch = container.querySelector('div[style*="height: 40px"]') as HTMLElement;
    fireEvent.click(mainSwatch);

    const colorInput = container.querySelector('input[type="color"]') as HTMLInputElement;
    fireEvent.change(colorInput, { target: { value: '#abcdef' } });
    expect(mockOnChange).toHaveBeenCalledWith('#abcdef');
  });
});
