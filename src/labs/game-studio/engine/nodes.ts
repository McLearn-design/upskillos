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
import type { WorldShape } from './physics';
import type { AnimationClip } from '../core/types';
import { blendOf, clipTime, sampleTrack } from '../core/animation';
import { propDef } from '../core/registry';

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

/** Changes other nodes' properties over time, from keyframes (core/animation.ts does the sampling). */
export class AnimationPlayer extends Node {
  name = 'AnimationPlayer';
  animations: AnimationClip[] = [];
  autoplay = '';
  speedScale = 1;
  _playing = false;
  _clip = '';
  _elapsed = 0;

  get currentAnimation(): string { return this._clip; }
  get currentTime(): number { const c = this._current(); return c ? clipTime(c, this._elapsed).time : 0; }

  play(name?: string): void {
    if (name !== undefined && name !== this._clip) {
      if (!this.animations.some((a) => a.name === name)) throw new Error(`"${this.path}" has no animation "${name}". It has: ${this.animations.map((a) => `"${a.name}"`).join(', ') || 'none'}`);
      this._clip = name; this._elapsed = 0;
    } else if (!this._clip) {
      throw new Error(`"${this.path}": play() needs an animation name the first time`);
    } else if (!this._playing) {
      const c = this._current();
      if (c && !c.loop && this._elapsed >= c.length) this._elapsed = 0;
    }
    this._playing = true;
    this._apply();
  }

  pause(): void { this._playing = false; }
  stop(): void { this._playing = false; this._elapsed = 0; }
  seek(time: number): void { this._elapsed = time; this._apply(); }
  isPlaying(): boolean { return this._playing; }

  /** Called when an animation that does not loop reaches its end. */
  animationFinished(_name: string): void {}

  _current(): AnimationClip | undefined { return this.animations.find((a) => a.name === this._clip); }

  /** Move on by dt seconds and set every track's property. True when an animation that does not loop has just ended. */
  _advance(dt: number): boolean {
    const c = this._current();
    if (!this._playing || !c) return false;
    this._elapsed += dt * this.speedScale;
    const { finished } = clipTime(c, this._elapsed);
    this._apply();
    if (finished) { this._playing = false; return true; }
    return false;
  }

  /** Set each track's property to its value at the current time. Paths start at this player's parent. */
  _apply(): void {
    const c = this._current();
    if (!c) return;
    const t = clipTime(c, this._elapsed).time;
    for (const tr of c.tracks) {
      const target = this._parent?.find(tr.path);
      if (!target) throw new Error(`Animation "${c.name}": there is no node "${tr.path}" (track paths start at the AnimationPlayer's parent)`);
      const def = propDef(nodeTypeOf(target), tr.property);
      if (!def) throw new Error(`Animation "${c.name}": ${nodeTypeOf(target)} "${tr.path}" has no property "${tr.property}"`);
      const v = sampleTrack(tr, t, blendOf(def.type));
      if (v === undefined) continue;
      (target as unknown as Record<string, unknown>)[tr.property] = def.type === 'vec2' ? new Vec2((v as Vec2).x, (v as Vec2).y) : v;
    }
  }
}

/** One named animation: pictures shown in turn, fps times a second. */
export interface SpriteAnimation { name: string; fps: number; loop: boolean; frames: string[] }

/** Draws a picture that changes: the current animation's frames, in turn. */
export class AnimatedSprite2D extends Node2D {
  name = 'AnimatedSprite2D';
  frames: SpriteAnimation[] = [];
  animation = 'default';
  playing = true;
  speedScale = 1;
  frame = 0;
  flipX = false;
  flipY = false;
  opacity = 1;
  /** Seconds into the current frame. */
  _elapsed = 0;

  /** Play an animation by name (or carry on with the current one). A finished animation that does not loop starts again. */
  play(name?: string): void {
    if (name !== undefined && name !== this.animation) {
      if (!this.frames.some((a) => a.name === name)) throw new Error(`"${this.path}" has no animation "${name}". It has: ${this.frames.map((a) => `"${a.name}"`).join(', ') || 'none'}`);
      this.animation = name; this.frame = 0; this._elapsed = 0;
    } else if (!this.playing) {
      const a = this._current();
      if (a && !a.loop && this.frame >= a.frames.length - 1) { this.frame = 0; this._elapsed = 0; }
    }
    this.playing = true;
  }

