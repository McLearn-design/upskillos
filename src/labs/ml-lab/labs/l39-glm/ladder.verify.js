// Code that tools/verify-ladders.mjs runs through the real check harness (see labs/l03-matrices).
const ns = body => `import numpy as np\n\ndef newton_step(theta, X, y):\n${body}\n`
export const verify = {
  glm: {
    pass: {
      agree: s => s.starter.replace('method = "gd" ', 'method = "newton" '),
      fill: [s => s.starter.replace('___', 'X.T @ (np.exp(X @ theta) - y) / len(y)'), s => s.starter.replace('___', 'np.mean((np.exp(X @ theta) - y)[:, None] * X, axis=0)')],
      repair: [s => s.starter.replace('/ tau ** 2)', '/ (2 * tau ** 2))')],
      implement: [
        () => ns('    p = 1 / (1 + np.exp(-(X @ theta)))\n    g = X.T @ (p - y) / len(y)\n    H = X.T @ (X * (p * (1 - p))[:, None]) / len(y)\n    return theta - np.linalg.solve(H, g)'),
        () => ns('    p = 1 / (1 + np.exp(-(X @ theta)))\n    W = np.diag(p * (1 - p))\n    return theta - np.linalg.inv(X.T @ W @ X / len(y)) @ (X.T @ (p - y) / len(y))'),
      ],
    },
    fail: {
      agree: [{ code: s => s.starter, message: /method = "newton"/ }],
      fill: [
        { code: s => s.starter.replace('___', 'X.T @ (X @ theta - y) / len(y)'), hint: /Gaussian gradient/ },
        { code: s => s.starter.replace('___', 'X.T @ (y - np.exp(X @ theta)) / len(y)'), hint: /sign is flipped/ },
      ],
      repair: [{ code: s => s.starter, hint: /factor 2 is missing/ }],
      implement: [
        { code: s => s.starter, text: /returned None/ },
        { code: () => ns('    p = 1 / (1 + np.exp(-(X @ theta)))\n    return theta - X.T @ (p - y) / len(y)'), hint: /gradient-descent step/ },
        { code: () => ns('    p = 1 / (1 + np.exp(-(X @ theta)))\n    g = X.T @ (p - y) / len(y)\n    H = X.T @ (X * (p * (1 - p))[:, None]) / len(y)\n    return theta + np.linalg.solve(H, g)'), hint: /Subtract the step/ },
      ],
    },
  },
}
