import { rng, r3, needVars } from '../../kit/ladder.js'
import { logEvidenceBeta } from './engine.js'

// Lab 41 practice ladder: posterior means, predictives, priors as penalties and predictive spread by hand; an honest
// predictive band; the posterior mean, the predictive sd and the coin's evidence in code.

const inv = A => { const n = A.length, M = A.map((r, i) => [...r, ...A.map((_, j) => (i === j ? 1 : 0))]); for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]]; const d = M[c][c]; M[c] = M[c].map(v => v / d); for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; M[r] = M[r].map((v, j) => v - f * M[c][j]) } } return M.map(r => r.slice(n)) }
export function blrMeanOf(Phi, y, alpha, beta) {
  const d = Phi[0].length, A = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => (i === j ? alpha : 0) + beta * Phi.reduce((s, r) => s + r[i] * r[j], 0)))
  const S = inv(A), b = Array.from({ length: d }, (_, i) => beta * Phi.reduce((s, r, k) => s + r[i] * y[k], 0))
  return S.map(row => row.reduce((s, v, j) => s + v * b[j], 0))
}
export const predSdOf = (f, S, beta) => Math.sqrt(1 / beta + f.reduce((s, fi, i) => s + fi * S[i].reduce((t, v, j) => t + v * f[j], 0), 0))

const MEAN_CASES = [
  { Phi: [[1, 0], [1, 1], [1, 2]], y: [0.1, 1.2, 1.9], alpha: 0.1, beta: 4 },
  { Phi: [[1, -1], [1, 0.5], [1, 1], [1, 2]], y: [1, 0, -0.5, -2], alpha: 1, beta: 1 },
  { Phi: [[1, 0, 1], [0, 1, 1], [1, 1, 0], [1, 1, 1]], y: [1, 2, 3, 4], alpha: 0.5, beta: 2 },
].map(c => ({ ...c, expected: blrMeanOf(c.Phi, c.y, c.alpha, c.beta) }))
const SD_CASES = [
  { f: [1, 0], S: [[0.0225, 0], [0, 1]], beta: 16 },
  { f: [1, 2], S: [[0.1, 0.02], [0.02, 0.05]], beta: 4 },
  { f: [0.5, 0.5, 1], S: [[1, 0, 0], [0, 1, 0], [0, 0, 0.5]], beta: 1 },
].map(c => ({ ...c, expected: predSdOf(c.f, c.S, c.beta) }))
export const EV_CASES = [[1, 1, 10, 0], [1, 1, 3, 2], [2, 2, 7, 3], [0.5, 0.5, 1, 1]].map(([a, b, h, t]) => ({ a, b, h, t, expected: logEvidenceBeta(a, b, h, t) }))

export function diagnoseMean(c, got) {
  const d = c.Phi[0].length, A = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => (i === j ? c.alpha : 0) + c.beta * c.Phi.reduce((s, r) => s + r[i] * r[j], 0)))
  const S = inv(A), b = Array.from({ length: d }, (_, i) => c.Phi.reduce((s, r, k) => s + r[i] * c.y[k], 0)), noBeta = S.map(row => row.reduce((s, v, j) => s + v * b[j], 0))
  if (Array.isArray(got.value) && got.value.every((v, i) => Math.abs(v - noBeta[i]) < 1e-9) && c.beta !== 1) return 'The mean is β·S·Φᵀy: the noise precision β multiplies the data term.'
  return null
}
export function diagnoseSd(c, got) {
  const pv = c.f.reduce((s, fi, i) => s + fi * c.S[i].reduce((t, v, j) => t + v * c.f[j], 0), 0)
  if (Math.abs(got.value - (Math.sqrt(1 / c.beta) + Math.sqrt(pv))) < 1e-9) return 'Standard deviations do not add. Add the two variances, 1/β + φᵀSφ, then take the square root.'
  if (Math.abs(got.value - Math.sqrt(pv)) < 1e-9) return 'Include the noise variance 1/β: a new observation is noisy even if the weights were known exactly.'
  return null
}
export function diagnoseEv(c, got) {
  if (Math.abs(got.value + c.expected) < 1e-9 && c.expected !== 0) return 'The sign is flipped: log B(a + h, b + t) − log B(a, b).'
  return null
}
export function evaluateBand(vars) {
  const miss = needVars(vars, ['coverage', 'use_weight_uncertainty'])
  if (miss) return { passed: false, message: miss }
  const cv = Number(vars.coverage.value)
  if (!Number(vars.use_weight_uncertainty.value)) return { passed: false, message: `The “95%” band contains only ${r3(100 * cv)}% of new observations: it plugs in one weight vector and ignores how unsure the weights still are — worst in gaps and beyond the data. Set \`use_weight_uncertainty = 1\` and run again.` }
  return { passed: true, message: `${r3(100 * cv)}% of new observations fall inside the band: with the weight uncertainty added, a 95% band means 95%.` }
}

