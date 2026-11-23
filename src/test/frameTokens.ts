// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Test-only helpers for the SPERT® Suite frame (FRAME26, v0.34.0): read a token from the vendored
// styles/spert-frame.css, inject the real stylesheets into jsdom, and compute WCAG 2 contrast. Never imported by
// production code.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Theme = 'light' | 'dark';

const FRAME_CSS = join(process.cwd(), 'styles', 'spert-frame.css');

export const frameCss = () => readFileSync(FRAME_CSS, 'utf8');

/** The body of the first rule whose selector list is exactly `selector` (comments removed, whitespace collapsed). */
function ruleBody(css: string, selector: string, after?: string): string {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
  const from = after === undefined ? 0 : clean.indexOf(after);
  if (from === -1) throw new Error(`spert-frame.css: no "${after}"`);
  const re = new RegExp(`(^|[}\\s])${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`);
  const m = re.exec(clean.slice(from));
  if (!m) throw new Error(`spert-frame.css: no rule "${selector}"`);
  return m[2]!;
}

/** A custom property's value from the vendored stylesheet, in one theme (and under prefers-contrast: more). */
export function token(theme: Theme, name: string, more = false): string {
  const css = frameCss().replace(/\/\*[\s\S]*?\*\//g, '');
  const read = (body: string) => new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(body)?.[1]?.trim();
  let value: string | undefined;
  if (more) {
    value = read(ruleBody(css, theme === 'light' ? ':root' : ':root.dark, :root[data-theme="dark"]', '@media (prefers-contrast: more)'));
  }
  if (!value && theme === 'dark') value = read(ruleBody(css, ':root.dark, :root[data-theme="dark"]'));
  if (!value) value = read(ruleBody(css, ':root'));
  if (!value) throw new Error(`spert-frame.css: no ${name} for ${theme}${more ? ' (more contrast)' : ''}`);
  return value.toLowerCase();
}

/** The declarations of one rule in the vendored stylesheet, as a map. */
export function frameRule(selector: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const d of ruleBody(frameCss(), selector).split(';')) {
    const i = d.indexOf(':');
    if (i !== -1) out.set(d.slice(0, i).trim(), d.slice(i + 1).trim().replace(/\s+/g, ' '));
  }
  return out;
}

/** Puts the real stylesheets into jsdom's document (globals.css, then the vendored frame), replacing any earlier copy. */
export function injectStylesheets() {
  document.head.querySelectorAll('style[data-test-sheet]').forEach((e) => e.remove());
  for (const file of ['styles/globals.css', 'styles/spert-frame.css']) {
    const style = document.createElement('style');
    style.setAttribute('data-test-sheet', file);
    style.textContent = readFileSync(join(process.cwd(), file), 'utf8');
    document.head.appendChild(style);
  }
}

const channels = (h: string) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
const luminance = (h: string) => {
  const [r, g, b] = channels(h).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG 2 contrast of two #rrggbb colours, truncated to two decimals: never rounded up across a bar. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return Math.floor(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100;
}
