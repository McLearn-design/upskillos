// Runs code on the learner's own computer when the app is the desktop build
// and a working toolchain is available (theirs first, else the app-managed
// one; see desktop/app/runtimes/_toolchains.cjs). Returns null whenever a
// local run isn't possible, and the caller then uses the online compilers
// in codeRunner.js, so the hosted site behaves exactly as before.

import { autoWrap } from './codeRunner.js'

// Lesson language -> desktop runtime name (keys of RUNTIMES in desktop/app/main.cjs).
// C is not here: the cpp runtime compiles as C++, which rejects valid C
// (e.g. assigning malloc's void* without a cast), so C stays online for now.
const LOCAL_RUNTIME = { cpp: 'cpp', 'c++': 'cpp', csharp: 'dotnet', cs: 'dotnet', 'c#': 'dotnet' }

// Whole run, compile included. .NET's first build of a session restores
// packages and starts the compiler server, which takes several seconds.
const TIMEOUT_MS = { cpp: 20000, dotnet: 60000 }

function desktopApi() {
  return typeof window !== 'undefined' ? window.openCalcDesktop : undefined
}

function describe(runtime, status) {
  if (status.source === 'system') {
    if (runtime === 'dotnet') return `your .NET SDK ${status.version}`
    const tool = (status.path || '').split(/[\\/]/).pop().replace(/\.exe$/i, '') || 'compiler'
    const version = (status.version || '').match(/(\d+\.\d+(?:\.\d+)?)\s*$/)?.[1]
    return `your ${tool}${version ? ` ${version}` : ''}`
  }
  return `the app's ${runtime === 'dotnet' ? '.NET SDK' : 'C++ toolchain'} (${status.version})`
}

// { runtime, label } when this language can run locally right now, else null.
export async function localToolchain(lang) {
  const api = desktopApi()
  const runtime = LOCAL_RUNTIME[String(lang).toLowerCase()]
  if (!api?.runCode || !api?.getRuntimeStatus || !runtime) return null
  try {
    const res = await api.getRuntimeStatus(runtime)
    if (!res?.ok || !res.status?.installed) return null
    return { runtime, label: describe(runtime, res.status) }
  } catch {
    return null
  }
}

// Runs one program to completion. Resolves to
//   { label, stdout, stderr, exitCode, timedOut }
// or null when it could not be started locally (caller falls back to online).
export async function runOnDesktop(lang, code) {
  const toolchain = await localToolchain(lang)
  if (!toolchain) return null
  const api = desktopApi()
  const { runtime, label } = toolchain
  // Same wrapping the online path applies, so a snippet without main() or a
  // class runs the same on both.
  const wrapped = autoWrap(runtime === 'dotnet' ? 'csharp' : 'cpp', code)

  // Subscribe before starting and keep every event: output is matched to
  // this run by runId, which is only known once runCode returns.
  const events = []
  let notify = () => {}
  const unsubscribe = api.onScriptOutput((evt) => { events.push(evt); notify() })

  try {
    const res = await api.runCode(runtime, wrapped)
    if (!res?.ok) return null
    const mine = () => events.filter(e => e.runId === res.runId)

    const timedOut = await new Promise((resolve) => {
      const timer = setTimeout(() => { notify = () => {}; resolve(true) }, TIMEOUT_MS[runtime])
      notify = () => {
        if (mine().some(e => e.stream === 'exit')) { clearTimeout(timer); notify = () => {}; resolve(false) }
      }
      notify()
    })
    if (timedOut) await api.stopRun?.(res.runId)

    const text = (stream) => mine().filter(e => e.stream === stream).map(e => e.text).join('').replace(/\r\n/g, '\n')
    return {
      label,
      stdout: text('stdout'),
      stderr: text('stderr'),
      exitCode: timedOut ? null : mine().find(e => e.stream === 'exit')?.code ?? null,
      timedOut,
      timeoutSeconds: TIMEOUT_MS[runtime] / 1000,
    }
  } catch {
    return null
  } finally {
    unsubscribe()
  }
}
