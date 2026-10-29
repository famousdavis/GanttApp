// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// ErrorBoundary (v0.29.10) — catches an error thrown while rendering the
// current tab, so the header, banners, tabs and footer stay up and the user
// can move to another tab or project. pages/index.tsx keys it on the tab and
// the selected project, so either change starts a fresh view. The suite's
// precedent is spert-scheduler's ErrorBoundary.

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

function ViewErrorNotice({ onRetry }: { onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <div
      role="alert"
      style={{
        border: '1px solid #dc3545',
        borderRadius: '8px',
        padding: '1.25rem',
        margin: '1rem 0',
        color: colors.text,
      }}
    >
      <p style={{ margin: 0, fontWeight: 600 }}>This view could not be displayed.</p>
      <p style={{ margin: '0.5rem 0 1rem', fontSize: '0.9rem', color: colors.textSecondary }}>
        Some of its data could not be shown. Other tabs and projects still work.
      </p>
      <button
        type="button"
        onClick={onRetry}
        style={{
          background: 'transparent',
          color: '#0070f3',
          border: '1px solid #0070f3',
          borderRadius: '4px',
          padding: '0.4rem 1rem',
          fontWeight: 600,
          cursor: 'pointer',
          fontSize: '0.85rem',
        }}
      >
        Try again
      </button>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[GanttApp] view error:', error.message, info.componentStack ?? '');
  }

  private retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) return <ViewErrorNotice onRetry={this.retry} />;
    return this.props.children;
  }
}
