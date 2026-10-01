// The Animation panel: the timeline of the selected AnimationPlayer (the specification's §38–39).
//
//   toolbar   the animation, new / rename / delete, length, loop, autoplay, preview, the playhead's time
//   ruler     click or drag to move the playhead; the viewport shows the scene at that moment
//   tracks    one row per animated property, its keys as diamonds: click one to edit it, drag to move it
//
// Keys are added from the Inspector's ◆ buttons, at the playhead. Everything here is a command on
// the player's `animations` property, so it undoes in one step and shows in GUI → code. The
// preview uses the same sampling as the game (core/animation.ts).

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Store } from './store';
import { C, NumberField, TextField, selectStyle, useStore } from './kit';
import { trackTarget } from '../core/animation';
import { propDef, propValue } from '../core/registry';
import type { AnimationClip, KeyValue, Vec2 } from '../core/types';

const LABEL = 180;
const PAD = 10;   // between the labels and time 0, so the first key is clear of a track's ×
const small: React.CSSProperties = { background: C.raised, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontSize: 11, cursor: 'pointer', padding: '1px 6px' };

export function Timeline({ store }: { store: Store }) {
  useStore(store);
  const s = store.scene, player = store.animPlayer;
  const lanes = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [sel, setSel] = useState<{ t: number; k: number } | null>(null);
  const [dragKey, setDragKey] = useState<{ t: number; k: number; time: number } | null>(null);
  const scrubbing = useRef(false);

  useLayoutEffect(() => {
    const el = lanes.current; if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el); setWidth(el.clientWidth);
    return () => ro.disconnect();
  });

  // Preview: move the playhead in real time, at the player's speedScale, as the game would.
  const playing = store.anim.playing;
  useEffect(() => {
    if (!playing) return;
    let last = performance.now(), raf = 0;
    const tick = (now: number) => {
      const c = store.animClip, p = store.animPlayer;
      if (!c || !p || !store.anim.playing) { store.anim = { ...store.anim, playing: false }; store.changed(); return; }
      let t = store.anim.time + ((now - last) / 1000) * (propValue(p.type, p.props, 'speedScale') as number);
      last = now;
      let still = true;
      if (c.loop) t %= c.length; else if (t >= c.length) { t = c.length; still = false; }
      store.anim = { ...store.anim, time: t, playing: still };
      store.changed();
      if (still) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, store]);

  if (!s || !player) {
    return <div style={{ color: C.faint, fontFamily: 'system-ui', fontSize: 12, padding: 4 }}>
      Select an AnimationPlayer to edit its animations here (add one with <b>+ Add… › AnimationPlayer</b>, beside the nodes it will animate). Then move the playhead and press ◆ beside a property in the Inspector to key it.
    </div>;
  }
  const clips = store.animClips;
  const clip = clips.find((c) => c.name === store.anim.clip) ?? null;
  const commit = (next: AnimationClip[], label: string, extra: Record<string, unknown> = {}) =>
    store.act((d) => d.setProps(s.id, player.id, { animations: next, ...extra } as never, label));
  const setAnim = (patch: Partial<Store['anim']>) => { store.anim = { ...store.anim, ...patch }; store.changed(); };
  const autoplay = propValue(player.type, player.props, 'autoplay') as string;
  const newName = () => { let k = 1; while (clips.some((c) => c.name === (k === 1 ? 'animation' : `animation${k}`))) k++; return k === 1 ? 'animation' : `animation${k}`; };
  const editClip = (patch: Partial<AnimationClip>, label: string) => clip && commit(clips.map((c) => (c.name === clip.name ? { ...c, ...patch } : c)), label);

  const len = clip?.length ?? 1;
  const pps = Math.max(20, (width - LABEL - PAD - 16) / len);    // pixels per second
  const xOf = (t: number) => LABEL + PAD + t * pps;
  const timeAt = (clientX: number) => { const r = lanes.current!.getBoundingClientRect(); return Math.min(len, Math.max(0, (clientX - r.left - LABEL - PAD) / pps)); };
  const snap = (t: number) => (store.snap ? Math.round(t * 20) / 20 : +t.toFixed(3));   // 0.05 s steps with Snap
  const step = len <= 2 ? 0.1 : len <= 10 ? 0.5 : 1;

  const selKey = clip && sel ? clip.tracks[sel.t]?.keys[sel.k] : undefined;
  const selTrack = clip && sel ? clip.tracks[sel.t] : undefined;
  const selTarget = selTrack ? trackTarget(s, player.id, selTrack.path) : undefined;
  const selDef = selTarget && selTrack ? propDef(selTarget.type, selTrack.property) : undefined;

  const moveKey = (t: number, k: number, time: number) => {
    if (!clip) return;
    const tr = clip.tracks[t];
    const moved = tr.keys[k];
    const keys = tr.keys.filter((_, i) => i !== k).filter((x) => Math.abs(x.time - time) > 5e-4);
    keys.push({ time, value: moved.value }); keys.sort((a, b) => a.time - b.time);
    commit(clips.map((c) => (c.name === clip.name ? { ...c, tracks: c.tracks.map((x, i) => (i === t ? { ...x, keys } : x)) } : c)), `Move a key to ${time} s`);
    setSel({ t, k: keys.findIndex((x) => x.time === time) });
  };
  const setKeyValue = (value: KeyValue) => {
    if (!clip || !sel) return;
    commit(clips.map((c) => (c.name === clip.name ? { ...c, tracks: c.tracks.map((x, i) => (i === sel.t ? { ...x, keys: x.keys.map((kk, j) => (j === sel.k ? { ...kk, value } : kk)) } : x)) } : c)), 'Change a key');
  };

  return (
    <div data-testid="timeline" style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'system-ui', fontSize: 12 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingBottom: 4 }}>
        <b title="The AnimationPlayer being edited">⏯ {player.name}</b>
        <select data-testid="anim-clip" value={clip?.name ?? ''} onChange={(e) => { setSel(null); setAnim({ clip: e.target.value, time: 0, playing: false }); }} style={selectStyle}>
          {!clip && <option value="">(no animation)</option>}
          {clips.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
        <button type="button" data-testid="anim-new" style={small} onClick={() => { const name = newName(); commit([...clips, { name, length: 1, loop: false, tracks: [] }], `New animation ${name}`); setSel(null); setAnim({ clip: name, time: 0, playing: false }); }}>+ New</button>
        {clip && <>
          <span style={{ width: 110 }}><TextField testid="anim-name" value={clip.name} onCommit={(v) => {
            const name = v.trim();
            if (!name || name === clip.name) return;
            if (clips.some((c) => c.name === name)) { store.say(`There is already an animation called "${name}"`); return; }
            commit(clips.map((c) => (c.name === clip.name ? { ...c, name } : c)), `Rename animation to ${name}`, autoplay === clip.name ? { autoplay: name } : {});
            setAnim({ clip: name });
          }} /></span>
          <span style={{ color: C.dim }}>length</span>
          <NumberField testid="anim-length" value={clip.length} step={0.1} width={50} onCommit={(v) => {
            const length = Math.max(0.05, v);
            const dropped = clip.tracks.reduce((n, tr) => n + tr.keys.filter((k) => k.time > length).length, 0);
            if (dropped) store.say(`${dropped} key${dropped === 1 ? '' : 's'} after ${length} s removed`);
            editClip({ length, tracks: clip.tracks.map((tr) => ({ ...tr, keys: tr.keys.filter((k) => k.time <= length) })) }, `Length ${length} s`);
            if (store.anim.time > length) setAnim({ time: length });
          }} /><span style={{ color: C.dim }}>s</span>
          <label title="Start again after the end. Off: stop at the end, and call animationFinished."><input data-testid="anim-loop" type="checkbox" checked={clip.loop} onChange={(e) => editClip({ loop: e.target.checked }, e.target.checked ? 'Loop' : 'Do not loop')} /> loop</label>
          <label title="Play this animation when the game starts (the player's autoplay property)"><input data-testid="anim-autoplay" type="checkbox" checked={autoplay === clip.name}
            onChange={(e) => store.act((d) => d.setProp(s.id, player.id, 'autoplay', e.target.checked ? clip.name : '', e.target.checked ? `Autoplay ${clip.name}` : 'No autoplay'))} /> autoplay</label>
          <span style={{ width: 1, height: 16, background: C.border }} />
          <button type="button" data-testid="anim-rewind" style={small} title="To the start" onClick={() => setAnim({ time: 0 })}>⏮</button>
          <button type="button" data-testid="anim-play" style={{ ...small, background: playing ? C.accent : C.raised, color: playing ? '#0b1320' : C.text }} title="Preview in the viewport, as the game will play it"
            onClick={() => setAnim({ playing: !playing, time: !playing && !clip.loop && store.anim.time >= clip.length ? 0 : store.anim.time })}>{playing ? '❚❚' : '▶'}</button>
          <span data-testid="anim-time" style={{ fontFamily: C.mono, color: C.warm }}>{store.anim.time.toFixed(2)} s</span>
          <span style={{ flex: 1 }} />
          <button type="button" data-testid="anim-delete" style={{ ...small, color: C.dim }} onClick={() => { commit(clips.filter((c) => c.name !== clip.name), `Delete animation ${clip.name}`, autoplay === clip.name ? { autoplay: '' } : {}); setSel(null); setAnim({ clip: clips.find((c) => c.name !== clip.name)?.name ?? '', time: 0 }); }}>Delete animation</button>
        </>}
      </div>

      {/* Ruler and tracks */}
      <div ref={lanes} style={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 3, background: C.bg }}>
        {clip ? <>
          <div data-testid="anim-ruler" style={{ position: 'sticky', top: 0, height: 20, background: C.panel2, borderBottom: `1px solid ${C.border}`, cursor: 'ew-resize', zIndex: 2 }}
            onPointerDown={(e) => { if (e.clientX - lanes.current!.getBoundingClientRect().left < LABEL) return; (e.target as Element).setPointerCapture(e.pointerId); scrubbing.current = true; setAnim({ time: snap(timeAt(e.clientX)), playing: false }); }}
            onPointerMove={(e) => { if (scrubbing.current) setAnim({ time: snap(timeAt(e.clientX)) }); }}
            onPointerUp={() => { scrubbing.current = false; }}>
            {Array.from({ length: Math.floor(len / step + 1e-9) + 1 }, (_, i) => +(i * step).toFixed(3)).map((t) => (
              <span key={t} style={{ position: 'absolute', left: xOf(t), top: 0, height: 20, borderLeft: `1px solid ${C.border}`, paddingLeft: 2, fontSize: 10, color: C.faint, pointerEvents: 'none' }}>{t}</span>
            ))}
          </div>
          {clip.tracks.length === 0 && <div style={{ padding: 8, color: C.faint }}>No tracks yet. Select a node, move the playhead, and press ◆ beside a property in the Inspector: that adds a key there. Keys at different times make the property change between them.</div>}
          {clip.tracks.map((tr, t) => {
            const ok = !!trackTarget(s, player.id, tr.path);
            return (
              <div key={`${tr.path}.${tr.property}`} data-testid={`anim-track-${tr.path}.${tr.property}`} style={{ position: 'relative', height: 24, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ position: 'absolute', left: 0, width: LABEL - 6, top: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 6, overflow: 'hidden', whiteSpace: 'nowrap', color: ok ? C.text : C.bad }}
                  title={ok ? `${tr.path}.${tr.property}` : `There is no node "${tr.path}" under the player's parent`}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{tr.path === '.' ? '(parent)' : tr.path} › <b>{tr.property}</b></span>
                  <button type="button" data-testid={`anim-track-delete-${t}`} title="Delete this track" onClick={() => { editClip({ tracks: clip.tracks.filter((_, i) => i !== t) }, `Delete track ${tr.path}.${tr.property}`); setSel(null); }}
                    style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer' }}>×</button>
                </div>
                {tr.keys.map((k, j) => {
                  const time = dragKey && dragKey.t === t && dragKey.k === j ? dragKey.time : k.time;
                  const on = sel?.t === t && sel.k === j;
                  return <div key={j} data-testid={`anim-key-${t}-${j}`} title={`${k.time} s: ${JSON.stringify(k.value)}`}
                    onPointerDown={(e) => { e.stopPropagation(); (e.target as Element).setPointerCapture(e.pointerId); setSel({ t, k: j }); setAnim({ time: k.time, playing: false }); setDragKey({ t, k: j, time: k.time }); }}
                    onPointerMove={(e) => { if (dragKey && dragKey.t === t && dragKey.k === j) setDragKey({ t, k: j, time: snap(timeAt(e.clientX)) }); }}
                    onPointerUp={() => { const d = dragKey; setDragKey(null); if (d && Math.abs(d.time - k.time) > 5e-4) { moveKey(t, j, d.time); setAnim({ time: d.time }); } }}
                    style={{ position: 'absolute', left: xOf(time) - 6, top: 6, width: 12, height: 12, transform: 'rotate(45deg)', background: on ? C.warm : C.warn, border: `1px solid ${on ? '#fff' : '#0008'}`, cursor: 'grab', zIndex: 1 }} />;
                })}
              </div>
            );
          })}
          <div style={{ position: 'absolute', left: xOf(store.anim.time), top: 0, bottom: 0, width: 2, background: C.warm, pointerEvents: 'none', zIndex: 3 }} />
        </> : <div style={{ padding: 8, color: C.faint }}>{player.name} has no animations yet. Press + New.</div>}
      </div>

      {/* The selected key */}
      {selKey && selTrack && (
        <div data-testid="anim-key-editor" style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 4 }}>
          <span style={{ color: C.dim }}>Key: {selTrack.path} › {selTrack.property} at</span>
          <NumberField testid="anim-key-time" value={selKey.time} step={0.05} width={54} onCommit={(v) => { const time = Math.min(len, Math.max(0, +v.toFixed(4))); moveKey(sel!.t, sel!.k, time); setAnim({ time }); }} /><span style={{ color: C.dim }}>s, value</span>
          {selDef?.type === 'vec2' ? <>
            <NumberField testid="anim-key-x" label="x" color={C.x} value={(selKey.value as Vec2).x} onCommit={(x) => setKeyValue({ x, y: (selKey.value as Vec2).y })} />
            <NumberField testid="anim-key-y" label="y" color={C.y} value={(selKey.value as Vec2).y} onCommit={(y) => setKeyValue({ x: (selKey.value as Vec2).x, y })} />
          </> : selDef?.type === 'bool' ? <input data-testid="anim-key-bool" type="checkbox" checked={selKey.value as boolean} onChange={(e) => setKeyValue(e.target.checked)} />
            : typeof selKey.value === 'number' ? <NumberField testid="anim-key-number" value={selKey.value} step={selDef?.step ?? 0.1} onCommit={(x) => setKeyValue(x)} />
            : <span style={{ width: 160 }}><TextField testid="anim-key-text" value={String(selKey.value ?? '')} onCommit={(x) => setKeyValue(x)} /></span>}
          <button type="button" data-testid="anim-key-delete" style={{ ...small, color: C.dim }} onClick={() => { editClip({ tracks: clip!.tracks.map((x, i) => (i === sel!.t ? { ...x, keys: x.keys.filter((_, j) => j !== sel!.k) } : x)) }, 'Delete a key'); setSel(null); }}>Delete key</button>
        </div>
      )}
    </div>
  );
}
