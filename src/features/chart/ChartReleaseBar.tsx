// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Individual release bar rendering within the Gantt chart SVG

import { Release, ChartDisplaySettings } from '../../shared/types';
import { formatDateShort } from '../../shared/utils/dates';
import { getWorkDayWarning } from '../../shared/utils/validation';
import { InlineDateEditor } from '../../shared/components/InlineDateEditor';
import { InlineTextEditor } from '../../shared/components/InlineTextEditor';
import { ChartEditingProps } from './GanttChart';

/** Amber color used for non-workday date label tint and inline-editor warning text. */
const NON_WORKDAY_COLOR = '#d97706';

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
  showMostLikelyLine: boolean;
  mostLikelyLineColor: string;
  /** v16.3: effective work days. Non-workday date labels render in amber with a tooltip. */
  workDays?: number[];
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
  minLabelSpacing,
  showMostLikelyLine,
  mostLikelyLineColor,
  workDays
}: ChartReleaseBarProps) {
  const startX = dateToX(release.startDate);
  const earlyX = dateToX(release.earlyFinishDate);
  const lateX = dateToX(release.lateFinishDate);
  const showEarlyLabel = (earlyX - startX) >= minLabelSpacing && (lateX - earlyX) >= minLabelSpacing;

  // Most Likely Finish Date calculations
  const mlDate = release.mostLikelyFinishDate;
  const mlX = mlDate ? dateToX(mlDate) : null;

  // Per-date work-day warnings (v16.3). Empty string when the date is a workday or
  // when workDays is unconfigured. Used to tint labels amber and to annotate the
  // inline date editor.
  const startWarning = getWorkDayWarning(release.startDate, workDays);
  const earlyWarning = getWorkDayWarning(release.earlyFinishDate, workDays);
  const lateWarning = getWorkDayWarning(release.lateFinishDate, workDays);
  const mlWarning = mlDate ? getWorkDayWarning(mlDate, workDays) : '';

  // Warning message for the currently-edited date field — shown beneath the inline editor.
  const activeEditWarning = editing.editingDateInfo?.releaseId === release.id
    ? (() => {
        if (editing.dateEditError) return ''; // Don't stack warning on top of error
        const date = editing.tempDateValue;
        if (!date || date.length !== 10) return '';
        return getWorkDayWarning(date, workDays);
      })()
    : '';

  // Most Likely label suppression: hide if too close to Early, Late, or Start labels
  const showMlLabel = mlX !== null && showMostLikelyLine
    && Math.abs(mlX - startX) >= minLabelSpacing
    && Math.abs(mlX - lateX) >= minLabelSpacing
    && (!showEarlyLabel || Math.abs(mlX - earlyX) >= minLabelSpacing);

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

      {release.status === 'complete' ? (
        /* Completed: single solid bar from start to late (no uncertainty) */
        <rect
          x={startX} y={y} width={lateX - startX} height={barHeight}
          fill={releaseColors.solidBar} stroke={releaseColors.solidBar} strokeWidth="2" rx="4"
        />
      ) : (
        <>
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

          {/* Most Likely Finish Date vertical line (within hatched bar) */}
          {showMostLikelyLine && mlX !== null && (
            <line
              x1={mlX} y1={y}
              x2={mlX} y2={y + barHeight}
              stroke={mostLikelyLineColor}
              strokeWidth={displaySettings.verticalLineWidth}
            />
          )}
        </>
      )}

      {/* Start date label */}
      {!readOnly && editing.editingDateInfo?.releaseId === release.id && editing.editingDateInfo?.dateType === 'start' ? (
        <foreignObject x={startX - 70} y={y + barHeight + 2} width={140} height={48}>
          <InlineDateEditor
            value={editing.tempDateValue}
            onChange={editing.setTempDateValue}
            onSave={editing.saveDateEdit}
            onCancel={editing.cancelDateEdit}
            hasError={!!editing.dateEditError}
            warning={activeEditWarning}
          />
        </foreignObject>
      ) : (
        <text
          x={startX} y={y + barHeight + 15}
          fontSize={displaySettings.dateLabelFontSize}
          fill={startWarning ? NON_WORKDAY_COLOR : displaySettings.dateLabelColor}
          fontWeight={startWarning ? '600' : 'normal'}
          textAnchor="middle" style={{ cursor: readOnly ? 'default' : 'pointer' }}
          onClick={readOnly ? undefined : () => editing.startEditDate(release.id, 'start', release.startDate)}
        >
          {startWarning && <title>{startWarning}</title>}
          {formatDateShort(release.startDate)}
        </text>
      )}

      {/* Early finish date label (hidden for completed releases — no uncertainty) */}
      {release.status !== 'complete' && showEarlyLabel && (
        !readOnly && editing.editingDateInfo?.releaseId === release.id && editing.editingDateInfo?.dateType === 'early' ? (
          <foreignObject x={earlyX - 70} y={y + barHeight + 2} width={140} height={48}>
            <InlineDateEditor
              value={editing.tempDateValue}
              onChange={editing.setTempDateValue}
              onSave={editing.saveDateEdit}
              onCancel={editing.cancelDateEdit}
              hasError={!!editing.dateEditError}
              warning={activeEditWarning}
            />
          </foreignObject>
        ) : (
          <text
            x={earlyX} y={y + barHeight + 15}
            fontSize={displaySettings.dateLabelFontSize}
            fill={earlyWarning ? NON_WORKDAY_COLOR : displaySettings.dateLabelColor}
            fontWeight={earlyWarning ? '600' : 'normal'}
            textAnchor="middle" style={{ cursor: readOnly ? 'default' : 'pointer' }}
            onClick={readOnly ? undefined : () => editing.startEditDate(release.id, 'early', release.earlyFinishDate)}
          >
            {earlyWarning && <title>{earlyWarning}</title>}
            {formatDateShort(release.earlyFinishDate)}
          </text>
        )
      )}

      {/* Late finish date label */}
      {!readOnly && editing.editingDateInfo?.releaseId === release.id && editing.editingDateInfo?.dateType === 'late' ? (
        <foreignObject x={Math.min(lateX - 70, chartWidth - 145)} y={y + barHeight + 2} width={140} height={48}>
          <InlineDateEditor
            value={editing.tempDateValue}
            onChange={editing.setTempDateValue}
            onSave={editing.saveDateEdit}
            onCancel={editing.cancelDateEdit}
            hasError={!!editing.dateEditError}
            warning={activeEditWarning}
          />
        </foreignObject>
      ) : (
        <text
          x={lateX} y={y + barHeight + 15}
          fontSize={displaySettings.dateLabelFontSize}
          fill={lateWarning ? NON_WORKDAY_COLOR : displaySettings.dateLabelColor}
          fontWeight={lateWarning ? '600' : 'normal'}
          textAnchor="middle" style={{ cursor: readOnly ? 'default' : 'pointer' }}
          onClick={readOnly ? undefined : () => editing.startEditDate(release.id, 'late', release.lateFinishDate)}
        >
          {lateWarning && <title>{lateWarning}</title>}
          {formatDateShort(release.lateFinishDate)}
        </text>
      )}

      {/* Most Likely Finish date label (hidden for completed releases) */}
      {release.status !== 'complete' && showMostLikelyLine && showMlLabel && mlDate && (
        !readOnly && editing.editingDateInfo?.releaseId === release.id && editing.editingDateInfo?.dateType === 'mostLikely' ? (
          <foreignObject x={mlX! - 70} y={y + barHeight + 2} width={140} height={48}>
            <InlineDateEditor
              value={editing.tempDateValue}
              onChange={editing.setTempDateValue}
              onSave={editing.saveDateEdit}
              onCancel={editing.cancelDateEdit}
              hasError={!!editing.dateEditError}
              warning={activeEditWarning}
            />
          </foreignObject>
        ) : (
          <text
            x={mlX!} y={y + barHeight + 15}
            fontSize={displaySettings.dateLabelFontSize}
            fill={mlWarning ? NON_WORKDAY_COLOR : displaySettings.dateLabelColor}
            fontWeight={mlWarning ? '600' : 'normal'}
            textAnchor="middle" style={{ cursor: readOnly ? 'default' : 'pointer' }}
            onClick={readOnly ? undefined : () => editing.startEditDate(release.id, 'mostLikely', mlDate)}
          >
            {mlWarning && <title>{mlWarning}</title>}
            {formatDateShort(mlDate)}
          </text>
        )
      )}
    </g>
  );
}
