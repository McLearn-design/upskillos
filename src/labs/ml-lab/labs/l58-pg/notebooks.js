// Lab 58 runnable cells, typeset formulas and math ↔ code tables, keyed by lesson id.
// Cart-pole, the logistic policy, the learning rates and the critic features follow the playground exactly; the random
// draws are NumPy's, so individual seeds differ from the playground's while the patterns match.

export const extras = {
  'l58-policy': {
    formulaTex: '$$\\begin{aligned} \\pi_\\theta(\\text{right} \\mid s) &= \\sigma\\big(\\theta^\\top \\phi(s)\\big) \\\\ J(\\theta) &= \\mathbb E_{\\tau \\sim \\pi_\\theta}\\big[R(\\tau)\\big] \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\phi(s)$', 'phi(s)', 'Scaled cart position, velocity, pole angle, angular velocity, and a bias.'],
        ['$\\pi_\\theta$', 'p_right(theta, s)', 'Logistic policy: a probability, not a choice.'],
        ['$R(\\tau)$', 'len(episode(theta, rng))', 'Reward +1 per step survived.'],
      ],
    },
    notebook: {
      title: 'Lab 58.1 · Policies instead of values',
      intro: 'Random pushing against a hand-made policy on the playground’s cart-pole.',
      cells: [
        {
          title: 'A policy and its return',
          prose: '**Predict** how long random pushing keeps the pole up.',
          code: `import numpy as np, math
MAX_STEPS = 200
def step(s, a):
    """Classic cart-pole (Barto, Sutton & Anderson 1983): Euler steps of 0.02 s; force +10 (a = 1) or -10."""
    x, xd, th, thd = s; force = 10.0 if a else -10.0; mp, l, total = 0.1, 0.5, 1.1
    c, sn = math.cos(th), math.sin(th); temp = (force + mp * l * thd * thd * sn) / total
    thacc = (9.8 * sn - c * temp) / (l * (4 / 3 - mp * c * c / total)); xacc = temp - mp * l * thacc * c / total
    n = (x + 0.02 * xd, xd + 0.02 * xacc, th + 0.02 * thd, thd + 0.02 * thacc)
    return n, abs(n[0]) > 2.4 or abs(n[2]) > 12 * math.pi / 180
phi = lambda s: np.array([s[0] / 2.4, s[1] / 2, s[2] / 0.21, s[3] / 2, 1.0])     # policy features (scaled state, bias)
p_right = lambda theta, s: 1 / (1 + math.exp(-float(phi(s) @ theta)))           # pi(push right | s) = sigmoid(theta . phi)

def episode(theta, rng):
    """One episode; returns the list of (features, action, p) and its length."""
    s = tuple(0.05 * (2 * rng.random(4) - 1)); traj = []
    for _ in range(MAX_STEPS):
        p = p_right(theta, s); a = int(rng.random() < p); traj.append((phi(s), a, p)); s, done = step(s, a)
        if done: break
    return traj

def returns_to_go(T, gamma=0.99):
    G = np.zeros(T); run = 0.0
    for t in range(T - 1, -1, -1): run = 1 + gamma * run; G[t] = run
    return G

def reinforce(seed, baseline=False, episodes=400, lr=0.05, gamma=0.99):
    """REINFORCE with return-to-go; optionally minus a learned linear baseline w . phi(s)."""
    rng = np.random.default_rng(seed); theta, w = np.zeros(5), np.zeros(5); lengths = []
    for _ in range(episodes):
        traj = episode(theta, rng); T = len(traj); G = returns_to_go(T, gamma); grad = np.zeros(5)
        for t, (f, a, p) in enumerate(traj):
            adv = G[t]
            if baseline: v = f @ w; adv = G[t] - v; w += 0.01 * (G[t] - v) * f
            grad += adv * (a - p) * f                                    # grad log pi(a | s) = (a - p) phi(s)
        theta += lr * grad / T; lengths.append(T)
    return theta, np.array(lengths)
avg20 = lambda xs: np.array([xs[max(0, i - 19):i + 1].mean() for i in range(len(xs))])

rng = np.random.default_rng(58)
L0 = np.array([len(episode(np.zeros(5), rng)) for _ in range(1000)])
print(f"random pushing (theta = 0, p = 0.5 everywhere): mean {L0.mean():.1f} steps, 90% of episodes end by step {np.percentile(L0, 90):.0f}")
lean = np.array([0, 0, 10.0, 10.0, 0])                                   # push toward the side the pole leans and moves
L1 = np.array([len(episode(lean, rng)) for _ in range(200)])
print(f"a hand-made policy (push where the pole leans): mean {L1.mean():.1f} steps; {np.mean(L1 == MAX_STEPS):.0%} reach the {MAX_STEPS}-step limit")
s = (0.0, 0.0, 0.05, 0.0)                                                 # pole leaning 0.05 rad to the right
print(f"that policy's probability of pushing right with the pole leaning right: {p_right(lean, s):.3f} -- stochastic, not certain")
print(f"return of an episode that lasts 34 steps, reward +1 per step, no discount: {returns_to_go(34, gamma=1.0)[0]:.0f}")`,
        },
      ],
    },
  },
  'l58-reinforce': {
    formulaTex: '$$\\begin{aligned} \\nabla J &= \\mathbb E\\Big[\\textstyle\\sum_t \\nabla \\log \\pi_\\theta(a_t \\mid s_t)\\, G_t\\Big] \\\\ \\nabla \\log \\pi &= (a - p)\\,\\phi(s) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\nabla \\log P$', 'x / p - (1 - x) / (1 - p)', 'The score of a coin flip, for the log-derivative check.'],
        ['$G_t$', 'returns_to_go(T, gamma)', 'Discounted reward from step t on.'],
        ['update', 'theta += lr * grad / T', 'One REINFORCE step per episode.'],
      ],
    },
    notebook: {
      title: 'Lab 58.2 · REINFORCE',
      intro: 'The log-derivative trick checked on a coin, then REINFORCE on cart-pole with three seeds.',
      cells: [
        {
          title: 'The policy gradient',
          prose: '**Predict** whether all three seeds learn at the same learning rate.',
          code: `import numpy as np, math
MAX_STEPS = 200
def step(s, a):
    """Classic cart-pole (Barto, Sutton & Anderson 1983): Euler steps of 0.02 s; force +10 (a = 1) or -10."""
    x, xd, th, thd = s; force = 10.0 if a else -10.0; mp, l, total = 0.1, 0.5, 1.1
    c, sn = math.cos(th), math.sin(th); temp = (force + mp * l * thd * thd * sn) / total
    thacc = (9.8 * sn - c * temp) / (l * (4 / 3 - mp * c * c / total)); xacc = temp - mp * l * thacc * c / total
    n = (x + 0.02 * xd, xd + 0.02 * xacc, th + 0.02 * thd, thd + 0.02 * thacc)
    return n, abs(n[0]) > 2.4 or abs(n[2]) > 12 * math.pi / 180
phi = lambda s: np.array([s[0] / 2.4, s[1] / 2, s[2] / 0.21, s[3] / 2, 1.0])     # policy features (scaled state, bias)
p_right = lambda theta, s: 1 / (1 + math.exp(-float(phi(s) @ theta)))           # pi(push right | s) = sigmoid(theta . phi)

def episode(theta, rng):
    """One episode; returns the list of (features, action, p) and its length."""
    s = tuple(0.05 * (2 * rng.random(4) - 1)); traj = []
    for _ in range(MAX_STEPS):
        p = p_right(theta, s); a = int(rng.random() < p); traj.append((phi(s), a, p)); s, done = step(s, a)
        if done: break
    return traj

def returns_to_go(T, gamma=0.99):
    G = np.zeros(T); run = 0.0
    for t in range(T - 1, -1, -1): run = 1 + gamma * run; G[t] = run
    return G

def reinforce(seed, baseline=False, episodes=400, lr=0.05, gamma=0.99):
    """REINFORCE with return-to-go; optionally minus a learned linear baseline w . phi(s)."""
    rng = np.random.default_rng(seed); theta, w = np.zeros(5), np.zeros(5); lengths = []
    for _ in range(episodes):
        traj = episode(theta, rng); T = len(traj); G = returns_to_go(T, gamma); grad = np.zeros(5)
        for t, (f, a, p) in enumerate(traj):
            adv = G[t]
            if baseline: v = f @ w; adv = G[t] - v; w += 0.01 * (G[t] - v) * f
            grad += adv * (a - p) * f                                    # grad log pi(a | s) = (a - p) phi(s)
        theta += lr * grad / T; lengths.append(T)
    return theta, np.array(lengths)
avg20 = lambda xs: np.array([xs[max(0, i - 19):i + 1].mean() for i in range(len(xs))])

# The log-derivative trick on a coin: x ~ Bernoulli(p), f(x) = 3x + 1, so E[f] = 3p + 1 and dE/dp = 3.
rng = np.random.default_rng(0); p = 0.3; x = (rng.random(200000) < p).astype(float)
score = x / p - (1 - x) / (1 - p)                                         # d/dp log P(x)
print(f"sampled E[f(x) * d log P(x)/dp] = {np.mean((3 * x + 1) * score):.3f}   exact dE[f]/dp = 3")

# REINFORCE on cart-pole, three seeds, learning rate 0.05 (the playground's setting).
for seed in (1, 2, 3):
    theta, L = reinforce(seed)
    a = avg20(L)
    print(f"seed {seed}: 20-episode average after 100 / 200 / 400 episodes: {a[99]:5.1f} / {a[199]:5.1f} / {a[-1]:5.1f} steps")`,
        },
      ],
    },
  },
  'l58-baseline': {
    formulaTex: '$$\\begin{aligned} &\\mathbb E\\big[\\nabla\\log\\pi(a \\mid s)\\,(G_t - b(s_t))\\big] = \\nabla J \\\\ &\\text{since } \\mathbb E_a\\big[\\nabla \\log \\pi(a \\mid s)\\big] = 0 \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$b(t)$', 'mean return-to-go at step t (separate episodes)', 'Does not depend on the action taken.'],
        ['$w^\\top\\phi(s)$', 'w += 0.01 * (G[t] - v) * f', 'The learned linear baseline used in training.'],
      ],
    },
    notebook: {
      title: 'Lab 58.3 · Baselines and variance',
      intro: 'Gradient estimates with and without a baseline, and REINFORCE with a learned baseline.',
      cells: [
        {
          title: 'Less noise, same direction',
          prose: '**Predict** whether the baseline changes the mean of the estimates, their spread, or both.',
          code: `import numpy as np, math
MAX_STEPS = 200
def step(s, a):
    """Classic cart-pole (Barto, Sutton & Anderson 1983): Euler steps of 0.02 s; force +10 (a = 1) or -10."""
    x, xd, th, thd = s; force = 10.0 if a else -10.0; mp, l, total = 0.1, 0.5, 1.1
    c, sn = math.cos(th), math.sin(th); temp = (force + mp * l * thd * thd * sn) / total
    thacc = (9.8 * sn - c * temp) / (l * (4 / 3 - mp * c * c / total)); xacc = temp - mp * l * thacc * c / total
    n = (x + 0.02 * xd, xd + 0.02 * xacc, th + 0.02 * thd, thd + 0.02 * thacc)
    return n, abs(n[0]) > 2.4 or abs(n[2]) > 12 * math.pi / 180
phi = lambda s: np.array([s[0] / 2.4, s[1] / 2, s[2] / 0.21, s[3] / 2, 1.0])     # policy features (scaled state, bias)
p_right = lambda theta, s: 1 / (1 + math.exp(-float(phi(s) @ theta)))           # pi(push right | s) = sigmoid(theta . phi)

def episode(theta, rng):
    """One episode; returns the list of (features, action, p) and its length."""
    s = tuple(0.05 * (2 * rng.random(4) - 1)); traj = []
    for _ in range(MAX_STEPS):
        p = p_right(theta, s); a = int(rng.random() < p); traj.append((phi(s), a, p)); s, done = step(s, a)
        if done: break
    return traj

def returns_to_go(T, gamma=0.99):
    G = np.zeros(T); run = 0.0
    for t in range(T - 1, -1, -1): run = 1 + gamma * run; G[t] = run
    return G

def reinforce(seed, baseline=False, episodes=400, lr=0.05, gamma=0.99):
    """REINFORCE with return-to-go; optionally minus a learned linear baseline w . phi(s)."""
    rng = np.random.default_rng(seed); theta, w = np.zeros(5), np.zeros(5); lengths = []
    for _ in range(episodes):
        traj = episode(theta, rng); T = len(traj); G = returns_to_go(T, gamma); grad = np.zeros(5)
        for t, (f, a, p) in enumerate(traj):
            adv = G[t]
            if baseline: v = f @ w; adv = G[t] - v; w += 0.01 * (G[t] - v) * f
            grad += adv * (a - p) * f                                    # grad log pi(a | s) = (a - p) phi(s)
        theta += lr * grad / T; lengths.append(T)
    return theta, np.array(lengths)
avg20 = lambda xs: np.array([xs[max(0, i - 19):i + 1].mean() for i in range(len(xs))])

# E_a[grad log pi(a | s)] = 0: with p = 0.7 and phi = 1, (1 - p) * p + (0 - p) * (1 - p) = 0.
p = 0.7; print(f"E[a - p] under a ~ Bernoulli({p}): {p * (1 - p) + (1 - p) * (0 - p):.2e}  -> a baseline adds zero in expectation")

# Spread of single-episode gradient estimates at theta = 0, with and without b(t) = mean return-to-go at step t,
# the baseline estimated from a separate batch of episodes.
rng = np.random.default_rng(5); theta0 = np.zeros(5)
eps = [episode(theta0, rng) for _ in range(200)]; ref = [returns_to_go(len(episode(theta0, rng))) for _ in range(200)]
b = np.array([np.mean([G[t] for G in ref if len(G) > t] or [0]) for t in range(max(len(e) for e in eps))])
def estimate(e, use_b):
    G = returns_to_go(len(e)); return sum((G[t] - (b[t] if use_b else 0)) * (a - p) * f for t, (f, a, p) in enumerate(e))
for use_b in (False, True):
    E = np.array([estimate(e, use_b) for e in eps])
    print(f"{'with' if use_b else 'without'} baseline: mean of the pole-angle component {E[:, 2].mean():6.2f} "
          f"(standard error {E[:, 2].std(ddof=1) / np.sqrt(200):.2f}), spread (sd) {E[:, 2].std(ddof=1):6.2f}")

for seed in (1, 2, 3):
    _, L = reinforce(seed, baseline=True); a = avg20(L)
    print(f"REINFORCE with a learned baseline, seed {seed}: after 100 / 200 / 400 episodes {a[99]:5.1f} / {a[199]:5.1f} / {a[-1]:5.1f}")`,
        },
      ],
    },
  },
  'l58-ac': {
    formulaTex: '$$\\begin{aligned} \\delta &= r + \\gamma V_w(s\') - V_w(s) \\\\ w &\\leftarrow w + \\alpha_w\\,\\delta\\,\\psi(s) \\\\ \\theta &\\leftarrow \\theta + \\alpha_\\theta\\,\\delta\\,\\nabla\\log\\pi(a \\mid s) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\delta$', '1 + gamma * critic(s2) @ w - psi @ w', 'TD error: the advantage estimate.'],
        ['$\\psi(s)$', 'quad(s) or phi(s)', 'Quadratic or linear critic features.'],
      ],
    },
    notebook: {
      title: 'Lab 58.4 · Actor–critic',
      intro: 'One-step actor–critic with a quadratic critic and with a linear one, three seeds each.',
      cells: [
        {
          title: 'Actor and critic',
          prose: '**Predict** which critic lets the actor balance the pole.',
          code: `import numpy as np, math
MAX_STEPS = 200
def step(s, a):
    """Classic cart-pole (Barto, Sutton & Anderson 1983): Euler steps of 0.02 s; force +10 (a = 1) or -10."""
    x, xd, th, thd = s; force = 10.0 if a else -10.0; mp, l, total = 0.1, 0.5, 1.1
    c, sn = math.cos(th), math.sin(th); temp = (force + mp * l * thd * thd * sn) / total
    thacc = (9.8 * sn - c * temp) / (l * (4 / 3 - mp * c * c / total)); xacc = temp - mp * l * thacc * c / total
    n = (x + 0.02 * xd, xd + 0.02 * xacc, th + 0.02 * thd, thd + 0.02 * thacc)
    return n, abs(n[0]) > 2.4 or abs(n[2]) > 12 * math.pi / 180
phi = lambda s: np.array([s[0] / 2.4, s[1] / 2, s[2] / 0.21, s[3] / 2, 1.0])     # policy features (scaled state, bias)
p_right = lambda theta, s: 1 / (1 + math.exp(-float(phi(s) @ theta)))           # pi(push right | s) = sigmoid(theta . phi)

def episode(theta, rng):
    """One episode; returns the list of (features, action, p) and its length."""
    s = tuple(0.05 * (2 * rng.random(4) - 1)); traj = []
    for _ in range(MAX_STEPS):
        p = p_right(theta, s); a = int(rng.random() < p); traj.append((phi(s), a, p)); s, done = step(s, a)
        if done: break
    return traj

def returns_to_go(T, gamma=0.99):
    G = np.zeros(T); run = 0.0
    for t in range(T - 1, -1, -1): run = 1 + gamma * run; G[t] = run
    return G

def reinforce(seed, baseline=False, episodes=400, lr=0.05, gamma=0.99):
    """REINFORCE with return-to-go; optionally minus a learned linear baseline w . phi(s)."""
    rng = np.random.default_rng(seed); theta, w = np.zeros(5), np.zeros(5); lengths = []
    for _ in range(episodes):
        traj = episode(theta, rng); T = len(traj); G = returns_to_go(T, gamma); grad = np.zeros(5)
        for t, (f, a, p) in enumerate(traj):
            adv = G[t]
            if baseline: v = f @ w; adv = G[t] - v; w += 0.01 * (G[t] - v) * f
            grad += adv * (a - p) * f                                    # grad log pi(a | s) = (a - p) phi(s)
        theta += lr * grad / T; lengths.append(T)
    return theta, np.array(lengths)
avg20 = lambda xs: np.array([xs[max(0, i - 19):i + 1].mean() for i in range(len(xs))])

def quad(s):
    """Critic features with squares and products: how far from failing, in either direction."""
    f = phi(s); return np.array([1, f[0] ** 2, f[1] ** 2, f[2] ** 2, f[3] ** 2, f[2] * f[3], f[0] * f[1], f[0] * f[2]])

def actor_critic(critic, seed, episodes=200, lr=0.1, critic_lr=0.05, gamma=0.95):
    rng = np.random.default_rng(seed); theta = np.zeros(5); w = np.zeros(len(critic((0, 0, 0, 0)))); lengths = []
    for _ in range(episodes):
        s = tuple(0.05 * (2 * rng.random(4) - 1)); T = 0
        for _ in range(MAX_STEPS):
            f, psi, p = phi(s), critic(s), p_right(theta, s); a = int(rng.random() < p); s2, done = step(s, a)
            delta = 1 + (0 if done else gamma * critic(s2) @ w) - psi @ w     # TD error
            w += critic_lr * delta * psi; theta += lr * 0.5 * delta * (a - p) * f
            s = s2; T += 1
            if done: break
        lengths.append(T)
    return np.array(lengths)

print(f"TD error with V(s) = 5, V(s') = 5, r = 1, gamma = 0.8: {1 + 0.8 * 5 - 5:.1f}")
for name, critic in (('quadratic critic', quad), ('linear critic', phi)):
    for seed in (1, 2, 3):
        a = avg20(actor_critic(critic, seed))
        first = int(np.argmax(a >= 195)) + 1 if (a >= 195).any() else None
        print(f"{name}, seed {seed}: 20-episode average after 50 / 100 / 200 episodes {a[49]:5.1f} / {a[99]:5.1f} / {a[-1]:5.1f}"
              + (f"; first reaches 195 at episode {first}" if first else ''))`,
        },
      ],
    },
  },
  'l58-practice': {
    formulaTex: '$$\\begin{aligned} &J(\\theta) + \\beta\\,\\mathbb E\\big[H(\\pi(\\cdot \\mid s))\\big] \\\\ &H(p) = -p\\log p - (1 - p)\\log(1 - p) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['seeds', 'for seed in range(1, 9)', 'Report the spread over runs, not one lucky seed.'],
        ['interval', 'np.percentile(boot, [2.5, 97.5])', 'Bootstrap interval of the mean over seeds.'],
        ['$H$', '-(p * np.log(p) + (1 - p) * np.log(1 - p))', 'Policy entropy, the bonus that keeps exploring.'],
      ],
    },
    notebook: {
      title: 'Lab 58.5 · Policy gradients in practice',
      intro: 'Eight seeds of each REINFORCE variant with bootstrap intervals and sample counts, and the entropy of a push probability.',
      cells: [
        {
          title: 'Seeds, samples and entropy',
          prose: '**Predict** the spread of plain REINFORCE’s final score over eight seeds.',
          code: `import numpy as np, math
MAX_STEPS = 200
def step(s, a):
    """Classic cart-pole (Barto, Sutton & Anderson 1983): Euler steps of 0.02 s; force +10 (a = 1) or -10."""
    x, xd, th, thd = s; force = 10.0 if a else -10.0; mp, l, total = 0.1, 0.5, 1.1
    c, sn = math.cos(th), math.sin(th); temp = (force + mp * l * thd * thd * sn) / total
    thacc = (9.8 * sn - c * temp) / (l * (4 / 3 - mp * c * c / total)); xacc = temp - mp * l * thacc * c / total
    n = (x + 0.02 * xd, xd + 0.02 * xacc, th + 0.02 * thd, thd + 0.02 * thacc)
    return n, abs(n[0]) > 2.4 or abs(n[2]) > 12 * math.pi / 180
phi = lambda s: np.array([s[0] / 2.4, s[1] / 2, s[2] / 0.21, s[3] / 2, 1.0])     # policy features (scaled state, bias)
p_right = lambda theta, s: 1 / (1 + math.exp(-float(phi(s) @ theta)))           # pi(push right | s) = sigmoid(theta . phi)

def episode(theta, rng):
    """One episode; returns the list of (features, action, p) and its length."""
    s = tuple(0.05 * (2 * rng.random(4) - 1)); traj = []
    for _ in range(MAX_STEPS):
        p = p_right(theta, s); a = int(rng.random() < p); traj.append((phi(s), a, p)); s, done = step(s, a)
        if done: break
    return traj

def returns_to_go(T, gamma=0.99):
    G = np.zeros(T); run = 0.0
    for t in range(T - 1, -1, -1): run = 1 + gamma * run; G[t] = run
    return G

def reinforce(seed, baseline=False, episodes=400, lr=0.05, gamma=0.99):
    """REINFORCE with return-to-go; optionally minus a learned linear baseline w . phi(s)."""
    rng = np.random.default_rng(seed); theta, w = np.zeros(5), np.zeros(5); lengths = []
    for _ in range(episodes):
        traj = episode(theta, rng); T = len(traj); G = returns_to_go(T, gamma); grad = np.zeros(5)
        for t, (f, a, p) in enumerate(traj):
            adv = G[t]
            if baseline: v = f @ w; adv = G[t] - v; w += 0.01 * (G[t] - v) * f
            grad += adv * (a - p) * f                                    # grad log pi(a | s) = (a - p) phi(s)
        theta += lr * grad / T; lengths.append(T)
    return theta, np.array(lengths)
avg20 = lambda xs: np.array([xs[max(0, i - 19):i + 1].mean() for i in range(len(xs))])

# Report several seeds: plain REINFORCE and REINFORCE with a baseline, 8 seeds each, 400 episodes.
rng = np.random.default_rng(0)
for name, base in (('plain REINFORCE', False), ('with a baseline', True)):
    finals, steps = [], []
    for seed in range(1, 9):
        _, L = reinforce(seed, baseline=base); finals.append(L[-20:].mean()); steps.append(L.sum())
    finals = np.array(finals); boot = [rng.choice(finals, 8).mean() for _ in range(5000)]
    print(f"{name:16s}: last-20 average per seed {np.round(finals).astype(int)}; mean {finals.mean():.1f}, "
          f"95% bootstrap interval {np.percentile(boot, 2.5):.1f}-{np.percentile(boot, 97.5):.1f}; "
          f"{np.mean(steps):,.0f} environment steps per run")

# An entropy bonus keeps a policy from hardening too early: the entropy of the push-right probability.
H = lambda p: -(p * np.log(p) + (1 - p) * np.log(1 - p))
for p in (0.5, 0.9, 0.99):
    print(f"p = {p}: entropy {H(p):.3f} nats (maximum log 2 = {np.log(2):.3f})")`,
        },
      ],
    },
  },
}
