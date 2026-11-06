// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import {
  PROJECT_COLORS,
  isProjectArchived,
  moveAmongShown,
  pickProjectPrefs,
  projectPrefOf,
  projectPrefsField,
  rekeyProjectPrefs,
  reorderShown,
  sanitizeProjectPrefs,
  shownProjects,
  withPlacedPrefs,
  withProjectPref,
  withoutProjectPrefs,
} from '../projectPrefs';
import type { AppData } from '../../types/app';
import type { Project, ProjectPrefs } from '../../types/models';

const baseData = (projectPrefs?: ProjectPrefs): AppData => ({
  projects: [],
  releases: [],
  ...(projectPrefs && { projectPrefs }),
});

const projects = (...ids: string[]): Project[] => ids.map(id => ({ id, name: `Project ${id}` }));
const idsOf = (list: Project[]) => list.map(p => p.id);

describe('sanitizeProjectPrefs', () => {
  it.each([
    ['nothing', undefined],
    ['null', null],
    ['text', 'blue'],
    ['a number', 7],
    ['a list', [{ color: 'blue' }]],
  ])('reads %s as no map', (_label, raw) => {
    expect(sanitizeProjectPrefs(raw)).toBeUndefined();
  });

  it('keeps a good map as it is', () => {
    const raw = { p1: { color: 'teal' }, p2: { archived: true }, p3: { color: 'pink', archived: true } };
    expect(sanitizeProjectPrefs(raw)).toEqual(raw);
  });

  it.each(PROJECT_COLORS)('keeps the colour %s', (color) => {
    expect(sanitizeProjectPrefs({ p1: { color } })).toEqual({ p1: { color } });
  });

  it.each(['red', 'green', 'amber', 'none', 'Blue', '', 3, null, ['blue'], { blue: true }])(
    'drops the colour %j and, with nothing else, the entry',
    (color) => {
      expect(sanitizeProjectPrefs({ keep: { archived: true }, p1: { color } })).toEqual({ keep: { archived: true } });
    },
  );

  it('keeps the rest of an entry when its colour is refused', () => {
    expect(sanitizeProjectPrefs({ p1: { color: 'red', archived: true } })).toEqual({ p1: { archived: true } });
  });

  it.each(['true', 1, false, 0, null, {}])('takes only true as archived, not %j', (archived) => {
    expect(sanitizeProjectPrefs({ keep: { color: 'blue' }, p1: { archived } })).toEqual({ keep: { color: 'blue' } });
  });

  it.each(['yes', 3, null, ['blue'], true])('drops the entry %j, which is not an object', (entry) => {
    expect(sanitizeProjectPrefs({ keep: { color: 'blue' }, p1: entry })).toEqual({ keep: { color: 'blue' } });
  });

  it('drops any field but the two', () => {
    expect(sanitizeProjectPrefs({ p1: { color: 'blue', role: 'owner' } })).toEqual({ p1: { color: 'blue' } });
  });

  it('runs each key through sanitizeId, and drops a key that leaves nothing', () => {
    expect(sanitizeProjectPrefs({ 'p.1': { color: 'blue' }, '...': { color: 'teal' } })).toEqual({ p1: { color: 'blue' } });
  });

  it('is undefined when no entry survives', () => {
    expect(sanitizeProjectPrefs({ p1: { color: 'red' } })).toBeUndefined();
    expect(sanitizeProjectPrefs({})).toBeUndefined();
  });

  describe('a key that could reach the prototype, or that Firestore would refuse', () => {
    // JSON.parse makes `__proto__` an own key, as a tampered file would.
    const tampered = (key: string) => JSON.parse(`{"keep":{"color":"blue"},"${key}":{"archived":true}}`);

    it.each(['__proto__', 'constructor', '__reserved__', '__p.roto__', '____', 'con.structor', '.__a__'])('refuses %s, and keeps the rest', (key) => {
      const prefs = sanitizeProjectPrefs(tampered(key));
      expect(prefs).toEqual({ keep: { color: 'blue' } });
      expect(Object.keys(prefs!)).toEqual(['keep']);
    });

    it.each(['__a__b', 'a__b__', '__a'])('keeps %s, which is neither reserved nor on the prototype', (key) => {
      expect(sanitizeProjectPrefs(tampered(key))).toEqual({ keep: { color: 'blue' }, [key]: { archived: true } });
    });

    it('does not touch any prototype', () => {
      const prefs = sanitizeProjectPrefs(tampered('__proto__'))!;
      expect(Object.getPrototypeOf(prefs)).toBe(Object.prototype);
      expect(({} as { archived?: boolean }).archived).toBeUndefined();
    });

    it('keeps a key with underscores that is not of the reserved shape', () => {
      expect(sanitizeProjectPrefs({ __a: { color: 'blue' }, b__: { color: 'teal' }, _c_: { color: 'pink' } }))
        .toEqual({ __a: { color: 'blue' }, b__: { color: 'teal' }, _c_: { color: 'pink' } });
    });
  });

  it('caps the map', () => {
    const raw = Object.fromEntries(
      Array.from({ length: 1001 }, (_, i) => [`p${i}`, { color: 'blue' }]),
    );
    const prefs = sanitizeProjectPrefs(raw)!;
    expect(Object.keys(prefs)).toHaveLength(1000);
    expect(prefs.p999).toEqual({ color: 'blue' });
    expect(prefs.p1000).toBeUndefined();
  });
});

