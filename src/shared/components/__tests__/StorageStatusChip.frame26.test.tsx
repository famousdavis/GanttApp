// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The header account chip, FRAME26 stage 0 (v0.33.2), carried through the frame's chip (v0.34.0):
//   GA-2   "Local only" reaches 4.5:1 in both themes, at rest and on the hover ground. Before stage 0: #9CA3AF,
//          2.54:1 on #ffffff.
//   GA-2b  "Sign in" reaches 4.5:1 in both themes, at rest and on hover. Before stage 0: #0070f3, 3.75:1 on #1a1a2e.
//   GA-4   all three variants show a keyboard focus ring: the frame's ring, with no inline outline to beat it.
//   GA-5   the lock reaches 3:1 (WCAG 1.4.11) in both themes: in the signed-in-local variant it is the only sign of
//          the storage mode.
// Stage 0 did this with its own CHIP_MUTED / CHIP_LINK colours and a .storage-status-chip ring in globals.css. Since
// v0.34.0 every one of those is the frame's: `.sf-chip-state` is `--sf-text-muted`, `.sf-chip-act` is `--sf-link`,
// the hover ground is `--sf-hover`, the ring is `--sf-focus`, and both icons draw in `currentColor`.
//
// ⚠️ jsdom has no layout and no paint, so this file cannot MEASURE contrast or see a focus ring. It injects the real
// stylesheets, checks that each segment's colour IS the token and what the token resolves to in each theme, and
// computes the WCAG ratio of each token against the frame's ground and hover ground (and under more contrast). Chrome
// measures the live chip: frame-check's `contrast.chip[…]`, `chip.hover-ground` and `contrast.chip-hover[…]`.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { StorageStatusChip } from '../StorageStatusChip';
import { LIGHT_THEME, DARK_THEME } from '../../utils/theme';
import { contrast, frameCss, frameRule, injectStylesheets, token } from '../../../test/frameTokens';
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
const THEMES: Theme[] = ['light', 'dark'];
const VARIANTS: Variant[] = ['signed-out', 'signed-in-local', 'cloud'];

const user = { displayName: 'Test User', email: 'test@example.com' } as unknown as User;

function renderChip(variant: Variant, theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  mockUseStorage.mockReturnValue({ mode: variant === 'cloud' ? 'cloud' : 'local' });
  mockUseAuth.mockReturnValue({ user: variant === 'signed-out' ? null : user });
  mockUseTheme.mockReturnValue({ colors: theme === 'dark' ? DARK_THEME : LIGHT_THEME, resolvedTheme: theme });
  const r = render(<StorageStatusChip onOpenModal={vi.fn()} />);
  const chip = r.container.querySelector<HTMLElement>('button')!;
  return { ...r, chip, state: chip.querySelector<HTMLElement>('.sf-chip-state')!, act: chip.querySelector<HTMLElement>('.sf-chip-act')! };
}

/** Every colour an icon paints with: fill and stroke on the svg and its children, lower-cased. */
function iconPaints(el: HTMLElement): string[] {
  return Array.from(el.querySelectorAll('svg, svg *')).flatMap((e) =>
    ['fill', 'stroke'].map((a) => e.getAttribute(a)).filter((v): v is string => v !== null).map((v) => v.toLowerCase()));
}

const resolved = (el: HTMLElement, name: string) => getComputedStyle(el).getPropertyValue(name).trim().toLowerCase();

