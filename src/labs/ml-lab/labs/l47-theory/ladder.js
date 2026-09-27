import { rng, r3, needVars } from '../../kit/ladder.js'

// Lab 47 practice ladder: Hoeffding and union bounds, VC dimension and double descent by hand; an untouched test set;
// the bound, sample complexity and interval labellings in code.

export const epsOf = (n, delta, H) => Math.sqrt((Math.log(H) + Math.log(2 / delta)) / (2 * n))
export const nNeededOf = (eps, delta, H) => Math.ceil((Math.log(H) + Math.log(2 / delta)) / (2 * eps * eps))
export const intervalLabellingsOf = n => 1 + n * (n + 1) / 2

const EPS_CASES = [[2500, 0.05, 1], [1000, 0.05, 20], [100, 0.05, 50], [400, 0.01, 1000]].map(([n, delta, H]) => ({ n, delta, H, expected: epsOf(n, delta, H) }))
const NN_CASES = [[0.05, 0.05, 1], [0.05, 0.05, 1000], [0.02, 0.01, 50], [0.1, 0.1, 10]].map(([eps, delta, H]) => ({ eps, delta, H, expected: nNeededOf(eps, delta, H) }))
export const IL_CASES = [1, 2, 3, 5, 10].map(n => ({ n, expected: intervalLabellingsOf(n) }))

export function diagnoseEps(c, got) {
  if (Math.abs(got.value - Math.sqrt(Math.log(2 / c.delta) / (2 * c.n))) < 1e-9 && c.H > 1) return 'That is the bound for one fixed hypothesis. For a class, add ln|H| inside the square root (the union bound).'
  if (Math.abs(got.value - Math.sqrt((c.H + Math.log(2 / c.delta)) / (2 * c.n))) < 1e-9 && c.H > 1) return 'The class size enters through its logarithm: ln|H|, not |H|.'
  return null
}
export function diagnoseNn(c, got) {
  const noH = Math.ceil(Math.log(2 / c.delta) / (2 * c.eps * c.eps))
  if (got.value === noH && noH !== c.expected) return 'Include ln|H|: ERM picks among |H| hypotheses, so the union bound applies.'
  return null
}
export function diagnoseIl(c, got) {
  if (got.value === 2 ** c.n && c.n > 2) return 'Not every labelling works: an interval makes the ones contiguous. Count the intervals of consecutive points, plus the all-zero labelling.'
  if (got.value === c.n * (c.n + 1) / 2) return 'Include the labelling with no ones (an empty interval).'
  return null
}
export function evaluateTest(vars) {
  const miss = needVars(vars, ['reported', 'truth'])
  if (miss) return { passed: false, message: miss }
  const rep = Number(vars.reported.value), t = Number(vars.truth.value)
  if (rep - t > 0.02) return { passed: false, message: `Reported ${r3(rep)} against a true ${r3(t)}: the validation set chose the winner, so its score is optimistic by ${r3(100 * (rep - t))} points. Set \`report_on_test = 1\` and run again.` }
  return { passed: true, message: `Reported ${r3(rep)} against a true ${r3(t)}: an untouched test set, used once, is honest because it played no part in the choice.` }
}

