// Handing art between the labs on this page. Sprite Forge and Tile Mapper send sprites and maps to
// Game Studio; Game Studio asks them to make a new one or edit one of its own. Every lab is a window
// on the same page, so work is handed over directly (pictures as Blobs), with no files in between.
//
// A message waits in its lab's inbox until the lab takes it. A lab that is open hears the
// 'art-bridge' event and takes it then; one that is just opening takes what is waiting when it
// mounts. The sender then opens the lab (navigating to /lab/<id> opens its window, or brings it
// forward).
//
// The messages (docs/game-studio-course-plan.md, "Sprite Forge and Tile Mapper connected"):
//   to Game Studio   { type: 'sprite', name, doc, frames: [{ blob, width, height, duration }], tags, link? }
//                    { type: 'map', name, doc, map, tileset: { blob, name, imageWidth, imageHeight }, link? }
//   to Sprite Forge  { type: 'new-sprite', name, link }       { type: 'edit-sprite', name, blob, doc?, link }
//   to Tile Mapper   { type: 'new-map', name, link }          { type: 'edit-map', name, map, tileset, link }
// `link` says where in Game Studio the work goes back to ({ project, asset } or { project, scene, node });
// a lab keeps it and sends it back, so sending again updates the same picture or map.

const inboxes = new Map()

/** Leave a message for a lab ('game-studio', 'sprite-forge', 'tile-mapper') and tell it. */
export function sendArt(to, message) {
  if (!inboxes.has(to)) inboxes.set(to, [])
  inboxes.get(to).push(message)
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('art-bridge', { detail: { to } }))
}

/** Every message waiting for this lab, oldest first; the inbox is then empty. */
export function takeArt(to) {
  const list = inboxes.get(to) ?? []
  inboxes.delete(to)
  return list
}

/** Call `onMessage` for each message for this lab: those waiting now, and each one that arrives. Returns a function that stops listening. */
export function listenForArt(to, onMessage) {
  const drain = () => { for (const m of takeArt(to)) onMessage(m) }
  const onEvent = (e) => { if (e.detail?.to === to) drain() }
  window.addEventListener('art-bridge', onEvent)
  drain()
  return () => window.removeEventListener('art-bridge', onEvent)
}
