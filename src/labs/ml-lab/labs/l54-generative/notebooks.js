// Lab 54 runnable cells, typeset formulas and math ↔ code tables, keyed by lesson id.
// The ring of eight clusters, the GAN schedules and the diffusion schedule follow the playground; the networks are small
// NumPy MLPs trained with Adam, with NumPy random draws, so numbers differ from the playground's in detail.

export const extras = {
  'l54-gan': {
    formulaTex: '$$\\begin{aligned} \\min_G \\max_D\\ &\\mathbb E_x[\\log D(x)] \\\\ &+ \\mathbb E_z[\\log(1 - D(G(z)))] \\\\ D^*(x) &= \\frac{p_{\\text{data}}(x)}{p_{\\text{data}}(x) + p_g(x)} \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$D(x)$', 'sig(F @ w)', 'A logistic-regression discriminator on [1, x, x²].'],
        ['$D^*(x)$', 'a / (a + b)', 'The optimal discriminator from the two densities.'],
        ['$2\\,\\mathrm{JS} - \\log 4$', '2 * js - np.log(4)', 'The value of the game at D*, by numerical integration.'],
      ],
    },
    notebook: {
      title: 'Lab 54.1 · Generative adversarial networks',
      intro: 'A trained discriminator against the formula for D*, and the game’s value against the Jensen–Shannon divergence.',
      cells: [
        {
          title: 'The optimal discriminator',
          prose: '**Predict** D* at x = +3, where the generator’s wider distribution has far more mass than the data.',
          code: `import numpy as np
MODES = np.array([[2 * np.cos(2 * np.pi * k / 8), 2 * np.sin(2 * np.pi * k / 8)] for k in range(8)])   # the ring of eight clusters
def ring(n, rng):
    """The playground's target: eight Gaussian clusters (sd 0.12) on a circle of radius 2."""
    return MODES[rng.integers(0, 8, n)] + 0.12 * rng.normal(size=(n, 2))
def mode_shares(S):
    """Share of samples within 0.54 of each mode."""
    return np.array([np.mean(np.hypot(*(S - m).T) < 0.54) for m in MODES])
def coverage(S):
    """Modes covered (at least 2% of samples) and the share of samples landing on some mode."""
    sh = mode_shares(S); return int(np.sum(sh >= 0.02)), float(sh.sum())

class MLP:
    """Dense layers with LeakyReLU(0.2) (or ReLU) between them, trained with Adam."""
    def __init__(self, sizes, rng, slope=0.2, lr=2e-3, b1=0.9):
        self.W = [rng.normal(0, np.sqrt(2 / a), (a, b)) for a, b in zip(sizes, sizes[1:])]; self.b = [np.zeros(b) for b in sizes[1:]]
        self.P = [p for wb in zip(self.W, self.b) for p in wb]; self.m = [0 * p for p in self.P]; self.v = [0 * p for p in self.P]
        self.slope, self.lr, self.b1, self.t = slope, lr, b1, 0
    def forward(self, X):
        self.A = [X]
        for i, (W, b) in enumerate(zip(self.W, self.b)):
            X = X @ W + b
            if i < len(self.W) - 1: self.A.append(X); X = np.where(X > 0, X, self.slope * X); self.A.append(X)
        return X
    def backward(self, g):
        """Accumulate parameter gradients (G) and return the gradient with respect to the input."""
        self.G = []
        for i in reversed(range(len(self.W))):
            inp = self.A[2 * i]; self.G = [inp.T @ g, g.sum(0)] + self.G; g = g @ self.W[i].T
            if i > 0: g = g * np.where(self.A[2 * i - 1] > 0, 1, self.slope)
        return g
    def step(self):
        self.t += 1
        for i, (p, g) in enumerate(zip(self.P, self.G)):
            self.m[i] = self.b1 * self.m[i] + (1 - self.b1) * g; self.v[i] = 0.999 * self.v[i] + 0.001 * g ** 2
            p -= self.lr * (self.m[i] / (1 - self.b1 ** self.t)) / (np.sqrt(self.v[i] / (1 - 0.999 ** self.t)) + 1e-8)
sig = lambda l: 1 / (1 + np.exp(-l))

# 1-D: data ~ N(0, 1), a fixed generator ~ N(1, 1.5^2). Train the discriminator (logistic regression on [1, x, x^2],
# enough to express the log-ratio of two Gaussians exactly) on 20,000 real and 20,000 generated points.
rng = np.random.default_rng(54)
pdf = lambda x, m, s: np.exp(-0.5 * ((x - m) / s) ** 2) / (s * np.sqrt(2 * np.pi))
x = np.concatenate([rng.normal(0, 1, 20000), rng.normal(1, 1.5, 20000)]); y = np.r_[np.ones(20000), np.zeros(20000)]
F = np.column_stack([np.ones_like(x), x, x ** 2]); w = np.zeros(3)
for _ in range(25):                                     # Newton steps on the logistic log-likelihood (Lab 39)
    p = sig(F @ w); w -= np.linalg.solve(F.T @ (F * (p * (1 - p))[:, None]), F.T @ (p - y))
for q in (-2.0, 0.0, 1.0, 3.0):
    a, b = pdf(q, 0, 1), pdf(q, 1, 1.5)
    print(f"x = {q:+.0f}: trained D = {sig(np.array([1, q, q * q]) @ w):.3f}   D* = p_data / (p_data + p_g) = {a / (a + b):.3f}")

# The game's value at D* equals 2 JS(p_data || p_g) - log 4 (numerical integration on a fine grid).
g = np.linspace(-12, 14, 200001); dx = g[1] - g[0]; a, b = pdf(g, 0, 1), pdf(g, 1, 1.5); m = (a + b) / 2
value = np.sum(a * np.log(a / (a + b)) + b * np.log(b / (a + b))) * dx
js = 0.5 * np.sum(a * np.log(a / m)) * dx + 0.5 * np.sum(b * np.log(b / m)) * dx
print(f"V(D*, G) = {value:.4f};  2 JS - log 4 = {2 * js - np.log(4):.4f};  if p_g = p_data: -log 4 = {-np.log(4):.4f}")`,
        },
      ],
    },
  },
  'l54-gantrain': {
    formulaTex: '$$\\begin{aligned} &\\text{saturating: } \\min\\ \\log(1 - D(G(z))) \\\\ &\\text{non-saturating: } \\max\\ \\log D(G(z)) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\partial_\\ell \\log(1 - \\sigma(\\ell))$', '-sig(l)', 'Vanishes when the fake is obviously fake.'],
        ['$\\partial_\\ell(-\\log\\sigma(\\ell))$', 'sig(l) - 1', 'Strong exactly then.'],
        ['g_steps', 'train_gan(seed, g_steps=5, lr=5e-3, steps=800)', 'The generator-heavy schedule.'],
      ],
    },
    notebook: {
      title: 'Lab 54.2 · Training GANs',
      intro: 'The two generator gradients at a confident “fake”, then balanced against generator-heavy training over six seeds.',
      cells: [
        {
          title: 'Balance and mode collapse',
          prose: '**Predict** how many of the six generator-heavy runs cover all eight modes.',
          code: `import numpy as np
MODES = np.array([[2 * np.cos(2 * np.pi * k / 8), 2 * np.sin(2 * np.pi * k / 8)] for k in range(8)])   # the ring of eight clusters
def ring(n, rng):
    """The playground's target: eight Gaussian clusters (sd 0.12) on a circle of radius 2."""
    return MODES[rng.integers(0, 8, n)] + 0.12 * rng.normal(size=(n, 2))
def mode_shares(S):
    """Share of samples within 0.54 of each mode."""
    return np.array([np.mean(np.hypot(*(S - m).T) < 0.54) for m in MODES])
def coverage(S):
    """Modes covered (at least 2% of samples) and the share of samples landing on some mode."""
    sh = mode_shares(S); return int(np.sum(sh >= 0.02)), float(sh.sum())

class MLP:
    """Dense layers with LeakyReLU(0.2) (or ReLU) between them, trained with Adam."""
    def __init__(self, sizes, rng, slope=0.2, lr=2e-3, b1=0.9):
        self.W = [rng.normal(0, np.sqrt(2 / a), (a, b)) for a, b in zip(sizes, sizes[1:])]; self.b = [np.zeros(b) for b in sizes[1:]]
        self.P = [p for wb in zip(self.W, self.b) for p in wb]; self.m = [0 * p for p in self.P]; self.v = [0 * p for p in self.P]
        self.slope, self.lr, self.b1, self.t = slope, lr, b1, 0
    def forward(self, X):
        self.A = [X]
        for i, (W, b) in enumerate(zip(self.W, self.b)):
            X = X @ W + b
            if i < len(self.W) - 1: self.A.append(X); X = np.where(X > 0, X, self.slope * X); self.A.append(X)
        return X
    def backward(self, g):
        """Accumulate parameter gradients (G) and return the gradient with respect to the input."""
        self.G = []
        for i in reversed(range(len(self.W))):
            inp = self.A[2 * i]; self.G = [inp.T @ g, g.sum(0)] + self.G; g = g @ self.W[i].T
            if i > 0: g = g * np.where(self.A[2 * i - 1] > 0, 1, self.slope)
        return g
    def step(self):
        self.t += 1
        for i, (p, g) in enumerate(zip(self.P, self.G)):
            self.m[i] = self.b1 * self.m[i] + (1 - self.b1) * g; self.v[i] = 0.999 * self.v[i] + 0.001 * g ** 2
            p -= self.lr * (self.m[i] / (1 - self.b1 ** self.t)) / (np.sqrt(self.v[i] / (1 - 0.999 ** self.t)) + 1e-8)
sig = lambda l: 1 / (1 + np.exp(-l))

# The generator loss's gradient with respect to the discriminator's logit l, where the fake is obviously fake (l = -6).
l = -6.0
print(f"saturating  d/dl log(1 - sig(l)) = {-sig(l):.4f};  non-saturating d/dl -log sig(l) = {sig(l) - 1:.4f}  ({(1 - sig(l)) / sig(l):.0f}x stronger)")

def train_gan(seed, steps=1500, g_steps=1, lr=2e-3, batch=64, snapshots=6):
    rng = np.random.default_rng(seed)
    G, D = MLP([2, 24, 24, 2], rng, lr=lr, b1=0.5), MLP([2, 24, 24, 1], rng, lr=lr, b1=0.5)
    fixed, snaps = rng.normal(size=(400, 2)), []
    for s in range(steps + 1):
        if s % (steps // (snapshots - 1)) == 0: snaps.append((s, G.forward(fixed)))
        if s == steps: break
        real, fake = ring(batch, rng), G.forward(rng.normal(size=(batch, 2)))
        D.backward((sig(D.forward(real)) - 1) / batch); Gr = D.G                               # real -> 1
        D.backward(sig(D.forward(fake)) / batch)                                                # fake -> 0
        D.G = [a + b for a, b in zip(Gr, D.G)]; D.step()
        for _ in range(g_steps):                                                                # non-saturating: fake -> 1
            gx = G.forward(rng.normal(size=(batch, 2))); logit = D.forward(gx)
            G.backward(D.backward((sig(logit) - 1) / batch)); G.step()
    return G, snaps, rng

for name, opts in [('balanced (1 G step per D step, lr 0.002)', {}), ('generator-heavy (5 G steps, lr 0.005, 800 steps)', dict(g_steps=5, lr=5e-3, steps=800))]:
    print(name)
    for seed in range(1, 7):
        G, snaps, rng = train_gan(seed, **opts); S = G.forward(rng.normal(size=(1000, 2))); cov, on = coverage(S); sh = mode_shares(S)
        tops = ', '.join(f"step {s}: mode {np.argmax(mode_shares(x)) + 1} ({mode_shares(x).max():.0%})" for s, x in snaps[3:])
        print(f"  seed {seed}: {cov} of 8 modes covered, {on:.0%} of samples on a mode, largest mode share {sh.max():.0%}")
        print(f"          fullest mode in the late snapshots: {tops}")`,
        },
      ],
    },
  },
  'l54-diffusion': {
    formulaTex: '$$\\begin{aligned} q(x_t \\mid x_0) &= \\mathcal N\\big(\\sqrt{\\bar\\alpha_t}\\,x_0,\\ (1 - \\bar\\alpha_t) I\\big) \\\\ x_t &= \\sqrt{\\bar\\alpha_t}\\,x_0 + \\sqrt{1 - \\bar\\alpha_t}\\,\\varepsilon \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\beta_t$', 'np.linspace(1e-3, 0.25, T)', 'The playground’s schedule, T = 40.'],
        ['$\\bar\\alpha_t$', 'np.cumprod(1 - betas)', 'Cumulative product of α.'],
        ['$x_t$', 'np.sqrt(abar[t]) * x0 + np.sqrt(1 - abar[t]) * eps', 'One jump to any step.'],
      ],
    },
    notebook: {
      title: 'Lab 54.3 · Diffusion: the forward process',
      intro: 'The signal factor along the schedule, the closed form against the step-by-step chain, and how fast the ring dissolves.',
      cells: [
        {
          title: 'The forward process',
          prose: '**Predict** the signal factor at the last step.',
          code: `import numpy as np
MODES = np.array([[2 * np.cos(2 * np.pi * k / 8), 2 * np.sin(2 * np.pi * k / 8)] for k in range(8)])   # the ring of eight clusters
def ring(n, rng):
    """The playground's target: eight Gaussian clusters (sd 0.12) on a circle of radius 2."""
    return MODES[rng.integers(0, 8, n)] + 0.12 * rng.normal(size=(n, 2))
def mode_shares(S):
    """Share of samples within 0.54 of each mode."""
    return np.array([np.mean(np.hypot(*(S - m).T) < 0.54) for m in MODES])
def coverage(S):
    """Modes covered (at least 2% of samples) and the share of samples landing on some mode."""
    sh = mode_shares(S); return int(np.sum(sh >= 0.02)), float(sh.sum())

class MLP:
    """Dense layers with LeakyReLU(0.2) (or ReLU) between them, trained with Adam."""
    def __init__(self, sizes, rng, slope=0.2, lr=2e-3, b1=0.9):
        self.W = [rng.normal(0, np.sqrt(2 / a), (a, b)) for a, b in zip(sizes, sizes[1:])]; self.b = [np.zeros(b) for b in sizes[1:]]
        self.P = [p for wb in zip(self.W, self.b) for p in wb]; self.m = [0 * p for p in self.P]; self.v = [0 * p for p in self.P]
        self.slope, self.lr, self.b1, self.t = slope, lr, b1, 0
    def forward(self, X):
        self.A = [X]
        for i, (W, b) in enumerate(zip(self.W, self.b)):
            X = X @ W + b
            if i < len(self.W) - 1: self.A.append(X); X = np.where(X > 0, X, self.slope * X); self.A.append(X)
        return X
    def backward(self, g):
        """Accumulate parameter gradients (G) and return the gradient with respect to the input."""
        self.G = []
        for i in reversed(range(len(self.W))):
            inp = self.A[2 * i]; self.G = [inp.T @ g, g.sum(0)] + self.G; g = g @ self.W[i].T
            if i > 0: g = g * np.where(self.A[2 * i - 1] > 0, 1, self.slope)
        return g
    def step(self):
        self.t += 1
        for i, (p, g) in enumerate(zip(self.P, self.G)):
            self.m[i] = self.b1 * self.m[i] + (1 - self.b1) * g; self.v[i] = 0.999 * self.v[i] + 0.001 * g ** 2
            p -= self.lr * (self.m[i] / (1 - self.b1 ** self.t)) / (np.sqrt(self.v[i] / (1 - 0.999 ** self.t)) + 1e-8)
sig = lambda l: 1 / (1 + np.exp(-l))

# The playground's schedule: T = 40 linearly spaced betas from 0.001 to 0.25.
T = 40; betas = np.linspace(1e-3, 0.25, T); alphas = 1 - betas; abar = np.cumprod(alphas)
for t in (0, 5, 10, 20, 30, 39):
    print(f"t = {t:2d}: signal factor sqrt(abar) = {np.sqrt(abar[t]):.3f}, noise sd sqrt(1 - abar) = {np.sqrt(1 - abar[t]):.3f}")

# Closed form against the chain: noise one point x0 = (2, 0) step by step, 100,000 times, up to t = 10.
rng = np.random.default_rng(54); x0 = np.array([2.0, 0.0]); t = 10
x = np.tile(x0, (100000, 1))
for s in range(t + 1): x = np.sqrt(alphas[s]) * x + np.sqrt(betas[s]) * rng.normal(size=x.shape)
print(f"chain after step {t}: mean {x.mean(0).round(3)}, variance {x.var(0).round(3)}")
print(f"closed form:        mean {(np.sqrt(abar[t]) * x0).round(3)}, variance {1 - abar[t]:.3f} in each coordinate")

# How fast the ring dissolves: share of noised ring points still within 0.54 of a mode (clean data: about 100%).
X0 = ring(4000, rng)
for t in (0, 5, 10, 20, 39):
    Xt = np.sqrt(abar[t]) * X0 + np.sqrt(1 - abar[t]) * rng.normal(size=X0.shape)
    print(f"t = {t:2d}: {coverage(Xt)[1]:.0%} of noised points still sit on a mode")
print(f"pure N(0, I) noise, for comparison: {coverage(rng.normal(size=(4000, 2)))[1]:.0%} land near a mode by chance")`,
        },
      ],
    },
  },
  'l54-reverse': {
    formulaTex: '$$\\begin{aligned} \\mathcal L &= \\mathbb E\\,\\big\\Vert \\varepsilon - \\varepsilon_\\theta(x_t, t) \\big\\Vert^2 \\\\ x_{t-1} &= \\frac{x_t - \\frac{\\beta_t}{\\sqrt{1 - \\bar\\alpha_t}}\\,\\hat\\varepsilon}{\\sqrt{\\alpha_t}} + \\sqrt{\\beta_t}\\,z \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\varepsilon_\\theta(x_t, t)$', 'net.forward(np.hstack([xt, feats(t)]))', 'Noise prediction from the point and time features.'],
        ['$\\mathcal L$', 'np.mean((pred - eps) ** 2)', 'Plain mean squared error.'],
        ['$x_{t-1}$', '(x - betas[t] / np.sqrt(1 - abar[t]) * e) / np.sqrt(alphas[t]) + ...', 'One ancestral step.'],
      ],
    },
    notebook: {
      title: 'Lab 54.4 · Learning to denoise and sampling',
      intro: 'Train the noise predictor on the ring and reverse the diffusion from pure noise.',
      cells: [
        {
          title: 'Train and sample',
          prose: '**Predict** how many of the eight modes the samples cover.',
          code: `import numpy as np
MODES = np.array([[2 * np.cos(2 * np.pi * k / 8), 2 * np.sin(2 * np.pi * k / 8)] for k in range(8)])   # the ring of eight clusters
def ring(n, rng):
    """The playground's target: eight Gaussian clusters (sd 0.12) on a circle of radius 2."""
    return MODES[rng.integers(0, 8, n)] + 0.12 * rng.normal(size=(n, 2))
def mode_shares(S):
    """Share of samples within 0.54 of each mode."""
    return np.array([np.mean(np.hypot(*(S - m).T) < 0.54) for m in MODES])
def coverage(S):
    """Modes covered (at least 2% of samples) and the share of samples landing on some mode."""
    sh = mode_shares(S); return int(np.sum(sh >= 0.02)), float(sh.sum())

class MLP:
    """Dense layers with LeakyReLU(0.2) (or ReLU) between them, trained with Adam."""
    def __init__(self, sizes, rng, slope=0.2, lr=2e-3, b1=0.9):
        self.W = [rng.normal(0, np.sqrt(2 / a), (a, b)) for a, b in zip(sizes, sizes[1:])]; self.b = [np.zeros(b) for b in sizes[1:]]
        self.P = [p for wb in zip(self.W, self.b) for p in wb]; self.m = [0 * p for p in self.P]; self.v = [0 * p for p in self.P]
        self.slope, self.lr, self.b1, self.t = slope, lr, b1, 0
    def forward(self, X):
        self.A = [X]
        for i, (W, b) in enumerate(zip(self.W, self.b)):
            X = X @ W + b
            if i < len(self.W) - 1: self.A.append(X); X = np.where(X > 0, X, self.slope * X); self.A.append(X)
        return X
    def backward(self, g):
        """Accumulate parameter gradients (G) and return the gradient with respect to the input."""
        self.G = []
        for i in reversed(range(len(self.W))):
            inp = self.A[2 * i]; self.G = [inp.T @ g, g.sum(0)] + self.G; g = g @ self.W[i].T
            if i > 0: g = g * np.where(self.A[2 * i - 1] > 0, 1, self.slope)
        return g
    def step(self):
        self.t += 1
        for i, (p, g) in enumerate(zip(self.P, self.G)):
            self.m[i] = self.b1 * self.m[i] + (1 - self.b1) * g; self.v[i] = 0.999 * self.v[i] + 0.001 * g ** 2
            p -= self.lr * (self.m[i] / (1 - self.b1 ** self.t)) / (np.sqrt(self.v[i] / (1 - 0.999 ** self.t)) + 1e-8)
sig = lambda l: 1 / (1 + np.exp(-l))

T = 40; betas = np.linspace(1e-3, 0.25, T); alphas = 1 - betas; abar = np.cumprod(alphas)
def feats(t):
    """Time as network input: t/T plus sines and cosines of 4 frequencies (as in the playground)."""
    t = np.asarray(t, float)[:, None]; k = np.arange(1, 5)
    return np.hstack([t / T, np.sin(k * np.pi * t / T), np.cos(k * np.pi * t / T)])

# Train eps_theta(x_t, t): sample x0, t, eps; form x_t in closed form; regress the noise (mean squared error).
rng = np.random.default_rng(54); net = MLP([2 + 9, 64, 64, 2], rng, slope=0.0, lr=3e-3)
for step in range(4000):
    x0 = ring(32, rng); t = rng.integers(0, T, 32); eps = rng.normal(size=(32, 2))
    xt = np.sqrt(abar[t])[:, None] * x0 + np.sqrt(1 - abar[t])[:, None] * eps
    pred = net.forward(np.hstack([xt, feats(t)])); net.backward(2 * (pred - eps) / pred.size); net.step()
    if step == 2400: net.lr /= 3
    if step % 1000 == 0 or step == 3999: print(f"step {step:4d}: noise-prediction loss {np.mean((pred - eps) ** 2):.3f}")

# Ancestral sampling: x_{t-1} = (x_t - beta_t / sqrt(1 - abar_t) * eps_hat) / sqrt(alpha_t) + sqrt(beta_t) * z.
x = rng.normal(size=(800, 2))
for t in range(T - 1, -1, -1):
    e = net.forward(np.hstack([x, feats(np.full(len(x), t))]))
    x = (x - betas[t] / np.sqrt(1 - abar[t]) * e) / np.sqrt(alphas[t]) + (np.sqrt(betas[t]) * rng.normal(size=x.shape) if t > 0 else 0)
    if t % 8 == 0: print(f"t = {t:2d}: {coverage(x)[1]:.0%} of samples on a mode")
cov, on = coverage(x)
print(f"800 samples: {cov} of 8 modes covered; shares per mode {np.round(mode_shares(x), 2)}")
print(f"cost: {T} network calls per sample; one reverse-step x0 estimate: (1 - sqrt(1 - 0.64) * 0.5) / sqrt(0.64) = {(1 - np.sqrt(0.36) * 0.5) / 0.8:.3f}")`,
        },
      ],
    },
  },
  'l54-compare': {
    formulaTex: '$$\\begin{aligned} \\text{bits/dim} &= \\frac{-\\log p(x)}{d\\,\\ln 2} \\\\ \\text{memorization: } &\\min_{x\' \\in \\text{train}} \\Vert \\hat x - x\' \\Vert \\end{aligned}$$',
    mathCode: {
      rows: [
        ['coverage', 'coverage(S)', 'Modes covered and the share of samples on a mode.'],
        ['nearest distance', 'nn(S)', 'Distance from each sample to its nearest training point.'],
      ],
    },
    notebook: {
      title: 'Lab 54.5 · Choosing and evaluating generative models',
      intro: 'Four stand-in generators scored on coverage, precision and closeness to the training set.',
      cells: [
        {
          title: 'Evaluate four generators',
          prose: '**Predict** which generator only the nearest-training-distance check exposes.',
          code: `import numpy as np
MODES = np.array([[2 * np.cos(2 * np.pi * k / 8), 2 * np.sin(2 * np.pi * k / 8)] for k in range(8)])   # the ring of eight clusters
def ring(n, rng):
    """The playground's target: eight Gaussian clusters (sd 0.12) on a circle of radius 2."""
    return MODES[rng.integers(0, 8, n)] + 0.12 * rng.normal(size=(n, 2))
def mode_shares(S):
    """Share of samples within 0.54 of each mode."""
    return np.array([np.mean(np.hypot(*(S - m).T) < 0.54) for m in MODES])
def coverage(S):
    """Modes covered (at least 2% of samples) and the share of samples landing on some mode."""
    sh = mode_shares(S); return int(np.sum(sh >= 0.02)), float(sh.sum())

class MLP:
    """Dense layers with LeakyReLU(0.2) (or ReLU) between them, trained with Adam."""
    def __init__(self, sizes, rng, slope=0.2, lr=2e-3, b1=0.9):
        self.W = [rng.normal(0, np.sqrt(2 / a), (a, b)) for a, b in zip(sizes, sizes[1:])]; self.b = [np.zeros(b) for b in sizes[1:]]
        self.P = [p for wb in zip(self.W, self.b) for p in wb]; self.m = [0 * p for p in self.P]; self.v = [0 * p for p in self.P]
        self.slope, self.lr, self.b1, self.t = slope, lr, b1, 0
    def forward(self, X):
        self.A = [X]
        for i, (W, b) in enumerate(zip(self.W, self.b)):
            X = X @ W + b
            if i < len(self.W) - 1: self.A.append(X); X = np.where(X > 0, X, self.slope * X); self.A.append(X)
        return X
    def backward(self, g):
        """Accumulate parameter gradients (G) and return the gradient with respect to the input."""
        self.G = []
        for i in reversed(range(len(self.W))):
            inp = self.A[2 * i]; self.G = [inp.T @ g, g.sum(0)] + self.G; g = g @ self.W[i].T
            if i > 0: g = g * np.where(self.A[2 * i - 1] > 0, 1, self.slope)
        return g
    def step(self):
        self.t += 1
        for i, (p, g) in enumerate(zip(self.P, self.G)):
            self.m[i] = self.b1 * self.m[i] + (1 - self.b1) * g; self.v[i] = 0.999 * self.v[i] + 0.001 * g ** 2
            p -= self.lr * (self.m[i] / (1 - self.b1 ** self.t)) / (np.sqrt(self.v[i] / (1 - 0.999 ** self.t)) + 1e-8)
sig = lambda l: 1 / (1 + np.exp(-l))

# Four stand-in generators for the ring, each producing 1,000 samples. Training set: 500 real points.
rng = np.random.default_rng(54); train = ring(500, rng)
gens = {
    'ideal (fresh draws from the ring)': ring(1000, rng),
    'memorizer (copies of 50 training points)': train[rng.integers(0, 50, 1000)] + 0.005 * rng.normal(size=(1000, 2)),
    'collapsed (all on one mode)': MODES[2] + 0.12 * rng.normal(size=(1000, 2)),
    'blurry (clusters with sd 0.35)': MODES[rng.integers(0, 8, 1000)] + 0.35 * rng.normal(size=(1000, 2)),
}
nn = lambda S: np.sqrt(((S[:, None, :] - train[None]) ** 2).sum(-1)).min(1)    # distance to the nearest training point
ref = np.median(nn(ring(1000, rng)))                                            # the same distance for new real data
for name, S in gens.items():
    cov, on = coverage(S)
    print(f"{name:42s} modes {cov}/8, on a mode {on:4.0%}, median nearest-training distance {np.median(nn(S)) / ref:.2f} x real")

# Bits per dimension for a likelihood model: -log p / (dimensions * ln 2).
print(f"784 pixels at log-likelihood -543.4 nats: {543.4 / (784 * np.log(2)):.3f} bits per dimension")`,
        },
      ],
    },
  },
}
