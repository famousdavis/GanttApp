// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// StorageStatusChip — Option C split pill showing storage mode and auth state.
// v14.0: Unified single-button click target. Signed in → account popover with Sign Out.
// Signed out / local → opens Settings (existing sign-in flow).

import { useState, useEffect } from 'react';
import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { sanitizeFirebaseError } from '../utils/validation';
import { ConfirmDialog } from './ConfirmDialog';

interface StorageStatusChipProps {
  onSettingsClick: () => void;
}

function CloudIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"
        fill="#0070f3"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="11" width="18" height="11" rx="2" stroke="#9CA3AF" strokeWidth="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function StorageStatusChip({ onSettingsClick }: StorageStatusChipProps) {
  const { mode, switchMode } = useStorage();
  const { user, signOut } = useAuth();
  const { colors } = useTheme();

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCloudSignedIn = mode === 'cloud' && !!user;

  // Extract first name from displayName.
  // Microsoft Entra ID may return "Last, First" format — detect the comma and swap.
  const rawDisplayName = user?.displayName ?? '';
  let firstName: string;
  if (rawDisplayName.includes(',')) {
    firstName = rawDisplayName.split(',')[1]?.trim().split(' ')[0] ?? '';
  } else {
    firstName = rawDisplayName.split(' ')[0] ?? '';
  }
  if (!firstName) {
    firstName = user?.email?.split('@')[0] ?? '';
  }
  const initial = firstName.charAt(0).toUpperCase() || '?';

  const borderColor = colors.border ?? '#D1D5DB';

  // Escape key closes popover (no-op while signing out)
  useEffect(() => {
    if (!popoverOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (signingOut) return;
      setPopoverOpen(false);
      setError(null);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [popoverOpen, signingOut]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setError(null);
    try {
      // Mirror SettingsTab.handleSignOut exactly
      if (mode === 'cloud') {
        await switchMode('local');
      }
      await signOut();
      setPopoverOpen(false);
    } catch (err) {
      setError(sanitizeFirebaseError(err));
    } finally {
      setSigningOut(false);
    }
  };

  const handleCancel = () => {
    if (signingOut) return;
    setPopoverOpen(false);
    setError(null);
  };

  const pillButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '999px',
    border: `0.5px solid ${borderColor}`,
    background: 'transparent',
    overflow: 'hidden',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    padding: 0,
    margin: 0,
    font: 'inherit',
    color: 'inherit',
    cursor: 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
    outline: 'none',
  };

  const dividerStyle: React.CSSProperties = {
    alignSelf: 'stretch',
    width: '0.5px',
    backgroundColor: borderColor,
  };

  if (isCloudSignedIn) {
    return (
      <>
        <button
          type="button"
          onClick={() => setPopoverOpen(true)}
          style={pillButtonStyle}
          title={`Signed in as ${user?.email ?? 'cloud user'}`}
          aria-haspopup="dialog"
          aria-expanded={popoverOpen}
          aria-label="Account menu"
        >
          {/* Left segment: avatar + first name */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px 4px 4px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                backgroundColor: '#0070f3',
                color: 'white',
                fontSize: '11px',
                fontWeight: 500,
                flexShrink: 0,
                lineHeight: 1,
              }}
              aria-hidden="true"
            >
              {initial}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 500, color: colors.text }}>
              {firstName}
            </span>
          </span>
          {/* Vertical divider */}
          <span style={dividerStyle} aria-hidden="true" />
          {/* Right segment: cloud icon (visual only) */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px 10px',
            }}
            aria-hidden="true"
          >
            <CloudIcon />
          </span>
        </button>

        {popoverOpen && (
          <ConfirmDialog
            modal
            title="Account"
            colors={colors}
            message={
              <div>
                <p style={{ margin: 0, color: colors.text, fontWeight: 600 }}>
                  {user?.displayName ?? firstName}
                </p>
                {user?.email && (
                  <p style={{ margin: '0.25rem 0 0 0', color: colors.textSecondary, fontSize: '0.9rem' }}>
                    {user.email}
                  </p>
                )}
                {error && (
                  <p style={{ margin: '0.75rem 0 0 0', color: '#e53e3e', fontSize: '0.85rem' }}>
                    {error}
                  </p>
                )}
              </div>
            }
            buttons={[
              {
                label: signingOut ? 'Signing out…' : 'Sign Out',
                onClick: handleSignOut,
                variant: 'danger',
                disabled: signingOut,
              },
              {
                label: 'Cancel',
                onClick: handleCancel,
                variant: 'secondary',
                disabled: signingOut,
              },
            ]}
          />
        )}
      </>
    );
  }

  // Signed out / local mode
  return (
    <button
      type="button"
      onClick={onSettingsClick}
      style={pillButtonStyle}
      title="Using local storage"
      aria-label="Sign in"
    >
      {/* Left segment: lock icon + "Local only" */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px' }}>
        <LockIcon />
        <span style={{ fontSize: '13px', color: '#9CA3AF' }}>
          Local only
        </span>
      </span>
      {/* Vertical divider */}
      <span style={dividerStyle} aria-hidden="true" />
      {/* Right segment: "Sign in" (visual only) */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px 10px',
        }}
        aria-hidden="true"
      >
        <span style={{ fontSize: '12px', fontWeight: 500, color: '#0070f3' }}>
          Sign in
        </span>
      </span>
    </button>
  );
}
