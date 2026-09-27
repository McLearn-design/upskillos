import { rng, r3, needVars } from '../../kit/ladder.js'

// Lab 43 practice ladder: responsibilities, weighted means, the ELBO gap and parameter counts by hand; restarts; the
// M-step mean, the E-step normalization and BIC in code.

export const mstepMeanOf = (X, R) => R[0].map((_, k) => { const Nk = R.reduce((s, r) => s + r[k], 0); return X[0].map((_, j) => X.reduce((s, x, i) => s + R[i][k] * x[j], 0) / Nk) })
export const respOf = W => W.map(row => { const s = row.reduce((a, b) => a + b, 0); return row.map(v => v / s) })
export const bicOf = (ll, K, d, n) => -2 * ll + ((K - 1) + K * d + K * d * (d + 1) / 2) * Math.log(n)

const MEAN_CASES = [
  { X: [[2], [4], [8]], R: [[0.5, 0.5], [1, 0], [0.5, 0.5]] },
  { X: [[0, 0], [2, 0], [0, 2], [2, 2]], R: [[1, 0], [0.5, 0.5], [0.5, 0.5], [0, 1]] },
  { X: [[1, 3], [5, -1], [2, 2]], R: [[0.9, 0.1], [0.2, 0.8], [0.6, 0.4]] },
].map(c => ({ ...c, expected: mstepMeanOf(c.X, c.R) }))
const RESP_CASES = [
  { W: [[0.06, 0.035]] },
  { W: [[0.1, 0.1, 0.2], [0.3, 0.01, 0.09]] },
  { W: [[1e-3, 3e-3], [5, 5], [0.2, 0.6]] },
].map(c => ({ ...c, expected: respOf(c.W) }))
export const BIC_CASES = [[-877.7, 3, 2, 300], [-892.6, 2, 2, 300], [-100, 1, 3, 50], [-1500, 4, 2, 1000]].map(([ll, K, d, n]) => ({ ll, K, d, n, expected: bicOf(ll, K, d, n) }))

const near = (a, b) => Array.isArray(a) && a.flat().length === b.flat().length && a.flat().every((v, i) => Math.abs(v - b.flat()[i]) < 1e-9)
export function diagnoseMean(c, got) {
  const unw = c.R[0].map(() => c.X[0].map((_, j) => c.X.reduce((s, x) => s + x[j], 0) / c.X.length))
  if (near(got.value, unw)) return 'Weight each point by its responsibility for the component: Σᵢ rᵢₖxᵢ / Nₖ.'
  const byN = c.R[0].map((_, k) => c.X[0].map((_, j) => c.X.reduce((s, x, i) => s + c.R[i][k] * x[j], 0) / c.X.length))
  if (near(got.value, byN)) return 'Divide by Nₖ = Σᵢ rᵢₖ, the component’s effective count, not by n.'
  return null
}
export function diagnoseResp(c, got) {
  const colN = c.W.map(row => row.map((v, k) => v / c.W.reduce((s, r) => s + r[k], 0)))
  if (near(got.value, colN) && !near(colN, c.expected)) return 'Normalize each point’s row (over components), not each component’s column (over points).'
  return null
}
export function diagnoseBic(c, got) {
  const pFull = (c.K - 1) + c.K * c.d + c.K * c.d * c.d
  if (Math.abs(got.value - (-2 * c.ll + pFull * Math.log(c.n))) < 1e-6) return 'A covariance matrix has d(d + 1)/2 free entries (it is symmetric), not d².'
  if (Math.abs(got.value - (-2 * c.ll + ((c.K - 1) + c.K * c.d + c.K * c.d * (c.d + 1) / 2))) < 1e-6) return 'Multiply the parameter count by log n.'
  return null
}
export function evaluateRestarts(vars) {
  const miss = needVars(vars, ['best_ll', 'agreement', 'n_starts'])
  if (miss) return { passed: false, message: miss }
  const a = Number(vars.agreement.value), ll = Number(vars.best_ll.value)
  if (a < 0.95) return { passed: false, message: `One start converged to log-likelihood ${r3(ll)} with ${r3(100 * a)}% agreement after 60 iterations: it sits on a plateau that splits the long clusters the wrong way, changing so slowly it looks converged. Set \`n_starts = 5\` and keep the best.` }
  return { passed: true, message: `Best of ${Number(vars.n_starts.value)} starts: log-likelihood ${r3(ll)}, ${r3(100 * a)}% agreement. EM never decreases the likelihood — but how fast it gets anywhere depends on where it starts.` }
}

