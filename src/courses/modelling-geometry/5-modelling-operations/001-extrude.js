// Lesson 5.1: extrude. A region of faces is copied a distance along its average normal, and a wall is built on
// each of its border edges, wound so it faces out like its neighbours. Inner edges get no wall.
import { withPicture } from '../notebookScene.js';

// A flat 3 × 3 grid, 3 wide, like MeshLab's: 16 vertices in a 4 × 4 lattice and 9 square faces, all facing up.
const GRID = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const f3 = (v) => v.map(r).join(', ')
const verts = [], faces = []
for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) verts.push([i - 1.5, 0, j - 1.5])
for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) faces.push([i * 4 + j, i * 4 + j + 1, (i + 1) * 4 + j + 1, (i + 1) * 4 + j])
const sub = (a, b) => a.map((x, i) => x - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l) }
// A face's cross products, summed over a fan of triangles: its normal times twice its area (lesson 3.5).
function areaNormal(vs, face) {
  let s = [0, 0, 0]
  for (let i = 1; i + 1 < face.length; i++) s = s.map((x, j) => x + cross(sub(vs[face[i]], vs[face[0]]), sub(vs[face[i + 1]], vs[face[0]]))[j])
  return s
}
const edgeKey = (a, b) => a < b ? a + '-' + b : b + '-' + a
// The region: face 4 (the middle) and face 7 next to it. They share one edge.
const region = [4, 7], d = 0.5
`;

const NORMAL = `${GRID}
// Step 1. Each face votes with its normal, weighted by its area. The sum, made unit length, is the direction.
let sum = [0, 0, 0]
for (const fi of region) {
  const an = areaNormal(verts, faces[fi])
  console.log('face ' + fi + ': normal ' + f3(unit(an)) + ', area ' + r(Math.hypot(...an) / 2))
  sum = sum.map((x, j) => x + an[j] / 2)
}
console.log('the region moves along n = ' + f3(unit(sum)))

