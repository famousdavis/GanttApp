// Gantt Chart SVG component with inline editing support

import { useState, useRef } from 'react';
import { Project, Release, ChartColors, ChartDisplaySettings } from '../../shared/types';
import { useTheme } from '../../context/ThemeContext';
import { formatDateShort, getTodayString, getTodayFormatted, parseDateLocal, getQuarterBoundaries } from '../../shared/utils/dates';
import { COMPLETED_RELEASE_COLORS } from '../../shared/utils/colors';
import { InlineDateEditor } from '../../shared/components/InlineDateEditor';
import { InlineTextEditor } from '../../shared/components/InlineTextEditor';
import { ChartLegend } from './ChartLegend';
import { ChartSettings } from './ChartSettings';
import { DateType, LegendLabelType } from './useChartEditing';

interface GanttChartProps {
  releases: Release[];
  projectName: string;
  projectFinishDate?: string;
  projects: Project[];
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  chartColors: ChartColors;
  onColorsChange: (colors: ChartColors, presetName?: string) => void;
  activePreset?: string;
  showColorSettings: boolean;
  setShowColorSettings: (show: boolean) => void;
  showTodayLine: boolean;
  setShowTodayLine: (show: boolean) => void;
  showFinishDateLine: boolean;
  setShowFinishDateLine: (show: boolean) => void;
  solidBarLabel: string;
  hatchedBarLabel: string;
  finishDateLabel: string;
  editingLegendLabel: LegendLabelType | null;
  tempLabelValue: string;
  onStartEditLabel: (type: LegendLabelType) => void;
  onSaveLabelEdit: () => void;
  onCancelLabelEdit: () => void;
  onTempLabelChange: (value: string) => void;
  displaySettings: ChartDisplaySettings;
  setDisplaySettings: (settings: ChartDisplaySettings) => void;
  editingReleaseId: string | null;
  tempReleaseName: string;
  onStartEditReleaseName: (releaseId: string, currentName: string) => void;
  onSaveReleaseNameEdit: () => void;
  onCancelReleaseNameEdit: () => void;
  onTempReleaseNameChange: (value: string) => void;
  editingDateInfo: { releaseId: string; dateType: DateType } | null;
  tempDateValue: string;
  onStartEditDate: (releaseId: string, dateType: DateType, currentDate: string) => void;
  onSaveDateEdit: () => void;
  onCancelDateEdit: () => void;
  onTempDateChange: (value: string) => void;
  dateEditError: string;
}

