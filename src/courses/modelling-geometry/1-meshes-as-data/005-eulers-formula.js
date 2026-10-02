// Lesson 1.5: Euler's formula (docs/modelling-course-plan.md). Four parts: the maths (V − E + F, Euler
// operations, genus and boundary loops), building it (counting from the edge table, and a graded face-list
// challenge), watching MeshLab do it (a traced count in Predict mode), and using the tool (the Inspector's MESH
// section, a hole made by hand, and the curvature gallery).
import { withPicture } from '../notebookScene.js';
import { readFaces, edgeTable } from '../faceList.js';

const COUNT_FN = `// V − E + F from the two lists: the vertices the faces use, the entries in the edge table, the faces.
function euler(faces) {
  const V = new Set(faces.flat()).size
  const edges = new Set()
  for (const f of faces) f.forEach((a, i) => { const b = f[(i + 1) % f.length]; edges.add(a < b ? a + '-' + b : b + '-' + a) })
  const E = edges.size, F = faces.length
  return { V, E, F, chi: V - E + F, text: V + ' − ' + E + ' + ' + F + ' = ' + (V - E + F) }
}`;

const SHAPES = `${COUNT_FN}

const cube = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]]
const pyramid = [[0, 1, 2, 3], [1, 0, 4], [2, 1, 4], [3, 2, 4], [0, 3, 4]]
const prism = [[0, 1, 2], [3, 5, 4], [0, 3, 4, 1], [1, 4, 5, 2], [2, 5, 3, 0]]   // a triangle, pushed up
console.log('cube:    ' + euler(cube).text)
console.log('pyramid: ' + euler(pyramid).text)
console.log('prism:   ' + euler(prism).text)`;

const OPERATIONS = `${COUNT_FN}

const cube = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]]
console.log('cube:                   ' + euler(cube).text)

// Cut face 0 along a diagonal: one more edge, one more face.
const cut = [[0, 4, 6], [0, 6, 2], ...cube.slice(1)]
console.log('a diagonal on face 0:   ' + euler(cut).text)

// Poke face 0: a new vertex 8 in its middle, joined to its 4 corners: +1 vertex, +4 edges, +3 faces.
const poked = [[0, 4, 8], [4, 6, 8], [6, 2, 8], [2, 0, 8], ...cube.slice(1)]
console.log('face 0 poked:           ' + euler(poked).text)

// Extrude face 1: its corners copied out to vertices 8 to 11, a cap on top and four walls.
const extruded = [cube[0], [8, 9, 10, 11], ...cube.slice(2), [1, 3, 9, 8], [3, 7, 10, 9], [7, 5, 11, 10], [5, 1, 8, 11]]
console.log('face 1 extruded:        ' + euler(extruded).text)`;

const TORUS = `${COUNT_FN}

// A torus: a grid of n × m quads, wrapped round the ring one way and round the tube the other.
const n = 8, m = 4, R = 1, r = 0.4
const vertices = [], faces = []
for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
  const u = 2 * Math.PI * i / n, v = 2 * Math.PI * j / m
  vertices.push([(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)])
}
const at = (i, j) => (i % n) * m + (j % m)   // wrapping: past the last row or column is the first again
for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) faces.push([at(i, j), at(i, j + 1), at(i + 1, j + 1), at(i + 1, j)])
console.log('torus, ' + n + ' × ' + m + ': ' + euler(faces).text)
show({ verts: vertices, faces, groups: faces.map(() => 0) })`;

const HOLES = `${COUNT_FN}

const cube = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]]
// b: the boundary loops (rims of holes); for one piece, g = (2 − χ − b) / 2 holes go through it.
const genus = (chi, b) => (2 - chi - b) / 2
const box = cube.filter((_, i) => i !== 3)              // no lid: one rim
const tube = cube.filter((_, i) => i !== 2 && i !== 3)  // no top, no bottom: two rims
console.log('open box: ' + euler(box).text + ', b = 1, g = ' + genus(euler(box).chi, 1))
console.log('tube:     ' + euler(tube).text + ', b = 2, g = ' + genus(euler(tube).chi, 2))
const two = [...cube, ...cube.map((f) => f.map((k) => k + 8))]
console.log('two cubes: ' + euler(two).text + ': 2 for each piece')`;

