// The running game: builds the node tree from a scene, runs the lifecycle, and hands
// the renderer a plain list of what to draw each frame (ADR 2, ADR 4).
//
// Each frame, in this order:
//   1. physicsUpdate(1/60) on every node, as many times as fit in the time that has
//      passed (at most 0.25 s, so a stall does not run hundreds of steps);
//   2. update(dt) on every node, with the frame's own time;
//   3. nodes freed this frame are removed (destroyed() runs);
//   4. the renderer gets the frame;
//   5. "just pressed" input is forgotten.
// ready() runs children first, so a parent's ready() can use its children.
//
// A lifecycle method that throws is reported once, and that node is skipped from
// then on; the rest of the game keeps running.

import type { NodeData, Project, PropValue, SceneData } from '../core/types';
import { propsOf } from '../core/registry';
import { decompose } from '../core/math2d';
import { Input } from './input';
import { NODE_CLASSES, Area2D, Camera2D, CanvasLayer, CharacterBody2D, Label, Node, Node2D, PhysicsBody2D, RigidBody2D, Sprite2D } from './nodes';
import { scans, separate } from './physics';
import { Vec2 } from './vec2';

export const PHYSICS_DT = 1 / 60;

interface DrawBase {
  id: number;
  x: number; y: number; rotation: number; scaleX: number; scaleY: number;
  alpha: number;
  /** Drawing order: higher is on top. */
  depth: number;
  /** On the screen (under a CanvasLayer), not in the world: the camera does not move or zoom it. */
  screen: boolean;
}
/** One thing to draw: an image (centred on x, y) or text (top-left at x, y). */
export type DrawItem =
  | (DrawBase & { kind: 'sprite'; texture: string; flipX: boolean; flipY: boolean })
  | (DrawBase & { kind: 'text'; text: string; fontSize: number; color: string });

/** Where the camera looks: the world point at the centre of the screen, and how close. */
export interface View { x: number; y: number; zoom: number }

export interface Renderer {
  /** Everything to draw this frame, and the camera. Items not in the list are no longer drawn. */
  frame(items: DrawItem[], view: View): void;
}

export interface ScriptError { message: string; file: string | null; stack: string; node: string; phase: string }

export interface GameOptions {
  /** The class for a node's script, or undefined if it has none. */
  scriptClass?: (path: string) => typeof Node | undefined;
  onError?: (e: ScriptError) => void;
}

export class Game {
  readonly input: Input;
  readonly root: Node;
  readonly time = { now: 0, frame: 0 };
  /** The time step now running: 1/60 in physicsUpdate, the frame time in update. */
  stepDelta = 0;
  private accumulator = 0;
  private freeQueue = new Set<Node>();
  private ids = new WeakMap<Node, number>();
  private nextDrawId = 1;
  private started = false;
  /** Pixels per second per second, downward (the project's setting). */
  readonly gravity: number;
  /** Where the camera is looking (it eases toward its target when it has smoothing). */
  private view: View;
  private readonly screenSize: { w: number; h: number };

  constructor(project: Project, scene: SceneData, private renderer: Renderer, private opts: GameOptions = {}) {
    this.input = new Input(project.input);
    this.screenSize = { w: project.settings.width, h: project.settings.height };
    this.gravity = project.settings.gravity ?? 980;
    // With no camera, the screen shows the world from (0, 0) to (width, height).
    this.view = { x: this.screenSize.w / 2, y: this.screenSize.h / 2, zoom: 1 };
    this.root = this.build(scene.root);
    this.root._game = this;
  }

  /** Create the node for a saved one, its script class if it has one, and its children. */
  private build(data: NodeData): Node {
    const builtin = NODE_CLASSES[data.type];
    if (!builtin) throw new Error(`The engine has no node type "${data.type}"`);
    let Cls: typeof Node = builtin;
    if (data.script) {
      const S = this.opts.scriptClass?.(data.script);
      if (!S) throw new Error(`${data.script} did not load`);
      if (S !== builtin && !(S.prototype instanceof builtin)) {
        throw new Error(`${data.script}: the class must extend ${data.type}, because it is attached to a ${data.type} ("${data.name}"). Write: export default class … extends ${data.type}`);
      }
      Cls = S;
    }
    const node = new Cls();
    node.name = data.name;
    node._script = data.script;
    node._game = this;
    applyProps(node, data.type, data.props);
    for (const c of data.children) { const child = this.build(c); child._parent = node; node._children.push(child); }
    return node;
  }

  /** Run ready() everywhere, children first. Call once before the first step. */
  start(): void {
    if (this.started) return;
    this.started = true;
    const readyAll = (n: Node) => { for (const c of n._children) readyAll(c); this.call(n, 'ready'); };
    readyAll(this.root);
    this.updateCamera(0, true);
    this.draw();
  }

