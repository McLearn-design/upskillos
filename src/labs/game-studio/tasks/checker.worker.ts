// Runs a task's checks off the editor's page. Play checks run the learner's game, whose scripts
// expect globals such as Node, scene and input; in a worker those cannot clash with the page's own
// (the browser's Node, for one). Messages: { id, taskId, project, editor } → { id, results }.

import { evaluateTask } from './checker';
import { taskById } from './index';
import { loadScripts } from '../runtime/scripts';
import type { Project } from '../core/types';
import type { EditorView } from './types';

self.onmessage = async (e: MessageEvent<{ id: number; taskId: string; project: Project; editor: EditorView }>) => {
  const { id, taskId, project, editor } = e.data;
  const task = taskById(taskId);
  if (!task) { postMessage({ id, results: [] }); return; }
  const results = await evaluateTask(task, project, editor, async (p) => (await loadScripts(p.scripts)).classes);
  postMessage({ id, results });
};
