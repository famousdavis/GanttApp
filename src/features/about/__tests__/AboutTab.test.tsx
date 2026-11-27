// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Adding a guide to public/? Also add it, with a one-line description, to spertsuite.com's
// src/data/help.ts (spert-landing-page). The landing page's daily "Guide list matches the app
// repos" check stays red until you do. The PDF guide house rules say the same.

// The About page (FRAME26 pass 3, v0.36.0): the SPERT® Suite's shared About layout (contract FRAME-CONTRACT.md §3
// About page and §7 About). Every word below is pinned HERE, copied from the approved sources, never read from the
// component: §7's shared words, GanttApp's own words (FRAME26-ABOUT-WORDS.md, amended 2026-11-27), and GanttApp's
// Help Center entry (spert-landing-page src/data/help.ts, hub v2.15.2). Its place on the page (main's next child after
// the heading row), its h1 and What's new through the real page are in src/lib/__tests__/frame-about.page.test.tsx.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { AboutTab } from '../AboutTab';
import { APP_VERSION } from '../../../lib/version';

const TITLE = 'GanttApp™';
const REPO = 'famousdavis/GanttApp';
const HELP_ENTRY = {
  slug: 'ganttapp',
  guides: [
    {
      file: 'GanttApp_Quick_Reference_Guide.pdf',
      title: 'Quick Reference Guide',
      description: 'How GanttApp shows each release as a build phase plus a delivery uncertainty window, and how to set one up.',
    },
  ],
};

