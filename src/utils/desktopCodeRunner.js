// Runs code on the learner's own computer when the app is the desktop build
// and a working toolchain is available (theirs first, else the app-managed
// one; see desktop/app/runtimes/_toolchains.cjs). Returns null whenever a
// local run isn't possible, and the caller then uses the online compilers
// in codeRunner.js, so the hosted site behaves exactly as before.

import { autoWrap } from './codeRunner.js'

// Lesson language -> desktop runtime name (keys of RUNTIMES in desktop/app/main.cjs).
// C is not here: the cpp runtime compiles as C++, which rejects valid C
// (e.g. assigning malloc's void* without a cast), so C stays online for now.
const LOCAL_RUNTIME = {
  cpp: 'cpp', 'c++': 'cpp',
  csharp: 'dotnet', cs: 'dotnet', 'c#': 'dotnet',
  python: 'python', py: 'python',
}

// Whole run, compile included. .NET's first build of a session restores
// packages and starts the compiler server, which takes several seconds.
const TIMEOUT_MS = { cpp: 20000, dotnet: 60000, python: 20000 }

const TOOLCHAIN_NAME = { cpp: 'C++ toolchain', dotnet: '.NET SDK', python: 'Python' }

function desktopApi() {
  return typeof window !== 'undefined' ? window.openCalcDesktop : undefined
}

function describe(runtime, status) {
  if (status.source === 'system') {
    if (runtime === 'dotnet') return `your .NET SDK ${status.version}`
    if (runtime === 'python') return `your Python ${status.version}`
    const tool = (status.path || '').split(/[\\/]/).pop().replace(/\.exe$/i, '') || 'compiler'
    const version = (status.version || '').match(/(\d+\.\d+(?:\.\d+)?)\s*$/)?.[1]
    return `your ${tool}${version ? ` ${version}` : ''}`
  }
  return `the app's ${TOOLCHAIN_NAME[runtime]} (${status.version})`
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

// Project template -> the language whose toolchain builds it.
const PROJECT_LANG = { wpf: 'csharp', console: 'csharp' }

// A project's first build (WPF restores packages and compiles XAML) is slower than a
// single file; a test run includes that build.
const PROJECT_TIMEOUT_MS = 120000

// Builds and runs a multi-file lesson project on the desktop (desktop/app/runtimes/dotnet.cjs
// runProject). spec: { template, mode: 'test' | 'launch' | 'inspect', files: [{ path, content }] }.
//
// mode 'test' resolves when the program exits, like runOnDesktop.
// mode 'launch' resolves as soon as the app window has started ({ launched: true }), or with
// the build's errors if it never started. Output the running app prints afterwards, and its
// exit, go to onAfterLaunch(event) until the learner closes the window.
// Resolves to null when this can't run locally (hosted site, no .NET SDK).
export async function runProjectOnDesktop(spec, { onAfterLaunch } = {}) {
  const lang = PROJECT_LANG[spec?.template]
  const toolchain = lang ? await localToolchain(lang) : null
  const api = desktopApi()
  if (!api?.runProject) return null
  if (!toolchain) {
    return { label: '', stdout: '', stderr: 'No .NET SDK was found on this computer. Install the .NET SDK (https://dotnet.microsoft.com/download), then restart the app.', exitCode: 1, timedOut: false, timeoutSeconds: 0, launched: false, files: [] }
  }

  const events = []
  let notify = () => {}
  let launchedRunId = null
  const unsubscribe = api.onScriptOutput((evt) => {
    if (launchedRunId && evt.runId === launchedRunId) {
      onAfterLaunch?.(evt)
      if (evt.stream === 'exit') unsubscribe()
      return
    }
    events.push(evt)
    notify()
  })
  let keepListening = false

  try {
    const res = await api.runProject(toolchain.runtime, spec)
    if (!res?.ok) {
      return { label: toolchain.label, stdout: '', stderr: res?.reason || 'The project could not be started.', exitCode: 1, timedOut: false, timeoutSeconds: 0, launched: false }
    }
    const mine = () => events.filter(e => e.runId === res.runId)
    const launch = spec.mode === 'launch'
    const done = () => mine().some(e => e.stream === 'exit' || (launch && e.stream === 'launched'))

    const timedOut = await new Promise((resolve) => {
      const timer = setTimeout(() => { notify = () => {}; resolve(true) }, PROJECT_TIMEOUT_MS)
      notify = () => { if (done()) { clearTimeout(timer); notify = () => {}; resolve(false) } }
      notify()
    })
    if (timedOut) await api.stopRun?.(res.runId)

    const launched = !timedOut && mine().some(e => e.stream === 'launched') && !mine().some(e => e.stream === 'exit')
    if (launched) { launchedRunId = res.runId; keepListening = true }
    const text = (stream) => mine().filter(e => e.stream === stream).map(e => e.text).join('').replace(/\r\n/g, '\n')
    return {
      label: toolchain.label,
      stdout: text('stdout'),
      stderr: text('stderr'),
      exitCode: timedOut || launched ? null : mine().find(e => e.stream === 'exit')?.code ?? null,
      timedOut,
      timeoutSeconds: PROJECT_TIMEOUT_MS / 1000,
      launched,
      // inspect mode: what the build generated (project file, *.g.cs, source-generator output)
      files: mine().filter(e => e.stream === 'file').map(e => ({ path: e.path, text: e.text })),
    }
  } catch (e) {
    // On the desktop, so report what went wrong rather than "needs the desktop app". A
    // likely cause is an app started before its desktop code changed: Vite reloads the
    // page, but Electron's main process only loads its code at startup.
    const reason = String(e?.message ?? e)
    const hint = /No handler registered/i.test(reason) ? ' Restart the desktop app to load its latest code.' : ''
    return { label: toolchain.label, stdout: '', stderr: `The project could not be started: ${reason}.${hint}`, exitCode: 1, timedOut: false, timeoutSeconds: 0, launched: false, files: [] }
  } finally {
    if (!keepListening) unsubscribe()
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
  const wrapped = runtime === 'python' ? code : autoWrap(runtime === 'dotnet' ? 'csharp' : 'cpp', code)

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
