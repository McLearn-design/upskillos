// Lesson 1.6: welding, cleaning and filling holes (docs/modelling-course-plan.md). Four parts: the maths
// (equality within a distance, boundary loops), building it (a spatial hash to merge close points, repointing
// and compacting indices, filling a hole wound from its neighbours, and a graded choice of merge distance),
// watching MeshLab do it (a traced merge by distance in Predict mode), and using the tool (Merge by distance,
// Fill, a challenge).
import { withPicture } from '../notebookScene.js';

// One source for the code the cells show and the check runs, so the two cannot drift apart.
const WELD_SRC = `// Merge points within tol by a spatial hash: each kept point is filed in a cube-shaped cell of side tol,
// and a new point looks in its own cell and the 26 around it for the nearest kept point within tol.
function weld(verts, faces, tol) {
  const kept = [], remap = [], cells = new Map()
  const key = (c) => c.join(',')
  verts.forEach((v, i) => {
    const c = v.map((x) => Math.floor(x / tol))
    let hit = -1, best = Infinity
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const k of cells.get(key([c[0] + dx, c[1] + dy, c[2] + dz])) || []) {
        const d = Math.hypot(kept[k][0] - v[0], kept[k][1] - v[1], kept[k][2] - v[2])
        if (d <= tol && d < best) { hit = k; best = d }
      }
    }
    if (hit >= 0) { remap[i] = hit; return }
    if (!cells.has(key(c))) cells.set(key(c), [])
    cells.get(key(c)).push(kept.length)
    remap[i] = kept.length
    kept.push(v)
  })
  // Repoint every face at the kept points; drop corners repeated in a row, and faces left with under 3.
  const out = faces.map((f) => f.map((v) => remap[v]).filter((v, i, a) => v !== a[(i + 1) % a.length])).filter((f) => f.length >= 3)
  return { verts: kept, faces: out, remap }
}
// Vertices used, edges, and open edges (on one face), from the edge table.
function counts(faces) {
  const table = new Map()
  for (const f of faces) f.forEach((a, i) => { const b = f[(i + 1) % f.length], k = a < b ? a + '-' + b : b + '-' + a; table.set(k, (table.get(k) || 0) + 1) })
  return { V: new Set(faces.flat()).size, E: table.size, F: faces.length, open: [...table.values()].filter((n) => n === 1).length }
}`;

// Each face with its own copies of its corners, nudged a fraction of a millimetre, as a scan or an STL gives it.
const EXPLODE_SRC = `function explode(sides, corner) {
  const verts = [], faces = []
  for (const s of sides) faces.push(s.map((i) => {
    const c = verts.length, p = corner(i)
    verts.push([p[0] + 0.0002 * (c % 3 - 1), p[1] + 0.0001 * (c % 5 - 2), p[2] + 0.00005 * (c % 7 - 3)])
    return c
  }))
  return { verts, faces }
}`;

const PLATE_SRC = `${EXPLODE_SRC}
// A plate 1 wide, 1 deep and 0.05 thick: all six sides, exploded.
const SIDES = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]]
const plate = explode(SIDES, (i) => [i % 2, 0.05 * (Math.floor(i / 2) % 2), Math.floor(i / 4)])`;

const EQUAL = `// Coordinates are floating-point numbers, and arithmetic on them rounds.
console.log('0.1 + 0.2 === 0.3: ' + (0.1 + 0.2 === 0.3))
console.log('0.1 + 0.2 = ' + (0.1 + 0.2))
// So two points are "the same" when they are within a distance, not when they are equal.
const close = (a, b, tol) => Math.abs(a - b) <= tol
console.log('within 1e-9: ' + close(0.1 + 0.2, 0.3, 1e-9))`;

const GRID = `// Rounding each point to a grid cell and comparing cells misses points either side of a cell wall.
const tol = 0.01
const where = (x, cell) => x + ' → cell ' + cell(x / tol)
console.log('rounding: ' + where(0.0049, Math.round) + ', ' + where(0.0051, Math.round) + ': 0.0002 apart, different cells')
console.log('flooring: ' + where(0.0099, Math.floor) + ', ' + where(0.0101, Math.floor) + ': the same problem at another wall')
// The fix: a point also looks in the cells either side of its own (in 3D, the 26 cells round it).
const c = Math.floor(0.0101 / tol)
console.log('0.0101 looks in cells ' + (c - 1) + ', ' + c + ', ' + (c + 1) + ' and finds 0.0099, ' + (0.0101 - 0.0099).toFixed(4) + ' away')`;

