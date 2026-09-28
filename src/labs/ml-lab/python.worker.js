// Dedicated worker: a runaway exercise can be terminated without freezing the app.
import { createPyodide } from '../../utils/pyodideRuntime.js'

let runtime
const loaded = new Set()
self.onmessage = async ({ data }) => {
  try {
    self.postMessage({ type: 'status', text: 'Starting the bundled Python runtime…' })
    if (!runtime) {
      runtime = await createPyodide()
    }
    const missing = (data.packages || ['numpy']).filter(name => !loaded.has(name))
    if (missing.length) {
      self.postMessage({ type: 'status', text: `Loading ${missing.join(', ')}…` })
      await runtime.loadPackage(missing)
      missing.forEach(name => loaded.add(name))
    }
    self.postMessage({ type: 'status', text: 'Running Python…' })
    runtime.setStdout({ batched: text => self.postMessage({ type: 'output', text }) })
    runtime.setStderr({ batched: text => self.postMessage({ type: 'output', text }) })
    const scope = runtime.toPy({})
    try {
      await runtime.runPythonAsync(data.code, { globals: scope })
      if (data.checks) await runtime.runPythonAsync(data.checks, { globals: scope })
    } finally { scope.destroy() }
    self.postMessage({ type: 'done', checked: Boolean(data.checks) })
  } catch (error) { self.postMessage({ type: 'error', text: String(error.message || error) }) }
}
