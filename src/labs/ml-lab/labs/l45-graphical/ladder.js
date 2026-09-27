import { rng, r3, needVars } from '../../kit/ladder.js'

// Lab 45 practice ladder: table counts, independence, forward cost and learned transitions by hand; scaling the forward
// pass; the forward step, transition estimates and the scaled log-likelihood in code.

export const fwdStepOf = (prev, A, b) => A[0].map((_, j) => b[j] * prev.reduce((s, v, i) => s + v * A[i][j], 0))
export const countsToAOf = C => C.map(row => { const s = row.reduce((a, b) => a + b, 0); return row.map(v => v / s) })
export function loglikOf(pi, A, B, x) {
  let alpha = null, ll = 0
  x.forEach((o, t) => { const a = t === 0 ? pi.map((p, j) => p * B[j][o]) : fwdStepOf(alpha, A, B.map(r => r[o])); const c = a.reduce((s, v) => s + v, 0); ll += Math.log(c); alpha = a.map(v => v / c) })
  return ll
}

const A3 = [[0.92, 0.064, 0.016], [0.04, 0.92, 0.04], [0.016, 0.064, 0.92]]
const B3 = [[0.7, 0.225, 0.075], [0.15, 0.7, 0.15], [0.075, 0.225, 0.7]]
const STEP_CASES = [
  { prev: [0.8, 0.15, 0.05], A: A3, b: [0.7, 0.15, 0.075] },
  { prev: [0.1, 0.2, 0.7], A: A3, b: [0.075, 0.15, 0.7] },
  { prev: [0.5, 0.5], A: [[0.9, 0.1], [0.2, 0.8]], b: [0.3, 0.6] },
].map(c => ({ ...c, expected: fwdStepOf(c.prev, c.A, c.b) }))
const COUNT_CASES = [
  { C: [[30, 10], [5, 15]] },
  { C: [[8, 1, 1], [2, 6, 2], [0, 3, 7]] },
  { C: [[1, 1], [1, 1]] },
].map(c => ({ ...c, expected: countsToAOf(c.C) }))
export const LL_CASES = [
  { pi: [0.8, 0.15, 0.05], A: A3, B: B3, x: [0, 0, 1, 2, 2, 1, 0] },
  { pi: [0.8, 0.15, 0.05], A: A3, B: B3, x: [2] },
  { pi: [0.5, 0.5], A: [[0.9, 0.1], [0.2, 0.8]], B: [[0.7, 0.3], [0.1, 0.9]], x: [0, 1, 1, 0, 1, 1, 1, 0] },
].map(c => ({ ...c, expected: loglikOf(c.pi, c.A, c.B, c.x) }))

const near = (a, b) => Array.isArray(a) && a.flat().length === b.flat().length && a.flat().every((v, i) => Math.abs(v - b.flat()[i]) < 1e-9)
export function diagnoseStep(c, got) {
  const wrong = c.A.map((row, i) => c.b[i] * row.reduce((s, v, j) => s + v * c.prev[j], 0))
  if (near(got.value, wrong) && !near(wrong, c.expected)) return 'Aᵢⱼ is the probability of going from i to j, so the prediction for state j sums αₜ₋₁(i)·Aᵢⱼ over i: alpha_prev @ A, not A @ alpha_prev.'
  if (near(got.value, c.prev.map((_, j) => c.prev.reduce((s, v, i) => s + v * c.A[i][j], 0)))) return 'Weight the prediction by the probability of the reading in each state: multiply by b.'
  return null
}
export function diagnoseCounts(c, got) {
  const col = c.C.map(row => row.map((v, j) => v / c.C.reduce((s, r) => s + r[j], 0)))
  if (near(got.value, col) && !near(col, c.expected)) return 'Each row is a distribution over where state i goes next: divide by the row sum (visits to i), not the column sum.'
  return null
}
export function diagnoseLl(c, got) {
  if (Math.abs(got.value - Math.exp(c.expected)) < 1e-12) return 'Return the log-likelihood, the sum of the logs of the normalizers — not the probability itself.'
  return null
}
export function evaluateScale(vars) {
  const miss = needVars(vars, ['underflowed', 'log_lik'])
  if (miss) return { passed: false, message: miss }
  if (Number(vars.underflowed.value)) return { passed: false, message: 'P(x₁..T) for 2,000 readings is about e^(−1889) — far below the smallest positive double (about 10⁻³⁰⁸), so it underflows to exactly 0. Set `scale = True` and run again.' }
  return { passed: true, message: `Log-likelihood ${r3(Number(vars.log_lik.value))}: normalizing at every step keeps α between 0 and 1, and the logs of the normalizers add up to the log-likelihood.` }
}

