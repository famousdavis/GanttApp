// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// FRAME26 pass 3 (v0.36.0) through the REAL page (pages/index.tsx), inside the providers pages/_app.tsx uses:
//   About's place (contract §3 About page: .sf-about is main's next child after the heading row, nothing between),
//   its h1 with the brand's ™, What's new opening the Changelog, the © year in the footer and on About from one
//   source (Y1), and G3: the Gantt Chart's header row as wide as the chart card.
// The harness is frame-pages.test.tsx's.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react';
import Home from '../../../pages/index';
import { FullWrapper } from '../../test/FullWrapper';

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

const seed = () => localStorage.setItem('ganttAppData', JSON.stringify({
  projects: [{ id: 'proj-alpha', name: 'Alpha Platform' }],
  releases: [{ id: 'rel-1', projectId: 'proj-alpha', name: 'Release One', startDate: '2026-01-05', earlyFinishDate: '2026-02-02', lateFinishDate: '2026-03-02' }],
}));

const main = () => document.querySelector<HTMLElement>('main')!;
const h1s = () => Array.from(document.querySelectorAll('h1'));

async function loaded() {
  render(<Home />, { wrapper: FullWrapper });
  await waitFor(() => expect(screen.getByRole('button', { name: 'New Project' })).toBeEnabled());
}

async function openTab(name: string) {
  fireEvent.click(screen.getByRole('button', { name }));
  await waitFor(() => expect(h1s()).toHaveLength(1));
}

describe('FRAME26 pass 3 through the real page', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('About: the h1 is "About GanttApp™" with the ™ as the frame\'s mark, and .sf-about is main\'s next child after the heading row', async () => {
    await loaded();
    await openTab('About');
    const h1 = h1s()[0]!;
    expect(h1.textContent).toBe('About GanttApp™');
    expect(h1).toHaveAttribute('title', 'About GanttApp™');
    const mark = h1.querySelector('.sf-mark.sf-mark--tm')!;
    expect(mark.textContent).toBe('™');
    const row = h1.closest('[data-sf="headrow"]')!;
    const about = document.querySelector('[data-sf="about"]')!;
    expect(row.parentElement).toBe(main());
    expect(about.parentElement, 'the About page is main\'s own child, with no wrapper').toBe(main());
    expect(row.nextElementSibling, 'nothing between the heading row and the About page').toBe(about);
    expect(main().querySelector('.sf-below')).toBeNull();
  });

  it('What\'s new on About opens the Changelog, as the footer\'s Version does: h1 "Changelog", no item current', async () => {
    await loaded();
    await openTab('About');
    fireEvent.click(screen.getByRole('link', { name: /^What.s new$/ }));
    await waitFor(() => expect(h1s().map(h => h.textContent)).toEqual(['Changelog']));
    expect(document.querySelectorAll('nav [aria-current]')).toHaveLength(0);
  });

  it('Y1: with the clock at 2027 the footer and About both read © 2027', async () => {
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2027, 0, 1, 9, 0, 0));
    await loaded();
    await openTab('About');
    expect(document.querySelector('[data-sf="footer"]')!.textContent).toMatch(/© 2027 William W\. Davis/);
    expect(document.querySelectorAll('[data-sf="about-legal"] p')[2]!.textContent).toMatch(/^© 2027 William W\. Davis/);
  });

  it('G3: the Gantt Chart\'s header row and its card share one block as wide as the card; the legend stays outside it', async () => {
    seed();
    await loaded();
    await openTab('Gantt Chart');
    const select = await screen.findByRole('combobox', { name: 'Project shown on the Gantt Chart tab' });
    const row = select.parentElement!;
    const block = row.parentElement!;
    expect(block.style.width).toBe('fit-content');
    expect(block.style.maxWidth).toBe('100%');
    const card = block.querySelector('svg')!.parentElement!;
    expect(Array.from(block.children)).toEqual([row, card]);
    expect(row.textContent).toMatch(/Date Prepared:/);
    // The chart's ref block (what Copy Chart as Image copies) still holds the header, the card and the legend after it.
    expect(block.parentElement!.children.length).toBeGreaterThan(1);
    expect(block.parentElement!.firstElementChild).toBe(block);
  });
});
