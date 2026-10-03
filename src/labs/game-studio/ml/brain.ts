// What a trained agent does with what it sees: the policy alone, with no training code, so the engine and an
// exported game can use a brain without the trainer (and without the trainer's imports of the engine).
//
//   Q policy:       cut each binned reading into its bin, combine the bins into a state, take the row's best action
//   linear policy:  score each action as weights · observation + bias, take the highest

/** A table of Q(s, a) over binned states (Q-learning). `visits[s]` counts the updates made from state s. */
export interface QPolicy { kind: 'q'; bins: number[][]; table: number[][]; visits?: number[] }
/** One row of weights per action, the bias last (the cross-entropy method). */
export interface LinearPolicy { weights: number[][] }
export type AgentPolicy = LinearPolicy | QPolicy;

export const isQPolicy = (p: AgentPolicy): p is QPolicy => (p as QPolicy).kind === 'q';

/** Which bin a value falls in: how many of the (increasing) cut points are below it. */
export function binOf(value: number, cuts: number[]): number {
  let i = 0;
  while (i < cuts.length && value >= cuts[i]) i++;
  return i;
}

/** How many states the bins make: the product of (cuts + 1) over the binned readings. */
export const stateCount = (bins: number[][]): number => bins.reduce((n, c) => (c.length ? n * (c.length + 1) : n), 1);

/** The state an observation is in: its readings' bins combined, the first reading the most significant. */
export function stateOf(observation: number[], bins: number[][]): number {
  let s = 0;
  bins.forEach((cuts, i) => { if (cuts.length) s = s * (cuts.length + 1) + binOf(observation[i], cuts); });
  return s;
}

/** The greedy action in a state: the first of the highest Q values. */
export function greedy(row: number[]): number {
  let best = 0;
  for (let a = 1; a < row.length; a++) if (row[a] > row[best]) best = a;
  return best;
}

/** The action a Q policy takes for an observation. */
export const actQ = (policy: QPolicy, observation: number[]): number => greedy(policy.table[stateOf(observation, policy.bins)]);

/** The action a linear policy takes for an observation. */
export function actLinear(policy: LinearPolicy, observation: number[]): number {
  let best = 0, bestScore = -Infinity;
  policy.weights.forEach((w, a) => {
    let s = w[w.length - 1];
    for (let i = 0; i < observation.length; i++) s += w[i] * observation[i];
    if (s > bestScore) { bestScore = s; best = a; }
  });
  return best;
}

export const actPolicy = (p: AgentPolicy, observation: number[]): number => (isQPolicy(p) ? actQ(p, observation) : actLinear(p, observation));
