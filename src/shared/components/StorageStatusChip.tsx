// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// StorageStatusChip — the frame's account chip, showing storage mode and auth state.
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"
        fill="currentColor"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/*
 * The frame's account chip (FRAME26, contract §3, v0.34.0): `.sf-chip`, 30 px tall, its right edge at the column's
 * right edge, with two segments. `.sf-chip-state` is the storage state, in the frame's muted text colour;
 * `.sf-chip-act` is the action, in the frame's link colour, and its left border is the divider. Its hover ground
 * (`--sf-hover`), its focus ring, its border and its segments' colours come from styles/spert-frame.css, so the
 * button sets no colour, border or background inline: an inline value would beat the frame's. Both icons draw in
 * `currentColor`, so they take their segment's colour: the lock muted (4.84:1 on #ffffff, 6.82:1 on #101828, 4.63 /
 * 5.64 on the hover ground), the cloud the link colour (5.25 / 6.73). FRAME26 stage 0's CHIP_MUTED and CHIP_LINK, and
 * globals.css's .storage-status-chip ring, gave way to these tokens. Guarded by
 * src/shared/components/__tests__/StorageStatusChip.frame26.test.tsx.
 *
 * The avatar keeps its own colours: a white initial on #0070f3 (4.55:1), now 22 px so it sits inside the 30 px chip.
 * The signed-in first name keeps the theme's text colour (#333 / #e2e8f0: 12.09 / 11.90 on the hover ground). When
 * signed in with local storage, the act segment shows the lock in the frame's muted token instead of the link colour.
 */
const avatarStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '22px',
  height: '22px',
  borderRadius: '50%',
  backgroundColor: '#0070f3',
  color: 'white',
  fontSize: '11px',
  fontWeight: 500,
  flexShrink: 0,
  lineHeight: 1,
};

export function StorageStatusChip({ onOpenModal }: StorageStatusChipProps) {
  const { mode } = useStorage();
  const { user } = useAuth();
  const { colors } = useTheme();

  const isCloudSignedIn = mode === 'cloud' && !!user;
  const isSignedInLocal = mode === 'local' && !!user;

  if (isCloudSignedIn || isSignedInLocal) {
    const firstName = getFirstName(user?.displayName, user?.email);
    const initial = getInitial(firstName);
    return (
      <button
        type="button"
        onClick={onOpenModal}
        className="sf-chip"
        data-sf="chip"
        title={`Signed in as ${user?.email ?? (isCloudSignedIn ? 'cloud user' : 'local user')}`}
        aria-haspopup="dialog"
        aria-label="Account menu"
      >
        <span className="sf-chip-state">
          <span style={avatarStyle} aria-hidden="true">{initial}</span>
          <span style={{ fontWeight: 500, color: colors.text }}>{firstName}</span>
        </span>
        {/* The storage mode: the cloud in the link colour, or the lock (the only sign of local mode) muted. */}
        <span
          className="sf-chip-act"
          style={isCloudSignedIn ? undefined : { color: 'var(--sf-text-muted)' }}
          aria-hidden="true"
        >
          {isCloudSignedIn ? <CloudIcon /> : <LockIcon />}
        </span>
      </button>
    );
  }

  // Signed out / local mode
  return (
    <button
      type="button"
      onClick={onOpenModal}
      className="sf-chip"
      data-sf="chip"
      title="Using local storage"
      aria-haspopup="dialog"
      aria-label="Sign in"
    >
      <span className="sf-chip-state">
        <LockIcon />
        <span>Local only</span>
      </span>
      <span className="sf-chip-act" aria-hidden="true">Sign in</span>
    </button>
  );
}
