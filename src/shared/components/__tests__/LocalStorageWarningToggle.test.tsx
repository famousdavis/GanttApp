// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocalStorageWarningToggle } from '../LocalStorageWarningToggle';
import { LIGHT_THEME } from '../../utils/theme';

const mockUseStorage = vi.fn();
vi.mock('../../../context/StorageContext', () => ({
  useStorage: () => mockUseStorage(),
}));

const SUPPRESS_KEY = 'ganttapp-suppress-local-warning';

describe('LocalStorageWarningToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('default-on behavior', () => {
    it('renders checked when SUPPRESS_KEY is absent', () => {
      mockUseStorage.mockReturnValue({ mode: 'local' });
      render(<LocalStorageWarningToggle colors={LIGHT_THEME} />);
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    it('renders unchecked when SUPPRESS_KEY === "true"', () => {
      localStorage.setItem(SUPPRESS_KEY, 'true');
      mockUseStorage.mockReturnValue({ mode: 'local' });
      render(<LocalStorageWarningToggle colors={LIGHT_THEME} />);
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it('renders checked when SUPPRESS_KEY === "false"', () => {
      localStorage.setItem(SUPPRESS_KEY, 'false');
      mockUseStorage.mockReturnValue({ mode: 'local' });
      render(<LocalStorageWarningToggle colors={LIGHT_THEME} />);
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('writes to localStorage on change', () => {
    it('unchecking writes "true" (suppressed)', () => {
      mockUseStorage.mockReturnValue({ mode: 'local' });
      render(<LocalStorageWarningToggle colors={LIGHT_THEME} />);
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(localStorage.getItem(SUPPRESS_KEY)).toBe('true');
    });

    it('checking writes "false" (not suppressed)', () => {
      localStorage.setItem(SUPPRESS_KEY, 'true');
      mockUseStorage.mockReturnValue({ mode: 'local' });
      render(<LocalStorageWarningToggle colors={LIGHT_THEME} />);
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(localStorage.getItem(SUPPRESS_KEY)).toBe('false');
    });
  });

  describe('mode visibility', () => {
    it('renders in local mode by default', () => {
      mockUseStorage.mockReturnValue({ mode: 'local' });
      render(<LocalStorageWarningToggle colors={LIGHT_THEME} />);
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    it('does NOT render in cloud mode by default', () => {
      mockUseStorage.mockReturnValue({ mode: 'cloud' });
      const { container } = render(<LocalStorageWarningToggle colors={LIGHT_THEME} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders in cloud mode when alwaysVisible is true', () => {
      mockUseStorage.mockReturnValue({ mode: 'cloud' });
      render(<LocalStorageWarningToggle colors={LIGHT_THEME} alwaysVisible />);
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });
  });
});
