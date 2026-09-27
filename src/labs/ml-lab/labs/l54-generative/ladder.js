import { rng, r3, needVars } from '../../kit/ladder.js'

// Lab 54 practice ladder: optimal discriminator, saturation, composed noise and sampling cost by hand; a schedule
// that never reaches noise; forward sampling, the reverse-step mean and a stable discriminator loss in code.

export const qSampleOf = (x0, t, eps, abar) => x0.map((v, i) => Math.sqrt(abar[t]) * v + Math.sqrt(1 - abar[t]) * eps[i])
export const reverseMeanOf = (xt, t, e, betas, alphas, abar) => xt.map((v, i) => (v - betas[t] / Math.sqrt(1 - abar[t]) * e[i]) / Math.sqrt(alphas[t]))
const softplus = v => Math.max(v, 0) + Math.log1p(Math.exp(-Math.abs(v)))
const meanOf = a => a.reduce((s, v) => s + v, 0) / a.length
export const dLossOf = (r, f) => meanOf(r.map(v => softplus(-v))) + meanOf(f.map(v => softplus(v)))
const sched = (betas) => { const alphas = betas.map(b => 1 - b), abar = []; alphas.reduce((p, a, i) => (abar[i] = p * a), 1); return { betas, alphas, abar } }

const S1 = sched([0.1, 0.2, 0.3]), S2 = sched([0.01, 0.05, 0.1, 0.4])
const Q_CASES = [
  { x0: [2, 0], t: 1, eps: [0.5, -1], abar: S1.abar },
  { x0: [1], t: 0, eps: [2], abar: S2.abar },
  { x0: [-1, 3, 0.5], t: 3, eps: [0.1, 0.2, -0.3], abar: S2.abar },
].map(c => ({ ...c, expected: qSampleOf(c.x0, c.t, c.eps, c.abar) }))
export const REV_CASES = [
  { xt: [1], t: 1, e: [0.5], betas: [4 / 9, 0.1], alphas: [5 / 9, 0.9], abar: [5 / 9, 0.5] },
  { xt: [0.5, -2], t: 2, e: [1, -0.4], betas: S1.betas, alphas: S1.alphas, abar: S1.abar },
  { xt: [3, 0, -1], t: 3, e: [0.2, 0.9, -1.5], betas: S2.betas, alphas: S2.alphas, abar: S2.abar },
].map(c => ({ ...c, expected: reverseMeanOf(c.xt, c.t, c.e, c.betas, c.alphas, c.abar) }))
export const D_CASES = [
  { r: [0, 0], f: [0, 0] },
  { r: [2, 1, 3], f: [-1, 0.5] },
  { r: [40, -2], f: [-3, 50] },
].map(c => ({ ...c, expected: dLossOf(c.r, c.f) }))

