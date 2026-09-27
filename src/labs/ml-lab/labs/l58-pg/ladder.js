import { rng, r3, needVars } from '../../kit/ladder.js'

// Lab 58 practice ladder: policy probability, gradient terms, returns and TD errors by hand; a reward offset that
// drowns the signal without a baseline; the score function, returns-to-go and the REINFORCE gradient in code.

export const gradLogOf = (phi, a, p) => phi.map(f => (a - p) * f)
export const rtgOf = (rewards, gamma) => { const G = rewards.map(() => 0); let run = 0; for (let t = rewards.length - 1; t >= 0; t--) { run = rewards[t] + gamma * run; G[t] = run } return G }
export function reinforceGradOf(phis, actions, probs, rewards, gamma, baseline) {
  const G = rtgOf(rewards, gamma), g = phis[0].map(() => 0)
  phis.forEach((phi, t) => phi.forEach((f, i) => { g[i] += (G[t] - baseline[t]) * (actions[t] - probs[t]) * f }))
  return g
}

const LOG_CASES = [
  { phi: [0.5, -1, 1], a: 1, p: 0.8 },
  { phi: [2, 0, 1], a: 0, p: 0.25 },
  { phi: [1, 1, 1, 1, 1], a: 1, p: 0.5 },
].map(c => ({ ...c, expected: gradLogOf(c.phi, c.a, c.p) }))
export const RTG_CASES = [
  { rewards: [1, 1, 1], gamma: 0.5 },
  { rewards: [0, 0, 5], gamma: 0.9 },
  { rewards: [2, -1, 3, 1], gamma: 1 },
].map(c => ({ ...c, expected: rtgOf(c.rewards, c.gamma) }))
export const RG_CASES = [
  { phis: [[1, 0], [0, 1]], actions: [1, 0], probs: [0.5, 0.5], rewards: [1, 1], gamma: 1, baseline: [0, 0] },
  { phis: [[1, 2], [0.5, -1], [1, 1]], actions: [1, 1, 0], probs: [0.6, 0.3, 0.8], rewards: [1, 1, 1], gamma: 0.9, baseline: [2, 1.5, 0.5] },
  { phis: [[0.2, 1, -0.5], [1, 0, 0.3]], actions: [0, 1], probs: [0.4, 0.7], rewards: [1, 2], gamma: 0.5, baseline: [1, 1] },
].map(c => ({ ...c, expected: reinforceGradOf(c.phis, c.actions, c.probs, c.rewards, c.gamma, c.baseline) }))

const close = (a, b) => Math.abs(a - b) < 1e-6
const nearArr = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => close(v, b[i]))
export function diagnoseLog(c, got) {
  if (nearArr(got.value, c.phi.map(f => (c.p - c.a) * f))) return 'The sign is reversed: ∇log π(a | s) = (a − p)·φ(s), so a chosen right push (a = 1) raises the weights.'
  if (nearArr(got.value, c.phi.map(f => c.a * f))) return 'Subtract the probability p: the gradient is (a − p)·φ, not a·φ.'
  if (nearArr(got.value, c.phi.map(f => (1 - c.p) * f))) return 'That ignores which action was taken. Use (a − p): for a left push (a = 0) it is −p.'
  return null
}
export function diagnoseRtg(c, got) {
  const fwd = []; let run = 0; c.rewards.forEach(r => { run = r + c.gamma * run; fwd.push(run) })
  if (nearArr(got.value, fwd)) return 'That accumulates from the start of the episode. The return-to-go at step t sums the rewards from t onward: loop backwards.'
  return null
}
export function diagnoseRg(c, got) {
  const T = c.rewards.length, R = rtgOf(c.rewards, c.gamma)[0]
  const withTotal = c.phis[0].map((_, i) => c.phis.reduce((s, phi, t) => s + (R - c.baseline[t]) * (c.actions[t] - c.probs[t]) * phi[i], 0))
  if (nearArr(got.value, reinforceGradOf(c.phis, c.actions, c.probs, c.rewards, c.gamma, c.baseline.map(() => 0))) && c.baseline.some(b => b)) return 'Subtract the baseline from each return-to-go: (Gₜ − bₜ).'
  if (nearArr(got.value, withTotal) && T > 1) return 'Use the return-to-go Gₜ at each step, not the whole episode’s return: an action cannot affect rewards that came before it.'
  if (nearArr(got.value, reinforceGradOf(c.phis, c.actions, c.probs, c.rewards, c.gamma, c.baseline).map(v => -v))) return 'The sign is reversed: the term is (Gₜ − bₜ)(aₜ − pₜ)φₜ.'
  return null
}
export function evaluateBaseline(vars) {
  const miss = needVars(vars, ['p_correct', 'use_baseline', 'bias'])
  if (miss) return { passed: false, message: miss }
  const p = Number(vars.p_correct.value), b = Number(vars.bias.value)
  if (p < 0.85) return { passed: false, message: `The policy picks the correct action ${r3(p)} of the time — a coin flip. Every reward is about 100, so whichever action happens to be taken gets pushed up hard; the bias weight has drifted to ${r3(b)} and the policy has collapsed onto one action. Set \`use_baseline = 1\` and run again.` }
  return { passed: true, message: `${r3(p)} correct: with the running average subtracted, only the ±0.5 that depends on the action is left to steer the policy.` }
}

