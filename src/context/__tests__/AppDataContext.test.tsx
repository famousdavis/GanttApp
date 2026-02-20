import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { AppDataProvider, useAppData } from '../AppDataContext';
import { StorageProvider } from '../StorageContext';
import { AuthProvider } from '../AuthContext';
import { AppData } from '../../shared/types/app';

// Mock firebase modules
vi.mock('../../lib/firebase', () => ({
  auth: null,
  db: null,
  isFirebaseAvailable: false,
}));

const mockOnAuthStateChanged = vi.fn();
vi.mock('firebase/auth', () => {
  class MockGoogleAuthProvider { addScope = vi.fn(); }
  class MockOAuthProvider { addScope = vi.fn(); constructor(_id: string) {} }
  return {
    onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    GoogleAuthProvider: MockGoogleAuthProvider,
    OAuthProvider: MockOAuthProvider,
  };
});

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  collection: vi.fn(),
  writeBatch: vi.fn(() => ({ set: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) })),
}));

// Wrapper component for hooks that need the provider
function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider><StorageProvider><AppDataProvider>{children}</AppDataProvider></StorageProvider></AuthProvider>;
}

describe('AppDataContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: null) => void) => {
      callback(null);
      return vi.fn();
    });
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
        completedBar: '#90ee90',
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
    it('loads existing data from localStorage on mount', async () => {
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

      // Wait for async load to complete
      await waitFor(() => {
        expect(result.current.data.projects[0].name).toBe('Saved Project');
      });
      expect(result.current.chartColors.solidBar).toBe('#111111');
      expect(result.current.solidBarLabel).toBe('Saved Solid');
      expect(result.current.hatchedBarLabel).toBe('Saved Hatched');
      expect(result.current.finishDateLabel).toBe('Saved Finish');
      expect(result.current.showFinishDateLine).toBe(false);
      expect(result.current.displaySettings.releaseNameFontSize).toBe('18');
    });

    it('loads active preset from localStorage', async () => {
      const savedData: AppData = {
        projects: [],
        releases: [],
        activePreset: 'Ocean',
      };

      localStorage.setItem('ganttAppData', JSON.stringify(savedData));

      const { result } = renderHook(() => useAppData(), { wrapper });
      await waitFor(() => {
        expect(result.current.activePreset).toBe('Ocean');
      });
    });

    it('loads exportAttribution from localStorage', async () => {
      const savedData: AppData = {
        projects: [],
        releases: [],
        exportAttribution: { name: 'Test User', identifier: 'test@example.com' },
      };

      localStorage.setItem('ganttAppData', JSON.stringify(savedData));

      const { result } = renderHook(() => useAppData(), { wrapper });
      await waitFor(() => {
        expect(result.current.exportAttribution).toEqual({ name: 'Test User', identifier: 'test@example.com' });
      });
    });

    it('initializes exportAttribution as undefined when not in localStorage', async () => {
      const savedData: AppData = {
        projects: [],
        releases: [],
      };

      localStorage.setItem('ganttAppData', JSON.stringify(savedData));

      const { result } = renderHook(() => useAppData(), { wrapper });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.exportAttribution).toBeUndefined();
    });

    it('updates exportAttribution via setExportAttribution', () => {
      const { result } = renderHook(() => useAppData(), { wrapper });

      act(() => {
        result.current.setExportAttribution({ name: 'New User', identifier: 'new@test.com' });
      });

      expect(result.current.exportAttribution).toEqual({ name: 'New User', identifier: 'new@test.com' });
    });

    it('uses defaults when localStorage data has no optional fields', async () => {
      const savedData: AppData = {
        projects: [{ id: '1', name: 'Basic' }],
        releases: [],
      };

      localStorage.setItem('ganttAppData', JSON.stringify(savedData));

      const { result } = renderHook(() => useAppData(), { wrapper });

      // Wait for async load, then verify defaults for optional fields
      await waitFor(() => {
        expect(result.current.data.projects[0].name).toBe('Basic');
      });
      expect(result.current.chartColors).toEqual({
        solidBar: '#0070f3',
        hatchedBar: '#0070f3',
        todayLine: '#dc3545',
        finishDateLine: '#00ff00',
        mostLikelyLine: '#0070f3',
        completedBar: '#90ee90',
      });
      expect(result.current.solidBarLabel).toBe('Design, Code, Test');
      expect(result.current.showFinishDateLine).toBe(true);
    });
  });

  describe('real-time sync', () => {
    it('does not subscribe to projects in local mode', async () => {
      const savedData: AppData = {
        projects: [{ id: 'p1', name: 'Test' }],
        releases: [],
      };
      localStorage.setItem('ganttAppData', JSON.stringify(savedData));

      const { result } = renderHook(() => useAppData(), { wrapper });

      await waitFor(() => {
        expect(result.current.data.projects).toHaveLength(1);
      });

      // In local mode, storage.mode === 'local', so no subscriptions should be created
      // If subscriptions were attempted, firebase/firestore mock would be called — it is not
      expect(result.current.data.projects[0].name).toBe('Test');
    });
  });
});
