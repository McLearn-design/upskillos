// JavaScript and TypeScript line-by-line explanations, on real traces from the CodeLens
// interpreter (the same run() the execution worker uses), annotated the way the client does.
import { describe, expect, it } from 'vitest'
import { run } from '../../../engines/js/interpreter/interpreter.js'
import { annotateJavaScriptTrace } from './interpreter/jsExecutionClient'
import { explainTraceEvent } from './explainTrace'
import { compileTypeScript, remapTraceEvent } from './interpreter/typescriptCompiler'
import type { TraceEvent } from './types'

// TypeScript runs the way the worker runs it: compiled to JavaScript, with each event's
// line mapped back to the TypeScript source.
function explain(source: string, language: 'js' | 'ts' = 'js'): string[] {
  const events: TraceEvent[] = []
  let pending = ''
  let code = source
  let remap = (event: TraceEvent) => event
  if (language === 'ts') {
    const compiled = compileTypeScript(source)
    code = compiled.code
    remap = event => remapTraceEvent(event, compiled.mapPosition)
  }
  const result = run(code, {
    onEvent: (raw: TraceEvent) => {
      const event = remap(raw)
      if (pending) { event.printed = pending; pending = '' }
      events.push(event)
    },
    onOutput: (line: string) => { pending += line + '\n' },
  }) as { error: unknown }
  expect(result.error).toBeNull()
  annotateJavaScriptTrace(events, source, language)
  return events.filter(e => e.type === 'statement_enter' && e.statement).map(e => `${e.sourceLocation?.line}: ${explainTraceEvent(e).summary}`)
}

describe('JavaScript line explanations', () => {
  it('explains each line with its real values', () => {
    expect(explain([
      'function square(x) {',
      '  return x * x',
      '}',
      'let total = 0',
      'for (let i = 1; i <= 2; i++) {',
      '  total += square(i)',
      '}',
      'const items = []',
      'items.push(total)',
      'if (total > 3) {',
      '  console.log("big", total)',
      '}',
    ].join('\n'))).toEqual([
      '1: Defines the function `square`',
      '4: Assigns `total` = 0',
      '5: Starts the loop: `let i = 1`',
      '5: `i <= 2` is true, so the loop body runs',
      '6: Updates `total`: 0 → 1',
      '2: Returns 1',
      '5: `i <= 2` is true, so the loop body runs',
      '6: Updates `total`: 1 → 5',
      '2: Returns 4',
      '8: Assigns `items` = []',
      '9: Calls `items.push(...)`',
      '10: `total > 3` is true, so the block runs',
      '11: Prints "big 5"',
    ])
  })

  it('explains TypeScript lines against the TypeScript source', () => {
    expect(explain([
      'interface Point { x: number; y: number }',
      'function shift(p: Point, dx: number): Point {',
      '  return { x: p.x + dx, y: p.y }',
      '}',
      'let moved: Point = shift({ x: 1, y: 2 }, 3)',
      'const names: string[] = ["a", "b"]',
      'for (const name of names) {',
      '  console.log(name, moved.x)',
      '}',
    ].join('\n'), 'ts')).toEqual([
      '2: Defines the function `shift`',
      '5: Assigns `moved` = { x: 4, y: 2 }',
      '3: Returns object #3',
      "6: Assigns `names` = [ 'a', 'b' ]",
      '7: Starts looping over `names`',
      '7: Next item: `name` = "a"',
      '8: Prints "a 4"',
      '7: Next item: `name` = "b"',
      '8: Prints "b 4"',
    ])
  })
})
