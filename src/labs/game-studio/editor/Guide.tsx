// The guide beside an example: what to look at and try, in order. Collapses to its title.
import React, { useState } from 'react';
import type { Store } from './store';
import { C, useStore } from './kit';

export function Guide({ store }: { store: Store }) {
  useStore(store);
  const [open, setOpen] = useState(true);
  const ex = store.guide;
  if (!ex || !store.project) return null;
  return (
    <div data-testid="guide" style={{ position: 'absolute', right: 10, top: 10, width: 330, maxWidth: 'calc(100% - 20px)', background: '#16181cf0', border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 12, color: C.dim, lineHeight: 1.5, zIndex: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <b style={{ color: C.text, flex: 1 }}>Example: {ex.title}</b>
        <button type="button" onClick={() => setOpen(!open)} title={open ? 'Collapse' : 'Show the guide'} style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer' }}>{open ? '▾' : '▸'}</button>
        <button type="button" onClick={() => { store.guide = null; store.changed(); }} title="Close the guide" style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer', fontSize: 14 }}>×</button>
      </div>
      {open && (
        <>
          <div style={{ margin: '4px 0 6px' }}>{ex.blurb}</div>
          <div style={{ color: C.text, fontWeight: 600, fontSize: 11, letterSpacing: 0.4 }}>LOOK AND TRY</div>
          <ol style={{ margin: '4px 0 4px 18px', padding: 0 }}>
            {ex.guide.map((g, i) => <li key={i} style={{ marginBottom: 4 }}>{g}</li>)}
          </ol>
          <div style={{ color: C.faint, fontSize: 11 }}>Art: {ex.art}.</div>
        </>
      )}
    </div>
  );
}
