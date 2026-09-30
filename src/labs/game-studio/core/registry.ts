// The node registry: every node type, defined once.
//
// The Inspector, the save format, the Game API reference and the runtime are all
// generated from this (ADR 6). A property listed here that the runtime never reads
// fails a test, which is the "no fake controls" rule made checkable.

import type { PropValue } from './types';

/** 'enum' is one of `options`; 'layers' is a set of collision layers 1–16, stored as bits (layer n is bit n − 1). */
export type PropType = 'number' | 'angle' | 'vec2' | 'bool' | 'string' | 'color' | 'texture' | 'enum' | 'layers';

export interface PropDef {
  name: string;
  type: PropType;
  default: PropValue;
  /** Shown in the Inspector and the API reference. Plain words: what it does. */
  help: string;
  min?: number;
  max?: number;
  step?: number;
  /** For 'enum': the allowed values. */
  options?: string[];
}

export interface NodeTypeDef {
  type: string;
  /** The type this one extends: it has all of that type's properties too. */
  base: string | null;
  icon: string;
  help: string;
  /** Only the properties this type adds. */
  props: PropDef[];
  /** False for types only used as bases. */
  addable: boolean;
}

const TYPES: NodeTypeDef[] = [
  {
    type: 'Node', base: null, icon: '○', addable: true,
    help: 'The simplest node: a name in the tree, with children. Use it to group things or to hold a script.',
    props: [],
  },
  {
    type: 'Node2D', base: 'Node', icon: '✥', addable: true,
    help: 'A node with a place in 2D: position, rotation and scale. Its children move with it.',
    props: [
      { name: 'position', type: 'vec2', default: { x: 0, y: 0 }, help: 'Where it is, in pixels from its parent’s origin. +x is right, +y is down.', step: 1 },
      { name: 'rotation', type: 'angle', default: 0, help: 'How far it is turned, in radians (the Inspector shows degrees). Positive turns clockwise on screen.' },
      { name: 'scale', type: 'vec2', default: { x: 1, y: 1 }, help: 'How much it is stretched. 1 is normal size; negative flips it.', step: 0.1 },
      { name: 'visible', type: 'bool', default: true, help: 'Whether it and its children are drawn.' },
      { name: 'zIndex', type: 'number', default: 0, help: 'Drawing order: higher is drawn on top.', step: 1 },
    ],
  },
  {
    type: 'Sprite2D', base: 'Node2D', icon: '🖼', addable: true,
    help: 'Draws an image, centred on its position.',
    props: [
      { name: 'texture', type: 'texture', default: null, help: 'The image to draw (a project path, e.g. assets/player.png).' },
      { name: 'flipX', type: 'bool', default: false, help: 'Mirror the image left to right.' },
      { name: 'flipY', type: 'bool', default: false, help: 'Mirror the image top to bottom.' },
      { name: 'opacity', type: 'number', default: 1, min: 0, max: 1, step: 0.05, help: '1 is solid, 0 is invisible.' },
    ],
  },
  {
    type: 'Camera2D', base: 'Node2D', icon: '🎥', addable: true,
    help: 'What the player sees. Put it under the player and it follows. The first camera with current on is used.',
    props: [
      { name: 'current', type: 'bool', default: true, help: 'Whether this camera is the one used. The first current camera in the tree wins.' },
      { name: 'zoom', type: 'number', default: 1, min: 0.1, max: 10, step: 0.1, help: 'How close it is. 2 shows everything twice as big (half as much of the world).' },
      { name: 'smoothing', type: 'number', default: 0, min: 0, max: 30, step: 0.5, help: 'How gently it catches up: 0 follows exactly; around 5 lags a little behind, which feels smooth.' },
      { name: 'limitTopLeft', type: 'vec2', default: { x: -10000000, y: -10000000 }, step: 16, help: 'The camera never shows anything left of or above this point: set it to the level\u2019s top-left corner.' },
      { name: 'limitBottomRight', type: 'vec2', default: { x: 10000000, y: 10000000 }, step: 16, help: 'The camera never shows anything right of or below this point: set it to the level\u2019s bottom-right corner.' },
    ],
  },
  {
    type: 'Label', base: 'Node2D', icon: '🔤', addable: true,
    help: 'Text: a score, a message, a title. Its position is its top-left corner.',
    props: [
      { name: 'text', type: 'string', default: 'Label', help: 'The words shown. A script can change it: this.text = `Score: ${score}`.' },
      { name: 'fontSize', type: 'number', default: 24, min: 4, max: 256, step: 1, help: 'The height of the letters, in pixels.' },
      { name: 'color', type: 'color', default: '#ffffff', help: 'The colour of the text.' },
    ],
  },
  {
    type: 'CanvasLayer', base: 'Node', icon: '🗔', addable: true,
    help: 'Draws its children on the screen, not in the world: they stay put when the camera moves or zooms. Use it for a HUD.',
    props: [
      { name: 'layer', type: 'number', default: 1, min: -100, max: 100, step: 1, help: 'Which layer: higher layers are drawn on top of lower ones, and every layer is over the world.' },
    ],
  },
  {
    type: 'CollisionShape2D', base: 'Node2D', icon: '▭', addable: true,
    help: 'The solid part of a body or area: a rectangle or a circle, centred on its position. Put it under a StaticBody2D, CharacterBody2D, RigidBody2D or Area2D.',
    props: [
      { name: 'shape', type: 'enum', default: 'rectangle', options: ['rectangle', 'circle'], help: 'A rectangle, or a circle as wide as the size.' },
      { name: 'size', type: 'vec2', default: { x: 16, y: 16 }, step: 1, help: 'Width and height in pixels. A circle uses the width as its diameter.' },
    ],
  },
  {
    type: 'StaticBody2D', base: 'Node2D', icon: '🧱', addable: true,
    help: 'Something solid that does not move by itself: walls, floors, platforms. Other bodies stop against its collision shapes.',
    props: [
      { name: 'collisionLayer', type: 'layers', default: 1, help: 'The layers this body is on. Other bodies and areas only notice it if their mask includes one of these layers.' },
    ],
  },
  {
    type: 'CharacterBody2D', base: 'Node2D', icon: '🏃', addable: true,
    help: 'A body you move from a script: set velocity, then call moveAndSlide() in physicsUpdate. It stops at solid bodies, slides along them, and knows isOnFloor().',
    props: [
      { name: 'collisionLayer', type: 'layers', default: 1, help: 'The layers this body is on.' },
      { name: 'collisionMask', type: 'layers', default: 1, help: 'The layers it collides with: it stops only at bodies on one of these layers.' },
    ],
  },
  {
    type: 'RigidBody2D', base: 'Node2D', icon: '⚽', addable: true,
    help: 'A body that moves by itself: gravity pulls it, it keeps its velocity, and it bounces off solid bodies. Set its velocity from a script to throw it.',
    props: [
      { name: 'collisionLayer', type: 'layers', default: 1, help: 'The layers this body is on.' },
      { name: 'collisionMask', type: 'layers', default: 1, help: 'The layers it collides with.' },
      { name: 'gravityScale', type: 'number', default: 1, step: 0.1, help: 'How much gravity pulls it: 1 is normal, 0 floats (a Breakout ball), −1 falls up.' },
      { name: 'bounce', type: 'number', default: 0, min: 0, max: 1, step: 0.05, help: 'How much speed it keeps when it hits something: 0 stops dead against it, 1 bounces back as fast as it came.' },
    ],
  },
  {
    type: 'Area2D', base: 'Node2D', icon: '◌', addable: true,
    help: 'A region that notices bodies coming in and going out (its script\u2019s bodyEntered and bodyExited), without stopping them: pickups, goals, danger zones.',
    props: [
      { name: 'collisionMask', type: 'layers', default: 1, help: 'The layers of the bodies it notices.' },
    ],
  },
];

