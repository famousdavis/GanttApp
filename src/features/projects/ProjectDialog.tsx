// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// ProjectDialog — the modal New Project / Edit Project form.
//
// Rendered into document.body; while it is open every other child of body is
// `inert`, so the page behind can be neither reached nor read. Focus starts in
// Project Name, Tab and Shift+Tab wrap at the ends, Escape and Cancel close it,
// Enter in a text field or Ctrl/Cmd+S anywhere in it saves. On close, focus
// goes back to what opened it. Its errors live here, so they end with it.

import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { WorkWeekSelector } from '../../shared/components/WorkWeekSelector';
import { getWorkDayWarning, isProjectNameValid } from '../../shared/utils';
import { modalSurfaceProps } from '../../shared/utils/modalSurface';
import type { ThemeColors } from '../../shared/utils/theme';
import { paletteStyle, patchedColors } from './projectsTabPalette';
import type { ProjectsTabPalette } from './projectsTabPalette';

export const NAME_REQUIRED = 'Enter a project name.';

/** Today's finish-date checks: '' when the value may be saved. */
export function finishDateError(date: string): string {
  if (date === '') return '';
  if (date.length !== 10) return 'Please enter a complete date';
  if (date < '2000-01-01' || date > '2050-12-31') return 'Date must be between 2000 and 2050';
  return '';
}

export interface ProjectDialogProps {
  mode: 'new' | 'edit';
  name: string;
  onNameChange: (name: string) => void;
  finishDate: string;
  onFinishDateChange: (date: string) => void;
  workDays: number[] | undefined;
  onWorkDaysChange: (days: number[] | undefined) => void;
  globalWorkDays: number[] | undefined;
  /** Called only when the fields pass their checks. */
  onSave: () => void;
  onCancel: () => void;
  /** Where focus goes on close: what opened the dialog, if it is still there. */
  returnFocusTo: () => HTMLElement | null;
  colors: ThemeColors;
  palette: ProjectsTabPalette;
}

const FOCUSABLE = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])';

/** Make every other child of body inert; returns the undo. */
function inertOthers(keep: HTMLElement): () => void {
  const changed = Array.from(document.body.children).filter(
    (el): el is HTMLElement => el instanceof HTMLElement && el !== keep && !el.hasAttribute('inert'),
  );
  changed.forEach((el) => el.setAttribute('inert', ''));
  return () => changed.forEach((el) => el.removeAttribute('inert'));
}

/** Tab and Shift+Tab wrap at the dialog's ends; elsewhere the browser moves focus. */
function wrapTab(e: KeyboardEvent, root: HTMLElement) {
  const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const inside = active instanceof HTMLElement && root.contains(active);
  if (e.shiftKey && (active === first || !inside)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (active === last || !inside)) {
    e.preventDefault();
    first.focus();
  }
}

