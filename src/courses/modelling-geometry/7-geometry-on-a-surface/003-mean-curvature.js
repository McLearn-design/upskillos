// Lesson 7.3: mean curvature. The cotan Laplacian of the positions, divided by twice the vertex's area, is a vector
// along the normal whose length is the mean curvature H, the average of the two principal curvatures; its sign says
// whether the surface bulges out or dents in. Which area is used matters on uneven meshes: the barycentric third, or
// the mixed Voronoi area, which is somewhat more accurate.
import { withPicture } from '../notebookScene.js';

const HELPERS = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const sub = (a, b) => a.map((x, i) => x - b[i]), add = (a, b) => a.map((x, i) => x + b[i]), mul = (a, s) => a.map((x) => x * s)
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a) => Math.hypot(...a)
const cotAt = (a, b, c) => { const u = sub(a, c), w = sub(b, c); return dot(u, w) / len(cross(u, w)) }
// A UV sphere of radius rad (or any shape made by moving its vertices), as triangles.
function sphere(rad, S = 24, R = 12) {
  const V = [[0, rad, 0]], T = []
  for (let i = 1; i < R; i++) for (let j = 0; j < S; j++) { const t = Math.PI * i / R, p = 2 * Math.PI * j / S; V.push([rad * Math.sin(t) * Math.cos(p), rad * Math.cos(t), rad * Math.sin(t) * Math.sin(p)]) }
  V.push([0, -rad, 0])
  const at = (i, j) => 1 + (i - 1) * S + (j % S), south = V.length - 1
  for (let j = 0; j < S; j++) T.push([0, at(1, j + 1), at(1, j)])
  for (let i = 1; i < R - 1; i++) for (let j = 0; j < S; j++) T.push([at(i, j), at(i, j + 1), at(i + 1, j + 1)], [at(i, j), at(i + 1, j + 1), at(i + 1, j)])
  for (let j = 0; j < S; j++) T.push([at(R - 1, j), at(R - 1, j + 1), south])
  return { V, T }
}
// Mean curvature at every vertex: Hn = Σ w_ij (x_j − x_i) / (2A_i), signed by the outward normal (area-weighted).
// area: 'bary' (a third of each triangle) or 'mixed' (Voronoi, with the obtuse-triangle fix).
function meanCurvature({ V, T }, area = 'bary') {
  const sum = V.map(() => [0, 0, 0]), A = V.map(() => 0), N = V.map(() => [0, 0, 0])
  for (const [a, b, c] of T) {
    const tri = [a, b, c], P = tri.map((v) => V[v]), n = cross(sub(P[1], P[0]), sub(P[2], P[0])), At = len(n) / 2
    tri.forEach((i, k) => {
      const j = tri[(k + 1) % 3], l = tri[(k + 2) % 3]
      const wl = cotAt(V[i], V[j], V[l]) / 2, wj = cotAt(V[i], V[l], V[j]) / 2   // the angle at l faces edge i–j, at j faces i–l
      sum[i] = add(sum[i], add(mul(sub(V[j], V[i]), wl), mul(sub(V[l], V[i]), wj)))
      N[i] = add(N[i], n)
      if (area === 'bary') A[i] += At / 3
      else {
        const obtuseAt = [0, 1, 2].find((q) => dot(sub(P[(q + 1) % 3], P[q]), sub(P[(q + 2) % 3], P[q])) < 0)
        if (obtuseAt === undefined) A[i] += (dot(sub(V[j], V[i]), sub(V[j], V[i])) * wl + dot(sub(V[l], V[i]), sub(V[l], V[i])) * wj) / 4
        else A[i] += obtuseAt === k ? At / 2 : At / 4
      }
    })
  }
  return V.map((_, i) => { const Hn = mul(sum[i], 1 / (2 * A[i])); return (Math.sign(dot(Hn, N[i])) || 1) * -len(Hn) })
}
const stats = (H) => { const m = H.reduce((s, h) => s + h, 0) / H.length; return 'mean ' + r(m) + ', from ' + r(Math.min(...H)) + ' to ' + r(Math.max(...H)) }
`;

const SPHERES = `${HELPERS}
// Predict first: a sphere of radius 1 has H = 1 everywhere. Radius 2?
for (const rad of [1, 2, 0.5]) console.log('sphere of radius ' + rad + ': H ' + stats(meanCurvature(sphere(rad))))`;

const CYLINDER = `${HELPERS}
// A cylinder bends one way only: principal curvatures 1/r round it and 0 along it. H is their average.
// Predict first: H for a cylinder of radius 0.5?
const S = 32, V = [], T = []
for (const y of [-1, -0.5, 0, 0.5, 1]) for (let j = 0; j < S; j++) V.push([0.5 * Math.cos(2 * Math.PI * j / S), y, 0.5 * Math.sin(2 * Math.PI * j / S)])
for (let k = 0; k < 4; k++) for (let j = 0; j < S; j++) { const a = k * S + j, b = k * S + (j + 1) % S, c = (k + 1) * S + (j + 1) % S, d = (k + 1) * S + j; T.push([a, d, c], [a, c, b]) }
const H = meanCurvature({ V, T })
const middle = H.slice(2 * S, 3 * S)                // the middle ring, away from the open ends
console.log('middle ring: H ' + stats(middle) + ' (1/r = 2, and 0 along the axis: their average is 1)')`;

const AREAS = `${HELPERS}
// On an uneven mesh the area a vertex stands for matters. Jiggle a unit sphere's vertices along the surface (so it is
// still a sphere, H = 1, but its triangles are uneven), and compare the two areas.
let seed = 7
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const m = sphere(1, 16, 8)
m.V = m.V.map((p, i) => { if (i === 0 || i === m.V.length - 1) return p; const q = add(p, [0.15 * (rand() - 0.5), 0.15 * (rand() - 0.5), 0.15 * (rand() - 0.5)]); return mul(q, 1 / len(q)) })
// Predict first: which area gives H closer to 1? (The poles' thin fans and the rings next to them are left out.)
const inside = (i) => i > 16 && i < m.V.length - 1 - 16
for (const area of ['bary', 'mixed']) {
  const H = meanCurvature(m, area).filter((_, i) => inside(i)), spread = Math.sqrt(H.reduce((s, h) => s + (h - 1) ** 2, 0) / H.length)
  console.log((area === 'bary' ? 'barycentric area: ' : 'mixed area:       ') + 'H ' + stats(H) + ', typical error ' + r(spread))
}`;

// The dented ball of MeshLab's project.
const DENTED = `function dented() {
  const m = sphere(1, 32, 16)
  m.start = m.V.map((p) => p[0])                   // where each vertex started along x
  m.V = m.V.map((p) => (p[0] > 0.6 ? [1.2 - p[0], p[1], p[2]] : p))
  return m
}
`;

const SIGN = `${HELPERS}${DENTED}
// Predict first: what sign does H have inside the dent?
const m = dented(), H = meanCurvature(m)
// The dent: vertices that were moved, away from the rim. The rest: vertices well away from it.
const dent = H.filter((_, i) => m.start[i] > 0.8), rest = H.filter((_, i) => m.start[i] < 0.45)
console.log('inside the dent: ' + dent.length + ' vertices, H ' + stats(dent))
console.log('the rest of the ball: ' + rest.length + ' vertices, H ' + stats(rest))
console.log('the rim of the dent, where the surface folds: the largest H, ' + r(Math.max(...H)))`;

const PICTURE = withPicture(`${HELPERS}${DENTED}
// The dented ball coloured by H with a diverging map: blue negative, white 0, red positive. The range is symmetric
// round 0 and robust, so the rim's spike does not wash everything else out.
function coolwarm(t) { t = Math.min(1, Math.max(0, t)); const lo = [0.23, 0.3, 0.75], mid = [0.87, 0.87, 0.87], hi = [0.71, 0.02, 0.15]; const [a, b, u] = t < 0.5 ? [lo, mid, t * 2] : [mid, hi, (t - 0.5) * 2]; return a.map((x, k) => x + (b[k] - x) * u) }
const m = dented(), H = meanCurvature(m)
const abs = H.map(Math.abs).sort((a, b) => a - b), reach = abs[Math.round(0.98 * (abs.length - 1))]
const colors = H.map((h) => coolwarm(0.5 + h / (2 * reach)))
const faces = m.T
console.log('colour range ±' + r(reach) + ': the ball red, the dent blue, the rim beyond the range')
show({ verts: m.V, faces, colors, zoom: 1.2 })`);

const CHALLENGE = `// Mean curvature H = (κ₁ + κ₂) / 2, the average of the two principal curvatures.
// What is H for a sphere of radius 2, and for a long cylinder of radius 0.5?
const answer = { sphere: 0, cylinder: 0 }
console.log(answer)`;

const SOLVED = CHALLENGE.replace('const answer = { sphere: 0, cylinder: 0 }', 'const answer = { sphere: 0.5, cylinder: 1 }');

/** The challenge's check: sphere radius 2: (½ + ½)/2 = 0.5; cylinder radius 0.5: (2 + 0)/2 = 1. */
export function checkCurvatures(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+answer\s*=\s*\{([^}]*)\}/);
  if (!m) return no('Keep the line const answer = { sphere: …, cylinder: … }.');
  const get = (k) => { const g = m[1].match(new RegExp(k + '\\s*:\\s*(-?[\\d.]+)')); return g ? Number(g[1]) : NaN; };
  const sph = get('sphere'), cyl = get('cylinder');
  if ([sph, cyl].some(Number.isNaN)) return no('Give both as numbers: sphere and cylinder.');
  if (Math.abs(sph - 2) < 1e-6) return no('A sphere of radius r curves by 1/r in every direction, not r.');
  if (Math.abs(sph - 0.5) > 1e-6) return no(`Both principal curvatures of a sphere of radius 2 are 1/2; their average is not ${sph}.`);
  if (Math.abs(cyl - 2) < 1e-6) return no('2 is the curvature round the cylinder; along its axis it is 0, and H is the average of the two.');
  if (Math.abs(cyl - 0.25) < 1e-6) return no('Round the cylinder the curvature is 1/r = 2, not r / 2.');
  if (Math.abs(cyl - 1) > 1e-6) return no(`The cylinder\\'s principal curvatures are 1/0.5 = 2 and 0; their average is not ${cyl}.`);
  return { pass: true, message: '0.5 and 1. A sphere bends equally every way: (1/2 + 1/2)/2 = 0.5. A cylinder bends only round: (2 + 0)/2 = 1. So a thin cylinder can have larger H than a big sphere, and cell 2 measures it.' };
}

