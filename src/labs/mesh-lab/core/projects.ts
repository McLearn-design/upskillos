// Finished example projects: complete scenes to open, look around and take apart.
//
// Each project is a script that builds the whole scene, so how it was made is
// never hidden: it opens in the script panel, and the GUI → code log holds it as
// one step. `setup` says what to show once it is built (what to select, which
// frame, which panel), and `guide` lists things to look at and try.

import type { Editor } from '../../../engines/mesh/core/Editor';
import type { Vec3 } from '../../../engines/mesh/core/EditMesh';
import { runScript } from '../../../engines/mesh/core/api';
import { CHARACTER, EXAMPLES } from './examples';
import { runPython, type PyodideLike } from '../../../engines/mesh/core/python';

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
  /** Open in weight paint mode on the selected mesh, painting this bone. */
  weightPaint?: string;
  /** Turn on Predict mode in the trace player (learning). */
  predict?: boolean;
  /** Record traces while it is built (so the Algorithm trace panel has the build's algorithms). */
  trace?: boolean;
  /** Which bottom panel to open. */
  tab?: 'trace' | 'script' | 'timeline' | 'uv' | 'shader' | 'log';
  /** Frame the camera on everything, or on the selection. */
  view?: 'all' | 'selected';
}

/** An object as it was when the project opened, so a guide step can tick when you change it. */
export interface StartObject { position: Vec3; rotation: Vec3; scale: Vec3; verts: Vec3[] | null; bones: number; glsl: string | undefined }
export interface StartState {
  obj(name: string): StartObject | undefined;
  /** The heat map shown at the start, as JSON, or null. */
  field: string | null;
  /** How long the GUI → code log was: steps look only at what you did after. */
  log: number;
}

/**
 * A guide step: plain text, or text with a check that ticks it when you have done
 * it. Checks read only the scene, the mode and the GUI → code log, never the UI.
 */
export type GuideStep = string | { text: string; done: (e: Editor, start: StartState) => boolean };
export const stepText = (g: GuideStep): string => (typeof g === 'string' ? g : g.text);
const step = (text: string, done: (e: Editor, start: StartState) => boolean): GuideStep => ({ text, done });

/** Record the scene as it is now, for guide steps to compare against. */
export function startState(e: Editor): StartState {
  const objs = new Map(e.scene.objects.map((o) => [o.name, {
    position: [...o.position] as Vec3, rotation: [...o.rotation] as Vec3, scale: [...o.scale] as Vec3,
    verts: o.mesh ? o.mesh.verts.map((v) => [...v] as Vec3) : null, bones: o.bones?.length ?? 0, glsl: o.material?.glsl,
  }]));
  return { obj: (n) => objs.get(n), field: e.field ? JSON.stringify(e.field.spec) : null, log: e.log.length };
}

// What guide checks ask.
/** You did this operation (its label in the GUI → code log) since the project opened. */
const did = (e: Editor, s: StartState, label: string, times = 1) => e.log.slice(s.log).filter((l) => l.label === label).length >= times;
/** Weight-paint strokes since the project opened (each is logged as "Paint <bone>"). */
const strokes = (e: Editor, s: StartState) => e.log.slice(s.log).filter((l) => l.label.startsWith('Paint ') && l.code?.includes('.paintWeights(')).length;
/** The object's position, rotation or scale is not what it was. */
const moved = (e: Editor, s: StartState, name: string) => {
  const o = e.scene.get(name), was = s.obj(name);
  const same = (a: Vec3, b: Vec3) => a.every((x, i) => Math.abs(x - b[i]) < 1e-6);
  return !!o && !!was && !(same(o.position, was.position) && same(o.rotation, was.rotation) && same(o.scale, was.scale));
};
/** The heat map of this kind is showing on this object. */
const showing = (e: Editor, name: string, kind: string) => !!e.field && e.scene.get(e.field.objectId)?.name === name && e.field.spec.kind === kind;

export interface ExampleProject {
  id: string;
  title: string;
  icon: string;
  group: 'Learning' | 'Modelling' | 'Animation' | 'Rigging' | 'Geometry & heat maps' | 'UVs & materials' | 'Scripting';
  desc: string;
  lang: 'js' | 'python';
  code: string;
  setup: ProjectSetup;
  guide: GuideStep[];
}

const rigCode = EXAMPLES.find((x) => x.id === 'rig-character')!.code;
/** The rigged character without the wave. */
const rigOnly = rigCode.slice(0, rigCode.indexOf('\n// 8.'));
const slerpCode = EXAMPLES.find((x) => x.id === 'euler-vs-slerp')!.code;

/** The island, shared by the island project and its fly-through. */
const islandCode = `// A low-poly island. Everything here is placed by arithmetic: change a number, rerun.
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
land.material.color = '#ffffff'
land.material.roughness = 0.95
land.mesh.unwrap({ method: 'planar' })   // UVs straight down from above: the natural map for terrain
land.material.texture = 'grass'
land.material.textureScale = 3

// 2. Sea: one flat plane at height 0 hides everything below it.
const sea = scene.add.plane({ name: 'Sea', size: 14 })   // wider than the land (12): its edges sink half a unit, so from an angle you would see under a sea only as wide
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
log(land.mesh, '·', trees, 'trees · 6 rocks')`;

