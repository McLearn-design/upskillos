#!/usr/bin/env node
// Check that every lesson id a lesson points at actually exists.
//
// WHAT IT CHECKS
//   spiral.recoveryPoints[].lessonId   "go back and read this first"
//   spiral.futureLinks[].lessonId      "this feeds into that"
//   prerequisites[]                    by id (see Standards.jsx)
//   nextLesson                         by id
//
// A dead prerequisite link is worse than none: it tells a reader there is
// something to go and read, and then there is not.
//
// WHY IT READS FILES INSTEAD OF IMPORTING THEM
//   Roughly 200 lessons import Vite-only specifiers — `./diagram.svg?url` and
//   the like — which Node cannot resolve. An import-based scan silently skips
//   every one of those and then reports their ids as missing. That produced a
//   confident false "194 dead links" against courses whose
//   references were all fine. So ids are read out of the source text.
//
// Usage:
//   node scripts/check_lesson_links.mjs                     every lesson
//   node scripts/check_lesson_links.mjs <courseId>          one course
//   node scripts/check_lesson_links.mjs --files <file>...   a PR diff
//
// Forward links to a lesson that is planned but not yet written are reported
// as PENDING, not as a failure — futureLinks are allowed to run ahead. Pass
// --strict to treat those as errors too.

import { readdirSync, statSync, readFileSync } from 'fs'
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

/** The id and slug a lesson declares, read from its source. */
function identity(source) {
  const id = /^\s{2}id:\s*'([^']+)'/m.exec(source)?.[1]
    ?? /^\s{2}id:\s*"([^"]+)"/m.exec(source)?.[1]
  const slug = /^\s{2}slug:\s*'([^']+)'/m.exec(source)?.[1]
    ?? /^\s{2}slug:\s*"([^"]+)"/m.exec(source)?.[1]
  return { id, slug }
}

/** Every lessonId referenced from a spiral block, with which block it was in. */
function references(source) {
  const out = []
  for (const match of source.matchAll(/lessonId:\s*'([^']+)'/g)) {
    // Which block it sits in, decided by whichever heading is nearest above.
    const before = source.slice(0, match.index)
    const recovery = before.lastIndexOf('recoveryPoints')
    const future = before.lastIndexOf('futureLinks')
    out.push({ id: match[1], kind: future > recovery ? 'future' : 'recovery' })
  }
  return out
}

const args = process.argv.slice(2)
const strict = args.includes('--strict')
const explicit = args[0] === '--files' ? args.slice(1).filter((a) => !a.startsWith('--')) : null
const courseFilter = !explicit && args[0] && !args[0].startsWith('--') ? args[0] : null

// Build the id and slug tables from EVERY lesson, always — a file being
// checked may legitimately point at one outside the filter.
const known = { ids: new Set(), slugs: new Set() }
for (const file of allLessonFiles()) {
  const { id, slug } = identity(readFileSync(file, 'utf8'))
  if (id) known.ids.add(id)
  if (slug) known.slugs.add(slug)
}

let files = explicit ? explicit.map((f) => resolve(root, f)) : allLessonFiles()
if (courseFilter) {
  files = files.filter((f) => relative(coursesDir, f).split(/[\\/]/)[0] === courseFilter)
}

let dead = 0
let pending = 0
let slugStyle = 0
let checked = 0

for (const file of files) {
  const label = relative(root, file)
  const source = readFileSync(file, 'utf8')
  const problems = []
  let deadHere = 0

  for (const ref of references(source)) {
    checked++
    if (known.ids.has(ref.id)) continue
    if (ref.kind === 'future' && !strict) {
      pending++
      problems.push(`    PENDING  ${ref.id}  (forward link, not written yet)`)
    } else {
      dead++; deadHere++
      problems.push(`    DEAD     ${ref.id}  (${ref.kind})`)
    }
  }

  // prerequisites and nextLesson hold lesson IDS. That is the repo's own
  // documented standard - src/components/help/sections/Standards.jsx:
  // "prerequisites[] lists actual lesson ids, not topic names" - and it is
  // what the great majority of courses do.
  //
  // A handful (the cnc course among them) use slugs instead. Those are
  // accepted but reported, because a mixed convention is how this gets
  // miscounted: validating ids against the slug table produced a confident
  // false "194 dead links" the first time this script ran.
  // TOP-LEVEL prerequisites only - two-space indent. There is also a
  // mastery.prerequisites at four spaces, which sits beside mastery.unlocks
  // and mastery.checkpoints and is PROSE by design:
  //
  //   mastery: {
  //     prerequisites: ['Vector components and magnitude', 'Trigonometry: ...'],
  //
  // Matching `prerequisites:` at any depth reports all twelve of those in the
  // physics vectors chapter as dead links. They are not links.
  const prereqBlock = /^ {2}prerequisites:\s*\[([^\]]*)\]/ms.exec(source)?.[1] ?? ''
  for (const match of prereqBlock.matchAll(/'([^']+)'/g)) {
    checked++
    const value = match[1]
    if (known.ids.has(value)) continue
    if (known.slugs.has(value)) {
      slugStyle++
      problems.push(`    SLUG     ${value}  (prerequisite: a real slug, but the standard is an id)`)
    } else {
      dead++; deadHere++
      problems.push(`    DEAD     ${value}  (prerequisite, matches no id or slug)`)
    }
  }

  const next = /^\s{2}nextLesson:\s*'([^']+)'/m.exec(source)?.[1]
  if (next) {
    checked++
    if (!known.ids.has(next)) {
      if (known.slugs.has(next)) {
        slugStyle++
        problems.push(`    SLUG     ${next}  (nextLesson: a real slug, but the standard is an id)`)
      } else {
        pending++
        problems.push(`    PENDING  ${next}  (nextLesson, not written yet)`)
      }
    }
  }

  if (problems.length) {
    console.log(`${deadHere ? '✗' : '~'} ${label}`)
    problems.forEach((p) => console.log(p))
  }
}

console.log(
  `\n${files.length} lesson file(s), ${checked} link(s) checked. `
  + `${dead} dead, ${pending} pending, ${slugStyle} using a slug where the `
  + `standard is an id.`,
)
console.log(`${known.ids.size} lesson ids and ${known.slugs.size} slugs known.`)

if (dead) {
  console.error('\nA dead link promises a reader something to go and read that is not there.')
  process.exit(1)
}
