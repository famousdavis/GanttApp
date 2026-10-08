// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// LocalStorageWarningBanner tests — when the local-storage caution banner
// shows, how "Got it" dismisses it for the session only, and how a change of
// storage mode re-evaluates it.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocalStorageWarningBanner } from '../LocalStorageWarningBanner';
import { LIGHT_THEME } from '../../utils/theme';

const mockUseStorage = vi.fn();
const mockUseTheme = vi.fn();

vi.mock('../../../context/StorageContext', () => ({
  useStorage: () => mockUseStorage(),
}));
vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

// The same key the Settings > Notifications toggle writes.
const SUPPRESS_KEY = 'ganttapp-suppress-local-warning';
const HEADLINE = 'Your data exists only in this browser';

function setMode(mode: 'local' | 'cloud') {
  mockUseStorage.mockReturnValue({ mode });
}

describe('LocalStorageWarningBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockUseTheme.mockReturnValue({ colors: LIGHT_THEME, resolvedTheme: 'light' });
    setMode('local');
  });

  it('shows the warning in local mode when it has not been turned off', () => {
    render(<LocalStorageWarningBanner />);
    expect(screen.getByText(HEADLINE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument();
  });

  it('stays hidden in local mode when the warning has been turned off in Settings', () => {
    const control = render(<LocalStorageWarningBanner />);
    expect(screen.getByText(HEADLINE)).toBeInTheDocument();
    control.unmount();
    localStorage.setItem(SUPPRESS_KEY, 'true');
    render(<LocalStorageWarningBanner />);
    expect(screen.queryByText(HEADLINE)).not.toBeInTheDocument();
  });

  it('stays hidden in cloud mode', () => {
    const control = render(<LocalStorageWarningBanner />);
    expect(screen.getByText(HEADLINE)).toBeInTheDocument();
    control.unmount();
    setMode('cloud');
    render(<LocalStorageWarningBanner />);
    expect(screen.queryByText(HEADLINE)).not.toBeInTheDocument();
  });

  it('"Got it" hides the warning for this session without turning it off', () => {
    const first = render(<LocalStorageWarningBanner />);
    expect(screen.getByText(HEADLINE)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByText(HEADLINE)).not.toBeInTheDocument();
    expect(localStorage.getItem(SUPPRESS_KEY)).toBeNull();
    // The next app load shows it again.
    first.unmount();
    render(<LocalStorageWarningBanner />);
    expect(screen.getByText(HEADLINE)).toBeInTheDocument();
  });

  it('shows the warning again when the mode returns to local, even after "Got it"', () => {
    const { rerender } = render(<LocalStorageWarningBanner />);
    expect(screen.getByText(HEADLINE)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByText(HEADLINE)).not.toBeInTheDocument();
    setMode('cloud');
    rerender(<LocalStorageWarningBanner />);
    expect(screen.queryByText(HEADLINE)).not.toBeInTheDocument();
    setMode('local');
    rerender(<LocalStorageWarningBanner />);
    expect(screen.getByText(HEADLINE)).toBeInTheDocument();
  });
});
