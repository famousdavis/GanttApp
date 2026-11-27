// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The SPERT® Suite frame through the REAL page (pages/index.tsx), inside the providers pages/_app.tsx uses (FRAME26,
// v0.34.0): every screen has exactly one h1, in main's heading row, and the brand is not a heading; the current
// navigation item; the capped column on Settings, About and the Changelog (X4); the skip link first; the notices
// slot's order, with the live region outside it; the heading row outside the error boundary; and the loading state,
// in which the frame and the heading row render and only the body says "Loading..." (contract §7).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// The real Releases tab, except that it cannot render one project's data.
vi.mock('../../features/releases/ReleasesTab', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../features/releases/ReleasesTab')>();
  function ReleasesTabFailingForOneProject(props: Parameters<typeof actual.ReleasesTab>[0]) {
    if (props.selectedProjectId === 'proj-unreadable') throw new Error('a value the view cannot render');
    return <actual.ReleasesTab {...props} />;
  }
  return { ...actual, ReleasesTab: ReleasesTabFailingForOneProject };
});

// The real app data, except that a test can hold it "loading" (contract §7's loading state).
let holdLoading = false;
vi.mock('../../context/AppDataContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../context/AppDataContext')>();
  return {
    ...actual,
    useAppData: () => {
      const value = actual.useAppData();
      return holdLoading ? { ...value, loading: true } : value;
    },
  };
});

const release = (id: string, projectId: string, name: string) => ({
  id, projectId, name, startDate: '2026-01-05', earlyFinishDate: '2026-02-02', lateFinishDate: '2026-03-02',
});
const seed = (projects: { id: string; name: string }[]) =>
  localStorage.setItem('ganttAppData', JSON.stringify({ projects, releases: projects.map((p) => release(`rel-${p.id}`, p.id, 'Release One')) }));

const main = () => document.querySelector<HTMLElement>('main')!;
const nav = (name: string) => screen.getByRole('button', { name, hidden: false });
const h1s = () => Array.from(document.querySelectorAll('h1'));

async function loaded() {
  render(<Home />, { wrapper: FullWrapper });
  await waitFor(() => expect(screen.getByRole('button', { name: 'New Project' })).toBeEnabled());
}

async function open(tab: string) {
  if (tab === 'Changelog') fireEvent.click(screen.getByRole('button', { name: /^Version / }));
  else if (tab !== 'Projects') fireEvent.click(nav(tab));
  await waitFor(() => expect(h1s()).toHaveLength(1));
}

