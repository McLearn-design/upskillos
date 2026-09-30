// Curated notebook series. Each series is a fixed, ordered list of lessons
// (series/manifest.js); a lesson's text is loaded only when it is opened.
// Lessons are read-only sources: a learner's edits and progress are stored
// separately (seriesProgress.js).
import { SERIES_MANIFEST } from './series/manifest.js'
import { parseLesson } from './lessonFormat.js'

const lessonFiles = import.meta.glob('./series/*/*.md', { query: '?raw', import: 'default' })

export const SERIES = SERIES_MANIFEST.map(series => ({
  ...series,
  lessons: series.lessons.map(lesson => ({
    ...lesson,
    load: lessonFiles[`./series/${series.dir}/${lesson.slug}.md`] ?? null,
  })),
}))

const LESSONS = new Map(
  SERIES.flatMap(series => series.lessons.map(lesson => [lesson.id, { series, lesson }])),
)

export function findLesson(lessonId) {
  return LESSONS.get(lessonId) ?? null
}

export function isAvailable(lesson) {
  return !!lesson.load
}

const parsed = new Map()

// The lesson's cells, parsed from its Markdown. Cached per page load.
export async function loadLessonCells(lesson) {
  if (!parsed.has(lesson.id)) {
    const source = await lesson.load()
    parsed.set(lesson.id, parseLesson(source).cells)
  }
  return parsed.get(lesson.id)
}
