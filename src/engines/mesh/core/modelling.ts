// More modelling operations: region inset, bevel and dissolve, as in Blender.
//
// Region inset (I): a whole selection is inset as one piece. Its outline gets an
//   inner copy, moved in along the surface by the thickness; faces inside the
//   selection keep their shape and only their outline vertices move. At a corner
//   the offset is mitred (divided by cos of half the turn) so both sides stay the
//   same distance from the old outline.
//
// Bevel (Ctrl+B): each bevelled edge is replaced by a strip. Around each end vertex v,
//   every face corner at v is replaced by points slid along its edges by the width:
//     both of the face's edges at v bevelled    one point  v + w·a + w·b (a, b unit along them)
//     one bevelled                             the point on the other edge, v + w·a
//     neither                                  the slid points on its edges (keeping v if an
//                                              edge was not slid)
//   A strip joins the two sides of each bevelled edge; with more segments it curves
//   (a quadratic Bézier with the old corner as control point). Where the new points
//   around v do not close up by themselves (three bevelled edges meeting, or a
//   vertex with more faces), a patch face fills the corner.
//
// Dissolve (Ctrl+X): remove edges and merge the faces on either side into one; remove
//   vertices and merge the faces around them; merge a region of faces into one.
//   The shape stays; only the division into faces changes.

import { EditMesh, type Vec3 } from './EditMesh';
import { Trace, fmt, fmtV } from './trace';

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec3): Vec3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const ekey = EditMesh.edgeKey;

// ── region inset ──────────────────────────────────────────────────────────

/**
 * Inset a region of faces as one piece by `thickness` (a distance, as Blender's).
 * Returns the indices of the bridge faces added around it.
 */
