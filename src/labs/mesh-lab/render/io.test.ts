// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Editor } from '../../../engines/mesh/core/Editor';
import { runScript } from '../../../engines/mesh/core/api';
import { exportGLB } from '../../../engines/mesh/render/io';

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

describe('GLB export of a rigged character', () => {
  it('re-imports as a SkinnedMesh that three.js deforms exactly as MeshLab does', async () => {
    const THREE = await import('three');
    const { EXAMPLES } = await import('../core/examples');
    const { skinnedSource } = await import('../../../engines/mesh/core/evaluate');
    const e = new Editor(); e.newScene();
    expect(runScript(e, EXAMPLES.find((x) => x.id === 'rig-character')!.code).error).toBeNull();
    e.setFrame(24); // arm raised, leg stepping
    const body = e.scene.get('Character')!, sk = body.skin!;
    const ours = skinnedSource(e.scene, body).verts;

    const gltf = await new GLTFLoader().parseAsync(await exportGLB(e.scene), '');
    let mesh: import('three').SkinnedMesh | undefined;
    gltf.scene.traverse((n) => { if ((n as import('three').SkinnedMesh).isSkinnedMesh) mesh = n as import('three').SkinnedMesh; });
    expect(mesh).toBeDefined();
    // The file keeps "UpperArm.L" (Blender reads it as is); three's loader strips the dot on import.
    expect(mesh!.skeleton.bones.map((b) => b.name)).toEqual(sk.bones.map((n) => THREE.PropertyBinding.sanitizeNodeName(n)));
    expect(gltf.animations[0].tracks.filter((t) => t.name.endsWith('.quaternion')).length).toBe(3); // three keyed bones

    gltf.scene.updateMatrixWorld(true);
    mesh!.skeleton.update();
    // glTF keeps the four strongest weights per vertex (so does Blender's glTF export by default).
    // Where a vertex has four or fewer, three.js must agree with MeshLab exactly.
    let exact = 0, worst = 0, worstOther = 0;
    const p = new THREE.Vector3();
    for (let i = 0; i < ours.length; i++) {
      mesh!.getVertexPosition(i, p);
      const d = p.distanceTo(new THREE.Vector3(...ours[i]));
      if (sk.weights.filter((w) => w[i] > 0).length <= 4) { worst = Math.max(worst, d); exact++; } else worstOther = Math.max(worstOther, d);
    }
    expect(exact).toBeGreaterThan(20);
    expect(worst).toBeLessThan(1e-5);
    expect(worstOther).toBeGreaterThan(1e-3); // the rest differ: they lost their weaker bones

    // Limited to four bones per vertex, every vertex agrees.
    e.limitInfluences(body.id, 4);
    const limited = skinnedSource(e.scene, e.scene.get('Character')!).verts;
    const g2 = await new GLTFLoader().parseAsync(await exportGLB(e.scene), '');
    let m2: import('three').SkinnedMesh | undefined;
    g2.scene.traverse((n) => { if ((n as import('three').SkinnedMesh).isSkinnedMesh) m2 = n as import('three').SkinnedMesh; });
    g2.scene.updateMatrixWorld(true); m2!.skeleton.update();
    let all = 0;
    for (let i = 0; i < limited.length; i++) all = Math.max(all, m2!.getVertexPosition(i, p).distanceTo(new THREE.Vector3(...limited[i])));
    expect(all).toBeLessThan(1e-5);
  });
});
