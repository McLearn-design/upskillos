// Lab 61 runnable cells, typeset formulas and math ↔ code tables, keyed by lesson id.
// The digits, the network (35 → 48 → 10), the attacks, the shifted regression, the label-shift classes and the rotated
// domains follow the playground, with NumPy draws and scikit-learn logistic regressions where the playground uses its own.

export const extras = {
  'l61-adversarial': {
    formulaTex: '$$\\begin{aligned} x_{\\text{adv}} &= \\mathrm{clip}\\big(x + \\varepsilon\\,\\mathrm{sign}(\\nabla_x L(x, y)),\\ 0,\\ 1\\big) \\\\ \\max_{\\Vert\\delta\\Vert_\\infty \\le \\varepsilon} w^\\top\\delta &= \\varepsilon\\,\\Vert w\\Vert_1 \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\nabla_x L$', 'net.grads(X, y)[1]', 'The backward pass carried to the input.'],
        ['FGSM', 'np.clip(X + eps * np.sign(g), 0, 1)', 'One signed step.'],
        ['PGD', 'np.clip(np.clip(A + eps / 4 * np.sign(g), X - eps, X + eps), 0, 1)', 'Step, project into the ε-box, repeat.'],
      ],
    },
    notebook: {
      title: 'Lab 61.1 · Adversarial examples',
      intro: 'Random noise, FGSM and PGD at three budgets on the playground’s digits, and why aligned changes add up.',
      cells: [
        {
          title: 'Attacks against noise',
          prose: '**Predict** accuracy under FGSM at ε = 0.1, against 88–90% under random noise of the same size.',
          code: `import numpy as np
FONT = ['01110100011001110101110011000101110', '00100011000010000100001000010001110', '01110100010000100010001000100011111', '11111000100010000010000011000101110', '00010001100101010010111110001000010', '11111100001111000001000011000101110', '00110010001000011110100011000101110', '11111000010001000100010000100001000', '01110100011000101110100011000101110', '01110100011000101111000010001001100']
TEMPL = np.array([[int(c) for c in f] for f in FONT], float)
def digits(n, seed):
    """The playground's 7 x 5 digits: ink jitter, flipped pixels, a one-pixel shift and noise."""
    rng = np.random.default_rng(seed); d = np.arange(n) % 10; X = TEMPL[d].copy()
    X[X == 1] = 0.75 + 0.25 * rng.random((X == 1).sum()); flip = rng.random(X.shape) < 0.06; X[flip] = np.where(X[flip] > 0, 0, 0.6 * rng.random(flip.sum()))
    X = np.clip(X + 0.08 * rng.normal(size=X.shape), 0, 1).reshape(n, 7, 5); out = np.zeros_like(X)
    for i in range(n):
        dy, dx = rng.integers(-1, 2, 2); img = np.roll(np.roll(X[i], dy, 0), dx, 1)
        if dy == 1: img[0] = 0
        if dy == -1: img[-1] = 0
        if dx == 1: img[:, 0] = 0
        if dx == -1: img[:, -1] = 0
        out[i] = img
    return np.clip(out.reshape(n, 35) + 0.15 * rng.normal(size=(n, 35)), 0, 1), d
Xtr, ytr = digits(1000, 611); Xte, yte = digits(400, 612)

class Net:
    """35 -> 48 ReLU -> 10, softmax cross-entropy, Adam; exposes the gradient of the loss with respect to the input."""
    def __init__(self, seed):
        rng = np.random.default_rng(seed); self.P = [rng.normal(0, np.sqrt(2 / 35), (35, 48)), np.zeros(48), rng.normal(0, np.sqrt(1 / 48), (48, 10)), np.zeros(10)]
        self.M = [0 * p for p in self.P]; self.S = [0 * p for p in self.P]; self.t = 0
    def logits(self, X):
        self.X = X; self.h = np.maximum(0, X @ self.P[0] + self.P[1]); return self.h @ self.P[2] + self.P[3]
    def grads(self, X, y):
        z = self.logits(X); q = np.exp(z - z.max(1, keepdims=True)); q /= q.sum(1, keepdims=True); q[np.arange(len(y)), y] -= 1; g = q / len(y)
        gh = (g @ self.P[2].T) * (self.h > 0)
        return [X.T @ gh, gh.sum(0), self.h.T @ g, g.sum(0)], gh @ self.P[0].T            # weight gradients, input gradient
    def step(self, G, lr=0.005):
        self.t += 1
        for k in range(4):
            self.M[k] = 0.9 * self.M[k] + 0.1 * G[k]; self.S[k] = 0.999 * self.S[k] + 0.001 * G[k] ** 2
            self.P[k] -= lr * (self.M[k] / (1 - 0.9 ** self.t)) / (np.sqrt(self.S[k] / (1 - 0.999 ** self.t)) + 1e-8)
    acc = lambda self, X, y: float(np.mean(self.logits(X).argmax(1) == y))

def fgsm(net, X, y, eps):
    return np.clip(X + eps * np.sign(net.grads(X, y)[1]), 0, 1)
def pgd(net, X, y, eps, steps=10, seed=1):
    rng = np.random.default_rng(seed); A = np.clip(X + eps * rng.uniform(-1, 1, X.shape), 0, 1)
    for _ in range(steps):
        A = np.clip(np.clip(A + eps / 4 * np.sign(net.grads(A, y)[1]), X - eps, X + eps), 0, 1)   # step, then project
    return A
def train(adv_eps=0.0, attack='fgsm', epochs=25, seed=1):
    net = Net(seed); rng = np.random.default_rng(seed)
    for e in range(epochs):
        for b in np.array_split(rng.permutation(1000), 20):
            X, y = Xtr[b], ytr[b]
            if adv_eps: X = pgd(net, X, y, adv_eps, steps=5, seed=e * 1000 + int(b[0])) if attack == 'pgd' else fgsm(net, X, y, adv_eps)
            net.step(net.grads(X, y)[0])
    return net

net = train()
print(f"clean test accuracy {net.acc(Xte, yte):.3f}")
rng = np.random.default_rng(2)
for eps in (0.05, 0.1, 0.15):
    noise = np.clip(Xte + eps * rng.choice([-1, 1], Xte.shape), 0, 1)
    print(f"eps = {eps}: random +/-eps noise {net.acc(noise, yte):.3f}, FGSM {net.acc(fgsm(net, Xte, yte, eps), yte):.3f}, PGD {net.acc(pgd(net, Xte, yte, eps), yte):.3f}")

# Why aligned changes win: for a linear score w.x, the worst L-infinity step moves it by eps * ||w||_1,
# random signs by about eps * ||w||_2, and the gap grows with the dimension.
rng = np.random.default_rng(0)
for d in (35, 1000, 100000):
    w = rng.normal(size=d); eps = 0.01
    print(f"d = {d:6d}: aligned change {eps * np.abs(w).sum():8.2f}, typical random change {eps * np.linalg.norm(w):6.2f}")`,
        },
      ],
    },
  },
  'l61-advtrain': {
    formulaTex: '$$\\min_\\theta\\ \\mathbb E\\Big[\\max_{\\Vert\\delta\\Vert_\\infty \\le \\varepsilon} L\\big(f_\\theta(x + \\delta),\\ y\\big)\\Big]$$',
    mathCode: {
      rows: [
        ['inner max', 'pgd(net, X, y, adv_eps, steps=5)', 'Attack the current weights.'],
        ['outer min', 'net.step(net.grads(X_adv, y)[0])', 'An ordinary step on the attacked batch.'],
        ['$\\Vert\\nabla_x L\\Vert_1$', 'np.abs(grad_x).sum()', 'What an ε-step multiplies, to first order.'],
      ],
    },
    notebook: {
      title: 'Lab 61.2 · Adversarial training',
      intro: 'Standard, FGSM-trained and PGD-trained networks under PGD at three budgets, with their input-gradient sizes.',
      cells: [
        {
          title: 'Training on worst cases',
          prose: '**Predict** the PGD-trained model’s accuracy at ε = 0.3, twice its training budget.',
          code: `import numpy as np
FONT = ['01110100011001110101110011000101110', '00100011000010000100001000010001110', '01110100010000100010001000100011111', '11111000100010000010000011000101110', '00010001100101010010111110001000010', '11111100001111000001000011000101110', '00110010001000011110100011000101110', '11111000010001000100010000100001000', '01110100011000101110100011000101110', '01110100011000101111000010001001100']
TEMPL = np.array([[int(c) for c in f] for f in FONT], float)
def digits(n, seed):
    """The playground's 7 x 5 digits: ink jitter, flipped pixels, a one-pixel shift and noise."""
    rng = np.random.default_rng(seed); d = np.arange(n) % 10; X = TEMPL[d].copy()
    X[X == 1] = 0.75 + 0.25 * rng.random((X == 1).sum()); flip = rng.random(X.shape) < 0.06; X[flip] = np.where(X[flip] > 0, 0, 0.6 * rng.random(flip.sum()))
    X = np.clip(X + 0.08 * rng.normal(size=X.shape), 0, 1).reshape(n, 7, 5); out = np.zeros_like(X)
    for i in range(n):
        dy, dx = rng.integers(-1, 2, 2); img = np.roll(np.roll(X[i], dy, 0), dx, 1)
        if dy == 1: img[0] = 0
        if dy == -1: img[-1] = 0
        if dx == 1: img[:, 0] = 0
        if dx == -1: img[:, -1] = 0
        out[i] = img
    return np.clip(out.reshape(n, 35) + 0.15 * rng.normal(size=(n, 35)), 0, 1), d
Xtr, ytr = digits(1000, 611); Xte, yte = digits(400, 612)

class Net:
    """35 -> 48 ReLU -> 10, softmax cross-entropy, Adam; exposes the gradient of the loss with respect to the input."""
    def __init__(self, seed):
        rng = np.random.default_rng(seed); self.P = [rng.normal(0, np.sqrt(2 / 35), (35, 48)), np.zeros(48), rng.normal(0, np.sqrt(1 / 48), (48, 10)), np.zeros(10)]
        self.M = [0 * p for p in self.P]; self.S = [0 * p for p in self.P]; self.t = 0
    def logits(self, X):
        self.X = X; self.h = np.maximum(0, X @ self.P[0] + self.P[1]); return self.h @ self.P[2] + self.P[3]
    def grads(self, X, y):
        z = self.logits(X); q = np.exp(z - z.max(1, keepdims=True)); q /= q.sum(1, keepdims=True); q[np.arange(len(y)), y] -= 1; g = q / len(y)
        gh = (g @ self.P[2].T) * (self.h > 0)
        return [X.T @ gh, gh.sum(0), self.h.T @ g, g.sum(0)], gh @ self.P[0].T            # weight gradients, input gradient
    def step(self, G, lr=0.005):
        self.t += 1
        for k in range(4):
            self.M[k] = 0.9 * self.M[k] + 0.1 * G[k]; self.S[k] = 0.999 * self.S[k] + 0.001 * G[k] ** 2
            self.P[k] -= lr * (self.M[k] / (1 - 0.9 ** self.t)) / (np.sqrt(self.S[k] / (1 - 0.999 ** self.t)) + 1e-8)
    acc = lambda self, X, y: float(np.mean(self.logits(X).argmax(1) == y))

def fgsm(net, X, y, eps):
    return np.clip(X + eps * np.sign(net.grads(X, y)[1]), 0, 1)
def pgd(net, X, y, eps, steps=10, seed=1):
    rng = np.random.default_rng(seed); A = np.clip(X + eps * rng.uniform(-1, 1, X.shape), 0, 1)
    for _ in range(steps):
        A = np.clip(np.clip(A + eps / 4 * np.sign(net.grads(A, y)[1]), X - eps, X + eps), 0, 1)   # step, then project
    return A
def train(adv_eps=0.0, attack='fgsm', epochs=25, seed=1):
    net = Net(seed); rng = np.random.default_rng(seed)
    for e in range(epochs):
        for b in np.array_split(rng.permutation(1000), 20):
            X, y = Xtr[b], ytr[b]
            if adv_eps: X = pgd(net, X, y, adv_eps, steps=5, seed=e * 1000 + int(b[0])) if attack == 'pgd' else fgsm(net, X, y, adv_eps)
            net.step(net.grads(X, y)[0])
    return net

nets = {'standard': train(), 'FGSM-trained (eps 0.15)': train(0.15), 'PGD-trained (eps 0.15)': train(0.15, 'pgd')}
for name, net in nets.items():
    g1 = np.abs(net.grads(Xte[:50], yte[:50])[1] * 50).sum()                 # sum over 50 images of ||grad_x loss||_1
    print(f"{name:24s}: clean {net.acc(Xte, yte):.3f}; PGD at eps 0.1 {net.acc(pgd(net, Xte, yte, 0.1), yte):.3f}, "
          f"0.15 {net.acc(pgd(net, Xte, yte, 0.15), yte):.3f}, 0.3 {net.acc(pgd(net, Xte, yte, 0.3), yte):.3f}; input-gradient L1 {g1:.0f}")
# A linear classifier with margin 1.5 and ||w||_1 = 20 keeps its prediction for every eps below 1.5 / 20.
print(f"largest safe L-infinity budget for margin 1.5 and ||w||_1 = 20: {1.5 / 20:.3f}")`,
        },
      ],
    },
  },
  'l61-covariate': {
    formulaTex: '$$\\begin{aligned} w(x) &= \\frac{p_{\\text{test}}(x)}{p_{\\text{train}}(x)} = \\frac{c(x)}{1 - c(x)} \\cdot \\frac{n_{\\text{train}}}{n_{\\text{test}}} \\\\ \\mathbb E_{\\text{train}}\\big[w(x)\\,\\ell\\big] &= \\mathbb E_{\\text{test}}[\\ell] \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$w(x)$', 'pdf(x, 1.5, 0.5) / pdf(x, 0, 1)', 'True density ratio.'],
        ['$c(x)$', 'LogisticRegression on (x, x²)', 'Domain classifier: P(test | x).'],
        ['ESS', 'w.sum() ** 2 / (w ** 2).sum()', 'How many points the weighted fit rests on.'],
      ],
    },
    notebook: {
      title: 'Lab 61.3 · Covariate shift',
      intro: 'A misspecified line under shifted test inputs, with true, estimated and flattened importance weights.',
      cells: [
        {
          title: 'Importance weighting',
          prose: '**Predict** the effective sample size left after weighting.',
          code: `import numpy as np
from sklearn.linear_model import LogisticRegression

f = lambda x: np.sin(1.5 * x) + 0.5 * x
rng = np.random.default_rng(61)
xtr = rng.normal(0, 1, 200); ytr = f(xtr) + 0.2 * rng.normal(size=200)              # training inputs ~ N(0, 1)
xte = rng.normal(1.5, 0.5, 1000); yte = f(xte) + 0.2 * rng.normal(size=1000)        # test inputs ~ N(1.5, 0.5^2)
pdf = lambda x, m, s: np.exp(-0.5 * ((x - m) / s) ** 2) / (s * np.sqrt(2 * np.pi))

def wls(w):
    """Weighted least squares for a straight line y = a + b x (deliberately misspecified)."""
    A = np.column_stack([np.ones_like(xtr), xtr]); return np.linalg.solve(A.T @ (A * w[:, None]), A.T @ (w * ytr))
test_mse = lambda ab: float(np.mean((ab[0] + ab[1] * xte - yte) ** 2))
ess = lambda w: w.sum() ** 2 / (w ** 2).sum()

w_true = pdf(xtr, 1.5, 0.5) / pdf(xtr, 0, 1)
# Estimated weights from a domain classifier on (x, x^2): 200 unlabeled test inputs against the 200 training inputs.
Z = np.r_[xtr, xte[:200]]; t = np.r_[np.zeros(200), np.ones(200)]
dom = LogisticRegression(C=100, max_iter=5000).fit(np.column_stack([Z, Z ** 2]), t)
c = dom.predict_proba(np.column_stack([xtr, xtr ** 2]))[:, 1]; w_est = c / (1 - c)
from sklearn.metrics import roc_auc_score
print(f"domain classifier AUC {roc_auc_score(t, dom.predict_proba(np.column_stack([Z, Z ** 2]))[:, 1]):.3f} (0.5 = no shift)")
for name, w in (('unweighted', np.ones(200)), ('true weights', w_true), ('estimated weights', w_est), ('estimated, flattened (lambda 0.5)', w_est ** 0.5)):
    print(f"{name:34s}: test MSE {test_mse(wls(w)):.3f}, effective sample size {ess(w):6.1f} of 200")
w4 = np.array([2, 2, 0.5, 0.5]); print(f"effective sample size of weights {w4}: {ess(w4):.2f}")`,
        },
      ],
    },
  },
  'l61-label': {
    formulaTex: '$$\\begin{aligned} p\'(y \\mid x) &\\propto p(y \\mid x)\\,\\frac{\\pi\'(y)}{\\pi(y)} \\\\ \\mu &= C\\,\\pi\' \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$C$', 'P(pred = i | y = j) on validation', 'Confusion matrix of the frozen classifier.'],
        ['$\\mu$', 'np.mean(model.predict(Xdep))', 'Predicted-label rate at deployment.'],
        ['$\\pi\'$', '(mu1 - C10) / (C11 - C10)', 'The solved deployment share of class 1.'],
      ],
    },
    notebook: {
      title: 'Lab 61.4 · Label shift',
      intro: 'BBSE and EM estimates of a new class balance, and the corrected probabilities’ accuracy and log loss.',
      cells: [
        {
          title: 'Correcting for a new class balance',
          prose: '**Predict** how close BBSE gets to the true 10% share.',
          code: `import numpy as np
from sklearn.linear_model import LogisticRegression

def data(n, prior1, seed):
    rng = np.random.default_rng(seed); y = (rng.random(n) < prior1).astype(int)
    return np.column_stack([np.where(y, 1, -1) + rng.normal(size=n), np.where(y, 0.6, -0.6) + rng.normal(size=n)]), y
Xtr, ytr = data(600, 0.5, 1); Xval, yval = data(600, 0.5, 2); Xdep, ydep = data(3000, 0.1, 3)     # deployment: 10% class 1
model = LogisticRegression().fit(Xtr, ytr); p = model.predict_proba(Xdep)[:, 1]

# BBSE: confusion matrix on validation, predicted-label rate on deployment, solve mu = C pi.
pred_val = model.predict(Xval); C10, C11 = np.mean(pred_val[yval == 0] == 1), np.mean(pred_val[yval == 1] == 1)
mu1 = np.mean(model.predict(Xdep)); pi1 = float(np.clip((mu1 - C10) / (C11 - C10), 0, 1))
print(f"P(pred 1 | y = 0) = {C10:.3f}, P(pred 1 | y = 1) = {C11:.3f}; predicted as class 1 at deployment {mu1:.3f} -> estimated share {pi1:.3f} (true 0.1)")

# EM alternative (Saerens et al. 2002): alternate re-weighting and re-estimating the prior.
pi_em = 0.5
for _ in range(100):
    a = p * pi_em / 0.5; b = (1 - p) * (1 - pi_em) / 0.5; pi_em = float(np.mean(a / (a + b)))
print(f"EM estimate of the share: {pi_em:.3f}")

adjust = lambda p, new: (p * new / 0.5) / (p * new / 0.5 + (1 - p) * (1 - new) / 0.5)
for name, q in (('no correction', p), ('BBSE prior', adjust(p, pi1)), ('true prior', adjust(p, 0.1))):
    acc = np.mean((q >= 0.5) == ydep); ll = -np.mean(np.log(np.where(ydep == 1, q, 1 - q)))
    print(f"{name:14s}: accuracy {acc:.3f}, log loss {ll:.3f}")
print(f"BBSE by hand, C[1][0] = 0.1, C[1][1] = 0.9, mu = 0.26: {(0.26 - 0.1) / (0.9 - 0.1):.2f}")`,
        },
      ],
    },
  },
  'l61-adapt': {
    formulaTex: '$$\\tilde x = C_T^{1/2}\\, C_S^{-1/2}\\,(x - m_S) + m_T$$',
    mathCode: {
      rows: [
        ['$C_S^{-1/2}$', 'mat_pow(np.cov(Xs.T), -0.5)', 'Whiten the source.'],
        ['$C_T^{1/2}$', 'mat_pow(np.cov(Xt.T), 0.5)', 'Re-colour with the target covariance.'],
      ],
    },
    notebook: {
      title: 'Lab 61.5 · Domain adaptation',
      intro: 'CORAL against a source-only model and a target-trained one, for four rotations of the target domain.',
      cells: [
        {
          title: 'Aligning statistics',
          prose: '**Predict** at which rotation CORAL stops helping.',
          code: `import numpy as np
from sklearn.linear_model import LogisticRegression

def domain(n, seed, angle=None):
    rng = np.random.default_rng(seed); y = (rng.random(n) < 0.5).astype(int)
    P = np.column_stack([np.where(y, 1.2, -1.2) + 0.7 * rng.normal(size=n), 0.9 * rng.normal(size=n)])
    if angle is None: return P, y
    c, s = np.cos(angle), np.sin(angle); R = P @ np.array([[c, s], [-s, c]])        # rotate, then stretch and offset
    return np.column_stack([1.6 * R[:, 0] + 1.5, 0.7 * R[:, 1] - 1]), y

def mat_pow(C, p):
    vals, vecs = np.linalg.eigh(C); return vecs @ np.diag(vals ** p) @ vecs.T
def coral(Xs, Xt):
    """Whiten the source with its covariance, re-colour with the target's, move to the target's mean."""
    return (Xs - Xs.mean(0)) @ mat_pow(np.cov(Xs.T), -0.5) @ mat_pow(np.cov(Xt.T), 0.5) + Xt.mean(0)

Xs, ys = domain(400, 1)
print(f"source model on source data: {LogisticRegression().fit(Xs, ys).score(*domain(1000, 4)):.3f}")
for angle in (0.0, 0.5, 0.9, 1.4):
    Xt, yt = domain(400, 2, angle); Xtest, ytest = domain(1000, 3, angle)          # yt is never used for CORAL
    src = LogisticRegression().fit(Xs, ys).score(Xtest, ytest)
    cor = LogisticRegression().fit(coral(Xs, Xt), ys).score(Xtest, ytest)
    ora = LogisticRegression().fit(Xt, yt).score(Xtest, ytest)
    print(f"rotation {angle}: source-only {src:.3f}, CORAL {cor:.3f}, trained on labelled target {ora:.3f}")
print(f"1-D CORAL of x = 3 from (mean 2, sd 1) to (mean 0, sd 0.5): {(3 - 2) / 1 * 0.5 + 0:.1f}")`,
        },
      ],
    },
  },
}
