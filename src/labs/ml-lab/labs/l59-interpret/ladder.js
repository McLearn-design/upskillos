import { rng, r3, needVars } from '../../kit/ladder.js'

// Lab 59 practice ladder: permutation importance, partial dependence, Shapley efficiency and effective sample size
// by hand; importance measured on memorized rows; effective sample size, the Shapley weight and exact Shapley
// values from a table of coalition values in code.

export const effNOf = w => w.reduce((a, b) => a + b, 0) ** 2 / w.reduce((a, b) => a + b * b, 0)
const fact = n => (n <= 1 ? 1 : n * fact(n - 1))
export const shapWeightOf = (s, d) => fact(s) * fact(d - s - 1) / fact(d)
const bits = S => { let c = 0; for (; S; S &= S - 1) c++; return c }
export function shapleyOf(v, d) {
  return Array.from({ length: d }, (_, j) => { let t = 0; for (let S = 0; S < 1 << d; S++) { if (S & (1 << j)) continue; t += shapWeightOf(bits(S), d) * (v[S | (1 << j)] - v[S]) } return t })
}

const EFF_CASES = [{ w: [1, 1, 1, 1] }, { w: [1, 0.25, 0.25, 0.25, 0.25] }, { w: [0.9, 0.1, 0.5, 0.02, 0.7, 0.3] }].map(c => ({ ...c, expected: effNOf(c.w) }))
export const WEIGHT_CASES = [{ s: 0, d: 2 }, { s: 2, d: 6 }, { s: 3, d: 4 }, { s: 0, d: 5 }].map(c => ({ ...c, expected: shapWeightOf(c.s, c.d) }))
// Coalition values indexed by bitmask: bit k set = feature k known.
export const SHAP_CASES = [
  { v: [0, 3, 5, 8], d: 2 },                                   // additive: phi = (3, 5)
  { v: [0, 0, 0, 10], d: 2 },                                  // pure interaction: split equally
  { v: [10, 12, 11, 15, 9, 13, 14, 26], d: 3 },                 // includes a three-way interaction
].map(c => ({ ...c, expected: shapleyOf(c.v, c.d) }))

const num = v => (Array.isArray(v) && v.length === 1 ? Number(v[0]) : Number(v))
const close = (a, b) => Math.abs(a - b) < 1e-6
const nearArr = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => close(v, b[i]))
export function diagnoseEff(c, got) {
  const v = num(got.value), s = c.w.reduce((a, b) => a + b, 0), s2 = c.w.reduce((a, b) => a + b * b, 0)
  if (close(v, s2 / s ** 2)) return 'That is the reciprocal: (Σw)² goes on top, Σw² underneath.'
  if (close(v, s)) return 'The plain sum of weights is not a count of samples. Use (Σw)²/Σw², which equals n when all weights are equal.'
  if (close(v, s ** 2 / c.w.length)) return 'Divide by the sum of the squared weights, Σw², not by the number of samples.'
  return null
}
export function diagnoseWeight(c, got) {
  const v = num(got.value)
  if (close(v, fact(c.s) * fact(c.d - c.s) / fact(c.d)) && !close(v, c.expected)) return 'Off by one: after the |S| features before j and j itself, d − |S| − 1 features remain, so the weight is |S|!(d − |S| − 1)!/d!.'
  return null
}
export function diagnoseShap(c, got) {
  const n = 1 << (c.d - 1)
  const plain = Array.from({ length: c.d }, (_, j) => { let t = 0; for (let S = 0; S < 1 << c.d; S++) if (!(S & (1 << j))) t += c.v[S | (1 << j)] - c.v[S]; return t / n })
  if (nearArr(got.value, plain) && !nearArr(plain, c.expected)) return 'Each coalition needs its Shapley weight |S|!(d − |S| − 1)!/d!; a plain average of marginal contributions over coalitions is a different index (Banzhaf).'
  const total = c.v[(1 << c.d) - 1] - c.v[0]
  if (Array.isArray(got.value) && got.value.length === c.d && !close(got.value.reduce((a, b) => a + b, 0), total)) return `The values should add up to v(all) − v(∅) = ${r3(total)} (efficiency); yours add up to ${r3(got.value.reduce((a, b) => a + b, 0))}.`
  return null
}
export function evaluateHeldOut(vars) {
  const miss = needVars(vars, ['imp_noise', 'imp_signal', 'on_test'])
  if (miss) return { passed: false, message: miss }
  const n = Number(vars.imp_noise.value), s = Number(vars.imp_signal.value)
  if (n > 0.5) return { passed: false, message: `The noise feature looks important (${r3(n)}): on its own training rows the 1-nearest-neighbour model finds each row exactly, and shuffling any column — even noise — breaks that. Set \`on_test = 1\` and run again.` }
  return { passed: true, message: `On held-out rows the noise feature’s importance is ${r3(n)} and the real feature’s ${r3(s)}: what the model memorized no longer counts.` }
}