export const PROJECTS: ExampleProject[] = [
  // ── Learning ────────────────────────────────────────────────────────────
  {
    id: 'predict-catmull-clark',
    title: 'Predict Catmull–Clark',
    icon: '🎯',
    group: 'Learning',
    desc: 'A cube is subdivided while the trace records. The trace player is in Predict mode: before it shows a face point, an edge point or a moved vertex, you work it out.',
    lang: 'js',
    setup: { select: 'Cube to subdivide', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Press Show in viewport, then Play in the Algorithm trace. It stops at each 🎯 question: the inputs are in the question and highlighted in the viewport; the answer is hidden.',
      'Type x, y and z and press Check (Enter works). Wrong numbers turn red; try again or press Show me. The rule appears once it is answered.',
      'Face points first: the average of a face\u2019s corners. Then edge points: the average of the two ends and the two face points beside the edge. Then the old vertices move: (F̄ + 2R̄ + (n − 3)V) / n.',
      'The 🎯 Predict button shows how many you got right first time. Predict works on any trace: turn on Record traces, extrude or inset something, and the questions are there too.',
    ],
    code: `// A cube, subdivided once with Record traces on: every step of Catmull–Clark is recorded.
const cube = scene.add.cube({ name: 'Cube to subdivide', size: 2, position: [0, 1, 0] })
cube.mesh.subdivide(1)
log('6 faces became', cube.mesh.faces.length, 'quads. Open the Algorithm trace and predict each step.')`,
  },
  {
    id: 'two-lists',
    title: 'A mesh is two lists',
    icon: '🔺',
    group: 'Learning',
    desc: 'Two square pyramids typed in as a vertex list and a face list. One shares its corners between faces; the other gives every face its own copies. Pull the tip of each and see which one tears.',
    lang: 'js',
    setup: { select: 'Pyramid', tab: 'script', view: 'all' },
    guide: [
      'The Script tab shows the two lists that built both pyramids. The left one shares its corners: 5 vertices. The right one gives each face its own copies: 16.',
      step('Select the left Pyramid, press Tab for edit mode, click its tip and press G, then move the mouse up and click. All four sides follow the tip: they all name vertex 4.', (e, s) => { const m = e.scene.get('Pyramid')?.mesh; return !!m && m.verts[4][1] > s.obj('Pyramid')!.verts![4][1] + 0.05; }),
      step('Press Tab, select the right pyramid and do the same. Only one side’s corner moves and the pyramid tears open: nothing joins the four copies of the tip.', (e) => { const m = e.scene.get('Pyramid, separate faces')?.mesh; if (!m) return false; const ys = [6, 9, 12, 15].map((i) => m.verts[i][1]); return Math.max(...ys) - Math.min(...ys) > 0.05; }),
      'Open GUI → code: each pull you made is one mesh.setVerts line, which changes positions only. No line touches the face list. Ctrl+Z undoes a pull.',
    ],
    code: `// A square pyramid, typed in as two lists.
// 1. Where each corner is: vertex i is the point [x, y, z].
const vertices = [
  [-1, 0, -1],   // vertex 0
  [ 1, 0, -1],   // vertex 1
  [ 1, 0,  1],   // vertex 2
  [-1, 0,  1],   // vertex 3
  [ 0, 1.5, 0],  // vertex 4: the tip
]
// 2. Which corners make each face, in order around its edge.
const faces = [
  [0, 1, 2, 3],  // face 0: the square base
  [1, 0, 4],     // faces 1-4: the sides, all using the tip, vertex 4
  [2, 1, 4],
  [3, 2, 4],
  [0, 3, 4],
]
scene.add.mesh({ name: 'Pyramid', verts: vertices, faces, position: [-1.6, 0, 0] })

// The same five faces with nothing shared: each face gets its own copies of its corners.
const copies = [], ownFaces = []
for (const f of faces) ownFaces.push(f.map((i) => copies.push([...vertices[i]]) - 1))
scene.add.mesh({ name: 'Pyramid, separate faces', verts: copies, faces: ownFaces, position: [1.6, 0, 0] })

log('Shared corners:', vertices.length, 'vertices,', faces.length, 'faces')
log('Separate faces:', copies.length, 'vertices,', ownFaces.length, 'faces:', JSON.stringify(ownFaces))`,
  },

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
      step('Click a tree. It is an empty with two children, a trunk and leaves: the inspector shows World = Tree · part. Rotate the tree and both follow.', (e, s) => e.scene.objects.some((o) => /^Tree \d+$/.test(o.name) && moved(e, s, o.name))),
      'Script tab: change the seed on the first line, undo (Ctrl+Z), run: a different island.',
      'The grass is a texture on UVs projected straight down (UV › Project from above): for terrain that is all the unwrapping it needs. Open the UV tab to see the grid laid flat.',
    ],
    code: islandCode,
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
      step('Select "Dining set" and rotate it (R): the table and every chair turn together about its origin.', (e, s) => moved(e, s, 'Dining set')),
      'Select the table top and press Tab: its edges were bevelled (two segments, 2.5 cm) so they catch the light, then the top face was inset (an inner ring) and pushed down 2 cm, making a lip.',
      'Every chair is made by one function in the script, called four times with a different place and turn.',
      'The wood grain is a texture: each box was cut along its sharp edges and unwrapped (the grain() function). Select the table top and open the UV tab to see its six pieces.',
    ],
    code: `// A table and four chairs under one empty. Moving "Dining set" moves everything.
const set = scene.add.empty({ name: 'Dining set' })
const wood = '#ffffff', dark = '#8a6040'
// Wood grain needs UVs: cut each box along its sharp edges and unwrap it, then use the wood texture.
const grain = (part) => { part.mesh.seamsFromSharp(20); part.mesh.unwrap(); part.material.texture = 'wood'; part.material.roughness = 0.7 }

// The table top: a cube squashed flat. Its top face is inset and pushed down a little.
const top = scene.add.cube({ name: 'Table top', size: 1, parent: set, position: [0, 0.75, 0] })
for (const v of top.mesh.verts) { v.x *= 2; v.y *= 0.08; v.z *= 1.2 }
top.mesh.bevel(top.mesh.edges.map((e) => [e.a, e.b]), 0.025, 2)   // softened edges, two segments round
const tf = top.mesh.faces.top()
top.mesh.inset(tf, 0.06).extrude(tf, -0.02)
top.material.color = wood
grain(top)

// Four legs: one cube, scaled thin by the object's scale (see S in the inspector's T·R·S).
for (const [x, z] of [[0.9, 0.5], [-0.9, 0.5], [0.9, -0.5], [-0.9, -0.5]]) {
  const leg = scene.add.cube({ name: 'Table leg', size: 1, parent: set, position: [x, 0.36, z], scale: [0.08, 0.72, 0.08] })
  leg.material.color = dark
  grain(leg)
}

// One chair, built at the origin facing +z; the caller places and turns it.
function chair(name, position, turn) {
  const c = scene.add.empty({ name, parent: set, position })
  c.rotation.y = turn
  const seat = scene.add.cube({ name: name + ' seat', size: 1, parent: c, position: [0, 0.45, 0], scale: [0.46, 0.05, 0.44] })
  seat.material.color = wood
  grain(seat)
  const back = scene.add.cube({ name: name + ' back', size: 1, parent: c, position: [0, 0.75, -0.2], scale: [0.46, 0.55, 0.04] })
  back.material.color = wood
  grain(back)
  for (const [x, z] of [[0.2, 0.19], [-0.2, 0.19], [0.2, -0.19], [-0.2, -0.19]]) {
    const leg = scene.add.cube({ name: name + ' leg', size: 1, parent: c, position: [x, 0.22, z], scale: [0.04, 0.44, 0.04] })
    leg.material.color = dark
    grain(leg)
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
      step('In the inspector, turn the mirror and subdivision modifiers off and on to see what each one does.', (e, s) => did(e, s, 'Modifier setting')),
      'The Algorithm trace panel holds the last operation recorded while it was built: step through it.',
      step('Heat map › Mean curvature: the smooth body is red where it is most curved (the thin limbs).', (e) => showing(e, 'Character', 'mean')),
    ],
    code: CHARACTER + `
