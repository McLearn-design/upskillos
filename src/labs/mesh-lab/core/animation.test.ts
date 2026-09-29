import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { angleBetween, ease, eulerToQuat, sampleKeys, slerp, type Key, type Quat } from './animation';
import { Editor } from './Editor';
import { Scene } from './Scene';
import { runScript } from './api';

const fresh = () => { const e = new Editor(); e.newScene(); return e; };
const key = (frame: number, value: [number, number, number], interp: Key['interp'] = 'linear'): Key => ({ frame, value, interp });

describe('interpolation', () => {
  it('ease is 3t² − 2t³: gentle at both ends, halfway at the middle', () => {
    expect(ease(0.5, 'ease')).toBe(0.5);
    expect(ease(0.25, 'ease')).toBe(0.15625);
    expect(ease(0.25, 'linear')).toBe(0.25);
    expect(ease(0.99, 'constant')).toBe(0);
  });

  it('holds the first value before the first key and the last after the last; constant steps', () => {
    const keys = [key(10, [0, 0, 0]), key(20, [10, 0, 0], 'constant'), key(30, [20, 0, 0])];
    expect(sampleKeys(keys, 1).value).toEqual([0, 0, 0]);
    expect(sampleKeys(keys, 15).value).toEqual([5, 0, 0]);
    expect(sampleKeys(keys, 29).value).toEqual([10, 0, 0]); // constant: stays at 10 until frame 30
    expect(sampleKeys(keys, 99).value).toEqual([20, 0, 0]);
  });
});

describe('quaternion slerp', () => {
  const Y90 = eulerToQuat([0, Math.PI / 2, 0]), ID: Quat = [0, 0, 0, 1];

  it('halfway from no rotation to 90° about y is 45° about y', () => {
    const { q, theta } = slerp(ID, Y90, 0.5);
    const expected = eulerToQuat([0, Math.PI / 4, 0]);
    q.forEach((c, i) => expect(c).toBeCloseTo(expected[i], 12));
    expect(theta).toBeCloseTo(Math.PI / 4, 12); // the quaternion angle is half the rotation angle
  });

  it('turns at constant speed: after a fraction s it has turned s of the whole angle', () => {
    const a = eulerToQuat([0.3, -1.1, 0.4]), b = eulerToQuat([2.0, 0.5, -0.7]);
    const total = angleBetween(a, b);
    for (const s of [0.1, 0.25, 0.5, 0.8]) expect(angleBetween(a, slerp(a, b, s).q)).toBeCloseTo(s * total, 10);
  });

  it('q and −q are the same orientation, and slerp takes the short way', () => {
    const neg: Quat = [-Y90[0], -Y90[1], -Y90[2], -Y90[3]];
    const r = slerp(ID, neg, 0.5);
    expect(r.flipped).toBe(true);
    expect(angleBetween(r.q, eulerToQuat([0, Math.PI / 4, 0]))).toBeLessThan(1e-9);
  });

  it('Euler interpolation is not the shortest path; slerp is', () => {
    const keys = [key(0, [0, 0, 0]), key(10, [Math.PI / 2, Math.PI / 2, 0])];
    const q0 = eulerToQuat([0, 0, 0]), q1 = eulerToQuat(keys[1].value);
    const total = angleBetween(q0, q1); // 120°: the two quarter turns combine into one turn of 2π/3
    expect(total).toBeCloseTo((2 * Math.PI) / 3, 10);
    const mid = (slerpIt: boolean) => eulerToQuat(sampleKeys(keys, 5, slerpIt).value);
    expect(angleBetween(q0, mid(true))).toBeCloseTo(total / 2, 10); // halfway along the shortest arc
    const e = mid(false);
    // Euler's halfway pose is 45° + 45° about two axes: not on the shortest arc at all.
    expect(angleBetween(q0, e) + angleBetween(e, q1) - total).toBeGreaterThan(0.05);
  });
});