// ---------- Fresh problems ----------
export const TEMPLATES = ['tables', 'cost', 'count']
export function generate(template, seed) {
  const g = rng(seed * 283 + TEMPLATES.indexOf(template) * 4273 + 113)
  if (template === 'tables') { const roots = g.pick([1, 2, 3]), one = g.pick([1, 2, 3]), two = g.pick([0, 1, 2, 3]); return { template, seed, roots, one, two, answer: roots + 2 * one + 4 * two, misconceptions: [{ answer: 2 ** (roots + one + two) - 1, feedback: 'That is the full joint table. The network stores one entry per parent combination per node.' }].filter(m => m.answer !== roots + 2 * one + 4 * two) } }
  if (template === 'cost') { const T = g.pick([100, 500, 1000, 5000]), K = g.pick([2, 3, 4, 10]); return { template, seed, T, K, answer: T * K * K, misconceptions: [{ answer: T * K, feedback: 'Each step combines every previous state with every next state: K² per step.' }] } }
  const visits = g.pick([20, 40, 50, 80]), stay = Math.round(visits * g.pick([0.6, 0.75, 0.8, 0.9])); return { template, seed, visits, stay, answer: stay / visits }
}
export function view(p) {
  if (p.template === 'tables') return { intro: `A Bayesian network over binary variables: ${p.roots} root node${p.roots > 1 ? 's' : ''}, ${p.one} node${p.one > 1 ? 's' : ''} with one parent, and ${p.two} node${p.two === 1 ? '' : 's'} with two parents.`, questions: [{ id: 't', type: 'number', label: 'How many table entries does it need?', answer: p.answer, misconceptions: p.misconceptions }] }
  if (p.template === 'cost') return { intro: `An HMM with K = ${p.K} states runs for T = ${p.T.toLocaleString('en')} steps.`, questions: [{ id: 'c', type: 'number', label: 'About how many multiply-adds does the forward algorithm need (T·K²)?', answer: p.answer, misconceptions: p.misconceptions }] }
  return { intro: `In a labelled log, a state is visited ${p.visits} times (not counting the last step) and stays in the same state ${p.stay} times.`, questions: [{ id: 'a', type: 'number', label: 'What is its estimated self-transition probability? (Three decimals.)', answer: p.answer, tolerance: 0.0006 }] }
}
export function workedSolution(p) {
  if (p.template === 'tables') return `${p.roots} × 1 + ${p.one} × 2 + ${p.two} × 4 = **${p.answer}**.`
  if (p.template === 'cost') return `${p.T} × ${p.K}² = **${p.answer.toLocaleString('en')}**.`
  return `${p.stay}/${p.visits} = **${r3(p.answer)}**.`
}

