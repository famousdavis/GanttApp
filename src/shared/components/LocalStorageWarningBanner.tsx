// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// LocalStorageWarningBanner — amber caution banner shown on every app load
// when storage mode is 'local' and the user hasn't suppressed it via Settings.
// Session-only dismiss via ×; permanent suppression via Settings > Notifications.

import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useStorage } from '../../context/StorageContext';

const SUPPRESS_KEY = 'ganttapp-suppress-local-warning';

export function LocalStorageWarningBanner() {
  const { mode } = useStorage();
  const { colors, resolvedTheme } = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (mode !== 'local') {
      setVisible(false);
      return;
    }
    if (localStorage.getItem(SUPPRESS_KEY) === 'true') {
      setVisible(false);
      return;
    }
    setVisible(true);
  }, [mode]);

  const handleDismiss = () => {
    setVisible(false);
  };

  if (!visible) return null;

  const bgColor = resolvedTheme === 'dark' ? '#3a2a10' : '#fff8e6';
  const borderColor = resolvedTheme === 'dark' ? '#6b5a2a' : '#f5c842';

  return (
    <div style={{
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: '8px',
      padding: '1rem 1.25rem',
      marginBottom: '1rem',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '1rem',
    }}>
      <p style={{
        color: colors.text,
        fontSize: '0.9rem',
        lineHeight: '1.5',
        margin: 0,
      }}>
        <strong>Your data exists only in this browser</strong> and can be lost without warning.
        Export at the end of every session to protect your work.
      </p>
      <button
        onClick={handleDismiss}
        style={{
          background: 'transparent',
          color: '#b8860b',
          border: '1px solid #b8860b',
          borderRadius: '4px',
          padding: '0.4rem 1rem',
          fontWeight: '600',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          fontSize: '0.85rem',
        }}
      >
        Got it
      </button>
    </div>
  );
}
