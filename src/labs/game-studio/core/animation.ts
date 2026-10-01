// What an AnimationPlayer animation says a property is at a given moment. One function,
// used by the engine while the game runs and by the editor's timeline when you scrub, so
// what the timeline shows is what the game does (the specification's §39).
//
// Between two keys, numbers and vectors move in a straight line (linear interpolation:
// a + (b − a) · f, where f is how far through the gap the time is), colours move in a
// straight line in red, green and blue, and everything else (true/false, text, an image,
// a set of layers) jumps at each key. Before the first key a track holds the first
// value; after the last, the last.

import type { AnimationClip, AnimationTrack, KeyValue, NodeData, SceneData } from './types';
import { findNode, parentOf } from './project';
import { checkProp, propDef } from './registry';
import type { PropType } from './registry';

export type Blend = 'linear' | 'color' | 'step';

/** How a property of this type changes between keys. */
export function blendOf(type: PropType): Blend {
  return type === 'number' || type === 'angle' || type === 'vec2' ? 'linear' : type === 'color' ? 'color' : 'step';
}

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

function mix(a: KeyValue, b: KeyValue, f: number, blend: Blend): KeyValue {
  if (blend === 'step') return f < 1 ? a : b;
  if (blend === 'color' && typeof a === 'string' && typeof b === 'string') { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * f)); }
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * f;
  if (a && b && typeof a === 'object' && typeof b === 'object') return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  return f < 1 ? a : b;
}

/**
 * Times this close count as the same. Adding 1/60 thirty times gives 0.49999999999999994, not
 * 0.5; without this, a key at 0.5 s would be reached a frame late.
 */
const EPS = 1e-9;

/** A track's value at time t (keys are in time order). */
export function sampleTrack(track: AnimationTrack, t: number, blend: Blend): KeyValue | undefined {
  const k = track.keys;
  if (!k.length) return undefined;
  if (t <= k[0].time) return k[0].value;
  for (let i = 1; i < k.length; i++) {
    if (t < k[i].time - EPS) {
      const a = k[i - 1], b = k[i];
      return mix(a.value, b.value, (t - a.time) / (b.time - a.time), blend);
    }
  }
  return k[k.length - 1].value;
}

/** Where a playing clip is after `elapsed` seconds: looping wraps round, otherwise it stops at the end. */
export function clipTime(clip: AnimationClip, elapsed: number): { time: number; finished: boolean } {
  if (clip.length <= 0) return { time: 0, finished: !clip.loop };
  if (clip.loop) return { time: ((elapsed % clip.length) + clip.length) % clip.length, finished: false };
  return elapsed >= clip.length - EPS ? { time: clip.length, finished: true } : { time: Math.max(0, elapsed), finished: false };
}

/** Put a key in a track at `time`, replacing one already there (within a millisecond), keeping time order. */
export function withKey(track: AnimationTrack, time: number, value: KeyValue): AnimationTrack {
  const keys = track.keys.filter((k) => Math.abs(k.time - time) > 5e-4);
  keys.push({ time, value });
  keys.sort((a, b) => a.time - b.time);
  return { ...track, keys };
}

/** The node a track animates: its path is from the AnimationPlayer's parent ("." is the parent). */
export function trackTarget(scene: SceneData, playerId: string, path: string): NodeData | undefined {
  let cur = parentOf(scene, playerId);
  for (const name of path.split('/').filter((x) => x && x !== '.')) {
    cur = name === '..' ? (cur && parentOf(scene, cur.id)) : cur?.children.find((c) => c.name === name);
    if (!cur) return undefined;
  }
  return cur;
}

/** The track path from an AnimationPlayer's parent to a node: "." for the parent, "Player/Sprite" below it; null when the node is not under the parent. */
export function trackPath(scene: SceneData, playerId: string, nodeId: string): string | null {
  const base = parentOf(scene, playerId);
  if (!base) return null;
  const names: string[] = [];
  for (let n: NodeData | undefined = findNode(scene, nodeId); n; n = parentOf(scene, n.id)) {
    if (n.id === base.id) return names.length ? names.join('/') : '.';
    names.unshift(n.name);
  }
  return null;
}

/**
 * A copy of the scene with an animation's tracks set to their values at time t: what the game
 * shows at that moment (the engine's AnimationPlayer._apply does the same with the same sampling).
 * Tracks to missing nodes or properties, or with values a property refuses, are left out.
 */
export function applyClip(scene: SceneData, playerId: string, clip: AnimationClip, t: number): SceneData {
  const copy = JSON.parse(JSON.stringify(scene)) as SceneData;
  const time = clipTime(clip, t).time;
  for (const tr of clip.tracks) {
    const target = trackTarget(copy, playerId, tr.path);
    const def = target && propDef(target.type, tr.property);
    if (!target || !def) continue;
    const v = sampleTrack(tr, time, blendOf(def.type));
    if (v !== undefined && !checkProp(def, v)) target.props[tr.property] = v;
  }
  return copy;
}

/** The clips with a key set at `time` on path.property in the named clip, adding the track if it is new. */
export function setKey(clips: AnimationClip[], clipName: string, path: string, property: string, time: number, value: KeyValue): AnimationClip[] {
  return clips.map((c) => {
    if (c.name !== clipName) return c;
    const at = Math.min(Math.max(0, time), c.length);
    const i = c.tracks.findIndex((tr) => tr.path === path && tr.property === property);
    const tracks = i < 0 ? [...c.tracks, withKey({ path, property, keys: [] }, at, value)] : c.tracks.map((tr, j) => (j === i ? withKey(tr, at, value) : tr));
    return { ...c, tracks };
  });
}
