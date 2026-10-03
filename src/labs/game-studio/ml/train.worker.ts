// Training off the editor's page (ml/qlearning.ts or ml/cem.ts on ml/env.ts): the game's scripts expect globals
// such as Node and scene, which must not touch the page, and training takes seconds to minutes.
// In:  { project, spec, method, options }
// Out: { type: 'describe' | 'random' | 'generation' | 'episode' | 'done' | 'error', … }
import { GameEnv } from './env';
import { cem, evaluate, type CemOptions } from './cem';
import { evaluateQ, qLearning, type QOptions } from './qlearning';
import { loadScripts } from '../runtime/scripts';
import type { Project } from '../core/types';
import type { EnvSpec } from './env';

type Job = { project: Project; spec: EnvSpec } & ({ method: 'q'; options: QOptions } | { method: 'cem'; options: CemOptions });

self.onmessage = async (e: MessageEvent<Job>) => {
  const job = e.data;
  try {
    const env = await GameEnv.create(job.project, job.spec, async (p) => (await loadScripts(p.scripts)).classes);
    // What the agent can do and sees, by name, and its bins: a script agent's come from its script.
    postMessage({ type: 'describe', actions: env.actionNames, observation: env.observationNames, bins: env.bins });
    postMessage({ type: 'random', score: evaluate(env, 'random', 3, 7) });
    if (job.method === 'q') {
      const run = qLearning(env, job.options);
      let r = run.next();
      // Each episode's numbers, and on a check a copy of the table so far, for the dialog to draw.
      for (; !r.done; r = run.next()) postMessage({ type: 'episode', ...r.value });
      postMessage({ type: 'done', policy: r.value, score: evaluateQ(env, r.value, 3, 7) });
    } else {
      const run = cem(env, job.options);
      let r = run.next();
      for (; !r.done; r = run.next()) postMessage({ type: 'generation', ...r.value });
      postMessage({ type: 'done', policy: r.value, score: evaluate(env, r.value, 3, 7) });
    }
  } catch (err) {
    postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