// ---------- Fresh problems ----------
export const TEMPLATES = ['perm', 'pd', 'eff']
export function generate(template, seed) {
  const g = rng(seed * 389 + TEMPLATES.indexOf(template) * 4493 + 193)
  if (template === 'perm') { const base = g.pick([3.2, 5, 7.4, 12]), after = base + g.pick([0.3, 2.5, 18, 41.6]); return { template, seed, base, after, answer: after - base, misconceptions: [{ answer: after, feedback: 'Importance is the rise in error: subtract the error with nothing shuffled.' }] } }
  if (template === 'pd') { const ice = [g.pick([10, 12, 15]), g.pick([18, 20]), g.pick([22, 25, 31]), g.pick([14, 16])]; return { template, seed, ice, answer: ice.reduce((a, b) => a + b, 0) / 4 } }
  const base = g.pick([20, 24.3, 31]), phi = [g.pick([8, 3.5, -2]), g.pick([-5.5, 1.2]), g.pick([0.3, -0.8, 2.6])], answer = base + phi.reduce((a, b) => a + b, 0)
  return { template, seed, base, phi, answer, misconceptions: [{ answer: phi.reduce((a, b) => a + b, 0), feedback: 'Add the average prediction v(∅): the values share out f(x) − v(∅).' }] }
}
export function view(p) {
  if (p.template === 'perm') return { intro: `A model’s test MSE is ${p.base}. With one feature shuffled it is ${r3(p.after)}.`, questions: [{ id: 'p', type: 'number', label: 'Permutation importance of that feature?', answer: p.answer, tolerance: 1e-6, misconceptions: p.misconceptions }] }
  if (p.template === 'pd') return { intro: `At one grid value, four ICE curves give ${p.ice.join(', ')} minutes.`, questions: [{ id: 'd', type: 'number', label: 'Partial dependence at that value?', answer: p.answer, tolerance: 1e-9 }] }
  return { intro: `The average prediction is ${p.base} minutes; a build’s Shapley values are ${p.phi.join(', ')}.`, questions: [{ id: 'e', type: 'number', label: 'What does the model predict for this build?', answer: p.answer, tolerance: 1e-6, misconceptions: p.misconceptions }] }
}
export function workedSolution(p) {
  if (p.template === 'perm') return `${r3(p.after)} − ${p.base} = **${r3(p.answer)}**.`
  if (p.template === 'pd') return `(${p.ice.join(' + ')})/4 = **${r3(p.answer)}**.`
  return `${p.base} + (${p.phi.join(' + ')}) = **${r3(p.answer)}** (efficiency).`
}

