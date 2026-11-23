// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// FRAME26 stage 0 (v0.33.2), carried through the frame (v0.34.0), through the REAL page (pages/index.tsx) inside the
// providers pages/_app.tsx uses, with the theme switched live by the app's own theme button:
//   GA-1  the footer's links and Version button reach 4.5:1 on the page ground in each theme. Stage 0 did it with its
//         own FOOTER_LINK colours; since v0.34.0 they are the frame's `--sf-link` (#155dfc 5.25:1 on #ffffff, #51a2ff
//         6.72:1 on #101828), so no footer control carries a colour, a class or a style of its own (an inline value
//         would beat the token). Before stage 0: #0070f3 in both themes, 3.75:1 on the old dark ground.
//   GA-3  the theme button's accessible name is "Theme: <mode>", not its glyph. Before stage 0: the name was "☀️".
//
// ⚠️ jsdom has no layout and no paint, so this file cannot MEASURE contrast. It injects the real stylesheets, checks
// that each footer control's colour IS the `--sf-link` token and what that token resolves to in each theme, and
// computes the WCAG ratio of that token against the frame's `--sf-page` for the same theme. Chrome measures the live
// page: frame-check's `footer.link-colour` and `contrast.footer[…]`.
//
// matchMedia is mocked to "no match" in src/test/setup.ts, so "system" resolves to the light theme here.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, configure, within } from '@testing-library/react';
import Home from '../../../pages/index';
import { FullWrapper } from '../../test/FullWrapper';
import { contrast, frameRule, injectStylesheets, token } from '../../test/frameTokens';

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

/** The frame's link colour in each theme (spert-frame.css `--sf-link`), pinned so a token change comes through here. */
const LINK = { light: '#155dfc', dark: '#51a2ff' } as const;
const GROUND = { light: '#ffffff', dark: '#101828' } as const;

/** The footer's interactive elements: the Version button and the four links (SPERT® Suite, ToS, Privacy, License). */
function footerControls(): HTMLElement[] {
  const footer = document.querySelector('footer');
  if (!footer) throw new Error('no <footer> rendered');
  return Array.from(footer.querySelectorAll<HTMLElement>('a, button'));
}

function expectFooterIn(theme: 'light' | 'dark') {
  const footer = document.querySelector('footer')!;
  expect(footer).toHaveClass('sf-footer');
  expect(Array.from(footer.querySelectorAll(':scope > .sf-col > *'))).toHaveLength(2);
  const controls = footerControls();
  // A control that must find something: the five footer controls, unchanged since v0.33.1.
  expect(controls.map((c) => c.textContent?.trim().replace(/[\d.]+$/, ''))).toEqual([
    'Version ', 'SPERT® Suite', 'Terms of Service', 'Privacy Policy', 'License',
  ]);
  for (const c of controls) {
    const name = `${theme}: ${c.textContent}`;
    expect(c.getAttribute('style'), name).toBeNull();
    expect(c.tagName === 'BUTTON' ? c.className : c.getAttribute('class'), name).toBe(c.tagName === 'BUTTON' ? 'sf-link' : null);
    const cs = getComputedStyle(c);
    expect(cs.color, name).toBe('var(--sf-link)');
    expect(cs.getPropertyValue('--sf-link').trim().toLowerCase(), name).toBe(LINK[theme]);
  }
  expect(token(theme, '--sf-link')).toBe(LINK[theme]);
  expect(token(theme, '--sf-page')).toBe(GROUND[theme]);
  expect(contrast(LINK[theme], GROUND[theme]), `${theme}: footer link contrast`).toBeGreaterThanOrEqual(4.5);
}

function expectThemeButton(mode: 'light' | 'dark' | 'system') {
  const button = screen.getByRole('button', { name: `Theme: ${mode}` });
  // The title keeps the hint; the icon is hidden from the accessibility tree, and it is an icon, not an emoji.
  expect(button).toHaveAttribute('title', `Theme: ${mode} (click to change)`);
  const icon = button.querySelector('svg');
  expect(icon, `${mode}: the icon`).not.toBeNull();
  expect(icon).toHaveAttribute('aria-hidden', 'true');
  expect(within(button).queryByText(/☀️|🌙|🖥️/)).toBeNull();
  return button;
}

describe('FRAME26 stage 0 through the real page: footer contrast (GA-1) and the theme button name (GA-3)', () => {
  beforeEach(() => {
    localStorage.clear();
    injectStylesheets();
  });

  it('the frame\'s link colours clear the bar on both grounds, with and without more contrast, and the old dark value did not', () => {
    expect(contrast('#0070f3', '#1a1a2e')).toBeLessThan(4.5); // the v0.33.1 defect, 3.75
    // The contract's 5.25 and 6.73 are rounded; truncated, as here, they read 5.24 and 6.72.
    expect(contrast(LINK.light, GROUND.light)).toBe(5.24);
    expect(contrast(LINK.dark, GROUND.dark)).toBe(6.72);
    for (const theme of ['light', 'dark'] as const) {
      expect(token(theme, '--sf-link', true), `${theme} +more`).toBe(LINK[theme]);
      expect(token(theme, '--sf-page', true), `${theme} +more`).toBe(GROUND[theme]);
    }
    // Footer links underline on hover, and always under more contrast (contract §5).
    expect(frameRule('.sf-footer a, .sf-footer .sf-link').get('color')).toBe('var(--sf-link)');
    expect(frameRule('.sf-footer a:hover, .sf-footer .sf-link:hover').get('text-decoration')).toBe('underline');
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
