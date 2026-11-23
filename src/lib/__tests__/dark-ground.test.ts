// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { DARK_THEME, LIGHT_THEME } from '../../shared/utils/theme';
import { projectsTabPalette } from '../../features/projects/projectsTabPalette';
import { token } from '../../test/frameTokens';

/**
 * The dark ground moved to the frame's (FRAME26, contract §2 "One dark ground", v0.34.0), from #1a1a2e to #101828.
 * Every token whose ROLE is the page follows it, so the page has one ground whichever code paints it:
 *   - theme.ts `background` (its own comment: "Page backgrounds");
 *   - globals.css's dark `--bg` (body's background: the overscroll and the instant before `.sf-app` paints);
 *   - the Projects tab palette's `bg` ("the page" in that tab's own contrast model, projectsTabPalette.test.ts).
 * theme.ts `buttonBg` kept #1a1a2e on purpose: it is a button's fill on `surface` (#16213e) panels and never sits on
 * the page ground. The two values differ by 1.04:1.
 */
const GLOBALS = () => readFileSync(join(process.cwd(), 'styles', 'globals.css'), 'utf8');

describe('one page ground, the frame\'s', () => {
  it('the frame\'s ground is #ffffff / #101828', () => {
    expect(token('light', '--sf-page')).toBe('#ffffff');
    expect(token('dark', '--sf-page')).toBe('#101828');
  });

  it('theme.ts background follows it in both themes', () => {
    expect(LIGHT_THEME.background).toBe(token('light', '--sf-page'));
    expect(DARK_THEME.background).toBe(token('dark', '--sf-page'));
  });

  it('globals.css\'s --bg follows it in both themes', () => {
    const css = GLOBALS().replace(/\/\*[\s\S]*?\*\//g, '');
    const root = /:root\s*\{([^}]*)\}/.exec(css)![1]!;
    const dark = /\[data-theme="dark"\]\s*\{([^}]*)\}/.exec(css)![1]!;
    expect(/--bg:\s*([^;]+);/.exec(root)![1]!.trim()).toBe(token('light', '--sf-page'));
    expect(/--bg:\s*([^;]+);/.exec(dark)![1]!.trim()).toBe(token('dark', '--sf-page'));
  });

  it('the Projects tab palette\'s page follows it in both themes', () => {
    expect(projectsTabPalette('light').bg).toBe(token('light', '--sf-page'));
    expect(projectsTabPalette('dark').bg).toBe(token('dark', '--sf-page'));
  });

  it('buttonBg keeps the old ground: a fill on surface panels, not the page', () => {
    expect(DARK_THEME.buttonBg).toBe('#1a1a2e');
    expect(DARK_THEME.surface).toBe('#16213e');
    expect(LIGHT_THEME.buttonBg).toBe('#ffffff');
  });

  it('no stylesheet or theme token still paints the old ground as the page', () => {
    expect(GLOBALS()).not.toMatch(/--bg:\s*#1a1a2e/i);
    expect(DARK_THEME.background).not.toBe('#1a1a2e');
  });
});
