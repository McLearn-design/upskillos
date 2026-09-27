// Code that tools/verify-ladders.mjs runs through the real check harness (see labs/l03-matrices).
const pm = body => `import numpy as np\n\ndef perceptron_mistakes(X, y):\n${body}\n`
export const verify = {
  online: {
    pass: {
      agree: s => s.starter.replace('policy = "greedy" ', 'policy = "ts" '),
      fill: [s => s.starter.replace('return ___', 'return w / w.sum()'), s => s.starter.replace('return ___', 'return w / np.sum(w)')],
      repair: [s => s.starter.replace('2 * np.log(t) / counts', 'np.sqrt(2 * np.log(t) / counts)')],
      implement: [
        () => pm('    w = np.zeros(X.shape[1]); m = 0\n    for x, t in zip(X, y):\n        if t * (w @ x) <= 0:\n            w = w + t * x; m += 1\n    return m'),
      ],
    },
    fail: {
      agree: [{ code: s => s.starter, message: /policy = "ts"/ }],
      fill: [{ code: s => s.starter.replace('return ___', 'return w'), hint: /Normalize/ }],
      repair: [{ code: s => s.starter, hint: /square root/ }],
      implement: [
        { code: s => s.starter, text: /returned None/ },
        { code: () => pm('    w = np.zeros(X.shape[1]); m = 0\n    for x, t in zip(X, y):\n        if t * (w @ x) < 0:\n            w = w + t * x; m += 1\n    return m'), hint: /zero score/ },
      ],
    },
  },
}
