// The inspector: everything about the selection, as numbers you can read and
// edit. Object mode shows the transform, how its matrix is built (T·R·S and the
// parent chain), the mesh's topology, modifiers and material. Edit mode shows
// the selected vertex, edge or face as data, and the buffers the GPU receives.
import React from 'react';
import * as THREE from 'three';
import type { Editor } from '../core/Editor';
import { EditMesh, type Vec3 } from '../core/EditMesh';
import type { Modifier } from '../core/modifiers';
import { evaluatedMesh } from '../core/evaluate';
import { Btn, C, MatrixView, NumberField, Row, Section, useEditorVersion } from './kit';
import { ArmaturePanel, SkinPanel, VertexSkin, WeightPaintPanel } from './Rig';
import { SHADER_INFO, SHADER_MODELS, TEXTURES, type ShaderModel, type TextureName } from '../core/shading';
import { RENDER_SIZES, horizontalFov } from '../core/camera';

/** What the camera section can ask of the viewport: look through, render, and the render size. */
export interface CameraControls {
  through: boolean;
  lookThrough(): void;
  render(): void;
  renderSize: { width: number; height: number };
  setRenderSize(width: number, height: number): void;
}

const f3 = (v: Vec3) => `(${v.map((x) => (Math.abs(x) < 5e-7 ? 0 : +x.toFixed(3))).join(', ')})`;
const DEG = 180 / Math.PI;

export function Inspector({ editor, camera }: { editor: Editor; camera?: CameraControls }) {
  useEditorVersion(editor);
  const o = editor.activeObject;
  return (
    <div style={{ height: '100%', overflowY: 'auto', background: C.panel, fontSize: 12, color: C.text }}>
      {editor.lastOpLive && editor.lastOp && <AdjustLast editor={editor} />}
      {!o ? (
        <div style={{ padding: 16, color: C.dim, lineHeight: 1.6 }}>Nothing selected. Click an object in the viewport or the scene list, or add one from the Add menu.</div>
      ) : editor.mode === 'edit' ? <EditInspector editor={editor} /> : editor.mode === 'weight' ? <WeightPaintPanel editor={editor} /> : (
        <>
          {o.bones && <ArmaturePanel editor={editor} />}
          {o.skin && <SkinPanel editor={editor} />}
          {o.kind === 'camera' && camera && <CameraPanel editor={editor} controls={camera} />}
          <ObjectInspector editor={editor} />
        </>
      )}
    </div>
  );
}

function AdjustLast({ editor }: { editor: Editor }) {
  const op = editor.lastOp!;
  return (
    <Section title={`ADJUST: ${op.label.toUpperCase()}`} right={<span style={{ color: C.accent }}>●</span>}>
      {Object.entries(op.params).map(([k, v]) => (
        <Row key={k} label={k}><NumberField value={v} step={0.05} onCommit={(x) => editor.adjustLast({ [k]: x })} width={80} /></Row>
      ))}
      <div style={{ color: C.faint, fontSize: 11 }}>Change a value to redo the operation with it, like Blender's “Adjust last operation”.</div>
    </Section>
  );
}

