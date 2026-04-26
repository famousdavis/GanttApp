// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// StorageStatusChip — Option C split pill showing storage mode and auth state.
// v17.0: Single click target opens the new CloudStorageModal in all three
// visual variants. The previous in-chip ConfirmDialog popovers and sign-out
// logic moved into the modal.

import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getFirstName, getInitial } from '../utils/displayName';

interface StorageStatusChipProps {
  /** Open the unified Cloud Storage modal. v17.0: replaces the prior
   *  `onSettingsClick` prop — all three variants now route here. */
  onOpenModal: () => void;
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

export function StorageStatusChip({ onOpenModal }: StorageStatusChipProps) {
  const { mode } = useStorage();
  const { user } = useAuth();
  const { colors } = useTheme();

  const isCloudSignedIn = mode === 'cloud' && !!user;
  const isSignedInLocal = mode === 'local' && !!user;

  const firstName = getFirstName(user?.displayName, user?.email);
  const initial = getInitial(firstName);

  const borderColor = colors.border ?? '#D1D5DB';

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

  const avatarStyle: React.CSSProperties = {
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
  };

  if (isCloudSignedIn) {
    return (
      <button
        type="button"
        onClick={onOpenModal}
        style={pillButtonStyle}
        title={`Signed in as ${user?.email ?? 'cloud user'}`}
        aria-haspopup="dialog"
        aria-label="Account menu"
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px 4px 4px' }}>
          <span style={avatarStyle} aria-hidden="true">{initial}</span>
          <span style={{ fontSize: '13px', fontWeight: 500, color: colors.text }}>
            {firstName}
          </span>
        </span>
        <span style={dividerStyle} aria-hidden="true" />
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
    );
  }

  if (isSignedInLocal) {
    return (
      <button
        type="button"
        onClick={onOpenModal}
        style={pillButtonStyle}
        title={`Signed in as ${user?.email ?? 'local user'}`}
        aria-haspopup="dialog"
        aria-label="Account menu"
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px 4px 4px' }}>
          <span style={avatarStyle} aria-hidden="true">{initial}</span>
          <span style={{ fontSize: '13px', fontWeight: 500, color: colors.text }}>
            {firstName}
          </span>
        </span>
        <span style={dividerStyle} aria-hidden="true" />
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px 10px',
          }}
          aria-hidden="true"
        >
          <LockIcon />
        </span>
      </button>
    );
  }

  // Signed out / local mode
  return (
    <button
      type="button"
      onClick={onOpenModal}
      style={pillButtonStyle}
      title="Using local storage"
      aria-haspopup="dialog"
      aria-label="Sign in"
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px' }}>
        <LockIcon />
        <span style={{ fontSize: '13px', color: '#9CA3AF' }}>Local only</span>
      </span>
      <span style={dividerStyle} aria-hidden="true" />
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px 10px',
        }}
        aria-hidden="true"
      >
        <span style={{ fontSize: '12px', fontWeight: 500, color: '#0070f3' }}>Sign in</span>
      </span>
    </button>
  );
}