/** Text as it is SEEN: screen-reader-only text left out, runs of whitespace one space, typographic quotes straight (§7). */
function seen(el: Element): string {
  const c = el.cloneNode(true) as Element;
  c.querySelectorAll('.sf-sr').forEach(x => x.remove());
  return (c.textContent ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
}
const norm = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

function renderAbout(onOpenChangelog = vi.fn()) {
  const { container } = render(<AboutTab onOpenChangelog={onOpenChangelog} />);
  const about = container.querySelector<HTMLElement>('.sf-about')!;
  const sections = Array.from(about.children).filter((e): e is HTMLElement => e.tagName === 'SECTION');
  const section = (h2: string) => sections.find(s => seen(s.querySelector(':scope > h2')!) === h2)!;
  const paras = (s: HTMLElement) => Array.from(s.querySelectorAll(':scope > p')).map(seen);
  return { container, about, sections, section, paras, onOpenChangelog };
}

afterEach(() => vi.useRealTimers());

describe('the About page (contract §7 About)', () => {
  it('is one .sf-about, hooked data-sf="about", and draws no heading of its own above its sections: the h1 is the frame\'s', () => {
    const { container, about } = renderAbout();
    expect(container.children).toHaveLength(1);
    expect(about).toHaveAttribute('data-sf', 'about');
    expect(container.querySelector('h1')).toBeNull();
    expect(Array.from(about.children).every(e => e.tagName === 'SECTION')).toBe(true);
  });

  it('has its sections in §7\'s order, each a <section> opening with its h2; no Connect AI (GanttApp has none)', () => {
    const { sections } = renderAbout();
    expect(sections.map(s => s.firstElementChild!.tagName)).toEqual(['H2', 'H2', 'H2', 'H2', 'H2']);
    expect(sections.map(s => seen(s.querySelector(':scope > h2')!))).toEqual([
      `What is ${TITLE}?`, 'How it works', 'Guides', 'Your data and storage', 'Version and license',
    ]);
  });

  it('What is GanttApp™?: the approved paragraph and its one list', () => {
    const { section, paras } = renderAbout();
    const s = section(`What is ${TITLE}?`);
    expect(paras(s)).toEqual([
      'GanttApp™ helps project managers communicate release uncertainty to stakeholders. Traditional Gantt charts show single delivery dates, but real projects have uncertainty. GanttApp visualizes this by showing:',
    ]);
    expect(Array.from(s.querySelectorAll(':scope > ul > li')).map(seen)).toEqual([
      'Solid bars: Design, Code, Test phase (predictable work)',
      norm('Hatched bars: Delivery uncertainty window (the “maybe” zone)'),
    ]);
  });

  it('How it works: the four approved steps, as one numbered list', () => {
    const { section } = renderAbout();
    const s = section('How it works');
    expect(Array.from(s.children).map(e => e.tagName)).toEqual(['H2', 'OL']);
    expect(Array.from(s.querySelectorAll('ol > li')).map(seen)).toEqual([
      'Create a project, or load the sample',
      'On Releases, add each release with its start date, the date its design, code and test work ends (Early Finish), and the latest date it may be delivered (Late Finish)',
      'Open the Gantt Chart to see each release as a solid bar for the predictable work and a hatched bar for its delivery window',
      'Take snapshots to compare the plan over time',
    ]);
  });

  it('Guides: one row per Help Center guide, verbatim and in order, each opening its PDF from this origin in a new tab', () => {
    const { container } = renderAbout();
    const list = container.querySelector('ul.sf-guides')!;
    expect(list).toHaveAttribute('data-sf', 'guides');
    const rows = Array.from(list.children);
    expect(rows).toHaveLength(HELP_ENTRY.guides.length);
    rows.forEach((row, i) => {
      const g = HELP_ENTRY.guides[i];
      expect(row).toHaveClass('sf-guide');
      expect(seen(row.querySelector('.sf-guide-body > h3.sf-guide-title')!)).toBe(g.title);
      expect(seen(row.querySelector('.sf-guide-body > p.sf-guide-text')!)).toBe(norm(g.description));
      const open = row.querySelector('a.sf-guide-open')!;
      expect(open).toHaveAttribute('href', `/${g.file}`);
      expect(open).toHaveAttribute('target', '_blank');
      expect(open).toHaveAttribute('rel', 'noopener noreferrer');
      expect(seen(open)).toBe('Open PDF ↗');
      expect(open.querySelector('[aria-hidden="true"]')!.textContent).toBe(' ↗');
      expect(open.querySelector('.sf-sr')!.textContent).toBe(`: ${g.title} (opens in a new tab)`);
    });
  });

  it('Guides: then the shared More help line, to this app\'s Help Center page', () => {
    const { section } = renderAbout();
    const s = section('Guides');
    const more = s.querySelector(':scope > ul.sf-guides + p > a')!;
    expect(more).toHaveAttribute('href', `https://spertsuite.com/help/${HELP_ENTRY.slug}`);
    expect(more).toHaveAttribute('target', '_blank');
    expect(more).toHaveAttribute('rel', 'noopener noreferrer');
    expect(seen(more)).toBe('More help in the Help Center ↗');
    expect(more.querySelector('.sf-sr')!.textContent).toBe(' (opens in a new tab)');
  });

  it('Your data and storage: the two shared paragraphs word for word, then GanttApp\'s one line (as amended)', () => {
    const { section, paras } = renderAbout();
    expect(paras(section('Your data and storage'))).toEqual([
      `Unless you sign in and choose cloud storage, ${TITLE} keeps your projects in this browser, on this device, and sends them to no server. Clearing this site's data deletes them, so export a backup from time to time.`,
      'If you sign in, with Google or with a Microsoft work or school account, and choose cloud storage, your projects are saved to your account in Google Firebase, over encrypted (HTTPS) connections. You can then open them on any device and share them with other people.',
      "Your theme stays in this browser whichever storage you use. Chart colors, toggles and default legend labels are personal: each person sees their own, even on a shared project. A legend label you edit on a project's chart is saved with that project, so everyone who shares it sees it.",
    ]);
  });

  it('Version and license: the five shared paragraphs word for word, with this version and the current year', () => {
    const { container } = renderAbout();
    const legal = container.querySelector('section.sf-about-legal')!;
    expect(legal).toHaveAttribute('data-sf', 'about-legal');
    expect(Array.from(legal.querySelectorAll('p')).map(seen)).toEqual([
      `Version ${APP_VERSION} · What's new`,
      'Created by William W. Davis, MSPM, PMP · Source code on GitHub ↗',
      `© ${new Date().getFullYear()} William W. Davis, MSPM, PMP. ${TITLE} is free software: you may use, change and share it under the GNU General Public License, version 3, with the additional terms its LICENSE ↗ adds under Section 7 of that license: attribution and legal notices, trademarks, the marking of modified versions, endorsement, and indemnification.`,
      'SPERT®, Statistical PERT® and Estimation Made Easy® are registered trademarks of famousdavis, LLC. GanttApp™ and MyScrumBudget™ are trademarks of famousdavis, LLC.',
      'THERE IS NO WARRANTY FOR THE PROGRAM, TO THE EXTENT PERMITTED BY APPLICABLE LAW. EXCEPT WHEN OTHERWISE STATED IN WRITING THE COPYRIGHT HOLDERS AND/OR OTHER PARTIES PROVIDE THE PROGRAM "AS IS" WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE ENTIRE RISK AS TO THE QUALITY AND PERFORMANCE OF THE PROGRAM IS WITH YOU. SHOULD THE PROGRAM PROVE DEFECTIVE, YOU ASSUME THE COST OF ALL NECESSARY SERVICING, REPAIR OR CORRECTION.',
    ]);
  });

  it('Version and license: the source and LICENSE links, to this repository, in a new tab', () => {
    const { container } = renderAbout();
    const links = Array.from(container.querySelectorAll('.sf-about-legal a'));
    const by = (re: RegExp) => links.find(a => re.test(seen(a)))!;
    expect(by(/^Source code on GitHub/)).toHaveAttribute('href', `https://github.com/${REPO}`);
    expect(by(/^LICENSE/)).toHaveAttribute('href', `https://github.com/${REPO}/blob/main/LICENSE`);
    for (const a of [by(/^Source code on GitHub/), by(/^LICENSE/)]) {
      expect(a).toHaveAttribute('target', '_blank');
      expect(a).toHaveAttribute('rel', 'noopener noreferrer');
      expect(a.querySelector('.sf-sr')!.textContent).toBe(' (opens in a new tab)');
    }
  });

  it('What\'s new is a link to the Changelog tab; a plain click opens it through the footer\'s handler, a modified click is the browser\'s', () => {
    const { container, onOpenChangelog } = renderAbout();
    const wn = Array.from(container.querySelectorAll('.sf-about-legal p:first-of-type a')).find(a => /^What.s new$/.test(seen(a)))!;
    expect(wn).toHaveAttribute('href', '/?tab=changelog');
    expect(wn).not.toHaveAttribute('target');
    expect(fireEvent.click(wn, { ctrlKey: true })).toBe(true);
    expect(fireEvent.click(wn, { metaKey: true })).toBe(true);
    expect(onOpenChangelog).not.toHaveBeenCalled();
    expect(fireEvent.click(wn)).toBe(false); // default prevented: the tab opens in place
    expect(onOpenChangelog).toHaveBeenCalledOnce();
  });

  it('every ® and ™ is the glyph alone in a .sf-mark, the ™ also .sf-mark--tm', () => {
    const { about } = renderAbout();
    const walker = document.createTreeWalker(about, NodeFilter.SHOW_TEXT);
    const marks: Text[] = [];
    for (let t = walker.nextNode(); t; t = walker.nextNode()) if (/[®™]|TM\b/.test(t.textContent ?? '')) marks.push(t as Text);
    expect(marks.length).toBeGreaterThan(0);
    for (const t of marks) {
      expect(t.textContent).toMatch(/^[®™]$/);
      expect(t.parentElement).toHaveClass('sf-mark');
      if (t.textContent === '™') expect(t.parentElement).toHaveClass('sf-mark--tm');
    }
  });

  it('carries no style or colour of its own: no style attribute and no class outside the frame\'s inside .sf-about', () => {
    const { about } = renderAbout();
    expect(about.querySelectorAll('[style]')).toHaveLength(0);
    const classes = new Set(Array.from(about.querySelectorAll('[class]')).flatMap(e => Array.from(e.classList)));
    for (const c of Array.from(classes)) expect(c, `class ${c}`).toMatch(/^sf-/);
  });

  it('Y1: the © year is the current year, read when the page renders (a clock set to 2027 shows 2027)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2027, 0, 1, 9, 0, 0));
    const { container } = renderAbout();
    expect(seen(container.querySelectorAll('.sf-about-legal p')[2]!)).toMatch(/^© 2027 William W\. Davis, MSPM, PMP\. /);
  });
});
