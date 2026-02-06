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
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave();
          if (e.key === 'Escape') onCancel();
        }}
        onBlur={onCancel}
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
