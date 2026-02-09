// Chart legend component with editable labels

import { ChartColors, ChartDisplaySettings } from '../../shared/types';
import { LegendLabelType } from './useChartEditing';

interface ChartLegendProps {
  chartColors: ChartColors;
  displaySettings: ChartDisplaySettings;
  solidBarLabel: string;
  hatchedBarLabel: string;
  finishDateLabel: string;
  showTodayLine: boolean;
  showFinishDateLine: boolean;
  hasProjectFinishDate: boolean;
  editingLegendLabel: LegendLabelType | null;
  tempLabelValue: string;
  onStartEditLabel: (type: LegendLabelType) => void;
  onSaveLabelEdit: () => void;
  onCancelLabelEdit: () => void;
  onTempLabelChange: (value: string) => void;
  readOnly?: boolean;
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
  showTodayLine,
  showFinishDateLine,
  hasProjectFinishDate,
  editingLegendLabel,
  tempLabelValue,
  onStartEditLabel,
  onSaveLabelEdit,
  onCancelLabelEdit,
  onTempLabelChange,
  readOnly = false
}: ChartLegendProps) {
  return (
    <div style={{ marginTop: '2rem', display: 'flex', gap: '2rem', fontSize: '0.9rem' }}>
      {/* Solid bar legend */}
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
          <span
            onClick={readOnly ? undefined : () => onStartEditLabel('solid')}
            style={{ cursor: readOnly ? 'default' : 'pointer' }}
            title={readOnly ? undefined : 'Click to edit'}
          >
            {solidBarLabel}
          </span>
        )}
      </div>

      {/* Hatched bar legend */}
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
          <span
            onClick={readOnly ? undefined : () => onStartEditLabel('hatched')}
            style={{ cursor: readOnly ? 'default' : 'pointer' }}
            title={readOnly ? undefined : 'Click to edit'}
          >
            {hatchedBarLabel}
          </span>
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
            <span
              onClick={readOnly ? undefined : () => onStartEditLabel('finishDate')}
              style={{ cursor: readOnly ? 'default' : 'pointer' }}
              title={readOnly ? undefined : 'Click to edit'}
            >
              {finishDateLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
