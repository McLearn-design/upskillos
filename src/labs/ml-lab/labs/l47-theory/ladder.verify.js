// Code that tools/verify-ladders.mjs runs through the real check harness (see labs/l03-matrices).
const il = body => `def interval_labellings(n):\n${body}\n`
export const verify = {
  theory: {
    pass: {
      agree: s => s.starter.replace('report_on_test = 0 ', 'report_on_test = 1 '),
      fill: [s => s.starter.replace('return ___', 'return np.sqrt((np.log(H) + np.log(2 / delta)) / (2 * n))')],
      repair: [s => s.starter.replace('np.log(2 / delta) / (2 * eps ** 2)', '(np.log(H) + np.log(2 / delta)) / (2 * eps ** 2)')],
      implement: [
        () => il('    return 1 + n * (n + 1) // 2'),
        () => il('    from itertools import product\n    count = 0\n    for lab in product([0, 1], repeat=n):\n        ones = [i for i, v in enumerate(lab) if v]\n        if not ones or all(lab[ones[0]:ones[-1] + 1]):\n            count += 1\n    return count'),
      ],
    },
    fail: {
      agree: [{ code: s => s.starter, message: /report_on_test = 1/ }],
      fill: [
        { code: s => s.starter.replace('return ___', 'return np.sqrt(np.log(2 / delta) / (2 * n))'), hint: /one fixed hypothesis/ },
        { code: s => s.starter.replace('return ___', 'return np.sqrt((H + np.log(2 / delta)) / (2 * n))'), hint: /logarithm/ },
      ],
      repair: [{ code: s => s.starter, hint: /Include ln\|H\|/ }],
      implement: [
        { code: s => s.starter, text: /returned None/ },
        { code: () => il('    return 2 ** n'), hint: /contiguous/ },
        { code: () => il('    return n * (n + 1) // 2'), hint: /no ones/ },
      ],
    },
  },
}
