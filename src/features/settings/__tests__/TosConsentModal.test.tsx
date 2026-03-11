// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TosConsentModal } from '../TosConsentModal';
import { LIGHT_THEME } from '../../../shared/utils/theme';

describe('TosConsentModal', () => {
  const defaultProps = {
    colors: LIGHT_THEME,
    onAccept: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders modal with title', () => {
    render(<TosConsentModal {...defaultProps} />);
    expect(screen.getByText('Terms of Service & Privacy Policy')).toBeTruthy();
  });

  it('checkbox is unchecked by default', () => {
    render(<TosConsentModal {...defaultProps} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
  });

  it('"Enable Cloud Storage" button is disabled when checkbox is unchecked', () => {
    render(<TosConsentModal {...defaultProps} />);
    const button = screen.getByText('Enable Cloud Storage');
    expect(button).toBeDisabled();
  });

  it('"Enable Cloud Storage" button becomes enabled when checkbox is checked', () => {
    render(<TosConsentModal {...defaultProps} />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    const button = screen.getByText('Enable Cloud Storage');
    expect(button).not.toBeDisabled();
  });

  it('calls onAccept when "Enable Cloud Storage" clicked with checkbox checked', () => {
    const onAccept = vi.fn();
    render(<TosConsentModal {...defaultProps} onAccept={onAccept} />);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Enable Cloud Storage'));
    expect(onAccept).toHaveBeenCalledOnce();
  });

  it('does not call onAccept when button clicked with checkbox unchecked', () => {
    const onAccept = vi.fn();
    render(<TosConsentModal {...defaultProps} onAccept={onAccept} />);
    fireEvent.click(screen.getByText('Enable Cloud Storage'));
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('calls onCancel when "Cancel" clicked', () => {
    const onCancel = vi.fn();
    render(<TosConsentModal {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('contains Terms of Service link to correct URL', () => {
    render(<TosConsentModal {...defaultProps} />);
    const link = screen.getByText('Terms of Service');
    expect(link.getAttribute('href')).toBe('https://spert-landing.vercel.app/TOS.pdf');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('contains Privacy Policy link to correct URL', () => {
    render(<TosConsentModal {...defaultProps} />);
    const link = screen.getByText('Privacy Policy');
    expect(link.getAttribute('href')).toBe('https://spert-landing.vercel.app/PRIVACY.pdf');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('checkbox resets to unchecked on re-mount', () => {
    const { unmount } = render(<TosConsentModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).toBeChecked();

    unmount();

    render(<TosConsentModal {...defaultProps} />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
});
