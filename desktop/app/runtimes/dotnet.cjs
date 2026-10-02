// runtimes/dotnet.cjs
// Real, local C# execution via the official .NET SDK. Uses Microsoft's
// stable "latest 8.0.x SDK" redirect (https://aka.ms/dotnet/8.0/dotnet-sdk-win-x64.zip)
// rather than a hand-pinned patch version — confirmed live this resolves
// to a real, current zip.
//
// .NET 8 does NOT support "file-based apps" (`dotnet run app.cs` with no
// project file) — that's a newer SDK feature. Confirmed live: it just
// fails with "Couldn't find a project to run." So instead, each run
// scaffolds a scratch copy of the minimal console-app template checked in
// at runtimes/templates/dotnet/app.csproj, drops the lesson's code in as
// Program.cs, then builds it and runs the built app (see runCode for why
// build and run are separate steps). A system-installed SDK is used first
// when there is one; see resolveSdk.
//
// One real caveat, also confirmed live: the .NET SDK's own internal
// directory structure is deep enough that under a sufficiently long
// userData path, MSBuild can fail with a confusing "SDK Resolver folder
// exists but without an SDK Resolver DLL" error that is actually just
// Windows' 260-char MAX_PATH being hit, not a broken SDK — this held true
// under a test path but the exact same install worked fine once moved to
// a short one. userData is normally short enough for this not to matter,
// but it's a known sharp edge if it ever resurfaces.
const { promises: fs } = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { downloadFile, extractZip, errorDetail } = require('./_shared.cjs')
const { systemDotnet } = require('./_toolchains.cjs')

const DOTNET_SDK_URL = 'https://aka.ms/dotnet/8.0/dotnet-sdk-win-x64.zip'
const TEMPLATE_CSPROJ = path.join(__dirname, 'templates', 'dotnet', 'app.csproj')

function runtimeDir(app) {
  return path.join(app.getPath('userData'), 'runtimes', 'dotnet')
}

function scratchDir(app) {
  return path.join(runtimeDir(app), 'scratch')
}

function dotnetExePath(app) {
  return path.join(runtimeDir(app), 'dotnet.exe')
}

async function pathExists(p) {
  try { await fs.access(p); return true } catch { return false }
}

// The learner's own SDK (newest one >= 8) wins; the app-managed .NET 8 SDK
// is the fallback. Each SDK builds for its own framework version (net10.0
// for SDK 10), because an SDK always ships that version's runtime, while
// an older target like net8.0 needs a separately installed .NET 8 runtime.
async function resolveSdk(app) {
  const system = await systemDotnet()
  if (system) return { source: 'system', exe: system.exe, version: system.version, framework: `net${system.major}.0`, env: {} }
  const managed = dotnetExePath(app)
  if (await pathExists(managed)) {
    return { source: 'app', exe: managed, version: '8.0 (app-managed)', framework: 'net8.0', env: { DOTNET_ROOT: runtimeDir(app) } }
  }
  return null
}

async function getStatus(app) {
  const sdk = await resolveSdk(app)
  return {
    installed: !!sdk,
    source: sdk?.source ?? null,
    version: sdk?.version ?? null,
    path: sdk?.exe ?? null,
  }
}

// MSBuild prints each diagnostic twice (once as it happens, once in the
// summary) with the full source path and a trailing "[...app.csproj]".
// Keep one copy of each, shortened to "Program.cs(11,16): error CS0029: ...".
function tidyDiagnostics(text) {
  const seen = new Set()
  const out = []
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(/([^\\/]+\.(?:cs|xaml))\((\d+),(\d+)\): (error|warning) (\w+): (.*?)(?:\s+\[[^\]]*\])?$/)
    if (!m) continue
    const line = `${m[1]}(${m[2]},${m[3]}): ${m[4]} ${m[5]}: ${m[6]}`
    if (seen.has(line)) continue
    seen.add(line)
    out.push({ level: m[4], line })
  }
  return out
}

