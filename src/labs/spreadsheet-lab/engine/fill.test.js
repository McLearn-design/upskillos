import { describe, expect, it } from 'vitest'
import { fillInputs } from './fill.js'

describe('the fill handle continues patterns', () => {
  it.each([
    [['1', '2'], 3, ['3', '4', '5']],
    [['10', '20', '30'], 2, ['40', '50']],
    [['1', '3', '4'], 1, ['5.66666666666667']], // not evenly spaced: the best-fit line (15 significant digits, as Excel stores)
    [['7'], 3, ['7', '7', '7']],
    [['Item 1'], 3, ['Item 2', 'Item 3', 'Item 4']],
    [['Item 1', 'Item 2'], 2, ['Item 3', 'Item 4']],
    [['Q09'], 2, ['Q10', 'Q11']],
    [['Jan'], 3, ['Feb', 'Mar', 'Apr']],
    [['Nov'], 3, ['Dec', 'Jan', 'Feb']],
    [['MONDAY'], 1, ['TUESDAY']],
    [['a', 'b'], 3, ['a', 'b', 'a']],
  ])('%j filled %i further gives %j', (sources, count, expected) => {
    expect(fillInputs(sources, count, 1, 0)).toEqual(expected)
  })

  it('copies formulas with their relative references moved', () => {
    expect(fillInputs(['=A1*2'], 2, 1, 0)).toEqual(['=A2*2', '=A3*2'])
    expect(fillInputs(['=$A$1+B1'], 2, 0, 1)).toEqual(['=$A$1+C1', '=$A$1+D1'])
    expect(fillInputs(['=A1', '=A2'], 2, 1, 0)).toEqual(['=A3', '=A4'])
  })
})
