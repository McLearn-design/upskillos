// The scripting API: the same scene the GUI edits, as JavaScript objects.
//
//   const cube = scene.add.cube({ size: 2 })
//   cube.position.set(3, 0, 0)
//   cube.rotation.y = Math.PI / 4
//   for (const v of cube.mesh.verts) v.y += 0.2 * Math.sin(3 * v.x)
//   cube.mesh.extrude(cube.mesh.faces.facing([0, 1, 0]), 1)
//   cube.modifiers.add('subsurf', { levels: 2 })
//
// Every line the GUI writes to the log is valid here, so modelling by hand and
// replaying the log give the same scene. A whole script is one undo step, and a
// script that throws leaves the scene exactly as it was.

import { EditMesh, type Vec3 } from './EditMesh';
import type { Editor, ScriptResult } from './Editor';
import { Scene, type SceneJSON, type SceneObject } from './Scene';
import { makePrimitive, type PrimitiveParams, type PrimitiveType } from './primitives';
import { defaultModifier, evaluate, mirror, onMirrorPlane, type Modifier } from './modifiers';
import { catmullClark } from './subdivision';
import { Trace } from './trace';
import { exportOBJ, parseOBJ } from './formats';
import { traceExpr } from './expr';
import { traceAxes, traceDecompose, traceEuler, traceDeterminant, traceTransform, traceWorld } from './transformTrace';
import { Recorder, brief, instrument, type Recording } from './recorder';
import { gaussianCurvature, heatGeodesic, meanCurvature, operators, smooth as smoothMesh } from './geometry';
import { traceVertexNormal } from './normals';
import { rayFromPixel, tracePick } from './pickRay';
import { traceScreenPick } from './screenPick';
import { traceAxisDrag } from './gizmoDrag';
import type { FieldSpec } from './fields';
import { CHANNELS, INTERPS, cloneAnimation, hasKeys, removeBoneKey, removeKey, setBoneKey, setKey, transformAt, type Interp } from './animation';
import { boneLength, limitWeights, orderBones, posedEnds, type Bone } from './armature';
import { applyBonePatch, bindSkin, evaluatedMesh, removeBone, skinnedSource, skinSource } from './evaluate';
import { BRUSHES, DEFAULT_PAINT, dab, neighbourLists, type PaintSettings } from './weightPaint';
import { angleDistortion, planarUV, sharpEdges, traceUVSubdivision, unwrap as unwrapMesh, uvFits } from './uv';
import { bevelEdges, dissolveEdges, dissolveFaces, dissolveVerts, insetRegion } from './modelling';
import { SHADER_MODELS, TEXTURES, type ShaderModel, type TextureName } from './shading';
import { DEFAULT_CAMERA, lookAtRotation, traceDepth, traceLookAt, traceOutline, traceProjection, traceView } from './camera';
import { knife as knifeCut, knifeFaces } from './knife';
import { Quaternion, Vector3 } from 'three';
import { traceSilhouette } from './silhouette';
import { traceValence } from './valence';
import { traceColourMap } from './fields';
import { limitPosition } from './limit';
import { traceVertexLaplacian } from './laplacianTrace';

type Vec3Handle = { x: number; y: number; z: number; set(x: number, y: number, z: number): Vec3Handle; toArray(): Vec3 };

function vecHandle(get: () => Vec3): Vec3Handle {
  const h = {
    get x() { return get()[0]; }, set x(v: number) { get()[0] = v; },
    get y() { return get()[1]; }, set y(v: number) { get()[1] = v; },
    get z() { return get()[2]; }, set z(v: number) { get()[2] = v; },
    set(x: number, y: number, z: number) { const a = get(); a[0] = x; a[1] = y; a[2] = z; return h; },
    toArray: () => [...get()] as Vec3,
    toString: () => `(${get().map((c) => +c.toFixed(4)).join(', ')})`,
  };
  return h;
}

function vec(v: ArrayLike<number> | Vec3Handle): Vec3 {
  const a = 'toArray' in v ? v.toArray() : Array.from(v as ArrayLike<number>);
  if (a.length !== 3 || a.some((x) => typeof x !== 'number' || !Number.isFinite(x))) throw new Error(`Expected three numbers, got ${JSON.stringify(a)}`);
  return [a[0], a[1], a[2]];
}

function assign(target: Vec3, v: ArrayLike<number> | Vec3Handle): void {
  const a = vec(v);
  target[0] = a[0]; target[1] = a[1]; target[2] = a[2];
}

function interpOf(x: unknown): Interp | undefined {
  if (x === undefined) return undefined;
  if (!INTERPS.includes(x as Interp)) throw new Error(`Interpolation must be one of ${INTERPS.map((i) => `"${i}"`).join(', ')}, not ${JSON.stringify(x)}`);
  return x as Interp;
}

const PRIMS: PrimitiveType[] = ['cube', 'plane', 'grid', 'circle', 'cylinder', 'cone', 'uvSphere', 'torus'];
const NAMES: Record<PrimitiveType, string> = { cube: 'Cube', plane: 'Plane', grid: 'Grid', circle: 'Circle', cylinder: 'Cylinder', cone: 'Cone', uvSphere: 'Sphere', torus: 'Torus' };

