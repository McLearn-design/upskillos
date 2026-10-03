// Per-vertex fields: a number at every vertex, shown as a heat map.
//
// A field is computed on the mesh the viewport draws (modifiers applied). Mirror
// and subdivision both keep the original vertices first, so a source vertex
// chosen on the cage has the same number on the evaluated mesh.

import type { EditMesh, Vec3 } from './EditMesh';
import { gaussianCurvature, heatGeodesic, meanCurvature } from './geometry';
import { fmt, type Trace } from './trace';

export type FieldSpec =
  | { kind: 'geodesic'; sources: number[] }
  | { kind: 'mean' }
  | { kind: 'gaussian' }
  | { kind: 'coord'; axis: 0 | 1 | 2 }
  | { kind: 'custom'; values: number[]; label?: string }
  /** A bone's skin weights; the editor fills in the values from the mesh's skin. */
  | { kind: 'weight'; bone: string; values?: number[] }
  /** How much the UV map distorts angles around each vertex (σ₁/σ₂; the editor fills in the values). */
  | { kind: 'uv'; values?: number[] };

export type FieldKind = FieldSpec['kind'];

export interface FieldResult {
  values: Float64Array;
  label: string;
  /** Explains what the colours mean, in a sentence. */
  meaning: string;
  /** Colour around zero (blue below, red above) instead of low → high. */
  diverging: boolean;
  /** The range the colours span; values outside are clamped. */
  range: [number, number];
  /** Number of iso-lines to draw. */
  contours: number;
}

export const FIELD_NAMES: Record<FieldKind, string> = {
  geodesic: 'Distance along the surface',
  mean: 'Mean curvature H',
  gaussian: 'Gaussian curvature K',
  coord: 'Coordinate',
  custom: 'Script values',
  weight: 'Bone weights',
  uv: 'UV angle distortion',
};

function percentile(values: ArrayLike<number>, p: number): number {
  const s = Float64Array.from(values).filter(Number.isFinite).sort();
  if (!s.length) return 0;
  return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
}

/**
 * The colour range. Curvature concentrates at corners (a cube's is all at its
 * eight corners), so a plain min–max would make everything else one colour; the
 * 2nd–98th percentile shows the rest of the surface.
 */
export function fieldRange(values: ArrayLike<number>, diverging: boolean, robust: boolean): [number, number] {
  if (diverging) {
    const abs = Array.from(values, Math.abs);
    const m = robust ? percentile(abs, 0.98) : Math.max(0, ...abs);
    return m > 1e-12 ? [-m, m] : [-1, 1];
  }
  const lo = robust ? percentile(values, 0.02) : Math.min(...Array.from(values));
  const hi = robust ? percentile(values, 0.98) : Math.max(...Array.from(values));
  return hi - lo > 1e-12 ? [lo, hi] : [lo - 0.5, lo + 0.5];
}

