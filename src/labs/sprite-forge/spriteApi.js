// The sprite API: every edit Sprite Forge makes, as a line of code you could write yourself (GUI → code, as
// in Game Studio and Tile Mapper). Each edit is a command, { label, code, run }; running the logged lines on
// the sprite the session started from makes the same sprite (spriteApi.test.js), and code typed into the
// Code panel runs the same way.
//
//   sprite.paint(0, [[3, 4, 2], [4, 4, 2]])   // frame 0: [x, y, colour]; colour 0 is transparent,
//                                             // n is the palette's nth swatch
//   sprite.addFrame(0, { copy: true })        // a copy of frame 0, after it
//   sprite.color(1, '#ff004d')                // swatch 1 (pixel value 2) becomes red, in every frame
//   sprite.flipH('all')                       // a frame number, or 'all'
//
// The sprite's name is not logged: it is a label, like a file name, not part of the picture.

import { TRANSPARENT, createFrame, flipH, flipV, rotate90, shift, withFramePixels } from './pixelDoc.js'
import {
  addFrame,
  addPaletteColor,
  applyPalette,
  mapFrames,
  moveFrame,
  removeFrame,
  removePaletteColor,
  resizeDoc,
  setAllDurations,
  setPaletteColor,
  updateFrame,
} from './useSpriteDoc.js'

const lit = (v) => JSON.stringify(v)

function frameIndex(doc, frame) {
  if (!Number.isInteger(frame) || frame < 0 || frame >= doc.frames.length) throw new Error(`There is no frame ${lit(frame)}: the frames are 0 to ${doc.frames.length - 1}`)
  return frame
}

/** The edits that turn one frame's pixels into another's: [x, y, colour] for each pixel that changed. */
export function pixelEdits(before, after, width) {
  const edits = []
  for (let i = 0; i < after.length; i++) if (before[i] !== after[i]) edits.push([i % width, Math.floor(i / width), after[i]])
  return edits
}

/** A transform of the pixels, on one frame or on every frame. */
function onFrames(doc, which, fn) {
  if (which === 'all') return mapFrames(doc, (px) => fn(px, doc.width, doc.height))
  const i = frameIndex(doc, which)
  return withFramePixels(doc, i, fn(doc.frames[i].pixels.slice(), doc.width, doc.height))
}

const METHODS = {
  resize: (doc, width, height) => resizeDoc(doc, width, height),
  paint: (doc, frame, edits) => {
    const i = frameIndex(doc, frame), px = doc.frames[i].pixels.slice()
    for (const [x, y, v] of edits) {
      if (x < 0 || y < 0 || x >= doc.width || y >= doc.height) throw new Error(`Pixel ${x}, ${y} is outside the ${doc.width} × ${doc.height} sprite`)
      if (v < 0 || v > doc.palette.length) throw new Error(`There is no colour ${v}: 0 is transparent, 1 to ${doc.palette.length} are the swatches`)
      px[y * doc.width + x] = v
    }
    return withFramePixels(doc, i, px)
  },
  flipH: (doc, which) => onFrames(doc, which, flipH),
  flipV: (doc, which) => onFrames(doc, which, flipV),
  rotate: (doc, which) => onFrames(doc, which, rotate90),
  nudge: (doc, dx, dy, which) => onFrames(doc, which, (px, w, h) => shift(px, w, h, dx, dy)),
  clear: (doc, which) => onFrames(doc, which, (px) => px.fill(TRANSPARENT)),
  addFrame: (doc, after, opts = {}) => addFrame(doc, frameIndex(doc, after), opts),
  removeFrame: (doc, frame) => removeFrame(doc, frameIndex(doc, frame)),
  moveFrame: (doc, from, to) => moveFrame(doc, frameIndex(doc, from), to),
  frame: (doc, frame, patch) => updateFrame(doc, frameIndex(doc, frame), patch),
  durations: (doc, ms) => setAllDurations(doc, ms),
  color: (doc, index, hex) => setPaletteColor(doc, index, hex),
  addColor: (doc, hex) => addPaletteColor(doc, hex),
  removeColor: (doc, index) => removePaletteColor(doc, index),
  palette: (doc, colors, id = 'custom') => applyPalette(doc, colors, id),
  tags: (doc, tags) => ({ ...doc, tags, updatedAt: Date.now() }),
  /** Frames from an image (Import image): each a list of pixel values, replacing the frames or added after them. */
  importFrames: (doc, mode, frames, palette) => {
    const next = palette ? applyPalette(doc, palette) : doc
    const made = frames.map((pixels, i) => ({ ...createFrame(doc.width, doc.height, `Imported ${i + 1}`), pixels: Uint8Array.from(pixels) }))
    return { ...next, frames: mode === 'replace' ? made : [...next.frames, ...made], updatedAt: Date.now() }
  },
}

