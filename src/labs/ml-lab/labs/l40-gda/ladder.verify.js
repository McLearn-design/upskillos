// Code that tools/verify-ladders.mjs runs through the real check harness (see labs/l03-matrices).
const nb = body => `import numpy as np\n\ndef nb_log_odds(x, present, mu0, mu1, var, prior):\n${body}\n`
export const verify = {
  gda: {
    pass: {
      agree: s => s.starter.replace('pooled = 0 ', 'pooled = 1 '),
      fill: [s => s.starter.replace('return ___', 'return centered.T @ centered / len(y)'), s => s.starter.replace('return ___', 'return np.cov(centered.T, bias=True)')],
      repair: [s => s.starter.replace('return S @ (m1 - m0)', 'return np.linalg.solve(S, m1 - m0)')],
      implement: [
        () => nb('    t = ((x - mu0) ** 2 - (x - mu1) ** 2) / (2 * var)\n    return np.log(prior / (1 - prior)) + np.sum(t * present)'),
        () => nb('    total = np.log(prior) - np.log(1 - prior)\n    for j in range(len(x)):\n        if present[j]:\n            total += ((x[j] - mu0[j]) ** 2 - (x[j] - mu1[j]) ** 2) / (2 * var[j])\n    return total'),
      ],
    },
    fail: {
      agree: [{ code: s => s.starter, message: /pooled = 1/ }],
      fill: [{ code: s => s.starter.replace('return ___', 'return np.cov(X.T, bias=True)'), hint: /overall mean/ }],
      repair: [{ code: s => s.starter, hint: /multiplies by Σ/ }],
      implement: [
        { code: s => s.starter, text: /returned None/ },
        { code: () => nb('    t = ((x - mu0) ** 2 - (x - mu1) ** 2) / (2 * var)\n    return np.log(prior / (1 - prior)) + np.sum(t)'), hint: /must be left out/ },
        { code: () => nb('    t = ((x - mu0) ** 2 - (x - mu1) ** 2) / (2 * var)\n    return np.sum(t * present)'), hint: /prior log-odds/ },
      ],
    },
  },
}
