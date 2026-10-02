// Lesson 6.4: keeping edges sharp. Subdivision averages, so a sharp edge with nothing near it melts. A support loop,
// an extra ring of edges a small distance w from the edge, gives the averages something close to hold: the closer the
// loop, the tighter the edge and the more volume is kept, at the cost of more faces.
import { withPicture } from '../notebookScene.js';

const CC = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const add = (a, b) => a.map((x, i) => x + b[i]), mul = (a, s) => a.map((x) => x * s)
const avg = (ps) => mul(ps.reduce(add), 1 / ps.length)
const key = (a, b) => a < b ? a + '-' + b : b + '-' + a
function catmullClark(V, F) {
  const facePts = F.map((f) => avg(f.map((v) => V[v])))
  const edges = new Map()
  F.forEach((f, fi) => f.forEach((a, i) => { const b = f[(i + 1) % f.length], k = key(a, b); if (!edges.has(k)) edges.set(k, { a, b, faces: [] }); edges.get(k).faces.push(fi) }))
  const edgeIndex = new Map(), edgePts = []
  for (const [k, e] of edges) { edgeIndex.set(k, edgePts.length); edgePts.push(avg([V[e.a], V[e.b], ...e.faces.map((fi) => facePts[fi])])) }
  const vf = V.map(() => []), ve = V.map(() => [])
  F.forEach((f, fi) => f.forEach((v) => vf[v].push(fi)))
  for (const e of edges.values()) { ve[e.a].push(e); ve[e.b].push(e) }
  const moved = V.map((P, v) => { const n = ve[v].length; return mul(add(add(avg(vf[v].map((fi) => facePts[fi])), mul(avg(ve[v].map((e) => avg([V[e.a], V[e.b]]))), 2)), mul(P, n - 3)), 1 / n) })
  const nv = V.length, nf = F.length, quads = []
  F.forEach((f, fi) => f.forEach((v, i) => { const prev = f[(i + f.length - 1) % f.length], next = f[(i + 1) % f.length]; quads.push([v, nv + nf + edgeIndex.get(key(v, next)), nv + fi, nv + nf + edgeIndex.get(key(prev, v))]) }))
  return { V: [...moved, ...facePts, ...edgePts], F: quads }
}
// A cube 1.4 wide, like the support-loops project in MeshLab.
const h = 0.7
const cubeV = [[-h, -h, -h], [h, -h, -h], [h, h, -h], [-h, h, -h], [-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]]
const cubeF = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [0, 4, 7, 3], [1, 2, 6, 5]]
// Support loops: inset every face by w (lesson 5.2). On a square face the inner corner moves along the diagonal so
// that it is w from both edges: the fraction 2w / side of the way to the centre.
function supportLoops(V, F, w) {
  V = V.map((p) => [...p]); const out = []
  for (const f of F) {
    const c = avg(f.map((v) => V[v])), side = Math.hypot(...V[f[1]].map((x, i) => x - V[f[0]][i])), t = 2 * w / side
    const inner = f.map((v) => { V.push(add(V[v], mul(add(c, mul(V[v], -1)), t))); return V.length - 1 })
    out.push(inner)
    f.forEach((v, i) => { const j = (i + 1) % 4; out.push([v, f[j], inner[j], inner[i]]) })
  }
  return { V, F: out }
}
// The volume inside a closed mesh, from its triangles (the divergence theorem: Σ a · (b × c) / 6).
const volume = ({ V, F }) => F.reduce((s, f) => { for (let i = 1; i + 1 < f.length; i++) { const [a, b, c] = [V[f[0]], V[f[i]], V[f[i + 1]]]; s += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6 } return s }, 0)
const subdivided = (m, levels) => { for (let l = 0; l < levels; l++) m = catmullClark(m.V, m.F); return m }
`;

const CURVE = `// First on a curve (lesson 6.1's cubic rule): a square ±2, and the same square with a support point a distance d
// from each corner along each edge. How close does the smooth curve come to the corner (2, 2)?
const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
function cubic(poly) {
  const n = poly.length, out = []
  poly.forEach((p, i) => { const a = poly[(i + n - 1) % n], b = poly[(i + 1) % n]; out.push([(a[0] + 6 * p[0] + b[0]) / 8, (a[1] + 6 * p[1] + b[1]) / 8], [(p[0] + b[0]) / 2, (p[1] + b[1]) / 2]) })
  return out
}
const corners = [[-2, -2], [2, -2], [2, 2], [-2, 2]]
function withSupport(d) {
  const out = []
  corners.forEach((c, i) => {
    const prev = corners[(i + 3) % 4], next = corners[(i + 1) % 4]
    const toward = (p, q, t) => [p[0] + (q[0] - p[0]) * t / 4, p[1] + (q[1] - p[1]) * t / 4]
    out.push(toward(c, prev, d), c, toward(c, next, d))
  })
  return out
}
// Predict first: without support, the curve stays far from the corner. With d = 0.1?
for (const d of [null, 1, 0.5, 0.25, 0.1]) {
  let poly = d === null ? corners : withSupport(d)
  for (let k = 0; k < 7; k++) poly = cubic(poly)
  const gap = Math.min(...poly.map((p) => Math.hypot(p[0] - 2, p[1] - 2)))
  console.log((d === null ? 'no support:   ' : 'support d = ' + d + ': ') + 'the curve comes within ' + r(gap) + ' of the corner')
}`;

const VOLUME = `${CC}
// The cube with no support and with support loops at several widths, each subdivided twice.
// Predict first: how much of the box's volume does the plain cube keep?
const box = 1.4 ** 3
for (const w of [null, 0.3, 0.2, 0.1, 0.05]) {
  const cage = w === null ? { V: cubeV, F: cubeF } : supportLoops(cubeV, cubeF, w)
  const m = subdivided(cage, 2)
  // How round is the edge? On the plane x = 0, the closest point of the surface to the edge's line (y = z = 0.7).
  const gap = Math.min(...m.V.filter((p) => Math.abs(p[0]) < 1e-9 && p[1] > 0 && p[2] > 0).map((p) => Math.hypot(h - p[1], h - p[2])))
  console.log((w === null ? 'no support loops' : 'loops at w = ' + w) + ': ' + (100 * volume(m) / box).toFixed(1) + '% of the box, the edge rounded off by ' + r(gap) + '; cage ' + cage.F.length + ' faces, drawn ' + m.F.length)
}`;

const PICTURE = withPicture(`${CC}
// Three cubes subdivided twice: no support loops (left), loops at w = 0.3 (middle), loops at w = 0.05 (right).
const verts = [], faces = [], groups = [], shading = []
;[null, 0.3, 0.05].forEach((w, i) => {
  const m = subdivided(w === null ? { V: cubeV, F: cubeF } : supportLoops(cubeV, cubeF, w), 2)
  const base = verts.length
  m.V.forEach((p) => verts.push([p[0] + (i - 1) * 2.2, p[1], p[2]]))
  const vn = m.V.map(() => [0, 0, 0])
  m.F.forEach((f) => { const [a, b, c] = f.map((v) => m.V[v]); const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; const n = [u[1] * w2[2] - u[2] * w2[1], u[2] * w2[0] - u[0] * w2[2], u[0] * w2[1] - u[1] * w2[0]]; f.forEach((v) => { vn[v] = add(vn[v], n) }) })
  m.F.forEach((f) => { faces.push(f.map((v) => v + base)); groups.push(i); shading.push(f.map((v) => { const l = Math.hypot(...vn[v]); return vn[v].map((x) => x / l) })) })
})
console.log('left: no support; middle: loops at 0.3; right: loops at 0.05. The closer the loop, the sharper the edge.')
show({ verts, faces, groups, shading, zoom: 1.6 })`);

const CHALLENGE = `// Change the widths in cell 2 to find out. Of 0.3, 0.25, 0.2, 0.15 and 0.1, which is the WIDEST support-loop
// width that still keeps at least 90% of the box's volume after two levels?
const widest = 0
console.log(widest)`;

const SOLVED = CHALLENGE.replace('const widest = 0', 'const widest = 0.2');

/** The challenge's check: 0.25 keeps 89.6%, 0.2 keeps 90.9%, so 0.2 is the widest that keeps 90%. */
export function checkWidest(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+widest\s*=\s*(-?[\d.]+)/);
  if (!m) return no('Keep the line const widest = …, with one of the widths.');
  const w = Number(m[1]);
  if (Math.abs(w - 0.2) < 1e-9) return { pass: true, message: '0.2: it keeps 90.9%, while 0.25 keeps only 89.6%. Narrower loops keep more (0.1: 93.4%) but squeeze the bevel-like rounding into a thinner band, and every loop adds faces.' };
  if (w === 0) return no('Run cell 2 with the widths 0.3, 0.25, 0.2, 0.15 and 0.1 and read the percentages.');
  if (Math.abs(w - 0.25) < 1e-9) return no('Close: 0.25 keeps 89.6%, just under 90%. Try the next narrower width.');
  if (Math.abs(w - 0.3) < 1e-9) return no('0.3 keeps 88.1%: under 90%.');
  if (Math.abs(w - 0.15) < 1e-9 || Math.abs(w - 0.1) < 1e-9) return no(`${w} does keep over 90%, but it is not the widest that does: a wider one also passes.`);
  return no(`${w} is not one of the widths to try: 0.3, 0.25, 0.2, 0.15, 0.1.`);
}

export default {
  id: 'modelling-geometry-6-004',
  slug: 'keeping-edges-sharp',
  chapter: 'modelling-geometry',
  order: 4,
  title: 'Keeping edges sharp',
  subtitle: 'Subdivision rounds everything; support loops close to an edge hold it tight.',
  tags: ['subdivision', 'support loops', 'hard surface', 'creases', 'volume', 'modelling'],
  coreConcept: 'Catmull–Clark moves every point towards an average of its neighbours, so an edge with neighbours far away melts: a subdivided cube keeps only 35% of its volume. A support loop is an extra ring of edges a small distance w from a sharp edge; the averages near the edge then involve points close to it, so the limit surface stays close to the edge, rounded over a band about w wide. The closer the loops, the sharper the edge and the more volume is kept (93% at w = 0.1), at the cost of more faces. The same effect on a curve: a control point next to a corner pulls the limit curve into the corner.',
  prerequisites: ['modelling-geometry-6-003', 'modelling-geometry-5-002'],
  timeToComplete: 35,
  nextLesson: 'modelling-geometry-6-005',

  hook: {
    question: 'Put a subdivision modifier on a box and it melts into a pebble. Hard-surface modellers want the smoothness of subdivision and the crisp edges of a box. How do you get both, without giving up the modifier?',
    realWorldContext: 'Every subdivided phone, car, weapon or appliance in games and film uses support loops (or their mathematical cousin, creases) to control how sharp each edge is. Where the loops go, and how close, is most of what "hard-surface topology" means.',
  },

  intuition: {
    prose: [
      'Lesson 6.2 showed a cube becoming a rounded blob: its corners pulled in to $(0.5, 0.5, 0.5)$, its faces sagging. The reason is that every new point is an average of points around it, and near a cube\'s edge the nearest other points are the far corners of the faces. Nothing holds the edge.',
      'Start on a curve (cell 1). Lesson 6.1\'s cubic rule on a square stays well away from the corners. Now add a **support point** on each edge a small distance $d$ from each corner. Before running cell 1, predict: with $d = 0.1$, how close does the curve come to the corner? Within $0.024$: the corner\'s neighbours are now right beside it, so their averages stay near it too. The gap is $0.236\\,d$ for every $d$: halve the distance, halve the rounding.',
      'On a surface the same idea is a **support loop**: a ring of edges a distance $w$ from a sharp edge, on both faces beside it. Insetting every face of a cube (lesson 5.2) by $w$ puts a loop $w$ from every edge.',
      'Before running cell 2, predict: how much of its volume does a plain cube keep after two levels? Only $35\\%$. With loops at $w = 0.3$: $88\\%$; at $0.1$: $93\\%$; at $0.05$: $94.5\\%$. And the edge is rounded off over a band about as wide as $w$: the closer the loop, the crisper the edge.',
      'The price is faces: the cage goes from 6 to 30, and after two levels from 96 to 480. Real models put loops only along the edges that must stay sharp, and leave soft areas loose.',
      'A bevel (lesson 5.4) also adds geometry near edges, but its new faces are angled; subdivided, they give a softer, wider rounding (the project\'s middle cube keeps 85%). Support loops keep the faces flat and only add edges, which is why they hold the shape more tightly.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Sharpen an edge for subdivision',
        body: 'Step 1. Decide how sharp: the edge will be rounded over a band about w wide.\nStep 2. Add a loop w from the edge on each face beside it: a loop cut slid towards the edge (lesson 5.3), an inset (5.2), or a bevel (5.4).\nStep 3. Check the subdivided result; move the loop closer for a crisper edge, further for a softer one.\nStep 4. Keep the loops as clean rings of quads, so they do not create poles in flat areas (lesson 5.9).',
      },
      {
        type: 'warning',
        title: 'Loops that stop create pinches',
        body: 'A support loop that ends in the middle of a face leaves a triangle or a pole there, which subdivides into a dimple. Run loops all the way round, or end them where the surface turns.',
      },
      {
        type: 'warning',
        title: 'Too close is too sharp',
        body: 'A loop almost on top of the edge gives an edge sharper than any real object, and tiny faces that waste subdivision levels. Real products have edges rounded by a millimetre or more: pick w from the size of the rounding you want.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: hard-surface looks',
        body: 'What reads as a manufactured object is large flat or gently curved surfaces meeting at tight, smoothly rounded edges that catch a thin highlight. Support loops give exactly that from subdivision: flat faces stay flat (the loops pull the limit onto them), and each edge becomes a narrow fillet that shading turns into a highlight line.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 3)',
        body: 'Misconception it contradicts: "subdivision can only make soft shapes". All three cubes are subdivided twice. The plain one (left) is a pebble; loops at 0.3 (middle) give a soft box; loops at 0.05 (right) give a crisp box with finely rounded edges.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'supportLoops() in the cells insets every face (Step 2); subdivided() is lesson 6.2\'s step repeated; volume() and the gap measure Step 3.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Nothing new on the GPU: support loops are ordinary edges, so the subdivided mesh is still all quads. That is their advantage over some crease implementations, which need special rules in every renderer.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'The "Support loops and subdivision" project shows three cubes and prints their volumes (35%, 85%, 93%); the "Keep it a box" challenge asks you to bring a melted box back to 90% without removing the modifier.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: support loops',
        caption: 'Support points on a curve, support loops on a cube with volumes and sharpness, and three cubes compared.',
        props: {
          lesson: {
            title: 'Keeping edges sharp',
            subtitle: 'Hold the edge with a loop beside it.',
            cells: [
              { type: 'js', instruction: '### 1. On a curve\nPredict first: with a support point 0.1 from each corner, how close does the curve get?', startCode: CURVE },
              { type: 'js', instruction: '### 2. On a cube\nPredict first: how much volume does a plain cube keep after two levels?', startCode: VOLUME },
              { type: 'js', instruction: '### 3. See it\nNo loops, loops at 0.3, loops at 0.05; each subdivided twice. Drag to turn.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 340 },
              { type: 'challenge', instruction: '### 4. Challenge: the widest loop that keeps 90%\nEdit cell 2\'s widths to find it. The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkWidest },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Support loops and subdivision" in MeshLab](#/lab/mesh-lab?project=support-loops): three cubes, the same modifier, and their volumes. Then dissolve one side\'s support loops and watch that side soften.' },
              { type: 'markdown', instruction: '### Try it\n[MeshLab challenge: Keep it a box](#/lab/mesh-lab?challenge=keep-it-a-box). A box has melted under a subdivision modifier; bring it back to at least 90% of its volume without removing the modifier.\n\n**In Blender:** loop cuts slid towards the edge (Ctrl+R, then drag), the Bevel modifier with a small width and a few segments under the Subdivision Surface modifier, or edge creases (Shift+E), which sharpen edges without extra geometry.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Why edges melt.** Every Catmull–Clark point is an affine combination of nearby cage points with positive weights. A point on an edge of a cube is averaged with points up to a whole face away, so the limit there lies well inside the cube: the cube\'s limit corner is $(0.5, 0.5, 0.5)$ for a cube with corners at $\\pm 1$.',
      '**Why loops help.** The limit at a point depends on the control points within two rings of it. With a loop a distance $w$ from the edge, the control points near the edge are all within $w$ of it, so the limit is pulled to within a distance that shrinks with $w$: on cell 1\'s curve exactly in proportion ($0.236\\,d$), and on cell 2\'s cube after two levels from $0.35$ with no loops to $0.04$ at $w = 0.05$.',
      '**Flat stays flat.** Between two parallel loops on a flat face, every control point lies in the face\'s plane, so the limit surface there is exactly flat: subdivision reproduces planes (affine invariance). That is why the support-looped cube has flat sides and only rounded edges.',
      '**Creases.** Instead of geometry, a crease marks an edge to use the curve rule (lesson 6.1\'s cubic B-spline along the edge, ignoring the faces across it) for a number of levels. A fully sharp crease makes the limit pass along the edge; MeshLab uses support loops instead, which need no special rules.',
    ],
    equations: [
      { label: 'Cost', latex: 'F_{\\text{cage}} = 6 \\to 30, \\quad F_2 = 30 \\times 16 = 480' },
      { label: 'Rounding (curve)', latex: '\\text{gap to the corner} = 0.236\\,d' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** For Catmull–Clark surfaces, the limit surface lies within the convex hull of the control points of each patch; with parallel support loops at distance w from an edge, the patches spanning the edge have control points within O(w) of it, so the limit surface lies within O(w) of the sharp edge in the limit, and flat regions between loops are reproduced exactly.',
      '**Invariant viewpoint.** Sharpness is set by relative spacing: scaling a model scales its edge roundings with it. A loop at 1% of the face size gives the same look on a phone and on a building.',
      '**Geometric picture.** Subdivision is a rubber sheet pulled tight over pegs. Pegs far apart give soft curves; two rows of pegs close together on each side of an edge hold a sharp fold.',
      '**Where this goes.** Lesson 6.5 subdivides texture coordinates; seams in UVs behave like open borders, the curve rule again.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-6-004-ex1',
      title: 'Counting faces',
      problem: 'Every face of a cube is inset once for support loops, then subdivided three times. How many faces?',
      steps: [
        { expression: '6 \\times 5 = 30', annotation: 'Each face becomes an inner face and 4 frame quads.' },
        { expression: '30 \\times 4^3 = 1920', annotation: 'Three levels.' },
      ],
      conclusion: '1920 faces.',
    },
    {
      id: 'modelling-geometry-6-004-ex2',
      title: 'Choosing w',
      problem: 'A part 10 cm wide should have edges rounded by about 2 mm. Roughly where should the support loops go?',
      steps: [{ expression: 'w \\approx 2\\text{ mm}', annotation: 'The edge is rounded over a band about w wide.' }],
      conclusion: 'About 2 mm from each sharp edge, then adjust by eye on the subdivided result.',
    },
    {
      id: 'modelling-geometry-6-004-ex3',
      title: 'Bevel or loops?',
      problem: 'The project\'s bevelled cube keeps 85% of its volume and the support-looped one 93%. Why the difference?',
      steps: [
        { expression: '\\text{the bevel\'s strip faces are angled}', annotation: 'Their averages pull the edge in further.' },
        { expression: '\\text{support loops keep the side faces flat right up to the loop}', annotation: 'So more of each face stays in place.' },
      ],
      conclusion: 'Support loops hold the shape more tightly; a bevel gives a softer, wider rounding.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-6-004-ch1',
      difficulty: 'easy',
      problem: 'Why does a plain subdivided cube lose so much volume?',
      walkthrough: [{ expression: '\\text{every point averages far-away neighbours}', annotation: 'Nothing near the edges holds them.' }],
      answer: 'Every subdivided point is an average of cage points around it, and near a plain cube\'s edges and corners the nearest other cage points are a face away, so the averages lie well inside: the edges and corners melt.',
    },
    {
      id: 'modelling-geometry-6-004-ch2',
      difficulty: 'medium',
      problem: 'A support loop is added on only one of the two faces beside an edge. What happens to that edge after subdivision?',
      walkthrough: [
        { expression: '\\text{the looped side is held; the other is not}', annotation: 'The rounding is lopsided.' },
      ],
      answer: 'The edge is held on the looped side and melts on the other, so the rounding is lopsided: tight on one face, a long soft slope on the other. Support loops go on both sides of an edge.',
    },
    {
      id: 'modelling-geometry-6-004-ch3',
      difficulty: 'hard',
      problem: 'Explain why the side faces of the support-looped cube stay exactly flat after subdivision.',
      walkthrough: [
        { expression: '\\text{the inner face and its frame lie in one plane}', annotation: 'All control points of the middle patches are coplanar.' },
        { expression: '\\text{affine combinations of coplanar points are coplanar}', annotation: 'Every new point stays in the plane.' },
      ],
      answer: 'In the middle of each side, every control point that influences the surface lies in the side\'s plane; Catmull–Clark only takes affine combinations, which stay in that plane, so the limit surface there is exactly flat. Only near the edges, where control points from the next face are involved, does it curve.',
    },
  ],

  semantics: {
    core: [
      { symbol: '\\text{support loop}', meaning: 'An extra ring of edges close to a sharp edge, holding it under subdivision.' },
      { symbol: 'w', meaning: 'How far the loop is from the edge; the edge is rounded over a band about w wide.' },
      { symbol: '\\text{crease}', meaning: 'A marked edge that uses the curve rule instead, sharpening without geometry.' },
      { symbol: '\\text{volume kept}', meaning: 'A measure of how box-like the subdivided result is.' },
      { symbol: '\\text{hard surface}', meaning: 'Manufactured shapes: flat or gently curved faces meeting at tight rounded edges.' },
    ],
    rulesOfThumb: [
      'Loops on both sides of every edge that must stay sharp.',
      'Closer loops, sharper edges, more faces.',
      'Run loops all the way round.',
      'Flat between loops stays flat.',
      'Choose w from the rounding you want, relative to the model\'s size.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-6-003', label: 'Extraordinary vertices and limits', note: 'Where subdivision converges, which support loops steer.' },
      { lessonId: 'modelling-geometry-5-002', label: 'Inset', note: 'One way to add support loops round every face.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-6-005', label: 'Subdividing UVs', note: 'The same rules applied to texture coordinates.' },
      { lessonId: 'modelling-geometry-5-004', label: 'Bevel', note: 'The softer alternative to support loops.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-6-004-1', label: 'Read why subdivided edges melt', type: 'read' },
    { id: 'cp-modelling-geometry-6-004-2', label: 'Read how support loops hold an edge', type: 'read' },
    { id: 'cp-modelling-geometry-6-004-3', label: 'Read the cost of loops and how to choose w', type: 'read' },
    { id: 'cp-modelling-geometry-6-004-4', label: 'Run cells 1 and 2: a curve and a cube', type: 'lab' },
    { id: 'cp-modelling-geometry-6-004-5', label: 'Complete MeshLab\'s Keep it a box challenge', type: 'lab' },
    { id: 'cp-modelling-geometry-6-004-6', label: 'Work through example 1, counting faces', type: 'example' },
    { id: 'cp-modelling-geometry-6-004-7', label: 'Work through example 3, bevel or loops', type: 'example' },
    { id: 'cp-modelling-geometry-6-004-8', label: 'Complete the challenge: the widest loop that keeps 90%', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-6-004-assess-1',
        type: 'choice',
        text: 'Moving a support loop closer to an edge makes the subdivided edge:',
        options: ['Sharper', 'Softer', 'No different', 'Disappear'],
        answer: 'Sharper',
        hint: 'The rounding band is about w wide.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-6-004-quiz-1',
      type: 'choice',
      text: 'How much of its volume does a plain cube keep after two levels of Catmull–Clark?',
      options: ['35%', '90%', '100%', '65%'],
      answer: '35%',
      hints: ['Cell 2.', 'It melts into a pebble.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-6-004-quiz-2',
      type: 'choice',
      text: 'With support loops at w = 0.1, how much does it keep?',
      options: ['93.4%', '35%', '88.1%', '100%'],
      answer: '93.4%',
      hints: ['Cell 2.', 'Close loops hold tight.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-6-004-quiz-3',
      type: 'choice',
      text: 'Why do the sides of a support-looped cube stay flat?',
      options: ['All the control points there lie in the side\'s plane', 'Subdivision skips flat faces', 'The loops are creases', 'They do not'],
      answer: 'All the control points there lie in the side\'s plane',
      hints: ['Affine combinations.', 'Challenge 3.'],
      reviewSection: 'Maths: flat stays flat',
    },
    {
      id: 'modelling-geometry-6-004-quiz-4',
      type: 'choice',
      text: 'What does a support loop cost?',
      options: ['More faces at every level', 'Nothing', 'Volume', 'A special renderer'],
      answer: 'More faces at every level',
      hints: ['6 → 30 cage faces.', 'Intuition.'],
      reviewSection: 'Intuition: the price',
    },
    {
      id: 'modelling-geometry-6-004-quiz-5',
      type: 'choice',
      text: 'Which holds a box shape more tightly under subdivision?',
      options: ['Support loops', 'A one-segment bevel', 'Neither', 'Smooth shading'],
      answer: 'Support loops',
      hints: ['93% against 85%.', 'Example 3.'],
      reviewSection: 'Example 3',
    },
    {
      id: 'modelling-geometry-6-004-quiz-6',
      type: 'choice',
      text: 'On a curve, what does a control point placed next to a corner do?',
      options: ['Pulls the limit curve into the corner', 'Pushes it away', 'Nothing', 'Makes it pass outside'],
      answer: 'Pulls the limit curve into the corner',
      hints: ['Cell 1.', 'Support on a curve.'],
      reviewSection: 'Cell 1',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'You must choose between subdivision and sharp edges.',
      whyStudentsThinkIt: 'A subdivided box melts.',
      correctionExample: 'Cell 2 and the picture: with loops at 0.05 the subdivided cube keeps 95% and has crisp edges.',
      contrastCase: 'Without any loops, it does melt to 35%.',
    },
    {
      falseBelief: 'More subdivision levels sharpen the edges.',
      whyStudentsThinkIt: 'More levels means more detail.',
      correctionExample: 'The plain cube converges to the same rounded blob however many levels you add.',
      contrastCase: 'Moving a support loop closer does sharpen it, at any level.',
    },
    {
      falseBelief: 'Support loops change the shape of flat faces.',
      whyStudentsThinkIt: 'They add vertices to them.',
      correctionExample: 'Challenge 3: between loops, the subdivided face stays exactly flat.',
      contrastCase: 'Moving a loop\'s vertices out of the plane would change it.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A subdivided phone model looks soft and toy-like.',
      competingTechniques: ['Raise the subdivision level', 'Add support loops close to the edges that should be crisp'],
      whyThisTechniqueWins: 'Levels only refine the same soft limit; loops change the limit near each edge.',
    },
    {
      situation: 'A game model must stay low in faces but have a crisp silhouette.',
      competingTechniques: ['Support loops everywhere', 'Support loops only on silhouette edges, or a bevel and no subdivision'],
      whyThisTechniqueWins: 'Loops cost faces at every level; put them only where the edge is seen.',
    },
  ],

  debugging: [
    {
      commonError: 'A support loop that ends inside a face.',
      symptom: 'A small dimple or pinch where the loop stops.',
      whyItHappened: 'It left a pole or triangle in a flat area.',
      repairStrategy: 'Run the loop all the way round, or end it where the surface turns.',
    },
    {
      commonError: 'Loops on one side of an edge only.',
      symptom: 'A lopsided edge: tight on one face, sloping on the other.',
      whyItHappened: 'The other face had nothing near the edge.',
      repairStrategy: 'Add loops on both faces beside the edge.',
    },
    {
      commonError: 'Loops far too close.',
      symptom: 'Razor-sharp, unrealistic edges and tiny faces.',
      whyItHappened: 'w was much smaller than the rounding real objects have.',
      repairStrategy: 'Move the loops out to the rounding you want.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Add support loops at a chosen width and predict their effect on volume and sharpness.',
    explainVerbally: 'Explain why edges melt, why loops hold them, and why flat faces stay flat.',
    detectIncorrectApplication: 'Recognise loops that stop, one-sided loops and over-tight loops from their symptoms.',
    transferToUnfamiliar: 'Plan support loops for a hard-surface model within a face budget.',
  },
};
