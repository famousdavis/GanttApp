// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Archive and tile colour on the real page (local storage mode): the filter,
// the tiles, focus and messages, reordering past hidden projects, the pickers
// on the other tabs, and everything refused when nothing can be saved.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, configure } from '@testing-library/react';
import Home from '../../../../pages/index';
import { FullWrapper } from '../../../test/FullWrapper';
import { LocalGanttStorageService } from '../../../shared/storage/local-gantt-storage-service';
import type { AppData } from '../../../shared/types/app';
import type { Project, ProjectColor, ProjectPrefs } from '../../../shared/types';

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

const ALL_ARCHIVED_ELSEWHERE = 'All projects are archived. Unarchive one on the Projects tab to see it here.';
const RELEASES_PICKER = 'Project shown on the Releases tab';
const CHART_PICKER = 'Project shown on the Gantt Chart tab';

function seed(names: string[], archived: string[] = [], colors: Record<string, ProjectColor> = {}, more: Partial<AppData> = {}) {
  const projectPrefs: ProjectPrefs = {};
  names.forEach((name) => {
    const pref = {
      ...(colors[name] && { color: colors[name] }),
      ...(archived.includes(name) && { archived: true as const }),
    };
    if (Object.keys(pref).length > 0) projectPrefs[name] = pref;
  });
  const projects: Project[] = names.map(name => ({ id: name, name }));
  localStorage.setItem('ganttAppData', JSON.stringify({
    projects,
    releases: [],
    ...(Object.keys(projectPrefs).length > 0 && { projectPrefs }),
    ...more,
  }));
}

const stored = (): AppData => JSON.parse(localStorage.getItem('ganttAppData')!);
const storedNames = () => stored().projects.map(p => p.name);
const shownNames = () => Array.from(document.querySelectorAll('[data-project-tile] .pt-open')).map(e => e.textContent);
const tileOf = (name: string) =>
  screen.getByRole('button', { name: new RegExp(`releases for ${name}$`) }).closest<HTMLElement>('[data-project-tile]')!;
const tileButton = (name: string, label: string | RegExp) => within(tileOf(name)).getByRole('button', { name: label });
const openButton = (name: string) => screen.getByRole('button', { name: new RegExp(`releases for ${name}$`) });
const status = () => document.querySelector('.pt-root [aria-live="polite"]')?.textContent;
const pageMessage = () => document.querySelector('.pt-sr-only[aria-live="polite"]:not(.pt-root *)')?.textContent;
const newProject = () => screen.getByRole('button', { name: 'New Project' });
const filter = () => screen.queryByRole('checkbox', { name: /^Show archived/ });
const colorIcon = (name: string) => tileButton(name, /^Tile color: /);
const popover = () => screen.queryByRole('dialog', { name: 'Tile color' });
const tab = (name: string) => screen.getByRole('button', { name });

/** A release for each project: the Gantt Chart tab draws its picker only with one to show. */
const releasesFor = (names: string[]): Pick<AppData, 'releases'> => ({
  releases: names.map(name => ({
    id: `r-${name}`,
    projectId: name,
    name: `${name} release`,
    startDate: '2026-06-01',
    earlyFinishDate: '2026-07-01',
    lateFinishDate: '2026-08-01',
  })),
});

async function renderPage() {
  render(<Home />, { wrapper: FullWrapper });
  await screen.findByRole('button', { name: 'New Project' });
}

const picker = (label: string) => screen.findByRole('combobox', { name: label });
const optionNames = (select: HTMLElement) => within(select).getAllByRole('option').map(o => o.textContent);