export function insetRegion(mesh: EditMesh, faceIdxs: number[], thickness: number, trace?: Trace): number[] {
  const region = new Set(faceIdxs);
  const V = mesh.verts;
  // Outline: directed edges a→b of region faces whose reverse is not in the region.
  const directed = new Map<string, { a: number; b: number; f: number }>();
  for (const f of region) mesh.faces[f].forEach((a, i) => { const b = mesh.faces[f][(i + 1) % mesh.faces[f].length]; directed.set(`${a}>${b}`, { a, b, f }); });
  const outline = [...directed.values()].filter((e) => !directed.has(`${e.b}>${e.a}`));
  if (!outline.length) return []; // a closed region has no outline to inset
  // Each outline vertex: the edge coming in and the edge going out.
  const into = new Map<number, typeof outline[number]>(), outOf = new Map<number, typeof outline[number]>();
  for (const e of outline) { outOf.set(e.a, e); into.set(e.b, e); }
  const inward = (e: typeof outline[number]) => unit(cross(mesh.faceNormal(e.f), sub(V[e.b], V[e.a])));
  trace?.step({
    phase: 'Outline', label: `${outline.length} outline edges; ${outOf.size} vertices move in by ${fmt(thickness)}`,
    detail: 'The outline is every edge of the selection with a face on one side only. Each outline vertex gets an inner copy, pushed along the average of its two edges\' inward directions and lengthened at corners so both edges stay the same distance away.',
    edges: outline.map((e) => [e.a, e.b]),
  }, mesh);
  const copy = new Map<number, number>();
  let asked = false;
  for (const [v, eo] of outOf) {
    const ei = into.get(v) ?? eo;
    const i1 = inward(ei), i2 = inward(eo);
    const dir = unit(add(i1, i2));
    const half = dot(dir, i1);                                // sin(φ/2), φ the corner's angle inside the region
    const scale = thickness / Math.max(0.2, half); // the mitre
    copy.set(v, V.length);
    V.push(add(V[v], mul(dir, scale)));
    if (trace && trace.detailed(outOf.size)) {
      // The interior angle: π minus the outline's turn at v, signed about the face normal.
      const n = mesh.faceNormal(eo.f), e1 = unit(sub(V[v], V[ei.a])), e2 = unit(sub(V[eo.b], V[v]));
      const phi = Math.PI - Math.atan2(dot(n, cross(e1, e2)), dot(e1, e2));
      const deg = Math.round(phi * 180 / Math.PI * 100) / 100;
      const bent = Math.abs(half - 1) > 1e-6;
      const ask = bent && !asked;
      if (ask) asked = true;
      trace.step({
        phase: 'Mitre', label: `v${v}: ${bent ? `a ${fmt(deg)}° corner` : 'straight (180°)'}, moves ${fmt(scale)}${half < 0.2 ? ' (capped)' : ''}`,
        detail: bent
          ? `The two edges' inward directions are averaged; to keep both edges ${fmt(thickness)} away, the corner moves t / sin(φ/2) = ${fmt(thickness)} / ${fmt(half)}${half < 0.2 ? ', capped at 5t so a sharp corner does not shoot off' : ''}.`
          : 'A straight run of the outline: both edges point the same way, so the vertex moves exactly t along their inward direction.',
        values: [['φ', `${fmt(deg)}°`], ['inward in', fmtV(i1)], ['inward out', fmtV(i2)], ['sin(φ/2)', fmt(half)], ['distance', fmt(scale)]],
        points: [{ p: V[v], label: `v${v}`, color: '#38bdf8' }, { p: V[V.length - 1], label: `v${v}′`, color: '#f59e0b' }],
        quiz: ask ? { prompt: `The outline has a ${fmt(deg)}° corner at v${v} = ${fmtV(V[v])}. Its edges' inward directions are ${fmtV(i1)} and ${fmtV(i2)}, and the thickness is t = ${fmt(thickness)}. Where does the corner's inner copy go?`, answer: V[V.length - 1], labels: ['x', 'y', 'z'], rule: 'v′ = v + (t / sin(φ/2)) · unit(i₁ + i₂): along the average inward direction, lengthened so both edges end up t away.' } : undefined,
      }, mesh);
    }
  }
  // Region faces use the inner copies on their outline; bridges join old outline to new.
  for (const f of region) mesh.faces[f] = mesh.faces[f].map((v) => copy.get(v) ?? v);
  const bridges: number[] = [];
  for (const e of outline) { bridges.push(mesh.faces.length); mesh.faces.push([e.a, e.b, copy.get(e.b)!, copy.get(e.a)!]); }
  mesh.touch();
  trace?.step({
    phase: 'Bridge', label: `${bridges.length} quads join the old outline to the inset one`,
    detail: 'Each outline edge a→b becomes the quad a, b, b′, a′: the frame around the inset region.',
    faces: bridges,
  }, mesh);
  return bridges;
}

// ── bevel ─────────────────────────────────────────────────────────────────

/** Faces around v in order, each with its corner index; `closed` if the fan goes all the way round. */
function fanAround(mesh: EditMesh, v: number): { faces: { f: number; i: number }[]; closed: boolean } | null {
  const corners: { f: number; i: number }[] = [];
  mesh.faces.forEach((f, fi) => f.forEach((x, i) => { if (x === v) corners.push({ f: fi, i }); }));
  if (!corners.length) return null;
  const next = (c: { f: number; i: number }) => mesh.faces[c.f][(c.i + 1) % mesh.faces[c.f].length];
  const prev = (c: { f: number; i: number }) => mesh.faces[c.f][(c.i - 1 + mesh.faces[c.f].length) % mesh.faces[c.f].length];
  // Crossing edge v→next(c) leads to the face that has next(c)→v, i.e. whose prev is next(c).
  const across = (c: { f: number; i: number }) => corners.find((d) => d !== c && prev(d) === next(c));
  let start = corners[0];
  // For an open fan, start at the face whose incoming edge has no neighbour.
  for (const c of corners) if (!corners.some((d) => d !== c && next(d) === prev(c))) { start = c; break; }
  const order = [start];
  for (let c = across(start); c && c !== start && order.length < corners.length; c = across(c)) order.push(c);
  if (order.length !== corners.length) return null; // not a simple fan (non-manifold): skip this vertex
  return { faces: order, closed: across(order[order.length - 1]) === start };
}

