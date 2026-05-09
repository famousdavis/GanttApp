// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * useInvitationLanding — drives the InvitationBanner state machine:
 *
 *   idle      → no invitation activity (banner hidden)
 *   pre_auth  → ?invite= detected (or sessionStorage token survives reload);
 *               banner offers SSO sign-in
 *   claimed   → spert:models-changed fired with at least one claimed model
 *               AND the SESSION_KEY proves the user arrived via an invite
 *               link in this session; banner shows "you've been added to …"
 *
 * Pages Router app — URL access uses window.location / history.replaceState
 * (identical to the Vite SPA / AHP pattern). Do NOT use useSearchParams
 * from next/navigation: that's App Router only and would force a <Suspense>
 * boundary at every consumer (LESSONS-LEARNED §14 does not apply here).
 *
 * Required by the consumer (InvitationBanner): pass live values from
 * useAppData() so Effect 2's cloud-flip decision is gated on a trustworthy
 * local-project count (LESSONS-LEARNED §28).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useStorage } from '../../context/StorageContext';
import { INVITATIONS_ENABLED } from '../../lib/feature-flags';
import { isFirebaseAvailable } from '../../lib/firebase';

export type InvitationBannerState = 'idle' | 'pre_auth' | 'claimed';

const SESSION_KEY = 'ganttapp_pending_invite_token';
const GRACE_TIMEOUT_MS = 30_000;

export interface UseInvitationLandingOptions {
  /** From useAppData().data.projects.length — required for the F1 gate. */
  localProjectCount: number;
  /** From useAppData().loading — Effect 2 waits for false before deciding. */
  appDataLoading: boolean;
}

export interface UseInvitationLandingReturn {
  bannerState: InvitationBannerState;
  claimedProjectNames: string[];
  dismiss: () => void;
}

export function useInvitationLanding(opts: UseInvitationLandingOptions): UseInvitationLandingReturn {
  const { localProjectCount, appDataLoading } = opts;
  const { switchMode } = useStorage();
  // Lazy initializer derives the initial banner state from URL + sessionStorage
  // synchronously on first render. Writing to sessionStorage and stripping the
  // URL are side effects and stay in Effect 1 below; only the read happens
  // here. Pages Router has no SSR justification for setState-in-effect, so the
  // React 19 lint rule is honored without an eslint-disable. LESSONS-LEARNED §66.
  const [bannerState, setBannerState] = useState<InvitationBannerState>(() => {
    if (!INVITATIONS_ENABLED) return 'idle';
    if (typeof window === 'undefined') return 'idle';
    const hasInviteParam = new URL(window.location.href).searchParams.has('invite');
    if (hasInviteParam) return 'pre_auth';
    if (sessionStorage.getItem(SESSION_KEY)) return 'pre_auth';
    return 'idle';
  });
  const [claimedProjectNames, setClaimedProjectNames] = useState<string[]>([]);
  const initialized = useRef(false);
  const cloudFlipAttempted = useRef(false);

  // Effect 1 — side effects only: persist the invite token to sessionStorage
  // and strip ?invite= from the URL. State was already derived above.
  useEffect(() => {
    if (!INVITATIONS_ENABLED) return;
    if (initialized.current) return;
    initialized.current = true;
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const inviteToken = url.searchParams.get('invite');
    if (!inviteToken) return;
    sessionStorage.setItem(SESSION_KEY, inviteToken);
    url.searchParams.delete('invite');
    window.history.replaceState(null, '', url.toString());
  }, []);

  // Effect 2 — cloud auto-flip with local-project gate. Unconditional flip
  // would wipe local projects (LESSONS-LEARNED §28). Wait for AppData to
  // settle before reading the count, then only flip when the user has zero
  // local projects. Otherwise, preserve their mode and let the standard
  // upload-prompt flow handle migration on sign-in.
  useEffect(() => {
    if (!INVITATIONS_ENABLED) return;
    if (bannerState !== 'pre_auth') return;
    if (cloudFlipAttempted.current) return;
    if (appDataLoading) return;
    if (!isFirebaseAvailable) return;
    if (localProjectCount > 0) return;
    cloudFlipAttempted.current = true;
    void switchMode('cloud').catch(() => {});
  }, [bannerState, appDataLoading, localProjectCount, switchMode]);

  // Effect 3 — claim listener with SESSION_KEY entry-gate. Without the gate,
  // any normal sign-in that returns claimed projects (returning user with
  // pending invitations not from this session) would surface a "you've been
  // added to…" banner that the user has no context for. LESSONS-LEARNED §27.
  useEffect(() => {
    if (!INVITATIONS_ENABLED) return;
    const handleClaimed = (e: Event) => {
      if (!sessionStorage.getItem(SESSION_KEY)) return;
      const detail = (e as CustomEvent<{ claimed: { modelName: string }[] }>).detail;
      const names = (detail?.claimed ?? []).map((c) => c.modelName).filter(Boolean);
      if (names.length === 0) return;
      sessionStorage.removeItem(SESSION_KEY);
      setClaimedProjectNames(names);
      setBannerState('claimed');
    };
    window.addEventListener('spert:models-changed', handleClaimed);
    return () => window.removeEventListener('spert:models-changed', handleClaimed);
  }, []);

  // Effect 4 — 30 s grace timer. If the user lands on an invite URL and
  // never signs in (or signs in with the wrong email), pre_auth would
  // otherwise persist indefinitely. SESSION_KEY is consumed BEFORE
  // setState so a reload while the timer is pending cannot rehydrate
  // pre_auth on the next mount. LESSONS-LEARNED §59.
  useEffect(() => {
    if (!INVITATIONS_ENABLED) return;
    if (bannerState !== 'pre_auth') return;
    const t = setTimeout(() => {
      sessionStorage.removeItem(SESSION_KEY);
      setBannerState('idle');
    }, GRACE_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [bannerState]);

  const dismiss = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setBannerState('idle');
  }, []);

  return { bannerState, claimedProjectNames, dismiss };
}
