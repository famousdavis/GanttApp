// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { LIGHT_THEME, DARK_THEME } from '../../shared/utils/theme';

/**
 * The header's GanttApp™ is drawn as a gradient in GanttApp's favicon teal, #0891b2 (HDR26, v0.33.1), and every
 * point of it stays readable on the page behind it, in both themes.
 *
 * ⚠️ jsdom has no paint, so nothing here is measured from a render. The gradient strings are read from
 * `pages/index.tsx`'s source, the page backgrounds come from `theme.ts`, and the contrast is computed here from the
 * WCAG 2.x definition. The rendered page was measured in Chrome when this was written: the first opaque background
 * behind the title is the page's root <div>, which paints `colors.background`.
 *
 * The bar is 3 : 1 at every point of each ramp: the title is 33.6 px bold at every width, which is large text. Both
 * ramps clear the bar by hundredths, on purpose, so the backgrounds are pinned below: a change to either one has to
 * come through here.
 *
 * The title's gradient is set as `backgroundImage`, never through the `background` shorthand. React re-applies only
 * the style keys that change, and setting the shorthand resets `background-clip`, so a theme-chosen shorthand turns
 * the title into a solid bar on the first live theme switch while every other check stays green. That trap is
 * checked here by the source's shape, and by behaviour in `title-gradient.page.test.tsx`.
 *
 * The colour maths is the HDR26 plan's Appendix A, typed. It is copied, not shared.
 */
const PAGE = join(process.cwd(), 'pages', 'index.tsx');
const GLOBALS_CSS = join(process.cwd(), 'styles', 'globals.css');

const BAR = 3;
/** The page's background in each theme: theme.ts, measured in Chrome behind the title (`getComputedStyle`). */
const PREMISE = { light: '#ffffff', dark: '#1a1a2e' } as const;
/** The approved ends (HDR26 plan §2), light end first. A change to any of them goes back to the owner with a proof. */
const ENDS = { light: ['#449fbc', '#00657d'], dark: ['#54adca', '#00738e'] } as const;
const TITLE_CLASS = 'hdr26-title';
const CONTRAST_PROPERTY = '--hdr26-title-contrast';

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

const page = () => readFileSync(PAGE, 'utf8');
const css = () => readFileSync(GLOBALS_CSS, 'utf8');

/** The `TITLE_GRADIENT = { light: '…', dark: '…' }` object: each theme's string, read as a whole literal. */
function titleGradients(text: string): { light: string; dark: string } {
  const block = /\bconst\s+TITLE_GRADIENT\s*=\s*\{([^}]*)\}/.exec(text);
  if (!block) throw new Error('pages/index.tsx: no TITLE_GRADIENT object');
  const read = (theme: 'light' | 'dark') => {
    const hits = Array.from(block[1]!.matchAll(new RegExp(`\\b${theme}\\s*:\\s*'([^']*)'`, 'g')));
    if (hits.length !== 1) throw new Error(`TITLE_GRADIENT.${theme}: found ${hits.length}, expected exactly 1`);
    return hits[0]![1]!;
  };
  return { light: read('light'), dark: read('dark') };
}

