// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { LIGHT_THEME, DARK_THEME } from '../../shared/utils/theme';

/**
 * The header's GanttApp™ is drawn as a gradient in GanttApp's favicon teal, #0891b2 (HDR26, v0.33.1), and every
 * point of it stays readable on the page behind it, in both themes. Since v0.34.0 (FRAME26) it is drawn by the SPERT®
 * Suite frame: one `.sf-grad` span, painted by styles/spert-frame.css from `--app-grad-light` / `--app-grad-dark` in
 * styles/globals.css, on the frame's page ground `--sf-page`. This guard was re-pinned on purpose for that move:
 * the ramps are byte for byte v0.33.1's, the dark ground moved from #1a1a2e to #101828 (so the dark ramp's weakest
 * point rose, 3.12 → 3.24), and the fallbacks are the frame's.
 *
 * ⚠️ jsdom has no paint, so nothing here is measured from a render. The ramps are read from globals.css, the ground
 * and the title's size and fallbacks from the vendored stylesheet, the markup from AppHeader.tsx, and the contrast is
 * computed here from the WCAG 2.x definition. The rendered page is measured in Chrome by frame-check
 * (`contrast.title`, `ground.*`, `title.more-*`).
 *
 * The bar is 3 : 1 at every point of each ramp: the title is 24 px bold, which is large text. Both ramps clear the
 * bar by hundredths or tenths, so the grounds are pinned below: a change to either one has to come through here.
 *
 * The old trap (v0.33.1): React re-applies only the style keys that change, and a theme-chosen `background` shorthand
 * resets `background-clip`. It cannot bite now: the title has NO inline style, and the stylesheet chooses the ramp
 * by theme. That is checked here by the markup's shape, and by behaviour in `title-gradient.page.test.tsx`.
 *
 * The colour maths is the HDR26 plan's Appendix A, typed. It is copied, not shared.
 */
const HEADER = join(process.cwd(), 'src', 'shared', 'components', 'AppHeader.tsx');
const PAGE = join(process.cwd(), 'pages', 'index.tsx');
const GLOBALS_CSS = join(process.cwd(), 'styles', 'globals.css');
const FRAME_CSS = join(process.cwd(), 'styles', 'spert-frame.css');

const BAR = 3;
/** The page ground in each theme: the frame's `--sf-page`, measured in Chrome behind the title by frame-check. */
const PREMISE = { light: '#ffffff', dark: '#101828' } as const;
/** The approved ends (HDR26 plan §2), light end first. A change to any of them goes back to the owner with a proof. */
const ENDS = { light: ['#449fbc', '#00657d'], dark: ['#54adca', '#00738e'] } as const;

// ---- Appendix A (HDR26 plan v5), typed ----------------------------------------------------------------------------

type Triple = [number, number, number];

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const delin = (v: number) =>
  Math.round(255 * Math.min(1, Math.max(0, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)));
const rgb = (h: string): Triple => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as Triple;
const hex = (a: number[]) => '#' + a.map((v) => v.toString(16).padStart(2, '0')).join('');
const luminance = (h: string) => {
  const [r, g, b] = rgb(h).map(lin) as Triple;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/** A contrast ratio to two decimals, truncated: never rounded up across a bar. */
const trunc = (n: number) => (Math.floor(n * 100) / 100).toFixed(2);

const toOklab = (h: string): Triple => {
  const [r, g, b] = rgb(h).map(lin) as Triple;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};
const linFromOklab = ([lk, a, b]: Triple): Triple => {
  const l = (lk + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lk - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lk - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};
const fromOklab = (lab: Triple) => hex(linFromOklab(lab).map(delin));
const toLch = (h: string): Triple => {
  const [lk, a, b] = toOklab(h);
  return [lk, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360];
};
const lab = ([lk, c, h]: Triple): Triple => [lk, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)];
const inGamut = (lch: Triple) => linFromOklab(lab(lch)).every((v) => v >= -1e-6 && v <= 1 + 1e-6);
/** Fit to sRGB by cutting chroma at fixed lightness and hue; never by clamping channels, which turns the hue. */
const fromLch = ([lk, c, h]: Triple) => {
  let fit = c;
  if (!inGamut([lk, c, h])) {
    let lo = 0;
    let hi = c;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut([lk, mid, h])) lo = mid;
      else hi = mid;
    }
    fit = lo;
  }
  return fromOklab(lab([lk, fit, h]));
};

