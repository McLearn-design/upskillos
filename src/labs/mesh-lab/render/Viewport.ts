// The viewport: draws the scene model with three.js and turns pointer input
// into editor commands. It owns no scene data. Everything drawn here is built
// from editor.scene and rebuilt when the editor says it changed.
//
//   object mode   evaluated meshes (modifiers applied), outline on selection,
//                 a gizmo that edits the active object's local transform
//   edit mode     the cage: vertices, edges, faces of the mesh you edit, with a
//                 gizmo at the centre of the selection that moves those vertices
//   trace         a recorded algorithm step drawn over the object: the mesh as it
//                 stood at that step, the elements involved, points and arrows
//   motion path   where an animated object's origin goes, frame by frame, with its
//                 keyframes marked (its parents' animation included)
//   heat map      a per-vertex field (distance, curvature, ...) coloured over the
//                 object in place of its material, with iso-lines

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import type { Editor } from '../core/Editor';
import { EditMesh, type MeshSnapshot, type Vec3 } from '../core/EditMesh';
import { evaluatedMesh, skinSignature } from '../core/evaluate';
import type { SceneObject } from '../core/Scene';
import type { Trace, TraceStep } from '../core/trace';
import { fieldRange, vertexColors } from '../core/fields';
import { contours, levelsFor } from '../core/geometry';
import { hasKeys, keyFrames } from '../core/animation';
import { evaluateUV, uvFits, type UVLayer } from '../core/uv';
import { DEFAULT_CUSTOM, VERTEX_SHADER, fragmentShader, textureRGBA, type TextureName } from '../core/shading';
import { boneLength, boneMatrices } from '../core/armature';

export type GizmoMode = 'translate' | 'rotate' | 'scale';
export interface ViewOptions { grid: boolean; axes: boolean; localAxes: boolean; normals: boolean; wire: boolean; xray: boolean }

const COL = {
  bg: 0x1d1f23, grid: 0x3a3d44, gridCenter: 0x555a63,
  select: 0xff9f1c, active: 0xffc15e, cageEdge: 0x0d0f12, cageVert: 0x111111,
  selVert: 0xff9f1c, selEdge: 0xff9f1c, selFace: 0xff9f1c,
  traceFace: 0xf59e0b, traceEdge: 0xfbbf24, traceVert: 0xfde047,
};

interface ObjView { matKey?: string; bones?: THREE.Group; bonesSig?: string; group: THREE.Group; body?: THREE.Mesh; outline?: THREE.LineSegments; wire?: THREE.LineSegments; normals?: THREE.LineSegments; axes?: THREE.AxesHelper; light?: THREE.DirectionalLight; helper?: THREE.Object3D; sig: string }

function signature(o: SceneObject): string {
  if (!o.mesh) return 'none';
  let h = 2166136261;
  const mix = (x: number) => { h ^= Math.round(x * 1e6) | 0; h = Math.imul(h, 16777619); };
  for (const v of o.mesh.verts) { mix(v[0]); mix(v[1]); mix(v[2]); }
  for (const f of o.mesh.faces) { mix(f.length); for (const i of f) mix(i); }
  return `${o.mesh.verts.length}/${o.mesh.faces.length}/${h}/${JSON.stringify(o.modifiers)}/${o.smooth}`;
}

/** An indexed BufferGeometry from an EditMesh: fan triangles, plus which face each triangle came from. */
export function toGeometry(mesh: EditMesh | MeshSnapshot): { geo: THREE.BufferGeometry; faceIndex: Uint32Array } {
  const m = mesh instanceof EditMesh ? mesh : EditMesh.fromSnapshot(mesh);
  const t = m.triangulate();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(t.positions, 3));
  geo.setIndex(new THREE.BufferAttribute(t.indices, 1));
  geo.computeVertexNormals();
  return { geo, faceIndex: t.faceIndex };
}

/**
 * A geometry with UVs: every triangle corner its own vertex (UVs can differ on each
 * side of a seam), normals smooth (area-weighted per vertex) or flat (per face).
 */
