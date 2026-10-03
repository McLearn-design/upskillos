// Lesson 7.6: distance on a surface. Walking along edges gives the wrong distance (a staircase). The heat method
// (Crane, Weischedel and Wardetzky, 2013): let heat spread from the source for a moment, keep only the direction it
// flows in each triangle, then solve a Poisson problem for the function whose gradient best follows that direction.
// Two sparse solves (lesson 7.5) give geodesic distance everywhere at once.
import { withPicture } from '../notebookScene.js';

const HEAT = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const sub = (a, b) => a.map((x, i) => x - b[i]), dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a) => Math.hypot(...a)
const cotAt = (a, b, c) => { const u = sub(a, c), w = sub(b, c); return dot(u, w) / len(cross(u, w)) }   // angle at c
// Conjugate gradients on rows of (column → value) (lesson 7.5).
function cg(A, b) {
  const mul = (x) => A.map((row) => { let s = 0; for (const [c, v] of row) s += v * x[c]; return s })
  let x = b.map(() => 0), rr0 = b.slice(), p = b.slice(), rr = dot(rr0, rr0); const bn = Math.sqrt(rr) || 1
  for (let k = 0; k < 5000 && Math.sqrt(rr) / bn > 1e-10; k++) {
    const Ap = mul(p), a = rr / dot(p, Ap)
    x = x.map((v, i) => v + a * p[i]); rr0 = rr0.map((v, i) => v - a * Ap[i])
    const rr2 = dot(rr0, rr0); p = rr0.map((v, i) => v + (rr2 / rr) * p[i]); rr = rr2
  }
  return x
}
// The heat method on a triangle mesh {V, T}, distance from vertex src.
function heatDistance({ V, T }, src) {
  const n = V.length, C = V.map(() => new Map()), mass = V.map(() => 0)
  const put = (i, j, w) => C[i].set(j, (C[i].get(j) || 0) + w)
  let h = 0
  for (const t of T) t.forEach((i, k) => {
    const j = t[(k + 1) % 3], l = t[(k + 2) % 3], w = cotAt(V[i], V[j], V[l]) / 2
    put(i, j, -w); put(j, i, -w); put(i, i, w); put(j, j, w)
    mass[i] += len(cross(sub(V[j], V[i]), sub(V[l], V[i]))) / 6; h += len(sub(V[j], V[i])) / (3 * T.length)
  })
  // 1. Heat flow for a short time t = h²: (M + tC) u = δ.
  const t = h * h, A = C.map((row, i) => { const m = new Map([...row].map(([j, v]) => [j, t * v])); m.set(i, (m.get(i) || 0) + mass[i]); return m })
  const delta = V.map((_, i) => (i === src ? 1 : 0)), u = cg(A, delta)
  // 2. In each triangle, the direction heat flows away: X = −∇u / |∇u|.
  const X = T.map(([a, b, c]) => {
    const N = cross(sub(V[b], V[a]), sub(V[c], V[a])), nh = N.map((x) => x / len(N))
    let g = [0, 0, 0]
    for (const [i, j, k] of [[a, b, c], [b, c, a], [c, a, b]]) { const ne = cross(nh, sub(V[k], V[j])); g = g.map((x, q) => x + u[i] * ne[q]) }
    return g.map((x) => -x / (len(g) || 1))
  })
  // 3. Its divergence at each vertex (cotan formula).
  const div = V.map(() => 0)
  T.forEach(([a, b, c], ti) => { for (const [i, j, k] of [[a, b, c], [b, c, a], [c, a, b]]) div[i] += 0.5 * (cotAt(V[i], V[j], V[k]) * dot(sub(V[j], V[i]), X[ti]) + cotAt(V[i], V[k], V[j]) * dot(sub(V[k], V[i]), X[ti])) })
  // 4. Poisson: C φ = −div (a tiny multiple of M pins the constant), then shift so the source is at 0.
  const P = C.map((row, i) => { const m = new Map(row); m.set(i, m.get(i) + 1e-8 * mass[i]); return m })
  const phi = cg(P, div.map((d) => -d)), base = phi[src]
  return { u, phi: phi.map((x) => x - base) }
}
// A flat square sheet [−1, 1]², N × N squares, each cut into two triangles.
function sheet(N, skip = () => false) {
  const V = [], T = [], id = (i, j) => i * (N + 1) + j
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) V.push([-1 + 2 * i / N, 0, -1 + 2 * j / N])
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (!skip(i, j)) T.push([id(i, j), id(i, j + 1), id(i + 1, j + 1)], [id(i, j), id(i + 1, j + 1), id(i + 1, j)])
  return { V, T, id }
}
`;

const EDGES = `${HEAT}
// The tempting shortcut: shortest path along the edges (Dijkstra). Predict first: from the centre of the sheet to the
// corner (1, −1), straight-line distance √2 = 1.4142. Along edges?
const N = 20, m = sheet(N), src = m.id(N / 2, N / 2)
const dist = m.V.map(() => Infinity); dist[src] = 0
const nb = m.V.map(() => new Set()); for (const t of m.T) t.forEach((a, k) => { nb[a].add(t[(k + 1) % 3]); nb[t[(k + 1) % 3]].add(a) })
const todo = new Set(m.V.keys())
while (todo.size) { let v = -1; for (const x of todo) if (v < 0 || dist[x] < dist[v]) v = x; todo.delete(v); for (const w of nb[v]) dist[w] = Math.min(dist[w], dist[v] + len(sub(m.V[w], m.V[v]))) }
for (const [i, j, name] of [[N, 0, 'corner (1, −1)'], [N, N, 'corner (1, 1)'], [N, N * 3 / 4, 'point (1, 0.5)']]) {
  const p = m.V[m.id(i, j)]
  console.log(name + ': along edges ' + r(dist[m.id(i, j)]) + ', straight line ' + r(Math.hypot(p[0], p[2])))
}`;

const STEP = `${HEAT}
// Step 1 alone: heat after one short step from the centre. Predict first: does it fall off evenly in every direction?
const N = 20, m = sheet(N), src = m.id(N / 2, N / 2)
const { u } = heatDistance(m, src)
for (const [i, j, name] of [[N / 2 + 2, N / 2, '0.2 along x'], [N / 2, N / 2 + 2, '0.2 along z'], [N / 2 + 4, N / 2, '0.4 along x'], [N / 2 + 8, N / 2, '0.8 along x']]) console.log(name + ': heat ' + u[m.id(i, j)].toExponential(2))
console.log('the heat is tiny far away and its size means little; only the direction it falls in is kept (step 2)')`;

const FLAT = `${HEAT}
// The whole method on the flat sheet, where the right answer is the straight-line distance. Predict first: how close?
const N = 20, m = sheet(N), src = m.id(N / 2, N / 2)
const { phi } = heatDistance(m, src)
let worst = 0, sum = 0
m.V.forEach((p, i) => { const e = Math.abs(phi[i] - Math.hypot(p[0], p[2])); worst = Math.max(worst, e); sum += e })
const corner = m.id(N, 0)
console.log('corner (1, −1): heat method ' + r(phi[corner]) + ', exact ' + r(Math.SQRT2) + '; along edges it was 2')
console.log('over all ' + m.V.length + ' vertices: mean error ' + r(sum / m.V.length) + ', worst ' + r(worst))`;

const SPHERE = `${HEAT}
// A unit sphere, distance from the north pole: exactly the angle down from it, π/2 at the equator, π at the south pole.
const S = 32, R = 16, V = [[0, 1, 0]], T = []
for (let i = 1; i < R; i++) for (let j = 0; j < S; j++) { const a = Math.PI * i / R, b = 2 * Math.PI * j / S; V.push([Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)]) }
V.push([0, -1, 0])
const at = (i, j) => 1 + (i - 1) * S + (j % S), south = V.length - 1
for (let j = 0; j < S; j++) T.push([0, at(1, j + 1), at(1, j)])
for (let i = 1; i < R - 1; i++) for (let j = 0; j < S; j++) T.push([at(i, j), at(i, j + 1), at(i + 1, j + 1)], [at(i, j), at(i + 1, j + 1), at(i + 1, j)])
for (let j = 0; j < S; j++) T.push([at(R - 1, j), at(R - 1, j + 1), south])
const { phi } = heatDistance({ V, T }, 0)
console.log('equator: ' + r(phi[at(R / 2, 0)]) + ' (π/2 = ' + r(Math.PI / 2) + '); south pole: ' + r(phi[south]) + ' (π = ' + r(Math.PI) + ')')
console.log('straight through the sphere, the south pole is 2 away: the surface distance is longer, as it should be')`;

const PICTURE = withPicture(`${HEAT}
// A sheet with a wall cut into it: the faces of a slot are removed. Distance from the left side has to go round the
// wall's end. Turbo colours: dark near the source, red far.
function turbo(t) { t = Math.min(1, Math.max(0, t)); const R = 0.13572138 + t * (4.6153926 + t * (-42.66032258 + t * (132.13108234 + t * (-152.94239396 + t * 59.28637943)))); const G = 0.09140261 + t * (2.19418839 + t * (4.84296658 + t * (-14.18503333 + t * (4.27729857 + t * 2.82956604)))); const B = 0.1066733 + t * (12.64194608 + t * (-60.58204836 + t * (110.36276771 + t * (-89.90310912 + t * 27.34824973)))); return [R, G, B].map((x) => Math.min(1, Math.max(0, x))) }
const N = 24, m = sheet(N, (i, j) => i === N / 2 && j < N * 3 / 4)       // the slot: a wall from z = −1 to z = 0.5
const used = new Set(m.T.flat()), src = m.id(N / 4, N / 4)                  // the source, left of the wall
const { phi } = heatDistance(m, src)
const across = m.id(3 * N / 4, N / 4), p = m.V[across], q = m.V[src]
console.log('the point straight across the wall: straight line ' + r(Math.hypot(p[0] - q[0], p[2] - q[2])) + ', along the sheet ' + r(phi[across]))
const hi = Math.max(...phi.filter((_, i) => used.has(i)))
show({ verts: m.V, faces: m.T, colors: phi.map((d) => turbo(d / hi)), zoom: 2.2 })`);

const CHALLENGE = `// A tube (a cylinder without its ends) of radius 1 and height 4. One point is on the bottom rim, the other on the top
// rim directly opposite it (half way round). How far apart are they walking on the tube?
const distance = 0
console.log(distance)`;

const SOLVED = CHALLENGE.replace('const distance = 0', 'const distance = Math.sqrt(Math.PI ** 2 + 16)');

/** The challenge's check: unroll the tube: π across, 4 up, so √(π² + 16) = 5.0862. */
export function checkTube(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+distance\s*=\s*([^\n]+)/);
  if (!m) return no('Keep the line const distance = …, with a number or an expression.');
  // Only arithmetic and a few Math functions are evaluated: this runs in the page, not the cell's sandbox.
  const expr = m[1].replace(/\/\/.*$/, '').trim().replace(/;$/, '');
  if (!/^[\d.,\s+\-*/()]*$/.test(expr.replace(/Math\.(sqrt|hypot|PI|pow)|\*\*/g, ''))) return no('Write the distance as a number, or arithmetic with Math.sqrt, Math.hypot, Math.PI and **.');
  let v;
  try { v = Number(new Function('return (' + expr + ')')()); } catch { return no('That expression did not run.'); }
  if (!Number.isFinite(v)) return no('The distance must be a number.');
  const right = Math.hypot(Math.PI, 4);
  if (Math.abs(v - right) < 1e-3) return { pass: true, message: `${+v.toFixed(4)}: unroll the tube into a flat rectangle 2π wide and 4 high; the two points are π apart across and 4 apart up, so the shortest walk is the straight line √(π² + 16) = 5.0862 on the unrolled sheet, a helix on the tube.` };
  if (v === 0) return no('Unroll the tube into a flat rectangle: how far apart are the two points across, and up?');
  if (Math.abs(v - Math.hypot(2, 4)) < 1e-3) return no('4.4721 is the straight line through the air inside the tube. Walking on the tube is longer.');
  if (Math.abs(v - (Math.PI + 4)) < 1e-3) return no('π + 4 is round the rim then straight up: not the shortest. Unrolled, the walk is the diagonal of that rectangle.');
  if (Math.abs(v - Math.hypot(2 * Math.PI, 4)) < 1e-3) return no('Opposite means half way round: π across, not the full circumference 2π.');
  return no(`${+v.toFixed(4)} is not the diagonal of a π × 4 rectangle.`);
}

export default {
  id: 'modelling-geometry-7-006',
  slug: 'distance-on-a-surface',
  chapter: 'modelling-geometry',
  order: 6,
  title: 'Distance on a surface',
  subtitle: 'How far apart two points are, walking on the surface: the heat method, two sparse solves.',
  tags: ['geodesic distance', 'heat method', 'poisson', 'dijkstra', 'discrete differential geometry', 'contours'],
  coreConcept: 'Geodesic distance is how far you walk between two points staying on the surface. Shortest paths along mesh edges overestimate it (they zigzag). The heat method computes it everywhere at once: let heat spread from the source for a short time t ≈ h², (M + tC)u = δ; in each triangle keep only the direction heat flows, X = −∇u/|∇u|; then solve the Poisson problem C φ = −∇·X for the function whose gradient best matches X, and shift so the source is at 0. It is exact to within a small discretisation error on flat sheets and spheres, and it goes round holes because heat only flows through the surface.',
  prerequisites: ['modelling-geometry-7-005', 'modelling-geometry-7-002'],
  timeToComplete: 45,
  nextLesson: 'modelling-geometry-7-007',

  hook: {
    question: 'An ant on a torus wants to reach a point on the far side. The straight line goes through the air, and the path along the mesh\'s edges zigzags. What is the true walking distance, and how can a computer find it to every point at once?',
    realWorldContext: 'Geodesic distance is used to place decals and textures evenly, to grow selections and brush falloffs over a model, to find symmetric points, to plan robot and tool paths on parts, and to compute shape descriptors for matching. The heat method made it a two-solve, interactive operation.',
  },

  intuition: {
    prose: [
      'The obvious idea is to walk along the mesh\'s edges: Dijkstra\'s shortest path. Before running cell 1, predict: on a flat sheet cut into right triangles, from the centre to the corner $(1, -1)$, straight-line distance $\\sqrt2 = 1.414$. Along edges? $2$: the diagonals all lean the other way, so the path staircases. Towards $(1, 1)$, where the diagonals point, it is exact; towards $(1, 0.5)$ it is $8\\%$ long. The error depends on direction and does not shrink as the mesh gets finer.',
      'The **heat method** avoids paths altogether. Step 1: put a spike of heat at the source and let it spread for a very short time $t = h^2$ ($h$ the edge length): one implicit step, the system $(M + tC)u = \\delta$ from lesson 7.5. Before running cell 2, predict: does the heat fall off evenly in all directions on a flat sheet? Yes, but its size is meaningless far away (cell 2 shows numbers spanning many orders of magnitude).',
      'Step 2 keeps only the **direction**: in each triangle, $X = -\\nabla u / |\\nabla u|$, a unit vector pointing away from the source. Whatever the size of $u$, heat flows away from where it started, along the surface.',
      'Step 3 asks: which function has gradient $X$? A true distance has gradient of length $1$ pointing away from the source. Solving the Poisson problem $C\\varphi = -\\nabla \\cdot X$ (lesson 7.5) finds the best fit; shifting so the source is $0$ gives the distance. Before running cell 3, predict how close it is on the flat sheet. At the corner $(1, -1)$ it gives $1.46$ against $1.414$: corners are where it is worst (a boundary pulls the solve slightly). Over all vertices the mean error is $0.02$, against $0.59$ for the edge path at that corner.',
      'On a sphere (cell 4) the answers are known exactly: $\\pi/2$ at the equator, $\\pi$ at the opposite pole; the heat method gets within about $1\\%$. And because heat only flows through the surface, distance goes **round** holes and slots: the picture\'s sheet has a wall cut into it, and the point just across the wall is much further away on the sheet than through the air.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: The heat method',
        body: 'Step 1. Build C (cotan) and M (areas); h = mean edge length, t = h².\nStep 2. Solve (M + tC) u = δ_source.\nStep 3. In each triangle, X = −∇u / |∇u|.\nStep 4. At each vertex, the integrated divergence ∇·X (cotan formula).\nStep 5. Solve C φ = −∇·X (with a tiny multiple of M, or φ fixed at the source).\nStep 6. Shift φ so the source is 0: the distance to every vertex.',
      },
      {
        type: 'warning',
        title: 'Edge paths overestimate',
        body: 'Dijkstra on mesh edges gives the shortest path through the graph, not over the surface: errors of up to 41% (on a square grid) that depend on direction and that refinement does not remove. Use it for connectivity, not for measurement.',
      },
      {
        type: 'warning',
        title: 'Choose t from the mesh',
        body: 'Too large a t blurs the heat, rounding the distance near sharp features; too small a t is numerically fragile. t = h², the mean edge length squared, is the recommended default.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: contour lines',
        body: 'Distance is shown best with iso-lines (lesson 7.8): rings at equal distance from the source, like contour lines on a map. Equally spaced, evenly sized rings mean the distance is right; bunched or warped rings reveal errors.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "distance on a surface is the straight-line distance". The sheet has a wall cut into it; the colours grow round the wall\'s end, and the point just across the wall is about 2.4 away on the sheet against 1 through the air.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'heatDistance() is the procedure: A and the first cg() call are Steps 1–2, X is Step 3, div Step 4, the second cg() Step 5, the shift Step 6.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'The result is a per-vertex field; drawn with a colour map and contour lines. Because both solves reuse the same matrices, a renderer can precompute their factorisations and answer new sources instantly.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Heat map › Distance from selected vertices. With Record traces on, the heat method is traced: cotan weights, the heat step, the unit directions, the divergence, and the Poisson solve (predict a neighbour\'s distance). Scripts call mesh.geodesic(v) and mesh.showField(\'geodesic\', { from: v }).' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: the heat method',
        caption: 'Edge paths against the truth, the heat step, the full method on a flat sheet and a sphere, and distance round a wall.',
        props: {
          lesson: {
            title: 'Distance on a surface',
            subtitle: 'Diffuse, normalise, solve.',
            cells: [
              { type: 'js', instruction: '### 1. Along the edges\nPredict first: the edge-path distance to the corner.', startCode: EDGES },
              { type: 'js', instruction: '### 2. One heat step\nPredict first: how the heat falls off.', startCode: STEP },
              { type: 'js', instruction: '### 3. The whole method, on a flat sheet\nPredict first: how close to the straight-line distance?', startCode: FLAT },
              { type: 'js', instruction: '### 4. A sphere\nAgainst the exact distances.', startCode: SPHERE },
              { type: 'js', instruction: '### 5. See it\nA sheet with a wall cut into it, coloured by distance from a point on the left. Drag to turn.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 340 },
              { type: 'challenge', instruction: '### 6. Challenge: across a tube\nUnroll it. The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkTube },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Distance on a surface" in MeshLab](#/lab/mesh-lab?project=geodesic-distance). Distance from a globe\'s north pole is traced: press Play, and predict a neighbour\'s distance at the end. Then pick two sources.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Edit mode, select vertices, Heat map › Distance from selected vertices.**\n- In a script: `mesh.geodesic(v)` returns the distances; `mesh.showField(\'geodesic\', { from: v })` colours them with contours.\n- [Open "Distance on a knot" in MeshLab](#/lab/mesh-lab?project=knot-distance) and the [farthest point challenge](#/lab/mesh-lab?challenge=farthest-point).\n- **Elsewhere:** libigl\'s `heat_geodesics`, geometry-central\'s HeatMethodDistanceSolver.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Varadhan\'s formula.** Heat spreading from a point for time $t$ satisfies $d(x, y) = \\lim_{t \\to 0} \\sqrt{-4t \\log u_t(x, y)}$: as $t$ shrinks, the heat kernel encodes distance. Taking the log directly is numerically hopeless, but the formula says something robust: the heat\'s **gradient direction** is the distance\'s gradient direction.',
      '**From direction to distance.** Distance $\\varphi$ satisfies the eikonal equation $|\\nabla\\varphi| = 1$, with $\\nabla\\varphi$ pointing away from the source. Given the unit field $X$, find $\\varphi$ minimising $\\int |\\nabla\\varphi - X|^2$: its Euler–Lagrange equation is the Poisson problem $\\Delta\\varphi = \\nabla \\cdot X$, with the cotan Laplacian and a cotan divergence on a mesh.',
      '**The discrete divergence.** For vertex $i$ in triangle $(i, j, k)$ with unit vector $X$: $\\tfrac12\\big(\\cot\\theta_k\\,(e_{ij} \\cdot X) + \\cot\\theta_j\\,(e_{ik} \\cdot X)\\big)$, summed over its triangles. It is exactly the transpose of the cotan gradient, so the Poisson problem is the least-squares fit.',
      '**Cost.** Two sparse SPD solves. The matrices $M + tC$ and $C$ depend only on the mesh, so they can be factored once; then each new set of sources costs two triangular solves, which is why the heat method is interactive.',
    ],
    equations: [
      { label: 'Heat step', latex: '(M + tC)\\,u = \\delta, \\quad t = h^2' },
      { label: 'Direction', latex: 'X = -\\frac{\\nabla u}{|\\nabla u|}' },
      { label: 'Poisson', latex: 'C\\,\\varphi = -\\nabla \\cdot X' },
      { label: 'Varadhan', latex: 'd(x, y) = \\lim_{t \\to 0}\\sqrt{-4t\\log u_t(x, y)}' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** On a triangle mesh with t = h² and well-shaped triangles, the heat-method distance converges to the geodesic distance as h → 0 (with errors comparable to other first-order methods); it is exact for the gradient direction where the heat kernel\'s direction is, and robust to noise because it never differentiates the distance itself.',
      '**Invariant viewpoint.** It depends only on the surface\'s intrinsic geometry (lengths and angles), so bending a surface without stretching leaves every distance unchanged, and so does any rigid motion.',
      '**Geometric picture.** Drop ink on a wet surface: the first moment it spreads, its front moves outward along the shortest routes. Recording only which way the ink is moving, then integrating those directions, recovers how far every point is.',
      '**Where this goes.** Lesson 7.7 uses the heat equation to smooth; lesson 7.8 draws distance\'s contour lines; chapter 10\'s automatic skin weights diffuse from bones the same way.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-7-006-ex1',
      title: 'A staircase',
      problem: 'On a square grid (edges only along x and z, length 0.1), the edge path from $(0, 0)$ to $(1, 1)$?',
      steps: [{ expression: '1 + 1 = 2', annotation: '10 steps along x, 10 along z.' }],
      conclusion: '2, against √2 = 1.414: 41% too long, at any grid spacing.',
    },
    {
      id: 'modelling-geometry-7-006-ex2',
      title: 'Choosing t',
      problem: 'A mesh has mean edge length $0.05$. What heat time does the method use?',
      steps: [{ expression: 't = h^2 = 0.0025', annotation: 'Short enough to keep the direction sharp.' }],
      conclusion: 't = 0.0025.',
    },
    {
      id: 'modelling-geometry-7-006-ex3',
      title: 'A sphere\'s distances',
      problem: 'On a sphere of radius 3, how far is the equator from the north pole, walking?',
      steps: [{ expression: 'r\\,\\theta = 3 \\times \\tfrac{\\pi}{2} = 4.712', annotation: 'Arc length.' }],
      conclusion: '4.712; through the sphere it would be 3√2 = 4.243.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-7-006-ch1',
      difficulty: 'easy',
      problem: 'Why does the heat method normalise ∇u instead of using u directly?',
      walkthrough: [{ expression: '\\text{u\'s size depends on t and decays enormously}', annotation: 'Its direction does not.' }],
      answer: 'The amount of heat far from the source is tiny and depends on t; only the direction it flows is reliable. Normalising keeps that direction and throws away the unreliable size.',
    },
    {
      id: 'modelling-geometry-7-006-ch2',
      difficulty: 'medium',
      problem: 'A sheet has a slot cut into it. Why does the heat method go round the slot, while Euclidean distance does not?',
      walkthrough: [
        { expression: '\\text{heat flows only through triangles}', answer: '' },
      ],
      answer: 'The slot\'s triangles are missing, so the cotan matrix has no connections across it: heat, and therefore the direction field and the Poisson solve, can only flow round the end. Euclidean distance ignores the surface entirely.',
    },
    {
      id: 'modelling-geometry-7-006-ch3',
      difficulty: 'hard',
      problem: 'Explain why the Poisson step gives the least-squares best φ for the field X.',
      walkthrough: [
        { expression: '\\min_\\varphi \\sum_T A_T\\,|\\nabla\\varphi - X_T|^2', annotation: 'Fit the gradient.' },
        { expression: 'G^{\\mathrm{T}}A G\\varphi = G^{\\mathrm{T}}A X', annotation: 'Normal equations: G the gradient operator.' },
        { expression: 'G^{\\mathrm{T}}AG = C, \\; G^{\\mathrm{T}}AX = -\\nabla\\cdot X', annotation: 'Cotan Laplacian and divergence.' },
      ],
      answer: 'Minimising the area-weighted squared difference between ∇φ and X gives normal equations GᵀAGφ = GᵀAX, where G is the per-triangle gradient. GᵀAG is the cotan Laplacian C and GᵀAX is minus the cotan divergence, so the Poisson problem Cφ = −∇·X is exactly the least-squares fit.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'd(x, y)', meaning: 'Geodesic distance: the shortest walk on the surface.' },
      { symbol: 'u', meaning: 'Heat after one short step from the source.' },
      { symbol: 't = h^2', meaning: 'The heat time: the mean edge length squared.' },
      { symbol: 'X', meaning: 'The unit direction heat flows in each triangle.' },
      { symbol: '\\nabla \\cdot X', meaning: 'Its divergence at each vertex.' },
      { symbol: '\\varphi', meaning: 'The function whose gradient best matches X: the distance.' },
    ],
    rulesOfThumb: [
      'Edge paths staircase; do not measure with them.',
      'Diffuse, normalise, solve.',
      't = h².',
      'Distance goes round holes.',
      'Check with contours: evenly spaced rings.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-7-005', label: 'Sparse linear systems', note: 'The two solves the method needs.' },
      { lessonId: 'modelling-geometry-7-002', label: 'The Laplacian', note: 'The cotan matrix in both solves.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-7-007', label: 'Smoothing as heat flow', note: 'The heat equation used to smooth.' },
      { lessonId: 'modelling-geometry-7-008', label: 'Level sets and contours', note: 'Drawing equal-distance lines.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-7-006-1', label: 'Read why edge paths are wrong', type: 'read' },
    { id: 'cp-modelling-geometry-7-006-2', label: 'Read the three steps of the heat method', type: 'read' },
    { id: 'cp-modelling-geometry-7-006-3', label: 'Read why the Poisson step recovers distance', type: 'read' },
    { id: 'cp-modelling-geometry-7-006-4', label: 'Run cells 1 to 4: edges, heat, flat sheet, sphere', type: 'lab' },
    { id: 'cp-modelling-geometry-7-006-5', label: 'Trace the heat method on a globe in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-7-006-6', label: 'Work through example 1, a staircase', type: 'example' },
    { id: 'cp-modelling-geometry-7-006-7', label: 'Work through example 3, a sphere\'s distances', type: 'example' },
    { id: 'cp-modelling-geometry-7-006-8', label: 'Complete the challenge: across a tube', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-7-006-assess-1',
        type: 'choice',
        text: 'On a unit sphere, the walking distance between two points on the equator a quarter of the way round from each other is:',
        options: ['π/2', '√2', 'π', '1'],
        answer: 'π/2',
        hint: 'Arc length: radius × angle.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-7-006-quiz-1',
      type: 'choice',
      text: 'On the flat sheet, the edge-path distance from the centre to the corner (1, −1), against the diagonals, is:',
      options: ['2, longer than √2', 'Exactly √2', 'Shorter than √2', '1'],
      answer: '2, longer than √2',
      hints: ['Cell 1.', 'A staircase.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-7-006-quiz-2',
      type: 'choice',
      text: 'What does the heat method keep from the heat u?',
      options: ['Only its direction in each triangle', 'Its size', 'Its log', 'Nothing'],
      answer: 'Only its direction in each triangle',
      hints: ['X = −∇u/|∇u|.', 'Challenge 1.'],
      reviewSection: 'Intuition',
    },
    {
      id: 'modelling-geometry-7-006-quiz-3',
      type: 'choice',
      text: 'How many sparse linear solves does the heat method need?',
      options: ['Two', 'One', 'One per vertex', 'None'],
      answer: 'Two',
      hints: ['Heat, then Poisson.', 'Procedure.'],
      reviewSection: 'Procedure',
    },
    {
      id: 'modelling-geometry-7-006-quiz-4',
      type: 'choice',
      text: 'Heat-method distance from a unit sphere\'s north pole to its south pole is about:',
      options: ['π', '2', 'π/2', '1'],
      answer: 'π',
      hints: ['Cell 4.', 'Half a great circle.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-7-006-quiz-5',
      type: 'choice',
      text: 'Why does distance go round a slot cut in a sheet?',
      options: ['Heat can only flow through the remaining triangles', 'The slot is a crease', 'Euclidean distance is used', 'It does not'],
      answer: 'Heat can only flow through the remaining triangles',
      hints: ['Challenge 2.', 'The picture.'],
      reviewSection: 'Cell 5',
    },
    {
      id: 'modelling-geometry-7-006-quiz-6',
      type: 'choice',
      text: 'What heat time does the method use?',
      options: ['t = h², the mean edge length squared', 't = 1', 'As long as possible', 't = h'],
      answer: 't = h², the mean edge length squared',
      hints: ['Warning "Choose t from the mesh".', 'Example 2.'],
      reviewSection: 'Warning "Choose t from the mesh"',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'The shortest path along edges is the surface distance.',
      whyStudentsThinkIt: 'Edges lie on the surface.',
      correctionExample: 'Cell 1: 2 along edges against 1.414 straight across the flat sheet, to the corner (1, −1).',
      contrastCase: 'Towards (1, 1), where the diagonals point, the edges align with the shortest path and agree.',
    },
    {
      falseBelief: 'Surface distance is the straight-line distance.',
      whyStudentsThinkIt: 'On a flat sheet they agree.',
      correctionExample: 'Cell 4 and the picture: π against 2 through a sphere; 2.4 against 1 round a wall.',
      contrastCase: 'On a flat sheet with no holes, they are the same (cell 3).',
    },
    {
      falseBelief: 'The heat method needs to run heat for a long time.',
      whyStudentsThinkIt: 'Heat has to reach everywhere.',
      correctionExample: 'One short step (t = h²) is enough: only the direction is used, and it is right even where the heat is tiny.',
      contrastCase: 'Long times blur the direction field and round off the distance.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A brush on a 3D model must affect everything within 2 cm along the surface, not through it (an ear must not paint the cheek).',
      competingTechniques: ['A sphere of radius 2 cm', 'Geodesic distance from the brush centre'],
      whyThisTechniqueWins: 'Geodesic distance measures along the skin; a sphere reaches through thin gaps to the other side.',
    },
    {
      situation: 'Distances from many different sources must be computed on the same mesh interactively.',
      competingTechniques: ['Dijkstra from each source', 'The heat method with prefactored matrices'],
      whyThisTechniqueWins: 'The matrices depend only on the mesh; once factored, each new source costs two cheap back-substitutions, and the result is more accurate than edge paths.',
    },
  ],

  debugging: [
    {
      commonError: 'Using u itself (or −log u) as the distance.',
      symptom: 'Distances are wildly off far from the source, or numerically noisy.',
      whyItHappened: 'u decays enormously; its size is unreliable.',
      repairStrategy: 'Use only its normalised gradient, then solve the Poisson problem.',
    },
    {
      commonError: 'Solving the Poisson problem with a pure Laplacian.',
      symptom: 'CG drifts; the answer has an arbitrary offset or does not converge.',
      whyItHappened: 'Constants are in C\'s null space.',
      repairStrategy: 'Add a tiny multiple of M (or pin the source), then shift so the source is 0.',
    },
    {
      commonError: 'A heat time far too large.',
      symptom: 'Distances rounded off near the source and near sharp features.',
      whyItHappened: 'Heat spread too far, blurring the direction.',
      repairStrategy: 'Use t = h².',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Run the heat method on a mesh and check it against known distances.',
    explainVerbally: 'Explain why edge paths fail, why the method keeps only directions, and why the Poisson step recovers distance.',
    detectIncorrectApplication: 'Recognise staircase errors, wrong heat times and unpinned Poisson solves.',
    transferToUnfamiliar: 'Use geodesic distance for brushes, selections, decals and path planning.',
  },
};