describe('reading an entry', () => {
  it('finds a project entry', () => {
    expect(projectPrefOf({ p1: { color: 'teal' } }, 'p1')).toEqual({ color: 'teal' });
  });

  it('finds nothing with no map, or no entry', () => {
    expect(projectPrefOf(undefined, 'p1')).toEqual({});
    expect(projectPrefOf({ p2: { color: 'teal' } }, 'p1')).toEqual({});
  });

  it.each(['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__'])(
    'finds no entry on the prototype for a project with the id %s, which is not archived',
    (id) => {
      expect(Object.getOwnPropertyNames(projectPrefOf({ p1: { color: 'teal' } }, id))).toEqual([]);
      expect(isProjectArchived({ p1: { archived: true } }, id)).toBe(false);
    },
  );

  it('reads archived from the entry alone', () => {
    const prefs: ProjectPrefs = { p1: { archived: true }, p2: { color: 'blue' } };
    expect(isProjectArchived(prefs, 'p1')).toBe(true);
    expect(isProjectArchived(prefs, 'p2')).toBe(false);
    expect(isProjectArchived(prefs, 'p3')).toBe(false);
    expect(isProjectArchived(undefined, 'p1')).toBe(false);
  });
});

describe('projectPrefsField', () => {
  it('spreads a map with entries', () => {
    expect(projectPrefsField({ p1: { color: 'blue' } })).toEqual({ projectPrefs: { p1: { color: 'blue' } } });
  });

  it('leaves out an empty map and no map, key and all', () => {
    expect(Object.keys(projectPrefsField({}))).toEqual([]);
    expect(Object.keys(projectPrefsField(undefined))).toEqual([]);
  });
});

