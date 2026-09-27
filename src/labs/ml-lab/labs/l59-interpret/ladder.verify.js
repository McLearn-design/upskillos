// Code that tools/verify-ladders.mjs runs through the real check harness (see labs/l03-matrices).
const sv = body => `import numpy as np\nfrom math import factorial\n\ndef shapley_values(v, d):\n${body}\n`
const LOOP = w => `    phi = np.zeros(d)\n    for j in range(d):\n        for S in range(2 ** d):\n            if S >> j & 1: continue\n            s = bin(S).count("1")\n            phi[j] += ${w} * (v[S | 1 << j] - v[S])\n    return phi`
export const verify = {
  interpret: {
    pass: {
      agree: s => s.starter.replace('on_test = 0 ', 'on_test = 1 '),
      fill: [s => s.starter.replace('return ___', 'return w.sum() ** 2 / (w ** 2).sum()'), s => s.starter.replace('return ___', 'return np.sum(w) ** 2 / np.dot(w, w)')],
      repair: [s => s.starter.replace('factorial(d - s) / factorial(d)', 'factorial(d - s - 1) / factorial(d)')],
      implement: [() => sv(LOOP('factorial(s) * factorial(d - s - 1) / factorial(d)'))],
    },
    fail: {
      agree: [{ code: s => s.starter, message: /on_test = 1/ }],
      fill: [
        { code: s => s.starter.replace('return ___', 'return (w ** 2).sum() / w.sum() ** 2'), hint: /reciprocal/ },
        { code: s => s.starter.replace('return ___', 'return w.sum()'), hint: /plain sum/ },
        { code: s => s.starter.replace('return ___', 'return w.sum() ** 2 / len(w)'), hint: /squared weights/ },
      ],
      repair: [{ code: s => s.starter, hint: /Off by one/ }],
      implement: [
        { code: s => s.starter, text: /returned None/ },
        { code: () => sv(LOOP('1 / 2 ** (d - 1)')), hint: /Banzhaf/ },
        { code: () => sv(LOOP('1 / 2 ** d')), hint: /add up to/ },
      ],
    },
  },
}