function ObjectInspector({ editor }: { editor: Editor }) {
  const o = editor.activeObject!;
  const s = editor.scene;
  const local = s.localMatrix(o), world = s.worldMatrix(o);
  const chain = s.ancestry(o);
  const T = new THREE.Matrix4().makeTranslation(...o.position);
  const R = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(o.rotation[0], o.rotation[1], o.rotation[2], 'XYZ'));
  const S = new THREE.Matrix4().makeScale(...o.scale);
  const det = world.determinant();
  return (
    <>
      <Section title="OBJECT">
        <Row label="Name"><input key={o.id + o.name} defaultValue={o.name} onBlur={(e) => editor.rename(o.id, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} style={{ width: 160, background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 3, padding: '3px 5px', fontSize: 12 }} /></Row>
        <Row label="Parent">
          <select value={o.parent ?? ''} onChange={(e) => editor.setParent(o.id, e.target.value || null)} style={{ width: 170, background: C.bg, color: C.text, border: `1px solid ${C.border}`, fontSize: 12, padding: 2 }}>
            <option value="">(none, the world)</option>
            {s.objects.filter((x) => x.id !== o.id && !s.isAncestor(o.id, x.id)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Row>
      </Section>
      <Section title="TRANSFORM (LOCAL)">
        {(['position', 'rotation', 'scale'] as const).map((field) => (
          <Row key={field} label={field === 'rotation' ? 'Rotation °' : field[0].toUpperCase() + field.slice(1)}>
            {[0, 1, 2].map((i) => (
              <NumberField key={i} width={52} label={'XYZ'[i]} color={[C.x, C.y, C.z][i]} step={field === 'rotation' ? 5 : 0.1} digits={field === 'rotation' ? 2 : 3}
                value={field === 'rotation' ? o.rotation[i] * DEG : o[field][i]}
                onCommit={(v) => editor.setTransform(o.id, field, i as 0 | 1 | 2, field === 'rotation' ? v / DEG : v)} />
            ))}
          </Row>
        ))}
        <div style={{ color: C.faint, fontSize: 11 }}>Relative to {o.parent ? `the parent, ${s.get(o.parent)?.name}` : 'the world'}. Fields accept expressions: <code>pi/4</code>, <code>2*1.5</code>. Drag an axis letter to scrub.</div>
      </Section>
      <Section title="MATRICES">
        <div style={{ color: C.dim, marginBottom: 4 }}>Local = T · R · S</div>
        <MatrixView m={local.elements} note="Columns 1–3: where the object's x, y, z axes point (scaled). Column 4 (orange): its origin." />
        <details style={{ marginTop: 6 }}>
          <summary style={{ cursor: 'pointer', color: C.dim }}>How it is built: T, R and S</summary>
          <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
            <div><div style={{ color: C.faint }}>T: move by {f3(o.position)}</div><MatrixView m={T.elements} /></div>
            <div><div style={{ color: C.faint }}>R: rotate X {(o.rotation[0] * DEG).toFixed(1)}°, then Y {(o.rotation[1] * DEG).toFixed(1)}°, then Z {(o.rotation[2] * DEG).toFixed(1)}° (R = Rx·Ry·Rz)</div><MatrixView m={R.elements} /></div>
            <div><div style={{ color: C.faint }}>S: scale by {f3(o.scale)}</div><MatrixView m={S.elements} /></div>
            <div style={{ color: C.faint }}>A point p goes to T·R·S·p: scaled first, then rotated, then moved.</div>
          </div>
        </details>
        <div style={{ color: C.dim, margin: '10px 0 4px' }}>World = {chain.map((x) => x.name).join(' · ')}</div>
        <MatrixView m={world.elements} note={`${chain.length > 1 ? 'Each parent\'s local matrix, multiplied in order from the root. ' : 'No parent, so world = local. '}Determinant ${det.toFixed(3)}${det < 0 ? ' (negative: the object is mirrored)' : ' (the volume scale factor)'}.`} />
      </Section>
      {o.mesh && <MeshStats mesh={o.mesh} evaluated={o.modifiers.length || o.skin ? evaluatedMesh(editor.scene, o, 3) : null} />}
      {o.mesh && <Modifiers editor={editor} />}
      {o.kind === 'mesh' && (
        <Section title="MATERIAL & SHADING">
          <Row label="Colour"><input type="color" value={o.material.color} onChange={(e) => editor.setMaterial(o.id, { color: e.target.value })} style={{ width: 44, height: 22, border: 'none', background: 'none' }} /><span style={{ fontFamily: C.mono, color: C.dim }}>{o.material.color}</span></Row>
          <Row label="Roughness"><NumberField value={o.material.roughness} step={0.05} onCommit={(v) => editor.setMaterial(o.id, { roughness: Math.min(1, Math.max(0, v)) })} /></Row>
          <Row label="Metalness"><NumberField value={o.material.metalness} step={0.05} onCommit={(v) => editor.setMaterial(o.id, { metalness: Math.min(1, Math.max(0, v)) })} /></Row>
          <Row label="Shading"><Btn small active={!o.smooth} onClick={() => editor.setSmooth(o.id, false)}>Flat</Btn><Btn small active={o.smooth} onClick={() => editor.setSmooth(o.id, true)}>Smooth</Btn></Row>
          <Row label="Model">
            <select value={o.material.shader ?? 'pbr'} onChange={(e) => editor.setMaterial(o.id, { shader: e.target.value as ShaderModel })} style={{ width: 140, background: C.bg, color: C.text, border: `1px solid ${C.border}`, fontSize: 12, padding: 2 }}>
              {SHADER_MODELS.map((m) => <option key={m} value={m}>{SHADER_INFO[m].label}</option>)}
            </select>
            <Btn small onClick={() => window.dispatchEvent(new CustomEvent('meshlab:tab', { detail: 'shader' }))} title="The GLSL, and the formula">Code</Btn>
          </Row>
          <div style={{ color: C.faint, fontSize: 11, fontFamily: C.mono, margin: '-2px 0 6px 68px' }}>{SHADER_INFO[o.material.shader ?? 'pbr'].equation}</div>
          <Row label="Texture">
            <select value={o.material.texture ?? 'none'} onChange={(e) => editor.setMaterial(o.id, { texture: e.target.value as TextureName })} style={{ width: 100, background: C.bg, color: C.text, border: `1px solid ${C.border}`, fontSize: 12, padding: 2 }}>
              {TEXTURES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <NumberField label="×" value={o.material.textureScale ?? 1} step={0.5} width={44} onCommit={(v) => editor.setMaterial(o.id, { textureScale: Math.max(0.01, v) })} />
          </Row>
          {(o.material.texture ?? 'none') !== 'none' && !o.uv && <div style={{ color: C.warn, fontSize: 11, marginBottom: 4 }}>No UVs yet, so the texture has nowhere to go: UV › Unwrap.</div>}
          {o.material.shader === 'blinn-phong' && <Row label="Shininess"><NumberField value={o.material.shininess ?? 40} step={5} width={56} onCommit={(v) => editor.setMaterial(o.id, { shininess: Math.max(1, v) })} /></Row>}
          <div style={{ color: C.faint, fontSize: 11 }}>Flat: one normal per face. Smooth: each vertex's normal is the average of the faces around it, and lighting is interpolated across faces.</div>
        </Section>
      )}
    </>
  );
}

function MeshStats({ mesh, evaluated }: { mesh: EditMesh; evaluated: EditMesh | null }) {
  const s = mesh.stats();
  const e = evaluated?.stats();
  const cell = (k: string, v: React.ReactNode, tip?: string) => <><span title={tip} style={{ color: C.dim }}>{k}</span><span style={{ fontFamily: C.mono, textAlign: 'right' }}>{v}</span></>;
  return (
    <Section title="MESH">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '3px 10px' }}>
        {cell('Vertices', s.verts)}{cell('Edges', s.edges)}{cell('Faces', `${s.faces} (${s.ngons.tris} tri, ${s.ngons.quads} quad, ${s.ngons.larger} n-gon)`)}
        {cell('Triangles for the GPU', s.tris)}
        {cell('Euler V − E + F', s.euler, 'For one closed surface: 2 minus twice the number of holes through it. A sphere 2, a torus 0.')}
        {cell('Closed', s.closed ? 'yes' : `no (${s.boundaryEdges} open edges)`)}
        {cell('Non-manifold edges', s.nonManifoldEdges, 'Edges with three or more faces; no real solid has them.')}
        {cell('Separate pieces', s.components)}
        {cell('Area', s.area.toFixed(4))}
        {cell('Volume', s.closed ? `${s.volume.toFixed(4)}${s.volume < 0 ? ' (inside out!)' : ''}` : 'open surface', 'Signed volume by the divergence theorem. Negative means the faces point inward.')}
        {e && cell('After modifiers', `${e.verts} verts, ${e.faces} faces`)}
      </div>
    </Section>
  );
}

function Modifiers({ editor }: { editor: Editor }) {
  const o = editor.activeObject!;
  const upd = (i: number, p: Partial<Modifier>) => editor.updateModifier(o.id, i, p);
  return (
    <Section title="MODIFIERS">
      {o.modifiers.map((m, i) => (
        <div key={i} style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 4, padding: 6, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <input type="checkbox" checked={m.enabled} onChange={(e) => upd(i, { enabled: e.target.checked })} />
            <b style={{ flex: 1 }}>{m.type === 'mirror' ? 'Mirror' : 'Subdivision surface'}</b>
            <Btn small onClick={() => editor.removeModifier(o.id, i)} title="Remove">✕</Btn>
          </div>
          {m.type === 'mirror' ? (
            <>
              <Row label="Axis">{(['x', 'y', 'z'] as const).map((a) => <Btn key={a} small active={m.axis === a} onClick={() => upd(i, { axis: a })}>{a.toUpperCase()}</Btn>)}</Row>
              <Row label="Clipping"><input type="checkbox" checked={m.clip} onChange={(e) => upd(i, { clip: e.target.checked })} /><span style={{ color: C.faint, fontSize: 11 }}>seam vertices stay on the plane</span></Row>
              <Row label="Merge"><NumberField value={m.merge} step={0.001} digits={4} onCommit={(v) => upd(i, { merge: Math.max(0, v) })} /></Row>
            </>
          ) : (
            <>
              <Row label="Levels"><NumberField value={m.levels} step={1} digits={0} onCommit={(v) => upd(i, { levels: Math.min(4, Math.max(0, Math.round(v))) })} /><span style={{ color: C.faint, fontSize: 11 }}>each level ×4 faces</span></Row>
              <Row label="Smooth UVs"><input type="checkbox" checked={m.uvSmooth !== false} onChange={(e) => upd(i, { uvSmooth: e.target.checked })} /><span style={{ color: C.faint, fontSize: 11 }}>texture follows the smoothed surface; island edges stay</span></Row>
            </>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Btn small onClick={() => editor.addModifier(o.id, 'mirror')}>+ Mirror</Btn>
        <Btn small onClick={() => editor.addModifier(o.id, 'subsurf')}>+ Subdivision</Btn>
        {o.modifiers.length > 0 && <Btn small onClick={() => editor.applyModifiers(o.id)} title="Bake the modifiers into the mesh">Apply all</Btn>}
      </div>
    </Section>
  );
}

function EditInspector({ editor }: { editor: Editor }) {
  const o = editor.editObject!;
  const m = o.mesh!;
  const verts = editor.selectedVerts(), faces = editor.selectedFaces(), edges = editor.selectedEdges();
  const world = editor.scene.worldMatrix(o);
  const toWorld = (p: Vec3) => { const v = new THREE.Vector3(...p).applyMatrix4(world); return [v.x, v.y, v.z] as Vec3; };
  const mode = editor.selectMode;
  return (
    <>
      <Section title={`EDITING ${o.name.toUpperCase()}`}>
        <div style={{ color: C.dim, lineHeight: 1.6 }}>
          {mode === 'vert' ? `${verts.length} vert${verts.length === 1 ? 'ex' : 'ices'}` : mode === 'edge' ? `${edges.length} edge${edges.length === 1 ? '' : 's'}` : `${faces.length} face${faces.length === 1 ? '' : 's'}`} selected of {mode === 'vert' ? m.verts.length : mode === 'edge' ? m.edges().size : m.faces.length}
        </div>
        {mode === 'vert' && verts.length === 1 && <VertexCard editor={editor} v={verts[0]} toWorld={toWorld} />}
        {mode === 'edge' && edges.length === 1 && <EdgeCard m={m} e={edges[0]} />}
        {mode === 'face' && faces.length === 1 && <FaceCard m={m} f={faces[0]} />}
        {verts.length > 1 && (() => {
          const c = verts.reduce<Vec3>((s, i) => [s[0] + m.verts[i][0], s[1] + m.verts[i][1], s[2] + m.verts[i][2]], [0, 0, 0]).map((x) => x / verts.length) as Vec3;
          return <div style={{ marginTop: 6, fontFamily: C.mono, color: C.dim }}>median {f3(c)}</div>;
        })()}
        {verts.length === 0 && <div style={{ color: C.faint, fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>Click to select, Shift+click to add, B to box select, A for all. 1 / 2 / 3 switch vertices / edges / faces.</div>}
      </Section>
      <MeshStats mesh={m} evaluated={null} />
      <Section title="GPU DATA" open={false}>
        <GpuData m={m} />
      </Section>
    </>
  );
}

function VertexCard({ editor, v, toWorld }: { editor: Editor; v: number; toWorld: (p: Vec3) => Vec3 }) {
  const m = editor.editObject!.mesh!;
  const p = m.verts[v], n = m.vertexNormal(v), nb = m.neighbourVerts(v);
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ color: C.accent, fontFamily: C.mono, marginBottom: 6 }}>VERTEX {v}</div>
      <Row label="Local">{[0, 1, 2].map((i) => <NumberField key={i} label={'XYZ'[i]} color={[C.x, C.y, C.z][i]} value={p[i]} onCommit={(x) => { const q = [...p] as Vec3; q[i] = x; editor.setVerts({ [v]: q }, 'Move vertex'); }} width={52} />)}</Row>
      <Row label="World"><span style={{ fontFamily: C.mono }}>{f3(toWorld(p))}</span></Row>
      <Row label="Normal"><span style={{ fontFamily: C.mono }}>{f3(n)}</span></Row>
      <Row label="Valence"><span style={{ fontFamily: C.mono }}>{nb.length} edges → {nb.join(', ')}</span></Row>
      <div style={{ color: C.faint, fontSize: 11 }}>World = the object's world matrix × local. The normal averages the faces around the vertex, weighted by area.</div>
      <VertexSkin editor={editor} v={v} />
    </div>
  );
}

function EdgeCard({ m, e }: { m: EditMesh; e: [number, number] }) {
  const info = m.edges().get(EditMesh.edgeKey(e[0], e[1]));
  const p = m.verts[e[0]], q = m.verts[e[1]];
  const n = info?.faces.length ?? 0;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ color: C.accent, fontFamily: C.mono, marginBottom: 6 }}>EDGE {e[0]}–{e[1]}</div>
      <Row label="From"><span style={{ fontFamily: C.mono }}>{f3(p)}</span></Row>
      <Row label="To"><span style={{ fontFamily: C.mono }}>{f3(q)}</span></Row>
      <Row label="Length"><span style={{ fontFamily: C.mono }}>{Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]).toFixed(4)}</span></Row>
      <Row label="Faces"><span style={{ fontFamily: C.mono, color: n === 2 ? C.ok : n === 1 ? C.warn : C.bad }}>{n} — {n === 2 ? 'manifold' : n === 1 ? 'boundary (open)' : 'non-manifold'}</span></Row>
      <div style={{ color: C.faint, fontSize: 11 }}>Ctrl+R cuts a loop through the ring of quads this edge crosses.</div>
    </div>
  );
}

