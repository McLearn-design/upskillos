// progress.js
// Where the learner is (track, lesson, step) and which checked steps they have completed.
// Kept in localStorage: it is a convenience for picking up where you left off. The learner's
// real progress is their project folder and its Git history, which this never touches.
import { useCallback, useMemo, useState } from 'react';

const KEY = 'project-studio-progress-v1';

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { position: v.position || {}, done: v.done || {} };
  } catch {
    return { position: {}, done: {} };
  }
}

function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

export function useProgress() {
  const [state, setState] = useState(load);

  const savePosition = useCallback((position) => {
    setState((prev) => {
      const p = prev.position;
      if (p.trackKey === position.trackKey && p.lessonId === position.lessonId && p.stepIndex === position.stepIndex) return prev;
      const next = { ...prev, position };
      save(next);
      return next;
    });
  }, []);

  const markDone = useCallback((stepId) => {
    setState((prev) => {
      if (prev.done[stepId]) return prev;
      const next = { ...prev, done: { ...prev.done, [stepId]: true } };
      save(next);
      return next;
    });
  }, []);

  const isDone = useCallback((stepId) => !!state.done[stepId], [state.done]);

  return useMemo(() => ({ position: state.position, savePosition, markDone, isDone }), [state, savePosition, markDone, isDone]);
}
