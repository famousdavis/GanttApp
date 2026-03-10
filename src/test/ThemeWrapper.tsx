// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Test wrapper that provides ThemeContext for components that need it

import { ReactNode } from 'react';
import { ThemeProvider } from '../context/ThemeContext';

export function ThemeWrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