export function makeApi(editor: Editor, print: (s: string) => void) {
  const scene = () => editor.scene;
  /** A trace for an operation a script runs on object o: it starts from o's mesh as it is now, and plays over o. */
  const trace = (op: string, o?: SceneObject) => {
    if (!editor.traceEnabled) return undefined;
    const t = new Trace(op);
    if (o?.mesh && o.mesh.verts.length <= t.snapshotLimit) t.before = o.mesh.toSnapshot();
    editor.trace = t;
    if (o) editor.traceTarget = o.id;
    return t;
  };

  function meshHandle(o: SceneObject) {
    const m = () => {
      if (!o.mesh) throw new Error(`${o.name} has no mesh`);
      return o.mesh;
    };
    const vert = (i: number) => {
      const h = vecHandle(() => m().verts[i]) as Vec3Handle & { index: number; normal: Vec3 };
      Object.defineProperty(h, 'index', { value: i, enumerable: true });
      Object.defineProperty(h, 'normal', { get: () => m().vertexNormal(i) });
      return h;
    };
    const facesList = () => {
      const mesh = m();
      const list = mesh.faces.map((f, i) => ({ index: i, verts: [...f], get normal() { return mesh.faceNormal(i); }, get center() { return mesh.faceCenter(i); }, get area() { return mesh.faceArea(i); } }));
      // Helpers for choosing faces in scripts.
      const facing = (d: Vec3, tol = 0.9) => { const l = Math.hypot(...d); return list.filter((f) => { const n = f.normal; return (n[0] * d[0] + n[1] * d[1] + n[2] * d[2]) / l > tol; }).map((f) => f.index); };
      Object.defineProperties(list, {
        facing: { value: facing },
        top: { value: () => facing([0, 1, 0]) },
        bottom: { value: () => facing([0, -1, 0]) },
        where: { value: (pred: (f: typeof list[number]) => boolean) => list.filter(pred).map((f) => f.index) },
      });
      return list as typeof list & { facing: typeof facing; top(): number[]; bottom(): number[]; where(p: (f: typeof list[number]) => boolean): number[] };
    };
    const api = {
      get verts() { return m().verts.map((_, i) => vert(i)); },
      get vertices() { return api.verts; },
      get faces() { return facesList(); },
      get edges() { return [...m().edges().values()].map((e) => ({ a: e.a, b: e.b, faces: [...e.faces], get length() { const p = m().verts[e.a], q = m().verts[e.b]; return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); } })); },
      stats: () => m().stats(),
      /** Build the edge table (traced with Record traces on): how many edges, and which are open or on three or more faces. */
      edgeTable: () => m().edgeTable(trace('Edge table', o)),
      /** The pieces: faces joined by shared edges, by breadth-first search (traced with Record traces on). Each is a list of face numbers. */
      pieces: () => m().pieces(trace('Pieces', o)),
      /** The edge loop through edge (a, b): straight on through four-edge vertices, stopping at poles and n-gons (traced with Record traces on). */
      loop: (a: number, b: number) => m().edgeLoop(Number(a), Number(b), trace('Edge loop', o)),
      /** V, E, F, χ = V − E + F, pieces, boundary loops and genus (traced with Record traces on). */
      topology: () => m().topology(trace('Euler characteristic', o)),
      /** The angle at corner b between the edges to a and c, with the vectors, dot and cross products (traced with Record traces on). */
      measure: (a: number, b: number, c: number) => m().measure(a, b, c, trace('Measure angle', o)),
      /** The index of the vertex nearest a point (local coordinates). */
      nearest(p: Vec3) {
        let best = -1, bd = Infinity;
        m().verts.forEach((v, i) => { const d = (v[0] - p[0]) ** 2 + (v[1] - p[1]) ** 2 + (v[2] - p[2]) ** 2; if (d < bd) { bd = d; best = i; } });
        return best;
      },
      /** The render form: flat typed arrays, exactly what goes to the GPU. */
      buffer: () => { const t = m().triangulate(); return { positions: t.positions, indices: t.indices }; },
      extrude(faces: number[], distance = 1) { m().extrudeFaces(faces, distance, trace('Extrude', o), { skipWall: onMirrorPlane(m(), o.modifiers) }); return api; },
      /** Inset faces as one region by a distance; inset() insets each face on its own by a fraction. */
      insetRegion(faces: number[], thickness = 0.1) { insetRegion(m(), faces, thickness, trace('Inset (region)', o)); return api; },
      /** Bevel edges: width along the neighbouring edges, segments across (more = rounder). */
      bevel(edges: [number, number][], width = 0.1, segments = 1) { bevelEdges(m(), edges, width, segments, trace('Bevel', o)); return api; },
      /** Remove vertices, edges or faces while keeping the shape: the faces around them merge. */
      dissolve(what: { verts?: number[]; edges?: [number, number][]; faces?: number[] }) {
        if (what.faces) dissolveFaces(m(), what.faces, trace('Dissolve', o));
        if (what.edges) dissolveEdges(m(), what.edges, trace('Dissolve', o));
        if (what.verts) dissolveVerts(m(), what.verts, trace('Dissolve', o));
        return api;
      },
      inset(faces: number[], amount = 0.25) { m().insetFaces(faces, amount, trace('Inset', o)); return api; },
      loopCut(a: number, b: number, t = 0.5) { m().loopCut(a, b, t, trace('Loop cut', o)); return api; },
      split(faces?: number[]) { m().subdivideFaces(faces); return api; },
      /** Vertex v's Catmull–Clark limit position (all quads round it), traced with Record traces on. */
      limit: (v: number) => { const r = limitPosition(m(), Number(v), trace('Trace the limit position', o)); if (typeof r === 'string') throw new Error(r); return r.limit; },
      /** Valence at every vertex, poles, face kinds and the pole budget (traced with Record traces on). */
      valence: () => { const r = traceValence(m(), trace('Trace clean topology', o)); return { inside: r.inside, poles: r.poles, tris: r.tris, quads: r.quads, ngons: r.ngons, budget: r.budget }; },
      subdivide(levels = 1) { for (let i = 0; i < levels; i++) o.mesh = catmullClark(m(), i === 0 ? trace('Catmull–Clark', o) : undefined); return api; },
      delete(what: { faces?: number[]; verts?: number[]; edges?: [number, number][] }) {
        if (what.faces) m().deleteFaces(what.faces);
        if (what.edges) m().deleteEdges(what.edges);
        if (what.verts) m().deleteVerts(what.verts);
        return api;
      },
      merge(verts: number[], at?: Vec3) { m().mergeVerts(verts, at, trace('Merge', o)); return api; },
      /**
       * The knife: cut along the plane through eye, from and to, between the rays eye→from and
       * eye→to (all in the mesh's own coordinates). Only faces facing the eye, unless through.
       * Returns the new edges.
       */
      knife(p: { eye: Vec3; from: Vec3; to: Vec3; through?: boolean }) {
        const line = { eye: vec(p.eye), from: vec(p.from), to: vec(p.to) };
        return knifeCut(m(), line, knifeFaces(m(), line.eye, !!p.through), trace('Knife', o));
      },
      /** Close a hole with one face: the vertices round it, in any order. Returns the new face's index. */
      fill(verts: number[]) { return m().fill(verts, trace('Fill', o)); },
      flip(faces?: number[]) { m().flip(faces, trace('Flip normals', o)); return api; },
      weld(tol = 0) { m().weld(tol, tol > 0 ? trace('Merge by distance', o) : undefined); return api; },
      translate(verts: number[], d: Vec3) { m().translateVerts(verts, d); return api; },
      setVerts(map: Record<number, Vec3>) { for (const [i, p] of Object.entries(map)) m().verts[Number(i)] = [p[0], p[1], p[2]]; m().touch(); return api; },
      // Geometry processing: one number per vertex, as a plain array.
      curvature(kind: 'mean' | 'gaussian' = 'mean') { return Array.from(kind === 'gaussian' ? gaussianCurvature(m()) : meanCurvature(m())); },
      geodesic(from: number | number[]) { return Array.from(heatGeodesic(m(), Array.isArray(from) ? from : [from], trace('Heat method', o))); },
      /** How vertex v's smooth normal is built: faces, weights (area or angle), the average; auto smooth splits (traced with Record traces on). */
      vertexNormal(v: number, opts: { weight?: 'area' | 'angle'; sharp?: number | null } = {}) { return traceVertexNormal(m(), Number(v), { weight: opts.weight ?? 'area', sharp: opts.sharp === undefined ? o.autoSmooth ?? null : opts.sharp }, trace('Trace the vertex normal', o)); },
      smooth(opts: { verts?: number[]; iterations?: number; lambda?: number; method?: 'uniform' | 'cotan' } = {}) { smoothMesh(m(), { iterations: opts.iterations ?? 5, lambda: opts.lambda ?? 0.5, method: opts.method ?? 'uniform', only: opts.verts }, trace('Smooth', o)); return api; },
      /** The cotan Laplacian as rows of [neighbour, weight] pairs, and each vertex's area (mass). */
      laplacian() { const { C, mass } = operators(m()); return { rows: C.rows.map((r) => [...r.entries()]), mass: Array.from(mass) }; },
      /** The Laplacian at vertex v, traced with Record traces on: umbrella, cotan weights, area, and Δx (length 2H). */
      laplacianAt: (v: number) => { const r = traceVertexLaplacian(m(), Number(v), trace('Trace the Laplacian', o)); if (typeof r === 'string') throw new Error(r); return { weights: r.weights, area: r.area, H: r.H, delta: r.cotan }; },
      /** Colour the mesh by a field: "geodesic" (with from), "mean", "gaussian", "x", "y", "z", or your own values. */
      showField(what: string | number[], opts: { from?: number | number[]; source?: number | number[]; label?: string; bone?: string } = {}) {
        const from = opts.from ?? opts.source;
        const spec: FieldSpec = Array.isArray(what) ? { kind: 'custom', values: what.map(Number), label: opts.label }
          : what === 'geodesic' ? { kind: 'geodesic', sources: from === undefined ? [] : Array.isArray(from) ? from : [from] }
          : what === 'mean' || what === 'gaussian' ? { kind: what }
          : what === 'weight' ? { kind: 'weight', bone: String(opts.bone ?? '') }
          : what === 'uv' ? { kind: 'uv' }
          : what === 'x' || what === 'y' || what === 'z' ? { kind: 'coord', axis: 'xyz'.indexOf(what) as 0 | 1 | 2 }
          : (() => { throw new Error(`showField: unknown field "${what}". Use "geodesic", "mean", "gaussian", "x", "y", "z", "weight" (with bone), "uv" or an array of numbers`); })();
        if (!editor.showField(spec, o.id)) throw new Error(editor.message);
        return api;
      },
      /** Trace how the heat map now showing on this object becomes colours (with Record traces on). */
      traceColours() {
        if (!editor.field || editor.field.objectId !== o.id) throw new Error('traceColours: show a heat map on this object first (mesh.showField)');
        const t = trace('Trace the colour mapping', o);
        if (t) traceColourMap(editor.field.mesh, editor.field.result, t);
        return editor.field.result.label;
      },
      // UVs: seams cut the surface; unwrap flattens each piece (LSCM) and packs them into the unit square.
      markSeams(edges: [number, number][]) { const s = new Set(o.seams ?? []); for (const [a, b] of edges) s.add(EditMesh.edgeKey(a, b)); o.seams = [...s]; return api; },
      clearSeams(edges?: [number, number][]) {
        if (!edges) { o.seams = undefined; return api; }
        const s = new Set(o.seams ?? []); for (const [a, b] of edges) s.delete(EditMesh.edgeKey(a, b)); o.seams = s.size ? [...s] : undefined; return api;
      },
      get seams() { return (o.seams ?? []).map((k) => k.split('-').map(Number)); },
      seamsFromSharp(degrees = 60) { o.seams = [...new Set([...(o.seams ?? []), ...sharpEdges(m(), degrees)])]; return api; },
      unwrap(opts: { method?: 'lscm' | 'planar' } = {}) {
        o.uv = opts.method === 'planar' ? planarUV(m()) : unwrapMesh(m(), new Set(o.seams ?? []), trace('Unwrap (LSCM)', o));
        return api;
      },
      /** UVs per face corner: uv[f][i] = [u, v] of corner i of face f (null if none, or if the mesh changed since). */
      get uv() { return uvFits(m(), o.uv) ? o.uv.faces.map((f) => f.map((p) => [...p])) : null; },
      /** Angle distortion σ₁/σ₂ of the UV map around each vertex (1 = angles kept). */
      uvDistortion() { if (!uvFits(m(), o.uv)) throw new Error(`${o.name} has no UVs that fit its mesh: unwrap first`); return Array.from(angleDistortion(m(), o.uv)); },
      toString: () => { const s = m().stats(); return `Mesh(${s.verts} verts, ${s.edges} edges, ${s.faces} faces)`; },
    };
    return api;
  }

  function boneHandle(o: SceneObject, b: Bone) {
    const hv = (k: 'head' | 'tail' | 'pose') => vecHandle(() => b[k]);
    const head = hv('head'), tail = hv('tail'), pose = hv('pose');
    const bh = {
      get name() { return b.name; }, set name(v: string) { bh.set({ name: String(v) }); },
      get parent() { return b.parent; }, set parent(v: string | null) { bh.set({ parent: v }); },
      /** Rest position (armature space). */
      get head() { return head; }, set head(v: ArrayLike<number> | Vec3Handle) { bh.set({ head: vec(v) }); },
      get tail() { return tail; }, set tail(v: ArrayLike<number> | Vec3Handle) { bh.set({ tail: vec(v) }); },
      /** Pose rotation: radians, XYZ, in the bone's own frame. */
      get pose() { return pose; }, set pose(v: ArrayLike<number> | Vec3Handle) { assign(b.pose, v); },
      get length() { return boneLength(b); },
      /** Roll (radians): which way the bone's own x and z axes face around its length. */
      get roll() { return b.roll ?? 0; }, set roll(v: number) { bh.set({ roll: Number(v) }); },
      /** Where the head and tail are in the current pose (armature space). */
      get posedHead() { return posedEnds(o.bones!).get(b.name)!.head; },
      get posedTail() { return posedEnds(o.bones!).get(b.name)!.tail; },
      set(patch: { name?: string; head?: Vec3; tail?: Vec3; parent?: string | null; roll?: number }) {
        if (patch.name !== undefined && patch.name !== b.name && o.bones!.some((x) => x.name === patch.name)) throw new Error(`There is already a bone called "${patch.name}"`);
        if (patch.parent) orderBones(o.bones!.map((x) => (x === b ? { ...x, parent: patch.parent! } : x)));
        applyBonePatch(scene(), o, b, { ...patch, head: patch.head && vec(patch.head), tail: patch.tail && vec(patch.tail) });
        return bh;
      },
      keyframe(frame: number, values: { rotation?: Vec3 | Vec3Handle; interp?: Interp } = {}) {
        setBoneKey((o.anim ??= {}), b.name, Math.round(frame), values.rotation !== undefined ? vec(values.rotation) : b.pose, interpOf(values.interp));
        return bh;
      },
      deleteKeyframe(frame: number) { if (o.anim) { removeBoneKey(o.anim, b.name, frame); if (!hasKeys(o.anim)) o.anim = undefined; } return bh; },
      toString: () => `Bone "${b.name}"`,
    };
    return bh;
  }

  function objHandle(o: SceneObject) {
    const mesh = o.mesh || o.kind === 'mesh' ? meshHandle(o) : null;
    const pos = vecHandle(() => o.position), rot = vecHandle(() => o.rotation), scl = vecHandle(() => o.scale);
    const h = {
      get id() { return o.id; },
      get name() { return o.name; }, set name(v: string) { o.name = scene().uniqueName(String(v), o.id); },
      get kind() { return o.kind; },
      // Read a handle and change one axis (cube.position.x = 2), or assign all three: cube.position = [1, 2, 3].
      get position() { return pos; }, set position(v: ArrayLike<number> | Vec3Handle) { assign(o.position, v); },
      get rotation() { return rot; }, set rotation(v: ArrayLike<number> | Vec3Handle) { assign(o.rotation, v); },
      get scale() { return scl; }, set scale(v: ArrayLike<number> | Vec3Handle) { assign(o.scale, v); },
      get visible() { return o.visible; }, set visible(v: boolean) { o.visible = !!v; },
      get smooth() { return o.smooth; }, set smooth(v: boolean) { o.smooth = !!v; },
      /** Auto smooth in degrees: smooth shading that keeps sharper edges hard (null: smooth everywhere). Setting it turns smooth on. */
      get autoSmooth() { return o.autoSmooth ?? null; }, set autoSmooth(v: number | null) { if (v !== null && !(Number(v) >= 0 && Number(v) <= 180)) throw new Error('autoSmooth: 0 to 180 degrees, or null'); o.autoSmooth = v === null ? null : Number(v); o.smooth = true; },
      /** How the object's matrix M = T·R·S moves its vertices (traced with Record traces on): M, and each vertex where it is drawn. */
      traceTransform() { return traceTransform(o, trace('Trace the transform', o)); },
      /** Take the object's world matrix apart into position, scale and rotation, and measure any shear (traced with Record traces on). */
      decompose() { return traceDecompose(scene().worldMatrix(o).elements, trace('Decompose the matrix', o)); },
      /** How the world matrix is built up the parent chain, and where each origin lands (traced with Record traces on). */
      traceWorld() { return traceWorld(scene(), o, trace('Trace the world matrix', o)); },
      /** The object's own axes (unit vectors) and scales, read from its world matrix, and a world point in its own coordinates (default the world origin; traced with Record traces on). */
      traceAxes(point: ArrayLike<number> | Vec3Handle = [0, 0, 0]) { return traceAxes(scene().worldMatrix(o).elements, vec(point), trace('Trace the local axes', o)); },
      /** The object's Euler angles (XYZ order) built into a matrix and decoded back, and whether they are in gimbal lock (traced with Record traces on). */
      traceEuler() { return traceEuler(o.rotation, trace('Trace the Euler angles', o)); },
      /** The determinant of the object's world matrix, worked out, and the volume its mesh fills in the world (traced with Record traces on). */
      determinant() { return traceDeterminant(scene().worldMatrix(o).elements, o.mesh?.stats().closed ? o.mesh.volume() : null, trace('Determinant', o)); },
      /** A camera's view matrix (the inverse of its world matrix) and where a world point lands in its camera space (traced with Record traces on). */
      traceView(point: ArrayLike<number> | Vec3Handle = [0, 0, 0]) { if (o.kind !== 'camera') throw new Error(`${o.name} is not a camera`); return traceView(scene().worldMatrix(o).elements, vec(point), trace('Trace the view matrix', o)); },
      /** How a world point reaches a camera's image: camera space, clip space, the divide, and the pixel on the render size (traced with Record traces on). */
      traceProjection(point: ArrayLike<number> | Vec3Handle = [0, 0, 0]) { if (!o.camera) throw new Error(`${o.name} is not a camera`); return traceProjection(scene().worldMatrix(o).elements, o.camera, editor.renderSize, vec(point), trace('Trace the projection', o)); },
      /** Two world points through this camera's depth buffer: their depths, the stored 24-bit numbers, and whether they fight (traced with Record traces on). */
      traceDepth(a: ArrayLike<number> | Vec3Handle, b: ArrayLike<number> | Vec3Handle, bits = 24) { if (!o.camera) throw new Error(`${o.name} is not a camera`); return traceDepth(scene().worldMatrix(o).elements, o.camera, vec(a), vec(b), Number(bits), trace('Trace the depth buffer', o)); },
      /** How wide the selection outline of something at a world point is on this camera's image (traced with Record traces on). */
      traceOutline(point: ArrayLike<number> | Vec3Handle = [0, 0, 0]) { if (!o.camera) throw new Error(`${o.name} is not a camera`); return traceOutline(scene().worldMatrix(o).elements, o.camera, editor.renderSize, vec(point), undefined, trace('Trace the outline width', o)); },
      /** Look-at worked out for this object at a world point: forward, right, up, the change of basis and the Euler angles (traced with Record traces on; does not turn the object). */
      traceLookAt(point: ArrayLike<number> | Vec3Handle) { const w = scene().worldMatrix(o).elements; return traceLookAt([w[12], w[13], w[14]], vec(point), trace('Trace look-at', o)); },
      /** The ray through pixel (px, py) of this camera's render image, tested against every mesh: the nearest hit (traced with Record traces on). */
      tracePick(px: number, py: number) { if (!o.camera) throw new Error(`${o.name} is not a camera`); const ray = rayFromPixel(scene().worldMatrix(o).elements, o.camera, editor.renderSize, Number(px), Number(py)); return { ray, hit: tracePick(ray, editor.pickables(), trace('Trace picking', o)) }; },
      /** The vertex (kind 'vert') or edge ('edge') of a mesh nearest pixel (px, py) on this camera's image, picked in screen space (traced with Record traces on). */
      tracePickNear(target: { id: string }, px: number, py: number, kind: 'vert' | 'edge' = 'vert') { const t = scene().get(target.id); if (!o.camera) throw new Error(`${o.name} is not a camera`); if (!t?.mesh) throw new Error('tracePickNear: the target has no mesh'); const edges = [...t.mesh.edges().values()].map((e) => [e.a, e.b] as [number, number]); return traceScreenPick(kind, editor.screenPointsOf(t, o), edges, Number(px), Number(py), trace('Trace screen picking', t)); },
      /** Drag a target's axis arrow on this camera's image: from the target's pixel, dx and dy pixels further; the move along the axis, snapped if snap is given (traced with Record traces on). */
      traceDrag(target: { id: string }, axis: 'x' | 'y' | 'z', dx: number, dy = 0, snap: number | null = null) { const t = scene().get(target.id); if (!o.camera) throw new Error(`${o.name} is not a camera`); if (!t) throw new Error('traceDrag: no such object'); const w = scene().worldMatrix(t).elements, origin: Vec3 = [w[12], w[13], w[14]], cw = scene().worldMatrix(o).elements; const at = traceProjection(cw, o.camera, editor.renderSize, origin).pixel; const u: Vec3 = [0, 0, 0]; u['xyz'.indexOf(axis)] = 1; const ray = (px: number, py: number) => rayFromPixel(cw, o.camera!, editor.renderSize, px - 0.5, py - 0.5); return traceAxisDrag(origin, u, ray(at[0], at[1]), ray(at[0] + Number(dx), at[1] + Number(dy)), snap, trace('Trace a gizmo drag', t)); },
      /** Turn to face a point (world coordinates): a camera or light looks at it along its −z axis. */
      lookAt(target: ArrayLike<number> | Vec3Handle) {
        const world = scene().worldMatrix(o), eye = [world.elements[12], world.elements[13], world.elements[14]] as Vec3;
        const parent = o.parent ? new Quaternion().setFromRotationMatrix(scene().worldMatrix(scene().get(o.parent)!)) : undefined;
        o.rotation = lookAtRotation(eye, vec(target as Vec3), parent);
        return h;
      },
      /** A camera's vertical field of view in degrees (null for other objects). */
      get fov() { return o.camera?.fov ?? null; },
      set fov(v: number | null) { if (!o.camera) throw new Error(`${o.name} is not a camera`); if (v === null || !(v > 1 && v < 179)) throw new Error('fov: between 1 and 179 degrees'); o.camera.fov = Number(v); },
      /** A camera's near and far planes: nothing nearer or further is drawn (and depth precision depends mostly on near). */
      get near() { return o.camera?.near ?? null; },
      set near(v: number | null) { if (!o.camera) throw new Error(`${o.name} is not a camera`); if (v === null || !(v > 0 && v < o.camera.far)) throw new Error('near: above 0 and less than far'); o.camera.near = Number(v); },
      get far() { return o.camera?.far ?? null; },
      set far(v: number | null) { if (!o.camera) throw new Error(`${o.name} is not a camera`); if (v === null || !(v > o.camera.near)) throw new Error('far: more than near'); o.camera.far = Number(v); },
      material: {
        get color() { return o.material.color; }, set color(v: string) { o.material.color = String(v); },
        get roughness() { return o.material.roughness; }, set roughness(v: number) { o.material.roughness = v; },
        get metalness() { return o.material.metalness; }, set metalness(v: number) { o.material.metalness = v; },
        /** "pbr", "lambert", "blinn-phong", "toon", "normals", "uv" or "custom". */
        get shader() { return o.material.shader ?? 'pbr'; },
        set shader(v: ShaderModel) { if (!SHADER_MODELS.includes(v)) throw new Error(`shader must be one of ${SHADER_MODELS.join(', ')}`); o.material.shader = v; },
        /** A procedural texture drawn with the UVs: "none", "checker", "grid", "bricks", "wood", "stripes". */
        get texture() { return o.material.texture ?? 'none'; },
        set texture(v: TextureName) { if (!TEXTURES.includes(v)) throw new Error(`texture must be one of ${TEXTURES.join(', ')}`); o.material.texture = v; },
        get textureScale() { return o.material.textureScale ?? 1; }, set textureScale(v: number) { o.material.textureScale = Number(v); },
        get shininess() { return o.material.shininess ?? 40; }, set shininess(v: number) { o.material.shininess = Number(v); },
        /** The body of shade(N, L, V, uv, base, light) for the custom shader (GLSL). */
        get glsl() { return o.material.glsl ?? ''; }, set glsl(v: string) { o.material.glsl = String(v); },
      },
      get parent(): ReturnType<typeof objHandle> | null { return o.parent ? objHandle(scene().get(o.parent)!) : null; },
      set parent(p: { id: string } | null) { if (!scene().setParent(o.id, p ? p.id : null, true)) throw new Error(`Cannot parent ${o.name} there`); },
      get children() { return scene().children(o.id).map(objHandle); },
      get mesh() { return mesh; },
      /** Alias for mesh, matching three.js's naming. */
      get geometry() { return mesh; },
      /** 4×4 matrices as 16 numbers in column-major order, like three.js's Matrix4.elements. */
      get localMatrix() { return scene().localMatrix(o).elements.slice(); },
      get worldMatrix() { return scene().worldMatrix(o).elements.slice(); },
      modifiers: {
        add(type: Modifier['type'], opts: Record<string, unknown> = {}) { o.modifiers.push({ ...defaultModifier(type), ...opts } as Modifier); if (type === 'subsurf') o.smooth = true; return h; },
        set(i: number, patch: Partial<Modifier>) { Object.assign(o.modifiers[i], patch); return h; },
        remove(i: number) { o.modifiers.splice(i, 1); return h; },
        apply() { if (o.mesh) o.mesh = evaluate(o.mesh, o.modifiers); o.modifiers = []; return h; },
        get list() { return o.modifiers.map((m) => ({ ...m })); },
      },
      /** Trace this object's silhouette (modifiers applied) from the scene camera, with Record traces on. Returns the counts. */
      traceSilhouette() {
        const cam = scene().activeCamera ? scene().get(scene().activeCamera!) : undefined;
        if (!o.mesh || !cam) throw new Error('traceSilhouette needs a mesh and a scene camera');
        const c = scene().worldMatrix(cam).elements;
        const local = new Vector3(c[12], c[13], c[14]).applyMatrix4(scene().worldMatrix(o).clone().invert());
        const shown = evaluatedMesh(scene(), o);
        const r = traceSilhouette(shown, [local.x, local.y, local.z], trace('Trace the silhouette', o));
        return { faces: shown.faces.length, front: r.front.length, edges: r.edges.length };
      },
      /** Trace subdividing this object's UVs smoothly (with Record traces on), and compare distortion with linear UVs. */
      traceUVSubdivision(levels = 2) {
        if (!o.mesh || !o.uv || !uvFits(o.mesh, o.uv)) throw new Error(`${o.name} has no UVs: unwrap it first`);
        const r = traceUVSubdivision(o.mesh, o.uv, Math.max(1, Math.min(3, Math.round(levels))), trace('Trace subdividing the UVs', o));
        return { linear: +r.linear.mean.toFixed(3), smooth: +r.smooth.mean.toFixed(3) };
      },
      /** Trace the first enabled mirror modifier on the cage (with Record traces on). Returns the mirrored mesh's stats. */
      traceMirror() {
        const mod = o.modifiers.find((m) => m.type === 'mirror' && m.enabled);
        if (!o.mesh || !mod || mod.type !== 'mirror') throw new Error(`${o.name} has no mirror modifier switched on`);
        return mirror(o.mesh, mod.axis, mod.merge, trace('Trace the mirror modifier', o)).stats();
      },
      delete() { scene().remove(o.id); },
      duplicate() { return objHandle(editor.duplicateOne(o)); },
      /** Statistics of the mesh as shown: modifiers (and skinning) applied. mesh.stats() is the cage you edit. */
      evaluatedStats() { if (!o.mesh) throw new Error(`${o.name} has no mesh`); return evaluatedMesh(scene(), o).stats(); },
      // Animation: keys pin a channel to a value at a frame; frames in between are interpolated.
      keyframe(frame: number, values: { position?: Vec3 | Vec3Handle; rotation?: Vec3 | Vec3Handle; scale?: Vec3 | Vec3Handle; interp?: Interp } = {}) {
        if (!Number.isFinite(frame)) throw new Error('keyframe: the frame must be a number');
        const given = CHANNELS.filter((c) => values[c] !== undefined);
        o.anim ??= {};
        for (const c of given.length ? given : CHANNELS) setKey(o.anim, c, Math.round(frame), values[c] !== undefined ? vec(values[c]!) : o[c], interpOf(values.interp));
        return h;
      },
      deleteKeyframe(frame: number) { if (o.anim) { for (const c of CHANNELS) removeKey(o.anim, c, frame); if (!hasKeys(o.anim)) o.anim = undefined; } return h; },
      setInterpolation(frame: number, interp: Interp) { const i = interpOf(interp)!; for (const c of CHANNELS) for (const k of o.anim?.[c] ?? []) if (k.frame === frame) k.interp = i; return h; },
      get rotationMode() { return o.anim?.rotationMode ?? 'euler'; },
      set rotationMode(m: 'euler' | 'quaternion') { if (m !== 'euler' && m !== 'quaternion') throw new Error('rotationMode is "euler" or "quaternion"'); (o.anim ??= {}).rotationMode = m; },
      /** The keys, per channel. */
      get animation() { return cloneAnimation(o.anim) ?? null; },
      clearAnimation() { o.anim = undefined; return h; },
      /** The transform at a frame, without going there. */
      sample(frame: number) { const t = transformAt(o, frame); return { position: [...t.position], rotation: [...t.rotation], scale: [...t.scale] }; },
      // Armatures.
      get bones() { if (!o.bones) throw new Error(`${o.name} is not an armature`); return o.bones.map((b) => boneHandle(o, b)); },
      bone(name: string) { const b = o.bones?.find((x) => x.name === name); if (!b) throw new Error(`${o.name} has no bone called "${name}"`); return boneHandle(o, b); },
      addBone(p: { name: string; parent?: string | null; head: Vec3; tail: Vec3; roll?: number }) {
        if (!o.bones) throw new Error(`${o.name} is not an armature`);
        if (o.bones.some((b) => b.name === p.name)) throw new Error(`There is already a bone called "${p.name}"`);
        const b: Bone = { name: String(p.name), parent: p.parent ?? null, head: vec(p.head), tail: vec(p.tail), pose: [0, 0, 0], ...(p.roll ? { roll: Number(p.roll) } : {}) };
        orderBones([...o.bones, b]);
        o.bones.push(b);
        return boneHandle(o, b);
      },
      removeBone(name: string) { if (!o.bones) throw new Error(`${o.name} is not an armature`); removeBone(scene(), o, name); return h; },
      resetPose() { for (const b of o.bones ?? []) b.pose = [0, 0, 0]; return h; },
      // Skinning.
      bindTo(arm: { id: string }) { const a = scene().get(arm.id); if (!a) throw new Error('bindTo: no such armature'); bindSkin(scene(), o, a, trace('Automatic weights', o)); return h; },
      unbind() { o.skin = undefined; return h; },
      /** How bone motions are blended: "linear" (averages points) or "dual-quaternion" (averages rigid motions). */
      get skinning() { return o.skin?.method ?? 'linear'; },
      set skinning(m: 'linear' | 'dual-quaternion') {
        if (!o.skin) throw new Error(`${o.name} is not bound to an armature`);
        if (m !== 'linear' && m !== 'dual-quaternion') throw new Error('skinning is "linear" or "dual-quaternion"');
        o.skin.method = m;
      },
      /** Keep each vertex's k strongest bone weights (glTF and game engines use 4). */
      limitWeights(k = 4) { if (!o.skin) throw new Error(`${o.name} is not bound to an armature`); limitWeights(o.skin, k); return h; },
      get skin() {
        const sk = o.skin;
        if (!sk) return null;
        return {
          armature: scene().get(sk.armature)?.name ?? null, bones: [...sk.bones], verts: sk.verts,
          weights(bone: string) { const i = sk.bones.indexOf(bone); if (i < 0) throw new Error(`No weights for bone "${bone}"`); return [...sk.weights[i]]; },
        };
      },
      /** Brush strokes on a bone's weights, as weight paint mode does: points in the mesh's own space, on the posed surface. */
      paintWeights(bone: string, opts: Partial<PaintSettings> & { points: (Vec3 | Vec3Handle)[] }) {
        if (!o.skin) throw new Error(`${o.name} is not bound to an armature`);
        const s: PaintSettings = { ...DEFAULT_PAINT, ...opts };
        if (!BRUSHES.includes(s.brush)) throw new Error(`paintWeights: brush must be one of ${BRUSHES.join(', ')}`);
        const src = skinSource(o), pos = skinnedSource(scene(), o).verts, nb = neighbourLists(src.verts.length, src.faces);
        for (const p of opts.points) dab(o.skin, bone, pos, nb, vec(p), s);
        return h;
      },
      setWeights(bone: string, values: number[]) {
        const sk = o.skin;
        if (!sk) throw new Error(`${o.name} is not bound to an armature`);
        if (values.length !== sk.verts) throw new Error(`setWeights: need ${sk.verts} values, got ${values.length}`);
        const i = sk.bones.indexOf(bone);
        if (i >= 0) sk.weights[i] = values.map(Number); else { sk.bones.push(bone); sk.weights.push(values.map(Number)); }
        return h;
      },
      toString: () => `${o.kind === 'mesh' ? 'Mesh' : o.kind === 'light' ? 'Light' : o.kind === 'armature' ? 'Armature' : o.kind === 'camera' ? 'Camera' : 'Empty'} "${o.name}"`,
    };
    return h;
  }

  const add: Record<string, (p?: Record<string, unknown>) => ReturnType<typeof objHandle>> = {};
  for (const type of PRIMS) {
    add[type] = (p: Record<string, unknown> = {}) => {
      const { name, position, rotation, scale, parent, ...params } = p as PrimitiveParams & { name?: string; position?: Vec3; rotation?: Vec3; scale?: Vec3; parent?: { id: string } };
      const o = scene().add({ name: name ?? NAMES[type], mesh: makePrimitive(type, params), position, rotation, scale, parent: parent?.id ?? null });
      return objHandle(o);
    };
  }
  add.armature = (p: Record<string, unknown> = {}) => {
    const list = ((p.bones as { name: string; parent?: string | null; head: Vec3; tail: Vec3; roll?: number }[] | undefined) ?? [{ name: 'Bone', head: [0, 0, 0], tail: [0, 1, 0] }])
      .map((b) => ({ name: String(b.name), parent: b.parent ?? null, head: vec(b.head), tail: vec(b.tail), pose: [0, 0, 0] as Vec3, ...(b.roll ? { roll: Number(b.roll) } : {}) }));
    orderBones(list);
    return objHandle(scene().add({ name: String(p.name ?? 'Armature'), kind: 'armature', bones: list, ...placed(p), material: { color: '#c9ced6', roughness: 0.6, metalness: 0 } }));
  };
  // Transform and parent options, shared by every add: { position, rotation, scale, parent }.
  const placed = (p: Record<string, unknown>) => ({
    position: p.position === undefined ? undefined : vec(p.position as Vec3), rotation: p.rotation === undefined ? undefined : vec(p.rotation as Vec3),
    scale: p.scale === undefined ? undefined : vec(p.scale as Vec3), parent: (p.parent as { id: string } | undefined)?.id ?? null,
  });
  /** A camera: position it, then point it with lookAt, or pass lookAt: [x, y, z]. The first one becomes the scene's camera. */
  add.camera = (p: Record<string, unknown> = {}) => {
    const o = scene().add({ name: String(p.name ?? 'Camera'), kind: 'camera', camera: { ...DEFAULT_CAMERA, ...(p.fov !== undefined ? { fov: Number(p.fov) } : {}), ...(p.near !== undefined ? { near: Number(p.near) } : {}), ...(p.far !== undefined ? { far: Number(p.far) } : {}) }, ...placed(p) });
    if (!scene().activeCamera) scene().activeCamera = o.id;
    const h = objHandle(o);
    if (p.lookAt) h.lookAt(p.lookAt as Vec3);
    return h;
  };
  add.empty = (p: Record<string, unknown> = {}) => objHandle(scene().add({ name: String(p.name ?? 'Empty'), kind: 'empty', ...placed(p) }));
  add.mesh = (p: Record<string, unknown> = {}) => objHandle(scene().add({ name: String(p.name ?? 'Mesh'), mesh: new EditMesh(((p.verts as Vec3[]) ?? []).map((v) => vec(v)), ((p.faces as number[][]) ?? []).map((f) => Array.from(f, Number))), ...placed(p) }));

  /** Read OBJ text into new objects (traced with Record traces on); returns their handles. */
  const readOBJ = (text: string) => {
    const t = editor.traceEnabled ? new Trace('Read OBJ') : undefined;
    const made = parseOBJ(String(text), t).map((o) => scene().add({ name: o.name, mesh: new EditMesh(o.verts, o.faces) }));
    if (t && t.steps.length) { editor.trace = t; if (made[0]) editor.traceTarget = made[0].id; }
    return made.map((o) => objHandle(o));
  };
  const sceneApi = {
    add,
    // Short forms, matching the spec's example: scene.addCube({ size: 10 }).
    addCube: (p?: Record<string, unknown>) => add.cube(p),
    addSphere: (p?: Record<string, unknown>) => add.uvSphere(p),
    get(nameOrId: string) { const o = scene().get(nameOrId); if (!o) throw new Error(`No object called "${nameOrId}"`); return objHandle(o); },
    find(nameOrId: string) { const o = scene().get(nameOrId); return o ? objHandle(o) : null; },
    /** The visible meshes as OBJ text, as File › Export OBJ writes it (without its two header lines, which carry the date). */
    /** Read OBJ text into new objects (traced with Record traces on); returns their handles. */
    fromOBJ(text: string) { return readOBJ(text); },
    toOBJ() { return exportOBJ(scene()).split('\n').slice(2).join('\n'); },
    get objects() { return scene().objects.map(objHandle); },
    get selected() { return [...editor.selected].map((id) => scene().get(id)).filter(Boolean).map((o) => objHandle(o!)); },
    get active() { const o = editor.activeObject; return o ? objHandle(o) : null; },
    delete(h: { id: string }) { scene().remove(h.id); },
    /** The camera stills are rendered from (View › Render still). Set it to any camera object. */
    get camera() { const c = scene().activeCamera ? scene().get(scene().activeCamera!) : undefined; return c ? objHandle(c) : null; },
    set camera(h: { id: string } | null) {
      if (h === null) { scene().activeCamera = null; return; }
      const o = scene().get(h.id);
      if (o?.kind !== 'camera') throw new Error('scene.camera: that object is not a camera');
      scene().activeCamera = o.id;
    },
    /** Stop showing a heat map. */
    hideField() { editor.clearField(); },
    /** The current frame. Setting it moves every animated object to its keyed transform. */
    get frame() { return scene().timeline.frame; },
    set frame(f: number) { scene().timeline.frame = Math.round(f); editor.applyFrame(); },
    get timeline() { const t = scene().timeline; return { start: t.start, end: t.end, fps: t.fps }; },
    setTimeline(t: { start?: number; end?: number; fps?: number }) {
      const cur = scene().timeline;
      const start = Math.round(t.start ?? cur.start), end = Math.round(t.end ?? cur.end), fps = Math.round(t.fps ?? cur.fps);
      if (!(end > start) || !(fps >= 1)) throw new Error('setTimeline: need end > start and fps ≥ 1');
      scene().timeline = { start, end, fps, frame: Math.min(end, Math.max(start, cur.frame)) };
    },
    clear() { scene().objects = []; },
  };

  const console = { log: (...a: unknown[]) => print(a.map(show).join(' ')), warn: (...a: unknown[]) => print(a.map(show).join(' ')), error: (...a: unknown[]) => print(a.map(show).join(' ')) };
  /** Parse a number the way the Inspector's fields do ("pi/4", "2*1.5"); throws with the position if it cannot. Traced with Record traces on. */
  const parse = (text: string) => {
    const r = traceExpr(String(text), trace('Parse a number'));
    if (r.value === null) throw new Error(`parse: ${r.error} (at character ${r.at + 1})`);
    return r.value;
  };
  return { scene: sceneApi, log: console.log, print: console.log, console, parse };
}

