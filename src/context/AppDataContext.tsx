// Global application data context

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppData, Project, Release, ChartColors, ChartDisplaySettings } from '../shared/types';
import { saveData, loadData } from '../shared/utils';
import { DEFAULT_CHART_COLORS, DEFAULT_DISPLAY_SETTINGS } from '../shared/utils';

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

  // Toggles
  showTodayLine: boolean;
  setShowTodayLine: (show: boolean) => void;
  showFinishDateLine: boolean;
  setShowFinishDateLine: (show: boolean) => void;
  showColorSettings: boolean;
  setShowColorSettings: (show: boolean) => void;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>({ projects: [], releases: [] });
  const [loading, setLoading] = useState(true);

  // Chart settings
  const [chartColors, setChartColors] = useState<ChartColors>(DEFAULT_CHART_COLORS);
  const [activePreset, setActivePreset] = useState<string | undefined>(undefined);
  const [displaySettings, setDisplaySettings] = useState<ChartDisplaySettings>(DEFAULT_DISPLAY_SETTINGS);

  // Legend labels
  const [solidBarLabel, setSolidBarLabel] = useState('Design, Code, Test');
  const [hatchedBarLabel, setHatchedBarLabel] = useState('Delivery Uncertainty');
  const [finishDateLabel, setFinishDateLabel] = useState('Project Finish Date');

  // Toggles
  const [showTodayLine, setShowTodayLine] = useState(true);
  const [showFinishDateLine, setShowFinishDateLine] = useState(true);
  const [showColorSettings, setShowColorSettings] = useState(false);

  // Load data from localStorage on mount
  useEffect(() => {
    const loadDataFromStorage = () => {
      try {
        const loadedData = loadData();
        if (loadedData) {
          setData(loadedData);

          // Load chart colors or use defaults
          if (loadedData.chartColors) {
            setChartColors(loadedData.chartColors);
          }

          // Load active preset if it exists
          if (loadedData.activePreset) {
            setActivePreset(loadedData.activePreset);
          }

          // Load legend labels if they exist
          if (loadedData.legendLabels) {
            setSolidBarLabel(loadedData.legendLabels.solidBar);
            setHatchedBarLabel(loadedData.legendLabels.hatchedBar);
            if (loadedData.legendLabels.finishDateLine) {
              setFinishDateLabel(loadedData.legendLabels.finishDateLine);
            }
          }

          // Load finish date line toggle if it exists
          if (loadedData.showFinishDateLine !== undefined) {
            setShowFinishDateLine(loadedData.showFinishDateLine);
          }

          // Load display settings if they exist
          if (loadedData.chartDisplaySettings) {
            setDisplaySettings(loadedData.chartDisplaySettings);
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataFromStorage();
  }, []);

  // Save legend labels to localStorage whenever they change
  useEffect(() => {
    if (!loading) {
      const newData = {
        ...data,
        legendLabels: {
          solidBar: solidBarLabel,
          hatchedBar: hatchedBarLabel,
          finishDateLine: finishDateLabel
        }
      };
      saveData(newData);
    }
  }, [solidBarLabel, hatchedBarLabel, finishDateLabel, loading]);

  // Save display settings to localStorage whenever they change
  useEffect(() => {
    if (!loading) {
      const newData = { ...data, chartDisplaySettings: displaySettings };
      saveData(newData);
    }
  }, [displaySettings, loading]);

  // Update data and save to localStorage
  const updateData = (newData: AppData) => {
    setData(newData);
    saveData(newData);
  };

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
    showTodayLine,
    setShowTodayLine,
    showFinishDateLine,
    setShowFinishDateLine,
    showColorSettings,
    setShowColorSettings
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (context === undefined) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
}
