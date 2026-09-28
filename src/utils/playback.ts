// Shared step playback for tools that record a sequence of steps and play them
// back: CodeLens (program execution) and MeshLab (geometry algorithm traces).
// One definition of speed, so the two feel the same and cannot drift apart.

import { useEffect } from 'react';

/** How often to advance, and by how many steps each time. */
export interface SpeedSetting { interval: number; steps: number }

/** Speeds for stepping through code: one step at a time, up to two every 60 ms. */
export const CODE_SPEEDS: Record<string, SpeedSetting> = {
  '0.5x': { interval: 1200, steps: 1 },
  '1x': { interval: 600, steps: 1 },
  '2x': { interval: 250, steps: 1 },
  '5x': { interval: 100, steps: 1 },
  '10x': { interval: 60, steps: 2 },
};

/**
 * Geometry traces can have thousands of steps (one per vertex), so they add
 * two faster speeds that advance many steps per tick.
 */
export const GEOMETRY_SPEEDS: Record<string, SpeedSetting> = {
  ...CODE_SPEEDS,
  '50x': { interval: 40, steps: 10 },
  '200x': { interval: 30, steps: 40 },
};

/** The step after one tick. Stops on the last step. */
export function advance(step: number, total: number, by: number): { step: number; done: boolean } {
  const next = step + by;
  if (next >= total - 1) return { step: Math.max(0, total - 1), done: true };
  return { step: next, done: false };
}

/**
 * Advance `step` on a timer while `playing`. `jump`, when given, replaces the
 * fixed step count (MeshLab's "by phase" mode jumps to the next phase start).
 */
export function usePlaybackTicker(
  playing: boolean,
  speed: SpeedSetting,
  total: number,
  setStep: (fn: (s: number) => number) => void,
  setPlaying: (p: boolean) => void,
  jump?: (s: number) => number,
): void {
  const { interval, steps } = speed;
  useEffect(() => {
    if (!playing || total <= 0) return;
    const id = setInterval(() => {
      setStep((s) => {
        const r = jump ? advance(s, total, Math.max(1, jump(s) - s)) : advance(s, total, steps);
        if (r.done) setPlaying(false);
        return r.step;
      });
    }, interval);
    return () => clearInterval(id);
  }, [playing, interval, steps, total, setStep, setPlaying, jump]);
}
