// Lesson 4.3: box and loop selection. Box select keeps what is drawn inside a rectangle; loop select walks an
// edge loop: straight on through every vertex where four quads meet, stopping at poles, triangles and n-gons.
import { withPicture } from '../notebookScene.js';

// The edge loop walk, shared by the cells (the same rules as MeshLab's EditMesh.edgeLoop).
const LOOP = `const key = (a, b) => a < b ? a + '-' + b : b + '-' + a
// The edge table: each edge once, with the faces on it (lesson 1.3).
function edgeTable(faces) {
  const t = new Map()
  faces.forEach((f, fi) => f.forEach((a, i) => { const b = f[(i + 1) % f.length], k = key(a, b); if (!t.has(k)) t.set(k, { a, b, faces: [] }); t.get(k).faces.push(fi) }))
  return t
}
function edgeLoop(faces, a, b) {
  const map = edgeTable(faces), around = new Map(), start = key(a, b)
  for (const e of map.values()) for (const v of [e.a, e.b]) { if (!around.has(v)) around.set(v, []); around.get(v).push(e) }
  function walk(prev, cur) {
    const out = [], seen = new Set([start])
    for (;;) {
      const came = map.get(key(prev, cur)), inc = around.get(cur)
      const quads = inc.every((e) => e.faces.every((f) => faces[f].length === 4))
      let next = []
      // Four edges, all quads: straight on is the one edge sharing no face with the edge we came along.
      if (came.faces.length === 2 && inc.length === 4 && quads) next = inc.filter((e) => e !== came && !e.faces.some((f) => came.faces.includes(f)))
      // On the boundary, three edges: follow the boundary.
      else if (came.faces.length === 1 && inc.length === 3 && quads) next = inc.filter((e) => e !== came && e.faces.length === 1)
      if (next.length !== 1) return { out, closed: false }
      const k = key(next[0].a, next[0].b)
      if (k === start) return { out, closed: true }
      if (seen.has(k)) return { out, closed: false }
      seen.add(k)
      const n = next[0].a === cur ? next[0].b : next[0].a
      out.push([cur, n]); prev = cur; cur = n
    }
  }
  const fwd = walk(a, b)
  if (fwd.closed) return { edges: [[a, b], ...fwd.out], closed: true }
  const back = walk(b, a)
  return { edges: [...back.out.map(([x, y]) => [y, x]).reverse(), [a, b], ...fwd.out], closed: false }
}
// A 4 × 4 grid of quads: vertex (x, y) is number y · 5 + x.
const grid = []
for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) grid.push([y * 5 + x, y * 5 + x + 1, (y + 1) * 5 + x + 1, (y + 1) * 5 + x])
// A UV sphere: 12 segments round, 8 rings top to bottom; triangles at the two poles, quads between.
const S = 12, R = 8, sverts = [[0, 1, 0]]
for (let i = 1; i < R; i++) for (let k = 0; k < S; k++) { const p = Math.PI * i / R, t = 2 * Math.PI * k / S; sverts.push([Math.sin(p) * Math.cos(t), Math.cos(p), Math.sin(p) * Math.sin(t)]) }
sverts.push([0, -1, 0])
const ring = (i, k) => 1 + (i - 1) * S + (k % S), south = sverts.length - 1
const sfaces = []
for (let k = 0; k < S; k++) sfaces.push([0, ring(1, k + 1), ring(1, k)])
for (let i = 1; i < R - 1; i++) for (let k = 0; k < S; k++) sfaces.push([ring(i, k), ring(i, k + 1), ring(i + 1, k + 1), ring(i + 1, k)])
for (let k = 0; k < S; k++) sfaces.push([south, ring(R - 1, k), ring(R - 1, k + 1)])
const vertsOf = (loop) => [...new Set(loop.edges.flat())]
`;

