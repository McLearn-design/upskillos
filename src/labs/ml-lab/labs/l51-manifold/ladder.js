import { rng, r3, needVars } from '../../kit/ladder.js'

// Lab 51 practice ladder: dimensions, sources, distance counts and perplexity by hand; Isomap's neighbourhood size;
// perplexity, classical MDS's Gram matrix and excess kurtosis in code.

export const pplOf = p => 2 ** -p.reduce((s, v) => s + (v > 0 ? v * Math.log2(v) : 0), 0)
export function mdsGramOf(D) {
  const n = D.length, S = D.map(r => r.map(d => d * d)), rm = S.map(r => r.reduce((a, b) => a + b, 0) / n), all = rm.reduce((a, b) => a + b, 0) / n
  return S.map((r, i) => r.map((v, j) => -0.5 * (v - rm[i] - rm[j] + all)))
}
export const kurtOf = x => { const n = x.length, m = x.reduce((a, b) => a + b, 0) / n, v = x.reduce((s, q) => s + (q - m) ** 2, 0) / n; return x.reduce((s, q) => s + (q - m) ** 4, 0) / n / (v * v) - 3 }

const PPL_CASES = [{ p: [0.25, 0.25, 0.25, 0.25] }, { p: [0.5, 0.25, 0.125, 0.125] }, { p: [1, 0, 0] }, { p: [0.7, 0.2, 0.1] }].map(c => ({ ...c, expected: pplOf(c.p) }))
const MDS_CASES = [
  { D: [[0, 1], [1, 0]] },
  { D: [[0, 3, 4], [3, 0, 5], [4, 5, 0]] },
  { D: [[0, 1, 2, 3], [1, 0, 1, 2], [2, 1, 0, 1], [3, 2, 1, 0]] },
].map(c => ({ ...c, expected: mdsGramOf(c.D) }))
export const KURT_CASES = [{ x: [-1, 1, -1, 1] }, { x: [0, 0, 0, 0, 10] }, { x: [1, 2, 3, 4, 5] }, { x: [-2, -1, 0, 1, 2, 0, 0, 0] }].map(c => ({ ...c, expected: kurtOf(c.x) }))

const near = (a, b) => Array.isArray(a) && a.flat().length === b.flat().length && a.flat().every((v, i) => Math.abs(v - b.flat()[i]) < 1e-9)
export function diagnosePpl(c, got) {
  const H = -c.p.reduce((s, v) => s + (v > 0 ? v * Math.log2(v) : 0), 0)
  if (Math.abs(got.value - H) < 1e-9) return 'That is the entropy in bits. Perplexity is 2 raised to it.'
  return null
}
export function diagnoseMds(c, got) {
  if (near(got.value, c.D.map(r => r.map(d => -0.5 * d * d)))) return 'Double-centre the squared distances first: B = −½ H D² H (subtract row and column means, add back the overall mean).'
  if (near(got.value, mdsGramOf(c.D).map(r => r.map(v => -2 * v)))) return 'Multiply by −½ after centring.'
  return null
}
export function diagnoseKurt(c, got) {
  if (Math.abs(got.value - (c.expected + 3)) < 1e-9) return 'Excess kurtosis subtracts 3, so a Gaussian scores 0.'
  return null
}
export function evaluateK(vars) {
  const miss = needVars(vars, ['rank_corr', 'k'])
  if (miss) return { passed: false, message: miss }
  const rc = Number(vars.rank_corr.value)
  if (rc < 0.95) return { passed: false, message: `Rank correlation ${r3(rc)}: with ${Number(vars.k.value)} neighbours per point, some edges jump between layers of the roll and the geodesic distances short-circuit. Set \`k = 8\` and run again.` }
  return { passed: true, message: `Rank correlation ${r3(rc)}: with small neighbourhoods every edge stays on the sheet, and Isomap unrolls it.` }
}

