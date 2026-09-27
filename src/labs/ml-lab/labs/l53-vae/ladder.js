import { rng, r3, needVars } from '../../kit/ladder.js'

// Lab 53 practice ladder: bottleneck, KL, reparameterization and interpolation by hand; a contaminated anomaly
// detector; the reparameterization trick, the Gaussian KL and the β-weighted negative ELBO in code.

export const reparamOf = (mu, logvar, eps) => mu.map((m, i) => m + Math.exp(0.5 * logvar[i]) * eps[i])
export const klOf = (mu, logvar) => 0.5 * mu.reduce((s, m, i) => s + Math.exp(logvar[i]) + m * m - 1 - logvar[i], 0)
const bceOf = (x, xh) => -x.reduce((s, v, i) => s + v * Math.log(xh[i]) + (1 - v) * Math.log(1 - xh[i]), 0)
export const negElboOf = (x, xh, mu, logvar, beta) => bceOf(x, xh) + beta * klOf(mu, logvar)

const REPARAM_CASES = [
  { mu: [2], logvar: [Math.log(0.25)], eps: [-2] },
  { mu: [0, 1], logvar: [0, Math.log(4)], eps: [1.5, -0.5] },
  { mu: [-1, 0.5, 3], logvar: [-1, 1, 0.2], eps: [0.3, 0, -1.1] },
].map(c => ({ ...c, expected: reparamOf(c.mu, c.logvar, c.eps) }))
const KL_CASES = [
  { mu: [0], logvar: [-2] },
  { mu: [0, 1], logvar: [Math.log(4), 0] },
  { mu: [0.5, -0.5, 2], logvar: [0.3, -0.7, 0] },
].map(c => ({ ...c, expected: klOf(c.mu, c.logvar) }))
export const ELBO_CASES = [
  { x: [1, 0], xh: [0.9, 0.2], mu: [0], logvar: [0], beta: 1 },
  { x: [1, 1, 0], xh: [0.5, 0.8, 0.1], mu: [1, -1], logvar: [0, Math.log(0.5)], beta: 1 },
  { x: [0, 1, 0, 1], xh: [0.3, 0.6, 0.2, 0.9], mu: [0.5, 2], logvar: [-1, 0.4], beta: 4 },
].map(c => ({ ...c, expected: negElboOf(c.x, c.xh, c.mu, c.logvar, c.beta) }))

const num = v => (Array.isArray(v) && v.length === 1 ? Number(v[0]) : Number(v))
const close = (a, b) => Math.abs(a - b) < 1e-6
const nearArr = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => close(v, b[i]))
export function diagnoseReparam(c, got) {
  if (nearArr(got.value, c.mu.map((m, i) => m + Math.exp(c.logvar[i]) * c.eps[i]))) return 'The encoder outputs log σ², the log of the variance. σ = exp(½ · log σ²): take the square root.'
  if (nearArr(got.value, c.mu.map((m, i) => m + c.logvar[i] * c.eps[i]))) return 'log σ² is not σ: convert it with exp(0.5 * logvar).'
  return null
}
export function diagnoseKl(c, got) {
  const v = num(got.value)
  if (close(v, 0.5 * c.mu.reduce((s, m, i) => s + Math.exp(c.logvar[i]) + m * m - 1, 0))) return 'The − log σ² term is missing. Without it a too-narrow code is rewarded and the KL can go negative.'
  if (close(v, klOf(c.mu, c.logvar) / c.mu.length)) return 'Sum over latent dimensions; do not average.'
  return null
}
export function diagnoseElbo(c, got) {
  const v = num(got.value)
  if (close(v, bceOf(c.x, c.xh) + klOf(c.mu, c.logvar)) && c.beta !== 1) return 'Multiply the KL term by β.'
  if (close(v, bceOf(c.x, c.xh))) return 'Add the KL term, β · ½ Σ (σ² + μ² − 1 − log σ²).'
  if (close(v, bceOf(c.x, c.xh) / c.x.length + c.beta * klOf(c.mu, c.logvar))) return 'Sum the cross-entropy over pixels; do not average it.'
  if (close(v, -bceOf(c.x, c.xh) - c.beta * klOf(c.mu, c.logvar)) || close(v, -bceOf(c.x, c.xh) + c.beta * klOf(c.mu, c.logvar))) return 'Return the loss to minimize: cross-entropy (a positive number) plus β · KL.'
  return null
}
export function evaluateContamination(vars) {
  const miss = needVars(vars, ['recall', 'threshold', 'train_clean'])
  if (miss) return { passed: false, message: miss }
  const rc = Number(vars.recall.value), t = Number(vars.threshold.value)
  if (rc < 0.9) return { passed: false, message: `The detector catches only ${r3(rc)} of the anomalies (threshold ${r3(t)}). Its training data contained anomalies, so the 3-number code learned their direction and reconstructs them well. Set \`train_clean = 1\` and run again.` }
  return { passed: true, message: `Recall ${r3(rc)} with the threshold at ${r3(t)}: trained on clean data, the code has no room for the anomaly direction, so anomalies reconstruct badly and stand out.` }
}

