import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { AppDataProvider, useAppData } from '../src/context/AppDataContext';
import { Project, Release, ChartColors, ChartDisplaySettings, TabType } from '../src/shared/types';
import { Tabs } from '../src/shared/components/Tabs';
import { ProjectsTab } from '../src/features/projects/ProjectsTab';
import { ReleasesTab } from '../src/features/releases/ReleasesTab';
import { AboutTab } from '../src/features/about/AboutTab';
import { ChangelogTab } from '../src/features/changelog/ChangelogTab';
import { COLOR_PRESETS, COMPLETED_RELEASE_COLORS, STANDARD_COLORS } from '../src/shared/utils/colors';
import { formatDateShort, getTodayString, getTodayFormatted, parseDateLocal, getQuarterBoundaries } from '../src/shared/utils/dates';
import { ColorSwatchPicker, GrayscaleSwatchPicker, PresetButtonGroup } from '../src/shared/components/ColorPickers';

// Gantt Chart Component (kept inline for now - can be extracted in future iteration)
function GanttChart({
  releases,
  projectName,
  projectFinishDate,
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
  setDisplaySettings
}: {
  releases: Release[],
  projectName: string,
  projectFinishDate?: string,
  chartColors: ChartColors,
  onColorsChange: (colors: ChartColors, presetName?: string) => void,
  activePreset?: string,
  showColorSettings: boolean,
  setShowColorSettings: (show: boolean) => void,
  showTodayLine: boolean,
  setShowTodayLine: (show: boolean) => void,
  showFinishDateLine: boolean,
  setShowFinishDateLine: (show: boolean) => void,
  solidBarLabel: string,
  hatchedBarLabel: string,
  finishDateLabel: string,
  editingLegendLabel: 'solid' | 'hatched' | 'finishDate' | null,
  tempLabelValue: string,
  onStartEditLabel: (type: 'solid' | 'hatched' | 'finishDate') => void,
  onSaveLabelEdit: () => void,
  onCancelLabelEdit: () => void,
  onTempLabelChange: (value: string) => void,
  displaySettings: ChartDisplaySettings,
  setDisplaySettings: (settings: ChartDisplaySettings) => void
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'success' | 'error'>('idle');

  if (releases.length === 0) {
    return <p style={{ color: '#999', fontStyle: 'italic' }}>No releases to display.</p>;
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
  const chartHeight = releases.length * 60 + 80;
  const leftMargin = 280;
  const rightMargin = 50;
  const topMargin = 50;
  const barHeight = 30;
  const rowHeight = 60;

  const dateToX = (date: string) => {
    const timestamp = parseDateLocal(date);
    const ratio = (timestamp - minDate) / dateRange;
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
      const canvas = await html2canvas(chartRef.current);
      canvas.toBlob((blob) => {
        if (blob) {
          navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(() => {
            setCopyStatus('success');
            setTimeout(() => setCopyStatus('idle'), 2000);
          }).catch(() => setCopyStatus('error'));
        }
      });
    } catch (error) {
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  };

  // Get years to display
  const startYear = new Date(minDate).getFullYear();
  const endYear = new Date(maxDate).getFullYear();
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

  return (
    <div>
      <div ref={chartRef}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#333', margin: 0 }}>{projectName}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>
              Date Prepared: {getTodayFormatted()}
            </div>
            <button
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
                    x1={x}
                    y1={topMargin}
                    x2={x}
                    y2={chartHeight}
                    stroke="#c0c0c0"
                    strokeWidth="1"
                    strokeDasharray="4"
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
                x1={todayX}
                y1={topMargin - 10}
                x2={todayX}
                y2={chartHeight}
                stroke={chartColors.todayLine}
                strokeWidth={displaySettings.verticalLineWidth}
              />
            )}

            {/* Project finish date line */}
            {showFinishDateLine && finishDateX && (
              <line
                x1={finishDateX}
                y1={topMargin - 10}
                x2={finishDateX}
                y2={chartHeight}
                stroke={chartColors.finishDateLine}
                strokeWidth={displaySettings.verticalLineWidth}
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
              const colors = getReleaseColors(release);

              // Label collision detection
              const MIN_LABEL_SPACING = 40;
              const showEarlyLabel = (earlyX - startX) >= MIN_LABEL_SPACING && (lateX - earlyX) >= MIN_LABEL_SPACING;

              return (
                <g key={release.id}>
                  {/* Release name */}
                  <text
                    x={10}
                    y={y + barHeight / 2}
                    fontSize={displaySettings.releaseNameFontSize}
                    fill="#333"
                    fontWeight="600"
                    textAnchor="start"
                    dominantBaseline="middle"
                  >
                    {release.name}
                  </text>

                  {/* Solid bar (start to early) */}
                  <rect
                    x={startX}
                    y={y}
                    width={earlyX - startX}
                    height={barHeight}
                    fill={colors.solidBar}
                    stroke={colors.solidBar}
                    strokeWidth="2"
                    rx="4"
                  />

                  {/* Hatched bar (early to late) */}
                  <defs>
                    <pattern id={`hatch-${release.id}`} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                      <line x1="0" y1="0" x2="0" y2="8" stroke={colors.hatchedBar} strokeWidth="4" />
                    </pattern>
                  </defs>
                  <rect
                    x={earlyX}
                    y={y}
                    width={lateX - earlyX}
                    height={barHeight}
                    fill={`url(#hatch-${release.id})`}
                    stroke={colors.hatchedBar}
                    strokeWidth="2"
                    rx="4"
                  />

                  {/* Date labels */}
                  <text
                    x={startX}
                    y={y + barHeight + 15}
                    fontSize={displaySettings.dateLabelFontSize}
                    fill={displaySettings.dateLabelColor}
                    textAnchor="middle"
                  >
                    {formatDateShort(release.startDate)}
                  </text>

                  {showEarlyLabel && (
                    <text
                      x={earlyX}
                      y={y + barHeight + 15}
                      fontSize={displaySettings.dateLabelFontSize}
                      fill={displaySettings.dateLabelColor}
                      textAnchor="middle"
                    >
                      {formatDateShort(release.earlyFinishDate)}
                    </text>
                  )}

                  <text
                    x={lateX}
                    y={y + barHeight + 15}
                    fontSize={displaySettings.dateLabelFontSize}
                    fill={displaySettings.dateLabelColor}
                    textAnchor="middle"
                  >
                    {formatDateShort(release.lateFinishDate)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div style={{ marginTop: '2rem', display: 'flex', gap: '2rem', fontSize: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '30px', height: '20px', background: chartColors.solidBar, borderRadius: '4px' }}></div>
            {editingLegendLabel === 'solid' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={tempLabelValue}
                  onChange={(e) => onTempLabelChange(e.target.value)}
                  onBlur={onCancelLabelEdit}
                  autoFocus
                  style={{ padding: '0.25rem', fontSize: '0.9rem', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <button onMouseDown={onSaveLabelEdit} style={{ padding: '0.25rem 0.5rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem' }}>✓</button>
              </div>
            ) : (
              <span onClick={() => onStartEditLabel('solid')} style={{ cursor: 'pointer' }} title="Click to edit">{solidBarLabel}</span>
            )}
          </div>

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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={tempLabelValue}
                  onChange={(e) => onTempLabelChange(e.target.value)}
                  onBlur={onCancelLabelEdit}
                  autoFocus
                  style={{ padding: '0.25rem', fontSize: '0.9rem', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <button onMouseDown={onSaveLabelEdit} style={{ padding: '0.25rem 0.5rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem' }}>✓</button>
              </div>
            ) : (
              <span onClick={() => onStartEditLabel('hatched')} style={{ cursor: 'pointer' }} title="Click to edit">{hatchedBarLabel}</span>
            )}
          </div>

          {showTodayLine && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: `${displaySettings.verticalLineWidth}px`, height: '20px', background: chartColors.todayLine, borderRadius: '2px' }}></div>
              <span>Today's Date</span>
            </div>
          )}

          {showFinishDateLine && projectFinishDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: `${displaySettings.verticalLineWidth}px`, height: '20px', background: chartColors.finishDateLine, borderRadius: '2px' }}></div>
              {editingLegendLabel === 'finishDate' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={tempLabelValue}
                    onChange={(e) => onTempLabelChange(e.target.value)}
                    onBlur={onCancelLabelEdit}
                    autoFocus
                    style={{ padding: '0.25rem', fontSize: '0.9rem', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                  <button onMouseDown={onSaveLabelEdit} style={{ padding: '0.25rem 0.5rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem' }}>✓</button>
                </div>
              ) : (
                <span onClick={() => onStartEditLabel('finishDate')} style={{ cursor: 'pointer' }} title="Click to edit">{finishDateLabel}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chart Settings - Below the chart */}
      <div style={{ marginTop: '2rem' }}>
        <h3
          onClick={() => setShowColorSettings(!showColorSettings)}
          style={{
            fontSize: '1.2rem',
            marginBottom: '1rem',
            color: '#333',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          Chart Settings {showColorSettings ? '▲' : '▼'}
        </h3>

        {showColorSettings && (
          <div style={{ padding: '1.5rem', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #ddd' }}>
            {/* Toggle Settings - First line */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '2rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showTodayLine}
                    onChange={(e) => setShowTodayLine(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Show Today's Date</span>
                </label>
                {projectFinishDate && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showFinishDateLine}
                      onChange={(e) => setShowFinishDateLine(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Show Project Finish Date</span>
                  </label>
                )}
              </div>
            </div>

            {/* Display Settings - Second horizontal row */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                <PresetButtonGroup
                  label="Release Name Font Size"
                  value={displaySettings.releaseNameFontSize}
                  options={[
                    { value: '14', label: 'Small' },
                    { value: '16', label: 'Medium' },
                    { value: '18', label: 'Large' }
                  ]}
                  onChange={(value) => setDisplaySettings({ ...displaySettings, releaseNameFontSize: value as any })}
                />
                <PresetButtonGroup
                  label="Date Label Font Size"
                  value={displaySettings.dateLabelFontSize}
                  options={[
                    { value: '11', label: 'Small' },
                    { value: '13', label: 'Medium' },
                    { value: '15', label: 'Large' }
                  ]}
                  onChange={(value) => setDisplaySettings({ ...displaySettings, dateLabelFontSize: value as any })}
                />
                <GrayscaleSwatchPicker
                  label="Date Label Color"
                  value={displaySettings.dateLabelColor}
                  onChange={(color) => setDisplaySettings({ ...displaySettings, dateLabelColor: color as any })}
                />
                <PresetButtonGroup
                  label="Vertical Line Width"
                  value={displaySettings.verticalLineWidth}
                  options={[
                    { value: '2', label: 'Thin' },
                    { value: '3', label: 'Medium' },
                    { value: '4', label: 'Thick' }
                  ]}
                  onChange={(value) => setDisplaySettings({ ...displaySettings, verticalLineWidth: value as any })}
                />
              </div>
            </div>

            {/* Color Settings - Third horizontal row */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                <ColorSwatchPicker
                  label="Solid Bar Color"
                  value={chartColors.solidBar}
                  onChange={(color) => onColorsChange({ ...chartColors, solidBar: color })}
                />
                <ColorSwatchPicker
                  label="Hatched Bar Color"
                  value={chartColors.hatchedBar}
                  onChange={(color) => onColorsChange({ ...chartColors, hatchedBar: color })}
                />
                <ColorSwatchPicker
                  label="Today's Date Line"
                  value={chartColors.todayLine}
                  onChange={(color) => onColorsChange({ ...chartColors, todayLine: color })}
                />
                <ColorSwatchPicker
                  label="Project Finish Date Line"
                  value={chartColors.finishDateLine}
                  onChange={(color) => onColorsChange({ ...chartColors, finishDateLine: color })}
                />
              </div>
            </div>

            {/* Color Presets */}
            <div>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#555' }}>Color Presets</h4>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {Object.keys(COLOR_PRESETS).map(presetName => {
                  const isActive = activePreset === presetName;
                  return (
                    <button
                      key={presetName}
                      onClick={() => onColorsChange(COLOR_PRESETS[presetName], presetName)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: isActive ? '#e6f2ff' : 'white',
                        border: isActive ? '2px solid #0070f3' : '2px solid #ddd',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: isActive ? '600' : 'normal'
                      }}
                    >
                      {presetName}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Main App Component
function AppContent() {
  const {
    data,
    loading,
    chartColors,
    setChartColors,
    activePreset,
    setActivePreset,
    displaySettings,
    setDisplaySettings,
    solidBarLabel,
    setSolidBarLabel,
    hatchedBarLabel,
    setHatchedBarLabel,
    finishDateLabel,
    setFinishDateLabel,
    showTodayLine,
    setShowTodayLine,
    showFinishDateLine,
    setShowFinishDateLine,
    showColorSettings,
    setShowColorSettings,
    updateData
  } = useAppData();

  const [activeTab, setActiveTab] = useState<TabType>('projects');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Drag and drop state
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [draggedReleaseId, setDraggedReleaseId] = useState<string | null>(null);

  // Legend editing state
  const [editingLegendLabel, setEditingLegendLabel] = useState<'solid' | 'hatched' | 'finishDate' | null>(null);
  const [tempLabelValue, setTempLabelValue] = useState('');

  // Select first project on mount or when projects change
  useEffect(() => {
    if (data.projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(data.projects[0].id);
    }
  }, [data.projects, selectedProjectId]);

  // Clear releases form when switching projects
  useEffect(() => {
    // Form clearing handled by useReleases hook
  }, [selectedProjectId]);

  // Update chart colors and preset
  const updateChartColors = (colors: ChartColors, presetName?: string) => {
    setChartColors(colors);
    setActivePreset(presetName);
    const newData = {
      ...data,
      chartColors: colors,
      activePreset: presetName
    };
    updateData(newData);
  };

  // Project drag and drop
  const handleProjectDragStart = (id: string) => setDraggedProjectId(id);

  const handleProjectDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedProjectId || draggedProjectId === targetId) return;

    const draggedIndex = data.projects.findIndex(p => p.id === draggedProjectId);
    const targetIndex = data.projects.findIndex(p => p.id === targetId);

    const newProjects = [...data.projects];
    const [removed] = newProjects.splice(draggedIndex, 1);
    newProjects.splice(targetIndex, 0, removed);

    updateData({ ...data, projects: newProjects });
  };

  const handleProjectDragEnd = () => setDraggedProjectId(null);

  // Release drag and drop
  const handleReleaseDragStart = (id: string) => setDraggedReleaseId(id);

  const handleReleaseDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedReleaseId || draggedReleaseId === targetId) return;

    const draggedRelease = data.releases.find(r => r.id === draggedReleaseId);
    if (!draggedRelease) return;

    const projectReleases = data.releases.filter(r => r.projectId === draggedRelease.projectId);
    const otherReleases = data.releases.filter(r => r.projectId !== draggedRelease.projectId);

    const draggedIndex = projectReleases.findIndex(r => r.id === draggedReleaseId);
    const targetIndex = projectReleases.findIndex(r => r.id === targetId);

    const newProjectReleases = [...projectReleases];
    const [removed] = newProjectReleases.splice(draggedIndex, 1);
    newProjectReleases.splice(targetIndex, 0, removed);

    updateData({ ...data, releases: [...otherReleases, ...newProjectReleases] });
  };

  const handleReleaseDragEnd = () => setDraggedReleaseId(null);

  // Legend label editing
  const startEditLabel = (type: 'solid' | 'hatched' | 'finishDate') => {
    setEditingLegendLabel(type);
    if (type === 'solid') setTempLabelValue(solidBarLabel);
    else if (type === 'hatched') setTempLabelValue(hatchedBarLabel);
    else setTempLabelValue(finishDateLabel);
  };

  const saveLabelEdit = () => {
    if (editingLegendLabel === 'solid') setSolidBarLabel(tempLabelValue);
    else if (editingLegendLabel === 'hatched') setHatchedBarLabel(tempLabelValue);
    else if (editingLegendLabel === 'finishDate') setFinishDateLabel(tempLabelValue);
    setEditingLegendLabel(null);
  };

  const cancelLabelEdit = () => {
    setEditingLegendLabel(null);
    setTempLabelValue('');
  };

  const currentReleases = data.releases.filter(r => r.projectId === selectedProjectId);
  const visibleReleases = currentReleases.filter(r => !r.hidden);
  const selectedProject = data.projects.find(p => p.id === selectedProjectId);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ fontSize: '1.5rem', color: '#666' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'white', padding: '2rem' }}>
      <Head>
        <title>GanttApp - Version 5.0</title>
        <meta name="description" content="Simple Gantt chart app with delivery uncertainty visualization" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
        <header style={{ marginBottom: '1.5rem' }}>
          <h1 style={{
            fontSize: '2.1rem',
            marginBottom: '0.25rem',
            background: 'linear-gradient(90deg, #0099ff 0%, #0051cc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>GanttApp</h1>
          <p style={{ color: '#666', fontSize: '0.875rem', fontStyle: 'italic' }}>Visualize release uncertainty in your project timeline</p>
        </header>

        <Tabs activeTab={activeTab} onTabChange={setActiveTab} />

        <main>
          {activeTab === 'projects' && (
            <ProjectsTab
              selectedProjectId={selectedProjectId}
              setSelectedProjectId={setSelectedProjectId}
              setActiveTab={setActiveTab}
              draggedProjectId={draggedProjectId}
              onProjectDragStart={handleProjectDragStart}
              onProjectDragOver={handleProjectDragOver}
              onProjectDragEnd={handleProjectDragEnd}
            />
          )}

          {activeTab === 'releases' && (
            <ReleasesTab
              selectedProjectId={selectedProjectId}
              setSelectedProjectId={setSelectedProjectId}
              draggedReleaseId={draggedReleaseId}
              onReleaseDragStart={handleReleaseDragStart}
              onReleaseDragOver={handleReleaseDragOver}
              onReleaseDragEnd={handleReleaseDragEnd}
            />
          )}

          {activeTab === 'chart' && selectedProject && (
            <GanttChart
              releases={visibleReleases}
              projectName={selectedProject.name}
              projectFinishDate={selectedProject.finishDate}
              chartColors={chartColors}
              onColorsChange={updateChartColors}
              activePreset={activePreset}
              showColorSettings={showColorSettings}
              setShowColorSettings={setShowColorSettings}
              showTodayLine={showTodayLine}
              setShowTodayLine={setShowTodayLine}
              showFinishDateLine={showFinishDateLine}
              setShowFinishDateLine={setShowFinishDateLine}
              solidBarLabel={solidBarLabel}
              hatchedBarLabel={hatchedBarLabel}
              finishDateLabel={finishDateLabel}
              editingLegendLabel={editingLegendLabel}
              tempLabelValue={tempLabelValue}
              onStartEditLabel={startEditLabel}
              onSaveLabelEdit={saveLabelEdit}
              onCancelLabelEdit={cancelLabelEdit}
              onTempLabelChange={setTempLabelValue}
              displaySettings={displaySettings}
              setDisplaySettings={setDisplaySettings}
            />
          )}

          {activeTab === 'about' && <AboutTab />}
          {activeTab === 'changelog' && <ChangelogTab />}
        </main>

        <footer style={{
          marginTop: '4rem',
          paddingTop: '2rem',
          borderTop: '2px solid #eee',
          textAlign: 'center',
          color: '#666',
          fontSize: '0.875rem'
        }}>
          © 2026 William W. Davis, MSPM, PMP |{' '}
          <button
            onClick={() => setActiveTab('changelog')}
            style={{
              background: 'none',
              border: 'none',
              color: '#0070f3',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '0.875rem',
              padding: 0
            }}
          >
            Version 5.0
          </button>
          {' '}| Licensed under GNU GPL v3
        </footer>
      </div>
    </div>
  );
}

// Wrap with provider
export default function Home() {
  return (
    <AppDataProvider>
      <AppContent />
    </AppDataProvider>
  );
}
