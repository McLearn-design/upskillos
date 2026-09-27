// Lab 60 runnable cells, typeset formulas and math ↔ code tables, keyed by lesson id.
// The regression data follow the playground's process (noise growing with |x|, a gap between 0.4 and 1.8, the same
// shift) and the blobs its classification data, with NumPy draws. 60.1 trains a NumPy copy of the playground's ensemble;
// later cells use scikit-learn models, so coverages differ in detail while the guarantees behave the same.

export const extras = {
  'l60-kinds': {
    formulaTex: '$$\\begin{aligned} \\mathrm{Var}[y \\mid x] = \\ &\\underbrace{\\tfrac1M \\textstyle\\sum_m \\sigma_m^2(x)}_{\\text{aleatoric}} \\\\ &+ \\underbrace{\\tfrac1M \\textstyle\\sum_m (\\mu_m(x) - \\bar\\mu(x))^2}_{\\text{epistemic}} \\\\ \\mathcal L = \\ &\\tfrac12\\big[\\log\\sigma^2 + (y - \\mu)^2/\\sigma^2\\big] \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\mathcal L$', '-r * e, 0.5 * (1 - r * r * e)', 'Gradients of the Gaussian NLL for μ and log σ².'],
        ['aleatoric', 'vars_.mean(0)', 'Mean of the members’ variances.'],
        ['epistemic', 'mus.var(0)', 'Variance of the members’ means.'],
      ],
    },
    notebook: {
      title: 'Lab 60.1 · Two kinds of uncertainty',
      intro: 'A NumPy deep ensemble of 8 heteroscedastic networks, decomposed at three inputs: among the data, in the gap and beyond.',
      cells: [
        {
          title: 'Aleatoric and epistemic',
          prose: '**Predict** where the ensemble is confidently wrong.',
          code: `import numpy as np
truth = lambda x: 1.5 * np.sin(1.3 * x) + 0.3 * x
noise_sd = lambda x: 0.1 + 0.25 * np.abs(x)                    # 0.1 at x = 0, 0.85 at |x| = 3
def sample_x(n, rng, shift=0.0):
    """x on [-3, 3] with no data in the gap (0.4, 1.8); shift > 0 moves mass toward the noisy edges."""
    out = []
    while len(out) < n:
        u = rng.random()
        x = (1 if rng.random() < 0.5 else -1) * 3 * u ** (1 / (1 + 2 * shift)) if shift else -3 + 6 * u
        if x < 0.4 or x > 1.8: out.append(x)
    return np.array(out)
def make_data(n, seed, shift=0.0):
    rng = np.random.default_rng(seed); x = sample_x(n, rng, shift); return x, truth(x) + noise_sd(x) * rng.normal(size=n)
xtr, ytr = make_data(300, 60); xcal, ycal = make_data(300, 61); xte, yte = make_data(2000, 62)

def train_gaussian(seed, steps=1500, lr=0.01, batch=64):
    """1 -> 16 -> 16 -> (mu, log variance), ReLU; Gaussian NLL, the first fifth on the mean alone; Adam."""
    rng = np.random.default_rng(seed); sizes = [1, 16, 16, 2]
    P = [p for a, b in zip(sizes, sizes[1:]) for p in (rng.normal(0, np.sqrt(2 / a), (a, b)), np.zeros(b))]
    M, S = [0 * p for p in P], [0 * p for p in P]
    def forward(x):
        h1 = np.maximum(0, x[:, None] / 3 @ P[0] + P[1]); h2 = np.maximum(0, h1 @ P[2] + P[3]); return h1, h2, h2 @ P[4] + P[5]
    for t in range(1, steps + 1):
        i = rng.integers(0, len(xtr), batch); x, y = xtr[i], ytr[i]; h1, h2, o = forward(x)
        r, e = y - o[:, 0], np.exp(-o[:, 1])
        g = np.column_stack([-2 * r, 0 * r]) if t <= steps // 5 else np.column_stack([-r * e, 0.5 * (1 - r * r * e)])
        g /= batch; g2 = (g @ P[4].T) * (h2 > 0); g1 = (g2 @ P[2].T) * (h1 > 0)
        G = [x[:, None].T / 3 @ g1, g1.sum(0), h1.T @ g2, g2.sum(0), h2.T @ g, g.sum(0)]
        for k in range(6):
            M[k] = 0.9 * M[k] + 0.1 * G[k]; S[k] = 0.999 * S[k] + 0.001 * G[k] ** 2
            P[k] -= lr * (M[k] / (1 - 0.9 ** t)) / (np.sqrt(S[k] / (1 - 0.999 ** t)) + 1e-8)
    return lambda x: (lambda o: (o[:, 0], np.exp(np.minimum(o[:, 1], 10))))(forward(np.asarray(x, float))[2])

members = [train_gaussian(s) for s in range(1, 9)]                       # a deep ensemble of 8
xs = np.array([-1.0, 1.1, 4.5]); outs = [m(xs) for m in members]
mus = np.array([o[0] for o in outs]); vars_ = np.array([o[1] for o in outs])
aleatoric, epistemic = vars_.mean(0), mus.var(0)                          # law of total variance
for k, (x, where) in enumerate(zip(xs, ['among the data', 'in the gap', 'beyond the data'])):
    err = mus[:, k].mean() - truth(x)
    print(f"x = {x:4}: aleatoric sd {np.sqrt(aleatoric[k]):.2f} (true noise {noise_sd(x):.2f}), epistemic sd {np.sqrt(epistemic[k]):.3f}, "
          f"error of the mean {err:+.2f} ({where})")
print(f"total predictive sd for aleatoric variance 0.25 and epistemic 0.11: {np.sqrt(0.25 + 0.11):.2f}")`,
        },
      ],
    },
  },
  'l60-quantile': {
    formulaTex: '$$\\rho_\\tau(y, q) = \\begin{cases} \\tau\\,(y - q) & y \\ge q \\\\ (1 - \\tau)(q - y) & y < q \\end{cases}$$',
    mathCode: {
      rows: [
        ['$\\rho_\\tau$', 'pinball(tau, y, q)', 'Asymmetric loss; its minimizer is the τ-quantile.'],
        ['$q_\\tau(x)$', 'GradientBoostingRegressor(loss=\'quantile\', alpha=tau)', 'One model per quantile.'],
      ],
    },
    notebook: {
      title: 'Lab 60.2 · Quantile regression',
      intro: 'The pinball loss minimized over a constant, then 90% and 50% bands from quantile boosting.',
      cells: [
        {
          title: 'The pinball loss and bands',
          prose: '**Predict** whether the nominal 90% band covers 90% of new points.',
          code: `import numpy as np
truth = lambda x: 1.5 * np.sin(1.3 * x) + 0.3 * x
noise_sd = lambda x: 0.1 + 0.25 * np.abs(x)                    # 0.1 at x = 0, 0.85 at |x| = 3
def sample_x(n, rng, shift=0.0):
    """x on [-3, 3] with no data in the gap (0.4, 1.8); shift > 0 moves mass toward the noisy edges."""
    out = []
    while len(out) < n:
        u = rng.random()
        x = (1 if rng.random() < 0.5 else -1) * 3 * u ** (1 / (1 + 2 * shift)) if shift else -3 + 6 * u
        if x < 0.4 or x > 1.8: out.append(x)
    return np.array(out)
def make_data(n, seed, shift=0.0):
    rng = np.random.default_rng(seed); x = sample_x(n, rng, shift); return x, truth(x) + noise_sd(x) * rng.normal(size=n)
xtr, ytr = make_data(300, 60); xcal, ycal = make_data(300, 61); xte, yte = make_data(2000, 62)
from sklearn.ensemble import GradientBoostingRegressor

pinball = lambda tau, y, q: np.where(y >= q, tau * (y - q), (1 - tau) * (q - y))
# The minimizer of the mean pinball loss over a constant q is the empirical tau-quantile.
rng = np.random.default_rng(0); y = rng.exponential(size=5001); grid = np.linspace(0, 5, 5001)
for tau in (0.5, 0.9):
    best = grid[np.argmin([pinball(tau, y, q).mean() for q in grid])]
    print(f"tau = {tau}: pinball minimizer {best:.3f}, empirical quantile {np.quantile(y, tau):.3f}")
print(f"pinball loss for tau = 0.9 at a point 2 below the prediction: {float(pinball(0.9, 0.0, 2.0)):.1f}")

# Quantile regression with gradient boosting, one model per tau.
for lo, hi in ((0.05, 0.95), (0.25, 0.75)):
    q = [GradientBoostingRegressor(loss='quantile', alpha=t, n_estimators=200, max_depth=3, random_state=0).fit(xtr[:, None], ytr) for t in (lo, hi)]
    cov = lambda x, y: np.mean((y >= q[0].predict(x[:, None])) & (y <= q[1].predict(x[:, None])))
    print(f"nominal {hi - lo:.0%} band: training coverage {cov(xtr, ytr):.1%}, test coverage {cov(xte, yte):.1%}")`,
        },
      ],
    },
  },
  'l60-conformal': {
    formulaTex: '$$\\begin{aligned} \\hat q &= s_{(\\lceil (n + 1)(1 - \\alpha) \\rceil)} \\\\ C(x) &= [\\mu(x) - \\hat q,\\ \\mu(x) + \\hat q] \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$s_i$', 'np.abs(ycal - model.predict(xcal))', 'Absolute residuals on the calibration set.'],
        ['$\\hat q$', 'conformal_q(scores, alpha)', 'The (n + 1)-corrected rank; infinite if too few points.'],
      ],
    },
    notebook: {
      title: 'Lab 60.3 · Split conformal prediction',
      intro: 'The conformal quantile, one calibrated interval, and coverage over 300 random calibration draws.',
      cells: [
        {
          title: 'Calibrated intervals',
          prose: '**Predict** the range of coverage over single calibration draws of 100 points.',
          code: `import numpy as np
truth = lambda x: 1.5 * np.sin(1.3 * x) + 0.3 * x
noise_sd = lambda x: 0.1 + 0.25 * np.abs(x)                    # 0.1 at x = 0, 0.85 at |x| = 3
def sample_x(n, rng, shift=0.0):
    """x on [-3, 3] with no data in the gap (0.4, 1.8); shift > 0 moves mass toward the noisy edges."""
    out = []
    while len(out) < n:
        u = rng.random()
        x = (1 if rng.random() < 0.5 else -1) * 3 * u ** (1 / (1 + 2 * shift)) if shift else -3 + 6 * u
        if x < 0.4 or x > 1.8: out.append(x)
    return np.array(out)
def make_data(n, seed, shift=0.0):
    rng = np.random.default_rng(seed); x = sample_x(n, rng, shift); return x, truth(x) + noise_sd(x) * rng.normal(size=n)
xtr, ytr = make_data(300, 60); xcal, ycal = make_data(300, 61); xte, yte = make_data(2000, 62)
from sklearn.ensemble import GradientBoostingRegressor

model = GradientBoostingRegressor(n_estimators=200, max_depth=3, random_state=0).fit(xtr[:, None], ytr)
def conformal_q(scores, alpha):
    """The ceil((n + 1)(1 - alpha))-th smallest score; infinite if that rank exceeds n."""
    n = len(scores); k = int(np.ceil((n + 1) * (1 - alpha)))
    return np.inf if k > n else np.sort(scores)[k - 1]
print(f"rank for n = 199, alpha = 0.05: {int(np.ceil(200 * 0.95))};  n = 18, alpha = 0.05 gives q = {conformal_q(np.arange(18.0), 0.05)}")

alpha = 0.1; s_cal = np.abs(ycal - model.predict(xcal[:, None])); q = conformal_q(s_cal, alpha)
mu = model.predict(xte[:, None]); covered = np.abs(yte - mu) <= q
print(f"q = {q:.3f}: interval mu(x) +/- q covers {covered.mean():.1%} of 2,000 test points (target {1 - alpha:.0%})")

# The guarantee is an average over calibration draws: re-split a pool 300 times (100 calibration, 200 test points).
pool_x, pool_y = np.r_[xcal, xte], np.r_[ycal, yte]; s_pool = np.abs(pool_y - model.predict(pool_x[:, None]))
rng = np.random.default_rng(3); covs = []
for _ in range(300):
    idx = rng.permutation(len(pool_x)); qq = conformal_q(s_pool[idx[:100]], alpha); covs.append(np.mean(s_pool[idx[100:300]] <= qq))
covs = np.array(covs)
print(f"300 re-splits: mean coverage {covs.mean():.3f} (theory: between {1 - alpha:.3f} and {1 - alpha + 1 / 101:.3f}); "
      f"single draws range {covs.min():.2f}-{covs.max():.2f}")`,
        },
      ],
    },
  },
  'l60-adaptive': {
    formulaTex: '$$\\begin{aligned} s_{\\text{norm}} &= \\frac{|y - \\mu(x)|}{\\sigma(x)} \\\\ s_{\\text{CQR}} &= \\max\\big(\\mathrm{lo}(x) - y,\\ y - \\mathrm{hi}(x)\\big) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\sigma(x)$', 'scale_m.predict(x)', 'A model of the out-of-fold |residual|.'],
        ['lo, hi', 'quantile boosting at 0.05 and 0.95', 'The band CQR widens or narrows.'],
        ['by bin', 'cov[(xte >= a) & (xte < b)].mean()', 'Coverage where it is not guaranteed.'],
      ],
    },
    notebook: {
      title: 'Lab 60.4 · Adaptive intervals and their limits',
      intro: 'Absolute, normalized and CQR scores: overall coverage, coverage by region, width, and coverage under shift.',
      cells: [
        {
          title: 'Who pays for marginal coverage',
          prose: '**Predict** the absolute score’s coverage at the noisy edges.',
          code: `import numpy as np
truth = lambda x: 1.5 * np.sin(1.3 * x) + 0.3 * x
noise_sd = lambda x: 0.1 + 0.25 * np.abs(x)                    # 0.1 at x = 0, 0.85 at |x| = 3
def sample_x(n, rng, shift=0.0):
    """x on [-3, 3] with no data in the gap (0.4, 1.8); shift > 0 moves mass toward the noisy edges."""
    out = []
    while len(out) < n:
        u = rng.random()
        x = (1 if rng.random() < 0.5 else -1) * 3 * u ** (1 / (1 + 2 * shift)) if shift else -3 + 6 * u
        if x < 0.4 or x > 1.8: out.append(x)
    return np.array(out)
def make_data(n, seed, shift=0.0):
    rng = np.random.default_rng(seed); x = sample_x(n, rng, shift); return x, truth(x) + noise_sd(x) * rng.normal(size=n)
xtr, ytr = make_data(300, 60); xcal, ycal = make_data(300, 61); xte, yte = make_data(2000, 62)
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import cross_val_predict

gb = lambda **k: GradientBoostingRegressor(n_estimators=200, max_depth=3, random_state=0, **k)
X = xtr[:, None]; mean_m = gb().fit(X, ytr)
resid = np.abs(ytr - cross_val_predict(gb(), X, ytr, cv=5))                    # out-of-fold residuals
scale_m = gb().fit(X, resid)                                                    # sigma(x): predicted |residual|
lo_m, hi_m = gb(loss='quantile', alpha=0.05).fit(X, ytr), gb(loss='quantile', alpha=0.95).fit(X, ytr)
sig = lambda x: np.maximum(scale_m.predict(x[:, None]), 0.05)
SCORES = {
    'absolute': (lambda x, y: np.abs(y - mean_m.predict(x[:, None])), lambda x, q: (mean_m.predict(x[:, None]) - q, mean_m.predict(x[:, None]) + q)),
    'normalized': (lambda x, y: np.abs(y - mean_m.predict(x[:, None])) / sig(x), lambda x, q: (mean_m.predict(x[:, None]) - q * sig(x), mean_m.predict(x[:, None]) + q * sig(x))),
    'CQR': (lambda x, y: np.maximum(lo_m.predict(x[:, None]) - y, y - hi_m.predict(x[:, None])), lambda x, q: (lo_m.predict(x[:, None]) - q, hi_m.predict(x[:, None]) + q)),
}
xsh, ysh = make_data(2000, 70, shift=2.0)                                       # test inputs pushed toward the noisy edges
edges = [-3, -2, -1, 0, 1, 2, 3.01]
for name, (score, interval) in SCORES.items():
    s = score(xcal, ycal); n = len(s); q = np.sort(s)[int(np.ceil((n + 1) * 0.9)) - 1]
    lo, hi = interval(xte, q); cov = (yte >= lo) & (yte <= hi)
    bins = [cov[(xte >= a) & (xte < b)].mean() for a, b in zip(edges, edges[1:])]
    lo2, hi2 = interval(xsh, q)
    print(f"{name:10s}: coverage {cov.mean():.3f}, mean width {np.mean(hi - lo):.2f}; by x-bin {' '.join(f'{b:.2f}' for b in bins)}; "
          f"shifted test {np.mean((ysh >= lo2) & (ysh <= hi2)):.3f}")`,
        },
      ],
    },
  },
  'l60-sets': {
    formulaTex: '$$\\begin{aligned} s &= 1 - \\hat p(y \\mid x) \\\\ C(x) &= \\{k : \\hat p(k \\mid x) \\ge 1 - \\hat q\\} \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$s$', '1 - clf.predict_proba(Xcal)[range(n), ycal]', 'One minus the probability of the true class.'],
        ['$C(x)$', 'clf.predict_proba(X) >= 1 - q', 'Every class plausible enough.'],
        ['naive', 'add classes until p̂ sums to 1 − α', 'Trusts uncalibrated probabilities.'],
      ],
    },
    notebook: {
      title: 'Lab 60.5 · Conformal prediction sets',
      intro: 'Conformal and naive prediction sets at three levels, the average over re-splits, and noisier test data.',
      cells: [
        {
          title: 'Sets of labels',
          prose: '**Predict** whether the naive sets over- or under-cover.',
          code: `import numpy as np
from sklearn.neural_network import MLPClassifier

CENTERS = np.array([[-1, -0.6], [1, -0.6], [0, 1]])
def blobs(n, seed, spread=0.75):
    rng = np.random.default_rng(seed); y = np.arange(n) % 3; return CENTERS[y] + spread * rng.normal(size=(n, 2)), y
Xtr, ytr = blobs(300, 63); Xcal, ycal = blobs(300, 64); Xte, yte = blobs(1500, 65)
clf = MLPClassifier(hidden_layer_sizes=(16,), activation='tanh', max_iter=2000, random_state=1).fit(Xtr, ytr)

def conformal_sets(alpha, X):
    s = 1 - clf.predict_proba(Xcal)[np.arange(len(ycal)), ycal]; n = len(s); k = int(np.ceil((n + 1) * (1 - alpha)))
    q = np.inf if k > n else np.sort(s)[k - 1]
    return clf.predict_proba(X) >= 1 - q                                          # boolean set membership, one row per point
def naive_sets(alpha, X):
    P = clf.predict_proba(X); order = np.argsort(-P, 1); cum = np.cumsum(np.take_along_axis(P, order, 1), 1)
    keep = np.zeros_like(P, bool)
    for i in range(len(P)): keep[i, order[i, :np.searchsorted(cum[i], 1 - alpha) + 1]] = True
    return keep

for alpha in (0.05, 0.1, 0.2):
    C, N = conformal_sets(alpha, Xte), naive_sets(alpha, Xte)
    print(f"alpha {alpha}: conformal coverage {C[np.arange(len(yte)), yte].mean():.3f}, mean size {C.sum(1).mean():.2f}, empty {np.mean(C.sum(1) == 0):.1%}; "
          f"naive coverage {N[np.arange(len(yte)), yte].mean():.3f}, mean size {N.sum(1).mean():.2f}")
# One calibration draw can land either side of the target: this one is easier than the test set.
pool = np.r_[1 - clf.predict_proba(Xcal)[np.arange(300), ycal], 1 - clf.predict_proba(Xte)[np.arange(1500), yte]]
rng = np.random.default_rng(0); covs = []
for _ in range(500):
    i = rng.permutation(len(pool)); q = np.sort(pool[i[:300]])[int(np.ceil(301 * 0.95)) - 1]; covs.append(np.mean(pool[i[300:]] <= q))
print(f"alpha 0.05 over 500 random calibration/test re-splits: mean coverage {np.mean(covs):.3f}; this split's calibration accuracy "
      f"{clf.score(Xcal, ycal):.2f} against test accuracy {clf.score(Xte, yte):.2f}")
Xw, yw = blobs(1500, 66, spread=1.1)                                               # test data noisier than calibration data
C = conformal_sets(0.1, Xw); print(f"noisier test data, alpha 0.1: conformal coverage {C[np.arange(len(yw)), yw].mean():.3f}")
print(f"set for probabilities (0.5, 0.35, 0.15) with q = 0.7: classes {[k for k, p in enumerate((0.5, 0.35, 0.15)) if 1 - p <= 0.7]}")`,
        },
      ],
    },
  },
}
