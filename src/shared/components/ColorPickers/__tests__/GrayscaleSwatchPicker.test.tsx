import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GrayscaleSwatchPicker } from '../GrayscaleSwatchPicker';

describe('GrayscaleSwatchPicker', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders label text', () => {
    render(<GrayscaleSwatchPicker label="Date Label Color" value="#666" onChange={mockOnChange} />);
    expect(screen.getByText('Date Label Color')).toBeTruthy();
  });

  it('renders 4 grayscale swatches', () => {
    render(<GrayscaleSwatchPicker label="Color" value="#666" onChange={mockOnChange} />);
    expect(screen.getByTitle('Light Gray')).toBeTruthy();
    expect(screen.getByTitle('Gray')).toBeTruthy();
    expect(screen.getByTitle('Dark Gray')).toBeTruthy();
    expect(screen.getByTitle('Black')).toBeTruthy();
  });

  it('calls onChange with correct hex value when swatch is clicked', () => {
    render(<GrayscaleSwatchPicker label="Color" value="#666" onChange={mockOnChange} />);
    fireEvent.click(screen.getByTitle('Dark Gray'));
    expect(mockOnChange).toHaveBeenCalledWith('#333');
  });

  it('calls onChange with black when Black swatch is clicked', () => {
    render(<GrayscaleSwatchPicker label="Color" value="#666" onChange={mockOnChange} />);
    fireEvent.click(screen.getByTitle('Black'));
    expect(mockOnChange).toHaveBeenCalledWith('#000');
  });

  it('marks active swatch with blue border', () => {
    render(<GrayscaleSwatchPicker label="Color" value="#666" onChange={mockOnChange} />);
    const activeSwatch = screen.getByTitle('Gray');
    expect(activeSwatch.style.borderWidth).toBe('3px');
    expect(activeSwatch.style.borderStyle).toBe('solid');
  });

  it('marks inactive swatch with thinner border', () => {
    render(<GrayscaleSwatchPicker label="Color" value="#666" onChange={mockOnChange} />);
    const inactiveSwatch = screen.getByTitle('Light Gray');
    expect(inactiveSwatch.style.borderWidth).toBe('2px');
    expect(inactiveSwatch.style.borderStyle).toBe('solid');
  });
});
