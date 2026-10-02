// The desktop path runs the CodeLens tracer on the learner's own CPython. These tests run it
// on this machine's Python when there is one (and skip otherwise, as on CI), so they check
// the real tracer, not a mock.
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { desktopScript, parseDesktopResult } from './pythonExecutionClient'
import { explainTraceEvent } from '../explainTrace'
import type { ExecutionResult } from '../types'

const python = ['python', 'python3'].find(cmd => spawnSync(cmd, ['--version']).status === 0)

function trace(source: string): ExecutionResult {
  // A run that hits a limit is several megabytes of JSON; the default buffer is 1 MB.
  const run = spawnSync(python!, ['-'], { input: desktopScript(source), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, PYTHONUTF8: '1' } })
  const result = parseDesktopResult(run.stdout.replace(/\r\n/g, '\n'))
  if (!result) throw new Error(`no result; stderr: ${run.stderr}`)
  return result
}

describe.skipIf(!python)('CodeLens Python tracer on CPython', () => {
  it('embeds any source safely: quotes, backslashes, triple quotes and non-ASCII', () => {
    const tricky = 'text = "she said \\"hi\\"" + \'\\\\\' + """x""" + "✓   é"\nprint(len(text))\n'
    const result = trace(tricky)
    expect(result.status).toBe('completed')
    expect(result.output).toEqual(['20'])
  })

  it('shows shared references as the same object', () => {
    const result = trace('a = [1, 2]\nb = a\nb.append(3)\n')
    const last = result.events.at(-1)!
    const globals = last.stackSnapshot!.at(-1)!.locals as Record<string, { $ref: number }>
    expect(globals.a).toEqual(globals.b)                       // one list, two names
    const mutations = result.events.flatMap(e => e.heapDelta ?? []).filter(d => d.op === 'mutate')
    expect(mutations).toContainEqual(expect.objectContaining({ objectId: globals.a.$ref, property: '2', newValue: 3 }))
  })

  it('records calls, returns and the stack during recursion', () => {
    const result = trace('def fact(n):\n    return 1 if n <= 1 else n * fact(n - 1)\nprint(fact(4))\n')
    expect(result.output).toEqual(['24'])
    expect(result.events.filter(e => e.type === 'function_return').map(e => e.returnValue)).toEqual([1, 2, 6, 24])
    expect(Math.max(...result.events.map(e => e.stackSnapshot!.length))).toBe(5)   // (global) + four calls
  })

  it('explains what each line does, with the real values', () => {
    const result = trace([
      'def fact(n):',
      '    if n <= 1:',
      '        return 1',
      '    return n * fact(n - 1)',
      '',
      'total = 0',
      'for n in [1, 2]:',
      '    total += n',
      'items = []',
      'items.append(total)',
      'print("total", total, fact(3))',
    ].join('\n') + '\n')
    const summaries = result.events.filter(e => e.type === 'statement_enter').map(e => `${e.line}: ${explainTraceEvent(e).summary}`)
    expect(summaries).toEqual([
      '1: Defines the function `fact`',
      '6: Assigns `total` = 0',
      '7: Next item: `n` = 1',
      '8: Updates `total`: 0 → 1',
      '7: Next item: `n`: 1 → 2',
      '8: Updates `total`: 1 → 3',
      '7: The loop is finished',
      '9: Assigns `items` = a new list (#1)',
      '10: Calls `items.append(...)`',
      '11: Prints "total 3 6"',
      '2: `n <= 1` is false, so the block is skipped',
      '4: Returns 6',
      '2: `n <= 1` is false, so the block is skipped',
      '4: Returns 2',
      '2: `n <= 1` is true, so the indented block runs',
      '3: Returns 1',
    ])
    const append = result.events.find(e => e.type === 'statement_enter' && e.line === 10)!
    expect(explainTraceEvent(append).why).toContain('list #1[0] is set to 3')
    const call = result.events.find(e => e.type === 'statement_enter' && e.line === 11)!
    expect(explainTraceEvent(call).why).toContain('It calls `fact`')
  })

  it('reports errors and limits with their own statuses', () => {
    expect(trace('def broken(:\n').status).toBe('syntax-error')
    const runtime = trace('items = []\nitems[3]\n')
    expect(runtime.status).toBe('runtime-error')
    expect(runtime.error?.type).toBe('IndexError')
    const loop = trace('while True:\n    pass\n')
    expect(loop.status).toBe('limit')
    expect(loop.limit?.kind).toBe('steps')
  })
})
