// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, expect, it } from 'vitest';
import { stripTabParam, tabFromSearch, tabHref } from '../tabLink';

describe('the 404 page\'s tab links (v0.35.0)', () => {
  it('links each tab to the app\'s page, Projects to "/" itself', () => {
    expect(tabHref('projects')).toBe('/');
    expect(tabHref('releases')).toBe('/?tab=releases');
    expect(tabHref('changelog')).toBe('/?tab=changelog');
  });
  it('reads back only a tab that exists', () => {
    expect(tabFromSearch('?tab=chart')).toBe('chart');
    expect(tabFromSearch('?tab=nope')).toBeNull();
    expect(tabFromSearch('')).toBeNull();
    expect(tabFromSearch('?invite=abc')).toBeNull();
  });
  it('drops only tab, keeping every other parameter', () => {
    expect(stripTabParam('?tab=about')).toBe('');
    expect(stripTabParam('?invite=abc&tab=about')).toBe('?invite=abc');
  });
});
