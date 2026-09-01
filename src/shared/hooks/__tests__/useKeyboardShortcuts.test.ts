// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * useKeyboardShortcuts (v0.28.14 -- first tests for this hook).
 *
 * Before this file the hook measured 4.76% branch coverage: 1 of 21 outcomes,
 * and that one was the `enabled` default argument. `handleKeyDown` -- the whole
 * body of the hook -- had never executed once across the suite, despite being
 * wired into three screens, registering a global listener and swallowing
 * Ctrl/Cmd+S.
 *
 * THE FOUR BEHAVIOURS THAT ACTUALLY MATTER IN PRODUCTION, and why:
 *
 *   1. Escape fires even while the user is typing in an input. It is checked
 *      BEFORE the input-field guard, so it is the one shortcut that reaches a
 *      focused field.
 *   2. Escape does NOT preventDefault; every other matched shortcut does. This
 *      asymmetry is real and load-bearing -- see the `cancelable` note below.
 *   3. The escape early-return is conjunct on `shortcuts['escape']` EXISTING.
 *      Without it registered, Escape falls through to the normal path, so a
 *      registered `ctrl+escape` fires WITH preventDefault -- contradicting both
 *      1 and 2 in the one case nobody looks at.
 *   4. Key strings are built `ctrl+` then `shift+` then the lowercased key.
 *      Order is not commutative: `shift+ctrl+s` never matches anything.
 *
 * `enabled` is deliberately NOT first. All three production call sites pass a
 * single argument, so `enabled: false` is unreachable outside tests; covering it
 * protects the exported contract, not live behaviour.
 *
 * TWO CONSTRAINTS ON THIS FILE, both easy to break by accident:
 *
 *   - EXACTLY ONE test may set `shiftKey: true` (the `ctrl+shift+s` ordering
 *     test). Branch coverage is per-outcome, not per-test: with two shift tests,
 *     deleting either drops no branch, and a check that "removing the ordering
 *     test lowers coverage" silently reports no signal on a healthy suite. This
 *     is why behaviour 3 above is demonstrated with `ctrl+escape` rather than
 *     the more obvious `shift+escape`.
 *   - Events MUST be `cancelable: true`. On a non-cancelable event
 *     `preventDefault()` is a silent no-op and `defaultPrevented` stays false --
 *     which would make the behaviour-2 assertion pass for the wrong reason and
 *     hide the exact regression it exists to catch.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useKeyboardShortcuts, ShortcutMap } from '../useKeyboardShortcuts';

interface PressOptions {
  key: string;
  target?: EventTarget;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

/**
 * Dispatch a real keydown that bubbles to `window`, where the hook listens.
 * Returns the event so callers can read `defaultPrevented`.
 */
function press(options: PressOptions): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: options.key,
    ctrlKey: options.ctrlKey === true,
    metaKey: options.metaKey === true,
    shiftKey: options.shiftKey === true,
    bubbles: true,
    cancelable: true,
  });
  const target = options.target === undefined ? document.body : options.target;
  target.dispatchEvent(event);
  return event;
}

/** Append an element to the document so dispatched events bubble to window. */
function mount(tagName: string): HTMLElement {
  const element = document.createElement(tagName);
  document.body.appendChild(element);
  return element;
}

/**
 * jsdom does not implement contenteditable, so `isContentEditable` is always
 * false there. Defining it directly is what exercises the hook's real check.
 */
