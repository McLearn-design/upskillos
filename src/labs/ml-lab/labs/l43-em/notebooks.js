// Lab 43 runnable cells, typeset formulas and math ↔ code tables, keyed by lesson id.
// The worlds are the playground's (same weights, means and covariances; NumPy's own draws); scikit-learn's GaussianMixture is the reference.

export const extras = {
  'l43-mixtures': {
    formulaTex: '$$\\begin{aligned} p(x) &= \\textstyle\\sum_k \\pi_k\\,\\mathcal N(x \\mid \\mu_k, \\Sigma_k) \\\\ r_{ik} &= \\frac{\\pi_k\\,\\mathcal N(x_i \\mid \\mu_k, \\Sigma_k)}{\\sum_j \\pi_j\\,\\mathcal N(x_i \\mid \\mu_j, \\Sigma_j)} \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\pi_k \\mathcal N(x_i \\mid \\mu_k, \\Sigma_k)$', 'np.log(p) + mvn.logpdf(X, m, S)', 'Each component’s share of the density, in logs.'],
        ['$r_{ik}$', 'np.exp(logp - log_total[:, None])', 'Responsibility: a soft label (log-sum-exp for stability).'],
      ],
    },
    notebook: {
      title: 'Lab 43.1 · Latent variables and mixtures',
      intro: 'Responsibilities by hand and for the three-cluster world under its true parameters.',
      cells: [
        {
          title: 'Responsibilities',
          prose: '**Predict** the share of points with a top responsibility above 0.99.',
          code: `import numpy as np
from scipy.stats import multivariate_normal as mvn
WORLDS = {   # the playground's worlds: (weight, mean, covariance) per component
    "three":     [(0.45, [-2, 0], [[0.6, 0.35], [0.35, 0.5]]), (0.35, [2, 1.2], [[1.4, -0.5], [-0.5, 0.45]]), (0.2, [0.6, -2.2], [[0.15, 0], [0, 0.15]])],
    "stretched": [(0.5, [0, 0.9], [[4, 0], [0, 0.08]]), (0.5, [0, -0.9], [[4, 0], [0, 0.08]])],
    "unequal":   [(0.8, [-1, 0], [[2.2, 0], [0, 2.2]]), (0.2, [2.3, 0.3], [[0.08, 0], [0, 0.08]])],
}
def sample(world, n=300, seed=43):
    rng = np.random.default_rng(seed); comps = WORLDS[world]
    z = rng.choice(len(comps), size=n, p=[c[0] for c in comps])
    X = np.array([rng.multivariate_normal(comps[k][1], comps[k][2]) for k in z])
    return X, z

def e_step(X, pis, mus, Sigmas):
    logp = np.column_stack([np.log(p) + mvn.logpdf(X, m, S) for p, m, S in zip(pis, mus, Sigmas)])
    top = logp.max(axis=1, keepdims=True)
    log_total = top[:, 0] + np.log(np.exp(logp - top).sum(axis=1))     # log-sum-exp: log p(x_i)
    return np.exp(logp - log_total[:, None]), log_total.sum()           # responsibilities, log-likelihood

def m_step(X, R, floor=1e-3):
    Nk = R.sum(axis=0)
    mus = (R.T @ X) / Nk[:, None]
    Sigmas = [((R[:, k, None] * (X - mus[k])).T @ (X - mus[k])) / Nk[k] + floor * np.eye(2) for k in range(R.shape[1])]
    return Nk / len(X), mus, Sigmas

def em(X, K, seed, iters=60):
    rng = np.random.default_rng(seed)
    mus = X[rng.choice(len(X), K, replace=False)]; v = np.mean(np.sum(X ** 2, axis=1)) / 2
    pis, Sigmas, lls = np.full(K, 1 / K), [v * np.eye(2)] * K, []
    for _ in range(iters):
        R, ll = e_step(X, pis, mus, Sigmas); lls.append(ll)
        pis, mus, Sigmas = m_step(X, R)
    return (pis, mus, Sigmas), np.array(lls), R

def agreement(labels, truth):
    from itertools import permutations
    K = truth.max() + 1
    return max(np.mean(np.array(p)[labels] == truth) for p in permutations(range(K)))

# Responsibilities by hand: weights 0.3 and 0.7, densities 0.2 and 0.05 at a point.
num = np.array([0.3 * 0.2, 0.7 * 0.05])
print("responsibilities:", np.round(num / num.sum(), 3))

X, z = sample("three")
pis = [c[0] for c in WORLDS["three"]]; mus = [c[1] for c in WORLDS["three"]]; Sigmas = [c[2] for c in WORLDS["three"]]
R, ll = e_step(X, pis, mus, Sigmas)                          # responsibilities under the TRUE parameters
unsure = np.sort(R.max(axis=1))[:5]
print(f"{len(X)} points; the 5 least certain have top responsibility {np.round(unsure, 2)}")
print(f"share of points with a top responsibility above 0.99: {np.mean(R.max(axis=1) > 0.99):.2f}")
print(f"log-likelihood under the true parameters: {ll:.1f}")`,
        },
      ],
    },
  },
  'l43-em': {
    formulaTex: '$$\\begin{aligned} N_k &= \\textstyle\\sum_i r_{ik}, \\qquad \\pi_k = N_k / n \\\\ \\mu_k &= \\textstyle\\sum_i r_{ik} x_i / N_k \\\\ \\Sigma_k &= \\textstyle\\sum_i r_{ik}(x_i - \\mu_k)(x_i - \\mu_k)^\\top / N_k \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$N_k$', 'R.sum(axis=0)', 'Effective number of points per component.'],
        ['$\\mu_k$', '(R.T @ X) / Nk[:, None]', 'Weighted means.'],
        ['$\\Sigma_k$', '((R[:, k, None] * (X - mus[k])).T @ (X - mus[k])) / Nk[k] + floor * I', 'Weighted covariances, with a small floor.'],
      ],
    },
    notebook: {
      title: 'Lab 43.2 · The EM algorithm',
      intro: 'EM from scratch on the three-cluster world, against scikit-learn.',
      cells: [
        {
          title: 'E-step, M-step, repeat',
          prose: '**Predict** whether the log-likelihood ever decreases.',
          code: `import numpy as np
from scipy.stats import multivariate_normal as mvn
WORLDS = {   # the playground's worlds: (weight, mean, covariance) per component
    "three":     [(0.45, [-2, 0], [[0.6, 0.35], [0.35, 0.5]]), (0.35, [2, 1.2], [[1.4, -0.5], [-0.5, 0.45]]), (0.2, [0.6, -2.2], [[0.15, 0], [0, 0.15]])],
    "stretched": [(0.5, [0, 0.9], [[4, 0], [0, 0.08]]), (0.5, [0, -0.9], [[4, 0], [0, 0.08]])],
    "unequal":   [(0.8, [-1, 0], [[2.2, 0], [0, 2.2]]), (0.2, [2.3, 0.3], [[0.08, 0], [0, 0.08]])],
}
def sample(world, n=300, seed=43):
    rng = np.random.default_rng(seed); comps = WORLDS[world]
    z = rng.choice(len(comps), size=n, p=[c[0] for c in comps])
    X = np.array([rng.multivariate_normal(comps[k][1], comps[k][2]) for k in z])
    return X, z

def e_step(X, pis, mus, Sigmas):
    logp = np.column_stack([np.log(p) + mvn.logpdf(X, m, S) for p, m, S in zip(pis, mus, Sigmas)])
    top = logp.max(axis=1, keepdims=True)
    log_total = top[:, 0] + np.log(np.exp(logp - top).sum(axis=1))     # log-sum-exp: log p(x_i)
    return np.exp(logp - log_total[:, None]), log_total.sum()           # responsibilities, log-likelihood

def m_step(X, R, floor=1e-3):
    Nk = R.sum(axis=0)
    mus = (R.T @ X) / Nk[:, None]
    Sigmas = [((R[:, k, None] * (X - mus[k])).T @ (X - mus[k])) / Nk[k] + floor * np.eye(2) for k in range(R.shape[1])]
    return Nk / len(X), mus, Sigmas

def em(X, K, seed, iters=60):
    rng = np.random.default_rng(seed)
    mus = X[rng.choice(len(X), K, replace=False)]; v = np.mean(np.sum(X ** 2, axis=1)) / 2
    pis, Sigmas, lls = np.full(K, 1 / K), [v * np.eye(2)] * K, []
    for _ in range(iters):
        R, ll = e_step(X, pis, mus, Sigmas); lls.append(ll)
        pis, mus, Sigmas = m_step(X, R)
    return (pis, mus, Sigmas), np.array(lls), R

def agreement(labels, truth):
    from itertools import permutations
    K = truth.max() + 1
    return max(np.mean(np.array(p)[labels] == truth) for p in permutations(range(K)))

X, z = sample("three")
(pis, mus, Sigmas), lls, R = em(X, 3, seed=1)
print("log-likelihood, first 8 iterations:", np.round(lls[:8], 1))
print(f"never decreases: {np.all(np.diff(lls) >= -1e-6)}; final {lls[-1]:.2f}")
print("weights", np.round(pis, 3), "(true 0.45, 0.35, 0.2 in some order)")
print("means\\n", np.round(mus, 2))

from sklearn.mixture import GaussianMixture
gm = GaussianMixture(3, reg_covar=1e-3, n_init=5, random_state=0).fit(X)
print(f"scikit-learn (5 starts): total log-likelihood {gm.score(X) * len(X):.2f}")
print(f"agreement with the true labels: ours {agreement(R.argmax(axis=1), z):.3f}, scikit-learn {agreement(gm.predict(X), z):.3f}")`,
        },
      ],
    },
  },
  'l43-why': {
    formulaTex: '$$\\begin{aligned} \\log p(x \\mid \\theta) &= \\mathrm{ELBO}(q, \\theta) \\\\ &+ \\mathrm{KL}\\big(q(z)\\,\\Vert\\, p(z \\mid x, \\theta)\\big) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['ELBO', 'np.sum(q * (logjoint - np.log(q)))', 'The lower bound for a distribution q over the labels.'],
        ['KL', 'np.sum(q * (np.log(q) - np.log(Rpost)))', 'The gap; zero when q is the posterior (the E-step).'],
      ],
    },
    notebook: {
      title: 'Lab 43.3 · Why EM works: the lower bound',
      intro: 'The decomposition checked for two choices of q, then five starts on the parallel clusters run short and long.',
      cells: [
        {
          title: 'The bound and plateaus',
          prose: '**Predict** how many of five starts look right after 60 iterations — and after 1,500.',
          code: `import numpy as np
from scipy.stats import multivariate_normal as mvn
WORLDS = {   # the playground's worlds: (weight, mean, covariance) per component
    "three":     [(0.45, [-2, 0], [[0.6, 0.35], [0.35, 0.5]]), (0.35, [2, 1.2], [[1.4, -0.5], [-0.5, 0.45]]), (0.2, [0.6, -2.2], [[0.15, 0], [0, 0.15]])],
    "stretched": [(0.5, [0, 0.9], [[4, 0], [0, 0.08]]), (0.5, [0, -0.9], [[4, 0], [0, 0.08]])],
    "unequal":   [(0.8, [-1, 0], [[2.2, 0], [0, 2.2]]), (0.2, [2.3, 0.3], [[0.08, 0], [0, 0.08]])],
}
def sample(world, n=300, seed=43):
    rng = np.random.default_rng(seed); comps = WORLDS[world]
    z = rng.choice(len(comps), size=n, p=[c[0] for c in comps])
    X = np.array([rng.multivariate_normal(comps[k][1], comps[k][2]) for k in z])
    return X, z

def e_step(X, pis, mus, Sigmas):
    logp = np.column_stack([np.log(p) + mvn.logpdf(X, m, S) for p, m, S in zip(pis, mus, Sigmas)])
    top = logp.max(axis=1, keepdims=True)
    log_total = top[:, 0] + np.log(np.exp(logp - top).sum(axis=1))     # log-sum-exp: log p(x_i)
    return np.exp(logp - log_total[:, None]), log_total.sum()           # responsibilities, log-likelihood

def m_step(X, R, floor=1e-3):
    Nk = R.sum(axis=0)
    mus = (R.T @ X) / Nk[:, None]
    Sigmas = [((R[:, k, None] * (X - mus[k])).T @ (X - mus[k])) / Nk[k] + floor * np.eye(2) for k in range(R.shape[1])]
    return Nk / len(X), mus, Sigmas

def em(X, K, seed, iters=60):
    rng = np.random.default_rng(seed)
    mus = X[rng.choice(len(X), K, replace=False)]; v = np.mean(np.sum(X ** 2, axis=1)) / 2
    pis, Sigmas, lls = np.full(K, 1 / K), [v * np.eye(2)] * K, []
    for _ in range(iters):
        R, ll = e_step(X, pis, mus, Sigmas); lls.append(ll)
        pis, mus, Sigmas = m_step(X, R)
    return (pis, mus, Sigmas), np.array(lls), R

def agreement(labels, truth):
    from itertools import permutations
    K = truth.max() + 1
    return max(np.mean(np.array(p)[labels] == truth) for p in permutations(range(K)))

X, z = sample("stretched")
theta, lls, R = em(X, 2, seed=1, iters=5)
pis, mus, Sigmas = theta
# Any q gives a lower bound: log p(x) = ELBO(q) + KL(q || posterior).
Rpost, ll = e_step(X, pis, mus, Sigmas)
logjoint = np.column_stack([np.log(p) + mvn.logpdf(X, m, S) for p, m, S in zip(pis, mus, Sigmas)])
for name, q in [("responsibilities", Rpost), ("uniform q", np.full_like(Rpost, 0.5))]:
    elbo = np.sum(q * (logjoint - np.log(np.clip(q, 1e-300, None))))
    kl = np.sum(q * (np.log(np.clip(q, 1e-300, None)) - np.log(np.clip(Rpost, 1e-300, None))))
    print(f"{name:17s}: ELBO {elbo:9.3f} + KL {kl:8.3f} = {elbo + kl:9.3f}   (log-likelihood {ll:.3f})")

print("\\nfive starts on the parallel clusters, stopped after 60 iterations and run to 1,500:")
for s in range(1, 6):
    theta, lls, R = em(X, 2, seed=s, iters=1500)
    print(f"  start {s}: after 60 {lls[59]:8.1f} (changing {lls[59] - lls[58]:.0e} per step)   after 1,500 {lls[-1]:8.1f}")
print("the wrong split is a plateau near a saddle point, not a separate peak: a stop-when-it-barely-changes rule stops on it")`,
        },
      ],
    },
  },
  'l43-kmeans': {
    formulaTex: '$$\\sigma \\to 0: \\quad r_{ik} \\to \\mathbb 1\\big[k = \\arg\\min_j \\lVert x_i - \\mu_j\\rVert\\big]$$',
    mathCode: {
      rows: [
        ['k-means', 'KMeans(2, n_init=10)', 'Hard assignments, round equal clusters.'],
        ['init', 'init_params="random_from_data"', 'Mixture starts that do not inherit k-means’ answer.'],
        ['collapse', 'sigma ** 2 * np.eye(2)', 'A component on one point: the likelihood grows as σ → 0.'],
      ],
    },
    notebook: {
      title: 'Lab 43.4 · k-means, soft assignments and failure modes',
      intro: 'k-means against mixtures (and how the mixture is started matters), collapse, and label switching.',
      cells: [
        {
          title: 'Where k-means and EM go wrong',
          prose: '**Predict** what a mixture started from k-means finds on the parallel clusters.',
          code: `import numpy as np
from scipy.stats import multivariate_normal as mvn
WORLDS = {   # the playground's worlds: (weight, mean, covariance) per component
    "three":     [(0.45, [-2, 0], [[0.6, 0.35], [0.35, 0.5]]), (0.35, [2, 1.2], [[1.4, -0.5], [-0.5, 0.45]]), (0.2, [0.6, -2.2], [[0.15, 0], [0, 0.15]])],
    "stretched": [(0.5, [0, 0.9], [[4, 0], [0, 0.08]]), (0.5, [0, -0.9], [[4, 0], [0, 0.08]])],
    "unequal":   [(0.8, [-1, 0], [[2.2, 0], [0, 2.2]]), (0.2, [2.3, 0.3], [[0.08, 0], [0, 0.08]])],
}
def sample(world, n=300, seed=43):
    rng = np.random.default_rng(seed); comps = WORLDS[world]
    z = rng.choice(len(comps), size=n, p=[c[0] for c in comps])
    X = np.array([rng.multivariate_normal(comps[k][1], comps[k][2]) for k in z])
    return X, z

def e_step(X, pis, mus, Sigmas):
    logp = np.column_stack([np.log(p) + mvn.logpdf(X, m, S) for p, m, S in zip(pis, mus, Sigmas)])
    top = logp.max(axis=1, keepdims=True)
    log_total = top[:, 0] + np.log(np.exp(logp - top).sum(axis=1))     # log-sum-exp: log p(x_i)
    return np.exp(logp - log_total[:, None]), log_total.sum()           # responsibilities, log-likelihood

def m_step(X, R, floor=1e-3):
    Nk = R.sum(axis=0)
    mus = (R.T @ X) / Nk[:, None]
    Sigmas = [((R[:, k, None] * (X - mus[k])).T @ (X - mus[k])) / Nk[k] + floor * np.eye(2) for k in range(R.shape[1])]
    return Nk / len(X), mus, Sigmas

def em(X, K, seed, iters=60):
    rng = np.random.default_rng(seed)
    mus = X[rng.choice(len(X), K, replace=False)]; v = np.mean(np.sum(X ** 2, axis=1)) / 2
    pis, Sigmas, lls = np.full(K, 1 / K), [v * np.eye(2)] * K, []
    for _ in range(iters):
        R, ll = e_step(X, pis, mus, Sigmas); lls.append(ll)
        pis, mus, Sigmas = m_step(X, R)
    return (pis, mus, Sigmas), np.array(lls), R

def agreement(labels, truth):
    from itertools import permutations
    K = truth.max() + 1
    return max(np.mean(np.array(p)[labels] == truth) for p in permutations(range(K)))

from sklearn.cluster import KMeans
from sklearn.mixture import GaussianMixture
for world in ["stretched", "unequal"]:
    X, z = sample(world)
    km = KMeans(2, n_init=10, random_state=0).fit(X)
    gm_default = GaussianMixture(2, n_init=5, random_state=0).fit(X)                    # starts from k-means
    gm_random = GaussianMixture(2, n_init=10, init_params="random_from_data", random_state=0).fit(X)
    print(f"{world:9s}: k-means {agreement(km.labels_, z):.3f}; mixture started from k-means {agreement(gm_default.predict(X), z):.3f}; "
          f"mixture, 10 random starts {agreement(gm_random.predict(X), z):.3f}")

# Collapse: a component sits on a single point; as its variance shrinks the log-likelihood grows without bound.
X, z = sample("three")
for sigma in [1e-2, 1e-3, 1e-4, 1e-6, 1e-9]:
    pis = [0.5, 0.5]; mus = [X[0], X.mean(axis=0)]; Sigmas = [sigma ** 2 * np.eye(2), np.cov(X.T)]
    print(f"component on point 0 with sd {sigma:.0e}: log-likelihood {e_step(X, pis, mus, Sigmas)[1]:9.1f}")
print("label switching: swapping the two components gives",
      round(e_step(X, [0.5, 0.5], [X.mean(axis=0), X[0]], [np.cov(X.T), 1e-9 ** 2 * np.eye(2)])[1], 1), "— the same")`,
        },
      ],
    },
  },
  'l43-choose': {
    formulaTex: '$$\\begin{aligned} \\mathrm{BIC} &= -2\\log L + p \\log n \\\\ p &= (K - 1) + Kd + Kd(d + 1)/2 \\end{aligned}$$',
    mathCode: {
      rows: [
        ['BIC, AIC', 'gm.bic(X), gm.aic(X)', 'Penalized fit; lower is better.'],
        ['held-out', 'gm.score(Xv) * len(Xv)', 'Log-likelihood of unseen data from the same world.'],
      ],
    },
    notebook: {
      title: 'Lab 43.5 · Choosing K and using mixtures well',
      intro: 'Training log-likelihood, BIC, AIC and held-out likelihood for K = 1 to 6 in each world.',
      cells: [
        {
          title: 'Choosing K',
          prose: '**Predict** the K that the training log-likelihood alone would choose.',
          code: `import numpy as np
from scipy.stats import multivariate_normal as mvn
WORLDS = {   # the playground's worlds: (weight, mean, covariance) per component
    "three":     [(0.45, [-2, 0], [[0.6, 0.35], [0.35, 0.5]]), (0.35, [2, 1.2], [[1.4, -0.5], [-0.5, 0.45]]), (0.2, [0.6, -2.2], [[0.15, 0], [0, 0.15]])],
    "stretched": [(0.5, [0, 0.9], [[4, 0], [0, 0.08]]), (0.5, [0, -0.9], [[4, 0], [0, 0.08]])],
    "unequal":   [(0.8, [-1, 0], [[2.2, 0], [0, 2.2]]), (0.2, [2.3, 0.3], [[0.08, 0], [0, 0.08]])],
}
def sample(world, n=300, seed=43):
    rng = np.random.default_rng(seed); comps = WORLDS[world]
    z = rng.choice(len(comps), size=n, p=[c[0] for c in comps])
    X = np.array([rng.multivariate_normal(comps[k][1], comps[k][2]) for k in z])
    return X, z

def e_step(X, pis, mus, Sigmas):
    logp = np.column_stack([np.log(p) + mvn.logpdf(X, m, S) for p, m, S in zip(pis, mus, Sigmas)])
    top = logp.max(axis=1, keepdims=True)
    log_total = top[:, 0] + np.log(np.exp(logp - top).sum(axis=1))     # log-sum-exp: log p(x_i)
    return np.exp(logp - log_total[:, None]), log_total.sum()           # responsibilities, log-likelihood

def m_step(X, R, floor=1e-3):
    Nk = R.sum(axis=0)
    mus = (R.T @ X) / Nk[:, None]
    Sigmas = [((R[:, k, None] * (X - mus[k])).T @ (X - mus[k])) / Nk[k] + floor * np.eye(2) for k in range(R.shape[1])]
    return Nk / len(X), mus, Sigmas

def em(X, K, seed, iters=60):
    rng = np.random.default_rng(seed)
    mus = X[rng.choice(len(X), K, replace=False)]; v = np.mean(np.sum(X ** 2, axis=1)) / 2
    pis, Sigmas, lls = np.full(K, 1 / K), [v * np.eye(2)] * K, []
    for _ in range(iters):
        R, ll = e_step(X, pis, mus, Sigmas); lls.append(ll)
        pis, mus, Sigmas = m_step(X, R)
    return (pis, mus, Sigmas), np.array(lls), R

def agreement(labels, truth):
    from itertools import permutations
    K = truth.max() + 1
    return max(np.mean(np.array(p)[labels] == truth) for p in permutations(range(K)))

from sklearn.mixture import GaussianMixture
for world, true_K in [("three", 3), ("stretched", 2), ("unequal", 2)]:
    X, z = sample(world); Xv, _ = sample(world, 300, seed=7)          # a validation set from the same world
    rows = []
    for K in range(1, 7):
        gm = GaussianMixture(K, n_init=10, init_params="random_from_data", reg_covar=1e-3, random_state=0).fit(X)
        rows.append((K, gm.score(X) * len(X), gm.bic(X), gm.aic(X), gm.score(Xv) * len(Xv)))
    best = lambda col, f: [r[0] for r in rows][f([r[col] for r in rows])]
    print(f"{world:9s} (true K = {true_K}): BIC picks {best(2, np.argmin)}, AIC {best(3, np.argmin)}, held-out log-likelihood {best(4, np.argmax)}; "
          f"training log-likelihood keeps rising: {[round(r[1]) for r in rows]}")
print("parameters of a full-covariance mixture, d = 3, K = 2:", (2 - 1) + 2 * 3 + 2 * 3 * 4 // 2)`,
        },
      ],
    },
  },
}
