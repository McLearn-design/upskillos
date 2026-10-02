// Picking vertices and edges in screen space (edit mode, vertex and edge select). A ray almost never hits a point
// or a line exactly, so instead each vertex is projected to the screen and the nearest one within a radius of
// the pointer is picked; for edges, the distance from the pointer to each projected segment. The viewport and
// Mesh › Trace screen picking use these same functions.

import type { Trace } from './trace';

/** A projected point: pixels across and down, and its depth (NDC z, smaller is nearer). */
export interface ScreenPoint { x: number; y: number; z: number }

/** The closest point of segment a–b to (px, py): how far along it (t, clamped to 0–1) and how far away (pixels). */
export function pointSegment(px: number, py: number, a: ScreenPoint, b: ScreenPoint): { t: number; d: number } {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
  return { t, d: Math.hypot(a.x + t * dx - px, a.y + t * dy - py) };
}

/** The nearest point within radius pixels (null entries are behind the camera); within 1 px of a tie, the nearer in depth wins. */
export function nearestPoint(points: (ScreenPoint | null)[], px: number, py: number, radius = 12): { index: number; d: number } | null {
  let best: number | null = null, bd = radius, bz = Infinity;
  points.forEach((s, i) => {
    if (!s) return;
    const d = Math.hypot(s.x - px, s.y - py);
    if (d < bd - 1 || (Math.abs(d - bd) <= 1 && s.z < bz)) { bd = d; bz = s.z; best = i; }
  });
  return best === null ? null : { index: best, d: bd };
}

/** The nearest segment within radius pixels. */
export function nearestSegment(segments: { key: string; a: ScreenPoint | null; b: ScreenPoint | null }[], px: number, py: number, radius = 10): { key: string; d: number; t: number } | null {
  let best: { key: string; d: number; t: number } | null = null;
  for (const s of segments) {
    if (!s.a || !s.b) continue;
    const { t, d } = pointSegment(px, py, s.a, s.b);
    if (d < (best?.d ?? radius)) best = { key: s.key, d, t };
  }
  return best;
}

/** Trace a screen pick: every vertex (or edge) on screen, its distance from the pointer, and the one picked. */
export function traceScreenPick(kind: 'vert' | 'edge', points: (ScreenPoint | null)[], edges: [number, number][], px: number, py: number, trace?: Trace): { index: number | null; key: string | null; d: number | null; t: number | null } {
  const r = (x: number) => +x.toFixed(2);
  const radius = kind === 'vert' ? 12 : 10;
  trace?.step({ phase: 'Project', label: `${points.filter(Boolean).length} of ${points.length} vertices projected to the screen; the pointer is at (${r(px)}, ${r(py)})`, detail: 'Each vertex goes through the view and projection matrices to a pixel (lesson 3.2). Vertices behind the camera are skipped.', values: [['pointer', `(${r(px)}, ${r(py)})`], ['radius', `${radius} px`]] });
  if (kind === 'vert') {
    const ranked = points.map((s, i) => (s ? { i, d: Math.hypot(s.x - px, s.y - py), z: s.z } : null)).filter(Boolean).sort((a, b) => a!.d - b!.d).slice(0, 4) as { i: number; d: number; z: number }[];
    trace?.step({
      phase: 'Distances', label: `Nearest on screen: ${ranked.map((x) => `v${x.i} ${r(x.d)} px`).join(', ')}`,
      detail: 'Distance on the screen, in pixels: the size of the gap the pointer has to cross, which is what a person aims by.',
      values: ranked.map((x) => [`v${x.i}`, `${r(x.d)} px, depth ${x.z.toFixed(4)}`] as [string, string]),
      quiz: ranked.length ? { prompt: `Vertex ${ranked[0].i} is drawn at (${r(points[ranked[0].i]!.x)}, ${r(points[ranked[0].i]!.y)}) and the pointer is at (${r(px)}, ${r(py)}). How many pixels apart are they?`, answer: [ranked[0].d], labels: ['pixels'], rule: 'The straight-line distance on the screen: √(Δx² + Δy²).', tolerance: 0.1 } : undefined,
    });
    const hit = nearestPoint(points, px, py, radius);
    trace?.step({ phase: 'Pick', label: hit ? `Picked v${hit.index}, ${r(hit.d)} px away (within ${radius} px)` : `Nothing within ${radius} px: nothing picked`, detail: 'The nearest within the radius wins; if two are within a pixel of each other, the one nearer the camera wins. MeshLab does not test whether the vertex is hidden behind a face.', values: [] });
    return { index: hit?.index ?? null, key: null, d: hit?.d ?? null, t: null };
  }
  const segs = edges.map(([a, b]) => ({ key: `${Math.min(a, b)}-${Math.max(a, b)}`, a: points[a], b: points[b] }));
  const ranked = segs.filter((s) => s.a && s.b).map((s) => ({ key: s.key, ...pointSegment(px, py, s.a!, s.b!) })).sort((a, b) => a.d - b.d).slice(0, 4);
  trace?.step({
    phase: 'Distances', label: `Nearest edges on screen: ${ranked.map((x) => `${x.key} ${r(x.d)} px`).join(', ')}`,
    detail: 'For each edge, the closest point of its segment on screen: project the pointer onto the line through the two ends, clamp to the segment (t from 0 to 1), and measure.',
    values: ranked.map((x) => [x.key, `${r(x.d)} px at t = ${r(x.t)}`] as [string, string]),
    quiz: ranked.length ? { prompt: `Edge ${ranked[0].key}: how far along it (t, 0 at its first vertex, 1 at its second) is the point closest to the pointer?`, answer: [ranked[0].t], labels: ['t'], rule: 't = ((p − a) · (b − a)) / |b − a|², clamped to 0..1.', tolerance: 0.02 } : undefined,
  });
  const hit = nearestSegment(segs, px, py, radius);
  trace?.step({ phase: 'Pick', label: hit ? `Picked edge ${hit.key}, ${r(hit.d)} px away` : `Nothing within ${radius} px: nothing picked`, detail: 'The nearest segment within the radius wins.', values: [] });
  return { index: null, key: hit?.key ?? null, d: hit?.d ?? null, t: hit?.t ?? null };
}
