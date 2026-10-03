// Lesson 8.2: seams and charts. To lie flat, a surface must be cut into discs. Seams are the cuts; faces joined across
// non-seam edges form a chart (breadth-first search over faces). A chart is a disc when χ = W − E + F = 1 with one
// boundary loop, counting its wedges W (lesson 8.1) and each seam side as its own edge. Seams whose complement is a
// spanning tree of the faces open a sphere-like surface into one disc: E − F + 1 seams. A torus needs two loops.

const CHARTS = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const key = (a, b) => (a < b ? a + '-' + b : b + '-' + a)
// Cut a mesh { V, F } along the seam edges and describe each piece: faces, wedges W, edges E, χ = W − E + F, rims.
function charts({ V, F }, seams) {
  const sides = new Map()                                     // edge → the faces using it, and where
  F.forEach((f, fi) => f.forEach((a, i) => { const b = f[(i + 1) % f.length], k = key(a, b); if (!sides.has(k)) sides.set(k, []); sides.get(k).push({ fi, i, a, b }) }))
  const joined = (k) => sides.get(k).length === 2 && !seams.has(k)
  // 1. Charts: flood from each unvisited face across edges that are not seams.
  const chartOf = F.map(() => -1), out = []
  F.forEach((_, start) => {
    if (chartOf[start] >= 0) return
    const faces = [start], c = out.length; chartOf[start] = c
    for (let q = 0; q < faces.length; q++) F[faces[q]].forEach((a, i) => {
      const k = key(a, F[faces[q]][(i + 1) % F[faces[q]].length])
      if (joined(k)) for (const s of sides.get(k)) if (chartOf[s.fi] < 0) { chartOf[s.fi] = c; faces.push(s.fi) }
    })
    out.push({ faces })
  })
  // 2. Wedges: corners at one vertex are one wedge if joined across a non-seam edge (union-find on corners).
  const id = (fi, i) => fi * 64 + i, parent = new Map(), find = (x) => { while (parent.get(x) !== x) x = parent.get(x); return x }
  F.forEach((f, fi) => f.forEach((_, i) => parent.set(id(fi, i), id(fi, i))))
  const union = (x, y) => parent.set(find(x), find(y))
  for (const [k, s] of sides) if (joined(k)) {
    const [p, q] = s, at = (side, v) => (F[side.fi][side.i] === v ? side.i : (side.i + 1) % F[side.fi].length)
    union(id(p.fi, at(p, p.a)), id(q.fi, at(q, p.a))); union(id(p.fi, at(p, p.b)), id(q.fi, at(q, p.b)))
  }
  for (const c of out) {
    const W = new Set(c.faces.flatMap((fi) => F[fi].map((_, i) => find(id(fi, i))))).size
    let E = 0, rim = []
    for (const fi of c.faces) F[fi].forEach((a, i) => {
      const k = key(a, F[fi][(i + 1) % F[fi].length])
      if (joined(k)) E += 0.5; else { E += 1; rim.push([find(id(fi, i)), find(id(fi, (i + 1) % F[fi].length))]) }
    })
    // Rims: the cut sides form loops of wedges; count the loops (connected groups).
    const p2 = new Map(), f2 = (x) => { while (p2.get(x) !== x) x = p2.get(x); return x }
    for (const [a, b] of rim) { if (!p2.has(a)) p2.set(a, a); if (!p2.has(b)) p2.set(b, b); p2.set(f2(a), f2(b)) }
    c.W = W; c.E = E; c.F = c.faces.length; c.chi = W - E + c.faces.length
    c.rims = new Set([...p2.keys()].map(f2)).size; c.disc = c.chi === 1 && c.rims === 1
  }
  return out
}
const describe = (cs) => cs.map((c) => c.F + ' face' + (c.F === 1 ? '' : 's') + ': W ' + c.W + ', E ' + c.E + ', χ ' + c.chi + ', ' + c.rims + ' rim' + (c.rims === 1 ? '' : 's') + (c.disc ? ' (disc)' : ' (not a disc)'))
// A cube: faces back (z = −1), front, bottom, top, right, left.
const cube = { V: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
  F: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 4, 7, 3]] }
