// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// The online compilers (Wandbox, then Piston, then Judge0) — never really called here.
const onlineRunCode = vi.fn(async (_lang: string, _code: string) => 'online output')
vi.mock('../../utils/codeRunner.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../utils/codeRunner.js')>()
  return { ...real, runCode: (lang: string, code: string) => onlineRunCode(lang, code) }
})

// Pyodide, the in-browser Python — never really loaded here.
const pyodideRun = vi.fn(async (_code: string, onLine?: (l: { type: string; text?: string }) => void) => {
  onLine?.({ type: 'output', text: 'pyodide output' })
  return { error: null }
})
vi.mock('../../utils/inlineRunner.js', () => ({ runPythonInline: (code: string, onLine: any) => pyodideRun(code, onLine) }))

import { executeCode, RAN_ON_EVENT } from './executor'
import { runTests } from './testRunner'

type Evt = { runId: string; stream: string; text?: string; code?: number | null }

// Stand-in for window.openCalcDesktop (desktop/app/preload.cjs). `script` decides
// what a run prints; events are sent after runCode returns, like the real runtimes.
function fakeDesktop(opts: {
  status?: { installed: boolean; source?: string; version?: string; path?: string }
  script?: (code: string) => Evt[] | 'hang'
}) {
  const listeners = new Set<(e: Evt) => void>()
  const api = {
    ranCode: [] as string[],
    stopped: [] as string[],
    getRuntimeStatus: vi.fn(async () => ({ ok: true, status: opts.status ?? { installed: true, source: 'system', version: '10.0.301', path: 'C:\\dotnet\\dotnet.exe' } })),
    runCode: vi.fn(async (_runtime: string, code: string) => {
      api.ranCode.push(code)
      const runId = `run-${api.ranCode.length}`
      const events = opts.script?.(code) ?? []
      if (events !== 'hang') setTimeout(() => events.forEach(e => listeners.forEach(l => l({ ...e, runId }))), 0)
      return { ok: true, runId }
    }),
    stopRun: vi.fn(async (runId: string) => { api.stopped.push(runId); return { ok: true } }),
    onScriptOutput: (cb: (e: Evt) => void) => { listeners.add(cb); return () => listeners.delete(cb) },
  }
  ;(window as any).openCalcDesktop = api
  return api
}

const out = (text: string): Evt => ({ runId: '', stream: 'stdout', text })
const err = (text: string): Evt => ({ runId: '', stream: 'stderr', text })
const exit = (code: number | null): Evt => ({ runId: '', stream: 'exit', code })

function captureRanOn() {
  const seen: string[] = []
  const on = (e: Event) => seen.push((e as CustomEvent).detail.ranOn)
  window.addEventListener(RAN_ON_EVENT, on)
  return { seen, stop: () => window.removeEventListener(RAN_ON_EVENT, on) }
}

// executeCode imports its runners lazily. Load them once here: on a cold cache the first
// import took longer than the 5 s test timeout and failed whichever test happened to be first.
beforeAll(async () => {
  await import('../../utils/codeRunner.js')
  await import('../../utils/desktopCodeRunner.js')
}, 60000)

beforeEach(() => onlineRunCode.mockClear())
afterEach(() => { delete (window as any).openCalcDesktop; vi.useRealTimers() })

describe('executeCode: C++ and C# on the hosted site', () => {
  it('uses the online compilers when there is no desktop API', async () => {
    const ranOn = captureRanOn()
    const r = await executeCode('Console.WriteLine("hi");', 'csharp')
    ranOn.stop()
    expect(onlineRunCode).toHaveBeenCalledWith('csharp', 'Console.WriteLine("hi");')
    expect(r.lines).toEqual([{ kind: 'stdout', text: 'online output' }])
    expect(ranOn.seen).toEqual(['online compiler'])
  })

  it('uses the online compilers on desktop when no toolchain is available', async () => {
    const api = fakeDesktop({ status: { installed: false } })
    await executeCode('int main() {}', 'cpp')
    expect(api.runCode).not.toHaveBeenCalled()
    expect(onlineRunCode).toHaveBeenCalledWith('cpp', 'int main() {}')
  })
})

