// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// A tile's Colour icon and its popover, through the real component. jsdom
// neither moves focus on a press nor turns an arrow key into a pick, so a mouse
// pick here is the events a browser sends (pointerdown on the label, then a
// click on the radio) and an arrow key's pick is a click with no pointerdown.
// A real browser run checks the rest.

import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ProjectColorControl } from '../ProjectColorControl';
import type { ProjectColor } from '../../../shared/types';

const COLORS: [ProjectColor, string][] = [
  ['blue', 'Blue'],
  ['teal', 'Teal'],
  ['slate', 'Slate'],
  ['purple', 'Purple'],
  ['pink', 'Pink'],
];

function Harness({
  initial,
  initiallyOpen = true,
  refuse = false,
  onPick,
}: {
  initial?: ProjectColor;
  initiallyOpen?: boolean;
  refuse?: boolean;
  onPick?: (color: ProjectColor | null) => void;
}) {
  const [color, setColor] = useState<ProjectColor | undefined>(initial);
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <div>
      <button type="button">Before</button>
      <ProjectColorControl
        projectId="p1"
        color={color}
        open={open}
        onOpenChange={setOpen}
        onPick={(next) => {
          onPick?.(next);
          if (refuse) return false;
          setColor(next ?? undefined);
          return true;
        }}
      />
      <button type="button">After</button>
      <p>Outside</p>
    </div>
  );
}

const icon = () => screen.getByRole('button', { name: /^Tile color: / });
const popover = () => screen.queryByRole('dialog', { name: 'Tile color' });
const radio = (name: string) => screen.getByRole('radio', { name });

/** The events of a mouse pick on a choice, in a browser's order. */
function mousePick(name: string) {
  const target = radio(name);
  const label = target.closest('label')!;
  fireEvent.pointerDown(label);
  fireEvent.mouseDown(label);
  fireEvent.click(label);
}