export function GanttChart({
  releases,
  projectFinishDate,
  projects,
  selectedProjectId,
  setSelectedProjectId,
  chartColors,
  onColorsChange,
  activePreset,
  showColorSettings,
  setShowColorSettings,
  showTodayLine,
  setShowTodayLine,
  showFinishDateLine,
  setShowFinishDateLine,
  solidBarLabel,
  hatchedBarLabel,
  finishDateLabel,
  editingLegendLabel,
  tempLabelValue,
  onStartEditLabel,
  onSaveLabelEdit,
  onCancelLabelEdit,
  onTempLabelChange,
  displaySettings,
  setDisplaySettings,
  editingReleaseId,
  tempReleaseName,
  onStartEditReleaseName,
  onSaveReleaseNameEdit,
  onCancelReleaseNameEdit,
  onTempReleaseNameChange,
  editingDateInfo,
  tempDateValue,
  onStartEditDate,
  onSaveDateEdit,
  onCancelDateEdit,
  onTempDateChange,
  dateEditError
}: GanttChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'success' | 'error'>('idle');
  const { colors } = useTheme();

  if (releases.length === 0) {
    return <p style={{ color: colors.textMuted, fontStyle: 'italic' }}>No releases to display.</p>;
  }

  // Calculate date range
  const allDates = releases.flatMap(r => [
    parseDateLocal(r.startDate),
    parseDateLocal(r.lateFinishDate)
  ]);

  const minDate = Math.min(...allDates);
  const maxDate = Math.max(...allDates);
  const dateRange = maxDate - minDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  // Chart dimensions
  const chartWidth = 1100;
  const barHeight = parseInt(displaySettings.barHeight);
  const rowSpacing = parseInt(displaySettings.rowSpacing);
  const rowHeight = barHeight + rowSpacing;
  const chartHeight = releases.length * rowHeight + 80;
  const leftMargin = 280;
  const rightMargin = 50;
  const topMargin = 50;

  const dateToX = (date: string) => {
    const timestamp = parseDateLocal(date);
    const ratio = dateRange > 0 ? (timestamp - minDate) / dateRange : 0.5;
    return leftMargin + ratio * (chartWidth - leftMargin - rightMargin);
  };

  // Get colors for a release
  const getReleaseColors = (release: Release) => {
    if (release.completed) {
      return COMPLETED_RELEASE_COLORS;
    }
    return {
      solidBar: chartColors.solidBar,
      hatchedBar: chartColors.hatchedBar
    };
  };

  // Quarter boundaries
  const quarterBoundaries = getQuarterBoundaries(minDate, maxDate);

  // Today's date line
  const todayInRange = todayTime >= minDate && todayTime <= maxDate;
  const todayX = todayInRange ? dateToX(getTodayString()) : null;

  // Project finish date line
  let finishDateInRange = false;
  let finishDateX: number | null = null;
  if (projectFinishDate) {
    const finishDateTime = parseDateLocal(projectFinishDate);
    finishDateInRange = finishDateTime >= minDate && finishDateTime <= maxDate;
    finishDateX = finishDateInRange ? dateToX(projectFinishDate) : null;
  }

  // Copy chart as image
  const copyChartAsImage = async () => {
    if (!chartRef.current) return;
    setCopyStatus('copying');
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(chartRef.current, {
        ignoreElements: (element) => element.classList.contains('copy-image-button')
      });
      canvas.toBlob((blob) => {
        if (blob) {
          navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(() => {
            setCopyStatus('success');
            setTimeout(() => setCopyStatus('idle'), 2000);
          }).catch(() => setCopyStatus('error'));
        }
      });
    } catch {
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  };

  // Get years to display
  const startYear = new Date(minDate).getFullYear();
  const endYear = new Date(maxDate).getFullYear();
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

  // Minimum label spacing for collision detection
  const MIN_LABEL_SPACING = 40;

  return (
    <div>
      <div ref={chartRef}>
        {/* Chart header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            style={{
              fontSize: '1.5rem',
              color: colors.text,
              margin: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 600,
              padding: 0,
              outline: 'none'
            }}
          >
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontSize: '0.9rem', color: colors.textSecondary }}>
              Date Prepared: {getTodayFormatted()}
            </div>
            <button
              className="copy-image-button"
              onClick={copyChartAsImage}
              disabled={copyStatus === 'copying'}
              style={{
                padding: '0.25rem 0.5rem',
                background: 'transparent',
                color: '#0070f3',
                border: 'none',
                cursor: copyStatus === 'copying' ? 'wait' : 'pointer',
                fontSize: '1.25rem'
              }}
              title="Copy Chart as Image"
            >
              {copyStatus === 'copying' && '⏳'}
              {copyStatus === 'success' && '✅'}
              {copyStatus === 'error' && '❌'}
              {copyStatus === 'idle' && '📋'}
            </button>
          </div>
        </div>

        {/* SVG Chart */}
        <div style={{ overflowX: 'auto', background: 'white', padding: '2rem', borderRadius: '8px', border: '2px solid #eee' }}>
          <svg width={chartWidth} height={chartHeight}>
            {/* Quarterly gridlines */}
            {quarterBoundaries.map((date, i) => {
              const x = dateToX(date.toISOString().split('T')[0]);
              const month = date.getMonth();
              let quarterLabel = '';
              if (month === 3) quarterLabel = 'Q2';
              else if (month === 6) quarterLabel = 'Q3';
              else if (month === 9) quarterLabel = 'Q4';

              return (
                <g key={i}>
                  <line
                    x1={x} y1={topMargin} x2={x} y2={chartHeight}
                    stroke="#c0c0c0" strokeWidth="1" strokeDasharray="4"
                  />
                  {quarterLabel && (
                    <text x={x + 5} y={topMargin - 15} fontSize="14" fill="#999" fontWeight="600" textAnchor="start">
                      {quarterLabel}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Today's date line */}
            {showTodayLine && todayX && (
              <line
                x1={todayX} y1={topMargin - 10} x2={todayX} y2={chartHeight}
                stroke={chartColors.todayLine} strokeWidth={displaySettings.verticalLineWidth}
              />
            )}

            {/* Project finish date line */}
            {showFinishDateLine && finishDateX && (
              <line
                x1={finishDateX} y1={topMargin - 10} x2={finishDateX} y2={chartHeight}
                stroke={chartColors.finishDateLine} strokeWidth={displaySettings.verticalLineWidth}
              />
            )}

            {/* Year labels */}
            {years.map((year, index) => {
              let x: number;
              if (index === 0) {
                x = leftMargin + 20;
              } else {
                const jan1 = new Date(year, 0, 1).getTime();
                if (jan1 < minDate || jan1 > maxDate) return null;
                x = dateToX(new Date(year, 0, 1).toISOString().split('T')[0]);
              }

              return (
                <text key={year} x={x} y={topMargin - 15} fontSize="16" fill="#333" fontWeight="600" textAnchor="middle">
                  {year}
                </text>
              );
            })}

            {/* Releases */}
            {releases.map((release, i) => {
              const y = topMargin + i * rowHeight;
              const startX = dateToX(release.startDate);
              const earlyX = dateToX(release.earlyFinishDate);
              const lateX = dateToX(release.lateFinishDate);
              const releaseColors = getReleaseColors(release);
              const showEarlyLabel = (earlyX - startX) >= MIN_LABEL_SPACING && (lateX - earlyX) >= MIN_LABEL_SPACING;

              return (
                <g key={release.id}>
                  {/* Release name */}
                  {editingReleaseId === release.id ? (
                    <foreignObject x={10} y={y + barHeight / 2 - 12} width={270} height={24}>
                      <InlineTextEditor
                        value={tempReleaseName}
                        onChange={onTempReleaseNameChange}
                        onSave={onSaveReleaseNameEdit}
                        onCancel={onCancelReleaseNameEdit}
                        fontSize={displaySettings.releaseNameFontSize + 'px'}
                      />
                    </foreignObject>
                  ) : (
                    <text
                      x={10} y={y + barHeight / 2}
                      fontSize={displaySettings.releaseNameFontSize} fill="#333" fontWeight="600"
                      textAnchor="start" dominantBaseline="middle"
                      style={{ cursor: 'pointer' }}
                      onClick={() => onStartEditReleaseName(release.id, release.name)}
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
                  {editingDateInfo?.releaseId === release.id && editingDateInfo?.dateType === 'start' ? (
                    <foreignObject x={startX - 70} y={y + barHeight + 2} width={140} height={28}>
                      <InlineDateEditor
                        value={tempDateValue}
                        onChange={onTempDateChange}
                        onSave={onSaveDateEdit}
                        onCancel={onCancelDateEdit}
                        hasError={!!dateEditError}
                      />
                    </foreignObject>
                  ) : (
                    <text
                      x={startX} y={y + barHeight + 15}
                      fontSize={displaySettings.dateLabelFontSize} fill={displaySettings.dateLabelColor}
                      textAnchor="middle" style={{ cursor: 'pointer' }}
                      onClick={() => onStartEditDate(release.id, 'start', release.startDate)}
                    >
                      {formatDateShort(release.startDate)}
                    </text>
                  )}

                  {/* Early finish date label */}
                  {showEarlyLabel && (
                    editingDateInfo?.releaseId === release.id && editingDateInfo?.dateType === 'early' ? (
                      <foreignObject x={earlyX - 70} y={y + barHeight + 2} width={140} height={28}>
                        <InlineDateEditor
                          value={tempDateValue}
                          onChange={onTempDateChange}
                          onSave={onSaveDateEdit}
                          onCancel={onCancelDateEdit}
                          hasError={!!dateEditError}
                        />
                      </foreignObject>
                    ) : (
                      <text
                        x={earlyX} y={y + barHeight + 15}
                        fontSize={displaySettings.dateLabelFontSize} fill={displaySettings.dateLabelColor}
                        textAnchor="middle" style={{ cursor: 'pointer' }}
                        onClick={() => onStartEditDate(release.id, 'early', release.earlyFinishDate)}
                      >
                        {formatDateShort(release.earlyFinishDate)}
                      </text>
                    )
                  )}

                  {/* Late finish date label */}
                  {editingDateInfo?.releaseId === release.id && editingDateInfo?.dateType === 'late' ? (
                    <foreignObject x={Math.min(lateX - 70, chartWidth - 145)} y={y + barHeight + 2} width={140} height={28}>
                      <InlineDateEditor
                        value={tempDateValue}
                        onChange={onTempDateChange}
                        onSave={onSaveDateEdit}
                        onCancel={onCancelDateEdit}
                        hasError={!!dateEditError}
                      />
                    </foreignObject>
                  ) : (
                    <text
                      x={lateX} y={y + barHeight + 15}
                      fontSize={displaySettings.dateLabelFontSize} fill={displaySettings.dateLabelColor}
                      textAnchor="middle" style={{ cursor: 'pointer' }}
                      onClick={() => onStartEditDate(release.id, 'late', release.lateFinishDate)}
                    >
                      {formatDateShort(release.lateFinishDate)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <ChartLegend
          chartColors={chartColors}
          displaySettings={displaySettings}
          solidBarLabel={solidBarLabel}
          hatchedBarLabel={hatchedBarLabel}
          finishDateLabel={finishDateLabel}
          showTodayLine={showTodayLine}
          showFinishDateLine={showFinishDateLine}
          hasProjectFinishDate={!!projectFinishDate}
          editingLegendLabel={editingLegendLabel}
          tempLabelValue={tempLabelValue}
          onStartEditLabel={onStartEditLabel}
          onSaveLabelEdit={onSaveLabelEdit}
          onCancelLabelEdit={onCancelLabelEdit}
          onTempLabelChange={onTempLabelChange}
        />
      </div>

      {/* Chart Settings */}
      <ChartSettings
        showColorSettings={showColorSettings}
        setShowColorSettings={setShowColorSettings}
        showTodayLine={showTodayLine}
        setShowTodayLine={setShowTodayLine}
        showFinishDateLine={showFinishDateLine}
        setShowFinishDateLine={setShowFinishDateLine}
        hasProjectFinishDate={!!projectFinishDate}
        displaySettings={displaySettings}
        setDisplaySettings={setDisplaySettings}
        chartColors={chartColors}
        onColorsChange={onColorsChange}
        activePreset={activePreset}
      />
    </div>
  );
}
