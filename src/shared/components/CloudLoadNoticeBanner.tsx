// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// CloudLoadNoticeBanner (v0.29.10) — names the projects in which the
// cloud-load checks left something out (see cloud-load-guards.ts). It names
// projects only, never the value. A project no longer in the list (after
// sign-out, say) is not named. Dismissed for the session with "Got it".
// The frame's caution notice (FRAME26, v0.34.0), as LocalStorageWarningBanner.

import { useSyncExternalStore } from 'react';
import { useAppData } from '../../context/AppDataContext';
import {
  dismissCloudSetAsideNotices,
  getCloudSetAsideProjects,
  getNoCloudSetAsideProjects,
  subscribeCloudSetAsideNotices,
} from '../storage/cloud-load-notices';

export function CloudLoadNoticeBanner() {
  const projectIds = useSyncExternalStore(
    subscribeCloudSetAsideNotices,
    getCloudSetAsideProjects,
    getNoCloudSetAsideProjects
  );
  const { data } = useAppData();

  const names = projectIds
    .map(id => data.projects.find(p => p.id === id)?.name)
    .filter((name): name is string => name !== undefined);
  if (names.length === 0) return null;

  const quoted = names.map(name => `“${name}”`).join(', ');

  return (
    <div role="status" className="sf-notice sf-notice--caution">
      <p>
        <strong>Some saved data could not be read</strong> in {names.length === 1 ? 'project' : 'projects'} {quoted}.
        It is not shown; the rest loaded normally.
      </p>
      <button type="button" className="sf-notice-dismiss" onClick={dismissCloudSetAsideNotices}>
        Got it
      </button>
    </div>
  );
}
