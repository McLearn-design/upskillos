// Lesson 6.1: corner cutting. Chaikin's scheme replaces each edge of a polygon by two points, a quarter and three
// quarters along it; repeated, the polygon converges to a smooth curve (a quadratic B-spline) that touches the
// middle of every original edge. The cubic rule Catmull–Clark uses on borders is the same idea one degree higher;
// the 4-point scheme keeps the original points and fills in between.

const HELPERS = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const p2 = (p) => '(' + r(p[0]) + ', ' + r(p[1]) + ')'
const lerp = (a, b, t) => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
const square = [[0, 0], [4, 0], [4, 4], [0, 4]]
// One step of Chaikin's corner cutting on a closed polygon: each edge P → Q gives ¾P + ¼Q and ¼P + ¾Q.
function chaikin(poly) {
  const out = []
  poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; out.push(lerp(p, q, 0.25), lerp(p, q, 0.75)) })
  return out
}
const area = (poly) => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1] }, 0)) / 2
const perimeter = (poly) => poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + Math.hypot(q[0] - p[0], q[1] - p[1]) }, 0)
`;

const ONE = `${HELPERS}
// The square's bottom edge runs from (0, 0) to (4, 0). Predict first: where are its two new points?
const s1 = chaikin(square)
console.log('one step: ' + s1.length + ' points: ' + s1.map(p2).join(' '))
console.log('each corner is cut off: the corner (4, 0) is replaced by (3, 0) and (4, 1)')`;

const REPEAT = `${HELPERS}
// Repeat. Predict first: does the area keep shrinking forever, or settle?
let poly = square
for (let k = 0; k <= 8; k++) {
  if ([0, 1, 2, 3, 5, 8].includes(k)) console.log('step ' + k + ': ' + poly.length + ' points, area ' + r(area(poly)) + ', perimeter ' + r(perimeter(poly)))
  poly = chaikin(poly)
}
// The curve it settles on passes through the middle of each original edge, e.g. (2, 0), and is tangent to it there.
const near = (pt) => Math.min(...poly.map((p) => Math.hypot(p[0] - pt[0], p[1] - pt[1])))
console.log('after 9 steps, the closest point to (2, 0) is ' + r(near([2, 0])) + ' away; to the old corner (4, 0), ' + r(near([4, 0])))`;

const SCHEMES = `${HELPERS}
// Three ways to subdivide a closed polygon, one step each, written as rules for the new points.
// Cubic B-spline (Catmull–Clark's rule on an open border): each old point moves to (1/8, 6/8, 1/8) of itself and its
// neighbours, and a new point goes at each edge's midpoint.
function cubic(poly) {
  const n = poly.length, out = []
  poly.forEach((p, i) => {
    const a = poly[(i + n - 1) % n], b = poly[(i + 1) % n]
    out.push([(a[0] + 6 * p[0] + b[0]) / 8, (a[1] + 6 * p[1] + b[1]) / 8], lerp(p, b, 0.5))
  })
  return out
}
// The 4-point scheme (Dyn, Levin, Gregory): old points stay; each edge gets (−1/16, 9/16, 9/16, −1/16) of four points.
function fourPoint(poly) {
  const n = poly.length, out = []
  poly.forEach((p, i) => {
    const a = poly[(i + n - 1) % n], b = poly[(i + 1) % n], c = poly[(i + 2) % n]
    out.push(p, [0, 1].map((k) => (-a[k] + 9 * p[k] + 9 * b[k] - c[k]) / 16))
  })
  return out
}
// Predict first: which one still passes through the corner (4, 0) after five steps?
for (const [name, step] of [['Chaikin (quadratic)', chaikin], ['cubic B-spline', cubic], ['4-point', fourPoint]]) {
  let poly = square
  for (let k = 0; k < 5; k++) poly = step(poly)
  const d = Math.min(...poly.map((p) => Math.hypot(p[0] - 4, p[1])))
  const out = Math.max(...poly.map((p) => Math.max(-p[0], p[0] - 4, -p[1], p[1] - 4)))
  console.log(name + ': ' + poly.length + ' points, area ' + r(area(poly)) + ', nearest to the corner ' + r(d) + (out > 1e-9 ? ', bulges ' + r(out) + ' outside the square' : ', inside the square'))
}`;

const PICTURE = `${HELPERS}
// The square (grey), and Chaikin after 1 step (amber) and 5 steps (blue). Drawn on a canvas.
const canvas = document.createElement('canvas'), W = 360, H = 300
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'); g.scale(2, 2)
g.fillStyle = '#0f1923'; g.fillRect(0, 0, W, H)
const X = (p) => [W / 2 + (p[0] - 2) * 55, H / 2 - (p[1] - 2) * 55]
function draw(poly, colour, width, dots) {
  g.strokeStyle = colour; g.lineWidth = width; g.beginPath()
  poly.forEach((p, i) => { const [x, y] = X(p); i ? g.lineTo(x, y) : g.moveTo(x, y) }); g.closePath(); g.stroke()
  if (dots) { g.fillStyle = colour; for (const p of poly) { const [x, y] = X(p); g.beginPath(); g.arc(x, y, 3, 0, 2 * Math.PI); g.fill() } }
}
let five = square
for (let k = 0; k < 5; k++) five = chaikin(five)
draw(square, '#94a3b8', 1.5, true); draw(chaikin(square), '#f59e0b', 2, true); draw(five, '#4f8fd9', 2.5, false)
// The middle of each original edge, where the limit curve touches it.
g.fillStyle = '#e2e8f0'; for (const m of [[2, 0], [4, 2], [2, 4], [0, 2]]) { const [x, y] = X(m); g.beginPath(); g.arc(x, y, 4, 0, 2 * Math.PI); g.fill() }
console.log('grey: the square; amber: one step (8 points); blue: five steps (' + five.length + ' points); white dots: edge midpoints the curve touches')`;

const CHALLENGE = `// One step of Chaikin's corner cutting on the triangle (0, 0), (4, 0), (0, 4).
// Write the two new points on the edge from (4, 0) to (0, 4), the one nearer (4, 0) first.
const q = [0, 0]
const r = [0, 0]
console.log(q, r)`;

const SOLVED = CHALLENGE.replace('const q = [0, 0]\nconst r = [0, 0]', 'const q = [3, 1]\nconst r = [1, 3]');

/** The challenge's check: on edge (4, 0) → (0, 4), Chaikin puts (3, 1) and (1, 3). */
export function checkChaikin(code) {
  const no = (message) => ({ pass: false, message });
  const pt = (name) => { const m = code.match(new RegExp('const\\s+' + name + '\\s*=\\s*\\[\\s*(-?[\\d.]+)\\s*,\\s*(-?[\\d.]+)\\s*\\]')); return m ? [Number(m[1]), Number(m[2])] : null; };
  const q = pt('q'), rr = pt('r');
  if (!q || !rr) return no('Keep the lines const q = [x, y] and const r = [x, y], with numbers.');
  const is = (p, x, y) => Math.abs(p[0] - x) < 1e-9 && Math.abs(p[1] - y) < 1e-9;
  if (is(q, 0, 0) && is(rr, 0, 0)) return no('Work out the two points: a quarter and three quarters of the way along the edge.');
  if (is(q, 1, 3) && is(rr, 3, 1)) return no('Right points, other order: the one nearer (4, 0) is ¾ (4, 0) + ¼ (0, 4).');
  if (is(q, 2, 2) || is(rr, 2, 2)) return no('(2, 2) is the midpoint. Chaikin puts its points a quarter of the way in from each end, not at the middle.');
  if (is(q, 4, 0) || is(rr, 0, 4)) return no('The corners themselves are cut off: neither new point is an old corner.');
  if (!is(q, 3, 1)) return no(`q should be ¾ (4, 0) + ¼ (0, 4); (${q}) is not.`);
  if (!is(rr, 1, 3)) return no(`r should be ¼ (4, 0) + ¾ (0, 4); (${rr}) is not.`);
  return { pass: true, message: '(3, 1) and (1, 3): a quarter of the way from each end. The corner (4, 0) is cut off between (3, 0), on the bottom edge, and (3, 1), on this one.' };
}

export default {
  id: 'modelling-geometry-6-001',
  slug: 'corner-cutting',
  chapter: 'modelling-geometry',
  order: 1,
  title: 'Corner cutting',
  subtitle: 'Repeatedly cut the corners off a polygon and it turns into a smooth curve: subdivision in two dimensions.',
  tags: ['subdivision', 'chaikin', 'b-spline', 'curves', 'limit', 'smoothing'],
  coreConcept: 'Chaikin\'s corner cutting replaces each edge P → Q of a polygon by the two points ¾P + ¼Q and ¼P + ¾Q. Each step cuts every corner off and doubles the points; repeated, the polygons converge to a smooth limit curve, the uniform quadratic B-spline, which touches the middle of each original edge and is tangent to it there. Other rules give other curves: the cubic B-spline rule (old points to ⅛, ¾, ⅛ of themselves and their neighbours, new points at midpoints) is what Catmull–Clark uses on borders, and the 4-point scheme keeps the old points and passes through them. Approximating schemes shrink a shape; interpolating ones can bulge.',
  prerequisites: ['modelling-geometry-5-009', 'modelling-geometry-2-001'],
  timeToComplete: 35,
  nextLesson: 'modelling-geometry-6-002',

  hook: {
    question: 'Take a square and cut off its four corners. Cut off the corners of the octagon you get, and again. After a handful of steps it looks like a perfectly smooth rounded square. What curve is it heading for, and how fast?',
    realWorldContext: 'Subdivision is how films and games get smooth surfaces from coarse cages: every Pixar character since Geri\'s Game is a subdivision surface. The ideas are clearest on curves, where Chaikin found them in 1974 while drawing smooth lines on a plotter.',
  },

  intuition: {
    prose: [
      'Start with a square. On each edge, put a point a quarter of the way along and another three quarters of the way along: $\\tfrac34 P + \\tfrac14 Q$ and $\\tfrac14 P + \\tfrac34 Q$. Join the new points in order. Before running cell 1, predict: on the bottom edge from $(0, 0)$ to $(4, 0)$, where do they go? $(1, 0)$ and $(3, 0)$.',
      'Each corner is now **cut off**: the corner $(4, 0)$ is replaced by the short edge from $(3, 0)$ to $(4, 1)$. The square has become an octagon with twice as many points. Do it again, and again (cell 2).',
      'Before running cell 2, predict: does the area keep shrinking forever? No: it drops from $16$ to $14$, $13.5$, $13.375$ … and settles near $13.33$. The polygons **converge** to a smooth **limit curve**. Each step changes them half as much as the one before, so a few steps are enough to look smooth.',
      'The limit curve is a **quadratic B-spline**: made of parabola pieces joined smoothly. It passes through the middle of each original edge, $(2, 0)$ for the bottom, and is tangent to the edge there, but it never reaches the corners. Corner cutting **approximates** the original polygon, from inside.',
      'Change the rule and you get a different curve (cell 3). The **cubic B-spline** rule moves each old point to $\\tfrac18, \\tfrac68, \\tfrac18$ of its neighbour, itself and its other neighbour, and puts a new point at each edge\'s midpoint: smoother still, and further inside. It is the rule Catmull–Clark uses along the open border of a surface (lesson 6.2). The **4-point scheme** keeps every old point and adds new ones from four neighbours with weights $-\\tfrac1{16}, \\tfrac9{16}, \\tfrac9{16}, -\\tfrac1{16}$: it **interpolates** (passes through the corners) and bulges outside the square.',
      'All three are **stationary linear** schemes: each new point is a fixed weighted average of nearby old points, and the weights add up to $1$. That is why they commute with moving, rotating and scaling the polygon, and why their limits can be computed exactly.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Chaikin corner cutting',
        body: 'Step 1. For each edge P → Q of the closed polygon, in order: output ¾P + ¼Q, then ¼P + ¾Q.\nStep 2. The outputs, in order, are the new polygon (twice as many points).\nStep 3. Repeat until the polygon is as smooth as needed; the limit is the quadratic B-spline.',
      },
      {
        type: 'procedure',
        title: 'Procedure: Cubic B-spline subdivision (Catmull–Clark on a border)',
        body: 'Step 1. Each old point P with neighbours A and B moves to (A + 6P + B) / 8.\nStep 2. Each edge P → B gets a new point at its midpoint (P + B) / 2.\nStep 3. Alternate moved old points and new midpoints; repeat.',
      },
      {
        type: 'warning',
        title: 'Approximating schemes shrink',
        body: 'Chaikin and the cubic rule move every point towards its neighbours, so the shape shrinks: a square of area 16 settles near 13.3 (Chaikin) or 10.8 (cubic). Make the control polygon a little bigger than the shape you want, or use an interpolating scheme.',
      },
      {
        type: 'warning',
        title: 'Interpolating schemes can bulge',
        body: 'The 4-point scheme passes through every original point, but its negative weights let it overshoot: on the square it bulges out to 4.5 at the middle of each edge, half a unit outside it. Good for passing through measured points; bad when the curve must stay inside a boundary.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: smooth curves from coarse ones',
        body: 'A renderer cannot draw a curve, only straight segments. Subdivision gives it as many segments as it needs, computed from a handful of control points by cheap averages, and the segments converge to a curve with continuous tangent (Chaikin) or continuous curvature (cubic). Font outlines, animation paths and the borders of subdivision surfaces are drawn this way.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "smoothing a polygon means rounding it through its corners". The blue curve after five steps stays inside the square, touches each edge only at its midpoint (white dots), and never reaches the corners. One step (amber) already shows where it is heading.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'chaikin() in the cells is the corner-cutting procedure; cubic() and fourPoint() in cell 3 are the other two rules, each a loop over edges writing weighted averages.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Subdivision runs on the CPU (or in a tessellation or mesh shader); the GPU then draws the many short straight segments, or the many small faces of a subdivided surface.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'MeshLab subdivides surfaces, not curves, but the cubic rule here is exactly how Catmull–Clark moves the open border of a surface. Lesson 6.2 opens "Predict Catmull–Clark" in MeshLab for the surface rules.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: corner cutting',
        caption: 'One step, the limit, three schemes compared, and the curve drawn.',
        props: {
          lesson: {
            title: 'Corner cutting',
            subtitle: 'Subdivision on a polygon.',
            cells: [
              { type: 'js', instruction: '### 1. One step\nPredict first: the two new points on the bottom edge.', startCode: ONE },
              { type: 'js', instruction: '### 2. Repeat\nPredict first: does the area shrink forever?', startCode: REPEAT },
              { type: 'js', instruction: '### 3. Three schemes\nPredict first: which still passes through the corner after five steps?', startCode: SCHEMES },
              { type: 'js', instruction: '### 4. See it\nThe square, one step, and five steps.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 340 },
              { type: 'challenge', instruction: '### 5. Challenge: a triangle\nThe two new points on one edge. The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkChaikin },
              { type: 'markdown', instruction: '### On to surfaces\nThe same idea on a mesh is Catmull–Clark: next lesson. To look ahead, [open "Predict Catmull–Clark" in MeshLab](#/lab/mesh-lab?project=predict-catmull-clark): on its open border, the vertices move by the cubic rule of cell 3.' },
              { type: 'markdown', instruction: '### Use it elsewhere\n- **Inkscape, Illustrator:** smoothing a path rounds its corners like corner cutting.\n- **In Blender:** the Subdivision Surface modifier on a single open edge loop (or a curve object\'s resolution) shows the same convergence.\n- **Font rendering:** quadratic B-splines (TrueType outlines) are the limit curves of Chaikin\'s scheme.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**The rule as a matrix.** Write the polygon\'s points as a column $P$. One Chaikin step is $P\' = SP$, where each row of $S$ has two non-zero entries, $\\tfrac34$ and $\\tfrac14$. Every row sums to $1$, so a translated polygon gives a translated result, and the same holds for rotation and scaling: the scheme is affine-invariant.',
      '**The limit.** Chaikin\'s scheme refines the uniform quadratic B-spline whose control points are the original polygon: its pieces are $B(t) = \\tfrac12(1 - t)^2 P_0 + \\tfrac12(-2t^2 + 2t + 1) P_1 + \\tfrac12 t^2 P_2$ for consecutive points. At $t = 0$ this is $\\tfrac12(P_0 + P_1)$: the midpoint of edge $P_0P_1$, where the curve meets it tangentially.',
      '**Convergence.** The difference between consecutive polygons halves in size each step (the scheme\'s second eigenvalue is $\\tfrac12$), so after $k$ steps the polygon is within about $C \\cdot 2^{-k}$ of the limit. Cell 2\'s area settles accordingly: $16, 14, 13.5, 13.375, \\ldots \\to 13.\\overline{3}$.',
      '**Smoothness.** Quadratic B-splines are $C^1$: tangent direction continuous, curvature jumping between pieces. The cubic rule\'s limit is $C^2$: curvature continuous too. The 4-point scheme\'s limit is $C^1$ and passes through every original point.',
    ],
    equations: [
      { label: 'Chaikin', latex: "Q_{2i} = \\tfrac34 P_i + \\tfrac14 P_{i+1}, \\qquad Q_{2i+1} = \\tfrac14 P_i + \\tfrac34 P_{i+1}" },
      { label: 'Cubic B-spline', latex: "P_i' = \\tfrac18 P_{i-1} + \\tfrac68 P_i + \\tfrac18 P_{i+1}, \\qquad E_i = \\tfrac12 (P_i + P_{i+1})" },
      { label: '4-point', latex: "E_i = -\\tfrac{1}{16} P_{i-1} + \\tfrac{9}{16} P_i + \\tfrac{9}{16} P_{i+1} - \\tfrac{1}{16} P_{i+2}" },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** For any closed control polygon, the Chaikin iterates converge uniformly to the closed uniform quadratic B-spline with that control polygon; the cubic rule\'s iterates converge to the cubic B-spline. Both limits lie inside the convex hull of the control points.',
      '**Invariant viewpoint.** Because each rule is a fixed set of affine combinations, subdividing then transforming equals transforming then subdividing; the limit curve moves rigidly with its control polygon.',
      '**Geometric picture.** Each step planes the corners off a piece of wood with a fixed tool; the planed corners shrink geometrically, and the piece approaches a smooth shape it never quite reaches in finitely many steps.',
      '**Where this goes.** Lesson 6.2 does the same on surfaces with Catmull–Clark: face, edge and vertex points instead of edge points alone. Lesson 6.3 asks what the limit looks like near a vertex that is not regular.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-6-001-ex1',
      title: 'One edge',
      problem: 'Chaikin on the edge from $(2, 2)$ to $(6, 10)$: the two new points?',
      steps: [
        { expression: '\\tfrac34(2, 2) + \\tfrac14(6, 10) = (3, 4)', annotation: 'Nearer the first end.' },
        { expression: '\\tfrac14(2, 2) + \\tfrac34(6, 10) = (5, 8)', annotation: 'Nearer the second.' },
      ],
      conclusion: '(3, 4) and (5, 8).',
    },
    {
      id: 'modelling-geometry-6-001-ex2',
      title: 'Counting points',
      problem: 'A polygon of 5 points goes through 6 Chaikin steps. How many points?',
      steps: [{ expression: '5 \\times 2^6 = 320', annotation: 'Each step doubles.' }],
      conclusion: '320 points.',
    },
    {
      id: 'modelling-geometry-6-001-ex3',
      title: 'A cubic step',
      problem: 'With the cubic rule, where does the corner $(4, 0)$ of the square go, with neighbours $(0, 0)$ and $(4, 4)$?',
      steps: [
        { expression: '\\tfrac18(0, 0) + \\tfrac68(4, 0) + \\tfrac18(4, 4)', annotation: 'The rule.' },
        { expression: '= (3.5, 0.5)', annotation: 'Pulled in towards its neighbours.' },
      ],
      conclusion: '(3.5, 0.5).',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-6-001-ch1',
      difficulty: 'easy',
      problem: 'Why does the Chaikin curve stay inside the original polygon?',
      walkthrough: [{ expression: '\\text{every new point is a weighted average with positive weights}', annotation: 'Inside the convex hull.' }],
      answer: 'Every new point is an average of old points with positive weights, so it lies inside their convex hull; repeating keeps every point there.',
    },
    {
      id: 'modelling-geometry-6-001-ch2',
      difficulty: 'medium',
      problem: 'The 4-point scheme has negative weights. What does that allow that Chaikin cannot do, and what does it cost?',
      walkthrough: [
        { expression: '\\text{new points can lie outside the hull}', annotation: 'So the curve can pass through the old points.' },
        { expression: '\\text{and overshoot}', annotation: 'Cell 3: it bulges outside the square.' },
      ],
      answer: 'Negative weights let new points lie outside the convex hull, which is what allows the curve to pass through every old point (interpolate); the cost is overshoot: bulges outside the polygon between them.',
    },
    {
      id: 'modelling-geometry-6-001-ch3',
      difficulty: 'hard',
      problem: 'Show that the Chaikin limit passes through the midpoint of each original edge.',
      walkthrough: [
        { expression: '\\text{the edge } P \\to Q \\text{ becomes } \\tfrac34P + \\tfrac14Q \\to \\tfrac14P + \\tfrac34Q', annotation: 'The middle half of the edge.' },
        { expression: '\\text{its midpoint is still } \\tfrac12(P + Q)', annotation: 'The new edge has the same midpoint.' },
        { expression: '\\text{by induction the midpoint stays on every level}', annotation: 'So it is on the limit.' },
      ],
      answer: 'Each step keeps the middle half of every edge, which has the same midpoint, so the original midpoint lies on an edge of every later polygon; the polygons converge to the limit, so the midpoint is on it. The edge is the tangent there by the same argument.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'P_i', meaning: 'The control points: the polygon being subdivided.' },
      { symbol: '\\tfrac34 P + \\tfrac14 Q', meaning: 'Chaikin\'s new point a quarter of the way along edge P → Q.' },
      { symbol: '\\text{limit curve}', meaning: 'What the polygons converge to as the steps repeat.' },
      { symbol: '\\text{approximating}', meaning: 'A scheme whose limit does not pass through the control points (Chaikin, cubic).' },
      { symbol: '\\text{interpolating}', meaning: 'A scheme whose limit passes through them (4-point).' },
      { symbol: 'C^1, C^2', meaning: 'Tangent continuous; curvature continuous.' },
    ],
    rulesOfThumb: [
      'Each step doubles the points and halves the change.',
      'Approximating schemes shrink; interpolating ones can bulge.',
      'Weights that add to 1 make the scheme move with its control points.',
      'The cubic rule is Catmull–Clark on a border.',
      'A few steps are enough to look smooth.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-5-009', label: 'Clean topology', note: 'Subdivision keeps poles; chapter 6 explains what it does to positions.' },
      { lessonId: 'modelling-geometry-2-001', label: 'Vectors, dot and cross', note: 'Weighted averages of points.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-6-002', label: 'Catmull–Clark', note: 'The same idea on surfaces.' },
      { lessonId: 'modelling-geometry-6-003', label: 'Extraordinary vertices and limits', note: 'Limits near poles.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-6-001-1', label: 'Read how corner cutting works', type: 'read' },
    { id: 'cp-modelling-geometry-6-001-2', label: 'Read what the limit curve is and where it touches the polygon', type: 'read' },
    { id: 'cp-modelling-geometry-6-001-3', label: 'Read the difference between approximating and interpolating schemes', type: 'read' },
    { id: 'cp-modelling-geometry-6-001-4', label: 'Run cells 1 to 3: one step, the limit, three schemes', type: 'lab' },
    { id: 'cp-modelling-geometry-6-001-5', label: 'Look at the curve drawn in cell 4', type: 'lab' },
    { id: 'cp-modelling-geometry-6-001-6', label: 'Work through example 1, one edge', type: 'example' },
    { id: 'cp-modelling-geometry-6-001-7', label: 'Work through example 3, a cubic step', type: 'example' },
    { id: 'cp-modelling-geometry-6-001-8', label: 'Complete the challenge: a triangle', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-6-001-assess-1',
        type: 'choice',
        text: 'Chaikin on the edge (0, 0) → (8, 4). Which point is nearer (0, 0)?',
        options: ['(2, 1)', '(4, 2)', '(6, 3)', '(0, 0)'],
        answer: '(2, 1)',
        hint: '¾ (0, 0) + ¼ (8, 4).',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-6-001-quiz-1',
      type: 'choice',
      text: 'How many points does one Chaikin step make from a square?',
      options: ['8', '4', '12', '16'],
      answer: '8',
      hints: ['Two per edge.', 'Cell 1.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-6-001-quiz-2',
      type: 'choice',
      text: 'What does the area of the square do under repeated Chaikin steps?',
      options: ['Settles near 13.33', 'Shrinks to 0', 'Stays 16', 'Grows'],
      answer: 'Settles near 13.33',
      hints: ['Cell 2.', 'The changes halve each step.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-6-001-quiz-3',
      type: 'choice',
      text: 'Where does the Chaikin limit curve touch the original square?',
      options: ['At the middle of each edge', 'At the corners', 'Nowhere', 'At every point'],
      answer: 'At the middle of each edge',
      hints: ['Cell 2.', 'Challenge 3.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-6-001-quiz-4',
      type: 'choice',
      text: 'Which scheme still passes through the square\'s corners after five steps?',
      options: ['The 4-point scheme', 'Chaikin', 'The cubic B-spline', 'All three'],
      answer: 'The 4-point scheme',
      hints: ['It keeps old points.', 'Cell 3.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-6-001-quiz-5',
      type: 'choice',
      text: 'Which rule does Catmull–Clark use along a surface\'s open border?',
      options: ['The cubic B-spline rule', 'Chaikin', 'The 4-point scheme', 'None'],
      answer: 'The cubic B-spline rule',
      hints: ['(A + 6P + B) / 8.', 'Cell 3.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-6-001-quiz-6',
      type: 'choice',
      text: 'Why does a subdivision scheme\'s weights adding up to 1 matter?',
      options: ['The result moves, turns and scales with the control points', 'It makes the curve faster', 'It keeps the points inside', 'It doubles the points'],
      answer: 'The result moves, turns and scales with the control points',
      hints: ['Affine invariance.', 'Maths: the rule as a matrix.'],
      reviewSection: 'Maths',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'A subdivided curve passes through its control points.',
      whyStudentsThinkIt: 'You placed those points where you want the curve.',
      correctionExample: 'Cell 2: the Chaikin curve stays inside the square and never reaches its corners.',
      contrastCase: 'Interpolating schemes like the 4-point one do pass through them (cell 3).',
    },
    {
      falseBelief: 'Subdividing forever makes the shape vanish.',
      whyStudentsThinkIt: 'Every step cuts more off.',
      correctionExample: 'Cell 2: the area settles at 13.33; each step cuts off less than the one before.',
      contrastCase: 'Plain smoothing of a closed polygon (lesson 5.6) does keep shrinking it, because it does not add points.',
    },
    {
      falseBelief: 'All smoothing rules give the same curve.',
      whyStudentsThinkIt: 'They all look round.',
      correctionExample: 'Cell 3: Chaikin, cubic and 4-point give different areas and only one passes through the corners.',
      contrastCase: 'They share the same structure: fixed weighted averages, doubling the points each step.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A robot path must pass exactly through a list of waypoints, smoothly.',
      competingTechniques: ['Chaikin corner cutting', 'An interpolating scheme such as the 4-point scheme'],
      whyThisTechniqueWins: 'Chaikin would round past the waypoints without touching them; the 4-point scheme passes through them (watching for overshoot near sharp turns).',
    },
    {
      situation: 'A designer wants a smooth outline that stays inside a sketched polygon.',
      competingTechniques: ['The 4-point scheme', 'Chaikin or cubic B-spline subdivision'],
      whyThisTechniqueWins: 'Approximating schemes stay inside the convex hull of the control points; interpolating ones can bulge out.',
    },
  ],

  debugging: [
    {
      commonError: 'Putting the new points at ½ instead of ¼ and ¾.',
      symptom: 'The polygon does not get smoother; it just alternates between two shapes.',
      whyItHappened: 'Midpoints alone do not cut corners consistently.',
      repairStrategy: 'Use ¾P + ¼Q and ¼P + ¾Q for each edge.',
    },
    {
      commonError: 'Forgetting the closing edge from the last point back to the first.',
      symptom: 'A gap and a sharp corner where the polygon starts.',
      whyItHappened: 'The loop skipped the wrap-around edge.',
      repairStrategy: 'Index the next point with (i + 1) % n.',
    },
    {
      commonError: 'Updating points in place during a step.',
      symptom: 'The curve drifts to one side.',
      whyItHappened: 'Later points were computed from already-moved ones.',
      repairStrategy: 'Build the new polygon from the old one, then replace it.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Apply Chaikin, cubic and 4-point steps by hand, and count points after several steps.',
    explainVerbally: 'Explain why corner cutting converges, where its limit touches the polygon, and approximating versus interpolating.',
    detectIncorrectApplication: 'Recognise midpoint-only rules, missing closing edges and in-place updates.',
    transferToUnfamiliar: 'Choose a scheme for a curve that must pass through points or stay inside a boundary.',
  },
};