  /** Stop where it is; play() carries on from here. */
  pause(): void { this.playing = false; }

  /** Stop, and go back to the first picture. */
  stop(): void { this.playing = false; this.frame = 0; this._elapsed = 0; }

  isPlaying(): boolean { return this.playing; }

  /** Called when an animation that does not loop reaches its last picture. */
  animationFinished(_name: string): void {}

  _current(): SpriteAnimation | undefined { return this.frames.find((a) => a.name === this.animation); }

  /** The picture showing now, or null when there is none (no such animation, or no pictures). */
  _texture(): string | null {
    const a = this._current();
    if (!a || !a.frames.length) return null;
    return a.frames[Math.min(Math.max(0, Math.floor(this.frame)), a.frames.length - 1)];
  }

  /** Move on by dt seconds. True when an animation that does not loop has just finished. */
  _advance(dt: number): boolean {
    const a = this._current();
    if (!this.playing || !a || !a.frames.length) return false;
    this.frame = Math.min(Math.max(0, Math.floor(this.frame)), a.frames.length - 1);
    this._elapsed += dt * this.speedScale;
    const each = 1 / a.fps;
    while (this._elapsed >= each - 1e-9) {
      this._elapsed -= each;
      if (this.frame + 1 < a.frames.length) this.frame++;
      else if (a.loop) this.frame = 0;
      else { this.playing = false; this._elapsed = 0; return true; }
    }
    return false;
  }
}

/** What the player sees. Under the player, it follows. The first current camera in the tree is used. */
export class Camera2D extends Node2D {
  name = 'Camera2D';
  current = true;
  /** 2 shows everything twice as big. */
  zoom = 1;
  /** 0 follows exactly; higher values catch up more gently. */
  smoothing = 0;
  private _limitTopLeft = new Vec2(-10000000, -10000000);
  private _limitBottomRight = new Vec2(10000000, 10000000);
  /** The camera never shows anything outside this rectangle. */
  get limitTopLeft(): Vec2 { return this._limitTopLeft; }
  set limitTopLeft(v: { x: number; y: number }) { this._limitTopLeft = new Vec2(v.x, v.y); }
  get limitBottomRight(): Vec2 { return this._limitBottomRight; }
  set limitBottomRight(v: { x: number; y: number }) { this._limitBottomRight = new Vec2(v.x, v.y); }
}

/** Text. Its position is its top-left corner. */
export class Label extends Node2D {
  name = 'Label';
  text = 'Label';
  fontSize = 24;
  color = '#ffffff';
}

/** A rectangle or circle: the solid part of the body or area it is directly under. */
export class CollisionShape2D extends Node2D {
  name = 'CollisionShape2D';
  shape: 'rectangle' | 'circle' = 'rectangle';
  private _size = new Vec2(16, 16);
  /** Width and height; a circle uses the width as its diameter. */
  get size(): Vec2 { return this._size; }
  set size(v: { x: number; y: number }) { this._size = new Vec2(v.x, v.y); }

  /** Where it is in the world, scaled by its body's scale (rectangles stay axis-aligned). */
  worldShape(): WorldShape {
    const m = this.worldTransform, sx = Math.hypot(m[0], m[1]), det = m[0] * m[3] - m[1] * m[2];
    const sy = sx === 0 ? 0 : Math.abs(det / sx);
    return this.shape === 'circle'
      ? { kind: 'circle', x: m[4], y: m[5], r: (this._size.x * sx) / 2 }
      : { kind: 'rectangle', x: m[4], y: m[5], hw: (this._size.x * sx) / 2, hh: (this._size.y * sy) / 2 };
  }
}

/** What every body shares: the layers it is on, and its shapes (its direct CollisionShape2D children). */
export class PhysicsBody2D extends Node2D {
  collisionLayer = 1;
  shapes(): WorldShape[] {
    return this._children.filter((c): c is CollisionShape2D => c instanceof CollisionShape2D && !c._freed).map((c) => c.worldShape());
  }
}

