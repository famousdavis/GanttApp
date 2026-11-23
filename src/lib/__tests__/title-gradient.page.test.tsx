// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The header title's gradient through the REAL page (pages/index.tsx), rendered inside the providers pages/_app.tsx
// uses, while the theme is switched live with the app's own theme button (HDR26, v0.33.1; re-pinned for FRAME26,
// v0.34.0).
//
// The trap this guards: React re-applies only the style keys that change, and setting the `background` shorthand
// resets `background-clip`, so a title whose gradient were chosen by theme through an inline shorthand would turn into
// a solid bar on the first live switch. Since v0.34.0 the title has no inline style at all: the frame's `.sf-grad`
// paints `var(--app-grad-light)` and, on `:root[data-theme="dark"]`, `var(--app-grad-dark)`. So this renders the page
// with the real stylesheets injected (the vendored styles/spert-frame.css and styles/globals.css) and asserts, after
// every click, on the SAME element: no inline style; computed `background-clip: text`; computed `background-image` is
// that theme's `var(--app-grad-…)`; and the custom property resolves to that theme's pinned ramp. jsdom 29 resolves a
// custom property on the element but leaves `var()` unresolved inside `background-image` (measured), hence the pair.
//
// matchMedia is mocked to "no match" in src/test/setup.ts, so "system" resolves to the light theme here.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react';
import Home from '../../../pages/index';
import { FullWrapper } from '../../test/FullWrapper';

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

/** The two ramps (HDR26 plan §2), light end first; also pinned in title-gradient.test.ts. */
const RAMP = {
  light: 'linear-gradient(90deg, #449fbc 0%, #00657d 100%)',
  dark: 'linear-gradient(90deg, #54adca 0%, #00738e 100%)',
} as const;
const squash = (v: string) => v.replace(/\s+/g, '').toLowerCase();

function injectStylesheets() {
  for (const file of ['styles/globals.css', 'styles/spert-frame.css']) {
    const style = document.createElement('style');
    style.setAttribute('data-test-sheet', file);
    style.textContent = readFileSync(join(process.cwd(), file), 'utf8');
    document.head.appendChild(style);
  }
}

function expectTitleIn(grad: HTMLElement, theme: 'light' | 'dark') {
  expect(document.documentElement.getAttribute('data-theme'), `${theme}: data-theme`).toBe(theme);
  expect(grad.getAttribute('style'), `${theme}: no inline style`).toBeNull();
  const cs = getComputedStyle(grad);
  expect(cs.backgroundClip, `${theme}: background-clip`).toBe('text');
  expect(cs.backgroundImage, `${theme}: background-image`).toBe(`var(--app-grad-${theme})`);
  expect(squash(cs.getPropertyValue(`--app-grad-${theme}`)), `${theme}: the ramp`).toBe(squash(RAMP[theme]));
}

describe('the header title through the real page: its gradient survives a live theme switch (HDR26)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.querySelectorAll('style[data-test-sheet]').forEach((e) => e.remove());
    injectStylesheets();
  });

  it("system → light → dark → system: after each click the title is still clipped to its text, in that theme's gradient", async () => {
    render(<Home />, { wrapper: FullWrapper });
    const title = await screen.findByText('GanttApp', { selector: '[data-sf="title"] .sf-grad' });
    expect(title.closest('[data-sf="title"]')).toHaveTextContent('GanttApp™');
    expect(title.closest('a')).toHaveAttribute('href', '/');
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
      // The same element, updated in place: the case in which a changed inline shorthand would reset background-clip.
      expect(screen.getByText('GanttApp', { selector: '[data-sf="title"] .sf-grad' }), `${mode}: the title was replaced`).toBe(title);
      expectTitleIn(title, theme);
    }
  });
});
