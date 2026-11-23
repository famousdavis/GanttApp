// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// FRAME26 stage 0 (v0.33.2), through the REAL page (pages/index.tsx) inside the providers pages/_app.tsx uses, with
// the theme switched live by the app's own theme button:
//   GA-1  the footer's links and Version button take a theme colour that reaches 4.5:1 on that theme's page
//         background. Before: #0070f3 in both themes, 3.75:1 on the dark ground.
//   GA-3  the theme button's accessible name is "Theme: <mode>", not its emoji. Before: the name was "☀️".
//
// ⚠️ jsdom has no layout and no paint, so this file cannot MEASURE contrast. It pins the colour each theme
// applies and computes the WCAG ratio of that colour against theme.ts's background for the same theme, which is
// the ground Chrome measured behind the footer (v0.33.2 PR). The live numbers are in the PR.
//
// matchMedia is mocked to "no match" in src/test/setup.ts, so "system" resolves to the light theme here.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, configure, within } from '@testing-library/react';
import Home from '../../../pages/index';
import { FullWrapper } from '../../test/FullWrapper';
import { LIGHT_THEME, DARK_THEME } from '../../shared/utils/theme';

// The whole page renders: allow for a loaded machine.
configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 20000 });

vi.mock('../firebase', () => ({
  auth: null,
  db: null,
  isFirebaseAvailable: false,
  getSendInvitationEmail: () => null,
  getClaimPendingInvitations: () => null,
  getRevokeInvite: () => null,
  getResendInvite: () => null,
}));

vi.mock('firebase/auth', () => {
  class MockGoogleAuthProvider { addScope = vi.fn(); }
  class MockOAuthProvider { addScope = vi.fn(); constructor() {} }
  return {
    onAuthStateChanged: vi.fn((_auth: unknown, callback: (user: null) => void) => {
      callback(null);
      return vi.fn();
    }),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    GoogleAuthProvider: MockGoogleAuthProvider,
    OAuthProvider: MockOAuthProvider,
  };
});

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(),
}));

/** The approved footer link colours (FRAME26 stage 0 GA-1); light is unchanged from v0.33.1. */
const FOOTER_LINK = { light: '#0070f3', dark: '#51a2ff' } as const;
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

/** The footer's interactive elements: the Version button and the four links (SPERT® Suite, ToS, Privacy, License). */
function footerControls(): HTMLElement[] {
  const footer = document.querySelector('footer');
  if (!footer) throw new Error('no <footer> rendered');
  return Array.from(footer.querySelectorAll<HTMLElement>('a, button'));
}

function expectFooterIn(theme: 'light' | 'dark') {
  const controls = footerControls();
  // A control that must find something: the five footer controls of v0.33.1.
  expect(controls.map((c) => c.textContent?.trim().replace(/[\d.]+$/, ''))).toEqual([
    'Version ', 'SPERT® Suite', 'Terms of Service', 'Privacy Policy', 'License',
  ]);
  for (const c of controls) {
    expect(c.style.color, `${theme}: ${c.textContent}`).toBe(rgbOf(FOOTER_LINK[theme]));
  }
  expect(contrast(FOOTER_LINK[theme], GROUND[theme]), `${theme}: footer link contrast`).toBeGreaterThanOrEqual(4.5);
}

function expectThemeButton(mode: 'light' | 'dark' | 'system') {
  const button = screen.getByRole('button', { name: `Theme: ${mode}` });
  // The title keeps the hint; the glyph is hidden from the accessibility tree.
  expect(button).toHaveAttribute('title', `Theme: ${mode} (click to change)`);
  const glyph = button.querySelector('span');
  expect(glyph, `${mode}: the glyph sits in its own span`).not.toBeNull();
  expect(glyph).toHaveAttribute('aria-hidden', 'true');
  expect(within(button).queryByText(/☀️|🌙|🖥️/)).not.toBeNull();
  return button;
}

describe('FRAME26 stage 0 through the real page: footer contrast (GA-1) and the theme button name (GA-3)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('the pinned colours clear the bar, and the old dark value did not', () => {
    expect(contrast('#0070f3', GROUND.dark)).toBeLessThan(4.5); // the v0.33.1 defect, 3.75
    expect(contrast(FOOTER_LINK.light, GROUND.light)).toBeCloseTo(4.55, 2);
    expect(contrast(FOOTER_LINK.dark, GROUND.dark)).toBeCloseTo(6.47, 2);
  });

  it('system → light → dark → system: the footer takes each theme\'s colour and the button names the mode', async () => {
    render(<Home />, { wrapper: FullWrapper });
    await screen.findByRole('heading', { level: 1 });
    expectThemeButton('system');
    expectFooterIn('light');

    const steps = [
      ['light', 'light'],
      ['dark', 'dark'],
      ['system', 'light'],
    ] as const;
    for (const [mode, theme] of steps) {
      fireEvent.click(screen.getByTitle(/^Theme: /));
      await waitFor(() => expect(screen.getByRole('button', { name: `Theme: ${mode}` })).toBeInTheDocument());
      expectThemeButton(mode);
      expectFooterIn(theme);
    }
  });
});
