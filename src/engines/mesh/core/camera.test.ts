import { describe, expect, it } from 'vitest';
import { Euler, Quaternion, Vector3 } from 'three';
import { frustumCorners, horizontalFov, lookAtRotation } from './camera';
import { Editor } from './Editor';
import { Scene } from './Scene';
import { runScript } from './api';
import type { Vec3 } from './EditMesh';

/** Where an object's −z axis (the way a camera looks) and +x axis point after a rotation. */
const axes = (r: Vec3, parent?: Quaternion) => {
  const q = new Quaternion().setFromEuler(new Euler(r[0], r[1], r[2], 'XYZ'));
  if (parent) q.premultiply(parent);
  return { look: new Vector3(0, 0, -1).applyQuaternion(q), right: new Vector3(1, 0, 0).applyQuaternion(q) };
};

describe('camera maths', () => {
  it('looking from +z at the origin needs no turn; from +x it is a quarter turn about y', () => {
    expect(lookAtRotation([0, 0, 5], [0, 0, 0]).map((x) => +x.toFixed(9) + 0)).toEqual([0, 0, 0]);
    const r = lookAtRotation([5, 0, 0], [0, 0, 0]);
    expect(r[1]).toBeCloseTo(Math.PI / 2, 9);
  });

  it('for any eye and target, −z points at the target and the camera does not roll (its x axis stays level)', () => {
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 10 - 5;
    for (let k = 0; k < 50; k++) {
      const eye: Vec3 = [rnd(), rnd(), rnd()], target: Vec3 = [rnd(), rnd(), rnd()];
      const { look, right } = axes(lookAtRotation(eye, target));
      const want = new Vector3(...target).sub(new Vector3(...eye)).normalize();
      expect(look.distanceTo(want)).toBeLessThan(1e-9);
      expect(Math.abs(right.y)).toBeLessThan(1e-9);
    }
  });

  it('under a turned parent, the local rotation still aims the camera at the target in the world', () => {
    const parent = new Quaternion().setFromEuler(new Euler(0.3, -1.1, 0.4));
    const { look } = axes(lookAtRotation([1, 2, 3], [-2, 0, 1], parent), parent);
    expect(look.distanceTo(new Vector3(-3, -2, -2).normalize())).toBeLessThan(1e-9);
  });

  it('the image rectangle at distance d is 2·d·tan(fov/2) high and aspect times as wide', () => {
    expect(frustumCorners(90, 2, 1).map((p) => p.map((x) => +x.toFixed(12)))).toEqual([[-2, -1, -1], [2, -1, -1], [2, 1, -1], [-2, 1, -1]]);
    expect(horizontalFov(90, 1)).toBeCloseTo(90, 12);
    expect(horizontalFov(50, 16 / 9)).toBeCloseTo(2 * Math.atan(Math.tan((25 * Math.PI) / 180) * 16 / 9) * 180 / Math.PI, 12);
  });
});

describe('cameras in the scene', () => {
  it('the first camera becomes the scene camera; scene.camera switches it; only cameras qualify', () => {
    const e = new Editor();
    const r = runScript(e, `const a = scene.add.camera({ name: 'A', position: [0, 2, 8], lookAt: [0, 0, 0] })
const b = scene.add.camera({ name: 'B', position: [6, 1, 0], fov: 30 })
log(scene.camera.name, b.fov)
scene.camera = b
log(scene.camera.name)
try { scene.camera = scene.get('Cube') } catch (err) { log('refused') }`);
    expect(r.error).toBeNull();
    expect(r.output).toEqual(['A 30', 'B', 'refused']);
    expect(axes(e.scene.get('A')!.rotation).look.distanceTo(new Vector3(0, -2, -8).normalize())).toBeLessThan(1e-9);
  });

  it('a camera and the scene camera survive saving and loading; deleting the camera clears it', () => {
    const e = new Editor();
    runScript(e, `scene.add.camera({ name: 'Cam', position: [1, 2, 3], fov: 35 })`);
    const back = Scene.fromJSON(JSON.parse(JSON.stringify(e.scene.toJSON())));
    const c = back.get('Cam')!;
    expect(c.kind).toBe('camera'); expect(c.camera).toEqual({ fov: 35, near: 0.1, far: 200 });
    expect(back.activeCamera).toBe(c.id);
    back.remove(c.id);
    expect(back.activeCamera).toBeNull();
  });

  it('the editor commands are undoable, and their logged code rebuilds the same camera', () => {
    const e = new Editor();
    const cam = e.addCamera();
    e.setCameraFov(cam.id, 35);
    e.alignCamera([4, 3, 4], lookAtRotation([4, 3, 4], [0, 0, 0]));
    const replay = new Editor();
    const r = runScript(replay, e.log.map((l) => l.code).filter(Boolean).join('\n'));
    expect(r.error).toBeNull();
    const a = e.scene.get('Camera')!, b = replay.scene.get('Camera')!;
    expect(b.camera!.fov).toBe(35);
    b.position.forEach((x, i) => expect(x).toBeCloseTo(a.position[i], 5));
    b.rotation.forEach((x, i) => expect(x).toBeCloseTo(a.rotation[i], 5));
    expect(replay.scene.activeCamera).toBe(b.id);
    e.undo(); e.undo();
    expect(e.scene.get('Camera')!.camera!.fov).toBe(50);
    e.undo();
    expect(e.scene.get('Camera')).toBeUndefined();
    expect(e.scene.activeCamera).toBeNull();
  });
});
