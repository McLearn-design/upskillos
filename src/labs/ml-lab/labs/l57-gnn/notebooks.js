// Lab 57 runnable cells, typeset formulas and math ↔ code tables, keyed by lesson id.
// The graph follows the playground's stochastic block model (90 nodes, 3 communities, same probabilities and feature
// noise) with NumPy draws, so it has 229 edges rather than 230 and its numbers differ in detail. The GCN and MLP are
// NumPy copies of the playground's (Adam, weight decay 5e-3, 200 epochs).

export const extras = {
  'l57-graphs': {
    formulaTex: '$$\\begin{aligned} A_{ij} &= 1 \\text{ if } i \\sim j, \\quad X \\in \\mathbb R^{n \\times d} \\\\ f(PAP^\\top, PX) &= P\\,f(A, X) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$A$', 'A (90 × 90)', 'Adjacency: symmetric, zero diagonal.'],
        ['$X$', 'X (90 × 8)', 'One feature row per node.'],
        ['$P$', 'np.eye(n)[perm]', 'A permutation matrix: relabels the nodes.'],
      ],
    },
    notebook: {
      title: 'Lab 57.1 · Data as graphs',
      intro: 'The playground’s graph in numbers, homophily, and a check that one propagation step is permutation equivariant.',
      cells: [
        {
          title: 'The graph and equivariance',
          prose: '**Predict** the share of edges that join nodes of the same community.',
          code: `import numpy as np

def make_graph(n=90, k=3, p_in=0.16, p_out=0.012, feat_noise=1.6, dim=8, seed=57):
    """The playground's stochastic block model: 3 communities, dense inside, sparse between; noisy node features."""
    rng = np.random.default_rng(seed); y = np.arange(n) % k
    same = y[:, None] == y[None]; A = (rng.random((n, n)) < np.where(same, p_in, p_out)).astype(float)
    A = np.triu(A, 1); A = A + A.T
    protos = rng.normal(size=(k, dim)); X = 0.6 * protos[y] + feat_noise * rng.normal(size=(n, dim))
    return A, X, y
A, X, y = make_graph(); n, K = len(y), 3

def norm_adj(A):
    """A-hat = D^(-1/2) (A + I) D^(-1/2)."""
    At = A + np.eye(len(A)); d = At.sum(1); return At / np.sqrt(np.outer(d, d))
Ah = norm_adj(A)

def labelled(per, seed):
    rng = np.random.default_rng(seed); return np.concatenate([rng.choice(np.where(y == c)[0], per, replace=False) for c in range(K)])

def train(kind, L, layers=2, hidden=16, epochs=200, lr=0.02, wd=5e-3, seed=1):
    """GCN (H' = relu(A-hat H W)) or a features-only MLP; cross-entropy on the labelled nodes; Adam with weight decay."""
    rng = np.random.default_rng(seed); dims = [X.shape[1]] + [hidden] * (layers - 1) + [K]
    W = [rng.normal(0, np.sqrt(2 / (a + b)), (a, b)) for a, b in zip(dims, dims[1:])]; b = [np.zeros(d) for d in dims[1:]]
    P = W + b; M = [0 * p for p in P]; S = [0 * p for p in P]
    agg = (lambda H: Ah @ H) if kind == 'gcn' else (lambda H: H)
    for t in range(1, epochs + 1):
        Hs, Zs = [X], []
        for i in range(layers):
            Z = agg(Hs[-1]) @ W[i] + b[i]; Zs.append(Z); Hs.append(np.maximum(0, Z) if i < layers - 1 else Z)
        q = np.exp(Hs[-1] - Hs[-1].max(1, keepdims=True)); q /= q.sum(1, keepdims=True)
        g = np.zeros_like(q); g[L] = q[L]; g[L, y[L]] -= 1; g /= len(L)
        G = [None] * (2 * layers)
        for i in reversed(range(layers)):
            if i < layers - 1: g = g * (Zs[i] > 0)
            G[i] = agg(Hs[i]).T @ g; G[layers + i] = g.sum(0); g = agg(g @ W[i].T)   # A-hat is symmetric
        for j, (p, gr) in enumerate(zip(P, G)):
            gr = gr + wd * p; M[j] = 0.9 * M[j] + 0.1 * gr; S[j] = 0.999 * S[j] + 0.001 * gr ** 2
            p -= lr * (M[j] / (1 - 0.9 ** t)) / (np.sqrt(S[j] / (1 - 0.999 ** t)) + 1e-8)
    unl = np.setdiff1d(np.arange(n), L); return float(np.mean(Hs[-1][unl].argmax(1) == y[unl]))

deg = A.sum(1); edges = int(A.sum() / 2)
same = sum(A[i, j] for i in range(n) for j in range(i + 1, n) if y[i] == y[j])
print(f"{n} nodes, {edges} edges, mean degree {deg.mean():.2f} (min {deg.min():.0f}, max {deg.max():.0f})")
print(f"homophily: {same / edges:.0%} of edges join nodes of the same community")
print(f"adjacency stored densely: {A.size:,} numbers; as neighbour lists: {2 * edges:,} entries")

# Permutation equivariance: relabel the nodes with a random permutation; one propagation step A-hat X is relabelled the same way.
perm = np.random.default_rng(1).permutation(n); Pm = np.eye(n)[perm]
out, out_perm = norm_adj(A) @ X, norm_adj(Pm @ A @ Pm.T) @ (Pm @ X)
print(f"max |P (A-hat X) - (P A-hat P^T)(P X)| = {np.abs(Pm @ out - out_perm).max():.1e}  (equivariant)")
flat = lambda Z: Z.ravel()[:5]
print(f"an MLP that reads the flattened adjacency is not: first inputs {flat(A)} become {flat(Pm @ A @ Pm.T)} after relabelling")`,
        },
      ],
    },
  },
  'l57-mp': {
    formulaTex: '$$h_v^{(\\ell+1)} = \\phi\\Big(h_v^{(\\ell)},\\ \\bigoplus_{u \\in \\mathcal N(v)} \\psi\\big(h_u^{(\\ell)}\\big)\\Big)$$',
    mathCode: {
      rows: [
        ['$\\bigoplus$', 'msgs.sum(), msgs.mean(), msgs.max()', 'Permutation-invariant aggregators.'],
        ['receptive field', '(R @ (A + np.eye(n)) > 0)', 'Nodes within L hops after L layers.'],
      ],
    },
    notebook: {
      title: 'Lab 57.2 · Message passing',
      intro: 'Three aggregators on one node, and how fast the receptive field grows on the playground’s graph.',
      cells: [
        {
          title: 'Aggregators and receptive fields',
          prose: '**Predict** the share of the graph a node sees after 3 layers.',
          code: `import numpy as np

def make_graph(n=90, k=3, p_in=0.16, p_out=0.012, feat_noise=1.6, dim=8, seed=57):
    """The playground's stochastic block model: 3 communities, dense inside, sparse between; noisy node features."""
    rng = np.random.default_rng(seed); y = np.arange(n) % k
    same = y[:, None] == y[None]; A = (rng.random((n, n)) < np.where(same, p_in, p_out)).astype(float)
    A = np.triu(A, 1); A = A + A.T
    protos = rng.normal(size=(k, dim)); X = 0.6 * protos[y] + feat_noise * rng.normal(size=(n, dim))
    return A, X, y
A, X, y = make_graph(); n, K = len(y), 3

def norm_adj(A):
    """A-hat = D^(-1/2) (A + I) D^(-1/2)."""
    At = A + np.eye(len(A)); d = At.sum(1); return At / np.sqrt(np.outer(d, d))
Ah = norm_adj(A)

def labelled(per, seed):
    rng = np.random.default_rng(seed); return np.concatenate([rng.choice(np.where(y == c)[0], per, replace=False) for c in range(K)])

def train(kind, L, layers=2, hidden=16, epochs=200, lr=0.02, wd=5e-3, seed=1):
    """GCN (H' = relu(A-hat H W)) or a features-only MLP; cross-entropy on the labelled nodes; Adam with weight decay."""
    rng = np.random.default_rng(seed); dims = [X.shape[1]] + [hidden] * (layers - 1) + [K]
    W = [rng.normal(0, np.sqrt(2 / (a + b)), (a, b)) for a, b in zip(dims, dims[1:])]; b = [np.zeros(d) for d in dims[1:]]
    P = W + b; M = [0 * p for p in P]; S = [0 * p for p in P]
    agg = (lambda H: Ah @ H) if kind == 'gcn' else (lambda H: H)
    for t in range(1, epochs + 1):
        Hs, Zs = [X], []
        for i in range(layers):
            Z = agg(Hs[-1]) @ W[i] + b[i]; Zs.append(Z); Hs.append(np.maximum(0, Z) if i < layers - 1 else Z)
        q = np.exp(Hs[-1] - Hs[-1].max(1, keepdims=True)); q /= q.sum(1, keepdims=True)
        g = np.zeros_like(q); g[L] = q[L]; g[L, y[L]] -= 1; g /= len(L)
        G = [None] * (2 * layers)
        for i in reversed(range(layers)):
            if i < layers - 1: g = g * (Zs[i] > 0)
            G[i] = agg(Hs[i]).T @ g; G[layers + i] = g.sum(0); g = agg(g @ W[i].T)   # A-hat is symmetric
        for j, (p, gr) in enumerate(zip(P, G)):
            gr = gr + wd * p; M[j] = 0.9 * M[j] + 0.1 * gr; S[j] = 0.999 * S[j] + 0.001 * gr ** 2
            p -= lr * (M[j] / (1 - 0.9 ** t)) / (np.sqrt(S[j] / (1 - 0.999 ** t)) + 1e-8)
    unl = np.setdiff1d(np.arange(n), L); return float(np.mean(Hs[-1][unl].argmax(1) == y[unl]))

# One round of message passing on a star: node 0 has neighbours 1, 2 and 3; each node has one feature.
h = np.array([1.0, 2.0, 4.0, 6.0]); nbrs = {0: [1, 2, 3]}
msgs = h[nbrs[0]]
print(f"messages into node 0: {msgs}; sum {msgs.sum()}, mean {msgs.mean():.2f}, max {msgs.max()}")
print("add a fourth neighbour with the same feature 6: sum grows to", msgs.sum() + 6, "while mean becomes", round((msgs.sum() + 6) / 4, 2), "-- sum counts neighbours, mean does not")

# Receptive field: after L layers a node depends on every node within L hops, i.e. the nonzeros of (A + I)^L.
R = np.eye(n)
for L in range(1, 5):
    R = (R @ (A + np.eye(n)) > 0).astype(float)
    other = np.mean([R[i][y != y[i]].sum() / R[i].sum() for i in range(n)])
    print(f"{L} layer(s): a node sees on average {R.sum(1).mean():5.1f} of {n} nodes ({R.sum(1).mean() / n:.0%}); {other:.0%} of them from other communities")`,
        },
      ],
    },
  },
  'l57-gcn': {
    formulaTex: '$$\\begin{aligned} H\' &= \\sigma\\big(\\hat A H W\\big) \\\\ \\hat A &= D^{-1/2}(A + I)\\,D^{-1/2} \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\hat A$', 'At / np.sqrt(np.outer(d, d))', 'Self-loops, then symmetric degree normalization.'],
        ['$\\hat A H W$', 'Ah @ H @ W[i] + b[i]', 'Aggregate neighbours, then a shared dense layer.'],
        ['baselines', 'train(\'mlp\', L), propagate_labels(L)', 'Features only; structure only.'],
      ],
    },
    notebook: {
      title: 'Lab 57.3 · Graph convolutional networks',
      intro: 'The GCN against features only and structure only, with 2 labels per community over five choices of labelled nodes.',
      cells: [
        {
          title: 'Features, structure, or both',
          prose: '**Predict** which of the three wins on this graph, whose features are very noisy and whose edges are 87% within communities.',
          code: `import numpy as np

def make_graph(n=90, k=3, p_in=0.16, p_out=0.012, feat_noise=1.6, dim=8, seed=57):
    """The playground's stochastic block model: 3 communities, dense inside, sparse between; noisy node features."""
    rng = np.random.default_rng(seed); y = np.arange(n) % k
    same = y[:, None] == y[None]; A = (rng.random((n, n)) < np.where(same, p_in, p_out)).astype(float)
    A = np.triu(A, 1); A = A + A.T
    protos = rng.normal(size=(k, dim)); X = 0.6 * protos[y] + feat_noise * rng.normal(size=(n, dim))
    return A, X, y
A, X, y = make_graph(); n, K = len(y), 3

def norm_adj(A):
    """A-hat = D^(-1/2) (A + I) D^(-1/2)."""
    At = A + np.eye(len(A)); d = At.sum(1); return At / np.sqrt(np.outer(d, d))
Ah = norm_adj(A)

def labelled(per, seed):
    rng = np.random.default_rng(seed); return np.concatenate([rng.choice(np.where(y == c)[0], per, replace=False) for c in range(K)])

def train(kind, L, layers=2, hidden=16, epochs=200, lr=0.02, wd=5e-3, seed=1):
    """GCN (H' = relu(A-hat H W)) or a features-only MLP; cross-entropy on the labelled nodes; Adam with weight decay."""
    rng = np.random.default_rng(seed); dims = [X.shape[1]] + [hidden] * (layers - 1) + [K]
    W = [rng.normal(0, np.sqrt(2 / (a + b)), (a, b)) for a, b in zip(dims, dims[1:])]; b = [np.zeros(d) for d in dims[1:]]
    P = W + b; M = [0 * p for p in P]; S = [0 * p for p in P]
    agg = (lambda H: Ah @ H) if kind == 'gcn' else (lambda H: H)
    for t in range(1, epochs + 1):
        Hs, Zs = [X], []
        for i in range(layers):
            Z = agg(Hs[-1]) @ W[i] + b[i]; Zs.append(Z); Hs.append(np.maximum(0, Z) if i < layers - 1 else Z)
        q = np.exp(Hs[-1] - Hs[-1].max(1, keepdims=True)); q /= q.sum(1, keepdims=True)
        g = np.zeros_like(q); g[L] = q[L]; g[L, y[L]] -= 1; g /= len(L)
        G = [None] * (2 * layers)
        for i in reversed(range(layers)):
            if i < layers - 1: g = g * (Zs[i] > 0)
            G[i] = agg(Hs[i]).T @ g; G[layers + i] = g.sum(0); g = agg(g @ W[i].T)   # A-hat is symmetric
        for j, (p, gr) in enumerate(zip(P, G)):
            gr = gr + wd * p; M[j] = 0.9 * M[j] + 0.1 * gr; S[j] = 0.999 * S[j] + 0.001 * gr ** 2
            p -= lr * (M[j] / (1 - 0.9 ** t)) / (np.sqrt(S[j] / (1 - 0.999 ** t)) + 1e-8)
    unl = np.setdiff1d(np.arange(n), L); return float(np.mean(Hs[-1][unl].argmax(1) == y[unl]))

def propagate_labels(L, alpha=0.99, iters=100):
    """Structure only: label propagation on the graph (Lab 56)."""
    d = A.sum(1) + 1e-12; S = A / np.sqrt(np.outer(d, d)); Y = np.zeros((n, K)); Y[L, y[L]] = 1; F = Y.copy()
    for _ in range(iters): F = alpha * S @ F + (1 - alpha) * Y
    F = F / F.sum(0)                     # class mass normalization: stop one well-connected label from swamping the rest
    unl = np.setdiff1d(np.arange(n), L); return float(np.mean(F[unl].argmax(1) == y[unl]))

print("2 labelled nodes per community; accuracy on the unlabelled nodes, for 5 choices of labelled nodes")
for name, f in (('features only (MLP)', lambda L: train('mlp', L)), ('structure only (label propagation)', propagate_labels), ('both (GCN)', lambda L: train('gcn', L))):
    accs = [f(labelled(2, s)) for s in range(1, 6)]
    print(f"  {name:36s} {' '.join(f'{a:.2f}' for a in accs)}   mean {np.mean(accs):.3f}")
print(f"chance: {1 / K:.3f}")`,
        },
      ],
    },
  },
  'l57-depth': {
    formulaTex: '$$\\hat A^k X \\ \\xrightarrow{k \\to \\infty}\\ v\\,c^\\top, \\quad v \\propto \\sqrt{\\deg + 1}$$',
    mathCode: {
      rows: [
        ['$\\hat A^k X$', 'H = Ah @ H (k times)', 'Untrained propagation.'],
        ['$v$', 'np.linalg.eigh(Ah)[1][:, -1]', 'Leading eigenvector: every column converges to it.'],
      ],
    },
    notebook: {
      title: 'Lab 57.4 · Depth and over-smoothing',
      intro: 'Feature spread and a centroid probe as propagation repeats, the limit it converges to, and trained GCNs of 1–6 layers.',
      cells: [
        {
          title: 'Over-smoothing',
          prose: '**Predict** after how many propagation steps the probe is most accurate.',
          code: `import numpy as np

def make_graph(n=90, k=3, p_in=0.16, p_out=0.012, feat_noise=1.6, dim=8, seed=57):
    """The playground's stochastic block model: 3 communities, dense inside, sparse between; noisy node features."""
    rng = np.random.default_rng(seed); y = np.arange(n) % k
    same = y[:, None] == y[None]; A = (rng.random((n, n)) < np.where(same, p_in, p_out)).astype(float)
    A = np.triu(A, 1); A = A + A.T
    protos = rng.normal(size=(k, dim)); X = 0.6 * protos[y] + feat_noise * rng.normal(size=(n, dim))
    return A, X, y
A, X, y = make_graph(); n, K = len(y), 3

def norm_adj(A):
    """A-hat = D^(-1/2) (A + I) D^(-1/2)."""
    At = A + np.eye(len(A)); d = At.sum(1); return At / np.sqrt(np.outer(d, d))
Ah = norm_adj(A)

def labelled(per, seed):
    rng = np.random.default_rng(seed); return np.concatenate([rng.choice(np.where(y == c)[0], per, replace=False) for c in range(K)])

def train(kind, L, layers=2, hidden=16, epochs=200, lr=0.02, wd=5e-3, seed=1):
    """GCN (H' = relu(A-hat H W)) or a features-only MLP; cross-entropy on the labelled nodes; Adam with weight decay."""
    rng = np.random.default_rng(seed); dims = [X.shape[1]] + [hidden] * (layers - 1) + [K]
    W = [rng.normal(0, np.sqrt(2 / (a + b)), (a, b)) for a, b in zip(dims, dims[1:])]; b = [np.zeros(d) for d in dims[1:]]
    P = W + b; M = [0 * p for p in P]; S = [0 * p for p in P]
    agg = (lambda H: Ah @ H) if kind == 'gcn' else (lambda H: H)
    for t in range(1, epochs + 1):
        Hs, Zs = [X], []
        for i in range(layers):
            Z = agg(Hs[-1]) @ W[i] + b[i]; Zs.append(Z); Hs.append(np.maximum(0, Z) if i < layers - 1 else Z)
        q = np.exp(Hs[-1] - Hs[-1].max(1, keepdims=True)); q /= q.sum(1, keepdims=True)
        g = np.zeros_like(q); g[L] = q[L]; g[L, y[L]] -= 1; g /= len(L)
        G = [None] * (2 * layers)
        for i in reversed(range(layers)):
            if i < layers - 1: g = g * (Zs[i] > 0)
            G[i] = agg(Hs[i]).T @ g; G[layers + i] = g.sum(0); g = agg(g @ W[i].T)   # A-hat is symmetric
        for j, (p, gr) in enumerate(zip(P, G)):
            gr = gr + wd * p; M[j] = 0.9 * M[j] + 0.1 * gr; S[j] = 0.999 * S[j] + 0.001 * gr ** 2
            p -= lr * (M[j] / (1 - 0.9 ** t)) / (np.sqrt(S[j] / (1 - 0.999 ** t)) + 1e-8)
    unl = np.setdiff1d(np.arange(n), L); return float(np.mean(Hs[-1][unl].argmax(1) == y[unl]))

# Untrained propagation: H <- A-hat H, k times. Spread of the features, and a nearest-centroid probe
# built from 2 labelled nodes per community.
L = labelled(2, 1); H = X.copy()
for k in range(33):
    if k in (0, 1, 2, 4, 8, 16, 32):
        spread = np.mean(((H - H.mean(0)) ** 2).sum(1))
        cent = np.array([H[L[y[L] == c]].mean(0) for c in range(K)])
        probe = np.mean(((H[:, None] - cent[None]) ** 2).sum(-1).argmin(1) == y)
        print(f"after {k:2d} steps: feature spread {spread:8.3f}, probe accuracy {probe:.3f}")
    H = Ah @ H

# The limit: the leading eigenvector of A-hat is proportional to sqrt(degree + 1), so every column of H ends up
# proportional to it -- nodes differ only by degree, not by community.
v = np.linalg.eigh(Ah)[1][:, -1]; target = np.sqrt(A.sum(1) + 1)
print(f"|cos(leading eigenvector, sqrt(degree + 1))| = {abs(v @ target) / np.linalg.norm(target):.6f}")

print("trained GCN depth (2 labels per community, mean of 5 label choices):")
for layers in range(1, 7):
    print(f"  {layers} layer(s): {np.mean([train('gcn', labelled(2, s), layers=layers) for s in range(1, 6)]):.3f}")`,
        },
      ],
    },
  },
  'l57-practice': {
    formulaTex: '$$\\mathrm{score}(i, j) = z_i^\\top z_j, \\quad Z = \\mathrm{normalize}\\big(\\hat A^2 X\\big)$$',
    mathCode: {
      rows: [
        ['$z_i^\\top z_j$', '(Z[test[:, 0]] * Z[test[:, 1]]).sum(1)', 'Link score for a pair of nodes.'],
        ['honest graph', 'A_train (test edges removed)', 'Message passing must not see the edges being predicted.'],
      ],
    },
    notebook: {
      title: 'Lab 57.5 · GNNs in practice',
      intro: 'Link prediction scored with and without the test edges in the message-passing graph.',
      cells: [
        {
          title: 'Leakage in link prediction',
          prose: '**Predict** how much the leak inflates the AUC.',
          code: `import numpy as np

def make_graph(n=90, k=3, p_in=0.16, p_out=0.012, feat_noise=1.6, dim=8, seed=57):
    """The playground's stochastic block model: 3 communities, dense inside, sparse between; noisy node features."""
    rng = np.random.default_rng(seed); y = np.arange(n) % k
    same = y[:, None] == y[None]; A = (rng.random((n, n)) < np.where(same, p_in, p_out)).astype(float)
    A = np.triu(A, 1); A = A + A.T
    protos = rng.normal(size=(k, dim)); X = 0.6 * protos[y] + feat_noise * rng.normal(size=(n, dim))
    return A, X, y
A, X, y = make_graph(); n, K = len(y), 3

def norm_adj(A):
    """A-hat = D^(-1/2) (A + I) D^(-1/2)."""
    At = A + np.eye(len(A)); d = At.sum(1); return At / np.sqrt(np.outer(d, d))
Ah = norm_adj(A)

def labelled(per, seed):
    rng = np.random.default_rng(seed); return np.concatenate([rng.choice(np.where(y == c)[0], per, replace=False) for c in range(K)])

def train(kind, L, layers=2, hidden=16, epochs=200, lr=0.02, wd=5e-3, seed=1):
    """GCN (H' = relu(A-hat H W)) or a features-only MLP; cross-entropy on the labelled nodes; Adam with weight decay."""
    rng = np.random.default_rng(seed); dims = [X.shape[1]] + [hidden] * (layers - 1) + [K]
    W = [rng.normal(0, np.sqrt(2 / (a + b)), (a, b)) for a, b in zip(dims, dims[1:])]; b = [np.zeros(d) for d in dims[1:]]
    P = W + b; M = [0 * p for p in P]; S = [0 * p for p in P]
    agg = (lambda H: Ah @ H) if kind == 'gcn' else (lambda H: H)
    for t in range(1, epochs + 1):
        Hs, Zs = [X], []
        for i in range(layers):
            Z = agg(Hs[-1]) @ W[i] + b[i]; Zs.append(Z); Hs.append(np.maximum(0, Z) if i < layers - 1 else Z)
        q = np.exp(Hs[-1] - Hs[-1].max(1, keepdims=True)); q /= q.sum(1, keepdims=True)
        g = np.zeros_like(q); g[L] = q[L]; g[L, y[L]] -= 1; g /= len(L)
        G = [None] * (2 * layers)
        for i in reversed(range(layers)):
            if i < layers - 1: g = g * (Zs[i] > 0)
            G[i] = agg(Hs[i]).T @ g; G[layers + i] = g.sum(0); g = agg(g @ W[i].T)   # A-hat is symmetric
        for j, (p, gr) in enumerate(zip(P, G)):
            gr = gr + wd * p; M[j] = 0.9 * M[j] + 0.1 * gr; S[j] = 0.999 * S[j] + 0.001 * gr ** 2
            p -= lr * (M[j] / (1 - 0.9 ** t)) / (np.sqrt(S[j] / (1 - 0.999 ** t)) + 1e-8)
    unl = np.setdiff1d(np.arange(n), L); return float(np.mean(Hs[-1][unl].argmax(1) == y[unl]))

# Link prediction: hide 20% of the edges as a test set, score node pairs by the dot product of propagated
# features (embedding = A-hat^2 X, normalized), and compare test edges with an equal number of non-edges (AUC).
rng = np.random.default_rng(5); E = np.argwhere(np.triu(A, 1) > 0); rng.shuffle(E)
test = E[: len(E) // 5]; train_edges = E[len(E) // 5:]
non = []
while len(non) < len(test):
    i, j = rng.integers(0, n, 2)
    if i != j and A[i, j] == 0: non.append((i, j))
non = np.array(non)

def auc(graph_A):
    Z = norm_adj(graph_A) @ norm_adj(graph_A) @ X; Z /= np.linalg.norm(Z, axis=1, keepdims=True)
    pos, neg = (Z[test[:, 0]] * Z[test[:, 1]]).sum(1), (Z[non[:, 0]] * Z[non[:, 1]]).sum(1)
    return float(np.mean(pos[:, None] > neg[None]) + 0.5 * np.mean(pos[:, None] == neg[None]))

A_train = np.zeros_like(A); A_train[train_edges[:, 0], train_edges[:, 1]] = 1; A_train += A_train.T
print(f"{len(test)} test edges, {len(train_edges)} edges left for message passing")
print(f"AUC with the test edges removed from the graph (honest): {auc(A_train):.3f}")
print(f"AUC with the test edges still in the graph (leak):      {auc(A):.3f}")`,
        },
      ],
    },
  },
}
