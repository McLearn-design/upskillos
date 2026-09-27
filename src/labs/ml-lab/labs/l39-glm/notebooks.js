// Lab 39 runnable cells, typeset formulas and math ↔ code tables, keyed by lesson id.
// Data follow the playground's generators (same parameters, NumPy's own random draws).

export const extras = {
  'l39-expfam': {
    formulaTex: '$$\\begin{aligned} p(y;\\eta) &= b(y)\\,e^{\\eta y - a(\\eta)} \\\\ a^\\prime(\\eta) &= \\mathbb{E}[y] \\\\ a^{\\prime\\prime}(\\eta) &= \\mathrm{Var}(y) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$a(\\eta)$', 'np.log1p(np.exp(e))  # Bernoulli', 'Log-partition function; e²/2 for the Gaussian, eᵉ for the Poisson.'],
        ['$a^\\prime(\\eta)$', '(a(eta + h) - a(eta - h)) / (2 * h)', 'Its slope: the mean.'],
        ['$a^{\\prime\\prime}(\\eta)$', '(a(eta + h) - 2 * a(eta) + a(eta - h)) / h ** 2', 'Its curvature: the variance, never negative.'],
      ],
    },
    notebook: {
      title: 'Lab 39.1 · The exponential family',
      intro: 'The moments of three log-partition functions by finite differences, and the Bernoulli derivation checked numerically.',
      cells: [
        {
          title: 'Mean and variance from a(η)',
          prose: '**Predict** a″(0.7) for the Poisson.',
          code: `import numpy as np
# Each family's log-partition function a(eta). Its derivatives should be the mean and the variance.
families = {
    "Gaussian":  (lambda e: e ** 2 / 2,          lambda e: e,                   lambda e: 1.0),
    "Bernoulli": (lambda e: np.log1p(np.exp(e)), lambda e: 1 / (1 + np.exp(-e)), lambda e: 1 / (1 + np.exp(-e)) * (1 - 1 / (1 + np.exp(-e)))),
    "Poisson":   (lambda e: np.exp(e),           lambda e: np.exp(e),           lambda e: np.exp(e)),
}
eta, h = 0.7, 1e-4
for name, (a, mean, var) in families.items():
    d1 = (a(eta + h) - a(eta - h)) / (2 * h)                     # a'(eta) by finite differences
    d2 = (a(eta + h) - 2 * a(eta) + a(eta - h)) / h ** 2         # a''(eta)
    print(f"{name:9s} a'(0.7) = {d1:.5f} (mean {mean(eta):.5f})   a''(0.7) = {d2:.5f} (variance {var(eta):.5f})")

# The Bernoulli derivation, checked numerically: phi^y (1-phi)^(1-y) = exp(eta*y - a(eta)) with eta = log-odds.
phi = 0.3; eta_b = np.log(phi / (1 - phi))
for y in (0, 1):
    print(f"y = {y}: direct {phi ** y * (1 - phi) ** (1 - y):.4f}   exponential-family form {np.exp(eta_b * y - np.log1p(np.exp(eta_b))):.4f}")`,
        },
      ],
    },
  },
  'l39-glm': {
    formulaTex: '$$\\begin{aligned} \\mu &= e^{\\theta^\\top x} \\\\ \\nabla\\ell &= X^\\top(\\mu - y)/n \\\\ H &= X^\\top \\mathrm{diag}(\\mu)\\, X / n \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\mu$', 'np.exp(X @ theta)', 'Poisson mean: always positive.'],
        ['$\\nabla\\ell$', 'X.T @ (mu - y) / len(y)', 'The shared GLM gradient.'],
        ['$H$', 'X.T @ (X * mu[:, None]) / len(y)', 'Hessian; the Poisson variance equals its mean.'],
        ['dispersion', 'np.mean((y - mu) ** 2) / np.mean(mu)', 'About 1 for Poisson data; much larger means overdispersion.'],
      ],
    },
    notebook: {
      title: 'Lab 39.2 · Generalized linear models and count data',
      intro: 'Poisson regression by Newton’s method, its multiplicative slope, and an overdispersion check.',
      cells: [
        {
          title: 'Poisson regression',
          prose: '**Predict** the factor by which each unit of x multiplies the expected count.',
          code: `import numpy as np
rng = np.random.default_rng(39)
x = 10 * rng.random(200)
y = rng.poisson(np.exp(0.2 + 0.25 * x))                     # counts whose mean grows exponentially with x
X = np.column_stack([np.ones_like(x), x])

theta = np.zeros(2)
for step in range(12):                                      # Newton's method on the Poisson negative log-likelihood
    mu = np.exp(X @ theta)
    g = X.T @ (mu - y) / len(y)                             # the shared GLM gradient: (mu - y) x
    H = X.T @ (X * mu[:, None]) / len(y)                    # Hessian: Var(y) x x^T, and Var = mu for the Poisson
    theta -= np.linalg.solve(H, g)
print(f"fitted theta = ({theta[0]:.3f}, {theta[1]:.3f}); each unit of x multiplies the expected count by e^{theta[1]:.3f} = {np.exp(theta[1]):.3f}")
print(f"smallest prediction {np.exp(X @ theta).min():.2f}; a least-squares line predicts {np.polyval(np.polyfit(x, y, 1), 0):.2f} at x = 0")

def dispersion(y, mu):
    return np.mean((y - mu) ** 2) / np.mean(mu)             # about 1 for Poisson data
print(f"dispersion of the Poisson data: {dispersion(y, np.exp(X @ theta)):.2f}")
day_effect = rng.gamma(2.0, 0.5, len(x))                    # unmeasured differences between days (mean 1)
y_over = rng.poisson(np.exp(0.2 + 0.25 * x) * day_effect)
print(f"dispersion with unmeasured day effects: {dispersion(y_over, np.exp(X @ theta)):.2f} -> the Poisson fit understates uncertainty")`,
        },
      ],
    },
  },
  'l39-softmax': {
    formulaTex: '$$\\begin{aligned} p_k &= \\frac{e^{z_k - m}}{\\sum_j e^{z_j - m}},\\ \\ m = \\max_j z_j \\\\ \\frac{\\partial(-\\log p_y)}{\\partial z_k} &= p_k - \\mathbb{1}[k = y] \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$z_k$', 'X @ W', 'Class scores.'],
        ['$m = \\max_j z_j$', 'Z.max(axis=1, keepdims=True)', 'Subtracted first: same probabilities, no overflow.'],
        ['$p_k - \\mathbb{1}[k=y]$', 'P - np.eye(3)[y]', 'Gradient with respect to the scores; times x for the weights.'],
      ],
    },
    notebook: {
      title: 'Lab 39.3 · Softmax regression for many classes',
      intro: 'A stable softmax, a gradient check, training on three classes, and the two-class case.',
      cells: [
        {
          title: 'Softmax regression',
          prose: '**Predict** what the naive formula returns for scores (1002, 1001, 1000).',
          code: `import numpy as np
def softmax(Z):
    Z = Z - Z.max(axis=1, keepdims=True)                    # subtracting the largest score changes nothing but prevents overflow
    E = np.exp(Z)
    return E / E.sum(axis=1, keepdims=True)
print("softmax(2, 1, 0) =", np.round(softmax(np.array([[2.0, 1.0, 0.0]])), 4)[0])
print("softmax(1002, 1001, 1000) =", np.round(softmax(np.array([[1002.0, 1001.0, 1000.0]])), 4)[0], "(the naive formula gives nan)")

rng = np.random.default_rng(3)
centers = np.array([[-1.6, -0.8], [1.6, -0.8], [0, 1.6]])
y = np.arange(150) % 3
X = np.column_stack([np.ones(150), centers[y] + 0.85 * rng.normal(size=(150, 2))])
def loss_grad(W):
    P = softmax(X @ W); Y = np.eye(3)[y]
    return -np.mean(np.log(P[np.arange(150), y])), X.T @ (P - Y) / 150   # gradient: (p_k - 1[k = y]) x

W = 0.1 * rng.normal(size=(3, 3)); L, G = loss_grad(W); E = np.zeros_like(W); E[1, 2] = 1e-6
print(f"gradient check, one entry: analytic {G[1, 2]:.6f}, finite difference {(loss_grad(W + E)[0] - loss_grad(W - E)[0]) / 2e-6:.6f}")
W = np.zeros((3, 3))
for _ in range(200):
    W -= 0.5 * loss_grad(W)[1]
print(f"after 200 steps: cross-entropy {loss_grad(W)[0]:.3f} (started at ln 3 = {np.log(3):.3f}); training accuracy {np.mean(softmax(X @ W).argmax(axis=1) == y):.3f}")
z1, z0 = 0.8, -0.4
print(f"two classes: softmax gives {softmax(np.array([[z0, z1]]))[0, 1]:.4f}; sigmoid of the difference gives {1 / (1 + np.exp(-(z1 - z0))):.4f}")`,
        },
      ],
    },
  },
  'l39-newton': {
    formulaTex: '$$\\begin{aligned} \\theta &\\leftarrow \\theta - H^{-1}\\nabla f \\\\ H &= X^\\top S X / n,\\ \\ S = \\mathrm{diag}\\big(a^{\\prime\\prime}(\\eta_i)\\big) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$H$', 'X.T @ (X * (p * (1 - p))[:, None]) / len(y)', 'Logistic Hessian: weights are the Bernoulli variances.'],
        ['$H^{-1}\\nabla f$', 'np.linalg.solve(H, g)', 'Solve, never invert.'],
        ['backtracking', 'while nll(theta - lr * g) > ...: lr /= 2', 'Gradient descent’s step, halved until the loss drops enough.'],
      ],
    },
    notebook: {
      title: 'Lab 39.4 · Newton’s method and IRLS',
      intro: 'Newton against gradient descent on raw and standardized inputs, and the Gaussian in one step.',
      cells: [
        {
          title: 'Newton against gradient descent',
          prose: '**Predict** which method standardizing x changes.',
          code: `import numpy as np
rng = np.random.default_rng(39)
x = 10 * rng.random(80)
y = (rng.random(80) < 1 / (1 + np.exp(-(-4 + 0.8 * x)))).astype(float)

def fit(X, method, steps):
    theta, gaps = np.zeros(2), []
    nll = lambda t: np.mean(np.logaddexp(0, X @ t) - y * (X @ t))
    for _ in range(steps):
        p = 1 / (1 + np.exp(-(X @ theta))); g = X.T @ (p - y) / len(y)
        if method == "newton":
            theta = theta - np.linalg.solve(X.T @ (X * (p * (1 - p))[:, None]) / len(y), g)
        else:
            lr = 1.0
            while nll(theta - lr * g) > nll(theta) - 0.5 * lr * g @ g: lr /= 2   # backtracking so it never diverges
            theta = theta - lr * g
        gaps.append(nll(theta))
    return theta, np.array(gaps)

for label, xs in [("raw x", x), ("standardized x", (x - x.mean()) / x.std())]:
    X = np.column_stack([np.ones_like(xs), xs])
    t_n, f_n = fit(X, "newton", 8); t_g, f_g = fit(X, "gd", 200)
    best = min(f_n.min(), f_g.min())
    print(f"{label:15s} Newton gap by step: " + " ".join(f"{max(v - best, 1e-16):.0e}" for v in f_n[:7]) + f"   | gradient descent gap after 200 steps: {max(f_g[-1] - best, 1e-16):.0e}")

# Gaussian: the loss is exactly quadratic, so one Newton step from anywhere lands on the least-squares solution.
yg = 1 + 0.5 * x + rng.normal(size=80); X = np.column_stack([np.ones_like(x), x])
theta = np.zeros(2); theta -= np.linalg.solve(X.T @ X / 80, X.T @ (X @ theta - yg) / 80)
print("Gaussian, one Newton step:", np.round(theta, 6), " normal equations:", np.round(np.linalg.lstsq(X, yg, rcond=None)[0], 6))`,
        },
      ],
    },
  },
  'l39-lwr': {
    formulaTex: '$$\\begin{aligned} w_i(x) &= e^{-(x_i - x)^2 / 2\\tau^2} \\\\ \\theta(x) &= \\arg\\min_\\theta \\textstyle\\sum_i w_i(x)\\,(y_i - \\theta^\\top x_i)^2 \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$w_i(x)$', 'np.exp(-(xtr - x0) ** 2 / (2 * tau ** 2))', 'Nearby points count most.'],
        ['$\\theta(x)$', 'np.linalg.solve(A.T @ (A * w[:, None]), A.T @ (w * ytr))', 'A fresh weighted line per query.'],
        ['LOO', 'np.delete(x, i)', 'Predict each point from a fit that never saw it.'],
      ],
    },
    notebook: {
      title: 'Lab 39.5 · Locally weighted regression',
      intro: 'Bandwidth chosen by leave-one-out error, against the training error that always prefers the smallest.',
      cells: [
        {
          title: 'Choosing the bandwidth',
          prose: '**Predict** the τ that training error would choose.',
          code: `import numpy as np
rng = np.random.default_rng(5)
x = np.sort(10 * rng.random(60)); y = np.sin(x) + 0.3 * x + 0.25 * rng.normal(size=60)

def lwr(xtr, ytr, x0, tau):
    w = np.exp(-(xtr - x0) ** 2 / (2 * tau ** 2)) if np.isfinite(tau) else np.ones_like(xtr)
    A = np.column_stack([np.ones_like(xtr), xtr])
    theta = np.linalg.solve(A.T @ (A * w[:, None]), A.T @ (w * ytr))       # weighted least squares at this query
    return theta[0] + theta[1] * x0

def loo(tau):
    return np.mean([(lwr(np.delete(x, i), np.delete(y, i), x[i], tau) - y[i]) ** 2 for i in range(len(x))])

print("weights at distances tau, 2tau, 3tau:", np.round(np.exp(-np.array([1, 4, 9]) / 2), 3))
taus = [0.1, 0.2, 0.3, 0.5, 0.8, 1.2, 2, 5, np.inf]
errors = {t: loo(t) for t in taus}
train = {t: np.mean([(lwr(x, y, xi, t) - yi) ** 2 for xi, yi in zip(x, y)]) for t in taus}
for t in taus:
    print(f"tau {t:>4}: training error {train[t]:.3f}   leave-one-out error {errors[t]:.3f}")
print("leave-one-out chooses tau =", min(errors, key=errors.get), "; training error would choose", min(train, key=train.get))`,
        },
      ],
    },
  },
}
