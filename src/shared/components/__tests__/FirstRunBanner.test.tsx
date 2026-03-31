// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FirstRunBanner } from '../FirstRunBanner';
import { ThemeWrapper } from '../../../test/ThemeWrapper';

const FIRST_RUN_KEY = 'spert_firstRun_seen';

describe('FirstRunBanner', () => {
  beforeEach(() => {
    localStorage.removeItem(FIRST_RUN_KEY);
  });

  it('renders when spert_firstRun_seen is absent from localStorage', () => {
    render(<FirstRunBanner />, { wrapper: ThemeWrapper });
    expect(screen.getByText(/SPERT® Suite web apps/)).toBeTruthy();
  });

  it('does not render when spert_firstRun_seen is "true"', () => {
    localStorage.setItem(FIRST_RUN_KEY, 'true');
    const { container } = render(<FirstRunBanner />, { wrapper: ThemeWrapper });
    expect(container.firstChild).toBeNull();
  });

  it('clicking "Got it" sets localStorage and hides the banner', () => {
    const { container } = render(<FirstRunBanner />, { wrapper: ThemeWrapper });
    expect(screen.getByText(/SPERT® Suite web apps/)).toBeTruthy();

    fireEvent.click(screen.getByText('Got it'));

    expect(localStorage.getItem(FIRST_RUN_KEY)).toBe('true');
    expect(container.firstChild).toBeNull();
  });

  it('dismiss button is labeled exactly "Got it"', () => {
    render(<FirstRunBanner />, { wrapper: ThemeWrapper });
    const button = screen.getByRole('button');
    expect(button.textContent).toBe('Got it');
  });

  it('contains Terms of Service link', () => {
    render(<FirstRunBanner />, { wrapper: ThemeWrapper });
    const link = screen.getByText('Terms of Service');
    expect(link.getAttribute('href')).toBe('https://spertsuite.com/TOS.pdf');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('contains Privacy Policy link', () => {
    render(<FirstRunBanner />, { wrapper: ThemeWrapper });
    const link = screen.getByText('Privacy Policy');
    expect(link.getAttribute('href')).toBe('https://spertsuite.com/PRIVACY.pdf');
    expect(link.getAttribute('target')).toBe('_blank');
  });
});
