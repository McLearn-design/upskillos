// Lab 41 runnable cells, typeset formulas and math ↔ code tables, keyed by lesson id.
// The coin and the sine data follow the playground (NumPy's own random draws); SciPy supplies Beta quantiles.

export const extras = {
  'l41-update': {
    formulaTex: '$$\\begin{aligned} p(\\theta \\mid D) &\\propto p(D \\mid \\theta)\\, p(\\theta) \\\\ \\mathrm{Beta}(a, b) &\\xrightarrow{h,\\ t} \\mathrm{Beta}(a + h,\\ b + t) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$p(D \\mid \\theta)$', 'grid ** h * (1 - grid) ** t', 'The likelihood of h heads and t tails.'],
        ['$p(\\theta)$', 'beta.pdf(grid, a, b)', 'The prior.'],
        ['$\\mathrm{Beta}(a+h, b+t)$', 'A, B = A + f, B + (1 - f)', 'The conjugate update, one flip at a time or all at once.'],
      ],
    },
    notebook: {
      title: 'Lab 41.1 · Parameters as uncertain quantities',
      intro: 'The Beta–binomial update, batch and sequential, checked against likelihood × prior on a grid.',
      cells: [
        {
          title: 'The conjugate update',
          prose: '**Predict** whether updating one flip at a time gives the same posterior.',
          code: `import numpy as np
from scipy.stats import beta
rng = np.random.default_rng(41)
flips = (rng.random(10) < 0.7).astype(int)                  # a coin with P(heads) = 0.7
a, b = 2, 2                                                 # prior Beta(2, 2): like 1 head and 1 tail already seen
h, t = flips.sum(), len(flips) - flips.sum()
print(f"flips {flips.tolist()}: {h} heads, {t} tails -> posterior Beta({a + h}, {b + t})")

A, B = a, b
for f in flips:                                             # one flip at a time: yesterday's posterior is today's prior
    A, B = A + f, B + (1 - f)
print(f"updating one flip at a time gives Beta({A}, {B}) — the same")

grid = np.linspace(0.001, 0.999, 999)
unnorm = grid ** h * (1 - grid) ** t * beta.pdf(grid, a, b)  # likelihood x prior on a grid
unnorm /= unnorm.sum() * (grid[1] - grid[0])
print(f"largest gap between likelihood x prior (normalized) and the Beta({a + h}, {b + t}) density: {np.max(np.abs(unnorm - beta.pdf(grid, a + h, b + t))):.1e}")`,
        },
      ],
    },
  },
  'l41-summaries': {
    formulaTex: '$$\\begin{aligned} \\text{mean} &= \\tfrac{A}{A + B} = P(\\text{next} = 1 \\mid D) \\\\ \\text{mode} &= \\tfrac{A - 1}{A + B - 2} \\end{aligned}$$',
    mathCode: {
      rows: [
        ['mean, mode', 'A / (A + B), (A - 1) / (A + B - 2)', 'Posterior summaries of Beta(A, B).'],
        ['credible interval', 'beta.ppf([0.025, 0.975], A, B)', 'Holds 95% of the posterior probability.'],
        ['Laplace’s rule', '(5 + 1) / (5 + 2)', 'Posterior predictive after 5 successes, uniform prior.'],
      ],
    },
    notebook: {
      title: 'Lab 41.2 · Summaries, intervals and predictions',
      intro: 'Mean, mode and interval; Laplace’s rule; prior sensitivity with 3 and 30 flips; and what a credible interval promises.',
      cells: [
        {
          title: 'Summaries and sensitivity',
          prose: '**Predict** whether the three priors still disagree after 30 flips.',
          code: `import numpy as np
from scipy.stats import beta
A, B = 9, 5                                                 # the posterior after 7 heads and 3 tails from Beta(2, 2)
print(f"mean {A / (A + B):.4f}, mode (MAP) {(A - 1) / (A + B - 2):.4f}, median {beta.median(A, B):.4f}")
print(f"95% credible interval [{beta.ppf(0.025, A, B):.3f}, {beta.ppf(0.975, A, B):.3f}]")
print(f"Laplace's rule, 5 successes in 5 trials with a uniform prior: next succeeds with {(5 + 1) / (5 + 2):.4f} (maximum likelihood says 1)")

# Prior sensitivity: 3 flips (2 heads) against 30 flips (20 heads), under three priors.
for n_h, n_t in [(2, 1), (20, 10)]:
    row = [f"Beta({a},{b}) -> {(a + n_h) / (a + b + n_h + n_t):.3f}" for a, b in [(1, 1), (2, 2), (20, 20)]]
    print(f"{n_h} heads, {n_t} tails: posterior means " + "; ".join(row))

# What a 95% credible interval promises: over coins drawn FROM THE PRIOR, it contains the true bias 95% of the time.
rng = np.random.default_rng(0); hits = 0
for _ in range(20000):
    p = rng.beta(2, 2); k = rng.binomial(10, p)
    hits += beta.ppf(0.025, 2 + k, 12 - k) <= p <= beta.ppf(0.975, 2 + k, 12 - k)
print(f"coverage over 20,000 coins drawn from the prior: {hits / 20000:.3f}")`,
        },
      ],
    },
  },
  'l41-map': {
    formulaTex: '$$\\begin{aligned} -\\log p(w \\mid D) &= \\tfrac{1}{2\\sigma^2}\\lVert y - Xw\\rVert^2 + \\tfrac{1}{2\\tau^2}\\lVert w\\rVert^2 + c \\\\ \\Rightarrow\\ \\lambda &= \\sigma^2/\\tau^2 \\end{aligned}$$',
    mathCode: {
      rows: [
        ['neg. log posterior', 'np.sum((y - X @ w) ** 2) / (2 * sigma ** 2) + np.sum(w ** 2) / (2 * tau ** 2)', 'Squared error plus the Gaussian prior.'],
        ['$\\lambda$', 'sigma ** 2 / tau ** 2', 'The ridge penalty it implies.'],
        ['Laplace prior', 'Lasso(alpha=sigma ** 2 / (n * b))', 'The same objective with an L1 penalty, rescaled.'],
      ],
    },
    notebook: {
      title: 'Lab 41.3 · Regularization is a prior',
      intro: 'MAP by numerical minimization against the ridge formula, and the Laplace prior’s exact zeros.',
      cells: [
        {
          title: 'MAP equals ridge',
          prose: '**Predict** how many of the five lasso weights come out exactly zero.',
          code: `import numpy as np
from scipy.optimize import minimize
rng = np.random.default_rng(3)
X = rng.normal(size=(30, 5)); w_true = np.array([1.5, 0, -2, 0, 0.5]); y = X @ w_true + 0.5 * rng.normal(size=30)
sigma, tau = 0.5, 2.0
neg_log_post = lambda w: np.sum((y - X @ w) ** 2) / (2 * sigma ** 2) + np.sum(w ** 2) / (2 * tau ** 2)
w_map = minimize(neg_log_post, np.zeros(5)).x
lam = sigma ** 2 / tau ** 2
w_ridge = np.linalg.solve(X.T @ X + lam * np.eye(5), X.T @ y)
print(f"lambda = sigma^2 / tau^2 = {lam}")
print("MAP by numerical minimization:", np.round(w_map, 4))
print("ridge closed form:            ", np.round(w_ridge, 4))

# A Laplace prior gives the lasso: its sharp peak at zero sets weights exactly to 0.
from sklearn.linear_model import Lasso
b = 0.05                                                    # Laplace scale: small b = strong belief in zeros
lasso = Lasso(alpha=sigma ** 2 / (len(y) * b), fit_intercept=False).fit(X, y)   # the same objective, rescaled by 1/(n sigma^2)
print("Laplace-prior MAP (lasso):    ", np.round(lasso.coef_, 4), "— zeros where the true weights are 0")`,
        },
      ],
    },
  },
  'l41-blr': {
    formulaTex: '$$\\begin{aligned} S^{-1} &= \\alpha I + \\beta \\Phi^\\top\\Phi, \\qquad m = \\beta S \\Phi^\\top y \\\\ \\mathrm{Var}(y_\\ast) &= 1/\\beta + \\phi_\\ast^\\top S\\, \\phi_\\ast \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$S$', 'np.linalg.inv(alpha * np.eye(10) + beta_ * Phi.T @ Phi)', 'Posterior covariance of the weights.'],
        ['$m$', 'beta_ * S @ Phi.T @ y', 'Posterior mean: the ridge solution.'],
        ['$\\phi_\\ast^\\top S \\phi_\\ast$', 'np.einsum("ij,jk,ik->i", F, S, F)', 'Uncertainty about the weights, seen at a new input.'],
      ],
    },
    notebook: {
      title: 'Lab 41.4 · Bayesian linear regression',
      intro: 'The weight posterior for six sine points, and the predictive spread among the data, in a gap and beyond.',
      cells: [
        {
          title: 'The posterior and its predictions',
          prose: '**Predict** where the predictive spread is largest.',
          code: `import numpy as np
rng = np.random.default_rng(41)
x = rng.random(6); y = np.sin(2 * np.pi * x) + 0.25 * rng.normal(size=6)
phi = lambda x: np.column_stack([np.ones_like(x)] + [np.exp(-(x - c) ** 2 / (2 * 0.1 ** 2)) for c in np.linspace(0, 1, 9)])
alpha, beta_ = 0.1, 1 / 0.25 ** 2
Phi = phi(x)
S = np.linalg.inv(alpha * np.eye(10) + beta_ * Phi.T @ Phi)         # posterior covariance
m = beta_ * S @ Phi.T @ y                                           # posterior mean
ridge = np.linalg.solve(Phi.T @ Phi + (alpha / beta_) * np.eye(10), Phi.T @ y)
print(f"posterior mean equals ridge with lambda = alpha/beta: largest difference {np.abs(m - ridge).max():.1e}")

xo = np.sort(x); g = np.argmax(np.diff(xo))                  # the widest gap between observations
xs = np.array([np.median(x), 0.5 * (xo[g] + xo[g + 1]), 1.2])
F = phi(xs)
var_w = np.einsum("ij,jk,ik->i", F, S, F)
print("observations at", np.round(xo, 2))
for label, xi, v in zip(["among the data", "in the widest gap", "beyond the data"], xs, var_w):
    print(f"x = {xi:.2f} ({label}): predictive sd {np.sqrt(1 / beta_ + v):.3f} (noise alone {np.sqrt(1 / beta_):.3f}; weight uncertainty adds variance {v:.4f})")
draws = rng.multivariate_normal(m, S, 5000) @ F.T              # functions drawn from the posterior, at the same inputs
print("spread of 5,000 posterior functions there:", np.round(draws.std(axis=0), 3), "— the weight-uncertainty part of the sd")`,
        },
      ],
    },
  },
  'l41-evidence': {
    formulaTex: '$$\\begin{aligned} p(D \\mid M) &= \\textstyle\\int p(D \\mid \\theta, M)\\, p(\\theta \\mid M)\\, d\\theta \\\\ \\mathrm{BF} &= p(D \\mid M_1) / p(D \\mid M_2) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['log evidence', 'M/2 log α + N/2 log β − E − ½ log|A| − N/2 log 2π', 'Closed form for Bayesian linear regression.'],
        ['BF', '(1 / 11) / 0.5 ** 10', 'The coin’s Bayes factor.'],
        ['empirical Bayes', 'max(alphas, key=...)', 'The prior precision the data make most probable.'],
      ],
    },
    notebook: {
      title: 'Lab 41.5 · Model evidence and Occam’s razor',
      intro: 'Evidence, training error and test error across polynomial degrees; a Bayes factor; α by empirical Bayes.',
      cells: [
        {
          title: 'Evidence against degree',
          prose: '**Predict** the degree with the highest evidence.',
          code: `import numpy as np
from math import comb
rng = np.random.default_rng(41)
def data(n, seed):
    r = np.random.default_rng(seed); x = r.random(n); return x, np.sin(2 * np.pi * x) + 0.25 * r.normal(size=n)
x, y = data(10, 41); xt, yt = data(500, 999)
alpha, beta_ = 5e-3, 16.0
def log_evidence(Phi, y, alpha, beta_):
    N, M = Phi.shape; A = alpha * np.eye(M) + beta_ * Phi.T @ Phi; m = beta_ * np.linalg.solve(A, Phi.T @ y)
    E = beta_ / 2 * np.sum((y - Phi @ m) ** 2) + alpha / 2 * m @ m
    return M / 2 * np.log(alpha) + N / 2 * np.log(beta_) - E - 0.5 * np.linalg.slogdet(A)[1] - N / 2 * np.log(2 * np.pi)
poly = lambda x, d: np.column_stack([(2 * x - 1) ** k for k in range(d + 1)])
print("degree  log evidence  train RMSE  test RMSE")
for d in range(10):
    w = np.linalg.lstsq(poly(x, d), y, rcond=None)[0]
    rm = lambda xx, yy: np.sqrt(np.mean((poly(xx, d) @ w - yy) ** 2))
    print(f"  {d}       {log_evidence(poly(x, d), y, alpha, beta_):7.1f}      {rm(x, y):.2f}       {rm(xt, yt):.2f}")

print(f"\\ncoin, 10 heads in 10 flips: evidence fair {0.5 ** 10:.6f}, uniform prior on the bias {1 / 11:.6f}; Bayes factor {(1 / 11) / 0.5 ** 10:.1f}")
alphas = 10.0 ** np.arange(-4, 2.1, 0.25)
best = max(alphas, key=lambda a: log_evidence(poly(x, 3), y, a, beta_))
print(f"empirical Bayes for degree 3: the evidence is highest at alpha = {best:.4g}")`,
        },
      ],
    },
  },
}
