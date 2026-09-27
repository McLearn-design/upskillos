import { rng, r3, needVars } from '../../kit/ladder.js'

// Lab 57 practice ladder: normalized adjacency, aggregation, parameters and hops by hand; over-smoothing; the
// normalized adjacency, mean aggregation and a two-layer GCN forward pass in code.

const matmul = (A, B) => A.map(row => B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0)))
const relu = M => M.map(row => row.map(v => Math.max(0, v)))
export function normAdjOf(A) {
  const n = A.length, At = A.map((row, i) => row.map((v, j) => v + (i === j ? 1 : 0))), d = At.map(row => row.reduce((s, v) => s + v, 0))
  return At.map((row, i) => row.map((v, j) => v / Math.sqrt(d[i] * d[j])))
}
export const meanAggOf = (A, H) => { const d = A.map(row => row.reduce((s, v) => s + v, 0)); return matmul(A, H).map((row, i) => row.map(v => v / d[i])) }
export const gcnOf = (A, X, W1, W2) => { const Ah = normAdjOf(A); return matmul(Ah, matmul(relu(matmul(Ah, matmul(X, W1))), W2)) }

const PATH = [[0, 1, 0], [1, 0, 1], [0, 1, 0]], STAR = [[0, 1, 1, 1], [1, 0, 0, 0], [1, 0, 0, 0], [1, 0, 0, 0]], TRI = [[0, 1, 1, 0], [1, 0, 1, 0], [1, 1, 0, 1], [0, 0, 1, 0]]
const ADJ_CASES = [{ A: PATH }, { A: STAR }, { A: TRI }].map(c => ({ ...c, expected: normAdjOf(c.A) }))
export const AGG_CASES = [
  { A: PATH, H: [[3, 0, 0], [0, 6, 0], [0, 0, 9]] },
  { A: STAR, H: [[1, 2], [3, 4], [5, 6], [7, 8]] },
  { A: TRI, H: [[1], [2], [3], [4]] },
].map(c => ({ ...c, expected: meanAggOf(c.A, c.H) }))
export const GCN_CASES = [
  { A: PATH, X: [[1, 0], [0, 1], [1, 1]], W1: [[1, -1], [0.5, 2]], W2: [[1], [-1]] },
  { A: STAR, X: [[1], [2], [3], [4]], W1: [[1, -0.5]], W2: [[0.3, 1], [-2, 0.5]] },
  { A: TRI, X: [[0.5, -1], [1, 0], [0, 2], [-1, 1]], W1: [[1, 0, -1], [0.5, 1, 1]], W2: [[1, 0], [0, 1], [-1, 1]] },
].map(c => ({ ...c, expected: gcnOf(c.A, c.X, c.W1, c.W2) }))

