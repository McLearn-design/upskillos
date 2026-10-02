import { describe, expect, it } from 'vitest'
import { createCodeRuntime } from './runtime.js'

// A fake worker that answers each job with the input doubled, after `delay` ms;
// source "loop" never answers.
function fakeWorker(delay = 0) {
  const w = {
    terminated: false,
    postMessage({ job, source, inputs }) {
      if (source === 'loop') return
      setTimeout(() => { if (!w.terminated) w.onmessage({ data: { job, value: Object.values(inputs)[0] * 2 } }) }, delay)
    },
    terminate() { w.terminated = true },
  }
  return w
}

describe('code runtime', () => {
  it('runs jobs one after another and keeps working for later runs', async () => {
    const rt = createCodeRuntime({ makeWorker: () => fakeWorker(5) })
    const a = await rt.run({ lang: 'js', source: 'x', inputs: { A1: 1 } })
    const [b, c] = await Promise.all([rt.run({ lang: 'js', source: 'x', inputs: { A1: 2 } }), rt.run({ lang: 'matlab', source: 'x', inputs: { A1: 3 } })])
    const d = await rt.run({ lang: 'py', source: 'x', inputs: { A1: 4 } })
    const e = await rt.run({ lang: 'py', source: 'x', inputs: { A1: 5 } })
    expect([a.value, b.value, c.value, d.value, e.value]).toEqual([2, 4, 6, 8, 10])
  })

  it('stops a run that takes too long, then runs the next one on a new worker', async () => {
    let made = 0
    const rt = createCodeRuntime({ makeWorker: () => { made++; return fakeWorker(0) }, limits: { py: 50, light: 50 } })
    const stuck = await rt.run({ lang: 'js', source: 'loop', inputs: {} })
    expect(stuck.error).toBe('#CODE!')
    expect(stuck.detail).toMatch(/Stopped after/)
    const next = await rt.run({ lang: 'js', source: 'x', inputs: { A1: 7 } })
    expect(next.value).toBe(14)
    expect(made).toBe(2)
  })
})