const BOX = `// Box select on the screen: the block of lesson 4.2, a rectangle dragged from (500, 170) to (700, 420).
const rect = { x0: 500, y0: 170, x1: 700, y1: 420 }
const screen = [[618.82, 388.42], [455.51, 489.65], [615.86, 176.44], [422.27, 234.81], [813.87, 459.97], [672.27, 605.32], [843.09, 217.27], [679.68, 306.76]]
const inside = ([x, y]) => x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1
const picked = screen.map((p, i) => inside(p) ? i : -1).filter((i) => i >= 0)
console.log('vertex select: v' + picked.join(', v'))
// Edge select keeps an edge only if both ends are inside; face select tests each face's centre.
const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]
console.log('edge select: ' + edges.filter(([a, b]) => inside(screen[a]) && inside(screen[b])).map(([a, b]) => a + '-' + b).join(', '))`;

const GRID = `${LOOP}
const l = edgeLoop(grid, 6, 7)
console.log('loop through 6-7: vertices ' + vertsOf(l).sort((a, b) => a - b).join(', ') + (l.closed ? ' (closed)' : ' (open)'))
// Why it stops at 5 and 9: they are on the boundary, with three edges, and the loop arrived across the grid.
const t = edgeTable(grid), count = (v) => [...t.values()].filter((e) => e.a === v || e.b === v).length
console.log('edges at v6: ' + count(6) + ', at v5: ' + count(5) + ', at v0 (a corner): ' + count(0))`;

const SPHERE = `${LOOP}
// Latitude: both ends at the same height. Longitude: up and down.
const lat = edgeLoop(sfaces, ring(4, 0), ring(4, 1)), lon = edgeLoop(sfaces, ring(3, 0), ring(4, 0))
console.log('latitude loop: ' + lat.edges.length + ' edges, ' + (lat.closed ? 'all the way round' : 'open'))
console.log('longitude loop: ' + lon.edges.length + ' edges, ' + (lon.closed ? 'closed' : 'open: rings 1 to 7, stopping before the poles'))
const atPole = sfaces.filter((f) => f.includes(0)).length
console.log('the north pole has ' + atPole + ' triangles round it: a pole, so the walk cannot go straight on through it')`;

const PICTURE_CODE = `${LOOP}
// The sphere, with the latitude loop (red) and the longitude loop (blue) drawn as thin sticks.
const verts = sverts.map((p) => [...p]), faces = sfaces.map((f) => [...f]), groups = sfaces.map(() => 7)
function stick(a, b, group) {
  const u = a.map((x, i) => b[i] - x), len = Math.hypot(...u), n = u.map((x) => x / len)
  const v0 = Math.abs(n[1]) < 0.9 ? [n[2], 0, -n[0]] : [1, 0, 0], l0 = Math.hypot(...v0), v = v0.map((x) => x / l0 * 0.025)
  const w = [n[1] * v[2] - n[2] * v[1], n[2] * v[0] - n[0] * v[2], n[0] * v[1] - n[1] * v[0]]
  const k = verts.length
  for (const p of [a, b]) for (const [s, t] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) verts.push(p.map((x, i) => x * 1.01 + s * v[i] + t * w[i]))
  for (const q of [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) { faces.push(q.map((i) => i + k)); groups.push(group) }
}
// The longitude at segment 2 faces the picture's camera.
const lat = edgeLoop(sfaces, ring(4, 0), ring(4, 1)), lon = edgeLoop(sfaces, ring(3, 2), ring(4, 2))
for (const [a, b] of lat.edges) stick(sverts[a], sverts[b], 4)
for (const [a, b] of lon.edges) stick(sverts[a], sverts[b], 0)
console.log('red: ' + lat.edges.length + ' edges, closed; blue: ' + lon.edges.length + ' edges, open at the poles')
show({ verts, faces, groups })`;

const CHALLENGE = `// The 4 × 4 grid of quads: vertex (x, y) is number y · 5 + x, so the bottom row is 0 to 4,
// the next 5 to 9, and so on up to 24. List, in order along it, the vertices of the edge loop
// through the edge from 11 to 16.
const loop = [11, 16]

console.log('loop: ' + loop.join(' → '))`;

const SOLVED = CHALLENGE.replace('const loop = [11, 16]', 'const loop = [1, 6, 11, 16, 21]');

