// Lessons are Markdown files in ./lessons, discovered by file name. The number
// prefix sets the order; the `id` in the front matter is the progress key and
// must never change once published.
//
// A lesson file is front matter followed by sections, each opened by an HTML
// comment on its own line:
//
//   <!-- explore -->     a figure: one ```js block, re-run when a slider moves
//   <!-- learn -->       the data-science idea, in Markdown
//   <!-- javascript -->  the JavaScript technique the lesson's code relies on
//   <!-- maths -->       optional maths, collapsed by default (LaTeX allowed)
//   <!-- code -->        the starter code (one ```js block)
//   <!-- task -->        what to change; the code must `return` the answer
//   <!-- solution -->    one ```js block; its return value is the answer key
//
// Front matter keys: id, title, part, summary, js (the JavaScript topic),
// height (output height in px), tolerance (relative, for numeric answers),
// controls (JSON: [{ name, label, min, max, step, value }]).

const FILES = import.meta.glob('./lessons/*.md', { query: '?raw', import: 'default', eager: true })

const SECTIONS = ['explore', 'learn', 'javascript', 'maths', 'code', 'task', 'solution']
const CODE_SECTIONS = new Set(['explore', 'code', 'solution'])

function codeBlock(text, where) {
  const match = /```(?:js|javascript)\n([\s\S]*?)\n```/.exec(text)
  if (!match) throw new Error(where + ': expected a ```js code block')
  return match[1]
}

export function parseLesson(source, file = 'lesson') {
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(source)
  if (!fm) throw new Error(file + ': missing front matter')
  const meta = {}
  for (const line of fm[1].split('\n')) {
    const m = /^(\w+):\s*(.*)$/.exec(line)
    if (m) meta[m[1]] = m[2].trim()
  }
  const body = source.slice(fm[0].length)
  const parts = body.split(/^<!--\s*(\w+)\s*-->\s*$/m)
  const sections = {}
  for (let i = 1; i < parts.length; i += 2) {
    const name = parts[i]
    if (!SECTIONS.includes(name)) throw new Error(file + ': unknown section "' + name + '"')
    const text = parts[i + 1].trim()
    sections[name] = CODE_SECTIONS.has(name) ? codeBlock(text, file + ' ' + name) : text
  }
  for (const name of ['learn', 'code']) {
    if (!sections[name]) throw new Error(file + ': missing "' + name + '" section')
  }
  if (sections.task && !sections.solution) throw new Error(file + ': a task needs a solution')
  return {
    id: meta.id,
    title: meta.title,
    part: meta.part ?? 'Lessons',
    summary: meta.summary ?? '',
    js: meta.js ?? '',
    height: Number(meta.height) || 360,
    tolerance: meta.tolerance ? Number(meta.tolerance) : 1e-6,
    controls: meta.controls ? JSON.parse(meta.controls) : [],
    ...sections,
  }
}

export const LESSONS = Object.keys(FILES)
  .sort()
  .map((path, index) => ({ ...parseLesson(FILES[path], path), number: index + 1, file: path.slice(2) }))

export const PARTS = LESSONS.reduce((parts, lesson) => {
  const last = parts[parts.length - 1]
  if (last && last.title === lesson.part) last.lessons.push(lesson)
  else parts.push({ title: lesson.part, lessons: [lesson] })
  return parts
}, [])

export const lessonById = (id) => LESSONS.find((l) => l.id === id)
