// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { AuthProvider } from '../src/context/AuthContext';
import { StorageProvider } from '../src/context/StorageContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import { AppDataProvider } from '../src/context/AppDataContext';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <StorageProvider>
        <ThemeProvider>
          <AppDataProvider>
            <Component {...pageProps} />
          </AppDataProvider>
        </ThemeProvider>
      </StorageProvider>
    </AuthProvider>
  );
}
