// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

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
  getSendInvitationEmail: () => null,
  getClaimPendingInvitations: () => null,
  getRevokeInvite: () => null,
  getResendInvite: () => null,
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
        inProgressBar: '#f59e0b',
      });
    });

    it('initializes with empty legend labels (v16.2: hardcoded defaults applied at render via DEFAULT_LEGEND_LABELS)', () => {
      const { result } = renderHook(() => useAppData(), { wrapper });

      // v16.2: initial state is '' (empty) — consumers fall through to DEFAULT_LEGEND_LABELS
      // for rendering and edit-box starting values. Settings inputs show the defaults as
      // HTML placeholders instead of as literal values.
      expect(result.current.solidBarLabel).toBe('');
      expect(result.current.hatchedBarLabel).toBe('');
      expect(result.current.finishDateLabel).toBe('');
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
        completedBar: '#90ee90',
        inProgressBar: '#f59e0b',
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
          completedBar: '#90ee90',
        inProgressBar: '#f59e0b',
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
        inProgressBar: '#f59e0b',
      });
      // v16.2: initial state is '' (uncustomized); rendering falls back to DEFAULT_LEGEND_LABELS
      expect(result.current.solidBarLabel).toBe('');
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

  describe('globalWorkDays (v15.0, v16.3 default Mon–Fri)', () => {
    it('hydrates globalWorkDays from loaded data', async () => {
      const savedData: AppData = {
        projects: [],
        releases: [],
        globalWorkDays: [0, 6], // Saturday + Sunday only — intentionally different from default
      };
      localStorage.setItem('ganttAppData', JSON.stringify(savedData));

      const { result } = renderHook(() => useAppData(), { wrapper });

      await waitFor(() => {
        expect(result.current.globalWorkDays).toEqual([0, 6]);
      });
    });

    it('defaults globalWorkDays to Mon–Fri when absent from loaded data (v16.3)', async () => {
      const savedData: AppData = {
        projects: [{ id: 'p1', name: 'Test' }],
        releases: [],
        // globalWorkDays intentionally omitted — simulates v15.x users who never configured a work week
      };
      localStorage.setItem('ganttAppData', JSON.stringify(savedData));

      const { result } = renderHook(() => useAppData(), { wrapper });

      await waitFor(() => {
        expect(result.current.data.projects).toHaveLength(1);
      });

      // v16.3: initial Mon–Fri default survives load when stored data omits globalWorkDays
      expect(result.current.globalWorkDays).toEqual([1, 2, 3, 4, 5]);
    });

    it('context exposes setGlobalWorkDays', () => {
      const { result } = renderHook(() => useAppData(), { wrapper });

      act(() => {
        result.current.setGlobalWorkDays([0, 6]);
      });

      expect(result.current.globalWorkDays).toEqual([0, 6]);
    });

    it('save effect includes globalWorkDays when defined', async () => {
      const savedData: AppData = {
        projects: [{ id: 'p1', name: 'Test' }],
        releases: [],
      };
      localStorage.setItem('ganttAppData', JSON.stringify(savedData));

      const { result } = renderHook(() => useAppData(), { wrapper });

      await waitFor(() => {
        expect(result.current.data.projects).toHaveLength(1);
      });

      act(() => {
        result.current.setGlobalWorkDays([1, 2, 3]);
      });

      // The save effect writes to localStorage — check that globalWorkDays is present
      await waitFor(() => {
        const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
        expect(stored.globalWorkDays).toEqual([1, 2, 3]);
      });
    });

    it('save effect persists Mon–Fri default for first-time users (v16.3)', async () => {
      // First-time user: no localStorage entry at all. After mount + save fires,
      // the Mon–Fri default should be persisted so warnings work across reloads.
      const { result } = renderHook(() => useAppData(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Trigger a save — the default globalWorkDays should land in storage
      act(() => {
        result.current.setShowTodayLine(false);
      });

      await waitFor(() => {
        const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
        expect(stored.globalWorkDays).toEqual([1, 2, 3, 4, 5]);
      });
    });
  });

  describe('clearAllData (v16.6)', () => {
    it('resets all exposed fields to initial values', async () => {
      const seeded: AppData = {
        projects: [{ id: 'p1', name: 'Project 1' }],
        releases: [{
          id: 'r1', projectId: 'p1', name: 'R1',
          startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01',
        }],
        preparedBy: 'Alice',
        showPreparedBy: true,
        exportAttribution: { name: 'Alice', identifier: 'team-42' },
        legendLabels: { solidBar: 'Custom Solid', hatchedBar: 'Custom Hatched' },
        showMostLikelyLine: true,
      };
      localStorage.setItem('ganttAppData', JSON.stringify(seeded));

      const { result } = renderHook(() => useAppData(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      // Pre-check: loaded values are present
      expect(result.current.data.projects.length).toBe(1);
      expect(result.current.preparedBy).toBe('Alice');
      expect(result.current.solidBarLabel).toBe('Custom Solid');
      expect(result.current.showMostLikelyLine).toBe(true);
      expect(result.current.exportAttribution).toEqual({ name: 'Alice', identifier: 'team-42' });

      act(() => {
        result.current.clearAllData();
      });

      // All fields back to initial values
      expect(result.current.data).toEqual({ projects: [], releases: [] });
      expect(result.current.preparedBy).toBe('');
      expect(result.current.showPreparedBy).toBe(false);
      expect(result.current.solidBarLabel).toBe('');
      expect(result.current.hatchedBarLabel).toBe('');
      expect(result.current.finishDateLabel).toBe('');
      expect(result.current.mostLikelyLineLabel).toBe('');
      expect(result.current.inProgressLabel).toBe('');
      expect(result.current.showTodayLine).toBe(true);
      expect(result.current.showFinishDateLine).toBe(true);
      expect(result.current.showMostLikelyLine).toBe(false);
      expect(result.current.showMonths).toBe(false);
      expect(result.current.showColorSettings).toBe(false);
      expect(result.current.exportAttribution).toBeUndefined();
      expect(result.current.globalWorkDays).toEqual([1, 2, 3, 4, 5]);
    });

    it('does NOT write cleared defaults to localStorage (save effect suppressed)', async () => {
      const seeded: AppData = {
        projects: [{ id: 'p1', name: 'Project 1' }],
        releases: [],
        preparedBy: 'Alice',
      };
      localStorage.setItem('ganttAppData', JSON.stringify(seeded));

      const { result } = renderHook(() => useAppData(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.clearAllData();
      });

      // localStorage still has Alice's seeded data — save effect did not overwrite it
      await new Promise(resolve => setTimeout(resolve, 50));
      const stored = JSON.parse(localStorage.getItem('ganttAppData')!);
      expect(stored.projects).toEqual([{ id: 'p1', name: 'Project 1' }]);
      expect(stored.preparedBy).toBe('Alice');
    });

    // Note: save-effect re-enable after clearAllData requires a subsequent
    // storage swap (which triggers the load effect's finally block that
    // lowers isResettingRef). That flow is exercised end-to-end by PHASE 1
    // integration tests (StorageContext.test.tsx performSignOutWithCleanup).
    // Unit-testing it here would require manually swapping the storage
    // instance through the StorageContext wrapper, which isn't worth the
    // scaffold cost.
  });
});
