// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The Projects tab's colours, checked against WCAG 2.2: text at least 4.5:1,
// and icons, focus rings and control borders at least 3:1, on what each sits on.

import { describe, it, expect } from 'vitest';
import { projectsTabPalette, paletteStyle, patchedColors } from '../projectsTabPalette';
import type { ProjectsTabPalette } from '../projectsTabPalette';
import { LIGHT_THEME, DARK_THEME } from '../../../shared/utils/theme';

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

/** A translucent colour laid over an opaque one, as the browser draws it. */
function over(top: Rgb, alpha: number, base: Rgb): Rgb {
  return top.map((c, i) => c * alpha + base[i] * (1 - alpha)) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

function ratio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AMBER_BLOCK: Rgb = [217, 119, 6]; // the import preview's conflict block, at 8 %

/** [what, foreground, background, minimum] for every pair the tab draws. */
function pairs(p: ProjectsTabPalette): [string, Rgb, Rgb, number][] {
  const c = (k: keyof ProjectsTabPalette) => rgb(p[k] as string);
  const white: Rgb = [255, 255, 255];
  return [
    ['text on a tile or dialog', c('text'), c('surface'), 4.5],
    ['text on the page', c('text'), c('bg'), 4.5],
    ['text in a field', c('text'), c('inputBg'), 4.5],
    ['text on a hovered button', c('text'), c('hoverBg'), 4.5],
    ['meta text on a tile or dialog', c('meta'), c('surface'), 4.5],
    ['meta text on the page', c('meta'), c('bg'), 4.5],
    ['a placeholder in a field', c('meta'), c('inputBg'), 4.5],
    ['a warning', c('warn'), c('surface'), 4.5],
    ['an error', c('error'), c('surface'), 4.5],
    ['a link', c('link'), c('surface'), 4.5],
    ['a link on the page', c('link'), c('bg'), 4.5],
    ['a conflict note on its amber block', c('note'), over(AMBER_BLOCK, 0.08, c('surface')), 4.5],
    ['white on the primary button', white, c('primary'), 4.5],
    ['white on the hovered primary button', white, c('primaryHover'), 4.5],
    ['a field border on the dialog', c('inputBorder'), c('surface'), 3],
    ['a field border against the field', c('inputBorder'), c('inputBg'), 3],
    ['a button border on the page', c('btnBorder'), c('bg'), 3],
    ['a button border on a dialog', c('btnBorder'), c('surface'), 3],
    ['an invalid field border', c('errorBorder'), c('surface'), 3],
    ['a focus ring on the page', c('focus'), c('bg'), 3],
    ['a focus ring on a tile or dialog', c('focus'), c('surface'), 3],
    ['the primary button against the page', c('primary'), c('bg'), 3],
    ['the primary button against a dialog', c('primary'), c('surface'), 3],
    ['a toolbar icon', c('meta'), c('bg'), 3],
    ['the drag grip', c('grip'), c('surface'), 3],
  ];
}

describe('projectsTabPalette', () => {
  it('measures as WCAG does: black on white is 21:1, #767676 on white 4.54:1', () => {
    expect(ratio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 2);
    expect(ratio(rgb('#767676'), rgb('#ffffff'))).toBeCloseTo(4.54, 2);
  });

  it.each(['light', 'dark'] as const)('in %s mode every pair the tab draws reaches its minimum', (theme) => {
    const short = pairs(projectsTabPalette(theme))
      .map(([what, fg, bg, min]) => ({ what, ratio: Number(ratio(fg, bg).toFixed(2)), min }))
      .filter(r => r.ratio < r.min);
    expect(short).toEqual([]);
  });

  it.each(['light', 'dark'] as const)('in %s mode asks the browser to draw native controls in the same scheme', (theme) => {
    expect(paletteStyle(projectsTabPalette(theme)).colorScheme).toBe(theme);
  });

  it.each([
    ['light', LIGHT_THEME],
    ['dark', DARK_THEME],
  ] as const)('in %s mode lends shared components its borders and muted text, and keeps the rest', (theme, colors) => {
    const p = projectsTabPalette(theme);
    const patched = patchedColors(colors, p);
    expect(patched).toEqual({ ...colors, border: p.btnBorder, borderLight: p.inputBorder, inputBorder: p.inputBorder, textMuted: p.meta });
  });
});
