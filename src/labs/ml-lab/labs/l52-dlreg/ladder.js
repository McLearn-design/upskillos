import { rng, r3, needVars } from '../../kit/ladder.js'

// Lab 52 practice ladder: early stopping, decay, augmentation and residual arithmetic by hand; evaluation mode;
// inverted dropout, batch norm in evaluation mode and layer normalization in code.

export const dropOf = (h, mask, p) => h.map((row, i) => row.map((v, j) => v * mask[i][j] / (1 - p)))
export const bnEvalOf = (x, mu, v, gamma, beta, eps = 1e-5) => x.map(row => row.map((q, j) => gamma[j] * (q - mu[j]) / Math.sqrt(v[j] + eps) + beta[j]))
export const lnOf = (x, eps = 1e-5) => x.map(row => { const n = row.length, m = row.reduce((a, b) => a + b, 0) / n, v = row.reduce((s, q) => s + (q - m) ** 2, 0) / n; return row.map(q => (q - m) / Math.sqrt(v + eps)) })

const DROP_CASES = [
  { h: [[1, 2], [3, 4]], mask: [[1, 0], [1, 1]], p: 0.5 },
  { h: [[0.5, 1.5, 2]], mask: [[1, 1, 0]], p: 0.2 },
  { h: [[2, 2, 2, 2]], mask: [[0, 0, 0, 1]], p: 0.75 },
].map(c => ({ ...c, expected: dropOf(c.h, c.mask, c.p) }))
const BN_CASES = [
  { x: [[5, 1]], mu: [3, 0], v: [4, 1], gamma: [1, 1], beta: [0, 0] },
  { x: [[1, 2], [3, 4]], mu: [2, 2], v: [1, 4], gamma: [2, 1], beta: [0.5, -1] },
  { x: [[0, 0, 0]], mu: [1, -1, 0], v: [1, 1, 9], gamma: [1, 1, 1], beta: [0, 0, 0] },
].map(c => ({ ...c, expected: bnEvalOf(c.x, c.mu, c.v, c.gamma, c.beta) }))
export const LN_CASES = [{ x: [[1, 2, 3]] }, { x: [[2, 4, 6, 8], [1, 1, 1, 5]] }, { x: [[10, -10]] }].map(c => ({ ...c, expected: lnOf(c.x) }))

const near = (a, b, tol = 1e-6) => Array.isArray(a) && a.flat().length === b.flat().length && a.flat().every((v, i) => Math.abs(v - b.flat()[i]) < tol)
export function diagnoseDrop(c, got) {
  if (near(got.value, c.h.map((row, i) => row.map((v, j) => v * c.mask[i][j])))) return 'Scale the kept units by 1/(1 − p) so the expected activation is unchanged.'
  if (near(got.value, c.h.map((row, i) => row.map((v, j) => v * c.mask[i][j] * (1 - c.p))))) return 'Divide by (1 − p), not multiply: inverted dropout scales up during training.'
  return null
}
export function diagnoseBn(c, got) {
  const n = c.x.length, bm = c.x[0].map((_, j) => c.x.reduce((s, r) => s + r[j], 0) / n), bv = c.x[0].map((_, j) => c.x.reduce((s, r) => s + (r[j] - bm[j]) ** 2, 0) / n)
  if (near(got.value, bnEvalOf(c.x, bm, bv, c.gamma, c.beta))) return 'That uses the statistics of the batch in front of it — training mode. Evaluation uses the running mean and variance.'
  return null
}
export function diagnoseLn(c, got) {
  const n = c.x.length, cm = c.x[0].map((_, j) => c.x.reduce((s, r) => s + r[j], 0) / n)
  if (n > 1 && near(got.value, c.x.map(row => row.map((q, j) => q - cm[j])))) return 'Layer norm uses each example’s own features: take the mean and variance across axis 1 (the row).'
  return null
}
export function evaluateEval(vars) {
  const miss = needVars(vars, ['val_accuracy', 'spread', 'eval_mode'])
  if (miss) return { passed: false, message: miss }
  const a = Number(vars.val_accuracy.value), s = Number(vars.spread.value)
  if (s > 0) return { passed: false, message: `Accuracy ${r3(a)}, and it changes between prediction runs by ${r3(s)}: units are still being dropped at evaluation, so predictions are random and slightly worse. Set \`eval_mode = 1\` and run again.` }
  return { passed: true, message: `Accuracy ${r3(a)}, identical on every run: at evaluation nothing is dropped and, thanks to inverted dropout, nothing needs rescaling.` }
}

