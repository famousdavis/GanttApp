// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// StorageStatusChip — Adaptive header chip showing storage mode and auth state.
// Local mode: gray pill with database icon + "Local".
// Cloud mode: avatar initial circle + display name + cloud icon (blue-accented).
// Clicking navigates to the Settings tab.

import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

interface StorageStatusChipProps {
  onSettingsClick: () => void;
}

export function StorageStatusChip({ onSettingsClick }: StorageStatusChipProps) {
  const { mode } = useStorage();
  const { user } = useAuth();
  const { colors, resolvedTheme } = useTheme();

  const initial = (
    user?.displayName?.[0]?.toUpperCase() ??
    user?.email?.[0]?.toUpperCase() ??
    '?'
  );

  const rawName = user?.displayName?.split(' ')[0] ?? user?.email?.split('@')[0] ?? '';
  const displayName = rawName.length > 12 ? rawName.slice(0, 12) + '\u2026' : rawName;

  const chipStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '4px 10px 4px 8px',
    borderRadius: '20px',
    border: `1px solid ${mode === 'cloud' ? colors.accent + '66' : colors.border}`,
    background: mode === 'cloud'
      ? (resolvedTheme === 'dark' ? '#1e3a5f' : '#e6f2ff')
      : colors.surface,
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 500,
    color: mode === 'cloud' ? colors.accent : colors.textSecondary,
    transition: 'opacity 0.15s ease',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    // Reset button defaults
    appearance: 'none',
    WebkitAppearance: 'none',
    outline: 'none',
    lineHeight: 1,
  };

  if (mode === 'local') {
    return (
      <button
        onClick={onSettingsClick}
        style={chipStyle}
        title="Using local storage — click to manage in Settings"
      >
        {/* Database / local storage icon */}
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
        Local
      </button>
    );
  }

  // Cloud mode — show avatar initial + display name + cloud icon
  return (
    <button
      onClick={onSettingsClick}
      style={chipStyle}
      title={`Signed in as ${user?.email ?? 'cloud user'} — click to manage in Settings`}
    >
      {/* Avatar circle with first initial */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: colors.accent,
          color: 'white',
          fontSize: '0.68rem',
          fontWeight: 700,
          flexShrink: 0,
          lineHeight: 1,
        }}
        aria-hidden="true"
      >
        {initial}
      </span>
      {displayName && <span>{displayName}</span>}
      {/* Cloud icon */}
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
      </svg>
    </button>
  );
}
