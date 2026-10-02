// Lesson 4.1: picking by ray. A click is a pixel; run the camera backwards to get a ray from the eye through it,
// test the ray against every triangle (Möller–Trumbore), and the nearest hit in front is what was clicked.
import { withPicture } from '../notebookScene.js';

// The scene: the camera at (0, 1.2, 6) looking at (0, 0.5, 0), fov 50°, a 1280 × 720 image; two boxes.
const BASE = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const f3 = (v) => v.map(r).join(', ')
const sub = (a, b) => a.map((x, i) => x - b[i]), add = (a, b) => a.map((x, i) => x + b[i]), scale = (a, k) => a.map((x) => x * k)
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (a) => scale(a, 1 / Math.hypot(...a))
const eye = [0, 1.2, 6], forward = unit(sub([0, 0.5, 0], eye)), right = unit(cross(forward, [0, 1, 0])), up = cross(right, forward)
const W = 1280, H = 720, tanHalf = Math.tan(25 * Math.PI / 180)
// A box as 8 corners and 6 square faces, wound so their normals point out.
function box(centre, size) {
  const h = size / 2, verts = []
  for (const x of [-h, h]) for (const y of [-h, h]) for (const z of [-h, h]) verts.push(add(centre, [x, y, z]))
  return { verts, faces: [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]] }
}
const front = box([0, 0.5, 1], 1), back = box([1, 0.8, -2], 1.6)
// Möller–Trumbore: where o + t·d meets triangle a, b, c; null for a miss.
function rayTriangle(o, d, a, b, c) {
  const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p)
  if (Math.abs(det) < 1e-12) return null                          // the ray runs along the triangle
  const s = sub(o, a), u = dot(s, p) / det
  if (u < 0 || u > 1) return null
  const q = cross(s, e1), v = dot(d, q) / det
  if (v < 0 || u + v > 1) return null
  const t = dot(e2, q) / det
  return t > 0 ? { t, u, v } : null                                // behind the eye does not count
}
`;

const RAY = `${BASE}
// Pixel (px, py), sampled at its centre, back to NDC (lesson 3.2 run backwards).
function ray(px, py) {
  const nx = (px + 0.5) / W * 2 - 1, ny = 1 - (py + 0.5) / H * 2
  // In camera space: through (nx · tan · aspect, ny · tan, −1). Then into the world with the camera's axes.
  const c = [nx * tanHalf * W / H, ny * tanHalf, -1]
  return { ndc: [nx, ny], dir: unit(add(add(scale(right, c[0]), scale(up, c[1])), scale(forward, -c[2]))) }
}
for (const [px, py] of [[639.5, 359.5], [790, 300]]) {
  const rr = ray(px, py)
  console.log('pixel (' + px + ', ' + py + '): ndc ' + f3(rr.ndc) + ', direction ' + f3(rr.dir))
}`;

const ONE = `${BASE}
// The centre ray against one triangle of the front box's front face (z = 1.5): the upper-left half.
// (The lower-right half, (-0.5, 0), (0.5, 0), (0.5, 1), gives u < 0: the ray passes beside it.)
const a = [-0.5, 0, 1.5], b = [0.5, 1, 1.5], c = [-0.5, 1, 1.5]
const e1 = sub(b, a), e2 = sub(c, a), p = cross(forward, e2), det = dot(e1, p)
console.log('edge1 ' + f3(e1) + ', edge2 ' + f3(e2) + ', det ' + r(det))
const hit = rayTriangle(eye, forward, a, b, c)
console.log('u ' + r(hit.u) + ', v ' + r(hit.v) + ', t ' + r(hit.t) + '; point ' + f3(add(eye, scale(forward, hit.t))))
console.log('the same point from u and v: ' + f3(add(a, add(scale(e1, hit.u), scale(e2, hit.v)))))`;

const NEAREST = `${BASE}
const nx = (790 + 0.5) / W * 2 - 1, ny = 1 - (300 + 0.5) / H * 2
const side = unit(add(add(scale(right, nx * tanHalf * W / H), scale(up, ny * tanHalf)), forward))
for (const [name, d] of [['centre', forward], ['pixel (790, 300)', side]]) {
  const hits = []
  for (const [label, m] of [['front', front], ['back', back]]) m.faces.forEach((f, fi) => {
    for (const [i, j] of [[1, 2], [2, 3]]) { const h = rayTriangle(eye, d, m.verts[f[0]], m.verts[f[i]], m.verts[f[j]]); if (h) hits.push(label + ' face ' + fi + ' at t = ' + r(h.t)) }
  })
  console.log(name + ': ' + hits.join('; '))
}`;

const PICTURE_CODE = `${BASE}
// The two boxes, the centre ray as a thin stick, and a small marker where it first hits.
const verts = [], faces = [], groups = []
const put = (m, g) => { const k = verts.length; verts.push(...m.verts); m.faces.forEach((f) => { faces.push(f.map((i) => i + k)); groups.push(g) }) }
put(front, 0); put(back, 1)
let best = null
for (const m of [front, back]) m.faces.forEach((f) => { for (const [i, j] of [[1, 2], [2, 3]]) { const h = rayTriangle(eye, forward, m.verts[f[0]], m.verts[f[i]], m.verts[f[j]]); if (h && (!best || h.t < best.t)) best = h } })
const hitPoint = add(eye, scale(forward, best.t))
// The ray: a long thin box from the eye along forward, built in the camera's own axes.
const along = (s, w) => add(eye, add(add(scale(right, w[0]), scale(up, w[1])), scale(forward, s)))
const k = verts.length, rw = 0.045
for (const s of [0, 5.8]) for (const [x, y] of [[-rw, -rw], [rw, -rw], [rw, rw], [-rw, rw]]) verts.push(along(s, [x, y]))
for (const q of [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) { faces.push(q.map((i) => i + k)); groups.push(4) }
put(box(hitPoint, 0.22), 2)
console.log('the ray (red) first hits the front box at ' + f3(hitPoint) + ', t = ' + r(best.t))
show({ verts, faces, groups, zoom: 1.9 })`;

const CHALLENGE = `// A ray starts at (0.2, 0.1, 4) and goes along (0, 0, -1).
// Triangle a = (-1, -1, 0), b = (1, -1, 0), c = (0, 1, 0).
// Where does it hit? Give [t, u, v] with the hit = (1 - u - v)·a + u·b + v·c = o + t·d.
const hit = [0, 0, 0]

console.log('t, u, v = ' + hit.join(', '))`;

const SOLVED = CHALLENGE.replace('const hit = [0, 0, 0]', 'const hit = [4, 0.325, 0.55]');

const RIGHT_HIT = [4, 0.325, 0.55];

/** The challenge's check: read [t, u, v] and name the slip. */
export function checkHit(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/^\s*const\s+hit\s*=\s*\[([^\]\n]*)\]/m);
  const parts = m ? m[1].split(',').map((s) => s.trim()) : [];
  if (parts.length !== 3 || !parts.every((s) => /^-?[\d.]+(\s*\/\s*[\d.]+)?$/.test(s))) return no('Keep const hit = [t, u, v] with three numbers or fractions.');
  const h = parts.map((s) => s.split('/').map(Number).reduce((a, b) => a / b));
  const near = (q) => q.every((x, i) => Math.abs(x - h[i]) < 0.005);
  if (near(RIGHT_HIT)) return { pass: true, message: 'The ray reaches z = 0 after t = 4, at (0.2, 0.1, 0). There (−1 + 2u + v, −1 + 2v) = (0.2, 0.1), so v = 0.55 and u = 0.325; u, v ≥ 0 and u + v = 0.875 ≤ 1: inside, a hit.' };
  if (h.every((x) => x === 0)) return no('Find t first (when does the ray reach z = 0?), then solve for u and v.');
  if (Math.abs(h[0] + 4) < 0.005) return no('t = −4 would be behind the start. The ray goes along (0, 0, −1), so from z = 4 it reaches z = 0 after +4.');
  if (Math.abs(h[0] - 4) < 0.005 && Math.abs(h[1] - 0.55) < 0.005 && Math.abs(h[2] - 0.325) < 0.005) return no('t is right, but u and v are swapped: u goes with b (along b − a = (2, 0, 0)) and v with c (along c − a = (1, 2, 0)).');
  if (Math.abs(h[0] - 4) < 0.005 && Math.abs(h[1] - 0.125) < 0.005) return no('t is right, but 0.125 is the weight of a, 1 − u − v. u is the weight of b.');
  if (Math.abs(h[0] - 4) >= 0.005) return no(`t = ${h[0]} does not reach the triangle's plane, z = 0: from z = 4 along (0, 0, −1) that takes t = 4.`);
  return no(`With t = 4 the hit is (0.2, 0.1, 0). Solve −1 + 2u + v = 0.2 and −1 + 2v = 0.1 for u and v.`);
}