// ---------- Fresh problems ----------
export const TEMPLATES = ['stopping', 'decay', 'bn']
export function generate(template, seed) {
  const g = rng(seed * 337 + TEMPLATES.indexOf(template) * 4363 + 157)
  if (template === 'stopping') { const epochs = [50, 100, 150, 200, 300], base = g.pick([0.3, 0.4]), dip = g.pick([1, 2, 3]); const losses = epochs.map((e, i) => Math.round((base + 0.04 * Math.abs(i - dip) + (i > dip ? 0.03 * (i - dip) : 0)) * 100) / 100); const i = losses.indexOf(Math.min(...losses)); return { template, seed, epochs, losses, answer: epochs[i] } }
  if (template === 'decay') { const lr = g.pick([0.001, 0.01, 0.1]), wd = g.pick([0.01, 0.1, 0.5, 1]); return { template, seed, lr, wd, answer: lr * wd, misconceptions: [{ answer: wd, feedback: 'Decoupled decay is scaled by the learning rate: lr · λ per step.' }].filter(m => Math.abs(m.answer - lr * wd) > 1e-9) } }
  const vals = [g.pick([1, 2, 3]), g.pick([4, 5]), g.pick([6, 8, 9])], m = vals.reduce((a, b) => a + b, 0) / 3, sd = Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / 3); return { template, seed, vals, answer: (vals[2] - m) / sd, misconceptions: [{ answer: vals[2] - m, feedback: 'Divide by the batch standard deviation too.' }].filter(m2 => Math.abs(m2.answer - (vals[2] - m) / sd) > 0.0006) }
}
export function view(p) {
  if (p.template === 'stopping') return { intro: `Validation losses at epochs ${p.epochs.join(', ')} are ${p.losses.join(', ')}.`, questions: [{ id: 's', type: 'number', label: 'Which epoch does early stopping keep?', answer: p.answer }] }
  if (p.template === 'decay') return { intro: `AdamW with learning rate ${p.lr} and weight decay ${p.wd}.`, questions: [{ id: 'd', type: 'number', label: 'By what fraction does decoupled decay shrink a weight in one step (ignoring the gradient)?', answer: p.answer, tolerance: 1e-9, misconceptions: p.misconceptions }] }
  return { intro: `One feature in a batch of three has values ${p.vals.join(', ')}. Batch norm with γ = 1, β = 0, ε ignored.`, questions: [{ id: 'b', type: 'number', label: `What is the output for ${p.vals[2]}? (Three decimals.)`, answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
}
export function workedSolution(p) {
  if (p.template === 'stopping') return `The lowest validation loss is ${Math.min(...p.losses)}, at epoch **${p.answer}**.`
  if (p.template === 'decay') return `${p.lr} × ${p.wd} = **${p.answer}**.`
  const m = p.vals.reduce((a, b) => a + b, 0) / 3
  return `Mean ${r3(m)}, sd ${r3(Math.sqrt(p.vals.reduce((s, v) => s + (v - m) ** 2, 0) / 3))}: (${p.vals[2]} − ${r3(m)}) / sd = **${r3(p.answer)}**.`
}

export const dlreg = {
  title: 'Regularization and normalization: modes, masks and statistics',
  version: 1,
  templates: TEMPLATES,
  templateNames: { stopping: 'Early stopping', decay: 'Decoupled weight decay', bn: 'Batch-norm output' },
  generate, view, workedSolution,
  intro: 'Seven steps: regularization arithmetic by hand, evaluation mode for dropout, and writing inverted dropout, batch norm in evaluation mode and layer normalization. Nothing here locks the rest of the lab.',
  steps: [
    {
      id: 'trace', kind: 'trace', title: 'Regularization arithmetic by hand',
      prompt: 'Validation losses 0.40, 0.33, 0.35, 0.52 at epochs 50, 90, 150, 400. AdamW with lr 0.01 and decay 0.5. A digit classifier augmented with rotations up to 180°. A residual block that should do nothing.',
      fields: [
        { label: 'Epoch early stopping keeps', answer: 90 },
        { label: 'Fraction a weight shrinks per step', answer: 0.005, tolerance: 1e-9 },
        { label: 'Sum of the two digits it will confuse', answer: 15 },
        { label: 'What f should output', answer: 0 },
      ],
      explain: 'The lowest validation loss is at epoch 90. 0.01 × 0.5 = 0.005. A 6 rotated by 180° is a 9: 6 + 9 = 15. y = x + f(x) is the identity when f = 0.',
    },
    {
      id: 'agree', kind: 'probe', title: 'Evaluation mode',
      prompt: 'A network trained with dropout 0.5 is evaluated five times. Run it: units are still dropped while predicting. **Set `eval_mode = 1`** and run again.',
      starter: `import numpy as np
rng = np.random.default_rng(52)
def spirals(n, seed):
    r = np.random.default_rng(seed); c = np.arange(n) % 2; t = 0.25 + 2.4 * r.random(n); a = 2.6 * t + c * np.pi
    return np.column_stack([t * np.cos(a), t * np.sin(a)]) + 0.12 * r.normal(size=(n, 2)), c
X, y = spirals(200, 1); Xv, yv = spirals(600, 2)
W1, b1 = rng.normal(0, 1, (2, 64)), np.zeros(64); W2, b2 = rng.normal(0, 0.1, (64, 2)), np.zeros(2); p = 0.5
for step in range(2000):                                    # train with dropout p = 0.5 on the hidden layer
    h = np.maximum(0, X @ W1 + b1); m = (rng.random(h.shape) > p) / (1 - p); hd = h * m
    z = hd @ W2 + b2; q = np.exp(z - z.max(1, keepdims=True)); q /= q.sum(1, keepdims=True); q[np.arange(200), y] -= 1; g = q / 200
    gh = (g @ W2.T) * m * (h > 0)
    W2 -= 0.5 * hd.T @ g; b2 -= 0.5 * g.sum(0); W1 -= 0.5 * X.T @ gh; b1 -= 0.5 * gh.sum(0)

eval_mode = 0             # 1: switch dropout off at evaluation (model.eval()); 0: keep dropping units while predicting
def predict(Xq, seed):
    h = np.maximum(0, Xq @ W1 + b1)
    if not eval_mode:
        h = h * (np.random.default_rng(seed).random(h.shape) > p) / (1 - p)
    return (h @ W2 + b2).argmax(1)
accs = [float(np.mean(predict(Xv, s) == yv)) for s in range(5)]
val_accuracy, spread = float(np.mean(accs)), float(max(accs) - min(accs))
print(f"eval_mode = {eval_mode}: validation accuracy {val_accuracy:.3f}; spread over 5 prediction runs {spread:.3f}")`,
      probe: ['val_accuracy', 'spread', 'eval_mode'],
      evaluate: evaluateEval,
      done: 'In PyTorch that switch is model.eval() — and it also switches batch norm to its running statistics.',
    },
    {
      id: 'fill', kind: 'function', title: 'Fill in inverted dropout',
      prompt: 'Replace `___` with the training-time output of inverted dropout, given activations h, a 0/1 keep mask and the drop probability p.',
      starter: `import numpy as np

def inverted_dropout(h, mask, p):
    """Zero the dropped units and rescale the kept ones so the expectation is unchanged."""
    return ___`,
      hint: 'h · mask / (1 − p).',
      solution: 'return h * mask / (1 - p)',
      check: { fn: 'inverted_dropout', args: ['h', 'mask', 'p'], ints: ['mask'], cases: DROP_CASES, describe: c => `${c.h.length} × ${c.h[0].length}, p = ${c.p}`, diagnose: diagnoseDrop },
    },
    {
      id: 'repair', kind: 'function', title: 'Repair a planted bug',
      prompt: 'For one example x = (5, 1) with running mean (3, 0) and variance (4, 1), this evaluation-mode batch norm returns **(0, 0)**; it should return (1, 1). Fix it.',
      starter: `import numpy as np

def bn_eval(x, run_mean, run_var, gamma, beta, eps=1e-5):
    """Batch normalization in evaluation mode."""
    mu, var = x.mean(axis=0), x.var(axis=0)
    return gamma * (x - mu) / np.sqrt(var + eps) + beta`,
      hint: 'In evaluation mode the batch may be a single example.',
      solution: 'return gamma * (x - run_mean) / np.sqrt(run_var + eps) + beta',
      check: { fn: 'bn_eval', args: ['x', 'mu', 'v', 'gamma', 'beta'], cases: BN_CASES, describe: c => `${c.x.length} example(s)`, diagnose: diagnoseBn },
      explainChoice: {
        prompt: 'Why can batch statistics not be used at prediction time?',
        options: [
          { text: 'A single example’s own mean is itself and its variance is 0, so it would be erased to β; and predictions would depend on which other examples happen to share the batch.', correct: true },
          { text: 'Because the running statistics are more accurate for every batch.', feedback: 'The point is that predictions must not depend on the batch at all.' },
          { text: 'Because γ and β are not trained.', feedback: 'They are trained; the issue is μ and σ.' },
          { text: 'To make inference faster.', feedback: 'Speed is not the reason; correctness is.' },
        ],
        rightFeedback: 'Layer norm avoids the problem entirely: its statistics come from one example.',
      },
    },
    {
      id: 'implement', kind: 'function', title: 'Layer normalization',
      prompt: 'Write `layer_norm` from its contract.',
      starter: `import numpy as np

def layer_norm(x, eps=1e-5):
    """Standardize each row (one example) by the mean and variance of its own features (population variance).

    Example: layer_norm([[1, 2, 3]])  ->  [[-1.2247, 0, 1.2247]]  (rounded)
    """
    pass   # replace with your code`,
      hint: 'Mean and variance along axis 1 with keepdims=True.',
      solution: 'm = x.mean(axis=1, keepdims=True); v = x.var(axis=1, keepdims=True)\nreturn (x - m) / np.sqrt(v + eps)',
      check: { fn: 'layer_norm', args: ['x'], cases: LN_CASES, describe: c => `${c.x.length} example(s)`, diagnose: diagnoseLn },
    },
    { id: 'transfer', kind: 'transfer', title: 'Solve new problems', prompt: 'New curves, optimizers and batches. Solve one of each kind without opening the worked answer.' },
    { id: 'review', kind: 'review', title: 'Come back later', prompt: 'A fresh problem after a gap. The first return is suggested a day after you finish step 6; “Do it now” is always there and is recorded as early.' },
  ],
}
