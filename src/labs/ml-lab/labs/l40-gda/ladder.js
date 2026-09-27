import { rng, r3, needVars } from '../../kit/ladder.js'

// Lab 40 practice ladder: posteriors, pooled variances and parameter counts by hand; pooling within classes; the pooled
// covariance, LDA's weights and naive Bayes with missing features in code.

export function pooledOf(X, y) {
  const d = X[0].length, mu = [0, 1].map(k => { const rows = X.filter((_, i) => y[i] === k); return Array.from({ length: d }, (_, j) => rows.reduce((s, r) => s + r[j], 0) / rows.length) })
  return Array.from({ length: d }, (_, a) => Array.from({ length: d }, (_, b) => X.reduce((s, r, i) => s + (r[a] - mu[y[i]][a]) * (r[b] - mu[y[i]][b]), 0) / X.length))
}
export const ldaThetaOf = (S, m0, m1) => { const dm = [m1[0] - m0[0], m1[1] - m0[1]], det = S[0][0] * S[1][1] - S[0][1] * S[1][0]; return [(S[1][1] * dm[0] - S[0][1] * dm[1]) / det, (S[0][0] * dm[1] - S[1][0] * dm[0]) / det] }
export const nbOf = (x, present, mu0, mu1, v, prior) => Math.log(prior / (1 - prior)) + x.reduce((s, xj, j) => s + (present[j] ? ((xj - mu0[j]) ** 2 - (xj - mu1[j]) ** 2) / (2 * v[j]) : 0), 0)

const POOL_CASES = [
  { X: [[1, 0], [3, 2], [6, 1], [10, 5]], y: [0, 0, 1, 1] },
  { X: [[0, 0], [2, 2], [4, 0], [5, 1], [7, 3]], y: [0, 0, 0, 1, 1] },
  { X: [[1, 1], [2, 3], [3, 2], [8, 8], [9, 7], [10, 9]], y: [0, 0, 0, 1, 1, 1] },
].map(c => ({ ...c, expected: pooledOf(c.X, c.y) }))
const THETA_CASES = [
  { S: [[1, 0], [0, 1]], m0: [0, 0], m1: [1, 2] },
  { S: [[1.1, 0.6], [0.6, 0.9]], m0: [-0.9, -0.4], m1: [0.9, 0.5] },
  { S: [[2, 0.5], [0.5, 1]], m0: [1, 1], m1: [2, 0] },
].map(c => ({ ...c, expected: ldaThetaOf(c.S, c.m0, c.m1) }))
export const NB_CASES = [
  { x: [0.8, 0.0], present: [1, 0], mu0: [-0.9, -0.4], mu1: [0.9, 0.5], v: [1.1, 0.9], prior: 0.5 },
  { x: [0.8, 0.3], present: [1, 1], mu0: [-0.9, -0.4], mu1: [0.9, 0.5], v: [1.1, 0.9], prior: 0.5 },
  { x: [1, 2, 3], present: [0, 1, 1], mu0: [0, 0, 0], mu1: [1, 1, 1], v: [1, 2, 1], prior: 0.3 },
].map(c => ({ ...c, expected: nbOf(c.x, c.present, c.mu0, c.mu1, c.v, c.prior) }))

