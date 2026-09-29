import type {
  ExecutionLimitKind,
  ExecutionResult,
  ExecutionStatus,
  RuntimeError,
  TraceEvent,
} from '../types'
import { JAVASCRIPT_EXECUTION_LIMITS } from './executionLimits'

const WORKER_TIMEOUT_GRACE_MS = 500

interface ProgressMessage {
  type: 'progress'
  events: TraceEvent[]
  output: string[]
}

interface ResultMessage {
  type: 'result'
  result: ExecutionResult
}

type WorkerMessage = ProgressMessage | ResultMessage

export interface JavaScriptExecutionHandle {
  promise: Promise<ExecutionResult>
  stop: () => void
}

function statusFor(error: RuntimeError | null): ExecutionStatus {
  if (!error) return 'completed'
  if (error.type === 'ExecutionLimitError' || error.limitKind) return 'limit'
  return error.line != null || error.type === 'SyntaxError' ? 'syntax-error' : 'runtime-error'
}

function stoppedResult(events: TraceEvent[], output: string[]): ExecutionResult {
  return {
    events,
    output,
    error: null,
    status: 'stopped',
  }
}

function timeoutResult(events: TraceEvent[], output: string[]): ExecutionResult {
  return {
    events,
    output,
    error: null,
    status: 'limit',
    limit: {
      kind: 'timeout',
      message: `Runtime limit (${JAVASCRIPT_EXECUTION_LIMITS.maxRuntimeMs} ms) reached`,
    },
  }
}

export function startJavaScriptExecution(source: string): JavaScriptExecutionHandle {
  const worker = new Worker(new URL('./jsExecution.worker.ts', import.meta.url), { type: 'module' })
  const events: TraceEvent[] = []
  const output: string[] = []
  let settled = false
  let resolvePromise: (result: ExecutionResult) => void = () => {}

  const finish = (result: ExecutionResult) => {
    if (settled) return
    settled = true
    window.clearTimeout(timeoutId)
    worker.terminate()
    resolvePromise(result)
  }

  const timeoutId = window.setTimeout(() => {
    finish(timeoutResult(events, output))
  }, JAVASCRIPT_EXECUTION_LIMITS.maxRuntimeMs + WORKER_TIMEOUT_GRACE_MS)

  const promise = new Promise<ExecutionResult>((resolve) => {
    resolvePromise = resolve
  })

  worker.onmessage = (message: MessageEvent<WorkerMessage>) => {
    if (settled) return
    if (message.data.type === 'progress') {
      events.push(...message.data.events)
      output.push(...message.data.output)
      return
    }

    const error = message.data.result.error
    const status = statusFor(error)
    const limitKind = error?.limitKind as ExecutionLimitKind | undefined
    finish({
      ...message.data.result,
      events,
      output,
      status,
      ...(status === 'limit' ? {
        limit: {
          kind: limitKind ?? 'steps',
          message: error?.message ?? 'Execution limit reached',
        },
      } : {}),
    })
  }

  worker.onerror = (event) => {
    finish({
      events,
      output,
      status: 'runtime-error',
      error: { type: 'WorkerError', message: event.message || 'The execution worker failed' },
    })
  }

  worker.postMessage({
    type: 'run',
    source,
    limits: JAVASCRIPT_EXECUTION_LIMITS,
  })

  return {
    promise,
    stop: () => finish(stoppedResult(events, output)),
  }
}

export function withExecutionStatus(result: ExecutionResult): ExecutionResult {
  if (result.status) return result
  return { ...result, status: statusFor(result.error) }
}
