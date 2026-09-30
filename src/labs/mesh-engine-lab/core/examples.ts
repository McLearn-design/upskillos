// Script-panel examples for the Mesh Engine lab.
//
// Each one pairs with a lesson in the mesh-engine course and is short enough to
// read in one go. They are not demonstrations of the lab: they are the lesson's
// own measurement, run against geometry you can change.
//
// MeshLab's examples are about making geometry. These are about finding out what
// geometry already is, which is the whole difference between the two labs.

export interface Example { id: string; title: string; about: string; code: string }

export const EXAMPLES: Example[] = [
  {
    id: 'cube-from-numbers',
    title: 'A cube is eight points and twelve triangles',
    about: 'Lesson 1. Build a cube by naming every vertex and every triangle, then count the edges — a closed solid shares every edge between exactly two faces.',
    code: `// Eight corners of a cube, written out. Nothing is generated.
const V = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],   // z = -1
  [-1, -1,  1], [1, -1,  1], [1, 1,  1], [-1, 1,  1],   // z = +1
]

// Twelve triangles, two per face. The ORDER of each triple decides which way
// the normal points, and the normal is how a renderer knows inside from out.
const F = [
  [0, 1, 5], [0, 5, 4],   // front   y = -1
  [1, 2, 6], [1, 6, 5],   // right   x = +1
  [2, 3, 7], [2, 7, 6],   // back    y = +1
  [3, 0, 4], [3, 4, 7],   // left    x = -1
  [4, 5, 6], [4, 6, 7],   // top     z = +1
  [0, 3, 2], [0, 2, 1],   // bottom  z = -1   <- note the order reverses
]

const cube = scene.add.mesh({ verts: V, faces: F, name: 'Cube by hand' })
log('verts', cube.mesh.verts.length, ' faces', cube.mesh.faces.length)

// An edge is shared by exactly two faces in a closed solid. Count the ones
// that are not, because those are the holes.
const edges = cube.mesh.edges
const boundary = edges.filter((e) => e.faces.length === 1).length
const weird = edges.filter((e) => e.faces.length > 2).length
log('edges', edges.length, ' boundary', boundary, ' non-manifold', weird)
log('Euler V - E + F =', cube.mesh.verts.length - edges.length + cube.mesh.faces.length)
log(boundary === 0 ? 'closed' : 'open - there are holes')`,
  },

  {
    id: 'welded-or-exploded',
    title: 'Two cubes that look identical',
    about: 'Lesson 3. The same shape stored two ways: eight shared corners, or thirty-six separate ones. They draw the same and behave completely differently.',
    code: `// Left: corners shared between faces. Right: every triangle gets its own.
const V = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]
const F = [[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],
           [3,0,4],[3,4,7],[4,5,6],[4,6,7],[0,3,2],[0,2,1]]

const welded = scene.add.mesh({ verts: V, faces: F, name: 'Welded' })
welded.position.set(-2.5, 0, 0)

// Exploded: rebuild with a fresh copy of every corner, so nothing is shared.
const eV = [], eF = []
for (const f of F) {
  eF.push([eV.length, eV.length + 1, eV.length + 2])
  for (const i of f) eV.push([...V[i]])
}
const exploded = scene.add.mesh({ verts: eV, faces: eF, name: 'Exploded' })
exploded.position.set(2.5, 0, 0)

const report = (o) => {
  const m = o.mesh, e = m.edges
  log(o.name.padEnd(9),
      'verts', String(m.verts.length).padStart(2),
      ' edges', String(e.length).padStart(2),
      ' boundary', String(e.filter((x) => x.faces.length === 1).length).padStart(2),
      ' Euler', m.verts.length - e.length + m.faces.length)
}
report(welded)
report(exploded)

// Now weld the exploded one. Every number changes; the picture does not.
exploded.mesh.weld(1e-6)
log('--- after welding the right-hand one ---')
report(exploded)`,
  },

  {
    id: 'nearest-vertex',
    title: 'How far is this point from that surface',
    about: 'Lessons 5 to 9. Ask which vertex is nearest a probe, then colour every vertex by its distance — the same number the solver returns, computed everywhere at once.',
    code: `const ball = scene.addSphere({ radius: 1.2, segments: 24, rings: 12, name: 'Surface' })

const P = [1.8, 0.9, 0.4]          // a point in space, off the surface

// nearest() returns the INDEX of the closest vertex, not a point on the surface.
// Those are different answers - lesson 5 measured the nearest corner overshooting
// the true distance by 11.8% on one triangle.
const i = ball.mesh.nearest(P)
const q = ball.mesh.verts[i].toArray()
log('probe          ', P)
log('nearest vertex ', i, 'at', q)
log('distance to it ', Math.hypot(q[0]-P[0], q[1]-P[1], q[2]-P[2]).toFixed(4))
log('')
log('That is the distance to a CORNER. The distance to the surface is smaller,')
log('and finding it is what lessons 5 to 9 are about.')

// Colour every vertex by its distance to the probe.
const d = ball.mesh.verts.map((v) => {
  const p = v.toArray()
  return Math.hypot(p[0] - P[0], p[1] - P[1], p[2] - P[2])
})
ball.mesh.showField(d, { label: 'distance to the probe' })
log('closest', Math.min(...d).toFixed(4), ' furthest', Math.max(...d).toFixed(4))`,
  },

  {
    id: 'threshold-live',
    title: 'A threshold is a decision',
    about: 'Lesson 11. Colour a deviation, then count what each threshold flags. The count moves and the part does not — that is the whole lesson.',
    code: `const part = scene.addSphere({ radius: 1.5, segments: 32, rings: 16, name: 'Part' })

// Stand in for a measured deviation: a bump on one side, plus a little noise.
let seed = 7
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const dev = part.mesh.verts.map((v) => {
  const p = v.toArray()
  const bump = 0.004 * Math.exp(-4 * ((p[0] - 1.5) ** 2 + p[1] ** 2))
  return bump + 0.0004 * (rand() - 0.5)
})

part.mesh.showField(dev, { label: 'deviation (in)' })

log('threshold   flagged   % of surface')
for (const t of [0.0005, 0.001, 0.002, 0.003, 0.005]) {
  const n = dev.filter((x) => x > t).length
  log(String(t).padEnd(11), String(n).padStart(7),
      (100 * n / dev.length).toFixed(1).padStart(13))
}
log('')
log('Nothing about the part changed between those rows. A threshold does not')
log('find defects - it chooses which kind of mistake to make.')`,
  },

  {
    id: 'split-and-count',
    title: 'Splitting faces, and what it costs',
    about: 'Lesson 16B. Split every face and watch the boundary edge count. A split that cracks the mesh looks identical and changes every watertightness test.',
    code: `const plate = scene.add.grid({ size: 4, subdivisions: 6, name: 'Plate' })

const count = (o) => {
  const e = o.mesh.edges
  return { faces: o.mesh.faces.length, boundary: e.filter((x) => x.faces.length === 1).length }
}

const before = count(plate)
log('before      faces', String(before.faces).padStart(4),
    ' boundary', String(before.boundary).padStart(3))

// Split every face. Every neighbour is split too, so no interior edge gains a
// vertex that only one side knows about - which is what a T-junction is.
plate.mesh.split()
const after = count(plate)
log('after split faces', String(after.faces).padStart(4),
    ' boundary', String(after.boundary).padStart(3))
log('')

// The boundary is NOT unchanged, and that is not a crack. Every edge on the
// plate's rim became two, so a safe split doubles the rim exactly. Lesson 16B
// measured the same thing: a cut running right across a mesh added boundary
// edges only on the rim, and none in the interior.
const expected = before.boundary * 2
log('rim edges before ', before.boundary)
log('rim edges after  ', after.boundary, ' - each one became two, so expect', expected)
log('')
log(after.boundary === expected
  ? 'Exactly the rim doubled: no interior crack.'
  : 'Off by ' + (after.boundary - expected) + ' - that is ' +
    Math.abs(after.boundary - expected) + ' interior crack(s).')
log('')
log('So the question is never "did the boundary change". It is whether it changed')
log('by MORE than the rim accounts for. On a closed solid the rim is zero and any')
log('increase at all is a crack.')`,
  },

  {
    id: 'ramp-honesty',
    title: 'A ramp that lies about where the edges are',
    about: 'Lesson 18. Colour a perfectly smooth scalar. If the colours change unevenly, the eye finds boundaries the data does not contain.',
    code: `const part = scene.addSphere({ radius: 1.4, segments: 40, rings: 20, name: 'Part' })

// A perfectly smooth scalar: no edges, no features, nothing to find.
const t = part.mesh.verts.map((v) => (v.toArray()[0] + 1.4) / 2.8)   // 0 to 1

part.mesh.showField(t, { label: 'a straight ramp, 0 to 1' })

log('The scalar rises at a constant rate from one side to the other.')
log('Look at the colours. Do they change at a constant rate?')
log('')
log('Measured on a hue ramp, the perceived step varies 27.9x between its')
log('smallest and largest - so the eye finds edges at about 12% and 81% of the')
log('range that are not in this data at all. A ramp built uniform in CIELAB')
log('varies 1.9x.')
log('')
log('Which is why a deviation plot coloured by hue puts the tolerance boundary')
log('somewhere the threshold is not.')`,
  },
]

