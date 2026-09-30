// Primitive meshes, built as quads and n-gons (not triangles) with every face
// wound counter-clockwise seen from outside, in a Y-up world like three.js.
//
// The recipe for each is plain parametric geometry: a point on a cylinder is
// (r cos θ, y, r sin θ), on a sphere (r sin φ cos θ, r cos φ, r sin φ sin θ), on
// a torus the tube circle carried round the main circle.

import { EditMesh, type Vec3 } from './EditMesh';

export type PrimitiveType = 'cube' | 'plane' | 'grid' | 'circle' | 'cylinder' | 'cone' | 'uvSphere' | 'torus';
export interface PrimitiveParams {
  size?: number; radius?: number; height?: number; segments?: number; rings?: number;
  subdivisions?: number; tube?: number; tubeSegments?: number;
}

export const PRIMITIVE_DEFAULTS: Record<PrimitiveType, PrimitiveParams> = {
  cube: { size: 2 },
  plane: { size: 2 },
  grid: { size: 2, subdivisions: 10 },
  circle: { radius: 1, segments: 32 },
  cylinder: { radius: 1, height: 2, segments: 32 },
  cone: { radius: 1, height: 2, segments: 32 },
  uvSphere: { radius: 1, segments: 32, rings: 16 },
  torus: { radius: 1, tube: 0.25, segments: 48, tubeSegments: 12 },
};

const ring = (r: number, y: number, n: number): Vec3[] =>
  Array.from({ length: n }, (_, k) => [r * Math.cos((2 * Math.PI * k) / n), y, r * Math.sin((2 * Math.PI * k) / n)] as Vec3);

/** Side quads between a lower ring (b) and an upper ring (t), wound to face outward. */
const bands = (b: number, t: number, n: number): number[][] =>
  Array.from({ length: n }, (_, k) => [b + ((k + 1) % n), b + k, t + k, t + ((k + 1) % n)]);

export function makePrimitive(type: PrimitiveType, params: PrimitiveParams = {}): EditMesh {
  const p = { ...PRIMITIVE_DEFAULTS[type], ...params };
  switch (type) {
    case 'cube': {
      const h = p.size! / 2;
      const v: Vec3[] = [[-h, -h, -h], [h, -h, -h], [h, h, -h], [-h, h, -h], [-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]];
      return new EditMesh(v, [[0, 3, 2, 1], [4, 5, 6, 7], [0, 4, 7, 3], [1, 2, 6, 5], [0, 1, 5, 4], [3, 7, 6, 2]]);
    }
    case 'plane': return makePrimitive('grid', { size: p.size, subdivisions: 1 });
    case 'grid': {
      const n = Math.max(1, Math.round(p.subdivisions!)), s = p.size!;
      const verts: Vec3[] = [];
      for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) verts.push([-s / 2 + (s * i) / n, 0, -s / 2 + (s * j) / n]);
      const id = (i: number, j: number) => j * (n + 1) + i;
      const faces: number[][] = [];
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) faces.push([id(i, j + 1), id(i + 1, j + 1), id(i + 1, j), id(i, j)]);
      return new EditMesh(verts, faces);
    }
    case 'circle': {
      const n = Math.max(3, Math.round(p.segments!));
      return new EditMesh(ring(p.radius!, 0, n), [Array.from({ length: n }, (_, k) => n - 1 - k)]);
    }
    case 'cylinder': {
      const n = Math.max(3, Math.round(p.segments!)), h = p.height! / 2;
      const verts = [...ring(p.radius!, -h, n), ...ring(p.radius!, h, n)];
      const bottom = Array.from({ length: n }, (_, k) => k);
      const top = Array.from({ length: n }, (_, k) => 2 * n - 1 - k);
      return new EditMesh(verts, [bottom, top, ...bands(0, n, n)]);
    }
    case 'cone': {
      const n = Math.max(3, Math.round(p.segments!)), h = p.height! / 2;
      const verts: Vec3[] = [...ring(p.radius!, -h, n), [0, h, 0]];
      const faces = [Array.from({ length: n }, (_, k) => k), ...Array.from({ length: n }, (_, k) => [(k + 1) % n, k, n])];
      return new EditMesh(verts, faces);
    }
    case 'uvSphere': {
      const n = Math.max(3, Math.round(p.segments!)), rings = Math.max(2, Math.round(p.rings!)), r = p.radius!;
      const verts: Vec3[] = [[0, r, 0]];
      for (let i = 1; i < rings; i++) { const phi = (Math.PI * i) / rings; verts.push(...ring(r * Math.sin(phi), r * Math.cos(phi), n)); }
      verts.push([0, -r, 0]);
      const south = verts.length - 1, row = (i: number) => 1 + (i - 1) * n;
      const faces: number[][] = [];
      for (let k = 0; k < n; k++) faces.push([row(1) + ((k + 1) % n), row(1) + k, 0]);
      for (let i = 1; i < rings - 1; i++) faces.push(...bands(row(i + 1), row(i), n));
      for (let k = 0; k < n; k++) faces.push([south, row(rings - 1) + k, row(rings - 1) + ((k + 1) % n)]);
      return new EditMesh(verts, faces);
    }
    case 'torus': {
      const n = Math.max(3, Math.round(p.segments!)), m = Math.max(3, Math.round(p.tubeSegments!)), R = p.radius!, r = p.tube!;
      const verts: Vec3[] = [];
      for (let i = 0; i < n; i++) {
        const th = (2 * Math.PI * i) / n, c = Math.cos(th), s = Math.sin(th);
        for (let j = 0; j < m; j++) { const ph = (2 * Math.PI * j) / m; const d = R + r * Math.cos(ph); verts.push([d * c, r * Math.sin(ph), d * s]); }
      }
      const id = (i: number, j: number) => (i % n) * m + (j % m);
      const faces: number[][] = [];
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) faces.push([id(i, j), id(i, j + 1), id(i + 1, j + 1), id(i + 1, j)]);
      return new EditMesh(verts, faces);
    }
  }
}
