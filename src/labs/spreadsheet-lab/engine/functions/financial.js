// Money over time: loans, savings and investments.
//
// Sign convention (as in Excel): money you pay out is negative, money you
// receive is positive. A loan of 10,000 is pv = 10000 (you receive it), and
// its payments come back negative: =PMT(5%/12, 36, 10000) is -299.71.
import { def, flat, optNumber, fail, isError, raise, toNumber } from './helpers.js'
import { checkNumber } from '../values.js'

const C = 'Financial'

// The time-value-of-money equation that PV, FV, PMT, NPER and RATE all solve:
//   pv·(1+r)^n + pmt·(1 + r·type)·((1+r)^n − 1)/r + fv = 0
function tvm(rate, n, pmt, pv, type) {
  if (rate === 0) return pv + pmt * n
  const g = (1 + rate) ** n
  return pv * g + pmt * (1 + rate * type) * (g - 1) / rate
}

function pmtOf(rate, n, pv, fv, type) {
  if (n === 0) fail('#NUM!', 'The number of periods cannot be zero.')
  if (rate === 0) return -(pv + fv) / n
  const g = (1 + rate) ** n
  return -(rate * (pv * g + fv)) / ((1 + rate * type) * (g - 1))
}

// The interest part of payment number `per`, found by playing the loan forward
// one period at a time: interest is charged on the balance, then the payment
// is made (type 0), or the payment comes first (type 1).
function ipmtOf(rate, per, n, pv, fv, type) {
  if (per < 1 || per > n) fail('#NUM!', 'per must be between 1 and nper.')
  const pmt = pmtOf(rate, n, pv, fv, type)
  let balance = pv
  let interest = 0
  let accrued = 0 // interest added during the previous period (type 1)
  for (let i = 1; i <= per; i++) {
    if (type === 1) {
      interest = -accrued
      balance += pmt
      accrued = balance * rate
      balance += accrued
    } else {
      interest = -balance * rate
      balance += balance * rate + pmt
    }
  }
  return interest
}

// Newton's method with a bisection fallback, for RATE, IRR and XIRR.
function solve(f, guess, lo = -0.9999, hi = 10) {
  let x = guess
  for (let i = 0; i < 100; i++) {
    const y = f(x)
    if (Math.abs(y) < 1e-10) return x
    const dy = (f(x + 1e-7) - y) / 1e-7
    if (!Number.isFinite(dy) || dy === 0) break
    const next = x - y / dy
    if (!Number.isFinite(next) || next <= -1) break
    if (Math.abs(next - x) < 1e-12) return next
    x = next
  }
  let a = lo, b = hi, fa = f(a), fb = f(b)
  if (!(fa * fb < 0)) fail('#NUM!', 'No rate makes these cash flows balance. Try a different guess, or check the signs (payments negative, receipts positive).')
  for (let i = 0; i < 200; i++) {
    const m = (a + b) / 2, fm = f(m)
    if (Math.abs(fm) < 1e-10 || b - a < 1e-14) return m
    if (fa * fm < 0) { b = m; fb = fm } else { a = m; fa = fm }
  }
  return (a + b) / 2
}

function cashFlows(arg) {
  const out = []
  for (const v of flat([arg])) {
    if (isError(v)) raise(v)
    if (typeof v === 'number') out.push(v)
  }
  return out
}

const type01 = (v) => (optNumber(v, 0) ? 1 : 0)

