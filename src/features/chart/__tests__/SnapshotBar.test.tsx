// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SnapshotBar } from '../SnapshotBar';
import { ThemeProvider } from '../../../context/ThemeContext';
import { Snapshot } from '../../../shared/types';

const mockSnapshots: Snapshot[] = [
  {
    id: 'snap1',
    projectId: 'p1',
    timestamp: '2026-01-15T10:00:00.000Z',
    name: 'Sprint 1',
    releases: []
  },
  {
    id: 'snap2',
    projectId: 'p1',
    timestamp: '2026-02-01T10:00:00.000Z',
    name: 'Sprint 2',
    releases: []
  }
];

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('SnapshotBar', () => {
  const defaultProps = {
    snapshots: mockSnapshots,
    activeSnapshotId: null as string | null,
    onSelectSnapshot: vi.fn(),
    onSaveSnapshot: vi.fn(),
    onDeleteSnapshot: vi.fn()
  };

  it('renders Current chip', () => {
    renderWithTheme(<SnapshotBar {...defaultProps} />);

    expect(screen.getByText(/Current/)).toBeInTheDocument();
  });

  it('renders snapshot chips', () => {
    renderWithTheme(<SnapshotBar {...defaultProps} />);

    expect(screen.getByText('Sprint 1')).toBeInTheDocument();
    expect(screen.getByText('Sprint 2')).toBeInTheDocument();
  });

  it('shows Save Snapshot button in Current view', () => {
    renderWithTheme(<SnapshotBar {...defaultProps} />);

    expect(screen.getByText('Save Snapshot')).toBeInTheDocument();
  });

  it('hides Save Snapshot button when viewing a snapshot', () => {
    renderWithTheme(
      <SnapshotBar {...defaultProps} activeSnapshotId="snap1" />
    );

    expect(screen.queryByText('Save Snapshot')).not.toBeInTheDocument();
  });

  it('shows delete button when viewing a snapshot', () => {
    renderWithTheme(
      <SnapshotBar {...defaultProps} activeSnapshotId="snap1" />
    );

    expect(screen.getByTitle('Delete this snapshot')).toBeInTheDocument();
  });

  it('hides delete button in Current view', () => {
    renderWithTheme(<SnapshotBar {...defaultProps} />);

    expect(screen.queryByTitle('Delete this snapshot')).not.toBeInTheDocument();
  });

  it('calls onSelectSnapshot(null) when Current is clicked', () => {
    const onSelect = vi.fn();
    renderWithTheme(
      <SnapshotBar {...defaultProps} onSelectSnapshot={onSelect} activeSnapshotId="snap1" />
    );

    fireEvent.click(screen.getByText('Current'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('calls onSelectSnapshot with snapshot ID when chip is clicked', () => {
    const onSelect = vi.fn();
    renderWithTheme(
      <SnapshotBar {...defaultProps} onSelectSnapshot={onSelect} />
    );

    fireEvent.click(screen.getByText('Sprint 1'));
    expect(onSelect).toHaveBeenCalledWith('snap1');
  });

  it('calls onSaveSnapshot when Save Snapshot is clicked', () => {
    const onSave = vi.fn();
    renderWithTheme(
      <SnapshotBar {...defaultProps} onSaveSnapshot={onSave} />
    );

    fireEvent.click(screen.getByText('Save Snapshot'));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('shows confirmation dialog and calls onDeleteSnapshot when confirmed', () => {
    const onDelete = vi.fn();
    renderWithTheme(
      <SnapshotBar {...defaultProps} activeSnapshotId="snap1" onDeleteSnapshot={onDelete} />
    );

    fireEvent.click(screen.getByTitle('Delete this snapshot'));

    // ConfirmDialog should appear
    expect(screen.getByText('Delete Snapshot')).toBeInTheDocument();
    expect(screen.getByText(/Delete snapshot "Sprint 1"/)).toBeInTheDocument();

    // Confirm deletion
    fireEvent.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledWith('snap1');
  });

  describe('delete confirmation', () => {
    it('Cancel closes the confirmation and keeps the snapshot', () => {
      const onDelete = vi.fn();
      renderWithTheme(
        <SnapshotBar {...defaultProps} activeSnapshotId="snap1" onDeleteSnapshot={onDelete} />
      );

      fireEvent.click(screen.getByTitle('Delete this snapshot'));
      // The confirmation is open and names the snapshot it would delete.
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Delete snapshot "Sprint 1"/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText(/Delete snapshot "Sprint 1"/)).not.toBeInTheDocument();
      expect(onDelete).not.toHaveBeenCalled();
      // The bar is still showing the snapshot, with its delete control.
      expect(screen.getByText('Sprint 1')).toBeInTheDocument();
      expect(screen.getByTitle('Delete this snapshot')).toBeInTheDocument();
    });

    it('Delete deletes the named snapshot and closes the confirmation', () => {
      const onDelete = vi.fn();
      renderWithTheme(
        <SnapshotBar {...defaultProps} activeSnapshotId="snap2" onDeleteSnapshot={onDelete} />
      );

      fireEvent.click(screen.getByTitle('Delete this snapshot'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Delete snapshot "Sprint 2"/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onDelete).toHaveBeenCalledWith('snap2');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText(/Delete snapshot "Sprint 2"/)).not.toBeInTheDocument();
    });

    it('says "this snapshot", with no date, when the snapshot is removed while its confirmation is open', () => {
      const onDelete = vi.fn();
      const { rerender } = renderWithTheme(
        <SnapshotBar {...defaultProps} activeSnapshotId="snap1" onDeleteSnapshot={onDelete} />
      );

      fireEvent.click(screen.getByTitle('Delete this snapshot'));
      // While the snapshot is in the list, the message names it and gives its date.
      expect(screen.getByText(/^Delete snapshot "Sprint 1" \(.+\)\?$/)).toBeInTheDocument();

      // The list loses it (for example, its project was revoked) while the
      // confirmation is still open.
      rerender(
        <ThemeProvider>
          <SnapshotBar
            {...defaultProps}
            snapshots={[mockSnapshots[1]]}
            activeSnapshotId="snap1"
            onDeleteSnapshot={onDelete}
          />
        </ThemeProvider>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      const message = screen.getByText(/^Delete snapshot /);
      expect(message.textContent).toBe('Delete snapshot this snapshot?');
      expect(screen.queryByText(/Sprint 1/)).not.toBeInTheDocument();
    });
  });

  it('shows checkmark on active Current chip', () => {
    renderWithTheme(<SnapshotBar {...defaultProps} />);

    expect(screen.getByText(/Current ✓/)).toBeInTheDocument();
  });

  it('renders with no snapshots', () => {
    renderWithTheme(
      <SnapshotBar {...defaultProps} snapshots={[]} />
    );

    expect(screen.getByText(/Current/)).toBeInTheDocument();
    expect(screen.getByText('Save Snapshot')).toBeInTheDocument();
  });

  describe('horizontal mouse-wheel scroll (v16.7)', () => {
    function getScrollEl(container: HTMLElement): HTMLDivElement {
      return container.querySelector('.snapshot-bar-scroll') as HTMLDivElement;
    }

    function setOverflow(el: HTMLElement, scrollWidth: number, clientWidth: number) {
      Object.defineProperty(el, 'scrollWidth', { value: scrollWidth, configurable: true });
      Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true });
    }

    it('redirects vertical wheel to scrollLeft on overflowing container', () => {
      const { container } = renderWithTheme(<SnapshotBar {...defaultProps} />);
      const el = getScrollEl(container);
      setOverflow(el, 1000, 300);

      const ev = new WheelEvent('wheel', { deltaY: 150, deltaX: 0, bubbles: true, cancelable: true });
      el.dispatchEvent(ev);

      expect(el.scrollLeft).toBe(150);
      expect(ev.defaultPrevented).toBe(true);
    });

    it('does nothing on non-overflowing container', () => {
      const { container } = renderWithTheme(<SnapshotBar {...defaultProps} />);
      const el = getScrollEl(container);
      setOverflow(el, 200, 300);

      const ev = new WheelEvent('wheel', { deltaY: 150, deltaX: 0, bubbles: true, cancelable: true });
      el.dispatchEvent(ev);

      expect(el.scrollLeft).toBe(0);
      expect(ev.defaultPrevented).toBe(false);
    });

    it('does not intercept horizontal wheel (touchpad deltaX)', () => {
      const { container } = renderWithTheme(<SnapshotBar {...defaultProps} />);
      const el = getScrollEl(container);
      setOverflow(el, 1000, 300);

      const ev = new WheelEvent('wheel', { deltaX: 50, deltaY: 0, bubbles: true, cancelable: true });
      el.dispatchEvent(ev);

      expect(el.scrollLeft).toBe(0);
      expect(ev.defaultPrevented).toBe(false);
    });

    it('does not intercept a wheel event with no delta at all', () => {
      const { container } = renderWithTheme(<SnapshotBar {...defaultProps} />);
      const el = getScrollEl(container);
      setOverflow(el, 1000, 300);

      // A vertical wheel on the same container is intercepted.
      const vertical = new WheelEvent('wheel', { deltaY: 120, deltaX: 0, bubbles: true, cancelable: true });
      el.dispatchEvent(vertical);
      expect(vertical.defaultPrevented).toBe(true);
      expect(el.scrollLeft).toBe(120);

      // One with neither a horizontal nor a vertical delta is left alone.
      const empty = new WheelEvent('wheel', { deltaY: 0, deltaX: 0, bubbles: true, cancelable: true });
      el.dispatchEvent(empty);
      expect(empty.defaultPrevented).toBe(false);
      expect(el.scrollLeft).toBe(120);
    });

    it('removes wheel listener on unmount', () => {
      const { container, unmount } = renderWithTheme(<SnapshotBar {...defaultProps} />);
      const el = getScrollEl(container);
      setOverflow(el, 1000, 300);

      unmount();

      const ev = new WheelEvent('wheel', { deltaY: 150, deltaX: 0, bubbles: true, cancelable: true });
      expect(() => el.dispatchEvent(ev)).not.toThrow();
      expect(el.scrollLeft).toBe(0);
      expect(ev.defaultPrevented).toBe(false);
    });
  });
});
