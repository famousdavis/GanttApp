// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The frame's theme button (FRAME26, contract §3 "Utilities", v0.34.0): `.sf-theme`, its icon drawn in currentColor
// (the frame's muted colour, 4.84:1 / 6.82:1, held to the 3:1 non-text bar because the icon carries state), never a
// fixed colour, an opacity or an emoji; named by its mode, "Theme: <mode>" (FRAME26 stage 0).

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeButton } from '../ThemeButton';
import { contrast, frameRule, token } from '../../../test/frameTokens';

const setMode = vi.fn();
let mode: 'light' | 'dark' | 'system' = 'system';
vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ mode, setMode }),
}));

describe('the theme button', () => {
  for (const m of ['system', 'light', 'dark'] as const) {
    it(`${m}: .sf-theme, named "Theme: ${m}", one currentColor icon with no fixed colour, opacity or emoji`, () => {
      mode = m;
      const { container } = render(<ThemeButton />);
      const button = screen.getByRole('button', { name: `Theme: ${m}` });
      expect(button.className).toBe('sf-theme');
      expect(button.getAttribute('data-sf')).toBe('theme');
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAttribute('title', `Theme: ${m} (click to change)`);
      expect(button.getAttribute('style')).toBeNull();
      const svgs = button.querySelectorAll('svg');
      expect(svgs).toHaveLength(1);
      expect(svgs[0]).toHaveAttribute('aria-hidden', 'true');
      const paints = Array.from(button.querySelectorAll('svg, svg *')).flatMap((e) =>
        ['fill', 'stroke'].map((a) => e.getAttribute(a)).filter((v): v is string => v !== null));
      expect(paints.length).toBeGreaterThan(0);
      expect(paints.filter((p) => p !== 'currentColor' && p !== 'none')).toEqual([]);
      expect(container.querySelector('[opacity], [style*="opacity"], [class*="opacity"]')).toBeNull();
      expect(button.textContent).not.toMatch(/☀|🌙|🖥/);
    });
  }

  it('cycles System → Light → Dark → System', () => {
    for (const [from, to] of [['system', 'light'], ['light', 'dark'], ['dark', 'system']] as const) {
      mode = from;
      const { unmount } = render(<ThemeButton />);
      fireEvent.click(screen.getByRole('button', { name: `Theme: ${from}` }));
      expect(setMode).toHaveBeenLastCalledWith(to);
      unmount();
    }
  });

  it('the frame draws the icon muted, the text colour on hover, and both clear 3:1 on both grounds', () => {
    expect(frameRule('.sf-theme').get('color')).toBe('var(--sf-text-muted)');
    expect(frameRule('.sf-theme:hover').get('color')).toBe('var(--sf-text)');
    for (const theme of ['light', 'dark'] as const) {
      for (const more of [false, true]) {
        const ground = token(theme, '--sf-page', more);
        expect(contrast(token(theme, '--sf-text-muted', more), ground), `${theme}${more ? ' +more' : ''}`).toBeGreaterThanOrEqual(3);
        expect(contrast(token(theme, '--sf-text', more), ground), `${theme}${more ? ' +more' : ''} hover`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
