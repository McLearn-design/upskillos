import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { EditMesh, type Vec3 } from './EditMesh';
import { boneHeatWeights, boneMatrices, chain, deform, posedEnds, restMatrix, type Bone, type Skin } from './armature';
import { Editor } from './Editor';
import { evaluatedMesh, skinState, skinSource } from './evaluate';
import { runScript } from './api';
import { Scene } from './Scene';

const R = 0.3;
/** An open tube along y from 0 to 2: 21 rings of 12 vertices. Ring k is at y = k / 10. */
function tube(): EditMesh {
  const verts: Vec3[] = [], faces: number[][] = [];
  for (let k = 0; k <= 20; k++) for (let i = 0; i < 12; i++) { const a = (i / 12) * 2 * Math.PI; verts.push([R * Math.cos(a), k / 10, -R * Math.sin(a)]); }
  for (let k = 0; k < 20; k++) for (let i = 0; i < 12; i++) { const j = (i + 1) % 12; faces.push([k * 12 + i, k * 12 + j, (k + 1) * 12 + j, (k + 1) * 12 + i]); }
  return new EditMesh(verts, faces);
}
const ring = (k: number) => Array.from({ length: 12 }, (_, i) => k * 12 + i);
const legBones = (): Bone[] => chain(['Thigh', 'Shin'], [[0, 0, 0], [0, 1, 0], [0, 2, 0]]);
const close = (a: number[], b: number[], d = 10) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i], d));

describe('bone matrices', () => {
  it("a bone's rest frame has y along the bone, so B · (0, length, 0) is the tail", () => {
    const b: Bone = { name: 'B', parent: null, head: [1, 0, 0], tail: [1, 0, 2], pose: [0, 0, 0] };
    const t = new Vector3(0, 2, 0).applyMatrix4(restMatrix(b));
    close(t.toArray(), [1, 0, 2]);
  });

  it('rotating a parent carries its child: a quarter turn about z swings the leg to −x', () => {
    const bones = legBones();
    bones[0].pose = [0, 0, Math.PI / 2];
    const e = posedEnds(bones);
    close(e.get('Shin')!.head, [-1, 0, 0]);
    close(e.get('Shin')!.tail, [-2, 0, 0]);
  });

  it('in the rest pose every skin matrix is the identity and the mesh does not move', () => {
    const m = tube(), bones = legBones();
    const skin: Skin = { armature: 'a', bones: ['Thigh', 'Shin'], weights: boneHeatWeights(m, bones), verts: m.verts.length };
    for (const x of boneMatrices(bones).values()) close(x.skin.elements, new Array(16).fill(0).map((_, i) => (i % 5 === 0 ? 1 : 0)));
    deform(m, skin, bones).verts.forEach((v, i) => close(v, m.verts[i], 12));
  });
});

