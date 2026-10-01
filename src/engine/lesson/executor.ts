// ─── Executor ─────────────────────────────────────────────────────────────────
//
// Adapts the existing inlineRunner to the engine's ExecutionResult shape.
// This is the ONLY file in the engine that knows about specific runtimes.
// Replace this file to target a different execution environment.

import type { ExecutionResult, Lang, OutputLine } from './types'

// Lazy imports so the engine doesn't load heavy runtimes (Pyodide) until first run
async function getRunner() {
  return import('../../utils/inlineRunner.js') as Promise<{
    runJSInline: (code: string) => Promise<{ output: string; error: string | null }>
    runTSInline: (code: string) => Promise<{ output: string; error: string | null }>
    runPythonInline: (code: string, onLine?: (l: { type: string; text?: string; src?: string }) => void) => Promise<{ error: string | null }>
    runSQLInline: (code: string, onLine: (l: { type: string; text?: string }) => void) => Promise<{ error: string | null }>
    runShellInline: (code: string) => { output: string; error: string | null }
    runCInline: (code: string, onLine: (l: { type: string; text?: string }) => void) => Promise<{ error: string | null }>
    RUNNABLE_LANGS: Set<string>
  }>
}

async function getCodeRunner() {
  return import('../../utils/codeRunner.js') as Promise<{
    runCode: (language: string, code: string) => Promise<string>
  }>
}

interface DesktopRun {
  label: string
  stdout: string
  stderr: string
  exitCode: number | null
  timedOut: boolean
  timeoutSeconds: number
}

async function getDesktopRunner() {
  return import('../../utils/desktopCodeRunner.js') as Promise<{
    runOnDesktop: (lang: string, code: string) => Promise<DesktopRun | null>
  }>
}

// Lets the lesson UI say where code ran ("your .NET SDK 10.0.301" or the
// online compilers) without every caller of an Executor passing it along.
export const RAN_ON_EVENT = 'oc-code-ran'
function announceRanOn(ranOn: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(RAN_ON_EVENT, { detail: { ranOn } }))
}

// Windows reports a crashed program by an NTSTATUS exit code. The common
// ones have a cause a learner can act on.
const CRASH_CAUSES: Record<string, string> = {
  c0000005: 'it read or wrote memory it does not own (a bad pointer, an index out of range, or a function that never returned its value)',
  c000001d: 'it reached code that should be unreachable, often a function that never returned its value',
  c00000fd: 'it ran out of stack, usually recursion that never stops',
  c0000094: 'it divided an integer by zero',
  c0000409: 'it overran a buffer or failed a runtime check',
}

function crashMessage(exitCode: number): string | null {
  const hex = (exitCode >>> 0).toString(16)
  if (!hex.startsWith('c0')) return null
  const cause = CRASH_CAUSES[hex]
  return `The program crashed (exit code 0x${hex.toUpperCase()})${cause ? `: ${cause}.` : '.'}`
}

// On the desktop app, C++ and C# compile and run on the learner's computer.
// Returns false when that isn't possible (hosted site, no toolchain, launch
// failure) so the caller uses the online compilers instead.
async function tryDesktop(code: string, lang: string, lines: OutputLine[]): Promise<boolean> {
  const { runOnDesktop } = await getDesktopRunner()
  const run = await runOnDesktop(lang, code)
  if (!run) return false
  const failed = run.timedOut || run.exitCode !== 0
  const stderr = run.stderr.trimEnd()
  const crash = !run.timedOut && run.exitCode != null ? crashMessage(run.exitCode) : null
  run.stdout.split('\n').filter(Boolean).forEach(text => lines.push({ kind: 'stdout', text }))
  if (run.timedOut) {
    if (stderr) lines.push({ kind: 'stderr', text: stderr })
    lines.push({ kind: 'error', text: `Stopped after ${run.timeoutSeconds} s: the program was still running. Is there a loop that never ends?` })
  } else if (crash) {
    // The crash comes first because test results use the first error as their
    // label; any compiler warning that explains it follows.
    lines.push({ kind: 'error', text: stderr ? `${crash}\n\n${stderr}` : crash })
  } else if (failed) {
    // A compile error, or a program that exited with an error code.
    lines.push({ kind: 'error', text: stderr || `Program exited with code ${run.exitCode}.` })
  } else if (stderr) {
    // Compiler warnings on a successful run: worth seeing, not an error.
    lines.push({ kind: 'stderr', text: stderr })
  }
  announceRanOn(`${run.label}, on this computer`)
  return true
}

// Routed through codeRunner.js's Wandbox-backed runCode(), same as C/C++/C#/Java
// below — scala deliberately excluded, no working execution backend right now
// (Wandbox's scalac is broken server-side, Piston is whitelist-only, and Judge0's
// free instance has no Scala runtime configured). Kotlin used to be excluded for
// the same reason but now has a live path: Piston is dead (confirmed 401,
// whitelist-only), but codeRunner.js's Judge0 fallback (language id 111) was
// verified live 2026-08-04 — real Kotlin compiles and runs, and the
// PASS/FAIL/ERROR harness format below round-trips correctly through it.
const WANDBOX_RUNNABLE_LANGS = new Set(['rust', 'go', 'ruby', 'php', 'haskell', 'swift', 'julia', 'r'])

