// EditMesh is the foundation every MeshLab operation sits on, so its topology
// has to be right before anything is built on top of it.
//
// The tests that matter are the ones that would catch a structural mistake
// rather than a typo: after an extrude the solid must still be closed, the
// volume must have grown by the right amount, and the winding must not have
// flipped. Those three together are hard to pass by accident.

import { describe, it, expect } from 'vitest';
import { EditMesh, type Vec3 } from './EditMesh';

describe('a cube, as six quads', () => {
  it('is six quads and not twelve triangles', () => {
    const m = EditMesh.cube(1);
    expect(m.faces.length).toBe(6);
    expect(m.faces.every((f) => f.length === 4)).toBe(true);
    expect(m.stats().ngons).toEqual({ tris: 0, quads: 6, larger: 0 });
  });

  it('has 8 verts, 12 edges, 6 faces and satisfies Euler', () => {
    const s = EditMesh.cube(1).stats();
    expect(s.verts).toBe(8);
    expect(s.edges).toBe(12);
    expect(s.faces).toBe(6);
    // 8 - 12 + 6 = 2, the value for a single closed surface. Note this is the
    // QUAD count, not the triangulated 8 - 18 + 12 = 2 from the lessons: both
    // give 2, which is the point of the characteristic.
    expect(s.euler).toBe(2);
  });

  it('is closed, in one piece, and wound outward', () => {
    const s = EditMesh.cube(1).stats();
    expect(s.boundaryEdges).toBe(0);
    expect(s.nonManifoldEdges).toBe(0);
    expect(s.components).toBe(1);
    // Positive means outward. A cube wound inside out gives -1 here, and
    // nothing else in stats() can tell the difference.
    expect(s.volume).toBeCloseTo(1, 12);
    expect(s.area).toBeCloseTo(6, 12);
  });

  it('has every face normal pointing away from the centre', () => {
    const m = EditMesh.cube(1);
    for (let i = 0; i < m.faces.length; i++) {
      const n = m.faceNormal(i);
      const c = m.faceCenter(i);
      expect(n[0] * c[0] + n[1] * c[1] + n[2] * c[2]).toBeGreaterThan(0);
    }
  });

  it('reports an inside-out cube only through the sign of the volume', () => {
    const m = EditMesh.cube(1).flip();
    const s = m.stats();
    expect(s.boundaryEdges).toBe(0);
    expect(s.euler).toBe(2);
    expect(s.closed).toBe(true);
    expect(s.volume).toBeCloseTo(-1, 12);
  });

  it('validates clean', () => {
    expect(EditMesh.cube(1).validate()).toEqual([]);
  });
});

describe('the edge table', () => {
  it('treats a-b and b-a as one edge', () => {
    // Two triangles sharing an edge, wound so they traverse it oppositely -
    // which is what consistent winding means.
    const m = new EditMesh(
      [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]],
      [[0, 1, 2], [0, 2, 3]],
    );
    const shared = m.edges().get(EditMesh.edgeKey(0, 2));
    expect(shared?.faces.length).toBe(2);
    // 5 edges, not 6: the diagonal is shared, not counted twice.
    expect(m.edges().size).toBe(5);
  });

  it('holds a non-manifold edge instead of rejecting it', () => {
    // Three triangles meeting along one edge. A half-edge structure cannot
    // represent this; real imported files contain it.
    const m = new EditMesh(
      [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [0, -1, 0]],
      [[0, 1, 2], [0, 1, 3], [0, 1, 4]],
    );
    const e = m.edges().get(EditMesh.edgeKey(0, 1));
    expect(e?.faces.length).toBe(3);
    expect(m.nonManifoldEdges().length).toBe(1);
    expect(m.stats().closed).toBe(false);
    // And it must still be usable, not throw.
    expect(m.validate()).toEqual([]);
    expect(m.triangulate().indices.length).toBe(9);
  });

  it('says -1 for a neighbour across a non-manifold edge rather than guessing', () => {
    const m = new EditMesh(
      [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [0, -1, 0]],
      [[0, 1, 2], [0, 1, 3], [0, 1, 4]],
    );
    expect(m.neighbours(0)[0]).toBe(-1);
  });

  it('counts a lone triangle as three boundary edges', () => {
    const m = new EditMesh([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 1, 2]]);
    expect(m.boundaryEdges().length).toBe(3);
    expect(m.stats().closed).toBe(false);
  });
});

