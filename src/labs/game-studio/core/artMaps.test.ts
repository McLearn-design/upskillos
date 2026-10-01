// Maps to and from Tile Mapper, and pictures coming back from Sprite Forge (core/artMaps.ts, ProjectApi.replaceAsset).
import { describe, expect, it } from 'vitest';
import { Doc } from './doc';
import { newProject } from './project';
import { problems } from './serialize';
import { mapToSceneCode, sceneToMap, type ArtMap } from './artMaps';
import type { NodeData } from './types';

const IMG = 'assets/tiles.png';
function project() {
  const d = new Doc(newProject('Maps'));
  d.importAsset(IMG, { mime: 'image/png', width: 64, height: 32 });   // 4 × 2 tiles of 16
  d.runCode('Scene', `project.createScene('scenes/main.scene', 'Node2D', 'Main')`);
  return d;
}
const scene = (d: Doc) => d.project.scenes[0];
const child = (n: NodeData, name: string) => n.children.find((c) => c.name === name)!;
/** A 3 × 2 map: ground along the bottom, one flower, and a solid floor. */
const MAP: ArtMap = {
  name: 'Meadow', cols: 3, rows: 2, tileWidth: 16, tileHeight: 16, margin: 0, spacing: 0,
  layers: [
    { name: 'Ground', kind: 'tiles', visible: true, cells: [-1, -1, -1, 4, 5, 6] },
    { name: 'Flowers', kind: 'tiles', visible: true, cells: [-1, 7, -1, -1, -1, -1] },
    { name: 'Collision', kind: 'collision', visible: true, cells: [-1, -1, -1, 0, 0, 0] },
  ],
};
function put(d: Doc, map: ArtMap, parentId: string | null) {
  const r = mapToSceneCode(d.project, map, IMG, { scenePath: 'scenes/main.scene', parentId });
  d.runCode(`From Tile Mapper: ${map.name}`, r.code);
  return r;
}

