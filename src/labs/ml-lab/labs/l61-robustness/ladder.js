import { rng, r3, needVars } from '../../kit/ladder.js'

// Lab 61 practice ladder: worst-case logit change, safe budgets, effective sample size and BBSE by hand; importance
// weighting under covariate shift; FGSM, the PGD projection and the BBSE prior in code.

export const fgsmOf = (x, g, eps) => x.map((v, i) => Math.min(1, Math.max(0, v + eps * Math.sign(g[i]))))
export const pgdStepOf = (x0, xa, g, eps, step) => xa.map((v, i) => Math.min(1, Math.max(0, Math.min(x0[i] + eps, Math.max(x0[i] - eps, v + step * Math.sign(g[i]))))))
function solve(A, b) {                                                 // Gaussian elimination with partial pivoting
  const n = b.length, M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    ;[M[c], M[p]] = [M[p], M[c]]
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k] }
  }
  return M.map((row, i) => row[n] / row[i])
}
export function bbseOf(C, mu) { const p = solve(C, mu).map(v => Math.min(1, Math.max(0, v))), s = p.reduce((a, b) => a + b, 0); return p.map(v => v / s) }

const FGSM_CASES = [
  { x: [0.5, 0.2, 0.9], g: [1.3, -0.4, 2], eps: 0.1 },
  { x: [0, 1, 0.5, 0.05], g: [-1, 1, 0, -2], eps: 0.1 },
  { x: [0.3, 0.7], g: [0.001, -5], eps: 0.25 },
].map(c => ({ ...c, expected: fgsmOf(c.x, c.g, c.eps) }))
export const PGD_CASES = [
  { x0: [0.5], xa: [0.58], g: [1], eps: 0.1, step: 0.05 },
  { x0: [0.2, 0.8, 0.5], xa: [0.25, 0.72, 0.55], g: [-1, -1, 1], eps: 0.1, step: 0.04 },
  { x0: [0.95, 0.05], xa: [0.99, 0.01], g: [1, -1], eps: 0.2, step: 0.05 },
].map(c => ({ ...c, expected: pgdStepOf(c.x0, c.xa, c.g, c.eps, c.step) }))
export const BBSE_CASES = [
  { C: [[0.8, 0.3], [0.2, 0.7]], mu: [0.65, 0.35] },                   // true shares (0.7, 0.3)
  { C: [[0.9, 0.1], [0.1, 0.9]], mu: [0.95, 0.05] },                   // fewer predicted positives than false positives: raw solution < 0
  { C: [[0.8, 0.1, 0.2], [0.1, 0.7, 0.1], [0.1, 0.2, 0.7]], mu: [0.47, 0.28, 0.25] },   // true shares (0.5, 0.3, 0.2)
].map(c => ({ ...c, expected: bbseOf(c.C, c.mu) }))

