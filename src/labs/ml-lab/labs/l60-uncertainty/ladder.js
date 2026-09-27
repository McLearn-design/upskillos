import { rng, r3, needVars } from '../../kit/ladder.js'

// Lab 60 practice ladder: total variance, pinball loss, conformal rank and set size by hand; calibrating on the
// training data; the conformal quantile, the pinball loss and conformalized quantile regression in code.

export function confQOf(scores, alpha) { const n = scores.length, k = Math.ceil((n + 1) * (1 - alpha)); return k > n ? Infinity : [...scores].sort((a, b) => a - b)[k - 1] }
export const pinballOf = (tau, y, q) => y.map((v, i) => (v >= q[i] ? tau * (v - q[i]) : (1 - tau) * (q[i] - v)))
export function cqrOf(calLo, calHi, calY, lo, hi, alpha) {
  const s = calY.map((y, i) => Math.max(calLo[i] - y, y - calHi[i])), q = confQOf(s, alpha)
  return [lo.map(v => v - q), hi.map(v => v + q)]
}

const Q_CASES = [
  { scores: [5, 1, 4, 2, 3, 10, 9, 7, 8, 6], alpha: 0.2 },                 // n = 10: rank 9 (with n alone, 8)
  { scores: Array.from({ length: 20 }, (_, i) => (i * 7) % 20), alpha: 0.1 },  // n = 20: rank 19
  { scores: [0.3, 0.1, 0.4, 0.2], alpha: 0.5 },                               // n = 4: rank 3
].map(c => ({ ...c, expected: confQOf(c.scores, c.alpha) }))
export const PIN_CASES = [
  { tau: 0.9, y: [5], q: [3] },
  { tau: 0.1, y: [1, 4, 2], q: [3, 3, 2] },
  { tau: 0.5, y: [0, 2, -1, 3], q: [1, 1, 1, 1] },
].map(c => ({ ...c, expected: pinballOf(c.tau, c.y, c.q) }))
export const CQR_CASES = [
  { calLo: [0, 0, 0, 0], calHi: [1, 1, 1, 1], calY: [0.5, 1.5, -0.2, 0.9], lo: [2], hi: [3], alpha: 0.4 },
  { calLo: [1, 2, 0, 1, 3], calHi: [2, 4, 1, 3, 5], calY: [1.5, 1.8, 1.4, 2, 6], lo: [0, 1], hi: [2, 2.5], alpha: 0.2 },
  { calLo: [-1, -1, -1, -1, -1, -1, -1, -1, -1], calHi: [1, 1, 1, 1, 1, 1, 1, 1, 1], calY: [0, 0.2, -0.3, 0.9, -0.95, 0.5, 0.1, -0.6, 0.7], lo: [-2, 0], hi: [2, 1], alpha: 0.2 },
].map(c => ({ ...c, expected: cqrOf(c.calLo, c.calHi, c.calY, c.lo, c.hi, c.alpha) }))

