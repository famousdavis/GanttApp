// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InlineDateEditor } from '../InlineDateEditor';

describe('InlineDateEditor', () => {
  const defaultProps = {
    value: '2026-01-15',
    onChange: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    hasError: false
  };

  const getDateInput = () => document.querySelector('input[type="date"]') as HTMLInputElement;

  it('renders with the provided value', () => {
    render(<InlineDateEditor {...defaultProps} />);
    const input = getDateInput();
    expect(input).toBeTruthy();
    expect(input.value).toBe('2026-01-15');
  });

  it('calls onChange when date is changed', () => {
    const onChange = vi.fn();
    render(<InlineDateEditor {...defaultProps} onChange={onChange} />);

    const input = getDateInput();
    fireEvent.change(input, { target: { value: '2026-02-20' } });

    expect(onChange).toHaveBeenCalledWith('2026-02-20');
  });

  it('calls onSave when Enter is pressed', () => {
    const onSave = vi.fn();
    render(<InlineDateEditor {...defaultProps} onSave={onSave} />);

    const input = getDateInput();
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSave).toHaveBeenCalled();
  });

  it('calls onCancel when Escape is pressed', () => {
    const onCancel = vi.fn();
    render(<InlineDateEditor {...defaultProps} onCancel={onCancel} />);

    const input = getDateInput();
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when input loses focus', () => {
    const onCancel = vi.fn();
    render(<InlineDateEditor {...defaultProps} onCancel={onCancel} />);

    const input = getDateInput();
    fireEvent.blur(input);

    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onSave when save button is clicked', () => {
    const onSave = vi.fn();
    render(<InlineDateEditor {...defaultProps} onSave={onSave} />);

    const saveButton = screen.getByTitle('Save');
    fireEvent.mouseDown(saveButton);

    expect(onSave).toHaveBeenCalled();
  });

  it('shows error border when hasError is true', () => {
    render(<InlineDateEditor {...defaultProps} hasError={true} />);

    const input = getDateInput();
    expect(input.style.border).toBe('2px solid rgb(220, 53, 69)');
  });

  it('shows normal border when hasError is false', () => {
    render(<InlineDateEditor {...defaultProps} hasError={false} />);

    const input = getDateInput();
    expect(input.style.border).toBe('1px solid rgb(0, 112, 243)');
  });

  it('has correct date constraints', () => {
    render(<InlineDateEditor {...defaultProps} />);

    const input = getDateInput();
    expect(input.min).toBe('2000-01-01');
    expect(input.max).toBe('2050-12-31');
  });

});
