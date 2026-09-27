// Lab 40 runnable cells, typeset formulas and math ↔ code tables, keyed by lesson id.
// The worlds are the playground's (same means and covariances, NumPy's own random draws); scikit-learn supplies the reference models in 40.4.

export const extras = {
  'l40-generative': {
    formulaTex: '$$p(y{=}1 \\mid x) = \\sigma\\Big(\\log\\frac{p(x \\mid 1)}{p(x \\mid 0)} + \\log\\frac{\\phi}{1 - \\phi}\\Big)$$',
    mathCode: {
      rows: [
        ['$p(x \\mid k)$', 'np.exp(log_gauss(X, m[k], S[k]))', 'How well class k’s model explains x.'],
        ['$\\phi$', 'y.mean()', 'How common class 1 is.'],
        ['$\\sigma(\\cdot)$', '1 / (1 + np.exp(-(...)))', 'Bayes’ rule, rewritten as a sigmoid of the log-odds.'],
      ],
    },
    notebook: {
      title: 'Lab 40.1 · Generative versus discriminative',
      intro: 'Bayes’ rule by hand, LDA against logistic regression, and sampling from the fitted model as a realism check.',
      cells: [
        {
          title: 'Bayes’ rule and a realism check',
          prose: '**Predict** whether samples from a Gaussian fit look like the far-subgroup class.',
          code: `import numpy as np
# The playground's worlds: two Gaussian classes (optionally with a far-away subgroup in class 1).
WORLDS = {
    "shared":    dict(m0=[-0.9, -0.4], m1=[0.9, 0.5], S0=[[1.1, 0.6], [0.6, 0.9]], S1=[[1.1, 0.6], [0.6, 0.9]], skew=False),
    "different": dict(m0=[0.0, 0.0],   m1=[0.6, 0.4], S0=[[0.25, 0], [0, 0.25]],   S1=[[2.2, 0.3], [0.3, 1.6]],   skew=False),
    "skewed":    dict(m0=[-0.9, -0.4], m1=[0.9, 0.5], S0=[[1.1, 0.6], [0.6, 0.9]], S1=[[1.1, 0.6], [0.6, 0.9]], skew=True),
}
def sample(world, n, seed):
    w, rng = WORLDS[world], np.random.default_rng(seed)
    y = (rng.random(n) < 0.5).astype(int)
    X = np.where(y[:, None] == 1, rng.multivariate_normal(w["m1"], w["S1"], n), rng.multivariate_normal(w["m0"], w["S0"], n))
    if w["skew"]:
        far = (y == 1) & (rng.random(n) < 0.3); X[far] += [5, 3]     # 30% of class 1 sits far away
    return X, y

def fit_gda(X, y, shared):
    phi = y.mean(); m = [X[y == k].mean(axis=0) for k in (0, 1)]
    S = [np.cov(X[y == k].T, bias=True) for k in (0, 1)]
    if shared:
        pooled = sum((y == k).mean() * S[k] for k in (0, 1))       # the pooled within-class covariance
        S = [pooled, pooled]
    return phi, m, [s + 1e-3 * np.eye(2) for s in S]

def log_gauss(X, m, S):
    d = X - m; P = np.linalg.inv(S)
    return -0.5 * np.einsum("ij,jk,ik->i", d, P, d) - 0.5 * np.log(np.linalg.det(S)) - np.log(2 * np.pi)

def posterior(model, X):
    phi, m, S = model
    return 1 / (1 + np.exp(-(log_gauss(X, m[1], S[1]) + np.log(phi) - log_gauss(X, m[0], S[0]) - np.log(1 - phi))))

# Bayes' rule by hand, then the same number as a sigmoid of the log-likelihood ratio.
p1, p0, phi = 0.3, 0.1, 0.25
direct = p1 * phi / (p1 * phi + p0 * (1 - phi))
as_sigmoid = 1 / (1 + np.exp(-(np.log(p1) - np.log(p0) + np.log(phi / (1 - phi)))))
print(f"p(class 1 | x) by Bayes' rule {direct:.4f}; as a sigmoid of the log-odds {as_sigmoid:.4f}")

X, y = sample("shared", 400, 1)
model = fit_gda(X, y, shared=True)
from sklearn.linear_model import LogisticRegression
Xt, yt = sample("shared", 4000, 999)
lr = LogisticRegression().fit(X, y)
print(f"shared world, 400 examples: LDA test error {np.mean((posterior(model, Xt) >= 0.5) != yt):.3f}, logistic regression {np.mean(lr.predict(Xt) != yt):.3f}")

# A generative model can generate: draw from the fitted class-1 Gaussian and compare with real class-1 points.
Xs, ys = sample("skewed", 2000, 2); m_sk = fit_gda(Xs, ys, shared=True)
fake = np.random.default_rng(0).multivariate_normal(m_sk[1][1], m_sk[2][1], 20000)
real = Xs[ys == 1]
gap = lambda pts: np.mean((pts[:, 0] > 1.8) & (pts[:, 0] < 3.2))          # the valley between class 1's two clumps
print(f"far-subgroup world, share of class-1 points with 1.8 < x1 < 3.2: real {gap(real):.2f}, sampled from the fitted Gaussian {gap(fake):.2f}")
print("the Gaussian fills the empty valley between the clumps: its p(x | y) is wrong, so its posterior may be too")`,
        },
      ],
    },
  },
  'l40-fit': {
    formulaTex: '$$\\begin{aligned} \\phi &= m/n, \\qquad \\mu_k = \\bar x_k \\\\ \\Sigma &= \\tfrac{1}{n}\\textstyle\\sum_i (x_i - \\mu_{y_i})(x_i - \\mu_{y_i})^\\top \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\phi$', 'y.mean()', 'Share of class 1.'],
        ['$\\mu_k$', 'X[y == k].mean(axis=0)', 'Average of class k.'],
        ['$x_i - \\mu_{y_i}$', 'X - np.array(mu)[y]', 'Each example measured from its own class mean.'],
        ['$\\Sigma$', 'centered.T @ centered / len(y)', 'The pooled within-class covariance.'],
      ],
    },
    notebook: {
      title: 'Lab 40.2 · Fitting GDA by maximum likelihood',
      intro: 'The maximum-likelihood estimates as plain averages, and why the covariance must be pooled within classes.',
      cells: [
        {
          title: 'The estimates',
          prose: '**Predict** how the covariance about the overall mean differs from the pooled one.',
          code: `import numpy as np
# The playground's worlds: two Gaussian classes (optionally with a far-away subgroup in class 1).
WORLDS = {
    "shared":    dict(m0=[-0.9, -0.4], m1=[0.9, 0.5], S0=[[1.1, 0.6], [0.6, 0.9]], S1=[[1.1, 0.6], [0.6, 0.9]], skew=False),
    "different": dict(m0=[0.0, 0.0],   m1=[0.6, 0.4], S0=[[0.25, 0], [0, 0.25]],   S1=[[2.2, 0.3], [0.3, 1.6]],   skew=False),
    "skewed":    dict(m0=[-0.9, -0.4], m1=[0.9, 0.5], S0=[[1.1, 0.6], [0.6, 0.9]], S1=[[1.1, 0.6], [0.6, 0.9]], skew=True),
}
def sample(world, n, seed):
    w, rng = WORLDS[world], np.random.default_rng(seed)
    y = (rng.random(n) < 0.5).astype(int)
    X = np.where(y[:, None] == 1, rng.multivariate_normal(w["m1"], w["S1"], n), rng.multivariate_normal(w["m0"], w["S0"], n))
    if w["skew"]:
        far = (y == 1) & (rng.random(n) < 0.3); X[far] += [5, 3]     # 30% of class 1 sits far away
    return X, y

def fit_gda(X, y, shared):
    phi = y.mean(); m = [X[y == k].mean(axis=0) for k in (0, 1)]
    S = [np.cov(X[y == k].T, bias=True) for k in (0, 1)]
    if shared:
        pooled = sum((y == k).mean() * S[k] for k in (0, 1))       # the pooled within-class covariance
        S = [pooled, pooled]
    return phi, m, [s + 1e-3 * np.eye(2) for s in S]

def log_gauss(X, m, S):
    d = X - m; P = np.linalg.inv(S)
    return -0.5 * np.einsum("ij,jk,ik->i", d, P, d) - 0.5 * np.log(np.linalg.det(S)) - np.log(2 * np.pi)

def posterior(model, X):
    phi, m, S = model
    return 1 / (1 + np.exp(-(log_gauss(X, m[1], S[1]) + np.log(phi) - log_gauss(X, m[0], S[0]) - np.log(1 - phi))))

X, y = sample("shared", 400, 3)
phi = y.mean()                                              # phi = m / n
mu = [X[y == k].mean(axis=0) for k in (0, 1)]               # each class mean
centered = X - np.array(mu)[y]                              # each example measured from ITS class mean
pooled = centered.T @ centered / len(y)
overall = np.cov(X.T, bias=True)                            # the wrong one: measured from the overall mean
print(f"phi = {phi:.3f}; mu0 = {np.round(mu[0], 3)}, mu1 = {np.round(mu[1], 3)}")
print("pooled within-class covariance:\\n", np.round(pooled, 3), "\\n(true [[1.1, 0.6], [0.6, 0.9]])")
print("covariance about the overall mean:\\n", np.round(overall, 3), "\\n(inflated by the gap between the classes)")
print(f"one feature, classes (1, 3) and (6, 10): pooled variance {np.mean([(1 - 2) ** 2, (3 - 2) ** 2, (6 - 8) ** 2, (10 - 8) ** 2]):.2f}")`,
        },
      ],
    },
  },
  'l40-boundaries': {
    formulaTex: '$$\\begin{aligned} \\theta &= \\Sigma^{-1}(\\mu_1 - \\mu_0) \\\\ \\theta_0 &= -\\tfrac12\\big(\\mu_1^\\top\\Sigma^{-1}\\mu_1 - \\mu_0^\\top\\Sigma^{-1}\\mu_0\\big) + \\log\\tfrac{\\phi}{1-\\phi} \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\theta$', 'P @ (m[1] - m[0])', 'LDA’s weights, computed rather than optimized.'],
        ['$\\theta_0$', '-0.5 * (m[1] @ P @ m[1] - m[0] @ P @ m[0]) + np.log(phi / (1 - phi))', 'Its intercept.'],
        ['QDA', 'fit_gda(X, y, shared=False)', 'One covariance per class: a quadratic boundary.'],
      ],
    },
    notebook: {
      title: 'Lab 40.3 · LDA and QDA boundaries',
      intro: 'LDA’s posterior equals a sigmoid of a linear function exactly; QDA against LDA when covariances differ; parameter counts.',
      cells: [
        {
          title: 'Linear and quadratic',
          prose: '**Predict** whether QDA beats LDA with only 10 examples in the different-covariances world.',
          code: `import numpy as np
# The playground's worlds: two Gaussian classes (optionally with a far-away subgroup in class 1).
WORLDS = {
    "shared":    dict(m0=[-0.9, -0.4], m1=[0.9, 0.5], S0=[[1.1, 0.6], [0.6, 0.9]], S1=[[1.1, 0.6], [0.6, 0.9]], skew=False),
    "different": dict(m0=[0.0, 0.0],   m1=[0.6, 0.4], S0=[[0.25, 0], [0, 0.25]],   S1=[[2.2, 0.3], [0.3, 1.6]],   skew=False),
    "skewed":    dict(m0=[-0.9, -0.4], m1=[0.9, 0.5], S0=[[1.1, 0.6], [0.6, 0.9]], S1=[[1.1, 0.6], [0.6, 0.9]], skew=True),
}
def sample(world, n, seed):
    w, rng = WORLDS[world], np.random.default_rng(seed)
    y = (rng.random(n) < 0.5).astype(int)
    X = np.where(y[:, None] == 1, rng.multivariate_normal(w["m1"], w["S1"], n), rng.multivariate_normal(w["m0"], w["S0"], n))
    if w["skew"]:
        far = (y == 1) & (rng.random(n) < 0.3); X[far] += [5, 3]     # 30% of class 1 sits far away
    return X, y

def fit_gda(X, y, shared):
    phi = y.mean(); m = [X[y == k].mean(axis=0) for k in (0, 1)]
    S = [np.cov(X[y == k].T, bias=True) for k in (0, 1)]
    if shared:
        pooled = sum((y == k).mean() * S[k] for k in (0, 1))       # the pooled within-class covariance
        S = [pooled, pooled]
    return phi, m, [s + 1e-3 * np.eye(2) for s in S]

def log_gauss(X, m, S):
    d = X - m; P = np.linalg.inv(S)
    return -0.5 * np.einsum("ij,jk,ik->i", d, P, d) - 0.5 * np.log(np.linalg.det(S)) - np.log(2 * np.pi)

def posterior(model, X):
    phi, m, S = model
    return 1 / (1 + np.exp(-(log_gauss(X, m[1], S[1]) + np.log(phi) - log_gauss(X, m[0], S[0]) - np.log(1 - phi))))

X, y = sample("shared", 400, 3)
phi, m, S = fit_gda(X, y, shared=True)
P = np.linalg.inv(S[0])
theta = P @ (m[1] - m[0])
theta0 = -0.5 * (m[1] @ P @ m[1] - m[0] @ P @ m[0]) + np.log(phi / (1 - phi))
grid = np.random.default_rng(0).normal(size=(5, 2)) * 2
print("Bayes-rule posterior:     ", np.round(posterior((phi, m, S), grid), 6))
print("sigmoid(theta.x + theta0):", np.round(1 / (1 + np.exp(-(grid @ theta + theta0))), 6), " — LDA is exactly linear")

Xt, yt = sample("different", 4000, 999)
for n in (10, 400):
    errs = {name: [] for name in ("LDA", "QDA")}
    for r in range(40):
        Xd, yd = sample("different", n, 1000 * n + r)
        if yd.min() == yd.max(): continue
        for name, shared in (("LDA", True), ("QDA", False)):
            errs[name].append(np.mean((posterior(fit_gda(Xd, yd, shared), Xt) >= 0.5) != yt))
    print(f"different covariances, {n:3d} examples: LDA error {np.mean(errs['LDA']):.3f}, QDA {np.mean(errs['QDA']):.3f}")
d = 20
print(f"parameters with {d} features: LDA {2 * d + d * (d + 1) // 2 + 1}, QDA {2 * d + d * (d + 1) + 1}, logistic regression {d + 1}")`,
        },
      ],
    },
  },
  'l40-tradeoff': {
    formulaTex: '$$w^\\ast = \\arg\\max_w \\frac{\\big(w^\\top(\\mu_1 - \\mu_0)\\big)^2}{w^\\top \\Sigma w} \\ \\propto\\ \\Sigma^{-1}(\\mu_1 - \\mu_0)$$',
    mathCode: {
      rows: [
        ['naive Bayes', 'GaussianNB()', 'Diagonal covariance: 2d means and d variances.'],
        ['full LDA', 'LinearDiscriminantAnalysis(solver="lsqr")', 'A full covariance: d(d + 1)/2 entries.'],
        ['Fisher ratio', '(w @ dm) ** 2 / (w @ S @ w)', 'Separation relative to spread along w.'],
      ],
    },
    notebook: {
      title: 'Lab 40.4 · Which wins, and when?',
      intro: 'Twenty features at 40 and 400 examples, the far-subgroup world, and Fisher’s direction.',
      cells: [
        {
          title: 'Learning curves and Fisher’s direction',
          prose: '**Predict** the order of the three models at 40 examples.',
          code: `import numpy as np
# The playground's worlds: two Gaussian classes (optionally with a far-away subgroup in class 1).
WORLDS = {
    "shared":    dict(m0=[-0.9, -0.4], m1=[0.9, 0.5], S0=[[1.1, 0.6], [0.6, 0.9]], S1=[[1.1, 0.6], [0.6, 0.9]], skew=False),
    "different": dict(m0=[0.0, 0.0],   m1=[0.6, 0.4], S0=[[0.25, 0], [0, 0.25]],   S1=[[2.2, 0.3], [0.3, 1.6]],   skew=False),
    "skewed":    dict(m0=[-0.9, -0.4], m1=[0.9, 0.5], S0=[[1.1, 0.6], [0.6, 0.9]], S1=[[1.1, 0.6], [0.6, 0.9]], skew=True),
}
def sample(world, n, seed):
    w, rng = WORLDS[world], np.random.default_rng(seed)
    y = (rng.random(n) < 0.5).astype(int)
    X = np.where(y[:, None] == 1, rng.multivariate_normal(w["m1"], w["S1"], n), rng.multivariate_normal(w["m0"], w["S0"], n))
    if w["skew"]:
        far = (y == 1) & (rng.random(n) < 0.3); X[far] += [5, 3]     # 30% of class 1 sits far away
    return X, y

def fit_gda(X, y, shared):
    phi = y.mean(); m = [X[y == k].mean(axis=0) for k in (0, 1)]
    S = [np.cov(X[y == k].T, bias=True) for k in (0, 1)]
    if shared:
        pooled = sum((y == k).mean() * S[k] for k in (0, 1))       # the pooled within-class covariance
        S = [pooled, pooled]
    return phi, m, [s + 1e-3 * np.eye(2) for s in S]

def log_gauss(X, m, S):
    d = X - m; P = np.linalg.inv(S)
    return -0.5 * np.einsum("ij,jk,ik->i", d, P, d) - 0.5 * np.log(np.linalg.det(S)) - np.log(2 * np.pi)

def posterior(model, X):
    phi, m, S = model
    return 1 / (1 + np.exp(-(log_gauss(X, m[1], S[1]) + np.log(phi) - log_gauss(X, m[0], S[0]) - np.log(1 - phi))))

from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.naive_bayes import GaussianNB
from sklearn.linear_model import LogisticRegression
from scipy.stats import norm
d = 20
def draw(n, seed):
    rng = np.random.default_rng(seed); y = (rng.random(n) < 0.5).astype(int)
    return np.where(y[:, None] == 1, 0.35, -0.35) + rng.normal(size=(n, d)), y
Xt, yt = draw(3000, 4242)
models = {"naive Bayes": GaussianNB, "full LDA": lambda: LinearDiscriminantAnalysis(solver="lsqr", shrinkage=None), "logistic": lambda: LogisticRegression(C=1e3, max_iter=2000)}
print(f"20 features, Bayes error {1 - norm.cdf(0.35 * np.sqrt(d)):.3f}")
for n in (40, 400):
    row = {}
    for name, make in models.items():
        errs = []
        for r in range(30):
            X, y = draw(n, 31 * n + r)
            if y.min() == y.max(): continue
            errs.append(np.mean(make().fit(X, y).predict(Xt) != yt))
        row[name] = np.mean(errs)
    print(f"  {n:3d} examples: " + ", ".join(f"{k} {v:.3f}" for k, v in row.items()))

Xs, ys = sample("skewed", 400, 5); Xt2, yt2 = sample("skewed", 4000, 999)
print(f"far-subgroup world, 400 examples: LDA error {np.mean((posterior(fit_gda(Xs, ys, True), Xt2) >= 0.5) != yt2):.3f}, "
      f"logistic regression {np.mean(LogisticRegression().fit(Xs, ys).predict(Xt2) != yt2):.3f}")

# Fisher's direction is LDA's theta: check that it maximizes the separation ratio.
X, y = sample("shared", 400, 3); phi, m, S = fit_gda(X, y, True)
ratio = lambda w: (w @ (m[1] - m[0])) ** 2 / (w @ S[0] @ w)
w_star = np.linalg.solve(S[0], m[1] - m[0])
angles = np.linspace(0, np.pi, 181); best = max(angles, key=lambda a: ratio(np.array([np.cos(a), np.sin(a)])))
print(f"Fisher ratio: best of 181 directions {ratio(np.array([np.cos(best), np.sin(best)])):.4f}; Σ⁻¹(μ1 − μ0) gives {ratio(w_star):.4f}")`,
        },
      ],
    },
  },
  'l40-nb': {
    formulaTex: '$$\\begin{aligned} \\text{log-odds} = \\log\\tfrac{\\phi}{1-\\phi} &+ \\textstyle\\sum_j \\big[\\log p(x_j \\mid 1) \\\\ &- \\log p(x_j \\mid 0)\\big] \\end{aligned}$$',
    mathCode: {
      rows: [
        ['term $j$', '((x - mu[0]) ** 2 - (x - mu[1]) ** 2) / (2 * var)', 'Feature j’s contribution (shared variances).'],
        ['missing', 'np.nansum(t)', 'Leave the missing feature’s term out.'],
      ],
    },
    notebook: {
      title: 'Lab 40.5 · Naive Bayes, missing values and generation',
      intro: 'A missing feature handled by dropping its term — and checked against integrating it out.',
      cells: [
        {
          title: 'A missing feature',
          prose: '**Predict** whether dropping the term equals integrating the feature out.',
          code: `import numpy as np
# The playground's worlds: two Gaussian classes (optionally with a far-away subgroup in class 1).
WORLDS = {
    "shared":    dict(m0=[-0.9, -0.4], m1=[0.9, 0.5], S0=[[1.1, 0.6], [0.6, 0.9]], S1=[[1.1, 0.6], [0.6, 0.9]], skew=False),
    "different": dict(m0=[0.0, 0.0],   m1=[0.6, 0.4], S0=[[0.25, 0], [0, 0.25]],   S1=[[2.2, 0.3], [0.3, 1.6]],   skew=False),
    "skewed":    dict(m0=[-0.9, -0.4], m1=[0.9, 0.5], S0=[[1.1, 0.6], [0.6, 0.9]], S1=[[1.1, 0.6], [0.6, 0.9]], skew=True),
}
def sample(world, n, seed):
    w, rng = WORLDS[world], np.random.default_rng(seed)
    y = (rng.random(n) < 0.5).astype(int)
    X = np.where(y[:, None] == 1, rng.multivariate_normal(w["m1"], w["S1"], n), rng.multivariate_normal(w["m0"], w["S0"], n))
    if w["skew"]:
        far = (y == 1) & (rng.random(n) < 0.3); X[far] += [5, 3]     # 30% of class 1 sits far away
    return X, y

def fit_gda(X, y, shared):
    phi = y.mean(); m = [X[y == k].mean(axis=0) for k in (0, 1)]
    S = [np.cov(X[y == k].T, bias=True) for k in (0, 1)]
    if shared:
        pooled = sum((y == k).mean() * S[k] for k in (0, 1))       # the pooled within-class covariance
        S = [pooled, pooled]
    return phi, m, [s + 1e-3 * np.eye(2) for s in S]

def log_gauss(X, m, S):
    d = X - m; P = np.linalg.inv(S)
    return -0.5 * np.einsum("ij,jk,ik->i", d, P, d) - 0.5 * np.log(np.linalg.det(S)) - np.log(2 * np.pi)

def posterior(model, X):
    phi, m, S = model
    return 1 / (1 + np.exp(-(log_gauss(X, m[1], S[1]) + np.log(phi) - log_gauss(X, m[0], S[0]) - np.log(1 - phi))))

# Gaussian naive Bayes: each feature adds its own term to the log-odds, so a missing one is simply left out.
X, y = sample("shared", 400, 3)
mu = np.array([X[y == k].mean(axis=0) for k in (0, 1)]); var = np.mean((X - mu[y]) ** 2, axis=0)
def terms(x):
    return ((x - mu[0]) ** 2 - (x - mu[1]) ** 2) / (2 * var)    # per-feature log-likelihood ratio
x = np.array([0.8, np.nan])                                    # the second feature is missing
t = terms(x); log_odds = np.log(y.mean() / (1 - y.mean())) + np.nansum(t)
print(f"per-feature terms {np.round(t, 3)}; log-odds with the missing term left out {log_odds:.3f}; p(class 1) {1 / (1 + np.exp(-log_odds)):.3f}")

# Check against integrating the missing feature out of the fitted naive-Bayes model numerically.
grid = np.linspace(-8, 8, 4001)
lik = lambda k: np.exp(-(0.8 - mu[k, 0]) ** 2 / (2 * var[0])) * np.trapz(np.exp(-(grid - mu[k, 1]) ** 2 / (2 * var[1])), grid)
print(f"integrating x2 out numerically: p(class 1) {lik(1) * y.mean() / (lik(1) * y.mean() + lik(0) * (1 - y.mean())):.3f}")
print(f"the lesson's example: 0.4 + 0.9 (feature 2 missing) = {0.4 + 0.9:.1f}")`,
        },
      ],
    },
  },
}
