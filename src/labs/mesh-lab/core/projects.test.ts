import { beforeAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { loadPyodide } from 'pyodide';
import { Editor } from '../../../engines/mesh/core/Editor';
import { EditMesh } from '../../../engines/mesh/core/EditMesh';
import { runScript } from '../../../engines/mesh/core/api';
import { checkQuiz } from '../../../engines/mesh/core/trace';
import { skinSource, skinnedSource } from '../../../engines/mesh/core/evaluate';
import { PROJECTS, PROJECT_GROUPS, openProject, startState, stepText } from './projects';
import { sampleKeys } from '../../../engines/mesh/core/animation';
import type { PyodideLike } from '../../../engines/mesh/core/python';

let py: PyodideLike;
beforeAll(async () => { py = (await loadPyodide()) as unknown as PyodideLike; }, 60000);

describe('example projects', () => {
  it('have unique ids, known groups and a guide', () => {
    expect(new Set(PROJECTS.map((p) => p.id)).size).toBe(PROJECTS.length);
    for (const p of PROJECTS) { expect(PROJECT_GROUPS).toContain(p.group); expect(p.guide.length).toBeGreaterThanOrEqual(3); }
  });

  for (const p of PROJECTS) {
    it(`"${p.title}" builds without errors and its setup points at real things`, () => {
      const e = new Editor();
      const r = openProject(e, p, py);
      expect(r.error, r.output.join('\n')).toBeNull();
      if (p.setup.select) expect(e.activeObject?.name).toBe(p.setup.select);
      expect(e.scene.get('Cube')).toBeUndefined();
      expect(e.undoStack.length).toBe(1); // one undo step takes the whole build back
      for (const o of e.scene.objects) if (o.mesh) expect(o.mesh.validate()).toEqual([]);
    });
  }
});

describe('what the projects claim', () => {
  const open = (id: string) => { const e = new Editor(); const r = openProject(e, PROJECTS.find((p) => p.id === id)!, py); return { e, r }; };

  it('the bouncing ball follows the gravity parabola exactly between keys', () => {
    const { e } = open('bouncing-ball');
    const keys = e.scene.get('Ball')!.anim!.position!;
    // The first fall: from the top key (rest) to the first bounce, y = top − (top − y₁)·t², t the fraction of the time.
    const [k0, k1] = keys;
    for (let f = k0.frame + 1; f < k1.frame; f++) {
      const t = (f - k0.frame) / (k1.frame - k0.frame);
      expect(sampleKeys(keys, f).value[1]).toBeCloseTo(k0.value[1] - (k0.value[1] - k1.value[1]) * t * t, 12);
    }
    // Falling 3 m under g = 9.8 takes √(2·3/9.8) s = 0.78 s = 19 frames at 24 fps.
    expect(k1.frame - k0.frame).toBe(19);
  });

  it('the curvature gallery prints Gauss–Bonnet: 4π for the sphere, 0 for the torus', () => {
    const { r } = open('curvature-gallery');
    expect(r.output.find((l) => l.startsWith('Sphere'))).toMatch(/Σ K·area = 4\.000000π\s+χ = 2/);
    expect(r.output.find((l) => l.startsWith('Torus'))).toMatch(/= -?0\.000000π\s+χ = 0/);
  });

  it('smoothing flattens the curvature spread and shrinks the volume', () => {
    const { r } = open('smoothing');
    const parse = (name: string) => { const m = r.output.find((l) => l.startsWith(name))!.match(/volume ([\d.]+) .* ± ([\d.]+)/)!; return { vol: +m[1], spread: +m[2] }; };
    const a = parse('Bumpy'), b = parse('Smoothed ×5'), c = parse('Smoothed ×40');
    expect(b.spread).toBeLessThan(a.spread / 3);
    expect(c.vol).toBeLessThan(b.vol); expect(b.vol).toBeLessThan(a.vol);
  });

  it('the knot is one closed tube and shows distance from vertex 0', () => {
    const { e } = open('knot-distance');
    expect(e.field?.spec).toEqual({ kind: 'geodesic', sources: [0] });
    expect(e.scene.get('Trefoil')!.mesh!.stats().closed).toBe(true);
    expect(e.trace?.op).toBe('Heat method');
  });

  it('the candy wrapper: at the full twist the linear tube pinches, the dual-quaternion one stays round', async () => {
    const { skinnedSource } = await import('../../../engines/mesh/core/evaluate');
    const { e } = open('candy-wrapper');
    e.setFrame(36);
    const mid = (name: string) => {
      const o = e.scene.get(name)!, v = skinnedSource(e.scene, o).verts;
      return Array.from({ length: 16 }, (_, j) => 8 * 16 + j).reduce((s, i) => s + Math.hypot(v[i][0], v[i][2]), 0) / 16;
    };
    expect(mid('Linear blend')).toBeLessThan(0.5 * 0.25);
    expect(mid('Dual quaternion')).toBeGreaterThan(0.9 * 0.25);
    for (const n of ['Linear blend', 'Dual quaternion']) { const s = e.scene.get(n)!.mesh!.stats(); expect(s.closed).toBe(true); expect(s.volume).toBeGreaterThan(0); }
  });

  it('fix a bad rig: opens painting the spine, and painting the chest stops the arm dragging it', async () => {
    const { skinnedSource, skinSource } = await import('../../../engines/mesh/core/evaluate');
    const { e } = open('fix-a-bad-rig');
    expect(e.mode).toBe('weight'); expect(e.activeBone).toBe('Spine'); expect(e.frame).toBe(24);
    const body = () => e.scene.get('Character')!;
    const src = skinSource(body()).verts;
    const chest = src.map((v, i) => [v, i] as const).filter(([v]) => v[0] > 0.2 && v[0] < 0.65 && v[1] > 0.8 && v[1] < 1.25).map(([, i]) => i);
    const drift = () => { const p = skinnedSource(e.scene, body()).verts; return chest.reduce((s, i) => s + Math.hypot(p[i][0] - src[i][0], p[i][1] - src[i][1], p[i][2] - src[i][2]), 0) / chest.length; };
    const before = drift();
    const pos = skinnedSource(e.scene, body()).verts;
    e.paint = { ...e.paint, brush: 'draw', value: 1, strength: 0.8, radius: 0.35 };
    e.beginStroke(); for (const i of chest) e.strokeDab(pos[i]); e.endStroke();
    expect(drift()).toBeLessThan(before * 0.5); // the chest stays nearly where it rests
  });

  it('the tentacle: rolling a bone 90° turns its bending plane from forward to sideways', async () => {
    const { posedEnds } = await import('../../../engines/mesh/core/armature');
    const { e } = open('tentacle');
    e.setFrame(13);                                   // Seg 1 at a full swing
    const tip = () => posedEnds(e.scene.get('Tentacle rig')!.bones!).get('Seg 1')!.tail;
    const a = tip();
    expect(Math.abs(a[2])).toBeGreaterThan(0.2); expect(Math.abs(a[0])).toBeLessThan(1e-9);   // swings in z
    e.enterBoneEdit(); e.setBone('Seg 1', { roll: Math.PI / 2 }); e.exitBoneEdit();
    e.setFrame(13);
    const b = tip();
    expect(Math.abs(b[0])).toBeCloseTo(Math.abs(a[2]), 9); expect(Math.abs(b[2])).toBeLessThan(1e-9); // same swing, now in x
  });

  it('the robot gripper moves only because its parents turn', () => {
    const { e } = open('robot-arm');
    const g = e.scene.get('Gripper')!;
    expect(g.anim).toBeUndefined();
    const at = (f: number) => e.scene.worldMatrixAt(g, f).elements.slice(12, 15);
    expect(Math.hypot(...at(1).map((x, i) => x - at(45)[i]))).toBeGreaterThan(1);
    // The block is carried: at the gripper while held, left where it was let go.
    const b = e.scene.get('Block')!;
    const bAt = (f: number) => e.scene.worldMatrixAt(b, f).elements.slice(12, 15);
    for (const f of [45, 60, 75, 90, 105]) expect(Math.hypot(...bAt(f).map((x, i) => x - at(f)[i]))).toBeLessThan(1e-9);
    expect(bAt(120)).toEqual(bAt(105));
    expect(Math.hypot(...bAt(105).map((x, i) => x - bAt(45)[i]))).toBeGreaterThan(1);
  });
});

describe('bone edit mode shows the rest pose', () => {
  it('while the tentacle rig is edited the tentacle is straight; leaving puts the pose back', async () => {
    const { skinnedSource, skinSource } = await import('../../../engines/mesh/core/evaluate');
    const e = new Editor();
    openProject(e, PROJECTS.find((p) => p.id === 'tentacle')!, py);
    e.setFrame(13);
    const t = () => e.scene.get('Tentacle')!;
    const moved = () => { const a = skinnedSource(e.scene, t()).verts, b = skinSource(t()).verts; return Math.max(...a.map((v, i) => Math.hypot(v[0] - b[i][0], v[1] - b[i][1], v[2] - b[i][2]))); };
    expect(moved()).toBeGreaterThan(0.3);
    e.enterBoneEdit();
    expect(moved()).toBe(0);
    e.exitBoneEdit();
    expect(moved()).toBeGreaterThan(0.3);
  });
});

describe('UV and material projects', () => {
  const open = (id: string) => { const e = new Editor(); const r = openProject(e, PROJECTS.find((p) => p.id === id)!, py); return { e, r }; };

  it('the fly-through loops: frame 241 is frame 1, and the camera always looks at the peak', () => {
    const { e, r } = open('island-flythrough');
    expect(r.output.at(-1)).toBe('Camera keyed every 6 frames: 41 keys; the scene camera is Camera');
    const cam = e.scene.get('Camera')!;
    expect(e.scene.activeCamera).toBe(cam.id);
    expect(cam.anim!.rotationMode).toBe('quaternion');
    const at = (f: number) => e.scene.worldMatrixAt(cam, f);
    const pos = (f: number) => at(f).elements.slice(12, 15);
    pos(241).forEach((x, i) => expect(x).toBeCloseTo(pos(1)[i], 9));
    // Between keys too, −z points close to the peak (slerp between two aimed rotations stays near aimed).
    for (const f of [1, 4, 100, 157, 238]) {
      const m = at(f).elements, look = [-m[8], -m[9], -m[10]], p = pos(f);
      const to = [0 - p[0], 1.2 - p[1], 0 - p[2]], n = Math.hypot(...to);
      const cos = (look[0] * to[0] + look[1] * to[1] + look[2] * to[2]) / n;
      expect(cos).toBeGreaterThan(0.999);
    }
  });

  it('winding and normals: face 2 is turned out by a traced flip (its question is the reversed normal); face 3 still points in', () => {
    const { e, r } = open('winding-and-normals');
    // The script logs every face's normal before the flip: faces 2 and 3 point into the pyramid.
    expect(r.output).toEqual(['face 0 normal 0, -1, 0', 'face 1 normal 0, 0.55, -0.83', 'face 2 normal -0.83, -0.55, 0', 'face 3 normal 0, -0.55, -0.83', 'face 4 normal -0.83, 0.55, 0']);
    const m = e.scene.get('Pyramid')!.mesh!, centre = [0, 0.3, 0];
    const out = (i: number) => { const n = m.faceNormal(i), c = m.faceCenter(i); return n[0] * (c[0] - centre[0]) + n[1] * (c[1] - centre[1]) + n[2] * (c[2] - centre[2]) > 0; };
    expect([0, 1, 2, 3, 4].map(out)).toEqual([true, true, true, false, true]);
    expect(m.faces[2]).toEqual([4, 2, 1]);
    expect(e.trace?.op).toBe('Flip normals');
    const q = e.trace!.steps.find((x) => x.quiz)!.quiz!;
    q.answer.forEach((a, i) => expect(a).toBeCloseTo(m.faceNormal(2)[i], 12));
    expect(q.answer.map((x) => +x.toFixed(2))).toEqual([0.83, 0.55, 0]);
  });

  it('edges and neighbours: the table of the open box, rebuilt by a traced edgeTable() that asks twice', () => {
    const { e, r } = open('edges-and-neighbours');
    expect(r.output).toEqual([
      'edge 0-4: faces 0, 2', 'edge 4-6: faces 0, 4', 'edge 2-6: faces 0', 'edge 0-2: faces 0, 3',
      'edge 1-3: faces 1, 3', 'edge 3-7: faces 1', 'edge 5-7: faces 1, 4', 'edge 1-5: faces 1, 2',
      'edge 0-1: faces 2, 3', 'edge 4-5: faces 2, 4', 'edge 2-3: faces 3', 'edge 6-7: faces 4',
      '12 edges, 4 open: 2-6, 3-7, 2-3, 6-7',
    ]);
    expect(e.trace?.op).toBe('Edge table');
    expect(e.trace!.steps.filter((x) => x.quiz).map((x) => x.quiz!.answer)).toEqual([[2, 9], [4, 0]]);
    const m = e.scene.get('Open box')!.mesh!;
    // Neighbours: the bottom (face 2) has four; each side has three and one open edge (-1).
    expect(m.neighbours(2)).toEqual([3, 1, 4, 0]);
    expect([0, 1, 3, 4].map((f) => m.neighbours(f).filter((x) => x < 0).length)).toEqual([1, 1, 1, 1]);
  });

  it('connected pieces: three pieces by shared edges; the trace asks the first piece\'s size, then the queue', () => {
    const { e, r } = open('connected-pieces');
    expect(r.output).toEqual(['23 vertices, 18 faces', 'piece 1: faces 0, 2, 5, 3, 4, 1', 'piece 2: faces 6, 8, 11, 9, 10, 7', 'piece 3: faces 12, 14, 17, 15, 16, 13']);
    expect(e.trace?.op).toBe('Pieces');
    const asked = e.trace!.steps.filter((x) => x.quiz);
    expect(asked.map((x) => x.label)).toEqual(['Piece 1: visit face 0, queue 2, 5, 3, 4; queue now 2, 5, 3, 4', 'Piece 1: visit face 2, queue 1; queue now 5, 3, 4, 1']);
    expect(asked.map((x) => x.quiz!.answer)).toEqual([[6], [4]]);
    expect(e.trace!.steps.filter((x) => x.phase === 'Piece done')).toHaveLength(3);
  });

  it("Euler's formula: 2, 2, 0, 1; the traced count asks for χ, then the genus", () => {
    const { e, r } = open('eulers-formula');
    expect(r.output).toEqual(['Closed cube: V − E + F = 8 − 12 + 6 = 2', 'Sphere: V − E + F = 114 − 240 + 128 = 2', 'Torus: V − E + F = 96 − 192 + 96 = 0', 'Open box: V − E + F = 8 − 12 + 5 = 1', 'Torus: 0 boundary loops, genus 1']);
    expect(e.trace?.op).toBe('Euler characteristic');
    expect(e.trace!.steps.filter((x) => x.quiz).map((x) => x.quiz!.answer)).toEqual([[0], [1]]);
    expect(e.scene.get('Open box')!.mesh!.topology()).toMatchObject({ chi: 1, boundaryLoops: 1, genus: 0 });
  });

  it('welding and filling: 20 → 8 vertices by spatial hash, a question across a cell wall', () => {
    const { e, r } = open('welding-and-filling');
    expect(r.output).toEqual(['as scanned: 20 vertices, 20 open edges, 5 pieces', 'weld(0): 20 vertices', 'weld(0.001): 8 vertices, 4 open edges, 1 piece']);
    expect(e.trace?.op).toBe('Merge by distance');
    const asked = e.trace!.steps.filter((x) => x.quiz);
    expect(asked).toHaveLength(1);
    expect(asked[0].label).toMatch(/in a neighbouring cell, so it becomes \d+$/);
    expect(e.trace!.steps.at(-1)!.label).toBe('12 vertices merged: 20 → 8; faces repointed');
  });

  it('OBJ files: 1-based lines become 0-based faces, the trace asks for the first face, and it writes back', () => {
    const { e, r } = open('obj-files');
    expect(r.output[0]).toBe('read: 5 vertices, 5 faces: [[0,1,2,3],[1,0,4],[2,1,4],[3,2,4],[0,3,4]]');
    expect(r.output[1].split('\n')).toEqual(['o Pyramid', 'v -1 0 -1', 'v 1 0 -1', 'v 1 0 1', 'v -1 0 1', 'v 0 1.5 0', 's off', 'f 1 2 3 4', 'f 2 1 5', 'f 3 2 5', 'f 4 3 5', 'f 1 4 5', '']);
    expect(e.trace?.op).toBe('Read OBJ');
    const q = e.trace!.steps.find((x) => x.quiz)!;
    expect(q.label).toBe('line 8: f 1 2 3 4 → face 0: 0, 1, 2, 3');
    expect(q.quiz!.answer).toEqual([0, 1, 2, 3]);
  });

  it('vectors, dot and cross: the base corner of the pyramid, measured and traced', () => {
    const { e, r } = open('vectors-dot-cross');
    expect(r.output).toEqual(['u = 2, 0, 0    v = 1, 1.5, 1', '|u| = 2   |v| = 2.0616   u · v = 2   angle 60.98°', 'u × v = 0, -2, 3   triangle area 1.8028']);
    expect(e.trace?.op).toBe('Measure angle');
    expect(e.trace!.steps.map((x) => x.phase)).toEqual(['Vectors', 'Lengths', 'Dot product', 'Angle', 'Cross product']);
    const qs = e.trace!.steps.filter((x) => x.quiz).map((x) => x.quiz!);
    expect(checkQuiz(qs[0], [2]).correct).toBe(true);
    expect(checkQuiz(qs[1], [61]).correct).toBe(true);    // 60.98° to the nearest degree
    expect(checkQuiz(qs[1], [62]).correct).toBe(false);
  });

  it('translate, rotate, scale: M = T·R·S traced; v0 and the tip where the lesson says', () => {
    const { e, r } = open('translate-rotate-scale');
    expect(r.output).toEqual(['v0 is drawn at 0.634, 0, -1.366', 'v1 is drawn at 2.366, 0, -2.366', 'v2 is drawn at 3.366, 0, -0.634', 'v3 is drawn at 1.634, 0, 0.366', 'v4 is drawn at 2, 3, -1']);
    expect(e.trace?.op).toBe('Trace the transform');
    expect(e.trace!.steps.map((x) => x.phase)).toEqual(['Build', 'Build', 'Build', 'Combine', 'Vertices', 'Vertices', 'Vertices', 'Vertices', 'Vertices']);
    const qs = e.trace!.steps.filter((x) => x.quiz).map((x) => x.quiz!);
    expect(qs[0].answer).toEqual([2, 0, -1]);
    expect(checkQuiz(qs[1], [0.634, 0, -1.366]).correct).toBe(true);
  });

  it('order matters: no shear when stretched then turned; 61.93° when turned then stretched', () => {
    const { e, r } = open('order-matters');
    expect(r.output).toEqual(['Stretch then turn: scale 2, 0.5, 0.5   shear 0°', 'Turn then stretch: scale 1.458, 0.5, 1.458   shear 61.928°']);
    expect(e.trace?.op).toBe('Decompose the matrix');
    const qs = e.trace!.steps.filter((x) => x.quiz).map((x) => x.quiz!);
    expect(checkQuiz(qs[0], [1.4577]).correct).toBe(true);
    expect(checkQuiz(qs[1], [28.07]).correct).toBe(true);
  });

  it('the determinant: 1 and −1.5, the baked mirror inside out, and the traced expansion', () => {
    const { e, r } = open('the-determinant');
    expect(r.output).toEqual(['Stretched: det 1', 'Baked mirror: its mesh holds volume -2 (inside out)', 'Mirrored: det -1.5   its unit-cube mesh fills -1.5 in the world']);
    expect(e.trace?.op).toBe('Determinant');
    expect(e.trace!.steps.map((x) => x.phase)).toEqual(['Matrix', 'Expand', 'Triple product', 'Meaning']);
    expect(e.trace!.steps.filter((x) => x.quiz).map((x) => x.quiz!.answer)).toEqual([[-1.5], [-1.5]]);
  });

  it('hierarchies: origins down the chain, with questions on the elbow and the hand', () => {
    const { e, r } = open('hierarchies');
    expect(r.output).toEqual(["Shoulder's origin in the world: 0, 1, 0", "Elbow's origin in the world: -1, 2.732, 0", "Hand's origin in the world: -2.449, 3.12, 0"]);
    expect(e.trace?.op).toBe('Trace the world matrix');
    expect(e.trace!.steps.map((x) => x.phase)).toEqual(['Walk up', 'Root', 'Multiply', 'Multiply']);
    const qs = e.trace!.steps.filter((x) => x.quiz).map((x) => x.quiz!);
    expect(checkQuiz(qs[0], [-1, 2.732, 0]).correct).toBe(true);
    expect(checkQuiz(qs[1], [-2.449, 3.12, 0]).correct).toBe(true);
  });

  it('hierarchies: clearing the parent keeps the hand where it is', () => {
    const { e } = open('hierarchies');
    const hand = e.scene.get('Hand')!;
    const before = e.scene.worldMatrix(hand).elements.slice(12, 15);
    expect(e.setParent(hand.id, null)).toBe(true);
    e.scene.worldMatrix(hand).elements.slice(12, 15).forEach((x, i) => expect(x).toBeCloseTo(before[i], 9));
  });

  it('two lists: the shared pyramid is closed with 5 vertices; the separate one has 16 and tears when its tip moves', () => {
    const { e, r } = open('two-lists');
    expect(r.output).toEqual(['Shared corners: 5 vertices, 5 faces', 'Separate faces: 16 vertices, 5 faces: [[0,1,2,3],[4,5,6],[7,8,9],[10,11,12],[13,14,15]]']);
    const shared = e.scene.get('Pyramid')!.mesh!, apart = e.scene.get('Pyramid, separate faces')!.mesh!;
    expect(shared.stats()).toMatchObject({ verts: 5, faces: 5, edges: 8, closed: true });
    expect(apart.stats()).toMatchObject({ verts: 16, faces: 5, closed: false });
    // Raising vertex 4 moves all four sides; raising face 1's copy of the tip (6) moves one corner only.
    shared.translateVerts([4], [0, 1.5, 0]);
    expect(shared.faces.filter((f) => f.includes(4)).length).toBe(4);
    apart.translateVerts([6], [0, 1.5, 0]);
    expect([9, 12, 15].map((i) => apart.verts[i][1])).toEqual([1.5, 1.5, 1.5]);
    expect(apart.verts[6][1]).toBe(3);
  });

  it('unwrap basics: the cube has no distortion, the sphere keeps angles well but not areas', () => {
    const { r } = open('unwrap-basics');
    expect(r.output[0]).toBe('cube: worst angle distortion 1.0000');
    expect(Number(r.output[1].split(' ').at(-1))).toBeLessThan(1.25);
    expect(Number(r.output[2].match(/varies ([\d.]+)×/)![1])).toBeGreaterThan(3);
  });

  it('the vase gets a band and a disc, with little angle distortion', async () => {
    const { uvFits, charts } = await import('../../../engines/mesh/core/uv');
    const { e, r } = open('python-vase');
    const v = e.scene.get('Vase')!;
    expect(uvFits(v.mesh!, v.uv)).toBe(true);
    expect(charts(v.mesh!, new Set(v.seams)).length).toBe(2);
    expect(Number(r.output.at(-1)!.match(/mean ([\d.]+)/)![1])).toBeLessThan(1.2);
  });

  it('the shader gallery has one sphere per model, all unwrapped, and the custom GLSL set', async () => {
    const { uvFits } = await import('../../../engines/mesh/core/uv');
    const { e } = open('shader-gallery');
    const want = { PBR: 'pbr', Lambert: 'lambert', 'Blinn–Phong 10': 'blinn-phong', 'Blinn–Phong 120': 'blinn-phong', Toon: 'toon', Normals: 'normals', UV: 'uv', Custom: 'custom' };
    for (const [n, m] of Object.entries(want)) { const o = e.scene.get(n)!; expect(o.material.shader).toBe(m); expect(uvFits(o.mesh!, o.uv)).toBe(true); }
    expect(e.scene.get('Blinn–Phong 120')!.material.shininess).toBe(120);
    expect(e.scene.get('Custom')!.material.glsl).toMatch(/^float d = max/);
  });

  it('the dining set is wood-grained: every part unwrapped with the wood texture', async () => {
    const { uvFits } = await import('../../../engines/mesh/core/uv');
    const { e } = open('dining-set');
    const parts = e.scene.objects.filter((o) => o.mesh);
    expect(parts.length).toBeGreaterThan(20);
    for (const o of parts) { expect(o.material.texture).toBe('wood'); expect(uvFits(o.mesh!, o.uv)).toBe(true); }
  });
});

describe('hard-surface projects', () => {
  const open = (id: string) => { const e = new Editor(); const r = openProject(e, PROJECTS.find((p) => p.id === id)!, py); return { e, r }; };

  it('the crate is closed, bevelled, panelled and fully unwrapped', async () => {
    const { uvFits, angleDistortion } = await import('../../../engines/mesh/core/uv');
    const { e } = open('crate');
    const c = e.scene.get('Crate')!, s = c.mesh!.stats();
    expect(s.closed).toBe(true); expect(s.euler).toBe(2);
    expect(s.volume).toBeLessThan(1.6 ** 3); expect(s.volume).toBeGreaterThan(0.85 * 1.6 ** 3); // six 5 cm recesses and the bevels take about 11%
    expect(uvFits(c.mesh!, c.uv)).toBe(true);
    const d = angleDistortion(c.mesh!, c.uv!);
    expect(d.reduce((a, b) => a + b, 0) / d.length).toBeLessThan(1.1);
  });

  it('support loops: the more support near the edges, the closer the subdivided volume stays to the box', () => {
    const { r } = open('support-loops');
    const pct = (name: string) => Number(r.output.find((l) => l.startsWith(name))!.match(/\((\d+)%\)/)![1]);
    const a = pct('No support loops'), b = pct('Bevelled edges'), c = pct('Support loops');
    expect(a).toBeLessThan(b); expect(b).toBeLessThan(c); expect(c).toBeGreaterThan(90); expect(a).toBeLessThan(80);
  });
});

import { readFileSync, readdirSync } from 'fs';
import { CHALLENGES } from './challenges';

describe('guides name things that exist', () => {
  it('every "Menu › Item" in a guide or hint is a real menu item; every other "A › B" is text in the interface', () => {
    // fileURLToPath, not .pathname: on Windows a file URL keeps a leading slash
    // before the drive letter and percent-encodes spaces, so the naive version
    // builds 'C:\C:\...%20...' and every read from it fails. This test reported a
    // missing file rather than whatever it was checking - a test that cannot run is
    // not a test that passes.
    const dir = fileURLToPath(new URL('..', import.meta.url));
    const meshlab = readFileSync(dir + 'MeshLab.tsx', 'utf8');
    // The interface is split: content-facing panels stay with the lab,
    // the inspection panels are shared in src/engines/mesh. Scanning only
    // one of the two would check a fraction of the menu items and pass.
    const uiDirs = [dir + 'ui', dir + '../../engines/mesh/ui'];
    const ui = meshlab + uiDirs.flatMap((d) => readdirSync(d)
      .map((f) => readFileSync(d + '/' + f, 'utf8'))).join('\n');
    // The menus: `Name: [ ... ],` or `'Name': [ ... ],` inside the menus object, with their item labels.
    const block = meshlab.slice(meshlab.indexOf('const menus'), meshlab.indexOf('const stats'));
    const menus = new Map<string, string>();
    const keys = [...block.matchAll(/\n {4}'?([A-Z][A-Za-z ]+)'?: \[/g)];
    keys.forEach((k, i) => menus.set(k[1], block.slice(k.index!, keys[i + 1]?.index ?? block.length)));
    expect([...menus.keys()]).toEqual(expect.arrayContaining(['File', 'Mesh', 'UV', 'Heat map', 'Object']));
    const stale = (texts: string[]) => {
      const refs = texts.flatMap((t) => [...t.matchAll(/([A-Z][A-Za-z]+(?: [a-z]+)?) › ([A-Z][^.,:;()"]*?)(?=[.,:;()"]|$| (?:and|then|or|on|with|to|in)\b)/g)].map((m) => [m[1], m[2].trim()] as const));
      const bad: string[] = [];
      for (const [a, b] of refs) {
        const lead = b.split(' ').slice(0, 2).join(' ');
        if (menus.has(a)) { if (!menus.get(a)!.includes(lead)) bad.push(`${a} › ${b} (no such item in the ${a} menu)`); }
        else if (!ui.includes(lead)) bad.push(`${a} › ${b} (no such text in the interface)`);
      }
      return { refs, bad };
    };
    // The check itself catches a made-up item and a made-up panel.
    expect(stale(['Use Heat map › Banana split here.', 'See Frobnicator panel › Zork.']).bad.length).toBe(2);
    const { refs, bad } = stale([...PROJECTS.flatMap((p) => [...p.guide.map(stepText), p.desc]), ...CHALLENGES.flatMap((c) => [...c.hints, c.brief])]);
    expect(refs.length).toBeGreaterThan(10);
    expect(bad).toEqual([]);
  });
});

describe('the walk cycle', () => {
  it('loops, dips after each contact, and moves forward at a steady speed', () => {
    const e = new Editor();
    expect(openProject(e, PROJECTS.find((p) => p.id === 'walk-cycle')!).error).toBeNull();
    const rig = () => e.scene.get('Rig')!;
    const pose = (f: number) => { e.setFrame(f); return rig().bones!.map((b) => b.pose.map((x) => +x.toFixed(9))); };
    expect(pose(25)).toEqual(pose(1));                  // one cycle later, the same pose
    expect(pose(49)).toEqual(pose(1));
    const at = (f: number) => { e.setFrame(f); return [...rig().position]; };
    expect(at(4)[1]).toBeLessThan(at(1)[1]); expect(at(10)[1]).toBeGreaterThan(at(1)[1]); // down, then up
    // Steady forward speed: the same distance every 6 frames.
    const z = [1, 7, 13, 19, 25, 31].map((f) => at(f)[2]);
    const steps = z.slice(1).map((v, i) => v - z[i]);
    for (const d of steps) expect(d).toBeCloseTo(steps[0], 9);
  });

  it('the island is grass on planar UVs', async () => {
    const { uvFits } = await import('../../../engines/mesh/core/uv');
    const e = new Editor(); openProject(e, PROJECTS.find((p) => p.id === 'island')!);
    const land = e.scene.get('Island')!;
    expect(land.material.texture).toBe('grass'); expect(uvFits(land.mesh!, land.uv)).toBe(true);
  });
});

describe('guide steps that tick themselves', () => {
  // For every step with a check: the action it asks for, done the way the GUI does it.
  const obj = (e: Editor, n: string) => e.scene.get(n)!;
  const edit = (e: Editor, name: string, mode: 'vert' | 'edge' | 'face', keys: (number | string)[]) => {
    e.selectObject(obj(e, name).id); e.enterEdit(); e.setSelectMode(mode);
    keys.forEach((k, i) => e.selectElement(k, i > 0));
  };
  /** Where the left chest is drawn now (the character is posed), for a brush dab to land on. */
  const chest = (e: Editor) => {
    const c = obj(e, 'Character'), rest = skinSource(c).verts, now = skinnedSource(e.scene, c).verts;
    return now[rest.findIndex((v) => v[0] > 0.2 && v[0] < 0.65 && v[1] > 0.8 && v[1] < 1.25)];
  };
  const firstEdge = (e: Editor, name: string) => [...obj(e, name).mesh!.edges().values()].find((x) => x.faces.length === 2)!;
  const act: Record<string, (e: Editor) => void> = {
    'Tab for edit mode, press 3 for face select, click a face of the bottom-left block': (e) => { edit(e, 'Blocks', 'face', [3]); e.selectLinked(); },
    'Now press 1 for vertex select, click a corner of the same block': (e) => { edit(e, 'Blocks', 'vert', [0]); e.selectLinked(); },
    'Make a hole: select the Closed cube': (e) => { edit(e, 'Closed cube', 'face', [0]); e.deleteElements(); },
    'Merge Your box: select it': (e) => { e.selectObject(obj(e, 'Your box').id); e.enterEdit(); expect(e.mergeByDistance(0.001)).toBe(true); },
    'Close it: press 1 for vertex select': (e) => { e.selectObject(obj(e, 'Your box').id); e.enterEdit(); expect(e.mergeByDistance(0.001)).toBe(true); const m = obj(e, 'Your box').mesh!; e.setSelectMode('vert'); m.verts.forEach((v, i) => { if (v[1] > 0.5) e.selectElement(i, true); }); expect(e.fill()).toBe(true); },
    'Change the model and see the file change': (e) => { edit(e, 'Pyramid', 'face', [0]); expect(e.flip()).toBe(true); },
    'Measure the tip: Tab for edit mode': (e) => { edit(e, 'Pyramid', 'edge', [EditMesh.edgeKey(4, 0), EditMesh.edgeKey(4, 1)]); expect(e.measureAngle()).toBe(true); expect(e.lastMeasure!.degrees).toBeCloseTo(58.03, 2); },
    'Set Rotation Y to 90 in the Inspector': (e) => { runScript(e, `scene.get('Pyramid').rotation.y = Math.PI / 2`); e.selectObject(obj(e, 'Pyramid').id); expect(e.traceTransformOf()).toBe(true); },
    'Fix it: select Stretcher': (e) => { runScript(e, `scene.get('Stretcher').scale = [1, 1, 1]; scene.get('Turn then stretch').scale = [2, 0.5, 0.5]`); e.selectObject(obj(e, 'Turn then stretch').id); expect(e.decomposeOf()).toBe(true); },
    'Baked mirror has its mirror in its vertices': (e) => { e.selectObject(obj(e, 'Baked mirror').id); e.enterEdit(); e.selectAllElements(); expect(e.flip()).toBe(true); },   // as the guide says: Tab, A, Flip normals
    'Turn the Elbow: select it and set Rotation Z to 90': (e) => { runScript(e, `scene.get('Elbow').rotation.z = Math.PI / 2`); e.selectObject(obj(e, 'Hand').id); expect(e.traceWorldOf()).toBe(true); },
    'Unparent the Hand with Object › Clear parent': (e) => { expect(e.setParent(obj(e, 'Hand').id, null)).toBe(true); },
    'Find the rim: Edit › Select non-manifold': (e) => { e.selectObject(obj(e, 'Open box').id); expect(e.selectNonManifold()).toBe(true); },
    'Fix the last one: Tab for edit mode': (e) => { edit(e, 'Pyramid', 'face', [3]); expect(e.flip()).toBe(true); },
    'Select the left Pyramid': (e) => { runScript(e, `scene.get('Pyramid').mesh.translate([4], [0, 1, 0])`); },
    'Press Tab, select the right pyramid': (e) => { runScript(e, `scene.get('Pyramid, separate faces').mesh.translate([6], [0, 1, 0])`); },
    'Click a tree.': (e) => { runScript(e, `scene.get('Tree 3').rotation = [0, 1, 0]`); },
    'Select "Dining set" and rotate it': (e) => { runScript(e, `scene.get('Dining set').rotation = [0, 0.5, 0]`); },
    'Select a few edges and press Ctrl+B yourself': (e) => { const x = firstEdge(e, 'Crate'); edit(e, 'Crate', 'edge', [EditMesh.edgeKey(x.a, x.b)]); expect(e.bevel(0.02, 1)).toBe(true); },
    'Select two neighbouring faces of a frame': (e) => { edit(e, 'Crate', 'face', firstEdge(e, 'Crate').faces); expect(e.dissolve()).toBe(true); },
    'Tab into "Support loops"': (e) => { edit(e, 'Support loops', 'face', firstEdge(e, 'Support loops').faces); expect(e.dissolve()).toBe(true); },
    'Go to a top key and set it to "ease"': (e) => { obj(e, 'Ball').anim!.position![0].interp = 'ease'; },
    'Select Shoulder and look at the Timeline': (e) => { e.selectObject(obj(e, 'Shoulder').id); },
    'Press Space to pause, then Ctrl+Tab': (e) => { e.selectObject(obj(e, 'Rig').id); e.enterPose(); e.setBonePose('Head', [0.3, 0, 0]); },
    'Select Character and use Heat map › Bone weights': (e) => { e.activeBone = 'Spine'; expect(e.showField({ kind: 'weight', bone: 'Spine' }, obj(e, 'Character').id)).toBe(true); },
    'Brush Draw, Value 1': (e) => { e.beginStroke(); e.strokeDab(chest(e)); e.endStroke(); },
    'Turn on X-mirror': (e) => { e.paint = { ...e.paint, mirror: true }; for (let k = 0; k < 2; k++) { e.beginStroke(); e.strokeDab(chest(e)); e.endStroke(); } },
    'Pause (Space) and press Tab on the rig': (e) => { runScript(e, `scene.get('Tentacle rig').addBone({ name: 'Seg 6', parent: 'Seg 5', head: [0, 2.5, 0], tail: [0, 3, 0] })`); },
    'Still in Edit bones, set Roll to 90': (e) => { e.selectObject(obj(e, 'Tentacle rig').id); e.enterBoneEdit(); e.setBone('Seg 1', { roll: Math.PI / 2 }); },
    'Ctrl+Tab for pose mode: bend a segment': (e) => { e.selectObject(obj(e, 'Tentacle rig').id); e.enterPose(); e.setBonePose('Seg 2', [0.4, 0, 0]); },
    'Select each shape and switch Heat map': (e) => { expect(e.showField({ kind: 'mean' }, obj(e, 'Cylinder').id)).toBe(true); },
    'Tab into edit mode, select a different vertex': (e) => { expect(e.showField({ kind: 'geodesic', sources: [40] }, obj(e, 'Trefoil').id)).toBe(true); },
    'Select "Smoothed ×5" and Heat map': (e) => { expect(e.showField({ kind: 'mean' }, obj(e, 'Smoothed ×5').id)).toBe(true); },
    'Tab into edit mode on "Bumpy"': (e) => { edit(e, 'Bumpy', 'vert', [0, 1, 2, 3]); expect(e.smoothVerts(5, 0.5)).toBe(true); },
    'Try it yourself: Tab into edit mode on a new cube': (e) => { runScript(e, `scene.add.cube({ name: 'Mine' }).mesh.seamsFromSharp(60)`); edit(e, 'Mine', 'face', [0, 1, 2, 3, 4, 5]); expect(e.unwrap()).toBe(true); },
    'The Shader tab shows the selected sphere': (e) => { runScript(e, `scene.get('Custom').material.glsl = 'return base * 0.5;'`); },
    'Move the Light object': (e) => { runScript(e, `scene.get('Light').position = [2, 6, 1]`); },
    'In the inspector, turn the mirror and subdivision': (e) => { const c = obj(e, 'Character'); e.updateModifier(c.id, 0, { enabled: false }); },
    'Heat map › Mean curvature: the smooth body': (e) => { expect(e.showField({ kind: 'mean' }, obj(e, 'Character').id)).toBe(true); },
    'Press 0 to look through the camera': (e) => { e.setFrame(60); },
    'In the Inspector, set Field of view to 25': (e) => { e.setCameraFov(obj(e, 'Camera').id, 25); },
    'Heat map › Height (y) shows the rings': (e) => { expect(e.showField({ kind: 'coord', axis: 1 }, obj(e, 'Vase').id)).toBe(true); },
  };

  it('every action above belongs to exactly one checked step', () => {
    const checked = PROJECTS.flatMap((p) => p.guide.filter((g) => typeof g !== 'string').map(stepText));
    for (const k of Object.keys(act)) expect(checked.filter((t) => t.startsWith(k)), k).toHaveLength(1);
    expect(checked.length).toBe(Object.keys(act).length);
  });

  for (const p of PROJECTS) {
    p.guide.forEach((g, i) => {
      if (typeof g === 'string') return;
      it(`${p.id}, step ${i + 1}: not ticked when the project opens; ticked once you do it`, () => {
        const e = new Editor();
        expect(openProject(e, p, py).error).toBeNull();
        const start = startState(e);
        expect(g.done(e, start)).toBe(false);
        const key = Object.keys(act).find((k) => g.text.startsWith(k))!;
        act[key](e);
        expect(g.done(e, start)).toBe(true);
      });
    });
  }
});