const BOX = `${WELD_SRC}

${EXPLODE_SRC}
// A box with no lid, exploded: every face has its own copies of its corners.
const SIDES = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [0, 2, 3, 1], [4, 5, 7, 6]]
const box = explode(SIDES, (i) => [1.2 * (i % 2) - 0.6, 1.2 * (Math.floor(i / 2) % 2) - 0.6, 1.2 * Math.floor(i / 4) - 0.6])
const say = (c) => c.V + ' vertices, ' + c.E + ' edges, ' + c.open + ' open'
console.log('as scanned:          ' + say(counts(box.faces)))
const w = weld(box.verts, box.faces, 0.001)
console.log('welded within 0.001: ' + say(counts(w.faces)))
console.log('copy → vertex: ' + w.remap.join(' '))
show({ verts: w.verts, faces: w.faces, edges: true })`;

const FILL = `// The open box from lesson 1.3, and the face that fills its hole, wound from its neighbours.
const faces = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [0, 2, 3, 1], [4, 5, 7, 6]]

// The edge table, keeping which way each face walks each edge.
const table = new Map()
faces.forEach((f, fi) => f.forEach((a, i) => {
  const b = f[(i + 1) % f.length], k = a < b ? a + '-' + b : b + '-' + a
  if (!table.has(k)) table.set(k, [])
  table.get(k).push({ face: fi, from: a, to: b })
}))

// Each open edge is walked a → b by its face, so the new face walks it b → a: "after b comes a".
const next = new Map()
for (const [, on] of table) if (on.length === 1) next.set(on[0].to, on[0].from)
const start = [...next.keys()][0], loop = [start]
for (let v = next.get(start); v !== start; v = next.get(v)) loop.push(v)
console.log('rim steps (new face): ' + [...next].map(([b, a]) => b + ' → ' + a).join(', '))
console.log('new face: ' + loop.join(', '))

const all = [...faces, loop], check = new Map()
all.forEach((f) => f.forEach((a, i) => { const b = f[(i + 1) % f.length], k = a < b ? a + '-' + b : b + '-' + a; check.set(k, [...(check.get(k) || []), a]) }))
console.log('closed, every edge walked both ways: ' + [...check.values()].every((from) => from.length === 2 && from[0] !== from[1]))`;

const CHALLENGE = `// A scanned plate, 0.05 thick: 6 faces with 24 corner copies a fraction of a millimetre apart.
// Choose the merge distance so it welds into exactly the plate: 8 vertices, 6 faces, no open edges.
const distance = 0.00001

${PLATE_SRC}

${WELD_SRC}

const w = weld(plate.verts, plate.faces, distance)
const c = counts(w.faces)
console.log('distance ' + distance + ': ' + c.V + ' vertices, ' + c.F + ' faces, ' + c.open + ' open edges')
show({ verts: w.verts, faces: w.faces, edges: true })`;

const SOLVED = CHALLENGE.replace('const distance = 0.00001', 'const distance = 0.001');

// The check runs the lesson's own plate and weld (not the learner's code), with the distance they chose.
const run = new Function(`${PLATE_SRC}\n${WELD_SRC}\nreturn (d) => { const w = weld(plate.verts, plate.faces, d); return counts(w.faces) }`)();

/** The challenge's check: read the chosen distance and weld the plate with it. */
export function checkDistance(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+distance\s*=\s*([-+0-9.eE]+)/);
  const d = m ? Number(m[1]) : NaN;
  if (!Number.isFinite(d)) return no('Keep the line const distance = …, with a number.');
  if (d <= 0) return no('The distance must be more than 0.');
  const c = run(d);
  if (c.V > 8) return no(`At ${d}: ${c.V} vertices and ${c.open} open edges. Some copies of a corner are further apart than ${d}, so they were not merged.`);
  if (c.V < 8 || c.F < 6) return no(`At ${d}: ${c.V} vertices and ${c.F} faces. That is too far: corners of the plate that are really different points were merged, and faces collapsed.`);
  return { pass: true, message: `At ${d}: 8 vertices, 6 faces, ${c.open} open edges. Every copy merged with its corner, and no two real corners merged: the distance is bigger than the scanning error and smaller than the plate's thickness.` };
}