// ---------- Fresh problems ----------
export const TEMPLATES = ['hoeffding', 'union', 'vc']
export function generate(template, seed) {
  const g = rng(seed * 307 + TEMPLATES.indexOf(template) * 4297 + 131)
  if (template === 'hoeffding') { const n = g.pick([100, 400, 1000, 2500, 10000]); return { template, seed, n, answer: epsOf(n, 0.05, 1), misconceptions: [{ answer: 1 / Math.sqrt(n), feedback: 'Use ε = √(ln(2/δ)/2n).' }].filter(m => Math.abs(m.answer - epsOf(n, 0.05, 1)) > 0.0006) } }
  if (template === 'union') { const n = g.pick([200, 500, 1000, 2000]), H = g.pick([10, 20, 100, 1000]); return { template, seed, n, H, answer: epsOf(n, 0.05, H), misconceptions: [{ answer: epsOf(n, 0.05, 1), feedback: 'Several candidates were compared: add ln|H|.' }] } }
  const d = g.pick([1, 2, 3, 5, 10]); return { template, seed, d, answer: d + 1, misconceptions: [{ answer: d, feedback: 'Count the bias too: half-planes in d dimensions have VC dimension d + 1.' }] }
}
export function view(p) {
  if (p.template === 'hoeffding') return { intro: `A test set of ${p.n.toLocaleString('en')} examples, δ = 0.05.`, questions: [{ id: 'e', type: 'number', label: 'How far can the test error be from the true error, by Hoeffding? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  if (p.template === 'union') return { intro: `Choosing among ${p.H} candidate models with ${p.n.toLocaleString('en')} validation examples, δ = 0.05.`, questions: [{ id: 'u', type: 'number', label: 'What ε does the union bound give? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  return { intro: `Linear classifiers with a bias in ${p.d} dimension${p.d > 1 ? 's' : ''}.`, questions: [{ id: 'v', type: 'number', label: 'What is their VC dimension?', answer: p.answer, misconceptions: p.misconceptions }] }
}
export function workedSolution(p) {
  if (p.template === 'hoeffding') return `√(ln 40 / (2 × ${p.n})) = **${r3(p.answer)}**.`
  if (p.template === 'union') return `√((ln ${p.H} + ln 40) / (2 × ${p.n})) = **${r3(p.answer)}**.`
  return `${p.d} + 1 = **${p.answer}**.`
}

export const theory = {
  title: 'Learning theory: bounds, capacity and honest reporting',
  version: 1,
  templates: TEMPLATES,
  templateNames: { hoeffding: 'Hoeffding bound', union: 'Union bound', vc: 'VC dimension of half-planes' },
  generate, view, workedSolution,
  intro: 'Seven steps: learning-theory arithmetic by hand, reporting on an untouched test set, and writing the bound, a sample size and a labelling count. Nothing here locks the rest of the lab.',
  steps: [
    {
      id: 'trace', kind: 'trace', title: 'Learning-theory arithmetic by hand',
      prompt: 'A test set of 2,500 (δ = 0.05). Choosing among 20 models with 1,000 validation examples. Intervals on the real line. Double descent: best small model 0.78, 400 features 0.59.',
      fields: [
        { label: 'Hoeffding ε (four decimals)', answer: epsOf(2500, 0.05, 1), tolerance: 0.00006 },
        { label: 'Union-bound ε (four decimals)', answer: epsOf(1000, 0.05, 20), tolerance: 0.00006 },
        { label: 'VC dimension of intervals', answer: 2 },
        { label: 'Fraction by which the large model is better (two decimals)', answer: 1 - 0.59 / 0.78, tolerance: 0.006 },
      ],
      explain: '√(ln 40/5000) = 0.0272. √((ln 20 + ln 40)/2000) = 0.0578. Intervals shatter 2 points but not 3 (1, 0, 1 fails). 1 − 0.59/0.78 = 0.24.',
    },
    {
      id: 'agree', kind: 'probe', title: 'Report on an untouched test set',
      prompt: 'The best of 1,000 configurations, chosen on 500 validation examples, reported by its validation accuracy. **Set `report_on_test = 1`** and run again.',
      starter: `import numpy as np
rng = np.random.default_rng(47)
k, m = 1000, 500                                            # 1,000 configurations, 500 validation examples
true_acc = rng.uniform(0.78, 0.82, k)                       # their real accuracies differ only a little
val_acc = rng.binomial(m, true_acc) / m                     # what the validation set says
best = int(np.argmax(val_acc))

report_on_test = 0        # 1: report the winner's accuracy on a fresh, untouched test set of 5,000 examples
reported = float(val_acc[best]) if not report_on_test else float(rng.binomial(5000, true_acc[best]) / 5000)
truth = float(true_acc[best])
print(f"report_on_test = {report_on_test}: reported accuracy {reported:.3f}; the winner's true accuracy {truth:.3f}")`,
      probe: ['reported', 'truth'],
      evaluate: evaluateTest,
      done: 'The union bound explains the optimism: the validation set had to certify 1,000 hypotheses at once.',
    },
    {
      id: 'fill', kind: 'function', title: 'Fill in the finite-class bound',
      prompt: 'Replace `___` with the ε that holds for every hypothesis in a class of size H at once.',
      starter: `import numpy as np

def union_eps(n, delta, H):
    """With probability 1 - delta, every |train error - true error| is at most this."""
    return ___`,
      hint: '√((ln|H| + ln(2/δ)) / (2n)).',
      solution: 'return np.sqrt((np.log(H) + np.log(2 / delta)) / (2 * n))',
      check: { fn: 'union_eps', args: ['n', 'delta', 'H'], ints: ['n', 'H'], cases: EPS_CASES, describe: c => `n = ${c.n}, δ = ${c.delta}, |H| = ${c.H}`, diagnose: diagnoseEps },
    },
    {
      id: 'repair', kind: 'function', title: 'Repair a planted bug',
      prompt: 'To guarantee ε = 0.05 with δ = 0.05 for ERM over 1,000 hypotheses, this returns **738** examples; the union bound needs 2,120. Fix it.',
      starter: `import numpy as np

def n_needed(eps, delta, H):
    """Smallest n with sqrt((ln H + ln(2/delta)) / (2n)) <= eps."""
    return int(np.ceil(np.log(2 / delta) / (2 * eps ** 2)))`,
      hint: 'Solve the finite-class bound for n.',
      solution: 'return int(np.ceil((np.log(H) + np.log(2 / delta)) / (2 * eps ** 2)))',
      check: { fn: 'n_needed', args: ['eps', 'delta', 'H'], ints: ['H'], cases: NN_CASES, describe: c => `ε = ${c.eps}, δ = ${c.delta}, |H| = ${c.H}`, diagnose: diagnoseNn },
      explainChoice: {
        prompt: 'Why does the class size matter even though ERM returns just one hypothesis?',
        options: [
          { text: 'That one hypothesis was chosen because it looked good on this sample; with many candidates, one is likely to look good by luck. The guarantee must hold for all of them at once.', correct: true },
          { text: 'Because ERM trains every hypothesis.', feedback: 'ERM only needs their training errors; the issue is selection, not cost.' },
          { text: 'Because larger classes always fit worse.', feedback: 'Larger classes fit training data better — that is the danger.' },
          { text: 'It does not matter for a single model.', feedback: 'It matters exactly because the single model was selected using the data.' },
        ],
        rightFeedback: 'The same selection effect as peeking (Lab 36) and the winner’s curse.',
      },
    },
    {
      id: 'implement', kind: 'function', title: 'Labellings realizable by intervals',
      prompt: 'Write `interval_labellings` from its contract.',
      starter: `def interval_labellings(n):
    """How many of the 2^n labellings of n distinct points on a line can the class
    "label 1 inside [a, b], 0 outside" produce?

    Example: interval_labellings(3)  ->  7   (all but 1, 0, 1)
    """
    pass   # replace with your code`,
      hint: 'A realizable labelling is a block of consecutive ones (choose its first and last point) or no ones at all.',
      solution: 'return 1 + n * (n + 1) // 2',
      check: { fn: 'interval_labellings', args: ['n'], ints: ['n'], cases: IL_CASES, describe: c => `n = ${c.n}`, diagnose: diagnoseIl },
    },
    { id: 'transfer', kind: 'transfer', title: 'Solve new problems', prompt: 'New test sets, candidate pools and classes. Solve one of each kind without opening the worked answer.' },
    { id: 'review', kind: 'review', title: 'Come back later', prompt: 'A fresh problem after a gap. The first return is suggested a day after you finish step 6; “Do it now” is always there and is recorded as early.' },
  ],
}
