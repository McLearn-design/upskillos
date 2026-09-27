// Lab 56 runnable cells, typeset formulas and math ↔ code tables, keyed by lesson id.
// The two moons, the 5 × 7 digits and their augmentation follow the playground (NumPy draws). The moons classifier is
// scikit-learn logistic regression on the playground's kind of random Fourier features; it is more confident than the
// playground's, which changes self-training's behaviour (56.2 says so). The contrastive encoder is a NumPy copy.

export const extras = {
  'l56-scarce': {
    formulaTex: '$$\\begin{aligned} &\\text{labelled } \\{(x_i, y_i)\\}_{i=1}^{\\ell}, \\ \\text{unlabelled } \\{x_j\\}_{j=\\ell+1}^{\\ell+u} \\\\ &\\ell \\ll u \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\ell$', 'pick(k, seed)', 'k labelled points, half per class.'],
        ['$u$', 'X (400 points)', 'The unlabelled pool.'],
        ['test set', 'Xt, yt', 'A separate random labelled set that no method chooses.'],
      ],
    },
    notebook: {
      title: 'Lab 56.1 · When labels are scarce',
      intro: 'The supervised baseline on the moons, and how much it depends on which few points were labelled.',
      cells: [
        {
          title: 'The supervised baseline',
          prose: '**Predict** the accuracy range over 20 random pairs of labels.',
          code: `import numpy as np
from sklearn.linear_model import LogisticRegression

def moons(n, seed, noise=0.12):
    """The playground's two moons: alternate classes, angle uniform on [0, pi], Gaussian noise."""
    rng = np.random.default_rng(seed); c = np.arange(n) % 2; t = np.pi * rng.random(n)
    x = np.where(c == 1, 1 - np.cos(t), np.cos(t)); y = np.where(c == 1, 0.5 - np.sin(t), np.sin(t))
    return np.column_stack([x, y]) + noise * rng.normal(size=(n, 2)), c
X, y = moons(400, 56); Xt, yt = moons(600, 57)          # unlabelled pool (true labels hidden) and a random test set

rff_rng = np.random.default_rng(5)
RW, RB = rff_rng.normal(0, 2, (2, 60)), 2 * np.pi * rff_rng.random(60)    # random Fourier features, gamma = 2
phi = lambda Z: np.sqrt(2 / 60) * np.cos(Z @ RW + RB)
def fit(idx, labels=None):
    """A smooth probabilistic classifier: logistic regression on random Fourier features of the labelled points."""
    return LogisticRegression(C=20, max_iter=2000).fit(phi(X[idx]), y[idx] if labels is None else labels)
def pick(k, seed):
    """k labelled points, half from each class, chosen at random."""
    rng = np.random.default_rng(seed); return np.concatenate([rng.choice(np.where(y == c)[0], k // 2, replace=False) for c in (0, 1)])
accuracy = lambda m: float(np.mean(m.predict(phi(Xt)) == yt))

# With two labels, which two you get matters enormously: 20 different random pairs, one label per class each.
accs = np.array([accuracy(fit(pick(2, s))) for s in range(20)])
print(f"two labels, 20 random pairs: accuracy from {accs.min():.2f} to {accs.max():.2f}, mean {accs.mean():.2f}")
for k in (4, 10, 20, 100):
    a = np.array([accuracy(fit(pick(k, s))) for s in range(20)])
    print(f"{k:3d} labels: mean {a.mean():.3f}, spread (sd) {a.std():.3f}")
print(f"all 400 labels: {accuracy(fit(np.arange(400))):.3f}")`,
        },
      ],
    },
  },
  'l56-semi': {
    formulaTex: '$$\\begin{aligned} F^{(t+1)} &= \\alpha\\, S F^{(t)} + (1 - \\alpha)\\, Y \\\\ S &= D^{-1/2} W D^{-1/2} \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$W$', 'np.exp(-D[i, nb] ** 2 / (2 * sigma ** 2))', 'Gaussian weights on a 10-nearest-neighbour graph.'],
        ['$S$', 'W / np.sqrt(np.outer(d, d))', 'Symmetric normalization by degree.'],
        ['$F$', 'alpha * S @ F + (1 - alpha) * Y', 'Spread, while labelled points pull back.'],
      ],
    },
    notebook: {
      title: 'Lab 56.2 · Semi-supervised learning',
      intro: 'Label propagation against the supervised baseline and self-training, with one and five labels per class over five seeds.',
      cells: [
        {
          title: 'Propagation and self-training',
          prose: '**Predict** whether self-training ever ends below the supervised baseline. This classifier is more confident than the playground’s, so it pseudo-labels even from one label per class. scikit-learn’s `LabelSpreading` uses an unweighted graph and differs in detail.',
          code: `import numpy as np
from sklearn.linear_model import LogisticRegression

def moons(n, seed, noise=0.12):
    """The playground's two moons: alternate classes, angle uniform on [0, pi], Gaussian noise."""
    rng = np.random.default_rng(seed); c = np.arange(n) % 2; t = np.pi * rng.random(n)
    x = np.where(c == 1, 1 - np.cos(t), np.cos(t)); y = np.where(c == 1, 0.5 - np.sin(t), np.sin(t))
    return np.column_stack([x, y]) + noise * rng.normal(size=(n, 2)), c
X, y = moons(400, 56); Xt, yt = moons(600, 57)          # unlabelled pool (true labels hidden) and a random test set

rff_rng = np.random.default_rng(5)
RW, RB = rff_rng.normal(0, 2, (2, 60)), 2 * np.pi * rff_rng.random(60)    # random Fourier features, gamma = 2
phi = lambda Z: np.sqrt(2 / 60) * np.cos(Z @ RW + RB)
def fit(idx, labels=None):
    """A smooth probabilistic classifier: logistic regression on random Fourier features of the labelled points."""
    return LogisticRegression(C=20, max_iter=2000).fit(phi(X[idx]), y[idx] if labels is None else labels)
def pick(k, seed):
    """k labelled points, half from each class, chosen at random."""
    rng = np.random.default_rng(seed); return np.concatenate([rng.choice(np.where(y == c)[0], k // 2, replace=False) for c in (0, 1)])
accuracy = lambda m: float(np.mean(m.predict(phi(Xt)) == yt))
from sklearn.semi_supervised import LabelSpreading

def propagate(idx, k=10, sigma=0.3, alpha=0.99, iters=60):
    """Label propagation (Zhou et al.) on a symmetric k-nearest-neighbour graph with Gaussian edge weights."""
    D = np.sqrt(((X[:, None] - X[None]) ** 2).sum(-1)); W = np.zeros_like(D)
    for i in range(len(X)):
        nb = np.argsort(D[i])[1:k + 1]; W[i, nb] = np.exp(-D[i, nb] ** 2 / (2 * sigma ** 2))
    W = np.maximum(W, W.T); d = W.sum(1); S = W / np.sqrt(np.outer(d, d))
    Y = np.zeros((len(X), 2)); Y[idx, y[idx]] = 1; F = Y.copy()
    for _ in range(iters): F = alpha * S @ F + (1 - alpha) * Y             # spread, while labelled points pull back
    pool_label = F.argmax(1)
    return lambda Z: pool_label[np.argmin(((Z[:, None] - X[None]) ** 2).sum(-1), 1)]   # new points: nearest pool point

def self_train(idx, rounds=5, threshold=0.9):
    """Fit, pseudo-label pool points predicted with probability above the threshold, refit; repeat."""
    lab_idx, labels = list(idx), list(y[idx])
    for _ in range(rounds):
        m = fit(np.array(lab_idx), np.array(labels)); rest = np.setdiff1d(np.arange(len(X)), lab_idx)
        p = m.predict_proba(phi(X[rest]))[:, 1]; sure = rest[(p > threshold) | (p < 1 - threshold)]
        if len(sure) == 0: break
        lab_idx += list(sure); labels += list((m.predict_proba(phi(X[sure]))[:, 1] >= 0.5).astype(int))
    added = np.array(lab_idx[len(idx):], int)
    return fit(np.array(lab_idx), np.array(labels)), len(added), float(np.mean(np.array(labels[len(idx):]) == y[added])) if len(added) else float('nan')

for per in (1, 5):
    print(f"{per} label(s) per class")
    for s in range(1, 6):
        idx = pick(2 * per, s); prop = propagate(idx)
        sk = LabelSpreading(kernel='knn', n_neighbors=10, alpha=0.99, max_iter=2000).fit(X, np.where(np.isin(np.arange(400), idx), y, -1))
        st, n_added, right = self_train(idx)
        print(f"  seed {s}: supervised {accuracy(fit(idx)):.3f}  propagation {np.mean(prop(Xt) == yt):.3f} (scikit-learn's unweighted-graph LabelSpreading {sk.score(Xt, yt):.3f})"
              f"  self-training {accuracy(st):.3f}, {n_added} pseudo-labels" + (f", {right:.0%} right" if n_added else ''))`,
        },
      ],
    },
  },
  'l56-active': {
    formulaTex: '$$x^* = \\arg\\min_{x \\in \\text{pool}} \\big|\\, p(y = 1 \\mid x) - \\tfrac12 \\big|$$',
    mathCode: {
      rows: [
        ['$x^*$', 'rest[np.argmin(np.abs(p - 0.5))]', 'The pool point the model is least sure about.'],
        ['random', 'rng.choice(rest)', 'The baseline strategy.'],
      ],
    },
    notebook: {
      title: 'Lab 56.3 · Active learning',
      intro: 'Uncertainty sampling against random labels over eight runs, and where each strategy asks.',
      cells: [
        {
          title: 'Choosing what to label',
          prose: '**Predict** the accuracy of each strategy with 12 labels.',
          code: `import numpy as np
from sklearn.linear_model import LogisticRegression

def moons(n, seed, noise=0.12):
    """The playground's two moons: alternate classes, angle uniform on [0, pi], Gaussian noise."""
    rng = np.random.default_rng(seed); c = np.arange(n) % 2; t = np.pi * rng.random(n)
    x = np.where(c == 1, 1 - np.cos(t), np.cos(t)); y = np.where(c == 1, 0.5 - np.sin(t), np.sin(t))
    return np.column_stack([x, y]) + noise * rng.normal(size=(n, 2)), c
X, y = moons(400, 56); Xt, yt = moons(600, 57)          # unlabelled pool (true labels hidden) and a random test set

rff_rng = np.random.default_rng(5)
RW, RB = rff_rng.normal(0, 2, (2, 60)), 2 * np.pi * rff_rng.random(60)    # random Fourier features, gamma = 2
phi = lambda Z: np.sqrt(2 / 60) * np.cos(Z @ RW + RB)
def fit(idx, labels=None):
    """A smooth probabilistic classifier: logistic regression on random Fourier features of the labelled points."""
    return LogisticRegression(C=20, max_iter=2000).fit(phi(X[idx]), y[idx] if labels is None else labels)
def pick(k, seed):
    """k labelled points, half from each class, chosen at random."""
    rng = np.random.default_rng(seed); return np.concatenate([rng.choice(np.where(y == c)[0], k // 2, replace=False) for c in (0, 1)])
accuracy = lambda m: float(np.mean(m.predict(phi(Xt)) == yt))

def active(strategy, seed, budget=24):
    """Start from 4 random labels; each round, refit and buy one more label: at random, or the pool point closest to p = 0.5."""
    rng = np.random.default_rng(seed); idx = list(pick(4, seed)); curve = []
    for q in range(budget + 1):
        m = fit(np.array(idx)); curve.append(accuracy(m))
        if q == budget: break
        rest = np.setdiff1d(np.arange(len(X)), idx)
        idx.append(int(rng.choice(rest)) if strategy == 'random' else int(rest[np.argmin(np.abs(m.predict_proba(phi(X[rest]))[:, 1] - 0.5))]))
    return np.array(curve), idx

runs = {s: [active(s, seed) for seed in range(1, 9)] for s in ('random', 'uncertainty')}
for s, rs in runs.items():
    c = np.mean([r[0] for r in rs], 0)
    print(f"{s:11s} accuracy with 4, 8, 12, 16, 28 labels (mean of 8 runs): {' '.join(f'{c[k]:.3f}' for k in (0, 4, 8, 12, 24))}")
# Where did each strategy ask? Distance from each queried point to the nearest pool point of the other class.
gap = lambda i: np.sqrt(((X[y != y[i]] - X[i]) ** 2).sum(1)).min()
for s, rs in runs.items():
    q = [gap(i) for r in rs for i in r[1][4:]]
    print(f"{s:11s} queries: median distance to the other class {np.median(q):.2f} (all pool points: {np.median([gap(i) for i in range(400)]):.2f})")`,
        },
      ],
    },
  },
  'l56-contrastive': {
    formulaTex: '$$\\mathcal L_i = -\\log \\frac{\\exp(s_{i,i^+}/\\tau)}{\\sum_{j \\ne i} \\exp(s_{ij}/\\tau)}, \\quad s_{ij} = \\frac{z_i \\cdot z_j}{\\Vert z_i\\Vert\\,\\Vert z_j\\Vert}$$',
    mathCode: {
      rows: [
        ['$s_{ij}/\\tau$', 'Un @ Un.T / tau', 'Cosine similarities divided by the temperature.'],
        ['$\\mathcal L$', '-np.mean(np.log(P[np.arange(N2), pos]))', 'Pick each view’s partner out of the other 2N − 1.'],
        ['probe', 'LogisticRegression().fit(embed(Xpool[idx]), dpool[idx])', 'A linear classifier on frozen embeddings.'],
      ],
    },
    notebook: {
      title: 'Lab 56.4 · Self-supervised contrastive learning',
      intro: 'The InfoNCE gradient checked, an encoder pretrained without labels, and linear probes with 1, 3 and 10 labels per digit.',
      cells: [
        {
          title: 'InfoNCE and linear probes',
          prose: '**Predict** the probe’s accuracy with one label per digit, on raw pixels and on the embedding.',
          code: `import numpy as np
from sklearn.linear_model import LogisticRegression
FONT = ['01110100011001110101110011000101110', '00100011000010000100001000010001110', '01110100010000100010001000100011111', '11111000100010000010000011000101110', '00010001100101010010111110001000010', '11111100001111000001000011000101110', '00110010001000011110100011000101110', '11111000010001000100010000100001000', '01110100011000101110100011000101110', '01110100011000101111000010001001100']
TEMPL = np.array([[int(c) for c in f] for f in FONT], float)

def augment(x, rng):
    """Shift the 7 x 5 glyph by up to one pixel each way and add ink noise (the playground's augmentation)."""
    dx, dy = rng.integers(-1, 2, 2); img = np.roll(np.roll(x.reshape(7, 5), dy, 0), dx, 1)
    if dy == 1: img[0] = 0
    if dy == -1: img[-1] = 0
    if dx == 1: img[:, 0] = 0
    if dx == -1: img[:, -1] = 0
    return np.clip(img.ravel() + 0.15 * rng.normal(size=35), 0, 1)
def digits(n, seed):
    rng = np.random.default_rng(seed); d = np.arange(n) % 10; X = TEMPL[d].copy()
    X[X == 1] = 0.75 + 0.25 * rng.random((X == 1).sum()); flip = rng.random(X.shape) < 0.06; X[flip] = np.where(X[flip] > 0, 0, 0.6 * rng.random(flip.sum()))
    return np.array([augment(np.clip(x + 0.08 * rng.normal(size=35), 0, 1), rng) for x in X]), d
U, _ = digits(500, 71); Xte, dte = digits(300, 72); Xpool, dpool = digits(200, 83)

def info_nce(Z, tau):
    """Z: 2N embeddings, row i and row i + N are the two views of one image. Returns the loss and dL/dZ."""
    N2 = len(Z); N = N2 // 2; norms = np.linalg.norm(Z, axis=1, keepdims=True); Un = Z / norms
    S = Un @ Un.T / tau; np.fill_diagonal(S, -np.inf); pos = (np.arange(N2) + N) % N2
    S -= S.max(1, keepdims=True); P = np.exp(S); P /= P.sum(1, keepdims=True)
    loss = -np.mean(np.log(P[np.arange(N2), pos]))
    dS = P.copy(); dS[np.arange(N2), pos] -= 1; dS /= N2
    dU = (dS + dS.T) @ Un / tau
    return loss, (dU - Un * (dU * Un).sum(1, keepdims=True)) / norms

# Check the gradient against finite differences on a random batch of 6 embeddings.
Zc = np.random.default_rng(0).normal(size=(6, 4)); _, g = info_nce(Zc, 0.3); e = np.zeros_like(Zc); e[2, 1] = 1e-6
print(f"dL/dZ[2, 1]: formula {g[2, 1]:.6f}, finite difference {(info_nce(Zc + e, 0.3)[0] - info_nce(Zc - e, 0.3)[0]) / 2e-6:.6f}")

rng = np.random.default_rng(1)
P = [rng.normal(0, np.sqrt(2 / 35), (35, 48)), np.zeros(48), rng.normal(0, np.sqrt(2 / 48), (48, 16)), np.zeros(16)]
M, S2 = [0 * p for p in P], [0 * p for p in P]; t = 0
enc = lambda X: np.maximum(0, X @ P[0] + P[1]) @ P[2] + P[3]
for epoch in range(60):
    tot = 0
    for b in np.array_split(rng.permutation(500), 10):
        V = np.array([augment(x, rng) for x in U[b]] + [augment(x, rng) for x in U[b]])
        h = np.maximum(0, V @ P[0] + P[1]); loss, dZ = info_nce(h @ P[2] + P[3], 0.3); tot += loss / 10
        gh = (dZ @ P[2].T) * (h > 0); G = [V.T @ gh, gh.sum(0), h.T @ dZ, dZ.sum(0)]; t += 1
        for i in range(4):
            M[i] = 0.9 * M[i] + 0.1 * G[i]; S2[i] = 0.999 * S2[i] + 0.001 * G[i] ** 2
            P[i] -= 5e-3 * (M[i] / (1 - 0.9 ** t)) / (np.sqrt(S2[i] / (1 - 0.999 ** t)) + 1e-8)
    if epoch in (0, 9, 29, 59): print(f"epoch {epoch + 1:2d}: InfoNCE loss {tot:.3f} (chance: log(99) = {np.log(99):.3f})")

embed = lambda X: enc(X) / np.linalg.norm(enc(X), axis=1, keepdims=True)
for per in (1, 3, 10):
    idx = np.concatenate([np.where(dpool == d)[0][:per] for d in range(10)])
    raw = LogisticRegression(max_iter=3000).fit(Xpool[idx], dpool[idx]).score(Xte, dte)
    emb = LogisticRegression(max_iter=3000).fit(embed(Xpool[idx]), dpool[idx]).score(embed(Xte), dte)
    print(f"{per:2d} label(s) per digit: linear probe on raw pixels {raw:.3f}, on the learned embedding {emb:.3f}")`,
        },
      ],
    },
  },
  'l56-practice': {
    formulaTex: '$$\\kappa = \\frac{p_o - p_e}{1 - p_e}$$',
    mathCode: {
      rows: [
        ['rules', 'np.where(X[:, 1] > 0.35, 0, -1)', 'A labelling rule that votes or abstains (−1).'],
        ['majority', 'np.where(votes1 > votes0, 1, ...)', 'Combine the rules’ votes.'],
        ['$\\kappa$', '(po - pe) / (1 - pe)', 'Agreement beyond chance.'],
      ],
    },
    notebook: {
      title: 'Lab 56.5 · Label-efficient pipelines in practice',
      intro: 'Weak supervision from three cheap rules, and chance-corrected annotator agreement.',
      cells: [
        {
          title: 'Weak labels and agreement',
          prose: '**Predict** whether the majority vote is more accurate than the best single rule.',
          code: `import numpy as np

# Weak supervision on the two moons: three cheap labelling rules, each voting 0 or 1 or abstaining (-1).
rng = np.random.default_rng(56); n = 400; c = np.arange(n) % 2; t = np.pi * rng.random(n)
X = np.column_stack([np.where(c, 1 - np.cos(t), np.cos(t)), np.where(c, 0.5 - np.sin(t), np.sin(t))]) + 0.12 * rng.normal(size=(n, 2)); y = c
rules = {
    'x2 > 0.35 -> class 0': np.where(X[:, 1] > 0.35, 0, -1),
    'x2 < 0.15 -> class 1': np.where(X[:, 1] < 0.15, 1, -1),
    'x1 < 0 -> 0, x1 > 1 -> 1': np.where(X[:, 0] < 0, 0, np.where(X[:, 0] > 1, 1, -1)),
}
for name, v in rules.items():
    on = v >= 0; print(f"{name:30s} covers {on.mean():4.0%}, accuracy where it votes {np.mean(v[on] == y[on]):.3f}")
V = np.array(list(rules.values())); votes1, votes0 = (V == 1).sum(0), (V == 0).sum(0)
label = np.where(votes1 > votes0, 1, np.where(votes0 > votes1, 0, -1)); on = label >= 0
print(f"majority vote: covers {on.mean():.0%} of the pool, accuracy {np.mean(label[on] == y[on]):.3f} -- free labels, but noisy")

# Annotator agreement: two annotators label the same 200 items; raw agreement against chance-corrected Cohen's kappa.
a = rng.random(200) < 0.8; b = np.where(rng.random(200) < 0.85, a, ~a)       # annotator b copies a 85% of the time
po = np.mean(a == b); pe = a.mean() * b.mean() + (1 - a.mean()) * (1 - b.mean())
print(f"annotators agree on {po:.0%} of items; chance agreement {pe:.0%}; Cohen's kappa = (po - pe)/(1 - pe) = {(po - pe) / (1 - pe):.2f}")`,
        },
      ],
    },
  },
}
