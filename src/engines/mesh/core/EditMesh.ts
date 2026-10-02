// MeshLab's editable mesh.
//
// WHY THIS EXISTS, AND WHY IT IS NOT A BufferGeometry
//
// THREE.BufferGeometry is a *render* format. It is triangles only, it carries
// no connectivity, and its vertices are whatever the GPU needs them to be. That
// is the right shape for drawing and the wrong shape for modelling:
//
//   - Every real modelling operation - extrude, inset, bevel, loop cut,
//     subdivide, dissolve - is a question about which faces share which edge,
//     and in what order around a vertex. BufferGeometry cannot answer that, so
//     each operation would have to rebuild the topology from scratch.
//   - Quads and n-gons are how models are actually built. A cube is six quads,
//     not twelve triangles. Triangulate up front and that structure is gone for
//     good, along with the ability to select an edge loop.
//
// So this is authoritative and BufferGeometry is derived from it.
//
// WHY NOT A HALF-EDGE STRUCTURE
//
// The textbook answer for editable meshes is half-edge, which is elegant and
// supports every local operation. It also cannot represent an edge with three
// faces on it, and real meshes are full of those. An imported STL routinely has
// boundary edges, duplicate faces and non-manifold junctions; a structure that
// cannot hold them can only reject the file.
//
// Blender hit the same wall and answered it with BMesh: an edge keeps a list of
// the faces using it, however many that is. This follows that shape - simplified
// to an explicit edge table rather than the full pointer cycles, which is enough
// for ordered traversal and much easier to verify.
//
// The invariant to hold on to: `verts` and `faces` are the truth. Everything
// else is a cache, rebuilt when they change.

import { Trace, fmt, fmtV, type TraceStep } from './trace';
import { faceTriangles } from './triangulate';

export type Vec3 = [number, number, number];

/** The serialisable form. This is what gets saved, exported, and handed over. */
export interface MeshSnapshot {
  verts: Vec3[];
  /** Each face is an ordered ring of vertex indices. Length >= 3, any length. */
  faces: number[][];
}

export interface EdgeInfo {
  a: number;
  b: number;
  /** Indices of every face using this edge. 1 = boundary, 2 = normal, 3+ = non-manifold. */
  faces: number[];
}

export interface MeshStats {
  verts: number;
  edges: number;
  faces: number;
  tris: number;
  boundaryEdges: number;
  nonManifoldEdges: number;
  wireEdges: number;
  /** verts - edges + faces. 2 for a single closed surface. */
  euler: number;
  closed: boolean;
  components: number;
  /** Only meaningful when closed. Negative means the surface is inside out. */
  volume: number;
  area: number;
  ngons: { tris: number; quads: number; larger: number };
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (u: Vec3, v: Vec3): Vec3 => [
  u[1] * v[2] - u[2] * v[1],
  u[2] * v[0] - u[0] * v[2],
  u[0] * v[1] - u[1] * v[0],
];
const dot = (u: Vec3, v: Vec3) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
const len = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);
const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

function norm(v: Vec3): Vec3 {
  const l = len(v);
  // A zero-length normal has no direction. Returning [0,0,0] rather than NaN
  // keeps a degenerate face from poisoning every average it takes part in.
  return l < 1e-12 ? [0, 0, 0] : [v[0] / l, v[1] / l, v[2] / l];
}

export class EditMesh {
  verts: Vec3[];
  faces: number[][];

  /** Edge table, keyed "lo-hi". Rebuilt on demand; never edited directly. */
  private edgeCache: Map<string, EdgeInfo> | null = null;

  constructor(verts: Vec3[] = [], faces: number[][] = []) {
    this.verts = verts;
    this.faces = faces;
  }

  // ── construction ────────────────────────────────────────────────────────

  static fromSnapshot(s: MeshSnapshot): EditMesh {
    return new EditMesh(
      s.verts.map((v) => [v[0], v[1], v[2]] as Vec3),
      s.faces.map((f) => f.slice()),
    );
  }

  /**
   * Build from the points-and-triangles form every mesh file and every
   * BufferGeometry uses. Nothing is merged: if the source is exploded, so is
   * this. `weld` is a separate, explicit step, because silently changing the
   * topology of an imported file is how you stop being able to trust it.
   */
  static fromTriangles(points: ArrayLike<number> | Vec3[], indices?: ArrayLike<number>): EditMesh {
    const verts: Vec3[] = [];
    if (Array.isArray(points) && Array.isArray(points[0])) {
      for (const p of points as Vec3[]) verts.push([p[0], p[1], p[2]]);
    } else {
      const flat = points as ArrayLike<number>;
      for (let i = 0; i + 2 < flat.length; i += 3) verts.push([flat[i], flat[i + 1], flat[i + 2]]);
    }
    const faces: number[][] = [];
    if (indices) {
      for (let i = 0; i + 2 < indices.length; i += 3) {
        faces.push([indices[i], indices[i + 1], indices[i + 2]]);
      }
    } else {
      // No index buffer means every three vertices are their own triangle,
      // which is precisely what an STL gives you.
      for (let i = 0; i + 2 < verts.length; i += 3) faces.push([i, i + 1, i + 2]);
    }
    return new EditMesh(verts, faces);
  }

  /** A unit cube as six quads, not twelve triangles. */
  static cube(size = 1): EditMesh {
    const h = size / 2;
    const verts: Vec3[] = [
      [-h, -h, -h], [h, -h, -h], [h, h, -h], [-h, h, -h],
      [-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h],
    ];
    // Every ring wound counter-clockwise seen from outside the cube. The bottom
    // is 0,3,2,1 and not 0,1,2,3: going round it the same direction as the top
    // makes both rings turn the same way in space, which points the bottom into
    // the solid.
    const faces = [
      [0, 1, 5, 4],   // front   y = -h
      [0, 3, 2, 1],   // bottom  z = -h
      [4, 5, 6, 7],   // top     z = +h
      [1, 2, 6, 5],   // right   x = +h
      [3, 0, 4, 7],   // left    x = -h
      [2, 3, 7, 6],   // back    y = +h
    ];
    return new EditMesh(verts, faces);
  }

  clone(): EditMesh {
    return EditMesh.fromSnapshot(this.toSnapshot());
  }

  toSnapshot(): MeshSnapshot {
    return {
      verts: this.verts.map((v) => [v[0], v[1], v[2]] as Vec3),
      faces: this.faces.map((f) => f.slice()),
    };
  }

  /** Call after any direct edit to `verts` or `faces`. */
  touch(): this {
    this.edgeCache = null;
    return this;
  }

  // ── topology ────────────────────────────────────────────────────────────

  static edgeKey(a: number, b: number): string {
    // Sorted, so the edge a->b and the edge b->a are the same edge. Two faces
    // sharing an edge traverse it in opposite directions when their winding
    // agrees, so without sorting a perfectly good solid reads as all boundary.
    return a < b ? `${a}-${b}` : `${b}-${a}`;
  }

  edges(): Map<string, EdgeInfo> {
    if (this.edgeCache) return this.edgeCache;
    const map = new Map<string, EdgeInfo>();
    this.faces.forEach((face, fi) => {
      for (let i = 0; i < face.length; i++) {
        const a = face[i];
        const b = face[(i + 1) % face.length];
        if (a === b) continue;   // a degenerate ring contributes no edge here
        const key = EditMesh.edgeKey(a, b);
        const existing = map.get(key);
        if (existing) existing.faces.push(fi);
        else map.set(key, { a: Math.min(a, b), b: Math.max(a, b), faces: [fi] });
      }
    });
    this.edgeCache = map;
    return map;
  }

