// Code that tools/verify-ladders.mjs runs through the real check harness (see labs/l03-matrices).
const ln = body => `import numpy as np\n\ndef layer_norm(x, eps=1e-5):\n${body}\n`
export const verify = {
  dlreg: {
    pass: {
      agree: s => s.starter.replace('eval_mode = 0 ', 'eval_mode = 1 '),
      fill: [s => s.starter.replace('return ___', 'return h * mask / (1 - p)')],
      repair: [s => s.starter.replace('    mu, var = x.mean(axis=0), x.var(axis=0)\n    return gamma * (x - mu) / np.sqrt(var + eps) + beta', '    return gamma * (x - run_mean) / np.sqrt(run_var + eps) + beta')],
      implement: [() => ln('    m = x.mean(axis=1, keepdims=True); v = x.var(axis=1, keepdims=True)\n    return (x - m) / np.sqrt(v + eps)')],
    },
    fail: {
      agree: [{ code: s => s.starter, message: /eval_mode = 1/ }],
      fill: [
        { code: s => s.starter.replace('return ___', 'return h * mask'), hint: /1\/\(1 − p\)/ },
        { code: s => s.starter.replace('return ___', 'return h * mask * (1 - p)'), hint: /not multiply/ },
      ],
      repair: [{ code: s => s.starter, hint: /training mode/ }],
      implement: [
        { code: s => s.starter, text: /returned None/ },
        { code: () => ln('    return x - x.mean(axis=0, keepdims=True)'), hint: /axis 1/ },
      ],
    },
  },
}
