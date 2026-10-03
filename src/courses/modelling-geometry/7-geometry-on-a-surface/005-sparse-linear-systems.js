// Lesson 7.5: sparse linear systems. Geometry processing turns into A u = b with one unknown per vertex, where A is
// built from the Laplacian: sparse (a handful of non-zeros per row), symmetric and positive definite. Such systems are
// solved iteratively, multiplying A by vectors and never forming its inverse. Conjugate gradients converges far faster
// than Jacobi, and how fast depends on the system: a short heat step is easy, a Poisson problem harder.

const HELPERS = `// A sparse matrix as rows of (column → value). Only the non-zeros are stored.
// The 5-point grid Laplacian on an N × N grid (zero beyond the border), plus 'shift' on the diagonal:
// shift 1 is a heat step with t = h² (scaled by 1/h²); shift 0 is the Poisson problem.
function gridMatrix(N, shift) {
  const rows = Array.from({ length: N * N }, () => new Map())
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const k = i * N + j, row = rows[k]
    row.set(k, 4 + shift)
    if (i > 0) row.set(k - N, -1); if (i < N - 1) row.set(k + N, -1); if (j > 0) row.set(k - 1, -1); if (j < N - 1) row.set(k + 1, -1)
  }
  return rows
}
const mul = (A, x) => A.map((row) => { let s = 0; for (const [c, v] of row) s += v * x[c]; return s })
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)
const norm = (a) => Math.sqrt(dot(a, a))
// Conjugate gradients for a symmetric positive definite A. Returns the solution and the residual history.
function cg(A, b, tol = 1e-8) {
  let x = b.map(() => 0), r = b.slice(), p = r.slice(), rr = dot(r, r)
  const history = [], bn = norm(b)
  while (Math.sqrt(rr) / bn > tol && history.length < 20000) {
    const Ap = mul(A, p), alpha = rr / dot(p, Ap)
    x = x.map((v, i) => v + alpha * p[i]); r = r.map((v, i) => v - alpha * Ap[i])
    const rr2 = dot(r, r); p = r.map((v, i) => v + (rr2 / rr) * p[i]); rr = rr2
    history.push(Math.sqrt(rr) / bn)
  }
  return { x, history }
}
// Jacobi: update every unknown from its own row, x_i ← x_i + (b_i − (A x)_i) / A_ii.
function jacobi(A, b, tol = 1e-8) {
  let x = b.map(() => 0); const history = [], bn = norm(b)
  while (history.length < 20000) {
    const Ax = mul(A, x), r = b.map((v, i) => v - Ax[i])
    history.push(norm(r) / bn); if (history.at(-1) < tol) break
    x = x.map((v, i) => v + r[i] / A[i].get(i))
  }
  return { x, history }
}
const spike = (N) => { const b = new Array(N * N).fill(0); b[Math.floor(N / 2) * N + Math.floor(N / 2)] = 1; return b }
`;

const SPARSE = `${HELPERS}
// Predict first: an N × N grid has N² unknowns. How many non-zeros does its matrix have, against N⁴ for a dense one?
for (const N of [10, 100, 300]) {
  const nnz = N * N * 5 - 4 * N                    // 5 per row, minus the missing neighbours on the border
  console.log(N + ' × ' + N + ': ' + (N * N).toLocaleString('en') + ' unknowns, ' + nnz.toLocaleString('en') + ' non-zeros; dense: ' + (N ** 4).toLocaleString('en') + ' (' + (100 * nnz / N ** 4).toPrecision(2) + '%)')
}
const A = gridMatrix(10, 0)
console.log('counted for N = 10: ' + A.reduce((s, row) => s + row.size, 0) + ' non-zeros')`;

