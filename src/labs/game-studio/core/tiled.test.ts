// Importing Tiled maps: Kenney's own sample (XML, an external tileset, flip flags), and JSON maps
// with the other forms Tiled writes.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { matchImage, planImport, readMap, readTileset } from './tiled';
import { parseXml } from './xml';
import { Doc } from './doc';
import { newProject } from './project';
import { problems } from './serialize';
import { tileFlags, tileId } from './tiles';

const starter = (p: string) => readFileSync(fileURLToPath(new URL(`../starter/${p}`, import.meta.url)), 'utf8');
const SHEET = 'assets/tiny-dungeon/tilemap/tilemap.png';   // 203 × 186: 12 × 11 tiles of 16 px, 1 px apart

describe('the XML reader', () => {
  it('reads elements, attributes, text and entities, and says where it is broken', () => {
    const x = parseXml('<?xml version="1.0"?><!-- hi --><a k="1 &amp; 2"><b/>text &lt;3<c x=\'y\'></c></a>');
    expect([x.name, x.attrs.k, x.children.map((c) => c.name), x.text]).toEqual(['a', '1 & 2', ['b', 'c'], 'text <3']);
    expect(() => parseXml('<a><b></a>')).toThrow(/<\/a> closes <b>/);
    expect(() => parseXml('<a>')).toThrow(/never closed/);
  });
});

describe('Kenney’s Tiny Dungeon sample map', () => {
  const map = readMap(starter('tiny-dungeon/tiled/sample-map.tmx'));
  const ts = readTileset(starter('tiny-dungeon/tiled/sampleSheet.tsx.xml'));

  it('reads the map: 32 × 20 tiles of 16 px, three tile layers, one external tileset', () => {
    expect([map.orientation, map.width, map.height, map.tilewidth]).toEqual(['orthogonal', 32, 20, 16]);
    expect(map.layers).toHaveLength(3);
    expect(map.layers[0].data).toHaveLength(32 * 20);
    expect(map.tilesets).toEqual([{ firstgid: 1, source: 'sampleSheet.tsx' }]);
    expect(ts).toMatchObject({ name: 'tileset', tilewidth: 16, tileheight: 16, spacing: 1, columns: 12, image: '../Tilemap/tilemap.png' });
  });

  it('keeps Tiled’s flip flags: 1610612787 is tile 50 (gid 51) flipped vertically and diagonally', () => {
    expect(tileId(1610612787)).toBe(51);
    expect(tileFlags(1610612787)).toBe(0b011);
  });

  it('becomes Scene API code that builds a sound project: a tileset on the matching image, and a layer per Tiled layer', () => {
    const d = new Doc(newProject());
    const s = d.createScene('scenes/main.scene');
    d.importAsset(SHEET, { mime: 'image/png', width: 203, height: 186 });
    const plan = planImport(map, 'sample-map.tmx', { tilesetFiles: new Map([['sampleSheet.tsx', starter('tiny-dungeon/tiled/sampleSheet.tsx.xml')]]), findImage: (p) => matchImage(p, [SHEET]), existing: new Set(), scenePath: s.path });
    d.runCode('Import sample-map.tmx', plan.code);
    expect(problems(d.project)).toEqual([]);
    expect(d.project.tilesets).toEqual([{ path: 'tilesets/tileset.tileset', image: SHEET, tileWidth: 16, tileHeight: 16, margin: 0, spacing: 1, solid: [] }]);
    const layers = d.scene(s.id).root.children;
    expect(layers.map((l) => l.type)).toEqual(['TileMapLayer', 'TileMapLayer', 'TileMapLayer']);
    // The first cell of the first layer: gid 14 → tile 13.
    expect((layers[0].props.cells as number[]).slice(0, 3)).toEqual([0, 0, 13]);
    // A flipped cell keeps its flags: (1, 0) was gid 51 with flags 0b011.
    const cells = layers[0].props.cells as number[];
    expect(cells.slice(3, 6)).toEqual([1, 0, 50 + 3 * 2 ** 29]);
    expect(plan.notes[0]).toBe('tileset tilesets/tileset.tileset');
  });
});

