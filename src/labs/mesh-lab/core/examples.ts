// Example scripts for the script panel. Each one is a small, complete idea;
// all of them are run by the tests, so they cannot quietly break.

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
    code: `// 1. Half a torso: a box from x = 0 to 0.6. The mirror makes the other half.
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

// 4. Leg: the outer half of the bottom, straight down.
m.extrude(m.faces.where(f => f.normal[1] < -0.9 && f.center[0] > 0.3), 1.1)

// 5. Neck and head: the inner half of the top.
const top = m.faces.where(f => f.normal[1] > 0.9 && f.center[0] < 0.3)
m.extrude(top, 0.12).extrude(top, 0.5)

// 6. Smooth it: Catmull–Clark on the mirrored cage.
body.modifiers.add('subsurf', { levels: 2 })
body.position.set(3, 1.1, 0)            // stand it beside anything already in the scene
log(m, '— the cage you edit; the modifiers show the full, smooth body')`,
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
];
