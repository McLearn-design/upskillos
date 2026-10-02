// Lesson 1.3: edges and neighbours (docs/modelling-course-plan.md). Four parts: the maths (edges from faces,
// counting corner slots twice, open and non-manifold edges), building it (an edge table as a hash map, and a
// graded face-list fix), watching MeshLab do it (a traced edge-table build in Predict mode), and using the tool
// (Wire, the status-bar counts, Edit › Select non-manifold, a challenge).
import { withPicture } from '../notebookScene.js';
import { readFaces, edgeTable } from '../faceList.js';

const CUBE_VERTS = `// Vertex i is at (i % 2, ⌊i / 2⌋ % 2, ⌊i / 4⌋): the corners of a unit cube.
const vertices = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]]`;

const TABLE_FN = `// The edge table: a Map from an edge's key to the faces on it.
function edgeTable(faces) {
  const table = new Map()
  faces.forEach((f, fi) => {
    for (let i = 0; i < f.length; i++) {
      const a = f[i], b = f[(i + 1) % f.length]          // each corner and the next, wrapping round
      const key = a < b ? a + '-' + b : b + '-' + a     // smallest first, so a → b and b → a are one edge
      if (!table.has(key)) table.set(key, [])
      table.get(key).push(fi)
    }
  })
  return table
}`;

const CUBE = `${CUBE_VERTS}
const faces = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]]

${TABLE_FN}

const table = edgeTable(faces)
for (const [key, on] of table) console.log(key + ': faces ' + on.join(', '))
const count = (n) => [...table.values()].filter((on) => on.length === n).length
console.log(table.size + ' edges: ' + count(1) + ' open, ' + count(2) + ' shared by two faces')
console.log('corner slots: ' + faces.flat().length + ' = 2 × ' + table.size)`;

const UNSORTED = `// The same table with the key written a + '-' + b, not sorted.
const faces = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]]
const table = new Map()
faces.forEach((f, fi) => f.forEach((a, i) => {
  const b = f[(i + 1) % f.length], key = a + '-' + b        // the bug: the direction is part of the key
  if (!table.has(key)) table.set(key, [])
  table.get(key).push(fi)
}))
console.log(table.size + ' entries, ' + [...table.values()].filter((on) => on.length === 1).length + ' of them with only one face')
console.log("'0-4': faces " + table.get('0-4') + "   '4-0': faces " + table.get('4-0'))`;

const OPEN_BOX = `${CUBE_VERTS}
// The cube without its lid (the face at y = 1).
const faces = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [0, 2, 3, 1], [4, 5, 7, 6]]

${TABLE_FN}

const table = edgeTable(faces)
const open = [...table].filter(([, on]) => on.length === 1).map(([key]) => key)
console.log(table.size + ' edges, ' + open.length + ' open: ' + open.join(', '))
console.log('corner slots: ' + faces.flat().length + ' = 2 × ' + (table.size - open.length) + ' + 1 × ' + open.length)
show({ verts: vertices, faces, edges: true })`;

const NEIGHBOURS = `${CUBE_VERTS}
const faces = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [0, 2, 3, 1], [4, 5, 7, 6]]

${TABLE_FN}

// A face's neighbours: across each of its edges, in order round it, the other face on that edge ('-' for none).
const table = edgeTable(faces)
faces.forEach((f, fi) => {
  const across = f.map((a, i) => {
    const b = f[(i + 1) % f.length], on = table.get(a < b ? a + '-' + b : b + '-' + a)
    const others = on.filter((g) => g !== fi)
    return others.length === 1 ? others[0] : '-'
  })
  console.log('face ' + fi + ': ' + across.join(', '))
})

// What the table saves: comparing every face with every other face, against one lookup per corner.
const F = 10000
console.log(F + ' quads: ' + (F * (F - 1)) / 2 + ' pairs of faces to compare, or ' + 4 * F + ' lookups')`;

