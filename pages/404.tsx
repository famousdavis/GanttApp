// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import Link from 'next/link';
import { AppHeader } from '../src/shared/components/AppHeader';
import { AppFooter } from '../src/shared/components/AppFooter';
import { AppNotices } from '../src/shared/components/AppNotices';
import { HeadingRow } from '../src/shared/components/HeadingRow';
import { Tabs } from '../src/shared/components/Tabs';
import { tabHref } from '../src/shared/utils/tabLink';
import type { TabType } from '../src/shared/types';

const go = (href: string) => window.location.assign(href);

/**
 * The 404 page (FRAME26 clean-up, v0.35.0): an address GanttApp has no page for, inside the frame, as in the other
 * SPERT® apps. Before v0.35.0 this was Next.js's own unframed "404 | This page could not be found." One `h1`, no
 * navigation item current (no item leads here, contract §3 "Active item"). GanttApp's tabs are state on its one page,
 * so here each item, the brand, the account chip and the footer's Version button leave for that page ("/?tab=<id>",
 * src/shared/utils/tabLink.ts), which opens the tab.
 */
export default function NotFoundPage() {
  return (
    <div className="sf-app" data-sf="app">
      <a className="sf-skip" href="#main" data-sf="skip">Skip to main content</a>
      <AppHeader onNavigateHome={() => go('/')} onOpenAccount={() => go(tabHref('settings'))} />
      <Tabs onTabChange={(tab: TabType) => go(tabHref(tab))} />
      <AppNotices />
      <main id="main" className="sf-col sf-main" data-sf="main">
        <HeadingRow>Page not found</HeadingRow>
        <div className="sf-below">
          <p>There&apos;s no page at this address.</p>
          <p style={{ marginTop: '0.5rem' }}>
            <Link href="/" className="ga-link">Back to Projects</Link>
          </p>
        </div>
      </main>
      <AppFooter onOpenChangelog={() => go(tabHref('changelog'))} />
    </div>
  );
}
