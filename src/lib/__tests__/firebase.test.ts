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