const CHALLENGE = `// This box has two problems: its lid is missing, and an extra face, a fin, cuts through it diagonally.
// Fix the face list so every edge is on exactly two faces, walked in opposite directions by the two.
// Edges are coloured by how many faces they are on: orange one, grey two, red three or more.
${CUBE_VERTS}
const faces = [
  [0, 4, 6, 2],
  [1, 3, 7, 5],
  [0, 1, 5, 4],
  [0, 2, 3, 1],
  [4, 5, 7, 6],
  [0, 1, 7, 6],
]
show({ verts: vertices, faces, edges: true })`;

const SOLVED = CHALLENGE.replace('  [0, 1, 7, 6],\n', '  [2, 6, 7, 3],\n');

const CUBE_V = Array.from({ length: 8 }, (_, i) => [i % 2, Math.floor(i / 2) % 2, Math.floor(i / 4)]);

/**
 * The challenge's check: read the face list (without running it), build its edge table, and say what is wrong,
 * naming the edges or faces, but not how to fix them.
 */
export function checkClosed(code) {
  const no = (message) => ({ pass: false, message });
  const { faces, error } = readFaces(code);
  if (error) return no(error);
  for (const [i, f] of faces.entries()) {
    if (f.length < 3) return no(`Face ${i} has ${f.length} corner${f.length === 1 ? '' : 's'}: a face needs at least 3.`);
    if (f.some((v) => v < 0 || v > 7)) return no(`Face ${i} uses a vertex that does not exist: they are numbered 0 to 7.`);
    if (new Set(f).size !== f.length) return no(`Face ${i} lists the same corner twice.`);
  }
  const table = edgeTable(faces);
  const where = (pick) => [...table].filter(([, on]) => pick(on)).map(([key]) => key);
  const many = where((on) => on.length > 2);
  if (many.length) {
    const [key] = many, on = table.get(key).map((x) => x.face);
    return no(`Edge ${key} is on ${on.length} faces (${on.join(', ')})${many.length > 1 ? `, and so ${many.length === 2 ? 'is edge' : 'are edges'} ${many.slice(1).join(', ')}` : ''}. An edge of a solid is on exactly two.`);
  }
  const open = where((on) => on.length === 1);
  if (open.length) return no(`Edge${open.length === 1 ? '' : 's'} ${open.join(', ')} ${open.length === 1 ? 'is' : 'are'} on only one face: the surface is open there.`);
  const same = [...table.values()].find(([x, y]) => x.from === y.from);
  if (same) return no(`Faces ${same[0].face} and ${same[1].face} both go from vertex ${same[0].from} to vertex ${same[0].to}. Two faces wound the same way round walk their shared edge in opposite directions, so one of them is wound the wrong way (lesson 1.2).`);
  if (new Set(faces.flat()).size !== 8) return no('Every edge is on two faces, but not every vertex is used: the box has 8 corners.');
  const side = faces.findIndex((f) => ![0, 1, 2].some((j) => f.every((v) => CUBE_V[v][j] === CUBE_V[f[0]][j])));
  if (side >= 0 || faces.length !== 6) return no(side >= 0 ? `Face ${side} is not a side of the box: its corners do not all share an x, a y or a z.` : `The box has 6 sides; the list has ${faces.length} faces.`);
  return { pass: true, message: `Every one of the ${table.size} edges is on exactly two faces, walked in opposite directions: a closed box.` };
}

