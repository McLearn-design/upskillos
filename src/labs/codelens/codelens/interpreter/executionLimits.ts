import type { ExecutionLimits } from '../types'

export const JAVASCRIPT_EXECUTION_LIMITS: ExecutionLimits = Object.freeze({
  maxRuntimeMs: 2_500,
  maxSteps: 50_000,
  maxEvents: 25_000,
  maxTraceChars: 32_000_000,
  maxOutputLines: 500,
  maxOutputChars: 100_000,
  maxRecursionDepth: 256,
  maxHeapObjects: 10_000,
  maxHeapProperties: 100_000,
  maxSnapshotItems: 12,
  maxSnapshotChars: 300,
})
