// Code that tools/verify-ladders.mjs runs through the real check harness (see labs/l03-matrices).
const cqr = body => `import numpy as np\n\ndef cqr(cal_lo, cal_hi, cal_y, lo, hi, alpha):\n${body}\n`
const S = '    s = np.maximum(cal_lo - cal_y, cal_y - cal_hi)\n'
export const verify = {
  uncertainty: {
    pass: {
      agree: s => s.starter.replace('use_holdout = 0 ', 'use_holdout = 1 '),
      fill: [s => s.starter.replace('k = ___', 'k = int(np.ceil((n + 1) * (1 - alpha)))'), s => s.starter.replace('k = ___', 'k = -int(-(n + 1) * (1 - alpha) // 1)')],
      repair: [s => s.starter.replace('np.where(y >= q, (1 - tau) * (y - q), tau * (q - y))', 'np.where(y >= q, tau * (y - q), (1 - tau) * (q - y))')],
      implement: [() => cqr(S + '    k = int(np.ceil((len(s) + 1) * (1 - alpha))); q = np.sort(s)[k - 1]\n    return np.array([lo - q, hi + q])')],
    },
    fail: {
      agree: [{ code: s => s.starter, message: /use_holdout = 1/ }],
      fill: [{ code: s => s.starter.replace('k = ___', 'k = int(np.ceil(n * (1 - alpha)))'), hint: /n \+ 1/ }],
      repair: [{ code: s => s.starter, hint: /swapped/ }],
      implement: [
        { code: s => s.starter, text: /returned None/ },
        { code: () => cqr('    s = np.abs(cal_y - (cal_lo + cal_hi) / 2)\n    k = int(np.ceil((len(s) + 1) * (1 - alpha))); q = np.sort(s)[k - 1]\n    return np.array([lo - q, hi + q])'), hint: /midpoint/ },
        { code: () => cqr(S + '    k = int(np.ceil((len(s) + 1) * (1 - alpha))); q = np.sort(s)[k - 1]\n    return np.array([lo + q, hi - q])'), hint: /signs are reversed/ },
        { code: () => cqr(S + '    k = int(np.ceil(len(s) * (1 - alpha))); q = np.sort(s)[k - 1]\n    return np.array([lo - q, hi + q])'), hint: /n \+ 1/ },
      ],
    },
  },
}
