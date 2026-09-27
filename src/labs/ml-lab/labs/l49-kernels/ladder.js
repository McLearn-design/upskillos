import { rng, r3, needVars } from '../../kit/ladder.js'

// Lab 49 practice ladder: feature counts, kernel values and costs by hand; a valid kernel; the RBF Gram matrix,
// kernel ridge's coefficients and centring in code.

export const rbfGramOf = (A, B, gamma) => A.map(a => B.map(b => Math.exp(-gamma * a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0))))
const solveOf = (A, b) => { const n = b.length, M = A.map((r, i) => [...r, b[i]]); for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]]; for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j] } } return M.map((r, i) => r[n] / r[i]) }
export const krrAlphaOf = (K, y, lam) => solveOf(K.map((r, i) => r.map((v, j) => v + (i === j ? lam : 0))), y)
export function centerOf(K) {
  const n = K.length, rm = K.map(r => r.reduce((a, b) => a + b, 0) / n), all = rm.reduce((a, b) => a + b, 0) / n
  return K.map((r, i) => r.map((v, j) => v - rm[i] - rm[j] + all))
}

const GRAM_CASES = [
  { A: [[0], [1], [2]], B: [[0], [1], [2]], gamma: 1 },
  { A: [[0, 0], [1, 1]], B: [[1, 0], [0, 2], [2, 2]], gamma: 0.5 },
  { A: [[1, 2, 3]], B: [[1, 2, 3], [0, 0, 0]], gamma: 0.1 },
].map(c => ({ ...c, expected: rbfGramOf(c.A, c.B, c.gamma) }))
const ALPHA_CASES = [
  { K: [[1, 0.5], [0.5, 1]], y: [1, 2], lam: 0.1 },
  { K: [[1, 0.2, 0], [0.2, 1, 0.2], [0, 0.2, 1]], y: [1, -1, 0.5], lam: 0.5 },
  { K: [[2, 1], [1, 2]], y: [0, 3], lam: 1 },
].map(c => ({ ...c, expected: krrAlphaOf(c.K, c.y, c.lam) }))
export const CENTER_CASES = [
  { K: [[1, 0.5], [0.5, 1]] },
  { K: [[3, 1, 2], [1, 2, 0], [2, 0, 4]] },
  { K: [[1, 1, 1], [1, 1, 1], [1, 1, 1]] },
].map(c => ({ ...c, expected: centerOf(c.K) }))

const near = (a, b) => Array.isArray(a) && a.flat().length === b.flat().length && a.flat().every((v, i) => Math.abs(v - b.flat()[i]) < 1e-9)
export function diagnoseGram(c, got) {
  if (near(got.value, c.A.map(a => c.B.map(b => Math.exp(-c.gamma * Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0))))))) return 'That is the Laplacian kernel (distance, not squared distance). The RBF uses ‖x − z‖².'
  if (near(got.value, c.A.map(a => c.B.map(b => Math.exp(c.gamma * a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0)))))) return 'The exponent is negative: exp(−γ‖x − z‖²), so similarity falls with distance.'
  return null
}
export function diagnoseAlpha(c, got) {
  const scalar = solveOf(c.K.map(r => r.map(v => v + c.lam)), c.y)
  if (near(got.value, scalar)) return 'Adding the scalar λ adds it to every entry. Ridge adds λ on the diagonal only: K + λI.'
  if (near(got.value, solveOf(c.K, c.y))) return 'Include the ridge term: (K + λI)⁻¹y.'
  return null
}
export function diagnoseCenter(c, got) {
  const n = c.K.length, rm = c.K.map(r => r.reduce((a, b) => a + b, 0) / n)
  if (near(got.value, c.K.map((r, i) => r.map((v, j) => v - rm[i] - rm[j])))) return 'Add back the overall mean: subtracting both row and column means removes it twice.'
  return null
}
export function evaluateKernel(vars) {
  const miss = needVars(vars, ['min_eigenvalue', 'test_error'])
  if (miss) return { passed: false, message: miss }
  const e = Number(vars.min_eigenvalue.value), t = Number(vars.test_error.value)
  if (e < -1e-8) return { passed: false, message: `The Gram matrix has an eigenvalue of ${r3(e)}: tanh(xz − 1) is not a kernel, so “kernel ridge” no longer minimizes a convex objective (test error ${r3(t)}). Set \`kernel = "rbf"\` and run again.` }
  return { passed: true, message: `Smallest eigenvalue ${r3(e)} (zero up to rounding) and test error ${r3(t)}: a valid kernel makes the problem convex, and the solution is the one kernel ridge promises.` }
}

