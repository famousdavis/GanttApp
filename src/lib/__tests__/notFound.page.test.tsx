// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The 404 page (FRAME26 clean-up, v0.35.0): inside the frame, one h1 "Page not found", no navigation item current, the
// line and a link back to Projects. Its navigation leaves for the app's page, which opens the item's tab (tabLink.ts).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import NotFoundPage from '../../../pages/404';
import { FullWrapper } from '../../test/FullWrapper';

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

describe('the 404 page', () => {
  let assign: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    localStorage.clear();
    assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function renderPage() {
    render(<NotFoundPage />, { wrapper: FullWrapper });
    await waitFor(() => expect(document.querySelector('[data-sf="app"]')).not.toBeNull());
  }

  it('is in the frame: skip link, brand, navigation, notices, main and footer', async () => {
    await renderPage();
    for (const hook of ['app', 'skip', 'brand', 'nav', 'notices', 'main', 'headrow', 'footer']) {
      expect(document.querySelector(`[data-sf="${hook}"]`), hook).not.toBeNull();
    }
  });

  it('has one h1, "Page not found", the line and a link back to Projects', async () => {
    await renderPage();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s.map(h => h.textContent)).toEqual(['Page not found']);
    expect(screen.getByText("There's no page at this address.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Projects' })).toHaveAttribute('href', '/');
  });

  it('marks no navigation item current', async () => {
    await renderPage();
    expect(document.querySelectorAll('[data-sf="nav"] [aria-current]')).toHaveLength(0);
  });

  it('its navigation and the footer\'s Version open the app\'s page on that tab', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Releases' }));
    expect(assign).toHaveBeenLastCalledWith('/?tab=releases');
    fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
    expect(assign).toHaveBeenLastCalledWith('/');
    fireEvent.click(screen.getByRole('button', { name: /^Version / }));
    expect(assign).toHaveBeenLastCalledWith('/?tab=changelog');
  });
});
