// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The header title's gradient through the REAL page (pages/index.tsx), rendered inside the providers pages/_app.tsx
// uses, while the theme is switched live with the app's own theme button (HDR26, v0.33.1).
//
// Why a render test as well as the source scan in title-gradient.test.ts: React re-applies only the style keys that
// change. Setting the `background` shorthand resets `background-clip`, so a title whose gradient were chosen by
// theme through the shorthand would keep `backgroundClip: 'text'` in React's eyes while the browser drew a solid
// bar, from the first live switch on. jsdom 29's CSS object resets background-clip on the shorthand the same way, so
// this test catches that by behaviour, independently of how the source is written. It asserts that the <h1> is the
// same element throughout: the trap only bites on an update, and a remount would set every key afresh and hide it.
//
// matchMedia is mocked to "no match" in src/test/setup.ts, so "system" resolves to the light theme here.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react';
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

/** The approved ends (HDR26 plan §2), light end first; also pinned in title-gradient.test.ts. */
const ENDS = { light: ['#449fbc', '#00657d'], dark: ['#54adca', '#00738e'] } as const;
const TEXT = { light: LIGHT_THEME.text, dark: DARK_THEME.text } as const;

/** A gradient as jsdom's CSS object serializes it: hex stops become rgb(). */
const rgbOf = (h: string) => `rgb(${[1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16)).join(', ')})`;
const serialized = (theme: 'light' | 'dark') =>
  `linear-gradient(90deg, ${rgbOf(ENDS[theme][0])} 0%, ${rgbOf(ENDS[theme][1])} 100%)`;

function expectTitleIn(title: HTMLElement, theme: 'light' | 'dark') {
  expect(title.style.backgroundImage, `${theme}: background-image`).toBe(serialized(theme));
  expect(title.style.backgroundClip, `${theme}: background-clip`).toBe('text');
  expect(title.style.getPropertyValue('--hdr26-title-contrast'), `${theme}: contrast colour`).toBe(TEXT[theme]);
}

describe('the header title through the real page: its gradient survives a live theme switch (HDR26)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("system → light → dark → system: after each click the title is still clipped to its text, in that theme's gradient", async () => {
    render(<Home />, { wrapper: FullWrapper });
    const title = await screen.findByRole('heading', { level: 1 });
    expect(title).toHaveTextContent('GanttAppTM');
    expect(title).toHaveClass('hdr26-title');
    expect(screen.getByTitle('Theme: system (click to change)')).toBeInTheDocument();
    expectTitleIn(title, 'light');

    const steps = [
      ['light', 'light'],
      ['dark', 'dark'],
      ['system', 'light'],
    ] as const;
    for (const [mode, theme] of steps) {
      fireEvent.click(screen.getByTitle(/^Theme: /));
      await waitFor(() => expect(screen.getByTitle(`Theme: ${mode} (click to change)`)).toBeInTheDocument());
      // The same element, updated in place: the case in which a changed shorthand would reset background-clip.
      expect(screen.getByRole('heading', { level: 1 }), `${mode}: the <h1> was replaced`).toBe(title);
      expectTitleIn(title, theme);
    }
  });
});
