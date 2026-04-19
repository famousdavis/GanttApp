// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerAppDataReset, runAppDataReset } from '../appDataResetRegistry';

describe('appDataResetRegistry', () => {
  beforeEach(() => {
    const clear = registerAppDataReset(() => {});
    clear();
  });

  it('register → runAppDataReset calls the registered fn', () => {
    const reset = vi.fn();
    registerAppDataReset(reset);

    runAppDataReset();

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('deregister → runAppDataReset does not call fn', () => {
    const reset = vi.fn();
    const deregister = registerAppDataReset(reset);

    deregister();
    runAppDataReset();

    expect(reset).not.toHaveBeenCalled();
  });

  it('re-register replaces the previous fn', () => {
    const first = vi.fn();
    const second = vi.fn();

    registerAppDataReset(first);
    registerAppDataReset(second);

    runAppDataReset();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('runAppDataReset with no registration is a no-op (does not throw)', () => {
    expect(() => runAppDataReset()).not.toThrow();
  });

  it('deregister only clears the registration if the current fn matches', () => {
    const first = vi.fn();
    const second = vi.fn();

    const deregisterFirst = registerAppDataReset(first);
    registerAppDataReset(second);
    deregisterFirst(); // should NOT clear `second`

    runAppDataReset();

    expect(second).toHaveBeenCalledTimes(1);
  });
});
