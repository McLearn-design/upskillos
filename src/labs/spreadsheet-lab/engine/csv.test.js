import { describe, expect, it } from 'vitest'
import { guessDelimiter, parseCSV, toCSV } from './csv.js'

describe('CSV', () => {
  it('reads plain rows', () => {
    expect(parseCSV('a,b,c\n1,2,3\n')).toEqual([['a', 'b', 'c'], ['1', '2', '3']])
  })

  it('reads quoted values containing commas, quotes and line breaks', () => {
    expect(parseCSV('name,note\r\n"Smith, J","said ""hi""\nthen left"\r\n')).toEqual([['name', 'note'], ['Smith, J', 'said "hi"\nthen left']])
  })

  it('keeps empty fields', () => {
    expect(parseCSV('a,,c\n,,\n')).toEqual([['a', '', 'c'], ['', '', '']])
  })

  it('guesses tab and semicolon separators', () => {
    expect(guessDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t')
    expect(guessDelimiter('a;b;c')).toBe(';')
    expect(parseCSV('x;y\n1,5;2,5')).toEqual([['x', 'y'], ['1,5', '2,5']])
  })

  it('writes CSV that reads back the same', () => {
    const rows = [['a', 'b, c', 'say "hi"'], [1, null, 'line\nbreak']]
    expect(parseCSV(toCSV(rows))).toEqual([['a', 'b, c', 'say "hi"'], ['1', '', 'line\nbreak']])
  })
})