function FaceCard({ m, f }: { m: EditMesh; f: number }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ color: C.accent, fontFamily: C.mono, marginBottom: 6 }}>FACE {f}</div>
      <Row label="Corners"><span style={{ fontFamily: C.mono }}>[{m.faces[f].join(', ')}] ({m.faces[f].length}-gon)</span></Row>
      <Row label="Normal"><span style={{ fontFamily: C.mono }}>{f3(m.faceNormal(f))}</span></Row>
      <Row label="Centre"><span style={{ fontFamily: C.mono }}>{f3(m.faceCenter(f))}</span></Row>
      <Row label="Area"><span style={{ fontFamily: C.mono }}>{m.faceArea(f).toFixed(4)}</span></Row>
      <div style={{ color: C.faint, fontSize: 11 }}>The corner order is counter-clockwise seen from outside; the normal follows the right-hand rule (Newell's method, using every corner).</div>
    </div>
  );
}

function GpuData({ m }: { m: EditMesh }) {
  const t = m.triangulate();
  const nv = Math.min(4, m.verts.length), nt = Math.min(4, t.faceIndex.length);
  return (
    <div style={{ fontFamily: C.mono, fontSize: 11, lineHeight: 1.6 }}>
      <div style={{ color: C.dim, fontFamily: 'inherit' }}>geometry.attributes.position: Float32Array({t.positions.length})</div>
      {Array.from({ length: nv }, (_, i) => <div key={i}>v{i}: {Array.from(t.positions.slice(i * 3, i * 3 + 3)).map((x) => x.toFixed(3)).join(', ')}</div>)}
      {m.verts.length > nv && <div style={{ color: C.faint }}>… {m.verts.length - nv} more</div>}
      <div style={{ color: C.dim, marginTop: 6 }}>geometry.index: Uint32Array({t.indices.length})</div>
      {Array.from({ length: nt }, (_, i) => <div key={i}>tri {i}: [{Array.from(t.indices.slice(i * 3, i * 3 + 3)).join(', ')}] ← face {t.faceIndex[i]}</div>)}
      {t.faceIndex.length > nt && <div style={{ color: C.faint }}>… {t.faceIndex.length - nt} more</div>}
      <div style={{ color: C.faint, fontFamily: 'system-ui', marginTop: 6 }}>The GPU only draws triangles. Each quad is fanned into two triangles that share its first corner; the model keeps the quad.</div>
    </div>
  );
}