// ---------- Fresh problems ----------
export const TEMPLATES = ['perplexity', 'pairs', 'pixels']
export function generate(template, seed) {
  const g = rng(seed * 331 + TEMPLATES.indexOf(template) * 4357 + 151)
  if (template === 'perplexity') { const H = g.pick([2, 3, 4, 4.32, 5, 5.64]); return { template, seed, H, answer: 2 ** H, misconceptions: [{ answer: Math.exp(H), feedback: 'H is in bits: perplexity is 2^H.' }] } }
  if (template === 'pairs') { const n = g.pick([500, 1000, 2000, 5000]); return { template, seed, n, answer: n * n, misconceptions: [{ answer: n * (n - 1) / 2, feedback: 'The question counts every ordered pair, the full n × n matrix.' }] } }
  const w = g.pick([28, 32, 64, 128]), c = g.pick([1, 3]); return { template, seed, w, c, answer: w * w * c, misconceptions: [{ answer: w * c, feedback: 'The image is w × w pixels.' }] }
}
export function view(p) {
  if (p.template === 'perplexity') return { intro: `A point’s neighbour distribution has entropy ${p.H} bits.`, questions: [{ id: 'p', type: 'number', label: 'What is its perplexity? (One decimal.)', answer: p.answer, tolerance: 0.06, misconceptions: p.misconceptions }] }
  if (p.template === 'pairs') return { intro: `Isomap on ${p.n.toLocaleString('en')} points computes the full matrix of shortest-path distances.`, questions: [{ id: 'n', type: 'number', label: 'How many entries does that matrix have?', answer: p.answer, misconceptions: p.misconceptions }] }
  return { intro: `An image of ${p.w} × ${p.w} pixels with ${p.c} channel${p.c > 1 ? 's' : ''}.`, questions: [{ id: 'd', type: 'number', label: 'How many dimensions does it have?', answer: p.answer, misconceptions: p.misconceptions }] }
}
export function workedSolution(p) {
  if (p.template === 'perplexity') return `2^${p.H} = **${Math.round(p.answer * 10) / 10}**.`
  if (p.template === 'pairs') return `${p.n}² = **${p.answer.toLocaleString('en')}**.`
  return `${p.w} × ${p.w} × ${p.c} = **${p.answer}**.`
}

