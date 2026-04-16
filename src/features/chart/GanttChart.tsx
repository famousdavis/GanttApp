// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Gantt Chart SVG component with inline editing support

import { useState, useRef } from 'react';
import { Project, Release, ChartColors, ChartDisplaySettings, Snapshot } from '../../shared/types';
import { useTheme } from '../../context/ThemeContext';
import { getTodayFormatted, formatDateShort, getTodayString } from '../../shared/utils/dates';
import { ChartLegend } from './ChartLegend';
import { ChartSettings } from './ChartSettings';
import { ChartReleaseBar } from './ChartReleaseBar';
import { SnapshotBar } from './SnapshotBar';
import { useChartCalculations } from './useChartCalculations';
import { DateType, LegendLabelType } from './useChartEditing';

// --- Prop group interfaces ---

export interface ChartEditingProps {
  editingLegendLabel: LegendLabelType | null;
  tempLabelValue: string;
  setTempLabelValue: (value: string) => void;
  startEditLabel: (type: LegendLabelType) => void;
  saveLabelEdit: () => void;
  cancelLabelEdit: () => void;
  editingReleaseId: string | null;
  tempReleaseName: string;
  setTempReleaseName: (value: string) => void;
  startEditReleaseName: (releaseId: string, currentName: string) => void;
  saveReleaseNameEdit: () => void;
  cancelReleaseNameEdit: () => void;
  editingDateInfo: { releaseId: string; dateType: DateType } | null;
  tempDateValue: string;
  setTempDateValue: (value: string) => void;
  startEditDate: (releaseId: string, dateType: DateType, currentDate: string) => void;
  saveDateEdit: () => void;
  cancelDateEdit: () => void;
  dateEditError: string;
}

export interface ChartSnapshotProps {
  snapshots: Snapshot[];
  activeSnapshotId: string | null;
  onSelectSnapshot: (id: string | null) => void;
  onSaveSnapshot: () => void;
  onDeleteSnapshot: (id: string) => void;
  readOnly: boolean;
  datePreparedOverride?: string;
}

export interface ChartLabelProps {
  solidBarLabel: string;
  hatchedBarLabel: string;
  finishDateLabel: string;
  mostLikelyLineLabel: string;
  inProgressLabel: string;
}

export interface ChartSettingsGroupProps {
  displaySettings: ChartDisplaySettings;
  setDisplaySettings: (settings: ChartDisplaySettings) => void;
  chartColors: ChartColors;
  onColorsChange: (colors: ChartColors, presetName?: string) => void;
  activePreset?: string;
  showColorSettings: boolean;
  setShowColorSettings: (show: boolean) => void;
  showTodayLine: boolean;
  setShowTodayLine: (show: boolean) => void;
  showFinishDateLine: boolean;
  setShowFinishDateLine: (show: boolean) => void;
  preparedBy: string;
  setPreparedBy: (name: string) => void;
  showPreparedBy: boolean;
  setShowPreparedBy: (show: boolean) => void;
  showMostLikelyLine: boolean;
  setShowMostLikelyLine: (show: boolean) => void;
  showMonths: boolean;
  setShowMonths: (show: boolean) => void;
}

// --- Main component props ---

interface GanttChartProps {
  releases: Release[];
  projectFinishDate?: string;
  projects: Project[];
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  editing: ChartEditingProps;
  snapshot: ChartSnapshotProps;
  labels: ChartLabelProps;
  settings: ChartSettingsGroupProps;
}

