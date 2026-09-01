// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The snapshot localStorage layer stays deleted (v0.28.14).
 *
 * `src/shared/utils/snapshots.ts` used to export five functions that read and
 * wrote `localStorage` directly -- loadSnapshots, saveSnapshots, addSnapshot,
 * deleteSnapshot, deleteSnapshotsForProject -- plus the three module constants
 * they needed: SNAPSHOTS_KEY (`ganttAppSnapshots`), MAX_SNAPSHOTS_TOTAL and
 * MAX_SNAPSHOTS_PER_PROJECT. Nothing imported any of them. Persistence has gone
 * through `GanttStorageService` since v10.0, and the two caps have lived in
 * `src/shared/storage/snapshot-limits.ts` ("Single source of truth") since
 * v19.0.0. All eight were deleted in v0.28.14.
 *
 * WHY THIS TEST EXISTS AT ALL. The deletion of the five functions is enforced by
 * the compiler -- remove one that is still imported and `npm run typecheck`
 * names the importer. The three CONSTANTS had no such enforcement: no
 * `no-unused-vars` rule is active in this repo's ESLint config and
 * `tsconfig.json` sets no `noUnusedLocals`, so an orphaned module constant is
 * invisible to lint, typecheck, test AND build. `SNAPSHOTS_KEY` reappearing is
 * the specific regression worth catching, because that string IS the layer:
 * anything writing snapshots to `ganttAppSnapshots` from here is bypassing the
 * storage service and will silently diverge from cloud mode.
 *
 * WHAT THIS DOES NOT GUARD, stated so the gap is not mistaken for coverage: one
 * string in one file. A reimplementation that spells the key differently, or
 * puts it in another module, passes. This is a ratchet on a known regression,
 * not a proof that the layer cannot come back.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const MODULE_PATH = 'src/shared/utils/snapshots.ts';
const source = readFileSync(join(process.cwd(), MODULE_PATH), 'utf-8');

describe('src/shared/utils/snapshots.ts - the localStorage layer stays deleted', () => {
  it('does not name the ganttAppSnapshots localStorage key', () => {
    expect(
      source.includes('ganttAppSnapshots'),
      `${MODULE_PATH} names the localStorage key "ganttAppSnapshots". That key ` +
        `belonged to five direct-localStorage functions deleted in v0.28.14, none ` +
        `of which anything imported. Snapshot persistence goes through ` +
        `GanttStorageService (src/shared/types/storage.ts), which routes to ` +
        `localStorage or Firestore by mode; writing the key from here bypasses ` +
        `that and diverges from cloud mode. Note that nothing else catches this: ` +
        `an orphaned module constant is invisible to lint, typecheck and build.`
    ).toBe(false);
  });
});
