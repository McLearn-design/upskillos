// Messages between the editor and the game's iframe (ADR 3). Plain JSON (plus asset
// bytes), sent with postMessage. Stop is the editor removing the iframe, so it needs
// no message and works even when a game has hung.

import type { Project } from '../core/types';
import type { EnvSpec } from '../ml/env';
import type { AgentPolicy } from '../ml/policy';
import type { QEpisode, QLive, QOptions, QPolicy } from '../ml/qlearning';

/** Train in view: Q-learning inside the visible game. `speed` is game frames per drawn frame (1 is real time). */
export interface TrainInView { spec: EnvSpec; options: QOptions; speed: number }

export type ToRuntime =
  | { type: 'load'; project: Project; scene: string; assets: { path: string; mime: string; bytes: ArrayBuffer }[]; train?: TrainInView }
  /** Train in view: how fast to play (game frames per drawn frame). */
  | { type: 'trainSpeed'; speed: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'inspect'; path: string }
  /** A trained agent plays (ml/): every frameSkip frames it looks at the game and holds an action's keys. null stops it. */
  | { type: 'agent'; spec: EnvSpec; policy: AgentPolicy | null };

export type LogLevel = 'log' | 'info' | 'warn' | 'error';

export type FromRuntime =
  | { type: 'ready' }
  | { type: 'running'; scene: string }
  | { type: 'log'; level: LogLevel; text: string }
  | { type: 'error'; message: string; file: string | null; line: number | null; column: number | null; node: string | null; phase: string | null }
  | { type: 'state'; path: string; props: Record<string, unknown> | null }
  | { type: 'paused'; paused: boolean }
  /** Train in view: what the agent can do and sees, and how random play scores (measured headless first). */
  | { type: 'trainStart'; actions: string[]; observation: string[]; bins: number[][]; random: number }
  /** Train in view: what the learner is doing now (a few times a second). */
  | { type: 'trainLive'; live: QLive }
  | { type: 'trainEpisode'; episode: QEpisode }
  | { type: 'trainDone'; policy: QPolicy; score: number }
  | { type: 'trainError'; message: string };

/** Every message carries this, so the editor ignores anything else posted to the window. */
export const CHANNEL = 'upskillos-game-studio';