  /** Advance by dt seconds (the time since the last frame). */
  step(dt: number): void {
    this.time.frame++;
    this.time.now += dt;
    this.accumulator = Math.min(this.accumulator + dt, 0.25);
    while (this.accumulator >= PHYSICS_DT - 1e-12) {
      this.stepDelta = PHYSICS_DT;
      this.input.inPhysics = true;
      this.each((n) => this.call(n, 'physicsUpdate', PHYSICS_DT));
      this.input.inPhysics = false;
      this.input.endPhysicsStep();
      this.physicsStep(PHYSICS_DT);
      this.accumulator -= PHYSICS_DT;
    }
    this.stepDelta = dt;
    this.each((n) => this.call(n, 'update', dt));
    this.flushFree();
    this.updateCamera(dt);
    this.draw();
    this.input.endFrame();
  }

  /** Every node in tree order (parents before children). */
  each(fn: (n: Node) => void): void {
    const visit = (n: Node) => { if (n._freed) return; fn(n); for (const c of n._children) visit(c); };
    visit(this.root);
  }

  private call(n: Node, phase: string, ...args: unknown[]): void {
    if (n._broken) return;
    try { ((n as unknown as Record<string, (...a: unknown[]) => void>)[phase]).apply(n, args); }
    catch (e) {
      n._broken = true;
      const err = e instanceof Error ? e : new Error(String(e));
      this.opts.onError?.({ message: err.message, stack: err.stack ?? '', file: n._script, node: n.path, phase });
    }
  }

  // ── physics ────────────────────────────────────────────────────────────

  /** Every body in the tree now (not freed). */
  private bodies(): PhysicsBody2D[] {
    const out: PhysicsBody2D[] = [];
    this.each((n) => { if (n instanceof PhysicsBody2D) out.push(n); });
    return out;
  }

  /**
   * Move a character or rigid body by velocity × stepDelta, in steps of at most 4 pixels
   * so it cannot pass through a thin wall, pushing it out of every solid body on its
   * mask's layers. `hit` is told each body touched and the surface normal (pointing away
   * from that body, towards the mover).
   */
  _moveBody(body: CharacterBody2D | RigidBody2D, hit: (other: PhysicsBody2D, normal: Vec2) => void): void {
    const others = this.bodies().filter((o) => o !== body && scans(body.collisionMask, o.collisionLayer));
    const dist = body.velocity.length() * this.stepDelta;
    const steps = Math.max(1, Math.ceil(dist / 4));
    for (let i = 0; i < steps; i++) {
      body.globalPosition = body.globalPosition.add(body.velocity.scale(this.stepDelta / steps));
      // Push out of one overlap at a time, recomputing where the shapes are after each
      // push (pushing out of one body can push into another), up to eight times.
      for (let pass = 0; pass < 8; pass++) {
        let found: { o: PhysicsBody2D; nx: number; ny: number; depth: number } | null = null;
        search: for (const mine of body.shapes()) for (const o of others) for (const theirs of o.shapes()) {
          const p = separate(mine, theirs);
          if (p) { found = { o, ...p }; break search; }
        }
        if (!found) break;
        body.globalPosition = body.globalPosition.add({ x: found.nx * found.depth, y: found.ny * found.depth });
        hit(found.o, new Vec2(found.nx, found.ny));
      }
    }
  }

  /** After every physicsUpdate: rigid bodies fall, move and bounce; areas notice who came and went. */
  private physicsStep(dt: number): void {
    for (const b of this.bodies()) {
      if (!(b instanceof RigidBody2D) || b._broken) continue;
      b.velocity = { x: b.velocity.x, y: b.velocity.y + this.gravity * b.gravityScale * dt };
      const touched = new Map<PhysicsBody2D, Vec2>();
      this._moveBody(b, (other, n) => {
        const vn = b.velocity.dot(n);
        // Reflect the part of the velocity going into the surface, keeping `bounce` of it.
        if (vn < 0) b.velocity = b.velocity.sub(n.scale((1 + b.bounce) * vn));
        if (!touched.has(other)) touched.set(other, n);
      });
      for (const [other, n] of touched) this.call(b, 'onCollision', other, n);
    }
    const all = this.bodies();
    this.each((n) => {
      if (!(n instanceof Area2D)) return;
      const mine = n.shapes();
      const now = new Set(all.filter((b) => scans(n.collisionMask, b.collisionLayer) && b.shapes().some((s) => mine.some((m) => separate(s, m)))));
      for (const b of n._inside) if (!now.has(b)) this.call(n, 'bodyExited', b);
      for (const b of now) if (!n._inside.has(b)) this.call(n, 'bodyEntered', b);
      n._inside = now;
    });
  }

  /** A node added while running (addChild). */
  _attached(node: Node): void {
    const bind = (n: Node) => { n._game = this; for (const c of n._children) bind(c); };
    bind(node);
    if (this.started) { const readyAll = (n: Node) => { for (const c of n._children) readyAll(c); this.call(n, 'ready'); }; readyAll(node); }
  }

  _queueFree(node: Node): void { this.freeQueue.add(node); }

  private flushFree(): void {
    for (const node of this.freeQueue) {
      if (node._freed || node === this.root) continue;
      const gone = (n: Node) => { for (const c of n._children) gone(c); n._freed = true; this.call(n, 'destroyed'); };
      gone(node);
      if (node._parent) node._parent._children = node._parent._children.filter((c) => c !== node);
      node._parent = null;
    }
    this.freeQueue.clear();
  }

