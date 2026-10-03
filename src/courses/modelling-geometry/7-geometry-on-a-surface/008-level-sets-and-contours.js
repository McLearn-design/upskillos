// Lesson 7.8: level sets and contours. The set where a per-vertex field equals a value L is a curve on the surface.
// The field is linear across each triangle, so inside a triangle the curve is a straight segment between the two
// edges whose ends lie on opposite sides of L, found by linear interpolation. Segments sharing an edge join into
// closed loops or open chains. Quads are ambiguous (a saddle can be joined two ways); triangles never are.

const BASE = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const lerp = (p, q, t) => p.map((x, i) => x + t * (q[i] - x))
`;

const EDGE = `${BASE}
// One edge: the field is 0.2 at p = (0, 0) and 1.0 at q = (2, 0), linear in between. Where is it 0.5?
// Predict first: the middle of the edge, or somewhere else?
const p = [0, 0], q = [2, 0], a = 0.2, b = 1.0, L = 0.5
const t = (L - a) / (b - a)                       // the fraction of the way from p to q
console.log('t = ' + r(t) + ', the point ' + lerp(p, q, t).map(r).join(', '))
console.log('check: the field there is ' + r(a + t * (b - a)))`;

const CASES = `${BASE}
// One triangle: each corner is either at or above the level (1) or below it (0). That is 2³ = 8 cases.
// An edge is crossed when its two ends disagree. Predict first: can a triangle have exactly one crossed edge? Three?
const count = {}
for (let c = 0; c < 8; c++) {
  const up = [c & 1, (c >> 1) & 1, (c >> 2) & 1]
  const crossed = [[0, 1], [1, 2], [2, 0]].filter(([i, j]) => up[i] !== up[j]).length
  count[crossed] = (count[crossed] || 0) + 1
  console.log('corners ' + up.join('') + ': ' + crossed + ' edges crossed')
}
console.log('cases by crossed edges: ' + JSON.stringify(count))`;

const MESH = `${BASE}
// A whole mesh: a grid over [−3, 3]² pushed up into two hills, each square cut into two triangles.
const N = 36, V = [], T = [], id = (i, j) => i * (N + 1) + j
for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
  const x = -3 + 6 * i / N, z = -3 + 6 * j / N
  V.push([x, 1.2 * Math.exp(-((x + 1.2) ** 2 + z ** 2) / 0.8) + 0.8 * Math.exp(-((x - 1.3) ** 2 + z ** 2) / 0.6), z])
}
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) T.push([id(i, j), id(i, j + 1), id(i + 1, j + 1)], [id(i, j), id(i + 1, j + 1), id(i + 1, j)])
// The contour at level L: one segment per crossed triangle, each end keyed by the edge it lies on.
function contour(values, L) {
  const segs = [], at = new Map(), key = (i, j) => (i < j ? i + ',' + j : j + ',' + i)
  for (const t of T) {
    const cut = [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]].filter(([i, j]) => (values[i] >= L) !== (values[j] >= L))
    if (cut.length !== 2) continue
    const ends = cut.map(([i, j]) => { const k = key(i, j); at.set(k, lerp(V[i], V[j], (L - values[i]) / (values[j] - values[i]))); return k })
    segs.push(ends)
  }
  // Join: walk from segment to segment through shared edge points. Start open chains at their ends first.
  const by = new Map(); segs.forEach((s, n) => s.forEach((k) => by.set(k, [...(by.get(k) || []), n])))
  const used = new Set(), walk = (n, k) => { for (;;) { used.add(n); const next = segs[n][0] === k ? segs[n][1] : segs[n][0]; const m = (by.get(next) || []).find((x) => !used.has(x)); if (m === undefined) return; n = m; k = next } }
  let open = 0, loops = 0
  for (const [k, l] of by) if (l.length === 1 && !used.has(l[0])) { walk(l[0], k); open++ }
  segs.forEach((s, n) => { if (!used.has(n)) { walk(n, s[0]); loops++ } })
  const length = segs.reduce((sum, [p, q]) => sum + Math.hypot(...at.get(p).map((x, i) => x - at.get(q)[i])), 0)
  return { segs: segs.map(([p, q]) => [at.get(p), at.get(q)]), loops, open, length }
}
`;

const LEVELS = `${MESH}
// Predict first: at height 0.2 and at 0.5, how many separate loops?
const y = V.map((p) => p[1])
for (const L of [0.01, 0.2, 0.5, 0.9, 1.3]) {
  const c = contour(y, L)
  console.log('height ' + L + ': ' + c.segs.length + ' segments, ' + c.loops + ' loops, ' + c.open + ' open, length ' + r(c.length))
}`;

const SADDLE = `${BASE}
// A quad whose corners alternate: high, low, high, low (going round). The level 0.5 crosses all four sides.
// Which crossing joins which? It depends on the diagonal the quad is cut along. Predict first: do the two high
// corners end up connected (one region) or separated?
const corners = ['A (high)', 'B (low)', 'C (high)', 'D (low)'], v = [1, 0, 1, 0]
for (const [name, tris] of [['diagonal A–C', [[0, 1, 2], [0, 2, 3]]], ['diagonal B–D', [[0, 1, 3], [1, 2, 3]]]]) {
  const pieces = tris.map((t) => [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]].filter(([i, j]) => (v[i] >= 0.5) !== (v[j] >= 0.5)).map(([i, j]) => corners[i][0] + corners[j][0]).join(' to '))
  const highJoined = tris.some((t) => t.includes(0) && t.includes(2))
  console.log(name + ': segments ' + pieces.join('; ') + '. The high corners are ' + (highJoined ? 'joined' : 'separated'))
}`;

const PICTURE = `${MESH}
// A contour map: the two hills seen from above, with lines every 0.1 in height, coloured from low (blue) to high (red).
const canvas = document.createElement('canvas'), W = 380, H = 300
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'); g.scale(2, 2); g.fillStyle = '#0f1923'; g.fillRect(0, 0, W, H)
const sx = (x) => W / 2 + x * 45, sz = (z) => H / 2 - z * 45
const y = V.map((p) => p[1]), counts = []
for (let k = 1; k <= 12; k++) {
  const L = k / 10, c = contour(y, L), f = (k - 1) / 11
  g.strokeStyle = 'rgb(' + Math.round(60 + 195 * f) + ',' + Math.round(140 - 60 * Math.abs(f - 0.5)) + ',' + Math.round(255 - 215 * f) + ')'
  g.lineWidth = k % 5 === 0 ? 2 : 1
  g.beginPath(); for (const [p, q] of c.segs) { g.moveTo(sx(p[0]), sz(p[2])); g.lineTo(sx(q[0]), sz(q[2])) } g.stroke()
  counts.push(c.loops)
}
g.fillStyle = '#cbd5e1'; g.font = '12px sans-serif'; g.fillText('lines every 0.1; heavier at 0.5 and 1.0', 10, H - 10)
console.log('loops at heights 0.1 … 1.2: ' + counts.join(' '))`;

const CHALLENGE = `// A triangle: A = (0, 0) with value 0.2, B = (2, 0) with value 1.0, C = (0, 2) with value 0.6.
// The contour at level 0.5 crosses it in one straight segment. How long is that segment?
const length = 0
console.log(length)`;

const SOLVED = CHALLENGE.replace('const length = 0', 'const length = Math.hypot(0.75, 1.5)');

/** The challenge's check: AB at t = 0.375 → (0.75, 0); AC at t = 0.75 → (0, 1.5); BC is not crossed. Length 1.6771. */
export function checkContourSegment(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+length\s*=\s*([^\n]+)/);
  if (!m) return no('Keep the line const length = …, with a number or an expression.');
  // Only arithmetic and a few Math functions are evaluated: this runs in the page, not the cell's sandbox.
  const expr = m[1].replace(/\/\/.*$/, '').trim().replace(/;$/, '');
  if (!/^[\d.,\s+\-*/()]*$/.test(expr.replace(/Math\.(sqrt|hypot|pow)|\*\*/g, ''))) return no('Write the length as a number, or arithmetic with Math.sqrt, Math.hypot and **.');
  let v;
  try { v = Number(new Function('return (' + expr + ')')()); } catch { return no('That expression did not run.'); }
  if (!Number.isFinite(v)) return no('The length must be a number.');
  const near = (x) => Math.abs(v - x) < 1e-3;
  if (near(Math.hypot(0.75, 1.5))) return { pass: true, message: `${+v.toFixed(4)}: AB is crossed at t = (0.5 − 0.2)/0.8 = 0.375, the point (0.75, 0); AC at t = (0.5 − 0.2)/0.4 = 0.75, the point (0, 1.5); BC has both ends above 0.5, so it is not crossed. The segment is √(0.75² + 1.5²) = 1.6771.` };
  if (v === 0) return no('Find the two edges whose ends are on opposite sides of 0.5, then where along each the value is 0.5.');
  if (near(Math.SQRT2)) return no('√2 joins the midpoints of AB and AC. The crossing is where the value is 0.5, which is not the middle unless 0.5 is halfway between the ends.');
  if (near(Math.hypot(1.25, 0.5))) return no('t measures from the first end: t = (L − a)/(b − a) is the fraction of the way from A, where the value is a = 0.2.');
  if (near(Math.hypot(0.75, 0.5)) || near(Math.hypot(1.25, 1.5))) return no('One of your crossings is measured from the wrong end: t is the fraction of the way from A, the end whose value is a.');
  return no(`${+v.toFixed(4)} is not the distance between the two crossings. Which edges have one end below 0.5 and one above?`);
}

export default {
  id: 'modelling-geometry-7-008',
  slug: 'level-sets-and-contours',
  chapter: 'modelling-geometry',
  order: 8,
  title: 'Level sets and contours',
  subtitle: 'Where a field equals one value: a line found triangle by triangle, like the contour lines on a map.',
  tags: ['level sets', 'contours', 'iso-lines', 'marching triangles', 'marching squares', 'linear interpolation', 'thresholds'],
  coreConcept: 'A level set of a per-vertex field f is the set of points where f = L. The field is linear across each triangle, so inside a triangle the level set is a straight segment. Classify each corner as at-or-above L or below; an edge whose ends disagree is crossed at t = (L − a)/(b − a) of the way along. Every triangle has zero or two crossed edges, never one or three, so the segments join through shared edges into closed loops, or open chains that end on the boundary. Quads with alternating corners are ambiguous; triangles are not, but the diagonal chosen decides how a saddle connects.',
  prerequisites: ['modelling-geometry-7-001', 'modelling-geometry-7-006'],
  timeToComplete: 35,
  nextLesson: 'modelling-geometry-8-001',

  hook: {
    question: 'A hiking map draws a line through every point at 500 m. A heat map of distance draws rings at equal distance. A part inspection flags everything more than 0.002 inches out. All three are the same question: where does a field cross a value? How does a computer find that line on a mesh?',
    realWorldContext: 'Contour lines are used for terrain maps, for showing distance and curvature fields, for cutting slices for 3D printing (the level sets of height), for isosurface extraction in medical scans (marching cubes, the 3D version), and as the boundary of every threshold decision on a surface.',
  },

  intuition: {
    prose: [
      'Every heat map in this chapter can be drawn with **contour lines**: the points where the field equals one value $L$, a **level set**. Pick several evenly spaced $L$ and you get a map\'s contour lines; on a distance field, rings at equal distance (lesson 7.6).',
      'Start with one edge. The field is $a$ at one end and $b$ at the other, linear in between, so it equals $L$ at $t = (L - a)/(b - a)$ of the way along. Before running cell 1, predict whether $0.5$ is halfway along an edge going from $0.2$ to $1.0$. It is at $t = 0.375$: closer to the low end, because $0.5$ is only $0.3$ above $0.2$ out of the $0.8$ the edge climbs.',
      'Now one triangle. Each corner is either at or above $L$, or below it. An edge is crossed when its ends disagree. Before running cell 2, predict: can exactly one edge be crossed? No. Going round the triangle you change sides an even number of times, so it is $0$ or $2$. Two crossings make one straight segment, because the field is linear across the triangle.',
      'Then the mesh. Neighbouring triangles share an edge, so they share its crossing point: the segments join end to end. A chain that comes back to its start is a **closed loop**; one that runs into the mesh\'s boundary is an **open chain**. Before running cell 3, predict how many loops there are around two hills at height $0.2$ and at $0.5$. At $0.2$ one loop rings both hills; at $0.5$ they have separated into two.',
      'Quads are where it gets subtle. If a quad\'s corners go high, low, high, low, the level crosses all four sides, and there are two ways to pair the crossings: the two highs joined, or separated. This is the **ambiguous case** of marching squares. Cutting the quad into triangles settles it, and cell 4 shows that the diagonal chosen decides the answer.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Contour extraction (marching triangles)',
        body: 'Step 1. Mark each vertex: at or above L, or below.\nStep 2. For each triangle with corners on both sides: find its two crossed edges; on each, t = (L − a)/(b − a) and the point p + t(q − p).\nStep 3. Store each crossing by its edge, so the two triangles on that edge share it.\nStep 4. Join segments through shared crossings: start at ends (points used once) for open chains, then the rest are closed loops.\nStep 5. For several levels, repeat; evenly spaced L give evenly spaced lines where the field changes evenly.',
      },
      {
        type: 'warning',
        title: 'A vertex exactly on the level',
        body: 'If a vertex\'s value equals L exactly, "above" and "below" must still be decided one way: treat it as at-or-above. Otherwise an edge could be crossed at both ends, or a triangle could get three crossings.',
      },
      {
        type: 'warning',
        title: 'Quads are ambiguous',
        body: 'Four crossings on one quad can be joined two ways. Triangulating first (or sampling the centre) chooses one. Different diagonals can give different loop counts near a saddle: neither is wrong, but be consistent.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: contour lines',
        body: 'Drawn over a heat map, contour lines show what colour cannot: evenly spaced lines mean the field changes evenly; bunched lines mean steep change. They are how lesson 7.6\'s distance and lesson 7.3\'s curvature are best checked by eye.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "a level set is one closed curve". Seen from above, the two hills give one loop round both near the ground, two loops higher up, and one loop near the top of the taller hill.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 't = (L − a)/(b − a) is lerp\'s fraction; contour() is the procedure: the cut filter is Step 2, the key map Step 3, the walk Step 4.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Contour lines are often drawn without extracting them at all: a fragment shader takes the interpolated value, and darkens pixels where fract(value / spacing) is near 0. Extracting them as segments, as here, is what you need to measure, export or cut along them.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Every heat map can show iso-lines (Heat map › Show iso-lines). Heat map › Trace the iso-line traces one level, the middle of the colour range: the classification, one triangle (predict t), every crossed triangle, and the joined loops. In a script: mesh.isoLine(values, level).' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: contour lines',
        caption: 'One edge, one triangle\'s eight cases, the contours of two hills, the saddle ambiguity, and a contour map.',
        props: {
          lesson: {
            title: 'Level sets and contours',
            subtitle: 'Marching triangles.',
            cells: [
              { type: 'js', instruction: '### 1. One edge\nPredict first: where is 0.5 along an edge from 0.2 to 1.0?', startCode: EDGE },
              { type: 'js', instruction: '### 2. One triangle\nPredict first: can one edge be crossed alone?', startCode: CASES },
              { type: 'js', instruction: '### 3. A whole mesh\nPredict first: how many loops at 0.2 and at 0.5?', startCode: LEVELS },
              { type: 'js', instruction: '### 4. The saddle\nPredict first: are the two high corners joined?', startCode: SADDLE },
              { type: 'js', instruction: '### 5. See it\nA contour map of the two hills, from above.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 320 },
              { type: 'challenge', instruction: '### 6. Challenge: one segment\nThe check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkContourSegment },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Level sets and contours" in MeshLab](#/lab/mesh-lab?project=level-sets). Two hills with contour lines; one level is traced: press Play, and predict how far along an edge the line crosses.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Any heat map, then Heat map › Trace the iso-line.** Try it on mean curvature, where the level 0 separates domes from saddles.\n- In a script: `mesh.isoLine(values, level)` returns the loops, open chains and length.\n- **Thresholds:** a contour at L is the edge of the region a threshold at L flags. [The Mesh Engine Lab\'s "threshold decides" project](#/lab/mesh-engine-lab?project=threshold-decides) and its [flag-the-bump challenge](#/lab/mesh-engine-lab?challenge=flag-the-bump) make that decision on a part.\n- **Elsewhere:** matplotlib\'s contour, libigl\'s isolines, marching cubes for volumes.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Level set.** For $f$ on a surface and a value $L$, the level set is $\\{x : f(x) = L\\}$. Where $\\nabla f \\ne 0$ it is a smooth curve, perpendicular to $\\nabla f$; where $\\nabla f = 0$ (a peak, pit or saddle) it can shrink to a point or cross itself.',
      '**Piecewise-linear fields.** A per-vertex field is extended linearly across each triangle: $f = \\alpha f_a + \\beta f_b + \\gamma f_c$ in barycentric coordinates. A linear function\'s level set in a triangle is a straight segment (or empty), and on an edge $f$ equals $L$ at $t = (L - a)/(b - a)$.',
      '**Why two crossings.** Going round the triangle\'s three corners and back, the sign of $f - L$ changes an even number of times, so $0$ or $2$ edges are crossed. Each interior edge is shared by two triangles, so each crossing point is shared by two segments: the pieces form closed curves, or curves ending on the boundary.',
      '**Spacing.** Levels $L_k = L_0 + k\\,\\Delta$ are a distance about $\\Delta / |\\nabla f|$ apart on the surface. For a distance field, $|\\nabla f| = 1$, so the rings are exactly $\\Delta$ apart: a check of lesson 7.6.',
    ],
    equations: [
      { label: 'Crossing', latex: 't = \\frac{L - a}{b - a}' },
      { label: 'Point', latex: 'p + t\\,(q - p)' },
      { label: 'Linear in a triangle', latex: 'f = \\alpha f_a + \\beta f_b + \\gamma f_c' },
      { label: 'Line spacing', latex: '\\text{gap} \\approx \\frac{\\Delta}{|\\nabla f|}' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** For a piecewise-linear f on a triangle mesh and a level L that equals no vertex value, the level set is a disjoint union of simple polygonal curves, each closed or with both ends on the boundary. Ties (a vertex equal to L) are broken by a consistent rule, such as treating it as above.',
      '**Invariant viewpoint.** The level set depends only on the field\'s values and the mesh\'s connectivity, not on where the vertices are: moving the mesh moves the curves with it.',
      '**Geometric picture.** Flood a landscape to height L: the shoreline is the level set. As the water rises, lakes join (a saddle) and islands disappear (a peak): the loop count changes only at critical points.',
      '**Where this goes.** Chapter 8 cuts UV seams along chosen loops; chapter 11\'s bone weights are often checked by their 0.5 contour; in 3D, marching cubes does the same per cube to extract surfaces from medical and simulation volumes.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-7-008-ex1',
      title: 'Where on the edge',
      problem: 'An edge runs from value $3$ to value $7$. Where is it $4$?',
      steps: [{ expression: 't = (4 - 3)/(7 - 3) = 0.25', annotation: 'A quarter of the way from the 3 end.' }],
      conclusion: 't = 0.25.',
    },
    {
      id: 'modelling-geometry-7-008-ex2',
      title: 'Which edges',
      problem: 'A triangle has values $0.1, 0.9, 0.4$ at $A, B, C$. Which edges does the level $0.5$ cross?',
      steps: [{ expression: 'A, C < 0.5 \\le B', annotation: 'B is alone on its side.' }],
      conclusion: 'AB and BC: the two edges at the lonely corner.',
    },
    {
      id: 'modelling-geometry-7-008-ex3',
      title: 'Ring spacing',
      problem: 'A distance field (gradient length 1) is drawn with lines every $0.2$. How far apart are the rings on the surface?',
      steps: [{ expression: '\\Delta / |\\nabla f| = 0.2 / 1', annotation: 'Line spacing.' }],
      conclusion: '0.2 apart, everywhere.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-7-008-ch1',
      difficulty: 'easy',
      problem: 'Why can a triangle not have exactly one crossed edge?',
      walkthrough: [{ expression: '\\text{round the triangle, the side changes an even number of times}', annotation: 'Start and end at the same corner.' }],
      answer: 'Walking A → B → C → A returns to where it started, so it must change sides an even number of times: 0 or 2 crossed edges.',
    },
    {
      id: 'modelling-geometry-7-008-ch2',
      difficulty: 'medium',
      problem: 'As the level rises past the top of the lower hill, what happens to the number of loops, and why?',
      walkthrough: [
        { expression: '\\text{2 loops} \\to \\text{1 loop}', annotation: 'The lower hill\'s loop shrinks to its peak and vanishes.' },
      ],
      answer: 'The loop round the lower hill shrinks to a point at its peak and disappears; only the taller hill\'s loop remains. Loop counts change only at peaks, pits and saddles, where the gradient is zero.',
    },
    {
      id: 'modelling-geometry-7-008-ch3',
      difficulty: 'hard',
      problem: 'On a distance field from a point on a flat sheet, contour lines every Δ are circles. Explain from the line-spacing formula why they are evenly spaced, and what it means if the extracted rings bunch up on one side.',
      walkthrough: [
        { expression: '|\\nabla d| = 1', annotation: 'A true distance changes at unit rate.' },
        { expression: '\\text{gap} = \\Delta / |\\nabla d| = \\Delta', annotation: 'Even spacing.' },
      ],
      answer: 'A distance function has gradient length 1 everywhere, so rings are exactly Δ apart. Bunching means |∇d| is larger than 1 there: the computed distance is wrong on that side (a too-large heat time, a poor mesh, or edge-path distance).',
    },
  ],

  semantics: {
    core: [
      { symbol: 'L', meaning: 'The level: the value the contour follows.' },
      { symbol: '\\{x : f(x) = L\\}', meaning: 'The level set.' },
      { symbol: 't = (L - a)/(b - a)', meaning: 'Where along an edge the field equals L.' },
      { symbol: '\\text{loop}', meaning: 'A chain of segments that closes on itself.' },
      { symbol: '\\text{open chain}', meaning: 'A chain that ends on the mesh\'s boundary.' },
      { symbol: '\\Delta / |\\nabla f|', meaning: 'The gap between lines Δ apart in value.' },
    ],
    rulesOfThumb: [
      'Two crossings per triangle, or none.',
      't measures from the end with value a.',
      'At-or-above breaks ties.',
      'Quads can be ambiguous; triangles are not.',
      'Bunched lines mean a steep field.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-7-001', label: 'Fields on a mesh and colour maps', note: 'The per-vertex field and its linear interpolation.' },
      { lessonId: 'modelling-geometry-7-006', label: 'Distance on a surface', note: 'A field whose contours should be evenly spaced.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-8-001', label: 'Chapter 8: UVs', note: 'Seams are cut along chosen loops.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-7-008-1', label: 'Read the crossing formula t = (L − a)/(b − a)', type: 'read' },
    { id: 'cp-modelling-geometry-7-008-2', label: 'Read why a triangle has zero or two crossings', type: 'read' },
    { id: 'cp-modelling-geometry-7-008-3', label: 'Read the saddle ambiguity', type: 'read' },
    { id: 'cp-modelling-geometry-7-008-4', label: 'Run cells 1 to 4: edge, cases, mesh, saddle', type: 'lab' },
    { id: 'cp-modelling-geometry-7-008-5', label: 'Trace an iso-line in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-7-008-6', label: 'Work through example 1, where on the edge', type: 'example' },
    { id: 'cp-modelling-geometry-7-008-7', label: 'Work through example 2, which edges', type: 'example' },
    { id: 'cp-modelling-geometry-7-008-8', label: 'Complete the challenge: one segment', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-7-008-assess-1',
        type: 'choice',
        text: 'An edge goes from value 2 to value 6. The level 5 crosses it at t =',
        options: ['0.75', '0.5', '0.25', '0.8'],
        answer: '0.75',
        hint: '(L − a)/(b − a).',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-7-008-quiz-1',
      type: 'choice',
      text: 'Where along an edge from 0.2 to 1.0 is the value 0.5?',
      options: ['t = 0.375', 't = 0.5', 't = 0.625', 't = 0.3'],
      answer: 't = 0.375',
      hints: ['Cell 1.', '(0.5 − 0.2)/0.8.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-7-008-quiz-2',
      type: 'choice',
      text: 'How many edges of a triangle can a level cross?',
      options: ['0 or 2', '0, 1, 2 or 3', '1 or 3', 'Always 2'],
      answer: '0 or 2',
      hints: ['Cell 2.', 'Challenge 1.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-7-008-quiz-3',
      type: 'choice',
      text: 'A contour chain that runs into the edge of an open mesh is:',
      options: ['An open chain', 'A closed loop', 'An error', 'Impossible'],
      answer: 'An open chain',
      hints: ['Cell 3, height 0.01.', 'Procedure, Step 4.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-7-008-quiz-4',
      type: 'choice',
      text: 'In the two-hills mesh, how many loops does the contour at 0.5 have?',
      options: ['2', '1', '0', '3'],
      answer: '2',
      hints: ['Cell 3.', 'One round each hill.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-7-008-quiz-5',
      type: 'choice',
      text: 'What decides how a saddle quad\'s four crossings are joined, once the quad is triangulated?',
      options: ['The diagonal it is cut along', 'The level', 'The colour map', 'Nothing: it is always the same'],
      answer: 'The diagonal it is cut along',
      hints: ['Cell 4.', 'Warning "Quads are ambiguous".'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-7-008-quiz-6',
      type: 'choice',
      text: 'Contour lines bunch together where:',
      options: ['The field changes steeply', 'The field is flat', 'The mesh is fine', 'The level is high'],
      answer: 'The field changes steeply',
      hints: ['gap ≈ Δ/|∇f|.', 'Math, Spacing.'],
      reviewSection: 'Math',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'The crossing is at the middle of the edge.',
      whyStudentsThinkIt: 'Midpoints are the simple choice, and look fine when the level is halfway.',
      correctionExample: 'Cell 1: 0.5 between 0.2 and 1.0 is at t = 0.375.',
      contrastCase: 'When L is exactly halfway between a and b, t = 0.5.',
    },
    {
      falseBelief: 'A level set is one closed curve.',
      whyStudentsThinkIt: 'Simple examples, like height on a sphere, give one.',
      correctionExample: 'Cell 3 and the picture: 0, 1 or 2 loops, and open chains at the boundary.',
      contrastCase: 'On a closed surface with a field having one maximum and one minimum, each level between them is one loop.',
    },
    {
      falseBelief: 'Contouring a quad mesh has one right answer.',
      whyStudentsThinkIt: 'The field values are given.',
      correctionExample: 'Cell 4: the same four values give joined or separated regions depending on the diagonal.',
      contrastCase: 'On triangles the answer is unique.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A part inspection must outline every region more than 0.002 inches out of tolerance, and report each region\'s perimeter.',
      competingTechniques: ['Colour the flagged vertices', 'Extract the contour at 0.002 and measure its loops'],
      whyThisTechniqueWins: 'The contour is the region\'s exact boundary, with sub-triangle precision; its loops count and measure the regions.',
    },
    {
      situation: 'A 3D printer slicer needs each layer\'s outline.',
      competingTechniques: ['Render the model from above', 'The level sets of height, one per layer'],
      whyThisTechniqueWins: 'Each layer is a level set of the height field, extracted as closed loops that the printer can follow.',
    },
  ],

  debugging: [
    {
      commonError: 'Computing t from the wrong end.',
      symptom: 'Lines jagged, crossing points mirrored along edges.',
      whyItHappened: 'Used (L − b)/(a − b) with p as the start, or the reverse.',
      repairStrategy: 'Keep t and the start point together: t from p, where the value is a.',
    },
    {
      commonError: 'Testing "above" with > at one place and ≥ at another.',
      symptom: 'Gaps or extra segments where a vertex sits exactly on the level.',
      whyItHappened: 'Ties broken inconsistently.',
      repairStrategy: 'Use one rule, values[i] >= L, everywhere.',
    },
    {
      commonError: 'Computing each crossing separately in each triangle.',
      symptom: 'Loops do not join, or tiny gaps from rounding.',
      whyItHappened: 'Shared crossings were not shared.',
      repairStrategy: 'Key each crossing by its edge, so neighbouring triangles use the same point.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Extract a level set from a triangle mesh and count its loops.',
    explainVerbally: 'Explain why each triangle has zero or two crossings and how segments join.',
    detectIncorrectApplication: 'Recognise wrong-end interpolation, inconsistent ties and unshared crossings.',
    transferToUnfamiliar: 'Use contours for maps, thresholds, slicing and checking fields.',
  },
};
