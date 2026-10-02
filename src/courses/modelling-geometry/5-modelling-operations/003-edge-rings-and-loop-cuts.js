// Lesson 5.3: edge rings and loop cuts. From an edge, cross each quad to its opposite edge and on into the next
// quad: the ring. It stops at a face that is not a quad, or at the mesh's open edge. A loop cut puts a vertex the
// same fraction along every ring edge, oriented so the cut runs parallel, and splits each quad of the ring in two.
import { withPicture } from '../notebookScene.js';

// An 8-sided tube like MeshLab's: bottom ring 0–7 at y = −1, top ring 8–15 at y = 1, eight side quads facing out
// and two 8-sided caps.
const TUBE = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const n = 8, verts = [], faces = []
for (const y of [-1, 1]) for (let k = 0; k < n; k++) verts.push([Math.cos(2 * Math.PI * k / n), y, Math.sin(2 * Math.PI * k / n)])
faces.push([...Array(n).keys()].map((k) => n + k))                                   // the top cap, face 0
faces.push([...Array(n).keys()].map((k) => (n - k) % n))                            // the bottom cap, face 1
for (let k = 0; k < n; k++) faces.push([(k + 1) % n, k, n + k, n + (k + 1) % n])    // the sides, faces 2–9
const key = (a, b) => a < b ? a + '-' + b : b + '-' + a
function edgeFaces() {
  const m = new Map()
  faces.forEach((f, fi) => f.forEach((a, i) => { const k = key(a, f[(i + 1) % f.length]); if (!m.has(k)) m.set(k, []); m.get(k).push(fi) }))
  return m
}
// In a quad, the corner next to x that is not 'not': it stays on x's side of the ring.
function nextTo(quad, x, not) { const k = quad.indexOf(x), l = quad[(k + 1) % 4]; return l === not ? quad[(k + 3) % 4] : l }
// Walk the ring from edge [a, b]: cross each quad to its opposite edge, and on into the quad beyond.
function ring(a, b) {
  const map = edgeFaces(), seen = new Set(), out = { edges: [[a, b]], faces: [], closed: false, stops: [] }
  for (const [side, start] of map.get(key(a, b)).entries()) {
    let cur = [a, b], f = start, part = []
    while (f !== undefined && !seen.has(f) && faces[f].length === 4) {
      seen.add(f)
      const opp = [nextTo(faces[f], cur[0], cur[1]), nextTo(faces[f], cur[1], cur[0])]
      part.push({ f, opp })
      if (key(...opp) === key(a, b)) { out.closed = true; break }
      f = map.get(key(...opp)).find((g) => g !== f)
      cur = opp
    }
    if (!out.closed) out.stops.push(f === undefined ? 'the open edge' : 'face ' + f + ' (' + faces[f].length + ' corners)')
    const edges = part.map((p) => p.opp), fs = part.map((p) => p.f)
    if (out.closed) { out.edges.push(...edges.slice(0, -1)); out.faces.push(...fs); break }
    if (side === 0) { out.edges.push(...edges); out.faces.push(...fs) } else { out.edges.unshift(...edges.reverse()); out.faces.unshift(...fs.reverse()) }
  }
  return out
}
`;

const OPPOSITE = `${TUBE}
// One side quad, and the edge you come in by. Predict first: which edge do you leave by?
const quad = faces[2]
console.log('quad 2 = [' + quad.join(', ') + ']; in by [0, 8]')
const opp = [nextTo(quad, 0, 8), nextTo(quad, 8, 0)]
console.log('out by [' + opp.join(', ') + ']: ' + opp[0] + ' is next to 0, ' + opp[1] + ' is next to 8')
console.log('the opposite edge shares no corner with [0, 8]: ' + !opp.some((v) => v === 0 || v === 8))`;

const RINGS = `${TUBE}
// From an upright edge: round the tube.
const round = ring(0, 8)
console.log('from [0, 8]: ' + round.faces.length + ' quads, ' + (round.closed ? 'closed' : 'open') + '; edges ' + round.edges.map((e) => '[' + e + ']').join(' '))
// From a horizontal edge: up the side, and into a cap.
const up = ring(0, 1)
console.log('from [0, 1]: ' + up.faces.length + ' quad, ' + (up.closed ? 'closed' : 'open') + '; stops at ' + up.stops.join(' and '))`;

const ORIENT = `${TUBE}
// Put a vertex a quarter of the way along each ring edge: p + 0.25 (q − p).
const at = (p, q, t) => verts[p].map((x, j) => x + t * (verts[q][j] - x))
const { edges, faces: crossed } = ring(0, 8)
console.log('oriented, first corner on the same side each time: heights ' + edges.map(([p, q]) => r(at(p, q, 0.25)[1])).join(', '))
// The slip: write each exit edge the way its quad walks it, [f[i], f[i + 1]], instead.
const naive = [[0, 8]]
for (const fi of crossed.slice(0, -1)) {
  const f = faces[fi], i = naive.length
  const k = f.findIndex((a, j) => key(a, f[(j + 1) % 4]) === key(...edges[i]))
  naive.push([f[k], f[(k + 1) % 4]])
}
console.log('in each quad\\'s winding order: heights ' + naive.map(([p, q]) => r(at(p, q, 0.25)[1])).join(', '))`;

// The loop cut itself, used by cells 4 and 5.
const CUT = `${TUBE}
function loopCut(a, b, t) {
  const { edges, faces: ringFaces } = ring(a, b)
  const mid = new Map()
  for (const [p, q] of edges) {
    verts.push(verts[p].map((x, j) => x + t * (verts[q][j] - x)))
    mid.set(p + '>' + q, verts.length - 1); mid.set(q + '>' + p, verts.length - 1)
  }
  const inRing = new Set(ringFaces), halves = [], out = []
  faces.forEach((f, fi) => {
    if (inRing.has(fi)) {
      // Turn the quad so its ring edges are [p, q] and [r, s]; it becomes [p, m1, m2, s] and [m1, q, r, m2].
      let k = 0
      while (!mid.has(f[k] + '>' + f[(k + 1) % 4])) k++
      const [p, q, r2, s] = [0, 1, 2, 3].map((i) => f[(k + i) % 4]), m1 = mid.get(p + '>' + q), m2 = mid.get(r2 + '>' + s)
      halves.push(out.length, out.length + 1)
      out.push([p, m1, m2, s], [m1, q, r2, m2])
    } else {
      // A face beside an open end of the ring gets the new vertex in its outline, so the mesh stays joined.
      const g = []
      f.forEach((v, i) => { g.push(v); const m = mid.get(v + '>' + f[(i + 1) % f.length]); if (m !== undefined) g.push(m) })
      out.push(g)
    }
  })
  faces.length = 0; faces.push(...out)
  return halves
}
function stats() {
  const E = new Set(); faces.forEach((f) => f.forEach((a, i) => E.add(key(a, f[(i + 1) % f.length]))))
  return 'V ' + verts.length + ', E ' + E.size + ', F ' + faces.length + ', V − E + F = ' + (verts.length - E.size + faces.length)
}
`;

const SPLIT = `${CUT}
console.log('before: ' + stats())
loopCut(0, 8, 0.5)
console.log('round the middle: ' + stats())
// Now through one of the new horizontal edges, 16–17: up and down the side, into both caps.
loopCut(16, 17, 0.5)
console.log('across the side:  ' + stats())
console.log('the caps now have ' + faces.filter((f) => f.length > 4).map((f) => f.length).join(' and ') + ' corners')`;

const PICTURE = withPicture(`${CUT}
loopCut(0, 8, 0.5)
loopCut(16, 17, 0.5)
// Colour by the new vertices a face uses: the first cut made 16–23 (amber), the second 24–26 (green); caps grey.
const groups = faces.map((f) => f.length > 4 ? 7 : f.some((v) => v >= 24) ? 2 : f.some((v) => v >= 16) ? 1 : 0)
console.log(faces.length + ' faces: ' + groups.filter((g) => g === 1).length + ' amber, ' + groups.filter((g) => g === 2).length + ' green (the second cut split 2 of the first cut\\'s 16 halves), 2 caps')
show({ verts, faces, groups, normals: false })`);

const CHALLENGE = `// A 12-sided tube with two 12-sided caps. First you loop cut through an upright side edge. Then you loop cut
// through one of the new horizontal edges that first cut made.
// How many quads does each ring cross, and how many corners does each cap have at the end?
const answer = { first: 0, second: 0, cap: 0 }
console.log(answer)`;

const SOLVED = CHALLENGE.replace('const answer = { first: 0, second: 0, cap: 0 }', 'const answer = { first: 12, second: 2, cap: 13 }');

/** The challenge's check: on a 12-sided tube, the first ring crosses 12 quads, the second 2, and each cap ends with 13 corners. */
export function checkTwoCuts(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+answer\s*=\s*\{([^}]*)\}/);
  if (!m) return no('Keep the line const answer = { first: …, second: …, cap: … }.');
  const get = (k) => { const g = m[1].match(new RegExp(k + '\\s*:\\s*(-?\\d+(?:\\.\\d+)?)')); return g ? Number(g[1]) : NaN; };
  const first = get('first'), second = get('second'), cap = get('cap');
  if ([first, second, cap].some(Number.isNaN)) return no('Give all three as numbers: first, second and cap.');
  if (first === 24) return no('24 is the number of quads after the first cut. The ring crosses the 12 side quads, once each, before it splits them.');
  if (first !== 12) return no(`From an upright edge the ring goes round the tube through every side quad: ${first} is not how many there are.`);
  if (second === 1) return no('Before the first cut, a horizontal edge\'s ring crosses 1 quad. But the first cut split the side into two rows, so the ring now crosses one quad above the new loop and one below.');
  if (second === 12 || second === 24) return no('A ring through a horizontal edge does not go round: it runs up and down the side, and stops at each cap, which has 12 corners and no opposite edge.');
  if (second !== 2) return no(`The second ring runs from the new loop up into the top cap and down into the bottom one: ${second} is not how many quads it crosses.`);
  if (cap === 12) return no('The first ring was closed, so the caps did not change then. But the second ring ends at both caps, and the new vertex on the edge it ends at is added to each cap\'s outline (Step 4).');
  if (cap === 14) return no('Each cap touches one end of the second ring, so it gains one vertex, not two.');
  if (cap !== 13) return no(`${cap} is not the caps' corner count.`);
  return { pass: true, message: '12, 2 and 13. The first ring goes all the way round the 12 side quads and closes, leaving the caps alone. The second runs up through one quad and down through one, stopping at the caps; each cap gains the new vertex on its edge, 12 + 1 = 13 corners, so the mesh stays joined.' };
}

