// Code that tools/verify-ladders.mjs runs through the real check harness (see labs/l03-matrices).
const pm = body => `import numpy as np\n\ndef post_mean(X, y, xs, ell, sn):\n${body}\n`
export const verify = {
  gp: {
    pass: {
      agree: s => s.starter.replace('select_by = "train" ', 'select_by = "lml" '),
      fill: [s => s.starter.replace('return ___', 'return sf ** 2 * np.exp(-(a[:, None] - b[None, :]) ** 2 / (2 * ell ** 2))'), s => s.starter.replace('return ___', 'return sf * sf * np.exp(-np.subtract.outer(a, b) ** 2 / 2 / ell ** 2)')],
      repair: [s => s.starter.replace('return 1 - np.sum(Ks * Ks, axis=1)', 'return 1 - np.sum(Ks * np.linalg.solve(Ky, Ks.T).T, axis=1)')],
      implement: [
        () => pm('    Ky = np.exp(-(X[:, None] - X[None, :]) ** 2 / (2 * ell ** 2)) + sn ** 2 * np.eye(len(X))\n    Ks = np.exp(-(xs[:, None] - X[None, :]) ** 2 / (2 * ell ** 2))\n    return Ks @ np.linalg.solve(Ky, y)'),
        () => pm('    Ky = np.exp(-(X[:, None] - X[None, :]) ** 2 / (2 * ell ** 2)) + sn ** 2 * np.eye(len(X))\n    L = np.linalg.cholesky(Ky)\n    a = np.linalg.solve(L.T, np.linalg.solve(L, y))\n    return np.exp(-(xs[:, None] - X[None, :]) ** 2 / (2 * ell ** 2)) @ a'),
      ],
    },
    fail: {
      agree: [{ code: s => s.starter, message: /select_by = "lml"/ }],
      fill: [
        { code: s => s.starter.replace('return ___', 'return sf ** 2 * np.exp(-(a[:, None] - b[None, :]) ** 2 / ell ** 2)'), hint: /factor 2 is missing/ },
        { code: s => s.starter.replace('return ___', 'return np.exp(-(a[:, None] - b[None, :]) ** 2 / (2 * ell ** 2))'), hint: /signal variance/ },
      ],
      repair: [{ code: s => s.starter, hint: /\(K \+ σn²I\)⁻¹/ }],
      implement: [
        { code: s => s.starter, text: /returned None/ },
        { code: () => pm('    Ky = np.exp(-(X[:, None] - X[None, :]) ** 2 / (2 * ell ** 2)) + 1e-12 * np.eye(len(X))\n    Ks = np.exp(-(xs[:, None] - X[None, :]) ** 2 / (2 * ell ** 2))\n    return Ks @ np.linalg.solve(Ky, y)'), hint: /noise variance/ },
      ],
    },
  },
}
