import { describe, expect, it } from 'vitest';
import { traceBake, traceQuaternion, traceSample, worldAt } from './animTrace';
import { Scene } from './Scene';
import { transformAt } from './animation';
import { eulerToQuat, type Animation } from './animation';
import { Trace } from './trace';

describe('animation traces', () => {
  it('linear keys: t, s = t, and the blend (with a prediction of the value)', () => {
    const anim: Animation = { position: [{ frame: 1, value: [0, 0, 0], interp: 'linear' }, { frame: 21, value: [4, 2, 0], interp: 'linear' }] };
    const t = new Trace('Trace sampling the keys');
    const r = traceSample(anim, 'position', 6, t);
    expect(r.t).toBeCloseTo(0.25, 12);
    expect(r.value).toEqual([1, 0.5, 0]);
    expect(t.steps.map((s) => s.phase)).toEqual(['Keys', 'How far', 'Ease', 'Blend']);
    expect(t.steps[3].quiz!.answer).toEqual([1, 0.5, 0]);
  });

  it('ease-in predicts s = t²; quaternion keys go by slerp, with a prediction of the weight', () => {
    const anim: Animation = { position: [{ frame: 0, value: [0, 0, 0], interp: 'ease-in' }, { frame: 10, value: [0, -5, 0], interp: 'linear' }] };
    const t = new Trace('x');
    expect(traceSample(anim, 'position', 5, t).s).toBeCloseTo(0.25, 12);
    expect(t.steps[2].quiz!.answer[0]).toBeCloseTo(0.25, 12);
    const rot: Animation = { rotationMode: 'quaternion', rotation: [{ frame: 0, value: [0, 0, 0], interp: 'linear' }, { frame: 10, value: [0, Math.PI / 2, 0], interp: 'linear' }] };
    const t2 = new Trace('x');
    const r = traceSample(rot, 'rotation', 5, t2);
    expect(r.value[1]).toBeCloseTo(Math.PI / 4, 9);
    expect(t2.steps.map((s) => s.phase)).toEqual(['Keys', 'How far', 'Ease', 'Quaternions', 'Shortest path', 'Weights', 'Back to Euler']);
    // θ = 45° between the quaternions (a 90° turn); halfway the weight is sin(22.5°)/sin(45°).
    expect(t2.steps[5].quiz!.answer[0]).toBeCloseTo(Math.sin(Math.PI / 8) / Math.sin(Math.PI / 4), 9);
  });

  it('a quaternion from Euler angles: half angles, and the same as three.js', () => {
    const t = new Trace('Trace the quaternion');
    const q = traceQuaternion([Math.PI / 3, 0.4, -0.2], t);
    expect(q).toEqual(eulerToQuat([Math.PI / 3, 0.4, -0.2]));
    expect(t.steps[0].quiz!.answer[0]).toBeCloseTo(Math.cos(Math.PI / 6), 12);
    expect(t.steps.map((s) => s.phase)).toEqual(['One axis each', 'Product', 'Axis and angle']);
  });

  it('worldAt agrees with the scene at the current frame, and baking every frame is exact', () => {
    const scene = new Scene();
    const a = scene.add({ name: 'A', position: [0, 1, 0] }), b = scene.add({ name: 'B', position: [2, 0, 0] });
    b.parent = a.id;
    a.anim = { rotation: [{ frame: 1, value: [0, 0, 0], interp: 'linear' }, { frame: 21, value: [0, 0, Math.PI / 2], interp: 'linear' }] };
    scene.timeline.start = 1; scene.timeline.end = 21;
    for (const f of [1, 7, 21]) {
      Object.assign(a, transformAt(a, f));
      const want = scene.worldMatrix(b).elements, got = worldAt(scene, b, f).elements;
      got.forEach((x, i) => expect(x).toBeCloseTo(want[i], 12));
    }
    expect(traceBake(scene, b, 1).maxError).toBeLessThan(1e-12);
    expect(traceBake(scene, b, 10).maxError).toBeGreaterThan(0.05);
  });
});
