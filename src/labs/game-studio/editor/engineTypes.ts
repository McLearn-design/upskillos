// The engine's Game API as TypeScript declarations, for the script editor's
// completion and hover. It describes exactly what engine/ provides to scripts (ADR 5):
// nothing here that a script cannot use, and nothing a script can use missing.

export const ENGINE_DTS = `
/** A 2D vector. Change .x and .y directly; methods return new vectors. */
declare class Vec2 {
  constructor(x?: number, y?: number);
  x: number; y: number;
  add(v: { x: number; y: number }): Vec2;
  sub(v: { x: number; y: number }): Vec2;
  scale(k: number): Vec2;
  dot(v: { x: number; y: number }): number;
  length(): number;
  /** The same direction with length 1 (zero stays zero). */
  normalized(): Vec2;
  distanceTo(v: { x: number; y: number }): number;
  /** Radians from +x, clockwise on screen. */
  angle(): number;
  lerp(v: { x: number; y: number }, t: number): Vec2;
  set(x: number, y: number): this;
  copy(): Vec2;
}

/** The simplest node: a name in the tree, with children. */
declare class Node {
  name: string;
  readonly parent: Node | null;
  readonly children: Node[];
  /** "Player/Sprite" from the scene root. */
  readonly path: string;
  /** A node by a path relative to this one: "Sprite", "../Enemy". Throws if there is none. */
  get<T extends Node = Node>(path: string): T;
  /** Like get, but null when there is no such node. */
  find<T extends Node = Node>(path: string): T | null;
  /** Add a child while the game runs; it gets ready() straight away. */
  addChild(node: Node): Node;
  /** Remove this node at the end of the frame. */
  queueFree(): void;
  /** Once, after this node and its children are in the game. */
  ready(): void;
  /** Every frame. dt: seconds since the last frame. */
  update(dt: number): void;
  /** At a fixed 60 times a second, before physics moves things. */
  physicsUpdate(dt: number): void;
  /** Once, when removed. */
  destroyed(): void;
}

/** A node with a place in 2D. +x right, +y down; rotation in radians, clockwise on screen. */
declare class Node2D extends Node {
  get position(): Vec2; set position(v: { x: number; y: number });
  get scale(): Vec2; set scale(v: { x: number; y: number });
  rotation: number;
  rotationDegrees: number;
  visible: boolean;
  zIndex: number;
  get globalPosition(): Vec2; set globalPosition(v: { x: number; y: number });
}

/** Draws an image, centred on its position. */
declare class Sprite2D extends Node2D {
  /** A project path, e.g. "assets/player.png". */
  texture: string | null;
  flipX: boolean; flipY: boolean;
  /** 1 is solid, 0 is invisible. */
  opacity: number;
}

/** A body you move from a script: set velocity, then call moveAndSlide(). */
declare class CharacterBody2D extends Node2D {
  /** Pixels per second. */
  get velocity(): Vec2; set velocity(v: { x: number; y: number });
  /** Move by velocity × the current step's time. */
  moveAndSlide(): void;
}

/** Input actions, from Project › Input map. */
declare const input: {
  isPressed(action: string): boolean;
  isJustPressed(action: string): boolean;
  isJustReleased(action: string): boolean;
  /** −1, 0 or 1. */
  axis(negative: string, positive: string): number;
  /** A direction from four actions, length at most 1. */
  vector(left: string, right: string, up: string, down: string): Vec2;
};

/** The running scene. */
declare const scene: { readonly root: Node; get<T extends Node = Node>(path: string): T; find<T extends Node = Node>(path: string): T | null };

declare const time: { readonly now: number; readonly frame: number };

declare const math: {
  vec(x?: number, y?: number): Vec2;
  clamp(v: number, lo: number, hi: number): number;
  lerp(a: number, b: number, t: number): number;
  degToRad(d: number): number;
  radToDeg(r: number): number;
  randRange(lo: number, hi: number): number;
};
`;
