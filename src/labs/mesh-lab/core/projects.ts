// Finished example projects: complete scenes to open, look around and take apart.
//
// Each project is a script that builds the whole scene, so how it was made is
// never hidden: it opens in the script panel, and the GUI → code log holds it as
// one step. `setup` says what to show once it is built (what to select, which
// frame, which panel), and `guide` lists things to look at and try.

import { Euler, Vector3 } from 'three';
import type { Editor } from '../../../engines/mesh/core/Editor';
import { EditMesh, type Vec3 } from '../../../engines/mesh/core/EditMesh';
import { runScript } from '../../../engines/mesh/core/api';
import { traceDecompose } from '../../../engines/mesh/core/transformTrace';
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
  /** How many steps the undo stack held. */
  undo: number;
}

/**
 * A guide step: plain text, or text with a check that ticks it when you have done
 * it. Checks read only the scene, the mode and the GUI → code log, never the UI.
 */
export type GuideStep = string | { text: string; done: (e: Editor, start: StartState) => boolean };
export const stepText = (g: GuideStep): string => (typeof g === 'string' ? g : g.text);
const step = (text: string, done: (e: Editor, start: StartState) => boolean): GuideStep => ({ text, done });

/** Whether face i of a closed, roughly convex mesh points away from its centre: its normal is outward. */
function pointsOut(m: { verts: Vec3[]; faceNormal(i: number): Vec3; faceCenter(i: number): Vec3 }, i: number): boolean {
  const c = m.verts.reduce<Vec3>((a, v) => [a[0] + v[0] / m.verts.length, a[1] + v[1] / m.verts.length, a[2] + v[2] / m.verts.length], [0, 0, 0]);
  const n = m.faceNormal(i), p = m.faceCenter(i);
  return n[0] * (p[0] - c[0]) + n[1] * (p[1] - c[1]) + n[2] * (p[2] - c[2]) > 0;
}