export const PY_EXAMPLES: Example[] = [
  {
    id: 'py-topology',
    title: 'Count the edges yourself',
    about: 'Lesson 3, in Python. Build the edge table from the face list and find the boundary — the same arithmetic the lesson does with numpy.',
    code: `# A cube, as twelve triangles over eight shared corners.
V = [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]
F = [(0,1,5),(0,5,4),(1,2,6),(1,6,5),(2,3,7),(2,7,6),
     (3,0,4),(3,4,7),(4,5,6),(4,6,7),(0,3,2),(0,2,1)]

# An edge is an unordered pair, so sort it before using it as a key. Forget that
# and (a,b) and (b,a) look like two edges, so nothing is ever shared.
edges = {}
for f in F:
    for u, v in ((f[0], f[1]), (f[1], f[2]), (f[2], f[0])):
        edges.setdefault((min(u, v), max(u, v)), []).append(f)

boundary = [e for e, fs in edges.items() if len(fs) == 1]
weird    = [e for e, fs in edges.items() if len(fs) > 2]

print('verts', len(V), 'edges', len(edges), 'faces', len(F))
print('boundary edges  ', len(boundary))
print('non-manifold    ', len(weird))
print('Euler V - E + F ', len(V) - len(edges) + len(F))
print()
print('Euler 2 with no boundary is a closed solid of one piece.')`,
  },
  {
    id: 'py-threshold',
    title: 'False positives against false negatives',
    about: 'Lesson 11, in Python. Two kinds of mistake moving in opposite directions, on data whose truth is known by construction.',
    code: `import random
random.seed(3)

# 2000 measurements whose truth we know: 8% are really out of tolerance.
truth, measured = [], []
for _ in range(2000):
    bad = random.random() < 0.08
    truth.append(bad)
    dev = random.uniform(0.002, 0.012) if bad else random.uniform(0, 0.002)
    measured.append(dev - 0.0012 + random.gauss(0, 0.0003))   # bias, then noise

print(f"{'threshold':>10} {'flagged':>8} {'false pos':>10} {'false neg':>10}")
for t in (0.0000, 0.0005, 0.0010, 0.0015, 0.0020, 0.0050):
    flagged = [m > t for m in measured]
    fp = sum(1 for f, b in zip(flagged, truth) if f and not b)
    fn = sum(1 for f, b in zip(flagged, truth) if not f and b)
    print(f'{t:>10.4f} {sum(flagged):>8} {fp:>10} {fn:>10}')

print()
print('There is no row where both are zero. A threshold does not find defects -')
print('it chooses which kind of mistake to make.')`,
  },
]