describe('withProjectPref', () => {
  it('sets a colour with no map yet', () => {
    expect(withProjectPref(baseData(), 'p1', { color: 'blue' }).projectPrefs).toEqual({ p1: { color: 'blue' } });
  });

  it('keeps the entry\'s other choice, and the other entries', () => {
    const data = baseData({ p1: { archived: true }, p2: { color: 'pink' } });
    expect(withProjectPref(data, 'p1', { color: 'teal' }).projectPrefs)
      .toEqual({ p1: { color: 'teal', archived: true }, p2: { color: 'pink' } });
  });

  it('archives, and unarchives without touching the colour', () => {
    const archived = withProjectPref(baseData({ p1: { color: 'teal' } }), 'p1', { archived: true });
    expect(archived.projectPrefs).toEqual({ p1: { color: 'teal', archived: true } });
    expect(withProjectPref(archived, 'p1', { archived: false }).projectPrefs).toEqual({ p1: { color: 'teal' } });
  });

  it('clears a colour, keeping the archive', () => {
    expect(withProjectPref(baseData({ p1: { color: 'teal', archived: true } }), 'p1', { color: null }).projectPrefs)
      .toEqual({ p1: { archived: true } });
  });

  it('removes an entry with nothing left, keeping the others', () => {
    expect(withProjectPref(baseData({ p1: { color: 'teal' }, p2: { archived: true } }), 'p1', { color: null }).projectPrefs)
      .toEqual({ p2: { archived: true } });
  });

  it('leaves the field out once the last entry goes', () => {
    const next = withProjectPref(baseData({ p1: { archived: true } }), 'p1', { archived: false });
    expect('projectPrefs' in next).toBe(false);
  });

  it('changes nothing with an empty patch, as a clone of an uncoloured project does', () => {
    expect(withProjectPref(baseData({ p2: { color: 'pink' } }), 'p1', {}).projectPrefs).toEqual({ p2: { color: 'pink' } });
    expect(withProjectPref(baseData({ p1: { color: 'pink' } }), 'p1', { color: undefined }).projectPrefs)
      .toEqual({ p1: { color: 'pink' } });
  });

  it('keeps the rest of the data and does not change what it was given', () => {
    const data = { ...baseData({ p1: { color: 'teal' } }), preparedBy: 'Sam' };
    const next = withProjectPref(data, 'p1', { archived: true });
    expect(next.preparedBy).toBe('Sam');
    expect(data.projectPrefs).toEqual({ p1: { color: 'teal' } });
  });

  it.each(['__proto__', 'constructor', '__reserved__'])('writes no entry for a project with the id %s', (id) => {
    const data = baseData({ p1: { color: 'teal' } });
    expect(withProjectPref(data, id, { archived: true })).toBe(data);
  });
});

describe('withoutProjectPrefs', () => {
  it('removes these entries and keeps the others', () => {
    const data = baseData({ p1: { color: 'teal' }, p2: { archived: true }, p3: { color: 'pink' } });
    expect(withoutProjectPrefs(data, ['p1', 'p3']).projectPrefs).toEqual({ p2: { archived: true } });
  });

  it('leaves the field out when none is left', () => {
    expect('projectPrefs' in withoutProjectPrefs(baseData({ p1: { color: 'teal' } }), ['p1'])).toBe(false);
  });

  it('returns the same data with no map', () => {
    const data = baseData();
    expect(withoutProjectPrefs(data, ['p1'])).toBe(data);
  });
});

describe('pickProjectPrefs', () => {
  it('takes these projects\' entries only', () => {
    expect(pickProjectPrefs({ p1: { color: 'teal' }, stale: { archived: true } }, ['p1', 'p2']))
      .toEqual({ p1: { color: 'teal' } });
  });

  it('is undefined when none has one, or there is no map', () => {
    expect(pickProjectPrefs({ stale: { archived: true } }, ['p1'])).toBeUndefined();
    expect(pickProjectPrefs(undefined, ['p1'])).toBeUndefined();
  });
});

describe('rekeyProjectPrefs', () => {
  it('moves entries to new ids and leaves the rest', () => {
    const renamed: Record<string, string> = { a: 'x' };
    expect(rekeyProjectPrefs({ a: { color: 'teal' }, b: { archived: true } }, id => renamed[id] ?? id))
      .toEqual({ x: { color: 'teal' }, b: { archived: true } });
  });

  it('is undefined with no map', () => {
    expect(rekeyProjectPrefs(undefined, id => id)).toBeUndefined();
  });
});