body.material.color = '#d9a47a'`,
  },

  {
    id: 'crate',
    title: 'Hard-surface crate',
    icon: '📦',
    group: 'Modelling',
    desc: 'A cube with rounded bevelled edges and a recessed panel on every side: bevel, inset and extrude, the everyday hard-surface tools.',
    lang: 'js',
    setup: { select: 'Crate', view: 'selected', trace: true },
    guide: [
      'Tab into edit mode: the edges were bevelled with two segments (Ctrl+B), which is why they catch the light as a rounded band, not a sharp line.',
      'Each side was inset as a region (I) and the inset panel pushed in (E with a negative distance). Select a side\u2019s panel face and press I again: the Adjust panel lets you change the thickness afterwards.',
      step('Select a few edges and press Ctrl+B yourself; then change Width and Segments in the Adjust panel. The Algorithm trace records each bevel.', (e, s) => did(e, s, 'Bevel')),
      step('Select two neighbouring faces of a frame and press Ctrl+X: dissolve merges them into one face without changing the shape.', (e, s) => did(e, s, 'Dissolve')),
    ],
    code: `// A crate: bevel the edges, inset a panel on each side, push the panels in.
const crate = scene.add.cube({ name: 'Crate', size: 1.6, position: [0, 0.8, 0] })
const m = crate.mesh
m.bevel(m.edges.map((e) => [e.a, e.b]), 0.08, 2)            // every edge, 8 cm, two segments

// The six big faces are the sides (each still one quad, shrunk by the bevel).
const sides = m.faces.where((f) => f.area > 1)
for (const f of sides) m.insetRegion([f], 0.14)            // a frame 14 cm wide round each side
m.extrude(sides, -0.05)                                      // and the panel pushed 5 cm in