export default {
  id: 'modelling-geometry-5-003',
  slug: 'edge-rings-and-loop-cuts',
  chapter: 'modelling-geometry',
  order: 3,
  title: 'Edge rings and loop cuts',
  subtitle: 'Walk from an edge to the opposite edge of each quad, then split every quad you crossed.',
  tags: ['loop cut', 'edge ring', 'quads', 'topology', 'edge flow', 'modelling'],
  coreConcept: 'An edge ring is found by walking: from an edge, cross its quad to the opposite edge (the one sharing no corner), and on into the quad beyond, until the walk returns to its start (a closed ring) or reaches a face that is not a quad or the mesh\'s open edge. A loop cut puts a new vertex the same fraction t along every ring edge, each edge taken with its first corner on the same side of the ring so the cut runs parallel, and splits every quad of the ring in two. Faces at an open end gain the new vertex in their outline.',
  prerequisites: ['modelling-geometry-5-002', 'modelling-geometry-4-003'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-5-004',

  hook: {
    question: 'Press Ctrl+R over a cylinder\'s side and a new ring appears all the way round. Over its top edge, the cut goes down the side and stops. How does the tool know where to go, and where to stop?',
    realWorldContext: 'Loop cuts are how modellers add detail exactly where it is needed: an extra loop at a knee so it bends, round an eye so it closes, next to an edge so it stays sharp when smoothed. Every 3D package has one: Blender\'s Ctrl+R, Maya\'s Insert Edge Loop.',
  },

  intuition: {
    prose: [
      'Lesson 4.3 walked an **edge loop**: through a vertex, straight on along the edge opposite. This lesson walks across: through a **quad**, from an edge to the edge opposite it. The edges crossed are the **edge ring**, and the quads crossed are a strip of faces (a face loop).',
      'In a quad $[p, q, r, s]$, the edge opposite $[p, q]$ is $[r, s]$: the only edge sharing no corner with it. Before running cell 1, predict: you enter side quad $[1, 0, 8, 9]$ across $[0, 8]$. Which edge do you leave by?',
      '$[1, 9]$: written with $1$ first, because $1$ is the corner next to $0$, and $9$ next to $8$. Writing the opposite edge with each corner beside the one it faces keeps the ring **oriented**: every ring edge has its first corner on the same side.',
      'The walk continues into the quad on the other side of $[1, 9]$, and so on. It stops in one of three ways: it comes back to the edge it started from (a **closed** ring, like round a tube); it reaches a face that is **not a quad** (a triangle or n-gon has no single opposite edge); or it reaches the mesh\'s **open edge**, with no face beyond. From the start edge it walks both ways, so an open ring has two ends.',
      'Before running cell 2, predict: from the tube\'s horizontal edge $[0, 1]$, how many quads does the ring cross? One: the side quad, then the top cap, an 8-gon, stops it; the other way, the bottom cap stops it at once.',
      'A **loop cut** puts a new vertex the fraction $t$ along every ring edge, $p + t(q - p)$. Orientation is why the cut is straight: with every edge taken from the bottom up, $t = 0.25$ puts every vertex a quarter of the way up. Cell 3 shows the slip: write each exit edge the way its own quad walks it, and every one after the first runs top to bottom, so the cut jumps from a quarter of the way up to three quarters.',
      'Then each quad of the ring, turned so its ring edges are $[p, q]$ and $[r, s]$, becomes $[p, m_1, m_2, s]$ and $[m_1, q, r, m_2]$: same winding, so both halves face the same way as the quad they replace. A face at an open end of the ring gets the new vertex inserted in its outline, so nothing tears: the tube\'s caps go from $8$ corners to $9$ (cell 4).',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Loop cut through edge [a, b]',
        body: 'Step 1. Walk the ring each way from [a, b]: in quad Q, entered by [x, y], leave by [x′, y′], where x′ is the corner of Q next to x (not y), and y′ the one next to y. Continue into the other face of [x′, y′].\nStep 2. Stop when the walk returns to [a, b] (closed), meets a face that is not a quad, or meets an open edge.\nStep 3. For each ring edge [p, q], oriented: a new vertex p + t (q − p).\nStep 4. Each ring quad, turned so [p, q] and [r, s] are ring edges, becomes [p, m₁, m₂, s] and [m₁, q, r, m₂]. Each other face with a ring edge gains that edge\'s new vertex in its outline.',
      },
      {
        type: 'warning',
        title: 'Triangles and n-gons stop rings',
        body: 'A ring cannot cross a face that is not a quad. If a loop cut stops short of where you wanted it, look for a triangle or n-gon in the way: that is why modellers keep meshes in quads (lesson 5.9).',
      },
      {
        type: 'warning',
        title: 'A ring can come back crossed',
        body: 'On a Möbius strip, a ring walked all the way round comes back to its start edge reversed: oriented edges do not close up. That is a non-orientable surface, and the cut no longer runs parallel. Real models are orientable, so this almost never happens, but it is why the walk compares edges, not directions.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: edge flow',
        body: 'Where loops run decides how a mesh deforms and shades. Loops that follow the form (round a limb, round an eye) bend cleanly when animated and subdivide smoothly; a loop cut close to an edge pulls the subdivided surface tight there and keeps the edge crisp (lesson 6.4). Rings stop at triangles and n-gons, so topology decides where detail can be added.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "a loop cut adds one edge". The first cut (amber quads) went round the tube and split all 8 side quads; the second (green) ran up and down one column and stopped at the caps (grey), which grew a corner each.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'In the cells, nextTo() is Step 1\'s corner rule and ring() walks it both ways (Step 2); in loopCut(), mid is Step 3, and the quad split and outline insertion are Step 4.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'A loop cut changes no shape: the new vertices lie on the old edges. The GPU draws twice as many triangles across the ring, but the picture only changes once you move the new loop or smooth the mesh.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Ctrl+R cuts through the edge under the pointer; Position in the Adjust panel sets t afterwards. With Record traces on, the trace walks the ring quad by quad (predict the edge you leave by), says why it stopped, then places the vertices (predict one). Alt+click in face mode selects the ring\'s faces. Scripts call mesh.loopCut(a, b, t).' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: walk a ring and cut it',
        caption: 'Opposite edges, two rings on a tube, why orientation matters, the split, and both cuts drawn.',
        props: {
          lesson: {
            title: 'Edge rings and loop cuts',
            subtitle: 'Across each quad to the opposite edge.',
            cells: [
              { type: 'js', instruction: '### 1. The opposite edge\nPredict first: entering quad [1, 0, 8, 9] across [0, 8], which edge do you leave by?', startCode: OPPOSITE },
              { type: 'js', instruction: '### 2. Two rings on a tube\nPredict first: how many quads does the ring through [0, 1] cross?', startCode: RINGS },
              { type: 'js', instruction: '### 3. Why orientation matters\nA vertex a quarter of the way along each ring edge, two ways.', startCode: ORIENT },
              { type: 'js', instruction: '### 4. Split the quads\nTwo cuts; V − E + F and the caps\' corners after each.', startCode: SPLIT },
              { type: 'js', instruction: '### 5. See both cuts\nThe first cut amber, the second green, the caps grey. Drag to turn.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 360 },
              { type: 'challenge', instruction: '### 6. Challenge: two cuts on a 12-sided tube\nCount the quads each ring crosses and the caps\' corners. The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkTwoCuts },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Edge rings and loop cuts" in MeshLab](#/lab/mesh-lab?project=loop-cuts). The tube is cut round its middle with **Record traces** on: press Play, predict the edge the walk leaves the first quad by, and where the first vertex goes. Then cut across the side yourself and watch the trace stop at the caps.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Edit mode, Ctrl+R:** cut through the edge under the pointer; then set **Position** in the Adjust panel.\n- **Alt+click** an edge in face mode to select the ring of faces; in edge mode, the edge loop (lesson 4.3).\n- In a script: `mesh.loopCut(a, b, 0.5)`.\n- [Open "Box-modelled character" in MeshLab](#/lab/mesh-lab?project=character-model): its limbs were shaped with loop cuts.\n- **In Blender:** Ctrl+R, then scroll for more cuts and click; Edge Slide (G G) moves the loop afterwards.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Opposite edges.** A quad $[v_0, v_1, v_2, v_3]$ has edges $e_k = [v_k, v_{k+1}]$ (indices mod 4). The edge opposite $e_k$ is $e_{k+2}$: it is the only one sharing no corner with $e_k$. In each quad the ring therefore enters and leaves by a pair of opposite edges, and the quad\'s other two edges become the "rails" the cut runs between.',
      '**Orientation.** Enter by $[x, y]$ with $x = v_k$, $y = v_{k+1}$. The corner next to $x$ other than $y$ is $v_{k-1} = v_{k+3}$, and next to $y$ is $v_{k+2}$. So the exit edge, written $[v_{k+3}, v_{k+2}]$, runs the opposite way round the quad from the entry edge: both point the same way across the strip. By induction, every ring edge points the same way, and $p + t(q - p)$ puts every new vertex the same fraction across.',
      '**Termination.** Each quad is crossed at most once (the walk records the faces it has seen), so the walk ends after at most $F$ steps. A ring is closed exactly when the walk returns to its start edge.',
      '**Counts.** A closed ring of $k$ quads has $k$ ring edges. Splitting each adds $k$ vertices and $k$ edges; each quad gains one edge across it and becomes two faces: $k$ more edges, $k$ more faces. So $\\Delta(V - E + F) = k - 2k + k = 0$. An open ring of $k$ quads has $k + 1$ ring edges: $\\Delta = (k + 1) - ((k + 1) + k) + k = 0$. Cell 4: $V - E + F = 2$ before, after the closed cut ($16 \\to 24$ vertices) and after the open one ($24 \\to 27$).',
    ],
    equations: [
      { label: 'Opposite edge', latex: '[v_k, v_{k+1}] \\;\\to\\; [v_{k+3}, v_{k+2}] \\quad (\\text{mod } 4)' },
      { label: 'New vertex', latex: 'm = p + t\\,(q - p), \\quad 0 < t < 1' },
      { label: 'Split', latex: '[p, q, r, s] \\;\\to\\; [p, m_1, m_2, s],\\; [m_1, q, r, m_2]' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** On a manifold mesh, the edge ring through an edge $e$ is the maximal sequence of edges $e = e_0, e_1, \\ldots$ in which consecutive edges are opposite edges of a quad, each quad used once. It is either a cycle or a path whose ends lie on non-quad faces or on the boundary. Loop cutting it with parameter $t$ refines the mesh without changing its shape and preserves orientation and the Euler characteristic.',
      '**Invariant viewpoint.** The ring depends only on the start edge and the mesh\'s connectivity, not on positions or numbering; the cut\'s positions depend on $t$ and the orientation, and swapping the start edge\'s ends turns $t$ into $1 - t$.',
      '**Geometric picture.** Quads in a grid-like region form a net of "streets" running two ways. A ring is one street crossed from side to side; a loop is one street walked along. Loop cutting adds a street parallel to the ones beside it.',
      '**Where this goes.** Lesson 5.4 bevels edges, which adds strips of faces like a loop cut does, but beside an edge rather than across a ring. Catmull–Clark subdivision (lesson 6.2) is, in effect, a loop cut through every ring at once, followed by smoothing.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-5-003-ex1',
      title: 'The opposite edge',
      problem: 'In quad $[4, 7, 12, 9]$, you enter by $[7, 12]$. Which edge do you leave by, oriented?',
      steps: [
        { expression: '\\text{next to 7, not 12: } 4', annotation: 'The corner before 7 in the quad.' },
        { expression: '\\text{next to 12, not 7: } 9', annotation: 'The corner after 12.' },
      ],
      conclusion: 'Leave by [4, 9]: 4 on 7\'s side, 9 on 12\'s.',
    },
    {
      id: 'modelling-geometry-5-003-ex2',
      title: 'A ring on a grid',
      problem: 'A flat $5 \\times 3$ grid of quads (5 across, 3 deep). You loop cut through a vertical edge on its left border. How many quads does the ring cross, and is it closed?',
      steps: [
        { expression: '\\text{each quad: in by its left edge, out by its right}', annotation: 'Opposite edges.' },
        { expression: '5\\text{ quads across one row}', annotation: 'From the left border to the right.' },
        { expression: '\\text{the right border edge has no face beyond}', annotation: 'An open edge stops it.' },
      ],
      conclusion: '5 quads; an open ring, so 6 new vertices and 10 faces where there were 5.',
    },
    {
      id: 'modelling-geometry-5-003-ex3',
      title: 'Placing a vertex',
      problem: 'A ring edge runs from $(1, -1, 0)$ to $(1, 1, 0)$. Where does a loop cut at $t = 0.3$ put its vertex?',
      steps: [
        { expression: 'q - p = (0, 2, 0)', annotation: 'Step 3.' },
        { expression: 'p + 0.3\\,(q - p) = (1, -0.4, 0)', annotation: 'Three tenths of the way up.' },
      ],
      conclusion: '(1, −0.4, 0).',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-5-003-ch1',
      difficulty: 'easy',
      problem: 'Why can a ring not cross a triangle?',
      walkthrough: [{ expression: '\\text{a triangle\'s other two edges both touch the one you came in by}', annotation: 'No edge is opposite.' }],
      answer: 'In a triangle every edge shares a corner with the one you entered by, so there is no opposite edge to leave by; the ring stops.',
    },
    {
      id: 'modelling-geometry-5-003-ch2',
      difficulty: 'medium',
      problem: 'A UV sphere has quads everywhere except triangles round each pole. You loop cut through a "latitude" edge (along a ring of quads). What happens, and what if you cut through a "longitude" edge?',
      walkthrough: [
        { expression: '\\text{latitude edge: the ring runs north–south}', annotation: 'Across each quad to the next latitude edge.' },
        { expression: '\\text{it stops at the triangles round each pole}', annotation: 'Open, with two ends.' },
        { expression: '\\text{longitude edge: the ring runs round}', annotation: 'Closed: a new latitude line.' },
      ],
      answer: 'Through a latitude edge the ring runs north–south and stops at the pole triangles: a cut along one column, from pole to pole. Through a longitude edge it goes round the sphere and closes: a new latitude circle.',
    },
    {
      id: 'modelling-geometry-5-003-ch3',
      difficulty: 'hard',
      problem: 'Prove that on an orientable quad mesh, a closed ring\'s oriented edges come back in the same direction they started.',
      walkthrough: [
        { expression: '\\text{each step keeps "same side" through one quad}', annotation: 'From the orientation rule.' },
        { expression: '\\text{the strip of quads is an annulus or a Möbius band}', annotation: 'A closed strip is one or the other.' },
        { expression: '\\text{orientable surfaces contain no Möbius band}', annotation: 'So it is an annulus.' },
      ],
      answer: 'The ring\'s quads form a closed strip. Keeping corners on the same side is transporting a "side" along the strip; it returns reversed only if the strip is a Möbius band. An orientable surface contains no Möbius band, so the strip is an annulus and the edges come back the same way.',
    },
  ],

  semantics: {
    core: [
      { symbol: '\\text{edge ring}', meaning: 'The edges crossed by walking from an edge through each quad to its opposite edge.' },
      { symbol: '\\text{edge loop}', meaning: 'The edges walked along through four-edge vertices (lesson 4.3): runs at right angles to a ring.' },
      { symbol: '[v_{k+3}, v_{k+2}]', meaning: 'The exit edge, oriented, from a quad entered by [v_k, v_{k+1}].' },
      { symbol: 't', meaning: 'How far along each ring edge the new vertex goes, from its first corner.' },
      { symbol: 'm_1, m_2', meaning: 'The new vertices on a ring quad\'s two ring edges.' },
      { symbol: '\\text{closed / open}', meaning: 'Whether the walk came back to its start, or stopped at a non-quad face or open edge.' },
    ],
    rulesOfThumb: [
      'Rings cross quads; loops run along them.',
      'Opposite edge: the one sharing no corner.',
      'Keep corners on the same side, or the cut jumps.',
      'Triangles, n-gons and open edges stop rings.',
      'Faces at an open end gain a vertex, so nothing tears.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-4-003', label: 'Box and loop selection', note: 'The edge loop: the walk along, where this lesson walks across.' },
      { lessonId: 'modelling-geometry-5-002', label: 'Inset', note: 'Another way to add a ring of faces, round a region.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-5-004', label: 'Bevel', note: 'Strips beside an edge, instead of across a ring.' },
      { lessonId: 'modelling-geometry-6-004', label: 'Keeping edges sharp', note: 'Loop cuts near an edge as support loops.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-5-003-1', label: 'Read how a ring is walked across opposite edges', type: 'read' },
    { id: 'cp-modelling-geometry-5-003-2', label: 'Read the three ways a ring walk stops', type: 'read' },
    { id: 'cp-modelling-geometry-5-003-3', label: 'Read why ring edges are oriented', type: 'read' },
    { id: 'cp-modelling-geometry-5-003-4', label: 'Run cells 1 to 4: opposite edges, rings, orientation, the split', type: 'lab' },
    { id: 'cp-modelling-geometry-5-003-5', label: 'Trace a loop cut in MeshLab and predict the exit edge', type: 'lab' },
    { id: 'cp-modelling-geometry-5-003-6', label: 'Work through example 2, a ring on a grid', type: 'example' },
    { id: 'cp-modelling-geometry-5-003-7', label: 'Work through example 3, placing a vertex', type: 'example' },
    { id: 'cp-modelling-geometry-5-003-8', label: 'Complete the challenge: two cuts on a 12-sided tube', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-5-003-assess-1',
        type: 'choice',
        text: 'You loop cut round a 16-sided tube through an upright edge. How many new faces does the mesh have?',
        options: ['16', '32', '8', '17'],
        answer: '16',
        hint: 'Each of the 16 side quads becomes two.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-5-003-quiz-1',
      type: 'choice',
      text: 'In quad [2, 5, 6, 3], which edge is opposite [5, 6], written with the corner beside 5 first?',
      options: ['[2, 3]', '[3, 2]', '[6, 3]', '[5, 3]'],
      answer: '[2, 3]',
      hints: ['It shares no corner with [5, 6].', '2 is next to 5; 3 is next to 6.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-5-003-quiz-2',
      type: 'choice',
      text: 'Which of these does NOT stop a ring walk?',
      options: ['A vertex with five edges', 'A triangle', 'An 8-sided face', 'The open edge of the mesh'],
      answer: 'A vertex with five edges',
      hints: ['A ring walks through faces, not vertices.', 'Edge loops stop at poles; rings stop at non-quads.'],
      reviewSection: 'Intuition: the three ways to stop',
    },
    {
      id: 'modelling-geometry-5-003-quiz-3',
      type: 'choice',
      text: 'Why are ring edges oriented before the vertices are placed?',
      options: ['So t means the same fraction from the same side on every edge', 'To find the opposite edge', 'To keep the faces as quads', 'For speed'],
      answer: 'So t means the same fraction from the same side on every edge',
      hints: ['Cell 3.', 'Otherwise the cut jumps from t to 1 − t.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-5-003-quiz-4',
      type: 'choice',
      text: 'A ring stops at an 8-sided cap. What happens to the cap when you loop cut?',
      options: ['It gains the new vertex: 9 corners', 'It is split in two', 'Nothing', 'It is deleted'],
      answer: 'It gains the new vertex: 9 corners',
      hints: ['Step 4.', 'Cell 4.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-5-003-quiz-5',
      type: 'choice',
      text: 'What happens to V − E + F after a loop cut?',
      options: ['It stays the same', 'It goes up by the number of quads cut', 'It goes up by 1', 'It halves'],
      answer: 'It stays the same',
      hints: ['Cell 4.', 'The shape is the same surface.'],
      reviewSection: 'Maths: counts',
    },
    {
      id: 'modelling-geometry-5-003-quiz-6',
      type: 'choice',
      text: 'Right after a loop cut at t = 0.5, how does the shaded model look?',
      options: ['The same: the new vertices lie on the old edges', 'Smoother', 'Sharper at the cut', 'Darker along the cut'],
      answer: 'The same: the new vertices lie on the old edges',
      hints: ['Bridge: from code to the GPU.', 'No shape changed.'],
      reviewSection: 'Insight "Bridge: from code to the GPU"',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'A loop cut adds a single edge.',
      whyStudentsThinkIt: 'You point at one edge.',
      correctionExample: 'Cell 4: one cut round the tube adds 8 vertices, 16 edges and 8 faces.',
      contrastCase: 'The knife (lesson 4.5) cuts only where you draw; a loop cut follows the whole ring.',
    },
    {
      falseBelief: 'Edge rings and edge loops are the same thing.',
      whyStudentsThinkIt: 'Both are "loops" of edges.',
      correctionExample: 'On the tube, the loop through an upright edge runs up the side; the ring through it goes round.',
      contrastCase: 'They are at right angles: a loop cut adds a new edge loop by cutting across an edge ring.',
    },
    {
      falseBelief: 'A loop cut always goes all the way round.',
      whyStudentsThinkIt: 'On cylinders and limbs it does.',
      correctionExample: 'Cell 2: from the tube\'s horizontal edge the ring crosses one quad and stops at both caps.',
      contrastCase: 'On a closed region of quads with no n-gons or triangles in the way, it does close.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A character\'s elbow creases badly when the arm bends.',
      competingTechniques: ['Move vertices by hand', 'Loop cut round the arm on either side of the elbow'],
      whyThisTechniqueWins: 'Two extra loops give the joint geometry to bend into, evenly all the way round.',
    },
    {
      situation: 'A loop cut you want to run round a whole helmet stops half way.',
      competingTechniques: ['Cut again from the other side', 'Find the triangle or n-gon in the way and turn it into quads'],
      whyThisTechniqueWins: 'The ring stops at the non-quad face; fixing the topology lets one cut go all the way round, now and for every later cut.',
    },
  ],

  debugging: [
    {
      commonError: 'Taking the opposite edge in the face\'s winding order.',
      symptom: 'At any t other than 0.5, the cut jumps: part of it at t, the rest at 1 − t.',
      whyItHappened: 'Neighbouring quads walk their shared edge in opposite directions.',
      repairStrategy: 'Write each exit edge with its first corner next to the entry edge\'s first corner.',
    },
    {
      commonError: 'Not adding the new vertex to faces at an open end.',
      symptom: 'A crack along the edge where the ring stopped; the edge has a face on one side only.',
      whyItHappened: 'The ring quad\'s edge was split but the neighbouring n-gon still uses the whole edge.',
      repairStrategy: 'Insert the new vertex into every face that has the split edge (Step 4).',
    },
    {
      commonError: 'Walking a quad twice.',
      symptom: 'An endless loop, or a quad split twice.',
      whyItHappened: 'A ring that crosses itself (rare, on twisted strips) revisits a quad.',
      repairStrategy: 'Record each quad crossed and stop on a repeat.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Walk a ring by hand, say where it stops, and count the vertices and faces a loop cut adds.',
    explainVerbally: 'Explain opposite edges, why rings stop at non-quads, and why orientation keeps the cut parallel.',
    detectIncorrectApplication: 'Recognise cuts that jump, cracks at open ends and rings blocked by triangles.',
    transferToUnfamiliar: 'Plan where to add loops on a model for bending or sharpening, and fix topology that blocks them.',
  },
};
