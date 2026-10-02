// Lesson 7.2: the Laplacian. How much a field at a vertex differs from its neighbours. The umbrella operator weights
// every neighbour equally; the cotan operator weights edge i–j by ½(cot α + cot β), which makes it see the surface's
// geometry rather than its triangulation: it is zero on any flat region and on any linear field. Assembled for all
// vertices it is a sparse, symmetric matrix whose rows add up to zero.

const HELPERS = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const f3 = (v) => '(' + v.map(r).join(', ') + ')'
const sub = (a, b) => a.map((x, i) => x - b[i]), add = (a, b) => a.map((x, i) => x + b[i]), mul = (a, s) => a.map((x) => x * s)
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a) => Math.hypot(...a)
// cot of the angle at c in triangle (a, b, c).
const cotAt = (a, b, c) => { const u = sub(a, c), w = sub(b, c); return dot(u, w) / len(cross(u, w)) }
// The cotan Laplacian matrix of a triangle mesh (positive on the diagonal): L[i][j] = −w_ij, L[i][i] = Σ_j w_ij.
function cotanMatrix(V, T) {
  const L = V.map(() => new Map())
  const put = (i, j, w) => L[i].set(j, (L[i].get(j) || 0) + w)
  for (const [a, b, c] of T) for (const [i, j, k] of [[a, b, c], [b, c, a], [c, a, b]]) {
    const w = cotAt(V[i], V[j], V[k]) / 2           // the angle at k faces edge i–j
    put(i, j, -w); put(j, i, -w); put(i, i, w); put(j, j, w)
  }
  return L
}
// A fan of triangles round vertex 0, flat (y = 0) and deliberately uneven.
const fanV = [[0, 0, 0], [1.1, 0, 0], [0.8, 0, 0.5], [0.4, 0, 0.9], [-1, 0, 0.3], [0.1, 0, -1]]
const fanT = [[0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 5], [0, 5, 1]]
`;

const UMBRELLA = `${HELPERS}
// Predict first: the fan is flat. Does each operator say vertex 0 sticks out of it?
const nb = [1, 2, 3, 4, 5]
const umbrella = mul(nb.reduce((s, j) => add(s, sub(fanV[j], fanV[0])), [0, 0, 0]), 1 / nb.length)
const L = cotanMatrix(fanV, fanT)
const cotan = [0, 1, 2].map((k) => -[...L[0]].reduce((s, [j, w]) => s + w * fanV[j][k], 0))   // −(L x)_0 = Σ w (x_j − x_0)
console.log('umbrella: average of (x_j − x_0) = ' + f3(umbrella) + ': not zero, it pulls vertex 0 sideways')
console.log('cotan:    Σ w_0j (x_j − x_0)    = ' + f3(cotan) + ': zero, the surface is flat here')`;

const WEIGHT = `${HELPERS}
// One edge's weight: the angles facing edge 0–2 in its two triangles, (0, 1, 2) at vertex 1 and (0, 2, 3) at vertex 3.
const deg = (rad) => r(rad * 180 / Math.PI)
const angle = (a, b, c) => Math.atan2(len(cross(sub(a, c), sub(b, c))), dot(sub(a, c), sub(b, c)))
const alpha = angle(fanV[0], fanV[2], fanV[1]), beta = angle(fanV[0], fanV[2], fanV[3])
// Predict first: which is bigger, the weight of an edge facing two small angles or two angles near 90°?
console.log('edge 0–2 faces ' + deg(alpha) + '° and ' + deg(beta) + '°: w = ½(cot α + cot β) = ' + r((1 / Math.tan(alpha) + 1 / Math.tan(beta)) / 2))
for (const a of [30, 60, 90, 120]) console.log('two angles of ' + a + '°: w = ' + r(1 / Math.tan(a * Math.PI / 180)))`;

const MATRIX = `${HELPERS}
// A regular octahedron: 6 vertices, 8 equilateral triangles, every angle 60°.
const V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
const T = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]]
const L = cotanMatrix(V, T)
// Predict first: how many non-zero entries in each row, and what does each row add up to?
L.forEach((row, i) => console.log('row ' + i + ': ' + [0, 1, 2, 3, 4, 5].map((j) => r(row.get(j) || 0)).join('  ') + '   sum ' + r([...row.values()].reduce((s, w) => s + w, 0))))
const nnz = L.reduce((s, row) => s + row.size, 0)
console.log(nnz + ' non-zeros of 36: sparse; symmetric: ' + L.every((row, i) => [...row].every(([j, w]) => Math.abs(w - (L[j].get(i) || 0)) < 1e-12)))`;

const LINEAR = `${HELPERS}
// Linear precision: for a linear field f = 2x + 3z + 1 on the flat fan, a good Laplacian should give 0 (a plane has
// no bumps). Predict first: which operator does?
const f = fanV.map((p) => 2 * p[0] + 3 * p[2] + 1)
const L = cotanMatrix(fanV, fanT)
const cotanF = [...L[0]].reduce((s, [j, w]) => s + w * f[j], 0)
const umbrellaF = [1, 2, 3, 4, 5].reduce((s, j) => s + f[j] - f[0], 0) / 5
console.log('cotan: (L f)_0 = ' + r(cotanF) + '; umbrella: ' + r(umbrellaF))
// On a curved surface the cotan Laplacian of position is 2H times the area, along the normal (lesson 7.3).
const V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
const T = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]]
const Lo = cotanMatrix(V, T), area = T.filter((t) => t.includes(0)).reduce((s, [a, b, c]) => s + len(cross(sub(V[b], V[a]), sub(V[c], V[a]))) / 6, 0)
const delta = [0, 1, 2].map((k) => -[...Lo[0]].reduce((s, [j, w]) => s + w * V[j][k], 0) / area)
console.log('octahedron vertex (1, 0, 0): Δx = ' + f3(delta) + ', so H ≈ ' + r(len(delta) / 2) + ' (a unit sphere has H = 1)')`;

const PICTURE = `${HELPERS}
// The flat fan from above, with the umbrella vector (amber) and the cotan Laplacian (a dot: zero).
const nb = [1, 2, 3, 4, 5]
const umbrella = mul(nb.reduce((s, j) => add(s, sub(fanV[j], fanV[0])), [0, 0, 0]), 1 / nb.length)
const canvas = document.createElement('canvas'), W = 360, H = 300
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'); g.scale(2, 2); g.fillStyle = '#0f1923'; g.fillRect(0, 0, W, H)
const X = (p) => [W / 2 + p[0] * 120, H / 2 - p[2] * 120]
g.strokeStyle = '#64748b'; g.lineWidth = 1.5
for (const t of fanT) { g.beginPath(); t.forEach((v, i) => { const [x, y] = X(fanV[v]); i ? g.lineTo(x, y) : g.moveTo(x, y) }); g.closePath(); g.stroke() }
const arrow = (from, to, c) => { const [x0, y0] = X(from), [x1, y1] = X(to); g.strokeStyle = c; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); const a = Math.atan2(y1 - y0, x1 - x0); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - 10 * Math.cos(a - 0.4), y1 - 10 * Math.sin(a - 0.4)); g.lineTo(x1 - 10 * Math.cos(a + 0.4), y1 - 10 * Math.sin(a + 0.4)); g.closePath(); g.fillStyle = c; g.fill() }
arrow(fanV[0], add(fanV[0], mul(umbrella, 3)), '#f59e0b')
g.fillStyle = '#4f8fd9'; const [cx, cy] = X(fanV[0]); g.beginPath(); g.arc(cx, cy, 6, 0, 2 * Math.PI); g.fill()
console.log('amber: the umbrella vector ×3, pulling vertex 0 towards the crowded side; blue dot: the cotan Laplacian, zero')`;

const CHALLENGE = `// An edge faces an angle of 60° in one triangle and 30° in the other. What is its cotan weight?
const w = 0
console.log(w)`;

const SOLVED = CHALLENGE.replace('const w = 0', 'const w = (1 / Math.tan(Math.PI / 3) + 1 / Math.tan(Math.PI / 6)) / 2');

/** The challenge's check: ½(cot 60° + cot 30°) = ½(0.5774 + 1.7321) = 1.1547. */
export function checkCotan(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+w\s*=\s*([^\n]+)/);
  if (!m) return no('Keep the line const w = …, with a number or an expression.');
  // Only arithmetic and a few Math functions are evaluated: this runs in the page, not the cell's sandbox.
  const expr = m[1].replace(/\/\/.*$/, '').trim().replace(/;$/, '');
  if (!/^[\d.\s+\-*/()]*$/.test(expr.replace(/Math\.(sin|cos|tan|sqrt|PI)/g, ''))) return no('Write the weight as a number, or arithmetic with Math.tan, Math.sin, Math.cos, Math.sqrt and Math.PI.');
  let v;
  try { v = Number(new Function('return (' + expr + ')')()); } catch { return no('That expression did not run.'); }
  if (!Number.isFinite(v)) return no('The weight must be a number.');
  const cot = (d) => 1 / Math.tan(d * Math.PI / 180), right = (cot(60) + cot(30)) / 2;
  if (Math.abs(v - right) < 5e-4) return { pass: true, message: `${+v.toFixed(4)}: ½(cot 60° + cot 30°) = ½(0.5774 + 1.7321) = 1.1547. The small 30° angle gives the larger cotangent, so a thin triangle on one side pulls the weight up.` };
  if (v === 0) return no('Use w = ½ (cot α + cot β), with cot θ = 1 / tan θ.');
  if (Math.abs(v - 2 * right) < 5e-4) return no('That is cot α + cot β; the weight is half of it.');
  if (Math.abs(v - cot(60) / 2) < 5e-4 || Math.abs(v - cot(30) / 2) < 5e-4) return no('Both angles facing the edge count: one in each of its two triangles.');
  if (Math.abs(v - (1 / Math.tan(60) + 1 / Math.tan(30)) / 2) < 5e-2) return no('Math.tan takes radians: 60° is Math.PI / 3.');
  return no(`${+v.toFixed(4)} is not ½(cot 60° + cot 30°).`);
}

export default {
  id: 'modelling-geometry-7-002',
  slug: 'the-laplacian',
  chapter: 'modelling-geometry',
  order: 2,
  title: 'The Laplacian',
  subtitle: 'How much a vertex differs from its neighbours, measured so that it sees the surface rather than its triangles.',
  tags: ['laplacian', 'cotan weights', 'sparse matrix', 'discrete differential geometry', 'operators', 'geometry processing'],
  coreConcept: 'The Laplacian of a field at a vertex is a weighted sum of (neighbour − vertex). The umbrella operator weights every neighbour equally, which depends on how the surface was cut into triangles. The cotan operator weights edge i–j by ½(cot α + cot β), the angles facing it in its two triangles, and divides by the vertex\'s area; it is zero on every flat region and on every linear field, so it measures only the surface\'s shape. Assembled for all vertices it is a sparse, symmetric matrix whose rows add to zero, and applied to positions it gives the mean-curvature normal, 2H n.',
  prerequisites: ['modelling-geometry-7-001', 'modelling-geometry-5-006'],
  timeToComplete: 45,
  nextLesson: 'modelling-geometry-7-003',

  hook: {
    question: 'Lesson 5.6 smoothed a mesh by pulling each vertex towards its neighbours\' average. On an unevenly cut flat surface, that same rule slides vertices sideways even though the surface has no bumps at all. What would a rule that only reacts to real shape look like?',
    realWorldContext: 'The cotan Laplacian is the workhorse of geometry processing: smoothing, curvature, distances, parameterisation (UV unwrapping), deformation and skinning weights all build and solve it. Every lesson left in this chapter, and the unwrap and automatic weights of chapters 8 and 10, use this one matrix.',
  },

  intuition: {
    prose: [
      'The **Laplacian** of a field at a vertex measures how much the vertex differs from its neighbours: a weighted sum of $(f_j - f_i)$. Applied to positions, it says which way and how far a vertex sticks out of the surface round it.',
      'The simplest choice, the **umbrella** operator, weights every neighbour equally: the average of $(x_j - x_i)$. It is what lesson 5.6\'s smoothing used. Before running cell 1, predict: on a flat but unevenly cut fan, is the umbrella vector zero? No: it points towards the side where the neighbours crowd, so smoothing would slide the vertex sideways in a perfectly flat surface.',
      'The **cotan** operator fixes this. Each edge $i$–$j$ is weighted by $w_{ij} = \\tfrac12(\\cot\\alpha_{ij} + \\cot\\beta_{ij})$, where $\\alpha$ and $\\beta$ are the angles facing the edge in its two triangles. On the same flat fan, $\\sum_j w_{ij}(x_j - x_i) = 0$ exactly (cell 1): the weights exactly balance the uneven cut.',
      'Before running cell 2, predict: which edge gets the larger weight, one facing two small angles or two near $90°$? Small angles: $\\cot 30° = 1.73$, $\\cot 60° = 0.58$, $\\cot 90° = 0$, and angles over $90°$ give negative weights.',
      'Collect every vertex\'s weights into a matrix $L$: $L_{ij} = -w_{ij}$ for neighbours, $L_{ii} = \\sum_j w_{ij}$ on the diagonal, $0$ everywhere else (cell 3). Each row has only as many entries as the vertex has neighbours, plus one: the matrix is **sparse**. It is **symmetric** ($w_{ij} = w_{ji}$) and its rows add up to $0$ (a constant field has no Laplacian).',
      'The deeper reason the cotan weights are right: they make $L$ exactly zero on every **linear** field (cell 4). A plane has no curvature and a linear function no bumps, so a Laplacian that reports either is measuring the triangles, not the shape. And applied to positions on a curved surface, $\\tfrac{1}{A}\\sum w_{ij}(x_j - x_i)$ points along the normal with length $2H$: on the octahedron, a crude unit sphere, it gives $H = 1$ at each corner, exactly a unit sphere\'s value.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Build the cotan Laplacian',
        body: 'Step 1. For each triangle (i, j, k) and each of its corners k: w = ½ cot(angle at k), added to the edge i–j it faces.\nStep 2. L[i][j] −= w, L[j][i] −= w, L[i][i] += w, L[j][j] += w.\nStep 3. Each vertex\'s area A_i: a third of the area of each triangle round it (the mass).\nStep 4. The Laplacian of a field f at i: −(L f)_i / A_i = (1/A_i) Σ_j w_ij (f_j − f_i).',
      },
      {
        type: 'warning',
        title: 'Obtuse triangles give negative weights',
        body: 'An angle over 90° has a negative cotangent. Meshes with many very obtuse triangles can give a Laplacian with negative off-diagonal weights, which lets smoothing and heat flow overshoot. Remeshing to better-shaped triangles, or the "intrinsic Delaunay" Laplacian, avoids it.',
      },
      {
        type: 'warning',
        title: 'Uniform weights depend on the triangulation',
        body: 'The umbrella operator gives different answers for the same surface cut differently: it slides vertices along flat regions and mis-measures curvature. Use it for quick relaxation, not for measurement.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: none directly, but everything after it',
        body: 'The Laplacian is not drawn; it is the machine behind what is drawn next: the curvature heat maps (7.3, 7.4), the distance contours (7.6), smoothing (7.7), the LSCM unwrap (8.4) and automatic skin weights (10.5).',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "the Laplacian is just the average of the neighbours". On a flat, unevenly cut fan, the umbrella vector (amber) pulls the centre towards the crowded side; the cotan Laplacian (blue dot) is exactly zero, because there is no shape to react to.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'cotanMatrix() in the cells is Steps 1–2; the octahedron\'s area in cell 4 is Step 3; the sums over a row are Step 4.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Nothing here runs on the GPU in MeshLab; the matrix is built and solved on the CPU (lesson 7.5). Its results become per-vertex fields drawn as colours.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Mesh › Trace the Laplacian (one vertex) builds the operator at one vertex: neighbours, umbrella, cotan weights (predict one), area and Δx with its H. Scripts call mesh.laplacianAt(v) and mesh.laplacian() for the whole matrix.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: the cotan Laplacian',
        caption: 'Umbrella against cotan on a flat fan, one edge weight, the assembled matrix, linear precision, and the two vectors drawn.',
        props: {
          lesson: {
            title: 'The Laplacian',
            subtitle: 'Weights that see the shape.',
            cells: [
              { type: 'js', instruction: '### 1. Umbrella or cotan\nPredict first: on a flat fan, which operator says the centre sticks out?', startCode: UMBRELLA },
              { type: 'js', instruction: '### 2. One edge\'s weight\nPredict first: small angles or right angles, which weigh more?', startCode: WEIGHT },
              { type: 'js', instruction: '### 3. The matrix\nPredict first: non-zeros per row, and each row\'s sum.', startCode: MATRIX },
              { type: 'js', instruction: '### 4. Linear fields, and curvature\nPredict first: which operator gives 0 on a linear field?', startCode: LINEAR },
              { type: 'js', instruction: '### 5. See it\nThe flat fan from above: the umbrella vector and the cotan Laplacian.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 320 },
              { type: 'challenge', instruction: '### 6. Challenge: a cotan weight\nAngles of 60° and 30°. The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkCotan },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "The Laplacian" in MeshLab](#/lab/mesh-lab?project=laplacian). The Laplacian at a sphere\'s equator is traced: press Play, predict an edge\'s cotan weight, and read H at the end (about 0.5 for radius 2). Then trace a vertex near a pole.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Mesh › Trace the Laplacian (one vertex).**\n- **Heat map › Mean curvature:** the Laplacian of position at every vertex, as H.\n- In a script: `mesh.laplacianAt(v)`, `mesh.laplacian()` (rows and masses).\n- [Open "Noise and smoothing" in MeshLab](#/lab/mesh-lab?project=smoothing): smoothing with the umbrella operator, and its cost.\n- **Elsewhere:** libigl\'s `cotmatrix` and `massmatrix`, and Blender\'s Laplacian Smooth modifier, use the same construction.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**From the smooth Laplacian.** On a surface, $\\Delta f$ is the divergence of the gradient of $f$; integrated over a small region round a vertex it becomes, by the divergence theorem, the flux of $\\nabla f$ through the region\'s boundary. For a piecewise-linear $f$ (lesson 7.1), that flux works out edge by edge to $\\sum_j \\tfrac12(\\cot\\alpha_{ij} + \\cot\\beta_{ij})(f_j - f_i)$.',
      '**The matrix.** $L$ is the "stiffness" matrix: $L = \\sum_{\\text{edges}} w_{ij}(e_i - e_j)(e_i - e_j)^{\\mathrm{T}}$, so it is symmetric, its rows sum to $0$, and $f^{\\mathrm{T}} L f = \\sum_{\\text{edges}} w_{ij}(f_i - f_j)^2 \\ge 0$ when the weights are positive: the Dirichlet energy, how much $f$ varies over the surface.',
      '**Linear precision.** For $f$ linear on a flat region, $\\nabla f$ is constant, so the flux through any closed boundary is $0$: $(Lf)_i = 0$ at every interior vertex. The umbrella operator lacks this property unless the mesh is perfectly regular.',
      '**Mean curvature.** For the position function $x$, $\\Delta x = -2H\\,n$ (the Laplace–Beltrami operator of the embedding). Discretely, $\\tfrac{1}{A_i}\\sum_j w_{ij}(x_j - x_i) \\approx 2H_i n_i$ pointing inward on convex surfaces: lesson 7.3 builds curvature from it.',
    ],
    equations: [
      { label: 'Cotan weight', latex: 'w_{ij} = \\tfrac12\\big(\\cot\\alpha_{ij} + \\cot\\beta_{ij}\\big)' },
      { label: 'Laplacian at a vertex', latex: '(\\Delta f)_i = \\frac{1}{A_i}\\sum_{j} w_{ij}\\,(f_j - f_i)' },
      { label: 'Dirichlet energy', latex: 'f^{\\mathrm{T}} L f = \\sum_{ij \\in E} w_{ij}\\,(f_i - f_j)^2' },
      { label: 'On positions', latex: '\\Delta x \\approx -2H\\,n' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** The cotan Laplacian is the matrix of the Dirichlet energy of piecewise-linear functions on a triangle mesh (finite-element stiffness matrix); with the lumped mass matrix it discretises the Laplace–Beltrami operator, converging (in a weak sense) as meshes are refined with well-shaped triangles.',
      '**Invariant viewpoint.** The cotan weights depend only on the triangles\' angles, so they are unchanged by rigid motions and by scaling (cotangents of angles do not change); the mass scales with area, so Δ scales as 1 / length².',
      '**Geometric picture.** Picture each edge as a spring whose stiffness is its cotan weight. The Laplacian at a vertex is the net force the springs pull it with. On a flat region the forces balance exactly; on a dome they pull inward, more the more curved it is.',
      '**Where this goes.** Lesson 7.3 turns Δx into mean curvature; 7.5 solves systems with L; 7.6 and 7.7 use it for distances and smoothing.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-7-002-ex1',
      title: 'A right-angled weight',
      problem: 'An edge faces $90°$ in both its triangles (the diagonal of a square split into two triangles faces two right angles). Its weight?',
      steps: [{ expression: '\\tfrac12(\\cot 90° + \\cot 90°) = 0', annotation: 'cot 90° = 0.' }],
      conclusion: '0: a square\'s diagonal contributes nothing, so splitting a square either way gives the same Laplacian.',
    },
    {
      id: 'modelling-geometry-7-002-ex2',
      title: 'An equilateral edge',
      problem: 'An edge between two equilateral triangles. Its weight?',
      steps: [{ expression: '\\tfrac12(\\cot 60° + \\cot 60°) = \\cot 60° = 0.5774', annotation: 'Both angles 60°.' }],
      conclusion: '0.5774, the octahedron\'s weights in cell 3.',
    },
    {
      id: 'modelling-geometry-7-002-ex3',
      title: 'A row of the matrix',
      problem: 'A vertex has four neighbours with weights $0.5, 1, 0.5, 1$. Write its row of $L$.',
      steps: [
        { expression: 'L_{ii} = 0.5 + 1 + 0.5 + 1 = 3', annotation: 'The sum of the weights.' },
        { expression: 'L_{ij} = -0.5, -1, -0.5, -1', annotation: 'Minus each weight.' },
      ],
      conclusion: '3 on the diagonal, −0.5, −1, −0.5, −1 for the neighbours, 0 elsewhere: the row sums to 0.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-7-002-ch1',
      difficulty: 'easy',
      problem: 'Why does every row of $L$ add up to zero?',
      walkthrough: [{ expression: '\\text{a constant field has no Laplacian}', annotation: 'f_j − f_i = 0 for all j.' }],
      answer: 'The diagonal is the sum of the row\'s weights and the off-diagonals are minus each weight, so L applied to a constant field gives zero: a constant has no bumps.',
    },
    {
      id: 'modelling-geometry-7-002-ch2',
      difficulty: 'medium',
      problem: 'A mesh has a very obtuse triangle with a 150° angle. What does that do to the edge it faces, and why might it matter?',
      walkthrough: [
        { expression: '\\cot 150° = -1.73', annotation: 'Negative.' },
        { expression: '\\text{the edge\'s weight may be negative}', annotation: 'If the other angle does not compensate.' },
      ],
      answer: 'cot 150° = −1.73, so that edge\'s weight can be negative: a "spring" that pushes instead of pulls. Smoothing and heat flow can then overshoot or oscillate; better-shaped triangles (or an intrinsic Delaunay triangulation) keep weights positive.',
    },
    {
      id: 'modelling-geometry-7-002-ch3',
      difficulty: 'hard',
      problem: 'Show that for any triangle, the cotan contributions of its three corners give zero Laplacian for a linear field restricted to that triangle\'s edges.',
      walkthrough: [
        { expression: '\\sum_{\\text{corners}} \\cot\\theta_k\\,(f_j - f_i) \\text{ is the flux of the constant } \\nabla f', annotation: 'Per triangle.' },
        { expression: '\\text{a constant field has zero net flux through a closed loop}', annotation: 'Divergence theorem.' },
      ],
      answer: 'For a linear f, ∇f is constant on the triangle; the cotan formula is exactly the flux of ∇f through the triangle\'s dual boundary pieces, and a constant vector field has zero net flux through any closed curve. Summed over the triangles round an interior vertex, the contributions cancel: (Lf)ᵢ = 0.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'w_{ij}', meaning: 'The cotan weight of edge i–j: ½(cot α + cot β).' },
      { symbol: 'L', meaning: 'The cotan Laplacian matrix: −w off the diagonal, the sum of the weights on it.' },
      { symbol: 'A_i', meaning: 'Vertex i\'s area (mass): a third of each triangle round it.' },
      { symbol: '(\\Delta f)_i', meaning: 'The Laplacian of f at i: how much f differs from its surroundings, per area.' },
      { symbol: '\\text{umbrella}', meaning: 'Equal weights: the plain average of the neighbours.' },
      { symbol: 'H', meaning: 'Mean curvature: |Δx| / 2.' },
    ],
    rulesOfThumb: [
      'Cotan for measuring, umbrella for quick relaxing.',
      'Small facing angles, big weights; obtuse angles, negative ones.',
      'Rows sum to zero; the matrix is symmetric and sparse.',
      'Zero on planes and linear fields.',
      'Δx points along the normal with length 2H.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-5-006', label: 'Merge and smooth vertices', note: 'The umbrella operator as smoothing.' },
      { lessonId: 'modelling-geometry-7-001', label: 'Fields on a mesh and colour maps', note: 'The piecewise-linear fields the Laplacian acts on.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-7-003', label: 'Mean curvature', note: 'H from Δx at every vertex.' },
      { lessonId: 'modelling-geometry-7-005', label: 'Sparse linear systems', note: 'Solving with L.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-7-002-1', label: 'Read the umbrella and cotan operators', type: 'read' },
    { id: 'cp-modelling-geometry-7-002-2', label: 'Read how the sparse matrix is assembled', type: 'read' },
    { id: 'cp-modelling-geometry-7-002-3', label: 'Read why cotan weights give zero on linear fields', type: 'read' },
    { id: 'cp-modelling-geometry-7-002-4', label: 'Run cells 1 to 4: umbrella vs cotan, a weight, the matrix, linear fields', type: 'lab' },
    { id: 'cp-modelling-geometry-7-002-5', label: 'Trace the Laplacian at a sphere vertex in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-7-002-6', label: 'Work through example 1, a right-angled weight', type: 'example' },
    { id: 'cp-modelling-geometry-7-002-7', label: 'Work through example 3, a row of the matrix', type: 'example' },
    { id: 'cp-modelling-geometry-7-002-8', label: 'Complete the challenge: a cotan weight', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-7-002-assess-1',
        type: 'choice',
        text: 'An edge faces 45° in both its triangles. Its cotan weight is:',
        options: ['1', '0.5', '0.7071', '2'],
        answer: '1',
        hint: '½(cot 45° + cot 45°), cot 45° = 1.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-7-002-quiz-1',
      type: 'choice',
      text: 'On a flat but unevenly cut fan, what is the cotan Laplacian of the centre\'s position?',
      options: ['Zero', 'Towards the crowded side', 'Along the normal', 'Infinite'],
      answer: 'Zero',
      hints: ['Cell 1.', 'A plane has no shape to react to.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-7-002-quiz-2',
      type: 'choice',
      text: 'What does each row of the cotan matrix add up to?',
      options: ['0', '1', 'The vertex\'s area', 'The number of neighbours'],
      answer: '0',
      hints: ['Cell 3.', 'Constants have no Laplacian.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-7-002-quiz-3',
      type: 'choice',
      text: 'Which angles give an edge a negative weight?',
      options: ['Obtuse ones, over 90°', 'Small ones', 'Right angles', 'None'],
      answer: 'Obtuse ones, over 90°',
      hints: ['cot of an obtuse angle is negative.', 'Warning.'],
      reviewSection: 'Warning "Obtuse triangles give negative weights"',
    },
    {
      id: 'modelling-geometry-7-002-quiz-4',
      type: 'choice',
      text: 'Why is the cotan Laplacian zero on a linear field?',
      options: ['The flux of a constant gradient through a closed loop is zero', 'It ignores linear fields', 'Linear fields are constant', 'Because the weights are positive'],
      answer: 'The flux of a constant gradient through a closed loop is zero',
      hints: ['Maths: linear precision.', 'Challenge 3.'],
      reviewSection: 'Maths',
    },
    {
      id: 'modelling-geometry-7-002-quiz-5',
      type: 'choice',
      text: 'Applied to positions, the cotan Laplacian at a vertex gives:',
      options: ['A vector along the normal of length 2H', 'The vertex position', 'The area', 'Zero always'],
      answer: 'A vector along the normal of length 2H',
      hints: ['Cell 4: the octahedron.', 'Lesson 7.3.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-7-002-quiz-6',
      type: 'choice',
      text: 'How many non-zeros does a row of L have for a vertex with 6 neighbours?',
      options: ['7', '6', '36', 'As many as there are vertices'],
      answer: '7',
      hints: ['One per neighbour plus the diagonal.', 'Sparse.'],
      reviewSection: 'Cell 3',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'The Laplacian is the neighbours\' average minus the vertex.',
      whyStudentsThinkIt: 'That is the umbrella operator, the simplest one.',
      correctionExample: 'Cell 1: on a flat fan the umbrella vector is not zero; the cotan one is.',
      contrastCase: 'On a perfectly regular grid the two agree up to a constant factor.',
    },
    {
      falseBelief: 'Laplacian weights are always positive.',
      whyStudentsThinkIt: 'Averages use positive weights.',
      correctionExample: 'cot 150° is negative: obtuse triangles can make a weight negative.',
      contrastCase: 'On well-shaped (Delaunay) meshes all cotan weights are non-negative.',
    },
    {
      falseBelief: 'The Laplacian matrix is dense.',
      whyStudentsThinkIt: 'It has a row and column for every vertex.',
      correctionExample: 'Cell 3: the octahedron has 30 non-zeros of 36; a 100 000-vertex mesh has about 7 per row.',
      contrastCase: 'Its inverse is dense, which is why systems with L are solved iteratively (lesson 7.5).',
    },
  ],

  transferPrompts: [
    {
      situation: 'A scanned surface with very uneven triangle sizes needs its curvature measured.',
      competingTechniques: ['Umbrella Laplacian', 'Cotan Laplacian with lumped mass'],
      whyThisTechniqueWins: 'The cotan operator responds to shape, not to the uneven triangulation, so the curvature is not polluted by how the scanner cut the surface.',
    },
    {
      situation: 'A quick, approximate relaxation of a mesh before remeshing.',
      competingTechniques: ['Cotan smoothing', 'Umbrella smoothing'],
      whyThisTechniqueWins: 'Here sliding vertices into evenly spaced positions is wanted, which is exactly what the umbrella operator does; it is also cheaper.',
    },
  ],

  debugging: [
    {
      commonError: 'Using the angle at the edge\'s own endpoints instead of the angle facing it.',
      symptom: 'Curvature is wrong even on a sphere; flat regions show a Laplacian.',
      whyItHappened: 'The weight of edge i–j must use the angles opposite it, at the third corner of each triangle.',
      repairStrategy: 'For triangle (i, j, k), the angle at k weights edge i–j.',
    },
    {
      commonError: 'Forgetting to divide by the vertex area.',
      symptom: 'Curvature depends on how finely the mesh is cut.',
      whyItHappened: 'The weighted sum is a total over the vertex\'s region, not a density.',
      repairStrategy: 'Divide by Aᵢ, a third of the area of its triangles.',
    },
    {
      commonError: 'Degrees passed to Math.tan.',
      symptom: 'Weights come out wild and change sign at random.',
      whyItHappened: 'Math functions take radians.',
      repairStrategy: 'Compute cotangents from vectors (dot / |cross|) and skip angles altogether.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Compute cotan weights, assemble rows of L, and apply it to a field or positions.',
    explainVerbally: 'Explain why the cotan operator sees shape and the umbrella operator sees triangulation, and what the matrix\'s properties mean.',
    detectIncorrectApplication: 'Recognise wrong angles, missing areas and negative weights from their symptoms.',
    transferToUnfamiliar: 'Choose between umbrella and cotan for relaxation or measurement tasks.',
  },
};
