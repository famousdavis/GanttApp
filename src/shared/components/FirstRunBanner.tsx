// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// FirstRunBanner — dismissible informational banner shown on first app load.
// Non-blocking: no functionality is gated. Uses localStorage key 'spert_firstRun_seen'.

import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';

const FIRST_RUN_KEY = 'spert_firstRun_seen';

export function FirstRunBanner() {
  const { colors, resolvedTheme } = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(FIRST_RUN_KEY);
    if (seen !== 'true') {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(FIRST_RUN_KEY, 'true');
    setVisible(false);
  };

  if (!visible) return null;

  const bgColor = resolvedTheme === 'dark' ? '#1a2e44' : '#e6f2ff';
  const borderColor = resolvedTheme === 'dark' ? '#2a4a6b' : '#b3d4fc';

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
        SPERT&reg; Suite web apps are free to use. No account is required. If you choose to
        enable optional Cloud Storage, you will be asked to review and agree to our{' '}
        <a
          href="https://spertsuite.com/TOS.pdf"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#0070f3', textDecoration: 'none' }}
        >
          Terms of Service
        </a>
        {' '}and{' '}
        <a
          href="https://spertsuite.com/PRIVACY.pdf"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#0070f3', textDecoration: 'none' }}
        >
          Privacy Policy
        </a>.
      </p>
      <button
        onClick={handleDismiss}
        style={{
          background: 'transparent',
          color: '#0070f3',
          border: '1px solid #0070f3',
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
