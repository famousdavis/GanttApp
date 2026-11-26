// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The Welcome panel (FRAME26 clean-up, v0.35.0): what stands in the tile grid's place while there are no projects at
// all (contract §3 "Welcome panel", §7 "Empty collection"). The frame's stylesheet draws it (`.sf-empty`, v3): a dashed
// card the column wide, on the page ground in both themes. The title is "Welcome to " and the brand row's title exactly,
// its ™ in the same `.sf-mark--tm` markup. The two buttons call the toolbar's own handlers, in the toolbar's own looks
// (`.pt-btn`, `.pt-btn-primary`) at the frame's 36 px (`.sf-btn`). Not shown when every project is archived: then the
// collection is not empty, and ProjectsTab shows the one-line archived message instead.

interface ProjectsWelcomeProps {
  /** The toolbar's New Project: opens the New Project dialog. */
  onCreate: () => void;
  /** The toolbar's Load Sample: adds the sample project and opens it on the Gantt Chart tab. */
  onLoadSample: () => void;
}

export function ProjectsWelcome({ onCreate, onLoadSample }: ProjectsWelcomeProps) {
  return (
    <div className="sf-empty" data-sf="empty">
      <h2 className="sf-empty-title">
        Welcome to GanttApp<span className="sf-mark sf-mark--tm">™</span>
      </h2>
      <p className="sf-empty-text">
        Show stakeholders when each release could ship: a solid bar for design, code and test, then a hatched bar for
        the window in which it may be delivered.
      </p>
      <p className="sf-empty-text">Create a project, add its releases, and see them on the Gantt Chart tab.</p>
      <div className="sf-empty-actions">
        <button type="button" className="pt-btn pt-btn-primary sf-btn" onClick={onCreate}>
          Create New Project
        </button>
        <button type="button" className="pt-btn sf-btn" onClick={onLoadSample}>
          Load Sample Project
        </button>
      </div>
      <p className="sf-empty-note">
        The sample project is a working example with five releases, two finished, one in progress and two not yet
        started, dated from today. You can explore it, edit it, or delete it at any time.
      </p>
    </div>
  );
}
