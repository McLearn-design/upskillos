// Every example builds with the real Scene API, and plays on the real engine with its
// real scripts (loaded as ES modules), with no special cases (ADR 12).
import { afterAll, describe, expect, it } from 'vitest';
import { Doc } from '../core/doc';
import { newProject } from '../core/project';
import { runSceneCode } from '../core/api';
import { problems, serialize } from '../core/serialize';
import { Game, MATH, scriptGlobals, type DrawItem } from '../engine/game';
import { NODE_CLASSES, Node, type CharacterBody2D, type Node2D } from '../engine/nodes';
import { Vec2 } from '../engine/vec2';
import { EXAMPLES } from './index';
import { potionHunt } from './potionHunt';
import { platformer } from './platformer';
import type { GameExample } from './types';

function build(ex: GameExample): Doc {
  const d = new Doc(newProject(ex.title));
  for (const path of ex.images) d.importAsset(path, { mime: 'image/png', width: 16, height: 16 });
  d.runCode(`Build ${ex.title}`, ex.code);
  return d;
}

/** Load the project's scripts as ES modules (as the game's iframe does) and start the game. */
async function play(d: Doc) {
  Object.assign(globalThis, NODE_CLASSES, { Vec2, math: MATH });
  const classes = new Map<string, typeof Node>();
  for (const s of d.project.scripts) {
    const mod = await import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(s.source).toString('base64')}`);
    classes.set(s.path, mod.default);
  }
  const frames: DrawItem[][] = [];
  const scene = d.project.scenes.find((s) => s.path === d.project.settings.mainScene)!;
  const errors: string[] = [];
  const game = new Game(d.project, scene, { frame: (items) => frames.push(items) }, { scriptClass: (p) => classes.get(p), onError: (e) => errors.push(`${e.file}: ${e.message}`) });
  Object.assign(globalThis, scriptGlobals(game));
  game.start();
  const texts = () => frames.at(-1)!.filter((i) => i.kind === 'text').map((i) => (i as { text: string }).text);
  return { game, texts, errors };
}

afterAll(() => { for (const k of ['input', 'scene', 'time', 'math', 'physics', 'Vec2', ...Object.keys(NODE_CLASSES)]) delete (globalThis as Record<string, unknown>)[k]; });

describe('every example', () => {
  for (const ex of EXAMPLES) {
    it(`"${ex.title}" builds with the Scene API, is sound, and its GUI → code log replays to the same project`, () => {
      const d = build(ex);
      expect(problems(d.project)).toEqual([]);
      expect(d.project.assets.map((a) => a.path).sort()).toEqual([...new Set(ex.images)].sort());
      const replay = newProject(ex.title);
      runSceneCode(replay, d.log.map((l) => l.code).join('\n'));
      expect(serialize(replay)).toBe(serialize(d.project));
    });
  }
});

describe('Potion Hunt plays', () => {
  it('the camera follows the hero but stops at the walls: its view never leaves the dungeon', async () => {
    const views: { x: number; y: number; zoom: number }[] = [];
    const d = build(potionHunt);
    const { game } = await play(d);
    // Watch the view by stepping and reading what the renderer was given.
    const renderer = (game as unknown as { renderer: { frame: (i: unknown, v: { x: number; y: number; zoom: number }) => void } }).renderer;
    const orig = renderer.frame; renderer.frame = (i, v) => { views.push(v); orig(i, v); };
    const player = game.root.get<Node2D>('Player');
    for (const at of [{ x: 24, y: 24 }, { x: 296, y: 168 }, { x: 160, y: 96 }]) { player.position = at; for (let i = 0; i < 120; i++) game.step(1 / 60); }
    // Zoom 4 on a 960 × 540 screen shows 240 × 135 of the world: the centre stays 120 and 67.5 inside the 320 × 192 dungeon.
    for (const v of views) { expect(v.x).toBeGreaterThanOrEqual(120 - 1e-9); expect(v.x).toBeLessThanOrEqual(200 + 1e-9); expect(v.y).toBeGreaterThanOrEqual(67.5 - 1e-9); expect(v.y).toBeLessThanOrEqual(124.5 + 1e-9); }
    expect(Math.min(...views.map((v) => v.x))).toBeCloseTo(120, 3);
    expect(Math.max(...views.map((v) => v.x))).toBeCloseTo(200, 3);
  });


  it('starts with the HUD at 0 / 8 and no message', async () => {
    const { texts, errors } = await play(build(potionHunt));
    expect(texts()).toEqual(['Potions: 0 / 8']);
    expect(errors).toEqual([]);
  });

  it('standing on each potion collects it; the count goes up; at 8 the message shows', async () => {
    const { game, texts, errors } = await play(build(potionHunt));
    const player = game.root.get<Node2D>('Player');
    const spots = game.root.get('Potions').children.map((p) => (p as Node2D).position.copy());
    expect(spots).toHaveLength(8);
    spots.forEach((at, i) => {
      player.position = at;
      game.step(1 / 60);
      game.step(1 / 60);   // freed at the end of the frame it was picked up in
      expect(texts()[0]).toBe(`Potions: ${i + 1} / 8`);
    });
    expect(game.root.get('Potions').children).toHaveLength(0);
    expect(texts()).toEqual(['Potions: 8 / 8', 'You found them all!']);
    expect(errors).toEqual([]);
  });

  it('the bat flies its figure of eight, and touching it sends the hero back to the start', async () => {
    const { game } = await play(build(potionHunt));
    const bat = game.root.get<Node2D>('Bat'), player = game.root.get<Node2D>('Player');
    const b0 = bat.position.copy();
    for (let i = 0; i < 30; i++) game.step(1 / 60);
    expect(bat.position.distanceTo(b0)).toBeGreaterThan(20);
    player.position = bat.globalPosition;
    game.step(1 / 60);
    expect(player.position.x).toBe(40);
    expect(player.position.y).toBe(96);
  });

  it('holding → for 10 seconds walks to the wall and stops against it: 304 − 6 = 298', async () => {
    const { game } = await play(build(potionHunt));
    const player = game.root.get<CharacterBody2D>('Player');
    game.input.key('ArrowRight', true);
    // Keep out of the bat's way and the potions': walk along the bottom row.
    player.position = { x: 40, y: 168 };
    for (let i = 0; i < 600; i++) game.step(1 / 60);
    expect(player.position.x).toBeCloseTo(298, 9);
    expect(player.isOnWall()).toBe(true);
    // And holding ↓ as well slides it into the corner: the bottom wall's top is 176, so 170.
    game.input.key('ArrowDown', true);
    for (let i = 0; i < 120; i++) game.step(1 / 60);
    expect(player.position.y).toBeCloseTo(170, 9);
  });
});

describe('Coin Run plays', () => {
  const DT = 1 / 60, G = 980;
  const steps = (game: Game, n: number) => { for (let i = 0; i < n; i++) game.step(DT); };

  it('the player falls onto the ground and stands on it: ground top 234 − shape bottom 12 = 222', async () => {
    const { game, texts, errors } = await play(build(platformer));
    const player = game.root.get<CharacterBody2D>('Player');
    steps(game, 60);
    expect(player.position.y).toBeCloseTo(222, 9);
    expect(player.isOnFloor()).toBe(true);
    expect(texts()).toEqual(['Coins: 0 / 10']);
    expect(errors).toEqual([]);
  });

  it('a jump rises exactly what gravity allows: 360 up, 980 × 1/60 less every step', async () => {
    const { game } = await play(build(platformer));
    const player = game.root.get<CharacterBody2D>('Player');
    steps(game, 60);
    game.input.key('Space', true);
    let top = player.position.y;
    for (let i = 0; i < 60; i++) { game.step(DT); top = Math.min(top, player.position.y); }
    // Each step: velocity gets + G·dt, then the jump sets it to −360 (first step only), then it moves by velocity·dt.
    let v = -360, rise = 0;
    while (v < 0) { rise -= v * DT; v += G * DT; }
    expect(222 - top).toBeCloseTo(rise, 9);
    expect(rise).toBeGreaterThan(66);   // v²/2g = 66.1; stepping adds a little
    expect(player.position.y).toBeCloseTo(222, 9);   // and back down on the ground
  });

  it('holding jump only jumps once: no jumping again in mid-air', async () => {
    const { game } = await play(build(platformer));
    const player = game.root.get<CharacterBody2D>('Player');
    steps(game, 60);
    game.input.key('Space', true); steps(game, 10);
    game.input.key('Space', false); game.input.key('Space', true);   // press again while in the air
    let top = player.position.y;
    for (let i = 0; i < 60; i++) { game.step(DT); top = Math.min(top, player.position.y); }
    expect(222 - top).toBeLessThan(67);
  });

  it('running and jumping lands on the first platform: its top 180 − 12 = 168', async () => {
    const { game } = await play(build(platformer));
    const player = game.root.get<CharacterBody2D>('Player');
    player.position = { x: 63, y: 222 };
    steps(game, 10);
    game.input.key('ArrowRight', true); game.input.key('Space', true);
    steps(game, 25);
    game.input.key('ArrowRight', false);
    steps(game, 60);
    expect(player.position.y).toBeCloseTo(168, 9);
    expect(player.isOnFloor()).toBe(true);
    expect(player.position.x).toBeGreaterThan(108);
    expect(player.position.x).toBeLessThan(180);
  });

  it('walking into a gap falls out of the level and back to the start', async () => {
    const { game } = await play(build(platformer));
    const player = game.root.get<CharacterBody2D>('Player');
    player.position = { x: 297, y: 200 };   // over the first gap, columns 15 to 17
    steps(game, 60);
    expect(player.position.x).toBe(27);
    steps(game, 60);
    expect(player.position.y).toBeCloseTo(222, 9);
  });

  it('touching each coin collects it; reaching the flag shows the message and stops the player', async () => {
    const { game, texts, errors } = await play(build(platformer));
    const player = game.root.get<CharacterBody2D>('Player');
    const spots = game.root.get('Coins').children.map((c) => (c as Node2D).position.copy());
    expect(spots).toHaveLength(10);
    spots.forEach((at, i) => {
      player.position = at;
      game.step(DT); game.step(DT);
      expect(texts()[0]).toBe(`Coins: ${i + 1} / 10`);
    });
    expect(texts()).toEqual(['Coins: 10 / 10']);
    player.position = { x: 1020, y: 222 };
    game.input.key('ArrowRight', true);
    steps(game, 60);
    expect(texts()).toEqual(['Coins: 10 / 10', 'You reached the flag!']);
    const x = player.position.x;
    steps(game, 30);
    expect(player.position.x).toBe(x);
    expect(errors).toEqual([]);
  });

  it('the invisible edges stop the player at both ends of the level', async () => {
    const { game } = await play(build(platformer));
    const player = game.root.get<CharacterBody2D>('Player');
    game.input.key('ArrowLeft', true);
    steps(game, 60);
    expect(player.position.x).toBeCloseTo(7, 9);   // the left edge's right side is 0; half the shape is 7
    expect(player.isOnWall()).toBe(true);
  });

  it('the camera scrolls with the player but its view never leaves the 1080 × 270 level', async () => {
    const views: { x: number; y: number }[] = [];
    const { game } = await play(build(platformer));
    const renderer = (game as unknown as { renderer: { frame: (i: unknown, v: { x: number; y: number }) => void } }).renderer;
    const orig = renderer.frame; renderer.frame = (i, v) => { views.push(v); orig(i, v); };
    const player = game.root.get<Node2D>('Player');
    for (const at of [{ x: 27, y: 222 }, { x: 540, y: 222 }, { x: 1060, y: 222 }]) { player.position = at; steps(game, 120); }
    // Zoom 3 on 960 × 540 shows 320 × 180: the centre stays 160 and 90 inside the level.
    for (const v of views) { expect(v.x).toBeGreaterThanOrEqual(160 - 1e-9); expect(v.x).toBeLessThanOrEqual(920 + 1e-9); expect(v.y).toBeGreaterThanOrEqual(90 - 1e-9); expect(v.y).toBeLessThanOrEqual(180 + 1e-9); }
    expect(Math.min(...views.map((v) => v.x))).toBeCloseTo(160, 3);
    expect(Math.max(...views.map((v) => v.x))).toBeCloseTo(920, 3);
    expect(Math.max(...views.map((v) => v.y))).toBeCloseTo(180, 3);   // the bottom of the level is the bottom of the view
  });
});