describe('StorageStatusChip through the frame: its colours, hover and focus ring are the frame\'s', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    injectStylesheets();
  });

  it('the tokens clear their bars at rest and on the hover ground, in both themes and under more contrast; the old values did not', () => {
    expect(contrast('#9ca3af', '#ffffff')).toBeLessThan(4.5); // stage 0's GA-2 defect, 2.54
    expect(contrast('#0070f3', '#1a1a2e')).toBeLessThan(4.5); // stage 0's GA-2b defect, 3.75
    for (const theme of THEMES) {
      for (const more of [false, true]) {
        const at = `${theme}${more ? ' +more' : ''}`;
        for (const ground of ['--sf-page', '--sf-hover']) {
          const g = token(theme, ground, more);
          // "Local only" and the lock: muted. "Sign in" and the cloud: the link colour.
          expect(contrast(token(theme, '--sf-text-muted', more), g), `${at} muted on ${ground}`).toBeGreaterThanOrEqual(4.5);
          expect(contrast(token(theme, '--sf-link', more), g), `${at} link on ${ground}`).toBeGreaterThanOrEqual(4.5);
          expect(contrast(token(theme, '--sf-focus', more), g), `${at} focus ring on ${ground}`).toBeGreaterThanOrEqual(3);
        }
      }
    }
    // The contract's muted-on-hover 4.63 / 5.64 are rounded; truncated, as here, they read 4.62 / 5.63.
    expect(contrast(token('light', '--sf-text-muted'), token('light', '--sf-hover'))).toBe(4.62);
    expect(contrast(token('dark', '--sf-text-muted'), token('dark', '--sf-hover'))).toBe(5.63);
  });

  for (const theme of THEMES) {
    for (const variant of VARIANTS) {
      it(`${theme}, ${variant}: the frame's chip and segments, with no colour, border or outline of its own`, () => {
        const { chip, state, act } = renderChip(variant, theme);
        expect(chip.className).toBe('sf-chip');
        expect(chip.getAttribute('data-sf')).toBe('chip');
        expect(chip.getAttribute('style')).toBeNull();
        expect(chip).toHaveAttribute('aria-label', variant === 'signed-out' ? 'Sign in' : 'Account menu');
        expect(state).not.toBeNull();
        expect(act).not.toBeNull();
        // The segments take the tokens: computed colour IS the token, and the token resolves to this theme's value.
        expect(getComputedStyle(state).color).toBe('var(--sf-text-muted)');
        expect(resolved(state, '--sf-text-muted')).toBe(token(theme, '--sf-text-muted'));
        const actColour = variant === 'signed-in-local' ? 'var(--sf-text-muted)' : 'var(--sf-link)';
        expect(getComputedStyle(act).color).toBe(actColour);
        expect(resolved(act, '--sf-link')).toBe(token(theme, '--sf-link'));
        // Every icon paints in currentColor (its segment's token), never a fixed colour.
        expect(iconPaints(chip).filter((v) => v !== 'currentcolor' && v !== 'none'), 'fixed icon colours').toEqual([]);
        // The only inline colours: the avatar's own, and the signed-in name's theme text colour.
        const inline = Array.from(chip.querySelectorAll<HTMLElement>('[style]')).map((e) => e.style.color || e.style.backgroundColor).filter(Boolean);
        if (variant === 'signed-out') expect(inline).toEqual([]);
        else expect(inline.length).toBeGreaterThan(0);
      });
    }
  }

  it('signed out: "Local only" with the lock in the state segment, "Sign in" in the act segment, as before', () => {
    const { state, act } = renderChip('signed-out', 'light');
    expect(state).toHaveTextContent('Local only');
    expect(state.querySelector('svg')).not.toBeNull();
    expect(act).toHaveTextContent('Sign in');
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute('title', 'Using local storage');
  });

  it('signed in: the cloud (cloud mode) or the lock (local mode) in the act segment; the avatar keeps its own colours', () => {
    const cloud = renderChip('cloud', 'dark');
    expect(cloud.act.querySelector('svg path')).toHaveAttribute('fill', 'currentColor');
    expect(cloud.state).toHaveTextContent('Test');
    cloud.unmount();
    const local = renderChip('signed-in-local', 'dark');
    expect(local.act.querySelectorAll('svg [stroke="currentColor"]')).toHaveLength(2);
    const avatar = local.state.querySelector<HTMLElement>('span[aria-hidden="true"]')!;
    expect(avatar.style.backgroundColor).toBe('rgb(0, 112, 243)');
    expect(contrast('#ffffff', '#0070f3')).toBeGreaterThanOrEqual(4.5);
  });

  it('the hover ground and the keyboard focus ring are the frame\'s, and globals.css no longer draws its own', () => {
    expect(frameRule('.sf-chip:hover').get('background')).toBe('var(--sf-hover)');
    const ring = frameRule(':where(.sf-bar, .sf-nav, .sf-notices, .sf-headrow, .sf-footer) :focus-visible, .sf-skip:focus-visible');
    expect(ring.get('outline')).toBe('2px solid var(--sf-focus)');
    expect(ring.get('outline-offset')).toBe('2px');
    expect(frameCss()).toMatch(/\.sf-bar\b/);
    const globals = readFileSync(resolve(process.cwd(), 'styles', 'globals.css'), 'utf8');
    expect(globals).not.toMatch(/storage-status-chip/);
  });
});
