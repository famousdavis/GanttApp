// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

/**
 * Two cascade properties of the app's stylesheets, read from the real files.
 *
 * 1. A hovered primary button (`.pt-btn-primary`: New Project, and the project
 *    dialog's Create / Update) keeps its blue. v0.32.0 gave the generic
 *    `.pt-btn` hover rule `:not(:disabled)`, which raised it from (0,2,0) to
 *    (0,3,0) and let it beat the (0,2,0) primary hover rule on `background`:
 *    the button went light grey behind white text. Nothing caught it, because
 *    no test loaded either stylesheet.
 * 2. `button`, `input`, `select` and `textarea` take the page's font family.
 *    Without a rule they take the browser's own control font (Arial; monospace
 *    for date fields in Chrome).
 *
 * jsdom cannot hover and does not lay out text, so the browser remains the
 * measurement. This only stops the cascade from going wrong again. Specificity
 * is computed, not matched as text: a fix that is textually present and still
 * loses (for example under a raised generic rule) must fail here.
 */

const ROOT = process.cwd();

type Specificity = [number, number, number];

interface Declaration {
  prop: string;
  value: string;
  important: boolean;
}

interface Rule {
  file: string;
  line: number;
  /** Position in the cascade: stylesheet import order, then source order. */
  order: number;
  /** At-rule preludes the rule sits inside, outermost first. */
  context: string[];
  selectors: string[];
  decls: Declaration[];
}

/** Comments become spaces, newlines kept, so offsets still map to lines. */
function blankComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
}

function lineAt(css: string, offset: number): number {
  return css.slice(0, offset).split('\n').length;
}

/** Index of the bracket that closes the one at `open`. */
function matching(text: string, open: number, openCh: string, closeCh: string): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === openCh) depth++;
    else if (text[i] === closeCh) {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error(`unbalanced ${openCh} at ${open}`);
}

