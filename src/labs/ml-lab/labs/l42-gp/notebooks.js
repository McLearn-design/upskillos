// Lab 42 runnable cells, typeset formulas and math ↔ code tables, keyed by lesson id.
// The observations follow the playground's target and gap (NumPy's own draws); scikit-learn's GaussianProcessRegressor is the reference.

export const extras = {
  'l42-functions': {
    formulaTex: '$$\\begin{aligned} (f(x_1), \\dots, f(x_n)) &\\sim \\mathcal{N}(0, K), \\quad K_{ij} = k(x_i, x_j) \\\\ k(x, x^\\prime) &= \\phi(x)^\\top\\phi(x^\\prime)/\\alpha \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$k(x, x^\\prime)$', '2 * 3 / alpha', 'The linear kernel: weight space integrated out.'],
        ['$K$', 'rbf(grid, grid, ell=0.1)', 'Gram matrix of the RBF kernel on a grid.'],
        ['$f \\sim \\mathcal{N}(0, K)$', 'L @ rng.normal(size=(101, 3))', 'Functions drawn from the prior (L is the Cholesky factor).'],
      ],
    },
    notebook: {
      title: 'Lab 42.1 · From weights to functions',
      intro: 'The linear kernel recovered from weight draws, and functions drawn from an RBF prior.',
      cells: [
        {
          title: 'Weights to functions',
          prose: '**Predict** Cov[f(2), f(3)] from 200,000 weight draws.',
          code: `import numpy as np
def rbf(a, b, ell=0.2, sf=1.0):
    return sf ** 2 * np.exp(-(a[:, None] - b[None, :]) ** 2 / (2 * ell ** 2))
def target(x):
    return np.sin(2 * np.pi * x) + 0.4 * np.cos(6 * np.pi * x) * x
def observations(n=14, seed=42, noise=0.1):
    """The playground's data: noisy values of the target, with no points between 0.45 and 0.7."""
    rng = np.random.default_rng(seed); xs = []
    while len(xs) < n:
        x = rng.random()
        if not 0.45 < x < 0.7: xs.append(x)
    xs = np.array(xs)
    return xs, target(xs) + noise * rng.normal(size=n)

import numpy as np
# Weight space: f(x) = w x with w ~ N(0, 1/alpha). Function space: Cov[f(x), f(x')] = x x' / alpha.
alpha = 4.0
w = np.random.default_rng(0).normal(0, 1 / np.sqrt(alpha), 200000)
print(f"Cov[f(2), f(3)] from 200,000 weight draws {np.cov(w * 2, w * 3)[0, 1]:.3f}; kernel 2 x 3 / alpha = {2 * 3 / alpha:.3f}")

# The RBF kernel has no finite feature vector, but its Gram matrix is still a valid covariance: draw functions from it.
grid = np.linspace(0, 1, 101)
K = rbf(grid, grid, ell=0.1)
L = np.linalg.cholesky(K + 1e-8 * np.eye(101))                 # a little jitter for numerical safety
f = L @ np.random.default_rng(1).normal(size=(101, 3))         # three functions from the prior
print("three prior functions at x = 0, 0.5, 1:\\n", np.round(f[[0, 50, 100]], 2))
print(f"correlation of neighbouring grid values (0.01 apart): {np.corrcoef(f[:-1, 0], f[1:, 0])[0, 1]:.3f} — smooth")`,
        },
      ],
    },
  },
  'l42-kernels': {
    formulaTex: '$$\\begin{aligned} k_{\\mathrm{RBF}} &= \\sigma_f^2 e^{-(x - x^\\prime)^2/2\\ell^2} \\\\ k_{\\mathrm{M}3/2} &= \\sigma_f^2\\big(1 + \\tfrac{\\sqrt3 r}{\\ell}\\big)e^{-\\sqrt3 r/\\ell} \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\ell$', 'ell', 'Length scale: correlation e^(−1/2) at distance ℓ.'],
        ['sum, product', 'rbf(x, x) + periodic(x, x), rbf(x, x) * periodic(x, x)', 'Still valid kernels.'],
        ['validity', 'np.linalg.eigvalsh(K).min() >= 0', 'Every Gram matrix positive semidefinite.'],
      ],
    },
    notebook: {
      title: 'Lab 42.2 · Choosing and combining kernels',
      intro: 'Correlations by distance, and the smallest eigenvalue of six Gram matrices — one of them not a kernel.',
      cells: [
        {
          title: 'Which similarities are kernels?',
          prose: '**Predict** which of the six matrices has a negative eigenvalue.',
          code: `import numpy as np
def rbf(a, b, ell=0.2, sf=1.0):
    return sf ** 2 * np.exp(-(a[:, None] - b[None, :]) ** 2 / (2 * ell ** 2))
def target(x):
    return np.sin(2 * np.pi * x) + 0.4 * np.cos(6 * np.pi * x) * x
def observations(n=14, seed=42, noise=0.1):
    """The playground's data: noisy values of the target, with no points between 0.45 and 0.7."""
    rng = np.random.default_rng(seed); xs = []
    while len(xs) < n:
        x = rng.random()
        if not 0.45 < x < 0.7: xs.append(x)
    xs = np.array(xs)
    return xs, target(xs) + noise * rng.normal(size=n)

import numpy as np
ell = 0.5
print("RBF correlation at distances ell, 2 ell, 3 ell:", np.round(np.exp(-np.array([1, 4, 9]) / 2), 4))
x = np.linspace(0, 1, 40)
def matern32(a, b, ell=0.2):
    r = np.sqrt(3) * np.abs(a[:, None] - b[None, :]) / ell; return (1 + r) * np.exp(-r)
def periodic(a, b, ell=1.0, period=0.5):
    return np.exp(-2 * np.sin(np.pi * np.abs(a[:, None] - b[None, :]) / period) ** 2 / ell ** 2)
candidates = {
    "RBF": rbf(x, x), "Matérn 3/2": matern32(x, x), "periodic": periodic(x, x),
    "RBF + periodic (sum)": rbf(x, x) + periodic(x, x), "RBF × periodic (product)": rbf(x, x) * periodic(x, x),
    "1 − (x − x′)² (not a kernel)": 1 - (x[:, None] - x[None, :]) ** 2,
}
for name, K in candidates.items():
    lo = np.linalg.eigvalsh(K).min()
    print(f"{name:30s} smallest eigenvalue {lo:+.2e}  {'valid (zero up to rounding)' if lo > -1e-10 else 'INVALID: a negative variance'}")
print("periodic kernel: k(0.1, 0.6) =", round(float(periodic(np.array([0.1]), np.array([0.6]))[0, 0]), 6), "— one period apart, perfectly correlated")`,
        },
      ],
    },
  },
  'l42-regression': {
    formulaTex: '$$\\begin{aligned} \\mu_\\ast &= k_\\ast^\\top (K + \\sigma_n^2 I)^{-1} y \\\\ \\sigma_\\ast^2 &= k(x_\\ast, x_\\ast) - k_\\ast^\\top (K + \\sigma_n^2 I)^{-1} k_\\ast \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$K + \\sigma_n^2 I$', 'rbf(X, X) + sn ** 2 * np.eye(len(X))', 'Covariance of the noisy observations.'],
        ['$(K + \\sigma_n^2I)^{-1}y$', 'np.linalg.solve(L.T, np.linalg.solve(L, y))', 'Two triangular solves with the Cholesky factor.'],
        ['$\\sigma_\\ast^2$', '1.0 - np.sum(V ** 2, axis=0)', 'Prior variance minus what the data explain.'],
      ],
    },
    notebook: {
      title: 'Lab 42.3 · Regression by conditioning',
      intro: 'The posterior among the data, in the gap and beyond — checked against scikit-learn.',
      cells: [
        {
          title: 'The posterior by Cholesky',
          prose: '**Predict** where the posterior sd is largest.',
          code: `import numpy as np
def rbf(a, b, ell=0.2, sf=1.0):
    return sf ** 2 * np.exp(-(a[:, None] - b[None, :]) ** 2 / (2 * ell ** 2))
def target(x):
    return np.sin(2 * np.pi * x) + 0.4 * np.cos(6 * np.pi * x) * x
def observations(n=14, seed=42, noise=0.1):
    """The playground's data: noisy values of the target, with no points between 0.45 and 0.7."""
    rng = np.random.default_rng(seed); xs = []
    while len(xs) < n:
        x = rng.random()
        if not 0.45 < x < 0.7: xs.append(x)
    xs = np.array(xs)
    return xs, target(xs) + noise * rng.normal(size=n)

import numpy as np
X, y = observations()
sn, xs = 0.1, np.array([0.3, 0.575, 1.05])            # among the data, in the gap, beyond the data
Ky = rbf(X, X) + sn ** 2 * np.eye(len(X))
L = np.linalg.cholesky(Ky)
alpha_vec = np.linalg.solve(L.T, np.linalg.solve(L, y))    # (K + sn^2 I)^-1 y by two triangular solves
Ks = rbf(xs, X)
mean = Ks @ alpha_vec
V = np.linalg.solve(L, Ks.T)
var = 1.0 - np.sum(V ** 2, axis=0)                          # k(x*, x*) = 1 for this kernel
for x0, m, v in zip(xs, mean, var):
    print(f"x* = {x0:.3f}: mean {m:+.3f}, sd {np.sqrt(v):.3f}, true value {target(x0):+.3f}")

from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF
gp = GaussianProcessRegressor(RBF(0.2), alpha=sn ** 2, optimizer=None).fit(X[:, None], y)
m2, s2 = gp.predict(xs[:, None], return_std=True)
print(f"scikit-learn: largest difference in mean {np.abs(m2 - mean).max():.1e}, in sd {np.abs(s2 - np.sqrt(var)).max():.1e}")`,
        },
      ],
    },
  },
  'l42-hyper': {
    formulaTex: '$$\\log p(y \\mid \\theta) = -\\tfrac12 y^\\top K_y^{-1} y - \\tfrac12 \\log\\lvert K_y\\rvert - \\tfrac n2 \\log 2\\pi$$',
    mathCode: {
      rows: [
        ['$-\\tfrac12 y^\\top K_y^{-1}y$', '-0.5 * y @ a', 'Fit.'],
        ['$-\\tfrac12\\log|K_y|$', '-np.sum(np.log(np.diag(L)))', 'Complexity penalty, from the Cholesky diagonal.'],
        ['optimizer', 'GaussianProcessRegressor(..., n_restarts_optimizer=5)', 'scikit-learn maximizes it from several starts.'],
      ],
    },
    notebook: {
      title: 'Lab 42.4 · Hyperparameters from the marginal likelihood',
      intro: 'The log marginal likelihood over a grid of length scales, checked against scikit-learn and its optimizer.',
      cells: [
        {
          title: 'Choosing the length scale',
          prose: '**Predict** whether scikit-learn’s optimizer lands near the best grid value.',
          code: `import numpy as np
def rbf(a, b, ell=0.2, sf=1.0):
    return sf ** 2 * np.exp(-(a[:, None] - b[None, :]) ** 2 / (2 * ell ** 2))
def target(x):
    return np.sin(2 * np.pi * x) + 0.4 * np.cos(6 * np.pi * x) * x
def observations(n=14, seed=42, noise=0.1):
    """The playground's data: noisy values of the target, with no points between 0.45 and 0.7."""
    rng = np.random.default_rng(seed); xs = []
    while len(xs) < n:
        x = rng.random()
        if not 0.45 < x < 0.7: xs.append(x)
    xs = np.array(xs)
    return xs, target(xs) + noise * rng.normal(size=n)

import numpy as np
X, y = observations()
def lml(ell, sn=0.1, sf=1.0):
    Ky = rbf(X, X, ell, sf) + sn ** 2 * np.eye(len(X)); L = np.linalg.cholesky(Ky)
    a = np.linalg.solve(L.T, np.linalg.solve(L, y))
    return -0.5 * y @ a - np.sum(np.log(np.diag(L))) - len(X) / 2 * np.log(2 * np.pi)
ells = [0.02, 0.03, 0.05, 0.07, 0.1, 0.14, 0.2, 0.3, 0.5, 1]
scores = {e: lml(e) for e in ells}
print("log marginal likelihood by length scale:", {e: round(v, 1) for e, v in scores.items()})
print("best on the grid: ell =", max(scores, key=scores.get))

from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF
gp = GaussianProcessRegressor(RBF(0.2), alpha=0.01, optimizer=None).fit(X[:, None], y)
print(f"scikit-learn's value at ell = 0.2: {gp.log_marginal_likelihood_value_:.3f} (ours {scores[0.2]:.3f})")
opt = GaussianProcessRegressor(RBF(0.2, (1e-2, 10)), alpha=0.01, n_restarts_optimizer=5, random_state=0).fit(X[:, None], y)
print(f"scikit-learn's optimizer: ell = {opt.kernel_.length_scale:.3f}, log marginal likelihood {opt.log_marginal_likelihood_value_:.3f}")`,
        },
      ],
    },
  },
  'l42-uses': {
    formulaTex: '$$a(x) = \\mu(x) + \\kappa\\,\\sigma(x)$$',
    mathCode: {
      rows: [
        ['$a(x)$', 'mean + 2 * sd', 'Upper confidence bound with κ = 2.'],
        ['next point', 'grid[np.argmax(mean + 2 * sd)]', 'Measure where the bound is highest.'],
        ['$O(n^3)$', 'np.linalg.cholesky(A)', 'The cost that limits exact GPs.'],
      ],
    },
    notebook: {
      title: 'Lab 42.5 · Where GPs shine — and where they do not',
      intro: 'Bayesian optimization of an “expensive” function, and how the Cholesky time grows with n.',
      cells: [
        {
          title: 'Bayesian optimization and scaling',
          prose: '**Predict** how many evaluations the search needs to find the peak.',
          code: `import numpy as np
def rbf(a, b, ell=0.2, sf=1.0):
    return sf ** 2 * np.exp(-(a[:, None] - b[None, :]) ** 2 / (2 * ell ** 2))
def target(x):
    return np.sin(2 * np.pi * x) + 0.4 * np.cos(6 * np.pi * x) * x
def observations(n=14, seed=42, noise=0.1):
    """The playground's data: noisy values of the target, with no points between 0.45 and 0.7."""
    rng = np.random.default_rng(seed); xs = []
    while len(xs) < n:
        x = rng.random()
        if not 0.45 < x < 0.7: xs.append(x)
    xs = np.array(xs)
    return xs, target(xs) + noise * rng.normal(size=n)

import numpy as np
# Bayesian optimization of an expensive function on [0, 1]: fit a GP, measure where mean + 2 sd is highest.
f = lambda x: target(x)                                     # pretend each evaluation costs an hour
grid = np.linspace(0, 1, 401)
X = np.array([0.1, 0.9]); y = f(X)
for step in range(8):
    Ky = rbf(X, X) + 1e-6 * np.eye(len(X)); L = np.linalg.cholesky(Ky)
    Ks = rbf(grid, X); mean = Ks @ np.linalg.solve(L.T, np.linalg.solve(L, y))
    sd = np.sqrt(np.clip(1 - np.sum(np.linalg.solve(L, Ks.T) ** 2, axis=0), 0, None))
    x_next = grid[np.argmax(mean + 2 * sd)]                  # upper confidence bound, kappa = 2
    X, y = np.append(X, x_next), np.append(y, f(x_next))
print("points measured, in order:", np.round(X, 3), "— two exploratory probes, then it closes in on the peak")
print(f"best found {y.max():.3f} at x = {X[np.argmax(y)]:.3f}; true maximum {f(grid).max():.3f} at x = {grid[np.argmax(f(grid))]:.3f}, after {len(X)} evaluations")

import time
for n in (500, 1000, 2000):
    A = rbf(np.linspace(0, 1, n), np.linspace(0, 1, n), 0.05) + 0.01 * np.eye(n)
    t0 = time.perf_counter(); np.linalg.cholesky(A); t = time.perf_counter() - t0
    print(f"Cholesky of a {n} x {n} kernel matrix: {t * 1000:.1f} ms")`,
        },
      ],
    },
  },
}
