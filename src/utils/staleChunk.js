// After a deploy, the old build's code files are gone from the server. A page
// opened before the deploy still runs the old code, so the next screen it
// lazy-loads asks for a file that no longer exists and fails with
// "Failed to fetch dynamically imported module". Reloading fetches the new
// build at the same URL. A short guard stops a reload loop if the file is
// missing for some other reason.

const KEY = 'oc-stale-chunk-reload'
const GUARD_MS = 30_000

const PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
]

export function isStaleChunkError(error) {
  const message = String(error?.message ?? error ?? '')
  return PATTERNS.some((re) => re.test(message))
}

// Reloads the page unless it already did so in the last 30 seconds. Returns
// true when a reload was started.
export function reloadForNewVersion() {
  let last = 0
  try { last = Number(sessionStorage.getItem(KEY)) || 0 } catch { /* storage blocked */ }
  if (Date.now() - last < GUARD_MS) return false
  try { sessionStorage.setItem(KEY, String(Date.now())) } catch { /* storage blocked */ }
  window.location.reload()
  return true
}
