// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { ReactNode } from 'react';

interface HeadingRowProps {
  /** The page's heading: the page's one `h1`. */
  children: ReactNode;
  /** The full text, shown on hover when a long heading is cut short with an ellipsis (contract §7, "Long names"). */
  title?: string;
  /** The `h1`'s id, for a list it names (the Projects tile list is `aria-labelledby` it). */
  id?: string;
  /** The page's own toolbar, flush right on the row (Projects: Export All · Import · Load Sample · New Project). */
  toolbar?: ReactNode;
  /** Extra classes for the row itself (Projects keeps its 16 px to what follows, `.pt-head`). */
  className?: string;
}

/**
 * The frame's heading row (FRAME26, contract §3, v0.34.0): the page's `h1`, 24 / 32 / 700 at the column's left edge,
 * with the toolbar flush right, 24 px under the frame. Every screen has exactly one, and it is the page's only `h1`:
 * the brand title is not a heading.
 *
 * ⚠️ On a capped screen (`.sf-main--capped`, exception X4: Settings, About, Changelog) render it as a DIRECT child of
 * `main`, never inside a wrapper: the stylesheet caps every child of `main` except this row, which stays full width.
 */
export function HeadingRow({ children, title, id, toolbar, className }: HeadingRowProps) {
  return (
    <div className={className ? `sf-headrow ${className}` : 'sf-headrow'} data-sf="headrow">
      <h1 className="sf-heading" data-sf="heading" id={id} title={title}>
        {children}
      </h1>
      {toolbar}
    </div>
  );
}
