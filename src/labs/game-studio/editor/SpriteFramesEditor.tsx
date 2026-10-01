// The Inspector's editor for an AnimatedSprite2D's animations (its `frames` property):
// add, rename and delete animations, set each one's speed and looping, add and remove
// its pictures, and choose which one shows. Each animation has a small preview playing at
// its own speed. Every change is one command, so it is undone in one step and logged as code.

import React, { useEffect, useState } from 'react';
import type { Store } from './store';
import { C, NumberField, TextField, selectStyle } from './kit';
import type { SpriteAnimation } from '../core/types';

const thumb: React.CSSProperties = { width: 30, height: 30, objectFit: 'contain', imageRendering: 'pixelated', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 2, display: 'block' };

/** Plays an animation's pictures at its fps, round and round, the way the game will show them. */
function Preview({ store, anim }: { store: Store; anim: SpriteAnimation }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    if (anim.frames.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % anim.frames.length), 1000 / anim.fps);
    return () => clearInterval(t);
  }, [anim.fps, anim.frames.length, anim.frames]);
  const img = store.imageFor(anim.frames[i % Math.max(1, anim.frames.length)] ?? null);
  return img
    ? <img src={img.src} alt="" title={`Preview at ${anim.fps} frames a second${anim.loop ? '' : ' (in the game it stops on the last picture)'}`} style={{ ...thumb, width: 40, height: 40 }} />
    : <div title="No pictures yet" style={{ ...thumb, width: 40, height: 40 }} />;
}

export function SpriteFramesEditor({ store, frames, current, onChange }: {
  store: Store;
  frames: SpriteAnimation[];
  /** The `animation` property: the one showing. */
  current: string;
  /** New frames, and a new `animation` when it changes too, as one command. */
  onChange: (frames: SpriteAnimation[], animation?: string) => void;
}) {
  const images = store.project?.assets ?? [];
  const edit = (i: number, patch: Partial<SpriteAnimation>) => onChange(frames.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const freeName = () => { if (!frames.some((a) => a.name === 'default')) return 'default'; let k = 2; while (frames.some((a) => a.name === `animation${k}`)) k++; return `animation${k}`; };

  return (
    <div data-testid="frames-editor" style={{ padding: '2px 8px 6px' }}>
      {frames.length === 0 && <div style={{ color: C.faint, marginBottom: 4 }}>No animations yet. Add one, then add its pictures from assets/ (import images or drag in starter art first).</div>}
      {frames.map((a, i) => (
        <div key={i} data-testid={`frames-anim-${a.name}`} style={{ border: `1px solid ${a.name === current ? C.accent : C.border}`, borderRadius: 4, padding: 5, marginBottom: 5, background: C.panel2 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Preview store={store} anim={a} />
            <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 3 }}>
              <TextField testid={`frames-name-${i}`} value={a.name} onCommit={(name) => {
                const n = name.trim();
                if (!n || n === a.name) return;
                if (frames.some((x) => x.name === n)) { store.say(`There is already an animation called "${n}"`); return; }
                onChange(frames.map((x, j) => (j === i ? { ...x, name: n } : x)), a.name === current ? n : undefined);
              }} />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: C.dim }}>
                <NumberField testid={`frames-fps-${i}`} value={a.fps} step={1} width={44} onCommit={(fps) => edit(i, { fps: Math.min(120, Math.max(0.1, fps)) })} /><span>fps</span>
                <label title="Start again after the last picture. Off: stop on the last picture, and call animationFinished."><input data-testid={`frames-loop-${i}`} type="checkbox" checked={a.loop} onChange={(e) => edit(i, { loop: e.target.checked })} /> loop</label>
                <span style={{ flex: 1 }} />
                {a.name === current
                  ? <span style={{ color: C.accent, fontSize: 11 }} title="The animation property names this one">showing</span>
                  : <button type="button" data-testid={`frames-show-${i}`} onClick={() => onChange(frames, a.name)} title="Make this the animation shown (the animation property)" style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 3, color: C.dim, fontSize: 11, cursor: 'pointer' }}>show</button>}
                <button type="button" data-testid={`frames-delete-${i}`} onClick={() => onChange(frames.filter((_, j) => j !== i))} title={`Delete the animation "${a.name}"`} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 5, alignItems: 'center' }}>
            {a.frames.map((f, j) => {
              const img = store.imageFor(f);
              return (
                <div key={j} data-testid={`frames-thumb-${i}-${j}`} title={`Picture ${j}: ${f}`} style={{ position: 'relative' }}>
                  {img ? <img src={img.src} alt="" style={thumb} /> : <div style={{ ...thumb, color: C.bad, fontSize: 9, textAlign: 'center' }}>missing</div>}
                  <span style={{ position: 'absolute', left: 1, bottom: 0, fontSize: 9, color: C.faint, textShadow: '0 0 2px #000' }}>{j}</span>
                  <button type="button" data-testid={`frames-remove-${i}-${j}`} onClick={() => edit(i, { frames: a.frames.filter((_, k) => k !== j) })} title="Remove this picture"
                    style={{ position: 'absolute', right: -4, top: -4, width: 13, height: 13, lineHeight: '10px', padding: 0, fontSize: 10, borderRadius: 7, border: `1px solid ${C.border}`, background: C.raised, color: C.dim, cursor: 'pointer' }}>×</button>
                </div>
              );
            })}
            <select data-testid={`frames-add-picture-${i}`} value="" onChange={(e) => { if (e.target.value) edit(i, { frames: [...a.frames, e.target.value] }); }} title="Add a picture to the end" style={{ ...selectStyle, maxWidth: 120 }}>
              <option value="">+ picture…</option>
              {images.map((x) => <option key={x.id} value={x.path}>{x.path.replace(/^assets\//, '')}</option>)}
            </select>
          </div>
        </div>
      ))}
      <button type="button" data-testid="frames-add-animation" onClick={() => { const name = freeName(); onChange([...frames, { name, fps: 8, loop: true, frames: [] }], frames.length === 0 ? name : undefined); }}
        style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontSize: 12, cursor: 'pointer', padding: '2px 8px' }}>+ Animation</button>
    </div>
  );
}
