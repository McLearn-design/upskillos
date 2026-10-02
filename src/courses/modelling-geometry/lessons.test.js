// Checks for the Modelling & Geometry Processing course that the lesson
// checkers can't make: every link into MeshLab opens something real, the
// notebook challenges grade correctly, and cells print what the prose says.
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { meshLabLink, parseMeshLabLink } from '../../labs/mesh-lab/links';
import lesson1, { checkHouse } from './1-meshes-as-data/001-vertices-and-faces.js';
import lesson2, { checkWinding } from './1-meshes-as-data/002-winding-and-normals.js';
import lesson3, { checkClosed } from './1-meshes-as-data/003-edges-and-neighbours.js';
import lesson4, { checkJoined } from './1-meshes-as-data/004-connected-pieces.js';
import lesson5, { checkFrame } from './1-meshes-as-data/005-eulers-formula.js';
import lesson6, { checkDistance } from './1-meshes-as-data/006-welding-and-filling.js';
import lesson7, { checkObj } from './1-meshes-as-data/007-obj-and-gltf.js';
import lesson21, { checkLight } from './2-vectors-and-transforms/001-vectors-dot-and-cross.js';
import lesson22, { checkMatrix } from './2-vectors-and-transforms/002-translate-rotate-scale.js';
import lesson23, { checkOrder } from './2-vectors-and-transforms/003-order-matters.js';
import lesson24, { checkScale } from './2-vectors-and-transforms/004-the-determinant.js';
import lesson25, { checkReach } from './2-vectors-and-transforms/005-hierarchies.js';

// fileURLToPath, not .pathname: on Windows a file URL keeps a leading slash
// before the drive letter and percent-encodes spaces, so the naive version
// builds 'C:\C:\...%20...' and every read from it fails. This test reported a
// missing file rather than whatever it was checking - a test that cannot run is
// not a test that passes.
const dir = fileURLToPath(new URL('.', import.meta.url));
const lessonFiles = readdirSync(dir)
  .filter((d) => statSync(join(dir, d)).isDirectory())
  .flatMap((d) => readdirSync(join(dir, d)).filter((f) => f.endsWith('.js')).map((f) => join(dir, d, f)));

describe('links into MeshLab', () => {
  const links = lessonFiles.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/#\/lab\/mesh-lab\?[^)\s'"]*/g)].map((m) => ({ file: f, href: m[0] })));

  it('the course has lessons, and they link into MeshLab', () => {
    expect(lessonFiles.length).toBeGreaterThan(0);
    expect(links.length).toBeGreaterThan(0);
  });

  it('every link names a project or challenge that exists', () => {
    for (const { file, href } of links) {
      const target = parseMeshLabLink(href);
      expect(target, `${file}: ${href}`).not.toBeNull();
      expect(() => meshLabLink(target.kind, target.id), `${file}: ${href}`).not.toThrow();
    }
  });
});

describe('lesson 1: a mesh is two lists', () => {
  const cells = lesson1.intuition.visualizations[0].props.lesson.cells;
  const challenge = cells.find((c) => c.type === 'challenge');
  const withFaces = (faces) => `const faces = ${faces};`;

  it('the house solution passes; the start is open, with every missing piece counted', () => {
    expect(checkHouse(challenge.solutionCode)).toMatchObject({ pass: true, message: expect.stringContaining('30 corner slots') });
    const start = checkHouse(challenge.startCode);
    expect(start.pass).toBe(false);
    expect(start.message).toMatch(/^1 face so far, and the house is still open: 15 of its 15 edges/);
    expect(start.message).toMatch(/Vertices 4, 5, 6, 7, 8, 9 aren’t in any face yet/);
  });

  it('any start corner and either direction is the same face', () => {
    const rotated = '[[1,2,3,0],[5,6,2,1],[4,0,3,7],[9,7,3,2,6],[8,5,1,0,4],[8,4,7,9],[6,5,8,9]]';
    expect(checkHouse(withFaces(rotated)).pass).toBe(true);
  });

  it('names each kind of mistake', () => {
    const say = (faces) => checkHouse(withFaces(faces)).message;
    expect(say('[[0,1,2,3],[1,5,6]]')).toMatch(/Face 1 goes straight from vertex 6 to vertex 1/);
    expect(say('[[0,1,3,2]]')).toMatch(/Face 0 goes straight from vertex 1 to vertex 3/); // the bow-tie
    expect(say('[[0,1,2,3],[1,5,10,2]]')).toMatch(/Face 1 uses vertex 10, but the vertices are numbered 0 to 9/);
    expect(say('[[0,1]]')).toMatch(/Face 0 has 2 corners/);
    expect(say('[[0,1,2,3],[0,1,1,2]]')).toMatch(/same corner twice/);
    expect(say('[[1,2,6,9,8,5]]')).toMatch(/don’t all lie in one flat plane/); // side wall + roof slope
    expect(say('[[0,1,2,3],[3,2,1,0]]')).toMatch(/Faces 0 and 1 cover the same piece/);
    expect(say('[[0,1,2,3],[0,1,5,8,4],[0,1,5,8,4,0]]')).toMatch(/same corner twice/);
    expect(say('oops')).toMatch(/Couldn’t read your face list/);
  });

  it('the reading cell prints the degrees and the two equal counts from the prose', () => {
    const reading = cells[2];
    const out = [];
    new Function('console', reading.startCode)({ log: (s) => out.push(s) });
    expect(out).toEqual([
      'face 2 = [2,1,4]',
      'its corners: [[1,0,1],[1,0,-1],[0,1.5,0]]',
      'degree of each vertex: [3,3,3,3,4]',
      'corner slots in the face list: 16   sum of degrees: 16',
      'no problems found',
    ]);
  });

  it('the separate-faces cell makes 16 vertices and names face 1’s tip 6', () => {
    const src = cells[1].startCode.slice(0, cells[1].startCode.indexOf('var slider'));
    const out = [];
    new Function('console', src)({ log: (s) => out.push(s) });
    expect(out).toEqual(['16 vertices, 5 faces', 'faces = [[0,1,2,3],[4,5,6],[7,8,9],[10,11,12],[13,14,15]]', 'face 1 calls its tip vertex 6']);
  });

  it('the worked cube follows its numbering rule, and every step round a face is a real edge', () => {
    const verts = Array.from({ length: 8 }, (_, i) => [i % 2, Math.floor(i / 2) % 2, Math.floor(i / 4)]);
    const faces = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]];
    const ex3 = lesson1.examples[2];
    expect(ex3.answer).toContain(JSON.stringify(verts).slice(1, -1).replace(/\],\[/g, '], ['));
    for (const f of faces) {
      f.forEach((a, k) => { const b = f[(k + 1) % 4]; expect(verts[a].filter((c, j) => c !== verts[b][j]).length).toBe(1); });
      // one side of the cube: its four corners share the coordinate fixed on that side
      expect([0, 1, 2].some((j) => f.every((i) => verts[i][j] === verts[f[0]][j]))).toBe(true);
    }
    expect(new Set(faces.flat()).size).toBe(8);
    expect(faces.flat().length).toBe(24);
  });
});

