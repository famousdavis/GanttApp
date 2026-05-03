// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// ReleaseFormFields — the 5-field release date form used by both Add and inline Edit in ReleasesTab.
// Extracted from ReleasesTab.tsx in v15.2 for maintainability and independent testability.

import { useId } from 'react';
import type { ThemeColors } from '../../shared/utils/theme';

export interface ReleaseFormFieldsProps {
  releaseName: string;
  setReleaseName: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  earlyFinish: string;
  setEarlyFinish: (v: string) => void;
  lateFinish: string;
  setLateFinish: (v: string) => void;
  mostLikelyFinish: string;
  setMostLikelyFinish: (v: string) => void;
  touchedFields: { startDate: boolean; earlyFinish: boolean; lateFinish: boolean; mostLikelyFinish: boolean };
  errorMessage: string;
  mostLikelyErrorVisible: string;
  warnings: { startDate: string; earlyFinish: string; lateFinish: string; mostLikely: string };
  colors: ThemeColors;
}

export function ReleaseFormFields({
  releaseName,
  setReleaseName,
  startDate,
  setStartDate,
  earlyFinish,
  setEarlyFinish,
  lateFinish,
  setLateFinish,
  mostLikelyFinish,
  setMostLikelyFinish,
  touchedFields,
  errorMessage,
  mostLikelyErrorVisible,
  warnings,
  colors,
}: ReleaseFormFieldsProps) {
  // Determine which fields have errors for highlighting
  const startDateInvalid = touchedFields.startDate && startDate.length === 10 && (startDate < '2000-01-01' || startDate > '2050-12-31');
  const earlyFinishInvalid = touchedFields.earlyFinish && earlyFinish.length === 10 && (earlyFinish < '2000-01-01' || earlyFinish > '2050-12-31');
  const lateFinishInvalid = touchedFields.lateFinish && lateFinish.length === 10 && (lateFinish < '2000-01-01' || lateFinish > '2050-12-31');

  // Stable, instance-scoped ids for label/input association. The Add-form and
  // inline-Edit-form never render simultaneously today (Add hides while Edit
  // is open) but useId() guarantees no duplicate-id collision in either case.
  const baseFieldId = useId();
  const releaseNameId = `${baseFieldId}-name`;
  const startDateId = `${baseFieldId}-start-date`;
  const earlyFinishId = `${baseFieldId}-early-finish`;
  const lateFinishId = `${baseFieldId}-late-finish`;
  const mostLikelyId = `${baseFieldId}-most-likely`;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <label htmlFor={releaseNameId} style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: colors.textSecondary }}>
            Release Name
          </label>
          <input
            id={releaseNameId}
            name="releaseName"
            type="text"
            placeholder="Release name"
            value={releaseName}
            onChange={(e) => setReleaseName(e.target.value)}
            maxLength={100}
            style={{
              padding: '0.75rem',
              fontSize: '1rem',
              border: `2px solid ${colors.inputBorder}`,
              borderRadius: '4px',
              width: '100%',
              background: colors.inputBg,
              color: colors.text
            }}
          />
        </div>
        <div>
          <label htmlFor={startDateId} style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: colors.textSecondary }}>
            Start Date<span style={{ color: '#dc3545', marginLeft: '2px' }}>*</span>
          </label>
          <input
            id={startDateId}
            name="startDate"
            type="date"
            value={startDate}
            className={startDate ? 'has-value' : ''}
            onChange={(e) => setStartDate(e.target.value)}
            min="2000-01-01"
            max="2050-12-31"
            style={{
              padding: '0.75rem',
              fontSize: '1rem',
              border: startDateInvalid ? '2px solid #dc3545' : `2px solid ${colors.inputBorder}`,
              borderRadius: '4px',
              width: '100%',
              background: colors.inputBg,
              color: colors.text
            }}
          />
          {warnings.startDate && !errorMessage && (
            <div style={{ color: '#d97706', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              ⚠ {warnings.startDate}
            </div>
          )}
        </div>
        <div>
          <label htmlFor={earlyFinishId} style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: colors.textSecondary }}>
            Early Finish<span style={{ color: '#dc3545', marginLeft: '2px' }}>*</span>
          </label>
          <input
            id={earlyFinishId}
            name="earlyFinish"
            type="date"
            value={earlyFinish}
            className={earlyFinish ? 'has-value' : ''}
            onChange={(e) => setEarlyFinish(e.target.value)}
            min="2000-01-01"
            max="2050-12-31"
            style={{
              padding: '0.75rem',
              fontSize: '1rem',
              border: earlyFinishInvalid ? '2px solid #dc3545' : `2px solid ${colors.inputBorder}`,
              borderRadius: '4px',
              width: '100%',
              background: colors.inputBg,
              color: colors.text
            }}
          />
          {warnings.earlyFinish && !errorMessage && (
            <div style={{ color: '#d97706', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              ⚠ {warnings.earlyFinish}
            </div>
          )}
        </div>
        <div>
          <label htmlFor={lateFinishId} style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: colors.textSecondary }}>
            Late Finish<span style={{ color: '#dc3545', marginLeft: '2px' }}>*</span>
          </label>
          <input
            id={lateFinishId}
            name="lateFinish"
            type="date"
            value={lateFinish}
            className={lateFinish ? 'has-value' : ''}
            onChange={(e) => setLateFinish(e.target.value)}
            min="2000-01-01"
            max="2050-12-31"
            style={{
              padding: '0.75rem',
              fontSize: '1rem',
              border: lateFinishInvalid ? '2px solid #dc3545' : `2px solid ${colors.inputBorder}`,
              borderRadius: '4px',
              width: '100%',
              background: colors.inputBg,
              color: colors.text
            }}
          />
          {warnings.lateFinish && !errorMessage && (
            <div style={{ color: '#d97706', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              ⚠ {warnings.lateFinish}
            </div>
          )}
        </div>
        <div>
          <label htmlFor={mostLikelyId} style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: colors.textSecondary }}>
            Most Likely <span style={{ fontWeight: 'normal', fontStyle: 'italic', fontSize: '0.8rem' }}>(Opt.)</span>
          </label>
          <input
            id={mostLikelyId}
            name="mostLikelyFinish"
            type="date"
            value={mostLikelyFinish}
            className={mostLikelyFinish ? 'has-value' : ''}
            onChange={(e) => setMostLikelyFinish(e.target.value)}
            min="2000-01-01"
            max="2050-12-31"
            style={{
              padding: '0.75rem',
              fontSize: '1rem',
              border: mostLikelyErrorVisible ? '2px solid #dc3545' : `2px solid ${colors.inputBorder}`,
              borderRadius: '4px',
              width: '100%',
              background: colors.inputBg,
              color: colors.text
            }}
          />
          {warnings.mostLikely && !mostLikelyErrorVisible && (
            <div style={{ color: '#d97706', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              ⚠ {warnings.mostLikely}
            </div>
          )}
        </div>
      </div>

      {(errorMessage || mostLikelyErrorVisible) && (
        <div style={{
          color: '#dc3545',
          fontSize: '0.9rem',
          marginTop: '0.75rem',
          marginBottom: '0.75rem',
          padding: '0.5rem',
          background: '#f8d7da',
          borderRadius: '4px',
          border: '1px solid #f5c6cb'
        }}>
          {errorMessage || mostLikelyErrorVisible}
        </div>
      )}
    </>
  );
}