describe('archive and tile colour on the page', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('"Show archived"', () => {
    it('is not shown with nothing archived', async () => {
      seed(['A', 'B'], [], { A: 'blue' });
      await renderPage();
      expect(filter()).toBeNull();
      expect(shownNames()).toEqual(['A', 'B']);
    });

    it.each([
      { archived: ['B'], n: 1, shown: ['A', 'C', 'D'] },
      { archived: ['A', 'D'], n: 2, shown: ['B', 'C'] },
      { archived: ['A', 'B', 'D'], n: 3, shown: ['C'] },
    ])('with $n archived it says so, starts off, and hides them', async ({ archived, n, shown }) => {
      seed(['A', 'B', 'C', 'D'], archived);
      await renderPage();
      const box = screen.getByRole('checkbox', { name: `Show archived (${n})` });
      expect(box).not.toBeChecked();
      expect(box).toHaveAttribute('name', 'showArchived');
      expect(box).toHaveAttribute('id');
      expect(shownNames()).toEqual(shown);
    });

    it('counts archived projects, not entries left in the map by a project no longer held', async () => {
      seed(['A', 'B'], ['B'], {}, {
        projectPrefs: { B: { archived: true }, gone: { archived: true }, other: { archived: true } },
      });
      await renderPage();
      expect(screen.getByRole('checkbox', { name: 'Show archived (1)' })).toBeInTheDocument();
    });

    it('a colour alone does not count as archived', async () => {
      seed(['A', 'B', 'C'], ['B'], { A: 'teal', B: 'pink' });
      await renderPage();
      expect(screen.getByRole('checkbox', { name: 'Show archived (1)' })).toBeInTheDocument();
      expect(shownNames()).toEqual(['A', 'C']);
    });

    it('lists archived projects in their places when ticked, and hides them again', async () => {
      seed(['A', 'B', 'C', 'D'], ['A', 'C']);
      await renderPage();
      fireEvent.click(filter()!);
      expect(shownNames()).toEqual(['A', 'B', 'C', 'D']);
      fireEvent.click(filter()!);
      expect(shownNames()).toEqual(['B', 'D']);
    });

    it('is not stored: nothing is saved, and it is off when the tab comes back', async () => {
      seed(['A', 'B'], ['B']);
      await renderPage();
      const before = localStorage.getItem('ganttAppData');
      fireEvent.click(filter()!);
      expect(localStorage.getItem('ganttAppData')).toBe(before);

      fireEvent.click(tab('About'));
      fireEvent.click(tab('Projects'));
      expect(await screen.findByRole('checkbox', { name: 'Show archived (1)' })).not.toBeChecked();
      expect(shownNames()).toEqual(['A']);
    });

    it.each([
      { archived: ['B'], label: 'one archived' },
      { archived: ['A', 'B'], label: 'two archived' },
    ])('goes away at zero and comes back off: $label', async ({ archived }) => {
      seed(['A', 'B', 'C'], archived);
      await renderPage();
      fireEvent.click(filter()!);
      archived.forEach(name => fireEvent.click(tileButton(name, 'Unarchive project')));
      expect(filter()).toBeNull();

      fireEvent.click(tileButton('A', 'Archive project'));
      expect(filter()).not.toBeChecked();
      expect(shownNames()).toEqual(['B', 'C']);
    });

    it('sits on its own row under the toolbar, above the tiles', async () => {
      seed(['A', 'B'], ['B']);
      await renderPage();
      const row = filter()!.closest('.pt-filter')!;
      expect(document.querySelector('.pt-head')!.nextElementSibling).toBe(row);
    });
  });

  describe('the empty states', () => {
    it('no projects: "No projects yet.", and no filter', async () => {
      await renderPage();
      expect(screen.getByText('No projects yet.')).toBeInTheDocument();
      expect(screen.queryByText(/All projects are archived/)).toBeNull();
      expect(filter()).toBeNull();
    });

    it.each([
      { names: ['A'], n: 1 },
      { names: ['A', 'B', 'C'], n: 3 },
    ])('all $n archived, filter off: says how to see them', async ({ names, n }) => {
      seed(names, names);
      await renderPage();
      expect(screen.getByText(`All projects are archived. Select "Show archived (${n})" to see them.`)).toBeInTheDocument();
      expect(screen.queryByText('No projects yet.')).toBeNull();
      expect(screen.queryByRole('list', { name: 'Projects' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Export all projects as JSON' })).toBeInTheDocument();
    });

    it('all archived, filter on: the tiles, and neither line', async () => {
      seed(['A', 'B'], ['A', 'B']);
      await renderPage();
      fireEvent.click(filter()!);
      expect(shownNames()).toEqual(['A', 'B']);
      expect(screen.queryByText(/All projects are archived/)).toBeNull();
      expect(screen.queryByText('No projects yet.')).toBeNull();
    });
  });

  describe('Archive, with "Show archived" off', () => {
    it.each([
      { names: ['A', 'B', 'C'], archived: [], target: 'A', focus: 'B', label: 'first: the next tile' },
      { names: ['A', 'B', 'C'], archived: [], target: 'B', focus: 'C', label: 'middle: the next tile' },
      { names: ['A', 'B', 'C'], archived: [], target: 'C', focus: 'B', label: 'last: the previous tile' },
      { names: ['A', 'B', 'C'], archived: ['B'], target: 'A', focus: 'C', label: 'past a hidden next project' },
      { names: ['A', 'B', 'C'], archived: ['B'], target: 'C', focus: 'A', label: 'past a hidden previous project' },
      { names: ['A', 'B', 'C', 'D'], archived: ['B', 'C'], target: 'A', focus: 'D', label: 'past two hidden projects' },
    ])('moves focus: $label', async ({ names, archived, target, focus }) => {
      seed(names, archived);
      await renderPage();
      fireEvent.click(tileButton(target, 'Archive project'));

      expect(openButton(focus)).toHaveFocus();
      expect(shownNames()).not.toContain(target);
      expect(stored().projectPrefs?.[target]).toEqual({ archived: true });
    });

    it.each([
      { names: ['A'], archived: [], target: 'A', label: 'the only project' },
      { names: ['A', 'B', 'C'], archived: ['A', 'C'], target: 'B', label: 'the only one shown' },
    ])('moves focus to New Project: $label', async ({ names, archived, target }) => {
      seed(names, archived);
      await renderPage();
      fireEvent.click(tileButton(target, 'Archive project'));
      expect(newProject()).toHaveFocus();
      expect(screen.getByText(/^All projects are archived\. Select/)).toBeInTheDocument();
    });

    it.each([
      { archived: [], n: 1 },
      { archived: ['B'], n: 2 },
      { archived: ['B', 'C'], n: 3 },
    ])('says where to find it, counting $n archived', async ({ archived, n }) => {
      seed(['A', 'B', 'C', 'D'], archived);
      await renderPage();
      fireEvent.click(tileButton('A', 'Archive project'));
      expect(status()).toBe(`Archived "A". Show archived (${n}) lists it.`);
      expect(screen.getByRole('checkbox', { name: `Show archived (${n})` })).toBeInTheDocument();
    });

    it('keeps the project in the saved list, and its colour', async () => {
      seed(['A', 'B', 'C'], [], { B: 'purple' });
      await renderPage();
      fireEvent.click(tileButton('B', 'Archive project'));
      expect(storedNames()).toEqual(['A', 'B', 'C']);
      expect(stored().projectPrefs).toEqual({ B: { color: 'purple', archived: true } });
    });
  });

  describe('Archive, with "Show archived" on', () => {
    it('keeps the tile, now archived, with focus on its Unarchive button', async () => {
      seed(['A', 'B', 'C'], ['C']);
      await renderPage();
      fireEvent.click(filter()!);
      fireEvent.click(tileButton('A', 'Archive project'));

      expect(shownNames()).toEqual(['A', 'B', 'C']);
      expect(tileOf('A')).toHaveClass('pt-archived');
      expect(tileButton('A', 'Unarchive project')).toHaveFocus();
      expect(status()).toBe('Archived "A".');
      expect(screen.getByRole('checkbox', { name: 'Show archived (2)' })).toBeChecked();
    });
  });

  describe('an archived tile', () => {
    async function renderArchived(color?: ProjectColor) {
      seed(['A', 'B'], ['A'], color ? { A: color } : {});
      await renderPage();
      fireEvent.click(filter()!);
    }

    it('has a badge after the name, the archived class, and no opacity of its own', async () => {
      await renderArchived('blue');
      const tile = tileOf('A');
      expect(tile).toHaveClass('pt-archived');
      const badge = within(tile).getByText('Archived');
      expect(badge).toHaveClass('pt-badge');
      expect(badge.previousElementSibling?.tagName).toBe('H3');
      expect(tile.style.opacity).toBe('');
    });

    it('an unarchived tile beside it has neither', async () => {
      await renderArchived();
      const tile = tileOf('B');
      expect(tile).not.toHaveClass('pt-archived');
      expect(within(tile).queryByText('Archived')).toBeNull();
    });

    it('says what a click does, on the name and in the tooltip', async () => {
      await renderArchived();
      const open = openButton('A');
      expect(open).toHaveAccessibleName('Unarchive and open releases for A');
      expect(open).toHaveAttribute('title', 'Unarchive and open releases');
      expect(openButton('B')).toHaveAccessibleName('Open releases for B');
      expect(openButton('B')).toHaveAttribute('title', 'Open releases');
    });

    it('offers Unarchive in place of Archive, outside the revealed icons', async () => {
      await renderArchived('slate');
      const labels = within(tileOf('A')).getAllByRole('button').map(b => b.getAttribute('aria-label'));
      expect(labels).toEqual([
        'Unarchive and open releases for A', 'Delete project', 'Export project', 'Edit project', 'Clone project',
        'Tile color: Slate', 'Unarchive project', 'Move earlier', 'Move later',
      ]);
      expect(tileButton('A', 'Unarchive project').closest('.pt-reveal')).toBeNull();
      expect(tileButton('A', 'Tile color: Slate').closest('.pt-reveal')).not.toBeNull();
      expect(tileButton('A', 'Move later').closest('.pt-reveal')).not.toBeNull();
    });

    it('Delete, Edit, Clone and Move work on it as on any tile', async () => {
      await renderArchived('teal');
      fireEvent.click(tileButton('A', 'Move later'));
      expect(storedNames()).toEqual(['B', 'A']);

      fireEvent.click(tileButton('A', 'Clone project'));
      expect(await screen.findByRole('button', { name: 'Open releases for A - Copy (1)' })).toBeInTheDocument();
      const copy = stored().projects.find(p => p.name === 'A - Copy (1)')!;
      expect(stored().projectPrefs?.[copy.id]).toEqual({ color: 'teal' });

      fireEvent.click(tileButton('A', 'Edit project'));
      expect(screen.getByRole('dialog', { name: 'Edit Project' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      fireEvent.click(tileButton('A', 'Delete project'));
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(await screen.findByRole('button', { name: 'Open releases for B' })).toBeInTheDocument();
      expect(storedNames()).toEqual(['B', 'A - Copy (1)']);
      expect(stored().projectPrefs?.A).toBeUndefined();
    });
  });

  describe('Unarchive', () => {
    it.each([
      { archived: ['A'], left: undefined, label: 'the last one archived' },
      { archived: ['A', 'C'], left: 'Show archived (1)', label: 'with another still archived' },
    ])('moves focus to the tile\'s Archive icon and says so: $label', async ({ archived, left }) => {
      seed(['A', 'B', 'C'], archived);
      await renderPage();
      fireEvent.click(filter()!);
      fireEvent.click(tileButton('A', 'Unarchive project'));

      expect(tileButton('A', 'Archive project')).toHaveFocus();
      expect(status()).toBe('Unarchived "A".');
      expect(tileOf('A')).not.toHaveClass('pt-archived');
      expect(stored().projectPrefs?.A).toBeUndefined();
      expect(filter()?.closest('label')?.textContent).toBe(left);
    });

    it('keeps the tile\'s colour', async () => {
      seed(['A', 'B'], ['A'], { A: 'pink' });
      await renderPage();
      fireEvent.click(filter()!);
      fireEvent.click(tileButton('A', 'Unarchive project'));
      expect(stored().projectPrefs).toEqual({ A: { color: 'pink' } });
      expect(tileOf('A')).toHaveAttribute('data-color', 'pink');
    });
  });

  describe('a click on an archived tile', () => {
    it('unarchives the project, opens its releases, and the page says so', async () => {
      seed(['A', 'B', 'C'], ['B']);
      await renderPage();
      fireEvent.click(filter()!);
      fireEvent.click(openButton('B'));

      const select = await picker(RELEASES_PICKER);
      expect(select).toHaveValue('B');
      expect(optionNames(select)).toEqual(['A', 'B', 'C']);
      expect(stored().projectPrefs).toBeUndefined();
      expect(pageMessage()).toBe('Unarchived "B" and opened its releases.');
    });

    it('a click on a tile that is not archived opens its releases, unarchives nothing and says nothing', async () => {
      seed(['A', 'B', 'C'], ['B']);
      await renderPage();
      fireEvent.click(filter()!);
      fireEvent.click(openButton('C'));

      expect(await picker(RELEASES_PICKER)).toHaveValue('C');
      expect(stored().projectPrefs).toEqual({ B: { archived: true } });
      expect(pageMessage()).toBe('');
    });
  });

  describe('Move earlier and Move later, past hidden projects', () => {
    it.each([
      { hidden: ['A'], move: 'C', label: 'Move later', order: 'A B D C E F', message: '"C" moved to position 3 of 5.', where: 'hidden first' },
      { hidden: ['C'], move: 'B', label: 'Move later', order: 'A D C B E F', message: '"B" moved to position 3 of 5.', where: 'hidden in the middle, jumped over' },
      { hidden: ['F'], move: 'E', label: 'Move earlier', order: 'A B C E D F', message: '"E" moved to position 4 of 5.', where: 'hidden last' },
      { hidden: ['D'], move: 'C', label: 'Move later', order: 'A B E D C F', message: '"C" moved to position 4 of 5.', where: 'hidden next to the moved tile' },
      { hidden: ['D'], move: 'E', label: 'Move earlier', order: 'A B E D C F', message: '"E" moved to position 3 of 5.', where: 'hidden just before the moved tile' },
      { hidden: ['B', 'E'], move: 'A', label: 'Move later', order: 'C B A D E F', message: '"A" moved to position 2 of 4.', where: 'two apart' },
      { hidden: ['B', 'C'], move: 'D', label: 'Move earlier', order: 'D B C A E F', message: '"D" moved to position 1 of 4.', where: 'two together' },
      { hidden: ['A', 'B', 'C', 'D'], move: 'E', label: 'Move later', order: 'A B C D F E', message: '"E" moved to position 2 of 2.', where: 'most hidden' },
    ])('$where: the shown tiles change order, a hidden project keeps its slot', async ({ hidden, move, label, order, message }) => {
      seed(['A', 'B', 'C', 'D', 'E', 'F'], hidden);
      await renderPage();
      const before = stored().projectPrefs;
      fireEvent.click(tileButton(move, label));

      const expected = order.split(' ');
      expect(storedNames()).toEqual(expected);
      expect(shownNames()).toEqual(expected.filter(n => !hidden.includes(n)));
      expect(status()).toBe(message);
      expect(stored().projectPrefs).toEqual(before);
    });

    it('with "Show archived" on, every tile counts', async () => {
      seed(['A', 'B', 'C'], ['B']);
      await renderPage();
      fireEvent.click(filter()!);
      fireEvent.click(tileButton('A', 'Move later'));
      expect(storedNames()).toEqual(['B', 'A', 'C']);
      expect(status()).toBe('"A" moved to position 2 of 3.');
    });

    it.each([
      { hidden: ['A'], first: 'B', last: 'E', where: 'hidden at the start' },
      { hidden: ['E'], first: 'A', last: 'D', where: 'hidden at the end' },
      { hidden: ['A', 'E'], first: 'B', last: 'D', where: 'hidden at both ends' },
      { hidden: ['C'], first: 'A', last: 'E', where: 'hidden in the middle' },
    ])('the ends are those of the shown tiles: $where', async ({ hidden, first, last }) => {
      seed(['A', 'B', 'C', 'D', 'E'], hidden);
      await renderPage();
      expect(tileButton(first, 'Move earlier')).toBeDisabled();
      expect(tileButton(first, 'Move later')).toBeEnabled();
      expect(tileButton(last, 'Move later')).toBeDisabled();
      expect(tileButton(last, 'Move earlier')).toBeEnabled();
    });

    it('with one tile shown, both ends are that tile', async () => {
      seed(['A', 'B', 'C'], ['A', 'C']);
      await renderPage();
      expect(tileButton('B', 'Move earlier')).toBeDisabled();
      expect(tileButton('B', 'Move later')).toBeDisabled();
    });

    it('focus stays on the pressed button, and goes to its partner at an end of the shown list', async () => {
      seed(['A', 'B', 'C', 'D'], ['D']);
      await renderPage();
      fireEvent.click(tileButton('A', 'Move later'));
      expect(tileButton('A', 'Move later')).toHaveFocus();

      fireEvent.click(tileButton('A', 'Move later'));
      expect(storedNames()).toEqual(['B', 'C', 'A', 'D']);
      expect(tileButton('A', 'Move later')).toBeDisabled();
      expect(tileButton('A', 'Move earlier')).toHaveFocus();
    });
  });

  describe('dragging past hidden projects', () => {
    function drag(from: string, over: string) {
      const grip = tileOf(from).querySelector('.pt-grip')!;
      fireEvent.dragStart(grip);
      fireEvent.dragOver(tileOf(over));
      fireEvent.dragEnd(grip);
    }

    it.each([
      { hidden: ['A'], from: 'B', over: 'D', order: 'A C D B E F', where: 'hidden first' },
      { hidden: ['C'], from: 'A', over: 'F', order: 'B D C E F A', where: 'hidden in the middle' },
      { hidden: ['F'], from: 'E', over: 'A', order: 'E A B C D F', where: 'hidden last' },
      { hidden: ['D'], from: 'C', over: 'E', order: 'A B E D C F', where: 'hidden between the two' },
      { hidden: ['B', 'C'], from: 'D', over: 'A', order: 'D B C A E F', where: 'two together' },
      { hidden: [], from: 'A', over: 'C', order: 'B C A D E F', where: 'nothing hidden' },
    ])('$where: a hidden project keeps its slot', async ({ hidden, from, over, order }) => {
      seed(['A', 'B', 'C', 'D', 'E', 'F'], hidden);
      await renderPage();
      drag(from, over);
      const expected = order.split(' ');
      expect(storedNames()).toEqual(expected);
      expect(shownNames()).toEqual(expected.filter(n => !hidden.includes(n)));
    });

    it('a drag over its own tile saves nothing', async () => {
      seed(['A', 'B'], []);
      await renderPage();
      const before = localStorage.getItem('ganttAppData');
      drag('A', 'A');
      expect(localStorage.getItem('ganttAppData')).toBe(before);
    });

    it('a drag over a tile with nothing being dragged saves nothing', async () => {
      seed(['A', 'B'], []);
      await renderPage();
      const before = localStorage.getItem('ganttAppData');
      fireEvent.dragOver(tileOf('B'));
      expect(localStorage.getItem('ganttAppData')).toBe(before);
    });
  });

  describe('delete with hidden projects', () => {
    it.each([
      { target: 'A', focus: 'C', where: 'the next shown tile, past a hidden one' },
      { target: 'C', focus: 'A', where: 'the previous shown tile, past a hidden one' },
    ])('moves focus to $where', async ({ target, focus }) => {
      seed(['A', 'B', 'C'], ['B']);
      await renderPage();
      fireEvent.click(tileButton(target, 'Delete project'));
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await screen.findByText('Show archived (1)');
      expect(openButton(focus)).toHaveFocus();
    });

    it('moves focus to New Project when no shown tile is left', async () => {
      seed(['A', 'B'], ['B']);
      await renderPage();
      fireEvent.click(tileButton('A', 'Delete project'));
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await screen.findByText(/^All projects are archived/);
      expect(newProject()).toHaveFocus();
    });
  });

  describe('tile colour', () => {
    it.each(['blue', 'teal', 'slate', 'purple', 'pink'] as const)('a %s tile says so, and only that tile', async (color) => {
      seed(['A', 'B'], [], { A: color });
      await renderPage();
      expect(tileOf('A')).toHaveAttribute('data-color', color);
      expect(tileOf('B')).toHaveAttribute('data-color', 'none');
    });

    it('a pick tints the tile and is saved, on any colour, and No color clears it', async () => {
      seed(['A', 'B']);
      await renderPage();
      fireEvent.click(colorIcon('A'));
      fireEvent.click(screen.getByRole('radio', { name: 'Teal' }));
      expect(tileOf('A')).toHaveAttribute('data-color', 'teal');
      expect(stored().projectPrefs).toEqual({ A: { color: 'teal' } });

      fireEvent.click(screen.getByRole('radio', { name: 'Pink' }));
      expect(tileOf('A')).toHaveAttribute('data-color', 'pink');
      expect(stored().projectPrefs).toEqual({ A: { color: 'pink' } });

      fireEvent.click(screen.getByRole('radio', { name: 'No color' }));
      expect(tileOf('A')).toHaveAttribute('data-color', 'none');
      expect(stored().projectPrefs).toBeUndefined();
    });

    it('the icons stay shown while the popover is open, on that tile only', async () => {
      seed(['A', 'B']);
      await renderPage();
      fireEvent.click(colorIcon('A'));
      expect(tileOf('A')).toHaveClass('pt-pop-open');
      expect(tileOf('B')).not.toHaveClass('pt-pop-open');

      fireEvent.keyDown(screen.getByRole('radio', { name: 'No color' }), { key: 'Escape' });
      expect(tileOf('A')).not.toHaveClass('pt-pop-open');
    });

    it('only one popover is open at a time', async () => {
      seed(['A', 'B']);
      await renderPage();
      fireEvent.click(colorIcon('A'));
      fireEvent.click(colorIcon('B'));
      expect(screen.getAllByRole('dialog', { name: 'Tile color' })).toHaveLength(1);
      expect(within(tileOf('B')).getByRole('dialog', { name: 'Tile color' })).toBeInTheDocument();
      expect(tileOf('A')).not.toHaveClass('pt-pop-open');
    });

    it('a click inside the popover does not open Releases', async () => {
      seed(['A', 'B']);
      await renderPage();
      fireEvent.click(colorIcon('A'));
      const dialog = popover()!;
      fireEvent.click(within(dialog).getByText('Arrow keys choose. Enter or Esc closes.'));
      fireEvent.click(within(dialog).getByRole('radio', { name: 'Blue' }));
      expect(screen.queryByRole('combobox', { name: RELEASES_PICKER })).toBeNull();
      expect(popover()).not.toBeNull();
    });

    it('a click on the Colour icon does not open Releases', async () => {
      seed(['A']);
      await renderPage();
      fireEvent.click(colorIcon('A'));
      expect(screen.queryByRole('combobox', { name: RELEASES_PICKER })).toBeNull();
    });

    it('Escape in the popover leaves the page\'s own Escape undone: Chart Settings stays open', async () => {
      seed(['A'], [], {}, releasesFor(['A']));
      await renderPage();
      fireEvent.click(tab('Gantt Chart'));
      fireEvent.click(await screen.findByText(/^Chart Settings/));
      expect(screen.getByText('Chart Settings ▲')).toBeInTheDocument();

      fireEvent.click(tab('Projects'));
      await screen.findByRole('button', { name: 'New Project' });
      fireEvent.click(colorIcon('A'));
      fireEvent.keyDown(screen.getByRole('radio', { name: 'No color' }), { key: 'Escape' });

      fireEvent.click(tab('Gantt Chart'));
      expect(await screen.findByText('Chart Settings ▲')).toBeInTheDocument();
    });

    describe('is not left stranded', () => {
      async function withPopoverOn(name: string) {
        fireEvent.click(colorIcon(name));
        expect(popover()).not.toBeNull();
      }

      /** As when the window lost focus: no blur is left to close the popover, only the tab can. */
      function withFocusAlreadyOut() {
        (document.activeElement as HTMLElement).blur();
        expect(popover()).not.toBeNull();
      }

      it.each([
        ['Edit project', 'Edit Project'],
        ['Delete project', 'Delete Project'],
      ])('%s closes it even with focus already out of it', async (label, title) => {
        seed(['A', 'B']);
        await renderPage();
        await withPopoverOn('A');
        withFocusAlreadyOut();
        fireEvent.click(tileButton('B', label));
        expect(screen.getByText(title)).toBeInTheDocument();
        expect(popover()).toBeNull();
      });

      it('a reorder closes it even with focus already out of it', async () => {
        seed(['A', 'B']);
        await renderPage();
        await withPopoverOn('A');
        withFocusAlreadyOut();
        fireEvent.click(tileButton('A', 'Move later'));
        expect(storedNames()).toEqual(['B', 'A']);
        expect(popover()).toBeNull();
      });

      it('archiving with "Show archived" on closes it even with focus already out of it', async () => {
        seed(['A', 'B', 'C'], ['C']);
        await renderPage();
        fireEvent.click(filter()!);
        await withPopoverOn('A');
        withFocusAlreadyOut();
        fireEvent.click(tileButton('A', 'Archive project'));
        expect(tileOf('A')).toHaveClass('pt-archived');
        expect(popover()).toBeNull();
      });

      it.each([
        ['Edit project', 'Edit Project'],
        ['Delete project', 'Delete Project'],
      ])('%s opens a dialog: it closes, and does not come back with the dialog\'s Cancel', async (label, title) => {
        seed(['A', 'B']);
        await renderPage();
        await withPopoverOn('A');
        fireEvent.click(tileButton('B', label));
        expect(screen.getByText(title)).toBeInTheDocument();
        expect(popover()).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(popover()).toBeNull();
      });

      it('New Project opens a dialog: it closes', async () => {
        seed(['A']);
        await renderPage();
        await withPopoverOn('A');
        fireEvent.click(newProject());
        expect(popover()).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(popover()).toBeNull();
      });

      it('archiving the tile closes it, and unarchiving does not bring it back', async () => {
        seed(['A', 'B', 'C'], ['C']);
        await renderPage();
        fireEvent.click(filter()!);
        await withPopoverOn('A');
        fireEvent.click(tileButton('A', 'Archive project'));
        expect(popover()).toBeNull();
        fireEvent.click(tileButton('A', 'Unarchive project'));
        expect(popover()).toBeNull();
      });

      it('with the filter off, the tile leaving closes it, and its return does not bring it back', async () => {
        seed(['A', 'B']);
        await renderPage();
        await withPopoverOn('A');
        fireEvent.click(tileButton('A', 'Archive project'));
        expect(popover()).toBeNull();
        fireEvent.click(filter()!);
        expect(popover()).toBeNull();
        expect(tileOf('A')).not.toHaveClass('pt-pop-open');
      });

      it('unticking "Show archived" under it closes it, and ticking it again does not bring it back', async () => {
        seed(['A', 'B'], ['A']);
        await renderPage();
        fireEvent.click(filter()!);
        await withPopoverOn('A');
        fireEvent.click(filter()!);
        expect(popover()).toBeNull();
        fireEvent.click(filter()!);
        expect(popover()).toBeNull();
      });

      it('a reorder closes it', async () => {
        seed(['A', 'B']);
        await renderPage();
        await withPopoverOn('A');
        fireEvent.click(tileButton('A', 'Move later'));
        expect(popover()).toBeNull();
      });
    });
  });

  describe('the pickers', () => {
    const PICKERS = [
      ['Releases', RELEASES_PICKER, 'Releases'],
      ['Gantt Chart', CHART_PICKER, 'Gantt Chart'],
    ] as const;

    it.each(PICKERS)('the %s tab lists unarchived projects only', async (_name, label, tabName) => {
      seed(['A', 'B', 'C', 'D'], ['A', 'C'], {}, releasesFor(['A', 'B', 'C', 'D']));
      await renderPage();
      fireEvent.click(tab(tabName));
      expect(optionNames(await picker(label))).toEqual(['B', 'D']);
    });

    it.each(PICKERS)('the %s tab lists every project when none is archived, a colour included', async (_name, label, tabName) => {
      seed(['A', 'B'], [], { A: 'blue' }, releasesFor(['A', 'B']));
      await renderPage();
      fireEvent.click(tab(tabName));
      expect(optionNames(await picker(label))).toEqual(['A', 'B']);
    });

    it.each([
      { archived: ['A'], selected: 'B', where: 'past the first' },
      { archived: ['A', 'B'], selected: 'C', where: 'past the first two' },
      { archived: ['B'], selected: 'A', where: 'the first is not archived' },
    ])('the selection starts on the first unarchived project: $where', async ({ archived, selected }) => {
      seed(['A', 'B', 'C'], archived);
      await renderPage();
      fireEvent.click(tab('Releases'));
      expect(await picker(RELEASES_PICKER)).toHaveValue(selected);
    });

    it.each(PICKERS)('archiving the selected project moves the selection on the %s tab', async (_name, label, tabName) => {
      seed(['A', 'B', 'C'], [], {}, releasesFor(['A', 'B', 'C']));
      await renderPage();
      fireEvent.click(tab(tabName));
      fireEvent.change(await picker(label), { target: { value: 'B' } });
      fireEvent.click(tab('Projects'));
      await screen.findByRole('button', { name: 'New Project' });

      fireEvent.click(tileButton('B', 'Archive project'));
      fireEvent.click(tab(tabName));
      const select = await picker(label);
      expect(select).toHaveValue('A');
      expect(optionNames(select)).toEqual(['A', 'C']);
      // A select shows its first option for a value it does not list, so the
      // releases on show are what prove the selection moved.
      expect(await screen.findByText('A release')).toBeInTheDocument();
      expect(screen.queryByText('B release')).toBeNull();
    });

    it('with every project archived, the Releases tab says so', async () => {
      seed(['A', 'B'], ['A', 'B']);
      await renderPage();
      fireEvent.click(tab('Releases'));
      expect(await screen.findByText(ALL_ARCHIVED_ELSEWHERE)).toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: RELEASES_PICKER })).toBeNull();
      expect(screen.queryByText('No projects yet. Create a project first!')).toBeNull();
    });

    it('with every project archived, the Gantt Chart tab says so', async () => {
      seed(['A', 'B'], ['A', 'B']);
      await renderPage();
      fireEvent.click(tab('Gantt Chart'));
      expect(await screen.findByText(ALL_ARCHIVED_ELSEWHERE)).toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: CHART_PICKER })).toBeNull();
    });

    it('with no projects at all, neither tab says it', async () => {
      await renderPage();
      fireEvent.click(tab('Releases'));
      expect(await screen.findByText('No projects yet. Create a project first!')).toBeInTheDocument();
      expect(screen.queryByText(ALL_ARCHIVED_ELSEWHERE)).toBeNull();

      fireEvent.click(tab('Gantt Chart'));
      await screen.findByRole('button', { name: 'Gantt Chart' });
      expect(screen.queryByText(ALL_ARCHIVED_ELSEWHERE)).toBeNull();
      expect(screen.queryByRole('combobox', { name: CHART_PICKER })).toBeNull();
    });

    it('Settings still lists every project for export, archived included', async () => {
      seed(['A', 'B'], ['B']);
      await renderPage();
      fireEvent.click(tab('Settings'));
      expect(await screen.findByRole('checkbox', { name: 'Select A for export' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Select B for export' })).toBeInTheDocument();
    });
  });

  describe('new projects', () => {
    it('New Project adds an unarchived, uncoloured project, and leaves others as they were', async () => {
      seed(['A', 'B'], ['B'], { A: 'blue' });
      await renderPage();
      const before = stored().projectPrefs;
      fireEvent.click(newProject());
      fireEvent.change(screen.getByLabelText(/Project Name/i), { target: { value: 'Fresh' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create' }));

      expect(await screen.findByRole('button', { name: 'Open releases for Fresh' })).toBeInTheDocument();
      expect(tileOf('Fresh')).toHaveAttribute('data-color', 'none');
      expect(stored().projectPrefs).toEqual(before);
    });

    it('Load Sample adds an unarchived, uncoloured project', async () => {
      seed(['A'], ['A']);
      await renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Load Sample' }));
      await picker(CHART_PICKER);
      const added = stored().projects.find(p => p.name !== 'A')!;
      expect(stored().projectPrefs).toEqual({ A: { archived: true } });
      expect(added).toBeDefined();
    });
  });

  describe('when nothing can be saved', () => {
    const REFUSED = (what: string) =>
      `${what} Your cloud data did not load, so changes cannot be saved. Reload the page to try again.`;

    beforeEach(() => {
      vi.spyOn(LocalGanttStorageService.prototype, 'canWrite').mockReturnValue(false);
    });

    it('a colour pick changes nothing on screen, moves no focus and says nothing', async () => {
      seed(['A', 'B'], [], { A: 'blue' });
      await renderPage();
      fireEvent.click(colorIcon('A'));
      const checked = screen.getByRole('radio', { name: 'Blue' });
      expect(checked).toHaveFocus();
      const before = localStorage.getItem('ganttAppData');

      fireEvent.click(screen.getByRole('radio', { name: 'Pink' }));

      expect(window.alert).toHaveBeenCalledWith(REFUSED("This project's tile color was not changed."));
      expect(tileOf('A')).toHaveAttribute('data-color', 'blue');
      expect(checked).toBeChecked();
      expect(checked).toHaveFocus();
      expect(popover()).not.toBeNull();
      expect(status()).toBe('');
      expect(localStorage.getItem('ganttAppData')).toBe(before);
    });

    it('Archive changes nothing on screen, moves no focus and says nothing', async () => {
      seed(['A', 'B']);
      await renderPage();
      const archive = tileButton('A', 'Archive project');
      archive.focus();
      const before = localStorage.getItem('ganttAppData');

      fireEvent.click(archive);

      expect(window.alert).toHaveBeenCalledWith(REFUSED('This project was not archived.'));
      expect(shownNames()).toEqual(['A', 'B']);
      expect(archive).toHaveFocus();
      expect(status()).toBe('');
      expect(filter()).toBeNull();
      expect(localStorage.getItem('ganttAppData')).toBe(before);
    });

    it('Unarchive changes nothing on screen, moves no focus and says nothing', async () => {
      seed(['A', 'B'], ['A']);
      await renderPage();
      fireEvent.click(filter()!);
      const unarchive = tileButton('A', 'Unarchive project');
      unarchive.focus();
      const before = localStorage.getItem('ganttAppData');

      fireEvent.click(unarchive);

      expect(window.alert).toHaveBeenCalledWith(REFUSED('This project was not unarchived.'));
      expect(tileOf('A')).toHaveClass('pt-archived');
      expect(unarchive).toHaveFocus();
      expect(status()).toBe('');
      expect(localStorage.getItem('ganttAppData')).toBe(before);
    });

    it('a click on an archived tile neither unarchives nor navigates, and the page says nothing', async () => {
      seed(['A', 'B'], ['A']);
      await renderPage();
      fireEvent.click(filter()!);
      const before = localStorage.getItem('ganttAppData');

      fireEvent.click(openButton('A'));

      expect(window.alert).toHaveBeenCalledWith(REFUSED('This project was not unarchived.'));
      expect(screen.queryByRole('combobox', { name: RELEASES_PICKER })).toBeNull();
      expect(tileOf('A')).toHaveClass('pt-archived');
      expect(pageMessage()).toBe('');
      expect(localStorage.getItem('ganttAppData')).toBe(before);
    });
  });
});
