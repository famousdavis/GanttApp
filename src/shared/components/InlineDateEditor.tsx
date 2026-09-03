// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Inline date editor for SVG foreignObject - used in chart for date labels

interface InlineDateEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** ✓ button and Enter. An invalid date keeps the editor open so it can be fixed. */
  onSave: () => void;
  /**
   * v0.28.16 — blur. Commits when valid, discards when invalid, always closes.
   * Distinct from onSave: routing blur through onSave would leave an editor open
   * on an invalid value, following the user's focus around the page.
   */
  onCommit: () => void;
  onCancel: () => void;
  hasError: boolean;
  /** v16.3: optional non-workday warning message shown in amber beneath the input. */
  warning?: string;
}

export function InlineDateEditor({ value, onChange, onSave, onCommit, onCancel, hasError, warning }: InlineDateEditorProps) {
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
          // v0.28.16: blur COMMITS (or discards an invalid value). Clicking away
          // used to destroy the edit — invisibly, since a wrong date just moves a
          // bar a few pixels on a months-long chart.
          onBlur={onCommit}
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
