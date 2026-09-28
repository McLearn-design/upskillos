// Runs every lab's reference solution and starter against its checks inside
// the same installed Pyodide release the browser worker loads, so version
// differences in numpy/pandas/scikit-learn are caught. Usage:
//   node src/labs/ml-lab/tools/verify-pyodide.mjs node_modules/pyodide/pyodide.mjs [lab numbers...]
import { readdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const labsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'labs')
const [pyodidePath, ...only] = process.argv.slice(2)
if (!pyodidePath) { console.error('Pass the path to the installed pyodide.mjs.'); process.exit(2) }
const { loadPyodide } = await import(pathToFileURL(resolve(pyodidePath)))
const py = await loadPyodide()
console.log(`Pyodide ${py.version}`)
let failures = 0
for (const folder of readdirSync(labsDir).filter(f => /^l\d\d-/.test(f)).sort()) {
  const number = Number(folder.slice(1, 3))
  if (only.length && !only.includes(String(number))) continue
  const lab = (await import(pathToFileURL(join(labsDir, folder, 'python.js')))).default
  let out = ''
  py.setStdout({ batched: t => { out += `${t}\n` } }); py.setStderr({ batched: t => { out += `${t}\n` } })
  await py.loadPackage(lab.packages || ['numpy'], { messageCallback: () => {} })
  const run = async code => {
    const scope = py.toPy({})
    try { await py.runPythonAsync(code, { globals: scope }); await py.runPythonAsync(lab.checks, { globals: scope }); return true } catch (e) { out += String(e.message); return false } finally { scope.destroy() }
  }
  const ok = await run(lab.solution), solutionOut = out
  out = ''
  const starterPasses = await run(lab.starter)
  if (!ok || starterPasses) failures++
  console.log(`${ok && !starterPasses ? 'OK  ' : 'FAIL'} lab ${number}: solution ${ok ? 'passes' : 'FAILS'}; starter ${starterPasses ? 'PASSES (checks too weak)' : 'fails as expected'}`)
  if (!ok) console.log(solutionOut.split('\n').slice(-12).join('\n'))
}
process.exit(failures ? 1 : 0)
