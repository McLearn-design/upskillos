// project-checks.cjs
// Runs a lesson step's checks against the learner's real project folder (Project Studio).
//
// Every check is read-only. It may look at files, run a command the lesson names, or ask Git
// about the repository, but it never changes the project: the learner makes every change,
// including every commit. Checks are parsed from the lesson's ```check fences by
// src/labs/project-studio/checks.js; this file only executes them.
//
// No Electron imports here, so the module runs under plain Node in tests. The one check that
// needs a browser (`page`) gets its evaluator injected by main.cjs.
const { promises: fs } = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')

function resolveInRoot(root, rel) {
  const abs = path.resolve(root, rel || '.')
  if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error(`Path escapes the project folder: ${rel}`)
  return abs
}

async function stat(p) {
  try { return await fs.stat(p) } catch { return null }
}

// Killing the shell isn't enough: on Windows the program it started (node, npm, ...) keeps
// running on its own, and keeps the project folder locked. Kill the whole process tree.
// Resolves once the processes are gone, so the caller can safely delete or reuse the folder.
function killTree(child) {
  return new Promise((resolve) => {
    if (child.exitCode != null) return resolve()
    if (process.platform === 'win32' && child.pid) {
      try {
        const k = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
        k.on('close', () => resolve())
        k.on('error', () => resolve())
      } catch { resolve() }
    } else {
      try { child.kill('SIGKILL') } catch {}
      resolve()
    }
  })
}

// Run a process to completion and capture its output. Never through a shell unless asked:
// Git and the like get argument arrays, so a path with spaces needs no quoting.
function capture(command, args, { cwd, env, timeoutMs = 60000, input } = {}) {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let done = false
    let child
    try {
      child = spawn(command, args, { cwd, env, windowsHide: true })
    } catch (e) {
      resolve({ code: null, stdout, stderr: String(e?.message ?? e), timedOut: false })
      return
    }
    const timer = setTimeout(() => {
      if (done) return
      killTree(child)
      done = true
      resolve({ code: null, stdout, stderr, timedOut: true })
    }, timeoutMs)
    child.stdout.on('data', (c) => { stdout += c.toString() })
    child.stderr.on('data', (c) => { stderr += c.toString() })
    child.on('error', (e) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve({ code: null, stdout, stderr: stderr + String(e?.message ?? e), timedOut: false })
    })
    child.on('close', (code) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve({ code, stdout, stderr, timedOut: false })
    })
    if (input != null) child.stdin.end(input)
    else child.stdin.end()
  })
}

// A command written in the lesson, run the way the learner's terminal would run it.
function shellRun(cmd, opts) {
  if (process.platform === 'win32') {
    // `powershell -Command "node f.js"` exits with 1, not 3, when the program exits with 3
    // (measured on Windows PowerShell 5.1): -Command reports only whether the last command
    // failed. Pass the program's own exit code through, and 1 for a failed cmdlet.
    const wrapped = `$global:LASTEXITCODE = 0\n${cmd}\nif (-not $?) { if ($LASTEXITCODE) { exit $LASTEXITCODE } else { exit 1 } }\nexit $LASTEXITCODE`
    return capture('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', wrapped], opts)
  }
  return capture(process.env.SHELL || '/bin/zsh', ['-l', '-c', cmd], opts)
}

// GIT_CEILING_DIRECTORIES stops Git from walking up past the project folder. Without it, a
// project folder that isn't a repository yet, inside one that is (a learner who ran
// `git init` in their home folder by mistake), would answer every question about the wrong
// repository.
function git(root, args, env, { ceiling = true } = {}) {
  const e = ceiling ? { ...env, GIT_CEILING_DIRECTORIES: path.dirname(root) } : env
  return capture('git', ['-C', root, ...args], { env: e, timeoutMs: 20000 })
}

function short(text, n = 600) {
  const t = String(text ?? '').trim()
  return t.length > n ? t.slice(0, n) + ' …' : t
}

