/// <reference lib="webworker" />

import { run } from '../../../../engines/js/interpreter/interpreter.js'
import type { ExecutionLimits, ExecutionResult, TraceEvent } from '../types'

interface RunRequest {
  type: 'run'
  source: string
  limits: ExecutionLimits
}

const EVENT_BATCH_SIZE = 100
const OUTPUT_BATCH_SIZE = 25

self.onmessage = (event: MessageEvent<RunRequest>) => {
  if (event.data?.type !== 'run') return

  const events: TraceEvent[] = []
  const output: string[] = []

  const flush = () => {
    if (events.length === 0 && output.length === 0) return
    self.postMessage({ type: 'progress', events: events.splice(0), output: output.splice(0) })
  }

  const raw = run(event.data.source, {
    limits: event.data.limits,
    onEvent: (traceEvent: TraceEvent) => {
      events.push(traceEvent)
      if (events.length >= EVENT_BATCH_SIZE) flush()
    },
    onOutput: (line: string) => {
      output.push(line)
      if (output.length >= OUTPUT_BATCH_SIZE) flush()
    },
  }) as ExecutionResult

  flush()
  self.postMessage({
    type: 'result',
    result: {
      ...raw,
      // Progress messages already transferred these potentially large arrays.
      events: [],
      output: [],
    },
  })
}

export {}