// Wood: cut along every edge sharper than 20°, unwrap, texture.
m.seamsFromSharp(20)
m.unwrap()
crate.material.texture = 'wood'
crate.material.roughness = 0.75
log(m, '· closed:', m.stats().closed)`,
  },
  {
    id: 'support-loops',
    title: 'Support loops and subdivision',
    icon: '🧊',
    group: 'Modelling',
    desc: 'Three cubes, the same subdivision modifier. Plain, it melts into a blob; bevelled, it keeps some shape; with support loops close to each edge, it stays a box with softened edges.',
    lang: 'js',
    setup: { select: 'Support loops', view: 'all', tab: 'script' },
    guide: [
      'Catmull\u2013Clark moves every vertex toward the average of its neighbours. With nothing near an edge to hold it, the whole cube rounds off (left).',
      'A support loop is an extra ring of edges close to a sharp edge: the average then stays near the edge, so it stays sharp (right). Here each face was inset by 10 cm to make them.',
      'The output panel prints each cube\u2019s volume after subdivision against the plain cube\u2019s 2.744: the closer, the more box-like.',
      step('Tab into "Support loops", select the four inset edges round one face (edge select, Shift-click) and press Ctrl+X: that side\u2019s support is dissolved and it softens again.', (e, s) => did(e, s, 'Dissolve')),
    ],
    code: `// The same subdivision on three cages. Only what is near the edges differs.
function cube(name, x) {
  const c = scene.add.cube({ name, size: 1.4, position: [x, 0.9, 0] })
  c.modifiers.add('subsurf', { levels: 2 })
  c.smooth = true
  c.material.color = '#9aa7b8'
  return c
}
const plain = cube('No support loops', -2.4)
const bevelled = cube('Bevelled edges', 0)
bevelled.mesh.bevel(bevelled.mesh.edges.map((e) => [e.a, e.b]), 0.12)
const looped = cube('Support loops', 2.4)
for (const f of looped.mesh.faces.map((f) => f.index)) looped.mesh.insetRegion([f], 0.1)

const box = 1.4 ** 3
for (const c of [plain, bevelled, looped])
  log(c.name.padEnd(18), 'volume after subdivision', c.evaluatedStats().volume.toFixed(3), 'of', box.toFixed(3), '(' + Math.round((100 * c.evaluatedStats().volume) / box) + '%)')`,
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
      step('Go to a top key and set it to "ease" instead of ease-in: the ball now hangs at the floor. Gravity is quadratic, s = t², not the S-curve.', (e) => (e.scene.get('Ball')?.anim?.position ?? []).some((k) => k.interp === 'ease')),
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
      step('Select Shoulder and look at the Timeline graph: one angle, eased between keys. Watch how it swings everything below it.', (e) => e.activeObject?.name === 'Shoulder'),
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
      step('Press Space to pause, then Ctrl+Tab: pose mode. Click a bone and drag the gizmo rings; I keys the pose at this frame. (Tab instead edits the bones themselves: their joints and roll.)', (e, s) => did(e, s, 'Pose bone')),
      'Select Character and press Ctrl+Tab: weight paint mode. The "Fix a bad rig" project walks through repairing the chest.',
      step('Select Character and use Heat map › Bone weights (or the Skin panel): red is where a bone moves the skin fully.', (e) => showing(e, 'Character', 'weight')),
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

  {
    id: 'fix-a-bad-rig',
    title: 'Fix a bad rig (weight painting)',
    icon: '🖌️',
    group: 'Rigging',
    desc: 'The waving character\u2019s automatic weights let the raised arm drag the chest up. Paint the chest back to the spine and watch it stop.',
    lang: 'js',
    setup: { select: 'Character', frame: 24, weightPaint: 'Spine', view: 'all' },
    guide: [
      'The heat map is the Spine\u2019s weights: the left chest is blue, so the spine barely moves it; the raised arm pulls it up instead. Automatic weights gave it to UpperArm.L, the nearest bone through the air.',
      step('Brush Draw, Value 1: drag over the left chest. It turns red, and the chest drops back into place. Each stroke is one undo step and one paintWeights line in GUI → code.', (e, s) => strokes(e, s) >= 1),
      step('Turn on X-mirror, then paint the right chest too: the other side\u2019s bone is painted at the mirrored spot.', (e, s) => e.paint.mirror && strokes(e, s) >= 2),
      'Pick UpperArm.L in the panel and use Blur along the shoulder to soften the crease; scrub the Timeline to see it bend.',
    ],
    code: rigCode + `
