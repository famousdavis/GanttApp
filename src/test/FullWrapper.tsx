// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

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