/** The challenge's check: read the vertex list and compare with the walk. */
export function checkLoop(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/^\s*const\s+loop\s*=\s*\[([^\]\n]*)\]/m);
  const v = m ? m[1].split(',').map((s) => s.trim()).filter(Boolean).map(Number) : [];
  if (!m || !v.length || !v.every(Number.isInteger)) return no('Keep const loop = [ … ] with vertex numbers, in order.');
  const right = [1, 6, 11, 16, 21];
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  if (same(v, right) || same(v, [...right].reverse())) return { pass: true, message: 'Up the column x = 1: 11 → 16 → 21 at the top edge, and 11 → 6 → 1 at the bottom. At 6 and 16 four edges meet, so the loop goes straight on; 1 and 21 are on the boundary with three edges, so it stops.' };
  if (same(v, [11, 16])) return no('That is just the start edge. Walk on from 16: at a vertex with four edges, take the one that shares no face with the edge you came along.');
  if (same(v, [11, 16, 21]) || same(v, [21, 16, 11])) return no('That is only one way. The loop did not close, so walk the other way from 11 too.');
  if (v.includes(17) || v.includes(15) || v.includes(10) || v.includes(12)) return no(`${v.join(' → ')} turns a corner. Straight on is the edge that shares no face with the edge you arrived along: up the same column.`);
  if (v.includes(26) || v.some((x) => x < 0 || x > 24)) return no('The grid\'s vertices are 0 to 24: the loop stops at the boundary.');
  return no(`${v.join(' → ')} is not the loop. It runs straight up and down the column x = 1, from the bottom edge to the top.`);
}