/** Solid and still: walls, floors, platforms. */
export class StaticBody2D extends PhysicsBody2D {
  name = 'StaticBody2D';
}

export interface SlideCollision { body: PhysicsBody2D; normal: Vec2 }

export class CharacterBody2D extends PhysicsBody2D {
  name = 'CharacterBody2D';
  collisionMask = 1;
  private _velocity = new Vec2();
  _onFloor = false; _onWall = false; _onCeiling = false;
  _collisions: SlideCollision[] = [];

  /** Pixels per second. moveAndSlide() moves by this. */
  get velocity(): Vec2 { return this._velocity; }
  set velocity(v: { x: number; y: number }) { this._velocity = new Vec2(v.x, v.y); }

  /**
   * Move by velocity × the current step's time (1/60 s in physicsUpdate). It stops at
   * solid bodies on its mask's layers and slides along them: the part of the velocity
   * going into a surface is removed, the rest is kept. Afterwards isOnFloor(),
   * isOnWall() and isOnCeiling() say what it touched.
   */
  moveAndSlide(): void {
    const g = this._game;
    this._onFloor = this._onWall = this._onCeiling = false;
    this._collisions = [];
    if (!g) return;
    g._moveBody(this, (other, n) => {
      const vn = this._velocity.dot(n);
      if (vn < 0) this._velocity = this._velocity.sub(n.scale(vn));
      if (n.y < -0.7) this._onFloor = true; else if (n.y > 0.7) this._onCeiling = true; else this._onWall = true;
      if (!this._collisions.some((c) => c.body === other)) this._collisions.push({ body: other, normal: n });
    });
  }

  /** Standing on something (touched a surface facing up in the last moveAndSlide). */
  isOnFloor(): boolean { return this._onFloor; }
  isOnWall(): boolean { return this._onWall; }
  isOnCeiling(): boolean { return this._onCeiling; }
  /** What the last moveAndSlide touched, and the normal of each surface (pointing away from it). */
  getSlideCollisions(): SlideCollision[] { return [...this._collisions]; }
}

/** Moves by itself: pulled by gravity, keeps its velocity, bounces off solid bodies. */
export class RigidBody2D extends PhysicsBody2D {
  name = 'RigidBody2D';
  collisionMask = 1;
  /** 1 is normal gravity; 0 floats. */
  gravityScale = 1;
  /** Speed kept on a hit: 0 stops, 1 bounces back as fast. */
  bounce = 0;
  private _velocity = new Vec2();
  get velocity(): Vec2 { return this._velocity; }
  set velocity(v: { x: number; y: number }) { this._velocity = new Vec2(v.x, v.y); }
  /** Override in a script: called when it hits a body, with the surface's normal. */
  onCollision(_body: PhysicsBody2D, _normal: Vec2): void {}
}

/** Notices bodies coming in and going out, without stopping them. */
export class Area2D extends Node2D {
  name = 'Area2D';
  collisionMask = 1;
  _inside = new Set<PhysicsBody2D>();
  shapes(): WorldShape[] {
    return this._children.filter((c): c is CollisionShape2D => c instanceof CollisionShape2D && !c._freed).map((c) => c.worldShape());
  }
  /** The bodies inside it now. */
  getOverlappingBodies(): PhysicsBody2D[] { return [...this._inside]; }
  /** Override in a script: called when a body comes in. */
  bodyEntered(_body: PhysicsBody2D): void {}
  /** Override in a script: called when a body goes out (or is removed). */
  bodyExited(_body: PhysicsBody2D): void {}
}

/** The built-in classes, by registry type name. */
export const NODE_CLASSES: Record<string, typeof Node> = { Node, Node2D, Sprite2D, AnimatedSprite2D, AnimationPlayer, Camera2D, Label, CanvasLayer, CollisionShape2D, StaticBody2D, CharacterBody2D, RigidBody2D, Area2D };

/** The registered type a runtime node is: its class, or the nearest built-in class it extends. */
export function nodeTypeOf(n: Node): string {
  for (let proto = Object.getPrototypeOf(n); proto; proto = Object.getPrototypeOf(proto)) {
    const hit = Object.entries(NODE_CLASSES).find(([, C]) => C.prototype === proto);
    if (hit) return hit[0];
  }
  return 'Node';
}
