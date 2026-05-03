// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Chart legend component with editable labels

import { ChartColors, ChartDisplaySettings } from '../../shared/types';
import { ProjectLegendLabels } from '../../shared/types/models';
import { useTheme } from '../../context/ThemeContext';
import { LegendLabelType } from './useChartEditing';

interface ChartLegendProps {
  chartColors: ChartColors;
  displaySettings: ChartDisplaySettings;
  solidBarLabel: string;
  hatchedBarLabel: string;
  finishDateLabel: string;
  mostLikelyLineLabel: string;
  inProgressLabel: string;
  showTodayLine: boolean;
  showFinishDateLine: boolean;
  showMostLikelyLine: boolean;
  hasProjectFinishDate: boolean;
  hasMostLikelyReleases: boolean;
  hasCompletedReleases: boolean;
  hasInProgressReleases: boolean;
  editingLegendLabel: LegendLabelType | null;
  tempLabelValue: string;
  onStartEditLabel: (type: LegendLabelType) => void;
  onSaveLabelEdit: () => void;
  onCancelLabelEdit: () => void;
  onTempLabelChange: (value: string) => void;
  readOnly?: boolean;
  /** v16.1: per-project legend label overrides currently active for this project, if any */
  projectLegendLabels?: ProjectLegendLabels;
  /** v16.1: called when the user clicks a ↺ reset button next to a label with a project override */
  onClearProjectLabelOverride?: (key: keyof ProjectLegendLabels) => void;
  /** v16.1: true when a project is selected — drives the "editing will save to this project" hint */
  hasActiveProject: boolean;
}

/** Inline ↺ reset button shown next to labels with an active project override.
 * v16.2: tagged with `copy-image-button` className so html2canvas excludes it
 * from captured chart images (matches the existing pattern used by the 📋 toolbar button). */
function ResetOverrideButton({ onReset }: { onReset: () => void }) {
  return (
    <button
      type="button"
      className="copy-image-button"
      onClick={onReset}
      title="Reset to global label"
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.85rem',
        padding: '0 0.25rem',
        color: 'inherit',
        opacity: 0.7,
      }}
    >
      ↺
    </button>
  );
}

function EditableLabelInput({
  value,
  onChange,
  onSave,
  onCancel
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <input
        name="legendLabelEdit"
        aria-label="Edit legend label"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCancel}
        autoFocus
        style={{ padding: '0.25rem', fontSize: '0.9rem', border: '1px solid #ddd', borderRadius: '4px' }}
      />
      <button
        onMouseDown={onSave}
        style={{
          padding: '0.25rem 0.5rem',
          background: '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '1rem'
        }}
      >
        ✓
      </button>
    </div>
  );
}

