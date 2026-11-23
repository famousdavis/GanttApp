// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// LocalStorageWarningBanner — amber caution banner shown on every app load
// when storage mode is 'local' and the user hasn't suppressed it via Settings.
// Session-only dismiss via "Got it"; permanent suppression via Settings > Notifications.
// The frame's caution notice (FRAME26, v0.34.0): `.sf-notice--caution` sets its ground, border and text colours, and
// `.sf-notice-dismiss` draws "Got it". No inline style: an inline value would beat the frame's.

import { useState, useEffect } from 'react';
import { useStorage } from '../../context/StorageContext';

const SUPPRESS_KEY = 'ganttapp-suppress-local-warning';

export function LocalStorageWarningBanner() {
  const { mode } = useStorage();
  const [visible, setVisible] = useState(false);

  // SSR hydration + mode-dependent: must start false (matching server render), then evaluate
  // on client. Can't use a lazy initializer because this re-evaluates when mode changes.
  useEffect(() => {
    const shouldShow = mode === 'local' && localStorage.getItem(SUPPRESS_KEY) !== 'true';
    setVisible(shouldShow); // eslint-disable-line react-hooks/set-state-in-effect -- SSR hydration: must match server (false), then set on client
  }, [mode]);

  const handleDismiss = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="sf-notice sf-notice--caution">
      <p>
        <strong>Your data exists only in this browser</strong> and can be lost without warning.
        Export at the end of every session to protect your work.
      </p>
      <button type="button" className="sf-notice-dismiss" onClick={handleDismiss}>
        Got it
      </button>
    </div>
  );
}
