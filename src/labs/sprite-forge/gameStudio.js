// Sprite Forge and Game Studio (src/labs/game-studio), handing sprites over in the page
// (src/utils/artBridge.js). Game Studio asks for a new sprite or sends one of its pictures to edit;
// Send to Game Studio hands the sprite back, one PNG per frame, with its timing and tags, and the
// document's `link` says which of Game Studio's pictures it updates.

import { createDoc, createFrame, MAX_SIZE, MIN_SIZE } from './pixelDoc.js'
import { canvasToBlob, imageToFrames, renderFrame } from './render.js'

/** A document for a picture from Game Studio: its own size, its own colours (up to 32), one frame. */
export async function docFromBlob(blob, name, link) {
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise((ok, bad) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => bad(new Error(`${name} is not an image this browser can read`))
      i.src = url
    })
    const w = img.naturalWidth, h = img.naturalHeight
    if (w > MAX_SIZE || h > MAX_SIZE) throw new Error(`Sprite Forge edits pictures up to ${MAX_SIZE} × ${MAX_SIZE}; ${name} is ${w} × ${h}`)
    const width = Math.max(MIN_SIZE, w), height = Math.max(MIN_SIZE, h)
    const base = createDoc({ width, height, name })
    const { frames, palette } = imageToFrames(img, { width, height, palette: base.palette, extractPalette: true })
    return { ...base, paletteId: 'custom', palette, frames: [{ ...createFrame(width, height, 'Frame 1'), pixels: frames[0] }], link }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** The message Send to Game Studio leaves for it: every frame as a PNG at 1×, with its duration, and the tags. */
export async function spriteMessage(doc) {
  const frames = []
  for (let i = 0; i < doc.frames.length; i++) {
    frames.push({ blob: await canvasToBlob(renderFrame(doc, i, 1)), width: doc.width, height: doc.height, duration: doc.frames[i].duration })
  }
  return { type: 'sprite', name: doc.name, doc: doc.id, frames, tags: doc.tags ?? [], link: doc.link ?? undefined }
}