/** A CSS colour as `#rgb`, `#rrggbb`, or `oklch(L% C H)` with H possibly `none`, returned as #rrggbb. */
function parseCssColor(value: string): string {
  const v = value.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(v);
  if (m) return '#' + Array.from(m[1]!).map((c) => c + c).join('').toLowerCase();
  m = /^#([0-9a-f]{6})$/i.exec(v);
  if (m) return '#' + m[1]!.toLowerCase();
  m = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+|none)\s*\)$/i.exec(v);
  if (m) return fromOklab(lab([Number(m[1]) / 100, Number(m[2]), m[3] === 'none' ? 0 : Number(m[3])]));
  throw new Error('unreadable color: ' + v);
}

/**
 * The weakest contrast along a ramp, 41 samples. A plain `linear-gradient(…)` with hex stops interpolates in sRGB;
 * Oklab is checked as well, so a change of interpolation cannot pass unseen.
 */
function weakest(e1: string, e2: string, ground: string, space: 'oklab' | 'srgb'): number {
  let min = Infinity;
  const [a, b] = [toOklab(e1), toOklab(e2)];
  const [p, q] = [rgb(e1), rgb(e2)];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const c =
      space === 'oklab'
        ? fromOklab(a.map((v, k) => v + (b[k]! - v) * t) as Triple)
        : hex(p.map((v, k) => Math.round(v + (q[k]! - v) * t)));
    min = Math.min(min, contrast(c, ground));
  }
  return min;
}

// ---- Reading the source -------------------------------------------------------------------------------------------

const header = () => readFileSync(HEADER, 'utf8');
const globals = () => readFileSync(GLOBALS_CSS, 'utf8');
const frame = () => readFileSync(FRAME_CSS, 'utf8');
const noComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));

/** The text between the brace at `open` and its partner. */
function braced(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(open + 1, i);
  }
  throw new Error('unbalanced braces');
}

/** The top-level rules of a stylesheet (or of one @media block's body): selector → declarations, in order. */
function rules(text: string): { selector: string; start: number; declarations: Map<string, string> }[] {
  const css = noComments(text);
  const out: { selector: string; start: number; declarations: Map<string, string> }[] = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open === -1) break;
    const selector = css.slice(i, open).trim().replace(/\s+/g, ' ');
    const body = braced(css, open);
    if (!selector.startsWith('@')) {
      const declarations = new Map<string, string>();
      for (const d of body.split(';')) {
        const k = d.indexOf(':');
        if (k !== -1) declarations.set(d.slice(0, k).trim(), d.slice(k + 1).trim().replace(/\s+/g, ' '));
      }
      out.push({ selector, start: open, declarations });
    }
    i = open + body.length + 2;
  }
  return out;
}

/** The declarations of the one top-level rule with exactly this selector list. */
function rule(text: string, selector: string): Map<string, string> {
  const hits = rules(text).filter((r) => r.selector === selector);
  if (hits.length !== 1) throw new Error(`${selector}: found ${hits.length} rules, expected exactly 1`);
  return hits[0]!.declarations;
}

