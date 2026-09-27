import { rng, r3, needVars } from '../../kit/ladder.js'
import { rhat as rhatOf } from './engine.js'

// Lab 44 practice ladder: Monte Carlo error, importance estimates, acceptance and ESS by hand; tuning the step; the
// importance-sampling ESS, the Metropolis decision and R̂ in code.

export const essWOf = w => { const s = w.reduce((a, b) => a + b, 0); return s * s / w.reduce((a, b) => a + b * b, 0) }
export const acceptOf = (lx, ly, u) => (Math.log(u) < ly - lx ? 1 : 0)

const ESS_CASES = [{ w: [1, 1, 1, 1] }, { w: [0.7, 0.1, 0.1, 0.1] }, { w: [5, 0, 0, 0, 1e-3] }, { w: [2, 4, 6] }].map(c => ({ ...c, expected: essWOf(c.w) }))
const ACC_CASES = [[-3, -4.2, 0.2], [-3, -4.2, 0.35], [-5, -4, 0.99], [-1, -1.5, 0.6], [-1, -1.5, 0.61]].map(([lx, ly, u]) => ({ lx, ly, u, expected: acceptOf(lx, ly, u) }))
export const RHAT_CASES = [
  { chains: [[0.1, -0.2, 0.3, 0.0, -0.1, 0.2], [0.0, 0.2, -0.1, 0.1, -0.3, 0.1]] },
  { chains: [[-2.1, -1.9, -2.0, -2.2], [2.0, 2.1, 1.9, 2.2], [-2.0, -2.1, -1.8, -2.0], [1.9, 2.0, 2.1, 2.0]] },
  { chains: [[1, 2, 3, 4, 5], [2, 3, 4, 5, 6], [0, 1, 2, 3, 4]] },
].map(c => ({ ...c, expected: rhatOf(c.chains) }))

export function diagnoseEss(c, got) {
  const s = c.w.reduce((a, b) => a + b, 0), nw = c.w.map(v => v / s), wrong = nw.reduce((a, b) => a + b * b, 0)
  if (Math.abs(got.value - wrong) < 1e-9 && Math.abs(wrong - c.expected) > 1e-9) return 'That is Σw² of the normalized weights; the ESS is its reciprocal, (Σw)²/Σw².'
  if (Math.abs(got.value - c.w.length) < 1e-9 && c.expected < c.w.length - 1e-9) return 'The ESS is not the number of samples: uneven weights make the set worth fewer.'
  return null
}
export function diagnoseAcc(c, got) {
  const noLog = c.u < c.ly - c.lx ? 1 : 0
  if (got.value === noLog && noLog !== c.expected) return 'Compare like with like: ly − lx is a log ratio, so compare it with log u (or compare u with exp(ly − lx)).'
  return null
}
export function diagnoseRhat(c, got) {
  const m = c.chains.length, n = c.chains[0].length, means = c.chains.map(ch => ch.reduce((a, b) => a + b, 0) / n)
  const W = c.chains.reduce((s, ch, j) => s + ch.reduce((t, v) => t + (v - means[j]) ** 2, 0) / (n - 1), 0) / m
  const gm = means.reduce((a, b) => a + b, 0) / m, B = n / (m - 1) * means.reduce((s, v) => s + (v - gm) ** 2, 0)
  if (Math.abs(got.value - ((n - 1) / n * W + B / n) / W) < 1e-9) return 'Take the square root: R̂ = √(((n − 1)/n · W + B/n) / W).'
  return null
}
export function evaluateStep(vars) {
  const miss = needVars(vars, ['ess_value', 'acceptance', 'step'])
  if (miss) return { passed: false, message: miss }
  const e = Number(vars.ess_value.value), a = Number(vars.acceptance.value)
  if (e < 80) return { passed: false, message: `Acceptance ${r3(100 * a)}% but only ${r3(e)} effective samples of 4,500: tiny steps are nearly always accepted and barely move. Set \`step = 1.5\` and run again.` }
  return { passed: true, message: `Acceptance ${r3(100 * a)}% and ${r3(e)} effective samples: fewer moves are accepted, but each one travels, so the chain explores far faster.` }
}

