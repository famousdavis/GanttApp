// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerSignOutCleanup, runSignOutCleanup } from '../signOutCleanupRegistry';

describe('signOutCleanupRegistry', () => {
  beforeEach(() => {
    // Ensure each test starts with an empty registry.
    // Register a no-op then deregister it to clear any lingering state.
    const clear = registerSignOutCleanup(async () => {});
    clear();
  });

  it('register → runSignOutCleanup calls the registered fn and returns wasRegistered: true', async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    registerSignOutCleanup(cleanup);

    const result = await runSignOutCleanup();

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ wasRegistered: true });
  });

  it('deregister → runSignOutCleanup returns wasRegistered: false and does not call fn', async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const deregister = registerSignOutCleanup(cleanup);

    deregister();

    const result = await runSignOutCleanup();

    expect(cleanup).not.toHaveBeenCalled();
    expect(result).toEqual({ wasRegistered: false });
  });

  it('re-register replaces the previous fn', async () => {
    const first = vi.fn().mockResolvedValue(undefined);
    const second = vi.fn().mockResolvedValue(undefined);

    registerSignOutCleanup(first);
    registerSignOutCleanup(second);

    await runSignOutCleanup();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('run with throwing fn resolves with wasRegistered: true (error swallowed)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const throwing = vi.fn().mockRejectedValue(new Error('cleanup failed'));
    registerSignOutCleanup(throwing);

    const result = await runSignOutCleanup();

    expect(throwing).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ wasRegistered: true });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('run with no registration resolves with wasRegistered: false', async () => {
    const result = await runSignOutCleanup();
    expect(result).toEqual({ wasRegistered: false });
  });

  it('deregister only nulls the registration if the current fn matches', async () => {
    // Safety for double-mount: if a stale deregister fires AFTER a new registration,
    // it should not clear the newer registration.
    const first = vi.fn().mockResolvedValue(undefined);
    const second = vi.fn().mockResolvedValue(undefined);

    const deregisterFirst = registerSignOutCleanup(first);
    registerSignOutCleanup(second);
    deregisterFirst(); // should NOT clear `second`

    const result = await runSignOutCleanup();

    expect(second).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ wasRegistered: true });
  });
});
