// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The project dialog on its own: its semantics, focus, inert page, keys,
// checks and messages. The Projects tab's own tests cover what it saves.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { ProjectDialog, finishDateError, NAME_REQUIRED } from '../ProjectDialog';
import type { ProjectDialogProps } from '../ProjectDialog';
import { projectsTabPalette } from '../projectsTabPalette';
import { LIGHT_THEME } from '../../../shared/utils/theme';

type Overrides = Partial<ProjectDialogProps> & { initialName?: string; initialDate?: string };

/** The dialog with its draft held in state, as the tab holds it. */
function Harness({ initialName = '', initialDate = '', ...props }: Overrides) {
  const [name, setName] = useState(initialName);
  const [date, setDate] = useState(initialDate);
  const [days, setDays] = useState<number[] | undefined>(props.workDays);
  return (
    <ProjectDialog
      mode="new"
      name={name}
      onNameChange={setName}
      finishDate={date}
      onFinishDateChange={setDate}
      onWorkDaysChange={setDays}
      globalWorkDays={[1, 2, 3, 4, 5]}
      onSave={vi.fn()}
      onCancel={vi.fn()}
      returnFocusTo={() => null}
      colors={LIGHT_THEME}
      palette={projectsTabPalette('light')}
      {...props}
      workDays={days}
    />
  );
}

const dialog = () => screen.getByRole('dialog');
const nameField = () => screen.getByLabelText('Project Name') as HTMLInputElement;
const dateField = () => screen.getByLabelText(/Finish Date/) as HTMLInputElement;
const key = (target: Element, init: KeyboardEventInit) =>
  fireEvent.keyDown(target, { bubbles: true, cancelable: true, ...init });

afterEach(() => {
  document.body.querySelectorAll('[data-extra]').forEach(el => el.remove());
});

describe('finishDateError', () => {
  it.each([
    ['', ''],
    ['2026-06-15', ''],
    ['2000-01-01', ''],
    ['2050-12-31', ''],
    ['1999-12-31', 'Date must be between 2000 and 2050'],
    ['2051-01-01', 'Date must be between 2000 and 2050'],
    ['20260-01-01', 'Please enter a complete date'],
  ])('%s → %s', (date, message) => {
    expect(finishDateError(date)).toBe(message);
  });
});

