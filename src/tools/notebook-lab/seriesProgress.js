// Learner state for curated series lessons, kept apart from user notebooks.
//
// Shape of the stored object:
//   collapsed: { [seriesId]: true }      series hidden in the sidebar
//   lessons:   { [lessonId]: { cells, passed: [cellId], completed, updatedAt } }
//     cells     the learner's working copy (absent = the lesson as shipped)
//     passed    challenge cells whose test has passed at least once
//     completed set automatically once every challenge has passed, or by hand
const KEY = 'oc-notebook-series'

function load() {
  try {
    const db = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return { collapsed: db.collapsed ?? {}, lessons: db.lessons ?? {} }
  } catch {
    return { collapsed: {}, lessons: {} }
  }
}

function save(db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* storage full or blocked */ }
}

export function loadSeriesState() {
  return load()
}

export function setSeriesCollapsed(seriesId, collapsed) {
  const db = load()
  if (collapsed) db.collapsed[seriesId] = true
  else delete db.collapsed[seriesId]
  save(db)
  return db
}

// Fields that only mean something while the page is open.
function persistable(cell) {
  const { status, matplotlibImages, figureJson, ...rest } = cell
  return { ...rest, status: status === 'error' ? 'error' : 'idle' }
}

// Identifies the shipped version of a lesson's code, so a learner's saved copy
// of an older version is dropped when the lesson is rewritten.
function lessonVersion(lesson) {
  let h = 0
  for (const c of lesson.cells) {
    const s = `${c.id}|${c.code ?? ''}|${c.testCode ?? ''}`
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return h
}

// The learner's working copy, or null when there is none for this version.
export function savedLessonCells(state, lesson) {
  const entry = state.lessons[lesson.id]
  return entry?.cells && entry.version === lessonVersion(lesson) ? entry.cells : null
}

export function saveLessonCells(lesson, cells) {
  const db = load()
  const prev = db.lessons[lesson.id] ?? {}
  const passed = new Set(prev.passed ?? [])
  for (const c of cells) if (c.challengeType && c.testResult?.success) passed.add(c.id)

  const shipped = new Map(lesson.cells.map(c => [c.id, c.code]))
  const edited = cells.length !== lesson.cells.length || cells.some(c => shipped.get(c.id) !== c.code)
  // Opening and reading a lesson, or running it unchanged, records nothing.
  if (!edited && passed.size === (prev.passed ?? []).length) return db

  const challengeIds = lesson.cells.filter(c => c.challengeType).map(c => c.id)
  const allPassed = challengeIds.length > 0 && challengeIds.every(id => passed.has(id))

  const entry = { ...prev, passed: [...passed], completed: !!prev.completed || allPassed, updatedAt: Date.now() }
  if (edited) {
    entry.cells = cells.map(persistable)
    entry.version = lessonVersion(lesson)
  } else {
    delete entry.cells
  }
  db.lessons[lesson.id] = entry
  save(db)
  return db
}

export function setLessonCompleted(lessonId, completed) {
  const db = load()
  db.lessons[lessonId] = { ...(db.lessons[lessonId] ?? {}), completed, updatedAt: Date.now() }
  save(db)
  return db
}

// Back to the lesson as shipped. Progress (passed challenges, completion) stays.
export function resetLessonCells(lessonId) {
  const db = load()
  if (db.lessons[lessonId]) delete db.lessons[lessonId].cells
  save(db)
  return db
}

// 'done' | 'started' | 'new'
export function lessonStatus(state, lessonId) {
  const entry = state.lessons[lessonId]
  if (!entry) return 'new'
  if (entry.completed) return 'done'
  return 'started'
}
