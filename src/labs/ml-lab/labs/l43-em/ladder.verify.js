// Code that tools/verify-ladders.mjs runs through the real check harness (see labs/l03-matrices).
const bc = body => `import numpy as np\n\ndef bic(ll, K, d, n):\n${body}\n`
export const verify = {
  em: {
    pass: {
      agree: s => s.starter.replace('n_starts = 1 ', 'n_starts = 5 '),
      fill: [s => s.starter.replace('return ___', 'return (R.T @ X) / R.sum(axis=0)[:, None]'), s => s.starter.replace('return ___', 'return np.array([np.average(X, axis=0, weights=R[:, k]) for k in range(R.shape[1])])')],
      repair: [s => s.starter.replace('W.sum(axis=0, keepdims=True)', 'W.sum(axis=1, keepdims=True)')],
      implement: [
        () => bc('    p = (K - 1) + K * d + K * d * (d + 1) / 2\n    return -2 * ll + p * np.log(n)'),
      ],
    },
    fail: {
      agree: [{ code: s => s.starter, message: /n_starts = 5/ }],
      fill: [
        { code: s => s.starter.replace('return ___', 'return np.tile(X.mean(axis=0), (R.shape[1], 1))'), hint: /Weight each point/ },
        { code: s => s.starter.replace('return ___', 'return (R.T @ X) / len(X)'), hint: /effective count/ },
      ],
      repair: [{ code: s => s.starter, hint: /each point’s row/ }],
      implement: [
        { code: s => s.starter, text: /returned None/ },
        { code: () => bc('    p = (K - 1) + K * d + K * d * d\n    return -2 * ll + p * np.log(n)'), hint: /d\(d \+ 1\)\/2/ },
        { code: () => bc('    p = (K - 1) + K * d + K * d * (d + 1) / 2\n    return -2 * ll + p'), hint: /log n/ },
      ],
    },
  },
}
