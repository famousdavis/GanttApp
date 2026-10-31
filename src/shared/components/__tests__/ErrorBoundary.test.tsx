// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// ErrorBoundary tests (v0.29.10) — an error thrown while rendering one view
// is caught there: the rest of the page stays, and "Try again" renders the
// view afresh. Before v0.29.10 there was no boundary, so a render error
// unmounted the whole app. Since v0.29.11 a change of its reset key (the
// selected project) also renders the view again while the notice is shown,
// and leaves a healthy view alone.

import { useState } from 'react';
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

function Counter() {
  const [count, setCount] = useState(0);
  return <button type="button" onClick={() => setCount(c => c + 1)}>Count {count}</button>;
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

  it('starts afresh when its key changes, as on a change of tab', () => {
    const { rerender } = render(<ErrorBoundary key="chart"><View /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    shouldThrow = false;
    rerender(<ErrorBoundary key="releases"><View /></ErrorBoundary>);
    expect(screen.getByText('The view')).toBeInTheDocument();
  });

  it('renders the view again when its reset key changes while the notice is shown, as on a change of project', () => {
    const { rerender } = render(<ErrorBoundary resetKey="p1"><View /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    shouldThrow = false;
    rerender(<ErrorBoundary resetKey="p2"><View /></ErrorBoundary>);
    expect(screen.getByText('The view')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the notice on a re-render with the same reset key', () => {
    const { rerender } = render(<ErrorBoundary resetKey="p1"><View /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    // The view could render now; only a new reset key or "Try again" brings it back.
    shouldThrow = false;
    rerender(<ErrorBoundary resetKey="p1"><View /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('The view')).not.toBeInTheDocument();
  });

  it('keeps a healthy view mounted, with its state, when the reset key changes', () => {
    const { rerender } = render(<ErrorBoundary resetKey="p1"><Counter /></ErrorBoundary>);
    fireEvent.click(screen.getByRole('button', { name: 'Count 0' }));
    expect(screen.getByRole('button', { name: 'Count 1' })).toBeInTheDocument();
    rerender(<ErrorBoundary resetKey="p2"><Counter /></ErrorBoundary>);
    expect(screen.getByRole('button', { name: 'Count 1' })).toBeInTheDocument();
  });

  it('shows the notice once, without retrying, when the view fails on the render that changes the reset key', () => {
    shouldThrow = false;
    const { rerender } = render(<ErrorBoundary resetKey="p1"><View /></ErrorBoundary>);
    expect(screen.getByText('The view')).toBeInTheDocument();
    shouldThrow = true;
    rerender(<ErrorBoundary resetKey="p2"><View /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    const caught = errorSpy.mock.calls.filter((args: unknown[]) => args[0] === '[GanttApp] view error:');
    expect(caught).toHaveLength(1);
  });
});