  /** The camera in use: the first Camera2D in tree order with current on. */
  get camera(): Camera2D | null {
    let found: Camera2D | null = null;
    this.each((n) => { if (!found && n instanceof Camera2D && n.current) found = n; });
    return found;
  }

  /**
   * Point the view at the camera. With smoothing k, the view closes the gap by a
   * fraction 1 − e^(−k·dt) each frame: the same easing whatever the frame rate.
   */
  private updateCamera(dt: number, snap = false): void {
    const cam = this.camera;
    if (!cam) { this.view = { x: this.screenSize.w / 2, y: this.screenSize.h / 2, zoom: 1 }; return; }
    const target = this.limit(cam, cam.globalPosition);
    const f = snap || cam.smoothing <= 0 ? 1 : 1 - Math.exp(-cam.smoothing * dt);
    this.view = { ...this.limit(cam, { x: this.view.x + (target.x - this.view.x) * f, y: this.view.y + (target.y - this.view.y) * f }), zoom: cam.zoom };
  }

  /**
   * Keep the camera's view inside its limits: the centre may go no closer to a limit than
   * half the view's width (or height). A level smaller than the view is centred.
   */
  private limit(cam: Camera2D, c: { x: number; y: number }): { x: number; y: number } {
    const hw = this.screenSize.w / (2 * cam.zoom), hh = this.screenSize.h / (2 * cam.zoom);
    const tl = cam.limitTopLeft, br = cam.limitBottomRight;
    const axis = (v: number, lo: number, hi: number, half: number) => (lo + half > hi - half ? (lo + hi) / 2 : Math.min(hi - half, Math.max(lo + half, v)));
    return { x: axis(c.x, tl.x, br.x, hw), y: axis(c.y, tl.y, br.y, hh) };
  }

  /** The draw list: visible sprites with a texture and visible labels, in world (or screen) coordinates. */
  private draw(): void {
    const items: DrawItem[] = [];
    let order = 0;
    const idOf = (n: Node) => { let id = this.ids.get(n); if (id === undefined) { id = this.nextDrawId++; this.ids.set(n, id); } return id; };
    const visit = (n: Node, visible: boolean, z: number, screen: boolean) => {
      if (n._freed) return;
      let vis = visible, zz = z, scr = screen;
      if (n instanceof CanvasLayer) { scr = true; zz = 1e6 * n.layer; }
      if (n instanceof Node2D) { vis = visible && n.visible; zz = zz + n.zIndex; }
      if (vis && n instanceof Node2D && ((n instanceof Sprite2D && n.texture) || n instanceof Label)) {
        const t = decompose(n.worldTransform);
        const base = { id: idOf(n), x: t.position.x, y: t.position.y, rotation: t.rotation, scaleX: t.scale.x, scaleY: t.scale.y, depth: zz + (order++) * 1e-6, screen: scr };
        if (n instanceof Sprite2D) items.push({ ...base, kind: 'sprite', texture: n.texture!, flipX: n.flipX, flipY: n.flipY, alpha: n.opacity });
        else if (n instanceof Label) items.push({ ...base, kind: 'text', text: String(n.text), fontSize: n.fontSize, color: n.color, alpha: 1 });
      }
      for (const c of n._children) visit(c, vis, zz, scr);
    };
    visit(this.root, true, 0, false);
    this.renderer.frame(items, { ...this.view });
  }

  /** Scripts' `scene` global: the tree from its root. */
  get sceneApi() {
    return { root: this.root, get: <T extends Node = Node>(path: string) => this.root.get<T>(path), find: <T extends Node = Node>(path: string) => this.root.find<T>(path) };
  }
}

/** Set a node's saved properties (registry names) on the runtime object. */
export function applyProps(node: Node, type: string, props: Record<string, PropValue>): void {
  for (const def of propsOf(type)) {
    if (!(def.name in props)) continue;
    const v = props[def.name];
    (node as unknown as Record<string, unknown>)[def.name] = v && typeof v === 'object' ? new Vec2((v as { x: number }).x, (v as { y: number }).y) : v;
  }
}

/** The globals a script sees (ADR 4). */
export function scriptGlobals(game: Game): Record<string, unknown> {
  return { input: game.input, scene: game.sceneApi, time: game.time, math: MATH, physics: { gravity: game.gravity }, Vec2, PhysicsBody2D, ...NODE_CLASSES };
}

/** Small maths helpers scripts use all the time. */
export const MATH = {
  vec: (x = 0, y = 0) => new Vec2(x, y),
  clamp: (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v)),
  /** Partway from a to b: t = 0 is a, 1 is b. */
  lerp: (a: number, b: number, t: number) => a + (b - a) * t,
  degToRad: (d: number) => (d * Math.PI) / 180,
  radToDeg: (r: number) => (r * 180) / Math.PI,
  /** A random number in [lo, hi). */
  randRange: (lo: number, hi: number) => lo + Math.random() * (hi - lo),
};