/** A gradient string's two ends, light end first. Only the exact two-stop, left-to-right form is accepted. */
function endsOf(gradient: string): [string, string] {
  const m = /^linear-gradient\(90deg, (#[0-9a-f]{6}) 0%, (#[0-9a-f]{6}) 100%\)$/i.exec(gradient);
  if (!m) throw new Error('not a two-stop 90deg gradient of #rrggbb ends: ' + gradient);
  return [m[1]!.toLowerCase(), m[2]!.toLowerCase()];
}

/** Every JSX element in the page whose inline style clips its background to its text: its tag and opening tag. */
function textClippedElements(text: string): { tag: string; openingTag: string }[] {
  const found: { tag: string; openingTag: string }[] = [];
  // Array.from: tsconfig targets es5 without downlevelIteration, so for…of over an iterator is a type error (TS2802).
  for (const m of Array.from(text.matchAll(/\bbackgroundClip:\s*'text'/g))) {
    const start = text.lastIndexOf('<', m.index);
    // The style object's own closing brace (its values hold no braces), then the end of the opening tag.
    const end = text.indexOf('>', text.indexOf('}', m.index));
    const tag = /^<([A-Za-z][\w.]*)/.exec(text.slice(start));
    if (start === -1 || end === -1 || !tag) throw new Error('pages/index.tsx: a backgroundClip outside a JSX tag');
    found.push({ tag: tag[1]!, openingTag: text.slice(start, end + 1) });
  }
  return found;
}

/** The title's inline style object, between `style={{` and its closing brace. */
function titleStyle(text: string): string {
  const [title] = textClippedElements(text);
  if (!title) throw new Error('pages/index.tsx: no text-clipped title');
  const m = /style=\{\{([^}]*)\}/.exec(title.openingTag);
  if (!m) throw new Error('pages/index.tsx: the title has no inline style object');
  return m[1]!;
}

/** The title element from its opening tag to `</h1>`, so its ™ <sup> can be read. */
function titleElement(text: string): string {
  const start = text.indexOf('<h1');
  const end = text.indexOf('</h1>', start);
  if (start === -1 || end === -1) throw new Error('pages/index.tsx: no <h1>');
  return text.slice(start, end);
}

interface Rule {
  start: number;
  declarations: Map<string, string>;
  selector: string;
}

/**
 * Every `@media <query> { <selector> { … } }` block in the stylesheet whose query matches `query` exactly: its
 * position, its one inner selector, and its declarations (name → value, `!important` kept in the value).
 */
function mediaRules(text: string, query: string): Rule[] {
  const rules: Rule[] = [];
  const re = /@media\s+([^{]+?)\s*\{\s*([^{}]+?)\s*\{([^{}]*)\}\s*\}/g;
  for (const m of Array.from(text.matchAll(re))) {
    if (m[1]!.trim() !== query) continue;
    const declarations = new Map<string, string>();
    for (const d of m[3]!.split(';')) {
      const i = d.indexOf(':');
      if (i !== -1) declarations.set(d.slice(0, i).trim(), d.slice(i + 1).trim());
    }
    rules.push({ start: m.index!, selector: m[2]!.trim(), declarations });
  }
  return rules;
}

/** The one rule for the title's class under this media query: exactly one, or it fails. */
function fallback(query: string): Rule {
  const hits = mediaRules(css(), query).filter((r) => r.selector.split(/[\s,]+/).includes(`.${TITLE_CLASS}`));
  if (hits.length !== 1) throw new Error(`globals.css @media ${query}: found ${hits.length} title rules, expected 1`);
  return hits[0]!;
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
      // Vacuity control: a sampler that always passed would pass every ramp test below.
      for (const space of ['oklab', 'srgb'] as const) {
        expect(trunc(weakest('#0099ff', '#0051cc', PREMISE.light, space))).toBe('2.99');
        expect(trunc(weakest('#0099ff', '#0051cc', PREMISE.dark, space))).toBe('2.47');
      }
    });
  });

  it('exactly one element clips its background to its text, and it is the <h1> carrying the title class', () => {
    // Must-find, and the census: a reader that found nothing would pass every row below.
    const clipped = textClippedElements(page());
    expect(clipped.map((e) => e.tag)).toEqual(['h1']);
    expect(clipped[0]!.openingTag).toMatch(/WebkitBackgroundClip:\s*'text'/);
    expect(clipped[0]!.openingTag).toMatch(/WebkitTextFillColor:\s*'transparent'/);
    expect(clipped[0]!.openingTag).toMatch(new RegExp(`^<h1 className="${TITLE_CLASS}" style=\\{\\{`));
  });

  it('the gradient is set as backgroundImage from TITLE_GRADIENT by theme, never through the background shorthand', () => {
    // React re-applies only the style keys that change; a changing `background` shorthand resets background-clip.
    const style = titleStyle(page());
    expect(style).not.toMatch(/(?:^|[\s,{])['"]?background['"]?\s*:/);
    expect(style).toMatch(/\bbackgroundImage:\s*TITLE_GRADIENT\[resolvedTheme\],/);
  });

  it('the two gradient strings are whole literals in one object, and the page holds no other gradient', () => {
    // R5: a colour string assembled at runtime from parts could not be read here.
    const text = page();
    const gradients = titleGradients(text);
    expect(Array.from(text.matchAll(/linear-gradient\(/g))).toHaveLength(2);
    expect(text.match(/\bTITLE_GRADIENT\b/g)).toHaveLength(2);
    expect(endsOf(gradients.light)).toEqual(ENDS.light);
    expect(endsOf(gradients.dark)).toEqual(ENDS.dark);
  });

  it("the page's background in each theme is the pinned premise", () => {
    expect(parseCssColor(LIGHT_THEME.background)).toBe(PREMISE.light);
    expect(parseCssColor(DARK_THEME.background)).toBe(PREMISE.dark);
  });

  for (const theme of ['light', 'dark'] as const) {
    it(`${theme}: every point of the ramp meets ${BAR} : 1 on the page, in Oklab and in sRGB`, () => {
      const [from, to] = endsOf(titleGradients(page())[theme]);
      for (const space of ['oklab', 'srgb'] as const) {
        const w = weakest(from, to, PREMISE[theme], space);
        expect(w, `${theme} ${from} → ${to} on ${PREMISE[theme]} (${space}): ${trunc(w)}`).toBeGreaterThanOrEqual(BAR);
      }
    });
  }

  it("falls back to solid text under prefers-contrast: more, in the theme's own text colour", () => {
    const rule = fallback('(prefers-contrast: more)');
    expect(rule.selector).toBe(`.${TITLE_CLASS}`);
    expect(rule.declarations.get('background-image')).toBe('none !important');
    expect(rule.declarations.get('color')).toBe(`var(${CONTRAST_PROPERTY}) !important`);
    expect(rule.declarations.get('-webkit-text-fill-color')).toBe(`var(${CONTRAST_PROPERTY}) !important`);
    // The <h1> sets the property from the theme's text colour, so it switches in the same render as the gradient.
    expect(titleStyle(page())).toMatch(new RegExp(`'${CONTRAST_PROPERTY}':\\s*colors\\.text\\b`));
  });

  it('falls back to solid near-black in print, LIGHT_THEME.text, and the print rule wins when both match', () => {
    const print = fallback('print');
    expect(print.selector).toBe(`.${TITLE_CLASS}`);
    expect(print.declarations.get('background-image')).toBe('none !important');
    for (const property of ['color', '-webkit-text-fill-color']) {
      const value = print.declarations.get(property);
      expect(value, property).toMatch(/ !important$/);
      expect(parseCssColor(value!.replace(/ !important$/, '')), property).toBe(parseCssColor(LIGHT_THEME.text));
    }
    // Equal specificity, so the later rule wins: printing from a system set to more contrast must still print dark.
    expect(print.start).toBeGreaterThan(fallback('(prefers-contrast: more)').start);
  });

  it('the fallback colours meet the bar: each theme text on its page, and print on white paper', () => {
    expect(contrast(parseCssColor(LIGHT_THEME.text), PREMISE.light)).toBeGreaterThanOrEqual(BAR);
    expect(contrast(parseCssColor(DARK_THEME.text), PREMISE.dark)).toBeGreaterThanOrEqual(BAR);
  });

  it('the ™ keeps its own colour: the <sup> sets #bbb as both colour and text fill', () => {
    const sup = /<sup style=\{\{([^}]*)\}\}>TM<\/sup>/.exec(titleElement(page()));
    expect(sup, 'the title has a TM <sup> with an inline style').not.toBeNull();
    expect(sup![1]).toMatch(/\bcolor:\s*'#bbb'/);
    expect(sup![1]).toMatch(/\bWebkitTextFillColor:\s*'#bbb'/);
  });
});
