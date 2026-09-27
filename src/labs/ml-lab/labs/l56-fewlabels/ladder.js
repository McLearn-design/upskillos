import { rng, r3, needVars } from '../../kit/ladder.js'

// Lab 56 practice ladder: propagation, querying, InfoNCE and agreement arithmetic by hand; a neighbour graph too
// sparse to carry labels; the uncertainty query, the InfoNCE loss and Cohen's kappa in code.

export const queryOf = probs => probs.reduce((b, p, i) => (Math.abs(p - 0.5) < Math.abs(probs[b] - 0.5) ? i : b), 0)
export function infoNceOf(Z, tau) {
  const N2 = Z.length, N = N2 / 2, U = Z.map(z => { const n = Math.hypot(...z); return z.map(v => v / n) })
  let loss = 0
  for (let i = 0; i < N2; i++) {
    const s = U.map((u, j) => (j === i ? -Infinity : u.reduce((a, v, k) => a + v * U[i][k], 0) / tau)), m = Math.max(...s)
    loss += -(s[(i + N) % N2] - m) + Math.log(s.reduce((a, v) => a + Math.exp(v - m), 0))
  }
  return loss / N2
}
export function kappaOf(a, b) {
  const n = a.length, po = a.filter((v, i) => v === b[i]).length / n, pa = a.filter(v => v === 1).length / n, pb = b.filter(v => v === 1).length / n
  const pe = pa * pb + (1 - pa) * (1 - pb)
  return (po - pe) / (1 - pe)
}

const QUERY_CASES = [{ probs: [0.9, 0.55, 0.2, 0.35] }, { probs: [0.49, 0.1, 0.95] }, { probs: [0.02, 0.98, 0.3, 0.62, 0.7] }].map(c => ({ ...c, expected: queryOf(c.probs) }))
export const NCE_CASES = [
  { Z: [[1, 0], [0, 1], [1, 0], [0, 1]], tau: 1 },
  { Z: [[1, 2], [3, -1], [1, 1.5], [2.5, -1]], tau: 0.5 },
  { Z: [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0.9, 0.1, 0], [0.1, 0.8, 0.1], [0, 0.2, 1]], tau: 0.3 },
].map(c => ({ ...c, expected: infoNceOf(c.Z, c.tau) }))
export const KAPPA_CASES = [
  { a: [1, 1, 0, 0, 1, 0, 1, 1, 0, 0], b: [1, 1, 0, 1, 1, 0, 1, 0, 0, 0] },
  { a: [1, 1, 1, 1, 0], b: [1, 1, 1, 0, 0] },
  { a: [0, 1, 0, 1, 1, 1, 0, 0], b: [1, 1, 0, 1, 1, 0, 0, 1] },
].map(c => ({ ...c, expected: kappaOf(c.a, c.b) }))