describe('automatic weights (bone heat)', () => {
  const m = tube(), bones = legBones();
  const w = boneHeatWeights(m, bones);
  const avg = (b: number, k: number) => ring(k).reduce((s, i) => s + w[b][i], 0) / 12;

  it('sum to 1 at every vertex', () => {
    for (let i = 0; i < m.verts.length; i++) expect(w[0][i] + w[1][i]).toBeCloseTo(1, 12);
  });

  it('belong to the thigh at the hip, the shin at the ankle, and are shared at the knee', () => {
    // Heat from the far bone still reaches the ends faintly (about e^(−distance / radius)); nearly pure there.
    expect(avg(0, 0)).toBeGreaterThan(0.95); expect(avg(1, 20)).toBeGreaterThan(0.95);
    expect(avg(0, 10)).toBeGreaterThan(0.3); expect(avg(0, 10)).toBeLessThan(0.7);
    for (let k = 1; k <= 20; k++) expect(avg(0, k)).toBeLessThanOrEqual(avg(0, k - 1) + 1e-9); // fading along the leg
  });

  it('bending the shin moves its own vertices rigidly about the knee and leaves the thigh alone', () => {
    // A hard split at the knee, so the rigid motion can be checked exactly.
    const hard = [m.verts.map((v) => (v[1] < 1 ? 1 : 0)), m.verts.map((v) => (v[1] < 1 ? 0 : 1))];
    const skin: Skin = { armature: 'a', bones: ['Thigh', 'Shin'], weights: hard, verts: m.verts.length };
    const posed = legBones(); posed[1].pose = [0, 0, Math.PI / 2];
    const out = deform(m, skin, posed);
    let rigid = 0, still = 0;
    for (let i = 0; i < m.verts.length; i++) {
      const [x, y, z] = m.verts[i];
      if (hard[1][i] === 1) { close(out.verts[i], [-(y - 1), 1 + x, z]); rigid++; } // (x, y − 1) turned 90° about the knee
      else { close(out.verts[i], m.verts[i]); still++; }
    }
    expect(rigid).toBeGreaterThan(24); expect(still).toBeGreaterThan(24);
  });

  it('twisting half a turn collapses the knee: the candy-wrapper artefact of linear blending', () => {
    const skin: Skin = { armature: 'a', bones: ['Thigh', 'Shin'], weights: w, verts: m.verts.length };
    const posed = legBones(); posed[1].pose = [0, Math.PI, 0];
    const out = deform(m, skin, posed);
    // A vertex half on each bone goes to ½v + ½(v turned 180°) = the axis.
    const radius = (k: number) => ring(k).reduce((s, i) => s + Math.hypot(out.verts[i][0], out.verts[i][2]), 0) / 12;
    expect(radius(10)).toBeLessThan(0.5 * R);
    expect(radius(0)).toBeGreaterThan(0.9 * R);
  });
});

