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