export default {
  id: 'modelling-geometry-1-003',
  slug: 'edges-and-neighbours',
  chapter: 'modelling-geometry-1',
  order: 3,
  title: 'Edges and Neighbours',
  subtitle: 'The edges are not stored anywhere: they are found from the faces, with a table.',
  tags: ['meshes', 'edges', 'manifold', 'hash map', 'wireframe'],
  aliases: 'edge table hash map manifold non-manifold boundary open edge neighbours adjacency wireframe select non manifold meshlab',
  timeToComplete: 45,
  coreConcept: 'A mesh stores only vertices and faces; its edges are the pairs of corners next to each other round a face, collected in a table keyed by the two vertex numbers smallest first. Counting the faces on each edge tells you whether it is open (1), shared (2) or non-manifold (3+), and which faces are neighbours.',
  prerequisites: ['modelling-geometry-1-002'],
  nextLesson: null,

  hook: {
    question: 'The cube from lesson 1.1 is two lists: 8 vertices and 6 faces. It has 12 edges, yet neither list mentions one. Where do the edges come from, and how does a tool know an edge is on the rim of a hole?',
    realWorldContext: 'Every modelling tool builds this table. It is how a tool draws the wireframe, finds holes before 3D printing, walks from a face to its neighbours for selection and smoothing, and warns you that a model is "non-manifold", which a printer slicer or a game engine may refuse.',
  },

  intuition: {
    prose: [
      'Walk round a face of the cube, say face 0 = [0, 4, 6, 2]. Each step from one corner to the next is an edge: 0 → 4, 4 → 6, 6 → 2, and 2 → 0 back to the start. A face with $k$ corners has $k$ edges.',
      'Now walk face 2 = [0, 1, 5, 4]. Its last step is 4 → 0: the same edge face 0 walked as 0 → 4, the other way round. Edges are shared, so listing every face\'s steps lists every edge more than once.',
      'The fix is a **table**: file each edge under a key made from its two vertex numbers, smallest first. Both 0 → 4 and 4 → 0 file under "0-4", so the second face finds the first face\'s entry and adds itself to it. The table ends up with each edge once, and the faces on it.',
      'Before reading on, predict: the cube\'s faces have $6 \\times 4 = 24$ corner slots. How many edges are there? Each edge is walked once by each of its two faces, so $24 = 2 \\times 12$: 12 edges.',
      'The number of faces on an edge says what kind of edge it is. **Two** is normal: a closed surface, like the cube, has two faces on every edge. **One** is an **open edge**: the rim of a hole. Take the cube\'s lid away and the four edges round the top have one face each. **Three or more** is **non-manifold**: no solid object has such an edge, and tools warn about it.',
      'The table also answers "which faces are next to this one?" Across each edge of a face is the other face on that edge: its **neighbour**. On the open box the bottom has four neighbours; each side has three, and one edge with nothing across it.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Build the edge table',
        body: 'Step 1. Start with an empty table (a hash map from key to a list of faces).\nStep 2. For each face, take each corner $a$ and the next corner $b$, wrapping from the last back to the first.\nStep 3. Make the key from $a$ and $b$, smallest first, so both directions give the same key.\nStep 4. If the key is new, add it with this face; if it is there, add this face to its list.\nStep 5. Read off: 1 face is open, 2 is shared, 3 or more is non-manifold.',
      },
      {
        type: 'warning',
        title: 'Sort the key',
        body: 'Written as $a$-$b$ in the order walked, 0 → 4 files under "0-4" and 4 → 0 under "4-0". The cube then has 24 entries, every one with a single face, and a perfectly closed box reads as all holes.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: drawing the wireframe',
        body: 'A wireframe is drawn as line segments: the GPU receives two vertex indices per line. Drawn from the edge table, the cube is 12 lines (24 indices), each edge once. Drawing each face\'s outline instead draws every shared edge twice. A triangulated mesh has diagonals too: three.js\'s WireframeGeometry draws the triangles\' edges, diagonals included, while EdgesGeometry keeps only edges where the faces meet at an angle (more than 1° by default) or the surface ends. MeshLab\'s Wire overlay draws its edge table: one line per entry.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: the edge table',
        props: {
          lesson: {
            title: 'Edges from faces',
            subtitle: 'Build the edge table, see what breaks it, read open edges and neighbours from it, and fix a broken box.',
            cells: [
              { type: 'js', instruction: '### 1. The cube\'s edge table\nRun it. Every one of the 12 edges is on two faces, and the 24 corner slots are 2 × 12.', startCode: CUBE },
              { type: 'js', instruction: '### 2. Without sorting the key\nThe same table with the key in the order walked. Each edge is filed twice, once per direction, and every entry has one face.', startCode: UNSORTED },
              { type: 'js', instruction: '### 3. An open box\nTake the lid away. Four edges have one face: the rim. The slots still add up: 20 = 2 × 8 + 1 × 4. In the picture open edges are orange; drag it to turn it.', startCode: withPicture(OPEN_BOX), showPreviewByDefault: true, outputHeight: 340 },
              { type: 'js', instruction: '### 4. Neighbours, and what the table saves\nAcross each edge of a face is its neighbour; - marks an open edge. Then the cost: one lookup per corner, against comparing every pair of faces.', startCode: NEIGHBOURS },
              { type: 'challenge', instruction: '### 5. Challenge: close the box\nThe lid is missing and a fin cuts through the box. Fix the face list until every edge is on exactly two faces, walked in opposite directions. The check builds your edge table and names any edge that is open or on too many faces.', startCode: withPicture(CHALLENGE), solutionCode: withPicture(SOLVED), check: checkClosed, showPreviewByDefault: true, outputHeight: 340 },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Edges and neighbours" in MeshLab](#/lab/mesh-lab?project=edges-and-neighbours). It builds the same open box, prints its edge table (the same 12 entries as cell 3), and builds the table again with **Record traces** on. The Algorithm trace is in **Predict** mode. Faces 0 and 1 share no edge, so every key they file is new; the first key already in the table is face 2\'s edge from vertex 1 to vertex 5, and the trace asks how many faces that edge has then, and how many edges the table holds. At the end it asks how many edges are open.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Wire** in MeshLab\'s toolbar draws the edge table: one line per edge.\n- The **status bar** at the bottom counts verts, edges and faces, and adds the open edges, and edges on 3+ faces, when there are any.\n- **Edit › Select non-manifold** (Shift+Ctrl+Alt+M) selects every edge not on exactly two faces: the open ones and the ones on three or more.\n- **In Blender:** Viewport Overlays › Statistics shows the vertex, edge and face counts. In edit mode, Select › Select All by Trait › Non Manifold (the same Shift+Ctrl+Alt+M) selects open and non-manifold edges.\n- Practise on a box with a fin through it: [MeshLab challenge: Remove the fin](#/lab/mesh-lab?challenge=remove-the-fin).' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      'For a face $f = (v_0, v_1, \\ldots, v_{k-1})$, its edges are the pairs $\\{v_i, v_{i+1}\\}$ for $i = 0, \\ldots, k-1$, with $v_k = v_0$. An edge is a set of two vertices, not an ordered pair: $\\{0, 4\\} = \\{4, 0\\}$. Writing the smaller number first is how a program makes the set into one key.',
      'Count the pairs (face, edge of that face) two ways. By faces: each face $f$ has $|f|$ edges, so the count is $\\sum_f |f|$, the corner slots. By edges: each edge $e$ is on $n(e)$ faces, so the count is $\\sum_e n(e)$. Both count the same pairs, so $\\sum_f |f| = \\sum_e n(e)$.',
      'On a closed surface every $n(e) = 2$, so $E = \\tfrac{1}{2} \\sum_f |f|$. The cube: $E = \\tfrac{1}{2} \\times 24 = 12$. The open box has 20 slots, 4 open edges and 8 shared: $20 = 2 \\times 8 + 1 \\times 4$.',
      'Two faces are neighbours when they share an edge. The neighbour relation is the face graph: a node per face and a link per shared edge. The open box\'s face graph has 5 nodes and 8 links, one per shared edge.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'A surface mesh is **edge-manifold** when every edge is on one or two faces: two in the interior, one on the boundary. An edge on three or more faces cannot be flattened into a piece of a plane around it, which is what "manifold" means.',
      'Edges are not the whole story: two cubes touching at a single corner have every edge on exactly two faces, yet the shared corner is non-manifold, because the faces round it form two separate fans. A full manifold check also looks at the faces round each vertex.',
      'Cost: with a hash map, each lookup takes constant time on average, so building the table is $O(\\sum_f |f|)$: linear in the size of the face list. Comparing every face with every other face to find shared edges is $O(F^2)$: for 10,000 quads, 49,995,000 pairs against 40,000 lookups.',
      'Consistent winding shows in the table: two faces wound the same way round walk their shared edge in opposite directions. A table that keeps the direction of each walk can check a whole mesh\'s winding in one pass, which is what the challenge\'s check does.',
    ],
    callouts: [
      { type: 'insight', title: 'Bridge: from counting to code', body: 'The identity $\\sum_f |f| = \\sum_e n(e)$ is cell 1\'s last line: 24 corner slots, 12 edges, two faces each.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'The edge table is also the index buffer for a wireframe: two indices per entry, each edge drawn once.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'MeshLab\'s Wire overlay, its status-bar counts and Select non-manifold all read the same table, built by the method in cell 1.' },
    ],
    visualizations: [],
  },

  examples: [
    {
      id: 'modelling-geometry-1-003-ex1',
      title: 'Edges of a closed prism',
      difficulty: 'easy',
      problem: 'A closed triangular prism has 2 triangles and 3 quads. How many edges does it have?',
      steps: [
        { expression: '\\sum_f |f| = 2 \\times 3 + 3 \\times 4 = 18', annotation: 'The corner slots.', strategyTitle: 'Step 1: Count slots' },
        { expression: 'E = \\tfrac{1}{2} \\times 18 = 9', annotation: 'Closed, so every edge is on two faces.', strategyTitle: 'Step 2: Halve' },
      ],
      answer: '9 edges.',
    },
    {
      id: 'modelling-geometry-1-003-ex2',
      title: 'The open box',
      difficulty: 'medium',
      problem: 'The cube without its lid: faces [0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [0, 2, 3, 1], [4, 5, 7, 6]. Which edges are open?',
      steps: [
        { expression: '\\text{build the table: 12 keys}', annotation: 'Each face adds its four edges; 8 keys are found a second time.', strategyTitle: 'Step 1: Build the table' },
        { expression: '\\text{2-6, 3-7, 2-3, 6-7 have one face}', annotation: 'They are the four edges of the missing lid.', strategyTitle: 'Step 2: Read off' },
        { expression: '20 = 2 \\times 8 + 1 \\times 4', annotation: 'The slots agree.', strategyTitle: 'Step 3: Check' },
      ],
      answer: 'Edges 2-6, 3-7, 2-3 and 6-7: the rim where the lid was.',
    },
    {
      id: 'modelling-geometry-1-003-ex3',
      title: 'A face\'s neighbours',
      difficulty: 'hard',
      problem: 'In the open box, which faces are across the edges of face 1 = [1, 3, 7, 5], in order?',
      steps: [
        { expression: '1 \\to 3:\\ \\text{key 1-3, faces 1, 3} \\Rightarrow 3', annotation: 'The other face on that edge.', strategyTitle: 'Step 1: First edge' },
        { expression: '3 \\to 7:\\ \\text{key 3-7, face 1 only} \\Rightarrow -', annotation: 'An open edge: nothing across it.', strategyTitle: 'Step 2: Second edge' },
        { expression: '7 \\to 5 \\Rightarrow 4,\\quad 5 \\to 1 \\Rightarrow 2', annotation: 'The last two edges.', strategyTitle: 'Step 3: The rest' },
      ],
      answer: '3, -, 4, 2: three neighbours and one open edge.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-1-003-ch1',
      title: 'The pyramid\'s edges',
      difficulty: 'easy',
      problem: 'The closed square pyramid from lessons 1.1 and 1.2 has a square base and 4 triangles. How many edges?',
      hint: 'Count the corner slots and halve.',
      answer: '8: the slots are 4 + 4 × 3 = 16, and 16 / 2 = 8.',
      walkthrough: [{ expression: '\\tfrac{1}{2}(4 + 12) = 8', annotation: 'Four round the base, four up to the tip.' }],
    },
    {
      id: 'modelling-geometry-1-003-ch2',
      title: 'Two quads',
      difficulty: 'medium',
      problem: 'Faces [0, 1, 2, 3] and [1, 4, 5, 2] share an edge. How many edges are there, and how many are open?',
      hint: 'Which key do both faces file?',
      answer: '7 edges: 1-2 is shared, the other 6 are open (8 slots = 2 × 1 + 1 × 6).',
      walkthrough: [],
    },
    {
      id: 'modelling-geometry-1-003-ch3',
      title: 'Why not compare faces?',
      difficulty: 'hard',
      problem: 'A scan has 10,000 quads. Finding shared edges by comparing every face with every other face, how many pairs is that, against the table\'s lookups?',
      hint: 'Pairs of $F$ things: $F(F-1)/2$. Lookups: one per corner.',
      answer: '49,995,000 pairs against 40,000 lookups: the table is over a thousand times less work, and the gap grows with the mesh.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      { symbol: '\\text{edge}', meaning: 'Two vertices next to each other round a face; the same edge whichever way it is walked.' },
      { symbol: '\\text{edge table}', meaning: 'A hash map from an edge\'s key (its two vertex numbers, smallest first) to the faces on it.' },
      { symbol: 'n(e)', meaning: 'How many faces edge $e$ is on.' },
      { symbol: '\\text{open edge}', meaning: 'An edge on one face: the rim of a hole or of an open surface.' },
      { symbol: '\\text{non-manifold edge}', meaning: 'An edge on three or more faces; no solid has one.' },
      { symbol: '\\text{neighbour}', meaning: 'The face across an edge from another face.' },
    ],
    rulesOfThumb: [
      'Edges are derived from faces; build the table rather than storing edges by hand.',
      'Sort the two vertex numbers in the key.',
      'Closed surface: edges = corner slots ÷ 2.',
      'Open edges mean holes; three faces on an edge means something is stuck through the surface.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'A mesh file stores a list of edges.',
      whyStudentsThinkIt: 'Tools show edges and let you select them, so they seem to be stored.',
      correctionExample: 'The cube is 8 vertices and 6 faces; its 12 edges come from the table built in cell 1.',
      contrastCase: 'Some formats can store loose edges with no face, but the edges of faces are always found from the faces.',
    },
    {
      falseBelief: 'Each face\'s edges are separate edges, so the cube has 24.',
      whyStudentsThinkIt: 'Counting round each face gives 24 steps.',
      correctionExample: 'Every edge is walked by two faces, so 24 steps are 12 edges.',
      contrastCase: 'Separate copies of each face (lesson 1.1) really do have 24 edges, all open.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A model fails to 3D-print because the slicer says it is not watertight.',
      competingTechniques: ['Build the edge table and look for open and non-manifold edges', 'Look over the model by eye'],
      whyThisTechniqueWins: 'A missing face can be tiny or hidden inside; the table finds every open edge in one pass.',
    },
    {
      situation: 'You need, for every face, the faces next to it, to smooth a value across the surface.',
      competingTechniques: ['Neighbour lists from the edge table', 'Comparing every face with every other face'],
      whyThisTechniqueWins: 'The table costs one lookup per corner; pairwise comparison grows with the square of the number of faces.',
    },
  ],

  debugging: [
    {
      commonError: 'Building the key as a + "-" + b without sorting.',
      symptom: 'A closed model reports every edge as open, and twice as many edges as it has.',
      whyItHappened: 'Each direction of an edge gets its own key, so the two faces never meet.',
      repairStrategy: 'Put the smaller number first: a < b ? a + "-" + b : b + "-" + a.',
    },
    {
      commonError: 'Forgetting the edge from the last corner back to the first.',
      symptom: 'Every face is missing one edge; a closed model shows open edges on every face.',
      whyItHappened: 'The loop stops at the last corner without wrapping round.',
      repairStrategy: 'Take the next corner as f[(i + 1) % f.length].',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Build an edge table from a face list, and read off open edges, non-manifold edges and neighbours.',
    explainVerbally: 'Explain why the key is sorted, and why a closed surface has half as many edges as corner slots.',
    detectIncorrectApplication: 'Recognise an unsorted key or a missing wrap-round from what the table reports.',
    transferToUnfamiliar: 'Use the table to find holes, check winding and reason about the cost of finding neighbours.',
  },

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-1-003-assess-1',
        type: 'choice',
        text: 'A closed mesh has 30 corner slots. How many edges?',
        options: ['15', '30', '60', '10'],
        answer: '15',
        hint: 'Every edge is on two faces.',
      },
    ],
  },

  quiz: [
    { id: 'modelling-geometry-1-003-quiz-1', type: 'choice', text: 'Where do a mesh\'s edges come from?', options: ['Corners next to each other round its faces', 'A separate edge list in the file', 'The vertex list alone', 'The normals'], answer: 'Corners next to each other round its faces', hints: ['The two lists hold vertices and faces only.'], reviewSection: 'Intuition — walking round a face' },
    { id: 'modelling-geometry-1-003-quiz-2', type: 'choice', text: 'Why is the key written smallest number first?', options: ['So both directions of an edge give the same key', 'To sort the table', 'To save memory', 'Because the GPU needs it'], answer: 'So both directions of an edge give the same key', hints: ['0 → 4 and 4 → 0.'], reviewSection: 'Intuition — the table' },
    { id: 'modelling-geometry-1-003-quiz-3', type: 'choice', text: 'An edge on one face is…', options: ['Open: the rim of a hole', 'Non-manifold', 'Shared', 'Impossible'], answer: 'Open: the rim of a hole', hints: ['Like the top of the open box.'], reviewSection: 'Intuition — kinds of edge' },
    { id: 'modelling-geometry-1-003-quiz-4', type: 'choice', text: 'The open box has 20 corner slots and 4 open edges. How many edges are shared?', options: ['8', '10', '16', '12'], answer: '8', hints: ['20 = 2 × shared + 1 × 4. 12 is the near-miss: that is all the edges.'], reviewSection: 'Math — counting slots' },
    { id: 'modelling-geometry-1-003-quiz-5', type: 'choice', text: 'With the key unsorted, the closed cube\'s table has…', options: ['24 entries, each with one face', '12 entries, each with two faces', '6 entries', '48 entries'], answer: '24 entries, each with one face', hints: ['Each direction gets its own key.'], reviewSection: 'Intuition — sort the key' },
    { id: 'modelling-geometry-1-003-quiz-6', type: 'choice', text: 'Drawn from the edge table, the cube\'s wireframe is how many line segments?', options: ['12', '24', '18', '6'], answer: '12', hints: ['Each edge once; 24 is each face\'s outline drawn separately.'], reviewSection: 'Intuition — the graphics strand' },
  ],

  checkpoints: [
    { id: 'cp-modelling-geometry-1-003-1', label: 'Read how edges come from faces', type: 'read' },
    { id: 'cp-modelling-geometry-1-003-2', label: 'Read open, shared and non-manifold edges', type: 'read' },
    { id: 'cp-modelling-geometry-1-003-3', label: 'Read how the wireframe is drawn', type: 'read' },
    { id: 'cp-modelling-geometry-1-003-4', label: 'Complete the close-the-box challenge in the notebook', type: 'lab' },
    { id: 'cp-modelling-geometry-1-003-5', label: 'Predict the lookups in MeshLab\'s trace, then select the open edges', type: 'lab' },
    { id: 'cp-modelling-geometry-1-003-6', label: 'Work through the open-box example', type: 'example' },
    { id: 'cp-modelling-geometry-1-003-7', label: 'Work through the neighbours example', type: 'example' },
    { id: 'cp-modelling-geometry-1-003-8', label: 'Attempt the compare-faces challenge', type: 'challenge' },
  ],
};
