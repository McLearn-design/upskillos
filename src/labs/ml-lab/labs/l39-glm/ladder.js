import { rng, r3, needVars } from '../../kit/ladder.js'

// Lab 39 practice ladder: exponential-family moments, log-link factors, softmax and kernel weights by hand; Newton against
// gradient descent; the Poisson gradient, LWR weights and a Newton step in code.

const sig = z => 1 / (1 + Math.exp(-z))
export const poissonGradOf = (theta, X, y) => { const n = y.length, mu = X.map(r => Math.exp(r[0] * theta[0] + r[1] * theta[1])); return [0, 1].map(j => X.reduce((s, r, i) => s + (mu[i] - y[i]) * r[j], 0) / n) }
export const lwrWeightsOf = (xs, x0, tau) => xs.map(x => Math.exp(-((x - x0) ** 2) / (2 * tau * tau)))
export function newtonStepOf(theta, X, y) {
  const n = y.length, p = X.map(r => sig(r[0] * theta[0] + r[1] * theta[1]))
  const g = [0, 1].map(j => X.reduce((s, r, i) => s + (p[i] - y[i]) * r[j], 0) / n)
  const H = [0, 1].map(a => [0, 1].map(b => X.reduce((s, r, i) => s + p[i] * (1 - p[i]) * r[a] * r[b], 0) / n))
  const det = H[0][0] * H[1][1] - H[0][1] * H[1][0], s0 = (H[1][1] * g[0] - H[0][1] * g[1]) / det, s1 = (H[0][0] * g[1] - H[1][0] * g[0]) / det
  return [theta[0] - s0, theta[1] - s1]
}

const X4 = [[1, 0], [1, 1], [1, 2], [1, 3]]
const PG_CASES = [
  { theta: [0, 0], X: X4, y: [1, 0, 2, 4] },
  { theta: [0.2, 0.3], X: X4, y: [1, 2, 2, 3] },
  { theta: [-0.5, 0.1], X: [[1, 1], [1, 5], [1, 9]], y: [0, 1, 3] },
].map(c => ({ ...c, expected: poissonGradOf(c.theta, c.X, c.y) }))
const W_CASES = [
  { xs: [0, 1, 2, 3], x0: 0, tau: 1 },
  { xs: [2, 2.5, 4], x0: 2, tau: 0.5 },
  { xs: [-1, 0, 1], x0: 0.5, tau: 2 },
].map(c => ({ ...c, expected: lwrWeightsOf(c.xs, c.x0, c.tau) }))
export const NS_CASES = [
  { theta: [0, 0], X: [[1, -1], [1, 0], [1, 1], [1, 2]], y: [0, 1, 0, 1] },
  { theta: [0.5, -0.2], X: [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]], y: [0, 0, 1, 0, 1] },
  { theta: [-1, 1], X: [[1, 0.5], [1, 1.5], [1, 2.5]], y: [1, 0, 1] },
].map(c => ({ ...c, expected: newtonStepOf(c.theta, c.X, c.y) }))

const close = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9)
export function diagnosePg(c, got) {
  const lin = [0, 1].map(j => c.X.reduce((s, r, i) => s + (r[0] * c.theta[0] + r[1] * c.theta[1] - c.y[i]) * r[j], 0) / c.y.length)
  if (close(got.value, lin)) return 'That is the Gaussian gradient (μ = η). For the Poisson the mean is exp(η): use np.exp(X @ theta) − y.'
  if (close(got.value, c.expected.map(v => -v))) return 'The sign is flipped: the gradient is (μ − y)·x, prediction minus target.'
  return null
}
export function diagnoseW(c, got) {
  if (close(got.value, c.xs.map(x => Math.exp(-((x - c.x0) ** 2) / (c.tau * c.tau))))) return 'The exponent is −d²/(2τ²): the factor 2 is missing.'
  return null
}
export function diagnoseNs(c, got) {
  const p = c.X.map(r => sig(r[0] * c.theta[0] + r[1] * c.theta[1])), g = [0, 1].map(j => c.X.reduce((s, r, i) => s + (p[i] - c.y[i]) * r[j], 0) / c.y.length)
  if (close(got.value, [c.theta[0] - g[0], c.theta[1] - g[1]])) return 'That is a gradient-descent step with learning rate 1. Newton divides by the curvature: solve H·step = g with H = Xᵀ diag(p(1 − p)) X / n.'
  if (close(got.value, [2 * c.theta[0] - c.expected[0], 2 * c.theta[1] - c.expected[1]])) return 'Subtract the step: θ − H⁻¹g.'
  return null
}
export function evaluateNewton(vars) {
  const miss = needVars(vars, ['grad_norm', 'steps'])
  if (miss) return { passed: false, message: miss }
  const g = Number(vars.grad_norm.value)
  if (g > 1e-8) return { passed: false, message: `After ${Number(vars.steps.value)} steps the gradient norm is still ${g.toExponential(1)}: on raw x the loss is a long narrow valley and gradient descent zigzags. Set \`method = "newton"\` and run again.` }
  return { passed: true, message: `Gradient norm ${g.toExponential(1)}: Newton’s method has converged to machine precision in ${Number(vars.steps.value)} steps, on the same raw inputs.` }
}

