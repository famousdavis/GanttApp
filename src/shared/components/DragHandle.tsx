// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

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
