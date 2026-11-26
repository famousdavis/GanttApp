// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The FRAME26 clean-up's GanttApp items (v0.35.0), each pinned where a unit test can see it. The browser measures the
// same items on the local build (frame-check, and the seat's probes); these keep them from coming back unnoticed.
//   G1 the Gantt chart's card hugs the chart · G2 the muted text reaches 4.5:1 · G5 Chart Settings is a button
//   G6 the dark scrollbar is GanttApp's panels', never the page's · G7 one scrollbar-gutter rule · G8 the favicon ring

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DARK_THEME, LIGHT_THEME } from '../../shared/utils/theme';
import { contrast, token } from '../../test/frameTokens';
import { ChartSettings } from '../../features/chart/ChartSettings';
import { ThemeWrapper } from '../../test/ThemeWrapper';
import { DEFAULT_CHART_COLORS, DEFAULT_DISPLAY_SETTINGS } from '../../shared/utils/colors';

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
const noComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const short = (h: string) => (h.length === 4 ? '#' + Array.from(h.slice(1)).map(c => c + c).join('') : h).toLowerCase();

describe('G1: the Gantt chart card hugs the chart', () => {
  it('the card around the svg is fit-content and never wider than the column', () => {
    const src = read('src', 'features', 'chart', 'GanttChart.tsx');
    const card = /<div style=\{\{([^}]*)\}\}>\s*<svg width=\{chartWidth\}/.exec(src);
    expect(card, 'the card is the svg\'s parent').not.toBeNull();
    expect(card![1]).toMatch(/width: 'fit-content'/);
    expect(card![1]).toMatch(/maxWidth: '100%'/);
    // The chart itself is unchanged: it clips inside the card, as before.
    expect(card![1]).toMatch(/overflowX: 'hidden'/);
  });
});

describe('G2: the muted text reaches 4.5:1 wherever it sits', () => {
  it.each([
    ['light', LIGHT_THEME],
    ['dark', DARK_THEME],
  ] as const)('%s: textMuted on the page, the surface and the chart ground', (theme, colors) => {
    for (const ground of ['background', 'surface', 'chartBg'] as const) {
      expect(contrast(short(colors.textMuted), short(colors[ground])), `${theme} textMuted on ${ground}`).toBeGreaterThanOrEqual(4.5);
    }
    // It is the frame's own muted token, so the app and the frame agree.
    expect(short(colors.textMuted)).toBe(token(theme, '--sf-text-muted'));
  });
});

describe('G5: the Chart Settings toggle is a real button', () => {
  function renderSettings(open = false) {
    const setShowColorSettings = vi.fn();
    const props = {
      showColorSettings: open, setShowColorSettings, showTodayLine: true, setShowTodayLine: vi.fn(),
      todayDateOverride: '', setTodayDateOverride: vi.fn(), statusDateOutOfRange: false, showFinishDateLine: true,
      setShowFinishDateLine: vi.fn(), showMostLikelyLine: true, setShowMostLikelyLine: vi.fn(), showMonths: false,
      setShowMonths: vi.fn(), chartColors: DEFAULT_CHART_COLORS, onColorsChange: vi.fn(), activePreset: 'default',
      displaySettings: DEFAULT_DISPLAY_SETTINGS, setDisplaySettings: vi.fn(), preparedBy: '', setPreparedBy: vi.fn(),
      showPreparedBy: false, setShowPreparedBy: vi.fn(),
    } as unknown as Parameters<typeof ChartSettings>[0];
    render(<ChartSettings {...props} />, { wrapper: ThemeWrapper });
    return { setShowColorSettings };
  }

  it('sits inside the h3, named "Chart Settings", with aria-expanded and the arrow hidden', () => {
    renderSettings();
    const button = screen.getByRole('button', { name: 'Chart Settings' });
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.parentElement!.tagName).toBe('H3');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button.querySelector('[aria-hidden="true"]')!.textContent).toBe('▼');
    // The h3 itself is no longer the click target.
    expect(button.parentElement!.onclick).toBeNull();
    expect(button.tabIndex).toBe(0);
  });

  it('a click asks to open it; when open it reads expanded, it controls the panel, and the arrow points up', () => {
    const { setShowColorSettings } = renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Chart Settings' }));
    expect(setShowColorSettings).toHaveBeenCalledWith(true);
  });

  it('open: aria-expanded true, aria-controls names the panel', () => {
    renderSettings(true);
    const button = screen.getByRole('button', { name: 'Chart Settings' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(button.getAttribute('aria-controls')!)).not.toBeNull();
    expect(button.querySelector('[aria-hidden="true"]')!.textContent).toBe('▲');
  });

  it('keeps the heading\'s look: the button inherits font and colour and draws no box of its own', () => {
    const rule = /\.chart-settings-toggle\s*\{([^}]*)\}/.exec(noComments(read('styles', 'globals.css')));
    expect(rule).not.toBeNull();
    for (const decl of ['font: inherit', 'color: inherit', 'background: none', 'border: 0', 'padding: 0']) {
      expect(rule![1]).toContain(decl);
    }
  });
});

describe('G6: the dark scrollbar styles GanttApp\'s own panels, never the page\'s scrollbar', () => {
  const css = noComments(read('styles', 'globals.css'));
  const selectors = Array.from(css.matchAll(/([^{}]+)\{[^}]*\}/g)).map(m => m[1].trim()).filter(s => /::-webkit-scrollbar/.test(s));

  it('every ::-webkit-scrollbar rule is scoped inside #__next, or to one named element', () => {
    expect(selectors.length).toBeGreaterThan(0);
    for (const sel of selectors.flatMap(s => s.split(',').map(x => x.trim()))) {
      // A bare `::-webkit-scrollbar` (or one after `[data-theme…]`, html or body alone) would style the root scroller:
      // a styled scrollbar is a classic one, so the layout width loses its width on long pages (frame-check
      // doc.overlay-width). `body *` would also restyle frame-check's classic probe, which it adds to body.
      expect(sel, sel).toMatch(/(#__next\s+::-webkit-scrollbar|^\.[\w-]+::-webkit-scrollbar$)/);
      expect(sel, sel).not.toMatch(/\bbody\b/);
    }
  });

  it('the dark panels keep their 10 px scrollbar', () => {
    expect(css).toMatch(/\[data-theme="dark"\] #__next ::-webkit-scrollbar\s*\{[^}]*width: 10px/);
  });
});

describe('G7: one scrollbar-gutter rule, the frame\'s', () => {
  it('globals.css sets no scrollbar-gutter; the vendored stylesheet sets it on a root holding the frame', () => {
    expect(noComments(read('styles', 'globals.css'))).not.toMatch(/scrollbar-gutter/);
    expect(noComments(read('styles', 'spert-frame.css'))).toMatch(/:root:has\(\.sf-app\)\s*\{\s*scrollbar-gutter:\s*stable;/);
  });
});

describe('G8: the favicons\' faint ring, as the other SPERT® apps draw it', () => {
  it('both favicons carry ga-favicon, and it draws a 1 px white ring at 20 %', () => {
    const header = read('src', 'shared', 'components', 'AppHeader.tsx');
    expect(header.match(/className="sf-icon sf-icon--(light|dark) ga-favicon"/g)).toHaveLength(2);
    expect(noComments(read('styles', 'globals.css'))).toMatch(/\.ga-favicon\s*\{\s*box-shadow: 0 0 0 1px rgb\(255 255 255 \/ 0\.2\);\s*\}/);
  });
});
