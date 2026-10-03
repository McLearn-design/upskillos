import { describe, expect, it } from 'vitest';
import { makePrimitive } from './primitives';
import { EditMesh } from './EditMesh';
import { sharpEdges } from './uv';
import { traceCharts } from './chartTrace';
import { Trace } from './trace';

describe('charts', () => {
  it('a cube cut at its sharp edges: six square discs', () => {
    const m = makePrimitive('cube');
    const t = new Trace('Trace the charts');
    const cs = traceCharts(m, new Set(sharpEdges(m, 60)), t);
    expect(cs.length).toBe(6);
    expect(cs.every((c) => c.disc && c.chi === 1 && c.boundaries === 1)).toBe(true);
    expect(t.steps[0].quiz!.answer).toEqual([6]);
    expect(t.steps.map((s) => s.phase)).toEqual(['Seams', ...Array(6).fill('Grow charts'), 'Disc test', 'Wedges']);
  });

  it('a can cut at its rims: two disc caps and a tube that is not a disc, until one more cut', () => {
    const m = makePrimitive('cylinder', { segments: 12 });
    const rims = new Set(sharpEdges(m, 60));
    const cs = traceCharts(m, rims);
    expect(cs.map((c) => [c.F, c.chi, c.boundaries, c.disc]).sort()).toEqual([[1, 1, 1, true], [1, 1, 1, true], [12, 0, 2, false]]);
    // One vertical edge (vertex 0 at the bottom to vertex 12 at the top) opens the tube.
    rims.add(EditMesh.edgeKey(0, 12));
    expect(traceCharts(m, rims).every((c) => c.disc)).toBe(true);
  });

  it('no seams on a closed surface: one chart, χ = 2, not a disc', () => {
    const m = makePrimitive('uvSphere', { segments: 8, rings: 4 });
    expect(traceCharts(m, new Set())).toMatchObject([{ chi: 2, boundaries: 0, disc: false }]);
  });
});
