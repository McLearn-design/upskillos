// Lesson 3.2: projection. Camera space to the image: the projection matrix makes clip coordinates with w = −z,
// the perspective divide gives normalised device coordinates (the cube −1 to 1), and those become pixels.
// Orthographic projection skips the shrinking: w stays 1.
import { withPicture } from '../notebookScene.js';

const BASE = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const f2 = (v) => v.map(r).join(', ')
// A perspective projection matrix (three.js and OpenGL): fov in degrees, aspect = width / height.
function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2 * Math.PI / 180)
  return [
    [f / aspect, 0, 0, 0],
    [0, f, 0, 0],
    [0, 0, (far + near) / (near - far), 2 * far * near / (near - far)],
    [0, 0, -1, 0],
  ]
}
const times = (P, p) => P.map((row) => row[0] * p[0] + row[1] * p[1] + row[2] * p[2] + row[3])
`;

const PINHOLE = `${BASE}
// A pinhole camera: a point at height y, at distance d in front, lands at height y / d on a screen 1 in front.
for (const d of [5, 10, 20]) console.log('a box 1 tall at distance ' + d + ' is ' + r(1 / d) + ' tall on the screen')
// The view's top edge is at angle fov / 2 above the line of sight: on that screen, at tan(fov / 2).
console.log('fov 50°: the screen is ' + r(2 * Math.tan(25 * Math.PI / 180)) + ' tall at distance 1; f = 1 / tan(25°) = ' + r(1 / Math.tan(25 * Math.PI / 180)))`;

const PIPELINE = `${BASE}
// The lesson 3.1 camera, fov 50°, a 1280 × 720 image, near 0.1, far 200.
const P = perspective(50, 1280 / 720, 0.1, 200)
P.forEach((row, i) => console.log('P row ' + (i + 1) + ': ' + f2(row)))
// The point (1, 0.5, 0) is at (0.7809, -0.2272, -6.2919) in that camera's space.
const clip = times(P, [0.7809, -0.2272, -6.2919, 1])
console.log('clip ' + f2(clip) + '   (w = −z = the distance in front)')
const ndc = clip.slice(0, 3).map((x) => x / clip[3])
console.log('ndc ' + f2(ndc))
const pixel = [(ndc[0] + 1) / 2 * 1280, (1 - ndc[1]) / 2 * 720]
console.log('pixel ' + pixel.map((x) => x.toFixed(1)).join(', '))`;

const ORTHO = `${BASE}
// Orthographic: a box of height h around the line of sight maps to −1..1; w stays 1, so there is no divide.
function orthographic(halfHeight, aspect, near, far) {
  const t = halfHeight, rr = t * aspect
  return [[1 / rr, 0, 0, 0], [0, 1 / t, 0, 0], [0, 0, -2 / (far - near), -(far + near) / (far - near)], [0, 0, 0, 1]]
}
const persp = perspective(50, 1, 0.1, 200), ortho = orthographic(3, 1, 0.1, 200)
// Two boxes 1 tall, straight ahead, at depths 5 and 10. Height on the image, in NDC units:
const height = (P, d) => { const lo = times(P, [0, 0, -d, 1]), hi = times(P, [0, 1, -d, 1]); return hi[1] / hi[3] - lo[1] / lo[3] }
console.log('perspective: ' + r(height(persp, 5)) + ' at 5, ' + r(height(persp, 10)) + ' at 10')
console.log('orthographic: ' + r(height(ortho, 5)) + ' at 5, ' + r(height(ortho, 10)) + ' at 10')
// Depth after the divide is not even: most of −1..1 is used up close to the near plane.
const depth = (z) => { const c = times(perspective(50, 1, 0.1, 200), [0, 0, z, 1]); return c[2] / c[3] }
console.log('perspective depth: ' + [0.1, 1, 10, 100, 200].map((d) => d + ' → ' + r(depth(-d))).join(', '))`;

const FRUSTUM = `${BASE}
// Left: the view volume in camera space (fov 50°, square, near 1, far 4), three small boxes in it.
// Right: the same, after the projection and the divide: the cube from −1 to 1.
const P = perspective(50, 1, 1, 4)
const toNdc = (p) => { const c = times(P, [...p, 1]); return [c[0] / c[3], c[1] / c[3], c[2] / c[3]] }
const verts = [], faces = [], groups = []
// A thin stick from a to b, as a box round the segment.
function stick(a, b, group) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len = Math.hypot(...u), n = u.map((x) => x / len)
  const v = Math.abs(n[1]) < 0.9 ? [n[2], 0, -n[0]] : [1, 0, 0], vl = Math.hypot(...v), vv = v.map((x) => x / vl * 0.06)
  const w = [n[1] * vv[2] - n[2] * vv[1], n[2] * vv[0] - n[0] * vv[2], n[0] * vv[1] - n[1] * vv[0]]
  const k = verts.length
  for (const p of [a, b]) for (const [s, t] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) verts.push(p.map((x, i) => x + s * vv[i] + t * w[i]))
  for (const q of [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) { faces.push(q.map((i) => i + k)); groups.push(group) }
}
// A box given its 8 corners (each already placed).
function solid(c, group) {
  const k = verts.length
  verts.push(...c)
  for (const q of [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]) { faces.push(q.map((i) => i + k)); groups.push(group) }
}
const shift = (dx) => (p) => [p[0] + dx, p[1], p[2]]
// The frustum's 8 corners, and the cube's: drawn as 12 sticks each.
const t = Math.tan(25 * Math.PI / 180), corner = (z, sx, sy) => [sx * t * z, sy * t * z, -z]
const fr = [1, 4].flatMap((z) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => corner(z, sx, sy)))
const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]
for (const [a, b] of edges) stick(shift(-2.5)(fr[a]), shift(-2.5)(fr[b]), 7)
for (const [a, b] of edges) stick(shift(2.5)(toNdc(fr[a])), shift(2.5)(toNdc(fr[b])), 7)
// Three boxes 0.6 across at depths 1.5, 2.5 and 3.5, in both pictures.
for (const [i, z] of [1.5, 2.5, 3.5].entries()) {
  const c = []
  for (const x of [-0.3, 0.3]) for (const y of [-0.3, 0.3]) for (const dz of [-0.2, 0.2]) c.push([x, y, -z + dz])
  solid(c.map(shift(-2.5)), i)
  solid(c.map((p) => shift(2.5)(toNdc(p))), i)
}
const w = (z) => { const n = toNdc([0.3, 0, -z]); return r(2 * n[0]) }
console.log('after the divide the boxes are ' + [1.5, 2.5, 3.5].map(w).join(', ') + ' wide: the far ones are squeezed')
show({ verts, faces, groups, zoom: 1.8 })`;

const CHALLENGE = `// A camera with a 60° field of view renders an 800 × 600 image.
// A point is at (1, 0.5, -4) in its camera space. Which pixel does it land on?
// (Pixel (0, 0) is the top-left corner. Write numbers or arithmetic; you may define
// const f = … and aspect = … first, on one line.)
const pixel = [0, 0]

