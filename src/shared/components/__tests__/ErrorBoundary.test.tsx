// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// ErrorBoundary tests (v0.29.10) — an error thrown while rendering one view
// is caught there: the rest of the page stays, and "Try again" renders the
// view afresh. Before v0.29.10 there was no boundary, so a render error
// unmounted the whole app.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';
import { LIGHT_THEME } from '../../utils/theme';

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: LIGHT_THEME, resolvedTheme: 'light' }),
}));

let shouldThrow = true;

function View() {
  if (shouldThrow) throw new Error('a value the view cannot render');
  return <p>The view</p>;
}

describe('ErrorBoundary', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    shouldThrow = true;
    // React reports a caught render error to console.error, as does the boundary.
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('renders its children when nothing throws', () => {
    shouldThrow = false;
    render(<ErrorBoundary><View /></ErrorBoundary>);
    expect(screen.getByText('The view')).toBeInTheDocument();
  });

  it('shows a notice in place of a view that throws, and leaves the rest of the page', () => {
    render(
      <>
        <header>Header</header>
        <ErrorBoundary><View /></ErrorBoundary>
        <footer>Footer</footer>
      </>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('This view could not be displayed.');
    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledWith('[GanttApp] view error:', 'a value the view cannot render', expect.any(String));
  });

  it('renders the view again on "Try again"', () => {
    render(<ErrorBoundary><View /></ErrorBoundary>);
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('The view')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('starts afresh when its key changes, as on a change of tab or project', () => {
    const { rerender } = render(<ErrorBoundary key="chart:p1"><View /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    shouldThrow = false;
    rerender(<ErrorBoundary key="chart:p2"><View /></ErrorBoundary>);
    expect(screen.getByText('The view')).toBeInTheDocument();
  });
});