export default {
  PMT: def(C, 'PMT(rate, nper, pv, [fv], [type])', 'The regular payment on a loan or savings plan.', ([r, n, pv, fv, t]) => checkNumber(pmtOf(toNumber(r), toNumber(n), toNumber(pv), optNumber(fv, 0), type01(t))), {
    scalar: true,
    example: ['=PMT(5%/12, 36, 10000)', '-299.71: monthly repayment on 10,000 over 3 years at 5% a year'],
    learn: 'Use the rate per period and the number of periods in the same unit: a yearly rate of 5% paid monthly is 5%/12, over 36 months. type 0 means payments at the end of each period (the usual case), 1 at the start.',
  }),
  IPMT: def(C, 'IPMT(rate, per, nper, pv, [fv], [type])', 'The interest part of one payment.', ([r, per, n, pv, fv, t]) => checkNumber(ipmtOf(toNumber(r), Math.round(toNumber(per)), toNumber(n), toNumber(pv), optNumber(fv, 0), type01(t))), {
    scalar: true, learn: 'Early payments are mostly interest; later ones are mostly principal, because interest is charged on what is still owed.',
  }),
  PPMT: def(C, 'PPMT(rate, per, nper, pv, [fv], [type])', 'The principal part of one payment (the payment minus its interest).', ([r, per, n, pv, fv, t]) => {
    const args = [toNumber(r), Math.round(toNumber(per)), toNumber(n), toNumber(pv), optNumber(fv, 0), type01(t)]
    return checkNumber(pmtOf(args[0], args[2], args[3], args[4], args[5]) - ipmtOf(...args))
  }, { scalar: true }),
  PV: def(C, 'PV(rate, nper, pmt, [fv], [type])', 'What a series of future payments is worth today.', ([r, n, p, fv, t]) => {
    const rate = toNumber(r), nper = toNumber(n), pmt = toNumber(p), f = optNumber(fv, 0), type = type01(t)
    if (rate === 0) return -(f + pmt * nper)
    const g = (1 + rate) ** nper
    return checkNumber(-(f + pmt * (1 + rate * type) * (g - 1) / rate) / g)
  }, { scalar: true, example: ['=PV(4%, 10, -1000)', '8110.90: ten yearly payments of 1,000 are worth that much today at 4%'] }),
  FV: def(C, 'FV(rate, nper, pmt, [pv], [type])', 'What an investment will be worth after a number of periods.', ([r, n, p, pv, t]) => checkNumber(-tvm(toNumber(r), toNumber(n), toNumber(p), optNumber(pv, 0), type01(t))), {
    scalar: true, example: ['=FV(5%/12, 120, -100)', '15528.23: saving 100 a month for 10 years at 5%'],
  }),
  NPER: def(C, 'NPER(rate, pmt, pv, [fv], [type])', 'How many periods it takes to pay off a loan or reach a savings goal.', ([r, p, pv, fv, t]) => {
    const rate = toNumber(r), pmt = toNumber(p), v = toNumber(pv), f = optNumber(fv, 0), type = type01(t)
    if (rate === 0) { if (pmt === 0) fail('#NUM!'); return -(v + f) / pmt }
    const k = pmt * (1 + rate * type) / rate
    const ratio = (k - f) / (k + v)
    if (ratio <= 0) fail('#NUM!', 'These payments never pay off the loan: they do not even cover the interest.')
    return checkNumber(Math.log(ratio) / Math.log(1 + rate))
  }, { scalar: true }),
  RATE: def(C, 'RATE(nper, pmt, pv, [fv], [type], [guess])', 'The interest rate per period that makes the payments add up.', ([n, p, pv, fv, t, g]) => {
    const nper = toNumber(n), pmt = toNumber(p), v = toNumber(pv), f = optNumber(fv, 0), type = type01(t)
    return solve((rate) => tvm(rate, nper, pmt, v, type) + f, optNumber(g, 0.1))
  }, { scalar: true, learn: 'There is no formula for the rate, so it is found by trial and improvement (Newton\'s method), starting from guess.' }),
  NPV: def(C, 'NPV(rate, value1, [value2], …)', 'Net present value of cash flows at the end of each period.', ([r, ...vals]) => {
    const rate = toNumber(r)
    let total = 0, i = 1
    for (const v of vals) for (const x of cashFlows(v)) total += x / (1 + rate) ** i++
    return checkNumber(total)
  }, {
    min: 2, max: Infinity,
    learn: 'NPV assumes the first value comes one period from now. For an investment made today, add it separately: =NPV(rate, B2:B6) + B1.',
  }),
  IRR: def(C, 'IRR(values, [guess])', 'The rate at which the net present value of the cash flows is zero.', ([vals, g]) => {
    const cf = cashFlows(vals)
    if (!cf.some((x) => x < 0) || !cf.some((x) => x > 0)) fail('#NUM!', 'The cash flows need at least one negative (paid out) and one positive (received) value.')
    return solve((rate) => cf.reduce((s, x, i) => s + x / (1 + rate) ** i, 0), optNumber(g, 0.1))
  }, { example: ['=IRR({-1000, 300, 400, 500})', '0.089: an 8.9% yearly return'] }),
  XNPV: def(C, 'XNPV(rate, values, dates)', 'Net present value of cash flows on specific dates.', ([r, v, d]) => {
    const cf = cashFlows(v), dates = cashFlows(d)
    if (cf.length !== dates.length) fail('#NUM!', 'values and dates must be the same length.')
    const rate = toNumber(r)
    return checkNumber(cf.reduce((s, x, i) => s + x / (1 + rate) ** ((dates[i] - dates[0]) / 365), 0))
  }),
  XIRR: def(C, 'XIRR(values, dates, [guess])', 'The yearly rate of return for cash flows on specific dates.', ([v, d, g]) => {
    const cf = cashFlows(v), dates = cashFlows(d)
    if (cf.length !== dates.length) fail('#NUM!', 'values and dates must be the same length.')
    return solve((rate) => cf.reduce((s, x, i) => s + x / (1 + rate) ** ((dates[i] - dates[0]) / 365), 0), optNumber(g, 0.1))
  }),
  EFFECT: def(C, 'EFFECT(nominal_rate, npery)', 'The effective yearly rate when interest compounds several times a year.', ([r, n]) => {
    const k = Math.floor(toNumber(n))
    if (k < 1) fail('#NUM!')
    return checkNumber((1 + toNumber(r) / k) ** k - 1)
  }, { scalar: true, example: ['=EFFECT(12%, 12)', '0.1268: 12% compounded monthly is 12.68% a year'] }),
  NOMINAL: def(C, 'NOMINAL(effect_rate, npery)', 'The nominal yearly rate that gives an effective rate.', ([r, n]) => {
    const k = Math.floor(toNumber(n))
    if (k < 1) fail('#NUM!')
    return checkNumber(k * ((1 + toNumber(r)) ** (1 / k) - 1))
  }, { scalar: true }),
  SLN: def(C, 'SLN(cost, salvage, life)', 'Straight-line depreciation for one period.', ([c, s, l]) => {
    const life = toNumber(l)
    if (life === 0) fail('#DIV/0!')
    return (toNumber(c) - toNumber(s)) / life
  }, { scalar: true }),
  DDB: def(C, 'DDB(cost, salvage, life, period, [factor])', 'Declining-balance depreciation (double by default).', ([c, s, l, p, f]) => {
    const cost = toNumber(c), salvage = toNumber(s), life = toNumber(l), period = toNumber(p), factor = optNumber(f, 2)
    if (life <= 0 || period < 1 || period > life) fail('#NUM!')
    let book = cost, dep = 0
    for (let i = 1; i <= period; i++) {
      dep = Math.min(book * factor / life, Math.max(0, book - salvage))
      book -= dep
    }
    return dep
  }, { scalar: true }),
  CUMIPMT: def(C, 'CUMIPMT(rate, nper, pv, start_period, end_period, type)', 'Total interest paid between two payments.', ([r, n, pv, s, e, t]) => {
    const rate = toNumber(r), nper = toNumber(n), v = toNumber(pv), a = Math.round(toNumber(s)), b = Math.round(toNumber(e)), type = type01(t)
    if (a < 1 || b < a || b > nper || rate <= 0 || v <= 0) fail('#NUM!')
    let total = 0
    for (let per = a; per <= b; per++) total += ipmtOf(rate, per, nper, v, 0, type)
    return total
  }),
}

