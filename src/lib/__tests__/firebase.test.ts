// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';

// Firebase tests — since env vars are not set in test environment,
// all exports should be null/false.

describe('firebase', () => {
  it('exports null db when env vars are missing', async () => {
    const { db } = await import('../firebase');
    expect(db).toBeNull();
  });

  it('exports null auth when env vars are missing', async () => {
    const { auth } = await import('../firebase');
    expect(auth).toBeNull();
  });

  it('exports isFirebaseAvailable as false when env vars are missing', async () => {
    const { isFirebaseAvailable } = await import('../firebase');
    expect(isFirebaseAvailable).toBe(false);
  });
});