const num = v => (Array.isArray(v) && v.length === 1 ? Number(v[0]) : Number(v))
const close = (a, b) => Math.abs(a - b) < 1e-6
export function diagnoseQuery(c, got) {
  const v = num(got.value)
  if (v === c.probs.reduce((b, p, i) => (Math.abs(p - 0.5) > Math.abs(c.probs[b] - 0.5) ? i : b), 0)) return 'That is the point the model is most sure about. Query the one whose probability is closest to 0.5: np.argmin.'
  if (v === c.probs.indexOf(Math.min(...c.probs))) return 'That is the point most confidently in class 0. Measure distance from 0.5: np.abs(probs - 0.5).'
  return null
}
function nceWithSelf(Z, tau) {
  const N2 = Z.length, N = N2 / 2, U = Z.map(z => { const n = Math.hypot(...z); return z.map(v => v / n) })
  let loss = 0
  for (let i = 0; i < N2; i++) { const s = U.map(u => u.reduce((a, v, k) => a + v * U[i][k], 0) / tau), m = Math.max(...s); loss += -(s[(i + N) % N2] - m) + Math.log(s.reduce((a, v) => a + Math.exp(v - m), 0)) }
  return loss / N2
}
export function diagnoseNce(c, got) {
  const v = num(got.value)
  if (close(v, nceWithSelf(c.Z, c.tau))) return 'Each view is still compared with itself. Its self-similarity (always 1/τ) must be excluded from the denominator: set the diagonal to −∞ before the softmax.'
  return null
}
export function diagnoseKappa(c, got) {
  const v = num(got.value), po = c.a.filter((x, i) => x === c.b[i]).length / c.a.length
  if (close(v, po)) return 'That is the raw agreement p_o. Subtract the agreement expected by chance: κ = (p_o − p_e)/(1 − p_e).'
  if (close(v, (po - 0.5) / 0.5)) return 'Chance agreement is not always 0.5: p_e = p_a·p_b + (1 − p_a)(1 − p_b), from how often each annotator says 1.'
  return null
}
export function evaluateGraph(vars) {
  const miss = needVars(vars, ['reached', 'accuracy', 'k'])
  if (miss) return { passed: false, message: miss }
  const re = Number(vars.reached.value), a = Number(vars.accuracy.value)
  if (re < 0.99) return { passed: false, message: `Only ${r3(re)} of the pool received any label score, so accuracy is ${r3(a)}: with 2 neighbours per point the graph falls apart into small islands, and labels cannot travel between them. Set \`k = 10\` and run again.` }
  return { passed: true, message: `Every point is reached, and ${r3(a)} of the pool is labelled correctly from two labels: the graph now connects each moon end to end without bridging the gap.` }
}