describe('lesson 2: winding and normals', () => {
  const cells = lesson2.intuition.visualizations[0].props.lesson.cells;
  const challenge = cells.find((c) => c.type === 'challenge');
  // A cell's own code, without the drawing appended by withPicture, run with a stand-in for show().
  const run = (cell) => {
    const src = cell.startCode.split('// ── drawing')[0];
    const out = [], shown = [];
    new Function('console', 'show', src)({ log: (...a) => out.push(a.join(' ')) }, (m) => shown.push(m));
    return { out, shown };
  };

  it('the cross-product cell prints the two opposite vectors from the prose', () => {
    expect(run(cells[0]).out).toEqual(['A, B, C: 0, 0, 2', 'A, C, B: 0, 0, -2']);
  });

  it('the Newell cell prints every pyramid normal pointing out, matching examples 2 and 3', () => {
    const { out, shown } = run(cells[1]);
    expect(out).toEqual([
      'face 0 normal 0, -1, 0',
      'face 1 normal 0, 0.555, -0.832',
      'face 2 normal 0.832, 0.555, 0',
      'face 3 normal 0, 0.555, 0.832',
      'face 4 normal -0.832, 0.555, 0',
    ]);
    expect(shown).toHaveLength(1);
  });

  it('the bent quad: two answers from three corners, Newell between them', () => {
    expect(run(cells[2]).out).toEqual([
      'first three corners: 0, -0.371, 0.928',
      'last three corners:  -0.371, 0, 0.928',
      'Newell, all four:    -0.192, -0.192, 0.962',
    ]);
  });

  it('the challenge: the solution passes, the start names both inward faces', () => {
    expect(checkWinding(challenge.solutionCode).pass).toBe(true);
    expect(checkWinding(challenge.startCode)).toEqual({ pass: false, message: expect.stringMatching(/^Faces 2 and 3 still point into the pyramid/) });
  });

  it('names each kind of mistake', () => {
    const list = (faces) => `const faces = [\n${faces.map((f) => `  ${JSON.stringify(f)},`).join('\n')}\n]`;
    const right = [[0, 1, 2, 3], [1, 0, 4], [2, 1, 4], [3, 2, 4], [0, 3, 4]];
    const say = (faces) => checkWinding(list(faces)).message;
    expect(checkWinding(list(right)).pass).toBe(true);
    expect(checkWinding(list([[1, 2, 3, 0], [0, 4, 1], [4, 2, 1], [2, 4, 3], [3, 4, 0]])).pass).toBe(true); // rotations
    expect(say([[0, 3, 2, 1], ...right.slice(1)])).toMatch(/^Face 0 still points into/);
    expect(say([...right.slice(0, 4), [0, 4, 3]])).toMatch(/^Face 4 still points into/);
    expect(say([...right.slice(0, 2), [2, 1, 3], ...right.slice(3)])).toMatch(/Face 2 now has different corners/);
    expect(say([[0, 2, 1, 3], ...right.slice(1)])).toMatch(/Face 0 now has different corners/); // a bow-tie
    expect(say(right.slice(0, 4))).toMatch(/has 4 entries/);
    expect(checkWinding('let faces = 1').message).toMatch(/Keep the list as const faces/);
    expect(checkWinding('const faces = [\n  [0, 1,\n]').message).toMatch(/could not be read|Keep the list/);
  });
});

