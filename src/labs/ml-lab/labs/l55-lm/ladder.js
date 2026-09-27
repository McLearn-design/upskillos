import { rng, r3, needVars } from '../../kit/ladder.js'

// Lab 55 practice ladder: chain rule, bits, perplexity and LoRA counts by hand; a zero probability on held-out text;
// perplexity, top-p filtering and the DPO loss in code.

export const perplexityOf = probs => 2 ** (probs.reduce((s, p) => s - Math.log2(p), 0) / probs.length)
export function topPOf(probs, p) {
  const order = probs.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]), keep = new Array(probs.length).fill(false)
  let before = 0
  for (const [v, i] of order) { if (before < p) keep[i] = true; before += v }
  const out = probs.map((v, i) => (keep[i] ? v : 0)), s = out.reduce((a, b) => a + b, 0)
  return out.map(v => v / s)
}
const softplus = v => Math.max(v, 0) + Math.log1p(Math.exp(-Math.abs(v)))
export const dpoOf = (pw, rw, pl, rl, beta) => softplus(-beta * ((pw - rw) - (pl - rl)))

const PPL_CASES = [{ probs: [0.5, 0.25, 0.125] }, { probs: [0.9] }, { probs: [0.2, 0.2, 0.05, 0.6] }].map(c => ({ ...c, expected: perplexityOf(c.probs) }))
export const TOPP_CASES = [
  { probs: [0.5, 0.3, 0.2], p: 0.6 },
  { probs: [0.1, 0.6, 0.3], p: 0.65 },
  { probs: [0.05, 0.15, 0.7, 0.1], p: 0.9 },
].map(c => ({ ...c, expected: topPOf(c.probs, c.p) }))
export const DPO_CASES = [
  { pw: -10, rw: -10.4, pl: -12, rl: -11.8, beta: 1 },
  { pw: -5, rw: -5, pl: -5, rl: -5, beta: 0.5 },
  { pw: -20, rw: -23, pl: -30, rl: -26, beta: 0.1 },
].map(c => ({ ...c, expected: dpoOf(c.pw, c.rw, c.pl, c.rl, c.beta) }))

const num = v => (Array.isArray(v) && v.length === 1 ? Number(v[0]) : Number(v))
const close = (a, b) => Math.abs(a - b) < 1e-6
const nearArr = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => close(v, b[i]))
export function diagnosePpl(c, got) {
  const v = num(got.value), bits = c.probs.reduce((s, p) => s - Math.log2(p), 0) / c.probs.length
  if (close(v, bits)) return 'That is bits per token. Perplexity is 2 to that power.'
  if (close(v, 2 ** (bits * c.probs.length))) return 'Average −log₂ p over the tokens before exponentiating; do not sum.'
  if (close(v, 2 ** (bits * Math.LN2)) || close(v, Math.exp(bits))) return 'Keep one base: 2 ** mean(−log₂ p), or equally exp(mean(−ln p)).'
  return null
}
export function diagnoseTopP(c, got) {
  const order = c.probs.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]); let cum = 0; const keep = new Array(c.probs.length).fill(false)
  for (const [v, i] of order) { cum += v; if (cum < c.p) keep[i] = true }
  const s = c.probs.reduce((a, v, i) => a + (keep[i] ? v : 0), 0)
  if (s > 0 && nearArr(got.value, c.probs.map((v, i) => (keep[i] ? v / s : 0)))) return 'The token that carries the total past p must be kept too: keep a token while the sum of the tokens before it is still below p.'
  return null
}
export function diagnoseDpo(c, got) {
  const v = num(got.value), m = (c.pw - c.rw) - (c.pl - c.rl)
  if (close(v, softplus(c.beta * m))) return 'The sign is flipped: the loss is −log σ(margin), which falls as the preferred answer gains on the rejected one.'
  if (close(v, softplus(-m)) && c.beta !== 1) return 'Multiply the margin by β.'
  if (close(v, c.beta * m) || close(v, m)) return 'That is the margin itself; the loss is −log σ(β · margin) = np.logaddexp(0, −β · margin).'
  return null
}
export function evaluateSmoothing(vars) {
  const miss = needVars(vars, ['bits', 'k', 'V'])
  if (miss) return { passed: false, message: miss }
  const b = Number(vars.bits.value), V = Number(vars.V.value)
  if (b >= 99) return { passed: false, message: 'Perplexity is infinite: “rat” puts characters after contexts the training text never showed, so the raw counts give them probability 0 — and one zero makes the whole product zero. Set `k = 0.1` and run again.' }
  return { passed: true, message: `${r3(b)} bits per character, perplexity ${r3(2 ** b)} — far below ${V} for uniform guessing, and finite: add-k gave every unseen pair a little probability.` }
}

