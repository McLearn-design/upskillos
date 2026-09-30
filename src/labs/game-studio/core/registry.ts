// The node registry: every node type, defined once.
//
// The Inspector, the save format, the Game API reference and the runtime are all
// generated from this (ADR 6). A property listed here that the runtime never reads
// fails a test, which is the "no fake controls" rule made checkable.

import type { PropValue } from './types';

export type PropType = 'number' | 'angle' | 'vec2' | 'bool' | 'string' | 'color' | 'texture';

export interface PropDef {
  name: string;
  type: PropType;
  default: PropValue;
  /** Shown in the Inspector and the API reference. Plain words: what it does. */
  help: string;
  min?: number;
  max?: number;
  step?: number;
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
    type: 'CharacterBody2D', base: 'Node2D', icon: '🏃', addable: true,
    help: 'A body you move from a script: set its velocity, then call moveAndSlide() in physicsUpdate. (Collision arrives in Phase 4.)',
    props: [],
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
  }
}