describe('importing the way a mesh file arrives', () => {
  const cube = EditMesh.cube(1);
  // Triangulate the cube, then throw the sharing away, which is what an STL is.
  const tri = cube.triangulate();
  const explodedVerts: Vec3[] = [];
  const explodedTris: number[] = [];
  for (let i = 0; i < tri.indices.length; i++) {
    const v = tri.indices[i];
    explodedVerts.push([tri.positions[v * 3], tri.positions[v * 3 + 1], tri.positions[v * 3 + 2]]);
    explodedTris.push(i);
  }

  it('keeps an exploded mesh exploded rather than silently welding it', () => {
    const m = EditMesh.fromTriangles(explodedVerts, explodedTris);
    const s = m.stats();
    expect(s.verts).toBe(36);
    expect(s.faces).toBe(12);
    expect(s.edges).toBe(36);
    expect(s.boundaryEdges).toBe(36);
    expect(s.euler).toBe(12);
    expect(s.closed).toBe(false);
    // Twelve separate triangles, not one object.
    expect(s.components).toBe(12);
  });

  it('welds it back to a closed solid with an exact comparison', () => {
    const m = EditMesh.fromTriangles(explodedVerts, explodedTris).weld(0);
    const s = m.stats();
    expect(s.verts).toBe(8);
    expect(s.faces).toBe(12);
    expect(s.edges).toBe(18);
    expect(s.boundaryEdges).toBe(0);
    expect(s.euler).toBe(2);
    expect(s.components).toBe(1);
    expect(s.volume).toBeCloseTo(1, 10);
  });

  it('treats no index buffer as every three vertices being their own triangle', () => {
    const flat = explodedVerts.flat();
    const m = EditMesh.fromTriangles(flat);
    expect(m.faces.length).toBe(12);
    expect(m.stats().boundaryEdges).toBe(36);
  });

  it('drops faces a weld has collapsed below three corners', () => {
    // A tolerance the size of the cube merges everything into one point.
    const m = EditMesh.fromTriangles(explodedVerts, explodedTris).weld(4);
    expect(m.faces.length).toBe(0);
    expect(m.validate()).toEqual([]);
  });
});

describe('extrude', () => {
  it('keeps the solid closed and grows the volume by distance x area', () => {
    const m = EditMesh.cube(1);
    const top = m.faces.findIndex((_, i) => m.faceNormal(i)[2] > 0.99);
    expect(top).toBeGreaterThanOrEqual(0);

    const area = m.faceArea(top);
    m.extrudeFaces([top], 0.5);

    const s = m.stats();
    // Still closed: the walls filled every edge the lifted cap left behind.
    expect(s.boundaryEdges).toBe(0);
    expect(s.nonManifoldEdges).toBe(0);
    expect(s.components).toBe(1);
    expect(s.euler).toBe(2);
    // 4 new verts, 4 new walls.
    expect(s.verts).toBe(12);
    expect(s.faces).toBe(10);
    // And the winding survived: positive, and exactly the added box.
    expect(s.volume).toBeCloseTo(1 + 0.5 * area, 10);
  });

  it('walls only the border of a multi-face region, not the seams inside it', () => {
    const m = EditMesh.cube(1);
    const top = m.faces.findIndex((_, i) => m.faceNormal(i)[2] > 0.99);
    m.subdivideFaces([top]);           // top becomes 4 quads sharing seams
    const quads = m.faces
      .map((_, i) => i)
      .filter((i) => m.faceNormal(i)[2] > 0.99);
    expect(quads.length).toBe(4);

    const before = m.faces.length;
    m.extrudeFaces(quads, 0.25);

    // The region's border is 8 edges, so 8 walls - not the 16 you would get by
    // walling every edge of every selected face. The 4 interior seams get none.
    expect(m.faces.length).toBe(before + 8);
    const s = m.stats();
    expect(s.boundaryEdges).toBe(0);
    expect(s.volume).toBeCloseTo(1 + 0.25 * 1, 10);
  });

  it('extrudes inward with a negative distance', () => {
    const m = EditMesh.cube(1);
    const top = m.faces.findIndex((_, i) => m.faceNormal(i)[2] > 0.99);
    m.extrudeFaces([top], -0.25);
    const s = m.stats();
    expect(s.boundaryEdges).toBe(0);
    expect(s.volume).toBeCloseTo(0.75, 10);
  });

  it('does nothing when given no faces', () => {
    const m = EditMesh.cube(1);
    const before = m.toSnapshot();
    m.extrudeFaces([], 1);
    expect(m.toSnapshot()).toEqual(before);
  });
});

