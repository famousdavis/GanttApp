// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

/**
 * The page's root boxes carry no width cap (v0.34.2, FRAME26).
 *
 * `html, body { max-width: 100vw }` came with the create-next-app skeleton (7597cb6) and did nothing useful: both are
 * auto-width blocks and cannot be wider than the window, and `overflow-x: hidden` (kept) is what clips the wide Gantt
 * chart. It did one harmful thing. With classic scrollbars (macOS with a mouse attached, Windows), Chrome resolves
 * `100vw` on the root to the window minus the scrollbar gutter twice, so html was 1890 px at a 1920 window instead of
 * 1905. The frame's column centres inside html, so GanttApp's header sat 7.5 px left of every other app's (brand at
 * 177 against 184.5 at 1920, 497 against 504.5 at 2560).
 *
 * jsdom has no layout, so this cannot measure that shift. It guards against the cap coming back, in any spelling a
 * stylesheet could bring it (`html`, `:root`, `body`, `dvw`, or the frame's own sheet), by asserting the COMPUTED value
 * with both real stylesheets loaded. The behavioural evidence is the classic-scrollbar probe in the FRAME26 evidence
 * (Fix-FRAME-GA-vw), run on the production build.
 */
const SHEETS = ['globals.css', 'spert-frame.css'].map(f => readFileSync(join(process.cwd(), 'styles', f), 'utf8'));
const VIEWPORT_UNIT = /\d(s|l|d)?v(w|i|max|min)\b/i;

const injected: HTMLStyleElement[] = [];
function load(extra = '') {
  for (const css of [...SHEETS, extra]) {
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
    injected.push(s);
  }
}
afterEach(() => { while (injected.length) injected.pop()!.remove(); });

const caps = () => [document.documentElement, document.body].map(e => {
  const c = getComputedStyle(e);
  return { maxWidth: c.maxWidth, width: c.width };
});

describe('html and body have no width cap', () => {
  it('the computed max-width of html and body is none', () => {
    load();
    for (const c of caps()) expect(c.maxWidth).toBe('none');
  });

  it('neither width uses a viewport unit', () => {
    load();
    for (const c of caps()) expect(c.width).not.toMatch(VIEWPORT_UNIT);
  });

  it('control: the method sees a cap when one is there', () => {
    load(':root { max-width: 100vw } body { width: 100dvw }');
    const [html, body] = caps();
    expect(html!.maxWidth).toBe('100vw');
    expect(body!.width).toMatch(VIEWPORT_UNIT);
  });
});