describe('armatures in the editor', () => {
  const setup = () => {
    const e = new Editor(); e.newScene();
    e.deleteObjects([e.scene.get('Cube')!.id]);
    const leg = e.scene.add({ name: 'Leg', mesh: tube() });
    const arm = e.addArmature([{ name: 'Thigh', parent: null, head: [0, 0, 0], tail: [0, 1, 0] }], 'Rig');
    e.addBone('Thigh');
    return { e, leg, arm };
  };

  it('adds a child bone from the tail, binds, poses, and undoes', () => {
    const { e, leg, arm } = setup();
    expect(arm.bones!.map((b) => [b.name, b.parent, b.tail])).toEqual([['Thigh', null, [0, 1, 0]], ['Thigh.001', 'Thigh', [0, 2, 0]]]);
    e.setBone('Thigh.001', { name: 'Shin' });
    e.selectObject(leg.id); e.selectObject(arm.id, true);
    expect(e.bindToArmature()).toBe(true);
    expect(leg.skin!.bones).toEqual(['Thigh', 'Shin']);
    expect(leg.parent).toBe(arm.id);
    e.setBonePose('Shin', [0, 0, Math.PI / 2]);
    const top = evaluatedMesh(e.scene, e.scene.get(leg.id)!).verts[ring(20)[0]];
    close(top, [-1, 1 + R, 0], 1);
    e.undo();
    close(evaluatedMesh(e.scene, e.scene.get(leg.id)!).verts[ring(20)[0]], [R, 2, 0]);
  });

  it('a rename follows through to the skin and the keys; deleting a bone drops its weights', () => {
    const { e, leg, arm } = setup();
    e.selectObject(leg.id); e.selectObject(arm.id, true); e.bindToArmature();
    e.enterPose(); e.selectBone('Thigh.001');
    e.setFrame(1); e.insertKey();
    e.setBone('Thigh.001', { name: 'Shin' });
    const a = e.scene.get(arm.id)!, l = e.scene.get(leg.id)!;
    expect(l.skin!.bones).toEqual(['Thigh', 'Shin']);
    expect(Object.keys(a.anim!.bones!)).toEqual(['Shin']);
    e.deleteBone('Shin');
    expect(e.scene.get(leg.id)!.skin!.bones).toEqual(['Thigh']);
    expect(e.scene.get(arm.id)!.anim).toBeUndefined();
  });

  it('bone keys slerp between poses', () => {
    const { e, arm } = setup();
    e.selectObject(arm.id); e.enterPose(); e.selectBone('Thigh.001');
    e.setFrame(1); e.insertKey();
    e.setFrame(21); e.setBonePose('Thigh.001', [0, 0, Math.PI / 2]); e.insertKey();
    e.setFrame(11);
    close(e.scene.get(arm.id)!.bones![1].pose, [0, 0, Math.PI / 4]); // eased halfway: exactly half the turn
  });

  it('the log rebuilds the rig, the binding (same weights) and the animation', () => {
    const { e, leg, arm } = setup();
    e.selectObject(leg.id); e.selectObject(arm.id, true); e.bindToArmature();
    e.enterPose(); e.selectBone('Thigh'); e.setFrame(1); e.setBonePose('Thigh', [0.3, 0, 0]); e.insertKey();
    // The leg mesh was added directly, so give the replay the same starting mesh.
    const e2 = new Editor(); e2.newScene(); // the log deletes the Cube itself
    e2.scene.add({ name: 'Leg', mesh: tube() });
    expect(runScript(e2, e.log.map((l) => l.code).join('\n')).error).toBeNull();
    const l2 = e2.scene.get('Leg')!, a2 = e2.scene.get('Rig')!;
    expect(l2.skin!.weights).toEqual(e.scene.get(leg.id)!.skin!.weights);
    expect(a2.anim).toEqual(e.scene.get(arm.id)!.anim);
    expect(a2.bones![0].pose).toEqual([0.3, 0, 0]);
  });

  it('the weights heat map shows exactly the skin weights; a changed mesh makes the skin stale', () => {
    const { e, leg, arm } = setup();
    e.selectObject(leg.id); e.selectObject(arm.id, true); e.bindToArmature();
    expect(e.showField({ kind: 'weight', bone: 'Thigh' }, leg.id)).toBe(true);
    expect(Array.from(e.field!.result.values)).toEqual(e.scene.get(leg.id)!.skin!.weights[0]);
    expect(e.log.at(-1)!.code).toBe('scene.get("Leg").mesh.showField("weight", { bone: "Thigh" })');
    const l = e.scene.get(leg.id)!;
    l.mesh!.extrudeFaces([0], 0.1);
    expect(skinState(e.scene, l)).toBe('stale');
    expect(evaluatedMesh(e.scene, l).verts.length).toBe(l.mesh!.verts.length); // undeformed, not broken
  });

  it('files keep bones, poses, skins and bone keys', () => {
    const { e, leg, arm } = setup();
    e.selectObject(leg.id); e.selectObject(arm.id, true); e.bindToArmature();
    e.setBonePose('Thigh', [0, 0, 0.5]);
    const back = Scene.fromJSON(JSON.parse(JSON.stringify(e.scene.toJSON())));
    expect(back.get('Rig')!.bones).toEqual(e.scene.get(arm.id)!.bones);
    expect(back.get('Leg')!.skin).toEqual(e.scene.get(leg.id)!.skin);
  });
});

describe('armatures from scripts', () => {
  it('builds a rig, binds a mirrored, subdivided mesh, poses it', () => {
    const e = new Editor(); e.newScene();
    const r = runScript(e, `
      const rig = scene.add.armature({ name: 'Rig', bones: [
        { name: 'Body', head: [0, 0, 0], tail: [0, 1, 0] },
        { name: 'Arm', parent: 'Body', head: [0.5, 1, 0], tail: [1.5, 1, 0] },
      ] })
      const box = scene.add.cube({ name: 'Box', size: 1, position: [0, 0.5, 0] })
      box.mesh.loopCut(0, 1)
      box.modifiers.add('mirror', { axis: 'x' })
      box.modifiers.add('subsurf', { levels: 1 })
      box.bindTo(rig)
      rig.bone('Arm').pose = [0, 0, 0.5]
      log(box.skin.bones, box.skin.verts, rig.bone('Arm').length, rig.bones.map(String))
    `);
    expect(r.error).toBeNull();
    const box = e.scene.get('Box')!;
    expect(r.output[0]).toBe(`["Body","Arm"] ${skinSource(box).verts.length} 1 ["Bone \\"Body\\"","Bone \\"Arm\\""]`);
    expect(skinState(e.scene, box)).toBe('ok');
    expect(evaluatedMesh(e.scene, box).faces.length).toBe(skinSource(box).faces.length * 4);
  });

  it('errors are clear', () => {
    const e = new Editor(); e.newScene();
    expect(runScript(e, `scene.add.armature({ bones: [{ name: 'A', parent: 'B', head: [0,0,0], tail: [0,1,0] }] })`).error).toMatch(/missing parent "B"/);
    expect(runScript(e, `scene.get('Cube').bone('X')`).error).toMatch(/has no bone called "X"/);
  });
});

