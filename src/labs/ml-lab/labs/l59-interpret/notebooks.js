// Lab 59 runnable cells, typeset formulas and math ↔ code tables, keyed by lesson id.
// The build data follow the playground's process (same features, true effects and noise) with NumPy draws; the model
// is scikit-learn's GradientBoostingRegressor with the playground's settings (150 trees, rate 0.1, depth 4). It spreads
// credit between correlated features differently from the playground's own boosting, so numbers differ in detail.

export const extras = {
  'l59-importance': {
    formulaTex: '$$\\begin{aligned} \\mathrm{imp}_j = \\ &\\mathrm{MSE}\\big(f;\\ X^{(j\\ \\text{shuffled})}\\big) \\\\ &- \\mathrm{MSE}(f;\\ X) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\mathrm{imp}_j$', 'permutation_importance(model, X, y, scoring=\'neg_mean_squared_error\', n_repeats=5)', 'Average rise in error over 5 shuffles.'],
        ['gain', 'model.feature_importances_', 'Impurity importance, from training splits.'],
        ['drop-column', 'refit without size', 'Does the outcome need the feature?'],
      ],
    },
    notebook: {
      title: 'Lab 59.1 · Global importance',
      intro: 'Permutation importance on training and test builds, gain importance, and a refit without change size.',
      cells: [
        {
          title: 'Importance three ways',
          prose: '**Predict** the build id’s permutation importance on test builds.',
          code: `import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
NAMES = ['size', 'lines', 'files', 'cache', 'hour', 'build id']

def truth(X):
    """The playground's process: size and files add time; a cache miss adds 6 + 0.15 x size; daytime adds 4."""
    return 5 + 0.2 * X[:, 0] + 0.35 * X[:, 2] + np.where(X[:, 3] == 1, 0, 6 + 0.15 * X[:, 0]) + np.where((X[:, 4] >= 9) & (X[:, 4] <= 17), 4, 0)
def make_data(n, seed, noise=2.0):
    rng = np.random.default_rng(seed); size = 100 * rng.random(n) ** 1.3
    lines = np.clip(size + 6 * rng.normal(size=n), 0, 100)                    # a near-copy of size, unused by the process
    files = np.clip(0.35 * size + 8 * rng.random(n) + 3 * rng.normal(size=n), 0, 60)
    X = np.column_stack([size, lines, files, (rng.random(n) < 0.6).astype(float), rng.integers(0, 24, n).astype(float), rng.random(n)])
    return X, truth(X) + noise * rng.normal(size=n)
Xtr, ytr = make_data(300, 59); Xte, yte = make_data(300, 60)
model = GradientBoostingRegressor(n_estimators=150, learning_rate=0.1, max_depth=4, min_samples_leaf=2, random_state=0).fit(Xtr, ytr)
f = model.predict
mse = lambda X, y, g=f: float(np.mean((g(X) - y) ** 2))
SD = Xtr.std(0)
from sklearn.inspection import permutation_importance

print(f"test MSE {mse(Xte, yte):.2f} (training MSE {mse(Xtr, ytr):.2f})")
for name, (X, y) in (('training', (Xtr, ytr)), ('test', (Xte, yte))):
    r = permutation_importance(model, X, y, scoring='neg_mean_squared_error', n_repeats=5, random_state=1)
    print(f"permutation importance on {name:8s} builds: " + ', '.join(f"{n} {v:.2f}" for n, v in zip(NAMES, r.importances_mean)))
print("gain (impurity) importance:            " + ', '.join(f"{n} {v:.3f}" for n, v in zip(NAMES, model.feature_importances_)))

# Drop-column importance for change size: refit without it.
keep = [1, 2, 3, 4, 5]
m2 = GradientBoostingRegressor(n_estimators=150, learning_rate=0.1, max_depth=4, min_samples_leaf=2, random_state=0).fit(Xtr[:, keep], ytr)
print(f"refit without change size: test MSE {mse(Xte[:, keep], yte, m2.predict):.2f} (with it: {mse(Xte, yte):.2f})")
r2 = permutation_importance(m2, Xte[:, keep], yte, scoring='neg_mean_squared_error', n_repeats=5, random_state=1)
print(f"...and in that model, shuffling lines changed raises the test error by {r2.importances_mean[0]:.1f}")`,
        },
      ],
    },
  },
  'l59-pdp': {
    formulaTex: '$$\\begin{aligned} \\mathrm{ICE}_i(v) &= f(v,\\ x_{i,-j}) \\\\ \\mathrm{PD}_j(v) &= \\tfrac1n \\textstyle\\sum_i f(v,\\ x_{i,-j}) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\mathrm{ICE}_i(v)$', 'f(np.r_[v, r[1:]][None])', 'One build with its size set to v.'],
        ['$\\mathrm{PD}_j$', 'ice.mean(0)', 'Average of the ICE curves; checked against scikit-learn.'],
        ['centred', 'ice - ice[:, :1]', 'Subtract each curve’s start to expose interactions.'],
      ],
    },
    notebook: {
      title: 'Lab 59.2 · Partial dependence and ICE',
      intro: 'ICE and partial dependence for change size, split by cache status, and one off-manifold point.',
      cells: [
        {
          title: 'ICE and partial dependence',
          prose: '**Predict** which cache status gives the steeper centred ICE curves.',
          code: `import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
NAMES = ['size', 'lines', 'files', 'cache', 'hour', 'build id']

def truth(X):
    """The playground's process: size and files add time; a cache miss adds 6 + 0.15 x size; daytime adds 4."""
    return 5 + 0.2 * X[:, 0] + 0.35 * X[:, 2] + np.where(X[:, 3] == 1, 0, 6 + 0.15 * X[:, 0]) + np.where((X[:, 4] >= 9) & (X[:, 4] <= 17), 4, 0)
def make_data(n, seed, noise=2.0):
    rng = np.random.default_rng(seed); size = 100 * rng.random(n) ** 1.3
    lines = np.clip(size + 6 * rng.normal(size=n), 0, 100)                    # a near-copy of size, unused by the process
    files = np.clip(0.35 * size + 8 * rng.random(n) + 3 * rng.normal(size=n), 0, 60)
    X = np.column_stack([size, lines, files, (rng.random(n) < 0.6).astype(float), rng.integers(0, 24, n).astype(float), rng.random(n)])
    return X, truth(X) + noise * rng.normal(size=n)
Xtr, ytr = make_data(300, 59); Xte, yte = make_data(300, 60)
model = GradientBoostingRegressor(n_estimators=150, learning_rate=0.1, max_depth=4, min_samples_leaf=2, random_state=0).fit(Xtr, ytr)
f = model.predict
mse = lambda X, y, g=f: float(np.mean((g(X) - y) ** 2))
SD = Xtr.std(0)
from sklearn.inspection import partial_dependence

rows = Xte[:40]; grid = np.linspace(0, 100, 11)
ice = np.array([[f(np.r_[v, r[1:]][None])[0] for v in grid] for r in rows])        # ICE: one row, size varied
pd = ice.mean(0)
sk = partial_dependence(model, rows, [0], kind='average', grid_resolution=5, percentiles=(0, 1), method='brute')
g = sk['grid_values'][0] if 'grid_values' in sk else sk['values'][0]
mine = [np.mean([f(np.r_[v, r[1:]][None])[0] for r in rows]) for v in g]
print(f"partial dependence on size at 0, 50, 100 MB: {pd[0]:.1f}, {pd[5]:.1f}, {pd[-1]:.1f}")
print(f"check against scikit-learn on its own grid {np.round(g, 1)}: max difference {np.abs(np.array(mine) - sk['average'][0]).max():.1e}")
centred = ice - ice[:, :1]
for hit in (0, 1):
    print(f"centred ICE, cache {'hit ' if hit else 'miss'}: mean rise from 0 to 100 MB {centred[rows[:, 3] == hit, -1].mean():5.1f} minutes")
print(f"true process with files held fixed: a miss adds 35 minutes over 100 MB, a hit 20 (ratio {35 / 20:.2f});"
      " the model's curves are flatter because it credits part of the size effect to files and lines, which move with size in the data")

# Off-manifold points: setting size to 100 MB while lines stays put. Distance to the nearest training build (standardized).
def nearest(x):
    return np.sqrt((((Xtr[:, :5] - x[:5]) / SD[:5]) ** 2).sum(1)).min()
x = rows[np.argmin(rows[:, 0])].copy(); d0 = nearest(x); x[0] = 100
print(f"a {rows[:, 0].min():.1f} MB build moved to 100 MB with {x[1]:.1f} thousand lines: nearest real build {nearest(x):.2f} sd away (before: {d0:.2f})")`,
        },
      ],
    },
  },
  'l59-shapley': {
    formulaTex: '$$\\begin{aligned} \\phi_j = &\\sum_{S \\subseteq F \\setminus \\{j\\}} \\frac{|S|!\\,(d - |S| - 1)!}{d!} \\\\ &\\cdot \\big(v(S \\cup \\{j\\}) - v(S)\\big) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$v(S)$', 'value(x, S)', 'Features in S from x, the rest from each background build; averaged.'],
        ['$\\phi_j$', 'shapley(x)', 'Exact, over all 64 coalitions.'],
        ['efficiency', 'base + phi.sum() == f(x)', 'The values add up to the prediction.'],
      ],
    },
    notebook: {
      title: 'Lab 59.3 · Shapley values',
      intro: 'Exact Shapley values for one build, the efficiency check, and the cache’s value against change size.',
      cells: [
        {
          title: 'Exact Shapley values',
          prose: '**Predict** whether the cache is credited with more saving on small or on large changes.',
          code: `import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
NAMES = ['size', 'lines', 'files', 'cache', 'hour', 'build id']

def truth(X):
    """The playground's process: size and files add time; a cache miss adds 6 + 0.15 x size; daytime adds 4."""
    return 5 + 0.2 * X[:, 0] + 0.35 * X[:, 2] + np.where(X[:, 3] == 1, 0, 6 + 0.15 * X[:, 0]) + np.where((X[:, 4] >= 9) & (X[:, 4] <= 17), 4, 0)
def make_data(n, seed, noise=2.0):
    rng = np.random.default_rng(seed); size = 100 * rng.random(n) ** 1.3
    lines = np.clip(size + 6 * rng.normal(size=n), 0, 100)                    # a near-copy of size, unused by the process
    files = np.clip(0.35 * size + 8 * rng.random(n) + 3 * rng.normal(size=n), 0, 60)
    X = np.column_stack([size, lines, files, (rng.random(n) < 0.6).astype(float), rng.integers(0, 24, n).astype(float), rng.random(n)])
    return X, truth(X) + noise * rng.normal(size=n)
Xtr, ytr = make_data(300, 59); Xte, yte = make_data(300, 60)
model = GradientBoostingRegressor(n_estimators=150, learning_rate=0.1, max_depth=4, min_samples_leaf=2, random_state=0).fit(Xtr, ytr)
f = model.predict
mse = lambda X, y, g=f: float(np.mean((g(X) - y) ** 2))
SD = Xtr.std(0)
from math import factorial

D = 6; background = Xtr[::6]                                              # 50 background builds, as in the playground
def value(x, S):
    """Interventional coalition value: features in S from x, the rest from each background build; average."""
    Z = background.copy(); Z[:, S] = x[S]; return f(Z).mean()
def shapley(x):
    v = {S: value(x, list(S)) for S in [tuple(j for j in range(D) if m >> j & 1) for m in range(1 << D)]}
    phi = np.zeros(D)
    for S, vs in v.items():
        for j in range(D):
            if j in S: continue
            T = tuple(sorted(S + (j,))); phi[j] += factorial(len(S)) * factorial(D - len(S) - 1) / factorial(D) * (v[T] - vs)
    return phi, v[()]

x = Xte[3]; phi, base = shapley(x)
print("build 4:", ', '.join(f"{n} {p:+.2f}" for n, p in zip(NAMES, phi)))
print(f"average prediction {base:.2f} + sum of values {phi.sum():.2f} = {base + phi.sum():.2f}; model predicts {f(x[None])[0]:.2f} (efficiency)")

# Dependence of the cache value on size: among cache hits, the saving grows with the change.
hits = [r for r in Xte[:40] if r[3] == 1]
small = np.mean([shapley(r)[0][3] for r in hits if r[0] < 25]); big = np.mean([shapley(r)[0][3] for r in hits if r[0] > 60])
print(f"cache hits: mean Shapley value of the cache {small:.2f} for changes under 25 MB, {big:.2f} for changes over 60 MB")`,
        },
      ],
    },
  },
  'l59-lime': {
    formulaTex: '$$\\begin{aligned} \\min_\\beta\\ &\\textstyle\\sum_i w_i\\,(y_i - \\beta_0 - \\beta^\\top z_i)^2 \\\\ w_i &= e^{-d_i^2/\\sigma^2}, \\quad n_{\\text{eff}} = \\frac{(\\sum w)^2}{\\sum w^2} \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$w_i$', 'np.exp(-(U ** 2).mean(1) / width ** 2)', 'Kernel weight by standardized distance.'],
        ['$\\beta$', 'np.linalg.solve(A.T @ W, W.T @ y)', 'Weighted least squares.'],
        ['$n_{\\text{eff}}$', 'w.sum() ** 2 / np.sum(w ** 2)', 'How many samples the fit rests on.'],
      ],
    },
    notebook: {
      title: 'Lab 59.4 · Local surrogates (LIME)',
      intro: 'LIME at three kernel widths and three seeds each: coefficients, fidelity and effective sample size.',
      cells: [
        {
          title: 'Width, stability and fidelity',
          prose: '**Predict** which width gives the least stable size coefficient.',
          code: `import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
NAMES = ['size', 'lines', 'files', 'cache', 'hour', 'build id']

def truth(X):
    """The playground's process: size and files add time; a cache miss adds 6 + 0.15 x size; daytime adds 4."""
    return 5 + 0.2 * X[:, 0] + 0.35 * X[:, 2] + np.where(X[:, 3] == 1, 0, 6 + 0.15 * X[:, 0]) + np.where((X[:, 4] >= 9) & (X[:, 4] <= 17), 4, 0)
def make_data(n, seed, noise=2.0):
    rng = np.random.default_rng(seed); size = 100 * rng.random(n) ** 1.3
    lines = np.clip(size + 6 * rng.normal(size=n), 0, 100)                    # a near-copy of size, unused by the process
    files = np.clip(0.35 * size + 8 * rng.random(n) + 3 * rng.normal(size=n), 0, 60)
    X = np.column_stack([size, lines, files, (rng.random(n) < 0.6).astype(float), rng.integers(0, 24, n).astype(float), rng.random(n)])
    return X, truth(X) + noise * rng.normal(size=n)
Xtr, ytr = make_data(300, 59); Xte, yte = make_data(300, 60)
model = GradientBoostingRegressor(n_estimators=150, learning_rate=0.1, max_depth=4, min_samples_leaf=2, random_state=0).fit(Xtr, ytr)
f = model.predict
mse = lambda X, y, g=f: float(np.mean((g(X) - y) ** 2))
SD = Xtr.std(0)

def lime(x, width, seed, n=400, feats=(0, 1, 2, 3, 4)):
    """Perturb numeric features by one training sd, flip the cache half the time; weight exp(-d^2 / width^2); weighted LS."""
    rng = np.random.default_rng(seed); feats = list(feats); Z = np.tile(x, (n, 1))
    for k in feats:
        Z[:, k] = np.where(rng.random(n) < 0.5, x[k], 1 - x[k]) if k == 3 else np.clip(x[k] + SD[k] * rng.normal(size=n), Xtr[:, k].min(), Xtr[:, k].max())
    U = (Z[:, feats] - x[feats]) / SD[feats]; w = np.exp(-(U ** 2).mean(1) / width ** 2); y = f(Z)
    A = np.column_stack([np.ones(n), U]); W = A * w[:, None]
    beta = np.linalg.solve(A.T @ W + 1e-6 * np.eye(len(feats) + 1), W.T @ y)
    ybar = np.sum(w * y) / w.sum(); fid = 1 - np.sum(w * (y - A @ beta) ** 2) / np.sum(w * (y - ybar) ** 2)
    return beta[1:], fid, w.sum() ** 2 / np.sum(w ** 2)

x = Xte[3]
for width in (0.25, 0.75, 1.5):
    runs = [lime(x, width, s) for s in (1, 2, 3)]
    print(f"width {width:4}: size coefficient per sd {' '.join(f'{r[0][0]:5.2f}' for r in runs)}; "
          f"fidelity {' '.join(f'{r[1]:.2f}' for r in runs)}; effective samples {' '.join(f'{r[2]:.0f}' for r in runs)}")
w = np.array([1, 0.25, 0.25, 0.25, 0.25]); print(f"effective sample size of weights {w}: {w.sum() ** 2 / (w ** 2).sum():.1f}")`,
        },
      ],
    },
  },
  'l59-counterfactual': {
    formulaTex: '$$\\min_{x\'}\\ \\sum_k \\frac{|x\'_k - x_k|}{s_k} \\quad \\text{s.t.}\\ f(x\') \\le \\text{target}$$',
    mathCode: {
      rows: [
        ['distance', 'np.abs(cands[:, 0] - x[0]) / SD[0] + ...', 'Standard deviations for numbers, 1 per flipped yes/no feature.'],
        ['allowed', '(0, 2, 3) or (0,)', 'Actionable features only, or size only.'],
        ['plausibility', 'nearest(z)', 'Distance to the nearest real build.'],
      ],
    },
    notebook: {
      title: 'Lab 59.5 · Counterfactual explanations',
      intro: 'The smallest change that cuts a build’s prediction by 10 minutes, with all actionable features and with size only.',
      cells: [
        {
          title: 'Searching for a counterfactual',
          prose: '**Predict** the cheapest actionable change for a large build with a cache miss.',
          code: `import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
NAMES = ['size', 'lines', 'files', 'cache', 'hour', 'build id']

def truth(X):
    """The playground's process: size and files add time; a cache miss adds 6 + 0.15 x size; daytime adds 4."""
    return 5 + 0.2 * X[:, 0] + 0.35 * X[:, 2] + np.where(X[:, 3] == 1, 0, 6 + 0.15 * X[:, 0]) + np.where((X[:, 4] >= 9) & (X[:, 4] <= 17), 4, 0)
def make_data(n, seed, noise=2.0):
    rng = np.random.default_rng(seed); size = 100 * rng.random(n) ** 1.3
    lines = np.clip(size + 6 * rng.normal(size=n), 0, 100)                    # a near-copy of size, unused by the process
    files = np.clip(0.35 * size + 8 * rng.random(n) + 3 * rng.normal(size=n), 0, 60)
    X = np.column_stack([size, lines, files, (rng.random(n) < 0.6).astype(float), rng.integers(0, 24, n).astype(float), rng.random(n)])
    return X, truth(X) + noise * rng.normal(size=n)
Xtr, ytr = make_data(300, 59); Xte, yte = make_data(300, 60)
model = GradientBoostingRegressor(n_estimators=150, learning_rate=0.1, max_depth=4, min_samples_leaf=2, random_state=0).fit(Xtr, ytr)
f = model.predict
mse = lambda X, y, g=f: float(np.mean((g(X) - y) ** 2))
SD = Xtr.std(0)
import itertools

def nearest(x):
    return np.sqrt((((Xtr[:, :5] - x[:5]) / SD[:5]) ** 2).sum(1)).min()
def counterfactual(x, target, allowed):
    """Brute force over a grid: cache in {0, 1}, size and files on 60-point grids down from x (never up).
    Distance: |change| in training sd for numeric features, 1 for flipping the cache."""
    sizes = np.linspace(0, x[0], 60) if 0 in allowed else [x[0]]; files = np.linspace(0, x[2], 60) if 2 in allowed else [x[2]]
    caches = [0.0, 1.0] if 3 in allowed else [x[3]]
    cands = np.array([np.r_[s, x[1], fl, c, x[4], x[5]] for s, fl, c in itertools.product(sizes, files, caches)])
    ok = f(cands) <= target
    if not ok.any(): return None
    d = np.abs(cands[:, 0] - x[0]) / SD[0] + np.abs(cands[:, 2] - x[2]) / SD[2] + np.abs(cands[:, 3] - x[3])
    best = cands[ok][np.argmin(d[ok])]; return best, d[ok].min()

i = int(np.flatnonzero((Xte[:, 0] > 45) & (Xte[:, 0] < 65) & (Xte[:, 3] == 0))[0]); x = Xte[i]; target = f(x[None])[0] - 10   # like the playground's build 33
print(f"test build {i + 1}: size {x[0]:.1f} MB, lines {x[1]:.1f} thousand, files {x[2]:.1f}, cache {x[3]:.0f}, hour {x[4]:.0f}; predicted {f(x[None])[0]:.1f} min, target {target:.1f}")
for name, allowed in (('size, files and cache', (0, 2, 3)), ('size only', (0,))):
    r = counterfactual(x, target, allowed)
    if r is None: print(f"{name}: no change reaches the target"); continue
    z, d = r; changes = ', '.join(f"{NAMES[k]} {x[k]:.1f} -> {z[k]:.1f}" for k in (0, 2, 3) if abs(z[k] - x[k]) > 1e-9)
    print(f"{name:22s}: {changes}; distance {d:.2f}; prediction {f(z[None])[0]:.1f}; nearest real build {nearest(z):.2f} sd away (original: {nearest(x):.2f})")`,
        },
      ],
    },
  },
}
