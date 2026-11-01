// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// ProjectTile — one project on the Projects tab.
//
// The name is a heading holding the open button; its ::after covers the tile,
// so a click anywhere on the tile opens the project's releases and a click on
// an icon (drawn above it) does not. Delete is always shown; the other icons
// are revealed by hover or by focus inside the tile (styles/projects-tab.css).

import type { DragEvent } from 'react';
import type { Project } from '../../shared/types';
import { formatDateMDY, getEffectiveWorkDays, getWorkDayWarning } from '../../shared/utils';
import { parseDateLocal } from '../../shared/utils/dates';
import { DragHandle } from '../../shared/components/DragHandle';
import { TrashIconButton } from '../../shared/components/TrashIconButton';
import { PencilIconButton } from '../../shared/components/PencilIconButton';
import { ExportIconButton } from '../../shared/components/ExportIconButton';
import { CloneIconButton } from '../../shared/components/CloneIconButton';
import { ShareIconButton } from '../../shared/components/ShareIconButton';
import { MoveIconButton } from '../../shared/components/MoveIconButton';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function releaseCountText(count: number): string {
  return count === 1 ? '1 release' : `${count} releases`;
}

/** "Mon–Thu" for a run of three or more days, otherwise a list: "Mon, Wed". */
export function workWeekText(days: readonly number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  const isRun = sorted.length > 2 && sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  return isRun
    ? `${DAY_SHORT[sorted[0]]}–${DAY_SHORT[sorted[sorted.length - 1]]}`
    : sorted.map((d) => DAY_SHORT[d]).join(', ');
}

/** The tile's visible explanation of a finish date outside the work week, or ''. */
export function finishWarningText(finishDate: string, workDays: number[] | undefined): string {
  if (!getWorkDayWarning(finishDate, workDays)) return '';
  return `${DAY_NAMES[new Date(parseDateLocal(finishDate)).getDay()]} is outside the work week`;
}

export interface ProjectTileProps {
  project: Project;
  index: number;
  count: number;
  releaseCount: number;
  globalWorkDays: number[] | undefined;
  canDelete: boolean;
  canShare: boolean;
  dragging: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onShare: () => void;
  onExport: () => void;
  onEdit: () => void;
  onClone: () => void;
  onMove: (direction: -1 | 1) => void;
  onDragStart: () => void;
  onDragOver: (e: DragEvent) => void;
  onDragEnd: () => void;
}

export function ProjectTile({
  project,
  index,
  count,
  releaseCount,
  globalWorkDays,
  canDelete,
  canShare,
  dragging,
  onOpen,
  onDelete,
  onShare,
  onExport,
  onEdit,
  onClone,
  onMove,
  onDragStart,
  onDragOver,
  onDragEnd,
}: ProjectTileProps) {
  const metaId = `pt-meta-${project.id}`;
  const warnId = `pt-warn-${project.id}`;
  const weekId = `pt-week-${project.id}`;
  const effectiveDays = getEffectiveWorkDays(project, globalWorkDays);
  const warning = project.finishDate ? finishWarningText(project.finishDate, effectiveDays) : '';
  const customWeek = project.workDays && project.workDays.length > 0 ? project.workDays : null;
  const describedBy = [metaId, warning && warnId, customWeek && weekId].filter(Boolean).join(' ');

  return (
    <li
      className={`pt-tile${dragging ? ' pt-dragging' : ''}`}
      data-project-tile={project.id}
      onDragOver={onDragOver}
    >
      <div className="pt-name-row">
        <span
          className="pt-grip"
          aria-hidden="true"
          title="Drag to reorder"
          draggable
          onDragStart={(e) => {
            // The whole tile as the drag image, not just the small grip.
            const tile = e.currentTarget.closest('li');
            if (tile && e.dataTransfer) {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setDragImage(tile, 12, 16);
            }
            onDragStart();
          }}
          onDragEnd={onDragEnd}
        >
          <DragHandle />
        </span>
        <h3 className="pt-name">
          <button
            type="button"
            className="pt-open"
            onClick={onOpen}
            aria-label={`Open releases for ${project.name}`}
            aria-describedby={describedBy}
            title="Open releases"
          >
            {project.name}
          </button>
        </h3>
        {canDelete && (
          <TrashIconButton onClick={onDelete} ariaLabel="Delete project" title="Delete project" />
        )}
      </div>
      <p className="pt-meta" id={metaId}>
        <span>{releaseCountText(releaseCount)}</span>
        {project.finishDate && (
          <>
            <span className="pt-sr-only">, </span>
            <span aria-hidden="true"> · </span>
            <span>Finish: {formatDateMDY(project.finishDate)}</span>
          </>
        )}
      </p>
      {warning && (
        <p className="pt-meta pt-meta-warn" id={warnId}>
          <span aria-hidden="true" title={getWorkDayWarning(project.finishDate ?? '', effectiveDays)}>⚠ </span>
          {warning}
        </p>
      )}
      {customWeek && (
        <p className="pt-meta" id={weekId}>Custom work week ({workWeekText(customWeek)})</p>
      )}
      <div className="pt-actions">
        <div className="pt-act-group pt-reveal">
          {canShare && <ShareIconButton onClick={onShare} ariaLabel="Share project" title="Share project" />}
          <ExportIconButton onClick={onExport} ariaLabel="Export project" title="Export project" />
          <PencilIconButton onClick={onEdit} ariaLabel="Edit project" title="Edit project" />
          <CloneIconButton onClick={onClone} ariaLabel="Clone project" title="Clone project" />
        </div>
        <div className="pt-act-group pt-reveal">
          <MoveIconButton direction="earlier" onClick={() => onMove(-1)} disabled={index === 0} />
          <MoveIconButton direction="later" onClick={() => onMove(1)} disabled={index === count - 1} />
        </div>
      </div>
    </li>
  );
}
