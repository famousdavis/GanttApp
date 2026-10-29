// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// CloudLoadNoticeBanner (v0.29.10) — names the projects in which the
// cloud-load checks left something out (see cloud-load-guards.ts). It names
// projects only, never the value. A project no longer in the list (after
// sign-out, say) is not named. Dismissed for the session with "Got it".

import { useSyncExternalStore } from 'react';
import { useTheme } from '../../context/ThemeContext';
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
  const { colors, resolvedTheme } = useTheme();

  const names = projectIds
    .map(id => data.projects.find(p => p.id === id)?.name)
    .filter((name): name is string => name !== undefined);
  if (names.length === 0) return null;

  const bgColor = resolvedTheme === 'dark' ? '#3a2a10' : '#fff8e6';
  const borderColor = resolvedTheme === 'dark' ? '#6b5a2a' : '#f5c842';
  const quoted = names.map(name => `“${name}”`).join(', ');

  return (
    <div
      role="status"
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
      }}
    >
      <p style={{ color: colors.text, fontSize: '0.9rem', lineHeight: '1.5', margin: 0 }}>
        <strong>Some saved data could not be read</strong> in {names.length === 1 ? 'project' : 'projects'} {quoted}.
        It is not shown; the rest loaded normally.
      </p>
      <button
        type="button"
        onClick={dismissCloudSetAsideNotices}
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
