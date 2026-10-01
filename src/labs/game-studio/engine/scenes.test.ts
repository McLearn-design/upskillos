// Scene instances, groups, signals, spawning and changing scenes, in the running game.
import { describe, expect, it } from 'vitest';
import { Doc } from '../core/doc';
import { newProject } from '../core/project';
import { Game, type ScriptError } from './game';
import { Area2D, CharacterBody2D, Node, Node2D } from './nodes';

/** A project with a coin scene (Area2D + shape, group "coins", script Coin) and a level. */
function project(build: (d: Doc, level: string, coin: string) => void) {
  const d = new Doc(newProject());
  for (const s of ['coin', 'player', 'bullet', 'title', 'counter']) d.writeScript(`scripts/${s}.js`, '');
  const coin = d.createScene('scenes/coin.scene', 'Area2D', 'Coin');
  d.addNode(coin.id, 'CollisionShape2D', undefined, { name: 'Shape' });
  d.setGroups(coin.id, d.scene(coin.id).root.id, ['coins']);
  d.setScript(coin.id, d.scene(coin.id).root.id, 'scripts/coin.js');
  const level = d.createScene('scenes/level.scene', 'Node2D', 'Level');
  d.setMainScene('scenes/level.scene');
  build(d, level.id, coin.id);
  return { d, level };
}
function run(d: Doc, sceneId: string, classes: Record<string, typeof Node>) {
  const errors: ScriptError[] = [];
  const g = new Game(d.project, d.scene(sceneId), { frame: () => undefined }, { scriptClass: (p) => classes[p.replace(/^scripts\/|\.js$/g, '')], onError: (e) => errors.push(e) });
  g.start();
  return { g, errors, sceneApi: g.sceneApi };
}

describe('instances in the running game', () => {
  it('each instance runs its source scene’s script, has its groups, and is found by group', () => {
    const readied: string[] = [];
    class Coin extends Area2D { ready() { readied.push(this.name); } }
    const { d, level } = project((d, level) => { d.addInstance(level, 'scenes/coin.scene'); d.addInstance(level, 'scenes/coin.scene'); });
    const { sceneApi } = run(d, level.id, { coin: Coin });
    expect(readied).toEqual(['Coin', 'Coin2']);
    expect(sceneApi.getNodesInGroup('coins').map((n) => n.name)).toEqual(['Coin', 'Coin2']);
    expect(sceneApi.getNodesInGroup('coins')[0]).toBeInstanceOf(Coin);
  });
});

describe('signals', () => {
  it('connect and emit: to a method of another node, and to a function, with the arguments', () => {
    const got: unknown[] = [];
    class Counter extends Node { add(n: number) { got.push(['method', n]); } }
    const { d, level } = project((d, level) => { d.setScript(level, d.addNode(level, 'Node', undefined, { name: 'Counter' }).id, 'scripts/counter.js'); d.addNode(level, 'Node', undefined, { name: 'Button' }); });
    const { g } = run(d, level.id, { counter: Counter });
    const button = g.root.get('Button'), counter = g.root.get('Counter');
    button.connect('pressed', counter, 'add');
    button.connect('pressed', (n: unknown) => got.push(['function', n]));
    button.connect('pressed', counter, 'add');            // the same again: still once
    button.emit('pressed', 3);
    expect(got).toEqual([['method', 3], ['function', 3]]);
    button.disconnect('pressed', counter, 'add');
    button.emit('pressed', 4);
    expect(got.at(-1)).toEqual(['function', 4]);
  });

  it('a connection saved in the scene wires an area’s bodyEntered to the player’s method, with no script on the area', () => {
    const collected: string[] = [];
    class Player extends CharacterBody2D { physicsUpdate() { this.velocity = { x: 120, y: 0 }; this.moveAndSlide(); } collect(body: Node) { collected.push(body.name); } }
    const { d, level } = project((d, level) => {
      const p = d.addNode(level, 'CharacterBody2D', undefined, { name: 'Player' });
      d.addNode(level, 'CollisionShape2D', p.id, { name: 'Shape' });
      d.setScript(level, p.id, 'scripts/player.js');
      const zone = d.addNode(level, 'Area2D', undefined, { name: 'Zone', props: { position: { x: 60, y: 0 } } });
      d.addNode(level, 'CollisionShape2D', zone.id, { name: 'Shape' });
      d.connect(level, zone.id, 'bodyEntered', p.id, 'collect');
    });
    const { g } = run(d, level.id, { player: Player });
    for (let i = 0; i < 60; i++) g.step(1 / 60);
    expect(collected).toEqual(['Player']);   // once: entering, not every frame inside
  });

  it('a connection to a method the target does not have is reported against the target, once', () => {
    const { d, level } = project((d, level) => { d.addNode(level, 'Node', undefined, { name: 'A' }); d.addNode(level, 'Node', undefined, { name: 'B' }); });
    const { g, errors } = run(d, level.id, {});
    g.root.get('A').connect('ping', g.root.get('B'), 'pong');
    g.root.get('A').emit('ping'); g.root.get('A').emit('ping');
    expect(errors.map((e) => [e.node, e.message])).toEqual([['B', '"B" has no method "pong" for the ping signal of "A"']]);
  });
});

