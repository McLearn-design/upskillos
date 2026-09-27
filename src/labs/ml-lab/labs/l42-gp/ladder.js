import { rng, r3, needVars } from '../../kit/ladder.js'

// Lab 42 practice ladder: kernel values, conditioning and costs by hand; choosing the length scale honestly; the RBF
// Gram matrix, the posterior variance and the posterior mean in code.

const rbfOf = (a, b, ell, sf) => a.map(x => b.map(z => sf * sf * Math.exp(-((x - z) ** 2) / (2 * ell * ell))))
const solveOf = (A, b) => { const n = b.length, M = A.map((r, i) => [...r, b[i]]); for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]]; for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j] } } return M.map((r, i) => r[n] / r[i]) }
export const gramOf = rbfOf
export function postVarOf(X, xs, ell, sn) {
  const Ky = rbfOf(X, X, ell, 1).map((r, i) => r.map((v, j) => v + (i === j ? sn * sn : 0)))
  return xs.map(x => { const ks = X.map(z => Math.exp(-((x - z) ** 2) / (2 * ell * ell))), a = solveOf(Ky, ks); return 1 - ks.reduce((s, k, i) => s + k * a[i], 0) })
}
export function postMeanOf(X, y, xs, ell, sn) {
  const Ky = rbfOf(X, X, ell, 1).map((r, i) => r.map((v, j) => v + (i === j ? sn * sn : 0))), a = solveOf(Ky, y)
  return xs.map(x => X.reduce((s, z, i) => s + Math.exp(-((x - z) ** 2) / (2 * ell * ell)) * a[i], 0))
}

const GRAM_CASES = [
  { a: [0, 0.5, 1], b: [0, 0.5, 1], ell: 0.5, sf: 1 },
  { a: [0, 1], b: [0.2, 0.4, 3], ell: 1, sf: 2 },
  { a: [-1, 1], b: [0], ell: 0.3, sf: 0.5 },
].map(c => ({ ...c, expected: rbfOf(c.a, c.b, c.ell, c.sf) }))
const VAR_CASES = [
  { X: [0], xs: [0, 0.2, 1], ell: 0.2, sn: 1 },
  { X: [0, 0.5, 1], xs: [0.25, 0.5, 2], ell: 0.3, sn: 0.1 },
  { X: [0.1, 0.2], xs: [0.15, 0.9], ell: 0.5, sn: 0.05 },
].map(c => ({ ...c, expected: postVarOf(c.X, c.xs, c.ell, c.sn) }))
export const MEAN_CASES = [
  { X: [0], y: [2], xs: [0, 0.2], ell: 0.2, sn: 1 },
  { X: [0, 0.5, 1], y: [0, 1, 0], xs: [0.25, 0.5, 0.75], ell: 0.3, sn: 0.1 },
  { X: [0.1, 0.4, 0.8], y: [1, -1, 0.5], xs: [0, 0.6, 1.5], ell: 0.2, sn: 0.2 },
].map(c => ({ ...c, expected: postMeanOf(c.X, c.y, c.xs, c.ell, c.sn) }))

