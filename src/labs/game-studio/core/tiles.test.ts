// Tile maths, tilesets and tile layers in the model.
import { describe, expect, it } from 'vitest';
import { applyEdits, bucketEdits, rectEdits, solidRects, textEdits, tileRect, tilesetGrid } from './tiles';
import { Doc } from './doc';
import { newProject } from './project';
import { runSceneCode } from './api';
import { deserialize, problems, serialize } from './serialize';

describe('tile maths', () => {
  it('a tileset grid counts tiles with margin and spacing: (size − 2·margin + spacing) / (tile + spacing)', () => {
    // Pixel Platformer's sheet: 20 × 9 tiles of 18 px with 1 px between them is 379 × 170.
    expect(tilesetGrid({ tileWidth: 18, tileHeight: 18, margin: 0, spacing: 1 }, 379, 170)).toEqual({ columns: 20, rows: 9, count: 180 });
    expect(tileRect({ tileWidth: 18, tileHeight: 18, margin: 0, spacing: 1 }, 20, 21)).toEqual({ x: 19, y: 19, w: 18, h: 18 });
  });
  it('edits keep the list in order (by y, then x), replace a cell, and −1 erases', () => {
    expect(applyEdits([5, 0, 1], [[1, 1, 2], [0, 0, 3], [5, 0, -1]])).toEqual([0, 0, 3, 1, 1, 2]);
  });
  it('a rectangle fill covers its corners in any order', () => {
    expect(rectEdits(2, 1, 1, 0, 7)).toEqual([[1, 0, 7], [2, 0, 7], [1, 1, 7], [2, 1, 7]]);
  });
  it('bucket fill replaces the joined area of the same tile and stops at other tiles and at the bounds', () => {
    // A ring of tile 1 round an empty middle: filling the middle fills only it.
    const ring = textEdits(['111', '1 1', '111'], { 1: 1 });
    const cells = applyEdits([], ring);
    expect(bucketEdits(cells, 1, 1, 5, { x0: -9, y0: -9, x1: 9, y1: 9 })).toEqual([[1, 1, 5]]);
    // Outside the ring the empty area is bounded only by the bounds: a 3 × 3 box minus the ring is none.
    expect(bucketEdits(cells, 0, 0, 1, { x0: 0, y0: 0, x1: 2, y1: 2 })).toEqual([]);
    expect(bucketEdits(cells, 0, 0, 2, { x0: 0, y0: 0, x1: 2, y1: 2 })).toHaveLength(8);
  });
  it('solid tiles merge into rectangles: a floor of 10 is one, an L-shape is two, and seams are gone', () => {
    const floor = applyEdits([], rectEdits(0, 5, 9, 5, 1));
    expect(solidRects(floor, new Set([1]))).toEqual([{ x: 0, y: 5, w: 10, h: 1 }]);
    const ell = applyEdits([], textEdits(['#  ', '#  ', '###'], { '#': 1 }));
    expect(solidRects(ell, new Set([1]))).toEqual([{ x: 0, y: 0, w: 1, h: 2 }, { x: 0, y: 2, w: 3, h: 1 }]);
    expect(solidRects(ell, new Set([2]))).toEqual([]);
  });
});

describe('tilesets and tile layers in the project', () => {
  function sample() {
    const d = new Doc(newProject('Tiles'));
    const s = d.createScene('scenes/main.scene');
    d.importAsset('assets/tiles.png', { mime: 'image/png', width: 64, height: 32 });   // 4 × 2 tiles of 16
    d.createTileset('tilesets/world.tileset', { image: 'assets/tiles.png', tileWidth: 16, tileHeight: 16, solid: [1] });
    const layer = d.addNode(s.id, 'TileMapLayer', undefined, { name: 'Walls', props: { tileset: 'tilesets/world.tileset' } });
    return { d, s, layer };
  }

  it('painting is one command per stroke, logged as paint(...), and the whole log replays to the same project', () => {
    const { d, s, layer } = sample();
    d.paintCells(s.id, layer.id, [[0, 0, 1], [1, 0, 1]]);
    d.paintCells(s.id, layer.id, [[0, 0, -1]]);
    expect(d.log.at(-2)!.code).toBe('scene.get("Walls").paint([[0, 0, 1], [1, 0, 1]])');
    d.setTileset('tilesets/world.tileset', 'solid', [1, 2]);
    expect(d.log.at(-1)!.code).toBe('project.tileset("tilesets/world.tileset").solid = [1, 2]');
    const replay = newProject('Tiles');
    runSceneCode(replay, d.log.map((l) => l.code).join('\n'));
    expect(serialize(replay)).toBe(serialize(d.project));
    expect(d.node(s.id, layer.id)!.props.cells).toEqual([1, 0, 1]);
    expect(problems(d.project)).toEqual([]);
  });

  it('fromText draws a map from text, and fill a rectangle', () => {
    const { d, s } = sample();
    d.runCode('Build', `const w = scene.get('Walls')\nw.fromText(['#.#'], { '#': 1, '.': 0 }, { x: 2, y: 3 })\nw.fill(0, 0, 2, 1, 3)`);
    expect(d.node(s.id, d.scene(s.id).root.children[0].id)!.props.cells).toEqual([0, 0, 3, 1, 0, 3, 2, 3, 1, 3, 3, 0, 4, 3, 1]);
  });

  it('the problem report names a missing tileset, a missing tileset image, and a tile the tileset does not have', () => {
    const { d, s, layer } = sample();
    d.paintCells(s.id, layer.id, [[0, 0, 9]]);
    const p = JSON.parse(serialize(d.project));
    p.tilesets.push({ path: 'tilesets/gone.tileset', image: 'assets/gone.png', tileWidth: 8, tileHeight: 8, margin: 0, spacing: 0, solid: [] });
    p.scenes[0].root.children.push({ id: 'n99', type: 'TileMapLayer', name: 'Other', props: { tileset: 'tilesets/none.tileset' }, script: null, children: [] });
    p.nextId = 100;
    expect(problems(p)).toEqual([
      'tilesets/gone.tileset: missing image "assets/gone.png"',
      'scenes/main.scene: Walls: cell 0, 0 uses tile 9, but the tileset has 8 tiles (0 to 7)',
      'scenes/main.scene: Other: missing tileset "tilesets/none.tileset"',
    ]);
  });

  it('refuses a bad tileset, naming what is wrong', () => {
    const { d } = sample();
    expect(() => d.createTileset('tiles/x.tileset', { image: 'assets/tiles.png', tileWidth: 16, tileHeight: 16 })).toThrow(/must be in tilesets\//);
    expect(() => d.createTileset('tilesets/x.tileset', { image: 'assets/tiles.png', tileWidth: 0, tileHeight: 16 })).toThrow(/whole numbers of pixels from 1/);
    expect(() => d.createTileset('tilesets/x.tileset', { image: 'assets/none.png', tileWidth: 16, tileHeight: 16 })).toThrow(/no image "assets\/none.png"/);
  });

  it('a format 1 project (before tilesets) loads, upgraded to format 2 with no tilesets', () => {
    const p = JSON.parse(serialize(newProject('Old')));
    delete p.tilesets; p.formatVersion = 1;
    const loaded = deserialize(JSON.stringify(p));
    expect(loaded.formatVersion).toBe(2);
    expect(loaded.tilesets).toEqual([]);
    expect(Object.keys(loaded)).toEqual(Object.keys(newProject('Old')));   // the same key order, so it saves the same
  });
});
