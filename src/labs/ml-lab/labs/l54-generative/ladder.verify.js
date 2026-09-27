// Code that tools/verify-ladders.mjs runs through the real check harness (see labs/l03-matrices).
const dl = body => `import numpy as np\n\ndef d_loss(real_logits, fake_logits):\n${body}\n`
export const verify = {
  gen: {
    pass: {
      agree: s => s.starter.replace('T, b1 = 40, 0.02 ', 'T, b1 = 40, 0.25 '),
      fill: [s => s.starter.replace('return ___', 'return np.sqrt(abar[t]) * x0 + np.sqrt(1 - abar[t]) * eps')],
      repair: [s => s.starter.replace(') / np.sqrt(abar[t])', ') / np.sqrt(alphas[t])')],
      implement: [() => dl('    return np.mean(np.logaddexp(0, -real_logits)) + np.mean(np.logaddexp(0, fake_logits))')],
    },
    fail: {
      agree: [{ code: s => s.starter, message: /b1 = 0\.25/ }],
      fill: [
        { code: s => s.starter.replace('return ___', 'return abar[t] * x0 + (1 - abar[t]) * eps'), hint: /square roots/ },
        { code: s => s.starter.replace('return ___', 'return np.sqrt(abar[t]) * x0 + np.sqrt(abar[t]) * eps'), hint: /√\(1 − ᾱ_t\)/ },
      ],
      repair: [{ code: s => s.starter, hint: /√α_t/ }],
      implement: [
        { code: s => s.starter, text: /returned None/ },
        { code: () => dl('    s = lambda l: 1 / (1 + np.exp(-l))\n    return np.mean(-np.log(s(real_logits))) + np.mean(-np.log(1 - s(fake_logits)))'), hint: /logaddexp/ },
        { code: () => dl('    return np.mean(np.logaddexp(0, real_logits)) + np.mean(np.logaddexp(0, -fake_logits))'), hint: /swapped/ },
        { code: () => dl('    return np.sum(np.logaddexp(0, -real_logits)) + np.sum(np.logaddexp(0, fake_logits))'), hint: /do not sum/ },
      ],
    },
  },
}
