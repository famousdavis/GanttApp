// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// FRAME26 pass 3's GanttApp leftovers (v0.36.0), pinned where a unit test can see them. The browser measures the same
// items on the local build (frame-check and the seat's probes); these keep them from coming back unnoticed.
//   G1 / Y1 the © year (footer) · G2 Chart Settings wraps at zoom · G4 the Storage settings' message colours
// The About page's words are in src/features/about/__tests__/AboutTab.test.tsx; its place on the page, G3 and Y1
// through the real page are in frame-about.page.test.tsx.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ChartSettings } from '../../features/chart/ChartSettings';
import { AppFooter } from '../../shared/components/AppFooter';
import { ThemeWrapper } from '../../test/ThemeWrapper';
import { DEFAULT_CHART_COLORS, DEFAULT_DISPLAY_SETTINGS } from '../../shared/utils/colors';
import { contrast, token } from '../../test/frameTokens';

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
const noComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

afterEach(() => vi.useRealTimers());

describe('G1 / Y1: the footer\'s © year is the current year', () => {
  it('with the clock at 2027 the footer reads © 2027, and no year is written into the footer\'s source', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2027, 0, 1, 9, 0, 0));
    const { container } = render(<AppFooter onOpenChangelog={vi.fn()} />);
    expect(container.querySelector('footer')!.textContent).toMatch(/^© 2027 William W\. Davis, MSPM, PMP \| Version /);
    expect(read('src', 'shared', 'components', 'AppFooter.tsx')).not.toMatch(/&copy;\s*20\d\d/);
  });
});

describe('G2: Chart Settings wraps rather than running off the window at 125 % and 150 % zoom', () => {
  function renderOpen() {
    const props = {
      showColorSettings: true, setShowColorSettings: vi.fn(), showTodayLine: true, setShowTodayLine: vi.fn(),
      todayDateOverride: '', setTodayDateOverride: vi.fn(), statusDateOutOfRange: false, showFinishDateLine: true,
      setShowFinishDateLine: vi.fn(), showMostLikelyLine: true, setShowMostLikelyLine: vi.fn(), showMonths: false,
      setShowMonths: vi.fn(), chartColors: DEFAULT_CHART_COLORS, onColorsChange: vi.fn(), activePreset: 'default',
      displaySettings: DEFAULT_DISPLAY_SETTINGS, setDisplaySettings: vi.fn(), preparedBy: '', setPreparedBy: vi.fn(),
      showPreparedBy: true, setShowPreparedBy: vi.fn(),
    } as unknown as Parameters<typeof ChartSettings>[0];
    return render(<ChartSettings {...props} />, { wrapper: ThemeWrapper });
  }

  it('the toggles row wraps: Show Today\'s Date … Show Prepared By on one flex row with flex-wrap', () => {
    const { container } = renderOpen();
    const today = container.querySelector('input[name="showTodayLine"]')!;
    const row = today.closest('label')!.parentElement!.parentElement!;
    expect(row.style.display).toBe('flex');
    expect(row.style.flexWrap).toBe('wrap');
    expect(row.querySelector('input[name="showPreparedBy"]')).not.toBeNull();
  });

  it('the six display settings sit in .chart-display-settings, not a fixed six-column grid', () => {
    const { container } = renderOpen();
    const box = container.querySelector('.chart-display-settings')!;
    expect(box).not.toBeNull();
    expect(box.children).toHaveLength(6);
    expect(container.querySelector('[style*="repeat(6"]')).toBeNull();
  });

  it('globals.css: .chart-display-settings is a wrapping flex row whose cells grow', () => {
    const css = noComments(read('styles', 'globals.css'));
    const box = /\.chart-display-settings\s*\{([^}]*)\}/.exec(css);
    expect(box).not.toBeNull();
    expect(box![1]).toMatch(/display:\s*flex/);
    expect(box![1]).toMatch(/flex-wrap:\s*wrap/);
    const cell = /\.chart-display-settings\s*>\s*\*\s*\{([^}]*)\}/.exec(css);
    expect(cell).not.toBeNull();
    expect(cell![1]).toMatch(/flex:\s*1 1 auto/);
  });
});

describe('G4: the Storage settings\' messages take the frame\'s text tokens', () => {
  it('no #e53e3e or #38a169 text colour is left in StorageSection.tsx; the red delete button\'s fill stays', () => {
    const src = read('src', 'features', 'settings', 'StorageSection.tsx');
    expect(src).not.toMatch(/color:\s*[^,\n]*'#e53e3e'/);
    expect(src).not.toMatch(/'#38a169'/);
    expect(src).toMatch(/background: '#e53e3e'/);
  });

  it('the tokens reach 4.5:1 on the page ground in both themes', () => {
    for (const theme of ['light', 'dark'] as const) {
      expect(contrast(token(theme, '--sf-error-text'), token(theme, '--sf-page'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token(theme, '--sf-success-text'), token(theme, '--sf-page'))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