body.material.color = '#d9a47a'`,
  },
  {
    id: 'tentacle',
    title: 'Tentacle: bones by hand, and roll',
    icon: '🐙',
    group: 'Rigging',
    desc: 'A tapered tube on a chain of five bones, curling in a travelling wave. Edit the bones yourself, and see what roll does to the way a bone bends.',
    lang: 'js',
    setup: { select: 'Tentacle rig', bone: 'Seg 1', tab: 'timeline', frame: 1, play: true, view: 'all' },
    guide: [
      'Every bone has the same kind of key: a turn about its own x axis. The wave comes from giving each bone the same swing a little later than the one below.',
      step('Pause (Space) and press Tab on the rig: Edit bones. Click a joint and drag it: the joints that touch move with it. Select the top tail and press E to grow a sixth segment.', (e, s) => (e.scene.get('Tentacle rig')?.bones?.length ?? 0) > s.obj('Tentacle rig')!.bones),
      step('Still in Edit bones, set Roll to 90 on Seg 1 in the inspector, then play: that segment now bends sideways under the same keys. Roll decides which way a bone’s x axis faces, and so its bending plane.', (e) => Math.abs((e.scene.get('Tentacle rig')?.bones?.find((b) => b.name === 'Seg 1')?.roll ?? 0) - Math.PI / 2) < 0.02),
      step('Ctrl+Tab for pose mode: bend a segment yourself and key it with I. Moving bones after binding changes the rest pose; "Bind again" in the tentacle’s Skin panel refreshes the weights.', (e, s) => did(e, s, 'Pose bone')),
    ],
    code: `// A tentacle: a tapered tube and a chain of five bones, curling in a travelling wave.
scene.setTimeline({ start: 1, end: 96, fps: 24 })
const N = 16, K = 40, L = 3, verts = [], faces = []
for (let k = 0; k <= K; k++) {
  const y = (L * k) / K, r = 0.28 * (1 - 0.8 * (k / K))          // thinner toward the tip
  for (let j = 0; j < N; j++) { const a = (j / N) * 2 * Math.PI; verts.push([r * Math.cos(a), y, -r * Math.sin(a)]) }
}
for (let k = 0; k < K; k++) for (let j = 0; j < N; j++) {
  const a = k * N + j, b = k * N + ((j + 1) % N)
  faces.push([a, b, b + N, a + N])
}
faces.push(Array.from({ length: N }, (_, j) => N - 1 - j), Array.from({ length: N }, (_, j) => K * N + j))
const tentacle = scene.add.mesh({ name: 'Tentacle', verts, faces })
tentacle.smooth = true
tentacle.material.color = '#b5579a'

// Five bones up the middle, each the child of the one below.
const bones = []
for (let i = 0; i < 5; i++) bones.push({ name: 'Seg ' + (i + 1), parent: i ? 'Seg ' + i : null, head: [0, (i * L) / 5, 0], tail: [0, ((i + 1) * L) / 5, 0] })
const rig = scene.add.armature({ name: 'Tentacle rig', bones })
tentacle.bindTo(rig)

// A travelling wave: the same swing on every bone, each one a little later (phase 0.9 rad).
for (let i = 0; i < 5; i++) {
  const seg = rig.bone('Seg ' + (i + 1))
  for (let f = 1; f <= 97; f += 8) seg.keyframe(f, { rotation: [0.45 * Math.sin((2 * Math.PI * (f - 1)) / 48 - 0.9 * i), 0, 0] })
}
log("5 bones, 13 keys each; bending about each bone’s own x axis")`,
  },
  {
    id: 'candy-wrapper',
    title: 'Candy wrapper: linear vs dual quaternion',
    icon: '🍬',
    group: 'Rigging',
    desc: 'Two identical forearms twist the wrist 172°. Linear blending pinches the middle to a thin neck; dual-quaternion skinning keeps it round.',
    lang: 'js',
    setup: { select: 'Dual quaternion', tab: 'timeline', frame: 36, view: 'all', play: true },
    guide: [
      'Both tubes have the same bones, the same weights and the same animation. Only the skin\u2019s blend method differs (Skin panel › Blend).',
      'Linear blending averages the points each bone would move a vertex to: half-way between a point and its 172°-turned copy is almost the axis. That is the pinch.',
      'Dual quaternions average the bones\u2019 motions instead (a rotation and a move together), so a vertex half on each bone is turned half-way and keeps its distance from the axis.',
      'Tab into edit mode on either tube, select a vertex at the middle and press "Explain skinning here" to see the two calculations step by step.',
    ],
    code: `// Two forearms that differ only in how the skin blends the bones.
scene.setTimeline({ start: 1, end: 72, fps: 24 })