const near = (a, b) => Array.isArray(a) && a.flat().length === b.flat().length && a.flat().every((v, i) => Math.abs(v - b.flat()[i]) < 1e-9)
export function diagnoseGram(c, got) {
  if (near(got.value, c.a.map(x => c.b.map(z => c.sf * c.sf * Math.exp(-((x - z) ** 2) / (c.ell * c.ell)))))) return 'The exponent is −(x − x′)²/(2ℓ²): the factor 2 is missing.'
  if (near(got.value, rbfOf(c.a, c.b, c.ell, 1)) && c.sf !== 1) return 'Multiply by the signal variance σf².'
  return null
}
export function diagnoseVar(c, got) {
  const wrong = c.xs.map(x => { const ks = c.X.map(z => Math.exp(-((x - z) ** 2) / (2 * c.ell * c.ell))); return 1 - ks.reduce((s, k) => s + k * k, 0) })
  if (near(got.value, wrong)) return 'k*ᵀk* ignores how the observations relate to each other and their noise. Subtract k*ᵀ(K + σn²I)⁻¹k*.'
  return null
}
export function diagnoseMean(c, got) {
  const noNoise = postMeanOf(c.X, c.y, c.xs, c.ell, 1e-6)
  if (near(got.value, noNoise) && c.sn > 0.01) return 'Add the noise variance to the diagonal: (K + σn²I)⁻¹y.'
  return null
}
export function evaluateSelect(vars) {
  const miss = needVars(vars, ['chosen_ell', 'gap_error'])
  if (miss) return { passed: false, message: miss }
  const e = Number(vars.chosen_ell.value), g = Number(vars.gap_error.value)
  if (e < 0.05) return { passed: false, message: `Training error picks ℓ = ${e}: the tiniest length scale fits every observation and falls back to 0 between them (error in the gap ${r3(g)}). Set \`select_by = "lml"\` and run again.` }
  return { passed: true, message: `The marginal likelihood picks ℓ = ${e}, and the error in the gap falls to ${r3(g)}: its complexity term rejects length scales too short for the data.` }
}

