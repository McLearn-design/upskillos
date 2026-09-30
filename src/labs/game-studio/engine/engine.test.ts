import { describe, expect, it } from 'vitest';
import { Doc } from '../core/doc';
import { newProject } from '../core/project';
import { nodeTypes, propsOf, type PropDef } from '../core/registry';
import type { PropValue } from '../core/types';
import { Game, PHYSICS_DT, type DrawItem, type ScriptError, type View } from './game';
import { Area2D, CharacterBody2D, Node, Node2D, RigidBody2D, Sprite2D } from './nodes';

const recorder = () => { const frames: DrawItem[][] = [], views: View[] = []; return { frames, views, renderer: { frame: (items: DrawItem[], view: View) => { frames.push(items); views.push(view); } } }; };

function scene(build: (d: Doc, sceneId: string) => void) {
  const d = new Doc(newProject());
  const s = d.createScene('scenes/main.scene');
  d.importAsset('assets/a.png', { mime: 'image/png', width: 8, height: 8 });
  build(d, s.id);
  return { project: d.project, scene: d.scene(s.id) };
}

describe('the lifecycle', () => {
  it('runs ready children-first, then physicsUpdate at a fixed 1/60 s as often as fits, then update once', () => {
    const calls: string[] = [];
    class Tracked extends Node2D {
      ready() { calls.push(`ready ${this.name}`); }
      physicsUpdate(dt: number) { calls.push(`physics ${this.name} ${dt.toFixed(4)}`); }
      update(dt: number) { calls.push(`update ${this.name} ${dt}`); }
    }
    const { project, scene: s } = scene((d, id) => {
      d.writeScript('scripts/t.js', '');
      const a = d.addNode(id, 'Node2D', undefined, { name: 'A' });
      d.addNode(id, 'Node2D', a.id, { name: 'B' });
      d.setScript(id, a.id, 'scripts/t.js');
      d.setScript(id, a.children?.[0]?.id ?? d.node(id, a.id)!.children[0].id, 'scripts/t.js');
    });
    const g = new Game(project, s, recorder().renderer, { scriptClass: () => Tracked });
    g.start();
    expect(calls).toEqual(['ready B', 'ready A']);
    calls.length = 0;
    g.step(0.05);                                     // 3 × 1/60 fit in 0.05 s
    expect(calls).toEqual([
      'physics A 0.0167', 'physics B 0.0167', 'physics A 0.0167', 'physics B 0.0167', 'physics A 0.0167', 'physics B 0.0167',
      'update A 0.05', 'update B 0.05',
    ]);
    calls.length = 0;
    g.step(0.001);                                    // not enough for a physics step
    expect(calls).toEqual(['update A 0.001', 'update B 0.001']);
  });

  it('a script that throws is reported once, its node stops, and the rest keeps running', () => {
    const errors: ScriptError[] = [];
    let good = 0;
    class Bad extends Node2D { update() { throw new Error('boom'); } }
    class Good extends Node2D { update() { good++; } }
    const { project, scene: s } = scene((d, id) => {
      d.writeScript('scripts/bad.js', ''); d.writeScript('scripts/good.js', '');
      d.setScript(id, d.addNode(id, 'Node2D', undefined, { name: 'Broken' }).id, 'scripts/bad.js');
      d.setScript(id, d.addNode(id, 'Node2D', undefined, { name: 'Fine' }).id, 'scripts/good.js');
    });
    const g = new Game(project, s, recorder().renderer, { scriptClass: (p) => (p.includes('bad') ? Bad : Good), onError: (e) => errors.push(e) });
    g.start();
    for (let i = 0; i < 5; i++) g.step(1 / 60);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ message: 'boom', file: 'scripts/bad.js', node: 'Broken', phase: 'update' });
    expect(good).toBe(5);
  });

  it('refuses a script whose class does not extend the node it is attached to, and says how to fix it', () => {
    const { project, scene: s } = scene((d, id) => {
      d.writeScript('scripts/p.js', '');
      d.setScript(id, d.addNode(id, 'CharacterBody2D', undefined, { name: 'Player' }).id, 'scripts/p.js');
    });
    expect(() => new Game(project, s, recorder().renderer, { scriptClass: () => class extends Sprite2D {} })).toThrow(/must extend CharacterBody2D[\s\S]*extends CharacterBody2D/);
  });

  it('nodes added while running get ready(); queueFree removes them at the end of the frame and calls destroyed()', () => {
    const log: string[] = [];
    class Bullet extends Sprite2D { ready() { log.push('ready'); } destroyed() { log.push('destroyed'); } }
    const { project, scene: s } = scene(() => undefined);
    const rec = recorder();
    const g = new Game(project, s, rec.renderer);
    g.start();
    const b = new Bullet(); b.texture = 'assets/a.png';
    g.root.addChild(b);
    expect(log).toEqual(['ready']);
    g.step(0.016);
    expect(rec.frames.at(-1)).toHaveLength(1);
    b.queueFree();
    g.step(0.016);
    expect(log).toEqual(['ready', 'destroyed']);
    expect(rec.frames.at(-1)).toHaveLength(0);
  });
});

