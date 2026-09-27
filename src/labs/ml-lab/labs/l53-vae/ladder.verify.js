// Code that tools/verify-ladders.mjs runs through the real check harness (see labs/l03-matrices).
const elbo = body => `import numpy as np\n\ndef neg_elbo(x, x_hat, mu, logvar, beta):\n${body}\n`
const BCE = '    bce = -np.sum(x * np.log(x_hat) + (1 - x) * np.log(1 - x_hat))\n'
const KL = '    kl = 0.5 * np.sum(np.exp(logvar) + mu ** 2 - 1 - logvar)\n'
export const verify = {
  vae: {
    pass: {
      agree: s => s.starter.replace('train_clean = 0 ', 'train_clean = 1 '),
      fill: [s => s.starter.replace('return ___', 'return mu + np.exp(0.5 * logvar) * eps')],
      repair: [s => s.starter.replace('mu ** 2 - 1)', 'mu ** 2 - 1 - logvar)')],
      implement: [() => elbo(BCE + KL + '    return bce + beta * kl')],
    },
    fail: {
      agree: [{ code: s => s.starter, message: /train_clean = 1/ }],
      fill: [
        { code: s => s.starter.replace('return ___', 'return mu + np.exp(logvar) * eps'), hint: /square root/ },
        { code: s => s.starter.replace('return ___', 'return mu + logvar * eps'), hint: /exp\(0\.5/ },
      ],
      repair: [{ code: s => s.starter, hint: /− log σ² term is missing/ }],
      implement: [
        { code: s => s.starter, text: /returned None/ },
        { code: () => elbo(BCE + KL + '    return bce + kl'), hint: /by β/ },
        { code: () => elbo(BCE + '    return bce'), hint: /Add the KL/ },
        { code: () => elbo(BCE + KL + '    return bce / len(x) + beta * kl'), hint: /do not average/ },
      ],
    },
  },
}