describe('lesson 3: edges and neighbours', () => {
  const cells = lesson3.intuition.visualizations[0].props.lesson.cells;
  const challenge = cells.find((c) => c.type === 'challenge');
  const run = (cell) => {
    const src = cell.startCode.split('// ── drawing')[0];
    const out = [], shown = [];
    new Function('console', 'show', src)({ log: (...a) => out.push(a.join(' ')) }, (m) => shown.push(m));
    return { out, shown };
  };

  it('the cube: 12 edges, each on two faces, and 24 slots = 2 × 12', () => {
    const { out } = run(cells[0]);
    expect(out).toHaveLength(14);
    expect(out.slice(0, 12).every((l) => /^\d-\d: faces \d, \d$/.test(l))).toBe(true);
    expect(out.slice(12)).toEqual(['12 edges: 0 open, 12 shared by two faces', 'corner slots: 24 = 2 × 12']);
  });

  it('the unsorted key files each edge twice', () => {
    expect(run(cells[1]).out).toEqual(['24 entries, 24 of them with only one face', "'0-4': faces 0   '4-0': faces 2"]);
  });

  it('the open box: the four rim edges, the slot sum, and one picture', () => {
    const { out, shown } = run(cells[2]);
    expect(out).toEqual(['12 edges, 4 open: 2-6, 3-7, 2-3, 6-7', 'corner slots: 20 = 2 × 8 + 1 × 4']);
    expect(shown).toHaveLength(1);
  });

  it('neighbours match example 3, and the cost line matches the rigor section and challenge 3', () => {
    expect(run(cells[3]).out).toEqual(['face 0: 2, 4, -, 3', 'face 1: 3, -, 4, 2', 'face 2: 3, 1, 4, 0', 'face 3: 0, -, 1, 2', 'face 4: 2, 1, -, 0', '10000 quads: 49995000 pairs of faces to compare, or 40000 lookups']);
    expect(lesson3.examples[2].answer).toMatch(/^3, -, 4, 2/);
  });

  it('the challenge: the solution passes; the start names the fin\'s edge first', () => {
    expect(checkClosed(challenge.solutionCode).pass).toBe(true);
    expect(checkClosed(challenge.startCode).message).toMatch(/^Edge 0-1 is on 3 faces \(2, 3, 5\)\. /);
  });

  it('names each kind of mistake', () => {
    const list = (faces) => `const faces = [\n${faces.map((f) => `  ${JSON.stringify(f)},`).join('\n')}\n]`;
    const sides = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]];
    const say = (faces) => checkClosed(list(faces)).message;
    expect(checkClosed(list(sides)).pass).toBe(true);
    expect(say(sides.filter((_, i) => i !== 3))).toBe('Edges 2-6, 3-7, 2-3, 6-7 are on only one face: the surface is open there.');
    expect(say([...sides, [0, 1, 7, 6]])).toMatch(/^Edge 0-1 is on 3 faces \(2, 4, 6\), and so is edge 6-7\./);
    expect(say(sides.map((f, i) => (i === 3 ? [2, 3, 7, 6] : f)))).toMatch(/^Faces 0 and 3 both go from vertex 6 to vertex 2\./);
    expect(say([...sides, [0, 2, 6, 4]])).toMatch(/^Edge 0-4 is on 3 faces \(0, 2, 6\)/);   // a side listed twice
    expect(say([[0, 1, 2], [0, 2, 1]])).toMatch(/not every vertex is used/);
    expect(say([[0, 1], ...sides])).toMatch(/^Face 0 has 2 corners/);
    expect(say([[0, 1, 8, 2]])).toMatch(/numbered 0 to 7/);
    expect(say([[0, 1, 1, 2]])).toMatch(/same corner twice/);
    // Closed and consistent on all 8 corners, but not the six sides: each side cut into two triangles.
    expect(say(sides.flatMap(([a, b, c, d]) => [[a, b, c], [a, c, d]]))).toBe('The box has 6 sides; the list has 12 faces.');
  });
});

