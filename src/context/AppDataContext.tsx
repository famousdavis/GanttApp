// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Global application data context

import { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback, ReactNode } from 'react';
import { AppData, Project, Release, ChartColors, ChartDisplaySettings, ExportAttribution } from '../shared/types';
import { DEFAULT_CHART_COLORS, DEFAULT_DISPLAY_SETTINGS, sanitizeWorkDays, DEFAULT_WORK_DAYS } from '../shared/utils';
import { useStorage } from './StorageContext';
import type { CloudGanttStorageService } from '../shared/storage';
import { registerAppDataReset } from './appDataResetRegistry';

interface AppDataContextType {
  data: AppData;
  setData: (data: AppData) => void;
  updateData: (data: AppData) => void;
  loading: boolean;

  // Chart settings
  chartColors: ChartColors;
  setChartColors: (colors: ChartColors) => void;
  activePreset: string | undefined;
  setActivePreset: (preset: string | undefined) => void;
  displaySettings: ChartDisplaySettings;
  setDisplaySettings: (settings: ChartDisplaySettings) => void;

  // Legend labels
  solidBarLabel: string;
  setSolidBarLabel: (label: string) => void;
  hatchedBarLabel: string;
  setHatchedBarLabel: (label: string) => void;
  finishDateLabel: string;
  setFinishDateLabel: (label: string) => void;
  mostLikelyLineLabel: string;
  setMostLikelyLineLabel: (label: string) => void;
  inProgressLabel: string;
  setInProgressLabel: (label: string) => void;

  // Toggles
  showTodayLine: boolean;
  setShowTodayLine: (show: boolean) => void;
  showFinishDateLine: boolean;
  setShowFinishDateLine: (show: boolean) => void;
  showMostLikelyLine: boolean;
  setShowMostLikelyLine: (show: boolean) => void;
  showMonths: boolean;
  setShowMonths: (show: boolean) => void;
  showColorSettings: boolean;
  setShowColorSettings: (show: boolean) => void;

  // Prepared By
  preparedBy: string;
  setPreparedBy: (name: string) => void;
  showPreparedBy: boolean;
  setShowPreparedBy: (show: boolean) => void;

  // Export Attribution
  exportAttribution: ExportAttribution | undefined;
  setExportAttribution: (attr: ExportAttribution) => void;

  // Work Week (v15.0)
  globalWorkDays: number[] | undefined;
  setGlobalWorkDays: (days: number[] | undefined) => void;

  // v16.6 — reset all in-memory state to initial values. Used by the
  // centralized sign-out helper. Does NOT write to localStorage; the save
  // effect is suppressed during the reset tick via `isResettingRef`.
  clearAllData: () => void;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { storage } = useStorage();
  const [data, setData] = useState<AppData>({ projects: [], releases: [] });
  const [loading, setLoading] = useState(true);

  // Suppress save-on-load: the save effect fires when loading becomes false,
  // which would write the just-loaded data back. This ref prevents that.
  const isInitialLoadRef = useRef(true);

  // v16.6 — suppress save effect while clearAllData() is clearing state.
  // Set true at the start of clearAllData; cleared at the end of the load
  // effect that runs on the subsequent storage swap. This ties the window
  // to "between clearAllData() and the next load-effect settlement" so the
  // cleared defaults don't get written back to localStorage on sign-out.
  const isResettingRef = useRef(false);

  // Track current data for the data-loss guard (closures in async effects see stale state)
  const dataRef = useRef(data);
  dataRef.current = data;

  // Chart settings
  const [chartColors, setChartColors] = useState<ChartColors>(DEFAULT_CHART_COLORS);
  const [activePreset, setActivePreset] = useState<string | undefined>(undefined);
  const [displaySettings, setDisplaySettings] = useState<ChartDisplaySettings>(DEFAULT_DISPLAY_SETTINGS);

  // Legend labels (v16.2: initialize to '' — empty state means "not customized",
  // and consumers fall through to DEFAULT_LEGEND_LABELS. The Settings inputs bind
  // to the raw state so empty values render as HTML placeholders.)
  const [solidBarLabel, setSolidBarLabel] = useState('');
  const [hatchedBarLabel, setHatchedBarLabel] = useState('');
  const [finishDateLabel, setFinishDateLabel] = useState('');
  const [mostLikelyLineLabel, setMostLikelyLineLabel] = useState('');
  const [inProgressLabel, setInProgressLabel] = useState('');

  // Toggles
  const [showTodayLine, setShowTodayLine] = useState(true);
  const [showFinishDateLine, setShowFinishDateLine] = useState(true);
  const [showMostLikelyLine, setShowMostLikelyLine] = useState(false);
  const [showMonths, setShowMonths] = useState(false);
  const [showColorSettings, setShowColorSettings] = useState(false);

  // Prepared By
  const [preparedBy, setPreparedBy] = useState('');
  const [showPreparedBy, setShowPreparedBy] = useState(false);

