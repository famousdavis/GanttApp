// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The project form on the Projects tab: its finish-date checks, its keyboard
// shortcuts, its Add and Update buttons, and its work-week chips. Every test
// renders the real tab inside the real providers (local storage mode) and
// asserts what the user sees and what is saved to `ganttAppData`.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReactNode } from 'react';
import { AppDataProvider } from '../../../context/AppDataContext';
import { StorageProvider } from '../../../context/StorageContext';
import { AuthProvider } from '../../../context/AuthContext';
import { ThemeProvider } from '../../../context/ThemeContext';
import { ProjectsTab } from '../ProjectsTab';
import { AppData } from '../../../shared/types/app';
import { Project } from '../../../shared/types/models';

// Mock firebase modules
vi.mock('../../../lib/firebase', () => ({
  auth: null,
  db: null,
  isFirebaseAvailable: false,
  getSendInvitationEmail: () => null,
  getClaimPendingInvitations: () => null,
  getRevokeInvite: () => null,
  getResendInvite: () => null,
}));

const mockOnAuthStateChanged = vi.fn();
vi.mock('firebase/auth', () => {
  class MockGoogleAuthProvider { addScope = vi.fn(); }
  class MockOAuthProvider { addScope = vi.fn(); constructor(_id: string) {} }
  return {
    onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    GoogleAuthProvider: MockGoogleAuthProvider,
    OAuthProvider: MockOAuthProvider,
  };
});

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  collection: vi.fn(),
  writeBatch: vi.fn(() => ({ set: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) })),
}));

const RANGE_ERROR = 'Date must be between 2000 and 2050';
const INCOMPLETE_ERROR = 'Please enter a complete date';
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

// A project that is always present, so each test can wait for its tile and
// know the stored data has loaded before it touches the form.
const SENTINEL: Project = { id: 'p-sentinel', name: 'Sentinel' };

function seedData(data: AppData) {
  localStorage.setItem('ganttAppData', JSON.stringify(data));
}

function TestWrapper({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <StorageProvider>
        <ThemeProvider>
          <AppDataProvider>
            {children}
          </AppDataProvider>
        </ThemeProvider>
      </StorageProvider>
    </AuthProvider>
  );
}

function renderProjectsTab(props: Partial<React.ComponentProps<typeof ProjectsTab>> = {}) {
  const defaultProps = {
    selectedProjectId: 'p-sentinel',
    setSelectedProjectId: vi.fn(),
    setActiveTab: vi.fn(),
    draggedProjectId: null,
    onProjectDragStart: vi.fn(),
    onProjectDragOver: vi.fn(),
    onProjectDragEnd: vi.fn(),
    onReplaceSnapshots: vi.fn().mockResolvedValue(undefined),
    ...props,
  };

  return {
    ...render(
      <TestWrapper>
        <ProjectsTab {...defaultProps} />
      </TestWrapper>
    ),
    props: defaultProps,
  };
}

/** Seed the stored data, render the tab, and wait until the stored projects are on screen. */
async function renderLoaded(
  data: Partial<AppData> & { projects: Project[] },
  props: Partial<React.ComponentProps<typeof ProjectsTab>> = {},
) {
  seedData({ releases: [], ...data });
  const result = renderProjectsTab(props);
  await screen.findByRole('button', { name: `Open releases for ${data.projects[0].name}` });
  return result;
}

function nameInput(): HTMLInputElement {
  return screen.getByPlaceholderText('Project name') as HTMLInputElement;
}

function dateInput(): HTMLInputElement {
  return screen.getByLabelText(/Finish Date/) as HTMLInputElement;
}

function typeName(value: string) {
  fireEvent.change(nameInput(), { target: { value } });
}

function setFinishDate(value: string) {
  fireEvent.change(dateInput(), { target: { value } });
}

function leaveFinishDate() {
  fireEvent.blur(dateInput());
}

function addButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Add Project' }) as HTMLButtonElement;
}

function updateButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Update' }) as HTMLButtonElement;
}

function startEdit() {
  fireEvent.click(screen.getByRole('button', { name: 'Edit project' }));
}

// Shortcuts other than Escape are ignored while an input has the event, so
// they are sent from the page body, as when no field is focused.
function pressCtrlS() {
  fireEvent.keyDown(document.body, { key: 's', ctrlKey: true });
}

function pressEscape() {
  fireEvent.keyDown(document.body, { key: 'Escape' });
}

function chip(day: string): HTMLButtonElement {
  return screen.getByRole('button', { name: day }) as HTMLButtonElement;
}

function pressedDays(): string[] {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    .filter(day => chip(day).getAttribute('aria-pressed') === 'true');
}

