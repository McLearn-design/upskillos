// Shared look and small controls for MeshLab's panels.
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Editor } from '../core/Editor';
import { evalExpr } from '../core/expr';

export const C = {
  bg: '#16181c', panel: '#1f2227', panel2: '#262a30', raised: '#2d323a', border: '#343942',
  text: '#dfe3ea', dim: '#98a1ae', faint: '#6b7482', accent: '#ff9f1c', blue: '#5aa9ff',
  x: '#ff5c6c', y: '#8bd450', z: '#5aa9ff', ok: '#6ee7b7', warn: '#fbbf24', bad: '#f87171',
  mono: "ui-monospace, SFMono-Regular, Menlo, 'JetBrains Mono', monospace",
};

/** Re-render when the editor changes. Live gizmo updates are coalesced to one per frame. */
export function useEditorVersion(editor: Editor): number {
  const snap = useRef(editor.version);
  return useSyncExternalStore(
    (cb) => {
      let raf = 0;
      return editor.subscribe((k) => {
        if (k === 'live' || k === 'frame') { if (!raf) raf = requestAnimationFrame(() => { raf = 0; snap.current = editor.version; cb(); }); return; }
        snap.current = editor.version; cb();
      });
    },
    () => snap.current,
  );
}

export function Btn({ children, onClick, active, title, disabled, small, style }: { children: React.ReactNode; onClick?: () => void; active?: boolean; title?: string; disabled?: boolean; small?: boolean; style?: React.CSSProperties }) {
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} style={{
      background: active ? C.accent : C.raised, color: active ? '#1b1b1b' : disabled ? C.faint : C.text,
      border: `1px solid ${active ? C.accent : C.border}`, borderRadius: 4, padding: small ? '2px 6px' : '4px 9px',
      fontSize: small ? 11 : 12, cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap', fontWeight: active ? 600 : 400, ...style,
    }}>{children}</button>
  );
}

export function Section({ title, children, open = true, right }: { title: string; children: React.ReactNode; open?: boolean; right?: React.ReactNode }) {
  const [o, setO] = useState(open);
  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <div onClick={() => setO(!o)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', cursor: 'pointer', color: C.dim, fontSize: 11, fontWeight: 600, letterSpacing: 0.4, userSelect: 'none', background: C.panel2 }}>
        <span style={{ width: 10 }}>{o ? '▾' : '▸'}</span><span style={{ flex: 1 }}>{title}</span>{right}
      </div>
      {o && <div style={{ padding: '8px 10px' }}>{children}</div>}
    </div>
  );
}

/**
 * A number box that keeps its own text while you type and commits on Enter or
 * blur. Accepts arithmetic: "pi/4", "2*1.5", "sqrt(2)". Drag the label to scrub.
 */
export function NumberField({ value, onCommit, label, color, digits = 3, step = 0.1, width = 64 }: { value: number; onCommit: (v: number) => void; label?: string; color?: string; digits?: number; step?: number; width?: number }) {
  const [text, setText] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  const shown = text ?? (Number.isFinite(value) ? String(+value.toFixed(digits)) : '');
  const commit = () => {
    if (text === null) return;
    const v = evalExpr(text);
    if (v === null) { setBad(true); return; }
    setBad(false); setText(null);
    if (Math.abs(v - value) > 1e-12) onCommit(v);
  };
  const scrub = (e: React.PointerEvent) => {
    const x0 = e.clientX, v0 = value;
    const move = (ev: PointerEvent) => setText(String(+(v0 + Math.round((ev.clientX - x0) / 4) * step).toFixed(digits)));
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      const v = +(v0 + Math.round((ev.clientX - x0) / 4) * step).toFixed(digits);
      setText(null); if (v !== v0) onCommit(v);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {label && <span onPointerDown={scrub} title="Drag to change" style={{ color: color ?? C.dim, fontSize: 11, fontWeight: 700, cursor: 'ew-resize', userSelect: 'none', width: 10 }}>{label}</span>}
      <input
        value={shown}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur(); } if (e.key === 'Escape') { setText(null); setBad(false); (e.target as HTMLInputElement).blur(); } }}
        title="Type a number or an expression such as pi/4"
        style={{ width, background: C.bg, color: bad ? C.bad : C.text, border: `1px solid ${bad ? C.bad : C.border}`, borderRadius: 3, padding: '3px 5px', fontFamily: C.mono, fontSize: 11 }}
      />
    </label>
  );
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, fontSize: 12 }}>
      <span style={{ width: 62, color: C.dim, flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap', alignItems: 'center', minWidth: 0 }}>{children}</div>
    </div>
  );
}

/** A 4×4 matrix, row by row, with the translation column tinted. */
export function MatrixView({ m, note }: { m: ArrayLike<number>; note?: string }) {
  // three.js stores column-major: element (row r, column c) is m[c * 4 + r].
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2px 8px', fontFamily: C.mono, fontSize: 11, textAlign: 'right', padding: '6px 8px', background: C.bg, borderRadius: 4, borderLeft: `2px solid ${C.border}`, borderRight: `2px solid ${C.border}` }}>
        {[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((c) => {
          const v = m[c * 4 + r];
          return <span key={`${r}${c}`} style={{ color: c === 3 && r < 3 ? C.accent : r === 3 ? C.faint : Math.abs(v) < 5e-7 ? C.faint : C.text }}>{(Math.abs(v) < 5e-7 ? 0 : v).toFixed(3)}</span>;
        }))}
      </div>
      {note && <div style={{ color: C.faint, fontSize: 11, marginTop: 4 }}>{note}</div>}
    </div>
  );
}

export function useAutoFocus<T extends HTMLElement>(on: boolean) {
  const r = useRef<T>(null);
  useEffect(() => { if (on) r.current?.focus(); }, [on]);
  return r;
}
