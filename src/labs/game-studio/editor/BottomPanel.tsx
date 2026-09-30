// The bottom panel: Output (the game's console and errors; click an error to open its
// script at that line) and GUI → code (every editor action as the Scene API call that
// does the same thing, ADR 8).

import React, { useEffect, useRef, useState } from 'react';
import type { Store } from './store';
import { Btn, C, useStore } from './kit';

const COLOR = { log: C.text, info: C.accent, warn: C.warn, error: C.bad, system: C.faint } as const;

export function BottomPanel({ store }: { store: Store }) {
  useStore(store);
  const [tab, setTab] = useState<'output' | 'code'>('output');
  const end = useRef<HTMLDivElement>(null);
  const log = store.doc?.log ?? [];
  const count = tab === 'output' ? store.output.length : log.length;
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [count, tab]);
  const errors = store.output.filter((o) => o.level === 'error').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 6px', background: C.panel2, borderBottom: `1px solid ${C.border}` }}>
        {(['output', 'code'] as const).map((t) => (
          <button key={t} type="button" data-testid={`tab-${t}`} onClick={() => setTab(t)} style={{ background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? C.accent : 'transparent'}`, color: tab === t ? C.text : C.dim, padding: '5px 9px', fontSize: 12, cursor: 'pointer' }}>
            {t === 'output' ? `Output${errors ? ` (${errors} error${errors === 1 ? '' : 's'})` : ''}` : `GUI → code (${log.length})`}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        {tab === 'output' && <Btn small onClick={() => { store.output = []; store.changed(); }}>Clear</Btn>}
        {tab === 'code' && <Btn small onClick={() => void navigator.clipboard?.writeText(log.map((l) => l.code).join('\n'))} title="Copy the whole log as a script">Copy</Btn>}
      </div>
      <div data-testid={`panel-${tab}`} style={{ flex: 1, overflowY: 'auto', fontFamily: C.mono, fontSize: 12, padding: '4px 8px' }}>
        {tab === 'output' && (store.output.length ? store.output.map((o, i) => (
          <div key={i} onClick={() => o.file && store.openScript(o.file, { line: o.line ?? 1, column: o.column ?? 1 })}
            style={{ color: COLOR[o.level], cursor: o.file ? 'pointer' : 'default', whiteSpace: 'pre-wrap', padding: '1px 0' }}>
            {o.level === 'error' ? '✖ ' : o.level === 'warn' ? '▲ ' : ''}
            {o.file && <span style={{ textDecoration: 'underline' }}>{o.file}{o.line ? `:${o.line}:${o.column ?? 1}` : ''}</span>}
            {o.file ? '  ' : ''}{o.text}{o.node ? <span style={{ color: C.faint }}>{`   (node ${o.node})`}</span> : null}
          </div>
        )) : <div style={{ color: C.faint }}>Run the game (F5) to see its console.log output and errors here.</div>)}
        {tab === 'code' && (log.length ? log.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '1px 0' }}>
            <span style={{ color: C.faint, width: 150, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'system-ui', fontSize: 11 }}>{l.label}</span>
            <span style={{ color: C.text, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{l.code}</span>
          </div>
        )) : <div style={{ color: C.faint }}>Everything you do in the editor appears here as the code that does the same thing.</div>)}
        <div ref={end} />
      </div>
    </div>
  );
}
