// Lab 53 runnable cells, typeset formulas and math ↔ code tables, keyed by lesson id.
// The 7 × 5 digits follow the playground (same templates and corruption; NumPy draws); the networks are small NumPy MLPs trained with Adam.
// 53.5 uses scikit-learn's real 8 × 8 handwritten digits.

export const extras = {
  'l53-ae': {
    formulaTex: '$$\\begin{aligned} z &= \\mathrm{enc}(x), \\quad \\hat x = \\mathrm{dec}(z) \\\\ \\ell &= -\\textstyle\\sum_j \\big[x_j\\log\\hat x_j \\\\ &\\qquad + (1 - x_j)\\log(1 - \\hat x_j)\\big] \\end{aligned}$$',
    mathCode: {
      rows: [
        ['enc, dec', 'MLP([35, 32, latent]), MLP([latent, 32, 35])', 'Encoder and decoder, each two dense layers.'],
        ['$\\ell$', 'bce(dec.forward(enc.forward(x)), x)', 'Binary cross-entropy per image, from logits.'],
        ['PCA', 'PCA(latent).inverse_transform(...)', 'The linear baseline with the same number of dimensions.'],
      ],
    },
    notebook: {
      title: 'Lab 53.1 · Autoencoders',
      intro: 'Bottlenecks of 2, 4 and 8 against PCA, and how the 2-number codes group digits without labels.',
      cells: [
        {
          title: 'Bottlenecks',
          prose: '**Predict** whether the autoencoder beats PCA at 2 dimensions.',
          code: `import numpy as np
FONT = ['01110100011001110101110011000101110', '00100011000010000100001000010001110', '01110100010000100010001000100011111', '11111000100010000010000011000101110', '00010001100101010010111110001000010', '11111100001111000001000011000101110', '00110010001000011110100011000101110', '11111000010001000100010000100001000', '01110100011000101110100011000101110', '01110100011000101111000010001001100']
TEMPL = np.array([[int(c) for c in f] for f in FONT], float)          # the ten 7 x 5 digit templates
def dataset(n, seed):
    """The playground's handwritten-ish digits: ink intensity jitter, a few flipped pixels, a little noise."""
    rng = np.random.default_rng(seed); d = np.arange(n) % 10; X = TEMPL[d].copy()
    X[X == 1] = 0.75 + 0.25 * rng.random((X == 1).sum())
    flip = rng.random(X.shape) < 0.06; X[flip] = np.where(X[flip] > 0, 0, 0.6 * rng.random(flip.sum()))
    return np.clip(X + 0.08 * rng.normal(size=X.shape), 0, 1), d
Xtr, dtr = dataset(400, 53); Xte, dte = dataset(200, 530)
sig = lambda v: 1 / (1 + np.exp(-v))

class MLP:
    """Two dense layers with a ReLU between them, trained with Adam."""
    def __init__(self, sizes, rng):
        self.P = [rng.normal(0, np.sqrt(2 / sizes[0]), (sizes[0], sizes[1])), np.zeros(sizes[1]), rng.normal(0, np.sqrt(2 / sizes[1]), (sizes[1], sizes[2])), np.zeros(sizes[2])]
        self.m = [np.zeros_like(p) for p in self.P]; self.v = [np.zeros_like(p) for p in self.P]; self.t = 0
    def forward(self, X):
        self.X = X; self.h = np.maximum(0, X @ self.P[0] + self.P[1]); return self.h @ self.P[2] + self.P[3]
    def backward(self, g):
        self.G = [None, None, self.h.T @ g, g.sum(0)]; gh = (g @ self.P[2].T) * (self.h > 0)
        self.G[0] = self.X.T @ gh; self.G[1] = gh.sum(0); return gh @ self.P[0].T
    def step(self, lr=0.01):
        self.t += 1
        for i in range(4):
            self.m[i] = 0.9 * self.m[i] + 0.1 * self.G[i]; self.v[i] = 0.999 * self.v[i] + 0.001 * self.G[i] ** 2
            self.P[i] -= lr * (self.m[i] / (1 - 0.9 ** self.t)) / (np.sqrt(self.v[i] / (1 - 0.999 ** self.t)) + 1e-8)

def bce(logits, target):
    p = sig(logits); return -np.mean(np.sum(target * np.log(p + 1e-9) + (1 - target) * np.log(1 - p + 1e-9), 1)), (p - target) / len(target)

def train_ae(latent=2, noise=0.0, epochs=60, seed=1):
    rng = np.random.default_rng(seed); enc, dec = MLP([35, 32, latent], rng), MLP([latent, 32, 35], rng)
    for _ in range(epochs):
        for b in np.array_split(rng.permutation(400), 10):
            x = Xtr[b]; inp = np.clip(x + noise * rng.normal(size=x.shape), 0, 1) if noise else x
            loss, g = bce(dec.forward(enc.forward(inp)), x)       # the target is always the CLEAN image
            enc.backward(dec.backward(g)); enc.step(); dec.step()
    return enc, dec

def train_vae(beta=1.0, latent=2, epochs=60, seed=1, X=None):
    X = Xtr if X is None else X
    rng = np.random.default_rng(seed); enc, dec = MLP([35, 32, 2 * latent], rng), MLP([latent, 32, 35], rng); hist = []
    for _ in range(epochs):
        for b in np.array_split(rng.permutation(len(X)), len(X) // 40):
            x = X[b]; n = len(x); h = enc.forward(x); mu, lv = h[:, :latent], h[:, latent:]
            eps = rng.normal(size=mu.shape); z = mu + np.exp(0.5 * lv) * eps       # the reparameterization trick
            rec, g = bce(dec.forward(z), x); dz = dec.backward(g)
            kl = 0.5 * np.sum(np.exp(lv) + mu ** 2 - 1 - lv) / n
            dmu = dz + beta * mu / n; dlv = dz * eps * 0.5 * np.exp(0.5 * lv) + beta * 0.5 * (np.exp(lv) - 1) / n
            enc.backward(np.hstack([dmu, dlv])); enc.step(); dec.step()
        hist.append((rec, kl))
    return enc, dec, hist

def nearest_digit(img):
    """Which template an image looks most like, and how much (correlation)."""
    c = [np.corrcoef(img, t)[0, 1] for t in TEMPL]; return int(np.argmax(c)), max(c)

from sklearn.decomposition import PCA
def recon_bce(enc, dec, X):
    p = sig(dec.forward(enc.forward(X))); return -np.mean(np.sum(X * np.log(p + 1e-9) + (1 - X) * np.log(1 - p + 1e-9), 1))
for latent in [2, 4, 8]:
    enc, dec = train_ae(latent)
    pca = PCA(latent).fit(Xtr); Xp = np.clip(pca.inverse_transform(pca.transform(Xte)), 0, 1)
    print(f"bottleneck {latent}: test reconstruction error (BCE per image) {recon_bce(enc, dec, Xte):.2f}; squared error autoencoder {np.mean((sig(dec.forward(enc.forward(Xte))) - Xte) ** 2):.4f}, PCA {np.mean((Xp - Xte) ** 2):.4f}")
enc, dec = train_ae(2)
Z = enc.forward(Xte)
cent = np.array([Z[dte == d].mean(0) for d in range(10)])
nearest = np.argmin(((Z[:, None, :] - cent[None]) ** 2).sum(-1), 1)
print(f"2-number codes: {np.mean(nearest == dte):.0%} of test digits are closest to their own digit's average code — without any labels in training")
print(f"784 pixels into 16 numbers: {784 // 16}× compression")`,
        },
      ],
    },
  },
  'l53-denoise': {
    formulaTex: '$$\\begin{aligned} &\\min\\ \\ell\\big(x,\\ \\mathrm{dec}(\\mathrm{enc}(\\tilde x))\\big) \\\\ &\\text{anomaly score} = \\ell(x, \\hat x) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\tilde x$', 'np.clip(x + noise * rng.normal(size=x.shape), 0, 1)', 'The corrupted input; the target stays clean.'],
        ['threshold', 'np.percentile(score(Xte), 99)', 'Set on clean data.'],
      ],
    },
    notebook: {
      title: 'Lab 53.2 · Denoising and anomaly detection',
      intro: 'Denoising against plain training on noisy test digits, and a reconstruction-error alarm for a non-digit.',
      cells: [
        {
          title: 'Clean-up and anomalies',
          prose: '**Predict** how much better the denoising autoencoder cleans noisy digits.',
          code: `import numpy as np
FONT = ['01110100011001110101110011000101110', '00100011000010000100001000010001110', '01110100010000100010001000100011111', '11111000100010000010000011000101110', '00010001100101010010111110001000010', '11111100001111000001000011000101110', '00110010001000011110100011000101110', '11111000010001000100010000100001000', '01110100011000101110100011000101110', '01110100011000101111000010001001100']
TEMPL = np.array([[int(c) for c in f] for f in FONT], float)          # the ten 7 x 5 digit templates
def dataset(n, seed):
    """The playground's handwritten-ish digits: ink intensity jitter, a few flipped pixels, a little noise."""
    rng = np.random.default_rng(seed); d = np.arange(n) % 10; X = TEMPL[d].copy()
    X[X == 1] = 0.75 + 0.25 * rng.random((X == 1).sum())
    flip = rng.random(X.shape) < 0.06; X[flip] = np.where(X[flip] > 0, 0, 0.6 * rng.random(flip.sum()))
    return np.clip(X + 0.08 * rng.normal(size=X.shape), 0, 1), d
Xtr, dtr = dataset(400, 53); Xte, dte = dataset(200, 530)
sig = lambda v: 1 / (1 + np.exp(-v))

class MLP:
    """Two dense layers with a ReLU between them, trained with Adam."""
    def __init__(self, sizes, rng):
        self.P = [rng.normal(0, np.sqrt(2 / sizes[0]), (sizes[0], sizes[1])), np.zeros(sizes[1]), rng.normal(0, np.sqrt(2 / sizes[1]), (sizes[1], sizes[2])), np.zeros(sizes[2])]
        self.m = [np.zeros_like(p) for p in self.P]; self.v = [np.zeros_like(p) for p in self.P]; self.t = 0
    def forward(self, X):
        self.X = X; self.h = np.maximum(0, X @ self.P[0] + self.P[1]); return self.h @ self.P[2] + self.P[3]
    def backward(self, g):
        self.G = [None, None, self.h.T @ g, g.sum(0)]; gh = (g @ self.P[2].T) * (self.h > 0)
        self.G[0] = self.X.T @ gh; self.G[1] = gh.sum(0); return gh @ self.P[0].T
    def step(self, lr=0.01):
        self.t += 1
        for i in range(4):
            self.m[i] = 0.9 * self.m[i] + 0.1 * self.G[i]; self.v[i] = 0.999 * self.v[i] + 0.001 * self.G[i] ** 2
            self.P[i] -= lr * (self.m[i] / (1 - 0.9 ** self.t)) / (np.sqrt(self.v[i] / (1 - 0.999 ** self.t)) + 1e-8)

def bce(logits, target):
    p = sig(logits); return -np.mean(np.sum(target * np.log(p + 1e-9) + (1 - target) * np.log(1 - p + 1e-9), 1)), (p - target) / len(target)

def train_ae(latent=2, noise=0.0, epochs=60, seed=1):
    rng = np.random.default_rng(seed); enc, dec = MLP([35, 32, latent], rng), MLP([latent, 32, 35], rng)
    for _ in range(epochs):
        for b in np.array_split(rng.permutation(400), 10):
            x = Xtr[b]; inp = np.clip(x + noise * rng.normal(size=x.shape), 0, 1) if noise else x
            loss, g = bce(dec.forward(enc.forward(inp)), x)       # the target is always the CLEAN image
            enc.backward(dec.backward(g)); enc.step(); dec.step()
    return enc, dec

def train_vae(beta=1.0, latent=2, epochs=60, seed=1, X=None):
    X = Xtr if X is None else X
    rng = np.random.default_rng(seed); enc, dec = MLP([35, 32, 2 * latent], rng), MLP([latent, 32, 35], rng); hist = []
    for _ in range(epochs):
        for b in np.array_split(rng.permutation(len(X)), len(X) // 40):
            x = X[b]; n = len(x); h = enc.forward(x); mu, lv = h[:, :latent], h[:, latent:]
            eps = rng.normal(size=mu.shape); z = mu + np.exp(0.5 * lv) * eps       # the reparameterization trick
            rec, g = bce(dec.forward(z), x); dz = dec.backward(g)
            kl = 0.5 * np.sum(np.exp(lv) + mu ** 2 - 1 - lv) / n
            dmu = dz + beta * mu / n; dlv = dz * eps * 0.5 * np.exp(0.5 * lv) + beta * 0.5 * (np.exp(lv) - 1) / n
            enc.backward(np.hstack([dmu, dlv])); enc.step(); dec.step()
        hist.append((rec, kl))
    return enc, dec, hist

def nearest_digit(img):
    """Which template an image looks most like, and how much (correlation)."""
    c = [np.corrcoef(img, t)[0, 1] for t in TEMPL]; return int(np.argmax(c)), max(c)

rng = np.random.default_rng(4); noisy_te = np.clip(Xte + 0.3 * rng.normal(size=Xte.shape), 0, 1)
plain, dn = train_ae(2), train_ae(2, noise=0.3)
err = lambda m: np.mean((sig(m[1].forward(m[0].forward(noisy_te))) - Xte) ** 2)
print(f"cleaning noisy test digits (squared error to the clean image): denoising {err(dn):.4f}, plain {err(plain):.4f} — {1 - err(dn) / err(plain):.0%} better")
# Anomaly scores: reconstruction error of clean test digits sets the threshold; an 'X' shape is not a digit.
score = lambda x: np.mean((sig(plain[1].forward(plain[0].forward(x))) - x) ** 2, 1)
threshold = np.percentile(score(Xte), 99)
X_shape = np.array([[1 if (c == r * 5 // 7 or c == 4 - r * 5 // 7) else 0 for c in range(5)] for r in range(7)], float).ravel()[None]
print(f"99th-percentile threshold {threshold:.4f}; the 'X' shape scores {score(X_shape)[0]:.4f} -> {'ANOMALY' if score(X_shape)[0] > threshold else 'normal'}")
print(f"10,000 clean inputs a day above the 99th percentile: about {10000 * 0.01:.0f} false alarms")`,
        },
      ],
    },
  },
  'l53-vae': {
    formulaTex: '$$\\begin{aligned} \\mathrm{ELBO} &= \\mathbb E_{q}[\\log p(x \\mid z)] \\\\ &\\quad - \\mathrm{KL}\\big(q(z \\mid x)\\,\\Vert\\,\\mathcal N(0, I)\\big) \\\\ \\mathrm{KL} &= \\tfrac12\\textstyle\\sum_k(\\sigma_k^2 + \\mu_k^2 - 1 - \\log\\sigma_k^2) \\\\ z &= \\mu + \\sigma\\varepsilon \\end{aligned}$$',
    mathCode: {
      rows: [
        ['KL', '0.5 * (var + mu ** 2 - 1 - np.log(var))', 'Closed form, checked by Monte Carlo.'],
        ['$z = \\mu + \\sigma\\varepsilon$', 'mu + sigma * eps', 'The reparameterization: gradients flow through μ and σ.'],
      ],
    },
    notebook: {
      title: 'Lab 53.3 · Variational autoencoders',
      intro: 'The Gaussian KL in closed form against a million samples, and a gradient through the reparameterization.',
      cells: [
        {
          title: 'KL and reparameterization',
          prose: '**Predict** the KL of N(1, 1) against N(0, 1).',
          code: `import numpy as np
rng = np.random.default_rng(53)
mu, var = 1.0, 1.0
closed = 0.5 * (var + mu ** 2 - 1 - np.log(var))
z = mu + np.sqrt(var) * rng.normal(size=1_000_000)                 # samples from q = N(mu, var)
mc = np.mean(-0.5 * np.log(var) - (z - mu) ** 2 / (2 * var) + z ** 2 / 2)   # log q(z) - log p(z), averaged
print(f"KL(N({mu}, {var}) || N(0, 1)): closed form {closed:.4f}, Monte Carlo {mc:.4f}")
print(f"mean 0, variance 1 (exactly the prior): KL = {0.5 * (1 + 0 - 1 - np.log(1)):.1f}")
# Reparameterization: z = mu + sigma * eps lets gradients reach mu. d/dmu E[z^2] = 2 mu.
eps = rng.normal(size=1_000_000); sigma = 0.5
grad_mu = np.mean(2 * (mu + sigma * eps))                           # the derivative of z^2 through z = mu + sigma eps
print(f"d/dmu E[z^2] by reparameterized samples {grad_mu:.4f}; exact 2 mu = {2 * mu}")`,
        },
      ],
    },
  },
  'l53-generate': {
    formulaTex: '$$\\begin{aligned} \\max\\ &\\mathbb E_q[\\log p(x \\mid z)] \\\\ &- \\beta\\,\\mathrm{KL}\\big(q(z \\mid x)\\,\\Vert\\,p(z)\\big) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\beta$', 'train_vae(beta)', 'Weight on the KL term.'],
        ['samples', 'dec.forward(z) for z ~ N(0, I)', 'Generate by decoding random codes.'],
        ['clear', 'nearest_digit(img) correlation > 0.7', 'Does a sample look like some digit?'],
      ],
    },
    notebook: {
      title: 'Lab 53.4 · Generating and the β trade-off',
      intro: 'VAEs with β = 0.1, 1 and 4, and a plain autoencoder, decoding the same 200 random codes.',
      cells: [
        {
          title: 'β and posterior collapse',
          prose: '**Predict** how many different digits β = 4 produces.',
          code: `import numpy as np
FONT = ['01110100011001110101110011000101110', '00100011000010000100001000010001110', '01110100010000100010001000100011111', '11111000100010000010000011000101110', '00010001100101010010111110001000010', '11111100001111000001000011000101110', '00110010001000011110100011000101110', '11111000010001000100010000100001000', '01110100011000101110100011000101110', '01110100011000101111000010001001100']
TEMPL = np.array([[int(c) for c in f] for f in FONT], float)          # the ten 7 x 5 digit templates
def dataset(n, seed):
    """The playground's handwritten-ish digits: ink intensity jitter, a few flipped pixels, a little noise."""
    rng = np.random.default_rng(seed); d = np.arange(n) % 10; X = TEMPL[d].copy()
    X[X == 1] = 0.75 + 0.25 * rng.random((X == 1).sum())
    flip = rng.random(X.shape) < 0.06; X[flip] = np.where(X[flip] > 0, 0, 0.6 * rng.random(flip.sum()))
    return np.clip(X + 0.08 * rng.normal(size=X.shape), 0, 1), d
Xtr, dtr = dataset(400, 53); Xte, dte = dataset(200, 530)
sig = lambda v: 1 / (1 + np.exp(-v))

class MLP:
    """Two dense layers with a ReLU between them, trained with Adam."""
    def __init__(self, sizes, rng):
        self.P = [rng.normal(0, np.sqrt(2 / sizes[0]), (sizes[0], sizes[1])), np.zeros(sizes[1]), rng.normal(0, np.sqrt(2 / sizes[1]), (sizes[1], sizes[2])), np.zeros(sizes[2])]
        self.m = [np.zeros_like(p) for p in self.P]; self.v = [np.zeros_like(p) for p in self.P]; self.t = 0
    def forward(self, X):
        self.X = X; self.h = np.maximum(0, X @ self.P[0] + self.P[1]); return self.h @ self.P[2] + self.P[3]
    def backward(self, g):
        self.G = [None, None, self.h.T @ g, g.sum(0)]; gh = (g @ self.P[2].T) * (self.h > 0)
        self.G[0] = self.X.T @ gh; self.G[1] = gh.sum(0); return gh @ self.P[0].T
    def step(self, lr=0.01):
        self.t += 1
        for i in range(4):
            self.m[i] = 0.9 * self.m[i] + 0.1 * self.G[i]; self.v[i] = 0.999 * self.v[i] + 0.001 * self.G[i] ** 2
            self.P[i] -= lr * (self.m[i] / (1 - 0.9 ** self.t)) / (np.sqrt(self.v[i] / (1 - 0.999 ** self.t)) + 1e-8)

def bce(logits, target):
    p = sig(logits); return -np.mean(np.sum(target * np.log(p + 1e-9) + (1 - target) * np.log(1 - p + 1e-9), 1)), (p - target) / len(target)

def train_ae(latent=2, noise=0.0, epochs=60, seed=1):
    rng = np.random.default_rng(seed); enc, dec = MLP([35, 32, latent], rng), MLP([latent, 32, 35], rng)
    for _ in range(epochs):
        for b in np.array_split(rng.permutation(400), 10):
            x = Xtr[b]; inp = np.clip(x + noise * rng.normal(size=x.shape), 0, 1) if noise else x
            loss, g = bce(dec.forward(enc.forward(inp)), x)       # the target is always the CLEAN image
            enc.backward(dec.backward(g)); enc.step(); dec.step()
    return enc, dec

def train_vae(beta=1.0, latent=2, epochs=60, seed=1, X=None):
    X = Xtr if X is None else X
    rng = np.random.default_rng(seed); enc, dec = MLP([35, 32, 2 * latent], rng), MLP([latent, 32, 35], rng); hist = []
    for _ in range(epochs):
        for b in np.array_split(rng.permutation(len(X)), len(X) // 40):
            x = X[b]; n = len(x); h = enc.forward(x); mu, lv = h[:, :latent], h[:, latent:]
            eps = rng.normal(size=mu.shape); z = mu + np.exp(0.5 * lv) * eps       # the reparameterization trick
            rec, g = bce(dec.forward(z), x); dz = dec.backward(g)
            kl = 0.5 * np.sum(np.exp(lv) + mu ** 2 - 1 - lv) / n
            dmu = dz + beta * mu / n; dlv = dz * eps * 0.5 * np.exp(0.5 * lv) + beta * 0.5 * (np.exp(lv) - 1) / n
            enc.backward(np.hstack([dmu, dlv])); enc.step(); dec.step()
        hist.append((rec, kl))
    return enc, dec, hist

def nearest_digit(img):
    """Which template an image looks most like, and how much (correlation)."""
    c = [np.corrcoef(img, t)[0, 1] for t in TEMPL]; return int(np.argmax(c)), max(c)

rng = np.random.default_rng(11); Zs = rng.normal(size=(200, 2))
for beta in [0.1, 1.0, 4.0]:
    enc, dec, hist = train_vae(beta)
    res = [nearest_digit(sig(dec.forward(z[None]))[0]) for z in Zs]
    clear = [d for d, c in res if c > 0.7]
    print(f"beta {beta}: final KL {hist[-1][1]:.2f} nats, reconstruction {hist[-1][0]:.2f}; random codes decoding to a clear digit {len(clear) / 200:.0%}, different digits {len(set(clear))}")
enc, dec = train_ae(2)
res = [nearest_digit(sig(dec.forward(z[None]))[0]) for z in Zs]; clear = [d for d, c in res if c > 0.7]
print(f"plain autoencoder decoding the same codes: clear {len(clear) / 200:.0%}, different digits {len(set(clear))}")`,
        },
      ],
    },
  },
  'l53-uses': {
    formulaTex: '$$\\begin{aligned} &\\text{unlabelled } x \\to \\mathrm{enc} \\to z \\\\ &\\text{few labels: a classifier on } z \\end{aligned}$$',
    mathCode: {
      rows: [
        ['pretraining', 'vae_on(Xd[pool])', '1,400 real digits, no labels.'],
        ['features', 'enc.forward(X)[:, :8]', 'The posterior means.'],
        ['baseline', 'LogisticRegression on raw pixels', 'Always compare with the raw features.'],
      ],
    },
    notebook: {
      title: 'Lab 53.5 · Representation learning in practice',
      intro: 'VAE codes against raw pixels as features for 20, 50 and 200 labels, on scikit-learn’s real digits.',
      cells: [
        {
          title: 'Codes as features',
          prose: '**Predict** whether the codes beat raw pixels with 50 labels.',
          code: `import numpy as np
FONT = ['01110100011001110101110011000101110', '00100011000010000100001000010001110', '01110100010000100010001000100011111', '11111000100010000010000011000101110', '00010001100101010010111110001000010', '11111100001111000001000011000101110', '00110010001000011110100011000101110', '11111000010001000100010000100001000', '01110100011000101110100011000101110', '01110100011000101111000010001001100']
TEMPL = np.array([[int(c) for c in f] for f in FONT], float)          # the ten 7 x 5 digit templates
def dataset(n, seed):
    """The playground's handwritten-ish digits: ink intensity jitter, a few flipped pixels, a little noise."""
    rng = np.random.default_rng(seed); d = np.arange(n) % 10; X = TEMPL[d].copy()
    X[X == 1] = 0.75 + 0.25 * rng.random((X == 1).sum())
    flip = rng.random(X.shape) < 0.06; X[flip] = np.where(X[flip] > 0, 0, 0.6 * rng.random(flip.sum()))
    return np.clip(X + 0.08 * rng.normal(size=X.shape), 0, 1), d
Xtr, dtr = dataset(400, 53); Xte, dte = dataset(200, 530)
sig = lambda v: 1 / (1 + np.exp(-v))

class MLP:
    """Two dense layers with a ReLU between them, trained with Adam."""
    def __init__(self, sizes, rng):
        self.P = [rng.normal(0, np.sqrt(2 / sizes[0]), (sizes[0], sizes[1])), np.zeros(sizes[1]), rng.normal(0, np.sqrt(2 / sizes[1]), (sizes[1], sizes[2])), np.zeros(sizes[2])]
        self.m = [np.zeros_like(p) for p in self.P]; self.v = [np.zeros_like(p) for p in self.P]; self.t = 0
    def forward(self, X):
        self.X = X; self.h = np.maximum(0, X @ self.P[0] + self.P[1]); return self.h @ self.P[2] + self.P[3]
    def backward(self, g):
        self.G = [None, None, self.h.T @ g, g.sum(0)]; gh = (g @ self.P[2].T) * (self.h > 0)
        self.G[0] = self.X.T @ gh; self.G[1] = gh.sum(0); return gh @ self.P[0].T
    def step(self, lr=0.01):
        self.t += 1
        for i in range(4):
            self.m[i] = 0.9 * self.m[i] + 0.1 * self.G[i]; self.v[i] = 0.999 * self.v[i] + 0.001 * self.G[i] ** 2
            self.P[i] -= lr * (self.m[i] / (1 - 0.9 ** self.t)) / (np.sqrt(self.v[i] / (1 - 0.999 ** self.t)) + 1e-8)

def bce(logits, target):
    p = sig(logits); return -np.mean(np.sum(target * np.log(p + 1e-9) + (1 - target) * np.log(1 - p + 1e-9), 1)), (p - target) / len(target)

def train_ae(latent=2, noise=0.0, epochs=60, seed=1):
    rng = np.random.default_rng(seed); enc, dec = MLP([35, 32, latent], rng), MLP([latent, 32, 35], rng)
    for _ in range(epochs):
        for b in np.array_split(rng.permutation(400), 10):
            x = Xtr[b]; inp = np.clip(x + noise * rng.normal(size=x.shape), 0, 1) if noise else x
            loss, g = bce(dec.forward(enc.forward(inp)), x)       # the target is always the CLEAN image
            enc.backward(dec.backward(g)); enc.step(); dec.step()
    return enc, dec

def train_vae(beta=1.0, latent=2, epochs=60, seed=1, X=None):
    X = Xtr if X is None else X
    rng = np.random.default_rng(seed); enc, dec = MLP([35, 32, 2 * latent], rng), MLP([latent, 32, 35], rng); hist = []
    for _ in range(epochs):
        for b in np.array_split(rng.permutation(len(X)), len(X) // 40):
            x = X[b]; n = len(x); h = enc.forward(x); mu, lv = h[:, :latent], h[:, latent:]
            eps = rng.normal(size=mu.shape); z = mu + np.exp(0.5 * lv) * eps       # the reparameterization trick
            rec, g = bce(dec.forward(z), x); dz = dec.backward(g)
            kl = 0.5 * np.sum(np.exp(lv) + mu ** 2 - 1 - lv) / n
            dmu = dz + beta * mu / n; dlv = dz * eps * 0.5 * np.exp(0.5 * lv) + beta * 0.5 * (np.exp(lv) - 1) / n
            enc.backward(np.hstack([dmu, dlv])); enc.step(); dec.step()
        hist.append((rec, kl))
    return enc, dec, hist

def nearest_digit(img):
    """Which template an image looks most like, and how much (correlation)."""
    c = [np.corrcoef(img, t)[0, 1] for t in TEMPL]; return int(np.argmax(c)), max(c)

from sklearn.datasets import load_digits
from sklearn.linear_model import LogisticRegression
digits = load_digits(); Xd = digits.data / 16; yd = digits.target      # 1,797 real 8 x 8 handwritten digits
rng = np.random.default_rng(0); order = rng.permutation(len(Xd)); pool, test = order[:1400], order[1400:]
def vae_on(X, latent=8, epochs=40, seed=1, beta=1.0):
    """The same VAE as above, with a 64-pixel input and output."""
    r = np.random.default_rng(seed); enc, dec = MLP([64, 64, 2 * latent], r), MLP([latent, 64, 64], r)
    for _ in range(epochs):
        for b in np.array_split(r.permutation(len(X)), len(X) // 50):
            x = X[b]; n = len(x); h = enc.forward(x); mu, lv = h[:, :latent], np.clip(h[:, latent:], -8, 8)
            eps = r.normal(size=mu.shape); z = mu + np.exp(0.5 * lv) * eps
            _, g = bce(dec.forward(z), x); dz = dec.backward(g)
            enc.backward(np.hstack([dz + beta * mu / n, dz * eps * 0.5 * np.exp(0.5 * lv) + beta * 0.5 * (np.exp(lv) - 1) / n])); enc.step(); dec.step()
    return enc
enc = vae_on(Xd[pool])                                          # trained on 1,400 digits WITHOUT their labels
codes = lambda X: enc.forward(X)[:, :8]
for n_labels in [20, 50, 200]:
    few = pool[:n_labels]
    raw = LogisticRegression(max_iter=3000).fit(Xd[few], yd[few]).score(Xd[test], yd[test])
    cod = LogisticRegression(max_iter=3000).fit(codes(Xd[few]), yd[few]).score(codes(Xd[test]), yd[test])
    print(f"{n_labels:3d} labels: raw pixels {raw:.3f}, VAE codes {cod:.3f}")`,
        },
      ],
    },
  },
}
