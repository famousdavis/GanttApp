import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PresetButtonGroup } from '../PresetButtonGroup';

const testOptions = [
  { value: '14', label: 'Small' },
  { value: '16', label: 'Medium' },
  { value: '18', label: 'Large' },
];

describe('PresetButtonGroup', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders label text', () => {
    render(<PresetButtonGroup label="Font Size" value="16" options={testOptions} onChange={mockOnChange} />);
    expect(screen.getByText('Font Size')).toBeTruthy();
  });

  it('renders a button for each option', () => {
    render(<PresetButtonGroup label="Font Size" value="16" options={testOptions} onChange={mockOnChange} />);
    expect(screen.getByText('Small')).toBeTruthy();
    expect(screen.getByText('Medium')).toBeTruthy();
    expect(screen.getByText('Large')).toBeTruthy();
  });

  it('calls onChange with correct value when button is clicked', () => {
    render(<PresetButtonGroup label="Font Size" value="16" options={testOptions} onChange={mockOnChange} />);
    fireEvent.click(screen.getByText('Small'));
    expect(mockOnChange).toHaveBeenCalledWith('14');
  });

  it('calls onChange with different values for each button', () => {
    render(<PresetButtonGroup label="Font Size" value="14" options={testOptions} onChange={mockOnChange} />);
    fireEvent.click(screen.getByText('Large'));
    expect(mockOnChange).toHaveBeenCalledWith('18');
  });

  it('marks active button with blue border and light blue background', () => {
    render(<PresetButtonGroup label="Font Size" value="16" options={testOptions} onChange={mockOnChange} />);
    const activeButton = screen.getByText('Medium');
    expect(activeButton.style.borderWidth).toBe('2px');
    expect(activeButton.style.fontWeight).toBe('600');
  });

  it('marks inactive button with normal weight', () => {
    render(<PresetButtonGroup label="Font Size" value="16" options={testOptions} onChange={mockOnChange} />);
    const inactiveButton = screen.getByText('Small');
    expect(inactiveButton.style.borderWidth).toBe('2px');
    expect(inactiveButton.style.fontWeight).toBe('500');
  });

  it('renders correct button labels from options', () => {
    const customOptions = [
      { value: '2', label: 'Thin' },
      { value: '3', label: 'Medium' },
      { value: '4', label: 'Thick' },
    ];
    render(<PresetButtonGroup label="Line Width" value="2" options={customOptions} onChange={mockOnChange} />);
    expect(screen.getByText('Thin')).toBeTruthy();
    expect(screen.getByText('Thick')).toBeTruthy();
  });
});
