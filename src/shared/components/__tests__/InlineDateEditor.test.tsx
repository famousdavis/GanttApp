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
    onCommit: vi.fn(),
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

  // v0.28.16 (F1) — this test asserted the DEFECT until v0.28.15: blur called
  // onCancel, so clicking away destroyed the edit. Blur now commits.
  it('commits (not cancels) when the input loses focus', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const onSave = vi.fn();
    render(
      <InlineDateEditor
        {...defaultProps}
        onCommit={onCommit}
        onCancel={onCancel}
        onSave={onSave}
      />
    );

    fireEvent.blur(getDateInput());

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    // onCommit is deliberately distinct from onSave: routing blur through onSave
    // would leave the editor open on an invalid value, following the user's focus.
    expect(onSave).not.toHaveBeenCalled();
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

  // v0.28.16 (T2) — the `warning && !hasError` guard at InlineDateEditor.tsx:49
  // had both of the file's uncovered branch entries: no existing test ever
  // rendered this component with a `warning`.
  it('renders the non-workday warning when warning is set and there is no error', () => {
    render(<InlineDateEditor {...defaultProps} warning="Falls on a Saturday" />);

    expect(screen.getByText(/Falls on a Saturday/)).toBeTruthy();
  });

  it('suppresses the warning when hasError is true', () => {
    render(
      <InlineDateEditor {...defaultProps} warning="Falls on a Saturday" hasError={true} />
    );

    expect(screen.queryByText(/Falls on a Saturday/)).toBeNull();
  });

  it('renders no warning line when warning is absent', () => {
    render(<InlineDateEditor {...defaultProps} />);

    expect(screen.queryByText(/⚠/)).toBeNull();
  });

  it('has correct date constraints', () => {
    render(<InlineDateEditor {...defaultProps} />);

    const input = getDateInput();
    expect(input.min).toBe('2000-01-01');
    expect(input.max).toBe('2050-12-31');
  });

});