const SPD = `${HELPERS}
// Symmetric: A_ij = A_ji. Positive definite: xᵀ A x > 0 for every x ≠ 0. Check both on the heat matrix.
const A = gridMatrix(6, 1)
const symmetric = A.every((row, i) => [...row].every(([j, v]) => A[j].get(i) === v))
let seed = 3; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5
let smallest = Infinity
for (let trial = 0; trial < 200; trial++) { const x = A.map(rand); smallest = Math.min(smallest, dot(x, mul(A, x)) / dot(x, x)) }
console.log('symmetric: ' + symmetric + '; xᵀAx / xᵀx over 200 random x: smallest ' + smallest.toFixed(4) + ' > 0')
// Why: xᵀ (grid Laplacian) x is a sum of squared differences across edges (≥ 0), and the shift adds Σ x² (> 0).
const x = A.map(rand)
const edges = A.reduce((s, row, i) => s + [...row].filter(([j]) => j > i).reduce((t, [j]) => t + (x[i] - x[j]) ** 2, 0), 0)
const border = A.reduce((s, row, i) => s + (4 - (row.size - 1)) * x[i] ** 2, 0)
console.log('one x: xᵀAx = ' + dot(x, mul(A, x)).toFixed(4) + ' = Σ edges (x_i − x_j)² ' + edges.toFixed(4) + ' + border terms ' + border.toFixed(4) + ' + Σ x² ' + dot(x, x).toFixed(4))`;

const SOLVE = `${HELPERS}
// One heat step on a 20 × 20 grid. Predict first: conjugate gradients or Jacobi, which needs fewer iterations?
const N = 20, A = gridMatrix(N, 1), b = spike(N)
const c = cg(A, b), j = jacobi(A, b)
console.log('CG: ' + c.history.length + ' iterations; residual after 1, 5, 10, 20: ' + [1, 5, 10, 20].map((k) => c.history[k - 1].toExponential(1)).join(', '))
console.log('Jacobi: ' + j.history.length + ' iterations')
// Each iteration costs one multiplication by A: about 5 × 400 = 2000 multiply-adds, not 400² = 160 000.
console.log('both reach the same answer: largest difference ' + Math.max(...c.x.map((v, i) => Math.abs(v - j.x[i]))).toExponential(1))`;

const SCALING = `${HELPERS}
// How do the counts grow with the grid? Predict first: for the heat step and for Poisson, as N doubles.
for (const [name, shift] of [['heat step', 1], ['Poisson', 0]]) for (const N of [10, 20, 40]) {
  const A = gridMatrix(N, shift), b = spike(N)
  console.log(name + ', ' + N + ' × ' + N + ': CG ' + cg(A, b).history.length + ', Jacobi ' + jacobi(A, b).history.length)
}`;

const PICTURE = `${HELPERS}
// Residual against iteration (log scale) for the Poisson problem on a 20 × 20 grid: CG (blue) and Jacobi (amber).
const N = 20, A = gridMatrix(N, 0), b = spike(N), c = cg(A, b).history, j = jacobi(A, b).history
const canvas = document.createElement('canvas'), W = 380, H = 280
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'); g.scale(2, 2); g.fillStyle = '#0f1923'; g.fillRect(0, 0, W, H)
const maxIt = j.length, X = (k) => 40 + (W - 60) * k / maxIt, Y = (res) => 20 + (H - 50) * (-Math.log10(res)) / 8
g.strokeStyle = '#334155'; g.fillStyle = '#94a3b8'; g.font = '10px sans-serif'
for (let e = 0; e <= 8; e += 2) { g.beginPath(); g.moveTo(40, Y(10 ** -e)); g.lineTo(W - 20, Y(10 ** -e)); g.stroke(); g.fillText(e ? '1e-' + e : '1', 4, Y(10 ** -e) + 3) }
const plot = (h, colour) => { g.strokeStyle = colour; g.lineWidth = 2; g.beginPath(); h.forEach((res, k) => (k ? g.lineTo(X(k + 1), Y(res)) : g.moveTo(X(1), Y(res)))); g.stroke() }
plot(j, '#f59e0b'); plot(c, '#4f8fd9')
console.log('blue: CG, ' + c.length + ' iterations; amber: Jacobi, ' + j.length + '. Both start at the same residual; CG drops off a cliff')`;

const CHALLENGE = `// A mesh has 100 000 vertices, each with about 6 neighbours. Its Laplacian has one row and column per vertex.
// How many numbers does it take stored densely, and stored sparsely (non-zeros only: the diagonal plus neighbours)?
const answer = { dense: 0, sparse: 0 }
console.log(answer)`;

