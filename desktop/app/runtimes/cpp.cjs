// runtimes/cpp.cjs
// Real, local C/C++ compilation — this is what lets the Electron build stop
// depending on Wandbox (a third-party remote compile API) the way
// CppNotebook.jsx does on the web build, which has no local toolchain to
// fall back to at all.
//
// Uses llvm-mingw (https://github.com/mstorsjo/llvm-mingw), a self-contained
// Clang + MinGW-w64 distribution built specifically for portability. This
// was NOT the first choice tried — WinLibs' standalone GCC (the more
// commonly recommended "portable GCC for Windows" distribution) was tested
// first and failed: across three different GCC versions, compiling any
// program that includes <iostream> hit a real, reproducible bug where the
// compiler's own libstdc++ header search couldn't resolve
// `bits/requires_hosted.h` even though the file demonstrably exists right
// next to the header that includes it, and neither explicit -B/-L/-I nor
// --sysroot overrides fixed it. Root cause traced partway to interference
// from a pre-existing, unrelated legacy MinGW install and MSYS2 environment
// variables already present on the machine used to build this — but since
// that kind of leftover toolchain is a realistic thing to find on other
// Windows machines too (Git for Windows, Strawberry Perl, and various IDEs
// all install their own MinGW), WinLibs' GCC was dropped as unreliable
// rather than shipped with an unresolved intermittent failure mode.
// llvm-mingw compiled and ran real C++ correctly on the first try.
//
// One llvm-mingw quirk that DOES need a workaround: without `-static`, the
// compiled .exe fails to launch at all (Windows error 0xC0000135, DLL not
// found) because it dynamically links against libc++/libunwind DLLs that
// live in llvm-mingw's own bin/ directory, not next to the lesson's
// compiled executable. `-static` was confirmed live to produce a fully
// self-contained, working .exe with no DLL dependency to manage.
const { promises: fs } = require('node:fs')
const path = require('node:path')
const { spawn, execFile } = require('node:child_process')
const { promisify } = require('node:util')
const { pathExists, downloadFile, extractZip, findFile, errorDetail } = require('./_shared.cjs')
const { systemCpp } = require('./_toolchains.cjs')


// Pinned to a specific dated release for the same reason Python is pinned:
// predictable, tested internal layout. Bump deliberately.
const LLVM_MINGW_RELEASE = '20260826'
const LLVM_MINGW_ZIP_URL = `https://github.com/mstorsjo/llvm-mingw/releases/download/${LLVM_MINGW_RELEASE}/llvm-mingw-${LLVM_MINGW_RELEASE}-ucrt-x86_64.zip`

function runtimeDir(app) {
  return path.join(app.getPath('userData'), 'runtimes', 'cpp')
}

function scratchDir(app) {
  return path.join(runtimeDir(app), 'scratch')
}

async function gppPath(app) {
  return findFile(runtimeDir(app), 'x86_64-w64-mingw32-g++.exe')
}

// The learner's own compiler wins when it passes the probe (see
// _toolchains.cjs); the app-managed llvm-mingw is the fallback.
async function resolveCompiler(app) {
  const system = await systemCpp()
  if (system?.found) return { source: 'system', exe: system.found.exe, version: system.found.version }
  const gpp = await gppPath(app)
  if (gpp) return { source: 'app', exe: gpp, version: `llvm-mingw ${LLVM_MINGW_RELEASE}` }
  return null
}

// The folder holding the app-managed toolchain's g++, lldb, mingw32-make and libc++.dll, or
// null when it isn't installed. Terminals and step checks append it to PATH (terminal.cjs), so
// `g++ hello.cpp` typed in the terminal finds the same compiler the Run button uses, and the
// programs it builds find libc++.dll when they start.
async function toolchainBinDir(app) {
  const gpp = await gppPath(app)
  return gpp ? path.dirname(gpp) : null
}

async function getStatus(app) {
  const compiler = await resolveCompiler(app)
  const system = await systemCpp()
  return {
    installed: !!compiler,
    source: compiler?.source ?? null,
    version: compiler?.version ?? null,
    path: compiler?.exe ?? null,
    rejected: system?.rejected ?? [],
  }
}

async function install(app, onProgress) {
  const emit = (payload) => onProgress?.(payload)
  const dir = runtimeDir(app)

  try {
    await fs.rm(dir, { recursive: true, force: true })
    await fs.mkdir(dir, { recursive: true })
    await fs.mkdir(scratchDir(app), { recursive: true })

    emit({ phase: 'downloading-cpp', percent: 0 })
    const zipPath = path.join(dir, 'llvm-mingw.zip')
    await downloadFile(LLVM_MINGW_ZIP_URL, zipPath, (p) => emit({ phase: 'downloading-cpp', percent: Math.round(p * 0.85) }))

    emit({ phase: 'extracting-cpp', percent: 85 })
    await extractZip(zipPath, dir)
    await fs.rm(zipPath, { force: true })

    if (!(await gppPath(app))) throw new Error('Extraction succeeded but g++ was not found afterward')

    emit({ phase: 'done', percent: 100 })
    return { ok: true }
  } catch (e) {
    const detail = errorDetail(e)
    emit({ phase: 'error', error: detail })
    return { ok: false, reason: detail }
  }
}

