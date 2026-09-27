import { rng, r3, needVars } from '../../kit/ladder.js'

// Lab 46 practice ladder: entropy, compression, log-loss, MI and perplexity by hand; a shuffled baseline for MI;
// KL divergence, entropy in bits and perplexity in code.

const l2 = Math.log2
export const klOf = (p, q) => p.reduce((s, v, i) => s + (v > 0 ? v * l2(v / q[i]) : 0), 0)
export const entropyOf = p => -p.reduce((s, v) => s + (v > 0 ? v * l2(v) : 0), 0)
export const pplOf = probs => 2 ** (-probs.reduce((s, v) => s + l2(v), 0) / probs.length)

const KL_CASES = [{ p: [0.5, 0.5], q: [0.75, 0.25] }, { p: [0.5, 0.25, 0.125, 0.125], q: [0.25, 0.25, 0.25, 0.25] }, { p: [0.2, 0.8], q: [0.2, 0.8] }, { p: [0.9, 0.1], q: [0.5, 0.5] }].map(c => ({ ...c, expected: klOf(c.p, c.q) }))
const ENT_CASES = [{ p: [0.5, 0.5] }, { p: [0.5, 0.25, 0.125, 0.125] }, { p: [1, 0, 0] }, { p: [0.4, 0.3, 0.2, 0.1] }].map(c => ({ ...c, expected: entropyOf(c.p) }))
export const PPL_CASES = [{ probs: [0.5, 0.5, 0.5] }, { probs: [0.25, 0.125, 0.5, 0.25] }, { probs: [1 / 27, 1 / 27] }, { probs: [0.9, 0.01, 0.6] }].map(c => ({ ...c, expected: pplOf(c.probs) }))

export function diagnoseKl(c, got) {
  const rev = klOf(c.q, c.p)
  if (Math.abs(got.value - rev) < 1e-9 && Math.abs(rev - c.expected) > 1e-9) return 'That is KL(q ‖ p). The average is taken under p: Σ p log(p/q).'
  const nat = c.expected * Math.LN2
  if (Math.abs(got.value - nat) < 1e-9 && c.expected !== 0) return 'That is in nats. Use log base 2 for bits.'
  return null
}
export function diagnoseEnt(c, got) {
  if (Math.abs(got.value - c.expected * Math.LN2) < 1e-9 && c.expected !== 0) return 'np.log is the natural logarithm, giving nats. Bits need np.log2.'
  return null
}
export function diagnosePpl(c, got) {
  const h = -c.probs.reduce((s, v) => s + l2(v), 0) / c.probs.length
  if (Math.abs(got.value - h) < 1e-9) return 'That is the cross-entropy in bits. Perplexity is 2 raised to it.'
  if (Math.abs(got.value - Math.exp(h)) < 1e-9) return 'Match the base: with bits, perplexity is 2^H, not e^H.'
  return null
}
export function evaluateMi(vars) {
  const miss = needVars(vars, ['mi', 'baseline', 'excess'])
  if (miss) return { passed: false, message: miss }
  const m = Number(vars.mi.value), b = Number(vars.baseline.value)
  if (b === 0) return { passed: false, message: `The estimate says ${r3(m)} bits of shared information between two independent variables. With 300 points in 20 × 20 bins, random clumps look like dependence. Set \`compare_to_shuffled = 1\` and run again.` }
  return { passed: true, message: `Shuffled baseline ${r3(b)} bits: almost all of the ${r3(m)} was estimator bias. Report MI as its excess over a shuffled baseline (${r3(Number(vars.excess.value))}), or use fewer bins or a nearest-neighbour estimator.` }
}

