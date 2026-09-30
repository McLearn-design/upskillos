// The node classes a script extends (ADR 4):
//
//   export default class Player extends CharacterBody2D {
//     ready() { … }
//     update(dt) { … }
//     physicsUpdate(dt) { this.moveAndSlide(); }
//   }
//
// Every property here is also in the registry (core/registry.ts); the saved scene
// sets them after the constructor runs, so a script's own fields (speed = 200) are
// kept and the scene's values win for registered properties.

import { Vec2 } from './vec2';
import { IDENTITY, local, multiply, apply, type Mat2D } from '../core/math2d';
import type { Game } from './game';

export class Node {
  name = 'Node';
  /** Set by the engine. */
  _game: Game | null = null;
  _parent: Node | null = null;
  _children: Node[] = [];
  /** Set when a lifecycle method throws: the node stops being updated. */
  _broken = false;
  _freed = false;
  /** The project path of this node's script, for error messages. */
  _script: string | null = null;

  get parent(): Node | null { return this._parent; }
  get children(): Node[] { return [...this._children]; }

  /** The node's path from the scene root: "Player/Sprite". */
  get path(): string {
    const names: string[] = [];
    for (let n: Node | null = this; n && n._parent; n = n._parent) names.unshift(n.name);
    return names.join('/') || '.';
  }

  /** A node by a path relative to this one: "Sprite", "../Enemy", "Weapon/Muzzle". Throws if there is none. */
  get<T extends Node = Node>(path: string): T {
    let cur: Node | null = this;
    for (const part of path.split('/').filter((p) => p && p !== '.')) {
      cur = part === '..' ? cur._parent : cur._children.find((c) => c.name === part) ?? null;
      if (!cur) throw new Error(`${this.path === '.' ? 'The root' : `"${this.path}"`} has no node at "${path}"`);
    }
    return cur as T;
  }

  /** Like get, but null instead of an error when there is no such node. */
  find<T extends Node = Node>(path: string): T | null {
    try { return this.get<T>(path); } catch { return null; }
  }

  /** Add a child while the game runs (a spawned bullet, say). It gets ready() straight away. */
  addChild(node: Node): Node {
    if (node._parent) throw new Error(`"${node.name}" already has a parent`);
    const taken = new Set(this._children.map((c) => c.name));
    if (taken.has(node.name)) { let i = 2; while (taken.has(`${node.name}${i}`)) i++; node.name = `${node.name}${i}`; }
    node._parent = this;
    this._children.push(node);
    this._game?._attached(node);
    return node;
  }

  /** Remove this node (and its children) at the end of the frame. */
  queueFree(): void { this._game?._queueFree(this); }

  // Lifecycle (ADR 4). Override these in a script.
  ready(): void {}
  update(_dt: number): void {}
  physicsUpdate(_dt: number): void {}
  destroyed(): void {}
}

export class Node2D extends Node {
  name = 'Node2D';
  private _position = new Vec2();
  private _scale = new Vec2(1, 1);
  /** Radians, clockwise on screen. */
  rotation = 0;
  visible = true;
  zIndex = 0;

  /** Where it is relative to its parent. Assign a new { x, y } or change .x and .y. */
  get position(): Vec2 { return this._position; }
  set position(v: { x: number; y: number }) { this._position = new Vec2(v.x, v.y); }

  get scale(): Vec2 { return this._scale; }
  set scale(v: { x: number; y: number }) { this._scale = new Vec2(v.x, v.y); }

  get rotationDegrees(): number { return (this.rotation * 180) / Math.PI; }
  set rotationDegrees(d: number) { this.rotation = (d * Math.PI) / 180; }

  /** Parent's world transform times this node's local one. */
  get worldTransform(): Mat2D {
    let m = local(this._position, this.rotation, this._scale);
    // Up the tree to the scene root, or to a CanvasLayer: its children are placed on the screen.
    for (let p = this._parent; p && !(p instanceof CanvasLayer); p = p._parent) if (p instanceof Node2D) m = multiply(local(p._position, p.rotation, p._scale), m);
    return m;
  }

  /** Where it is in the world (the scene's coordinates). */
  get globalPosition(): Vec2 {
    const m = this._parent ? parentWorld(this) : IDENTITY;
    return Vec2.from(apply(m, this._position));
  }
  set globalPosition(v: { x: number; y: number }) {
    const m = parentWorld(this);
    const det = m[0] * m[3] - m[1] * m[2];
    const dx = v.x - m[4], dy = v.y - m[5];
    this._position = new Vec2((m[3] * dx - m[2] * dy) / det, (-m[1] * dx + m[0] * dy) / det);
  }
}

function parentWorld(n: Node): Mat2D {
  for (let p = n._parent; p && !(p instanceof CanvasLayer); p = p._parent) if (p instanceof Node2D) return p.worldTransform;
  return IDENTITY;
}

/** Draws its children on the screen, not in the world: a HUD stays put when the camera moves. */
export class CanvasLayer extends Node {
  name = 'CanvasLayer';
  /** Higher layers are drawn over lower ones; every layer is over the world. */
  layer = 1;
}

export class Sprite2D extends Node2D {
  name = 'Sprite2D';
  /** The image's project path, e.g. "assets/player.png". */
  texture: string | null = null;
  flipX = false;
  flipY = false;
  opacity = 1;
}

/** What the player sees. Under the player, it follows. The first current camera in the tree is used. */
export class Camera2D extends Node2D {
  name = 'Camera2D';
  current = true;
  /** 2 shows everything twice as big. */
  zoom = 1;
  /** 0 follows exactly; higher values catch up more gently. */
  smoothing = 0;
}

/** Text. Its position is its top-left corner. */
export class Label extends Node2D {
  name = 'Label';
  text = 'Label';
  fontSize = 24;
  color = '#ffffff';
}

export class CharacterBody2D extends Node2D {
  name = 'CharacterBody2D';
  private _velocity = new Vec2();

  /** Pixels per second. moveAndSlide() moves by this. */
  get velocity(): Vec2 { return this._velocity; }
  set velocity(v: { x: number; y: number }) { this._velocity = new Vec2(v.x, v.y); }

  /**
   * Move by velocity × the current step's time (1/60 s in physicsUpdate, the frame
   * time in update). Phase 4 adds collision: it will stop and slide along what it hits.
   */
  moveAndSlide(): void {
    const dt = this._game?.stepDelta ?? 0;
    this.position = this.position.add(this._velocity.scale(dt));
  }
}

/** The built-in classes, by registry type name. */
export const NODE_CLASSES: Record<string, typeof Node> = { Node, Node2D, Sprite2D, Camera2D, Label, CanvasLayer, CharacterBody2D };

/** The registered type a runtime node is: its class, or the nearest built-in class it extends. */
export function nodeTypeOf(n: Node): string {
  for (let proto = Object.getPrototypeOf(n); proto; proto = Object.getPrototypeOf(proto)) {
    const hit = Object.entries(NODE_CLASSES).find(([, C]) => C.prototype === proto);
    if (hit) return hit[0];
  }
  return 'Node';
}
