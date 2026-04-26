// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// LocalStorageWarningToggle — checkbox controlling the local-storage warning
// banner suppression. Reads/writes the same `ganttapp-suppress-local-warning`
// key that LocalStorageWarningBanner reads, so toggle and banner stay in sync.
//
// Extracted from SettingsTab in v17.0 so the new CloudStorageModal can reuse
// it without duplicating the warnOnLocal state + handler.

import { useState } from 'react';
import { useStorage } from '../../context/StorageContext';
import type { ThemeColors } from '../utils/theme';

const SUPPRESS_KEY = 'ganttapp-suppress-local-warning';

interface LocalStorageWarningToggleProps {
  colors: ThemeColors;
  /**
   * When true, the toggle renders regardless of storage mode (used by the
   * always-visible CloudStorageModal). When false (default; SettingsTab), the
   * toggle only renders in local mode.
   */
  alwaysVisible?: boolean;
}

export function LocalStorageWarningToggle({
  colors,
  alwaysVisible = false,
}: LocalStorageWarningToggleProps) {
  const { mode } = useStorage();

  const [warnOnLocal, setWarnOnLocal] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(SUPPRESS_KEY) !== 'true';
  });

  const handleChange = (checked: boolean) => {
    setWarnOnLocal(checked);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SUPPRESS_KEY, checked ? 'false' : 'true');
    }
  };

  if (!alwaysVisible && mode !== 'local') {
    return null;
  }

  return (
    <section style={{ marginBottom: '2rem' }}>
      <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' }}>
        Notifications
      </h3>
      <label style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem',
        cursor: 'pointer',
      }}>
        <input
          type="checkbox"
          checked={warnOnLocal}
          onChange={(e) => handleChange(e.target.checked)}
          style={{ marginTop: '0.2rem' }}
        />
        <div>
          <span style={{ fontWeight: '600', color: colors.text }}>
            Warn me on startup when using local storage
          </span>
          <p style={{
            color: colors.textSecondary,
            fontSize: '0.85rem',
            lineHeight: '1.5',
            margin: '0.25rem 0 0 0',
          }}>
            Shows a caution banner each time the app opens while your data is stored
            locally in this browser.
          </p>
        </div>
      </label>
    </section>
  );
}
