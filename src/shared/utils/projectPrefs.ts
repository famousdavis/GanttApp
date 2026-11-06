// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// One person's tile colours and archived projects: AppData.projectPrefs, kept
// in their own settings (ganttapp_settings/{uid} in cloud mode, ganttAppData in
// local mode) and never on a project, so another member of a shared project
// sees neither.
//
// An entry can outlive its project on purpose: a project can leave and come
// back (a member removed and invited again, a partial load), and an old entry
// is harmless. So nothing here prunes on load, and counts come from
// data.projects, never from the map.

import type { AppData } from '../types/app';
import type { Project, ProjectColor, ProjectPref, ProjectPrefs } from '../types/models';
import { sanitizeId } from './validation';

export const PROJECT_COLORS: readonly ProjectColor[] = ['blue', 'teal', 'slate', 'purple', 'pink'];

/** Far more than anyone holds: a bound on what a tampered file or document can add. */
export const MAX_PROJECT_PREFS = 1000;

export interface ProjectPrefPatch {
  /** A colour; null clears it; undefined leaves it. */
  color?: ProjectColor | null;
  /** undefined leaves it. */
  archived?: boolean;
}

/** An imported or uploaded project: its id where it came from, and the id it has here. */
export interface PlacedProject {
  fromId: string;
  id: string;
}

function hasEntry(prefs: ProjectPrefs | undefined, id: string): prefs is ProjectPrefs {
  return prefs !== undefined && Object.prototype.hasOwnProperty.call(prefs, id);
}

/**
 * An id that must never be a key: `__proto__` and `constructor` reach the
 * prototype, and Firestore refuses a field named `__…__`, so one such key would
 * fail every settings write. sanitizeId passes them all.
 */
function isUnsafeKey(id: string): boolean {
  return id === 'constructor' || /^__.*__$/.test(id);
}

function sanitizeEntry(raw: unknown): ProjectPref | null {
  if (!raw || typeof raw !== 'object') return null;
  const { color, archived } = raw as { color?: unknown; archived?: unknown };
  const pref: ProjectPref = {};
  if (PROJECT_COLORS.includes(color as ProjectColor)) pref.color = color as ProjectColor;
  if (archived === true) pref.archived = true;
  return pref.color || pref.archived ? pref : null;
}

/**
 * The map as stored, kept only where it can be trusted, for every place data
 * enters: a local load, a cloud load and an import. Undefined when nothing is
 * left. A tampered file or document can lose its own entry and do no more.
 */
export function sanitizeProjectPrefs(raw: unknown): ProjectPrefs | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const entries: [string, ProjectPref][] = [];
  for (const key of Object.keys(raw).slice(0, MAX_PROJECT_PREFS)) {
    const id = sanitizeId(key);
    const pref = sanitizeEntry((raw as Record<string, unknown>)[key]);
    if (id && pref && !isUnsafeKey(id)) entries.push([id, pref]);
  }
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/** This project's entry, or an empty one: a project with the id `constructor` finds nothing. */
export function projectPrefOf(prefs: ProjectPrefs | undefined, id: string): ProjectPref {
  return hasEntry(prefs, id) ? prefs[id] : {};
}

export function isProjectArchived(prefs: ProjectPrefs | undefined, id: string): boolean {
  return projectPrefOf(prefs, id).archived === true;
}

/** The field to spread into an object: an empty map is left out altogether. */
export function projectPrefsField(prefs: ProjectPrefs | undefined): { projectPrefs?: ProjectPrefs } {
  return prefs && Object.keys(prefs).length > 0 ? { projectPrefs: prefs } : {};
}

function withPrefs(data: AppData, prefs: ProjectPrefs): AppData {
  const { projectPrefs: _replaced, ...rest } = data;
  return { ...rest, ...projectPrefsField(prefs) };
}

/** `data` with one project's entry changed. An entry with nothing left goes, and so does an empty map. */
export function withProjectPref(data: AppData, id: string, patch: ProjectPrefPatch): AppData {
  if (isUnsafeKey(id)) return data;
  const pref: ProjectPref = { ...projectPrefOf(data.projectPrefs, id) };
  if (patch.color) pref.color = patch.color;
  if (patch.color === null) delete pref.color;
  if (patch.archived === true) pref.archived = true;
  if (patch.archived === false) delete pref.archived;
  const prefs = { ...data.projectPrefs };
  if (pref.color || pref.archived) prefs[id] = pref;
  else delete prefs[id];
  return withPrefs(data, prefs);
}

/** `data` without these projects' entries. */
export function withoutProjectPrefs(data: AppData, ids: string[]): AppData {
  if (!data.projectPrefs) return data;
  const prefs = { ...data.projectPrefs };
  ids.forEach(id => { delete prefs[id]; });
  return withPrefs(data, prefs);
}

/** These projects' entries, or undefined when none has one. */
export function pickProjectPrefs(prefs: ProjectPrefs | undefined, ids: string[]): ProjectPrefs | undefined {
  const entries = ids.filter(id => hasEntry(prefs, id)).map(id => [id, projectPrefOf(prefs, id)] as const);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/** The same entries under new ids. */
export function rekeyProjectPrefs(
  prefs: ProjectPrefs | undefined,
  newId: (id: string) => string,
): ProjectPrefs | undefined {
  if (!prefs) return undefined;
  return Object.fromEntries(Object.keys(prefs).map(id => [newId(id), prefs[id]] as const));
}

/**
 * `data` after projects arrive from elsewhere: each placed project's entry is
 * exactly what `source` says, under the id it has here, so a project the source
 * has no entry for has none here either. `removedIds` lose their entries.
 * Every other entry stays.
 */
export function withPlacedPrefs(
  data: AppData,
  source: ProjectPrefs | undefined,
  placed: PlacedProject[],
  removedIds: string[],
): AppData {
  const prefs = { ...data.projectPrefs };
  removedIds.forEach(id => { delete prefs[id]; });
  placed.forEach(({ fromId, id }) => {
    if (hasEntry(source, fromId)) prefs[id] = source[fromId];
    else delete prefs[id];
  });
  return withPrefs(data, prefs);
}

/** The projects this person sees: everything, or everything not archived. */
export function shownProjects(
  projects: Project[],
  prefs: ProjectPrefs | undefined,
  showArchived: boolean,
): Project[] {
  return showArchived ? projects : projects.filter(p => !isProjectArchived(prefs, p.id));
}

/**
 * The full list with the shown projects in `shownIds`' order: the slots that
 * held a shown project take the new order, and a hidden project keeps its slot.
 * Always the full list: a filtered one must never reach a save.
 */
export function reorderShown(projects: Project[], shownIds: string[]): Project[] {
  const byId = new Map(projects.map(p => [p.id, p] as const));
  const shown = new Set(shownIds);
  let next = 0;
  return projects.map(p => (shown.has(p.id) ? byId.get(shownIds[next++]) as Project : p));
}

/** The full list with one shown project moved to position `to` among the shown ones. */
export function moveAmongShown(projects: Project[], shownIds: string[], id: string, to: number): Project[] {
  const from = shownIds.indexOf(id);
  if (from < 0 || to < 0 || to >= shownIds.length) return projects;
  const ids = shownIds.filter(shownId => shownId !== id);
  ids.splice(to, 0, id);
  return reorderShown(projects, ids);
}
