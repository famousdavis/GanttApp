import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { StorageProvider, useStorage } from '../StorageContext';
import { AuthProvider } from '../AuthContext';

// Mock firebase modules
vi.mock('../../lib/firebase', () => ({
  auth: null,
  db: null,
  isFirebaseAvailable: false,
}));

const mockOnAuthStateChanged = vi.fn();
vi.mock('firebase/auth', () => {
  class MockGoogleAuthProvider { addScope = vi.fn(); }
  class MockOAuthProvider { addScope = vi.fn(); constructor(_id: string) {} }
  return {
    onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    GoogleAuthProvider: MockGoogleAuthProvider,
    OAuthProvider: MockOAuthProvider,
  };
});

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  collection: vi.fn(),
  writeBatch: vi.fn(() => ({ set: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) })),
}));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <StorageProvider>{children}</StorageProvider>
    </AuthProvider>
  );
}

describe('StorageContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: null) => void) => {
      callback(null);
      return vi.fn();
    });
  });

  it('provides storage service with mode "local" by default', () => {
    const { result } = renderHook(() => useStorage(), { wrapper });
    expect(result.current.mode).toBe('local');
    expect(result.current.storage.mode).toBe('local');
  });

  it('throws when useStorage is used outside StorageProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useStorage());
    }).toThrow('useStorage must be used within StorageProvider');

    consoleSpy.mockRestore();
  });

  it('provides a stable storage instance across re-renders', () => {
    const { result, rerender } = renderHook(() => useStorage(), { wrapper });

    const firstInstance = result.current.storage;
    rerender();
    const secondInstance = result.current.storage;

    expect(firstInstance).toBe(secondInstance);
  });

  it('storage service can load and save app data', async () => {
    const { result } = renderHook(() => useStorage(), { wrapper });

    const data = {
      projects: [{ id: 'p1', name: 'Test' }],
      releases: [],
    };

    await result.current.storage.saveAppData(data);
    const loaded = await result.current.storage.loadAppData();

    expect(loaded).not.toBeNull();
    expect(loaded!.projects[0].name).toBe('Test');
  });

  it('storage service can load and save snapshots', async () => {
    const { result } = renderHook(() => useStorage(), { wrapper });

    const snapshots = [{
      id: 'snap1',
      projectId: 'p1',
      timestamp: '2026-01-15T10:00:00.000Z',
      name: 'Sprint 1',
      releases: [],
    }];

    await result.current.storage.saveSnapshots(snapshots);
    const loaded = await result.current.storage.loadSnapshots();

    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('Sprint 1');
  });

  it('exposes switchMode function', () => {
    const { result } = renderHook(() => useStorage(), { wrapper });
    expect(typeof result.current.switchMode).toBe('function');
  });

  it('exposes isSwitching and switchError', () => {
    const { result } = renderHook(() => useStorage(), { wrapper });
    expect(result.current.isSwitching).toBe(false);
    expect(result.current.switchError).toBeNull();
  });

  it('switchMode to cloud fails when Firebase is unavailable', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useStorage(), { wrapper });

    await act(async () => {
      await result.current.switchMode('cloud');
    });

    await waitFor(() => {
      expect(result.current.switchError).toBe('Firebase is not configured. Cloud features are unavailable.');
    });
    expect(result.current.mode).toBe('local');
    consoleSpy.mockRestore();
  });

  // v12.0: New context fields
  it('exposes uploadResult as null initially', () => {
    const { result } = renderHook(() => useStorage(), { wrapper });
    expect(result.current.uploadResult).toBeNull();
  });

  it('exposes clearUploadResult function', () => {
    const { result } = renderHook(() => useStorage(), { wrapper });
    expect(typeof result.current.clearUploadResult).toBe('function');
  });

  it('exposes needsUploadPrompt as null initially', () => {
    const { result } = renderHook(() => useStorage(), { wrapper });
    expect(result.current.needsUploadPrompt).toBeNull();
  });

  it('exposes confirmUploadPrompt and skipUploadPrompt functions', () => {
    const { result } = renderHook(() => useStorage(), { wrapper });
    expect(typeof result.current.confirmUploadPrompt).toBe('function');
    expect(typeof result.current.skipUploadPrompt).toBe('function');
  });
});