describe('executeCode: C++ and C# on the desktop app', () => {
  it('runs C# on the local SDK and says so', async () => {
    const api = fakeDesktop({ script: () => [out('Hello\r\n'), out('World\r\n'), exit(0)] })
    const ranOn = captureRanOn()
    const r = await executeCode('Console.WriteLine("Hello");', 'csharp')
    ranOn.stop()
    expect(onlineRunCode).not.toHaveBeenCalled()
    expect(r.lines).toEqual([{ kind: 'stdout', text: 'Hello' }, { kind: 'stdout', text: 'World' }])
    expect(ranOn.seen).toEqual(['your .NET SDK 10.0.301, on this computer'])
    // A bare snippet gets the same class/Main wrapper the online path adds.
    expect(api.ranCode[0]).toMatch(/class Program[\s\S]*static void Main/)
  })

  it('names the learner\'s C++ compiler', async () => {
    fakeDesktop({
      status: { installed: true, source: 'system', version: 'g++.exe (MinGW-W64 x86_64-ucrt-posix-seh, built by Brecht Sanders, r1) 16.2.0', path: 'C:\\mingw64\\bin\\g++.exe' },
      script: () => [out('ok\n'), exit(0)],
    })
    const ranOn = captureRanOn()
    await executeCode('#include <iostream>\nint main() { std::cout << "ok"; }', 'cpp')
    ranOn.stop()
    expect(ranOn.seen).toEqual(['your g++ 16.2.0, on this computer'])
  })

  it('keeps compiler warnings apart from program output on a successful run', async () => {
    fakeDesktop({ script: () => [err('Program.cs(5,16): warning CS0219: unused\n'), out('42\n'), exit(0)] })
    const r = await executeCode('class P { static void Main() {} }', 'csharp')
    expect(r.lines).toEqual([
      { kind: 'stdout', text: '42' },
      { kind: 'stderr', text: 'Program.cs(5,16): warning CS0219: unused' },
    ])
  })

  it('reports a compile error as an error', async () => {
    fakeDesktop({ script: () => [err("Program.cs(3,80): error CS0029: Cannot implicitly convert type 'int' to 'string'\n"), exit(1)] })
    const r = await executeCode('class P { static void Main() {} }', 'csharp')
    expect(r.lines).toEqual([{ kind: 'error', text: "Program.cs(3,80): error CS0029: Cannot implicitly convert type 'int' to 'string'" }])
  })

  it('explains a crash, ahead of the warning that caused it', async () => {
    // Node reports Windows exit codes unsigned; 3221225477 is 0xC0000005.
    fakeDesktop({ script: () => [err("main.cpp:5:1: warning: no return statement in function returning non-void\n"), exit(3221225477)] })
    const r = await executeCode('int main() { int* p = nullptr; return *p; }', 'cpp')
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0].kind).toBe('error')
    expect(r.lines[0].text).toMatch(/^The program crashed \(exit code 0xC0000005\): it read or wrote memory it does not own/)
    expect(r.lines[0].text).toContain('warning: no return statement')
  })

  it('reports a non-zero exit with no message by its exit code', async () => {
    fakeDesktop({ script: () => [exit(3)] })
    const r = await executeCode('int main() { return 3; }', 'cpp')
    expect(r.lines).toEqual([{ kind: 'error', text: 'Program exited with code 3.' }])
  })

  it('stops a program that never finishes', async () => {
    vi.useFakeTimers()
    const api = fakeDesktop({ script: () => 'hang' })
    const pending = executeCode('int main() { for (;;) {} }', 'cpp')
    await vi.advanceTimersByTimeAsync(20000)
    const r = await pending
    expect(api.stopped).toEqual(['run-1'])
    expect(r.lines.at(-1)?.text).toMatch(/^Stopped after 20 s/)
  })

  it('leaves C on the online compilers (the local runtime compiles as C++)', async () => {
    const api = fakeDesktop({})
    await executeCode('int main(void) { return 0; }', 'c')
    expect(api.runCode).not.toHaveBeenCalled()
    expect(onlineRunCode).toHaveBeenCalled()
  })
})

describe('executeCode: Python', () => {
  beforeEach(() => pyodideRun.mockClear())

  it('uses Pyodide on the hosted site', async () => {
    const ranOn = captureRanOn()
    const r = await executeCode('print(1)', 'python')
    ranOn.stop()
    expect(pyodideRun).toHaveBeenCalled()
    expect(r.lines).toEqual([{ kind: 'stdout', text: 'pyodide output' }])
    expect(ranOn.seen).toEqual(['Pyodide, in the browser'])
  })

  it('uses the learner\'s Python on desktop, unwrapped', async () => {
    const api = fakeDesktop({
      status: { installed: true, source: 'system', version: '3.13.14', path: 'C:\\Python\\python.exe' },
      script: () => [out('3\n'), exit(0)],
    })
    const ranOn = captureRanOn()
    const r = await executeCode('print(1 + 2)', 'py')
    ranOn.stop()
    expect(pyodideRun).not.toHaveBeenCalled()
    expect(api.ranCode).toEqual(['print(1 + 2)'])
    expect(r.lines).toEqual([{ kind: 'stdout', text: '3' }])
    expect(ranOn.seen).toEqual(['your Python 3.13.14, on this computer'])
  })

  it('shows a traceback as an error', async () => {
    fakeDesktop({ script: () => [err('Traceback (most recent call last):\n  File "main.py", line 1\nZeroDivisionError: division by zero\n'), exit(1)] })
    const r = await executeCode('1/0', 'python')
    expect(r.lines).toEqual([{ kind: 'error', text: 'Traceback (most recent call last):\n  File "main.py", line 1\nZeroDivisionError: division by zero' }])
  })
})

describe('challenge tests through the desktop path', () => {
  it('passes and fails assertions from the program the learner wrote', async () => {
    // Echo back what a real .NET run of the harness would print for a learner
    // whose GradeLetter returns "A" for 95 but "A" (wrongly) for 80 too.
    fakeDesktop({
      script: (code) => {
        expect(code).toContain('static string GradeLetter')
        return [
          out('__OC_TEST__PASS|assert GradeLetter(95) == "A"\r\n'),
          out('__OC_TEST__FAIL|assert GradeLetter(80) == "B"\r\n'),
          exit(0),
        ]
      },
    })
    const results = await runTests(
      'static string GradeLetter(int score) { return "A"; }',
      'assert GradeLetter(95) == "A"\nassert GradeLetter(80) == "B"',
      'csharp',
      executeCode,
    )
    expect(results.map(r => r.passed)).toEqual([true, false])
  })

  it('shows a compile error instead of zero results', async () => {
    fakeDesktop({ script: () => [err("Program.cs(6,16): error CS0029: Cannot implicitly convert type 'int' to 'string'\n"), exit(1)] })
    const results = await runTests('static string GradeLetter(int s) { return 5; }', 'assert GradeLetter(95) == "A"', 'csharp', executeCode)
    expect(results).toEqual([{ label: "Program.cs(6,16): error CS0029: Cannot implicitly convert type 'int' to 'string'", passed: false, detail: 'Runtime error' }])
  })
})
