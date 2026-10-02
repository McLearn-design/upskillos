// Lesson 1.4: connected pieces (docs/modelling-course-plan.md). Four parts: the maths (the face graph and its
// components), building it (breadth-first search with a queue, and a graded face-list challenge), watching
// MeshLab do it (a traced search for the pieces in Predict mode), and using the tool (Select linked, a challenge).
import { withPicture } from '../notebookScene.js';
import { readFaces, edgeTable } from '../faceList.js';

const BLOCK_FN = `const SIDES = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]]
const vertices = [], faces = []
// Add a unit cube with its corner 0 at p; share maps a corner of this cube to a vertex already in the list.
function block(p, share = {}) {
  const ids = []
  for (let i = 0; i < 8; i++) {
    if (i in share) { ids.push(share[i]); continue }
    ids.push(vertices.length)
    vertices.push([p[0] + i % 2, p[1] + Math.floor(i / 2) % 2, p[2] + Math.floor(i / 4)])
  }
  for (const s of SIDES) faces.push(s.map((k) => ids[k]))
}`;

const NEIGHBOURS_FN = `// Each face's neighbours: the faces across its edges, from the edge table (lesson 1.3).
function neighbours(faces) {
  const table = new Map(), key = (a, b) => (a < b ? a + '-' + b : b + '-' + a)
  faces.forEach((f, fi) => f.forEach((a, i) => {
    const k = key(a, f[(i + 1) % f.length])
    if (!table.has(k)) table.set(k, [])
    table.get(k).push(fi)
  }))
  return faces.map((f, fi) => f.flatMap((a, i) => table.get(key(a, f[(i + 1) % f.length])).filter((g) => g !== fi)))
}`;

const BFS = `${BLOCK_FN}
block([0, 0, 0])   // faces 0 to 5
block([2, 0, 0])   // faces 6 to 11: a second cube, not touching the first

${NEIGHBOURS_FN}

// Breadth-first search: visit the face at the front of the queue, queue its unseen neighbours at the back.
const across = neighbours(faces), seen = faces.map(() => false)
let piece = 0
for (let start = 0; start < faces.length; start++) {
  if (seen[start]) continue
  const queue = [start], visited = []
  seen[start] = true
  while (queue.length) {
    const f = queue.shift()
    visited.push(f)
    for (const g of across[f]) if (!seen[g]) { seen[g] = true; queue.push(g) }
    console.log('visit ' + f + ': queue ' + (queue.length ? queue.join(', ') : 'empty'))
  }
  piece++
  console.log('piece ' + piece + ': faces ' + visited.join(', '))
}`;

const CORNER = `${BLOCK_FN}
block([0, 0, 0])               // faces 0 to 5
block([1, 1, 1], { 0: 7 })     // faces 6 to 11: its corner 0 is vertex 7, the first cube's top corner

// The pieces, joining faces that share an edge, or (the second time) that share any vertex.
function pieces(linked) {
  const seen = faces.map(() => false), out = []
  for (let start = 0; start < faces.length; start++) {
    if (seen[start]) continue
    const queue = [start], piece = []
    seen[start] = true
    while (queue.length) {
      const f = queue.shift()
      piece.push(f)
      faces.forEach((g, gi) => { if (!seen[gi] && linked(faces[f], g)) { seen[gi] = true; queue.push(gi) } })
    }
    out.push(piece)
  }
  return out
}
const shareEdge = (f, g) => f.some((a, i) => { const b = f[(i + 1) % f.length]; return g.some((c, j) => c === b && g[(j + 1) % g.length] === a || c === a && g[(j + 1) % g.length] === b) })
const shareVertex = (f, g) => f.some((v) => g.includes(v))
const byEdge = pieces(shareEdge)
console.log(vertices.length + ' vertices; by shared edges: ' + byEdge.length + ' pieces; by shared vertices: ' + pieces(shareVertex).length + ' piece')
const groups = faces.map((_, fi) => byEdge.findIndex((p) => p.includes(fi)))
show({ verts: vertices, faces, groups })`;

