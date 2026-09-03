// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Inline text editor for SVG foreignObject - used in chart for release names

interface InlineTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  fontSize?: string;
  width?: string;
}

export function InlineTextEditor({
  value,
  onChange,
  onSave,
  onCancel,
  fontSize = '16px',
  width = '240px'
}: InlineTextEditorProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <input
        name="inlineTextEdit"
        aria-label="Edit text"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave();
          if (e.key === 'Escape') onCancel();
        }}
        // v0.28.16: blur COMMITS. Clicking away used to discard the edit outright
        // — the save button's onMouseDown+preventDefault exists to beat this very
        // handler. saveReleaseNameEdit always closes, so blur cannot trap focus.
        onBlur={onSave}
        autoFocus
        style={{
          fontSize,
          fontWeight: 600,
          border: '1px solid #0070f3',
          padding: '2px 4px',
          width,
          fontFamily: 'inherit'
        }}
      />
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          onSave();
        }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '14px',
          padding: '2px'
        }}
        title="Save"
      >
        ✅
      </button>
    </div>
  );
}