describe('maps from Tile Mapper', () => {
  it('a new map is a Node2D of TileMapLayers; collision is a hidden layer whose tile is solid', () => {
    const d = project();
    put(d, MAP, null);
    expect(problems(d.project)).toEqual([]);
    const m = child(scene(d).root, 'Meadow');
    expect(m.type).toBe('Node2D');
    expect(m.children.map((c) => c.name)).toEqual(['Ground', 'Flowers', 'Collision']);
    expect(child(m, 'Ground').props).toMatchObject({ tileset: 'tilesets/meadow.tileset', cells: [0, 1, 4, 1, 1, 5, 2, 1, 6] });
    expect(child(m, 'Collision').props).toMatchObject({ tileset: 'tilesets/meadow-collision.tileset', visible: false, cells: [0, 1, 0, 1, 1, 0, 2, 1, 0] });
    expect(d.project.tilesets.map((t) => [t.path, t.image, t.solid])).toEqual([['tilesets/meadow.tileset', IMG, []], ['tilesets/meadow-collision.tileset', IMG, [0]]]);
  });

  it('sent again, it repaints the same nodes, reuses the tilesets, and drops a layer it no longer has', () => {
    const d = project();
    put(d, MAP, null);
    const m = child(scene(d).root, 'Meadow'), ids = m.children.map((c) => c.id);
    const edited: ArtMap = { ...MAP, layers: [{ ...MAP.layers[0], cells: [9, -1, -1, 4, 5, 6] }, MAP.layers[2]] };
    put(d, edited, m.id);
    const after = child(scene(d).root, 'Meadow');
    expect(after.children.map((c) => c.name)).toEqual(['Ground', 'Collision']);
    expect(after.children.map((c) => c.id)).toEqual([ids[0], ids[2]]);
    expect(child(after, 'Ground').props.cells).toEqual([0, 0, 9, 0, 1, 4, 1, 1, 5, 2, 1, 6]);
    expect(d.project.tilesets).toHaveLength(2);
    d.undo();
    expect(child(scene(d).root, 'Meadow').children.map((c) => c.name)).toEqual(['Ground', 'Flowers', 'Collision']);
  });

  it('a layer of the scene round-trips: Game Studio → Tile Mapper → Game Studio gives the same cells', () => {
    const d = project();
    put(d, MAP, null);
    const m = child(scene(d).root, 'Meadow');
    const out = sceneToMap(d.project, scene(d), child(m, 'Flowers').id);   // any layer stands for its map
    expect(out.image).toBe(IMG);
    expect(out.parentId).toBe(m.id);
    expect(out.map.layers.map((l) => [l.name, l.kind])).toEqual([['Ground', 'tiles'], ['Flowers', 'tiles'], ['Collision', 'collision']]);
    // At least the game area (960 × 540 in 16 px tiles), so there is room to paint.
    expect([out.map.cols, out.map.rows]).toEqual([60, 34]);
    expect(out.map.layers[1].cells[1]).toBe(7);
    const before = JSON.stringify(m.children.map((c) => c.props));
    put(d, out.map, out.parentId);
    expect(JSON.stringify(child(scene(d).root, 'Meadow').children.map((c) => c.props))).toBe(before);
  });

  it('cells left of and above the origin come back where they were', () => {
    const d = project();
    d.runCode('Layer', `project.createTileset('tilesets/t.tileset', { image: '${IMG}', tileWidth: 16, tileHeight: 16 })\nscene.add('TileMapLayer', { name: 'Floor', tileset: 'tilesets/t.tileset' }).paint([[-2, -1, 3], [5, 4, 1]])`);
    const floor = child(scene(d).root, 'Floor');
    const out = sceneToMap(d.project, scene(d), floor.id);
    expect(out.map.origin).toEqual({ x: -2, y: -1 });
    expect(out.parentId).toBe(scene(d).root.id);   // a layer on its own: its parent is the scene root, and only it is repainted
    put(d, out.map, out.parentId);
    expect(child(scene(d).root, 'Floor').props.cells).toEqual([-2, -1, 3, 5, 4, 1]);
    expect(child(scene(d).root, 'Floor').id).toBe(floor.id);
  });

  it('says why a map cannot go to Tile Mapper', () => {
    const d = project();
    d.importAsset('assets/other.png', { mime: 'image/png', width: 32, height: 32 });
    d.runCode('Two', `project.createTileset('tilesets/a.tileset', { image: '${IMG}', tileWidth: 16, tileHeight: 16 })
project.createTileset('tilesets/b.tileset', { image: 'assets/other.png', tileWidth: 16, tileHeight: 16 })
scene.add('Node2D', { name: 'Level' })
scene.add('TileMapLayer', { name: 'A', parent: 'Level', tileset: 'tilesets/a.tileset' })
scene.add('TileMapLayer', { name: 'B', parent: 'Level', tileset: 'tilesets/b.tileset' })
scene.add('Sprite2D', { name: 'Hero' })`);
    expect(() => sceneToMap(d.project, scene(d), child(scene(d).root, 'Level').id)).toThrow(/2 tilesets.*one/);
    expect(() => sceneToMap(d.project, scene(d), child(scene(d).root, 'Hero').id)).toThrow(/Select a TileMapLayer/);
  });
});

describe('pictures coming back from Sprite Forge', () => {
  it('replaceAsset keeps the path (and where it was made), with a new id; undo brings the old one back', () => {
    const d = project();
    const old = d.importAsset('assets/hero.png', { mime: 'image/png', width: 16, height: 16, origin: 'sprite-forge:doc_1' });
    d.runCode('Hero', `scene.add('Sprite2D', { name: 'Hero', texture: 'assets/hero.png' })`);
    const id = d.replaceAsset('assets/hero.png', { mime: 'image/png', width: 24, height: 24 });
    expect(id).not.toBe(old);
    expect(d.project.assets.find((a) => a.path === 'assets/hero.png')).toMatchObject({ id, width: 24, origin: 'sprite-forge:doc_1' });
    expect(problems(d.project)).toEqual([]);
    expect(d.log.at(-1)?.code).toContain(`project.replaceAsset("assets/hero.png"`);
    d.undo();
    expect(d.project.assets.find((a) => a.path === 'assets/hero.png')).toMatchObject({ id: old, width: 16 });
  });
});
