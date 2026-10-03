// Numerical building blocks for the statistical distributions.
// Each is a standard algorithm, referenced so a curious learner can look it up.

// Complementary error function erfc(x), from a Chebyshev fit accurate to
// about 1e-16 (Numerical Recipes, 3rd ed., section 6.2.2). Simpler textbook
// approximations are only good to 1e-7, not enough for NORM.S.INV round trips.
const ERFC_COF = [-1.3026537197817094, 6.4196979235649026e-1, 1.9476473204185836e-2, -9.561514786808631e-3, -9.46595344482036e-4,
  3.66839497852761e-4, 4.2523324806907e-5, -2.0278578112534e-5, -1.624290004647e-6, 1.303655835580e-6, 1.5626441722e-8, -8.5238095915e-8,
  6.529054439e-9, 5.059343495e-9, -9.91364156e-10, -2.27365122e-10, 9.6467911e-11, 2.394038e-12, -6.886027e-12, 8.94487e-13, 3.13092e-13,
  -1.12708e-13, 3.81e-16, 7.106e-15, -1.523e-15, -9.4e-17, 1.21e-16, -2.8e-17]

function erfccheb(z) {
  let d = 0, dd = 0
  const t = 2 / (2 + z), ty = 4 * t - 2
  for (let j = ERFC_COF.length - 1; j > 0; j--) { const tmp = d; d = ty * d - dd + ERFC_COF[j]; dd = tmp }
  return t * Math.exp(-z * z + 0.5 * (ERFC_COF[0] + ty * d) - dd)
}
export const erfc = (x) => (x >= 0 ? erfccheb(x) : 2 - erfccheb(-x))
export const erf = (x) => 1 - erfc(x)

// Standard normal cumulative distribution Φ(z).
export const normCdf = (z) => 0.5 * erfc(-z / Math.SQRT2)
export const normPdf = (z) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)

// Inverse of Φ: Peter Acklam's rational approximation, then one Halley step
// against normCdf for full double precision.
export function normInv(p) {
  if (p <= 0 || p >= 1) return p === 0 ? -Infinity : p === 1 ? Infinity : NaN
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const pl = 0.02425
  let x
  if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1) }
  else if (p <= 1 - pl) { const q = p - 0.5, r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1) }
  else { const q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1) }
  const e = normCdf(x) - p
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2)
  return x - u / (1 + x * u / 2)
}

// log Γ(x), Lanczos approximation (g = 7, n = 9).
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
export function gammaln(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - gammaln(1 - x)
  x -= 1
  let a = LANCZOS[0]
  const t = x + 7.5
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}
export const gamma = (x) => (x < 0.5 ? Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x)) : Math.exp(gammaln(x)))

// Regularised incomplete beta I_x(a, b), continued fraction (Numerical Recipes §6.4).
export function betai(a, b, x) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(gammaln(a + b) - gammaln(a) - gammaln(b) + a * Math.log(x) + b * Math.log(1 - x))
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b
}
function betacf(a, b, x) {
  const FPMIN = 1e-300
  let c = 1, d = 1 - ((a + b) * x) / (a + 1)
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((a - 1 + m2) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d; h *= d * c
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + 1 + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 3e-16) break
  }
  return h
}

// Regularised lower incomplete gamma P(a, x) (series / continued fraction).
export function gammap(a, x) {
  if (x <= 0) return 0
  if (x < a + 1) {
    let sum = 1 / a, del = sum, ap = a
    for (let n = 0; n < 500; n++) { ap += 1; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-16) break }
    return sum * Math.exp(-x + a * Math.log(x) - gammaln(a))
  }
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-16) break
  }
  return 1 - Math.exp(-x + a * Math.log(x) - gammaln(a)) * h
}

// Student's t cumulative distribution with df degrees of freedom.
export const tCdf = (t, df) => {
  const x = df / (df + t * t)
  const tail = 0.5 * betai(df / 2, 0.5, x)
  return t >= 0 ? 1 - tail : tail
}
export const tPdf = (t, df) => Math.exp(gammaln((df + 1) / 2) - gammaln(df / 2) - 0.5 * Math.log(df * Math.PI) - ((df + 1) / 2) * Math.log(1 + (t * t) / df))

// Invert a monotone cdf by bisection (robust; precision ~1e-12 is plenty here).
export function invert(cdf, p, lo, hi) {
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (cdf(mid) < p) lo = mid; else hi = mid
    if (hi - lo < 1e-13 * Math.max(1, Math.abs(mid))) break
  }
  return (lo + hi) / 2
}

export const chisqCdf = (x, k) => gammap(k / 2, x / 2)
export const fCdf = (x, d1, d2) => (x <= 0 ? 0 : betai(d1 / 2, d2 / 2, (d1 * x) / (d1 * x + d2)))
export function lnChoose(n, k) { return gammaln(n + 1) - gammaln(k + 1) - gammaln(n - k + 1) }