/**
 * Bevel edges by `width` (measured along the neighbouring edges) with `segments` strips
 * across each. Returns the new faces (strips and corner patches).
 */
export function bevelEdges(mesh: EditMesh, edges: [number, number][], width: number, segments = 1, trace?: Trace): number[] {
  const V = mesh.verts;
  const orig = mesh.edges(), origFaces = mesh.faces.map((f) => [...f]);
  const bev = new Set(edges.map(([a, b]) => ekey(a, b)).filter((k) => orig.get(k)?.faces.length === 2));
  if (!bev.size) return [];
  const ends = new Set<number>();
  for (const k of bev) for (const x of k.split('-').map(Number)) ends.add(x);
  // Clamp: the width may not reach past the middle of any edge at a bevelled vertex.
  let w = width;
  for (const e of orig.values()) if (ends.has(e.a) || ends.has(e.b)) w = Math.min(w, 0.49 * len(sub(V[e.a], V[e.b])));
  const nseg = Math.max(1, Math.round(segments));
  trace?.step({
    phase: 'Width', label: `${bev.size} edge${bev.size === 1 ? '' : 's'}, width ${fmt(w)}${w < width - 1e-12 ? ` (clamped from ${fmt(width)})` : ''}, ${nseg} segment${nseg === 1 ? '' : 's'}`,
    detail: w < width - 1e-12
      ? 'The width is measured along the edges at each bevelled vertex. It is clamped to just under half the shortest of those edges, so the bevels from its two ends cannot cross in the middle.'
      : 'The width is measured along the edges at each bevelled vertex. It is under half the shortest of those edges, so the bevels from an edge\'s two ends cannot meet.',
    edges: [...bev].map((k) => k.split('-').map(Number) as [number, number]),
    values: [['width', fmt(w)], ['asked for', fmt(width)], ['segments', String(nseg)]],
  }, mesh);
  let askedSlide = false, askedCurve = false;

  const slid = new Map<string, number>(); // `${v}>${other}` → the new vertex on edge v–other, w from v
  const slide = (v: number, o: number) => {
    const k = `${v}>${o}`;
    if (!slid.has(k)) {
      slid.set(k, V.length); V.push(add(V[v], mul(unit(sub(V[o], V[v])), w)));
      if (trace && !askedSlide) {
        askedSlide = true;
        trace.step({
          phase: 'Slide', label: `v${v} slides ${fmt(w)} along its edge to v${o}`,
          detail: 'A corner beside a bevelled edge is replaced by a point the width along the face\'s other edge: p = v + w · unit(o − v).',
          points: [{ p: V[v], label: `v${v}`, color: '#38bdf8' }, { p: V[V.length - 1], color: '#f59e0b' }], edges: [[v, o]],
          quiz: { prompt: `v${v} = ${fmtV(V[v])} slides the width w = ${fmt(w)} along its edge towards v${o} = ${fmtV(V[o])}. Where does the new point go?`, answer: V[V.length - 1], labels: ['x', 'y', 'z'], rule: 'v + w · (o − v) / |o − v|: the width along the edge, from v.' },
        });
      }
    }
    return slid.get(k)!;
  };
  const corner = new Map<string, number[]>();  // `${f}:${v}` → what replaces corner v of face f
  const side = new Map<string, number>();      // `${f}|${v}|${o}` → face f's point beside bevelled edge v–o, at v
  const profiles = new Map<string, number[]>(); // the curve's inner points from p to q around v
  const profile = (v: number, p: number, q: number): number[] => {
    if (nseg === 1 || p === q) return [];
    const k = `${v}|${p}|${q}`, rk = `${v}|${q}|${p}`;
    if (profiles.has(rk)) return [...profiles.get(rk)!].reverse();
    if (!profiles.has(k)) {
      const pts: number[] = [];
      for (let s = 1; s < nseg; s++) {
        const t = s / nseg, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t; // quadratic Bézier, control point v
        pts.push(V.length); V.push(add(add(mul(V[p], a), mul(V[v], b)), mul(V[q], c)));
        if (trace && !askedCurve) {
          askedCurve = true;
          trace.step({
            phase: 'Profile', label: `A curve from v${p} to v${q}, bent towards the old corner v${v}: ${nseg - 1} point${nseg === 2 ? '' : 's'} between`,
            detail: 'With more than one segment, the bevel follows a quadratic Bézier curve: B(t) = (1 − t)² p + 2t(1 − t) v + t² q, with the old corner v as its control point, at t = 1/n, 2/n, …',
            points: [{ p: V[p], color: '#38bdf8' }, { p: V[v], label: 'control', color: '#94a3b8' }, { p: V[q], color: '#38bdf8' }, { p: V[V.length - 1], color: '#f59e0b' }],
            values: [['t', fmt(t)], ['(1 − t)²', fmt(a)], ['2t(1 − t)', fmt(b)], ['t²', fmt(c)]],
            quiz: { prompt: `The curve runs from p = ${fmtV(V[p])} to q = ${fmtV(V[q])} with control point v = ${fmtV(V[v])}. Where is its point at t = ${fmt(t)}?`, answer: V[V.length - 1], labels: ['x', 'y', 'z'], rule: 'B(t) = (1 − t)² p + 2t(1 − t) v + t² q.' },
          });
        }
      }
      profiles.set(k, pts);
    }
    return profiles.get(k)!;
  };
  const patches: number[][] = [];

  for (const v of ends) {
    const fan = fanAround(mesh, v);
    if (!fan) continue;
    const info = fan.faces.map(({ f, i }) => {
      const face = mesh.faces[f], n = face.length, p = face[(i - 1 + n) % n], q = face[(i + 1) % n];
      return { f, p, q, bin: bev.has(ekey(p, v)), bout: bev.has(ekey(v, q)) };
    });
    // Edges some face slides along: the unbevelled edge of a face with exactly one bevelled edge at v.
    const slidEdge = new Set<number>();
    for (const c of info) if (c.bin !== c.bout) slidEdge.add(c.bin ? c.q : c.p);
    for (const c of info) {
      let seq: number[];
      if (c.bin && c.bout) { seq = [V.length]; V.push(add(V[v], add(mul(unit(sub(V[c.p], V[v])), w), mul(unit(sub(V[c.q], V[v])), w)))); }
      else if (c.bout) seq = [slide(v, c.p)];
      else if (c.bin) seq = [slide(v, c.q)];
      else {
        const a = slidEdge.has(c.p) ? slide(v, c.p) : null, b = slidEdge.has(c.q) ? slide(v, c.q) : null;
        // Both edges slid: the corner is cut off, following the curve between them if there is one.
        seq = a !== null && b !== null ? [a, ...profile(v, a, b), b] : [...(a !== null ? [a] : []), v, ...(b !== null ? [b] : [])];
      }
      corner.set(`${c.f}:${v}`, seq);
      if (c.bout) side.set(`${c.f}|${v}|${c.q}`, seq[seq.length - 1]);
      if (c.bin) side.set(`${c.f}|${v}|${c.p}`, seq[0]);
    }
    // The ring of new points around v, face by face, with each bevelled edge's curve between faces.
    const ring: number[] = [];
    info.forEach((c, k) => {
      const seq = corner.get(`${c.f}:${v}`)!;
      ring.push(...seq);
      if (c.bout && (fan.closed || k < info.length - 1)) ring.push(...profile(v, seq[seq.length - 1], corner.get(`${info[(k + 1) % info.length].f}:${v}`)![0]));
    });
    // Cancel repeats and there-and-back spikes (a, b, a): what is left encloses the hole a patch must fill.
    let cyc = ring.filter((x, k) => x !== ring[(k + 1) % ring.length]);
    for (let changed = true; changed && cyc.length >= 3;) {
      changed = false;
      for (let k = 0; k < cyc.length; k++) {
        const n = cyc.length;
        if (cyc[(k - 1 + n) % n] === cyc[(k + 1) % n]) { cyc = cyc.filter((_, j) => j !== k && j !== (k + 1) % n); changed = true; break; }
        if (cyc[k] === cyc[(k + 1) % n]) { cyc = cyc.filter((_, j) => j !== k); changed = true; break; }
      }
    }
    if (fan.closed && cyc.length >= 3) patches.push([...cyc].reverse());
    if (trace && trace.detailed(ends.size)) {
      const nb = info.filter((c) => c.bout).length + (fan.closed ? 0 : info.filter((c, k) => c.bin && k === 0).length);
      const kind = (c: typeof info[number]) => {
        if (c.bin && c.bout) return 'between two bevels: one point, w along each edge';
        if (c.bin || c.bout) return 'beside one bevel: slides along its other edge';
        const seq = corner.get(`${c.f}:${v}`)!;
        return seq.includes(v) ? (seq.length > 1 ? 'no bevel: keeps v, plus the slid point beside it' : 'no bevel: unchanged') : `no bevel: the corner is cut off by ${seq.length - 1} edge${seq.length === 2 ? '' : 's'} between its slid points`;
      };
      trace.step({
        phase: 'Corners', label: `v${v}: ${info.length} face corners, ${nb} bevelled edge${nb === 1 ? '' : 's'}${fan.closed && cyc.length >= 3 ? `, a ${cyc.length}-sided hole to patch` : ''}`,
        detail: 'Every face corner at v is replaced by new points, so v itself drops out of the bevelled faces. Where three or more bevelled edges meet, the new points leave a hole round v, filled by a corner patch.',
        values: info.map((c) => [`face ${c.f}`, kind(c)] as [string, string]),
        points: [{ p: V[v], label: `v${v}`, color: '#38bdf8' }, ...info.flatMap((c) => corner.get(`${c.f}:${v}`)!.filter((x) => x !== v).map((x) => ({ p: V[x], color: '#f59e0b' })))],
      });
    }
  }

  const faceCount = mesh.faces.length;
  mesh.faces = mesh.faces.map((f, fi) => f.flatMap((v) => corner.get(`${fi}:${v}`) ?? [v]));
  const added: number[] = [];
  for (const k of bev) {
    const [a, b] = k.split('-').map(Number);
    const [f1, f2] = orig.get(k)!.faces;
    const has = (fi: number, x: number, y: number) => { const i = origFaces[fi].indexOf(x); return origFaces[fi][(i + 1) % origFaces[fi].length] === y; };
    const [f, g] = has(f1, a, b) ? [f1, f2] : [f2, f1];
    const fa = side.get(`${f}|${a}|${b}`), fb = side.get(`${f}|${b}|${a}`), ga = side.get(`${g}|${a}|${b}`), gb = side.get(`${g}|${b}|${a}`);
    if ([fa, fb, ga, gb].some((x) => x === undefined)) continue;
    const ca = [fa!, ...profile(a, fa!, ga!), ga!], cb = [fb!, ...profile(b, fb!, gb!), gb!];
    for (let s2 = 0; s2 < ca.length - 1; s2++) { added.push(mesh.faces.length); mesh.faces.push([cb[s2], ca[s2], ca[s2 + 1], cb[s2 + 1]]); }
  }
  const strips = added.length;
  trace?.step({ phase: 'Strips', label: `${added.length} strip face${added.length === 1 ? '' : 's'}: ${nseg} across each bevelled edge`, detail: 'Each bevelled edge a–b becomes a strip joining face f\'s two new points beside it to face g\'s, through the curve\'s points if there are any: quads [b, a, a′, b′] in a row.', faces: [...added] }, mesh);
  if (patches.length) trace?.step({ phase: 'Patches', label: `${patches.length} corner patch${patches.length === 1 ? '' : 'es'}: ${[...new Set(patches.map((p) => p.length))].join(', ')} sided`, detail: 'Where three bevelled edges meet, the strips leave a hole at the corner. One face fills it; with several segments it is curved, so it is fanned into triangles from its centre.' });
  for (const p of patches) {
    if (nseg === 1 || p.length <= 4) { added.push(mesh.faces.length); mesh.faces.push(p); continue; }
    // A rounded corner is curved: one n-gon would be far from flat, so fan it from a centre point.
    const c = V.length;
    V.push(mul(p.reduce<Vec3>((acc, x) => add(acc, V[x]), [0, 0, 0]), 1 / p.length));
    p.forEach((x, i) => { added.push(mesh.faces.length); mesh.faces.push([x, p[(i + 1) % p.length], c]); });
  }
  mesh.compact();
  trace?.step({
    phase: 'Bevel', label: `${bev.size} edge${bev.size === 1 ? '' : 's'} bevelled by ${fmt(w)}${w < width - 1e-12 ? ` (clamped from ${fmt(width)} so bevels do not cross)` : ''}, ${nseg} segment${nseg === 1 ? '' : 's'}: ${strips} strip face${strips === 1 ? '' : 's'}, ${patches.length} corner patch${patches.length === 1 ? '' : 'es'} in ${added.length - strips} face${added.length - strips === 1 ? '' : 's'} (${faceCount} → ${mesh.faces.length} faces)`,
    detail: 'At each end of a bevelled edge, every face corner is replaced by points slid along its edges by the width. Strips join the two sides of each bevelled edge; where the new points around a corner leave a hole (three bevels meeting), a patch fills it.',
    faces: added,
  }, mesh);
  return added;
}