  /**
   * Build the edge table afresh, as edges() does, recording each step: every face, every edge round it, the
   * sorted key it is filed under, and whether that key was new or already there. Then the edges by how many
   * faces they have: one (open), two (shared), three or more (non-manifold). The mesh is not changed.
   */
  edgeTable(trace?: Trace): { edges: number; open: [number, number][]; nonManifold: [number, number][] } {
    const map = new Map<string, EdgeInfo>();
    let asked = false;
    this.faces.forEach((face, fi) => {
      for (let i = 0; i < face.length; i++) {
        const a = face[i], b = face[(i + 1) % face.length];
        if (a === b) continue;
        const key = EditMesh.edgeKey(a, b), found = map.get(key);
        const before = found ? [...found.faces] : [];
        if (found) found.faces.push(fi); else map.set(key, { a: Math.min(a, b), b: Math.max(a, b), faces: [fi] });
        if (!trace) continue;
        const quiz = found && !asked;
        if (quiz) asked = true;
        trace.step({
          phase: found ? 'Found' : 'New edge',
          label: `Face ${fi}, v${a} → v${b}: key "${key}" ${found ? `found, faces ${before.join(', ')} → ${[...before, fi].join(', ')}` : 'is new, added with face ' + fi}`,
          detail: found
            ? 'The key is the two vertex numbers smallest first, so v' + a + ' → v' + b + ' finds the entry face ' + before[0] + ' made going the other way. Looking a key up in a hash map takes about the same time however big the table is, so the whole table costs one pass over the faces.'
            : 'The key is the two vertex numbers smallest first, so the same edge walked the other way by the next face finds this entry.',
          faces: [fi], edges: [[a, b]], verts: [a, b],
          values: [['key', key], ['faces on it', [...before, fi].join(', ')], ['edges so far', String(map.size)]],
          quiz: quiz ? { prompt: `Face ${fi} walks v${a} → v${b}. The table already holds key "${key}" with face ${before.join(', ')}. How many faces does the edge have after this step, and how many edges are in the table?`, answer: [before.length + 1, map.size], labels: ['faces on the edge', 'edges in the table'], rule: 'A key that is already there gains a face; the table does not grow. Only a new key adds an edge.' } : undefined,
        }, this);
      }
    });
    const all = [...map.values()];
    const pick = (test: (n: number) => boolean) => all.filter((e) => test(e.faces.length)).map((e) => [e.a, e.b] as [number, number]);
    const open = pick((n) => n === 1), shared = pick((n) => n === 2), nonManifold = pick((n) => n > 2);
    const list = (es: [number, number][]) => es.length ? es.map(([a, b]) => `${a}-${b}`).join(', ') : 'none';
    trace?.step({
      phase: 'Classify', label: `${map.size} edges: ${open.length} open, ${shared.length} shared by two faces, ${nonManifold.length} on three or more`,
      detail: 'An edge with one face is open: the surface has a hole or a rim there. Two faces is what every edge of a closed, solid surface has. Three or more is non-manifold: no solid object has one.',
      edges: [...open, ...nonManifold],
      values: [['open (1 face)', list(open)], ['shared (2 faces)', String(shared.length)], ['non-manifold (3+)', list(nonManifold)]],
      quiz: { prompt: `The table holds ${map.size} edges. How many are open (on only one face), and how many are on three or more faces?`, answer: [open.length, nonManifold.length], labels: ['open', 'three or more'], rule: 'Count the faces filed under each key: one is open, two is shared, three or more is non-manifold.' },
    }, this);
    return { edges: map.size, open, nonManifold };
  }

  /** Edges with exactly one face. Zero of these means a closed surface. */
  boundaryEdges(): EdgeInfo[] {
    return [...this.edges().values()].filter((e) => e.faces.length === 1);
  }

  /** Edges with three or more faces. No solid object has any. */
  nonManifoldEdges(): EdgeInfo[] {
    return [...this.edges().values()].filter((e) => e.faces.length > 2);
  }

  facesOfVert(v: number): number[] {
    const out: number[] = [];
    this.faces.forEach((f, i) => { if (f.includes(v)) out.push(i); });
    return out;
  }

  /** Faces sharing an edge with this one, in ring order, -1 where nothing is. */
  neighbours(fi: number): number[] {
    const face = this.faces[fi];
    const map = this.edges();
    return face.map((a, i) => {
      const b = face[(i + 1) % face.length];
      const e = map.get(EditMesh.edgeKey(a, b));
      if (!e) return -1;
      const others = e.faces.filter((f) => f !== fi);
      // With more than one other face the edge is non-manifold and "the
      // neighbour" is not a well-defined question, so say so rather than guess.
      return others.length === 1 ? others[0] : -1;
    });
  }

  /**
   * The pieces of the mesh: faces joined by shared edges, found by breadth-first search over the face graph.
   * Each piece starts from the lowest-numbered face not yet seen (or only from the faces in `from`), visits faces
   * in the order they were queued, and queues every unseen face across each of their edges. Traced: each visit
   * with the queue after it, and each finished piece.
   */
  pieces(trace?: Trace, from?: number[]): number[][] {
    const map = this.edges(), seen = new Array<boolean>(this.faces.length).fill(false), out: number[][] = [];
    let askedQueue = false, first: TraceStep | null = null;
    for (const seed of from ?? this.faces.map((_, i) => i)) {
      if (seed < 0 || seed >= this.faces.length || seen[seed]) continue;
      const piece: number[] = [], queue = [seed];
      seen[seed] = true;
      while (queue.length) {
        const f = queue.shift()!, face = this.faces[f], added: number[] = [];
        piece.push(f);
        face.forEach((a, i) => {
          for (const g of map.get(EditMesh.edgeKey(a, face[(i + 1) % face.length]))?.faces ?? []) if (!seen[g]) { seen[g] = true; queue.push(g); added.push(g); }
        });
        if (!trace) continue;
        const across = face.map((a, i) => (map.get(EditMesh.edgeKey(a, face[(i + 1) % face.length]))?.faces ?? []).filter((g) => g !== f)).flat();
        const quiz = !askedQueue && added.length > 0 && piece.length > 1;
        if (quiz) askedQueue = true;
        const step: TraceStep = {
          phase: 'Visit', label: `Piece ${out.length + 1}: visit face ${f}${added.length ? `, queue ${added.join(', ')}` : ', nothing new'}; queue now ${queue.length ? queue.join(', ') : 'empty'}`,
          detail: 'Take the face at the front of the queue. Across each of its edges is a neighbour (the edge table says which); any neighbour not seen before is marked seen and joins the back of the queue, so faces are visited in rings spreading out from the first.',
          faces: [...piece], verts: [...face],
          values: [['visiting', `face ${f}`], ['across its edges', across.length ? across.join(', ') : 'nothing'], ['new', added.length ? added.join(', ') : 'none'], ['queue', queue.length ? queue.join(', ') : 'empty'], ['piece so far', `${piece.length} face${piece.length === 1 ? '' : 's'}`]],
          quiz: quiz ? { prompt: `The queue holds ${[...queue.slice(0, queue.length - added.length)].join(', ') || 'nothing'} before face ${f} is visited. Across its edges are faces ${across.join(', ')}; faces already seen are not queued again. How many faces are in the queue after the visit?`, answer: [queue.length], labels: ['faces in the queue'], rule: 'Only neighbours not seen before join the queue. Faces already visited, or already waiting in the queue, are skipped, so each face is visited exactly once.' } : undefined,
        };
        if (!first && out.length === 0) first = step;
        trace.step(step, this);
      }
      out.push(piece);
      if (!trace) continue;
      // The first visit asks how big the first piece will get (when there is more than one): a question about
      // the shape, answered before the search shows it.
      if (first && out.length === 1 && !from && this.faces.length > piece.length) first.quiz = { prompt: `The search starts at face ${piece[0]} and spreads across shared edges. The mesh has ${this.faces.length} faces. How many will be in this first piece when the queue runs dry?`, answer: [piece.length], labels: ['faces in piece 1'], rule: 'A piece is everything reachable across shared edges from its first face: look at which faces touch along an edge, not at which are close.' };
      trace.step({
        phase: 'Piece done', label: `Piece ${out.length}: the queue is empty after ${piece.length} face${piece.length === 1 ? '' : 's'}`,
        detail: 'Nothing is left to visit, so no other face shares an edge with this piece. The search starts again from the next face not yet seen.',
        faces: [...piece],
        values: [['piece', String(out.length)], ['faces', piece.join(', ')]],
      }, this);
    }
    return out;
  }