describe('the rigged character example', () => {
  it('weights the hand to the arm bones only, and the wave lifts it', async () => {
    const { EXAMPLES } = await import('./examples');
    const e = new Editor(); e.newScene();
    expect(runScript(e, EXAMPLES.find((x) => x.id === 'rig-character')!.code).error).toBeNull();
    const body = e.scene.get('Character')!, sk = body.skin!;
    const src = skinSource(body);
    const hand = src.verts.map((v, i) => [v, i] as const).filter(([v]) => v[0] > 1.4).map(([, i]) => i);
    expect(hand.length).toBe(4); // the end of the arm: one square
    const w = (bone: string) => hand.reduce((s, i) => s + sk.weights[sk.bones.indexOf(bone)][i], 0) / hand.length;
    expect(w('Forearm.L')).toBeGreaterThan(0.9);
    expect(w('UpperArm.L') + w('Forearm.L')).toBeCloseTo(1, 12); // nothing from the legs or the other arm
    const y = (f: number) => { e.setFrame(f); const p = evaluatedMesh(e.scene, e.scene.get('Character')!); return hand.reduce((s, i) => s + p.verts[i][1], 0) / hand.length; };
    expect(y(24)).toBeGreaterThan(y(1) + 1); // arm down at frame 1, up at 24
  });
});

describe('dual-quaternion skinning', () => {
  const m = tube(), bones = legBones();
  const w = boneHeatWeights(m, bones);
  const skin = (method: 'linear' | 'dual-quaternion'): Skin => ({ armature: 'a', bones: ['Thigh', 'Shin'], weights: w, verts: m.verts.length, method });
  const radius = (verts: Vec3[], k: number) => ring(k).reduce((s, i) => s + Math.hypot(verts[i][0], verts[i][2]), 0) / 12;

  it('fixes the candy wrapper: a half twist keeps the knee round instead of collapsing it', () => {
    const posed = legBones(); posed[1].pose = [0, Math.PI * 0.999, 0];
    const lin = deform(m, skin('linear'), posed).verts, dq = deform(m, skin('dual-quaternion'), posed).verts;
    expect(radius(lin, 10)).toBeLessThan(0.5 * R);
    expect(radius(dq, 10)).toBeGreaterThan(0.95 * R);
    for (let k = 0; k <= 20; k++) expect(radius(dq, k)).toBeCloseTo(R, 2); // every ring keeps its radius
  });

  it('agrees with linear blending wherever a vertex follows one bone, and in the rest pose', () => {
    const hard: Skin = { ...skin('dual-quaternion'), weights: [m.verts.map((v) => (v[1] < 1 ? 1 : 0)), m.verts.map((v) => (v[1] < 1 ? 0 : 1))] };
    const posed = legBones(); posed[0].pose = [0.3, 0.2, -0.4]; posed[1].pose = [0, 0, 1.2];
    const a = deform(m, hard, posed).verts, b = deform(m, { ...hard, method: 'linear' }, posed).verts;
    a.forEach((v, i) => close(v, b[i], 9));
    deform(m, skin('dual-quaternion'), legBones()).verts.forEach((v, i) => close(v, m.verts[i], 12));
  });

  it('is chosen per mesh, undoable, logged and scriptable', () => {
    const e = new Editor(); e.newScene();
    expect(runScript(e, `scene.add.armature({ name: 'R', bones: [{ name: 'A', head: [0,0,0], tail: [0,1,0] }] })\nscene.get('Cube').bindTo(scene.get('R'))\nscene.get('Cube').skinning = 'dual-quaternion'`).error).toBeNull();
    const id = e.scene.get('Cube')!.id;
    expect(e.scene.get(id)!.skin!.method).toBe('dual-quaternion');
    e.setSkinMethod(id, 'linear');
    expect(e.log.at(-1)!.code).toBe('scene.get("Cube").skinning = "linear"');
    e.undo();
    expect(e.scene.get(id)!.skin!.method).toBe('dual-quaternion');
    expect(Scene.fromJSON(JSON.parse(JSON.stringify(e.scene.toJSON()))).get('Cube')!.skin!.method).toBe('dual-quaternion');
  });
});

