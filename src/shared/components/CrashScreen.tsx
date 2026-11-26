// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { Component, type ReactNode } from 'react';

// The app's outermost crash screen (FRAME26 clean-up, v0.35.0; contract §7 "Errors"). pages/_app.tsx wraps every
// provider in it, so an error the per-view boundary (ErrorBoundary.tsx, inside `main`) cannot catch lands here: one in
// the frame, a provider or the page itself. It stays OUTSIDE the frame on purpose: drawn inside it, a fault in the frame
// would take the crash screen down too. So it uses no context and no frame component, only the page's ground and text
// colours, read from <html data-theme> (set before hydration by pages/_document.tsx, and by ThemeProvider), and one way
// out: Reload. Before v0.35.0 such an error got Next.js's own "Application error: a client-side exception has occurred",
// in the system's colours and with no reload.

const SCREEN = {
  light: { ground: '#ffffff', text: '#333333', muted: '#6a7282', button: '#0070f3' },
  dark: { ground: '#101828', text: '#e2e8f0', muted: '#99a1af', button: '#0070f3' },
} as const;

/** The theme <html> carries now: GanttApp keys dark mode on `data-theme="dark"`. */
export function crashTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function CrashScreenView({ onReload }: { onReload: () => void }) {
  const c = SCREEN[crashTheme()];
  return (
    <div
      role="alert"
      data-crash-screen=""
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
        background: c.ground,
        color: c.text,
        fontFamily: 'var(--sf-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif)',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: '448px' }}>
        <h1 style={{ margin: 0, font: 'inherit', fontSize: '20px', lineHeight: '28px', fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ margin: '8px 0 24px', fontSize: '14px', lineHeight: '20px', color: c.muted }}>
          GanttApp<span className="sf-mark sf-mark--tm">™</span> could not display this page. Reload to try again.
        </p>
        <button
          type="button"
          onClick={onReload}
          style={{
            height: '36px',
            padding: '0 16px',
            border: 0,
            borderRadius: '6px',
            background: c.button,
            color: '#ffffff',
            font: 'inherit',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </div>
    </div>
  );
}

interface Props {
  children: ReactNode;
  /** Tests only: what Reload does. The app reloads the page. */
  onReload?: () => void;
}

export class CrashScreen extends Component<Props, { crashed: boolean }> {
  state = { crashed: false };

  static getDerivedStateFromError(): { crashed: boolean } {
    return { crashed: true };
  }

  componentDidCatch(error: unknown): void {
    // The error's name only: its message can quote a value from the data.
    console.error(`[crash-screen] ${error instanceof Error ? error.name : typeof error}`);
  }

  private reload = () => {
    if (this.props.onReload) this.props.onReload();
    else window.location.reload();
  };

  render() {
    if (this.state.crashed) return <CrashScreenView onReload={this.reload} />;
    return this.props.children;
  }
}
