// Runs the CodeLens Python tracer (python/codelens_tracer.py) in Pyodide, off the page's
// main thread, so a long-running program can't freeze the interface and Stop can end it by
// terminating this worker. One Pyodide per worker, loaded on the first run and reused.
import { createPyodide } from '../../../../utils/pyodideRuntime.js'
import TRACER_SOURCE from './python/codelens_tracer.py?raw'

interface RunMessage {
  type: 'run'
  source: string
  limits: Record<string, number>
}

let ready: Promise<any> | null = null

function pyodide() {
  if (!ready) {
    ready = createPyodide({ fullStdLib: false }).then((py: any) => {
      // Load the tracer as a module so its names don't mix with the learner's program.
      py.FS.writeFile('/home/pyodide/codelens_tracer.py', TRACER_SOURCE)
      py.runPython('import sys\nsys.path.insert(0, "/home/pyodide")\nimport codelens_tracer')
      return py
    })
    ready.catch(() => { ready = null })
  }
  return ready
}

self.onmessage = async (message: MessageEvent<RunMessage>) => {
  if (message.data?.type !== 'run') return
  try {
    const py = await pyodide()
    self.postMessage({ type: 'phase', phase: 'executing' })
    const run = py.globals.get('codelens_tracer').run_to_json
    const json = run(message.data.source, py.toPy(message.data.limits))
    run.destroy?.()
    self.postMessage({ type: 'result', result: JSON.parse(json) })
  } catch (error) {
    self.postMessage({
      type: 'result',
      result: {
        events: [], output: [], status: 'runtime-error',
        error: { type: 'PythonStartupError', message: error instanceof Error ? error.message : String(error) },
      },
    })
  }
}
