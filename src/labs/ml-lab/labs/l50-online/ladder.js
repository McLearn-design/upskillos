import { rng, r3, needVars } from '../../kit/ladder.js'

// Lab 50 practice ladder: regret, mistake bounds, Hedge's guarantee and exploration by hand; greedy against Thompson
// sampling; Hedge's probabilities, UCB1 scores and perceptron mistakes in code.

export const hedgeProbsOf = (cum, eta) => { const m = Math.min(...cum), w = cum.map(c => Math.exp(-eta * (c - m))), s = w.reduce((a, b) => a + b, 0); return w.map(v => v / s) }
export const ucbOf = (sums, counts, t) => sums.map((s, i) => s / counts[i] + Math.sqrt(2 * Math.log(t) / counts[i]))
export function mistakesOf(X, y) { let w = [0, 0], m = 0; X.forEach((x, i) => { if (y[i] * (w[0] * x[0] + w[1] * x[1]) <= 0) { w = [w[0] + y[i] * x[0], w[1] + y[i] * x[1]]; m++ } }); return m }

const HEDGE_CASES = [{ cum: [0, 0, 0], eta: 1 }, { cum: [10, 12, 30], eta: 0.5 }, { cum: [3, 1], eta: 2 }, { cum: [100, 101, 99], eta: 0.1 }].map(c => ({ ...c, expected: hedgeProbsOf(c.cum, c.eta) }))
const UCB_CASES = [{ sums: [1.2, 3, 2], counts: [4, 10, 5], t: 100 }, { sums: [30, 40], counts: [100, 100], t: 200 }, { sums: [0, 1], counts: [1, 2], t: 3 }].map(c => ({ ...c, expected: ucbOf(c.sums, c.counts, c.t) }))
export const PERC_CASES = [
  { X: [[1, 1], [-1, -1], [2, 0.5], [-0.5, -2]], y: [1, -1, 1, -1] },
  { X: [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]], y: [1, 1, -1, -1, 1] },
  { X: [[-1, 2], [1, -2], [2, 1], [-2, -1], [0.5, 0.5]], y: [1, -1, 1, -1, 1] },
].map(c => ({ ...c, expected: mistakesOf(c.X, c.y) }))

const near = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9)
export function diagnoseHedge(c, got) {
  const pos = (() => { const w = c.cum.map(v => Math.exp(c.eta * v)), s = w.reduce((a, b) => a + b, 0); return w.map(v => v / s) })()
  if (near(got.value, pos)) return 'Weights shrink with loss: e^(−η·cumulative loss). The sign is flipped.'
  if (near(got.value, c.cum.map(v => Math.exp(-c.eta * v)))) return 'Normalize the weights so they sum to 1.'
  return null
}
export function diagnoseUcb(c, got) {
  if (near(got.value, c.sums.map((s, i) => s / c.counts[i] + 2 * Math.log(c.t) / c.counts[i]))) return 'The bonus is a square root: √(2 ln t / nₐ).'
  return null
}
export function diagnosePerc(c, got) {
  let w = [0, 0], m = 0
  c.X.forEach((x, i) => { if (c.y[i] * (w[0] * x[0] + w[1] * x[1]) < 0) { w = [w[0] + c.y[i] * x[0], w[1] + c.y[i] * x[1]]; m++ } })
  if (got.value === m && m !== c.expected) return 'Count a zero score as a mistake (y·wᵀx ≤ 0): at the start w = 0 and every prediction is undecided.'
  return null
}
export function evaluateBandit(vars) {
  const miss = needVars(vars, ['mean_regret', 'worst_run'])
  if (miss) return { passed: false, message: miss }
  const m = Number(vars.mean_regret.value), w = Number(vars.worst_run.value)
  if (m > 150) return { passed: false, message: `Average regret ${r3(m)} (worst run ${r3(w)}): greedy locks onto whichever arm looks best after one unlucky pull and never checks again. Set \`policy = "ts"\` and run again.` }
  return { passed: true, message: `Average regret ${r3(m)}, worst run ${r3(w)}: Thompson sampling keeps trying arms in proportion to the chance they are best, so a bad start is corrected.` }
}