const SOLVED = CHALLENGE.replace('const answer = { dense: 0, sparse: 0 }', 'const answer = { dense: 1e10, sparse: 700000 }');

/** The challenge's check: dense 100 000² = 10¹⁰; sparse 100 000 × 7 = 700 000. */
export function checkStorage(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+answer\s*=\s*\{([^}]*)\}/);
  if (!m) return no('Keep the line const answer = { dense: …, sparse: … }.');
  const get = (k) => { const g = m[1].match(new RegExp(k + '\\s*:\\s*([\\d.e+_]+)')); return g ? Number(g[1].replace(/_/g, '')) : NaN; };
  const dense = get('dense'), sparse = get('sparse');
  if ([dense, sparse].some(Number.isNaN)) return no('Give both as numbers (1e10 is fine): dense and sparse.');
  if (dense === 2e5 || dense === 1e5) return no('Dense means every entry, n × n: 100 000 × 100 000.');
  if (Math.abs(dense - 1e10) > 1) return no(`n² for n = 100 000 is not ${dense}.`);
  if (sparse === 600000) return no('Each row also has its diagonal entry: 6 neighbours + 1 = 7 per row.');
  if (sparse === 1e5) return no('That is one per row; each row has the diagonal and 6 neighbours.');
  if (Math.abs(sparse - 700000) > 1) return no(`100 000 rows × 7 non-zeros is not ${sparse}.`);
  return { pass: true, message: '10¹⁰ and 700 000. Dense, at 8 bytes a number, that is 80 GB; sparse, about 5.6 MB (plus the column numbers). The inverse of A would be dense, which is why such systems are solved by iterating with A, never by inverting it.' };
}

