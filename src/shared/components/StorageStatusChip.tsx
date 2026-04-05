// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// StorageStatusChip — Option C split pill showing storage mode and auth state.
// Cloud signed-in: avatar initial + first name | cloud icon → Settings.
// Local / signed-out: lock icon + "Local only" | "Sign in" → Settings.

import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

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
  const { mode } = useStorage();
  const { user } = useAuth();
  const { colors } = useTheme();

  const isCloudSignedIn = mode === 'cloud' && !!user;

  // Extract first name from displayName.
  // Microsoft Entra ID may return "Last, First" format — detect the comma and swap.
  const rawDisplayName = user?.displayName ?? '';
  let firstName: string;
  if (rawDisplayName.includes(',')) {
    // "Last, First" → take the part after the comma
    firstName = rawDisplayName.split(',')[1]?.trim().split(' ')[0] ?? '';
  } else {
    // "First Last" → take the first word
    firstName = rawDisplayName.split(' ')[0] ?? '';
  }
  if (!firstName) {
    firstName = user?.email?.split('@')[0] ?? '';
  }
  const initial = firstName.charAt(0).toUpperCase() || '?';

  const borderColor = colors.border ?? '#D1D5DB';

  const pillStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '999px',
    border: `0.5px solid ${borderColor}`,
    background: 'transparent',
    overflow: 'hidden',
    lineHeight: 1,
    whiteSpace: 'nowrap',
  };

  const dividerStyle: React.CSSProperties = {
    alignSelf: 'stretch',
    width: '0.5px',
    backgroundColor: borderColor,
  };

  const rightButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 10px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    borderTopRightRadius: '999px',
    borderBottomRightRadius: '999px',
    appearance: 'none',
    WebkitAppearance: 'none',
    outline: 'none',
  };

  if (isCloudSignedIn) {
    return (
      <div style={pillStyle} title={`Signed in as ${user?.email ?? 'cloud user'}`}>
        {/* Left segment: avatar + first name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px 4px 4px' }}>
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
        </div>
        {/* Vertical divider */}
        <div style={dividerStyle} />
        {/* Right segment: cloud icon → Settings */}
        <button
          onClick={onSettingsClick}
          style={rightButtonStyle}
          aria-label="Open settings"
        >
          <CloudIcon />
        </button>
      </div>
    );
  }

  return (
    <div style={pillStyle} title="Using local storage">
      {/* Left segment: lock icon + "Local only" */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px' }}>
        <LockIcon />
        <span style={{ fontSize: '13px', color: '#9CA3AF' }}>
          Local only
        </span>
      </div>
      {/* Vertical divider */}
      <div style={dividerStyle} />
      {/* Right segment: "Sign in" → Settings */}
      <button
        onClick={onSettingsClick}
        style={rightButtonStyle}
        aria-label="Sign in"
      >
        <span style={{ fontSize: '12px', fontWeight: 500, color: '#0070f3' }}>
          Sign in
        </span>
      </button>
    </div>
  );
}