// ---------- Fresh problems ----------
export const TEMPLATES = ['regret', 'mistakes', 'explore']
export function generate(template, seed) {
  const g = rng(seed * 317 + TEMPLATES.indexOf(template) * 4349 + 149)
  if (template === 'regret') { const T = g.pick([500, 1000, 2000]), best = Math.round(T * g.pick([0.2, 0.25, 0.3])), extra = g.pick([12, 25, 40, 60]); return { template, seed, T, best, learner: best + extra, answer: extra } }
  if (template === 'mistakes') { const R = g.pick([1, 2, 3, 5]), gamma = g.pick([0.1, 0.25, 0.5, 1]); return { template, seed, R, gamma, answer: (R / gamma) ** 2, misconceptions: [{ answer: R / gamma, feedback: 'Square it: M ≤ (R/γ)².' }].filter(m => m.answer !== (R / gamma) ** 2) } }
  const eps = g.pick([0.05, 0.1, 0.2]), K = g.pick([2, 4, 5, 10]), T = g.pick([1000, 10000]); return { template, seed, eps, K, T, answer: eps * T * (K - 1) / K, misconceptions: [{ answer: eps * T, feedback: 'Exploration also picks the best arm 1/K of the time; count only the others.' }] }
}
export function view(p) {
  if (p.template === 'regret') return { intro: `Over ${p.T} rounds a learner lost ${p.learner} times; the best single action in hindsight lost ${p.best} times.`, questions: [{ id: 'r', type: 'number', label: 'What is the regret?', answer: p.answer }] }
  if (p.template === 'mistakes') return { intro: `A separable stream with radius R = ${p.R} and margin γ = ${p.gamma}.`, questions: [{ id: 'm', type: 'number', label: 'What is the perceptron mistake bound?', answer: p.answer, misconceptions: p.misconceptions }] }
  return { intro: `ε-greedy with ε = ${p.eps} and ${p.K} arms explores uniformly over ${p.T.toLocaleString('en')} rounds.`, questions: [{ id: 'e', type: 'number', label: 'About how many rounds go to exploring the non-best arms?', answer: p.answer, tolerance: 0.5, misconceptions: p.misconceptions }] }
}
export function workedSolution(p) {
  if (p.template === 'regret') return `${p.learner} − ${p.best} = **${p.answer}**.`
  if (p.template === 'mistakes') return `(${p.R}/${p.gamma})² = **${p.answer}**.`
  return `${p.eps} × ${p.T} × ${p.K - 1}/${p.K} = **${p.answer}**.`
}

