// Dates and times. A date is a serial number (days since 1900, see
// helpers.js), so date arithmetic is ordinary arithmetic: =B1-A1 is the number
// of days between two dates, and =A1+7 is a week later.
import { def, optNumber, integer, flat, fail, isError, raise, toNumber, toText, serialParts, ymdToSerial, parseDateText } from './helpers.js'

const C = 'Date & time'

const parts = (v) => serialParts(toNumber(v))
const dayOf = (v) => Math.floor(toNumber(v))

function nowSerial() {
  const d = new Date()
  // The learner's local clock, as a spreadsheet shows it.
  return ymdToSerial(d.getFullYear(), d.getMonth() + 1, d.getDate()) + (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400
}

// A date given as text ("2025-03-14") is accepted wherever a date is expected.
function dateArg(v) {
  if (typeof v === 'string') {
    const s = parseDateText(v)
    if (s === null) fail('#VALUE!', '"' + v + '" is not a date this lab recognises. Use 2025-03-14, 14/03/2025 or 14 Mar 2025.')
    return s
  }
  return toNumber(v)
}

function lastDayOfMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate() }

function addMonths(serial, months) {
  const p = serialParts(serial)
  const total = p.y * 12 + (p.m - 1) + months
  const y = Math.floor(total / 12), m = (total % 12) + 1
  return ymdToSerial(y, m, Math.min(p.d, lastDayOfMonth(y, m)))
}

// Saturday and Sunday by default; WORKDAY.INTL-style codes are not supported yet.
const isWeekend = (serial) => { const wd = serialParts(serial).wd; return wd === 0 || wd === 6 }

function holidaySet(arg) {
  if (arg === undefined) return new Set()
  return new Set(flat([arg]).filter((v) => v !== null).map((v) => { if (isError(v)) raise(v); return Math.floor(dateArg(v)) }))
}