async function install(app, onProgress) {
  const emit = (payload) => onProgress?.(payload)
  const dir = runtimeDir(app)

  try {
    await fs.rm(dir, { recursive: true, force: true })
    await fs.mkdir(dir, { recursive: true })
    await fs.mkdir(scratchDir(app), { recursive: true })

    emit({ phase: 'downloading-dotnet', percent: 0 })
    const zipPath = path.join(dir, 'dotnet-sdk.zip')
    await downloadFile(DOTNET_SDK_URL, zipPath, (p) => emit({ phase: 'downloading-dotnet', percent: Math.round(p * 0.9) }))

    emit({ phase: 'extracting-dotnet', percent: 90 })
    // .NET SDK zips extract flat (dotnet.exe at the root) — no nested
    // wrapper folder to flatten, unlike Temurin's JDK zip.
    await extractZip(zipPath, dir)
    await fs.rm(zipPath, { force: true })

    if (!(await pathExists(dotnetExePath(app)))) throw new Error('Extraction succeeded but dotnet.exe was not found afterward')

    emit({ phase: 'done', percent: 100 })
    return { ok: true }
  } catch (e) {
    const detail = errorDetail(e)
    emit({ phase: 'error', error: detail })
    return { ok: false, reason: detail }
  }
}

const runningProcs = new Map()

// One launched app window at a time: launching again closes the previous one.
let launchedRunId = null