const close2 = (a, b) => Array.isArray(a) && a.flat().length === b.flat().length && a.flat().every((v, i) => Math.abs(v - b.flat()[i]) < 1e-9)
export function diagnosePool(c, got) {
  const d = c.X[0].length, m = Array.from({ length: d }, (_, j) => c.X.reduce((s, r) => s + r[j], 0) / c.X.length)
  const overall = Array.from({ length: d }, (_, a) => Array.from({ length: d }, (_, b) => c.X.reduce((s, r) => s + (r[a] - m[a]) * (r[b] - m[b]), 0) / c.X.length))
  if (close2(got.value, overall)) return 'That measures every example from the overall mean, so the gap between the classes counts as noise. Subtract each example’s own class mean.'
  return null
}
export function diagnoseTheta(c, got) {
  const dm = [c.m1[0] - c.m0[0], c.m1[1] - c.m0[1]], mult = [c.S[0][0] * dm[0] + c.S[0][1] * dm[1], c.S[1][0] * dm[0] + c.S[1][1] * dm[1]]
  if (close2(got.value, mult) && !close2(mult, c.expected)) return 'That multiplies by Σ. LDA’s weights are Σ⁻¹(μ₁ − μ₀): use np.linalg.solve(S, m1 - m0).'
  return null
}
export function diagnoseNb(c, got) {
  const all = nbOf(c.x, c.x.map(() => 1), c.mu0, c.mu1, c.v, c.prior)
  if (Math.abs(got.value - all) < 1e-9 && c.present.some(p => !p)) return 'A missing feature’s term must be left out; this includes it (with a placeholder value).'
  if (Math.abs(got.value - (c.expected - Math.log(c.prior / (1 - c.prior)))) < 1e-9 && c.prior !== 0.5) return 'Add the prior log-odds, log(φ/(1 − φ)).'
  return null
}
export function evaluatePooled(vars) {
  const miss = needVars(vars, ['cov_error', 'error', 'log_loss'])
  if (miss) return { passed: false, message: miss }
  const ce = Number(vars.cov_error.value)
  if (ce > 0.3) return { passed: false, message: `The estimated covariance is off by up to ${r3(ce)}: measuring from the overall mean adds the gap between the classes to the noise. Set \`pooled = 1\` and run again.` }
  return { passed: true, message: `Covariance error ${r3(ce)}, log-loss ${r3(Number(vars.log_loss.value))}. The error rate did not change (${r3(Number(vars.error.value))}): the extra term lies along μ₁ − μ₀, so Σ⁻¹(μ₁ − μ₀) keeps its direction — but the probabilities were wrong, and any use of the covariance itself (sampling, QDA) would be too.` }
}

