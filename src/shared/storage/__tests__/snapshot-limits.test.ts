// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { MAX_SNAPSHOTS_TOTAL, MAX_SNAPSHOTS_PER_PROJECT } from '../snapshot-limits';

describe('snapshot-limits', () => {
  it('exports MAX_SNAPSHOTS_TOTAL = 100', () => {
    expect(MAX_SNAPSHOTS_TOTAL).toBe(100);
  });

  it('exports MAX_SNAPSHOTS_PER_PROJECT = 50', () => {
    expect(MAX_SNAPSHOTS_PER_PROJECT).toBe(50);
  });

  it('per-project cap does not exceed workspace cap', () => {
    expect(MAX_SNAPSHOTS_PER_PROJECT).toBeLessThanOrEqual(MAX_SNAPSHOTS_TOTAL);
  });
});
