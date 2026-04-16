// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Three-segment release status control: Not Started / In Progress / Complete

import { ReleaseStatus } from '../../shared/types/models';
import type { ThemeColors } from '../../shared/utils/theme';

export interface ReleaseStatusControlProps {
  value: ReleaseStatus;
  onChange: (status: ReleaseStatus) => void;
  colors: ThemeColors;
}

const SEGMENTS: { status: ReleaseStatus; label: string; activeBackground: string; activeColor: string }[] = [
  { status: 'not-started', label: 'Not Started', activeBackground: '', activeColor: '' }, // uses colors.buttonBg / colors.buttonText at render
  { status: 'in-progress', label: 'In Progress', activeBackground: '#f59e0b', activeColor: 'white' },
  { status: 'complete', label: 'Complete', activeBackground: '#28a745', activeColor: 'white' },
];

export function ReleaseStatusControl({ value, onChange, colors }: ReleaseStatusControlProps) {
  return (
    <div role="group" aria-label="Release status" style={{ display: 'flex' }}>
      {SEGMENTS.map((seg, i) => {
        const isActive = value === seg.status;
        const isFirst = i === 0;
        const isLast = i === SEGMENTS.length - 1;

        // Not Started uses theme-neutral colors when active; others use hardcoded semantic colors
        const background = isActive
          ? (seg.activeBackground || colors.buttonBg)
          : colors.buttonBg;
        const color = isActive
          ? (seg.activeColor || colors.buttonText)
          : colors.buttonText;
        const borderColor = isActive
          ? (seg.activeBackground || colors.buttonBorder)
          : colors.buttonBorder;

        return (
          <button
            key={seg.status}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(seg.status)}
            style={{
              padding: '0.5rem 0.6rem',
              fontSize: '0.8rem',
              fontWeight: isActive ? '600' : '400',
              background,
              color,
              border: `1px solid ${borderColor}`,
              borderLeft: isFirst ? `1px solid ${borderColor}` : 'none',
              borderRadius: isFirst ? '4px 0 0 4px' : isLast ? '0 4px 4px 0' : '0',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
