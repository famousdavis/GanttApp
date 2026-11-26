// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { InvitationBanner } from './InvitationBanner';
import { FirstRunBanner } from './FirstRunBanner';
import { LocalStorageWarningBanner } from './LocalStorageWarningBanner';
import { CloudLoadNoticeBanner } from './CloudLoadNoticeBanner';

/**
 * The frame's notices slot (contract §3, §6): the app-wide notices, in this order (v0.32.0, as in the other SPERT®
 * apps). The slot hides itself when every notice is absent, so nothing else may go in it. One component for the app's
 * page and its 404 (v0.35.0), so the two cannot drift.
 */
export function AppNotices() {
  return (
    <div className="sf-col sf-notices" data-sf="notices">
      <InvitationBanner />
      <FirstRunBanner />
      <LocalStorageWarningBanner />
      <CloudLoadNoticeBanner />
    </div>
  );
}