describe('lesson 4: connected pieces', () => {
  const cells = lesson4.intuition.visualizations[0].props.lesson.cells;
  const challenge = cells.find((c) => c.type === 'challenge');
  const run = (cell) => {
    const src = cell.startCode.split('// ── drawing')[0];
    const out = [], shown = [];
    new Function('console', 'show', src)({ log: (...a) => out.push(a.join(' ')) }, (m) => shown.push(m));
    return { out, shown };
  };

  it('breadth-first search: the queues of example 1, face 1 last, two pieces', () => {
    const { out } = run(cells[0]);
    expect(out.slice(0, 2)).toEqual(['visit 0: queue 2, 5, 3, 4', 'visit 2: queue 5, 3, 4, 1']);
    expect(out[5]).toBe('visit 1: queue empty');
    expect(out.filter((l) => l.startsWith('piece'))).toEqual(['piece 1: faces 0, 2, 5, 3, 4, 1', 'piece 2: faces 6, 8, 11, 9, 10, 7']);
    expect(lesson4.examples[0].answer).toBe('After face 0: 2, 5, 3, 4. After face 2: 5, 3, 4, 1.');
  });

  it('the shared corner: two pieces by edges, one by vertices, coloured by piece', () => {
    const { out, shown } = run(cells[1]);
    expect(out).toEqual(['15 vertices; by shared edges: 2 pieces; by shared vertices: 1 piece']);
    expect(shown[0].groups).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]);
  });

  it('a stack visits the same faces in another order', () => {
    expect(run(cells[2]).out).toEqual(['queue (breadth-first): 0, 2, 5, 3, 4, 1', 'stack (depth-first):   0, 4, 1, 3, 5, 2', 'same faces: true']);
  });

  it('the challenge: the solution passes; the start says two pieces', () => {
    expect(checkJoined(challenge.solutionCode).pass).toBe(true);
    expect(checkJoined(challenge.startCode).message).toBe('Still 2 pieces: faces 0 | 1.');
  });

  it('names each kind of mistake', () => {
    const list = (faces) => `const faces = [\n${faces.map((f) => `  ${JSON.stringify(f)},`).join('\n')}\n]`;
    const say = (...extra) => checkJoined(list([[0, 1, 2, 3], [4, 5, 6, 7], ...extra])).message;
    expect(checkJoined(list([[0, 1, 2, 3], [4, 5, 6, 7], [1, 4, 2], [4, 7, 2]])).pass).toBe(true);   // two triangles also join them
    expect(say([1, 4, 7])).toBe('Still 2 pieces: faces 0 | 1, 2. They meet only at vertex 1: pieces join where faces share an edge, not a corner.');
    expect(say([2, 7, 4, 1])).toMatch(/^Faces 0 and 2 both go from vertex 1 to vertex 2/);
    expect(say([1, 4, 7, 2], [1, 4, 7, 2])).toMatch(/^Edge 1-2 is on 3 faces \(0, 2, 3\)/);   // the bridge added twice
    expect(checkJoined(list([[0, 1, 2, 3], [1, 4, 7, 2]])).message).toMatch(/^Keep faces 0 and 1 as they are/);
    expect(say([1, 4])).toMatch(/^Face 2 has 2 corners/);
    expect(say([1, 4, 9])).toMatch(/numbered 0 to 7/);
  });
});

