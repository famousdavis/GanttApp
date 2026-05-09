// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * InvitationBanner — three-state banner driven by useInvitationLanding.
 * Mounted in pages/index.tsx above FirstRunBanner. No <Suspense> wrapper
 * (Pages Router, not App Router — LESSONS-LEARNED §14).
 *
 * Sign-in routes through useSignInWithTosGate (existing v17.0 hook). Bypassing
 * the gate would cause new users to be silently signed out by AuthContext's
 * handleTosResolution Branch B.
 */

import { useAuth } from '../../context/AuthContext';
import { useAppData } from '../../context/AppDataContext';
import { useTheme } from '../../context/ThemeContext';
import { GoogleLogo, MicrosoftLogo } from './AuthProviderLogos';
import { TosConsentModal } from '../../features/settings/TosConsentModal';
import { useInvitationLanding } from '../hooks/useInvitationLanding';
import { useSignInWithTosGate } from '../hooks/useSignInWithTosGate';
import { INVITATIONS_ENABLED } from '../../lib/feature-flags';

export function InvitationBanner() {
  // localProjectCount + appDataLoading thread into the hook so its Effect 2
  // cloud-flip decision is gated on real data — preventing the local-projects
  // wipe documented in LESSONS-LEARNED §28.
  const { data, loading: appDataLoading } = useAppData();
  const { bannerState, claimedProjectNames, dismiss } = useInvitationLanding({
    localProjectCount: data.projects.length,
    appDataLoading,
  });
  const { firebaseAvailable } = useAuth();
  const { colors, resolvedTheme } = useTheme();
  // Live hook API: signIn(provider), authError, tosModalOpen, onTosAccept, onTosCancel.
  // onTosAccept is () => Promise<void>; TosConsentModal.onAccept is () => void.
  // TS return-type widening makes this safe — the modal does not await.
  const { signIn, authError, tosModalOpen, onTosAccept, onTosCancel } = useSignInWithTosGate();

  if (!INVITATIONS_ENABLED || bannerState === 'idle') return null;

  // Container styles mirror FirstRunBanner lines 37–47 — same blue tint,
  // same border radius, same flex layout. Keeping them visually consistent
  // because both banners can co-render briefly during sign-in.
  const bgColor = resolvedTheme === 'dark' ? '#1a2e44' : '#e6f2ff';
  const borderColor = resolvedTheme === 'dark' ? '#2a4a6b' : '#b3d4fc';
  const bannerStyle = {
    background: bgColor,
    border: `1px solid ${borderColor}`,
    borderRadius: '8px',
    padding: '1rem 1.25rem',
    marginBottom: '1rem',
    display: 'flex' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    gap: '1rem',
  };

  const dismissButtonStyle = {
    background: 'transparent',
    color: colors.text,
    border: 'none',
    fontSize: '1.25rem',
    lineHeight: '1',
    cursor: 'pointer',
    padding: '0 0.25rem',
  };

  const ssoButtonStyle = {
    background: '#fff',
    color: '#202124',
    border: '1px solid #dadce0',
    borderRadius: '4px',
    padding: '0.5rem 0.75rem',
    fontWeight: 500 as const,
    cursor: 'pointer',
    fontSize: '0.85rem',
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: '0.5rem',
  };

  if (bannerState === 'pre_auth') {
    return (
      <>
        {/* Render TosConsentModal when the hook signals it's needed.
            Hook uses a render-prop pattern — consumer owns the mount. */}
        {tosModalOpen && (
          <TosConsentModal
            colors={colors}
            onAccept={onTosAccept}
            onCancel={onTosCancel}
          />
        )}
        <div role="status" style={bannerStyle}>
          <div style={{ flex: 1 }}>
            <p style={{ color: colors.text, fontSize: '0.95rem', margin: '0 0 0.5rem 0', fontWeight: 600 }}>
              You&apos;ve been invited to a GanttApp&trade; project
            </p>
            <p style={{ color: colors.text, fontSize: '0.875rem', margin: '0 0 0.75rem 0', lineHeight: '1.5' }}>
              Sign in with the email address that received this invitation.
            </p>
            {firebaseAvailable ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  aria-label="Sign in with Google"
                  onClick={() => signIn('google')}
                  style={ssoButtonStyle}
                >
                  <GoogleLogo /> Sign in with Google
                </button>
                <button
                  type="button"
                  aria-label="Sign in with Microsoft"
                  onClick={() => signIn('microsoft')}
                  style={ssoButtonStyle}
                >
                  <MicrosoftLogo /> Sign in with Microsoft
                </button>
              </div>
            ) : (
              <p style={{ color: colors.textSecondary, fontSize: '0.85rem', margin: 0 }}>
                Cloud sign-in is unavailable in this build.
              </p>
            )}
            {authError && (
              // #e53e3e mirrors StorageSection's hardcoded error red — ThemeColors
              // has no error property, so this is the canonical literal.
              <p style={{ color: '#e53e3e', fontSize: '0.85rem', margin: '0.5rem 0 0 0' }}>{authError}</p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss invitation banner"
            style={dismissButtonStyle}
          >
            ×
          </button>
        </div>
      </>
    );
  }

  // bannerState === 'claimed'
  const projectList = claimedProjectNames.join(', ');
  const isPlural = claimedProjectNames.length > 1;
  return (
    <div role="status" style={bannerStyle}>
      <div style={{ flex: 1 }}>
        <p style={{ color: colors.text, fontSize: '0.95rem', margin: '0 0 0.5rem 0', fontWeight: 600 }}>
          You&apos;ve been added to: {projectList}
        </p>
        <p style={{ color: colors.text, fontSize: '0.875rem', margin: 0, lineHeight: '1.5' }}>
          The project{isPlural ? 's' : ''} should now appear in your project list.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss invitation banner"
        style={dismissButtonStyle}
      >
        ×
      </button>
    </div>
  );
}
