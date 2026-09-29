// Example scripts for the script panel. Each one is a small, complete idea;
// all of them are run by the tests, so they cannot quietly break.

/** The box-modelled character, shared by the modelling and rigging examples. */
export const CHARACTER = `// 1. Half a torso: a box from x = 0 to 0.6. The mirror makes the other half.
const body = scene.add.cube({ name: 'Character', size: 1 })
const m = body.mesh
for (const v of m.vertices) { v.x = v.x < 0 ? 0 : 0.6; v.y = v.y < 0 ? 0 : 1.2; v.z *= 0.6 }
m.delete({ faces: m.faces.facing([-1, 0, 0]) })        // open the seam on the mirror plane
body.modifiers.add('mirror', { axis: 'x' })

// 2. Two loop cuts: one down the middle of each half (for the leg),
//    one around the chest (for the arm).
m.loopCut(m.nearest([0, 0, -0.3]), m.nearest([0.6, 0, -0.3]), 0.5)
m.loopCut(m.nearest([0.6, 0, 0.3]), m.nearest([0.6, 1.2, 0.3]), 0.75)

// 3. Arm: the upper part of the side, out twice.
const shoulder = m.faces.where(f => f.normal[0] > 0.9 && f.center[1] > 0.9)
m.extrude(shoulder, 0.55).extrude(shoulder, 0.5)

// 4. Leg: the outer half of the torso's bottom (y = 0), straight down. (Without the height
//    test the arm's underside, which also faces down, would be pulled down with it.)
m.extrude(m.faces.where(f => f.normal[1] < -0.9 && f.center[0] > 0.3 && f.center[1] < 0.01), 1.1)

// 5. Neck and head: the inner half of the top.
const top = m.faces.where(f => f.normal[1] > 0.9 && f.center[0] < 0.3)
m.extrude(top, 0.12).extrude(top, 0.5)

// 6. Smooth it: Catmull–Clark on the mirrored cage.
body.modifiers.add('subsurf', { levels: 2 })
body.position.set(3, 1.1, 0)            // stand it beside anything already in the scene
log(m, '— the cage you edit; the modifiers show the full, smooth body')`;

export interface Example { id: string; title: string; about: string; code: string }