const FRAME_VERTS = `// A square picture frame: an outer square of side 4, a hole of side 2, half a unit thick.
const vertices = [
  [-2, 0, -2], [2, 0, -2], [2, 0, 2], [-2, 0, 2],               // 0 to 3: bottom, outside corners
  [-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1],               // 4 to 7: bottom, round the hole
  [-2, 0.5, -2], [2, 0.5, -2], [2, 0.5, 2], [-2, 0.5, 2],       // 8 to 11: top, outside corners
  [-1, 0.5, -1], [1, 0.5, -1], [1, 0.5, 1], [-1, 0.5, 1],       // 12 to 15: top, round the hole
]`;

const CHALLENGE = `// The frame has its top, bottom and outside walls, but the walls lining the hole are missing.
// Add them, so the frame is closed with a hole through it: V − E + F = 0. Open edges show orange.
${FRAME_VERTS}
const faces = [
  [12, 13, 9, 8], [13, 14, 10, 9], [14, 15, 11, 10], [15, 12, 8, 11],   // top
  [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],             // bottom
  [8, 9, 1, 0], [9, 10, 2, 1], [10, 11, 3, 2], [11, 8, 0, 3],         // outside walls
]
show({ verts: vertices, faces, edges: true })`;

const SOLVED = CHALLENGE.replace('[11, 8, 0, 3],         // outside walls\n]', '[11, 8, 0, 3],         // outside walls\n  [4, 5, 13, 12], [5, 6, 14, 13], [6, 7, 15, 14], [7, 4, 12, 15],     // walls of the hole\n]');

/** The challenge's check: read the face list and say what keeps it from being a closed frame with one hole. */
export function checkFrame(code) {
  const no = (message) => ({ pass: false, message });
  const { faces, error } = readFaces(code);
  if (error) return no(error);
  for (const [i, f] of faces.entries()) {
    if (f.length < 3) return no(`Face ${i} has ${f.length} corner${f.length === 1 ? '' : 's'}: a face needs at least 3.`);
    if (f.some((v) => v < 0 || v > 15)) return no(`Face ${i} uses a vertex that does not exist: they are numbered 0 to 15.`);
    if (new Set(f).size !== f.length) return no(`Face ${i} lists the same corner twice.`);
  }
  const table = edgeTable(faces);
  const many = [...table].find(([, on]) => on.length > 2);
  if (many) return no(`Edge ${many[0]} is on ${many[1].length} faces (${many[1].map((x) => x.face).join(', ')}): no solid has an edge on more than two.`);
  const open = [...table].filter(([, on]) => on.length === 1).map(([k]) => k);
  if (open.length) return no(`Edge${open.length === 1 ? '' : 's'} ${open.join(', ')} ${open.length === 1 ? 'is' : 'are'} on only one face: the frame is still open there.`);
  const same = [...table.values()].find(([x, y]) => x.from === y.from);
  if (same) return no(`Faces ${same[0].face} and ${same[1].face} both go from vertex ${same[0].from} to vertex ${same[0].to}: one of them is wound the wrong way round.`);
  const V = new Set(faces.flat()).size, E = table.size, F = faces.length, chi = V - E + F;
  if (chi === 2) return no(`Closed, but V − E + F = ${V} − ${E} + ${F} = 2: that is a sphere's count. The hole has been covered over instead of lined, so nothing goes through it.`);
  if (chi !== 0) return no(`Closed, but V − E + F = ${V} − ${E} + ${F} = ${chi}, not 0.`);
  if (V !== 16) return no(`V − E + F is 0, but only ${V} of the 16 vertices are used.`);
  return { pass: true, message: `Closed, and V − E + F = ${V} − ${E} + ${F} = 0: one piece, no rims, so 2 − 2g = 0 and exactly one hole goes through it.` };
}

