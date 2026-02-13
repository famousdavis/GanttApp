import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { AppDataProvider, useAppData } from '../AppDataContext';
import { AppData } from '../../shared/types/app';

// Wrapper component for hooks that need the provider
function wrapper({ children }: { children: ReactNode }) {
  return <AppDataProvider>{children}</AppDataProvider>;
}

describe('AppDataContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('useAppData outside provider', () => {
    it('throws error when used outside AppDataProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAppData());
      }).toThrow('useAppData must be used within an AppDataProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('initial state', () => {
    it('initializes with empty projects and releases', () => {
      const { result } = renderHook(() => useAppData(), { wrapper });

      expect(result.current.data.projects).toEqual([]);
      expect(result.current.data.releases).toEqual([]);
    });

    it('initializes with default chart colors', () => {
      const { result } = renderHook(() => useAppData(), { wrapper });

      expect(result.current.chartColors).toEqual({
        solidBar: '#0070f3',
        hatchedBar: '#0070f3',
        todayLine: '#dc3545',
        finishDateLine: '#00ff00',
        mostLikelyLine: '#0070f3',
      });
    });

    it('initializes with default legend labels', () => {
      const { result } = renderHook(() => useAppData(), { wrapper });

      expect(result.current.solidBarLabel).toBe('Design, Code, Test');
      expect(result.current.hatchedBarLabel).toBe('Delivery Uncertainty');
      expect(result.current.finishDateLabel).toBe('Project Finish Date');
    });

    it('initializes with default toggle states', () => {
      const { result } = renderHook(() => useAppData(), { wrapper });

      expect(result.current.showTodayLine).toBe(true);
      expect(result.current.showFinishDateLine).toBe(true);
      expect(result.current.showColorSettings).toBe(false);
    });

    it('initializes with default display settings', () => {
      const { result } = renderHook(() => useAppData(), { wrapper });

      expect(result.current.displaySettings).toEqual({
        releaseNameFontSize: '16',
        dateLabelFontSize: '13',
        dateLabelColor: '#666',
        verticalLineWidth: '2',
        barHeight: '30',
        rowSpacing: '25',
      });
    });
  });

  describe('data operations', () => {
    it('updates data and saves to localStorage via updateData', () => {
      const { result } = renderHook(() => useAppData(), { wrapper });

      const newData: AppData = {
        projects: [{ id: '1', name: 'Test Project' }],
        releases: [],
      };

      act(() => {
        result.current.updateData(newData);
      });

      expect(result.current.data).toEqual(newData);

      // Verify it was saved to localStorage
      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects[0].name).toBe('Test Project');
    });

    it('updates chart colors', () => {
      const { result } = renderHook(() => useAppData(), { wrapper });

      const newColors = {
        solidBar: '#ff0000',
        hatchedBar: '#00ff00',
        todayLine: '#0000ff',
        finishDateLine: '#ffff00',
        mostLikelyLine: '#000000',
      };

      act(() => {
        result.current.setChartColors(newColors);
      });

      expect(result.current.chartColors).toEqual(newColors);
    });

    it('updates active preset', () => {
      const { result } = renderHook(() => useAppData(), { wrapper });

      act(() => {
        result.current.setActivePreset('Professional');
      });

      expect(result.current.activePreset).toBe('Professional');
    });

    it('updates display settings', () => {
      const { result } = renderHook(() => useAppData(), { wrapper });

      act(() => {
        result.current.setDisplaySettings({
          releaseNameFontSize: '18',
          dateLabelFontSize: '15',
          dateLabelColor: '#000',
          verticalLineWidth: '4',
          barHeight: '40',
          rowSpacing: '25',
        });
      });

      expect(result.current.displaySettings.releaseNameFontSize).toBe('18');
    });

    it('updates legend labels', () => {
      const { result } = renderHook(() => useAppData(), { wrapper });

      act(() => {
        result.current.setSolidBarLabel('Custom Solid');
        result.current.setHatchedBarLabel('Custom Hatched');
        result.current.setFinishDateLabel('Custom Finish');
      });

      expect(result.current.solidBarLabel).toBe('Custom Solid');
      expect(result.current.hatchedBarLabel).toBe('Custom Hatched');
      expect(result.current.finishDateLabel).toBe('Custom Finish');
    });

    it('updates toggle states', () => {
      const { result } = renderHook(() => useAppData(), { wrapper });

      act(() => {
        result.current.setShowTodayLine(false);
        result.current.setShowFinishDateLine(false);
        result.current.setShowColorSettings(true);
      });

      expect(result.current.showTodayLine).toBe(false);
      expect(result.current.showFinishDateLine).toBe(false);
      expect(result.current.showColorSettings).toBe(true);
    });
  });

  describe('localStorage persistence', () => {
    it('loads existing data from localStorage on mount', () => {
      const savedData: AppData = {
        projects: [{ id: '1', name: 'Saved Project' }],
        releases: [],
        chartColors: {
          solidBar: '#111111',
          hatchedBar: '#222222',
          todayLine: '#333333',
          finishDateLine: '#444444',
          mostLikelyLine: '#555555',
        },
        legendLabels: {
          solidBar: 'Saved Solid',
          hatchedBar: 'Saved Hatched',
          finishDateLine: 'Saved Finish',
        },
        showFinishDateLine: false,
        chartDisplaySettings: {
          releaseNameFontSize: '18',
          dateLabelFontSize: '15',
          dateLabelColor: '#000',
          verticalLineWidth: '4',
          barHeight: '40',
          rowSpacing: '25',
        },
      };

      localStorage.setItem('ganttAppData', JSON.stringify(savedData));

      const { result } = renderHook(() => useAppData(), { wrapper });

      // Wait for useEffect to run
      expect(result.current.data.projects[0].name).toBe('Saved Project');
      expect(result.current.chartColors.solidBar).toBe('#111111');
      expect(result.current.solidBarLabel).toBe('Saved Solid');
      expect(result.current.hatchedBarLabel).toBe('Saved Hatched');
      expect(result.current.finishDateLabel).toBe('Saved Finish');
      expect(result.current.showFinishDateLine).toBe(false);
      expect(result.current.displaySettings.releaseNameFontSize).toBe('18');
    });

    it('loads active preset from localStorage', () => {
      const savedData: AppData = {
        projects: [],
        releases: [],
        activePreset: 'Ocean',
      };

      localStorage.setItem('ganttAppData', JSON.stringify(savedData));

      const { result } = renderHook(() => useAppData(), { wrapper });
      expect(result.current.activePreset).toBe('Ocean');
    });

    it('uses defaults when localStorage data has no optional fields', () => {
      const savedData: AppData = {
        projects: [{ id: '1', name: 'Basic' }],
        releases: [],
      };

      localStorage.setItem('ganttAppData', JSON.stringify(savedData));

      const { result } = renderHook(() => useAppData(), { wrapper });

      // Should use defaults for optional fields
      expect(result.current.chartColors).toEqual({
        solidBar: '#0070f3',
        hatchedBar: '#0070f3',
        todayLine: '#dc3545',
        finishDateLine: '#00ff00',
        mostLikelyLine: '#0070f3',
      });
      expect(result.current.solidBarLabel).toBe('Design, Code, Test');
      expect(result.current.showFinishDateLine).toBe(true);
    });
  });
});
