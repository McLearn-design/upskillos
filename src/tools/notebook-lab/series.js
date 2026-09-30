// Curated notebook series. Each series is a fixed, ordered list of lessons.
// Lessons are read-only sources: a learner's edits and progress are stored
// separately (seriesProgress.js), so rebuilding a lesson never has to touch
// anyone's saved notebooks, and the sidebar order is always lesson order.
//
// Lesson ids are progress keys: once a lesson ships, never change its id.
import mlSeriesData from './series-ml-ds.json'
import dsaSeriesData from './series-dsa.json'

function toLessons(data) {
  return data.map((nb, i) => ({
    id: nb.id,
    number: i + 1,
    title: nb.name.replace(/^\d+\s*[-–—]\s*/, ''),
    cells: nb.cells,
  }))
}

export const SERIES = [
  {
    id: 'ml',
    title: 'Machine Learning',
    lessons: toLessons(mlSeriesData),
  },
  {
    id: 'dsa',
    title: 'Algorithms & Design Patterns',
    lessons: toLessons(dsaSeriesData),
  },
]

const LESSONS = new Map(
  SERIES.flatMap(series => series.lessons.map(lesson => [lesson.id, { series, lesson }])),
)

export function findLesson(lessonId) {
  return LESSONS.get(lessonId) ?? null
}