export function ProjectDialog({
  mode,
  name,
  onNameChange,
  finishDate,
  onFinishDateChange,
  workDays,
  onWorkDaysChange,
  globalWorkDays,
  onSave,
  onCancel,
  returnFocusTo,
  colors,
  palette,
}: ProjectDialogProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const nameId = `${baseId}-name`;
  const nameErrorId = `${baseId}-name-error`;
  const dateId = `${baseId}-finish-date`;
  const dateMsgId = `${baseId}-finish-date-msg`;
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const [nameError, setNameError] = useState('');
  const [dateError, setDateError] = useState('');
  const isEdit = mode === 'edit';

  const effectiveDays = workDays && workDays.length > 0 ? workDays : globalWorkDays;
  const dateWarning = finishDate && !dateError ? getWorkDayWarning(finishDate, effectiveDays) : '';

  const save = () => {
    const nameMsg = isProjectNameValid(name) ? '' : NAME_REQUIRED;
    const dateMsg = finishDateError(finishDate);
    setNameError(nameMsg);
    setDateError(dateMsg);
    if (nameMsg) {
      nameRef.current?.focus();
      return;
    }
    if (dateMsg) {
      dateRef.current?.focus();
      return;
    }
    onSave();
  };

  // The latest handlers, read by the document listener at key time.
  const handlersRef = useRef({ save, onCancel });
  useEffect(() => {
    handlersRef.current = { save, onCancel };
  });
  const returnFocusRef = useRef(returnFocusTo);
  useEffect(() => {
    returnFocusRef.current = returnFocusTo;
  });

  // Open: background inert, focus to Project Name. Close: inert removed first,
  // then focus back to the opener.
  useEffect(() => {
    const overlay = overlayRef.current;
    const undoInert = overlay ? inertOthers(overlay) : () => {};
    nameRef.current?.focus();
    if (isEdit) nameRef.current?.select();
    return () => {
      undoInert();
      returnFocusRef.current()?.focus();
    };
  }, [isEdit]);

  // Capture phase: this dialog's keys never reach the page's shortcuts or a
  // document listener belonging to a surface behind it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const root = dialogRef.current;
      if (!root) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handlersRef.current.onCancel();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        handlersRef.current.save();
        return;
      }
      if (e.key === 'Tab') wrapTab(e, root);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  const saveOnEnter = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    save();
  };

  const dateMessage = dateError || (dateWarning ? `⚠ ${dateWarning}` : '');

  return createPortal(
    <div ref={overlayRef} {...modalSurfaceProps} className="pt-overlay" style={paletteStyle(palette)}>
      <div
        ref={dialogRef}
        className="pt-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h3 id={titleId}>{isEdit ? 'Edit Project' : 'New Project'}</h3>
        <div className="pt-field">
          <label htmlFor={nameId}>Project Name</label>
          <input
            ref={nameRef}
            id={nameId}
            className="pt-input"
            name="projectName"
            type="text"
            placeholder="Project name"
            autoComplete="off"
            maxLength={100}
            aria-required="true"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? nameErrorId : undefined}
            value={name}
            onChange={(e) => {
              onNameChange(e.target.value);
              if (isProjectNameValid(e.target.value)) setNameError('');
            }}
            onKeyDown={saveOnEnter}
          />
          {nameError && (
            <p id={nameErrorId} role="alert" className="pt-field-msg pt-error">{nameError}</p>
          )}
        </div>
        <div className="pt-field">
          <label htmlFor={dateId}>
            Finish Date <span className="pt-opt">(Optional)</span>
          </label>
          <input
            ref={dateRef}
            id={dateId}
            className={`pt-input pt-date${finishDate ? ' has-value' : ''}`}
            name="projectFinishDate"
            type="date"
            autoComplete="off"
            min="2000-01-01"
            max="2050-12-31"
            aria-invalid={dateError ? true : undefined}
            aria-describedby={dateMsgId}
            value={finishDate}
            onChange={(e) => {
              onFinishDateChange(e.target.value);
              setDateError(''); // Clear the error while typing, as before.
            }}
            onBlur={(e) => setDateError(finishDateError(e.target.value))}
            onKeyDown={saveOnEnter}
          />
          <p
            id={dateMsgId}
            aria-live="polite"
            className={`pt-field-msg${dateError ? ' pt-error' : dateWarning ? ' pt-warn' : ''}`}
          >
            {dateMessage}
          </p>
        </div>
        <fieldset className="pt-field">
          <legend>
            Work Week <span className="pt-opt">(Optional Override)</span>
          </legend>
          <WorkWeekSelector
            value={workDays}
            onChange={onWorkDaysChange}
            // Unselected chips take the dialog's own background, so a selected
            // chip's blue stands 3:1 against them in each theme.
            colors={{ ...patchedColors(colors, palette), inputBg: palette.surface }}
            placeholder="Uses global default"
            allowReset={workDays !== undefined}
            onReset={() => onWorkDaysChange(undefined)}
            fallbackDays={globalWorkDays}
            linkColor={palette.link}
          />
        </fieldset>
        <div className="pt-dlg-buttons">
          <button type="button" className="pt-btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="pt-btn pt-btn-primary" onClick={save}>
            {isEdit ? 'Update' : 'Create'}
          </button>
        </div>
        <p className="pt-kbd-hint">Enter or Ctrl+S (Cmd+S) saves. Esc cancels.</p>
      </div>
    </div>,
    document.body,
  );
}
