// The page side of the code cells: one worker for Python and one for
// JavaScript and MATLAB, each running one cell at a time. A run that goes on
// too long is stopped by ending its worker (the only way to stop a loop).
const LIMITS = { py: 60000, light: 10000 }

function createLane(name, makeWorker, limitMs) {
  let worker = null, current = null, deadline = null, jobs = 0
  const queue = [], listeners = new Set()
  let status = { state: 'idle', text: name === 'py' ? 'Python starts the first time a Python cell runs.' : '' }
  const emit = () => listeners.forEach((fn) => fn({ ...status, queued: queue.length + (current ? 1 : 0) }))

  const finish = (result) => {
    clearTimeout(deadline); deadline = null
    const job = current
    current = null
    job?.resolve(result)
    next()
    emit()
  }

  const ensure = () => {
    if (worker) return
    worker = makeWorker()
    worker.onmessage = ({ data }) => {
      if (data.type === 'status') {
        status = { state: data.state, text: data.text }
        // Time a run from when it starts, not while Python downloads.
        if (data.state === 'running' && current && !deadline) deadline = setTimeout(() => stop('timeout'), limitMs)
        emit()
        return
      }
      if (current && data.job === current.job) finish(data)
    }
    worker.onerror = (e) => {
      worker?.terminate(); worker = null
      status = { state: 'error', text: 'The ' + (name === 'py' ? 'Python' : 'code') + ' runner could not start.' }
      finish({ error: '#CODE!', detail: 'The runner could not start: ' + (e?.message ?? 'unknown error') + '. Check your connection and try again.' })
    }
  }

  const next = () => {
    if (current || !queue.length) return
    current = queue.shift()
    ensure()
    worker.postMessage({ job: current.job, lang: current.lang, source: current.source, inputs: current.inputs })
    if (name !== 'py') deadline = setTimeout(() => stop('timeout'), limitMs)
  }

  // Ends the worker: the running cell and any waiting ones get an error.
  const stop = (reason = 'stop') => {
    worker?.terminate(); worker = null
    clearTimeout(deadline); deadline = null
    const cancelled = [current, ...queue].filter(Boolean)
    current = null; queue.length = 0
    const seconds = Math.round(limitMs / 1000)
    const detail = reason === 'timeout'
      ? 'Stopped after ' + seconds + ' seconds. The code may be stuck in a loop that never ends; edit the cell to run it again.'
      : 'Stopped. Edit the cell to run it again.'
    status = { state: 'stopped', text: reason === 'timeout' ? 'A cell ran too long and was stopped.' : 'Stopped.' }
    cancelled.forEach((job) => job.resolve({ error: '#CODE!', detail }))
    emit()
  }

  return {
    run: ({ lang, source, inputs }) => new Promise((resolve) => {
      queue.push({ job: ++jobs, lang, source, inputs, resolve })
      next()
      emit()
    }),
    stop,
    subscribe: (fn) => { listeners.add(fn); fn({ ...status, queued: queue.length + (current ? 1 : 0) }); return () => listeners.delete(fn) },
    release: () => { worker?.terminate(); worker = null },
  }
}

// makeWorker(kind) can be replaced in tests by a fake worker.
export function createCodeRuntime({ makeWorker, limits = LIMITS } = {}) {
  const make = makeWorker ?? ((kind) => (kind === 'py'
    ? new Worker(new URL('./python.worker.js', import.meta.url), { type: 'module' })
    : new Worker(new URL('./code.worker.js', import.meta.url), { type: 'module' })))
  const python = createLane('py', () => make('py'), limits.py)
  const light = createLane('light', () => make('light'), limits.light)
  return {
    run: (job) => (job.lang === 'py' ? python : light).run(job),
    python,
    light,
    stopAll: () => { python.stop(); light.stop() },
    release: () => { python.release(); light.release() },
  }
}
