// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Tab navigation component

import { TabType } from '../types';

// This app's page in the SPERT® Suite Help Center. Module-local: the link below
// is its only consumer, and the app's other spertsuite.com addresses are inline
// literals too. Deliberately not exported, so the tests compare the address as a
// literal and a wrong address here cannot satisfy them.
const HELP_CENTER_URL = 'https://spertsuite.com/help/ganttapp';

interface TabsProps {
  /** The tab shown. On the Changelog (reached from the footer's Version button) no navigation item is current. */
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

// The frame's two zones (FRAME26, contract §3 "Navigation zones", v0.34.0): the app's work items on the left, then
// Settings · About · Help Center on the right, always in that order.
const WORK: { id: TabType; label: string }[] = [
  { id: 'projects', label: 'Projects' },
  { id: 'releases', label: 'Releases' },
  { id: 'chart', label: 'Gantt Chart' },
];
const APP: { id: TabType; label: string }[] = [
  { id: 'settings', label: 'Settings' },
  { id: 'about', label: 'About' },
];

/**
 * The frame's navigation row (FRAME26, contract §3, v0.34.0): a 44 px band with a 1 px rule. Each item is the frame's
 * `.sf-tab`, with no inline style (an inline value would beat the frame's). The current item carries
 * `aria-current="page"`, which the stylesheet marks with the accent underline at the same weight; every other item
 * has no `aria-current` at all (React would render `false` as the string "false"). The Changelog is not a tab, so on
 * it no item is current. The DOM order is today's, so the keyboard order and pages/index.tsx's arrow keys are too.
 */
export function Tabs({ activeTab, onTabChange }: TabsProps) {
  const item = (tab: { id: TabType; label: string }) => (
    <button
      key={tab.id}
      type="button"
      className="sf-tab"
      aria-current={activeTab === tab.id ? 'page' : undefined}
      onClick={() => onTabChange(tab.id)}
    >
      {tab.label}
    </button>
  );

  return (
    <nav className="sf-nav" data-sf="nav">
      <div className="sf-col sf-nav-row">
        <div className="sf-nav-work" data-sf="nav-work">
          {WORK.map(item)}
        </div>
        <div className="sf-nav-app" data-sf="nav-app">
          {APP.map(item)}
          {/* Help Center: a LINK that leaves the app, never a tab. So it is not in the tab lists, not a <button>,
              and not in pages/index.tsx's arrow-key tabOrder. It is the app zone's last element, the frame's quiet
              `.sf-help`. The arrow is decoration, hidden from assistive technology; the visually hidden text gives
              the accessible name "Help Center (opens in a new tab)".
              ⚠️ The spaces are their own text nodes, OUTSIDE the spans: a space inside a span is trimmed by the
              accessible-name computation, giving "Help Center(opens in a new tab)".
              The hover underline is the frame's own `.sf-help:hover` (stylesheet v2, v0.34.1); keyboard focus shows
              the frame's focus ring. ⚠️ Give the link no inline style and no hover or focus handlers: an inline
              text-decoration would beat the frame's underline under prefers-contrast: more. */}
          <a
            href={HELP_CENTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="sf-help"
          >
            Help Center{' '}<span aria-hidden="true">↗</span>{' '}<span className="pt-sr-only">(opens in a new tab)</span>
          </a>
        </div>
      </div>
    </nav>
  );
}