function storedProjects(): Project[] {
  return JSON.parse(localStorage.getItem('ganttAppData')!).projects;
}

function storedProject(id: string): Project | undefined {
  return storedProjects().find(p => p.id === id);
}

describe('ProjectsTab form', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: null) => void) => {
      callback(null);
      return vi.fn();
    });
    // The Edit pencil scrolls the page; jsdom does not implement scrolling.
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('finish date checks', () => {
    // Browsers report an unfinished date as an empty value, so a value whose
    // length is not ten reaches this check only as a year of five or more
    // digits. The plain string comparison with 2000 and 2050 alone would let
    // such a year through: "20260-01-01" sorts between the two bounds.
    it('refuses a finish date whose year has five digits, with the complete-date message', async () => {
      await renderLoaded({ projects: [SENTINEL] });
      typeName('Orion');
      setFinishDate('20260-01-01');
      expect(dateInput().value).toBe('20260-01-01');
      leaveFinishDate();

      expect(screen.getByText(INCOMPLETE_ERROR)).toBeInTheDocument();
      expect(screen.queryByText(RANGE_ERROR)).toBeNull();
      expect(addButton()).toBeDisabled();
    });

    it('refuses a finish date after 2050 with the range message, and accepts the last day of 2050', async () => {
      await renderLoaded({ projects: [SENTINEL] });
      typeName('Orion');
      setFinishDate('2051-01-01');
      leaveFinishDate();

      expect(screen.getByText(RANGE_ERROR)).toBeInTheDocument();
      expect(addButton()).toBeDisabled();

      setFinishDate('2050-12-31');
      leaveFinishDate();
      expect(addButton()).toBeEnabled();
      expect(screen.queryByText(RANGE_ERROR)).toBeNull();
    });

    // Starting an edit does not clear an error left over from the add form,
    // so the loaded date can sit under that error until the field is left.
    // This test relies only on the re-check when the field is left; it does
    // not assert what is shown before that.
    it('leaving the date field re-checks a valid loaded date and clears the earlier error', async () => {
      await renderLoaded({ projects: [{ id: 'p1', name: 'Alpha', finishDate: '2026-06-15' }] });
      setFinishDate('1999-01-01');
      leaveFinishDate();
      expect(screen.getByText(RANGE_ERROR)).toBeInTheDocument();

      startEdit();
      expect(dateInput().value).toBe('2026-06-15');
      leaveFinishDate();

      expect(updateButton()).toBeEnabled();
      expect(screen.queryByText(RANGE_ERROR)).toBeNull();
    });

    it('changing the date clears the error before the field is left', async () => {
      await renderLoaded({ projects: [SENTINEL] });
      typeName('Orion');
      setFinishDate('1999-01-01');
      leaveFinishDate();
      expect(screen.getByText(RANGE_ERROR)).toBeInTheDocument();

      setFinishDate('2026-06-16');

      expect(dateInput().value).toBe('2026-06-16');
      expect(addButton()).toBeEnabled();
      expect(screen.queryByText(RANGE_ERROR)).toBeNull();
    });
  });

  describe('Add and Update buttons', () => {
    it('a finish-date error alone disables Add, and Add then saves nothing', async () => {
      await renderLoaded({ projects: [SENTINEL] });
      typeName('Delta');
      expect(addButton()).toBeEnabled();

      setFinishDate('2051-03-01');
      leaveFinishDate();
      expect(screen.getByText(RANGE_ERROR)).toBeInTheDocument();
      expect(addButton()).toBeDisabled();

      fireEvent.click(addButton());
      expect(nameInput().value).toBe('Delta');
      expect(storedProjects().map(p => p.name)).toEqual(['Sentinel']);
    });

    it('Add is disabled until the name holds more than spaces', async () => {
      await renderLoaded({ projects: [SENTINEL] });
      expect(addButton()).toBeDisabled();

      typeName('   ');
      expect(addButton()).toBeDisabled();

      typeName('Gamma');
      expect(addButton()).toBeEnabled();
    });

    it('Update saves the edited name and finish date to the same project', async () => {
      await renderLoaded({ projects: [{ id: 'p1', name: 'Alpha', finishDate: '2026-06-15' }] });
      startEdit();
      typeName('Alpha Two');
      setFinishDate('2026-07-15');
      leaveFinishDate();

      fireEvent.click(updateButton());

      expect(screen.getByRole('button', { name: 'Open releases for Alpha Two' })).toBeInTheDocument();
      expect(storedProjects()).toEqual([{ id: 'p1', name: 'Alpha Two', finishDate: '2026-07-15' }]);
      expect(addButton()).toBeInTheDocument();
      expect(nameInput().value).toBe('');
    });

    it('Update is disabled while the finish date is invalid, and then saves nothing', async () => {
      await renderLoaded({ projects: [{ id: 'p1', name: 'Alpha', finishDate: '2026-06-15' }] });
      startEdit();
      expect(updateButton()).toBeEnabled();

      setFinishDate('1999-12-31');
      leaveFinishDate();
      expect(screen.getByText(RANGE_ERROR)).toBeInTheDocument();
      expect(updateButton()).toBeDisabled();

      fireEvent.click(updateButton());
      expect(updateButton()).toBeInTheDocument();
      expect(storedProject('p1')?.finishDate).toBe('2026-06-15');
    });
  });

  describe('keyboard shortcuts', () => {
    it('Escape leaves an edit without saving it', async () => {
      await renderLoaded({ projects: [{ id: 'p1', name: 'Alpha' }] });
      startEdit();
      typeName('Alpha Draft');
      expect(updateButton()).toBeInTheDocument();

      pressEscape();

      expect(addButton()).toBeInTheDocument();
      expect(nameInput().value).toBe('');
      expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
      expect(storedProject('p1')?.name).toBe('Alpha');
    });

    it('Ctrl+S saves an open edit', async () => {
      await renderLoaded({ projects: [{ id: 'p1', name: 'Alpha' }] });
      startEdit();
      typeName('Alpha Saved');

      pressCtrlS();

      expect(screen.getByRole('button', { name: 'Open releases for Alpha Saved' })).toBeInTheDocument();
      expect(storedProjects()).toEqual([{ id: 'p1', name: 'Alpha Saved' }]);
      expect(addButton()).toBeInTheDocument();
    });

    it('Ctrl+S adds the project in the form when no edit is open, and selects it when none is selected', async () => {
      const { props } = await renderLoaded({ projects: [SENTINEL] }, { selectedProjectId: '' });
      typeName('Gamma');
      setFinishDate('2026-07-15');
      leaveFinishDate();

      pressCtrlS();

      expect(screen.getByRole('button', { name: 'Open releases for Gamma' })).toBeInTheDocument();
      expect(storedProjects().map(p => [p.name, p.finishDate])).toEqual([
        ['Sentinel', undefined],
        ['Gamma', '2026-07-15'],
      ]);
      expect(nameInput().value).toBe('');
      const gammaId = storedProjects()[1].id;
      expect(gammaId).not.toBe(SENTINEL.id);
      expect(props.setSelectedProjectId).toHaveBeenCalledWith(gammaId);
    });

    it('Ctrl+S adds nothing while the finish date is invalid', async () => {
      await renderLoaded({ projects: [SENTINEL] });
      typeName('Gamma');
      setFinishDate('2051-01-01');
      leaveFinishDate();
      expect(screen.getByText(RANGE_ERROR)).toBeInTheDocument();

      pressCtrlS();
      expect(nameInput().value).toBe('Gamma');
      expect(storedProjects().map(p => p.name)).toEqual(['Sentinel']);

      // The same keystroke adds once the date is valid, so it did reach the form.
      setFinishDate('2026-07-15');
      leaveFinishDate();
      pressCtrlS();
      expect(storedProjects().map(p => [p.name, p.finishDate])).toEqual([
        ['Sentinel', undefined],
        ['Gamma', '2026-07-15'],
      ]);
    });

    it('Ctrl+S saves no edit while the finish date is invalid', async () => {
      await renderLoaded({ projects: [{ id: 'p1', name: 'Alpha', finishDate: '2026-06-15' }] });
      startEdit();
      setFinishDate('1999-12-31');
      leaveFinishDate();
      expect(screen.getByText(RANGE_ERROR)).toBeInTheDocument();

      pressCtrlS();
      expect(updateButton()).toBeInTheDocument();
      expect(storedProject('p1')?.finishDate).toBe('2026-06-15');

      // The same keystroke saves once the date is valid, so it did reach the form.
      setFinishDate('2026-07-15');
      leaveFinishDate();
      pressCtrlS();
      expect(storedProject('p1')?.finishDate).toBe('2026-07-15');
    });

    // Known defect: Enter in the name field adds or updates without the
    // validity check that Ctrl+S and the buttons apply (the name field's
    // onKeyDown in ProjectsTab.tsx), so the finish-date checks are bypassed and
    // an out-of-range date can be saved by pressing Enter. This test uses a
    // valid form only. A fix that adds the check should leave it passing and
    // add a test that Enter with an invalid finish date saves nothing.
    it('Enter in the name field saves an open edit to the same project', async () => {
      await renderLoaded({ projects: [{ id: 'p1', name: 'Alpha' }] });
      startEdit();
      typeName('Alpha Entered');

      // Only Enter saves: another key in the field leaves the edit open.
      fireEvent.keyDown(nameInput(), { key: 'a' });
      expect(updateButton()).toBeInTheDocument();
      expect(storedProject('p1')?.name).toBe('Alpha');

      fireEvent.keyDown(nameInput(), { key: 'Enter' });

      expect(screen.getByRole('button', { name: 'Open releases for Alpha Entered' })).toBeInTheDocument();
      expect(storedProjects()).toEqual([{ id: 'p1', name: 'Alpha Entered' }]);
      expect(addButton()).toBeInTheDocument();
    });
  });

  describe('non-workday warning', () => {
    it('warns when the finish date falls outside the work week, and not on a workday', async () => {
      await renderLoaded({ projects: [SENTINEL] });
      setFinishDate('2026-06-13'); // a Saturday; the default work week is Monday to Friday

      expect(screen.getByText('⚠ Falls on Saturday, which is outside your work week.')).toBeInTheDocument();

      setFinishDate('2026-06-15'); // a Monday
      expect(dateInput().value).toBe('2026-06-15');
      expect(screen.queryByText(/outside your work week/)).toBeNull();
    });

    // The global work week has every day, so by it no date would warn; the
    // project being edited works Monday to Friday, so by it a Saturday does.
    it('follows the work week in the form, not the global one', async () => {
      await renderLoaded({
        globalWorkDays: EVERY_DAY,
        projects: [{ id: 'p1', name: 'Weekday Team', finishDate: '2026-06-13', workDays: [1, 2, 3, 4, 5] }],
      });
      startEdit();
      expect(dateInput().value).toBe('2026-06-13');

      expect(screen.getByText('⚠ Falls on Saturday, which is outside your work week.')).toBeInTheDocument();
    });
  });

  describe('work-week chips', () => {
    it('clicking day chips sets the work week saved with the new project', async () => {
      await renderLoaded({ projects: [SENTINEL] });
      typeName('Weekend Crew');
      fireEvent.click(chip('Saturday'));
      fireEvent.click(chip('Monday'));
      expect(pressedDays()).toEqual(['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);

      fireEvent.click(addButton());

      expect(screen.getByRole('button', { name: 'Open releases for Weekend Crew' })).toHaveTextContent('custom work week');
      expect(storedProjects().find(p => p.name === 'Weekend Crew')?.workDays).toEqual([2, 3, 4, 5, 6]);
    });

    it('the chips show the work week of the project being edited', async () => {
      await renderLoaded({ projects: [{ id: 'p1', name: 'Weekend Crew', workDays: [0, 6] }] });
      expect(pressedDays()).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);

      startEdit();

      expect(pressedDays()).toEqual(['Sunday', 'Saturday']);
      expect(screen.queryByText('Uses global default')).toBeNull();
    });

    // A Sunday-to-Thursday global work week, so it cannot be mistaken for the
    // Monday-to-Friday week the chips show when given nothing.
    it('with no work week in the form the chips show the global one, and a click starts from it', async () => {
      await renderLoaded({ globalWorkDays: [0, 1, 2, 3, 4], projects: [SENTINEL] });

      expect(pressedDays()).toEqual(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']);
      expect(screen.getByText('Uses global default')).toBeInTheDocument();

      typeName('Desert Office');
      fireEvent.click(chip('Saturday'));
      fireEvent.click(addButton());
      expect(storedProjects().find(p => p.name === 'Desert Office')?.workDays).toEqual([0, 1, 2, 3, 4, 6]);
    });

    it('Reset to default appears only once the form has its own work week', async () => {
      await renderLoaded({ projects: [SENTINEL] });
      expect(screen.getByText('Uses global default')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reset to default' })).toBeNull();

      fireEvent.click(chip('Saturday'));

      expect(screen.getByRole('button', { name: 'Reset to default' })).toBeInTheDocument();
    });

    it('Reset to default drops the work week of the edited project, and Update saves it without one', async () => {
      await renderLoaded({ projects: [{ id: 'p1', name: 'Weekend Crew', workDays: [0, 6] }] });
      startEdit();
      expect(pressedDays()).toEqual(['Sunday', 'Saturday']);

      fireEvent.click(screen.getByRole('button', { name: 'Reset to default' }));

      expect(pressedDays()).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
      expect(screen.getByText('Uses global default')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reset to default' })).toBeNull();

      fireEvent.click(updateButton());
      expect(storedProject('p1')).toEqual({ id: 'p1', name: 'Weekend Crew' });
      expect(screen.getByRole('button', { name: 'Open releases for Weekend Crew' })).not.toHaveTextContent('custom work week');
    });
  });
});
