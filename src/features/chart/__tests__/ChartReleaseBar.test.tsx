// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChartReleaseBar } from '../ChartReleaseBar';
import { DEFAULT_DISPLAY_SETTINGS } from '../../../shared/utils/colors';
import { ChartEditingProps } from '../GanttChart';
import { formatDateShort } from '../../../shared/utils/dates';

const mockRelease = {
  id: 'r1',
  projectId: 'p1',
  name: 'Release Alpha',
  startDate: '2026-01-01',
  earlyFinishDate: '2026-03-01',
  lateFinishDate: '2026-05-01'
};

// Simple linear dateToX mock
function mockDateToX(date: string): number {
  const d = new Date(date);
  const start = new Date('2026-01-01').getTime();
  const range = new Date('2026-12-31').getTime() - start;
  return 280 + ((d.getTime() - start) / range) * 770;
}

const noopEditing: ChartEditingProps = {
  editingLegendLabel: null,
  tempLabelValue: '',
  setTempLabelValue: vi.fn(),
  startEditLabel: vi.fn(),
  saveLabelEdit: vi.fn(),
  cancelLabelEdit: vi.fn(),
  editingReleaseId: null,
  tempReleaseName: '',
  setTempReleaseName: vi.fn(),
  startEditReleaseName: vi.fn(),
  saveReleaseNameEdit: vi.fn(),
  cancelReleaseNameEdit: vi.fn(),
  editingDateInfo: null,
  tempDateValue: '',
  setTempDateValue: vi.fn(),
  dateEditError: '',
  startEditDate: vi.fn(),
  saveDateEdit: vi.fn(),
  commitDateEdit: vi.fn(),
  cancelDateEdit: vi.fn()
};

