import { describe, expect, it } from 'vitest'
import { explainTraceEvent } from './explainTrace'
import type { TraceEvent } from './types'

const event = (fields: Partial<TraceEvent>): TraceEvent => ({ stepId: 0, type: 'statement_enter', language: 'python', line: 1, ...fields })

describe('explainTraceEvent', () => {
  it('describes a line the tracer could not classify by what it did', () => {
    const explanation = explainTraceEvent(event({
      line: 3,
      outcome: { changes: [{ name: 'total', oldValue: 1, newValue: 3, isNew: false }, { name: 'n', newValue: 2, isNew: true }] },
    }))
    expect(explanation.summary).toBe('Runs line 3: `total`: 1 → 3, `n` = 2')
    expect(explanation.why).toBe('What it did: `total` changes from 1 to 3; `n` is created: 2.')
  })

  it('describes heap changes, telling a new property from one that changed', () => {
    const { why } = explainTraceEvent(event({
      statement: { kind: 'Expr', code: 'build()', call: 'build' },
      outcome: {
        heap: [
          { op: 'create', objectId: 4, objectType: 'list', properties: {} },
          { op: 'mutate', objectId: 4, objectType: 'list', property: '0', newValue: 10 },
          { op: 'mutate', objectId: 2, objectType: 'Node', property: 'value', oldValue: 1, newValue: 10 },
          { op: 'mutate', objectId: 2, objectType: 'Node', property: 'next', oldValue: null, newValue: { $ref: 4 } },
        ],
      },
    }))
    expect(why).toContain('A new list (#4) is created')
    expect(why).toContain('list #4[0] is set to 10')
    expect(why).toContain('Node #2.value changes from 1 to 10')
    expect(why).toContain('Node #2.next changes from None to object #4')   // None, in Python's words
  })

  it('names calls with their arguments, and returns with their value', () => {
    expect(explainTraceEvent(event({ type: 'function_call', functionName: 'fact', args: [4], argNames: ['n'] })).summary).toBe('Calling `fact(n=4)`')
    expect(explainTraceEvent(event({ type: 'function_return', functionName: 'fact', returnValue: 24 })).summary).toBe('`fact` returns 24')
    expect(explainTraceEvent(event({ type: 'function_return', functionName: 'show', returnValue: null })).summary).toBe('`show` returns None')
  })

  it('doesn’t invent a return value the tracer didn’t record', () => {
    expect(explainTraceEvent(event({ type: 'function_return', language: 'cpp', functionName: 'sumList' })).summary)
      .toBe('`sumList` finishes and returns to its caller')
  })

  it('uses each language’s own wording', () => {
    const cpp = explainTraceEvent(event({ type: 'function_call', language: 'cpp', functionName: 'area', args: [3], argNames: ['r'] }))
    expect(cpp.why).toContain('destructors')
    expect(explainTraceEvent(event({ type: 'error_thrown', errorType: 'IndexError', message: 'list index out of range', line: 2 })).summary)
      .toBe('IndexError: list index out of range (line 2)')
  })
})
