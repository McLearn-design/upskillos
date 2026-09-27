// Lab 47 runnable cells, typeset formulas and math ↔ code tables, keyed by lesson id.
// The threshold class, point sets and random-features regression are the playground's, re-run in NumPy (SciPy's linprog checks separability).

export const extras = {
  'l47-hoeffding': {
    formulaTex: '$$\\begin{aligned} P\\big(|\\hat R(h) - R(h)| > \\varepsilon\\big) &\\le 2e^{-2n\\varepsilon^2} \\\\ \\varepsilon &= \\sqrt{\\ln(2/\\delta)/2n} \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\hat R(h)$', 'emp_error(t, x, y)', 'Training error of one fixed hypothesis.'],
        ['$R(h)$', 'true_error(t, noise)', 'Its true error, known exactly in this simulation.'],
        ['$\\varepsilon$', 'np.sqrt(np.log(2 / delta) / (2 * n))', 'The gap Hoeffding allows with probability 1 − δ.'],
      ],
    },
    notebook: {
      title: 'Lab 47.1 · The generalization question',
      intro: 'The gap between training and true error for one fixed hypothesis, against Hoeffding’s bound.',
      cells: [
        {
          title: 'Hoeffding for one hypothesis',
          prose: '**Predict** how often the gap exceeds the bound.',
          code: `import numpy as np
def sample(n, noise, rng, cut=0.6):
    x = rng.random(n); y = ((x > cut) ^ (rng.random(n) < noise)).astype(int)   # threshold truth with flipped labels
    return x, y
true_error = lambda t, noise, cut=0.6: noise + (1 - 2 * noise) * np.abs(t - cut)
emp_error = lambda t, x, y: np.mean((x[:, None] > np.atleast_1d(t)[None, :]).astype(int) != y[:, None], axis=0)
eps = lambda n, delta, H=1: np.sqrt((np.log(H) + np.log(2 / delta)) / (2 * n))

rng = np.random.default_rng(47)
t = 0.5                                                      # one hypothesis, fixed before seeing any data
for n in [25, 100, 400, 1600]:
    gaps = np.array([abs(emp_error(t, *sample(n, 0.1, rng))[0] - true_error(t, 0.1)) for _ in range(2000)])
    print(f"n = {n:4d}: 95th percentile of |train − true| {np.percentile(gaps, 95):.3f}; Hoeffding bound {eps(n, 0.05):.3f}; "
          f"share of runs beyond the bound {np.mean(gaps > eps(n, 0.05)):.3f}")
print(f"a test set of 2,500: epsilon = {eps(2500, 0.05):.4f}")`,
        },
      ],
    },
  },
  'l47-finite': {
    formulaTex: '$$\\begin{aligned} \\forall h:\\ |\\hat R(h) - R(h)| &\\le \\varepsilon \\\\ \\varepsilon &= \\sqrt{(\\ln|H| + \\ln(2/\\delta))/2n} \\\\ R(\\hat h) &\\le R(h^\\ast) + 2\\varepsilon \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\ln|H|$', 'np.log(H)', 'The class size enters through its logarithm.'],
        ['worst gap', 'np.max(np.abs(e - true_error(H, noise)))', 'The largest gap over the whole class in one sample.'],
        ['excess', 'true_error(H[np.argmin(e)]) - true_error(H).min()', 'ERM’s choice against the best in H.'],
      ],
    },
    notebook: {
      title: 'Lab 47.2 · Finite classes and the union bound',
      intro: 'The union bound against the actual worst gap and ERM’s excess error, for 10, 50 and 1,000 thresholds.',
      cells: [
        {
          title: 'The union bound in practice',
          prose: '**Predict** which grows faster with |H|: the bound or the actual worst gap.',
          code: `import numpy as np
def sample(n, noise, rng, cut=0.6):
    x = rng.random(n); y = ((x > cut) ^ (rng.random(n) < noise)).astype(int)   # threshold truth with flipped labels
    return x, y
true_error = lambda t, noise, cut=0.6: noise + (1 - 2 * noise) * np.abs(t - cut)
emp_error = lambda t, x, y: np.mean((x[:, None] > np.atleast_1d(t)[None, :]).astype(int) != y[:, None], axis=0)
eps = lambda n, delta, H=1: np.sqrt((np.log(H) + np.log(2 / delta)) / (2 * n))

rng = np.random.default_rng(47); n, noise = 100, 0.1
for K in [10, 50, 1000]:
    H = (np.arange(K) + 0.5) / K
    worst, excess = [], []
    for _ in range(300):
        x, y = sample(n, noise, rng)
        e = emp_error(H, x, y)
        worst.append(np.max(np.abs(e - true_error(H, noise))))
        excess.append(true_error(H[np.argmin(e)], noise) - true_error(H, noise).min())   # ERM's choice against the best in H
    print(f"|H| = {K:4d}: union bound {eps(n, 0.05, K):.3f}; actual 95th-percentile worst gap {np.percentile(worst, 95):.3f}; "
          f"ERM's average excess error {np.mean(excess):.4f} (guarantee 2 epsilon = {2 * eps(n, 0.05, K):.3f})")
print(f"20 models, 1,000 validation examples: epsilon = {eps(1000, 0.05, 20):.4f}")`,
        },
      ],
    },
  },
  'l47-vc': {
    formulaTex: '$$\\begin{aligned} d_{\\mathrm{VC}} = \\max\\{\\,n :\\ &\\text{all } 2^n \\text{ labellings of some} \\\\ &n \\text{ points are realizable}\\,\\} \\end{aligned}$$',
    mathCode: {
      rows: [
        ['realizable', 'linprog(..., A_ub=-s * [x, 1], b_ub=-1).status == 0', 'A half-plane with margin 1 exists.'],
        ['shattered', 'all(ok)', 'Every one of the 2ⁿ labellings is realizable.'],
      ],
    },
    notebook: {
      title: 'Lab 47.3 · VC dimension',
      intro: 'All labellings of four point sets checked by linear programming, and intervals on two and three points.',
      cells: [
        {
          title: 'Shattering',
          prose: '**Predict** how many of the 16 labellings of the square are realizable.',
          code: `import numpy as np
import itertools
from scipy.optimize import linprog
def separable(pts, labels):
    """Is there a half-plane w.x + b with y (w.x + b) >= 1 for every point? A linear feasibility problem."""
    pts, s = np.asarray(pts, float), 2 * np.asarray(labels) - 1
    A = -s[:, None] * np.column_stack([pts, np.ones(len(pts))])
    return linprog(np.zeros(3), A_ub=A, b_ub=-np.ones(len(pts)), bounds=[(None, None)] * 3).status == 0
sets = {"three, not on a line": [[-1, -0.6], [1, -0.6], [0, 1]], "three on a line": [[-1, 0], [0, 0], [1, 0]],
        "square": [[-1, -1], [1, -1], [1, 1], [-1, 1]], "one inside a triangle": [[-1.2, -0.8], [1.2, -0.8], [0, 1.2], [0, -0.1]]}
for name, pts in sets.items():
    ok = [separable(pts, lab) for lab in itertools.product([0, 1], repeat=len(pts))]
    print(f"{name:22s}: {sum(ok)} of {len(ok)} labellings realizable -> {'shattered' if all(ok) else 'not shattered'}")

def interval_can(xs, labels):                                # label 1 inside [a, b]: the ones must be contiguous
    ones = [i for i, l in enumerate(labels) if l]
    return not ones or all(labels[i] for i in range(ones[0], ones[-1] + 1))
for m in (2, 3):
    xs = list(range(m)); ok = [interval_can(xs, lab) for lab in itertools.product([0, 1], repeat=m)]
    print(f"intervals on {m} points: {sum(ok)} of {2 ** m} labellings" + (" (fails on 1, 0, 1)" if m == 3 else ""))`,
        },
      ],
    },
  },
  'l47-modern': {
    formulaTex: '$$\\begin{aligned} \\text{min-norm: } w &= \\Phi^{+} y \\\\ \\text{ridge: } w &= (\\Phi^\\top\\Phi + \\lambda I)^{-1}\\Phi^\\top y \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\Phi$', 'np.maximum(0, X @ W.T)', 'p random ReLU features.'],
        ['$\\Phi^{+}y$', 'np.linalg.pinv(F) @ y', 'Least squares; the smallest-norm solution when p > n.'],
        ['ridge', 'np.linalg.solve(F.T @ F + ridge * np.eye(p), F.T @ y)', 'A small penalty removes the spike.'],
      ],
    },
    notebook: {
      title: 'Lab 47.4 · What the bounds miss: double descent',
      intro: 'Median test error of random-features regression for p from 5 to 400 features and n = 40, with and without ridge.',
      cells: [
        {
          title: 'Double descent',
          prose: '**Predict** the test error at p = n = 40.',
          code: `import numpy as np
def sample(n, noise, rng, cut=0.6):
    x = rng.random(n); y = ((x > cut) ^ (rng.random(n) < noise)).astype(int)   # threshold truth with flipped labels
    return x, y
true_error = lambda t, noise, cut=0.6: noise + (1 - 2 * noise) * np.abs(t - cut)
emp_error = lambda t, x, y: np.mean((x[:, None] > np.atleast_1d(t)[None, :]).astype(int) != y[:, None], axis=0)
eps = lambda n, delta, H=1: np.sqrt((np.log(H) + np.log(2 / delta)) / (2 * n))

rng0 = 7
def double_descent(p, ridge, n=40, d=10, noise=0.5, reps=12):
    tests = []
    for r in range(reps):
        rng = np.random.default_rng(rng0 + 101 * r)
        beta = rng.normal(size=d) / np.sqrt(d); W = rng.normal(size=(p, d)) / np.sqrt(d)
        feat = lambda X: np.maximum(0, X @ W.T)              # p random ReLU features
        X, Xt = rng.normal(size=(n, d)), rng.normal(size=(300, d))
        y, yt = X @ beta + noise * rng.normal(size=n), Xt @ beta + noise * rng.normal(size=300)
        F = feat(X)
        w = np.linalg.pinv(F) @ y if ridge == 0 else np.linalg.solve(F.T @ F + ridge * np.eye(p), F.T @ y)   # pinv = min-norm least squares
        tests.append(np.mean((feat(Xt) @ w - yt) ** 2))
    return np.median(tests)
ps = [5, 10, 20, 30, 36, 40, 44, 50, 80, 200, 400]
for ridge in [0, 0.1]:
    print(f"{'min-norm' if ridge == 0 else 'ridge 0.1':9s} test error by number of features: " + "  ".join(f"{p}:{double_descent(p, ridge):.2f}" for p in ps))`,
        },
      ],
    },
  },
  'l47-practice': {
    formulaTex: '$$R(\\hat h) - R^\\ast = \\underbrace{R(h^\\ast) - R^\\ast}_{\\text{approximation}} + \\underbrace{R(\\hat h) - R(h^\\ast)}_{\\text{estimation}}$$',
    mathCode: {
      rows: [
        ['optimism', 'np.max(rng.binomial(m, true_acc, size=k)) / m - true_acc', 'How much better the best of k equal configurations looks.'],
        ['scale', 'np.sqrt(np.log(k) / m)', 'The order of that optimism.'],
      ],
    },
    notebook: {
      title: 'Lab 47.5 · Approximation, estimation and practical lessons',
      intro: 'The optimism of choosing the best of k configurations on one validation set.',
      cells: [
        {
          title: 'Validation optimism',
          prose: '**Predict** how much better the winner of 1,000 equal configurations looks.',
          code: `import numpy as np
def sample(n, noise, rng, cut=0.6):
    x = rng.random(n); y = ((x > cut) ^ (rng.random(n) < noise)).astype(int)   # threshold truth with flipped labels
    return x, y
true_error = lambda t, noise, cut=0.6: noise + (1 - 2 * noise) * np.abs(t - cut)
emp_error = lambda t, x, y: np.mean((x[:, None] > np.atleast_1d(t)[None, :]).astype(int) != y[:, None], axis=0)
eps = lambda n, delta, H=1: np.sqrt((np.log(H) + np.log(2 / delta)) / (2 * n))

rng = np.random.default_rng(5)
m, true_acc = 500, 0.80                                      # every configuration is truly 80% accurate
for k in [1, 10, 100, 1000]:
    winners = [np.max(rng.binomial(m, true_acc, size=k)) / m for _ in range(300)]
    print(f"{k:4d} configurations on {m} validation examples: the winner looks {100 * (np.mean(winners) - true_acc):.1f} points better than it is "
          f"(sqrt(ln k / m) = {np.sqrt(np.log(k) / m):.3f})")`,
        },
      ],
    },
  },
}