describe('ChartReleaseBar', () => {
  const defaultProps = {
    release: mockRelease,
    y: 50,
    barHeight: 30,
    chartWidth: 1100,
    dateToX: mockDateToX,
    releaseColors: { solidBar: '#0070f3', hatchedBar: '#0070f3' },
    displaySettings: DEFAULT_DISPLAY_SETTINGS,
    readOnly: false,
    editing: noopEditing,
    minLabelSpacing: 40,
    showMostLikelyLine: false,
    mostLikelyLineColor: '#000000'
  };

  it('renders the release name', () => {
    const { container } = render(
      <svg><ChartReleaseBar {...defaultProps} /></svg>
    );

    const textEls = container.querySelectorAll('text');
    const nameText = Array.from(textEls).find(t => t.textContent === 'Release Alpha');
    expect(nameText).toBeTruthy();
  });

  it('renders solid bar rect', () => {
    const { container } = render(
      <svg><ChartReleaseBar {...defaultProps} /></svg>
    );

    const rects = container.querySelectorAll('rect');
    // Should have at least 2 rects: solid bar and hatched bar
    expect(rects.length).toBeGreaterThanOrEqual(2);
  });

  it('renders hatched bar with pattern', () => {
    const { container } = render(
      <svg><ChartReleaseBar {...defaultProps} /></svg>
    );

    const pattern = container.querySelector(`#hatch-${mockRelease.id}`);
    expect(pattern).toBeTruthy();
  });

  it('renders date labels', () => {
    const { container } = render(
      <svg><ChartReleaseBar {...defaultProps} /></svg>
    );

    const textEls = container.querySelectorAll('text');
    const texts = Array.from(textEls).map(t => t.textContent);

    // Should contain formatted dates (e.g., "Jan 1", "Mar 1", "May 1")
    expect(texts.some(t => t?.includes('Jan'))).toBe(true);
    expect(texts.some(t => t?.includes('May'))).toBe(true);
  });

  it('does not show edit UI in readOnly mode', () => {
    const startEditName = vi.fn();
    const { container } = render(
      <svg>
        <ChartReleaseBar
          {...defaultProps}
          readOnly={true}
          editing={{ ...noopEditing, startEditReleaseName: startEditName }}
        />
      </svg>
    );

    // Release name text should have cursor: default
    const nameText = Array.from(container.querySelectorAll('text')).find(
      t => t.textContent === 'Release Alpha'
    );
    expect(nameText?.style.cursor).toBe('default');
  });

  it('shows pointer cursor on release name when not readOnly', () => {
    const { container } = render(
      <svg><ChartReleaseBar {...defaultProps} readOnly={false} /></svg>
    );

    const nameText = Array.from(container.querySelectorAll('text')).find(
      t => t.textContent === 'Release Alpha'
    );
    expect(nameText?.style.cursor).toBe('pointer');
  });

  it('shows inline text editor when editing release name', () => {
    const { container } = render(
      <svg>
        <ChartReleaseBar
          {...defaultProps}
          editing={{
            ...noopEditing,
            editingReleaseId: 'r1',
            tempReleaseName: 'New Name'
          }}
        />
      </svg>
    );

    // foreignObject should be present for inline editing
    const foreignObj = container.querySelector('foreignObject');
    expect(foreignObj).toBeTruthy();
  });

  it('hides early finish label when dates are too close', () => {
    // Make dates very close together so showEarlyLabel is false
    const closeDatesRelease = {
      ...mockRelease,
      startDate: '2026-01-01',
      earlyFinishDate: '2026-01-05',
      lateFinishDate: '2026-01-10'
    };

    const { container } = render(
      <svg>
        <ChartReleaseBar
          {...defaultProps}
          release={closeDatesRelease}
          minLabelSpacing={40}
        />
      </svg>
    );

    const textEls = container.querySelectorAll('text');
    const texts = Array.from(textEls).map(t => t.textContent);

    // With very close dates, early finish label should be hidden
    // We should see release name + start date + late finish date = 3 texts
    // (early finish is hidden due to spacing)
    const dateTexts = texts.filter(t => t !== 'Release Alpha');
    expect(dateTexts.length).toBe(2); // start + late only
  });

  it('renders most likely finish line when showMostLikelyLine is true and release has date', () => {
    const releaseWithMl = {
      ...mockRelease,
      mostLikelyFinishDate: '2026-04-01'
    };

    const { container } = render(
      <svg>
        <ChartReleaseBar
          {...defaultProps}
          release={releaseWithMl}
          showMostLikelyLine={true}
          mostLikelyLineColor="#dc2626"
        />
      </svg>
    );

    // Should render a line for most likely finish date
    const lines = container.querySelectorAll('line');
    const mlLine = Array.from(lines).find(l => l.getAttribute('stroke') === '#dc2626');
    expect(mlLine).toBeTruthy();
  });

  it('does not render most likely finish line when showMostLikelyLine is false', () => {
    const releaseWithMl = {
      ...mockRelease,
      mostLikelyFinishDate: '2026-04-01'
    };

    const { container } = render(
      <svg>
        <ChartReleaseBar
          {...defaultProps}
          release={releaseWithMl}
          showMostLikelyLine={false}
          mostLikelyLineColor="#dc2626"
        />
      </svg>
    );

    const lines = container.querySelectorAll('line');
    const mlLine = Array.from(lines).find(l => l.getAttribute('stroke') === '#dc2626');
    expect(mlLine).toBeFalsy();
  });

  it('does not render most likely finish line when release has no ML date', () => {
    const { container } = render(
      <svg>
        <ChartReleaseBar
          {...defaultProps}
          showMostLikelyLine={true}
          mostLikelyLineColor="#dc2626"
        />
      </svg>
    );

    const lines = container.querySelectorAll('line');
    const mlLine = Array.from(lines).find(l => l.getAttribute('stroke') === '#dc2626');
    expect(mlLine).toBeFalsy();
  });

  it('renders most likely date label when visible and sufficiently spaced', () => {
    const releaseWithMl = {
      ...mockRelease,
      mostLikelyFinishDate: '2026-04-01'
    };

    const { container } = render(
      <svg>
        <ChartReleaseBar
          {...defaultProps}
          release={releaseWithMl}
          showMostLikelyLine={true}
          mostLikelyLineColor="#000000"
        />
      </svg>
    );

    const textEls = container.querySelectorAll('text');
    const texts = Array.from(textEls).map(t => t.textContent);
    // Should have a date label containing "Apr" for the ML date
    expect(texts.some(t => t?.includes('Apr'))).toBe(true);
  });

  it('renders inline date editor for mostLikely date when editing', () => {
    const releaseWithMl = {
      ...mockRelease,
      mostLikelyFinishDate: '2026-04-01'
    };

    const { container } = render(
      <svg>
        <ChartReleaseBar
          {...defaultProps}
          release={releaseWithMl}
          showMostLikelyLine={true}
          mostLikelyLineColor="#000000"
          editing={{
            ...noopEditing,
            editingDateInfo: { releaseId: 'r1', dateType: 'mostLikely' },
            tempDateValue: '2026-04-01'
          }}
        />
      </svg>
    );

    // foreignObject should be present for inline date editing
    const foreignObjects = container.querySelectorAll('foreignObject');
    expect(foreignObjects.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// v0.28.16 — inline-editor interaction at the INSTANTIATION site.
//
// Until this release ChartReleaseBar.test.tsx had ZERO fireEvent calls: the
// shared components' prop wiring was gate-caught, but the behaviour of the five
// editors this file actually renders was not tested at all. That is the site
// where a lost edit is invisible — a wrong date moves a bar a few pixels on a
// months-long chart — and this app has no undo.
// ---------------------------------------------------------------------------
describe('ChartReleaseBar — inline editor commit-on-blur (v0.28.16)', () => {
  const baseRelease = { ...mockRelease, mostLikelyFinishDate: '2026-04-01' };

  const baseProps = {
    release: baseRelease,
    y: 50,
    barHeight: 30,
    chartWidth: 1100,
    dateToX: mockDateToX,
    releaseColors: { solidBar: '#0070f3', hatchedBar: '#0070f3' },
    displaySettings: DEFAULT_DISPLAY_SETTINGS,
    readOnly: false,
    minLabelSpacing: 40,
    showMostLikelyLine: true,
    mostLikelyLineColor: '#000000'
  };

  function editingFor(dateType: 'start' | 'early' | 'late' | 'mostLikely'): ChartEditingProps {
    return {
      ...noopEditing,
      setTempDateValue: vi.fn(),
      saveDateEdit: vi.fn(),
      commitDateEdit: vi.fn(),
      cancelDateEdit: vi.fn(),
      editingDateInfo: { releaseId: 'r1', dateType },
      tempDateValue: '2026-02-01'
    };
  }

  const dateTypes = ['start', 'early', 'late', 'mostLikely'] as const;

  // F1 — per DATE INSTANCE, not merely per definition site. ChartReleaseBar
  // renders four date editors per release; a user with 12 releases faces 48.
  it.each(dateTypes)('commits on blur for the %s date editor', (dateType) => {
    const editing = editingFor(dateType);
    const { container } = render(
      <svg><ChartReleaseBar {...baseProps} editing={editing} /></svg>
    );

    const input = container.querySelector('input[type="date"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    fireEvent.blur(input);

    expect(editing.commitDateEdit).toHaveBeenCalledTimes(1);
    expect(editing.cancelDateEdit).not.toHaveBeenCalled();
    expect(editing.saveDateEdit).not.toHaveBeenCalled();
  });

  // F2b — a STALE error flag must not change the blur route. The editor is
  // rendered with hasError already true (a prior failed save); blur must still
  // go through commitDateEdit, which re-validates the current value.
  it('routes blur through commitDateEdit even when an error is already showing', () => {
    const editing = { ...editingFor('start'), dateEditError: 'Invalid date format' };
    const { container } = render(
      <svg><ChartReleaseBar {...baseProps} editing={editing} /></svg>
    );

    const input = container.querySelector('input[type="date"]') as HTMLInputElement;
    expect(input.style.border).toBe('2px solid rgb(220, 53, 69)');
    fireEvent.blur(input);

    expect(editing.commitDateEdit).toHaveBeenCalledTimes(1);
    expect(editing.cancelDateEdit).not.toHaveBeenCalled();
  });

  // F4 — Escape still discards. Handled locally by InlineDateEditor.
  it('discards on Escape', () => {
    const editing = editingFor('start');
    const { container } = render(
      <svg><ChartReleaseBar {...baseProps} editing={editing} /></svg>
    );

    fireEvent.keyDown(container.querySelector('input[type="date"]')!, { key: 'Escape' });

    expect(editing.cancelDateEdit).toHaveBeenCalledTimes(1);
    expect(editing.commitDateEdit).not.toHaveBeenCalled();
  });

  // F5 — the ✓ button. InlineDateEditor preventDefaults the mousedown so no
  // blur fires, giving exactly one commit through saveDateEdit.
  it('saves through saveDateEdit when the checkmark is pressed', () => {
    const editing = editingFor('start');
    render(<svg><ChartReleaseBar {...baseProps} editing={editing} /></svg>);

    fireEvent.mouseDown(screen.getByTitle('Save'));

    expect(editing.saveDateEdit).toHaveBeenCalledTimes(1);
    expect(editing.commitDateEdit).not.toHaveBeenCalled();
  });

  // F1 — the release-name editor at the same site.
  it('commits the release name on blur', () => {
    const editing: ChartEditingProps = {
      ...noopEditing,
      saveReleaseNameEdit: vi.fn(),
      cancelReleaseNameEdit: vi.fn(),
      editingReleaseId: 'r1',
      tempReleaseName: 'Renamed'
    };
    const { container } = render(
      <svg><ChartReleaseBar {...baseProps} editing={editing} /></svg>
    );

    fireEvent.blur(container.querySelector('input[type="text"]')!);

    expect(editing.saveReleaseNameEdit).toHaveBeenCalledTimes(1);
    expect(editing.cancelReleaseNameEdit).not.toHaveBeenCalled();
  });

  // F10 — the unmount path. readOnly flipping (the snapshot-chip gesture) must
  // remove the editor. React does NOT fire blur on unmount, so nothing commits;
  // that is the status quo, and the point here is that no editor survives.
  it.each(dateTypes)('renders no %s editor when readOnly, and does render it when not', (dateType) => {
    const editing = editingFor(dateType);

    const live = render(
      <svg><ChartReleaseBar {...baseProps} editing={editing} /></svg>
    );
    expect(live.container.querySelector('input[type="date"]')).toBeTruthy();
    live.unmount();

    const frozen = render(
      <svg><ChartReleaseBar {...baseProps} readOnly={true} editing={editing} /></svg>
    );
    expect(frozen.container.querySelector('input[type="date"]')).toBeNull();
    expect(editing.commitDateEdit).not.toHaveBeenCalled();
  });

  // The other half of the round trip: OPENING an editor. These five onClick
  // arrows were the whole of this file's uncovered function coverage (fn 2/7) —
  // every one of them the entry point to an editor whose exit this release
  // changes.
  describe('opening an editor from a label', () => {
    const openProps = { ...baseProps, editing: noopEditing };

    const clickText = (container: HTMLElement, label: string) => {
      const el = Array.from(container.querySelectorAll('text'))
        .find(t => t.textContent === label);
      expect(el).toBeTruthy();
      fireEvent.click(el!);
    };

    it.each([
      ['start', '2026-01-01'],
      ['early', '2026-03-01'],
      ['late', '2026-05-01'],
      ['mostLikely', '2026-04-01'],
    ] as const)('starts a %s date edit when its label is clicked', (dateType, iso) => {
      const editing = { ...noopEditing, startEditDate: vi.fn() };
      const { container } = render(
        <svg><ChartReleaseBar {...openProps} editing={editing} /></svg>
      );

      clickText(container, formatDateShort(iso));

      expect(editing.startEditDate).toHaveBeenCalledWith('r1', dateType, iso);
    });

    it('starts a release-name edit when the name is clicked', () => {
      const editing = { ...noopEditing, startEditReleaseName: vi.fn() };
      const { container } = render(
        <svg><ChartReleaseBar {...openProps} editing={editing} /></svg>
      );

      clickText(container, 'Release Alpha');

      expect(editing.startEditReleaseName).toHaveBeenCalledWith('r1', 'Release Alpha');
    });

    // readOnly removes the handler entirely (onClick={readOnly ? undefined : ...}),
    // so a snapshot view cannot open an editor in the first place.
    it('opens nothing when readOnly', () => {
      const editing = { ...noopEditing, startEditDate: vi.fn(), startEditReleaseName: vi.fn() };
      const { container } = render(
        <svg><ChartReleaseBar {...openProps} readOnly={true} editing={editing} /></svg>
      );

      clickText(container, formatDateShort('2026-01-01'));
      clickText(container, 'Release Alpha');

      expect(editing.startEditDate).not.toHaveBeenCalled();
      expect(editing.startEditReleaseName).not.toHaveBeenCalled();
    });
  });
});
