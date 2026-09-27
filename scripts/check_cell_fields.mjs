#!/usr/bin/env node
// Does every notebook cell field actually get rendered?
//
// WHY THIS EXISTS
//
// Mesh lesson 3 shipped its Python cells with `title` and `explanation`. Both
// are perfectly reasonable names. Neither is read by PythonNotebook, which
// renders `cellTitle` and `prose` — so every explanation in the lesson
// displayed as nothing at all, and the code appeared as a bare dump.
//
// Nothing caught it. validate-lesson-schema passed, check_python_cells passed,
// and audit_teaching passed *because it had been told to read `explanation`* —
// which proved something about the lesson data and nothing whatsoever about the
// component that has to display it.
//
// So this reads the field list out of each notebook COMPONENT, and compares it
// against the fields the lessons actually set. A field the component never
// mentions is content the reader will never see.
//
// Usage:
//   node scripts/check_cell_fields.mjs            all courses
//   node scripts/check_cell_fields.mjs mesh-engine
//   node scripts/check_cell_fields.mjs --files <file>...

import { readdirSync, statSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { resolve, dirname, relative } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const coursesDir = resolve(root, 'src/courses')
const notebookDir = resolve(root, 'src/components/notebooks')

const isDir = (p) => { try { return statSync(p).isDirectory() } catch { return false } }

/**
 * Every `cell.<name>` / `c.<name>` a component mentions.
 *
 * Deliberately crude and deliberately generous: it over-collects rather than
 * under-collects, so a false "this field is ignored" is unlikely. A field that
 * still does not appear anywhere in the component is one nothing can render.
 */
function renderedFields(componentFile) {
  const src = readFileSync(componentFile, 'utf8')
  const names = new Set()
  for (const m of src.matchAll(/\b(?:cell|c|cellData|activeCell)\s*[?]?\.\s*([A-Za-z_$][\w$]*)/g)) {
    names.add(m[1])
  }
  // Destructured too: const { prose, cellTitle } = cell
  for (const m of src.matchAll(/\{([^{}]*)\}\s*=\s*(?:cell|c)\b/g)) {
    for (const part of m[1].split(',')) {
      const name = part.split(':')[0].trim().replace(/^\.\.\./, '')
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name)
    }
  }
  return names
}

// Fields that are plumbing rather than content: harmless if a component
// happens not to mention them, because nothing is meant to be displayed.
const STRUCTURAL = new Set(['id', 'key', 'type'])

function allLessonFiles() {
  const out = []
  for (const course of readdirSync(coursesDir)) {
    const cd = resolve(coursesDir, course)
    if (!isDir(cd)) continue
    for (const chapter of readdirSync(cd)) {
      const chd = resolve(cd, chapter)
      if (!isDir(chd)) continue
      for (const f of readdirSync(chd)) {
        if (f.endsWith('.js') && !f.endsWith('.test.js')) out.push(resolve(chd, f))
      }
    }
  }
  return out
}

async function load(file, source) {
  try {
    return (await import(`file:///${file.replace(/\\/g, '/')}?t=${Date.now()}`)).default
  } catch { /* Vite-only specifier; stub and retry */ }
  // A leading BOM stops /^import/ matching, which silently skipped two lessons
  // the last time this pattern was used.
  const stubbed = source.replace(/^﻿/, '')
    .replace(/^import\s+(\w+)\s+from\s+['"][^'"]*\?(?:url|raw)['"];?$/gm, (_m, n) => `const ${n} = 'stub';`)
    .replace(/^import\s+(\w+)\s+from\s+['"][^'"]*\.(?:svg|png|jpg|jpeg|gif|webp|css)['"];?$/gm, (_m, n) => `const ${n} = 'stub';`)
  const temp = resolve(dirname(file), `.fields-${process.pid}-${Date.now()}.mjs`)
  try {
    writeFileSync(temp, stubbed, 'utf8')
    return (await import(`file:///${temp.replace(/\\/g, '/')}`)).default
  } catch {
    return null
  } finally {
    try { unlinkSync(temp) } catch { /* nothing to remove */ }
  }
}

/** Find every notebook visualization and the cells hanging off it. */
function notebooks(lesson) {
  const found = []
  const seen = new WeakSet()
  function walk(node) {
    if (!node || typeof node !== 'object' || seen.has(node)) return
    seen.add(node)
    if (Array.isArray(node)) { node.forEach(walk); return }
    if (typeof node.id === 'string' && node.id.endsWith('Notebook')) {
      const cells = node.props?.initialCells ?? node.props?.lesson?.cells ?? node.props?.cells
      if (Array.isArray(cells)) found.push({ component: node.id, cells })
    }
    Object.values(node).forEach(walk)
  }
  walk(lesson)
  return found
}

const args = process.argv.slice(2)
let files
if (args[0] === '--files') {
  files = args.slice(1).map((f) => resolve(root, f))
} else if (args[0] && !args[0].startsWith('--')) {
  files = allLessonFiles().filter(
    (f) => relative(coursesDir, f).split(/[\\/]/)[0] === args[0],
  )
} else {
  files = allLessonFiles()
}

// Cache each component's field list, and note any component we cannot find.
const fieldCache = new Map()
const missingComponents = new Set()
function fieldsFor(component) {
  if (fieldCache.has(component)) return fieldCache.get(component)
  const file = resolve(notebookDir, `${component}.jsx`)
  let fields = null
  try {
    fields = renderedFields(file)
  } catch {
    missingComponents.add(component)
  }
  fieldCache.set(component, fields)
  return fields
}

const problems = []
let cellsChecked = 0
let notebooksChecked = 0

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  const lesson = await load(file, source)
  if (!lesson) continue
  const rel = relative(root, file)

  for (const { component, cells } of notebooks(lesson)) {
    const known = fieldsFor(component)
    if (!known) continue
    notebooksChecked++
    cells.forEach((cell, i) => {
      if (!cell || typeof cell !== 'object') return
      cellsChecked++
      const ignored = Object.keys(cell).filter(
        (k) => !known.has(k) && !STRUCTURAL.has(k),
      )
      if (ignored.length) {
        problems.push({
          file: rel,
          component,
          cell: i + 1,
          label: cell.cellTitle ?? cell.challengeTitle ?? cell.title ?? cell.id ?? '',
          ignored,
        })
      }
    })
  }
}

for (const p of problems) {
  console.log(`\n${p.file}`)
  console.log(`  ${p.component} cell ${p.cell}${p.label ? ` — ${p.label}` : ''}`)
  for (const f of p.ignored) {
    console.log(`    ✗ "${f}" is never read by ${p.component} — it renders as nothing`)
  }
}

if (missingComponents.size) {
  console.log(`\nCould not read these components, so their cells were not checked:`)
  for (const c of missingComponents) console.log(`  ${c}`)
}

console.log(
  `\n${files.length} lesson file(s), ${notebooksChecked} notebook(s), ${cellsChecked} cell(s) checked.`,
)
if (problems.length) {
  const fields = new Set(problems.flatMap((p) => p.ignored))
  console.log(`${problems.length} cell(s) set a field nothing renders: ${[...fields].join(', ')}`)
  console.log('Each one is content the reader will never see.')
} else {
  console.log('Every cell field is one its component actually reads.')
}
process.exit(problems.length ? 1 : 0)
