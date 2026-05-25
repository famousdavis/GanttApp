// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// useBufferedField — local draft state with focus guard for controlled text
// inputs. Commits to the store on: blur, Enter, or unmount (if focused AND
// draft differs from store).
//
// Why: per-keystroke writes for cloud-stored settings produce one Firestore
// debounced commit per pause and trim trailing spaces mid-input. Buffered
// commits batch the entire edit into a single write that fires only when
// the user leaves the field.
//
// Unmount-commit: React does NOT fire blur when a component unmounts. The
// Settings tab uses conditional rendering ({activeTab === 'settings' &&
// <SettingsTab />}). Without unmount-commit, navigating to another tab
// silently discards in-progress drafts.
//
// Escape: reverts draft to storeValue AND clears isFocused. The flag clear
// prevents the unmount cleanup from firing for an abandoned draft.
//
// Focus guard: when an external store update arrives while the user is
// typing (cloud sync from another device, programmatic state change), the
// derived-state check skips updating the draft so the in-progress edit is
// preserved. Conflict resolution: local edit wins. Acceptable for all eight
// targeted fields — they are per-user settings; collaboration conflicts
// are not possible.
//
// React 19 patterns used:
//   - react-hooks/refs forbids ref assignment during render. The refs that
//     the unmount cleanup needs (latest draft, onCommit, sanitize, storeValue,
//     isFocused) are mirrored into refs from a render-effect (useEffect with
//     no dep array).
//   - react-hooks/set-state-in-effect forbids cascading setState in effects.
//     The "sync draft from store when not focused" behavior is implemented
//     via inline render-time setState — the standard "derived state from
//     prop change" pattern (React 19 useState docs).
//
// Scope: global per-user settings fields only. Inline chart label editors
// (per-project, shared with collaborators) are deferred — they require
// different conflict-resolution semantics.

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseBufferedFieldOptions {
  storeValue: string;
  onCommit: (value: string) => void;
  sanitize?: (value: string) => string;
}

interface UseBufferedFieldResult {
  draft: string;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleFocus: () => void;
  handleBlur: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function useBufferedField({
  storeValue,
  onCommit,
  sanitize,
}: UseBufferedFieldOptions): UseBufferedFieldResult {
  const [draft, setDraft] = useState(storeValue);
  const [isFocused, setIsFocused] = useState(false);

  // Derived state: sync draft from store when storeValue changes externally
  // AND the user is not focused. React's inline-setState-during-render pattern
  // (https://react.dev/reference/react/useState#storing-information-from-previous-renders).
  const [prevStoreValue, setPrevStoreValue] = useState(storeValue);
  if (storeValue !== prevStoreValue) {
    setPrevStoreValue(storeValue);
    if (!isFocused) {
      setDraft(storeValue);
    }
  }

  // Refs for the unmount cleanup. Assigned in a render-effect because
  // react-hooks/refs forbids ref assignment during render.
  const draftRef = useRef(draft);
  const onCommitRef = useRef(onCommit);
  const sanitizeRef = useRef(sanitize);
  const storeValueRef = useRef(storeValue);
  const isFocusedRef = useRef(isFocused);

  useEffect(() => {
    draftRef.current = draft;
    onCommitRef.current = onCommit;
    sanitizeRef.current = sanitize;
    storeValueRef.current = storeValue;
    isFocusedRef.current = isFocused;
  });

  // Commit on unmount if focused AND draft differs from store value.
  // Empty deps are intentional — the cleanup reads via refs (kept current
  // by the render-effect above) so it never needs to re-register on render.
  useEffect(() => {
    return () => {
      if (isFocusedRef.current && draftRef.current !== storeValueRef.current) {
        const fn = sanitizeRef.current;
        onCommitRef.current(fn ? fn(draftRef.current) : draftRef.current);
      }
    };
  }, []);

  const commit = useCallback(
    (value: string) => {
      const committed = sanitize ? sanitize(value) : value;
      onCommit(committed);
    },
    [onCommit, sanitize],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value),
    [],
  );

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    commit(draft);
  }, [draft, commit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        setIsFocused(false);
        commit(draft);
      } else if (e.key === 'Escape') {
        // Revert draft and clear focus so the unmount cleanup does not
        // fire for this abandoned draft.
        setDraft(storeValue);
        setIsFocused(false);
      }
    },
    [draft, commit, storeValue],
  );

  return { draft, handleChange, handleFocus, handleBlur, handleKeyDown };
}