const num = v => (Array.isArray(v) && v.length === 1 ? Number(v[0]) : Number(v))
const close = (a, b) => Math.abs(a - b) < 1e-6
const nearArr = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => close(v, b[i]))
export function diagnoseQ(c, got) {
  if (nearArr(got.value, c.x0.map((v, i) => c.abar[c.t] * v + (1 - c.abar[c.t]) * c.eps[i]))) return 'ᾱ_t and 1 − ᾱ_t are variances; the coefficients are their square roots.'
  if (nearArr(got.value, c.x0.map((v, i) => Math.sqrt(c.abar[c.t]) * v + Math.sqrt(c.abar[c.t]) * c.eps[i]))) return 'The noise coefficient is √(1 − ᾱ_t), not √ᾱ_t.'
  return null
}
export function diagnoseRev(c, got) {
  if (nearArr(got.value, c.xt.map((v, i) => (v - c.betas[c.t] / Math.sqrt(1 - c.abar[c.t]) * c.e[i]) / Math.sqrt(c.abar[c.t])))) return 'That divides by √ᾱ_t. One reverse step undoes one forward step, which scaled by √α_t.'
  return null
}
export function diagnoseD(c, got) {
  const v = num(got.value)
  if (got.value == null || !Number.isFinite(v)) return 'The loss overflowed for a very confident logit. Use −log σ(ℓ) = np.logaddexp(0, −ℓ) and −log(1 − σ(ℓ)) = np.logaddexp(0, ℓ).'
  if (close(v, -dLossOf(c.r, c.f))) return 'Return the loss to minimize: −log σ(real) − log(1 − σ(fake)) is positive.'
  if (close(v, meanOf(c.r.map(x => softplus(x))) + meanOf(c.f.map(x => softplus(-x))))) return 'The labels are swapped: real should be pushed toward 1 (−log σ(real)), fake toward 0 (−log(1 − σ(fake))).'
  if (close(v, c.r.map(x => softplus(-x)).reduce((a, b) => a + b, 0) + c.f.map(x => softplus(x)).reduce((a, b) => a + b, 0))) return 'Average each term over its batch; do not sum.'
  return null
}
export function evaluateSchedule(vars) {
  const miss = needVars(vars, ['end_signal', 'radius_xT', 'radius_noise'])
  if (miss) return { passed: false, message: miss }
  const s = Number(vars.end_signal.value), a = Number(vars.radius_xT.value), b = Number(vars.radius_noise.value)
  if (s > 0.1) return { passed: false, message: `After the last step ${r3(s)} of the signal remains: x_T still carries the ring (mean radius ${r3(a)}, against ${r3(b)} for N(0, I)). Sampling starts from N(0, I), which is not where training ended. Set \`b1 = 0.25\` and run again.` }
  return { passed: true, message: `Signal factor ${r3(s)} at the last step; x_T has mean radius ${r3(a)}, like N(0, I)'s ${r3(b)}. The reverse process can start from pure noise.` }
}