// ── dissolve ──────────────────────────────────────────────────────────────

/** The single outline loop of a set of faces, in order, or null if it is not one simple loop. */
function outlineLoop(mesh: EditMesh, faces: number[]): number[] | null {
  const directed = new Set<string>(), nextOf = new Map<number, number>();
  for (const f of faces) mesh.faces[f].forEach((a, i) => directed.add(`${a}>${mesh.faces[f][(i + 1) % mesh.faces[f].length]}`));
  let count = 0;
  for (const d of directed) {
    const [a, b] = d.split('>').map(Number);
    if (directed.has(`${b}>${a}`)) continue;
    if (nextOf.has(a)) return null; // two outline edges leave a: not a simple loop
    nextOf.set(a, b); count++;
  }
  if (!count) return null;
  const start = nextOf.keys().next().value as number, loop = [start];
  for (let v = nextOf.get(start)!; v !== start; v = nextOf.get(v)!) { if (loop.length > count || v === undefined) return null; loop.push(v); }
  return loop.length === count ? loop : null;
}

/** Merge groups of faces into one face each (a group must have one simple outline). Returns how many merges. */
function mergeGroups(mesh: EditMesh, groups: number[][], trace?: Trace, label = 'Dissolve', compact = true): number {
  const replace = new Map<number, number[] | null>();
  let merged = 0;
  for (const g of groups) {
    if (g.length < 2) continue;
    const loop = outlineLoop(mesh, g);
    if (!loop || loop.length < 3) continue;
    g.forEach((f, i) => replace.set(f, i === 0 ? loop : null));
    merged++;
    if (trace) {
      const directed = new Set<string>();
      for (const f of g) mesh.faces[f].forEach((a, i) => directed.add(`${a}>${mesh.faces[f][(i + 1) % mesh.faces[f].length]}`));
      const shared = [...directed].filter((d) => { const [a, b] = d.split('>'); return a < b && directed.has(`${b}>${a}`); }).map((d) => d.split('>').map(Number) as [number, number]);
      trace.step({
        phase: label, label: `${g.length} faces: ${shared.length} shared edge${shared.length === 1 ? '' : 's'} go, ${loop.length} outline edges stay`,
        detail: 'An edge walked both ways by the group (a → b by one face, b → a by another) is inside it: it goes. An edge walked one way only is on the outline: it stays.',
        faces: g, edges: shared,
      });
      trace.step({
        phase: label, label: `The outline, walked in order: one ${loop.length}-sided face [${loop.join(', ')}]`,
        detail: 'Each outline vertex has exactly one outline edge leaving it, so following them from any vertex walks the outline once round, in the faces\' own direction: the new face faces the same way as the old ones.',
        verts: loop,
        quiz: { prompt: `The outline edges leave each vertex once. Starting at v${loop[0]}, which vertex comes next round the merged face?`, answer: [loop[1]], labels: ['vertex'], rule: 'Follow the outline edge that leaves the vertex: the one the group walks one way only.', tolerance: 0 },
      });
    }
  }
  mesh.faces = mesh.faces.flatMap((f, i) => (replace.has(i) ? (replace.get(i) ? [replace.get(i)!] : []) : [f]));
  // Vertices left with two edges in a straight line inside a face stay (as Blender's plain dissolve); loose ones go.
  if (compact) mesh.compact();
  return merged;
}

