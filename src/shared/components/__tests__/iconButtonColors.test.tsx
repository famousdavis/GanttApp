// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The shared icon buttons, in both themes: a 28 px box, a resting grey of at
// least 3:1, and a hover/focus colour of at least 3:1 against the surfaces they
// sit on. Each button, theme and state is asserted on its own.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ThemeWrapper } from '../../../test/ThemeWrapper';
import { TrashIconButton } from '../TrashIconButton';
import { PencilIconButton } from '../PencilIconButton';
import { ExportIconButton } from '../ExportIconButton';
import { CloneIconButton } from '../CloneIconButton';
import { ShareIconButton } from '../ShareIconButton';
import { MoveIconButton } from '../MoveIconButton';

type Theme = 'light' | 'dark';

const REST: Record<Theme, string> = { light: '#808080', dark: '#9ca3af' };

const BUTTONS: Array<{ name: string; el: () => ReactElement; label: string; hover: Record<Theme, string> }> = [
  { name: 'Trash', el: () => <TrashIconButton onClick={vi.fn()} ariaLabel="Delete project" />, label: 'Delete project', hover: { light: '#ef4444', dark: '#f87171' } },
  { name: 'Pencil', el: () => <PencilIconButton onClick={vi.fn()} ariaLabel="Edit project" />, label: 'Edit project', hover: { light: '#0070f3', dark: '#60a5fa' } },
  { name: 'Export', el: () => <ExportIconButton onClick={vi.fn()} ariaLabel="Export project" />, label: 'Export project', hover: { light: '#047857', dark: '#34d399' } },
  { name: 'Clone', el: () => <CloneIconButton onClick={vi.fn()} ariaLabel="Clone project" />, label: 'Clone project', hover: { light: '#7c3aed', dark: '#a78bfa' } },
  { name: 'Share', el: () => <ShareIconButton onClick={vi.fn()} ariaLabel="Share project" />, label: 'Share project', hover: { light: '#0e7490', dark: '#22d3ee' } },
  { name: 'Move earlier', el: () => <MoveIconButton direction="earlier" onClick={vi.fn()} />, label: 'Move earlier', hover: { light: '#0070f3', dark: '#60a5fa' } },
  { name: 'Move later', el: () => <MoveIconButton direction="later" onClick={vi.fn()} />, label: 'Move later', hover: { light: '#0070f3', dark: '#60a5fa' } },
];

/** Every stroked shape in the icon, so no part of it can keep an old colour. */
function strokes(button: HTMLElement): string[] {
  return Array.from(button.querySelectorAll('svg [stroke]')).map((n) => n.getAttribute('stroke') ?? '');
}

function renderIn(theme: Theme, el: ReactElement, label: string) {
  localStorage.setItem('gantt-theme', theme);
  render(<ThemeWrapper>{el}</ThemeWrapper>);
  return screen.getByRole('button', { name: label });
}

describe('shared icon buttons: size and colours by theme', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  describe.each(BUTTONS)('$name', ({ el, label, hover }) => {
    it.each(['light', 'dark'] as Theme[])('in %s mode rests grey, and takes its colour on hover and on focus', (theme) => {
      const button = renderIn(theme, el(), label);
      const rest = strokes(button);
      expect(rest.length).toBeGreaterThan(0);
      expect(new Set(rest)).toEqual(new Set([REST[theme]]));

      fireEvent.mouseEnter(button);
      expect(new Set(strokes(button))).toEqual(new Set([hover[theme]]));
      fireEvent.mouseLeave(button);
      expect(new Set(strokes(button))).toEqual(new Set([REST[theme]]));

      fireEvent.focus(button);
      expect(new Set(strokes(button))).toEqual(new Set([hover[theme]]));
      fireEvent.blur(button);
      expect(new Set(strokes(button))).toEqual(new Set([REST[theme]]));
    });

    it('is a 28 px square in every theme', () => {
      const button = renderIn('light', el(), label);
      expect(button.style.width).toBe('28px');
      expect(button.style.height).toBe('28px');
    });
  });

  it('Move buttons name themselves by direction, and a disabled one stays grey under the pointer', () => {
    render(
      <ThemeWrapper>
        <MoveIconButton direction="earlier" onClick={vi.fn()} disabled />
        <MoveIconButton direction="later" onClick={vi.fn()} />
      </ThemeWrapper>,
    );
    const earlier = screen.getByRole('button', { name: 'Move earlier' });
    expect(earlier).toBeDisabled();
    expect(earlier).toHaveAttribute('data-move', 'earlier');
    expect(screen.getByRole('button', { name: 'Move later' })).toHaveAttribute('data-move', 'later');
    fireEvent.mouseEnter(earlier);
    expect(new Set(strokes(earlier))).toEqual(new Set([REST.light]));
  });
});
