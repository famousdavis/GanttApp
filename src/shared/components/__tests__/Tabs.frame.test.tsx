// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The frame's navigation row (FRAME26, contract §3, v0.34.0): two zones in a fixed order, the frame's items with no
// look of their own, and exactly one current item on every screen an item leads to, none on the Changelog.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tabs } from '../Tabs';
import type { TabType } from '../../types';

const LABEL: Record<Exclude<TabType, 'changelog'>, string> = {
  projects: 'Projects', releases: 'Releases', chart: 'Gantt Chart', settings: 'Settings', about: 'About',
};
const ALL: TabType[] = ['projects', 'releases', 'chart', 'settings', 'about', 'changelog'];

function renderNav(active: TabType) {
  const onTabChange = vi.fn();
  const r = render(<Tabs activeTab={active} onTabChange={onTabChange} />);
  const nav = r.container.querySelector<HTMLElement>('nav')!;
  return { ...r, nav, onTabChange };
}

const texts = (els: Iterable<Element>) => Array.from(els).map((e) => e.textContent?.replace(/\s*↗.*$/, '').trim());

describe('the navigation row', () => {
  it('is a <nav> with the frame\'s hooks: nav, nav-work and nav-app', () => {
    const { nav } = renderNav('projects');
    expect(nav).toHaveClass('sf-nav');
    expect(nav.getAttribute('data-sf')).toBe('nav');
    expect(nav.querySelector(':scope > .sf-col.sf-nav-row')).not.toBeNull();
    expect(nav.querySelector('[data-sf="nav-work"]')).toHaveClass('sf-nav-work');
    expect(nav.querySelector('[data-sf="nav-app"]')).toHaveClass('sf-nav-app');
  });

  it('the work zone holds Projects · Releases · Gantt Chart; the app zone Settings · About · Help Center, in that order', () => {
    const { nav } = renderNav('projects');
    expect(texts(nav.querySelector('[data-sf="nav-work"]')!.children)).toEqual(['Projects', 'Releases', 'Gantt Chart']);
    expect(texts(nav.querySelector('[data-sf="nav-app"]')!.children)).toEqual(['Settings', 'About', 'Help Center']);
  });

  it('every item is the frame\'s .sf-tab button with no inline style; Help Center is .sf-help', () => {
    const { nav } = renderNav('chart');
    const buttons = Array.from(nav.querySelectorAll('button'));
    expect(buttons).toHaveLength(5);
    for (const b of buttons) {
      expect(b.className, b.textContent!).toBe('sf-tab');
      expect(b.getAttribute('type'), b.textContent!).toBe('button');
      expect(b.getAttribute('style'), b.textContent!).toBeNull();
    }
    const help = screen.getByRole('link', { name: 'Help Center (opens in a new tab)' });
    expect(help.className).toBe('sf-help');
  });

  for (const active of ALL) {
    it(`${active}: ${active === 'changelog' ? 'no item is current' : `exactly one item is current, ${LABEL[active as keyof typeof LABEL]}`}, as aria-current="page"`, () => {
      const { nav } = renderNav(active);
      const current = Array.from(nav.querySelectorAll('[aria-current]'));
      if (active === 'changelog') {
        expect(current).toEqual([]);
      } else {
        expect(current.map((e) => `${e.textContent}=${e.getAttribute('aria-current')}`)).toEqual([`${LABEL[active as keyof typeof LABEL]}=page`]);
      }
      // Never "false" or "true": an inactive item carries no aria-current at all.
      expect(nav.querySelectorAll('[aria-current="false"], [aria-current="true"]')).toHaveLength(0);
    });
  }

  // D8 (v0.34.0): Help Center keeps its hover and focus underline, but CLEARS it afterwards rather than setting 'none':
  // an inline 'none' would beat the frame's underline under prefers-contrast: more.
  it('Help Center underlines on hover and focus, and afterwards leaves no inline text-decoration behind', () => {
    renderNav('projects');
    const help = screen.getByRole('link', { name: 'Help Center (opens in a new tab)' });
    fireEvent.mouseEnter(help);
    expect(help.style.textDecoration).toBe('underline');
    fireEvent.mouseLeave(help);
    expect(help.style.textDecoration).toBe('');
    fireEvent.focus(help);
    expect(help.style.textDecoration).toBe('underline');
    fireEvent.blur(help);
    expect(help.style.textDecoration).toBe('');
  });

  it('a click on an item asks for its tab', () => {
    const { onTabChange } = renderNav('changelog');
    fireEvent.click(screen.getByRole('button', { name: 'Gantt Chart' }));
    expect(onTabChange).toHaveBeenCalledWith('chart');
  });
});
