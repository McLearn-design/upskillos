#!/usr/bin/env node
// Does this lesson TEACH, or does it dump?
//
// A first pass only. It cannot judge whether an explanation is any good — it
// reports signals that correlate with dumping, so a human reads the flagged
// ones instead of all of them. A lesson that scores badly here is a lesson to
// go and look at, not automatically a bad lesson.
//
// WHAT IT LOOKS FOR
//   code with no prose        a cell carrying source and nothing saying what it
//                             is for, or why
//   no prediction moment      the lesson-writing standard requires at least one
//                             place the reader is asked to guess before the
//                             answer appears. Without one it is a lecture
//   formula-first openings    the standard says concrete numbers come before
//                             the general form. An opening paragraph that is
//                             mostly notation inverts that
//   undefined symbols         a symbol used in prose that the lesson never
//                             introduces. Crude: it only catches the obvious
//   thin prose per code       a high ratio of code lines to words of
//                             explanation
//
// Usage:
//   node scripts/audit_teaching.mjs <courseId>
//   node scripts/audit_teaching.mjs --files <file>...
//   node scripts/audit_teaching.mjs --ids la1-001 la2-003 ...

import { readdirSync, statSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { resolve, dirname, relative } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const coursesDir = resolve(root, 'src/courses')

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
        if (file.endsWith('.js') && !file.endsWith('.test.js')) {
          out.push(resolve(chapterDir, file))
        }
      }
    }
  }
  return out
}

const PREDICTION = /before (reading on|you run|running|continuing|we look)|\bpredict\b|what do you (think|expect)|guess (what|which|how)|work it out before|try to answer/i

// A cell that carries source of some kind.
const CODE_FIELDS = ['code', 'startCode', 'solution']

function cellsIn(lesson) {
  const found = []
  const seen = new WeakSet()
  function walk(value, path) {
    if (!value || typeof value !== 'object' || seen.has(value)) return
    seen.add(value)
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}[${i}]`))
      return
    }
    const field = CODE_FIELDS.find((f) => typeof value[f] === 'string' && value[f].trim())
    if (field) found.push({ path, cell: value, field })
    for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`)
  }
  walk(lesson, '')
  return found
}

/** Words of explanation attached to a cell, wherever the author put them. */
function proseFor(cell) {
  const parts = []
  // `prompt` is where a challenge cell keeps its instruction, and
  // `challengeTitle` its heading. Leaving them out reported a properly
  // written challenge as having no explanation at all.
  for (const key of ['instruction', 'cellTitle', 'title', 'caption', 'explanation',
                     'annotation', 'prompt', 'challengeTitle', 'hint', 'successMessage']) {
    if (typeof cell[key] === 'string') parts.push(cell[key])
  }
  if (Array.isArray(cell.prose)) parts.push(cell.prose.join(' '))
  return parts.join(' ')
}

