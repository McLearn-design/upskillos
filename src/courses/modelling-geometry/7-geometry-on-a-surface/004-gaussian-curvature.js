// Lesson 7.4: Gaussian curvature. At a vertex, the angles of the triangles round it add up to 360° on a flat surface;
// the shortfall, the angle defect, is the curvature concentrated there, and divided by the vertex's area it is K, the
// product of the principal curvatures. Summed over a closed surface the defects always give 2πχ (Gauss–Bonnet):
// shape only moves curvature around.
import { withPicture } from '../notebookScene.js';

const HELPERS = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const sub = (a, b) => a.map((x, i) => x - b[i])
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a) => Math.hypot(...a)
const deg = (x) => r(x * 180 / Math.PI)
// The angle sum and area (a third of each triangle) at every vertex of a triangle mesh.
function angleSums(V, T) {
  const sum = V.map(() => 0), area = V.map(() => 0)
  for (const t of T) t.forEach((i, k) => {
    const u = sub(V[t[(k + 1) % 3]], V[i]), w = sub(V[t[(k + 2) % 3]], V[i])
    sum[i] += Math.atan2(len(cross(u, w)), dot(u, w)); area[i] += len(cross(u, w)) / 6
  })
  return { sum, area }
}
`;

const DEFECTS = `${HELPERS}
// Predict first: the angles round a vertex of each of these, and the defect 360° − sum.
for (const [name, angles] of [['flat grid of squares', [90, 90, 90, 90]], ['cube corner', [90, 90, 90]], ['octahedron corner', [60, 60, 60, 60]], ['icosahedron corner', [60, 60, 60, 60, 60]], ['5 squares round a vertex', [90, 90, 90, 90, 90]]]) {
  const sum = angles.reduce((a, b) => a + b)
  console.log(name + ': angles add up to ' + sum + '°, defect ' + (360 - sum) + '°' + (sum < 360 ? ': it closes up like a cone' : sum > 360 ? ': too much angle, it ruffles into a saddle' : ': flat'))
}`;

const BONNET = `${HELPERS}
// Gauss–Bonnet: on a closed surface the defects add up to 2π χ, χ = V − E + F (lesson 1.5).
// Predict first: cube, octahedron and icosahedron are very different shapes. Their total defects?
for (const [name, V, perVertexDefect, E, F] of [['cube', 8, 90, 12, 6], ['octahedron', 6, 120, 12, 8], ['icosahedron', 12, 60, 30, 20]]) {
  console.log(name + ': ' + V + ' × ' + perVertexDefect + '° = ' + V * perVertexDefect + '°; χ = ' + V + ' − ' + E + ' + ' + F + ' = ' + (V - E + F) + ', 2πχ = ' + 360 * (V - E + F) + '°')
}
// A torus made of quads split into triangles: every vertex is a corner of 6 triangles.
const n = 12, m = 8, R = 1.4, rr = 0.45, V = [], T = []
for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = 2 * Math.PI * i / n, b = 2 * Math.PI * j / m; V.push([(R + rr * Math.cos(b)) * Math.cos(a), rr * Math.sin(b), (R + rr * Math.cos(b)) * Math.sin(a)]) }
const at = (i, j) => (i % n) * m + (j % m)
for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) T.push([at(i, j), at(i, j + 1), at(i + 1, j + 1)], [at(i, j), at(i + 1, j + 1), at(i + 1, j)])
const { sum } = angleSums(V, T)
const total = sum.reduce((s, x) => s + (2 * Math.PI - x), 0)
console.log('torus: defects from ' + deg(Math.min(...sum.map((x) => 2 * Math.PI - x))) + '° to ' + deg(Math.max(...sum.map((x) => 2 * Math.PI - x))) + '°, total ' + deg(total) + '°; χ = 0')`;

// A UV sphere as triangles, as in lesson 7.3.
const SPHERE = `function sphere(rad, S = 24, R = 12) {
  const V = [[0, rad, 0]], T = []
  for (let i = 1; i < R; i++) for (let j = 0; j < S; j++) { const t = Math.PI * i / R, p = 2 * Math.PI * j / S; V.push([rad * Math.sin(t) * Math.cos(p), rad * Math.cos(t), rad * Math.sin(t) * Math.sin(p)]) }
  V.push([0, -rad, 0])
  const at = (i, j) => 1 + (i - 1) * S + (j % S), south = V.length - 1
  for (let j = 0; j < S; j++) T.push([0, at(1, j + 1), at(1, j)])
  for (let i = 1; i < R - 1; i++) for (let j = 0; j < S; j++) T.push([at(i, j), at(i, j + 1), at(i + 1, j + 1)], [at(i, j), at(i + 1, j + 1), at(i + 1, j)])
  for (let j = 0; j < S; j++) T.push([at(R - 1, j), at(R - 1, j + 1), south])
  return { V, T }
}
`;

const SPHERES = `${HELPERS}${SPHERE}
// K = defect / area. Predict first: a sphere of radius 1 has K = 1 (1/r · 1/r). Radius 2?
for (const rad of [1, 2]) {
  const { V, T } = sphere(rad), { sum, area } = angleSums(V, T)
  const K = sum.map((s, i) => (2 * Math.PI - s) / area[i]), mean = K.reduce((a, b) => a + b) / K.length
  console.log('sphere of radius ' + rad + ': K mean ' + r(mean) + ', total defect ' + deg(sum.reduce((s, x) => s + 2 * Math.PI - x, 0)) + '°')
}`;

const COMPARE = `${HELPERS}
// H and K side by side. A saddle z = x² − y² (here y is up: y = x² − z²) bends up one way and down the other:
// principal curvatures +2 and −2 at its centre. Predict first: H and K there?
const N = 20, V = [], T = []
for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { const x = -0.5 + i / N, z = -0.5 + j / N; V.push([x, x * x - z * z, z]) }
const id = (i, j) => i * (N + 1) + j
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) T.push([id(i, j), id(i, j + 1), id(i + 1, j + 1)], [id(i, j), id(i + 1, j + 1), id(i + 1, j)])
const { sum, area } = angleSums(V, T), c = id(N / 2, N / 2)
console.log('saddle centre: angles add up to ' + deg(sum[c]) + '°, K = ' + r((2 * Math.PI - sum[c]) / area[c]) + ' (the exact value is κ₁κ₂ = 2 × −2 = −4), while H = (2 − 2)/2 = 0')
// A cylinder: one direction bends, the other does not. K = κ₁κ₂ = (1/r)(0) = 0: its angles add up to 360°.
const S = 24, CV = [], CT = []
for (const y of [-1, 0, 1]) for (let j = 0; j < S; j++) CV.push([Math.cos(2 * Math.PI * j / S), y, Math.sin(2 * Math.PI * j / S)])
for (let k = 0; k < 2; k++) for (let j = 0; j < S; j++) { const a = k * S + j, b = k * S + (j + 1) % S, cc = (k + 1) * S + (j + 1) % S, d = (k + 1) * S + j; CT.push([a, d, cc], [a, cc, b]) }
const cyl = angleSums(CV, CT)
console.log('cylinder, middle ring: angles add up to ' + deg(cyl.sum[S]) + '°: K = 0, though H = 1/(2r) = 0.5')`;

const PICTURE = withPicture(`${HELPERS}
// A torus coloured by K, diverging: red where it is dome-like (outside), blue where it is a saddle (round the hole).
function coolwarm(t) { t = Math.min(1, Math.max(0, t)); const lo = [0.23, 0.3, 0.75], mid = [0.87, 0.87, 0.87], hi = [0.71, 0.02, 0.15]; const [a, b, u] = t < 0.5 ? [lo, mid, t * 2] : [mid, hi, (t - 0.5) * 2]; return a.map((x, k) => x + (b[k] - x) * u) }
const n = 32, m = 16, R = 1.4, rr = 0.5, V = [], T = []
for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = 2 * Math.PI * i / n, b = 2 * Math.PI * j / m; V.push([(R + rr * Math.cos(b)) * Math.cos(a), rr * Math.sin(b), (R + rr * Math.cos(b)) * Math.sin(a)]) }
const at = (i, j) => (i % n) * m + (j % m)
for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) T.push([at(i, j), at(i, j + 1), at(i + 1, j + 1)], [at(i, j), at(i + 1, j + 1), at(i + 1, j)])
const { sum, area } = angleSums(V, T), K = sum.map((s, i) => (2 * Math.PI - s) / area[i])
const reach = Math.max(...K.map(Math.abs))
console.log('K from ' + r(Math.min(...K)) + ' (inside) to ' + r(Math.max(...K)) + ' (outside); the defects add up to ' + deg(sum.reduce((s, x) => s + 2 * Math.PI - x, 0)) + '°')
show({ verts: V, faces: T, colors: K.map((k) => coolwarm(0.5 + k / (2 * reach))), zoom: 1.1 })`);

const CHALLENGE = `// (a) Seven equilateral triangles meet at a vertex. What is its angle defect, in degrees?
// (b) A closed mesh shaped like a pretzel with two holes has χ = −2. What do all its defects add up to, in degrees?
const answer = { vertex: 0, total: 0 }
console.log(answer)`;

const SOLVED = CHALLENGE.replace('const answer = { vertex: 0, total: 0 }', 'const answer = { vertex: -60, total: -720 }');

/** The challenge's check: 360 − 7 × 60 = −60°; 2π χ = 360° × −2 = −720°. */
export function checkDefects(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+answer\s*=\s*\{([^}]*)\}/);
  if (!m) return no('Keep the line const answer = { vertex: …, total: … }.');
  const get = (k) => { const g = m[1].match(new RegExp(k + '\\s*:\\s*(-?[\\d.]+)')); return g ? Number(g[1]) : NaN; };
  const vertex = get('vertex'), total = get('total');
  if ([vertex, total].some(Number.isNaN)) return no('Give both as numbers: vertex and total.');
  if (vertex === 60) return no('Seven 60° angles add up to 420°, more than 360°: the defect 360° − 420° is negative.');
  if (vertex === 420) return no('420° is the angle sum. The defect is 360° minus it.');
  if (vertex !== -60) return no(`360° − 7 × 60° is not ${vertex}.`);
  if (total === 720) return no('720° is a sphere\'s total (χ = 2). This shape has χ = −2.');
  if (total === -360) return no('The total is 2π χ: 360° per unit of χ, so −2 gives −720°.');
  if (total !== -720) return no(`360° × χ with χ = −2 is not ${total}.`);
  return { pass: true, message: '−60° and −720°. Seven triangles give too much angle (420°), a saddle-like vertex with negative defect. A two-holed pretzel has χ = −2, so its curvature must add up to 2π × −2 = −720°, however it is shaped: more saddle than dome overall.' };
}

export default {
  id: 'modelling-geometry-7-004',
  slug: 'gaussian-curvature',
  chapter: 'modelling-geometry',
  order: 4,
  title: 'Gaussian curvature',
  subtitle: 'Add up the angles round a vertex: what is missing from 360° is curvature, and the total never changes.',
  tags: ['gaussian curvature', 'angle defect', 'gauss-bonnet', 'topology', 'curvature', 'discrete differential geometry'],
  coreConcept: 'Round a vertex of a flat surface the angles of its triangles add up to 360°. On a curved surface they do not: the shortfall, the angle defect 2π − Σθ, is the curvature concentrated at that vertex, and divided by the vertex\'s area it is the Gaussian curvature K = κ₁κ₂: positive on domes, zero on planes and cylinders, negative on saddles. Gauss–Bonnet says the defects of a closed surface always add up to 2πχ: 4π for anything shaped like a sphere, 0 for a torus. Deforming a surface only moves its curvature around.',
  prerequisites: ['modelling-geometry-7-003', 'modelling-geometry-1-005'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-7-005',

  hook: {
    question: 'A cube has no curved faces at all, yet it is shaped like a ball. Where is its curvature? And why do a cube, an octahedron and a sphere, wildly different shapes, all have exactly the same total amount of it?',
    realWorldContext: 'Gaussian curvature decides whether a flat sheet can be bent onto a surface without stretching: cylinders and cones (K = 0) can be rolled from paper, spheres cannot, which is why maps of the Earth distort and why sheet-metal and garment patterns need darts and seams. UV unwrapping (chapter 8) fights the same fact.',
  },

  intuition: {
    prose: [
      'Take a flat grid of squares: four $90°$ angles meet at each vertex and add up to $360°$. Now take a cube\'s corner: only three, $270°$. The missing $90°$ is the **angle defect**: you could cut a $90°$ wedge out of a flat sheet and fold the rest into that corner.',
      'Before running cell 1, predict the defects at a corner of an octahedron (four $60°$ angles) and of an icosahedron (five): $120°$ and $60°$. And five squares round a vertex: $450°$, a defect of $-90°$. Too much angle cannot lie flat; it ruffles into a **saddle**.',
      'The defect is curvature concentrated at a point. Spread over the vertex\'s area, it is the **Gaussian curvature** $K = (2\\pi - \\sum\\theta)/A$. On a smooth surface $K = \\kappa_1\\kappa_2$, the product of the principal curvatures (lesson 7.3): $1/r^2$ on a sphere, $0$ on a plane or a cylinder (one bend is $0$), negative on a saddle (the bends have opposite signs).',
      'Now the surprise. Before running cell 2, predict the total defect of a cube, an octahedron and an icosahedron: $8 \\times 90°$, $6 \\times 120°$, $12 \\times 60°$. All $720°$, which is $4\\pi$. This is **Gauss–Bonnet**: on a closed surface the defects always add up to $2\\pi\\chi$, with $\\chi = V - E + F$ (lesson 1.5). A torus ($\\chi = 0$) has red, dome-like curvature outside and blue saddles round the hole, exactly balancing to $0$.',
      'So $K$ and $H$ answer different questions (cell 4). $H$ says how much the surface bends on average, $K$ whether it can be flattened: a cylinder has $H = 0.5$ but $K = 0$ (its angles add up to $360°$), a saddle has $H = 0$ but $K = -4$. And lesson 5.9\'s pole budget, $\\sum(4 - \\text{valence}) = 4\\chi$, is Gauss–Bonnet for a grid of squares, each missing edge of a pole being a missing $90°$.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Gaussian curvature by angle defect',
        body: 'Step 1. At each vertex, add up the angles of the triangles round it: Σθ.\nStep 2. Defect δ = 2π − Σθ (on an open edge, π − Σθ).\nStep 3. Area A: a third of each triangle round the vertex (or the mixed area, lesson 7.3).\nStep 4. K = δ / A.\nStep 5. Check: on a closed mesh, Σ δ = 2π χ.',
      },
      {
        type: 'warning',
        title: 'Open edges need a different rule',
        body: 'A vertex on an open edge has only half a fan: its flat value is π, not 2π. Using 2π there makes every border vertex look hugely curved. On meshes with borders, Gauss–Bonnet also includes the turning of the border curve.',
      },
      {
        type: 'warning',
        title: 'K alone cannot tell a cylinder from a plane',
        body: 'Both have K = 0. Use H as well: (H, K) together say dome (K > 0), saddle (K < 0) or one-way bend (K = 0, H ≠ 0).',
      },
      {
        type: 'insight',
        title: 'The graphics strand: the heat map',
        body: 'K shown with a diverging map separates dome-like regions (red) from saddles (blue) at a glance, which is what modellers check before unwrapping (red and blue regions will stretch in UV space) and before bending sheet material.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "a torus is curved like a ball, everywhere". Its outside is red (dome-like, K > 0), the inside of its hole blue (saddle, K < 0), and the top and bottom circles white (K = 0). The reds and blues add up to exactly zero: Gauss–Bonnet with χ = 0.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'angleSums() in the cells is Steps 1 and 3; 2π − sum is Step 2; dividing by the area Step 4; the totals in cells 2 and 3 are Step 5.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Another per-vertex field, drawn with lesson 7.1\'s diverging colour map.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Heat map › Gaussian curvature (K). With Record traces on it is traced: the angle sums, one vertex\'s defect (predict it), and the Gauss–Bonnet total against 2πχ. Scripts call mesh.curvature(\'gaussian\').' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: curvature from angles',
        caption: 'Defects at familiar corners, Gauss–Bonnet totals, K on spheres, K against H, and a torus coloured by K.',
        props: {
          lesson: {
            title: 'Gaussian curvature',
            subtitle: 'What is missing from 360°.',
            cells: [
              { type: 'js', instruction: '### 1. Angle defects\nPredict first: an octahedron\'s and an icosahedron\'s corners.', startCode: DEFECTS },
              { type: 'js', instruction: '### 2. Gauss–Bonnet\nPredict first: the total defects of three very different solids.', startCode: BONNET },
              { type: 'js', instruction: '### 3. Spheres\nPredict first: K for a sphere of radius 2.', startCode: SPHERES },
              { type: 'js', instruction: '### 4. K against H\nPredict first: H and K at a saddle\'s centre.', startCode: COMPARE },
              { type: 'js', instruction: '### 5. See it\nA torus coloured by K. Drag to turn.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 340 },
              { type: 'challenge', instruction: '### 6. Challenge: defects\nOne vertex, and a whole pretzel. The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkDefects },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Gaussian curvature" in MeshLab](#/lab/mesh-lab?project=gaussian-curvature). A torus\'s K is traced: press Play, predict one vertex\'s defect, and check the total is 0. Then add a cube and see its curvature sit at the eight corners.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Heat map › Gaussian curvature (K).**\n- In a script: `mesh.curvature(\'gaussian\')`.\n- [Open "Curvature gallery" in MeshLab](#/lab/mesh-lab?project=curvature-gallery) to compare H and K on several shapes.\n- **Elsewhere:** Blender\'s Curvature attribute; in UV work (chapter 8), regions of large |K| are where a flat texture must stretch.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Gaussian curvature.** At a point with principal curvatures $\\kappa_1, \\kappa_2$, $K = \\kappa_1\\kappa_2$. Gauss\'s *Theorema Egregium*: $K$ depends only on distances measured within the surface, not on how it sits in space. That is why a sheet of paper (K = 0) can be rolled into a cylinder (K = 0) but never wrapped smoothly onto a sphere (K > 0).',
      '**The discrete version.** Round a vertex, the triangles\' angles add up to $\\sum\\theta$. Flattened, they would fill $2\\pi$; the defect $\\delta = 2\\pi - \\sum\\theta$ is the integral of $K$ over the vertex\'s region, so $K \\approx \\delta / A$. It needs no normals and no second derivatives: only angles.',
      '**Gauss–Bonnet.** For a closed surface, $\\int K\\,dA = 2\\pi\\chi$. Discretely, $\\sum_v \\delta_v = 2\\pi V - \\sum(\\text{all angles}) = 2\\pi V - \\pi F_\\triangle = 2\\pi(V - E + F)$, using $\\sum(\\text{angles}) = \\pi F_\\triangle$ and $3F_\\triangle = 2E$ for a closed triangle mesh. Exact, for every mesh.',
      '**With borders.** $\\int K\\,dA + \\int k_g\\,ds = 2\\pi\\chi$, where $k_g$ is the geodesic curvature of the border; discretely, border vertices contribute $\\pi - \\sum\\theta$.',
    ],
    equations: [
      { label: 'Angle defect', latex: '\\delta_i = 2\\pi - \\sum_{\\text{triangles at } i} \\theta' },
      { label: 'Gaussian curvature', latex: 'K_i = \\frac{\\delta_i}{A_i} \\approx \\kappa_1\\kappa_2' },
      { label: 'Gauss–Bonnet', latex: '\\sum_i \\delta_i = 2\\pi\\chi = 2\\pi(V - E + F)' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** For a closed triangle mesh, the angle defects satisfy $\\sum_i \\delta_i = 2\\pi\\chi$ exactly; for meshes inscribed in a smooth surface with shrinking, well-shaped triangles, $\\delta_i / A_i$ converges to $K$ in an integrated sense.',
      '**Invariant viewpoint.** The defect depends only on angles, so it is unchanged by bending the mesh without stretching its triangles (isometries), exactly as Theorema Egregium says of K. The total depends only on topology (χ).',
      '**Geometric picture.** Curvature is like a fixed amount of fabric pucker: you can push it from the corners of a cube into a smooth sphere, but never get rid of it; only cutting (changing χ) changes the total.',
      '**Where this goes.** Lesson 5.9\'s pole budget is the quad-grid version of Gauss–Bonnet; chapter 8 shows why regions of large |K| distort when unwrapped.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-7-004-ex1',
      title: 'A pyramid\'s tip',
      problem: 'Four triangles meet at a pyramid\'s tip, each with a $50°$ angle there. The defect?',
      steps: [{ expression: '360° - 4 \\times 50° = 160°', annotation: 'A sharp cone point.' }],
      conclusion: '160°: most of a closed shape\'s 720° can sit at one sharp point.',
    },
    {
      id: 'modelling-geometry-7-004-ex2',
      title: 'K from a defect',
      problem: 'A vertex has defect $0.06$ radians and area $0.02$. What is $K$, and what sphere has that curvature?',
      steps: [
        { expression: 'K = 0.06 / 0.02 = 3', annotation: 'Step 4.' },
        { expression: '1/r^2 = 3 \\Rightarrow r = 0.577', annotation: 'On a sphere K = 1/r².' },
      ],
      conclusion: 'K = 3, like a sphere of radius 0.577.',
    },
    {
      id: 'modelling-geometry-7-004-ex3',
      title: 'Gauss–Bonnet on a torus',
      problem: 'A torus mesh has $V = 96$, $E = 288$, $F = 192$ (triangles). What do its defects add up to?',
      steps: [
        { expression: '\\chi = 96 - 288 + 192 = 0', annotation: 'Euler characteristic.' },
        { expression: '\\sum \\delta = 2\\pi \\times 0 = 0', annotation: 'Gauss–Bonnet.' },
      ],
      conclusion: '0: the positive outside and the negative inside balance exactly (cell 2).',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-7-004-ch1',
      difficulty: 'easy',
      problem: 'Why can a cylinder be rolled from flat paper but a sphere cannot?',
      walkthrough: [{ expression: 'K_{\\text{cylinder}} = 0, \\; K_{\\text{sphere}} = 1/r^2 > 0', annotation: 'Paper has K = 0 and keeps it unless stretched.' }],
      answer: 'Bending without stretching keeps K (Theorema Egregium). Paper has K = 0; a cylinder has K = 0, so it can be rolled; a sphere has K > 0, so paper would have to stretch or crumple.',
    },
    {
      id: 'modelling-geometry-7-004-ch2',
      difficulty: 'medium',
      problem: 'You pull one vertex of a closed sphere-like mesh far out into a spike. What happens to the total defect, and where does the curvature go?',
      walkthrough: [
        { expression: '\\text{total} = 2\\pi\\chi = 4\\pi', annotation: 'Unchanged: same topology.' },
        { expression: '\\text{the spike\'s tip gains a large defect}', annotation: 'Its neighbours ring it with negative defects.' },
      ],
      answer: 'The total stays 4π because χ has not changed. The tip becomes a sharp cone point with a large positive defect, and the vertices round its base become saddle-like (negative defect), so the sum is unchanged.',
    },
    {
      id: 'modelling-geometry-7-004-ch3',
      difficulty: 'hard',
      problem: 'Prove discrete Gauss–Bonnet for a closed triangle mesh.',
      walkthrough: [
        { expression: '\\sum_v \\delta_v = 2\\pi V - \\sum \\text{angles}', annotation: 'Every angle belongs to one vertex.' },
        { expression: '\\sum \\text{angles} = \\pi F', annotation: 'Each triangle\'s angles add to π.' },
        { expression: '3F = 2E \\Rightarrow \\pi F = 2\\pi E - 2\\pi F', annotation: 'Closed: each edge on two triangles.' },
      ],
      answer: 'Σδ = 2πV − (sum of all angles) = 2πV − πF. For a closed triangle mesh 3F = 2E, so πF = 2πE − 2πF, and Σδ = 2πV − 2πE + 2πF = 2π(V − E + F) = 2πχ.',
    },
  ],

  semantics: {
    core: [
      { symbol: '\\delta_i', meaning: 'The angle defect at vertex i: 2π minus the angles round it.' },
      { symbol: 'K', meaning: 'Gaussian curvature: κ₁κ₂, or δ / A on a mesh.' },
      { symbol: '\\chi', meaning: 'The Euler characteristic V − E + F.' },
      { symbol: '\\text{Gauss–Bonnet}', meaning: 'Σ δ = 2πχ on a closed surface.' },
      { symbol: 'K > 0, K = 0, K < 0', meaning: 'Dome, flat or one-way bend, saddle.' },
    ],
    rulesOfThumb: [
      'Less than 360° round a vertex: dome. More: saddle.',
      'The total is fixed by topology: 720° for a sphere-like shape.',
      'K needs only angles; no normals.',
      'Use H and K together.',
      'On borders, compare with 180°, not 360°.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-1-005', label: 'Euler\'s formula', note: 'χ, which fixes the total curvature.' },
      { lessonId: 'modelling-geometry-7-003', label: 'Mean curvature', note: 'The other curvature, from the Laplacian.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-7-005', label: 'Sparse linear systems', note: 'Solving with the Laplacian.' },
      { lessonId: 'modelling-geometry-8-005', label: 'Measuring distortion', note: 'Why curved regions stretch when unwrapped.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-7-004-1', label: 'Read what an angle defect is', type: 'read' },
    { id: 'cp-modelling-geometry-7-004-2', label: 'Read how K comes from the defect', type: 'read' },
    { id: 'cp-modelling-geometry-7-004-3', label: 'Read Gauss–Bonnet and why the total is fixed', type: 'read' },
    { id: 'cp-modelling-geometry-7-004-4', label: 'Run cells 1 to 4: defects, totals, spheres, K against H', type: 'lab' },
    { id: 'cp-modelling-geometry-7-004-5', label: 'Trace K on a torus and a cube in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-7-004-6', label: 'Work through example 2, K from a defect', type: 'example' },
    { id: 'cp-modelling-geometry-7-004-7', label: 'Work through example 3, Gauss–Bonnet on a torus', type: 'example' },
    { id: 'cp-modelling-geometry-7-004-8', label: 'Complete the challenge: defects', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-7-004-assess-1',
        type: 'choice',
        text: 'Six equilateral triangles meet at a vertex. Its angle defect is:',
        options: ['0°', '60°', '−60°', '360°'],
        answer: '0°',
        hint: '6 × 60° = 360°.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-7-004-quiz-1',
      type: 'choice',
      text: 'What is the angle defect at a cube\'s corner?',
      options: ['90°', '270°', '0°', '120°'],
      answer: '90°',
      hints: ['360° − 3 × 90°.', 'Cell 1.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-7-004-quiz-2',
      type: 'choice',
      text: 'What do the defects of any closed sphere-like mesh add up to?',
      options: ['720° (4π)', '360°', '0°', 'It depends on the shape'],
      answer: '720° (4π)',
      hints: ['Gauss–Bonnet, χ = 2.', 'Cell 2.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-7-004-quiz-3',
      type: 'choice',
      text: 'What is K on a cylinder of radius 2?',
      options: ['0', '0.25', '0.5', '4'],
      answer: '0',
      hints: ['One bend is 0.', 'Cell 4.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-7-004-quiz-4',
      type: 'choice',
      text: 'Where is a torus\'s Gaussian curvature negative?',
      options: ['Round the inside of its hole', 'On the outside', 'On the top circle', 'Nowhere'],
      answer: 'Round the inside of its hole',
      hints: ['Saddles.', 'The picture.'],
      reviewSection: 'Cell 5',
    },
    {
      id: 'modelling-geometry-7-004-quiz-5',
      type: 'choice',
      text: 'What is K on a sphere of radius 2?',
      options: ['0.25', '0.5', '4', '1'],
      answer: '0.25',
      hints: ['1/r².', 'Cell 3.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-7-004-quiz-6',
      type: 'choice',
      text: 'Five squares meet at a vertex. The surface there is:',
      options: ['Saddle-like: defect −90°', 'Dome-like: defect 90°', 'Flat', 'A cone'],
      answer: 'Saddle-like: defect −90°',
      hints: ['450° > 360°.', 'Cell 1.'],
      reviewSection: 'Cell 1',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'A cube has no curvature because its faces are flat.',
      whyStudentsThinkIt: 'Curvature seems to belong to curved faces.',
      correctionExample: 'Cell 1 and 2: it has 90° of defect at each corner, 720° in all, the same as a sphere.',
      contrastCase: 'An infinite flat plane really has none: 360° at every vertex.',
    },
    {
      falseBelief: 'A curvier shape has more total curvature.',
      whyStudentsThinkIt: 'Spikes and bumps look like more curvature.',
      correctionExample: 'Challenge 2: pulling out a spike leaves the total at 4π; it just moves.',
      contrastCase: 'Changing the topology (punching a hole: χ from 2 to 0) does change the total.',
    },
    {
      falseBelief: 'H and K measure the same thing.',
      whyStudentsThinkIt: 'Both are called curvature.',
      correctionExample: 'Cell 4: a cylinder has H = 0.5, K = 0; a saddle H = 0, K = −4.',
      contrastCase: 'On a sphere both are fixed by r: H = 1/r, K = 1/r² = H².',
    },
  ],

  transferPrompts: [
    {
      situation: 'A garment pattern must cover a curved bust or shoulder from flat cloth.',
      competingTechniques: ['Cut one flat piece', 'Add darts or seams where K is large'],
      whyThisTechniqueWins: 'Where K ≠ 0 flat cloth must stretch or be cut; darts remove exactly the angle defect.',
    },
    {
      situation: 'Checking a scanned mesh for holes or extra handles before printing.',
      competingTechniques: ['Look at it', 'Add up the angle defects and compare with 4π'],
      whyThisTechniqueWins: 'A total of 4π confirms sphere-like topology; anything else means holes, handles or broken connectivity.',
    },
  ],

  debugging: [
    {
      commonError: 'Using 2π at border vertices.',
      symptom: 'Huge curvature all along open edges.',
      whyItHappened: 'A border vertex has only half a fan.',
      repairStrategy: 'Use π − Σθ on borders.',
    },
    {
      commonError: 'Counting a quad\'s angles without triangulating.',
      symptom: 'Defects off where quads are not planar.',
      whyItHappened: 'Angles of a bent quad do not add to 360° per face.',
      repairStrategy: 'Triangulate first, and add the triangles\' angles.',
    },
    {
      commonError: 'Total defect not equal to 2πχ.',
      symptom: 'A mismatch on a mesh you thought was closed.',
      whyItHappened: 'The mesh has holes, non-manifold edges or duplicate vertices.',
      repairStrategy: 'Weld and fill (lesson 1.6), then check again.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Compute angle defects, K, and Gauss–Bonnet totals for any mesh.',
    explainVerbally: 'Explain what K measures, how it differs from H, and why the total is fixed by χ.',
    detectIncorrectApplication: 'Recognise border errors, untriangulated angles and totals that reveal broken topology.',
    transferToUnfamiliar: 'Use K to judge flattenability and to check a mesh\'s topology.',
  },
};
