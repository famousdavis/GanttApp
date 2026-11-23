// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The frame's brand (FRAME26, contract §3 "Brand link", v0.34.0): one link to the collection screen, named by its
// visible title (WCAG 2.5.3, label in name), holding both favicons and the title, which is not a heading.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AppHeader } from '../AppHeader';

vi.mock('../StorageStatusChip', () => ({
  StorageStatusChip: () => <button type="button" data-sf="chip">Sign in</button>,
}));
vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ mode: 'system', setMode: vi.fn() }),
}));

function renderHeader() {
  const onNavigateHome = vi.fn();
  render(<AppHeader onNavigateHome={onNavigateHome} onOpenAccount={vi.fn()} />);
  const brand = screen.getByRole('link', { name: 'GanttApp™' });
  return { brand, onNavigateHome };
}

describe('the brand link', () => {
  it('is an <a href="/"> named by its visible title "GanttApp™", with no aria-label', () => {
    const { brand } = renderHeader();
    expect(brand.tagName).toBe('A');
    expect(brand).toHaveAttribute('href', '/');
    expect(brand).toHaveClass('sf-brand');
    expect(brand.getAttribute('data-sf')).toBe('brand');
    expect(brand.hasAttribute('aria-label')).toBe(false);
    expect(brand.hasAttribute('aria-labelledby')).toBe(false);
    expect(within(brand).getByText('GanttApp').closest('[data-sf="title"]')).toHaveTextContent('GanttApp™');
  });

  it('holds both favicons, decorative, each with its theme class, and the title, which is not a heading', () => {
    const { brand } = renderHeader();
    const icons = Array.from(brand.querySelectorAll('img'));
    expect(icons.map((i) => [i.getAttribute('src'), i.getAttribute('alt'), i.className, i.getAttribute('data-sf')])).toEqual([
      ['/spert-favicon-ganttapp.png', '', 'sf-icon sf-icon--light', 'favicon'],
      ['/spert-favicon-ganttapp-dark.png', '', 'sf-icon sf-icon--dark', 'favicon'],
    ]);
    expect(screen.queryAllByRole('heading')).toEqual([]);
    expect(brand.querySelector('h1, h2, h3, [role="heading"]')).toBeNull();
  });

  it('the header holds the tagline, then the theme button and the chip, in the utilities', () => {
    renderHeader();
    const header = document.querySelector('header')!;
    expect(header).toHaveClass('sf-bar');
    expect(header.querySelector('[data-sf="tagline"]')).toHaveTextContent('Visualize release date uncertainty in your project timeline');
    const utils = header.querySelector('[data-sf="utils"]')!;
    expect(Array.from(utils.children).map((c) => c.getAttribute('data-sf'))).toEqual(['theme', 'chip']);
  });

  it('a plain click shows Projects in place: the app handles it and the browser does not follow the link', () => {
    const { brand, onNavigateHome } = renderHeader();
    const notPrevented = fireEvent.click(brand, { button: 0 });
    expect(onNavigateHome).toHaveBeenCalledTimes(1);
    expect(notPrevented).toBe(false); // preventDefault was called
  });

  for (const [what, init] of [
    ['meta', { metaKey: true }], ['ctrl', { ctrlKey: true }], ['shift', { shiftKey: true }], ['alt', { altKey: true }],
    ['middle', { button: 1 }],
  ] as const) {
    it(`a ${what} click is left to the browser (a new tab or window): the app does nothing`, () => {
      const { brand, onNavigateHome } = renderHeader();
      fireEvent.click(brand, init);
      expect(onNavigateHome).not.toHaveBeenCalled();
    });
  }
});