export default {
  DATE: def(C, 'DATE(year, month, day)', 'Builds a date from a year, month and day.', ([y, m, d]) => {
    const s = ymdToSerial(integer(y, 'year'), integer(m, 'month'), integer(d, 'day'))
    if (s < 1) fail('#NUM!', 'Dates before 1 January 1900 cannot be represented.')
    return s
  }, {
    scalar: true, example: ['=DATE(2025, 3, 14)', '45730, shown as 2025-03-14 with a date format'],
    learn: 'Months and days roll over, so =DATE(2025, 13, 1) is 1 January 2026 and =DATE(2025, 3, 0) is the last day of February. That makes "the last day of a month" easy to compute.',
  }),
  TIME: def(C, 'TIME(hour, minute, second)', 'Builds a time of day, as a fraction of a day.', ([h, m, s]) => {
    const t = (integer(h) * 3600 + integer(m) * 60 + integer(s)) / 86400
    if (t < 0) fail('#NUM!', 'A time cannot be negative.')
    return t - Math.floor(t)
  }, { scalar: true, example: ['=TIME(18, 0, 0)', '0.75: three quarters of the way through the day'] }),
  TODAY: def(C, 'TODAY()', "Today's date. Recalculates whenever the sheet does.", () => Math.floor(nowSerial()), { volatile: true }),
  NOW: def(C, 'NOW()', 'The current date and time. Recalculates whenever the sheet does.', () => nowSerial(), { volatile: true }),
  YEAR: def(C, 'YEAR(date)', 'The year of a date.', ([d]) => serialParts(dateArg(d)).y, { scalar: true }),
  MONTH: def(C, 'MONTH(date)', 'The month of a date, 1 (January) to 12.', ([d]) => serialParts(dateArg(d)).m, { scalar: true }),
  DAY: def(C, 'DAY(date)', 'The day of the month, 1 to 31.', ([d]) => serialParts(dateArg(d)).d, { scalar: true }),
  HOUR: def(C, 'HOUR(time)', 'The hour, 0 to 23.', ([t]) => parts(t).h, { scalar: true }),
  MINUTE: def(C, 'MINUTE(time)', 'The minute, 0 to 59.', ([t]) => parts(t).mi, { scalar: true }),
  SECOND: def(C, 'SECOND(time)', 'The second, 0 to 59.', ([t]) => parts(t).s, { scalar: true }),
  WEEKDAY: def(C, 'WEEKDAY(date, [return_type])', 'The day of the week as a number.', ([d, type]) => {
    const wd = serialParts(dateArg(d)).wd // 0 = Sunday
    const t = optNumber(type, 1)
    if (t === 1 || t === 17) return wd + 1 // Sunday = 1
    if (t === 2 || t === 11) return ((wd + 6) % 7) + 1 // Monday = 1
    if (t === 3) return (wd + 6) % 7 // Monday = 0
    fail('#NUM!', 'return_type must be 1, 2 or 3.')
  }, { scalar: [0, 1], example: ['=WEEKDAY(DATE(2025,3,14))', '6: a Friday, counting Sunday as 1'] }),
  WEEKNUM: def(C, 'WEEKNUM(date, [return_type])', 'The week of the year, where week 1 contains 1 January.', ([d, type]) => {
    const s = Math.floor(dateArg(d))
    const p = serialParts(s)
    const jan1 = ymdToSerial(p.y, 1, 1)
    const startDay = optNumber(type, 1) === 2 ? 1 : 0 // weeks start Monday or Sunday
    const offset = (serialParts(jan1).wd - startDay + 7) % 7
    return Math.floor((s - jan1 + offset) / 7) + 1
  }, { scalar: [0, 1] }),
  ISOWEEKNUM: def(C, 'ISOWEEKNUM(date)', 'The ISO 8601 week number: weeks start on Monday and week 1 contains the year\'s first Thursday.', ([d]) => {
    const s = Math.floor(dateArg(d))
    const wd = (serialParts(s).wd + 6) % 7 // Monday = 0
    const thursday = s - wd + 3
    const jan1 = ymdToSerial(serialParts(thursday).y, 1, 1)
    return Math.floor((thursday - jan1) / 7) + 1
  }, { scalar: true }),
  DATEVALUE: def(C, 'DATEVALUE(date_text)', 'Turns text that looks like a date into a date serial.', ([t]) => {
    const s = parseDateText(toText(t))
    if (s === null) fail('#VALUE!', '"' + toText(t) + '" is not a date this lab recognises.')
    return Math.floor(s)
  }, { scalar: true }),
  TIMEVALUE: def(C, 'TIMEVALUE(time_text)', 'Turns text such as "6:30 PM" into a fraction of a day.', ([t]) => {
    const s = parseDateText(toText(t))
    if (s === null) fail('#VALUE!', '"' + toText(t) + '" is not a time this lab recognises.')
    return s - Math.floor(s)
  }, { scalar: true }),
  EDATE: def(C, 'EDATE(start_date, months)', 'The same day a number of months before or after a date.', ([d, m]) => addMonths(Math.floor(dateArg(d)), integer(m)), {
    scalar: true, learn: 'If the day does not exist in the target month it moves back: =EDATE("2025-01-31", 1) is 28 February.',
  }),
  EOMONTH: def(C, 'EOMONTH(start_date, months)', 'The last day of the month, a number of months before or after a date.', ([d, m]) => {
    const p = serialParts(addMonths(Math.floor(dateArg(d)), integer(m)))
    return ymdToSerial(p.y, p.m, lastDayOfMonth(p.y, p.m))
  }, { scalar: true }),
  DAYS: def(C, 'DAYS(end_date, start_date)', 'The number of days between two dates.', ([e, s]) => dayOf(dateArg(e)) - dayOf(dateArg(s)), {
    scalar: true, learn: 'Because dates are numbers, =B1-A1 gives the same answer.',
  }),
  DATEDIF: def(C, 'DATEDIF(start_date, end_date, unit)', 'Whole years ("Y"), months ("M") or days ("D") between two dates.', ([s, e, u]) => {
    const a = Math.floor(dateArg(s)), b = Math.floor(dateArg(e))
    if (a > b) fail('#NUM!', 'start_date must not be after end_date.')
    const p = serialParts(a), q = serialParts(b)
    let months = (q.y - p.y) * 12 + (q.m - p.m)
    if (q.d < p.d) months--
    switch (toText(u).toUpperCase()) {
      case 'Y': return Math.floor(months / 12)
      case 'M': return months
      case 'D': return b - a
      case 'YM': return months % 12
      case 'MD': return q.d >= p.d ? q.d - p.d : b - addMonths(a, months)
      case 'YD': { let start = addMonths(a, Math.floor(months / 12) * 12); return b - start }
      default: return fail('#NUM!', 'unit must be "Y", "M", "D", "YM", "MD" or "YD".')
    }
  }, { scalar: true, example: ['=DATEDIF("2000-05-20", "2025-03-14", "Y")', '24: whole years, as for an age'] }),
  NETWORKDAYS: def(C, 'NETWORKDAYS(start_date, end_date, [holidays])', 'Working days (Monday to Friday) between two dates, including both ends.', ([s, e, h]) => {
    let a = Math.floor(dateArg(s)), b = Math.floor(dateArg(e))
    const sign = a <= b ? 1 : -1
    if (sign < 0) [a, b] = [b, a]
    const skip = holidaySet(h)
    let n = 0
    for (let d = a; d <= b; d++) if (!isWeekend(d) && !skip.has(d)) n++
    return sign * n
  }),
  WORKDAY: def(C, 'WORKDAY(start_date, days, [holidays])', 'The date a number of working days before or after a date.', ([s, n, h]) => {
    let d = Math.floor(dateArg(s))
    let left = integer(n)
    const step = left >= 0 ? 1 : -1
    const skip = holidaySet(h)
    while (left !== 0) {
      d += step
      if (!isWeekend(d) && !skip.has(d)) left -= step
    }
    return d
  }),
  YEARFRAC: def(C, 'YEARFRAC(start_date, end_date, [basis])', 'The fraction of a year between two dates.', ([s, e, basis]) => {
    let a = Math.floor(dateArg(s)), b = Math.floor(dateArg(e))
    if (a > b) [a, b] = [b, a]
    const p = serialParts(a), q = serialParts(b)
    switch (optNumber(basis, 0)) {
      case 0: { // US 30/360
        let d1 = p.d, d2 = q.d
        if (d1 === 31) d1 = 30
        if (d2 === 31 && d1 === 30) d2 = 30
        return ((q.y - p.y) * 360 + (q.m - p.m) * 30 + (d2 - d1)) / 360
      }
      case 1: { // actual/actual
        const yearLen = (y) => (ymdToSerial(y + 1, 1, 1) - ymdToSerial(y, 1, 1))
        if (p.y === q.y) return (b - a) / yearLen(p.y)
        let total = 0
        for (let y = p.y; y <= q.y; y++) total += yearLen(y)
        return (b - a) / (total / (q.y - p.y + 1))
      }
      case 2: return (b - a) / 360
      case 3: return (b - a) / 365
      case 4: return ((q.y - p.y) * 360 + (q.m - p.m) * 30 + (Math.min(q.d, 30) - Math.min(p.d, 30))) / 360
      default: return fail('#NUM!', 'basis must be 0 to 4.')
    }
  }),
}
