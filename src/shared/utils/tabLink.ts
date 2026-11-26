// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { TabType } from '../types';

// GanttApp's tabs are state, not routes. The 404 page (pages/404.tsx, v0.35.0) still shows the frame's navigation, so
// its items link to "/?tab=<id>", and the app opens that tab once, on load, then drops the parameter from the address.

const TABS: readonly TabType[] = ['projects', 'releases', 'chart', 'settings', 'about', 'changelog'];

/** The address that opens `tab` on the app's page. */
export function tabHref(tab: TabType): string {
  return tab === 'projects' ? '/' : `/?tab=${tab}`;
}

/** The tab a `?tab=` parameter names, or null when it names none. */
export function tabFromSearch(search: string): TabType | null {
  const t = new URLSearchParams(search).get('tab');
  return t !== null && (TABS as readonly string[]).includes(t) ? (t as TabType) : null;
}

/** The same search string without `tab` (and every other parameter kept, `?invite=` among them). */
export function stripTabParam(search: string): string {
  const p = new URLSearchParams(search);
  p.delete('tab');
  const s = p.toString();
  return s ? `?${s}` : '';
}
