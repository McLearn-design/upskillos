// Code that tools/verify-ladders.mjs runs through the real check harness (see labs/l03-matrices).
const rg = body => `import numpy as np\n\ndef reinforce_gradient(phis, actions, probs, rewards, gamma, baseline):\n${body}\n`
const G = '    G = np.zeros(len(rewards)); run = 0.0\n    for t in reversed(range(len(rewards))):\n        run = rewards[t] + gamma * run; G[t] = run\n'
export const verify = {
  pg: {
    pass: {
      agree: s => s.starter.replace('use_baseline = 0 ', 'use_baseline = 1 '),
      fill: [s => s.starter.replace('return ___', 'return (a - p) * phi')],
      repair: [s => s.starter.replace('for t in range(len(rewards)):', 'for t in reversed(range(len(rewards))):')],
      implement: [
        () => rg(G + '    return (((G - baseline) * (actions - probs))[:, None] * phis).sum(axis=0)'),
        () => rg(G + '    g = np.zeros(phis.shape[1])\n    for t in range(len(rewards)):\n        g += (G[t] - baseline[t]) * (actions[t] - probs[t]) * phis[t]\n    return g'),
      ],
    },
    fail: {
      agree: [{ code: s => s.starter, message: /use_baseline = 1/ }],
      fill: [
        { code: s => s.starter.replace('return ___', 'return (p - a) * phi'), hint: /sign is reversed/ },
        { code: s => s.starter.replace('return ___', 'return a * phi'), hint: /Subtract the probability/ },
        { code: s => s.starter.replace('return ___', 'return (1 - p) * phi'), hint: /ignores which action/ },
      ],
      repair: [{ code: s => s.starter, hint: /loop backwards/ }],
      implement: [
        { code: s => s.starter, text: /returned None/ },
        { code: () => rg(G + '    return ((G * (actions - probs))[:, None] * phis).sum(axis=0)'), hint: /Subtract the baseline/ },
        { code: () => rg(G + '    return (((G[0] - baseline) * (actions - probs))[:, None] * phis).sum(axis=0)'), hint: /return-to-go/ },
        { code: () => rg(G + '    return -(((G - baseline) * (actions - probs))[:, None] * phis).sum(axis=0)'), hint: /sign is reversed/ },
      ],
    },
  },
}
