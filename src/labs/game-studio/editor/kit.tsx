// Game Studio's look and small controls: the dense panels of a development tool
// (the specification's §54), matching MeshLab's colours.
import React, { useState, useSyncExternalStore } from 'react';
import { evalExpr } from '../../../engines/mesh/core/expr';
import type { Store } from './store';

export const C = {
  bg: '#16181c', panel: '#1f2227', panel2: '#262a30', raised: '#2d323a', border: '#343942',
  text: '#dfe3ea', dim: '#98a1ae', faint: '#6b7482', accent: '#5aa9ff', warm: '#ff9f1c',
  x: '#ff5c6c', y: '#8bd450', ok: '#6ee7b7', warn: '#fbbf24', bad: '#f87171', live: '#c084fc',
  mono: "ui-monospace, SFMono-Regular, Menlo, 'JetBrains Mono', monospace",
};

/** Re-render when the store changes. */
export function useStore(store: Store): number {
  return useSyncExternalStore(store.subscribe, store.getVersion);
}

export function Btn({ children, onClick, active, title, disabled, small, style, testid }: { children: React.ReactNode; onClick?: () => void; active?: boolean; title?: string; disabled?: boolean; small?: boolean; style?: React.CSSProperties; testid?: string }) {
  return (
    <button type="button" data-testid={testid} title={title} disabled={disabled} onClick={onClick} style={{
      background: active ? C.accent : C.raised, color: active ? '#0b1320' : disabled ? C.faint : C.text,
      border: `1px solid ${active ? C.accent : C.border}`, borderRadius: 3, padding: small ? '1px 6px' : '3px 9px',
      fontSize: small ? 11 : 12, cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap', fontWeight: active ? 600 : 400, lineHeight: 1.5, ...style,
    }}>{children}</button>
  );
}

export function PanelTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', color: C.dim, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, background: C.panel2, borderBottom: `1px solid ${C.border}`, userSelect: 'none' }}>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</span>{right}
    </div>
  );
}

export function Section({ title, children, open = true }: { title: string; children: React.ReactNode; open?: boolean }) {
  const [o, setO] = useState(open);
  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <div onClick={() => setO(!o)} style={{ display: 'flex', gap: 6, padding: '5px 8px', cursor: 'pointer', color: C.dim, fontSize: 11, fontWeight: 600, userSelect: 'none' }}>
        <span style={{ width: 10 }}>{o ? '▾' : '▸'}</span><span>{title}</span>
      </div>
      {o && <div style={{ padding: '2px 8px 8px' }}>{children}</div>}
    </div>
  );
}

export function Row({ label, children, help, live }: { label: string; children: React.ReactNode; help?: string; live?: string }) {
  return (
    <div title={help} style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 24 }}>
      <span style={{ width: 78, color: C.dim, fontSize: 12, flexShrink: 0 }}>{label}</span>
      <span style={{ display: 'flex', gap: 4, alignItems: 'center', flex: 1, minWidth: 0 }}>{children}</span>
      {live !== undefined && <span title="The value in the running game (not saved)" style={{ color: C.live, fontFamily: C.mono, fontSize: 11 }}>{live}</span>}
    </div>
  );
}

/**
 * A number box that keeps its own text while you type and commits once when you
 * leave it (Enter leaves it). Committing on both Enter and blur recorded every edit twice.
 * Accepts arithmetic: "pi/4", "2*16", "sqrt(2)". Drag the label to scrub.
 */
export function NumberField({ value, onCommit, label, color, digits = 3, step = 1, width = 62, testid }: { value: number; onCommit: (v: number) => void; label?: string; color?: string; digits?: number; step?: number; width?: number; testid?: string }) {
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
    const at = (x: number) => +(v0 + Math.round((x - x0) / 4) * step).toFixed(digits);
    const move = (ev: PointerEvent) => setText(String(at(ev.clientX)));
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      setText(null); const v = at(ev.clientX); if (v !== v0) onCommit(v);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {label && <span onPointerDown={scrub} title="Drag to change" style={{ color: color ?? C.dim, fontSize: 11, fontWeight: 700, cursor: 'ew-resize', userSelect: 'none', width: 9 }}>{label}</span>}
      <input
        data-testid={testid}
        value={shown}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setText(null); setBad(false); } e.stopPropagation(); }}
        style={{ width, background: C.bg, color: C.text, border: `1px solid ${bad ? C.bad : C.border}`, borderRadius: 3, padding: '2px 4px', fontFamily: C.mono, fontSize: 12 }}
      />
    </label>
  );
}

export function TextField({ value, onCommit, width = '100%', testid }: { value: string; onCommit: (v: string) => void; width?: number | string; testid?: string }) {
  const [text, setText] = useState<string | null>(null);
  const commit = () => { if (text !== null && text !== value) onCommit(text); setText(null); };
  return (
    <input data-testid={testid} value={text ?? value} onChange={(e) => setText(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setText(null); e.stopPropagation(); }}
      style={{ width, background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2px 5px', fontSize: 12 }} />
  );
}

export const selectStyle: React.CSSProperties = { background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 3, fontSize: 12, padding: '2px 4px', minWidth: 0 };
