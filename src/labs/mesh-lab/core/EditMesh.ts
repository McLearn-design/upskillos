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
   * measurements that nearly agree. A tolerance above zero snaps to a grid of
   * that size, and is worth reaching for only when something has actually been
   * through a format that re-rounded the coordinates.
   */
  weld(tol = 0): this {
    const lookup = new Map<string, number>();
    const remap = new Array<number>(this.verts.length);
    const kept: Vec3[] = [];
    this.verts.forEach((v, i) => {
      const key = tol === 0
        ? `${v[0]},${v[1]},${v[2]}`
        : `${Math.round(v[0] / tol)},${Math.round(v[1] / tol)},${Math.round(v[2] / tol)}`;
      const hit = lookup.get(key);
      if (hit === undefined) {
        lookup.set(key, kept.length);
        remap[i] = kept.length;
        kept.push(v);
      } else {
        remap[i] = hit;
      }
    });
    this.verts = kept;
    this.faces = this.faces
      .map((f) => {
        // Collapse runs of the same index, which a merge can create.
        const ring = f.map((v) => remap[v]).filter((v, i, arr) => v !== arr[(i + 1) % arr.length]);
        return ring;
      })
      // A ring that has fallen below three corners is no longer a face.
      .filter((f) => f.length >= 3);
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

  /** Reverse the winding of the given faces, or all of them. */
  flip(faceIdxs?: number[]): this {
    const target = faceIdxs ?? this.faces.map((_, i) => i);
    for (const fi of target) this.faces[fi] = this.faces[fi].slice().reverse();
    return this.touch();
  }

  /**
   * Extrude a region of faces along the region's average normal.
   *
   * This is the operation that justifies the whole data structure. It has to
   * know which edges are on the BORDER of the selection - used by exactly one
   * selected face - because those are the ones that get a wall, and the
   * interior ones must not. Without connectivity there is no way to ask.
   */
  extrudeFaces(faceIdxs: number[], distance: number): this {
    if (!faceIdxs.length) return this;
    const region = new Set(faceIdxs);

    // Area-weighted average normal, so a big face in the selection counts for
    // more than a sliver.
    let n: Vec3 = [0, 0, 0];
    for (const fi of region) {
      const fn = this.faceNormal(fi);
      const a = this.faceArea(fi);
      n = [n[0] + fn[0] * a, n[1] + fn[1] * a, n[2] + fn[2] * a];
    }
    n = norm(n);

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

    // How many selected faces use each edge. One means it is on the border.
    const useCount = new Map<string, number>();
    for (const ring of originals.values()) {
      for (let i = 0; i < ring.length; i++) {
        const key = EditMesh.edgeKey(ring[i], ring[(i + 1) % ring.length]);
        useCount.set(key, (useCount.get(key) ?? 0) + 1);
      }
    }

    // The region's faces lift to the offset copies, keeping their ring order so
    // they keep facing the same way.
    for (const [fi, ring] of originals) {
      this.faces[fi] = ring.map((v) => moved.get(v)!);
    }

    // A wall per border edge. Taking the edge in the direction its own face
    // walks it, then going up, keeps the wall's winding agreeing with the cap.
    for (const ring of originals.values()) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        if (useCount.get(EditMesh.edgeKey(a, b)) !== 1) continue;
        this.faces.push([a, b, moved.get(b)!, moved.get(a)!]);
      }
    }

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
   * Fan-triangulate for display. Correct for convex rings, which covers
   * everything this creates; a concave n-gon needs ear clipping and is a
   * separate job.
   *
   * `faceIndex` maps each output triangle back to the face it came from, so a
   * click on a triangle can select the quad the user actually sees.
   */
  triangulate(): { positions: Float32Array; indices: Uint32Array; faceIndex: Uint32Array } {
    const indices: number[] = [];
    const faceIndex: number[] = [];
    this.faces.forEach((f, fi) => {
      for (let i = 1; i + 1 < f.length; i++) {
        indices.push(f[0], f[i], f[i + 1]);
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
