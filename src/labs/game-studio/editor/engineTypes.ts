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

/** What the player sees. Under the player, it follows. The first current camera in the tree is used. */
declare class Camera2D extends Node2D {
  current: boolean;
  /** 2 shows everything twice as big. */
  zoom: number;
  /** 0 follows exactly; around 5 lags gently behind. */
  smoothing: number;
  /** The camera never shows anything outside this rectangle. */
  get limitTopLeft(): Vec2; set limitTopLeft(v: { x: number; y: number });
  get limitBottomRight(): Vec2; set limitBottomRight(v: { x: number; y: number });
}

/** Text; its position is its top-left corner. */
declare class Label extends Node2D {
  text: string;
  fontSize: number;
  /** "#rrggbb" */
  color: string;
}

/** Its children are drawn on the screen, not in the world: a HUD. */
declare class CanvasLayer extends Node {
  /** Higher layers are drawn over lower ones. */
  layer: number;
}

/** The solid part of the body or area it is directly under: a rectangle or a circle. */
declare class CollisionShape2D extends Node2D {
  shape: 'rectangle' | 'circle';
  /** Width and height; a circle uses the width as its diameter. */
  get size(): Vec2; set size(v: { x: number; y: number });
}

/** Layers 1–16 as bits: layer n is 1 << (n − 1). */
declare class PhysicsBody2D extends Node2D {
  collisionLayer: number;
}

/** Solid and still: walls, floors, platforms. */
declare class StaticBody2D extends PhysicsBody2D {}

/** A body you move from a script: set velocity, then call moveAndSlide() in physicsUpdate. */
declare class CharacterBody2D extends PhysicsBody2D {
  collisionMask: number;
  /** Pixels per second. */
  get velocity(): Vec2; set velocity(v: { x: number; y: number });
  /** Move by velocity × dt, stopping at solid bodies and sliding along them. */
  moveAndSlide(): void;
  isOnFloor(): boolean;
  isOnWall(): boolean;
  isOnCeiling(): boolean;
  getSlideCollisions(): { body: PhysicsBody2D; normal: Vec2 }[];
}

/** Moves by itself: gravity pulls it, it keeps its velocity, it bounces. */
declare class RigidBody2D extends PhysicsBody2D {
  collisionMask: number;
  gravityScale: number;
  /** 0 stops dead, 1 bounces back as fast. */
  bounce: number;
  get velocity(): Vec2; set velocity(v: { x: number; y: number });
  /** Called when it hits a body. */
  onCollision(body: PhysicsBody2D, normal: Vec2): void;
}

/** Notices bodies coming in and going out, without stopping them. */
declare class Area2D extends Node2D {
  collisionMask: number;
  getOverlappingBodies(): PhysicsBody2D[];
  /** Called when a body comes in. */
  bodyEntered(body: PhysicsBody2D): void;
  /** Called when a body goes out. */
  bodyExited(body: PhysicsBody2D): void;
}

/** The project's physics settings. */
declare const physics: { readonly gravity: number };

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