/** The body of the one `@media <query> { … }` block, and where it starts. */
function media(text: string, query: string): { body: string; start: number } {
  const css = noComments(text);
  const hits = Array.from(css.matchAll(/@media\s+([^{]+?)\s*\{/g)).filter((m) => m[1]!.trim() === query);
  if (hits.length !== 1) throw new Error(`@media ${query}: found ${hits.length} blocks, expected exactly 1`);
  const open = hits[0]!.index! + hits[0]![0].length - 1;
  return { body: braced(css, open), start: open };
}

/** `--app-grad-<theme>` from globals.css: exactly one declaration, a whole literal. */
function appGrad(theme: 'light' | 'dark'): string {
  const hits = Array.from(noComments(globals()).matchAll(new RegExp(`--app-grad-${theme}\\s*:\\s*([^;]+);`, 'g')));
  if (hits.length !== 1) throw new Error(`--app-grad-${theme}: found ${hits.length} declarations, expected exactly 1`);
  return hits[0]![1]!.trim();
}

/** A gradient string's two ends, light end first. Only the exact two-stop, left-to-right form is accepted. */
function endsOf(gradient: string): [string, string] {
  const m = /^linear-gradient\(90deg, (#[0-9a-f]{6}) 0%, (#[0-9a-f]{6}) 100%\)$/i.exec(gradient);
  if (!m) throw new Error('not a two-stop 90deg gradient of #rrggbb ends: ' + gradient);
  return [m[1]!.toLowerCase(), m[2]!.toLowerCase()];
}

/** The frame's page ground in each theme, read from the vendored stylesheet. */
const sfPage = (theme: 'light' | 'dark') =>
  parseCssColor(rule(frame(), theme === 'light' ? ':root' : ':root.dark, :root[data-theme="dark"]').get('--sf-page')!);
const sfToken = (theme: 'light' | 'dark', name: string) =>
  parseCssColor(rule(frame(), theme === 'light' ? ':root' : ':root.dark, :root[data-theme="dark"]').get(name)!);

/** The brand link in AppHeader.tsx, from `<Link` to `</Link>`. */
function brand(): string {
  const text = header();
  const start = text.indexOf('<Link href="/"');
  const end = text.indexOf('</Link>', start);
  if (start === -1 || end === -1) throw new Error('AppHeader.tsx: no brand <Link href="/">');
  return text.slice(start, end);
}

// ---- The guard ----------------------------------------------------------------------------------------------------

describe("the header's GanttApp™: a gradient in GanttApp's teal, readable in both themes (HDR26)", () => {
  describe('instrument self-checks', () => {
    it('the contrast formula: #767676 on white is 4.54 : 1', () => {
      expect(trunc(contrast('#767676', '#ffffff'))).toBe('4.54');
    });

    it("round trip, not a test of the steps: the suite's old blue gradient rebuilds from #0070f3 with its hue turns", () => {
      // As Appendix A writes it. The steps are computed from the same three colours they rebuild, so this is a round
      // trip of #0099ff and #0051cc through OKLCH and the gamut fit: it checks those conversions, not the steps.
      const [p, g1, g2] = ['#0070f3', '#0099ff', '#0051cc'].map(toLch) as [Triple, Triple, Triple];
      const stepOf = (g: Triple): Triple => [g[0] - p[0], g[1] / p[1], g[2] - p[2]];
      const withTurn = (fav: string, d: Triple) => {
        const [lk, c, h] = toLch(fav);
        return fromLch([lk + d[0], c * d[1], h + d[2]]);
      };
      expect(withTurn('#0070f3', stepOf(g1))).toBe('#0099ff');
      expect(withTurn('#0070f3', stepOf(g2))).toBe('#0051cc');
    });

    it("parseCssColor reads #fff, theme.ts's #333 and an oklch 'none' hue, and refuses what it cannot read", () => {
      expect(parseCssColor('#fff')).toBe('#ffffff');
      expect(parseCssColor('#333')).toBe('#333333');
      expect(parseCssColor('oklch(98.5% 0 none)')).toBe('#fafafa');
      expect(() => parseCssColor('rgb(1, 2, 3)')).toThrow(/unreadable/);
    });

    it('the ramp sampler fails a known-bad: the old blue gradient is 2.99 : 1 on white and 2.47 : 1 on #1a1a2e', () => {
      // Vacuity control: a sampler that always passed would pass every ramp test below. (#1a1a2e is the old dark
      // ground, kept here because the known-bad numbers were measured on it.)
      for (const space of ['oklab', 'srgb'] as const) {
        expect(trunc(weakest('#0099ff', '#0051cc', '#ffffff', space))).toBe('2.99');
        expect(trunc(weakest('#0099ff', '#0051cc', '#1a1a2e', space))).toBe('2.47');
      }
    });

    it('the stylesheet reader finds what it must: the frame\'s own .sf-app and .sf-grad rules, and the two media blocks', () => {
      // Must-find: a reader that found nothing would throw, but one that found the wrong rule would not.
      expect(rule(frame(), '.sf-app').get('background')).toBe('var(--sf-page)');
      expect(rule(frame(), '.sf-grad').get('background-image')).toBe('var(--app-grad-light)');
      expect(rule(media(frame(), '(prefers-contrast: more)').body, '.sf-grad').size).toBe(3);
      expect(rule(media(frame(), 'print').body, '.sf-grad').size).toBe(3);
      expect(() => rule(frame(), '.no-such-rule')).toThrow(/found 0/);
    });
  });

  it('exactly one element carries the gradient: one .sf-grad span, "GanttApp", inside the title', () => {
    // Must-find, and the census: a reader that found nothing would pass every row below.
    const b = brand();
    expect(Array.from(header().matchAll(/className="[^"]*\bsf-grad\b/g))).toHaveLength(1);
    expect(b).toMatch(/<span className="sf-title" data-sf="title">\s*<span className="sf-grad">GanttApp<\/span>/);
    for (const file of [header(), readFileSync(PAGE, 'utf8')]) {
      expect(file).not.toMatch(/\bbackgroundClip\b|\bWebkitBackgroundClip\b|\bbackgroundImage\b|\bTITLE_GRADIENT\b/);
    }
  });

  it('the title has no inline style at all, so a theme switch cannot reset its background-clip', () => {
    // React re-applies only the style keys that change; a changing `background` shorthand resets background-clip.
    // With no inline style, the stylesheet chooses the ramp by theme and React sets nothing.
    const b = brand();
    const title = b.slice(b.indexOf('<span className="sf-title"'));
    expect(title).not.toMatch(/\bstyle=/);
    // D7: no ground, opacity or hover of its own anywhere in the brand.
    expect(b).not.toMatch(/\bstyle=|\bopacity\b|\bhover\b|\bbackground\b/i);
  });

  it('the two ramps are whole literals in globals.css, byte for byte v0.33.1\'s, and nothing else there is a gradient', () => {
    // R5: a colour string assembled at runtime from parts could not be read here.
    expect(Array.from(noComments(globals()).matchAll(/linear-gradient\(/g))).toHaveLength(2);
    expect(appGrad('light')).toBe('linear-gradient(90deg, #449fbc 0%, #00657d 100%)');
    expect(appGrad('dark')).toBe('linear-gradient(90deg, #54adca 0%, #00738e 100%)');
    expect(endsOf(appGrad('light'))).toEqual(ENDS.light);
    expect(endsOf(appGrad('dark'))).toEqual(ENDS.dark);
    // The frame paints .sf-grad from them, and chooses the dark one on GanttApp's data-theme.
    expect(rule(frame(), '.sf-grad').get('background-image')).toBe('var(--app-grad-light)');
    expect(rule(frame(), ':root.dark .sf-grad, :root[data-theme="dark"] .sf-grad').get('background-image')).toBe('var(--app-grad-dark)');
  });

  it("the page's ground in each theme is the pinned premise: the frame's --sf-page, which theme.ts and .sf-bar follow", () => {
    expect(sfPage('light')).toBe(PREMISE.light);
    expect(sfPage('dark')).toBe(PREMISE.dark);
    expect(parseCssColor(LIGHT_THEME.background)).toBe(PREMISE.light);
    expect(parseCssColor(DARK_THEME.background)).toBe(PREMISE.dark);
    expect(rule(frame(), '.sf-bar').get('background')).toBe('var(--sf-page)');
  });

  it('the title is 24 px bold, so it is large text and the bar is 3 : 1', () => {
    const font = rule(frame(), '.sf-title').get('font')!;
    const m = /^(\d+) (\d+)px\/\d+px\b/.exec(font);
    expect(m, font).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(700);
    expect(Number(m![2])).toBeGreaterThanOrEqual(18.66);
  });

  for (const theme of ['light', 'dark'] as const) {
    it(`${theme}: every point of the ramp meets ${BAR} : 1 on the page, in Oklab and in sRGB`, () => {
      const [from, to] = endsOf(appGrad(theme));
      for (const space of ['oklab', 'srgb'] as const) {
        const w = weakest(from, to, PREMISE[theme], space);
        expect(w, `${theme} ${from} → ${to} on ${PREMISE[theme]} (${space}): ${trunc(w)}`).toBeGreaterThanOrEqual(BAR);
      }
    });
  }

  it("falls back to solid text under prefers-contrast: more, in the frame's heading colour", () => {
    const more = rule(media(frame(), '(prefers-contrast: more)').body, '.sf-grad');
    expect(more.get('background-image')).toBe('none !important');
    expect(more.get('-webkit-text-fill-color')).toBe('currentColor !important');
    expect(more.get('color')).toBe('var(--sf-heading) !important');
  });

  it('falls back to solid black in print, and the print rule wins when both match', () => {
    const print = media(frame(), 'print');
    const decl = rule(print.body, '.sf-grad');
    expect(decl.get('background-image')).toBe('none !important');
    expect(decl.get('-webkit-text-fill-color')).toBe('currentColor !important');
    expect(decl.get('color')).toBe('#000 !important');
    // Equal specificity, so the later rule wins: printing from a system set to more contrast must still print dark.
    expect(print.start).toBeGreaterThan(media(frame(), '(prefers-contrast: more)').start);
  });

  it('the fallback colours meet the bar: the heading colour on each ground, and print on white paper', () => {
    expect(contrast(sfToken('light', '--sf-heading'), PREMISE.light)).toBeGreaterThanOrEqual(BAR);
    expect(contrast(sfToken('dark', '--sf-heading'), PREMISE.dark)).toBeGreaterThanOrEqual(BAR);
    expect(contrast('#000000', '#ffffff')).toBeGreaterThanOrEqual(BAR);
  });

  it("the ™ is the frame's muted mark, the glyph, with no colour of its own, and it reads at 4.5 : 1", () => {
    // v0.33.1 drew the letters "TM" in #bbb (1.91 : 1 on white). The frame's mark is muted: 4.84 / 6.82.
    expect(brand()).toMatch(/<span className="sf-mark sf-mark--tm">™<\/span>/);
    for (const theme of ['light', 'dark'] as const) {
      expect(contrast(sfToken(theme, '--sf-text-muted'), PREMISE[theme]), theme).toBeGreaterThanOrEqual(4.5);
    }
  });
});