// ---------- Fresh problems ----------
export const TEMPLATES = ['kl', 'reparam', 'alarms']
export function generate(template, seed) {
  const g = rng(seed * 353 + TEMPLATES.indexOf(template) * 4441 + 163)
  if (template === 'kl') {
    const mu = g.pick([0, 0.5, 1, 2, -1]), s2 = g.pick([0.25, 0.5, 1, 2, 4]), answer = 0.5 * (s2 + mu * mu - 1 - Math.log(s2))
    return { template, seed, mu, s2, answer, misconceptions: [{ answer: 0.5 * (s2 + mu * mu - 1), feedback: 'Include the − ln σ² term.' }].filter(m => Math.abs(m.answer - answer) > 0.0006) }
  }
  if (template === 'reparam') {
    const mu = g.pick([-1, 0, 1, 2]), s2 = g.pick([0.25, 1, 4, 9]), eps = g.pick([-2, -1, -0.5, 0.5, 1, 1.5]), answer = mu + Math.sqrt(s2) * eps
    return { template, seed, mu, s2, eps, answer, misconceptions: [{ answer: mu + s2 * eps, feedback: 'Multiply ε by the standard deviation σ = √σ², not by the variance.' }].filter(m => Math.abs(m.answer - answer) > 1e-9) }
  }
  const n = g.pick([10000, 20000, 50000, 100000]), pct = g.pick([99, 99.5, 99.9]), answer = Math.round(n * (100 - pct) / 100)
  return { template, seed, n, pct, answer }
}
export function view(p) {
  if (p.template === 'kl') return { intro: `One latent dimension of a VAE’s code distribution has mean ${p.mu} and variance ${p.s2}.`, questions: [{ id: 'k', type: 'number', label: 'Its KL term ½(σ² + μ² − 1 − ln σ²)? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  if (p.template === 'reparam') return { intro: `The encoder gives μ = ${p.mu} and σ² = ${p.s2}; the noise draw is ε = ${p.eps}.`, questions: [{ id: 'z', type: 'number', label: 'What code z does the reparameterization trick produce?', answer: p.answer, tolerance: 1e-9, misconceptions: p.misconceptions }] }
  return { intro: `An anomaly alarm fires above the ${p.pct}th percentile of reconstruction errors on clean validation data. ${p.n.toLocaleString('en-US')} clean inputs arrive per day.`, questions: [{ id: 'a', type: 'number', label: 'About how many false alarms per day?', answer: p.answer }] }
}
export function workedSolution(p) {
  if (p.template === 'kl') return `½(${p.s2} + ${p.mu * p.mu} − 1 − ln ${p.s2}) = ½(${r3(p.s2 + p.mu * p.mu - 1)} − ${r3(Math.log(p.s2))}) = **${r3(p.answer)}**.`
  if (p.template === 'reparam') return `σ = √${p.s2} = ${Math.sqrt(p.s2)}, so z = ${p.mu} + ${Math.sqrt(p.s2)} × ${p.eps} = **${p.answer}**.`
  return `${r3(100 - p.pct)}% of ${p.n.toLocaleString('en-US')} = **${p.answer}**.`
}

export const vae = {
  title: 'Autoencoders and VAEs: codes, noise and the ELBO',
  version: 1,
  templates: TEMPLATES,
  templateNames: { kl: 'Gaussian KL term', reparam: 'Reparameterization', alarms: 'False alarms per day' },
  generate, view, workedSolution,
  intro: 'Seven steps: bottleneck and VAE arithmetic by hand, an anomaly detector trained on the wrong data, and writing the reparameterization trick, the Gaussian KL and the negative ELBO. Nothing here locks the rest of the lab.',
  steps: [
    {
      id: 'trace', kind: 'trace', title: 'Codes and ELBO terms by hand',
      prompt: 'A 28 × 28 image is encoded into 32 numbers. A latent dimension has μ = 1 and σ² = 1. The encoder gives μ = 2, σ² = 0.25, and the noise draw is ε = −2. Two digits have codes −2 and 4.',
      fields: [
        { label: 'Compression factor (one decimal)', answer: 24.5, tolerance: 0.05 },
        { label: 'KL term of that dimension', answer: 0.5, tolerance: 1e-9 },
        { label: 'Code z from the reparameterization trick', answer: 1, tolerance: 1e-9 },
        { label: 'Code halfway between the two digits', answer: 1, tolerance: 1e-9 },
      ],
      explain: '784 / 32 = 24.5. ½(1 + 1 − 1 − ln 1) = 0.5. z = 2 + 0.5 × (−2) = 1. ½(−2) + ½(4) = 1.',
    },
    {
      id: 'agree', kind: 'probe', title: 'Train the detector on clean data',
      prompt: 'A linear autoencoder (PCA with a 3-number code) flags inputs whose reconstruction error beats the 99th percentile of clean errors. Its training set contains 10% anomalies. Run it and look at the recall. **Set `train_clean = 1`** and run again.',
      starter: `import numpy as np
rng = np.random.default_rng(53)
B = np.linalg.qr(rng.normal(size=(20, 4)))[0]      # normal data live near a 3-D plane in 20-D; anomalies push along a 4th direction
normal = lambda n: rng.normal(size=(n, 3)) * [3, 2, 1] @ B[:, :3].T + 0.3 * rng.normal(size=(n, 20))
anomal = lambda n: normal(n) + 4 * np.outer(rng.choice([-1, 1], n), B[:, 3])

train_clean = 0           # 1: train on normal data only; 0: the training data include 100 anomalies
X = normal(900) if train_clean else np.vstack([normal(900), anomal(100)])
mu = X.mean(0); V = np.linalg.svd(X - mu, full_matrices=False)[2][:3]     # encoder z = V (x − mu), decoder x̂ = mu + V' z
err = lambda Z: (((Z - mu) - (Z - mu) @ V.T @ V) ** 2).sum(1)              # squared reconstruction error
threshold = float(np.quantile(err(normal(2000)), 0.99))                    # alarm threshold from clean validation data
recall = float(np.mean(err(anomal(500)) > threshold))
print(f"train_clean = {train_clean}: threshold {threshold:.2f}; share of anomalies caught {recall:.3f}")`,
      probe: ['recall', 'threshold', 'train_clean'],
      evaluate: evaluateContamination,
      done: 'A model trained on data containing anomalies learns to reconstruct them. Clean the training data, or check detection against labelled incidents.',
    },
    {
      id: 'fill', kind: 'function', title: 'Fill in the reparameterization trick',
      prompt: 'Replace `___` with the code z, given the encoder’s mean mu, its log-variance logvar and a standard normal draw eps.',
      starter: `import numpy as np

def reparameterize(mu, logvar, eps):
    """z = mu + sigma * eps, where the encoder outputs logvar = log(sigma^2)."""
    return ___`,
      hint: 'σ = exp(½ · log σ²).',
      solution: 'return mu + np.exp(0.5 * logvar) * eps',
      check: { fn: 'reparameterize', args: ['mu', 'logvar', 'eps'], cases: REPARAM_CASES, describe: c => `${c.mu.length} latent dimension(s)`, diagnose: diagnoseReparam },
    },
    {
      id: 'repair', kind: 'function', title: 'Repair a planted bug',
      prompt: 'For μ = 0 and log σ² = −2 (a code much narrower than the prior), this KL returns **−0.432**. A KL divergence is never negative; it should be 0.568. Fix it.',
      starter: `import numpy as np

def gaussian_kl(mu, logvar):
    """KL( N(mu, diag exp(logvar)) || N(0, I) ), summed over latent dimensions."""
    return 0.5 * np.sum(np.exp(logvar) + mu ** 2 - 1)`,
      hint: 'Compare with ½ Σ (σ² + μ² − 1 − log σ²).',
      solution: 'return 0.5 * np.sum(np.exp(logvar) + mu ** 2 - 1 - logvar)',
      check: { fn: 'gaussian_kl', args: ['mu', 'logvar'], cases: KL_CASES, describe: c => `${c.mu.length} latent dimension(s)`, diagnose: diagnoseKl },
      explainChoice: {
        prompt: 'What would the buggy KL do to training?',
        options: [
          { text: 'It rewards shrinking σ towards 0, because σ² − 1 keeps falling as σ² falls. The encoder would make its codes almost deterministic, like a plain autoencoder, and random codes would decode badly.', correct: true },
          { text: 'Nothing: the − log σ² term is a constant.', feedback: 'It depends on σ, which the encoder learns.' },
          { text: 'It would make the codes too wide.', feedback: 'The missing term is the one that penalizes codes that are too narrow.' },
          { text: 'It would only change the reconstruction term.', feedback: 'The reconstruction term does not contain log σ².' },
        ],
        rightFeedback: 'σ² − log σ² is smallest at σ² = 1: the two pieces together pull the width toward the prior’s.',
      },
    },
    {
      id: 'implement', kind: 'function', title: 'The β-weighted negative ELBO',
      prompt: 'Write `neg_elbo` from its contract.',
      starter: `import numpy as np

def neg_elbo(x, x_hat, mu, logvar, beta):
    """Loss for one image: binary cross-entropy summed over pixels, plus beta times the Gaussian KL.

    x: pixels in [0, 1]; x_hat: decoder probabilities in (0, 1); mu, logvar: the encoder's outputs.
    Example: neg_elbo([1, 0], [0.9, 0.2], [0], [0], 1)  ->  0.3285  (rounded; the KL is 0)
    """
    pass   # replace with your code`,
      hint: '−Σ [x log x̂ + (1 − x) log(1 − x̂)] + β · ½ Σ (exp(logvar) + μ² − 1 − logvar).',
      solution: 'bce = -np.sum(x * np.log(x_hat) + (1 - x) * np.log(1 - x_hat))\nkl = 0.5 * np.sum(np.exp(logvar) + mu ** 2 - 1 - logvar)\nreturn bce + beta * kl',
      check: { fn: 'neg_elbo', args: ['x', 'xh', 'mu', 'logvar', 'beta'], cases: ELBO_CASES, describe: c => `${c.x.length} pixels, β = ${c.beta}`, diagnose: diagnoseElbo },
    },
    { id: 'transfer', kind: 'transfer', title: 'Solve new problems', prompt: 'New code distributions, noise draws and alarm thresholds. Solve one of each kind without opening the worked answer.' },
    { id: 'review', kind: 'review', title: 'Come back later', prompt: 'A fresh problem after a gap. The first return is suggested a day after you finish step 6; “Do it now” is always there and is recorded as early.' },
  ],
}
