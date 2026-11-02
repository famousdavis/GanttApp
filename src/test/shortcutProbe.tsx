// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// A stand-in for a screen that registers page-wide shortcuts, for tests that
// check those shortcuts wait while a modal surface is open.

import { useMemo } from 'react';
import { fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { useKeyboardShortcuts } from '../shared/hooks/useKeyboardShortcuts';

export type ProbeSpies = Record<'arrowleft' | 'arrowright' | 'save' | 'escape', ReturnType<typeof vi.fn<(e: KeyboardEvent) => void>>>;

export function makeProbeSpies(): ProbeSpies {
  return {
    arrowleft: vi.fn<(e: KeyboardEvent) => void>(),
    arrowright: vi.fn<(e: KeyboardEvent) => void>(),
    save: vi.fn<(e: KeyboardEvent) => void>(),
    escape: vi.fn<(e: KeyboardEvent) => void>(),
  };
}

export function ShortcutProbe({ spies }: { spies: ProbeSpies }) {
  const shortcuts = useMemo(() => ({
    arrowleft: spies.arrowleft,
    arrowright: spies.arrowright,
    'ctrl+s': spies.save,
    escape: spies.escape,
  }), [spies]);
  useKeyboardShortcuts(shortcuts);
  return null;
}

/** The page-wide keys: both arrows, Ctrl+S and Cmd+S, and Escape. */
export const PROBE_KEYS: Array<{ name: string; init: KeyboardEventInit; spy: keyof ProbeSpies }> = [
  { name: 'ArrowLeft', init: { key: 'ArrowLeft' }, spy: 'arrowleft' },
  { name: 'ArrowRight', init: { key: 'ArrowRight' }, spy: 'arrowright' },
  { name: 'Ctrl+S', init: { key: 's', ctrlKey: true }, spy: 'save' },
  { name: 'Cmd+S', init: { key: 's', metaKey: true }, spy: 'save' },
  { name: 'Escape', init: { key: 'Escape' }, spy: 'escape' },
];

/** Press a key with focus on the page itself, where the shortcuts listen. */
export function pressOnPage(init: KeyboardEventInit) {
  fireEvent.keyDown(document.body, { cancelable: true, bubbles: true, ...init });
}
