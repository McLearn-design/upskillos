// The heat map legend: what the colours mean, their range, and quick switches.
import React, { useState } from 'react';
import type { Editor } from '../core/Editor';
import { legendGradient } from '../core/fields';
import { fmt } from '../core/trace';
import { Btn, C, useEditorVersion } from './kit';

export function FieldLegend({ editor }: { editor: Editor }) {
  useEditorVersion(editor);
  const [explain, setExplain] = useState(true);
  const f = editor.field;
  if (!f) return null;
  const { label, meaning, range, diverging, values } = f.result;
  let lo = Infinity, hi = -Infinity;
  for (const v of values) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const clamped = lo < range[0] - 1e-9 || hi > range[1] + 1e-9;
  const kind = f.spec.kind;
  const edit = editor.mode === 'edit';
  return (
    <div data-testid="field-legend" style={{ position: 'absolute', left: 10, bottom: 10, width: 270, maxWidth: 'calc(100% - 20px)', background: '#16181cee', border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 11, color: C.dim, zIndex: 2, lineHeight: 1.45 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <b style={{ color: C.text, flex: 1, fontSize: 12 }}>{label}</b>
        <button onClick={() => setExplain(!explain)} title={explain ? 'Hide the explanation' : 'What do the colours mean?'} style={{ background: 'none', border: 'none', color: explain ? C.accent : C.dim, cursor: 'pointer', fontSize: 12 }}>?</button>
        {editor.mode !== 'weight' && <button onClick={() => editor.clearField()} title="Hide the heat map" style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer', fontSize: 14 }}>×</button>}
      </div>
      <div style={{ height: 12, borderRadius: 3, background: legendGradient(diverging), border: `1px solid ${C.border}` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: C.mono, marginTop: 2, color: C.text }}>
        <span>{fmt(range[0], 3)}</span>{diverging && <span>0</span>}<span>{fmt(range[1], 3)}</span>
      </div>
      {explain && <>
        <div style={{ marginTop: 5 }}>{meaning}</div>
        {clamped && <div style={{ color: C.faint, marginTop: 3 }}>Actual range {fmt(lo, 3)} to {fmt(hi, 3)}; the extremes (corners, poles) are clamped so the rest of the surface shows.</div>}
        <div style={{ color: C.faint, marginTop: 3 }}>{f.mesh.verts.length} vertices{kind === 'weight' ? ': the cage the weights belong to (mirrored, not subdivided), in its current pose' : editor.scene.get(f.objectId)?.modifiers.length && kind !== 'custom' ? ', modifiers applied' : ''}.</div>
      </>}
      {editor.mode !== 'weight' && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 7 }}>
        <Btn small active={kind === 'geodesic'} disabled={!edit} onClick={() => editor.showDistanceFromSelection()} title={edit ? 'Distance from the selected vertices' : 'Enter edit mode and select vertices'}>Distance</Btn>
        <Btn small active={kind === 'mean'} onClick={() => editor.showField({ kind: 'mean' }, f.objectId)} title="Mean curvature">H</Btn>
        <Btn small active={kind === 'gaussian'} onClick={() => editor.showField({ kind: 'gaussian' }, f.objectId)} title="Gaussian curvature">K</Btn>
        <Btn small active={kind === 'coord'} onClick={() => editor.showField({ kind: 'coord', axis: 1 }, f.objectId)} title="Height">y</Btn>
        <Btn small active={editor.showContours} onClick={() => { editor.showContours = !editor.showContours; editor.emit('select'); }} title="Iso-lines: points with equal value">Lines</Btn>
      </div>}
    </div>
  );
}