function forearm(name, x, method, color) {
  // A capped tube along y: 17 rings of 16 vertices, radius 0.25, length 2.
  const N = 16, K = 16, r = 0.25, verts = [], faces = []
  for (let k = 0; k <= K; k++) for (let j = 0; j < N; j++) {
    const a = (j / N) * 2 * Math.PI
    verts.push([r * Math.cos(a), (2 * k) / K, -r * Math.sin(a)])
  }
  for (let k = 0; k < K; k++) for (let j = 0; j < N; j++) {
    const a = k * N + j, b = k * N + ((j + 1) % N)
    faces.push([a, b, b + N, a + N])
  }
  faces.push(Array.from({ length: N }, (_, j) => N - 1 - j))       // bottom cap, facing down
  faces.push(Array.from({ length: N }, (_, j) => K * N + j))       // top cap, facing up
  const arm = scene.add.mesh({ name, verts, faces, position: [x, 0.2, 0] })
  arm.smooth = true
  arm.material.color = color
  const rig = scene.add.armature({ name: name + ' rig', position: [x, 0.2, 0], bones: [
    { name: 'Forearm', head: [0, 0, 0], tail: [0, 1, 0] },
    { name: 'Wrist', parent: 'Forearm', head: [0, 1, 0], tail: [0, 2, 0] },
  ] })
  arm.bindTo(rig)
  arm.skinning = method
  // Twist the wrist about its own length: there and back.
  rig.bone('Wrist').keyframe(1, { rotation: [0, 0, 0] }).keyframe(36, { rotation: [0, 3, 0] }).keyframe(72, { rotation: [0, 0, 0] })
  return arm
}
forearm('Linear blend', -0.8, 'linear', '#5aa9ff')
forearm('Dual quaternion', 0.8, 'dual-quaternion', '#ff9f1c')
log('Same bones, same weights, same keys. Frame 36: the wrist is turned 172°.')`,
  },

  {
    id: 'island-flythrough',
    title: 'Fly-through of the island',
    icon: '🎥',
    group: 'Animation',
    desc: 'A camera circles the island once in ten seconds, rising and falling, always looking at the peak. Look through it, play, and render a still to a PNG.',
    lang: 'js',
    setup: { select: 'Camera', view: 'all' },
    guide: [
      'The white pyramid is the camera: it looks down its own −z axis, and the triangle marks its up. The blue line is its path.',
      step('Press 0 to look through the camera, then Space to play: the view flies round the island. Drag or scroll to leave the camera view.', (e) => e.scene.timeline.frame !== 1),
      'Each key is the camera’s position plus a rotation from lookAt(peak). Its rotation mode is quaternion, so between keys it turns by slerp: the shortest way, with no spin where the angle wraps from 180° to −180°.',
      step('In the Inspector, set Field of view to 25: a longer lens, so the island fills more of the frame and looks flatter.', (e) => (e.scene.get('Camera')?.camera?.fov ?? 40) < 30),
      'Pick a frame you like and press Render still (PNG) in the Inspector (or View › Render still): only the models are drawn, from the camera, at the render size.',
    ],
    code: islandCode + `

// ── The fly-through ─────────────────────────────────────────────────
// Once round in 240 frames (10 s at 24 fps). Frame 241 is frame 1 again, so it loops.
scene.setTimeline({ start: 1, end: 240, fps: 24 })
const cam = scene.add.camera({ name: 'Camera', fov: 40 })
cam.rotationMode = 'quaternion'                      // between keys, turn by slerp
const peak = [0, 1.2, 0]
for (let f = 1; f <= 241; f += 6) {
  const a = 2 * Math.PI * (f - 1) / 240               // the angle round the island
  const r = 8.5 - 1.5 * Math.cos(2 * a)               // nearer on two sides, farther on the others
  cam.position = [r * Math.sin(a), 2.6 + 1.2 * Math.sin(2 * a), r * Math.cos(a)]
  cam.lookAt(peak)                                    // point −z at the peak
  cam.keyframe(f, { position: cam.position, rotation: cam.rotation, interp: 'linear' })
}
scene.frame = 1
log('Camera keyed every 6 frames:', 41, 'keys; the scene camera is', scene.camera.name)`,
  },
  {
    id: 'walk-cycle',
    title: 'Walk cycle',
    icon: '🚶‍♂️',
    group: 'Animation',
    desc: 'The rigged character walks: the four classic key poses (contact, down, passing, up) per step, hips that dip and rise, forward motion, and a loop that joins seamlessly.',
    lang: 'js',
    setup: { select: 'Rig', bone: 'Thigh.L', tab: 'timeline', frame: 1, play: true, view: 'all' },
    guide: [
      'One step takes 12 frames: contact (heel down, legs apart), down (the weight lands, the hips dip), passing (the free leg swings past, knee bent), up (pushing off, the hips rise). Two steps make the 24-frame cycle.',
      'Timeline › bone Thigh.L: the thigh swings forward and back once per cycle. Thigh.R is the same curve half a cycle (12 frames) later.',
      'Select the Rig object and look at its position keys: y dips after each contact and rises at passing; z moves forward at a steady speed (linear keys), so the walk does not surge.',
      'Frame 1 and frame 25 are the same pose, so the cycle loops. Try it yourself: add arm swing, each arm swinging opposite its leg, and key it every 6 frames.',
    ],
    code: rigOnly + `