// ---------- Fresh problems ----------
export const TEMPLATES = ['posterior', 'params', 'missing']
export function generate(template, seed) {
  const g = rng(seed * 263 + TEMPLATES.indexOf(template) * 4229 + 97)
  if (template === 'posterior') { const p1 = g.pick([0.1, 0.2, 0.3, 0.5]), p0 = g.pick([0.1, 0.2, 0.4]), phi = g.pick([0.2, 0.25, 0.5, 0.75]), answer = p1 * phi / (p1 * phi + p0 * (1 - phi)); return { template, seed, p1, p0, phi, answer, misconceptions: [{ answer: p1 / (p1 + p0), feedback: 'Weight each likelihood by how common its class is.' }].filter(m => Math.abs(m.answer - answer) > 0.0006) } }
  if (template === 'params') { const d = g.pick([2, 3, 4, 5, 10]), kind = g.pick(['LDA', 'QDA']), answer = kind === 'LDA' ? 2 * d + d * (d + 1) / 2 + 1 : 2 * d + d * (d + 1) + 1; return { template, seed, d, kind, answer, misconceptions: [{ answer: kind === 'LDA' ? 2 * d + d * d + 1 : 2 * d + 2 * d * d + 1, feedback: 'A covariance matrix is symmetric: count d(d + 1)/2 distinct entries, not d².' }] } }
  const t = [g.pick([0.4, -0.7, 1.1]), g.pick([-1.1, 0.6, 0.2]), g.pick([0.9, -0.3, 1.5])], miss = g.pick([0, 1, 2]), prior = g.pick([0, 0.5, -0.4]), answer = prior + t.reduce((s, v, j) => s + (j === miss ? 0 : v), 0)
  return { template, seed, t, miss, prior, answer: Math.round(answer * 1000) / 1000, misconceptions: [{ answer: Math.round((prior + t[0] + t[1] + t[2]) * 1000) / 1000, feedback: 'Leave the missing feature’s term out.' }].filter(m => Math.abs(m.answer - answer) > 0.0006) }
}
export function view(p) {
  if (p.template === 'posterior') return { intro: `p(x | class 1) = ${p.p1}, p(x | class 0) = ${p.p0}, and class 1 makes up ${Math.round(p.phi * 100)}% of the data.`, questions: [{ id: 'p', type: 'number', label: 'What is p(class 1 | x)? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  if (p.template === 'params') return { intro: `${p.kind} with ${p.d} features and two classes.`, questions: [{ id: 'k', type: 'number', label: 'How many parameters (means, covariance entries and the prior)?', answer: p.answer, misconceptions: p.misconceptions }] }
  return { intro: `Naive Bayes with prior log-odds ${p.prior} and feature contributions ${p.t.join(', ')}. Feature ${p.miss + 1} is missing.`, questions: [{ id: 'l', type: 'number', label: 'What is the log-odds? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
}
export function workedSolution(p) {
  if (p.template === 'posterior') return `${p.p1} × ${p.phi} / (${p.p1} × ${p.phi} + ${p.p0} × ${r3(1 - p.phi)}) = **${r3(p.answer)}**.`
  if (p.template === 'params') return p.kind === 'LDA' ? `2 × ${p.d} + ${p.d}·${p.d + 1}/2 + 1 = **${p.answer}**.` : `2 × ${p.d} + 2 × ${p.d}·${p.d + 1}/2 + 1 = **${p.answer}**.`
  return `${p.prior} + ${p.t.filter((_, j) => j !== p.miss).join(' + ')} = **${p.answer}**.`
}

export const gda = {
  title: 'Generative classifiers: posteriors, pooled covariances and missing features',
  version: 1,
  templates: TEMPLATES,
  templateNames: { posterior: 'Bayes-rule posterior', params: 'Parameter count', missing: 'Missing feature' },
  generate, view, workedSolution,
  intro: 'Seven steps: generative arithmetic by hand, pooling within classes, and writing the pooled covariance, LDA’s weights and naive Bayes with missing features. Nothing here locks the rest of the lab.',
  steps: [
    {
      id: 'trace', kind: 'trace', title: 'Generative arithmetic by hand',
      prompt: 'p(x | 1) = 0.3, p(x | 0) = 0.1 and φ = 0.25. One feature with class 0 values (1, 3) and class 1 values (6, 10). QDA with 3 features. Naive Bayes contributions 0.4, −1.1, 0.9 with prior log-odds 0 and feature 2 missing.',
      fields: [
        { label: 'p(class 1 | x)', answer: 0.5, tolerance: 1e-9 },
        { label: 'Pooled within-class variance (divide by 4)', answer: 2.5, tolerance: 1e-9 },
        { label: 'QDA parameters', answer: 19 },
        { label: 'Log-odds with feature 2 missing', answer: 1.3, tolerance: 1e-9 },
      ],
      explain: '0.075/(0.075 + 0.075) = 0.5. Class means 2 and 8; squared deviations 1, 1, 4, 4 → 2.5. 6 means + 2 × 6 covariance entries + 1 prior = 19. 0.4 + 0.9 = 1.3.',
    },
    {
      id: 'agree', kind: 'probe', title: 'Pool within classes',
      prompt: 'LDA estimates its covariance by measuring every example from the overall mean. Run it and compare with the true covariance. **Set `pooled = 1`** and run again.',
      starter: `import numpy as np
rng = np.random.default_rng(40)
S_true = np.array([[1.1, 0.6], [0.6, 0.9]])
def draw(n):
    y = (rng.random(n) < 0.5).astype(int)
    X = rng.multivariate_normal([0, 0], S_true, n) + np.where(y[:, None] == 1, [0.9, 0.5], [-0.9, -0.4])
    return X, y
X, y, (Xt, yt) = *draw(200), draw(4000)

pooled = 0                # 0: covariance measured from the overall mean; 1: pooled within classes
mu = np.array([X[y == k].mean(axis=0) for k in (0, 1)])
centered = X - mu[y] if pooled else X - X.mean(axis=0)
S = centered.T @ centered / len(y)
theta = np.linalg.solve(S, mu[1] - mu[0])
theta0 = -0.5 * (mu[1] @ np.linalg.solve(S, mu[1]) - mu[0] @ np.linalg.solve(S, mu[0])) + np.log(y.mean() / (1 - y.mean()))
p = 1 / (1 + np.exp(-(Xt @ theta + theta0)))
error = float(np.mean((p > 0.5) != yt))
log_loss = float(-np.mean(yt * np.log(p) + (1 - yt) * np.log(1 - p)))
cov_error = float(np.abs(S - S_true).max())                # largest error in the estimated covariance
print(f"pooled = {pooled}: covariance {np.round(S, 3).tolist()} (true {S_true.tolist()})")
print(f"test error {error:.3f}, log-loss {log_loss:.3f}, largest covariance error {cov_error:.3f}")`,
      probe: ['cov_error', 'error', 'log_loss'],
      evaluate: evaluatePooled,
      done: 'Check estimates against the truth when you can simulate it; a correct error rate does not prove every parameter is right.',
    },
    {
      id: 'fill', kind: 'function', title: 'Fill in the pooled covariance',
      prompt: 'Replace `___` with the pooled within-class covariance (divide by n).',
      starter: `import numpy as np

def pooled_cov(X, y):
    """Covariance of the examples, each measured from its own class mean."""
    mu = np.array([X[y == k].mean(axis=0) for k in (0, 1)])
    centered = X - mu[y]
    return ___`,
      hint: 'Outer products of the centred rows, averaged: centered.T @ centered / n.',
      solution: 'return centered.T @ centered / len(y)',
      check: { fn: 'pooled_cov', args: ['X', 'y'], ints: ['y'], cases: POOL_CASES, describe: c => `${c.X.length} examples`, diagnose: diagnosePool },
    },
    {
      id: 'repair', kind: 'function', title: 'Repair a planted bug',
      prompt: 'With Σ = [[2, 0.5], [0.5, 1]], μ₀ = (1, 1) and μ₁ = (2, 0) this returns **[1.5, −0.5]**; LDA’s weights are Σ⁻¹(μ₁ − μ₀) = [0.857, −1.429]. Fix it.',
      starter: `import numpy as np

def lda_theta(S, m0, m1):
    """LDA's weight vector: the direction in which the log-odds grows."""
    return S @ (m1 - m0)`,
      hint: 'Weights come from the inverse covariance. Solve rather than invert.',
      solution: 'return np.linalg.solve(S, m1 - m0)',
      check: { fn: 'lda_theta', args: ['S', 'm0', 'm1'], cases: THETA_CASES, describe: c => `Σ = [[${c.S[0].join(', ')}], [${c.S[1].join(', ')}]], μ₀ = (${c.m0.join(', ')}), μ₁ = (${c.m1.join(', ')})`, diagnose: diagnoseTheta },
      explainChoice: {
        prompt: 'Why the inverse covariance, and not simply μ₁ − μ₀?',
        options: [
          { text: 'Σ⁻¹ discounts directions where the classes are noisy and correlated features that repeat the same information; the best direction is the difference of means measured in units of the noise.', correct: true },
          { text: 'Because Σ is always diagonal.', feedback: 'It usually is not — which is exactly when Σ⁻¹ matters.' },
          { text: 'To make θ a unit vector.', feedback: 'θ’s length sets the steepness of the sigmoid; it is not normalized.' },
          { text: 'Because μ₁ − μ₀ is zero.', feedback: 'If it were, the classes would have the same mean and LDA could not separate them.' },
        ],
        rightFeedback: 'With Σ = I the two agree; Fisher’s ratio makes the reason precise.',
      },
    },
    {
      id: 'implement', kind: 'function', title: 'Naive Bayes with missing features',
      prompt: 'Write `nb_log_odds` from its contract.',
      starter: `import numpy as np

def nb_log_odds(x, present, mu0, mu1, var, prior):
    """Gaussian naive Bayes log-odds with shared per-feature variances:
    log(prior / (1 - prior)) + sum over PRESENT features j of ((x_j - mu0_j)^2 - (x_j - mu1_j)^2) / (2 var_j).
    present[j] is 1 if feature j was observed, 0 if it is missing (its x value is then meaningless).

    Example: nb_log_odds([1, 2, 3], [0, 1, 1], [0, 0, 0], [1, 1, 1], [1, 2, 1], 0.3)  ->  2.403...
    """
    pass   # replace with your code`,
      hint: 'Compute the per-feature terms, multiply by present, sum, and add the prior log-odds.',
      solution: 't = ((x - mu0) ** 2 - (x - mu1) ** 2) / (2 * var)\nreturn np.log(prior / (1 - prior)) + np.sum(t * present)',
      check: { fn: 'nb_log_odds', args: ['x', 'present', 'mu0', 'mu1', 'v', 'prior'], ints: ['present'], cases: NB_CASES, describe: c => `x (${c.x.join(', ')}), present (${c.present.join(', ')}), prior ${c.prior}`, diagnose: diagnoseNb },
    },
    { id: 'transfer', kind: 'transfer', title: 'Solve new problems', prompt: 'New likelihoods, models and missing features. Solve one of each kind without opening the worked answer.' },
    { id: 'review', kind: 'review', title: 'Come back later', prompt: 'A fresh problem after a gap. The first return is suggested a day after you finish step 6; “Do it now” is always there and is recorded as early.' },
  ],
}