const close = (a, b) => Math.abs(a - b) < 1e-6
const nearMat = (a, b) => Array.isArray(a) && a.length === b.length && a.every((row, i) => Array.isArray(row) && row.length === b[i].length && row.every((v, j) => close(v, b[i][j])))
export function diagnoseAdj(c, got) {
  const dA = c.A.map(row => row.reduce((s, v) => s + v, 0)), At = c.A.map((row, i) => row.map((v, j) => v + (i === j ? 1 : 0))), d = dA.map(v => v + 1)
  if (nearMat(got.value, c.A.map((row, i) => row.map((v, j) => v / Math.sqrt(d[i] * d[j]))))) return 'The self-loops are missing from the numerator: divide A + I, not A.'
  if (nearMat(got.value, At.map((row, i) => row.map((v, j) => v / (d[i] * d[j]))))) return 'Divide by √(dᵢ dⱼ), not dᵢ dⱼ: np.sqrt(np.outer(d, d)).'
  if (nearMat(got.value, At.map((row, i) => row.map(v => v / d[i])))) return 'That is row normalization D⁻¹(A + I). The GCN uses the symmetric D^(−1/2)(A + I)D^(−1/2).'
  return null
}
export function diagnoseAgg(c, got) {
  const d = c.A.map(row => row.reduce((s, v) => s + v, 0)), AH = matmul(c.A, c.H)
  if (AH[0].length === d.length && nearMat(got.value, AH.map(row => row.map((v, j) => v / d[j])))) return 'Dividing an (n, d) array by an (n,) array divides each *column* j by degree j. Keep the degrees as a column: A.sum(axis=1, keepdims=True).'
  if (nearMat(got.value, AH)) return 'That is the sum of the neighbours’ features. Divide each row by the node’s degree.'
  return null
}
export function diagnoseGcn(c, got) {
  const Ah = normAdjOf(c.A)
  const noLoops = (() => { const d = c.A.map(row => row.reduce((s, v) => s + v, 0)); return c.A.map((row, i) => row.map((v, j) => v / Math.sqrt(d[i] * d[j]))) })()
  if (nearMat(got.value, matmul(noLoops, matmul(relu(matmul(noLoops, matmul(c.X, c.W1))), c.W2)))) return 'Add the self-loops before normalizing: Â = D^(−1/2)(A + I)D^(−1/2), so each node keeps its own features.'
  if (nearMat(got.value, matmul(Ah, matmul(matmul(Ah, matmul(c.X, c.W1)), c.W2)))) return 'Apply the ReLU between the two layers; without it two GCN layers collapse into one linear map.'
  if (nearMat(got.value, matmul(relu(matmul(Ah, matmul(c.X, c.W1))), c.W2))) return 'The second layer must propagate too: Â · (hidden) · W2.'
  return null
}
export function evaluateSmooth(vars) {
  const miss = needVars(vars, ['accuracy', 'spread', 'k'])
  if (miss) return { passed: false, message: miss }
  const a = Number(vars.accuracy.value), s = Number(vars.spread.value), k = Number(vars.k.value)
  if (a >= 0.9) return { passed: true, message: `${r3(a)} accuracy after ${k} steps: enough averaging to cancel the feature noise within each community, not so much that the communities blur together (spread ${r3(s)}).` }
  if (k === 0) return { passed: false, message: `${r3(a)} with no propagation: the node features alone are too noisy. Set \`k = 4\`.` }
  return { passed: false, message: `${r3(a)} accuracy after ${k} steps, with the feature spread down to ${r3(s)}: every node has drifted toward the same average, so the communities are no longer apart. Set \`k = 4\` and run again.` }
}

