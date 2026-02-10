import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ChartReleaseBar } from '../ChartReleaseBar';
import { DEFAULT_DISPLAY_SETTINGS } from '../../../shared/utils/colors';
import { ChartEditingProps } from '../GanttChart';

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
    minLabelSpacing: 40
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
});
