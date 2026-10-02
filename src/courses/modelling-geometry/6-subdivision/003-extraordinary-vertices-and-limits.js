// Lesson 6.3: extraordinary vertices and limits. Each level costs four times the faces. A vertex converges to a limit
// position given by a fixed mask; near a vertex with n ≠ 4 edges the ring round it shrinks by λ(n) per step instead
// of ½, so the quads there end up larger or smaller than their neighbours: the slight pinch modellers see at poles.
import { withPicture } from '../notebookScene.js';

// Catmull–Clark as in lesson 6.2 (with per-vertex face and edge lists, so it is fast enough for several levels).
const CC = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const f3 = (v) => '(' + v.map(r).join(', ') + ')'
const add = (a, b) => a.map((x, i) => x + b[i]), mul = (a, s) => a.map((x) => x * s)
const avg = (ps) => mul(ps.reduce(add), 1 / ps.length)
const key = (a, b) => a < b ? a + '-' + b : b + '-' + a
function catmullClark(V, F) {
  const facePts = F.map((f) => avg(f.map((v) => V[v])))
  const edges = new Map()
  F.forEach((f, fi) => f.forEach((a, i) => { const b = f[(i + 1) % f.length], k = key(a, b); if (!edges.has(k)) edges.set(k, { a, b, faces: [] }); edges.get(k).faces.push(fi) }))
  const edgeIndex = new Map(), edgePts = []
  for (const [k, e] of edges) { edgeIndex.set(k, edgePts.length); edgePts.push(avg([V[e.a], V[e.b], ...e.faces.map((fi) => facePts[fi])])) }
  const vf = V.map(() => []), ve = V.map(() => [])
  F.forEach((f, fi) => f.forEach((v) => vf[v].push(fi)))
  for (const e of edges.values()) { ve[e.a].push(e); ve[e.b].push(e) }
  const moved = V.map((P, v) => { const n = ve[v].length; return mul(add(add(avg(vf[v].map((fi) => facePts[fi])), mul(avg(ve[v].map((e) => avg([V[e.a], V[e.b]]))), 2)), mul(P, n - 3)), 1 / n) })
  const nv = V.length, nf = F.length, quads = []
  F.forEach((f, fi) => f.forEach((v, i) => { const prev = f[(i + f.length - 1) % f.length], next = f[(i + 1) % f.length]; quads.push([v, nv + nf + edgeIndex.get(key(v, next)), nv + fi, nv + nf + edgeIndex.get(key(prev, v))]) }))
  return { V: [...moved, ...facePts, ...edgePts], F: quads }
}
// A spinning top: two n-sided cones base to base. Vertex 0 is the tip, with n edges.
function top(n) {
  const V = [[0, 1.2, 0], [0, -1.2, 0]], F = []
  for (let k = 0; k < n; k++) V.push([Math.cos(2 * Math.PI * k / n), 0, Math.sin(2 * Math.PI * k / n)])
  for (let k = 0; k < n; k++) { F.push([0, 2 + (k + 1) % n, 2 + k]); F.push([1, 2 + k, 2 + (k + 1) % n]) }
  return { V, F }
}
// The average distance from vertex v to the vertices joined to it by an edge.
function ring({ V, F }, v) {
  const nb = new Set()
  for (const f of F) { const i = f.indexOf(v); if (i >= 0) { nb.add(f[(i + 1) % f.length]); nb.add(f[(i + f.length - 1) % f.length]) } }
  return [...nb].reduce((s, x) => s + Math.hypot(V[x][0] - V[v][0], V[x][1] - V[v][1], V[x][2] - V[v][2]), 0) / nb.size
}
// The limit position of v, once the faces round it are quads: (n² v + 4 Σ edge neighbours + Σ diagonal ones) / (n (n + 5)).
function limit({ V, F }, v) {
  const e = new Set(), d = new Set()
  for (const f of F) { const i = f.indexOf(v); if (i >= 0) { e.add(f[(i + 1) % 4]); e.add(f[(i + 3) % 4]); d.add(f[(i + 2) % 4]) } }
  const n = e.size, sum = (s) => [...s].reduce((t, x) => add(t, V[x]), [0, 0, 0])
  return mul(add(add(mul(V[v], n * n), mul(sum(e), 4)), sum(d)), 1 / (n * (n + 5)))
}
const lambda = (n) => (5 + Math.cos(2 * Math.PI / n) + Math.cos(Math.PI / n) * Math.sqrt(18 + 2 * Math.cos(2 * Math.PI / n))) / 16
`;

const COST = `// Every level makes four quads of each quad. A cage of 64 quads (the mirrored character of lesson 5.8):
let F = 64, V = 66
for (let level = 0; level <= 6; level++) {
  // Each vertex: 3 numbers of 4 bytes for its position, 3 for its normal. Each quad: 2 triangles of 3 indices.
  const bytes = V * 24 + F * 2 * 3 * 4
  console.log('level ' + level + ': ' + F.toLocaleString('en') + ' faces, ' + V.toLocaleString('en') + ' vertices, about ' + (bytes / 1024).toFixed(0) + ' KB on the GPU')
  const E = V + F - 2
  ;[V, F] = [V + E + F, 4 * F]
}`;

const LIMIT = `${CC}
// The cube's corner after one step (so all quads round it), its limit by the formula, and where it actually goes.
const cube = { V: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], F: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [0, 4, 7, 3], [1, 2, 6, 5]] }
let m = catmullClark(cube.V, cube.F)
// Predict first: after one step the corner is at (0.5556, 0.5556, 0.5556). Does it keep moving in? To where?
const lim = limit(m, 6)
console.log('after 1 step: ' + f3(m.V[6]) + '; its limit by the formula: ' + f3(lim))
for (let level = 2; level <= 5; level++) { m = catmullClark(m.V, m.F); console.log('after ' + level + ' steps: ' + f3(m.V[6]) + ', ' + r(Math.hypot(...m.V[6].map((x, k) => x - lim[k]))) + ' from the limit') }`;

const EIGEN = `${CC}
// How much the ring of edges round a spinning top's tip shrinks per step, for tips with n = 3, 4, 5, 6 and 8 edges.
// Predict first: for a regular vertex (n = 4) it halves. Faster or slower for n = 8?
for (const n of [3, 4, 5, 6, 8]) {
  let m = catmullClark(top(n).V, top(n).F), before = ring(m, 0), last = 0
  for (let level = 2; level <= 7; level++) { m = catmullClark(m.V, m.F); const now = ring(m, 0); last = now / before; before = now }
  console.log('n = ' + n + ': the ring shrinks × ' + r(last) + ' a step; λ(' + n + ') = ' + r(lambda(n)))
}`;

const STRETCH = `${CC}
// After k steps, the quads round a tip are (λ(n) / ½)^k times the size they would be at a regular vertex.
for (const n of [3, 5, 6, 8]) {
  const row = [1, 3, 5, 8].map((k) => r((lambda(n) / 0.5) ** k))
  console.log('n = ' + n + ': after 1, 3, 5, 8 steps the quads there are ' + row.join(', ') + ' × regular size')
}`;

const PICTURE = withPicture(`${CC}
// The 8-sided spinning top after three steps. Each face is shaded by its size: the brighter, the bigger.
let m = top(8)
for (let level = 0; level < 3; level++) m = catmullClark(m.V, m.F)
const area = (f) => { const [a, b, c, d] = f.map((v) => m.V[v]); const cr = (p, q, s) => { const u = p.map((x, i) => q[i] - x), w = p.map((x, i) => s[i] - x); return Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) / 2 }; return cr(a, b, c) + cr(a, c, d) }
const areas = m.F.map(area), most = Math.max(...areas)
console.log(m.F.length + ' quads; the biggest is ' + r(most / Math.min(...areas)) + ' times the smallest, and the biggest are round the tips')
show({ verts: m.V, faces: m.F, values: areas.map((a) => 0.15 + 0.85 * a / most), zoom: 1.2 })`);

const CHALLENGE = `// A vertex at the origin has n = 5 edges, all its faces quads. Its 5 edge neighbours add up to (0, 2, 0) and its 5
// diagonal neighbours to (0, 1.5, 0). Where is its limit position?
const limitPoint = [0, 0, 0]
console.log(limitPoint)`;

const SOLVED = CHALLENGE.replace('const limitPoint = [0, 0, 0]', 'const limitPoint = [0, 0.19, 0]');

/** The challenge's check: (25 · 0 + 4 (0, 2, 0) + (0, 1.5, 0)) / 50 = (0, 0.19, 0). */
export function checkLimit(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+limitPoint\s*=\s*\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]/);
  if (!m) return no('Keep the line const limitPoint = [x, y, z], with numbers.');
  const [x, y, z] = m.slice(1).map(Number);
  if (Math.abs(x) > 1e-6 || Math.abs(z) > 1e-6) return no('Everything here is on the y axis, so the limit is too: x = z = 0.');
  if (Math.abs(y - 0.19) < 1e-4) return { pass: true, message: '(0, 0.19, 0): (n² v + 4 Σ e + Σ f) / (n (n + 5)) = (25 · 0 + 4 · 2 + 1.5) / 50 = 9.5 / 50. The weights 25, 4 × 5 and 5 add up to 50, so it is an average.' };
  if (y === 0) return no('Use v∞ = (n² v + 4 Σ e + Σ f) / (n (n + 5)) with n = 5.');
  if (Math.abs(y - 9.5 / 36) < 1e-4) return no('36 is n (n + 5) for n = 4. Here n = 5: 5 × 10 = 50.');
  if (Math.abs(y - 3.5 / 50) < 1e-4) return no('The edge neighbours count 4 times each: 4 Σ e, not Σ e.');
  if (Math.abs(y - 9.5 / 25) < 1e-4) return no('Divide by n (n + 5) = 50, not n² = 25: the weights n², 4 per edge neighbour and 1 per diagonal one add up to 50.');
  return no(`y = ${y} is not (4 · 2 + 1.5) / 50.`);
}

export default {
  id: 'modelling-geometry-6-003',
  slug: 'extraordinary-vertices-and-limits',
  chapter: 'modelling-geometry',
  order: 3,
  title: 'Extraordinary vertices and limits',
  subtitle: 'What each level costs, where a vertex ends up after infinitely many steps, and why poles show.',
  tags: ['subdivision', 'limit surface', 'eigenvalues', 'extraordinary vertices', 'poles', 'level of detail'],
  coreConcept: 'Each Catmull–Clark level multiplies the faces by 4, so cost grows fast and a few levels are enough. Every vertex converges to a limit position, a fixed weighted average once the faces round it are quads: (n² v + 4 Σ edge neighbours + Σ diagonal neighbours) / (n (n + 5)). How fast the surface round a vertex settles depends on its valence: the ring of edges round it shrinks by the scheme\'s subdominant eigenvalue λ(n) each step, ½ for a regular vertex, about 0.41 at a 3-pole and 0.61 at an 8-pole. So quads near a high-valence pole stay larger than their neighbours, and the surface there is only tangent-continuous: the pinch and the highlight wobble modellers see.',
  prerequisites: ['modelling-geometry-6-002', 'modelling-geometry-5-009'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-6-004',

  hook: {
    question: 'Subdivide forever and every vertex settles somewhere. Can you say where without doing it? And why does the area round a pole always look a little different, however many levels you add?',
    realWorldContext: 'Renderers place the final surface exactly at the limit positions, and choose a subdivision level per object from its size on screen, because every level quadruples the work. The behaviour near poles is why studios have topology rules, and why the maths of subdivision (eigenvalues of the step) is part of every renderer\'s design.',
  },

  intuition: {
    prose: [
      '**Cost.** Every level makes four quads of each quad. Before running cell 1, predict: a 64-quad cage at level 5? $64 \\times 4^5 = 65\\,536$ faces. Level 6 is a quarter of a million. That is why a viewport shows level 1 or 2 and only the final render goes higher.',
      '**Limits.** Each step moves a vertex less than the one before, so it converges. Its limit can be computed directly: once the faces round it are quads, $v_\\infty = \\dfrac{n^2 v + 4\\sum e_j + \\sum f_j}{n(n + 5)}$, with $e_j$ its edge neighbours and $f_j$ the corners opposite it in each quad. Before running cell 2, predict: the cube\'s corner is at $0.5556$ after one step. Does it keep moving in? Yes, to $0.5$ in each coordinate, which the formula gives in one line.',
      'For a regular vertex the limit weights are $16, 4, 1$ over $36$: the bicubic B-spline\'s, as lesson 6.2 promised. Renderers move every vertex of the last level to its limit position so the surface is exactly right without more levels.',
      '**Near a pole.** Watch the ring of edges round a vertex as you subdivide. At a regular vertex it halves each step, like Chaikin\'s corners in lesson 6.1. Before running cell 3, predict: at a tip with 8 edges, faster or slower? Slower: $\\times 0.61$ a step. At a 3-pole, faster: $\\times 0.41$. These are $\\lambda(n)$, the second-largest eigenvalue of the step near that vertex.',
      'The difference compounds (cell 4): after five steps, the quads round an 8-pole are $(0.61 / 0.5)^5 \\approx 2.7$ times as large as they would be at a regular vertex, and round a 3-pole only $0.37$ times. The picture shows it: on the spinning top, the biggest quads crowd round the tips.',
      'This is the **pinch**. Near a regular vertex the limit surface is smooth to second order ($C^2$); near an extraordinary one it is only tangent-continuous ($C^1$): the normal is continuous, but curvature is not, and reflections there bend slightly. That is the real reason behind lesson 5.9\'s advice: place poles where the surface turns or where nobody looks closely.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: The limit position of a vertex',
        body: 'Step 1. Subdivide once if needed, so the faces round v are quads.\nStep 2. n = its valence; e₁ … eₙ its edge neighbours; f₁ … fₙ the corner opposite v in each quad.\nStep 3. v∞ = (n² v + 4 Σ eⱼ + Σ fⱼ) / (n (n + 5)).',
      },
      {
        type: 'procedure',
        title: 'Procedure: Choosing a subdivision level',
        body: 'Step 1. Estimate the faces: cage quads × 4^level.\nStep 2. Viewport: the lowest level that shows the shape (1 or 2).\nStep 3. Render: the level at which faces are about a pixel or two on screen; more is invisible.\nStep 4. For exact positions at a lower level, snap the last level\'s vertices to their limits.',
      },
      {
        type: 'warning',
        title: 'Levels quadruple',
        body: 'Raising a modifier from 3 to 5 levels multiplies faces by 16. A scene that ran smoothly can stall. Keep viewport levels low; MeshLab caps its evaluation for safety.',
      },
      {
        type: 'warning',
        title: 'More levels do not remove a pinch',
        body: 'The relative size of quads round a pole grows with every level ((λ/½)^k), and the limit surface there is still only C¹. Fix poles by moving them in the cage, not by subdividing more.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: pinching near poles',
        body: 'Shading depends on normals; near an extraordinary vertex the limit normals turn smoothly but their rate of turning (curvature) jumps, so a sharp highlight passing over a pole wobbles or kinks. Under flat studio lighting it is invisible; on chrome or a car body it is not. That is why hard-surface and automotive models route poles to edges and corners.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "subdivision makes all faces the same size". After three steps the spinning top\'s quads differ in size by a large factor, and the biggest (brightest) are round its two 8-edged tips, where the ring shrinks slowest.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'limit() in the cells is the limit procedure; ring() measures the ring round a vertex; lambda() is the closed form of λ(n), which cell 3 checks against measured ratios.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Hardware tessellation and OpenSubdiv evaluate limit positions and normals directly on the GPU, choosing a level per patch from its size on screen, so cost follows what is visible.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Mesh › Trace the limit position (one vertex) shows the neighbours, the limit (predict it), and the vertex approaching it over four more steps, with the ring\'s shrink ratio. Scripts call mesh.limit(v). The Subdivision modifier\'s Levels field sets the level.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: levels, limits and poles',
        caption: 'The cost of levels, limit positions, λ(n) measured, stretched quads near poles, and a spinning top shaded by face size.',
        props: {
          lesson: {
            title: 'Extraordinary vertices and limits',
            subtitle: 'Where subdivision converges, and how fast.',
            cells: [
              { type: 'js', instruction: '### 1. What levels cost\nPredict first: faces at level 5 from a 64-quad cage.', startCode: COST },
              { type: 'js', instruction: '### 2. Limit positions\nPredict first: where does the cube\'s corner end up?', startCode: LIMIT },
              { type: 'js', instruction: '### 3. How fast the ring shrinks\nPredict first: at an 8-edged tip, faster or slower than ½?', startCode: EIGEN },
              { type: 'js', instruction: '### 4. Stretched quads\nHow the difference compounds.', startCode: STRETCH },
              { type: 'js', instruction: '### 5. See it\nThe 8-sided spinning top after three steps, shaded by face size. Drag to turn.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 340 },
              { type: 'challenge', instruction: '### 6. Challenge: a limit position\nAt a vertex with five edges. The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkLimit },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Extraordinary vertices and limits" in MeshLab](#/lab/mesh-lab?project=limits). The spinning top\'s 8-edged tip is traced: press Play, predict its limit position, and watch it approach over four more steps. Then trace a regular vertex and compare the ring\'s ratio.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Mesh › Trace the limit position (one vertex):** neighbours, limit, convergence and λ.\n- **Inspector › Modifiers › Subdivision › Levels:** watch the face count quadruple in the status bar.\n- In a script: `mesh.limit(v)`.\n- **In Blender:** the Subdivision Surface modifier\'s Viewport and Render levels are separate for exactly this reason; "Use Limit Surface" places vertices at their limits.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**The local step.** Near a vertex of valence n, one Catmull–Clark step maps the positions of the vertex and its neighbourhood linearly to the next level\'s: $P\' = S_n P$. Repeating, $P^{(k)} = S_n^k P$. Write $P$ in $S_n$\'s eigenvectors: the eigenvalue $1$ gives the limit position (its left eigenvector is the limit mask), and the next ones, $\\lambda(n)$, set how fast the neighbourhood shrinks onto it.',
      '**The subdominant eigenvalue.** $\\lambda(n) = \\dfrac{5 + \\cos\\frac{2\\pi}{n} + \\cos\\frac{\\pi}{n}\\sqrt{18 + 2\\cos\\frac{2\\pi}{n}}}{16}$: $0.410$ for $n = 3$, $\\tfrac12$ for $n = 4$, $0.550$ for $n = 5$, $0.611$ for $n = 8$. Cell 3 measures it directly.',
      '**Smoothness.** For the limit surface to have a tangent plane, the two subdominant eigenvalues must be equal and larger than all the rest (they are, for Catmull–Clark), and the characteristic map they define must be regular. Then the surface is $C^1$ at the vertex. $C^2$ needs $\\lambda^2$ to equal the next eigenvalue, which holds only at $n = 4$.',
      '**Limit mask.** The left eigenvector for eigenvalue $1$, normalised, gives the weights $n^2$ on $v$, $4$ on each edge neighbour and $1$ on each diagonal neighbour, over $n(n + 5)$. Since $S_n$ preserves affine combinations, these weights sum to $1$.',
    ],
    equations: [
      { label: 'Limit position', latex: 'v_\\infty = \\frac{n^2 v + 4\\sum_j e_j + \\sum_j f_j}{n(n + 5)}' },
      { label: 'Subdominant eigenvalue', latex: '\\lambda(n) = \\frac{5 + \\cos\\frac{2\\pi}{n} + \\cos\\frac{\\pi}{n}\\sqrt{18 + 2\\cos\\frac{2\\pi}{n}}}{16}' },
      { label: 'Cost', latex: 'F_k = F_0 \\cdot 4^k' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** For Catmull–Clark at an interior vertex of valence $n \\ge 3$ the local subdivision matrix has dominant eigenvalue $1$, a double subdominant eigenvalue $\\lambda(n) \\in (0.4, 1)$, and a regular characteristic map; hence the limit surface is $C^1$ there, and $C^2$ only for $n = 4$ (Peters & Reif, 1998).',
      '**Invariant viewpoint.** Limit positions and λ(n) depend only on connectivity near the vertex, not on where the vertices are: the same pole pinches the same way on any model.',
      '**Geometric picture.** Every step zooms in on a vertex by a factor λ(n). Regular vertices zoom by ½ in step with their neighbours; a pole zooms at its own rate, so the pattern round it never quite matches the rest.',
      '**Where this goes.** Lesson 6.4 adds loops near edges so the limit surface stays sharp where wanted; 6.5 subdivides texture coordinates with the same rules.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-6-003-ex1',
      title: 'A regular limit',
      problem: 'A regular vertex at height $1$ has four edge neighbours and four diagonal neighbours all at height $0$. Its limit height?',
      steps: [
        { expression: 'n = 4: \\; (16 \\cdot 1 + 4 \\cdot 0 + 0) / 36', annotation: 'The limit mask.' },
        { expression: '= 0.4444', annotation: '4/9.' },
      ],
      conclusion: '4/9 ≈ 0.444.',
    },
    {
      id: 'modelling-geometry-6-003-ex2',
      title: 'Levels on a budget',
      problem: 'A game allows 20 000 faces for a character whose cage has 300 quads. How many levels?',
      steps: [
        { expression: '300 \\times 4 = 1200, \\; \\times 16 = 4800, \\; \\times 64 = 19\\,200', annotation: 'Levels 1, 2, 3.' },
        { expression: '300 \\times 256 = 76\\,800', annotation: 'Level 4: too many.' },
      ],
      conclusion: '3 levels (19 200 faces).',
    },
    {
      id: 'modelling-geometry-6-003-ex3',
      title: 'How stretched?',
      problem: 'After 4 steps, how large are the quads round a 6-pole compared with a regular vertex? $\\lambda(6) \\approx 0.5797$.',
      steps: [{ expression: '(0.5797 / 0.5)^4 = 1.1594^4 \\approx 1.81', annotation: 'The ratio compounds.' }],
      conclusion: 'About 1.8 times the size.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-6-003-ch1',
      difficulty: 'easy',
      problem: 'Why does every vertex converge to a limit?',
      walkthrough: [{ expression: '\\text{each step moves it by a fraction of the last move}', annotation: 'The other eigenvalues are below 1.' }],
      answer: 'Near the vertex, each step multiplies the differences from the limit by eigenvalues smaller than 1, so the moves shrink geometrically and the positions converge.',
    },
    {
      id: 'modelling-geometry-6-003-ch2',
      difficulty: 'medium',
      problem: 'Show that the limit weights add up to 1.',
      walkthrough: [{ expression: 'n^2 + 4n + n = n(n + 5)', annotation: 'n² on v, 4 on each of n edge neighbours, 1 on each of n diagonal ones.' }],
      answer: 'n² + 4 · n + 1 · n = n² + 5n = n(n + 5), the denominator; so the limit is an affine combination and moves with the mesh.',
    },
    {
      id: 'modelling-geometry-6-003-ch3',
      difficulty: 'hard',
      problem: 'Using λ(n), say which poles shrink faster than a regular vertex and which slower, and what that means for face sizes after many steps.',
      walkthrough: [
        { expression: '\\lambda(3) = 0.41 < \\tfrac12 < \\lambda(5) = 0.55 < \\lambda(8) = 0.61', annotation: 'λ grows with n.' },
        { expression: '\\text{size ratio } (\\lambda / \\tfrac12)^k', annotation: '→ 0 for n = 3, → ∞ for n ≥ 5.' },
      ],
      answer: 'λ(n) increases with n: 3-poles shrink faster than regular vertices (their quads become relatively tiny), poles of 5 or more slower (their quads become relatively huge), by (λ/½)^k after k steps; only n = 4 keeps pace.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'v_\\infty', meaning: 'A vertex\'s limit position after infinitely many steps.' },
      { symbol: 'e_j, f_j', meaning: 'Its edge neighbours, and the corners opposite it in each quad.' },
      { symbol: '\\lambda(n)', meaning: 'The subdominant eigenvalue: how much the ring round a vertex of valence n shrinks per step.' },
      { symbol: 'S_n', meaning: 'The local subdivision matrix near a vertex of valence n.' },
      { symbol: 'C^1, C^2', meaning: 'Tangent continuous; curvature continuous. Poles are C¹ only.' },
      { symbol: 'F_0 \\cdot 4^k', meaning: 'Faces after k levels.' },
    ],
    rulesOfThumb: [
      'Each level: four times the faces.',
      'Viewport low, render higher.',
      'Limits can be computed directly; no need to subdivide forever.',
      'Poles of 5 or more stretch, 3-poles crowd.',
      'More levels never remove a pinch.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-6-002', label: 'Catmull–Clark', note: 'The step whose limit this lesson computes.' },
      { lessonId: 'modelling-geometry-5-009', label: 'Clean topology', note: 'Why poles exist, and where to put them.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-6-004', label: 'Keeping edges sharp', note: 'Steering the limit surface with extra loops.' },
      { lessonId: 'modelling-geometry-7-004', label: 'Gaussian curvature', note: 'The curvature that jumps at poles.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-6-003-1', label: 'Read what each level costs', type: 'read' },
    { id: 'cp-modelling-geometry-6-003-2', label: 'Read the limit position formula', type: 'read' },
    { id: 'cp-modelling-geometry-6-003-3', label: 'Read why poles shrink at their own rate', type: 'read' },
    { id: 'cp-modelling-geometry-6-003-4', label: 'Run cells 1 to 4: cost, limits, λ(n), stretching', type: 'lab' },
    { id: 'cp-modelling-geometry-6-003-5', label: 'Trace a limit position at a pole and a regular vertex in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-6-003-6', label: 'Work through example 1, a regular limit', type: 'example' },
    { id: 'cp-modelling-geometry-6-003-7', label: 'Work through example 3, how stretched', type: 'example' },
    { id: 'cp-modelling-geometry-6-003-8', label: 'Complete the challenge: a limit position', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-6-003-assess-1',
        type: 'choice',
        text: 'A 100-quad cage at level 3 has how many faces?',
        options: ['6400', '1200', '400', '1600'],
        answer: '6400',
        hint: '100 × 4³.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-6-003-quiz-1',
      type: 'choice',
      text: 'Where does the cube\'s corner end up after infinitely many steps?',
      options: ['(0.5, 0.5, 0.5)', '(0.5556, 0.5556, 0.5556)', '(1, 1, 1)', '(0, 0, 0)'],
      answer: '(0.5, 0.5, 0.5)',
      hints: ['Cell 2.', 'The limit formula after one step.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-6-003-quiz-2',
      type: 'choice',
      text: 'How much does the ring round a regular vertex shrink per step?',
      options: ['× ½', '× ¼', '× 0.61', '× 1'],
      answer: '× ½',
      hints: ['λ(4).', 'Cell 3.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-6-003-quiz-3',
      type: 'choice',
      text: 'Round an 8-edged pole, the ring shrinks:',
      options: ['Slower than at a regular vertex (× 0.61)', 'Faster (× 0.41)', 'The same', 'Not at all'],
      answer: 'Slower than at a regular vertex (× 0.61)',
      hints: ['Cell 3.', 'λ grows with n.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-6-003-quiz-4',
      type: 'choice',
      text: 'What are the limit weights at a regular vertex?',
      options: ['16, 4 and 1 over 36', '1, 2 and 1 over 4', '9, 3 and 1 over 16', 'All equal'],
      answer: '16, 4 and 1 over 36',
      hints: ['n² = 16, n(n + 5) = 36.', 'Bicubic B-spline.'],
      reviewSection: 'Intuition: limits',
    },
    {
      id: 'modelling-geometry-6-003-quiz-5',
      type: 'choice',
      text: 'How smooth is the limit surface at an extraordinary vertex?',
      options: ['C¹: tangent continuous, curvature not', 'C²', 'Not continuous', 'C∞'],
      answer: 'C¹: tangent continuous, curvature not',
      hints: ['The graphics strand.', 'Maths: smoothness.'],
      reviewSection: 'Maths',
    },
    {
      id: 'modelling-geometry-6-003-quiz-6',
      type: 'choice',
      text: 'A model pinches at a pole. What fixes it?',
      options: ['Moving the pole in the cage', 'More subdivision levels', 'Smooth shading', 'Fewer levels'],
      answer: 'Moving the pole in the cage',
      hints: ['Warning "More levels do not remove a pinch".', 'Cell 4.'],
      reviewSection: 'Warning "More levels do not remove a pinch"',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'Subdividing more always makes the surface better.',
      whyStudentsThinkIt: 'More faces look smoother.',
      correctionExample: 'Cell 4: round an 8-pole the mismatch in quad size grows with every level.',
      contrastCase: 'Away from poles, more levels do approach the smooth bicubic limit.',
    },
    {
      falseBelief: 'The limit surface can only be found by subdividing many times.',
      whyStudentsThinkIt: 'A limit sounds like infinitely many steps.',
      correctionExample: 'Cell 2: the formula gives the corner\'s limit (0.5, 0.5, 0.5) from the level-1 mesh in one line.',
      contrastCase: 'For points between vertices, exact evaluation needs more machinery (Stam\'s method), but it is still closed-form.',
    },
    {
      falseBelief: 'All poles misbehave the same way.',
      whyStudentsThinkIt: '"Poles are bad" is taught as one rule.',
      correctionExample: 'Cell 3: 3-poles shrink faster than regular vertices, 5- and 8-poles slower.',
      contrastCase: 'Both are C¹ only; the visual effect differs (crowding versus stretching).',
    },
  ],

  transferPrompts: [
    {
      situation: 'A shiny phone model shows a kink in its reflection on a smooth corner.',
      competingTechniques: ['Raise the subdivision level', 'Find the pole under the kink and reroute it to a flat area or an edge'],
      whyThisTechniqueWins: 'The kink comes from the pole\'s C¹ limit; levels do not change that, moving the pole does.',
    },
    {
      situation: 'A crowd scene has 500 subdivided characters.',
      competingTechniques: ['Render every character at level 3', 'Choose each character\'s level from its size on screen'],
      whyThisTechniqueWins: 'Each level quadruples cost; distant characters gain nothing visible from extra levels.',
    },
  ],

  debugging: [
    {
      commonError: 'Applying the limit formula where faces are not quads.',
      symptom: 'Wrong limit positions at triangles and n-gons.',
      whyItHappened: 'The mask assumes quads round the vertex.',
      repairStrategy: 'Subdivide once first; then every face is a quad.',
    },
    {
      commonError: 'Setting viewport and render levels the same and high.',
      symptom: 'Editing becomes slow; the viewport stutters.',
      whyItHappened: 'Every edit re-evaluates millions of faces.',
      repairStrategy: 'Low viewport level, higher render level.',
    },
    {
      commonError: 'Expecting more levels to fix a pinch.',
      symptom: 'The pinch is still there, sharper.',
      whyItHappened: 'λ(n) ≠ ½ at the pole, at every level.',
      repairStrategy: 'Move the pole in the cage.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Compute limit positions, face counts per level and λ(n) ratios.',
    explainVerbally: 'Explain why vertices converge, what λ(n) measures, and why poles pinch.',
    detectIncorrectApplication: 'Recognise misapplied limit masks, excessive levels and futile subdivision against pinches.',
    transferToUnfamiliar: 'Choose subdivision levels for a budget, and place poles where their pinch will not show.',
  },
};