export function GanttChart({
  releases,
  projectFinishDate,
  projects,
  selectedProjectId,
  setSelectedProjectId,
  editing,
  snapshot,
  labels,
  settings,
}: GanttChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'success' | 'error'>('idle');
  const { colors } = useTheme();

  // Destructure grouped props for convenient access
  const { readOnly, datePreparedOverride } = snapshot;
  const { displaySettings, chartColors, showTodayLine, showFinishDateLine, showPreparedBy, showMostLikelyLine, showMonths } = settings;
  const { preparedBy } = settings;

  // Chart calculations (dimensions, date math, coordinate mapping)
  const { dimensions, dateInfo, finishDateInfo, dateToX, years, getReleaseColors, minLabelSpacing } =
    useChartCalculations(releases, displaySettings, projectFinishDate, showMonths);
  const { chartWidth, chartHeight, leftMargin, topMargin, barHeight, rowHeight } = dimensions;
  const { todayX, quarterBoundaries, monthBoundaries } = dateInfo;
  const { finishDateX } = finishDateInfo;

  // When months are shown, push year/quarter labels up to make room for month row
  const headerLabelY = showMonths ? topMargin - 25 : topMargin - 15;

  // Compute derived flags once for use in Legend and Settings
  const hasProjectFinishDate = !!projectFinishDate;
  const hasMostLikelyReleases = releases.some(r => !!r.mostLikelyFinishDate);
  const hasCompletedReleases = releases.some(r => r.status === 'complete');
  const hasInProgressReleases = releases.some(r => r.status === 'in-progress');

  if (releases.length === 0) {
    return (
      <div>
        <SnapshotBar
          snapshots={snapshot.snapshots}
          activeSnapshotId={snapshot.activeSnapshotId}
          onSelectSnapshot={snapshot.onSelectSnapshot}
          onSaveSnapshot={snapshot.onSaveSnapshot}
          onDeleteSnapshot={snapshot.onDeleteSnapshot}
        />
        <p style={{ color: colors.textMuted, fontStyle: 'italic' }}>No releases to display.</p>
      </div>
    );
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

  return (
    <div>
      {/* Snapshot navigation bar */}
      <SnapshotBar
        snapshots={snapshot.snapshots}
        activeSnapshotId={snapshot.activeSnapshotId}
        onSelectSnapshot={snapshot.onSelectSnapshot}
        onSaveSnapshot={snapshot.onSaveSnapshot}
        onDeleteSnapshot={snapshot.onDeleteSnapshot}
      />

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
            {showPreparedBy && preparedBy && (
              <div style={{ fontSize: '0.9rem', color: colors.textSecondary }}>
                Prepared By: {preparedBy}
              </div>
            )}
            <div style={{ fontSize: '0.9rem', color: colors.textSecondary }}>
              Date Prepared: {datePreparedOverride || getTodayFormatted()}
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
        <div style={{ overflowX: 'hidden', background: 'white', padding: '2rem', borderRadius: '8px', border: '2px solid #eee' }}>
          <svg width={chartWidth} height={chartHeight}>
            {/* Quarterly gridlines */}
            {(() => {
              // Pre-compute year label positions to avoid quarter/year label overlap
              const yearLabelPositions = years.map((year, index) => {
                if (index === 0) return leftMargin + 20;
                const jan1 = new Date(year, 0, 1).getTime();
                if (jan1 < dateInfo.minDate || jan1 > dateInfo.maxDate) return null;
                return dateToX(new Date(year, 0, 1).toISOString().split('T')[0]);
              }).filter((x): x is number => x !== null);

              return quarterBoundaries.map((date, i) => {
                const x = dateToX(date.toISOString().split('T')[0]);
                const month = date.getMonth();
                let quarterLabel = '';
                if (month === 3) quarterLabel = 'Q2';
                else if (month === 6) quarterLabel = 'Q3';
                else if (month === 9) quarterLabel = 'Q4';

                // Skip quarter label if too close to a year label
                const tooCloseToYear = quarterLabel && yearLabelPositions.some(yx => Math.abs(x - yx) < 50);

                return (
                  <g key={i}>
                    <line
                      x1={x} y1={topMargin} x2={x} y2={chartHeight}
                      stroke="#c0c0c0" strokeWidth="1" strokeDasharray="4"
                    />
                    {quarterLabel && !tooCloseToYear && (
                      <text x={x + 5} y={headerLabelY} fontSize="14" fill="#999" fontWeight="600" textAnchor="start">
                        {quarterLabel}
                      </text>
                    )}
                  </g>
                );
              });
            })()}

            {/* Monthly gridlines and labels */}
            {showMonths && (() => {
              const MONTH_ABBREVS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

              return monthBoundaries.map((date, i) => {
                const x = dateToX(date.toISOString().split('T')[0]);
                const month = date.getMonth();

                return (
                  <g key={`month-${i}`}>
                    <line
                      x1={x} y1={topMargin} x2={x} y2={chartHeight}
                      stroke="#e8e8e8" strokeWidth="0.5"
                    />
                    <text x={x + 3} y={topMargin - 8} fontSize="11" fill="#bbb" textAnchor="start">
                      {MONTH_ABBREVS[month]}
                    </text>
                  </g>
                );
              });
            })()}

            {/* Today's date line + label */}
            {showTodayLine && todayX && (
              <g>
                <line
                  x1={todayX} y1={topMargin - 10} x2={todayX} y2={chartHeight}
                  stroke={chartColors.todayLine} strokeWidth={displaySettings.verticalLineWidth}
                />
                <text
                  x={todayX}
                  y={headerLabelY - 14}
                  fontSize="11"
                  fill={chartColors.todayLine}
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {formatDateShort(getTodayString())}
                </text>
              </g>
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
                if (jan1 < dateInfo.minDate || jan1 > dateInfo.maxDate) return null;
                x = dateToX(new Date(year, 0, 1).toISOString().split('T')[0]);
              }

              return (
                <text key={year} x={x} y={headerLabelY} fontSize="16" fill="#333" fontWeight="600" textAnchor="middle">
                  {year}
                </text>
              );
            })}

            {/* Releases */}
            {releases.map((release, i) => (
              <ChartReleaseBar
                key={release.id}
                release={release}
                y={topMargin + i * rowHeight}
                barHeight={barHeight}
                chartWidth={chartWidth}
                dateToX={dateToX}
                releaseColors={getReleaseColors(release, chartColors)}
                displaySettings={displaySettings}
                readOnly={readOnly}
                editing={editing}
                minLabelSpacing={minLabelSpacing}
                showMostLikelyLine={showMostLikelyLine}
                mostLikelyLineColor={chartColors.mostLikelyLine}
              />
            ))}
          </svg>
        </div>

        {/* Legend */}
        <ChartLegend
          chartColors={chartColors}
          displaySettings={displaySettings}
          solidBarLabel={labels.solidBarLabel}
          hatchedBarLabel={labels.hatchedBarLabel}
          finishDateLabel={labels.finishDateLabel}
          mostLikelyLineLabel={labels.mostLikelyLineLabel}
          inProgressLabel={labels.inProgressLabel}
          showTodayLine={showTodayLine}
          showFinishDateLine={showFinishDateLine}
          showMostLikelyLine={showMostLikelyLine}
          hasProjectFinishDate={hasProjectFinishDate}
          hasMostLikelyReleases={hasMostLikelyReleases}
          hasCompletedReleases={hasCompletedReleases}
          hasInProgressReleases={hasInProgressReleases}
          editingLegendLabel={editing.editingLegendLabel}
          tempLabelValue={editing.tempLabelValue}
          onStartEditLabel={editing.startEditLabel}
          onSaveLabelEdit={editing.saveLabelEdit}
          onCancelLabelEdit={editing.cancelLabelEdit}
          onTempLabelChange={editing.setTempLabelValue}
          readOnly={readOnly}
        />
      </div>

      {/* Read-only banner when viewing a snapshot — placed below chart so toggling doesn't shift chart position */}
      {readOnly && snapshot.activeSnapshotId && (() => {
        const snap = snapshot.snapshots.find(s => s.id === snapshot.activeSnapshotId);
        if (!snap) return null;
        const formatDate = (ts: string) => new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        return (
          <div className="copy-image-button" style={{
            marginTop: '0.75rem',
            padding: '0.4rem 0.75rem',
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '6px',
            fontSize: '0.85rem',
            color: '#856404'
          }}>
            Viewing snapshot: {snap.name} ({formatDate(snap.timestamp)}) &mdash; Read Only
          </div>
        );
      })()}

      {/* Chart Settings */}
      <ChartSettings
        showColorSettings={settings.showColorSettings}
        setShowColorSettings={settings.setShowColorSettings}
        showTodayLine={showTodayLine}
        setShowTodayLine={settings.setShowTodayLine}
        showFinishDateLine={showFinishDateLine}
        setShowFinishDateLine={settings.setShowFinishDateLine}
        showMostLikelyLine={showMostLikelyLine}
        setShowMostLikelyLine={settings.setShowMostLikelyLine}
        showMonths={showMonths}
        setShowMonths={settings.setShowMonths}
        hasProjectFinishDate={hasProjectFinishDate}
        hasMostLikelyReleases={hasMostLikelyReleases}
        displaySettings={displaySettings}
        setDisplaySettings={settings.setDisplaySettings}
        chartColors={chartColors}
        onColorsChange={settings.onColorsChange}
        activePreset={settings.activePreset}
        preparedBy={preparedBy}
        setPreparedBy={settings.setPreparedBy}
        showPreparedBy={showPreparedBy}
        setShowPreparedBy={settings.setShowPreparedBy}
      />
    </div>
  );
}