export default {
  id: 'modelling-geometry-7-003',
  slug: 'mean-curvature',
  chapter: 'modelling-geometry',
  order: 3,
  title: 'Mean curvature',
  subtitle: 'The Laplacian of the positions: a vector along the normal whose length is how much the surface bends on average.',
  tags: ['mean curvature', 'laplacian', 'discrete differential geometry', 'voronoi area', 'curvature', 'heat maps'],
  coreConcept: 'Mean curvature H is the average of a surface\'s two principal curvatures: 1/r on a sphere of radius r, 1/(2r) on a cylinder. On a mesh it comes from the cotan Laplacian of the positions: (1/(2A)) Σ w_ij (x_j − x_i) is a vector along the normal with length H, positive where the surface bulges along its outward normal and negative where it dents in. The area A matters: the barycentric third of each triangle is simple, the mixed Voronoi area (with a fix for obtuse triangles) is more accurate on uneven meshes. Colour H with a diverging map centred on zero.',
  prerequisites: ['modelling-geometry-7-002', 'modelling-geometry-7-001'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-7-004',

  hook: {
    question: 'How curved is a surface at a point? A ball is curved everywhere the same, a pipe only one way, a saddle up one way and down the other. Is there one number that captures "how much it bends", and can a mesh compute it?',
    realWorldContext: 'Mean curvature drives smoothing (flatten where H is large), soap films and minimal surfaces (H = 0), feature detection on scans (ridges and valleys), and quality checks on car bodies, where highlight lines follow its changes.',
  },

  intuition: {
    prose: [
      'At any point a surface bends by different amounts in different directions. The largest and smallest bends are the **principal curvatures** $\\kappa_1, \\kappa_2$. **Mean curvature** is their average, $H = (\\kappa_1 + \\kappa_2)/2$: $1/r$ on a sphere of radius $r$ (it bends $1/r$ every way), $1/(2r)$ on a cylinder (it bends $1/r$ round and $0$ along).',
      'Lesson 7.2 found that the cotan Laplacian of the positions points along the normal. Its length, divided by twice the vertex\'s area, is $H$: $\\;H\\,n = \\frac{1}{2A}\\sum_j w_{ij}(x_j - x_i)$. Before running cell 1, predict: on spheres of radius $1$, $2$ and $0.5$? About $1$, $0.5$ and $2$.',
      'Cell 2 checks a cylinder of radius $0.5$: $H \\approx 1$, half the curvature round it, because along its axis it does not bend at all. One number cannot tell a sphere from a cylinder of the same $H$; lesson 7.4\'s Gaussian curvature can.',
      'The **sign**: compare the vector with the outward normal. Along it, the surface bulges (a dome, $H > 0$); against it, it is dented in (a bowl, $H < 0$). Before running cell 4, predict: inside the dent pressed into a ball? Negative, about $-1$: the dent is a reflected piece of the same sphere.',
      'Which **area**? The simplest is a third of each triangle round the vertex (barycentric). On uneven meshes the **mixed Voronoi area** is more accurate: each triangle gives the vertex the part of it closer to that vertex than to the others, with a fix when a triangle is obtuse. Before running cell 3, predict which gives $H$ closer to $1$ on a jiggled unit sphere: the mixed area, somewhat (a typical error of $0.068$ against $0.077$). Neither is exact on an irregular mesh: pointwise accuracy needs well-shaped triangles.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Mean curvature at every vertex',
        body: 'Step 1. Build the cotan weights w_ij (lesson 7.2).\nStep 2. For each vertex: S_i = Σ_j w_ij (x_j − x_i).\nStep 3. Its area A_i: a third of each triangle (barycentric), or the mixed Voronoi area.\nStep 4. Hn_i = S_i / (2 A_i); H_i = |Hn_i|, with the sign of Hn_i · n_i (n_i the outward vertex normal).\nStep 5. Show with a diverging colour map, symmetric round 0, robust range.',
      },
      {
        type: 'warning',
        title: 'Creases and borders spike',
        body: 'A sharp fold (the dent\'s rim) has enormous curvature in the limit; on a mesh it shows as a spike limited only by the triangle size. Open borders have no proper Laplacian at all. Use a robust range, and ignore border values.',
      },
      {
        type: 'warning',
        title: 'Sign needs consistent normals',
        body: 'The sign of H comes from the vertex normal. A mesh with flipped faces gets flipped signs there: domes coloured as bowls. Fix the winding first (lesson 1.2).',
      },
      {
        type: 'insight',
        title: 'The graphics strand: the heat map',
        body: 'Shown with a diverging map, H reads at a glance: domes red, bowls blue, flat and saddle-balanced regions white. Designers use it to see where a surface\'s bend changes abruptly, which is where reflections will break.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "curvature is how far a point sticks out". The ball is uniformly red (H ≈ 1 everywhere, however far each point is from anything); the dent is uniformly blue (H ≈ −1); only the rim, where the surface folds, is extreme.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'meanCurvature() in the cells is the procedure: sum is Step 2, A is Step 3 (bary or mixed), and the sign test Step 4.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'H is a per-vertex field; the heat map is lesson 7.1\'s vertex colours with a diverging map.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Heat map › Mean curvature colours H. With Record traces on it is traced: the Laplacian of position at every vertex, the sign test at the most dented vertex (predict it), and the range. Mesh › Trace the Laplacian (one vertex) shows one vertex\'s H in full. Scripts call mesh.curvature(\'mean\').' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: mean curvature',
        caption: 'Spheres, a cylinder, two kinds of area, the sign in a dent, and the dented ball coloured by H.',
        props: {
          lesson: {
            title: 'Mean curvature',
            subtitle: 'H from the Laplacian of position.',
            cells: [
              { type: 'js', instruction: '### 1. Spheres\nPredict first: H for radius 2 and 0.5.', startCode: SPHERES },
              { type: 'js', instruction: '### 2. A cylinder\nPredict first: H for a cylinder of radius 0.5.', startCode: CYLINDER },
              { type: 'js', instruction: '### 3. Which area\nPredict first: barycentric or mixed, which is closer to H = 1 on a jiggled sphere?', startCode: AREAS },
              { type: 'js', instruction: '### 4. The sign\nPredict first: H inside a dent.', startCode: SIGN },
              { type: 'js', instruction: '### 5. See it\nThe dented ball coloured by H. Drag to turn.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 340 },
              { type: 'challenge', instruction: '### 6. Challenge: two shapes\nH for a sphere and a cylinder. The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkCurvatures },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Mean curvature" in MeshLab](#/lab/mesh-lab?project=mean-curvature). The dented ball\'s mean curvature is traced: press Play and predict the sign at the most dented vertex. Then trace the Laplacian at one vertex in the dent.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Heat map › Mean curvature (H).**\n- **Mesh › Trace the Laplacian (one vertex)** for H at one vertex.\n- In a script: `mesh.curvature(\'mean\')` returns H per vertex; `mesh.showField(\'mean\')` colours it.\n- [Open "Curvature gallery" in MeshLab](#/lab/mesh-lab?project=curvature-gallery): spheres, saddles and a torus, coloured by curvature.\n- **Elsewhere:** Blender\'s "Curvature" attribute node, MeshLab (the open-source one)\'s curvature filters, libigl\'s `principal_curvature`.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Principal and mean curvature.** At a point with unit normal $n$, cutting the surface with planes through $n$ gives curves whose curvatures vary with direction; the extremes are $\\kappa_1, \\kappa_2$, in perpendicular directions. $H = \\tfrac12(\\kappa_1 + \\kappa_2)$ is also the average over all directions.',
      '**The Laplacian of position.** For the embedding $x$ of a surface, the Laplace–Beltrami operator gives $\\Delta x = -2H n$. Discretely, $(1/A_i)\\sum_j w_{ij}(x_j - x_i) \\approx 2H_i n_i$ (pointing inward on a convex surface, where $n$ points out): this is the "mean curvature normal" of Meyer, Desbrun, Schröder and Barr (2003).',
      '**Mixed area.** For a non-obtuse triangle, the Voronoi region of vertex $i$ has area $\\tfrac18\\big(|x_i - x_j|^2\\cot\\theta_k + |x_i - x_k|^2\\cot\\theta_j\\big)$. For an obtuse triangle that region pokes outside it, so Meyer et al. use half the triangle\'s area if the obtuse angle is at $i$ and a quarter otherwise: the mixed area. The areas still tile the surface exactly.',
      '**Minimal surfaces.** Where $H = 0$ the surface is locally area-minimising: soap films, catenoids, the Costa surface. Smoothing by mean-curvature flow (lesson 7.7) moves each point by $-H n$, the direction that shrinks area fastest.',
    ],
    equations: [
      { label: 'Mean curvature', latex: 'H = \\tfrac12(\\kappa_1 + \\kappa_2)' },
      { label: 'Discrete mean curvature normal', latex: 'H_i\\,n_i \\approx \\frac{1}{2A_i}\\sum_j w_{ij}\\,(x_j - x_i)' },
      { label: 'Voronoi area (non-obtuse)', latex: 'A_i^{T} = \\tfrac18\\big(|e_{ij}|^2\\cot\\theta_k + |e_{ik}|^2\\cot\\theta_j\\big)' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** For a sequence of meshes inscribed in a smooth surface with well-shaped, shrinking triangles, the cotan mean curvature normal with mixed Voronoi areas converges to $2H n$ in an integrated (weak) sense; pointwise convergence needs further regularity of the meshes.',
      '**Invariant viewpoint.** H changes sign with the choice of normal (outward or inward) and scales as 1 / length: doubling a model halves its H. It is invariant under rigid motions.',
      '**Geometric picture.** H measures how much a small patch of the surface would shrink in area if pushed along its normal: a dome loses area when pushed in, a flat or saddle-balanced patch does not change to first order.',
      '**Where this goes.** Lesson 7.4 measures the other curvature, Gaussian, from angles alone; 7.7 smooths by flowing along −Hn.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-7-003-ex1',
      title: 'From Δx to H',
      problem: 'At a vertex, $\\sum_j w_{ij}(x_j - x_i) = (0, -0.6, 0)$, the area is $0.3$, and the outward normal is $(0, 1, 0)$. Find $H$.',
      steps: [
        { expression: 'Hn = (0, -0.6, 0) / (2 \\times 0.3) = (0, -1, 0)', annotation: 'Step 4.' },
        { expression: '|Hn| = 1, \\; Hn \\cdot n = -1 < 0', annotation: 'Against the outward normal.' },
      ],
      conclusion: 'H = 1 in size; the vector points inward (towards the centre of curvature), as on a convex dome, so with this lesson\'s convention, H is positive: the surface bulges outward. (Meshes in the cells sign H by whether the surface bulges along its outward normal.)',
    },
    {
      id: 'modelling-geometry-7-003-ex2',
      title: 'A saddle',
      problem: 'At a saddle point, $\\kappa_1 = 2$ and $\\kappa_2 = -2$. What is $H$?',
      steps: [{ expression: '(2 + (-2))/2 = 0', annotation: 'They balance.' }],
      conclusion: 'H = 0: white on the heat map, though the surface is far from flat. Gaussian curvature (−4) tells it apart.',
    },
    {
      id: 'modelling-geometry-7-003-ex3',
      title: 'Scaling',
      problem: 'A model has $H = 0.8$ at a point. It is scaled up by 4. What is $H$ there now?',
      steps: [{ expression: 'H \\propto 1/\\text{length}: \\; 0.8 / 4 = 0.2', annotation: 'Bigger shapes bend less.' }],
      conclusion: '0.2.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-7-003-ch1',
      difficulty: 'easy',
      problem: 'Why is H the same at every point of a sphere, however far the point is from the origin?',
      walkthrough: [{ expression: '\\text{curvature is about bending, not position}', annotation: 'Every point of a sphere bends the same.' }],
      answer: 'Curvature measures how the surface bends round a point, not where the point is; every point of a sphere has the same neighbourhood shape, so the same H = 1/r.',
    },
    {
      id: 'modelling-geometry-7-003-ch2',
      difficulty: 'medium',
      problem: 'On a mesh with flipped faces in one patch, the heat map shows a blue spot on a convex dome. Explain.',
      walkthrough: [
        { expression: '\\text{the sign comes from the vertex normal}', annotation: 'Flipped faces flip it.' },
      ],
      answer: 'H\'s sign is the sign of Hn · n, with n from the faces round the vertex. Flipped faces turn n inward, so a convex patch reports negative H. Make the winding consistent (lesson 1.2) and the spot turns red.',
    },
    {
      id: 'modelling-geometry-7-003-ch3',
      difficulty: 'hard',
      problem: 'Show that the mixed areas of a mesh add up to its total area.',
      walkthrough: [
        { expression: '\\text{non-obtuse: the 3 Voronoi pieces tile the triangle}', annotation: 'They meet at the circumcentre, inside the triangle.' },
        { expression: '\\text{obtuse: } \\tfrac12 + \\tfrac14 + \\tfrac14 = 1', annotation: 'Of the triangle\'s area.' },
      ],
      answer: 'Each triangle is split exactly among its three corners: for a non-obtuse triangle the three Voronoi pieces meet at the circumcentre inside it and tile it; for an obtuse one the rule gives ½ + ¼ + ¼ of its area. Summing over triangles, the vertices\' areas add up to the total area.',
    },
  ],

  semantics: {
    core: [
      { symbol: '\\kappa_1, \\kappa_2', meaning: 'The principal curvatures: the most and least the surface bends at a point.' },
      { symbol: 'H', meaning: 'Mean curvature: (κ₁ + κ₂)/2. 1/r on a sphere, 1/(2r) on a cylinder.' },
      { symbol: 'Hn', meaning: 'The mean curvature normal: (1/2A) Σ w (x_j − x_i).' },
      { symbol: 'A_i', meaning: 'The vertex\'s area: barycentric third or mixed Voronoi.' },
      { symbol: '\\text{sign of } H', meaning: 'Positive where the surface bulges along its outward normal, negative where dented.' },
    ],
    rulesOfThumb: [
      'H is the average bend: 1/r for spheres, half that for cylinders.',
      'Red bulges, blue dents, white is flat or balanced.',
      'Use mixed areas on uneven meshes.',
      'Fix normals before reading signs.',
      'Creases and borders spike: robust ranges.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-7-002', label: 'The Laplacian', note: 'The operator whose result on positions is Hn.' },
      { lessonId: 'modelling-geometry-7-001', label: 'Fields on a mesh and colour maps', note: 'Diverging maps for signed fields.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-7-004', label: 'Gaussian curvature', note: 'The product of the principal curvatures, from angles alone.' },
      { lessonId: 'modelling-geometry-7-007', label: 'Smoothing as heat flow', note: 'Moving the surface along −Hn.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-7-003-1', label: 'Read what principal and mean curvature are', type: 'read' },
    { id: 'cp-modelling-geometry-7-003-2', label: 'Read how H comes from the Laplacian of position', type: 'read' },
    { id: 'cp-modelling-geometry-7-003-3', label: 'Read the sign rule and the mixed area', type: 'read' },
    { id: 'cp-modelling-geometry-7-003-4', label: 'Run cells 1 to 4: spheres, a cylinder, areas, the sign', type: 'lab' },
    { id: 'cp-modelling-geometry-7-003-5', label: 'Trace mean curvature on the dented ball in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-7-003-6', label: 'Work through example 2, a saddle', type: 'example' },
    { id: 'cp-modelling-geometry-7-003-7', label: 'Work through example 3, scaling', type: 'example' },
    { id: 'cp-modelling-geometry-7-003-8', label: 'Complete the challenge: two shapes', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-7-003-assess-1',
        type: 'choice',
        text: 'A sphere of radius 4 has mean curvature:',
        options: ['0.25', '4', '0.5', '0.125'],
        answer: '0.25',
        hint: '1/r.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-7-003-quiz-1',
      type: 'choice',
      text: 'What is H on a cylinder of radius r?',
      options: ['1/(2r)', '1/r', 'r', '0'],
      answer: '1/(2r)',
      hints: ['Average of 1/r and 0.', 'Cell 2.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-7-003-quiz-2',
      type: 'choice',
      text: 'What is H inside a dent pressed into a unit ball?',
      options: ['About −1', 'About 1', '0', 'Very large'],
      answer: 'About −1',
      hints: ['A reflected piece of the sphere.', 'Cell 4.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-7-003-quiz-3',
      type: 'choice',
      text: 'Which vertex area gives more accurate H on uneven meshes?',
      options: ['The mixed Voronoi area', 'A third of each triangle', 'The largest triangle\'s area', 'No area'],
      answer: 'The mixed Voronoi area',
      hints: ['Cell 3.', 'Maths: mixed area.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-7-003-quiz-4',
      type: 'choice',
      text: 'A saddle with principal curvatures 3 and −3 has H =',
      options: ['0', '3', '−9', '6'],
      answer: '0',
      hints: ['Average.', 'Example 2.'],
      reviewSection: 'Example 2',
    },
    {
      id: 'modelling-geometry-7-003-quiz-5',
      type: 'choice',
      text: 'Why does the rim of a dent show a huge H?',
      options: ['It is a sharp fold, limited only by the triangle size', 'It is far from the centre', 'Its normals are flipped', 'It is on the border'],
      answer: 'It is a sharp fold, limited only by the triangle size',
      hints: ['Warning "Creases and borders spike".', 'Cell 4.'],
      reviewSection: 'Warning "Creases and borders spike"',
    },
    {
      id: 'modelling-geometry-7-003-quiz-6',
      type: 'choice',
      text: 'Scaling a model up by 3 changes H by:',
      options: ['× 1/3', '× 3', '× 9', 'Nothing'],
      answer: '× 1/3',
      hints: ['H is 1 / length.', 'Example 3.'],
      reviewSection: 'Example 3',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'Curvature measures how far a point sticks out.',
      whyStudentsThinkIt: 'Bumps stick out and are curved.',
      correctionExample: 'Cell 1 and the picture: every point of a sphere has the same H, whatever its position.',
      contrastCase: 'Height is a different field (lesson 7.1); a tilted flat plane has height everywhere and H = 0.',
    },
    {
      falseBelief: 'H = 0 means the surface is flat.',
      whyStudentsThinkIt: 'A plane has H = 0.',
      correctionExample: 'Example 2: a saddle with κ = ±2 has H = 0.',
      contrastCase: 'Gaussian curvature (lesson 7.4) is −4 there, and 0 on a plane.',
    },
    {
      falseBelief: 'Any vertex area will do.',
      whyStudentsThinkIt: 'The areas only scale the result.',
      correctionExample: 'Cell 3: on a jiggled sphere, the mixed area cuts the typical error from 0.077 to 0.068.',
      contrastCase: 'On perfectly regular meshes the barycentric and mixed areas nearly agree.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A car designer needs to find where a body panel\'s bend changes abruptly.',
      competingTechniques: ['Look at it under one light', 'Show mean curvature as a heat map'],
      whyThisTechniqueWins: 'Abrupt changes in H show as sharp colour transitions everywhere at once, independent of lighting.',
    },
    {
      situation: 'Measuring curvature on a scanned part with very uneven triangles.',
      competingTechniques: ['Barycentric areas', 'Mixed Voronoi areas'],
      whyThisTechniqueWins: 'The mixed area adapts to the triangle shapes and gives H much closer to the true value.',
    },
  ],

  debugging: [
    {
      commonError: 'Forgetting the factor 2.',
      symptom: 'A unit sphere shows H = 2.',
      whyItHappened: 'The Laplacian of position has length 2H.',
      repairStrategy: 'Divide by 2A, not A.',
    },
    {
      commonError: 'Using the barycentric area on a badly shaped mesh.',
      symptom: 'Noisy H on a surface known to be smooth.',
      whyItHappened: 'The area a vertex stands for is misestimated near obtuse triangles.',
      repairStrategy: 'Use the mixed Voronoi area.',
    },
    {
      commonError: 'Reading H on open borders.',
      symptom: 'A bright ring of extreme values round every hole.',
      whyItHappened: 'Border vertices have neighbours on one side only.',
      repairStrategy: 'Mask border vertices, or close holes first.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Compute H at a vertex from cotan weights and an area, with its sign.',
    explainVerbally: 'Explain principal and mean curvature, the Laplacian of position, and the choice of area.',
    detectIncorrectApplication: 'Recognise missing factors of 2, flipped signs, border spikes and area errors.',
    transferToUnfamiliar: 'Use mean curvature to find features and judge surface quality.',
  },
};
