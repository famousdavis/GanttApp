import { useState, useMemo, useCallback } from 'react';
import { useKeyboardShortcuts } from '../src/shared/hooks/useKeyboardShortcuts';
import Head from 'next/head';
import { AppDataProvider, useAppData } from '../src/context/AppDataContext';
import { useTheme } from '../src/context/ThemeContext';
import { ChartColors, TabType } from '../src/shared/types';
import { Tabs } from '../src/shared/components/Tabs';
import { ProjectsTab } from '../src/features/projects/ProjectsTab';
import { ReleasesTab } from '../src/features/releases/ReleasesTab';
import { AboutTab } from '../src/features/about/AboutTab';
import { ChangelogTab } from '../src/features/changelog/ChangelogTab';
import { GanttChart } from '../src/features/chart/GanttChart';
import { useChartEditing } from '../src/features/chart/useChartEditing';

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
    hatchedBarLabel,
    finishDateLabel,
    showTodayLine,
    setShowTodayLine,
    showFinishDateLine,
    setShowFinishDateLine,
    showColorSettings,
    setShowColorSettings,
    preparedBy,
    setPreparedBy,
    showPreparedBy,
    setShowPreparedBy,
    updateData
  } = useAppData();

  const { mode, setMode, resolvedTheme, colors } = useTheme();

  const [activeTab, setActiveTab] = useState<TabType>('projects');
  const [selectedProjectIdRaw, setSelectedProjectId] = useState<string>('');

  // Auto-select first project when none is selected
  const selectedProjectId = (selectedProjectIdRaw && data.projects.some(p => p.id === selectedProjectIdRaw))
    ? selectedProjectIdRaw
    : (data.projects.length > 0 ? data.projects[0].id : '');

  // Drag and drop state
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [draggedReleaseId, setDraggedReleaseId] = useState<string | null>(null);

  // Chart editing state (legend labels, release names, dates)
  const chartEditing = useChartEditing();

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

  const currentReleases = data.releases.filter(r => r.projectId === selectedProjectId);
  const visibleReleases = currentReleases.filter(r => !r.hidden);
  const selectedProject = data.projects.find(p => p.id === selectedProjectId);

  // Keyboard shortcuts
  const tabOrder: TabType[] = useMemo(() => ['projects', 'releases', 'chart', 'about'], []);
  const shortcuts = useMemo(() => ({
    'escape': () => {
      if (chartEditing.hasActiveEditor) {
        chartEditing.cancelLabelEdit();
        chartEditing.cancelReleaseNameEdit();
        chartEditing.cancelDateEdit();
      } else if (showColorSettings) {
        setShowColorSettings(false);
      }
    },
    'arrowleft': () => {
      const idx = tabOrder.indexOf(activeTab);
      if (idx > 0) setActiveTab(tabOrder[idx - 1]);
    },
    'arrowright': () => {
      const idx = tabOrder.indexOf(activeTab);
      if (idx < tabOrder.length - 1) setActiveTab(tabOrder[idx + 1]);
    }
  }), [chartEditing, showColorSettings, activeTab, tabOrder, setShowColorSettings]);

  useKeyboardShortcuts(shortcuts);

  // Toggle theme
  const cycleTheme = useCallback(() => {
    if (mode === 'system') setMode('light');
    else if (mode === 'light') setMode('dark');
    else setMode('system');
  }, [mode, setMode]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: colors.background }}>
        <div style={{ fontSize: '1.5rem', color: colors.textSecondary }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: colors.background, padding: '2rem', transition: 'background-color 0.2s ease' }}>
      <Head>
        <title>GanttApp - Version 6.0</title>
        <meta name="description" content="Simple Gantt chart app with delivery uncertainty visualization" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
        <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{
              fontSize: '2.1rem',
              marginBottom: '0.25rem',
              background: 'linear-gradient(90deg, #0099ff 0%, #0051cc 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>GanttApp</h1>
            <p style={{ color: colors.textSecondary, fontSize: '0.875rem', fontStyle: 'italic' }}>
              Visualize release date uncertainty in your project timeline
            </p>
          </div>
          <button
            onClick={cycleTheme}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.5rem',
              padding: '0.5rem',
              borderRadius: '8px',
              transition: 'background-color 0.2s ease'
            }}
            title={`Theme: ${mode} (click to change)`}
          >
            {resolvedTheme === 'dark' ? '☀️' : '🌙'}
          </button>
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
              projects={data.projects}
              selectedProjectId={selectedProjectId}
              setSelectedProjectId={setSelectedProjectId}
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
              editingLegendLabel={chartEditing.editingLegendLabel}
              tempLabelValue={chartEditing.tempLabelValue}
              onStartEditLabel={chartEditing.startEditLabel}
              onSaveLabelEdit={chartEditing.saveLabelEdit}
              onCancelLabelEdit={chartEditing.cancelLabelEdit}
              onTempLabelChange={chartEditing.setTempLabelValue}
              displaySettings={displaySettings}
              setDisplaySettings={setDisplaySettings}
              editingReleaseId={chartEditing.editingReleaseId}
              tempReleaseName={chartEditing.tempReleaseName}
              onStartEditReleaseName={chartEditing.startEditReleaseName}
              onSaveReleaseNameEdit={chartEditing.saveReleaseNameEdit}
              onCancelReleaseNameEdit={chartEditing.cancelReleaseNameEdit}
              onTempReleaseNameChange={chartEditing.setTempReleaseName}
              editingDateInfo={chartEditing.editingDateInfo}
              tempDateValue={chartEditing.tempDateValue}
              onStartEditDate={chartEditing.startEditDate}
              onSaveDateEdit={chartEditing.saveDateEdit}
              onCancelDateEdit={chartEditing.cancelDateEdit}
              onTempDateChange={chartEditing.setTempDateValue}
              dateEditError={chartEditing.dateEditError}
              preparedBy={preparedBy}
              setPreparedBy={setPreparedBy}
              showPreparedBy={showPreparedBy}
              setShowPreparedBy={setShowPreparedBy}
            />
          )}

          {activeTab === 'about' && <AboutTab />}
          {activeTab === 'changelog' && <ChangelogTab />}
        </main>

        <footer style={{
          marginTop: '4rem',
          paddingTop: '2rem',
          borderTop: `2px solid ${colors.border}`,
          textAlign: 'center',
          color: colors.textSecondary,
          fontSize: '0.875rem'
        }}>
          © 2026 William W. Davis, MSPM, PMP |{' '}
          <button
            onClick={() => setActiveTab('changelog')}
            style={{
              background: 'none',
              border: 'none',
              color: '#0070f3',
              textDecoration: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              padding: 0
            }}
          >
            Version 6.1
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
