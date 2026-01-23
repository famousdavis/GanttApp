// Reusable drag handle component (3 vertical dots)

export function DragHandle() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      cursor: 'grab'
    }}>
      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#999' }}></div>
      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#999' }}></div>
      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#999' }}></div>
    </div>
  );
}
