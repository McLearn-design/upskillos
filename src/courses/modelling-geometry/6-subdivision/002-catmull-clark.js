// Lesson 6.2: Catmull–Clark. One step: a face point at each face's centre, an edge point averaging each edge's ends
// and its two face points, and each old vertex moved to (F̄ + 2R̄ + (n − 3)V) / n; every face becomes one quad per
// corner. On a regular grid it is the cubic B-spline rule of lesson 6.1 in both directions; the limit surface is smooth.
import { withPicture } from '../notebookScene.js';

const CUBE = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const f3 = (v) => '(' + v.map(r).join(', ') + ')'
const add = (a, b) => a.map((x, i) => x + b[i]), mul = (a, s) => a.map((x) => x * s)
const avg = (ps) => mul(ps.reduce(add), 1 / ps.length)
const key = (a, b) => a < b ? a + '-' + b : b + '-' + a
// A cube 2 wide: corners at ±1, faces wound outward.
const cubeV = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]
const cubeF = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [0, 4, 7, 3], [1, 2, 6, 5]]
// One Catmull–Clark step on a closed mesh, using an edge table (lesson 1.3) to find each edge's two faces.
function catmullClark(V, F) {
  const facePts = F.map((f) => avg(f.map((v) => V[v])))
  const edges = new Map()
  F.forEach((f, fi) => f.forEach((a, i) => { const b = f[(i + 1) % f.length], k = key(a, b); if (!edges.has(k)) edges.set(k, { a, b, faces: [] }); edges.get(k).faces.push(fi) }))
  const edgeIndex = new Map(), edgePts = []
  for (const [k, e] of edges) { edgeIndex.set(k, edgePts.length); edgePts.push(avg([V[e.a], V[e.b], ...e.faces.map((fi) => facePts[fi])])) }
  const moved = V.map((P, v) => {
    const fs = F.map((f, fi) => f.includes(v) ? fi : -1).filter((fi) => fi >= 0)
    const es = [...edges.values()].filter((e) => e.a === v || e.b === v)
    const n = es.length
    const Fbar = avg(fs.map((fi) => facePts[fi])), Rbar = avg(es.map((e) => avg([V[e.a], V[e.b]])))
    return mul(add(add(Fbar, mul(Rbar, 2)), mul(P, n - 3)), 1 / n)
  })
  // New vertices: moved old ones, then face points, then edge points. Each face corner becomes a quad.
  const nv = V.length, nf = F.length, out = [...moved, ...facePts, ...edgePts], quads = []
  F.forEach((f, fi) => f.forEach((v, i) => {
    const prev = f[(i + f.length - 1) % f.length], next = f[(i + 1) % f.length]
    quads.push([v, nv + nf + edgeIndex.get(key(v, next)), nv + fi, nv + nf + edgeIndex.get(key(prev, v))])
  }))
  return { V: out, F: quads, facePts, edgePts, edgeIndex, moved }
}
`;

const FACE_EDGE = `${CUBE}
const s = catmullClark(cubeV, cubeF)
// Predict first: the top face's point, and the edge point on the edge from (1, 1, 1) to (1, 1, -1).
console.log('top face (y = 1): face point ' + f3(s.facePts[3]))
console.log('edge (1, 1, 1)–(1, 1, -1): edge point ' + f3(s.edgePts[s.edgeIndex.get(key(6, 2))]) + ' = (a + b + top + right) / 4')`;

const VERTEX = `${CUBE}
const s = catmullClark(cubeV, cubeF)
// The corner (1, 1, 1) has n = 3 edges. F̄: the average of its 3 face points. R̄: the average of its 3 edge midpoints.
// Predict first: where does the corner move?
const Fbar = avg([[1, 0, 0], [0, 1, 0], [0, 0, 1]]), Rbar = avg([[1, 1, 0], [1, 0, 1], [0, 1, 1]])
console.log('F̄ = ' + f3(Fbar) + ', R̄ = ' + f3(Rbar) + ', n = 3')
console.log('V′ = (F̄ + 2R̄ + 0·V) / 3 = ' + f3(s.moved[6]))
// The weights 1, 2 and n − 3, over n, add up to 1 for every n: the rule moves with the mesh.
for (const n of [3, 4, 5, 6]) console.log('n = ' + n + ': weights 1/' + n + ', 2/' + n + ', ' + (n - 3) + '/' + n + ', total ' + r((1 + 2 + n - 3) / n))`;

const LEVELS = `${CUBE}
// Subdivide again and again. Predict first: after one step, how many vertices and faces? (V + E + F, and 4 per quad.)
let V = cubeV, F = cubeF
for (let level = 1; level <= 4; level++) {
  ;({ V, F } = catmullClark(V, F))
  const corner = V[6], radius = (p) => Math.hypot(...p)
  console.log('level ' + level + ': ' + V.length + ' vertices, ' + F.length + ' faces; the old corner at ' + f3(corner) + ', ' + r(radius(corner)) + ' from the centre; the highest point ' + r(Math.max(...V.map((p) => Math.abs(p[1])))) + ' high')
}`;

const GRID = `${CUBE}
// A regular vertex (n = 4) on a grid, with its 8 neighbours, heights h. The rule (F̄ + 2R̄ + V) / 4 works out to
// the cubic B-spline mask of lesson 6.1 in both directions: (1, 6, 1)/8 times (1, 6, 1)/8.
const h = [[0.3, -0.2, 0.5], [0.1, 1, -0.4], [0.2, 0.6, 0.0]]   // h[i][j], the centre is h[1][1]
const faceAvg = (i, j) => (h[i][j] + h[i + 1][j] + h[i][j + 1] + h[i + 1][j + 1]) / 4
const Fbar = (faceAvg(0, 0) + faceAvg(0, 1) + faceAvg(1, 0) + faceAvg(1, 1)) / 4
const Rbar = ((h[1][1] + h[0][1]) / 2 + (h[1][1] + h[2][1]) / 2 + (h[1][1] + h[1][0]) / 2 + (h[1][1] + h[1][2]) / 2) / 4
console.log('Catmull–Clark:   ' + r((Fbar + 2 * Rbar + h[1][1]) / 4))
const w = [1, 6, 1].map((x) => x / 8)
console.log('cubic ⊗ cubic:   ' + r(w.reduce((s, wi, i) => s + w.reduce((t, wj, j) => t + wi * wj * h[i][j], 0), 0)))`;

const PICTURE = withPicture(`${CUBE}
// The cube, and the cube subdivided 1, 2 and 3 times, side by side, smooth shaded (one normal per vertex).
const verts = [], faces = [], groups = [], shading = []
let V = cubeV, F = cubeF
for (let level = 0; level <= 3; level++) {
  if (level) ({ V, F } = catmullClark(V, F))
  const base = verts.length, dx = -4.5 + 3 * level
  V.forEach((p) => verts.push([p[0] + dx, p[1], p[2]]))
  // Vertex normals: the sum of the face normals round each vertex (lesson 3.5).
  const vn = V.map(() => [0, 0, 0])
  F.forEach((f) => { const [a, b, c] = f.map((v) => V[v]); const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; f.forEach((v) => { vn[v] = add(vn[v], n) }) })
  F.forEach((f) => { faces.push(f.map((v) => v + base)); groups.push(level); shading.push(f.map((v) => { const l = Math.hypot(...vn[v]); return vn[v].map((x) => x / l) })) })
}
console.log('levels 0 to 3: ' + [6, 24, 96, 384].join(', ') + ' faces')
show({ verts, faces, groups, shading, zoom: 1.7 })`);

const CHALLENGE = `// A flat grid of unit squares at height 0, with one vertex raised to (0, 1, 0). Its four neighbours along the
// edges and the four diagonal ones all stay at height 0. One Catmull–Clark step: how high is the raised vertex now?
const height = 0
console.log(height)`;

const SOLVED = CHALLENGE.replace('const height = 0', 'const height = 0.5625');

/** The challenge's check: F̄ = 1/4, R̄ = 1/2, V = 1, n = 4: (1/4 + 1 + 1) / 4 = 0.5625. */
export function checkBump(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+height\s*=\s*(-?\d*\.?\d+(?:\s*\/\s*\d+)?)/);
  if (!m) return no('Keep the line const height = …, with a number (or a fraction like 9 / 16).');
  const parts = m[1].split('/').map((x) => Number(x.trim()));
  const v = parts.length === 2 ? parts[0] / parts[1] : parts[0];
  if (Math.abs(v - 0.5625) < 1e-6) return { pass: true, message: '0.5625 = 9/16. Each face point is 1/4 high (one raised corner of four), so F̄ = 1/4; each edge midpoint is 1/2 high, so R̄ = 1/2; with n = 4: (1/4 + 2 · 1/2 + 1 · 1) / 4 = 9/16. The bump spreads out and lowers, but less than plain averaging would (lesson 5.6).' };
  if (v === 0) return no('Work out F̄ (the face points round the vertex), R̄ (the edge midpoints) and use (F̄ + 2R̄ + (n − 3)V) / n with n = 4.');
  if (Math.abs(v - 0.25) < 1e-6) return no('0.25 is F̄, the face points\' average. The rule also adds 2R̄ and (n − 3)V, then divides by n.');
  if (Math.abs(v - 0.5) < 1e-6) return no('0.5 is R̄, the edge midpoints\' average, or plain smoothing with λ = 0.5. Catmull–Clark weighs the face points, the edge midpoints and the vertex itself.');
  if (Math.abs(v - 1) < 1e-6) return no('Catmull–Clark moves every old vertex, not only the new ones: approximating, like Chaikin.');
  if (Math.abs(v - 0.4375) < 1e-6) return no('That uses (n − 3) = 0. Here n = 4, so the vertex itself counts once: + 1 · V.');
  return no(`${v} is not (F̄ + 2R̄ + V) / 4 with F̄ = 1/4, R̄ = 1/2 and V = 1.`);
}

export default {
  id: 'modelling-geometry-6-002',
  slug: 'catmull-clark',
  chapter: 'modelling-geometry',
  order: 2,
  title: 'Catmull–Clark',
  subtitle: 'Face points, edge points and moved vertices: one step of the subdivision that smooths every character in film.',
  tags: ['subdivision', 'catmull-clark', 'b-spline', 'smooth surfaces', 'edge table', 'modelling'],
  coreConcept: 'One Catmull–Clark step adds a face point at the centre of each face, an edge point at the average of each edge\'s two ends and its two face points, and moves each old vertex of valence n to (F̄ + 2R̄ + (n − 3)V) / n, where F̄ averages the face points round it and R̄ the midpoints of its edges. Each face of k corners becomes k quads, so after one step the mesh is all quads, with V + E + F vertices. The weights add up to 1, so the rule moves with the mesh; on a regular grid it is the cubic B-spline rule of lesson 6.1 in both directions, and the surfaces it converges to are smooth.',
  prerequisites: ['modelling-geometry-6-001', 'modelling-geometry-1-003'],
  timeToComplete: 45,
  nextLesson: 'modelling-geometry-6-003',

  hook: {
    question: 'Press Subdivide smooth on a cube and it becomes a rounded blob made of 24 quads; again, 96; again, 384, rounder each time. Where does each new vertex go, and why does a cube turn into something like a sphere rather than staying a box?',
    realWorldContext: 'Catmull and Clark published the rules in 1978; Pixar made them practical and won a Scientific and Technical Academy Award for it. Every Subdivision Surface modifier in Blender, Maya and Houdini, and OpenSubdiv on the GPU, implements exactly this step.',
  },

  intuition: {
    prose: [
      'Lesson 6.1 cut corners off a curve. Catmull–Clark does the same to a surface with three kinds of new point. A **face point** is the centre of a face: the average of its corners. Before running cell 1, predict: on a cube with corners at $\\pm 1$, where is the top face\'s point? $(0, 1, 0)$.',
      'An **edge point** averages four things: the edge\'s two ends and the face points on either side. The edge from $(1, 1, 1)$ to $(1, 1, -1)$ lies between the top face, $(0, 1, 0)$, and the right face, $(1, 0, 0)$: $\\big((1,1,1) + (1,1,-1) + (0,1,0) + (1,0,0)\\big) / 4 = (0.75, 0.75, 0)$. Finding the two faces beside an edge is what the edge table of lesson 1.3 is for.',
      'Then every **old vertex moves**. With $n$ edges at it, $\\bar{F}$ the average of the face points round it and $\\bar{R}$ the average of its edges\' midpoints, $V\' = (\\bar{F} + 2\\bar{R} + (n - 3)V)/n$. Before running cell 2, predict: the corner $(1, 1, 1)$, with $n = 3$. $\\bar{F} = (\\tfrac13, \\tfrac13, \\tfrac13)$, $\\bar{R} = (\\tfrac23, \\tfrac23, \\tfrac23)$, so $V\' = (\\tfrac59, \\tfrac59, \\tfrac59)$: pulled well in.',
      'Finally the faces: each corner of each face becomes a quad, joining the moved vertex, the edge point after it, the face point, and the edge point before it. A face with $k$ corners gives $k$ quads, so after one step everything is quads, and the mesh has $V + E + F$ vertices: $8 + 12 + 6 = 26$ for the cube, with $24$ faces (cell 3).',
      'Why these weights? They add to $1$ for every $n$ ($\\tfrac1n + \\tfrac2n + \\tfrac{n - 3}{n}$), so the result moves with the mesh. And on a regular grid ($n = 4$) the rule is exactly the cubic B-spline rule of lesson 6.1 applied in both directions (cell 4): between the old grid lines the surface is made of bicubic pieces, smooth to second order.',
      'So a cube does not stay a box. Its corners are pulled in, to $0.556$ at level 1 and settling near $(0.5, 0.5, 0.5)$; the middles of its faces sink too, more slowly, from $1$ to $0.88$, $0.85$, $0.84$ (cell 3). The limit is a rounded, almost spherical shape. Approximating, like Chaikin: the surface never passes through the cage\'s corners.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: One Catmull–Clark step',
        body: 'Step 1. Face points: Fᵢ = the average of face i\'s corners.\nStep 2. Edge points: for an edge a–b between faces F₁ and F₂, E = (a + b + F₁ + F₂) / 4 (on an open border: the midpoint).\nStep 3. Vertex points: for a vertex V with n edges, V′ = (F̄ + 2R̄ + (n − 3)V) / n, F̄ the average of its face points, R̄ of its edge midpoints (on a border: ¾V + ⅛(b₁ + b₂), lesson 6.1\'s cubic rule).\nStep 4. Each corner v of each face becomes the quad [v′, the edge point after v, the face point, the edge point before v].',
      },
      {
        type: 'warning',
        title: 'Compute from the old positions',
        body: 'Edge points use the face points, and vertex points use both, but always from the old mesh: moving a vertex before computing its neighbours\' points changes their result. Compute everything first, then build the new mesh.',
      },
      {
        type: 'warning',
        title: 'Each level is four times the faces',
        body: 'A 96-face model at level 3 is 6144 faces; at level 5, nearly 100 000. Keep the modifier\'s viewport level low and raise it for the final render.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: the smooth-shaded result',
        body: 'Subdivision gives the renderer many small faces whose normals turn gradually, so smooth shading (lesson 3.5) has little to interpolate across each face and highlights glide without facets. The limit surface itself has continuous normals everywhere, and continuous curvature except at extraordinary vertices (lesson 6.3).',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "subdivision adds detail to the shape you made". The cube (left) is not kept: its corners are pulled in at every level, and the shape converges to a rounded blob. Subdivision smooths; detail must be in the cage.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'catmullClark() in the cells is the procedure: facePts is Step 1, the edges map and edgePts Step 2, moved Step 3, and quads Step 4.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Film renderers evaluate the limit surface directly; games and viewports subdivide a few levels on the CPU or in a compute shader (OpenSubdiv) and draw the triangles. MeshLab subdivides on the CPU.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Mesh › Subdivide smooth applies one step; the Subdivision modifier applies several without changing the cage. With Record traces on, every face point, edge point and moved vertex is a step you can predict. Scripts call mesh.subdivide(levels).' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: Catmull–Clark',
        caption: 'Face and edge points, moved vertices, levels, the regular case, and a cube subdivided three times.',
        props: {
          lesson: {
            title: 'Catmull–Clark',
            subtitle: 'Face points, edge points, vertex points.',
            cells: [
              { type: 'js', instruction: '### 1. Face and edge points\nPredict first: the top face\'s point, and one edge\'s point.', startCode: FACE_EDGE },
              { type: 'js', instruction: '### 2. Moving the old vertices\nPredict first: where does the corner (1, 1, 1) go?', startCode: VERTEX },
              { type: 'js', instruction: '### 3. Level after level\nPredict first: vertices and faces after one step.', startCode: LEVELS },
              { type: 'js', instruction: '### 4. The regular case\nOn a grid, the rule is the cubic B-spline in both directions.', startCode: GRID },
              { type: 'js', instruction: '### 5. See it\nThe cube and three levels of subdivision, smooth shaded. Drag to turn.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 340 },
              { type: 'challenge', instruction: '### 6. Challenge: a bump\nThe height of a raised vertex after one step. The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkBump },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Predict Catmull–Clark" in MeshLab](#/lab/mesh-lab?project=predict-catmull-clark). A cube is subdivided with **Record traces** on: press Play and predict each face point, edge point and moved vertex before the trace shows it.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Mesh › Subdivide smooth:** one Catmull–Clark step on the mesh.\n- **Inspector › Modifiers › Subdivision:** levels without changing the cage (lesson 5.7).\n- In a script: `mesh.subdivide(2)`.\n- [Open "Box-modelled character" in MeshLab](#/lab/mesh-lab?project=character-model): a 32-face cage, subdivided twice.\n- **In Blender:** the Subdivision Surface modifier (Ctrl+1, 2, 3 for levels), or Subdivide with Smoothness 1 in edit mode.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**The rules.** For a closed mesh: $F_f = \\tfrac{1}{k}\\sum_{v \\in f} v$; $E_{ab} = \\tfrac14(a + b + F_1 + F_2)$; $V\' = \\tfrac1n\\big(\\bar{F} + 2\\bar{R} + (n - 3)V\\big)$. Each is a weighted average with weights summing to $1$, so the step commutes with every affine map: subdivide-then-move equals move-then-subdivide.',
      '**Counts.** Every old vertex, edge and face gives one new vertex: $V\' = V + E + F$. Each face of $k$ corners gives $k$ quads; on a quad mesh $F\' = 4F$ and $E\' = 2E + 4F$, so $V\' - E\' + F\' = V - E + F$: the topology is unchanged (lesson 5.9).',
      '**The regular case.** At a vertex with four quads round it, expanding $\\bar{F}$ and $\\bar{R}$ in terms of the 3 × 3 block of grid points gives the weights $\\tfrac1{64}\\begin{pmatrix}1 & 6 & 1\\end{pmatrix}^{\\mathrm{T}}\\begin{pmatrix}1 & 6 & 1\\end{pmatrix}$: the tensor product of the cubic B-spline vertex rule. Edge and face points likewise match. So away from extraordinary vertices the limit surface is a uniform bicubic B-spline: $C^2$.',
      '**Convergence.** Each step changes positions by a fraction of the previous change, so the meshes converge to a limit surface. Near a vertex with $n \\neq 4$ the limit is still $C^1$ (tangent plane continuous) but not $C^2$: lesson 6.3.',
    ],
    equations: [
      { label: 'Face point', latex: 'F = \\frac{1}{k}\\sum_{v \\in f} v' },
      { label: 'Edge point', latex: 'E = \\frac{a + b + F_1 + F_2}{4}' },
      { label: 'Vertex point', latex: "V' = \\frac{\\bar{F} + 2\\bar{R} + (n - 3)\\,V}{n}" },
      { label: 'Counts', latex: "V' = V + E + F, \\quad F' = \\sum_f k_f" },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** Catmull–Clark subdivision is a stationary linear scheme on arbitrary polygon meshes; after one step the mesh is all quads; on regular regions the limit is the uniform bicubic B-spline surface of the control net, and the limit surface is $C^1$ at extraordinary vertices (Peters & Reif).',
      '**Invariant viewpoint.** The scheme depends only on connectivity and positions, commutes with affine maps and preserves symmetry: a symmetric cage gives a symmetric surface, which is why a mirror and subdivision combine cleanly (lesson 5.7).',
      '**Geometric picture.** Each step relaxes every point towards a weighted neighbourhood average, like lesson 5.6\'s smoothing, but also adds points, so the surface converges instead of shrinking away.',
      '**Where this goes.** Lesson 6.3 looks at what happens near poles and at the limit positions; 6.4 at keeping edges sharp; 6.5 at what subdivision does to UVs.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-6-002-ex1',
      title: 'A face point',
      problem: 'A quad has corners $(0, 0, 0)$, $(2, 0, 0)$, $(2, 2, 0)$, $(0, 2, 1)$. Its face point?',
      steps: [{ expression: '\\tfrac14(4, 4, 1) = (1, 1, 0.25)', annotation: 'The average of the corners.' }],
      conclusion: '(1, 1, 0.25).',
    },
    {
      id: 'modelling-geometry-6-002-ex2',
      title: 'Counts after one step',
      problem: 'A mesh has 10 vertices, 18 edges, 10 faces (all quads). After one step?',
      steps: [
        { expression: "V' = 10 + 18 + 10 = 38", annotation: 'One per old vertex, edge and face.' },
        { expression: "F' = 4 \\times 10 = 40", annotation: '4 quads per quad.' },
        { expression: "E' = 2 \\times 18 + 4 \\times 10 = 76", annotation: 'Each edge split, 4 new per face.' },
      ],
      conclusion: '38 vertices, 76 edges, 40 faces; V − E + F = 2, as before.',
    },
    {
      id: 'modelling-geometry-6-002-ex3',
      title: 'A vertex with five edges',
      problem: 'A vertex at the origin has $n = 5$, $\\bar{F} = (0, 0.4, 0)$, $\\bar{R} = (0, 0.6, 0)$. Where does it go?',
      steps: [
        { expression: "V' = \\tfrac15\\big((0, 0.4, 0) + 2(0, 0.6, 0) + 2(0, 0, 0)\\big)", annotation: 'n − 3 = 2.' },
        { expression: '= (0, 0.32, 0)', annotation: '1.6 / 5.' },
      ],
      conclusion: '(0, 0.32, 0).',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-6-002-ch1',
      difficulty: 'easy',
      problem: 'Why is every face a quad after one Catmull–Clark step?',
      walkthrough: [{ expression: '\\text{each corner becomes [vertex, edge pt, face pt, edge pt]}', annotation: 'Four points, whatever the face had.' }],
      answer: 'Each corner of each face becomes one new face made of four points: the moved vertex, the two edge points beside it, and the face point. So triangles, quads and n-gons alike turn into quads.',
    },
    {
      id: 'modelling-geometry-6-002-ch2',
      difficulty: 'medium',
      problem: 'Show that the vertex rule\'s weights add up to 1 for any n, and say why that matters.',
      walkthrough: [
        { expression: '\\tfrac1n + \\tfrac2n + \\tfrac{n-3}{n} = \\tfrac{n}{n} = 1', annotation: 'Each of F̄ and R̄ is itself an average.' },
        { expression: '\\text{so the rule is an affine combination}', annotation: 'It moves with the mesh.' },
      ],
      answer: 'F̄ and R̄ are averages (weights summing to 1), and 1/n + 2/n + (n − 3)/n = 1, so V′ is an affine combination of old points: translating, rotating or scaling the cage moves the result in exactly the same way.',
    },
    {
      id: 'modelling-geometry-6-002-ch3',
      difficulty: 'hard',
      problem: 'Check cell 4\'s claim: at a regular vertex, (F̄ + 2R̄ + V) / 4 equals the mask (1, 6, 1) ⊗ (1, 6, 1) / 64. Find the weight on the centre.',
      walkthrough: [
        { expression: '\\bar{F}: \\text{the centre is in all 4 faces, weight } \\tfrac14 \\text{ each} \\Rightarrow \\tfrac14', annotation: 'Each face average gives it 1/4; averaged over 4 faces, still 1/4.' },
        { expression: '\\bar{R}: \\text{the centre is in all 4 edges, weight } \\tfrac12 \\Rightarrow \\tfrac12', annotation: 'Each midpoint gives it 1/2.' },
        { expression: '\\tfrac14\\big(\\tfrac14 + 2 \\cdot \\tfrac12 + 1\\big) = \\tfrac{9}{16} = \\tfrac{36}{64}', annotation: 'And 6 × 6 / 64 = 36/64.' },
      ],
      answer: 'The centre gets (1/4 + 2 · 1/2 + 1) / 4 = 9/16 = 36/64, which is the middle of the (1, 6, 1) ⊗ (1, 6, 1) / 64 mask (6 × 6 = 36); the other weights match the same way.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'F', meaning: 'A face point: the average of a face\'s corners.' },
      { symbol: 'E', meaning: 'An edge point: (a + b + F₁ + F₂) / 4.' },
      { symbol: "V'", meaning: 'The moved old vertex: (F̄ + 2R̄ + (n − 3)V) / n.' },
      { symbol: 'n', meaning: 'The valence: the number of edges at the vertex.' },
      { symbol: '\\bar{F}, \\bar{R}', meaning: 'The averages of the face points round a vertex and of its edges\' midpoints.' },
      { symbol: '\\text{limit surface}', meaning: 'What repeated steps converge to; bicubic B-spline on regular regions.' },
    ],
    rulesOfThumb: [
      'Face points, then edge points, then move the vertices, all from the old mesh.',
      'After one step, all quads.',
      'Faces ×4 per level.',
      'Corners pull in: subdivision smooths and shrinks a box.',
      'On a regular grid it is the cubic B-spline.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-6-001', label: 'Corner cutting', note: 'The curve version; the cubic rule is Catmull–Clark on a border and on a grid.' },
      { lessonId: 'modelling-geometry-1-003', label: 'Edges and neighbours', note: 'The edge table that finds each edge\'s two faces.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-6-003', label: 'Extraordinary vertices and limits', note: 'What happens where n ≠ 4.' },
      { lessonId: 'modelling-geometry-6-004', label: 'Keeping edges sharp', note: 'Support loops against the rounding.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-6-002-1', label: 'Read the face, edge and vertex point rules', type: 'read' },
    { id: 'cp-modelling-geometry-6-002-2', label: 'Read how the new quads are made and counted', type: 'read' },
    { id: 'cp-modelling-geometry-6-002-3', label: 'Read why the rule is the cubic B-spline on a grid', type: 'read' },
    { id: 'cp-modelling-geometry-6-002-4', label: 'Run cells 1 to 4: points, moved vertex, levels, the regular case', type: 'lab' },
    { id: 'cp-modelling-geometry-6-002-5', label: 'Predict every point of a subdivided cube in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-6-002-6', label: 'Work through example 2, counts after one step', type: 'example' },
    { id: 'cp-modelling-geometry-6-002-7', label: 'Work through example 3, a vertex with five edges', type: 'example' },
    { id: 'cp-modelling-geometry-6-002-8', label: 'Complete the challenge: a bump', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-6-002-assess-1',
        type: 'choice',
        text: 'An edge from (0, 0, 0) to (2, 0, 0) lies between faces whose points are (1, 1, 0) and (1, -1, 0). Its edge point?',
        options: ['(1, 0, 0)', '(1, 0.5, 0)', '(0.5, 0, 0)', '(2, 0, 0)'],
        answer: '(1, 0, 0)',
        hint: '((0,0,0) + (2,0,0) + (1,1,0) + (1,−1,0)) / 4.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-6-002-quiz-1',
      type: 'choice',
      text: 'Where does the cube corner (1, 1, 1) go after one step?',
      options: ['(0.556, 0.556, 0.556)', '(1, 1, 1)', '(0.667, 0.667, 0.667)', '(0.333, 0.333, 0.333)'],
      answer: '(0.556, 0.556, 0.556)',
      hints: ['(F̄ + 2R̄) / 3.', 'Cell 2.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-6-002-quiz-2',
      type: 'choice',
      text: 'How many vertices does a cube have after one step?',
      options: ['26', '24', '32', '14'],
      answer: '26',
      hints: ['V + E + F.', 'Cell 3.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-6-002-quiz-3',
      type: 'choice',
      text: 'What does a triangle become after one step?',
      options: ['Three quads', 'Four triangles', 'One quad', 'Three triangles'],
      answer: 'Three quads',
      hints: ['One quad per corner.', 'Challenge 1.'],
      reviewSection: 'Procedure, Step 4',
    },
    {
      id: 'modelling-geometry-6-002-quiz-4',
      type: 'choice',
      text: 'Which two faces does an edge point use?',
      options: ['The two faces on either side of the edge', 'The two largest faces', 'All faces at its ends', 'None'],
      answer: 'The two faces on either side of the edge',
      hints: ['The edge table.', 'Cell 1.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-6-002-quiz-5',
      type: 'choice',
      text: 'On a regular grid, what is the Catmull–Clark vertex rule?',
      options: ['The cubic B-spline rule in both directions', 'Chaikin in both directions', 'A plain average', 'No change'],
      answer: 'The cubic B-spline rule in both directions',
      hints: ['Cell 4.', 'Challenge 3.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-6-002-quiz-6',
      type: 'choice',
      text: 'Does the subdivided cube pass through the cage\'s corners?',
      options: ['No: the corners are pulled in', 'Yes, always', 'Only at level 1', 'Only with smooth shading'],
      answer: 'No: the corners are pulled in',
      hints: ['Approximating.', 'The picture.'],
      reviewSection: 'Cell 5',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'Subdivision keeps the original vertices where they are and adds points between.',
      whyStudentsThinkIt: 'Simple subdivision (splitting faces) does.',
      correctionExample: 'Cell 2: the corner (1, 1, 1) moves to (0.556, 0.556, 0.556).',
      contrastCase: 'Mesh › Split faces (no smoothing) does keep them; it changes no shape.',
    },
    {
      falseBelief: 'Subdivision adds detail.',
      whyStudentsThinkIt: 'There are more faces.',
      correctionExample: 'The picture: the cube becomes a smooth blob; no new features appear.',
      contrastCase: 'Detail comes from moving cage vertices or from sculpting the subdivided mesh.',
    },
    {
      falseBelief: 'The edge point is the midpoint of the edge.',
      whyStudentsThinkIt: 'For splitting, it is.',
      correctionExample: 'Cell 1: the edge from (1, 1, 1) to (1, 1, −1) gets (0.75, 0.75, 0), not (1, 1, 0).',
      contrastCase: 'On an open border Catmull–Clark does use the midpoint.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A game needs a smooth head that can be drawn at several levels of detail.',
      competingTechniques: ['Model three heads at three resolutions', 'One cage, subdivided 0, 1 or 2 levels'],
      whyThisTechniqueWins: 'Every level comes from the same cage by the same rule, so they match exactly and only the cage needs editing.',
    },
    {
      situation: 'Your subdivided model has a lump you did not model.',
      competingTechniques: ['Smooth the subdivided mesh', 'Find the cage vertex that causes it and move it'],
      whyThisTechniqueWins: 'Every subdivided point is an average of nearby cage points; fixing the cage fixes every level.',
    },
  ],

  debugging: [
    {
      commonError: 'Moving old vertices before computing edge points.',
      symptom: 'An asymmetric, lumpy result from a symmetric cage.',
      whyItHappened: 'Edge points used some moved and some unmoved positions.',
      repairStrategy: 'Compute all face, edge and vertex points from the old mesh, then build the new one.',
    },
    {
      commonError: 'Using the midpoint for interior edge points.',
      symptom: 'The surface does not smooth evenly; ridges remain along old edges.',
      whyItHappened: 'The face points were left out of the edge rule.',
      repairStrategy: 'E = (a + b + F₁ + F₂) / 4 for interior edges.',
    },
    {
      commonError: 'Getting the quad\'s corner order wrong.',
      symptom: 'Half the new faces face inward.',
      whyItHappened: 'The quad was built [v, prev edge, face, next edge] against the face\'s direction.',
      repairStrategy: 'Follow the face\'s own order: [v′, next edge point, face point, previous edge point].',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Compute face, edge and vertex points by hand and count a subdivided mesh.',
    explainVerbally: 'Explain the three rules, why the result is all quads, and why the rule is the cubic B-spline on a grid.',
    detectIncorrectApplication: 'Recognise in-place updates, midpoint edge points and flipped quads.',
    transferToUnfamiliar: 'Use cage editing and subdivision levels to control smooth surfaces.',
  },
};
