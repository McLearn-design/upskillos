// Code that tools/verify-ladders.mjs runs through the real check harness (see labs/l03-matrices).
const rh = body => `import numpy as np\n\ndef rhat(chains):\n${body}\n`
export const verify = {
  sampling: {
    pass: {
      agree: s => s.starter.replace('step = 0.1 ', 'step = 1.5 '),
      fill: [s => s.starter.replace('return ___', 'return w.sum() ** 2 / (w ** 2).sum()'), s => s.starter.replace('return ___', 'return 1 / np.sum((w / w.sum()) ** 2)')],
      repair: [s => s.starter.replace('return int(u < ly - lx)', 'return int(np.log(u) < ly - lx)'), s => s.starter.replace('return int(u < ly - lx)', 'return int(u < np.exp(ly - lx))')],
      implement: [
        () => rh('    m, n = chains.shape\n    W = chains.var(axis=1, ddof=1).mean()\n    B = n * chains.mean(axis=1).var(ddof=1)\n    return np.sqrt(((n - 1) / n * W + B / n) / W)'),
      ],
    },
    fail: {
      agree: [{ code: s => s.starter, message: /step = 1\.5/ }],
      fill: [
        { code: s => s.starter.replace('return ___', 'return np.sum((w / w.sum()) ** 2)'), hint: /reciprocal/ },
        { code: s => s.starter.replace('return ___', 'return float(len(w))'), hint: /not the number of samples/ },
      ],
      repair: [{ code: s => s.starter, hint: /log ratio/ }],
      implement: [
        { code: s => s.starter, text: /returned None/ },
        { code: () => rh('    m, n = chains.shape\n    W = chains.var(axis=1, ddof=1).mean()\n    B = n * chains.mean(axis=1).var(ddof=1)\n    return ((n - 1) / n * W + B / n) / W'), hint: /square root/ },
      ],
    },
  },
}