// ---------- Fresh problems ----------
export const TEMPLATES = ['dstar', 'noise', 'cost']
export function generate(template, seed) {
  const g = rng(seed * 359 + TEMPLATES.indexOf(template) * 4447 + 167)
  if (template === 'dstar') { const a = g.pick([0.1, 0.2, 0.3, 0.6]), b = g.pick([0.1, 0.2, 0.4, 0.9]), answer = a / (a + b); return { template, seed, a, b, answer, misconceptions: [{ answer: a / b, feedback: 'D* divides by the sum p_data + p_g, not by p_g.' }].filter(m => Math.abs(m.answer - answer) > 0.0006) } }
  if (template === 'noise') { const abar = g.pick([0.04, 0.16, 0.36, 0.64, 0.81, 0.91]), answer = Math.sqrt(1 - abar); return { template, seed, abar, answer, misconceptions: [{ answer: 1 - abar, feedback: '1 − ᾱ_t is the variance; take its square root.' }, { answer: Math.sqrt(abar), feedback: 'That is the signal factor √ᾱ_t.' }].filter(m => Math.abs(m.answer - answer) > 0.0006) } }
  const steps = g.pick([20, 50, 100, 250, 1000]), ms = g.pick([2, 5, 8]), n = g.pick([10, 100]); return { template, seed, steps, ms, n, answer: steps * ms * n / 1000 }
}
export function view(p) {
  if (p.template === 'dstar') return { intro: `At some x the data density is ${p.a} and the generator’s density is ${p.b}.`, questions: [{ id: 'd', type: 'number', label: 'What does the optimal discriminator output there? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  if (p.template === 'noise') return { intro: `At some step of a diffusion model’s forward process, ᾱ_t = ${p.abar}.`, questions: [{ id: 'n', type: 'number', label: 'What is the noise standard deviation in x_t? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  return { intro: `A diffusion sampler takes ${p.steps} steps; each is one network call of ${p.ms} ms. You need ${p.n} samples, one after another.`, questions: [{ id: 'c', type: 'number', label: 'How many seconds does that take?', answer: p.answer, tolerance: 1e-9 }] }
}
export function workedSolution(p) {
  if (p.template === 'dstar') return `D* = ${p.a} / (${p.a} + ${p.b}) = **${r3(p.answer)}**.`
  if (p.template === 'noise') return `√(1 − ${p.abar}) = √${r3(1 - p.abar)} = **${r3(p.answer)}**.`
  return `${p.steps} × ${p.ms} ms × ${p.n} = ${p.steps * p.ms * p.n} ms = **${p.answer} s**.`
}

export const gen = {
  title: 'GANs and diffusion: the game, the schedule and the sampler',
  version: 1,
  templates: TEMPLATES,
  templateNames: { dstar: 'Optimal discriminator', noise: 'Noise level at step t', cost: 'Sampling cost' },
  generate, view, workedSolution,
  intro: 'Seven steps: GAN and diffusion arithmetic by hand, a noise schedule that never reaches noise, and writing forward sampling, the reverse-step mean and a stable discriminator loss. Nothing here locks the rest of the lab.',
  steps: [
    {
      id: 'trace', kind: 'trace', title: 'The game and the schedule by hand',
      prompt: 'At some x the data density is 2 and the generator’s density is 6. A fake has discriminator logit ℓ = −3. Two noising steps have α₁ = 0.9 and α₂ = 0.8. A sampler takes 50 steps of 4 ms.',
      fields: [
        { label: 'D*(x)', answer: 0.25, tolerance: 1e-9 },
        { label: 'Saturating gradient magnitude σ(ℓ) (three decimals)', answer: 0.047, tolerance: 0.0006 },
        { label: 'ᾱ₂', answer: 0.72, tolerance: 1e-9 },
        { label: 'Milliseconds per sample', answer: 200 },
      ],
      explain: '2 / (2 + 6) = 0.25. σ(−3) = 1/(1 + e³) ≈ 0.047, against 0.953 for the non-saturating loss. 0.9 × 0.8 = 0.72. 50 × 4 = 200 ms.',
    },
    {
      id: 'agree', kind: 'probe', title: 'A schedule that ends in noise',
      prompt: 'This forward process uses 40 steps with betas rising from 0.001 to b1 = 0.02. Run it: the last step still carries the data. **Set `b1 = 0.25`** (the playground’s schedule) and run again.',
      starter: `import numpy as np
rng = np.random.default_rng(54)
MODES = np.array([[2 * np.cos(2 * np.pi * k / 8), 2 * np.sin(2 * np.pi * k / 8)] for k in range(8)])
X0 = MODES[rng.integers(0, 8, 5000)] + 0.12 * rng.normal(size=(5000, 2))     # the ring of eight clusters

T, b1 = 40, 0.02          # last beta of the linear schedule (the playground uses 0.25)
betas = np.linspace(1e-3, b1, T); abar = np.cumprod(1 - betas)
XT = np.sqrt(abar[-1]) * X0 + np.sqrt(1 - abar[-1]) * rng.normal(size=X0.shape)   # the data after the last step
end_signal = float(np.sqrt(abar[-1]))
radius_xT = float(np.hypot(*XT.T).mean())                                        # mean distance from the origin
radius_noise = float(np.hypot(*rng.normal(size=(5000, 2)).T).mean())            # the same for N(0, I), where sampling starts
print(f"b1 = {b1}: signal factor at the last step {end_signal:.3f}; mean radius of x_T {radius_xT:.3f}, of N(0, I) {radius_noise:.3f}")`,
      probe: ['end_signal', 'radius_xT', 'radius_noise'],
      evaluate: evaluateSchedule,
      done: 'Training and sampling must meet in the middle: the forward process has to end where the reverse process begins.',
    },
    {
      id: 'fill', kind: 'function', title: 'Fill in forward sampling',
      prompt: 'Replace `___` with x_t in closed form, given the clean point x0, the step t, a standard normal draw eps and the cumulative products abar.',
      starter: `import numpy as np

def q_sample(x0, t, eps, abar):
    """x_t = sqrt(abar_t) * x0 + sqrt(1 - abar_t) * eps."""
    return ___`,
      hint: 'np.sqrt(abar[t]) * x0 + np.sqrt(1 - abar[t]) * eps.',
      solution: 'return np.sqrt(abar[t]) * x0 + np.sqrt(1 - abar[t]) * eps',
      check: { fn: 'q_sample', args: ['x0', 't', 'eps', 'abar'], ints: ['t'], cases: Q_CASES, describe: c => `t = ${c.t}, ${c.x0.length} coordinate(s)`, diagnose: diagnoseQ },
    },
    {
      id: 'repair', kind: 'function', title: 'Repair a planted bug',
      prompt: 'With x_t = 1, ε̂ = 0.5, β_t = 0.1, α_t = 0.9 and ᾱ_t = 0.5, this reverse-step mean returns **1.314**; it should return 0.980. Fix it.',
      starter: `import numpy as np

def reverse_mean(xt, t, eps_hat, betas, alphas, abar):
    """Mean of x_{t-1} given x_t: (x_t - beta_t / sqrt(1 - abar_t) * eps_hat) / sqrt(alpha_t)."""
    return (xt - betas[t] / np.sqrt(1 - abar[t]) * eps_hat) / np.sqrt(abar[t])`,
      hint: 'Compare the last division with the docstring.',
      solution: 'return (xt - betas[t] / np.sqrt(1 - abar[t]) * eps_hat) / np.sqrt(alphas[t])',
      check: { fn: 'reverse_mean', args: ['xt', 't', 'e', 'betas', 'alphas', 'abar'], ints: ['t'], cases: REV_CASES, describe: c => `t = ${c.t}`, diagnose: diagnoseRev },
      explainChoice: {
        prompt: 'Why √α_t and not √ᾱ_t?',
        options: [
          { text: 'A reverse step undoes one forward step, x_t = √α_t·x_{t−1} + √β_t·ε, which shrank the signal by √α_t only. Dividing by √ᾱ_t jumps all the way to an x₀-scale in one step and blows samples up.', correct: true },
          { text: 'They are equal for every step.', feedback: 'Only at the first step; ᾱ_t is the product of all α up to t.' },
          { text: 'Because ᾱ_t is not known at sampling time.', feedback: 'The schedule is fixed and fully known.' },
          { text: 'To add more noise at each step.', feedback: 'The division rescales the mean; noise is added separately as √β_t·z.' },
        ],
        rightFeedback: 'The ᾱ_t in the formula appears only in the noise-removal term, which converts ε̂ (noise accumulated since x₀) into one step’s share.',
      },
    },
    {
      id: 'implement', kind: 'function', title: 'A stable discriminator loss',
      prompt: 'Write `d_loss` from its contract. It must not overflow for very confident logits.',
      starter: `import numpy as np

def d_loss(real_logits, fake_logits):
    """Discriminator loss: mean over real of -log sigmoid(l) plus mean over fake of -log(1 - sigmoid(l)).

    Example: d_loss([0, 0], [0, 0])  ->  1.3863  (= 2 log 2, rounded)
    """
    pass   # replace with your code`,
      hint: '−log σ(ℓ) = np.logaddexp(0, −ℓ); −log(1 − σ(ℓ)) = np.logaddexp(0, ℓ).',
      solution: 'return np.mean(np.logaddexp(0, -real_logits)) + np.mean(np.logaddexp(0, fake_logits))',
      check: { fn: 'd_loss', args: ['r', 'f'], cases: D_CASES, describe: c => `${c.r.length} real, ${c.f.length} fake`, diagnose: diagnoseD },
    },
    { id: 'transfer', kind: 'transfer', title: 'Solve new problems', prompt: 'New densities, noise levels and samplers. Solve one of each kind without opening the worked answer.' },
    { id: 'review', kind: 'review', title: 'Come back later', prompt: 'A fresh problem after a gap. The first return is suggested a day after you finish step 6; “Do it now” is always there and is recorded as early.' },
  ],
}