const allEdges = [...new Set(cube.F.flatMap((f) => f.map((a, i) => key(a, f[(i + 1) % 4]))))]
`;

const CUBE = `${CHARTS}
// Cut a cube along all 12 edges, then along none, then along just one. Predict first: which of these are discs?
console.log('12 seams: ' + charts(cube, new Set(allEdges)).length + ' charts, ' + describe(charts(cube, new Set(allEdges)))[0] + ' each')
console.log('no seams: ' + describe(charts(cube, new Set())).join('; '))
console.log('one seam (edge 0-1): ' + describe(charts(cube, new Set(['0-1']))).join('; '))`;

const NET = `${CHARTS}
// A cross-shaped net: keep the front joined to top, bottom, left and right, and the back joined to the top.
// Those 5 joins are a spanning tree of the 6 faces; the other 7 edges are seams. Predict first: one disc? How many wedges?
const keep = new Set(['6-7', '4-5', '4-7', '5-6', '2-3'])
const seams = new Set(allEdges.filter((k) => !keep.has(k)))
console.log(seams.size + ' seams: ' + [...seams].join(', '))
console.log(describe(charts(cube, seams)).join('; '))`;

const TUBE = `${CHARTS}
// An open tube (8 sides, 2 rings) and a torus (8 × 4). Predict first: how many cuts does each need to become a disc?
const n = 8, tube = { V: [], F: [] }
for (let i = 0; i < n; i++) tube.F.push([i, (i + 1) % n, n + (i + 1) % n, n + i])
console.log('tube, no seams: ' + describe(charts(tube, new Set())).join('; '))
console.log('tube, one seam from rim to rim (0-8): ' + describe(charts(tube, new Set(['0-8']))).join('; '))
const m = 4, torus = { V: [], F: [] }, at = (i, j) => (i % n) * m + (j % m)
for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) torus.F.push([at(i, j), at(i, j + 1), at(i + 1, j + 1), at(i + 1, j)])
const around = new Set(Array.from({ length: m }, (_, j) => key(at(0, j), at(0, j + 1))))      // a loop round the tube
const along = new Set(Array.from({ length: n }, (_, i) => key(at(i, 0), at(i + 1, 0))))        // a loop along the ring
console.log('torus, no seams: ' + describe(charts(torus, new Set())).join('; '))
console.log('torus, one loop round the tube: ' + describe(charts(torus, around)).join('; '))
console.log('torus, both loops: ' + describe(charts(torus, new Set([...around, ...along]))).join('; '))`;

const PICTURE = `${CHARTS}
// The cross net laid flat: unfold face by face across the kept edges. Seams are orange, folds dashed. Each corner is
// labelled with its 3D vertex: a vertex that appears several times is split into several wedges.
const keep = new Set(['6-7', '4-5', '4-7', '5-6', '2-3'])
const flat = cube.F.map(() => null)
flat[1] = { 4: [0, 0], 5: [1, 0], 6: [1, 1], 7: [0, 1] }               // the front face, as a unit square
const queue = [1]
while (queue.length) {
  const fi = queue.shift(), f = cube.F[fi]
  f.forEach((a, i) => {
    const b = f[(i + 1) % 4], k = key(a, b)
    if (!keep.has(k)) return
    const gi = cube.F.findIndex((g, j) => j !== fi && g.includes(a) && g.includes(b))
    if (flat[gi]) return
    // Reflect the face's own square across the shared edge: its far corners lie one unit beyond, away from this face.
    const A = flat[fi][a], B = flat[fi][b], d = [B[0] - A[0], B[1] - A[1]], out = [d[1], -d[0]]
    const g = cube.F[gi], pos = {}
    pos[a] = A; pos[b] = B
    for (const v of g) if (v !== a && v !== b) { const nearA = g[(g.indexOf(v) + 1) % 4] === a || g[(g.indexOf(v) + 3) % 4] === a; const base = nearA ? A : B; pos[v] = [base[0] + out[0], base[1] + out[1]] }
    flat[gi] = pos; queue.push(gi)
  })
}
const canvas = document.createElement('canvas'), W = 380, H = 300
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'); g.scale(2, 2); g.fillStyle = '#0f1923'; g.fillRect(0, 0, W, H)
const all = flat.flatMap((p) => Object.values(p)), xs = all.map((p) => p[0]), ys = all.map((p) => p[1])
const s = 62, ox = W / 2 - s * (Math.min(...xs) + Math.max(...xs)) / 2, oy = H / 2 + s * (Math.min(...ys) + Math.max(...ys)) / 2
const X = (p) => ox + s * p[0], Y = (p) => oy - s * p[1]
const names = ['back', 'front', 'bottom', 'top', 'right', 'left']
cube.F.forEach((f, fi) => {
  g.fillStyle = 'rgba(96, 165, 250, 0.18)'; g.beginPath(); f.forEach((v, i) => (i ? g.lineTo : g.moveTo).call(g, X(flat[fi][v]), Y(flat[fi][v]))); g.closePath(); g.fill()
  f.forEach((a, i) => {
    const b = f[(i + 1) % 4], seam = !keep.has(key(a, b))
    g.strokeStyle = seam ? '#f59e0b' : '#94a3b8'; g.lineWidth = seam ? 2.5 : 1; g.setLineDash(seam ? [] : [4, 4])
    g.beginPath(); g.moveTo(X(flat[fi][a]), Y(flat[fi][a])); g.lineTo(X(flat[fi][b]), Y(flat[fi][b])); g.stroke()
  })
  const c = f.map((v) => flat[fi][v]).reduce((m, p) => [m[0] + p[0] / 4, m[1] + p[1] / 4], [0, 0])
  g.setLineDash([]); g.fillStyle = '#e2e8f0'; g.font = '11px sans-serif'; g.textAlign = 'center'; g.fillText(names[fi], X(c), Y(c) + 4)
})
g.fillStyle = '#facc15'; g.font = '10px sans-serif'
const seen = new Map()
cube.F.forEach((f, fi) => f.forEach((v) => { const p = flat[fi][v], k = p.map((x) => x.toFixed(3)).join(); if (!seen.has(k)) { seen.set(k, v); g.fillText(String(v), X(p) + 6, Y(p) - 4) } }))
console.log('flat corners (wedges): ' + seen.size + ' for 8 vertices')`;

const CHALLENGE = `// An octahedron has 6 vertices, 12 edges and 8 triangular faces. You want one net: a single disc, by keeping a spanning
// tree of faces joined and cutting every other edge. How many seam edges?
const seams = 0
console.log(seams)`;

const SOLVED = CHALLENGE.replace('const seams = 0', 'const seams = 12 - (8 - 1)');

/** The challenge's check: a spanning tree of 8 faces keeps 7 edges, so 12 − 7 = 5 are seams. */
export function checkSeamCount(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+seams\s*=\s*([^\n]+)/);
  if (!m) return no('Keep the line const seams = …, with a number or plain arithmetic.');
  const expr = m[1].replace(/\/\/.*$/, '').trim().replace(/;$/, '');
  // Only plain arithmetic is evaluated: this runs in the page, not the cell's sandbox.
  if (!/^[\d\s+\-*/()]+$/.test(expr)) return no('Write the count as a number or plain arithmetic, like 12 - 3.');
  let v;
  try { v = Number(new Function('return (' + expr + ')')()); } catch { return no('That expression did not run.'); }
  if (v === 5) return { pass: true, message: '5: a spanning tree of 8 faces has 8 − 1 = 7 kept edges (each join adds one face), and every other edge is cut: 12 − 7 = 5. The general rule for a sphere-like surface is E − F + 1, which is V − 1 by Euler\'s formula: the 5 seams form a tree through all 6 vertices.' };
  if (v === 0) return no('Each kept edge joins one more face to the net. How many joins do 8 faces need to be one piece?');
  if (v === 4) return no('12 − 8 keeps one join too many: 8 faces need only 7 joins to be one piece (a tree), so 12 − 7.');
  if (v === 7) return no('7 is the number of kept edges (the spanning tree). The seams are all the other edges.');
  if (v === 12) return no('Cutting all 12 edges gives 8 separate triangles, not one net.');
  return no(`${v} is not right. A spanning tree of F faces keeps F − 1 edges; the rest are seams.`);
}

export default {
  id: 'modelling-geometry-8-002',
  slug: 'seams-and-charts',
  chapter: 'modelling-geometry',
  order: 2,
  title: 'Seams and charts',
  subtitle: 'Where to cut a surface so it can lie flat: charts by breadth-first search, and the disc test χ = 1.',
  tags: ['uv', 'seams', 'charts', 'euler characteristic', 'disc', 'spanning tree', 'unfolding'],
  coreConcept: 'A surface can be flattened only if it is cut into pieces that are each topologically a disc. Seams are the cuts; a chart is the set of faces reachable from one another across non-seam edges, found by breadth-first search over faces. Counting the chart\'s wedges W, its edges E (each seam side separately) and faces F, it is a disc exactly when χ = W − E + F = 1 and it has one boundary loop. On a sphere-like surface, keeping a spanning tree of faces joined and cutting the other E − F + 1 edges gives one disc (a net); a tube needs one cut from rim to rim; a torus needs two loops.',
  prerequisites: ['modelling-geometry-8-001', 'modelling-geometry-1-005'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-8-003',

  hook: {
    question: 'A cardboard box flattens into a cross-shaped net. A can\'s label peels off as a rectangle. A doughnut\'s icing will not lie flat however you slice it once. What decides how many cuts a surface needs before it can lie flat, and where should they go?',
    realWorldContext: 'Every UV unwrap starts with seams: artists place them along hidden edges (under arms, along the inside of legs, at the back of a head) because the texture jumps there. Packaging nets, sewing patterns and sheet-metal flat patterns are the same problem: cut a 3D surface into pieces that lie flat.',
  },

  intuition: {
    prose: [
      'A UV map lays each piece of a surface flat in the square. A piece can lie flat without tearing only if it is shaped, topologically, like a **disc**: one piece, with one rim and no holes or handles. A closed box is not a disc (it has no rim); a tube is not a disc (two rims). **Seams** are the cuts that turn a surface into discs.',
      'After cutting, the pieces are **charts**. To find them, start at a face and flood outwards, adding every face across an edge that is not a seam: breadth-first search, as in lesson 1.4\'s connected pieces. When the flood stops, that is one chart; start again from a face not yet reached.',
      'The **disc test** uses the Euler characteristic of lesson 1.5, counted on the cut piece: $\\chi = W - E + F$, where $W$ counts wedges (a vertex split by the cut counts once per side) and a seam edge counts once on each side. A disc has $\\chi = 1$ and one rim. Before running cell 1, predict which of these is a disc: a cube cut along all twelve edges (six squares), a cube with no cuts, and a cube cut along **one** edge. The last is a surprise: a single slit opens a closed box into a disc, a very stretched one.',
      'A tidy way to cut a box into one piece is a **net**. Keep a spanning tree of faces joined (every face reachable, no loops) and cut every other edge. A cube has $12$ edges and $6$ faces; a spanning tree of $6$ faces keeps $5$ edges, so $7$ are seams. Before running cell 2, predict the net\'s wedge count: $14$, the corners of the cross shape.',
      'A tube has $\\chi = 0$ and two rims: one cut from rim to rim makes it a disc (the label off a can). A torus has $\\chi = 0$ and no rim: one loop round the tube leaves a tube, and a second loop along the ring opens it into a square. Before running cell 3, predict how many cuts each needs. In general a closed surface with $g$ handles needs $2g$ loops, and then the cut-open piece is one disc.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Charts and the disc test',
        body: 'Step 1. Mark seam edges (and treat open edges as cut).\nStep 2. For each face not yet in a chart: breadth-first search across non-seam edges; the faces reached are one chart.\nStep 3. In each chart, join corners at a vertex across non-seam edges: each group is a wedge (W).\nStep 4. Count E (a non-seam edge once, a seam side once per side) and F; χ = W − E + F.\nStep 5. A disc has χ = 1 and one rim. Otherwise cut again: rim to rim for a tube, a loop for each handle.',
      },
      {
        type: 'warning',
        title: 'A disc is not enough',
        body: 'One slit makes a closed box a disc, but flattening it squeezes most of the surface into a thin crescent. Seams decide topology; where they run decides distortion (lesson 8.5). Good seams are where the surface bends most or where nobody looks.',
      },
      {
        type: 'warning',
        title: 'Seams show',
        body: 'Along a seam the texture jumps from one chart to another, so a painted line or a mip-mapped colour can leave a visible crack. Put seams along creases, hidden sides and natural borders (where a shirt is sewn).',
      },
      {
        type: 'insight',
        title: 'The graphics strand: visible seams',
        body: 'A GPU blends texels near a chart\'s edge with whatever is next to it in the texture, so charts are packed with a gap (lesson 8.6) and their borders padded. The seam\'s wedges (lesson 8.1) are where the mesh is split for the GPU.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "cutting the surface keeps one copy of each vertex". The cross net has 14 corners for the cube\'s 8 vertices: vertex labels repeat along the orange seams, which glue back together in pairs when the net is folded.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'charts() is the procedure: the flood is Step 2, the union-find on corners Step 3, the E count Step 4, the rim count Step 5.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Each chart\'s wedges become separate GPU vertices; the seam edges become pairs of edges with the same positions but different UVs. Nothing in the GPU knows they were one edge.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'UV › Mark seam on selected edges; UV › Seams from sharp edges cuts at creases. UV › Trace the charts (seams → pieces) traces the cut: the seams (predict how many pieces), each chart\'s flood, the disc test and the wedges. In a script: mesh.charts().' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: cutting into charts',
        caption: 'The disc test on a cube three ways, a cross net, a tube and a torus, and the net laid flat.',
        props: {
          lesson: {
            title: 'Seams and charts',
            subtitle: 'Cut until every piece is a disc.',
            cells: [
              { type: 'js', instruction: '### 1. Which cuts make discs?\nPredict first: 12 seams, none, or one.', startCode: CUBE },
              { type: 'js', instruction: '### 2. A net\nPredict first: one disc, and how many wedges?', startCode: NET },
              { type: 'js', instruction: '### 3. A tube and a torus\nPredict first: how many cuts each?', startCode: TUBE },
              { type: 'js', instruction: '### 4. See it\nThe cross net, unfolded.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 320 },
              { type: 'challenge', instruction: '### 5. Challenge: an octahedron\'s net\nThe check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkSeamCount },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Seams and charts" in MeshLab](#/lab/mesh-lab?project=seams-and-charts). A can cut at its rims: the tube fails the disc test. Press Play, predict the number of pieces, then add the missing cut.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Edit mode, edge select, UV › Mark seam;** UV › Seams from sharp edges for creases.\n- **UV › Trace the charts** tests every piece.\n- In a script: `mesh.markSeams([[a, b]])`, `mesh.charts()`.\n- [The "Six squares" challenge](#/lab/mesh-lab?challenge=six-squares): give a box six undistorted pieces.\n- **Elsewhere:** Blender\'s Mark Seam and the UV editor\'s island display; sewing-pattern and sheet-metal unfolding tools.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Discs.** A surface piece is a topological disc when it is connected, has one boundary loop and no handles. For a cut-open piece, $\\chi = W - E + F = 2 - 2g - b$; a disc has $g = 0$, $b = 1$, so $\\chi = 1$.',
      '**Charts.** The faces and the non-seam edges between them form a graph (the dual graph, minus seams). Its connected components are the charts, found by breadth-first search in $O(F)$.',
      '**Nets.** On a closed surface with $\\chi = 2$, keep a spanning tree $T$ of the dual graph: $F - 1$ edges. Cutting the other $E - F + 1 = V - 1$ edges leaves one connected piece; those seams form a tree through every vertex, and the piece is a disc. A torus ($\\chi = 0$) cut this way has $V + 1$ seams forming a graph with one more loop than a tree has; two essential loops are needed to open it.',
      '**Counting wedges after a cut.** A vertex whose surrounding fan is crossed by $k$ seam edges is split into $k$ wedges if it is interior ($k \\ge 2$), or $k + 1$ if it is on an open boundary; a seam that ends at an interior vertex ($k = 1$) does not split it.',
    ],
    equations: [
      { label: 'Disc test', latex: '\\chi = W - E + F = 1, \\quad b = 1' },
      { label: 'Euler with handles and rims', latex: '\\chi = 2 - 2g - b' },
      { label: 'Seams for a net', latex: 'E - (F - 1) = V - 1' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** Let S be a connected closed orientable mesh of genus g, and C a set of seam edges. S cut along C is a single topological disc if and only if C is connected, contains every vertex where the cut must branch, and C\'s graph has exactly 2g independent cycles (a cut graph). For g = 0 that means C is a tree; any spanning tree of the dual graph gives such a C as its complement.',
      '**Invariant viewpoint.** Whether a piece is a disc depends only on its connectivity: bending or stretching the surface changes how distorted the flattening is, never whether it exists.',
      '**Geometric picture.** Cut a paper box along some edges and try to lay it flat. If any face is still folded round to meet another (a tube) or closed in (a lid on all sides), it will not go flat; once every piece is a disc, it always can, with stretching if the faces are not flat to begin with.',
      '**Where this goes.** Lesson 8.3 flattens by projecting, ignoring seams; lesson 8.4 flattens each disc with least distortion of angles; lesson 8.5 measures what the seams cost.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-8-002-ex1',
      title: 'A cube\'s net',
      problem: 'A cube has $V = 8$, $E = 12$, $F = 6$. How many seams does a one-piece net need?',
      steps: [{ expression: 'E - (F - 1) = 12 - 5 = 7', annotation: 'Keep a spanning tree of faces.' }],
      conclusion: '7 seams, forming a tree through all 8 vertices (V − 1 = 7).',
    },
    {
      id: 'modelling-geometry-8-002-ex2',
      title: 'A tube\'s count',
      problem: 'An open tube of 8 quads: $W = 16$, $E = 24$, $F = 8$. Is it a disc?',
      steps: [{ expression: '16 - 24 + 8 = 0', annotation: 'χ = 0, and it has two rims.' }],
      conclusion: 'No: χ = 0. One cut from rim to rim adds 2 wedges and 1 edge: 18 − 25 + 8 = 1.',
    },
    {
      id: 'modelling-geometry-8-002-ex3',
      title: 'A slit box',
      problem: 'Cut a cube along one edge only. Count $W$, $E$, $F$.',
      steps: [{ expression: 'W = 8, \\; E = 13, \\; F = 6', annotation: 'The seam ends at both its vertices, so neither splits; the edge counts once on each side.' }],
      conclusion: 'χ = 8 − 13 + 6 = 1 with one rim: a disc.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-8-002-ch1',
      difficulty: 'easy',
      problem: 'Why does cutting a cube along all twelve edges give six discs?',
      walkthrough: [{ expression: 'W = 4, \\; E = 4, \\; F = 1', annotation: 'Each square on its own.' }],
      answer: 'Every edge is a seam, so no face is joined to another: six charts of one square each, each with χ = 4 − 4 + 1 = 1 and one rim.',
    },
    {
      id: 'modelling-geometry-8-002-ch2',
      difficulty: 'medium',
      problem: 'A torus is cut along one loop round its tube. Why is it still not a disc, and what is it?',
      walkthrough: [
        { expression: '\\chi = 0, \\; b = 2', annotation: 'Cell 3.' },
      ],
      answer: 'The cut opens the ring into a tube: χ stays 0 (the loop adds as many wedges as edges) and now there are two rims. A second loop, along the ring, joins the two rims into one: χ = 1, a disc.',
    },
    {
      id: 'modelling-geometry-8-002-ch3',
      difficulty: 'hard',
      problem: 'Show that the seams of a net on a sphere-like mesh form a tree through every vertex.',
      walkthrough: [
        { expression: 'E - F + 1 = V - 1', annotation: 'Euler: V − E + F = 2.' },
        { expression: '\\text{a connected graph on } V \\text{ vertices with } V - 1 \\text{ edges is a tree}', annotation: 'Graph theory.' },
      ],
      answer: 'There are E − F + 1 = V − 1 seams. They must reach every vertex (otherwise a vertex would be interior to the net with its whole fan joined, and the fan would close up around it on a closed surface, contradicting one rim), and they are connected because the net\'s rim is one loop that traces round them. A connected graph with V vertices and V − 1 edges is a tree.',
    },
  ],

  semantics: {
    core: [
      { symbol: '\\text{seam}', meaning: 'An edge the surface is cut along.' },
      { symbol: '\\text{chart}', meaning: 'A piece left after cutting: faces joined across non-seam edges.' },
      { symbol: 'W', meaning: 'Wedges: vertices counted once per side of a cut.' },
      { symbol: '\\chi = W - E + F', meaning: 'The Euler characteristic of a cut piece.' },
      { symbol: 'b', meaning: 'The number of rims (boundary loops).' },
      { symbol: 'E - F + 1', meaning: 'Seams for one net of a sphere-like surface.' },
    ],
    rulesOfThumb: [
      'Every chart must be a disc.',
      'Tube: one cut rim to rim.',
      'Each handle: two loops.',
      'A net keeps a spanning tree of faces.',
      'Hide seams along creases and backs.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-8-001', label: 'What UVs are', note: 'Wedges: what a cut does to a vertex.' },
      { lessonId: 'modelling-geometry-1-005', label: 'Euler\'s formula', note: 'χ, holes and handles.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-8-003', label: 'Projection', note: 'The quickest flattening, which ignores seams.' },
      { lessonId: 'modelling-geometry-8-004', label: 'Conformal maps and LSCM', note: 'Flattening each disc well.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-8-002-1', label: 'Read why a piece must be a disc to lie flat', type: 'read' },
    { id: 'cp-modelling-geometry-8-002-2', label: 'Read charts by breadth-first search', type: 'read' },
    { id: 'cp-modelling-geometry-8-002-3', label: 'Read the disc test χ = 1 with one rim', type: 'read' },
    { id: 'cp-modelling-geometry-8-002-4', label: 'Run cells 1 to 3: cube cuts, a net, tube and torus', type: 'lab' },
    { id: 'cp-modelling-geometry-8-002-5', label: 'Trace the charts of a can in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-8-002-6', label: 'Work through example 2, a tube\'s count', type: 'example' },
    { id: 'cp-modelling-geometry-8-002-7', label: 'Work through example 3, a slit box', type: 'example' },
    { id: 'cp-modelling-geometry-8-002-8', label: 'Complete the challenge: an octahedron\'s net', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-8-002-assess-1',
        type: 'choice',
        text: 'A closed mesh with V = 10, E = 24, F = 16 (a sphere-like surface). How many seams does a one-piece net need?',
        options: ['9', '8', '16', '24'],
        answer: '9',
        hint: 'E − (F − 1).',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-8-002-quiz-1',
      type: 'choice',
      text: 'A chart is a disc when:',
      options: ['χ = W − E + F = 1 and it has one rim', 'χ = 2', 'It has four sides', 'It has no seams'],
      answer: 'χ = W − E + F = 1 and it has one rim',
      hints: ['Cell 1.', 'Procedure, Step 5.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-8-002-quiz-2',
      type: 'choice',
      text: 'A cube cut along a single edge is:',
      options: ['A disc', 'Still closed', 'Two pieces', 'A tube'],
      answer: 'A disc',
      hints: ['Cell 1.', 'Example 3.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-8-002-quiz-3',
      type: 'choice',
      text: 'How many seams does a one-piece net of a cube need?',
      options: ['7', '5', '6', '12'],
      answer: '7',
      hints: ['Cell 2.', 'E − (F − 1).'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-8-002-quiz-4',
      type: 'choice',
      text: 'An open tube becomes a disc after:',
      options: ['One cut from rim to rim', 'A cut round its middle', 'Two cuts', 'No cut: it already is one'],
      answer: 'One cut from rim to rim',
      hints: ['Cell 3.', 'The can\'s label.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-8-002-quiz-5',
      type: 'choice',
      text: 'A torus needs how many seam loops to open into one disc?',
      options: ['2', '1', '0', '4'],
      answer: '2',
      hints: ['Cell 3.', '2g with g = 1.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-8-002-quiz-6',
      type: 'choice',
      text: 'How are charts found from the seams?',
      options: ['Breadth-first search over faces across non-seam edges', 'By sorting the faces', 'By projecting from above', 'One chart per face'],
      answer: 'Breadth-first search over faces across non-seam edges',
      hints: ['Procedure, Step 2.', 'Lesson 1.4.'],
      reviewSection: 'Procedure',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'Any cut makes a surface flatten nicely.',
      whyStudentsThinkIt: 'Once it is a disc, LSCM can flatten it.',
      correctionExample: 'Cell 1: one slit makes a box a disc, but laying it flat would crush five faces round one edge.',
      contrastCase: 'The cross net (cell 2) is also a disc, and lies flat with no distortion at all.',
    },
    {
      falseBelief: 'Cutting leaves one copy of each vertex.',
      whyStudentsThinkIt: 'The model itself is unchanged.',
      correctionExample: 'The picture: 14 corners in the flat net for 8 vertices.',
      contrastCase: 'A seam that ends at a vertex does not split it (the slit\'s two ends).',
    },
    {
      falseBelief: 'A ring-shaped object can be opened with one cut, like a can.',
      whyStudentsThinkIt: 'A tube needs one cut.',
      correctionExample: 'Cell 3: a torus cut once is a tube, χ = 0 with two rims; it needs a second loop.',
      contrastCase: 'A tube (an open cylinder) does need only one.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A character\'s arm (a tube closed at the hand) must be unwrapped with one seam that nobody sees.',
      competingTechniques: ['A seam round the wrist', 'A seam along the inside of the arm, from armpit to wrist'],
      whyThisTechniqueWins: 'The arm, cut off at the shoulder, is a tube with one closed end: a seam from rim to tip along the hidden inside makes it a disc. A ring round the wrist only splits it into two pieces, neither a disc.',
    },
    {
      situation: 'A packaging designer needs a box that folds from one sheet.',
      competingTechniques: ['Six separate panels', 'A net: a spanning tree of panels'],
      whyThisTechniqueWins: 'A spanning tree keeps the panels joined along F − 1 folds and cuts E − F + 1 edges: one piece, no glue except along the cuts.',
    },
  ],

  debugging: [
    {
      commonError: 'Unwrapping a closed mesh with no seams.',
      symptom: 'An error, or everything collapsed to a point.',
      whyItHappened: 'A closed surface (χ = 2, no rim) is not a disc.',
      repairStrategy: 'Mark seams first, or use Seams from sharp edges; check with Trace the charts.',
    },
    {
      commonError: 'Cutting a tube round its middle instead of along it.',
      symptom: 'Two tubes, both failing the disc test; overlapping UVs.',
      whyItHappened: 'A ring cut splits the tube but leaves each piece with two rims.',
      repairStrategy: 'Cut from rim to rim.',
    },
    {
      commonError: 'Counting vertices instead of wedges in χ.',
      symptom: 'Every cut piece seems to have χ too small.',
      whyItHappened: 'A vertex split by a seam is in the piece twice.',
      repairStrategy: 'Count wedges: corners joined round the vertex without crossing a seam.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Find a mesh\'s charts from its seams and test each for being a disc.',
    explainVerbally: 'Explain why pieces must be discs and how many cuts a tube, a box and a torus need.',
    detectIncorrectApplication: 'Recognise closed charts, tubes cut the wrong way and vertex-for-wedge miscounts.',
    transferToUnfamiliar: 'Place seams for characters, packaging and patterns.',
  },
};
