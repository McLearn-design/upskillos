// Inspector panels for rigging: an armature's bones, a mesh's skin, and the
// skinning of one vertex.
import React from 'react';
import type { Editor } from '../core/Editor';
import type { Vec3 } from '../core/EditMesh';
import { boneLength, boneMatrices, posedEnds } from '../core/armature';
import { skinState } from '../core/evaluate';
import { Btn, C, MatrixView, NumberField, Row, Section } from './kit';

const DEG = 180 / Math.PI;
const f3 = (v: Vec3) => `(${v.map((x) => (Math.abs(x) < 5e-7 ? 0 : +x.toFixed(3))).join(', ')})`;

export function ArmaturePanel({ editor }: { editor: Editor }) {
  const o = editor.activeObject!;
  const bones = o.bones!;
  const b = bones.find((x) => x.name === editor.activeBone);
  const depth = (n: string | null): number => { let d = 0, p = n; while (p) { p = bones.find((x) => x.name === p)?.parent ?? null; d++; } return d; };
  const posing = editor.mode === 'pose';
  const vecRow = (label: string, v: Vec3, set: (v: Vec3) => void, scale = 1) => (
    <Row label={label}>{[0, 1, 2].map((i) => <NumberField key={i} label={'XYZ'[i]} color={[C.x, C.y, C.z][i]} value={v[i] * scale} width={52} onCommit={(x) => { const q = [...v] as Vec3; q[i] = x / scale; set(q); }} />)}</Row>
  );
  let mats: ReturnType<typeof boneMatrices> | null = null;
  try { mats = boneMatrices(bones); } catch { /* a broken hierarchy is reported below */ }
  const ends = mats ? posedEnds(bones, mats) : null;
  return (
    <Section title={`ARMATURE · ${bones.length} BONE${bones.length === 1 ? '' : 'S'}`}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
        <Btn small active={posing} onClick={() => (posing ? editor.exitPose() : editor.enterPose())} title="Tab">{posing ? 'Leave pose mode' : 'Pose mode'}</Btn>
        <Btn small onClick={() => editor.addBone()} title="A new bone from the tail of the active one">+ Bone</Btn>
        <Btn small disabled={!b || bones.length < 2} onClick={() => editor.deleteBone()}>Delete bone</Btn>
        <Btn small onClick={() => editor.resetPose()} title="Every bone back to its rest pose (Alt+R)">Clear pose</Btn>
      </div>
      <div data-testid="bone-list" style={{ background: C.bg, borderRadius: 4, padding: 4, maxHeight: 150, overflowY: 'auto', marginBottom: 8 }}>
        {bones.map((x) => (
          <div key={x.name} onClick={() => editor.selectBone(x.name)} style={{ padding: `2px 4px 2px ${4 + (depth(x.parent)) * 12}px`, cursor: 'pointer', borderRadius: 3, background: x.name === editor.activeBone ? C.raised : 'transparent', color: x.name === editor.activeBone ? C.blue : C.text, fontFamily: C.mono, fontSize: 11.5 }}>
            {x.parent ? '└ ' : ''}{x.name}{x.pose.some((a) => Math.abs(a) > 1e-9) ? <span style={{ color: C.faint }}> · posed</span> : null}
          </div>
        ))}
      </div>
      {b && (
        <>
          <Row label="Name"><input key={b.name} defaultValue={b.name} onBlur={(e) => e.target.value && e.target.value !== b.name && editor.setBone(b.name, { name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} style={{ width: 150, background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 3, padding: '3px 5px', fontSize: 12 }} /></Row>
          <Row label="Parent">
            <select value={b.parent ?? ''} onChange={(e) => editor.setBone(b.name, { parent: e.target.value || null })} style={{ width: 160, background: C.bg, color: C.text, border: `1px solid ${C.border}`, fontSize: 12, padding: 2 }}>
              <option value="">(none, a root bone)</option>
              {bones.filter((x) => x !== b).map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
            </select>
          </Row>
          <div style={{ color: C.dim, margin: '6px 0 3px' }}>Rest (armature space)</div>
          {vecRow('Head', b.head, (v) => editor.setBone(b.name, { head: v }))}
          {vecRow('Tail', b.tail, (v) => editor.setBone(b.name, { tail: v }))}
          <div style={{ color: C.dim, margin: '6px 0 3px' }}>Pose: rotation about the head, in the bone's own axes (°)</div>
          {vecRow('Rotate', b.pose, (v) => editor.setBonePose(b.name, v), DEG)}
          {ends && <Row label="Posed tail"><span style={{ fontFamily: C.mono }}>{f3(ends.get(b.name)!.tail)}</span></Row>}
          <Row label="Length"><span style={{ fontFamily: C.mono }}>{boneLength(b).toFixed(3)}</span></Row>
          {mats && (
            <details style={{ marginTop: 6 }}>
              <summary style={{ color: C.dim, cursor: 'pointer' }}>How the bone moves the mesh: B, P and S = P·B⁻¹</summary>
              <div style={{ color: C.faint, margin: '6px 0 3px' }}>B, the rest matrix: origin at the head, y along the bone</div>
              <MatrixView m={mats.get(b.name)!.rest.elements} />
              <div style={{ color: C.faint, margin: '6px 0 3px' }}>P, the posed matrix: P = P_parent · (B_parent⁻¹·B) · R(pose)</div>
              <MatrixView m={mats.get(b.name)!.posed.elements} />
              <div style={{ color: C.faint, margin: '6px 0 3px' }}>S = P·B⁻¹: takes a point from where it rests to where this bone puts it</div>
              <MatrixView m={mats.get(b.name)!.skin.elements} note="The identity in the rest pose. Each vertex is moved by a weighted average of these." />
            </details>
          )}
        </>
      )}
      <div style={{ color: C.faint, fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>
        {posing ? 'Click a bone, drag the gizmo rings to rotate it. I keys the active bone (or all bones if none is active); the Timeline plays it.' : 'To rig a mesh: select it, Shift-click this armature, then Object › Bind to armature (Ctrl+P).'}
      </div>
    </Section>
  );
}

export function SkinPanel({ editor }: { editor: Editor }) {
  const o = editor.activeObject!;
  const sk = o.skin!;
  const arm = editor.scene.get(sk.armature);
  const state = skinState(editor.scene, o);
  // The bone shown: the one whose weights are on screen, else the active bone, else the first.
  const shown = editor.field?.objectId === o.id && editor.field.spec.kind === 'weight' ? editor.field.spec.bone : null;
  const bone = shown ?? (sk.bones.includes(editor.activeBone ?? '') ? editor.activeBone! : sk.bones[0]);
  return (
    <Section title="SKIN (ARMATURE)">
      <Row label="Armature"><span>{arm?.name ?? '(deleted)'}</span></Row>
      <Row label="Weights"><span style={{ fontFamily: C.mono }}>{sk.bones.length} bones × {sk.verts} vertices</span></Row>
      {state === 'stale' && <div style={{ color: C.warn, marginBottom: 6 }}>The mesh has changed since it was bound ({sk.verts} vertices then); it is not being deformed. Bind again.</div>}
      {state === 'no-armature' && <div style={{ color: C.warn, marginBottom: 6 }}>Its armature is gone; it is not being deformed.</div>}
      <Row label="Show">
        <select value={bone} onChange={(e) => { editor.activeBone = e.target.value; editor.showField({ kind: 'weight', bone: e.target.value }, o.id); }} style={{ width: 120, background: C.bg, color: C.text, border: `1px solid ${C.border}`, fontSize: 12, padding: 2 }}>
          {sk.bones.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <Btn small onClick={() => editor.showField({ kind: 'weight', bone }, o.id)}>Weights heat map</Btn>
      </Row>
      <div style={{ display: 'flex', gap: 4 }}>
        {arm && <Btn small onClick={() => { editor.selectObject(o.id); editor.selectObject(arm.id, true); editor.bindToArmature(); }}>Bind again</Btn>}
        <Btn small onClick={() => editor.limitInfluences(o.id, 4)} title="glTF, three.js and game engines use at most 4 bones per vertex. Limit here so the export deforms exactly as shown.">Limit to 4 bones per vertex</Btn>
        <Btn small onClick={() => editor.unbind(o.id)}>Unbind</Btn>
      </div>
      {(() => { const over = Array.from({ length: sk.verts }, (_, i) => sk.weights.filter((w) => w[i] > 0).length).filter((c) => c > 4).length; return over ? <div style={{ color: C.faint, fontSize: 11, marginTop: 4 }}>{over} vertices use more than 4 bones; a glTF export keeps only their 4 strongest.</div> : null; })()}
    </Section>
  );
}

/** In edit mode on a skinned mesh: the weights of one vertex, and a trace of how it is skinned. */
export function VertexSkin({ editor, v }: { editor: Editor; v: number }) {
  const o = editor.editObject!;
  const sk = o.skin;
  if (!sk || v >= sk.verts) return null;
  const ws = sk.bones.map((n, b) => [n, sk.weights[b][v]] as const).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]);
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ color: C.dim, marginBottom: 3 }}>Skin weights (sum {ws.reduce((s, [, w]) => s + w, 0).toFixed(3)})</div>
      {ws.map(([n, w]) => (
        <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: C.mono, fontSize: 11 }}>
          <span style={{ width: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>{n}</span>
          <span style={{ flex: 1, height: 6, background: C.bg, borderRadius: 3 }}><span style={{ display: 'block', width: `${w * 100}%`, height: 6, background: C.accent, borderRadius: 3 }} /></span>
          <span style={{ width: 44, textAlign: 'right' }}>{w.toFixed(3)}</span>
        </div>
      ))}
      <Btn small style={{ marginTop: 4 }} onClick={() => editor.explainSkinning(o.id, v)} title="Show each bone's candidate position and the weighted blend, in the trace panel">Explain skinning here</Btn>
    </div>
  );
}
