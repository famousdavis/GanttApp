// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The Welcome panel on the page (FRAME26 clean-up, v0.35.0; contract §3 "Welcome panel", §7 "Empty collection" and
// "Load Sample"): its markup, in order; its Create New Project, which is the toolbar's New Project; and its Load Sample
// Project, which is the toolbar's Load Sample, giving the same project, tab and message. Shown only with no projects.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, configure } from '@testing-library/react';
import Home from '../../../../pages/index';
import { FullWrapper } from '../../../test/FullWrapper';
import type { AppData } from '../../../shared/types/app';
import type { Project } from '../../../shared/types';

configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 20000 });

vi.mock('../../../lib/firebase', () => ({
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

const CHART_PICKER = 'Project shown on the Gantt Chart tab';

function seed(data: Partial<AppData> & { projects: Project[] }) {
  localStorage.setItem('ganttAppData', JSON.stringify({ releases: [], ...data }));
}

const stored = (): AppData => JSON.parse(localStorage.getItem('ganttAppData')!);
const storedNames = () => stored().projects.map(p => p.name);

function projects(...names: string[]): Project[] {
  return names.map((name, i) => ({ id: `p${i + 1}`, name }));
}

async function renderPage() {
  render(<Home />, { wrapper: FullWrapper });
  await waitFor(() => expect(screen.getByRole('button', { name: 'New Project' })).toBeEnabled());
}

const panel = () => document.querySelector<HTMLElement>('[data-sf="empty"]');
const MESSAGE = 'Added “Sample: Mobile App Launch” to your projects and opened it.';

describe('the Welcome panel', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('with no projects: the frame\'s .sf-empty, in main, its parts in the contract\'s order', async () => {
    await renderPage();
    const p = panel()!;
    expect(p).not.toBeNull();
    expect(p.className).toBe('sf-empty');
    expect(p.closest('[data-sf="main"]')).not.toBeNull();
    expect(Array.from(p.children).map(c => `${c.tagName.toLowerCase()}.${c.className}`)).toEqual([
      'h2.sf-empty-title', 'p.sf-empty-text', 'p.sf-empty-text', 'div.sf-empty-actions', 'p.sf-empty-note',
    ]);
    const title = p.querySelector('h2')!;
    expect(title.textContent).toBe('Welcome to GanttApp™');
    // The ™ in the brand row's own markup.
    const mark = title.querySelector('span')!;
    expect(mark.className).toBe('sf-mark sf-mark--tm');
    expect(mark.textContent).toBe('™');
    expect(document.querySelector('[data-sf="title"] .sf-mark--tm')!.textContent).toBe('™');
    expect(Array.from(p.querySelectorAll('.sf-empty-text')).map(e => e.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
      'Show stakeholders when each release could ship: a solid bar for design, code and test, then a hatched bar for the window in which it may be delivered.',
      'Create a project, add its releases, and see them on the Gantt Chart tab.',
    ]);
    expect(p.querySelector('.sf-empty-note')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      'The sample project is a working example with five releases, two finished, one in progress and two not yet started, dated from today. You can explore it, edit it, or delete it at any time.',
    );
    const buttons = Array.from(p.querySelectorAll('.sf-empty-actions > *'));
    expect(buttons.map(b => [b.tagName, b.textContent, b.className])).toEqual([
      ['BUTTON', 'Create New Project', 'pt-btn pt-btn-primary sf-btn'],
      ['BUTTON', 'Load Sample Project', 'pt-btn sf-btn'],
    ]);
  });

  it('Create New Project opens the New Project dialog, and Cancel brings focus back to it', async () => {
    await renderPage();
    const create = within(panel()!).getByRole('button', { name: 'Create New Project' });
    create.focus();
    fireEvent.click(create);
    const dialog = await screen.findByRole('dialog', { name: 'New Project' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(within(panel()!).getByRole('button', { name: 'Create New Project' })).toHaveFocus());
  });

  it.each([
    ['the panel\'s Load Sample Project', () => within(panel()!).getByRole('button', { name: 'Load Sample Project' })],
    ['the toolbar\'s Load Sample', () => screen.getByRole('button', { name: 'Load Sample' })],
  ])('%s adds "Sample: Mobile App Launch", opens it on the Gantt Chart tab and says so', async (_which, button) => {
    await renderPage();
    fireEvent.click(button());
    const picker = await screen.findByRole('combobox', { name: CHART_PICKER });
    expect(storedNames()).toEqual(['Sample: Mobile App Launch']);
    expect((picker as HTMLSelectElement).value).toBe(stored().projects[0].id);
    expect(screen.getByRole('button', { name: 'Gantt Chart' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sample: Mobile App Launch');
    expect(screen.getByText(MESSAGE)).toHaveAttribute('aria-live', 'polite');
  });

  it('is not shown once a project exists', async () => {
    seed({ projects: projects('Alpha') });
    await renderPage();
    expect(panel()).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Welcome to GanttApp™' })).toBeNull();
  });

  it('is not shown when every project is archived: the plain line is', async () => {
    seed({ projects: projects('Alpha'), projectPrefs: { p1: { archived: true } } });
    await renderPage();
    expect(panel()!.classList.contains('sf-empty')).toBe(false);
    expect(panel()!.textContent).toBe('All projects are archived. Select "Show archived (1)" to see them.');
  });
});
