// Training off the editor's page (ml/cem.ts on ml/env.ts): the game's scripts expect globals such as Node
// and scene, which must not touch the page, and training takes seconds to minutes.
// In:  { project, spec, options }       Out: { type: 'random' | 'generation' | 'done' | 'error', … }
import { GameEnv } from './env';
import { cem, evaluate, type CemOptions } from './cem';
import { loadScripts } from '../runtime/scripts';
import type { Project } from '../core/types';
import type { EnvSpec } from './env';

self.onmessage = async (e: MessageEvent<{ project: Project; spec: EnvSpec; options: CemOptions }>) => {
  const { project, spec, options } = e.data;
  try {
    const env = await GameEnv.create(project, spec, async (p) => (await loadScripts(p.scripts)).classes);
    postMessage({ type: 'random', score: evaluate(env, 'random', 3, 7) });
    const run = cem(env, options);
    let r = run.next();
    for (; !r.done; r = run.next()) postMessage({ type: 'generation', ...r.value });
    postMessage({ type: 'done', policy: r.value, score: evaluate(env, r.value, 3, 7) });
  } catch (err) {
    postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
