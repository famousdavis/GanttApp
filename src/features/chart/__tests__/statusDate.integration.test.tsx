// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// v0.28.0 — end-to-end guard for the status-date chain, wiring the REAL
// AppDataProvider to the REAL ChartSettings and ChartLegend exactly as
// pages/index.tsx does.
//
// Why this exists as its own file: the unit tests cover each link in isolation
// (input commits '' → context; context '' → key stripped from storage; absent
// override → "Today's Date"), but nothing proved the links are wired to each
// other. Manual browser verification could drive SETTING a date but not
// CLEARING it — React's input value tracker suppresses synthetic empty-value
// change events — so the clear path is guarded here instead.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { AppDataProvider, useAppData } from '../../../context/AppDataContext';
import { StorageProvider } from '../../../context/StorageContext';
import { AuthProvider } from '../../../context/AuthContext';
import { ThemeProvider } from '../../../context/ThemeContext';
import { ChartSettings } from '../ChartSettings';
import { ChartLegend } from '../ChartLegend';
import { DEFAULT_CHART_COLORS, DEFAULT_DISPLAY_SETTINGS } from '../../../shared/utils/colors';

vi.mock('../../../lib/firebase', () => ({
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

/**
 * Mirrors the wiring in pages/index.tsx + GanttChart: the settings input binds
 * to the LIVE context value, and the legend's wording is driven by whether an
 * override is in effect.
 */
function Harness() {
  const ctx = useAppData();
  return (
    <>
      <ChartSettings
        showColorSettings={true}
        setShowColorSettings={vi.fn()}
        showTodayLine={true}
        setShowTodayLine={ctx.setShowTodayLine}
        todayDateOverride={ctx.todayDateOverride}
        setTodayDateOverride={ctx.setTodayDateOverride}
        statusDateOutOfRange={false}
        showFinishDateLine={false}
        setShowFinishDateLine={vi.fn()}
        showMostLikelyLine={false}
        setShowMostLikelyLine={vi.fn()}
        showMonths={false}
        setShowMonths={vi.fn()}
        hasProjectFinishDate={false}
        hasMostLikelyReleases={false}
        displaySettings={DEFAULT_DISPLAY_SETTINGS}
        setDisplaySettings={vi.fn()}
        chartColors={DEFAULT_CHART_COLORS}
        onColorsChange={vi.fn()}
        preparedBy=""
        setPreparedBy={vi.fn()}
        showPreparedBy={false}
        setShowPreparedBy={vi.fn()}
      />
      <div data-testid="legend">
      <ChartLegend
        chartColors={DEFAULT_CHART_COLORS}
        displaySettings={DEFAULT_DISPLAY_SETTINGS}
        solidBarLabel="Design, Code, Test"
        hatchedBarLabel="Delivery Uncertainty"
        finishDateLabel="Project Finish Date"
        mostLikelyLineLabel="Most Likely Finish"
        inProgressLabel="In Progress"
        showTodayLine={true}
        // pages/index.tsx passes `todayDateOverride || undefined` down; GanttChart
        // derives this flag from the effective (snapshot-aware) value.
        isStatusDate={!!(ctx.todayDateOverride || undefined)}
        showFinishDateLine={false}
        showMostLikelyLine={false}
        hasProjectFinishDate={false}
        hasMostLikelyReleases={false}
        hasCompletedReleases={false}
        hasInProgressReleases={false}
        editingLegendLabel={null}
        tempLabelValue=""
        onStartEditLabel={vi.fn()}
        onSaveLabelEdit={vi.fn()}
        onCancelLabelEdit={vi.fn()}
        onTempLabelChange={vi.fn()}
        readOnly={false}
        hasActiveProject={false}
      />
      </div>
    </>
  );
}

function renderHarness() {
  return render(
    <AuthProvider>
      <StorageProvider>
        <ThemeProvider>
          <AppDataProvider>
            <Harness />
          </AppDataProvider>
        </ThemeProvider>
      </StorageProvider>
    </AuthProvider>
  );
}

const statusInput = () => screen.getByLabelText(/Status date/i) as HTMLInputElement;
// Scoped to the legend: "Today's Date" is also the Chart Settings colour-picker label.
const legend = () => within(screen.getByTestId('legend'));
const storedOverride = () => JSON.parse(localStorage.getItem('ganttAppData') || '{}').todayDateOverride;
const overrideKeyPresent = () => 'todayDateOverride' in JSON.parse(localStorage.getItem('ganttAppData') || '{}');

describe('status date — settings ↔ context ↔ storage ↔ legend (v0.28.0)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: null) => void) => {
      callback(null);
      return vi.fn();
    });
  });

  it('setting a status date persists it and flips the legend wording', async () => {
    renderHarness();
    await waitFor(() => expect(statusInput()).toBeInTheDocument());

    expect(legend().getByText("Today's Date")).toBeInTheDocument();

    fireEvent.change(statusInput(), { target: { value: '2026-08-19' } });
    fireEvent.blur(statusInput());

    await waitFor(() => expect(storedOverride()).toBe('2026-08-19'));
    expect(legend().getByText('Status Date')).toBeInTheDocument();
    expect(legend().queryByText("Today's Date")).not.toBeInTheDocument();
  });

  it('clearing the input removes the field from storage and restores the wording', async () => {
    localStorage.setItem('ganttAppData', JSON.stringify({
      projects: [], releases: [], todayDateOverride: '2026-08-19',
    }));

    renderHarness();
    await waitFor(() => expect(statusInput()).toHaveValue('2026-08-19'));
    expect(legend().getByText('Status Date')).toBeInTheDocument();

    fireEvent.change(statusInput(), { target: { value: '' } });
    fireEvent.blur(statusInput());

    // The save effect spreads ...data, which still carries the old value — the
    // key must be explicitly dropped or the stale date survives a clear.
    await waitFor(() => expect(overrideKeyPresent()).toBe(false));
    expect(legend().getByText("Today's Date")).toBeInTheDocument();
    expect(legend().queryByText('Status Date')).not.toBeInTheDocument();
  });

  it('an out-of-range date is rejected rather than stored', async () => {
    renderHarness();
    await waitFor(() => expect(statusInput()).toBeInTheDocument());

    fireEvent.change(statusInput(), { target: { value: '1999-01-01' } });
    expect(screen.getByText(/between 2000-01-01 and 2050-12-31/)).toBeInTheDocument();

    fireEvent.blur(statusInput());

    await waitFor(() => expect(overrideKeyPresent()).toBe(false));
    expect(legend().getByText("Today's Date")).toBeInTheDocument();
  });

  it('replacing one status date with another persists the new value', async () => {
    localStorage.setItem('ganttAppData', JSON.stringify({
      projects: [], releases: [], todayDateOverride: '2026-08-19',
    }));

    renderHarness();
    await waitFor(() => expect(statusInput()).toHaveValue('2026-08-19'));

    fireEvent.change(statusInput(), { target: { value: '2026-09-15' } });
    fireEvent.blur(statusInput());

    await waitFor(() => expect(storedOverride()).toBe('2026-09-15'));
    expect(legend().getByText('Status Date')).toBeInTheDocument();
  });
});
