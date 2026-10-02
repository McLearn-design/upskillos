import { def, Matrix, err, fail, isError, isMatrix, toNumber } from './helpers.js'
import { lift1 } from '../evaluate.js'
import { CellError } from '../values.js'

const C = 'Information'
const test = (f) => ([v]) => lift1(v, f)
const ERROR_NUMBERS = { '#NULL!': 1, '#DIV/0!': 2, '#VALUE!': 3, '#REF!': 4, '#NAME?': 5, '#NUM!': 6, '#N/A': 7, '#SPILL!': 9, '#CALC!': 14 }

// The IS functions must see errors rather than be stopped by them, so they use
// a lift that does not raise.
const safeLift = (v, f) => (isMatrix(v) ? v.map(f) : f(v))

export default {
  ISBLANK: def(C, 'ISBLANK(value)', 'TRUE if the cell is empty.', ([v]) => safeLift(v, (x) => x === null || x === undefined), { example: ['=ISBLANK(A1)', 'TRUE when A1 is empty'], learn: 'A cell with a formula that returns "" is not blank.' }),
  ISNUMBER: def(C, 'ISNUMBER(value)', 'TRUE if the value is a number.', ([v]) => safeLift(v, (x) => typeof x === 'number'), { learn: 'Useful for spotting numbers stored as text: =ISNUMBER(A1) is FALSE for the text "12".' }),
  ISTEXT: def(C, 'ISTEXT(value)', 'TRUE if the value is text.', ([v]) => safeLift(v, (x) => typeof x === 'string')),
  ISNONTEXT: def(C, 'ISNONTEXT(value)', 'TRUE if the value is not text.', ([v]) => safeLift(v, (x) => typeof x !== 'string')),
  ISLOGICAL: def(C, 'ISLOGICAL(value)', 'TRUE if the value is TRUE or FALSE.', ([v]) => safeLift(v, (x) => typeof x === 'boolean')),
  ISERROR: def(C, 'ISERROR(value)', 'TRUE if the value is any error.', ([v]) => safeLift(v, (x) => x instanceof CellError)),
  ISERR: def(C, 'ISERR(value)', 'TRUE if the value is any error except #N/A.', ([v]) => safeLift(v, (x) => x instanceof CellError && x.code !== '#N/A')),
  ISNA: def(C, 'ISNA(value)', 'TRUE if the value is #N/A.', ([v]) => safeLift(v, (x) => x instanceof CellError && x.code === '#N/A')),
  ISEVEN: def(C, 'ISEVEN(number)', 'TRUE if the number is even.', test((x) => Math.trunc(toNumber(x)) % 2 === 0)),
  ISODD: def(C, 'ISODD(number)', 'TRUE if the number is odd.', test((x) => Math.abs(Math.trunc(toNumber(x)) % 2) === 1)),
  ISFORMULA: def(C, 'ISFORMULA(reference)', 'TRUE if the cell contains a formula.', ([v], ctx) => Boolean(v instanceof Matrix && v.ref && ctx.isFormula?.(v.ref))),
  NA: def(C, 'NA()', 'Returns the #N/A error.', () => err('#N/A', 'NA() was used to mark a missing value.'), { learn: 'Charts skip #N/A points, so =NA() is a way to leave a gap in a line chart.' }),
  N: def(C, 'N(value)', 'Converts a value to a number: numbers stay, TRUE is 1, everything else is 0.', ([v]) => safeLift(v, (x) => (typeof x === 'number' ? x : x === true ? 1 : x instanceof CellError ? x : 0))),
  TYPE: def(C, 'TYPE(value)', 'The type of a value: 1 number, 2 text, 4 logical, 16 error, 64 array.', ([v]) => (isMatrix(v) && (v.height > 1 || v.width > 1) ? 64 : (() => { const x = isMatrix(v) ? v.get(0, 0) : v; return typeof x === 'string' ? 2 : typeof x === 'boolean' ? 4 : x instanceof CellError ? 16 : 1 })())),
  'ERROR.TYPE': def(C, 'ERROR.TYPE(error_val)', 'A number for each kind of error (#N/A is 7).', ([v]) => { const x = isMatrix(v) ? v.get(0, 0) : v; if (!(x instanceof CellError)) fail('#N/A', 'The value is not an error.'); return ERROR_NUMBERS[x.code] ?? 15 }),
  ISREF: def(C, 'ISREF(value)', 'TRUE if the value is a reference.', ([v]) => Boolean(v instanceof Matrix && v.ref)),
}

export { isError }
