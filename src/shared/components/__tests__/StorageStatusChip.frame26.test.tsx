// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The header account chip, FRAME26 stage 0 (v0.33.2):
//   GA-2   "Local only" reaches 4.5:1 in light. Before: #9CA3AF in both themes, 2.54:1 on #ffffff.
//   GA-2b  "Sign in" reaches 4.5:1 in dark. Before: #0070f3 in both themes, 3.75:1 on #1a1a2e.
//   GA-4   all three variants show a keyboard focus ring. Before: an inline `outline: 'none'` beat every
//          stylesheet rule, and no ring showed on the chip or any ancestor.
//   GA-5   the lock reaches 3:1 (WCAG 1.4.11) in both themes: in the signed-in-local variant it is the only sign
//          of the storage mode. Before: #9CA3AF, 2.54:1 on #ffffff.
//
// ⚠️ jsdom has no layout and no paint, so this file cannot MEASURE contrast or see a focus ring. It pins each
// theme's colour and computes its WCAG ratio against theme.ts's background (the chip is transparent, so its
// ground is the page), and it pins the two halves a ring needs: the stylesheet rule, and no inline outline to
// beat it. The live numbers were measured in Chrome and are in the v0.33.2 PR.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { StorageStatusChip } from '../StorageStatusChip';
import { LIGHT_THEME, DARK_THEME } from '../../utils/theme';
import type { User } from 'firebase/auth';

const mockUseStorage = vi.fn();
const mockUseAuth = vi.fn();
const mockUseTheme = vi.fn();

vi.mock('../../../context/StorageContext', () => ({
  useStorage: () => mockUseStorage(),
}));
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));
vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

type Theme = 'light' | 'dark';
type Variant = 'signed-out' | 'signed-in-local' | 'cloud';

/** The approved colours (FRAME26 stage 0). "Sign in" in light and the muted dark value are unchanged. */
const MUTED = { light: '#6a7282', dark: '#9ca3af' } as const;
const LINK = { light: '#0070f3', dark: '#51a2ff' } as const;
const GROUND = { light: LIGHT_THEME.background, dark: DARK_THEME.background } as const;

const channels = (h: string) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
const rgbOf = (h: string) => `rgb(${channels(h).join(', ')})`;
const luminance = (h: string) => {
  const [r, g, b] = channels(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const user = { displayName: 'Test User', email: 'test@example.com' } as unknown as User;

function renderChip(variant: Variant, theme: Theme) {
  mockUseStorage.mockReturnValue({ mode: variant === 'cloud' ? 'cloud' : 'local' });
  mockUseAuth.mockReturnValue({ user: variant === 'signed-out' ? null : user });
  mockUseTheme.mockReturnValue({ colors: theme === 'dark' ? DARK_THEME : LIGHT_THEME, resolvedTheme: theme });
  return render(<StorageStatusChip onOpenModal={vi.fn()} />);
}

/** The lock's two strokes (rect and path), lower-cased so the test compares colours, not spellings; the cloud icon has none. */
function lockStrokes(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('svg [stroke]')).map((e) => (e.getAttribute('stroke') ?? '').toLowerCase());
}

describe('StorageStatusChip, FRAME26 stage 0: themed colours and the keyboard focus ring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('the pinned colours clear their bars, and the old values did not', () => {
    expect(contrast('#9ca3af', GROUND.light)).toBeLessThan(3); // GA-2 and GA-5 before: 2.54
    expect(contrast('#0070f3', GROUND.dark)).toBeLessThan(4.5); // GA-2b before: 3.75
    expect(contrast(MUTED.light, GROUND.light)).toBeCloseTo(4.84, 2);
    expect(contrast(MUTED.dark, GROUND.dark)).toBeCloseTo(6.72, 2);
    expect(contrast(LINK.light, GROUND.light)).toBeCloseTo(4.55, 2);
    expect(contrast(LINK.dark, GROUND.dark)).toBeCloseTo(6.47, 2);
  });

  describe.each(['light', 'dark'] as const)('%s theme', (theme) => {
    it('signed out: "Local only" and "Sign in" take the theme colour, at 4.5:1 or more (GA-2, GA-2b)', () => {
      renderChip('signed-out', theme);
      const localOnly = screen.getByText('Local only');
      const signIn = screen.getByText('Sign in');
      expect(localOnly.style.color).toBe(rgbOf(MUTED[theme]));
      expect(signIn.style.color).toBe(rgbOf(LINK[theme]));
      expect(contrast(MUTED[theme], GROUND[theme])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(LINK[theme], GROUND[theme])).toBeGreaterThanOrEqual(4.5);
    });

    it.each(['signed-out', 'signed-in-local'] as const)('%s: the lock strokes take the muted colour, at 3:1 or more (GA-5)', (variant) => {
      const { container } = renderChip(variant, theme);
      // A control that must find something: the lock's rect and path.
      expect(lockStrokes(container)).toEqual([MUTED[theme], MUTED[theme]]);
      expect(contrast(MUTED[theme], GROUND[theme])).toBeGreaterThanOrEqual(3);
    });

    it('cloud: no lock, and the cloud icon is untouched', () => {
      const { container } = renderChip('cloud', theme);
      expect(lockStrokes(container)).toEqual([]);
      expect(container.querySelector('svg path')?.getAttribute('fill')).toBe('#0070f3');
    });
  });

  describe('the keyboard focus ring (GA-4)', () => {
    it.each(['signed-out', 'signed-in-local', 'cloud'] as const)('%s: carries the ring class and sets no inline outline', (variant) => {
      renderChip(variant, 'light');
      const chip = screen.getByRole('button');
      expect(chip).toHaveClass('storage-status-chip');
      // ⚠️ The load-bearing half: an inline outline beats every stylesheet rule, which was the v0.33.1 defect.
      expect(chip.style.outline).toBe('');
      expect(chip.style.outlineStyle).toBe('');
    });

    it('styles/globals.css draws a 2px ring, offset 2, in the contract focus colours, on :focus-visible only', () => {
      const css = readFileSync(resolve(__dirname, '../../../../styles/globals.css'), 'utf8').replace(/\s+/g, ' ');
      expect(css).toContain('.storage-status-chip:focus { outline: none; }');
      expect(css).toContain('.storage-status-chip:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }');
      expect(css).toContain('[data-theme="dark"] .storage-status-chip:focus-visible { outline-color: #60a5fa; }');
      expect(contrast('#2563eb', GROUND.light)).toBeGreaterThanOrEqual(3);
      expect(contrast('#60a5fa', GROUND.dark)).toBeGreaterThanOrEqual(3);
    });
  });
});