export default {
  id: 'modelling-geometry-4-003',
  slug: 'box-and-loop-selection',
  chapter: 'modelling-geometry',
  order: 3,
  title: 'Box and loop selection',
  subtitle: 'Select everything drawn inside a rectangle, or a whole line of edges with one click: the loop walk.',
  tags: ['selection', 'edge loop', 'box select', 'poles', 'quad topology'],
  coreConcept: 'Box select keeps elements whose projected positions fall inside a screen rectangle (vertices, edges with both ends, faces by their centres); loop select walks from an edge straight on through each vertex where four quads meet (taking the edge that shares no face with the incoming one), following the boundary at three-edge vertices, and stops at poles, triangles and n-gons.',
  prerequisites: ['modelling-geometry-4-002', 'modelling-geometry-1-003'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-4-004',

  hook: {
    question: 'Alt+click one edge round a character\'s arm and a whole ring of edges lights up, all the way round. How does the tool know which way "round" is, and why does the same click on a sphere\'s pole select nothing beyond it?',
    realWorldContext: 'Modellers select hundreds of elements at a time: a rectangle over a region, or a loop round a limb to scale it, cut it or mark a seam. Loops are why modellers care about quad topology: a clean grid of quads gives clean loops; a stray triangle or pole cuts them short.',
  },

  intuition: {
    prose: [
      '**Box select** first. Drag a rectangle on the screen. Every vertex is projected to its pixel (lesson 4.2); those inside the rectangle are selected. Cell 1 drags one over the block of lesson 4.2 and gets $v0$, $v2$ and $v7$. In edge select an edge needs both ends inside, so only $0$–$2$ qualifies; in face select, a face\'s centre must be inside.',
      'Now **loops**. Take a $4 \\times 4$ grid of quads, vertex $(x, y)$ numbered $5y + x$. Click the edge from $6$ to $7$. At $7$, four edges meet: back to $6$, on to $8$, up to $12$ and down to $2$. Which one is "straight on"?',
      'The edge from $6$ to $7$ lies on two quads: the one above it and the one below. The edges to $12$ and to $2$ are sides of those same quads. The edge to $8$ shares no face with $6$–$7$. That is **straight on**, and the walk goes to $8$.',
      'At $9$, on the right-hand boundary, only three edges meet. There is no single "straight on", so the walk stops. It then walks the other way from the start edge, from $6$ to $5$, and stops at the left boundary too: the loop is $5, 6, 7, 8, 9$.',
      'Before running cell 3, predict: on a UV sphere, does a loop along a line of latitude close? Does a loop along a line of longitude reach the poles?',
      'Latitude: yes, $12$ edges round and back to the start. Longitude: no. At each pole, $12$ triangles meet: a **pole** (a vertex where other than four edges meet) with triangles round it. The walk stops one ring short of each pole, so the longitude loop has $6$ edges, from ring $1$ to ring $7$.',
      'That is why modellers keep their meshes mostly quads with four edges at every vertex. Loops then run cleanly round limbs and along bodies, and tools built on them work: loop cuts (lesson 5.3), seams for unwrapping (chapter 8), selecting a whole ring to scale.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Box select and loop select',
        body: 'Box: Step 1. Project each vertex to a pixel. Step 2. Keep vertices inside the rectangle; edges with both ends inside; faces with their centre inside.\nLoop: Step 1. Start with the edge (a, b); walk from b.\nStep 2. At the current vertex: if four edges meet and every face round it is a quad, go along the one edge that shares no face with the edge you arrived along.\nStep 3. If you arrived along a boundary edge (one face) and three edges meet, go along the other boundary edge.\nStep 4. Anything else (a pole, a triangle, an n-gon): stop.\nStep 5. If you come back to the start edge, the loop is closed; otherwise walk again from a the other way and join the two halves.',
      },
      {
        type: 'warning',
        title: 'Poles and triangles cut loops short',
        body: 'A vertex with three or five edges has no straight on; a triangle has no opposite edge. One stray triangle in a character\'s arm stops every loop that passes through it. If a loop stops where you did not expect, look for a pole or a non-quad face there.',
      },
      {
        type: 'warning',
        title: 'Box select ignores what is hidden',
        body: 'Like click picking in MeshLab, box select tests positions on screen, not visibility: vertices on the back of the model inside the rectangle are selected too. Turn the model, or use X-ray deliberately, to see what you are getting.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: selection colours',
        body: 'Selected vertices, edges and faces are drawn in overlay colours on top of the shaded mesh: points and lines with polygon offset or no depth test (lesson 3.4), faces as a see-through tint. A loop selection shows as one continuous coloured line because its edges join end to end.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "a loop is any closed line of edges". The red latitude loop closes round the sphere; the blue longitude loop, which looks like half a great circle, stops one ring short of each pole. Invariant: both run straight on through every vertex they pass, never turning.',
      },
      { type: 'insight', title: 'Bridge: from the chain rule to code', body: 'inside() in cell 1 is the box test; edgeLoop() in the shared code is Steps 1 to 5 of the loop walk, with walk() doing Steps 2 to 4.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Selection is pure topology and screen geometry on the CPU; only the resulting colours are drawn by the GPU.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'B then drag box-selects; Alt+click selects the loop through an edge (in face select, the ring of faces across it). With Record traces on, Alt+click traces the walk. In a script, mesh.loop(a, b).' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: box and loop selection',
        caption: 'A rectangle on screen, the loop walk on a grid and a sphere, and both loops drawn.',
        props: {
          lesson: {
            title: 'Box and loop selection',
            subtitle: 'Select by rectangle, and walk edge loops straight on until a pole stops them.',
            cells: [
              { type: 'js', instruction: '### 1. Box select\nThe block\'s corners on screen (lesson 4.2), and a dragged rectangle.', startCode: BOX },
              { type: 'js', instruction: '### 2. A loop on a grid\nStraight on through four-edge vertices; stop at the three-edge boundary.', startCode: GRID },
              { type: 'js', instruction: '### 3. Loops on a sphere\nPredict first: does a latitude loop close? Does a longitude loop reach the poles?', startCode: SPHERE },
              { type: 'js', instruction: '### 4. See both loops\nRed: latitude, closed. Blue: longitude, stopped at the poles. Drag to turn the picture.', startCode: withPicture(PICTURE_CODE), showPreviewByDefault: true, outputHeight: 340 },
              { type: 'challenge', instruction: '### 5. Challenge: walk a loop\nList the loop through one edge of the grid. The check names a turn, a missed half or a wrong stop.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkLoop },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Box and loop selection" in MeshLab](#/lab/mesh-lab?project=loops). With **Record traces** on, the script walks a latitude loop round a UV sphere, vertex by vertex. In **Predict** mode, predict the first vertex it goes on to, and the loop\'s length. Then Alt+click loops yourself.' },
              { type: 'markdown', instruction: '### Use the tool\n- **B**, then drag: box select (Shift+drag adds).\n- **Alt+click** an edge: its loop (vertex and edge select) or the ring of faces across it (face select). Shift+Alt+click adds.\n- With **Record traces** on, Alt+click traces the walk. In a script: mesh.loop(a, b).\n- **In Blender:** B or a drag with the select tool; Alt+click for loops, Ctrl+Alt+click for rings.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Why "shares no face" means straight on.** At a vertex where four quads meet, its four edges alternate round it with the four quads between them. The incoming edge borders two of the quads. The two edges on either side border one of those each. Only the fourth, opposite edge borders neither: it is the one across the vertex.',
      '**Why a pole has no straight on.** With three edges, the incoming edge borders two of the three faces, and each other edge borders one of them: none is free. With five, two edges border none of the incoming edge\'s faces: there is no single choice. Only four gives exactly one.',
      '**Why the walk ends.** Each step uses a new edge (seen edges stop the walk), and a mesh has finitely many edges. So the walk either returns to the start edge (a closed loop) or stops.',
      '**Why the box test is a projection test.** The rectangle is in screen space, so each element is reduced to one or two screen points (lesson 4.2) and tested against $x_0 \\le x \\le x_1$, $y_0 \\le y \\le y_1$. Faces use their centre, one point standing for the whole face.',
    ],
    equations: [
      { label: 'Straight on', latex: 'e_{\\text{next}} = \\text{the edge at } v \\text{ with } F(e) \\cap F(e_{\\text{in}}) = \\varnothing, \\quad \\deg(v) = 4' },
      { label: 'Box test', latex: 'x_0 \\le \\pi_x(p) \\le x_1, \\quad y_0 \\le \\pi_y(p) \\le y_1' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** In a quad mesh, a regular vertex (degree 4, all incident faces quads) has a unique opposite edge for each incident edge. The edge loop through $e$ is the maximal sequence of edges, each the opposite of the previous at their shared vertex; it is a cycle or a path ending at irregular vertices or the boundary. Edge loops partition the edges of a regular region.',
      '**Invariant viewpoint.** Loops depend only on connectivity, not on positions: deform the mesh any way and the loops are the same edges. Box select depends only on positions on screen.',
      '**Geometric picture.** On a regular quad region, edge loops are the grid\'s lines: two families, like latitude and longitude. Irregular vertices are where the lines of the grid meet in threes or fives; every loop through them ends there.',
      '**Where this goes.** Lesson 5.3\'s loop cut splits the ring of quads across a loop. Subdivision (chapter 6) keeps quad grids regular, so loops survive it. UV seams (chapter 8) are often marked along loops.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-4-003-ex1',
      title: 'Straight on at one vertex',
      problem: 'In the grid, the walk arrives at $7$ along the edge from $6$. Which edge does it take?',
      steps: [
        { expression: '\\text{edges at } 7: \\; 6\\text{–}7, \\; 7\\text{–}8, \\; 7\\text{–}12, \\; 2\\text{–}7', annotation: 'Four edges: a regular vertex.' },
        { expression: 'F(6\\text{–}7) = \\{ \\text{quad below}, \\text{quad above} \\}', annotation: 'The incoming edge borders two quads.' },
        { expression: '7\\text{–}12 \\text{ and } 2\\text{–}7 \\text{ border those quads}', annotation: 'They are sides of the same two quads.' },
        { expression: '7\\text{–}8: \\text{ no shared face}', annotation: 'Step 2: this one.' },
      ],
      conclusion: 'The walk goes on to $8$: straight across the vertex.',
    },
    {
      id: 'modelling-geometry-4-003-ex2',
      title: 'Stopping at the boundary',
      problem: 'The walk arrives at $9$ (on the right-hand edge of the grid) from $8$. What happens?',
      steps: [
        { expression: '\\text{edges at } 9: \\; 8\\text{–}9, \\; 4\\text{–}9, \\; 9\\text{–}14', annotation: 'Three edges.' },
        { expression: '8\\text{–}9 \\text{ has two faces}', annotation: 'It came across the grid, not along the boundary, so Step 3 does not apply.' },
        { expression: '\\text{Step 4: stop}', annotation: 'No straight on.' },
      ],
      conclusion: 'The walk stops at $9$, then runs the other way from $6$ to $5$, giving the loop $5, 6, 7, 8, 9$.',
    },
    {
      id: 'modelling-geometry-4-003-ex3',
      title: 'A longitude on a sphere',
      problem: 'A UV sphere with $12$ segments and $8$ rings. How long is a longitude loop?',
      steps: [
        { expression: '\\text{rings } 1 \\text{ to } 7 \\text{ of vertices between the poles}', annotation: 'Each ring has 12 vertices; the poles are single vertices.' },
        { expression: '\\text{ring 1: its faces include the pole\'s triangles}', annotation: 'Step 2 needs every face round the vertex to be a quad: it stops there.' },
        { expression: '\\text{edges from ring 1 to ring 7: } 6', annotation: 'One edge between each pair of neighbouring rings.' },
      ],
      conclusion: 'The longitude loop has $6$ edges: it runs from ring $1$ to ring $7$ and stops next to each pole.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-4-003-ch1',
      difficulty: 'easy',
      problem: 'How many edges meet at a regular vertex, through which a loop goes straight on?',
      walkthrough: [{ expression: '4', annotation: 'Only with four is there exactly one edge sharing no face with the incoming one.' }],
      answer: 'Four, with all four faces round it quads.',
    },
    {
      id: 'modelling-geometry-4-003-ch2',
      difficulty: 'medium',
      problem: 'A loop round a character\'s arm stops halfway round. What should you look for there, and how do you fix it?',
      walkthrough: [
        { expression: '\\text{a pole (3 or 5 edges) or a triangle / n-gon}', annotation: 'Step 4: the walk stops there.' },
        { expression: '\\text{fix: rework the faces to quads with four edges per vertex along the loop}', annotation: 'Dissolve or reroute edges so the loop can pass.' },
      ],
      answer: 'A pole or a non-quad face at the point where it stops; rework the topology there (dissolve, rejoin or cut edges) so every vertex along the loop has four edges and all its faces are quads.',
    },
    {
      id: 'modelling-geometry-4-003-ch3',
      difficulty: 'hard',
      problem: 'A box select over a closed model selects vertices on its far side too. Propose a "visible only" box select and its cost.',
      walkthrough: [
        { expression: '\\text{for each vertex inside the rectangle: is it visible?}', annotation: 'Compare its depth with the depth buffer at its pixel (lesson 3.4).' },
        { expression: '\\text{keep it only if its depth is not behind what was drawn}', annotation: 'With a small tolerance, because it lies on the surface it is part of.' },
        { expression: '\\text{cost: a depth-buffer read per candidate, and a tolerance to tune}', annotation: 'Blender does this in solid mode.' },
      ],
      answer: 'After the rectangle test, keep a vertex only if its depth matches the depth buffer at its pixel (within a small tolerance); it costs reading the depth buffer and tuning that tolerance, and needs an X-ray mode for when you want the hidden ones too.',
    },
  ],

  semantics: {
    core: [
      { symbol: '\\text{box select}', meaning: 'Keep elements whose projected positions lie inside a screen rectangle.' },
      { symbol: '\\text{edge loop}', meaning: 'A line of edges, each straight on from the last through a regular vertex.' },
      { symbol: '\\deg(v) = 4', meaning: 'A regular vertex: four edges, four quads round it; loops pass straight through.' },
      { symbol: '\\text{pole}', meaning: 'A vertex with other than four edges; loops stop there.' },
      { symbol: 'F(e)', meaning: 'The faces on edge e (lesson 1.3\'s edge table); straight on shares none with the incoming edge.' },
      { symbol: '\\text{closed loop}', meaning: 'A loop that comes back to its start edge, like a line of latitude.' },
    ],
    rulesOfThumb: [
      'Keep meshes in quads with four edges per vertex where loops must run.',
      'A loop that stops early has hit a pole or a non-quad face.',
      'Box select is a screen test: check what is behind.',
      'In face select, a box selects faces by their centres.',
      'Loops depend on connectivity, not shape: deforming a mesh never changes them.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-4-002', label: 'Picking in screen space', note: 'Projecting vertices to pixels; box select tests those pixels.' },
      { lessonId: 'modelling-geometry-1-003', label: 'Edges and neighbours', note: 'The edge table, with the faces on each edge, drives the walk.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-5-003', label: 'Edge rings and loop cuts', note: 'A loop cut splits the ring of quads that a loop runs across.' },
      { lessonId: 'modelling-geometry-8-002', label: 'Seams', note: 'Seams for unwrapping are often marked along edge loops.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-4-003-1', label: 'Read how box select tests projected positions', type: 'read' },
    { id: 'cp-modelling-geometry-4-003-2', label: 'Read why "shares no face" is straight on', type: 'read' },
    { id: 'cp-modelling-geometry-4-003-3', label: 'Read why poles and triangles stop a loop', type: 'read' },
    { id: 'cp-modelling-geometry-4-003-4', label: 'Run cells 1 to 3: a box, a grid loop, sphere loops', type: 'lab' },
    { id: 'cp-modelling-geometry-4-003-5', label: 'Trace a loop in MeshLab in Predict mode, and Alt+click loops yourself', type: 'lab' },
    { id: 'cp-modelling-geometry-4-003-6', label: 'Work through example 1, straight on at one vertex', type: 'example' },
    { id: 'cp-modelling-geometry-4-003-7', label: 'Work through example 3, a longitude on a sphere', type: 'example' },
    { id: 'cp-modelling-geometry-4-003-8', label: 'Complete the challenge: walk a loop', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-4-003-assess-1',
        type: 'choice',
        text: 'A loop arrives at a vertex where five edges meet. What does the walk do?',
        options: ['Stops', 'Goes straight on', 'Takes the shortest edge', 'Turns left'],
        answer: 'Stops',
        hint: 'With five edges, two share no face with the incoming edge: there is no single straight on.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-4-003-quiz-1',
      type: 'choice',
      text: 'In edge select, which edges does a box select keep?',
      options: ['Those with both ends inside the rectangle', 'Those with either end inside', 'Those crossing the rectangle', 'Those whose midpoint is inside'],
      answer: 'Those with both ends inside the rectangle',
      hints: ['An edge is kept only if all of it is drawn inside.', 'Cell 1.'],
      reviewSection: 'Procedure: box, step 2',
    },
    {
      id: 'modelling-geometry-4-003-quiz-2',
      type: 'choice',
      text: 'At a regular vertex, which edge is straight on?',
      options: ['The one that shares no face with the incoming edge', 'The shortest one', 'The one at the smallest angle', 'The one with the highest number'],
      answer: 'The one that shares no face with the incoming edge',
      hints: ['The two side edges border the incoming edge\'s quads.', 'Math: "Why shares no face means straight on".'],
      reviewSection: 'Math: "Why shares no face means straight on"',
    },
    {
      id: 'modelling-geometry-4-003-quiz-3',
      type: 'choice',
      text: 'On a UV sphere, a longitude loop…',
      options: ['stops one ring short of each pole', 'goes all the way round through both poles', 'is a single edge', 'closes round the equator'],
      answer: 'stops one ring short of each pole',
      hints: ['The poles are surrounded by triangles.', 'Cell 3.'],
      reviewSection: 'Example 3',
    },
    {
      id: 'modelling-geometry-4-003-quiz-4',
      type: 'choice',
      text: 'Which of these does NOT stop an edge loop?',
      options: ['A vertex where four quads meet', 'A triangle', 'A vertex with three edges in the middle of the mesh', 'An n-gon'],
      answer: 'A vertex where four quads meet',
      hints: ['That is a regular vertex.', 'The walk goes straight through it.'],
      reviewSection: 'Warning "Poles and triangles cut loops short"',
    },
    {
      id: 'modelling-geometry-4-003-quiz-5',
      type: 'choice',
      text: 'You move every vertex of a mesh. What happens to its edge loops?',
      options: ['Nothing: they depend only on connectivity', 'They are recomputed and may change', 'They all close', 'They all break'],
      answer: 'Nothing: they depend only on connectivity',
      hints: ['The walk uses faces and edges, not positions.', 'Rigor: invariant viewpoint.'],
      reviewSection: 'Rigor: invariant viewpoint',
    },
    {
      id: 'modelling-geometry-4-003-quiz-6',
      type: 'choice',
      text: 'In the 4 × 4 grid, what is the loop through the edge 6–7?',
      options: ['5, 6, 7, 8, 9', '6, 7, 8, 9', '6, 7, 12, 17', '0, 6, 12, 18, 24'],
      answer: '5, 6, 7, 8, 9',
      hints: ['It goes straight on both ways.', 'It stops at the boundary on each side.'],
      reviewSection: 'Intuition: the grid paragraphs, and cell 2',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'A loop is any closed chain of edges.',
      whyStudentsThinkIt: 'The word "loop" suggests going round.',
      correctionExample: 'A loop goes straight on at every vertex: the longitude loop on the sphere is an open path of 6 edges, not a circle.',
      contrastCase: 'A latitude loop happens to close because every vertex on it is regular.',
    },
    {
      falseBelief: 'Straight on means the edge pointing in the most similar direction.',
      whyStudentsThinkIt: 'It looks like geometry.',
      correctionExample: 'Loops are chosen by faces, not angles: on a twisted, stretched grid the loop still follows the grid line even where it bends sharply.',
      contrastCase: 'On a flat, square grid the face rule and the direction rule happen to agree.',
    },
    {
      falseBelief: 'Box select only selects what you can see.',
      whyStudentsThinkIt: 'You drag over what is visible.',
      correctionExample: 'MeshLab selects every vertex drawn inside the rectangle, including ones on the back.',
      contrastCase: 'Blender\'s solid mode tests visibility, unless X-ray is on.',
    },
  ],

  transferPrompts: [
    {
      situation: 'You need to add a ring of edges round a character\'s waist to give the belt a sharper edge.',
      competingTechniques: ['Select the waist\'s vertices one by one', 'Alt+click an edge on the waist to select its loop, then loop cut beside it'],
      whyThisTechniqueWins: 'With clean quad topology the waist is one loop; one click selects it, and a loop cut (lesson 5.3) adds a parallel one. Picking dozens of vertices by hand is slow and misses some.',
    },
    {
      situation: 'Loops on a scanned model stop everywhere.',
      competingTechniques: ['Keep Alt+clicking in more places', 'Retopologise: rebuild the surface as clean quads with regular vertices'],
      whyThisTechniqueWins: 'Scanned meshes are triangles with irregular vertices everywhere, so every loop stops immediately; only quad retopology gives loops to work with.',
    },
  ],

  debugging: [
    {
      commonError: 'Choosing straight on by the angle between edges.',
      symptom: 'Loops wander off the grid line on curved or stretched meshes.',
      whyItHappened: 'Angles change with shape; the grid line is defined by faces.',
      repairStrategy: 'Choose the edge that shares no face with the incoming one.',
    },
    {
      commonError: 'Walking only one way from the start edge.',
      symptom: 'Open loops come out half as long as they should.',
      whyItHappened: 'The start edge has two ends; an open loop continues from both.',
      repairStrategy: 'If the walk does not close, walk from the other end too and join the halves.',
    },
    {
      commonError: 'No guard against revisiting edges.',
      symptom: 'The walk never ends on some meshes.',
      whyItHappened: 'A loop that runs into itself without returning to the start edge cycles forever.',
      repairStrategy: 'Keep a set of edges walked and stop on a repeat.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Box-select by projected positions, and walk an edge loop by hand on a grid and a sphere.',
    explainVerbally: 'Explain why straight on is the edge sharing no face, and why poles and non-quads stop loops.',
    detectIncorrectApplication: 'Recognise a loop that turned, stopped one way only, or never ended, and a box that grabbed hidden vertices.',
    transferToUnfamiliar: 'Plan loop-based edits on a character and recognise when a mesh needs retopology.',
  },
};
