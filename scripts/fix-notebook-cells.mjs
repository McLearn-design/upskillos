#!/usr/bin/env node
// Move a notebook visualization's `cells:` into `props: { initialCells: }`.
//
// WHY THIS EXISTS
//   normalizeViz() in src/components/lesson/MicroCycleLesson.jsx keeps only
//   { id, initialProps, props, title, caption, mathBridge } off a
//   visualization entry. A `cells:` sitting at the top level of that entry is
//   dropped on the floor, and PythonNotebook then finds no params.initialCells
//   and falls back to its own STARTER_CELLS — so the lesson renders a working
//   notebook containing somebody else's content.
//
//   Nothing catches it: check_python_cells.mjs looks for arrays named either
//   "cells" or "initialCells" wherever they appear, so the cells run fine in
//   CI while never reaching the page, and validate-lesson-schema.mjs does not
//   inspect visualization internals at all.
//
// WHAT IT DOES NOT DO
//   Reindent. The cell bodies are template literals holding Python, and
//   shifting them by two spaces is an IndentationError. Only the wrapper
//   lines move; the contents are left exactly where they are.
//
// Usage:
//   node scripts/fix-notebook-cells.mjs --dry     list what would change
//   node scripts/fix-notebook-cells.mjs           apply
//   node scripts/fix-notebook-cells.mjs <file...> apply to specific files

import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs'
import { resolve, dirname, relative } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const coursesDir = resolve(root, 'src/courses')

const NOTEBOOK_IDS = ['PythonNotebook', 'OpenMatNotebook', 'GcodeNotebook']

function isDir(p) { try { return statSync(p).isDirectory() } catch { return false } }

function allLessonFiles() {
  const out = []
  for (const course of readdirSync(coursesDir)) {
    const courseDir = resolve(coursesDir, course)
    if (!isDir(courseDir)) continue
    for (const chapter of readdirSync(courseDir)) {
      const chapterDir = resolve(courseDir, chapter)
      if (!isDir(chapterDir)) continue
      for (const file of readdirSync(chapterDir)) {
        if (file.endsWith('.js')) out.push(resolve(chapterDir, file))
      }
    }
  }
  return out
}

/**
 * Index of the `]` that closes the `[` at `open`.
 *
 * Skips over string literals, template literals and comments, because the
 * cell bodies are full of brackets inside Python source and a naive counter
 * closes in the wrong place.
 */
function matchingBracket(src, open) {
  let depth = 0
  for (let i = open; i < src.length; i++) {
    const c = src[i]
    if (c === '"' || c === "'") {
      const quote = c
      i++
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue }
        if (src[i] === quote) break
        i++
      }
    } else if (c === '`') {
      i++
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue }
        if (src[i] === '`') break
        i++
      }
    } else if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++
    } else if (c === '/' && src[i + 1] === '*') {
      i += 2
      while (i + 1 < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++
      i++
    } else if (c === '[') {
      depth++
    } else if (c === ']') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** Rewrite one file's notebook visualizations. Returns the new source, or null. */
function rewrite(src) {
  let changed = false
  let out = src

  // Work backwards so earlier offsets stay valid as we splice.
  const hits = []
  const pattern = /\n([ \t]*)cells:\s*\[/g
  let m
  while ((m = pattern.exec(out)) !== null) {
    // Only a `cells:` that belongs to a NOTEBOOK visualization entry. Look
    // back a short way for the id/type that names one, and stop at the
    // opening brace of the entry so we never cross into a sibling.
    const before = out.slice(Math.max(0, m.index - 400), m.index)
    const entry = before.slice(before.lastIndexOf('{'))
    const isNotebook = NOTEBOOK_IDS.some(
      (id) => entry.includes(`'${id}'`) || entry.includes(`"${id}"`),
    )
    // Already correct, or not ours.
    if (!isNotebook) continue
    if (/initialCells\s*:/.test(entry)) continue
    hits.push({ index: m.index, indent: m[1], openBracket: m.index + m[0].length - 1 })
  }

  for (const hit of hits.reverse()) {
    const close = matchingBracket(out, hit.openBracket)
    if (close === -1) continue
    const i = hit.indent
    out =
      out.slice(0, hit.index) +
      `\n${i}props: {\n${i}  initialCells: [` +
      out.slice(hit.openBracket + 1, close) +
      `]\n${i}}` +
      out.slice(close + 1)
    changed = true
  }

  return changed ? out : null
}

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const explicit = args.filter((a) => !a.startsWith('--'))
const files = explicit.length
  ? explicit.map((f) => resolve(root, f))
  : allLessonFiles()

const touched = []
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const next = rewrite(src)
  if (!next) continue
  touched.push(file)
  if (!dry) writeFileSync(file, next, 'utf8')
}

console.log(`${dry ? 'would fix' : 'fixed'} ${touched.length} file(s)`)
for (const f of touched) console.log('  ' + relative(root, f))

if (!dry && touched.length) {
  // Importing is the real check: a mangled object literal fails here, and
  // a visualization whose cells did not survive shows up as a zero.
  console.log('\nverifying...')
  let bad = 0
  for (const file of touched) {
    try {
      const mod = await import(pathToFileURL(file).href + `?t=${Date.now()}`)
      const lesson = mod.default
      let found = 0
      const walk = (v) => {
        if (!v || typeof v !== 'object') return
        if (Array.isArray(v)) { v.forEach(walk); return }
        if (NOTEBOOK_IDS.includes(v.id ?? v.vizId)) {
          const n = v.props?.initialCells?.length ?? 0
          found += n
          if (!n) { console.error(`  ✗ ${relative(root, file)} — notebook has no props.initialCells`); bad++ }
        }
        Object.values(v).forEach(walk)
      }
      walk(lesson)
      if (found) console.log(`  ✓ ${relative(root, file)} — ${found} cell(s)`)
    } catch (err) {
      bad++
      console.error(`  ✗ ${relative(root, file)} — ${err.message}`)
    }
  }
  if (bad) { console.error(`\n${bad} problem(s).`); process.exit(1) }
  console.log('\nall verified.')
}
