// Finished example projects: complete scenes to open, look around and take apart.
//
// Each project is a script that builds the whole scene, so how it was made is
// never hidden: it opens in the script panel, and the GUI → code log holds it as
// one step. `setup` says what to show once it is built (what to select, which
// frame, which panel), and `guide` lists things to look at and try.

import type { Editor } from './Editor';
import { runScript } from './api';
import { CHARACTER, EXAMPLES } from './examples';
import { runPython, type PyodideLike } from './python';

export interface ProjectSetup {
  /** Object to select (by name). */
  select?: string;
  frame?: number;
  /** Start playing the animation. */
  play?: boolean;
  /** Enter pose mode on the selected armature. */
  pose?: boolean;
  /** The bone to make active (its keys show on the Timeline). */
  bone?: string;
  /** Record traces while it is built (so the Algorithm trace panel has the build's algorithms). */
  trace?: boolean;
  /** Which bottom panel to open. */
  tab?: 'trace' | 'script' | 'timeline' | 'log';
  /** Frame the camera on everything, or on the selection. */
  view?: 'all' | 'selected';
}

export interface ExampleProject {
  id: string;
  title: string;
  icon: string;
  group: 'Modelling' | 'Animation' | 'Rigging' | 'Geometry & heat maps' | 'Scripting';
  desc: string;
  lang: 'js' | 'python';
  code: string;
  setup: ProjectSetup;
  guide: string[];
}

const rigCode = EXAMPLES.find((x) => x.id === 'rig-character')!.code;
const slerpCode = EXAMPLES.find((x) => x.id === 'euler-vs-slerp')!.code;