/** Record the scene as it is now, for guide steps to compare against. */
export function startState(e: Editor): StartState {
  const objs = new Map(e.scene.objects.map((o) => [o.name, {
    position: [...o.position] as Vec3, rotation: [...o.rotation] as Vec3, scale: [...o.scale] as Vec3,
    verts: o.mesh ? o.mesh.verts.map((v) => [...v] as Vec3) : null, bones: o.bones?.length ?? 0, glsl: o.material?.glsl,
  }]));
  return { obj: (n) => objs.get(n), field: e.field ? JSON.stringify(e.field.spec) : null, log: e.log.length, undo: e.undoStack.length };
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
/** The object moved along its own x axis since the project opened (and did not turn or stretch). */
const alongLocalX = (e: Editor, s: StartState, name: string) => {
  const o = e.scene.get(name), was = s.obj(name);
  if (!o || !was || o.rotation.some((x, i) => Math.abs(x - was.rotation[i]) > 1e-6)) return false;
  const d = o.position.map((x, i) => x - was.position[i]), len = Math.hypot(...d);
  const ax = new Vector3(1, 0, 0).applyEuler(new Euler(...o.rotation, 'XYZ'));
  return len > 0.05 && Math.abs(Math.abs(d[0] * ax.x + d[1] * ax.y + d[2] * ax.z) - len) < 1e-3 * len;
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
    id: 'winding-and-normals',
    title: 'Winding and normals',
    icon: '🧭',
    group: 'Learning',
    desc: 'A pyramid typed in as two lists, with two sides listed the wrong way round so they face inwards. The script turns one back with Record traces on, so you can predict its new normal; you turn the other yourself.',
    lang: 'js',
    setup: { select: 'Pyramid', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Turn on Normals in the toolbar: a short line rises from each face along its normal. One side still points into the pyramid.',
      'In the Algorithm trace, press Play: it stops at the 🎯 question. Face 2\u2019s corners were listed 1, 2, 4; the flip lists them 4, 2, 1. Predict its new normal, then check it.',
      step('Fix the last one: Tab for edit mode, press 3 for face select, click the side whose normal points in, and use Mesh › Flip normals.', (e) => { const m = e.scene.get('Pyramid')?.mesh; return !!m && m.faces.every((_, i) => pointsOut(m, i)); }),
      'Open GUI → code: your fix is one mesh.flip([3]) line. It changes the order of face 3\u2019s corners and nothing else: no vertex moves.',
    ],
    code: `// A square pyramid as two lists. Faces 2 and 3 are listed the wrong way round.
const vertices = [
  [-1, 0, -1],   // vertex 0
  [ 1, 0, -1],   // vertex 1
  [ 1, 0,  1],   // vertex 2
  [-1, 0,  1],   // vertex 3
  [ 0, 1.5, 0],  // vertex 4: the tip
]
const faces = [
  [0, 1, 2, 3],  // face 0: the base, anticlockwise seen from below, so its normal points down, out
  [1, 0, 4],     // face 1: anticlockwise seen from outside
  [1, 2, 4],     // face 2: clockwise seen from outside: its normal points in
  [3, 4, 2],     // face 3: clockwise too
  [0, 3, 4],     // face 4
]
const p = scene.add.mesh({ name: 'Pyramid', verts: vertices, faces })

// Each face's normal, by Newell's method: the right-hand rule round its corners, in order.
for (const f of p.mesh.faces) log('face', f.index, 'normal', f.normal.map((x) => +x.toFixed(2)).join(', '))

// Turn face 2 round, with Record traces on: the Algorithm trace asks you to predict its new normal.
p.mesh.flip([2])`,
  },
  {
    id: 'edges-and-neighbours',
    title: 'Edges and neighbours',
    icon: '🕸️',
    group: 'Learning',
    desc: 'A box with no lid, typed in as two lists. The script lists its edge table, then builds it again with Record traces on, so you can predict the lookups; you find its open edges with Select non-manifold.',
    lang: 'js',
    setup: { select: 'Open box', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Turn on Wire in the toolbar: it draws one line per entry in the edge table, 12 of them. The status bar counts them too: 12 edges, and 4 open edges.',
      'In the Algorithm trace, press Play. Faces 0 and 1 share no edge, so every key they file is new. Face 2\u2019s second edge is the first key already there: predict how many faces it has then, and how many edges the table holds.',
      step('Find the rim: Edit › Select non-manifold (Shift+Ctrl+Alt+M) selects every edge that is not on exactly two faces. Here that is the four open edges round the top.', (e) => {
        const m = e.scene.get('Open box')?.mesh;
        if (!m || e.mode !== 'edit' || e.selectMode !== 'edge') return false;
        const want = m.boundaryEdges().map((x) => EditMesh.edgeKey(x.a, x.b)).sort();
        return want.length === 4 && e.selectedEdges().map(([a, b]) => EditMesh.edgeKey(a, b)).sort().join() === want.join();
      }),
      'Press 3 for face select and click a side: its neighbours are the faces across its four edges. The bottom has four; each side has three, because one of its edges is on the rim.',
    ],
    code: `// A box with no lid, as two lists: vertex i is at (i % 2, ⌊i / 2⌋ % 2, ⌊i / 4⌋).
const vertices = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]]
const faces = [
  [0, 4, 6, 2],  // face 0: the side at x = 0
  [1, 3, 7, 5],  // face 1: the side at x = 1
  [0, 1, 5, 4],  // face 2: the bottom, y = 0
  [0, 2, 3, 1],  // face 3: the side at z = 0
  [4, 5, 7, 6],  // face 4: the side at z = 1 (no face at y = 1: the lid is missing)
]
const box = scene.add.mesh({ name: 'Open box', verts: vertices, faces, position: [-0.5, 0, -0.5] })

// The edge table: one entry per edge, filed under its two vertex numbers smallest first, with the faces on it.
for (const e of box.mesh.edges) log(\`edge \${e.a}-\${e.b}: faces \${e.faces.join(', ')}\`)

// Build it again with Record traces on: the Algorithm trace shows every lookup and asks you to predict.
const t = box.mesh.edgeTable()
log(t.edges, 'edges,', t.open.length, 'open:', t.open.map(([a, b]) => \`\${a}-\${b}\`).join(', '))`,
  },
  {
    id: 'connected-pieces',
    title: 'Connected pieces',
    icon: '🧩',
    group: 'Learning',
    desc: 'Three blocks in one mesh: two touch at a single corner, one stands apart. The script finds the pieces by breadth-first search with Record traces on, so you can predict the queue; Select linked shows the difference between sharing an edge and sharing a corner.',
    lang: 'js',
    setup: { select: 'Blocks', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'In the Algorithm trace, press Play. The first question asks how big the first piece will get: look at which faces share an edge, not at which blocks touch.',
      step('Tab for edit mode, press 3 for face select, click a face of the bottom-left block and press Ctrl+L (Edit › Select linked): its 6 faces are selected, and not the block resting on its corner.', (e) => {
        const m = e.scene.get('Blocks')?.mesh;
        if (!m || e.mode !== 'edit' || e.selectMode !== 'face') return false;
        const sel = e.selectedFaces().sort((a, b) => a - b).join();
        return sel === '0,1,2,3,4,5';
      }),
      step('Now press 1 for vertex select, click a corner of the same block and press Ctrl+L: in vertex select it follows faces through any shared vertex, so the corner joins the two blocks: 15 vertices.', (e) => e.mode === 'edit' && e.selectMode === 'vert' && e.selectedVerts().length === 15),
      'The block on the right is never selected: no face of it shares an edge or a vertex with the others. It is a separate piece of the same mesh object.',
    ],
    code: `// Three unit cubes in one mesh. The second rests on the first's top corner; the third stands apart.
const verts = [], faces = []
const SIDES = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]]
// Add a cube with its corner 0 at p; share maps a corner of this cube to a vertex already in the list.
function block(p, share = {}) {
  const ids = []
  for (let i = 0; i < 8; i++) {
    if (i in share) { ids.push(share[i]); continue }
    ids.push(verts.length)
    verts.push([p[0] + i % 2, p[1] + Math.floor(i / 2) % 2, p[2] + Math.floor(i / 4)])
  }
  for (const s of SIDES) faces.push(s.map((k) => ids[k]))
}
block([0, 0, 0])               // faces 0 to 5
block([1, 1, 1], { 0: 7 })     // faces 6 to 11: its corner 0 is vertex 7, the first block's top corner
block([3, 0, 0])               // faces 12 to 17
const m = scene.add.mesh({ name: 'Blocks', verts, faces, position: [-2, 0, -0.5] })
log(verts.length, 'vertices,', faces.length, 'faces')

// The pieces, by breadth-first search across shared edges. With Record traces on, the trace shows the queue.
m.mesh.pieces().forEach((p, i) => log(\`piece \${i + 1}: faces \${p.join(', ')}\`))`,
  },
  {
    id: 'eulers-formula',
    title: "Euler's formula",
    icon: '🍩',
    group: 'Learning',
    desc: 'A closed cube, a sphere, a torus and an open box, each counted with V − E + F. The script counts the torus again with Record traces on, so you can predict χ and the number of holes through it; then you make a hole yourself.',
    lang: 'js',
    setup: { select: 'Torus', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Select each object and read the Inspector\u2019s MESH section: Vertices, Edges, Faces and Euler V − E + F. The closed cube and the sphere both give 2, though the sphere has 16 times as many faces.',
      'In the Algorithm trace, press Play: it counts the torus\u2019s vertices, edges and faces, then asks for χ, and then for how many holes go through it.',
      step('Make a hole: select the Closed cube, Tab for edit mode, press 3 for face select, click a face and press X. The Euler number drops from 2 to 1: one face fewer, and its rim is one boundary loop.', (e) => { const m = e.scene.get('Closed cube')?.mesh; return !!m && m.faces.length === 5 && m.stats().euler === 1; }),
      'The Open box gives 1 too. A hole you can see into (a boundary loop, b) and a hole that goes through, like the torus\u2019s (genus g), both lower χ: χ = 2 − 2g − b.',
    ],
    code: `// Four surfaces, counted with Euler's formula.
const cube = scene.add.cube({ name: 'Closed cube', size: 1.2, position: [-3.5, 0.6, 0] })
const sphere = scene.add.uvSphere({ name: 'Sphere', radius: 0.7, segments: 16, rings: 8, position: [-1.2, 0.7, 0] })
const torus = scene.add.torus({ name: 'Torus', radius: 0.7, tube: 0.3, segments: 12, tubeSegments: 8, position: [1.2, 0.7, 0] })
const box = scene.add.cube({ name: 'Open box', size: 1.2, position: [3.5, 0.6, 0] })
box.mesh.delete({ faces: box.mesh.faces.top() })   // no lid

for (const o of [cube, sphere, torus, box]) {
  const s = o.mesh.stats()
  log(\`\${o.name}: V − E + F = \${s.verts} − \${s.edges} + \${s.faces} = \${s.euler}\`)
}

// Count the torus with Record traces on: the trace asks for χ, then for the number of holes through it.
const t = torus.mesh.topology()
log('Torus:', t.boundaryLoops, 'boundary loops, genus', t.genus)`,
  },
  {
    id: 'welding-and-filling',
    title: 'Welding and filling',
    icon: '🧵',
    group: 'Learning',
    desc: 'Two boxes with no lid, as a scanner or an STL file gives them: every face has its own copies of its corners, a fraction of a millimetre apart. The script merges one by distance with Record traces on; you merge and close the other.',
    lang: 'js',
    setup: { select: 'Scanned box', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Read the output: as scanned, 20 vertices and 20 open edges in 5 pieces. weld(0), which only merges exact copies, changes nothing; weld(0.001) leaves 8 vertices, 4 open edges and one piece.',
      'In the Algorithm trace, press Play. Each copy looks in its own cell and the 26 around it. The question comes at the first copy whose match is across a cell wall.',
      step('Merge Your box: select it, Tab for edit mode, then Mesh › Merge by distance. The Inspector\u2019s MESH section drops from 20 vertices to 8.', (e) => { const m = e.scene.get('Your box')?.mesh; return !!m && m.verts.length === 8 && m.faces.length === 5; }),
      step('Close it: press 1 for vertex select, select the four corners round the top and press F (Mesh › Fill). The new face is wound from its neighbours, so it points out.', (e) => { const m = e.scene.get('Your box')?.mesh; return !!m && m.faces.length === 6 && m.stats().closed && m.volume() > 0; }),
    ],
    code: `// A box with no lid, as a scanner or an STL file gives it: every face has its own copies of its corners,
// and the copies are a fraction of a millimetre apart.
const SIDES = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [0, 2, 3, 1], [4, 5, 7, 6]]   // the lid is missing
const corner = (i) => [1.2 * (i % 2) - 0.6, 1.2 * (Math.floor(i / 2) % 2) - 0.6, 1.2 * Math.floor(i / 4) - 0.6]
function scanned(name, x) {
  const verts = [], faces = []
  for (const s of SIDES) faces.push(s.map((i) => {
    const c = verts.length, p = corner(i)
    verts.push([p[0] + 0.0002 * (c % 3 - 1), p[1] + 0.0001 * (c % 5 - 2), p[2] + 0.00005 * (c % 7 - 3)])
    return c
  }))
  return scene.add.mesh({ name, verts, faces, position: [x, 0.6, 0] })
}
const box = scanned('Scanned box', -1)
scanned('Your box', 1)

const s0 = box.mesh.stats()
log('as scanned:', s0.verts, 'vertices,', s0.boundaryEdges, 'open edges,', s0.components, 'pieces')
box.mesh.weld(0)       // exact copies only: none here
log('weld(0):', box.mesh.stats().verts, 'vertices')
box.mesh.weld(0.001)   // within 0.001, by spatial hash; with Record traces on, the trace shows every copy
const s1 = box.mesh.stats()
log('weld(0.001):', s1.verts, 'vertices,', s1.boundaryEdges, 'open edges,', s1.components, 'piece')`,
  },
  {
    id: 'obj-files',
    title: 'OBJ files',
    icon: '📄',
    group: 'Learning',
    desc: 'The square pyramid as an OBJ file: plain text, vertices counted from 1. The script reads it with Record traces on, so you can predict how a face line is converted, then writes it back out the way File › Export OBJ does.',
    lang: 'js',
    setup: { select: 'Pyramid', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Read the output: the file\u2019s line f 1 2 3 4 became face [0, 1, 2, 3]. Every vertex number is one less, because OBJ counts from 1 and lists count from 0.',
      'In the Algorithm trace, press Play: one step per line of the file. At the first face line it asks you to convert its corners.',
      step('Change the model and see the file change: Tab for edit mode, press 3 for face select, click the base and use Mesh › Flip normals. Then run log(scene.toOBJ()) in the Script tab: the base\u2019s line now lists its corners the other way round.', (e) => { const m = e.scene.get('Pyramid')?.mesh; return !!m && [0, 1, 2, 3].some((k) => [3, 2, 1, 0].every((v, i) => m.faces[0][(i + k) % 4] === v)); }),
      'File › Export OBJ saves this text as a file; Blender imports it as Wavefront (.obj) from its File menu, quads intact. File › Export GLB writes glTF, which stores triangles.',
    ],
    code: `// An OBJ file is plain text: a v line per vertex (x y z), an f line per face (its corners, counted from 1).
const text = [
  '# the square pyramid from lesson 1.2',
  'o Pyramid',
  'v -1 0 -1', 'v 1 0 -1', 'v 1 0 1', 'v -1 0 1', 'v 0 1.5 0',
  'f 1 2 3 4', 'f 2 1 5', 'f 3 2 5', 'f 4 3 5', 'f 1 4 5',
].join('\\n')

// Read it with Record traces on: the trace shows every line, and asks you to convert a face.
const [p] = scene.fromOBJ(text)
log('read:', p.mesh.verts.length, 'vertices,', p.mesh.faces.length, 'faces:', JSON.stringify(p.mesh.faces.map((f) => f.verts)))

// And back out, numbered from 1 again, as File › Export OBJ writes it.
log(scene.toOBJ())`,
  },
  {
    id: 'vectors-dot-cross',
    title: 'Vectors, dot and cross',
    icon: '📐',
    group: 'Learning',
    desc: 'The square pyramid, measured. The script takes the angle at a base corner with Record traces on: the two edge vectors, their lengths, the dot product, the angle and the cross product, with questions to predict. Then you measure corners yourself.',
    lang: 'js',
    setup: { select: 'Pyramid', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Select the Pyramid and look at Position in the Inspector: three numbers, a vector from the world\u2019s origin to the object\u2019s. Every vertex is a vector too, measured from the object\u2019s origin.',
      'In the Algorithm trace, press Play. It builds the two edge vectors at vertex 0, then asks you for their dot product and for the angle between them.',
      step('Measure the tip: Tab for edit mode, press 2 for edge select, click two edges that meet at the tip and use Mesh › Measure angle. The status line gives the angle and the dot product.', (e) => e.lastMeasure?.object === 'Pyramid' && e.lastMeasure.corner === 4),
      'Now measure two base edges that meet at a corner: the dot product is 0, so the angle is exactly 90°.',
    ],
    code: `// The square pyramid from lesson 1.2.
const pyramid = scene.add.mesh({
  name: 'Pyramid',
  verts: [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], [0, 1.5, 0]],
  faces: [[0, 1, 2, 3], [1, 0, 4], [2, 1, 4], [3, 2, 4], [0, 3, 4]],
})

// The angle at vertex 0 between its edges to vertex 1 and to the tip (4). With Record traces on, the trace
// shows each step and asks you to predict the dot product and the angle.
const m = pyramid.mesh.measure(1, 0, 4)
log('u =', m.u.join(', '), '   v =', m.v.join(', '))
log('|u| =', m.lu, '  |v| =', +m.lv.toFixed(4), '  u · v =', m.dot, '  angle', +m.degrees.toFixed(2) + '°')
log('u × v =', m.cross.join(', '), '  triangle area', +m.area.toFixed(4))`,
  },
  {
    id: 'translate-rotate-scale',
    title: 'Translate, rotate, scale',
    icon: '🧮',
    group: 'Learning',
    desc: 'The pyramid stretched to twice its height, turned 30° and moved. The script traces how its matrix M = T·R·S carries each vertex: scale, then rotate, then move, with questions to predict. Then you change the rotation and trace it again.',
    lang: 'js',
    setup: { select: 'Pyramid', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Select the Pyramid. The Inspector shows Position, Rotation and Scale, its matrix, and, under "How it is built: T, R and S", the three matrices that multiply to make it.',
      'In the Algorithm trace, press Play. It builds S, R and T, asks for the fourth column of M = T·R·S, then follows each vertex through scale, rotate and move, and asks where vertex 0 ends up.',
      step('Set Rotation Y to 90 in the Inspector, then use Object › Trace the transform (T·R·S) and step through it again: the first column of R is now where the x axis points after a quarter turn.', (e) => { const o = e.scene.get('Pyramid'); return !!o && Math.abs(o.rotation[1] - Math.PI / 2) < 1e-6 && e.trace?.op === 'Trace the transform'; }),
      'Press R (rotate) or S (scale) and drag: the matrix in the Inspector changes as you go. Its fourth column is always the Position.',
    ],
    code: `// The square pyramid from lesson 1.2, twice as tall, turned 30° about y, and moved.
const pyramid = scene.add.mesh({
  name: 'Pyramid',
  verts: [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], [0, 1.5, 0]],
  faces: [[0, 1, 2, 3], [1, 0, 4], [2, 1, 4], [3, 2, 4], [0, 3, 4]],
  scale: [1, 2, 1], rotation: [0, Math.PI / 6, 0], position: [2, 0, -1],
})

// How the matrix moves each vertex. With Record traces on, the trace shows every step and asks you to predict.
const t = pyramid.traceTransform()
t.moved.forEach((p, i) => log('v' + i + ' is drawn at', p.map((x) => +x.toFixed(4)).join(', ')))`,
  },
  {
    id: 'order-matters',
    title: 'Order matters',
    icon: '🔀',
    group: 'Learning',
    desc: 'Two boxes, each stretched to (2, 0.5, 0.5) and turned 45°: one stretched then turned, one turned then stretched by its parent. The script takes both matrices apart with Record traces on, and the second has a shear no position, rotation and scale can describe.',
    lang: 'js',
    setup: { select: 'Turn then stretch', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Look from above (View › Top). The first box is a long box turned 45°. The second is a slanted diamond: its corners are no longer square, though it was given the same stretch and the same turn.',
      'In the Algorithm trace, press Play. It takes the second box\u2019s world matrix apart: position, then the column lengths (predict the first), then the angle between columns 1 and 3 (predict it). A rotation\u2019s columns meet at 90°; these do not.',
      step('Fix it: select Stretcher and set its Scale to 1, 1, 1; select "Turn then stretch" and set its own Scale to 2, 0.5, 0.5. Then use Object › Decompose the matrix: the shear is gone.', (e) => { const b = e.scene.get('Turn then stretch'); return !!b && Math.abs(b.scale[0] - 2) < 1e-9 && e.trace?.op === 'Decompose the matrix' && traceDecompose(e.scene.worldMatrix(b).elements).shearDeg < 1e-6; }),
      'Open "How it is built: T, R and S" in the Inspector for each box: an object\u2019s own matrix is always T·R·S. The slant came from a parent\u2019s stretch applied after the child\u2019s turn.',
    ],
    code: `// Two boxes, each stretched to (2, 0.5, 0.5) and turned 45° about y.
const f = (x) => +x.toFixed(3)

// The first is stretched, then turned: its own scale and rotation, so its matrix is T·R·S.
const a = scene.add.cube({ name: 'Stretch then turn', size: 1, scale: [2, 0.5, 0.5], rotation: [0, Math.PI / 4, 0], position: [-2.5, 0.5, 0] })

// The second is turned, then stretched: it is turned, and its parent (an empty) is stretched, so its world
// matrix is the parent's scale times its own rotation.
const stretcher = scene.add.empty({ name: 'Stretcher', scale: [2, 0.5, 0.5], position: [2, 0.5, 0] })
const b = scene.add.cube({ name: 'Turn then stretch', size: 1, rotation: [0, Math.PI / 4, 0], parent: stretcher })

const da = a.decompose()
log('Stretch then turn: scale', da.scale.map(f).join(', '), '  shear', f(da.shearDeg) + '°')
const db = b.decompose()   // with Record traces on, the trace takes this matrix apart
log('Turn then stretch: scale', db.scale.map(f).join(', '), '  shear', f(db.shearDeg) + '°')`,
  },
  {
    id: 'the-determinant',
    title: 'The determinant',
    icon: '🪞',
    group: 'Learning',
    desc: 'A stretched box, a mirrored box, and a pyramid whose mirror image was baked into its vertices. The script works out the mirrored box\u2019s determinant with Record traces on; you turn the baked pyramid right side out.',
    lang: 'js',
    setup: { select: 'Mirrored', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Select each object and look under World matrix in the Inspector: it gives the determinant. Stretched is scaled (2, 1, 0.5): twice as long, half as deep, so its volume is unchanged and det = 1. Mirrored is scaled (−1.5, 1, 1): det = −1.5.',
      'In the Algorithm trace, press Play. It expands the determinant along the first row (predict it), checks it against the triple product of the columns, then asks what volume the box fills in the world.',
      step('Baked mirror has its mirror in its vertices, so every face now winds the wrong way and its Inspector volume reads negative (inside out). Tab for edit mode, press A to select everything, then Mesh › Flip normals: the volume turns positive.', (e) => { const m = e.scene.get('Baked mirror')?.mesh; return !!m && m.faces.length === 5 && m.stats().closed && m.volume() > 0; }),
      'Mirrored needs no fixing: its determinant is negative, and the renderer turns its faces round as it draws them. Baking a mirror into the vertices loses that, so the faces have to be flipped.',
    ],
    code: `const f = (x) => +x.toFixed(4)

// Stretched two ways: longer along x, shallower along z. Volume unchanged.
const box = scene.add.cube({ name: 'Stretched', size: 1, scale: [2, 1, 0.5], position: [-3, 0.5, 0] })
// Mirrored left to right, and 1.5 times as wide.
const mirrored = scene.add.cube({ name: 'Mirrored', size: 1, scale: [-1.5, 1, 1], position: [0, 0.5, 0] })
// The pyramid with its mirror image baked into the vertices (x made negative), the face lists unchanged.
const baked = scene.add.mesh({
  name: 'Baked mirror',
  verts: [[1, 0, -1], [-1, 0, -1], [-1, 0, 1], [1, 0, 1], [0, 1.5, 0]],
  faces: [[0, 1, 2, 3], [1, 0, 4], [2, 1, 4], [3, 2, 4], [0, 3, 4]],
  position: [3, 0, 0],
})

log('Stretched: det', f(box.determinant().det))
log('Baked mirror: its mesh holds volume', f(baked.mesh.stats().volume), '(inside out)')
// With Record traces on, the trace works this one out step by step.
const d = mirrored.determinant()
log('Mirrored: det', f(d.det), '  its unit-cube mesh fills', f(d.worldVolume), 'in the world')`,
  },
  {
    id: 'hierarchies',
    title: 'Hierarchies',
    icon: '🌳',
    group: 'Learning',
    desc: 'A two-joint arm: shoulder, elbow, hand. Each part sits in its parent\u2019s frame. The script traces how the hand\u2019s world matrix is built down the chain, with questions to predict; then you turn the elbow and unparent the hand.',
    lang: 'js',
    setup: { select: 'Hand', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Select Hand. Its Position in the Inspector, (0, 1.5, 0), is measured in the Elbow\u2019s frame, not the world\u2019s. Its world matrix is Shoulder · Elbow · Hand, multiplied from the root down.',
      'In the Algorithm trace, press Play. It walks up from the Hand to the root, then multiplies back down, and asks where the Elbow\u2019s origin lands, then the Hand\u2019s.',
      step('Turn the Elbow: select it and set Rotation Z to 90; the Forearm and the Hand swing with it. Then select Hand and use Object › Trace the world matrix (parents) to step through the new chain.', (e) => { const el = e.scene.get('Elbow'); return !!el && Math.abs(el.rotation[2] - Math.PI / 2) < 1e-6 && e.trace?.op === 'Trace the world matrix' && e.activeObject?.name === 'Hand'; }),
      step('Unparent the Hand with Object › Clear parent: it stays exactly where it is, because MeshLab turns its world transform into its new local one. Turn the Elbow again: the Hand no longer follows.', (e) => { const h = e.scene.get('Hand'); return !!h && h.parent === null; }),
    ],
    code: `const f = (x) => +x.toFixed(3)

// A two-joint arm. The joints are empties; each bar is a child of its joint, so it turns with it.
const shoulder = scene.add.empty({ name: 'Shoulder', position: [0, 1, 0], rotation: [0, 0, Math.PI / 6] })
scene.add.cube({ name: 'Upper arm', size: 1, parent: shoulder, position: [0, 1, 0], scale: [0.2, 2, 0.2] })
const elbow = scene.add.empty({ name: 'Elbow', parent: shoulder, position: [0, 2, 0], rotation: [0, 0, Math.PI / 4] })
scene.add.cube({ name: 'Forearm', size: 1, parent: elbow, position: [0, 0.75, 0], scale: [0.15, 1.5, 0.15] })
const hand = scene.add.cube({ name: 'Hand', size: 0.3, parent: elbow, position: [0, 1.5, 0] })

// How the hand's world matrix is built. With Record traces on, the trace walks the chain and asks you to predict.
const w = hand.traceWorld()
w.chain.forEach((name, i) => log(name + "'s origin in the world:", w.origins[i].map(f).join(', ')))`,
  },
  {
    id: 'local-and-global-axes',
    title: 'Local and global axes',
    icon: '🧭',
    group: 'Learning',
    desc: 'A crate turned 30° and stretched along its own z. The script reads its own axes off the columns of its matrix, with questions to predict, and finds a world point in the crate’s coordinates; then you drag it along its own axis and along the world’s.',
    lang: 'js',
    setup: { select: 'Crate', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Select Crate. Its matrix’s first three columns are where its own x, y and z axes point in the world; the small red, green and blue lines on it are those axes. The z column is 1.5 long: the scale along z.',
      'In the Algorithm trace, press Play. It asks which way the local x arrow points (the x column divided by its length), then where the world point (3, 0, 2) is in the crate’s own coordinates.',
      step('With the toolbar on Local axes, press Move and drag the gizmo’s red arrow: the crate slides along its own x, (0.866, 0, −0.5), not the world’s.', (e, s) => alongLocalX(e, s, 'Crate')),
      step('Click Local axes to switch to World axes and drag the red arrow again: now it slides along (1, 0, 0). Then turn the crate (Rotation Y) and use Object › Trace the local axes to read its new axes.', (e, s) => { const o = e.scene.get('Crate'), was = s.obj('Crate'); return !!o && !!was && Math.abs(o.rotation[1] - was.rotation[1]) > 1e-6 && e.trace?.op === 'Trace the local axes'; }),
    ],
    code: `const f = (v) => v.map((x) => +x.toFixed(3)).join(', ')

// A crate at (1, 0, 2), turned 30° about y and stretched 1.5 times along its own z.
const crate = scene.add.cube({ name: 'Crate', size: 1, position: [1, 0.5, 2], rotation: [0, Math.PI / 6, 0], scale: [1, 1, 1.5] })
crate.material.color = '#c08850'

// Its own axes, read off its matrix. With Record traces on, the trace asks you to predict them.
const a = crate.traceAxes([3, 0.5, 2])
log('local x', f(a.axes[0]), '  local y', f(a.axes[1]), '  local z', f(a.axes[2]))
log('scales', f(a.lengths))
log('world point (3, 0.5, 2) in the crate\\'s coordinates:', f(a.local))`,
  },
  {
    id: 'gimbal-lock',
    title: 'Euler angles and gimbal lock',
    icon: '🛩️',
    group: 'Learning',
    desc: 'A gimbal of three rings, X outside, then Y, then Z, carrying a jet, and a second jet turned by the same three Euler angles. At Y = 90° the X and Z rings line up: the trace shows two angles collapse into one.',
    lang: 'js',
    setup: { select: 'Jet (Euler)', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'On the left, each ring turns everything inside it: X gimbal, then Y, then Z, so the jet in the middle is turned by Rx·Ry·Rz. On the right, "Jet (Euler)" has Rotation (20, 90, 10): the same three angles in one object, and it points the same way.',
      'In the Algorithm trace, press Play. It builds Rx·Ry·Rz, asks for the top-right entry (sin y), then decodes the matrix back to angles: not (20, 90, 10) but (30, 90, 0).',
      step('Select "Jet (Euler)" and set Rotation X to 30 and Z to 0: the jet does not move at all. At Y = 90 only X + Z counts. On the left, the red X ring and the blue Z ring lie in one plane.', (e) => { const o = e.scene.get('Jet (Euler)'); return !!o && Math.abs(o.rotation[0] - Math.PI / 6) < 1e-6 && Math.abs(o.rotation[1] - Math.PI / 2) < 1e-6 && Math.abs(o.rotation[2]) < 1e-6; }),
      step('Set its Rotation Y to 45, then use Object › Trace the Euler angles: no lock now, and X and Z turn it in different ways again.', (e) => { const o = e.scene.get('Jet (Euler)'); return !!o && Math.abs(o.rotation[1] - Math.PI / 4) < 1e-6 && e.trace?.op === 'Trace the Euler angles' && e.activeObject?.name === 'Jet (Euler)'; }),
    ],
    code: `const d = Math.PI / 180
const angles = [20, 90, 10]                                 // x, y, z in degrees (XYZ order)

// A jet: a body, wings and a tail fin, pointing along its own +z.
function jet(name, opts) {
  const j = scene.add.empty({ name, ...opts })
  scene.add.cube({ name: name + ' body', size: 1, parent: j, scale: [0.25, 0.15, 1.1] }).material.color = '#d0d4dc'
  scene.add.cube({ name: name + ' wings', size: 1, parent: j, position: [0, 0, 0.1], scale: [1.2, 0.04, 0.3] }).material.color = '#d0d4dc'
  scene.add.cube({ name: name + ' fin', size: 1, parent: j, position: [0, 0.15, -0.45], scale: [0.04, 0.3, 0.2] }).material.color = '#e5484d'
  return j
}

// A gimbal: each ring is a child of the one outside it, so its turn is applied inside the others: Rx·Ry·Rz.
const gx = scene.add.empty({ name: 'X gimbal', position: [-2.5, 1.6, 0], rotation: [angles[0] * d, 0, 0] })
scene.add.torus({ name: 'X ring', parent: gx, radius: 1.5, tube: 0.04, rotation: [0, 0, 90 * d] }).material.color = '#e5484d'
const gy = scene.add.empty({ name: 'Y gimbal', parent: gx, rotation: [0, angles[1] * d, 0] })
scene.add.torus({ name: 'Y ring', parent: gy, radius: 1.3, tube: 0.04 }).material.color = '#30a46c'
const gz = scene.add.empty({ name: 'Z gimbal', parent: gy, rotation: [0, 0, angles[2] * d] })
scene.add.torus({ name: 'Z ring', parent: gz, radius: 1.1, tube: 0.04, rotation: [90 * d, 0, 0] }).material.color = '#3e63dd'
jet('Jet in the gimbal', { parent: gz })

// The same three angles on one object. With Record traces on, the trace builds the matrix and decodes it.
const solo = jet('Jet (Euler)', { position: [2.5, 1.6, 0], rotation: angles.map((a) => a * d) })
const t = solo.traceEuler()
log('decoded:', t.decoded.join(', '), t.locked ? '(gimbal lock)' : '')`,
  },
  {
    id: 'numbers-you-can-type',
    title: 'Numbers you can type',
    icon: '🔢',
    group: 'Learning',
    desc: 'Every number field in MeshLab reads arithmetic: 90/4, pi/2, 2*1.5. The script parses some with the same parser, and traces "2 + 3 * 4" rule by rule, with questions to predict; then you type expressions into the Inspector.',
    lang: 'js',
    setup: { select: 'Box', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'In the Algorithm trace, press Play. The parser reads 2, 3 and 4, then does 3 * 4 before the + : a product sits inside a sum, so it is finished first. Predict the first result and the whole value.',
      step('Select Box and type 90/4 into Rotation Y, then press Enter: the field shows 22.5. The Inspector ran the same parser on your text.', (e) => { const o = e.scene.get('Box'); return !!o && Math.abs(o.rotation[1] - Math.PI / 8) < 1e-9; }),
      'Type 1 2 (with a space) into Position X: the field turns red and keeps its old value. A space separates two numbers, and the grammar has no rule for a number followed by a number. Press Escape.',
      'Script tab: change "2 + 3 * 4" on the last line to "-2^2" or "2^3^2", and run it (Record traces stays on) to trace a different expression.',
    ],
    code: `const f = (x) => +x.toFixed(4)

// The Inspector's fields and parse() share one parser.
const box = scene.add.cube({ name: 'Box', size: parse('2 * 0.75') })
log('2 * 0.75 =', parse('2 * 0.75'), '  pi/4 =', f(parse('pi/4')), '  -2^2 =', parse('-2^2'), '  2^3^2 =', parse('2^3^2'))

// Text the grammar cannot read: parse() says where it stopped.
for (const bad of ['1 2', '(1 + 2', '2 +']) {
  try { parse(bad) } catch (e) { log(JSON.stringify(bad), '→', e.message) }
}

// With Record traces on, the last parse is traced rule by rule.
log('2 + 3 * 4 =', parse('2 + 3 * 4'))`,
  },
  {
    id: 'cameras',
    title: 'Cameras',
    icon: '🎥',
    group: 'Learning',
    desc: 'A camera aimed at a box with lookAt. The script traces its view matrix, the inverse of its world matrix, and finds the box in camera space, with questions to predict; then you look through it, move it, and frame things.',
    lang: 'js',
    setup: { select: 'Camera', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Camera is the pyramid: it stands at (4, 3, 5) and was turned with lookAt so its −z axis points at the box. Its view matrix is the inverse of its world matrix: it moves the whole world so the eye sits at the origin, looking down −z.',
      'In the Algorithm trace, press Play. Predict which way the camera looks (minus its z column), then where the box’s centre lands in camera space: straight ahead means x = y = 0.',
      step('Move the camera and trace it: press 0 to look through it and 0 again to come back, then select Camera, move it (type a new Position), and use Object › Trace the view matrix (camera): the box’s camera-space position changes.', (e, s) => moved(e, s, 'Camera') && e.trace?.op === 'Trace the view matrix' && e.activeObject?.name === 'Camera'),
      'Left-drag orbits the viewport’s own camera round its target, right-drag pans it, the wheel zooms. View › Frame selected (.) puts the selection’s bounding sphere just inside the view, at distance radius / sin(fov / 2) × 1.1.',
    ],
    code: `const f = (v) => v.map((x) => +x.toFixed(3)).join(', ')

const box = scene.add.cube({ name: 'Box', size: 1, position: [0, 0.5, 0] })
box.material.color = '#4f8fd9'
// A camera at (4, 3, 5), turned so its −z axis points at the box's centre.
const cam = scene.add.camera({ name: 'Camera', position: [4, 3, 5], lookAt: [0, 0.5, 0] })

// A point behind the camera has z > 0 in camera space.
log('(0, 0, 10) in camera space:', f(cam.traceView([0, 0, 10]).camera), '(z > 0: behind)')
// With Record traces on, the last call is traced step by step.
const v = cam.traceView([0, 0.5, 0])
log('looking along', f(v.forward))
log("the box's centre in camera space:", f(v.camera))`,
  },
  {
    id: 'projection',
    title: 'Projection',
    icon: '🖼️',
    group: 'Learning',
    desc: 'Two equal boxes, one near the camera and one far: the far one is drawn smaller. The script traces how a point becomes a pixel, camera space to clip space to the divide by w, with questions to predict; then you change the field of view and switch to orthographic.',
    lang: 'js',
    setup: { select: 'Camera', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Both boxes are 1 tall. On the camera’s 1280 × 720 image the near one is 104.7 pixels tall and the far one, 2.4 times as far away, 48.3: the divide by w shrinks things with distance. (Not exactly 2.4 times: the camera looks down steeply at the near box, which tilts its height away a little.)',
      'In the Algorithm trace, press Play. The point (1, 0.5, 0) goes into camera space, through the projection matrix into clip space, and is divided by w. Predict the normalised coordinates, then the pixel.',
      step('Select Camera and set its Field of view to 30 in the Inspector, then use Object › Trace the projection (camera): a narrower view makes everything bigger on the image, so the box’s pixel moves away from the centre.', (e) => { const c = e.scene.get('Camera'); return !!c?.camera && Math.abs(c.camera.fov - 30) < 1e-9 && e.trace?.op === 'Trace the projection'; }),
      'Press 5 (View › Orthographic / perspective): the viewport stops shrinking things with distance, and the two boxes look the same size. Front, Right and Top (View menu) switch to orthographic by themselves; Perspective switches back.',
    ],
    code: `const f = (v) => v.map((x) => +x.toFixed(2)).join(', ')

scene.add.cube({ name: 'Near box', size: 1, position: [0, 0.5, 0] }).material.color = '#4f8fd9'
scene.add.cube({ name: 'Far box', size: 1, position: [-6, 0.5, -8] }).material.color = '#f59e0b'
const cam = scene.add.camera({ name: 'Camera', position: [4, 3, 5], lookAt: [0, 0.5, 0], fov: 50 })

// How tall is each box on the image? Project its bottom and top centre.
for (const [name, x, z] of [['Near box', 0, 0], ['Far box', -6, -8]]) {
  const lo = cam.traceProjection([x, 0, z]).pixel, hi = cam.traceProjection([x, 1, z]).pixel
  log(name + ': ' + (lo[1] - hi[1]).toFixed(1) + ' pixels tall')
}
// With Record traces on, the last call is traced step by step.
const t = cam.traceProjection([1, 0.5, 0])
log('(1, 0.5, 0): clip', f(t.clip), ' ndc', f(t.ndc), ' pixel', f(t.pixel))`,
  },
  {
    id: 'depth-buffer',
    title: 'The depth buffer',
    icon: '🧱',
    group: 'Learning',
    desc: 'A poster 0.001 in front of a wall, 100 away, seen by a camera whose near plane is 0.01: the depth buffer cannot tell them apart and they fight. The script traces both through the depth buffer, with questions to predict; then you move the near plane out and the fighting stops.',
    lang: 'js',
    setup: { select: 'Camera', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Press 0 to look through the camera (0 again to come back). The orange poster is only 0.001 in front of the grey wall, 100 away: in places the wall shows through it in streaks. That is z-fighting.',
      'In the Algorithm trace, press Play. Both points get almost the same depth; a 24-bit buffer stores the same whole number for each. Predict the wall\u2019s depth, then how far apart two surfaces must be at that distance to be told apart.',
      step('Select Camera and set Near to 1 (Inspector \u203a Near, far), then use Object \u203a Trace the depth buffer (camera): the stored numbers now differ. Look through it again: the poster is clean.', (e) => { const c = e.scene.get('Camera'); return !!c?.camera && Math.abs(c.camera.near - 1) < 1e-9 && e.trace?.op === 'Trace the depth buffer'; }),
      'X-ray (toolbar) draws faces see-through and stops them writing depth, so everything behind shows. Wire draws edges over faces; MeshLab pushes the faces back a little in depth (polygon offset) so their own edges never fight them.',
    ],
    code: `const d = Math.PI / 180

// A wall 100 in front of the camera, and a poster 0.001 in front of the wall. Both face the camera.
scene.add.plane({ name: 'Wall', size: 20, position: [0, 1, -90], rotation: [90 * d, 0, 0] }).material.color = '#9aa4b2'
scene.add.plane({ name: 'Poster', size: 6, position: [0, 1, -89.999], rotation: [90 * d, 0, 0] }).material.color = '#f59e0b'
const cam = scene.add.camera({ name: 'Camera', position: [0, 1, 10], lookAt: [0, 1, -90], near: 0.01, far: 1000 })

// With Record traces on, this is traced step by step.
const t = cam.traceDepth([0, 1, -90], [0, 1, -89.999])
log('near 0.01: depths', t.depth.map((x) => x.toFixed(9)).join(', '), ' stored', t.stored.join(', '), t.fight ? ' (they fight)' : '')
log('one depth step at 100 is', t.resolution.toFixed(4), 'long; the poster is 0.001 in front')`,
  },
  {
    id: 'flat-and-smooth',
    title: 'Flat and smooth shading',
    icon: '🥫',
    group: 'Learning',
    desc: 'Three equal cylinders: shaded flat, smooth, and auto smooth. Smooth shading averages the faces round each vertex, so the big cap drags the rim normals down and the rims smear. The script traces one rim vertex’s normal, with questions to predict; then you auto-smooth it.',
    lang: 'js',
    setup: { select: 'Smooth', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Left: Flat, one normal per face, so the 16 sides show as facets. Middle: Smooth, one normal per vertex, so the sides blend, but the rims are smeared dark. Right: Auto smooth 30°, sides blended and rims crisp.',
      'In the Algorithm trace, press Play. Vertex 0 on the bottom rim touches the cap (area 3.06) and two side faces (0.78 each). Predict the cap’s weight, then the averaged normal: the cap pulls it 63° down.',
      step('Select Smooth and use Object › Shade auto smooth (30°): its rims become as crisp as the right-hand one.', (e) => e.scene.get('Smooth')?.autoSmooth === 30),
      step('Tab into edit mode on Smooth, press 1 for vertex select, click a rim vertex, and use Mesh › Trace the vertex normal (one vertex): with auto smooth on, that vertex now has 2 normals, one for the sides and one for the cap.', (e) => e.trace?.op === 'Trace the vertex normal' && e.trace.steps.some((x) => x.phase === 'Auto smooth' && x.label.includes('2 different normals'))),
    ],
    code: `const f = (v) => v.map((x) => +x.toFixed(4)).join(', ')

const flat = scene.add.cylinder({ name: 'Flat', radius: 1, height: 2, segments: 16, position: [-3, 1, 0] })
const smooth = scene.add.cylinder({ name: 'Smooth', radius: 1, height: 2, segments: 16, position: [0, 1, 0] })
const auto = scene.add.cylinder({ name: 'Auto smooth', radius: 1, height: 2, segments: 16, position: [3, 1, 0] })
smooth.smooth = true
auto.autoSmooth = 30

// Vertex 0 is on the bottom rim. Its normal weighted by angle, then by area (traced with Record traces on).
log('angle-weighted normal:', f(smooth.mesh.vertexNormal(0, { weight: 'angle' }).normal))
const t = smooth.mesh.vertexNormal(0)
log('faces round vertex 0:', t.faces.join(', '), '  areas', f(t.weights), '  area-weighted normal', f(t.normal))`,
  },
  {
    id: 'outlines',
    title: 'Lines, outlines and overlays',
    icon: '🖍️',
    group: 'Learning',
    desc: 'A box with a recessed panel, selected, so its orange outline shows. The outline is the mesh pushed out along its normals by a fraction of its distance (constant on screen), drawn back faces only, and kept outside the body by the stencil. The script traces its width on the camera’s image, with a question to predict; then you switch the stencil off and see the panel’s creases.',
    lang: 'js',
    setup: { select: 'Block', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'The orange outline round the selected block is the same width on screen however far away it is: zoom in and out to see. It is a copy of the mesh, pushed out by 0.0035 × its distance from the eye and drawn back faces only.',
      'In the Algorithm trace, press Play: the push, then the width on the camera’s 720-pixel image. Predict the pixels: the distance cancels.',
      'View › Outline stencil on / off: with the stencil off, thin orange lines appear round the recessed panel, inside the box. There the hull’s hidden inner walls, pushed out along normals averaged with the panel, come in front of it. Switch it back on: the body’s pixels are marked in the stencil buffer and the outline is drawn only outside them.',
      step('Select Camera, set its Field of view to 25, and use Object › Trace the outline width (camera): a narrower view magnifies everything, so the same outline is about twice as many pixels wide.', (e) => { const c = e.scene.get('Camera'); return !!c?.camera && Math.abs(c.camera.fov - 25) < 1e-9 && e.trace?.op === 'Trace the outline width'; }),
    ],
    code: `// A box with a recessed panel on its front: the panel's edges are concave creases, where an inverted hull
// alone goes wrong. Back corners 0-3, front rim 4-7, the panel's rim 8-11, the sunk panel 12-15.
const sq = (s, z) => [[-s, -s, z], [s, -s, z], [s, s, z], [-s, s, z]]
const verts = [...sq(0.5, -0.5), ...sq(0.5, 0.5), ...sq(0.3, 0.5), ...sq(0.3, 0.38)].map(([x, y, z]) => [x, y + 0.5, z])
const faces = [[3, 2, 1, 0], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],
  [4, 5, 9, 8], [5, 6, 10, 9], [6, 7, 11, 10], [7, 4, 8, 11],
  [8, 9, 13, 12], [9, 10, 14, 13], [10, 11, 15, 14], [11, 8, 12, 15], [12, 13, 14, 15]]
const block = scene.add.mesh({ name: 'Block', verts, faces })
block.material.color = '#8fa3b8'
const cam = scene.add.camera({ name: 'Camera', position: [1.5, 2, 4], lookAt: [0, 0.5, 0] })

// With Record traces on, this is traced step by step.
const t = cam.traceOutline([0, 0, 0])
log('the block is ' + t.distance.toFixed(3) + ' away; the hull is pushed out ' + t.push.toFixed(5) + '; the outline is ' + t.pixels.toFixed(2) + ' pixels wide')`,
  },
  {
    id: 'camera-and-still',
    title: 'A camera you can place, and a still image',
    icon: '📷',
    group: 'Learning',
    desc: 'A scene camera aimed at a box with look-at. The script traces the aiming: forward, right and up, the rotation with those as columns, and its Euler angles, with questions to predict. Then you change the render size, look through the camera and render a still.',
    lang: 'js',
    setup: { select: 'Camera', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Camera is an object like any other: Position (6, 4, 8), and a Rotation that look-at worked out so its −z axis points at the box. The Inspector shows its field of view: 50° tall, 79.3° wide for a 16:9 render.',
      'In the Algorithm trace, press Play: forward, then right and up, then the rotation with them as columns, decoded into the Rotation fields. Predict forward, then the Y rotation.',
      step('In the Inspector, set Render size to 1080 × 1080 (square), then press 0 to look through the camera: the frame becomes square and the wide angle drops to 50°. Press 0 again to come back.', (e) => e.renderSize.width === e.renderSize.height),
      'View › Render still (PNG) renders what the camera sees at the render size, off screen, with the grid, outlines and gizmos hidden, and saves it. For a camera that flies, see the island fly-through project.',
    ],
    code: `const f = (v) => v.map((x) => +x.toFixed(4)).join(', ')

// The box first: Object › Trace look-at aims the camera at the first mesh.
scene.add.cube({ name: 'Box', size: 1, position: [0, 0.5, 0] }).material.color = '#4f8fd9'
scene.add.plane({ name: 'Ground', size: 12 }).material.color = '#556070'
scene.add.uvSphere({ name: 'Ball', radius: 0.6, position: [2, 0.6, -1] }).material.color = '#f59e0b'
const cam = scene.add.camera({ name: 'Camera', position: [6, 4, 8], fov: 50 })

// With Record traces on, look-at is traced step by step; then the camera is turned to match.
const t = cam.traceLookAt([0, 0.5, 0])
cam.lookAt([0, 0.5, 0])
log('right', f(t.right), '  up', f(t.up), '  back', f(t.back))
log('rotation fields:', t.rotationDeg.map((a) => a.toFixed(2)).join('°, ') + '°')
log('field of view: 50° tall, ' + (2 * Math.atan(Math.tan(25 * Math.PI / 180) * 16 / 9) * 180 / Math.PI).toFixed(1) + '° wide at 16:9')`,
  },
  {
    id: 'picking',
    title: 'Picking by ray',
    icon: '🎯',
    group: 'Learning',
    desc: 'Two boxes, one partly behind the other, and a camera. The script sends the ray through the centre of the camera’s image and tests it against every triangle (Möller–Trumbore), with questions to predict; the nearest hit is what a click there selects.',
    lang: 'js',
    setup: { select: 'Camera', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'A click is a ray: from the eye, through the pixel, into the scene. Every triangle it crosses is a hit; the nearest one in front of the eye is the surface you clicked.',
      'In the Algorithm trace, press Play: the ray, the triangles tested per object, then Möller–Trumbore on the nearest hit. Predict how far along the ray it is, then the point.',
      step('Click the back box where it shows to the right of the front one: the ray through that pixel misses the front box and hits the back one, so the back box is selected.', (e) => e.activeObject?.name === 'Back box'),
      'Press 0 to look through the camera: the centre of the frame is the pixel the script traced, on the front box.',
    ],
    code: `const f = (v) => v.map((x) => +x.toFixed(3)).join(', ')

scene.add.cube({ name: 'Front box', size: 1, position: [0, 0.5, 1] }).material.color = '#4f8fd9'
scene.add.cube({ name: 'Back box', size: 1.6, position: [1, 0.8, -2] }).material.color = '#f59e0b'
const cam = scene.add.camera({ name: 'Camera', position: [0, 1.2, 6], lookAt: [0, 0.5, 0] })

// A pixel right of centre: only the back box is there.
const side = cam.tracePick(790, 300)
log('pixel (790, 300) hits', side.hit ? side.hit.name : 'nothing')
// With Record traces on, the last pick is traced: the centre pixel of the 1280 × 720 image.
const p = cam.tracePick(639.5, 359.5)
log('ray from', f(p.ray.origin), 'along', f(p.ray.dir))
log('centre pixel hits', p.hit.name, 'face', p.hit.face, 'at t =', p.hit.t.toFixed(3), 'point', f(p.hit.point))`,
  },
  {
    id: 'screen-picking',
    title: 'Picking in screen space',
    icon: '🖱️',
    group: 'Learning',
    desc: 'A block seen by a camera. Vertices and edges are too thin to hit with a ray, so they are picked by distance on the screen: the script projects every vertex to the camera’s image and picks the nearest to a pointer, with questions to predict.',
    lang: 'js',
    setup: { select: 'Block', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'A ray almost never passes exactly through a vertex or along an edge. So in vertex select (1) a click picks the vertex nearest the pointer on screen, within 12 pixels; in edge select (2), the edge whose segment on screen passes nearest, within 10.',
      'In the Algorithm trace, press Play: every vertex projected to the camera’s image, the nearest few with their distances, and the pick. Predict the distance to the nearest vertex.',
      step('Tab into edit mode on Block, press 1 for vertex select, and click a corner: the nearest vertex on screen is selected.', (e) => e.mode === 'edit' && e.editObject?.name === 'Block' && e.selectMode === 'vert' && e.selectedVerts().length === 1),
      'MeshLab picks by screen distance only: a vertex hidden behind the block can be picked if it is nearest on screen. Blender in solid mode picks only visible ones unless X-ray is on.',
    ],
    code: `const f = (v) => v.map((x) => +x.toFixed(2)).join(', ')

const block = scene.add.cube({ name: 'Block', size: 2 })
const cam = scene.add.camera({ name: 'Camera', position: [3, 2.5, 4], lookAt: [0, 0, 0] })

// Where the corner (1, 1, 1) lands on the camera's 1280 × 720 image, and a pointer 7 px right of it and 5 px down.
const corner = cam.traceProjection([1, 1, 1]).pixel
const px = corner[0] + 7, py = corner[1] + 5
const e = cam.tracePickNear(block, px, py, 'edge')
log('corner at', f(corner), '; pointer at', f([px, py]))
log('nearest edge:', e.key, e.d.toFixed(2), 'px away, at t =', e.t.toFixed(3))
// With Record traces on, the vertex pick is traced step by step.
const v = cam.tracePickNear(block, px, py, 'vert')
log('nearest vertex:', v.index, v.d.toFixed(2), 'px away')`,
  },
  {
    id: 'loops',
    title: 'Box and loop selection',
    icon: '➰',
    group: 'Learning',
    desc: 'A UV sphere: its latitude lines are edge loops that go all the way round; its longitude lines stop at the poles. The script walks both, traced vertex by vertex with questions to predict; then you box-select and Alt+click loops yourself.',
    lang: 'js',
    setup: { select: 'Ball', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'An edge loop runs straight on through the mesh: at every vertex where four edges meet, it takes the one that shares no face with the edge it came along. It stops at a pole (more or fewer than four edges) or at a triangle or n-gon.',
      'In the Algorithm trace, press Play: the walk round a line of latitude. Predict the first vertex it goes on to, then how many edges the loop has.',
      step('Tab into edit mode on Ball, press 1, and Alt+click an edge on the equator: the whole ring of vertices round the ball is selected.', (e) => e.mode === 'edit' && e.editObject?.name === 'Ball' && e.selectedVerts().length >= 12),
      'Press B and drag a rectangle: every vertex drawn inside it is selected (in face select, every face whose centre is inside). Like click picking, box select works on the screen.',
    ],
    code: `const ball = scene.add.uvSphere({ name: 'Ball', radius: 1, segments: 12, rings: 8 })
const v = ball.mesh.verts, E = ball.mesh.edges
// An edge along a line of longitude (its ends at different heights, away from the poles)...
const lon = E.find((e) => Math.abs(v[e.a].y - v[e.b].y) > 1e-6 && Math.abs(v[e.a].y) < 0.9 && Math.abs(v[e.b].y) < 0.9)
const l = ball.mesh.loop(lon.a, lon.b)
log('a longitude loop:', l.edges.length, 'edges,', l.closed ? 'all the way round' : 'open: it stops next to the poles')
// ...and one along a line of latitude (both ends at the same height). With Record traces on, this walk is traced.
const lat = E.find((e) => Math.abs(v[e.a].y - v[e.b].y) < 1e-9 && Math.abs(v[e.a].y) < 0.5)
const t = ball.mesh.loop(lat.a, lat.b)
log('a latitude loop:', t.edges.length, 'edges,', t.closed ? 'all the way round' : 'open')`,
  },
  {
    id: 'gizmo-drag',
    title: 'Dragging with a gizmo',
    icon: '↔️',
    group: 'Learning',
    desc: 'A box and a camera. Dragging the gizmo’s X arrow 120 pixels to the right: the script finds where each mouse position’s ray passes closest to the axis, and the move between them, snapped, with questions to predict. The same 120 pixels along z moves a different amount.',
    lang: 'js',
    setup: { select: 'Box', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'The mouse moves on a flat screen; the box may only move along one 3D line. At each mouse position the pick ray (lesson 4.1) passes closest to that line at one point: that is where the mouse is, along the axis.',
      'In the Algorithm trace, press Play: the axis, the grab, the drag, then the snap. Predict the move, then what Snap makes of it.',
      step('Press Move, then drag the gizmo’s red arrow: the box slides along x only. Its Y and Z stay exactly as they were.', (e, s) => { const o = e.scene.get('Box'), w = s.obj('Box'); return !!o && !!w && Math.abs(o.position[0] - w.position[0]) > 1e-6 && Math.abs(o.position[1] - w.position[1]) < 1e-9 && Math.abs(o.position[2] - w.position[2]) < 1e-9; }),
      'Turn on Snap (toolbar) and drag again: the move jumps in steps of 0.25. Rotate snaps to 15°, scale to 0.1.',
    ],
    code: `const box = scene.add.cube({ name: 'Box', size: 1 })
box.material.color = '#4f8fd9'
const cam = scene.add.camera({ name: 'Camera', position: [4, 3, 6], lookAt: [0, 0, 0] })

// The same 120-pixel drag to the right, on the z arrow: here the z axis is seen end-on more steeply, so
// 120 pixels covers more of it; and to the right on screen is towards −z, so the move is negative.
const z = cam.traceDrag(box, 'z', 120, 0)
log('120 px right on the z arrow moves the box', z.move.toFixed(3), 'along z')
// With Record traces on, the x arrow's drag is traced: snapped to 0.25.
const x = cam.traceDrag(box, 'x', 120, 0, 0.25)
log('120 px right on the x arrow: grab at s =', x.s0.toFixed(3), ', now s =', x.s1.toFixed(3), ', move', x.move.toFixed(3), ', snapped', x.snapped)`,
  },
  {
    id: 'knife-cut',
    title: 'The knife',
    icon: '🔪',
    group: 'Learning',
    desc: 'Two slabs and a slanted knife line. A line on the screen is a plane through the eye: the script cuts one slab with it (front faces only) and the other straight through, traced with questions to predict.',
    lang: 'js',
    setup: { select: 'Slab', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'A line drawn on the screen is not a line in the scene: everything that lands on it lies on one plane, through the eye and the line’s two ends. The knife cuts where that plane meets the faces.',
      'In the Algorithm trace, press Play: the plane, where each face is crossed, then the split. Predict how far along its edge the first crossing is, then how many faces are cut.',
      step('Tab into edit mode on Slab, press K, and drag a line across it: the faces facing you are cut along the line, and the new edges are selected.', (e, s) => did(e, s, 'Knife')),
      'Turn on X-ray before cutting and the knife goes through to the back faces too (the second slab was cut that way). New vertices on an edge are shared by the faces on both sides, so no crack opens.',
    ],
    code: `// Two slabs, the same knife line: the eye, and a point on each end's ray (what the knife records).
const line = { eye: [0, 0, 6], from: [-2, 0.5, 0], to: [2, -0.5, 0] }
const through = scene.add.cube({ name: 'Cut through', size: 2, position: [0, 0, -3] })
through.mesh.knife({ ...line, eye: [0, 0, 9], through: true })
log('cut through (X-ray):', through.mesh.faces.length, 'faces, closed:', through.mesh.stats().closed)
const slab = scene.add.cube({ name: 'Slab', size: 2 })
// With Record traces on, this cut is traced step by step.
const cut = slab.mesh.knife(line)
log('front faces only:', cut.length, 'face cut,', slab.mesh.faces.length, 'faces, closed:', slab.mesh.stats().closed)`,
  },
  {
    id: 'undo-redo',
    title: 'Undo and redo',
    icon: '↩️',
    group: 'Learning',
    desc: 'A box to change. Every change is stored as a pair of whole-scene snapshots, before and after; undo restores one, redo the other, and a new change clears what could be redone. Make a few changes, then trace the stacks with questions to predict.',
    lang: 'js',
    setup: { select: 'Box', trace: true, predict: true, view: 'all' },
    guide: [
      'Every change in MeshLab, from the menus, the Inspector, the gizmo or a script, goes through one path: snapshot the scene, change it, snapshot again, push the pair onto the undo stack.',
      step('Make three changes to Box: for example Shade smooth, then a move, then a new Rotation value.', (e, s) => e.undoStack.length >= s.undo + 3),
      step('Use Edit › Trace the undo stack and press Play: predict how many steps are left after two undos, and how many can be redone after a new change.', (e) => e.trace?.op === 'Undo stack' && e.undoStack.length >= 3),
      'Press Ctrl+Z twice, then move the box: the two undone steps are gone from the redo stack, so Ctrl+Shift+Z does nothing.',
      'A gizmo drag is one step however many mouse moves it took: the snapshot is taken when the drag starts and pushed when it ends.',
    ],
    code: `const box = scene.add.cube({ name: 'Box', size: 1, position: [0, 0.5, 0] })
box.material.color = '#4f8fd9'
log('A box to change. The whole script is one undo step.')`,
  },
  {
    id: 'every-click',
    title: 'Every click is code',
    icon: '📜',
    group: 'Learning',
    desc: 'A box to change through the interface. Every change is logged as the script line that would make it; replaying the log on the starting scene rebuilds yours exactly. Make changes, read the log, then trace the replay with a question to predict.',
    lang: 'js',
    setup: { select: 'Box', trace: true, predict: true, view: 'all' },
    guide: [
      'Open the GUI → code tab: it holds the script that built the box. Every change you make with the menus, the Inspector or the gizmo will be added as a script line.',
      step('Change Box three ways: Shade smooth, a new Position X in the Inspector, and a new Rotation Y. Each appears in the log; the rotation is written in radians.', (e, s) => e.log.length >= s.log + 3),
      step('Use Script › Trace the GUI → code log (replay it) and press Play: predict how many lines it runs. The replayed scene must match yours.', (e) => e.trace?.op === 'Replay the log' && e.trace.steps.some((x) => x.phase === 'Compare' && x.label.startsWith('The replayed scene matches'))),
      'Undo a change: its line leaves the log too, because the log is the program for the scene you have now.',
    ],
    code: `const box = scene.add.cube({ name: 'Box', size: 1, position: [0, 0.5, 0] })
box.material.color = '#4f8fd9'
log('A box to change. This script is logged as one entry; each change you make in the interface adds a line.')`,
  },
  {
    id: 'extrude',
    title: 'Extrude',
    icon: '⬆️',
    group: 'Learning',
    desc: 'A flat 3 × 3 grid. The script extrudes two of its middle faces upward together: the average normal, a copy of every vertex, walls on the border edges only. Traced, with a question to predict. Then extrude faces yourself.',
    lang: 'js',
    setup: { select: 'Grid', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Two neighbouring faces in the middle of the grid were extruded together, 0.5 up. Tab into edit mode to see the new walls: there is no wall between the two faces, only round the outside of the pair.',
      'In the Algorithm trace, press Play: each face’s normal and area, the average direction, the copied vertices (predict where one goes), the border edges, the walls.',
      step('Tab into edit mode on Grid, press 3 for face select, click a corner face of the grid and press E: it rises with four new walls.', (e, s) => did(e, s, 'Extrude')),
      'The walls are shaded by their own normals, at right angles to the face that moved. With the whole region selected, E moves every selected face along one shared direction.',
    ],
    code: `const grid = scene.add.grid({ name: 'Grid', size: 3, subdivisions: 3 })
grid.material.color = '#8fa3b8'
// The two middle faces of the middle row: centres at x = 0 and x = 1, z = 0.
const pair = grid.mesh.faces.where((f) => Math.abs(f.center[2]) < 0.1 && f.center[0] > -0.1)
log('faces', pair.join(', '), 'extruded together')
const before = grid.mesh.stats()
// With Record traces on, the extrude is traced step by step.
grid.mesh.extrude(pair, 0.5)
const after = grid.mesh.stats()
log('vertices', before.verts, '→', after.verts, '; faces', before.faces, '→', after.faces)`,
  },
  {
    id: 'inset',
    title: 'Inset',
    icon: '🔲',
    group: 'Learning',
    desc: 'A 4 × 4 grid. An L of three faces is inset as one region by 0.2: the outline moves in, mitred at its corners so the frame is 0.2 wide all round. A corner face is inset on its own by a fraction, for comparison. Traced, with a question to predict.',
    lang: 'js',
    setup: { select: 'Grid', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Tab into edit mode: the L of three faces has a frame 0.2 wide all round, even at the inside corner of the L. The single face in the corner has a frame too, made a different way.',
      'In the Algorithm trace, press Play: the outline, then each outline vertex: straight ones move 0.2, corners move further (0.2 / sin(φ/2)). Predict where the first corner goes.',
      step('Select one face of the grid (3 for face select, click it) and press I: a region inset by 0.1. Change Thickness in the Adjust panel.', (e, s) => did(e, s, 'Inset')),
      'Mesh › Inset individual faces insets each selected face on its own, by a fraction of the way to its centre: on a long face, the frame is wider at the ends than along the sides.',
    ],
    code: `const grid = scene.add.grid({ name: 'Grid', size: 4, subdivisions: 4 })
grid.material.color = '#8fa3b8'
const at = (x, z) => grid.mesh.faces.where((f) => Math.abs(f.center[0] - x) < 0.1 && Math.abs(f.center[2] - z) < 0.1)[0]
// One face on its own: each corner a quarter of the way to the face's centre.
grid.mesh.inset([at(1.5, 1.5)], 0.25)
// Three faces as one region, an L: its outline moves in 0.2, mitred at the corners.
const L = [at(-0.5, -0.5), at(0.5, -0.5), at(-0.5, 0.5)]
log('the L is faces', L.join(', '))
grid.mesh.insetRegion(L, 0.2)
log('faces now:', grid.mesh.stats().faces)`,
  },
  {
    id: 'loop-cuts',
    title: 'Edge rings and loop cuts',
    icon: '➰',
    group: 'Learning',
    desc: 'An 8-sided tube. A loop cut through one of its upright edges walks the ring of quads round the tube, crossing each to its opposite edge, and splits every one: a new loop round the middle. Traced, with questions to predict.',
    lang: 'js',
    setup: { select: 'Tube', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Tab into edit mode: a new ring of edges runs round the middle of the tube. It was made by one loop cut through an upright side edge.',
      'In the Algorithm trace, press Play: the walk enters each quad by one edge and leaves by the opposite one (predict which), comes back to where it started, then puts a vertex half way along each upright edge.',
      step('Select one of the new horizontal edges (2 for edge select, click it) and press Ctrl+R: that ring runs up the side and stops at the cap, an 8-sided face with no opposite edge.', (e, s) => did(e, s, 'Loop cut')),
      'Change Position in the Adjust panel: every new vertex moves the same fraction along its edge, so the cut stays parallel to the ring.',
    ],
    code: `const tube = scene.add.cylinder({ name: 'Tube', segments: 8, radius: 1, height: 2 })
tube.material.color = '#8fa3b8'
const m = tube.mesh
// An upright side edge: its two ends are at different heights.
const side = m.edges.find((e) => Math.abs(m.verts[e.a].y - m.verts[e.b].y) > 1)
log('cutting through edge', side.a, '–', side.b)
const before = m.stats()
m.loopCut(side.a, side.b, 0.5)
const after = m.stats()
log('faces', before.faces, '→', after.faces, '; vertices', before.verts, '→', after.verts)`,
  },
  {
    id: 'bevel',
    title: 'Bevel',
    icon: '🔷',
    group: 'Learning',
    desc: 'A cube with the three edges at one corner bevelled by 0.3 in two segments: corners slide along their edges, each edge becomes a curved strip, and a patch fills the corner where the three meet. Traced, with questions to predict.',
    lang: 'js',
    setup: { select: 'Block', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Look at the near top corner: three rounded strips meet in a small curved patch. Tab into edit mode to see the strips’ two rows of faces.',
      'In the Algorithm trace, press Play: the width, the first corner sliding along its edge (predict where), the curve between two slid points (predict its middle point), what replaces each face corner, the strips and the patch.',
      step('Select one edge of the cube (2 for edge select, click it) and press Ctrl+B; change Width and Segments in the Adjust panel.', (e, s) => did(e, s, 'Bevel')),
      'Turn Smooth shading on (Object › Shade smooth): the bevelled edges catch the light as a soft band; the edges left sharp still shade as a hard line.',
    ],
    code: `const block = scene.add.cube({ name: 'Block', size: 2 })
block.material.color = '#8fa3b8'
const m = block.mesh
// The corner nearest (1, 1, 1), and the three edges that meet there.
const c = m.verts.findIndex((v) => v.x > 0 && v.y > 0 && v.z > 0)
const three = m.edges.filter((e) => e.a === c || e.b === c).map((e) => [e.a, e.b])
log('bevelling', three.length, 'edges at vertex', c)
const before = m.stats()
m.bevel(three, 0.3, 2)
const after = m.stats()
log('faces', before.faces, '→', after.faces, '; vertices', before.verts, '→', after.verts)`,
  },
  {
    id: 'dissolve',
    title: 'Dissolve and delete',
    icon: '🫧',
    group: 'Learning',
    desc: 'A 5 × 5 grid. An L of three faces is dissolved into one face (the shared edges go, the outline stays), drawn by ear clipping because it is concave; another face is deleted instead, leaving a hole. Traced, with a question to predict.',
    lang: 'js',
    setup: { select: 'Grid', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Tab into edit mode: the L is one 8-sided face now (6 corners, and 2 vertices in the middle of its long sides). Another face was deleted: there is a hole, and the open edges went from 20 (the grid’s border) to 24.',
      'In the Algorithm trace, press Play: the 2 shared edges go, the 8 outline edges stay, and the outline is walked into one face. Predict the vertex after the first.',
      step('Select the L (3 for face select, click it) and use Mesh › Trace drawing the face: it is concave, so it is cut by ear clipping, not a fan.', (e) => e.trace?.op === 'Trace drawing the face'),
      step('Select two neighbouring faces of the grid and press Ctrl+X: dissolve merges them. Then X deletes a face: compare the open-edge count.', (e, s) => did(e, s, 'Dissolve')),
    ],
    code: `const grid = scene.add.grid({ name: 'Grid', size: 5, subdivisions: 5 })
grid.material.color = '#8fa3b8'
const at = (x, z) => grid.mesh.faces.where((f) => Math.abs(f.center[0] - x) < 0.1 && Math.abs(f.center[2] - z) < 0.1)[0]
log('open edges', grid.mesh.stats().boundaryEdges)
// Delete a face: it goes, and leaves a hole.
grid.mesh.delete({ faces: [at(1, 1)] })
log('after delete: faces', grid.mesh.stats().faces, '; open edges', grid.mesh.stats().boundaryEdges)
// Dissolve an L of three faces: one face with the same outline, and no hole.
const L = [at(-1, -1), at(0, -1), at(-1, 0)]
grid.mesh.dissolve({ faces: L })
log('after dissolve: faces', grid.mesh.stats().faces, '; open edges', grid.mesh.stats().boundaryEdges)`,
  },
  {
    id: 'merge-smooth',
    title: 'Merge and smooth vertices',
    icon: '🫓',
    group: 'Learning',
    desc: 'A grid whose inner vertices were pushed up and down in a checkerboard, then smoothed once with λ = 0.5: each vertex steps half way to its neighbours’ average, and the bumps all but vanish in one step. Traced, with a question to predict. Then merge vertices at their centre.',
    lang: 'js',
    setup: { select: 'Grid', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'The grid was a checkerboard of bumps 0.15 up and down. One smoothing step left it nearly flat: a raised vertex’s neighbours are all lowered, so their average is as far below as it was above.',
      'In the Algorithm trace, press Play: the vertex that moves most, its neighbours’ average, and where it goes (predict it). The heat map shows how far each vertex moved.',
      step('Tab into edit mode, select the four corners of one face (1 for vertex select, Shift+click) and press M: they merge at their centre, and the faces round them lose corners.', (e, s) => did(e, s, 'Merge at centre')),
      step('Select all (A) and use Mesh › Smooth vertices: the open border stays put while the inside relaxes.', (e, s) => did(e, s, 'Smooth vertices')),
    ],
    code: `const grid = scene.add.grid({ name: 'Grid', size: 3, subdivisions: 6 })
grid.material.color = '#8fa3b8'
const m = grid.mesh
// The inner vertices (not on the border), pushed 0.15 up or down in a checkerboard.
const inner = m.verts.filter((v) => Math.abs(v.x) < 1.4 && Math.abs(v.z) < 1.4).map((v) => v.index)
for (const i of inner) {
  const k = Math.round((m.verts[i].x + 1.5) / 0.5) + Math.round((m.verts[i].z + 1.5) / 0.5)
  m.translate([i], [0, k % 2 ? 0.15 : -0.15, 0])
}
const bump = () => Math.max(...inner.map((i) => Math.abs(m.verts[i].y))).toFixed(4)
log('largest bump before:', bump())
m.smooth({ verts: inner, iterations: 1, lambda: 0.5 })
log('after one step:', bump())`,
  },
  {
    id: 'mirror',
    title: 'Mirror and modifiers',
    icon: '🪞',
    group: 'Learning',
    desc: 'Half a box, open on the x = 0 plane, with a mirror modifier: the other half is computed, not stored. The front face was extruded with clipping on, so no wall was built on the mirror plane. Traced: the reflection, the shared vertices and the reversed winding.',
    lang: 'js',
    setup: { select: 'Half', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Tab into edit mode: you edit only the half on the +x side (the cage); the other half is drawn from it. Move a vertex and its mirror image moves too.',
      'In the Algorithm trace, press Play: the vertices on the plane are shared, the rest reflected (predict one), and every mirrored face has its corners reversed so it still faces out.',
      step('In the Inspector, switch the mirror modifier off and on: the cage stays the same; only what is drawn changes.', (e, s) => did(e, s, 'Modifier setting')),
      step('Object › Apply modifiers: the mirrored half becomes real geometry you can edit on its own; the modifier is gone.', (e, s) => did(e, s, 'Apply modifiers')),
    ],
    code: `const half = scene.add.cube({ name: 'Half', size: 2 })
half.material.color = '#8fa3b8'
const m = half.mesh
// Squash the cube to its +x half: the vertices at x = -1 move to x = 0, and the face there goes.
m.translate(m.verts.filter((v) => v.x < 0).map((v) => v.index), [1, 0, 0])
m.delete({ faces: m.faces.where((f) => f.normal[0] < -0.5) })
half.modifiers.add('mirror', { axis: 'x' })
// The front face touches the mirror plane; with clipping on, extrude builds no wall on the plane.
m.extrude(m.faces.where((f) => f.normal[2] > 0.5), 0.6)
log('cage:', m.stats().verts, 'vertices,', m.stats().faces, 'faces')
const shown = half.traceMirror()
log('drawn:', shown.verts, 'vertices,', shown.faces, 'faces; closed:', shown.closed)`,
  },
  {
    id: 'box-character',
    title: 'Box modelling a character',
    icon: '🧍',
    group: 'Learning',
    desc: 'The character built one operation at a time from half a box: a mirror, two loop cuts, an arm, a leg, a neck and head, then subdivision. The log counts the cage after every step; a camera in front traces the silhouette.',
    lang: 'js',
    setup: { select: 'Character', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Read the log: every step is one operation on the cage, and the cage stays small (under 40 faces) while the mirror and subdivision make the body.',
      'In the Algorithm trace, press Play: which faces face the camera (predict one), then the silhouette edges, where the outline of the body is drawn.',
      step('In the Inspector, turn the subdivision modifier off: the blocky cage is what the steps built; the smooth body is computed from it.', (e, s) => did(e, s, 'Modifier setting')),
      step('Tab into edit mode on the character, select the faces at the end of an arm (3 for face select) and press E: a longer arm, in one operation.', (e, s) => did(e, s, 'Extrude')),
    ],
    code: `const body = scene.add.cube({ name: 'Character', size: 1 })
body.material.color = '#d9a47a'
const m = body.mesh
const count = (what) => log(what + ':', m.stats().verts, 'vertices,', m.stats().faces, 'faces')
// 1. Half a torso, x from 0 to 0.6, open on the mirror plane.
for (const v of m.vertices) { v.x = v.x < 0 ? 0 : 0.6; v.y = v.y < 0 ? 0 : 1.2; v.z *= 0.6 }
m.delete({ faces: m.faces.facing([-1, 0, 0]) })
body.modifiers.add('mirror', { axis: 'x' })
count('1. half a torso')
// 2. Loop cuts: one down the middle of the half (the leg), one round the chest (the arm).
m.loopCut(m.nearest([0, 0, -0.3]), m.nearest([0.6, 0, -0.3]), 0.5)
m.loopCut(m.nearest([0.6, 0, 0.3]), m.nearest([0.6, 1.2, 0.3]), 0.75)
count('2. two loop cuts')
// 3. The arm: the upper part of the side, out twice.
const shoulder = m.faces.where((f) => f.normal[0] > 0.9 && f.center[1] > 0.9)
m.extrude(shoulder, 0.55).extrude(shoulder, 0.5)
count('3. an arm')
// 4. The leg: the outer half of the bottom, straight down.
m.extrude(m.faces.where((f) => f.normal[1] < -0.9 && f.center[0] > 0.3 && f.center[1] < 0.01), 1.1)
count('4. a leg')
// 5. Neck and head: the inner half of the top, out twice.
const top = m.faces.where((f) => f.normal[1] > 0.9 && f.center[0] < 0.3)
m.extrude(top, 0.12).extrude(top, 0.5)
count('5. neck and head')
// 6. Smooth it; stand it up; look at it from the front.
body.modifiers.add('subsurf', { levels: 2 })
body.position.set(0, 1.1, 0)
scene.add.camera({ name: 'Front', position: [0, 1.6, 7], lookAt: [0, 1.6, 0] })
const s = body.evaluatedStats()
log('6. drawn: mirrored and subdivided,', s.verts, 'vertices,', s.faces, 'faces; closed:', s.closed)
const sil = body.traceSilhouette()
log('from the front:', sil.front, 'of', sil.faces, 'faces face the camera;', sil.edges, 'silhouette edges')`,
  },
  {
    id: 'clean-topology',
    title: 'Clean topology',
    icon: '🕸️',
    group: 'Learning',
    desc: 'Three shapes, measured: a ball made of quads (a cube subdivided twice), a UV sphere and a torus. Valence at every vertex, the poles, the face kinds, and the pole budget Σ (4 − valence) = 4χ that decides how many poles a shape must have. Traced, with a question to predict.',
    lang: 'js',
    setup: { select: 'Quad ball', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'The quad ball has exactly eight vertices with 3 edges (the cube’s old corners) and every other inside vertex has 4. The torus has none at all. The UV sphere has two vertices with 32 edges, at its poles, ringed by triangles.',
      'In the Algorithm trace, press Play: the valence heat map (predict a pole’s valence), the face kinds, and the pole budget: Σ (4 − valence) = 8 for anything shaped like a sphere.',
      step('Select the UV sphere and use Object › Trace clean topology: its poles are 32-poles, and the budget does not apply because it has triangles.', (e) => e.trace?.op === 'Trace clean topology' && e.activeObject?.name === 'UV sphere'),
      step('Select the torus and trace it: no poles, and 4χ = 0.', (e) => e.trace?.op === 'Trace clean topology' && e.activeObject?.name === 'Torus'),
    ],
    code: `const torus = scene.add.torus({ name: 'Torus', position: [3.2, 0, 0] })
const uv = scene.add.uvSphere({ name: 'UV sphere', position: [-3.2, 0, 0] })
const ball = scene.add.cube({ name: 'Quad ball', size: 2 })
ball.mesh.subdivide(2)
for (const [o, c] of [[torus, '#9aa7b8'], [uv, '#9aa7b8'], [ball, '#d9a47a']]) o.material.color = c
const show = (o) => { const r = o.mesh.valence(); log(o.name + ':', JSON.stringify(r.inside), '·', r.poles, 'poles ·', r.quads, 'quads,', r.tris, 'triangles' + (r.budget ? ' · budget ' + r.budget.sum + ' = 4χ = ' + r.budget.fourChi : '')) }
show(torus); show(uv); show(ball)`,
  },
  {
    id: 'limits',
    title: 'Extraordinary vertices and limits',
    icon: '🪀',
    group: 'Learning',
    desc: 'A spinning top, two eight-sided cones, subdivided once: its tip is a vertex with 8 edges. The trace works out where the tip ends up after infinitely many steps, then subdivides further to watch it get there, and shows the ring round it shrinking slower than at a regular vertex.',
    lang: 'js',
    setup: { select: 'Spinning top', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'The top’s tip has 8 edges: an extraordinary vertex. In the Algorithm trace, press Play: its neighbours, its limit position (predict it), and the tip closing in on it level by level.',
      'Read the last step: at a regular vertex the ring of edges round it halves each step; round this tip it shrinks only to 0.61, so the quads there stay long and thin.',
      step('Tab into edit mode, select one vertex where 4 edges meet (1 for vertex select) and use Mesh › Trace the limit position: its ring halves each step.', (e) => e.trace?.op === 'Trace the limit position' && /× 0\.5/.test(e.trace.steps.at(-1)?.label ?? '')),
      step('Add a Subdivision modifier in the Inspector and raise its levels: the faces quadruple each level, and the tip stays slightly pointed.', (e, s) => did(e, s, 'Add subsurf modifier')),
    ],
    code: `// Two eight-sided cones base to base: a tip on top with 8 edges, one below, and a ring of 8 round the middle.
const n = 8, verts = [[0, 1.2, 0], [0, -1.2, 0]], faces = []
for (let k = 0; k < n; k++) verts.push([Math.cos(2 * Math.PI * k / n), 0, Math.sin(2 * Math.PI * k / n)])
for (let k = 0; k < n; k++) { faces.push([0, 2 + (k + 1) % n, 2 + k]); faces.push([1, 2 + k, 2 + (k + 1) % n]) }
const top = scene.add.mesh({ name: 'Spinning top', verts, faces })
top.material.color = '#d9a47a'
top.mesh.subdivide(1)            // now all quads; the tip keeps its number, 0
log('after one step:', top.mesh.stats().faces, 'quads; the tip is at y =', top.mesh.verts[0].y.toFixed(4))
const lim = top.mesh.limit(0)
log('its limit position: y =', lim[1].toFixed(4))`,
  },
  {
    id: 'subdivide-uvs',
    title: 'Subdividing UVs',
    icon: '🌐',
    group: 'Learning',
    desc: 'A low sphere cut along one seam from pole to pole, unwrapped, with a checker texture and a subdivision modifier. The UVs are subdivided with the surface: seams split vertices, island outlines stay put, inside points move by Catmull–Clark’s rule. Traced, with a question to predict, and the distortion compared with plain linear UVs.',
    lang: 'js',
    setup: { select: 'Ball', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'The checker squares stay close to square on the smoothed ball. In the Algorithm trace, press Play: the seam’s vertices become two UV vertices each, the outline stays, and an inside UV point moves (predict it).',
      'The last step compares texture distortion on the subdivided surface: about 1.49 with linear UVs, 1.32 with smooth ones (1 would be none).',
      'Open the UV tab: one island, with the seam down both its sides.',
      step('In the Inspector, untick Smooth UVs on the subdivision modifier: the checker slides and stretches near the poles, where the surface moved most.', (e, s) => did(e, s, 'Modifier setting')),
    ],
    code: `const ball = scene.add.uvSphere({ name: 'Ball', segments: 12, rings: 8 })
const m = ball.mesh
// One seam, pole to pole, along the +x side: the edges whose ends both have z = 0 and x ≥ 0.
const seam = m.edges.filter((e) => [e.a, e.b].every((v) => Math.abs(m.verts[v].z) < 1e-9 && m.verts[v].x >= -1e-9)).map((e) => [e.a, e.b])
m.markSeams(seam)
m.unwrap()
ball.material.texture = 'checker'
ball.modifiers.add('subsurf', { levels: 2 })
log('seam edges:', seam.length)
const d = ball.traceUVSubdivision(2)
log('mean distortion on the smoothed ball: linear UVs', d.linear, '· smooth UVs', d.smooth)`,
  },
  {
    id: 'fields',
    title: 'Fields on a mesh and colour maps',
    icon: '🌡️',
    group: 'Learning',
    desc: 'A grid pushed up into a hill, coloured by height: a number at every vertex turned into a colour by the turbo map. The trace goes from the range to one vertex’s t, its colour, and what the GPU does between vertices.',
    lang: 'js',
    setup: { select: 'Hill', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'The colours are heights: blue low, red high, with the legend in the corner. Every vertex has one number; the GPU blends the colours across each triangle.',
      'In the Algorithm trace, press Play: the range, one vertex’s t (predict it), its colour, and a triangle’s centre, where blended colours and the colour of the blended value differ.',
      step('Heat map › Mean curvature: a different field on the same mesh, coloured round zero (blue bowls, red domes).', (e) => e.field?.spec.kind === 'mean'),
      step('Heat map › Trace the colour mapping on the curvature: a diverging map, centred on 0.', (e) => e.trace?.op === 'Trace the colour mapping' && e.field?.spec.kind === 'mean'),
    ],
    code: `const hill = scene.add.grid({ name: 'Hill', size: 4, subdivisions: 16 })
// Push every vertex up by a bump: highest in the middle, fading out towards the edges.
for (const v of hill.mesh.verts) v.y = 1.2 * Math.exp(-(v.x * v.x + v.z * v.z) / 1.5)
hill.mesh.showField('y')
log(hill.mesh.traceColours())`,
  },
  {
    id: 'laplacian',
    title: 'The Laplacian',
    icon: '∇',
    group: 'Learning',
    desc: 'A sphere of radius 2. The Laplacian at a vertex on its equator, built up step by step: its neighbours, the plain average (umbrella), the cotan weight of each edge, the area it stands for, and the result on positions, which points inward with length 2H. H should come out close to 1/2.',
    lang: 'js',
    setup: { select: 'Sphere', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'In the Algorithm trace, press Play: the neighbours, the umbrella vector, one edge’s cotan weight (predict it), the vertex’s area, and the Laplacian of position.',
      'The last step’s arrow points to the centre of the sphere, and its length is about 1: twice the mean curvature 1/2 of a sphere of radius 2.',
      step('Tab into edit mode, select a vertex near a pole (1 for vertex select) and use Mesh › Trace the Laplacian (one vertex): its triangles are thinner, but H is still about 1/2.', (e) => e.trace?.op === 'Trace the Laplacian' && e.selectedVerts().length === 1),
      step('Heat map › Mean curvature: H at every vertex, nearly the same colour all over a sphere.', (e) => e.field?.spec.kind === 'mean'),
    ],
    code: `const sphere = scene.add.uvSphere({ name: 'Sphere', radius: 2, segments: 24, rings: 12 })
sphere.material.color = '#8fa3b8'
const m = sphere.mesh
// A vertex on the equator (y = 0), facing +x.
const v = m.verts.findIndex((p) => Math.abs(p.y) < 1e-9 && p.x > 1.99)
const L = m.laplacianAt(v)
log('vertex', v, ': mean curvature H ≈', L.H.toFixed(4), '(a sphere of radius 2 has H = 0.5)')`,
  },
  {
    id: 'mean-curvature',
    title: 'Mean curvature',
    icon: '🔴',
    group: 'Learning',
    desc: 'A ball with a dent pressed into one side, coloured by mean curvature: red where it bulges, blue where it is dented, white where it is flat or balanced. The trace builds H from the Laplacian of the positions at every vertex, and its sign from the normal.',
    lang: 'js',
    setup: { select: 'Dented ball', trace: true, predict: true, tab: 'trace', view: 'all' },
    guide: [
      'Red all round the ball (H about 1, a unit sphere’s), blue in the dent (it curves the other way), and a strong ring at the dent’s rim where the surface folds.',
      'In the Algorithm trace, press Play: the Laplacian of position at every vertex, the sign test at the most dented vertex (predict it), and the range.',
      step('Tab into edit mode, select one vertex in the dent and use Mesh › Trace the Laplacian (one vertex): its Δx points outward, against the inward-curving surface.', (e) => e.trace?.op === 'Trace the Laplacian'),
      step('Heat map › Gaussian curvature: the next lesson’s measure. Compare where the two disagree: at the rim.', (e) => e.field?.spec.kind === 'gaussian'),
    ],
    code: `const ball = scene.add.uvSphere({ name: 'Dented ball', radius: 1, segments: 32, rings: 16 })
// Press a dent into the +x side: the cap beyond x = 0.6 is reflected inward through the plane x = 0.6.
for (const v of ball.mesh.verts) if (v.x > 0.6) v.x = 1.2 - v.x
ball.smooth = true
ball.mesh.showField('mean')
const H = ball.mesh.curvature('mean')
log('H from', Math.min(...H).toFixed(3), 'to', Math.max(...H).toFixed(3), ';', H.filter((h) => h < 0).length, 'vertices curve inward')`,
  },
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