const close = (a, b) => Math.abs(a - b) < 1e-6
const nearArr = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => close(v, b[i]))
export function diagnoseFgsm(c, got) {
  if (nearArr(got.value, c.x.map((v, i) => v + c.eps * Math.sign(c.g[i])))) return 'Clip the result to [0, 1]: pixels cannot leave the valid range.'
  if (nearArr(got.value, c.x.map((v, i) => Math.min(1, Math.max(0, v + c.eps * c.g[i]))))) return 'Use the sign of the gradient: every pixel moves by exactly ε, the most the L∞ budget allows.'
  if (nearArr(got.value, c.x.map((v, i) => Math.min(1, Math.max(0, v - c.eps * Math.sign(c.g[i])))))) return 'Step up the gradient, not down: the attack increases the loss.'
  return null
}
export function diagnosePgd(c, got) {
  if (nearArr(got.value, c.xa.map((v, i) => Math.min(1, Math.max(0, Math.min(v + c.eps, Math.max(v - c.eps, v + c.step * Math.sign(c.g[i])))))))) return 'The box is centred on the current adversarial point, which moves every step. Project into [x₀ − ε, x₀ + ε] around the original input.'
  return null
}
export function diagnoseBbse(c, got) {
  const T = c.C[0].map((_, j) => c.C.map(row => row[j]))
  if (nearArr(got.value, bbseOf(T, c.mu))) return 'C[i][j] = P(ŷ = i | y = j), so μ = C·π with C as given; you solved with its transpose.'
  const raw = solve(c.C, c.mu)
  if (nearArr(got.value, raw) && !nearArr(raw, c.expected)) return 'Clip the solution to [0, 1] and normalize it to sum to 1: sampling noise can push the raw solution outside.'
  return null
}
export function evaluateWeights(vars) {
  const miss = needVars(vars, ['test_mse', 'ess', 'use_weights'])
  if (miss) return { passed: false, message: miss }
  const m = Number(vars.test_mse.value), e = Number(vars.ess.value)
  if (m > 0.25) return { passed: false, message: `Test MSE ${r3(m)}: the line is the best fit for the training inputs around 0, not for the deployment inputs around 1.5. Set \`use_weights = 1\` and run again.` }
  return { passed: true, message: `Test MSE ${r3(m)}: the weighted line fits where the deployment inputs are. It rests on an effective ${r3(e)} of the 200 training points, the price of the correction.` }
}

