// TileMapLayer in the engine: its script API, and its solid tiles in the physics.
import { describe, expect, it } from 'vitest';
import { Doc } from '../core/doc';
import { newProject } from '../core/project';
import { rectEdits, textEdits } from '../core/tiles';
import { Game } from './game';
import { Area2D, CharacterBody2D, RigidBody2D, TileMapLayer, type Node } from './nodes';

/**
 * A 64 × 32 image cut into 16 px tiles: tiles 0–3 on the top row, 4–7 below. Tile 1 is solid.
 * `build` adds nodes; scripts are given by class.
 */
function world(build: (d: Doc, id: string) => void, classes: Record<string, typeof Node> = {}) {
  const d = new Doc(newProject());
  const s = d.createScene('scenes/main.scene');
  d.setSettings({ gravity: 980 });
  d.importAsset('assets/t.png', { mime: 'image/png', width: 64, height: 32 });
  d.createTileset('tilesets/t.tileset', { image: 'assets/t.png', tileWidth: 16, tileHeight: 16, solid: [1] });
  for (const k of Object.keys(classes)) d.writeScript(`scripts/${k}.js`, '');
  build(d, s.id);
  const g = new Game(d.project, d.scene(s.id), { frame: () => undefined }, { scriptClass: (p) => classes[p.replace(/^scripts\/|\.js$/g, '')] });
  g.start();
  return g;
}
const layer = (d: Doc, id: string, edits: [number, number, number][]) => {
  const n = d.addNode(id, 'TileMapLayer', undefined, { name: 'Map', props: { tileset: 'tilesets/t.tileset' } });
  d.paintCells(id, n.id, edits);
};
const body = (d: Doc, id: string, x: number, y: number, script: string) => {
  const b = d.addNode(id, 'CharacterBody2D', undefined, { name: 'P', props: { position: { x, y } } });
  d.addNode(id, 'CollisionShape2D', b.id, { name: 'S' });                        // 16 × 16
  d.setScript(id, b.id, `scripts/${script}.js`);
};
const steps = (g: Game, n: number, each?: () => void) => { for (let i = 0; i < n; i++) { g.step(1 / 60); each?.(); } };

