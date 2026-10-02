// Lesson 4.4: dragging with a gizmo. The mouse moves in 2D; the object must move along one 3D axis (or in one
// plane). Each mouse position's pick ray is matched to the closest point on the axis (or hit on the plane); the
// move is the change in that point, rounded to the snap step if snapping is on.
import { withPicture } from '../notebookScene.js';

// The camera of MeshLab's "Dragging with a gizmo" project: at (4, 3, 6), looking at the origin, fov 50°, 1280 × 720.
const BASE = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(3)
const sub = (a, b) => a.map((x, i) => x - b[i]), add = (a, b) => a.map((x, i) => x + b[i]), scale = (a, k) => a.map((x) => x * k)
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (a) => scale(a, 1 / Math.hypot(...a))
const eye = [4, 3, 6], fwd = unit(sub([0, 0, 0], eye)), right = unit(cross(fwd, [0, 1, 0])), up = cross(right, fwd)
const W = 1280, H = 720, tanHalf = Math.tan(25 * Math.PI / 180)
// A point to its pixel (lesson 3.2), and a pixel back to a ray (lesson 4.1).
function toPixel(p) {
  const o = sub(p, eye), d = dot(o, fwd)
  return [(dot(o, right) / (d * tanHalf * W / H) + 1) / 2 * W, (1 - dot(o, up) / (d * tanHalf)) / 2 * H]
}
function rayAt(px, py) {
  const nx = px / W * 2 - 1, ny = 1 - py / H * 2
  return unit(add(add(scale(right, nx * tanHalf * W / H), scale(up, ny * tanHalf)), fwd))
}
// The point o + s·u of an axis closest to the ray from the eye along d.
function closestOnAxis(o, u, d) {
  const w = sub(o, eye), a = dot(u, u), b = dot(u, d), c = dot(d, d), dd = dot(u, w), e = dot(d, w)
  return (b * e - c * dd) / (a * c - b * b)
}
`;

const AXIS = `${BASE}
const origin = [0, 0, 0], X = [1, 0, 0]
const start = toPixel(origin)
const s0 = closestOnAxis(origin, X, rayAt(...start))
const s1 = closestOnAxis(origin, X, rayAt(start[0] + 120, start[1]))
console.log('the box\\'s origin is drawn at (' + start.map(r).join(', ') + ')')
console.log('grab: s = ' + r(s0) + '; after 120 px right: s = ' + r(s1) + '; move ' + r(s1 - s0) + ' along x')`;

const DEPENDS = `${BASE}
// The same 120 px drag does not always mean the same distance.
function drag(origin, axis, dx, dy) {
  const p = toPixel(origin)
  return closestOnAxis(origin, axis, rayAt(p[0] + dx, p[1] + dy)) - closestOnAxis(origin, axis, rayAt(...p))
}
console.log('x arrow, box at the origin: ' + r(drag([0, 0, 0], [1, 0, 0], 120, 0)))
console.log('x arrow, box twice as far away: ' + r(drag([-4, -3, -6], [1, 0, 0], 120, 0)))
console.log('z arrow, box at the origin: ' + r(drag([0, 0, 0], [0, 0, 1], 120, 0)))
console.log('y arrow, dragged 120 px up: ' + r(drag([0, 0, 0], [0, 1, 0], 0, -120)))`;

const PLANE = `${BASE}
// Moving in a plane (the ground, y = 0): where does the ray hit the plane? o + t·d with y = 0.
const p0 = toPixel([0, 0, 0])
for (const [name, dx, dy] of [['grab', 0, 0], ['120 px right', 120, 0], ['and 60 px down', 120, 60]]) {
  const d = rayAt(p0[0] + dx, p0[1] + dy), t = -eye[1] / d[1], hit = add(eye, scale(d, t))
  console.log(name + ': the ground at (' + hit.map(r).join(', ') + ')')
}`;

const SNAPPING = `// Snap: round to the nearest step. MeshLab's Snap uses 0.25 for moves, 15° for turns, 0.1 for scales.
const snap = (x, step) => Math.round(x / step) * step
console.log('move 1.261 → ' + snap(1.261, 0.25) + ';  move 1.38 → ' + snap(1.38, 0.25))
console.log('turn 37° → ' + snap(37, 15) + '°;  turn 38° → ' + snap(38, 15) + '°')
console.log('scale 1.234 → ' + +snap(1.234, 0.1).toFixed(1))`;

const PICTURE_CODE = `${BASE}
// The box, its x axis (red), and where 120 px to the right takes it (the ghost, amber).
const s1 = closestOnAxis([0, 0, 0], [1, 0, 0], rayAt(toPixel([0, 0, 0])[0] + 120, toPixel([0, 0, 0])[1]))
const verts = [], faces = [], groups = []
function box(c, h, g) {
  const k = verts.length
  for (const x of [-h[0], h[0]]) for (const y of [-h[1], h[1]]) for (const z of [-h[2], h[2]]) verts.push([c[0] + x, c[1] + y, c[2] + z])
  for (const q of [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]) { faces.push(q.map((i) => i + k)); groups.push(g) }
}
box([0, 0, 0], [0.5, 0.5, 0.5], 0)
box([s1, 0, 0], [0.5, 0.5, 0.5], 1)
box([0.5, 0, 0], [2.5, 0.03, 0.03], 4)
console.log('blue: the box; amber: where the drag puts it, ' + r(s1) + ' along x; red: the axis it is held to')
show({ verts, faces, groups, zoom: 1.3 })`;

const CHALLENGE = `// The x axis runs through the origin along (1, 0, 0). A pick ray starts at (2, 3, 5) and goes
// along (0.36, -0.48, -0.8). At what s is the point s·(1, 0, 0) of the axis closest to the ray?
const s = 0

console.log('closest at s = ' + s)`;

const SOLVED = CHALLENGE.replace('const s = 0', 'const s = 4.25');

/** The challenge's check: the closest-point parameter. */
export function checkClosest(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/^\s*const\s+s\s*=\s*(-?[\d.]+)\s*$/m);
  if (!m) return no('Keep the line const s = …, with a number.');
  const s = Number(m[1]);
  if (Math.abs(s - 4.25) < 0.01) return { pass: true, message: 'a = 1, b = u·d = 0.36, c = 1, w = o − e = (−2, −3, −5), d = u·w = −2, e = d·w = 4.72; s = (b·e − c·d) / (a·c − b²) = (1.6992 + 2) / 0.8704 = 4.25.' };
  if (s === 0) return no('Use s = (b·e − c·d) / (a·c − b²) with a = u·u, b = u·d, c = d·d, d = u·w, e = d·w, w = o − (ray start).');
  if (Math.abs(s - 2) < 0.01) return no('s = 2 is the ray\'s starting x. The ray also moves along x as it goes (0.36 per unit), so the closest point is further on.');
  if (Math.abs(s - (1.6992 - 2) / 0.8704) < 0.01) return no(`s = ${s}: check the sign of c·d. With d = u·w = −2, b·e − c·d = 1.6992 + 2, not 1.6992 − 2.`);
  if (Math.abs(s - 3.6992) < 0.01) return no('3.6992 is b·e − c·d; divide by a·c − b² = 1 − 0.1296 = 0.8704.');
  return no(`s = ${s} is not the closest point. a = 1, b = 0.36, c = 1, d = −2, e = 4.72.`);
}

export default {
  id: 'modelling-geometry-4-004',
  slug: 'dragging-with-a-gizmo',
  chapter: 'modelling-geometry',
  order: 4,
  title: 'Dragging with a gizmo',
  subtitle: 'The mouse moves on a flat screen; the object moves along one 3D axis. Closest points, planes, and snapping.',
  tags: ['gizmo', 'constraints', 'closest point', 'snapping', 'transform'],
  coreConcept: 'Dragging along an axis turns each mouse position into a pick ray and finds the axis point closest to it, s = (b·e − c·d)/(a·c − b²); the move is the change in s, so the same pixels give different distances depending on depth and on how the axis is seen. Dragging in a plane intersects the ray with the plane. Snapping rounds the result to a step.',
  prerequisites: ['modelling-geometry-4-001', 'modelling-geometry-2-001'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-4-005',

  hook: {
    question: 'You drag a gizmo\'s red arrow 120 pixels to the right. How far does the object move? It depends: on how far away it is, and on which way the arrow points on screen. What exactly is the rule?',
    realWorldContext: 'Every transform in a 3D tool, moving a chair, rotating a wheel, scaling a wall, is a 2D mouse motion turned into a constrained 3D change. Getting it right is what makes a gizmo feel as if the object were stuck to the mouse.',
  },

  intuition: {
    prose: [
      'A box sits at the origin; the camera is at $(4, 3, 6)$. You grab the box\'s red X arrow and drag $120$ pixels to the right. The box may only move along the $x$ axis: the line through it along $(1, 0, 0)$. Where does the mouse "point" on that line?',
      'Each mouse position is a pick ray (lesson 4.1). A ray and a line in 3D usually never meet, but they have a pair of **closest points**: where the segment joining them is at right angles to both. The closest point on the axis is where the mouse is, along it.',
      'Write the axis as $o + s\\,u$ and the ray as $e + t\\,d$. With $w = o - e$, $a = u \\cdot u$, $b = u \\cdot d$, $c = d \\cdot d$, $d_w = u \\cdot w$, $e_w = d \\cdot w$, the closest point is at $s = \\frac{b\\,e_w - c\\,d_w}{a\\,c - b^2}$. At the grab $s = 0$; after $120$ pixels $s = 1.261$. The box moves $1.261$ along $x$.',
      'Before running cell 2, predict: the box is twice as far away. Does the same $120$-pixel drag move it more or less?',
      'More: $2.522$. Things far away look small, so $120$ pixels covers more of the world there. And it depends on direction: the $z$ arrow, seen more end-on from this camera, moves $-1.797$ for the same drag. An arrow pointing straight at the eye cannot be dragged at all ($a\\,c - b^2 = 0$), which is why gizmos fade such arrows.',
      'To move freely in a **plane** (say the ground, $y = 0$), intersect the ray with the plane instead: $t = -e_y / d_y$, the hit $e + t\\,d$. Moving the mouse $120$ px right and $60$ px down moves the hit across the ground.',
      'Finally **snapping**: round the move to the nearest step. With MeshLab\'s Snap on, moves round to $0.25$, so $1.261$ becomes $1.25$; turns round to $15°$ and scales to $0.1$.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Drag along an axis or in a plane',
        body: 'Step 1. At the press, take the pick ray through the mouse (lesson 4.1).\nStep 2. Axis: find $s_0$, the closest point of the axis $o + s\\,u$ to the ray: $s = (b\\,e_w - c\\,d_w)/(a\\,c - b^2)$. Plane: find the ray\'s hit on the plane.\nStep 3. On each mouse move, take the new ray and find $s_1$ (or the new hit).\nStep 4. The move is $s_1 - s_0$ along $u$ (or the difference of the two hits).\nStep 5. With snap on, round the move to the nearest multiple of the step.\nStep 6. If $a\\,c - b^2 \\approx 0$ (the axis points at the eye), do nothing: there is no closest point.',
      },
      {
        type: 'warning',
        title: 'Pixels are not distances',
        body: 'Turning "120 pixels" into "1.2 units" with a fixed factor makes far objects crawl and near ones jump, and gets the direction wrong for axes that point into the screen. Always go through the ray.',
      },
      {
        type: 'warning',
        title: 'Snap the result, not the mouse',
        body: 'Round the move along the axis to the step, not the mouse position in pixels: a 0.25 step in the world is a different number of pixels at every depth.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: drawing the gizmo',
        body: 'The gizmo\'s arrows are drawn at a constant size on screen (scaled by distance, as in lesson 3.6) and on top of everything (no depth test). Its arrow colours follow convention: red x, green y, blue z. In Local axes mode (lesson 2.6) they follow the object\'s own axes, and the drag uses those as $u$.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "the object moves where the mouse moves". The amber ghost is where a 120-pixel drag puts the box: along the red axis only, 1.261 units, not wherever the pointer went in 3D. Invariant: its y and z do not change.',
      },
      { type: 'insight', title: 'Bridge: from the chain rule to code', body: 'rayAt() is Step 1; closestOnAxis() is Steps 2 and 3; the subtraction in cell 1 is Step 4; snap() in cell 4 is Step 5.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Dragging is all CPU work between frames: the new position goes into the object\'s matrix, and the next frame draws it there.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'MeshLab\'s gizmo is three.js\'s TransformControls, which does this with a plane through the axis; for an axis drag the two agree. Object › Trace a gizmo drag traces Steps 1 to 5 for the scene camera; in a script, camera.traceDrag(object, \'x\', dx, dy, snap).' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: constrained dragging',
        caption: 'Closest point on an axis, why the same pixels mean different distances, plane drags, snapping, and the result drawn.',
        props: {
          lesson: {
            title: 'Dragging with a gizmo',
            subtitle: 'Turn a 2D mouse motion into a move along one 3D axis.',
            cells: [
              { type: 'js', instruction: '### 1. Along the X arrow\nThe ray at the grab and after 120 px; the closest points on the axis; the move.', startCode: AXIS },
              { type: 'js', instruction: '### 2. Same pixels, different moves\nPredict first: twice as far away, more or less? Then other arrows.', startCode: DEPENDS },
              { type: 'js', instruction: '### 3. In a plane\nThe ray\'s hit on the ground as the mouse moves.', startCode: PLANE },
              { type: 'js', instruction: '### 4. Snapping\nRound the move, the turn or the scale to its step.', startCode: SNAPPING },
              { type: 'js', instruction: '### 5. See the drag\nThe box, the axis it is held to, and where 120 px puts it. Drag to turn the picture.', startCode: withPicture(PICTURE_CODE), showPreviewByDefault: true, outputHeight: 340 },
              { type: 'challenge', instruction: '### 6. Challenge: the closest point\nFind s for one ray and the x axis. The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkClosest },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Dragging with a gizmo" in MeshLab](#/lab/mesh-lab?project=gizmo-drag). With **Record traces** on, the script drags the box\'s X arrow 120 px on the camera\'s image, snapped to 0.25. In **Predict** mode, predict the move and the snapped move; compare with cell 1. Then drag the arrow yourself.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Move / Rotate / Scale** (toolbar, or G / R / S): the gizmo\'s mode. Drag an arrow for one axis, a square for a plane.\n- **Snap** (toolbar): moves in 0.25, turns in 15°, scales in 0.1.\n- **Local axes** (toolbar): the arrows follow the object\'s own axes (lesson 2.6).\n- **Object › Trace a gizmo drag** traces the X arrow\'s drag for the scene camera.\n- **In Blender:** G, R, S then X, Y or Z constrains to an axis (pressed twice for local); Shift+X etc. for a plane; hold Ctrl to snap.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Why the closest-point formula.** The segment between $o + s\\,u$ and $e + t\\,d$ is $w + s\\,u - t\\,d$. It is shortest when it is at right angles to both lines: $(w + s\\,u - t\\,d)\\cdot u = 0$ and $(w + s\\,u - t\\,d)\\cdot d = 0$. That is $a\\,s - b\\,t = -d_w$ and $b\\,s - c\\,t = -e_w$. Solving the pair (two equations, two unknowns) gives $s = (b\\,e_w - c\\,d_w)/(a\\,c - b^2)$.',
      '**Why the denominator vanishes.** $a\\,c - b^2 = |u|^2 |d|^2 - (u \\cdot d)^2 = |u \\times d|^2$ (lesson 2.1). It is $0$ exactly when the axis and the ray are parallel: the axis points along the line of sight.',
      '**Why far objects move further.** At depth $D$ a pixel spans about $2 D \\tan(\\theta/2) / H$ of world (lesson 3.2). Twice the depth, twice the world per pixel: the move doubles, $1.261 \\to 2.522$.',
      '**Why the plane hit.** A point $e + t\\,d$ is on the plane $y = 0$ when $e_y + t\\,d_y = 0$, so $t = -e_y/d_y$ (if $d_y \\ne 0$: a ray parallel to the ground never hits it).',
    ],
    equations: [
      { label: 'Closest point on an axis', latex: 's = \\frac{b\\,e_w - c\\,d_w}{a\\,c - b^2}, \\quad a = u \\cdot u, \\; b = u \\cdot d, \\; c = d \\cdot d, \\; d_w = u \\cdot w, \\; e_w = d \\cdot w, \\; w = o - e' },
      { label: 'Plane drag', latex: 't = -\\frac{e_y}{d_y}, \\quad \\text{hit} = e + t\\,d' },
      { label: 'Snap', latex: '\\operatorname{snap}(x) = \\text{step} \\cdot \\operatorname{round}(x / \\text{step})' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** For two non-parallel lines, the squared distance between their points is a strictly convex quadratic in $(s, t)$, so it has a unique minimum, given by the normal equations above. For parallel lines every $s$ is equally close and the drag is undefined.',
      '**Invariant viewpoint.** The move depends only on the two rays and the axis, not on how the camera got there: orbit the view and grab again and the same screen motion along the arrow gives the same move. Snapping makes results land on a fixed grid whatever the camera.',
      '**Geometric picture.** All the pick rays along a horizontal drag form a fan, a plane through the eye. Where that plane meets the axis line is the dragged point, and the closest-point construction finds it even when the mouse wanders off the arrow.',
      '**Where this goes.** The knife (lesson 4.5) uses the same plane through the eye. Rotation gizmos replace the axis by a circle and measure an angle round it; scale gizmos measure a ratio of distances from the centre.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-4-004-ex1',
      title: 'A ray straight down onto the x axis',
      problem: 'The x axis: $o = (0, 0, 0)$, $u = (1, 0, 0)$. A ray from $(3, 4, 0)$ along $(0, -1, 0)$. Where is it closest to the axis?',
      steps: [
        { expression: 'w = o - e = (-3, -4, 0)', annotation: 'From the ray\'s start to the axis\'s origin.' },
        { expression: 'a = 1, \\; b = 0, \\; c = 1, \\; d_w = -3, \\; e_w = 4', annotation: 'The dot products.' },
        { expression: 's = \\frac{0 \\cdot 4 - 1 \\cdot (-3)}{1 - 0} = 3', annotation: 'Step 2.' },
      ],
      conclusion: 'The ray crosses the axis at $s = 3$: the point $(3, 0, 0)$, straight below where it starts.',
    },
    {
      id: 'modelling-geometry-4-004-ex2',
      title: 'The lesson\'s drag',
      problem: 'The box at the origin, the camera at $(4, 3, 6)$; drag the X arrow $120$ pixels right. How far does it move, and with Snap?',
      steps: [
        { expression: 's_0 = 0', annotation: 'Step 2: the ray through the box\'s own pixel passes through its origin.' },
        { expression: 's_1 = 1.261', annotation: 'Step 3: the ray 120 px to the right.' },
        { expression: '\\text{move} = 1.261, \\quad \\operatorname{snap}_{0.25} = 1.25', annotation: 'Steps 4 and 5.' },
      ],
      conclusion: 'The box moves $1.261$ along $x$, or exactly $1.25$ with Snap on, as MeshLab\'s trace finds.',
    },
    {
      id: 'modelling-geometry-4-004-ex3',
      title: 'An arrow that points at you',
      problem: 'The camera looks straight down the $z$ axis. You grab the Z arrow. What happens?',
      steps: [
        { expression: 'u = (0, 0, 1) \\parallel d', annotation: 'Every pick ray near the centre runs nearly along z.' },
        { expression: 'a\\,c - b^2 = |u \\times d|^2 \\approx 0', annotation: 'Step 6: no closest point.' },
        { expression: '\\text{tiny mouse motions} \\to \\text{huge moves}', annotation: 'Near-parallel: s changes wildly; tools hide or fade the arrow.' },
      ],
      conclusion: 'An axis pointing at the eye cannot be dragged sensibly; orbit the view so the arrow is seen side-on, or drag in a plane instead.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-4-004-ch1',
      difficulty: 'easy',
      problem: 'With Snap on (0.25), a drag gives $0.87$. What move is used?',
      walkthrough: [{ expression: '0.25 \\cdot \\operatorname{round}(3.48) = 0.25 \\cdot 3 = 0.75', annotation: 'Round 0.87 / 0.25 = 3.48 to 3.' }],
      answer: '0.75: the nearest multiple of 0.25.',
    },
    {
      id: 'modelling-geometry-4-004-ch2',
      difficulty: 'medium',
      problem: 'A tool converts mouse pixels to world units with one fixed factor. Users say small far-away props barely move and close ones fly off. Explain and fix.',
      walkthrough: [
        { expression: '\\text{world per pixel} \\propto \\text{depth}', annotation: 'Lesson 3.2: size on screen is divided by distance.' },
        { expression: '\\text{fixed factor: wrong at every depth but one}', annotation: 'Far objects need more world per pixel, near ones less.' },
        { expression: '\\text{use the pick ray and the closest point on the axis}', annotation: 'Steps 1 to 4 adapt to depth and direction automatically.' },
      ],
      answer: 'The world distance one pixel covers grows with depth, so a fixed factor is too small for far objects and too large for near ones; compute the move from the pick rays and the closest points on the axis instead.',
    },
    {
      id: 'modelling-geometry-4-004-ch3',
      difficulty: 'hard',
      problem: 'Design "drag a vertex along the surface it is on" (slide on a face, not along an axis or a fixed plane). Which earlier techniques combine, and what can go wrong?',
      walkthrough: [
        { expression: '\\text{each mouse move: the pick ray (4.1) against the mesh}', annotation: 'Möller–Trumbore gives the hit point on the surface.' },
        { expression: '\\text{move the vertex to the hit (minus the grab offset)}', annotation: 'It follows the surface under the mouse.' },
        { expression: '\\text{exclude the vertex\'s own faces from the test}', annotation: 'Otherwise the ray hits the faces that are moving with it.' },
      ],
      answer: 'Cast the pick ray at every mouse move against the surface (lesson 4.1) and put the vertex at the hit, keeping the grab offset; exclude the faces the vertex itself is on, and handle the mouse leaving the surface (no hit) by keeping the last position.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'o + s\\,u', meaning: 'The axis the object is held to: its origin and direction.' },
      { symbol: 'e + t\\,d', meaning: 'The pick ray through the mouse.' },
      { symbol: 's = (b e_w - c d_w)/(a c - b^2)', meaning: 'Where on the axis the mouse is: the axis point closest to the ray.' },
      { symbol: 's_1 - s_0', meaning: 'The move along the axis since the grab.' },
      { symbol: 'a c - b^2 = |u \\times d|^2', meaning: 'Zero when the axis points at the eye: no drag possible.' },
      { symbol: '\\operatorname{snap}(x)', meaning: 'The move rounded to the nearest step (0.25, 15°, 0.1).' },
    ],
    rulesOfThumb: [
      'Go through the ray: never turn pixels into units with a fixed factor.',
      'An arrow pointing at you cannot be dragged: orbit or use a plane.',
      'Far things move more per pixel; that is correct.',
      'Snap the move in world units, not the mouse in pixels.',
      'Keep the grab offset: measure the change in s, not s itself.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-4-001', label: 'Picking by ray', note: 'The pick ray through the mouse, built the same way at every mouse move.' },
      { lessonId: 'modelling-geometry-2-001', label: 'Vectors, dot and cross', note: 'Dot products set up the closest-point equations; |u × d|² is the denominator.' },
      { lessonId: 'modelling-geometry-2-006', label: 'Local and global axes', note: 'In Local axes mode, u is the object\'s own axis.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-4-005', label: 'The knife', note: 'A dragged screen line becomes a plane through the eye, like the fan of drag rays.' },
      { lessonId: 'modelling-geometry-4-006', label: 'Undo and redo', note: 'A whole drag becomes one undo step.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-4-004-1', label: 'Read how a mouse position becomes a point on the axis', type: 'read' },
    { id: 'cp-modelling-geometry-4-004-2', label: 'Read why the same pixels give different moves', type: 'read' },
    { id: 'cp-modelling-geometry-4-004-3', label: 'Read plane drags and snapping', type: 'read' },
    { id: 'cp-modelling-geometry-4-004-4', label: 'Run cells 1 to 4: an axis drag, its dependence, a plane drag, snapping', type: 'lab' },
    { id: 'cp-modelling-geometry-4-004-5', label: 'Trace a gizmo drag in MeshLab in Predict mode, and drag the arrow yourself', type: 'lab' },
    { id: 'cp-modelling-geometry-4-004-6', label: 'Work through example 1, a ray onto the x axis', type: 'example' },
    { id: 'cp-modelling-geometry-4-004-7', label: 'Work through example 3, an arrow that points at you', type: 'example' },
    { id: 'cp-modelling-geometry-4-004-8', label: 'Complete the challenge: the closest point', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-4-004-assess-1',
        type: 'choice',
        text: 'The same 120-pixel drag moves a box 1.2 at the origin. The box is moved twice as far from the camera along its line of sight. Roughly how far does the drag move it now?',
        options: ['2.4', '1.2', '0.6', '4.8'],
        answer: '2.4',
        hint: 'World per pixel grows in proportion to depth.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-4-004-quiz-1',
      type: 'choice',
      text: 'During an axis drag, what decides where the mouse is along the axis?',
      options: ['The axis point closest to the pick ray', 'The mouse\'s x pixel times a factor', 'Where the ray hits the object', 'The nearest vertex'],
      answer: 'The axis point closest to the pick ray',
      hints: ['The ray and the axis rarely meet.', 'Their closest points always exist unless parallel.'],
      reviewSection: 'Intuition: the second paragraph',
    },
    {
      id: 'modelling-geometry-4-004-quiz-2',
      type: 'choice',
      text: 'When is a ⋅ c − b² zero?',
      options: ['When the axis is parallel to the ray', 'When the axis is at right angles to the ray', 'When the object is at the origin', 'When snap is on'],
      answer: 'When the axis is parallel to the ray',
      hints: ['a c − b² = |u × d|².', 'A cross product is zero for parallel vectors.'],
      reviewSection: 'Math: "Why the denominator vanishes"',
    },
    {
      id: 'modelling-geometry-4-004-quiz-3',
      type: 'choice',
      text: 'With Snap on, a turn of 38° becomes…',
      options: ['45°', '30°', '38°', '40°'],
      answer: '45°',
      hints: ['Turns snap to 15°.', '38 / 15 = 2.53 rounds to 3.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-4-004-quiz-4',
      type: 'choice',
      text: 'Which drag does NOT need the closest-point formula?',
      options: ['Dragging in a plane', 'Dragging the X arrow', 'Dragging the Y arrow', 'Dragging the Z arrow'],
      answer: 'Dragging in a plane',
      hints: ['A plane is hit by the ray directly.', 't = −e_y / d_y for the ground.'],
      reviewSection: 'Intuition: the plane paragraph',
    },
    {
      id: 'modelling-geometry-4-004-quiz-5',
      type: 'choice',
      text: 'Why do gizmos fade an arrow that points at the camera?',
      options: ['Dragging it is unstable: tiny mouse moves give huge moves', 'It cannot be drawn', 'It would hide the object', 'Snapping does not work on it'],
      answer: 'Dragging it is unstable: tiny mouse moves give huge moves',
      hints: ['a c − b² is near zero.', 'Example 3.'],
      reviewSection: 'Example 3',
    },
    {
      id: 'modelling-geometry-4-004-quiz-6',
      type: 'choice',
      text: 'In the lesson, 120 px right moves the box 1.261 along x but −1.797 along z. Why is the z move larger?',
      options: ['The z axis is seen more end-on, so a pixel spans more of it', 'z is a longer axis', 'The z arrow is drawn bigger', 'Snap was on for z'],
      answer: 'The z axis is seen more end-on, so a pixel spans more of it',
      hints: ['Foreshortened directions cover more world per pixel.', 'Cell 2.'],
      reviewSection: 'Intuition: the dependence paragraph, and cell 2',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'A drag of so many pixels always moves the object the same distance.',
      whyStudentsThinkIt: 'In 2D drawing tools it does.',
      correctionExample: '120 px moves the box 1.261 at the origin but 2.522 when it is twice as far away.',
      contrastCase: 'In an orthographic view (lesson 3.2) world per pixel is the same at every depth, so depth stops mattering.',
    },
    {
      falseBelief: 'The object jumps to wherever the mouse points in 3D.',
      whyStudentsThinkIt: 'It feels as if it follows the mouse.',
      correctionExample: 'Held to the x axis, the box only changes x: its y and z stay exactly as they were.',
      contrastCase: 'A free move (dragging in the view plane) does follow the mouse in two directions.',
    },
    {
      falseBelief: 'Snapping rounds the mouse position.',
      whyStudentsThinkIt: 'Snap feels like a grid on the screen.',
      correctionExample: 'The move along x, 1.261, is rounded to 1.25 in world units, at any depth.',
      contrastCase: 'Snapping to vertices or grid points does use the screen (lesson 4.2) to choose a target.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A level designer must slide a door along its track, which runs diagonally in the scene.',
      competingTechniques: ['Drag the door with the world X arrow, then correct Z by hand', 'Use the track direction as the axis u and drag along it'],
      whyThisTechniqueWins: 'The closest-point drag works for any direction u; using the track\'s own direction keeps the door on it exactly.',
    },
    {
      situation: 'A strategy game lets players drag units across uneven terrain.',
      competingTechniques: ['Intersect the ray with the plane y = 0', 'Cast the ray against the terrain mesh and use the hit'],
      whyThisTechniqueWins: 'A flat plane puts units under or over the hills; the terrain hit keeps them on the ground.',
    },
  ],

  debugging: [
    {
      commonError: 'Using the closest point s itself as the new position.',
      symptom: 'The object jumps when grabbed, unless grabbed exactly at its origin.',
      whyItHappened: 'The grab point is generally not the object\'s origin; only the change in s should be applied.',
      repairStrategy: 'Store s₀ at the press and move by s − s₀.',
    },
    {
      commonError: 'No guard for a c − b² ≈ 0.',
      symptom: 'The object shoots off to huge positions or NaN when an arrow points at the camera.',
      whyItHappened: 'Dividing by nearly zero.',
      repairStrategy: 'Ignore moves while |u × d| is tiny, and fade the arrow.',
    },
    {
      commonError: 'Snapping the mouse pixels.',
      symptom: 'Snapped moves land on different world values at different zooms.',
      whyItHappened: 'A pixel step is a different world step at each depth.',
      repairStrategy: 'Snap the world-space move.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Compute the closest point of an axis to a ray, a plane hit, and a snapped move for a drag.',
    explainVerbally: 'Explain why moves depend on depth and direction, and why axes pointing at the eye cannot be dragged.',
    detectIncorrectApplication: 'Recognise fixed-factor drags, grab jumps, division by near zero and pixel snapping.',
    transferToUnfamiliar: 'Drag along any direction (a track), on a surface, or across terrain.',
  },
};
