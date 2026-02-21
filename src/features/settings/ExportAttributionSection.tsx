// Export Attribution section — name and identifier fields for JSON exports

import type { ExportAttribution } from '../../shared/types/firestore';
import type { ThemeColors } from '../../shared/utils/theme';
import { sanitizeString } from '../../shared/utils/validation';

interface ExportAttributionSectionProps {
  colors: ThemeColors;
  exportAttribution: ExportAttribution | undefined;
  onChangeAttribution: (value: ExportAttribution) => void;
}

export function ExportAttributionSection({
  colors, exportAttribution, onChangeAttribution,
}: ExportAttributionSectionProps) {
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
        <label style={{ display: 'block', fontWeight: '600', color: colors.text, marginBottom: '0.25rem' }}>
          Name
        </label>
        <input
          type="text"
          value={exportAttribution?.name ?? ''}
          onChange={(e) => onChangeAttribution({
            name: sanitizeString(e.target.value, 100),
            identifier: exportAttribution?.identifier ?? '',
          })}
          placeholder="e.g., Mark Twain"
          maxLength={100}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontWeight: '600', color: colors.text, marginBottom: '0.25rem' }}>
          Identifier
        </label>
        <input
          type="text"
          value={exportAttribution?.identifier ?? ''}
          onChange={(e) => onChangeAttribution({
            name: exportAttribution?.name ?? '',
            identifier: sanitizeString(e.target.value, 100),
          })}
          placeholder="e.g, student ID, email, or team name"
          maxLength={100}
          style={inputStyle}
        />
      </div>
    </section>
  );
}
