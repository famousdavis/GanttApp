// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Adding a guide to public/? Also add it, with a one-line description, to spertsuite.com's
// src/data/help.ts (spert-landing-page). The landing page's daily "Guide list matches the app
// repos" check stays red until you do. The PDF guide house rules say the same.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AboutTab } from '../AboutTab';
import { ThemeWrapper } from '../../../test/ThemeWrapper';

describe('AboutTab', () => {
  it('renders without crashing', () => {
    const { container } = render(<AboutTab />, { wrapper: ThemeWrapper });
    expect(container.firstChild).toBeTruthy();
  });

  it('renders the About This App heading', () => {
    render(<AboutTab />, { wrapper: ThemeWrapper });
    expect(screen.getByText('About This App')).toBeTruthy();
  });

  it('renders the Purpose section', () => {
    render(<AboutTab />, { wrapper: ThemeWrapper });
    expect(screen.getByText('Purpose')).toBeTruthy();
  });

  it('renders the author name', () => {
    render(<AboutTab />, { wrapper: ThemeWrapper });
    expect(screen.getByText(/William W. Davis/)).toBeTruthy();
  });

  it('renders Your Data & Storage Options section', () => {
    render(<AboutTab />, { wrapper: ThemeWrapper });
    expect(screen.getByText(/Your Data & Storage Options/)).toBeTruthy();
  });

  it('renders Local Storage and Cloud Storage subsections', () => {
    render(<AboutTab />, { wrapper: ThemeWrapper });
    expect(screen.getByText('Local Storage (Default)')).toBeTruthy();
    expect(screen.getByText('Cloud Storage (Optional)')).toBeTruthy();
  });

  it('mentions the Settings tab for mode switching', () => {
    render(<AboutTab />, { wrapper: ThemeWrapper });
    expect(screen.getByText(/Settings/)).toBeTruthy();
  });
});
