// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useKeyboardShortcuts } from '../src/shared/hooks/useKeyboardShortcuts';
import { useAppData } from '../src/context/AppDataContext';
import { useTheme } from '../src/context/ThemeContext';
import { ChartColors, TabType } from '../src/shared/types';
import { ProjectLegendLabels } from '../src/shared/types/models';
import { DEFAULT_LEGEND_LABELS, resolveLabel } from '../src/shared/utils/validation';
import { getEffectiveWorkDays } from '../src/shared/utils/validation';
import { moveAmongShown, shownProjects } from '../src/shared/utils/projectPrefs';
import { Tabs } from '../src/shared/components/Tabs';
import { FirstRunBanner } from '../src/shared/components/FirstRunBanner';
import { InvitationBanner } from '../src/shared/components/InvitationBanner';
import { LocalStorageWarningBanner } from '../src/shared/components/LocalStorageWarningBanner';
import { CloudLoadNoticeBanner } from '../src/shared/components/CloudLoadNoticeBanner';
import { ErrorBoundary } from '../src/shared/components/ErrorBoundary';
import { AppHeader } from '../src/shared/components/AppHeader';
import { AppFooter } from '../src/shared/components/AppFooter';
import { HeadingRow } from '../src/shared/components/HeadingRow';
import { screenHeading } from '../src/shared/utils/screenHeading';
import { CloudStorageModal } from '../src/shared/components/CloudStorageModal';
import { ProjectsTab } from '../src/features/projects/ProjectsTab';
import { ProjectsLoadingHeading } from '../src/features/projects/ProjectsToolbar';
import { ReleasesTab, ALL_ARCHIVED_MESSAGE } from '../src/features/releases/ReleasesTab';
import { AboutTab } from '../src/features/about/AboutTab';
import { ChangelogTab } from '../src/features/changelog/ChangelogTab';
import { SettingsTab } from '../src/features/settings/SettingsTab';
import { GanttChart } from '../src/features/chart/GanttChart';
import { useChartEditing } from '../src/features/chart/useChartEditing';
import { useSnapshots } from '../src/features/chart/useSnapshots';
import { useEffectiveChartProps } from '../src/features/chart/useEffectiveChartProps';

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
    todayDateOverride,
    setTodayDateOverride,
    showFinishDateLine,
    setShowFinishDateLine,
    showColorSettings,
    setShowColorSettings,
    preparedBy,
    setPreparedBy,
    showPreparedBy,
    setShowPreparedBy,
    mostLikelyLineLabel,
    setMostLikelyLineLabel,
    inProgressLabel,
    showMostLikelyLine,
    setShowMostLikelyLine,
    showMonths,
    setShowMonths,
    globalWorkDays,
    updateData
  } = useAppData();

  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<TabType>('projects');
  const [selectedProjectIdRaw, setSelectedProjectId] = useState<string>('');
  const [cloudModalOpen, setCloudModalOpen] = useState(false);
  // Load Sample opens the Gantt Chart tab: its message is read out here (the
  // Projects tab has gone), and focus moves to the chart's project picker.
  const [announcement, setAnnouncement] = useState('');
  const focusChartPickerRef = useRef(false);

  // What the pickers list: this person's archived projects leave them.
  const unarchivedProjects = shownProjects(data.projects, data.projectPrefs, false);

  // Auto-select the first project when none is selected, or the one selected is archived
  const selectedProjectId = (selectedProjectIdRaw && unarchivedProjects.some(p => p.id === selectedProjectIdRaw))
    ? selectedProjectIdRaw
    : (unarchivedProjects.length > 0 ? unarchivedProjects[0].id : '');

  // Drag and drop state
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [draggedReleaseId, setDraggedReleaseId] = useState<string | null>(null);

  // Chart editing state (legend labels, release names, dates).
  // Pass selectedProjectId so project-scope saves target the right project when a project is selected.
  const chartEditing = useChartEditing(selectedProjectId || undefined);

  // Snapshot state
  const snapshotState = useSnapshots(selectedProjectId);

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

  const handleProjectDragOver = (e: React.DragEvent, targetId: string, shownIds: string[]) => {
    e.preventDefault();
    if (!draggedProjectId || draggedProjectId === targetId) return;

    const projects = moveAmongShown(data.projects, shownIds, draggedProjectId, shownIds.indexOf(targetId));
    if (projects !== data.projects) updateData({ ...data, projects });
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

  // Compute effective props: snapshot data takes precedence when viewing a snapshot
  const { activeSnapshot, isViewingSnapshot } = snapshotState;

  const effective = useEffectiveChartProps(activeSnapshot, {
    releases: visibleReleases,
    chartColors,
    // v16.2: raw state may be '' (uncustomized) — fall back to DEFAULT_LEGEND_LABELS
    // here, at the boundary between context and chart. Hook contract is that labels
    // entering the hook are already effective strings, never empty.
    labels: {
      solidBar: solidBarLabel || DEFAULT_LEGEND_LABELS.solidBar,
      hatchedBar: hatchedBarLabel || DEFAULT_LEGEND_LABELS.hatchedBar,
      finishDateLine: finishDateLabel || DEFAULT_LEGEND_LABELS.finishDateLine,
      mostLikelyLine: mostLikelyLineLabel || DEFAULT_LEGEND_LABELS.mostLikelyLine,
      inProgress: inProgressLabel || DEFAULT_LEGEND_LABELS.inProgress,
    },
    preparedBy,
    finishDate: selectedProject?.finishDate,
    todayDateOverride: todayDateOverride || undefined
  }, selectedProject?.legendLabels);

  // v16.1: clear a single per-project legend label override (↺ button handler)
  const handleClearProjectLabelOverride = useCallback((key: keyof ProjectLegendLabels) => {
    if (!selectedProjectId) return;
    const project = data.projects.find(p => p.id === selectedProjectId);
    if (!project?.legendLabels) return;
    const newLabels = { ...project.legendLabels };
    delete newLabels[key];
    // When all overrides cleared, strip the field entirely (undefined → field-deletion via full set())
    const updatedProject = Object.keys(newLabels).length === 0
      ? { ...project, legendLabels: undefined }
      : { ...project, legendLabels: newLabels };
    updateData({
      ...data,
      projects: data.projects.map(p => p.id === selectedProjectId ? updatedProject : p),
    });
  }, [data, selectedProjectId, updateData]);

  // Save snapshot callback — passes current chart state to the hook.
  // v16.2 (Risk 1): snapshots must freeze the EFFECTIVE displayed label, not the raw
  // state. A snapshot taken today with empty global state should display "Design, Code,
  // Test" forever — not an empty string.
  // v16.8: effective also means project-override-aware. When the selected project has
  // a legendLabels override (v16.1), the snapshot must capture the override, not the
  // global baseline. Matches the precedence in useEffectiveChartProps (resolveLabel).
  const handleSaveSnapshot = useCallback(() => {
    const projectLabels = selectedProject?.legendLabels;
    snapshotState.saveSnapshot({
      releases: visibleReleases,
      projectFinishDate: selectedProject?.finishDate,
      chartColors,
      legendLabels: {
        solidBar: resolveLabel('solidBar', projectLabels, solidBarLabel || DEFAULT_LEGEND_LABELS.solidBar),
        hatchedBar: resolveLabel('hatchedBar', projectLabels, hatchedBarLabel || DEFAULT_LEGEND_LABELS.hatchedBar),
        finishDateLine: resolveLabel('finishDateLine', projectLabels, finishDateLabel || DEFAULT_LEGEND_LABELS.finishDateLine),
        mostLikelyLine: resolveLabel('mostLikelyLine', projectLabels, mostLikelyLineLabel || DEFAULT_LEGEND_LABELS.mostLikelyLine),
        inProgress: resolveLabel('inProgress', projectLabels, inProgressLabel || DEFAULT_LEGEND_LABELS.inProgress),
      },
      preparedBy,
      // v0.28.0: freeze the status date so a snapshot keeps rendering the line
      // where it was when the plan was captured.
      todayDateOverride
    })
      // v0.28.10 backstop. saveSnapshot catches its own write failures, so this
      // cannot fire today. It is a control against a future regression inside
      // the hook silently restoring the pre-v0.28.10 silence.
      .catch(err => console.error('Save snapshot failed:', err));
  }, [snapshotState, visibleReleases, selectedProject?.finishDate, selectedProject?.legendLabels, chartColors, solidBarLabel, hatchedBarLabel, finishDateLabel, mostLikelyLineLabel, inProgressLabel, preparedBy, todayDateOverride]);

  const handleSampleLoaded = useCallback((message: string) => {
    setAnnouncement(message);
    focusChartPickerRef.current = true;
  }, []);

  useEffect(() => {
    if (!focusChartPickerRef.current || activeTab !== 'chart') return;
    focusChartPickerRef.current = false;
    document.querySelector<HTMLElement>('select[name="chartTabSelectedProject"]')?.focus();
  }, [activeTab]);

  // Keyboard shortcuts
  const tabOrder: TabType[] = useMemo(() => ['projects', 'releases', 'chart', 'settings', 'about'], []);
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

  // The frame (FRAME26, v0.34.0): the screen's h1 and its column. Releases and the Gantt Chart are named after the
  // selected project, the one both pickers show; Settings, About and the Changelog are capped (contract §8, X4).
  const heading = screenHeading(activeTab, selectedProject?.name);
  const capped = activeTab === 'settings' || activeTab === 'about' || activeTab === 'changelog';

  return (
    // The SPERT® Suite app frame (contract FRAME-CONTRACT.md, styles/spert-frame.css): a full-height column of the
    // brand row, the navigation row, the notices slot, <main> (which takes the spare height, so the footer sits at the
    // bottom of the window when a tab is short) and the footer. Each band uses the frame's 1600 px column. The frame
    // renders whether or not the data has loaded: only the body says "Loading..." (contract §7).
    <div className="sf-app" data-sf="app">
      <a className="sf-skip" href="#main" data-sf="skip">Skip to main content</a>
      <AppHeader onNavigateHome={() => setActiveTab('projects')} onOpenAccount={() => setCloudModalOpen(true)} />
      <Tabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* The app-wide notices, in this order (v0.32.0, as in the other SPERT® apps). The slot hides itself when
          every notice is absent, so nothing else may go in it: the live region below stays outside it. */}
      <div className="sf-col sf-notices" data-sf="notices">
        <InvitationBanner />
        <FirstRunBanner />
        <LocalStorageWarningBanner />
        <CloudLoadNoticeBanner />
      </div>

      <p className="pt-sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>

      <main id="main" className={capped ? 'sf-col sf-main sf-main--capped' : 'sf-col sf-main'} data-sf="main">
        {loading ? (
          <>
            {activeTab === 'projects'
              ? <ProjectsLoadingHeading />
              : <HeadingRow title={heading.title}>{heading.text}</HeadingRow>}
            <p className="sf-below" style={{ color: colors.textSecondary }}>Loading...</p>
          </>
        ) : (
          <>
            {/* Every tab but Projects gets its heading row here, OUTSIDE the error boundary, so a view that throws
                leaves the page's h1 in place. Projects draws its own, because its toolbar's state lives there. */}
            {activeTab !== 'projects' && <HeadingRow title={heading.title}>{heading.text}</HeadingRow>}
            <div className={activeTab === 'projects' ? undefined : 'sf-below'}>
              {/* v0.29.10: an error in one view leaves the rest of the app up.
                  Keyed on the tab; a change of the selected project clears an
                  error without restarting a healthy tab (v0.29.11). */}
              <ErrorBoundary key={activeTab} resetKey={selectedProjectId}>
              {activeTab === 'projects' && (
                <ProjectsTab
                  selectedProjectId={selectedProjectId}
                  setSelectedProjectId={setSelectedProjectId}
                  setActiveTab={setActiveTab}
                  draggedProjectId={draggedProjectId}
                  onProjectDragStart={handleProjectDragStart}
                  onProjectDragOver={handleProjectDragOver}
                  onProjectDragEnd={handleProjectDragEnd}
                  onReplaceSnapshots={snapshotState.replaceAllSnapshots}
                  onSampleLoaded={handleSampleLoaded}
                  onAnnounce={setAnnouncement}
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
                  releases={effective.releases}
                  projectFinishDate={effective.finishDate}
                  projects={unarchivedProjects}
                  selectedProjectId={selectedProjectId}
                  setSelectedProjectId={setSelectedProjectId}
                  editing={chartEditing}
                  snapshot={{
                    snapshots: snapshotState.snapshots,
                    activeSnapshotId: snapshotState.activeSnapshotId,
                    onSelectSnapshot: snapshotState.setActiveSnapshotId,
                    onSaveSnapshot: handleSaveSnapshot,
                    onDeleteSnapshot: snapshotState.deleteSnapshot,
                    readOnly: isViewingSnapshot,
                    datePreparedOverride: effective.datePreparedOverride
                  }}
                  labels={{
                    solidBarLabel: effective.labels.solidBar,
                    hatchedBarLabel: effective.labels.hatchedBar,
                    finishDateLabel: effective.labels.finishDateLine ?? finishDateLabel,
                    mostLikelyLineLabel: effective.labels.mostLikelyLine ?? mostLikelyLineLabel,
                    inProgressLabel: effective.labels.inProgress ?? inProgressLabel
                  }}
                  settings={{
                    displaySettings,
                    setDisplaySettings,
                    chartColors: effective.colors,
                    onColorsChange: updateChartColors,
                    activePreset,
                    showColorSettings,
                    setShowColorSettings,
                    showTodayLine,
                    setShowTodayLine,
                    liveTodayDateOverride: todayDateOverride,
                    setTodayDateOverride,
                    showFinishDateLine,
                    setShowFinishDateLine,
                    preparedBy: effective.preparedBy,
                    setPreparedBy,
                    showPreparedBy,
                    setShowPreparedBy,
                    showMostLikelyLine,
                    setShowMostLikelyLine,
                    showMonths,
                    setShowMonths
                  }}
                  projectLegendLabels={selectedProject?.legendLabels}
                  onClearProjectLabelOverride={handleClearProjectLabelOverride}
                  workDays={getEffectiveWorkDays(selectedProject, globalWorkDays)}
                  todayDateOverride={effective.todayDateOverride}
                />
              )}

              {activeTab === 'chart' && !selectedProject && data.projects.length > 0 && (
                <p style={{ color: colors.textMuted, fontStyle: 'italic' }}>{ALL_ARCHIVED_MESSAGE}</p>
              )}

              {activeTab === 'settings' && <SettingsTab />}
              {activeTab === 'about' && <AboutTab />}
              {activeTab === 'changelog' && <ChangelogTab />}
              </ErrorBoundary>
            </div>
          </>
        )}
      </main>

      <AppFooter onOpenChangelog={() => setActiveTab('changelog')} />

      <CloudStorageModal open={cloudModalOpen} onClose={() => setCloudModalOpen(false)} />
    </div>
  );
}

// AppDataProvider is now in _app.tsx
export default function Home() {
  return <AppContent />;
}
