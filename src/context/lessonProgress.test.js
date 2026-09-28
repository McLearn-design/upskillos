import { describe, expect, it } from 'vitest'
import { deriveLessonProgress } from './lessonProgress.js'

describe('deriveLessonProgress', () => {
  it('treats scrolling and read checkpoints as activity, not completion', () => {
    expect(deriveLessonProgress({
      readingProgress: 100,
      completedCheckpoints: ['read-intuition', 'read-rigor'],
    })).toEqual({ percent: 0, status: 'in-progress', correct: 0, total: 0 })
  })

  it('requires every quiz question to be correct', () => {
    expect(deriveLessonProgress({ quiz: { correct: 3, attempted: 4, total: 4 } }).status).toBe('in-progress')
    expect(deriveLessonProgress({ quiz: { correct: 4, attempted: 4, total: 4 } })).toEqual({
      percent: 100, status: 'complete', correct: 4, total: 4,
    })
  })

  it('does not let reading bypass an unattempted quiz', () => {
    expect(deriveLessonProgress({
      readingProgress: 90,
      completedCheckpoints: ['read-intuition'],
      quiz: { correct: 0, attempted: 0, total: 3 },
    })).toEqual({ percent: 0, status: 'in-progress', correct: 0, total: 3 })
  })

  it('allows an explicit mastery checkpoint for a lesson without a quiz', () => {
    expect(deriveLessonProgress({ completedCheckpoints: ['read-intuition', 'challenge-passed'] })).toEqual({
      percent: 100, status: 'complete', correct: 0, total: 0,
    })
  })
})
