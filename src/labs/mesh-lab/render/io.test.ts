// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Editor } from '../core/Editor';
import { runScript } from '../core/api';
import { exportGLB } from './io';

describe('GLB export with animation', () => {
  it('bakes every frame into a clip that three.js (and Blender) reads back', async () => {
    const e = new Editor(); e.newScene();
    const r = runScript(e, `
      scene.setTimeline({ start: 1, end: 25, fps: 24 })
      const c = scene.get('Cube')
      c.keyframe(1, { position: [0, 0, 0], rotation: [0, 0, 0] })
      c.keyframe(25, { position: [6, 0, 0], rotation: [0, Math.PI, 0] })
      c.rotationMode = 'quaternion'
    `);
    expect(r.error).toBeNull();
    const glb = await exportGLB(e.scene);
    const gltf = await new GLTFLoader().parseAsync(glb, '');
    expect(gltf.animations).toHaveLength(1);
    const clip = gltf.animations[0];
    expect(clip.duration).toBeCloseTo(1, 6); // 24 frame steps at 24 fps
    const pos = clip.tracks.find((t) => t.name.endsWith('.position'))!;
    const rot = clip.tracks.find((t) => t.name.endsWith('.quaternion'))!;
    expect(pos.times.length).toBe(25);
    // Frame 13 is halfway: eased position 3, and slerp has turned 90° about y.
    expect(pos.values[12 * 3]).toBeCloseTo(3, 5);
    expect(rot.values[12 * 4 + 1]).toBeCloseTo(Math.SQRT1_2, 5);
    expect(rot.values[12 * 4 + 3]).toBeCloseTo(Math.SQRT1_2, 5);
  });
});