/** Faces joined across the given edges, grouped. */
function groupAcross(mesh: EditMesh, keys: Set<string>): number[][] {
  const parent = mesh.faces.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const [k, e] of mesh.edges()) if (keys.has(k) && e.faces.length === 2) parent[find(e.faces[0])] = find(e.faces[1]);
  const groups = new Map<number, number[]>();
  mesh.faces.forEach((_, i) => { const r = find(i); (groups.get(r) ?? groups.set(r, []).get(r)!).push(i); });
  return [...groups.values()].filter((g) => g.length > 1);
}

/** Remove edges: the two faces beside each become one. */
export function dissolveEdges(mesh: EditMesh, edges: [number, number][], trace?: Trace): number {
  return mergeGroups(mesh, groupAcross(mesh, new Set(edges.map(([a, b]) => ekey(a, b)))), trace, 'Dissolve edges');
}

/** Merge the selected faces: each connected piece of the selection becomes one face. */
export function dissolveFaces(mesh: EditMesh, faces: number[], trace?: Trace): number {
  const sel = new Set(faces), keys = new Set<string>();
  for (const [k, e] of mesh.edges()) if (e.faces.length === 2 && sel.has(e.faces[0]) && sel.has(e.faces[1])) keys.add(k);
  return mergeGroups(mesh, groupAcross(mesh, keys), trace, 'Dissolve faces');
}

/**
 * Remove vertices: the faces around each merge into one (the vertex was inside it). A
 * vertex on only two edges in a line is simply taken out of the faces it is in.
 */
export function dissolveVerts(mesh: EditMesh, verts: number[], trace?: Trace): number {
  const vs = new Set(verts), edges = mesh.edges();
  const valence = new Map<number, number>();
  for (const e of edges.values()) for (const x of [e.a, e.b]) valence.set(x, (valence.get(x) ?? 0) + 1);
  const keys = new Set<string>();
  for (const [k, e] of edges) for (const x of [e.a, e.b]) if (vs.has(x) && (valence.get(x) ?? 0) > 2 && e.faces.length === 2) keys.add(k);
  // Merge without renumbering, take the vertices out, then renumber once.
  const merged = mergeGroups(mesh, groupAcross(mesh, keys), trace, 'Dissolve vertices', false);
  mesh.faces = mesh.faces.map((f) => f.filter((v) => !vs.has(v))).filter((f) => f.length >= 3);
  mesh.compact();
  return merged;
}

