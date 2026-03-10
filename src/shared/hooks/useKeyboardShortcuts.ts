// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Global keyboard shortcuts hook

import { useEffect, useCallback } from 'react';

export interface ShortcutMap {
  [key: string]: (e: KeyboardEvent) => void;
}

/**
 * Register global keyboard shortcuts.
 *
 * Key format examples:
 * - "escape" - Escape key
 * - "ctrl+s" - Ctrl+S (also handles Cmd+S on Mac)
 * - "arrowleft", "arrowright" - Arrow keys
 *
 * The hook handles both Ctrl (Windows/Linux) and Cmd (Mac) for modifier keys.
 * Escape always fires even when an input is focused.
 * Other shortcuts are skipped when the user is typing in an input field.
 *
 * @param shortcuts - Object mapping key strings to handler functions
 * @param enabled - Whether shortcuts are active (default: true)
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap, enabled: boolean = true) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Check if user is typing in an input field
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' ||
                   target.tagName === 'TEXTAREA' ||
                   target.tagName === 'SELECT' ||
                   target.isContentEditable;

    const key = e.key.toLowerCase();
    const modifier = e.ctrlKey || e.metaKey;

    // Escape always fires, even in inputs
    if (key === 'escape' && shortcuts['escape']) {
      shortcuts['escape'](e);
      return;
    }

    // For other shortcuts, skip if in an input field
    if (isInput) return;

    // Build key string
    let keyStr = '';
    if (modifier) keyStr += 'ctrl+';
    if (e.shiftKey) keyStr += 'shift+';
    keyStr += key;

    if (shortcuts[keyStr]) {
      e.preventDefault();
      shortcuts[keyStr](e);
    }
  }, [shortcuts, enabled]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