// ---------- Fresh problems ----------
export const TEMPLATES = ['kappa', 'query', 'nce']
export function generate(template, seed) {
  const g = rng(seed * 373 + TEMPLATES.indexOf(template) * 4457 + 179)
  if (template === 'kappa') { const po = g.pick([0.7, 0.8, 0.85, 0.9, 0.95]), pe = g.pick([0.5, 0.6, 0.68]), answer = (po - pe) / (1 - pe); return { template, seed, po, pe, answer, misconceptions: [{ answer: po - pe, feedback: 'Divide by 1 − p_e: κ is scaled so that perfect agreement gives 1.' }].filter(m => Math.abs(m.answer - answer) > 0.0006) } }
  if (template === 'query') { const probs = g.shuffle([g.pick([0.05, 0.1, 0.15]), g.pick([0.3, 0.35]), g.pick([0.58, 0.62]), g.pick([0.8, 0.9])]); const i = queryOf(probs); return { template, seed, probs, answer: probs[i], misconceptions: [{ answer: Math.min(...probs), feedback: 'That point is the most confidently class 0. Uncertainty sampling wants the probability closest to 0.5.' }] } }
  const N = g.pick([16, 32, 64, 128, 256]); return { template, seed, N, answer: 2 * N - 1, misconceptions: [{ answer: 2 * N, feedback: 'A view is never its own candidate: 2N − 1.' }, { answer: N - 1, feedback: 'Both views of every other image are candidates, plus the partner: 2N − 1.' }] }
}
export function view(p) {
  if (p.template === 'kappa') return { intro: `Two annotators agree on ${Math.round(100 * p.po)}% of items; their chance agreement is ${Math.round(100 * p.pe)}%.`, questions: [{ id: 'k', type: 'number', label: 'Cohen’s κ? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  if (p.template === 'query') return { intro: `A model gives four pool points the class-1 probabilities ${p.probs.join(', ')}.`, questions: [{ id: 'q', type: 'number', label: 'Uncertainty sampling queries one. Type its probability.', answer: p.answer, tolerance: 1e-9, misconceptions: p.misconceptions }] }
  return { intro: `A contrastive batch holds ${p.N} images, two augmented views each.`, questions: [{ id: 'n', type: 'number', label: 'Out of how many candidates must each view pick its partner?', answer: p.answer, misconceptions: p.misconceptions }] }
}
export function workedSolution(p) {
  if (p.template === 'kappa') return `(${p.po} − ${p.pe}) / (1 − ${p.pe}) = **${r3(p.answer)}**.`
  if (p.template === 'query') return `Distances from 0.5: ${p.probs.map(v => r3(Math.abs(v - 0.5))).join(', ')}. The smallest belongs to **${p.answer}**.`
  return `2 × ${p.N} − 1 = **${p.answer}**: every view in the batch except itself.`
}

export const fewlabels = {
  title: 'Learning from few labels: graphs, queries and contrast',
  version: 1,
  templates: TEMPLATES,
  templateNames: { kappa: 'Annotator agreement', query: 'Uncertainty query', nce: 'Contrastive candidates' },
  generate, view, workedSolution,
  intro: 'Seven steps: propagation, querying, contrastive and agreement arithmetic by hand, a neighbour graph that strands the labels, and writing the uncertainty query, the InfoNCE loss and Cohen’s κ. Nothing here locks the rest of the lab.',
  steps: [
    {
      id: 'trace', kind: 'trace', title: 'Few-label arithmetic by hand',
      prompt: 'An unlabelled point’s three neighbours have normalized weights 0.5, 0.3, 0.2 and class-1 scores 1, 0, 1 (α = 1). A model gives pool points the probabilities 0.8, 0.45 and 0.1. A contrastive batch holds 32 images. Two annotators agree on 85% of items with chance agreement 50%.',
      fields: [
        { label: 'Class-1 score after one propagation step', answer: 0.7, tolerance: 1e-9 },
        { label: 'Probability of the point uncertainty sampling queries', answer: 0.45, tolerance: 1e-9 },
        { label: 'Candidates each view picks its partner from', answer: 63 },
        { label: 'Cohen’s κ', answer: 0.7, tolerance: 1e-9 },
      ],
      explain: '0.5 × 1 + 0.3 × 0 + 0.2 × 1 = 0.7. |0.45 − 0.5| = 0.05 is the smallest. 2 × 32 − 1 = 63. (0.85 − 0.5)/(1 − 0.5) = 0.7.',
    },
    {
      id: 'agree', kind: 'probe', title: 'A graph that holds together',
      prompt: 'Label propagation from one label per class on the two moons, with a neighbour graph of k = 2. Run it: most of the pool is never reached. **Set `k = 10`** and run again.',
      starter: `import numpy as np
rng = np.random.default_rng(56); n = 400; c = np.arange(n) % 2; t = np.pi * rng.random(n)
X = np.column_stack([np.where(c, 1 - np.cos(t), np.cos(t)), np.where(c, 0.5 - np.sin(t), np.sin(t))]) + 0.12 * rng.normal(size=(n, 2)); y = c
labelled = np.array([np.where(y == 0)[0][5], np.where(y == 1)[0][5]])          # one label per class

k = 2                     # neighbours per point in the graph
D = np.sqrt(((X[:, None] - X[None]) ** 2).sum(-1)); W = np.zeros_like(D)
for i in range(n):
    nb = np.argsort(D[i])[1:k + 1]; W[i, nb] = np.exp(-D[i, nb] ** 2 / (2 * 0.3 ** 2))
W = np.maximum(W, W.T); d = W.sum(1); S = W / np.sqrt(np.outer(d, d))
Y = np.zeros((n, 2)); Y[labelled, y[labelled]] = 1; F = Y.copy()
for _ in range(200): F = 0.99 * S @ F + 0.01 * Y
reached = float(np.mean(F.sum(1) > 1e-12))                                   # points that received any label score
accuracy = float(np.mean((F.argmax(1) == y)[F.sum(1) > 1e-12].tolist() + [0.5] * int(np.sum(F.sum(1) <= 1e-12))))   # unreached: a coin flip
print(f"k = {k}: {reached:.0%} of the pool reached; pool accuracy {accuracy:.3f} (unreached points count as coin flips)")`,
      probe: ['reached', 'accuracy', 'k'],
      evaluate: evaluateGraph,
      done: 'The graph encodes the manifold assumption. Too few neighbours and it breaks into islands; too many (or too wide a σ) and it bridges the gap between classes.',
    },
    {
      id: 'fill', kind: 'function', title: 'Fill in the uncertainty query',
      prompt: 'Replace `___` with the index of the pool point uncertainty sampling should query, given the model’s class-1 probabilities.',
      starter: `import numpy as np

def query(probs):
    """Index of the pool point whose probability is closest to 0.5."""
    return ___`,
      hint: 'int(np.argmin(np.abs(probs - 0.5))).',
      solution: 'return int(np.argmin(np.abs(probs - 0.5)))',
      check: { fn: 'query', args: ['probs'], cases: QUERY_CASES, describe: c => `${c.probs.length} pool points`, diagnose: diagnoseQuery },
    },
    {
      id: 'repair', kind: 'function', title: 'Repair a planted bug',
      prompt: 'Two images, two views each, embeddings (1, 0), (0, 1), (1, 0), (0, 1) with τ = 1: every view matches its partner exactly. This InfoNCE returns **1.006**; it should return 0.551. Fix it.',
      starter: `import numpy as np

def info_nce(Z, tau):
    """Rows i and i + N of Z are two views of the same image. Mean over all 2N views of -log softmax(partner)."""
    N2 = len(Z); N = N2 // 2
    U = Z / np.linalg.norm(Z, axis=1, keepdims=True)
    S = U @ U.T / tau
    pos = (np.arange(N2) + N) % N2
    S = S - S.max(axis=1, keepdims=True)
    P = np.exp(S) / np.exp(S).sum(axis=1, keepdims=True)
    return float(-np.mean(np.log(P[np.arange(N2), pos])))`,
      hint: 'What is a view’s similarity with itself, and should it be a candidate?',
      solution: 'S = U @ U.T / tau\nnp.fill_diagonal(S, -np.inf)',
      check: { fn: 'info_nce', args: ['Z', 'tau'], cases: NCE_CASES, describe: c => `${c.Z.length} views, τ = ${c.tau}`, diagnose: diagnoseNce },
      explainChoice: {
        prompt: 'Why must a view not be its own candidate?',
        options: [
          { text: 'Its cosine similarity with itself is always the maximum, 1/τ, whatever the encoder does. It adds a fixed rival to every denominator, so the loss can never approach 0 and the task no longer measures matching the partner.', correct: true },
          { text: 'It makes the loss negative.', feedback: 'The loss stays positive; it just cannot fall as far.' },
          { text: 'It doubles the batch size.', feedback: 'It adds one candidate per row, not a whole batch.' },
          { text: 'Only because it is slower to compute.', feedback: 'The cost is the same; the objective is wrong.' },
        ],
        rightFeedback: 'SimCLR’s NT-Xent loss masks exactly this diagonal.',
      },
    },
    {
      id: 'implement', kind: 'function', title: 'Cohen’s κ',
      prompt: 'Write `cohen_kappa` from its contract.',
      starter: `import numpy as np

def cohen_kappa(a, b):
    """Agreement between two annotators' 0/1 labels beyond chance: (p_o - p_e) / (1 - p_e),
    where p_e = p_a p_b + (1 - p_a)(1 - p_b) and p_a, p_b are the shares of 1s each annotator gave.

    Example: cohen_kappa([1, 1, 1, 1, 0], [1, 1, 1, 0, 0])  ->  0.5455  (rounded)
    """
    pass   # replace with your code`,
      hint: 'po = np.mean(a == b); pa, pb = a.mean(), b.mean().',
      solution: 'po = np.mean(a == b); pa, pb = a.mean(), b.mean()\npe = pa * pb + (1 - pa) * (1 - pb)\nreturn (po - pe) / (1 - pe)',
      check: { fn: 'cohen_kappa', args: ['a', 'b'], ints: ['a', 'b'], cases: KAPPA_CASES, describe: c => `${c.a.length} items`, diagnose: diagnoseKappa },
    },
    { id: 'transfer', kind: 'transfer', title: 'Solve new problems', prompt: 'New annotators, pools and batches. Solve one of each kind without opening the worked answer.' },
    { id: 'review', kind: 'review', title: 'Come back later', prompt: 'A fresh problem after a gap. The first return is suggested a day after you finish step 6; “Do it now” is always there and is recorded as early.' },
  ],
}
