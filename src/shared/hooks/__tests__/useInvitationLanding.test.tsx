// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Targeted regression test for the v0.22.1 cloud auto-flip rejection branch
 * in useInvitationLanding (Effect 2).
 *
 * Pre-v0.22.1, the rejection was silently swallowed via `.catch(() => {})`,
 * leaving the banner in `pre_auth` indefinitely with no console signal. The
 * hook now logs a warn, consumes `SESSION_KEY` (symmetric with `dismiss()`
 * and Effect 4's grace-timer path), and transitions the banner to `idle`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../../lib/feature-flags', () => ({
  INVITATIONS_ENABLED: true,
}));

// isFirebaseAvailable is read by Effect 2 — must be true for the flip path.
vi.mock('../../../lib/firebase', () => ({
  isFirebaseAvailable: true,
}));

const mockSwitchMode = vi.fn();
vi.mock('../../../context/StorageContext', () => ({
  useStorage: () => ({ switchMode: mockSwitchMode }),
}));

import { useInvitationLanding } from '../useInvitationLanding';

const SESSION_KEY = 'ganttapp_pending_invite_token';

describe('useInvitationLanding — cloud auto-flip rejection (v0.22.1)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sessionStorage.clear();
    mockSwitchMode.mockReset();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('drops banner to idle and consumes SESSION_KEY when switchMode rejects', async () => {
    // Seed the SESSION_KEY so the lazy initializer derives bannerState='pre_auth'
    // without needing a ?invite= URL param.
    sessionStorage.setItem(SESSION_KEY, 'token-abc');
    mockSwitchMode.mockRejectedValueOnce(new Error('transient firestore failure'));

    const { result } = renderHook(() =>
      useInvitationLanding({ localProjectCount: 0, appDataLoading: false })
    );

    // Initial state — pre_auth from the lazy initializer reading SESSION_KEY.
    expect(result.current.bannerState).toBe('pre_auth');

    // Effect 2 fires the flip; await its rejection branch.
    await waitFor(() => {
      expect(mockSwitchMode).toHaveBeenCalledWith('cloud');
    });
    await waitFor(() => {
      expect(result.current.bannerState).toBe('idle');
    });

    // Symmetry with dismiss(): SESSION_KEY consumed before transitioning so a
    // reload mid-state cannot rehydrate pre_auth (LESSONS-LEARNED §59).
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();

    // Logged, not silently swallowed.
    expect(warnSpy).toHaveBeenCalledWith(
      '[useInvitationLanding] cloud auto-flip failed:',
      expect.any(Error)
    );
  });
});