// ---------- Fresh problems ----------
export const TEMPLATES = ['ahat', 'hops', 'params']
export function generate(template, seed) {
  const g = rng(seed * 379 + TEMPLATES.indexOf(template) * 4463 + 181)
  if (template === 'ahat') { const di = g.pick([1, 2, 3, 4, 7]), dj = g.pick([2, 3, 5, 8, 15]), answer = 1 / Math.sqrt((di + 1) * (dj + 1)); return { template, seed, di, dj, answer, misconceptions: [{ answer: 1 / Math.sqrt(di * dj), feedback: 'Add each node’s self-loop to its degree first.' }].filter(m => Math.abs(m.answer - answer) > 0.0006) } }
  if (template === 'hops') { const k = g.pick([3, 4, 5, 6, 8]), h = g.pick([2, 3]); let total = 1, layer = k; for (let i = 1; i <= h; i++) { total += layer; layer *= k - 1 } return { template, seed, k, h, answer: total, misconceptions: [{ answer: 1 + range(h).reduce((s, i) => s + k ** (i + 1), 0), feedback: 'Each node beyond the first reaches only k − 1 new nodes: one of its links points back.' }].filter(m => m.answer !== total) } }
  const dims = [g.pick([4, 8, 16, 32]), g.pick([16, 32, 64]), g.pick([2, 3, 5, 10])]; return { template, seed, dims, answer: dims[0] * dims[1] + dims[1] * dims[2], misconceptions: [{ answer: dims[0] * dims[1] * dims[2], feedback: 'Add the two layers’ weight counts; do not multiply all three sizes.' }] }
}
const range = n => Array.from({ length: n }, (_, i) => i)
export function view(p) {
  if (p.template === 'ahat') return { intro: `Linked nodes i and j have ${p.di} and ${p.dj} neighbours.`, questions: [{ id: 'a', type: 'number', label: 'Âᵢⱼ with self-loops added? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  if (p.template === 'hops') return { intro: `A tree-like graph where every node has ${p.k} neighbours.`, questions: [{ id: 'h', type: 'number', label: `How many nodes does a ${p.h}-layer GNN’s receptive field hold, counting the node itself?`, answer: p.answer, misconceptions: p.misconceptions }] }
  return { intro: `A two-layer GCN maps ${p.dims[0]} input features to ${p.dims[1]} hidden units and then to ${p.dims[2]} classes.`, questions: [{ id: 'w', type: 'number', label: 'How many weights, excluding biases?', answer: p.answer, misconceptions: p.misconceptions }] }
}
export function workedSolution(p) {
  if (p.template === 'ahat') return `Degrees with self-loops: ${p.di + 1} and ${p.dj + 1}. 1/√(${p.di + 1} × ${p.dj + 1}) = **${r3(p.answer)}**.`
  if (p.template === 'hops') return `1 + ${p.k}${p.h > 1 ? ` + ${p.k} × ${p.k - 1}` : ''}${p.h > 2 ? ` + ${p.k} × ${p.k - 1}²` : ''} = **${p.answer}**.`
  return `${p.dims[0]} × ${p.dims[1]} + ${p.dims[1]} × ${p.dims[2]} = **${p.answer}**, for a graph of any size.`
}

export const gnn = {
  title: 'Graph neural networks: normalize, aggregate, propagate',
  version: 1,
  templates: TEMPLATES,
  templateNames: { ahat: 'Normalized adjacency entry', hops: 'Receptive field size', params: 'GCN weights' },
  generate, view, workedSolution,
  intro: 'Seven steps: GCN arithmetic by hand, propagation that goes too far, and writing the normalized adjacency, mean aggregation and a two-layer GCN. Nothing here locks the rest of the lab.',
  steps: [
    {
      id: 'trace', kind: 'trace', title: 'GCN arithmetic by hand',
      prompt: 'Node v has 3 neighbours, with features 2, 4 and 9. A GCN layer maps 8 features to 16. Another node has 5 neighbours.',
      fields: [
        { label: 'Â_vv (self-loop added)', answer: 0.25, tolerance: 1e-9 },
        { label: 'Mean of v’s neighbours’ features', answer: 5, tolerance: 1e-9 },
        { label: 'Weights in the 8 → 16 layer', answer: 128 },
        { label: 'Nodes the 5-neighbour node sees after 1 layer (itself included)', answer: 6 },
      ],
      explain: 'Degree with self-loop 4: 1/√(4 × 4) = 0.25. (2 + 4 + 9)/3 = 5. 8 × 16 = 128. 1 + 5 = 6.',
    },
    {
      id: 'agree', kind: 'probe', title: 'How far to propagate',
      prompt: 'Noisy node features are averaged over the graph k times, then classified by the nearest centroid of 2 labelled nodes per community. Run it with k = 32. **Set `k = 4`** and run again.',
      starter: `import numpy as np
rng = np.random.default_rng(57); n, K = 90, 3; y = np.arange(n) % K                      # 3 communities
A = (rng.random((n, n)) < np.where(y[:, None] == y[None], 0.16, 0.012)).astype(float); A = np.triu(A, 1); A = A + A.T
X = 0.6 * rng.normal(size=(K, 8))[y] + 1.6 * rng.normal(size=(n, 8))                     # very noisy node features
At = A + np.eye(n); d = At.sum(1); A_hat = At / np.sqrt(np.outer(d, d))
labelled = np.concatenate([np.where(y == c)[0][:2] for c in range(K)])                   # 2 labelled nodes per community

k = 32                    # propagation steps before classifying
H = X.copy()
for _ in range(k): H = A_hat @ H
spread = float(np.mean(((H - H.mean(0)) ** 2).sum(1)))
centroids = np.array([H[labelled[y[labelled] == c]].mean(0) for c in range(K)])
accuracy = float(np.mean(((H[:, None] - centroids[None]) ** 2).sum(-1).argmin(1) == y))
print(f"k = {k}: feature spread {spread:.3f}; nearest-centroid accuracy {accuracy:.3f} (chance {1 / K:.3f})")`,
      probe: ['accuracy', 'spread', 'k'],
      evaluate: evaluateSmooth,
      done: 'Try k = 0, 2, 8 and 16 as well: accuracy rises, peaks, then falls as the spread keeps shrinking — over-smoothing.',
    },
    {
      id: 'fill', kind: 'function', title: 'Fill in the normalized adjacency',
      prompt: 'Replace `___` with Â = D^(−1/2)(A + I)D^(−1/2), using `At = A + I` and its degrees `d`.',
      starter: `import numpy as np

def norm_adj(A):
    """Symmetrically normalized adjacency with self-loops."""
    At = A + np.eye(len(A)); d = At.sum(axis=1)
    return ___`,
      hint: 'At / np.sqrt(np.outer(d, d)).',
      solution: 'return At / np.sqrt(np.outer(d, d))',
      check: { fn: 'norm_adj', args: ['A'], cases: ADJ_CASES, describe: c => `${c.A.length} nodes`, diagnose: diagnoseAdj },
    },
    {
      id: 'repair', kind: 'function', title: 'Repair a planted bug',
      prompt: 'On the path 0 – 1 – 2 with features (3, 0, 0), (0, 6, 0), (0, 0, 9), node 0’s only neighbour is node 1, so its mean should be **(0, 6, 0)**. This function returns (0, 3, 0). Fix it.',
      starter: `import numpy as np

def mean_aggregate(A, H):
    """Row v: the mean of the feature rows of v's neighbours (every node has at least one)."""
    return (A @ H) / A.sum(axis=1)`,
      hint: 'Which axis does an array of shape (n,) line up with when dividing an (n, d) array?',
      solution: 'return (A @ H) / A.sum(axis=1, keepdims=True)',
      check: { fn: 'mean_aggregate', args: ['A', 'H'], cases: AGG_CASES, describe: c => `${c.A.length} nodes, ${c.H[0].length} feature(s)`, diagnose: diagnoseAgg },
      explainChoice: {
        prompt: 'Why did the bug go unnoticed on this example instead of raising an error?',
        options: [
          { text: 'Broadcasting aligns trailing axes: an (n,) array divides the columns of an (n, d) array. With n = d = 3 the shapes happen to fit, so NumPy silently divides column j by node j’s degree.', correct: true },
          { text: 'Because A is symmetric.', feedback: 'Symmetry does not change which axis the degrees line up with.' },
          { text: 'Because node 0 has only one neighbour.', feedback: 'Node 0 is where the wrong answer shows, not why there is no error.' },
          { text: 'NumPy always divides row by row.', feedback: 'It lines up the last axes, which here are the feature columns.' },
        ],
        rightFeedback: 'With 4 nodes and 2 features the same code would raise an error — test on shapes where n ≠ d.',
      },
    },
    {
      id: 'implement', kind: 'function', title: 'A two-layer GCN forward pass',
      prompt: 'Write `gcn_forward` from its contract.',
      starter: `import numpy as np

def gcn_forward(A, X, W1, W2):
    """Logits of a two-layer GCN: A_hat relu(A_hat X W1) W2, with A_hat = D^(-1/2) (A + I) D^(-1/2).

    Example: gcn_forward([[0, 1], [1, 0]], [[1], [3]], [[1]], [[1]])  ->  [[2], [2]]
    """
    pass   # replace with your code`,
      hint: 'Build A_hat as in step 3, then H = np.maximum(0, A_hat @ X @ W1) and return A_hat @ H @ W2.',
      solution: 'At = A + np.eye(len(A)); d = At.sum(1); Ah = At / np.sqrt(np.outer(d, d))\nreturn Ah @ np.maximum(0, Ah @ X @ W1) @ W2',
      check: { fn: 'gcn_forward', args: ['A', 'X', 'W1', 'W2'], cases: GCN_CASES, describe: c => `${c.A.length} nodes`, diagnose: diagnoseGcn },
    },
    { id: 'transfer', kind: 'transfer', title: 'Solve new problems', prompt: 'New degrees, trees and layer sizes. Solve one of each kind without opening the worked answer.' },
    { id: 'review', kind: 'review', title: 'Come back later', prompt: 'A fresh problem after a gap. The first return is suggested a day after you finish step 6; “Do it now” is always there and is recorded as early.' },
  ],
}
