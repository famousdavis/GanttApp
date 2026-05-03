// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// DefaultLegendLabelsSection — Settings tab section for the 5 global default legend labels (v16.2).
// Placeholder-driven UX: empty state shows the hardcoded default as a greyed-out hint.
// Clearing an input reverts to the placeholder default — the chart falls back via
// `labelRaw || DEFAULT_LEGEND_LABELS.key` at every consumption point.

import { useId } from 'react';
import type { ThemeColors } from '../../shared/utils/theme';
import { sanitizeString, DEFAULT_LEGEND_LABELS } from '../../shared/utils/validation';

interface DefaultLegendLabelsSectionProps {
  colors: ThemeColors;
  solidBarLabel: string;
  setSolidBarLabel: (v: string) => void;
  hatchedBarLabel: string;
  setHatchedBarLabel: (v: string) => void;
  finishDateLabel: string;
  setFinishDateLabel: (v: string) => void;
  mostLikelyLineLabel: string;
  setMostLikelyLineLabel: (v: string) => void;
  inProgressLabel: string;
  setInProgressLabel: (v: string) => void;
}

interface LegendLabelRow {
  label: string;
  /** Stable per-row key used to derive a unique input id within this component. */
  key: string;
  placeholder: string;
  value: string;
  setter: (v: string) => void;
}

export function DefaultLegendLabelsSection({
  colors,
  solidBarLabel,
  setSolidBarLabel,
  hatchedBarLabel,
  setHatchedBarLabel,
  finishDateLabel,
  setFinishDateLabel,
  mostLikelyLineLabel,
  setMostLikelyLineLabel,
  inProgressLabel,
  setInProgressLabel,
}: DefaultLegendLabelsSectionProps) {
  const baseFieldId = useId();
  const rows: LegendLabelRow[] = [
    { label: 'Solid Bar', key: 'solidBar', placeholder: DEFAULT_LEGEND_LABELS.solidBar, value: solidBarLabel, setter: setSolidBarLabel },
    { label: 'Hatched Bar', key: 'hatchedBar', placeholder: DEFAULT_LEGEND_LABELS.hatchedBar, value: hatchedBarLabel, setter: setHatchedBarLabel },
    { label: 'Project Finish Date', key: 'finishDateLine', placeholder: DEFAULT_LEGEND_LABELS.finishDateLine, value: finishDateLabel, setter: setFinishDateLabel },
    { label: 'Most Likely Finish', key: 'mostLikelyLine', placeholder: DEFAULT_LEGEND_LABELS.mostLikelyLine, value: mostLikelyLineLabel, setter: setMostLikelyLineLabel },
    { label: 'In Progress', key: 'inProgress', placeholder: DEFAULT_LEGEND_LABELS.inProgress, value: inProgressLabel, setter: setInProgressLabel },
  ];

  return (
    <section style={{ marginBottom: '2rem' }}>
      <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' }}>Default Legend Labels</h3>
      <p style={{ color: colors.textSecondary, marginBottom: '1rem', lineHeight: '1.6' }}>
        Customize the default chart legend labels. Individual projects can still override these defaults from the chart legend. Clearing a field reverts to the shown placeholder.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {rows.map((row) => {
          const inputId = `${baseFieldId}-${row.key}`;
          return (
          <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label
              htmlFor={inputId}
              style={{
                flex: '0 0 180px',
                fontSize: '0.9rem',
                color: colors.text,
                fontWeight: '500',
              }}
            >
              {row.label}
            </label>
            <input
              id={inputId}
              name={`legendLabel-${row.key}`}
              type="text"
              value={row.value}
              placeholder={row.placeholder}
              onChange={(e) => row.setter(sanitizeString(e.target.value, 50))}
              maxLength={50}
              style={{
                flex: '1 1 280px',
                padding: '0.4rem 0.6rem',
                border: `1px solid ${colors.inputBorder}`,
                borderRadius: '4px',
                fontSize: '0.9rem',
                background: colors.inputBg,
                color: colors.text,
              }}
            />
          </div>
          );
        })}
      </div>
    </section>
  );
}
