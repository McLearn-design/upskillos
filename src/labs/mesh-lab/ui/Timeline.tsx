// The timeline: frames, keyframes, playback, and the numbers behind interpolation.
import React, { useRef, useState } from 'react';
import type { Editor } from '../core/Editor';
import { CHANNELS, angleBetween, eulerToQuat, keyFrames, sampleKeys, slerp, type Channel, type Interp, type Quat } from '../core/animation';
import { fmt } from '../core/trace';
import { Btn, C, NumberField, useEditorVersion } from './kit';

const AXIS = [C.x, C.y, C.z];
/** The ruler and the graph share a left gutter for labels, so frames line up between them. */
const GUTTER = 64, RIGHT = 14, W = 1000;
const frameX = (f: number, start: number, end: number) => GUTTER + ((f - start) / Math.max(1, end - start)) * (W - GUTTER - RIGHT);
const DEG = 180 / Math.PI;
const q4 = (q: Quat) => `(w ${fmt(q[3], 3)}, x ${fmt(q[0], 3)}, y ${fmt(q[1], 3)}, z ${fmt(q[2], 3)})`;

/** An object channel, or the active bone's rotation. */
type Row = Channel | 'bone';
const boneKeys = (editor: Editor) => (editor.activeObject?.bones && editor.activeBone ? editor.activeObject.anim?.bones?.[editor.activeBone] : undefined);

export function Timeline({ editor }: { editor: Editor }) {
  useEditorVersion(editor);
  const [chosen, setChannel] = useState<Row>('position');
  const t = editor.scene.timeline;
  const o = editor.activeObject;
  const anim = o?.anim;
  const hasBone = !!(o?.bones && editor.activeBone);
  const channel: Row = chosen === 'bone' && !hasBone ? 'position' : chosen;
  const posing = editor.mode === 'pose';
  const bk = boneKeys(editor);
  const keyAt = posing ? bk?.find((k) => k.frame === t.frame) : undefined;
  const keysHere = posing ? (keyAt ? ['bone'] : []) : anim ? CHANNELS.filter((c) => anim[c]?.some((k) => k.frame === t.frame)) : [];
  const interpHere = posing ? keyAt?.interp ?? null : keysHere.length ? anim![keysHere[0] as Channel]!.find((k) => k.frame === t.frame)!.interp : null;
  const go = (f: number) => editor.setFrame(Math.max(t.start, Math.min(t.end, f)));
  const all = keyFrames(anim);
  const prevKey = [...all].reverse().find((f) => f < t.frame), nextKey = all.find((f) => f > t.frame);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, fontSize: 12 }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 8px', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
        <Btn small onClick={() => go(t.start)} title="First frame">⏮</Btn>
        <Btn small disabled={prevKey === undefined} onClick={() => prevKey !== undefined && go(prevKey)} title="Previous keyframe">◆◀</Btn>
        <Btn small active={editor.playing} onClick={() => editor.setPlaying(!editor.playing)} title="Play / pause (Space)">{editor.playing ? '❚❚ Pause' : '▶ Play'}</Btn>
        <Btn small disabled={nextKey === undefined} onClick={() => nextKey !== undefined && go(nextKey)} title="Next keyframe">▶◆</Btn>
        <Btn small onClick={() => go(t.end)} title="Last frame">⏭</Btn>
        <NumberField label="F" value={t.frame} digits={0} step={1} width={46} onCommit={(v) => go(v)} />
        <span style={{ color: C.faint, marginLeft: 6 }}>range</span>
        <NumberField value={t.start} digits={0} step={1} width={40} onCommit={(v) => editor.setTimeline({ start: v })} />
        <NumberField value={t.end} digits={0} step={1} width={44} onCommit={(v) => editor.setTimeline({ end: v })} />
        <NumberField label="fps" value={t.fps} digits={0} step={1} width={36} onCommit={(v) => editor.setTimeline({ fps: v })} />
        <span style={{ width: 1, height: 18, background: C.border, margin: '0 4px' }} />
        <Btn small active onClick={() => editor.insertKey()} title={posing ? 'Key the active bone\'s rotation at this frame (I)' : 'Key position, rotation and scale of the selection at this frame (I)'}>◆ {posing ? `Key ${editor.activeBone ?? 'pose'}` : 'Insert keyframe'}</Btn>
        <Btn small disabled={!keysHere.length} onClick={() => editor.deleteKey()} title="Remove the keys at this frame">Delete key</Btn>
        {keysHere.length > 0 && <>
          <span style={{ color: C.faint, marginLeft: 4 }}>leave this key</span>
          {(['constant', 'linear', 'ease'] as Interp[]).map((i) => <Btn key={i} small active={interpHere === i} onClick={() => editor.setInterpolation(i)}>{i}</Btn>)}
        </>}
        {o && anim?.rotation?.length ? <>
          <span style={{ color: C.faint, marginLeft: 4 }}>rotation</span>
          <Btn small active={(anim.rotationMode ?? 'euler') === 'euler'} onClick={() => editor.setRotationMode(o.id, 'euler')} title="Interpolate each Euler angle separately">Euler</Btn>
          <Btn small active={anim.rotationMode === 'quaternion'} onClick={() => editor.setRotationMode(o.id, 'quaternion')} title="Spherical linear interpolation of quaternions: the shortest turn, at even speed">Quaternion (slerp)</Btn>
        </> : null}
      </div>
      <Track editor={editor} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div style={{ flex: 1.4, minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', gap: 4, padding: '4px 8px', alignItems: 'center' }}>
            {CHANNELS.map((c) => <Btn key={c} small active={channel === c} onClick={() => setChannel(c)}>{c}</Btn>)}
            {hasBone && <Btn small active={channel === 'bone'} onClick={() => setChannel('bone')} title="The active bone's pose rotation">bone {editor.activeBone}</Btn>}
            <span style={{ color: C.faint, fontSize: 11 }}>value against frame{channel === 'rotation' || channel === 'bone' ? ' (degrees)' : ''}{(channel === 'rotation' && anim?.rotationMode === 'quaternion') || channel === 'bone' ? ' · dashed: what Euler interpolation would do' : ''}</span>
          </div>
          <Graph editor={editor} channel={channel} />
        </div>
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '6px 10px', fontFamily: C.mono, fontSize: 11.5, lineHeight: 1.55 }}>
          <Explain editor={editor} />
        </div>
      </div>
    </div>
  );
}