export function toGeometryUV(m: EditMesh, uv: UVLayer, smooth: boolean): THREE.BufferGeometry {
  const vn: number[][] = m.verts.map(() => [0, 0, 0]);
  const fns = m.faces.map((f) => {
    let n: Vec3 = [0, 0, 0];
    for (let i = 1; i + 1 < f.length; i++) {
      const a = m.verts[f[0]], b = m.verts[f[i]], c = m.verts[f[i + 1]];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      n = [n[0] + u[1] * w[2] - u[2] * w[1], n[1] + u[2] * w[0] - u[0] * w[2], n[2] + u[0] * w[1] - u[1] * w[0]];
    }
    if (smooth) for (const v of f) { vn[v][0] += n[0]; vn[v][1] += n[1]; vn[v][2] += n[2]; }
    const l = Math.hypot(...n) || 1;
    return [n[0] / l, n[1] / l, n[2] / l];
  });
  const unit = (n: number[]) => { const l = Math.hypot(n[0], n[1], n[2]) || 1; return [n[0] / l, n[1] / l, n[2] / l]; };
  const pos: number[] = [], nor: number[] = [], uvs: number[] = [];
  m.faces.forEach((f, fi) => {
    for (let i = 1; i + 1 < f.length; i++) for (const k of [0, i, i + 1]) {
      pos.push(...m.verts[f[k]]);
      nor.push(...(smooth ? unit(vn[f[k]]) : fns[fi]));
      uvs.push(uv.faces[fi][k][0], uv.faces[fi][k][1]);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return g;
}

/** Line segments along the model's own edges: quads show as quads, not as two triangles. */
export function edgeLines(mesh: EditMesh, keys?: Iterable<string>): THREE.BufferGeometry {
  const pos: number[] = [];
  const edges = keys ? [...keys].map((k) => k.split('-').map(Number)) : [...mesh.edges().values()].map((e) => [e.a, e.b]);
  for (const [a, b] of edges) { const p = mesh.verts[a], q = mesh.verts[b]; if (p && q) pos.push(...p, ...q); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

export class Viewport {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly orbit: OrbitControls;
  readonly gizmo: TransformControls;
  readonly labels: HTMLDivElement;
  options: ViewOptions = { grid: true, axes: true, localAxes: true, normals: false, wire: false, xray: false };
  gizmoMode: GizmoMode = 'translate';
  boxArmed = false;
  /** Called when the box-select state changes, so the UI can show it. */
  onBoxChange?: (armed: boolean) => void;

  private views = new Map<string, ObjView>();
  private root = new THREE.Group();
  private grid: THREE.GridHelper;
  private worldAxes: THREE.AxesHelper;
  private cage = new THREE.Group();
  private pickMesh: { mesh: THREE.Mesh; faceIndex: Uint32Array } | null = null;
  private traceGroup = new THREE.Group();
  private traceLabels: { p: THREE.Vector3; text: string; color: string; parent: THREE.Object3D }[] = [];
  private proxy = new THREE.Object3D();
  private drag: { kind: 'object' | 'verts' | 'bone' | 'joint'; start: Vec3[]; startMatrix: THREE.Matrix4; verts: number[]; bone?: string; base?: THREE.Quaternion; from?: THREE.Vector3 } | null = null;
  private traceView: { trace: Trace; step: number } | null = null;
  private fieldGroup = new THREE.Group();
  private pathGroup = new THREE.Group();
  private textures = new Map<TextureName, THREE.DataTexture>();
  private white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  /** Custom shaders that failed to compile: the GLSL that failed and the compiler's message. */
  readonly shaderErrors = new Map<string, { glsl: string; message: string }>();
  /** Called when a custom shader fails to compile (or compiles again after a fix). */
  onShaderError?: (objectId: string, message: string | null) => void;
  /** Weight paint: the brush outline, and the last dab of the stroke in progress. */
  private brushRing: THREE.Mesh | null = null;
  private painting: { last: THREE.Vector3 } | null = null;
  private pathKey = '';
  private fieldDrawn: { field: unknown; contours: boolean } = { field: null, contours: true };
  private raf = 0;
  private resize: ResizeObserver;
  private unsub: () => void;
  private down: { x: number; y: number; shift: boolean; ctrl: boolean } | null = null;
  private box: HTMLDivElement;
  private hover = { x: -1, y: -1 };
  private ownsCanvas: boolean;

  constructor(private container: HTMLElement, private editor: Editor, canvas?: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.ownsCanvas = !canvas;
    if (!canvas) container.appendChild(this.renderer.domElement);
    const el = this.renderer.domElement;
    el.style.display = 'block'; el.style.width = '100%'; el.style.height = '100%'; el.style.outline = 'none';
    el.tabIndex = 0;

    this.scene.background = new THREE.Color(COL.bg);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    this.camera.position.set(6, 4.5, 7);
    this.orbit = new OrbitControls(this.camera, el);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.15;

    this.scene.add(new THREE.HemisphereLight(0xdfe6f5, 0x2a2622, 0.9));
    this.grid = new THREE.GridHelper(20, 20, COL.gridCenter, COL.grid);
    this.worldAxes = new THREE.AxesHelper(1.5);
    (this.worldAxes.material as THREE.Material).depthTest = false;
    this.worldAxes.renderOrder = 2;
    this.scene.add(this.grid, this.worldAxes, this.root);

    // A custom shader that does not compile: find whose GLSL it was, remember the message,
    // and draw that object with Lambert until the code changes.
    this.renderer.debug.onShaderError = (gl, program, _vs, fs) => {
      const src = gl.getShaderSource(fs) ?? '';
      // Line numbers count the whole program three compiled; turn them into lines of the shade() body.
      const lines = src.split('\n'), start = lines.findIndex((l) => l.startsWith('vec3 shade(')) + 2;
      const message = ([gl.getShaderInfoLog(fs), gl.getProgramInfoLog(program)].filter(Boolean).join('\n').trim() || 'The shader did not compile')
        .replace(/ERROR: 0:(\d+):/g, (_m, n: string) => (start > 1 && +n >= start ? `line ${+n - start + 1} of your code:` : `line ${n}:`));
      for (const o of this.editor.scene.objects) {
        const glsl = o.material.glsl || DEFAULT_CUSTOM;
        if (o.material.shader === 'custom' && src.includes(glsl.split('\n').filter((l) => l.trim()).at(-1)!.trim())) {
          this.shaderErrors.set(o.id, { glsl, message });
          this.onShaderError?.(o.id, message);
        }
      }
      queueMicrotask(() => this.sync());
    };
    this.white.needsUpdate = true;

    this.gizmo = new TransformControls(this.camera, el);
    const g = this.gizmo as unknown as { getHelper?: () => THREE.Object3D };
    this.scene.add(typeof g.getHelper === 'function' ? g.getHelper() : (this.gizmo as unknown as THREE.Object3D));
    this.gizmo.addEventListener('dragging-changed', (e) => { this.orbit.enabled = !(e as unknown as { value: boolean }).value; });
    this.gizmo.addEventListener('mouseDown', () => this.dragStart());
    this.gizmo.addEventListener('objectChange', () => this.dragMove());
    this.gizmo.addEventListener('mouseUp', () => this.dragEnd());

    this.labels = document.createElement('div');
    Object.assign(this.labels.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden', font: '11px ui-monospace, SFMono-Regular, Menlo, monospace' });
    this.box = document.createElement('div');
    Object.assign(this.box.style, { position: 'absolute', border: '1px dashed #ffb347', background: 'rgba(255,179,71,0.08)', display: 'none', pointerEvents: 'none' });
    container.style.position = container.style.position || 'relative';
    container.append(this.labels, this.box);

    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointerleave', () => { this.hover = { x: -1, y: -1 }; });

    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(container);
    this.fit();
    this.unsub = editor.subscribe((k) => { if (k !== 'trace') this.sync(); });
    this.sync();
    this.frameAll();
    const loop = () => { this.raf = requestAnimationFrame(loop); this.orbit.update(); this.renderer.render(this.scene, this.camera); this.drawLabels(); };
    loop();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.unsub();
    this.resize.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerup', this.onUp);
    this.gizmo.detach(); this.gizmo.dispose(); this.orbit.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose?.();
    });
    this.renderer.dispose();
    // Remove the canvas we created: React mounts twice in development, and a
    // left-over canvas would sit on top of the live one, frozen and deaf to clicks.
    if (this.ownsCanvas) el.remove();
    this.labels.remove(); this.box.remove();
  }

  private fit(): void {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ── building the three.js scene from the model ─────────────────────────

  sync(): void {
    const scene = this.editor.scene;
    const ids = new Set(scene.objects.map((o) => o.id));
    for (const [id, v] of this.views) if (!ids.has(id)) { v.group.removeFromParent(); this.disposeView(v); this.views.delete(id); }
    for (const o of scene.objects) this.syncObject(o);
    // Parent/child: nest the groups exactly as the model nests the objects.
    for (const o of scene.objects) {
      const v = this.views.get(o.id)!;
      const parent = o.parent ? this.views.get(o.parent)?.group : this.root;
      if (parent && v.group.parent !== parent) parent.add(v.group);
    }
    this.grid.visible = this.options.grid;
    this.worldAxes.visible = this.options.axes;
    this.syncCage();
    this.syncGizmo();
    this.syncField();
    this.syncPath();
    this.syncTrace();
  }

  /** The active object's motion path in world space: a line through every frame, dots at its keys. */
  private syncPath(): void {
    const sc = this.editor.scene, o = this.editor.activeObject;
    const chain = o ? sc.ancestry(o) : [];
    const animated = chain.filter((x) => hasKeys(x.anim));
    const t = sc.timeline;
    const key = o && animated.length ? `${o.id}|${t.start}|${t.end}|${t.frame}|${JSON.stringify(chain.map((x) => [x.anim ?? null, x.position, x.rotation, x.scale, x.parent]))}` : '';
    if (key === this.pathKey) return;
    this.pathKey = key;
    this.disposeGroup(this.pathGroup);
    if (!o || !key) return;
    const at = (f: number) => new THREE.Vector3().setFromMatrixPosition(sc.worldMatrixAt(o, f));
    const pts: number[] = [];
    for (let f = t.start; f <= t.end; f++) pts.push(...at(f).toArray());
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x5aa9ff, transparent: true, opacity: 0.8, depthTest: false }));
    const frames = new THREE.Points(lg.clone(), new THREE.PointsMaterial({ color: 0x9cc9ff, size: 3, sizeAttenuation: false, depthTest: false, transparent: true }));
    const keys = [...new Set(animated.flatMap((x) => keyFrames(x.anim)))].filter((f) => f >= t.start && f <= t.end);
    const kg = new THREE.BufferGeometry(); kg.setAttribute('position', new THREE.Float32BufferAttribute(keys.flatMap((f) => at(f).toArray()), 3));
    const keyDots = new THREE.Points(kg, new THREE.PointsMaterial({ color: 0xff9f1c, size: 9, sizeAttenuation: false, depthTest: false, transparent: true }));
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(at(t.frame).toArray(), 3));
    const now = new THREE.Points(cg, new THREE.PointsMaterial({ color: 0xffffff, size: 7, sizeAttenuation: false, depthTest: false, transparent: true }));
    for (const x of [line, frames, keyDots, now]) { x.renderOrder = 7; this.pathGroup.add(x); }
    this.scene.add(this.pathGroup);
  }

  /** The heat map: the field's mesh with a colour per vertex, iso-lines, and its source vertices. */
  private syncField(): void {
    const f = this.editor.field;
    const v = f ? this.views.get(f.objectId) : undefined;
    const hidden = !!(this.traceView && f && this.traceTargetId() === f.objectId);
    if (f === this.fieldDrawn.field && this.editor.showContours === this.fieldDrawn.contours && (!v || this.fieldGroup.parent === v.group)) {
      this.fieldGroup.visible = !hidden;
      return;
    }
    this.fieldDrawn = { field: f, contours: this.editor.showContours };
    this.disposeGroup(this.fieldGroup);
    if (!f || !v) return;
    const o = this.editor.scene.get(f.objectId);
    const { values, range, diverging, contours: count } = f.result;
    this.fieldGroup.add(...this.fieldMeshes(f.mesh, values, { range, diverging, contours: this.editor.showContours ? count : 0, flat: !o?.smooth }));
    if (f.spec.kind === 'geodesic') {
      const pos: number[] = [];
      for (const s of f.spec.sources) if (f.mesh.verts[s]) pos.push(...f.mesh.verts[s]);
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffffff, size: 10, sizeAttenuation: false, depthTest: false, transparent: true }));
      pts.renderOrder = 5; this.fieldGroup.add(pts);
    }
    this.fieldGroup.visible = !hidden;
    v.group.add(this.fieldGroup);
  }

  /** A mesh coloured by a per-vertex field, plus iso-lines of the field. */
  private fieldMeshes(m: EditMesh, values: ArrayLike<number>, o: { range?: [number, number]; diverging?: boolean; log?: boolean; contours?: number; flat?: boolean; opacity?: number }): THREE.Object3D[] {
    const { geo } = toGeometry(m);
    const range = o.range ?? fieldRange(values, !!o.diverging, !!o.diverging);
    const rgb = vertexColors(values, range, !!o.diverging, o.log);
    // The colour maps are defined in sRGB; three.js blends in linear light.
    const c = new THREE.Color();
    for (let i = 0; i < rgb.length; i += 3) { c.setRGB(rgb[i], rgb[i + 1], rgb[i + 2], THREE.SRGBColorSpace); rgb[i] = c.r; rgb[i + 1] = c.g; rgb[i + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    const translucent = (o.opacity ?? 1) < 1;
    const body = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.9, metalness: 0, flatShading: !!o.flat, side: THREE.DoubleSide,
      transparent: translucent, opacity: o.opacity ?? 1, depthWrite: !translucent, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    }));
    const out: THREE.Object3D[] = [body];
    if (o.contours) {
      const segs = contours(m, values, levelsFor(values, o.contours));
      const pos = new Float32Array(segs.length * 6);
      segs.forEach(([a, b], i) => pos.set([...a, ...b], i * 6));
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      out.push(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x0b0d10, transparent: true, opacity: 0.75 })));
    }
    return out;
  }

  private disposeGroup(g: THREE.Group): void {
    g.traverse((o) => { const m = o as THREE.Mesh; if (m !== (g as unknown)) { m.geometry?.dispose?.(); (m.material as THREE.Material | undefined)?.dispose?.(); } });
    g.clear();
    g.removeFromParent();
  }

  private disposeView(v: ObjView): void {
    v.group.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); (m.material as THREE.Material | undefined)?.dispose?.(); });
  }

  private syncObject(o: SceneObject): void {
    let v = this.views.get(o.id);
    if (!v) {
      v = { group: new THREE.Group(), sig: '' };
      v.group.userData.id = o.id;
      this.views.set(o.id, v);
      this.root.add(v.group);
    }
    const g = v.group;
    if (!(this.drag?.kind === 'object' && this.gizmo.object === g)) {
      g.position.set(...o.position);
      g.rotation.set(o.rotation[0], o.rotation[1], o.rotation[2], 'XYZ');
      g.scale.set(...o.scale);
    }
    g.visible = o.visible;
    const selected = this.editor.selected.has(o.id), active = this.editor.active === o.id;
    const editing = this.editor.mode === 'edit' && active;

    if (o.kind === 'mesh' && o.mesh) {
      const uvSig = o.uv ? `${o.uv.faces.length}:${o.uv.faces.reduce((s, f) => s + f.reduce((t, p) => t + p[0] * 7.3 + p[1] * 3.1, 0), 0).toFixed(6)}` : '';
      const sig = signature(o) + skinSignature(this.editor.scene, o) + uvSig;
      if (sig !== v.sig || !v.body) {
        v.sig = sig;
        const ev = evaluatedMesh(this.editor.scene, o, 3);
        // With UVs, carry them through the modifiers and split vertices at seams; without, share vertices.
        const uvEv = uvFits(o.mesh, o.uv) ? evaluateUV(o.mesh, o.uv, o.modifiers, 3, !!o.skin) : null;
        const geo = uvEv && uvFits(ev, uvEv) ? toGeometryUV(ev, uvEv, o.smooth) : toGeometry(ev).geo;
        if (!v.body) {
          v.body = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
          v.body.userData.id = o.id;
          g.add(v.body);
        } else { v.body.geometry.dispose(); v.body.geometry = geo; }
        v.outline?.geometry.dispose();
        const eg = edgeLines(ev);
        if (!v.outline) { v.outline = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: COL.select, transparent: true, opacity: 0.9 })); g.add(v.outline); }
        else v.outline.geometry = eg;
        v.wire?.geometry.dispose();
        const wg = edgeLines(ev);
        if (!v.wire) { v.wire = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })); g.add(v.wire); }
        else v.wire.geometry = wg;
        if (v.normals) { v.normals.geometry.dispose(); v.normals.removeFromParent(); v.normals = undefined; }
        if (this.options.normals) v.normals = this.normalLines(ev, g);
      }
      this.syncMaterial(o, v, editing);
      v.body.visible = !(this.traceView && this.traceTargetId() === o.id) && this.editor.field?.objectId !== o.id;
      v.outline!.visible = selected && !editing && v.body.visible;
      (v.outline!.material as THREE.LineBasicMaterial).color.set(active ? COL.active : COL.select);
      v.wire!.visible = this.options.wire && v.body.visible;
      if (this.options.normals && !v.normals) v.normals = this.normalLines(evaluatedMesh(this.editor.scene, o, 3), g);
      if (v.normals) v.normals.visible = this.options.normals;
    }

    if (o.kind === 'light') {
      if (!v.light) {
        v.light = new THREE.DirectionalLight(0xffffff, 2);
        g.add(v.light, v.light.target);
        v.light.target.position.set(0, 0, 0);
        const helper = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
        helper.userData.id = o.id;
        v.helper = helper; g.add(helper);
      }
      v.light.color.set(o.light?.color ?? '#ffffff');
      v.light.intensity = o.light?.intensity ?? 2;
      // A sun shines from its position toward the world origin.
      const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
      v.light.target.position.copy(new THREE.Vector3(0, 0, 0).applyMatrix4(inv));
      ((v.helper as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(selected ? COL.select : 0xffe08a);
    }
    if (o.kind === 'armature' && o.bones) this.syncBones(o, v, selected);

    if (o.kind === 'empty' && !v.helper) {
      const h = new THREE.AxesHelper(0.6);
      const pick = new THREE.Mesh(new THREE.SphereGeometry(0.12), new THREE.MeshBasicMaterial({ color: 0x9aa4b2, wireframe: true }));
      pick.userData.id = o.id;
      v.helper = pick; g.add(h, pick);
    }
    if (o.kind === 'empty' && v.helper) ((v.helper as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(selected ? COL.select : 0x9aa4b2);

    // Local axes of the active object: its own x, y, z after rotation and scale.
    if (active && this.options.localAxes && o.kind === 'mesh') {
      if (!v.axes) { v.axes = new THREE.AxesHelper(1); (v.axes.material as THREE.Material).depthTest = false; v.axes.renderOrder = 3; g.add(v.axes); }
      v.axes.visible = true;
    } else if (v.axes) v.axes.visible = false;
  }

  private texture(name: TextureName): THREE.DataTexture {
    let t = this.textures.get(name);
    if (!t) {
      t = new THREE.DataTexture(textureRGBA(name, 256), 256, 256);
      t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
      t.needsUpdate = true;
      this.textures.set(name, t);
    }
    return t;
  }

  /**
   * The body's material: three's PBR material, or one of MeshLab's shaders built
   * from core/shading.ts (rebuilt when the model, texture or GLSL changes; uniforms
   * updated every sync). A custom shader that failed to compile falls back to Lambert.
   */
  private syncMaterial(o: SceneObject, v: ObjView, editing: boolean): void {
    const m = o.material, tex = m.texture && m.texture !== 'none' ? m.texture : null;
    const bad = m.shader === 'custom' && this.shaderErrors.get(o.id)?.glsl === (m.glsl || DEFAULT_CUSTOM);
    const model = bad ? 'lambert' : m.shader ?? 'pbr';
    const key = `${model}|${tex}|${model === 'custom' ? m.glsl : ''}|${o.smooth}`;
    if (v.matKey !== key) {
      v.matKey = key;
      (v.body!.material as THREE.Material).dispose();
      if (model === 'pbr') {
        v.body!.material = new THREE.MeshStandardMaterial({ map: tex ? this.texture(tex).clone() : null });
      } else {
        v.body!.material = new THREE.ShaderMaterial({
          vertexShader: VERTEX_SHADER, fragmentShader: fragmentShader(model, m.glsl || DEFAULT_CUSTOM, !o.smooth),
          uniforms: {
            uBase: { value: new THREE.Color() }, uMap: { value: tex ? this.texture(tex) : this.white }, uHasMap: { value: tex ? 1 : 0 },
            uUvScale: { value: new THREE.Vector2(1, 1) }, uLightDir: { value: new THREE.Vector3(0.5, 1, 0.3) }, uLightColor: { value: new THREE.Color(1, 1, 1) },
            uSky: { value: new THREE.Color(0xdfe6f5).multiplyScalar(0.32) }, uGround: { value: new THREE.Color(0x2a2622).multiplyScalar(0.32) },
            uShininess: { value: 40 }, uSpecular: { value: 0.5 }, uBands: { value: 3 }, uOpacity: { value: 1 },
          },
        });
      }
      if (!bad && this.shaderErrors.delete(o.id)) this.onShaderError?.(o.id, null);
    }
    const transparent = this.options.xray || editing, opacity = this.options.xray ? 0.45 : editing ? 0.85 : 1;
    const scale = m.textureScale ?? 1;
    const mat = v.body!.material;
    if (mat instanceof THREE.MeshStandardMaterial) {
      mat.color.set(m.color); mat.roughness = m.roughness; mat.metalness = m.metalness;
      if (mat.map) mat.map.repeat.set(scale, scale);
      if (mat.flatShading !== !o.smooth) { mat.flatShading = !o.smooth; mat.needsUpdate = true; }
      mat.transparent = transparent; mat.opacity = opacity; mat.depthWrite = !transparent;
    } else if (mat instanceof THREE.ShaderMaterial) {
      const u = mat.uniforms;
      (u.uBase.value as THREE.Color).set(m.color);
      (u.uUvScale.value as THREE.Vector2).set(scale, scale);
      u.uShininess.value = m.shininess ?? 40; u.uSpecular.value = 0.9 * (1 - m.roughness); u.uOpacity.value = opacity;
      // The sun: from its position toward the origin, its colour times its strength.
      const sun = this.editor.scene.objects.find((x) => x.kind === 'light');
      if (sun) {
        const p = new THREE.Vector3().setFromMatrixPosition(this.editor.scene.worldMatrix(sun));
        (u.uLightDir.value as THREE.Vector3).copy(p.lengthSq() > 0 ? p.normalize() : new THREE.Vector3(0, 1, 0));
        (u.uLightColor.value as THREE.Color).set(sun.light?.color ?? '#ffffff').multiplyScalar((sun.light?.intensity ?? 2.5) * 0.4);
      }
      mat.transparent = transparent; mat.depthWrite = !transparent;
    }
  }

  /**
   * Bones drawn as Blender does: an octahedron from head to tail, fat near the
   * head. They are drawn in front of the mesh so they can be seen and clicked
   * inside a character. In pose mode the active bone is blue.
   */
  private syncBones(o: SceneObject, v: ObjView, selected: boolean): void {
    const ed = this.editor, posing = ed.mode === 'pose' && ed.active === o.id, editing = ed.mode === 'bones' && ed.active === o.id;
    const sig = `${JSON.stringify(o.bones)}|${posing}|${editing}|${ed.activeBone}|${JSON.stringify(ed.boneSel)}|${selected}`;
    if (sig === v.bonesSig && v.bones) return;
    v.bonesSig = sig;
    if (v.bones) { this.disposeGroup(v.bones); }
    const g = new THREE.Group();
    let mats: ReturnType<typeof boneMatrices>;
    // Editing bones shows the rest pose (as Blender's edit mode does); otherwise the pose.
    const rest = editing ? new Map(o.bones!.map((b) => [b.name, [0, 0, 0] as Vec3])) : undefined;
    try { mats = boneMatrices(o.bones!, rest); } catch { v.bones = g; v.group.add(g); return; }
    for (const b of o.bones!) {
      const L = Math.max(1e-4, boneLength(b)), w = 0.1 * L;
      const P = [[0, 0, 0], [w, 0.1 * L, 0], [0, 0.1 * L, w], [-w, 0.1 * L, 0], [0, 0.1 * L, -w], [0, L, 0]];
      const tri = [[0, 2, 1], [0, 3, 2], [0, 4, 3], [0, 1, 4], [5, 1, 2], [5, 2, 3], [5, 3, 4], [5, 4, 1]];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(tri.flat().flatMap((i) => P[i]), 3));
      geo.computeVertexNormals();
      const active = (posing || editing) && b.name === ed.activeBone;
      const wholeBone = editing && ed.boneSel?.bone === b.name && ed.boneSel.part === 'body';
      const color = wholeBone ? 0xff9f1c : active ? 0x5aa9ff : posing || editing ? 0x8fa3b8 : selected ? 0xffb347 : 0xb8bec8;
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.6, flatShading: true, transparent: true, opacity: 0.92, depthTest: false }));
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: active ? 0xe8f2ff : 0x15181c, depthTest: false, transparent: true }));
      for (const x of [m, edges]) { x.matrixAutoUpdate = false; x.matrix.copy(mats.get(b.name)!.posed); x.renderOrder = 8; x.userData.id = o.id; x.userData.bone = b.name; }
      g.add(m, edges);
      if (editing) {
        // Joints: a sphere at the head and at the tail, the selected one orange.
        for (const part of ['head', 'tail'] as const) {
          const on = ed.boneSel?.bone === b.name && (ed.boneSel.part === part || ed.boneSel.part === 'body');
          const s = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.025, 0.06 * L), 12, 8), new THREE.MeshBasicMaterial({ color: on ? 0xff9f1c : 0xdfe3ea, depthTest: false, transparent: true }));
          s.position.set(...(part === 'head' ? b.head : b.tail)); s.renderOrder = 9;
          g.add(s);
        }
      }
    }
    v.bones = g;
    v.group.add(g);
  }

  private normalLines(mesh: EditMesh, parent: THREE.Object3D): THREE.LineSegments {
    const pos: number[] = [];
    const size = Math.max(0.05, Math.sqrt(mesh.area() / Math.max(1, mesh.faces.length)) * 0.6);
    mesh.faces.forEach((_, fi) => { const c = mesh.faceCenter(fi), n = mesh.faceNormal(fi); pos.push(...c, c[0] + n[0] * size, c[1] + n[1] * size, c[2] + n[2] * size); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x38bdf8 }));
    parent.add(l);
    return l;
  }

  /** The edit cage: every vertex, edge and face of the mesh being edited, selection highlighted. */
  private syncCage(): void {
    this.cage.traverse((o) => { const m = o as THREE.Mesh; if (m !== (this.cage as unknown)) { m.geometry?.dispose?.(); (m.material as THREE.Material | undefined)?.dispose?.(); } });
    this.cage.clear();
    this.cage.removeFromParent();
    this.pickMesh = null;
    const o = this.editor.editObject;
    if (!o?.mesh || this.traceView) return;
    const v = this.views.get(o.id);
    if (!v) return;
    const mesh = o.mesh, ed = this.editor;
    const selV = new Set(ed.selectedVerts()), selF = new Set(ed.selectedFaces());
    const selE = new Set(ed.selectedEdges().map(([a, b]) => EditMesh.edgeKey(a, b)));

    const { geo, faceIndex } = toGeometry(mesh);
    const pick = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
    this.pickMesh = { mesh: pick, faceIndex };
    this.cage.add(pick);

    if (selF.size) {
      const sub = new EditMesh(mesh.verts, mesh.faces.filter((_, i) => selF.has(i)));
      const fill = new THREE.Mesh(toGeometry(sub).geo, new THREE.MeshBasicMaterial({ color: COL.selFace, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
      this.cage.add(fill);
    }
    const allKeys = [...mesh.edges().keys()];
    this.cage.add(new THREE.LineSegments(edgeLines(mesh, allKeys.filter((k) => !selE.has(k))), new THREE.LineBasicMaterial({ color: COL.cageEdge, transparent: true, opacity: 0.85, depthTest: !this.options.xray })));
    if (selE.size) this.cage.add(new THREE.LineSegments(edgeLines(mesh, selE), new THREE.LineBasicMaterial({ color: COL.selEdge, depthTest: !this.options.xray })));
    // UV seams, red, as in Blender.
    const seams = (o.seams ?? []).filter((k) => mesh.edges().has(k) && !selE.has(k));
    if (seams.length) this.cage.add(new THREE.LineSegments(edgeLines(mesh, seams), new THREE.LineBasicMaterial({ color: 0xff3b3b, depthTest: !this.options.xray })));

    if (ed.selectMode !== 'face') {
      const pos: number[] = [], col: number[] = [];
      const c1 = new THREE.Color(COL.cageVert), c2 = new THREE.Color(COL.selVert);
      mesh.verts.forEach((p, i) => { pos.push(...p); const c = selV.has(i) ? c2 : c1; col.push(c.r, c.g, c.b); });
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      pg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      this.cage.add(new THREE.Points(pg, new THREE.PointsMaterial({ size: 6, sizeAttenuation: false, vertexColors: true, depthTest: !this.options.xray })));
    } else {
      // Face mode: a dot at each face centre, like Blender.
      const pos: number[] = [];
      mesh.faces.forEach((_, fi) => { if (!selF.has(fi)) pos.push(...mesh.faceCenter(fi)); });
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      this.cage.add(new THREE.Points(pg, new THREE.PointsMaterial({ size: 4, sizeAttenuation: false, color: 0x222222, depthTest: !this.options.xray })));
    }
    v.group.add(this.cage);
  }

  private syncGizmo(): void {
    const ed = this.editor;
    if (this.drag) return;
    if (this.traceView || ed.mode === 'weight') { this.gizmo.detach(); return; }
    this.gizmo.setMode(ed.mode === 'pose' ? 'rotate' : ed.mode === 'bones' ? 'translate' : this.gizmoMode);
    if (ed.mode === 'bones') {
      // A joint (or a whole bone, at its middle) moves; the armature's own axes.
      const o = ed.activeObject, v = o && this.views.get(o.id), sel = ed.boneSel;
      const b = sel && o?.bones?.find((x) => x.name === sel.bone);
      if (!o || !v || !b || !sel) { this.gizmo.detach(); return; }
      const p = sel.part === 'head' ? b.head : sel.part === 'tail' ? b.tail : b.head.map((h, i) => (h + b.tail[i]) / 2) as Vec3;
      if (this.proxy.parent !== v.group) v.group.add(this.proxy);
      this.proxy.position.set(...p); this.proxy.quaternion.identity(); this.proxy.scale.set(1, 1, 1);
      this.proxy.updateMatrix();
      this.gizmo.attach(this.proxy);
      return;
    }
    if (ed.mode === 'pose') {
      // A bone turns about its head: put the gizmo there, lined up with the bone.
      const o = ed.activeObject, v = o && this.views.get(o.id);
      const b = o?.bones?.find((x) => x.name === ed.activeBone);
      if (!o || !v || !b) { this.gizmo.detach(); return; }
      const P = boneMatrices(o.bones!).get(b.name)!.posed;
      if (this.proxy.parent !== v.group) v.group.add(this.proxy);
      P.decompose(this.proxy.position, this.proxy.quaternion, this.proxy.scale);
      this.proxy.scale.set(1, 1, 1);
      this.proxy.updateMatrix();
      this.gizmo.attach(this.proxy);
      return;
    }
    if (ed.mode === 'edit') {
      const o = ed.editObject, verts = ed.selectedVerts();
      const v = o && this.views.get(o.id);
      if (!o?.mesh || !v || !verts.length) { this.gizmo.detach(); return; }
      const c = verts.reduce<Vec3>((s, i) => [s[0] + o.mesh!.verts[i][0], s[1] + o.mesh!.verts[i][1], s[2] + o.mesh!.verts[i][2]], [0, 0, 0]).map((x) => x / verts.length) as Vec3;
      if (this.proxy.parent !== v.group) v.group.add(this.proxy);
      this.proxy.position.set(...c); this.proxy.rotation.set(0, 0, 0); this.proxy.scale.set(1, 1, 1);
      this.proxy.updateMatrix();
      this.gizmo.attach(this.proxy);
    } else {
      const v = ed.active ? this.views.get(ed.active) : undefined;
      if (v && v.group.visible) this.gizmo.attach(v.group); else this.gizmo.detach();
    }
  }

  // ── gizmo drags ─────────────────────────────────────────────────────────

  private dragStart(): void {
    const ed = this.editor;
    ed.beginLive();
    if (ed.mode === 'bones' && ed.boneSel) {
      ed.beginJointDrag();
      this.drag = { kind: 'joint', start: [], startMatrix: new THREE.Matrix4(), verts: [], from: this.proxy.position.clone() };
      return;
    }
    const po = ed.mode === 'pose' ? ed.activeObject : undefined, pb = po?.bones?.find((x) => x.name === ed.activeBone);
    if (po && pb) {
      // The rotation the bone has before its own pose: posed · R(pose)⁻¹. A drag's new
      // orientation Q then gives the pose as R(pose) = base⁻¹ · Q.
      const P = boneMatrices(po.bones!).get(pb.name)!.posed;
      const q = new THREE.Quaternion(); P.decompose(new THREE.Vector3(), q, new THREE.Vector3());
      const base = q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...pb.pose, 'XYZ')).invert());
      this.drag = { kind: 'bone', start: [], startMatrix: new THREE.Matrix4(), verts: [], bone: pb.name, base };
      return;
    }
    if (ed.mode === 'edit' && ed.editObject?.mesh) {
      this.proxy.updateMatrix();
      this.drag = { kind: 'verts', start: ed.editObject.mesh.verts.map((p) => [...p] as Vec3), startMatrix: this.proxy.matrix.clone(), verts: ed.selectedVerts() };
    } else {
      this.drag = { kind: 'object', start: [], startMatrix: new THREE.Matrix4(), verts: [] };
    }
  }

  private dragMove(): void {
    const ed = this.editor, d = this.drag;
    if (!d) return;
    if (d.kind === 'joint') {
      const m = this.proxy.position.clone().sub(d.from!);
      ed.jointDrag([m.x, m.y, m.z]);
      return;
    }
    if (d.kind === 'bone') {
      const b = ed.activeObject?.bones?.find((x) => x.name === d.bone);
      if (!b) return;
      const e = new THREE.Euler().setFromQuaternion(d.base!.clone().invert().multiply(this.proxy.quaternion), 'XYZ');
      b.pose = [e.x, e.y, e.z];
    } else if (d.kind === 'object') {
      const o = ed.activeObject, g = o && this.views.get(o.id)?.group;
      if (!o || !g) return;
      o.position = [g.position.x, g.position.y, g.position.z];
      o.rotation = [g.rotation.x, g.rotation.y, g.rotation.z];
      o.scale = [g.scale.x, g.scale.y, g.scale.z];
    } else {
      const o = ed.editObject;
      if (!o?.mesh) return;
      // The proxy's change since the drag began, in the object's own space:
      // new = D · start, D = proxy · inverse(proxy at start).
      this.proxy.updateMatrix();
      const D = this.proxy.matrix.clone().multiply(d.startMatrix.clone().invert());
      const p = new THREE.Vector3();
      for (const i of d.verts) { p.set(...d.start[i]).applyMatrix4(D); o.mesh.verts[i] = [p.x, p.y, p.z]; }
      ed.clipToMirror(o, d.start, d.verts);
      o.mesh.touch();
    }
    ed.liveUpdate();
  }

  private dragEnd(): void {
    const ed = this.editor, d = this.drag;
    this.drag = null;
    if (!d) return;
    if (d.kind === 'joint') ed.endJointDrag();
    else if (d.kind === 'bone') ed.endBoneDrag(d.bone!);
    else if (d.kind === 'object') ed.endObjectDrag(ed.active ? [ed.active] : [], this.gizmoMode === 'translate' ? 'move' : this.gizmoMode === 'rotate' ? 'rotate' : 'scale');
    else ed.endVertexDrag(d.verts);
  }

  setGizmoMode(m: GizmoMode): void { this.gizmoMode = m; this.gizmo.setMode(m); }
  setSpace(s: 'local' | 'world'): void { this.gizmo.setSpace(s); }
  setSnap(on: boolean): void {
    this.gizmo.setTranslationSnap(on ? 0.25 : null);
    this.gizmo.setRotationSnap(on ? THREE.MathUtils.degToRad(15) : null);
    this.gizmo.setScaleSnap(on ? 0.1 : null);
  }
  setOptions(o: Partial<ViewOptions>): void {
    const normalsChanged = o.normals !== undefined && o.normals !== this.options.normals;
    this.options = { ...this.options, ...o };
    if (normalsChanged) for (const v of this.views.values()) v.sig = '';
    this.sync();
  }

  // ── picking ─────────────────────────────────────────────────────────────

  /** Where the pointer meets the weight-painted mesh, in the object's own coordinates. */
  private paintHit(x: number, y: number): { p: THREE.Vector3; n: THREE.Vector3; group: THREE.Object3D } | null {
    const f = this.editor.field, v = f && this.views.get(f.objectId);
    const body = this.fieldGroup.children.find((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh | undefined;
    if (this.editor.mode !== 'weight' || !v || !body) return null;
    const hit = this.ray(x, y).intersectObject(body, false)[0];
    if (!hit) return null;
    return { p: v.group.worldToLocal(hit.point.clone()), n: (hit.face?.normal ?? new THREE.Vector3(0, 1, 0)).clone(), group: v.group };
  }

  /** The brush outline on the surface under the pointer (weight paint mode). */
  private updateBrush(x: number, y: number): void {
    const h = this.editor.mode === 'weight' ? this.paintHit(x, y) : null;
    if (!h) { if (this.brushRing) this.brushRing.visible = false; return; }
    const r = this.editor.paint.radius;
    if (!this.brushRing || (this.brushRing.userData.r as number) !== r) {
      if (this.brushRing) { this.brushRing.geometry.dispose(); (this.brushRing.material as THREE.Material).dispose(); this.brushRing.removeFromParent(); }
      this.brushRing = new THREE.Mesh(new THREE.RingGeometry(r * 0.93, r, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide }));
      this.brushRing.userData.r = r; this.brushRing.renderOrder = 9;
    }
    if (this.brushRing.parent !== h.group) h.group.add(this.brushRing);
    this.brushRing.position.copy(h.p).addScaledVector(h.n, 0.002);
    this.brushRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), h.n);
    this.brushRing.visible = true;
  }

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    if (this.editor.mode === 'weight') {
      // A press on the mesh paints; anywhere else it orbits as usual.
      const h = this.paintHit(e.offsetX, e.offsetY);
      if (h && this.editor.beginStroke()) {
        this.orbit.enabled = false;
        this.painting = { last: h.p.clone() };
        this.editor.strokeDab([h.p.x, h.p.y, h.p.z]);
        return;
      }
    }
    this.down = { x: e.offsetX, y: e.offsetY, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey };
    if (this.boxArmed) { this.orbit.enabled = false; Object.assign(this.box.style, { display: 'block', left: `${e.offsetX}px`, top: `${e.offsetY}px`, width: '0px', height: '0px' }); }
  };

  private onMove = (e: PointerEvent) => {
    this.hover = { x: e.offsetX, y: e.offsetY };
    if (this.editor.mode === 'weight') {
      this.updateBrush(e.offsetX, e.offsetY);
      if (this.painting) {
        // Dabs spaced a fifth of the radius apart, however fast the pointer moves.
        const h = this.paintHit(e.offsetX, e.offsetY);
        if (h && h.p.distanceTo(this.painting.last) > this.editor.paint.radius * 0.2) { this.painting.last.copy(h.p); this.editor.strokeDab([h.p.x, h.p.y, h.p.z]); }
        return;
      }
    } else if (this.brushRing) this.brushRing.visible = false;
    if (this.boxArmed && this.down) {
      const x = Math.min(this.down.x, e.offsetX), y = Math.min(this.down.y, e.offsetY);
      Object.assign(this.box.style, { left: `${x}px`, top: `${y}px`, width: `${Math.abs(e.offsetX - this.down.x)}px`, height: `${Math.abs(e.offsetY - this.down.y)}px` });
    }
  };

  private onUp = (e: PointerEvent) => {
    if (this.painting) { this.painting = null; this.orbit.enabled = true; this.editor.endStroke(); this.down = null; return; }
    const d = this.down;
    this.down = null;
    if (!d || e.button !== 0) return;
    if (this.boxArmed) {
      this.box.style.display = 'none';
      this.orbit.enabled = true;
      this.boxSelect(Math.min(d.x, e.offsetX), Math.min(d.y, e.offsetY), Math.max(d.x, e.offsetX), Math.max(d.y, e.offsetY), d.shift);
      this.boxArmed = false; this.onBoxChange?.(false);
      return;
    }
    if (Math.hypot(e.offsetX - d.x, e.offsetY - d.y) > 4) return;   // that was an orbit, not a click
    // A click on the gizmo is a grab, not a selection. Its hover axis is stale once
    // it is detached, so only trust it while something is attached.
    const gz = this.gizmo as unknown as { dragging: boolean; axis: string | null; object?: THREE.Object3D };
    if (gz.object && (gz.dragging || gz.axis)) return;
    this.pick(e.offsetX, e.offsetY, d.shift);
  };

  /** Screen position (pixels) of a point in an object's local space. */
  private toScreen(local: Vec3, g: THREE.Object3D, out = new THREE.Vector3()): THREE.Vector3 {
    out.set(...local).applyMatrix4(g.matrixWorld).project(this.camera);
    const w = this.container.clientWidth, h = this.container.clientHeight;
    return out.set((out.x + 1) / 2 * w, (1 - out.y) / 2 * h, out.z);
  }

  private ray(x: number, y: number): THREE.Raycaster {
    const r = new THREE.Raycaster();
    r.setFromCamera(new THREE.Vector2((x / this.container.clientWidth) * 2 - 1, -(y / this.container.clientHeight) * 2 + 1), this.camera);
    return r;
  }

  pick(x: number, y: number, additive: boolean): void {
    const ed = this.editor;
    if (this.traceView) return;
    if (ed.mode === 'pose') {
      const b = this.nearestBone(x, y);
      if (b) ed.selectBone(b);
      return;
    }
    if (ed.mode === 'bones') {
      const j = this.nearestJoint(x, y);
      if (j) { ed.selectJoint(j); return; }
      const b = this.nearestBone(x, y, true);
      ed.selectJoint(b ? { bone: b, part: 'body' } : null);
      return;
    }
    if (ed.mode === 'object') {
      const targets: THREE.Object3D[] = [];
      for (const v of this.views.values()) {
        if (!v.group.visible) continue;
        if (v.body) targets.push(v.body);
        if (v.helper) targets.push(v.helper);
        if (v.bones) targets.push(...v.bones.children.filter((c) => (c as THREE.Mesh).isMesh));
      }
      const hit = this.ray(x, y).intersectObjects(targets, false)[0];
      ed.selectObject(hit ? (hit.object.userData.id as string) : null, additive);
      return;
    }
    const o = ed.editObject, v = o && this.views.get(o.id);
    if (!o?.mesh || !v) return;
    if (ed.selectMode === 'face') {
      const hit = this.pickMesh ? this.ray(x, y).intersectObject(this.pickMesh.mesh, false)[0] : undefined;
      ed.selectElement(hit?.faceIndex != null ? this.pickMesh!.faceIndex[hit.faceIndex] : null, additive);
    } else if (ed.selectMode === 'vert') {
      ed.selectElement(this.nearestVert(o, v.group, x, y), additive);
    } else {
      ed.selectElement(this.nearestEdge(o, v.group, x, y), additive);
    }
  }

  /**
   * The bone whose segment passes nearest the pointer on screen, within 14 px. Bones
   * are thin, so a ray often misses the one in front and hits one behind it; screen
   * distance (as Blender uses) picks the bone you pointed at.
   */
  private nearestBone(x: number, y: number, rest = false): string | null {
    const o = this.editor.activeObject, v = o && this.views.get(o.id);
    if (!o?.bones || !v) return null;
    let mats: ReturnType<typeof boneMatrices>;
    try { mats = boneMatrices(o.bones, rest ? new Map(o.bones.map((b) => [b.name, [0, 0, 0] as Vec3])) : undefined); } catch { return null; }
    v.group.updateMatrixWorld();
    const w = this.renderer.domElement.clientWidth, h = this.renderer.domElement.clientHeight;
    const scr = (p: THREE.Vector3) => { p.applyMatrix4(v.group.matrixWorld).project(this.camera); return [((p.x + 1) / 2) * w, ((1 - p.y) / 2) * h, p.z] as const; };
    let best: string | null = null, bd = 14;
    for (const b of o.bones) {
      const P = mats.get(b.name)!.posed;
      const [ax, ay] = scr(new THREE.Vector3(0, 0, 0).applyMatrix4(P)), [bx, by] = scr(new THREE.Vector3(0, boneLength(b), 0).applyMatrix4(P));
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)) : 0;
      const d = Math.hypot(x - ax - t * dx, y - ay - t * dy);
      if (d < bd) { bd = d; best = b.name; }
    }
    return best;
  }

  /** Bone edit mode: the head or tail nearest the pointer on screen, within 10 px. */
  private nearestJoint(x: number, y: number): { bone: string; part: 'head' | 'tail' } | null {
    const o = this.editor.activeObject, v = o && this.views.get(o.id);
    if (!o?.bones || !v) return null;
    v.group.updateMatrixWorld();
    let best: { bone: string; part: 'head' | 'tail' } | null = null, bd = 10;
    for (const b of o.bones) for (const part of ['tail', 'head'] as const) {
      const s = this.toScreen(part === 'head' ? b.head : b.tail, v.group);
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) { bd = d; best = { bone: b.name, part }; }
    }
    return best;
  }

  private nearestVert(o: SceneObject, g: THREE.Object3D, x: number, y: number, radius = 12): number | null {
    let best: number | null = null, bd = radius, bz = Infinity;
    const s = new THREE.Vector3();
    o.mesh!.verts.forEach((p, i) => {
      this.toScreen(p, g, s);
      if (s.z > 1) return;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd - 1 || (Math.abs(d - bd) <= 1 && s.z < bz)) { bd = d; bz = s.z; best = i; }
    });
    return best;
  }

  nearestEdge(o: SceneObject, g: THREE.Object3D, x: number, y: number, radius = 10): string | null {
    let best: string | null = null, bd = radius;
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    for (const [key, e] of o.mesh!.edges()) {
      this.toScreen(o.mesh!.verts[e.a], g, a); this.toScreen(o.mesh!.verts[e.b], g, b);
      if (a.z > 1 || b.z > 1) continue;
      const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
      const d = Math.hypot(a.x + t * dx - x, a.y + t * dy - y);
      if (d < bd) { bd = d; best = key; }
    }
    return best;
  }

  /** The edge under the mouse pointer, if any (for loop cut). */
  hoveredEdge(): [number, number] | null {
    const o = this.editor.editObject, v = o && this.views.get(o.id);
    if (!o?.mesh || !v || this.hover.x < 0) return null;
    const k = this.nearestEdge(o, v.group, this.hover.x, this.hover.y, 14);
    return k ? (k.split('-').map(Number) as [number, number]) : null;
  }

  armBoxSelect(): void { this.boxArmed = true; this.onBoxChange?.(true); }

  private boxSelect(x0: number, y0: number, x1: number, y1: number, additive: boolean): void {
    const ed = this.editor, s = new THREE.Vector3();
    const inside = (p: Vec3, g: THREE.Object3D) => { this.toScreen(p, g, s); return s.z <= 1 && s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1; };
    if (ed.mode === 'object') {
      if (!additive) ed.selected.clear();
      for (const o of ed.scene.objects) {
        const g = this.views.get(o.id)?.group;
        if (g?.visible && inside([0, 0, 0], g)) { ed.selected.add(o.id); ed.active = o.id; }
      }
      ed.emit('select');
      return;
    }
    const o = ed.editObject, g = o && this.views.get(o.id)?.group;
    if (!o?.mesh || !g) return;
    const m = o.mesh;
    if (ed.selectMode === 'vert') ed.setElements(m.verts.map((p, i) => [p, i] as const).filter(([p]) => inside(p, g)).map(([, i]) => i), additive);
    else if (ed.selectMode === 'face') ed.setElements(m.faces.map((_, i) => i).filter((i) => inside(m.faceCenter(i), g)), additive);
    else ed.setElements([...m.edges().entries()].filter(([, e]) => inside(m.verts[e.a], g) && inside(m.verts[e.b], g)).map(([k]) => k), additive);
  }

  // ── camera ──────────────────────────────────────────────────────────────

  private frameBox(box: THREE.Box3): void {
    if (box.isEmpty()) box.set(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
    const c = box.getCenter(new THREE.Vector3()), r = Math.max(0.5, box.getSize(new THREE.Vector3()).length() / 2);
    const dir = this.camera.position.clone().sub(this.orbit.target).normalize();
    if (!dir.lengthSq()) dir.set(1, 0.8, 1).normalize();
    const dist = r / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 1.1;
    this.orbit.target.copy(c);
    this.camera.position.copy(c).addScaledVector(dir, dist);
  }

  frameAll(): void {
    const box = new THREE.Box3();
    for (const v of this.views.values()) if (v.body && v.group.visible) box.expandByObject(v.body);
    this.frameBox(box);
  }

  frameSelected(): void {
    const ed = this.editor, box = new THREE.Box3();
    if (ed.mode === 'edit' && ed.editObject?.mesh) {
      const g = this.views.get(ed.editObject.id)!.group, verts = ed.selectedVerts();
      const p = new THREE.Vector3();
      (verts.length ? verts : ed.editObject.mesh.verts.map((_, i) => i)).forEach((i) => box.expandByPoint(p.set(...ed.editObject!.mesh!.verts[i]).applyMatrix4(g.matrixWorld)));
    } else for (const id of ed.selected) { const v = this.views.get(id); if (v) box.expandByObject(v.body ?? v.group); }
    this.frameBox(box);
  }

  view(which: 'front' | 'right' | 'top' | 'persp'): void {
    const t = this.orbit.target, d = this.camera.position.distanceTo(t) || 10;
    const dir = { front: [0, 0, 1], right: [1, 0, 0], top: [0, 1, 0.0001], persp: [0.62, 0.45, 0.65] }[which];
    this.camera.position.copy(t).addScaledVector(new THREE.Vector3(...(dir as Vec3)).normalize(), d);
  }

  // ── traces ──────────────────────────────────────────────────────────────

  private traceTargetId(): string | null { return this.editor.traceTarget; }

  /** Show one step of a trace over its object, or pass null to go back to the live scene. */
  setTrace(trace: Trace | null, step = 0): void {
    this.traceView = trace ? { trace, step } : null;
    this.sync();
  }

  private syncTrace(): void {
    this.traceGroup.traverse((o) => { const m = o as THREE.Mesh; if (m !== (this.traceGroup as unknown)) { m.geometry?.dispose?.(); (m.material as THREE.Material | undefined)?.dispose?.(); } });
    this.traceGroup.clear();
    this.traceGroup.removeFromParent();
    this.traceLabels = [];
    const tv = this.traceView;
    if (!tv) return;
    const id = this.traceTargetId(), v = id ? this.views.get(id) : undefined;
    if (!v) return;
    const steps = tv.trace.steps, s: TraceStep | undefined = steps[tv.step];
    if (!s) return;
    let snap: MeshSnapshot | undefined = tv.trace.before;
    for (let i = 0; i <= tv.step; i++) if (steps[i].mesh) snap = steps[i].mesh;
    const G = this.traceGroup;
    if (snap) {
      const m = EditMesh.fromSnapshot(snap);
      // A step that carries a field shows it on the ghost, so the numbers are seen on the surface.
      const hasField = !!s.field && s.field.length === m.verts.length;
      const ghosts: THREE.Object3D[] = hasField
        ? this.fieldMeshes(m, s.field!, { diverging: s.fieldDiverging, log: s.fieldLog, contours: s.contours, flat: true, opacity: 0.92 })
        : [new THREE.Mesh(toGeometry(m).geo, new THREE.MeshStandardMaterial({ color: 0x8792a6, roughness: 0.7, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, flatShading: true }))];
      const ghostWire = new THREE.LineSegments(edgeLines(m), new THREE.LineBasicMaterial({ color: 0xe5e9f0, transparent: true, opacity: hasField ? 0.18 : 0.55 }));
      for (const g of [...ghosts, ghostWire]) { g.userData.ghost = true; G.add(g); }
      if (s.faces?.length) {
        const sub = new EditMesh(m.verts, s.faces.filter((f) => f < m.faces.length).map((f) => m.faces[f]));
        G.add(new THREE.Mesh(toGeometry(sub).geo, new THREE.MeshBasicMaterial({ color: COL.traceFace, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })));
      }
      if (s.edges?.length) {
        const pos: number[] = [];
        for (const [a, b] of s.edges) if (m.verts[a] && m.verts[b]) pos.push(...m.verts[a], ...m.verts[b]);
        const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        G.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: COL.traceEdge, depthTest: false })));
        // Thick edges: WebGL draws 1-pixel lines, so add thin tubes as well.
        for (const [a, b] of s.edges.slice(0, 120)) if (m.verts[a] && m.verts[b]) G.add(this.tube(m.verts[a], m.verts[b], COL.traceEdge));
      }
      if (s.verts?.length) {
        const pos: number[] = [];
        for (const i of s.verts) if (m.verts[i]) pos.push(...m.verts[i]);
        const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        G.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: COL.traceVert, size: 11, sizeAttenuation: false, depthTest: false })));
      }
    }
    const scale = snap ? Math.max(0.02, Math.cbrt(Math.max(1e-6, EditMesh.fromSnapshot(snap).area())) * 0.03) : 0.04;
    for (const p of s.points ?? []) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(scale, 12, 8), new THREE.MeshBasicMaterial({ color: p.color ?? '#f59e0b', depthTest: false }));
      dot.position.set(...p.p); dot.renderOrder = 5; G.add(dot);
      if (p.label) this.traceLabels.push({ p: new THREE.Vector3(...p.p), text: p.label, color: p.color ?? '#f59e0b', parent: v.group });
    }
    for (const a of s.arrows ?? []) {
      const from = new THREE.Vector3(...a.from), dir = new THREE.Vector3(...a.to).sub(from);
      const len = dir.length();
      if (len < 1e-9) continue;
      const arrow = new THREE.ArrowHelper(dir.normalize(), from, len, new THREE.Color(a.color ?? '#38bdf8').getHex(), Math.min(len * 0.3, scale * 6), Math.min(len * 0.15, scale * 3));
      arrow.traverse((o) => { const mat = (o as THREE.Mesh).material as THREE.Material | undefined; if (mat) mat.depthTest = false; o.renderOrder = 6; });
      G.add(arrow);
      if (a.label) this.traceLabels.push({ p: new THREE.Vector3(...a.to), text: a.label, color: a.color ?? '#38bdf8', parent: v.group });
    }
    // Opaque objects are drawn before transparent ones whatever their renderOrder,
    // so the see-through ghost would wash out every marker. Put the markers in the
    // transparent pass too, drawn after the ghost and over everything.
    G.traverse((o) => {
      if (o.userData.ghost) return;
      const mat = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (mat) { mat.transparent = true; mat.depthTest = false; o.renderOrder = Math.max(o.renderOrder, 5); }
    });
    v.group.add(G);
  }

  private tube(a: Vec3, b: Vec3, color: number): THREE.Mesh {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 6), new THREE.MeshBasicMaterial({ color, depthTest: false }));
    t.position.copy(A).add(B).multiplyScalar(0.5);
    t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    t.renderOrder = 4;
    return t;
  }

  private drawLabels(): void {
    if (!this.traceLabels.length) { if (this.labels.childElementCount) this.labels.replaceChildren(); return; }
    const w = this.container.clientWidth, h = this.container.clientHeight;
    while (this.labels.childElementCount < this.traceLabels.length) this.labels.appendChild(document.createElement('span'));
    while (this.labels.childElementCount > this.traceLabels.length) this.labels.lastChild!.remove();
    const p = new THREE.Vector3();
    this.traceLabels.forEach((l, i) => {
      const el = this.labels.children[i] as HTMLSpanElement;
      p.copy(l.p).applyMatrix4(l.parent.matrixWorld).project(this.camera);
      const visible = p.z < 1;
      el.textContent = l.text;
      Object.assign(el.style, {
        position: 'absolute', left: `${((p.x + 1) / 2) * w + 6}px`, top: `${((1 - p.y) / 2) * h - 16}px`,
        color: l.color, textShadow: '0 1px 2px #000, 0 0 3px #000', display: visible ? 'block' : 'none', whiteSpace: 'nowrap',
      });
    });
  }
}
