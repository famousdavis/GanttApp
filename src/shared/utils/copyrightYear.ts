// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The year in the © line (FRAME26 Y1, v0.36.0): the current year, read from the visitor's clock. The footer and the
 * About page's Version and license block both call this, so their two © lines can never differ. GanttApp renders only
 * on the client, so there is no build-time year to drift from it.
 */
export function copyrightYear(): number {
  return new Date().getFullYear();
}
