// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Inline date editor for SVG foreignObject - used in chart for date labels

interface InlineDateEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  hasError: boolean;
  /** v16.3: optional non-workday warning message shown in amber beneath the input. */
  warning?: string;
}

export function InlineDateEditor({ value, onChange, onSave, onCancel, hasError, warning }: InlineDateEditorProps) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        <input
          name="inlineDateEdit"
          aria-label="Edit date"
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave();
            if (e.key === 'Escape') onCancel();
          }}
          onBlur={onCancel}
          autoFocus
          min="2000-01-01"
          max="2050-12-31"
          style={{
            fontSize: '11px',
            padding: '2px 4px',
            border: hasError ? '2px solid #dc3545' : '1px solid #0070f3',
            borderRadius: '3px',
            width: '110px'
          }}
        />
        <button
          onMouseDown={(e) => { e.preventDefault(); onSave(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '2px' }}
          title="Save"
        >✅</button>
      </div>
      {warning && !hasError && (
        <div style={{ color: '#d97706', fontSize: '10px', marginTop: '2px', lineHeight: '1.2' }}>
          ⚠ {warning}
        </div>
      )}
    </div>
  );
}
