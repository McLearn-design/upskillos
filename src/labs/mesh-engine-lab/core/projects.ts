// Finished projects for the Mesh Engine lab: a scene to open, look around and
// take apart, with a guide of things to try.
//
// Each one pairs with a lesson in the mesh-engine course and is reachable from
// that lesson by `#/lab/mesh-engine-lab?project=<id>`. The whole scene is built
// by a script, so how it was made is never hidden - it opens in the script panel
// and the guide steps tick as you change things.
//
// MeshLab's projects make geometry. These take geometry apart, which is why the
// groups are named after what you learn rather than what you build.

import type { Editor } from '../../../engines/mesh/core/Editor';
import type { Vec3 } from '../../../engines/mesh/core/EditMesh';
import { runScript } from '../../../engines/mesh/core/api';
import { runPython, type PyodideLike } from '../../../engines/mesh/core/python';

export interface ProjectSetup {
  select?: string;
  frame?: number;
  play?: boolean;
  pose?: boolean;
  bone?: string;
  weightPaint?: string;
  predict?: boolean;
  trace?: boolean;
  tab?: 'trace' | 'script' | 'timeline' | 'uv' | 'shader' | 'log';
  view?: 'all' | 'selected';
}

export interface StartObject { position: Vec3; rotation: Vec3; scale: Vec3; verts: Vec3[] | null; bones: number; glsl: string | undefined }
export interface StartState {
  obj(name: string): StartObject | undefined;
  field: string | null;
  log: number;
}

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

export interface ExampleProject {
  id: string;
  title: string;
  icon: string;
  group: 'Foundations' | 'Topology' | 'Measurement' | 'Classification' | 'Editing' | 'Colour';
  desc: string;
  /** The lesson this pairs with, so the lab and the course cannot drift apart. */
  lesson: string;
  lang: 'js' | 'python';
  code: string;
  setup: ProjectSetup;
  guide: GuideStep[];
}

export const PROJECT_GROUPS = ['Foundations', 'Topology', 'Measurement', 'Classification', 'Editing', 'Colour'] as const;

// ── shared helpers the project scripts use ────────────────────────────────
/** A cube written out by hand: eight corners, twelve triangles. */
const CUBE = `const V = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1,  1], [1, -1,  1], [1, 1,  1], [-1, 1,  1],
]
const F = [
  [0, 1, 5], [0, 5, 4],   // front
  [1, 2, 6], [1, 6, 5],   // right
  [2, 3, 7], [2, 7, 6],   // back
  [3, 0, 4], [3, 4, 7],   // left
  [4, 5, 6], [4, 6, 7],   // top
  [0, 3, 2], [0, 2, 1],   // bottom
]`;

/** Report topology the way lesson 3 does. */
const REPORT = `const report = (o) => {
  const m = o.mesh, e = m.edges
  const boundary = e.filter((x) => x.faces.length === 1).length
  const weird = e.filter((x) => x.faces.length > 2).length
  log(o.name.padEnd(14),
      'V', String(m.verts.length).padStart(4),
      ' E', String(e.length).padStart(4),
      ' F', String(m.faces.length).padStart(4),
      ' boundary', String(boundary).padStart(4),
      ' non-manifold', String(weird).padStart(3),
      ' Euler', m.verts.length - e.length + m.faces.length)
  return { boundary, weird }
}`;

const boundaryOf = (e: Editor, name: string): number => {
  const m = e.scene.objects.find((o) => o.name === name)?.mesh;
  if (!m) return -1;
  return [...m.edges().values()].filter((x) => x.faces.length === 1).length;
};
const vertsOf = (e: Editor, name: string): number =>
  e.scene.objects.find((o) => o.name === name)?.mesh?.verts.length ?? -1;
const facesOf = (e: Editor, name: string): number =>
  e.scene.objects.find((o) => o.name === name)?.mesh?.faces.length ?? -1;