export const online = {
  title: 'Online learning: regret, experts and bandits',
  version: 1,
  templates: TEMPLATES,
  templateNames: { regret: 'Regret', mistakes: 'Perceptron mistake bound', explore: 'ε-greedy exploration' },
  generate, view, workedSolution,
  intro: 'Seven steps: online-learning arithmetic by hand, greedy against Thompson sampling, and writing Hedge’s probabilities, UCB1 scores and a perceptron mistake count. Nothing here locks the rest of the lab.',
  steps: [
    {
      id: 'trace', kind: 'trace', title: 'Online-learning arithmetic by hand',
      prompt: 'A learner lost 310 times in 1,000 rounds; the best action 270. A stream with R = 3 and γ = 0.25. Hedge with 100 experts over 5,000 rounds. ε-greedy with ε = 0.1, 5 arms, 10,000 rounds.',
      fields: [
        { label: 'Regret', answer: 40 },
        { label: 'Perceptron mistake bound', answer: 144 },
        { label: 'Hedge’s regret guarantee (nearest whole number)', answer: 107, tolerance: 0.5 },
        { label: 'Rounds exploring non-best arms', answer: 800 },
      ],
      explain: '310 − 270 = 40. (3/0.25)² = 144. √(5000 × ln 100 / 2) = 107.3. 0.1 × 10,000 × 4/5 = 800.',
    },
    {
      id: 'agree', kind: 'probe', title: 'Greedy against Thompson sampling',
      prompt: 'Five variants over 3,000 rounds and 10 runs, with the greedy policy. Run it: large and erratic regret. **Set `policy = "ts"`** and run again.',
      starter: `import numpy as np
means = np.array([0.2, 0.25, 0.3, 0.35, 0.5])               # five variants; the last is clearly best

policy = "greedy"         # "greedy": always the best average so far; "ts": Thompson sampling with Beta posteriors
regrets = []
for seed in range(10):
    rng = np.random.default_rng(seed); n, s = np.zeros(5), np.zeros(5); total = 0.0
    for t in range(3000):
        if policy == "greedy":
            a = t if t < 5 else int(np.argmax(s / n))
        else:
            a = int(np.argmax(rng.beta(1 + s, 1 + n - s)))
        r = rng.random() < means[a]; n[a] += 1; s[a] += r; total += means.max() - means[a]
    regrets.append(total)
mean_regret = float(np.mean(regrets)); worst_run = float(np.max(regrets))
print(f"policy = {policy!r}: average regret over 10 runs {mean_regret:.1f}; worst run {worst_run:.1f}")`,
      probe: ['mean_regret', 'worst_run'],
      evaluate: evaluateBandit,
      done: 'Log the probability of every choice, so later policies can be evaluated offline (Lab 35).',
    },
    {
      id: 'fill', kind: 'function', title: 'Fill in Hedge’s probabilities',
      prompt: 'Replace `___` with the probability Hedge puts on each expert, given the cumulative losses and η.',
      starter: `import numpy as np

def hedge_probs(cum_losses, eta):
    """Weights proportional to exp(-eta * cumulative loss), normalized (shifted for numerical safety)."""
    w = np.exp(-eta * (cum_losses - cum_losses.min()))
    return ___`,
      hint: 'Divide by the sum.',
      solution: 'return w / w.sum()',
      check: { fn: 'hedge_probs', args: ['cum', 'eta'], cases: HEDGE_CASES, describe: c => `losses (${c.cum.join(', ')}), η = ${c.eta}`, diagnose: diagnoseHedge },
    },
    {
      id: 'repair', kind: 'function', title: 'Repair a planted bug',
      prompt: 'At t = 100, an arm with sum 1.2 over 4 pulls gets score **2.60** from this code; UCB1 gives 0.3 + √(2 ln 100/4) = 1.817. Fix it.',
      starter: `import numpy as np

def ucb_scores(sums, counts, t):
    """UCB1 score of every arm at round t."""
    return sums / counts + 2 * np.log(t) / counts`,
      hint: 'The bonus is a confidence width: a square root.',
      solution: 'return sums / counts + np.sqrt(2 * np.log(t) / counts)',
      check: { fn: 'ucb_scores', args: ['sums', 'counts', 't'], ints: ['t'], cases: UCB_CASES, describe: c => `sums (${c.sums.join(', ')}), counts (${c.counts.join(', ')}), t = ${c.t}`, diagnose: diagnoseUcb },
      explainChoice: {
        prompt: 'Why does the bonus shrink like 1/√nₐ?',
        options: [
          { text: 'It is a confidence width for the arm’s mean: the uncertainty of an average of nₐ rewards falls like 1/√nₐ (Hoeffding, Lab 47). Rarely pulled arms keep a large bonus until evidence accumulates.', correct: true },
          { text: 'To make every arm pulled equally often.', feedback: 'Good arms end up pulled far more; bad ones only enough to rule them out.' },
          { text: 'Because rewards shrink over time.', feedback: 'Rewards are fixed; our uncertainty about them shrinks.' },
          { text: 'Because ln t grows too fast otherwise.', feedback: 'ln t grows slowly; the √nₐ term is about evidence per arm.' },
        ],
        rightFeedback: 'The ln t keeps a little exploration alive forever, so an arm is never written off permanently.',
      },
    },
    {
      id: 'implement', kind: 'function', title: 'Count perceptron mistakes',
      prompt: 'Write `perceptron_mistakes` from its contract.',
      starter: `import numpy as np

def perceptron_mistakes(X, y):
    """Run the perceptron once over the stream in order, starting from w = 0 (no bias).
    A mistake is y * (w . x) <= 0; on a mistake, w += y * x. Return the number of mistakes.

    Example: perceptron_mistakes([[1, 1], [-1, -1], [2, 0.5], [-0.5, -2]], [1, -1, 1, -1])  ->  1
    """
    pass   # replace with your code`,
      hint: 'Loop over the examples; update and count only when y·(w·x) ≤ 0.',
      solution: 'w = np.zeros(X.shape[1]); m = 0\nfor x, t in zip(X, y):\n    if t * (w @ x) <= 0:\n        w = w + t * x; m += 1\nreturn m',
      check: { fn: 'perceptron_mistakes', args: ['X', 'y'], ints: ['y'], cases: PERC_CASES, describe: c => `${c.X.length} examples`, diagnose: diagnosePerc },
    },
    { id: 'transfer', kind: 'transfer', title: 'Solve new problems', prompt: 'New streams, learners and bandits. Solve one of each kind without opening the worked answer.' },
    { id: 'review', kind: 'review', title: 'Come back later', prompt: 'A fresh problem after a gap. The first return is suggested a day after you finish step 6; “Do it now” is always there and is recorded as early.' },
  ],
}