// ---------- Fresh problems ----------
export const TEMPLATES = ['resp', 'wmean', 'params']
export function generate(template, seed) {
  const g = rng(seed * 277 + TEMPLATES.indexOf(template) * 4253 + 107)
  if (template === 'resp') { const w1 = g.pick([0.2, 0.3, 0.5, 0.6]), d1 = g.pick([0.1, 0.2, 0.4]), d2 = g.pick([0.05, 0.1, 0.3]), a = w1 * d1, b = (1 - w1) * d2; return { template, seed, w1, d1, d2, answer: a / (a + b), misconceptions: [{ answer: d1 / (d1 + d2), feedback: 'Weight each density by its component’s mixing weight πₖ.' }].filter(m => Math.abs(m.answer - a / (a + b)) > 0.0006) } }
  if (template === 'wmean') { const xs = [g.pick([0, 1, 2]), g.pick([4, 5]), g.pick([8, 10])], rs = [g.pick([1, 0.5]), g.pick([1, 0.5, 0.2]), g.pick([0.5, 0.2, 1])], N = rs.reduce((a, b) => a + b, 0), answer = xs.reduce((s, x, i) => s + rs[i] * x, 0) / N; return { template, seed, xs, rs, answer, misconceptions: [{ answer: xs.reduce((s, x, i) => s + rs[i] * x, 0) / 3, feedback: 'Divide by the sum of the responsibilities, Nₖ, not by the number of points.' }].filter(m => Math.abs(m.answer - answer) > 0.0006) } }
  const d = g.pick([1, 2, 3, 4]), K = g.pick([2, 3, 4]); return { template, seed, d, K, answer: (K - 1) + K * d + K * d * (d + 1) / 2, misconceptions: [{ answer: (K - 1) + K * d + K * d * d, feedback: 'Covariance matrices are symmetric: d(d + 1)/2 free entries each.' }].filter(m => m.answer !== (K - 1) + K * d + K * d * (d + 1) / 2) }
}
export function view(p) {
  if (p.template === 'resp') return { intro: `Two components with weights ${p.w1} and ${r3(1 - p.w1)}. At a point, their densities are ${p.d1} and ${p.d2}.`, questions: [{ id: 'r', type: 'number', label: 'What is the responsibility of component 1? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  if (p.template === 'wmean') return { intro: `A component has responsibilities ${p.rs.join(', ')} for points ${p.xs.join(', ')}.`, questions: [{ id: 'm', type: 'number', label: 'What is its updated mean? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  return { intro: `A full-covariance Gaussian mixture in d = ${p.d} dimensions with K = ${p.K} components.`, questions: [{ id: 'p', type: 'number', label: 'How many free parameters?', answer: p.answer, misconceptions: p.misconceptions }] }
}
export function workedSolution(p) {
  if (p.template === 'resp') return `${p.w1} × ${p.d1} / (${p.w1} × ${p.d1} + ${r3(1 - p.w1)} × ${p.d2}) = **${r3(p.answer)}**.`
  if (p.template === 'wmean') return `(${p.xs.map((x, i) => `${p.rs[i]} × ${x}`).join(' + ')}) / ${r3(p.rs.reduce((a, b) => a + b, 0))} = **${r3(p.answer)}**.`
  return `(${p.K} − 1) + ${p.K} × ${p.d} + ${p.K} × ${p.d}·${p.d + 1}/2 = **${p.answer}**.`
}

export const em = {
  title: 'Mixtures and EM: responsibilities, updates and model choice',
  version: 1,
  templates: TEMPLATES,
  templateNames: { resp: 'Responsibility', wmean: 'Weighted mean', params: 'Parameter count' },
  generate, view, workedSolution,
  intro: 'Seven steps: mixture arithmetic by hand, restarts against local optima, and writing the M-step mean, the E-step normalization and BIC. Nothing here locks the rest of the lab.',
  steps: [
    {
      id: 'trace', kind: 'trace', title: 'Mixture arithmetic by hand',
      prompt: 'Weights 0.3 and 0.7 with densities 0.2 and 0.05 at a point. Responsibilities 0.5, 1, 0.5 for points 2, 4, 8. log p(x) = −100 with KL(q ‖ posterior) = 3. A full-covariance mixture with d = 3, K = 2.',
      fields: [
        { label: 'Responsibility of component 1 (three decimals)', answer: 0.06 / 0.095, tolerance: 0.0006 },
        { label: 'Updated mean', answer: 4.5, tolerance: 1e-9 },
        { label: 'ELBO', answer: -103, tolerance: 1e-9 },
        { label: 'Number of parameters', answer: 19 },
      ],
      explain: '0.06/(0.06 + 0.035) = 0.632. (1 + 4 + 4)/2 = 4.5. −100 − 3 = −103. 1 + 6 + 12 = 19.',
    },
    {
      id: 'agree', kind: 'probe', title: 'Restart against plateaus',
      prompt: 'EM on two long, parallel clusters from one random start. Run it: after 60 iterations the likelihood has stopped moving, and the clusters are wrong. **Set `n_starts = 5`** and run again.',
      starter: `import numpy as np
rng = np.random.default_rng(43)
z = rng.integers(0, 2, 300)                                  # two long, parallel clusters
X = np.column_stack([2 * rng.normal(size=300), np.where(z == 1, 0.9, -0.9) + 0.28 * rng.normal(size=300)])

def logpdf(X, m, S):
    d = X - m; P = np.linalg.inv(S)
    return -0.5 * np.einsum("ij,jk,ik->i", d, P, d) - 0.5 * np.log(np.linalg.det(S)) - np.log(2 * np.pi)

def em(seed, iters=60):
    r = np.random.default_rng(seed); mus = X[r.choice(300, 2, replace=False)]
    pis, Ss = np.array([0.5, 0.5]), [np.eye(2) * 2, np.eye(2) * 2]
    for _ in range(iters):
        L = np.column_stack([np.log(pis[k]) + logpdf(X, mus[k], Ss[k]) for k in range(2)])
        top = L.max(axis=1, keepdims=True); ll = float(np.sum(top[:, 0] + np.log(np.exp(L - top).sum(axis=1))))
        R = np.exp(L - top); R /= R.sum(axis=1, keepdims=True)
        Nk = R.sum(axis=0); pis = Nk / 300; mus = (R.T @ X) / Nk[:, None]
        Ss = [((R[:, k, None] * (X - mus[k])).T @ (X - mus[k])) / Nk[k] + 1e-3 * np.eye(2) for k in range(2)]
    return ll, R.argmax(axis=1)

n_starts = 1              # how many random starts; keep the one with the highest log-likelihood
results = [em(seed) for seed in range(1, n_starts + 1)]
best_ll, labels = max(results, key=lambda t: t[0])
agreement = float(max(np.mean(labels == z), np.mean(labels != z)))
print(f"n_starts = {n_starts}: best log-likelihood {best_ll:.1f}, agreement with the true clusters {agreement:.3f}")`,
      probe: ['best_ll', 'agreement', 'n_starts'],
      evaluate: evaluateRestarts,
      done: 'Initializing from k-means (scikit-learn’s default) is fast but inherits k-means’ mistakes on such data; random restarts avoid that (43.4’s cell).',
    },
    {
      id: 'fill', kind: 'function', title: 'Fill in the M-step means',
      prompt: 'Replace `___` with the updated means, one row per component, given data X (n × d) and responsibilities R (n × K).',
      starter: `import numpy as np

def mstep_means(X, R):
    """Responsibility-weighted mean of the data for each component."""
    return ___`,
      hint: 'Rᵀ X sums rᵢₖ xᵢ for every k; divide each row by Nₖ = Σᵢ rᵢₖ.',
      solution: 'return (R.T @ X) / R.sum(axis=0)[:, None]',
      check: { fn: 'mstep_means', args: ['X', 'R'], cases: MEAN_CASES, describe: c => `${c.X.length} points, ${c.R[0].length} components`, diagnose: diagnoseMean },
    },
    {
      id: 'repair', kind: 'function', title: 'Repair a planted bug',
      prompt: 'Given the weighted densities πₖN(xᵢ | μₖ, Σₖ) for one point, [0.06, 0.035], this returns **[0.632, 1]**; responsibilities of a point must sum to 1. Fix it.',
      starter: `import numpy as np

def responsibilities(W):
    """W[i, k] = pi_k * N(x_i | mu_k, Sigma_k). Return r[i, k] = p(z_i = k | x_i)."""
    return W / W.sum(axis=0, keepdims=True)`,
      hint: 'Each point’s responsibilities are a distribution over components.',
      solution: 'return W / W.sum(axis=1, keepdims=True)',
      check: { fn: 'responsibilities', args: ['W'], cases: RESP_CASES, describe: c => `${c.W.length} point(s), ${c.W[0].length} components`, diagnose: diagnoseResp },
      explainChoice: {
        prompt: 'Why do real implementations compute responsibilities from log densities with log-sum-exp?',
        options: [
          { text: 'Densities of far-away points underflow to 0 in floating point; working in logs and subtracting the largest before exponentiating keeps every ratio exact.', correct: true },
          { text: 'Because logs make the responsibilities sum to 1.', feedback: 'Normalization does that; logs keep the numbers representable.' },
          { text: 'Because densities can be negative.', feedback: 'Densities are never negative.' },
          { text: 'To make EM converge faster.', feedback: 'It changes the numerics, not the algorithm.' },
        ],
        rightFeedback: 'The same trick as the stable softmax (Lab 39).',
      },
    },
    {
      id: 'implement', kind: 'function', title: 'BIC for a mixture',
      prompt: 'Write `bic` from its contract.',
      starter: `import numpy as np

def bic(ll, K, d, n):
    """-2 * ll + p * log(n) for a full-covariance Gaussian mixture, p = (K - 1) + K d + K d (d + 1) / 2.

    Example: bic(-877.7, 3, 2, 300)  ->  1852.3...
    """
    pass   # replace with your code`,
      hint: 'Count the mixing weights, the means and the covariance entries.',
      solution: 'p = (K - 1) + K * d + K * d * (d + 1) / 2\nreturn -2 * ll + p * np.log(n)',
      check: { fn: 'bic', args: ['ll', 'K', 'd', 'n'], ints: ['K', 'd', 'n'], cases: BIC_CASES, describe: c => `log-likelihood ${c.ll}, K = ${c.K}, d = ${c.d}, n = ${c.n}`, diagnose: diagnoseBic },
    },
    { id: 'transfer', kind: 'transfer', title: 'Solve new problems', prompt: 'New points, responsibilities and mixtures. Solve one of each kind without opening the worked answer.' },
    { id: 'review', kind: 'review', title: 'Come back later', prompt: 'A fresh problem after a gap. The first return is suggested a day after you finish step 6; “Do it now” is always there and is recorded as early.' },
  ],
}
