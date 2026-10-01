// Scenes inside scenes, groups and signal connections, in the model.
import { describe, expect, it } from 'vitest';
import { Doc } from './doc';
import { newProject, walk } from './project';
import { runSceneCode } from './api';
import { expandScene } from './instances';
import { deserialize, problems, serialize } from './serialize';
import { propValue } from './registry';
import { FORMAT_VERSION } from './types';

/** A coin scene (an Area2D with a sprite and a shape, in group "coins") and a level with two coins. */
function world() {
  const d = new Doc(newProject('Coins'));
  d.importAsset('assets/coin.png', { mime: 'image/png', width: 16, height: 16 });
  d.importAsset('assets/gem.png', { mime: 'image/png', width: 16, height: 16 });
  const coin = d.createScene('scenes/coin.scene', 'Area2D', 'Coin');
  d.addNode(coin.id, 'Sprite2D', undefined, { name: 'Sprite', props: { texture: 'assets/coin.png' } });
  d.addNode(coin.id, 'CollisionShape2D', undefined, { name: 'Shape' });
  d.setGroups(coin.id, d.scene(coin.id).root.id, ['coins']);
  const level = d.createScene('scenes/level.scene', 'Node2D', 'Level');
  d.setMainScene('scenes/level.scene');
  const a = d.addInstance(level.id, 'scenes/coin.scene', undefined, { props: { position: { x: 10, y: 0 } } });
  const b = d.addInstance(level.id, 'scenes/coin.scene', undefined, { props: { position: { x: 30, y: 0 } } });
  return { d, coin, level, a, b, view: () => expandScene(d.project, d.scene(level.id)) };
}
const byPath = (root: ReturnType<typeof expandScene>['root'], path: string) => { let n = root; for (const p of path.split('/')) n = n.children.find((c) => c.name === p)!; return n; };

describe('scene instances', () => {
  it('an instance has its source’s contents, with stable ids, and only its own position is saved', () => {
    const { d, level, a, view } = world();
    const v = view();
    expect(v.root.children.map((c) => c.name)).toEqual(['Coin', 'Coin2']);
    const c1 = byPath(v.root, 'Coin');
    expect([c1.type, c1.groups, c1.children.map((c) => c.name)]).toEqual(['Area2D', ['coins'], ['Sprite', 'Shape']]);
    expect(c1.children[0].id).toMatch(new RegExp(`^${a.id}:`));
    expect(c1.children[0].inherited).toEqual({ instance: a.id, path: 'Sprite' });
    const saved = d.scene(level.id).root.children[0];
    expect([saved.instance, saved.props, saved.children]).toEqual(['scenes/coin.scene', { position: { x: 10, y: 0 } }, []]);
  });

  it('changing the source scene changes every instance', () => {
    const { d, coin, view } = world();
    const sprite = d.scene(coin.id).root.children[0];
    d.setProp(coin.id, sprite.id, 'texture', 'assets/gem.png');
    expect(['Coin', 'Coin2'].map((n) => byPath(view().root, `${n}/Sprite`).props.texture)).toEqual(['assets/gem.png', 'assets/gem.png']);
  });

  it('a change inside one instance is an override on it: logged by path, replayed, and removed again by setting the source’s value', () => {
    const { d, level, b, view } = world();
    const sprite = byPath(view().root, 'Coin2/Sprite');
    d.setProp(level.id, sprite.id, 'opacity', 0.5);
    expect(d.log.at(-1)!.code).toBe('scene.get("Coin2/Sprite").opacity = 0.5');
    expect(d.node(level.id, b.id)!.overrides).toEqual({ Sprite: { opacity: 0.5 } });
    expect(byPath(view().root, 'Coin/Sprite').props.opacity).toBeUndefined();          // the other instance is untouched
    const replay = newProject('Coins');
    runSceneCode(replay, d.log.map((l) => l.code).join('\n'));
    expect(serialize(replay)).toBe(serialize(d.project));
    d.setProp(level.id, sprite.id, 'opacity', 1);
    expect(d.node(level.id, b.id)!.overrides).toBeUndefined();
    expect(problems(d.project)).toEqual([]);
  });

  it('nodes from an instance cannot be renamed, moved or deleted here; a scene cannot contain itself', () => {
    const { d, coin, level, view } = world();
    const sprite = byPath(view().root, 'Coin/Sprite');
    expect(() => d.rename(level.id, sprite.id, 'X')).toThrow(/part of an instance; rename it in its own scene/);
    expect(() => d.deleteNode(level.id, sprite.id)).toThrow(/part of an instance; delete/);
    expect(() => d.addInstance(coin.id, 'scenes/level.scene')).toThrow(/already contains scenes\/coin.scene, so they would contain each other/);
    expect(() => d.addInstance(coin.id, 'scenes/coin.scene')).toThrow(/a scene cannot contain itself/);
  });
});

