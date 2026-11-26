// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { MouseEvent } from 'react';
import Link from 'next/link';
import { ThemeButton } from './ThemeButton';
import { StorageStatusChip } from './StorageStatusChip';

interface AppHeaderProps {
  /** Shows the Projects tab. */
  onNavigateHome: () => void;
  /** Opens Cloud Storage from the account chip. */
  onOpenAccount: () => void;
}

/*
 * The frame's brand row (FRAME26, contract §3, v0.34.0): a 56 px band on the page ground, in the shared 1600 px column.
 *
 * The brand is ONE LINK to the collection screen. GanttApp's tabs are in-memory state, and "/" with no other state is
 * the Projects tab, so the link points at "/" and, on a plain click, shows Projects itself: its `preventDefault` also
 * stops Next's `<Link>` from navigating. A modified or middle click is left to the browser (and `<Link>` ignores it),
 * which opens Projects in a new tab. It has no
 * aria-label: its accessible name is its visible title, "GanttApp™" (WCAG 2.5.3, label in name). Both favicons are
 * decorative (`alt=""`) for the same reason; the stylesheet shows the one for the current theme (`.sf-icon--light` /
 * `--dark`).
 *
 * The title is NOT a heading. The page's one `h1` is the heading row's, in `main` (contract §2).
 *
 * The title's colour (HDR26, v0.33.1; on the frame since v0.34.0): GanttApp's teal as a gradient, drawn by the
 * frame's `.sf-grad` from `--app-grad-light` / `--app-grad-dark` in styles/globals.css. The title has NO inline
 * style: the stylesheet chooses the ramp by theme, so React never re-applies a style key on a theme switch (the trap
 * the old inline gradient was guarded against). The ™ is the frame's muted `.sf-mark--tm`. The fallbacks are the
 * frame's: solid `--sf-heading` under `prefers-contrast: more`, solid black in print. Guarded by
 * src/lib/__tests__/title-gradient.test.ts and title-gradient.page.test.tsx.
 */
export function AppHeader({ onNavigateHome, onOpenAccount }: AppHeaderProps) {
  const handleBrandClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigateHome();
  };

  return (
    <header className="sf-bar">
      <div className="sf-col sf-bar-row">
        <Link href="/" onClick={handleBrandClick} className="sf-brand" data-sf="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/spert-favicon-ganttapp.png" alt="" className="sf-icon sf-icon--light ga-favicon" data-sf="favicon" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/spert-favicon-ganttapp-dark.png" alt="" className="sf-icon sf-icon--dark ga-favicon" data-sf="favicon" />
          <span className="sf-title" data-sf="title">
            <span className="sf-grad">GanttApp</span><span className="sf-mark sf-mark--tm">™</span>
          </span>
        </Link>
        <p className="sf-tagline" data-sf="tagline">Visualize release date uncertainty in your project timeline</p>
        <div className="sf-utils" data-sf="utils">
          <ThemeButton />
          <StorageStatusChip onOpenModal={onOpenAccount} />
        </div>
      </div>
    </header>
  );
}
