// Code that tools/verify-ladders.mjs runs through the real check harness (see labs/l03-matrices).
const kappa = body => `import numpy as np\n\ndef cohen_kappa(a, b):\n${body}\n`
export const verify = {
  fewlabels: {
    pass: {
      agree: s => s.starter.replace('k = 2 ', 'k = 10 '),
      fill: [s => s.starter.replace('return ___', 'return int(np.argmin(np.abs(probs - 0.5)))')],
      repair: [s => s.starter.replace('    S = U @ U.T / tau\n', '    S = U @ U.T / tau\n    np.fill_diagonal(S, -np.inf)\n')],
      implement: [() => kappa('    po = np.mean(a == b); pa, pb = a.mean(), b.mean()\n    pe = pa * pb + (1 - pa) * (1 - pb)\n    return (po - pe) / (1 - pe)')],
    },
    fail: {
      agree: [{ code: s => s.starter, message: /k = 10/ }],
      fill: [
        { code: s => s.starter.replace('return ___', 'return int(np.argmax(np.abs(probs - 0.5)))'), hint: /most sure/ },
        { code: s => s.starter.replace('return ___', 'return int(np.argmin(probs))'), hint: /confidently in class 0/ },
      ],
      repair: [{ code: s => s.starter, hint: /compared with itself/ }],
      implement: [
        { code: s => s.starter, text: /returned None/ },
        { code: () => kappa('    return np.mean(a == b)'), hint: /raw agreement/ },
        { code: () => kappa('    po = np.mean(a == b)\n    return (po - 0.5) / 0.5'), hint: /not always 0\.5/ },
      ],
    },
  },
}
