import { describe, expect, it, vi } from 'vitest'

// configureMonaco.js fails the first time it is imported, then works.
let configureAttempts = 0
vi.mock('./configureMonaco.js', () => {
  configureAttempts++
  if (configureAttempts === 1) throw new Error('network down')
  return {}
})
vi.mock('./staleChunk.js', () => ({ isStaleChunkError: () => false, reloadForNewVersion: vi.fn() }))
vi.mock('@monaco-editor/react', () => ({ loader: { init: () => Promise.resolve('monaco') } }))

const { loader } = await import('@monaco-editor/react')
await import('./lazyMonaco.js')

const settlesWithin = (promise, ms) => Promise.race([
  promise.then(() => 'resolved', () => 'rejected'),
  new Promise((resolve) => setTimeout(() => resolve('pending'), ms)),
])

describe('lazyMonaco', () => {
  it('lets a later editor retry after the bundled Monaco failed to load', async () => {
    await expect(loader.init()).rejects.toThrow()
    vi.resetModules() // a new import() of configureMonaco.js runs the mock factory again
    await expect(loader.init()).resolves.toBe('monaco')
  })

  it('never settles a canceled load, so callers without a catch see no error', async () => {
    const promise = loader.init()
    promise.cancel()
    expect(await settlesWithin(promise, 50)).toBe('pending')
  })
})
