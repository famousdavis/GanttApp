// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// ProjectColorControl — a tile's Colour icon and the small non-modal popover it
// opens. An arrow key picks at once and leaves the popover open; a mouse pick
// closes it. Enter or Escape closes it and returns focus to the icon; Tab or a
// press outside closes it and leaves focus where it went.

import { useEffect, useId, useRef } from 'react';
import type { RefObject } from 'react';
import type { ProjectColor } from '../../shared/types';
import { PROJECT_COLORS } from '../../shared/utils/projectPrefs';

type ColorChoice = ProjectColor | 'none';

const CHOICES: readonly ColorChoice[] = [...PROJECT_COLORS, 'none'];

const CHOICE_LABELS: Record<ColorChoice, string> = {
  blue: 'Blue',
  teal: 'Teal',
  slate: 'Slate',
  purple: 'Purple',
  pink: 'Pink',
  none: 'No color',
};

interface ProjectColorPopoverProps {
  projectId: string;
  choice: ColorChoice;
  containerRef: RefObject<HTMLElement | null>;
  onPick: (color: ProjectColor | null) => boolean;
  onClose: (returnFocus: boolean) => void;
}

function ProjectColorPopover({ projectId, choice, containerRef, onPick, onClose }: ProjectColorPopoverProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const rootRef = useRef<HTMLDivElement>(null);
  // Set by a press on a choice and cleared by any key: an arrow key's change
  // comes with a click too, and only a mouse or touch pick closes the popover.
  const pickByPointerRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    rootRef.current?.querySelector<HTMLInputElement>('input:checked')?.focus();
  }, []);

  useEffect(() => {
    const closeOnOutsidePress = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) onCloseRef.current(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePress, true);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress, true);
  }, [containerRef]);

  const finishPointerPick = () => {
    if (!pickByPointerRef.current) return;
    pickByPointerRef.current = false;
    onClose(true);
  };

  const pick = (next: ColorChoice) => {
    if (onPick(next === 'none' ? null : next)) {
      finishPointerPick();
      return;
    }
    // Refused: React puts the checked radio back, and focus goes back with it.
    rootRef.current?.querySelector<HTMLInputElement>(`input[value="${choice}"]`)?.focus();
  };

  return (
    <div
      ref={rootRef}
      className="pt-popover"
      role="dialog"
      aria-label="Tile color"
      onPointerDown={(e) => { pickByPointerRef.current = (e.target as Element).closest('.pt-sw') !== null; }}
      onMouseDown={(e) => {
        // A press on a label must not take focus out of the popover, which would close it before the click.
        if (!(e.target as Element).matches('input')) e.preventDefault();
      }}
      onKeyDown={(e) => {
        pickByPointerRef.current = false;
        if (e.key !== 'Escape' && e.key !== 'Enter') return;
        e.preventDefault();
        // The page's own Escape shortcut listens on window.
        e.stopPropagation();
        onClose(true);
      }}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        // No next element: the window lost focus, or a press outside, which closes it by itself.
        if (next && !e.currentTarget.contains(next)) onClose(false);
      }}
    >
      <p className="pt-pop-title" id={titleId}>Tile color</p>
      <div className="pt-swatches" role="radiogroup" aria-labelledby={titleId}>
        {CHOICES.map((value) => {
          const radioId = `${baseId}-${value}`;
          return (
            <label key={value} className="pt-sw" htmlFor={radioId}>
              <input
                type="radio"
                id={radioId}
                name={`tile-color-${projectId}`}
                value={value}
                checked={choice === value}
                onChange={() => pick(value)}
                // Picking the colour already chosen changes nothing, but a mouse pick still closes.
                onClick={() => { if (choice === value) finishPointerPick(); }}
              />
              <span className="pt-dot" data-c={value} aria-hidden="true" />
              {CHOICE_LABELS[value]}
            </label>
          );
        })}
      </div>
      <p className="pt-pop-hint">Arrow keys choose. Enter or Esc closes.</p>
    </div>
  );
}

export interface ProjectColorControlProps {
  projectId: string;
  color: ProjectColor | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Applies a pick; false means it was refused and nothing changed. */
  onPick: (color: ProjectColor | null) => boolean;
}

export function ProjectColorControl({ projectId, color, open, onOpenChange, onPick }: ProjectColorControlProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const choice: ColorChoice = color ?? 'none';

  const close = (returnFocus: boolean) => {
    onOpenChange(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  return (
    <span ref={containerRef} className="pt-color">
      <button
        ref={buttonRef}
        type="button"
        className="pt-color-btn"
        aria-label={`Tile color: ${CHOICE_LABELS[choice]}`}
        title="Tile color"
        aria-haspopup="dialog"
        aria-expanded={open}
        // While open, a press here must not move focus: the blur would close
        // the popover and the click would open it again.
        onMouseDown={(e) => { if (open) e.preventDefault(); }}
        onClick={() => { if (open) close(true); else onOpenChange(true); }}
      >
        <span className="pt-cdot" aria-hidden="true" />
      </button>
      {open && (
        <ProjectColorPopover
          projectId={projectId}
          choice={choice}
          containerRef={containerRef}
          onPick={onPick}
          onClose={close}
        />
      )}
    </span>
  );
}