const normalize = (s) => String(s ?? '').replace(/\r\n/g, '\n')

// ── the checks ───────────────────────────────────────────────────────────────
// Each returns { pass, detail? }. `detail` is what the learner sees when it fails: the real
// output or state that was found, so they can work out what's wrong.
const CHECKS = {
  async file(ctx, [rel]) {
    const s = await stat(resolveInRoot(ctx.root, rel))
    if (s?.isFile()) return { pass: true }
    return { pass: false, detail: s ? `${rel} is a folder, not a file.` : `There is no ${rel} in the project folder.` }
  },

  async dir(ctx, [rel]) {
    const s = await stat(resolveInRoot(ctx.root, rel))
    if (s?.isDirectory()) return { pass: true }
    return { pass: false, detail: s ? `${rel} is a file, not a folder.` : `There is no folder ${rel} in the project folder.` }
  },

  async missing(ctx, [rel]) {
    const s = await stat(resolveInRoot(ctx.root, rel))
    return s ? { pass: false, detail: `${rel} still exists.` } : { pass: true }
  },

  async contains(ctx, [rel, text]) {
    const abs = resolveInRoot(ctx.root, rel)
    let content
    try { content = normalize(await fs.readFile(abs, 'utf8')) } catch { return { pass: false, detail: `There is no ${rel} in the project folder.` } }
    return content.includes(normalize(text)) ? { pass: true } : { pass: false, detail: `${rel} doesn't contain ${JSON.stringify(text)}.` }
  },

  async lacks(ctx, [rel, text]) {
    const abs = resolveInRoot(ctx.root, rel)
    let content
    try { content = normalize(await fs.readFile(abs, 'utf8')) } catch { return { pass: true } }
    return content.includes(normalize(text)) ? { pass: false, detail: `${rel} still contains ${JSON.stringify(text)}.` } : { pass: true }
  },

  async matches(ctx, [rel, pattern]) {
    const abs = resolveInRoot(ctx.root, rel)
    let content
    try { content = normalize(await fs.readFile(abs, 'utf8')) } catch { return { pass: false, detail: `There is no ${rel} in the project folder.` } }
    return new RegExp(pattern, 'm').test(content) ? { pass: true } : { pass: false, detail: `${rel} doesn't match the expected pattern.` }
  },

  // run "<command>" [exit=N] [stdout="text"] [stderr="text"] [timeout=seconds]
  async run(ctx, [cmd], opts) {
    const r = await shellRun(cmd, { cwd: ctx.root, env: ctx.env, timeoutMs: (Number(opts.timeout) || 60) * 1000 })
    if (r.timedOut) return { pass: false, detail: `\`${cmd}\` was still running after ${Number(opts.timeout) || 60} seconds, so it was stopped.` }
    const out = normalize(r.stdout)
    const err = normalize(r.stderr)
    const wantExit = opts.exit != null ? Number(opts.exit) : 0
    const problems = []
    if (r.code !== wantExit) problems.push(`it exited with code ${r.code} (expected ${wantExit})`)
    if (opts.stdout != null && !out.includes(normalize(opts.stdout))) problems.push(`its output doesn't include ${JSON.stringify(opts.stdout)}`)
    if (opts.stderr != null && !(err + out).includes(normalize(opts.stderr))) problems.push(`its error output doesn't include ${JSON.stringify(opts.stderr)}`)
    if (problems.length === 0) return { pass: true }
    const shown = [out && `Output:\n${short(out)}`, err && `Errors:\n${short(err)}`].filter(Boolean).join('\n\n')
    return { pass: false, detail: `When the check ran \`${cmd}\`, ${problems.join(', and ')}.${shown ? '\n\n' + shown : ''}` }
  },

  async 'git-repo'(ctx) {
    const r = await git(ctx.root, ['rev-parse', '--show-toplevel'], ctx.env, { ceiling: false })
    if (r.code !== 0) return { pass: false, detail: 'The project folder is not a Git repository yet.' }
    const top = path.resolve(r.stdout.trim())
    if (top.toLowerCase() !== path.resolve(ctx.root).toLowerCase()) {
      return { pass: false, detail: `The project folder is inside another repository (${top}), instead of being a repository of its own.` }
    }
    return { pass: true }
  },

  async 'git-commits'(ctx, [min]) {
    const r = await git(ctx.root, ['rev-list', '--count', 'HEAD'], ctx.env)
    const n = r.code === 0 ? Number(r.stdout.trim()) : 0
    const want = Number(min ?? 1)
    return n >= want ? { pass: true } : { pass: false, detail: `The repository has ${n} commit${n === 1 ? '' : 's'}; this step expects at least ${want}.` }
  },

  async 'git-clean'(ctx) {
    const r = await git(ctx.root, ['status', '--porcelain'], ctx.env)
    if (r.code !== 0) return { pass: false, detail: short(r.stderr) || 'Git status failed.' }
    return r.stdout.trim() === '' ? { pass: true } : { pass: false, detail: `There are changes that aren't committed yet:\n${short(r.stdout)}` }
  },

  // "Committed" means in the last commit (HEAD), not merely staged: `git ls-files` would also
  // count a file that was added but never committed.
  async 'git-tracked'(ctx, [rel]) {
    const r = await git(ctx.root, ['cat-file', '-e', `HEAD:${rel.replace(/\\/g, '/')}`], ctx.env)
    if (r.code === 0) return { pass: true }
    const staged = await git(ctx.root, ['ls-files', '--error-unmatch', '--', rel], ctx.env)
    return { pass: false, detail: staged.code === 0 ? `${rel} is staged, but not committed yet.` : `${rel} isn't in any commit yet.` }
  },

  async 'git-untracked'(ctx, [rel]) {
    const r = await git(ctx.root, ['cat-file', '-e', `HEAD:${rel.replace(/\\/g, '/')}`], ctx.env)
    return r.code !== 0 ? { pass: true } : { pass: false, detail: `${rel} is in the last commit, but it shouldn't be.` }
  },

  async 'git-ignored'(ctx, [rel]) {
    const r = await git(ctx.root, ['check-ignore', '-q', '--', rel], ctx.env)
    return r.code === 0 ? { pass: true } : { pass: false, detail: `Git doesn't ignore ${rel}.` }
  },

  async 'git-branch'(ctx, [name]) {
    const r = await git(ctx.root, ['branch', '--show-current'], ctx.env)
    const cur = r.stdout.trim()
    return cur === name ? { pass: true } : { pass: false, detail: cur ? `You're on the branch ${cur}, not ${name}.` : 'No branch is checked out.' }
  },

  async 'git-has-branch'(ctx, [name]) {
    const r = await git(ctx.root, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`], ctx.env)
    return r.code === 0 ? { pass: true } : { pass: false, detail: `There is no branch called ${name}.` }
  },

  async 'git-no-branch'(ctx, [name]) {
    const r = await git(ctx.root, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`], ctx.env)
    return r.code !== 0 ? { pass: true } : { pass: false, detail: `The branch ${name} still exists.` }
  },

  async 'git-merged'(ctx, [branch, into]) {
    const r = await git(ctx.root, ['merge-base', '--is-ancestor', branch, into || 'HEAD'], ctx.env)
    return r.code === 0 ? { pass: true } : { pass: false, detail: `${branch} hasn't been merged into ${into || 'the current branch'}.` }
  },

  async 'git-remote'(ctx, [name]) {
    const r = await git(ctx.root, ['remote', 'get-url', name || 'origin'], ctx.env)
    return r.code === 0 ? { pass: true } : { pass: false, detail: `There is no remote called ${name || 'origin'}.` }
  },

  // The current branch's commits are all on its upstream: everything is pushed.
  async 'git-pushed'(ctx) {
    const up = await git(ctx.root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], ctx.env)
    if (up.code !== 0) return { pass: false, detail: "This branch isn't connected to a branch on a remote yet (it has no upstream)." }
    const ahead = await git(ctx.root, ['rev-list', '--count', '@{u}..HEAD'], ctx.env)
    const n = Number(ahead.stdout.trim())
    return n === 0 ? { pass: true } : { pass: false, detail: `${n} commit${n === 1 ? " hasn't" : "s haven't"} been pushed to ${up.stdout.trim()} yet.` }
  },

  async 'git-config'(ctx, [key]) {
    const r = await git(ctx.root, ['config', '--get', key], ctx.env)
    return r.code === 0 && r.stdout.trim() ? { pass: true } : { pass: false, detail: `Git has no value for ${key}.` }
  },

  // A commit message somewhere in the current branch's history contains the text.
  async 'git-message'(ctx, [text]) {
    const r = await git(ctx.root, ['log', '--format=%B'], ctx.env)
    return normalize(r.stdout).toLowerCase().includes(normalize(text).toLowerCase())
      ? { pass: true }
      : { pass: false, detail: `No commit message in this branch's history mentions ${JSON.stringify(text)}.` }
  },

  async 'git-tag'(ctx, [name]) {
    const r = await git(ctx.root, ['rev-parse', '--verify', '--quiet', `refs/tags/${name}`], ctx.env)
    return r.code === 0 ? { pass: true } : { pass: false, detail: `There is no tag called ${name}.` }
  },

  // page <file.html> "<expression>" <expected JSON> [server=static|vite]
  // Opens the learner's page in a hidden browser window, waits for it to load, evaluates the
  // expression, and compares the result as JSON. Without `server` the page is opened as a file
  // (file://), the way sprints 2 and 3 open it. server=static serves the folder over HTTP (ES
  // modules refuse to load from file://); server=vite runs the project's own Vite dev server.
  async page(ctx, [rel, expr, expected], opts) {
    if (!ctx.evalInPage) return { pass: false, detail: 'Page checks only run in the desktop app.' }
    const abs = resolveInRoot(ctx.root, rel)
    if (!(await stat(abs))?.isFile()) return { pass: false, detail: `There is no ${rel} in the project folder.` }
    let target = abs
    if (opts.server) {
      const base = await ctx.server(opts.server)
      if (!base.ok) return { pass: false, detail: base.reason }
      target = base.url + rel.replace(/\\/g, '/').replace(/^index\.html$/, '')
    }
    const r = await ctx.evalInPage(target, expr, { timeoutMs: (Number(opts.timeout) || 15) * 1000 })
    const errors = r.errors?.length ? `\n\nThe page reported:\n${short(r.errors.join('\n'))}` : ''
    if (!r.ok) return { pass: false, detail: `${r.reason}${errors}` }
    // errors=none: the page must load without any error in its console.
    if (opts.errors === 'none' && r.errors?.length) {
      return { pass: false, detail: `The page has an error in its console (open DevTools with F12 to see it).${errors}` }
    }
    // console="text": something the page logged with console.log must contain the text.
    if (opts.console != null && !(r.logs || []).some((l) => String(l).includes(opts.console))) {
      const seen = r.logs?.length ? `\n\nThe page logged:\n${short(r.logs.join('\n'))}` : '\n\nThe page logged nothing.'
      return { pass: false, detail: `The page's console never showed ${JSON.stringify(opts.console)}.${seen}${errors}` }
    }
    // The expected value is JSON (4, true, "text") or, for convenience, bare text. Text that
    // also parses as JSON (3.50) still matches the page's string "3.50".
    let want
    try { want = JSON.parse(expected) } catch { want = expected }
    const same = JSON.stringify(r.value) === JSON.stringify(want) || (typeof r.value === 'string' && r.value === expected)
    return same ? { pass: true } : { pass: false, detail: `\`${expr}\` gave ${JSON.stringify(r.value)}, expected ${JSON.stringify(want)}.${errors}` }
  },
}