// ---------- Fresh problems ----------
export const TEMPLATES = ['perplexity', 'addk', 'lora']
export function generate(template, seed) {
  const g = rng(seed * 367 + TEMPLATES.indexOf(template) * 4451 + 173)
  if (template === 'perplexity') { const bits = g.pick([1, 1.5, 2, 2.5, 3, 4]), answer = 2 ** bits; return { template, seed, bits, answer, misconceptions: [{ answer: bits * bits, feedback: 'Perplexity is 2^bits, not bits squared.' }, { answer: Math.exp(bits), feedback: 'Bits are base 2: use 2^bits, not e^bits.' }].filter(m => Math.abs(m.answer - answer) > 0.006) } }
  if (template === 'addk') { const c = g.pick([0, 1, 3, 7]), N = g.pick([10, 20, 40]), V = g.pick([26, 28, 30]), k = g.pick([0.1, 0.5, 1]), answer = (c + k) / (N + k * V); return { template, seed, c, N, V, k, answer, misconceptions: [{ answer: (c + k) / (N + k), feedback: 'Add k for every one of the V possible continuations: the denominator is N + kV.' }].filter(m => Math.abs(m.answer - answer) > 0.0006) } }
  const d = g.pick([512, 1024, 2048, 4096]), r = g.pick([2, 4, 8, 16]); return { template, seed, d, r, answer: 2 * r * d, misconceptions: [{ answer: r * d, feedback: 'Both A (r × d) and B (d × r) are trained.' }] }
}
export function view(p) {
  if (p.template === 'perplexity') return { intro: `A language model averages ${p.bits} bits per token on held-out text.`, questions: [{ id: 'p', type: 'number', label: 'What is its perplexity? (Two decimals.)', answer: p.answer, tolerance: 0.006, misconceptions: p.misconceptions }] }
  if (p.template === 'addk') return { intro: `A context occurred ${p.N} times and was followed by the character “e” ${p.c} time${p.c === 1 ? '' : 's'}. The vocabulary has ${p.V} characters; k = ${p.k}.`, questions: [{ id: 'a', type: 'number', label: 'Add-k probability of “e” after this context? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  return { intro: `LoRA with rank ${p.r} on one ${p.d} × ${p.d} weight matrix.`, questions: [{ id: 'l', type: 'number', label: 'How many trainable parameters?', answer: p.answer, misconceptions: p.misconceptions }] }
}
export function workedSolution(p) {
  if (p.template === 'perplexity') return `2^${p.bits} = **${r3(p.answer)}**.`
  if (p.template === 'addk') return `(${p.c} + ${p.k}) / (${p.N} + ${p.k} × ${p.V}) = ${r3(p.c + p.k)} / ${r3(p.N + p.k * p.V)} = **${r3(p.answer)}**.`
  return `A has ${p.r} × ${p.d} and B has ${p.d} × ${p.r}: 2 × ${p.r} × ${p.d} = **${p.answer.toLocaleString('en-US')}**.`
}

export const lm = {
  title: 'Language models: probabilities, filters and preferences',
  version: 1,
  templates: TEMPLATES,
  templateNames: { perplexity: 'Perplexity from bits', addk: 'Add-k probability', lora: 'LoRA parameters' },
  generate, view, workedSolution,
  intro: 'Seven steps: chain-rule and LoRA arithmetic by hand, a held-out text with an unseen pair, and writing perplexity, top-p filtering and the DPO loss. Nothing here locks the rest of the lab.',
  steps: [
    {
      id: 'trace', kind: 'trace', title: 'Probabilities and parameters by hand',
      prompt: 'A model gives p(a) = 0.5 and p(b | a) = 0.4. On a held-out text it assigns 0.5 and 0.125 to the two actual next characters. LoRA with rank 16 adapts a 512 × 512 matrix.',
      fields: [
        { label: 'p(“ab”)', answer: 0.2, tolerance: 1e-9 },
        { label: 'Bits per character on the held-out text', answer: 2, tolerance: 1e-9 },
        { label: 'Its perplexity', answer: 4, tolerance: 1e-9 },
        { label: 'LoRA trainable parameters', answer: 16384 },
      ],
      explain: 'Chain rule: 0.5 × 0.4 = 0.2. (1 + 3)/2 = 2 bits. 2² = 4. 2 × 16 × 512 = 16,384.',
    },
    {
      id: 'agree', kind: 'probe', title: 'One unseen pair',
      prompt: 'A bigram character model is trained on three short sentences and scored on a new one. Run it: the perplexity is infinite. **Set `k = 0.1`** and run again.',
      starter: `import numpy as np
train = "the cat sat on the mat. the dog sat on the log. the cat saw the dog on the mat."
test = "the rat sat on the log."
vocab = sorted(set(train + test)); V = len(vocab)

k = 0.0                   # add-k smoothing: 0 = raw counts (maximum likelihood)
pairs, ctx = {}, {}
for a, b in zip(train, train[1:]): pairs[a, b] = pairs.get((a, b), 0) + 1; ctx[a] = ctx.get(a, 0) + 1
def p(a, b):
    den = ctx.get(a, 0) + k * V
    return (pairs.get((a, b), 0) + k) / den if den else 0.0      # an unseen context with k = 0 gives probability 0
probs = np.array([p(a, b) for a, b in zip(test, test[1:])])
with np.errstate(divide='ignore'): bits = float(np.mean(-np.log2(probs)))
bits = min(bits, 99.0)    # 99 stands for infinity
unseen = sum(pairs.get((a, b), 0) == 0 for a, b in zip(test, test[1:]))
print(f"k = {k}: {unseen} held-out pairs never seen in training; {bits:.3f} bits per character; perplexity {'infinite' if bits >= 99 else round(2 ** bits, 2)} (uniform over {V}: {V})")`,
      probe: ['bits', 'k', 'V'],
      evaluate: evaluateSmoothing,
      done: 'Every real language model reserves some probability for what it has not seen — smoothing for counts, a softmax for networks.',
    },
    {
      id: 'fill', kind: 'function', title: 'Fill in perplexity',
      prompt: 'Replace `___` with the perplexity of a model that gave the actual next tokens the probabilities `probs`.',
      starter: `import numpy as np

def perplexity(probs):
    """2 to the power of the average -log2 probability of the actual next tokens."""
    return ___`,
      hint: '2 ** np.mean(-np.log2(probs)).',
      solution: 'return 2 ** np.mean(-np.log2(probs))',
      check: { fn: 'perplexity', args: ['probs'], cases: PPL_CASES, describe: c => `${c.probs.length} token(s)`, diagnose: diagnosePpl },
    },
    {
      id: 'repair', kind: 'function', title: 'Repair a planted bug',
      prompt: 'For probabilities (0.5, 0.3, 0.2) and p = 0.6, this top-p filter keeps only the first token and returns **(1, 0, 0)**. The nucleus is the smallest set whose total reaches 0.6, so it should return (0.625, 0.375, 0). Fix it.',
      starter: `import numpy as np

def top_p(probs, p):
    """Keep the smallest set of most likely tokens whose total probability reaches p; renormalize."""
    order = np.argsort(-probs); cum = np.cumsum(probs[order])
    keep = np.zeros(len(probs), bool); keep[order[cum < p]] = True
    out = np.where(keep, probs, 0.0)
    return out / out.sum()`,
      hint: 'Which token carries the running total past p? Is it kept?',
      solution: 'keep[order[cum - probs[order] < p]] = True',
      check: { fn: 'top_p', args: ['probs', 'p'], cases: TOPP_CASES, describe: c => `${c.probs.length} tokens, p = ${c.p}`, diagnose: diagnoseTopP },
      explainChoice: {
        prompt: 'What else goes wrong with `cum < p`?',
        options: [
          { text: 'If the single most likely token already has probability ≥ p, nothing is kept at all, and the renormalization divides by zero.', correct: true },
          { text: 'It keeps too many tokens.', feedback: 'It keeps too few: the token that reaches p is dropped.' },
          { text: 'It changes the order of the tokens.', feedback: 'The order only decides which tokens are considered first.' },
          { text: 'Nothing: the bug only matters for ties.', feedback: 'The example has no ties and still fails.' },
        ],
        rightFeedback: 'Top-p must always keep at least one token; testing the sum *before* each token guarantees it.',
      },
    },
    {
      id: 'implement', kind: 'function', title: 'The DPO loss',
      prompt: 'Write `dpo_loss` from its contract.',
      starter: `import numpy as np

def dpo_loss(logp_w, ref_w, logp_l, ref_l, beta):
    """-log sigmoid(beta * [(logp_w - ref_w) - (logp_l - ref_l)]) for one preference pair.

    logp_w, logp_l: the policy's log-probabilities of the preferred (w) and rejected (l) responses;
    ref_w, ref_l: the same under the frozen reference model.
    Example: dpo_loss(-10, -10.4, -12, -11.8, 1)  ->  0.4375  (rounded; the margin is 0.6)
    """
    pass   # replace with your code`,
      hint: 'margin = beta * ((logp_w - ref_w) - (logp_l - ref_l)); −log σ(m) = np.logaddexp(0, −m).',
      solution: 'margin = beta * ((logp_w - ref_w) - (logp_l - ref_l))\nreturn np.logaddexp(0, -margin)',
      check: { fn: 'dpo_loss', args: ['pw', 'rw', 'pl', 'rl', 'beta'], cases: DPO_CASES, describe: c => `β = ${c.beta}`, diagnose: diagnoseDpo },
    },
    { id: 'transfer', kind: 'transfer', title: 'Solve new problems', prompt: 'New models, counts and adapters. Solve one of each kind without opening the worked answer.' },
    { id: 'review', kind: 'review', title: 'Come back later', prompt: 'A fresh problem after a gap. The first return is suggested a day after you finish step 6; “Do it now” is always there and is recorded as early.' },
  ],
}