/** A camera: its lens, the render size, and the buttons to look through it and render a still. */
function CameraPanel({ editor, controls }: { editor: Editor; controls: CameraControls }) {
  const o = editor.activeObject!;
  const fov = o.camera?.fov ?? 50, { width, height } = controls.renderSize;
  const isScene = editor.scene.activeCamera === o.id;
  return (
    <Section title="CAMERA">
      <Row label="Field of view"><NumberField value={fov} digits={1} step={1} onCommit={(v) => editor.setCameraFov(o.id, v)} /><span style={{ color: C.dim }}>° tall, {horizontalFov(fov, width / height).toFixed(1)}° wide</span></Row>
      <Row label="Near, far"><NumberField value={o.camera?.near ?? 0.1} digits={3} step={0.1} onCommit={(v) => editor.setCameraClip(o.id, 'near', v)} /><NumberField value={o.camera?.far ?? 200} digits={1} step={10} onCommit={(v) => editor.setCameraClip(o.id, 'far', v)} /></Row>
      <Row label="Render size">
        <select data-testid="render-size" value={`${width}x${height}`} onChange={(e) => { const [w, h] = e.target.value.split('x').map(Number); controls.setRenderSize(w, h); }}
          style={{ background: C.panel2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 3, fontSize: 12 }}>
          {RENDER_SIZES.map((r) => <option key={r.label} value={`${r.width}x${r.height}`}>{r.label}</option>)}
        </select>
      </Row>
      <div style={{ color: C.dim, margin: '6px 0' }}>
        {isScene ? '✓ The scene camera: stills are rendered from it.' : <Btn small onClick={() => editor.setActiveCamera(o.id)}>Make it the scene camera</Btn>}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <Btn small onClick={controls.lookThrough} title="0">{controls.through ? 'Leave the camera view (0)' : 'Look through (0)'}</Btn>
        <Btn small onClick={controls.render} title="Render the scene camera's view to a PNG">Render still (PNG)</Btn>
      </div>
      <div style={{ color: C.faint, marginTop: 6, lineHeight: 1.5 }}>A camera looks down its own −z axis. The pyramid is what it sees (its field of view, in the render’s shape); the triangle marks its up. Tall and wide angles are related by tan(wide/2) = tan(tall/2) × width/height.</div>
    </Section>
  );
}