export const manifold = {
  title: 'Nonlinear reduction: perplexity, geodesics and non-Gaussianity',
  version: 1,
  templates: TEMPLATES,
  templateNames: { perplexity: 'Perplexity', pairs: 'Distance-matrix size', pixels: 'Image dimensions' },
  generate, view, workedSolution,
  intro: 'Seven steps: nonlinear-reduction arithmetic by hand, Isomap’s neighbourhood size, and writing perplexity, classical MDS’s Gram matrix and excess kurtosis. Nothing here locks the rest of the lab.',
  steps: [
    {
      id: 'trace', kind: 'trace', title: 'Nonlinear-reduction arithmetic by hand',
      prompt: 'A 256 × 256 grayscale image. Independent sources for ICA. Isomap on 1,000 points. A neighbour distribution with entropy 4.32 bits.',
      fields: [
        { label: 'Pixel dimensions', answer: 65536 },
        { label: 'Most sources that may be Gaussian', answer: 1 },
        { label: 'Shortest-path distances computed', answer: 1000000 },
        { label: 'Perplexity (nearest whole number)', answer: 20, tolerance: 0.5 },
      ],
      explain: '256² = 65,536. At most one Gaussian source — two Gaussians look the same in every rotation. 1,000² = 1,000,000. 2^4.32 ≈ 20.',
    },
    {
      id: 'agree', kind: 'probe', title: 'Isomap’s neighbourhood size',
      prompt: 'Isomap on the swiss roll with 20 neighbours per point. Run it and read the rank correlation with the position along the roll. **Set `k = 8`** and run again.',
      starter: `import numpy as np
from scipy.stats import spearmanr
from sklearn.manifold import Isomap
rng = np.random.default_rng(2)
t = 1.5 * np.pi * (1 + 2 * rng.random(300)); h = 12 * rng.random(300)
X = np.column_stack([t * np.cos(t), h, t * np.sin(t)])      # the swiss roll; t is the position along it

k = 20                    # neighbours per point in Isomap's graph
Y = Isomap(n_neighbors=k, n_components=2).fit_transform(X)
rank_corr = float(abs(spearmanr(Y[:, 0], t)[0]))
print(f"k = {k}: Isomap axis 1 tracks the position along the roll with rank correlation {rank_corr:.3f}")`,
      probe: ['rank_corr', 'k'],
      evaluate: evaluateK,
      done: 'Check the result on several samples too (51.3’s cell): one short-circuit edge can spoil a single sample.',
    },
    {
      id: 'fill', kind: 'function', title: 'Fill in perplexity',
      prompt: 'Replace `___` with the perplexity 2^H of a probability vector p (zeros allowed).',
      starter: `import numpy as np

def perplexity(p):
    """Effective number of outcomes of the distribution p."""
    p = p[p > 0]
    return ___`,
      hint: '2 ** (entropy in bits).',
      solution: 'return 2 ** (-np.sum(p * np.log2(p)))',
      check: { fn: 'perplexity', args: ['p'], cases: PPL_CASES, describe: c => `p (${c.p.join(', ')})`, diagnose: diagnosePpl },
    },
    {
      id: 'repair', kind: 'function', title: 'Repair a planted bug',
      prompt: 'For two points at distance 1 this returns **[[0, −0.5], [−0.5, 0]]**; classical MDS’s Gram matrix is [[0.25, −0.25], [−0.25, 0.25]]. Fix it.',
      starter: `import numpy as np

def mds_gram(D):
    """The matrix classical MDS takes eigenvectors of, from a distance matrix D."""
    return -0.5 * D ** 2`,
      hint: 'B = −½ H D² H with H = I − 1/n.',
      solution: 'n = len(D); H = np.eye(n) - 1 / n\nreturn -0.5 * H @ (D ** 2) @ H',
      check: { fn: 'mds_gram', args: ['D'], cases: MDS_CASES, describe: c => `${c.D.length} points`, diagnose: diagnoseMds },
      explainChoice: {
        prompt: 'Why must the squared distances be double-centred?',
        options: [
          { text: 'Distances do not know where the origin is. Double-centring places it at the centroid, turning −½D² into the Gram matrix of centred coordinates, whose eigenvectors give the positions.', correct: true },
          { text: 'To make every distance positive.', feedback: 'Distances are already non-negative; B has negative entries.' },
          { text: 'To normalize the distances to [0, 1].', feedback: 'Centring subtracts means; it does not rescale.' },
          { text: 'Because shortest paths are always too long.', feedback: 'That is about the graph, not about centring.' },
        ],
        rightFeedback: 'The same centring as kernel PCA (Lab 49).',
      },
    },
    {
      id: 'implement', kind: 'function', title: 'Excess kurtosis',
      prompt: 'Write `excess_kurtosis` from its contract.',
      starter: `import numpy as np

def excess_kurtosis(x):
    """mean((x - m)^4) / var^2 - 3, with the population variance (divide by n). 0 for a Gaussian.

    Example: excess_kurtosis([-1, 1, -1, 1])  ->  -2.0
    """
    pass   # replace with your code`,
      hint: 'Centre x; divide the mean fourth power by the squared mean second power; subtract 3.',
      solution: 'c = x - x.mean()\nreturn np.mean(c ** 4) / np.mean(c ** 2) ** 2 - 3',
      check: { fn: 'excess_kurtosis', args: ['x'], cases: KURT_CASES, describe: c => `x (${c.x.join(', ')})`, diagnose: diagnoseKurt },
    },
    { id: 'transfer', kind: 'transfer', title: 'Solve new problems', prompt: 'New distributions, datasets and images. Solve one of each kind without opening the worked answer.' },
    { id: 'review', kind: 'review', title: 'Come back later', prompt: 'A fresh problem after a gap. The first return is suggested a day after you finish step 6; “Do it now” is always there and is recorded as early.' },
  ],
}
