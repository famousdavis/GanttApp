// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Tests for v0.27.0 (Pass 4, A3) useBufferedField hook.
// Commits on: blur, Enter, unmount (if focused AND draft !== storeValue).
// Escape: reverts draft AND clears focus flag (no unmount-commit for abandoned drafts).

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBufferedField } from '../useBufferedField';

describe('useBufferedField', () => {
  it('does not call onCommit on keystroke — only after blur', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useBufferedField({ storeValue: 'initial', onCommit }),
    );

    act(() => result.current.handleFocus());
    act(() =>
      result.current.handleChange({
        target: { value: 'typing' },
      } as React.ChangeEvent<HTMLInputElement>),
    );

    expect(onCommit).not.toHaveBeenCalled();
    expect(result.current.draft).toBe('typing');

    act(() => result.current.handleBlur());
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('typing');
  });

  it('commits on Enter keydown', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useBufferedField({ storeValue: '', onCommit }),
    );

    act(() => result.current.handleFocus());
    act(() =>
      result.current.handleChange({
        target: { value: 'hello' },
      } as React.ChangeEvent<HTMLInputElement>),
    );
    act(() =>
      result.current.handleKeyDown({
        key: 'Enter',
      } as React.KeyboardEvent<HTMLInputElement>),
    );

    expect(onCommit).toHaveBeenCalledWith('hello');
  });

  it('reverts draft and does NOT commit on Escape', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useBufferedField({ storeValue: 'original', onCommit }),
    );

    act(() => result.current.handleFocus());
    act(() =>
      result.current.handleChange({
        target: { value: 'changed' },
      } as React.ChangeEvent<HTMLInputElement>),
    );
    act(() =>
      result.current.handleKeyDown({
        key: 'Escape',
      } as React.KeyboardEvent<HTMLInputElement>),
    );

    expect(onCommit).not.toHaveBeenCalled();
    expect(result.current.draft).toBe('original');
  });

  it('focus guard prevents store updates from overwriting draft while focused', () => {
    const onCommit = vi.fn();
    const { result, rerender } = renderHook(
      ({ storeValue }: { storeValue: string }) =>
        useBufferedField({ storeValue, onCommit }),
      { initialProps: { storeValue: 'original' } },
    );

    act(() => result.current.handleFocus());
    act(() =>
      result.current.handleChange({
        target: { value: 'in-progress' },
      } as React.ChangeEvent<HTMLInputElement>),
    );

    // Simulate a cloud update arriving while the user is typing
    rerender({ storeValue: 'cloud-restored' });

    // Draft must NOT be overwritten while focused
    expect(result.current.draft).toBe('in-progress');
  });

  it('commits on unmount if focused and draft differs from store', () => {
    // Scenario: user types in the Settings tab, clicks the Projects tab.
    // The Settings tab unmounts via conditional rendering — blur does not fire.
    const onCommit = vi.fn();
    const { result, unmount } = renderHook(() =>
      useBufferedField({ storeValue: '', onCommit }),
    );

    act(() => result.current.handleFocus());
    act(() =>
      result.current.handleChange({
        target: { value: 'draft-value' },
      } as React.ChangeEvent<HTMLInputElement>),
    );

    unmount();
    expect(onCommit).toHaveBeenCalledWith('draft-value');
  });

  it('does NOT commit on unmount if not focused (already committed via blur)', () => {
    const onCommit = vi.fn();
    const { result, unmount } = renderHook(() =>
      useBufferedField({ storeValue: '', onCommit }),
    );

    act(() => result.current.handleFocus());
    act(() =>
      result.current.handleChange({
        target: { value: 'value' },
      } as React.ChangeEvent<HTMLInputElement>),
    );
    act(() => result.current.handleBlur()); // commits and clears focus
    vi.clearAllMocks();

    unmount();
    // No double-commit on unmount — blur already committed
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('does NOT commit on unmount after Escape (abandoned draft)', () => {
    // Scenario: user types, presses Escape (reverts), then tab-navigates away.
    // The Escape handler clears isFocusedRef so unmount cleanup must not fire.
    const onCommit = vi.fn();
    const { result, unmount } = renderHook(() =>
      useBufferedField({ storeValue: 'original', onCommit }),
    );

    act(() => result.current.handleFocus());
    act(() =>
      result.current.handleChange({
        target: { value: 'changed' },
      } as React.ChangeEvent<HTMLInputElement>),
    );
    act(() =>
      result.current.handleKeyDown({
        key: 'Escape',
      } as React.KeyboardEvent<HTMLInputElement>),
    );

    unmount();
    expect(onCommit).not.toHaveBeenCalled();
  });
});