describe('keyframes in the editor', () => {
  it('insert, change frame, interpolate; frames are not undo steps; the log rebuilds the animation', () => {
    const e = fresh();
    const cube = e.activeObject!;
    e.selectObject(cube.id);
    // Blender's order: go to a frame, pose, key. (Posing and then changing frame loses the unkeyed pose.)
    e.setFrame(1); e.insertKey();
    e.setFrame(41); e.setTransform(cube.id, 'position', 0, 4); e.insertKey();
    const undoDepth = e.undoStack.length;
    e.setFrame(21);
    expect(e.undoStack.length).toBe(undoDepth);
    expect(e.scene.get(cube.id)!.position[0]).toBeCloseTo(2, 12); // eased, halfway
    e.setFrame(11);
    expect(e.scene.get(cube.id)!.position[0]).toBeCloseTo(4 * ease(0.25, 'ease'), 12);
    expect(e.setInterpolation('linear')).toBe(false); // no key at frame 11
    e.setFrame(1); expect(e.setInterpolation('linear')).toBe(true);
    expect(e.scene.get(cube.id)!.anim!.position![0].interp).toBe('linear');
    // Replaying the logged code on a new scene gives the same keys.
    const code = e.log.map((l) => l.code).join('\n');
    const e2 = fresh();
    expect(runScript(e2, code).error).toBeNull();
    expect(e2.scene.get('Cube')!.anim).toEqual(e.scene.get(cube.id)!.anim);
  });

  it('delete a key, clear the animation, undo', () => {
    const e = fresh();
    const id = e.active!;
    e.setFrame(5); e.insertKey(['position']);
    e.setFrame(9); e.insertKey(['position']);
    e.setFrame(5); expect(e.deleteKey()).toBe(true);
    expect(e.scene.get(id)!.anim!.position!.map((k) => k.frame)).toEqual([9]);
    e.clearAnimation(id);
    expect(e.scene.get(id)!.anim).toBeUndefined();
    e.undo();
    expect(e.scene.get(id)!.anim!.position!.length).toBe(1);
  });

  it('files keep keys and the timeline; files without a timeline get the default', () => {
    const e = fresh();
    e.setFrame(1); e.insertKey();
    e.setTimeline({ start: 1, end: 48, fps: 30 });
    const j = JSON.parse(JSON.stringify(e.scene.toJSON()));
    const back = Scene.fromJSON(j);
    expect(back.timeline).toMatchObject({ start: 1, end: 48, fps: 30 });
    expect(back.objects[0].anim).toEqual(e.scene.objects[0].anim);
    delete j.timeline;
    expect(Scene.fromJSON(j).timeline).toMatchObject({ start: 1, end: 120, fps: 24 });
  });

  it('a child follows its animated parent at every frame', () => {
    const s = new Scene();
    const p = s.add({ name: 'P', anim: { position: [key(0, [0, 0, 0]), key(10, [10, 0, 0])] } });
    const c = s.add({ name: 'C', parent: p.id, position: [0, 1, 0] });
    const at = (f: number) => new Vector3().setFromMatrixPosition(s.worldMatrixAt(c, f));
    expect(at(5).toArray()).toEqual([5, 1, 0]);
    expect(at(10).toArray()).toEqual([10, 1, 0]);
  });
});

describe('animation from scripts', () => {
  it('keyframes, sampling, the frame, slerp mode', () => {
    const e = fresh();
    const r = runScript(e, `
      const b = scene.add.cube({ name: 'B' })
      scene.setTimeline({ start: 0, end: 20 })
      b.keyframe(0, { position: [0, 0, 0], rotation: [0, 0, 0], interp: 'linear' })
      b.keyframe(20, { position: [8, 0, 0], rotation: [0, Math.PI / 2, 0] })
      b.rotationMode = 'quaternion'
      log(b.sample(10).position, b.sample(10).rotation.map(a => +(a * 180 / Math.PI).toFixed(6)))
      scene.frame = 5
      log(b.position.x)
    `);
    expect(r.error).toBeNull();
    expect(r.output).toEqual(['[4,0,0] [0,45,0]', '2']);
    expect(e.scene.get('B')!.position[0]).toBe(2);
  });

  it('a script that moves an animated object without keying it is not snapped back', () => {
    const e = fresh();
    runScript(e, `scene.add.cube({ name: 'M' }).keyframe(1, { position: [0, 0, 0] })`);
    runScript(e, `scene.get('M').position.x = 3`);
    expect(e.scene.get('M')!.position[0]).toBe(3);
  });

  it('rejects a bad interpolation name', () => {
    expect(runScript(fresh(), `scene.add.cube().keyframe(1, { interp: 'bouncy' })`).error).toMatch(/"constant", "linear", "ease", "ease-in", "ease-out"/);
  });
});