const DFS = `${BLOCK_FN}
block([0, 0, 0])

${NEIGHBOURS_FN}

// The same search with a stack (take from the back) instead of a queue (take from the front).
function search(takeFromFront) {
  const across = neighbours(faces), seen = faces.map(() => false), order = [], waiting = [0]
  seen[0] = true
  while (waiting.length) {
    const f = takeFromFront ? waiting.shift() : waiting.pop()
    order.push(f)
    for (const g of across[f]) if (!seen[g]) { seen[g] = true; waiting.push(g) }
  }
  return order
}
const bfs = search(true), dfs = search(false)
console.log('queue (breadth-first): ' + bfs.join(', '))
console.log('stack (depth-first):   ' + dfs.join(', '))
console.log('same faces: ' + (bfs.slice().sort().join() === dfs.slice().sort().join()))`;

const CHALLENGE = `// Two squares, side by side with a gap: two pieces. Add faces (keep faces 0 and 1 as they are) so the mesh is
// one piece. Every face should go anticlockwise seen from above (+z), like the squares.
const vertices = [
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],   // vertices 0 to 3: the left square
  [2, 0, 0], [3, 0, 0], [3, 1, 0], [2, 1, 0],   // vertices 4 to 7: the right square
]
const faces = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
]
show({ verts: vertices, faces })`;

const SOLVED = CHALLENGE.replace('  [4, 5, 6, 7],\n]', '  [4, 5, 6, 7],\n  [1, 4, 7, 2],\n]');

/** Pieces of a face list, joining faces that share an edge (either direction). */
function piecesOf(faces) {
  const table = edgeTable(faces), seen = faces.map(() => false), out = [];
  const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  for (let s = 0; s < faces.length; s++) {
    if (seen[s]) continue;
    const queue = [s], piece = [];
    seen[s] = true;
    while (queue.length) {
      const f = queue.shift();
      piece.push(f);
      faces[f].forEach((a, i) => { for (const { face: g } of table.get(key(a, faces[f][(i + 1) % faces[f].length]))) if (!seen[g]) { seen[g] = true; queue.push(g); } });
    }
    out.push(piece);
  }
  return out;
}

/** The challenge's check: read the face list, and say what keeps it from being one well-made piece. */
export function checkJoined(code) {
  const no = (message) => ({ pass: false, message });
  const { faces, error } = readFaces(code);
  if (error) return no(error);
  if (JSON.stringify(faces.slice(0, 2)) !== '[[0,1,2,3],[4,5,6,7]]') return no('Keep faces 0 and 1 as they are, [0, 1, 2, 3] and [4, 5, 6, 7]: join them by adding faces after them.');
  for (const [i, f] of faces.entries()) {
    if (f.length < 3) return no(`Face ${i} has ${f.length} corner${f.length === 1 ? '' : 's'}: a face needs at least 3.`);
    if (f.some((v) => v < 0 || v > 7)) return no(`Face ${i} uses a vertex that does not exist: they are numbered 0 to 7.`);
    if (new Set(f).size !== f.length) return no(`Face ${i} lists the same corner twice.`);
  }
  const table = edgeTable(faces);
  const many = [...table].find(([, on]) => on.length > 2);
  if (many) return no(`Edge ${many[0]} is on ${many[1].length} faces (${many[1].map((x) => x.face).join(', ')}): a surface has at most two faces on an edge.`);
  const same = [...table.values()].find((on) => on.length === 2 && on[0].from === on[1].from);
  if (same) return no(`Faces ${same[0].face} and ${same[1].face} both go from vertex ${same[0].from} to vertex ${same[0].to}: one of them is wound the other way round from the squares.`);
  const pieces = piecesOf(faces);
  if (pieces.length > 1) {
    const vertsOf = (p) => new Set(p.flatMap((f) => faces[f]));
    const [a, b] = [vertsOf(pieces[0]), vertsOf(pieces[1])];
    const corner = [...a].filter((v) => b.has(v));
    return no(`Still ${pieces.length} pieces: faces ${pieces.map((p) => p.join(', ')).join(' | ')}.${corner.length ? ` They meet only at vertex ${corner.join(' and ')}: pieces join where faces share an edge, not a corner.` : ''}`);
  }
  return { pass: true, message: `One piece of ${faces.length} faces, and every shared edge is walked in opposite directions by its two faces, so the winding agrees.` };
}

