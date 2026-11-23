// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The Projects screen's toolbar, and its heading row while the data loads (FRAME26, v0.34.0). Moved out of
// ProjectsTab.tsx unchanged apart from the frame's classes, so pages/index.tsx can show it before ProjectsTab mounts.

import type { ChangeEvent, RefObject } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { HeadingRow } from '../../shared/components/HeadingRow';
import { paletteStyle, projectsTabPalette } from './projectsTabPalette';

const ICON_PATHS = {
  export: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  import: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  sample: 'M9 3h6M10 3v6.5L4.6 18.8A1.5 1.5 0 0 0 5.9 21h12.2a1.5 1.5 0 0 0 1.3-2.2L14 9.5V3M7.2 15h9.6',
  plus: 'M12 5v14M5 12h14',
} as const;

function ToolbarIcon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface ToolbarProps {
  hasProjects: boolean;
  applying: boolean;
  newProjectRef?: RefObject<HTMLButtonElement | null>;
  onExportAll: () => void;
  onImport: (e: ChangeEvent<HTMLInputElement>) => void;
  onLoadSample: () => void;
  onNewProject: () => void;
  /** While the data loads (pages/index.tsx): every button in place and disabled, so none appears, disappears or
   *  moves when the data arrives (contract §7, Nov 8 A.2.6). Once loaded each button has its own gate again. */
  loading?: boolean;
}

// Export All · Import · Load Sample · New Project. Import stays a <label>
// around a visually hidden file input, so the native picker opens on a click
// and keyboard users can still reach the input. Every button is always
// rendered, so none moves with the project count (v0.32.0): with no projects
// Export All is disabled, not hidden. The buttons are the frame's 36 px
// `.sf-btn` (14 px / 500, 18 px icons) in GanttApp's own colours and corners
// (`.pt-btn`); styles/spert-frame.css is imported after projects-tab.css, so
// the frame's size wins where the two classes meet (FRAME26, v0.34.0).
export function ProjectsToolbar({
  hasProjects, applying, newProjectRef, onExportAll, onImport, onLoadSample, onNewProject, loading = false,
}: ToolbarProps) {
  const importOff = applying || loading;
  return (
    <div className="pt-toolbar sf-toolbar" data-sf="toolbar">
      <button
        type="button"
        className="pt-btn sf-btn"
        onClick={onExportAll}
        disabled={!hasProjects || loading}
        aria-label="Export all projects as JSON"
      >
        <ToolbarIcon d={ICON_PATHS.export} />
        Export All
      </button>
      <label className="pt-btn sf-btn" aria-label="Import projects from JSON" aria-disabled={importOff}>
        <ToolbarIcon d={ICON_PATHS.import} />
        Import
        <input
          type="file"
          name="importJson"
          accept=".json"
          className="pt-sr-only"
          disabled={importOff}
          onChange={onImport}
        />
      </label>
      <button type="button" className="pt-btn sf-btn" onClick={onLoadSample} disabled={loading}>
        <ToolbarIcon d={ICON_PATHS.sample} />
        Load Sample
      </button>
      <button type="button" ref={newProjectRef} className="pt-btn pt-btn-primary sf-btn" onClick={onNewProject} disabled={loading}>
        <ToolbarIcon d={ICON_PATHS.plus} />
        New Project
      </button>
    </div>
  );
}

const noop = () => {};

/**
 * The Projects screen's heading row while the data loads (FRAME26, contract §7 "Loading", v0.34.0): the frame and
 * this row render first, and only the body says "Loading...". The toolbar is the real one, every button disabled. It
 * sits in its own `.pt-root` so the buttons keep the tab's colours (`--pt-*`), which ProjectsTab sets on its root.
 */
export function ProjectsLoadingHeading() {
  const { resolvedTheme } = useTheme();
  return (
    <div className="pt-root" style={paletteStyle(projectsTabPalette(resolvedTheme))}>
      <HeadingRow
        className="pt-head"
        toolbar={
          <ProjectsToolbar
            hasProjects={false}
            applying={false}
            onExportAll={noop}
            onImport={noop}
            onLoadSample={noop}
            onNewProject={noop}
            loading
          />
        }
      >
        Projects
      </HeadingRow>
    </div>
  );
}
