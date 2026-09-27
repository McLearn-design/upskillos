// Code that tools/verify-ladders.mjs runs through the real check harness (see labs/l03-matrices).
const ev = body => `import math\n\ndef log_evidence(a, b, h, t):\n${body}\n`
export const verify = {
  bayes: {
    pass: {
      agree: s => s.starter.replace('use_weight_uncertainty = 0 ', 'use_weight_uncertainty = 1 '),
      fill: [s => s.starter.replace('return ___', 'return beta * S @ Phi.T @ y'), s => s.starter.replace('return ___', 'return np.linalg.solve(Phi.T @ Phi + (alpha / beta) * np.eye(Phi.shape[1]), Phi.T @ y)')],
      repair: [s => s.starter.replace('return np.sqrt(1 / beta) + np.sqrt(f @ S @ f)', 'return np.sqrt(1 / beta + f @ S @ f)')],
      implement: [
        () => ev('    lb = lambda x, y: math.lgamma(x) + math.lgamma(y) - math.lgamma(x + y)\n    return lb(a + h, b + t) - lb(a, b)'),
        () => ev('    from scipy.special import betaln\n    return betaln(a + h, b + t) - betaln(a, b)'),
      ],
    },
    fail: {
      agree: [{ code: s => s.starter, message: /use_weight_uncertainty = 1/ }],
      fill: [{ code: s => s.starter.replace('return ___', 'return S @ Phi.T @ y'), hint: /noise precision β/ }],
      repair: [{ code: s => s.starter, hint: /do not add/ }, { code: s => s.starter.replace('return np.sqrt(1 / beta) + np.sqrt(f @ S @ f)', 'return np.sqrt(f @ S @ f)'), hint: /noise variance/ }],
      implement: [
        { code: s => s.starter, text: /returned None/ },
        { code: () => ev('    lb = lambda x, y: math.lgamma(x) + math.lgamma(y) - math.lgamma(x + y)\n    return lb(a, b) - lb(a + h, b + t)'), hint: /sign is flipped/ },
      ],
    },
  },
}
