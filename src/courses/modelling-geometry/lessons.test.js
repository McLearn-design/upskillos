// Checks for the Modelling & Geometry Processing course that the lesson
// checkers can't make: every link into MeshLab opens something real, the
// notebook challenges grade correctly, and cells print what the prose says.
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { meshLabLink, parseMeshLabLink } from '../../labs/mesh-lab/links';
import lesson1, { checkHouse } from './1-meshes-as-data/001-vertices-and-faces.js';

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