function show(x: unknown): string {
  if (typeof x === 'string') return x;
  if (x && typeof (x as { toString?: unknown }).toString === 'function' && (x as object).toString !== Object.prototype.toString && !Array.isArray(x)) return String(x);
  try { return JSON.stringify(x, (_k, v) => (typeof v === 'number' ? +v.toFixed(6) : v instanceof Float32Array || v instanceof Uint32Array ? Array.from(v) : v)); } catch { return String(x); }
}

/** Keep a script's changes as one undo step, unless it left a mesh that cannot be drawn. */
export function finishScript(editor: Editor, before: SceneJSON, label: string, code: string): void {
  // Objects whose keys the script changed take their transform for the current frame. Others keep
  // what the script set, even if animated, until the next frame change (as in Blender).
  const was = new Map(before.objects.map((o) => [o.id, JSON.stringify(o.anim ?? null)]));
  editor.applyFrame(new Set(editor.scene.objects.filter((o) => o.anim && was.get(o.id) !== JSON.stringify(o.anim)).map((o) => o.id)));
  const bad = editor.scene.objects.flatMap((o) => (o.mesh ? o.mesh.touch().validate().map((m) => `${o.name}: ${m}`) : []));
  if (bad.length) throw new Error(`The script left an invalid mesh:\n${bad.slice(0, 5).join('\n')}`);
  editor.scripting = false;
  editor.commitChange(label, before, code);
}

