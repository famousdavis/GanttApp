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
import { INVITATIONS_ENABLED } from '../lib/feature-flags';

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
  /** v0.28.0 — status-date override ('' = draw the today line at the real date). */
  todayDateOverride: string;
  setTodayDateOverride: (date: string) => void;
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
  dataRef.current = data; // eslint-disable-line react-hooks/refs -- intentional latest-value ref-sync so async-effect closures (data-loss guard, v12.3) read fresh data, not the stale render-time value

  // v0.27.0 (Pass 2, I1): per-cloud-session sentinel — tracks which project IDs
  // have received at least one real-time snapshot since the current cloud
  // session began. Guards the data-loss check against the cold-load race
  // (empty first snapshot before Firestore hydrates) without blocking
  // legitimate collaborator deletions (which arrive as subsequent empty
  // snapshots). Lives at AppDataProvider scope — a per-effect sentinel
  // would reset on every projectIds change and miss the second-snapshot
  // case. Mutation happens OUTSIDE setData so the updater stays pure
  // (React StrictMode invokes updaters twice).
  const seenFirstSnapshotRef = useRef<Set<string>>(new Set());

  // v18.0.0 — Most-recently-loaded data reference, used by the save effect
  // to identify "data change came from a load, not a user edit" and skip
  // the save. Set in the load effect right before setData; consumed (and
  // cleared) by the save effect on skip. Without this, the spert:models-changed
  // reload would write the just-loaded cloud data back to Firestore and
  // could clobber concurrent collaborator edits (LESSONS-LEARNED §17).
  const loadedDataRef = useRef<AppData | null>(null);

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
  // v0.28.0 — '' means "no override": the today line is drawn at the real
  // current date. The save effect strips the field entirely when empty.
  const [todayDateOverride, setTodayDateOverride] = useState('');
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

  // v18.0.0 — bumped to force the load effect to re-run when an invitation
  // claim transitions a user into a new project's members list. The
  // 'spert:models-changed' listener (below) bumps this counter; the load
  // effect's dependency array includes it so the new project shows up
  // without bypassing the save-suppression flag (LESSONS-LEARNED §17).
  const [reloadCounter, setReloadCounter] = useState(0);

  // Load data from storage on mount (or when storage service changes)
  useEffect(() => {
    let cancelled = false;

    const loadDataFromStorage = async () => {
      // v0.27.0 (Pass 7, J1/J2): reset loading to true at the start of every
      // load cycle. Initial mount already starts with loading: true (useState
      // initializer) — no-op there. For reload cycles (storage swap or
      // spert:models-changed invitation claim), this flips loading back to
      // true so consumers like the import fast-path gate (!appDataLoading)
      // correctly detect "load in progress" during the async gap.
      setLoading(true);
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
            // v18.0.0 — record the loaded reference so the save effect can
            // recognize "this data change is a load, not an edit" and skip.
            loadedDataRef.current = loadedData;
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
            if (typeof loadedData.todayDateOverride === 'string') {
              setTodayDateOverride(loadedData.todayDateOverride);
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
  }, [storage, reloadCounter]);

  // v18.0.0 — Listen for cross-app claim notifications dispatched by
  // AuthContext.claimPendingInvitationsAndNotify. Registered unconditionally
  // (gated only on INVITATIONS_ENABLED) so the listener is mounted by the
  // time the claim event fires immediately after invite-link sign-in.
  // Mode-check is INSIDE the handler — checking it in the effect gate
  // would re-create the listener on every storage swap and risk a race.
  // The reloadCounter pattern triggers loadDataFromStorage via the deps
  // array above, with isResettingRef.current = true suppressing the save
  // effect during the reload (LESSONS-LEARNED §17). The load effect's
  // finally block resets isResettingRef.current = false, so subsequent
  // user edits save normally.
  // Event name 'spert:models-changed' is a suite-wide contract — do not rename.
  useEffect(() => {
    if (!INVITATIONS_ENABLED) return;
    const handler = () => {
      if (storage.mode !== 'cloud') return;
      isResettingRef.current = true;
      setReloadCounter((n) => n + 1);
    };
    window.addEventListener('spert:models-changed', handler);
    return () => window.removeEventListener('spert:models-changed', handler);
  }, [storage]);

  // v0.27.0 (Pass 5, I2): evict a project and its releases from in-memory
  // state when the cloud driver dispatches ganttapp:project-revoked (the
  // owner has removed this user from the project, surfaced via Firestore's
  // permission-denied error on the project's onSnapshot listener).
  //
  // Gated on cloud mode: defensive against stray dispatches in local mode
  // (which would wipe data with no way to recover). The cloud driver is
  // the sole dispatcher today, but the gate makes that contract explicit.
  useEffect(() => {
    if (storage.mode !== 'cloud') return;
    const handler = (e: Event) => {
      const { projectId } = (e as CustomEvent<{ projectId: string }>).detail;
      setData(prev => ({
        ...prev,
        projects: prev.projects.filter(p => p.id !== projectId),
        releases: prev.releases.filter(r => r.projectId !== projectId),
      }));
    };
    window.addEventListener('ganttapp:project-revoked', handler);
    return () => window.removeEventListener('ganttapp:project-revoked', handler);
  }, [storage]);

  // Save legend labels, display settings, and prepared by whenever they change
  useEffect(() => {
    // v18.0.0 — if data === loadedDataRef.current, the most recent state
    // change was a load (initial hydration, storage swap, or claim-event
    // reload). Skip the save and clear the marker so subsequent user
    // edits save normally.
    if (!loading && data === loadedDataRef.current) {
      loadedDataRef.current = null;
      return;
    }
    if (!loading && !isInitialLoadRef.current && !isResettingRef.current) {
      // v16.2: conditionally spread only non-empty label values into the payload,
      // then strip the entire legendLabels field when no customizations exist.
      // Matches the workDays / globalWorkDays / project.legendLabels pattern.
      //
      // TRAP (v0.28.0) — a conditional spread can ADD a field but can never
      // REMOVE one, because `...data` below re-supplies whatever was loaded from
      // storage. Any field that must disappear when the user clears it needs an
      // explicit `delete` after the literal (see the two below). Reachability of
      // the other conditionally-spread fields was audited in v0.28.0:
      //   • exportAttribution — ExportAttributionSection always commits a full
      //     object and the context setter's type forbids undefined. Unreachable.
      //   • globalWorkDays — initial state and Reset both write DEFAULT_WORK_DAYS,
      //     and WorkWeekSelector refuses to emit an empty array. Unreachable.
      const legendLabelsPayload = {
        ...(solidBarLabel && { solidBar: solidBarLabel }),
        ...(hatchedBarLabel && { hatchedBar: hatchedBarLabel }),
        ...(finishDateLabel && { finishDateLine: finishDateLabel }),
        ...(mostLikelyLineLabel && { mostLikelyLine: mostLikelyLineLabel }),
        ...(inProgressLabel && { inProgress: inProgressLabel }),
      };
      const newData: AppData = {
        ...data,
        ...(Object.keys(legendLabelsPayload).length > 0 && { legendLabels: legendLabelsPayload }),
        chartDisplaySettings: displaySettings,
        preparedBy,
        showPreparedBy,
        showTodayLine,
        showFinishDateLine,
        showMostLikelyLine,
        showMonths,
        // v0.28.0: strip when empty so clearing the override deletes the field
        // (field-deletion semantics via the full set() in the Firestore writer).
        ...(todayDateOverride ? { todayDateOverride } : {}),
        ...(exportAttribution ? { exportAttribution } : {}),
        ...(globalWorkDays && globalWorkDays.length > 0 ? { globalWorkDays } : {})
      };
      // v0.28.0: the conditional spreads above cannot CLEAR a field — `...data`
      // still carries the previously-saved value, so omitting the key leaves the
      // stale one in place. Drop them explicitly. (Firestore then deletes the
      // field via the full set() in appDataToUserSettings.)
      //
      // legendLabels carried this bug from v16.2 until v0.28.0: clearing every
      // custom label in Settings → Default Legend Labels wrote the old labels
      // straight back, and they reappeared on the next reload.
      if (Object.keys(legendLabelsPayload).length === 0) delete newData.legendLabels;
      if (!todayDateOverride) delete newData.todayDateOverride;
      storage.saveAppData(newData);
    }
  }, [solidBarLabel, hatchedBarLabel, finishDateLabel, mostLikelyLineLabel, inProgressLabel, displaySettings, preparedBy, showPreparedBy, showTodayLine, todayDateOverride, showFinishDateLine, showMostLikelyLine, showMonths, exportAttribution, globalWorkDays, data, loading, storage]);

  // Real-time sync: subscribe to Firestore changes in cloud mode
  // Stable dependency: sorted project IDs (re-subscribes only when projects are added/removed)
  const projectIds = useMemo(
    () => JSON.stringify(data.projects.map(p => p.id).sort()),
    [data.projects]
  );

  // v0.27.0 (Pass 2, I1): clear sentinel on storage change (new cloud session,
  // or cloud→local→cloud cycle). Placed BEFORE the subscription effect so
  // React runs this clear before the subscriptions for the new storage instance
  // are set up. Effects in a single component run in declaration order.
  useEffect(() => {
    seenFirstSnapshotRef.current.clear();
  }, [storage]);

  useEffect(() => {
    if (storage.mode !== 'cloud' || loading) return;

    const cloudStorage = storage as CloudGanttStorageService;
    const ids: string[] = JSON.parse(projectIds);

    const unsubscribers = ids.map(projectId =>
      cloudStorage.subscribeToProject(projectId, (releases, snapshot) => {
        // Skip local echoes — only apply server-confirmed data
        if (snapshot.metadata.hasPendingWrites) return;

        // v0.27.0 (Pass 2, I1): compute and mutate sentinel BEFORE setData.
        // The mutation outside the updater keeps the updater pure
        // (StrictMode invokes updaters twice — Set.add on already-added is
        // idempotent so both invocations see the same isFirstSnapshot value
        // via the closure-captured const). Without this, the data-loss guard
        // below would fire on every empty snapshot and permanently block
        // legitimate collaborator deletions.
        const isFirstSnapshot = !seenFirstSnapshotRef.current.has(projectId);
        seenFirstSnapshotRef.current.add(projectId);

        setData(prev => {
          // Data-loss guard: only check on the FIRST snapshot for this project.
          // Cold-load race: empty first snapshot before Firestore hydrates.
          // Collaborator deletion case: subsequent empty snapshots must pass.
          // v16.6: safe post-sign-out — clearAllData() clears in-memory before
          // the real-time listener re-subscribes, so prev.releases is empty.
          if (isFirstSnapshot) {
            const existingCount = prev.releases.filter(r => r.projectId === projectId).length;
            if (releases.length === 0 && existingCount > 0) {
              console.warn(
                `Cloud returned 0 releases for project ${projectId} but local has ${existingCount} — skipping (first snapshot only)`
              );
              return prev;
            }
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
    setTodayDateOverride('');
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
    todayDateOverride,
    setTodayDateOverride,
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