export const EXAMPLES: Example[] = [
  {
    id: 'vertices-are-data',
    title: 'Vertices are data',
    about: 'The specification\'s own test: make a cube, move it, then bend it by editing its vertex coordinates directly.',
    code: `// A cube is eight points and six faces. Change the numbers, change the shape.
const cube = scene.addCube({ size: 4, name: 'Wavy' })
cube.position.set(3, 0, 0)
cube.rotation.y = Math.PI / 4          // radians: a quarter of a half turn

cube.mesh.split()                       // more vertices to bend: each face into four
cube.mesh.split()
for (const v of cube.mesh.vertices) {
  v.y += 0.4 * Math.sin(2 * v.x)        // each vertex moves by a function of where it is
}
log(cube.mesh)                          // Mesh(… verts, … edges, … faces)
log('world matrix:', cube.worldMatrix)`,
  },
  {
    id: 'torus-by-hand',
    title: 'A torus from its equation',
    about: 'Build every vertex from the parametric equation of a torus and connect them into quads yourself.',
    code: `// Point on a torus: carry a small circle (radius r) around a big one (radius R).
//   x = (R + r cos φ) cos θ,   y = r sin φ,   z = (R + r cos φ) sin θ
const R = 1.4, r = 0.45, N = 36, M = 16
const verts = [], faces = []
for (let i = 0; i < N; i++) {
  const th = 2 * Math.PI * i / N
  for (let j = 0; j < M; j++) {
    const ph = 2 * Math.PI * j / M, d = R + r * Math.cos(ph)
    verts.push([d * Math.cos(th), r * Math.sin(ph), d * Math.sin(th)])
  }
}
const id = (i, j) => (i % N) * M + (j % M)
for (let i = 0; i < N; i++)
  for (let j = 0; j < M; j++)
    faces.push([id(i, j), id(i, j + 1), id(i + 1, j + 1), id(i + 1, j)])   // one quad per grid cell

const torus = scene.add.mesh({ name: 'Torus by hand', verts, faces })
torus.smooth = true
const s = torus.mesh.stats()
log('vertices', s.verts, 'faces', s.faces, 'Euler characteristic', s.euler, '(0 for a torus)')`,
  },
  {
    id: 'quad-sphere',
    title: 'A sphere from a cube',
    about: 'Subdivide a cube, then push every vertex out to the same distance from the centre: a sphere made only of quads.',
    code: `const ball = scene.add.cube({ name: 'Quad sphere', size: 2, position: [0, 0, -3] })
ball.mesh.subdivide(3)                   // Catmull–Clark, three times: 6 → 384 quads
for (const v of ball.mesh.vertices) {
  const len = Math.hypot(v.x, v.y, v.z)  // distance from the centre
  v.x /= len; v.y /= len; v.z /= len     // normalize: every vertex now at distance 1
}
ball.smooth = true
log(ball.mesh)`,
  },
  {
    id: 'terrain',
    title: 'A heightfield terrain',
    about: 'Lift each vertex of a grid by a function of its position: sums of sines make hills.',
    code: `const land = scene.add.grid({ name: 'Terrain', size: 8, subdivisions: 48, position: [0, -1, 0] })
const h = (x, z) => 0.6 * Math.sin(0.9 * x) * Math.cos(0.7 * z) + 0.25 * Math.sin(2.3 * x + 1.7 * z)
for (const v of land.mesh.vertices) v.y = h(v.x, v.z)
land.smooth = true
land.material.color = '#6fa56b'
log('highest point', Math.max(...land.mesh.vertices.map(v => v.y)).toFixed(3))`,
  },
  {
    id: 'staircase',
    title: 'A spiral staircase (hierarchy)',
    about: 'Every step is a child of one empty. Rotate the empty and the whole staircase turns: world = parent × local.',
    code: `const stair = scene.add.empty({ name: 'Staircase' })
for (let i = 0; i < 16; i++) {
  const step = scene.add.cube({ name: 'Step', size: 1 })
  step.parent = stair                     // local coordinates are now relative to the staircase
  step.scale.set(1.6, 0.15, 0.5)
  step.rotation.y = i * Math.PI / 8       // each step turns 22.5° more
  step.position.set(1.2 * Math.cos(-i * Math.PI / 8), i * 0.22, 1.2 * Math.sin(-i * Math.PI / 8))
}
stair.rotation.y = 0.5                    // try other values: every step follows
log(stair.children.length, 'steps')`,
  },
  {
    id: 'character',
    title: 'Box-model a character',
    about: 'Half a body, a mirror modifier for the other half, two loop cuts, extrusions for the arm, leg, neck and head, then subdivision to smooth it.',
    code: CHARACTER,
  },
  {
    id: 'buffers',
    title: 'What the GPU receives',
    about: 'A quad mesh is split into triangles and flattened into typed arrays: this is the data three.js uploads.',
    code: `const q = scene.add.plane({ name: 'One quad', size: 2, position: [0, 0, 3] })
const { positions, indices } = q.mesh.buffer()
log('faces in the model:', q.mesh.faces.length, '(a quad)')
log('positions (Float32Array, x y z per vertex):', Array.from(positions))
log('indices (Uint32Array, 3 per triangle):', Array.from(indices))
log('so the GPU draws', indices.length / 3, 'triangles')`,
  },
  {
    id: 'solar',
    title: 'Orbits (nested transforms)',
    about: 'A moon orbits a planet that orbits a sun: each rotation happens in its parent\'s frame.',
    code: `const sun = scene.add.uvSphere({ name: 'Sun', radius: 0.8, position: [0, 2.5, 0] })
sun.material.color = '#f5b942'
const orbit = scene.add.empty({ name: 'Planet orbit' }); orbit.parent = sun
const planet = scene.add.uvSphere({ name: 'Planet', radius: 0.3, segments: 16, rings: 8 }); planet.parent = orbit
planet.position.set(2.2, 0, 0)
const moon = scene.add.uvSphere({ name: 'Moon', radius: 0.1, segments: 12, rings: 6 }); moon.parent = planet
moon.position.set(0.55, 0, 0)
orbit.rotation.y = 1.0                    // move the planet along its orbit; the moon comes too
log('moon world matrix (column-major):', moon.worldMatrix.map(x => +x.toFixed(3)))`,
  },
  {
    id: 'curvature',
    title: 'Curvature you can check',
    about: 'Measure curvature and distance along the surface, compare them with the exact answers, then colour the mesh by them.',
    code: `// A sphere of radius r bends by 1/r in every direction:
// mean curvature H = 1/r, Gaussian curvature K = 1/r².
const r = 2
const ball = scene.add.uvSphere({ name: 'Ball', radius: r, segments: 48, rings: 24, position: [0, 2, 0] })
const H = ball.mesh.curvature('mean'), K = ball.mesh.curvature('gaussian')
const eq = ball.mesh.nearest([r, 0, 0])            // a vertex on the equator
log('H at the equator', H[eq].toFixed(4), ' exact', 1 / r)
log('K at the equator', K[eq].toFixed(4), ' exact', 1 / (r * r))

// Gauss–Bonnet: K × area, summed over any closed surface, is 2π × (V − E + F).
const { mass } = ball.mesh.laplacian()             // the area each vertex stands for
const total = K.reduce((s, k, i) => s + k * mass[i], 0)
log('Σ K·area =', total.toFixed(6), ' 4π =', (4 * Math.PI).toFixed(6), ' Euler', ball.mesh.stats().euler)

// Walking distance from the north pole is r × (the angle from the pole).
const pole = ball.mesh.nearest([0, r, 0])
const d = ball.mesh.geodesic(pole)
log('pole to equator', d[eq].toFixed(4), ' exact πr/2 =', (Math.PI * r / 2).toFixed(4))

ball.mesh.showField('geodesic', { from: pole })    // try 'mean', 'gaussian', or your own numbers`,
  },
  {
    id: 'rig-character',
    title: 'Rig and animate the character',
    about: 'The box-modelled character, an armature of ten bones, automatic weights, and a wave. Then Ctrl+Tab on the armature to pose it yourself.',
    code: CHARACTER.replace(/\nlog\(m, [^\n]*$/, '') + `

// 7. An armature: spine, head, two-bone arms and legs, left and right.
const bones = [
  { name: 'Spine', head: [0, 0, 0], tail: [0, 1.1, 0] },
  { name: 'Head', parent: 'Spine', head: [0, 1.2, 0], tail: [0, 1.8, 0] },
]
for (const [side, s] of [['L', 1], ['R', -1]]) bones.push(
  { name: \`UpperArm.\${side}\`, parent: 'Spine', head: [0.6 * s, 1.05, 0], tail: [1.1 * s, 1.05, 0] },
  { name: \`Forearm.\${side}\`, parent: \`UpperArm.\${side}\`, head: [1.1 * s, 1.05, 0], tail: [1.65 * s, 1.05, 0] },
  { name: \`Thigh.\${side}\`, parent: 'Spine', head: [0.45 * s, 0, 0], tail: [0.45 * s, -0.55, 0] },
  { name: \`Shin.\${side}\`, parent: \`Thigh.\${side}\`, head: [0.45 * s, -0.55, 0], tail: [0.45 * s, -1.1, 0] },
)
const rig = scene.add.armature({ name: 'Rig', bones, position: [3, 1.1, 0] })   // same place as the body
body.bindTo(rig)      // automatic weights: heat spreading over the skin from each bone

// 8. A wave: each key is a bone rotation (radians, about the bone's own axes).
scene.setTimeline({ start: 1, end: 48 })
rig.bone('UpperArm.L').keyframe(1, { rotation: [0, 0, -0.9] }).keyframe(24, { rotation: [0, 0, 0.6] }).keyframe(48, { rotation: [0, 0, -0.9] })
rig.bone('Forearm.L').keyframe(1, { rotation: [0, 0, 0.2] }).keyframe(24, { rotation: [0, 0, 0.9] }).keyframe(48, { rotation: [0, 0, 0.2] })
rig.bone('Thigh.R').keyframe(1, { rotation: [0.4, 0, 0] }).keyframe(24, { rotation: [-0.4, 0, 0] }).keyframe(48, { rotation: [0.4, 0, 0] })
log(body.skin.bones.length, 'bones weighted over', body.skin.verts, 'vertices. Space plays it; Heat map › Bone weights shows the weights.')`,
  },
  {
    id: 'euler-vs-slerp',
    title: 'Euler vs quaternion rotation',
    about: 'Two boxes, the same two rotation keys. One interpolates Euler angles, the other slerps quaternions. Press Space and watch them part.',
    code: `scene.setTimeline({ start: 1, end: 72, fps: 24 })
const make = (name, x, mode) => {
  const b = scene.add.cube({ name, size: 1, position: [x, 1, -3] })
  b.scale = [1.6, 0.3, 0.8]                       // a flat box, so its orientation is easy to read
  b.keyframe(1, { rotation: [0, 0, 0], interp: 'linear' })
  b.keyframe(72, { rotation: [Math.PI / 2, Math.PI / 2, 0] })   // a quarter turn about x, then about y
  b.rotationMode = mode
  return b
}
const e = make('Euler', -1.5, 'euler'), q = make('Slerp', 1.5, 'quaternion')
e.material.color = '#5aa9ff'; q.material.color = '#ff9f1c'

// Both start and end in the same pose. In between they differ:
const mid = 36
log('Euler angles at frame 36:', e.sample(mid).rotation.map(a => +(a * 180 / Math.PI).toFixed(1)))
log('Slerp angles at frame 36:', q.sample(mid).rotation.map(a => +(a * 180 / Math.PI).toFixed(1)))
log('The two quarter turns combine into one 120° turn; slerp takes it along the shortest arc, at even speed.')`,
  },
];

/** The same ideas in Python (run through Pyodide). Keyword arguments are the options object: size=2 is { size: 2 }. */
export const PY_EXAMPLES: Example[] = [
  {
    id: 'py-vertices-are-data',
    title: 'Vertices are data',
    about: 'Make a cube, move it, then bend it by changing its vertex coordinates. Try Step through and watch each line.',
    code: `# A cube is eight points and six faces. Change the numbers, change the shape.
cube = scene.add.cube(size=4, name='Wavy')
cube.position = (3, 0, 0)
cube.rotation.y = pi / 4                # radians: a quarter of a half turn

cube.mesh.split()                       # more vertices to bend: each face into four
cube.mesh.split()
for v in cube.mesh.verts:
    v.y += 0.4 * math.sin(2 * v.x)      # each vertex moves by a function of where it is

print(cube.mesh)`,
  },
  {
    id: 'py-stairs',
    title: 'A staircase, step by step',
    about: 'A loop that adds one step per pass. Step through it to see the loop variable and the scene change together.',
    code: `steps = 6
for i in range(steps):
    s = scene.add.cube(name=f'Step {i}', size=1)
    s.scale = (2, 0.3, 0.8)
    s.position = (4, 0.15 + 0.3 * i, -2 + 0.8 * i)
    s.material.color = f'hsl({30 + 20 * i}, 70%, 55%)'
print(steps, 'steps, total height', round(0.3 * steps, 2))`,
  },
  {
    id: 'py-curvature',
    title: 'Curvature you can check',
    about: 'Mean and Gaussian curvature of a sphere against 1/r and 1/r², Gauss–Bonnet, and distance along the surface.',
    code: `r = 2
ball = scene.add.uvSphere(name='Ball', radius=r, segments=48, rings=24, position=[0, 2, 0])
H = ball.mesh.curvature('mean')
K = ball.mesh.curvature('gaussian')
eq = ball.mesh.nearest([r, 0, 0])       # a vertex on the equator
print('H at the equator', round(H[eq], 4), ' exact', 1 / r)
print('K at the equator', round(K[eq], 4), ' exact', 1 / r**2)

mass = ball.mesh.laplacian().mass       # the area each vertex stands for
total = sum(k * a for k, a in zip(K, mass))
print('sum of K * area', round(total, 6), ' 4 pi =', round(4 * pi, 6))

pole = ball.mesh.nearest([0, r, 0])
d = ball.mesh.geodesic(pole)
print('pole to equator', round(d[eq], 4), ' exact', round(pi * r / 2, 4))
ball.mesh.showField('geodesic', source=pole)   # 'from' is a Python keyword, so: source`,
  },
];
