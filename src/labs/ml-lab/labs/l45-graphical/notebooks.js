// Lab 45 runnable cells, typeset formulas and math ↔ code tables, keyed by lesson id.
// The CI network and the server-health HMM are the playground's (same tables); sequences are drawn with NumPy and every recursion is checked against brute force.

export const extras = {
  'l45-bn': {
    formulaTex: '$$p(x_1, \\dots, x_n) = \\prod_i p\\big(x_i \\mid \\mathrm{pa}(x_i)\\big)$$',
    mathCode: {
      rows: [
        ['$p(x_i \\mid \\mathrm{pa}(x_i))$', 'CPT[k](a)', 'One table per node, indexed by its parents.'],
        ['$\\prod_i$', 'np.prod([...])', 'The joint of one full assignment.'],
        ['enumeration', 'itertools.product([0, 1], repeat=5)', 'Sum the joint over all assignments consistent with the evidence.'],
      ],
    },
    notebook: {
      title: 'Lab 45.1 · Bayesian networks',
      intro: 'The CI network: its table count, a check that the factorized joint sums to 1, and queries by enumeration.',
      cells: [
        {
          title: 'Queries by enumeration',
          prose: '**Predict** how P(bad commit) given only the pager compares with given the failed build.',
          code: `import itertools
import numpy as np
# The playground's CI network: bad → fails ← outage; fails → pager; outage → status.
CPT = {
    "bad":    lambda a: 0.1,
    "outage": lambda a: 0.05,
    "fails":  lambda a: 0.99 if a["bad"] and a["outage"] else 0.9 if a["bad"] else 0.8 if a["outage"] else 0.02,
    "pager":  lambda a: 0.95 if a["fails"] else 0.01,
    "status": lambda a: 0.9 if a["outage"] else 0.02,
}
NAMES = list(CPT)
def joint(a):
    return np.prod([CPT[k](a) if a[k] else 1 - CPT[k](a) for k in NAMES])     # the product of one factor per node
def query(key, evidence={}):
    num = den = 0.0
    for values in itertools.product([0, 1], repeat=len(NAMES)):             # enumerate all 32 assignments
        a = dict(zip(NAMES, values))
        if any(a[k] != v for k, v in evidence.items()): continue
        p = joint(a); den += p; num += p * a[key]
    return num / den

print(f"table entries: 1 + 1 + 4 + 2 + 2 = {1 + 1 + 4 + 2 + 2}, against 2^5 - 1 = {2 ** 5 - 1} for the full joint")
total = sum(joint(dict(zip(NAMES, v))) for v in itertools.product([0, 1], repeat=5))
print(f"the factorized joint sums to {total:.12f}")
for evidence in [{}, {"fails": 1}, {"pager": 1}]:
    print(f"given {evidence or 'nothing'}: P(bad) = {query('bad', evidence):.3f}, P(outage) = {query('outage', evidence):.3f}")`,
        },
      ],
    },
  },
  'l45-dsep': {
    formulaTex: '$$\\begin{aligned} &A \\to B \\to C,\\ \\ A \\leftarrow B \\to C: \\\\ &\\quad\\text{blocked by observing } B \\\\ &A \\to B \\leftarrow C: \\\\ &\\quad\\text{opened by observing } B \\end{aligned}$$',
    mathCode: {
      rows: [
        ['independence', 'query(a, {**given, b: v}) == query(a, given)', 'Observing b does not move a.'],
        ['selection', 'np.corrcoef(bad[fails], outage[fails])', 'Correlation created by keeping only failed builds.'],
      ],
    },
    notebook: {
      title: 'Lab 45.2 · Independence and explaining away',
      intro: 'Explaining away, six independence checks, and the correlation that selecting on a common effect creates.',
      cells: [
        {
          title: 'Colliders and selection',
          prose: '**Predict** the correlation of bad commits and outages among failed builds only.',
          code: `import itertools
import numpy as np
# The playground's CI network: bad → fails ← outage; fails → pager; outage → status.
CPT = {
    "bad":    lambda a: 0.1,
    "outage": lambda a: 0.05,
    "fails":  lambda a: 0.99 if a["bad"] and a["outage"] else 0.9 if a["bad"] else 0.8 if a["outage"] else 0.02,
    "pager":  lambda a: 0.95 if a["fails"] else 0.01,
    "status": lambda a: 0.9 if a["outage"] else 0.02,
}
NAMES = list(CPT)
def joint(a):
    return np.prod([CPT[k](a) if a[k] else 1 - CPT[k](a) for k in NAMES])     # the product of one factor per node
def query(key, evidence={}):
    num = den = 0.0
    for values in itertools.product([0, 1], repeat=len(NAMES)):             # enumerate all 32 assignments
        a = dict(zip(NAMES, values))
        if any(a[k] != v for k, v in evidence.items()): continue
        p = joint(a); den += p; num += p * a[key]
    return num / den

print("explaining away, P(bad commit):")
for ev in [{}, {"fails": 1}, {"fails": 1, "outage": 1}, {"fails": 1, "status": 1}]:
    print(f"  given {ev or 'nothing'}: {query('bad', ev):.3f}")
def independent(a, b, given={}):
    base = query(a, given)
    return all(abs(query(a, {**given, b: v}) - base) < 1e-9 for v in (0, 1))
for a, b, g in [("bad", "outage", {}), ("bad", "outage", {"fails": 1}), ("bad", "outage", {"pager": 1}),
                ("bad", "pager", {"fails": 1}), ("fails", "status", {"outage": 1}), ("bad", "status", {"fails": 1})]:
    print(f"  {a} ⟂ {b} given {g or 'nothing'}? {independent(a, b, g)}")

# Selection on a common effect: bad commits and outages are independent in all builds, dependent among failed ones.
rng = np.random.default_rng(45); n = 200000
bad = rng.random(n) < 0.1; outage = rng.random(n) < 0.05
p_fail = np.where(bad & outage, 0.99, np.where(bad, 0.9, np.where(outage, 0.8, 0.02)))
fails = rng.random(n) < p_fail
print(f"correlation of bad and outage: all builds {np.corrcoef(bad, outage)[0, 1]:+.3f}; failed builds only {np.corrcoef(bad[fails], outage[fails])[0, 1]:+.3f}")`,
        },
      ],
    },
  },
  'l45-hmm': {
    formulaTex: '$$\\begin{aligned} \\alpha_t(j) &\\propto B_j(x_t) \\textstyle\\sum_i \\alpha_{t-1}(i)\\,A_{ij} \\\\ \\log P(x_{1:T}) &= \\textstyle\\sum_t \\log c_t \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\alpha_t$', 'B[:, o] * (alpha[-1] @ A)', 'Predict with the transitions, weight by the reading.'],
        ['$c_t$', 'a.sum()', 'The normaliser at step t; their logs sum to the log-likelihood.'],
        ['brute force', 'itertools.product(range(3), repeat=8)', 'All 3⁸ state sequences, for checking.'],
      ],
    },
    notebook: {
      title: 'Lab 45.3 · Hidden Markov models and filtering',
      intro: 'The scaled forward algorithm against brute force, and filtering against the raw readings.',
      cells: [
        {
          title: 'The forward algorithm',
          prose: '**Predict** whether filtering still helps when states barely persist.',
          code: `import numpy as np
def make_hmm(stay=0.92, clarity=0.7):
    """The playground's server-health HMM: states Healthy, Degraded, Down; readings fast, slow, timeout."""
    leave, off = (1 - stay) / 2, (1 - clarity) / 2
    A = np.array([[stay, leave * 1.6, leave * 0.4], [leave, stay, leave], [leave * 0.4, leave * 1.6, stay]])
    B = np.array([[clarity, off * 1.5, off * 0.5], [off, clarity, off], [off * 0.5, off * 1.5, clarity]])
    return np.array([0.8, 0.15, 0.05]), A, B
def simulate(pi, A, B, T, seed):
    rng = np.random.default_rng(seed); z = [rng.choice(3, p=pi)]
    for _ in range(T - 1): z.append(rng.choice(3, p=A[z[-1]]))
    z = np.array(z); return z, np.array([rng.choice(3, p=B[s]) for s in z])
def forward(pi, A, B, x):
    alpha, scales = [], []
    for t, o in enumerate(x):
        a = B[:, o] * (pi if t == 0 else alpha[-1] @ A)       # predict with the transitions, weight by the reading
        c = a.sum(); alpha.append(a / c); scales.append(c)     # normalize every step
    return np.array(alpha), np.array(scales)

import itertools
pi, A, B = make_hmm()
z, x = simulate(pi, A, B, 300, seed=4)
alpha, scales = forward(pi, A, B, x)
print(f"log-likelihood of 300 readings: {np.log(scales).sum():.2f}")
# Check against brute force on the first 8 readings: sum over all 3^8 = 6,561 state sequences.
brute = 0.0
for seq in itertools.product(range(3), repeat=8):
    p = pi[seq[0]] * B[seq[0], x[0]]
    for t in range(1, 8): p *= A[seq[t - 1], seq[t]] * B[seq[t], x[t]]
    brute += p
print(f"first 8 readings: brute force {np.log(brute):.10f}, forward algorithm {np.log(scales[:8]).sum():.10f}")
raw = np.mean(x == z); filt = np.mean(alpha.argmax(axis=1) == z)
print(f"state read straight off the reading: {raw:.3f} correct; filtered: {filt:.3f}")
pi2, A2, B2 = make_hmm(stay=0.4)
z2, x2 = simulate(pi2, A2, B2, 300, seed=4)
print(f"persistence 0.4: raw {np.mean(x2 == z2):.3f}, filtered {np.mean(forward(pi2, A2, B2, x2)[0].argmax(axis=1) == z2):.3f} — without persistence there is nothing to smooth over")`,
        },
      ],
    },
  },
  'l45-decode': {
    formulaTex: '$$\\begin{aligned} \\beta_t(i) &= \\textstyle\\sum_j A_{ij}\\,B_j(x_{t+1})\\,\\beta_{t+1}(j) \\\\ \\delta_t(j) &= B_j(x_t)\\max_i \\delta_{t-1}(i)\\,A_{ij} \\end{aligned}$$',
    mathCode: {
      rows: [
        ['$\\beta_t$', 'A @ (B[:, x[t + 1]] * beta[t + 1]) / scales[t + 1]', 'The future, summarized; scaled like α.'],
        ['smoothed', 'alpha * beta (normalized)', 'P(state at t | all readings).'],
        ['$\\delta_t$', 'delta[:, None] + np.log(A); max over predecessors', 'Viterbi in logs, remembering the best predecessor.'],
      ],
    },
    notebook: {
      title: 'Lab 45.4 · Smoothing and Viterbi decoding',
      intro: 'Filtered, smoothed and Viterbi accuracy on one run, and Viterbi against brute force.',
      cells: [
        {
          title: 'Backward, smoothing and Viterbi',
          prose: '**Predict** which of the three gets the most states right.',
          code: `import numpy as np
def make_hmm(stay=0.92, clarity=0.7):
    """The playground's server-health HMM: states Healthy, Degraded, Down; readings fast, slow, timeout."""
    leave, off = (1 - stay) / 2, (1 - clarity) / 2
    A = np.array([[stay, leave * 1.6, leave * 0.4], [leave, stay, leave], [leave * 0.4, leave * 1.6, stay]])
    B = np.array([[clarity, off * 1.5, off * 0.5], [off, clarity, off], [off * 0.5, off * 1.5, clarity]])
    return np.array([0.8, 0.15, 0.05]), A, B
def simulate(pi, A, B, T, seed):
    rng = np.random.default_rng(seed); z = [rng.choice(3, p=pi)]
    for _ in range(T - 1): z.append(rng.choice(3, p=A[z[-1]]))
    z = np.array(z); return z, np.array([rng.choice(3, p=B[s]) for s in z])
def forward(pi, A, B, x):
    alpha, scales = [], []
    for t, o in enumerate(x):
        a = B[:, o] * (pi if t == 0 else alpha[-1] @ A)       # predict with the transitions, weight by the reading
        c = a.sum(); alpha.append(a / c); scales.append(c)     # normalize every step
    return np.array(alpha), np.array(scales)

import itertools
pi, A, B = make_hmm()
z, x = simulate(pi, A, B, 300, seed=4)
alpha, scales = forward(pi, A, B, x)
beta = np.ones((len(x), 3))
for t in range(len(x) - 2, -1, -1):
    beta[t] = (A @ (B[:, x[t + 1]] * beta[t + 1])) / scales[t + 1]   # the backward recursion, scaled like the forward one
smoothed = alpha * beta; smoothed /= smoothed.sum(axis=1, keepdims=True)

def viterbi(x):
    delta = np.log(pi) + np.log(B[:, x[0]]); back = []
    for o in x[1:]:
        scores = delta[:, None] + np.log(A)                  # every predecessor i for every state j
        back.append(scores.argmax(axis=0)); delta = scores.max(axis=0) + np.log(B[:, o])
    path = [int(delta.argmax())]
    for b in reversed(back): path.append(int(b[path[-1]]))
    return np.array(path[::-1])
v = viterbi(x)
print(f"correct states: filtered {np.mean(alpha.argmax(1) == z):.3f}, smoothed {np.mean(smoothed.argmax(1) == z):.3f}, Viterbi {np.mean(v == z):.3f}")
x8 = x[:8]; best, best_p = None, -np.inf
for seq in itertools.product(range(3), repeat=8):
    lp = np.log(pi[seq[0]]) + np.log(B[seq[0], x8[0]]) + sum(np.log(A[seq[t - 1], seq[t]]) + np.log(B[seq[t], x8[t]]) for t in range(1, 8))
    if lp > best_p: best, best_p = seq, lp
print("first 8 readings: brute-force best path", best, " Viterbi", tuple(viterbi(x8)))`,
        },
      ],
    },
  },
  'l45-learn': {
    formulaTex: '$$\\begin{aligned} A_{ij} &\\leftarrow \\textstyle\\sum_t \\xi_t(i, j) \\big/ \\sum_t \\gamma_t(i) \\\\ B_{jk} &\\leftarrow \\textstyle\\sum_t \\gamma_t(j)\\,\\mathbb 1[x_t = k] \\big/ \\sum_t \\gamma_t(j) \\end{aligned}$$',
    mathCode: {
      rows: [
        ['counting', 'np.add.at(counts, (z[:-1], z[1:]), 1)', 'Transitions counted when states are recorded.'],
        ['$\\gamma_t$', 'al * be (normalized)', 'Expected state occupancy.'],
        ['$\\xi_t(i, j)$', 'al[:-1, :, None] * a * (b[:, x[1:]].T * be[1:])[:, None, :]', 'Expected transitions.'],
      ],
    },
    notebook: {
      title: 'Lab 45.5 · Learning graphical models',
      intro: 'Counting with labels, then Baum–Welch from four random starts — and what a stalled start does when run on.',
      cells: [
        {
          title: 'Counting and Baum–Welch',
          prose: '**Predict** whether the stalled starts ever reach the others.',
          code: `import numpy as np
def make_hmm(stay=0.92, clarity=0.7):
    """The playground's server-health HMM: states Healthy, Degraded, Down; readings fast, slow, timeout."""
    leave, off = (1 - stay) / 2, (1 - clarity) / 2
    A = np.array([[stay, leave * 1.6, leave * 0.4], [leave, stay, leave], [leave * 0.4, leave * 1.6, stay]])
    B = np.array([[clarity, off * 1.5, off * 0.5], [off, clarity, off], [off * 0.5, off * 1.5, clarity]])
    return np.array([0.8, 0.15, 0.05]), A, B
def simulate(pi, A, B, T, seed):
    rng = np.random.default_rng(seed); z = [rng.choice(3, p=pi)]
    for _ in range(T - 1): z.append(rng.choice(3, p=A[z[-1]]))
    z = np.array(z); return z, np.array([rng.choice(3, p=B[s]) for s in z])
def forward(pi, A, B, x):
    alpha, scales = [], []
    for t, o in enumerate(x):
        a = B[:, o] * (pi if t == 0 else alpha[-1] @ A)       # predict with the transitions, weight by the reading
        c = a.sum(); alpha.append(a / c); scales.append(c)     # normalize every step
    return np.array(alpha), np.array(scales)

pi, A, B = make_hmm(0.92, 0.8)
z, x = simulate(pi, A, B, 2000, seed=3)
# With the states recorded, learning is counting (plus a pseudo-count of 1).
counts = np.ones((3, 3)); np.add.at(counts, (z[:-1], z[1:]), 1)
print("A by counting:\\n", np.round(counts / counts.sum(axis=1, keepdims=True), 3), "\\n(true diagonal 0.92)")

def baum_welch(x, seed, iters=120):
    rng = np.random.default_rng(seed); row = lambda: (lambda v: v / v.sum())(0.5 + rng.random(3))
    p, a, b = row(), np.array([row() for _ in range(3)]), np.array([row() for _ in range(3)])
    for _ in range(iters):
        al, sc = forward(p, a, b, x); be = np.ones((len(x), 3))
        for t in range(len(x) - 2, -1, -1): be[t] = (a @ (b[:, x[t + 1]] * be[t + 1])) / sc[t + 1]
        g = al * be; g /= g.sum(axis=1, keepdims=True)                    # expected state occupancy
        xi = (al[:-1, :, None] * a[None] * (b[:, x[1:]].T * be[1:])[:, None, :]) / sc[1:, None, None]
        p = g[0]; a = xi.sum(0) / xi.sum(0).sum(1, keepdims=True)          # expected transitions, normalized
        b = np.array([g[x == k].sum(0) for k in range(3)]).T; b /= b.sum(1, keepdims=True)
    return np.log(forward(p, a, b, x)[1]).sum()
print(f"true model's log-likelihood: {np.log(forward(pi, A, B, x)[1]).sum():.1f}")
results = {s: baum_welch(x, s) for s in range(1, 5)}
for s, ll in results.items():
    print(f"Baum–Welch start {s}: after 120 iterations {ll:.1f}")
stalled = [s for s, ll in results.items() if ll < -1700]
print(f"start {stalled[-1]} run to 1,000 iterations: {baum_welch(x, stalled[-1], iters=1000):.1f} — a plateau, not a separate peak")`,
        },
      ],
    },
  },
}
