// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { AuthProvider } from '../src/context/AuthContext';
import { StorageProvider } from '../src/context/StorageContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import { AppDataProvider } from '../src/context/AppDataContext';

/**
 * Document head lives here, deliberately OUTSIDE the provider tree.
 *
 * `ThemeProvider` returns `null` until it has mounted on the client (the
 * canonical anti-flash pattern — see ThemeContext). During the static export
 * that renders the shell HTML, `mounted` is false, so everything below it —
 * including the page component and any `<Head>` it declares — renders to
 * nothing. A `<Head>` inside the tree therefore never reaches the shell: the
 * served HTML had no <title>, no description and no favicon until JS hydrated.
 *
 * Kept as a sibling of the providers, this renders during export, so the shell
 * carries the title. Do not move it inside a provider that can render null.
 */
export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>GanttApp™ — Split-bar Gantt charts for visualizing release uncertainty</title>
        <meta name="description" content="Simple Gantt chart app with delivery uncertainty visualization" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/spert-favicon-ganttapp.png" />
      </Head>
      <AuthProvider>
        <StorageProvider>
          <ThemeProvider>
            <AppDataProvider>
              <Component {...pageProps} />
            </AppDataProvider>
          </ThemeProvider>
        </StorageProvider>
      </AuthProvider>
    </>
  );
}
