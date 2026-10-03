// page-eval.cjs
// Opens one of the learner's HTML files in a hidden browser window, evaluates an expression
// in it, and closes the window. Used by the `page` check in project-checks.cjs, so a lesson
// can check what a page actually does ("the grid has 26 columns", "columnName(26) is 'AA'")
// rather than what its source text looks like.
//
// The window gets its own in-memory session (nothing it stores survives), no Node access,
// and the sandbox, the same as any page the learner opens in a browser.
const { BrowserWindow } = require('electron')
const { pathToFileURL } = require('node:url')

function withTimeout(promise, ms, what) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${what} took longer than ${Math.round(ms / 1000)} seconds`)), ms) }),
  ]).finally(() => clearTimeout(timer))
}

let counter = 0

async function evalInPage(target, expr, { timeoutMs = 15000 } = {}) {
  const url = /^https?:\/\//.test(target) ? target : pathToFileURL(target).href
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: `project-check-${Date.now()}-${counter++}`,
    },
  })
  const errors = []
  const logs = []
  // Electron 35 passes the details on the event object; older versions passed them as
  // positional arguments. Accept both. An uncaught error in the page arrives here too, as an
  // error-level message.
  win.webContents.on('console-message', (e, level, message) => {
    const lvl = e?.level ?? level
    const msg = e?.message ?? message
    logs.push(msg)
    if (lvl === 'error' || lvl === 3) errors.push(msg)
  })
  try {
    try {
      await withTimeout(win.loadURL(url), timeoutMs, 'Loading the page')
    } catch (e) {
      return { ok: false, reason: `The page didn't load: ${e.message}`, errors, logs }
    }
    // Give module scripts and anything scheduled on load one turn to run.
    await new Promise((r) => setTimeout(r, 50))
    try {
      const value = await withTimeout(
        win.webContents.executeJavaScript(`(async () => (${expr}))()`, true),
        timeoutMs,
        'Evaluating the check',
      )
      return { ok: true, value: value === undefined ? null : value, errors, logs }
    } catch (e) {
      const msg = String(e?.message ?? e).replace(/^Error: /, '')
      return { ok: false, reason: `Checking \`${expr}\` on the page failed: ${msg}`, errors, logs }
    }
  } finally {
    win.destroy()
  }
}

module.exports = { evalInPage }