describe('motion and transforms', () => {
  it('moveAndSlide in physicsUpdate moves by velocity × 1/60 each step: 60 px/s for 1 s is 60 px', () => {
    class Mover extends CharacterBody2D { physicsUpdate() { this.velocity = { x: 60, y: 0 }; this.moveAndSlide(); } }
    const { project, scene: s } = scene((d, id) => { d.writeScript('scripts/m.js', ''); d.setScript(id, d.addNode(id, 'CharacterBody2D', undefined, { name: 'P' }).id, 'scripts/m.js'); });
    const g = new Game(project, s, recorder().renderer, { scriptClass: () => Mover });
    g.start();
    for (let i = 0; i < 60; i++) g.step(PHYSICS_DT);
    expect(g.root.get<Node2D>('P').position.x).toBeCloseTo(60, 9);
  });

  it('children move with their parent: world position through a turned, scaled parent, and back', () => {
    const parent = new Node2D(); parent.position = { x: 100, y: 50 }; parent.rotationDegrees = 90; parent.scale = { x: 2, y: 2 };
    const child = new Node2D(); child.position = { x: 10, y: 0 };
    parent.addChild(child);
    const g = child.globalPosition;
    expect(g.x).toBeCloseTo(100, 9); expect(g.y).toBeCloseTo(70, 9);   // +x turned 90° clockwise is +y (down), doubled
    child.globalPosition = { x: 80, y: 50 };
    expect(child.position.x).toBeCloseTo(0, 9); expect(child.position.y).toBeCloseTo(10, 9);
  });
});

describe('input', () => {
  it('actions, not keys: pressed, just pressed for one frame, axis and a normalized vector', () => {
    const { project, scene: s } = scene(() => undefined);
    const g = new Game(project, s, recorder().renderer);
    const input = g.input;
    input.key('KeyA', true);
    expect(input.isPressed('move_left')).toBe(true);
    expect(input.isJustPressed('move_left')).toBe(true);
    expect(input.axis('move_left', 'move_right')).toBe(-1);
    g.step(0.016);
    expect(input.isJustPressed('move_left')).toBe(false);
    expect(input.isPressed('move_left')).toBe(true);
    input.key('ArrowUp', true);
    const v = input.vector('move_left', 'move_right', 'move_up', 'move_down');
    expect(v.x).toBeCloseTo(-Math.SQRT1_2, 12); expect(v.y).toBeCloseTo(-Math.SQRT1_2, 12);
    input.key('KeyA', false);
    expect(input.isJustReleased('move_left')).toBe(true);
    expect(() => input.isPressed('fly')).toThrow(/no input action "fly"[\s\S]*Input map/);
  });

  it('in physicsUpdate, "just pressed" lasts until the next physics step, however many frames that takes', () => {
    // A 240 Hz screen: a press in a frame with no physics step must still reach physicsUpdate.
    const seen: string[] = [];
    let input!: Game['input'];
    class Jumper extends Node2D {
      physicsUpdate() { if (input.isJustPressed('jump')) seen.push('physics'); }
      update() { if (input.isJustPressed('jump')) seen.push('update'); }
    }
    const { project, scene: s } = scene((d, id) => { d.writeScript('scripts/j.js', ''); d.setScript(id, d.addNode(id, 'Node2D').id, 'scripts/j.js'); });
    const g = new Game(project, s, recorder().renderer, { scriptClass: () => Jumper });
    input = g.input;
    g.start();
    g.step(1 / 240);                    // accumulate a little, no physics step yet
    input.key('Space', true);
    g.step(1 / 240);                    // update sees it; still no physics step
    expect(seen).toEqual(['update']);
    g.step(1 / 240); g.step(1 / 240);   // the fourth 1/240 completes a physics step
    expect(seen).toEqual(['update', 'physics']);
    g.step(1 / 60);                     // once only
    expect(seen).toEqual(['update', 'physics']);
  });
});

