// Individual release bar rendering within the Gantt chart SVG

import { Release, ChartDisplaySettings } from '../../shared/types';
import { formatDateShort } from '../../shared/utils/dates';
import { InlineDateEditor } from '../../shared/components/InlineDateEditor';
import { InlineTextEditor } from '../../shared/components/InlineTextEditor';
import { ChartEditingProps } from './GanttChart';

interface ChartReleaseBarProps {
  release: Release;
  y: number;
  barHeight: number;
  chartWidth: number;
  dateToX: (date: string) => number;
  releaseColors: { solidBar: string; hatchedBar: string };
  displaySettings: ChartDisplaySettings;
  readOnly: boolean;
  editing: ChartEditingProps;
  minLabelSpacing: number;
}

export function ChartReleaseBar({
  release,
  y,
  barHeight,
  chartWidth,
  dateToX,
  releaseColors,
  displaySettings,
  readOnly,
  editing,
  minLabelSpacing
}: ChartReleaseBarProps) {
  const startX = dateToX(release.startDate);
  const earlyX = dateToX(release.earlyFinishDate);
  const lateX = dateToX(release.lateFinishDate);
  const showEarlyLabel = (earlyX - startX) >= minLabelSpacing && (lateX - earlyX) >= minLabelSpacing;

  return (
    <g>
      {/* Release name */}
      {!readOnly && editing.editingReleaseId === release.id ? (
        <foreignObject x={10} y={y + barHeight / 2 - 12} width={270} height={24}>
          <InlineTextEditor
            value={editing.tempReleaseName}
            onChange={editing.setTempReleaseName}
            onSave={editing.saveReleaseNameEdit}
            onCancel={editing.cancelReleaseNameEdit}
            fontSize={displaySettings.releaseNameFontSize + 'px'}
          />
        </foreignObject>
      ) : (
        <text
          x={10} y={y + barHeight / 2}
          fontSize={displaySettings.releaseNameFontSize} fill="#333" fontWeight="600"
          textAnchor="start" dominantBaseline="middle"
          style={{ cursor: readOnly ? 'default' : 'pointer' }}
          onClick={readOnly ? undefined : () => editing.startEditReleaseName(release.id, release.name)}
        >
          {release.name}
        </text>
      )}

      {/* Solid bar (start to early) */}
      <rect
        x={startX} y={y} width={earlyX - startX} height={barHeight}
        fill={releaseColors.solidBar} stroke={releaseColors.solidBar} strokeWidth="2" rx="4"
      />

      {/* Hatched bar (early to late) */}
      <defs>
        <pattern id={`hatch-${release.id}`} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke={releaseColors.hatchedBar} strokeWidth="4" />
        </pattern>
      </defs>
      <rect
        x={earlyX} y={y} width={lateX - earlyX} height={barHeight}
        fill={`url(#hatch-${release.id})`} stroke={releaseColors.hatchedBar} strokeWidth="2" rx="4"
      />

      {/* Start date label */}
      {!readOnly && editing.editingDateInfo?.releaseId === release.id && editing.editingDateInfo?.dateType === 'start' ? (
        <foreignObject x={startX - 70} y={y + barHeight + 2} width={140} height={28}>
          <InlineDateEditor
            value={editing.tempDateValue}
            onChange={editing.setTempDateValue}
            onSave={editing.saveDateEdit}
            onCancel={editing.cancelDateEdit}
            hasError={!!editing.dateEditError}
          />
        </foreignObject>
      ) : (
        <text
          x={startX} y={y + barHeight + 15}
          fontSize={displaySettings.dateLabelFontSize} fill={displaySettings.dateLabelColor}
          textAnchor="middle" style={{ cursor: readOnly ? 'default' : 'pointer' }}
          onClick={readOnly ? undefined : () => editing.startEditDate(release.id, 'start', release.startDate)}
        >
          {formatDateShort(release.startDate)}
        </text>
      )}

      {/* Early finish date label */}
      {showEarlyLabel && (
        !readOnly && editing.editingDateInfo?.releaseId === release.id && editing.editingDateInfo?.dateType === 'early' ? (
          <foreignObject x={earlyX - 70} y={y + barHeight + 2} width={140} height={28}>
            <InlineDateEditor
              value={editing.tempDateValue}
              onChange={editing.setTempDateValue}
              onSave={editing.saveDateEdit}
              onCancel={editing.cancelDateEdit}
              hasError={!!editing.dateEditError}
            />
          </foreignObject>
        ) : (
          <text
            x={earlyX} y={y + barHeight + 15}
            fontSize={displaySettings.dateLabelFontSize} fill={displaySettings.dateLabelColor}
            textAnchor="middle" style={{ cursor: readOnly ? 'default' : 'pointer' }}
            onClick={readOnly ? undefined : () => editing.startEditDate(release.id, 'early', release.earlyFinishDate)}
          >
            {formatDateShort(release.earlyFinishDate)}
          </text>
        )
      )}

      {/* Late finish date label */}
      {!readOnly && editing.editingDateInfo?.releaseId === release.id && editing.editingDateInfo?.dateType === 'late' ? (
        <foreignObject x={Math.min(lateX - 70, chartWidth - 145)} y={y + barHeight + 2} width={140} height={28}>
          <InlineDateEditor
            value={editing.tempDateValue}
            onChange={editing.setTempDateValue}
            onSave={editing.saveDateEdit}
            onCancel={editing.cancelDateEdit}
            hasError={!!editing.dateEditError}
          />
        </foreignObject>
      ) : (
        <text
          x={lateX} y={y + barHeight + 15}
          fontSize={displaySettings.dateLabelFontSize} fill={displaySettings.dateLabelColor}
          textAnchor="middle" style={{ cursor: readOnly ? 'default' : 'pointer' }}
          onClick={readOnly ? undefined : () => editing.startEditDate(release.id, 'late', release.lateFinishDate)}
        >
          {formatDateShort(release.lateFinishDate)}
        </text>
      )}
    </g>
  );
}