function command(label, name, args) {
  return { label, code: `sprite.${name}(${args.map(lit).join(', ')})`, run: (doc) => METHODS[name](doc, ...args) }
}

/** The editor's edits as commands, each built from the sprite as it is now. */
export const cmd = {
  resize: (doc, w, h) => command(`Resize to ${w} × ${h}`, 'resize', [Number(w), Number(h)]),
  /** A brush stroke (or fill): the pixels it changed. */
  paint: (doc, frame, pixels) => command(`Paint frame ${frame}`, 'paint', [frame, pixelEdits(doc.frames[frame].pixels, pixels, doc.width)]),
  flipH: (doc, which) => command('Flip horizontally', 'flipH', [which]),
  flipV: (doc, which) => command('Flip vertically', 'flipV', [which]),
  rotate: (doc, which) => command('Rotate 90°', 'rotate', [which]),
  nudge: (doc, dx, dy, which) => command('Nudge', 'nudge', [dx, dy, which]),
  clear: (doc, which) => command('Clear', 'clear', [which]),
  addFrame: (doc, after, opts = {}) => command(opts.copy ? 'Duplicate a frame' : 'Add a frame', 'addFrame', opts.copy ? [after, { copy: true }] : [after]),
  removeFrame: (doc, frame) => command(`Delete frame ${frame}`, 'removeFrame', [frame]),
  moveFrame: (doc, from, to) => command(`Move frame ${from}`, 'moveFrame', [from, to]),
  frame: (doc, frame, patch) => command(`Frame ${frame}: ${Object.keys(patch).join(', ')}`, 'frame', [frame, patch]),
  durations: (doc, ms) => command(`Every frame ${ms} ms`, 'durations', [ms]),
  color: (doc, index, hex) => command(`Colour ${index + 1}: ${hex}`, 'color', [index, hex]),
  addColor: (doc, hex = '#ffffff') => command('Add a colour', 'addColor', [hex]),
  removeColor: (doc, index) => command(`Remove colour ${index + 1}`, 'removeColor', [index]),
  palette: (doc, colors, id) => command(`Palette ${id}`, 'palette', [colors, id]),
  tags: (doc, tags) => command('Edit tags', 'tags', [tags.map(({ name, from, to }) => ({ name, from, to }))]),
  importFrames: (doc, mode, frames, palette) => command(`Import ${frames.length} frame${frames.length === 1 ? '' : 's'}`, 'importFrames', palette ? [mode, frames.map((f) => Array.from(f)), palette] : [mode, frames.map((f) => Array.from(f))]),
}

/** Run code written against the sprite API on a sprite: the Code panel's Run, and the replay test. */
export function runSpriteCode(doc, code) {
  let current = doc
  const sprite = Object.fromEntries(Object.keys(METHODS).map((name) => [name, (...args) => { current = METHODS[name](current, ...args) }]))
  Object.defineProperty(sprite, 'width', { get: () => current.width })
  Object.defineProperty(sprite, 'height', { get: () => current.height })
  Object.defineProperty(sprite, 'frames', { get: () => current.frames.length })
  Object.defineProperty(sprite, 'colors', { get: () => current.palette.slice() })
  new Function('sprite', `"use strict";\n${code}`)(sprite)
  return current
}

export const SPRITE_API_NAMES = Object.keys(METHODS)