describe('bone roll and bone editing', () => {
  it('roll does not move a bone but turns the axis its pose bends about', () => {
    const plain = legBones(), rolled = legBones();
    rolled[0].roll = Math.PI / 2;
    close(new Vector3(0, 1, 0).applyMatrix4(restMatrix(rolled[0])).toArray(), [0, 1, 0]); // the tail is where it was
    for (const b of [plain, rolled]) b[0].pose = [Math.PI / 2, 0, 0];                       // "bend about the bone's x"
    close(posedEnds(plain).get('Shin')!.head, [0, 0, 1]);    // x is world x: the leg swings forward
    close(posedEnds(rolled).get('Shin')!.head, [1, 0, 0]);   // rolled 90°, x faces −z: it swings sideways
  });

  it('moving a joint moves the joints that touch it; a whole bone drags its neighbours\' ends', async () => {
    const { moveJoint } = await import('./armature');
    const start = chain(['A', 'B', 'C'], [[0, 0, 0], [0, 1, 0], [0, 2, 0], [0, 3, 0]]);
    const bones = start.map((b) => ({ ...b, head: [...b.head] as Vec3, tail: [...b.tail] as Vec3 }));
    expect(moveJoint(bones, start, { bone: 'A', part: 'tail' }, [0.5, 0, 0])).toEqual(['A', 'B']);
    expect(bones.map((b) => [b.head, b.tail])).toEqual([[[0, 0, 0], [0.5, 1, 0]], [[0.5, 1, 0], [0, 2, 0]], [[0, 2, 0], [0, 3, 0]]]);
    expect(moveJoint(bones, start, { bone: 'B', part: 'body' }, [0, 0, 1])).toEqual(['A', 'B', 'C']);
    expect(bones[1].head).toEqual([0, 1, 1]); expect(bones[0].tail).toEqual([0, 1, 1]); expect(bones[2].head).toEqual([0, 2, 1]);
  });

  it('bone edit mode: Tab enters it, a drag is one logged undo step, E extrudes, roll round-trips', () => {
    const e = new Editor(); e.newScene();
    const arm = e.addArmature([{ name: 'A', parent: null, head: [0, 0, 0], tail: [0, 1, 0] }], 'Rig');
    e.selectObject(arm.id);
    e.toggleEdit();
    expect(e.mode).toBe('bones');
    expect(e.boneSel).toEqual({ bone: 'A', part: 'tail' });
    e.extrudeBone();
    expect(e.boneSel).toEqual({ bone: 'A.001', part: 'tail' });
    e.selectJoint({ bone: 'A', part: 'tail' });
    e.beginLive(); e.beginJointDrag(); e.jointDrag([1, 0, 0]); e.endJointDrag();
    const r = e.scene.get(arm.id)!;
    expect(r.bones!.find((b) => b.name === 'A.001')!.head).toEqual([1, 1, 0]); // the child followed
    expect(e.log.at(-1)!.code).toBe('scene.get("Rig").bone("A").set({ head: [0, 0, 0], tail: [1, 1, 0] })\nscene.get("Rig").bone("A.001").set({ head: [1, 1, 0], tail: [0, 2, 0] })');
    e.setBone('A', { roll: 0.5 });
    expect(Scene.fromJSON(JSON.parse(JSON.stringify(e.scene.toJSON()))).get('Rig')!.bones![0].roll).toBe(0.5);
    const e2 = new Editor(); e2.newScene();
    expect(runScript(e2, e.log.map((l) => l.code).join('\n')).error).toBeNull();
    expect(e2.scene.get('Rig')!.bones).toEqual(e.scene.get(arm.id)!.bones);
    e.toggleEdit();
    expect(e.mode).toBe('object');
  });
});
