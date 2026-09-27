import { rng, r3, needVars } from '../../kit/ladder.js'

// Lab 48 practice ladder: shadow prices, duality gaps, support vectors and soft-thresholding by hand; the ISTA step size;
// soft-thresholding, the SVM weights from the dual and one ISTA step in code.

export const softOf = (v, t) => v.map(x => Math.sign(x) * Math.max(Math.abs(x) - t, 0))
export const wFromDualOf = (alpha, y, X) => X[0].map((_, k) => X.reduce((s, x, i) => s + alpha[i] * y[i] * x[k], 0))
export function istaStepOf(w, X, y, lam, t) {
  const n = y.length, res = X.map((r, i) => r.reduce((s, v, j) => s + v * w[j], 0) - y[i])
  const g = w.map((_, j) => X.reduce((s, r, i) => s + r[j] * res[i], 0) / n)
  return softOf(w.map((v, j) => v - t * g[j]), t * lam)
}

const SOFT_CASES = [{ v: [1.2, -0.3, 0.5], t: 0.4 }, { v: [-2, 2, 0], t: 1 }, { v: [0.1, -0.1], t: 0.05 }].map(c => ({ ...c, expected: softOf(c.v, c.t) }))
const W_CASES = [
  { alpha: [0, 0.5, 0, 0.5], y: [1, 1, -1, -1], X: [[1, 0], [2, 1], [0, 3], [-1, 1]] },
  { alpha: [0.2, 0.2, 0.4], y: [1, -1, -1], X: [[1, 1], [0, 1], [2, 0]] },
  { alpha: [1, 1], y: [1, -1], X: [[3, 4], [1, 1]] },
].map(c => ({ ...c, expected: wFromDualOf(c.alpha, c.y, c.X) }))
export const STEP_CASES = [
  { w: [0, 0], X: [[1, 0], [0, 1], [1, 1]], y: [1, 2, 3], lam: 0.1, t: 0.5 },
  { w: [1, -1], X: [[1, 2], [2, 1], [0, 1]], y: [0, 1, -1], lam: 0.5, t: 0.2 },
  { w: [0.3, 0, 0.2], X: [[1, 0, 1], [0, 1, 1]], y: [1, 0], lam: 1, t: 0.1 },
].map(c => ({ ...c, expected: istaStepOf(c.w, c.X, c.y, c.lam, c.t) }))

const near = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9)
export function diagnoseSoft(c, got) {
  if (near(got.value, c.v.map(x => x - c.t))) return 'Shrink toward zero, not always downward: sign(v)·max(|v| − t, 0).'
  if (near(got.value, c.v.map(x => (Math.abs(x) <= c.t ? 0 : x)))) return 'That is hard-thresholding. Soft-thresholding also shrinks the surviving values by t.'
  return null
}
export function diagnoseW(c, got) {
  if (near(got.value, c.X[0].map((_, k) => c.X.reduce((s, x, i) => s + c.alpha[i] * x[k], 0))) && c.y.some(v => v < 0)) return 'Each support vector pulls w toward its own class: multiply by yᵢ, w = Σ αᵢ yᵢ xᵢ.'
  return null
}
export function diagnoseStep(c, got) {
  const n = c.y.length, res = c.X.map((r, i) => r.reduce((s, v, j) => s + v * c.w[j], 0) - c.y[i]), g = c.w.map((_, j) => c.X.reduce((s, r, i) => s + r[j] * res[i], 0) / n)
  if (near(got.value, c.w.map((v, j) => v - c.t * g[j]))) return 'Apply the proximal step after the gradient step: soft-threshold at t·λ.'
  if (near(got.value, softOf(c.w.map((v, j) => v - c.t * g[j]), c.lam))) return 'The threshold is t·λ, the step size times the penalty.'
  return null
}
export function evaluateStep(vars) {
  const miss = needVars(vars, ['final_objective', 'zeros'])
  if (miss) return { passed: false, message: miss }
  const f = Number(vars.final_objective.value)
  if (f >= 1e5) return { passed: false, message: 'The iterates blew up: a step of 3/L overshoots along the steepest direction every time. Set `step = 1 / L` and run again.' }
  return { passed: true, message: `Objective ${r3(f)} with ${Number(vars.zeros.value)} exact zeros: with t = 1/L each proximal-gradient step is guaranteed not to increase the objective.` }
}