export async function executeCode(code: string, lang: Lang): Promise<ExecutionResult> {
  const start = Date.now()
  const lines: OutputLine[] = []
  const out = (text: string) => text.split('\n').filter(Boolean).forEach(t => lines.push({ kind: 'stdout', text: t }))
  const err = (text: string) => lines.push({ kind: 'error', text })

  try {
    const runner = await getRunner()
    const norm = lang.toLowerCase()

    if (norm === 'python' || norm === 'py') {
      const result = await runner.runPythonInline(code, (line: { type: string; text?: string; src?: string }) => {
        if (line.type === 'output' && line.text) lines.push({ kind: 'stdout', text: line.text })
        else if (line.type === 'error' && line.text) lines.push({ kind: 'error', text: line.text })
      })
      if (result?.error) err(result.error)
    } else if (norm === 'javascript' || norm === 'js') {
      const r = await runner.runJSInline(code)
      if (r.output && r.output !== '(no output)') out(r.output)
      if (r.error) err(r.error)
    } else if (norm === 'typescript' || norm === 'ts') {
      const r = await runner.runTSInline(code)
      if (r.output && r.output !== '(no output)') out(r.output)
      if (r.error) err(r.error)
    } else if (norm === 'html') {
      lines.push({ kind: 'preview', text: code })
    } else if (norm === 'css') {
      err('CSS runs with an HTML tab. Add an `html` fence to preview this style.')
    } else if (norm === 'sql' || norm === 'sqlite') {
      const result = await runner.runSQLInline(code, (line: { type: string; text?: string }) => {
        if (!line.text) return
        lines.push({ kind: line.type === 'error' ? 'error' : 'stdout', text: line.text })
      })
      if (result?.error) err(result.error)
    } else if (norm === 'bash' || norm === 'shell' || norm === 'sh') {
      const r = runner.runShellInline(code)
      if (r.output && r.output !== '(no output)') out(r.output)
      if (r.error) err(r.error)
    } else if ((norm === 'cpp' || norm === 'c++' || norm === 'csharp' || norm === 'cs') && await tryDesktop(code, norm, lines)) {
      // Ran locally; lines are filled in.
    } else if (norm === 'c' || norm === 'cpp' || norm === 'c++') {
      announceRanOn('online compiler')
      try {
        const { runCode } = await getCodeRunner()
        const output = await runCode(norm === 'c' ? 'c' : 'cpp', code)
        if (output.startsWith('Compile error:') || output.startsWith('No runner')) err(output)
        else out(output || '(no output)')
      } catch {
        // Wandbox unavailable — fall back to in-browser JSCPP
        const result = await runner.runCInline(code, (line: { type: string; text?: string }) => {
          if (!line.text) return
          lines.push({ kind: line.type === 'error' ? 'error' : 'stdout', text: line.text })
        })
        if (result?.error) err(result.error)
      }
    } else if (norm === 'csharp' || norm === 'cs') {
      announceRanOn('online compiler')
      const { runCode } = await getCodeRunner()
      const output = await runCode('csharp', code)
      if (output.startsWith('Compile error:') || output.startsWith('No runner')) err(output)
      else out(output || '(no output)')
    } else if (norm === 'java') {
      const { runCode } = await getCodeRunner()
      const output = await runCode('java', code)
      if (output.startsWith('Compile error:') || output.startsWith('No runner')) err(output)
      else out(output || '(no output)')
    } else if (norm === 'kotlin') {
      const { runCode } = await getCodeRunner()
      const output = await runCode('kotlin', code)
      if (output.startsWith('Compile error:') || output.startsWith('No runner')) err(output)
      else out(output || '(no output)')
    } else if (WANDBOX_RUNNABLE_LANGS.has(norm)) {
      const { runCode } = await getCodeRunner()
      const output = await runCode(norm, code)
      if (output.startsWith('Compile error:') || output.startsWith('No runner')) err(output)
      else out(output || '(no output)')
    } else {
      err(`Run not supported for '${lang}'. Supported: python, javascript, typescript, html/css/js, sql, bash, C/C++, C#, Java, Kotlin, Rust, Go, Ruby, PHP, Haskell, Swift, Julia, and R.`)
    }
  } catch (e) {
    err(e instanceof Error ? e.message : String(e))
  }

  if (!lines.length) lines.push({ kind: 'stdout', text: '(no output)' })
  return { lines, durationMs: Date.now() - start }
}

export function isRunnable(lang: Lang): boolean {
  const norm = lang.toLowerCase()
  if (WANDBOX_RUNNABLE_LANGS.has(norm)) return true
  return [
    'python', 'py',
    'javascript', 'js',
    'typescript', 'ts',
    'html', 'css',
    'sql', 'sqlite',
    'bash', 'shell', 'sh',
    'c', 'cpp', 'c++',
    'csharp', 'cs',
    'java',
    'kotlin',
  ].includes(norm)
}