const PLATFORM_NAMES = { win32: 'windows', darwin: 'mac', linux: 'linux' }

// ── servers for page checks ──────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8',
}

// A plain file server over the project folder, on a free port on this computer only.
function startStaticServer(root) {
  const http = require('node:http')
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '')
        if (rel === '' || rel.endsWith('/')) rel += 'index.html'
        const abs = resolveInRoot(root, rel)
        const data = await fs.readFile(abs)
        res.writeHead(200, { 'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream' })
        res.end(data)
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not found')
      }
    })
    server.listen(0, '127.0.0.1', () => {
      resolve({ ok: true, url: `http://127.0.0.1:${server.address().port}/`, stop: () => new Promise((done) => { server.close(() => done()); server.closeAllConnections() }) })
    })
    server.on('error', (e) => resolve({ ok: false, reason: `The check's web server couldn't start: ${e.message}` }))
  })
}

async function freePort() {
  const net = require('node:net')
  return new Promise((resolve) => {
    const s = net.createServer()
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)) })
  })
}

// The project's own Vite dev server, started for the check on a free port and stopped after.
async function startViteServer(root, env) {
  const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!(await stat(viteBin))) {
    return { ok: false, reason: "Vite isn't installed in this project (there's no node_modules/vite). Run npm install." }
  }
  const port = await freePort()
  const child = spawn(process.platform === 'win32' ? 'node.exe' : 'node', [viteBin, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    cwd: root, env: { ...env, BROWSER: 'none', CI: '1' }, windowsHide: true,
  })
  let output = ''
  child.stdout.on('data', (c) => { output += c.toString() })
  child.stderr.on('data', (c) => { output += c.toString() })
  const url = `http://127.0.0.1:${port}/`
  const deadline = Date.now() + 60000
  while (Date.now() < deadline) {
    if (child.exitCode != null) break
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(1000) })
      if (r.status < 500) return { ok: true, url, stop: () => killTree(child) }
    } catch {}
    await new Promise((r) => setTimeout(r, 300))
  }
  await killTree(child)
  return { ok: false, reason: `Vite didn't start.${output.trim() ? `\n\n${short(output)}` : ''}` }
}