/** The frame ruler with the active object's keys per channel; click or drag to change frame. */
function Track({ editor }: { editor: Editor }) {
  const ref = useRef<SVGSVGElement>(null);
  const t = editor.scene.timeline, anim = editor.activeObject?.anim;
  const bk = boneKeys(editor);
  const H = bk || editor.activeObject?.bones ? 78 : 64;
  const x = (f: number) => frameX(f, t.start, t.end);
  const frameAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.round(t.start + ((((clientX - r.left) / r.width) * W - GUTTER) / (W - GUTTER - RIGHT)) * (t.end - t.start));
  };
  const scrub = (e: React.PointerEvent) => {
    editor.setPlaying(false);
    editor.setFrame(Math.max(t.start, Math.min(t.end, frameAt(e.clientX))));
    const move = (ev: PointerEvent) => editor.setFrame(Math.max(t.start, Math.min(t.end, frameAt(ev.clientX))));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const step = Math.max(1, Math.ceil((t.end - t.start) / 24 / 5) * 5);
  const ticks: number[] = [];
  for (let f = Math.ceil(t.start / step) * step; f <= t.end; f += step) ticks.push(f);
  return (
    <svg ref={ref} data-testid="timeline-track" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onPointerDown={scrub}
      style={{ width: '100%', height: H, display: 'block', background: C.bg, borderBottom: `1px solid ${C.border}`, cursor: 'ew-resize', touchAction: 'none' }}>
      {ticks.map((f) => <g key={f}><line x1={x(f)} x2={x(f)} y1={0} y2={H} stroke={C.panel2} /><text x={x(f) + 2} y={10} fill={C.faint} fontSize={9}>{f}</text></g>)}
      {CHANNELS.map((c, row) => (
        <g key={c}>
          <text x={6} y={24 + row * 14} fill={C.faint} fontSize={9}>{c}</text>
          {anim?.[c]?.map((k) => <rect key={k.frame} x={x(k.frame) - 4} y={17 + row * 14} width={8} height={8} transform={`rotate(45 ${x(k.frame)} ${21 + row * 14})`} fill={k.frame === t.frame ? C.accent : '#e8c07a'} stroke="#1b1b1b" strokeWidth={0.8} />)}
        </g>
      ))}
      {editor.activeObject?.bones && (
        <g>
          <text x={6} y={66} fill={C.blue} fontSize={9}>{editor.activeBone ?? 'bone'}</text>
          {bk?.map((k) => <rect key={k.frame} x={x(k.frame) - 4} y={59} width={8} height={8} transform={`rotate(45 ${x(k.frame)} 63)`} fill={k.frame === t.frame ? C.accent : '#9cc9ff'} stroke="#1b1b1b" strokeWidth={0.8} />)}
        </g>
      )}
      <line x1={x(t.frame)} x2={x(t.frame)} y1={0} y2={H} stroke={C.blue} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Each component of a channel against frame, with the keys marked. */
function Graph({ editor, channel }: { editor: Editor; channel: Row }) {
  const t = editor.scene.timeline, o = editor.activeObject, keys = channel === 'bone' ? boneKeys(editor) : o?.anim?.[channel];
  if (!o || !keys?.length) return <div style={{ color: C.faint, padding: '10px 12px' }}>No {channel === 'bone' ? `keys on bone ${editor.activeBone}` : `${channel} keys on ${o ? o.name : 'the selection'}`}.</div>;
  const slerpOn = channel === 'bone' || (channel === 'rotation' && o.anim!.rotationMode === 'quaternion');
  const scale = channel === 'rotation' || channel === 'bone' ? DEG : 1;
  const frames = Array.from({ length: t.end - t.start + 1 }, (_, i) => t.start + i);
  const main = frames.map((f) => sampleKeys(keys, f, slerpOn).value.map((v) => v * scale));
  const ghost = slerpOn ? frames.map((f) => sampleKeys(keys, f, false).value.map((v) => v * scale)) : null;
  const vals = [...main, ...(ghost ?? [])].flat();
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const H = 200, pad = 16;
  const x = (f: number) => frameX(f, t.start, t.end);
  const y = (v: number) => H - pad - ((v - lo) / (hi - lo)) * (H - 2 * pad);
  const path = (rows: number[][], axis: number) => rows.map((r, i) => `${i ? 'L' : 'M'}${x(frames[i]).toFixed(1)},${y(r[axis]).toFixed(1)}`).join(' ');
  return (
    <svg data-testid="timeline-graph" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ flex: 1, width: '100%', minHeight: 0, background: C.bg }}>
      {lo < 0 && hi > 0 && <line x1={GUTTER} x2={W - RIGHT} y1={y(0)} y2={y(0)} stroke={C.border} vectorEffect="non-scaling-stroke" />}
      <text x={6} y={pad + 4} fill={C.faint} fontSize={11}>{fmt(hi, 2)}</text>
      <text x={6} y={H - pad} fill={C.faint} fontSize={11}>{fmt(lo, 2)}</text>
      {[0, 1, 2].map((a) => (
        <g key={a}>
          {ghost && <path d={path(ghost, a)} fill="none" stroke={AXIS[a]} strokeOpacity={0.45} strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />}
          <path d={path(main, a)} fill="none" stroke={AXIS[a]} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
          {keys.map((k) => <circle key={k.frame} cx={x(k.frame)} cy={y(k.value[a] * scale)} r={4} fill={AXIS[a]} stroke="#111" vectorEffect="non-scaling-stroke" />)}
        </g>
      ))}
      <line x1={x(t.frame)} x2={x(t.frame)} y1={0} y2={H} stroke={C.blue} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** The interpolation worked out at the current frame. */
function Explain({ editor }: { editor: Editor }) {
  const t = editor.scene.timeline, o = editor.activeObject, anim = o?.anim;
  const bk = boneKeys(editor);
  if (!o || !anim || (!CHANNELS.some((c) => anim[c]?.length) && !bk?.length)) {
    return (
      <div style={{ fontFamily: 'system-ui', color: C.dim, fontSize: 12, lineHeight: 1.6 }}>
        <b style={{ color: C.text }}>Animate an object</b>
        <ol style={{ margin: '4px 0 0 16px', padding: 0 }}>
          <li>Select it and go to a frame (click the ruler).</li>
          <li>Pose it: move, rotate, scale.</li>
          <li>Press <b>I</b> or ◆ Insert keyframe.</li>
          <li>Go to a later frame, pose it again, key again.</li>
          <li>Press <b>Space</b> to play. The blue line in the viewport is its path.</li>
        </ol>
        Frames between keys are computed, not stored: this panel shows how.
      </div>
    );
  }
  const f = t.frame;
  return (
    <div>
      <div style={{ color: C.dim, fontFamily: 'system-ui', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>{o.name.toUpperCase()} AT FRAME {f}</div>
      {bk?.length ? (() => {
        const s = sampleKeys(bk, f, true);
        return (
          <div style={{ marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${C.panel2}` }}>
            <div><span style={{ color: C.blue }}>bone {editor.activeBone}</span> pose = ({s.value.map((a) => fmt(a * DEG, 3)).join(', ')})°</div>
            {s.from && s.to ? (
              <>
                <div style={{ color: C.dim }}>between keys at {s.from.frame} and {s.to.frame}: t = {fmt(s.t!, 4)}, s = {fmt(s.s!, 4)} ({s.from.interp})</div>
                <div style={{ color: C.dim }}>Bones always slerp: the rotation in the bone's own axes, blended as quaternions.</div>
                <Slerp from={s.from.value} to={s.to.value} s={s.s!} />
              </>
            ) : <div style={{ color: C.dim }}>outside the keyed range: holds the nearest key</div>}
          </div>
        );
      })() : null}
      {CHANNELS.map((c) => {
        const keys = anim[c];
        if (!keys?.length) return null;
        const sl = c === 'rotation' && anim.rotationMode === 'quaternion';
        const s = sampleKeys(keys, f, sl);
        const show = (v: number[]) => `(${v.map((a) => fmt(c === 'rotation' ? a * DEG : a, 3)).join(', ')})${c === 'rotation' ? '°' : ''}`;
        return (
          <div key={c} style={{ marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${C.panel2}` }}>
            <div><span style={{ color: C.accent }}>{c}</span> = {show(s.value)}</div>
            {s.from && s.to ? (
              <>
                <div style={{ color: C.dim }}>between keys at {s.from.frame} and {s.to.frame}: t = ({f} − {s.from.frame}) / ({s.to.frame} − {s.from.frame}) = {fmt(s.t!, 4)}</div>
                <div style={{ color: C.dim }}>{s.from.interp === 'ease' ? `s = 3t² − 2t³ = ${fmt(s.s!, 4)} (ease)` : s.from.interp === 'linear' ? `s = t = ${fmt(s.s!, 4)} (linear)` : 's = 0: constant holds the first key until the next'}</div>
                {!sl && <div style={{ color: C.dim }}>value = v₀ + s·(v₁ − v₀), each component</div>}
                {sl && <Slerp from={s.from.value} to={s.to.value} s={s.s!} />}
              </>
            ) : <div style={{ color: C.dim }}>{s.to ? `before the first key (frame ${s.to.frame}): holds its value` : `after the last key (frame ${s.from!.frame}): holds its value`}</div>}
          </div>
        );
      })}
    </div>
  );
}

function Slerp({ from, to, s }: { from: [number, number, number]; to: [number, number, number]; s: number }) {
  const q0 = eulerToQuat(from), q1 = eulerToQuat(to);
  const r = slerp(q0, q1, s);
  const st = Math.sin(r.theta);
  const wa = r.theta < 1e-6 ? 1 - s : Math.sin((1 - s) * r.theta) / st, wb = r.theta < 1e-6 ? s : Math.sin(s * r.theta) / st;
  // What Euler interpolation would have given, and how far that orientation is from slerp's.
  const e = from.map((a, i) => a + s * (to[i] - a)) as [number, number, number];
  const off = angleBetween(eulerToQuat(e), r.q) * DEG;
  return (
    <div style={{ color: C.dim }}>
      <div>q₀ = {q4(q0)}</div>
      <div>q₁ = {q4(q1)}{r.flipped ? '  → negated: q and −q are the same turn; this takes the short way' : ''}</div>
      <div>cos θ = q₀·q₁ → θ = {fmt(r.theta * DEG, 2)}° (the turn between them is 2θ = {fmt(2 * r.theta * DEG, 2)}°)</div>
      <div>q = sin((1−s)θ)/sin θ · q₀ + sin(sθ)/sin θ · q₁ = {fmt(wa, 4)}·q₀ + {fmt(wb, 4)}·q₁</div>
      <div style={{ color: C.text }}>q = {q4(r.q)}</div>
      <div style={{ color: off > 0.05 ? C.warn : C.dim }}>Euler at the same s: ({e.map((a) => fmt(a * DEG, 2)).join(', ')})°, {fmt(off, 2)}° away from this orientation.</div>
    </div>
  );
}
