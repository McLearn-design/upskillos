// One completion policy for every course surface. Reading is useful activity,
// but it is not evidence that the learner can use the material.
const MASTERY_CHECKPOINTS = new Set([
  'quiz-passed',
  'assessment-passed',
  'challenge-passed',
  'lesson-passed',
  'lesson-complete',
])

export function deriveLessonProgress(entry) {
  if (!entry) return { percent: 0, status: 'not-started', correct: 0, total: 0 }

  const checkpoints = entry.completedCheckpoints ?? []
  const hasReadingActivity = (entry.readingProgress ?? 0) > 0 || checkpoints.some(id => id.startsWith('read-'))

  // A lesson with a quiz is complete only when every answer is correct.
  // Reading/checkpoints can show that it has been started, but cannot bypass
  // the quiz requirement.
  if (entry.quiz && entry.quiz.total > 0) {
    const correct = Math.max(0, Math.min(entry.quiz.correct ?? 0, entry.quiz.total))
    const attempted = Math.max(0, entry.quiz.attempted ?? 0)
    const percent = Math.round((correct / entry.quiz.total) * 100)
    const complete = correct === entry.quiz.total
    const started = attempted > 0 || correct > 0 || hasReadingActivity || checkpoints.length > 0
    return {
      percent,
      status: complete ? 'complete' : started ? 'in-progress' : 'not-started',
      correct,
      total: entry.quiz.total,
    }
  }

  // Lessons without a quiz need an explicit passed/completed checkpoint from
  // a real assessment or challenge. Passive read-* checkpoints stay partial.
  const complete = checkpoints.some(id => MASTERY_CHECKPOINTS.has(id))
  const started = hasReadingActivity || checkpoints.length > 0
  return {
    percent: complete ? 100 : 0,
    status: complete ? 'complete' : started ? 'in-progress' : 'not-started',
    correct: 0,
    total: 0,
  }
}