describe('groups and connections', () => {
  it('are commands, logged as code that replays', () => {
    const { d, level } = world();
    const player = d.addNode(level.id, 'CharacterBody2D', undefined, { name: 'Player' });
    const coin = d.scene(level.id).root.children[0];
    d.setGroups(level.id, player.id, ['player', 'damageable']);
    d.connect(level.id, coin.id, 'bodyEntered', player.id, 'collect');
    expect(d.log.slice(-2).map((l) => l.code)).toEqual(['scene.get("Player").groups = ["player", "damageable"]', 'scene.get("Coin").connect("bodyEntered", "Player", "collect")']);
    const replay = newProject('Coins');
    runSceneCode(replay, d.log.map((l) => l.code).join('\n'));
    expect(serialize(replay)).toBe(serialize(d.project));
  });

  it('a connection survives renaming its target (it is kept by id), and goes when the target is deleted', () => {
    const { d, level } = world();
    const player = d.addNode(level.id, 'CharacterBody2D', undefined, { name: 'Player' });
    const coin = d.scene(level.id).root.children[0];
    d.connect(level.id, coin.id, 'bodyEntered', player.id, 'collect');
    d.rename(level.id, player.id, 'Hero');
    expect(problems(d.project)).toEqual([]);
    expect(d.node(level.id, coin.id)!.connections).toEqual([{ signal: 'bodyEntered', target: player.id, method: 'collect' }]);
    d.deleteNode(level.id, player.id);
    expect(d.node(level.id, coin.id)!.connections).toBeUndefined();
  });
});

describe('the problem report and the file format', () => {
  it('names a missing source scene, an override of something the source no longer has, a loop, and a lost connection target', () => {
    const { d } = world();
    const p = JSON.parse(serialize(d.project));
    const level = p.scenes[1].root;
    level.children[0].overrides = { Gone: { opacity: 0.5 } };
    level.children[1].instance = 'scenes/none.scene';
    level.children.push({ id: 'n90', type: 'Node2D', name: 'Wired', props: {}, script: null, children: [], connections: [{ signal: 'go', target: 'n999', method: 'run' }] });
    p.scenes[0].root.children.push({ id: 'n91', type: 'Node2D', name: 'Loop', props: {}, script: null, children: [], instance: 'scenes/level.scene' });
    p.nextId = 100;
    expect(problems(p)).toEqual([
      'scenes/coin.scene: Scenes inside each other in a loop: scenes/coin.scene → scenes/level.scene → scenes/coin.scene',
      'scenes/level.scene: Scenes inside each other in a loop: scenes/level.scene → scenes/coin.scene → scenes/level.scene',
      'scenes/level.scene: Coin: it changes "Gone", which scenes/coin.scene no longer has',
      'scenes/level.scene: Coin2: it is an instance of "scenes/none.scene", which does not exist',
    ]);
  });

  it('a format 2 project loads as format 3, unchanged', () => {
    const p = JSON.parse(serialize(newProject('Old')));
    p.formatVersion = 2;
    expect(deserialize(JSON.stringify(p))).toEqual({ ...newProject('Old'), formatVersion: FORMAT_VERSION });
  });

  it('an instance’s properties read through the Scene API are its own where set, else its source’s', () => {
    const { d, level } = world();
    const h = d.view(level.id).root.children[1];
    expect(propValue(h.type, h.props, 'position')).toEqual({ x: 30, y: 0 });
    expect([...walk(d.view(level.id).root)].filter((n) => n.inherited).length).toBe(4);
  });
});