const num = v => (Array.isArray(v) && v.length === 1 ? Number(v[0]) : Number(v))
const close = (a, b) => Math.abs(a - b) < 1e-6
const nearArr = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => close(v, b[i]))
const nearMat = (a, b) => Array.isArray(a) && a.length === b.length && a.every((row, i) => nearArr(row, b[i]))
export function diagnoseQ(c, got) {
  const v = num(got.value), s = [...c.scores].sort((a, b) => a - b), n = s.length, kn = Math.ceil(n * (1 - c.alpha))
  if (Number.isFinite(c.expected) && kn >= 1 && close(v, s[kn - 1]) && !close(v, c.expected)) return 'Use n + 1, not n: the new point is one more among n + 1 exchangeable scores, so k = ⌈(n + 1)(1 − α)⌉.'
  if (!Number.isFinite(c.expected) && Number.isFinite(v)) return 'When ⌈(n + 1)(1 − α)⌉ exceeds n, no calibration score is large enough: return infinity (np.inf).'
  return null
}
export function diagnosePin(c, got) {
  if (nearArr(got.value, pinballOf(1 - c.tau, c.y, c.q))) return 'τ and 1 − τ are swapped: a point above q costs τ per unit, a point below costs 1 − τ.'
  if (nearArr(got.value, c.y.map((v, i) => Math.abs(v - c.q[i])))) return 'That is the absolute error. Weight points above q by τ and points below by 1 − τ.'
  return null
}
export function diagnoseCqr(c, got) {
  const mid = c.calY.map((y, i) => Math.abs(y - (c.calLo[i] + c.calHi[i]) / 2)), q1 = confQOf(mid, c.alpha)
  if (nearMat(got.value, [c.lo.map(v => v - q1), c.hi.map(v => v + q1)])) return 'That scores the distance to the band’s midpoint. The CQR score is max(lo(x) − y, y − hi(x)): negative inside the band, positive outside.'
  const s = c.calY.map((y, i) => Math.max(c.calLo[i] - y, y - c.calHi[i])), q = confQOf(s, c.alpha)
  if (nearMat(got.value, [c.lo.map(v => v + q), c.hi.map(v => v - q)])) return 'The signs are reversed: the interval is [lo − q, hi + q].'
  if (Array.isArray(got.value) && got.value.length === 2 && Array.isArray(got.value[0])) {
    const s2 = [...s].sort((a, b) => a - b), n = s.length, k = Math.ceil(n * (1 - c.alpha)), qn = s2[k - 1]
    if (nearMat(got.value, [c.lo.map(v => v - qn), c.hi.map(v => v + qn)]) && !close(qn, q)) return 'Take the ⌈(n + 1)(1 − α)⌉-th smallest score, with n + 1.'
  }
  return null
}
export function evaluateHoldout(vars) {
  const miss = needVars(vars, ['coverage', 'q', 'use_holdout'])
  if (miss) return { passed: false, message: miss }
  const cov = Number(vars.coverage.value), q = Number(vars.q.value)
  if (cov < 0.87) return { passed: false, message: `The “90%” interval covers ${r3(cov)} of new points. The scores came from the rows the model was fitted to, where its errors are smaller than on new data, so q = ${r3(q)} is too small. Set \`use_holdout = 1\` and run again.` }
  return { passed: true, message: `q = ${r3(q)} and ${r3(cov)} coverage: calibration points the model never saw are exchangeable with new points, which is all the guarantee needs.` }
}