const runningProcs = new Map()

async function runCode(app, code, onOutput) {
  try {
    const compiler = await resolveCompiler(app)
    if (!compiler) return { ok: false, reason: 'No C++ compiler found and the app toolchain is not installed' }
    const gpp = compiler.exe

    await fs.mkdir(scratchDir(app), { recursive: true })
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const srcPath = path.join(scratchDir(app), `${runId}.cpp`)
    const exePath = path.join(scratchDir(app), `${runId}.exe`)
    await fs.writeFile(srcPath, code, 'utf8')

    const cleanup = () => {
      fs.rm(srcPath, { force: true }).catch(() => {})
      fs.rm(exePath, { force: true }).catch(() => {})
    }
    // Diagnostics name the scratch file by its full temp path; the learner
    // only ever sees one file, so call it main.cpp.
    const tidy = (text) => text.split(srcPath).join('main.cpp')

    // Compiled in the background so the caller has runId before any output
    // event arrives. Callers match events by runId; when a compile error was
    // sent before runCode returned, CppNotebook dropped it, along with the
    // exit event, and the cell stayed "running".
    const compile = execFile(gpp, ['-std=c++17', '-O2', '-static', srcPath, '-o', exePath], {
      windowsHide: true, timeout: 30000, maxBuffer: 10 * 1024 * 1024,
    }, (compileErr, _stdout, compileStderr) => {
      if (runningProcs.get(runId) !== compile) { // stopped during the compile (killRun)
        onOutput?.({ runId, stream: 'exit', code: null })
        cleanup()
        return
      }
      runningProcs.delete(runId)
      if (compileErr) {
        onOutput?.({ runId, stream: 'stderr', text: tidy(compileStderr || compileErr.message) })
        onOutput?.({ runId, stream: 'exit', code: 1 })
        cleanup()
        return
      }
      if (compileStderr) onOutput?.({ runId, stream: 'stderr', text: tidy(compileStderr) })

      const child = spawn(exePath, [], {
        cwd: scratchDir(app),
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      runningProcs.set(runId, child)

      child.stdout.on('data', (chunk) => onOutput?.({ runId, stream: 'stdout', text: chunk.toString() }))
      child.stderr.on('data', (chunk) => onOutput?.({ runId, stream: 'stderr', text: chunk.toString() }))
      child.on('close', (exitCode) => {
        runningProcs.delete(runId)
        onOutput?.({ runId, stream: 'exit', code: exitCode })
        cleanup()
      })
      child.on('error', (err) => {
        runningProcs.delete(runId)
        onOutput?.({ runId, stream: 'stderr', text: `Failed to launch program: ${err.message}` })
        onOutput?.({ runId, stream: 'exit', code: 1 })
        cleanup()
      })
    })
    runningProcs.set(runId, compile)

    return { ok: true, runId }
  } catch (e) {
    return { ok: false, reason: String(e?.message ?? e) }
  }
}

function killRun(runId) {
  const child = runningProcs.get(runId)
  if (!child) return false
  try { child.kill() } catch {}
  return true
}

function killAllScripts() {
  for (const child of runningProcs.values()) {
    try { child.kill() } catch {}
  }
  runningProcs.clear()
}

// Project Studio keeps source files in the learner's folder. Compile the entry
// translation unit there (quoted includes find sibling headers), then let the
// existing project runner own the game process and its output lifecycle.
async function projectCommand(app, absFile, projectRoot = path.dirname(absFile)) {
  if (!/\.(cpp|cc|cxx)$/i.test(absFile)) throw new Error('Choose a C++ source file (.cpp, .cc or .cxx) to run')
  const compiler = await resolveCompiler(app)
  if (!compiler) return null
  const buildDir = path.join(projectRoot, 'build')
  await fs.mkdir(buildDir, { recursive: true })
  const exePath = path.join(buildDir, `${path.basename(absFile, path.extname(absFile))}.exe`)
  // An old executable must never look like a successful build of edited source.
  await fs.rm(exePath, { force: true })
  try {
    await promisify(execFile)(compiler.exe, [
      '-std=c++17', '-O2', '-static', absFile, '-o', exePath,
      ...(process.platform === 'win32' ? ['-luser32', '-lgdi32'] : []),
    ], { cwd: projectRoot, windowsHide: true, timeout: 30000, maxBuffer: 10 * 1024 * 1024 })
  } catch (error) {
    await fs.rm(exePath, { force: true }).catch(() => {})
    throw new Error(`C++ build failed:\n${String(error.stderr || error.message).split(absFile).join(path.relative(projectRoot, absFile))}`)
  }
  // STARTUPINFO's hidden-window flag can suppress the first ShowWindow call
  // of a native GUI too, not just a console. The game must be visible.
  return { command: exePath, args: [], windowsHide: false }
}

module.exports = { getStatus, install, runCode, killRun, killAllScripts, projectCommand, toolchainBinDir }
