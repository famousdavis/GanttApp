// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { APP_VERSION } from '../../lib/version';

interface AppFooterProps {
  /** Opens the Changelog tab (the Version button). */
  onOpenChangelog: () => void;
}

/**
 * The frame's footer (FRAME26, contract §3 and §6, v0.34.0): a full-width band with a 1 px top rule, two centred lines
 * of 14 / 20 text, 69 px tall, flowing after `main`. Its links and the Version button take the frame's `--sf-link`
 * (#155dfc, 5.25:1 on #ffffff; #51a2ff, 6.72:1 on #101828) and its hover underline, so none of them carries a class or
 * a style of its own: an inline colour would beat the token (FRAME26 stage 0's FOOTER_LINK gave way to it). The
 * wording and the destinations are unchanged; the Version button still opens the Changelog tab.
 */
export function AppFooter({ onOpenChangelog }: AppFooterProps) {
  return (
    <footer className="sf-footer" data-sf="footer">
      <div className="sf-col">
        <div>
          &copy; 2026 William W. Davis, MSPM, PMP |{' '}
          <button type="button" className="sf-link" onClick={onOpenChangelog}>Version {APP_VERSION}</button>
          {' '}| Licensed under GNU GPL v3
        </div>
        <div>
          <a href="https://spertsuite.com" target="_blank" rel="noopener noreferrer">SPERT&reg; Suite</a>
          {' '}|{' '}
          <a href="https://spertsuite.com/TOS.pdf" target="_blank" rel="noopener noreferrer">Terms of Service</a>
          {' '}|{' '}
          <a href="https://spertsuite.com/PRIVACY.pdf" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
          {' '}|{' '}
          <a href="https://github.com/famousdavis/GanttApp/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">License</a>
        </div>
      </div>
    </footer>
  );
}