// ---------- Fresh problems ----------
export const TEMPLATES = ['total', 'rank', 'pinball']
export function generate(template, seed) {
  const g = rng(seed * 397 + TEMPLATES.indexOf(template) * 4507 + 197)
  if (template === 'total') { const a = g.pick([0.09, 0.16, 0.25, 0.36]), e = g.pick([0.04, 0.07, 0.11, 0.2]), answer = Math.sqrt(a + e); return { template, seed, a, e, answer, misconceptions: [{ answer: Math.sqrt(a) + Math.sqrt(e), feedback: 'Variances add, standard deviations do not: √(a + e).' }, { answer: a + e, feedback: 'That is the total variance; take its square root.' }].filter(m => Math.abs(m.answer - answer) > 0.0006) } }
  if (template === 'rank') { const n = g.pick([49, 99, 199, 299, 999]), alpha = g.pick([0.05, 0.1, 0.2]), answer = Math.ceil((n + 1) * (1 - alpha) - 1e-12); return { template, seed, n, alpha, answer, misconceptions: [{ answer: Math.ceil(n * (1 - alpha) - 1e-12), feedback: 'Use n + 1 in the rank: ⌈(n + 1)(1 − α)⌉.' }].filter(m => m.answer !== answer) } }
  const tau = g.pick([0.1, 0.25, 0.75, 0.9]), gap = g.pick([-3, -2, -1, 1, 2, 4]), answer = gap >= 0 ? tau * gap : (1 - tau) * -gap
  return { template, seed, tau, gap, answer, misconceptions: [{ answer: gap >= 0 ? (1 - tau) * gap : tau * -gap, feedback: 'Swapped weights: points above q cost τ per unit, points below cost 1 − τ.' }].filter(m => Math.abs(m.answer - answer) > 1e-9) }
}
export function view(p) {
  if (p.template === 'total') return { intro: `At one input a deep ensemble reports aleatoric variance ${p.a} and epistemic variance ${p.e}.`, questions: [{ id: 't', type: 'number', label: 'Total predictive standard deviation? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  if (p.template === 'rank') return { intro: `Split conformal prediction with ${p.n} calibration scores and α = ${p.alpha}.`, questions: [{ id: 'r', type: 'number', label: 'Which rank, counting from the smallest score, is the conformal quantile?', answer: p.answer, misconceptions: p.misconceptions }] }
  return { intro: `Quantile regression with τ = ${p.tau}. A point lies ${Math.abs(p.gap)} unit${Math.abs(p.gap) === 1 ? '' : 's'} ${p.gap >= 0 ? 'above' : 'below'} the predicted quantile.`, questions: [{ id: 'p', type: 'number', label: 'Its pinball loss?', answer: p.answer, tolerance: 1e-9, misconceptions: p.misconceptions }] }
}
export function workedSolution(p) {
  if (p.template === 'total') return `√(${p.a} + ${p.e}) = √${r3(p.a + p.e)} = **${r3(p.answer)}**.`
  if (p.template === 'rank') return `⌈(${p.n} + 1) × ${r3(1 - p.alpha)}⌉ = **${p.answer}**.`
  return p.gap >= 0 ? `Above q: τ × ${p.gap} = ${p.tau} × ${p.gap} = **${r3(p.answer)}**.` : `Below q: (1 − τ) × ${-p.gap} = ${r3(1 - p.tau)} × ${-p.gap} = **${r3(p.answer)}**.`
}

export const uncertainty = {
  title: 'Uncertainty: variances, quantiles and conformal guarantees',
  version: 1,
  templates: TEMPLATES,
  templateNames: { total: 'Total predictive sd', rank: 'Conformal rank', pinball: 'Pinball loss' },
  generate, view, workedSolution,
  intro: 'Seven steps: uncertainty arithmetic by hand, calibrating on the wrong data, and writing the conformal quantile, the pinball loss and conformalized quantile regression. Nothing here locks the rest of the lab.',
  steps: [
    {
      id: 'trace', kind: 'trace', title: 'Uncertainty arithmetic by hand',
      prompt: 'An ensemble reports aleatoric variance 0.16 and epistemic variance 0.09. With τ = 0.1, a point lies 3 units below the predicted quantile. Split conformal uses 49 calibration scores with α = 0.1. With q = 0.5, a classifier gives probabilities (0.6, 0.3, 0.1).',
      fields: [
        { label: 'Total predictive standard deviation', answer: 0.5, tolerance: 1e-9 },
        { label: 'Pinball loss', answer: 2.7, tolerance: 1e-9 },
        { label: 'Rank of the conformal quantile', answer: 45 },
        { label: 'Labels in the prediction set', answer: 1 },
      ],
      explain: '√(0.16 + 0.09) = 0.5. (1 − 0.1) × 3 = 2.7. ⌈50 × 0.9⌉ = 45. Keep classes with p ≥ 1 − 0.5 = 0.5: only the first.',
    },
    {
      id: 'agree', kind: 'probe', title: 'Calibrate on unseen data',
      prompt: 'A 3-nearest-neighbour regression gets a “90%” conformal interval. The scores are computed on its training data. Run it and look at the coverage. **Set `use_holdout = 1`** and run again.',
      starter: `import numpy as np
rng = np.random.default_rng(60)
def data(n):
    x = rng.uniform(-3, 3, n); return x, 1.5 * np.sin(1.3 * x) + (0.1 + 0.25 * np.abs(x)) * rng.normal(size=n)
xtr, ytr = data(300); xcal, ycal = data(300); xte, yte = data(2000)
def predict(x, k=3):                                                           # 3-nearest-neighbour regression on the training data
    idx = np.argsort(np.abs(x[:, None] - xtr[None]), axis=1)[:, :k]; return ytr[idx].mean(1)

use_holdout = 0           # 1: compute the conformity scores on the separate calibration set; 0: on the training data
xs, ys = (xcal, ycal) if use_holdout else (xtr, ytr)
scores = np.abs(ys - predict(xs)); n = len(scores)
q = float(np.sort(scores)[int(np.ceil((n + 1) * 0.9)) - 1])                    # conformal quantile for alpha = 0.1
coverage = float(np.mean(np.abs(yte - predict(xte)) <= q))
print(f"use_holdout = {use_holdout}: q = {q:.3f}; the 90% interval covers {coverage:.1%} of 2,000 new points")`,
      probe: ['coverage', 'q', 'use_holdout'],
      evaluate: evaluateHoldout,
      done: 'The same leak spoils any check of uncertainty: evaluate intervals, calibration and coverage only on data the model did not fit.',
    },
    {
      id: 'fill', kind: 'function', title: 'Fill in the conformal quantile',
      prompt: 'Replace `___` with the rank k of the conformal quantile.',
      starter: `import numpy as np

def conformal_q(scores, alpha):
    """The k-th smallest calibration score, k = ceil((n + 1)(1 - alpha)); infinity if k > n."""
    n = len(scores)
    k = ___
    return np.inf if k > n else np.sort(scores)[k - 1]`,
      hint: 'int(np.ceil((n + 1) * (1 - alpha))).',
      solution: 'k = int(np.ceil((n + 1) * (1 - alpha)))',
      check: { fn: 'conformal_q', args: ['scores', 'alpha'], cases: Q_CASES, describe: c => `n = ${c.scores.length}, α = ${c.alpha}`, diagnose: diagnoseQ },
    },
    {
      id: 'repair', kind: 'function', title: 'Repair a planted bug',
      prompt: 'With τ = 0.9, a point at y = 5 above a predicted quantile q = 3 should cost 0.9 × 2 = **1.8**. This pinball loss returns 0.2. Fix it.',
      starter: `import numpy as np

def pinball(tau, y, q):
    """Pinball loss for each point: tau * (y - q) above the quantile, (1 - tau) * (q - y) below."""
    return np.where(y >= q, (1 - tau) * (y - q), tau * (q - y))`,
      hint: 'Which weight belongs to points above the quantile?',
      solution: 'return np.where(y >= q, tau * (y - q), (1 - tau) * (q - y))',
      check: { fn: 'pinball', args: ['tau', 'y', 'q'], cases: PIN_CASES, describe: c => `τ = ${c.tau}, ${c.y.length} point(s)`, diagnose: diagnosePin },
      explainChoice: {
        prompt: 'What would a model trained with the buggy loss at τ = 0.9 learn?',
        options: [
          { text: 'The 0.1-quantile: being too high would cost 9 times as much as being too low, so the curve would sink until only 10% of points lie below it.', correct: true },
          { text: 'The median, because the two weights still add up to 1.', feedback: 'The median needs equal weights; these are 0.1 and 0.9.' },
          { text: 'The 0.9-quantile, since the loss is only relabelled.', feedback: 'Swapping the weights mirrors the quantile: τ becomes 1 − τ.' },
          { text: 'The mean.', feedback: 'The mean comes from squared error, not from any pinball loss.' },
        ],
        rightFeedback: 'An upper and a lower curve from the buggy loss would still bracket 80% of the data — just the wrong way round, which a coverage check on held-out points would reveal.',
      },
    },
    {
      id: 'implement', kind: 'function', title: 'Conformalized quantile regression',
      prompt: 'Write `cqr` from its contract.',
      starter: `import numpy as np

def cqr(cal_lo, cal_hi, cal_y, lo, hi, alpha):
    """Conformalized quantile regression.

    Scores on the calibration set: s = max(cal_lo - cal_y, cal_y - cal_hi).
    q = the ceil((n + 1)(1 - alpha))-th smallest score. Return [lo - q, hi + q] as a (2, m) array.
    Example: cqr([0, 0, 0, 0], [1, 1, 1, 1], [0.5, 1.5, -0.2, 0.9], [2], [3], 0.4)  ->  [[1.8], [3.2]]
    """
    pass   # replace with your code`,
      hint: 's = np.maximum(cal_lo - cal_y, cal_y - cal_hi); k = int(np.ceil((len(s) + 1) * (1 - alpha))); q = np.sort(s)[k - 1].',
      solution: 's = np.maximum(cal_lo - cal_y, cal_y - cal_hi)\nk = int(np.ceil((len(s) + 1) * (1 - alpha))); q = np.sort(s)[k - 1]\nreturn np.array([lo - q, hi + q])',
      check: { fn: 'cqr', args: ['calLo', 'calHi', 'calY', 'lo', 'hi', 'alpha'], cases: CQR_CASES, describe: c => `${c.calY.length} calibration points, α = ${c.alpha}`, diagnose: diagnoseCqr },
    },
    { id: 'transfer', kind: 'transfer', title: 'Solve new problems', prompt: 'New ensembles, calibration sets and quantiles. Solve one of each kind without opening the worked answer.' },
    { id: 'review', kind: 'review', title: 'Come back later', prompt: 'A fresh problem after a gap. The first return is suggested a day after you finish step 6; “Do it now” is always there and is recorded as early.' },
  ],
}
