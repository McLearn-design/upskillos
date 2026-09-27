// Lab 52 runnable cells, typeset formulas and math ↔ code tables, keyed by lesson id.
// The spirals (80 training points, 10% mislabelled) follow the playground; the network is a small NumPy MLP trained with AdamW, so its numbers differ a little from the playground's.

export const extras = {
  'l52-overfit': {
    formulaTex: '$$\\text{keep } \\theta_{e^\\ast}, \\qquad e^\\ast = \\arg\\min_e L_{\\mathrm{val}}(e)$$',
    mathCode: {
      rows: [
        ['log', 'train(epochs=1500)', 'Training and validation loss and accuracy every 10 epochs.'],
        ['$e^\\ast$', 'log[np.argmin(log[:, 3])]', 'The epoch early stopping would keep.'],
      ],
    },
    notebook: {
      title: 'Lab 52.1 · How big networks overfit',
      intro: 'A 2,594-parameter network on 80 noisy points, trained far past its best epoch.',
      cells: [
        {
          title: 'Memorizing the noise',
          prose: '**Predict** the training accuracy after 1,500 epochs.',
          code: `import numpy as np
def spirals(n, seed, flip=0.0):
    """The playground's two interleaved spirals; flip mislabels that share of points."""
    rng = np.random.default_rng(seed); c = np.arange(n) % 2; t = 0.25 + 2.4 * rng.random(n); a = 2.6 * t + c * np.pi
    X = np.column_stack([t * np.cos(a), t * np.sin(a)]) + 0.12 * rng.normal(size=(n, 2))
    return X, np.where(rng.random(n) < flip, 1 - c, c)
Xtr, ytr = spirals(80, 52, 0.1); Xva, yva = spirals(600, 99)

def train(dropout=0.0, weight_decay=0.0, jitter=0.0, epochs=400, lr=0.01, hidden=48, seed=1):
    """Two hidden ReLU layers, full-batch AdamW (decoupled decay), optional inverted dropout and input jitter."""
    rng = np.random.default_rng(seed)
    P = [rng.normal(0, np.sqrt(2 / 2), (2, hidden)), np.zeros(hidden), rng.normal(0, np.sqrt(2 / hidden), (hidden, hidden)), np.zeros(hidden),
         rng.normal(0, np.sqrt(1 / hidden), (hidden, 2)), np.zeros(2)]
    m = [np.zeros_like(p) for p in P]; v = [np.zeros_like(p) for p in P]; log = []
    def forward(X, train_mode):
        h1 = np.maximum(0, X @ P[0] + P[1]); d1 = (rng.random(h1.shape) > dropout) / (1 - dropout) if train_mode and dropout else 1
        h1d = h1 * d1; h2 = np.maximum(0, h1d @ P[2] + P[3]); d2 = (rng.random(h2.shape) > dropout) / (1 - dropout) if train_mode and dropout else 1
        h2d = h2 * d2; z = h2d @ P[4] + P[5]
        return z, (X, h1, d1, h1d, h2, d2, h2d)
    def loss_acc(X, y):
        z, _ = forward(X, False); z = z - z.max(1, keepdims=True); p = np.exp(z) / np.exp(z).sum(1, keepdims=True)
        return -np.mean(np.log(p[np.arange(len(y)), y] + 1e-12)), np.mean(p.argmax(1) == y)
    for e in range(epochs + 1):
        if e % 10 == 0: log.append((e, *loss_acc(Xtr, ytr), *loss_acc(Xva, yva)))
        if e == epochs: break
        Xb = Xtr + jitter * rng.normal(size=Xtr.shape) if jitter else Xtr
        z, (X, h1, d1, h1d, h2, d2, h2d) = forward(Xb, True)
        p = np.exp(z - z.max(1, keepdims=True)); p /= p.sum(1, keepdims=True); p[np.arange(len(ytr)), ytr] -= 1; g = p / len(ytr)
        G = [None] * 6; G[4] = h2d.T @ g; G[5] = g.sum(0); gh2 = (g @ P[4].T) * d2 * (h2 > 0)
        G[2] = h1d.T @ gh2; G[3] = gh2.sum(0); gh1 = (gh2 @ P[2].T) * d1 * (h1 > 0); G[0] = X.T @ gh1; G[1] = gh1.sum(0)
        for i in range(6):                                  # AdamW: Adam step, then decoupled decay on the weights only
            m[i] = 0.9 * m[i] + 0.1 * G[i]; v[i] = 0.999 * v[i] + 0.001 * G[i] ** 2
            P[i] -= lr * (m[i] / (1 - 0.9 ** (e + 1))) / (np.sqrt(v[i] / (1 - 0.999 ** (e + 1))) + 1e-8)
            if i % 2 == 0: P[i] -= lr * weight_decay * P[i]
    return np.array(log)                                    # columns: epoch, train loss, train acc, val loss, val acc

log = train(epochs=1500)
best = log[np.argmin(log[:, 3])]
print(f"parameters: {2 * 48 + 48 + 48 * 48 + 48 + 48 * 2 + 2:,}; training points: 80 (8 mislabelled)")
print(f"after 1,500 epochs: training accuracy {log[-1, 2]:.3f}, validation accuracy {log[-1, 4]:.3f}")
print(f"validation loss is lowest at epoch {best[0]:.0f} ({best[3]:.3f}, accuracy {best[4]:.3f}); at epoch 1,500 it is {log[-1, 3]:.3f}")
print("epoch  train loss  val loss:", "  ".join(f"{e:.0f}:{tl:.2f}/{vl:.2f}" for e, tl, _, vl, _ in log[::25]))`,
        },
      ],
    },
  },
  'l52-dropout': {
    formulaTex: '$$\\begin{aligned} h &\\leftarrow h \\odot m / (1 - p),\\ \\ m \\sim \\mathrm{Bernoulli}(1 - p) \\\\ w &\\leftarrow w - \\eta(\\text{Adam step} + \\lambda w) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['mask', '(rng.random(h.shape) > p) / (1 - p)', 'Inverted dropout: expectation unchanged.'],
        ['AdamW', 'P[i] -= lr * weight_decay * P[i]', 'Decoupled decay on the weights only.'],
      ],
    },
    notebook: {
      title: 'Lab 52.2 · Dropout and weight decay',
      intro: 'Inverted dropout checked in expectation, then dropout and decoupled weight decay on the spirals.',
      cells: [
        {
          title: 'Dropout and decay',
          prose: '**Predict** which lifts validation accuracy more.',
          code: `import numpy as np
def spirals(n, seed, flip=0.0):
    """The playground's two interleaved spirals; flip mislabels that share of points."""
    rng = np.random.default_rng(seed); c = np.arange(n) % 2; t = 0.25 + 2.4 * rng.random(n); a = 2.6 * t + c * np.pi
    X = np.column_stack([t * np.cos(a), t * np.sin(a)]) + 0.12 * rng.normal(size=(n, 2))
    return X, np.where(rng.random(n) < flip, 1 - c, c)
Xtr, ytr = spirals(80, 52, 0.1); Xva, yva = spirals(600, 99)

def train(dropout=0.0, weight_decay=0.0, jitter=0.0, epochs=400, lr=0.01, hidden=48, seed=1):
    """Two hidden ReLU layers, full-batch AdamW (decoupled decay), optional inverted dropout and input jitter."""
    rng = np.random.default_rng(seed)
    P = [rng.normal(0, np.sqrt(2 / 2), (2, hidden)), np.zeros(hidden), rng.normal(0, np.sqrt(2 / hidden), (hidden, hidden)), np.zeros(hidden),
         rng.normal(0, np.sqrt(1 / hidden), (hidden, 2)), np.zeros(2)]
    m = [np.zeros_like(p) for p in P]; v = [np.zeros_like(p) for p in P]; log = []
    def forward(X, train_mode):
        h1 = np.maximum(0, X @ P[0] + P[1]); d1 = (rng.random(h1.shape) > dropout) / (1 - dropout) if train_mode and dropout else 1
        h1d = h1 * d1; h2 = np.maximum(0, h1d @ P[2] + P[3]); d2 = (rng.random(h2.shape) > dropout) / (1 - dropout) if train_mode and dropout else 1
        h2d = h2 * d2; z = h2d @ P[4] + P[5]
        return z, (X, h1, d1, h1d, h2, d2, h2d)
    def loss_acc(X, y):
        z, _ = forward(X, False); z = z - z.max(1, keepdims=True); p = np.exp(z) / np.exp(z).sum(1, keepdims=True)
        return -np.mean(np.log(p[np.arange(len(y)), y] + 1e-12)), np.mean(p.argmax(1) == y)
    for e in range(epochs + 1):
        if e % 10 == 0: log.append((e, *loss_acc(Xtr, ytr), *loss_acc(Xva, yva)))
        if e == epochs: break
        Xb = Xtr + jitter * rng.normal(size=Xtr.shape) if jitter else Xtr
        z, (X, h1, d1, h1d, h2, d2, h2d) = forward(Xb, True)
        p = np.exp(z - z.max(1, keepdims=True)); p /= p.sum(1, keepdims=True); p[np.arange(len(ytr)), ytr] -= 1; g = p / len(ytr)
        G = [None] * 6; G[4] = h2d.T @ g; G[5] = g.sum(0); gh2 = (g @ P[4].T) * d2 * (h2 > 0)
        G[2] = h1d.T @ gh2; G[3] = gh2.sum(0); gh1 = (gh2 @ P[2].T) * d1 * (h1 > 0); G[0] = X.T @ gh1; G[1] = gh1.sum(0)
        for i in range(6):                                  # AdamW: Adam step, then decoupled decay on the weights only
            m[i] = 0.9 * m[i] + 0.1 * G[i]; v[i] = 0.999 * v[i] + 0.001 * G[i] ** 2
            P[i] -= lr * (m[i] / (1 - 0.9 ** (e + 1))) / (np.sqrt(v[i] / (1 - 0.999 ** (e + 1))) + 1e-8)
            if i % 2 == 0: P[i] -= lr * weight_decay * P[i]
    return np.array(log)                                    # columns: epoch, train loss, train acc, val loss, val acc

rng = np.random.default_rng(0); h = rng.random(100000); p = 0.3
mask = (rng.random(100000) > p) / (1 - p)                   # inverted dropout: keep with 1 - p, scale by 1/(1 - p)
print(f"mean activation {h.mean():.4f}; after inverted dropout {np.mean(h * mask):.4f} — the same in expectation")
for name, kw in [("no regularization", {}), ("dropout 0.3", dict(dropout=0.3)), ("weight decay 1", dict(weight_decay=1.0))]:
    log = train(**kw)
    print(f"{name:18s} training accuracy {log[-1, 2]:.3f}, validation accuracy {log[-1, 4]:.3f}")
print(f"AdamW with lr 0.01 and decay 0.5 shrinks a weight by {0.01 * 0.5} of itself per step")`,
        },
      ],
    },
  },
  'l52-augment': {
    formulaTex: '$$(x + \\varepsilon,\\ y), \\qquad \\varepsilon \\sim \\mathcal N(0, \\sigma^2 I)$$',
    mathCode: {
      rows: [
        ['jitter', 'Xtr + jitter * rng.normal(size=Xtr.shape)', 'A fresh noisy copy of the inputs every epoch; labels unchanged.'],
      ],
    },
    notebook: {
      title: 'Lab 52.3 · Data augmentation',
      intro: 'Input jitter at two strengths, and all three regularizers stacked.',
      cells: [
        {
          title: 'Input jitter',
          prose: '**Predict** whether stacking all three regularizers beats jitter alone.',
          code: `import numpy as np
def spirals(n, seed, flip=0.0):
    """The playground's two interleaved spirals; flip mislabels that share of points."""
    rng = np.random.default_rng(seed); c = np.arange(n) % 2; t = 0.25 + 2.4 * rng.random(n); a = 2.6 * t + c * np.pi
    X = np.column_stack([t * np.cos(a), t * np.sin(a)]) + 0.12 * rng.normal(size=(n, 2))
    return X, np.where(rng.random(n) < flip, 1 - c, c)
Xtr, ytr = spirals(80, 52, 0.1); Xva, yva = spirals(600, 99)

def train(dropout=0.0, weight_decay=0.0, jitter=0.0, epochs=400, lr=0.01, hidden=48, seed=1):
    """Two hidden ReLU layers, full-batch AdamW (decoupled decay), optional inverted dropout and input jitter."""
    rng = np.random.default_rng(seed)
    P = [rng.normal(0, np.sqrt(2 / 2), (2, hidden)), np.zeros(hidden), rng.normal(0, np.sqrt(2 / hidden), (hidden, hidden)), np.zeros(hidden),
         rng.normal(0, np.sqrt(1 / hidden), (hidden, 2)), np.zeros(2)]
    m = [np.zeros_like(p) for p in P]; v = [np.zeros_like(p) for p in P]; log = []
    def forward(X, train_mode):
        h1 = np.maximum(0, X @ P[0] + P[1]); d1 = (rng.random(h1.shape) > dropout) / (1 - dropout) if train_mode and dropout else 1
        h1d = h1 * d1; h2 = np.maximum(0, h1d @ P[2] + P[3]); d2 = (rng.random(h2.shape) > dropout) / (1 - dropout) if train_mode and dropout else 1
        h2d = h2 * d2; z = h2d @ P[4] + P[5]
        return z, (X, h1, d1, h1d, h2, d2, h2d)
    def loss_acc(X, y):
        z, _ = forward(X, False); z = z - z.max(1, keepdims=True); p = np.exp(z) / np.exp(z).sum(1, keepdims=True)
        return -np.mean(np.log(p[np.arange(len(y)), y] + 1e-12)), np.mean(p.argmax(1) == y)
    for e in range(epochs + 1):
        if e % 10 == 0: log.append((e, *loss_acc(Xtr, ytr), *loss_acc(Xva, yva)))
        if e == epochs: break
        Xb = Xtr + jitter * rng.normal(size=Xtr.shape) if jitter else Xtr
        z, (X, h1, d1, h1d, h2, d2, h2d) = forward(Xb, True)
        p = np.exp(z - z.max(1, keepdims=True)); p /= p.sum(1, keepdims=True); p[np.arange(len(ytr)), ytr] -= 1; g = p / len(ytr)
        G = [None] * 6; G[4] = h2d.T @ g; G[5] = g.sum(0); gh2 = (g @ P[4].T) * d2 * (h2 > 0)
        G[2] = h1d.T @ gh2; G[3] = gh2.sum(0); gh1 = (gh2 @ P[2].T) * d1 * (h1 > 0); G[0] = X.T @ gh1; G[1] = gh1.sum(0)
        for i in range(6):                                  # AdamW: Adam step, then decoupled decay on the weights only
            m[i] = 0.9 * m[i] + 0.1 * G[i]; v[i] = 0.999 * v[i] + 0.001 * G[i] ** 2
            P[i] -= lr * (m[i] / (1 - 0.9 ** (e + 1))) / (np.sqrt(v[i] / (1 - 0.999 ** (e + 1))) + 1e-8)
            if i % 2 == 0: P[i] -= lr * weight_decay * P[i]
    return np.array(log)                                    # columns: epoch, train loss, train acc, val loss, val acc

for name, kw in [("jitter 0.15", dict(jitter=0.15)), ("jitter 0.25", dict(jitter=0.25)), ("dropout + decay + jitter 0.15", dict(dropout=0.3, weight_decay=1.0, jitter=0.15))]:
    log = train(**kw)
    print(f"{name:30s} training accuracy {log[-1, 2]:.3f}, validation accuracy {log[-1, 4]:.3f}")`,
        },
      ],
    },
  },
  'l52-norm': {
    formulaTex: '$$\\mathrm{BN}(x) = \\gamma\\,\\frac{x - \\mu_B}{\\sqrt{\\sigma_B^2 + \\epsilon}} + \\beta$$',
    mathCode: {
      rows: [
        ['$\\mu_B$, $\\sigma_B^2$', 'x.mean(0), x.var(0)', 'Batch statistics (training mode).'],
        ['running', 'running["mu"], running["var"]', 'Averages used in evaluation mode.'],
        ['LN', '(x - x.mean(1)) / sqrt(x.var(1))', 'Statistics over one example’s features.'],
      ],
    },
    notebook: {
      title: 'Lab 52.4 · Normalization layers',
      intro: 'Batch norm in training and evaluation modes — and what training mode does to a single example.',
      cells: [
        {
          title: 'Train mode and eval mode',
          prose: '**Predict** batch norm’s output for one example in training mode.',
          code: `import numpy as np
rng = np.random.default_rng(52)
x = rng.normal(3, 2, size=(64, 4))                          # a mini-batch: 64 examples, 4 features
def batch_norm(x, gamma, beta, mode, running, eps=1e-5, momentum=0.1):
    if mode == "train":
        mu, var = x.mean(0), x.var(0)
        running["mu"] = (1 - momentum) * running["mu"] + momentum * mu; running["var"] = (1 - momentum) * running["var"] + momentum * var
    else:
        mu, var = running["mu"], running["var"]
    return gamma * (x - mu) / np.sqrt(var + eps) + beta
running = {"mu": np.zeros(4), "var": np.ones(4)}
for _ in range(200):                                         # training updates the running statistics
    batch_norm(rng.normal(3, 2, size=(64, 4)), 1, 0, "train", running)
y = batch_norm(x, 1, 0, "train", running)
print(f"train mode: per-feature mean {np.round(y.mean(0), 3)}, sd {np.round(y.std(0), 3)}")
one = x[:1]
print("one example, train mode (its own 'batch'):", np.round(batch_norm(one, 1, 0, "train", dict(running)), 3), "— all zeros: the example is erased")
print("one example, eval mode (running statistics):", np.round(batch_norm(one, 1, 0, "eval", running), 3))
ln = (x - x.mean(1, keepdims=True)) / np.sqrt(x.var(1, keepdims=True) + 1e-5)
print("layer norm of example 0 alone equals it inside the batch:", np.allclose(ln[0], ((x[0] - x[0].mean()) / np.sqrt(x[0].var() + 1e-5))))`,
        },
      ],
    },
  },
  'l52-residual': {
    formulaTex: '$$y = x + f(x), \\qquad \\frac{\\partial L}{\\partial x} = \\frac{\\partial L}{\\partial y}\\Big(I + \\frac{\\partial f}{\\partial x}\\Big)$$',
    mathCode: {
      rows: [
        ['block', 'hs[-1] + np.tanh(hs[-1] @ W)', 'A residual tanh block.'],
        ['backward', 'gh = gh + gf @ W.T', 'The identity path carries the gradient straight back.'],
      ],
    },
    notebook: {
      title: 'Lab 52.5 · Residual connections and very deep networks',
      intro: 'Plain against residual tanh networks at depths 2, 8 and 16, trained for 100 steps on the noisy spirals.',
      cells: [
        {
          title: 'Depth with and without residuals',
          prose: '**Predict** at which depth the plain network falls behind.',
          code: `import numpy as np
def spirals(n, seed):
    rng = np.random.default_rng(seed); c = np.arange(n) % 2; t = 0.25 + 2.4 * rng.random(n); a = 2.6 * t + c * np.pi
    return np.column_stack([t * np.cos(a), t * np.sin(a)]) + 0.12 * rng.normal(size=(n, 2)), c
X, y = spirals(80, 52)
y = np.where(np.random.default_rng(7).random(80) < 0.1, 1 - y, y)   # 10% of labels flipped, as in the playground
def train_deep(depth, residual, steps=100, width=16, lr=0.003, seed=3):
    """depth tanh blocks (Xavier), plain h = tanh(hW) or residual h = h + tanh(hW); Adam, full batch; returns the losses."""
    rng = np.random.default_rng(seed)
    P = [rng.normal(0, np.sqrt(1 / 2), (2, width))] + [rng.normal(0, np.sqrt(1 / width), (width, width)) for _ in range(depth)] + [rng.normal(0, np.sqrt(1 / width), (width, 2))]
    m = [np.zeros_like(p) for p in P]; v = [np.zeros_like(p) for p in P]; losses = []
    for s in range(steps):
        hs = [np.tanh(X @ P[0])]
        for W in P[1:-1]:
            f = np.tanh(hs[-1] @ W); hs.append(hs[-1] + f if residual else f)
        z = hs[-1] @ P[-1]; p = np.exp(z - z.max(1, keepdims=True)); p /= p.sum(1, keepdims=True)
        losses.append(-np.mean(np.log(p[np.arange(80), y])))
        g = p.copy(); g[np.arange(80), y] -= 1; g /= 80
        G = [None] * len(P); G[-1] = hs[-1].T @ g; gh = g @ P[-1].T
        for i in range(depth, 0, -1):
            pre = hs[i - 1] @ P[i]; gf = gh * (1 - np.tanh(pre) ** 2)
            G[i] = hs[i - 1].T @ gf; gh = (gh if residual else 0) + gf @ P[i].T    # the residual path carries gh straight back
        G[0] = X.T @ (gh * (1 - hs[0] ** 2))
        for i in range(len(P)):
            m[i] = 0.9 * m[i] + 0.1 * G[i]; v[i] = 0.999 * v[i] + 0.001 * G[i] ** 2
            P[i] -= lr * (m[i] / (1 - 0.9 ** (s + 1))) / (np.sqrt(v[i] / (1 - 0.999 ** (s + 1))) + 1e-8)
    return losses
for depth in [2, 8, 16]:
    plain = [train_deep(depth, False, seed=s)[-1] for s in (1, 2, 3)]; res = [train_deep(depth, True, seed=s)[-1] for s in (1, 2, 3)]
    print(f"depth {depth:2d}: training loss after 100 steps (3 starts) — plain {np.round(plain, 3)}, residual {np.round(res, 3)}")`,
        },
      ],
    },
  },
}