  // Export Attribution
  const [exportAttribution, setExportAttribution] = useState<ExportAttribution | undefined>(undefined);

  // Work Week (v15.0; v16.3 default to Mon–Fri)
  // Initial value is Mon–Fri so first-time users get non-workday warnings automatically.
  // The load effect overwrites this with stored data if present.
  const [globalWorkDays, setGlobalWorkDays] = useState<number[] | undefined>([...DEFAULT_WORK_DAYS]);

  // Load data from storage on mount (or when storage service changes)
  useEffect(() => {
    let cancelled = false;

    const loadDataFromStorage = async () => {
      try {
        const loadedData = await storage.loadAppData();
        if (cancelled) return;

        if (loadedData) {
          // Data-loss guard: don't wipe non-empty local state with empty cloud results.
          // v16.6: safe post-sign-out — clearAllData() runs before storage swap,
          // so dataRef.current is empty here. The guard only fires on transient
          // cloud errors (v12.3 intent), never blocks a new user's load.
          if (loadedData.projects.length === 0 && dataRef.current.projects.length > 0) {
            console.warn(
              `Cloud returned 0 projects but local has ${dataRef.current.projects.length} — skipping replacement to protect local data`
            );
          } else {
            setData(loadedData);

            // Load chart colors or use defaults
            if (loadedData.chartColors) {
              setChartColors(loadedData.chartColors);
            }

            // Load active preset if it exists
            if (loadedData.activePreset) {
              setActivePreset(loadedData.activePreset);
            }

            // Load legend labels if they exist (v16.2: only non-empty strings;
            // absent/empty fields leave state as '' so render path falls back to
            // DEFAULT_LEGEND_LABELS for first-time users).
            if (loadedData.legendLabels) {
              if (loadedData.legendLabels.solidBar) {
                setSolidBarLabel(loadedData.legendLabels.solidBar);
              }
              if (loadedData.legendLabels.hatchedBar) {
                setHatchedBarLabel(loadedData.legendLabels.hatchedBar);
              }
              if (loadedData.legendLabels.finishDateLine) {
                setFinishDateLabel(loadedData.legendLabels.finishDateLine);
              }
              if (loadedData.legendLabels.mostLikelyLine) {
                setMostLikelyLineLabel(loadedData.legendLabels.mostLikelyLine);
              }
              if (loadedData.legendLabels.inProgress) {
                setInProgressLabel(loadedData.legendLabels.inProgress);
              }
            }

            // Load toggle states if they exist
            if (loadedData.showTodayLine !== undefined) {
              setShowTodayLine(loadedData.showTodayLine);
            }
            if (loadedData.showFinishDateLine !== undefined) {
              setShowFinishDateLine(loadedData.showFinishDateLine);
            }
            if (loadedData.showMostLikelyLine !== undefined) {
              setShowMostLikelyLine(loadedData.showMostLikelyLine);
            }
            if (loadedData.showMonths !== undefined) {
              setShowMonths(loadedData.showMonths);
            }

            // Load display settings if they exist
            if (loadedData.chartDisplaySettings) {
              setDisplaySettings(loadedData.chartDisplaySettings);
            }

            // Load prepared by settings
            if (typeof loadedData.preparedBy === 'string') {
              setPreparedBy(loadedData.preparedBy);
            }
            if (loadedData.showPreparedBy !== undefined) {
              setShowPreparedBy(loadedData.showPreparedBy);
            }

            // Load export attribution
            if (loadedData.exportAttribution && typeof loadedData.exportAttribution === 'object') {
              setExportAttribution(loadedData.exportAttribution);
            }

            // Load global work days (v15.0)
            if (Array.isArray(loadedData.globalWorkDays)) {
              const sanitized = sanitizeWorkDays(loadedData.globalWorkDays);
              if (sanitized) setGlobalWorkDays(sanitized);
            }
          }
        }
      } catch (error) {
        console.error('Error loading data:', error instanceof Error ? error.message : 'Unknown error');
      } finally {
        if (!cancelled) {
          setLoading(false);
          // Allow save effect to run on subsequent changes (not the initial hydration)
          isInitialLoadRef.current = false;
          // v16.6 — end the reset suppression window; save effect re-enables
          // for subsequent user edits.
          isResettingRef.current = false;
        }
      }
    };

    loadDataFromStorage();
    return () => { cancelled = true; };
  }, [storage]);

