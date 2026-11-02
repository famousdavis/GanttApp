// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Modal surfaces — the overlays that block the page behind them.
//
// Each one marks its overlay root with MODAL_SURFACE_ATTR. Page-wide keyboard
// shortcuts ask isModalSurfaceOpen() at key time and wait while it is true, so
// an arrow key cannot switch the tab behind an open dialog and unmount it.
// Reading the DOM at key time keeps the answer in step with what is shown.

export const MODAL_SURFACE_ATTR = 'data-modal-surface';

/** Spread onto a modal surface's overlay root. */
export const modalSurfaceProps = { [MODAL_SURFACE_ATTR]: '' } as const;

export function isModalSurfaceOpen(doc: Document = document): boolean {
  return doc.querySelector(`[${MODAL_SURFACE_ATTR}]`) !== null;
}

/**
 * Make everything outside `keep` inert, at every level up to body, leaving
 * `keep` and its ancestors alone; returns the undo, which restores only what
 * this call changed. For a modal surface rendered in place: aria-modal alone
 * leaves the page behind it in Chrome's accessibility tree.
 */
export function inertOutside(keep: HTMLElement): () => void {
  const changed: Element[] = [];
  for (let node: HTMLElement | null = keep; node && node !== keep.ownerDocument.body; node = node.parentElement) {
    const self = node;
    Array.from(node.parentElement?.children ?? []).forEach((sibling) => {
      if (sibling === self || sibling.hasAttribute('inert')) return;
      sibling.setAttribute('inert', '');
      changed.push(sibling);
    });
  }
  return () => changed.forEach((el) => el.removeAttribute('inert'));
}