describe('ProjectDialog', () => {
  it('is a modal dialog named by its title, with focus in Project Name', () => {
    render(<Harness />);
    expect(dialog()).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('dialog', { name: 'New Project' })).toBe(dialog());
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
    expect(nameField()).toHaveFocus();
    expect(nameField()).toHaveAttribute('name', 'projectName');
    expect(dateField()).toHaveAttribute('name', 'projectFinishDate');
    expect(dialog().closest('[data-modal-surface]')).not.toBeNull();
  });

  it('in edit mode is titled Edit Project, offers Update, and selects the name', () => {
    render(<Harness mode="edit" initialName="Alpha" />);
    expect(screen.getByRole('dialog', { name: 'Edit Project' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create' })).toBeNull();
    expect(nameField()).toHaveFocus();
    expect([nameField().selectionStart, nameField().selectionEnd]).toEqual([0, 5]);
  });

  it('opens with no error, and the field is not marked invalid', () => {
    render(<Harness initialName="" initialDate="1999-01-01" />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(nameField()).not.toHaveAttribute('aria-invalid');
    expect(dateField()).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText(/Date must be between/)).toBeNull();
  });

  it('makes every other child of the page inert while open, and restores only what it changed', () => {
    const before = document.createElement('div');
    before.setAttribute('data-extra', 'a');
    const alreadyInert = document.createElement('div');
    alreadyInert.setAttribute('data-extra', 'b');
    alreadyInert.setAttribute('inert', '');
    document.body.append(before, alreadyInert);

    const view = render(<Harness />);
    const overlay = dialog().closest('[data-modal-surface]')!;
    const others = Array.from(document.body.children).filter(el => el !== overlay);
    expect(others.length).toBeGreaterThanOrEqual(3); // RTL's container and the two above
    others.forEach(el => expect(el).toHaveAttribute('inert'));
    expect(overlay).not.toHaveAttribute('inert');

    view.unmount();
    expect(before).not.toHaveAttribute('inert');
    expect(alreadyInert).toHaveAttribute('inert');
  });

  it('Tab from the last control wraps to the first, and Shift+Tab from the first to the last', () => {
    render(<Harness />);
    const create = screen.getByRole('button', { name: 'Create' });
    create.focus();
    key(create, { key: 'Tab' });
    expect(nameField()).toHaveFocus();
    key(nameField(), { key: 'Tab', shiftKey: true });
    expect(create).toHaveFocus();
  });

  it('Tab between the ends is left to the browser', () => {
    render(<Harness />);
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    cancel.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    cancel.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(cancel).toHaveFocus();
  });

  it('the wrap counts every control: with Reset to default showing, Shift+Tab from the name still lands on Create', () => {
    render(<Harness workDays={[0, 6]} />);
    expect(screen.getByRole('button', { name: 'Reset to default' })).toBeInTheDocument();
    key(nameField(), { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Create' })).toHaveFocus();
  });

  it('Escape cancels, from a field, and goes no further', () => {
    const onCancel = vi.fn();
    const below = vi.fn();
    document.addEventListener('keydown', below);
    render(<Harness onCancel={onCancel} />);
    key(nameField(), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(below).not.toHaveBeenCalled();
    document.removeEventListener('keydown', below);
  });

  it.each([
    { label: 'Ctrl+S', init: { key: 's', ctrlKey: true } },
    { label: 'Cmd+S', init: { key: 's', metaKey: true } },
    { label: 'Ctrl+Shift+S', init: { key: 'S', ctrlKey: true, shiftKey: true } },
  ])('$label saves from inside a field, and goes no further', ({ init }) => {
    const onSave = vi.fn();
    const below = vi.fn();
    document.addEventListener('keydown', below);
    render(<Harness onSave={onSave} initialName="Alpha" />);
    key(dateField(), init);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(below).not.toHaveBeenCalled();
    document.removeEventListener('keydown', below);
  });

  it('S without Ctrl or Cmd is only a letter', () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} initialName="Alpha" />);
    key(nameField(), { key: 's' });
    expect(onSave).not.toHaveBeenCalled();
  });

  it.each(['name', 'date'] as const)('Enter in the %s field saves', (which) => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} initialName="Alpha" />);
    key(which === 'name' ? nameField() : dateField(), { key: 'Enter' });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('an empty name is refused with a message, the field marked, and focus kept there', () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} initialName="  " />);
    screen.getByRole('button', { name: 'Cancel' }).focus();
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(NAME_REQUIRED);
    expect(nameField()).toHaveAttribute('aria-invalid', 'true');
    expect(nameField()).toHaveAccessibleDescription(NAME_REQUIRED);
    expect(nameField()).toHaveFocus();
  });

  it('a bad date is refused with its message, the field marked, and focus moved to it', () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} initialName="Alpha" initialDate="2051-01-01" />);
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(dateField()).toHaveAttribute('aria-invalid', 'true');
    expect(dateField()).toHaveAccessibleDescription('Date must be between 2000 and 2050');
    expect(dateField()).toHaveFocus();
  });

  it('a name error is shown before a date error, and focus goes to the name', () => {
    render(<Harness initialName="" initialDate="2051-01-01" />);
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(nameField()).toHaveFocus();
    expect(nameField()).toHaveAttribute('aria-invalid', 'true');
    expect(dateField()).toHaveAttribute('aria-invalid', 'true');
  });

  it.each([
    { label: 'the global Monday-to-Friday week', global: [1, 2, 3, 4, 5], own: undefined, date: '2026-06-13', warns: 'Saturday' },
    { label: 'a global Sunday-to-Thursday week', global: [0, 1, 2, 3, 4], own: undefined, date: '2026-06-12', warns: 'Friday' },
    { label: 'a global Sunday-to-Thursday week, on a Sunday', global: [0, 1, 2, 3, 4], own: undefined, date: '2026-06-14', warns: null },
    { label: "the project's own week over the global one", global: [0, 1, 2, 3, 4, 5, 6], own: [1, 2, 3, 4, 5], date: '2026-06-13', warns: 'Saturday' },
  ])('warns of a non-working day politely, by $label', ({ global, own, date, warns }) => {
    render(<Harness globalWorkDays={global} workDays={own} initialName="Alpha" initialDate={date} />);
    const message = document.getElementById(dateField().getAttribute('aria-describedby')!)!;
    expect(message).toHaveAttribute('aria-live', 'polite');
    if (warns) {
      expect(message).toHaveTextContent(`⚠ Falls on ${warns}, which is outside your work week.`);
    } else {
      expect(message).toHaveTextContent('');
    }
  });

  it('closing returns focus to what opened it, or to nothing when it has gone', () => {
    const opener = document.createElement('button');
    opener.setAttribute('data-extra', 'opener');
    document.body.append(opener);
    const view = render(<Harness returnFocusTo={() => opener} />);
    expect(opener).not.toHaveFocus();
    view.unmount();
    expect(opener).toHaveFocus();
    expect(opener).not.toHaveAttribute('inert');

    opener.blur();
    const gone = render(<Harness returnFocusTo={() => null} />);
    gone.unmount();
    expect(document.activeElement).toBe(document.body);
  });
});
