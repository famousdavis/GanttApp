// Test wrapper that provides ThemeContext for components that need it

import { ReactNode } from 'react';
import { ThemeProvider } from '../context/ThemeContext';

export function ThemeWrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
