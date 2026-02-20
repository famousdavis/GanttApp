import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsTab } from '../SettingsTab';
import { FullWrapper } from '../../../test/FullWrapper';

// Mock firebase module
vi.mock('../../../lib/firebase', () => ({
  auth: null,
  db: null,
  isFirebaseAvailable: false,
}));

// Mock firebase/auth
vi.mock('firebase/auth', () => {
  class MockGoogleAuthProvider { addScope = vi.fn(); }
  class MockOAuthProvider { addScope = vi.fn(); constructor() {} }
  return {
    onAuthStateChanged: vi.fn((_auth: unknown, callback: (user: null) => void) => {
      callback(null);
      return vi.fn();
    }),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    GoogleAuthProvider: MockGoogleAuthProvider,
    OAuthProvider: MockOAuthProvider,
  };
});

// Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(),
}));

describe('SettingsTab', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(<SettingsTab />, { wrapper: FullWrapper });
    expect(container.firstChild).toBeTruthy();
  });

  it('renders the Settings heading', () => {
    render(<SettingsTab />, { wrapper: FullWrapper });
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('renders Storage section', () => {
    render(<SettingsTab />, { wrapper: FullWrapper });
    expect(screen.getByText('Storage')).toBeTruthy();
  });

  it('renders Local and Cloud radio buttons', () => {
    render(<SettingsTab />, { wrapper: FullWrapper });
    expect(screen.getByText('Local')).toBeTruthy();
    expect(screen.getByText('Cloud')).toBeTruthy();
  });

  it('renders Account section', () => {
    render(<SettingsTab />, { wrapper: FullWrapper });
    expect(screen.getByText('Account')).toBeTruthy();
  });

  it('renders Export Attribution section', () => {
    render(<SettingsTab />, { wrapper: FullWrapper });
    expect(screen.getByText('Export Attribution')).toBeTruthy();
  });

  it('renders Name and Identifier input fields', () => {
    render(<SettingsTab />, { wrapper: FullWrapper });
    expect(screen.getByPlaceholderText(/Mark Twain/)).toBeTruthy();
    expect(screen.getByPlaceholderText(/student ID, email, or team name/)).toBeTruthy();
  });

  it('shows sign-in buttons when not authenticated', () => {
    render(<SettingsTab />, { wrapper: FullWrapper });
    expect(screen.getByText('Sign in with Google')).toBeTruthy();
    expect(screen.getByText('Sign in with Microsoft')).toBeTruthy();
  });

  it('shows Firebase unavailable message when Firebase is not configured', () => {
    render(<SettingsTab />, { wrapper: FullWrapper });
    expect(screen.getByText(/Firebase is not configured/)).toBeTruthy();
  });

  it('has Local radio checked by default', () => {
    render(<SettingsTab />, { wrapper: FullWrapper });
    const radios = screen.getAllByRole('radio');
    const localRadio = radios.find(r => (r as HTMLInputElement).value === 'local') as HTMLInputElement;
    expect(localRadio.checked).toBe(true);
  });

  it('disables Cloud radio when Firebase is unavailable', () => {
    render(<SettingsTab />, { wrapper: FullWrapper });
    const radios = screen.getAllByRole('radio');
    const cloudRadio = radios.find(r => (r as HTMLInputElement).value === 'cloud') as HTMLInputElement;
    expect(cloudRadio.disabled).toBe(true);
  });

  it('disables sign-in buttons when Firebase is unavailable', () => {
    render(<SettingsTab />, { wrapper: FullWrapper });
    const googleBtn = screen.getByText('Sign in with Google');
    expect((googleBtn as HTMLButtonElement).disabled).toBe(true);
    const msBtn = screen.getByText('Sign in with Microsoft');
    expect((msBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
