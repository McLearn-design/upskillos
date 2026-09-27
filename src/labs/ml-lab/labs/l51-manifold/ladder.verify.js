// Code that tools/verify-ladders.mjs runs through the real check harness (see labs/l03-matrices).
const ku = body => `import numpy as np\n\ndef excess_kurtosis(x):\n${body}\n`
export const verify = {
  manifold: {
    pass: {
      agree: s => s.starter.replace('k = 20 ', 'k = 8 '),
      fill: [s => s.starter.replace('return ___', 'return 2 ** (-np.sum(p * np.log2(p)))'), s => s.starter.replace('return ___', 'return float(np.exp(-np.sum(p * np.log(p))))')],
      repair: [s => s.starter.replace('return -0.5 * D ** 2', 'n = len(D); H = np.eye(n) - 1 / n\n    return -0.5 * H @ (D ** 2) @ H')],
      implement: [() => ku('    c = x - x.mean()\n    return np.mean(c ** 4) / np.mean(c ** 2) ** 2 - 3'), () => ku('    from scipy.stats import kurtosis\n    return kurtosis(x)')],
    },
    fail: {
      agree: [{ code: s => s.starter, message: /k = 8/ }],
      fill: [{ code: s => s.starter.replace('return ___', 'return -np.sum(p * np.log2(p))'), hint: /entropy in bits/ }],
      repair: [{ code: s => s.starter, hint: /Double-centre/ }],
      implement: [
        { code: s => s.starter, text: /returned None/ },
        { code: () => ku('    c = x - x.mean()\n    return np.mean(c ** 4) / np.mean(c ** 2) ** 2'), hint: /subtracts 3/ },
      ],
    },
  },
}