export const PROJECTS: ExampleProject[] = [
  // ── Modelling ───────────────────────────────────────────────────────────
  {
    id: 'island',
    title: 'Low-poly island',
    icon: '🏝️',
    group: 'Modelling',
    desc: 'Terrain from a height formula, a sea, palm trees built from primitives and grouped under empties, and rounded rocks.',
    lang: 'js',
    setup: { view: 'all', select: 'Island' },
    guide: [
      'The land is a flat 24 × 24 grid. Every vertex got its height from one formula, height(x, z): Heat map › Height (y) colours it by that number.',
      'Heat map › Mean curvature on the island: red where the ground bulges (hilltops), blue where it dips (valleys).',
      'Click a tree. It is an empty with two children, a trunk and leaves: the inspector shows World = Tree · part. Rotate the tree and both follow.',
      'Script tab: change the seed on the first line, undo (Ctrl+Z), run: a different island.',
    ],
    code: `// A low-poly island. Everything here is placed by arithmetic: change a number, rerun.
let seed = 11
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647   // a repeatable random number, 0–1

// The island's shape: a smooth hill (a Gaussian) with gentle ridges, below the sea at the edges.
const height = (x, z) => {
  const r2 = x * x + z * z
  return 2.2 * Math.exp(-r2 / 10) + 0.35 * Math.sin(1.3 * x) * Math.cos(1.1 * z) * Math.exp(-r2 / 14) - 0.6
}

// 1. Land: a flat grid, each vertex raised to height(x, z) plus a little noise.
const land = scene.add.grid({ name: 'Island', size: 12, subdivisions: 24 })
for (const v of land.mesh.verts) v.y = height(v.x, v.z) + 0.2 * (rand() - 0.5)
land.material.color = '#8fbf5a'
land.material.roughness = 0.95

// 2. Sea: one flat plane at height 0 hides everything below it.
const sea = scene.add.plane({ name: 'Sea', size: 11 })
sea.material.color = '#2f7fc1'
sea.material.roughness = 0.15
sea.material.metalness = 0.2

// 3. Trees: an empty at the ground, a trunk and a cone of leaves as its children.
//    A child's position is relative to its parent, so each tree is built at (0, 0, 0).
let trees = 0
for (let tries = 0; tries < 200 && trees < 9; tries++) {
  const x = (rand() - 0.5) * 7, z = (rand() - 0.5) * 7, y = height(x, z)
  if (y < 0.35 || y > 1.5) continue                    // not on the beach, not on the peak
  const tree = scene.add.empty({ name: 'Tree ' + (++trees), position: [x, y, z] })
  const trunk = scene.add.cylinder({ name: 'Trunk ' + trees, radius: 0.07, height: 0.9, segments: 6, parent: tree, position: [0, 0.45, 0] })
  trunk.material.color = '#7a5230'
  const leaves = scene.add.cone({ name: 'Leaves ' + trees, radius: 0.45, height: 0.9, segments: 7, parent: tree, position: [0, 1.2, 0] })
  leaves.material.color = '#2e8b3e'
  tree.rotation.y = rand() * Math.PI                   // turn each one, so they are not all alike
  tree.scale = [0.8 + 0.5 * rand(), 0.8 + 0.5 * rand(), 0.8 + 0.5 * rand()]
}

// 4. Rocks: a cube, rounded by one Catmull–Clark step, each vertex nudged at random.
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * 2 * Math.PI + rand(), r = 3.4 + 0.4 * rand()
  const x = r * Math.cos(a), z = r * Math.sin(a)
  const rock = scene.add.cube({ name: 'Rock ' + (i + 1), size: 0.6, position: [x, Math.max(0, height(x, z)) + 0.1, z] })
  rock.mesh.subdivide(1)
  for (const v of rock.mesh.verts) { v.x += 0.12 * (rand() - 0.5); v.y *= 0.7; v.z += 0.12 * (rand() - 0.5) }
  rock.material.color = '#8a8d91'
}
log(land.mesh, '·', trees, 'trees · 6 rocks')`,
  },
  {
    id: 'dining-set',
    title: 'Dining set',
    icon: '🪑',
    group: 'Modelling',
    desc: 'A table and four chairs, box-modelled and grouped: one empty holds everything, so the whole set moves as one.',
    lang: 'js',
    setup: { view: 'all', select: 'Chair 2' },
    guide: [
      'The selected chair sits inside "Dining set": the inspector shows its world matrix = Dining set · Chair 2. Its rotation of 180° is the only thing that differs from Chair 1.',
      'Select "Dining set" and rotate it (R): the table and every chair turn together about its origin.',
      'Select the table top and press Tab: its top face was inset (an inner ring) and pushed down 2 cm, making a lip. Face select, click the middle face.',
      'Every chair is made by one function in the script, called four times with a different place and turn.',
    ],
    code: `// A table and four chairs under one empty. Moving "Dining set" moves everything.
const set = scene.add.empty({ name: 'Dining set' })
const wood = '#9a6a3a', dark = '#6e4a28'

// The table top: a cube squashed flat. Its top face is inset and pushed down a little.
const top = scene.add.cube({ name: 'Table top', size: 1, parent: set, position: [0, 0.75, 0] })
for (const v of top.mesh.verts) { v.x *= 2; v.y *= 0.08; v.z *= 1.2 }
const tf = top.mesh.faces.top()
top.mesh.inset(tf, 0.06).extrude(tf, -0.02)
top.material.color = wood

// Four legs: one cube, scaled thin by the object's scale (see S in the inspector's T·R·S).
for (const [x, z] of [[0.9, 0.5], [-0.9, 0.5], [0.9, -0.5], [-0.9, -0.5]]) {
  const leg = scene.add.cube({ name: 'Table leg', size: 1, parent: set, position: [x, 0.36, z], scale: [0.08, 0.72, 0.08] })
  leg.material.color = dark
}

// One chair, built at the origin facing +z; the caller places and turns it.
function chair(name, position, turn) {
  const c = scene.add.empty({ name, parent: set, position })
  c.rotation.y = turn
  const seat = scene.add.cube({ name: name + ' seat', size: 1, parent: c, position: [0, 0.45, 0], scale: [0.46, 0.05, 0.44] })
  seat.material.color = wood
  const back = scene.add.cube({ name: name + ' back', size: 1, parent: c, position: [0, 0.75, -0.2], scale: [0.46, 0.55, 0.04] })
  back.material.color = wood
  for (const [x, z] of [[0.2, 0.19], [-0.2, 0.19], [0.2, -0.19], [-0.2, -0.19]]) {
    const leg = scene.add.cube({ name: name + ' leg', size: 1, parent: c, position: [x, 0.22, z], scale: [0.04, 0.44, 0.04] })
    leg.material.color = dark
  }
  return c
}
chair('Chair 1', [0.5, 0, -0.9], 0)
chair('Chair 2', [-0.5, 0, 0.9], Math.PI)            // the same chair, turned to face the other way
chair('Chair 3', [1.35, 0, 0], -Math.PI / 2)
chair('Chair 4', [-1.35, 0, 0], Math.PI / 2)
set.rotation.y = 0.3
log(scene.objects.length, 'objects in one hierarchy')`,
  },
  {
    id: 'character-model',
    title: 'Box-modelled character',
    icon: '🧍',
    group: 'Modelling',
    desc: 'Half a body, a mirror modifier for the other half, loop cuts, extrusions for arms, legs and head, then subdivision.',
    lang: 'js',
    setup: { view: 'all', select: 'Character', trace: true },
    guide: [
      'Press Tab: the black cage is what you edit, 33 quads for half a body. The mirror makes the other half and subdivision smooths it.',
      'In the inspector, turn the mirror and subdivision modifiers off and on to see what each one does.',
      'The Algorithm trace panel holds the last operation recorded while it was built: step through it.',
      'Heat map › Mean curvature: the smooth body is red where it is most curved (the thin limbs).',
    ],
    code: CHARACTER + `
body.material.color = '#d9a47a'`,
  },

  // ── Animation ───────────────────────────────────────────────────────────
  {
    id: 'bouncing-ball',
    title: 'Bouncing ball (real gravity)',
    icon: '⚽',
    group: 'Animation',
    desc: 'Keys only at the tops and the bounces; ease-in and ease-out make every frame in between exactly what gravity would do. Squash and stretch at each contact.',
    lang: 'js',
    setup: { select: 'Ball', tab: 'timeline', frame: 1, play: true, view: 'all' },
    guide: [
      'Timeline › position: the y curve is a string of parabolas. Only the tops and the bounces are keys; the rest is computed.',
      'Go to a top key and set it to "ease" instead of ease-in: the ball now hangs at the floor. Gravity is quadratic, s = t², not the S-curve.',
      'The frame counts come from t = √(2h / g) in the script: a lower bounce is quicker.',
      'Scale: stretched just before each contact, squashed on it, round again after: the oldest rule of animation.',
    ],
    code: `// A ball dropped from 3.5 m, bouncing under gravity. Height under gravity is quadratic
// in time: falling from rest, y = top − ½gt², so the key at a top eases IN (s = t²);
// rising to rest, it eases OUT (s = 1 − (1 − t)²). The keys then give the exact motion.
const fps = 24, g = 9.8, R = 0.5
scene.setTimeline({ start: 1, end: 96, fps })
const floor = scene.add.plane({ name: 'Floor', size: 14 })
floor.material.color = '#3a3f47'
const ball = scene.add.uvSphere({ name: 'Ball', radius: R, segments: 24, rings: 12 })
ball.material.color = '#e4572e'
ball.smooth = true

let f = 1, x = -4.5, top = 3.5
const vx = 0.1                                       // sideways speed, units per frame
const round = [1, 1, 1], squash = [1.3, 0.7, 1.3], stretch = [0.88, 1.2, 0.88]
ball.keyframe(f, { position: [x, top, 0], scale: round, interp: 'ease-in' })
for (let bounce = 0; bounce < 4; bounce++) {
  const fall = Math.round(Math.sqrt((2 * (top - R)) / g) * fps)   // frames to fall: t = √(2h/g)
  ball.keyframe(f + fall - 2, { scale: stretch, interp: 'linear' }) // stretched just before the floor
  f += fall; x += vx * fall
  ball.keyframe(f, { position: [x, R * squash[1], 0], scale: squash, interp: 'ease-out' })
  ball.keyframe(f + 2, { scale: round, interp: 'linear' })
  top = R + 0.55 * (top - R)                          // each bounce keeps 55% of the height
  const rise = Math.round(Math.sqrt((2 * (top - R)) / g) * fps)
  f += rise; x += vx * rise
  ball.keyframe(f, { position: [x, top, 0], interp: 'ease-in' })
}
scene.setTimeline({ start: 1, end: f })
log('keys at', ball.animation.position.map((k) => k.frame).join(', '))`,
  },
  {
    id: 'robot-arm',
    title: 'Robot arm (nested transforms)',
    icon: '🦾',
    group: 'Animation',
    desc: 'A four-joint arm picks up a block and puts it down. Each joint turns in its parent’s frame, so the gripper’s path is a product of rotations.',
    lang: 'js',
    setup: { select: 'Gripper', tab: 'timeline', frame: 1, play: true, view: 'all' },
    guide: [
      'The blue line is the gripper’s motion path. No key is on the gripper itself: it moves because its parents turn.',
      'Inspector › World = Base · Turret · Shoulder · Elbow · Wrist · Gripper: the chain of matrices, multiplied in that order.',
      'Select Shoulder and look at the Timeline graph: one angle, eased between keys. Watch how it swings everything below it.',
      'Each part hangs off a joint empty, so a part’s scale never stretches the parts below it.',
      'The block is not a child of the arm: the script reads the gripper’s world position every 3 frames and keys the block there ("baking"). Select the block to see its keys.',
    ],
    code: `// A robot arm as a chain: base → turret → shoulder → elbow → wrist → gripper.
// Joints are empties (the pivots); visible parts are their children, so scaling a
// part never stretches what hangs below it.
scene.setTimeline({ start: 1, end: 120, fps: 24 })
const steel = '#9aa4b2', orange = '#ff9f1c'
const base = scene.add.cylinder({ name: 'Base', radius: 0.7, height: 0.3, segments: 24, position: [0, 0.15, 0] })
base.material.color = '#4a5059'
const turret = scene.add.empty({ name: 'Turret', parent: base, position: [0, 0.15, 0] })
scene.add.cylinder({ name: 'Turret body', radius: 0.35, height: 0.3, segments: 16, parent: turret, position: [0, 0.15, 0] }).material.color = orange
const shoulder = scene.add.empty({ name: 'Shoulder', parent: turret, position: [0, 0.35, 0] })
scene.add.cube({ name: 'Upper arm', size: 1, parent: shoulder, position: [0, 0.8, 0], scale: [0.22, 1.6, 0.22] }).material.color = steel
const elbow = scene.add.empty({ name: 'Elbow', parent: shoulder, position: [0, 1.6, 0] })
scene.add.cube({ name: 'Forearm', size: 1, parent: elbow, position: [0, 0.6, 0], scale: [0.18, 1.2, 0.18] }).material.color = steel
const wrist = scene.add.empty({ name: 'Wrist', parent: elbow, position: [0, 1.2, 0] })
const gripper = scene.add.empty({ name: 'Gripper', parent: wrist, position: [0, 0.25, 0] })
scene.add.cube({ name: 'Palm', size: 1, parent: wrist, position: [0, 0.1, 0], scale: [0.4, 0.1, 0.16] }).material.color = orange
const fingerL = scene.add.cube({ name: 'Finger L', size: 1, parent: wrist, position: [0.15, 0.28, 0], scale: [0.05, 0.3, 0.12] })
const fingerR = scene.add.cube({ name: 'Finger R', size: 1, parent: wrist, position: [-0.15, 0.28, 0], scale: [0.05, 0.3, 0.12] })
const block = scene.add.cube({ name: 'Block', size: 0.25, position: [1.9, 0.125, 0.6] })
block.material.color = '#5aa9ff'

// Poses: [turret y, shoulder z, elbow z, wrist z, finger gap], all angles in radians.
const poses = [
  [1, 0.3, 0, 0, 0, 0.15],
  [30, -0.3, -0.9, -1.25, -0.9, 0.15],   // reach down over the block
  [45, -0.3, -0.9, -1.25, -0.9, 0.08],   // close the fingers
  [70, -0.2, -0.3, -1.2, -0.6, 0.08],    // lift
  [95, 2.5, -0.9, -1.25, -0.9, 0.08],    // swing round and down
  [105, 2.5, -0.9, -1.25, -0.9, 0.15],   // let go
  [120, 0.3, 0, 0, 0, 0.15],             // back home
]
for (const [f, ty, sz, ez, wz, gap] of poses) {
  turret.keyframe(f, { rotation: [0, ty, 0] })
  shoulder.keyframe(f, { rotation: [0, 0, sz] })
  elbow.keyframe(f, { rotation: [0, 0, ez] })
  wrist.keyframe(f, { rotation: [0, 0, wz] })
  fingerL.keyframe(f, { position: [gap, 0.28, 0] })
  fingerR.keyframe(f, { position: [-gap, 0.28, 0] })
}

// The block is not a child of the gripper: it is carried by "baking". Go to each frame
// from grab (45) to release (105), read where the gripper is in the world (the last
// column of its world matrix), and key the block there. Blender's "Child Of" constraint,
// baked to keys, does the same.
const gripAt = (f) => { scene.frame = f; const m = gripper.worldMatrix; return { p: [m[12], m[13], m[14]], turn: turret.rotation.y } }
const grab = gripAt(45)
block.keyframe(1, { position: grab.p, rotation: [0, 0, 0], interp: 'constant' })
for (let f = 45; f <= 105; f += 3) {
  const g = gripAt(f)
  block.keyframe(f, { position: g.p, rotation: [0, g.turn - grab.turn, 0], interp: 'linear' })
}
scene.frame = 1
log(scene.objects.length, 'objects,', poses.length, 'poses keyed on 6 of them; the block baked on', block.animation.position.length, 'keys')`,
  },
  {
    id: 'euler-vs-slerp',
    title: 'Euler vs quaternion rotation',
    icon: '🧭',
    group: 'Animation',
    desc: 'Two boxes with the same two rotation keys: one blends Euler angles, the other slerps quaternions. They start and end together and part in between.',
    lang: 'js',
    setup: { select: 'Slerp', tab: 'timeline', frame: 36, view: 'all' },
    guide: [
      'Timeline › rotation: the solid curves are what slerp does to the three angles, the dashed ones are Euler. Slerp’s angles are not straight lines.',
      'The right-hand panel works slerp out at this frame: q₀, q₁, the angle between them, the two weights, and how many degrees Euler is off.',
      'Press Space and watch the boxes: the orange one turns about one fixed axis at even speed; the blue one wobbles through two.',
      'Click Euler for "Slerp" in the Timeline toolbar: now both boxes move together.',
    ],
    code: slerpCode,
  },

  // ── Rigging ────────────────────────────────────────────────────────────
  {
    id: 'walk-and-wave',
    title: 'Rigged character: walk and wave',
    icon: '🚶',
    group: 'Rigging',
    desc: 'The box-modelled character with ten bones and automatic weights, walking on the spot and waving. Pose it yourself in pose mode.',
    lang: 'js',
    setup: { select: 'Rig', bone: 'UpperArm.L', tab: 'timeline', frame: 1, play: true, view: 'all', trace: true },
    guide: [
      'Press Space to pause, then Tab: pose mode. Click a bone and drag the gizmo rings; I keys the pose at this frame.',
      'Select Character and use Heat map › Bone weights (or the Skin panel): red is where a bone moves the skin fully.',
      'The Algorithm trace panel shows how the weights were computed: heat spreading from each bone over the surface.',
      'Tab into edit mode on Character, select a vertex on the hand and press "Explain skinning here": each bone’s idea of where it goes, and the blend.',
    ],
    code: rigCode + `

// 9. Walk on the spot: legs swing opposite each other, arms against the legs, the head nods.
scene.setTimeline({ start: 1, end: 48 })
const swing = (bone, a, b) => rig.bone(bone).keyframe(1, { rotation: a }).keyframe(13, { rotation: [0, 0, 0] }).keyframe(25, { rotation: b }).keyframe(37, { rotation: [0, 0, 0] }).keyframe(48, { rotation: a })
swing('Thigh.L', [-0.45, 0, 0], [0.45, 0, 0])
swing('Thigh.R', [0.45, 0, 0], [-0.45, 0, 0])
swing('Shin.L', [0.5, 0, 0], [0.05, 0, 0])
swing('Shin.R', [0.05, 0, 0], [0.5, 0, 0])
swing('UpperArm.R', [0, 0.4, -0.9], [0, -0.4, -0.9])
swing('Head', [0.08, 0.1, 0], [0.08, -0.1, 0])
body.material.color = '#d9a47a'`,
  },

  // ── Geometry & heat maps ─────────────────────────────────────────────────
  {
    id: 'curvature-gallery',
    title: 'Curvature gallery',
    icon: '🌈',
    group: 'Geometry & heat maps',
    desc: 'A sphere, a torus, a saddle, a cylinder and a rounded cube side by side, with their Gauss–Bonnet totals printed.',
    lang: 'js',
    setup: { select: 'Torus', view: 'all', tab: 'script' },
    guide: [
      'The torus is coloured by Gaussian curvature K: red outside (dome-like), blue inside (saddle-like), white along the top and bottom circles.',
      'Select each shape and switch Heat map between H and K. The cylinder: H is not zero, K is. It bends in one direction only.',
      'The output panel: K summed over each closed surface is 2π·(V − E + F). Sphere, cylinder and cube give 4π; the torus gives 0, however you bend it.',
      'The saddle (y = x² − z² scaled) is blue for K everywhere: it curves up one way and down the other.',
    ],
    code: `// Five surfaces, one idea: Gaussian curvature K. Each is summed over its surface below.
const sphere = scene.add.uvSphere({ name: 'Sphere', radius: 0.9, segments: 32, rings: 16, position: [-4, 1, 0] })
const torus = scene.add.torus({ name: 'Torus', radius: 0.8, tube: 0.35, segments: 48, tubeSegments: 24, position: [-1.5, 1, 0] })
const cyl = scene.add.cylinder({ name: 'Cylinder', radius: 0.6, height: 1.6, segments: 32, position: [1, 1, 0] })
cyl.mesh.loopCut(cyl.mesh.nearest([0.6, -0.8, 0]), cyl.mesh.nearest([0.6, 0.8, 0]), 0.5)   // more rings for the heat map
const cube = scene.add.cube({ name: 'Rounded cube', size: 1.4, position: [3.4, 1, 0] })
cube.mesh.subdivide(3)

// A saddle: a grid bent to y = 0.3 (x² − z²). It has an edge, so it is not closed.
const saddle = scene.add.grid({ name: 'Saddle', size: 2, subdivisions: 20, position: [-1.5, 1, 3] })
for (const v of saddle.mesh.verts) v.y = 0.3 * (v.x * v.x - v.z * v.z)
for (const o of [sphere, torus, cyl, cube, saddle]) { o.smooth = true; o.material.color = '#cfd6df' }

// Gauss–Bonnet: Σ K·area = 2π·χ for a closed surface, χ = V − E + F.
for (const o of [sphere, torus, cyl, cube]) {
  const K = o.mesh.curvature('gaussian'), { mass } = o.mesh.laplacian()
  const total = K.reduce((s, k, i) => s + k * mass[i], 0)
  log(o.name.padEnd(13), 'Σ K·area =', (total / Math.PI).toFixed(6) + 'π', '  χ =', o.mesh.stats().euler)
}
torus.mesh.showField('gaussian')`,
  },
  {
    id: 'knot-distance',
    title: 'Distance on a knot',
    icon: '🪢',
    group: 'Geometry & heat maps',
    desc: 'A trefoil knot tube built from its equation, coloured by distance along the surface from one point, found by the heat method.',
    lang: 'js',
    setup: { select: 'Trefoil', view: 'all', tab: 'trace', trace: true },
    guide: [
      'The colours are walking distance on the tube from the white dot, not straight-line distance: follow a line of equal colour round the knot.',
      'The Algorithm trace panel holds the heat method step by step: heat spreading for a short time, the direction it flows, the divergence, then the Poisson solve. "Show in viewport" colours the knot at each step.',
      'Script tab: the knot is (sin t + 2 sin 2t, cos t − 2 cos 2t, −sin 3t), with a ring of vertices around each point. Change the 3 in sin 3t, undo, run.',
      'Tab into edit mode, select a different vertex, and Heat map › Distance from selected vertices.',
    ],
    code: `// A trefoil knot: a curve c(t), and a tube of radius r around it.
const N = 160, M = 12, r = 0.35
const c = (t) => [Math.sin(t) + 2 * Math.sin(2 * t), Math.cos(t) - 2 * Math.cos(2 * t), -Math.sin(3 * t)]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (a) => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l] }

const verts = [], faces = []
for (let i = 0; i < N; i++) {
  const t = (i / N) * 2 * Math.PI, p = c(t)
  const T = unit(sub(c(t + 1e-3), c(t - 1e-3)))     // the direction of the curve
  const B = unit(cross(T, [0, 0, 1]))               // two directions across it …
  const Nn = cross(B, T)                             // … at right angles to it and each other
  for (let j = 0; j < M; j++) {
    const a = (j / M) * 2 * Math.PI
    verts.push([p[0] + r * (Math.cos(a) * B[0] + Math.sin(a) * Nn[0]), p[1] + r * (Math.cos(a) * B[1] + Math.sin(a) * Nn[1]), p[2] + r * (Math.cos(a) * B[2] + Math.sin(a) * Nn[2])])
  }
}
for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
  const a = i * M + j, b = i * M + (j + 1) % M, c2 = ((i + 1) % N) * M + (j + 1) % M, d = ((i + 1) % N) * M + j
  faces.push([a, d, c2, b])
}
const knot = scene.add.mesh({ name: 'Trefoil', verts, faces, position: [0, 2, 0] })
knot.smooth = true
knot.material.color = '#cfd6df'
log(knot.mesh, '· closed:', knot.mesh.stats().closed)
knot.mesh.showField('geodesic', { from: 0 })`,
  },
  {
    id: 'smoothing',
    title: 'Noise and smoothing',
    icon: '🫧',
    group: 'Geometry & heat maps',
    desc: 'A bumpy sphere and copies smoothed 5 and 40 times: the bumps go first, and the whole thing slowly shrinks.',
    lang: 'js',
    setup: { select: 'Bumpy', view: 'all', tab: 'script' },
    guide: [
      'The bumpy sphere is coloured by mean curvature: every bump is a red spot with a blue rim.',
      'The output panel: after 5 smoothing steps the bumps are mostly gone, but the volume is smaller; after 40 it has shrunk a lot. That is the cost of plain Laplacian smoothing.',
      'Select "Smoothed ×5" and Heat map › Mean curvature: nearly one colour, like a sphere.',
      'Tab into edit mode on "Bumpy", select some vertices, Mesh › Smooth vertices, then change the iterations in the Adjust panel.',
    ],
    code: `// Smoothing = moving each vertex part way to the average of its neighbours.
let seed = 3
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const bumpy = scene.add.uvSphere({ name: 'Bumpy', radius: 1, segments: 40, rings: 20, position: [-2.6, 1.2, 0] })
for (const v of bumpy.mesh.verts) {                   // push each vertex out or in along its own direction
  const k = 1 + 0.08 * (rand() - 0.5)
  v.x *= k; v.y *= k; v.z *= k
}
bumpy.smooth = true
const five = bumpy.duplicate(); five.name = 'Smoothed ×5'; five.position.x = 0
five.mesh.smooth({ iterations: 5, lambda: 0.5 })
const forty = bumpy.duplicate(); forty.name = 'Smoothed ×40'; forty.position.x = 2.6
forty.mesh.smooth({ iterations: 40, lambda: 0.5 })
for (const o of [bumpy, five, forty]) {
  const H = o.mesh.curvature('mean'), mean = H.reduce((a, b) => a + b) / H.length
  const spread = Math.sqrt(H.reduce((s, h) => s + (h - mean) ** 2, 0) / H.length)
  log(o.name.padEnd(13), 'volume', o.mesh.stats().volume.toFixed(3), '  mean curvature', mean.toFixed(3), '±', spread.toFixed(3))
}
bumpy.mesh.showField('mean')`,
  },

  // ── Scripting ───────────────────────────────────────────────────────────
  {
    id: 'python-vase',
    title: 'Python: a turned vase',
    icon: '🏺',
    group: 'Scripting',
    desc: 'A vase built vertex by vertex in Python: a profile curve turned around the y axis, the way a lathe (or Blender’s Screw modifier) does it.',
    lang: 'python',
    setup: { select: 'Vase', view: 'all', tab: 'script' },
    guide: [
      'The script is in the Script panel, in Python. Press "Step through" to run it line by line: the verts list grows, and at the end the vase appears.',
      'radius(y) is the profile. Change the numbers in it (the 0.25 and the 2.2), undo, run: a different vase.',
      'Tab into edit mode: every ring of vertices is one height; every column one angle.',
      'Heat map › Height (y) shows the rings; Heat map › Mean curvature shows the neck and the belly.',
    ],
    code: `# A surface of revolution: a profile r(y) turned around the y axis.
import math

rings, segments = 28, 32

def radius(y):
    # The profile: a belly low down, a narrow neck, a lip at the top.
    return 0.55 + 0.25 * math.sin(2.2 * y + 0.6) + 0.08 * math.cos(6 * y)

verts = []
for i in range(rings + 1):
    y = 2.0 * i / rings
    r = radius(y)
    for j in range(segments):
        a = 2 * math.pi * j / segments
        verts.append([r * math.cos(a), y, -r * math.sin(a)])

faces = []
for i in range(rings):
    for j in range(segments):
        k = (j + 1) % segments
        a, b = i * segments + j, i * segments + k
        faces.append([a, b, b + segments, a + segments])
faces.append([segments - 1 - j for j in range(segments)])   # the base, facing down

vase = scene.add.mesh(name='Vase', verts=verts, faces=faces)
vase.smooth = True
vase.material.color = '#c8744a'
print(vase.mesh, '- open at the top:', not vase.mesh.stats().closed)`,
  },
];