export function ChartLegend({
  chartColors,
  displaySettings,
  solidBarLabel,
  hatchedBarLabel,
  finishDateLabel,
  mostLikelyLineLabel,
  inProgressLabel,
  showTodayLine,
  showFinishDateLine,
  showMostLikelyLine,
  hasProjectFinishDate,
  hasMostLikelyReleases,
  hasCompletedReleases,
  hasInProgressReleases,
  editingLegendLabel,
  tempLabelValue,
  onStartEditLabel,
  onSaveLabelEdit,
  onCancelLabelEdit,
  onTempLabelChange,
  readOnly = false,
  projectLegendLabels,
  onClearProjectLabelOverride,
  hasActiveProject,
}: ChartLegendProps) {
  const { colors } = useTheme();

  // v16.2: no font-style differentiation for overridden labels — the ↺ reset button
  // is the sole visual indicator of an active project override. Keeping all labels
  // in the same font style avoids a jarring mixed-italic legend row.

  // v16.1: render a ↺ reset button only when an override exists AND not readOnly AND handler available
  const renderReset = (key: keyof ProjectLegendLabels) =>
    projectLegendLabels?.[key] !== undefined && !readOnly && onClearProjectLabelOverride
      ? <ResetOverrideButton onReset={() => onClearProjectLabelOverride(key)} />
      : null;

  return (
    <div style={{ marginTop: '2rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.9rem' }}>
      {/* Legend order reads status-progression left-to-right:
          Completed → In Progress → Not Started (solid + hatched) → lines. */}

      {/* v16.1/v16.2: subtle scope hint when a project is selected and legend is editable.
          Tagged copy-image-button so html2canvas excludes it from exported chart images. */}
      {hasActiveProject && !readOnly && (
        <div
          className="copy-image-button"
          style={{
            width: '100%',
            fontSize: '0.75rem',
            color: colors.textMuted,
            fontStyle: 'italic',
            marginBottom: '-0.5rem',
          }}
        >
          Editing labels saves to this project only. Use ↺ to reset to the global label, or change the global default in Settings → Default Legend Labels.
        </div>
      )}

      {/* Completed legend — shown only when completed releases exist */}
      {hasCompletedReleases && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '30px', height: '20px', background: chartColors.completedBar, borderRadius: '4px' }}></div>
          <span>Completed</span>
        </div>
      )}

      {/* In Progress legend — shown only when in-progress releases exist */}
      {hasInProgressReleases && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '30px', height: '20px', background: chartColors.inProgressBar, borderRadius: '4px' }}></div>
          {editingLegendLabel === 'inProgress' ? (
            <EditableLabelInput
              value={tempLabelValue}
              onChange={onTempLabelChange}
              onSave={onSaveLabelEdit}
              onCancel={onCancelLabelEdit}
            />
          ) : (
            <>
              <span
                onClick={readOnly ? undefined : () => onStartEditLabel('inProgress')}
                style={{ cursor: readOnly ? 'default' : 'pointer' }}
                title={readOnly ? undefined : 'Click to edit'}
              >
                {inProgressLabel}
              </span>
              {renderReset('inProgress')}
            </>
          )}
        </div>
      )}

      {/* Solid bar legend — represents Not Started */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ width: '30px', height: '20px', background: chartColors.solidBar, borderRadius: '4px' }}></div>
        {editingLegendLabel === 'solid' ? (
          <EditableLabelInput
            value={tempLabelValue}
            onChange={onTempLabelChange}
            onSave={onSaveLabelEdit}
            onCancel={onCancelLabelEdit}
          />
        ) : (
          <>
            <span
              onClick={readOnly ? undefined : () => onStartEditLabel('solid')}
              style={{ cursor: readOnly ? 'default' : 'pointer' }}
              title={readOnly ? undefined : 'Click to edit'}
            >
              {solidBarLabel}
            </span>
            {renderReset('solidBar')}
          </>
        )}
      </div>

      {/* Hatched bar legend — delivery uncertainty */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <svg width="30" height="20">
          <defs>
            <pattern id="legend-hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke={chartColors.hatchedBar} strokeWidth="4" />
            </pattern>
          </defs>
          <rect width="30" height="20" fill="url(#legend-hatch)" stroke={chartColors.hatchedBar} strokeWidth="2" rx="4" />
        </svg>
        {editingLegendLabel === 'hatched' ? (
          <EditableLabelInput
            value={tempLabelValue}
            onChange={onTempLabelChange}
            onSave={onSaveLabelEdit}
            onCancel={onCancelLabelEdit}
          />
        ) : (
          <>
            <span
              onClick={readOnly ? undefined : () => onStartEditLabel('hatched')}
              style={{ cursor: readOnly ? 'default' : 'pointer' }}
              title={readOnly ? undefined : 'Click to edit'}
            >
              {hatchedBarLabel}
            </span>
            {renderReset('hatchedBar')}
          </>
        )}
      </div>

      {/* Today line legend */}
      {showTodayLine && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: `${displaySettings.verticalLineWidth}px`,
            height: '20px',
            background: chartColors.todayLine,
            borderRadius: '2px'
          }}></div>
          <span>Today&apos;s Date</span>
        </div>
      )}

      {/* Finish date line legend */}
      {showFinishDateLine && hasProjectFinishDate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: `${displaySettings.verticalLineWidth}px`,
            height: '20px',
            background: chartColors.finishDateLine,
            borderRadius: '2px'
          }}></div>
          {editingLegendLabel === 'finishDate' ? (
            <EditableLabelInput
              value={tempLabelValue}
              onChange={onTempLabelChange}
              onSave={onSaveLabelEdit}
              onCancel={onCancelLabelEdit}
            />
          ) : (
            <>
              <span
                onClick={readOnly ? undefined : () => onStartEditLabel('finishDate')}
                style={{ cursor: readOnly ? 'default' : 'pointer' }}
                title={readOnly ? undefined : 'Click to edit'}
              >
                {finishDateLabel}
              </span>
              {renderReset('finishDateLine')}
            </>
          )}
        </div>
      )}

      {/* Most Likely Finish line legend */}
      {showMostLikelyLine && hasMostLikelyReleases && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: `${displaySettings.verticalLineWidth}px`,
            height: '20px',
            background: chartColors.mostLikelyLine,
            borderRadius: '2px'
          }}></div>
          {editingLegendLabel === 'mostLikelyLine' ? (
            <EditableLabelInput
              value={tempLabelValue}
              onChange={onTempLabelChange}
              onSave={onSaveLabelEdit}
              onCancel={onCancelLabelEdit}
            />
          ) : (
            <>
              <span
                onClick={readOnly ? undefined : () => onStartEditLabel('mostLikelyLine')}
                style={{ cursor: readOnly ? 'default' : 'pointer' }}
                title={readOnly ? undefined : 'Click to edit'}
              >
                {mostLikelyLineLabel}
              </span>
              {renderReset('mostLikelyLine')}
            </>
          )}
        </div>
      )}
    </div>
  );
}