/** Split on `sep` where it is not inside (), [] or {}. */
function splitTopLevel(text: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === sep && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

function parseDecls(body: string): Declaration[] {
  return splitTopLevel(body, ';')
    .filter((d) => d.indexOf(':') > 0)
    .map((d) => {
      const colon = d.indexOf(':');
      const raw = d.slice(colon + 1).trim();
      const important = /!\s*important$/i.test(raw);
      return {
        prop: d.slice(0, colon).trim().toLowerCase(),
        value: raw.replace(/!\s*important$/i, '').trim(),
        important,
      };
    });
}

const GROUPING_AT_RULES = /^@(media|supports|container|layer)\b/i;

interface ParseState {
  file: string;
  css: string;
  base: number;
  rules: Rule[];
}

/** Collect the style rules in css[from, to), descending into grouping at-rules. */
function parseBlock(state: ParseState, from: number, to: number, context: string[]): void {
  let i = from;
  while (i < to) {
    const brace = state.css.indexOf('{', i);
    const semi = state.css.indexOf(';', i);
    if (brace === -1 || brace >= to) return;
    const prelude = state.css.slice(i, brace).trim();
    if (semi !== -1 && semi < brace && prelude.charAt(0) === '@') {
      i = semi + 1; // a statement at-rule such as @import
      continue;
    }
    const close = matching(state.css, brace, '{', '}');
    if (GROUPING_AT_RULES.test(prelude)) {
      parseBlock(state, brace + 1, close, context.concat([prelude]));
    } else if (prelude.charAt(0) !== '@') {
      const start = i + Math.max(0, state.css.slice(i, brace).search(/\S/));
      state.rules.push({
        file: state.file,
        line: lineAt(state.css, start),
        order: state.base + start,
        context,
        selectors: splitTopLevel(prelude, ','),
        decls: parseDecls(state.css.slice(brace + 1, close)),
      });
    }
    i = close + 1;
  }
}

function parseStylesheet(file: string, base: number): Rule[] {
  const css = blankComments(readFileSync(join(ROOT, file), 'utf-8'));
  const state: ParseState = { file, css, base, rules: [] };
  parseBlock(state, 0, css.length, []);
  return state.rules;
}

// ---------- specificity (Selectors Level 4) ----------

const IDENT_CHAR = /[A-Za-z0-9_\- -￿]/;
const LEGACY_PSEUDO_ELEMENTS = ['before', 'after', 'first-line', 'first-letter'];
const TAKES_MOST_SPECIFIC_ARGUMENT = ['not', 'is', 'has', 'matches'];

function readIdent(sel: string, i: number): number {
  let j = i;
  while (j < sel.length && (IDENT_CHAR.test(sel[j]) || sel[j] === '\\')) j += sel[j] === '\\' ? 2 : 1;
  return j;
}

function add(x: Specificity, y: Specificity): Specificity {
  return [x[0] + y[0], x[1] + y[1], x[2] + y[2]];
}

function compareSpecificity(x: Specificity, y: Specificity): number {
  for (let k = 0; k < 3; k++) if (x[k] !== y[k]) return x[k] - y[k];
  return 0;
}

function mostSpecific(list: string): Specificity {
  return splitTopLevel(list, ',')
    .map(specificity)
    .reduce((best, s) => (compareSpecificity(s, best) > 0 ? s : best), [0, 0, 0] as Specificity);
}

/** A pseudo-class or pseudo-element starting at the colon at `i`. */
function pseudoAt(sel: string, i: number): { spec: Specificity; next: number } {
  const element = sel[i + 1] === ':';
  const nameStart = i + (element ? 2 : 1);
  let next = readIdent(sel, nameStart);
  const name = sel.slice(nameStart, next).toLowerCase();
  let arg: string | null = null;
  if (sel[next] === '(') {
    const close = matching(sel, next, '(', ')');
    arg = sel.slice(next + 1, close);
    next = close + 1;
  }
  if (element || LEGACY_PSEUDO_ELEMENTS.indexOf(name) !== -1) return { spec: [0, 0, 1], next };
  if (name === 'where') return { spec: [0, 0, 0], next };
  if (arg !== null && TAKES_MOST_SPECIFIC_ARGUMENT.indexOf(name) !== -1) return { spec: mostSpecific(arg), next };
  return { spec: [0, 1, 0], next };
}

/** One simple selector (or combinator) starting at `i`. */
function simpleAt(sel: string, i: number): { spec: Specificity; next: number } {
  const ch = sel[i];
  if (ch === '#') return { spec: [1, 0, 0], next: readIdent(sel, i + 1) };
  if (ch === '.') return { spec: [0, 1, 0], next: readIdent(sel, i + 1) };
  if (ch === '[') return { spec: [0, 1, 0], next: matching(sel, i, '[', ']') + 1 };
  if (ch === ':') return pseudoAt(sel, i);
  if (IDENT_CHAR.test(ch)) return { spec: [0, 0, 1], next: readIdent(sel, i) };
  return { spec: [0, 0, 0], next: i + 1 }; // *, combinators, whitespace
}

/** Specificity of one complex selector. */
function specificity(sel: string): Specificity {
  let total: Specificity = [0, 0, 0];
  let i = 0;
  while (i < sel.length) {
    const step = simpleAt(sel, i);
    total = add(total, step.spec);
    i = step.next;
  }
  return total;
}

// ---------- reading selectors ----------

/** The rightmost compound selector: the element the rule styles. */
function subjectOf(sel: string): string {
  const compounds = splitTopLevel(sel.replace(/\s*([>+~])\s*/g, ' '), ' ');
  return compounds[compounds.length - 1] || '';
}

/** The compound with its :not(...) arguments removed. */
function withoutNegations(compound: string): string {
  let out = '';
  let i = 0;
  while (i < compound.length) {
    if (compound.slice(i, i + 5).toLowerCase() === ':not(') {
      i = matching(compound, i + 4, '(', ')') + 1;
    } else {
      out += compound[i];
      i++;
    }
  }
  return out;
}

function hasClass(compound: string, name: string): boolean {
  return new RegExp(`\\.${name}(?![A-Za-z0-9_-])`).test(withoutNegations(compound));
}

function hasHover(compound: string): boolean {
  return /:hover(?![A-Za-z0-9_-])/.test(withoutNegations(compound));
}

/** True when a :not(...) in the compound excludes primary buttons. */
function excludesPrimary(compound: string): boolean {
  return compound.length !== withoutNegations(compound).length && /:not\([^)]*\.pt-btn-primary(?![A-Za-z0-9_-])/.test(compound);
}

// ---------- the stylesheets, in the order the app loads them ----------

function stylesheetsInImportOrder(): string[] {
  const app = readFileSync(join(ROOT, 'pages', '_app.tsx'), 'utf-8');
  const files: string[] = [];
  const pattern = /^import\s+['"]@\/(styles\/[^'"]+\.css)['"]/gm;
  let m = pattern.exec(app);
  while (m) {
    files.push(m[1]);
    m = pattern.exec(app);
  }
  return files;
}

const SHEETS = stylesheetsInImportOrder();
const RULES: Rule[] = SHEETS.reduce<Rule[]>((all, file, n) => all.concat(parseStylesheet(file, n * 1e7)), []);

/** A rule seen through one of its selectors. */
interface Hit {
  rule: Rule;
  selector: string;
  spec: Specificity;
}

function hits(test: (subject: string) => boolean): Hit[] {
  const found: Hit[] = [];
  RULES.forEach((rule) => {
    rule.selectors.forEach((selector) => {
      if (test(subjectOf(selector))) found.push({ rule, selector, spec: specificity(selector) });
    });
  });
  return found;
}

const PROPERTY_FAMILIES: Record<string, RegExp> = {
  background: /^background(-color)?$/,
  'border colour': /^border(-color|-top-color|-right-color|-bottom-color|-left-color)?$/,
};

function decl(hit: Hit, family: string): Declaration | undefined {
  const decls = hit.rule.decls.filter((d) => PROPERTY_FAMILIES[family].test(d.prop));
  return decls[decls.length - 1];
}

/** Does `winner` take `family` from `loser` on an element both match? */
function beats(winner: Hit, loser: Hit, family: string): boolean {
  const w = decl(winner, family);
  const l = decl(loser, family);
  if (!w || !l) return false;
  if (w.important !== l.important) return w.important;
  const bySpecificity = compareSpecificity(winner.spec, loser.spec);
  if (bySpecificity !== 0) return bySpecificity > 0;
  return winner.rule.order > loser.rule.order;
}

const describeHit = (h: Hit): string => `\`${h.selector}\` (${h.spec.join(',')}) at ${h.rule.file}:${h.rule.line}`;

const GENERIC_HOVER = hits((s) => hasClass(s, 'pt-btn') && hasHover(s) && !hasClass(s, 'pt-btn-primary') && !excludesPrimary(s));
const PRIMARY_HOVER = hits((s) => hasClass(s, 'pt-btn-primary') && hasHover(s));

describe('the stylesheets this test reads', () => {
  it('computes specificity the way the cascade does', () => {
    expect(specificity('.pt-btn:hover')).toEqual([0, 2, 0]);
    expect(specificity('.pt-btn:hover:not(:disabled)')).toEqual([0, 3, 0]);
    expect(specificity('.pt-root .pt-btn:hover:not(:disabled)')).toEqual([0, 4, 0]);
    expect(specificity('.pt-root :where(button, input, [tabindex]):focus-visible')).toEqual([0, 2, 0]);
    expect(specificity(':is(.a, #b) > c::before')).toEqual([1, 0, 2]);
    expect(specificity('.pt-btn[aria-disabled="true"]')).toEqual([0, 2, 0]);
    expect(specificity('input[type="date"]::-webkit-datetime-edit-text')).toEqual([0, 1, 2]);
    expect(SHEETS).toEqual(['styles/globals.css', 'styles/projects-tab.css']);
  });
});

describe('a hovered primary button keeps its blue', () => {
  it('finds the primary hover rule and the generic .pt-btn hover rules', () => {
    const primaryBackground = PRIMARY_HOVER.filter((h) => decl(h, 'background'));
    expect(primaryBackground.map(describeHit)).toHaveLength(1);
    expect(decl(primaryBackground[0], 'background')?.value).toBe('var(--pt-primary-hover)');
    expect(decl(primaryBackground[0], 'border colour')?.value).toBe('var(--pt-primary-hover)');
    expect(GENERIC_HOVER.filter((h) => decl(h, 'background')).length).toBeGreaterThan(0);
  });

  it('the primary hover rule beats every generic .pt-btn hover rule, by specificity and then source order', () => {
    const losses: string[] = [];
    GENERIC_HOVER.forEach((generic) => {
      Object.keys(PROPERTY_FAMILIES).forEach((family) => {
        if (!decl(generic, family)) return;
        const won = PRIMARY_HOVER.some((primary) => beats(primary, generic, family));
        if (!won) losses.push(`${describeHit(generic)} wins ${family} over the primary hover rule`);
      });
    });
    expect(losses).toEqual([]);
  });
});

describe('form controls take the page font', () => {
  const CONTROLS = ['button', 'input', 'select', 'textarea'];
  const globals = RULES.filter((r) => r.file === 'styles/globals.css' && r.context.length === 0);

  it.each(CONTROLS)('globals.css gives %s font-family: inherit', (element) => {
    const giving = globals.filter((r) =>
      r.selectors.some((s) => s.toLowerCase() === element) &&
      r.decls.some((d) => d.prop === 'font-family' && d.value.toLowerCase() === 'inherit'));
    expect(giving.map((r) => `${r.file}:${r.line}`)).toHaveLength(1);
  });

  it('no rule styling those elements by type alone gives them another family', () => {
    const contrary: string[] = [];
    RULES.forEach((rule) => {
      rule.selectors.forEach((selector) => {
        const subject = subjectOf(selector);
        const element = (/^[a-z]+/i.exec(subject) || [''])[0].toLowerCase();
        if (CONTROLS.indexOf(element) === -1 || /[.#]|::/.test(selector)) return;
        rule.decls
          .filter((d) => (d.prop === 'font-family' || d.prop === 'font') && d.value.toLowerCase() !== 'inherit')
          .forEach((d) => contrary.push(`\`${selector}\` sets ${d.prop}: ${d.value} at ${rule.file}:${rule.line}`));
      });
    });
    expect(contrary).toEqual([]);
  });
});
