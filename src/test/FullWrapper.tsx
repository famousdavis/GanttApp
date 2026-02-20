// Test wrapper that provides the full provider hierarchy:
// AuthProvider > StorageProvider > ThemeProvider > AppDataProvider

import { ReactNode } from 'react';
import { AuthProvider } from '../context/AuthContext';
import { StorageProvider } from '../context/StorageContext';
import { ThemeProvider } from '../context/ThemeContext';
import { AppDataProvider } from '../context/AppDataContext';

export function FullWrapper({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <StorageProvider>
        <ThemeProvider>
          <AppDataProvider>
            {children}
          </AppDataProvider>
        </ThemeProvider>
      </StorageProvider>
    </AuthProvider>
  );
}
