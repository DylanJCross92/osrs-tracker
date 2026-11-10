// After a new deploy the old hashed files (/assets/Foo-abc123.js) no longer exist on the server. A tab that was opened
// before the deploy still points at them, so opening a page it had not loaded yet fails and the site looks broken until
// the person reloads. These helpers notice that case and reload once, which fetches the new index.html and its files.
const KEY = 'tickgains:stale-reload'
// Never reload twice within this window, so a genuinely broken file cannot cause a reload loop.
const COOLDOWN_MS = 30_000

export function isStaleChunkError(err) {
  const msg = String(err?.message || err || '')
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading (CSS )?chunk [\w-]+ failed/i.test(msg)
}

/** Reloads the page (optionally onto a given path). Returns false if it already did so a moment ago. */
export function reloadForNewVersion(path) {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0)
    if (Date.now() - last < COOLDOWN_MS) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    // Storage unavailable: still reload, the browser will not loop on its own.
  }
  if (path) window.location.assign(path)
  else window.location.reload()
  return true
}
