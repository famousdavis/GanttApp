// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Reusable drag handle component (6 dots, 2x3 grid). v0.23.0 — matches
// the SPERT Suite convention; previous releases used 3 dots in a single column.

const DOT: React.CSSProperties = {
  width: '4px',
  height: '4px',
  borderRadius: '50%',
  background: '#999'
};

export function DragHandle() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 4px)',
        gridTemplateRows: 'repeat(3, 4px)',
        gap: '2px',
        cursor: 'grab'
      }}
    >
      <div style={DOT}></div>
      <div style={DOT}></div>
      <div style={DOT}></div>
      <div style={DOT}></div>
      <div style={DOT}></div>
      <div style={DOT}></div>
    </div>
  );
}
