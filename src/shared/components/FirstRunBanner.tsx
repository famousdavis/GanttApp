// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// FirstRunBanner — dismissible informational banner shown on first app load.
// Non-blocking: no functionality is gated. Uses localStorage key 'spert_firstRun_seen'.
// The frame's info notice (FRAME26, v0.34.0): `.sf-notice--info` sets its ground, border, text and link colours,
// and `.sf-notice-dismiss` draws "Got it". No inline style: an inline value would beat the frame's.

import { useState, useEffect } from 'react';

const FIRST_RUN_KEY = 'spert_firstRun_seen';

export function FirstRunBanner() {
  const [visible, setVisible] = useState(false);

  // SSR hydration pattern: must start false (matching server render), then check localStorage on client.
  // A lazy initializer would cause a hydration mismatch since server has no localStorage.
  useEffect(() => {
    const seen = localStorage.getItem(FIRST_RUN_KEY);
    if (seen !== 'true') {
      setVisible(true); // eslint-disable-line react-hooks/set-state-in-effect -- SSR hydration pattern
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(FIRST_RUN_KEY, 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="sf-notice sf-notice--info">
      <p>
        SPERT&reg; Suite web apps are free to use. No account is required to use them. By
        accessing or using this app, you agree to our{' '}
        <a
          href="https://spertsuite.com/TOS.pdf"
          target="_blank"
          rel="noopener noreferrer"
        >
          Terms of Service
        </a>
        {' '}and{' '}
        <a
          href="https://spertsuite.com/PRIVACY.pdf"
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy Policy
        </a>. If you choose to enable optional Cloud Storage, you&apos;ll be asked to
        explicitly confirm your agreement.
      </p>
      <button type="button" className="sf-notice-dismiss" onClick={handleDismiss}>
        Got it
      </button>
    </div>
  );
}