describe('groups, spawning and changing scenes', () => {
  it('callGroup calls a method on every member that has it', () => {
    const calls: string[] = [];
    class Coin extends Area2D { shine(times: number) { calls.push(`${this.name}×${times}`); } }
    const { d, level } = project((d, level) => { d.addInstance(level, 'scenes/coin.scene'); d.addInstance(level, 'scenes/coin.scene'); });
    const { sceneApi } = run(d, level.id, { coin: Coin });
    sceneApi.callGroup('coins', 'shine', 2);
    expect(calls).toEqual(['Coin×2', 'Coin2×2']);
  });

  it('instantiate makes a new copy of a scene each time, with its script; addChild puts it in the game and runs ready()', () => {
    const born: number[] = [];
    class Bullet extends Node2D { speed = 100; ready() { born.push(this.position.x); } update(dt: number) { this.position = { x: this.position.x + this.speed * dt, y: 0 }; } }
    const { d, level } = project((d) => {
      const b = d.createScene('scenes/bullet.scene', 'Node2D', 'Bullet');
      d.setScript(b.id, d.scene(b.id).root.id, 'scripts/bullet.js');
    });
    const { g, sceneApi } = run(d, level.id, { bullet: Bullet });
    const one = sceneApi.instantiate('scenes/bullet.scene') as Node2D, two = sceneApi.instantiate('scenes/bullet.scene') as Node2D;
    expect(one).toBeInstanceOf(Bullet);
    expect(one).not.toBe(two);
    two.position = { x: 50, y: 0 };
    g.root.addChild(one); g.root.addChild(two);
    expect(born).toEqual([0, 50]);
    expect(g.root.children.map((c) => c.name)).toEqual(['Bullet', 'Bullet2']);
    for (let i = 0; i < 30; i++) g.step(1 / 60);
    expect(one.position.x).toBeCloseTo(50, 9);
  });

  it('change() switches scenes at the end of the frame: the old nodes are destroyed, the new ones ready', () => {
    const log: string[] = [];
    class Title extends Node2D { ready() { log.push('title ready'); } destroyed() { log.push('title destroyed'); } update() { if (time.now > 0.1) scene.change('scenes/level.scene'); } }
    class Coin extends Area2D { ready() { log.push('coin ready'); } }
    let time = { now: 0 }; let scene: { change: (p: string) => void } = { change: () => undefined };
    const { d } = project((d, level) => { d.addInstance(level, 'scenes/coin.scene'); });
    const title = d.createScene('scenes/title.scene', 'Node2D', 'Title');
    d.setScript(title.id, d.scene(title.id).root.id, 'scripts/title.js');
    const { g } = run(d, title.id, { title: Title, coin: Coin });
    time = g.time; scene = g.sceneApi;
    for (let i = 0; i < 12; i++) g.step(1 / 60);
    expect(log).toEqual(['title ready', 'title destroyed', 'coin ready']);
    expect(g.sceneApi.path).toBe('scenes/level.scene');
    expect(g.root.name).toBe('Level');
  });
});
