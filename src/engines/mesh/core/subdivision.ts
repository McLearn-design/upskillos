// Catmull-Clark subdivision (Catmull & Clark, 1978).
//
// One step turns every face with k corners into k quads and moves the old
// vertices, so that repeating it converges to a smooth surface. Three rules:
//
//   face point   F = the average of the face's corners
//   edge point   E = (a + b + F₁ + F₂) / 4        for an edge between two faces
//                E = (a + b) / 2                   on a boundary
//   vertex       V' = (F̄ + 2·R̄ + (n − 3)·V) / n   for an interior vertex of valence n,
//                where F̄ averages the face points around V and R̄ the midpoints
//                of the edges at V.
//                V' = ¾·V + ⅛·(b₁ + b₂)            on a boundary, with b₁ and b₂
//                the two boundary neighbours; corners stay put.
//
// New vertices are laid out [old vertices (same indices), face points, edge
// points], so a vertex you selected keeps its index after the step.

import { EditMesh, type Vec3 } from './EditMesh';
import { Trace, fmt, fmtV } from './trace';

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const avg = (ps: Vec3[]): Vec3 => scale(ps.reduce(add, [0, 0, 0] as Vec3), 1 / ps.length);

export function catmullClark(mesh: EditMesh, trace?: Trace): EditMesh {
  const V = mesh.verts, F = mesh.faces, edges = mesh.edges();

  // 1. Face points.
  const facePts: Vec3[] = F.map((_, fi) => mesh.faceCenter(fi));
  if (trace) {
    const detail = trace.detailed(F.length);
    if (detail) {
      F.forEach((f, fi) => trace.step({
        phase: 'Face points', label: `Face ${fi}: F = average of ${f.length} corners = ${fmtV(facePts[fi])}`,
        detail: 'F = (v₁ + v₂ + … + vₖ) / k', faces: [fi],
        points: [{ p: facePts[fi], label: `F${fi}`, color: '#38bdf8' }],
        quiz: fi < 2 ? { prompt: `Face ${fi} has ${f.length} corners: ${f.map((v) => fmtV(V[v])).join(', ')}. Where is its face point F${fi}?`, answer: facePts[fi], labels: ['x', 'y', 'z'], rule: 'The face point is the average of the corners: add them and divide by how many there are.' } : undefined,
      }));
    } else {
      trace.step({ phase: 'Face points', label: `${F.length} face points, each the average of its face's corners`, points: facePts.slice(0, 200).map((p) => ({ p, color: '#38bdf8' })) });
    }
  }

  // 2. Edge points.
  const edgeList = [...edges.values()];
  const edgeIndex = new Map<string, number>();
  const edgePts: Vec3[] = edgeList.map((e, i) => {
    edgeIndex.set(EditMesh.edgeKey(e.a, e.b), i);
    const mid = scale(add(V[e.a], V[e.b]), 0.5);
    return e.faces.length === 2 ? scale(add(add(V[e.a], V[e.b]), add(facePts[e.faces[0]], facePts[e.faces[1]])), 0.25) : mid;
  });
  if (trace) {
    if (trace.detailed(edgeList.length)) {
      let asked = 0;
      edgeList.forEach((e, i) => {
        const inside = e.faces.length === 2;
        const quiz = inside && asked < 2 ? (asked++, {
          prompt: `Edge ${e.a}–${e.b} runs from ${fmtV(V[e.a])} to ${fmtV(V[e.b])}. The face points beside it are F${e.faces[0]} = ${fmtV(facePts[e.faces[0]])} and F${e.faces[1]} = ${fmtV(facePts[e.faces[1]])}. Where is its edge point E?`,
          answer: edgePts[i], labels: ['x', 'y', 'z'], rule: 'E = (a + b + F₁ + F₂) / 4: the average of the two ends and the two face points beside the edge. It is pulled off the edge toward the faces.',
        }) : undefined;
        trace.step({
          phase: 'Edge points',
          label: `Edge ${e.a}–${e.b}: E = ${fmtV(edgePts[i])}`,
          detail: inside ? `E = (v${e.a} + v${e.b} + F${e.faces[0]} + F${e.faces[1]}) / 4: the average of the edge's ends and the two face points beside it.` : 'A boundary edge has one face, so E is its midpoint.',
          edges: [[e.a, e.b]],
          points: [
            ...(inside ? e.faces.map((f) => ({ p: facePts[f], label: `F${f}`, color: '#38bdf8' })) : []),
            { p: edgePts[i], label: 'E', color: '#a855f7' },
          ],
          quiz,
        });
      });
    } else {
      trace.step({ phase: 'Edge points', label: `${edgeList.length} edge points`, detail: 'E = (a + b + F₁ + F₂) / 4, or the midpoint on a boundary.', points: edgePts.slice(0, 200).map((p) => ({ p, color: '#a855f7' })) });
    }
  }

  // 3. Move the original vertices.
  const vFaces: number[][] = V.map(() => []);
  F.forEach((f, fi) => f.forEach((v) => vFaces[v].push(fi)));
  const vEdges: number[][] = V.map(() => []);
  edgeList.forEach((e, i) => { vEdges[e.a].push(i); vEdges[e.b].push(i); });

  const moved: Vec3[] = V.map((P, v) => {
    if (!vFaces[v].length) return P;                    // a loose vertex is left alone
    const boundary = vEdges[v].filter((i) => edgeList[i].faces.length === 1);
    if (boundary.length) {
      // A corner (a boundary vertex on only one face, like a plane's corner) or a non-manifold
      // junction stays where it is, as in Blender ("keep corners"). Otherwise the along-the-edge
      // rule below would round a plane's corners off.
      if (boundary.length !== 2 || vFaces[v].length === 1) return P;
      const [b1, b2] = boundary.map((i) => (edgeList[i].a === v ? edgeList[i].b : edgeList[i].a));
      return add(scale(P, 0.75), scale(add(V[b1], V[b2]), 0.125));
    }
    const n = vEdges[v].length;
    const Fbar = avg(vFaces[v].map((fi) => facePts[fi]));
    const Rbar = avg(vEdges[v].map((i) => scale(add(V[edgeList[i].a], V[edgeList[i].b]), 0.5)));
    return scale(add(add(Fbar, scale(Rbar, 2)), scale(P, n - 3)), 1 / n);
  });
  if (trace) {
    if (trace.detailed(V.length)) {
      let asked = 0;
      V.forEach((P, v) => {
        if (!vFaces[v].length) return;
        const n = vEdges[v].length, bnd = vEdges[v].some((i) => edgeList[i].faces.length === 1);
        const Fb = avg(vFaces[v].map((fi) => facePts[fi])), Rb = avg(vEdges[v].map((i) => scale(add(V[edgeList[i].a], V[edgeList[i].b]), 0.5)));
        const quiz = !bnd && asked < 2 ? (asked++, {
          prompt: `v${v} is at V = ${fmtV(P)} with n = ${n} edges. The face points around it average F̄ = ${fmtV(Fb)}; the midpoints of its edges average R̄ = ${fmtV(Rb)}. Where does v${v} move?`,
          answer: moved[v], labels: ['x', 'y', 'z'], rule: `V′ = (F̄ + 2·R̄ + (n − 3)·V) / n. With n = ${n}: ${fmt(1 / n)}·F̄ + ${fmt(2 / n)}·R̄ + ${fmt((n - 3) / n)}·V. A vertex is pulled toward its neighbourhood, less so the more edges it has.`,
        }) : undefined;
        trace.step({
          phase: 'Move vertices',
          label: `v${v}: ${fmtV(P)} → ${fmtV(moved[v])}`,
          detail: bnd
            ? (moved[v] === P ? 'Corner: a boundary vertex on only one face stays where it is, so the corner stays sharp.' : 'Boundary vertex: V′ = ¾·V + ⅛·(b₁ + b₂), which keeps an open edge from shrinking away from its neighbours.')
            : `Valence n = ${n}: V′ = (F̄ + 2·R̄ + (n − 3)·V) / n = (F̄ + 2·R̄ + ${n - 3}·V) / ${n}. F̄ averages the ${vFaces[v].length} face points around it, R̄ the ${n} edge midpoints.`,
          verts: [v],
          arrows: [{ from: P, to: moved[v], color: '#f59e0b' }],
          values: [['n', String(n)], ['weights', bnd ? '¾ V, ⅛ each neighbour' : `F̄ ${fmt(1 / n)}, R̄ ${fmt(2 / n)}, V ${fmt((n - 3) / n)}`]],
          quiz,
        });
      });
    } else {
      trace.step({ phase: 'Move vertices', label: `${V.length} vertices moved`, detail: 'V′ = (F̄ + 2·R̄ + (n − 3)·V) / n', arrows: V.slice(0, 200).map((P, v) => ({ from: P, to: moved[v], color: '#f59e0b' })) });
    }
  }

  // 4. Connect: each corner of each face becomes a quad.
  const fBase = V.length, eBase = V.length + F.length;
  const verts: Vec3[] = [...moved, ...facePts, ...edgePts];
  const eIdx = (a: number, b: number) => eBase + edgeIndex.get(EditMesh.edgeKey(a, b))!;
  const faces: number[][] = [];
  F.forEach((f, fi) => {
    for (let i = 0; i < f.length; i++) {
      const prev = f[(i - 1 + f.length) % f.length], cur = f[i], next = f[(i + 1) % f.length];
      faces.push([cur, eIdx(cur, next), fBase + fi, eIdx(prev, cur)]);
    }
  });
  const out = new EditMesh(verts, faces);
  trace?.step({
    phase: 'Connect', label: `${F.length} faces → ${faces.length} quads, ${V.length} → ${verts.length} vertices`,
    detail: 'Each corner of each face becomes the quad [V′, E(next), F, E(previous)]. Every face is now a quad, whatever it was before.',
    values: [['vertices', `${V.length} + ${F.length} + ${edgeList.length} = ${verts.length}`]],
  }, out);
  return out;
}

/** Apply `levels` steps. Only the first step is traced: the rules are the same every time. */
export function subdivide(mesh: EditMesh, levels: number, trace?: Trace): EditMesh {
  let m = mesh;
  for (let i = 0; i < levels; i++) m = catmullClark(m, i === 0 ? trace : undefined);
  return m;
}
