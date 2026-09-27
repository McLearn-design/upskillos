// Code that tools/verify-ladders.mjs runs through the real check harness (see labs/l03-matrices).
const ll = body => `import numpy as np\n\ndef log_likelihood(pi, A, B, x):\n${body}\n`
export const verify = {
  hmm: {
    pass: {
      agree: s => s.starter.replace('scale = False ', 'scale = True '),
      fill: [s => s.starter.replace('return ___', 'return b * (alpha_prev @ A)'), s => s.starter.replace('return ___', 'return b * (A.T @ alpha_prev)')],
      repair: [s => s.starter.replace('C.sum(axis=0, keepdims=True)', 'C.sum(axis=1, keepdims=True)')],
      implement: [
        () => ll('    total, alpha = 0.0, None\n    for t, o in enumerate(x):\n        alpha = B[:, o] * (pi if t == 0 else alpha @ A)\n        c = alpha.sum(); total += np.log(c); alpha = alpha / c\n    return total'),
      ],
    },
    fail: {
      agree: [{ code: s => s.starter, message: /scale = True/ }],
      fill: [
        { code: s => s.starter.replace('return ___', 'return b * (A @ alpha_prev)'), hint: /alpha_prev @ A/ },
        { code: s => s.starter.replace('return ___', 'return alpha_prev @ A'), hint: /multiply by b/ },
      ],
      repair: [{ code: s => s.starter, hint: /row sum/ }],
      implement: [
        { code: s => s.starter, text: /returned None/ },
        { code: () => ll('    total, alpha = 0.0, None\n    for t, o in enumerate(x):\n        alpha = B[:, o] * (pi if t == 0 else alpha @ A)\n        c = alpha.sum(); total += np.log(c); alpha = alpha / c\n    return np.exp(total)'), hint: /not the probability/ },
      ],
    },
  },
}