// ---------- Fresh problems ----------
export const TEMPLATES = ['monomials', 'polykernel', 'gramsize']
const comb = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r) }
export function generate(template, seed) {
  const g = rng(seed * 313 + TEMPLATES.indexOf(template) * 4337 + 139)
  if (template === 'monomials') { const d = g.pick([2, 3, 4, 5]), p = g.pick([2, 3]); return { template, seed, d, p, answer: comb(d + p - 1, p), misconceptions: [{ answer: d ** p, feedback: 'Order does not matter: x₁x₂ and x₂x₁ are the same monomial.' }].filter(m => m.answer !== comb(d + p - 1, p)) } }
  if (template === 'polykernel') { const x = g.pick([0.5, 1, 2, -1]), z = g.pick([1, 2, 3, -2]), p = g.pick([2, 3]); return { template, seed, x, z, p, answer: (1 + x * z) ** p, misconceptions: [{ answer: 1 + (x * z) ** p, feedback: 'Raise (1 + xz) to the power, not just xz.' }].filter(m => Math.abs(m.answer - (1 + x * z) ** p) > 0.0006) } }
  const n = g.pick([1000, 5000, 20000]); return { template, seed, n, answer: n * n / 1e6, misconceptions: [{ answer: n / 1e6, feedback: 'The Gram matrix is n × n.' }] }
}
export function view(p) {
  if (p.template === 'monomials') return { intro: `Monomials of degree exactly ${p.p} in ${p.d} variables (like x₁², x₁x₂, …).`, questions: [{ id: 'm', type: 'number', label: 'How many are there?', answer: p.answer, misconceptions: p.misconceptions }] }
  if (p.template === 'polykernel') return { intro: `The polynomial kernel k(x, z) = (1 + xz)^${p.p} for scalars x = ${p.x}, z = ${p.z}.`, questions: [{ id: 'k', type: 'number', label: 'What is k(x, z)? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  return { intro: `Kernel ridge regression on n = ${p.n.toLocaleString('en')} examples.`, questions: [{ id: 'g', type: 'number', label: 'How many entries does its Gram matrix have, in millions?', answer: p.answer, tolerance: 0.001, misconceptions: p.misconceptions }] }
}
export function workedSolution(p) {
  if (p.template === 'monomials') return `C(${p.d} + ${p.p} − 1, ${p.p}) = **${p.answer}**.`
  if (p.template === 'polykernel') return `(1 + ${p.x} × ${p.z})^${p.p} = **${r3(p.answer)}**.`
  return `${p.n}² = ${(p.n * p.n).toLocaleString('en')} = **${p.answer}** million.`
}

export const kernels = {
  title: 'Kernels: features, validity, kernel ridge and centring',
  version: 1,
  templates: TEMPLATES,
  templateNames: { monomials: 'Counting features', polykernel: 'Polynomial kernel value', gramsize: 'Gram-matrix size' },
  generate, view, workedSolution,
  intro: 'Seven steps: kernel arithmetic by hand, a valid kernel against an impostor, and writing the RBF Gram matrix, kernel ridge’s coefficients and centring. Nothing here locks the rest of the lab.',
  steps: [
    {
      id: 'trace', kind: 'trace', title: 'Kernel arithmetic by hand',
      prompt: 'Monomials of degree exactly 2 in 3 variables. (1 + xz)² for x = 0.5, z = 2. Kernel ridge on 10,000 examples. Nyström with 500 landmarks on 100,000 points (n·m² operations).',
      fields: [
        { label: 'Number of monomials', answer: 6 },
        { label: '(1 + xz)²', answer: 4, tolerance: 1e-9 },
        { label: 'Coefficients αᵢ', answer: 10000 },
        { label: 'Nyström operations, in billions', answer: 25, tolerance: 1e-9 },
      ],
      explain: 'x₁², x₂², x₃², x₁x₂, x₁x₃, x₂x₃: 6. (1 + 1)² = 4. One α per example: 10,000. 100,000 × 500² = 2.5 × 10¹⁰ = 25 billion.',
    },
    {
      id: 'agree', kind: 'probe', title: 'A valid kernel',
      prompt: 'Kernel ridge with the old “sigmoid kernel” tanh(xz − 1). Run it and read the smallest eigenvalue of the Gram matrix. **Set `kernel = "rbf"`** and run again.',
      starter: `import numpy as np
rng = np.random.default_rng(49)
x = rng.uniform(-2, 2, 40); y = np.sin(3 * x) + 0.3 * x ** 2 + 0.2 * rng.normal(size=40)
xt = np.linspace(-2, 2, 200); yt = np.sin(3 * xt) + 0.3 * xt ** 2

kernel = "tanh"           # "tanh": tanh(xz - 1), a popular similarity; "rbf": exp(-3 (x - z)^2)
k = (lambda a, b: np.tanh(np.outer(a, b) - 1)) if kernel == "tanh" else (lambda a, b: np.exp(-3 * (a[:, None] - b[None, :]) ** 2))
K = k(x, x)
min_eigenvalue = float(np.linalg.eigvalsh(K).min())
alpha = np.linalg.solve(K + 0.1 * np.eye(40), y)
test_error = float(np.mean((k(xt, x) @ alpha - yt) ** 2))
print(f"kernel = {kernel!r}: smallest Gram eigenvalue {min_eigenvalue:+.3f}; test error {test_error:.3f}")`,
      probe: ['min_eigenvalue', 'test_error'],
      evaluate: evaluateKernel,
      done: 'Check the smallest eigenvalue of a new similarity on real data before trusting it as a kernel.',
    },
    {
      id: 'fill', kind: 'function', title: 'Fill in the RBF Gram matrix',
      prompt: 'Replace `___` with the matrix of exp(−γ‖aᵢ − bⱼ‖²) for rows aᵢ of A and bⱼ of B.',
      starter: `import numpy as np

def rbf_gram(A, B, gamma):
    """RBF kernel between every row of A and every row of B."""
    return ___`,
      hint: 'Squared distances: ((A[:, None, :] − B[None, :, :]) ** 2).sum(-1).',
      solution: 'return np.exp(-gamma * ((A[:, None, :] - B[None, :, :]) ** 2).sum(-1))',
      check: { fn: 'rbf_gram', args: ['A', 'B', 'gamma'], cases: GRAM_CASES, describe: c => `${c.A.length} × ${c.B.length} points, γ = ${c.gamma}`, diagnose: diagnoseGram },
    },
    {
      id: 'repair', kind: 'function', title: 'Repair a planted bug',
      prompt: 'For K = [[1, 0.5], [0.5, 1]], y = (1, 2) and λ = 0.1 this returns **α = (−0.118, 1.882)**; kernel ridge gives (0.104, 1.771). Fix it.',
      starter: `import numpy as np

def krr_alpha(K, y, lam):
    """Kernel ridge coefficients."""
    return np.linalg.solve(K + lam, y)`,
      hint: 'Where exactly does λ go?',
      solution: 'return np.linalg.solve(K + lam * np.eye(len(y)), y)',
      check: { fn: 'krr_alpha', args: ['K', 'y', 'lam'], cases: ALPHA_CASES, describe: c => `${c.y.length} examples, λ = ${c.lam}`, diagnose: diagnoseAlpha },
      explainChoice: {
        prompt: 'Why does λ belong on the diagonal?',
        options: [
          { text: 'It comes from the penalty λ‖w‖² = λ αᵀKα; with w = Φᵀα the solution is α = (K + λI)⁻¹y. The identity adds the same amount of noise variance to each observation, as in a GP.', correct: true },
          { text: 'Because K is diagonal.', feedback: 'K is a full matrix of similarities.' },
          { text: 'To make every entry larger.', feedback: 'Adding to every entry changes the similarities themselves, not the regularization.' },
          { text: 'Because λ must be an integer.', feedback: 'λ is any positive number.' },
        ],
        rightFeedback: 'And the diagonal term also keeps K + λI invertible.',
      },
    },
    {
      id: 'implement', kind: 'function', title: 'Centre a Gram matrix',
      prompt: 'Write `center_gram` from its contract.',
      starter: `import numpy as np

def center_gram(K):
    """The Gram matrix of the features after centring them in feature space:
    subtract each row's mean and each column's mean, and add back the overall mean.

    Example: center_gram([[1, 0.5], [0.5, 1]])  ->  [[0.25, -0.25], [-0.25, 0.25]]
    """
    pass   # replace with your code`,
      hint: 'K − row means − column means + overall mean (with broadcasting), or H K H with H = I − 1/n.',
      solution: 'r = K.mean(axis=1, keepdims=True)\nreturn K - r - r.T + K.mean()',
      check: { fn: 'center_gram', args: ['K'], cases: CENTER_CASES, describe: c => `${c.K.length} × ${c.K.length}`, diagnose: diagnoseCenter },
    },
    { id: 'transfer', kind: 'transfer', title: 'Solve new problems', prompt: 'New feature maps, kernels and dataset sizes. Solve one of each kind without opening the worked answer.' },
    { id: 'review', kind: 'review', title: 'Come back later', prompt: 'A fresh problem after a gap. The first return is suggested a day after you finish step 6; “Do it now” is always there and is recorded as early.' },
  ],
}
