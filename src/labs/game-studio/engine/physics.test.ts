import { describe, expect, it } from 'vitest';
import { Doc } from '../core/doc';
import { newProject } from '../core/project';
import type { PropValue } from '../core/types';
import { Game } from './game';
import { Area2D, CharacterBody2D, Node2D, RigidBody2D, type PhysicsBody2D } from './nodes';
import { separate } from './physics';

describe('separating two shapes', () => {
  it('rectangles: along the axis that overlaps least', () => {
    // a (10 wide) at x = 12 against b (10 wide) at x = 20: overlap 2 on x, 10 on y → push a left by 2.
    expect(separate({ kind: 'rectangle', x: 12, y: 0, hw: 5, hh: 5 }, { kind: 'rectangle', x: 20, y: 0, hw: 5, hh: 5 })).toEqual({ nx: -1, ny: 0, depth: 2 });
    expect(separate({ kind: 'rectangle', x: 0, y: 0, hw: 5, hh: 5 }, { kind: 'rectangle', x: 10, y: 0, hw: 5, hh: 5 })).toBeNull();   // touching is not overlapping
  });

  it('a circle against a rectangle: from the rectangle’s nearest point, or out through the nearest face from inside', () => {
    // Circle r 5 at (13, 13) near the corner (10, 10) of a 20 × 20 box at the origin: 3-4-5 away… (3, 3) is √18 ≈ 4.243, so it overlaps by 0.757.
    const p = separate({ kind: 'circle', x: 13, y: 13, r: 5 }, { kind: 'rectangle', x: 0, y: 0, hw: 10, hh: 10 })!;
    expect(p.nx).toBeCloseTo(Math.SQRT1_2, 12); expect(p.ny).toBeCloseTo(Math.SQRT1_2, 12); expect(p.depth).toBeCloseTo(5 - Math.sqrt(18), 12);
    // Centre inside, 2 from the right face: out to the right, 2 + r.
    expect(separate({ kind: 'circle', x: 8, y: 0, r: 5 }, { kind: 'rectangle', x: 0, y: 0, hw: 10, hh: 10 })).toEqual({ nx: 1, ny: 0, depth: 7 });
    // And the other way round: the rectangle is pushed away from the circle.
    expect(separate({ kind: 'rectangle', x: 0, y: 0, hw: 10, hh: 10 }, { kind: 'circle', x: 8, y: 0, r: 5 })).toEqual({ nx: -1, ny: -0, depth: 7 });
  });

  it('circles: along the line between the centres', () => {
    expect(separate({ kind: 'circle', x: 0, y: 0, r: 5 }, { kind: 'circle', x: 6, y: 8, r: 6 })).toEqual({ nx: -0.6, ny: -0.8, depth: 1 });
  });
});

/** A scene with a character running a physicsUpdate, and whatever else `build` adds. */
function run(build: (d: Doc, id: string, body: (name: string, type: string, x: number, y: number, props?: Record<string, PropValue>, size?: { x: number; y: number }, shape?: string) => void) => void, script: (b: CharacterBody2D | RigidBody2D, dt: number) => void, opts: { gravity?: number; frames?: number } = {}) {
  const d = new Doc(newProject());
  const s = d.createScene('scenes/main.scene');
  d.setSettings({ gravity: opts.gravity ?? 0 });
  d.writeScript('scripts/mover.js', '');
  const body = (name: string, type: string, x: number, y: number, props: Record<string, PropValue> = {}, size = { x: 16, y: 16 }, shape = 'rectangle') => {
    const n = d.addNode(s.id, type, undefined, { name, props: { position: { x, y }, ...props } });
    d.addNode(s.id, 'CollisionShape2D', n.id, { name: 'Shape', props: { size, shape } });
    if (name === 'Mover') d.setScript(s.id, n.id, 'scripts/mover.js');
  };
  build(d, s.id, body);
  class Mover extends CharacterBody2D { physicsUpdate(dt: number) { script(this, dt); } }
  class Ball extends RigidBody2D { ready() { script(this, 0); } }
  const moverType = d.project.scenes[0].root.children.find((c) => c.name === 'Mover')?.type;
  const g = new Game(d.project, d.project.scenes[0], { frame: () => undefined }, { scriptClass: () => (moverType === 'RigidBody2D' ? Ball : Mover) });
  g.start();
  for (let i = 0; i < (opts.frames ?? 60); i++) g.step(1 / 60);
  return g;
}