// ---------- Fresh problems ----------
export const TEMPLATES = ['kernel', 'conditioning', 'scaling']
export function generate(template, seed) {
  const g = rng(seed * 271 + TEMPLATES.indexOf(template) * 4241 + 103)
  if (template === 'kernel') { const sf = g.pick([0.5, 1, 2]), ell = g.pick([0.2, 0.5, 1]), d = ell * g.pick([0, 1, 2, 3]); return { template, seed, sf, ell, d, answer: sf * sf * Math.exp(-(d * d) / (2 * ell * ell)), misconceptions: [{ answer: sf * Math.exp(-(d * d) / (2 * ell * ell)), feedback: 'The kernel scales by σf², not σf.' }].filter(m => Math.abs(m.answer - sf * sf * Math.exp(-(d * d) / (2 * ell * ell))) > 0.0006) } }
  if (template === 'conditioning') { const y = g.pick([1, 2, -1, 3]), sn2 = g.pick([0.25, 0.5, 1]), k = g.pick([0.3, 0.5, 0.8]); return { template, seed, y, sn2, k, answer: k * y / (1 + sn2), misconceptions: [{ answer: k * y, feedback: 'Divide by the observation’s variance, k(x, x) + σn² = 1 + σn².' }] } }
  const n0 = g.pick([500, 1000, 2000]), t0 = g.pick([0.5, 1, 2]), f = g.pick([2, 3, 10]); return { template, seed, n0, t0, f, answer: t0 * f ** 3, misconceptions: [{ answer: t0 * f * f, feedback: 'The cost grows as n³, not n².' }] }
}
export function view(p) {
  if (p.template === 'kernel') return { intro: `RBF kernel with σf = ${p.sf} and ℓ = ${p.ell}.`, questions: [{ id: 'k', type: 'number', label: `What is k(x, x′) for inputs ${p.d} apart? (Three decimals.)`, answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  if (p.template === 'conditioning') return { intro: `One observation y = ${p.y} with noise variance σn² = ${p.sn2}; the prior variance is 1 and the kernel value between it and x* is ${p.k}.`, questions: [{ id: 'm', type: 'number', label: 'What is the posterior mean at x*? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  return { intro: `An exact GP takes ${p.t0} s for n = ${p.n0.toLocaleString('en')} points.`, questions: [{ id: 't', type: 'number', label: `Roughly how many seconds for n = ${(p.n0 * p.f).toLocaleString('en')}?`, answer: p.answer, misconceptions: p.misconceptions }] }
}
export function workedSolution(p) {
  if (p.template === 'kernel') return `${p.sf}² × exp(−${p.d}²/(2 × ${p.ell}²)) = **${r3(p.answer)}**.`
  if (p.template === 'conditioning') return `${p.k} × ${p.y} / (1 + ${p.sn2}) = **${r3(p.answer)}**.`
  return `${p.t0} × ${p.f}³ = **${p.answer}**.`
}

export const gp = {
  title: 'Gaussian processes: kernels, conditioning and the marginal likelihood',
  version: 1,
  templates: TEMPLATES,
  templateNames: { kernel: 'RBF kernel value', conditioning: 'One-point posterior', scaling: 'Cubic cost' },
  generate, view, workedSolution,
  intro: 'Seven steps: GP arithmetic by hand, choosing the length scale honestly, and writing the RBF Gram matrix, the posterior variance and the posterior mean. Nothing here locks the rest of the lab.',
  steps: [
    {
      id: 'trace', kind: 'trace', title: 'GP arithmetic by hand',
      prompt: 'A linear model f(x) = wx with w ~ N(0, 1/4). An RBF kernel with σf = 2. One observation y = 2 with σn² = 1 and kernel value 0.5 to x*. Log marginal likelihoods −1.6 and −3.3. An exact GP taking 1 s at n = 1,000.',
      fields: [
        { label: 'Cov[f(2), f(3)]', answer: 1.5, tolerance: 1e-9 },
        { label: 'k(0, 0) for the RBF kernel', answer: 4, tolerance: 1e-9 },
        { label: 'Posterior mean at x*', answer: 0.5, tolerance: 1e-9 },
        { label: 'Bayes factor for the first kernel (one decimal)', answer: Math.exp(1.7), tolerance: 0.051 },
      ],
      explain: '2 × 3/4 = 1.5. σf² = 4. 0.5 × 2/(1 + 1) = 0.5. e^(−1.6 + 3.3) = e^1.7 = 5.5. (And 10× the points costs 10³× the time: about 1,000 s.)',
    },
    {
      id: 'agree', kind: 'probe', title: 'Choose ℓ by the marginal likelihood',
      prompt: 'Fourteen observations with a gap between 0.45 and 0.7. The code picks the length scale with the smallest training error. **Set `select_by = "lml"`** and run again.',
      starter: `import numpy as np
rng = np.random.default_rng(42)
f = lambda x: np.sin(2 * np.pi * x) + 0.4 * np.cos(6 * np.pi * x) * x
X = np.sort(np.concatenate([rng.uniform(0, 0.45, 8), rng.uniform(0.7, 1, 6)])); y = f(X) + 0.1 * rng.normal(size=14)
K = lambda a, b, ell: np.exp(-(a[:, None] - b[None, :]) ** 2 / (2 * ell ** 2))

def fit(ell, sn=0.1):
    Ky = K(X, X, ell) + sn ** 2 * np.eye(14); L = np.linalg.cholesky(Ky)
    a = np.linalg.solve(L.T, np.linalg.solve(L, y))
    lml = -0.5 * y @ a - np.sum(np.log(np.diag(L))) - 7 * np.log(2 * np.pi)
    train_error = np.mean((K(X, X, ell) @ a - y) ** 2)
    return lml, train_error, a

ells = [0.02, 0.05, 0.1, 0.2, 0.5]
select_by = "train"       # "train": the smallest training error; "lml": the highest log marginal likelihood
key = (lambda e: -fit(e)[1]) if select_by == "train" else (lambda e: fit(e)[0])
chosen_ell = max(ells, key=key)
xg = np.linspace(0.45, 0.7, 50)                            # the gap, where there are no observations
gap_error = float(np.sqrt(np.mean((K(xg, X, chosen_ell) @ fit(chosen_ell)[2] - f(xg)) ** 2)))
print(f"select_by = {select_by!r}: length scale {chosen_ell}, error in the gap {gap_error:.3f}")`,
      probe: ['chosen_ell', 'gap_error'],
      evaluate: evaluateSelect,
      done: 'Training error always prefers the most flexible kernel; the marginal likelihood (or cross-validation) does not.',
    },
    {
      id: 'fill', kind: 'function', title: 'Fill in the RBF Gram matrix',
      prompt: 'Replace `___` with the matrix of k(aᵢ, bⱼ) for the RBF kernel.',
      starter: `import numpy as np

def rbf(a, b, ell, sf):
    """RBF kernel between every point of a and every point of b (1-D inputs)."""
    return ___`,
      hint: 'a[:, None] − b[None, :] gives all pairwise differences.',
      solution: 'return sf ** 2 * np.exp(-(a[:, None] - b[None, :]) ** 2 / (2 * ell ** 2))',
      check: { fn: 'rbf', args: ['a', 'b', 'ell', 'sf'], cases: GRAM_CASES, describe: c => `a (${c.a.join(', ')}), b (${c.b.join(', ')}), ℓ = ${c.ell}, σf = ${c.sf}`, diagnose: diagnoseGram },
    },
    {
      id: 'repair', kind: 'function', title: 'Repair a planted bug',
      prompt: 'For one observation at 0 with σn = 1 and ℓ = 0.2, this returns variance **0** at x* = 0; one noisy observation cannot pin f down. The answer is 1 − 1/2 = 0.5. Fix it.',
      starter: `import numpy as np

def post_var(X, xs, ell, sn):
    """Posterior variance of f at each point of xs (RBF kernel, prior variance 1, noise sd sn)."""
    Ky = np.exp(-(X[:, None] - X[None, :]) ** 2 / (2 * ell ** 2)) + sn ** 2 * np.eye(len(X))
    Ks = np.exp(-(xs[:, None] - X[None, :]) ** 2 / (2 * ell ** 2))
    return 1 - np.sum(Ks * Ks, axis=1)`,
      hint: 'The subtracted term is k*ᵀ(K + σn²I)⁻¹k*, one per test point.',
      solution: 'return 1 - np.sum(Ks * np.linalg.solve(Ky, Ks.T).T, axis=1)',
      check: { fn: 'post_var', args: ['X', 'xs', 'ell', 'sn'], cases: VAR_CASES, describe: c => `observations at (${c.X.join(', ')}), test (${c.xs.join(', ')})`, diagnose: diagnoseVar },
      explainChoice: {
        prompt: 'Why must the observations’ own covariance (K + σn²I) appear in the variance?',
        options: [
          { text: 'Observations that are noisy, or that repeat each other’s information, explain less than their raw correlations suggest; the inverse accounts for both.', correct: true },
          { text: 'It is only needed for the mean.', feedback: 'The same matrix appears in both; conditioning a Gaussian uses it throughout.' },
          { text: 'To make the variance larger than the prior.', feedback: 'The posterior variance is never larger than the prior variance.' },
          { text: 'Because the kernel is not symmetric.', feedback: 'Kernels are symmetric; the issue is redundancy and noise.' },
        ],
        rightFeedback: 'Two observations at the same place reduce the variance less than two far apart would — the inverse knows that.',
      },
    },
    {
      id: 'implement', kind: 'function', title: 'The posterior mean',
      prompt: 'Write `post_mean` from its contract.',
      starter: `import numpy as np

def post_mean(X, y, xs, ell, sn):
    """GP posterior mean at xs: k*^T (K + sn^2 I)^-1 y, with the RBF kernel (sf = 1) and length scale ell.

    Example: post_mean([0], [2], [0, 0.2], 0.2, 1)  ->  [1.0, 0.6065...]
    """
    pass   # replace with your code`,
      hint: 'Build Ky and Ks as in the repair step; solve Ky a = y; return Ks @ a.',
      solution: 'Ky = np.exp(-(X[:, None] - X[None, :]) ** 2 / (2 * ell ** 2)) + sn ** 2 * np.eye(len(X))\nKs = np.exp(-(xs[:, None] - X[None, :]) ** 2 / (2 * ell ** 2))\nreturn Ks @ np.linalg.solve(Ky, y)',
      check: { fn: 'post_mean', args: ['X', 'y', 'xs', 'ell', 'sn'], cases: MEAN_CASES, describe: c => `${c.X.length} observations, test (${c.xs.join(', ')})`, diagnose: diagnoseMean },
    },
    { id: 'transfer', kind: 'transfer', title: 'Solve new problems', prompt: 'New kernels, observations and sizes. Solve one of each kind without opening the worked answer.' },
    { id: 'review', kind: 'review', title: 'Come back later', prompt: 'A fresh problem after a gap. The first return is suggested a day after you finish step 6; “Do it now” is always there and is recorded as early.' },
  ],
}