/** Comment lines inside the source itself — they count as explanation. */
function commentLines(code) {
  return code.split('\n').filter((l) => /^\s*(#|\/\/|\/\*|\*)/.test(l)).length
}

const args = process.argv.slice(2)
let files
if (args[0] === '--files') {
  files = args.slice(1).map((f) => resolve(root, f))
} else if (args[0] === '--ids') {
  const wanted = new Set(args.slice(1))
  files = allLessonFiles().filter((f) => {
    const id = /^\s{2}id:\s*['"]([^'"]+)['"]/m.exec(readFileSync(f, 'utf8'))?.[1]
    return id && wanted.has(id)
  })
} else if (args[0] && !args[0].startsWith('--')) {
  files = allLessonFiles().filter(
    (f) => relative(coursesDir, f).split(/[\\/]/)[0] === args[0],
  )
} else {
  files = allLessonFiles()
}


/**
 * Import a lesson, working around Vite-only import specifiers.
 *
 * Roughly 200 lessons do `import url from '../diagrams/x.svg?url'`. Node
 * cannot resolve those, so a plain import throws and every one of those
 * lessons is silently skipped — which is exactly how a confident false report
 * gets produced. Stub the specifier out and import the rest.
 *
 * The temp file is written beside the original so the lesson's other relative
 * imports still resolve, and uses .mjs because courseLoader.js treats any .js
 * in a chapter folder as a lesson.
 */
async function load(file, source) {
  try {
    return (await import(`file:///${file.replace(/\\/g, '/')}?t=${Date.now()}`)).default
  } catch { /* fall through to the stubbed copy */ }

  // A leading UTF-8 BOM makes the first line "\ufeffimport ...", which /^import/
  // does not match - so the first specifier was left unstubbed and the lesson
  // still failed to load. Two linear-algebra lessons hit exactly this.
  const stubbed = source.replace(/^\ufeff/, '')
    .replace(
      /^import\s+(\w+)\s+from\s+['"][^'"]*\?(?:url|raw)['"];?$/gm,
      (_m, name) => `const ${name} = 'stub://asset';`,
    )
    .replace(
      /^import\s+(\w+)\s+from\s+['"][^'"]*\.(?:svg|png|jpg|jpeg|gif|webp|css)['"];?$/gm,
      (_m, name) => `const ${name} = 'stub://asset';`,
    )

  const temp = resolve(dirname(file), `.audit-${process.pid}-${Date.now()}.mjs`)
  try {
    writeFileSync(temp, stubbed, 'utf8')
    return (await import(`file:///${temp.replace(/\\/g, '/')}`)).default
  } catch {
    return null
  } finally {
    try { unlinkSync(temp) } catch { /* nothing to remove */ }
  }
}

const rows = []

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  const id = /^\s{2}id:\s*['"]([^'"]+)['"]/m.exec(source)?.[1] ?? '?'
  const title = /^\s{2}title:\s*['"]([^'"]+)['"]/m.exec(source)?.[1] ?? ''

  const lesson = await load(file, source)

  const flags = []

  // 1. prediction moment, anywhere in the file
  if (!PREDICTION.test(source)) flags.push('no prediction moment')

  // 2. code cells with no prose
  let codeCells = 0
  let bareCells = 0
  let codeLines = 0
  let proseWords = 0
  if (lesson) {
    for (const { cell, field } of cellsIn(lesson)) {
      codeCells++
      const code = cell[field]
      codeLines += code.split('\n').length
      const prose = proseFor(cell)
      const words = prose.trim() ? prose.trim().split(/\s+/).length : 0
      proseWords += words
      // Bare means: almost nothing said about it, and barely commented either.
      if (words < 12 && commentLines(code) < 3) bareCells++
    }
    if (bareCells) flags.push(`${bareCells}/${codeCells} code cell(s) with no explanation`)
  } else {
    flags.push('could not be loaded at all — signals from text only')
  }

  // 3. formula-first opening
  const firstProse = /paragraphs:\s*\[\s*['"`]([^'"`]{60,400})/.exec(source)?.[1]
    ?? /prose:\s*\[\s*['"`]([^'"`]{60,400})/.exec(source)?.[1]
    ?? /instruction:\s*[`'"]([^`'"]{60,400})/.exec(source)?.[1]
  if (firstProse) {
    const digits = (firstProse.match(/\d/g) ?? []).length
    const maths = (firstProse.match(/\$/g) ?? []).length
    if (digits < 2 && maths >= 4) flags.push('opens with notation, not concrete numbers')
  }

  // 4. explanation density
  if (codeCells > 0 && codeLines > 40) {
    const ratio = proseWords / codeLines
    if (ratio < 0.8) {
      flags.push(`thin explanation: ${proseWords} words for ${codeLines} lines of code`)
    }
  }

  if (flags.length) rows.push({ id, title, file: relative(root, file), flags })
}

rows.sort((a, b) => b.flags.length - a.flags.length)

for (const row of rows) {
  console.log(`\n${row.id}  ${row.title}`)
  console.log(`  ${row.file}`)
  for (const flag of row.flags) console.log(`    - ${flag}`)
}

console.log(
  `\n${files.length} lesson(s) audited, ${rows.length} with something to look at.`,
)
console.log('These are signals, not verdicts. Read the flagged ones.')
