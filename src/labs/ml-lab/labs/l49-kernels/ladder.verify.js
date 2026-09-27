// Code that tools/verify-ladders.mjs runs through the real check harness (see labs/l03-matrices).
const cg = body => `import numpy as np\n\ndef center_gram(K):\n${body}\n`
export const verify = {
  kernels: {
    pass: {
      agree: s => s.starter.replace('kernel = "tanh" ', 'kernel = "rbf" '),
      fill: [s => s.starter.replace('return ___', 'return np.exp(-gamma * ((A[:, None, :] - B[None, :, :]) ** 2).sum(-1))'), s => s.starter.replace('return ___', 'return np.exp(-gamma * ((A ** 2).sum(1)[:, None] + (B ** 2).sum(1)[None, :] - 2 * A @ B.T))')],
      repair: [s => s.starter.replace('np.linalg.solve(K + lam, y)', 'np.linalg.solve(K + lam * np.eye(len(y)), y)')],
      implement: [() => cg('    r = K.mean(axis=1, keepdims=True)\n    return K - r - r.T + K.mean()'), () => cg('    n = len(K)\n    H = np.eye(n) - np.ones((n, n)) / n\n    return H @ K @ H')],
    },
    fail: {
      agree: [{ code: s => s.starter, message: /kernel = "rbf"/ }],
      fill: [
        { code: s => s.starter.replace('return ___', 'return np.exp(-gamma * np.sqrt(((A[:, None, :] - B[None, :, :]) ** 2).sum(-1)))'), hint: /Laplacian/ },
        { code: s => s.starter.replace('return ___', 'return np.exp(gamma * ((A[:, None, :] - B[None, :, :]) ** 2).sum(-1))'), hint: /negative/ },
      ],
      repair: [{ code: s => s.starter, hint: /diagonal only/ }],
      implement: [
        { code: s => s.starter, text: /returned None/ },
        { code: () => cg('    r = K.mean(axis=1, keepdims=True)\n    return K - r - r.T'), hint: /overall mean/ },
      ],
    },
  },
}
