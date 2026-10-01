// What the agent sees and earns in Breakout (examples/breakout.ts), as an environment spec.
//
// It sees where the ball is across from the paddle (the ball's x minus the paddle's), the ball's height
// and velocity, scaled to about −1 to 1. Each step it holds Space (to launch the ball when it rests on
// the paddle) and left or right. It earns 1 for every brick (10 points) and loses 3 for every ball that
// falls past the paddle, so keeping the ball in play pays. An episode ends when the balls run out or the
// wall is cleared, or after 1200 steps (80 seconds of play).
import type { EnvSpec } from './env';

export const BREAKOUT_SPEC: EnvSpec = {
  actions: [['jump', 'move_left'], ['jump', 'move_right']],
  observation: [
    { path: 'Ball:position.x', minus: 'Paddle:position.x', scale: 1 / 480 },
    { path: 'Ball:position.y', scale: 1 / 540 },
    { path: 'Ball:velocity.x', scale: 1 / 360 },
    { path: 'Ball:velocity.y', scale: 1 / 360 },
  ],
  reward: [{ path: 'Ball:score', scale: 0.1 }, { path: 'Ball:lives', scale: 3 }],
  terminated: [{ path: 'Ball:lives', op: '<=', value: 0 }, { path: 'Ball:left', op: '<=', value: 0 }],
  frameSkip: 4,
  maxSteps: 1200,
};
