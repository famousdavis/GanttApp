// Theme Context - Provides light/dark mode support

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useSyncExternalStore } from 'react';
import { ThemeMode, ThemeColors, LIGHT_THEME, DARK_THEME } from '../shared/utils/theme';

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolvedTheme: 'light' | 'dark';
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'gantt-theme';

// Helper to get initial mode from localStorage (runs once during initialization)
function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'light' || saved === 'dark' || saved === 'system') {
    return saved;
  }
  return 'system';
}

// Helper to get system dark preference
function getSystemDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// Subscribe to system preference changes
function subscribeToSystemPreference(callback: () => void) {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Track if we've mounted (client-side)
  const [mounted, setMounted] = useState(false);

  // Use lazy initializer to read from localStorage
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode);

  // Use useSyncExternalStore for system preference to avoid effect-based setState
  const systemDark = useSyncExternalStore(
    subscribeToSystemPreference,
    getSystemDark,
    () => false // SSR fallback
  );

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(THEME_STORAGE_KEY, newMode);
  }, []);

  const resolvedTheme = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
  const colors = resolvedTheme === 'dark' ? DARK_THEME : LIGHT_THEME;

  // Mark as mounted after first render (client-side only)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Apply data-theme attribute to document (this is syncing with an external system, which is allowed)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  // Prevent flash by not rendering children until mounted
  // The _document.tsx script sets data-theme, so CSS works, but we hide
  // React content until it can render with correct theme colors
  if (!mounted) {
    return null;
  }

  return (
    <ThemeContext value={{ mode, setMode, resolvedTheme, colors }}>
      {children}
    </ThemeContext>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
