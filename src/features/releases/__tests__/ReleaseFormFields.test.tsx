// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReleaseFormFields } from '../ReleaseFormFields';
import { LIGHT_THEME } from '../../../shared/utils/theme';

const noWarnings = { startDate: '', earlyFinish: '', lateFinish: '', mostLikely: '' };
const noTouch = { startDate: false, earlyFinish: false, lateFinish: false, mostLikelyFinish: false };

function makeProps(overrides: Partial<Parameters<typeof ReleaseFormFields>[0]> = {}) {
  return {
    releaseName: '',
    setReleaseName: vi.fn(),
    startDate: '',
    setStartDate: vi.fn(),
    earlyFinish: '',
    setEarlyFinish: vi.fn(),
    lateFinish: '',
    setLateFinish: vi.fn(),
    mostLikelyFinish: '',
    setMostLikelyFinish: vi.fn(),
    touchedFields: noTouch,
    errorMessage: '',
    mostLikelyErrorVisible: '',
    warnings: noWarnings,
    colors: LIGHT_THEME,
    ...overrides,
  };
}

describe('ReleaseFormFields', () => {
  it('renders all five field labels', () => {
    render(<ReleaseFormFields {...makeProps()} />);

    expect(screen.getByText('Release Name')).toBeInTheDocument();
    expect(screen.getByText(/Start Date/)).toBeInTheDocument();
    expect(screen.getByText(/Early Finish/)).toBeInTheDocument();
    expect(screen.getByText(/Late Finish/)).toBeInTheDocument();
    expect(screen.getByText(/Most Likely/)).toBeInTheDocument();
  });

  it('displays error message when provided', () => {
    render(<ReleaseFormFields {...makeProps({ errorMessage: 'Start must be before Early Finish' })} />);

    expect(screen.getByText('Start must be before Early Finish')).toBeInTheDocument();
  });

  it('displays most likely error when provided', () => {
    render(<ReleaseFormFields {...makeProps({ mostLikelyErrorVisible: 'Must be between Early and Late' })} />);

    expect(screen.getByText('Must be between Early and Late')).toBeInTheDocument();
  });

  it('displays work-week warnings when provided', () => {
    render(<ReleaseFormFields {...makeProps({
      startDate: '2026-01-04',
      warnings: { startDate: 'Falls on a Saturday', earlyFinish: '', lateFinish: '', mostLikely: '' },
    })} />);

    expect(screen.getByText(/Falls on a Saturday/)).toBeInTheDocument();
  });

  it('does not display warnings when error message is present', () => {
    render(<ReleaseFormFields {...makeProps({
      startDate: '2026-01-04',
      errorMessage: 'Date range error',
      warnings: { startDate: 'Falls on a Saturday', earlyFinish: '', lateFinish: '', mostLikely: '' },
    })} />);

    expect(screen.queryByText(/Falls on a Saturday/)).not.toBeInTheDocument();
    expect(screen.getByText('Date range error')).toBeInTheDocument();
  });
});
