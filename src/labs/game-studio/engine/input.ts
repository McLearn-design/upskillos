// Input as named actions (ADR 7). Scripts ask about actions, never keys:
//
//   input.isPressed('jump')        held down this frame
//   input.isJustPressed('jump')    went down since the last frame
//   input.isJustReleased('jump')   came up since the last frame
//   input.axis('move_left', 'move_right')          −1, 0 or 1
//   input.vector('move_left', 'move_right', 'move_up', 'move_down')   length at most 1
//
// Keys are KeyboardEvent.code values ("ArrowLeft", "KeyA", "Space"), so they mean
// the same key whatever the keyboard layout.

import { Vec2 } from './vec2';
import type { InputAction } from '../core/types';

export class Input {
  private held = new Set<string>();
  private down = new Set<string>();
  private up = new Set<string>();
  private actions = new Map<string, string[]>();

  constructor(actions: InputAction[]) {
    for (const a of actions) this.actions.set(a.name, [...a.keys]);
  }

  /** Feed a key event (from the page). */
  key(code: string, pressed: boolean): void {
    if (pressed && !this.held.has(code)) { this.held.add(code); this.down.add(code); }
    if (!pressed && this.held.has(code)) { this.held.delete(code); this.up.add(code); }
  }

  /** Forget "just" presses and releases: called once at the end of each frame. */
  endFrame(): void { this.down.clear(); this.up.clear(); }

  /** Release everything (the game lost focus, so keys would otherwise stick). */
  releaseAll(): void { for (const k of this.held) this.up.add(k); this.held.clear(); }

  private keys(action: string): string[] {
    const k = this.actions.get(action);
    if (!k) throw new Error(`There is no input action "${action}". Add it in Project › Input map.`);
    return k;
  }

  isPressed(action: string): boolean { return this.keys(action).some((k) => this.held.has(k)); }
  isJustPressed(action: string): boolean { return this.keys(action).some((k) => this.down.has(k)); }
  isJustReleased(action: string): boolean { return this.keys(action).some((k) => this.up.has(k)); }

  axis(negative: string, positive: string): number {
    return Number(this.isPressed(positive)) - Number(this.isPressed(negative));
  }

  /** A direction from four actions, normalized so diagonals are not faster. */
  vector(left: string, right: string, up: string, down: string): Vec2 {
    return new Vec2(this.axis(left, right), this.axis(up, down)).normalized();
  }

  get actionNames(): string[] { return [...this.actions.keys()]; }
}
