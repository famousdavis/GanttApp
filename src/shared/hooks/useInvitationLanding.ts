// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * useInvitationLanding — drives the InvitationBanner state machine:
 *
 *   idle      → no invitation activity (banner hidden)
 *   pre_auth  → ?invite= detected (or sessionStorage token survives reload);
 *               banner offers SSO sign-in
 *   claimed   → spert:models-changed fired with at least one claimed model;
 *               banner shows "you've been added to <projects>"
 *
 * GanttApp is Next.js Pages Router, so URL access uses window.location /
 * history.replaceState (identical to the Vite SPA / AHP pattern). Do NOT
 * use useSearchParams from next/navigation — that's App Router only and
 * would force a <Suspense> boundary at every consumer (LESSONS-LEARNED §14
 * does not apply here).
 */

import { useState, useEffect, useRef } from 'react';
import { useStorage } from '../../context/StorageContext';
import { INVITATIONS_ENABLED } from '../../lib/feature-flags';
import { isFirebaseAvailable } from '../../lib/firebase';

export type InvitationBannerState = 'idle' | 'pre_auth' | 'claimed';

const SESSION_KEY = 'ganttapp_pending_invite_token';

export interface UseInvitationLandingReturn {
  bannerState: InvitationBannerState;
  claimedProjectNames: string[];
  dismiss: () => void;
}

export function useInvitationLanding(): UseInvitationLandingReturn {
  const { switchMode } = useStorage();
  const [bannerState, setBannerState] = useState<InvitationBannerState>('idle');
  const [claimedProjectNames, setClaimedProjectNames] = useState<string[]>([]);
  const initialized = useRef(false);

  // On mount: detect ?invite= or existing sessionStorage token
  useEffect(() => {
    if (!INVITATIONS_ENABLED) return;
    if (initialized.current) return;
    initialized.current = true;

    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const inviteToken = url.searchParams.get('invite');

    if (inviteToken) {
      // Persist the token so the banner stays in pre_auth across reloads
      // (e.g. mobile background→foreground). The token itself is NOT passed
      // to claimPendingInvitations — the callable matches on the verified
      // email, not the token. The token's only role here is triggering
      // the UX flow. A boolean flag would also work; we persist the token
      // for future diagnostic logging if needed.
      sessionStorage.setItem(SESSION_KEY, inviteToken);
      url.searchParams.delete('invite');
      window.history.replaceState(null, '', url.toString());
      if (isFirebaseAvailable) {
        // Auto-flip storage mode so the claimed project actually surfaces
        // (LESSONS-LEARNED §7). Failure here is non-fatal — the user is
        // still prompted to sign in by the banner.
        void switchMode('cloud').catch(() => {});
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot URL parse on mount, same pattern as FirstRunBanner
      setBannerState('pre_auth');
    } else if (sessionStorage.getItem(SESSION_KEY)) {
      setBannerState('pre_auth');
    }
  }, [switchMode]);

  // Listen for claim success dispatched by AuthContext after successful claim.
  // This listener fires on ANY spert:models-changed event, not only when the
  // user arrived via an invite link. Intentional — matches AHP/CFD where the
  // banner doubles as a "new shared projects" notification on any sign-in
  // that results in a claim.
  useEffect(() => {
    if (!INVITATIONS_ENABLED) return;
    const handleClaimed = (e: Event) => {
      const detail = (e as CustomEvent<{ claimed: { modelName: string }[] }>).detail;
      const names = (detail?.claimed ?? []).map((c) => c.modelName).filter(Boolean);
      if (names.length > 0) {
        sessionStorage.removeItem(SESSION_KEY);
        setClaimedProjectNames(names);
        setBannerState('claimed');
      }
    };
    window.addEventListener('spert:models-changed', handleClaimed);
    return () => window.removeEventListener('spert:models-changed', handleClaimed);
  }, []);

  const dismiss = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setBannerState('idle');
  };

  return { bannerState, claimedProjectNames, dismiss };
}
