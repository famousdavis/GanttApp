// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InlineTextEditor } from '../InlineTextEditor';

describe('InlineTextEditor', () => {
  const defaultProps = {
    value: 'Release Name',
    onChange: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn()
  };

  it('renders with the provided value', () => {
    render(<InlineTextEditor {...defaultProps} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('Release Name');
  });

  it('calls onChange when text is changed', () => {
    const onChange = vi.fn();
    render(<InlineTextEditor {...defaultProps} onChange={onChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'New Name' } });

    expect(onChange).toHaveBeenCalledWith('New Name');
  });

  it('calls onSave when Enter is pressed', () => {
    const onSave = vi.fn();
    render(<InlineTextEditor {...defaultProps} onSave={onSave} />);

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSave).toHaveBeenCalled();
  });

  it('calls onCancel when Escape is pressed', () => {
    const onCancel = vi.fn();
    render(<InlineTextEditor {...defaultProps} onCancel={onCancel} />);

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when input loses focus', () => {
    const onCancel = vi.fn();
    render(<InlineTextEditor {...defaultProps} onCancel={onCancel} />);

    const input = screen.getByRole('textbox');
    fireEvent.blur(input);

    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onSave when save button is clicked', () => {
    const onSave = vi.fn();
    render(<InlineTextEditor {...defaultProps} onSave={onSave} />);

    const saveButton = screen.getByTitle('Save');
    fireEvent.mouseDown(saveButton);

    expect(onSave).toHaveBeenCalled();
  });

  it('uses default fontSize if not provided', () => {
    render(<InlineTextEditor {...defaultProps} />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveStyle({ fontSize: '16px' });
  });

  it('uses custom fontSize when provided', () => {
    render(<InlineTextEditor {...defaultProps} fontSize="18px" />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveStyle({ fontSize: '18px' });
  });

  it('uses default width if not provided', () => {
    render(<InlineTextEditor {...defaultProps} />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveStyle({ width: '240px' });
  });

  it('uses custom width when provided', () => {
    render(<InlineTextEditor {...defaultProps} width="300px" />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveStyle({ width: '300px' });
  });

  it('has bold font weight', () => {
    render(<InlineTextEditor {...defaultProps} />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveStyle({ fontWeight: '600' });
  });

});