export function computeField(mesh: EditMesh, spec: FieldSpec, trace?: Trace): FieldResult {
  const n = mesh.verts.length;
  switch (spec.kind) {
    case 'geodesic': {
      const sources = spec.sources.filter((s) => s >= 0 && s < n);
      const values = heatGeodesic(mesh, sources, trace);
      return {
        values, label: `${FIELD_NAMES.geodesic} from ${sources.length} vertex${sources.length === 1 ? '' : 'es'}`,
        meaning: 'How far you would walk on the surface from the source, not through the air. Lines are equal distance.',
        diverging: false, range: fieldRange(values, false, false), contours: 14,
      };
    }
    case 'mean': {
      const values = meanCurvature(mesh, trace);
      return {
        values, label: FIELD_NAMES.mean, diverging: true, range: fieldRange(values, true, true), contours: 0,
        meaning: 'How much the surface bends, averaged over directions. Red bulges out, blue dents in, white is flat or saddle-balanced. A sphere of radius r has H = 1/r.',
      };
    }
    case 'gaussian': {
      const values = gaussianCurvature(mesh, {}, trace);
      return {
        values, label: FIELD_NAMES.gaussian, diverging: true, range: fieldRange(values, true, true), contours: 0,
        meaning: 'The product of the two principal curvatures. Red is dome-like (both bend the same way), blue is saddle-like, white bends in at most one direction (a cylinder, a plane).',
      };
    }
    case 'coord': {
      const values = Float64Array.from(mesh.verts, (v: Vec3) => v[spec.axis]);
      const name = 'xyz'[spec.axis];
      return {
        values, label: `${name} coordinate`, diverging: false, range: fieldRange(values, false, false), contours: 10,
        meaning: `The vertex's ${name} position in the object's own space. Lines are level sets: slices at equal ${name}.`,
      };
    }
    case 'weight': {
      const values = Float64Array.from({ length: n }, (_, i) => Number(spec.values?.[i] ?? 0));
      return {
        values, label: `Weights of bone "${spec.bone}"`, diverging: false, range: [0, 1], contours: 0,
        meaning: 'How much this bone moves each vertex: red 1 (entirely), blue 0 (not at all). At every vertex the weights of all bones add up to 1, so where this one fades another takes over.',
      };
    }
    case 'uv': {
      const values = Float64Array.from({ length: n }, (_, i) => Number(spec.values?.[i] ?? 1));
      return {
        values, label: FIELD_NAMES.uv, diverging: false, range: [1, Math.max(1.5, fieldRange(values, false, true)[1])], contours: 0,
        meaning: 'σ₁/σ₂ of the map from surface to texture around each vertex: 1 (blue) keeps angles, so a checker square stays square; red squashes them. Where the surface is curved no flat map can keep everything.',
      };
    }
    case 'custom': {
      const values = Float64Array.from({ length: n }, (_, i) => Number(spec.values[i] ?? 0));
      return {
        values, label: spec.label ?? FIELD_NAMES.custom, diverging: false, range: fieldRange(values, false, false), contours: 0,
        meaning: 'Values set by a script, one per vertex.',
      };
    }
  }
}

// ── colour maps ───────────────────────────────────────────────────────────

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Turbo (Mikhailov 2019), as its published polynomial fit: blue → green → yellow → red. */
export function turbo(t: number): [number, number, number] {
  t = clamp01(t);
  const r = 0.13572138 + t * (4.6153926 + t * (-42.66032258 + t * (132.13108234 + t * (-152.94239396 + t * 59.28637943))));
  const g = 0.09140261 + t * (2.19418839 + t * (4.84296658 + t * (-14.18503333 + t * (4.27729857 + t * 2.82956604))));
  const b = 0.1066733 + t * (12.64194608 + t * (-60.58204836 + t * (110.36276771 + t * (-89.90310912 + t * 27.34824973))));
  return [clamp01(r), clamp01(g), clamp01(b)];
}

/** Blue → near-white → red, for signed values centred on zero. */
export function coolwarm(t: number): [number, number, number] {
  t = clamp01(t);
  const lo: [number, number, number] = [0.23, 0.3, 0.75], mid: [number, number, number] = [0.87, 0.87, 0.87], hi: [number, number, number] = [0.71, 0.02, 0.15];
  const [a, b, u] = t < 0.5 ? [lo, mid, t * 2] : [mid, hi, (t - 0.5) * 2];
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}

export function colorFor(v: number, range: [number, number], diverging: boolean): [number, number, number] {
  const t = (v - range[0]) / (range[1] - range[0] || 1);
  return diverging ? coolwarm(t) : turbo(t);
}

/** Per-vertex RGB, 0–1, ready for a three.js colour attribute. */
export function vertexColors(values: ArrayLike<number>, range: [number, number], diverging: boolean, log = false): Float32Array {
  const out = new Float32Array(values.length * 3);
  let r = range;
  let f = (v: number) => v;
  if (log) {
    // For values spanning many decades (heat after a short time): colour by log10.
    const pos = Array.from(values).filter((v) => v > 0);
    const hi = Math.max(...pos), lo = Math.max(Math.min(...pos), hi * 1e-12);
    f = (v: number) => Math.log10(Math.max(v, lo));
    r = [Math.log10(lo), Math.log10(hi)];
  }
  for (let i = 0; i < values.length; i++) {
    const c = colorFor(f(values[i]), r, diverging);
    out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
  }
  return out;
}