export default {
  id: 'modelling-geometry-1-005',
  slug: 'eulers-formula',
  chapter: 'modelling-geometry-1',
  order: 5,
  title: "Euler's Formula",
  subtitle: 'Vertices minus edges plus faces: a number that ignores the mesh and sees the shape.',
  tags: ['meshes', 'topology', 'euler characteristic', 'genus', 'counting'],
  aliases: 'euler characteristic v - e + f = 2 genus holes boundary loops topology torus sphere euler operations seams meshlab',
  timeToComplete: 45,
  coreConcept: 'For a closed mesh shaped like a sphere, V − E + F = 2 however it is cut into faces. Each hole through the surface (genus g) lowers it by 2 and each rim (boundary loop b) by 1: χ = 2 − 2g − b, summed over the pieces. So three counts from the two lists and the edge table reveal the shape\'s topology.',
  prerequisites: ['modelling-geometry-1-004'],
  nextLesson: null,

  hook: {
    question: 'A cube has 8 vertices, 12 edges and 6 faces. A sphere made of 128 faces has 114 vertices and 240 edges. Work out vertices − edges + faces for each. Why do two such different meshes give the same number, and what would change it?',
    realWorldContext: 'Mesh checkers use this count to spot holes and stray pieces in a model before it is printed or sent to a game engine. It also predicts how many seams a surface needs before it can be unwrapped flat for a texture, and it is the number behind the curvature totals in chapter 7.',
  },

  intuition: {
    prose: [
      'Count the cube: $8 - 12 + 6 = 2$. The square pyramid from lesson 1.2: $5 - 8 + 5 = 2$. A sphere of 128 faces: $114 - 240 + 128 = 2$. This number, $\\chi = V - E + F$, is the **Euler characteristic**, and every closed mesh shaped like a ball, without handles, gives 2.',
      'Why it does not depend on the faces: change a mesh by small steps and watch the count. Cut a square face along its diagonal: one more edge and one more face, so $-1 + 1$ changes nothing. Put a new vertex in a face and join it to the face\'s 4 corners: $+1$ vertex, $+4$ edges, $+3$ faces, and $1 - 4 + 3 = 0$. Steps like these, called **Euler operations**, move between all the meshes of the same shape, and none of them changes $\\chi$.',
      'Now make a ring: a torus. Built from a grid of $n \\times m$ quads wrapped round both ways, it has $nm$ vertices, $2nm$ edges and $nm$ faces, so $\\chi = 0$. The hole through it took away 2.',
      'Before reading on, predict: what does the cube give with its lid taken off? It loses one face and nothing else: $8 - 12 + 5 = 1$. An open rim, a **boundary loop**, takes away 1.',
      'So $\\chi = 2 - 2g - b$ for one piece: $g$ is the **genus**, the number of holes through it, and $b$ the number of boundary loops. Several pieces add their counts: two separate cubes give 4. From three counts you can read the shape, or catch a mistake: a model meant to be one closed solid that does not give 2 has a hole, a stray piece or a handle you did not mean to make.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Read the topology from the lists',
        body: 'Step 1. V: count the vertices the faces use.\nStep 2. E: build the edge table (lesson 1.3) and count its entries.\nStep 3. F: count the faces.\nStep 4. $\\chi = V - E + F$. Also count the pieces (lesson 1.4) and the boundary loops (rims of open edges).\nStep 5. For one piece, $g = (2 - \\chi - b) / 2$.',
      },
      {
        type: 'warning',
        title: 'χ alone does not tell you the shape',
        body: 'A tube (a cube with no top and no bottom) gives $8 - 12 + 4 = 0$, the same as a closed torus. The tube has $b = 2$ and $g = 0$; the torus $b = 0$ and $g = 1$. Count the boundary loops and the pieces as well.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: seams for unwrapping',
        body: 'To put a flat texture on a surface (UV unwrapping, chapter 8), the surface is cut along seams until it lies flat as one sheet, a disc, which has $\\chi = 1$. One cut along a path of edges opens a sphere-like surface into a disc. A torus has to be cut twice, once round the tube and once round the ring, before it lies flat; that is why a torus\'s UV map has seams going both ways. The genus says how many cut loops a closed surface needs: $2g$.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: V − E + F',
        props: {
          lesson: {
            title: 'Counting with Euler',
            subtitle: 'Count three solids, watch Euler operations keep χ, build a torus, read holes and rims, and close a picture frame.',
            cells: [
              { type: 'js', instruction: '### 1. Three solids, one number\nThe cube, the pyramid and a triangular prism, counted from their face lists. All three give 2.', startCode: SHAPES },
              { type: 'js', instruction: '### 2. Euler operations\nCut a face, poke a face, extrude a face. V, E and F all change; V − E + F does not.', startCode: OPERATIONS },
              { type: 'js', instruction: '### 3. A torus\nA grid of 8 × 4 quads wrapped round both ways: 32 vertices, 64 edges, 32 faces, so χ = 0. Change n and m: it stays 0. Drag the picture to turn it.', startCode: withPicture(TORUS), showPreviewByDefault: true, outputHeight: 340 },
              { type: 'js', instruction: '### 4. Rims, holes and pieces\nAn open box and a tube, with their boundary loops b and genus g from χ = 2 − 2g − b, and two cubes, whose counts add.', startCode: HOLES },
              { type: 'challenge', instruction: '### 5. Challenge: line the hole\nThe frame is missing the four walls round its hole. Add them, wound like the other faces, so the frame is closed and V − E + F = 0. The check builds your edge table, then counts.', startCode: withPicture(CHALLENGE), solutionCode: withPicture(SOLVED), check: checkFrame, showPreviewByDefault: true, outputHeight: 340 },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Euler\'s formula" in MeshLab](#/lab/mesh-lab?project=eulers-formula). It makes a closed cube, a sphere, a torus and an open box, and prints V − E + F for each: 2, 2, 0 and 1. Then it counts the torus again with **Record traces** on. The Algorithm trace is in **Predict** mode: after counting the vertices, edges and faces it asks for χ, and at the end it asks how many holes go through the torus. Then make a hole in the closed cube yourself and watch its count drop to 1.' },
              { type: 'markdown', instruction: '### Use the tool\n- MeshLab\'s **Inspector** has a **MESH** section for the selected object: Vertices, Edges, Faces, Euler V − E + F, whether it is closed, and its separate pieces.\n- Any change you make in edit mode updates the count, so you can watch an extrude or a loop cut leave it unchanged, and a deleted face lower it.\n- **In Blender:** Viewport Overlays › Statistics shows the vertex, edge and face counts to work it out from.\n- The same number comes back in curvature: [the curvature gallery](#/lab/mesh-lab?project=curvature-gallery) sums each surface\'s curvature, and the total is 2π times V − E + F. The torus gives 0, however it is bent.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      'The Euler characteristic of a mesh is $\\chi = V - E + F$, with $V$ the vertices used by faces, $E$ the edges and $F$ the faces.',
      'An Euler operation changes the counts by $(\\Delta V, \\Delta E, \\Delta F)$ with $\\Delta V - \\Delta E + \\Delta F = 0$. Splitting an edge in two: $(1, 1, 0)$. Splitting a face by a new edge between two of its corners: $(0, 1, 1)$. Poking a $k$-sided face: $(1, k, k - 1)$. Extruding a $k$-sided face: $(k, 2k, k)$.',
      'For one piece with no edge on three or more faces, $\\chi = 2 - 2g - b$, where $g$ is the genus and $b$ the number of boundary loops. Sphere: $g = 0, b = 0, \\chi = 2$. Torus: $g = 1, \\chi = 0$. Disc: $b = 1, \\chi = 1$. Tube: $b = 2, \\chi = 0$.',
      'For a mesh in several pieces, $\\chi$ is the sum over the pieces. Two cubes: $16 - 24 + 12 = 4 = 2 + 2$.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Why a sphere-like mesh gives 2: take away one face, and flatten the rest onto the plane (possible for a surface shaped like a sphere with a hole). Now remove edges and vertices, one at a time, by Euler operations in reverse: an edge on the boundary of one face goes with its face, $(0, -1, -1)$; a vertex with one edge goes with its edge, $(-1, -1, 0)$. Neither changes $V - E + F$. What remains is a single vertex: $1 - 0 + 0 = 1$. Put back the face taken away at the start: 2.',
      'χ is a property of the surface, not of the mesh: any two meshes of the same surface are connected by a sequence of Euler operations (and their reverses), so they give the same χ. Topologists call it a topological invariant; for closed, connected surfaces that can be oriented, χ alone decides the shape up to stretching.',
      'Cost: $V$ needs a set of used vertices, $E$ the edge table, $F$ the face count, each one pass over the corner slots. Boundary loops are the open edges grouped by shared vertices, and pieces a breadth-first search: all linear in the size of the mesh.',
      'Gauss–Bonnet (chapter 7) ties χ to curvature: for a closed surface the total Gaussian curvature is $2\\pi\\chi$, so a sphere of any size and shape totals $4\\pi$ and a torus 0. The curvature gallery project prints exactly that.',
    ],
    callouts: [
      { type: 'insight', title: 'Bridge: from counting to code', body: 'euler(faces) in the notebook is the definition: a set for V, the edge table for E, the list length for F.' },
      { type: 'insight', title: 'Bridge: from code to the screen', body: 'The genus says how many seam loops a texture unwrap needs: 0 for a sphere-like model, 2 for a torus.' },
      { type: 'insight', title: 'Bridge: from the screen to MeshLab', body: 'The Inspector\'s Euler V − E + F is mesh.stats().euler; mesh.topology() adds pieces, boundary loops and genus, and is the traced count.' },
    ],
    visualizations: [],
  },

  examples: [
    {
      id: 'modelling-geometry-1-005-ex1',
      title: 'An octahedron',
      difficulty: 'easy',
      problem: 'An octahedron has 6 vertices and 8 triangles. How many edges, and what is χ?',
      steps: [
        { expression: 'E = \\tfrac{1}{2} \\times 8 \\times 3 = 12', annotation: 'Closed, so edges are half the corner slots (lesson 1.3).', strategyTitle: 'Step 1: Edges' },
        { expression: '\\chi = 6 - 12 + 8 = 2', annotation: 'It is shaped like a sphere.', strategyTitle: 'Step 2: Count' },
      ],
      answer: '12 edges, and χ = 2.',
    },
    {
      id: 'modelling-geometry-1-005-ex2',
      title: 'An extrude keeps χ',
      difficulty: 'medium',
      problem: 'Extrude one face of a cube outwards. What happens to V, E, F and χ?',
      steps: [
        { expression: '\\Delta V = 4,\\ \\Delta E = 8,\\ \\Delta F = 4', annotation: 'Four new corners; four new cap edges and four walls\' upright edges; a cap and four walls replace one face.', strategyTitle: 'Step 1: Changes' },
        { expression: '12 - 20 + 10 = 2', annotation: '4 − 8 + 4 = 0, so χ is still 2.', strategyTitle: 'Step 2: Count' },
      ],
      answer: 'V = 12, E = 20, F = 10, χ = 2: unchanged.',
    },
    {
      id: 'modelling-geometry-1-005-ex3',
      title: 'Reading the shape',
      difficulty: 'hard',
      problem: 'A closed mesh in one piece has V = 96, E = 192, F = 96. How many holes go through it?',
      steps: [
        { expression: '\\chi = 96 - 192 + 96 = 0', annotation: 'The count.', strategyTitle: 'Step 1: χ' },
        { expression: 'g = (2 - 0 - 0) / 2 = 1', annotation: 'Closed: b = 0.', strategyTitle: 'Step 2: Genus' },
      ],
      answer: 'One: it is a torus, like MeshLab\'s 12 × 8 torus.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-1-005-ch1',
      title: 'A cube with a hole',
      difficulty: 'easy',
      problem: 'Delete two faces of a closed cube that do not touch. What is χ?',
      hint: 'Each deleted face makes one boundary loop.',
      answer: '0: 8 − 12 + 4. It is the tube: b = 2, g = 0.',
      walkthrough: [],
    },
    {
      id: 'modelling-geometry-1-005-ch2',
      title: 'Two handles',
      difficulty: 'medium',
      problem: 'What is χ for a closed surface with two holes through it, like a pretzel with two loops?',
      hint: 'χ = 2 − 2g − b.',
      answer: '−2: g = 2, b = 0.',
      walkthrough: [],
    },
    {
      id: 'modelling-geometry-1-005-ch3',
      title: 'Is the import clean?',
      difficulty: 'hard',
      problem: 'A character imported for a game should be one closed piece with no holes through it. The checker reports V = 5,002, E = 15,000, F = 10,000, no open edges and one piece. Is it clean?',
      hint: 'Work out χ, then g.',
      answer: 'χ = 5,002 − 15,000 + 10,000 = 2, so g = 0: as expected. A result of 0 would mean a handle somewhere, such as two fingers fused into a loop.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      { symbol: '\\chi = V - E + F', meaning: 'The Euler characteristic of a mesh.' },
      { symbol: 'g', meaning: 'The genus: the number of holes through a closed piece, like the hole of a ring.' },
      { symbol: 'b', meaning: 'The number of boundary loops: rims of open edges.' },
      { symbol: '\\chi = 2 - 2g - b', meaning: 'The count for one piece, from its genus and rims.' },
      { symbol: '\\text{Euler operation}', meaning: 'A small change to a mesh, such as cutting a face, that leaves V − E + F unchanged.' },
      { symbol: '\\text{topological invariant}', meaning: 'A number that depends on the surface, not on how it is cut into faces.' },
    ],
    rulesOfThumb: [
      'One closed solid with no handles: χ = 2.',
      'Each hole through it: −2. Each open rim: −1. Each extra piece: add its own count.',
      'Modelling operations like extrude and loop cut never change χ; deleting a face does.',
      'Check pieces and rims too: χ alone can match two different shapes.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'A finer mesh has a larger V − E + F.',
      whyStudentsThinkIt: 'All three counts grow as the mesh gets finer.',
      correctionExample: 'The cube and a 128-face sphere both give 2.',
      contrastCase: 'Deleting faces or joining pieces does change it, because that changes the shape, not just the mesh.',
    },
    {
      falseBelief: 'A hole into a surface and a hole through it count the same.',
      whyStudentsThinkIt: 'Both are called holes.',
      correctionExample: 'An open box (a rim) gives 1; a torus (a hole through it) gives 0, and has no rim.',
      contrastCase: 'A rim lowers χ by 1, a hole through by 2.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A 3D-print slicer rejects a model, and you need to know why before opening it.',
      competingTechniques: ['Count V, E, F, pieces and open edges', 'Inspect the model by eye'],
      whyThisTechniqueWins: 'The counts take one pass and name the kind of problem: a rim, a stray piece or an unexpected handle.',
    },
    {
      situation: 'You are planning UV seams for a ring-shaped model.',
      competingTechniques: ['Use the genus: a torus needs two seam loops', 'Cut one seam and hope it lies flat'],
      whyThisTechniqueWins: 'A torus cut along one loop is still a tube, which cannot lie flat as one sheet; the genus says two loops are needed.',
    },
  ],

  debugging: [
    {
      commonError: 'Counting every entry of the vertex list as V, including vertices no face uses.',
      symptom: 'χ comes out too high, by the number of loose vertices.',
      whyItHappened: 'A vertex no face uses is not part of the surface.',
      repairStrategy: 'Count the distinct vertices in the face list: new Set(faces.flat()).size.',
    },
    {
      commonError: 'Counting edges as corner slots.',
      symptom: 'χ is very negative: a cube gives 8 − 24 + 6 = −10.',
      whyItHappened: 'Each edge is walked by two faces, so slots count it twice.',
      repairStrategy: 'Count the entries of the edge table, not the steps round the faces.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Compute χ from a face list, and read genus and boundary loops from it.',
    explainVerbally: 'Explain why Euler operations do not change χ, and what holes and rims do to it.',
    detectIncorrectApplication: 'Recognise loose vertices or slot-counting from a wrong χ.',
    transferToUnfamiliar: 'Use χ to check imports, predict seams, and connect to Gauss–Bonnet.',
  },

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-1-005-assess-1',
        type: 'choice',
        text: 'A closed mesh in one piece gives V − E + F = 0. How many holes go through it?',
        options: ['1', '0', '2', 'It cannot be closed'],
        answer: '1',
        hint: 'χ = 2 − 2g.',
      },
    ],
  },

  quiz: [
    { id: 'modelling-geometry-1-005-quiz-1', type: 'choice', text: 'What is V − E + F for a closed cube?', options: ['2', '0', '26', '−2'], answer: '2', hints: ['8 − 12 + 6.'], reviewSection: 'Intuition — the first count' },
    { id: 'modelling-geometry-1-005-quiz-2', type: 'choice', text: 'Poking a square face (a new vertex joined to its 4 corners) changes V, E, F by…', options: ['+1, +4, +3', '+1, +4, +4', '+4, +4, +1', '0, +1, +1'], answer: '+1, +4, +3', hints: ['The square is replaced by 4 triangles: 3 more faces.'], reviewSection: 'Intuition — Euler operations' },
    { id: 'modelling-geometry-1-005-quiz-3', type: 'choice', text: 'The cube with its lid off gives…', options: ['1', '2', '0', '5'], answer: '1', hints: ['One face fewer, nothing else.'], reviewSection: 'Intuition — boundary loops' },
    { id: 'modelling-geometry-1-005-quiz-4', type: 'choice', text: 'A tube and a torus both give χ = 0. What tells them apart?', options: ['The tube has 2 boundary loops', 'The torus has more faces', 'Nothing', 'The tube has more pieces'], answer: 'The tube has 2 boundary loops', hints: ['χ = 2 − 2g − b.'], reviewSection: 'Intuition — the warning' },
    { id: 'modelling-geometry-1-005-quiz-5', type: 'choice', text: 'Two separate closed cubes give…', options: ['4', '2', '0', '1'], answer: '4', hints: ['Pieces add.'], reviewSection: 'Math — several pieces' },
    { id: 'modelling-geometry-1-005-quiz-6', type: 'choice', text: 'How many seam loops does a torus need before it unwraps flat as one sheet?', options: ['2', '1', '0', '4'], answer: '2', hints: ['Round the tube and round the ring: 2g.'], reviewSection: 'Intuition — the graphics strand' },
  ],

  checkpoints: [
    { id: 'cp-modelling-geometry-1-005-1', label: 'Read V − E + F and why it is 2 for a cube and a sphere', type: 'read' },
    { id: 'cp-modelling-geometry-1-005-2', label: 'Read genus, boundary loops and χ = 2 − 2g − b', type: 'read' },
    { id: 'cp-modelling-geometry-1-005-3', label: 'Read why the genus decides the unwrap seams', type: 'read' },
    { id: 'cp-modelling-geometry-1-005-4', label: 'Complete the line-the-hole challenge in the notebook', type: 'lab' },
    { id: 'cp-modelling-geometry-1-005-5', label: 'Predict χ and the genus in MeshLab\'s trace, then make a hole in the cube', type: 'lab' },
    { id: 'cp-modelling-geometry-1-005-6', label: 'Work through the extrude example', type: 'example' },
    { id: 'cp-modelling-geometry-1-005-7', label: 'Work through the reading-the-shape example', type: 'example' },
    { id: 'cp-modelling-geometry-1-005-8', label: 'Attempt the clean-import challenge', type: 'challenge' },
  ],
};