// A region that bends: the top (2 × 1, area 2) and the right end (1 × 1, area 1) of a box 2 long.
// Predict first: does it move straight between them (45°), or closer to up?
const box = [[0, 0, 0], [2, 0, 0], [2, 1, 0], [0, 1, 0], [0, 0, 1], [2, 0, 1], [2, 1, 1], [0, 1, 1]]
const top = [3, 7, 6, 2], end = [1, 2, 6, 5]
const both = [top, end].map((f) => areaNormal(box, f)).reduce((a, b) => a.map((x, j) => x + b[j]))
const n = unit(both)
console.log('top + end, area-weighted: n = ' + f3(n) + ', ' + r(Math.acos(n[1]) * 180 / Math.PI) + '° from up')`;

const COPY = `${GRID}
const n = [0, 1, 0]
// Step 2. One copy of every vertex the region touches, each v' = v + d n. A vertex on two faces is copied once.
const moved = new Map()
for (const fi of region) for (const v of faces[fi]) {
  if (moved.has(v)) continue
  moved.set(v, verts.length)
  verts.push(verts[v].map((x, j) => x + d * n[j]))
}
console.log('corners on the region\\'s faces: ' + region.map((fi) => faces[fi].length).reduce((a, b) => a + b))
console.log('new vertices: ' + moved.size)
for (const [v, c] of moved) console.log('v' + v + ' (' + f3(verts[v]) + ') → v' + c + ' (' + f3(verts[c]) + ')')`;

const BORDER = `${GRID}
// Step 3. Count how many region faces use each edge. Once: on the border, it gets a wall. Twice: inside, no wall.
const uses = new Map()
for (const fi of region) {
  const f = faces[fi]
  for (let i = 0; i < f.length; i++) { const k = edgeKey(f[i], f[(i + 1) % f.length]); uses.set(k, (uses.get(k) || 0) + 1) }
}
const border = [...uses].filter(([, c]) => c === 1).map(([k]) => k)
const inner = [...uses].filter(([, c]) => c === 2).map(([k]) => k)
console.log('border edges (' + border.length + '): ' + border.join(', '))
console.log('inner edges (' + inner.length + '): ' + inner.join(', '))
console.log('two faces have 8 edges between them, but the shared one is counted twice: 4 + 4 − 1 = 7 edges')`;

// The whole operation, used by cells 4 and 5.
const EXTRUDE = `${GRID}
function extrude(region, d) {
  let s = [0, 0, 0]
  for (const fi of region) s = s.map((x, j) => x + areaNormal(verts, faces[fi])[j])
  const n = unit(s)
  const rings = region.map((fi) => faces[fi].slice())
  const moved = new Map()
  for (const ring of rings) for (const v of ring) if (!moved.has(v)) { moved.set(v, verts.length); verts.push(verts[v].map((x, j) => x + d * n[j])) }
  const uses = new Map()
  for (const ring of rings) for (let i = 0; i < ring.length; i++) { const k = edgeKey(ring[i], ring[(i + 1) % ring.length]); uses.set(k, (uses.get(k) || 0) + 1) }
  // Step 4. The region's faces move to the copies, keeping their order, so they still face the same way.
  region.forEach((fi, i) => { faces[fi] = rings[i].map((v) => moved.get(v)) })
  // Step 5. A wall on each border edge: walk it the way its own face does (a to b), then up (b', a').
  const walls = []
  for (const ring of rings) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length]
    if (uses.get(edgeKey(a, b)) !== 1) continue
    walls.push(faces.length)
    faces.push([a, b, moved.get(b), moved.get(a)])
  }
  return { n, walls }
}
function stats() {
  const edges = new Set()
  for (const f of faces) for (let i = 0; i < f.length; i++) edges.add(edgeKey(f[i], f[(i + 1) % f.length]))
  const used = new Set(faces.flat())
  return { V: used.size, E: edges.size, F: faces.length }
}
`;

const WALLS = `${EXTRUDE}
const before = stats()
const { walls } = extrude(region, d)
const after = stats()
// Each wall should face out of the region: away from the region's middle, (0.5, 0.25, 0) after the lift.
const middle = [0.5, 0.25, 0]
for (const w of walls) {
  const f = faces[w], nw = unit(areaNormal(verts, f))
  const c = f.map((v) => verts[v]).reduce((a, b) => a.map((x, j) => x + b[j] / 4), [0, 0, 0])
  console.log('wall [' + f.join(', ') + ']: normal ' + f3(nw) + (dot(nw, sub(c, middle)) > 0 ? ', out' : ', IN'))
}
for (const [name, s] of [['before', before], ['after', after]]) console.log(name + ': V ' + s.V + ', E ' + s.E + ', F ' + s.F + ', V − E + F = ' + (s.V - s.E + s.F))`;

const PICTURE = withPicture(`${EXTRUDE}
const top = region.slice()
const { n, walls } = extrude(region, d)
// Colours: the grid blue, the lifted faces amber, the walls green. Flat shading: each face its own normal.
const groups = faces.map((f, i) => top.includes(i) ? 1 : walls.includes(i) ? 2 : 0)
const flat = faces.map((f) => f.map(() => unit(areaNormal(verts, f))))
// What smooth shading would do at a top corner: the cap and two walls averaged by area (lesson 3.5).
const corner = faces[top[0]][0], round = faces.filter((f) => f.includes(corner))
const smooth = unit(round.map((f) => areaNormal(verts, f)).reduce((a, b) => a.map((x, j) => x + b[j])))
console.log('corner v' + corner + ': smooth normal ' + f3(smooth) + ', ' + r(Math.acos(smooth[1]) * 180 / Math.PI) + '° off the cap\\'s (0, 1, 0)')
show({ verts, faces, groups, shading: flat, zoom: 2 })`);

const CHALLENGE = `// A 4 × 4 grid. You select the 2 × 2 block of faces in its middle and extrude it.
// How many new vertices, how many walls, and how many inner edges (edges with no wall)?
const answer = { verts: 0, walls: 0, inner: 0 }
console.log(answer)`;

const SOLVED = CHALLENGE.replace('const answer = { verts: 0, walls: 0, inner: 0 }', 'const answer = { verts: 9, walls: 8, inner: 4 }');

/** The challenge's check: a 2 × 2 block of faces extruded: 9 new vertices, 8 walls, 4 inner edges. */
export function checkBlock(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+answer\s*=\s*\{([^}]*)\}/);
  if (!m) return no('Keep the line const answer = { verts: …, walls: …, inner: … }.');
  const get = (k) => { const g = m[1].match(new RegExp(k + '\\s*:\\s*(-?\\d+(?:\\.\\d+)?)')); return g ? Number(g[1]) : NaN; };
  const verts = get('verts'), walls = get('walls'), inner = get('inner');
  if ([verts, walls, inner].some(Number.isNaN)) return no('Give all three as numbers: verts, walls and inner.');
  if (verts === 16) return no('16 counts each face\'s 4 corners separately. Neighbouring faces share corners, and a shared corner is copied once (Step 2): a 2 × 2 block has a 3 × 3 lattice of corners.');
  if (verts !== 9) return no(`The block's corners form a 3 × 3 lattice, so ${verts} is not the number of new vertices.`);
  if (walls === 16) return no('16 is every face\'s 4 edges. An edge shared by two selected faces is inside the region and gets no wall (Step 3).');
  if (walls === 12) return no('12 is the number of distinct edges in the block. Only the border ones get walls: round the outside of a 2 × 2 square, 2 per side.');
  if (walls !== 8) return no(`The border of a 2 × 2 block has 2 edges per side; ${walls} is not that.`);
  if (inner !== 4) return no(`The block has 12 distinct edges and 8 are on the border, so ${inner} is not the number inside.`);
  return { pass: true, message: '9 new vertices (a 3 × 3 lattice, each shared corner copied once), 8 walls (2 per side of the border) and 4 inner edges (the cross in the middle), which get no wall. 4 faces × 4 edges = 16 = 8 border + 2 × 4 inner.' };
}