export default {
  id: 'modelling-geometry-7-005',
  slug: 'sparse-linear-systems',
  chapter: 'modelling-geometry',
  order: 5,
  title: 'Sparse linear systems',
  subtitle: 'One unknown per vertex, a handful of non-zeros per row: how geometry problems are solved fast.',
  tags: ['sparse matrices', 'conjugate gradients', 'jacobi', 'linear systems', 'spd', 'numerical methods'],
  coreConcept: 'Heat flow, distances, smoothing, unwrapping and skin weights all become a linear system A u = b with one unknown per vertex, where A is built from the cotan Laplacian. Each row has a non-zero only for the vertex and its neighbours, so A is sparse: about 7 numbers per row instead of n. It is symmetric and positive definite (uᵀAu is a sum of squares), which lets conjugate gradients solve it iteratively: each iteration multiplies A by one vector and moves along a new direction that never undoes earlier progress. CG needs far fewer iterations than Jacobi, and how many depends on the system\'s conditioning: a short heat step converges in a near-constant count, a Poisson problem takes more as the mesh grows.',
  prerequisites: ['modelling-geometry-7-004', 'modelling-geometry-7-002'],
  timeToComplete: 45,
  nextLesson: 'modelling-geometry-7-006',

  hook: {
    question: 'A mesh with 100 000 vertices gives a system with 100 000 unknowns. Gaussian elimination from school would take about 3 × 10¹⁴ operations and 80 GB of memory. Yet MeshLab solves such systems in a blink. How?',
    realWorldContext: 'Every physics engine, finite-element code, image editor (Poisson blending) and geometry tool solves sparse symmetric systems constantly; conjugate gradients and its relatives are among the most-used algorithms in scientific computing.',
  },

  intuition: {
    prose: [
      'Lesson 7.2 built the Laplacian $L$, one row per vertex. Many problems ask for an unknown field $u$ with $A u = b$, where $A$ is built from $L$: one heat step is $(M + tL)u = \\delta$, a "Poisson" problem is $L u = f$.',
      'Row $i$ of $A$ has a non-zero only for vertex $i$ and its neighbours. Before running cell 1, predict: on a $100 \\times 100$ grid ($10\\,000$ unknowns), how many non-zeros? About $50\\,000$, against $10^8$ for a dense matrix: $0.05\\%$. A is **sparse**, so we store only its non-zeros and only ever multiply it by vectors.',
      'A is also **symmetric positive definite** (cell 2): $A_{ij} = A_{ji}$, and $u^{\\mathrm{T}}Au > 0$ for every $u \\neq 0$, because $u^{\\mathrm{T}}Lu = \\sum_{\\text{edges}} w_{ij}(u_i - u_j)^2 \\ge 0$ and the heat step adds $\\sum M_i u_i^2 > 0$. That makes $\\tfrac12 u^{\\mathrm{T}}Au - b^{\\mathrm{T}}u$ a bowl with one bottom, and solving the system means finding that bottom.',
      '**Jacobi** fixes each unknown from its own row, again and again. Information travels one edge per iteration, so it is slow. **Conjugate gradients** (CG) slides down the bowl along a sequence of directions, each "A-orthogonal" to all the previous ones, so it never undoes earlier progress. Before running cell 3, predict which needs fewer iterations on a heat step: CG, about $26$ against Jacobi\'s $72$.',
      'How many iterations depends on the system (cell 4). A short heat step is well conditioned: the $M$ term dominates, and CG takes about the same number of iterations however big the mesh. A Poisson problem is worse: CG\'s count roughly doubles each time the grid doubles in width, Jacobi\'s roughly quadruples. That is why lesson 7.6\'s heat method first takes a short heat step: its expensive part is the second, Poisson solve.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Conjugate gradients for A x = b (A symmetric positive definite)',
        body: 'Step 1. x = 0, r = b, p = r.\nStep 2. α = (r·r) / (p·Ap); x += α p; r −= α Ap.\nStep 3. If |r| / |b| < tol, stop.\nStep 4. β = (new r·r) / (old r·r); p = r + β p.\nStep 5. Repeat from Step 2. Each iteration: one sparse multiplication Ap and a few vector sums.',
      },
      {
        type: 'warning',
        title: 'Never invert a sparse matrix',
        body: 'The inverse of a sparse matrix is usually dense: for 100 000 vertices that is 10¹⁰ numbers. Solve with the matrix (iteratively, or with a sparse factorisation); never form its inverse.',
      },
      {
        type: 'warning',
        title: 'CG needs symmetric positive definite',
        body: 'On a non-symmetric or indefinite matrix CG can stall or diverge. Negative cotan weights from very obtuse triangles (lesson 7.2) can break positive definiteness; a pure Laplacian (no M) is only semi-definite: add a tiny multiple of M, or pin one value.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: none, but it decides what can be interactive',
        body: 'A solve that takes tens of iterations of a sparse multiply runs at interactive rates on meshes of hundreds of thousands of vertices; a dense solve would not run at all. Geodesic distances, smoothing previews and live unwrap updates in MeshLab depend on it.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "iterative methods are all slow and approximate". On the same Poisson problem CG\'s residual (blue) falls steeply to 10⁻⁸ in about 60 iterations, while Jacobi (amber) creeps down over about 1500. Both stop at the same accuracy: the answer is as exact as asked for.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'gridMatrix() stores only the non-zeros; mul() is the one operation both solvers need; cg() is the procedure, Steps 1–5; jacobi() the slow comparison.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Sparse matrix–vector products parallelise well, so large solvers run CG on the GPU; MeshLab solves on the CPU, which is plenty for meshes of this size.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Heat map › Trace the heat solve (one vertex) traces one heat step: the matrix\'s size and sparsity (predict a row\'s non-zeros), the SPD check, CG\'s residual iteration by iteration, and Jacobi\'s count for comparison. Scripts call mesh.solveHeat(v).' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: solve a sparse system',
        caption: 'Sparsity, symmetric positive definiteness, CG against Jacobi, how the counts scale, and the residuals plotted.',
        props: {
          lesson: {
            title: 'Sparse linear systems',
            subtitle: 'Solve with A, never invert it.',
            cells: [
              { type: 'js', instruction: '### 1. Sparse\nPredict first: non-zeros on a 100 × 100 grid.', startCode: SPARSE },
              { type: 'js', instruction: '### 2. Symmetric positive definite\nWhy xᵀAx is always positive.', startCode: SPD },
              { type: 'js', instruction: '### 3. CG against Jacobi\nPredict first: which needs fewer iterations?', startCode: SOLVE },
              { type: 'js', instruction: '### 4. How the counts grow\nPredict first: heat step and Poisson, as the grid doubles.', startCode: SCALING },
              { type: 'js', instruction: '### 5. See it\nResidual against iteration for both methods.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 300 },
              { type: 'challenge', instruction: '### 6. Challenge: storage\nDense against sparse for a real mesh. The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkStorage },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Sparse linear systems" in MeshLab](#/lab/mesh-lab?project=sparse-solve). One heat step on a sphere is traced: press Play, predict a row\'s non-zeros, and compare CG\'s 45 iterations with Jacobi\'s 310.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Heat map › Trace the heat solve (one vertex).**\n- In a script: `mesh.solveHeat(v)`, `mesh.laplacian()` for the rows themselves.\n- [Open "Distance on a knot" in MeshLab](#/lab/mesh-lab?project=knot-distance): the heat method, two solves like this one.\n- **Elsewhere:** Eigen\'s ConjugateGradient and SimplicialLDLT, SciPy\'s `scipy.sparse.linalg.cg`, CHOLMOD.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Sparse storage.** A matrix with $k$ non-zeros per row needs $O(kn)$ numbers instead of $n^2$, and a matrix–vector product costs $O(kn)$ instead of $O(n^2)$. For meshes $k \\approx 7$.',
      '**SPD and the bowl.** If $A$ is symmetric positive definite, $A x = b$ is equivalent to minimising $f(x) = \\tfrac12 x^{\\mathrm{T}}Ax - b^{\\mathrm{T}}x$, a strictly convex bowl whose gradient is $Ax - b$ (the negative residual).',
      '**Conjugate gradients.** CG builds search directions $p_0, p_1, \\ldots$ with $p_i^{\\mathrm{T}}Ap_j = 0$ for $i \\neq j$ and minimises $f$ exactly along each, so after $k$ steps $x_k$ is the best point in the span of the first $k$ directions. Its error shrinks by about $\\frac{\\sqrt{\\kappa} - 1}{\\sqrt{\\kappa} + 1}$ per iteration, $\\kappa$ the condition number (largest over smallest eigenvalue).',
      '**Conditioning.** For the grid Laplacian $\\kappa \\sim N^2$, so CG needs $O(\\sqrt\\kappa) = O(N)$ iterations and Jacobi $O(\\kappa) = O(N^2)$: cell 4\'s counts. A heat step with $t \\sim h^2$ has bounded $\\kappa$, so a near-constant count. Preconditioners (MeshLab divides by the diagonal) and multigrid reduce $\\kappa$ further.',
    ],
    equations: [
      { label: 'The bowl', latex: 'Ax = b \\iff x = \\arg\\min_x \\tfrac12 x^{\\mathrm{T}}Ax - b^{\\mathrm{T}}x' },
      { label: 'CG step', latex: '\\alpha_k = \\frac{r_k^{\\mathrm{T}}r_k}{p_k^{\\mathrm{T}}Ap_k}, \\quad x_{k+1} = x_k + \\alpha_k p_k' },
      { label: 'Convergence', latex: '\\|e_k\\|_A \\le 2\\left(\\frac{\\sqrt{\\kappa} - 1}{\\sqrt{\\kappa} + 1}\\right)^{k}\\|e_0\\|_A' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** For symmetric positive definite A, conjugate gradients minimises the A-norm of the error over the Krylov space span{b, Ab, …, A^{k−1}b} at step k, terminates in at most n steps in exact arithmetic, and converges at a rate governed by √κ(A).',
      '**Invariant viewpoint.** The iteration count depends on A\'s spectrum, not on n directly: a well-conditioned system of a million unknowns can converge faster than a badly conditioned one of a thousand.',
      '**Geometric picture.** Steepest descent zigzags down a long narrow valley; CG remembers where it has been and takes each new step at a "conjugate" angle, so it reaches the bottom of an n-dimensional bowl in far fewer, smarter steps.',
      '**Where this goes.** Lesson 7.6 solves two such systems for distances; 7.7 one per smoothing step; chapter 8\'s LSCM unwrap and chapter 10\'s automatic weights are larger systems of the same kind.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-7-005-ex1',
      title: 'Counting non-zeros',
      problem: 'A mesh has 5000 vertices with an average of 6 neighbours. How many non-zeros does its Laplacian have?',
      steps: [{ expression: '5000 \\times (6 + 1) = 35\\,000', annotation: 'One for the diagonal, one per neighbour.' }],
      conclusion: '35 000, against 25 000 000 dense: 0.14%.',
    },
    {
      id: 'modelling-geometry-7-005-ex2',
      title: 'Cost per iteration',
      problem: 'CG needs 60 iterations on that matrix. Roughly how many multiply-adds in all?',
      steps: [
        { expression: '35\\,000 \\text{ per product}', annotation: 'One sparse multiply per iteration.' },
        { expression: '60 \\times 35\\,000 \\approx 2 \\times 10^6', annotation: 'Plus a few vector operations each.' },
      ],
      conclusion: 'About two million, against roughly 4 × 10¹⁰ for Gaussian elimination on the dense matrix.',
    },
    {
      id: 'modelling-geometry-7-005-ex3',
      title: 'Why the heat step is easy',
      problem: 'A heat step is $(M + tL)u = \\delta$ with $t = h^2$. Why does its iteration count not grow with the mesh?',
      steps: [
        { expression: 'L \\text{ scales as } 1/h^2 \\text{ per unit area}', annotation: 'Its eigenvalues reach about 1/h².' },
        { expression: 'tL \\text{ is then of order } 1, \\text{ like } M', annotation: 'The ratio of extreme eigenvalues stays bounded.' },
      ],
      conclusion: 'The condition number stays bounded as h shrinks, so CG\'s count stays about the same: cell 4.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-7-005-ch1',
      difficulty: 'easy',
      problem: 'Why is the Laplacian of a mesh sparse?',
      walkthrough: [{ expression: '\\text{row } i \\text{ involves only } i \\text{ and its neighbours}', annotation: 'Everything else is zero.' }],
      answer: 'Each row compares a vertex only with its neighbours, so the only non-zeros are the diagonal and one per neighbour: about 7 per row whatever the mesh size.',
    },
    {
      id: 'modelling-geometry-7-005-ch2',
      difficulty: 'medium',
      problem: 'Show that uᵀ(M + tL)u > 0 for u ≠ 0 when all cotan weights are positive.',
      walkthrough: [
        { expression: 'u^{\\mathrm{T}}Lu = \\sum_{ij} w_{ij}(u_i - u_j)^2 \\ge 0', annotation: 'Lesson 7.2.' },
        { expression: 'u^{\\mathrm{T}}Mu = \\sum M_i u_i^2 > 0', annotation: 'Positive areas, u ≠ 0.' },
      ],
      answer: 'uᵀLu is a sum of non-negative terms w(uᵢ − uⱼ)², and uᵀMu = Σ Mᵢuᵢ² is strictly positive for u ≠ 0 since every area is positive; their sum (with t > 0) is strictly positive.',
    },
    {
      id: 'modelling-geometry-7-005-ch3',
      difficulty: 'hard',
      problem: 'Using the convergence bound, estimate how many CG iterations reduce the error by 10⁻⁸ when κ = 10 000, and compare with κ = 100.',
      walkthrough: [
        { expression: '\\frac{\\sqrt\\kappa - 1}{\\sqrt\\kappa + 1} = \\frac{99}{101} \\approx 0.980', annotation: 'κ = 10 000.' },
        { expression: 'k \\approx \\ln(10^{-8}) / \\ln(0.980) \\approx 920', annotation: 'For κ = 100: 9/11, k ≈ 92.' },
      ],
      answer: 'About 920 iterations for κ = 10 000 and about 92 for κ = 100 (from (√κ − 1)/(√κ + 1) per step): ten times the √κ, ten times the iterations. Jacobi would need roughly κ times a constant.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'A u = b', meaning: 'The linear system: one unknown per vertex.' },
      { symbol: '\\text{sparse}', meaning: 'Mostly zeros; only the non-zeros are stored.' },
      { symbol: '\\text{SPD}', meaning: 'Symmetric positive definite: Aᵀ = A and uᵀAu > 0 for u ≠ 0.' },
      { symbol: 'r = b - Ax', meaning: 'The residual: how far x is from solving the system.' },
      { symbol: '\\kappa', meaning: 'The condition number: how stretched the bowl is; sets the iteration count.' },
      { symbol: '\\text{CG}', meaning: 'Conjugate gradients: the iterative solver for SPD systems.' },
    ],
    rulesOfThumb: [
      'Store non-zeros only; multiply, never invert.',
      'Laplacian systems are SPD (with M or a pinned value): use CG.',
      'Heat steps are easy; Poisson problems take more iterations as meshes grow.',
      'Precondition when counts get large.',
      'Stop at the accuracy you need.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-7-002', label: 'The Laplacian', note: 'The matrix these systems are built from.' },
      { lessonId: 'modelling-geometry-7-004', label: 'Gaussian curvature', note: 'Other per-vertex quantities from the same mesh.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-7-006', label: 'Distance on a surface', note: 'Two sparse solves give geodesic distance.' },
      { lessonId: 'modelling-geometry-7-007', label: 'Smoothing as heat flow', note: 'One solve per implicit smoothing step.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-7-005-1', label: 'Read why geometry systems are sparse', type: 'read' },
    { id: 'cp-modelling-geometry-7-005-2', label: 'Read why they are symmetric positive definite', type: 'read' },
    { id: 'cp-modelling-geometry-7-005-3', label: 'Read how conjugate gradients works and what sets its speed', type: 'read' },
    { id: 'cp-modelling-geometry-7-005-4', label: 'Run cells 1 to 4: sparsity, SPD, CG vs Jacobi, scaling', type: 'lab' },
    { id: 'cp-modelling-geometry-7-005-5', label: 'Trace a heat solve in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-7-005-6', label: 'Work through example 2, cost per iteration', type: 'example' },
    { id: 'cp-modelling-geometry-7-005-7', label: 'Work through example 3, why the heat step is easy', type: 'example' },
    { id: 'cp-modelling-geometry-7-005-8', label: 'Complete the challenge: storage', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-7-005-assess-1',
        type: 'choice',
        text: 'A 50 × 50 grid Laplacian has about how many non-zeros?',
        options: ['12 500', '2500', '6 250 000', '250 000'],
        answer: '12 500',
        hint: '5 per row, 2500 rows.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-7-005-quiz-1',
      type: 'choice',
      text: 'What is the only operation CG needs from the matrix?',
      options: ['Multiplying it by a vector', 'Its inverse', 'Its determinant', 'Its eigenvalues'],
      answer: 'Multiplying it by a vector',
      hints: ['Procedure, Step 2.', 'Ap.'],
      reviewSection: 'Procedure',
    },
    {
      id: 'modelling-geometry-7-005-quiz-2',
      type: 'choice',
      text: 'Why is uᵀAu positive for the heat-step matrix?',
      options: ['It is a sum of squared differences plus a sum of squares weighted by area', 'Because A is sparse', 'Because A is diagonal', 'It is not'],
      answer: 'It is a sum of squared differences plus a sum of squares weighted by area',
      hints: ['Cell 2.', 'Challenge 2.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-7-005-quiz-3',
      type: 'choice',
      text: 'On the Poisson problem, as the grid doubles in width, CG\'s iteration count roughly:',
      options: ['Doubles', 'Stays the same', 'Quadruples', 'Halves'],
      answer: 'Doubles',
      hints: ['Cell 4: 33, 63, 121.', '√κ ∝ N.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-7-005-quiz-4',
      type: 'choice',
      text: 'And Jacobi\'s?',
      options: ['Roughly quadruples', 'Doubles', 'Stays the same', 'Halves'],
      answer: 'Roughly quadruples',
      hints: ['Cell 4: 414, 1463, 5360.', 'κ ∝ N².'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-7-005-quiz-5',
      type: 'choice',
      text: 'Why not compute A⁻¹ once and reuse it?',
      options: ['A⁻¹ is dense: n² numbers', 'It is less accurate', 'CG needs A', 'Inverses do not exist'],
      answer: 'A⁻¹ is dense: n² numbers',
      hints: ['Warning "Never invert a sparse matrix".', 'The challenge.'],
      reviewSection: 'Warning "Never invert a sparse matrix"',
    },
    {
      id: 'modelling-geometry-7-005-quiz-6',
      type: 'choice',
      text: 'What happens to a heat step\'s CG count as the mesh gets finer (t = h²)?',
      options: ['It stays about the same', 'It doubles each time', 'It drops to 1', 'CG stops working'],
      answer: 'It stays about the same',
      hints: ['Cell 4.', 'Example 3.'],
      reviewSection: 'Example 3',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'Solving a system means inverting the matrix.',
      whyStudentsThinkIt: 'x = A⁻¹b is how it is written.',
      correctionExample: 'Cell 3 solves with 26 sparse multiplies; the challenge shows the inverse would need 10¹⁰ numbers.',
      contrastCase: 'For tiny dense systems (3 × 3 transforms), inverting is fine.',
    },
    {
      falseBelief: 'Iterative solvers give rough answers.',
      whyStudentsThinkIt: 'They stop before "finishing".',
      correctionExample: 'Cell 3: CG and Jacobi agree to 10⁻⁸; the tolerance sets the accuracy.',
      contrastCase: 'Stopping early on purpose (a few iterations) does give a rough, smoothed answer, sometimes useful.',
    },
    {
      falseBelief: 'Bigger systems always take more iterations.',
      whyStudentsThinkIt: 'More unknowns, more work.',
      correctionExample: 'Cell 4: the heat step takes 22, 26, 27 iterations on grids of 100, 400 and 1600 unknowns.',
      contrastCase: 'The Poisson problem does take more, because its conditioning worsens with size.',
    },
  ],

  transferPrompts: [
    {
      situation: 'An image editor blends a pasted patch seamlessly (Poisson blending) on a 4000 × 3000 image.',
      competingTechniques: ['Dense Gaussian elimination', 'Sparse CG with a preconditioner, or multigrid'],
      whyThisTechniqueWins: 'The system has 12 million unknowns and 5 non-zeros per row; only sparse iterative or multigrid methods fit in memory and time.',
    },
    {
      situation: 'Your solver takes thousands of iterations on a large mesh.',
      competingTechniques: ['Lower the tolerance', 'Precondition, or reformulate as a short heat step where possible'],
      whyThisTechniqueWins: 'The count is set by conditioning; a preconditioner or a better-conditioned formulation cuts it, a looser tolerance only hides it.',
    },
  ],

  debugging: [
    {
      commonError: 'Using a pure Laplacian (no mass term) as the CG matrix.',
      symptom: 'CG stalls or drifts: the solution is defined only up to a constant.',
      whyItHappened: 'L is only semi-definite: constants are in its null space.',
      repairStrategy: 'Add a tiny multiple of M, or fix one vertex\'s value.',
    },
    {
      commonError: 'Storing the matrix densely.',
      symptom: 'Out of memory on modest meshes.',
      whyItHappened: 'n² numbers.',
      repairStrategy: 'Store rows of (column, value) pairs.',
    },
    {
      commonError: 'Updating x in place inside a Jacobi sweep.',
      symptom: 'Results differ from Jacobi\'s; with the wrong order it can even diverge.',
      whyItHappened: 'That is Gauss–Seidel, a different method, done inconsistently.',
      repairStrategy: 'Compute the whole residual from the old x, then update every entry.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Assemble a sparse SPD system, solve it with CG, and count its non-zeros and iterations.',
    explainVerbally: 'Explain sparsity, positive definiteness, how CG works, and what sets its iteration count.',
    detectIncorrectApplication: 'Recognise dense storage, singular Laplacians and in-place Jacobi updates.',
    transferToUnfamiliar: 'Choose solvers and formulations for large linear systems in graphics and simulation.',
  },
};