  /**
   * Count what Euler's formula needs, from the lists and the edge table: the vertices faces use, the edges, the
   * faces, the pieces and the boundary loops (rims of holes). Then χ = V − E + F, and for a single edge-manifold
   * piece its genus g (handles, holes through it) from χ = 2 − 2g − b. Traced: one step per count, and the result.
   */
  topology(trace?: Trace): { V: number; E: number; F: number; chi: number; pieces: number; boundaryLoops: number; genus: number | null } {
    const used = new Set(this.faces.flat()), map = this.edges();
    const V = used.size, E = map.size, F = this.faces.length, chi = V - E + F;
    const pieces = this.pieces().length;
    // Boundary loops: the open edges, grouped by shared vertices (each rim is one loop of open edges).
    const open = [...map.values()].filter((e) => e.faces.length === 1);
    const parent = new Map<number, number>();
    const find = (x: number): number => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x)!)!); x = parent.get(x)!; } return x; };
    for (const e of open) { if (!parent.has(e.a)) parent.set(e.a, e.a); if (!parent.has(e.b)) parent.set(e.b, e.b); parent.set(find(e.a), find(e.b)); }
    const boundaryLoops = new Set([...parent.keys()].map(find)).size;
    const manifold = [...map.values()].every((e) => e.faces.length <= 2);
    const g2 = 2 - chi - boundaryLoops;
    const genus = pieces === 1 && manifold && g2 >= 0 && g2 % 2 === 0 ? g2 / 2 : null;
    if (trace) {
      trace.step({ phase: 'Count', label: `V = ${V}: the vertices the faces use`, detail: 'Count each vertex once, however many faces it is in. A vertex no face uses is not part of the surface.', verts: [...used], values: [['V', String(V)]] }, this);
      trace.step({ phase: 'Count', label: `E = ${E}: the entries in the edge table`, detail: 'Each edge once, under its two vertex numbers smallest first (lesson 1.3).', edges: [...map.values()].map((e) => [e.a, e.b] as [number, number]), values: [['E', String(E)], ['corner slots', String(this.faces.reduce((s, f) => s + f.length, 0))]] }, this);
      trace.step({ phase: 'Count', label: `F = ${F}: the faces`, detail: 'The length of the face list.', faces: this.faces.map((_, i) => i), values: [['F', String(F)]],
        quiz: { prompt: `V = ${V}, E = ${E}, F = ${F}. What is V − E + F?`, answer: [chi], labels: ['χ'], rule: 'χ = V − E + F, the Euler characteristic. For one closed piece shaped like a sphere it is 2.' } }, this);
      trace.step({ phase: 'Count', label: `${pieces} piece${pieces === 1 ? '' : 's'}, ${boundaryLoops} boundary loop${boundaryLoops === 1 ? '' : 's'}`, detail: 'Pieces by breadth-first search (lesson 1.4); boundary loops are the rims of holes, each a loop of open edges.', edges: open.map((e) => [e.a, e.b] as [number, number]), values: [['pieces', String(pieces)], ['boundary loops', String(boundaryLoops)], ['open edges', String(open.length)]] }, this);
      trace.step({
        phase: 'Result', label: `χ = ${V} − ${E} + ${F} = ${chi}${genus !== null ? `, so genus ${genus}` : ''}`,
        detail: 'For one piece with no edge on three faces, χ = 2 − 2g − b: g is the genus (the number of holes through it, like the hole of a ring) and b the number of boundary loops.',
        values: [['χ', String(chi)], ['b', String(boundaryLoops)], ['genus', genus === null ? 'not one manifold piece' : String(genus)]],
        quiz: genus !== null ? { prompt: `χ = ${chi} and the surface has ${boundaryLoops} boundary loop${boundaryLoops === 1 ? '' : 's'}. Using χ = 2 − 2g − b, how many holes go through it (its genus g)?`, answer: [genus], labels: ['g'], rule: 'g = (2 − χ − b) / 2. A sphere has χ = 2 and g = 0; a ring (torus) has χ = 0 and g = 1.' } : undefined,
      }, this);
    }
    return { V, E, F, chi, pieces, boundaryLoops, genus };
  }

  /**
   * Measure the angle at corner b between the edges to a and to c: u = a − b, v = c − b, their lengths, u · v,
   * the angle from cos θ = u · v / (|u| |v|), and u × v (at right angles to both; half its length is the area of
   * the triangle a, b, c). The mesh is not changed. Traced, with Predict questions on u · v and on θ.
   */
  measure(a: number, b: number, c: number, trace?: Trace): { u: Vec3; v: Vec3; lu: number; lv: number; dot: number; degrees: number; cross: Vec3; area: number } {
    const [A, B, C] = [a, b, c].map((i) => { const p = this.verts[i]; if (!p) throw new Error(`There is no vertex ${i}`); return p; });
    const u = sub(A, B), v = sub(C, B), lu = len(u), lv = len(v);
    if (lu < 1e-12 || lv < 1e-12) throw new Error('Measure: the two edges need length');
    const d = dot(u, v), cosT = Math.max(-1, Math.min(1, d / (lu * lv))), degrees = Math.acos(cosT) * 180 / Math.PI;
    const x = cross(u, v), area = len(x) / 2;
    const r = (n: number) => +n.toFixed(4);
    if (trace) {
      const arrow = (to: Vec3, label: string, color: string) => ({ from: B, to, label, color });
      trace.step({ phase: 'Vectors', label: `u = v${a} − v${b} = ${fmtV(u)}, v = v${c} − v${b} = ${fmtV(v)}`, detail: 'A vector from one point to another is the second point minus the first, coordinate by coordinate. Both start at the corner.', verts: [a, b, c], edges: [[a, b], [b, c]], arrows: [arrow(A, 'u', '#ffd166'), arrow(C, 'v', '#06d6a0')], values: [['u', fmtV(u)], ['v', fmtV(v)]] }, this);
      trace.step({ phase: 'Lengths', label: `|u| = ${r(lu)}, |v| = ${r(lv)}`, detail: 'Length is Pythagoras in three dimensions: |u| = √(uₓ² + u_y² + u_z²).', verts: [a, b, c], values: [['|u|', String(r(lu))], ['|v|', String(r(lv))]] }, this);
      trace.step({ phase: 'Dot product', label: `u · v = ${r(d)}`, detail: 'Multiply matching coordinates and add: uₓvₓ + u_yv_y + u_zv_z. It is |u| |v| cos θ, so its sign says whether the angle is under 90° (positive), 90° (zero) or over (negative).', verts: [a, b, c], values: [['u · v', String(r(d))]],
        quiz: { prompt: `u = ${fmtV(u)} and v = ${fmtV(v)}. What is u · v?`, answer: [d], labels: ['u · v'], rule: 'u · v = uₓvₓ + u_yv_y + u_zv_z.' } }, this);
      trace.step({ phase: 'Angle', label: `cos θ = ${r(d)} / (${r(lu)} × ${r(lv)}) = ${r(cosT)}, so θ = ${r(degrees)}°`, detail: 'Divide the dot product by both lengths to get cos θ, then take the inverse cosine.', verts: [a, b, c], values: [['cos θ', String(r(cosT))], ['θ', `${r(degrees)}°`]],
        quiz: { prompt: `u · v = ${r(d)}, |u| = ${r(lu)}, |v| = ${r(lv)}. What is the angle θ between them, in degrees?`, answer: [degrees], labels: ['θ (degrees)'], rule: 'cos θ = u · v / (|u| |v|), then θ = arccos of that.', tolerance: 0.2 } }, this);
      trace.step({ phase: 'Cross product', label: `u × v = ${fmtV(x)}: the triangle v${a}, v${b}, v${c} has area ${r(area)}`, detail: 'The cross product is at right angles to both edges (lesson 1.2), and its length is |u| |v| sin θ, the area of the parallelogram they span; the triangle is half.', verts: [a, b, c], arrows: [arrow([B[0] + x[0] / (len(x) || 1), B[1] + x[1] / (len(x) || 1), B[2] + x[2] / (len(x) || 1)], 'u × v', '#ef476f')], values: [['u × v', fmtV(x)], ['area', String(r(area))]] }, this);
    }
    return { u, v, lu, lv, dot: d, degrees, cross: x, area };
  }

  /** How many separate pieces the mesh is in, by walking shared edges. */
  components(): number {
    const parent = new Array(this.faces.length).fill(0).map((_, i) => i);
    const find = (x: number): number => {
      while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
      return x;
    };
    const union = (x: number, y: number) => { parent[find(x)] = find(y); };
    for (const e of this.edges().values()) {
      for (let i = 1; i < e.faces.length; i++) union(e.faces[0], e.faces[i]);
    }
    const roots = new Set<number>();
    for (let i = 0; i < this.faces.length; i++) roots.add(find(i));
    return roots.size;
  }

  // ── measurement ─────────────────────────────────────────────────────────

  faceNormal(fi: number): Vec3 {
    const f = this.faces[fi];
    // Newell's method: sums the cross products around the whole ring rather
    // than taking the first three corners. For an n-gon that is not perfectly
    // flat - which is most of them once you move a vertex - the first three
    // corners give a normal that does not represent the face.
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < f.length; i++) {
      const c = this.verts[f[i]];
      const n = this.verts[f[(i + 1) % f.length]];
      nx += (c[1] - n[1]) * (c[2] + n[2]);
      ny += (c[2] - n[2]) * (c[0] + n[0]);
      nz += (c[0] - n[0]) * (c[1] + n[1]);
    }
    return norm([nx, ny, nz]);
  }

  faceArea(fi: number): number {
    const f = this.faces[fi];
    let acc: Vec3 = [0, 0, 0];
    const o = this.verts[f[0]];
    for (let i = 1; i + 1 < f.length; i++) {
      const c = cross(sub(this.verts[f[i]], o), sub(this.verts[f[i + 1]], o));
      acc = [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]];
    }
    return len(acc) / 2;
  }

  faceCenter(fi: number): Vec3 {
    const f = this.faces[fi];
    const s: Vec3 = [0, 0, 0];
    for (const v of f) { s[0] += this.verts[v][0]; s[1] += this.verts[v][1]; s[2] += this.verts[v][2]; }
    return [s[0] / f.length, s[1] / f.length, s[2] / f.length];
  }

  /**
   * Signed volume by the divergence theorem. Meaningful only when the mesh is
   * closed, and the SIGN is the useful part: negative means every face is wound
   * the wrong way and the solid is inside out. Nothing else here detects that.
   */
  volume(): number {
    let total = 0;
    this.faces.forEach((f, fi) => {
      const o = this.verts[f[0]];
      for (let i = 1; i + 1 < f.length; i++) {
        const a = this.verts[f[i]];
        const b = this.verts[f[i + 1]];
        total += dot(o, cross(sub(a, o), sub(b, o))) / 6;
      }
      void fi;
    });
    return total;
  }

  area(): number {
    let t = 0;
    for (let i = 0; i < this.faces.length; i++) t += this.faceArea(i);
    return t;
  }

  stats(): MeshStats {
    const edges = this.edges();
    let boundary = 0, nonManifold = 0, wire = 0;
    for (const e of edges.values()) {
      if (e.faces.length === 1) boundary++;
      else if (e.faces.length > 2) nonManifold++;
      else if (e.faces.length === 0) wire++;
    }
    const ngons = { tris: 0, quads: 0, larger: 0 };
    let tris = 0;
    for (const f of this.faces) {
      tris += Math.max(0, f.length - 2);
      if (f.length === 3) ngons.tris++;
      else if (f.length === 4) ngons.quads++;
      else ngons.larger++;
    }
    return {
      verts: this.verts.length,
      edges: edges.size,
      faces: this.faces.length,
      tris,
      boundaryEdges: boundary,
      nonManifoldEdges: nonManifold,
      wireEdges: wire,
      euler: this.verts.length - edges.size + this.faces.length,
      closed: boundary === 0 && nonManifold === 0 && this.faces.length > 0,
      components: this.components(),
      volume: this.volume(),
      area: this.area(),
      ngons,
    };
  }

  // ── operations ──────────────────────────────────────────────────────────

  /**
   * Merge vertices at the same place and repoint every face at the survivors.
   *
   * `tol` of 0 compares exactly, which is enough for real files: duplicated
   * corners in an STL are bit-identical copies of one number, not separate
   * measurements that nearly agree. A tolerance above zero (Merge by distance)
   * joins points within that distance, found with a spatial hash, and is worth
   * reaching for when something has been through a format that re-rounded the
   * coordinates, or when separate pieces were modelled to meet. Traced when a
   * tolerance is given.
   */
  weld(tol = 0, trace?: Trace): this {
    // Exact (tol 0): a point's key is its coordinates. Within a distance: a spatial hash. Each kept point is
    // filed in a cube-shaped cell of side tol, and a new point looks in its own cell and the 26 around it, so a
    // match just across a cell wall is not missed; it joins the nearest kept point within tol, or is kept.
    const exact = new Map<string, number>(), cells = new Map<string, number[]>();
    const remap = new Array<number>(this.verts.length);
    const kept: Vec3[] = [];
    const cellOf = (v: Vec3) => v.map((x) => Math.floor(x / tol)) as Vec3;
    const ck = (c: Vec3) => `${c[0]},${c[1]},${c[2]}`;
    let asked = false;
    // Copies differ in the fourth decimal place or later, so the trace shows five decimals, not three.
    const at = (p: Vec3) => `(${p.map((x) => +x.toFixed(5)).join(', ')})`;
    this.verts.forEach((v, i) => {
      let hit = -1, hitD = Infinity, hitCell = '';
      const near: number[] = [];
      if (tol === 0) {
        const k = `${v[0]},${v[1]},${v[2]}`, h = exact.get(k);
        if (h === undefined) exact.set(k, kept.length); else { hit = h; hitD = 0; }
      } else {
        const c = cellOf(v);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          const key = ck([c[0] + dx, c[1] + dy, c[2] + dz]);
          for (const k of cells.get(key) ?? []) {
            near.push(k);
            const d = len(sub(kept[k], v));
            if (d <= tol && d < hitD) { hit = k; hitD = d; hitCell = key; }
          }
        }
        if (hit < 0) { const key = ck(c); if (!cells.has(key)) cells.set(key, []); cells.get(key)!.push(kept.length); }
      }
      remap[i] = hit >= 0 ? hit : kept.length;
      if (hit < 0) kept.push(v);
      if (!trace || tol === 0) return;
      const own = ck(cellOf(v)), across = hit >= 0 && hitCell !== own;
      const quiz = across && !asked;
      if (quiz) asked = true;
      const show = (k: number) => `kept point ${k} at ${at(kept[k])}`;
      trace.step({
        phase: hit >= 0 ? 'Merge' : 'Keep',
        label: `v${i} at ${at(v)}, cell (${own}): ${hit >= 0 ? `${+hitD.toFixed(5)} from kept point ${hit}${across ? ' in a neighbouring cell' : ''}, so it becomes ${hit}` : `nothing within ${tol} in the 27 cells round it, so it is kept as ${remap[i]}`}`,
        detail: hit >= 0
          ? (across ? 'The match is across a cell wall. Rounding each point to its own cell and comparing cells alone would have missed it; looking in the 26 neighbouring cells as well finds it.' : 'The match is in the same cell, within the distance.')
          : 'A point is only compared with the kept points in its cell and the cells touching it, not with every point: that is what makes the hash fast.',
        verts: [i], points: hit >= 0 ? [{ p: kept[hit], label: String(hit), color: '#06d6a0' }] : [],
        values: [['cell', `(${own})`], ['kept points nearby', near.length ? near.join(', ') : 'none'], ['result', hit >= 0 ? `merged into ${hit}` : `kept as ${remap[i]}`]],
        quiz: quiz ? { prompt: `v${i} is at ${at(v)}, in cell (${own}); the cells are ${tol} wide. The kept points in the 27 cells round it: ${near.map(show).join('; ')}. Which does it become, the nearest within ${tol}? (Answer −1 for none: it is kept.)`, answer: [hit], labels: ['kept point'], rule: 'Work out each distance and take the nearest within the merge distance. A point near a cell wall can match a point in the next cell, which is why the search looks at all 27.' } : undefined,
      }, this);
    });
    const before = this.verts.length, faceCount = this.faces.length;
    this.verts = kept;
    this.faces = this.faces
      .map((f) => {
        // Collapse runs of the same index, which a merge can create.
        const ring = f.map((v) => remap[v]).filter((v, i, arr) => v !== arr[(i + 1) % arr.length]);
        return ring;
      })
      // A ring that has fallen below three corners is no longer a face.
      .filter((f) => f.length >= 3);
    if (trace && tol > 0) trace.step({
      phase: 'Repoint faces', label: `${before - kept.length} vertices merged: ${before} → ${kept.length}; faces repointed${faceCount - this.faces.length ? `, ${faceCount - this.faces.length} fell below 3 corners and were dropped` : ''}`,
      detail: 'Every corner of every face is replaced by the number of the point it merged into, so faces that used separate copies of a corner now share one vertex, and the edges between them become shared edges.',
      values: [['vertices', `${before} → ${kept.length}`], ['faces', `${faceCount} → ${this.faces.length}`]],
    }, this);
    return this.touch();
  }

  /** Drop vertices no face refers to. */
  compact(): this {
    const used = new Set<number>();
    for (const f of this.faces) for (const v of f) used.add(v);
    const remap = new Map<number, number>();
    const kept: Vec3[] = [];
    this.verts.forEach((v, i) => {
      if (!used.has(i)) return;
      remap.set(i, kept.length);
      kept.push(v);
    });
    this.verts = kept;
    this.faces = this.faces.map((f) => f.map((v) => remap.get(v)!));
    return this.touch();
  }

  /**
   * Reverse the winding of the given faces, or all of them. The normal is a cross product of edges taken in the
   * face's order (Newell's method, faceNormal), so going round the other way turns it to point the other way.
   * Traced: each face's normal before, its corners reversed, and its normal after.
   */
  flip(faceIdxs?: number[], trace?: Trace): this {
    const target = faceIdxs ?? this.faces.map((_, i) => i);
    for (const [k, fi] of target.entries()) {
      const before = this.faceNormal(fi), c = this.faceCenter(fi), len = 0.6 * Math.sqrt(Math.max(this.faceArea(fi), 1e-9));
      const tip = (n: Vec3): Vec3 => [c[0] + n[0] * len, c[1] + n[1] * len, c[2] + n[2] * len];
      const order = this.faces[fi];
      trace?.step({
        phase: 'Normal before', label: `Face ${fi}: corners ${order.map((v) => `v${v}`).join(' → ')}, normal ${fmtV(before)}`,
        detail: 'Newell\'s method: the normal is the sum of cross products of the edges, taken in the order the corners are listed (the right-hand rule).',
        faces: [fi], verts: order, arrows: [{ from: c, to: tip(before), label: 'n', color: '#ffd166' }],
        values: [['corners', order.map((v) => `v${v}`).join(', ')], ['normal', fmtV(before)]],
      });
      this.faces[fi] = order.slice().reverse();
      const after = this.faceNormal(fi);
      trace?.step({
        phase: 'Reversed', label: `Face ${fi}: corners ${this.faces[fi].map((v) => `v${v}`).join(' → ')}, normal ${fmtV(after)}`,
        detail: 'Every edge now runs the other way, so every cross product in the sum changes sign: n′ = −n.',
        faces: [fi], verts: this.faces[fi], arrows: [{ from: c, to: tip(after), label: 'n′', color: '#06d6a0' }],
        values: [['corners', this.faces[fi].map((v) => `v${v}`).join(', ')], ['normal before', fmtV(before)], ['normal after', fmtV(after)]],
        quiz: k === 0 ? { prompt: `Face ${fi}'s normal is ${fmtV(before)} with its corners in the order ${order.map((v) => `v${v}`).join(', ')}. Reversed to ${this.faces[fi].map((v) => `v${v}`).join(', ')}, what is its normal?`, answer: after, labels: ['x', 'y', 'z'], rule: 'Reversing the order reverses every edge, so every cross product changes sign: the normal points the other way, n′ = −n, with the same length.' } : undefined,
      }, this);
    }
    return this.touch();
  }

  /** The pieces of a set of faces: faces sharing an edge are in one piece. */
  faceRegions(faceIdxs: number[]): number[][] {
    const sel = new Set(faceIdxs), parent = new Map(faceIdxs.map((f) => [f, f]));
    const find = (x: number): number => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x)!)), parent.get(x)!));
    for (const e of this.edges().values()) {
      const fs = e.faces.filter((f) => sel.has(f));
      for (let i = 1; i < fs.length; i++) parent.set(find(fs[0]), find(fs[i]));
    }
    const groups = new Map<number, number[]>();
    for (const f of faceIdxs) { const r = find(f); (groups.get(r) ?? groups.set(r, []).get(r)!).push(f); }
    return [...groups.values()];
  }

  /**
   * Extrude a region of faces along the region's average normal.
   *
   * This is the operation that justifies the whole data structure. It has to
   * know which edges are on the BORDER of the selection - used by exactly one
   * selected face - because those are the ones that get a wall, and the
   * interior ones must not. Without connectivity there is no way to ask.
   */
  extrudeFaces(faceIdxs: number[], distance: number, trace?: Trace, opts: { skipWall?: (a: number, b: number) => boolean } = {}): this {
    if (!faceIdxs.length) return this;
    // Separate pieces of the selection (not sharing an edge) each move along their own normal,
    // as Blender extrudes regions: six opposite sides of a box would otherwise average to nothing.
    const regions = this.faceRegions(faceIdxs);
    if (regions.length > 1) { for (const r of regions) this.extrudeFaces(r, distance, trace, opts); return this; }
    const region = new Set(faceIdxs);

    // Area-weighted average normal, so a big face in the selection counts for
    // more than a sliver.
    let n: Vec3 = [0, 0, 0];
    for (const fi of region) {
      const fn = this.faceNormal(fi);
      const a = this.faceArea(fi);
      n = [n[0] + fn[0] * a, n[1] + fn[1] * a, n[2] + fn[2] * a];
      if (trace && trace.detailed(region.size)) {
        trace.step({
          phase: 'Average normal', label: `Face ${fi}: normal ${fmtV(fn)}, area ${fmt(a)}`,
          detail: 'Each face votes for the direction with its normal, weighted by its area.',
          faces: [fi], arrows: [{ from: this.faceCenter(fi), to: add3(this.faceCenter(fi), fn), label: 'n', color: '#38bdf8' }],
        });
      }
    }
    n = norm(n);
    if (trace) {
      let c: Vec3 = [0, 0, 0];
      for (const fi of region) c = add3(c, this.faceCenter(fi));
      c = [c[0] / region.size, c[1] / region.size, c[2] / region.size];
      trace.step({
        phase: 'Average normal', label: `Direction n = ${fmtV(n)}`,
        detail: 'n = normalize(Σ area·normal). Every new vertex moves along n by the distance.',
        faces: [...region], arrows: [{ from: c, to: add3(c, [n[0] * distance, n[1] * distance, n[2] * distance]), label: `d = ${fmt(distance)}`, color: '#f59e0b' }],
        values: [['n', fmtV(n)], ['distance', fmt(distance)]],
      });
    }

    // Keep the original rings: the walls are built from them, and the region
    // faces are about to be rewritten.
    const originals = new Map<number, number[]>();
    for (const fi of region) originals.set(fi, this.faces[fi].slice());

    // One offset copy per vertex the region touches.
    const moved = new Map<number, number>();
    for (const ring of originals.values()) {
      for (const v of ring) {
        if (moved.has(v)) continue;
        const p = this.verts[v];
        moved.set(v, this.verts.length);
        this.verts.push([p[0] + n[0] * distance, p[1] + n[1] * distance, p[2] + n[2] * distance]);
      }
    }

    if (trace) {
      trace.step({
        phase: 'Copy vertices', label: `${moved.size} new vertices, each v' = v + d·n`,
        quiz: (() => { const [o0, c0] = [...moved][0]; return { prompt: `The region moves along n = ${fmtV(n)} by d = ${fmt(distance)}. Where does the copy of v${o0} = ${fmtV(this.verts[o0])} go?`, answer: this.verts[c0], labels: ['x', 'y', 'z'], rule: 'v′ = v + d·n: every vertex of the region is copied the same distance along the same direction.' }; })(),
        detail: 'The originals stay where they are: they become the bottom of the walls.',
        verts: [...moved.values()],
        points: [...moved.values()].slice(0, 60).map((v) => ({ p: this.verts[v], label: `v${v}`, color: '#f59e0b' })),
      }, this);
    }

    // How many selected faces use each edge. One means it is on the border.
    const useCount = new Map<string, number>();
    for (const ring of originals.values()) {
      for (let i = 0; i < ring.length; i++) {
        const key = EditMesh.edgeKey(ring[i], ring[(i + 1) % ring.length]);
        useCount.set(key, (useCount.get(key) ?? 0) + 1);
      }
    }
    if (trace) {
      const border: [number, number][] = [], inner: [number, number][] = [];
      for (const [key, c] of useCount) { const [a, b] = key.split('-').map(Number); (c === 1 ? border : inner).push([a, b]); }
      trace.step({
        phase: 'Border edges', label: `${border.length} border edge${border.length === 1 ? '' : 's'}, ${inner.length} inner edge${inner.length === 1 ? '' : 's'}`,
        detail: 'An edge used by exactly one selected face is on the border of the region and gets a wall. An edge shared by two selected faces is inside the region and does not.',
        edges: border, values: [['border', String(border.length)], ['inside', String(inner.length)]],
      });
    }

    // The region's faces lift to the offset copies, keeping their ring order so
    // they keep facing the same way.
    for (const [fi, ring] of originals) {
      this.faces[fi] = ring.map((v) => moved.get(v)!);
    }
    this.touch();
    trace?.step({ phase: 'Lift faces', label: `${region.size} face(s) moved to the new vertices`, faces: [...region] }, this);

    // A wall per border edge. Taking the edge in the direction its own face
    // walks it, then going up, keeps the wall's winding agreeing with the cap.
    let walls = 0;
    for (const ring of originals.values()) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        if (useCount.get(EditMesh.edgeKey(a, b)) !== 1) continue;
        // With a clipped mirror, a border edge lying on the mirror plane gets no
        // wall: that wall would sit in the plane, inside the mirrored solid.
        if (opts.skipWall?.(a, b)) continue;
        this.faces.push([a, b, moved.get(b)!, moved.get(a)!]);
        walls++;
        if (trace && trace.detailed(1)) {
          this.touch();
          trace.step({
            phase: 'Walls', label: `Wall ${walls}: [${a}, ${b}, ${moved.get(b)}, ${moved.get(a)}]`,
            detail: 'Walk the border edge in its own face\'s direction, then up: the wall faces outward, the same way as its neighbours.',
            faces: [this.faces.length - 1], edges: [[a, b]],
          }, this);
        }
      }
    }

    return this.touch();
  }

  // ── more operations ─────────────────────────────────────────────────────

  /** Area-weighted average of the normals of the faces around a vertex. */
  vertexNormal(v: number): Vec3 {
    let n: Vec3 = [0, 0, 0];
    this.faces.forEach((f, fi) => {
      if (!f.includes(v)) return;
      const fn = this.faceNormal(fi), a = this.faceArea(fi);
      n = [n[0] + fn[0] * a, n[1] + fn[1] * a, n[2] + fn[2] * a];
    });
    return norm(n);
  }

  /** Vertices joined to v by an edge. */
  neighbourVerts(v: number): number[] {
    const out = new Set<number>();
    for (const e of this.edges().values()) { if (e.a === v) out.add(e.b); else if (e.b === v) out.add(e.a); }
    return [...out];
  }

  /**
   * Inset each given face on its own: a smaller copy of the face inside it,
   * joined to the original outline by a ring of quads. `amount` is the fraction
   * of the way from each corner to the face's centre (0 to 1).
   */
  insetFaces(faceIdxs: number[], amount: number, trace?: Trace): this {
    const t = Math.min(0.999, Math.max(0.001, amount));
    for (const fi of faceIdxs) {
      const ring = this.faces[fi];
      const c = this.faceCenter(fi);
      const inner = ring.map((v) => {
        const p = this.verts[v];
        this.verts.push([p[0] + (c[0] - p[0]) * t, p[1] + (c[1] - p[1]) * t, p[2] + (c[2] - p[2]) * t]);
        return this.verts.length - 1;
      });
      if (trace && trace.detailed(2)) {
        trace.step({
          phase: 'Inner ring', label: `Face ${fi}: ${ring.length} inner corners`,
          detail: `Each inner corner = corner + t·(centre − corner), t = ${fmt(t)}.`,
          faces: [fi], points: [{ p: c, label: 'centre', color: '#38bdf8' }, ...inner.map((v) => ({ p: this.verts[v], color: '#f59e0b' }))],
          values: [['centre', fmtV(c)], ['t', fmt(t)]],
          quiz: fi === faceIdxs[0] ? { prompt: `Face ${fi}'s centre is ${fmtV(c)} and the inset amount is t = ${fmt(t)}. Where does the inner copy of its corner ${fmtV(this.verts[ring[0]])} go?`, answer: this.verts[inner[0]], labels: ['x', 'y', 'z'], rule: 'inner = corner + t·(centre − corner): each corner slides the fraction t of the way to the face\'s centre.' } : undefined,
        }, this);
      }
      this.faces[fi] = inner;
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length;
        this.faces.push([ring[i], ring[j], inner[j], inner[i]]);
      }
      this.touch();
      if (trace && trace.detailed(1)) {
        trace.step({ phase: 'Bridge', label: `Face ${fi}: ${ring.length} quads join the outline to the inner face`, faces: [fi, ...ring.map((_, i) => this.faces.length - ring.length + i)] }, this);
      }
    }
    return this.touch();
  }

  /** Remove faces. Vertices no longer used by any face are removed too. */
  deleteFaces(faceIdxs: number[]): this {
    const drop = new Set(faceIdxs);
    const touched = new Set<number>();
    faceIdxs.forEach((fi) => this.faces[fi]?.forEach((v) => touched.add(v)));
    this.faces = this.faces.filter((_, i) => !drop.has(i));
    const used = new Set<number>();
    for (const f of this.faces) for (const v of f) used.add(v);
    return this.removeVerts([...touched].filter((v) => !used.has(v)));
  }

  /**
   * The face that would close a hole: the selected vertices, in order round
   * the hole, wound opposite to the faces beside it so the new face points the
   * same way as its neighbours. A string says why there is no such face.
   *
   * Every edge of the hole is a boundary edge (one face). If its face walks it
   * a → b, the new face must walk it b → a, so following "b comes before a"
   * round the loop gives the corners in order.
   */
  fillPlan(verts: number[]): number[] | string {
    const chosen = new Set(verts);
    if (chosen.size < 3) return 'Select at least three vertices round a hole';
    const before = new Map<number, number>(); // before.get(b) = a: the new face goes b → a
    for (const e of this.boundaryEdges()) {
      if (!chosen.has(e.a) || !chosen.has(e.b)) continue;
      const f = this.faces[e.faces[0]], i = f.indexOf(e.a);
      const [a, b] = f[(i + 1) % f.length] === e.b ? [e.a, e.b] : [e.b, e.a];
      if (before.has(b)) return 'The selection branches: select the vertices round one hole';
      before.set(b, a);
    }
    if (before.size !== chosen.size) return 'Those vertices are not all on one hole’s edge: select every vertex round the hole';
    const loop = [verts[0]];
    for (let v = before.get(verts[0])!; v !== verts[0]; v = before.get(v)!) {
      if (v === undefined || loop.length > chosen.size) return 'The selected edges do not close into one loop';
      loop.push(v);
    }
    return loop.length === chosen.size ? loop : 'The selection is more than one hole: fill them one at a time';
  }

  /**
   * Close a hole with one face (Blender's F). Returns the new face's index. Traced: each edge of the hole, the
   * way its face walks it and so the way the new face must, the loop that gives, and the new face's normal.
   */
  fill(verts: number[], trace?: Trace): number {
    const plan = this.fillPlan(verts);
    if (typeof plan === 'string') throw new Error(plan);
    if (trace) {
      const chosen = new Set(plan);
      for (const e of this.boundaryEdges()) {
        if (!chosen.has(e.a) || !chosen.has(e.b)) continue;
        const f = this.faces[e.faces[0]], i = f.indexOf(e.a);
        const [a, b] = f[(i + 1) % f.length] === e.b ? [e.a, e.b] : [e.b, e.a];
        trace.step({ phase: 'Rim edges', label: `Face ${e.faces[0]} walks v${a} → v${b}, so the new face must walk v${b} → v${a}`, detail: 'Two faces wound the same way round walk their shared edge in opposite directions (lesson 1.3), so each edge of the hole fixes one step of the new face.', faces: [e.faces[0]], edges: [[a, b]], verts: [a, b], values: [['neighbour walks', `v${a} → v${b}`], ['new face walks', `v${b} → v${a}`]] }, this);
      }
      trace.step({ phase: 'Loop', label: `Following the steps round the hole: ${plan.map((v) => `v${v}`).join(' → ')}`, detail: 'Each step ends where the next begins, so following them from any corner goes once round the hole and gives the corners in order.', verts: plan, values: [['corners', plan.join(', ')]] }, this);
    }
    this.faces.push(plan);
    this.touch();
    const fi = this.faces.length - 1;
    if (trace) {
      const n = this.faceNormal(fi), c = this.faceCenter(fi), l = 0.6 * Math.sqrt(Math.max(this.faceArea(fi), 1e-9));
      trace.step({
        phase: 'New face', label: `Face ${fi}: ${plan.map((v) => `v${v}`).join(' → ')}, normal ${fmtV(n)}`,
        detail: 'Wound the opposite way to its neighbours along every shared edge, so it points the same way they do.',
        faces: [fi], arrows: [{ from: c, to: [c[0] + n[0] * l, c[1] + n[1] * l, c[2] + n[2] * l], label: 'n', color: '#06d6a0' }], values: [['corners', plan.join(', ')], ['normal', fmtV(n)]],
        quiz: { prompt: `The new face goes ${plan.map((v) => `v${v} ${fmtV(this.verts[v])}`).join(' → ')}. What is its unit normal (lesson 1.2)?`, answer: n, labels: ['x', 'y', 'z'], rule: 'Newell\'s method round the corners in this order, the right-hand rule. Because the order came from the neighbours, it points out of the solid, as they do.' },
      }, this);
    }
    return fi;
  }

  /** Remove vertices and every face that uses any of them. */
  deleteVerts(vertIdxs: number[]): this {
    const drop = new Set(vertIdxs);
    this.faces = this.faces.filter((f) => !f.some((v) => drop.has(v)));
    return this.removeVerts(vertIdxs);
  }

  /** Remove every face using one of the edges; drop the edges' vertices if nothing uses them any more. */
  deleteEdges(edges: [number, number][]): this {
    const keys = new Set(edges.map(([a, b]) => EditMesh.edgeKey(a, b)));
    const touched = new Set(edges.flat());
    this.faces = this.faces.filter((f) => !f.some((v, i) => keys.has(EditMesh.edgeKey(v, f[(i + 1) % f.length]))));
    const used = new Set<number>();
    for (const f of this.faces) for (const v of f) used.add(v);
    return this.removeVerts([...touched].filter((v) => !used.has(v)));
  }

  /** Remove exactly these vertices (faces must not use them) and renumber the rest. */
  private removeVerts(vertIdxs: number[]): this {
    const drop = new Set(vertIdxs);
    const remap = new Array<number>(this.verts.length);
    const kept: Vec3[] = [];
    this.verts.forEach((p, i) => { if (!drop.has(i)) { remap[i] = kept.length; kept.push(p); } });
    this.verts = kept;
    this.faces = this.faces.map((f) => f.map((v) => remap[v]));
    return this.touch();
  }

  /**
   * Merge vertices into one at their centroid (or at `at`). Faces that lose a
   * corner become smaller faces; faces that fall below three corners go.
   */
  mergeVerts(vertIdxs: number[], at?: Vec3, trace?: Trace): this {
    if (vertIdxs.length < 2) return this;
    const target = vertIdxs[0];
    const pos: Vec3 = at ?? vertIdxs.reduce<Vec3>((s, v) => add3(s, this.verts[v]), [0, 0, 0]).map((x) => x / vertIdxs.length) as Vec3;
    trace?.step({
      phase: 'Merge', label: `${vertIdxs.length} vertices → one at ${fmtV(pos)}`, verts: vertIdxs, points: [{ p: pos, label: 'merged', color: '#f59e0b' }],
      detail: at ? 'The vertices meet at the given point.' : 'At centre: the merged vertex goes to the centroid, the average of the merged positions.',
      quiz: at ? undefined : { prompt: `${vertIdxs.length} vertices at ${vertIdxs.slice(0, 4).map((v) => fmtV(this.verts[v])).join(', ')}${vertIdxs.length > 4 ? ', …' : ''} merge at their centre. Where is it?`, answer: pos, labels: ['x', 'y', 'z'], rule: 'The centroid: add the positions and divide by how many there are.' },
    }, this);
    const into = new Set(vertIdxs);
    this.verts[target] = pos;
    const before = this.faces.length;
    let shrunk = 0;
    this.faces = this.faces
      .map((f) => { const g = f.map((v) => (into.has(v) ? target : v)).filter((v, i, arr) => v !== arr[(i + 1) % arr.length]); if (g.length < f.length && g.length >= 3) shrunk++; return g; })
      .filter((f) => f.length >= 3 && new Set(f).size === f.length);
    this.removeVerts(vertIdxs.slice(1));
    trace?.step({
      phase: 'Merge', label: `${this.faces.length} faces remain: ${shrunk} lost corners, ${before - this.faces.length} collapsed and went`, verts: [target],
      detail: 'In every face the merged vertices become one, and repeats next to each other are dropped. A face left with fewer than three corners has no area: it goes.',
    }, this);
    return this;
  }

  /**
   * The edge loop through the edge (a, b), as Blender's Alt+click finds it. At a vertex
   * with four edges, go straight on: take the one edge that shares no face with the
   * edge you arrived along. Along a boundary, a vertex with three edges continues to
   * the next boundary edge. A pole (any other count) or a triangle or n-gon stops the
   * walk, which then runs the other way from (a, b). With a trace, each vertex reached is a step: how many edges
   * meet there and which way the walk goes on (Predict questions on the first vertex reached and on the length).
   */
  edgeLoop(a: number, b: number, trace?: Trace): { edges: [number, number][]; closed: boolean } {
    const map = this.edges(), startKey = EditMesh.edgeKey(a, b);
    if (!map.has(startKey)) return { edges: [], closed: false };
    const around = new Map<number, EdgeInfo[]>();
    for (const e of map.values()) for (const v of [e.a, e.b]) { let l = around.get(v); if (!l) around.set(v, (l = [])); l.push(e); }
    const walk = (from: number, to: number) => {
      const out: [number, number][] = [];
      const seen = new Set([startKey]);
      let prev = from, cur = to;
      for (;;) {
        const came = map.get(EditMesh.edgeKey(prev, cur))!, inc = around.get(cur)!;
        const quads = inc.every((e) => e.faces.every((f) => this.faces[f].length === 4));
        let next: EdgeInfo[] = [];
        if (came.faces.length === 2 && inc.length === 4 && quads) next = inc.filter((e) => e !== came && !e.faces.some((f) => came.faces.includes(f)));
        else if (came.faces.length === 1 && inc.length === 3 && quads) next = inc.filter((e) => e !== came && e.faces.length === 1);
        const why = !quads ? 'a triangle or n-gon meets it: stop' : came.faces.length === 2 ? (inc.length === 4 ? 'four edges: go straight on, along the one edge that shares no face with the edge just walked' : `${inc.length} edges (a pole): there is no straight on, stop`) : (inc.length === 3 ? 'on the boundary with three edges: follow the boundary' : 'on the boundary, not three edges: stop');
        if (next.length !== 1) { trace?.step({ phase: 'Walk', label: `v${cur}: ${why}`, detail: 'A loop runs straight through vertices where four quads meet. Anywhere else there is no single "straight on", so the loop ends there.', verts: [cur] }); return { out, closed: false }; }
        const key = EditMesh.edgeKey(next[0].a, next[0].b);
        const n0 = next[0].a === cur ? next[0].b : next[0].a;
        trace?.step({
          phase: 'Walk', label: `v${cur}: ${why} → v${n0}`, detail: 'At a vertex with four edges, two of them are the sides of the quads the incoming edge belongs to; the fourth, sharing no face with it, is straight on.', verts: [cur, n0], edges: [[cur, n0]],
          quiz: out.length === 0 && from === a && trace.steps.length === 1 ? { prompt: `The loop arrives at v${cur} along the edge from v${prev}. Which vertex does it go on to (its number)?`, answer: [n0], labels: ['vertex'], rule: 'Take the edge at this vertex that shares no face with the edge you arrived along.', tolerance: 0 } : undefined,
        });
        if (key === startKey) return { out, closed: true };
        if (seen.has(key)) return { out, closed: false };
        seen.add(key);
        const n = n0;
        out.push([cur, n]);
        prev = cur; cur = n;
      }
    };
    trace?.step({ phase: 'Start', label: `Start at the edge v${a}–v${b}, and walk on from v${b}`, detail: 'An edge loop is the line of edges that runs straight on through the mesh, like a line of latitude on a globe.', verts: [a, b], edges: [[a, b]] });
    const fwd = walk(a, b);
    const done = (edges: [number, number][], closed: boolean) => {
      trace?.step({ phase: 'Loop', label: `${edges.length} edges${closed ? ', all the way round' : ', open at both ends'}`, detail: closed ? 'The walk came back to the edge it started from.' : 'The walk stopped one way, so it was run the other way from the start edge too.', edges, verts: [...new Set(edges.flat())], quiz: { prompt: 'How many edges does the whole loop have?', answer: [edges.length], labels: ['edges'], rule: 'Count every edge walked, both ways from the start, including the start edge.', tolerance: 0 } });
      return { edges, closed };
    };
    if (fwd.closed) return done([[a, b], ...fwd.out], true);
    trace?.step({ phase: 'Back', label: `Now the other way, from v${a}`, detail: 'The loop did not close, so it may also run on beyond the start edge\'s other end.', verts: [a] });
    const back = walk(b, a);
    return done([...back.out.map(([x, y]) => [y, x] as [number, number]).reverse(), [a, b], ...fwd.out], false);
  }

  /**
   * The ring of quads crossed by walking from an edge to the opposite edge of
   * each quad in turn. Returns the edges crossed, each oriented so that its
   * first vertex is on the same side of the ring, and the quads in order.
   */
  edgeRing(a: number, b: number, trace?: Trace): { edges: [number, number][]; faces: number[]; closed: boolean } {
    const map = this.edges();
    const start = map.get(EditMesh.edgeKey(a, b));
    if (!start) return { edges: [], faces: [], closed: false };
    const startKey = EditMesh.edgeKey(a, b);
    const seen = new Set<number>();
    let asked = false;
    // Walk from the starting edge through `face`, quad by quad. In a quad the
    // opposite edge joins the two corners not on the current edge; the corner
    // next to cur[0] stays on cur[0]'s side, which keeps the ring oriented.
    const walk = (face: number | undefined, dir: string) => {
      const out: { e: [number, number]; f: number }[] = [];
      let cur: [number, number] = [a, b];
      let closed = false;
      while (face !== undefined && !seen.has(face) && this.faces[face].length === 4) {
        const ring = this.faces[face];
        const nextTo = (x: number, not: number) => { const k = ring.indexOf(x); const l = ring[(k + 1) % 4]; return l === not ? ring[(k + 3) % 4] : l; };
        seen.add(face);
        const opp: [number, number] = [nextTo(cur[0], cur[1]), nextTo(cur[1], cur[0])];
        const key = EditMesh.edgeKey(opp[0], opp[1]);
        if (trace && trace.detailed(1)) {
          const ask = !asked; asked = true;
          trace.step({
            phase: 'Walk the ring', label: `${dir}: quad ${face} [${ring.join(', ')}], in by [${cur[0]}, ${cur[1]}], out by [${opp[0]}, ${opp[1]}]`,
            detail: `The opposite edge joins the two corners not on the edge you came in by. ${opp[0]} is the corner next to ${cur[0]}, so it stays on ${cur[0]}'s side: that keeps the ring oriented, and the cut parallel.`,
            faces: [face], edges: [cur, opp],
            quiz: ask ? { prompt: `You enter quad ${face} = [${ring.join(', ')}] across edge [${cur[0]}, ${cur[1]}]. Which edge do you leave by? Give first the corner beside ${cur[0]}, then the one beside ${cur[1]}.`, answer: opp, labels: [`beside ${cur[0]}`, `beside ${cur[1]}`], rule: 'In a quad, the opposite edge is the one sharing no corner with the edge you came in by; each of its corners is the neighbour of one of yours.', tolerance: 0 } : undefined,
          });
        }
        if (key === startKey) { out.push({ e: opp, f: face }); closed = true; break; }
        out.push({ e: opp, f: face });
        const others = map.get(key)!.faces.filter((f) => f !== face);
        face = others.length === 1 ? others[0] : undefined;
        cur = opp;
      }
      if (trace && !closed) {
        const why = face === undefined ? `edge [${cur[0]}, ${cur[1]}] is on the mesh's open edge: no face beyond it`
          : seen.has(face) ? `face ${face} was already crossed`
          : `face ${face} has ${this.faces[face].length} corners, not 4: it has no single opposite edge`;
        trace.step({ phase: 'Walk the ring', label: `${dir}: stop, ${why}`, detail: 'A ring runs through quads only. It stops at a triangle, an n-gon or the open edge of the mesh.', edges: [cur], faces: face !== undefined ? [face] : [] });
      }
      return { out, closed };
    };
    // More than two faces on the start edge: follow only the first.
    const fwd = walk(start.faces[0], 'Forward');
    if (fwd.closed) {
      trace?.step({ phase: 'Walk the ring', label: `Back at [${a}, ${b}]: a closed ring of ${fwd.out.length} quads`, detail: 'The walk returned to the edge it started from, so the ring goes all the way round.', edges: [[a, b]] });
      return { edges: [[a, b], ...fwd.out.slice(0, -1).map((o) => o.e)], faces: fwd.out.map((o) => o.f), closed: true };
    }
    const back = start.faces.length === 2 ? walk(start.faces[1], 'Back') : { out: [], closed: false };
    return {
      edges: [...back.out.map((o) => o.e).reverse(), [a, b], ...fwd.out.map((o) => o.e)],
      faces: [...back.out.map((o) => o.f).reverse(), ...fwd.out.map((o) => o.f)],
      closed: false,
    };
  }

  /**
   * Loop cut: split every quad of the edge ring through (a, b) in two, with a
   * new vertex part-way along each ring edge. Faces at an open end of the ring
   * that are not split get the new vertex added to their outline, so the mesh
   * stays connected.
   */
  loopCut(a: number, b: number, t = 0.5, trace?: Trace): this {
    const ring = this.edgeRing(a, b, trace);
    if (!ring.faces.length) return this;
    trace?.step({
      phase: 'Find the ring', label: `${ring.faces.length} quads, ${ring.closed ? 'closed loop' : 'open strip'}`,
      detail: 'From the chosen edge, cross each quad to its opposite edge and continue into the next quad, until the ring closes or reaches a face that is not a quad.',
      faces: ring.faces, edges: ring.edges,
    });
    const mid = new Map<string, number>();
    for (const [p, q] of ring.edges) {
      const P = this.verts[p], Q = this.verts[q];
      this.verts.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t, P[2] + (Q[2] - P[2]) * t]);
      mid.set(`${p}>${q}`, this.verts.length - 1);
      mid.set(`${q}>${p}`, this.verts.length - 1);
    }
    trace?.step({
      phase: 'New vertices', label: `${ring.edges.length} vertices at t = ${fmt(t)} along each ring edge`,
      detail: 'p + t·(q − p), with p on the same side of the ring every time so the cut runs parallel.',
      quiz: (() => { const [p, q] = ring.edges[0]; return { prompt: `Ring edge [${p}, ${q}] runs from ${fmtV(this.verts[p])} to ${fmtV(this.verts[q])}. Where is its new vertex at t = ${fmt(t)}?`, answer: this.verts[mid.get(`${p}>${q}`)!], labels: ['x', 'y', 'z'], rule: 'p + t·(q − p): the fraction t of the way from the ring edge\'s first corner to its second.' }; })(),
      points: ring.edges.slice(0, 80).map(([p, q]) => ({ p: this.verts[mid.get(`${p}>${q}`)!], color: '#f59e0b' })),
    }, this);
    const ringFaces = new Set(ring.faces);
    const midOf = (x: number, y: number) => mid.get(`${x}>${y}`);
    const out: number[][] = [];
    this.faces.forEach((f, fi) => {
      if (ringFaces.has(fi)) {
        // Rotate so the ring edges are f[0]-f[1] and f[2]-f[3].
        let k = 0;
        while (k < 4 && midOf(f[k], f[(k + 1) % 4]) === undefined) k++;
        const [p, q, r, s] = [0, 1, 2, 3].map((i) => f[(k + i) % 4]);
        const m1 = midOf(p, q)!, m2 = midOf(r, s)!;
        out.push([p, m1, m2, s], [m1, q, r, m2]);
      } else {
        const rebuilt: number[] = [];
        f.forEach((v, i) => { rebuilt.push(v); const m = midOf(v, f[(i + 1) % f.length]); if (m !== undefined) rebuilt.push(m); });
        out.push(rebuilt);
      }
    });
    this.faces = out;
    this.touch();
    trace?.step({ phase: 'Split quads', label: `${ring.faces.length} quads became ${ring.faces.length * 2}`, detail: 'Each quad [p, q, r, s] becomes [p, m₁, m₂, s] and [m₁, q, r, m₂]: same winding, so both still face outward.' }, this);
    return this;
  }

  /** Move vertices by an offset. */
  translateVerts(vertIdxs: number[], d: Vec3): this {
    for (const v of new Set(vertIdxs)) this.verts[v] = add3(this.verts[v], d);
    return this.touch();
  }

  /**
   * Split every given face into one quad per corner, around a new centre.
   *
   * Edge midpoints are shared between the two faces either side, which is what
   * stops subdivision tearing the mesh open along the seams. Getting that
   * sharing right is only possible because the edge table says who the
   * neighbours are.
   */
  subdivideFaces(faceIdxs?: number[]): this {
    const target = new Set(faceIdxs ?? this.faces.map((_, i) => i));
    const midOf = new Map<string, number>();
    const mid = (a: number, b: number): number => {
      const key = EditMesh.edgeKey(a, b);
      const hit = midOf.get(key);
      if (hit !== undefined) return hit;
      const p = this.verts[a];
      const q = this.verts[b];
      const idx = this.verts.length;
      this.verts.push([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2]);
      midOf.set(key, idx);
      return idx;
    };

    // Split the selected faces first, which is what creates the midpoints.
    const out: number[][] = [];
    const untouched: number[] = [];
    this.faces.forEach((ring, fi) => {
      if (!target.has(fi)) {
        untouched.push(out.length);
        out.push(ring);
        return;
      }
      const centre = this.verts.length;
      this.verts.push(this.faceCenter(fi));
      for (let i = 0; i < ring.length; i++) {
        const prev = ring[(i - 1 + ring.length) % ring.length];
        const cur = ring[i];
        const next = ring[(i + 1) % ring.length];
        out.push([mid(prev, cur), cur, mid(cur, next), centre]);
      }
    });

    // Then repair the T-junctions.
    //
    // A face next to a subdivided one now borders TWO half-edges where it still
    // has one long edge. Its corners have not moved and it still looks right,
    // but the two sides no longer share an edge, so the mesh has come apart
    // along that seam - 12 boundary edges on a cube with one face split.
    //
    // The fix is the one Blender makes: insert the midpoint into the
    // neighbour's ring. A quad becomes a pentagon, which is exactly why faces
    // here are n-gons and not triangles - there would be nowhere to put it
    // otherwise.
    if (midOf.size) {
      for (const fi of untouched) {
        const ring = out[fi];
        const rebuilt: number[] = [];
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i];
          const b = ring[(i + 1) % ring.length];
          rebuilt.push(a);
          const m = midOf.get(EditMesh.edgeKey(a, b));
          if (m !== undefined) rebuilt.push(m);
        }
        out[fi] = rebuilt;
      }
    }

    this.faces = out;
    return this.touch();
  }

  // ── handing over to the renderer ────────────────────────────────────────

  /**
   * Triangulate for display: a fan for convex faces, ear clipping for concave
   * ones (core/triangulate.ts), so an L-shaped n-gon from a dissolve draws
   * without covering its notch.
   *
   * `faceIndex` maps each output triangle back to the face it came from, so a
   * click on a triangle can select the quad the user actually sees.
   */
  triangulate(): { positions: Float32Array; indices: Uint32Array; faceIndex: Uint32Array } {
    const indices: number[] = [];
    const faceIndex: number[] = [];
    this.faces.forEach((f, fi) => {
      for (const [a, b, c] of faceTriangles(this.verts, f)) {
        indices.push(f[a], f[b], f[c]);
        faceIndex.push(fi);
      }
    });
    const positions = new Float32Array(this.verts.length * 3);
    this.verts.forEach((v, i) => {
      positions[i * 3] = v[0];
      positions[i * 3 + 1] = v[1];
      positions[i * 3 + 2] = v[2];
    });
    return {
      positions,
      indices: new Uint32Array(indices),
      faceIndex: new Uint32Array(faceIndex),
    };
  }

  /**
   * Anything structurally impossible, as a list of complaints.
   *
   * Non-manifold edges and boundary edges are NOT listed: both are legal and
   * both occur in real files. This reports only what cannot be rendered or
   * operated on at all.
   */
  validate(): string[] {
    const bad: string[] = [];
    this.faces.forEach((f, i) => {
      if (f.length < 3) bad.push(`face ${i} has ${f.length} corners`);
      if (f.some((v) => !Number.isInteger(v) || v < 0 || v >= this.verts.length)) {
        bad.push(`face ${i} refers to a vertex that does not exist: [${f.join(',')}]`);
      }
      if (new Set(f).size !== f.length) bad.push(`face ${i} uses the same vertex twice: [${f.join(',')}]`);
    });
    this.verts.forEach((v, i) => {
      if (v.length !== 3 || v.some((c) => !Number.isFinite(c))) {
        bad.push(`vertex ${i} is not a finite point: [${v.join(',')}]`);
      }
    });
    return bad;
  }
}