/** A CSS gradient for a legend. */
export function legendGradient(diverging: boolean): string {
  const stops = Array.from({ length: 9 }, (_, i) => {
    const [r, g, b] = diverging ? coolwarm(i / 8) : turbo(i / 8);
    return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)}) ${(i / 8) * 100}%`;
  });
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

/**
 * Trace how a field becomes colours (Heat map › Trace the colour mapping): the range, one vertex's value turned into
 * t ∈ [0, 1] and then into a colour, and what the GPU does between vertices: it blends the corners' colours, which is
 * not the colour of the blended value, because the colour map is not a straight line through colour space.
 */
export function traceColourMap(mesh: EditMesh, result: FieldResult, trace: Trace): void {
  const { values, range, diverging } = result;
  const [lo, hi] = range;
  let mn = Infinity, mx = -Infinity;
  for (const v of values) { if (v < mn) mn = v; if (v > mx) mx = v; }
  const tOf = (v: number) => (v - lo) / (hi - lo || 1);
  // The vertex whose t is nearest 0.3: neither end of the scale.
  let pick = 0, best = Infinity;
  values.forEach((v, i) => { const d = Math.abs(tOf(v) - 0.3); if (d < best) { best = d; pick = i; } });
  const rgb = (c: [number, number, number]) => `(${c.map((x) => Math.round(x * 255)).join(', ')})`;
  trace.step({
    phase: 'Range', label: `Values from ${fmt(mn)} to ${fmt(mx)}; the colours span ${fmt(lo)} to ${fmt(hi)}`,
    detail: diverging
      ? 'A signed field is coloured round zero: blue below, near-white at 0, red above, with the same reach both ways.'
      : lo > mn + 1e-12 || hi < mx - 1e-12 ? 'The colours span the 2nd to 98th percentile, so a few extreme vertices do not squash everyone else into one colour; values outside are clamped.' : 'The colours span the lowest value to the highest.',
    values: [['lowest', fmt(mn)], ['highest', fmt(mx)], ['colour range', `${fmt(lo)} to ${fmt(hi)}`], ['map', diverging ? 'cool–warm' : 'turbo']],
  }, mesh.verts.length <= trace.snapshotLimit ? mesh : undefined);
  const t = Math.min(1, Math.max(0, tOf(values[pick])));
  trace.step({
    phase: 'Normalise', label: `v${pick}: value ${fmt(values[pick])} → t = ${fmt(t)}`,
    detail: 't = (value − low) / (high − low), clamped to 0 … 1: where the value sits along the colour range.',
    verts: [pick],
    quiz: { prompt: `v${pick} has the value ${fmt(values[pick], 4)}; the colours span ${fmt(lo, 4)} to ${fmt(hi, 4)}. What is t?`, answer: [t], labels: ['t'], rule: 't = (value − low) / (high − low), clamped to 0 … 1.', tolerance: 0.01 },
  });
  const c = colorFor(values[pick], range, diverging);
  trace.step({
    phase: 'Colour', label: `t = ${fmt(t)} → RGB ${rgb(c)}`,
    detail: diverging ? 'Cool–warm blends blue → near-white → red in two straight pieces.' : 'Turbo is a fitted curve through colour space, blue → cyan → green → yellow → red, chosen so equal steps in t look like roughly equal steps in colour.',
    values: [['t', fmt(t)], ['red', String(Math.round(c[0] * 255))], ['green', String(Math.round(c[1] * 255))], ['blue', String(Math.round(c[2] * 255))]],
  });
  const face = mesh.faces.find((f) => f.includes(pick)) ?? mesh.faces[0];
  if (face && face.length >= 3) {
    const tri = face.slice(0, 3), avgV = (values[tri[0]] + values[tri[1]] + values[tri[2]]) / 3;
    const cols = tri.map((v) => colorFor(values[v], range, diverging));
    const blended = [0, 1, 2].map((k) => (cols[0][k] + cols[1][k] + cols[2][k]) / 3) as [number, number, number];
    const exact = colorFor(avgV, range, diverging);
    const diff = Math.round(255 * Math.max(...[0, 1, 2].map((k) => Math.abs(blended[k] - exact[k]))));
    trace.step({
      phase: 'Between vertices', label: `Centre of triangle [${tri.join(', ')}]: the GPU shows RGB ${rgb(blended)}; the centre's own value would be ${rgb(exact)} (${diff} apart)`,
      detail: 'Colours are given at vertices and the GPU blends them across each triangle (lesson 3.3). That is the average of three colours, not the colour of the average value: where the corners straddle a bend in the colour map, the middle can show a colour that is not on the map. More vertices make the difference smaller.',
      faces: [mesh.faces.indexOf(face)],
    });
  }
}
