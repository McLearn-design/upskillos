// Code that tools/verify-ladders.mjs runs through the real check harness (see labs/l03-matrices).
const bb = body => `import numpy as np\n\ndef bbse_prior(C, mu):\n${body}\n`
export const verify = {
  robust: {
    pass: {
      agree: s => s.starter.replace('use_weights = 0 ', 'use_weights = 1 '),
      fill: [s => s.starter.replace('return ___', 'return np.clip(x + eps * np.sign(grad), 0, 1)'), s => s.starter.replace('return ___', 'return np.minimum(1, np.maximum(0, x + eps * np.sign(grad)))')],
      repair: [s => s.starter.replace('np.clip(moved, x_adv - eps, x_adv + eps)', 'np.clip(moved, x0 - eps, x0 + eps)')],
      implement: [() => bb('    pi = np.clip(np.linalg.solve(C, mu), 0, 1)\n    return pi / pi.sum()')],
    },
    fail: {
      agree: [{ code: s => s.starter, message: /use_weights = 1/ }],
      fill: [
        { code: s => s.starter.replace('return ___', 'return x + eps * np.sign(grad)'), hint: /Clip/ },
        { code: s => s.starter.replace('return ___', 'return np.clip(x + eps * grad, 0, 1)'), hint: /sign of the gradient/ },
        { code: s => s.starter.replace('return ___', 'return np.clip(x - eps * np.sign(grad), 0, 1)'), hint: /up the gradient/ },
      ],
      repair: [{ code: s => s.starter, hint: /original input/ }],
      implement: [
        { code: s => s.starter, text: /returned None/ },
        { code: () => bb('    pi = np.clip(np.linalg.solve(np.array(C).T, mu), 0, 1)\n    return pi / pi.sum()'), hint: /transpose/ },
        { code: () => bb('    return np.linalg.solve(C, mu)'), hint: /normalize/ },
      ],
    },
  },
}
