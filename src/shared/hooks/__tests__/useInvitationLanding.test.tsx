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
 *
 * The describe blocks after it cover the rest of the state machine: the
 * starting state, the invitation link, the automatic switch to cloud storage
 * and what holds it back, claim events, the 30-second grace period, and
 * dismissal.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('../../../lib/feature-flags', () => ({
  INVITATIONS_ENABLED: true,
}));

// isFirebaseAvailable is read by Effect 2 — it must be true for the flip path.
// It is read through a getter so one test can turn Firebase off; the
// file-level beforeEach below turns it back on.
const firebaseState = vi.hoisted(() => ({ available: true }));
vi.mock('../../../lib/firebase', () => ({
  get isFirebaseAvailable() {
    return firebaseState.available;
  },
}));

const mockSwitchMode = vi.fn();
vi.mock('../../../context/StorageContext', () => ({
  useStorage: () => ({ switchMode: mockSwitchMode }),
}));

import { useInvitationLanding } from '../useInvitationLanding';

const SESSION_KEY = 'ganttapp_pending_invite_token';
const CLAIM_EVENT = 'spert:models-changed';

interface LandingProps {
  localProjectCount: number;
  appDataLoading: boolean;
}

// One local project keeps the automatic switch to cloud out of the tests that
// are not about it; the switch-to-cloud tests pass their own values.
const NO_SWITCH: LandingProps = { localProjectCount: 1, appDataLoading: false };
const READY_TO_SWITCH: LandingProps = { localProjectCount: 0, appDataLoading: false };

function renderLanding(initialProps: LandingProps = NO_SWITCH) {
  return renderHook((props: LandingProps) => useInvitationLanding(props), { initialProps });
}

// The payload AuthContext dispatches after claiming pending invitations.
function claimDetail(...names: string[]) {
  return {
    claimed: names.map((modelName, i) => ({ appId: 'ganttapp', modelId: `p${i + 1}`, modelName })),
  };
}

function dispatchClaim(detail: unknown) {
  act(() => {
    window.dispatchEvent(new CustomEvent(CLAIM_EVENT, { detail }));
  });
}

// File-level reset; it runs before each describe's own beforeEach.
beforeEach(() => {
  window.history.replaceState(null, '', '/');
  sessionStorage.clear();
  firebaseState.available = true;
  mockSwitchMode.mockReset();
  mockSwitchMode.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState(null, '', '/');
  sessionStorage.clear();
});

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

describe('useInvitationLanding — starting state', () => {
  it('starts in pre_auth when the address carries an invitation token', () => {
    window.history.replaceState(null, '', '/?invite=tok-123');
    const { result } = renderLanding();
    expect(result.current.bannerState).toBe('pre_auth');
  });

  it('starts idle when neither the address nor this session holds an invitation token', () => {
    const { result } = renderLanding();
    expect(result.current.bannerState).toBe('idle');
    expect(result.current.claimedProjectNames).toEqual([]);
  });
});

describe('useInvitationLanding — invitation link', () => {
  it('stores the token for this session and removes it from the address, keeping the other parameters', () => {
    window.history.replaceState(null, '', '/?tab=chart&invite=tok-123&view=list');
    renderLanding();
    expect(sessionStorage.getItem(SESSION_KEY)).toBe('tok-123');
    expect(window.location.pathname).toBe('/');
    expect(window.location.search).toBe('?tab=chart&view=list');
  });
});

describe('useInvitationLanding — automatic switch to cloud storage', () => {
  // Suspected defect: the hook asks for the switch as soon as app data has
  // loaded, whether or not anyone is signed in. An invitee arriving from the
  // link usually is not. StorageContext's switchMode then refuses ("You must
  // sign in before switching to cloud storage."), records that as switchError
  // and resolves instead of rejecting, and the once-only guard stops a retry
  // after the invitee signs in, so they stay in local storage. These tests
  // check when the hook asks for the switch; a fix that waits for sign-in
  // should change them.
  beforeEach(() => {
    // This session arrived through an invitation link.
    sessionStorage.setItem(SESSION_KEY, 'tok-123');
  });

  it('waits until app data has finished loading before switching to cloud', () => {
    const { result, rerender } = renderLanding({ localProjectCount: 0, appDataLoading: true });
    expect(result.current.bannerState).toBe('pre_auth');
    expect(mockSwitchMode).not.toHaveBeenCalled();

    rerender(READY_TO_SWITCH);
    expect(mockSwitchMode).toHaveBeenCalledTimes(1);
    expect(mockSwitchMode).toHaveBeenCalledWith('cloud');
  });

  it('does not switch to cloud when this browser already holds a local project', () => {
    // Control: the same arrival with no local projects does switch.
    const control = renderLanding(READY_TO_SWITCH);
    expect(mockSwitchMode).toHaveBeenCalledWith('cloud');
    control.unmount();
    mockSwitchMode.mockClear();

    const { result } = renderLanding({ localProjectCount: 1, appDataLoading: false });
    expect(result.current.bannerState).toBe('pre_auth');
    expect(mockSwitchMode).not.toHaveBeenCalled();
  });

  it('does not switch to cloud when Firebase is unavailable in this build', () => {
    // Control: the same arrival with Firebase available does switch.
    const control = renderLanding(READY_TO_SWITCH);
    expect(mockSwitchMode).toHaveBeenCalledWith('cloud');
    control.unmount();
    mockSwitchMode.mockClear();

    firebaseState.available = false;
    const { result } = renderLanding(READY_TO_SWITCH);
    expect(result.current.bannerState).toBe('pre_auth');
    expect(mockSwitchMode).not.toHaveBeenCalled();
  });

  it('switches to cloud only once, even when app data reloads afterwards', () => {
    const { rerender } = renderLanding(READY_TO_SWITCH);
    expect(mockSwitchMode).toHaveBeenCalledTimes(1);

    // Switching storage reloads app data: loading goes true, then false again.
    rerender({ localProjectCount: 0, appDataLoading: true });
    rerender(READY_TO_SWITCH);
    expect(mockSwitchMode).toHaveBeenCalledTimes(1);
  });
});

