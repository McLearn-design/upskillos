import { describe, expect, it } from 'vitest'
import { adjustDecimals, formatText } from './format.js'

describe('number formats', () => {
  it.each([
    [1234.567, '#,##0.00', '1,234.57'],
    [0.125, '0.0%', '12.5%'],
    [-5, '0.00;[Red]-0.00', '-5.00'],
    [0, '0;-0;"zero"', 'zero'],
    [45730, 'yyyy-mm-dd', '2025-03-14'],
    [45730, 'd mmm yyyy', '14 Mar 2025'],
    [0.75, 'hh:mm', '18:00'],
    [12345, '0.00E+00', '1.23E+04'],
  ])('%s with %s shows %s', (value, code, expected) => {
    expect(formatText(value, code)).toBe(expected)
  })
})

describe('more and fewer decimals', () => {
  it.each([
    ['0.00', 1, 1, '0.000'],
    ['0.00', -1, 1, '0.0'],
    ['0.0', -1, 1, '0'],
    ['0', 2, 1, '0.00'],
    ['#,##0', 1, 1, '#,##0.0'],
    ['0%', 1, 0.5, '0.0%'],
    ['$#,##0.00;[Red]-$#,##0.00', 1, 1, '$#,##0.000;[Red]-$#,##0.000'],
    ['General', 1, 3.25, '0.000'],
    ['General', -1, 3.25, '0.0'],
    ['yyyy-mm-dd', 1, 45000, 'yyyy-mm-dd'],
  ])('%s %+i on %s gives %s', (code, delta, value, expected) => {
    expect(adjustDecimals(code, delta, value)).toBe(expected)
  })
})
