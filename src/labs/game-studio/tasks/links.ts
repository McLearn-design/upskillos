// Links from lessons into Game Studio's tasks, and back (docs/game-studio-course-plan.md).
//
//   #/lab/game-studio?task=first-script&from=/chapter/game-studio-1/first-script&lesson=gs1-3&checkpoint=cp-gs1-3-4
//
// Lessons build them with gameStudioLink(), so a task id that does not exist fails a test instead
// of opening an empty editor (MeshLab's rule, src/labs/mesh-lab/links.ts).

import { taskById } from './index';

export interface TaskLink {
  task: string;
  /** Where "Back to the lesson" goes: an in-app route. */
  from?: string;
  /** The lesson and checkpoint to mark done when the task is finished. */
  lesson?: string;
  checkpoint?: string;
}

/** The in-app path (for <Link to> or navigate()) that opens a task. Throws on an unknown task. */
export function gameStudioLink(task: string, back: Omit<TaskLink, 'task'> = {}): string {
  if (!taskById(task)) throw new Error(`Game Studio has no task called "${task}"`);
  const q = new URLSearchParams({ task });
  for (const [k, v] of Object.entries(back)) if (v) q.set(k, v);
  return `/lab/game-studio?${q.toString()}`;
}

/** What a location hash asks Game Studio to open, if anything. */
export function parseTaskLink(hash: string): TaskLink | null {
  const q = new URLSearchParams(hash.split('?')[1] ?? '');
  const task = q.get('task');
  if (!task) return null;
  return { task, from: q.get('from') ?? undefined, lesson: q.get('lesson') ?? undefined, checkpoint: q.get('checkpoint') ?? undefined };
}