function newRunId() {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Build and run are separate steps on purpose: `dotnet run` prints compiler
// warnings to stdout, mixed into the program's own output, which breaks
// lessons that grade what the program prints. Building first keeps the
// diagnostics apart (sent as stderr) and the program's stdout clean.
//
// Spawned rather than awaited so the caller gets runId straight away and
// every output event arrives after it. Events: stdout/stderr text, then
// 'launched' (launch mode only, once the app process has started), then
// 'exit' with the process exit code (null when stopped by killRun).
// inspect mode builds without running and sends 'file' events instead (see
// readGeneratedFiles).
function buildAndRun({ sdk, runId, runDir, assemblyName, launch, inspect = false, onOutput }) {
  const outDir = path.join(runDir, 'out')
  const env = { ...process.env, ...sdk.env, DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1' }
  const emit = (stream, text) => onOutput?.({ runId, stream, text })
  const cleanup = () => fs.rm(runDir, { recursive: true, force: true }).catch(() => {})

  const start = (args, { visible = false } = {}) => {
    const child = spawn(sdk.exe, args, { cwd: runDir, windowsHide: !visible, stdio: ['ignore', 'pipe', 'pipe'], env })
    runningProcs.set(runId, child)
    child.on('error', (err) => {
      runningProcs.delete(runId)
      emit('stderr', `Failed to launch dotnet: ${err.message}`)
      onOutput?.({ runId, stream: 'exit', code: 1 })
      cleanup()
    })
    return child
  }

  // EmitCompilerGeneratedFiles writes source generators' output to obj/generated,
  // so inspect mode can show it; it's a build switch, not part of the shown .csproj.
  const buildArgs = ['build', runDir, '-nologo', '-v', 'q', '-clp:NoSummary', '-nodeReuse:false', '-o', outDir]
  if (inspect) buildArgs.push('-p:EmitCompilerGeneratedFiles=true')
  const build = start(buildArgs)
  let buildLog = ''
  build.stdout.on('data', (chunk) => { buildLog += chunk.toString() })
  build.stderr.on('data', (chunk) => { buildLog += chunk.toString() })
  build.on('close', (buildCode) => {
    if (runningProcs.get(runId) !== build) { // stopped during the build (killRun)
      onOutput?.({ runId, stream: 'exit', code: null })
      cleanup()
      return
    }
    runningProcs.delete(runId)
    const diagnostics = tidyDiagnostics(buildLog)
    if (buildCode !== 0) {
      const errors = diagnostics.filter(d => d.level === 'error')
      emit('stderr', (errors.length ? errors.map(d => d.line) : [buildLog.trim() || `dotnet build exited with code ${buildCode}`]).join('\n') + '\n')
      onOutput?.({ runId, stream: 'exit', code: buildCode ?? 1 })
      cleanup()
      return
    }
    const warnings = diagnostics.filter(d => d.level === 'warning')
    if (warnings.length) emit('stderr', warnings.map(d => d.line).join('\n') + '\n')

    if (inspect) {
      readGeneratedFiles(runDir)
        .then(files => files.forEach(f => onOutput?.({ runId, stream: 'file', path: f.path, text: f.text })))
        .catch(e => emit('stderr', `Could not read the generated files: ${e.message}\n`))
        .finally(() => { onOutput?.({ runId, stream: 'exit', code: 0 }); cleanup() })
      return
    }

    if (launch) {
      if (launchedRunId) killRun(launchedRunId)
      launchedRunId = runId
    }
    const program = start([path.join(outDir, `${assemblyName}.dll`)], { visible: launch })
    if (launch) program.on('spawn', () => onOutput?.({ runId, stream: 'launched' }))
    program.stdout.on('data', (chunk) => emit('stdout', chunk.toString()))
    program.stderr.on('data', (chunk) => emit('stderr', chunk.toString()))
    program.on('close', (exitCode) => {
      runningProcs.delete(runId)
      if (launchedRunId === runId) launchedRunId = null
      onOutput?.({ runId, stream: 'exit', code: exitCode })
      cleanup()
    })
  })
}

async function runCode(app, code, onOutput) {
  try {
    const sdk = await resolveSdk(app)
    if (!sdk) return { ok: false, reason: 'No .NET SDK found and the app toolchain is not installed' }

    const runId = newRunId()
    const runDir = path.join(scratchDir(app), runId)
    await fs.mkdir(runDir, { recursive: true })
    const csproj = (await fs.readFile(TEMPLATE_CSPROJ, 'utf8')).replace(/<TargetFramework>[^<]*<\/TargetFramework>/, `<TargetFramework>${sdk.framework}</TargetFramework>`)
    await fs.writeFile(path.join(runDir, 'app.csproj'), csproj, 'utf8')
    await fs.writeFile(path.join(runDir, 'Program.cs'), code, 'utf8')

    buildAndRun({ sdk, runId, runDir, assemblyName: 'app', launch: false, onOutput })
    return { ok: true, runId }
  } catch (e) {
    return { ok: false, reason: String(e?.message ?? e) }
  }
}

// ── Multi-file projects (Lesson Engine project lessons) ──────────────────────
//
// The lesson sends every source file, including the entry point (a test
// program or a launcher), so this side only decides what kind of project
// it is. Templates are fixed here rather than taken from the lesson: a
// lesson cannot change build settings or add package references.
// What the build produced besides the program, for lessons that open up the
// machinery: the project file itself, the C# that XAML compiles into
// (MainWindow.g.cs), the implicit usings (GlobalUsings.g.cs), assembly
// attributes, and source generators' output (obj/generated). Paths are
// relative to the project folder, with forward slashes.
async function readGeneratedFiles(runDir) {
  const found = []
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) { await walk(full); continue }
      const rel = path.relative(runDir, full).split(path.sep).join('/')
      const generated = /\.g\.cs$/.test(entry.name) || /\.AssemblyInfo\.cs$/.test(entry.name) || (rel.includes('/generated/') && entry.name.endsWith('.cs'))
      if (generated) found.push(rel)
    }
  }
  await walk(path.join(runDir, 'obj'))
  found.sort()
  const files = [{ path: 'LessonApp.csproj', text: await fs.readFile(path.join(runDir, 'LessonApp.csproj'), 'utf8') }]
  for (const rel of found) {
    const text = await fs.readFile(path.join(runDir, ...rel.split('/')), 'utf8')
    files.push({ path: rel, text: text.length > 200000 ? text.slice(0, 200000) + '\n// (truncated)' : text })
  }
  return files
}