// 9. A walk: 24-frame cycle, keys every 6 frames: contact, passing, contact, passing.
//    A positive x turn swings a thigh forward (toward +z, where the character walks).
const cycle = 24, cycles = 4
scene.setTimeline({ start: 1, end: 1 + cycle * cycles })
const legs = {
  //           contact   pass     contact   pass       (frames 0, 6, 12, 18 of the cycle)
  'Thigh.L': [0.45,     0.0,     -0.45,    -0.05],
  'Shin.L':  [-0.05,    -0.2,    -0.35,    -0.9],
  'Thigh.R': [-0.45,    -0.05,   0.45,     0.0],
  'Shin.R':  [-0.35,    -0.9,    -0.05,    -0.2],
}
for (let c = 0; c <= cycles; c++) for (let k = 0; k < 4; k++) {
  const f = 1 + c * cycle + k * 6
  if (f > 1 + cycle * cycles) break
  for (const [bone, poses] of Object.entries(legs)) rig.bone(bone).keyframe(f, { rotation: [poses[k], 0, 0], interp: 'ease' })
}
// Arms relaxed at the sides.
rig.bone('UpperArm.L').keyframe(1, { rotation: [0, 0, -1.2] })
rig.bone('UpperArm.R').keyframe(1, { rotation: [0, 0, 1.2] })

// The hips: down 3 frames after each contact, up at passing. Forward at a steady 0.9 per cycle.
const stride = 0.9
for (let c = 0; c < cycles * 2; c++) {
  const f = 1 + c * 12
  rig.keyframe(f, { position: [3, 1.1, (c * stride) / 2] })
  rig.keyframe(f + 3, { position: [3, 1.04, (c * stride) / 2 + stride / 8] })
  rig.keyframe(f + 9, { position: [3, 1.15, (c * stride) / 2 + (3 * stride) / 8] })
}
rig.keyframe(1 + cycle * cycles, { position: [3, 1.1, cycles * stride] })
for (const k of rig.animation.position) rig.setInterpolation(k.frame, 'linear')
body.material.color = '#d9a47a'
log('4 cycles of 24 frames; press Space')`,
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
      step('Select each shape and switch Heat map between H and K. The cylinder: H is not zero, K is. It bends in one direction only.', (e) => showing(e, 'Cylinder', 'mean')),
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
      step('Tab into edit mode, select a different vertex, and Heat map › Distance from selected vertices.', (e, s) => e.field?.spec.kind === 'geodesic' && JSON.stringify(e.field.spec) !== s.field),
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
      step('Select "Smoothed ×5" and Heat map › Mean curvature: nearly one colour, like a sphere.', (e) => showing(e, 'Smoothed ×5', 'mean')),
      step('Tab into edit mode on "Bumpy", select some vertices, Mesh › Smooth vertices, then change the iterations in the Adjust panel.', (e, s) => did(e, s, 'Smooth vertices')),
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

  // ── UVs & materials ─────────────────────────────────────────────────────
  {
    id: 'unwrap-basics',
    title: 'Unwrap a cube and a sphere',
    icon: '🗺️',
    group: 'UVs & materials',
    desc: 'Cut along its edges, a cube unfolds into six perfect squares. Cut from pole to pole, a sphere opens flat, but its checker squares change size: a curved surface cannot lie flat unstretched.',
    lang: 'js',
    setup: { select: 'Sphere', view: 'all', tab: 'uv' },
    guide: [
      'The UV tab shows the sphere\u2019s layout: one piece, from the one seam. Select the Box to see its six squares.',
      'On the cube every checker square is square and the same size: no distortion at all (the output panel prints 1.0000).',
      'On the sphere the squares stay square (LSCM keeps angles) but not the same size: near the poles they are squeezed. The printed area ratio is how much. No cut can fix it everywhere; that is the Gauss–Bonnet idea from the curvature gallery.',
      'Heat map › Mean curvature, then UV › Angle distortion heat map, on the sphere: the distortion is highest where the seam ends, at the poles.',
      step('Try it yourself: Tab into edit mode on a new cube, select edges (2), UV › Mark seam, then U to unwrap.', (e, s) => did(e, s, 'Unwrap')),
    ],
    code: `// 1. A cube, cut along its twelve sharp edges: six squares.
const cube = scene.add.cube({ name: 'Box', size: 1.6, position: [-2, 1, 0] })
cube.mesh.seamsFromSharp(60)
cube.mesh.unwrap()
cube.material.texture = 'checker'

// 2. A sphere, cut along one meridian from pole to pole (the vertices with z = 0 and x ≥ 0).
const sphere = scene.add.uvSphere({ name: 'Sphere', radius: 1, segments: 32, rings: 16, position: [1, 1, 0] })
const m = sphere.mesh
const onMeridian = new Set(m.verts.filter((v) => v.x >= -1e-9 && Math.abs(v.z) < 1e-9).map((v) => v.index))
m.markSeams(m.edges.filter((e) => onMeridian.has(e.a) && onMeridian.has(e.b)).map((e) => [e.a, e.b]))
m.unwrap()
sphere.material.texture = 'checker'
sphere.material.textureScale = 2
sphere.smooth = true