export default {
  id: 'modelling-geometry-5-001',
  slug: 'extrude',
  chapter: 'modelling-geometry',
  order: 1,
  title: 'Extrude',
  subtitle: 'Copy a region of faces along its average normal and build a wall on each border edge.',
  tags: ['extrude', 'normals', 'topology', 'boundary', 'winding', 'modelling'],
  coreConcept: 'Extrude moves a region of faces a distance along one direction, the area-weighted average of their normals. Every vertex the region touches is copied once; the region\'s faces move to the copies; and each border edge (used by one selected face) gets a quad wall, walked the way its face walks it and then up, so it faces outward. Inner edges, shared by two selected faces, get no wall. The surface stays the same kind of surface: V − E + F does not change.',
  prerequisites: ['modelling-geometry-4-007', 'modelling-geometry-3-005'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-5-002',

  hook: {
    question: 'Press E on a face and it rises out of the surface, with walls round it. Where did those walls come from, and why are there no walls between two faces you extrude together?',
    realWorldContext: 'Extrude is the most used modelling operation in Blender, Maya and 3ds Max: crates, buildings, limbs and panel lines all start as a face pulled out of a surface. CAD calls it a "pad" or "boss"; it is the same idea.',
  },

  intuition: {
    prose: [
      'Start with a flat $3 \\times 3$ grid. Select two neighbouring faces in the middle and extrude them $0.5$ up. Three things happen: the two faces lift, a copy of each of their corners appears $0.5$ higher, and walls join the lifted faces to the grid.',
      'First, **which way is up?** For one face it is the face\'s normal. For a region, each face votes with its normal, weighted by its area (lesson 3.5), and the sum is made unit length. A big face counts for more than a sliver.',
      'Before running cell 1, predict: a region made of the top of a box (area $2$, facing up) and its end (area $1$, facing $+x$). Does it move at $45°$, straight between them?',
      'No. The sum is $2(0,1,0) + 1(1,0,0) = (1, 2, 0)$, unit length $(0.4472, 0.8944, 0)$: $26.57°$ from up, closer to the bigger face.',
      'Second, **copies**. Every vertex the region touches gets one copy, moved $d$ along $n$: $v\' = v + d\\,n$. Two square faces have $8$ corners between them, but they share $2$, so there are $6$ copies, not $8$. A shared vertex copied twice would tear the lifted region apart.',
      'Third, **walls**. Count how many selected faces use each edge. An edge used once is on the **border** of the region: it gets a wall. An edge used twice is **inside**: both its faces moved up together, so there is no gap there and no wall. Two faces have $4 + 4 - 1 = 7$ edges: $6$ border and $1$ inner.',
      'Before running cell 4, predict: how many faces does the grid have after extruding the pair? It had $9$; the $2$ lifted faces are the same faces, moved; and $6$ walls are added: $15$.',
      'The wall on border edge $a \\to b$ is the quad $[a, b, b\', a\']$: walk the edge in the direction its own face walks it, then up the copy of $b$, back along the top, and down. That order gives the wall the same winding as the faces around it, so its normal points out of the region (cell 4 checks every wall).',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Extrude a region of faces',
        body: 'Step 1. n = unit(Σ area × normal) over the selected faces.\nStep 2. For each vertex the region touches, once: add v′ = v + d n.\nStep 3. Count how many selected faces use each edge: once means border, twice means inner.\nStep 4. Move each selected face to the copies of its vertices, in the same order.\nStep 5. For each border edge a → b, in its own face\'s order: add the wall [a, b, b′, a′].',
      },
      {
        type: 'warning',
        title: 'Separate pieces move separately',
        body: 'If the selection is in pieces that do not share an edge (opposite sides of a box), MeshLab and Blender extrude each piece along its own normal. One average for the whole selection could be nothing: the six sides of a box sum to (0, 0, 0).',
      },
      {
        type: 'warning',
        title: 'Extrude by 0 leaves hidden faces',
        body: 'An extrude cancelled with the mouse still ran: it added copies on top of the originals and walls of zero area. They are invisible, but they break shading, counts and later operations. Undo instead, or weld by distance (lesson 1.6).',
      },
      {
        type: 'insight',
        title: 'The graphics strand: the shading of the new walls',
        body: 'Each wall is at right angles to the face that moved, so with flat shading it gets its own normal and a crisp edge. With smooth shading, a top corner averages the cap and two walls into one normal tilted 35° off the cap (cell 5), and the light smears round the rim: the reason to use auto smooth (lesson 3.5), or a bevel (lesson 5.4).',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "extrude just moves the faces". The amber faces moved; the green walls are new faces, built only round the outside of the pair; there is none between the two amber faces. Invariant: the walls close the gap exactly, so the surface stays in one piece.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'extrude() in cell 4 is the procedure: s and n are Step 1, moved is Step 2, uses is Step 3, the forEach is Step 4, and walls is Step 5.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'The GPU sees only the new triangle list: each wall quad is two triangles, with its own flat normal, or a shared vertex normal if the mesh is smooth.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'In edit mode with faces selected, E extrudes and lets you drag; Mesh › Extrude does the same. With Record traces on, the trace walks the same five steps, and asks you to predict where one copied vertex goes. Scripts call mesh.extrude(faces, distance).' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: extrude a region',
        caption: 'The average normal, the copied vertices, the border edges, the walls, and the result drawn.',
        props: {
          lesson: {
            title: 'Extrude',
            subtitle: 'Copy, lift, and build walls on the border.',
            cells: [
              { type: 'js', instruction: '### 1. Which way is up?\nPredict first: the top (area 2) and end (area 1) of a box. Does the pair move at 45°?', startCode: NORMAL },
              { type: 'js', instruction: '### 2. Copy each vertex once\nTwo faces, 8 corners: how many copies?', startCode: COPY },
              { type: 'js', instruction: '### 3. Border and inner edges\nUsed once: border. Used twice: inner, no wall.', startCode: BORDER },
              { type: 'js', instruction: '### 4. Lift and wall\nPredict first: how many faces after? Each wall is checked to face out; V − E + F before and after.', startCode: WALLS },
              { type: 'js', instruction: '### 5. See it\nThe grid blue, the lifted faces amber, the walls green, each flat shaded. Drag to turn it.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 360 },
              { type: 'challenge', instruction: '### 6. Challenge: a 2 × 2 block\nCount the new vertices, walls and inner edges. The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkBlock },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Extrude" in MeshLab](#/lab/mesh-lab?project=extrude). The script extrudes the same pair of faces with **Record traces** on: press Play in the Algorithm trace and predict where the copied vertex goes. Then extrude a corner face yourself with E.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Edit mode, face select (3), E:** extrude the selected faces and drag the distance; type a number for an exact one.\n- **Mesh › Extrude** does the same from the menu.\n- In a script: `mesh.extrude(mesh.faces.top(), 0.5)`, or pick faces with `mesh.faces.where(f => …)`.\n- [Open "Crate" in MeshLab](#/lab/mesh-lab?project=crate) for a model built from extrudes.\n- **In Blender:** E in edit mode, the same operation ("Extrude Region"); Alt+E offers "Extrude Individual Faces", which treats every face as its own region.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**The direction.** For a region $R$ of faces with unit normals $\\hat n_f$ and areas $A_f$, $n = \\dfrac{\\sum_{f \\in R} A_f \\hat n_f}{\\left\\| \\sum_{f \\in R} A_f \\hat n_f \\right\\|}$. The cross-product sum of lesson 3.5 already gives $2 A_f \\hat n_f$ for each face, so no separate area is needed: add the raw cross-product sums and normalise. It is undefined when the sum is $0$, which is why separate pieces are extruded separately.',
      '**The copies.** $v\' = v + d\\,n$ for every vertex of the region. Every point of the region moves by the same vector, so the lifted region is the same shape: a translation (lesson 2.3).',
      '**Border edges.** In a surface where each edge is on at most two faces (lesson 1.4), an edge of the region is used by one or two of its faces. Used by two, both sides moved together and nothing opens. Used by one, the face on its other side (or none, at the grid\'s edge) stayed behind, and the gap must be closed with a wall.',
      '**Winding.** The region\'s face walks its border edge $a \\to b$. A neighbour sharing that edge walks it $b \\to a$ (consistent orientation, lesson 1.5). The wall $[a, b, b\', a\']$ walks the bottom edge $a \\to b$ like the lifted face did, so the face left behind, which walks it $b \\to a$, agrees with the wall; and the wall\'s top edge $b\' \\to a\'$ is walked opposite to the lifted face\'s $a\' \\to b\'$. Every edge is walked once each way: the surface stays consistently oriented.',
      '**Euler characteristic.** Let the region have $V_R$ vertices, $E_R$ edges and $F_R$ faces, $B$ of its edges on the border, and $V_{in}$ vertices and $E_{in}$ edges strictly inside it. The extrude adds $V_R$ copies, $E_R$ copied edges, $B$ edges up the walls and $B$ wall faces; the inside vertices and edges are left with no face and drop out. So $\\Delta(V - E + F) = (V_R - V_{in}) - (E_R + B - E_{in}) + B = (V_R - E_R) - (V_{in} - E_{in})$. For a disc-shaped region both brackets equal $1 - F_R$ (each is a disc count with the faces taken off), so the change is $0$. Cell 4: $V$ $16 \\to 22$, $E$ $24 \\to 36$, $F$ $9 \\to 15$, and $V - E + F = 1$ both times.',
    ],
    equations: [
      { label: 'Direction', latex: 'n = \\frac{\\sum_{f \\in R} A_f\\,\\hat n_f}{\\left\\|\\sum_{f \\in R} A_f\\,\\hat n_f\\right\\|}' },
      { label: 'Copies', latex: "v' = v + d\\,n" },
      { label: 'Wall on border edge a → b', latex: "[\\,a,\\; b,\\; b',\\; a'\\,]" },
      { label: 'Border edges', latex: '4F_R = B + 2E_{\\text{inner}} \\quad (\\text{quads})' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** Given a consistently oriented surface mesh and a connected set $R$ of faces whose area-weighted normal sum is non-zero, extruding $R$ by $d$ replaces each vertex $v$ of $R$ in the faces of $R$ by $v + d n$, and adds the quad $[a, b, b\', a\']$ for each directed edge $a \\to b$ of a face of $R$ whose undirected edge lies on exactly one face of $R$. The result is consistently oriented and has the same Euler characteristic.',
      '**Invariant viewpoint.** Extrude does not depend on how the vertices are numbered, and it commutes with rigid motions: move the mesh then extrude, or extrude then move, and you get the same shape. It depends only on which faces are selected, and on $d$.',
      '**Geometric picture.** Extrusion sweeps the region\'s boundary along $n$: the walls are the boundary curve swept a distance $d$, a strip of quads. That is why the number of walls is the length of the boundary in edges.',
      '**Where this goes.** Lesson 5.2 insets a region (copies moved inward within the surface, not along $n$) and 5.4 bevels edges: each is copy, move, and bridge, with different rules for the move.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-5-001-ex1',
      title: 'One face',
      problem: 'Extrude one square face of a flat grid by $1$. How many new vertices, walls and faces?',
      steps: [
        { expression: '\\text{4 corners} \\Rightarrow 4\\text{ new vertices}', annotation: 'Step 2: no corner is shared within a region of one face.' },
        { expression: '\\text{all 4 edges used once} \\Rightarrow 4\\text{ walls}', annotation: 'Step 3: every edge is on the border.' },
        { expression: '9 + 4 = 13\\text{ faces (on a 3 × 3 grid)}', annotation: 'The face itself only moved.' },
      ],
      conclusion: '4 new vertices, 4 walls, and the grid has 13 faces.',
    },
    {
      id: 'modelling-geometry-5-001-ex2',
      title: 'A tilted region',
      problem: 'A region is a face of area $1$ facing $(0,0,1)$ and a face of area $3$ facing $(0,1,0)$. Which way does it move?',
      steps: [
        { expression: '1(0,0,1) + 3(0,1,0) = (0, 3, 1)', annotation: 'Step 1: area times normal, summed.' },
        { expression: '\\|(0,3,1)\\| = \\sqrt{10} = 3.1623', annotation: 'The length.' },
        { expression: 'n = (0, 0.9487, 0.3162)', annotation: '18.43° from up, close to the big face.' },
      ],
      conclusion: 'n = (0, 0.9487, 0.3162).',
    },
    {
      id: 'modelling-geometry-5-001-ex3',
      title: 'Which way round is a wall?',
      problem: 'A lifted face walks its border edge $5 \\to 6$; $5$ and $6$ are copied to $16$ and $17$. Write the wall.',
      steps: [
        { expression: '[a, b] = [5, 6]', annotation: 'The edge, in its own face\'s order.' },
        { expression: "[a, b, b', a'] = [5, 6, 17, 16]", annotation: 'Step 5: along, up, back, down.' },
      ],
      conclusion: 'The wall is [5, 6, 17, 16], facing out of the region.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-5-001-ch1',
      difficulty: 'easy',
      problem: 'Why are no walls built on the edge between two selected faces?',
      walkthrough: [{ expression: '\\text{both faces moved up together}', annotation: 'Nothing opened along that edge.' }],
      answer: 'Both faces on it moved by the same vector, so there is no gap there to close; a wall would sit inside the solid with zero thickness.',
    },
    {
      id: 'modelling-geometry-5-001-ch2',
      difficulty: 'medium',
      problem: 'You select all six faces of a cube and extrude by $0.2$ in MeshLab. What happens, and why not a single direction?',
      walkthrough: [
        { expression: '\\sum A_f \\hat n_f = (0,0,0)', annotation: 'Opposite sides cancel.' },
        { expression: '\\text{the six faces form one connected region}', annotation: 'They share edges.' },
        { expression: '\\text{no border edges} \\Rightarrow \\text{no walls}', annotation: 'Every edge is used twice.' },
      ],
      answer: 'The six faces form one closed region: every edge is inner, so no walls are built, and the average normal is zero, so there is no direction to move. A closed region cannot be extruded as one region; scale it, or extrude individual faces (each along its own normal) instead.',
    },
    {
      id: 'modelling-geometry-5-001-ch3',
      difficulty: 'hard',
      problem: 'Prove that for a region of quads, $4F_R = B + 2E_{\\text{inner}}$, and use it to count the walls of an $m \\times k$ block.',
      walkthrough: [
        { expression: '\\text{each quad has 4 edge-uses}', annotation: 'Total 4F_R.' },
        { expression: '\\text{border edges are used once, inner twice}', annotation: 'So 4F_R = B + 2E_inner.' },
        { expression: 'B = 2(m + k)', annotation: 'Round the outside of the block.' },
      ],
      answer: 'Each quad contributes 4 edge-uses; border edges take one use each, inner edges two, so 4F_R = B + 2E_inner. An m × k block has B = 2(m + k) walls, and E_inner = (4mk − 2(m + k)) / 2 = 2mk − m − k.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'R', meaning: 'The region: the selected faces, connected by shared edges.' },
      { symbol: 'n', meaning: 'The direction: the unit area-weighted average of the region\'s normals.' },
      { symbol: 'd', meaning: 'The extrude distance.' },
      { symbol: "v'", meaning: 'The copy of vertex v: v + d n.' },
      { symbol: 'B', meaning: 'The number of border edges: edges used by exactly one face of R. One wall each.' },
      { symbol: "[a, b, b', a']", meaning: 'The wall on border edge a → b, wound to face out.' },
    ],
    rulesOfThumb: [
      'Walls on the border only; inner edges get none.',
      'Each vertex is copied once, however many selected faces share it.',
      'Walk the edge as its face does, then up.',
      'Separate pieces, separate directions.',
      'Cancelled extrudes leave hidden faces: undo instead.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-3-005', label: 'Flat and smooth shading', note: 'Area-weighted normals, and why smooth shading smears round new walls.' },
      { lessonId: 'modelling-geometry-4-007', label: 'Every click is code', note: 'Each extrude is logged as one mesh.extrude line.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-5-002', label: 'Inset', note: 'Copy and wall again, but the copies move inward within the surface.' },
      { lessonId: 'modelling-geometry-5-004', label: 'Bevel', note: 'Rounding the hard edge that an extrude leaves.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-5-001-1', label: 'Read how the direction is averaged from the region\'s normals', type: 'read' },
    { id: 'cp-modelling-geometry-5-001-2', label: 'Read why each vertex is copied once and walls go on border edges only', type: 'read' },
    { id: 'cp-modelling-geometry-5-001-3', label: 'Read how a wall\'s winding makes it face out', type: 'read' },
    { id: 'cp-modelling-geometry-5-001-4', label: 'Run cells 1 to 4: direction, copies, border, walls', type: 'lab' },
    { id: 'cp-modelling-geometry-5-001-5', label: 'Trace an extrude in MeshLab and predict a copied vertex', type: 'lab' },
    { id: 'cp-modelling-geometry-5-001-6', label: 'Work through example 2, a tilted region', type: 'example' },
    { id: 'cp-modelling-geometry-5-001-7', label: 'Work through example 3, which way round is a wall', type: 'example' },
    { id: 'cp-modelling-geometry-5-001-8', label: 'Complete the challenge: a 2 × 2 block', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-5-001-assess-1',
        type: 'choice',
        text: 'You extrude a row of three faces of a grid. How many walls are built?',
        options: ['8', '12', '10', '6'],
        answer: '8',
        hint: '4 × 3 = 12 edge-uses; 2 inner edges take 2 each.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-5-001-quiz-1',
      type: 'choice',
      text: 'Which edges of an extruded region get walls?',
      options: ['Edges used by exactly one selected face', 'Every edge of every selected face', 'Edges shared by two selected faces', 'Only the longest edges'],
      answer: 'Edges used by exactly one selected face',
      hints: ['The border.', 'Step 3.'],
      reviewSection: 'Intuition: the walls paragraph',
    },
    {
      id: 'modelling-geometry-5-001-quiz-2',
      type: 'choice',
      text: 'Two neighbouring square faces are extruded together. How many new vertices?',
      options: ['6', '8', '4', '2'],
      answer: '6',
      hints: ['They share two corners.', 'Cell 2.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-5-001-quiz-3',
      type: 'choice',
      text: 'A region has a face of area 2 facing up and a face of area 1 facing +x. Which way does it move?',
      options: ['Closer to up than to +x', 'Exactly 45° between them', 'Straight up', 'Closer to +x'],
      answer: 'Closer to up than to +x',
      hints: ['Area-weighted.', 'Cell 1: 26.57° from up.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-5-001-quiz-4',
      type: 'choice',
      text: 'The border edge 3 → 8 is copied to 20 → 21. Which wall faces out?',
      options: ['[3, 8, 21, 20]', '[8, 3, 20, 21]', '[3, 8, 20, 21]', '[3, 20, 21, 8]'],
      answer: '[3, 8, 21, 20]',
      hints: ['[a, b, b′, a′].', 'Example 3.'],
      reviewSection: 'Example 3',
    },
    {
      id: 'modelling-geometry-5-001-quiz-5',
      type: 'choice',
      text: 'What happens to V − E + F when a region shaped like a disc is extruded?',
      options: ['It stays the same', 'It goes up by 1', 'It goes up by the number of walls', 'It goes down by 1'],
      answer: 'It stays the same',
      hints: ['Cell 4.', 'The surface is the same kind of surface.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-5-001-quiz-6',
      type: 'choice',
      text: 'Why does a freshly extruded box look blotchy at its top edges with smooth shading?',
      options: ['Each top corner averages the cap and walls into one tilted normal', 'The walls face inward', 'The copies are in the wrong place', 'The GPU cannot shade quads'],
      answer: 'Each top corner averages the cap and walls into one tilted normal',
      hints: ['Cell 5: 35° off the cap.', 'Lesson 3.5.'],
      reviewSection: 'Insight "The graphics strand"',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'Extrude just moves the selected faces.',
      whyStudentsThinkIt: 'In the viewport the faces seem to slide out.',
      correctionExample: 'Cell 4: the grid goes from 9 faces to 15; the six new faces are the walls.',
      contrastCase: 'Moving the faces with G drags their vertices, stretching the neighbouring faces instead of building walls.',
    },
    {
      falseBelief: 'Each selected face gets its own walls.',
      whyStudentsThinkIt: 'Each face has four sides.',
      correctionExample: 'Two neighbouring faces get 6 walls, not 8: the edge between them is inner.',
      contrastCase: 'Blender\'s Extrude Individual Faces does give each face its own walls, because it treats each face as its own region.',
    },
    {
      falseBelief: 'The direction is the plain average of the normals.',
      whyStudentsThinkIt: 'Averages are usually unweighted.',
      correctionExample: 'Cell 1: the top and end of a box give 26.57° from up, not 45°: the bigger top counts double.',
      contrastCase: 'When the faces have equal areas, as on a grid, weighted and plain averages agree.',
    },
  ],

  transferPrompts: [
    {
      situation: 'You need a raised panel on the side of a spaceship hull.',
      competingTechniques: ['Model a separate box and place it on the hull', 'Select hull faces and extrude them'],
      whyThisTechniqueWins: 'The extrude keeps the panel joined to the hull, one surface with no hidden faces inside, which shades and subdivides cleanly.',
    },
    {
      situation: 'A script must build a crate whose size is a variable.',
      competingTechniques: ['Write every vertex by hand', 'Start from a box and extrude faces by distances computed from the size'],
      whyThisTechniqueWins: 'Extrude distances are relative, so the same script works for any size (lesson 4.7, challenge 3).',
    },
  ],

  debugging: [
    {
      commonError: 'Copying a shared vertex once per face.',
      symptom: 'The lifted faces come apart, and a gap opens between them.',
      whyItHappened: 'Each face got its own copy of the shared corner.',
      repairStrategy: 'Copy each vertex once, through a map from original to copy (Step 2).',
    },
    {
      commonError: 'Building walls on inner edges.',
      symptom: 'Zero-thickness faces inside the solid; dark artefacts and non-manifold edges (three faces on one edge).',
      whyItHappened: 'Every edge of every face was walled.',
      repairStrategy: 'Count uses per edge and wall only those used once (Step 3).',
    },
    {
      commonError: 'Writing the wall as [a, b, a′, b′] or [b, a, a′, b′].',
      symptom: 'Walls look twisted, or are shaded from inside (red with normals shown).',
      whyItHappened: 'The ring order goes across the wall, or against the face\'s own direction.',
      repairStrategy: 'Along, up, back, down: [a, b, b′, a′] with a → b in the face\'s order.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Extrude a region by hand: direction, copies, border edges and walls with the right winding.',
    explainVerbally: 'Explain why walls go on border edges only, why vertices are copied once, and why the walls face out.',
    detectIncorrectApplication: 'Recognise doubled copies, walls on inner edges, wrong winding and cancelled extrudes from their symptoms.',
    transferToUnfamiliar: 'Count the walls and vertices of any extrude before doing it, and choose region versus individual-face extrusion.',
  },
};