describe('ProjectColorControl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('the Colour icon', () => {
    it.each([...COLORS, [undefined, 'No color']] as const)('with %s names its colour, not the project', (color, label) => {
      render(<Harness initial={color} initiallyOpen={false} />);
      const button = screen.getByRole('button', { name: `Tile color: ${label}` });
      expect(button).toHaveAttribute('title', 'Tile color');
      expect(button).toHaveAttribute('aria-haspopup', 'dialog');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('opens the popover, says so, and closes it again with focus on the icon', () => {
      render(<Harness initiallyOpen={false} />);
      expect(popover()).toBeNull();

      fireEvent.click(icon());
      expect(popover()).not.toBeNull();
      expect(icon()).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(icon());
      expect(popover()).toBeNull();
      expect(icon()).toHaveAttribute('aria-expanded', 'false');
      expect(icon()).toHaveFocus();
    });

    it('keeps focus in the popover when pressed while open, and only while open', () => {
      render(<Harness initiallyOpen={false} />);
      // fireEvent returns false when the default was prevented.
      expect(fireEvent.mouseDown(icon())).toBe(true);
      fireEvent.click(icon());
      expect(fireEvent.mouseDown(icon())).toBe(false);
    });
  });

  describe('the popover', () => {
    it('is a non-modal dialog with a heading, six labelled radios in one group, and a hint', () => {
      render(<Harness />);
      const dialog = popover()!;
      expect(dialog).not.toHaveAttribute('aria-modal');
      expect(dialog).not.toHaveAttribute('data-modal-surface');
      expect(within(dialog).getByRole('radiogroup', { name: 'Tile color' })).toBeInTheDocument();
      const radios = within(dialog).getAllByRole('radio') as HTMLInputElement[];
      expect(radios.map(r => r.labels?.[0]?.textContent)).toEqual(['Blue', 'Teal', 'Slate', 'Purple', 'Pink', 'No color']);
      expect(new Set(radios.map(r => r.name))).toEqual(new Set(['tile-color-p1']));
      expect(new Set(radios.map(r => r.id)).size).toBe(6);
      expect(within(dialog).getByText('Arrow keys choose. Enter or Esc closes.')).toBeInTheDocument();
    });

    it.each([...COLORS, [undefined, 'No color']] as const)('with %s, opening focuses that radio', (color, label) => {
      render(<Harness initial={color} />);
      expect(radio(label)).toBeChecked();
      expect(radio(label)).toHaveFocus();
      expect(screen.getAllByRole('radio').filter(r => (r as HTMLInputElement).checked)).toHaveLength(1);
    });
  });

  describe('picking', () => {
    it.each(COLORS)('an arrow key picks %s and leaves the popover open', (color, label) => {
      const onPick = vi.fn();
      render(<Harness initial={color === 'blue' ? 'teal' : 'blue'} onPick={onPick} />);
      fireEvent.keyDown(screen.getByRole('radio', { checked: true }), { key: 'ArrowDown' });
      fireEvent.click(radio(label));

      expect(onPick).toHaveBeenCalledWith(color);
      expect(radio(label)).toBeChecked();
      expect(popover()).not.toBeNull();
      expect(icon()).toHaveAccessibleName(`Tile color: ${label}`);
    });

    it('No color clears the colour', () => {
      const onPick = vi.fn();
      render(<Harness initial="pink" onPick={onPick} />);
      fireEvent.click(radio('No color'));
      expect(onPick).toHaveBeenCalledWith(null);
      expect(icon()).toHaveAccessibleName('Tile color: No color');
    });

    it.each([...COLORS, ['none', 'No color']] as const)('a mouse pick of %s closes the popover and returns focus to the icon', (_c, label) => {
      const start: ProjectColor = label === 'Teal' ? 'pink' : 'teal';
      render(<Harness initial={start} />);
      mousePick(label);
      expect(popover()).toBeNull();
      expect(icon()).toHaveAccessibleName(`Tile color: ${label}`);
      expect(icon()).toHaveFocus();
    });

    it('a mouse pick of the colour already chosen changes nothing and still closes', () => {
      const onPick = vi.fn();
      render(<Harness initial="purple" onPick={onPick} />);
      mousePick('Purple');
      expect(onPick).not.toHaveBeenCalled();
      expect(popover()).toBeNull();
      expect(icon()).toHaveFocus();
    });

    it('a key pressed after a press on a choice makes the next pick a keyboard pick', () => {
      render(<Harness initial="blue" />);
      fireEvent.pointerDown(radio('Teal').closest('label')!);
      fireEvent.keyDown(radio('Blue'), { key: 'ArrowDown' });
      fireEvent.click(radio('Teal'));
      expect(radio('Teal')).toBeChecked();
      expect(popover()).not.toBeNull();
    });

    it('a press on the popover but not on a choice does not make the next pick a mouse pick', () => {
      render(<Harness initial="blue" />);
      fireEvent.pointerDown(screen.getByText('Arrow keys choose. Enter or Esc closes.'));
      fireEvent.click(radio('Teal'));
      expect(radio('Teal')).toBeChecked();
      expect(popover()).not.toBeNull();
    });

    it('a press on a label keeps focus in the popover; a press on a radio is left alone', () => {
      render(<Harness initial="blue" />);
      expect(fireEvent.mouseDown(radio('Teal').closest('label')!)).toBe(false);
      expect(fireEvent.mouseDown(screen.getByText('Tile color'))).toBe(false);
      expect(fireEvent.mouseDown(radio('Teal'))).toBe(true);
    });
  });

  describe('a refused pick', () => {
    it('by mouse changes nothing on screen: the popover stays and the same radio stays checked', () => {
      const onPick = vi.fn();
      render(<Harness initial="blue" refuse onPick={onPick} />);
      mousePick('Pink');

      expect(onPick).toHaveBeenCalledWith('pink');
      expect(popover()).not.toBeNull();
      expect(radio('Blue')).toBeChecked();
      expect(radio('Pink')).not.toBeChecked();
      expect(radio('Blue')).toHaveFocus();
      expect(icon()).toHaveAccessibleName('Tile color: Blue');
    });

    it('by arrow key puts focus back on the radio still checked', () => {
      render(<Harness initial="teal" refuse />);
      // A browser moves focus to the next radio before the pick.
      radio('Slate').focus();
      fireEvent.click(radio('Slate'));
      expect(radio('Teal')).toBeChecked();
      expect(radio('Teal')).toHaveFocus();
      expect(popover()).not.toBeNull();
    });
  });

  describe('closing', () => {
    it.each(['Enter', 'Escape'])('%s closes it and returns focus to the icon', (key) => {
      render(<Harness initial="slate" />);
      expect(fireEvent.keyDown(radio('Slate'), { key })).toBe(false);
      expect(popover()).toBeNull();
      expect(icon()).toHaveFocus();
    });

    it('Escape stops there: it never reaches the page, which any other key does', () => {
      const pageKeys = vi.fn();
      window.addEventListener('keydown', pageKeys);
      render(<Harness initial="slate" />);

      fireEvent.keyDown(radio('Slate'), { key: 'a' });
      expect(pageKeys).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(radio('Slate'), { key: 'Escape' });
      expect(pageKeys).toHaveBeenCalledTimes(1);
      expect(popover()).toBeNull();
      window.removeEventListener('keydown', pageKeys);
    });

    it('any other key leaves it open', () => {
      render(<Harness initial="slate" />);
      fireEvent.keyDown(radio('Slate'), { key: 'ArrowUp' });
      fireEvent.keyDown(radio('Slate'), { key: ' ' });
      expect(popover()).not.toBeNull();
    });

    it('Tab out closes it and leaves focus where it went', () => {
      render(<Harness initial="pink" />);
      const after = screen.getByRole('button', { name: 'After' });
      fireEvent.blur(radio('Pink'), { relatedTarget: after });
      expect(popover()).toBeNull();
      expect(icon()).not.toHaveFocus();
    });

    it('Shift+Tab onto the icon closes it, with focus left on the icon', () => {
      render(<Harness initial="pink" />);
      icon().focus();
      fireEvent.blur(radio('Pink'), { relatedTarget: icon() });
      expect(popover()).toBeNull();
      expect(icon()).toHaveFocus();
    });

    it('focus moving between its radios leaves it open', () => {
      render(<Harness initial="pink" />);
      fireEvent.blur(radio('Pink'), { relatedTarget: radio('No color') });
      expect(popover()).not.toBeNull();
    });

    it('the window losing focus leaves it open', () => {
      render(<Harness initial="pink" />);
      fireEvent.blur(radio('Pink'), { relatedTarget: null });
      expect(popover()).not.toBeNull();
    });

    it('a press outside closes it and leaves focus alone', () => {
      render(<Harness initial="blue" />);
      fireEvent.pointerDown(screen.getByText('Outside'));
      expect(popover()).toBeNull();
      expect(icon()).not.toHaveFocus();
    });

    it('a press on the icon or inside the popover is not a press outside', () => {
      render(<Harness initial="blue" />);
      fireEvent.pointerDown(icon());
      expect(popover()).not.toBeNull();
      fireEvent.pointerDown(screen.getByText('Tile color'));
      expect(popover()).not.toBeNull();
    });

    it('stops listening for presses outside once closed', () => {
      const onOpenChange = vi.fn();
      const { rerender } = render(
        <ProjectColorControl projectId="p1" color={undefined} open onOpenChange={onOpenChange} onPick={() => true} />,
      );
      rerender(
        <ProjectColorControl projectId="p1" color={undefined} open={false} onOpenChange={onOpenChange} onPick={() => true} />,
      );
      fireEvent.pointerDown(document.body);
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });
});