// ---------- Fresh problems ----------
export const TEMPLATES = ['soft', 'shadow', 'gap']
export function generate(template, seed) {
  const g = rng(seed * 311 + TEMPLATES.indexOf(template) * 4327 + 137)
  if (template === 'soft') { const v = g.pick([1.2, -0.8, 0.3, -2.5, 0.6]), t = g.pick([0.2, 0.4, 0.5, 1]); return { template, seed, v, t, answer: softOf([v], t)[0], misconceptions: [{ answer: v - t, feedback: 'Shrink toward zero: for negative v that means adding t.' }].filter(m => Math.abs(m.answer - softOf([v], t)[0]) > 0.0006) } }
  if (template === 'shadow') { const lam = g.pick([0.5, 1, 2, 3, 4]), db = g.pick([0.01, 0.05, 0.1, 0.2]); return { template, seed, lam, db, answer: -lam * db, misconceptions: [{ answer: lam * db, feedback: 'Relaxing a constraint can only lower (or keep) the minimum: df* = −λ·db.' }] } }
  const p = g.pick([13.3501, 4.612, 0.8761, 102.5]), gap = g.pick([0.0003, 0.001, 0.02]); return { template, seed, p, d: Math.round((p - gap) * 1e6) / 1e6, answer: gap }
}
export function view(p) {
  if (p.template === 'soft') return { intro: `Soft-threshold v = ${p.v} with threshold ${p.t}.`, questions: [{ id: 's', type: 'number', label: 'Result? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  if (p.template === 'shadow') return { intro: `At an optimum, the multiplier of a constraint g(x) ≤ b is λ = ${p.lam}.`, questions: [{ id: 'd', type: 'number', label: `If b increases by ${p.db}, approximately how does f* change? (Three decimals.)`, answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  return { intro: `A solver reports primal objective ${p.p} and dual objective ${p.d}.`, questions: [{ id: 'g', type: 'number', label: 'At most how far is the solution from optimal in objective value? (Four decimals.)', answer: p.answer, tolerance: 0.00006 }] }
}
export function workedSolution(p) {
  if (p.template === 'soft') return `sign(${p.v}) × max(|${p.v}| − ${p.t}, 0) = **${r3(p.answer)}**.`
  if (p.template === 'shadow') return `−λ·Δb = −${p.lam} × ${p.db} = **${r3(p.answer)}**.`
  return `${p.p} − ${p.d} = **${p.answer}**.`
}

export const convex = {
  title: 'Convex optimization: multipliers, duals and proximal steps',
  version: 1,
  templates: TEMPLATES,
  templateNames: { soft: 'Soft-thresholding', shadow: 'Shadow price', gap: 'Duality gap' },
  generate, view, workedSolution,
  intro: 'Seven steps: optimization arithmetic by hand, the proximal-gradient step size, and writing soft-thresholding, the SVM weights from the dual and one ISTA step. Nothing here locks the rest of the lab.',
  steps: [
    {
      id: 'trace', kind: 'trace', title: 'Optimization arithmetic by hand',
      prompt: 'A multiplier λ = 3 on x₁ + x₂ ≤ b, with b raised by 0.01. A solver at primal 13.3501 and dual 13.3498. An SVM with 400 points, 360 strictly beyond the margin. Soft-thresholding v = 1.2 at 0.4.',
      fields: [
        { label: 'Change in f*', answer: -0.03, tolerance: 1e-9 },
        { label: 'Largest possible distance from optimal (four decimals)', answer: 0.0003, tolerance: 0.00001 },
        { label: 'Most training points the decision function can depend on', answer: 40 },
        { label: 'Soft-thresholded value', answer: 0.8, tolerance: 1e-9 },
      ],
      explain: '−3 × 0.01 = −0.03. 13.3501 − 13.3498 = 0.0003. Complementary slackness gives α = 0 for the 360, leaving at most 40 support vectors. 1.2 − 0.4 = 0.8.',
    },
    {
      id: 'agree', kind: 'probe', title: 'The proximal-gradient step',
      prompt: 'ISTA on the lasso with step 3/L, where L is the Lipschitz constant of the smooth gradient. Run it: the iterates blow up. **Set `step = 1 / L`** and run again.',
      starter: `import numpy as np
rng = np.random.default_rng(7)
n, d = 60, 30
beta = np.zeros(d); beta[:3] = [3, -2, 1.5]
X = rng.normal(size=(n, d)); y = X @ beta + 0.5 * rng.normal(size=n)
lam = 0.1
L = float(np.linalg.eigvalsh(X.T @ X / n).max())            # Lipschitz constant of the smooth gradient
obj = lambda w: np.sum((X @ w - y) ** 2) / (2 * n) + lam * np.abs(w).sum()

step = 3 / L              # the ISTA step size t
w = np.zeros(d)
for _ in range(200):
    v = w - step * X.T @ (X @ w - y) / n
    w = np.sign(v) * np.maximum(np.abs(v) - step * lam, 0)
final_objective = float(obj(w)) if np.isfinite(obj(w)) and obj(w) < 1e6 else 1e6   # capped: it diverged
zeros = int(np.sum(w == 0))
print(f"step = {step * L:.1f} / L: objective after 200 steps {final_objective:.6g}, exact zeros {zeros} of {d}")`,
      probe: ['final_objective', 'zeros'],
      evaluate: evaluateStep,
      done: 'Unknown L? Backtracking finds a safe step automatically, as gradient descent did in Lab 39.',
    },
    {
      id: 'fill', kind: 'function', title: 'Fill in soft-thresholding',
      prompt: 'Replace `___` with the soft-thresholding of the vector v at threshold t.',
      starter: `import numpy as np

def soft_threshold(v, t):
    """The proximal operator of t * |.|, elementwise."""
    return ___`,
      hint: 'sign(v) · max(|v| − t, 0).',
      solution: 'return np.sign(v) * np.maximum(np.abs(v) - t, 0)',
      check: { fn: 'soft_threshold', args: ['v', 't'], cases: SOFT_CASES, describe: c => `v (${c.v.join(', ')}), t = ${c.t}`, diagnose: diagnoseSoft },
    },
    {
      id: 'repair', kind: 'function', title: 'Repair a planted bug',
      prompt: 'For α = (0, 0.5, 0, 0.5), labels (+1, +1, −1, −1) and points (1, 0), (2, 1), (0, 3), (−1, 1) this returns **w = (0.5, 1)**; the SVM’s weights are (1.5, 0). Fix it.',
      starter: `import numpy as np

def w_from_dual(alpha, y, X):
    """The primal weight vector implied by the dual multipliers."""
    return alpha @ X`,
      hint: 'Stationarity of the Lagrangian: w = Σ αᵢ yᵢ xᵢ.',
      solution: 'return (alpha * y) @ X',
      check: { fn: 'w_from_dual', args: ['alpha', 'y', 'X'], ints: ['y'], cases: W_CASES, describe: c => `${c.X.length} points`, diagnose: diagnoseW },
      explainChoice: {
        prompt: 'Why do only the support vectors appear in w?',
        options: [
          { text: 'Complementary slackness: a point strictly beyond the margin has an inactive constraint, so its multiplier αᵢ is 0 and it drops out of Σ αᵢ yᵢ xᵢ.', correct: true },
          { text: 'Because the solver deletes the other points.', feedback: 'All points are used to find α; most simply end with α = 0.' },
          { text: 'Because support vectors are the misclassified points.', feedback: 'Points on the margin are support vectors too, and correctly classified.' },
          { text: 'Because the kernel is linear.', feedback: 'It holds for every kernel.' },
        ],
        rightFeedback: 'Hence an SVM’s prediction cost scales with the number of support vectors, not the training set.',
      },
    },
    {
      id: 'implement', kind: 'function', title: 'One ISTA step',
      prompt: 'Write `ista_step` from its contract.',
      starter: `import numpy as np

def ista_step(w, X, y, lam, t):
    """One proximal-gradient step for (1/2n)||y - Xw||^2 + lam ||w||_1:
    a gradient step of size t on the smooth part, then soft-thresholding at t * lam.

    Example: ista_step([0, 0], [[1, 0], [0, 1], [1, 1]], [1, 2, 3], 0.1, 0.5)  ->  [0.6167, 0.7833]
    """
    pass   # replace with your code`,
      hint: 'g = Xᵀ(Xw − y)/n; v = w − t·g; return sign(v)·max(|v| − tλ, 0).',
      solution: 'v = w - t * X.T @ (X @ w - y) / len(y)\nreturn np.sign(v) * np.maximum(np.abs(v) - t * lam, 0)',
      check: { fn: 'ista_step', args: ['w', 'X', 'y', 'lam', 't'], cases: STEP_CASES, describe: c => `w (${c.w.join(', ')}), λ = ${c.lam}, t = ${c.t}`, diagnose: diagnoseStep },
    },
    { id: 'transfer', kind: 'transfer', title: 'Solve new problems', prompt: 'New thresholds, multipliers and solvers. Solve one of each kind without opening the worked answer.' },
    { id: 'review', kind: 'review', title: 'Come back later', prompt: 'A fresh problem after a gap. The first return is suggested a day after you finish step 6; “Do it now” is always there and is recorded as early.' },
  ],
}