function mountContentEditable(): HTMLElement {
  const element = mount('div');
  Object.defineProperty(element, 'isContentEditable', { value: true });
  return element;
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('useKeyboardShortcuts - enabled gate', () => {
  it('does not fire any handler when enabled is false', () => {
    const onSave = vi.fn();
    renderHook(() => useKeyboardShortcuts({ 'ctrl+s': onSave }, false));

    press({ key: 's', ctrlKey: true });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('is enabled by default when the second argument is omitted', () => {
    const onSave = vi.fn();
    renderHook(() => useKeyboardShortcuts({ 'ctrl+s': onSave }));

    press({ key: 's', ctrlKey: true });

    expect(onSave).toHaveBeenCalledTimes(1);
  });
});

describe('useKeyboardShortcuts - escape', () => {
  it('fires the escape handler', () => {
    const onEscape = vi.fn();
    renderHook(() => useKeyboardShortcuts({ escape: onEscape }));

    press({ key: 'Escape' });

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('fires escape even while the user is typing in an input', () => {
    const onEscape = vi.fn();
    renderHook(() => useKeyboardShortcuts({ escape: onEscape }));

    press({ key: 'Escape', target: mount('input') });

    // Escape is checked BEFORE the input guard, so it is the one shortcut that
    // reaches a focused field. Every other shortcut is suppressed there.
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('does NOT preventDefault on escape', () => {
    const onEscape = vi.fn();
    renderHook(() => useKeyboardShortcuts({ escape: onEscape }));

    const event = press({ key: 'Escape' });

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(false);
  });

  it('falls through to the normal path when no escape handler is registered', () => {
    const onCtrlEscape = vi.fn();
    renderHook(() => useKeyboardShortcuts({ 'ctrl+escape': onCtrlEscape }));

    const event = press({ key: 'Escape', ctrlKey: true });

    // The early return is conjunct on shortcuts['escape'] EXISTING. Absent it,
    // Escape is treated as an ordinary key -- so this one DOES preventDefault,
    // contradicting the two assertions above in the case nobody looks at.
    expect(onCtrlEscape).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('useKeyboardShortcuts - input-field suppression', () => {
  it('suppresses non-escape shortcuts while typing in an INPUT', () => {
    const onSave = vi.fn();
    renderHook(() => useKeyboardShortcuts({ 'ctrl+s': onSave }));

    press({ key: 's', ctrlKey: true, target: mount('input') });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('suppresses non-escape shortcuts while typing in a TEXTAREA', () => {
    const onSave = vi.fn();
    renderHook(() => useKeyboardShortcuts({ 'ctrl+s': onSave }));

    press({ key: 's', ctrlKey: true, target: mount('textarea') });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('suppresses non-escape shortcuts while a SELECT is focused', () => {
    const onSave = vi.fn();
    renderHook(() => useKeyboardShortcuts({ 'ctrl+s': onSave }));

    press({ key: 's', ctrlKey: true, target: mount('select') });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('suppresses non-escape shortcuts inside a contenteditable element', () => {
    const onSave = vi.fn();
    renderHook(() => useKeyboardShortcuts({ 'ctrl+s': onSave }));

    press({ key: 's', ctrlKey: true, target: mountContentEditable() });

    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('useKeyboardShortcuts - key string construction', () => {
  it('calls preventDefault on a matched non-escape shortcut', () => {
    const onSave = vi.fn();
    renderHook(() => useKeyboardShortcuts({ 'ctrl+s': onSave }));

    const event = press({ key: 's', ctrlKey: true });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('treats metaKey (Cmd) as ctrl+, the same as ctrlKey', () => {
    const onSave = vi.fn();
    renderHook(() => useKeyboardShortcuts({ 'ctrl+s': onSave }));

    press({ key: 's', metaKey: true });

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('builds the key string as ctrl+ then shift+ then the key', () => {
    const onOrdered = vi.fn();
    const onReversed = vi.fn();
    const shortcuts: ShortcutMap = {
      'ctrl+shift+s': onOrdered,
      'shift+ctrl+s': onReversed,
    };
    renderHook(() => useKeyboardShortcuts(shortcuts));

    press({ key: 's', ctrlKey: true, shiftKey: true });

    // The order is fixed, not commutative: 'shift+ctrl+s' can never match.
    expect(onOrdered).toHaveBeenCalledTimes(1);
    expect(onReversed).not.toHaveBeenCalled();
  });

  it('lowercases the key so ArrowLeft matches arrowleft', () => {
    const onLeft = vi.fn();
    renderHook(() => useKeyboardShortcuts({ arrowleft: onLeft }));

    press({ key: 'ArrowLeft' });

    expect(onLeft).toHaveBeenCalledTimes(1);
  });

  it('ignores an unregistered key and leaves the event alone', () => {
    const onSave = vi.fn();
    renderHook(() => useKeyboardShortcuts({ 'ctrl+s': onSave }));

    const event = press({ key: 'q' });

    expect(onSave).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('useKeyboardShortcuts - listener lifecycle', () => {
  it('removes the window listener on unmount', () => {
    const onEscape = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcuts({ escape: onEscape }));

    press({ key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);

    unmount();
    press({ key: 'Escape' });

    expect(onEscape).toHaveBeenCalledTimes(1);
  });
});
