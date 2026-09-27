// Code that tools/verify-ladders.mjs runs through the real check harness (see labs/l03-matrices).
const dpo = body => `import numpy as np\n\ndef dpo_loss(logp_w, ref_w, logp_l, ref_l, beta):\n${body}\n`
const M = '    margin = beta * ((logp_w - ref_w) - (logp_l - ref_l))\n'
export const verify = {
  lm: {
    pass: {
      agree: s => s.starter.replace('k = 0.0 ', 'k = 0.1 '),
      fill: [s => s.starter.replace('return ___', 'return 2 ** np.mean(-np.log2(probs))'), s => s.starter.replace('return ___', 'return np.exp(np.mean(-np.log(probs)))')],
      repair: [s => s.starter.replace('keep[order[cum < p]] = True', 'keep[order[cum - probs[order] < p]] = True')],
      implement: [() => dpo(M + '    return np.logaddexp(0, -margin)')],
    },
    fail: {
      agree: [{ code: s => s.starter, message: /k = 0\.1/ }],
      fill: [
        { code: s => s.starter.replace('return ___', 'return np.mean(-np.log2(probs))'), hint: /bits per token/ },
        { code: s => s.starter.replace('return ___', 'return 2 ** np.sum(-np.log2(probs))'), hint: /do not sum/ },
        { code: s => s.starter.replace('return ___', 'return 2 ** np.mean(-np.log(probs))'), hint: /one base/ },
      ],
      repair: [{ code: s => s.starter, hint: /carries the total past p/ }],
      implement: [
        { code: s => s.starter, text: /returned None/ },
        { code: () => dpo(M + '    return np.logaddexp(0, margin)'), hint: /sign is flipped/ },
        { code: () => dpo('    return np.logaddexp(0, -((logp_w - ref_w) - (logp_l - ref_l)))'), hint: /by β/ },
        { code: () => dpo(M + '    return margin'), hint: /margin itself/ },
      ],
    },
  },
}
