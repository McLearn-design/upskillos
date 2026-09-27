// Code that tools/verify-ladders.mjs runs through the real check harness (see labs/l03-matrices).
const st = body => `import numpy as np\n\ndef ista_step(w, X, y, lam, t):\n${body}\n`
export const verify = {
  convex: {
    pass: {
      agree: s => s.starter.replace('step = 3 / L ', 'step = 1 / L '),
      fill: [s => s.starter.replace('return ___', 'return np.sign(v) * np.maximum(np.abs(v) - t, 0)'), s => s.starter.replace('return ___', 'return np.where(v > t, v - t, np.where(v < -t, v + t, 0.0))')],
      repair: [s => s.starter.replace('return alpha @ X', 'return (alpha * y) @ X')],
      implement: [() => st('    v = w - t * X.T @ (X @ w - y) / len(y)\n    return np.sign(v) * np.maximum(np.abs(v) - t * lam, 0)')],
    },
    fail: {
      agree: [{ code: s => s.starter, message: /step = 1 \/ L/ }],
      fill: [
        { code: s => s.starter.replace('return ___', 'return v - t'), hint: /toward zero/ },
        { code: s => s.starter.replace('return ___', 'return np.where(np.abs(v) <= t, 0.0, v)'), hint: /hard-thresholding/ },
      ],
      repair: [{ code: s => s.starter, hint: /yᵢ/ }],
      implement: [
        { code: s => s.starter, text: /returned None/ },
        { code: () => st('    return w - t * X.T @ (X @ w - y) / len(y)'), hint: /proximal step/ },
        { code: () => st('    v = w - t * X.T @ (X @ w - y) / len(y)\n    return np.sign(v) * np.maximum(np.abs(v) - lam, 0)'), hint: /t·λ/ },
      ],
    },
  },
}