describe('Tiled’s JSON maps', () => {
  const tsInline = { firstgid: 1, name: 'Ground tiles', image: 'art/ground.png', imagewidth: 32, imageheight: 16, tilewidth: 16, tileheight: 16, columns: 2, tilecount: 2, margin: 0, spacing: 0,
    tiles: [{ id: 1, properties: [{ name: 'solid', type: 'bool', value: true }] }] };
  const json = (layers: unknown[], extra: Record<string, unknown> = {}) => JSON.stringify({ type: 'map', orientation: 'orthogonal', width: 3, height: 2, tilewidth: 16, tileheight: 16, infinite: false, tilesets: [tsInline], layers, ...extra });
  const plan = (text: string, files = new Map<string, string>()) => planImport(readMap(text), 'level.tmj', { tilesetFiles: files, findImage: (p) => matchImage(p, ['assets/art/ground.png']), existing: new Set(), scenePath: 'scenes/main.scene' });

  it('reads array data, a solid property, layer offsets and hidden layers, and leaves object layers out (saying so)', () => {
    const p = plan(json([
      { type: 'tilelayer', name: 'Ground', width: 3, height: 2, data: [1, 2, 0, 0, 2, 1], visible: true, offsetx: 8, offsety: 0 },
      { type: 'objectgroup', name: 'Spawns', objects: [] },
    ]));
    expect(p.code).toContain('"solid": [1]'.replace('"solid"', 'solid'));
    expect(p.code).toContain('scene.add(\'TileMapLayer\', { name: "Ground", tileset: "tilesets/Ground_tiles.tileset", position: { x: 8, y: 0 } }).paint([[0, 0, 0], [1, 0, 1], [1, 1, 1], [2, 1, 0]])');
    expect(p.notes.at(-1)).toBe('not imported: Spawns (objects) (Game Studio imports tile layers)');
  });

  it('reads base64 data and an infinite map’s chunks', () => {
    const b64 = Buffer.from(new Uint32Array([1, 0, 2, 0, 0, 1]).buffer).toString('base64');
    expect(plan(json([{ type: 'tilelayer', name: 'L', width: 3, height: 2, encoding: 'base64', data: b64 }]))).toMatchObject({ code: expect.stringContaining('.paint([[0, 0, 0], [2, 0, 1], [2, 1, 0]])') });
    const inf = plan(json([{ type: 'tilelayer', name: 'L', width: 0, height: 0, chunks: [{ x: -16, y: 0, width: 2, height: 1, data: [2, 1] }] }], { infinite: true }));
    expect(inf.code).toContain('.paint([[-16, 0, 1], [-15, 0, 0]])');
  });

  it('says what to do when it cannot import: compressed layers, a missing tileset file, a missing image, another grid', () => {
    expect(() => plan(json([{ type: 'tilelayer', name: 'L', width: 3, height: 2, encoding: 'base64', compression: 'zlib', data: 'eJw=' }]))).toThrow(/compressed \(zlib\)[\s\S]*Tile Layer Format to CSV/);
    expect(() => plan(json([], { tilesets: [{ firstgid: 1, source: '../sets/ground.tsj' }] }))).toThrow(/uses the tileset file ground.tsj: choose it too/);
    expect(() => planImport(readMap(json([])), 'level.tmj', { tilesetFiles: new Map(), findImage: () => null, existing: new Set(), scenePath: 's' })).toThrow(/uses the image ground.png: import that image first/);
    expect(() => plan(json([], { orientation: 'isometric' }))).toThrow(/isometric; Game Studio imports orthogonal/);
  });

  it('a tileset name already used gets a number, and images match by the end of their path', () => {
    const p = planImport(readMap(json([])), 'level.tmj', { tilesetFiles: new Map(), findImage: () => 'assets/art/ground.png', existing: new Set(['tilesets/Ground_tiles.tileset']), scenePath: 's' });
    expect(p.code).toContain('tilesets/Ground_tiles2.tileset');
    expect(matchImage('../Tilemap/tilemap.png', ['assets/pixel-platformer/tilemap/tilemap_packed.png', SHEET, 'assets/x/tilemap.png'])).toBe(SHEET);
    expect(matchImage('nothing.png', [SHEET])).toBe(null);
  });
});
