// Lab 50 runnable cells, typeset formulas and math ↔ code tables, keyed by lesson id.
// The stream, expert losses and arm sets follow the playground; runs are fewer than the playground's, so averages move more between runs.

export const extras = {
  'l50-regret': {
    formulaTex: '$$\\begin{aligned} \\mathrm{Regret}_T &= \\textstyle\\sum_t \\ell_t(a_t) - \\min_a \\sum_t \\ell_t(a) \\\\ \\text{good: } &\\mathrm{Regret}_T / T \\to 0 \\end{aligned}$$',
    mathCode: {
      rows: [
        ['learner', 'losses[np.arange(T), choice].sum()', 'The learner’s total loss.'],
        ['best fixed', 'losses.sum(axis=0).min()', 'The best single action in hindsight.'],
      ],
    },
    notebook: {
      title: 'Lab 50.1 · Learning one decision at a time',
      intro: 'Regret of a random learner and of explore-then-commit over 1,000 rounds.',
      cells: [
        {
          title: 'Regret',
          prose: '**Predict** the random learner’s regret per round.',
          code: `import numpy as np
rng = np.random.default_rng(50)
T = 1000
losses = (rng.random((T, 3)) < np.array([0.35, 0.27, 0.4])).astype(int)   # three actions with loss rates 35%, 27%, 40%
choice = rng.integers(0, 3, T)                                           # a learner that picks at random
learner = losses[np.arange(T), choice].sum(); best = losses.sum(axis=0).min()
print(f"random learner: loss {learner}, best fixed action {best}, regret {learner - best}, regret per round {(learner - best) / T:.3f}")
follow_best_after_100 = np.concatenate([choice[:100], np.full(T - 100, losses[:100].sum(0).argmin())])
learner2 = losses[np.arange(T), follow_best_after_100].sum()
print(f"explore 100 rounds, then commit to the best so far: regret {learner2 - best}, per round {(learner2 - best) / T:.3f}")
print(f"the lesson's example: 310 − 270 = {310 - 270}")`,
        },
      ],
    },
  },
  'l50-perceptron': {
    formulaTex: '$$\\text{on a mistake: } w \\leftarrow w + y\\,x, \\qquad M \\le (R/\\gamma)^2$$',
    mathCode: {
      rows: [
        ['mistake', 'y * (w @ x) <= 0', 'Update only when wrong.'],
        ['$R$, $\\gamma$', 'max ‖x‖, margin', 'Radius of the data and the separating margin.'],
      ],
    },
    notebook: {
      title: 'Lab 50.2 · The perceptron and its mistake bound',
      intro: 'Mistakes against the bound for three margins, over 20 orders of the same stream.',
      cells: [
        {
          title: 'Mistakes and the bound',
          prose: '**Predict** whether any order of the stream exceeds the bound.',
          code: `import numpy as np
def stream(n, margin, seed=50):
    rng = np.random.default_rng(seed); u = np.array([np.cos(0.6), np.sin(0.6)]); out = []
    while len(out) < n:
        x = 2 * rng.normal(size=2); s = x @ u
        if abs(s) >= margin: out.append((x, 1 if s > 0 else -1))
    return out
def perceptron(data):
    w = np.zeros(2); mistakes = 0
    for x, y in data:
        if y * (w @ x) <= 0:
            w += y * x; mistakes += 1                         # update only on a mistake
    return mistakes
for margin in [1.5, 0.3, 0.05]:
    data = stream(500, margin); R = max(np.linalg.norm(x) for x, _ in data)
    orders = [perceptron([data[i] for i in np.random.default_rng(k).permutation(500)]) for k in range(20)]
    print(f"margin {margin:4}: mistakes {perceptron(data)} (over 20 random orders: {min(orders)}-{max(orders)}); bound (R/gamma)^2 = {(R / margin) ** 2:.0f}")
print(f"R = 3, gamma = 0.25: bound {(3 / 0.25) ** 2:.0f}")`,
        },
      ],
    },
  },
  'l50-experts': {
    formulaTex: '$$\\begin{aligned} w_i &\\leftarrow w_i\\, e^{-\\eta \\ell_i} \\\\ \\mathrm{Regret} &\\le \\sqrt{T \\ln N / 2} \\ \\ (\\eta = \\sqrt{8\\ln N/T}) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$w_i$', 'logw -= eta * l', 'Multiplicative weights, kept in logs.'],
        ['$p$', 'np.exp(logw - logw.max()); p /= p.sum()', 'The mix the learner follows.'],
        ['FTL', 'l[np.argmin(cum)]', 'Follow the current leader.'],
      ],
    },
    notebook: {
      title: 'Lab 50.3 · Learning from expert advice',
      intro: 'Hedge against follow-the-leader on an adversarial and a stochastic sequence, and three values of η.',
      cells: [
        {
          title: 'Hedge and follow-the-leader',
          prose: '**Predict** follow-the-leader’s regret on the adversarial sequence.',
          code: `import numpy as np
def hedge(losses, eta):
    logw = np.zeros(losses.shape[1]); learner = 0.0
    for l in losses:
        p = np.exp(logw - logw.max()); p /= p.sum()
        learner += p @ l; logw -= eta * l                     # multiply each weight by e^(-eta * loss)
    return learner - losses.sum(0).min()
def follow_leader(losses):
    cum = np.zeros(losses.shape[1]); learner = 0.0
    for l in losses:
        learner += l[np.argmin(cum)]; cum += l
    return learner - cum.min()
T = 2000
adversarial = np.array([[0.5, 0]] + [[0, 1] if t % 2 else [1, 0] for t in range(1, T)])
rng = np.random.default_rng(3)
rates = np.where(np.arange(T)[:, None] < T / 2, [0.35, 0.15, 0.4, 0.3, 0.45], [0.35, 0.45, 0.4, 0.12, 0.45])
stochastic = (rng.random((T, 5)) < rates).astype(float)    # five forecasters; the best one changes halfway
for name, L in [("adversarial, 2 experts", adversarial), ("best changes halfway, 5 experts", stochastic)]:
    N = L.shape[1]; eta = np.sqrt(8 * np.log(N) / T)
    print(f"{name:32s} follow the leader {follow_leader(L):7.1f}; Hedge {hedge(L, eta):6.1f} (bound {np.sqrt(T * np.log(N) / 2):.1f}); "
          f"Hedge with 5 eta {hedge(L, 5 * eta):6.1f}, 0.1 eta {hedge(L, 0.1 * eta):6.1f}")
print(f"N = 100, T = 5,000: bound {np.sqrt(5000 * np.log(100) / 2):.1f}")`,
        },
      ],
    },
  },
  'l50-bandits': {
    formulaTex: '$$\\text{UCB1: } a_t = \\arg\\max_a \\Big[\\hat\\mu_a + \\sqrt{2\\ln t / n_a}\\Big]$$',
    mathCode: {
      rows: [
        ['greedy', 'np.argmax(s / n)', 'The best average so far.'],
        ['ε-greedy', 'rng.integers(K) if rng.random() < eps else ...', 'Explore a random arm 10% of the time.'],
        ['UCB1', 's / n + np.sqrt(2 * np.log(t + 1) / n)', 'Optimism: a bonus for rarely pulled arms.'],
      ],
    },
    notebook: {
      title: 'Lab 50.4 · Multi-armed bandits',
      intro: 'Greedy, ε-greedy and UCB1 on three arm sets, and ε-greedy’s linear regret.',
      cells: [
        {
          title: 'Three policies',
          prose: '**Predict** which policy has the widest spread of regret across runs.',
          code: `import numpy as np
def run_bandit(means, policy, T, seed, eps=0.1):
    """One run; returns the cumulative (pseudo-)regret after every round and the pull counts."""
    rng = np.random.default_rng(seed); means = np.asarray(means); K = len(means)
    n, s = np.zeros(K), np.zeros(K); regret = np.empty(T); total = 0.0
    for t in range(T):
        if t < K and policy != "ts":
            a = t                                               # try every arm once
        elif policy == "greedy":
            a = np.argmax(s / n)
        elif policy == "eps":
            a = rng.integers(K) if rng.random() < eps else np.argmax(s / n)
        elif policy == "ucb":
            a = np.argmax(s / n + np.sqrt(2 * np.log(t + 1) / n))
        else:                                                   # Thompson sampling
            a = np.argmax(rng.beta(1 + s, 1 + n - s))
        r = rng.random() < means[a]
        n[a] += 1; s[a] += r; total += means.max() - means[a]; regret[t] = total
    return regret, n

arm_sets = {"clear winner": [0.2, 0.25, 0.3, 0.35, 0.5], "close call": [0.40, 0.42, 0.44, 0.46, 0.48], "ads (5% clicks)": [0.03, 0.04, 0.05, 0.045, 0.06]}
T = 5000
print(f"average regret after {T:,} rounds over 6 runs")
for name, means in arm_sets.items():
    row = []
    for policy in ["greedy", "eps", "ucb"]:
        runs = [run_bandit(means, policy, T, seed)[0][-1] for seed in range(6)]
        row.append(f"{policy} {np.mean(runs):6.1f} (runs {min(runs):.0f}-{max(runs):.0f})")
    print(f"  {name:16s} " + "   ".join(row))
reg = np.mean([run_bandit(arm_sets["clear winner"], "eps", 20000, s)[0] for s in range(2)], axis=0)
print("ε-greedy regret at 5k, 10k, 20k rounds on the clear winner:", np.round(reg[[4999, 9999, 19999]], 0), "— growing linearly")`,
        },
      ],
    },
  },
  'l50-thompson': {
    formulaTex: '$$\\theta_a \\sim \\mathrm{Beta}(1 + s_a,\\ 1 + f_a), \\qquad \\text{pull } \\arg\\max_a \\theta_a$$',
    mathCode: {
      rows: [
        ['$\\theta_a$', 'rng.beta(1 + s, 1 + n - s)', 'One posterior draw per arm.'],
        ['bias', 'ss[0] / nn[0]', 'The naive estimate of an arm the bandit abandoned early.'],
      ],
    },
    notebook: {
      title: 'Lab 50.5 · Thompson sampling and bandits in practice',
      intro: 'Thompson sampling against UCB1, and the bias adaptive allocation leaves in naive estimates.',
      cells: [
        {
          title: 'Thompson sampling and its bias',
          prose: '**Predict** whether the abandoned arm’s naive estimate is too high or too low.',
          code: `import numpy as np
def run_bandit(means, policy, T, seed, eps=0.1):
    """One run; returns the cumulative (pseudo-)regret after every round and the pull counts."""
    rng = np.random.default_rng(seed); means = np.asarray(means); K = len(means)
    n, s = np.zeros(K), np.zeros(K); regret = np.empty(T); total = 0.0
    for t in range(T):
        if t < K and policy != "ts":
            a = t                                               # try every arm once
        elif policy == "greedy":
            a = np.argmax(s / n)
        elif policy == "eps":
            a = rng.integers(K) if rng.random() < eps else np.argmax(s / n)
        elif policy == "ucb":
            a = np.argmax(s / n + np.sqrt(2 * np.log(t + 1) / n))
        else:                                                   # Thompson sampling
            a = np.argmax(rng.beta(1 + s, 1 + n - s))
        r = rng.random() < means[a]
        n[a] += 1; s[a] += r; total += means.max() - means[a]; regret[t] = total
    return regret, n

arm_sets = {"clear winner": [0.2, 0.25, 0.3, 0.35, 0.5], "close call": [0.40, 0.42, 0.44, 0.46, 0.48], "ads (5% clicks)": [0.03, 0.04, 0.05, 0.045, 0.06]}
for name, means in arm_sets.items():
    res = {p: np.mean([run_bandit(means, p, 5000, s)[0][-1] for s in range(6)]) for p in ["ucb", "ts"]}
    print(f"{name:16s} after 5,000 rounds: UCB1 {res['ucb']:6.1f}, Thompson sampling {res['ts']:6.1f}")

# Adaptive allocation biases naive estimates: the arms a bandit abandons early look worse than they are.
means = np.array([0.40, 0.42, 0.44, 0.46, 0.48]); est_ts, est_ab = [], []
for seed in range(100):
    rng = np.random.default_rng(seed)
    rng2 = np.random.default_rng(seed + 1000); K = 5; nn, ss = np.zeros(K), np.zeros(K)
    for t in range(2000):                                      # Thompson sampling, keeping the sums
        a = np.argmax(rng2.beta(1 + ss, 1 + nn - ss)); r = rng2.random() < means[a]; nn[a] += 1; ss[a] += r
    est_ts.append(ss[0] / max(nn[0], 1))
    est_ab.append(rng.binomial(400, means[0]) / 400)           # a fixed 20% share of 2,000 rounds for the same arm
print(f"arm with true rate 0.40: mean naive estimate after Thompson sampling {np.mean(est_ts):.3f}; after a fixed-split test {np.mean(est_ab):.3f}")`,
        },
      ],
    },
  },
}