// ---------- Fresh problems ----------
export const TEMPLATES = ['uniform', 'logloss', 'perplexity']
export function generate(template, seed) {
  const g = rng(seed * 293 + TEMPLATES.indexOf(template) * 4283 + 127)
  if (template === 'uniform') { const K = g.pick([2, 4, 8, 16, 32, 10]); return { template, seed, K, answer: l2(K), misconceptions: [{ answer: Math.log(K), feedback: 'That is in nats; use log base 2 for bits.' }] } }
  if (template === 'logloss') { const q = g.pick([0.5, 0.25, 0.125, 0.8, 0.1, 0.01]); return { template, seed, q, answer: -l2(q), misconceptions: [{ answer: 1 - q, feedback: 'Log-loss is −log₂ q, not 1 − q.' }].filter(m => Math.abs(m.answer - -l2(q)) > 0.006) } }
  const a = g.pick([8, 16, 32, 64, 100]), b = g.pick([2, 4, 8].filter(v => v < a)); return { template, seed, a, b, answer: l2(a) - l2(b), misconceptions: [{ answer: a - b, feedback: 'Perplexity is 2^H: compare log₂ of the perplexities.' }] }
}
export function view(p) {
  if (p.template === 'uniform') return { intro: `A source has ${p.K} equally likely outcomes.`, questions: [{ id: 'h', type: 'number', label: 'What is its entropy in bits? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  if (p.template === 'logloss') return { intro: `A model gives the true class probability ${p.q}.`, questions: [{ id: 'l', type: 'number', label: 'What is its log-loss on that example, in bits? (Two decimals.)', answer: p.answer, tolerance: 0.006, misconceptions: p.misconceptions }] }
  return { intro: `A language model’s perplexity drops from ${p.a} to ${p.b}.`, questions: [{ id: 'p', type: 'number', label: 'By how many bits per token did its cross-entropy fall? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
}
export function workedSolution(p) {
  if (p.template === 'uniform') return `log₂ ${p.K} = **${r3(p.answer)}**.`
  if (p.template === 'logloss') return `−log₂ ${p.q} = **${Math.round(p.answer * 100) / 100}**.`
  return `log₂ ${p.a} − log₂ ${p.b} = **${r3(p.answer)}**.`
}

export const info = {
  title: 'Information: entropy, KL and perplexity',
  version: 1,
  templates: TEMPLATES,
  templateNames: { uniform: 'Entropy of a uniform source', logloss: 'Log-loss in bits', perplexity: 'Perplexity and bits' },
  generate, view, workedSolution,
  intro: 'Seven steps: information arithmetic by hand, an honest MI estimate, and writing KL divergence, entropy in bits and perplexity. Nothing here locks the rest of the lab.',
  steps: [
    {
      id: 'trace', kind: 'trace', title: 'Information arithmetic by hand',
      prompt: 'An 8-sided fair die. A source with entropy 2.3 bits per symbol. A model giving the true class 0.25. H(Y) = 0.9 and H(Y | X) = 0.6 bits.',
      fields: [
        { label: 'Entropy of the die (bits)', answer: 3 },
        { label: 'Minimum bits for 1,000 symbols', answer: 2300 },
        { label: 'Log-loss of the example (bits)', answer: 2, tolerance: 1e-9 },
        { label: 'I(X; Y) (bits)', answer: 0.3, tolerance: 1e-9 },
      ],
      explain: 'log₂ 8 = 3. 1,000 × 2.3 = 2,300. −log₂ 0.25 = 2. 0.9 − 0.6 = 0.3.',
    },
    {
      id: 'agree', kind: 'probe', title: 'A shuffled baseline for MI',
      prompt: 'Two independent variables, 300 points, 20 × 20 bins. Run it: the estimate reports over a bit of mutual information. **Set `compare_to_shuffled = 1`** and run again.',
      starter: `import numpy as np
rng = np.random.default_rng(46)
x = rng.normal(size=300); y = rng.normal(size=300)          # truly independent: the true mutual information is 0

def mi_binned(x, y, bins=20):
    qx, qy = np.quantile(x, np.linspace(0, 1, bins + 1)), np.quantile(y, np.linspace(0, 1, bins + 1))
    J, _, _ = np.histogram2d(x, y, bins=[qx, qy]); P = J / J.sum()
    px, py = P.sum(1, keepdims=True), P.sum(0, keepdims=True); nz = P > 0
    return float(np.sum(P[nz] * np.log2(P[nz] / (px @ py)[nz])))

compare_to_shuffled = 0   # 1: also estimate MI after shuffling y, and report the excess over that baseline
mi = mi_binned(x, y)
baseline = float(np.mean([mi_binned(x, rng.permutation(y)) for _ in range(20)])) if compare_to_shuffled else 0.0
excess = mi - baseline
print(f"estimated MI {mi:.3f} bits; shuffled baseline {baseline:.3f}; excess over the baseline {excess:.3f}")`,
      probe: ['mi', 'baseline', 'excess'],
      evaluate: evaluateMi,
      done: 'The same shuffle test works for any dependence measure — and for feature importance (Lab 12).',
    },
    {
      id: 'fill', kind: 'function', title: 'Fill in KL divergence',
      prompt: 'Replace `___` with KL(p ‖ q) in bits (p and q have no zero entries here).',
      starter: `import numpy as np

def kl_bits(p, q):
    """The extra bits per outcome from coding p with a code built for q."""
    return ___`,
      hint: 'Σ p · log₂(p/q).',
      solution: 'return np.sum(p * np.log2(p / q))',
      check: { fn: 'kl_bits', args: ['p', 'q'], cases: KL_CASES, describe: c => `p (${c.p.join(', ')}), q (${c.q.join(', ')})`, diagnose: diagnoseKl },
    },
    {
      id: 'repair', kind: 'function', title: 'Repair a planted bug',
      prompt: 'For a fair coin this returns **0.693**; its entropy is 1 bit. Fix it.',
      starter: `import numpy as np

def entropy_bits(p):
    """Entropy in bits; outcomes with probability 0 contribute nothing."""
    p = p[p > 0]
    return -np.sum(p * np.log(p))`,
      hint: 'Which logarithm gives bits?',
      solution: 'return -np.sum(p * np.log2(p))',
      check: { fn: 'entropy_bits', args: ['p'], cases: ENT_CASES, describe: c => `p (${c.p.join(', ')})`, diagnose: diagnoseEnt },
      explainChoice: {
        prompt: 'Machine-learning libraries report losses in nats. Does the unit change which model wins?',
        options: [
          { text: 'No: nats and bits differ by the constant factor ln 2, so comparisons, gradients’ directions and optima are the same — only the numbers are scaled.', correct: true },
          { text: 'Yes: bits penalize confident mistakes more.', feedback: 'Both scale every loss by the same factor.' },
          { text: 'Yes: nats cannot be negative.', feedback: 'Neither can bits; both are non-negative for log-loss.' },
          { text: 'Only for more than two classes.', feedback: 'The factor is the same for any number of classes.' },
        ],
        rightFeedback: 'Just never mix units when comparing numbers — or computing perplexity (2^bits, e^nats).',
      },
    },
    {
      id: 'implement', kind: 'function', title: 'Perplexity',
      prompt: 'Write `perplexity` from its contract.',
      starter: `import numpy as np

def perplexity(probs):
    """probs[t] is the probability the model gave to the token that actually came next.
    Return 2 ** (mean of -log2 probs).

    Example: perplexity([0.5, 0.5, 0.5])  ->  2.0
    """
    pass   # replace with your code`,
      hint: 'Cross-entropy in bits per token, then 2 to that power.',
      solution: 'return 2 ** np.mean(-np.log2(probs))',
      check: { fn: 'perplexity', args: ['probs'], cases: PPL_CASES, describe: c => `probabilities (${c.probs.map(v => r3(v)).join(', ')})`, diagnose: diagnosePpl },
    },
    { id: 'transfer', kind: 'transfer', title: 'Solve new problems', prompt: 'New sources, predictions and models. Solve one of each kind without opening the worked answer.' },
    { id: 'review', kind: 'review', title: 'Come back later', prompt: 'A fresh problem after a gap. The first return is suggested a day after you finish step 6; “Do it now” is always there and is recorded as early.' },
  ],
}