const PROJECT_TEMPLATES = {
  // WPF. The lesson's files supply their own Main, so WPF's generated
  // App.xaml entry point is turned off (EnableDefaultApplicationDefinition).
  wpf: ({ framework, outputType }) => `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>${outputType}</OutputType>
    <TargetFramework>${framework}-windows</TargetFramework>
    <UseWPF>true</UseWPF>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <EnableDefaultApplicationDefinition>false</EnableDefaultApplicationDefinition>
    <RootNamespace>LessonApp</RootNamespace>
    <AssemblyName>LessonApp</AssemblyName>
  </PropertyGroup>
</Project>
`,
  // A plain console program, for lessons about .NET itself before any WPF.
  console: ({ framework }) => `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>${framework}</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <RootNamespace>LessonApp</RootNamespace>
    <AssemblyName>LessonApp</AssemblyName>
  </PropertyGroup>
</Project>
`,
}

// Relative paths only, no "..", ordinary file-name characters only: the
// lesson's files are written to disk and must stay inside the run folder.
function safeRelativePath(p) {
  return typeof p === 'string'
    && /^[A-Za-z0-9_][A-Za-z0-9_. -]*(\/[A-Za-z0-9_][A-Za-z0-9_. -]*)*$/.test(p)
    && !p.split('/').some(part => part === '..' || part === '.')
}

// A lesson can supply its own LessonApp.csproj (to add NuGet packages, or copy
// appsettings.json to the output). Its TargetFramework is written for one .NET version, so
// it's set to the one this machine's SDK builds, as the template's is; a "-windows"
// suffix (WPF) is kept.
function retargetProjectFile(file, framework) {
  if (!/\.csproj$/i.test(file.path)) return file.content
  return file.content.replace(/<TargetFramework>net[\d.]+(-windows)?<\/TargetFramework>/, (_, windows) => `<TargetFramework>${framework}${windows ?? ''}</TargetFramework>`)
}

// spec: { template: 'wpf' | 'console', mode: 'test' | 'launch' | 'inspect', files: [{ path, content }] }
// 'test' and 'launch' build and run (only a wpf launch shows a window);
// 'inspect' builds only and sends the generated files (readGeneratedFiles).
async function runProject(app, spec, onOutput) {
  try {
    const template = PROJECT_TEMPLATES[spec?.template]
    if (!template) return { ok: false, reason: `Unknown project template: ${spec?.template}` }
    if (spec.template === 'wpf' && process.platform !== 'win32') return { ok: false, reason: 'WPF runs only on Windows' }
    const files = Array.isArray(spec.files) ? spec.files : []
    const bad = files.find(f => !safeRelativePath(f.path) || typeof f.content !== 'string')
    if (!files.length || bad) return { ok: false, reason: bad ? `Invalid project file path: ${bad.path}` : 'The project has no files' }

    const sdk = await resolveSdk(app)
    if (!sdk) return { ok: false, reason: 'No .NET SDK found and the app toolchain is not installed' }

    const launch = spec.mode === 'launch' && spec.template === 'wpf'
    const inspect = spec.mode === 'inspect'
    const runId = newRunId()
    const runDir = path.join(scratchDir(app), runId)
    await fs.mkdir(runDir, { recursive: true })
    await fs.writeFile(path.join(runDir, 'LessonApp.csproj'), template({ framework: sdk.framework, outputType: launch ? 'WinExe' : 'Exe' }), 'utf8')
    for (const file of files) {
      const target = path.join(runDir, ...file.path.split('/'))
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, retargetProjectFile(file, sdk.framework), 'utf8')
    }

    buildAndRun({ sdk, runId, runDir, assemblyName: 'LessonApp', launch, inspect, onOutput })
    return { ok: true, runId }
  } catch (e) {
    return { ok: false, reason: String(e?.message ?? e) }
  }
}

function killRun(runId) {
  const child = runningProcs.get(runId)
  if (!child) return false
  runningProcs.delete(runId)
  try { child.kill() } catch {}
  return true
}

function killAllScripts() {
  for (const child of runningProcs.values()) {
    try { child.kill() } catch {}
  }
  runningProcs.clear()
}

module.exports = { getStatus, install, runCode, runProject, killRun, killAllScripts }
