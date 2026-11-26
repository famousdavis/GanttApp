// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The outermost crash screen (FRAME26 clean-up E, v0.35.0; contract §7 "Errors"): outside the frame and every provider,
// on the page ground in the app's own theme, with Reload, and no error text.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CrashScreen } from '../CrashScreen';

function Boom(): never {
  throw new Error('a secret value from the data');
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  vi.restoreAllMocks();
});

describe('CrashScreen', () => {
  it('renders its children while nothing throws', () => {
    render(<CrashScreen><p>the app</p></CrashScreen>);
    expect(screen.getByText('the app')).toBeInTheDocument();
    expect(document.querySelector('[data-crash-screen]')).toBeNull();
  });

  it.each([
    ['light', null, 'rgb(255, 255, 255)', 'rgb(51, 51, 51)'],
    ['dark', 'dark', 'rgb(16, 24, 40)', 'rgb(226, 232, 240)'],
  ] as const)('%s: a child that throws gives the screen on the page ground, in the page text', (_t, attr, ground, text) => {
    if (attr) document.documentElement.setAttribute('data-theme', attr);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<CrashScreen><Boom /></CrashScreen>);
    const screenEl = document.querySelector<HTMLElement>('[data-crash-screen]')!;
    expect(screenEl).not.toBeNull();
    expect(screenEl.getAttribute('role')).toBe('alert');
    expect(screenEl.style.background).toBe(ground);
    expect(screenEl.style.color).toBe(text);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Something went wrong');
    expect(screenEl.querySelector('p')!.textContent).toBe('GanttApp™ could not display this page. Reload to try again.');
    expect(screenEl.querySelector('p .sf-mark.sf-mark--tm')!.textContent).toBe('™');
    // No error text on screen, nor in the boundary's own log line (React's development build logs the error itself).
    expect(screenEl.textContent).not.toContain('secret');
    const own = log.mock.calls.map(c => c.join(' ')).filter(l => l.includes('[crash-screen]'));
    expect(own).toEqual(['[crash-screen] Error']);
  });

  it('Reload reloads', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onReload = vi.fn();
    render(<CrashScreen onReload={onReload}><Boom /></CrashScreen>);
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('pages/_app.tsx wraps every provider in it, outside them all', () => {
    const app = readFileSync(join(process.cwd(), 'pages', '_app.tsx'), 'utf8');
    const crash = app.indexOf('<CrashScreen>');
    expect(crash).toBeGreaterThan(-1);
    for (const p of ['<AuthProvider>', '<StorageProvider>', '<ThemeProvider>', '<AppDataProvider>', '<Component']) {
      expect(app.indexOf(p), p).toBeGreaterThan(crash);
      expect(app.indexOf(p), p).toBeLessThan(app.indexOf('</CrashScreen>'));
    }
  });
});
