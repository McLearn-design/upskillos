// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isStaleChunkError, reloadForNewVersion } from './staleChunk.js'

afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); vi.useRealTimers() })

describe('isStaleChunkError', () => {
  it('recognises the errors browsers give for a removed chunk', () => {
    expect(isStaleChunkError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/a.js'))).toBe(true)
    expect(isStaleChunkError(new TypeError('error loading dynamically imported module'))).toBe(true)
    expect(isStaleChunkError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isStaleChunkError('Unable to preload CSS for /assets/a.css')).toBe(true)
  })

  it('ignores other errors', () => {
    expect(isStaleChunkError(new Error('x is not defined'))).toBe(false)
    expect(isStaleChunkError(null)).toBe(false)
  })
})

describe('reloadForNewVersion', () => {
  it('reloads once, then not again within 30 seconds, so a missing file cannot loop', () => {
    const reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ reload })
    vi.useFakeTimers()
    expect(reloadForNewVersion()).toBe(true)
    expect(reloadForNewVersion()).toBe(false)
    vi.advanceTimersByTime(31_000)
    expect(reloadForNewVersion()).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })
})
