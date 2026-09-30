import { describe, expect, it } from 'vitest';
import { Editor } from '../../../engines/mesh/core/Editor';
import { runScript } from '../../../engines/mesh/core/api';
import { EXAMPLES } from './examples';
import { skinnedSource, skinSource } from '../../../engines/mesh/core/evaluate';
import { dab, falloff, mirrorBoneName, neighbourLists, setWeight, DEFAULT_PAINT } from '../../../engines/mesh/core/weightPaint';
import type { Skin } from '../../../engines/mesh/core/armature';

const skin2 = (n: number): Skin => ({ armature: 'a', bones: ['A', 'B'], weights: [new Array(n).fill(0.5), new Array(n).fill(0.5)], verts: n });

describe('brush maths', () => {
  it('falloff is 1 at the centre, 0 at the rim, and smooth', () => {
    expect(falloff(0, 1)).toBe(1); expect(falloff(1, 1)).toBe(0); expect(falloff(0.5, 1)).toBeCloseTo(0.5625, 12);
  });
  it('normalising keeps the painted weight and scales the others to sum to 1', () => {
    const s: Skin = { armature: 'a', bones: ['A', 'B', 'C'], weights: [[0.5], [0.3], [0.2]], verts: 1 };
    setWeight(s, 0, 0, 0.8, true);
    expect(s.weights.map((w) => w[0])).toEqual([0.8, expect.closeTo(0.12, 12), expect.closeTo(0.08, 12)]);
  });
  it('draw moves toward the value by strength × falloff; subtract and add clamp', () => {
    const s = skin2(3), pos: [number, number, number][] = [[0, 0, 0], [0.5, 0, 0], [5, 0, 0]], nb = [[1], [0, 2], [1]];
    dab(s, 'A', pos, nb, [0, 0, 0], { ...DEFAULT_PAINT, radius: 1, strength: 0.5, value: 1 });
    expect(s.weights[0][0]).toBeCloseTo(0.75, 12);                    // 0.5 + 0.5·1·(1 − 0.5)
    expect(s.weights[0][1]).toBeCloseTo(0.5 + 0.5 * 0.5625 * 0.5, 12); // falloff 0.5625 at half the radius
    expect(s.weights[0][2]).toBe(0.5);                                 // outside the brush
    expect(s.weights[1][0]).toBeCloseTo(0.25, 12);                     // the other bone gave way
    dab(s, 'A', pos, nb, [0, 0, 0], { ...DEFAULT_PAINT, brush: 'subtract', radius: 1, strength: 1, value: 5 });
    expect(s.weights[0][0]).toBe(0);
  });
  it('mirror paints the other side with the other side\'s bone', () => {
    expect(mirrorBoneName('UpperArm.L')).toBe('UpperArm.R'); expect(mirrorBoneName('hand_r')).toBe('hand_l'); expect(mirrorBoneName('LeftFoot')).toBe('RightFoot'); expect(mirrorBoneName('Spine')).toBe('Spine');
    const s: Skin = { armature: 'a', bones: ['Arm.L', 'Arm.R'], weights: [[0, 0], [0, 0]], verts: 2 };
    dab(s, 'Arm.L', [[1, 0, 0], [-1, 0, 0]], [[], []], [1, 0, 0], { ...DEFAULT_PAINT, radius: 0.5, strength: 1, value: 1, mirror: true, normalize: false });
    expect(s.weights).toEqual([[1, 0], [0, 1]]);
  });
});

describe('weight paint mode', () => {
  const rigged = () => {
    const e = new Editor(); e.newScene();
    expect(runScript(e, EXAMPLES.find((x) => x.id === 'rig-character')!.code).error).toBeNull();
    e.selectObject(e.scene.get('Character')!.id);
    return e;
  };

  it('a stroke paints the chest back to the spine, is one undo step, and its logged code replays exactly', () => {
    const e = rigged();
    const body = e.scene.get('Character')!;
    expect(e.enterWeightPaint()).toBe(true);
    expect(e.field?.spec.kind).toBe('weight');
    // Chest vertices: the front of the torso near the shoulder, which bone heat gave partly to the arm.
    const src = skinSource(body);
    const chest = src.verts.map((v, i) => [v, i] as const).filter(([v]) => v[0] > 0.2 && v[0] < 0.65 && v[1] > 0.8 && v[1] < 1.25).map(([, i]) => i);
    const armW = () => chest.reduce((s, i) => s + body.skin!.weights[body.skin!.bones.indexOf('UpperArm.L')][i], 0);
    const before = armW();
    expect(before).toBeGreaterThan(0.2);
    e.selectBone('Spine');
    e.paint = { ...e.paint, brush: 'draw', value: 1, strength: 0.8, radius: 0.35 };
    const pos = skinnedSource(e.scene, body).verts;
    e.beginStroke();
    for (const i of chest) e.strokeDab(pos[i]);
    e.endStroke();
    expect(armW()).toBeLessThan(before * 0.2);
    for (let i = 0; i < body.skin!.verts; i++) expect(body.skin!.weights.reduce((s, w) => s + w[i], 0)).toBeCloseTo(1, 9);
    expect(e.undoStack.at(-1)!.label).toBe('Paint Spine');
    const code = e.log.at(-1)!.code!;
    expect(code).toMatch(/^scene\.get\("Character"\)\.paintWeights\("Spine", \{ brush: "draw"/);

    // Replay: the same example, then the logged stroke, gives identical weights.
    const e2 = rigged();
    expect(runScript(e2, code).error).toBeNull();
    const w1 = body.skin!.weights, w2 = e2.scene.get('Character')!.skin!.weights;
    w1.forEach((row, b) => row.forEach((x, i) => expect(w2[b][i]).toBeCloseTo(x, 3)));

    e.undo(); // undo rebuilds the scene, so look the mesh up again
    const back = e.scene.get('Character')!.skin!;
    expect(chest.reduce((s, i) => s + back.weights[back.bones.indexOf('UpperArm.L')][i], 0)).toBeCloseTo(before, 12);
  });

  it('only a bound mesh can be weight painted, and Tab leaves the mode', () => {
    const e = new Editor(); e.newScene();
    expect(e.enterWeightPaint()).toBe(false);
    const r = rigged();
    r.enterWeightPaint(); r.toggleEdit();
    expect(r.mode).toBe('object'); expect(r.field).toBeNull();
  });
});