/** Every screen's frame facts: one h1, where it belongs, the current item and the column. */
function expectScreen(tab: string, heading: string) {
  const headings = h1s();
  expect(headings.map((h) => h.textContent), `${tab}: exactly one h1`).toEqual([heading]);
  const h1 = headings[0]!;
  expect(h1).toHaveClass('sf-heading');
  // The full text in `title` where a name can be long enough to be cut short (contract §7 "Long names").
  if (tab !== 'Projects') expect(h1).toHaveAttribute('title', heading);
  const row = h1.closest('[data-sf="headrow"]')!;
  expect(row, `${tab}: the h1 is in a heading row`).not.toBeNull();
  expect(main().contains(row), `${tab}: the heading row is in main`).toBe(true);
  if (tab !== 'Projects') expect(row.parentElement, `${tab}: the row is main's own child`).toBe(main());
  // The brand is a link, never a heading, and the header holds no heading at all.
  expect(document.querySelector('header')!.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"]')).toBeNull();
  const current = Array.from(document.querySelectorAll('nav [aria-current]')).map((e) => `${e.textContent}=${e.getAttribute('aria-current')}`);
  expect(current, `${tab}: the current item`).toEqual(tab === 'Changelog' ? [] : [`${tab}=page`]);
  expect(main().classList.contains('sf-main--capped'), `${tab}: capped`).toBe(['Settings', 'About', 'Changelog'].includes(tab));
}

describe('the frame through the real page', () => {
  beforeEach(() => {
    localStorage.clear();
    holdLoading = false;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    holdLoading = false;
  });

  it('every screen: one h1 in main\'s heading row, the brand not a heading, the current item, X4 on the prose screens', async () => {
    seed([{ id: 'proj-alpha', name: 'Alpha Platform' }]);
    await loaded();
    for (const [tab, heading] of [
      ['Projects', 'Projects'], ['Releases', 'Alpha Platform'], ['Gantt Chart', 'Alpha Platform'],
      ['Settings', 'Settings'], ['About', 'About GanttApp™'], ['Changelog', 'Changelog'],
    ] as const) {
      await open(tab);
      expectScreen(tab, heading);
    }
  });

  it('with no project to name, Releases and the Gantt Chart take the tab\'s name', async () => {
    await loaded();
    await open('Releases');
    expectScreen('Releases', 'Releases');
    await open('Gantt Chart');
    expectScreen('Gantt Chart', 'Gantt Chart');
  });

  it('the brand link shows Projects', async () => {
    seed([{ id: 'proj-alpha', name: 'Alpha Platform' }]);
    await loaded();
    await open('Settings');
    fireEvent.click(screen.getByRole('link', { name: 'GanttApp™' }));
    await waitFor(() => expectScreen('Projects', 'Projects'));
  });

  it('the skip link is the first thing Tab reaches, and leads to main', async () => {
    await loaded();
    const focusable = document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    expect(focusable[0]).toHaveTextContent('Skip to main content');
    expect(focusable[0]).toHaveAttribute('href', '#main');
    expect(focusable[0]).toHaveClass('sf-skip');
    expect(focusable[1]).toHaveAccessibleName('GanttApp™');
    expect(main()).toHaveAttribute('id', 'main');
  });

  it('the notices slot holds only the notices, in order; the live region sits outside it; empty, it has no children', async () => {
    await loaded();
    const slot = document.querySelector<HTMLElement>('[data-sf="notices"]')!;
    await waitFor(() => expect(slot.children).toHaveLength(2));
    expect(Array.from(slot.children).map((c) => c.className)).toEqual(['sf-notice sf-notice--info', 'sf-notice sf-notice--caution']);
    expect(slot.children[0]).toHaveTextContent(/SPERT® Suite web apps are free to use/);
    expect(slot.children[1]).toHaveTextContent('Your data exists only in this browser');
    const live = document.querySelector('p[aria-live="polite"]')!;
    expect(slot.contains(live)).toBe(false);
    expect(slot.nextElementSibling).toBe(live);
    for (const b of screen.getAllByRole('button', { name: 'Got it' })) fireEvent.click(b);
    await waitFor(() => expect(slot.children).toHaveLength(0));
  });

  it('a view that throws leaves the frame and its h1: the error notice sits below the heading row', async () => {
    seed([{ id: 'proj-unreadable', name: 'Unreadable Plan' }]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await loaded();
    await open('Releases');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This view could not be displayed.');
    expectScreen('Releases', 'Unreadable Plan');
    const row = document.querySelector('[data-sf="headrow"]')!;
    expect(row.contains(alert)).toBe(false);
    expect(alert.closest('.sf-below')).not.toBeNull();
  });

  it('while the data loads: the frame, the heading row with Projects\' toolbar all disabled, and "Loading..." as the body', async () => {
    holdLoading = true;
    render(<Home />, { wrapper: FullWrapper });
    await screen.findByText('Loading...');
    expectScreen('Projects', 'Projects');
    expect(document.querySelector('header')).not.toBeNull();
    expect(document.querySelector('footer')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Export all projects as JSON' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Load Sample' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'New Project' })).toBeDisabled();
    const imp = screen.getByLabelText('Import projects from JSON');
    expect(imp).toHaveAttribute('aria-disabled', 'true');
    expect(imp.querySelector('input[type="file"]')).toBeDisabled();
    // Another tab while loading: its own heading row, no toolbar, the same body.
    fireEvent.click(nav('Settings'));
    await waitFor(() => expectScreen('Settings', 'Settings'));
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New Project' })).toBeNull();
  });
});
