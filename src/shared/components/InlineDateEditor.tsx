// Inline date editor for SVG foreignObject - used in chart for date labels

interface InlineDateEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  hasError: boolean;
}

export function InlineDateEditor({ value, onChange, onSave, onCancel, hasError }: InlineDateEditorProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      <input
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
  );
}