/** Put the scene back exactly as it was before the script. */
export function rollbackScript(editor: Editor, before: SceneJSON): void {
  editor.scripting = false;
  const s = Scene.fromJSON(before);
  editor.scene.objects = s.objects;
  editor.scene.nextId = s.nextId;
  editor.emit('scene');
}

/**
 * Run a script as one undoable step. On any error the scene is left exactly as it was.
 * With `record`, every statement reports its line and the variables in scope, and
 * the result carries a recording the step player can replay.
 */
export function runScript(editor: Editor, code: string, label = 'Run script', opts: { record?: boolean } = {}): ScriptResult & { recording?: Recording } {
  editor.endPreview();
  const output: string[] = [];
  const before = editor.scene.toJSON();
  const api = makeApi(editor, (s) => output.push(s));
  const rec = opts.record ? new Recorder(editor, () => output.length) : null;
  let line: number | null = null;
  const step = (l: number, vars: () => [string, unknown][]) => {
    line = l;
    if (rec && !rec.truncated) rec.event(l, vars().map(([k, v]) => [k, brief(v)]));
  };
  const recording = (error: { line: number | null; message: string } | null): Recording | undefined => rec
    ? { lang: 'js', code, events: rec.events, scenes: rec.scenes, truncated: rec.truncated, scenesCapped: rec.scenesCapped, output, error }
    : undefined;
  editor.scripting = true;
  try {
    let src = code;
    if (rec) {
      try { src = instrument(code); }
      catch (e) { const m = e instanceof Error ? e.message : String(e); throw new Error(`Syntax error: ${m}`); }
    }
    const fn = new Function('scene', 'log', 'print', 'console', 'parse', '__step', `"use strict";\n${src}`);
    const r = fn(api.scene, api.log, api.print, api.console, api.parse, step);
    if (r !== undefined) output.push(show(r));
    rec?.end();
    finishScript(editor, before, label, code);
    return { output, error: null, recording: recording(null) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    rec?.end();
    rollbackScript(editor, before);
    return { output, error: message, recording: recording({ line, message }) };
  }
}