// ---------- Fresh problems ----------
export const TEMPLATES = ['poismean', 'factor', 'weight']
export function generate(template, seed) {
  const g = rng(seed * 257 + TEMPLATES.indexOf(template) * 4217 + 89)
  if (template === 'poismean') { const eta = g.pick([0.5, 0.8, 1.2, 1.5, 2]); return { template, seed, eta, answer: Math.exp(eta), misconceptions: [{ answer: eta, feedback: 'η is the natural parameter (the log of the mean). The mean is a′(η) = e^η.' }] } }
  if (template === 'factor') { const th = g.pick([0.1, 0.2, 0.25, 0.3, 0.5]), k = g.pick([1, 2, 3]); return { template, seed, th, k, answer: Math.exp(k * th), misconceptions: [{ answer: 1 + k * th, feedback: 'With a log link the effect multiplies: e^(k·θ), not 1 + k·θ.' }].filter(m => Math.abs(m.answer - Math.exp(k * th)) > 0.0006) } }
  const tau = g.pick([0.5, 1, 2]), d = g.pick([0.5, 1, 2, 3]); return { template, seed, tau, d, answer: Math.exp(-(d * d) / (2 * tau * tau)), misconceptions: [{ answer: Math.exp(-(d * d) / (tau * tau)), feedback: 'Divide by 2τ², not τ².' }].filter(m => Math.abs(m.answer - Math.exp(-(d * d) / (2 * tau * tau))) > 0.0006) }
}
export function view(p) {
  if (p.template === 'poismean') return { intro: `A Poisson model has natural parameter η = ${p.eta}.`, questions: [{ id: 'm', type: 'number', label: 'What is the expected count? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  if (p.template === 'factor') return { intro: `A Poisson regression has slope θ₁ = ${p.th}.`, questions: [{ id: 'f', type: 'number', label: `By what factor does the expected count multiply when x increases by ${p.k}? (Three decimals.)`, answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  return { intro: `Locally weighted regression with bandwidth τ = ${p.tau}.`, questions: [{ id: 'w', type: 'number', label: `What weight does a point ${p.d} units from the query get? (Three decimals.)`, answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
}
export function workedSolution(p) {
  if (p.template === 'poismean') return `a′(η) = e^${p.eta} = **${r3(p.answer)}**.`
  if (p.template === 'factor') return `e^(${p.k} × ${p.th}) = **${r3(p.answer)}**.`
  return `exp(−${p.d}²/(2 × ${p.tau}²)) = **${r3(p.answer)}**.`
}

export const glm = {
  title: 'GLMs: moments, links, Newton steps and local weights',
  version: 1,
  templates: TEMPLATES,
  templateNames: { poismean: 'Mean from η', factor: 'Log-link factor', weight: 'Kernel weight' },
  generate, view, workedSolution,
  intro: 'Seven steps: GLM arithmetic by hand, Newton against gradient descent, and writing the Poisson gradient, the LWR weights and a Newton step. Nothing here locks the rest of the lab.',
  steps: [
    {
      id: 'trace', kind: 'trace', title: 'GLM arithmetic by hand',
      prompt: 'A Poisson model with η = 1.2; a Poisson slope of 0.25; softmax scores (2, 1, 0); and a locally weighted fit with τ = 1.',
      fields: [
        { label: 'Expected count e^1.2 (three decimals)', answer: Math.exp(1.2), tolerance: 0.0006 },
        { label: 'Factor per unit of x, e^0.25 (three decimals)', answer: Math.exp(0.25), tolerance: 0.0006 },
        { label: 'Softmax probability of the first class (three decimals)', answer: Math.exp(2) / (Math.exp(2) + Math.exp(1) + 1), tolerance: 0.0006 },
        { label: 'Weight of a point 3 units away (three decimals)', answer: Math.exp(-4.5), tolerance: 0.0006 },
      ],
      explain: 'e^1.2 = 3.320 (also the variance). e^0.25 = 1.284. e²/(e² + e + 1) = 7.389/11.107 = 0.665. exp(−9/2) = 0.011.',
    },
    {
      id: 'agree', kind: 'probe', title: 'Curvature matters',
      prompt: 'Logistic regression on raw x (0 to 10), ten steps. Run it with gradient descent: far from converged. **Set `method = "newton"`** and run again.',
      starter: `import numpy as np
rng = np.random.default_rng(39)
x = 10 * rng.random(80)                                     # raw scale: a stretched loss surface
y = (rng.random(80) < 1 / (1 + np.exp(-(-4 + 0.8 * x)))).astype(float)
X = np.column_stack([np.ones(80), x])
nll = lambda t: np.mean(np.logaddexp(0, X @ t) - y * (X @ t))

method = "gd"             # "gd": gradient descent with a line search; "newton": Newton's method
steps = 10
theta = np.zeros(2)
for _ in range(steps):
    p = 1 / (1 + np.exp(-(X @ theta))); g = X.T @ (p - y) / 80
    if method == "newton":
        theta = theta - np.linalg.solve(X.T @ (X * (p * (1 - p))[:, None]) / 80, g)
    else:
        lr = 1.0
        while nll(theta - lr * g) > nll(theta) - 0.5 * lr * g @ g:
            lr /= 2
        theta = theta - lr * g
grad_norm = float(np.linalg.norm(X.T @ (1 / (1 + np.exp(-(X @ theta))) - y) / 80))
print(f"method = {method!r}, {steps} steps: theta = {np.round(theta, 3)}, gradient norm {grad_norm:.1e}")`,
      probe: ['grad_norm', 'steps'],
      evaluate: evaluateNewton,
      done: 'Newton pays d³ per step for this; with many features, L-BFGS approximates the curvature cheaply.',
    },
    {
      id: 'fill', kind: 'function', title: 'Fill in the Poisson gradient',
      prompt: 'Replace `___` with the gradient of the mean Poisson negative log-likelihood. X already has a column of ones.',
      starter: `import numpy as np

def poisson_grad(theta, X, y):
    """Gradient of mean(exp(X @ theta) - y * (X @ theta))."""
    return ___`,
      hint: 'The shared GLM gradient: Xᵀ(μ − y)/n with μ = exp(Xθ).',
      solution: 'return X.T @ (np.exp(X @ theta) - y) / len(y)',
      check: { fn: 'poisson_grad', args: ['theta', 'X', 'y'], cases: PG_CASES, describe: c => `theta [${c.theta.join(', ')}], ${c.y.length} rows`, diagnose: diagnosePg },
    },
    {
      id: 'repair', kind: 'function', title: 'Repair a planted bug',
      prompt: 'For points [0, 1, 2, 3] around a query at 0 with τ = 1 this returns weights **[1, 0.368, 0.018, 0.0001]**; the point at distance 1 = τ should get e^(−0.5) = 0.607. Fix it.',
      starter: `import numpy as np

def lwr_weights(x_train, x0, tau):
    """Gaussian weights of the training points for a query at x0."""
    return np.exp(-(x_train - x0) ** 2 / tau ** 2)`,
      hint: 'Compare with the formula exp(−(xᵢ − x)²/(2τ²)).',
      solution: 'return np.exp(-(x_train - x0) ** 2 / (2 * tau ** 2))',
      check: { fn: 'lwr_weights', args: ['xs', 'x0', 'tau'], cases: W_CASES, describe: c => `points [${c.xs.join(', ')}], query ${c.x0}, τ = ${c.tau}`, diagnose: diagnoseW },
      explainChoice: {
        prompt: 'The bug is equivalent to using a bandwidth of τ/√2. Why does that matter?',
        options: [
          { text: 'The effective bandwidth is smaller than the one chosen by cross-validation, so each fit uses fewer points: more variance, a wigglier curve — and the reported τ no longer means what it says.', correct: true },
          { text: 'It does not matter; any positive weights work.', feedback: 'The shape is right, but the scale sets the bias–variance trade-off.' },
          { text: 'It makes the weights sum to 1.', feedback: 'Neither version sums to 1; weighted least squares does not need it.' },
          { text: 'It only affects points exactly at the query.', feedback: 'The query point gets weight 1 either way; every other point is affected.' },
        ],
        rightFeedback: 'Constants in a kernel are part of what the tuned hyperparameter means.',
      },
    },
    {
      id: 'implement', kind: 'function', title: 'One Newton step for logistic regression',
      prompt: 'Write `newton_step` from its contract.',
      starter: `import numpy as np

def newton_step(theta, X, y):
    """One Newton step on the mean logistic loss: theta - H^{-1} g, with
    p = sigmoid(X @ theta), g = X.T @ (p - y) / n, H = X.T @ diag(p(1 - p)) @ X / n.

    Example: newton_step([0, 0], [[1, -1], [1, 0], [1, 1], [1, 2]], [0, 1, 0, 1])  ->  [-0.4, 0.8]
    """
    pass   # replace with your code`,
      hint: 'Build p, g and H as in the docstring; use np.linalg.solve(H, g).',
      solution: 'p = 1 / (1 + np.exp(-(X @ theta)))\ng = X.T @ (p - y) / len(y)\nH = X.T @ (X * (p * (1 - p))[:, None]) / len(y)\nreturn theta - np.linalg.solve(H, g)',
      check: { fn: 'newton_step', args: ['theta', 'X', 'y'], cases: NS_CASES, describe: c => `theta [${c.theta.join(', ')}], ${c.y.length} rows`, diagnose: diagnoseNs },
    },
    { id: 'transfer', kind: 'transfer', title: 'Solve new problems', prompt: 'New parameters, slopes and bandwidths. Solve one of each kind without opening the worked answer.' },
    { id: 'review', kind: 'review', title: 'Come back later', prompt: 'A fresh problem after a gap. The first return is suggested a day after you finish step 6; “Do it now” is always there and is recorded as early.' },
  ],
}
