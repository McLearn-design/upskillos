// Lesson 6.5: subdividing UVs. Texture coordinates live at face corners. Subdivided linearly, they stay where the
// cage had them while the surface moves, so the texture slides. Subdivided smoothly, the UVs are treated as a mesh of
// their own (a UV vertex is a mesh vertex together with one UV, so seams split vertices and become borders) and get
// the same Catmull–Clark rules, with island borders kept straight so seams still match.

const HELPERS = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const p2 = (p) => '(' + r(p[0]) + ', ' + r(p[1]) + ')'
const add = (a, b) => a.map((x, i) => x + b[i]), mul = (a, s) => a.map((x) => x * s)
const avg = (ps) => mul(ps.reduce(add), 1 / ps.length)
const key = (a, b) => a < b ? a + '-' + b : b + '-' + a
// One Catmull–Clark step on a mesh with open borders: on a border edge the edge point is the midpoint, and a border
// vertex moves by the curve rule (lesson 6.1) if smoothBorders, or stays if not; a corner (2 edges) always stays.
// Works on 3D points or 2D UVs alike.
function step(V, F, smoothBorders) {
  const facePts = F.map((f) => avg(f.map((v) => V[v])))
  const edges = new Map()
  F.forEach((f, fi) => f.forEach((a, i) => { const b = f[(i + 1) % f.length], k = key(a, b); if (!edges.has(k)) edges.set(k, { a, b, faces: [] }); edges.get(k).faces.push(fi) }))
  const edgeIndex = new Map(), edgePts = [], border = new Map()
  for (const [k, e] of edges) {
    edgeIndex.set(k, edgePts.length)
    if (e.faces.length === 2) edgePts.push(avg([V[e.a], V[e.b], facePts[e.faces[0]], facePts[e.faces[1]]]))
    else { edgePts.push(avg([V[e.a], V[e.b]])); for (const [x, y] of [[e.a, e.b], [e.b, e.a]]) { if (!border.has(x)) border.set(x, []); border.get(x).push(y) } }
  }
  const vf = V.map(() => []), ve = V.map(() => [])
  F.forEach((f, fi) => f.forEach((v) => vf[v].push(fi)))
  for (const e of edges.values()) { ve[e.a].push(e); ve[e.b].push(e) }
  const moved = V.map((P, v) => {
    if (border.has(v)) { const nb = border.get(v); return smoothBorders && nb.length === 2 && ve[v].length > 2 ? add(mul(P, 0.75), mul(add(V[nb[0]], V[nb[1]]), 0.125)) : P }
    const n = ve[v].length
    return mul(add(add(avg(vf[v].map((fi) => facePts[fi])), mul(avg(ve[v].map((e) => avg([V[e.a], V[e.b]]))), 2)), mul(P, n - 3)), 1 / n)
  })
  const nv = V.length, nf = F.length, quads = []
  F.forEach((f, fi) => f.forEach((v, i) => { const prev = f[(i + f.length - 1) % f.length], next = f[(i + 1) % f.length]; quads.push([v, nv + nf + edgeIndex.get(key(v, next)), nv + fi, nv + nf + edgeIndex.get(key(prev, v))]) }))
  return { V: [...moved, ...facePts, ...edgePts], F: quads }
}
// A flat 3 × 3 grid in the xz plane with uneven spacing, so subdivision moves its inside vertices.
const xs = [0, 0.3, 1, 2], zs = [0, 0.6, 1.2, 2]
const gridV = [], gridF = []
for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) gridV.push([xs[i], 0, zs[j]])
for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) gridF.push([i * 4 + j, i * 4 + j + 1, (i + 1) * 4 + j + 1, (i + 1) * 4 + j])
// Linear UVs: corners keep their UVs, edge points get midpoints, face points centres. Nothing moves.
function linearUV(UV, F) {
  const out = []
  F.forEach((f) => { const c = avg(f.map((v) => UV[v])); f.forEach((v, i) => { const next = f[(i + 1) % f.length], prev = f[(i + f.length - 1) % f.length]; out.push([UV[v], avg([UV[v], UV[next]]), c, avg([UV[prev], UV[v]])]) }) })
  return out
}
`;

const UVVERTS = `${HELPERS}
// An open tube: 8 around, 2 rings. Its UVs: u = k / 8 round it, v = 0 or 1 up it. Cut along the seam at k = 0.
const n = 8, faces = [], uvs = []
for (let k = 0; k < n; k++) {
  faces.push([k, (k + 1) % n, n + (k + 1) % n, n + k])
  uvs.push([[k / n, 0], [(k + 1) / n, 0], [(k + 1) / n, 1], [k / n, 1]])      // the last face's right side has u = 1
}
// A UV vertex is a mesh vertex together with one UV. Predict first: how many mesh vertices, and how many UV vertices?
const uvVerts = new Set()
faces.forEach((f, fi) => f.forEach((v, c) => uvVerts.add(v + ':' + uvs[fi][c].join(','))))
console.log('mesh vertices: ' + new Set(faces.flat()).size + '; UV vertices: ' + uvVerts.size)
console.log('vertex 0 has UVs ' + [...uvVerts].filter((s) => s.startsWith('0:')).map((s) => '(' + s.slice(2) + ')').join(' and ') + ': the seam splits it, so in the UV mesh the seam is a border')`;

const SLIDE = `${HELPERS}
// Planar UVs: each vertex's UV is its (x, z). Subdivide the positions once, and the UVs two ways.
const uv = gridV.map((p) => [p[0], p[2]])
const s = step(gridV, gridF, true)                  // the surface: Catmull–Clark, its open border by the curve rule
const smooth = step(uv, gridF, false)               // the UVs as a mesh of their own, same rules, borders kept
const lin = linearUV(uv, gridF)                     // per face corner
// Where should the texture be? At each new vertex, its new (x, z). Compare at the moved inside vertex 5.
console.log('vertex 5 moved from ' + p2([gridV[5][0], gridV[5][2]]) + ' to ' + p2([s.V[5][0], s.V[5][2]]))
console.log('its smooth UV: ' + p2(smooth.V[5]) + '; its linear UV: ' + p2(lin[s.F.findIndex((f) => f[0] === 5)][0]))
// Over every corner of the subdivided grid: how far is each UV from where the planar projection puts it?
// Corners on the island's border are counted apart: there the surface moves along the border but the UVs are kept.
const onBorder = (p) => [p[0], p[1]].some((x) => Math.abs(x) < 1e-9 || Math.abs(x - 2) < 1e-9)
const worst = { smoothIn: 0, smoothBorder: 0, linear: 0 }
s.F.forEach((f, fi) => f.forEach((v, c) => {
  const want = [s.V[v][0], s.V[v][2]], S = smooth.V[smooth.F[fi][c]], L = lin[fi][c]
  const ds = Math.hypot(S[0] - want[0], S[1] - want[1])
  if (onBorder(S)) worst.smoothBorder = Math.max(worst.smoothBorder, ds); else worst.smoothIn = Math.max(worst.smoothIn, ds)
  worst.linear = Math.max(worst.linear, Math.hypot(L[0] - want[0], L[1] - want[1]))
}))
console.log('largest slide from the projection: smooth, inside the island ' + r(worst.smoothIn) + '; smooth, on its border ' + r(worst.smoothBorder) + '; linear ' + r(worst.linear))`;

const BORDERS = `${HELPERS}
// Why island borders are kept: an island whose outline is not straight (the grid's UVs with each border point that is
// not a corner pushed 0.25 outwards), subdivided twice with its border smoothed by the curve rule, and kept.
const uv = gridV.map((p) => [p[0], p[2]])
gridV.forEach((p, i) => {
  const [u, v] = uv[i], side = [u === 0 ? [-1, 0] : null, u === 2 ? [1, 0] : null, v === 0 ? [0, -1] : null, v === 2 ? [0, 1] : null].filter(Boolean)
  if (side.length === 1) uv[i] = add(uv[i], mul(side[0], 0.25))
})
const area = (V, F) => F.reduce((t, f) => t + Math.abs(f.reduce((s, v, i) => { const a = V[v], b = V[f[(i + 1) % f.length]]; return s + a[0] * b[1] - b[0] * a[1] }, 0)) / 2, 0)
const outlinePt = 1                                  // the border point (0, 0.6), pushed out to (-0.25, 0.6)
for (const smoothBorders of [true, false]) {
  let m = { V: uv, F: gridF }
  for (let k = 0; k < 2; k++) m = step(m.V, m.F, smoothBorders)
  console.log((smoothBorders ? 'border smoothed: ' : 'border kept:     ') + 'island area ' + r(area(m.V, m.F)) + '; the outline point (-0.25, 0.6) is now at ' + p2(m.V[outlinePt]))
}
console.log('the island across the seam has a different outline, so smoothing would move its side of the seam differently')`;

const PICTURE = `${HELPERS}
// The subdivided grid's UVs: where the projection wants them (grey grid), smooth UVs (blue dots, on it) and linear
// UVs (amber dots, slid off it). Drawn on a canvas, u across and v up.
const uv = gridV.map((p) => [p[0], p[2]])
const s = step(gridV, gridF, true), smooth = step(uv, gridF, false), lin = linearUV(uv, gridF)
const canvas = document.createElement('canvas'), W = 360, H = 320
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'); g.scale(2, 2); g.fillStyle = '#0f1923'; g.fillRect(0, 0, W, H)
const X = (p) => [30 + p[0] * 145, H - 20 - p[1] * 140]
g.strokeStyle = '#475569'; g.lineWidth = 1
for (const f of s.F) { g.beginPath(); f.forEach((v, i) => { const [x, y] = X([s.V[v][0], s.V[v][2]]); i ? g.lineTo(x, y) : g.moveTo(x, y) }); g.closePath(); g.stroke() }
const dot = (p, c, rad) => { const [x, y] = X(p); g.fillStyle = c; g.beginPath(); g.arc(x, y, rad, 0, 2 * Math.PI); g.fill() }
let slid = 0, smoothOff = 0
s.F.forEach((f, fi) => f.forEach((v, c) => {
  const want = [s.V[v][0], s.V[v][2]], L = lin[fi][c], S = smooth.V[smooth.F[fi][c]]
  if (Math.hypot(L[0] - want[0], L[1] - want[1]) > 1e-6) { slid++; dot(L, '#f59e0b', 3.5); g.strokeStyle = '#f59e0b'; g.beginPath(); g.moveTo(...X(L)); g.lineTo(...X(want)); g.stroke() }
  if (Math.hypot(S[0] - want[0], S[1] - want[1]) > 1e-6) smoothOff++
  dot(S, '#4f8fd9', 2.5)
}))
console.log('grey: the subdivided grid projected; blue: smooth UVs, off it at ' + smoothOff + ' corners (all on the border); amber: ' + slid + ' linear UV corners slid off it')`;

const CHALLENGE = `// A cube's 8 vertices, unwrapped two ways. (a) Every face its own island (cut along all 12 edges).
// (b) The usual cross-shaped net: one island, cut along 7 edges. How many UV vertices in each?
const answer = { sixIslands: 0, cross: 0 }
console.log(answer)`;

const SOLVED = CHALLENGE.replace('const answer = { sixIslands: 0, cross: 0 }', 'const answer = { sixIslands: 24, cross: 14 }');

/** The challenge's check: six islands give 6 × 4 = 24 UV vertices; the cross net has 14. */
export function checkUVVerts(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+answer\s*=\s*\{([^}]*)\}/);
  if (!m) return no('Keep the line const answer = { sixIslands: …, cross: … }.');
  const get = (k) => { const g = m[1].match(new RegExp(k + '\\s*:\\s*(-?\\d+)')); return g ? Number(g[1]) : NaN; };
  const six = get('sixIslands'), cross = get('cross');
  if ([six, cross].some(Number.isNaN)) return no('Give both as whole numbers: sixIslands and cross.');
  if (six === 8 || cross === 8) return no('8 is the number of mesh vertices. A vertex with a different UV on each side of a seam is several UV vertices.');
  if (six !== 24) return no(`With every face its own island, no corner shares a UV with any other: 6 faces × 4 corners. ${six} is not that.`);
  if (cross === 24) return no('In the cross, neighbouring faces that are not cut apart share their corners\' UVs. Count the corners of the net drawn flat.');
  if (cross !== 14) return no(`Draw the cross: a column of 4 squares with one square on each side of the second. ${cross} is not how many corners it has.`);
  return { pass: true, message: '24 and 14. Six islands share nothing: 24 UV vertices for 8 mesh vertices. The cross net is one island whose flat drawing has 14 corners: each of the 7 cut edges splits its vertices, and a UV vertex is a mesh vertex together with one UV.' };
}

export default {
  id: 'modelling-geometry-6-005',
  slug: 'subdividing-uvs',
  chapter: 'modelling-geometry',
  order: 5,
  title: 'Subdividing UVs',
  subtitle: 'Smooth the texture coordinates with the surface, and keep seams where they are.',
  tags: ['subdivision', 'uv', 'texture coordinates', 'seams', 'distortion', 'catmull-clark'],
  coreConcept: 'UVs belong to face corners: a vertex on a seam has a different UV on each side. Subdivided linearly, corners keep their UVs and new points get midpoints, so where subdivision moves the surface the texture stays behind and slides. Subdivided smoothly, the UVs are a mesh of their own (a UV vertex is a mesh vertex together with one UV, so seams split vertices and become borders) and get the same Catmull–Clark rules; on a flat, projected surface this reproduces the projection exactly. Island borders are kept straight (midpoints, fixed corners), so islands do not shrink and both sides of a seam still match. On a sphere it cuts mean texture distortion from 1.49 to 1.32.',
  prerequisites: ['modelling-geometry-6-004', 'modelling-geometry-6-002'],
  timeToComplete: 35,
  nextLesson: 'modelling-geometry-7-001',

  hook: {
    question: 'A checker texture looks right on the low model. Turn on subdivision and the squares near the poles smear and slide. The surface moved; did the texture coordinates not move with it?',
    realWorldContext: 'Every textured subdivision model in film and games depends on this: Blender\'s "Keep Boundaries" UV smoothing, OpenSubdiv\'s face-varying interpolation and Pixar\'s RenderMan all subdivide UVs as a separate mesh with border rules, so painted textures stay where the artist put them.',
  },

  intuition: {
    prose: [
      'UVs are not stored per vertex but per **face corner** (lesson 8.1): the same vertex can have one UV in one face and another in the next. That is how a **seam** works: along it, the two sides of the surface sit in different places on the texture.',
      'So think of the UVs as a mesh of their own. A **UV vertex** is a mesh vertex together with one UV. Before running cell 1, predict: an open tube 8 round and 2 rings tall, cut along one seam. How many mesh vertices, and how many UV vertices? $16$ and $18$: the seam\'s two vertices each have two UVs, $u = 0$ and $u = 1$. In the UV mesh, the seam is a **border**.',
      'Now subdivide the surface. The simplest UV rule is **linear**: corners keep their UVs, edge points get midpoints, face points the face\'s centre. But Catmull–Clark moves the corners (lesson 6.2), so the texture stays where the cage had it while the surface moves under it: it **slides**.',
      'The fix is to subdivide the UV mesh with the **same rules** as the surface. Cell 2 takes a flat, unevenly spaced grid whose UVs are just $(x, z)$. Before running it, predict: after one step, is a smooth UV exactly the new $(x, z)$ of its vertex? Inside the island, yes, every one: the rules are affine, so they commute with the projection. On the island\'s border the UVs are kept while the surface\'s border moves, so a small slide remains there ($0.05$). The linear UVs are off by up to $0.056$ everywhere the surface moved.',
      'On **borders** the UV mesh is treated specially: border vertices stay put and border edges get midpoints. Cell 3 shows why on an island with a bumpy outline: smoothing the border with the curve rule pulls the outline in (the island shrinks from $5.33$ to $5.22$ and a border point moves from $-0.25$ to $-0.21$), and the island across a seam has its own, different outline, so the two sides would move differently and no longer meet. Kept borders stay exactly where they were.',
      'On a curved surface the texture is still slightly distorted, since a flat texture never fits a sphere exactly, but less: MeshLab\'s sphere project measures mean angle distortion $1.49$ with linear UVs and $1.32$ with smooth ones (1 is none).',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Subdivide UVs smoothly (keep borders)',
        body: 'Step 1. UV vertices: group face corners by (mesh vertex, UV). Seams give one mesh vertex several UV vertices.\nStep 2. UV edges: an edge between two UV faces is inside; an edge with one is a border (a seam or the mesh\'s edge).\nStep 3. Face points: the centre of each UV face. Edge points: inside, (a + b + F₁ + F₂) / 4; on a border, the midpoint.\nStep 4. Vertex points: inside, (F̄ + 2R̄ + (n − 3)P) / n; on a border, unchanged.\nStep 5. Each corner\'s new quad gets these UVs, in the same order as the surface\'s new quad.',
      },
      {
        type: 'warning',
        title: 'Linear UVs slide',
        body: 'With linear UV subdivision the texture stays where the cage put it, and the surface moves away underneath: checks stretch and lines bend most where subdivision moves the surface most (poles, corners). Use smooth UVs unless the texture must line up with cage vertices exactly.',
      },
      {
        type: 'warning',
        title: 'Seams must match after subdivision',
        body: 'Smoothing island borders would move each side of a seam by its own island\'s rule, opening visible cracks in the texture. Keeping borders straight (midpoints) guarantees both sides subdivide the seam the same way.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: texture distortion on the smoothed surface',
        body: 'The texture lookup (lesson 8.1) interpolates UVs across each triangle. If the UVs do not follow the surface, a square of texture is mapped to a skewed quad of surface, and the eye sees stretched checks and bent lines. Smooth UVs keep the mapping close to what the artist painted on the cage.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "UVs come along with the surface automatically". The grey grid is where the subdivided surface\'s projection puts each corner. Every smooth UV (blue) inside the island lands on it, and only a few on the border are slightly off; the linear UVs (amber) of the corners that moved are left behind, with lines showing how far.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'step() in the cells runs Catmull–Clark on points or UVs alike; with smoothBorders false it is Steps 3–4; linearUV() is the linear rule; cell 1 counts Step 1\'s UV vertices.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Each corner of each subdivided quad gets its own UV; the GPU stores them per vertex of the drawn triangles, which is why a seam doubles the drawn vertices there.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'The subdivision modifier\'s Smooth UVs option (on by default) chooses the rule; UV › Trace subdividing the UVs traces UV vertices, kept borders and one inside point (predict it), then compares distortion. Scripts call obj.traceUVSubdivision(levels).' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: UVs as a mesh',
        caption: 'UV vertices and seams, linear versus smooth UVs, why borders are kept, and the slide drawn.',
        props: {
          lesson: {
            title: 'Subdividing UVs',
            subtitle: 'The texture follows the surface.',
            cells: [
              { type: 'js', instruction: '### 1. UV vertices\nPredict first: mesh vertices and UV vertices of a tube cut along one seam.', startCode: UVVERTS },
              { type: 'js', instruction: '### 2. Linear versus smooth\nPredict first: does a smooth UV land exactly on its vertex\'s new (x, z)?', startCode: SLIDE },
              { type: 'js', instruction: '### 3. Why borders are kept\nA bumpy island subdivided with its border smoothed, and kept.', startCode: BORDERS },
              { type: 'js', instruction: '### 4. See it\nWhere each corner should be, smooth UVs, and linear UVs left behind.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 340 },
              { type: 'challenge', instruction: '### 5. Challenge: UV vertices of a cube\nSix islands, and the cross net. The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkUVVerts },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Subdividing UVs" in MeshLab](#/lab/mesh-lab?project=subdivide-uvs). A checker-textured ball, cut along one seam and subdivided; the UV subdivision is traced: press Play, predict an inside UV point, and read the distortion comparison. Then untick Smooth UVs and watch the checks slide.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Inspector › Modifiers › Subdivision › Smooth UVs:** smooth (default) or linear.\n- **UV › Trace subdividing the UVs:** the rule, traced, and the distortion saved.\n- **UV tab:** the islands; seams are their borders.\n- **In Blender:** the Subdivision Surface modifier\'s UV Smooth setting ("Keep Boundaries" is this lesson\'s rule; "None" is linear).' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**UVs as a mesh.** Let each face corner $(f, k)$ carry a UV $t_{f,k}$. Identify corners with the same mesh vertex and the same UV: the result is a UV mesh with the same faces, whose vertices are (vertex, UV) pairs. Its open borders are exactly the seams and the mesh\'s own open edges.',
      '**Affine reproduction.** Every Catmull–Clark rule is an affine combination. If the UVs are an affine function of position, $t = Ax + b$ (a planar projection), then subdividing UVs and positions with the same weights gives $t\' = Ax\' + b$: the projection is reproduced exactly at every level. Linear UV subdivision does not have this property where the surface moves.',
      '**Borders.** On a UV border the rule uses only the border edge (midpoints, fixed vertices): a linear rule along the border. Both sides of a seam subdivide that seam edge the same way in their own islands, so the texture coordinates on either side stay at matching positions along the seam.',
      '**Distortion.** Map each triangle of the surface to its UV triangle; the ratio of the singular values of that map (lesson 8.5) measures how much a texture circle becomes an ellipse. Its mean over the sphere drops from 1.49 (linear) to 1.32 (smooth) at two levels.',
    ],
    equations: [
      { label: 'UV vertex', latex: '(\\,v,\\; t\\,), \\quad v \\text{ a mesh vertex, } t \\text{ a UV}' },
      { label: 'Affine reproduction', latex: "t = Ax + b \\;\\Rightarrow\\; t' = Ax' + b" },
      { label: 'Border edge point', latex: 'E = \\tfrac12 (t_a + t_b)' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** Face-varying Catmull–Clark with boundary interpolation (borders linear, interior by the standard rules) produces UVs that converge with the surface, reproduce affine parameterisations exactly in the interior, and keep each island\'s border polygon fixed, so seam correspondences are preserved at every level.',
      '**Invariant viewpoint.** The UV rule depends on the UV mesh\'s connectivity, which can differ from the surface\'s (seams). Positions and UVs are subdivided by the same kind of rule on two different meshes that share faces.',
      '**Geometric picture.** The texture is a sheet glued to the cage at its corners. Linear subdivision leaves the glue spots fixed while the surface shrinks under them; smooth subdivision lets the sheet shrink with it, pinned only along its cut edges.',
      '**Where this goes.** Chapter 8 is about UVs themselves: what they are (8.1), seams and charts (8.2), projections (8.3), conformal unwrapping (8.4) and measuring distortion (8.5).',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-6-005-ex1',
      title: 'UV vertices on a cylinder',
      problem: 'A tube 12 round and 4 rings tall is cut along one seam. How many UV vertices?',
      steps: [
        { expression: '12 \\times 4 = 48\\text{ mesh vertices}', annotation: 'Rings of 12.' },
        { expression: '+4\\text{ copies along the seam}', annotation: 'One per ring, with u = 1 instead of 0.' },
      ],
      conclusion: '52 UV vertices.',
    },
    {
      id: 'modelling-geometry-6-005-ex2',
      title: 'A border edge point',
      problem: 'A seam edge runs between UVs $(0.2, 0.4)$ and $(0.2, 0.6)$. Its new UV point?',
      steps: [{ expression: '\\tfrac12\\big((0.2, 0.4) + (0.2, 0.6)\\big) = (0.2, 0.5)', annotation: 'Borders use midpoints.' }],
      conclusion: '(0.2, 0.5), on both sides of the seam in their own islands.',
    },
    {
      id: 'modelling-geometry-6-005-ex3',
      title: 'Why a projection is reproduced',
      problem: 'UVs are $t = (x, z)$. A vertex moves to $x\' = \\sum w_i x_i$. What is its smooth UV?',
      steps: [
        { expression: "t' = \\sum w_i t_i = \\sum w_i (x_i, z_i)", annotation: 'The same weights on the UVs.' },
        { expression: "= (x', z')", annotation: 'Because Σ wᵢ = 1 and the map is linear.' },
      ],
      conclusion: 'Its smooth UV is its new (x′, z′): the projection exactly.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-6-005-ch1',
      difficulty: 'easy',
      problem: 'Why does a vertex on a seam become two UV vertices?',
      walkthrough: [{ expression: '\\text{it has a different UV on each side}', annotation: 'A UV vertex is a vertex with one UV.' }],
      answer: 'On each side of a seam the vertex sits at a different place on the texture; a UV vertex is a mesh vertex together with one UV, so it counts once per distinct UV.',
    },
    {
      id: 'modelling-geometry-6-005-ch2',
      difficulty: 'medium',
      problem: 'Cell 3 smooths the island border with the curve rule. What would happen across a seam, and why does keeping borders fix it?',
      walkthrough: [
        { expression: '\\text{each island\'s border moves by its own neighbours}', annotation: 'Different on each side.' },
        { expression: '\\text{kept borders use only the seam edge itself}', annotation: 'The same on both sides.' },
      ],
      answer: 'Each side of a seam lives in a different island with different neighbours, so smoothing would move the two sides differently and the texture would no longer meet along the seam. A kept border subdivides the seam edge by its own endpoints only (midpoints), identically on both sides.',
    },
    {
      id: 'modelling-geometry-6-005-ch3',
      difficulty: 'hard',
      problem: 'Prove that smooth UV subdivision reproduces a planar projection exactly in the interior.',
      walkthrough: [
        { expression: "x' = \\sum_i w_i x_i, \\quad \\sum w_i = 1", annotation: 'Every rule is an affine combination.' },
        { expression: "t_i = A x_i + b \\Rightarrow \\sum w_i t_i = A\\sum w_i x_i + b", annotation: 'The constant passes through because the weights sum to 1.' },
      ],
      answer: 'Each new point, position or UV, is Σ wᵢ (old points) with Σ wᵢ = 1 and the same weights for both. If every old UV is A xᵢ + b, the new UV is A (Σ wᵢ xᵢ) + b (Σ wᵢ) = A x′ + b: exactly the projection of the new position.',
    },
  ],

  semantics: {
    core: [
      { symbol: 't_{f,k}', meaning: 'The UV of corner k of face f.' },
      { symbol: '\\text{UV vertex}', meaning: 'A mesh vertex together with one UV.' },
      { symbol: '\\text{seam}', meaning: 'An edge where the two sides have different UVs: a border of the UV mesh.' },
      { symbol: '\\text{linear UVs}', meaning: 'Corners keep their UVs; new points get midpoints and centres.' },
      { symbol: '\\text{smooth UVs}', meaning: 'Catmull–Clark on the UV mesh, borders kept.' },
      { symbol: '\\text{island}', meaning: 'A connected piece of the UV mesh.' },
    ],
    rulesOfThumb: [
      'UVs belong to corners, not vertices.',
      'Seams are borders of the UV mesh.',
      'Smooth UVs follow the surface; linear UVs slide.',
      'Keep island borders straight so seams match.',
      'A planar projection is reproduced exactly.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-6-002', label: 'Catmull–Clark', note: 'The rules applied to UVs here.' },
      { lessonId: 'modelling-geometry-6-001', label: 'Corner cutting', note: 'The curve rule that borders deliberately do not use.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-7-001', label: 'Fields on a mesh and colour maps', note: 'Values per vertex, the next chapter.' },
      { lessonId: 'modelling-geometry-8-001', label: 'What UVs are', note: 'UVs themselves, in full.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-6-005-1', label: 'Read what a UV vertex is and why seams are borders', type: 'read' },
    { id: 'cp-modelling-geometry-6-005-2', label: 'Read why linear UVs slide and smooth ones do not', type: 'read' },
    { id: 'cp-modelling-geometry-6-005-3', label: 'Read why island borders are kept', type: 'read' },
    { id: 'cp-modelling-geometry-6-005-4', label: 'Run cells 1 to 3: UV vertices, the slide, borders', type: 'lab' },
    { id: 'cp-modelling-geometry-6-005-5', label: 'Trace UV subdivision on the ball in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-6-005-6', label: 'Work through example 1, UV vertices on a cylinder', type: 'example' },
    { id: 'cp-modelling-geometry-6-005-7', label: 'Work through example 3, why a projection is reproduced', type: 'example' },
    { id: 'cp-modelling-geometry-6-005-8', label: 'Complete the challenge: UV vertices of a cube', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-6-005-assess-1',
        type: 'choice',
        text: 'An open tube of 6 around and 3 rings, cut along one seam. How many UV vertices?',
        options: ['21', '18', '24', '20'],
        answer: '21',
        hint: '18 mesh vertices, plus one copy per ring along the seam.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-6-005-quiz-1',
      type: 'choice',
      text: 'Where are UVs stored?',
      options: ['Per face corner', 'Per vertex', 'Per edge', 'Per face'],
      answer: 'Per face corner',
      hints: ['A seam vertex has two.', 'Cell 1.'],
      reviewSection: 'Intuition',
    },
    {
      id: 'modelling-geometry-6-005-quiz-2',
      type: 'choice',
      text: 'What does linear UV subdivision do where the surface moves?',
      options: ['The texture slides: UVs stay where the cage had them', 'Nothing visible', 'It follows exactly', 'It removes the seam'],
      answer: 'The texture slides: UVs stay where the cage had them',
      hints: ['Cell 2.', 'The picture.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-6-005-quiz-3',
      type: 'choice',
      text: 'On a flat grid with planar UVs, what do smooth UVs give after subdivision?',
      options: ['Exactly each new vertex\'s projection, inside the island', 'Approximately it everywhere', 'The old UVs', 'Midpoints only'],
      answer: 'Exactly each new vertex\'s projection, inside the island',
      hints: ['Affine reproduction.', 'Cell 2: inside the island, a slide of 0.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-6-005-quiz-4',
      type: 'choice',
      text: 'Why are island borders kept straight?',
      options: ['So both sides of a seam still match', 'To save time', 'Because borders cannot move', 'To make the island bigger'],
      answer: 'So both sides of a seam still match',
      hints: ['Cell 3.', 'Challenge 2.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-6-005-quiz-5',
      type: 'choice',
      text: 'MeshLab\'s sphere: mean distortion with linear and with smooth UVs?',
      options: ['1.49 and 1.32', '1.32 and 1.49', '1 and 1', '2 and 1'],
      answer: '1.49 and 1.32',
      hints: ['Smooth is lower.', 'The project\'s trace.'],
      reviewSection: 'Intuition',
    },
    {
      id: 'modelling-geometry-6-005-quiz-6',
      type: 'choice',
      text: 'A cube with every face its own island has how many UV vertices?',
      options: ['24', '8', '14', '6'],
      answer: '24',
      hints: ['No corners shared.', 'The challenge.'],
      reviewSection: 'Challenge',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'UVs move with the vertices automatically.',
      whyStudentsThinkIt: 'They are attached to the mesh.',
      correctionExample: 'Cell 2: linear UVs leave moved corners up to 0.06 behind.',
      contrastCase: 'Smooth UVs, subdivided with the surface\'s own rules, do follow it.',
    },
    {
      falseBelief: 'A vertex has one UV.',
      whyStudentsThinkIt: 'Positions are per vertex.',
      correctionExample: 'Cell 1: the seam vertices have u = 0 on one side and u = 1 on the other.',
      contrastCase: 'Away from seams, all corners of a vertex share one UV.',
    },
    {
      falseBelief: 'Smoothing everything, borders too, would be better.',
      whyStudentsThinkIt: 'Smooth is better inside.',
      correctionExample: 'Cell 3: smoothing the border pulls a bumpy island\'s outline in, which breaks seam matching.',
      contrastCase: 'Inside an island, smoothing is exactly right.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A painted face texture looks right on the cage but the eyes drift after subdivision.',
      competingTechniques: ['Repaint the texture on the subdivided mesh', 'Turn on smooth UVs (keep borders) in the modifier'],
      whyThisTechniqueWins: 'The drift is linear UVs sliding; smooth UVs move with the surface and keep the painting where it was placed.',
    },
    {
      situation: 'A tiling brick texture shows cracks along a seam after subdivision.',
      competingTechniques: ['Smooth the UV borders too', 'Keep borders linear'],
      whyThisTechniqueWins: 'Linear borders subdivide the seam identically on both sides, so the bricks stay aligned across it.',
    },
  ],

  debugging: [
    {
      commonError: 'Treating UVs as per-vertex.',
      symptom: 'A smeared stripe along every seam after subdivision.',
      whyItHappened: 'The two sides of the seam were averaged together.',
      repairStrategy: 'Key UV vertices by (vertex, UV) so seams stay borders.',
    },
    {
      commonError: 'Smoothing island borders.',
      symptom: 'Islands shrink; texture cracks along seams.',
      whyItHappened: 'Each side of the seam moved by its own rule.',
      repairStrategy: 'Keep border vertices fixed and use midpoints on border edges.',
    },
    {
      commonError: 'Using linear UVs on a curvy model.',
      symptom: 'Checks stretch near poles and corners.',
      whyItHappened: 'The surface moved; the UVs did not.',
      repairStrategy: 'Use smooth UV subdivision.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Count UV vertices, and subdivide UVs linearly or smoothly with kept borders.',
    explainVerbally: 'Explain seams as UV borders, why linear UVs slide, and why borders are kept.',
    detectIncorrectApplication: 'Recognise per-vertex UV smearing, shrinking islands and sliding textures.',
    transferToUnfamiliar: 'Choose the UV subdivision rule for a textured, subdivided model.',
  },
};