// ---------- Fresh problems ----------
export const TEMPLATES = ['postmean', 'predictive', 'lambda']
export function generate(template, seed) {
  const g = rng(seed * 269 + TEMPLATES.indexOf(template) * 4231 + 101)
  if (template === 'postmean') { const a = g.pick([1, 2, 3]), b = g.pick([1, 2, 5]), h = g.pick([3, 6, 7, 12]), t = g.pick([1, 3, 4, 8]); return { template, seed, a, b, h, t, answer: (a + h) / (a + b + h + t), misconceptions: [{ answer: h / (h + t), feedback: 'That is maximum likelihood. Add the prior’s pseudo-counts: (a + h)/(a + b + h + t).' }].filter(m => Math.abs(m.answer - (a + h) / (a + b + h + t)) > 0.0006) } }
  if (template === 'predictive') { const s = g.pick([0, 2, 5, 9]), n = s + g.pick([0, 1, 3]); return { template, seed, s, n, answer: (s + 1) / (n + 2), misconceptions: [{ answer: n ? s / n : 0.5, feedback: 'With a uniform prior the predictive is (s + 1)/(n + 2), Laplace’s rule — not the raw proportion.' }].filter(m => Math.abs(m.answer - (s + 1) / (n + 2)) > 0.0006) } }
  const sigma = g.pick([0.5, 1, 2]), tau = g.pick([0.5, 1, 2, 4]); return { template, seed, sigma, tau, answer: sigma * sigma / (tau * tau), misconceptions: [{ answer: sigma / tau, feedback: 'Square both: λ = σ²/τ².' }].filter(m => Math.abs(m.answer - sigma * sigma / (tau * tau)) > 0.0006) }
}
export function view(p) {
  if (p.template === 'postmean') return { intro: `Prior Beta(${p.a}, ${p.b}); you observe ${p.h} heads and ${p.t} tails.`, questions: [{ id: 'm', type: 'number', label: 'What is the posterior mean? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  if (p.template === 'predictive') return { intro: `Uniform prior; ${p.s} successes in ${p.n} trials.`, questions: [{ id: 'p', type: 'number', label: 'What is the probability that the next trial succeeds? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  return { intro: `Noise standard deviation ${p.sigma}; Gaussian prior on each weight with standard deviation ${p.tau}.`, questions: [{ id: 'l', type: 'number', label: 'What ridge λ does the MAP estimate correspond to? (Four decimals.)', answer: p.answer, tolerance: 0.00006, misconceptions: p.misconceptions }] }
}
export function workedSolution(p) {
  if (p.template === 'postmean') return `Beta(${p.a + p.h}, ${p.b + p.t}): mean ${p.a + p.h}/${p.a + p.b + p.h + p.t} = **${r3(p.answer)}**.`
  if (p.template === 'predictive') return `(${p.s} + 1)/(${p.n} + 2) = **${r3(p.answer)}**.`
  return `${p.sigma}²/${p.tau}² = **${Math.round(p.answer * 10000) / 10000}**.`
}

export const bayes = {
  title: 'Bayesian inference: posteriors, predictives and evidence',
  version: 1,
  templates: TEMPLATES,
  templateNames: { postmean: 'Beta posterior mean', predictive: 'Laplace’s rule', lambda: 'Prior as a penalty' },
  generate, view, workedSolution,
  intro: 'Seven steps: Bayesian arithmetic by hand, an honest predictive band, and writing the posterior mean, the predictive standard deviation and a coin’s evidence. Nothing here locks the rest of the lab.',
  steps: [
    {
      id: 'trace', kind: 'trace', title: 'Bayesian arithmetic by hand',
      prompt: 'Prior Beta(2, 2) and 7 heads, 3 tails. Uniform prior and 5 successes in 5 trials. Noise sd 0.5, prior sd 2. Noise sd 0.25 and weight-uncertainty variance 0.0225.',
      fields: [
        { label: 'Posterior mean (four decimals)', answer: 9 / 14, tolerance: 0.00006 },
        { label: 'Predictive probability of another success (three decimals)', answer: 6 / 7, tolerance: 0.0006 },
        { label: 'Ridge λ = σ²/τ²', answer: 0.0625, tolerance: 1e-9 },
        { label: 'Predictive standard deviation (four decimals)', answer: Math.sqrt(0.0625 + 0.0225), tolerance: 0.00006 },
      ],
      explain: 'Beta(9, 5): 9/14 = 0.6429. Laplace: 6/7 = 0.857. 0.25/4 = 0.0625. √(0.0625 + 0.0225) = √0.085 = 0.2915.',
    },
    {
      id: 'agree', kind: 'probe', title: 'A band that means 95%',
      prompt: 'Eight sine observations and a 95% predictive band checked on 400 new ones. Run it with a plug-in prediction. **Set `use_weight_uncertainty = 1`** and run again.',
      starter: `import numpy as np
rng = np.random.default_rng(41)
x = rng.random(8); y = np.sin(2 * np.pi * x) + 0.25 * rng.normal(size=8)
phi = lambda x: np.column_stack([np.ones_like(x)] + [np.exp(-(x - c) ** 2 / (2 * 0.1 ** 2)) for c in np.linspace(0, 1, 9)])
alpha, beta = 0.1, 16.0
S = np.linalg.inv(alpha * np.eye(10) + beta * phi(x).T @ phi(x)); m = beta * S @ phi(x).T @ y

use_weight_uncertainty = 0     # 0: plug-in prediction (noise only); 1: add the uncertainty about the weights
xt = np.linspace(-0.1, 1.1, 400); rt = np.random.default_rng(7)
yt = np.sin(2 * np.pi * xt) + 0.25 * rt.normal(size=400)
var = 1 / beta + (np.einsum("ij,jk,ik->i", phi(xt), S, phi(xt)) if use_weight_uncertainty else 0)
inside = np.abs(yt - phi(xt) @ m) <= 1.96 * np.sqrt(var)
coverage = float(inside.mean())                            # should be about 0.95 for an honest 95% band
print(f"use_weight_uncertainty = {use_weight_uncertainty}: the 95% band contains {coverage:.1%} of 400 new observations")`,
      probe: ['coverage', 'use_weight_uncertainty'],
      evaluate: evaluateBand,
      done: 'Coverage on new data is how you check any uncertainty estimate, Bayesian or not (Lab 60).',
    },
    {
      id: 'fill', kind: 'function', title: 'Fill in the posterior mean',
      prompt: 'Replace `___` with the posterior mean of the weights.',
      starter: `import numpy as np

def blr_mean(Phi, y, alpha, beta):
    """Posterior mean for prior N(0, I/alpha) and noise precision beta."""
    S = np.linalg.inv(alpha * np.eye(Phi.shape[1]) + beta * Phi.T @ Phi)
    return ___`,
      hint: 'm = β S Φᵀ y.',
      solution: 'return beta * S @ Phi.T @ y',
      check: { fn: 'blr_mean', args: ['Phi', 'y', 'alpha', 'beta'], cases: MEAN_CASES, describe: c => `${c.Phi.length} observations, α = ${c.alpha}, β = ${c.beta}`, diagnose: diagnoseMean },
    },
    {
      id: 'repair', kind: 'function', title: 'Repair a planted bug',
      prompt: 'With 1/β = 0.0625 and a weight-uncertainty variance of 0.0225 this returns **0.4**; the predictive sd is √0.085 = 0.2915. Fix it.',
      starter: `import numpy as np

def predictive_sd(f, S, beta):
    """Standard deviation of a new observation at features f."""
    return np.sqrt(1 / beta) + np.sqrt(f @ S @ f)`,
      hint: 'Independent uncertainties add as variances.',
      solution: 'return np.sqrt(1 / beta + f @ S @ f)',
      check: { fn: 'predictive_sd', args: ['f', 'S', 'beta'], cases: SD_CASES, describe: c => `f (${c.f.join(', ')}), β = ${c.beta}`, diagnose: diagnoseSd },
      explainChoice: {
        prompt: 'Why add variances rather than standard deviations?',
        options: [
          { text: 'The noise and the weight error are independent; the variance of a sum of independent quantities is the sum of their variances. Adding standard deviations overstates the spread.', correct: true },
          { text: 'Because variances are always smaller.', feedback: 'Not when they exceed 1; the reason is independence.' },
          { text: 'Because standard deviations cannot be added in NumPy.', feedback: 'They can; it just gives the wrong answer here.' },
          { text: 'To make the band narrower on purpose.', feedback: 'The goal is the correct width, which the coverage check confirms.' },
        ],
        rightFeedback: 'The same rule gave √(s₁²/n₁ + s₀²/n₀) for a difference in means (Lab 36).',
      },
    },
    {
      id: 'implement', kind: 'function', title: 'The evidence of a coin sequence',
      prompt: 'Write `log_evidence` from its contract.',
      starter: `import math

def log_evidence(a, b, h, t):
    """log p(sequence) for h heads and t tails in a particular order, under a Beta(a, b) prior on the bias:
    log B(a + h, b + t) - log B(a, b), with log B(x, y) = lgamma(x) + lgamma(y) - lgamma(x + y).

    Example: log_evidence(1, 1, 10, 0)  ->  log(1/11) = -2.3979
    """
    pass   # replace with your code`,
      hint: 'Write a helper for log B with math.lgamma, then subtract.',
      solution: 'lb = lambda x, y: math.lgamma(x) + math.lgamma(y) - math.lgamma(x + y)\nreturn lb(a + h, b + t) - lb(a, b)',
      check: { fn: 'log_evidence', args: ['a', 'b', 'h', 't'], cases: EV_CASES, describe: c => `Beta(${c.a}, ${c.b}), ${c.h} heads, ${c.t} tails`, diagnose: diagnoseEv },
    },
    { id: 'transfer', kind: 'transfer', title: 'Solve new problems', prompt: 'New priors, trials and noise levels. Solve one of each kind without opening the worked answer.' },
    { id: 'review', kind: 'review', title: 'Come back later', prompt: 'A fresh problem after a gap. The first return is suggested a day after you finish step 6; “Do it now” is always there and is recorded as early.' },
  ],
}
