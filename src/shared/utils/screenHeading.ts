// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { TabType } from '../types';

/** The fixed headings: today's tab headings, which became the frame's `h1` (FRAME26, v0.34.0). */
const FIXED: Record<Exclude<TabType, 'releases' | 'chart'>, string> = {
  projects: 'Projects',
  settings: 'Settings',
  about: 'About This App',
  changelog: 'Changelog',
};

/** What Releases and the Gantt Chart are called when there is no project to name. */
const TAB_NAMES = { releases: 'Releases', chart: 'Gantt Chart' } as const;

/**
 * The text of a screen's `h1` (FRAME26, contract §7 "Inside a project"). On Releases and the Gantt Chart it is the
 * selected project's name, the same project both tabs' pickers show; with no project to name (none yet, every one
 * archived, or the data still loading) it is the tab's own name. `title` carries the full text, because a long
 * name is cut short with an ellipsis.
 */
export function screenHeading(tab: TabType, projectName: string | undefined): { text: string; title: string } {
  if (tab === 'releases' || tab === 'chart') {
    const text = projectName || TAB_NAMES[tab];
    return { text, title: text };
  }
  const text = FIXED[tab];
  return { text, title: text };
}