describe('subdivide', () => {
  it('shares edge midpoints so the mesh does not tear open', () => {
    const m = EditMesh.cube(1).subdivideFaces();
    const s = m.stats();
    expect(s.faces).toBe(24);
    // If midpoints were not shared, every seam would become a boundary.
    expect(s.boundaryEdges).toBe(0);
    expect(s.euler).toBe(2);
    expect(s.components).toBe(1);
    // Shape unchanged: still a unit cube, just described with more faces.
    expect(s.volume).toBeCloseTo(1, 10);
    expect(s.area).toBeCloseTo(6, 10);
    // 8 corners + 12 edge midpoints + 6 face centres = 26.
    expect(s.verts).toBe(26);
    expect(s.ngons).toEqual({ tris: 0, quads: 24, larger: 0 });
  });

  it('leaves unselected faces alone', () => {
    const m = EditMesh.cube(1).subdivideFaces([0]);
    expect(m.faces.length).toBe(4 + 5);
    expect(m.stats().boundaryEdges).toBe(0);
    expect(m.stats().volume).toBeCloseTo(1, 10);
  });
});

describe('normals on a face that is not flat', () => {
  it('uses the whole ring, not the first three corners', () => {
    // A quad with one corner lifted. Taking corners 0,1,2 would report a normal
    // of exactly +z, which is not the plane this face occupies.
    const m = new EditMesh(
      [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0.5]],
      [[0, 1, 2, 3]],
    );
    const n = m.faceNormal(0);
    expect(n[2]).toBeLessThan(0.999);
    expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1, 12);
  });

  it('returns a zero vector rather than NaN for a degenerate face', () => {
    const m = new EditMesh([[0, 0, 0], [1, 0, 0], [2, 0, 0]], [[0, 1, 2]]);
    expect(m.faceNormal(0)).toEqual([0, 0, 0]);
    expect(m.faceArea(0)).toBeCloseTo(0, 12);
  });
});

describe('triangulate for the renderer', () => {
  it('maps every triangle back to the face it came from', () => {
    const m = EditMesh.cube(1);
    const { indices, faceIndex } = m.triangulate();
    // Six quads make twelve triangles.
    expect(indices.length).toBe(36);
    expect(faceIndex.length).toBe(12);
    // So a click on a triangle can select the quad the user actually sees.
    expect([...faceIndex]).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it('positions line up with the vertex list', () => {
    const m = EditMesh.cube(2);
    const { positions } = m.triangulate();
    expect(positions.length).toBe(m.verts.length * 3);
    expect(positions[0]).toBeCloseTo(-1, 6);
  });
});

describe('housekeeping', () => {
  it('compact drops unreferenced vertices and keeps the shape', () => {
    const m = EditMesh.cube(1);
    m.verts.push([9, 9, 9]);
    m.touch();
    expect(m.stats().verts).toBe(9);
    m.compact();
    expect(m.stats().verts).toBe(8);
    expect(m.stats().volume).toBeCloseTo(1, 12);
  });

  it('clone is independent of the original', () => {
    const a = EditMesh.cube(1);
    const b = a.clone();
    b.verts[0] = [5, 5, 5];
    b.touch();
    expect(a.verts[0]).toEqual([-0.5, -0.5, -0.5]);
    expect(a.stats().volume).toBeCloseTo(1, 12);
  });

  it('flags a face pointing at a vertex that does not exist', () => {
    const m = new EditMesh([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 1, 7]]);
    expect(m.validate().join(' ')).toMatch(/does not exist/);
  });

  it('flags a face using the same vertex twice', () => {
    const m = new EditMesh([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 1, 1]]);
    expect(m.validate().join(' ')).toMatch(/same vertex twice/);
  });
});
