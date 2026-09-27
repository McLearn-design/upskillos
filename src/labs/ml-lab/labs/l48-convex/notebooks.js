// Lab 48 runnable cells, typeset formulas and math ↔ code tables, keyed by lesson id.
// The constrained quadratic, the two-class SVM data and the lasso problem follow the playground; SciPy and scikit-learn are the references.

export const extras = {
  'l48-convexity': {
    formulaTex: '$$\\begin{aligned} f(tx + (1-t)y) &\\le t f(x) + (1-t) f(y) \\\\ \\nabla^2 f &\\succeq 0 \\ \\ (\\text{twice differentiable}) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['chord test', 'f(t * x + (1 - t) * y) > t * f(x) + (1 - t) * f(y)', 'One violation disproves convexity.'],
        ['$\\nabla^2 f$', 'X.T @ (X * (p * (1 - p))[:, None]) / n', 'The logistic loss’s Hessian: positive semidefinite.'],
      ],
    },
    notebook: {
      title: 'Lab 48.1 · Convex sets and functions',
      intro: 'The chord test on five losses, and the logistic-regression Hessian.',
      cells: [
        {
          title: 'Which losses are convex?',
          prose: '**Predict** which of the five fail the chord test.',
          code: `import numpy as np
rng = np.random.default_rng(48)
def chord_violations(f, lo=-3, hi=3, trials=20000):
    """Count random (x, y, t) where f(tx + (1-t)y) > t f(x) + (1-t) f(y): any count above 0 disproves convexity."""
    x, y, t = rng.uniform(lo, hi, trials), rng.uniform(lo, hi, trials), rng.random(trials)
    return int(np.sum(f(t * x + (1 - t) * y) > t * f(x) + (1 - t) * f(y) + 1e-12))
losses = {"squared (z - 1)^2": lambda z: (z - 1) ** 2, "logistic log(1 + e^-z)": lambda z: np.logaddexp(0, -z),
          "hinge max(0, 1 - z)": lambda z: np.maximum(0, 1 - z), "sin(z) (not convex)": np.sin,
          "a one-hidden-unit network's loss in its weight": lambda w: (np.tanh(2 * w) * np.tanh(-w) - 0.5) ** 2}
for name, f in losses.items():
    print(f"{name:46s} chord violations: {chord_violations(f)}")

# The logistic-regression loss in its weights: the Hessian X^T diag(p(1-p)) X / n is positive semidefinite everywhere.
X = rng.normal(size=(50, 3)); w = rng.normal(size=3); p = 1 / (1 + np.exp(-X @ w))
print("smallest Hessian eigenvalue at a random w:", round(float(np.linalg.eigvalsh(X.T @ (X * (p * (1 - p))[:, None]) / 50).min()), 4))`,
        },
      ],
    },
  },
  'l48-kkt': {
    formulaTex: '$$\\begin{aligned} L(x, \\lambda) &= f(x) + \\lambda g(x) \\\\ \\nabla f + \\lambda\\nabla g &= 0,\\ \\ g \\le 0,\\ \\ \\lambda \\ge 0,\\ \\ \\lambda g = 0 \\end{aligned}$$',
    mathCode: {
      rows: [
        ['numerical optimum', 'minimize(..., constraints=[{"type": "ineq", ...}], method="SLSQP")', 'SciPy’s constrained solver.'],
        ['$\\lambda$', 'a[0] + a[1] - b', 'The multiplier, from stationarity on the boundary.'],
        ['shadow price', 'f2 - f ≈ -0.1 * lam', 'How the optimum moves as b is relaxed.'],
      ],
    },
    notebook: {
      title: 'Lab 48.2 · Lagrange multipliers and KKT conditions',
      intro: 'The constrained quadratic solved numerically and by KKT, with the shadow price checked.',
      cells: [
        {
          title: 'KKT by hand and by solver',
          prose: '**Predict** f* after raising b from 1 to 1.1.',
          code: `import numpy as np
from scipy.optimize import minimize
a = np.array([2.0, 1.0])
def solve(b):
    """minimize ||x - a||^2 subject to x1 + x2 <= b, numerically."""
    res = minimize(lambda x: np.sum((x - a) ** 2), np.zeros(2), constraints=[{"type": "ineq", "fun": lambda x: b - x[0] - x[1]}], method="SLSQP")
    return res.x, res.fun
x, f = solve(1.0)
lam = a[0] + a[1] - 1.0                                     # KKT: 2(x - a) + lam (1, 1) = 0 on the boundary gives lam = a1 + a2 - b
print(f"numerical optimum x = {np.round(x, 4)}, f* = {f:.4f}; KKT gives x = a - lam/2 (1, 1) = {a - lam / 2}, lam = {lam}")
print(f"stationarity 2(x - a) + lam (1, 1) = {np.round(2 * (x - a) + lam, 6) + 0.0}; complementary slackness lam (x1 + x2 - b) = {lam * (x.sum() - 1):.1e}")
_, f2 = solve(1.1)
print(f"shadow price: raising b by 0.1 changes f* by {f2 - f:+.4f}; -0.1 lam = {-0.1 * lam:+.4f}")
x_in, f_in = solve(4.0)
print(f"with b = 4 the unconstrained minimum a is feasible: x = {np.round(x_in, 4)}, f* = {f_in:.1e}, lam = 0")`,
        },
      ],
    },
  },
  'l48-duality': {
    formulaTex: '$$\\begin{aligned} d(\\lambda) &= \\min_x L(x, \\lambda) \\\\ d(\\lambda) &\\le f(x) \\ \\ (\\text{feasible } x,\\ \\lambda \\ge 0) \\\\ \\max_\\lambda d &= \\min_x f \\ \\ (\\text{strong duality}) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$d(\\lambda)$', 'lam * (a.sum() - b) - lam ** 2 / 2', 'The dual function of the quadratic, in closed form.'],
        ['gap', 'f(x) - d(lam)', 'A certificate: the solution is at most this far from optimal.'],
      ],
    },
    notebook: {
      title: 'Lab 48.3 · Duality',
      intro: 'Weak duality over a grid of multipliers, strong duality at the optimum, and gaps as certificates.',
      cells: [
        {
          title: 'The dual of the quadratic',
          prose: '**Predict** the multiplier that maximizes d.',
          code: `import numpy as np
a, b = np.array([2.0, 1.0]), 1.0
# d(lam) = min_x ||x - a||^2 + lam (x1 + x2 - b): the minimizer is x = a - lam/2 (1, 1), so d(lam) = lam (a1 + a2 - b) - lam^2 / 2.
d = lambda lam: lam * (a.sum() - b) - lam ** 2 / 2
lams = np.linspace(0, 4, 401)
f_star = 2.0                                                  # from the KKT solution
feasible = np.array([[1.0, 0.0], [0.5, 0.5], [0.0, 0.0], [-1.0, 1.0]])
print("weak duality: every d(lam) is below every feasible f(x):", bool(d(lams).max() <= min(np.sum((x - a) ** 2) for x in feasible) + 1e-12))
print(f"best dual value {d(lams).max():.4f} at lam = {lams[d(lams).argmax()]:.2f}; primal optimum {f_star:.4f}: strong duality, gap 0")
for lam in [0.5, 1.5, 2.0]:
    print(f"  certificate with x = (1, 0) and lam = {lam}: gap f(x) - d(lam) = {np.sum((np.array([1.0, 0.0]) - a) ** 2) - d(lam):.4f}")`,
        },
      ],
    },
  },
  'l48-svm': {
    formulaTex: '$$\\begin{aligned} \\max_\\alpha\\ &\\textstyle\\sum_i\\alpha_i - \\tfrac12\\sum_{i,j}\\alpha_i\\alpha_j y_i y_j\\, k(x_i, x_j) \\\\ &0 \\le \\alpha_i \\le C,\\ \\ \\textstyle\\sum_i \\alpha_i y_i = 0 \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\alpha_i y_i$', 'svm.dual_coef_', 'scikit-learn stores the signed multipliers of the support vectors.'],
        ['$w$', '(alpha * y) @ X', 'The primal weights recovered from the dual.'],
        ['primal = dual', '0.5 * w @ w + C * hinge  vs  alpha.sum() - 0.5 * ...', 'Strong duality at the solution.'],
      ],
    },
    notebook: {
      title: 'Lab 48.4 · The SVM dual and SMO',
      intro: 'The dual read back from scikit-learn’s SVC: weights, support vectors, complementary slackness and both objectives.',
      cells: [
        {
          title: 'The SVM dual',
          prose: '**Predict** how many points strictly beyond the margin have α > 0.',
          code: `import numpy as np
from sklearn.svm import SVC
rng = np.random.default_rng(48)
y = np.where(np.arange(40) % 2, 1, -1)
X = np.column_stack([y * 1.1 + 0.6 * rng.normal(size=40), y * 0.7 + 0.6 * rng.normal(size=40)])   # the playground's two classes
for C in [0.01, 1, 50]:
    svm = SVC(kernel="linear", C=C, tol=1e-8).fit(X, y)
    alpha = np.zeros(40); alpha[svm.support_] = np.abs(svm.dual_coef_[0])     # dual_coef_ stores alpha_i y_i
    w = (alpha * y) @ X                                                         # w = sum alpha_i y_i x_i
    margin = y * (X @ w + svm.intercept_[0])
    dual = alpha.sum() - 0.5 * np.sum(np.outer(alpha * y, alpha * y) * (X @ X.T))
    primal = 0.5 * w @ w + C * np.sum(np.maximum(0, 1 - margin))
    print(f"C = {C:5}: support vectors {len(svm.support_):2d} (at alpha = C: {np.sum(alpha > C - 1e-6):2d}); "
          f"w from the dual {np.round(w, 3)} vs coef_ {np.round(svm.coef_[0], 3)}; primal {primal:.4f}, dual {dual:.4f}")
    beyond = margin > 1 + 1e-6
    print(f"          points strictly beyond the margin: {beyond.sum()}, all with alpha = 0: {bool(np.all(alpha[beyond] < 1e-8))}")`,
        },
      ],
    },
  },
  'l48-prox': {
    formulaTex: '$$\\begin{aligned} \\mathrm{prox}_{t\\lambda\\lvert\\cdot\\rvert}(v) &= \\mathrm{sign}(v)\\max(\\lvert v\\rvert - t\\lambda, 0) \\\\ w &\\leftarrow \\mathrm{prox}\\big(w - t\\nabla f(w)\\big) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['soft-threshold', 'np.sign(v) * np.maximum(np.abs(v) - t, 0)', 'Shrink toward 0; set small values exactly to 0.'],
        ['$t$', '1 / L', 'Step size from the gradient’s Lipschitz constant.'],
        ['reference', 'Lasso(alpha=lam, fit_intercept=False)', 'scikit-learn’s coordinate descent, the same objective.'],
      ],
    },
    notebook: {
      title: 'Lab 48.5 · Proximal methods and the optimizer toolbox',
      intro: 'ISTA against subgradient descent and scikit-learn’s Lasso on the playground’s problem.',
      cells: [
        {
          title: 'ISTA and the lasso',
          prose: '**Predict** how many exact zeros subgradient descent produces.',
          code: `import numpy as np
from sklearn.linear_model import Lasso
rng = np.random.default_rng(7)
n, d = 60, 30
beta = np.zeros(d); beta[:3] = [3, -2, 1.5]
X = rng.normal(size=(n, d)); y = X @ beta + 0.5 * rng.normal(size=n)
lam = 0.1
soft = lambda v, t: np.sign(v) * np.maximum(np.abs(v) - t, 0)
print("soft-threshold of (1.2, -0.3, 0.5) at 0.4:", soft(np.array([1.2, -0.3, 0.5]), 0.4) + 0.0)
L = np.linalg.eigvalsh(X.T @ X / n).max()                    # Lipschitz constant of the smooth part's gradient
obj = lambda w: np.sum((X @ w - y) ** 2) / (2 * n) + lam * np.abs(w).sum()
w = np.zeros(d)
for k in range(200):                                          # ISTA: a gradient step, then soft-thresholding
    w = soft(w - (X.T @ (X @ w - y) / n) / L, lam / L)
ws = np.zeros(d)
for k in range(200):                                          # subgradient descent with shrinking steps
    ws = ws - 0.5 / L / np.sqrt(k + 1) * (X.T @ (X @ ws - y) / n + lam * np.sign(ws))
sk = Lasso(alpha=lam, fit_intercept=False, tol=1e-12, max_iter=100000).fit(X, y)
print(f"objective: ISTA {obj(w):.8f}, scikit-learn {obj(sk.coef_):.8f}, subgradient {obj(ws):.8f}")
print(f"exact zeros: ISTA {np.sum(w == 0)}, scikit-learn {np.sum(sk.coef_ == 0)}, subgradient {np.sum(ws == 0)} of {d}")
print(f"largest coefficient difference ISTA vs scikit-learn: {np.abs(w - sk.coef_).max():.1e}")`,
        },
      ],
    },
  },
}