export const interpret = {
  title: 'Interpretability: importance, Shapley values and surrogates',
  version: 1,
  templates: TEMPLATES,
  templateNames: { perm: 'Permutation importance', pd: 'Partial dependence', eff: 'Shapley efficiency' },
  generate, view, workedSolution,
  intro: 'Seven steps: explanation arithmetic by hand, importance measured on memorized rows, and writing the effective sample size, the Shapley weight and exact Shapley values. Nothing here locks the rest of the lab.',
  steps: [
    {
      id: 'trace', kind: 'trace', title: 'Explanation arithmetic by hand',
      prompt: 'Test MSE is 6.0, and 10.5 with one feature shuffled. Three ICE curves give 10, 14 and 18 at one grid value. The average prediction is 20 and a build’s Shapley values are 3, −1 and 2. Four LIME samples all have weight 1.',
      fields: [
        { label: 'Permutation importance', answer: 4.5, tolerance: 1e-9 },
        { label: 'Partial dependence at that value', answer: 14, tolerance: 1e-9 },
        { label: 'The build’s prediction', answer: 24, tolerance: 1e-9 },
        { label: 'Effective sample size', answer: 4, tolerance: 1e-9 },
      ],
      explain: '10.5 − 6.0 = 4.5. (10 + 14 + 18)/3 = 14. 20 + 3 − 1 + 2 = 24. (1 + 1 + 1 + 1)²/(1 + 1 + 1 + 1) = 4.',
    },
    {
      id: 'agree', kind: 'probe', title: 'Measure on held-out rows',
      prompt: 'A 1-nearest-neighbour model memorizes its training rows. Permutation importance is measured on those same rows. Run it: the noise feature looks important. **Set `on_test = 1`** and run again.',
      starter: `import numpy as np
rng = np.random.default_rng(59)
def data(n):
    X = rng.random((n, 2)); return X, 10 * X[:, 0] + rng.normal(0, 1, n)          # feature 0 matters; feature 1 is noise
Xtr, ytr = data(200); Xte, yte = data(200)
predict = lambda X: ytr[((X[:, None, :] - Xtr[None]) ** 2).sum(-1).argmin(1)]   # 1-nearest neighbour: memorizes training rows

on_test = 0               # 1: measure on held-out rows; 0: on the training rows the model memorized
X, y = (Xte, yte) if on_test else (Xtr, ytr)
base = np.mean((predict(X) - y) ** 2)
def importance(j, repeats=5):
    rises = []
    for _ in range(repeats):
        Xp = X.copy(); Xp[:, j] = rng.permutation(Xp[:, j]); rises.append(np.mean((predict(Xp) - y) ** 2) - base)
    return float(np.mean(rises))
imp_signal, imp_noise = importance(0), importance(1)
print(f"on_test = {on_test}: error {base:.2f}; importance of the real feature {imp_signal:.2f}, of the noise feature {imp_noise:.2f}")`,
      probe: ['imp_noise', 'imp_signal', 'on_test'],
      evaluate: evaluateHeldOut,
      done: 'The playground’s boosted trees show the same effect with the random build id: small but real on training builds, zero on test builds.',
    },
    {
      id: 'fill', kind: 'function', title: 'Fill in the effective sample size',
      prompt: 'Replace `___` with the effective sample size of the kernel weights `w`.',
      starter: `import numpy as np

def effective_n(w):
    """How many equally weighted samples the weighted fit is worth: (sum w)^2 / sum w^2."""
    return ___`,
      hint: 'w.sum() ** 2 / (w ** 2).sum().',
      solution: 'return w.sum() ** 2 / (w ** 2).sum()',
      check: { fn: 'effective_n', args: ['w'], cases: EFF_CASES, describe: c => `${c.w.length} weights`, diagnose: diagnoseEff },
    },
    {
      id: 'repair', kind: 'function', title: 'Repair a planted bug',
      prompt: 'With d = 2 features, feature j has two coalitions to join: the empty one and the one holding the other feature. Their weights should be 0.5 and 0.5. This function gives the empty coalition **1.0**. Fix it.',
      starter: `from math import factorial

def shapley_weight(s, d):
    """Weight of a coalition of size s in a Shapley value over d features."""
    return factorial(s) * factorial(d - s) / factorial(d)`,
      hint: 'In a random order of all d features: s before j, then j, then how many after?',
      solution: 'return factorial(s) * factorial(d - s - 1) / factorial(d)',
      check: { fn: 'shapley_weight', args: ['s', 'd'], ints: ['s', 'd'], cases: WEIGHT_CASES, describe: c => `|S| = ${c.s}, d = ${c.d}`, diagnose: diagnoseWeight },
      explainChoice: {
        prompt: 'How can you tell the buggy weights are wrong without knowing the formula?',
        options: [
          { text: 'The weight of S is the probability that exactly the features in S come before j in a random order. Summed over all coalitions that leave out j, those probabilities must total 1; the buggy ones total 1.5 for d = 2.', correct: true },
          { text: 'Weights must be integers.', feedback: 'They are probabilities, between 0 and 1.' },
          { text: 'The empty coalition should always get weight 0.', feedback: 'It gets 1/d: the chance that j comes first.' },
          { text: 'Larger coalitions must always get larger weights.', feedback: 'The weights are symmetric in |S| and d − |S| − 1: smallest in the middle.' },
        ],
        rightFeedback: 'That is also why efficiency holds: every ordering credits the whole f(x) − v(∅) to someone.',
      },
    },
    {
      id: 'implement', kind: 'function', title: 'Exact Shapley values',
      prompt: 'Write `shapley_values` from its contract.',
      starter: `import numpy as np
from math import factorial

def shapley_values(v, d):
    """Exact Shapley values from a table of coalition values.

    v: length 2**d; v[S] is the value when the features whose bits are set in S are known
       (bit k of S set = feature k known). Returns one value per feature.
    Example: shapley_values([0, 0, 0, 10], 2)  ->  [5, 5]   (a pure interaction is split equally)
    """
    pass   # replace with your code`,
      hint: 'For each j, loop over S without bit j: add weight(|S|) × (v[S | 1 << j] − v[S]); |S| = bin(S).count("1").',
      solution: 'phi = np.zeros(d)\nfor j in range(d):\n    for S in range(2 ** d):\n        if S >> j & 1: continue\n        s = bin(S).count("1")\n        phi[j] += factorial(s) * factorial(d - s - 1) / factorial(d) * (v[S | 1 << j] - v[S])\nreturn phi',
      check: { fn: 'shapley_values', args: ['v', 'd'], ints: ['d'], cases: SHAP_CASES, describe: c => `d = ${c.d}`, diagnose: diagnoseShap },
    },
    { id: 'transfer', kind: 'transfer', title: 'Solve new problems', prompt: 'New errors, curves and explanations. Solve one of each kind without opening the worked answer.' },
    { id: 'review', kind: 'review', title: 'Come back later', prompt: 'A fresh problem after a gap. The first return is suggested a day after you finish step 6; “Do it now” is always there and is recorded as early.' },
  ],
}
