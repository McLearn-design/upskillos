// Lab 49 runnable cells, typeset formulas and math ↔ code tables, keyed by lesson id.
// The regression data and the rings follow the playground (NumPy draws); scikit-learn's KernelRidge, GaussianProcessRegressor, KernelPCA and Nystroem are the references.

export const extras = {
  'l49-trick': {
    formulaTex: '$$\\begin{aligned} k(x, z) &= \\phi(x)^\\top\\phi(z) \\\\ (1 + xz)^2 &= \\phi(x)^\\top\\phi(z),\\ \\ \\phi(x) = (1, \\sqrt2 x, x^2) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\phi(x)$', 'np.array([1, np.sqrt(2) * t, t ** 2])', 'The explicit feature map of (1 + xz)².'],
        ['$k(x, z)$', '(1 + xv @ zv) ** p', 'One dot product, whatever the number of features.'],
      ],
    },
    notebook: {
      title: 'Lab 49.1 · Feature maps and the kernel trick',
      intro: 'The polynomial kernel against its explicit features, in one and four dimensions.',
      cells: [
        {
          title: 'The kernel trick, checked',
          prose: '**Predict** how many features (1 + x·z)³ has in 4 dimensions.',
          code: `import numpy as np
from math import comb
x, z = 0.7, -1.3
phi = lambda t: np.array([1, np.sqrt(2) * t, t ** 2])
print(f"(1 + xz)^2 = {(1 + x * z) ** 2:.6f};  phi(x) . phi(z) = {phi(x) @ phi(z):.6f}")
# In d dimensions, (1 + x.z)^p costs one dot product; its feature space has every monomial of degree <= p.
rng = np.random.default_rng(49); d, p = 4, 3
xv, zv = rng.normal(size=d), rng.normal(size=d)
from itertools import combinations_with_replacement
from math import factorial
def features(v):
    """Scaled monomials so that features(x) . features(z) = (1 + x.z)^p (multinomial coefficients)."""
    out = []
    for deg in range(p + 1):
        for idx in combinations_with_replacement(range(d), deg):
            counts = np.bincount(idx, minlength=d) if deg else np.zeros(d, int)
            coef = factorial(p) / (factorial(p - deg) * np.prod([factorial(c) for c in counts]))
            out.append(np.sqrt(coef) * np.prod(v ** counts))
    return np.array(out)
print(f"d = {d}, degree {p}: kernel {(1 + xv @ zv) ** p:.6f}; explicit {len(features(xv))} features give {features(xv) @ features(zv):.6f}")
print(f"monomials of degree <= 5 in 100 variables: {comb(105, 5):,}; of degree exactly 2 in 3 variables: {comb(4, 2)}")`,
        },
      ],
    },
  },
  'l49-valid': {
    formulaTex: '$$\\begin{aligned} &k \\text{ valid} \\iff K \\succeq 0 \\text{ for all points} \\\\ &k_1 + k_2,\\ \\ k_1 k_2,\\ \\ ck,\\ \\ e^{k} \\text{ are valid} \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$K$', 'np.exp(-D2), (1 + G) ** 3, ...', 'Gram matrices of seven candidate kernels.'],
        ['$K \\succeq 0$', 'np.linalg.eigvalsh(K).min() >= 0', 'Every eigenvalue non-negative (up to rounding).'],
      ],
    },
    notebook: {
      title: 'Lab 49.2 · Which functions are kernels?',
      intro: 'The smallest eigenvalue of seven Gram matrices, and how fast RBF eigenvalues decay.',
      cells: [
        {
          title: 'Positive semidefinite or not',
          prose: '**Predict** which of the seven has a negative eigenvalue.',
          code: `import numpy as np
rng = np.random.default_rng(49)
X = rng.uniform(-2, 2, size=(20, 1))
D2 = (X - X.T) ** 2; G = X @ X.T
kernels = {"linear": G, "polynomial (1 + xz)^3": (1 + G) ** 3, "RBF gamma 1": np.exp(-D2), "Laplacian": np.exp(-np.sqrt(D2)),
           "3 RBF + (xz)^2 (sum)": 3 * np.exp(-D2) + G ** 2, "RBF x polynomial (product)": np.exp(-D2) * (1 + G) ** 3,
           "tanh(xz - 1) (not a kernel)": np.tanh(G - 1)}
for name, K in kernels.items():
    ev = np.linalg.eigvalsh(K)
    print(f"{name:30s} smallest eigenvalue {ev.min():+.2e}  {'PSD (zero up to rounding)' if ev.min() > -1e-8 else 'NOT PSD'}")
ev = np.sort(np.linalg.eigvalsh(np.exp(-D2)))[::-1]
print("RBF eigenvalues, largest first:", np.round(ev[:8], 4), "— they decay fast")`,
        },
      ],
    },
  },
  'l49-representer': {
    formulaTex: '$$\\alpha = (K + \\lambda I)^{-1} y, \\qquad f(x) = \\sum_i \\alpha_i\\, k(x_i, x)$$',
    mathCode: {
      rows: [
        ['$\\alpha$', 'np.linalg.solve(K + lam * np.eye(30), y)', 'One coefficient per training example.'],
        ['$f(x)$', 'k(xs, x) @ alpha', 'Prediction: a weighted sum of kernel bumps.'],
        ['GP mean', 'GaussianProcessRegressor(RBF(...), alpha=lam)', 'The same prediction, with noise variance λ.'],
      ],
    },
    notebook: {
      title: 'Lab 49.3 · The representer theorem and kernel ridge regression',
      intro: 'Kernel ridge from scratch, against scikit-learn’s KernelRidge and a Gaussian process, and the polynomial kernel against explicit features.',
      cells: [
        {
          title: 'Kernel ridge three ways',
          prose: '**Predict** whether the GP’s mean differs from kernel ridge.',
          code: `import numpy as np
from sklearn.kernel_ridge import KernelRidge
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF
rng = np.random.default_rng(49)
x = rng.uniform(-2, 2, 30); y = np.sin(3 * x) + 0.3 * x ** 2 + 0.2 * rng.normal(size=30)
xs = np.linspace(-2, 2, 7)
gamma, lam = 3.0, 0.1
K = np.exp(-gamma * (x[:, None] - x[None, :]) ** 2)
alpha = np.linalg.solve(K + lam * np.eye(30), y)            # one coefficient per training example
pred = np.exp(-gamma * (xs[:, None] - x[None, :]) ** 2) @ alpha
kr = KernelRidge(alpha=lam, kernel="rbf", gamma=gamma).fit(x[:, None], y)
gp = GaussianProcessRegressor(RBF(length_scale=1 / np.sqrt(2 * gamma)), alpha=lam, optimizer=None).fit(x[:, None], y)
print("ours        ", np.round(pred, 4))
print("KernelRidge ", np.round(kr.predict(xs[:, None]), 4))
print("GP mean     ", np.round(gp.predict(xs[:, None]), 4), " (noise variance = lambda)")

# The polynomial kernel equals ridge on its explicit (scaled) features.
deg = 5
from math import comb
Phi = np.column_stack([np.sqrt(comb(deg, k)) * x ** k for k in range(deg + 1)])
w = np.linalg.solve(Phi.T @ Phi + 0.01 * np.eye(deg + 1), Phi.T @ y)
a = np.linalg.solve((1 + np.outer(x, x)) ** deg + 0.01 * np.eye(30), y)
Phis = np.column_stack([np.sqrt(comb(deg, k)) * xs ** k for k in range(deg + 1)])
print(f"polynomial degree {deg}: kernel ridge vs explicit ridge, largest difference {np.abs(((1 + np.outer(xs, x)) ** deg) @ a - Phis @ w).max():.1e}")`,
        },
      ],
    },
  },
  'l49-kpca': {
    formulaTex: '$$\\begin{aligned} \\tilde K &= HKH, \\quad H = I - \\tfrac1n\\mathbf 1\\mathbf 1^\\top \\\\ z_i^{(c)} &= \\sqrt{\\lambda_c}\\, v_c[i] \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\tilde K$', 'H @ K @ H', 'Centring in feature space, from the Gram matrix alone.'],
        ['$z_i^{(c)}$', 'vecs[:, :2] * np.sqrt(vals[:2])', 'Projection of point i on component c.'],
      ],
    },
    notebook: {
      title: 'Lab 49.4 · Kernel PCA and other kernelized algorithms',
      intro: 'Kernel PCA by hand on two rings, against scikit-learn and linear PCA, at three widths.',
      cells: [
        {
          title: 'Kernel PCA on rings',
          prose: '**Predict** which component separates the rings at γ = 2.',
          code: `import numpy as np
from sklearn.decomposition import PCA, KernelPCA
rng = np.random.default_rng(4)
ring = np.arange(150) % 2; r = np.where(ring, 2.2, 0.8); t = 2 * np.pi * rng.random(150)
X = np.column_stack([r * np.cos(t), r * np.sin(t)]) + 0.12 * rng.normal(size=(150, 2))
def best_threshold(v, labels):
    order = np.argsort(v); lab = labels[order]; n = len(v); best = max(lab.sum(), n - lab.sum())
    for k in range(1, n):
        left1 = lab[:k].sum(); best = max(best, (k - left1) + (lab[k:].sum()), left1 + (n - k - lab[k:].sum()))
    return best / n
K = np.exp(-2.0 * ((X[:, None, :] - X[None, :, :]) ** 2).sum(-1))
H = np.eye(150) - 1 / 150
Kc = H @ K @ H                                               # centring in feature space
vals, vecs = np.linalg.eigh(Kc); vals, vecs = vals[::-1], vecs[:, ::-1]
proj = vecs[:, :2] * np.sqrt(vals[:2])
print("kernel PCA by hand (gamma 2): ring separation on components 1 and 2:", [round(best_threshold(proj[:, c], ring), 3) for c in (0, 1)])
sk = KernelPCA(2, kernel="rbf", gamma=2.0).fit_transform(X)
print("scikit-learn KernelPCA, same components (up to sign):", round(float(np.abs(np.abs(sk) - np.abs(proj)).max()), 8))
lin = PCA(2).fit_transform(X)
print("linear PCA:", [round(best_threshold(lin[:, c], ring), 3) for c in (0, 1)], "— a rotation cannot separate rings")
for g in [0.1, 5.0]:
    p2 = KernelPCA(2, kernel="rbf", gamma=g).fit_transform(X)
    print(f"RBF gamma {g}:", [round(best_threshold(p2[:, c], ring), 3) for c in (0, 1)])`,
        },
      ],
    },
  },
  'l49-practice': {
    formulaTex: '$$\\begin{aligned} \\gamma &= 1 \\big/ \\big(2\\,\\mathrm{median}\\,\\lVert x_i - x_j\\rVert^2\\big) \\\\ K &\\approx K_{nm} K_{mm}^{-1} K_{mn} \\end{aligned}$$',
    mathCode: {
      rows: [
        ['median heuristic', '1 / (2 * np.median(d2))', 'A starting width.'],
        ['grid', 'cross_val_score(KernelRidge(alpha=l, gamma=g), ...)', 'Tune γ and λ together.'],
        ['Nyström', 'Nystroem(gamma=0.2, n_components=m)', 'A rank-m approximation from m landmarks.'],
      ],
    },
    notebook: {
      title: 'Lab 49.5 · Choosing kernels and scaling up',
      intro: 'The median heuristic, a cross-validated grid, and the Nyström error as landmarks grow.',
      cells: [
        {
          title: 'Tuning and Nyström',
          prose: '**Predict** the Nyström error with 400 landmarks.',
          code: `import numpy as np
from sklearn.kernel_ridge import KernelRidge
from sklearn.model_selection import cross_val_score
from sklearn.kernel_approximation import Nystroem
rng = np.random.default_rng(49)
x = rng.uniform(-2, 2, 30); y = np.sin(3 * x) + 0.3 * x ** 2 + 0.2 * rng.normal(size=30)
med = np.median((x[:, None] - x[None, :])[np.triu_indices(30, 1)] ** 2)
print(f"median heuristic: gamma = 1 / (2 x {med:.3f}) = {1 / (2 * med):.3f}")
grid = [(g, l, -cross_val_score(KernelRidge(alpha=l, kernel="rbf", gamma=g), x[:, None], y, cv=5, scoring="neg_mean_squared_error").mean())
        for g in [0.01, 0.1, 0.3, 1, 3, 10, 30] for l in [1e-4, 1e-3, 1e-2, 0.1, 1]]
g, l, e = min(grid, key=lambda t: t[2])
print(f"5-fold cross-validation over the grid: best gamma {g}, lambda {l}, error {e:.4f}")

from sklearn.metrics.pairwise import rbf_kernel
X = rng.normal(size=(1000, 5)); K = rbf_kernel(X, gamma=0.2)       # the exact 1,000 x 1,000 Gram matrix
for m in [20, 100, 400]:
    F = Nystroem(gamma=0.2, n_components=m, random_state=0).fit_transform(X)
    print(f"Nystroem with {m:3d} landmarks: relative error of the Gram matrix {np.linalg.norm(F @ F.T - K) / np.linalg.norm(K):.4f}")`,
        },
      ],
    },
  },
}