describe('withPlacedPrefs', () => {
  it('sets a placed project\'s entry from the source, under the id it has here', () => {
    const next = withPlacedPrefs(baseData(), { file1: { color: 'teal' } }, [{ fromId: 'file1', id: 'here1' }], []);
    expect(next.projectPrefs).toEqual({ here1: { color: 'teal' } });
  });

  it('clears a placed project\'s entry when the source has none for it', () => {
    const next = withPlacedPrefs(
      baseData({ p1: { archived: true }, p2: { color: 'pink' } }),
      { other: { color: 'teal' } },
      [{ fromId: 'p1', id: 'p1' }],
      [],
    );
    expect(next.projectPrefs).toEqual({ p2: { color: 'pink' } });
  });

  it('clears it with no source map at all', () => {
    const next = withPlacedPrefs(baseData({ p1: { archived: true } }), undefined, [{ fromId: 'p1', id: 'p1' }], []);
    expect('projectPrefs' in next).toBe(false);
  });

  it('removes the removed ids\' entries', () => {
    const next = withPlacedPrefs(
      baseData({ old: { archived: true }, kept: { color: 'pink' } }),
      { new1: { color: 'teal' } },
      [{ fromId: 'new1', id: 'new1' }],
      ['old'],
    );
    expect(next.projectPrefs).toEqual({ new1: { color: 'teal' }, kept: { color: 'pink' } });
  });

  it('leaves every entry not named alone', () => {
    const next = withPlacedPrefs(baseData({ skipped: { archived: true } }), { skipped: { color: 'teal' } }, [], []);
    expect(next.projectPrefs).toEqual({ skipped: { archived: true } });
  });
});

describe('shownProjects', () => {
  const list = projects('a', 'b', 'c');
  const prefs: ProjectPrefs = { b: { archived: true }, c: { color: 'teal' } };

  it('leaves out the archived, keeping the order', () => {
    expect(idsOf(shownProjects(list, prefs, false))).toEqual(['a', 'c']);
  });

  it('shows everything when asked', () => {
    expect(shownProjects(list, prefs, true)).toBe(list);
  });

  it('shows everything with no map, and nothing when all are archived', () => {
    expect(idsOf(shownProjects(list, undefined, false))).toEqual(['a', 'b', 'c']);
    expect(shownProjects(list, { a: { archived: true }, b: { archived: true }, c: { archived: true } }, false)).toEqual([]);
  });
});

describe('reorderShown', () => {
  it('with nothing hidden, is the new order', () => {
    expect(idsOf(reorderShown(projects('a', 'b', 'c'), ['c', 'a', 'b']))).toEqual(['c', 'a', 'b']);
  });

  it.each([
    ['first', ['x', 'a', 'b', 'c'], ['c', 'b', 'a'], ['x', 'c', 'b', 'a']],
    ['in the middle', ['a', 'x', 'b', 'c'], ['b', 'a', 'c'], ['b', 'x', 'a', 'c']],
    ['last', ['a', 'b', 'c', 'x'], ['b', 'a', 'c'], ['b', 'a', 'c', 'x']],
    ['twice, apart', ['x', 'a', 'y', 'b'], ['b', 'a'], ['x', 'b', 'y', 'a']],
    ['twice, together', ['a', 'x', 'y', 'b'], ['b', 'a'], ['b', 'x', 'y', 'a']],
  ])('keeps a hidden project\'s slot, hidden %s', (_label, full, shown, expected) => {
    expect(idsOf(reorderShown(projects(...full), shown))).toEqual(expected);
  });

  it('always returns every project', () => {
    const full = projects('a', 'x', 'b', 'y', 'c');
    expect(idsOf(reorderShown(full, ['c', 'b', 'a'])).sort()).toEqual(['a', 'b', 'c', 'x', 'y']);
  });
});

describe('moveAmongShown', () => {
  const full = projects('a', 'x', 'b', 'c');
  const shown = ['a', 'b', 'c'];

  it('moves one place later, past a hidden neighbour, which keeps its slot', () => {
    expect(idsOf(moveAmongShown(full, shown, 'a', 1))).toEqual(['b', 'x', 'a', 'c']);
  });

  it('moves one place earlier, past a hidden neighbour', () => {
    expect(idsOf(moveAmongShown(full, shown, 'b', 0))).toEqual(['b', 'x', 'a', 'c']);
  });

  it('moves any distance, as a drag does', () => {
    expect(idsOf(moveAmongShown(full, shown, 'c', 0))).toEqual(['c', 'x', 'a', 'b']);
    expect(idsOf(moveAmongShown(full, shown, 'a', 2))).toEqual(['b', 'x', 'c', 'a']);
  });

  it.each([
    ['before the first place', 'a', -1],
    ['past the last place', 'c', 3],
    ['for a project not shown', 'x', 1],
  ])('changes nothing %s', (_label, id, to) => {
    expect(moveAmongShown(full, shown, id, to)).toBe(full);
  });
});
