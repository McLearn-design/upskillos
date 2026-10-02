import { def, numbers, flat, criteriaMask, optNumber, integer, toMatrix, Matrix, fail, isError, raise, toNumber } from './helpers.js'
import { checkNumber } from '../values.js'

const C = 'Math'
const num1 = (f) => ([x]) => checkNumber(f(toNumber(x)))

function roundTo(x, digits, mode) {
  const f = 10 ** digits
  // Work on the decimal text to avoid binary rounding surprises (2.675 → 2.68, as in Excel).
  const scaled = Number((Math.abs(x) * f).toPrecision(15))
  const r = mode === 'up' ? Math.ceil(scaled) : mode === 'down' ? Math.floor(scaled) : Math.round(scaled)
  return Math.sign(x) * r / f
}

function factorial(n) {
  if (n < 0) fail('#NUM!', 'Factorial is only defined for numbers ≥ 0.')
  if (n > 170) fail('#NUM!', 'The factorial is too large to store.')
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

const gcd2 = (a, b) => { while (b) [a, b] = [b, a % b]; return a }

export default {
  SUM: def(C, 'SUM(number1, [number2], …)', 'Adds numbers.', (args) => numbers(args).reduce((s, x) => s + x, 0), {
    min: 1,
    args: [['number1, number2, …', 'Numbers, cells or ranges to add. Text and TRUE/FALSE inside ranges are ignored.']],
    example: ['=SUM(A1:A10)', 'the total of A1 to A10'],
    learn: 'SUM skips text and blank cells inside a range, so a column with a heading still adds up. A number stored as text ("12") inside a range is skipped too, which is a common reason a total looks too small.',
  }),
  SUMIF: def(C, 'SUMIF(range, criteria, [sum_range])', 'Adds the cells that meet one condition.', ([range, crit, sumRange]) => {
    const R = toMatrix(range), S = sumRange === undefined ? R : toMatrix(sumRange)
    const mask = criteriaMask([[R, crit]], R.height, R.width)
    let total = 0, i = 0
    for (let r = 0; r < R.height; r++) for (let c = 0; c < R.width; c++, i++) {
      if (!mask[i]) continue
      const v = S.get(r, c)
      if (isError(v)) raise(v)
      if (typeof v === 'number') total += v
    }
    return total
  }, {
    args: [['range', 'The cells to test.'], ['criteria', 'A value, or a test as text: ">5", "<>apple", "a*".'], ['sum_range', 'The cells to add (default: range).']],
    example: ['=SUMIF(B2:B9, ">100")', 'the sum of values over 100'],
    learn: 'The criteria is text that starts with a comparison operator. To use a cell in it, join them: ">"&D1.',
  }),
  SUMIFS: def(C, 'SUMIFS(sum_range, criteria_range1, criteria1, …)', 'Adds the cells that meet every condition.', ([sumRange, ...rest]) => {
    if (rest.length % 2) fail('#VALUE!', 'Criteria come in pairs: a range and its condition.')
    const S = toMatrix(sumRange)
    const pairs = []
    for (let i = 0; i < rest.length; i += 2) pairs.push([rest[i], rest[i + 1]])
    const mask = criteriaMask(pairs, S.height, S.width)
    let total = 0, i = 0
    for (const v of S.values()) { if (mask[i++] && typeof v === 'number') total += v; else if (mask[i - 1] && isError(v)) raise(v) }
    return total
  }, { min: 3, args: [['sum_range', 'The cells to add.'], ['criteria_range1, criteria1, …', 'Pairs of a range to test and its condition.']], example: ['=SUMIFS(C:C, A:A, "North", B:B, ">=2025-01-01")', 'North sales this year'] }),
  SUMPRODUCT: def(C, 'SUMPRODUCT(array1, [array2], …)', 'Multiplies matching elements of arrays and adds the products.', (args) => {
    const ms = args.map(toMatrix)
    const h = ms[0].height, w = ms[0].width
    if (ms.some((m) => m.height !== h || m.width !== w)) fail('#VALUE!', 'All arrays must be the same size.')
    let total = 0
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      let p = 1
      for (const m of ms) { const v = m.get(r, c); if (isError(v)) raise(v); p *= typeof v === 'number' ? v : typeof v === 'boolean' && ms.length === 1 ? 0 : typeof v === 'boolean' ? (v ? 1 : 0) : 0 }
      total += p
    }
    return total
  }, { min: 1, example: ['=SUMPRODUCT(B2:B5, C2:C5)', 'quantity × price, summed'], learn: 'SUMPRODUCT is the dot product from linear algebra. With conditions it counts or sums: =SUMPRODUCT((A2:A9="North")*(B2:B9)).' }),
  SUMSQ: def(C, 'SUMSQ(number1, [number2], …)', 'Adds the squares of numbers.', (args) => numbers(args).reduce((s, x) => s + x * x, 0), { min: 1, example: ['=SUMSQ(3,4)', '25'] }),
  PRODUCT: def(C, 'PRODUCT(number1, [number2], …)', 'Multiplies numbers.', (args) => { const xs = numbers(args); return xs.length ? checkNumber(xs.reduce((p, x) => p * x, 1)) : 0 }, { min: 1, example: ['=PRODUCT(2,3,4)', '24'] }),
  ABS: def(C, 'ABS(number)', 'The absolute value: the number without its sign.', num1(Math.abs), { scalar: true, example: ['=ABS(-7)', '7'] }),
  SIGN: def(C, 'SIGN(number)', '1 for positive, -1 for negative, 0 for zero.', num1(Math.sign), { scalar: true, example: ['=SIGN(-3)', '-1'] }),
  ROUND: def(C, 'ROUND(number, num_digits)', 'Rounds to a number of decimal places (halves away from zero).', ([x, d]) => roundTo(toNumber(x), integer(d), 'near'), {
    scalar: true, example: ['=ROUND(2.675, 2)', '2.68'],
    learn: 'num_digits can be negative: =ROUND(1234, -2) is 1200. Formatting a cell only changes how it looks; ROUND changes the value itself, which matters when the result is used in further calculations.',
  }),
  ROUNDUP: def(C, 'ROUNDUP(number, num_digits)', 'Rounds away from zero.', ([x, d]) => roundTo(toNumber(x), integer(d), 'up'), { scalar: true, example: ['=ROUNDUP(3.21, 1)', '3.3'] }),
  ROUNDDOWN: def(C, 'ROUNDDOWN(number, num_digits)', 'Rounds towards zero.', ([x, d]) => roundTo(toNumber(x), integer(d), 'down'), { scalar: true, example: ['=ROUNDDOWN(3.29, 1)', '3.2'] }),
  INT: def(C, 'INT(number)', 'Rounds down to the nearest whole number.', num1(Math.floor), { scalar: true, example: ['=INT(-2.5)', '-3'], learn: 'INT always rounds down, so INT(-2.5) is -3. TRUNC just drops the decimals, giving -2.' }),
  TRUNC: def(C, 'TRUNC(number, [num_digits])', 'Removes the decimal part (or keeps num_digits decimals).', ([x, d]) => { const f = 10 ** optNumber(d, 0); return Math.trunc(toNumber(x) * f) / f }, { scalar: true, example: ['=TRUNC(-2.5)', '-2'] }),
  MOD: def(C, 'MOD(number, divisor)', 'The remainder after division. The result has the sign of the divisor.', ([a, b]) => {
    const x = toNumber(a), y = toNumber(b)
    if (y === 0) fail('#DIV/0!', 'MOD by zero.')
    return x - y * Math.floor(x / y)
  }, { scalar: true, example: ['=MOD(-7, 3)', '2'], learn: 'MOD follows the divisor\'s sign: MOD(-7,3) is 2, while JavaScript\'s -7 % 3 is -1. Python\'s % agrees with Excel.' }),
  QUOTIENT: def(C, 'QUOTIENT(numerator, denominator)', 'The whole-number part of a division.', ([a, b]) => { const y = toNumber(b); if (y === 0) fail('#DIV/0!'); return Math.trunc(toNumber(a) / y) }, { scalar: true, example: ['=QUOTIENT(7, 2)', '3'] }),
  POWER: def(C, 'POWER(number, power)', 'Raises a number to a power (same as ^).', ([a, b]) => checkNumber(Math.pow(toNumber(a), toNumber(b))), { scalar: true, example: ['=POWER(2, 10)', '1024'] }),
  SQRT: def(C, 'SQRT(number)', 'The square root.', ([x]) => { const n = toNumber(x); if (n < 0) fail('#NUM!', 'Negative numbers have no real square root.'); return Math.sqrt(n) }, { scalar: true, example: ['=SQRT(16)', '4'] }),
  SQRTPI: def(C, 'SQRTPI(number)', 'The square root of number × π.', ([x]) => { const n = toNumber(x); if (n < 0) fail('#NUM!'); return Math.sqrt(n * Math.PI) }, { scalar: true }),
  EXP: def(C, 'EXP(number)', 'e raised to a power.', num1(Math.exp), { scalar: true, example: ['=EXP(1)', '2.718281828'] }),
  LN: def(C, 'LN(number)', 'The natural logarithm (base e).', ([x]) => { const n = toNumber(x); if (n <= 0) fail('#NUM!', 'Logarithms need a positive number.'); return Math.log(n) }, { scalar: true, example: ['=LN(EXP(2))', '2'] }),
  LOG: def(C, 'LOG(number, [base])', 'The logarithm to a base (default 10).', ([x, b]) => { const n = toNumber(x), base = optNumber(b, 10); if (n <= 0 || base <= 0 || base === 1) fail('#NUM!', 'Logarithms need a positive number and a positive base other than 1.'); return Math.log(n) / Math.log(base) }, { scalar: true, example: ['=LOG(8, 2)', '3'] }),
  LOG10: def(C, 'LOG10(number)', 'The base-10 logarithm.', ([x]) => { const n = toNumber(x); if (n <= 0) fail('#NUM!'); return Math.log10(n) }, { scalar: true, example: ['=LOG10(1000)', '3'] }),
  PI: def(C, 'PI()', 'The number π to 15 digits.', () => Math.PI, { example: ['=PI()', '3.14159265358979'] }),
  SIN: def(C, 'SIN(angle)', 'Sine of an angle in radians.', num1(Math.sin), { scalar: true, example: ['=SIN(PI()/2)', '1'], learn: 'Angles are in radians. Convert degrees with RADIANS(): =SIN(RADIANS(30)) is 0.5.' }),
  COS: def(C, 'COS(angle)', 'Cosine of an angle in radians.', num1(Math.cos), { scalar: true, example: ['=COS(0)', '1'] }),
  TAN: def(C, 'TAN(angle)', 'Tangent of an angle in radians.', num1(Math.tan), { scalar: true }),
  ASIN: def(C, 'ASIN(number)', 'Inverse sine, in radians.', ([x]) => { const n = toNumber(x); if (Math.abs(n) > 1) fail('#NUM!', 'ASIN needs a number between -1 and 1.'); return Math.asin(n) }, { scalar: true }),
  ACOS: def(C, 'ACOS(number)', 'Inverse cosine, in radians.', ([x]) => { const n = toNumber(x); if (Math.abs(n) > 1) fail('#NUM!', 'ACOS needs a number between -1 and 1.'); return Math.acos(n) }, { scalar: true }),
  ATAN: def(C, 'ATAN(number)', 'Inverse tangent, in radians.', num1(Math.atan), { scalar: true }),
  ATAN2: def(C, 'ATAN2(x_num, y_num)', 'The angle of the point (x, y), in radians.', ([x, y]) => { const a = toNumber(x), b = toNumber(y); if (a === 0 && b === 0) fail('#DIV/0!'); return Math.atan2(b, a) }, { scalar: true, learn: 'Note the order: Excel takes x first, while most programming languages (Math.atan2, numpy.arctan2) take y first.' }),
  SINH: def(C, 'SINH(number)', 'Hyperbolic sine.', num1(Math.sinh), { scalar: true }),
  COSH: def(C, 'COSH(number)', 'Hyperbolic cosine.', num1(Math.cosh), { scalar: true }),
  TANH: def(C, 'TANH(number)', 'Hyperbolic tangent.', num1(Math.tanh), { scalar: true }),
  DEGREES: def(C, 'DEGREES(angle)', 'Radians to degrees.', num1((x) => (x * 180) / Math.PI), { scalar: true, example: ['=DEGREES(PI())', '180'] }),
  RADIANS: def(C, 'RADIANS(angle)', 'Degrees to radians.', num1((x) => (x * Math.PI) / 180), { scalar: true, example: ['=RADIANS(180)', '3.14159265358979'] }),
  CEILING: def(C, 'CEILING(number, [significance])', 'Rounds up to a multiple of significance.', ([x, s]) => { const n = toNumber(x), m = optNumber(s, 1); if (m === 0) return 0; return Math.ceil(n / m) * m }, { scalar: true, example: ['=CEILING(23, 5)', '25'] }),
  'CEILING.MATH': def(C, 'CEILING.MATH(number, [significance])', 'Rounds up to a multiple of significance.', ([x, s]) => { const n = toNumber(x), m = Math.abs(optNumber(s, 1)); return m === 0 ? 0 : Math.ceil(n / m) * m }, { scalar: true }),
  FLOOR: def(C, 'FLOOR(number, [significance])', 'Rounds down to a multiple of significance.', ([x, s]) => { const n = toNumber(x), m = optNumber(s, 1); if (m === 0) fail('#DIV/0!'); return Math.floor(n / m) * m }, { scalar: true, example: ['=FLOOR(23, 5)', '20'] }),
  'FLOOR.MATH': def(C, 'FLOOR.MATH(number, [significance])', 'Rounds down to a multiple of significance.', ([x, s]) => { const n = toNumber(x), m = Math.abs(optNumber(s, 1)); return m === 0 ? 0 : Math.floor(n / m) * m }, { scalar: true }),
  MROUND: def(C, 'MROUND(number, multiple)', 'Rounds to the nearest multiple.', ([x, s]) => { const n = toNumber(x), m = toNumber(s); if (m === 0) return 0; if (Math.sign(n) * Math.sign(m) < 0) fail('#NUM!', 'The number and the multiple must have the same sign.'); return Math.round(n / m) * m }, { scalar: true, example: ['=MROUND(17, 5)', '15'] }),
  EVEN: def(C, 'EVEN(number)', 'Rounds away from zero to an even whole number.', num1((x) => { const r = Math.ceil(Math.abs(x) / 2) * 2; return Math.sign(x) * r }), { scalar: true }),
  ODD: def(C, 'ODD(number)', 'Rounds away from zero to an odd whole number.', num1((x) => { let r = Math.ceil(Math.abs(x)); if (r % 2 === 0) r += 1; return (x < 0 ? -1 : 1) * r }), { scalar: true }),
  FACT: def(C, 'FACT(number)', 'The factorial: 1 × 2 × … × n.', ([x]) => factorial(Math.floor(toNumber(x))), { scalar: true, example: ['=FACT(5)', '120'] }),
  COMBIN: def(C, 'COMBIN(number, number_chosen)', 'The number of ways to choose k items from n, order ignored.', ([a, b]) => { const n = Math.floor(toNumber(a)), k = Math.floor(toNumber(b)); if (k < 0 || n < 0 || k > n) fail('#NUM!'); let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return Math.round(r) }, { scalar: true, example: ['=COMBIN(5, 2)', '10'], learn: 'n choose k = n! / (k!(n−k)!). Order does not matter: {A,B} is the same as {B,A}.' }),
  PERMUT: def(C, 'PERMUT(number, number_chosen)', 'The number of ordered arrangements of k items from n.', ([a, b]) => { const n = Math.floor(toNumber(a)), k = Math.floor(toNumber(b)); if (k < 0 || n < 0 || k > n) fail('#NUM!'); let r = 1; for (let i = 0; i < k; i++) r *= n - i; return r }, { scalar: true, example: ['=PERMUT(5, 2)', '20'] }),
  GCD: def(C, 'GCD(number1, [number2], …)', 'The greatest common divisor.', (args) => numbers(args).map((x) => Math.floor(Math.abs(x))).reduce(gcd2), { min: 1, example: ['=GCD(12, 18)', '6'] }),
  LCM: def(C, 'LCM(number1, [number2], …)', 'The least common multiple.', (args) => numbers(args).map((x) => Math.floor(Math.abs(x))).reduce((a, b) => (a === 0 || b === 0 ? 0 : (a / gcd2(a, b)) * b)), { min: 1, example: ['=LCM(4, 6)', '12'] }),
  RAND: def(C, 'RAND()', 'A random number from 0 up to (not including) 1. Changes on every recalculation.', (_, ctx) => (ctx.random ?? Math.random)(), { volatile: true, learn: 'RAND is volatile: it recalculates whenever anything in the workbook changes. To freeze a value, copy the cell and paste it as a value.' }),
  RANDBETWEEN: def(C, 'RANDBETWEEN(bottom, top)', 'A random whole number between bottom and top, inclusive.', ([a, b], ctx) => { const lo = Math.ceil(toNumber(a)), hi = Math.floor(toNumber(b)); if (lo > hi) fail('#NUM!'); return lo + Math.floor((ctx.random ?? Math.random)() * (hi - lo + 1)) }, { volatile: true, example: ['=RANDBETWEEN(1, 6)', 'a dice roll'] }),
  RANDARRAY: def(C, 'RANDARRAY([rows], [columns], [min], [max], [whole_number])', 'An array of random numbers.', ([r, c, lo, hi, whole], ctx) => {
    const R = optNumber(r, 1), K = optNumber(c, 1), a = optNumber(lo, 0), b = optNumber(hi, 1)
    const rnd = ctx.random ?? Math.random
    const isWhole = whole !== undefined && whole !== null && Boolean(toNumber(whole))
    return Matrix.fill(R, K, () => (isWhole ? Math.ceil(a) + Math.floor(rnd() * (Math.floor(b) - Math.ceil(a) + 1)) : a + rnd() * (b - a)))
  }, { min: 0, volatile: true, returnsArray: true, example: ['=RANDARRAY(5, 2)', 'a 5×2 block of random numbers'] }),
  SEQUENCE: def(C, 'SEQUENCE(rows, [columns], [start], [step])', 'An array of sequential numbers.', ([r, c, s, st]) => {
    const R = integer(r), K = Math.trunc(optNumber(c, 1)), start = optNumber(s, 1), step = optNumber(st, 1)
    if (R < 1 || K < 1) fail('#CALC!', 'SEQUENCE needs at least one row and one column.')
    if (R * K > 1e6) fail('#NUM!', 'That sequence is too large.')
    return Matrix.fill(R, K, (i, j) => start + (i * K + j) * step)
  }, { returnsArray: true, example: ['=SEQUENCE(5)', '1, 2, 3, 4, 5 down a column'], learn: 'SEQUENCE returns several values. They "spill" into the cells below and to the right. Refer to the whole spilled block with a # after the first cell: =SUM(A1#).' }),
}

export { roundTo, factorial, flat }