describe("lesson 5: Euler's formula", () => {
  const cells = lesson5.intuition.visualizations[0].props.lesson.cells;
  const challenge = cells.find((c) => c.type === 'challenge');
  const run = (cell) => {
    const src = cell.startCode.split('// ── drawing')[0];
    const out = [], shown = [];
    new Function('console', 'show', src)({ log: (...a) => out.push(a.join(' ')) }, (m) => shown.push(m));
    return { out, shown };
  };

  it('three solids give 2', () => {
    expect(run(cells[0]).out).toEqual(['cube:    8 − 12 + 6 = 2', 'pyramid: 5 − 8 + 5 = 2', 'prism:   6 − 9 + 5 = 2']);
  });

  it('Euler operations: the changes the math section lists, and χ stays 2 (example 2)', () => {
    expect(run(cells[1]).out).toEqual([
      'cube:                   8 − 12 + 6 = 2',
      'a diagonal on face 0:   8 − 13 + 7 = 2',
      'face 0 poked:           9 − 16 + 9 = 2',
      'face 1 extruded:        12 − 20 + 10 = 2',
    ]);
    expect(lesson5.examples[1].answer).toBe('V = 12, E = 20, F = 10, χ = 2: unchanged.');
  });

  it('the torus: nm, 2nm, nm', () => {
    const { out, shown } = run(cells[2]);
    expect(out).toEqual(['torus, 8 × 4: 32 − 64 + 32 = 0']);
    expect(shown).toHaveLength(1);
  });

  it('rims, holes and pieces', () => {
    expect(run(cells[3]).out).toEqual(['open box: 8 − 12 + 5 = 1, b = 1, g = 0', 'tube:     8 − 12 + 4 = 0, b = 2, g = 0', 'two cubes: 16 − 24 + 12 = 4: 2 for each piece']);
  });

  it('the challenge: the solution passes; the start names the open edges round the hole', () => {
    expect(checkFrame(challenge.solutionCode)).toEqual({ pass: true, message: expect.stringMatching(/^Closed, and V − E \+ F = 16 − 32 \+ 16 = 0/) });
    expect(checkFrame(challenge.startCode).message).toBe('Edges 12-13, 13-14, 14-15, 12-15, 4-5, 5-6, 6-7, 4-7 are on only one face: the frame is still open there.');
  });

  it('names each kind of mistake', () => {
    const shell = [[12, 13, 9, 8], [13, 14, 10, 9], [14, 15, 11, 10], [15, 12, 8, 11], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [8, 9, 1, 0], [9, 10, 2, 1], [10, 11, 3, 2], [11, 8, 0, 3]];
    const walls = [[4, 5, 13, 12], [5, 6, 14, 13], [6, 7, 15, 14], [7, 4, 12, 15]];
    const list = (faces) => `const faces = [\n${faces.map((f) => `  ${JSON.stringify(f)},`).join('\n')}\n]`;
    const say = (faces) => checkFrame(list(faces)).message;
    expect(checkFrame(list([...shell, ...walls])).pass).toBe(true);
    expect(say([...shell, [12, 13, 14, 15].reverse(), [4, 5, 6, 7]])).toMatch(/^Closed, but V − E \+ F = 16 − 28 \+ 14 = 2: that is a sphere's count/);   // the hole capped
    expect(say([...shell, walls[0], walls[1], walls[2], [7, 15, 12, 4]])).toMatch(/^Faces 3 and 15 both go from vertex 15 to vertex 12/);
    expect(say([...shell, ...walls, walls[0]])).toMatch(/^Edge 12-13 is on 3 faces \(0, 12, 16\)/);   // a wall listed twice
    expect(say([...shell, [4, 5, 16]])).toMatch(/numbered 0 to 15/);
  });
});

describe('lesson 6: welding and filling', () => {
  const cells = lesson6.intuition.visualizations[0].props.lesson.cells;
  const challenge = cells.find((c) => c.type === 'challenge');
  const run = (cell) => {
    const src = cell.startCode.split('// ── drawing')[0];
    const out = [], shown = [];
    new Function('console', 'show', src)({ log: (...a) => out.push(a.join(' ')) }, (m) => shown.push(m));
    return { out, shown };
  };

  it('floating point: equal fails, within a distance holds', () => {
    expect(run(cells[0]).out).toEqual(['0.1 + 0.2 === 0.3: false', '0.1 + 0.2 = 0.30000000000000004', 'within 1e-9: true']);
  });

  it('cell walls, both ways of choosing cells', () => {
    expect(run(cells[1]).out).toEqual([
      'rounding: 0.0049 → cell 0, 0.0051 → cell 1: 0.0002 apart, different cells',
      'flooring: 0.0099 → cell 0, 0.0101 → cell 1: the same problem at another wall',
      '0.0101 looks in cells 0, 1, 2 and finds 0.0099, 0.0002 away',
    ]);
  });

  it('the scanned box: 20 → 8 vertices, 4 open edges left (example 2)', () => {
    const { out, shown } = run(cells[2]);
    expect(out.slice(0, 2)).toEqual(['as scanned:          20 vertices, 20 edges, 20 open', 'welded within 0.001: 8 vertices, 12 edges, 4 open']);
    expect(out[2].split(' ')).toHaveLength(3 + 20);   // 'copy → vertex:' and one number per copy
    expect(shown[0].verts).toHaveLength(8);
  });

  it('the fill: the lid of example 3, and the box closed', () => {
    const { out } = run(cells[3]);
    expect(out).toHaveLength(3);
    const lid = out[1].replace('new face: ', '').split(', ').map(Number);
    const rotations = [0, 1, 2, 3].map((k) => [...[2, 6, 7, 3].slice(k), ...[2, 6, 7, 3].slice(0, k)].join());
    expect(rotations).toContain(lid.join());
    expect(out[2]).toBe('closed, every edge walked both ways: true');
  });

  it('the challenge: the window is the copy error up to the thickness', () => {
    const at = (d) => checkDistance(`const distance = ${d}`);
    expect(checkDistance(challenge.solutionCode).pass).toBe(true);
    expect(checkDistance(challenge.startCode).message).toMatch(/^At 0\.00001: 24 vertices and 24 open edges\. Some copies/);
    expect(at(0.0005).message).toMatch(/^At 0\.0005: 11 vertices/);
    expect([0.0006, 0.001, 0.04].map((d) => at(d).pass)).toEqual([true, true, true]);
    expect(at(0.06).message).toMatch(/^At 0\.06: 4 vertices and 2 faces\. That is too far/);
    expect(at(0).message).toBe('The distance must be more than 0.');
    expect(checkDistance('let d = 2').message).toMatch(/^Keep the line/);
  });
});

describe('lesson 7: OBJ and glTF', () => {
  const cells = lesson7.intuition.visualizations[0].props.lesson.cells;
  const challenge = cells.find((c) => c.type === 'challenge');
  const run = (cell) => {
    const src = cell.startCode.split('// ── drawing')[0];
    const out = [], shown = [];
    new Function('console', 'show', src)({ log: (...a) => out.push(a.join(' ')) }, (m) => shown.push(m));
    return { out, shown };
  };

  it('writes the pyramid as OBJ, every corner plus 1 (example 1)', () => {
    expect(run(cells[0]).out).toEqual(['o Pyramid\nv -1 0 -1\nv 1 0 -1\nv 1 0 1\nv -1 0 1\nv 0 1.5 0\nf 1 2 3 4\nf 2 1 5\nf 3 2 5\nf 4 3 5\nf 1 4 5']);
  });

  it('reads it back, slashes and negative numbers included (example 2)', () => {
    expect(run(cells[1]).out).toEqual(['5 vertices; faces [[0,1,2,3],[1,0,4],[2,1,4],[3,2,4],[0,3,4]]', 'same as the lists we started from: true']);
  });

  it('the glTF sizes the math section works out', () => {
    expect(run(cells[2]).out).toEqual([
      'triangles: 6 (the square base became 2)',
      'positions: 5 × 3 floats × 4 bytes = 60 bytes',
      'indices: 18 × 2 bytes = 36 bytes',
      'buffer: 96 bytes, 128 characters of base64',
      'position accessor: {"bufferView":0,"componentType":5126,"count":5,"type":"VEC3","min":[-1,0,-1],"max":[1,1.5,1]}',
    ]);
  });

  it('decoding gives back the same points and 6 triangles', () => {
    const { out, shown } = run(cells[3]);
    expect(out).toEqual(['decoded: 5 vertices, 6 triangles', 'the same points: true']);
    expect(shown[0].faces).toEqual([[0, 1, 2], [0, 2, 3], [1, 0, 4], [2, 1, 4], [3, 2, 4], [0, 3, 4]]);
  });

  it('the challenge: the solution passes; the start names the 0', () => {
    expect(checkObj(challenge.solutionCode).pass).toBe(true);
    expect(checkObj(challenge.startCode).message).toBe('"f 0 1 2 3": OBJ counts vertices from 1, so there is no vertex 0.');
    // The buggy file still reads two faces, both wrong: the lines without a 0 shift every corner by one.
    expect(run(challenge).out[0]).toBe('2 faces read: [[1,0,3],[2,1,3]]');
  });

  it('names each kind of mistake', () => {
    const file = (f) => `const obj = \`o Pyramid\nv -1 0 -1\nv 1 0 -1\nv 1 0 1\nv -1 0 1\nv 0 1.5 0\n${f.join('\n')}\``;
    const right = ['f 1 2 3 4', 'f 2 1 5', 'f 3 2 5', 'f 4 3 5', 'f 1 4 5'];
    const say = (f) => checkObj(file(f)).message;
    expect(checkObj(file(right)).pass).toBe(true);
    expect(checkObj(file(['f 2 3 4 1', 'f -4 -5 -1', 'f 3 2 5', 'f 4 3 5', 'f 1 4 5'])).pass).toBe(true);   // rotations and negatives read the same
    expect(say(['f 1 2 3 4', 'f 2 1 6', ...right.slice(2)])).toBe('"f 2 1 6" names vertex 6, but the file has 5 vertices.');
    expect(say(['f 4 3 2 1', ...right.slice(1)])).toMatch(/^"f 4 3 2 1" reads as a face going the wrong way round/);
    expect(say(['f 1 2 5', ...right.slice(1)])).toMatch(/^"f 1 2 5" reads as a face going the wrong way round/);   // face 1 reversed
    expect(say(['f 1 3 5', ...right.slice(1)])).toMatch(/^"f 1 3 5" reads as corners 0, 2, 4, which is not a face/);
    expect(say([...right.slice(0, 4), 'f 2 1 5'])).toBe('Two f lines are the same face, so one face of the pyramid is missing.');
    expect(say(right.slice(0, 4))).toBe('The pyramid has 5 faces; the file has 4 f lines.');
    expect(checkObj('const obj = `o P\nv 0 0 0`').message).toMatch(/^Leave the five v lines/);
  });
});

describe('lesson 2.1: vectors, dot and cross', () => {
  const cells = lesson21.intuition.visualizations[0].props.lesson.cells;
  const challenge = cells.find((c) => c.type === 'challenge');
  const run = (cell) => {
    const src = cell.startCode.split('// ── drawing')[0];
    const out = [], shown = [];
    new Function('console', 'show', src)({ log: (...a) => out.push(a.join(' ')) }, (m) => shown.push(m));
    return { out, shown };
  };

  it('vectors and lengths (example 1)', () => {
    expect(run(cells[0]).out).toEqual(['u = 2, 0, 0   |u| = 2', 'v = 1, 1.5, 1   |v| = 2.0616', 'v made length 1: 0.4851, 0.7276, 0.4851']);
  });

  it('angles: 60.98°, 90°, 135°', () => {
    expect(run(cells[1]).out).toEqual([
      'base corner to the tip : u · v = 2, angle 60.9829°',
      'two base edges         : u · v = 0, angle 90°',
      'out and back           : u · v = -1, angle 135°',
    ]);
  });

  it('projection: the height agrees with the cross product', () => {
    expect(run(cells[2]).out).toEqual(['along u: 1, 0, 0   at right angles: 0, 1.5, 1', 'check: (part at right angles) · u = 0', 'area = ½ × base × height = 1.8028;  ½ |u × v| = 1.8028']);
  });

  it('the lit sphere: every face points out, and the lit faces face the light', () => {
    const { out, shown } = run(cells[3]);
    const { verts, faces, values } = shown[0];
    for (const f of faces) {
      const c = f.map((k) => verts[k]), e1 = c[1].map((x, i) => x - c[0][i]), e2 = c[2].map((x, i) => x - c[0][i]);
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const mid = c.reduce((a, p) => a.map((x, i) => x + p[i] / c.length), [0, 0, 0]);
      expect(n[0] * mid[0] + n[1] * mid[1] + n[2] * mid[2]).toBeGreaterThan(0);
    }
    expect(values.every((x) => x >= 0 && x <= 1)).toBe(true);
    expect(out[0]).toMatch(/^96 faces, \d+ lit; brightest n · l = 0\.9\d+$/);
  });

  it('the challenge: the solution passes; the start is 56° off; face 4 lit is named', () => {
    const at = (l) => checkLight(`const light = [${l}]`);
    expect(checkLight(challenge.solutionCode).pass).toBe(true);
    expect(checkLight(challenge.startCode).message).toBe('Face 2 gets n · l = 0.555: the light is 56.3° away from its normal, so it gets cos 56.3° of full brightness.');
    expect(at('0.832, 0.555, 0').pass).toBe(true);
    expect(at('0, 0, 0').message).toMatch(/has none/);
    expect(at('1, 2').message).toMatch(/^Keep the line/);
    expect(at('-0.832, -0.555, 0').message).toMatch(/^Face 2 gets n · l = -1\.000/);
  });
});

describe('lesson 2.2: translate, rotate, scale', () => {
  const cells = lesson22.intuition.visualizations[0].props.lesson.cells;
  const challenge = cells.find((c) => c.type === 'challenge');
  const run = (cell) => {
    const src = cell.startCode.split('// ── drawing')[0];
    const out = [], shown = [];
    new Function('console', 'show', src)({ log: (...a) => out.push(a.join(' ')) }, (m) => shown.push(m));
    return { out, shown };
  };
  // The same five places MeshLab's project prints (projects.test.ts).
  const placed = ['0.634, 0, -1.366', '2.366, 0, -2.366', '3.366, 0, -0.634', '1.634, 0, 0.366', '2, 3, -1'];

  it('by hand: the places MeshLab draws them', () => {
    const out = run(cells[0]).out;
    expect(out.map((l) => l.split(' → ')[1])).toEqual(placed);
  });

  it('the rotation matrix: axes and lengths', () => {
    expect(run(cells[1]).out).toEqual(['x axis → 0.866, 0, -0.5', 'y axis → 0, 1, 0', 'z axis → 0.5, 0, 0.866', '|v| = 1.4142, |Rv| = 1.4142']);
  });

  it('M = T·R·S gives the same places, and its fourth column is the position', () => {
    const { out, shown } = run(cells[2]);
    expect(out.slice(0, 4)).toEqual(['[ 0.866  0  0.5  2 ]', '[ 0  2  0  0 ]', '[ -0.5  0  0.866  -1 ]', '[ 0  0  0  1 ]']);
    expect(out[4]).toBe(`v0 → ${placed[0]},  tip → ${placed[4]}`);
    expect(shown[0].verts).toHaveLength(10);
  });

  it('the challenge: the solution passes; identity, S·T and a bad bottom row are each named', () => {
    const rows = (m) => `const M = [\n${m.map((r) => `  [${r.join(', ')}],`).join('\n')}\n]`;
    expect(checkMatrix(challenge.solutionCode).pass).toBe(true);
    expect(checkMatrix(challenge.startCode).message).toBe('M sends v0 (-1, 0, -1) to (-1, 0, -1); it should go to (2, 1, -1).');
    expect(checkMatrix(rows([[1, 0, 0, 3], [0, 2, 0, 2], [0, 0, 1, 0], [0, 0, 0, 1]])).message).toMatch(/^M sends the tip to \(3, 5, 0\): it moves first/);
    expect(checkMatrix(rows([[1, 0, 0, 0], [0, 2, 0, 0], [0, 0, 1, 0], [3, 1, 0, 1]])).message).toMatch(/^The bottom row is 3, 1, 0, 1/);
    expect(checkMatrix(rows([[1, 0, 0, 3], [0, 2, 0, 1], [0, 0, 1, 0]])).message).toMatch(/^M should be 4 rows of 4 numbers/);
  });
});

describe('lesson 2.3: order matters', () => {
  const cells = lesson23.intuition.visualizations[0].props.lesson.cells;
  const challenge = cells.find((c) => c.type === 'challenge');
  const run = (cell) => {
    const src = cell.startCode.split('// ── drawing')[0];
    const out = [], shown = [];
    new Function('console', 'show', src)({ log: (...a) => out.push(a.join(' ')) }, (m) => shown.push(m));
    return { out, shown };
  };

  it('R·S and S·R: the columns the math section lists', () => {
    expect(run(cells[0]).out).toEqual(['R·S: [1.4142 0 0.3536] [0 0.5 0] [-1.4142 0 0.3536]', 'S·R: [1.4142 0 1.4142] [0 0.5 0] [-0.3536 0 0.3536]', 'the same: false']);
  });

  it('the boxes: 90° and 28.07° (the angle MeshLab asks for)', () => {
    const { out, shown } = run(cells[1]);
    expect(out).toEqual(['stretch then turn: corner angle 90°', 'turn then stretch: corner angle 28.0725°']);
    expect(shown[0].verts).toHaveLength(16);
  });

  it('moves and turns, and two turns (example 1)', () => {
    expect(run(cells[2]).out).toEqual(['turn, then move: 3, 0, 0   (turns in place, then moves)', 'move, then turn: 0, 0, -3   (swings round the world origin)', 'turn x then y: 0, 0, -1', 'turn y then x: 0, 1, 0']);
  });

  it('decompose: the sheared matrix fails the right-angle check', () => {
    expect(run(cells[3]).out).toEqual(['stretch then turn: scale 2, 0.5, 0.5; angles between columns 90°, 90°, 90°', 'turn then stretch: scale 1.4577, 0.5, 1.4577; angles between columns 90°, 28.0725°, 90°']);
  });

  it('the challenge: every wrong order is named for what it did', () => {
    const say = (o) => checkOrder(`const order = [${o.map((x) => `'${x}'`).join(', ')}]`).message;
    expect(checkOrder(challenge.solutionCode).pass).toBe(true);
    expect(checkOrder(challenge.startCode).message).toMatch(/^It is 2 × 1 × 1: long along x, not z\. It was stretched after it was turned/);
    expect(say(['move', 'rotate', 'scale'])).toBe("Its centre ends at (6, 0, 0), not (0, 0, 3): it was moved before it was turned, so the turn swung it round the world's origin, and then the stretch along x pulled it further out.");
    expect(say(['move', 'scale', 'rotate'])).toBe("Its centre ends at (3, 0, 0), not (0, 0, 3): it was moved before it was turned, so the turn swung it round the world's origin.");
    expect(say(['scale', 'move', 'rotate'])).toMatch(/^Its centre ends at \(3, 0, 0\)/);
    expect(say(['rotate', 'scale', 'move'])).toMatch(/long along x, not z/);
    expect(say(['scale', 'rotate'])).toMatch(/each once/);
  });
});

describe('lesson 2.4: the determinant', () => {
  const cells = lesson24.intuition.visualizations[0].props.lesson.cells;
  const challenge = cells.find((c) => c.type === 'challenge');
  const run = (cell) => {
    const src = cell.startCode.split('// ── drawing')[0];
    const out = [], shown = [];
    new Function('console', 'show', src)({ log: (...a) => out.push(a.join(' ')) }, (m) => shown.push(m));
    return { out, shown };
  };

  it('areas in 2D', () => {
    expect(run(cells[0]).out).toEqual(['stretch x by 2: det 2', 'shear (slant): det 1', 'swap x and y (a mirror): det -1', 'squash onto a line: det 0']);
  });

  it('volumes in 3D: the two orders of lesson 2.3 have the same determinant', () => {
    expect(run(cells[1]).out).toEqual(['scale (2, 1, 0.5): det 1', 'turn 30° about y: det 1', 'mirror x: det -1', 'shear: det 1', 'turn, then stretch (2, 0.5, 0.5): det 0.5', 'stretch, then turn: det 0.5']);
  });

  it('signed volume equals the determinant, as MeshLab reports for the mirrored box', () => {
    expect(run(cells[2]).out).toEqual(['unit box: volume 1', 'turned, then stretched: volume 0.5, det 0.5', 'mirrored and widened: volume -1.5, det -1.5']);
  });

  it('a mirror turns every face inside out', () => {
    const { out, shown } = run(cells[3]);
    expect(out).toEqual(['before: 5 of 5 faces point out', 'mirrored: 0 of 5 faces point out']);
    expect(shown).toHaveLength(1);
  });

  it('the challenge: each wrong scale is named', () => {
    const at = (v) => checkScale(`const scale = [${v}]`).message;
    expect(checkScale(challenge.solutionCode).pass).toBe(true);
    expect(checkScale('const scale = [-1, 1, 2]').pass).toBe(true);
    expect(checkScale(challenge.startCode).message).toMatch(/^det = 1, which is positive: nothing is mirrored/);
    expect(at('-2, 2, 1')).toMatch(/^The y scale is 2/);
    expect(at('-2, 1, -1')).toMatch(/two mirrors make a half turn/);
    expect(at('2, 1, -1')).toMatch(/front to back/);
    expect(at('-1, 1, 1')).toMatch(/multiplied by 1, not 2/);
    expect(at('0, 1, 1')).toMatch(/squashes the pyramid flat/);
  });
});

describe('lesson 2.5: hierarchies', () => {
  const cells = lesson25.intuition.visualizations[0].props.lesson.cells;
  const challenge = cells.find((c) => c.type === 'challenge');
  const run = (cell) => {
    const src = cell.startCode.split('// ── drawing')[0];
    const out = [], shown = [];
    new Function('console', 'show', src)({ log: (...a) => out.push(a.join(' ')) }, (m) => shown.push(m));
    return { out, shown };
  };

  it('by hand: the origins MeshLab\'s trace computes (example 3)', () => {
    expect(run(cells[0]).out).toEqual(['shoulder 0, 1, 0   elbow -1, 2.732, 0   hand -2.449, 3.12, 0']);
  });

  it('as matrices: the same origins, and the turns add to 75°', () => {
    expect(run(cells[1]).out).toEqual(['shoulder: origin 0, 1, 0, turned 30°', 'elbow: origin -1, 2.732, 0, turned 75°', 'hand: origin -2.449, 3.12, 0, turned 75°']);
  });

  it('turning the elbow moves only what is below it', () => {
    const { out, shown } = run(cells[2]);
    expect(out).toEqual(['elbow 0°: hand at -1.75, 4.031, 0', 'elbow 45°: hand at -2.449, 3.12, 0', 'elbow 90°: hand at -2.299, 1.982, 0']);
    expect(shown[0].groups).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3]);
  });

  it('re-parenting keeps the hand in place', () => {
    expect(run(cells[3]).out).toEqual(['hand, unparented: local position -2.449, 3.12, 0', 'hand under the shoulder: local position -1.061, 3.061, 0, turned 45°', 'check, shoulder × local = world: -2.449, 3.12, 0']);
  });

  it('the challenge: −60° reaches; others say which way to turn', () => {
    const at = (d) => checkReach(`const elbowDeg = ${d}`).message;
    expect(checkReach(challenge.solutionCode).pass).toBe(true);
    expect(run({ startCode: challenge.solutionCode }).out[0]).toBe('hand at -0.25, 4.031, 0, 0 from the target');
    expect(checkReach(challenge.startCode).message).toBe('At 0° the hand reaches (-1.75, 4.031, 0), 1.5 from the target. Turn the elbow clockwise (a smaller angle).');
    expect(at(-90)).toMatch(/anticlockwise \(a larger angle\)/);
    expect(checkReach('const elbowDeg = -60.5').pass).toBe(true);
    expect(checkReach('let a = 1').message).toMatch(/^Keep the line/);
  });
});