// ---------- Fresh problems ----------
export const TEMPLATES = ['sigmoid', 'td', 'rtg']
export function generate(template, seed) {
  const g = rng(seed * 383 + TEMPLATES.indexOf(template) * 4481 + 191)
  if (template === 'sigmoid') { const z = g.pick([-2, -1, -0.5, 0.5, 1, 1.5, 3]), answer = 1 / (1 + Math.exp(-z)); return { template, seed, z, answer, misconceptions: [{ answer: 1 / (1 + Math.exp(z)), feedback: 'σ(z) = 1/(1 + e^(−z)): a positive score makes pushing right more likely.' }].filter(m => Math.abs(m.answer - answer) > 0.0006) } }
  if (template === 'td') { const rw = g.pick([0, 1]), gamma = g.pick([0.9, 0.95, 0.99]), v1 = g.pick([5, 8, 10, 20]), v0 = g.pick([6, 9, 12, 18]), answer = rw + gamma * v1 - v0; return { template, seed, rw, gamma, v1, v0, answer, misconceptions: [{ answer: rw + v1 - v0, feedback: 'Discount the next state’s value: γ·V(s′).' }].filter(m => Math.abs(m.answer - answer) > 1e-9) } }
  const rewards = [g.pick([1, 2]), g.pick([0, 1]), g.pick([1, 3])], gamma = g.pick([0.5, 0.9]), answer = rewards[0] + gamma * rewards[1] + gamma * gamma * rewards[2]
  return { template, seed, rewards, gamma, answer, misconceptions: [{ answer: rewards[0] + rewards[1] + rewards[2], feedback: 'Discount later rewards: γ for the next one, γ² for the one after.' }].filter(m => Math.abs(m.answer - answer) > 1e-9) }
}
export function view(p) {
  if (p.template === 'sigmoid') return { intro: `In some state the logistic policy’s score is θᵀφ(s) = ${p.z}.`, questions: [{ id: 's', type: 'number', label: 'Probability of pushing right? (Three decimals.)', answer: p.answer, tolerance: 0.0006, misconceptions: p.misconceptions }] }
  if (p.template === 'td') return { intro: `Reward ${p.rw}, γ = ${p.gamma}, the critic says V(s′) = ${p.v1} and V(s) = ${p.v0}.`, questions: [{ id: 't', type: 'number', label: 'TD error δ? (Up to two decimals.)', answer: p.answer, tolerance: 1e-9, misconceptions: p.misconceptions }] }
  return { intro: `From step t the rewards are ${p.rewards.join(', ')}, then the episode ends. γ = ${p.gamma}.`, questions: [{ id: 'g', type: 'number', label: 'Return-to-go Gₜ?', answer: p.answer, tolerance: 1e-9, misconceptions: p.misconceptions }] }
}
export function workedSolution(p) {
  if (p.template === 'sigmoid') return `σ(${p.z}) = 1/(1 + e^(${-p.z})) = **${r3(p.answer)}**.`
  if (p.template === 'td') return `${p.rw} + ${p.gamma} × ${p.v1} − ${p.v0} = **${r3(p.answer)}**.`
  return `${p.rewards[0]} + ${p.gamma} × ${p.rewards[1]} + ${p.gamma}² × ${p.rewards[2]} = **${r3(p.answer)}**.`
}

