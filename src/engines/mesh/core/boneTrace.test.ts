import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { frameOf, tracePose, traceRestMatrix } from './boneTrace';
import { boneMatrices, posedEnds, restMatrix, type Bone } from './armature';
import { Trace } from './trace';

const bone = (name: string, head: number[], tail: number[], extra: Partial<Bone> = {}): Bone => ({ name, parent: null, head: head as Bone['head'], tail: tail as Bone['tail'], pose: [0, 0, 0], ...extra });

describe('bone traces', () => {
  it('the rest matrix: length, the turn from +y, roll, and B the same as armature.ts', () => {
    const b = bone('Arm', [1, 2, 0], [3, 2, 0], { roll: Math.PI / 2 });
    const t = new Trace('x');
    const r = traceRestMatrix(b, t);
    expect(r.length).toBeCloseTo(2, 12);
    expect(r.turn).toBeCloseTo(Math.PI / 2, 12);
    expect(r.axis).toEqual([0, 0, -1]);
    expect(r.matrix.elements).toEqual(restMatrix(b).elements);
    const f = frameOf(r.matrix);
    [1, 0, 0].forEach((x, i) => expect(f.y[i]).toBeCloseTo(x, 12));
    expect(f.o).toEqual([1, 2, 0]);
    expect(t.steps.map((s) => s.phase)).toEqual(['Direction', 'Turn', 'Roll', 'Matrix']);
    expect(t.steps[0].quiz!.answer[0]).toBeCloseTo(2, 12);
    expect(t.steps[1].quiz!.answer[0]).toBeCloseTo(90, 9);
  });

  it('posing a chain: the tail agrees with posedEnds, and S carries the rest tail there', () => {
    const bones = [bone('Upper', [0, 0, 0], [0, 1, 0], { pose: [0, 0, Math.PI / 2] }), bone('Lower', [0, 1, 0], [0, 2, 0], { parent: 'Upper', pose: [0, 0, Math.PI / 2] })];
    const t = new Trace('x');
    const r = tracePose(bones, 'Lower', t);
    const want = posedEnds(bones).get('Lower')!.tail;
    r.tail.forEach((x, i) => expect(x).toBeCloseTo(want[i], 12));
    [-1, -1, 0].forEach((x, i) => expect(r.tail[i]).toBeCloseTo(x, 12));
    expect(r.posed.elements).toEqual(boneMatrices(bones).get('Lower')!.posed.elements);
    expect(r.chain).toEqual(['Upper', 'Lower']);
    expect(t.steps.map((s) => s.phase)).toEqual(['Chain', 'Pose', 'Pose', 'Skin matrix']);
    const q = t.steps[2].quiz!.answer;
    q.forEach((x, i) => expect(x).toBeCloseTo(want[i], 12));
    const p = new Vector3(0, 1.5, 0).applyMatrix4(r.skin);
    expect([p.x, p.y, p.z].map((x) => +x.toFixed(9))).toEqual([-1, -0.5, 0]); // halfway along Lower, which now points down from (-1, 0, 0)
  });
});