describe('no fake controls', () => {
  /** A value different from the default, and allowed. */
  const changed = (def: PropDef): PropValue => def.type === 'vec2' ? { x: 3, y: 4 } : def.type === 'angle' ? 0.5 : def.type === 'bool' ? !def.default
    : def.type === 'texture' ? 'assets/a.png' : def.type === 'color' ? '#123456' : def.type === 'layers' ? 2
    : def.type === 'enum' ? def.options!.find((o) => o !== def.default)!
    : def.type === 'number' ? (def.default === 1 ? 0.5 : Math.min(def.max ?? Infinity, (def.default as number) + 2)) : 'x';

  // ── what a property changes on screen ─────────────────────────────────
  // A Sprite2D is given a texture so there is something to see, except when the texture itself is the property tested.
  const draw = (type: string, props: Record<string, PropValue>, autoTexture = true) => {
    const { project, scene: s } = scene((d, id) => {
      d.addNode(id, 'Node2D', undefined, { name: 'Before', props: { zIndex: 1 } });   // something to be in front of or behind
      const n = d.addNode(id, type, undefined, { name: 'N', props: type === 'Sprite2D' && autoTexture ? { texture: 'assets/a.png', ...props } : props });
      if (type !== 'Sprite2D') d.addNode(id, 'Sprite2D', n.id, { name: 'Drawn', props: { texture: 'assets/a.png' } });
    });
    const rec = recorder();
    const g = new Game(project, s, rec.renderer);
    g.start();
    // Move it and run a frame, so properties about motion (a camera's smoothing) have something to act on.
    const n = g.root.get('N');
    if (n instanceof Node2D) n.position = { x: n.position.x + 50, y: n.position.y };
    g.step(1 / 30);
    return JSON.stringify({ items: rec.frames.at(-1), view: rec.views.at(-1) });
  };

  // ── what a physics property changes: one second of a scenario ─────────
  // A probe (a 16 × 16 character body, moving right at 120 px/s from x = 0, 12 px below the
  // line of a wall at x = 100) and a wall. The property under test is set on the node named
  // in the scenario. The outcome is where things end up, and who an area noticed.
  class Probe extends CharacterBody2D { physicsUpdate() { this.velocity = { x: 120, y: 0 }; this.moveAndSlide(); } }
  class Thrown extends RigidBody2D { ready() { this.velocity = { x: 120, y: 0 }; } }
  const box = (d: Doc, id: string, parent: string, props: Record<string, PropValue> = {}) => d.addNode(id, 'CollisionShape2D', parent, { name: 'Shape', props });
  const outcome = (build: (d: Doc, id: string) => void, gravity = 0) => {
    const { project, scene: s } = scene((d, id) => { d.setSettings({ gravity }); d.writeScript('scripts/probe.js', ''); d.writeScript('scripts/thrown.js', ''); build(d, id); });
    const entered: string[] = [];
    const g = new Game(project, s, recorder().renderer, { scriptClass: (p) => (p.includes('probe') ? Probe : Thrown) });
    const area = g.root.find<Area2D>('N');
    if (area instanceof Area2D) area.bodyEntered = (b) => { entered.push(b.name); };
    g.start();
    for (let i = 0; i < 60; i++) g.step(1 / 60);
    const pos = (name: string) => { const n = g.root.find<Node2D>(name); return n ? [+n.position.x.toFixed(3), +n.position.y.toFixed(3)] : null; };
    return JSON.stringify({ probe: pos('Probe'), n: pos('N'), entered });
  };
  const probe = (d: Doc, id: string, props: Record<string, PropValue> = {}) => {
    const p = d.addNode(id, 'CharacterBody2D', undefined, { name: 'Probe', props: { position: { x: 0, y: 12 }, ...props } });
    box(d, id, p.id); d.setScript(id, p.id, 'scripts/probe.js');
  };
  const wall = (d: Doc, id: string, type: string, name: string, bodyProps: Record<string, PropValue> = {}, shapeProps: Record<string, PropValue> = {}) => {
    const w = d.addNode(id, type, undefined, { name, props: { position: { x: 100, y: 0 }, ...bodyProps } });
    box(d, id, w.id, shapeProps);
    return w;
  };
  const PHYSICS: Record<string, (v: PropValue | undefined) => string> = {
    // The wall's shape: its size, and a circle (whose round edge the probe, 12 px below its centre, gets closer to).
    'CollisionShape2D.shape': (v) => outcome((d, id) => { probe(d, id); const w = d.addNode(id, 'StaticBody2D', undefined, { name: 'W', props: { position: { x: 100, y: 0 } } }); box(d, id, w.id, v === undefined ? {} : { shape: v }); }),
    'CollisionShape2D.size': (v) => outcome((d, id) => { probe(d, id); const w = d.addNode(id, 'StaticBody2D', undefined, { name: 'W', props: { position: { x: 100, y: 0 } } }); box(d, id, w.id, v === undefined ? {} : { size: v }); }),
    // A wall the probe does not scan passes it through.
    'StaticBody2D.collisionLayer': (v) => outcome((d, id) => { probe(d, id); wall(d, id, 'StaticBody2D', 'N', v === undefined ? {} : { collisionLayer: v }); }),
    'CharacterBody2D.collisionLayer': (v) => outcome((d, id) => { probe(d, id); wall(d, id, 'CharacterBody2D', 'N', v === undefined ? {} : { collisionLayer: v }); }),
    'RigidBody2D.collisionLayer': (v) => outcome((d, id) => { probe(d, id); wall(d, id, 'RigidBody2D', 'N', v === undefined ? {} : { collisionLayer: v }); }),
    // A mover that does not scan the wall's layer passes through it.
    'CharacterBody2D.collisionMask': (v) => outcome((d, id) => { probe(d, id, v === undefined ? {} : { collisionMask: v }); wall(d, id, 'StaticBody2D', 'W'); }),
    'RigidBody2D.collisionMask': (v) => outcome((d, id) => {
      const b = d.addNode(id, 'RigidBody2D', undefined, { name: 'N', props: { position: { x: 0, y: 12 }, gravityScale: 0, ...(v === undefined ? {} : { collisionMask: v }) } });
      box(d, id, b.id); d.setScript(id, b.id, 'scripts/thrown.js'); wall(d, id, 'StaticBody2D', 'W');
    }),
    // Falling under gravity: how far depends on gravityScale.
    'RigidBody2D.gravityScale': (v) => outcome((d, id) => { const b = d.addNode(id, 'RigidBody2D', undefined, { name: 'N', props: v === undefined ? {} : { gravityScale: v } }); box(d, id, b.id); }, 980),
    // Thrown at a wall: with bounce it comes back.
    'RigidBody2D.bounce': (v) => outcome((d, id) => {
      const b = d.addNode(id, 'RigidBody2D', undefined, { name: 'N', props: { position: { x: 0, y: 12 }, gravityScale: 0, ...(v === undefined ? {} : { bounce: v }) } });
      box(d, id, b.id); d.setScript(id, b.id, 'scripts/thrown.js'); wall(d, id, 'StaticBody2D', 'W');
    }),
    // An area on the probe's path notices it only if its mask scans the probe's layer.
    'Area2D.collisionMask': (v) => outcome((d, id) => { probe(d, id); wall(d, id, 'Area2D', 'N', v === undefined ? {} : { collisionMask: v }); }),
  };

  it('every property in the registry changes what the engine draws, or what its physics does', () => {
    let checked = 0;
    for (const t of nodeTypes()) {
      for (const def of propsOf(t.type)) {
        const key = `${t.type}.${def.name}`, own = t.props.includes(def);
        if (own && PHYSICS[key]) {
          expect(PHYSICS[key](changed(def)), `${key} is in the registry but changes nothing its physics does`).not.toBe(PHYSICS[key](undefined));
        } else {
          const auto = def.name !== 'texture';
          expect(draw(t.type, { [def.name]: changed(def) }, auto), `${key} is in the registry but changes nothing the engine draws (or has no physics scenario)`).not.toBe(draw(t.type, {}, auto));
        }
        checked++;
      }
    }
    for (const key of Object.keys(PHYSICS)) expect(propsOf(key.split('.')[0]).some((p) => p.name === key.split('.')[1]), `${key} is not a property`).toBe(true);
    expect(checked).toBeGreaterThan(40);
  });
});