export const pg = {
  title: 'Policy gradients: scores, returns and baselines',
  version: 1,
  templates: TEMPLATES,
  templateNames: { sigmoid: 'Policy probability', td: 'TD error', rtg: 'Return-to-go' },
  generate, view, workedSolution,
  intro: 'Seven steps: policy-gradient arithmetic by hand, a reward offset that drowns the learning signal, and writing the score function, returns-to-go and the REINFORCE gradient with a baseline. Nothing here locks the rest of the lab.',
  steps: [
    {
      id: 'trace', kind: 'trace', title: 'Policy-gradient arithmetic by hand',
      prompt: 'A logistic policy has θᵀφ(s) = 0. At another step p = 0.8, the agent pushed right (a = 1), φᵢ = 1 and the return-to-go is 50. From some step the rewards are 1 and 1, then the episode ends, with γ = 0.9. A critic says V(s) = 4 and V(s′) = 3; r = 1, γ = 1.',
      fields: [
        { label: 'Probability of pushing right at θᵀφ = 0', answer: 0.5, tolerance: 1e-9 },
        { label: 'That step’s gradient term for θᵢ', answer: 10, tolerance: 1e-9 },
        { label: 'Return-to-go', answer: 1.9, tolerance: 1e-9 },
        { label: 'TD error δ', answer: 0, tolerance: 1e-9 },
      ],
      explain: 'σ(0) = 0.5. (1 − 0.8) × 1 × 50 = 10. 1 + 0.9 × 1 = 1.9. 1 + 1 × 3 − 4 = 0.',
    },
    {
      id: 'agree', kind: 'probe', title: 'A reward offset',
      prompt: 'A one-step problem: push right when x > 0. The correct action earns 101 and the wrong one 100. Run REINFORCE without a baseline: the policy learns nothing. **Set `use_baseline = 1`** and run again.',
      starter: `import numpy as np
rng = np.random.default_rng(58)
# One-step problem: a context x in [-1, 1]; pushing right (a = 1) is correct when x > 0.
# Reward 101 for the correct action, 100 for the wrong one -- a large offset that says nothing about the action.
use_baseline = 0          # 1: subtract a running average of the reward from it before the policy-gradient step
theta, b, lr = np.zeros(2), 0.0, 0.05
for step in range(5000):
    x = rng.uniform(-1, 1); f = np.array([x, 1.0]); p = 1 / (1 + np.exp(-f @ theta))
    a = int(rng.random() < p); reward = 100 + float(a == (x > 0))
    theta += lr * (reward - (b if use_baseline else 0)) * (a - p) * f
    b += 0.05 * (reward - b)
xs = np.linspace(-1, 1, 201); ps = 1 / (1 + np.exp(-(xs * theta[0] + theta[1])))
p_correct = float(np.mean(np.where(xs > 0, ps, 1 - ps))); bias = float(theta[1])
print(f"use_baseline = {use_baseline}: after 5,000 steps the policy picks the correct action with probability {p_correct:.3f} on average; theta = {np.round(theta, 2)}")`,
      probe: ['p_correct', 'use_baseline', 'bias'],
      evaluate: evaluateBaseline,
      done: 'Rewards in real problems often carry large offsets (a score out of 1,000, a survival bonus per step). A baseline — or normalizing advantages — removes them.',
    },
    {
      id: 'fill', kind: 'function', title: 'Fill in the score function',
      prompt: 'Replace `___` with ∇θ log π(a | s) for the logistic policy, given the features φ(s), the action a (1 = right) and p = π(right | s).',
      starter: `import numpy as np

def grad_log_pi(phi, a, p):
    """Gradient of log pi(a | s) with respect to theta for pi(right | s) = sigmoid(theta . phi)."""
    return ___`,
      hint: '(a − p)·φ.',
      solution: 'return (a - p) * phi',
      check: { fn: 'grad_log_pi', args: ['phi', 'a', 'p'], ints: ['a'], cases: LOG_CASES, describe: c => `a = ${c.a}, p = ${c.p}`, diagnose: diagnoseLog },
    },
    {
      id: 'repair', kind: 'function', title: 'Repair a planted bug',
      prompt: 'For rewards (1, 1, 1) and γ = 0.5 this function returns **(1, 1.5, 1.75)**. The first step should see all three rewards ahead of it: (1.75, 1.5, 1). Fix it.',
      starter: `import numpy as np

def returns_to_go(rewards, gamma):
    """G_t = r_t + gamma r_{t+1} + gamma^2 r_{t+2} + ... for every step t."""
    G = np.zeros(len(rewards)); run = 0.0
    for t in range(len(rewards)):
        run = rewards[t] + gamma * run
        G[t] = run
    return G`,
      hint: 'Which rewards does the running sum contain when it reaches step t?',
      solution: 'for t in reversed(range(len(rewards))):',
      check: { fn: 'returns_to_go', args: ['rewards', 'gamma'], cases: RTG_CASES, describe: c => `${c.rewards.length} steps, γ = ${c.gamma}`, diagnose: diagnoseRtg },
      explainChoice: {
        prompt: 'Why weight each action by the rewards after it, and not by the whole episode’s return?',
        options: [
          { text: 'An action cannot change rewards that were already received. Those earlier rewards only add noise to its weight; dropping them keeps the expected gradient and lowers the variance.', correct: true },
          { text: 'Because later rewards are larger.', feedback: 'With discounting they are smaller; size is not the reason.' },
          { text: 'To make the episode shorter.', feedback: 'The episode is the same; only the weighting changes.' },
          { text: 'Because the whole return would bias the gradient.', feedback: 'It is unbiased too, just noisier.' },
        ],
        rightFeedback: 'That is the policy-gradient theorem in its usual form.',
      },
    },
    {
      id: 'implement', kind: 'function', title: 'The REINFORCE gradient with a baseline',
      prompt: 'Write `reinforce_gradient` from its contract.',
      starter: `import numpy as np

def reinforce_gradient(phis, actions, probs, rewards, gamma, baseline):
    """One episode's gradient estimate: sum over t of (G_t - baseline_t) * (a_t - p_t) * phi_t,
    where G_t is the discounted return-to-go from step t.

    phis: (T, d) features; actions, probs, rewards, baseline: length T.
    Example: reinforce_gradient([[1, 0], [0, 1]], [1, 0], [0.5, 0.5], [1, 1], 1, [0, 0])  ->  [1, -0.5]
    """
    pass   # replace with your code`,
      hint: 'Compute G backwards as in step 4, then np.sum(((G - baseline) * (actions - probs))[:, None] * phis, axis=0).',
      solution: 'G = np.zeros(len(rewards)); run = 0.0\nfor t in reversed(range(len(rewards))):\n    run = rewards[t] + gamma * run; G[t] = run\nreturn (((G - baseline) * (actions - probs))[:, None] * phis).sum(axis=0)',
      check: { fn: 'reinforce_gradient', args: ['phis', 'actions', 'probs', 'rewards', 'gamma', 'baseline'], ints: ['actions'], cases: RG_CASES, describe: c => `${c.rewards.length} steps`, diagnose: diagnoseRg },
    },
    { id: 'transfer', kind: 'transfer', title: 'Solve new problems', prompt: 'New scores, critics and reward sequences. Solve one of each kind without opening the worked answer.' },
    { id: 'review', kind: 'review', title: 'Come back later', prompt: 'A fresh problem after a gap. The first return is suggested a day after you finish step 6; “Do it now” is always there and is recorded as early.' },
  ],
}
