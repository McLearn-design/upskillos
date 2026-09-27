// Code that tools/verify-ladders.mjs runs through the real check harness (see labs/l03-matrices).
const pp = body => `import numpy as np\n\ndef perplexity(probs):\n${body}\n`
export const verify = {
  info: {
    pass: {
      agree: s => s.starter.replace('compare_to_shuffled = 0 ', 'compare_to_shuffled = 1 '),
      fill: [s => s.starter.replace('return ___', 'return np.sum(p * np.log2(p / q))'), s => s.starter.replace('return ___', 'return np.sum(p * (np.log(p) - np.log(q))) / np.log(2)')],
      repair: [s => s.starter.replace('-np.sum(p * np.log(p))', '-np.sum(p * np.log2(p))')],
      implement: [() => pp('    return 2 ** np.mean(-np.log2(probs))'), () => pp('    return float(np.exp(np.mean(-np.log(probs))))')],
    },
    fail: {
      agree: [{ code: s => s.starter, message: /compare_to_shuffled = 1/ }],
      fill: [
        { code: s => s.starter.replace('return ___', 'return np.sum(q * np.log2(q / p))'), hint: /KL\(q ‖ p\)/ },
        { code: s => s.starter.replace('return ___', 'return np.sum(p * np.log(p / q))'), hint: /nats/ },
      ],
      repair: [{ code: s => s.starter, hint: /np\.log2/ }],
      implement: [
        { code: s => s.starter, text: /returned None/ },
        { code: () => pp('    return np.mean(-np.log2(probs))'), hint: /2 raised/ },
      ],
    },
  },
}
