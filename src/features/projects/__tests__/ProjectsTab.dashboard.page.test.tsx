// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The Projects tab on the real page (local storage mode): the toolbar, the
// tiles and their icons, Move earlier / Move later, focus after a delete and
// after the dialog closes, and Load Sample opening the Gantt Chart tab.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, configure } from '@testing-library/react';
import Home from '../../../../pages/index';
import { FullWrapper } from '../../../test/FullWrapper';
import type { AppData } from '../../../shared/types/app';
import type { Project, Release } from '../../../shared/types';

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
const tileOf = (name: string) =>
  screen.getByRole('button', { name: `Open releases for ${name}` }).closest<HTMLElement>('[data-project-tile]')!;
const tileButton = (name: string, label: string) => within(tileOf(name)).getByRole('button', { name: label });
const liveMessage = () => document.querySelector('.pt-root [aria-live="polite"]')!;
const onReleasesTab = () => screen.queryByRole('combobox', { name: 'Project shown on the Releases tab' }) !== null;

function projects(...names: string[]): Project[] {
  return names.map((name, i) => ({ id: `p${i + 1}`, name }));
}

async function renderPage() {
  render(<Home />, { wrapper: FullWrapper });
  await screen.findByRole('button', { name: 'New Project' });
}

describe('the Projects tab on the page', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('the toolbar', () => {
    it('reads Export All, Import, Load Sample, New Project, on the heading row', async () => {
      seed({ projects: projects('Alpha') });
      await renderPage();
      const head = screen.getByRole('heading', { name: 'Projects', level: 2 }).parentElement!;
      const names = Array.from(head.querySelectorAll('button, label')).map(el => el.getAttribute('aria-label') ?? el.textContent?.trim());
      expect(names).toEqual(['Export all projects as JSON', 'Import projects from JSON', 'Load Sample', 'New Project']);
    });

    it('with no projects: Import, Load Sample, New Project and one line, and nothing opens', async () => {
      await renderPage();
      expect(screen.getByText('No projects yet.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Export all projects as JSON' })).toBeNull();
      expect(screen.getByLabelText('Import projects from JSON')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Load Sample' })).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Projects' })).toBeNull();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('a tile', () => {
    it('is a list item under the heading, its name a heading holding the open button', async () => {
      seed({ projects: projects('Alpha', 'Beta') });
      await renderPage();
      const list = screen.getByRole('list', { name: 'Projects' });
      expect(within(list).getAllByRole('listitem')).toHaveLength(2);
      const heading = within(tileOf('Alpha')).getByRole('heading', { level: 3 });
      expect(heading).toHaveTextContent('Alpha');
      expect(within(heading).getByRole('button', { name: 'Open releases for Alpha' })).toBeInTheDocument();
    });

    it('offers today’s icon names, Delete first, and Move earlier / Move later', async () => {
      seed({ projects: projects('Alpha', 'Beta') });
      await renderPage();
      const labels = within(tileOf('Alpha')).getAllByRole('button').map(b => b.getAttribute('aria-label'));
      expect(labels).toEqual([
        'Open releases for Alpha', 'Delete project', 'Export project', 'Edit project', 'Clone project', 'Move earlier', 'Move later',
      ]);
    });

    it.each(['Export project', 'Edit project', 'Clone project', 'Move later', 'Delete project'])(
      'a click on %s does not open the releases, as a click on the name does',
      async (label) => {
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        seed({ projects: projects('Alpha', 'Beta') });
        await renderPage();
        fireEvent.click(tileButton('Alpha', label));
        expect(onReleasesTab()).toBe(false);
        expect(screen.getByRole('heading', { name: 'Projects', level: 2 })).toBeInTheDocument();

        fireEvent.keyDown(document.body, { key: 'Escape' });
        fireEvent.click(screen.getAllByRole('button', { name: /^Open releases for / })[0]);
        await waitFor(() => expect(onReleasesTab()).toBe(true));
      },
    );
  });

  describe('Move earlier and Move later', () => {
    it.each([
      { names: ['A', 'B', 'C'], label: 'three projects' },
      { names: ['A', 'B', 'C', 'D'], label: 'four projects' },
    ])('with $label: each move reorders the whole list, keeps focus, and says where it went', async ({ names }) => {
      seed({ projects: projects(...names) });
      await renderPage();
      const n = names.length;
      expect(tileButton('A', 'Move earlier')).toBeDisabled();
      expect(tileButton(names[n - 1], 'Move later')).toBeDisabled();

      fireEvent.click(tileButton('A', 'Move later'));
      expect(storedNames()).toEqual(['B', 'A', ...names.slice(2)]);
      expect(tileButton('A', 'Move later')).toHaveFocus();
      expect(liveMessage()).toHaveTextContent(`"A" moved to position 2 of ${n}.`);

      fireEvent.click(tileButton('B', 'Move later'));
      expect(storedNames()).toEqual(['A', 'B', ...names.slice(2)]);

      // At the end the pressed button is disabled, so focus passes to its partner.
      const last = names[n - 1];
      fireEvent.click(tileButton(last, 'Move earlier'));
      fireEvent.click(tileButton(last, 'Move later'));
      expect(storedNames()[n - 1]).toBe(last);
      expect(tileButton(last, 'Move later')).toBeDisabled();
      expect(tileButton(last, 'Move earlier')).toHaveFocus();
      expect(liveMessage()).toHaveTextContent(`"${last}" moved to position ${n} of ${n}.`);

      fireEvent.click(tileButton('B', 'Move earlier'));
      expect(storedNames()[0]).toBe('B');
      expect(tileButton('B', 'Move later')).toHaveFocus();
      expect(liveMessage()).toHaveTextContent(`"B" moved to position 1 of ${n}.`);
      expect([...storedNames()].sort()).toEqual([...names].sort());
    });
  });

  describe('focus after a delete', () => {
    async function deleteTile(name: string) {
      fireEvent.click(tileButton(name, 'Delete project'));
      fireEvent.click(within(await screen.findByRole('dialog', { name: 'Delete Project' })).getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(storedNames()).not.toContain(name));
    }

    it('goes to the next tile', async () => {
      seed({ projects: projects('A', 'B', 'C') });
      await renderPage();
      await deleteTile('B');
      await waitFor(() => expect(screen.getByRole('button', { name: 'Open releases for C' })).toHaveFocus());
    });

    it('goes to the previous tile when the last is deleted', async () => {
      seed({ projects: projects('A', 'B', 'C') });
      await renderPage();
      await deleteTile('C');
      await waitFor(() => expect(screen.getByRole('button', { name: 'Open releases for B' })).toHaveFocus());
    });

    it('goes to New Project when none is left', async () => {
      seed({ projects: projects('A') });
      await renderPage();
      await deleteTile('A');
      await waitFor(() => expect(screen.getByRole('button', { name: 'New Project' })).toHaveFocus());
    });

    it('Escape on the confirmation closes it, deletes nothing and returns focus to Delete', async () => {
      seed({ projects: projects('A', 'B') });
      await renderPage();
      tileButton('A', 'Delete project').focus();
      fireEvent.click(tileButton('A', 'Delete project'));
      const confirm = await screen.findByRole('dialog', { name: 'Delete Project' });
      fireEvent.keyDown(within(confirm).getByRole('button', { name: 'Cancel' }), { key: 'Escape', bubbles: true, cancelable: true });
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(storedNames()).toEqual(['A', 'B']);
      expect(tileButton('A', 'Delete project')).toHaveFocus();
    });
  });

  describe('the project dialog returns focus', () => {
    it('to New Project after Create, and to the tile’s Edit after Update', async () => {
      seed({ projects: projects('A', 'B') });
      await renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'New Project' }));
      fireEvent.change(screen.getByLabelText('Project Name'), { target: { value: 'C' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create' }));
      expect(screen.getByRole('button', { name: 'New Project' })).toHaveFocus();
      expect(storedNames()).toEqual(['A', 'B', 'C']);

      fireEvent.click(tileButton('B', 'Edit project'));
      fireEvent.change(screen.getByLabelText('Project Name'), { target: { value: 'B2' } });
      fireEvent.click(screen.getByRole('button', { name: 'Update' }));
      expect(tileButton('B2', 'Edit project')).toHaveFocus();
    });
  });

  describe('Load Sample', () => {
    // Friday 12 June 2026, with a Sunday-to-Thursday global week: the sample
    // starts on Sunday 14 June, so no date falls on a Friday or a Saturday.
    const FRIDAY = new Date(2026, 5, 12, 10, 0, 0);

    it('adds the sample at the end, selects it, opens the Gantt Chart with focus on its picker, and says so', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(FRIDAY);
      seed({ projects: projects('Alpha'), globalWorkDays: [0, 1, 2, 3, 4] });
      await renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Load Sample' }));

      const picker = await screen.findByRole('combobox', { name: CHART_PICKER });
      await waitFor(() => expect(picker).toHaveFocus());
      const data = stored();
      const sample = data.projects[1];
      expect(data.projects.map(p => p.name)).toEqual(['Alpha', 'Mobile App Launch (Sample)']);
      expect(sample.finishDate).toBe('2026-11-01');
      expect(sample).not.toHaveProperty('owner');
      expect((picker as HTMLSelectElement).value).toBe(sample.id);
      const releases = data.releases.filter((r: Release) => r.projectId === sample.id);
      expect(releases.map(r => r.status)).toEqual(['complete', 'complete', 'in-progress', undefined, undefined]);
      expect(releases[0].startDate).toBe('2026-03-22');
      expect(screen.getByText(/^Added "Mobile App Launch \(Sample\)"/)).toHaveAttribute('aria-live', 'polite');
    });

    it('a second press adds "(Sample 2)"; with "(Sample)" deleted, the next is "(Sample)" again', async () => {
      seed({ projects: projects('Alpha') });
      await renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Load Sample' }));
      await screen.findByRole('combobox', { name: CHART_PICKER });
      fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Load Sample' }));
      await screen.findByRole('combobox', { name: CHART_PICKER });
      expect(storedNames()).toEqual(['Alpha', 'Mobile App Launch (Sample)', 'Mobile App Launch (Sample 2)']);

      fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Open releases for Mobile App Launch (Sample)' }));
      fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
      fireEvent.click(tileButton('Mobile App Launch (Sample)', 'Delete project'));
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(storedNames()).toEqual(['Alpha', 'Mobile App Launch (Sample 2)']));
      fireEvent.click(screen.getByRole('button', { name: 'Load Sample' }));
      await screen.findByRole('combobox', { name: CHART_PICKER });
      expect(storedNames()).toEqual(['Alpha', 'Mobile App Launch (Sample 2)', 'Mobile App Launch (Sample)']);
    });
  });
});