// ---------- Fresh problems ----------
export const TEMPLATES = ['mcerror', 'acceptance', 'ess']
export function generate(template, seed) {
  const g = rng(seed * 281 + TEMPLATES.indexOf(template) * 4261 + 109)
  if (template === 'mcerror') { const sd = g.pick([2, 3, 5, 10]), S = g.pick([100, 400, 2500, 10000]); return { template, seed, sd, S, answer: sd / Math.sqrt(S), misconceptions: [{ answer: sd / S, feedback: 'Divide by √S, not S.' }] } }
  if (template === 'acceptance') { const lx = g.pick([-1, -2.5, -3]), d = g.pick([0.3, 0.7, 1.2, 2, -0.5]); const ly = Math.round((lx - d) * 10) / 10, answer = Math.min(1, Math.exp(ly - lx)); return { template, seed, lx, ly, answer, misconceptions: [{ answer: Math.min(1, Math.max(0, 1 - (lx - ly))), feedback: 'Exponentiate the log ratio: min(1, e^(ly − lx)).' }].filter(m => Math.abs(m.answer - answer) > 0.0006) } }
  const n = g.pick([2000, 3000, 5000, 10000]), s = g.pick([4, 7, 12, 24]); return { template, seed, n, s, answer: n / (1 + 2 * s), misconceptions: [{ answer: n / (1 + s), feedback: 'The sum counts both directions: n / (1 + 2Σρₖ).' }] }
}
export function view(p) {
  if (p.template === 'mcerror') return { intro: `A Monte Carlo estimate uses ${p.S.toLocaleString('en')} independent samples of f with standard deviation ${p.sd}.`, questions: [{ id: 'e', type: 'number', label: 'What is its standard error? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  if (p.template === 'acceptance') return { intro: `A random-walk Metropolis chain is at log-density ${p.lx}; the proposal has log-density ${p.ly}.`, questions: [{ id: 'a', type: 'number', label: 'What is the acceptance probability? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  return { intro: `A chain of ${p.n.toLocaleString('en')} draws has autocorrelations summing to ${p.s}.`, questions: [{ id: 's', type: 'number', label: 'What is its effective sample size? (Nearest whole number.)', answer: p.answer, tolerance: 0.5, misconceptions: p.misconceptions }] }
}
export function workedSolution(p) {
  if (p.template === 'mcerror') return `${p.sd}/√${p.S} = **${r3(p.answer)}**.`
  if (p.template === 'acceptance') return `min(1, e^(${p.ly} − (${p.lx}))) = **${r3(p.answer)}**.`
  return `${p.n}/(1 + 2 × ${p.s}) = **${Math.round(p.answer)}**.`
}

export const sampling = {
  title: 'Sampling: errors, acceptance and diagnostics',
  version: 1,
  templates: TEMPLATES,
  templateNames: { mcerror: 'Monte Carlo error', acceptance: 'Metropolis acceptance', ess: 'Effective sample size' },
  generate, view, workedSolution,
  intro: 'Seven steps: sampling arithmetic by hand, tuning a Metropolis step, and writing the importance-sampling ESS, the Metropolis decision and R̂. Nothing here locks the rest of the lab.',
  steps: [
    {
      id: 'trace', kind: 'trace', title: 'Sampling arithmetic by hand',
      prompt: '2,500 samples of f with sd 5. Self-normalized weights 0.5, 0.3, 0.2 with values 2, 4, 10. Log-densities −3.0 (current) and −4.2 (proposal). A chain of 5,000 draws with autocorrelations summing to 12.',
      fields: [
        { label: 'Monte Carlo standard error', answer: 0.1, tolerance: 1e-9 },
        { label: 'Importance-sampling estimate', answer: 4.2, tolerance: 1e-9 },
        { label: 'Acceptance probability (three decimals)', answer: Math.exp(-1.2), tolerance: 0.0006 },
        { label: 'Effective sample size', answer: 200 },
      ],
      explain: '5/√2500 = 0.1. 0.5 × 2 + 0.3 × 4 + 0.2 × 10 = 4.2. e^(−1.2) = 0.301. 5,000/(1 + 24) = 200.',
    },
    {
      id: 'agree', kind: 'probe', title: 'Tune the step',
      prompt: 'Random-walk Metropolis on a correlated Gaussian with step 0.1. Run it: almost every move is accepted, yet the chain is worth very little. **Set `step = 1.5`** and run again.',
      starter: `import numpy as np
def logp(t, rho=0.95):                                       # a correlated Gaussian posterior (unnormalized)
    return -(t[0] ** 2 - 2 * rho * t[0] * t[1] + t[1] ** 2) / (2 * (1 - rho ** 2))

step = 0.1                # the random-walk step size
rng = np.random.default_rng(44); x = np.array([3.0, -3.0]); lx = logp(x); chain = []; accepted = 0
for _ in range(5000):
    y = x + step * rng.normal(size=2); ly = logp(y)
    if np.log(rng.random()) < ly - lx:
        x, lx = y, ly; accepted += 1
    chain.append(x[0])
xs = np.array(chain[500:]) - np.mean(chain[500:]); v = xs @ xs / len(xs); s = 0.0
for k in range(1, 200):
    rho_k = (xs[k:] @ xs[:-k]) / len(xs) / v
    if rho_k < 0: break
    s += rho_k
ess_value = len(xs) / (1 + 2 * s)
acceptance = accepted / 5000
print(f"step = {step}: acceptance {acceptance:.2f}, effective sample size {ess_value:.0f} of 4,500")`,
      probe: ['ess_value', 'acceptance', 'step'],
      evaluate: evaluateStep,
      done: 'Adaptive samplers tune the step during warm-up to reach a target acceptance; gradient-based ones (HMC, NUTS) move further still.',
    },
    {
      id: 'fill', kind: 'function', title: 'Fill in the importance-sampling ESS',
      prompt: 'Replace `___` with the effective sample size of a set of (not necessarily normalized) weights.',
      starter: `import numpy as np

def weight_ess(w):
    """Effective sample size of importance weights w."""
    return ___`,
      hint: '(Σw)² / Σw² — unchanged by rescaling the weights.',
      solution: 'return w.sum() ** 2 / (w ** 2).sum()',
      check: { fn: 'weight_ess', args: ['w'], cases: ESS_CASES, describe: c => `weights (${c.w.join(', ')})`, diagnose: diagnoseEss },
    },
    {
      id: 'repair', kind: 'function', title: 'Repair a planted bug',
      prompt: 'At log-density −3.0 with a proposal at −4.2 and u = 0.2, this returns **0 (reject)**; the acceptance probability is e^(−1.2) = 0.301, so u = 0.2 should accept. Fix it.',
      starter: `import numpy as np

def accept(lx, ly, u):
    """1 if the Metropolis rule accepts the move from log-density lx to ly with uniform draw u, else 0."""
    return int(u < ly - lx)`,
      hint: 'ly − lx is a log ratio.',
      solution: 'return int(np.log(u) < ly - lx)',
      check: { fn: 'accept', args: ['lx', 'ly', 'u'], cases: ACC_CASES, describe: c => `lx ${c.lx}, ly ${c.ly}, u ${c.u}`, diagnose: diagnoseAcc },
      explainChoice: {
        prompt: 'Why do samplers work with log densities at all?',
        options: [
          { text: 'Posterior densities of many data points are products of many small numbers that underflow to 0; their logs are sums that stay representable, and the ratio becomes a difference.', correct: true },
          { text: 'Because the logarithm makes the acceptance probability larger.', feedback: 'The decision is the same either way — when done correctly.' },
          { text: 'Because densities can be negative.', feedback: 'Densities are never negative.' },
          { text: 'To remove the normalizer.', feedback: 'The normalizer cancels in the ratio with or without logs.' },
        ],
        rightFeedback: 'Every serious sampler works in log space.',
      },
    },
    {
      id: 'implement', kind: 'function', title: 'R̂ from several chains',
      prompt: 'Write `rhat` from its contract.',
      starter: `import numpy as np

def rhat(chains):
    """chains: an (m, n) array, m chains of n draws of one quantity.
    W = mean of the within-chain variances (ddof=1); B = n x variance of the chain means (ddof=1);
    return sqrt(((n - 1) / n * W + B / n) / W).

    Example: two chains centred at -2 and 2 give R-hat far above 1.
    """
    pass   # replace with your code`,
      hint: 'chains.var(axis=1, ddof=1).mean() is W; n * chains.mean(axis=1).var(ddof=1) is B.',
      solution: 'm, n = chains.shape\nW = chains.var(axis=1, ddof=1).mean()\nB = n * chains.mean(axis=1).var(ddof=1)\nreturn np.sqrt(((n - 1) / n * W + B / n) / W)',
      check: { fn: 'rhat', args: ['chains'], cases: RHAT_CASES, describe: c => `${c.chains.length} chains of ${c.chains[0].length}`, diagnose: diagnoseRhat },
    },
    { id: 'transfer', kind: 'transfer', title: 'Solve new problems', prompt: 'New estimates, proposals and chains. Solve one of each kind without opening the worked answer.' },
    { id: 'review', kind: 'review', title: 'Come back later', prompt: 'A fresh problem after a gap. The first return is suggested a day after you finish step 6; “Do it now” is always there and is recorded as early.' },
  ],
}
