import { describe, expect, it } from 'vitest'
import { run } from '../../../../engines/js/interpreter/interpreter.js'
import { compileTypeScript } from './typescriptCompiler'

describe('CodeLens TypeScript compiler', () => {
  it('preserves parameter properties and executes common TypeScript constructs', () => {
    const source = `interface Named { name: string; nickname?: string }
type MaybeName = string | null
enum Direction { Up, Down }

export class Dog implements Named {
  constructor(public name: string, private tricks: string[] = []) {}
  learn<T extends string>(trick: T): T {
    this.tricks.push(trick)
    return trick
  }
}

export function identity<T>(value: T): T { return value }
const dog = new Dog('Rex')
const maybe: MaybeName = dog.name as string
console.log(identity(maybe), dog.learn('fetch'), Direction.Up)
`
    const compilation = compileTypeScript(source)
    const result = run(compilation.code)

    expect(compilation.diagnostics.filter(diagnostic => diagnostic.category === 'error')).toEqual([])
    expect(compilation.code).toContain('this.name = name')
    expect(compilation.code).toContain('this.tricks = tricks')
    expect(result.error).toBeNull()
    expect(result.output).toEqual(['Rex fetch 0'])
  })

  it('reports TypeScript syntax diagnostics with source positions', () => {
    const compilation = compileTypeScript('const value: = 1')
    const error = compilation.diagnostics.find(diagnostic => diagnostic.category === 'error')

    expect(error).toMatchObject({ line: 1, category: 'error' })
    expect(error?.message).toBeTruthy()
  })

  it('maps generated JavaScript lines back to TypeScript lines', () => {
    const source = `interface Item {
  value: number
}

const item: Item = { value: 7 }
console.log(item.value)
`
    const compilation = compileTypeScript(source)
    const generatedLine = compilation.code
      .split('\n')
      .findIndex(line => line.includes('console.log')) + 1

    expect(generatedLine).toBeGreaterThan(0)
    expect(compilation.mapPosition(generatedLine).line).toBe(6)
  })
})
