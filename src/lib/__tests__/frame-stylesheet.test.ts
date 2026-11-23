// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, it, expect } from 'vitest';

/**
 * The SPERT® Suite app frame's stylesheet is VENDORED: styles/spert-frame.css is a byte-for-byte copy of
 * spert-suite-docs/suite/frame/spert-frame.css (FRAME26, contract §9.1, v0.34.0). Never edit it here. To change it,
 * change the canonical copy, raise its `--sf-version`, and re-vendor it into every app that has adopted the frame, one
 * PR each. This pin is what makes an edit here fail.
 *
 * It is imported once, from pages/_app.tsx, and LAST: `.sf-btn` and `.pt-btn` are one class each, so source order
 * decides, and the frame's 36 px / 14 px / 500 must win on the toolbar buttons.
 */
const MD5 = '69146fd77679c71e03d2f06cfea96cf1';
const ROOT = process.cwd();
const VENDORED = join(ROOT, 'styles', 'spert-frame.css');

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...filesUnder(path));
    else if (/\.(tsx?|css)$/.test(name)) out.push(path);
  }
  return out;
}

describe('the vendored frame stylesheet (FRAME26)', () => {
  it(`is byte for byte the canonical copy: md5 ${MD5}`, () => {
    expect(createHash('md5').update(readFileSync(VENDORED)).digest('hex')).toBe(MD5);
  });

  it('declares version "2"', () => {
    expect(readFileSync(VENDORED, 'utf8')).toMatch(/--sf-version:\s*"2";/);
  });

  it('pages/_app.tsx imports it exactly once, and last of the stylesheets', () => {
    const app = readFileSync(join(ROOT, 'pages', '_app.tsx'), 'utf8');
    const sheets = Array.from(app.matchAll(/^import\s+['"]@\/(styles\/[^'"]+\.css)['"]/gm)).map((m) => m[1]);
    expect(sheets.filter((s) => s === 'styles/spert-frame.css')).toHaveLength(1);
    expect(sheets[sheets.length - 1]).toBe('styles/spert-frame.css');
  });

  it('nothing else imports it (a JS import or a CSS @import)', () => {
    const importers = ['src', 'pages', 'styles']
      .flatMap((d) => filesUnder(join(ROOT, d)))
      .filter((f) => !f.includes('__tests__') && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))
      .filter((f) => /\bimport\s+(?:[^'"]*from\s+)?['"][^'"]*spert-frame\.css['"]|@import[^;]*spert-frame\.css/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(ROOT, f));
    expect(importers).toEqual(['pages/_app.tsx']);
  });
});
