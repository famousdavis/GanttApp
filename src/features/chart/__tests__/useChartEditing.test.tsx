// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChartEditing } from '../useChartEditing';
import { AppDataProvider, useAppData } from '../../../context/AppDataContext';
import { StorageProvider } from '../../../context/StorageContext';
import { AuthProvider } from '../../../context/AuthContext';
import { ThemeProvider } from '../../../context/ThemeContext';
import React from 'react';

// Mock firebase modules
vi.mock('../../../lib/firebase', () => ({
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

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Test data
const testRelease = {
  id: 'r1',
  projectId: 'p1',
  name: 'Release 1',
  startDate: '2026-01-01',
  earlyFinishDate: '2026-02-01',
  lateFinishDate: '2026-03-01'
};

const testData = {
  projects: [{ id: 'p1', name: 'Project 1' }],
  releases: [testRelease],
  legendLabels: {
    solidBar: 'Design, Code, Test',
    hatchedBar: 'Delivery Uncertainty',
    finishDateLine: 'Project Finish Date'
  }
};

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <StorageProvider>
        <ThemeProvider>
          <AppDataProvider>
            {children}
          </AppDataProvider>
        </ThemeProvider>
      </StorageProvider>
    </AuthProvider>
  );
}

describe('useChartEditing', () => {
  beforeEach(() => {
    localStorageMock.clear();
    localStorageMock.setItem('gantt-data', JSON.stringify(testData));
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: null) => void) => {
      callback(null);
      return vi.fn();
    });
  });

  describe('legend label editing', () => {
    it('starts editing a legend label', () => {
      const { result } = renderHook(() => useChartEditing(), { wrapper });

      act(() => {
        result.current.startEditLabel('solid');
      });

      expect(result.current.editingLegendLabel).toBe('solid');
      expect(result.current.tempLabelValue).toBe('Design, Code, Test');
    });

    it('cancels legend label editing', () => {
      const { result } = renderHook(() => useChartEditing(), { wrapper });

      act(() => {
        result.current.startEditLabel('hatched');
      });

      act(() => {
        result.current.cancelLabelEdit();
      });

      expect(result.current.editingLegendLabel).toBeNull();
      expect(result.current.tempLabelValue).toBe('');
    });

    it('hasActiveEditor is true when editing label', () => {
      const { result } = renderHook(() => useChartEditing(), { wrapper });

      expect(result.current.hasActiveEditor).toBe(false);

      act(() => {
        result.current.startEditLabel('solid');
      });

      expect(result.current.hasActiveEditor).toBe(true);
    });

    it('startEditLabel with empty global state and no project opens edit box at DEFAULT_LEGEND_LABELS value (v16.2)', () => {
      // v16.2: raw global state initializes to '' (uncustomized). startEditLabel must
      // fall back to DEFAULT_LEGEND_LABELS.<key> so the edit box opens at the visible
      // effective label, never empty. Regression guard — without the `|| DEFAULT_LEGEND_LABELS.key`
      // fallback in startEditLabel, the edit box would open with ''.
      const { result } = renderHook(() => useChartEditing(), { wrapper });

      // All 5 label types start with their hardcoded default when no customization exists
      act(() => { result.current.startEditLabel('solid'); });
      expect(result.current.tempLabelValue).toBe('Design, Code, Test');

      act(() => { result.current.startEditLabel('hatched'); });
      expect(result.current.tempLabelValue).toBe('Delivery Uncertainty');

      act(() => { result.current.startEditLabel('finishDate'); });
      expect(result.current.tempLabelValue).toBe('Project Finish Date');

      act(() => { result.current.startEditLabel('mostLikelyLine'); });
      expect(result.current.tempLabelValue).toBe('Most Likely Finish');

      act(() => { result.current.startEditLabel('inProgress'); });
      expect(result.current.tempLabelValue).toBe('In Progress');
    });
  });

  describe('release name editing', () => {
    it('starts editing a release name', () => {
      const { result } = renderHook(() => useChartEditing(), { wrapper });

      act(() => {
        result.current.startEditReleaseName('r1', 'Release 1');
      });

      expect(result.current.editingReleaseId).toBe('r1');
      expect(result.current.tempReleaseName).toBe('Release 1');
    });

    it('cancels release name editing', () => {
      const { result } = renderHook(() => useChartEditing(), { wrapper });

      act(() => {
        result.current.startEditReleaseName('r1', 'Release 1');
      });

      act(() => {
        result.current.cancelReleaseNameEdit();
      });

      expect(result.current.editingReleaseId).toBeNull();
      expect(result.current.tempReleaseName).toBe('');
    });

    it('hasActiveEditor is true when editing release name', () => {
      const { result } = renderHook(() => useChartEditing(), { wrapper });

      act(() => {
        result.current.startEditReleaseName('r1', 'Release 1');
      });

      expect(result.current.hasActiveEditor).toBe(true);
    });
  });

  describe('date editing', () => {
    it('starts editing a date', () => {
      const { result } = renderHook(() => useChartEditing(), { wrapper });

      act(() => {
        result.current.startEditDate('r1', 'start', '2026-01-01');
      });

      expect(result.current.editingDateInfo).toEqual({ releaseId: 'r1', dateType: 'start' });
      expect(result.current.tempDateValue).toBe('2026-01-01');
      expect(result.current.dateEditError).toBe('');
    });

    it('cancels date editing', () => {
      const { result } = renderHook(() => useChartEditing(), { wrapper });

      act(() => {
        result.current.startEditDate('r1', 'early', '2026-02-01');
      });

      act(() => {
        result.current.cancelDateEdit();
      });

      expect(result.current.editingDateInfo).toBeNull();
      expect(result.current.tempDateValue).toBe('');
      expect(result.current.dateEditError).toBe('');
    });

    it('hasActiveEditor is true when editing date', () => {
      const { result } = renderHook(() => useChartEditing(), { wrapper });

      act(() => {
        result.current.startEditDate('r1', 'late', '2026-03-01');
      });

      expect(result.current.hasActiveEditor).toBe(true);
    });

    it('can update temp values', () => {
      const { result } = renderHook(() => useChartEditing(), { wrapper });

      act(() => {
        result.current.startEditDate('r1', 'start', '2026-01-01');
      });

      act(() => {
        result.current.setTempDateValue('2026-01-15');
      });

      expect(result.current.tempDateValue).toBe('2026-01-15');
    });
  });

  describe('saveLabelEdit', () => {
    it('rejects empty label and cancels instead', () => {
      const { result } = renderHook(() => useChartEditing(), { wrapper });

      act(() => {
        result.current.startEditLabel('solid');
      });

      // Set to empty string
      act(() => {
        result.current.setTempLabelValue('');
      });

      act(() => {
        result.current.saveLabelEdit();
      });

      // Should have cancelled (editingLegendLabel is null)
      expect(result.current.editingLegendLabel).toBeNull();
    });

    it('rejects whitespace-only label and cancels instead', () => {
      const { result } = renderHook(() => useChartEditing(), { wrapper });

      act(() => {
        result.current.startEditLabel('hatched');
      });

      act(() => {
        result.current.setTempLabelValue('   ');
      });

      act(() => {
        result.current.saveLabelEdit();
      });

      expect(result.current.editingLegendLabel).toBeNull();
    });
  });

  describe('hasActiveEditor', () => {
    it('is false when no editors are open', () => {
      const { result } = renderHook(() => useChartEditing(), { wrapper });
      expect(result.current.hasActiveEditor).toBe(false);
    });
  });

  // --- v16.1: project-scope legend label saves ---

  describe('project-scope label save (v16.1)', () => {
    // Helper: render useChartEditing with activeProjectId and access AppDataContext
    // through its useAppData hook to seed/inspect project state.
    const renderBothHooks = (activeProjectId?: string) => {
      const useCombined = () => {
        const editing = useChartEditing(activeProjectId);
        const appData = useAppData();
        return { editing, appData };
      };
      return renderHook(useCombined, { wrapper });
    };

    it('starts edit with effective label (project override) when activeProjectId is set', () => {
      const { result } = renderBothHooks('p1');

      // Seed a project override
      act(() => {
        result.current.appData.updateData({
          ...result.current.appData.data,
          projects: [{ id: 'p1', name: 'Project 1', legendLabels: { solidBar: 'Custom Build' } }],
        });
      });

      act(() => {
        result.current.editing.startEditLabel('solid');
      });

      expect(result.current.editing.tempLabelValue).toBe('Custom Build');
    });

    it('starts edit with global label when activeProjectId has no override for that key', () => {
      const { result } = renderBothHooks('p1');

      act(() => {
        result.current.appData.updateData({
          ...result.current.appData.data,
          projects: [{ id: 'p1', name: 'Project 1', legendLabels: { hatchedBar: 'Custom' } }],
        });
      });

      // solidBar has no override — should fall through to global
      act(() => {
        result.current.editing.startEditLabel('solid');
      });

      expect(result.current.editing.tempLabelValue).toBe('Design, Code, Test');
    });

    it('saves label to project scope when activeProjectId is set', () => {
      const { result } = renderBothHooks('p1');

      act(() => {
        result.current.appData.updateData({
          ...result.current.appData.data,
          projects: [{ id: 'p1', name: 'Project 1' }],
        });
      });

      act(() => {
        result.current.editing.startEditLabel('solid');
      });
      act(() => {
        result.current.editing.setTempLabelValue('Project Build Phase');
      });
      act(() => {
        result.current.editing.saveLabelEdit();
      });

      // Project legendLabels should now contain the override
      const project = result.current.appData.data.projects.find(p => p.id === 'p1');
      expect(project?.legendLabels?.solidBar).toBe('Project Build Phase');
      // Global raw state should be UNCHANGED — v16.2: empty by default (= "not customized",
      // render path falls back to DEFAULT_LEGEND_LABELS). Project-scope save must not touch it.
      expect(result.current.appData.solidBarLabel).toBe('');
    });

    it('saves label to global scope when activeProjectId is undefined', () => {
      const { result } = renderBothHooks(undefined);

      act(() => {
        result.current.editing.startEditLabel('solid');
      });
      act(() => {
        result.current.editing.setTempLabelValue('New Global');
      });
      act(() => {
        result.current.editing.saveLabelEdit();
      });

      // Global state updated
      expect(result.current.appData.solidBarLabel).toBe('New Global');
    });

    it('appends to existing project legendLabels rather than replacing', () => {
      const { result } = renderBothHooks('p1');

      act(() => {
        result.current.appData.updateData({
          ...result.current.appData.data,
          projects: [{ id: 'p1', name: 'Project 1', legendLabels: { hatchedBar: 'Existing Hatched' } }],
        });
      });

      act(() => {
        result.current.editing.startEditLabel('solid');
      });
      act(() => {
        result.current.editing.setTempLabelValue('New Solid');
      });
      act(() => {
        result.current.editing.saveLabelEdit();
      });

      const project = result.current.appData.data.projects.find(p => p.id === 'p1');
      // Both keys should be present
      expect(project?.legendLabels?.solidBar).toBe('New Solid');
      expect(project?.legendLabels?.hatchedBar).toBe('Existing Hatched');
    });

    it('maps all five LegendLabelType values to correct ProjectLegendLabels keys', () => {
      // Regression test for the silent-fallthrough bug class in typeToKey mapping.
      // Verifies each LegendLabelType saves to the correct project key.
      const cases: Array<[import('../useChartEditing').LegendLabelType, string]> = [
        ['solid', 'solidBar'],
        ['hatched', 'hatchedBar'],
        ['finishDate', 'finishDateLine'],
        ['mostLikelyLine', 'mostLikelyLine'],
        ['inProgress', 'inProgress'],
      ];

      for (const [legendType, expectedKey] of cases) {
        const { result } = renderBothHooks('p1');
        act(() => {
          result.current.appData.updateData({
            ...result.current.appData.data,
            projects: [{ id: 'p1', name: 'Project 1' }],
          });
        });
        act(() => { result.current.editing.startEditLabel(legendType); });
        act(() => { result.current.editing.setTempLabelValue(`Val-${expectedKey}`); });
        act(() => { result.current.editing.saveLabelEdit(); });

        const project = result.current.appData.data.projects.find(p => p.id === 'p1');
        expect(project?.legendLabels?.[expectedKey as keyof NonNullable<typeof project.legendLabels>])
          .toBe(`Val-${expectedKey}`);
      }
    });
  });
});
