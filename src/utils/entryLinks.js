// Deep links into labs and games. A route like #/lab/mesh-lab?project=walk-cycle opens
// the lab as a desktop window and then navigates back to the listing (EntryShell), so
// the query would be lost. EntryShell hands it over here instead: a lab that is just
// opening takes it when it mounts; one that is already open hears the event.

const pending = new Map()

/** Called by EntryShell: remember the query for this entry and tell any open window. */
export function setEntryLink(key, search) {
  pending.set(key, search)
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('entry-link', { detail: { key, search } }))
}

/** Called by a lab: the query it was opened with (once), or null. */
export function takeEntryLink(key) {
  const s = pending.get(key)
  pending.delete(key)
  return s ?? null
}
