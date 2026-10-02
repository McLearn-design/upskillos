// Lesson 5.6: merge and smooth vertices. Merge at centre moves several vertices to their centroid and makes them
// one; faces lose the repeated corners, and faces left with fewer than three go. Smoothing moves each vertex the
// fraction λ of the way to its neighbours' average: one step of the heat equation, which kills zigzags at once but
// slowly shrinks curves, unless a second, inflating step undoes the shrinking.
import { withPicture } from '../notebookScene.js';

const HELPERS = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const f3 = (v) => v.map(r).join(', ')
`;

const MERGE = `${HELPERS}
// A flat 3 × 3 grid: 16 vertices, 9 quads facing up. Face 4 is the middle one, [5, 6, 10, 9].
const verts = [], faces = []
for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) verts.push([i, 0, j])
for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) faces.push([i * 4 + j, i * 4 + j + 1, (i + 1) * 4 + j + 1, (i + 1) * 4 + j])
// Merge its four corners at their centre. Predict first: where is the centre, and how many faces are left?
const group = [5, 6, 10, 9], keep = group[0]
const centre = [0, 1, 2].map((k) => group.reduce((s, v) => s + verts[v][k], 0) / group.length)
verts[keep] = centre
console.log('the four corners meet at ' + f3(centre))
// In every face, a merged vertex becomes 'keep'; repeats next to each other drop; faces under 3 corners go.
const after = faces.map((f) => f.map((v) => group.includes(v) ? keep : v).filter((v, i, a) => v !== a[(i + 1) % a.length]))
const kept = after.filter((f) => f.length >= 3)
console.log('faces: ' + faces.length + ' → ' + kept.length + '; corner counts ' + kept.map((f) => f.length).join(', '))`;

const STEP = `${HELPERS}
// One vertex x with four neighbours. Smoothing moves it the fraction λ of the way to their average.
const x = [0, 0.3, 0], nb = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]
const avg = [0, 1, 2].map((k) => nb.reduce((s, p) => s + p[k], 0) / nb.length)
console.log('neighbours\\' average x̄ = ' + f3(avg))
// Predict first: where is x after one step with λ = 0.5?
for (const lambda of [0.25, 0.5, 1]) console.log('λ = ' + lambda + ': x + λ (x̄ − x) = ' + f3(x.map((v, k) => v + lambda * (avg[k] - v))))`;

// 16 points round a circle of radius 1 in the xz plane, with a zigzag: every other point pushed out 0.1.
const RING = `${HELPERS}
const n = 16
const ring0 = Array.from({ length: n }, (_, k) => { const a = 2 * Math.PI * k / n, s = 1 + (k % 2 ? 0.1 : -0.1); return [s * Math.cos(a), 0, s * Math.sin(a)] })
// One smoothing step on a closed ring: each point moves λ of the way to the average of its two neighbours.
const step = (ring, lambda) => ring.map((p, k) => { const a = ring[(k + n - 1) % n], b = ring[(k + 1) % n]; return p.map((v, i) => v + lambda * ((a[i] + b[i]) / 2 - v)) })
// The mean radius (the circle's size) and the zigzag (how far the radii swing either side of it).
const measure = (ring) => { const rad = ring.map((p) => Math.hypot(p[0], p[2])), m = rad.reduce((s, x) => s + x) / n; return { mean: m, zig: Math.max(...rad.map((x) => Math.abs(x - m))) } }
`;

const FREQ = `${RING}
// Predict first: after one step with λ = 0.5, how big is the zigzag? And the circle?
let ring = ring0
for (let it = 0; it <= 10; it++) {
  if ([0, 1, 2, 5, 10].includes(it)) { const { mean, zig } = measure(ring); console.log('step ' + it + ': mean radius ' + r(mean) + ', zigzag ' + r(zig)) }
  ring = step(ring, 0.5)
}
// Each pattern round the ring shrinks by its own factor per step: 1 − λ(1 − cos(2πk / n)), k waves round the ring.
for (const k of [1, 2, 4, 8]) console.log(k + ' wave' + (k > 1 ? 's' : '') + ' round the ring: × ' + r(1 - 0.5 * (1 - Math.cos(2 * Math.PI * k / n))) + ' per step')`;

const TAUBIN = `${RING}
// Taubin smoothing: a shrinking step (λ = 0.5), then an inflating one (μ = −0.53), repeated.
let plain = ring0, taubin = ring0
for (let it = 0; it < 10; it++) { plain = step(plain, 0.5); taubin = step(step(taubin, 0.5), -0.53) }
for (const [name, ring] of [['plain, 10 steps', plain], ['Taubin, 10 pairs', taubin]]) { const { mean, zig } = measure(ring); console.log(name + ': mean radius ' + r(mean) + ', zigzag ' + r(zig)) }
const a = (k) => 1 - Math.cos(2 * Math.PI * k / n)
console.log('per pair: the circle × ' + r((1 - 0.5 * a(1)) * (1 + 0.53 * a(1))) + ', the zigzag × ' + r((1 - 0.5 * a(8)) * (1 + 0.53 * a(8))))`;

const PICTURE = withPicture(`${HELPERS}
// The checkerboard grid from MeshLab's project, before (left) and after one smoothing step with λ = 0.5 (right),
// lit by a low light from one side: brightness N · L for each face, so even small tilts show as light and dark.
const N = 6, verts = [], faces = []
const height = (i, j) => (i === 0 || j === 0 || i === N || j === N) ? 0 : ((i + j) % 2 ? 0.15 : -0.15)
const grid = (dx, h) => {
  const base = verts.length
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) verts.push([dx + i * 0.5, h(i, j), j * 0.5])
  // Each square as two triangles: a square with two corners up and two down is a saddle, which shades flat on
  // average, but each of its triangles tilts, so the crinkles catch the light.
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const [p, q, r2, s] = [base + i * (N + 1) + j, base + i * (N + 1) + j + 1, base + (i + 1) * (N + 1) + j + 1, base + (i + 1) * (N + 1) + j]
    faces.push([p, q, r2], [p, r2, s])
  }
}
// One step: each inner vertex moves half way to the average of its four neighbours.
const smoothed = (i, j) => {
  if (i === 0 || j === 0 || i === N || j === N) return 0
  const avg = (height(i - 1, j) + height(i + 1, j) + height(i, j - 1) + height(i, j + 1)) / 4
  return height(i, j) + 0.5 * (avg - height(i, j))
}
grid(-3.4, height); grid(0.4, smoothed)
// Each triangle's normal, and its brightness under a low light from the +x side.
const L = [0.8, 0.45, 0.4].map((x, _, a) => x / Math.hypot(...a))
const values = faces.map(([a, b, c]) => {
  const u = verts[b].map((x, k) => x - verts[a][k]), w = verts[c].map((x, k) => x - verts[a][k])
  const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], l = Math.hypot(...n)
  return Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / l)
})
let most = 0
for (let i = 1; i < N; i++) for (let j = 1; j < N; j++) most = Math.max(most, Math.abs(smoothed(i, j)))
console.log('largest bump: 0.15 before, ' + r(most) + ' after one step')
show({ verts, faces, values, zoom: 1.4 })`);

const CHALLENGE = `// 16 points evenly round a circle of radius 1, with no zigzag. One smoothing step with λ = 0.5:
// each point moves half way to the average of its two neighbours. What is the circle's radius afterwards?
const radius = 0
console.log(radius)`;

const SOLVED = CHALLENGE.replace('const radius = 0', 'const radius = 1 - 0.5 * (1 - Math.cos(2 * Math.PI / 16))');

/** The challenge's check: one step with λ = 0.5 on 16 points of a unit circle gives radius 1 − ½(1 − cos 22.5°) = 0.96194. */
export function checkShrink(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+radius\s*=\s*([^\n]+)/);
  if (!m) return no('Keep the line const radius = …, with a number or an expression.');
  // Only arithmetic and a few Math functions are evaluated: this runs in the page, not the cell's sandbox.
  const expr = m[1].replace(/\/\/.*$/, '').trim().replace(/;$/, '');
  if (!/^[\d.\s+\-*/()]*$/.test(expr.replace(/Math\.(sin|cos|tan|sqrt|PI)/g, ''))) return no('Write the radius as a number, or arithmetic with Math.cos, Math.sin and Math.PI.');
  let v;
  try { v = Number(new Function('return (' + expr + ')')()); } catch { return no('That expression did not run.'); }
  if (!Number.isFinite(v)) return no('The radius must be a number.');
  const right = 1 - 0.5 * (1 - Math.cos(2 * Math.PI / 16));
  if (Math.abs(v - right) <= 5e-4) return { pass: true, message: `${+v.toFixed(5)}: each neighbour pair's midpoint is cos 22.5° = 0.92388 from the centre, and the point moves half way there: 1 − ½(1 − 0.92388) = 0.96194. Every step multiplies the radius by this: smoothing shrinks curves.` };
  if (v === 0) return no('Work it out: where is the midpoint of a point\'s two neighbours, and how far towards it does the point move?');
  if (Math.abs(v - 1) < 1e-6) return no('The circle does shrink: the midpoint of two neighbouring points on a circle lies inside it, so every point moves inward.');
  if (Math.abs(v - Math.cos(Math.PI / 8)) < 5e-4) return no('0.92388 is where the neighbours\' midpoint is (λ = 1). With λ = 0.5 the point moves only half way there.');
  if (Math.abs(v - (1 - 0.5 * (1 - Math.cos(Math.PI / 16)))) < 5e-4) return no('The neighbours are 2π/16 = 22.5° away on either side; their midpoint is cos 22.5° from the centre, not cos 11.25°.');
  if (Math.abs(v - (1 - 0.5 * (1 - Math.cos(2 * Math.PI / 16 * 180 / Math.PI)))) < 5e-3 || Math.abs(v - (1 - 0.5 * (1 - Math.cos(22.5))))< 5e-3) return no('Math.cos takes radians: 22.5° is Math.PI / 8.');
  return no(`${+v.toFixed(5)} is not 1 − λ(1 − cos 22.5°) for λ = 0.5.`);
}