export const PROJECTS: ExampleProject[] = [
  // ── Foundations ─────────────────────────────────────────────────────────
  {
    id: 'cube-by-hand',
    title: 'A cube, written out',
    icon: '□',
    group: 'Foundations',
    lesson: 'Lesson 1 — What a Mesh Actually Is',
    desc: 'Eight corners and twelve triangles, every number typed. Nothing is generated, so there is nowhere for the shape to hide.',
    lang: 'js',
    code: `// Nothing here is generated. Every corner and every triangle is written out,
// which is the point: a mesh is a list of points and a list of which points
// make each triangle. That is all it is.
${CUBE}

const cube = scene.add.mesh({ verts: V, faces: F, name: 'Cube' })

${REPORT}
report(cube)

log('')
log('18 edges, not 12: a cube drawn as triangles has a diagonal across every')
log('face. Euler V - E + F = 2 and no boundary edges means one closed solid.')
log('')
log('Try it: press Tab to edit, drag a corner, and run the script again.')`,
    setup: { select: 'Cube', tab: 'script', view: 'all' },
    guide: [
      'Read the two lists in the script panel. `V` is eight points; `F` says which three points make each triangle.',
      'The log says 18 edges, not 12. Find the extra six: each square face is two triangles, so each has a diagonal.',
      step('Press Tab to enter edit mode, then move any corner. The shape changes and the topology does not — same V, E, F.',
        (e, start) => {
          const now = e.scene.objects.find((o) => o.name === 'Cube')?.mesh;
          const was = start.obj('Cube')?.verts;
          if (!now || !was) return false;
          return now.verts.some((v, i) => was[i] && v.some((c, k) => Math.abs(c - was[i][k]) > 1e-6));
        }),
      step('Delete one face (select it in edit mode, then X). The boundary edge count goes from 0 to 3 — the hole has an edge.',
        (e) => boundaryOf(e, 'Cube') > 0),
      'Now put it back with undo. Boundary returns to 0, and "closed" means exactly that: every edge shared by two faces.',
    ],
  },

  // ── Topology ────────────────────────────────────────────────────────────
  {
    id: 'welded-or-exploded',
    title: 'Two cubes that look identical',
    icon: '⚙',
    group: 'Topology',
    lesson: 'Lesson 3 — Mesh Topology and Welding',
    desc: 'The same shape stored two ways: eight shared corners on the left, thirty-six separate ones on the right. They draw the same. Nothing else about them is the same.',
    lang: 'js',
    code: `${CUBE}

// Left: corners shared between faces, the way a solid modeller stores them.
const welded = scene.add.mesh({ verts: V, faces: F, name: 'Welded' })
welded.position.set(-2.5, 0, 0)

// Right: every triangle gets its own copies, the way an STL file arrives.
const eV = [], eF = []
for (const f of F) {
  eF.push([eV.length, eV.length + 1, eV.length + 2])
  for (const i of f) eV.push([...V[i]])
}
const exploded = scene.add.mesh({ verts: eV, faces: eF, name: 'Exploded' })
exploded.position.set(2.5, 0, 0)

${REPORT}
report(welded)
report(exploded)

log('')
log('Same picture. 8 verts against 36, 18 edges against 36, and every single')
log('edge on the right is a boundary edge - the right-hand cube is 12 separate')
log('triangles that happen to touch.')
log('')
log('Nothing on screen tells you which is which. Select one and press Tab.')`,
    setup: { select: 'Exploded', tab: 'script', view: 'all' },
    guide: [
      'Both cubes look identical. The log says one has 8 vertices and the other 36.',
      'Every edge of the exploded cube is a boundary edge — 36 of them. It is not a solid; it is twelve loose triangles.',
      step('Select the exploded cube and weld it (Mesh › Weld, or `weld(1e-6)` in the script). Watch its vertex count drop to 8.',
        (e) => vertsOf(e, 'Exploded') === 8),
      step('Now its boundary count is 0 too. The picture never changed — only what the file knows about itself.',
        (e) => vertsOf(e, 'Exploded') === 8 && boundaryOf(e, 'Exploded') === 0),
      'This is why lesson 3 welds before doing anything else: on an exploded mesh, every neighbour query returns nothing.',
    ],
  },

  {
    id: 'boundary-hunt',
    title: 'Find the hole',
    icon: '◌',
    group: 'Topology',
    lesson: 'Lesson 3 — Mesh Topology and Welding',
    desc: 'A sphere with one face removed. It looks closed from most angles, and every watertightness test disagrees.',
    lang: 'js',
    code: `const ball = scene.addSphere({ radius: 1.4, segments: 24, rings: 12, name: 'Part' })

${REPORT}
log('as built:')
report(ball)

// Take out one face, somewhere on the far side.
ball.mesh.delete({ faces: [40] })

log('')
log('after deleting one face:')
const after = report(ball)

log('')
log('Euler changed and the boundary count is no longer zero. From most angles')
log('you cannot see the hole at all - which is why you count instead of looking.')
log('')
log('Colour every vertex by how far it is from the hole, so it is findable.')

// Geodesic distance from the vertices around the hole.
const open = ball.mesh.edges.filter((x) => x.faces.length === 1)
const ring = [...new Set(open.flatMap((x) => [x.a, x.b]))]
if (ring.length) ball.mesh.showField(ball.mesh.geodesic(ring), { label: 'distance from the hole' })
log('the hole has ' + ring.length + ' vertices around it')`,
    setup: { select: 'Part', tab: 'script', view: 'all' },
    guide: [
      'Orbit the part. The hole is hard to see and the numbers found it immediately.',
      'The heat map is geodesic distance — distance across the surface, not through space — from the ring of vertices around the hole.',
      step('Fill the hole (select the boundary loop in edit mode and press F). The boundary count returns to 0.',
        (e) => boundaryOf(e, 'Part') === 0),
      'Euler goes back to 2 as well. Those two numbers together are the whole watertightness test.',
    ],
  },

  // ── Measurement ─────────────────────────────────────────────────────────
  {
    id: 'nearest-and-why',
    title: 'Nearest corner is not nearest surface',
    icon: '⌖',
    group: 'Measurement',
    lesson: 'Lessons 5 to 9 — Point-to-Triangle and Point-to-Mesh',
    desc: 'A probe beside a surface, with every vertex coloured by its distance. The nearest vertex is easy to find and is not the answer.',
    lang: 'js',
    code: `const ball = scene.addSphere({ radius: 1.2, segments: 20, rings: 10, name: 'Surface' })

// A marker at the probe, so the thing being measured from is visible.
const probe = [1.9, 0.8, 0.3]
const marker = scene.addSphere({ radius: 0.06, segments: 8, rings: 6, name: 'Probe' })
marker.position.set(probe[0], probe[1], probe[2])

// The nearest VERTEX - a corner, not a point on the surface.
const i = ball.mesh.nearest(probe)
const corner = ball.mesh.verts[i].toArray()
const toCorner = Math.hypot(corner[0]-probe[0], corner[1]-probe[1], corner[2]-probe[2])

// For a sphere the true distance to the surface is known analytically, so the
// overshoot can be measured rather than argued about.
const fromCentre = Math.hypot(probe[0], probe[1], probe[2])
const toSurface = fromCentre - 1.2

log('probe              ', probe)
log('nearest vertex     ', i, 'at', corner.map((c) => +c.toFixed(3)))
log('distance to corner ', toCorner.toFixed(4))
log('distance to surface', toSurface.toFixed(4), '  (exact, for a sphere)')
log('overshoot          ', (100 * (toCorner - toSurface) / toSurface).toFixed(1) + '%')
log('')
log('That gap is why lessons 5 to 9 exist. Lesson 5 measured 11.8% on one')
log('triangle; the number here depends on how coarse the sphere is.')

const d = ball.mesh.verts.map((v) => {
  const p = v.toArray()
  return Math.hypot(p[0]-probe[0], p[1]-probe[1], p[2]-probe[2])
})
ball.mesh.showField(d, { label: 'distance to the probe' })`,
    setup: { select: 'Surface', tab: 'script', view: 'all' },
    guide: [
      'The log prints the overshoot: how much further the nearest corner is than the nearest point on the surface.',
      step('Refine the sphere (select it and subdivide, or raise `segments`). The overshoot shrinks — more corners means a corner is closer to the true surface.',
        (e) => vertsOf(e, 'Surface') > 210),
      'It shrinks and never reaches zero. A corner can only equal the surface distance when the nearest point happens to be a corner.',
      'Move the Probe marker and rerun. The overshoot changes with where you measure from, which is why lesson 5 sampled 40,000 probes instead of one.',
    ],
  },

  {
    id: 'deviation-field',
    title: 'Comparing two surfaces',
    icon: '⇄',
    group: 'Measurement',
    lesson: 'Lesson 10 — Signed Distance and Material Removal',
    desc: 'Two spheres, one slightly inside the other. Colour one by its distance to the other and the difference becomes a picture instead of a number.',
    lang: 'js',
    code: `// "Before" and "after": the same shape, one a little smaller in one region.
const after = scene.addSphere({ radius: 1.4, segments: 32, rings: 16, name: 'Finished' })

// Push a dent into one side, as a cut would.
for (const v of after.mesh.verts) {
  const p = v.toArray()
  const t = Math.exp(-6 * ((p[0] - 1.4) ** 2 + p[1] ** 2))
  v.set(p[0] * (1 - 0.06 * t), p[1] * (1 - 0.06 * t), p[2] * (1 - 0.06 * t))
}

// The deviation, with a sign: negative where material was removed.
const dev = after.mesh.verts.map((v) => {
  const p = v.toArray()
  return Math.hypot(p[0], p[1], p[2]) - 1.4
})

after.mesh.showField(dev, { label: 'signed deviation (in)' })

const worst = Math.min(...dev)
log('deepest cut    ', worst.toFixed(4))
log('largest raise  ', Math.max(...dev).toFixed(4))
log('vertices cut   ', dev.filter((d) => d < -1e-6).length, 'of', dev.length)
log('')
log('The sign is the whole point. Distance alone cannot tell removed from added,')
log('and lesson 10 measured that the nearest-normal sign test got it right on')
log('80,000 points out of 80,000 - convex and concave.')`,
    setup: { select: 'Finished', tab: 'script', view: 'all' },
    guide: [
      'The colour is a signed deviation: one direction is material removed, the other is material left on.',
      'Look at the legend. A diverging ramp has a meaningful middle — zero — which a hue ramp does not.',
      step('Change the dent depth (the `0.06` in the script) and rerun. The deepest-cut figure follows it.',
        (e, start) => {
          const now = e.scene.objects.find((o) => o.name === 'Finished')?.mesh;
          const was = start.obj('Finished')?.verts;
          if (!now || !was) return false;
          return now.verts.some((v, i) => was[i] && v.some((c, k) => Math.abs(c - was[i][k]) > 1e-4));
        }),
      'This is the input to every classification in lesson 11. Nothing is decided yet — a colour is not a verdict.',
    ],
  },

  // ── Classification ──────────────────────────────────────────────────────
  {
    id: 'threshold-decides',
    title: 'A threshold is a decision',
    icon: '⚖',
    group: 'Classification',
    lesson: 'Lesson 11 — Thresholds and Classification',
    desc: 'One deviation, five thresholds, five different answers. The part does not change between them.',
    lang: 'js',
    code: `const part = scene.addSphere({ radius: 1.5, segments: 36, rings: 18, name: 'Part' })

// A bump plus noise, standing in for a measured deviation.
let seed = 7
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const dev = part.mesh.verts.map((v) => {
  const p = v.toArray()
  const bump = 0.005 * Math.exp(-3 * ((p[0] - 1.5) ** 2 + p[1] ** 2))
  return bump + 0.0005 * (rand() - 0.5)
})

part.mesh.showField(dev, { label: 'deviation (in)' })

log('threshold   flagged   % of surface')
for (const t of [0.0005, 0.001, 0.002, 0.003, 0.005]) {
  const n = dev.filter((x) => x > t).length
  log(String(t).padEnd(11), String(n).padStart(7),
      (100 * n / dev.length).toFixed(1).padStart(13))
}

log('')
log('Five rows, five answers, one part. And the faceting floor sits under all')
log('of it: a 1 inch bore drawn with 32 facets is already 2.41 thou inside the')
log('true circle, which is more than twice a one-thou tolerance.')
log('')
log('So the question is never "what is the threshold". It is "what does a miss')
log('cost compared with a false alarm", and that is not a geometry question.')`,
    setup: { select: 'Part', tab: 'script', view: 'all' },
    guide: [
      'Read the table. Every row is a defensible answer, and they disagree by a factor of several.',
      'The heat map does not change between rows. Only the line you draw on it does.',
      // This step asks for a change to the SCRIPT, which shows up in the log
      // rather than in the scene. An earlier version compared the vertex count
      // against itself, so it ticked before the reader had done anything.
      step('Change the bump size (the `0.005`) in the script and run it again. Every row in the table moves — so the threshold you picked was about this part, not about parts.',
        (e, start) => e.log.length > start.log),
      'Lesson 11 measured the cost ratio moving the best threshold by a factor of two — 0.0014 at K=1, 0.0007 at K=100 — with no change to the geometry at all.',
    ],
  },

  // ── Editing ─────────────────────────────────────────────────────────────
  {
    id: 'split-without-cracking',
    title: 'Splitting a face without cracking the mesh',
    icon: '✄',
    group: 'Editing',
    lesson: 'Lesson 16B — Face Splitting and the Index Invariant',
    desc: 'Split every face and the rim doubles, which is not a crack. Split one face alone and three boundary edges appear out of nowhere.',
    lang: 'js',
    code: `const plate = scene.add.grid({ size: 4, subdivisions: 6, name: 'Plate' })

const count = (o) => {
  const e = o.mesh.edges
  return { f: o.mesh.faces.length, b: e.filter((x) => x.faces.length === 1).length }
}

let c = count(plate)
log('as built            faces', String(c.f).padStart(4), ' boundary', String(c.b).padStart(3))

// Split everything. Every neighbour is split too, so no interior edge gains a
// vertex only one side knows about.
plate.mesh.split()
const after = count(plate)
log('every face split    faces', String(after.f).padStart(4), ' boundary', String(after.b).padStart(3))
log('')
log('The boundary went from ' + c.b + ' to ' + after.b + ', and that is NOT a crack:')
log('every edge on the rim became two. A safe split doubles the rim exactly.')
log(after.b === c.b * 2 ? 'Exactly doubled: no interior crack.' : 'Not a clean doubling.')
log('')
log('On a closed solid the rim is zero, so any increase at all is a crack -')
log('which is what lesson 16B measured: a cut across a whole mesh added 2')
log('boundary edges, both on the rim, and a lone face split added 3.')`,
    setup: { select: 'Plate', tab: 'script', view: 'all' },
    guide: [
      'The boundary count doubled. That is the rim subdividing, not a hole opening.',
      step('Split the plate again. It doubles again — 24, 48, 96 — and still nothing cracks.',
        (e) => facesOf(e, 'Plate') > 144),
      'Now the one that does crack: select a single interior face and subdivide only that. Three new boundary edges appear, because its three neighbours were never told.',
      'That is a T-junction. Nothing errors, the area is unchanged, and it is a hairline you can see through.',
    ],
  },

  // ── Colour ──────────────────────────────────────────────────────────────
  {
    id: 'ramp-honesty',
    title: 'A ramp that invents boundaries',
    icon: '◐',
    group: 'Colour',
    lesson: 'Lesson 18 — Colour as Information',
    desc: 'A perfectly smooth scalar with no features in it at all. If the colours change unevenly, the eye finds edges that are not there.',
    lang: 'js',
    code: `const part = scene.addSphere({ radius: 1.4, segments: 48, rings: 24, name: 'Part' })

// A scalar that rises at a constant rate. There is nothing to find in it.
const t = part.mesh.verts.map((v) => (v.toArray()[0] + 1.4) / 2.8)
part.mesh.showField(t, { label: 'a straight ramp, 0 to 1' })

log('This scalar rises at exactly the same rate the whole way across.')
log('Look at the colours. Do they?')
log('')
log('Measured in lesson 18: on a hue ramp the perceived step varies 27.9x')
log('between its smallest and largest, so the eye finds boundaries at about')
log('12% and 81% of the range. A ramp built uniform in CIELAB varies 1.9x.')
log('')
log('And the total perceptual path: 455 for the rainbow against 102 for the')
log('uniform one. It spends four and a half times as much apparent variation')
log('on the same data, unevenly. Vividness is not information.')
log('')
log('Which matters because lesson 11 spent a whole lesson deciding where the')
log('tolerance boundary is, and a hue ramp then draws it somewhere else.')`,
    setup: { select: 'Part', tab: 'script', view: 'all' },
    guide: [
      'Orbit slowly. You will see bands. There are no bands in the data — it is a straight line from 0 to 1.',
      'Point at where you think the biggest jump is. Lesson 18 measured two, at 12.2% and 80.8% of the range.',
      step('Replace the ramp with something that does have a feature — `Math.abs(...)`, or a step — and rerun. Now the eye has a real edge to find, competing with the invented ones.',
        (e, start) => start.field !== (e.field ? JSON.stringify(e.field.spec) : null)),
      'The fix is not a better palette by eye. It is measuring the perceived step per data step and requiring it to be flat.',
    ],
  },
];

/**
 * Build a project on a new scene (the default cube removed, the sun kept) and
 * apply the parts of its setup that belong to the editor. Camera, panels and
 * playback are the UI's to apply.
 */
export function openProject(editor: Editor, p: ExampleProject, py?: PyodideLike): { error: string | null; output: string[] } {
  editor.newScene();
  for (const o of [...editor.scene.objects]) if (o.mesh) editor.scene.remove(o.id);
  if (p.setup.trace) editor.tracing = true;

  const r = p.lang === 'python'
    ? (py ? runPython(editor, p.code, py) : { error: 'Python is still loading', output: [] })
    : runScript(editor, p.code);

  if (!r.error && p.setup.select) {
    const o = editor.scene.objects.find((x) => x.name === p.setup.select);
    if (o) editor.selectObject(o.id);
  }
  if (!r.error && p.setup.frame !== undefined) {
    editor.scene.timeline.frame = p.setup.frame;
    editor.applyFrame();
  }
  return r;
}
