// Code that tools/verify-ladders.mjs runs through the real check harness (see labs/l03-matrices).
const fwd = body => `import numpy as np\n\ndef gcn_forward(A, X, W1, W2):\n${body}\n`
const AH = '    At = A + np.eye(len(A)); d = At.sum(1); Ah = At / np.sqrt(np.outer(d, d))\n'
export const verify = {
  gnn: {
    pass: {
      agree: s => s.starter.replace('k = 32 ', 'k = 4 '),
      fill: [s => s.starter.replace('return ___', 'return At / np.sqrt(np.outer(d, d))'), s => s.starter.replace('return ___', 'Dm = np.diag(d ** -0.5)\n    return Dm @ At @ Dm')],
      repair: [s => s.starter.replace('/ A.sum(axis=1)', '/ A.sum(axis=1, keepdims=True)')],
      implement: [() => fwd(AH + '    return Ah @ np.maximum(0, Ah @ X @ W1) @ W2')],
    },
    fail: {
      agree: [{ code: s => s.starter, message: /k = 4/ }, { code: s => s.starter.replace('k = 32 ', 'k = 0 '), message: /too noisy/ }],
      fill: [
        { code: s => s.starter.replace('return ___', 'return A / np.sqrt(np.outer(d, d))'), hint: /self-loops/ },
        { code: s => s.starter.replace('return ___', 'return At / np.outer(d, d)'), hint: /√\(dᵢ dⱼ\)/ },
        { code: s => s.starter.replace('return ___', 'return At / d[:, None]'), hint: /row normalization/ },
      ],
      repair: [{ code: s => s.starter, hint: /column/ }],
      implement: [
        { code: s => s.starter, text: /returned None/ },
        { code: () => fwd('    d = A.sum(1); Ah = A / np.sqrt(np.outer(d, d))\n    return Ah @ np.maximum(0, Ah @ X @ W1) @ W2'), hint: /self-loops/ },
        { code: () => fwd(AH + '    return Ah @ (Ah @ X @ W1) @ W2'), hint: /ReLU/ },
        { code: () => fwd(AH + '    return np.maximum(0, Ah @ X @ W1) @ W2'), hint: /propagate too/ },
      ],
    },
  },
}