export default {
  id: 'modelling-geometry-4-001',
  slug: 'picking-by-ray',
  chapter: 'modelling-geometry',
  order: 1,
  title: 'Picking by ray',
  subtitle: 'A click becomes a ray from the eye; the nearest triangle it hits is what you picked.',
  tags: ['picking', 'ray casting', 'Möller–Trumbore', 'ray–triangle', 'selection'],
  coreConcept: 'A clicked pixel is turned back into NDC and then into a ray from the eye (the projection run backwards); Möller–Trumbore solves o + t·d = (1 − u − v)a + u·b + v·c for each triangle, accepting t > 0, u, v ≥ 0, u + v ≤ 1; the hit with the smallest t is the surface under the mouse.',
  prerequisites: ['modelling-geometry-3-001', 'modelling-geometry-3-002', 'modelling-geometry-3-003'],
  timeToComplete: 45,
  nextLesson: 'modelling-geometry-4-002',

  hook: {
    question: 'You click a pixel. The tool has to say which of a thousand objects, and which of a million triangles, is under it. It only knows where the mouse is on a flat screen. How does it find the thing in 3D?',
    realWorldContext: 'Every click in a 3D tool or game, selecting an object, placing a building, aiming a shot, is a ray cast from the eye through the mouse. The same ray–triangle test powers ray tracing, collision checks and snapping to surfaces.',
  },

  intuition: {
    prose: [
      'The camera at $(0, 1.2, 6)$ looks at $(0, 0.5, 0)$; the image is $1280 \\times 720$. Lesson 3.2 took a 3D point to a pixel. Picking goes the other way: from a pixel to every 3D point that lands on it. Those points form a line from the eye through the pixel: a **ray**.',
      'Run lesson 3.2 backwards. Pixel $(790, 300)$, sampled at its centre, is at NDC $x = 790.5 / 1280 \\times 2 - 1 = 0.2352$ and $y = 1 - 300.5 / 720 \\times 2 = 0.1653$. In camera space the ray passes through $(0.2352 \\tan 25° \\times \\tfrac{16}{9}, \\; 0.1653 \\tan 25°, \\; -1)$. Turned into the world with the camera\'s axes (lesson 3.1), that is the ray\'s direction $d$. Its start $o$ is the eye.',
      'Now: where does the ray $o + t\\,d$ meet a triangle $a, b, c$? A point in the triangle is $(1 - u - v)\\,a + u\\,b + v\\,c$, with **barycentric** weights (lesson 3.3). Setting the two equal gives three equations (x, y, z) in three unknowns $t$, $u$, $v$.',
      'The **Möller–Trumbore** method solves them with cross and dot products: $e_1 = b - a$, $e_2 = c - a$, $p = d \\times e_2$, $\\det = e_1 \\cdot p$. Then $u = (o - a) \\cdot p / \\det$, and with $q = (o - a) \\times e_1$, $v = d \\cdot q / \\det$ and $t = e_2 \\cdot q / \\det$. It is Cramer\'s rule with the determinants written as triple products.',
      'The ray hits the triangle only if three tests pass: $u \\ge 0$, $v \\ge 0$ and $u + v \\le 1$ (inside), and $t > 0$ (in front of the eye, not behind). If $\\det$ is about $0$ the ray runs along the triangle\'s plane and never meets it.',
      'Before running cell 3, predict: the ray through the centre of the image hits the front box. How many triangles does it hit in all?',
      'Two: it goes into the front box through its front face and out through its back face. The pick is the hit with the **smallest** $t$: the nearest surface, the one the depth test (lesson 3.4) shows at that pixel. For the centre ray that is the front box, at $t = 4.5305$.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Pick by ray',
        body: 'Step 1. Pixel $(p_x, p_y)$ to NDC: $x = (p_x + 0.5)/W \\cdot 2 - 1$, $y = 1 - (p_y + 0.5)/H \\cdot 2$.\nStep 2. Camera-space direction $(x \\tan\\frac{\\theta}{2} \\cdot \\frac{W}{H}, \\; y \\tan\\frac{\\theta}{2}, \\; -1)$; turn it into the world with the camera\'s right, up, back; normalise. The ray starts at the eye.\nStep 3. For each triangle: $e_1 = b - a$, $e_2 = c - a$, $p = d \\times e_2$, $\\det = e_1 \\cdot p$; skip if $|\\det| \\approx 0$.\nStep 4. $s = o - a$, $u = s \\cdot p / \\det$; skip unless $0 \\le u \\le 1$. $q = s \\times e_1$, $v = d \\cdot q / \\det$; skip unless $v \\ge 0$ and $u + v \\le 1$.\nStep 5. $t = e_2 \\cdot q / \\det$; skip unless $t > 0$.\nStep 6. Keep the hit with the smallest $t$: its object and face are what was picked.',
      },
      {
        type: 'warning',
        title: 'Sample the pixel\'s centre, and flip y',
        body: 'Pixel rows count down from the top, NDC $y$ counts up (lesson 3.2). Forgetting the flip picks the mirror image of the click; forgetting the $+0.5$ picks half a pixel off, which matters on thin things.',
      },
      {
        type: 'warning',
        title: 'Hits behind the eye are not hits',
        body: 'The line through the eye and the pixel goes both ways. A triangle behind the camera gives $t < 0$; counting it picks something you cannot see.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: hover highlight',
        body: 'Highlighting what is under the mouse means casting this ray on every mouse move. With a million triangles that is too slow, so tools test a bounding box (or a tree of them, a BVH) first and only test triangles in boxes the ray crosses. Another way is to render object ids as colours into a hidden image and read the pixel under the mouse: one draw, no ray at all.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "a click is a point on the screen, so picking needs no 3D". The red ray runs from the eye into the front box; the small green marker is its first hit, and every point further along the ray lands on the very same pixel. Invariant: the pixel; only t changes along the ray.',
      },
      { type: 'insight', title: 'Bridge: from the chain rule to code', body: 'ray() in cell 1 is Steps 1 and 2; rayTriangle() is Steps 3 to 5; the loop in cell 3 keeps the smallest t, Step 6.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Picking runs on the CPU, between frames: the GPU has thrown away which triangle made which pixel. A ray against the same triangles the GPU drew recovers it.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Clicking in object mode picks objects, and in face select picks faces, with three.js\'s Raycaster (Möller–Trumbore). Object › Trace picking (camera, the image centre) traces Steps 1 to 6 for the scene camera; in a script, camera.tracePick(px, py).' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: a ray picker',
        caption: 'A pixel to a ray, Möller–Trumbore on one triangle, the nearest of all hits, and the ray drawn. Then pick in MeshLab.',
        props: {
          lesson: {
            title: 'Picking by ray',
            subtitle: 'Turn a click into a ray and find the first triangle it hits.',
            cells: [
              { type: 'js', instruction: '### 1. A pixel becomes a ray\nUndo the pixel mapping and the projection; the camera\'s axes give the direction in the world.', startCode: RAY },
              { type: 'js', instruction: '### 2. Möller–Trumbore on one triangle\nThe centre ray against the front box\'s front face: u, v, t, and the point both ways.', startCode: ONE },
              { type: 'js', instruction: '### 3. Every hit, and the nearest\nPredict first: how many triangles does the centre ray hit? Then a ray that misses the front box.', startCode: NEAREST },
              { type: 'js', instruction: '### 4. See the ray\nThe red ray from the eye; green marks its first hit. Drag to turn the picture.', startCode: withPicture(PICTURE_CODE), showPreviewByDefault: true, outputHeight: 340 },
              { type: 'challenge', instruction: '### 5. Challenge: one ray, one triangle\nGive t, u and v. The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkHit },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Picking by ray" in MeshLab](#/lab/mesh-lab?project=picking). With **Record traces** on, the script casts the ray through the centre of the camera\'s image: the ray, the triangles tested per box, Möller–Trumbore on the nearest hit. In **Predict** mode, predict t and the point. Compare with cell 2. Then click the back box where it shows.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Object mode:** click to select an object; Shift+click to add.\n- **Edit mode, face select (3):** click a face; the same ray, tested against that mesh\'s faces.\n- **Object › Trace picking (camera, the image centre)** traces the ray for the scene camera. In a script: camera.tracePick(px, py).\n- **In Blender:** click selects by the same ray; Alt+click lists every object under the mouse, to choose one behind another.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Why the ray is a straight line.** Every point that projects to one pixel satisfies $x_{\\text{ndc}} = x_c / w$ and $y_{\\text{ndc}} = y_c / w$ with $w = -z$ (lesson 3.2). For fixed NDC that is $x = x_{\\text{ndc}} \\tan\\frac{\\theta}{2} \\frac{W}{H} \\cdot (-z)$ and $y = y_{\\text{ndc}} \\tan\\frac{\\theta}{2} \\cdot (-z)$: as $-z$ grows, $x$ and $y$ grow in proportion. That is a line through the eye.',
      '**Why Möller–Trumbore works.** Write the equation as $-t\\,d + u\\,e_1 + v\\,e_2 = o - a = s$: a 3 × 3 system with columns $-d$, $e_1$, $e_2$. Cramer\'s rule divides determinants, and a 3 × 3 determinant is a triple product (lesson 2.4): $\\det[-d, e_1, e_2] = e_1 \\cdot (d \\times e_2)$. Replacing columns by $s$ gives $u = s \\cdot (d \\times e_2) / \\det$, $v = d \\cdot (s \\times e_1) / \\det$, $t = e_2 \\cdot (s \\times e_1) / \\det$.',
      '**Why the three inside tests.** $u$ and $v$ are the weights of $b$ and $c$, and $1 - u - v$ the weight of $a$. The point is inside the triangle exactly when all three weights are $\\ge 0$ (lesson 3.3): $u \\ge 0$, $v \\ge 0$, $u + v \\le 1$.',
      '**Why the smallest t.** For a unit direction, $t$ is the distance from the eye. Every hit lands on the same pixel; the nearest one hides the others, as the depth buffer decides when drawing.',
    ],
    equations: [
      { label: 'The ray', latex: 'p(t) = o + t\\,d, \\quad t > 0' },
      { label: 'Möller–Trumbore', latex: '\\det = e_1 \\cdot (d \\times e_2), \\quad u = \\frac{s \\cdot (d \\times e_2)}{\\det}, \\quad v = \\frac{d \\cdot (s \\times e_1)}{\\det}, \\quad t = \\frac{e_2 \\cdot (s \\times e_1)}{\\det}' },
      { label: 'Inside', latex: 'u \\ge 0, \\quad v \\ge 0, \\quad u + v \\le 1' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** For a non-degenerate triangle and a ray not parallel to its plane, the system $o + t d = a + u e_1 + v e_2$ has the unique solution given by Möller–Trumbore; the ray meets the closed triangle iff $u, v \\ge 0$, $u + v \\le 1$ and $t \\ge 0$. When $\\det = 0$ the ray is parallel to the plane and meets it nowhere or everywhere along a line; pickers treat both as a miss.',
      '**Invariant viewpoint.** The test is unchanged by moving and turning the whole scene with the ray (all its quantities are dot and cross products of differences). It depends on the triangle\'s winding only through the sign of $\\det$: a negative $\\det$ means the ray hits the back face, which a picker can keep or drop (back-face picking).',
      '**Geometric picture.** $\\det$ is the volume of the parallelepiped spanned by $d$, $e_1$ and $e_2$; $u$ and $v$ are ratios of such volumes with one edge replaced by $s$. Geometrically, they measure how far across the triangle the ray\'s footprint lands.',
      '**Where this goes.** Lesson 4.2 picks vertices and edges by screen distance, because a ray almost never hits a point or a line exactly. Lesson 4.5\'s knife uses the same idea in reverse: a screen line becomes a plane, intersected with edges. Ray tracers cast one such ray per pixel, and more for shadows and reflections.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-4-001-ex1',
      title: 'Straight down onto a triangle',
      problem: 'A ray from $(0.2, 0.3, 1)$ along $(0, 0, -1)$ meets the triangle $a = (0, 0, 0)$, $b = (1, 0, 0)$, $c = (0, 1, 0)$. Find $t$, $u$, $v$.',
      steps: [
        { expression: 'e_1 = (1, 0, 0), \\; e_2 = (0, 1, 0), \\; p = d \\times e_2 = (1, 0, 0)', annotation: 'Step 3: (0, 0, −1) × (0, 1, 0) = (1, 0, 0).' },
        { expression: '\\det = e_1 \\cdot p = 1', annotation: 'Not 0: the ray crosses the plane.' },
        { expression: 's = (0.2, 0.3, 1), \\; u = s \\cdot p / 1 = 0.2', annotation: 'Step 4.' },
        { expression: 'q = s \\times e_1 = (0, 1, -0.3), \\; v = d \\cdot q = 0.3, \\; t = e_2 \\cdot q = 1', annotation: 'Steps 4 and 5: inside (0.2 + 0.3 ≤ 1), in front (t = 1 > 0).' },
      ],
      conclusion: 'The ray hits at $t = 1$, the point $(0.2, 0.3, 0)$, with weights $u = 0.2$ for $b$ and $v = 0.3$ for $c$.',
    },
    {
      id: 'modelling-geometry-4-001-ex2',
      title: 'The centre of the image',
      problem: 'The ray through the centre of the lesson\'s image: which surface does it pick, and how far away?',
      steps: [
        { expression: '\\text{ndc} = (0, 0) \\Rightarrow d = \\text{forward} = (0, -0.1159, -0.9933)', annotation: 'Steps 1 and 2: the centre ray is the line of sight.' },
        { expression: '\\text{front box, front face } z = 1.5: \\; t = (6 - 1.5) / 0.99326 = 4.5305', annotation: 'The ray reaches z = 1.5 after 4.5305; there y = 1.2 − 0.1159 × 4.5305 = 0.675, inside the face.' },
        { expression: '\\text{front box, back face } z = 0.5: \\; t = 5.5373', annotation: 'It leaves through the back face.' },
        { expression: '\\min t = 4.5305', annotation: 'Step 6.' },
      ],
      conclusion: 'The centre ray picks the front box\'s front face at $t = 4.5305$, the point $(0, 0.675, 1.5)$, as cell 3 and MeshLab\'s trace find.',
    },
    {
      id: 'modelling-geometry-4-001-ex3',
      title: 'A miss, three ways',
      problem: 'For the triangle of example 1, does the ray from $(0.8, 0.8, 1)$ along $(0, 0, -1)$ hit? And from $(0.2, 0.3, -1)$ along $(0, 0, -1)$? And along $(1, 0, 0)$ from $(0, 0.2, 0)$?',
      steps: [
        { expression: 'u = 0.8, \\; v = 0.8, \\; u + v = 1.6 > 1', annotation: 'Outside: beyond the edge from b to c.' },
        { expression: 't = -1 < 0', annotation: 'The second ray starts below the plane and goes away from it: the plane is behind it.' },
        { expression: 'd \\times e_2 = (1, 0, 0) \\times (0, 1, 0) = (0, 0, 1), \\; \\det = e_1 \\cdot (0, 0, 1) = 0', annotation: 'The third ray runs along the plane: no single crossing.' },
      ],
      conclusion: 'Three different misses: outside ($u + v > 1$), behind ($t < 0$) and parallel ($\\det = 0$).',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-4-001-ch1',
      difficulty: 'easy',
      problem: 'Pixel $(0, 0)$ of a $100 \\times 100$ image: what are its NDC?',
      walkthrough: [
        { expression: 'x = 0.5 / 100 \\times 2 - 1 = -0.99', annotation: 'The left edge, half a pixel in.' },
        { expression: 'y = 1 - 0.5 / 100 \\times 2 = 0.99', annotation: 'The top edge: row 0 is at the top.' },
      ],
      answer: 'NDC (−0.99, 0.99): the top-left corner, half a pixel in from each edge.',
    },
    {
      id: 'modelling-geometry-4-001-ch2',
      difficulty: 'medium',
      problem: 'A picker keeps the FIRST triangle that passes the tests, not the nearest. Clicking a box in front of a wall sometimes selects the wall. Why?',
      walkthrough: [
        { expression: '\\text{triangles are tested in list order}', annotation: 'The wall may come first in the list.' },
        { expression: '\\text{the wall\'s hit has a bigger } t', annotation: 'It is behind the box, but it passes the tests too.' },
        { expression: '\\text{keep the smallest } t', annotation: 'Step 6: compare every hit\'s distance.' },
      ],
      answer: 'Every triangle the ray crosses passes the tests, in whatever order they are stored; only the smallest t is the visible one, so the picker must compare distances instead of stopping at the first hit.',
    },
    {
      id: 'modelling-geometry-4-001-ch3',
      difficulty: 'hard',
      problem: 'Clicking on a model of a million triangles takes half a second. Propose a change that keeps the exact same answer and say why it is exact.',
      walkthrough: [
        { expression: '\\text{test each object\'s bounding box first}', annotation: 'A ray that misses a box misses everything inside it.' },
        { expression: '\\text{split boxes into smaller boxes (a BVH)}', annotation: 'Then only the triangles in boxes the ray crosses are tested, about log n levels deep.' },
        { expression: '\\text{skip a box if its entry } t > \\text{best } t', annotation: 'Nothing inside it can be nearer than a hit already found.' },
      ],
      answer: 'Put the triangles in a tree of bounding boxes (a BVH) and test a box before its contents, skipping boxes the ray misses or that start further away than the best hit so far; it is exact because a ray that misses a box misses everything in it, and a box entered beyond the best t holds nothing nearer.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'o + t\\,d', meaning: 'The pick ray: from the eye o along the direction d; t is the distance for a unit d.' },
      { symbol: 'e_1, \\; e_2', meaning: 'Two edges of the triangle from corner a: b − a and c − a.' },
      { symbol: '\\det = e_1 \\cdot (d \\times e_2)', meaning: 'The system\'s determinant; near 0 means the ray runs along the triangle.' },
      { symbol: 'u, \\; v', meaning: 'The hit\'s barycentric weights of b and c (a gets 1 − u − v); inside means both ≥ 0 and u + v ≤ 1.' },
      { symbol: 't > 0', meaning: 'The hit is in front of the eye.' },
      { symbol: '\\min t', meaning: 'The nearest hit: what the click picked.' },
    ],
    rulesOfThumb: [
      'A click is a ray, not a point.',
      'Sample the pixel centre and flip y before anything else.',
      'Three tests: inside (u, v ≥ 0, u + v ≤ 1), in front (t > 0), not parallel (det ≠ 0).',
      'Keep the smallest t, not the first hit.',
      'Test bounding boxes before triangles when there are many.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-3-002', label: 'Projection', note: 'Pixel to NDC to camera space: the projection run backwards.' },
      { lessonId: 'modelling-geometry-3-003', label: 'Rasterization', note: 'Barycentric weights: u and v here are the same weights in 3D.' },
      { lessonId: 'modelling-geometry-2-004', label: 'The determinant', note: 'A 3 × 3 determinant as a triple product, used by Cramer\'s rule.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-4-002', label: 'Picking in screen space', note: 'Vertices and edges are too thin for a ray; they are picked by distance on screen.' },
      { lessonId: 'modelling-geometry-4-005', label: 'The knife', note: 'A screen line becomes a plane through the eye, intersected with edges.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-4-001-1', label: 'Read how a pixel becomes a ray from the eye', type: 'read' },
    { id: 'cp-modelling-geometry-4-001-2', label: 'Read the Möller–Trumbore steps and its three tests', type: 'read' },
    { id: 'cp-modelling-geometry-4-001-3', label: 'Read why the nearest hit is the one picked', type: 'read' },
    { id: 'cp-modelling-geometry-4-001-4', label: 'Run cells 1 to 3 and count the centre ray\'s hits', type: 'lab' },
    { id: 'cp-modelling-geometry-4-001-5', label: 'Trace picking in MeshLab in Predict mode, and click the back box', type: 'lab' },
    { id: 'cp-modelling-geometry-4-001-6', label: 'Work through example 1, straight down onto a triangle', type: 'example' },
    { id: 'cp-modelling-geometry-4-001-7', label: 'Work through example 3, a miss three ways', type: 'example' },
    { id: 'cp-modelling-geometry-4-001-8', label: 'Complete the challenge: one ray, one triangle', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-4-001-assess-1',
        type: 'choice',
        text: 'Möller–Trumbore gives u = 0.6, v = 0.5, t = 3. Is it a hit?',
        options: ['No: u + v = 1.1 > 1, outside the triangle', 'Yes: t > 0', 'Yes: u and v are positive', 'No: t should be negative'],
        answer: 'No: u + v = 1.1 > 1, outside the triangle',
        hint: 'All three tests must pass: u, v ≥ 0, u + v ≤ 1, t > 0.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-4-001-quiz-1',
      type: 'choice',
      text: 'Where does the pick ray start?',
      options: ['At the camera\'s eye', 'At the pixel on the screen', 'At the world origin', 'At the near plane\'s centre'],
      answer: 'At the camera\'s eye',
      hints: ['Every point that lands on the pixel is on a line through the eye.', 'Math: "Why the ray is a straight line".'],
      reviewSection: 'Intuition: the first paragraph',
    },
    {
      id: 'modelling-geometry-4-001-quiz-2',
      type: 'choice',
      text: 'Pixel (639.5, 359.5) of a 1280 × 720 image is at which NDC?',
      options: ['(0, 0)', '(0.5, 0.5)', '(1, 1)', '(-1, 1)'],
      answer: '(0, 0)',
      hints: ['Add 0.5, divide by the size, times 2, minus 1.', '640 / 1280 × 2 − 1 = 0.'],
      reviewSection: 'Procedure step 1',
    },
    {
      id: 'modelling-geometry-4-001-quiz-3',
      type: 'choice',
      text: 'What does det ≈ 0 mean in Möller–Trumbore?',
      options: ['The ray runs along the triangle\'s plane', 'The hit is at the eye', 'The triangle is behind the camera', 'The hit is exactly at a corner'],
      answer: 'The ray runs along the triangle\'s plane',
      hints: ['det = e1 · (d × e2).', 'It is 0 when d lies in the plane of e1 and e2.'],
      reviewSection: 'Intuition: the tests paragraph, and example 3',
    },
    {
      id: 'modelling-geometry-4-001-quiz-4',
      type: 'choice',
      text: 'A ray hits a box at t = 4.53 and t = 5.54, and a wall behind it at t = 8.9. Which is picked?',
      options: ['The box, at t = 4.53', 'The wall, at t = 8.9', 'The box, at t = 5.54', 'Whichever was tested first'],
      answer: 'The box, at t = 4.53',
      hints: ['The nearest hit is the visible one.', 'Smallest t.'],
      reviewSection: 'Procedure step 6',
    },
    {
      id: 'modelling-geometry-4-001-quiz-5',
      type: 'choice',
      text: 'Which of these is NOT a reason to reject a triangle in Möller–Trumbore?',
      options: ['det < 0', 'u < 0', 't < 0', 'u + v > 1'],
      answer: 'det < 0',
      hints: ['A negative det means the ray hits the triangle\'s back face.', 'It is still a crossing; only det ≈ 0 is a miss.'],
      reviewSection: 'Rigor: invariant viewpoint',
    },
    {
      id: 'modelling-geometry-4-001-quiz-6',
      type: 'choice',
      text: 'Why can\'t a tool just look up which triangle drew the pixel after rendering?',
      options: ['The GPU keeps colours and depth, not which triangle made each pixel', 'Pixels are too small', 'Rendering is too slow', 'Triangles have no ids'],
      answer: 'The GPU keeps colours and depth, not which triangle made each pixel',
      hints: ['What is left after a frame is an image.', 'An id buffer is the exception: a second render that stores ids as colours.'],
      reviewSection: 'Callout "The graphics strand: hover highlight"',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'A click is a point in 3D.',
      whyStudentsThinkIt: 'You click one place.',
      correctionExample: 'Pixel (790, 300) is the whole line from the eye through it: it crosses empty space, then the back box twice.',
      contrastCase: 'In a 2D drawing tool a click really is one point.',
    },
    {
      falseBelief: 'The first triangle found along the list is what you clicked.',
      whyStudentsThinkIt: 'Finding a hit feels like the answer.',
      correctionExample: 'The centre ray hits the front box twice (t = 4.53 and 5.54); a later triangle in the list can be nearer than an earlier one.',
      contrastCase: 'If the triangles were sorted front to back, the first hit would be the nearest; they never are.',
    },
    {
      falseBelief: 'A negative t is a hit on the other side of the object.',
      whyStudentsThinkIt: 't is just a number along the line.',
      correctionExample: 'In example 3 the ray from (0.2, 0.3, −1) gets t = −1: the triangle is behind where the ray starts, so nothing on screen is there.',
      contrastCase: 'The back face of the front box has t = 5.54 > 0: really along the ray, just hidden.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A city-builder game must place a building where the mouse points on uneven terrain.',
      competingTechniques: ['Use the mouse\'s screen position as x and z', 'Cast the pick ray and use the hit point on the terrain'],
      whyThisTechniqueWins: 'Screen x, y are not ground coordinates once the camera is tilted or the ground is hilly; the ray\'s nearest hit is the exact ground point under the mouse.',
    },
    {
      situation: 'A shooter needs to know whether a bullet fired from the gun hits a target model.',
      competingTechniques: ['Compare the target\'s centre with the aim direction', 'Cast a ray from the gun along its direction and test the target\'s triangles (inside a bounding box)'],
      whyThisTechniqueWins: 'The ray test is exact for any shape; the centre test misses thin limbs and hits empty space next to round ones.',
    },
  ],

  debugging: [
    {
      commonError: 'Forgetting to flip y from pixel rows to NDC.',
      symptom: 'Clicking near the top of the screen selects things near the bottom.',
      whyItHappened: 'Pixel rows grow downwards; NDC y grows upwards.',
      repairStrategy: 'Use y = 1 − (p_y + 0.5)/H · 2; test with the centre pixel and a corner.',
    },
    {
      commonError: 'Not normalising the ray direction, then reading t as a distance.',
      symptom: 'Distances to picked points are off by a constant factor, different for each pixel.',
      whyItHappened: 't is in units of the direction\'s length; only for a unit d is it a distance.',
      repairStrategy: 'Normalise d, or compute the distance as t·|d|.',
    },
    {
      commonError: 'Testing the mesh\'s local coordinates against a world-space ray.',
      symptom: 'Picking works for objects at the origin and misses moved or turned ones.',
      whyItHappened: 'The ray and the triangles must be in the same space.',
      repairStrategy: 'Move the vertices to world space with the object\'s world matrix, or move the ray into the object\'s space with its inverse.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Turn a pixel into a ray, run Möller–Trumbore by hand, and choose the nearest hit.',
    explainVerbally: 'Explain why a pixel is a line, how Möller–Trumbore is Cramer\'s rule, and why the smallest t wins.',
    detectIncorrectApplication: 'Recognise missing y flips, hits behind the eye, parallel rays and first-hit-not-nearest bugs.',
    transferToUnfamiliar: 'Place objects on terrain or test bullet hits with a ray, and speed it up with bounding boxes.',
  },
};