describe('moveAndSlide', () => {
  it('stops a 16 px body against a 16 px wall at x = 100 at exactly x = 84, and says it touched a wall', () => {
    let wall = false;
    const g = run((d, id, body) => { body('Mover', 'CharacterBody2D', 0, 0); body('Wall', 'StaticBody2D', 100, 0); },
      (b) => { (b as CharacterBody2D).velocity = { x: 120, y: 0 }; (b as CharacterBody2D).moveAndSlide(); wall ||= (b as CharacterBody2D).isOnWall(); });
    expect(g.root.get<Node2D>('Mover').position.x).toBeCloseTo(84, 9);
    expect(wall).toBe(true);
  });

  it('slides along a wall: the part of the velocity into it is removed, the rest is kept', () => {
    const g = run((d, id, body) => { body('Mover', 'CharacterBody2D', 70, 0); body('Wall', 'StaticBody2D', 100, 0, {}, { x: 16, y: 400 }); },
      (b) => { (b as CharacterBody2D).velocity = { x: 120, y: 60 }; (b as CharacterBody2D).moveAndSlide(); });
    const m = g.root.get<Node2D>('Mover');
    expect(m.position.x).toBeCloseTo(84, 9);
    expect(m.position.y).toBeCloseTo(60, 6);   // one second at 60 px/s, unhindered
  });

  it('lands on a floor under gravity: isOnFloor, standing still; then a jump takes off', () => {
    let onFloor = false, jumped = false;
    const g = run((d, id, body) => { body('Mover', 'CharacterBody2D', 0, 0); body('Floor', 'StaticBody2D', 0, 100, {}, { x: 400, y: 16 }); },
      (b, dt) => {
        const c = b as CharacterBody2D;
        c.velocity = { x: 0, y: c.velocity.y + 980 * dt };
        c.moveAndSlide();
        onFloor = c.isOnFloor();
      }, { gravity: 980, frames: 90 });
    const m = g.root.get<CharacterBody2D>('Mover');
    expect(onFloor).toBe(true);
    expect(m.position.y).toBeCloseTo(84, 9);   // floor top 92, minus the body's half-height 8
    expect(Math.abs(m.velocity.y)).toBeLessThan(20);   // one frame of gravity at most, cancelled by the floor
    // Jump: an upward velocity leaves the floor.
    m.velocity = { x: 0, y: -400 };
    const script = (m as unknown as { physicsUpdate: (dt: number) => void });
    script.physicsUpdate(1 / 60); jumped = !m.isOnFloor() && m.position.y < 84;
    expect(jumped).toBe(true);
  });

  it('does not tunnel: 3000 px/s into a 2 px wall still stops at it', () => {
    const g = run((d, id, body) => { body('Mover', 'CharacterBody2D', 0, 0); body('Wall', 'StaticBody2D', 100, 0, {}, { x: 2, y: 64 }); },
      (b) => { (b as CharacterBody2D).velocity = { x: 3000, y: 0 }; (b as CharacterBody2D).moveAndSlide(); }, { frames: 10 });
    expect(g.root.get<Node2D>('Mover').position.x).toBeCloseTo(91, 9);   // 100 − 1 − 8
  });
});

describe('rigid bodies and areas', () => {
  const thrown = (bounce: number) => run((d, id, body) => { body('Mover', 'RigidBody2D', 0, 0, { gravityScale: 0, bounce }, { x: 16, y: 16 }, 'circle'); body('Wall', 'StaticBody2D', 100, 0); },
    (b) => { b.velocity = { x: 120, y: 0 }; }, { frames: 60 });

  it('bounce 1 comes back as fast as it went; 0.5 at half the speed; 0 stays against the wall', () => {
    expect(thrown(1).root.get<RigidBody2D>('Mover').velocity.x).toBeCloseTo(-120, 9);
    expect(thrown(0.5).root.get<RigidBody2D>('Mover').velocity.x).toBeCloseTo(-60, 9);
    const still = thrown(0).root.get<RigidBody2D>('Mover');
    expect(still.velocity.x).toBeCloseTo(0, 9);
    expect(still.position.x).toBeCloseTo(84, 9);
  });

  it('falls under gravity × gravityScale: after 1 s at 980 px/s², 0.5 × ½ g t² … on a 60 Hz step', () => {
    const g = run((d, id, body) => body('Mover', 'RigidBody2D', 0, 0, { gravityScale: 0.5 }), () => undefined, { gravity: 980 });
    // Semi-implicit Euler: v gains g·dt, then moves v·dt. After n steps y = g·dt²·n(n+1)/2.
    const dt = 1 / 60, n = 60;
    expect(g.root.get<Node2D>('Mover').position.y).toBeCloseTo(0.5 * 980 * dt * dt * n * (n + 1) / 2, 6);
  });

  it('an area says who came in and who left, once each, in order, and does not stop them', () => {
    const log: string[] = [];
    const g = run((d, id, body) => { body('Mover', 'CharacterBody2D', 0, 0); body('Zone', 'Area2D', 100, 0, {}, { x: 32, y: 32 }); },
      (b) => { (b as CharacterBody2D).velocity = { x: 240, y: 0 }; (b as CharacterBody2D).moveAndSlide(); }, { frames: 0 });
    const zone = g.root.get<Area2D>('Zone');
    zone.bodyEntered = (b: PhysicsBody2D) => log.push(`in ${b.name}`);
    zone.bodyExited = (b: PhysicsBody2D) => log.push(`out ${b.name}`);
    for (let i = 0; i < 60; i++) g.step(1 / 60);
    expect(log).toEqual(['in Mover', 'out Mover']);
    expect(g.root.get<Node2D>('Mover').position.x).toBeCloseTo(240, 6);
  });
});
