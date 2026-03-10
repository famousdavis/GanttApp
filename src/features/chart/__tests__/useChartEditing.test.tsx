// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChartEditing } from '../useChartEditing';
import { AppDataProvider } from '../../../context/AppDataContext';
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
});