console.log('pixel ' + pixel.join(', '))`;

const SOLVED = CHALLENGE.replace('const pixel = [0, 0]', `const f = 1 / Math.tan(30 * Math.PI / 180), aspect = 800 / 600
const pixel = [(f / aspect * 1 / 4 + 1) / 2 * 800, (1 - f * 0.5 / 4) / 2 * 600]`);

const F60 = 1 / Math.tan(Math.PI / 6);
const NDC = [F60 / (4 / 3) / 4, F60 * 0.5 / 4];
const PX = [(NDC[0] + 1) / 2 * 800, (1 - NDC[1]) / 2 * 600];

/** The challenge's check: work out the learner's pixel (numbers, or arithmetic with Math and f and aspect) and name the mistake. */
export function checkPixel(code) {
  const no = (message) => ({ pass: false, message });
  // Only real code lines, not the comment that mentions them.
  const fm = code.match(/^\s*const\s+f\s*=\s*([^,\n]+)/m), am = code.match(/^\s*(?:const\s+f\s*=[^,\n]+,\s*|const\s+)aspect\s*=\s*([^,\n]+)/m);
  const m = code.match(/^\s*const\s+pixel\s*=\s*\[([^\n]*)\]/m);
  if (!m) return no('Keep the line const pixel = [x, y].');
  const safe = (e) => /^[\w\s.+\-*/(),]*$/.test(e) && !/\b(?!Math\b|PI\b|tan\b|sin\b|cos\b|atan\b|f\b|aspect\b)[A-Za-z_]\w*/.test(e);
  const parts = [fm?.[1], am?.[1], m[1]].filter(Boolean);
  if (!parts.every(safe)) return no('Write the pixel with numbers and arithmetic (Math.tan, f, aspect), nothing else.');
  let p;
  try {
    const f = fm ? Function('Math', `"use strict"; return (${fm[1]});`)(Math) : undefined;
    const aspect = am ? Function('Math', `"use strict"; return (${am[1]});`)(Math) : undefined;
    p = Function('Math', 'f', 'aspect', `"use strict"; return [${m[1]}];`)(Math, f, aspect);
  } catch { return no('The pixel could not be worked out: check the brackets.'); }
  if (!Array.isArray(p) || p.length !== 2 || !p.every((x) => typeof x === 'number' && Number.isFinite(x))) return no('The pixel should be two numbers, [x, y].');
  const near = (q) => Math.abs(p[0] - q[0]) < 0.5 && Math.abs(p[1] - q[1]) < 0.5;
  const fmt = (q) => `(${q.map((x) => +x.toFixed(1)).join(', ')})`;
  if (near(PX)) return { pass: true, message: `${fmt(p)}: f = 1 / tan 30° = 1.732; x = (f / aspect) × 1 / 4 = 0.325 and y = f × 0.5 / 4 = 0.217 after dividing by w = 4; then (0.325 + 1) / 2 × 800 and (1 − 0.217) / 2 × 600.` };
  if (p[0] === 0 && p[1] === 0) return no('Work the pixel out: f from the field of view, the divide by w = 4, then the pixel formulas.');
  if (near([(F60 / 4 + 1) / 2 * 800, PX[1]])) return no(`${fmt(p)}: x was not divided by the aspect ratio (800 / 600). Without it, the wider image squashes everything sideways.`);
  if (near([(F60 / (4 / 3) + 1) / 2 * 800, (1 - F60 * 0.5) / 2 * 600])) return no(`${fmt(p)}: there was no perspective divide. The point is 4 in front, so w = 4: divide x and y by it.`);
  if (near([PX[0], (1 + NDC[1]) / 2 * 600])) return no(`${fmt(p)}: y is upside down. Pixel rows count down from the top, so use (1 − y) / 2 × 600.`);
  if (near([(1 - NDC[0]) / 2 * 800, (1 + NDC[1]) / 2 * 600])) return no(`${fmt(p)}: the point is mirrored through the centre: w is −z = 4, not z = −4.`);
  const F120 = 1 / Math.tan(Math.PI / 3);
  if (near([(F120 / (4 / 3) / 4 + 1) / 2 * 800, (1 - F120 * 0.5 / 4) / 2 * 600])) return no(`${fmt(p)}: f used all 60°. f = 1 / tan of HALF the field of view, 30°.`);
  return no(`${fmt(p)} is not where the point lands. Check each step: f = 1 / tan 30°, x by f / aspect and y by f, divide both by w = 4, then the pixel formulas.`);
}

export default {
  id: 'modelling-geometry-3-002',
  slug: 'projection',
  chapter: 'modelling-geometry',
  order: 2,
  title: 'Projection',
  subtitle: 'From camera space to pixels: the projection matrix, clip space, the divide by w, and the cube from −1 to 1.',
  tags: ['projection', 'perspective divide', 'clip space', 'NDC', 'orthographic'],
  coreConcept: 'The projection matrix scales x and y by f = 1 / tan(fov/2) (and x by 1/aspect) and copies the distance −z into w; dividing by w makes far things small and puts everything visible in the cube from −1 to 1, which then maps to pixels. Orthographic projection keeps w = 1, so nothing shrinks.',
  prerequisites: ['modelling-geometry-3-001'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-3-003',

  hook: {
    question: 'Two identical boxes, one twice as far away: why is the far one drawn half as tall, and how does a single matrix make that happen?',
    realWorldContext: 'Every 3D picture on a screen is made by the same three steps: a projection matrix, a divide, and a mapping to pixels. Field of view, aspect ratio, the near and far planes, and the switch to orthographic views in modelling tools are all numbers in that one matrix.',
  },

  intuition: {
    prose: [
      'Hold a screen $1$ unit in front of your eye. A box $1$ tall, $5$ units away, covers $1 / 5 = 0.2$ of that screen\'s height. At $10$ away it covers $0.1$; at $20$, $0.05$. This is similar triangles: a point at height $y$ and **distance** $d$ in front lands at height $y / d$ on the screen. Twice as far, half as big.',
      'In camera space (lesson 3.1) the distance in front is $d = -z$, because the camera looks down $-z$. So the screen position is $(x / (-z), \\; y / (-z))$. Dividing by the distance is the **perspective divide**.',
      'The **field of view** $\\theta$ is the angle from the bottom edge of the view to the top. The top edge is at angle $\\theta / 2$ above the line of sight, so on the screen at distance $1$ it is at height $\\tan(\\theta / 2)$. For $\\theta = 50°$ that is $0.4663$.',
      'Graphics wants the view\'s edges at $\\pm 1$, not $\\pm 0.4663$. So it multiplies by $f = 1 / \\tan(\\theta / 2) = 2.1445$. The image is wider than tall by the **aspect** ratio $a$ (width ÷ height), so $x$ is also divided by $a$: then the left and right edges land at $\\pm 1$ too.',
      'Before running cell 2, predict: the point $(0.7809, -0.2272, -6.2919)$ in camera space is $6.29$ in front. Is it left or right of centre on the image? Above or below?',
      'A matrix cannot divide. So the **projection matrix** $P$ does everything except the divide, and saves the distance for later: its last row copies $-z$ into a fourth number $w$. The result $(x_c, y_c, z_c, w)$ is a point in **clip space**. For our point: $(0.942, -0.487, 6.098, 6.292)$.',
      'The GPU then divides $x_c$, $y_c$, $z_c$ by $w$. The result is in **normalised device coordinates** (NDC): everything the camera can see lies in the cube from $-1$ to $1$ on all three axes. Our point is at $(0.1497, -0.0774, 0.9692)$: a little right of centre and a little below. Finally, $x$ from $-1$ to $1$ becomes $0$ to the image width, and $y$ becomes the height to $0$: pixel $(735.8, 387.9)$ on a $1280 \\times 720$ image.',
      'The third row of $P$ maps depth too: the **near** plane goes to $-1$ and the **far** plane to $1$. After the divide this is not even: with near $0.1$ and far $200$, a point just $1$ away already has depth $0.80$. Lesson 3.4 shows why that matters.',
      'An **orthographic** projection leaves out the shrinking: its last row is $(0, 0, 0, 1)$, so $w = 1$ and the divide does nothing. A box looks the same size at any distance, and parallel lines stay parallel on screen. Modelling tools use it for front, side and top views, where you want to measure, not to feel depth.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Project a camera-space point to a pixel',
        body: 'Step 1. Compute $f = 1 / \\tan(\\theta / 2)$ from the vertical field of view $\\theta$, and $a = $ width ÷ height.\nStep 2. Clip coordinates: $x_c = (f / a)\\, x$, $y_c = f\\, y$, $z_c = \\frac{F + N}{N - F} z + \\frac{2 F N}{N - F}$, $w = -z$ (near $N$, far $F$).\nStep 3. If $w \\le 0$ the point is behind the camera: stop.\nStep 4. Divide: NDC $= (x_c / w, \\; y_c / w, \\; z_c / w)$. Visible if all three are between $-1$ and $1$.\nStep 5. Pixel $= \\big( (x + 1) / 2 \\times \\text{width}, \\; (1 - y) / 2 \\times \\text{height} \\big)$.\nStep 6. For orthographic, replace Step 2 with $x_c = x / (h a)$, $y_c = y / h$ for a view of half-height $h$, and $w = 1$.',
      },
      {
        type: 'warning',
        title: 'Half the field of view, and the aspect only on x',
        body: '$f$ uses $\\tan(\\theta / 2)$, not $\\tan \\theta$: the edge is half the angle from the line of sight. And only $x$ is divided by the aspect ratio, because three.js and MeshLab give the vertical field of view. Mixing these up stretches or shrinks the whole image.',
      },
      {
        type: 'warning',
        title: 'Pixel rows count down',
        body: 'In NDC $+y$ is up. In an image, row $0$ is the top. So the pixel row is $(1 - y) / 2 \\times$ height, not $(1 + y) / 2$; forgetting it draws the scene upside down.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: clip space and NDC',
        body: 'A vertex shader\'s one job is to output a clip-space position: gl_Position $= P V M \\, v$. The GPU then clips triangles against $-w \\le x_c, y_c, z_c \\le w$ (cutting off what is outside the view), divides by $w$, and maps NDC to pixels. Everything after this is per pixel (lesson 3.3).',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "projection just drops the z coordinate". Left, the view volume (a cut-off pyramid, the frustum) with three equal boxes at depths 1.5, 2.5 and 3.5. Right, the same after the projection and divide: the frustum becomes a cube, and the far boxes are squeezed narrower and flatter. Invariant: straight lines stay straight, and the boxes keep their left-to-right and front-to-back order.',
      },
      { type: 'insight', title: 'Bridge: from the chain rule to code', body: 'perspective() in the cells is the matrix of Step 2; times() then dividing by clip[3] is Steps 2 to 4; the pixel line is Step 5.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Only Step 2 runs in the vertex shader (as part of $P V M v$); the GPU\'s fixed hardware does the clipping, the divide and the pixel mapping (the viewport transform).' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Object › Trace the projection (camera) runs Steps 1 to 5 for the first mesh\'s origin on the render size. View › Orthographic / perspective (5) switches the viewport; Front, Right and Top switch to orthographic by themselves.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: from camera space to pixels',
        caption: 'Similar triangles, the projection matrix, the divide, orthographic, and the frustum squeezed into a cube. Then do it in MeshLab.',
        props: {
          lesson: {
            title: 'Projection',
            subtitle: 'Build the projection matrix, divide by w, map to pixels, and compare orthographic.',
            cells: [
              { type: 'js', instruction: '### 1. A pinhole\nSimilar triangles: height y at distance d lands at y / d. Twice as far, half as tall.', startCode: PINHOLE },
              { type: 'js', instruction: '### 2. Matrix, divide, pixel\nPredict first: is the point left or right of centre, above or below? Then follow it through.', startCode: PIPELINE },
              { type: 'js', instruction: '### 3. Orthographic, and uneven depth\nIn perspective the far box is half as tall; in orthographic both are the same. Depth after the divide crowds towards 1.', startCode: ORTHO },
              { type: 'js', instruction: '### 4. The frustum becomes a cube\nLeft: the view volume in camera space, with three equal boxes. Right: after the divide. Drag to turn the picture.', startCode: withPicture(FRUSTUM), showPreviewByDefault: true, outputHeight: 340 },
              { type: 'challenge', instruction: '### 5. Challenge: which pixel?\nProject a camera-space point onto an 800 × 600 image with a 60° field of view. The check names the step that went wrong.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkPixel },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Projection" in MeshLab](#/lab/mesh-lab?project=projection). Two equal boxes, near and far, measured on the camera\'s image; then **Object › Trace the projection (camera)** follows (1, 0.5, 0) to a pixel with **Record traces** on. In **Predict** mode, predict the normalised coordinates and the pixel. Compare with cell 2.' },
              { type: 'markdown', instruction: '### Use the tool\n- **View › Orthographic / perspective (5):** switch the viewport. Front, Right and Top switch to orthographic by themselves; Perspective switches back.\n- The camera\'s **Field of view** (Inspector) is vertical, in degrees; the horizontal one follows from the render size.\n- **Object › Trace the projection (camera)** traces the matrix, the clip coordinates, the divide and the pixel.\n- In a script: camera.traceProjection([x, y, z]) returns clip, ndc and pixel.\n- **In Blender:** Numpad 5 toggles orthographic; the Numpad 1, 3 and 7 views switch to orthographic by themselves (Auto Perspective). A camera\'s lens is set as a focal length in millimetres, which is the same thing as a field of view.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Why dividing by the distance is right.** The eye, the point $(y, d)$ and its image $(y\', 1)$ on the screen at distance $1$ lie on one line through the eye. Two similar right triangles share the angle at the eye: $y\' / 1 = y / d$. So $y\' = y / d$.',
      '**Why $f$ puts the edges at $\\pm 1$.** A point on the top edge of the view is at angle $\\theta / 2$, so $y / d = \\tan(\\theta / 2)$. Then $f \\, y / d = \\tan(\\theta / 2) / \\tan(\\theta / 2) = 1$. The same with $x$, $\\theta$ replaced by the horizontal field of view, gives the factor $f / a$.',
      '**Why $w = -z$ does the divide.** The fourth row of $P$ is $(0, 0, -1, 0)$, so $w = -z = d$. The GPU always divides $x_c, y_c, z_c$ by $w$. So $x_c / w = (f / a)\\, x / d$, exactly the pinhole formula scaled to the edges.',
      '**Why near maps to $-1$ and far to $+1$.** $z_c / w = \\big( \\frac{F + N}{N - F} z + \\frac{2 F N}{N - F} \\big) / (-z)$. At $z = -N$ this is $\\frac{-(F + N) N + 2 F N}{(N - F) N} = \\frac{F N - N^2}{(N - F) N} = -1$. At $z = -F$ the same algebra gives $1$. In between it goes as $1 / z$, so it is not evenly spread.',
    ],
    equations: [
      { label: 'Perspective projection', latex: 'P = \\begin{pmatrix} f / a & 0 & 0 & 0 \\\\ 0 & f & 0 & 0 \\\\ 0 & 0 & \\frac{F + N}{N - F} & \\frac{2 F N}{N - F} \\\\ 0 & 0 & -1 & 0 \\end{pmatrix}, \\quad f = \\frac{1}{\\tan(\\theta / 2)}' },
      { label: 'Divide and pixels', latex: '\\text{ndc} = \\frac{(x_c, y_c, z_c)}{w}, \\qquad \\text{pixel} = \\Big( \\frac{x + 1}{2} W, \\; \\frac{1 - y}{2} H \\Big)' },
      { label: 'Orthographic', latex: 'x_c = \\frac{x}{h a}, \\quad y_c = \\frac{y}{h}, \\quad w = 1' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** A perspective projection is a projective map: it acts linearly on homogeneous coordinates $(x, y, z, 1)$ and becomes non-linear only through the division by $w$. It sends lines to lines and planes to planes (where $w > 0$), so triangles stay triangles, and it sends the frustum $\\{ N \\le -z \\le F, \\; |x|, |y| \\le \\text{edges} \\}$ onto the cube $[-1, 1]^3$.',
      '**Invariant viewpoint.** Straightness and incidence survive projection; lengths, angles and ratios of lengths do not (the far box shrinks). What survives is the cross-ratio of four points on a line. Orthographic projection is affine instead: it also keeps ratios along a line and parallelism.',
      '**Geometric picture.** Homogeneous coordinates treat $(x, y, z, w)$ and $(kx, ky, kz, kw)$ as the same point. The matrix moves points in 4D; the divide picks the representative with $w = 1$. A perspective camera is a pyramid of rays through the eye; an orthographic one is a box of parallel rays, the limit as the eye moves infinitely far away while the field of view shrinks.',
      '**Where this goes.** Interpolating values across a projected triangle must undo the divide, or textures swim: perspective-correct interpolation (lesson 3.3). The uneven depth leads to depth precision and z-fighting (lesson 3.4). Picking (lesson 4.1) runs this pipeline backwards, from a pixel to a ray.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-3-002-ex1',
      title: 'A point straight ahead',
      problem: 'A $90°$ camera with a square image ($a = 1$), $W = H = 100$, sees the camera-space point $(0, 0, -5)$. Which pixel?',
      steps: [
        { expression: 'f = 1 / \\tan 45° = 1', annotation: 'Step 1: half of 90° is 45°, whose tangent is 1.' },
        { expression: 'x_c = 0, \\; y_c = 0, \\; w = 5', annotation: 'Step 2: x and y are 0; w = −z = 5.' },
        { expression: '\\text{ndc} = (0, 0, \\ldots)', annotation: 'Step 4: 0 / 5 = 0.' },
        { expression: '\\big( (0 + 1) / 2 \\times 100, \\; (1 - 0) / 2 \\times 100 \\big) = (50, 50)', annotation: 'Step 5: the centre of the image.' },
      ],
      conclusion: 'A point on the line of sight lands in the middle of the image, at any distance.',
    },
    {
      id: 'modelling-geometry-3-002-ex2',
      title: 'The lesson\'s point',
      problem: 'The camera-space point $(0.7809, -0.2272, -6.2919)$, fov $50°$, $1280 \\times 720$, near $0.1$, far $200$. Find its pixel.',
      steps: [
        { expression: 'f = 2.1445, \\; a = 1.7778, \\; f / a = 1.2063', annotation: 'Step 1.' },
        { expression: 'x_c = 1.2063 \\times 0.7809 = 0.942, \\; y_c = 2.1445 \\times (-0.2272) = -0.487, \\; w = 6.292', annotation: 'Step 2 (z_c = 6.098 for depth).' },
        { expression: '\\text{ndc} = (0.942 / 6.292, \\; -0.487 / 6.292, \\; 6.098 / 6.292) = (0.1497, -0.0774, 0.9692)', annotation: 'Step 4: all inside −1..1, so it is visible.' },
        { expression: '\\big( 1.1497 / 2 \\times 1280, \\; 1.0774 / 2 \\times 720 \\big) = (735.8, 387.9)', annotation: 'Step 5: a little right of centre (640) and a little below (360).' },
      ],
      conclusion: 'The point lands at pixel $(735.8, 387.9)$, as MeshLab\'s trace and three.js both give.',
    },
    {
      id: 'modelling-geometry-3-002-ex3',
      title: 'Perspective or orthographic for a measurement',
      problem: 'Two posts, each $1$ tall, stand $5$ and $10$ in front of the camera. On a $50°$ perspective view, and on an orthographic view of half-height $3$, how tall is each in NDC?',
      steps: [
        { expression: '\\text{perspective: } f \\times 1 / 5 = 0.4289, \\quad f \\times 1 / 10 = 0.2145', annotation: 'Step 2 then Step 4: the divide by w = 5 or 10 halves the far one.' },
        { expression: '\\text{orthographic: } 1 / 3 = 0.3333 \\text{ at both}', annotation: 'Step 6: y_c = y / h and w = 1, so distance makes no difference.' },
        { expression: '\\text{ratio of heights: perspective } 2, \\; \\text{orthographic } 1', annotation: 'Only orthographic lets you compare sizes on screen directly.' },
      ],
      conclusion: 'In orthographic views equal things look equal wherever they are, which is why front, side and top views use it.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-3-002-ch1',
      difficulty: 'easy',
      problem: 'A point has clip coordinates $(2, -1, 3, 4)$. What are its normalised device coordinates, and is it visible?',
      walkthrough: [
        { expression: '(2 / 4, \\; -1 / 4, \\; 3 / 4) = (0.5, -0.25, 0.75)', annotation: 'Step 4: divide by w = 4.' },
        { expression: '|0.5|, |{-0.25}|, |0.75| \\le 1', annotation: 'All inside the cube.' },
      ],
      answer: 'NDC (0.5, −0.25, 0.75), which is inside the cube from −1 to 1, so the point is visible.',
    },
    {
      id: 'modelling-geometry-3-002-ch2',
      difficulty: 'medium',
      problem: 'Changing a camera\'s field of view from $50°$ to $30°$: does the box in the middle of the image get bigger or smaller, and by how much?',
      walkthrough: [
        { expression: 'f_{50} = 1 / \\tan 25° = 2.1445, \\quad f_{30} = 1 / \\tan 15° = 3.7321', annotation: 'Everything on screen is scaled by f.' },
        { expression: '3.7321 / 2.1445 = 1.74', annotation: 'The ratio of the two scale factors.' },
      ],
      answer: 'Bigger: a narrower view is a zoom in, and everything near the centre grows by 1 / tan 15° ÷ 1 / tan 25° ≈ 1.74 times.',
    },
    {
      id: 'modelling-geometry-3-002-ch3',
      difficulty: 'hard',
      problem: 'A camera has near $0.1$ and far $200$. After the divide, what depth does a point $1$ in front get, and what fraction of the depth range from $-1$ to $1$ is left for everything from $1$ to $200$?',
      walkthrough: [
        { expression: 'z_c / w = \\big( -1.001 \\times (-1) - 0.2001 \\big) / 1 = 0.8009', annotation: 'Third row of P with N = 0.1, F = 200, then divide by w = 1.' },
        { expression: '\\frac{1 - 0.8009}{2} = 0.0996', annotation: 'From 0.8009 to 1 is about a tenth of the range from −1 to 1.' },
      ],
      answer: 'A point 1 in front already has depth 0.8009, so about 90% of the depth range is used between 0.1 and 1, and only about 10% is left for everything from 1 to 200.',
    },
  ],

  semantics: {
    core: [
      { symbol: '\\theta, \\; f = 1 / \\tan(\\theta / 2)', meaning: 'The vertical field of view, and the scale that puts the view\'s top and bottom edges at ±1.' },
      { symbol: 'a', meaning: 'The aspect ratio, width ÷ height; x is divided by it so the side edges land at ±1 too.' },
      { symbol: 'P', meaning: 'The projection matrix: scales x and y, maps depth, and copies the distance −z into w.' },
      { symbol: '(x_c, y_c, z_c, w)', meaning: 'Clip coordinates: the vertex shader\'s output, before the divide; w is the distance in front.' },
      { symbol: '\\text{ndc} = (x_c, y_c, z_c) / w', meaning: 'Normalised device coordinates: everything visible lies in the cube from −1 to 1.' },
      { symbol: 'N, \\; F', meaning: 'The near and far planes: depth −1 and 1 after the divide; nothing nearer or further is drawn.' },
    ],
    rulesOfThumb: [
      'Twice as far, half as tall: that is the whole of perspective.',
      'f uses half the field of view, and only x is divided by the aspect ratio.',
      'w is the distance in front; w ≤ 0 means behind the camera.',
      'Pixel rows count down from the top: (1 − y) / 2 × height.',
      'Use orthographic when you need to measure or line things up; perspective when you need to judge depth.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-3-001', label: 'Cameras', note: 'Camera space: x right, y up, in front means z < 0. Projection starts from there.' },
      { lessonId: 'modelling-geometry-2-002', label: 'Translate, rotate, scale', note: 'The fourth coordinate of a homogeneous point; the projection matrix uses it for w.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-3-003', label: 'Rasterization', note: 'The triangle\'s corners in pixels are the input to filling it; interpolation must undo the divide.' },
      { lessonId: 'modelling-geometry-3-004', label: 'The depth buffer', note: 'The uneven depth after the divide is what makes far surfaces fight (z-fighting).' },
      { lessonId: 'modelling-geometry-4-001', label: 'Picking by ray', note: 'A click goes backwards through this pipeline: pixel to NDC to a ray in the world.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-3-002-1', label: 'Read why dividing by the distance makes far things small', type: 'read' },
    { id: 'cp-modelling-geometry-3-002-2', label: 'Read how the projection matrix saves the distance in w', type: 'read' },
    { id: 'cp-modelling-geometry-3-002-3', label: 'Read how orthographic projection differs', type: 'read' },
    { id: 'cp-modelling-geometry-3-002-4', label: 'Run cells 1 to 4 and compare perspective with orthographic', type: 'lab' },
    { id: 'cp-modelling-geometry-3-002-5', label: 'Run Object › Trace the projection in MeshLab in Predict mode, and press 5', type: 'lab' },
    { id: 'cp-modelling-geometry-3-002-6', label: 'Work through example 2, the lesson\'s point to a pixel', type: 'example' },
    { id: 'cp-modelling-geometry-3-002-7', label: 'Work through example 3, perspective or orthographic', type: 'example' },
    { id: 'cp-modelling-geometry-3-002-8', label: 'Complete the challenge: which pixel?', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-3-002-assess-1',
        type: 'choice',
        text: 'What does the fourth row of a perspective projection matrix put into w?',
        options: ['−z, the distance in front of the camera', 'z', '1', 'The field of view'],
        answer: '−z, the distance in front of the camera',
        hint: 'The row is (0, 0, −1, 0); the GPU then divides by w.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-3-002-quiz-1',
      type: 'choice',
      text: 'A box 1 tall is 4 in front of a pinhole camera. How tall is it on a screen 1 in front of the eye?',
      options: ['0.25', '4', '1', '0.5'],
      answer: '0.25',
      hints: ['Similar triangles: y / d.', '1 / 4.'],
      reviewSection: 'Intuition: the first paragraph, and cell 1',
    },
    {
      id: 'modelling-geometry-3-002-quiz-2',
      type: 'choice',
      text: 'For a 90° vertical field of view, what is f?',
      options: ['1', '2', '0.5', '1.414'],
      answer: '1',
      hints: ['f = 1 / tan(θ / 2).', 'tan 45° = 1.'],
      reviewSection: 'Procedure step 1',
    },
    {
      id: 'modelling-geometry-3-002-quiz-3',
      type: 'choice',
      text: 'Clip coordinates (3, 1, 2, 2). What are the NDC?',
      options: ['(1.5, 0.5, 1)', '(3, 1, 2)', '(6, 2, 4)', '(0.75, 0.25, 0.5)'],
      answer: '(1.5, 0.5, 1)',
      hints: ['Divide x, y and z by w.', 'x is then 1.5: outside the cube, so not visible.'],
      reviewSection: 'Procedure step 4',
    },
    {
      id: 'modelling-geometry-3-002-quiz-4',
      type: 'choice',
      text: 'NDC (0, 1) on an image 800 wide and 600 tall is which pixel?',
      options: ['(400, 0)', '(400, 600)', '(0, 300)', '(400, 300)'],
      answer: '(400, 0)',
      hints: ['y = 1 is the top of the view.', 'Pixel rows count down from the top.'],
      reviewSection: 'Warning "Pixel rows count down"',
    },
    {
      id: 'modelling-geometry-3-002-quiz-5',
      type: 'choice',
      text: 'Which of these is NOT true of an orthographic view?',
      options: ['Far things are drawn smaller', 'w stays 1', 'Parallel lines stay parallel on screen', 'Equal objects look equal at any distance'],
      answer: 'Far things are drawn smaller',
      hints: ['Orthographic leaves out the divide by distance.', 'Only perspective shrinks things with distance.'],
      reviewSection: 'Intuition: the last paragraph, and example 3',
    },
    {
      id: 'modelling-geometry-3-002-quiz-6',
      type: 'choice',
      text: 'A camera with near 0.1 and far 200 draws two walls 150 and 150.01 away. Why might they flicker against each other?',
      options: ['After the divide, depths far away are crowded close to 1', 'The field of view is too narrow', 'Orthographic views cannot draw walls', 'Clip space has no depth'],
      answer: 'After the divide, depths far away are crowded close to 1',
      hints: ['Depth after the divide goes as 1 / z.', 'Cell 3: 100 and 200 are already 0.999 and 1.'],
      reviewSection: 'Intuition: the depth paragraph, and challenge 3',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'Projection just drops the z coordinate.',
      whyStudentsThinkIt: 'A picture is flat, so the third number seems to be thrown away.',
      correctionExample: 'The far box in cell 3 is half as tall (0.2145 against 0.4289) because x and y are divided by w = −z; z decides the size before it is used for depth.',
      contrastCase: 'Orthographic projection does nearly drop z for x and y: there both boxes are 0.3333 tall.',
    },
    {
      falseBelief: 'The projection matrix does the perspective divide.',
      whyStudentsThinkIt: 'All the other transforms are done by matrices.',
      correctionExample: 'P only copies −z into w: the lesson\'s point has clip (0.942, −0.487, 6.098, 6.292); the GPU divides afterwards to get (0.1497, −0.0774, 0.9692).',
      contrastCase: 'For orthographic, w = 1 and the divide changes nothing, so there it looks as if the matrix did everything.',
    },
    {
      falseBelief: 'Depth after projection is spread evenly from near to far.',
      whyStudentsThinkIt: 'Near and far map to −1 and 1, so the middle seems to map to 0.',
      correctionExample: 'With near 0.1 and far 200, a point 1 in front is already at 0.8009, and 10 in front at 0.981.',
      contrastCase: 'In an orthographic projection depth is spread evenly: its third row has no division by z.',
    },
  ],

  transferPrompts: [
    {
      situation: 'An architect wants a view where every window on a long facade is drawn the same size, to check them against each other.',
      competingTechniques: ['A perspective camera standing far back with a narrow field of view', 'An orthographic front view'],
      whyThisTechniqueWins: 'Orthographic projection draws equal windows equally, exactly; a far, narrow perspective camera only comes close and still shrinks the far end a little.',
    },
    {
      situation: 'A game shows z-fighting between a road and its painted lines far from the camera; the camera\'s near plane is 0.01 and far plane is 5000.',
      competingTechniques: ['Raise the far plane further', 'Raise the near plane (say to 0.5)', 'Move the lines 1 m above the road'],
      whyThisTechniqueWins: 'Depth precision is mostly set by the near plane, because depth after the divide goes as 1 / z; raising near spreads it much more evenly. Raising far makes it worse, and lifting the lines 1 m is visibly wrong.',
    },
  ],

  debugging: [
    {
      commonError: 'Using tan of the whole field of view.',
      symptom: 'The scene looks zoomed out, as if the camera were much further back.',
      whyItHappened: 'tan θ is bigger than tan(θ / 2), so f is too small and everything is scaled down.',
      repairStrategy: 'Use f = 1 / tan(θ / 2), and check that a point on the view\'s top edge gets NDC y = 1.',
    },
    {
      commonError: 'Dividing y (or both) by the aspect ratio.',
      symptom: 'Circles come out as ellipses when the window is not square.',
      whyItHappened: 'With a vertical field of view, only x needs the aspect correction.',
      repairStrategy: 'Divide only x by the aspect; check a sphere in the centre looks round in a wide window.',
    },
    {
      commonError: 'Forgetting that points behind the camera have w ≤ 0.',
      symptom: 'Objects behind the camera appear, flipped, in the middle of the image.',
      whyItHappened: 'Dividing by a negative w flips x and y; the point is not visible at all.',
      repairStrategy: 'Reject or clip anything with w ≤ 0 before dividing; the GPU does this in clip space.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Build a perspective (and an orthographic) projection matrix, and take a camera-space point through clip space and the divide to a pixel.',
    explainVerbally: 'Explain why dividing by w gives perspective, why f = 1 / tan(θ/2), and why depth is uneven after the divide.',
    detectIncorrectApplication: 'Spot a missing divide, a wrong aspect, an upside-down y, a full-angle tangent, or a point behind the camera from the pixel it produces.',
    transferToUnfamiliar: 'Choose orthographic or perspective for a task, and set near and far planes to avoid z-fighting.',
  },
};