async function runChecks(root, checks, { env, evalInPage } = {}) {
  if (!root) return { ok: false, reason: 'No project folder is open' }
  const servers = {}
  const ctx = {
    root: path.resolve(root),
    env: env || process.env,
    evalInPage,
    // One server of each kind per run of checks, shared by its page checks.
    server(kind) {
      if (!servers[kind]) {
        servers[kind] = kind === 'vite' ? startViteServer(ctx.root, ctx.env)
          : kind === 'static' ? startStaticServer(ctx.root)
            : Promise.resolve({ ok: false, reason: `Unknown server "${kind}" (a mistake in the lesson).` })
      }
      return servers[kind]
    },
  }
  try {
    return await runAll(ctx, checks)
  } finally {
    for (const p of Object.values(servers)) {
      try { await (await p).stop?.() } catch {}
    }
  }
}

async function runAll(ctx, checks) {
  const results = []
  for (const check of checks || []) {
    const fn = CHECKS[check.kind]
    if (!fn) {
      results.push({ pass: false, detail: `Unknown check "${check.kind}" (a mistake in the lesson, not your work).` })
      continue
    }
    // os=windows|mac|linux: a check written for one shell's syntax (PowerShell vs zsh) is
    // skipped elsewhere, and counts as passed.
    const os = check.opts?.os
    if (os && os !== PLATFORM_NAMES[process.platform]) {
      results.push({ pass: true, skipped: true, detail: `Only checked on ${os}.` })
      continue
    }
    try {
      results.push(await fn(ctx, check.args || [], check.opts || {}))
    } catch (e) {
      results.push({ pass: false, detail: String(e?.message ?? e) })
    }
  }
  return { ok: true, results }
}

module.exports = { runChecks, CHECK_KINDS: Object.keys(CHECKS), shellRun }