describe('useInvitationLanding — invitation claims', () => {
  it('ignores a claim event when this session did not arrive through an invitation link', () => {
    const { result } = renderLanding();
    expect(result.current.bannerState).toBe('idle');

    dispatchClaim(claimDetail('Alpha'));
    expect(result.current.bannerState).toBe('idle');
    expect(result.current.claimedProjectNames).toEqual([]);

    // The listener is live: the same event is honoured once this session holds a token.
    sessionStorage.setItem(SESSION_KEY, 'tok-123');
    dispatchClaim(claimDetail('Alpha'));
    expect(result.current.bannerState).toBe('claimed');
  });

  it('shows the claimed project names and consumes the stored token', () => {
    sessionStorage.setItem(SESSION_KEY, 'tok-123');
    const { result } = renderLanding();
    expect(result.current.bannerState).toBe('pre_auth');

    dispatchClaim(claimDetail('Alpha', 'Beta'));
    expect(result.current.bannerState).toBe('claimed');
    expect(result.current.claimedProjectNames).toEqual(['Alpha', 'Beta']);
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it.each([
    ['no detail', undefined],
    ['an empty list', { claimed: [] }],
    ['only unnamed projects', claimDetail('')],
  ])('ignores a claim event that carries %s', (_label, detail) => {
    sessionStorage.setItem(SESSION_KEY, 'tok-123');
    const { result } = renderLanding();

    dispatchClaim(detail);
    expect(result.current.bannerState).toBe('pre_auth');
    expect(result.current.claimedProjectNames).toEqual([]);
    expect(sessionStorage.getItem(SESSION_KEY)).toBe('tok-123');

    // The listener is live: a claim naming a project is honoured.
    dispatchClaim(claimDetail('Alpha'));
    expect(result.current.bannerState).toBe('claimed');
  });
});

describe('useInvitationLanding — grace period and dismissal', () => {
  it('drops to idle and consumes the token when nobody signs in within 30 seconds', () => {
    vi.useFakeTimers();
    sessionStorage.setItem(SESSION_KEY, 'tok-123');
    const { result } = renderLanding();

    act(() => {
      vi.advanceTimersByTime(29_999);
    });
    expect(result.current.bannerState).toBe('pre_auth');
    expect(sessionStorage.getItem(SESSION_KEY)).toBe('tok-123');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.bannerState).toBe('idle');
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('a claimed banner outlasts the 30-second grace period', () => {
    vi.useFakeTimers();
    sessionStorage.setItem(SESSION_KEY, 'tok-123');
    const { result } = renderLanding();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    dispatchClaim(claimDetail('Alpha'));
    expect(result.current.bannerState).toBe('claimed');

    // Past 30 seconds both from arrival and from the claim. (The claim itself
    // consumed the stored token, so the timer has none left to consume.)
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.bannerState).toBe('claimed');
    expect(result.current.claimedProjectNames).toEqual(['Alpha']);
  });

  it('dismissing the invitation prompt returns to idle, and a reload does not bring it back', () => {
    sessionStorage.setItem(SESSION_KEY, 'tok-123');
    const { result, unmount } = renderLanding();
    expect(result.current.bannerState).toBe('pre_auth');

    act(() => result.current.dismiss());
    expect(result.current.bannerState).toBe('idle');
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();

    unmount();
    expect(renderLanding().result.current.bannerState).toBe('idle');
  });

  it('dismissing the claimed banner returns to idle', () => {
    sessionStorage.setItem(SESSION_KEY, 'tok-123');
    const { result } = renderLanding();
    dispatchClaim(claimDetail('Alpha'));
    expect(result.current.bannerState).toBe('claimed');

    act(() => result.current.dismiss());
    expect(result.current.bannerState).toBe('idle');
  });
});
