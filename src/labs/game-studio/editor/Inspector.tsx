// The Inspector: the selected node's real properties, with the right control for
// each type (the specification's §12–13), generated from the registry. Every change
// is a command. While the game runs, each property also shows its live value from
// the game, marked as not saved (ADR 9). The Code section shows the call that would
// make this node as it is now.

import React, { useEffect } from 'react';
import type { Store } from './store';
import { Btn, C, NumberField, Row, Section, TextField, selectStyle, useStore } from './kit';
import { lineage, nodeType, propValue, type PropDef } from '../core/registry';
import { pathOf, parentOf } from '../core/project';
import { lit } from '../core/doc';
import type { PropValue, Vec2 } from '../core/types';

const DEG = 180 / Math.PI;
const SECTION: Record<string, string> = { Node2D: 'Transform', Sprite2D: 'Sprite', CharacterBody2D: 'Body' };

function liveText(v: unknown, def: PropDef): string | undefined {
  if (v === undefined) return undefined;
  if (def.type === 'vec2') { const q = v as Vec2; return `${+q.x.toFixed(1)}, ${+q.y.toFixed(1)}`; }
  if (def.type === 'angle') return `${+((v as number) * DEG).toFixed(1)}°`;
  return String(v);
}

export function Inspector({ store }: { store: Store }) {
  useStore(store);
  const s = store.scene, n = store.selected, p = store.project;
  // While running, ask the game for live values a few times a second.
  const running = !!store.running;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => store.refreshLive(), 250);
    return () => clearInterval(t);
  }, [running, store]);
  if (!p) return null;
  if (!s || !n) return <div style={{ padding: 12, color: C.faint, fontSize: 12 }}>Select a node in the scene tree or the viewport.</div>;

  const set = (name: string, v: PropValue) => store.act((d) => d.setProp(s.id, n.id, name, v, `Set ${n.name}.${name}`));
  const live = store.running?.live ?? null;

  const control = (def: PropDef) => {
    const v = propValue(n.type, n.props, def.name);
    const lv = live ? liveText(live[def.name], def) : undefined;
    const help = def.help;
    switch (def.type) {
      case 'vec2': {
        const q = v as Vec2;
        return <Row key={def.name} label={def.name} help={help} live={lv}>
          <NumberField testid={`prop-${def.name}-x`} label="x" color={C.x} value={q.x} step={def.step ?? 1} digits={3} onCommit={(x) => set(def.name, { x, y: q.y })} />
          <NumberField testid={`prop-${def.name}-y`} label="y" color={C.y} value={q.y} step={def.step ?? 1} digits={3} onCommit={(y) => set(def.name, { x: q.x, y })} />
        </Row>;
      }
      case 'angle':
        return <Row key={def.name} label={def.name} help={`${help} Type degrees here.`} live={lv}>
          <NumberField testid={`prop-${def.name}`} value={(v as number) * DEG} step={1} digits={2} onCommit={(d) => set(def.name, d / DEG)} /><span style={{ color: C.faint }}>°</span>
        </Row>;
      case 'number':
        return <Row key={def.name} label={def.name} help={help} live={lv}>
          <NumberField testid={`prop-${def.name}`} value={v as number} step={def.step ?? 1} onCommit={(x) => set(def.name, Math.min(def.max ?? Infinity, Math.max(def.min ?? -Infinity, x)))} />
          {def.min !== undefined && def.max !== undefined && <input type="range" min={def.min} max={def.max} step={def.step ?? 0.01} value={v as number} onChange={(e) => set(def.name, Number(e.target.value))} style={{ flex: 1, minWidth: 40 }} />}
        </Row>;
      case 'bool':
        return <Row key={def.name} label={def.name} help={help} live={lv}><input data-testid={`prop-${def.name}`} type="checkbox" checked={v as boolean} onChange={(e) => set(def.name, e.target.checked)} /></Row>;
      case 'texture': {
        const img = store.imageFor(v as string | null);
        return <Row key={def.name} label={def.name} help={help}>
          <select data-testid={`prop-${def.name}`} value={(v as string) ?? ''} onChange={(e) => set(def.name, e.target.value || null)} style={{ ...selectStyle, flex: 1 }}>
            <option value="">(none)</option>
            {p.assets.map((a) => <option key={a.id} value={a.path}>{a.path.replace(/^assets\//, '')}</option>)}
          </select>
          {img && <img src={img.src} alt="" style={{ width: 22, height: 22, objectFit: 'contain', imageRendering: 'pixelated', background: C.bg }} />}
        </Row>;
      }
      case 'color':
        return <Row key={def.name} label={def.name} help={help}><input type="color" value={v as string} onChange={(e) => set(def.name, e.target.value)} /></Row>;
      case 'string':
        return <Row key={def.name} label={def.name} help={help} live={lv}><TextField testid={`prop-${def.name}`} value={v as string} onCommit={(x) => set(def.name, x)} /></Row>;
    }
  };

  const isRoot = n.id === s.root.id;
  const parentPath = isRoot ? null : pathOf(s, parentOf(s, n.id)!.id);
  const code = isRoot
    ? `scene = project.createScene(${lit(s.path)}, ${lit(n.type)}, ${lit(n.name)})`
    : `scene.add(${lit(n.type)}, ${lit({ name: n.name, ...(parentPath !== '.' ? { parent: parentPath } : {}), ...n.props, ...(n.script ? { script: n.script } : {}) })})`;

  return (
    <div data-testid="inspector" style={{ fontSize: 12 }}>
      <div style={{ padding: '8px 8px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 15 }}>{nodeType(n.type).icon}</span>
        <div style={{ flex: 1 }}><TextField testid="node-name" value={n.name} onCommit={(v) => store.act((d) => d.rename(s.id, n.id, v))} /></div>
      </div>
      <div title={nodeType(n.type).help} style={{ padding: '0 8px 6px', color: C.faint }}>{lineage(n.type).map((t) => t.type).join(' › ')}</div>
      {running && <div style={{ margin: '0 8px 6px', color: C.live, fontSize: 11 }}>Purple values are the running game&apos;s. They are not saved: stopping the game puts the editor&apos;s values back in charge.</div>}
      {lineage(n.type).filter((t) => t.props.length).map((t) => (
        <Section key={t.type} title={SECTION[t.type] ?? t.type}>{t.props.map(control)}</Section>
      ))}
      <Section title="Script">
        {n.script ? (
          <>
            <Row label="file"><span style={{ fontFamily: C.mono, color: C.warn }}>{n.script}</span></Row>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <Btn small testid="open-script" onClick={() => store.openScript(n.script!)}>Open</Btn>
              <Btn small onClick={() => store.act((d) => d.setScript(s.id, n.id, null))}>Detach</Btn>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <Btn small testid="new-script" onClick={() => store.newScriptFor(n.id)} title="A new JavaScript file for this node, from a template">New script</Btn>
            {p.scripts.length > 0 && (
              <select value="" onChange={(e) => e.target.value && store.act((d) => d.setScript(s.id, n.id, e.target.value))} style={selectStyle}>
                <option value="">Attach existing…</option>
                {p.scripts.map((x) => <option key={x.path} value={x.path}>{x.path}</option>)}
              </select>
            )}
          </div>
        )}
      </Section>
      <Section title="Code">
        <div style={{ color: C.faint, marginBottom: 4 }}>The Scene API call that makes this node as it is now:</div>
        <pre data-testid="node-code" style={{ margin: 0, padding: 6, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 3, fontFamily: C.mono, fontSize: 11, color: C.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{code}</pre>
      </Section>
    </div>
  );
}