export default {
  id: 'modelling-geometry-1-006',
  slug: 'welding-and-filling',
  chapter: 'modelling-geometry-1',
  order: 6,
  title: 'Welding, Cleaning and Filling Holes',
  subtitle: 'Join copies of the same corner, then close what is still open.',
  tags: ['meshes', 'welding', 'spatial hashing', 'floating point', 'holes'],
  aliases: 'weld merge by distance remove doubles spatial hash grid floating point tolerance compact indices fill hole boundary loop stl scan cleanup meshlab',
  timeToComplete: 50,
  coreConcept: 'Files and scans often give each face its own copies of its corners. Welding merges points within a small distance, found quickly with a spatial hash that checks each point\'s own cell and its neighbours, then repoints the faces at the kept points. A hole that is still open is filled with a face whose corner order comes from its neighbours, so it points the same way they do.',
  prerequisites: ['modelling-geometry-1-005'],
  nextLesson: null,

  hook: {
    question: 'An STL file of a closed box opens with 36 vertices instead of 8: every triangle has its own three corners. Nothing is connected, every edge is open, and smooth shading shows every seam. How do you join the copies, when the numbers are close but not exactly equal?',
    realWorldContext: 'STL files, 3D scans, models exported from CAD and pieces modelled to meet all arrive like this. Every tool has the fix: Blender\'s Merge by Distance, MeshLab\'s weld, the "remove duplicate vertices" step in a game engine\'s importer, followed by filling the holes that remain.',
  },

  intuition: {
    prose: [
      'A file that stores each face with its own corners (an STL does exactly this) gives a box as faces that only look connected. Their corners sit at the same place, but they are different vertices, so the edge table (lesson 1.3) finds no shared edges, and lesson 1.4\'s search finds every face a separate piece.',
      'Welding merges the copies. If the copies were exactly equal, comparing coordinates would do. But coordinates are floating-point numbers: arithmetic rounds them, so $0.1 + 0.2$ is $0.30000000000000004$, and a scanner measures each copy separately. Two points are "the same" when they are within a small **merge distance** of each other.',
      'Comparing every point with every other is $n^2/2$ pairs. A **spatial hash** is faster: cut space into cubes, cells, as wide as the merge distance, and file each point under its cell. A point can only be within the distance of points in its own cell or the 26 cells touching it, so it looks there and nowhere else.',
      'Before reading on, predict: why not just round each point to its cell and merge points in the same cell? Because two points can be very close but either side of a cell wall. Rounding puts 0.0049 and 0.0051 in different cells of a 0.01 grid, though they are 0.0002 apart. Looking in the neighbouring cells as well catches them.',
      'Merged points get new numbers, so every face is **repointed**: each corner number is replaced through a remap list. Faces that used separate copies now share vertices, and the shared edges appear. A face whose corners merged into fewer than three is dropped.',
      'What is still open is a hole: a boundary loop of open edges. To **fill** it, make one face round the loop. Its corner order is not a free choice: each rim edge is walked one way by the face beside it, and the new face must walk it the other way (lesson 1.3), so following "after this corner comes that one" round the loop gives the order, and the new face points out like its neighbours.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Weld, then fill',
        body: 'Step 1. Choose a merge distance: bigger than the error between copies, smaller than the shortest real edge.\nStep 2. For each point, look in its cell and the 26 around it for the nearest kept point within the distance. Found: map the point to it. Not found: keep it, and file it in its cell.\nStep 3. Repoint every face through the map; drop repeated corners, and faces left with fewer than 3.\nStep 4. Find the open edges; each boundary loop is a hole.\nStep 5. Fill a hole: for each rim edge walked $a \\to b$ by its face, the new face walks $b \\to a$; follow these steps round the loop.',
      },
      {
        type: 'warning',
        title: 'Too large a distance destroys detail',
        body: 'A merge distance bigger than a real edge merges the two ends of that edge: thin parts collapse and faces disappear. Start small (Blender\'s default is 0.0001) and raise it only until the copies merge.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: cracks and double edges',
        body: 'An unwelded mesh draws wrongly in three ways. Smooth shading averages normals only over the faces sharing a vertex, so copies keep each face\'s own normal and every edge shows as a hard seam. Where two copies of an edge are not exactly in the same place, the triangles either side can leave a row of uncovered pixels between them: a crack. And the wireframe draws every copy of every edge, so each shared edge is drawn twice. Welding fixes all three.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: weld and fill',
        props: {
          lesson: {
            title: 'Welding and filling',
            subtitle: 'Compare numbers within a distance, see why a grid needs its neighbours, weld a scanned box, fill its hole, and choose a merge distance.',
            cells: [
              { type: 'js', instruction: '### 1. Equal, or close?\nFloating-point arithmetic rounds. Two numbers that should be equal are compared within a distance.', startCode: EQUAL },
              { type: 'js', instruction: '### 2. Cell walls\nWhichever way points are put into cells, two close points can land either side of a wall. Looking in the neighbouring cells catches them.', startCode: GRID },
              { type: 'js', instruction: '### 3. Weld a scanned box\nA box with no lid, every face with its own corner copies a fraction of a millimetre apart: 20 vertices, all 20 edges open. Welded within 0.001: 8 vertices, 12 edges, 4 open round the top (orange). The last line is the remap: which vertex each copy became.', startCode: withPicture(BOX), showPreviewByDefault: true, outputHeight: 340 },
              { type: 'js', instruction: '### 4. Fill the hole\nEach open edge says how the new face must walk it; following those steps round the rim gives the lid, wound the same way as the rest of the box.', startCode: FILL },
              { type: 'challenge', instruction: '### 5. Challenge: choose the merge distance\nA scanned plate 0.05 thick. Too small a distance leaves copies apart; too large merges the plate\'s top and bottom. Change only the distance until the weld gives exactly the plate. The check welds the plate with your distance.', startCode: withPicture(CHALLENGE), solutionCode: withPicture(SOLVED), check: checkDistance, showPreviewByDefault: true, outputHeight: 340 },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Welding and filling" in MeshLab](#/lab/mesh-lab?project=welding-and-filling). It makes two scanned boxes like cell 3\'s. It shows that weld(0), which merges only exact copies, changes nothing, then merges one box within 0.001 with **Record traces** on. The Algorithm trace is in **Predict** mode: each step is one copy, its cell, and what it found nearby. The question comes at the first copy whose match is across a cell wall: which kept point does it become? Then merge and fill the other box yourself.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Mesh › Merge by distance** (edit mode) welds the whole mesh within 0.001; change the distance afterwards in the Inspector\'s Adjust section. In a script: mesh.weld(0.001).\n- **Mesh › Fill** (F) closes a hole: select every vertex round it in vertex select. It is wound from the faces beside it.\n- The Inspector\'s MESH section shows the result: vertices, open edges, separate pieces.\n- **In Blender:** Mesh › Clean Up › Merge by Distance (also M › By Distance), with the distance in the operator panel; F fills a selected loop, and Mesh › Clean Up › Fill Holes fills them all.\n- Practise filling: [MeshLab challenge: Close the box](#/lab/mesh-lab?challenge=close-the-box).' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      'Points $p$ and $q$ are merged when $|p - q| \\le \\varepsilon$, the merge distance. With cells of side $\\varepsilon$, point $p$ is in cell $(\\lfloor p_x / \\varepsilon \\rfloor, \\lfloor p_y / \\varepsilon \\rfloor, \\lfloor p_z / \\varepsilon \\rfloor)$. If $|p - q| \\le \\varepsilon$, each coordinate differs by at most $\\varepsilon$, so their cells differ by at most 1 in each coordinate: $q$ is in one of the $3^3 = 27$ cells round $p$.',
      'A good merge distance sits between two lengths: the largest distance $e$ between copies of one corner, and the shortest real edge $\\ell$. Any $\\varepsilon$ with $e \\le \\varepsilon < \\ell$ merges every copy and no real corners. For the challenge\'s plate, $e \\approx 0.0006$ and $\\ell = 0.05$.',
      'Repointing uses a remap list $r$: copy $i$ becomes vertex $r(i)$. A face $(i_0, \\ldots, i_{k-1})$ becomes $(r(i_0), \\ldots, r(i_{k-1}))$, with repeats in a row removed. Compacting is the same idea: renumber the vertices that are still used as $0, 1, 2, \\ldots$ with no gaps, and repoint.',
      'The fill rule: if the rim edge $\\{a, b\\}$ is walked $a \\to b$ by its only face, the new face walks $b \\to a$. Every rim vertex starts exactly one such step and ends one, so the steps form a single cycle round the hole: the new face.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Merging within a distance is not transitive: $p$ can be within $\\varepsilon$ of $q$, and $q$ of $r$, while $p$ and $r$ are further apart. The weld here keeps the first point of each group and merges later points into the nearest kept point, so a chain of close points does not slide into one. Other tools merge whole chains; both agree when the copies are much closer than $\\varepsilon$ and the corners much further.',
      'Cost: each point is filed once and looks at the points in 27 cells. With a sensible $\\varepsilon$ each cell holds a few points, so welding $n$ points takes about $27n$ comparisons instead of $n^2/2$: for a 100,000-point scan, millions instead of 5 billion.',
      'Filling uses the edge table\'s directions, so it needs the faces round the hole to be wound consistently with each other (lesson 1.2). If they are not, two rim edges disagree, and the steps do not form one loop: MeshLab then refuses rather than make a face that points the wrong way.',
      'Welding changes topology (lessons 1.3 to 1.5): open edges become shared, pieces join, and V − E + F changes. The scanned box goes from 5 pieces with $\\chi = 20 - 20 + 5 = 5$ to one open box with $\\chi = 8 - 12 + 5 = 1$, and filling makes it $8 - 12 + 6 = 2$.',
    ],
    callouts: [
      { type: 'insight', title: 'Bridge: from the 27 cells to code', body: 'The three nested loops over dx, dy, dz in weld are the 27 cells; the hypot test is $|p - q| \\le \\varepsilon$.' },
      { type: 'insight', title: 'Bridge: from code to the screen', body: 'After welding, shared vertices let smooth shading average across edges, and the wireframe draws each edge once.' },
      { type: 'insight', title: 'Bridge: from the screen to MeshLab', body: 'Mesh › Merge by distance runs mesh.weld(0.001), traced copy by copy; Mesh › Fill runs mesh.fill, traced rim edge by rim edge.' },
    ],
    visualizations: [],
  },

  examples: [
    {
      id: 'modelling-geometry-1-006-ex1',
      title: 'Which cells to look in',
      difficulty: 'easy',
      problem: 'The merge distance is 0.01. A point is at x = 0.0101 (look at x only). Which cells must it look in?',
      steps: [
        { expression: '\\lfloor 0.0101 / 0.01 \\rfloor = 1', annotation: 'Its own cell.', strategyTitle: 'Step 1: Its cell' },
        { expression: '\\text{cells } 0, 1, 2', annotation: 'A point within 0.01 can be at most one cell away.', strategyTitle: 'Step 2: Neighbours' },
      ],
      answer: 'Cells 0, 1 and 2 (in 3D, the 27 cells round it).',
    },
    {
      id: 'modelling-geometry-1-006-ex2',
      title: 'Welding the scanned box',
      difficulty: 'medium',
      problem: 'A box with no lid has 5 faces, each with its own 4 corner copies. What are the counts before and after welding?',
      steps: [
        { expression: '20 \\text{ vertices, } 20 \\text{ edges, all open}', annotation: 'No two faces share a vertex, so no edge is shared.', strategyTitle: 'Step 1: Before' },
        { expression: '8 \\text{ vertices, } 12 \\text{ edges, } 4 \\text{ open}', annotation: 'Each corner\'s copies merge; the shared edges appear; the rim stays open.', strategyTitle: 'Step 2: After' },
      ],
      answer: 'Before: 20 vertices, 20 open edges, 5 pieces. After: 8 vertices, 12 edges, 4 open, 1 piece.',
    },
    {
      id: 'modelling-geometry-1-006-ex3',
      title: 'Winding the lid',
      difficulty: 'hard',
      problem: 'In the open box, face 0 = [0, 4, 6, 2] walks its rim edge 6 → 2. Which way does the lid walk that edge, and what does that fix?',
      steps: [
        { expression: '6 \\to 2 \\Rightarrow \\text{lid walks } 2 \\to 6', annotation: 'Neighbours walk a shared edge in opposite directions.', strategyTitle: 'Step 1: The rule' },
        { expression: '\\text{lid} = (2, 6, 7, 3)', annotation: 'The other three rim edges fix the rest of the loop the same way.', strategyTitle: 'Step 2: The loop' },
      ],
      answer: 'The lid walks 2 → 6; following all four rim edges gives (2, 6, 7, 3) or a rotation of it, which points up, out of the box.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-1-006-ch1',
      title: 'An STL cube',
      difficulty: 'easy',
      problem: 'An STL file stores a cube as 12 triangles, each with its own 3 corners. How many vertices before and after welding?',
      hint: 'Corner slots before; the cube\'s corners after.',
      answer: '36 before, 8 after.',
      walkthrough: [],
    },
    {
      id: 'modelling-geometry-1-006-ch2',
      title: 'Why 27?',
      difficulty: 'medium',
      problem: 'Why does a point look in 27 cells when the cells are as wide as the merge distance? Would 8 do?',
      hint: 'Where can a point within the distance be, in each coordinate?',
      answer: 'In each coordinate the other point can be in the cell below, the same cell or the cell above: 3 × 3 × 3 = 27. 8 cells would do only if you first chose, in each coordinate, the side of the cell the point is nearer to.',
      walkthrough: [],
    },
    {
      id: 'modelling-geometry-1-006-ch3',
      title: 'A thin wall',
      difficulty: 'hard',
      problem: 'A scanned part has a wall 0.2 mm thick, and its copies are up to 0.03 mm apart. Which merge distances are safe?',
      hint: 'Bigger than the error, smaller than the thinnest real distance.',
      answer: 'From 0.03 mm up to (not including) 0.2 mm; something like 0.05 mm leaves room either side.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      { symbol: '\\varepsilon', meaning: 'The merge distance: points this close or closer are joined.' },
      { symbol: '|p - q| \\le \\varepsilon', meaning: 'The test for "the same point".' },
      { symbol: '\\text{spatial hash}', meaning: 'Points filed by the cube-shaped cell they are in, so near points are found by looking in a few cells.' },
      { symbol: 'r(i)', meaning: 'The remap list: the vertex copy $i$ became.' },
      { symbol: '\\text{boundary loop}', meaning: 'A loop of open edges: the rim of a hole.' },
      { symbol: '\\text{fill}', meaning: 'A new face round a boundary loop, wound opposite to the faces beside it along each rim edge.' },
    ],
    rulesOfThumb: [
      'Never compare coordinates with ===; compare within a distance.',
      'Merge distance: above the copy error, below the shortest real edge.',
      'Look in the neighbouring cells, not only the point\'s own.',
      'Weld first, then look for holes; fill each hole from its neighbours\' winding.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'Faces whose corners are in the same place are connected.',
      whyStudentsThinkIt: 'On screen they meet.',
      correctionExample: 'The scanned box looks closed at the sides but has 20 open edges and 5 pieces until it is welded.',
      contrastCase: 'After welding the corners are shared vertices, and the edges between faces are shared too.',
    },
    {
      falseBelief: 'A larger merge distance is always safer.',
      whyStudentsThinkIt: 'It catches more copies.',
      correctionExample: 'At 0.06 the 0.05-thick plate collapses to 4 vertices and 2 faces.',
      contrastCase: 'A distance just above the copy error merges every copy and nothing else.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A 100,000-point scan needs its duplicate corners merged.',
      competingTechniques: ['A spatial hash with cells as wide as the merge distance', 'Comparing every pair of points'],
      whyThisTechniqueWins: 'About 27 comparisons per point instead of 5 billion pairs in all.',
    },
    {
      situation: 'A welded model still has a square hole where a face is missing.',
      competingTechniques: ['Fill, taking the order from the open edges', 'Typing the four corners in any order'],
      whyThisTechniqueWins: 'Only one of the two orders points out; the open edges say which.',
    },
  ],

  debugging: [
    {
      commonError: 'Looking only in the point\'s own cell.',
      symptom: 'Most copies merge, but a few corners stay doubled, seemingly at random.',
      whyItHappened: 'Those copies are either side of a cell wall.',
      repairStrategy: 'Look in the 26 neighbouring cells as well.',
    },
    {
      commonError: 'Merging the vertices but not repointing the faces.',
      symptom: 'Faces use numbers past the end of the vertex list, or the wrong corners.',
      whyItHappened: 'Kept vertices are renumbered; faces still hold the old numbers.',
      repairStrategy: 'Replace every corner number through the remap list, then drop repeated corners and collapsed faces.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Weld a mesh with a spatial hash, repoint its faces, and fill a hole with the right winding.',
    explainVerbally: 'Explain why points are compared within a distance, why 27 cells, and how the fill order is fixed.',
    detectIncorrectApplication: 'Recognise a missing neighbour search, a missing repoint, or a merge distance that is too large.',
    transferToUnfamiliar: 'Choose a merge distance from the copy error and the shortest real edge, for any scan or file.',
  },

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-1-006-assess-1',
        type: 'choice',
        text: 'Copies are up to 0.0006 apart and the shortest real edge is 0.05. Which merge distance is safe?',
        options: ['0.001', '0.0001', '0.06', '1'],
        answer: '0.001',
        hint: 'Above the copy error, below the shortest edge.',
      },
    ],
  },

  quiz: [
    { id: 'modelling-geometry-1-006-quiz-1', type: 'choice', text: 'Why are coordinates compared within a distance?', options: ['Floating-point arithmetic and measurement leave tiny differences', 'To make welding slower', 'Because === does not work on arrays of numbers', 'To move the points'], answer: 'Floating-point arithmetic and measurement leave tiny differences', hints: ['0.1 + 0.2.'], reviewSection: 'Intuition — equal or close' },
    { id: 'modelling-geometry-1-006-quiz-2', type: 'choice', text: 'With cells as wide as the merge distance, how many cells does a point look in?', options: ['27', '1', '8', '6'], answer: '27', hints: ['3 in each of 3 coordinates.'], reviewSection: 'Math — the cells' },
    { id: 'modelling-geometry-1-006-quiz-3', type: 'choice', text: 'Rounding to a 0.01 grid puts 0.0049 and 0.0051 in…', options: ['Different cells, though they are 0.0002 apart', 'The same cell', 'No cell', 'Cells 0.5 apart'], answer: 'Different cells, though they are 0.0002 apart', hints: ['0.49 rounds to 0, 0.51 to 1.'], reviewSection: 'Intuition — cell walls' },
    { id: 'modelling-geometry-1-006-quiz-4', type: 'choice', text: 'After merging, the faces must be…', options: ['Repointed through the remap list', 'Deleted', 'Flipped', 'Sorted'], answer: 'Repointed through the remap list', hints: ['The kept vertices are renumbered.'], reviewSection: 'Intuition — repointing' },
    { id: 'modelling-geometry-1-006-quiz-5', type: 'choice', text: 'A rim edge is walked 6 → 2 by its face. The fill face walks it…', options: ['2 → 6', '6 → 2', 'Either way', 'Not at all'], answer: '2 → 6', hints: ['Neighbours walk a shared edge in opposite directions.'], reviewSection: 'Examples — winding the lid' },
    { id: 'modelling-geometry-1-006-quiz-6', type: 'choice', text: 'An unwelded mesh with smooth shading shows…', options: ['A hard seam along every edge', 'No difference', 'Inverted normals', 'A brighter surface'], answer: 'A hard seam along every edge', hints: ['Normals are averaged only over faces sharing a vertex.'], reviewSection: 'Intuition — the graphics strand' },
  ],

  checkpoints: [
    { id: 'cp-modelling-geometry-1-006-1', label: 'Read why points are compared within a distance', type: 'read' },
    { id: 'cp-modelling-geometry-1-006-2', label: 'Read the spatial hash and why it checks 27 cells', type: 'read' },
    { id: 'cp-modelling-geometry-1-006-3', label: 'Read how unwelded meshes draw wrongly', type: 'read' },
    { id: 'cp-modelling-geometry-1-006-4', label: 'Complete the merge-distance challenge in the notebook', type: 'lab' },
    { id: 'cp-modelling-geometry-1-006-5', label: 'Predict the cross-wall merge in MeshLab\'s trace, then weld and fill your box', type: 'lab' },
    { id: 'cp-modelling-geometry-1-006-6', label: 'Work through the scanned-box example', type: 'example' },
    { id: 'cp-modelling-geometry-1-006-7', label: 'Work through the winding-the-lid example', type: 'example' },
    { id: 'cp-modelling-geometry-1-006-8', label: 'Attempt the thin-wall challenge', type: 'challenge' },
  ],
};
