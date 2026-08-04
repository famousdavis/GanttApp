// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, it, expect } from 'vitest';

/**
 * The shell HTML must carry a document title.
 *
 * It did not, for a long time, and nothing caught it. The title was declared in
 * `pages/index.tsx` — inside the provider tree. `ThemeProvider` returns `null`
 * until it has mounted on the client, so during the static export that produces
 * the shell, the page component and its `<Head>` rendered to nothing. The
 * served HTML had an empty `div#__next`, no title, no description and no
 * favicon. Everything looked right in the browser, because hydration filled it
 * in a moment later. Only a `curl` of production showed the gap.
 *
 * That failure mode is invisible to a render test — mount the page in jsdom and
 * the title is there, because jsdom mounts. So this is a source scan of the
 * `pages/` shell instead: the title has to be declared where a null-rendering
 * provider cannot swallow it.
 */
const CANONICAL_TITLE =
  'GanttApp™ — Split-bar Gantt charts for visualizing release uncertainty';

const TITLE_TAG = /<title>([\s\S]*?)<\/title>/g;

/**
 * Comments are stripped before scanning: prose in this repo talks about the
 * markup it manages, and a doc comment naming the tag should not read as a
 * second declaration of it. Line comments are only stripped when they open the
 * line, so `https://` inside a string survives.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

function pageSources(dir: string): Array<{ path: string; source: string }> {
  return readdirSync(dir)
    .filter((entry) => /\.tsx$/.test(entry))
    .map((entry) => ({
      path: join(dir, entry),
      source: stripComments(readFileSync(join(dir, entry), 'utf-8')),
    }));
}

function titlesIn(source: string): string[] {
  return Array.from(source.matchAll(TITLE_TAG), (match) => match[1] ?? '');
}

describe('document title reaches the shell HTML', () => {
  const root = process.cwd();
  const appPath = join(root, 'pages', '_app.tsx');
  const appSource = stripComments(readFileSync(appPath, 'utf-8'));

  it('declares the canonical title in pages/_app.tsx', () => {
    const titles = titlesIn(appSource);

    expect(
      titles,
      'pages/_app.tsx must declare exactly one title element',
    ).toHaveLength(1);
    expect(titles[0]).toBe(CANONICAL_TITLE);
  });

  it('renders that title outside the provider tree', () => {
    // The whole point: a title nested inside AuthProvider/ThemeProvider never
    // reaches the export. Assert it is declared before the providers open.
    const titleAt = appSource.indexOf('<title>');
    const firstProviderAt = appSource.indexOf('<AuthProvider>');

    expect(titleAt).toBeGreaterThan(-1);
    expect(firstProviderAt).toBeGreaterThan(-1);
    expect(
      titleAt,
      'the title must be declared outside (before) the provider tree — a provider that ' +
        'renders null during export would otherwise swallow it',
    ).toBeLessThan(firstProviderAt);
  });

  it('has no competing title in any other page', () => {
    const competing = pageSources(join(root, 'pages'))
      .filter(({ path }) => path !== appPath)
      .filter(({ source }) => titlesIn(source).length > 0)
      .map(({ path }) => relative(root, path));

    expect(
      competing,
      'next/head lets the deepest title win, so a page-level title would override the ' +
        `shell title after hydration — and sit behind the mount gate again:\n  ${competing.join('\n  ')}`,
    ).toEqual([]);
  });
});
