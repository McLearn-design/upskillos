// "Try it in Game Studio": a lesson's link into one of Game Studio's tasks (src/labs/game-studio/tasks).
//
// It shows what the task asks, step by step, with the picture of each step done in the editor (made by
// npm run game:shots, the same pictures the task panel shows), and opens Game Studio with the task set
// up. Finishing the task there marks this lesson's checkpoint, and "Back to the lesson" returns here.
//
//   { id: 'GameStudioTask', props: { task: 'first-sprite', lesson: 'mg1-001', checkpoint: 'cp-mg1-001-4' } }

import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { taskById } from '../../../labs/game-studio/tasks'
import { gameStudioLink } from '../../../labs/game-studio/tasks/links'
import { useProgress } from '../../../hooks/useProgress.js'

const SHOTS = import.meta.glob('../../../labs/game-studio/tasks/shots/*.jpg', { eager: true, query: '?url', import: 'default' })
const shot = (task, step) => SHOTS[`../../../labs/game-studio/tasks/shots/${task}-${step}.jpg`]
const COURSE = 'making-games'

export default function GameStudioTask({ params = {} }) {
  const { task: taskId, lesson, checkpoint } = params
  const task = taskById(taskId)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const progress = useProgress()
  const [big, setBig] = useState(null)
  if (!task) return <p className="text-sm text-rose-600">Game Studio has no task called “{taskId}”.</p>

  // Progress is kept per course and lesson id (pages/LessonPage.jsx).
  const key = lesson ? `${COURSE}::${lesson}` : undefined
  const done = !!(key && checkpoint && progress?.progress?.[key]?.completedCheckpoints?.includes(checkpoint))
  const open = () => navigate(gameStudioLink(task.id, { from: pathname, lesson: key, checkpoint }))

  return (
    <div data-testid={`try-it-${task.id}`} className="rounded-xl border border-sky-300/60 bg-sky-50/60 p-4 dark:border-sky-700/50 dark:bg-sky-950/30">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Try it in Game Studio</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">· {task.chain}</span>
        {done && <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">✓ Done</span>}
      </div>
      <h4 className="mt-1 text-base font-semibold text-slate-800 dark:text-slate-100">{task.title}</h4>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{task.goal}</p>

      <ol className="mt-3 space-y-3">
        {task.steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-600 text-[11px] font-bold text-white">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-700 dark:text-slate-200">{step.text}</p>
              {shot(task.id, i) && (
                <button type="button" onClick={() => setBig(shot(task.id, i))} className="mt-1 block cursor-zoom-in" title="What it looks like when this step is done (the orange outline shows where). Click to enlarge.">
                  <img src={shot(task.id, i)} alt={`Step ${i + 1}, done in the editor`} loading="lazy" className="w-full max-w-md rounded border border-slate-300 dark:border-slate-700" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" data-testid={`try-it-open-${task.id}`} onClick={open}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-sky-500">
          {done ? 'Open it again in Game Studio →' : 'Open Game Studio with this task →'}
        </button>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Each step ticks when Game Studio sees it done; Hint and Show me are there if you are stuck. When it is all done, Back to the lesson brings you here.
        </span>
      </div>

      {big && (
        <div onClick={() => setBig(null)} className="fixed inset-0 z-[3000] flex cursor-zoom-out items-center justify-center bg-black/80 p-6">
          <img src={big} alt="" className="max-h-full max-w-full rounded shadow-2xl" />
        </div>
      )}
    </div>
  )
}
