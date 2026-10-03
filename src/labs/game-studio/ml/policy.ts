// A trained agent's policy, whichever way it was trained: a linear policy (the cross-entropy method, cem.ts)
// or a Q table over binned states (Q-learning, qlearning.ts). Both pick an action from what the agent sees.
import { act, type LinearPolicy } from './cem';
import { actQ, type QPolicy } from './qlearning';

export type AgentPolicy = LinearPolicy | QPolicy;
export const isQPolicy = (p: AgentPolicy): p is QPolicy => (p as QPolicy).kind === 'q';
export const actPolicy = (p: AgentPolicy, observation: number[]): number => (isQPolicy(p) ? actQ(p, observation) : act(p, observation));