describe('camera and screen layer', () => {
  const build = (smoothing: number) => scene((d, id) => {
    const p = d.addNode(id, 'CharacterBody2D', undefined, { name: 'Player', props: { position: { x: 100, y: 100 } } });
    d.addNode(id, 'Camera2D', p.id, { name: 'Cam', props: { smoothing, zoom: 2 } });
    const hud = d.addNode(id, 'CanvasLayer', undefined, { name: 'HUD' });
    d.addNode(id, 'Label', hud.id, { name: 'Score', props: { text: 'Score: 0', position: { x: 10, y: 8 } } });
  });

  it('with no camera, the screen shows the game area: the view is centred on it', () => {
    const { project, scene: s } = scene(() => undefined);
    const rec = recorder();
    new Game(project, s, rec.renderer).start();
    expect(rec.views.at(-1)).toEqual({ x: 480, y: 270, zoom: 1 });
  });

  it('a camera under the player follows it exactly, and a HUD label stays on the screen', () => {
    const { project, scene: s } = build(0);
    const rec = recorder();
    const g = new Game(project, s, rec.renderer);
    g.start();
    expect(rec.views.at(-1)).toEqual({ x: 100, y: 100, zoom: 2 });
    g.root.get<Node2D>('Player').position = { x: 400, y: 100 };
    g.step(1 / 30);
    expect(rec.views.at(-1)).toEqual({ x: 400, y: 100, zoom: 2 });
    const label = rec.frames.at(-1)!.find((i) => i.kind === 'text')!;
    expect(label).toMatchObject({ kind: 'text', text: 'Score: 0', x: 10, y: 8, screen: true });
  });

  it('with smoothing k the view closes 1 − e^(−k·dt) of the gap each frame', () => {
    const { project, scene: s } = build(5);
    const rec = recorder();
    const g = new Game(project, s, rec.renderer);
    g.start();
    g.root.get<Node2D>('Player').position = { x: 400, y: 100 };
    g.step(1 / 30);
    const f = 1 - Math.exp(-5 / 30);
    expect(rec.views.at(-1)!.x).toBeCloseTo(100 + 300 * f, 9);   // ≈ 146.2
    for (let i = 0; i < 120; i++) g.step(1 / 30);
    expect(rec.views.at(-1)!.x).toBeCloseTo(400, 4);
  });
});