// ---------- Fresh problems ----------
export const TEMPLATES = ['linf', 'ess', 'bbse']
export function generate(template, seed) {
  const g = rng(seed * 401 + TEMPLATES.indexOf(template) * 4513 + 199)
  if (template === 'linf') { const eps = g.pick([0.01, 0.03, 0.05, 0.1]), w1 = g.pick([4, 8, 12, 20, 50]), answer = eps * w1; return { template, seed, eps, w1, answer } }
  if (template === 'ess') { const w = [g.pick([1, 2, 3, 4]), g.pick([1, 2]), g.pick([0.5, 1]), g.pick([0.25, 0.5])], answer = w.reduce((a, b) => a + b, 0) ** 2 / w.reduce((a, b) => a + b * b, 0); return { template, seed, w, answer, misconceptions: [{ answer: w.length, feedback: 'Unequal weights make the effective sample smaller than the count: (Σw)²/Σw².' }].filter(m => Math.abs(m.answer - answer) > 0.006) } }
  const c10 = g.pick([0.05, 0.1, 0.2]), c11 = g.pick([0.8, 0.9, 0.95]), pi = g.pick([0.1, 0.2, 0.3, 0.6]), mu = +(c10 * (1 - pi) + c11 * pi).toFixed(4)
  return { template, seed, c10, c11, mu, answer: (mu - c10) / (c11 - c10), misconceptions: [{ answer: mu, feedback: 'The predicted rate mixes true positives and false positives; solve μ = C[1][0](1 − π) + C[1][1]π for π.' }].filter(m => Math.abs(m.answer - (mu - c10) / (c11 - c10)) > 0.0006) }
}
export function view(p) {
  if (p.template === 'linf') return { intro: `A linear score has ‖w‖₁ = ${p.w1}. An attacker may change every input by at most ε = ${p.eps}.`, questions: [{ id: 'l', type: 'number', label: 'By how much can the score change at most?', answer: p.answer, tolerance: 1e-9 }] }
  if (p.template === 'ess') return { intro: `Four training points have importance weights ${p.w.join(', ')}.`, questions: [{ id: 'e', type: 'number', label: 'Effective sample size? (Two decimals.)', answer: p.answer, tolerance: 0.006, misconceptions: p.misconceptions }] }
  return { intro: `On validation data P(ŷ = 1 | y = 0) = ${p.c10} and P(ŷ = 1 | y = 1) = ${p.c11}. At deployment ${r3(100 * p.mu)}% of points are predicted as class 1.`, questions: [{ id: 'b', type: 'number', label: 'BBSE estimate of the share of class 1? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
}
export function workedSolution(p) {
  if (p.template === 'linf') return `ε·‖w‖₁ = ${p.eps} × ${p.w1} = **${r3(p.answer)}**.`
  if (p.template === 'ess') return `(${p.w.join(' + ')})² / (${p.w.map(v => `${v}²`).join(' + ')}) = **${r3(p.answer)}**.`
  return `(${r3(p.mu)} − ${p.c10}) / (${p.c11} − ${p.c10}) = **${r3(p.answer)}**.`
}

export const robust = {
  title: 'Robustness and shift: attacks, weights and priors',
  version: 1,
  templates: TEMPLATES,
  templateNames: { linf: 'Worst-case score change', ess: 'Effective sample size', bbse: 'Label-shift estimate' },
  generate, view, workedSolution,
  intro: 'Seven steps: robustness and shift arithmetic by hand, importance weighting under covariate shift, and writing FGSM, the PGD projection and the BBSE prior. Nothing here locks the rest of the lab.',
  steps: [
    {
      id: 'trace', kind: 'trace', title: 'Robustness and shift by hand',
      prompt: 'A linear score has ‖w‖₁ = 10 and the budget is ε = 0.05. A classifier has margin 3 on a point and ‖w‖₁ = 30. Two training points have importance weights 3 and 1. On validation, P(ŷ = 1 | y = 0) = 0.2 and P(ŷ = 1 | y = 1) = 0.8; at deployment 35% are predicted as class 1.',
      fields: [
        { label: 'Largest change of the score', answer: 0.5, tolerance: 1e-9 },
        { label: 'Largest safe L∞ budget', answer: 0.1, tolerance: 1e-9 },
        { label: 'Effective sample size', answer: 1.6, tolerance: 1e-9 },
        { label: 'BBSE share of class 1', answer: 0.25, tolerance: 1e-9 },
      ],
      explain: '0.05 × 10 = 0.5. 3/30 = 0.1. (3 + 1)²/(9 + 1) = 1.6. (0.35 − 0.2)/(0.8 − 0.2) = 0.25.',
    },
    {
      id: 'agree', kind: 'probe', title: 'Weight toward the deployment inputs',
      prompt: 'A straight line is fitted to a curve from training inputs around 0 and used on deployment inputs around 1.5. Run it: the test error is high. **Set `use_weights = 1`** and run again.',
      starter: `import numpy as np
rng = np.random.default_rng(61)
f = lambda x: np.sin(1.5 * x) + 0.5 * x
xtr = rng.normal(0, 1, 200); ytr = f(xtr) + 0.2 * rng.normal(size=200)              # training inputs ~ N(0, 1)
xte = rng.normal(1.5, 0.5, 1000); yte = f(xte) + 0.2 * rng.normal(size=1000)        # deployment inputs ~ N(1.5, 0.5^2)
pdf = lambda x, m, s: np.exp(-0.5 * ((x - m) / s) ** 2) / (s * np.sqrt(2 * np.pi))

use_weights = 0           # 1: weight each training point by p_test(x) / p_train(x)
w = pdf(xtr, 1.5, 0.5) / pdf(xtr, 0, 1) if use_weights else np.ones(200)
A = np.column_stack([np.ones(200), xtr])
a, b = np.linalg.solve(A.T @ (A * w[:, None]), A.T @ (w * ytr))                      # weighted least-squares line
test_mse = float(np.mean((a + b * xte - yte) ** 2)); ess = float(w.sum() ** 2 / (w ** 2).sum())
print(f"use_weights = {use_weights}: line y = {a:.2f} {b:+.2f} x; test MSE {test_mse:.3f}; effective sample size {ess:.0f} of 200")`,
      probe: ['test_mse', 'ess', 'use_weights'],
      evaluate: evaluateWeights,
      done: 'In practice the densities are unknown: a classifier that tells training inputs from unlabeled deployment inputs estimates the same ratio (Lesson 61.3’s cell).',
    },
    {
      id: 'fill', kind: 'function', title: 'Fill in FGSM',
      prompt: 'Replace `___` with the FGSM adversarial example for pixels `x` in [0, 1], the loss gradient `grad` and budget `eps`.',
      starter: `import numpy as np

def fgsm(x, grad, eps):
    """One signed-gradient step of size eps, kept inside [0, 1]."""
    return ___`,
      hint: 'np.clip(x + eps * np.sign(grad), 0, 1).',
      solution: 'return np.clip(x + eps * np.sign(grad), 0, 1)',
      check: { fn: 'fgsm', args: ['x', 'g', 'eps'], cases: FGSM_CASES, describe: c => `${c.x.length} pixels, ε = ${c.eps}`, diagnose: diagnoseFgsm },
    },
    {
      id: 'repair', kind: 'function', title: 'Repair a planted bug',
      prompt: 'The original pixel is 0.5, the current adversarial value 0.58, the gradient positive, step 0.05, ε = 0.1. The step should stop at the edge of the budget, **0.6**; this function returns 0.63. Fix it.',
      starter: `import numpy as np

def pgd_step(x0, x_adv, grad, eps, step):
    """One PGD step: move by step * sign(grad), then project into the eps-box around the original x0 and into [0, 1]."""
    moved = x_adv + step * np.sign(grad)
    return np.clip(np.clip(moved, x_adv - eps, x_adv + eps), 0, 1)`,
      hint: 'Around which point should the ε-box be centred?',
      solution: 'return np.clip(np.clip(moved, x0 - eps, x0 + eps), 0, 1)',
      check: { fn: 'pgd_step', args: ['x0', 'xa', 'g', 'eps', 'step'], cases: PGD_CASES, describe: c => `${c.x0.length} pixel(s), ε = ${c.eps}`, diagnose: diagnosePgd },
      explainChoice: {
        prompt: 'What would the buggy projection do over ten steps?',
        options: [
          { text: 'It never binds, because a step of size 0.05 always stays within 0.1 of where it started. The attack drifts up to ten steps away from the original image, far outside the threat model, and reports a “robustness” failure that the budget does not allow.', correct: true },
          { text: 'It keeps the attack weaker than FGSM.', feedback: 'It makes the attack stronger than allowed, not weaker.' },
          { text: 'Nothing, since the clip to [0, 1] still applies.', feedback: 'Staying inside [0, 1] does not keep the change within ε.' },
          { text: 'It reverses the direction of the steps.', feedback: 'The direction is unchanged; only the constraint is wrong.' },
        ],
        rightFeedback: 'Always check that the final perturbation satisfies ‖x_adv − x₀‖∞ ≤ ε before reporting attack results.',
      },
    },
    {
      id: 'implement', kind: 'function', title: 'The BBSE prior',
      prompt: 'Write `bbse_prior` from its contract.',
      starter: `import numpy as np

def bbse_prior(C, mu):
    """Deployment class shares from black-box shift estimation.

    C[i][j] = P(predicted i | true j) on validation data; mu[i] = share of deployment points predicted as i.
    Solve C @ pi = mu, clip to [0, 1] and normalize to sum to 1.
    Example: bbse_prior([[0.9, 0.1], [0.1, 0.9]], [0.74, 0.26])  ->  [0.8, 0.2]
    """
    pass   # replace with your code`,
      hint: 'pi = np.clip(np.linalg.solve(C, mu), 0, 1); return pi / pi.sum().',
      solution: 'pi = np.clip(np.linalg.solve(C, mu), 0, 1)\nreturn pi / pi.sum()',
      check: { fn: 'bbse_prior', args: ['C', 'mu'], cases: BBSE_CASES, describe: c => `${c.mu.length} classes`, diagnose: diagnoseBbse },
    },
    { id: 'transfer', kind: 'transfer', title: 'Solve new problems', prompt: 'New budgets, weights and confusion matrices. Solve one of each kind without opening the worked answer.' },
    { id: 'review', kind: 'review', title: 'Come back later', prompt: 'A fresh problem after a gap. The first return is suggested a day after you finish step 6; “Do it now” is always there and is recorded as early.' },
  ],
}