log('cube: worst angle distortion', Math.max(...cube.mesh.uvDistortion()).toFixed(4))
const d = m.uvDistortion()
log('sphere: mean angle distortion', (d.reduce((a, b) => a + b) / d.length).toFixed(3))
// Area: how much texture each face gets, per unit of surface area.
const uvArea = (f) => { let a = 0; for (let i = 1; i + 1 < f.length; i++) a += Math.abs((f[i][0] - f[0][0]) * (f[i + 1][1] - f[0][1]) - (f[i + 1][0] - f[0][0]) * (f[i][1] - f[0][1])) / 2; return a }
const ratios = m.uv.map((f, i) => uvArea(f) / m.faces[i].area)
log('sphere: texture per unit area varies', (Math.max(...ratios) / Math.min(...ratios)).toFixed(1) + '×', 'from pole to equator')`,
  },
  {
    id: 'shader-gallery',
    title: 'Shader gallery',
    icon: '💡',
    group: 'UVs & materials',
    desc: 'Eight spheres, eight ways to light a surface: PBR, Lambert, Blinn–Phong soft and sharp, toon, normals, UV, and a custom shader you can edit.',
    lang: 'js',
    setup: { select: 'Custom', view: 'all', tab: 'shader' },
    guide: [
      step('The Shader tab shows the selected sphere\u2019s GLSL. "Custom" is editable: change a number in the body, press Apply (or Ctrl+Enter), and the sphere changes.', (e, s) => { const g = e.scene.get('Custom')?.material?.glsl; return g !== undefined && g !== s.obj('Custom')!.glsl; }),
      'Compare Lambert and Blinn–Phong: the same matte base, plus a highlight where N·H is near 1. Shininess 10 spreads it, 120 makes it a small hot spot.',
      'Normals colours each point by its direction; UV by its texture coordinate (a seam shows as a jump). Both are how you check a model, not how you light it.',
      step('Move the Light object (it is the sun): every shader but Normals and UV follows it. Break the custom GLSL on purpose: the error shows below the code and the sphere falls back to Lambert.', (e, s) => moved(e, s, 'Light')),
    ],
    code: `// One sphere per shading model. Each needs UVs for the UV view, so open each along a meridian.
function sphereAt(name, x, z) {
  const s = scene.add.uvSphere({ name, radius: 0.85, segments: 48, rings: 24, position: [x, 1, z] })
  const m = s.mesh
  const cut = new Set(m.verts.filter((v) => v.x >= -1e-9 && Math.abs(v.z) < 1e-9).map((v) => v.index))
  m.markSeams(m.edges.filter((e) => cut.has(e.a) && cut.has(e.b)).map((e) => [e.a, e.b]))
  m.unwrap()
  s.smooth = true
  s.material.color = '#d9734a'
  s.material.roughness = 0.35
  return s
}
const models = [
  ['PBR', 'pbr'], ['Lambert', 'lambert'], ['Blinn–Phong 10', 'blinn-phong', 10], ['Blinn–Phong 120', 'blinn-phong', 120],
  ['Toon', 'toon'], ['Normals', 'normals'], ['UV', 'uv'], ['Custom', 'custom'],
]
models.forEach(([name, shader, shininess], i) => {
  const s = sphereAt(name, (i % 4) * 2.1 - 3.15, Math.floor(i / 4) * 2.3 - 1.15)
  s.material.shader = shader
  if (shininess) s.material.shininess = shininess
})
// The custom shader: warm where lit, cool in shadow, with a blue rim at the silhouette.
scene.get('Custom').material.glsl = [
  'float d = max(dot(N, L), 0.0);',
  'float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);',
  'vec3 cool = vec3(0.10, 0.25, 0.80), warm = vec3(1.00, 0.60, 0.25);',
  'return mix(cool, warm, d) * (0.3 + 0.7 * d) + rim * vec3(0.4, 0.8, 1.0);',
].join('\\n')
log(models.length, 'spheres; the sun is the Light object')`,
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
      step('Heat map › Height (y) shows the rings; Heat map › Mean curvature shows the neck and the belly.', (e) => showing(e, 'Vase', 'coord') || showing(e, 'Vase', 'mean')),
      'The stripes are a texture on UVs made at the end of the script: a seam down one side and around the base, then an unwrap. Open the UV tab: the side is a curved band, the base a disc.',
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
print(vase.mesh, '- open at the top:', not vase.mesh.stats().closed)

# A texture needs UVs. Cut a seam down one side (the column at angle 0) and around the base,
# then unwrap: the side unrolls into a band, the base into a disc.
side = [[i * segments, (i + 1) * segments] for i in range(rings)]
base = [[j, (j + 1) % segments] for j in range(segments)]
vase.mesh.markSeams(side + base)
vase.mesh.unwrap()
vase.material.texture = 'stripes'
vase.material.textureScale = 2
d = vase.mesh.uvDistortion()
print('angle distortion: mean', round(sum(d) / len(d), 3), 'worst', round(max(d), 3))`,
  },
];

export const PROJECT_GROUPS = ['Learning', 'Modelling', 'Animation', 'Rigging', 'Geometry & heat maps', 'UVs & materials', 'Scripting'] as const;

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
  if (s.weightPaint) { editor.activeBone = s.weightPaint; editor.enterWeightPaint(); }
  editor.predict = !!s.predict;
  editor.message = `${p.title}: see the guide in the viewport`;
  editor.emit('select');
  return { error: null, output: r.output };
}