  // Save legend labels, display settings, and prepared by whenever they change
  useEffect(() => {
    if (!loading && !isInitialLoadRef.current && !isResettingRef.current) {
      // v16.2: conditionally spread only non-empty label values into the payload,
      // then strip the entire legendLabels field when no customizations exist.
      // Matches the workDays / globalWorkDays / project.legendLabels pattern.
      const legendLabelsPayload = {
        ...(solidBarLabel && { solidBar: solidBarLabel }),
        ...(hatchedBarLabel && { hatchedBar: hatchedBarLabel }),
        ...(finishDateLabel && { finishDateLine: finishDateLabel }),
        ...(mostLikelyLineLabel && { mostLikelyLine: mostLikelyLineLabel }),
        ...(inProgressLabel && { inProgress: inProgressLabel }),
      };
      const newData = {
        ...data,
        ...(Object.keys(legendLabelsPayload).length > 0 && { legendLabels: legendLabelsPayload }),
        chartDisplaySettings: displaySettings,
        preparedBy,
        showPreparedBy,
        showTodayLine,
        showFinishDateLine,
        showMostLikelyLine,
        showMonths,
        ...(exportAttribution ? { exportAttribution } : {}),
        ...(globalWorkDays && globalWorkDays.length > 0 ? { globalWorkDays } : {})
      };
      storage.saveAppData(newData);
    }
  }, [solidBarLabel, hatchedBarLabel, finishDateLabel, mostLikelyLineLabel, inProgressLabel, displaySettings, preparedBy, showPreparedBy, showTodayLine, showFinishDateLine, showMostLikelyLine, showMonths, exportAttribution, globalWorkDays, data, loading, storage]);

  // Real-time sync: subscribe to Firestore changes in cloud mode
  // Stable dependency: sorted project IDs (re-subscribes only when projects are added/removed)
  const projectIds = useMemo(
    () => JSON.stringify(data.projects.map(p => p.id).sort()),
    [data.projects]
  );

  useEffect(() => {
    if (storage.mode !== 'cloud' || loading) return;

    const cloudStorage = storage as CloudGanttStorageService;
    const ids: string[] = JSON.parse(projectIds);

    const unsubscribers = ids.map(projectId =>
      cloudStorage.subscribeToProject(projectId, (releases, snapshot) => {
        // Skip local echoes — only apply server-confirmed data
        if (snapshot.metadata.hasPendingWrites) return;

        setData(prev => {
          // Data-loss guard: don't wipe existing releases with empty cloud results.
          // v16.6: safe post-sign-out — clearAllData() clears in-memory before
          // the real-time listener re-subscribes, so prev.releases is empty.
          const existingCount = prev.releases.filter(r => r.projectId === projectId).length;
          if (releases.length === 0 && existingCount > 0) {
            console.warn(
              `Cloud returned 0 releases for project ${projectId} but local has ${existingCount} — skipping to protect data`
            );
            return prev;
          }
          return {
            ...prev,
            releases: [
              ...prev.releases.filter(r => r.projectId !== projectId),
              ...releases
            ]
          };
        });
      })
    );

    return () => unsubscribers.forEach(u => u());
  }, [storage, projectIds, loading]);

  // Update data and save to storage
  const updateData = (newData: AppData) => {
    setData(newData);
    storage.saveAppData(newData);
  };

  // v16.6 — reset every exposed field to its initial value. The save effect
  // is suppressed for the duration of this call + the next load effect via
  // isResettingRef, so the cleared defaults are NOT written to localStorage.
  // The centralized sign-out helper in StorageContext invokes this via the
  // appDataResetRegistry (provider-order bridge).
  const clearAllData = useCallback(() => {
    isResettingRef.current = true;
    setData({ projects: [], releases: [] });
    setChartColors(DEFAULT_CHART_COLORS);
    setActivePreset(undefined);
    setDisplaySettings(DEFAULT_DISPLAY_SETTINGS);
    setSolidBarLabel('');
    setHatchedBarLabel('');
    setFinishDateLabel('');
    setMostLikelyLineLabel('');
    setInProgressLabel('');
    setShowTodayLine(true);
    setShowFinishDateLine(true);
    setShowMostLikelyLine(false);
    setShowMonths(false);
    setShowColorSettings(false);
    setPreparedBy('');
    setShowPreparedBy(false);
    setExportAttribution(undefined);
    setGlobalWorkDays([...DEFAULT_WORK_DAYS]);
  }, []);

  // Register clearAllData in the module-level registry so StorageContext's
  // performSignOutWithCleanup can invoke it despite the provider ordering
  // (AppDataProvider is inside StorageProvider — no useAppData from there).
  useEffect(() => {
    const deregister = registerAppDataReset(clearAllData);
    return deregister;
  }, [clearAllData]);

  const value = {
    data,
    setData,
    updateData,
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
    mostLikelyLineLabel,
    setMostLikelyLineLabel,
    inProgressLabel,
    setInProgressLabel,
    showTodayLine,
    setShowTodayLine,
    showFinishDateLine,
    setShowFinishDateLine,
    showMostLikelyLine,
    setShowMostLikelyLine,
    showMonths,
    setShowMonths,
    showColorSettings,
    setShowColorSettings,
    preparedBy,
    setPreparedBy,
    showPreparedBy,
    setShowPreparedBy,
    exportAttribution,
    setExportAttribution,
    globalWorkDays,
    setGlobalWorkDays,
    clearAllData
  };

  return <AppDataContext value={value}>{children}</AppDataContext>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (context === undefined) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
}