export const hmm = {
  title: 'Graphical models: tables, recursions and learning',
  version: 1,
  templates: TEMPLATES,
  templateNames: { tables: 'Network table count', cost: 'Forward-algorithm cost', count: 'Transition by counting' },
  generate, view, workedSolution,
  intro: 'Seven steps: graphical-model arithmetic by hand, scaling the forward pass, and writing the forward step, transition estimates and the scaled log-likelihood. Nothing here locks the rest of the lab.',
  steps: [
    {
      id: 'trace', kind: 'trace', title: 'Graphical-model arithmetic by hand',
      prompt: 'A network over 6 binary variables: two roots and four nodes with two parents each. The CI network with the build failure observed. A 3-state HMM over 1,000 steps. Expected counts: state 1 occupied 40 times with 30 self-transitions.',
      fields: [
        { label: 'Table entries', answer: 18 },
        { label: 'Bad commit and status page independent given the failure? (1 = yes, 0 = no)', answer: 0 },
        { label: 'Forward-algorithm multiply-adds (T·K²)', answer: 9000 },
        { label: 'Updated A₁₁', answer: 0.75, tolerance: 1e-9 },
      ],
      explain: '2 × 1 + 4 × 4 = 18. No: the observed collider opens bad → fails ← outage → status. 1,000 × 9 = 9,000. 30/40 = 0.75.',
    },
    {
      id: 'agree', kind: 'probe', title: 'Scale the forward pass',
      prompt: 'The forward algorithm over 2,000 readings, without normalizing. Run it: the likelihood becomes exactly zero. **Set `scale = True`** and run again.',
      starter: `import numpy as np
pi = np.array([0.8, 0.15, 0.05])
A = np.array([[0.92, 0.064, 0.016], [0.04, 0.92, 0.04], [0.016, 0.064, 0.92]])
B = np.array([[0.7, 0.225, 0.075], [0.15, 0.7, 0.15], [0.075, 0.225, 0.7]])
rng = np.random.default_rng(45); z = [0]
for _ in range(1999): z.append(rng.choice(3, p=A[z[-1]]))
x = np.array([rng.choice(3, p=B[s]) for s in z])            # 2,000 latency readings

scale = False             # True: normalize alpha at every step and add up the logs of the normalizers
alpha, log_lik = None, 0.0
for t, o in enumerate(x):
    alpha = B[:, o] * (pi if t == 0 else alpha @ A)
    if scale:
        c = alpha.sum(); log_lik += np.log(c); alpha = alpha / c
if not scale:
    total = alpha.sum()                                     # P(x_1..T) as a plain number
    underflowed = int(total == 0.0)
    log_lik = float(np.log(total)) if total > 0 else 0.0
else:
    underflowed = 0
print(f"scale = {scale}: underflowed to zero: {bool(underflowed)}; log-likelihood {log_lik:.2f}")`,
      probe: ['underflowed', 'log_lik'],
      evaluate: evaluateScale,
      done: 'Every production HMM, Kalman filter and sampler works with normalized quantities or logs.',
    },
    {
      id: 'fill', kind: 'function', title: 'Fill in one forward step',
      prompt: 'Replace `___` with the unnormalized α for the next step, given the previous α, the transition matrix A and the reading probabilities b (b[j] = P(reading | state j)).',
      starter: `import numpy as np

def forward_step(alpha_prev, A, b):
    """Predict with the transitions, then weight by the reading."""
    return ___`,
      hint: 'alpha_prev @ A predicts the next state; multiply elementwise by b.',
      solution: 'return b * (alpha_prev @ A)',
      check: { fn: 'forward_step', args: ['prev', 'A', 'b'], cases: STEP_CASES, describe: c => `${c.prev.length} states`, diagnose: diagnoseStep },
    },
    {
      id: 'repair', kind: 'function', title: 'Repair a planted bug',
      prompt: 'For transition counts [[30, 10], [5, 15]] this returns **[[0.857, 0.4], [0.143, 0.6]]**; the rows should be distributions: [[0.75, 0.25], [0.25, 0.75]]. Fix it.',
      starter: `import numpy as np

def counts_to_A(C):
    """Maximum-likelihood transition matrix from counts C[i, j] of transitions i -> j."""
    return C / C.sum(axis=0, keepdims=True)`,
      hint: 'A[i, j] = P(next = j | now = i).',
      solution: 'return C / C.sum(axis=1, keepdims=True)',
      check: { fn: 'counts_to_A', args: ['C'], cases: COUNT_CASES, describe: c => `${c.C.length} states`, diagnose: diagnoseCounts },
      explainChoice: {
        prompt: 'Why add pseudo-counts before normalizing in practice?',
        options: [
          { text: 'A transition never seen in the log would get probability 0, and one later occurrence would then make the whole sequence impossible (log-likelihood −∞). A small pseudo-count keeps every transition possible.', correct: true },
          { text: 'To make the rows sum to 1.', feedback: 'Normalizing does that with or without pseudo-counts.' },
          { text: 'Because counts can be negative.', feedback: 'Counts never are.' },
          { text: 'To make the matrix symmetric.', feedback: 'Transition matrices need not be symmetric.' },
        ],
        rightFeedback: 'The same idea as Laplace smoothing (Labs 11 and 41).',
      },
    },
    {
      id: 'implement', kind: 'function', title: 'The scaled log-likelihood',
      prompt: 'Write `log_likelihood` from its contract.',
      starter: `import numpy as np

def log_likelihood(pi, A, B, x):
    """log P(x_1..T) for an HMM with initial distribution pi, transitions A and emissions B (B[j, k] = P(k | j)),
    by the forward algorithm, normalizing alpha at every step and summing the logs of the normalizers.

    Example: a single reading 2 with pi = [0.8, 0.15, 0.05] and the lab's B gives log(0.8*0.075 + 0.15*0.15 + 0.05*0.7).
    """
    pass   # replace with your code`,
      hint: 'alpha = pi * B[:, x[0]]; then alpha = B[:, o] * (alpha @ A) for each later reading, normalizing each time.',
      solution: 'll, alpha = 0.0, None\nfor t, o in enumerate(x):\n    alpha = B[:, o] * (pi if t == 0 else alpha @ A)\n    c = alpha.sum(); ll += np.log(c); alpha = alpha / c\nreturn ll',
      check: { fn: 'log_likelihood', args: ['pi', 'A', 'B', 'x'], ints: ['x'], cases: LL_CASES, describe: c => `${c.pi.length} states, ${c.x.length} readings`, diagnose: diagnoseLl },
    },
    { id: 'transfer', kind: 'transfer', title: 'Solve new problems', prompt: 'New networks, HMMs and logs. Solve one of each kind without opening the worked answer.' },
    { id: 'review', kind: 'review', title: 'Come back later', prompt: 'A fresh problem after a gap. The first return is suggested a day after you finish step 6; “Do it now” is always there and is recorded as early.' },
  ],
}