export default {
  id: 'modelling-geometry-1-004',
  slug: 'connected-pieces',
  chapter: 'modelling-geometry-1',
  order: 4,
  title: 'Connected Pieces',
  subtitle: 'One mesh can be several separate pieces; a search across shared edges finds them.',
  tags: ['meshes', 'graphs', 'breadth-first search', 'components', 'selection'],
  aliases: 'connected components pieces islands loose parts breadth first search bfs depth first dfs queue stack face graph select linked floaters meshlab',
  timeToComplete: 45,
  coreConcept: 'Faces that share an edge are neighbours; following neighbours from a face reaches its whole piece. Breadth-first search does this with a queue and a seen mark, visiting every face once, and repeating from any face not yet seen finds every piece of the mesh.',
  prerequisites: ['modelling-geometry-1-003'],
  nextLesson: null,

  hook: {
    question: 'One mesh object can hold several pieces that never touch: a scan with specks floating beside it, or a chair whose legs were modelled separately. How does a tool find "everything connected to this face", and what counts as connected?',
    realWorldContext: 'Select linked (Ctrl+L) in every modelling tool, "separate by loose parts", cleaning floaters off a 3D scan, counting the parts in a CAD file: all of them search the face graph from lesson 1.3, the same way.',
  },

  intuition: {
    prose: [
      'Lesson 1.3 built the edge table, and with it each face\'s neighbours: the faces across its edges. Think of the faces as points and draw a line between every two neighbours. That drawing is the **face graph**, and "connected" means you can walk from one face to another along its lines: from face to neighbour, across a shared edge each step.',
      'Put two cubes in one mesh, apart from each other. From face 0 of the first cube you can walk to all six of its faces, and never to the second cube: no face of it shares an edge with the first. Each set of faces you can walk between is a **piece** (graph theory calls it a connected component). This mesh has two.',
      'To find a piece, a program keeps a **queue**: a waiting line. Start with face 0 in it, marked seen. Then repeatedly take the face at the front, and put each of its neighbours not seen yet at the back, marking them seen. When the queue is empty, every face reachable from face 0 has been visited exactly once. That is **breadth-first search**: faces are visited in rings, first face 0, then its neighbours, then theirs.',
      'Before reading on, predict: from face 0 of a cube (the side at x = 0), the queue first takes its four neighbours. Which face is visited last? The opposite side, face 1: it is two steps away, and every other face is one.',
      'To find every piece, start again from the lowest-numbered face not yet seen, until none is left. Two cubes give two pieces; a scan with two floaters gives three.',
      'What counts as connected is a choice. Rest a second cube on the first one\'s top corner, sharing that one vertex. By shared edges they are two pieces; by shared vertices they are one. MeshLab\'s Select linked follows shared edges in face select, and shared vertices in vertex select, so the corner shows the difference.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Find the pieces',
        body: 'Step 1. Build each face\'s neighbours from the edge table.\nStep 2. Mark every face unseen. Take the lowest-numbered unseen face, mark it seen and put it in the queue.\nStep 3. Take the face at the front of the queue and add it to the piece. Queue each neighbour not seen yet, marking it seen.\nStep 4. Repeat Step 3 until the queue is empty: the piece is complete.\nStep 5. Go back to Step 2 until every face is seen.',
      },
      {
        type: 'warning',
        title: 'Mark a face seen when it is queued, not when it is visited',
        body: 'Two faces of a cube can both have the same neighbour. If faces are marked only when they leave the queue, that neighbour is queued twice and visited twice. Marking it as it joins the queue keeps every face to one visit.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: drawing a selection',
        body: 'MeshLab draws the selected faces a second time, as their own see-through orange copy on top of the surface. The copy sits exactly where the surface is, so the two would flicker in the depth test (z-fighting). Polygon offset nudges the copy\'s depth towards the camera, so it wins every time, and it writes no depth of its own, so it never hides anything drawn after it.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: breadth-first search',
        props: {
          lesson: {
            title: 'Finding the pieces',
            subtitle: 'Search the face graph with a queue, see what "connected" means at a shared corner, compare a stack, and join two pieces.',
            cells: [
              { type: 'js', instruction: '### 1. Breadth-first search\nTwo cubes, apart. Run it: each line is one visit, and the queue after it. Face 1, opposite face 0, is visited last. The second cube is a second piece.', startCode: BFS },
              { type: 'js', instruction: '### 2. Sharing a corner\nThe second cube rests on the first one\'s top corner (vertex 7). By shared edges it is a separate piece, coloured differently; by shared vertices the two are one. Drag the picture to turn it.', startCode: withPicture(CORNER), showPreviewByDefault: true, outputHeight: 340 },
              { type: 'js', instruction: '### 3. A stack instead of a queue\nTake from the back instead of the front and the search goes deep before it goes wide: depth-first. The order changes; the piece does not.', startCode: DFS },
              { type: 'challenge', instruction: '### 4. Challenge: join the two squares\nTwo squares with a gap are two pieces. Add faces so the mesh is one piece, without changing faces 0 and 1. The check finds your pieces by breadth-first search, and checks that every shared edge is walked the opposite way by its two faces.', startCode: withPicture(CHALLENGE), solutionCode: withPicture(SOLVED), check: checkJoined, showPreviewByDefault: true, outputHeight: 340 },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Connected pieces" in MeshLab](#/lab/mesh-lab?project=connected-pieces). It builds three cubes in one mesh: the second rests on the first one\'s corner, the third stands apart. It finds the pieces with **Record traces** on, and the Algorithm trace is in **Predict** mode. The first question comes before the search shows anything: how many faces will the first piece have? The second asks how long the queue is after face 2\'s visit. Then try **Select linked** in face select and in vertex select, and watch the corner make the difference.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Edit › Select linked** (Ctrl+L) selects everything connected to the selection: across shared edges in face select, through shared vertices in vertex select.\n- The selection draws as a see-through orange copy of the selected faces.\n- **In Blender:** Ctrl+L selects linked; L selects the piece under the mouse pointer. Mesh › Separate › By Loose Parts makes each piece its own object.\n- Practise on a scan with floaters: [MeshLab challenge: Remove the floaters](#/lab/mesh-lab?challenge=remove-the-floaters).' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      'The face graph $G = (F, L)$ has a node for every face and a link $\\{f, g\\} \\in L$ for every pair of faces that share an edge. A **path** is a sequence of faces, each linked to the next. Faces $f$ and $g$ are **connected** when a path joins them.',
      'Connected is an equivalence relation: every face is connected to itself; if $f$ is connected to $g$ then $g$ is to $f$; and two paths end to end make a path. So the faces split into classes with no overlap: the **components**, or pieces.',
      'Breadth-first search from $s$ visits faces in order of their **distance** $d(s, f)$, the fewest links on a path from $s$ to $f$: first $d = 0$ (just $s$), then every face with $d = 1$, then $d = 2$. On a cube from face 0, four faces have $d = 1$ and the opposite face has $d = 2$.',
      'Each face is queued once (it is marked seen as it is queued) and each link is looked at twice (once from each end), so the search costs $O(|F| + |L|)$: for a mesh of quads, $|L| \\le 2|F|$, so linear in the number of faces.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Why the search finds the whole piece: suppose face $g$ is connected to $s$ but never visited. Take a path from $s$ to $g$ and its first face that was not visited; the face before it was visited, so its neighbours, including that face, were queued. A contradiction, so every connected face is visited. And only connected faces are ever queued, because each joins as the neighbour of a visited one.',
      'Why breadth-first visits by distance: the queue always holds faces at distance $d$ followed by faces at distance $d + 1$, never anything further. A face at distance $d + 1$ is queued by its first visited neighbour at distance $d$. A stack (depth-first search) visits the same piece but not in order of distance.',
      'The choice of link changes the graph and so the pieces. Linking faces that share any vertex joins pieces that touch only at a corner. Edge-linking is the usual meaning for surfaces, because only a shared edge makes one continuous surface; a single shared vertex is a non-manifold point (lesson 1.3).',
      'Lesson 1.5 counts with pieces: Euler\'s formula $V - E + F$ is 2 for each closed piece shaped like a sphere, so it adds up over pieces. Two separate cubes give 4.',
    ],
    callouts: [
      { type: 'insight', title: 'Bridge: from the graph to code', body: 'The face graph is never built as its own object: neighbours(faces) reads each face\'s links straight from the edge table, which is all the search needs.' },
      { type: 'insight', title: 'Bridge: from code to the screen', body: 'Selecting a piece is this search; drawing the selection is a second, offset copy of the faces it found.' },
      { type: 'insight', title: 'Bridge: from the screen to MeshLab', body: 'MeshLab\'s Select linked in face select runs mesh.pieces from the selected faces, and the trace shows its queue.' },
    ],
    visualizations: [],
  },

  examples: [
    {
      id: 'modelling-geometry-1-004-ex1',
      title: 'The queue on a cube',
      difficulty: 'easy',
      problem: 'Search a cube from face 0 = [0, 4, 6, 2]. Its neighbours, in order round it, are 2, 5, 3, 4. What is the queue after each of the first two visits?',
      steps: [
        { expression: '\\text{visit } 0:\\ \\text{queue } 2, 5, 3, 4', annotation: 'All four neighbours are new.', strategyTitle: 'Step 1: First visit' },
        { expression: '\\text{visit } 2:\\ \\text{queue } 5, 3, 4, 1', annotation: 'Face 2 = [0, 1, 5, 4] has neighbours 4, 1, 5, 0; only 1 is new.', strategyTitle: 'Step 2: Second visit' },
      ],
      answer: 'After face 0: 2, 5, 3, 4. After face 2: 5, 3, 4, 1.',
    },
    {
      id: 'modelling-geometry-1-004-ex2',
      title: 'Counting pieces',
      difficulty: 'medium',
      problem: 'A mesh is a large block and two small cubes floating beside it, none touching. How many pieces, and how many searches does it take to find them?',
      steps: [
        { expression: '\\text{search from face 0: one cube}', annotation: 'The queue empties after 6 faces.', strategyTitle: 'Step 1: First piece' },
        { expression: '\\text{restart at the next unseen face, twice more}', annotation: 'Each restart finds one more piece.', strategyTitle: 'Step 2: Restart' },
      ],
      answer: '3 pieces, found by 3 searches, one per piece.',
    },
    {
      id: 'modelling-geometry-1-004-ex3',
      title: 'Cubes meeting at a corner',
      difficulty: 'hard',
      problem: 'Two cubes share exactly one vertex. How many pieces are there by shared edges, and by shared vertices? Which counts as one surface?',
      steps: [
        { expression: '\\text{no face of one shares an edge with the other}', annotation: 'They share a single vertex, no edge.', strategyTitle: 'Step 1: Edges' },
        { expression: '\\text{by edges: 2;\\ by vertices: 1}', annotation: 'A face at the corner of each cube contains the shared vertex.', strategyTitle: 'Step 2: Count both ways' },
      ],
      answer: '2 by edges, 1 by vertices. As a surface they are two pieces joined at a non-manifold point.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-1-004-ch1',
      title: 'Last face visited',
      difficulty: 'easy',
      problem: 'Breadth-first from the bottom face of a cube: which face is visited last?',
      hint: 'Which face is two steps away?',
      answer: 'The top: the four sides are one step away, the top two.',
      walkthrough: [],
    },
    {
      id: 'modelling-geometry-1-004-ch2',
      title: 'Queued twice',
      difficulty: 'medium',
      problem: 'A search marks a face seen only when it takes it from the queue, and skips a face it has already seen. On a cube from face 0, how many times is face 1 (the opposite side) put in the queue?',
      hint: 'Face 1 is visited last. Which faces are visited before it, and is face 1 a neighbour of each?',
      answer: '4 times: all four sides are visited before it, and each one queues it, because it is not marked seen until it is taken out.',
      walkthrough: [],
    },
    {
      id: 'modelling-geometry-1-004-ch3',
      title: 'The cost',
      difficulty: 'hard',
      problem: 'A scan has 200,000 quads in 40 pieces. Roughly how much work is finding all the pieces?',
      hint: 'Each face is visited once, and each link looked at from both ends.',
      answer: 'About 200,000 visits and at most 800,000 link checks (4 per quad): linear in the faces, whatever the number of pieces.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      { symbol: 'G = (F, L)', meaning: 'The face graph: a node per face, a link per shared edge.' },
      { symbol: '\\text{piece}', meaning: 'A connected component: faces you can walk between across shared edges.' },
      { symbol: '\\text{queue}', meaning: 'A waiting line: take from the front, add at the back.' },
      { symbol: 'd(s, f)', meaning: 'The fewest shared edges crossed walking from face $s$ to face $f$.' },
      { symbol: '\\text{seen}', meaning: 'The mark that stops a face being queued twice.' },
      { symbol: '\\text{stack}', meaning: 'Take from the back: depth-first search.' },
    ],
    rulesOfThumb: [
      'Connected means sharing an edge, unless you say otherwise.',
      'Mark faces seen as they join the queue.',
      'A queue visits by distance; a stack goes deep first; both find the same piece.',
      'Restart from the next unseen face to find every piece.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'One mesh object is one connected piece.',
      whyStudentsThinkIt: 'It is selected, moved and saved as one thing.',
      correctionExample: 'The project\'s Blocks object is one mesh with three pieces.',
      contrastCase: 'Separate objects are separate pieces too, but a single object can also hold many.',
    },
    {
      falseBelief: 'Two faces that touch are connected.',
      whyStudentsThinkIt: 'Touching looks like joining.',
      correctionExample: 'Cubes meeting at one vertex touch, but share no edge: two pieces by edges.',
      contrastCase: 'Faces that share an edge are connected, even if the surface folds sharply there.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A photogrammetry scan has hundreds of tiny floating specks around the object.',
      competingTechniques: ['Find the pieces and keep the largest', 'Delete specks by clicking each one'],
      whyThisTechniqueWins: 'The search finds every piece in one linear pass; clicking misses specks hidden inside or behind the object.',
    },
    {
      situation: 'You need the number of faces you must cross to get from one face to another.',
      competingTechniques: ['Breadth-first search', 'Depth-first search'],
      whyThisTechniqueWins: 'Breadth-first visits faces in order of distance, so the first time it reaches a face is by a shortest walk.',
    },
  ],

  debugging: [
    {
      commonError: 'Marking faces seen when they are visited instead of when they are queued.',
      symptom: 'Faces appear more than once in a piece, and the search is slower than it should be.',
      whyItHappened: 'A face with several visited neighbours is queued once by each.',
      repairStrategy: 'Set seen[g] = true at the moment g is pushed onto the queue.',
    },
    {
      commonError: 'Searching only from face 0.',
      symptom: 'The program reports one piece for a mesh with several.',
      whyItHappened: 'One search finds one piece.',
      repairStrategy: 'Loop over all faces and start a new search from each one not yet seen.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Find the pieces of a mesh by breadth-first search, by hand and in code.',
    explainVerbally: 'Explain why every face is visited once, and why the queue visits in order of distance.',
    detectIncorrectApplication: 'Spot a search that queues faces twice, or misses pieces, from its output.',
    transferToUnfamiliar: 'Choose edge- or vertex-linking deliberately, and use pieces to clean scans and count parts.',
  },

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-1-004-assess-1',
        type: 'choice',
        text: 'A mesh is three cubes, none touching. How many times does the search restart from an unseen face, counting the first start?',
        options: ['3', '1', '6', '18'],
        answer: '3',
        hint: 'One search per piece.',
      },
    ],
  },

  quiz: [
    { id: 'modelling-geometry-1-004-quiz-1', type: 'choice', text: 'Two faces are linked in the face graph when they…', options: ['Share an edge', 'Are close together', 'Have the same normal', 'Have the same number of corners'], answer: 'Share an edge', hints: ['Lesson 1.3\'s neighbours.'], reviewSection: 'Intuition — the face graph' },
    { id: 'modelling-geometry-1-004-quiz-2', type: 'choice', text: 'Breadth-first search takes the next face from…', options: ['The front of the queue', 'The back of the list', 'A random place', 'The face with the most neighbours'], answer: 'The front of the queue', hints: ['The back is a stack: depth-first.'], reviewSection: 'Intuition — the queue' },
    { id: 'modelling-geometry-1-004-quiz-3', type: 'choice', text: 'From face 0 of a cube, the queue after the first two visits holds…', options: ['5, 3, 4, 1', '2, 5, 3, 4', '1', '3, 4, 1, 5'], answer: '5, 3, 4, 1', hints: ['2, 5, 3, 4 is after one visit.'], reviewSection: 'Examples — the queue on a cube' },
    { id: 'modelling-geometry-1-004-quiz-4', type: 'choice', text: 'Why mark a face seen as it is queued?', options: ['So it is never queued twice', 'To sort the faces', 'To find the normals', 'So the stack works'], answer: 'So it is never queued twice', hints: ['Several neighbours can share a neighbour.'], reviewSection: 'Intuition — the warning' },
    { id: 'modelling-geometry-1-004-quiz-5', type: 'choice', text: 'Two cubes share one vertex and no edge. By shared edges they are…', options: ['Two pieces', 'One piece', 'Three pieces', 'Not a mesh'], answer: 'Two pieces', hints: ['By shared vertices they would be one.'], reviewSection: 'Intuition — sharing a corner' },
    { id: 'modelling-geometry-1-004-quiz-6', type: 'choice', text: 'How does MeshLab keep the selection overlay from flickering against the surface?', options: ['Polygon offset nudges it towards the camera', 'It draws the selection first', 'It turns off lighting', 'It moves the vertices'], answer: 'Polygon offset nudges it towards the camera', hints: ['The two would be at exactly the same depth.'], reviewSection: 'Intuition — the graphics strand' },
  ],

  checkpoints: [
    { id: 'cp-modelling-geometry-1-004-1', label: 'Read the face graph and what a piece is', type: 'read' },
    { id: 'cp-modelling-geometry-1-004-2', label: 'Read breadth-first search with a queue', type: 'read' },
    { id: 'cp-modelling-geometry-1-004-3', label: 'Read how a selection is drawn', type: 'read' },
    { id: 'cp-modelling-geometry-1-004-4', label: 'Complete the join-the-squares challenge in the notebook', type: 'lab' },
    { id: 'cp-modelling-geometry-1-004-5', label: 'Predict the queue in MeshLab\'s trace, then compare Select linked in face and vertex select', type: 'lab' },
    { id: 'cp-modelling-geometry-1-004-6', label: 'Work through the queue-on-a-cube example', type: 'example' },
    { id: 'cp-modelling-geometry-1-004-7', label: 'Work through the cubes-at-a-corner example', type: 'example' },
    { id: 'cp-modelling-geometry-1-004-8', label: 'Attempt the queued-twice challenge', type: 'challenge' },
  ],
};
