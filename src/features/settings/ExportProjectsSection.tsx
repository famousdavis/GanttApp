// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// ExportProjectsSection — Settings-tab section for selecting and exporting one or
// more projects as a portable JSON file (v19.0).
//
// File contains the selected projects + their releases + (optionally) their snapshots.
// No global settings — importing into another workspace will not clobber the
// recipient's chart colors / display settings / attribution / etc.
//
// Disabled when no projects are selected. Disabled while in-flight to avoid
// double-clicks producing duplicate downloads.

import { useState } from 'react';
import type { Project } from '../../shared/types/models';
import type { AppData } from '../../shared/types/app';
import type { Snapshot } from '../../shared/types/snapshots';
import type { ThemeColors } from '../../shared/utils/theme';
import { exportSelectedProjects } from '../../shared/utils';

interface ExportProjectsSectionProps {
  colors: ThemeColors;
  projects: Project[];
  data: AppData;
  storage: { loadSnapshots: () => Promise<Snapshot[]> };
}

export function ExportProjectsSection({
  colors,
  projects,
  data,
  storage,
}: ExportProjectsSectionProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [includeSnapshots, setIncludeSnapshots] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const allSelected = selectedIds.size === projects.length && projects.length > 0;
  const noneSelected = selectedIds.size === 0;

  const toggleProject = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(projects.map(p => p.id)));
    }
  };

  const handleExport = async () => {
    if (noneSelected) return;
    setIsExporting(true);
    try {
      await exportSelectedProjects(Array.from(selectedIds), data, storage, { includeSnapshots });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section style={{ marginBottom: '2rem' }}>
      <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: '#0070f3' }}>
        Export Projects
      </h3>
      <p style={{ fontSize: '0.875rem', color: colors.textSecondary, marginBottom: '1rem' }}>
        Download selected projects as a portable JSON file. The file can be imported
        into any GanttApp workspace without affecting its existing data.
      </p>

      {projects.length === 0 && (
        <p style={{ color: colors.textMuted, fontStyle: 'italic' }}>
          No projects to export.
        </p>
      )}

      {projects.length > 0 && (
        <>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.5rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: colors.text,
          }}>
            <input
              type="checkbox"
              name="selectAllForExport"
              checked={allSelected}
              onChange={toggleAll}
            />
            {allSelected ? 'Deselect all' : 'Select all'}
          </label>

          <div style={{
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            maxHeight: '240px',
            overflowY: 'auto',
            marginBottom: '0.75rem',
          }}>
            {projects.map((project, i) => (
              <label
                key={project.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.5rem 0.75rem',
                  cursor: 'pointer',
                  borderTop: i > 0 ? `1px solid ${colors.borderLight}` : 'none',
                }}
              >
                <input
                  type="checkbox"
                  name="exportProjectSelection"
                  aria-label={`Select ${project.name} for export`}
                  checked={selectedIds.has(project.id)}
                  onChange={() => toggleProject(project.id)}
                />
                <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: '500', color: colors.text }}>
                  {project.name}
                </span>
                <span style={{ fontSize: '0.8rem', color: colors.textMuted }}>
                  {data.releases.filter(r => r.projectId === project.id).length} release(s)
                </span>
              </label>
            ))}
          </div>

          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
            color: colors.text,
            marginBottom: '0.75rem',
          }}>
            <input
              type="checkbox"
              name="includeSnapshotsForExport"
              checked={includeSnapshots}
              onChange={e => setIncludeSnapshots(e.target.checked)}
            />
            <span>Include snapshots</span>
            <span style={{ color: colors.textMuted, fontSize: '0.8rem' }}>(larger file)</span>
          </label>

          <button
            type="button"
            onClick={handleExport}
            disabled={noneSelected || isExporting}
            style={{
              padding: '0.5rem 1.25rem',
              background: noneSelected || isExporting ? '#ccc' : '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: noneSelected || isExporting ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem',
              opacity: noneSelected || isExporting ? 0.6 : 1,
            }}
          >
            {isExporting
              ? 'Exporting…'
              : `Export${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
          </button>
        </>
      )}
    </section>
  );
}