export default {
  id: 'modelling-geometry-5-006',
  slug: 'merge-and-smooth-vertices',
  chapter: 'modelling-geometry',
  order: 6,
  title: 'Merge and smooth vertices',
  subtitle: 'Collapse vertices to their centre, and relax a mesh by moving each vertex towards its neighbours\' average.',
  tags: ['merge', 'smoothing', 'laplacian', 'averaging', 'heat equation', 'modelling'],
  coreConcept: 'Merge at centre moves a set of vertices to their centroid and makes them one vertex; faces lose the repeated corners, and faces left with fewer than three corners go. Laplacian smoothing moves each vertex the fraction λ of the way to the average of its neighbours, x ← x + λ(x̄ − x): one explicit step of the heat equation. On a ring, a pattern with k waves shrinks by 1 − λ(1 − cos 2πk/n) per step, so zigzags vanish almost at once while the whole shape shrinks slowly. Pinning the open border keeps the outline; alternating a shrinking and an inflating step (Taubin) keeps the size.',
  prerequisites: ['modelling-geometry-5-005', 'modelling-geometry-1-006'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-5-007',

  hook: {
    question: 'A scanned or sculpted surface is covered in tiny bumps. Press Smooth a few times and they melt away, but so, slowly, does the model. Why does smoothing remove bumps so much faster than it shrinks the shape, and can it be stopped from shrinking?',
    realWorldContext: 'Merging is everyday clean-up: collapsing a sliver edge, closing a gap, joining two halves. Smoothing relaxes topology after edits, denoises 3D scans, and is the first step of every remeshing tool; the same averaging blurs images and spreads heat.',
  },

  intuition: {
    prose: [
      '**Merge at centre** takes a set of vertices, moves them all to their **centroid** (the average of their positions) and makes them one. Every face that used them now uses the one vertex. A face that had two of them next to each other loses a corner; a face that had all of them collapses to a point and goes.',
      'Before running cell 1, predict: the four corners of the middle face of a $3 \\times 3$ grid merge. Where do they meet, and how many faces are left? At $(1.5, 0, 1.5)$; the middle face goes, the four faces sharing an edge with it become triangles, and the four sharing only a corner stay quads: $8$ faces.',
      '**Smoothing** is averaging too, but gentler: each vertex moves the fraction $\\lambda$ of the way towards the average $\\bar{x}$ of its neighbours, $x \\leftarrow x + \\lambda(\\bar{x} - x)$. With $\\lambda = 1$ it jumps to the average; with $\\lambda = 0.5$, half way. Cell 2 does one vertex.',
      'Why do bumps vanish so fast? Look at a ring of $16$ points round a circle with a zigzag: every other point pushed out $0.1$. A pushed-out point\'s two neighbours are both pushed in, so their average is as far in as it is out. Before running cell 3, predict: after one step with $\\lambda = 0.5$, how big is the zigzag? Almost nothing, $0.004$: half way from $+0.1$ to $-0.1$ is $0$, and the small rest comes from the ring being curved.',
      'The circle itself shrinks, because the midpoint of two neighbours on a circle lies inside it. Each step multiplies the radius by $1 - \\lambda(1 - \\cos 22.5°) = 0.962$: after $10$ steps the circle is $0.68$ of its size. In general a pattern with $k$ waves round the ring shrinks by $1 - \\lambda(1 - \\cos\\tfrac{2\\pi k}{n})$ per step: close to $1$ for big, smooth shapes, close to $0$ for zigzags. Smoothing is a **low-pass filter**.',
      'Two fixes for shrinking. On an open surface, keep the **border** still: MeshLab does, so the outline cannot pull in. For closed shapes, **Taubin smoothing** follows each shrinking step ($\\lambda = 0.5$) with an inflating one ($\\mu = -0.53$, a step away from the average): the pair multiplies the circle by $1.0007$ and the zigzag by $0$, so after ten pairs the radius is $1.0075$ where plain smoothing left $0.68$ (cell 4).',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Merge at centre',
        body: 'Step 1. c = the average of the selected vertices\' positions.\nStep 2. Keep one vertex, move it to c; in every face, replace the others by it.\nStep 3. In each face, drop a corner equal to the one after it.\nStep 4. Remove faces with fewer than three corners, then the merged-away vertices.',
      },
      {
        type: 'procedure',
        title: 'Procedure: One smoothing step',
        body: 'Step 1. For each vertex i, its neighbours: the other ends of its edges.\nStep 2. x̄ᵢ = the average of their positions (from before this step, for every vertex at once).\nStep 3. Unless i is pinned (on the open border, or not selected): xᵢ ← xᵢ + λ (x̄ᵢ − xᵢ).\nStep 4. Repeat for more smoothing. For Taubin, alternate λ > 0 with μ < −λ.',
      },
      {
        type: 'warning',
        title: 'Smoothing shrinks',
        body: 'Every plain smoothing step pulls a curved closed surface inward: a sphere smoothed many times becomes a smaller sphere, then a blob. Pin what must not move, smooth as few steps as you need, or use Taubin smoothing.',
      },
      {
        type: 'warning',
        title: 'Merging can fold faces',
        body: 'Merging vertices that are far apart drags every face that used them; faces can flip over or overlap. Merge vertices that are already close (a sliver edge, a gap), or merge by distance with a small threshold (lesson 1.6).',
      },
      {
        type: 'insight',
        title: 'The graphics strand: none new, but what smoothing does to shading',
        body: 'Smoothing changes positions, so it changes face normals, and with them the shading (lesson 3.5): a bumpy surface shades as speckled light and dark; after smoothing, the normals line up and the light falls evenly. The heat map in MeshLab\'s trace shows how far each vertex moved.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "smoothing needs many steps to remove noise". The checkerboard of bumps (left: under a low light its facets are light and dark) is nearly flat and evenly lit after a single step with λ = 0.5 (right); only the vertices next to the pinned border keep a quarter of their bump.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'In cell 1, centre is Step 1 of merging and the map/filter are Steps 2–4; step() in cells 3 and 4 is one smoothing step on a ring; the factor printed at the end of cell 3 is the formula for k waves.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Neither operation needs anything new from the GPU: merge sends fewer triangles, smoothing the same triangles with new positions and normals.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'M merges the selected vertices at their centre; Mesh › Smooth vertices smooths the selection (5 steps, λ = 0.5), keeping the open border still. With Record traces on, merge asks where the centre is; smoothing shows the vertex that moves most and asks where it goes. Scripts call mesh.merge(verts) and mesh.smooth({ verts, iterations, lambda }).' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: merge, then smooth',
        caption: 'Merging at the centroid, one smoothing step, why zigzags vanish and circles shrink, Taubin\'s fix, and a bumpy grid smoothed.',
        props: {
          lesson: {
            title: 'Merge and smooth vertices',
            subtitle: 'Averages, applied two ways.',
            cells: [
              { type: 'js', instruction: '### 1. Merge at centre\nPredict first: where do the middle face\'s corners meet, and how many faces are left?', startCode: MERGE },
              { type: 'js', instruction: '### 2. One smoothing step\nPredict first: λ = 0.5.', startCode: STEP },
              { type: 'js', instruction: '### 3. Zigzags vanish, circles shrink\nPredict first: the zigzag after one step.', startCode: FREQ },
              { type: 'js', instruction: '### 4. Taubin: shrink, then inflate\nThe same ten steps, with an inflating step after each.', startCode: TAUBIN },
              { type: 'js', instruction: '### 5. See it\nThe checkerboard of bumps, before and after one step, under a low light. Drag to turn.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 360 },
              { type: 'challenge', instruction: '### 6. Challenge: one step on a circle\nThe new radius. The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkShrink },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Merge and smooth vertices" in MeshLab](#/lab/mesh-lab?project=merge-smooth). The checkerboard is smoothed once with **Record traces** on: press Play and predict where the vertex that moves most goes. Then merge four vertices with M and watch the faces round them lose corners.' },
              { type: 'markdown', instruction: '### Use the tool\n- **M:** merge the selected vertices at their centre.\n- **Mesh › Merge by distance:** merge vertices closer than a threshold (lesson 1.6).\n- **Mesh › Smooth vertices:** 5 steps with λ = 0.5 on the selection; the open border stays put.\n- In a script: `mesh.merge([a, b, c])`, `mesh.smooth({ verts, iterations: 3, lambda: 0.5 })`.\n- [Open "Smoothing as heat flow" in MeshLab](#/lab/mesh-lab?project=smoothing) for chapter 7\'s view of the same averaging.\n- **In Blender:** M › At Center; Smooth Vertices (with a Repeat count); the Laplacian Smooth and Corrective Smooth modifiers keep volume.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**The centroid.** For points $x_1, \\ldots, x_m$, $c = \\tfrac1m \\sum x_i$ is the point minimising $\\sum \\|x_i - c\\|^2$: merging there moves the vertices as little as possible in total.',
      '**Smoothing as a matrix.** Write all positions as $X$. One step is $X \\leftarrow (I - \\lambda L) X$, where $L = I - D^{-1}A$ is the uniform graph Laplacian ($A$ the adjacency, $D$ the neighbour counts). $LX$ at vertex $i$ is $x_i - \\bar{x}_i$: how far the vertex sticks out from its neighbours. Smoothing removes a fraction $\\lambda$ of that per step: an explicit Euler step of the heat equation $\\partial X / \\partial t = -LX$ (chapter 7).',
      '**Why each pattern has its own factor.** On a ring of $n$ points, the patterns $\\cos(2\\pi k i / n)$ are eigenvectors of $L$ with eigenvalues $1 - \\cos(2\\pi k / n)$. So one step multiplies the $k$-wave pattern by $1 - \\lambda(1 - \\cos\\frac{2\\pi k}{n})$: for $k = 8$ (the zigzag) that is $1 - 2\\lambda$, zero at $\\lambda = 0.5$; for $k = 1$ (the circle) it is $0.962$.',
      '**Stability.** With $\\lambda > 1$ (or $\\lambda > \\tfrac12$ on some meshes), the zigzag factor $1 - 2\\lambda$ falls below $-1$ and the zigzag grows, flipping sign each step: the explicit step is unstable. MeshLab clamps $\\lambda$ to $[0, 1]$.',
      '**Taubin.** A pair of steps multiplies pattern $k$ by $(1 - \\lambda a_k)(1 - \\mu a_k)$ with $a_k = 1 - \\cos\\frac{2\\pi k}{n}$. With $\\mu < -\\lambda < 0$, this is about $1$ for small $a_k$ (smooth shapes kept) and small for large $a_k$ (noise removed): a band-limited filter without shrinkage.',
    ],
    equations: [
      { label: 'Centroid', latex: 'c = \\frac{1}{m}\\sum_{i=1}^{m} x_i' },
      { label: 'Smoothing step', latex: 'x_i \\leftarrow x_i + \\lambda\\,(\\bar{x}_i - x_i), \\qquad \\bar{x}_i = \\frac{1}{|N(i)|}\\sum_{j \\in N(i)} x_j' },
      { label: 'Factor per pattern', latex: '1 - \\lambda\\,(1 - \\cos(2\\pi k / n))' },
      { label: 'Taubin pair', latex: '(1 - \\lambda a_k)(1 - \\mu a_k), \\quad \\mu < -\\lambda < 0' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** Uniform Laplacian smoothing with $0 < \\lambda \\le \\tfrac12$ is a contraction on every non-constant pattern of a mesh\'s vertex positions: repeated, it converges to the average position on a closed component, or, with pinned border vertices, to the harmonic interpolation of the border (each inner vertex the average of its neighbours).',
      '**Invariant viewpoint.** Smoothing commutes with rigid motions and uniform scaling (it is linear in the positions and averages are preserved by them), but it depends on connectivity: the uniform weights pull vertices towards even spacing, sliding them along the surface; cotan weights (chapter 7) move them only across it.',
      '**Geometric picture.** Each vertex is tied to its neighbours by equal springs; a smoothing step lets every spring relax a little. Short wiggles have tight springs and relax fast; a whole curve has loose ones and relaxes slowly.',
      '**Where this goes.** Lesson 7.2 builds the Laplacian as a matrix with cotan weights; lesson 7.7 smooths with implicit steps, which are stable for any step size.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-5-006-ex1',
      title: 'A merged centre',
      problem: 'Vertices at $(0, 0, 0)$, $(2, 0, 0)$ and $(1, 3, 0)$ are merged at centre. Where?',
      steps: [
        { expression: '(0 + 2 + 1,\\; 0 + 0 + 3,\\; 0) = (3, 3, 0)', annotation: 'The sum.' },
        { expression: 'c = (1, 1, 0)', annotation: 'Divided by 3.' },
      ],
      conclusion: '(1, 1, 0).',
    },
    {
      id: 'modelling-geometry-5-006-ex2',
      title: 'Collapsing an edge',
      problem: 'The two ends of an edge between two quads are merged. What happens to those quads, and to the edge?',
      steps: [
        { expression: '\\text{each quad has both ends next to each other}', annotation: 'Step 3 drops one.' },
        { expression: '\\text{each becomes a triangle}', annotation: '4 − 1 = 3 corners.' },
        { expression: '\\text{the edge has length 0: it is gone}', annotation: 'An edge collapse.' },
      ],
      conclusion: 'Both quads become triangles and the edge disappears: an edge collapse, the basic step of mesh simplification.',
    },
    {
      id: 'modelling-geometry-5-006-ex3',
      title: 'A step on a curve',
      problem: 'A point at $(0, 1)$ has neighbours $(-1, 0.8)$ and $(1, 0.8)$. Smooth it once with $\\lambda = 0.5$.',
      steps: [
        { expression: '\\bar{x} = (0, 0.8)', annotation: 'The neighbours\' average.' },
        { expression: 'x + 0.5\\,(\\bar{x} - x) = (0, 0.9)', annotation: 'Half way.' },
      ],
      conclusion: '(0, 0.9): it moved inward, towards the inside of the curve.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-5-006-ch1',
      difficulty: 'easy',
      problem: 'Why does MeshLab keep open-border vertices still when smoothing?',
      walkthrough: [{ expression: '\\text{a border vertex has neighbours on one side only}', annotation: 'Its average pulls it inward.' }],
      answer: 'A border vertex\'s neighbours all lie on the inside, so their average pulls it inward; smoothing would shrink the outline. Keeping it still keeps the outline and lets the inside relax.',
    },
    {
      id: 'modelling-geometry-5-006-ch2',
      difficulty: 'medium',
      problem: 'On the 16-point ring, which pattern does one step with $\\lambda = 0.5$ reduce the least, apart from moving the whole ring?',
      walkthrough: [
        { expression: '1 - 0.5(1 - \\cos\\tfrac{2\\pi k}{16})', annotation: 'Largest when cos is largest.' },
        { expression: 'k = 1: 0.962', annotation: 'The fewest waves: the circle itself.' },
      ],
      answer: 'k = 1, the circle (one wave round), with factor 0.962; k = 0 is the whole ring moving, which smoothing leaves alone.',
    },
    {
      id: 'modelling-geometry-5-006-ch3',
      difficulty: 'hard',
      problem: 'Show that with $\\lambda = 1.2$, the zigzag on the ring grows. What does it do each step?',
      walkthrough: [
        { expression: '1 - 1.2 \\times 2 = -1.4', annotation: 'The k = 8 factor, 1 − 2λ.' },
        { expression: '|-1.4| > 1', annotation: 'It grows by 40% a step.' },
      ],
      answer: 'The zigzag\'s factor is 1 − 2λ = −1.4: each step it flips sign and grows 40%. The explicit step is unstable for λ > 1 on this ring; that is why λ is kept in [0, 1].',
    },
  ],

  semantics: {
    core: [
      { symbol: 'c', meaning: 'The centroid: the average of the merged vertices\' positions.' },
      { symbol: '\\bar{x}_i', meaning: 'The average of vertex i\'s neighbours.' },
      { symbol: '\\lambda', meaning: 'The step: how far towards the average each vertex moves (0 to 1).' },
      { symbol: 'L', meaning: 'The graph Laplacian: (LX)ᵢ = xᵢ − x̄ᵢ, how far a vertex sticks out.' },
      { symbol: 'k', meaning: 'The number of waves of a pattern round a ring.' },
      { symbol: '\\mu', meaning: 'Taubin\'s inflating step, negative and a little larger than λ.' },
    ],
    rulesOfThumb: [
      'Merge vertices that are already close.',
      'One step with λ = 0.5 kills zigzags.',
      'Many steps shrink shapes; pin borders or use Taubin.',
      'λ above 1 blows up.',
      'Smoothing slides vertices to even spacing, too.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-1-006', label: 'Welding and filling', note: 'Merge by distance: merging vertices that are already together.' },
      { lessonId: 'modelling-geometry-5-005', label: 'Dissolve and delete', note: 'Merging faces, where this lesson merges vertices.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-5-007', label: 'Mirror and modifiers', note: 'Merging the two halves along the mirror plane.' },
      { lessonId: 'modelling-geometry-7-007', label: 'Smoothing as heat flow', note: 'Implicit steps and cotan weights.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-5-006-1', label: 'Read how merge at centre collapses faces', type: 'read' },
    { id: 'cp-modelling-geometry-5-006-2', label: 'Read why smoothing removes zigzags fast and shrinks slowly', type: 'read' },
    { id: 'cp-modelling-geometry-5-006-3', label: 'Read the two fixes for shrinking', type: 'read' },
    { id: 'cp-modelling-geometry-5-006-4', label: 'Run cells 1 to 4: merge, step, frequencies, Taubin', type: 'lab' },
    { id: 'cp-modelling-geometry-5-006-5', label: 'Trace a smoothing step in MeshLab and predict a vertex', type: 'lab' },
    { id: 'cp-modelling-geometry-5-006-6', label: 'Work through example 2, collapsing an edge', type: 'example' },
    { id: 'cp-modelling-geometry-5-006-7', label: 'Work through example 3, a step on a curve', type: 'example' },
    { id: 'cp-modelling-geometry-5-006-8', label: 'Complete the challenge: one step on a circle', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-5-006-assess-1',
        type: 'choice',
        text: 'A vertex at height 0.2 has four neighbours at height 0. After one smoothing step with λ = 0.5, its height is:',
        options: ['0.1', '0', '0.05', '0.2'],
        answer: '0.1',
        hint: 'Half way from 0.2 to the average, 0.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-5-006-quiz-1',
      type: 'choice',
      text: 'The four corners of the middle face of a 3 × 3 grid are merged. How many faces are left?',
      options: ['8', '9', '5', '4'],
      answer: '8',
      hints: ['The middle face collapses.', 'Cell 1.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-5-006-quiz-2',
      type: 'choice',
      text: 'Why does a zigzag vanish in one step with λ = 0.5?',
      options: ['Each point\'s neighbours are pushed the opposite way, so their average is the mirror of it', 'λ = 0.5 is the largest step', 'Zigzags are short', 'The border is pinned'],
      answer: 'Each point\'s neighbours are pushed the opposite way, so their average is the mirror of it',
      hints: ['Cell 3: 0.1 → 0.004.', 'Half way from +0.1 to −0.1.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-5-006-quiz-3',
      type: 'choice',
      text: 'Ten smoothing steps with λ = 0.5 on a 16-point circle leave its radius at about:',
      options: ['0.68', '0.96', '0.5', '1'],
      answer: '0.68',
      hints: ['0.962 per step.', '0.962¹⁰.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-5-006-quiz-4',
      type: 'choice',
      text: 'What does Taubin smoothing add after each shrinking step?',
      options: ['An inflating step with a negative λ', 'A pinned border', 'A merge', 'A second shrinking step'],
      answer: 'An inflating step with a negative λ',
      hints: ['μ = −0.53.', 'Cell 4.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-5-006-quiz-5',
      type: 'choice',
      text: 'What is the zigzag\'s factor per step, for step size λ?',
      options: ['1 − 2λ', '1 − λ', 'λ', '1 + λ'],
      answer: '1 − 2λ',
      hints: ['k = 8 on 16 points: cos π = −1.', 'Maths: why each pattern has its own factor.'],
      reviewSection: 'Maths',
    },
    {
      id: 'modelling-geometry-5-006-quiz-6',
      type: 'choice',
      text: 'Which vertices does MeshLab\'s smoothing never move?',
      options: ['Vertices on an open border, and unselected ones', 'The highest ones', 'Vertices with four neighbours', 'None'],
      answer: 'Vertices on an open border, and unselected ones',
      hints: ['Procedure, Step 3.', 'Challenge 1.'],
      reviewSection: 'Procedure: One smoothing step',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'Smoothing only removes noise and leaves the shape alone.',
      whyStudentsThinkIt: 'One or two steps barely change a model\'s size.',
      correctionExample: 'Cell 3: 10 steps take a circle to 0.68 of its radius.',
      contrastCase: 'Taubin smoothing (cell 4) removes the noise and keeps the radius.',
    },
    {
      falseBelief: 'Merging vertices keeps all the faces.',
      whyStudentsThinkIt: 'Only vertices were selected.',
      correctionExample: 'Cell 1: merging one face\'s corners removes that face and turns four others into triangles.',
      contrastCase: 'Merging two vertices that share no face (welding a gap) removes no faces at all.',
    },
    {
      falseBelief: 'A bigger λ always smooths better.',
      whyStudentsThinkIt: 'Bigger steps, faster progress.',
      correctionExample: 'Challenge 3: with λ = 1.2 the zigzag grows 40% a step.',
      contrastCase: 'For λ up to 0.5 every pattern shrinks steadily without flipping.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A 3D scan of a statue is speckled with sensor noise, and its measurements must stay accurate.',
      competingTechniques: ['Plain smoothing, many steps', 'Taubin smoothing, a few pairs'],
      whyThisTechniqueWins: 'Taubin removes the high-frequency noise like plain smoothing but does not shrink the statue, so measurements stay right.',
    },
    {
      situation: 'Two halves of a model meet with a tiny gap, and each pair of vertices across it must become one.',
      competingTechniques: ['Merge at centre, pair by pair', 'Merge by distance with a small threshold'],
      whyThisTechniqueWins: 'Merge by distance finds every close pair at once and merges only those (lesson 1.6); merging by hand is slow and error-prone.',
    },
  ],

  debugging: [
    {
      commonError: 'Updating vertices in place during a smoothing step.',
      symptom: 'The result depends on vertex order; smoothing drifts in one direction.',
      whyItHappened: 'Later vertices averaged neighbours that had already moved this step.',
      repairStrategy: 'Compute all new positions from the old ones, then replace them together (Step 2).',
    },
    {
      commonError: 'Smoothing the border of an open mesh.',
      symptom: 'The outline pulls in and the mesh shrinks away from where it should meet others.',
      whyItHappened: 'Border vertices only have neighbours on one side.',
      repairStrategy: 'Pin border vertices (MeshLab does), or smooth only the selection.',
    },
    {
      commonError: 'Leaving degenerate faces after a merge.',
      symptom: 'Zero-area faces, broken normals, and validation errors.',
      whyItHappened: 'Faces with repeated corners were kept.',
      repairStrategy: 'Drop repeated neighbours in each face and remove faces with fewer than three corners (Steps 3–4).',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Merge vertices by hand and say which faces change; smooth a vertex or a ring step by step.',
    explainVerbally: 'Explain why smoothing kills zigzags fast and shrinks slowly, and how pinning and Taubin stop shrinking.',
    detectIncorrectApplication: 'Recognise shrinking, unstable steps, in-place updates and degenerate faces from their symptoms.',
    transferToUnfamiliar: 'Choose merge or smoothing settings for clean-up, scans and relaxed topology.',
  },
};