const BY_TYPE = new Map(TYPES.map((t) => [t.type, t]));

export function nodeType(type: string): NodeTypeDef {
  const t = BY_TYPE.get(type);
  if (!t) throw new Error(`Unknown node type "${type}"`);
  return t;
}

export const isNodeType = (type: string): boolean => BY_TYPE.has(type);

/** Every type, base types first. */
export const nodeTypes = (): NodeTypeDef[] => [...TYPES];

/** The chain from the root type down to this one: Node, Node2D, Sprite2D. */
export function lineage(type: string): NodeTypeDef[] {
  const out: NodeTypeDef[] = [];
  for (let t: NodeTypeDef | undefined = nodeType(type); t; t = t.base ? BY_TYPE.get(t.base) : undefined) out.unshift(t);
  return out;
}

/** All properties of a type, its bases' first. */
export function propsOf(type: string): PropDef[] {
  return lineage(type).flatMap((t) => t.props);
}

export function propDef(type: string, name: string): PropDef | undefined {
  return propsOf(type).find((p) => p.name === name);
}

/** Whether a type is (or extends) another: isA('Sprite2D', 'Node2D') is true. */
export function isA(type: string, base: string): boolean {
  return lineage(type).some((t) => t.type === base);
}

/** A property's value on a node: stored if set, else the default. Vectors are copied. */
export function propValue(type: string, props: Record<string, PropValue>, name: string): PropValue {
  const def = propDef(type, name);
  if (!def) throw new Error(`${type} has no property "${name}"`);
  const v = name in props ? props[name] : def.default;
  return v && typeof v === 'object' ? { ...v } : v;
}

/** Check a value against its property type; returns a message, or null if it fits. */
export function checkProp(def: PropDef, v: unknown): string | null {
  const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
  switch (def.type) {
    case 'number': case 'angle':
      if (!num(v)) return `${def.name} must be a number`;
      if (def.min !== undefined && (v as number) < def.min) return `${def.name} must be at least ${def.min}`;
      if (def.max !== undefined && (v as number) > def.max) return `${def.name} must be at most ${def.max}`;
      return null;
    case 'vec2':
      return v && typeof v === 'object' && num((v as { x: unknown }).x) && num((v as { y: unknown }).y) ? null : `${def.name} must be { x, y } with numbers`;
    case 'bool':
      return typeof v === 'boolean' ? null : `${def.name} must be true or false`;
    case 'string':
      return typeof v === 'string' ? null : `${def.name} must be text`;
    case 'color':
      return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? null : `${def.name} must be a colour like "#ff8800"`;
    case 'texture':
      return v === null || typeof v === 'string' ? null : `${def.name} must be an image path, or null`;
    case 'enum':
      return typeof v === 'string' && def.options!.includes(v) ? null : `${def.name} must be one of ${def.options!.map((o) => `"${o}"`).join(', ')}`;
    case 'layers':
      return Number.isInteger(v) && (v as number) >= 0 && (v as number) < 2 ** 16 ? null : `${def.name} must be a set of layers 1–16 (a whole number of bits, 0 to 65535)`;
  }
}
