// Lab 44 runnable cells, typeset formulas and math ↔ code tables, keyed by lesson id.
// The targets are the playground's (the two-mode 1-D posterior, the ρ = 0.95 Gaussian, the two separated 2-D modes), sampled with NumPy.

export const extras = {
  'l44-mc': {
    formulaTex: '$$\\mathbb E_p[f] \\approx \\frac1S\\sum_s f(\\theta_s), \\qquad \\mathrm{SE} = \\sigma_f / \\sqrt S$$',
    mathCode: {
      rows: [
        ['$\\frac1S\\sum_s f(\\theta_s)$', 'np.mean(rng.normal(size=S) ** 2)', 'The Monte Carlo average.'],
        ['$\\sigma_f/\\sqrt S$', 'np.sqrt(2) / np.sqrt(S)', 'Its standard error (σ_f = √2 for θ²).'],
      ],
    },
    notebook: {
      title: 'Lab 44.1 · Why approximate, and Monte Carlo',
      intro: 'The 1/√S error, measured over 500 repeated estimates.',
      cells: [
        {
          title: 'The Monte Carlo error',
          prose: '**Predict** the spread at S = 6,400 from the one at S = 100.',
          code: `import numpy as np
from scipy.stats import norm
def target1d(x):
    """The playground's two-mode 1-D posterior: 0.6·N(−2, 0.6²) + 0.4·N(2, 0.8²) (log density)."""
    return np.log(0.6 * norm.pdf(x, -2, 0.6) + 0.4 * norm.pdf(x, 2, 0.8))
TRUE_MEAN = 0.6 * -2 + 0.4 * 2
TRUE_P_POS = 0.6 * norm.sf(0, -2, 0.6) + 0.4 * norm.sf(0, 2, 0.8)

def logp_corr(t, rho=0.95):                                  # correlated Gaussian, unnormalized
    a, b = t
    return -(a * a - 2 * rho * a * b + b * b) / (2 * (1 - rho ** 2))

def logp_two(t):                                              # two separated 2-D modes
    a, b = t
    l1, l2 = -((a + 2) ** 2 + (b + 2) ** 2) / 0.8, -((a - 2) ** 2 + (b - 2) ** 2) / 0.8
    return np.logaddexp(l1, l2)

def metropolis(logp, start, step, n, seed):
    rng = np.random.default_rng(seed); x = np.array(start, float); lx = logp(x); chain = [x]; acc = 0
    for _ in range(n - 1):
        y = x + step * rng.normal(size=2); ly = logp(y)
        if np.log(rng.random()) < ly - lx:
            x, lx = y, ly; acc += 1
        chain.append(x)
    return np.array(chain), acc / (n - 1)

def ess(xs):
    """n / (1 + 2 sum of autocorrelations), summing until the first negative one."""
    xs = np.asarray(xs) - np.mean(xs); n = len(xs); v = xs @ xs / n; s = 0.0
    for k in range(1, min(200, n // 3)):
        rho = (xs[k:] @ xs[:-k]) / n / v
        if rho < 0: break
        s += rho
    return n / (1 + 2 * s)

rng = np.random.default_rng(44)
# Estimate E[theta^2] = 1 for theta ~ N(0, 1): the error shrinks like 1/sqrt(S).
for S in [100, 400, 1600, 6400]:
    estimates = [np.mean(rng.normal(size=S) ** 2) for _ in range(500)]
    print(f"S = {S:5d}: spread of 500 estimates {np.std(estimates):.4f}   (theory sigma_f/sqrt(S) = {np.sqrt(2) / np.sqrt(S):.4f})")
print(f"a grid with 100 points per axis in 10 dimensions: {100.0 ** 10:.0e} evaluations; Monte Carlo's error does not depend on the dimension")`,
        },
      ],
    },
  },
  'l44-importance': {
    formulaTex: '$$\\begin{aligned} \\hat{\\mathbb E}[f] &= \\textstyle\\sum_s w_s f(\\theta_s) \\big/ \\sum_s w_s \\\\ w_s &= \\tilde p(\\theta_s)/q(\\theta_s), \\quad \\mathrm{ESS} = (\\textstyle\\sum w)^2 / \\sum w^2 \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\log w_s$', 'target1d(x) - norm.logpdf(x, qm, qs)', 'Log weights; the target need not be normalized.'],
        ['self-normalized', 'w /= w.sum()', 'Divide by the sum of the weights.'],
        ['ESS', '1 / np.sum(w ** 2)', 'How many samples the weighted set is worth.'],
      ],
    },
    notebook: {
      title: 'Lab 44.2 · Importance sampling',
      intro: 'Three proposals for the two-mode posterior: wide, narrow, and on one mode.',
      cells: [
        {
          title: 'Three proposals',
          prose: '**Predict** which proposal gives a large ESS and a wrong answer.',
          code: `import numpy as np
from scipy.stats import norm
def target1d(x):
    """The playground's two-mode 1-D posterior: 0.6·N(−2, 0.6²) + 0.4·N(2, 0.8²) (log density)."""
    return np.log(0.6 * norm.pdf(x, -2, 0.6) + 0.4 * norm.pdf(x, 2, 0.8))
TRUE_MEAN = 0.6 * -2 + 0.4 * 2
TRUE_P_POS = 0.6 * norm.sf(0, -2, 0.6) + 0.4 * norm.sf(0, 2, 0.8)

def logp_corr(t, rho=0.95):                                  # correlated Gaussian, unnormalized
    a, b = t
    return -(a * a - 2 * rho * a * b + b * b) / (2 * (1 - rho ** 2))

def logp_two(t):                                              # two separated 2-D modes
    a, b = t
    l1, l2 = -((a + 2) ** 2 + (b + 2) ** 2) / 0.8, -((a - 2) ** 2 + (b - 2) ** 2) / 0.8
    return np.logaddexp(l1, l2)

def metropolis(logp, start, step, n, seed):
    rng = np.random.default_rng(seed); x = np.array(start, float); lx = logp(x); chain = [x]; acc = 0
    for _ in range(n - 1):
        y = x + step * rng.normal(size=2); ly = logp(y)
        if np.log(rng.random()) < ly - lx:
            x, lx = y, ly; acc += 1
        chain.append(x)
    return np.array(chain), acc / (n - 1)

def ess(xs):
    """n / (1 + 2 sum of autocorrelations), summing until the first negative one."""
    xs = np.asarray(xs) - np.mean(xs); n = len(xs); v = xs @ xs / n; s = 0.0
    for k in range(1, min(200, n // 3)):
        rho = (xs[k:] @ xs[:-k]) / n / v
        if rho < 0: break
        s += rho
    return n / (1 + 2 * s)

def importance(qm, qs, n=1000, seed=1):
    x = np.random.default_rng(seed).normal(qm, qs, n)
    lw = target1d(x) - norm.logpdf(x, qm, qs)                 # log weights: target over proposal (unnormalized is fine)
    w = np.exp(lw - lw.max()); w /= w.sum()                    # self-normalized
    return np.sum(w * x), np.sum(w * (x > 0)), 1 / np.sum(w ** 2)
print(f"truth: mean {TRUE_MEAN:.3f}, P(theta > 0) {TRUE_P_POS:.3f}")
for qm, qs in [(0, 3), (0, 0.5), (-2, 0.6)]:
    m, p, e = importance(qm, qs)
    print(f"proposal N({qm}, {qs}^2): mean {m:+.3f}, P(theta > 0) {p:.3f}, ESS {e:6.1f} of 1,000")
print("the proposal on one mode has a large ESS and a badly wrong answer: weights only correct what the proposal visits")`,
        },
      ],
    },
  },
  'l44-mcmc': {
    formulaTex: '$$\\begin{aligned} \\alpha(\\theta \\to \\theta^\\prime) &= \\min\\big(1,\\ \\tilde p(\\theta^\\prime)/\\tilde p(\\theta)\\big) \\\\ p(\\theta)\\,T(\\theta \\to \\theta^\\prime) &= p(\\theta^\\prime)\\,T(\\theta^\\prime \\to \\theta) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['proposal', 'x + step * rng.normal(size=2)', 'A random-walk step.'],
        ['accept', 'np.log(rng.random()) < ly - lx', 'The Metropolis rule in logs; the normalizer cancels.'],
        ['detailed balance', 'flow = p[:, None] * T; flow == flow.T', 'Probability flows balance for every pair of states.'],
      ],
    },
    notebook: {
      title: 'Lab 44.3 · Markov chain Monte Carlo',
      intro: 'Step size against acceptance and effective samples, and detailed balance checked on five states.',
      cells: [
        {
          title: 'Random-walk Metropolis',
          prose: '**Predict** which step size gives the most effective samples.',
          code: `import numpy as np
from scipy.stats import norm
def target1d(x):
    """The playground's two-mode 1-D posterior: 0.6·N(−2, 0.6²) + 0.4·N(2, 0.8²) (log density)."""
    return np.log(0.6 * norm.pdf(x, -2, 0.6) + 0.4 * norm.pdf(x, 2, 0.8))
TRUE_MEAN = 0.6 * -2 + 0.4 * 2
TRUE_P_POS = 0.6 * norm.sf(0, -2, 0.6) + 0.4 * norm.sf(0, 2, 0.8)

def logp_corr(t, rho=0.95):                                  # correlated Gaussian, unnormalized
    a, b = t
    return -(a * a - 2 * rho * a * b + b * b) / (2 * (1 - rho ** 2))

def logp_two(t):                                              # two separated 2-D modes
    a, b = t
    l1, l2 = -((a + 2) ** 2 + (b + 2) ** 2) / 0.8, -((a - 2) ** 2 + (b - 2) ** 2) / 0.8
    return np.logaddexp(l1, l2)

def metropolis(logp, start, step, n, seed):
    rng = np.random.default_rng(seed); x = np.array(start, float); lx = logp(x); chain = [x]; acc = 0
    for _ in range(n - 1):
        y = x + step * rng.normal(size=2); ly = logp(y)
        if np.log(rng.random()) < ly - lx:
            x, lx = y, ly; acc += 1
        chain.append(x)
    return np.array(chain), acc / (n - 1)

def ess(xs):
    """n / (1 + 2 sum of autocorrelations), summing until the first negative one."""
    xs = np.asarray(xs) - np.mean(xs); n = len(xs); v = xs @ xs / n; s = 0.0
    for k in range(1, min(200, n // 3)):
        rho = (xs[k:] @ xs[:-k]) / n / v
        if rho < 0: break
        s += rho
    return n / (1 + 2 * s)

print("step   acceptance   ESS of theta_1 (4,500 draws after 500 warm-up)")
for step in [0.1, 0.5, 1.5, 4.0]:
    chain, acc = metropolis(logp_corr, [3, -3], step, 5000, seed=20)
    print(f"{step:4}      {acc:.2f}          {ess(chain[500:, 0]):6.1f}")

# Detailed balance on a tiny discrete example: states 0..4 with target p, proposals to a neighbour.
p = np.array([1, 3, 6, 3, 1], float); p /= p.sum()
T = np.zeros((5, 5))
for i in range(5):
    for j in (i - 1, i + 1):
        if 0 <= j < 5:
            T[i, j] = 0.5 * min(1, p[j] / p[i])               # propose with prob 1/2, accept with the Metropolis rule
    T[i, i] = 1 - T[i].sum()
flow = p[:, None] * T
print("largest |p_i T_ij - p_j T_ji|:", np.abs(flow - flow.T).max(), "; p is stationary:", np.allclose(p @ T, p))`,
        },
      ],
    },
  },
  'l44-diagnostics': {
    formulaTex: '$$\\mathrm{ESS} = \\frac{n}{1 + 2\\sum_k \\rho_k}, \\qquad \\hat R = \\sqrt{\\frac{\\frac{n-1}{n}W + \\frac1n B}{W}}$$',
    mathCode: {
      rows: [
        ['$\\rho_k$', '(xs[k:] @ xs[:-k]) / n / v', 'Autocorrelation at lag k.'],
        ['$W$, $B$', 'chains.var(axis=1, ddof=1).mean(), n * chains.mean(axis=1).var(ddof=1)', 'Within- and between-chain variance.'],
        ['Gibbs', 'a = rho * b + sqrt(1 - rho ** 2) * rng.normal()', 'Draw one coordinate from its full conditional.'],
      ],
    },
    notebook: {
      title: 'Lab 44.4 · Gibbs sampling and convergence diagnostics',
      intro: 'Gibbs on the correlated Gaussian, and four chains per target: ESS, chain means and R̂.',
      cells: [
        {
          title: 'Gibbs, ESS and R̂',
          prose: '**Predict** R̂ for the two-mode target.',
          code: `import numpy as np
from scipy.stats import norm
def target1d(x):
    """The playground's two-mode 1-D posterior: 0.6·N(−2, 0.6²) + 0.4·N(2, 0.8²) (log density)."""
    return np.log(0.6 * norm.pdf(x, -2, 0.6) + 0.4 * norm.pdf(x, 2, 0.8))
TRUE_MEAN = 0.6 * -2 + 0.4 * 2
TRUE_P_POS = 0.6 * norm.sf(0, -2, 0.6) + 0.4 * norm.sf(0, 2, 0.8)

def logp_corr(t, rho=0.95):                                  # correlated Gaussian, unnormalized
    a, b = t
    return -(a * a - 2 * rho * a * b + b * b) / (2 * (1 - rho ** 2))

def logp_two(t):                                              # two separated 2-D modes
    a, b = t
    l1, l2 = -((a + 2) ** 2 + (b + 2) ** 2) / 0.8, -((a - 2) ** 2 + (b - 2) ** 2) / 0.8
    return np.logaddexp(l1, l2)

def metropolis(logp, start, step, n, seed):
    rng = np.random.default_rng(seed); x = np.array(start, float); lx = logp(x); chain = [x]; acc = 0
    for _ in range(n - 1):
        y = x + step * rng.normal(size=2); ly = logp(y)
        if np.log(rng.random()) < ly - lx:
            x, lx = y, ly; acc += 1
        chain.append(x)
    return np.array(chain), acc / (n - 1)

def ess(xs):
    """n / (1 + 2 sum of autocorrelations), summing until the first negative one."""
    xs = np.asarray(xs) - np.mean(xs); n = len(xs); v = xs @ xs / n; s = 0.0
    for k in range(1, min(200, n // 3)):
        rho = (xs[k:] @ xs[:-k]) / n / v
        if rho < 0: break
        s += rho
    return n / (1 + 2 * s)

rho = 0.95; rng = np.random.default_rng(1); a, b = 3.0, -3.0; gibbs = []
for _ in range(5000):
    a = rho * b + np.sqrt(1 - rho ** 2) * rng.normal()        # theta_1 | theta_2 ~ N(rho theta_2, 1 - rho^2)
    b = rho * a + np.sqrt(1 - rho ** 2) * rng.normal()
    gibbs.append((a, b))
gibbs = np.array(gibbs)
print(f"Gibbs on rho = 0.95: every move accepted, ESS of theta_1 {ess(gibbs[500:, 0]):.0f} of 4,500")

def rhat(chains):
    chains = np.asarray(chains); m, n = chains.shape; W = chains.var(axis=1, ddof=1).mean(); B = n * chains.mean(axis=1).var(ddof=1)
    return np.sqrt(((n - 1) / n * W + B / n) / W)
starts = [[3, -3], [-3, 3], [3, 3], [-3, -3]]
for name, logp, step in [("correlated Gaussian, step 1.5", logp_corr, 1.5), ("two modes, step 0.5", logp_two, 0.5)]:
    chains = [metropolis(logp, s, step, 5000, seed=20 + j)[0][500:, 0] for j, s in enumerate(starts)]
    print(f"{name:30s} ESS per chain {[round(ess(c)) for c in chains]}, chain means {np.round([c.mean() for c in chains], 2)}, R-hat {rhat(chains):.2f}")`,
        },
      ],
    },
  },
  'l44-vi': {
    formulaTex: '$$\\begin{aligned} \\log p(D) &= \\mathrm{ELBO}(q) + \\mathrm{KL}\\big(q \\,\\Vert\\, p(\\theta \\mid D)\\big) \\\\ \\mathrm{Var}_q(\\theta_i) &= 1/\\Lambda_{ii} \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$1/\\Lambda_{ii}$', '1 / Lam[0, 0]', 'Mean-field variance: 1 − ρ² for a unit bivariate normal.'],
        ['reverse KL', 'np.sum(np.exp(lq) * (lq - logp)) * dx', 'KL(q ‖ p) on a grid: mode-seeking.'],
        ['forward KL', 'mean and sd of p', 'KL(p ‖ q) is minimized by matching moments.'],
      ],
    },
    notebook: {
      title: 'Lab 44.5 · Variational inference',
      intro: 'Mean-field variance shrinkage, and one Gaussian fitted to the two-mode posterior both ways.',
      cells: [
        {
          title: 'Variance shrinkage and the two KLs',
          prose: '**Predict** P(θ > 0) under the reverse-KL fit.',
          code: `import numpy as np
from scipy.stats import norm
def target1d(x):
    """The playground's two-mode 1-D posterior: 0.6·N(−2, 0.6²) + 0.4·N(2, 0.8²) (log density)."""
    return np.log(0.6 * norm.pdf(x, -2, 0.6) + 0.4 * norm.pdf(x, 2, 0.8))
TRUE_MEAN = 0.6 * -2 + 0.4 * 2
TRUE_P_POS = 0.6 * norm.sf(0, -2, 0.6) + 0.4 * norm.sf(0, 2, 0.8)

def logp_corr(t, rho=0.95):                                  # correlated Gaussian, unnormalized
    a, b = t
    return -(a * a - 2 * rho * a * b + b * b) / (2 * (1 - rho ** 2))

def logp_two(t):                                              # two separated 2-D modes
    a, b = t
    l1, l2 = -((a + 2) ** 2 + (b + 2) ** 2) / 0.8, -((a - 2) ** 2 + (b - 2) ** 2) / 0.8
    return np.logaddexp(l1, l2)

def metropolis(logp, start, step, n, seed):
    rng = np.random.default_rng(seed); x = np.array(start, float); lx = logp(x); chain = [x]; acc = 0
    for _ in range(n - 1):
        y = x + step * rng.normal(size=2); ly = logp(y)
        if np.log(rng.random()) < ly - lx:
            x, lx = y, ly; acc += 1
        chain.append(x)
    return np.array(chain), acc / (n - 1)

def ess(xs):
    """n / (1 + 2 sum of autocorrelations), summing until the first negative one."""
    xs = np.asarray(xs) - np.mean(xs); n = len(xs); v = xs @ xs / n; s = 0.0
    for k in range(1, min(200, n // 3)):
        rho = (xs[k:] @ xs[:-k]) / n / v
        if rho < 0: break
        s += rho
    return n / (1 + 2 * s)

# Mean-field VI on a bivariate normal with correlation rho: coordinate ascent gives q_i = N(., 1/Lambda_ii).
for rho in [0.0, 0.5, 0.9, 0.99]:
    Lam = np.linalg.inv(np.array([[1, rho], [rho, 1]]))
    print(f"rho = {rho:4}: true marginal variance 1, mean-field variance {1 / Lam[0, 0]:.4f} (= 1 − rho^2)")

# One Gaussian fitted to the two-mode 1-D posterior, both ways.
grid = np.linspace(-8, 8, 1601); dx = grid[1] - grid[0]; logp = target1d(grid)
def reverse_kl(m, s):
    lq = norm.logpdf(grid, m, s); return np.sum(np.exp(lq) * (lq - logp)) * dx
best = min(((reverse_kl(m, s), m, s) for m in np.arange(-3, 3.01, 0.05) for s in np.arange(0.2, 3.01, 0.05)))
_, m_r, s_r = best
pdf = np.exp(logp); m_f = np.sum(grid * pdf) * dx; s_f = np.sqrt(np.sum((grid - m_f) ** 2 * pdf) * dx)
print(f"reverse KL(q || p): mean {m_r:+.2f}, sd {s_r:.2f}  -> P(theta > 0) = {norm.sf(0, m_r, s_r):.3f}")
print(f"forward KL(p || q): mean {m_f:+.2f}, sd {s_f:.2f}  -> P(theta > 0) = {norm.sf(0, m_f, s_f):.3f}")
print(f"truth:                                  P(theta > 0) = {TRUE_P_POS:.3f}")`,
        },
      ],
    },
  },
}