export const PROJECT_GROUPS = ['Modelling', 'Animation', 'Rigging', 'Geometry & heat maps', 'Scripting'] as const;

/**
 * Build a project on a new scene (the default cube removed, the sun kept) and
 * apply the parts of its setup that belong to the editor: tracing, selection,
 * frame, pose mode. Camera, panels and playback are the UI's to apply.
 */
export function openProject(editor: Editor, p: ExampleProject, py?: PyodideLike): { error: string | null; output: string[] } {
  editor.newScene();
  editor.field = null;
  editor.playing = false;
  const cube = editor.scene.get('Cube');
  if (cube) editor.scene.remove(cube.id);
  editor.selected.clear(); editor.active = null;
  const tracing = editor.traceEnabled;
  editor.traceEnabled = !!p.setup.trace;
  const label = `Open example: ${p.title}`;
  let r;
  if (p.lang === 'python') {
    if (!py) return { error: 'Python is not loaded', output: [] };
    r = runPython(editor, py, p.code, label);
  } else r = runScript(editor, p.code, label);
  editor.traceEnabled = tracing || !!p.setup.trace;
  if (r.error) return { error: r.error, output: r.output };
  const s = p.setup;
  if (s.frame !== undefined) editor.setFrame(s.frame);
  if (s.select) { const o = editor.scene.get(s.select); if (o) editor.selectObject(o.id); }
  if (s.bone) editor.activeBone = s.bone;
  if (s.pose) editor.enterPose();
  editor.message = `${p.title}: see the guide in the viewport`;
  editor.emit('select');
  return { error: null, output: r.output };
}
