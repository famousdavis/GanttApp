// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Export Attribution section — name and identifier fields for JSON exports

import { useId } from 'react';
import type { ExportAttribution } from '../../shared/types/firestore';
import type { ThemeColors } from '../../shared/utils/theme';
import { sanitizeString } from '../../shared/utils/validation';
import { useBufferedField } from '../../shared/hooks';

interface ExportAttributionSectionProps {
  colors: ThemeColors;
  exportAttribution: ExportAttribution | undefined;
  onChangeAttribution: (value: ExportAttribution) => void;
}

export function ExportAttributionSection({
  colors, exportAttribution, onChangeAttribution,
}: ExportAttributionSectionProps) {
  const baseFieldId = useId();
  const nameId = `${baseFieldId}-name`;
  const identifierId = `${baseFieldId}-identifier`;

  // v0.27.0 (Pass 4, A3): buffered commits on blur/Enter/unmount instead of
  // per-keystroke. Each onCommit composes the full ExportAttribution by
  // merging the committed field with the current value of the other.
  const nameField = useBufferedField({
    storeValue: exportAttribution?.name ?? '',
    onCommit: (v) =>
      onChangeAttribution({
        name: sanitizeString(v, 100),
        identifier: exportAttribution?.identifier ?? '',
      }),
  });
  const identifierField = useBufferedField({
    storeValue: exportAttribution?.identifier ?? '',
    onCommit: (v) =>
      onChangeAttribution({
        name: exportAttribution?.name ?? '',
        identifier: sanitizeString(v, 100),
      }),
  });

  const inputStyle = {
    padding: '0.5rem 0.75rem',
    border: `1px solid ${colors.border}`,
    borderRadius: '4px',
    background: colors.inputBg,
    color: colors.text,
    fontSize: '0.95rem',
    width: '100%',
    maxWidth: '400px',
  };

  return (
    <section style={{ marginBottom: '2rem' }}>
      <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' }}>Export Attribution</h3>
      <p style={{ color: colors.textSecondary, marginBottom: '1rem', lineHeight: '1.6' }}>
        These fields are included when you export data as JSON. They identify who prepared the export.
      </p>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor={nameId} style={{ display: 'block', fontWeight: '600', color: colors.text, marginBottom: '0.25rem' }}>
          Name
        </label>
        <input
          id={nameId}
          name="exportAttributionName"
          type="text"
          value={nameField.draft}
          onChange={nameField.handleChange}
          onFocus={nameField.handleFocus}
          onBlur={nameField.handleBlur}
          onKeyDown={nameField.handleKeyDown}
          placeholder="e.g., Jane Smith"
          maxLength={100}
          autoComplete="name"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor={identifierId} style={{ display: 'block', fontWeight: '600', color: colors.text, marginBottom: '0.25rem' }}>
          Identifier
        </label>
        <input
          id={identifierId}
          name="exportAttributionIdentifier"
          type="text"
          value={identifierField.draft}
          onChange={identifierField.handleChange}
          onFocus={identifierField.handleFocus}
          onBlur={identifierField.handleBlur}
          onKeyDown={identifierField.handleKeyDown}
          placeholder="e.g., student ID, email, or team name"
          maxLength={100}
          style={inputStyle}
        />
      </div>
    </section>
  );
}
