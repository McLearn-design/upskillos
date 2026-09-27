// Lab 51 runnable cells, typeset formulas and math ↔ code tables, keyed by lesson id.
// The signals, the swiss roll and the three clusters follow the playground (NumPy draws); scikit-learn's FastICA, Isomap and TSNE are the references.

export const extras = {
  'l51-beyond': {
    formulaTex: '$$\\begin{aligned} &\\text{PCA: variance} \\quad \\text{ICA: non-Gaussianity} \\\\ &\\text{Isomap: geodesics} \\quad \\text{t-SNE: neighbourhoods} \\end{aligned}$$',
    mathCode: {
      rows: [
        ['PCA', 'PCA(2).fit_transform(X)', 'The linear baseline.'],
        ['check', 'spearmanr(Z[:, 0], t)', 'Does an axis track the known position along the roll?'],
      ],
    },
    notebook: {
      title: 'Lab 51.1 · When straight lines are not enough',
      intro: 'PCA on the swiss roll: most of the variance, none of the unrolling.',
      cells: [
        {
          title: 'PCA on a curved surface',
          prose: '**Predict** how well PCA’s first axis tracks the position along the roll.',
          code: `import numpy as np
from scipy.stats import spearmanr
def swiss_roll(n=300, seed=5):
    rng = np.random.default_rng(seed)
    t = 1.5 * np.pi * (1 + 2 * rng.random(n)); h = 12 * rng.random(n)
    return np.column_stack([t * np.cos(t), h, t * np.sin(t)]), t     # t: position along the roll

from sklearn.decomposition import PCA
X, t = swiss_roll(seed=2)
Z = PCA(2).fit_transform(X)
print(f"PCA axis 1 against the position along the roll: rank correlation {abs(spearmanr(Z[:, 0], t)[0]):.2f}")
print(f"PCA keeps {PCA(3).fit(X).explained_variance_ratio_[:2].sum():.0%} of the variance in 2 dimensions — and still folds the layers on top of each other")
print(f"a 256 x 256 grayscale image: {256 * 256:,} pixel dimensions")`,
        },
      ],
    },
  },
  'l51-ica': {
    formulaTex: '$$\\begin{aligned} x &= A s, \\qquad z = \\mathrm{whiten}(x) \\\\ w &\\leftarrow \\mathbb E[z\\,g(w^\\top z)] - \\mathbb E[g^\\prime(w^\\top z)]\\,w \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$A$', '[[1, 0.6], [0.45, 1]]', 'The unknown mixing matrix.'],
        ['kurtosis', 'kurtosis(S, axis=0)', '0 for Gaussian; positive spiky, negative flat.'],
        ['FastICA', 'FastICA(2, whiten="unit-variance")', 'Whitening, then the fixed-point update with g = tanh.'],
        ['match', 'max over the two pairings of |corr|', 'Recovery up to order and sign.'],
      ],
    },
    notebook: {
      title: 'Lab 51.2 · Independent component analysis',
      intro: 'Three source pairs mixed, then separated by PCA and by ICA from six starts.',
      cells: [
        {
          title: 'Unmixing',
          prose: '**Predict** which source pair ICA cannot recover.',
          code: `import numpy as np
from sklearn.decomposition import FastICA, PCA
from scipy.stats import kurtosis
rng = np.random.default_rng(51); n = 400; t = np.arange(n)
sources = {"sine + sawtooth": np.column_stack([np.sin(t / 8), (t / 13) % 2 - 1]),
           "two spiky voices": rng.laplace(size=(n, 2)) * np.column_stack([0.6 + 0.4 * np.sin(t / 40), np.ones(n)]),
           "two Gaussian noises": rng.normal(size=(n, 2))}
A = np.array([[1, 0.6], [0.45, 1]])                          # the mixing matrix
def match(Y, S):
    C = np.abs(np.corrcoef(Y.T, S.T)[:2, 2:])
    return max((C[0, 0] + C[1, 1]) / 2, (C[0, 1] + C[1, 0]) / 2)   # up to order and sign
for name, S in sources.items():
    S = (S - S.mean(0)) / S.std(0); X = S @ A.T
    starts = [match(FastICA(2, whiten="unit-variance", random_state=k).fit_transform(X), S) for k in range(6)]
    print(f"{name:20s} kurtosis {np.round(kurtosis(S, axis=0), 2)}; match: mixtures {match(X, S):.2f}, PCA {match(PCA(2, whiten=True).fit_transform(X), S):.2f}, "
          f"ICA over 6 starts {min(starts):.2f}-{max(starts):.2f}")`,
        },
      ],
    },
  },
  'l51-isomap': {
    formulaTex: '$$\\begin{aligned} &\\text{kNN graph} \\to D\\ (\\text{shortest paths}) \\\\ &B = -\\tfrac12 H D^2 H \\to \\sqrt{\\lambda}\\, v \\end{aligned}$$',
    mathCode: {
      rows: [
        ['kNN graph', 'kneighbors_graph(X, k, mode="distance")', 'Short straight hops along the surface.'],
        ['$D$', 'shortest_path(G, directed=False)', 'Geodesic distances through the graph.'],
        ['$B$', '-0.5 * H @ (D ** 2) @ H', 'Classical MDS on the geodesic distances.'],
      ],
    },
    notebook: {
      title: 'Lab 51.3 · Manifold learning with Isomap',
      intro: 'Isomap from scratch against scikit-learn, over k — and the same k on other samples of the roll.',
      cells: [
        {
          title: 'Isomap by hand',
          prose: '**Predict** whether k = 8 unrolls every sample of the roll.',
          code: `import numpy as np
from scipy.stats import spearmanr
def swiss_roll(n=300, seed=5):
    rng = np.random.default_rng(seed)
    t = 1.5 * np.pi * (1 + 2 * rng.random(n)); h = 12 * rng.random(n)
    return np.column_stack([t * np.cos(t), h, t * np.sin(t)]), t     # t: position along the roll

from scipy.sparse.csgraph import shortest_path
from sklearn.neighbors import kneighbors_graph
from sklearn.manifold import Isomap
X, t = swiss_roll(seed=2)
def isomap(X, k):
    G = kneighbors_graph(X, k, mode="distance")               # k nearest neighbours, edge length = distance
    D = shortest_path(G, directed=False)                      # geodesic distances through the graph (Dijkstra)
    n = len(X); H = np.eye(n) - 1 / n
    B = -0.5 * H @ (D ** 2) @ H                               # classical MDS: double-centre the squared distances
    vals, vecs = np.linalg.eigh(B)
    return vecs[:, ::-1][:, :2] * np.sqrt(vals[::-1][:2])
for k in [5, 8, 10, 12, 20]:
    Y = isomap(X, k)
    print(f"k = {k:2d}: Isomap axis 1 against the roll position, rank correlation {abs(spearmanr(Y[:, 0], t)[0]):.3f}")
sk = Isomap(n_neighbors=8, n_components=2).fit_transform(X)
print(f"scikit-learn Isomap (k = 8): {abs(spearmanr(sk[:, 0], t)[0]):.3f}")
print("the same k = 8 on four other samples of the roll:",
      [round(abs(spearmanr(isomap(Xs, 8)[:, 0], ts)[0]), 2) for Xs, ts in (swiss_roll(seed=s) for s in (1, 3, 4, 5))],
      "— one short-circuit edge in a sample is enough to spoil the unrolling")`,
        },
      ],
    },
  },
  'l51-tsne': {
    formulaTex: '$$\\begin{aligned} p(j \\mid i) &\\propto e^{-\\lVert x_i - x_j\\rVert^2 / 2\\sigma_i^2} \\\\ q_{ij} &\\propto (1 + \\lVert y_i - y_j\\rVert^2)^{-1}, \\quad \\min \\mathrm{KL}(P \\Vert Q) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\sigma_i$', 'binary search on beta = 1/(2σ²)', 'Chosen so the neighbour distribution has the target perplexity.'],
        ['perplexity', '2 ** (-np.sum(p * np.log2(p)))', 'Effective number of neighbours.'],
        ['t-SNE', 'TSNE(2, perplexity=px)', 'Heavy-tailed similarities in the map.'],
      ],
    },
    notebook: {
      title: 'Lab 51.4 · t-SNE',
      intro: 'Calibrating σ for one point, then maps at three perplexities with their spread and distance ratios.',
      cells: [
        {
          title: 'Perplexity and the map',
          prose: '**Predict** which perplexity keeps the 4 : 1 spread ratio best.',
          code: `import numpy as np
def tsne_data(seed=7):
    """The playground's clusters in 10 dimensions: blue tight at the origin, orange four times as wide at distance 6,
    green tight at distance 25 (so the true spread ratio orange : blue is 4 : 1 and the distance ratio about 4.2 : 1)."""
    rng = np.random.default_rng(seed); centres = np.zeros((3, 10)); centres[1, 0] = 6; centres[2, 1] = 25
    spec = [(60, 0.5), (60, 2.0), (30, 0.5)]
    X = np.vstack([centres[k] + sd * rng.normal(size=(n, 10)) for k, (n, sd) in enumerate(spec)])
    c = np.concatenate([[k] * n for k, (n, _) in enumerate(spec)])
    return X, c
def ratios(Y, c):
    cen = [Y[c == k].mean(0) for k in range(3)]; spread = [np.sqrt(np.mean(np.sum((Y[c == k] - cen[k]) ** 2, 1))) for k in range(3)]
    return spread[1] / spread[0], np.linalg.norm(cen[2] - cen[0]) / np.linalg.norm(cen[1] - cen[0])

from sklearn.manifold import TSNE
X, c = tsne_data()
# Perplexity calibration for one point: binary search for sigma so that 2^H of its neighbour distribution hits the target.
d2 = np.sum((X - X[0]) ** 2, 1)[1:]
def perplexity_at(beta):
    p = np.exp(-(d2 - d2.min()) * beta); p /= p.sum()
    return 2 ** (-np.sum(p * np.log2(np.maximum(p, 1e-300))))
lo, hi = 1e-6, 1e3
for _ in range(100):
    mid = np.sqrt(lo * hi)
    lo, hi = (mid, hi) if perplexity_at(mid) > 20 else (lo, mid)   # larger beta (smaller sigma) = fewer neighbours
print(f"point 0: sigma = {1 / np.sqrt(2 * mid):.3f} gives perplexity {perplexity_at(mid):.2f} (target 20)")
print(f"entropy 4.32 bits -> perplexity {2 ** 4.32:.1f}")
for px in [5, 20, 50]:
    Y = TSNE(2, perplexity=px, random_state=1, init="random").fit_transform(X)
    s, d = ratios(Y, c)
    print(f"t-SNE perplexity {px:2d}: spread ratio orange:blue {s:.1f} : 1 (true 4 : 1); distance ratio green:orange {d:.1f} : 1 (true 4.2 : 1)")`,
        },
      ],
    },
  },
  'l51-honest': {
    formulaTex: '$$\\begin{aligned} &\\text{trust: neighbourhoods} \\\\ &\\text{do not trust: sizes, gaps, densities, axes} \\end{aligned}$$',
    mathCode: {
      rows: [
        ['ratios', 'ratios(Y, c)', 'Spread and distance ratios in a map.'],
        ['original space', 'ratios(X, c)', 'The same ratios measured where they are real.'],
      ],
    },
    notebook: {
      title: 'Lab 51.5 · Reading maps honestly — and UMAP',
      intro: 'PCA, t-SNE over three seeds, and the original space, on the same ratios.',
      cells: [
        {
          title: 'Where to measure',
          prose: '**Predict** whether t-SNE’s spread ratio changes with the seed.',
          code: `import numpy as np
def tsne_data(seed=7):
    """The playground's clusters in 10 dimensions: blue tight at the origin, orange four times as wide at distance 6,
    green tight at distance 25 (so the true spread ratio orange : blue is 4 : 1 and the distance ratio about 4.2 : 1)."""
    rng = np.random.default_rng(seed); centres = np.zeros((3, 10)); centres[1, 0] = 6; centres[2, 1] = 25
    spec = [(60, 0.5), (60, 2.0), (30, 0.5)]
    X = np.vstack([centres[k] + sd * rng.normal(size=(n, 10)) for k, (n, sd) in enumerate(spec)])
    c = np.concatenate([[k] * n for k, (n, _) in enumerate(spec)])
    return X, c
def ratios(Y, c):
    cen = [Y[c == k].mean(0) for k in range(3)]; spread = [np.sqrt(np.mean(np.sum((Y[c == k] - cen[k]) ** 2, 1))) for k in range(3)]
    return spread[1] / spread[0], np.linalg.norm(cen[2] - cen[0]) / np.linalg.norm(cen[1] - cen[0])

from sklearn.manifold import TSNE
from sklearn.decomposition import PCA
X, c = tsne_data()
s, d = ratios(PCA(2).fit_transform(X), c)
print(f"PCA: spread ratio {s:.1f} : 1, distance ratio {d:.1f} : 1 — close to the truth")
for seed in [1, 2, 3]:
    Y = TSNE(2, perplexity=20, random_state=seed, init="random").fit_transform(X)
    s, d = ratios(Y, c)
    print(f"t-SNE seed {seed}: spread {s:.1f} : 1, distance {d:.1f} : 1")
s, d = ratios(X, c)
print(f"measured in the original 10 dimensions: spread {s:.1f} : 1, distance {d:.1f} : 1 — the numbers to report")`,
        },
      ],
    },
  },
}