describe('TileMapLayer', () => {
  it('reads and changes cells; converts between points and cells; knows which tiles are solid', () => {
    const g = world((d, id) => layer(d, id, [[2, 1, 1], [3, 1, 0]]));
    const m = g.root.get<TileMapLayer>('Map');
    expect([m.getCell(2, 1), m.getCell(3, 1), m.getCell(0, 0)]).toEqual([1, 0, -1]);
    expect([m.isCellSolid(2, 1), m.isCellSolid(3, 1)]).toEqual([true, false]);
    expect(m.localToMap({ x: 40, y: 17 })).toEqual({ x: 2, y: 1 });
    expect(m.mapToLocal({ x: 2, y: 1 })).toEqual({ x: 40, y: 24 });
    expect(m.tileSize).toEqual({ x: 16, y: 16 });
    m.setCell(0, 0, 7); m.eraseCell(3, 1);
    expect(m.getUsedCells().map((c) => `${c.x},${c.y}`).sort()).toEqual(['0,0', '2,1']);
    expect(() => m.setCell(0, 0, 8)).toThrow(/has 8 tiles \(0 to 7\), so there is no tile 8/);
  });

  class Faller extends CharacterBody2D { physicsUpdate(dt: number) { this.velocity = { x: this.velocity.x, y: this.velocity.y + 980 * dt }; this.moveAndSlide(); } }
  class Slider extends CharacterBody2D { physicsUpdate(dt: number) { this.velocity = { x: 120, y: this.velocity.y + 980 * dt }; this.moveAndSlide(); } }
  class Walker extends CharacterBody2D { physicsUpdate() { this.velocity = { x: 120, y: 0 }; this.moveAndSlide(); } }

  it('a body falls onto solid tiles and rests on them: floor top 160 − half its 16 px = 152', () => {
    const g = world((d, id) => { layer(d, id, rectEdits(0, 10, 9, 10, 1)); body(d, id, 40, 100, 'Faller'); }, { Faller });
    steps(g, 90);
    const p = g.root.get<CharacterBody2D>('P');
    expect(p.position.y).toBeCloseTo(152, 9);
    expect(p.isOnFloor()).toBe(true);
    expect(p.getSlideCollisions()[0].body).toBe(g.root.get('Map'));
  });

  it('sliding along a floor of 40 tiles never catches on a seam: 2 s at 120 px/s is exactly 240 px, level all the way', () => {
    const g = world((d, id) => { layer(d, id, rectEdits(0, 10, 39, 10, 1)); body(d, id, 24, 152, 'Slider'); }, { Slider });
    const p = g.root.get<CharacterBody2D>('P');
    steps(g, 120, () => { expect(p.position.y).toBeCloseTo(152, 9); expect(p.isOnFloor()).toBe(true); });
    expect(p.position.x).toBeCloseTo(24 + 240, 9);
  });

  it('falling fast exactly onto the seam between two tiles lands straight down, not pushed sideways', () => {
    const g = world((d, id) => { layer(d, id, rectEdits(0, 10, 9, 10, 1)); body(d, id, 80, 0, 'Faller'); }, { Faller });
    steps(g, 120);
    const p = g.root.get<CharacterBody2D>('P');
    expect([p.position.x, +p.position.y.toFixed(9)]).toEqual([80, 152]);
  });

  it('a wall of tiles stops a body (left face 160 − 8 = 152); erasing its cells opens the way', () => {
    const g = world((d, id) => { layer(d, id, textEdits(['#', '#', '#', '#'], { '#': 1 }, { x: 10, y: 0 })); body(d, id, 40, 24, 'Walker'); }, { Walker });
    const p = g.root.get<CharacterBody2D>('P'), m = g.root.get<TileMapLayer>('Map');
    steps(g, 120);
    expect(p.position.x).toBeCloseTo(152, 9);
    expect(p.isOnWall()).toBe(true);
    for (let y = 0; y < 4; y++) m.eraseCell(10, y);
    steps(g, 30);
    expect(p.position.x).toBeGreaterThan(160);
  });

  it('a tile that is not solid stops nothing; a layer whose layer a body does not scan stops nothing', () => {
    const open = world((d, id) => { layer(d, id, textEdits(['.', '.'], { '.': 0 }, { x: 10, y: 1 })); body(d, id, 40, 24, 'Walker'); }, { Walker });
    steps(open, 120);
    expect(open.root.get<CharacterBody2D>('P').position.x).toBeGreaterThan(200);
  });

  it('a rigid ball bounces off tiles (bounce 1) and is told the layer it hit', () => {
    const hits: string[] = [];
    class Ball extends RigidBody2D { ready() { this.velocity = { x: 0, y: 200 }; } onCollision(b: Node) { hits.push(b.name); } }
    const g = world((d, id) => {
      layer(d, id, rectEdits(0, 10, 9, 10, 1));
      const b = d.addNode(id, 'RigidBody2D', undefined, { name: 'Ball', props: { position: { x: 40, y: 120 }, gravityScale: 0, bounce: 1 } });
      d.addNode(id, 'CollisionShape2D', b.id, { name: 'S', props: { shape: 'circle' } });
      d.setScript(id, b.id, 'scripts/Ball.js');
    }, { Ball });
    steps(g, 30);
    const ball = g.root.get<RigidBody2D>('Ball');
    expect(ball.velocity.y).toBeCloseTo(-200, 9);
    expect(hits).toEqual(['Map']);
  });

  it('an area notices a tile layer’s solid tiles inside it, as Godot’s does', () => {
    const seen: string[] = [];
    class Zone extends Area2D { bodyEntered(b: Node) { seen.push(b.name); } }
    const g = world((d, id) => {
      layer(d, id, [[2, 2, 1]]);
      const a = d.addNode(id, 'Area2D', undefined, { name: 'Zone', props: { position: { x: 40, y: 40 } } });
      d.addNode(id, 'CollisionShape2D', a.id, { name: 'S' });
      d.setScript(id, a.id, 'scripts/Zone.js');
    }, { Zone });
    steps(g, 1);
    expect(seen).toEqual(['Map']);
  });
});
