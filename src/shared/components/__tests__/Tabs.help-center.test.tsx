// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Adding a guide to public/? Also add it, with a one-line description, to spertsuite.com's
// src/data/help.ts (spert-landing-page). The landing page's daily "Guide list matches the app
// repos" check stays red until you do. The PDF guide house rules say the same.

// ===========================================================================
// The Help Center link (v0.33.0) sits at the right-hand end of the tab bar and
// opens this app's page in the SPERT® Suite Help Center in a new tab. It is a
// LINK, never a tab.
//
// ⚠️ WHY THE "NOT A TAB" TESTS LIVE HERE. Tabs.test.tsx's "renders tabs in
// correct order" reads buttons[0..4] and never the count, so a sixth button
// leaves it green. The checks below take EVERY button in the bar.
//
// ⚠️ The address is compared as a LITERAL. The component's constant is
// deliberately unexported: a test that imported it would agree with any wrong
// address written there.
//
// ⚠️ The visually hidden class is `pt-sr-only` (styles/projects-tab.css,
// imported globally in pages/_app.tsx). This repo has no `sr-only` class, so a
// span carrying `sr-only` would show "(opens in a new tab)" on screen. jsdom
// applies no CSS, so only the class assertion can catch that.
// ===========================================================================

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Tabs } from '../Tabs';
import { ThemeWrapper } from '../../../test/ThemeWrapper';
import type { TabType } from '../../types';

const TAB_LABELS_IN_ORDER = ['Projects', 'Releases', 'Gantt Chart', 'Settings', 'About'];
const ALL_TABS: TabType[] = ['projects', 'releases', 'chart', 'settings', 'about'];
const ACCESSIBLE_NAME = 'Help Center (opens in a new tab)';

function renderBar(activeTab: TabType = 'projects') {
  const { container, unmount } = render(
    <Tabs activeTab={activeTab} onTabChange={vi.fn()} />,
    { wrapper: ThemeWrapper }
  );
  const link = screen.getByRole('link', { name: ACCESSIBLE_NAME });
  // FRAME26 (v0.34.0): the bar is the frame's <nav>; the link sits in its right-hand app zone.
  const bar = link.closest('nav') as HTMLElement;
  const zone = link.parentElement as HTMLElement;
  return { container, bar, zone, link, unmount };
}

describe('Tabs — the Help Center link', () => {
  it('points at this app’s Help Center page, exactly', () => {
    const { link } = renderBar();
    expect(link.getAttribute('href')).toBe('https://spertsuite.com/help/ganttapp');
  });

  it('opens in a new tab, without handing the opener or the referrer to it', () => {
    const { link } = renderBar();
    expect(link.getAttribute('target')).toBe('_blank');
    const rel = (link.getAttribute('rel') ?? '').split(/\s+/);
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  });

  it('is named "Help Center (opens in a new tab)", with the arrow hidden and the note visually hidden', () => {
    const { link } = renderBar();
    // getByRole above already matched the whole accessible name; these pin its parts.
    const arrow = link.querySelector('[aria-hidden="true"]');
    expect(arrow?.textContent).toBe('↗');
    const note = Array.from(link.querySelectorAll('span')).find(
      (s) => s.textContent === '(opens in a new tab)'
    );
    expect(note, 'the "(opens in a new tab)" span').toBeDefined();
    expect(note!.classList.contains('pt-sr-only')).toBe(true);
  });

  it('is in the same bar as the tabs', () => {
    const { container, bar } = renderBar();
    expect(bar).toBe(container.firstElementChild);
    expect(bar.querySelectorAll('button')).toHaveLength(5);
  });

  // ⚠️ Every active tab, not one: the link must not move when the tabs change.
  for (const active of ALL_TABS) {
    it(`sits directly after About, as the bar's last element, with ${active} active`, () => {
      // FRAME26 (v0.34.0): the last element of the app zone, Settings · About · Help Center, which ends the bar.
      const { bar, zone, link } = renderBar(active);
      expect(zone).toBe(bar.querySelector('[data-sf="nav-app"]'));
      expect(zone.lastElementChild).toBe(link);
      const before = link.previousElementSibling;
      expect(before?.tagName).toBe('BUTTON');
      expect(before?.textContent).toBe('About');
    });
  }
});

describe('Tabs — the Help Center link is not a tab', () => {
  it('leaves exactly five buttons in the bar, the five tabs, in order', () => {
    const { bar } = renderBar();
    const labels = Array.from(bar.querySelectorAll('button')).map((b) => b.textContent);
    expect(labels).toEqual(TAB_LABELS_IN_ORDER);
  });

  // FRAME26 (v0.34.0): the current tab now carries aria-current="page" (contract §3 "Active item"). Exactly one,
  // on the current tab's button, and never on the link.
  it('is a plain <a>, never current, with no role or tabindex anywhere in the bar', () => {
    for (const active of ALL_TABS) {
      const { bar, link, unmount } = renderBar(active);
      expect(link.tagName).toBe('A');
      expect(link.hasAttribute('role')).toBe(false);
      expect(link.hasAttribute('aria-current')).toBe(false);
      const current = Array.from(bar.querySelectorAll('[aria-current]'));
      expect(current.map((e) => e.tagName + ' ' + e.getAttribute('aria-current')), `activeTab=${active}`).toEqual(['BUTTON page']);
      expect(bar.querySelectorAll('[tabindex]').length, `activeTab=${active}`).toBe(0);
      unmount();
    }
  });

  // FRAME26 (v0.34.0): the link is the frame's `.sf-help`, never a `.sf-tab`, with no inline style at rest (an inline
  // value would beat the frame's, and an inline text-decoration would hide contrast-more's underline).
  it('never takes a tab’s look: it is .sf-help, with no inline style at rest', () => {
    for (const active of ALL_TABS) {
      const { link, unmount } = renderBar(active);
      expect(link.className, `activeTab=${active}`).toBe('sf-help');
      expect(link.getAttribute('style'), `activeTab=${active}`).toBeNull();
      unmount();
    }
  });

  // pages/index.tsx steps through the tabs with ArrowLeft / ArrowRight over its own
  // `tabOrder` array, separate from Tabs.tsx's. Nothing pinned it before. The link is
  // not a tab, so it has no place in that order: a sixth id, or a swapped pair, turns
  // this red. A WIRING fact read from source, because the page is not rendered here.
  it('keeps the arrow-key tab order in pages/index.tsx to exactly the five tabs, in order', () => {
    const source = readFileSync(join(process.cwd(), 'pages', 'index.tsx'), 'utf-8');
    const decls = source.match(/const tabOrder\b[^=]*=\s*useMemo\(\(\)\s*=>\s*\[([^\]]*)\]/g) ?? [];
    expect(decls, 'exactly one tabOrder declaration').toHaveLength(1);
    const ids = Array.from((decls[0] ?? '').matchAll(/'([^']+)'/g)).map((m) => m[1]);
    expect(ids).toEqual(ALL_TABS);
    // The arrow handlers really do step through that array.
    expect(source).toMatch(/'arrowleft':[\s\S]{0,200}tabOrder\.indexOf\(activeTab\)/);
    expect(source).toMatch(/'arrowright':[\s\S]{0,200}tabOrder\.indexOf\(activeTab\)/);
  });
});
