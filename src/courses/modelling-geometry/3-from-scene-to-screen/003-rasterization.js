// Lesson 3.3: rasterization. Which pixels a triangle covers (edge functions at pixel centres), how values are
// blended across it (barycentric coordinates), how shared edges are drawn exactly once (the top-left rule), and
// why blending must undo the perspective divide.

// The triangle and helpers every cell shares. Coordinates are in pixels, with y up (row 0 at the bottom).
const BASE = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
// The edge function: twice the signed area of the triangle (a, b, p). Positive when p is to the left of a → b.
const edge = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
const A = [1, 1], B = [7, 2], C = [3, 6]          // anticlockwise
const area2 = edge(A, B, C)
// Barycentric weights of p: how much of each corner is in it. They add up to 1.
const weights = (p) => [edge(B, C, p) / area2, edge(C, A, p) / area2, edge(A, B, p) / area2]
`;

const INSIDE = `${BASE}
console.log('twice the area: ' + area2)
// A pixel (x, y) is covered if its centre (x + 0.5, y + 0.5) is on the inside of all three edges.
let covered = 0
for (let y = 7; y >= 0; y--) {
  let row = ''
  for (let x = 0; x < 8; x++) {
    const p = [x + 0.5, y + 0.5]
    const inside = edge(A, B, p) >= 0 && edge(B, C, p) >= 0 && edge(C, A, p) >= 0
    row += inside ? '#' : '.'
    if (inside) covered++
  }
  console.log('row ' + y + ': ' + row)
}
console.log(covered + ' pixels covered; the triangle\\'s area is ' + area2 / 2)`;

const BARY = `${BASE}
const p = [3.5, 3.5]
const w = weights(p)
console.log('weights at (3.5, 3.5): ' + w.map(r).join(', ') + '; sum ' + r(w[0] + w[1] + w[2]))
// The same weights give back the point itself, and blend anything else stored at the corners.
console.log('w·corners = ' + [0, 1].map((i) => r(w[0] * A[i] + w[1] * B[i] + w[2] * C[i])).join(', '))
const red = [255, 0, 0], green = [0, 255, 0], blue = [0, 0, 255]
console.log('colour: ' + [0, 1, 2].map((i) => Math.round(w[0] * red[i] + w[1] * green[i] + w[2] * blue[i])).join(', '))
// At a corner the weights are 1, 0, 0; on edge BC the weight of A is 0.
console.log('at A: ' + weights(A).map(r).join(', ') + '; on BC midpoint: ' + weights([5, 4]).map(r).join(', '))`;

const SHARED = `${BASE}
// Two triangles sharing the diagonal of an 8 × 8 square. Pixel centres on the diagonal lie exactly on both.
const T1 = [[0, 0], [8, 0], [8, 8]], T2 = [[0, 0], [8, 8], [0, 8]]
// Three rules for a centre exactly on an edge (edge function 0):
const rules = {
  'always count it': () => true,
  'never count it': () => false,
  // Top-left rule (y up, anticlockwise): an edge owns its centres if it goes down, or goes left along the top.
  'top-left rule': (a, b) => b[1] < a[1] || (b[1] === a[1] && b[0] < a[0]),
}
for (const [name, owns] of Object.entries(rules)) {
  const covers = (t, p) => [0, 1, 2].every((i) => {
    const a = t[i], b = t[(i + 1) % 3], e = edge(a, b, p)
    return e > 0 || (e === 0 && owns(a, b))
  })
  let twice = 0, gaps = 0
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const p = [x + 0.5, y + 0.5], n = (covers(T1, p) ? 1 : 0) + (covers(T2, p) ? 1 : 0)
    if (n === 2) twice++
    if (n === 0) gaps++
  }
  console.log(name + ': ' + twice + ' pixels drawn twice, ' + gaps + ' gaps')
}`;

const PERSPECTIVE = `const r = (x) => +x.toFixed(4)
// A floor line seen in perspective: its near end is 1 in front (w = 1), its far end 3 in front (w = 3).
// A texture coordinate u runs 0 at the near end to 1 at the far end.
const w0 = 1, w1 = 3, u0 = 0, u1 = 1
// Halfway across the screen (t = 0.5 between the two ends' pixels):
const t = 0.5
const affine = u0 + t * (u1 - u0)
// Perspective-correct: blend u / w and 1 / w on screen, then divide.
const correct = ((1 - t) * u0 / w0 + t * u1 / w1) / ((1 - t) / w0 + t / w1)
console.log('affine u = ' + r(affine) + ', perspective-correct u = ' + r(correct))
// Check in 3D: the point halfway on screen is where the ray hits the line. Its depth:
const w = 1 / ((1 - t) / w0 + t / w1)
console.log('that pixel looks at depth ' + r(w) + ', which is ' + r((w - w0) / (w1 - w0)) + ' of the way from the near end to the far end')`;

const CANVAS = `${BASE}
// A real rasterizer: fill a 32 × 32 image pixel by pixel, colouring each by its barycentric blend.
const N = 32, S = N / 8                             // the same triangle, 4 times bigger
const a = A.map((v) => v * S), b = B.map((v) => v * S), c = C.map((v) => v * S), twice = edge(a, b, c)
const canvas = document.createElement('canvas')
canvas.width = canvas.height = N * 10
canvas.style.cssText = 'display: block; margin: 8px auto; image-rendering: pixelated'
document.body.appendChild(canvas)
const g = canvas.getContext('2d')
g.fillStyle = '#1e293b'; g.fillRect(0, 0, N * 10, N * 10)
let filled = 0
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const p = [x + 0.5, y + 0.5]
  const wa = edge(b, c, p) / twice, wb = edge(c, a, p) / twice, wc = edge(a, b, p) / twice
  if (wa < 0 || wb < 0 || wc < 0) continue
  g.fillStyle = 'rgb(' + Math.round(255 * wa) + ',' + Math.round(255 * wb) + ',' + Math.round(255 * wc) + ')'
  g.fillRect(x * 10, (N - 1 - y) * 10, 10, 10)     // row N - 1 is at the top of the image
  filled++
}
console.log(filled + ' of ' + N * N + ' pixels filled; red at A, green at B, blue at C')`;

const CHALLENGE = `// The triangle A = (1, 1), B = (7, 2), C = (3, 6), colours red at A, green at B, blue at C.
// Give the barycentric weights [for A, for B, for C] of the pixel in column 4, row 2.
// (Pixel (x, y) is sampled at its centre.)
const weights = [0, 0, 0]

console.log('weights ' + weights.join(', ') + ', sum ' + (weights[0] + weights[1] + weights[2]))`;

const SOLVED = CHALLENGE.replace('const weights = [0, 0, 0]', 'const weights = [8 / 28, 14.5 / 28, 5.5 / 28]');

const E = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
const TA = [1, 1], TB = [7, 2], TC = [3, 6];
const bary = (p) => [E(TB, TC, p) / 28, E(TC, TA, p) / 28, E(TA, TB, p) / 28];

/** The challenge's check: read three weights (numbers or fractions) and name what went wrong. */
export function checkWeights(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/^\s*const\s+weights\s*=\s*\[([^\]\n]*)\]/m);
  const parts = m ? m[1].split(',').map((s) => s.trim()) : [];
  if (parts.length !== 3 || !parts.every((s) => /^-?[\d.]+(\s*\/\s*[\d.]+)?$/.test(s))) return no('Keep const weights = [a, b, c] with three numbers or fractions such as 11 / 28.');
  const w = parts.map((s) => s.split('/').map(Number).reduce((x, y) => x / y));
  if (!w.every(Number.isFinite)) return no('Each weight should be a number.');
  const near = (q, tol = 0.002) => q.every((x, i) => Math.abs(x - w[i]) < tol);
  const fmt = (q) => `(${q.map((x) => +x.toFixed(4)).join(', ')})`;
  const right = bary([4.5, 2.5]);
  if (near(right)) return { pass: true, message: `${fmt(w)}: each edge function at (4.5, 2.5), divided by twice the area, 28. They add up to 1, all positive: the pixel is inside, and over half green, because it is nearest B.` };
  if (w.every((x) => x === 0)) return no('Work out the three edge functions at the pixel\'s centre, (4.5, 2.5).');
  const raw = right.map((x) => x * 28);
  if (near(raw, 0.05)) return no(`${fmt(w)} are the edge functions themselves. Divide each by twice the triangle's area, 28, so that they add up to 1.`);
  if (near(raw.map((x) => x / 14), 0.002)) return no(`${fmt(w)} add up to 2: the edge functions are TWICE the areas, so divide by twice the triangle's area, 28, not by 14.`);
  if (near(bary([4, 2]))) return no(`${fmt(w)} are the weights at the pixel's corner, (4, 2). A pixel is sampled at its centre, (4.5, 2.5).`);
  if (near([right[1], right[2], right[0]]) || near([right[2], right[0], right[1]])) return no(`${fmt(w)} has the right numbers in the wrong places. A's weight is the area opposite A: the edge function of B → C at the pixel.`);
  const s = w[0] + w[1] + w[2];
  if (Math.abs(s - 1) > 0.01) return no(`${fmt(w)} adds up to ${+s.toFixed(3)}, not 1. Barycentric weights always add up to 1.`);
  return no(`${fmt(w)} adds up to 1 but is not this pixel's blend. Check each edge function at (4.5, 2.5).`);
}

export default {
  id: 'modelling-geometry-3-003',
  slug: 'rasterization',
  chapter: 'modelling-geometry',
  order: 3,
  title: 'Rasterization',
  subtitle: 'Which pixels does a triangle cover, and what colour is each? Edge functions, barycentric weights, and a shared edge drawn exactly once.',
  tags: ['rasterization', 'edge function', 'barycentric coordinates', 'interpolation', 'top-left rule'],
  coreConcept: 'A pixel is covered when its centre is on the inside of all three edges, tested with edge functions (2D cross products); the same three numbers divided by twice the area are barycentric weights, which blend the corners\' values across the triangle, with a top-left rule so shared edges are drawn once and a divide by w so blending is correct in perspective.',
  prerequisites: ['modelling-geometry-3-002', 'modelling-geometry-2-001'],
  timeToComplete: 45,
  nextLesson: 'modelling-geometry-3-004',

  hook: {
    question: 'The GPU knows a triangle\'s three corners in pixels. Your screen has two million pixels. How does it decide, for each one, whether it is inside, and what colour it gets?',
    realWorldContext: 'Every triangle you have ever seen in a game or a modelling tool was turned into pixels by this one test, run billions of times a second in parallel. Colours, texture coordinates, normals and depth are all blended across the triangle with the same three weights.',
  },

  intuition: {
    prose: [
      'Take a triangle with corners $A = (1, 1)$, $B = (7, 2)$ and $C = (3, 6)$, in pixel units with $y$ up. Is the point $(4.5, 2.5)$ inside it? Stand at $A$ and look towards $B$. The point is on your left. Do the same from $B$ to $C$, and from $C$ to $A$: it is on your left every time. Then it is inside.',
      'Left or right is a sign. The **edge function** of the edge $a \\to b$ at a point $p$ is the 2D cross product $E_{ab}(p) = (b_x - a_x)(p_y - a_y) - (b_y - a_y)(p_x - a_x)$ (lesson 2.1). It is positive when $p$ is to the left of $a \\to b$, negative to the right, and $0$ on the line.',
      'A pixel $(x, y)$ is tested at its centre, $(x + 0.5, y + 0.5)$. If all three edge functions there are positive, the triangle **covers** the pixel. Cell 1 tests all $64$ pixels of an $8 \\times 8$ grid: $16$ are covered, though the triangle\'s area is $14$. Coverage is a count of centres, so it only matches the area on average.',
      'The edge function is more than a sign. Its size is twice the area of the triangle $a, b, p$. Each edge function at $p$ measures the small triangle opposite one corner. For $C$ itself, $E_{AB}(C) = 28$: twice the whole area.',
      'Divide the three by $28$ and they add up to $1$. These are the **barycentric weights** $(\\lambda_A, \\lambda_B, \\lambda_C)$: how much of each corner is in the point. At $(3.5, 3.5)$ they are $(0.2857, 0.2679, 0.4464)$, and $0.2857 A + 0.2679 B + 0.4464 C$ gives back $(3.5, 3.5)$.',
      'Before running cell 2, predict: if $A$ is red, $B$ green and $C$ blue, is $(3.5, 3.5)$ more red, more green or more blue? The same weights blend anything stored at the corners: colour, texture coordinates, normals, depth. This is **interpolation**.',
      'Two triangles that share an edge must not both draw the pixels on it (that shows as a darker or brighter seam with transparency), and must not both skip them (a crack). The **top-left rule** settles it: a centre exactly on an edge belongs to the triangle only if that edge is a "left" edge or a "top" edge. Cell 3 counts: always counting gives $8$ doubles, never counting gives $8$ gaps, the rule gives $0$ of each.',
      'One catch: after the perspective divide (lesson 3.2), equal steps on screen are not equal steps on the surface. Blending a texture coordinate straight across the screen makes textures swim. **Perspective-correct** interpolation blends $u / w$ and $1 / w$ instead, and divides at the end. On a floor from $w = 1$ to $w = 3$, halfway across the screen is only a quarter of the way along the floor: $u = 0.25$, not $0.5$.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Rasterize a triangle',
        body: 'Step 1. Take the corners $A, B, C$ in pixels, anticlockwise, and compute $2 \\times$area $= E_{AB}(C)$.\nStep 2. For each pixel $(x, y)$ in the triangle\'s bounding box, take its centre $p = (x + 0.5, y + 0.5)$.\nStep 3. Compute $E_{BC}(p)$, $E_{CA}(p)$, $E_{AB}(p)$.\nStep 4. If all three are positive, or $0$ on a top or left edge, the pixel is covered.\nStep 5. The weights are $\\lambda_A = E_{BC}(p) / 2\\text{area}$, $\\lambda_B = E_{CA}(p) / 2\\text{area}$, $\\lambda_C = E_{AB}(p) / 2\\text{area}$.\nStep 6. Blend each corner value $v$: $\\lambda_A v_A + \\lambda_B v_B + \\lambda_C v_C$; for perspective-correct values, blend $v / w$ and $1 / w$ and divide.',
      },
      {
        type: 'warning',
        title: 'Each weight comes from the edge opposite its corner',
        body: '$\\lambda_A$ uses the edge $B \\to C$, the one that does not touch $A$: it is the area of the small triangle $p, B, C$. Using $E_{AB}$ for $A$ puts every colour in the wrong corner.',
      },
      {
        type: 'warning',
        title: 'Sample at the centre, and divide by twice the area',
        body: 'A pixel is tested at $(x + 0.5, y + 0.5)$, not $(x, y)$: testing corners shifts the whole triangle half a pixel. And an edge function is twice an area, so divide by twice the triangle\'s area, $E_{AB}(C)$, to make the weights add up to $1$.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: per-pixel attributes',
        body: 'Whatever the vertex shader outputs besides the position (colours, normals, texture coordinates) is called a varying. The GPU rasterizes each triangle, computes the barycentric weights for every covered pixel, and blends each varying perspective-correctly before running the fragment shader on it. That is how a normal stored only at three corners becomes a smooth normal at every pixel (lesson 3.5).',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "a triangle is drawn as a smooth shape". It is a set of square pixels, each coloured by its own weights: pure red, green and blue at the corners, mixed in between. Invariant: at every filled pixel the three weights add up to 1, so the colours always add up to full brightness (255) in total.',
      },
      { type: 'insight', title: 'Bridge: from the chain rule to code', body: 'edge() in the cells is $E_{ab}(p)$; weights() is Step 5; the loops over x and y are Step 2.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'GPUs run exactly these edge functions in hardware, on blocks of pixels at once, and step them across the screen by adding a constant per pixel, because each is linear in $x$ and $y$.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'MeshLab hands its triangles to the GPU (WebGL), which rasterizes them this way. The Projection project (lesson 3.2) and View › Render still (lesson 3.7) show the pixels it produces.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: a software rasterizer',
        caption: 'Edge functions, barycentric weights, the top-left rule, perspective-correct blending, and a triangle filled pixel by pixel.',
        props: {
          lesson: {
            title: 'Rasterization',
            subtitle: 'Write the test every GPU runs: is this pixel\'s centre inside, and how much of each corner is in it?',
            cells: [
              { type: 'js', instruction: '### 1. Inside or out\nThree edge functions at each pixel\'s centre; all positive means covered.', startCode: INSIDE },
              { type: 'js', instruction: '### 2. Barycentric weights\nPredict first: is (3.5, 3.5) more red, green or blue? The edge functions divided by twice the area.', startCode: BARY },
              { type: 'js', instruction: '### 3. A shared edge, drawn once\nThree rules for centres exactly on an edge. Only the top-left rule gives no doubles and no gaps.', startCode: SHARED },
              { type: 'js', instruction: '### 4. Fill a triangle\nEvery pixel of a 32 × 32 image, coloured by its own weights.', startCode: CANVAS, showPreviewByDefault: true, outputHeight: 360 },
              { type: 'js', instruction: '### 5. Perspective-correct\nHalfway across the screen is not halfway along a floor that runs away from you.', startCode: PERSPECTIVE },
              { type: 'challenge', instruction: '### 6. Challenge: one pixel\'s blend\nGive the weights of the pixel in column 4, row 2. The check names any mistake.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkWeights },
              { type: 'markdown', instruction: '### Watch it happen in MeshLab\nMeshLab does not rasterize by itself: it hands triangles to the GPU. [Open "Projection" in MeshLab](#/lab/mesh-lab?project=projection) and trace the projection: the pixel it ends with is where this lesson starts. Turn on **Wire**: every face is split into triangles before the GPU fills them, and the wire shows the faces they came from.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Wire** (toolbar) draws edges over the shaded faces; **X-ray** makes faces see-through (lesson 3.4).\n- Smooth colours and normals across a face come from this interpolation: **Object › Shade smooth** (lesson 3.5).\n- **In Blender:** Viewport Shading and the Wireframe overlay show the same split of faces into triangles that the GPU rasterizes.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Why the edge function is twice an area.** $E_{ab}(p)$ is the cross product of $b - a$ and $p - a$ (the $z$ part of the 3D cross product, lesson 2.1). Its size is $|b - a| \\, |p - a| \\sin\\varphi$, which is base times height of the triangle $a, b, p$: twice its area. Its sign says which side of $a \\to b$ the point is on.',
      '**Why the weights add up to 1.** For a point inside, the three small triangles $pBC$, $pCA$, $pAB$ fill the big one exactly. So their areas add up to the big area, and their doubled areas add up to $28$: $\\lambda_A + \\lambda_B + \\lambda_C = 1$.',
      '**Why the weights rebuild the point.** Each edge function is linear in $p$. So $\\lambda_A A + \\lambda_B B + \\lambda_C C$ is a linear function of $p$ that equals $A$ at $A$ (weights $1, 0, 0$), $B$ at $B$ and $C$ at $C$. A linear function in the plane is fixed by three points not in a line, so it is $p$ itself.',
      '**Why perspective needs $1 / w$.** On the surface, $u$ changes evenly with the 3D position. After the divide, screen position is a 3D position over $w$. Then $u / w$ and $1 / w$ both change evenly on screen (they are linear in screen $x, y$), while $u$ itself does not. Blending $u / w$ and $1 / w$ and dividing recovers the true $u$.',
    ],
    equations: [
      { label: 'Edge function', latex: 'E_{ab}(p) = (b_x - a_x)(p_y - a_y) - (b_y - a_y)(p_x - a_x)' },
      { label: 'Barycentric weights', latex: '\\lambda_A = \\frac{E_{BC}(p)}{E_{AB}(C)}, \\quad \\lambda_B = \\frac{E_{CA}(p)}{E_{AB}(C)}, \\quad \\lambda_C = \\frac{E_{AB}(p)}{E_{AB}(C)}' },
      { label: 'Perspective-correct', latex: 'u = \\frac{\\sum_i \\lambda_i \\, u_i / w_i}{\\sum_i \\lambda_i / w_i}' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** For a non-degenerate triangle $ABC$, every point $p$ of the plane has unique barycentric coordinates with $\\lambda_A + \\lambda_B + \\lambda_C = 1$ and $p = \\lambda_A A + \\lambda_B B + \\lambda_C C$. The closed triangle is exactly the set where all three are $\\ge 0$. A tie-breaking rule such as top-left makes the half-open triangles of any mesh without T-junctions partition the pixel centres.',
      '**Invariant viewpoint.** Barycentric coordinates are unchanged by any affine map of the plane: move, turn, scale or shear the triangle and the point, and the weights stay the same. They are not unchanged by a perspective divide, which is why interpolation must be done on $u / w$ and $1 / w$.',
      '**Geometric picture.** Each $\\lambda$ is a linear ramp: $1$ at its corner, $0$ along the opposite edge. The three ramps are planes over the triangle; the covered pixels are where all three planes are above zero. Rasterizers step each edge function by a constant per pixel across a row.',
      '**Where this goes.** The same weights blend depth for the depth test (lesson 3.4) and normals for smooth shading (lesson 3.5). In 3D, the same edge-function test in a different form is ray–triangle intersection for picking (lesson 4.1). Texture mapping (chapter 8) is perspective-correct interpolation of UVs.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-3-003-ex1',
      title: 'Inside or outside: one point',
      problem: 'Is $p = (2, 4)$ inside the triangle $A = (1, 1)$, $B = (7, 2)$, $C = (3, 6)$?',
      steps: [
        { expression: 'E_{AB}(p) = 6 \\cdot 3 - 1 \\cdot 1 = 17 > 0', annotation: 'Step 3: (b − a) = (6, 1), (p − a) = (1, 3). Left of A → B.' },
        { expression: 'E_{BC}(p) = (-4)(2) - (4)(-5) = 12 > 0', annotation: 'b − a = C − B = (−4, 4), p − B = (−5, 2). Left of B → C.' },
        { expression: 'E_{CA}(p) = (-2)(-2) - (-5)(-1) = -1 < 0', annotation: 'C → A: (−2, −5), p − C = (−1, −2). Right of C → A.' },
        { expression: '\\text{not all positive} \\Rightarrow \\text{outside}', annotation: 'Step 4: one negative is enough.' },
      ],
      conclusion: 'The point $(2, 4)$ is just outside, beyond the edge from $C$ to $A$.',
    },
    {
      id: 'modelling-geometry-3-003-ex2',
      title: 'Weights and a colour',
      problem: 'Find the barycentric weights of $(3.5, 3.5)$ and its colour, with $A$ red, $B$ green, $C$ blue.',
      steps: [
        { expression: 'E_{AB}(C) = 6 \\cdot 5 - 1 \\cdot 2 = 28', annotation: 'Step 1: twice the area.' },
        { expression: 'E_{BC}(p) = (-4)(1.5) - 4(-3.5) = 8, \\; E_{CA}(p) = (-2)(-2.5) - (-5)(0.5) = 7.5', annotation: 'Step 3, for A\'s and B\'s weights.' },
        { expression: 'E_{AB}(p) = 6 \\cdot 2.5 - 1 \\cdot 2.5 = 12.5', annotation: 'For C\'s weight. 8 + 7.5 + 12.5 = 28.' },
        { expression: '(\\lambda_A, \\lambda_B, \\lambda_C) = (0.2857, 0.2679, 0.4464)', annotation: 'Step 5: divide by 28.' },
      ],
      conclusion: 'The colour is $(0.2857, 0.2679, 0.4464) \\times 255 \\approx (73, 68, 114)$: more blue than anything, because the point is nearest $C$.',
    },
    {
      id: 'modelling-geometry-3-003-ex3',
      title: 'A texture coordinate in perspective',
      problem: 'A floor edge has $u = 0$, $w = 1$ at its near end and $u = 1$, $w = 3$ at its far end. Halfway between the two ends on screen, what is $u$?',
      steps: [
        { expression: '\\text{affine: } u = 0.5', annotation: 'Blending u straight across the screen: wrong.' },
        { expression: '\\frac{u}{w}: \\; 0.5 \\cdot 0 + 0.5 \\cdot \\tfrac{1}{3} = \\tfrac{1}{6}; \\quad \\frac{1}{w}: \\; 0.5 \\cdot 1 + 0.5 \\cdot \\tfrac{1}{3} = \\tfrac{2}{3}', annotation: 'Step 6: blend u / w and 1 / w, which are even on screen.' },
        { expression: 'u = \\tfrac{1}{6} \\div \\tfrac{2}{3} = 0.25', annotation: 'Divide to get u back.' },
        { expression: 'w = 1 / \\tfrac{2}{3} = 1.5', annotation: 'That pixel looks at depth 1.5: a quarter of the way from 1 to 3.' },
      ],
      conclusion: 'Halfway across the screen is only a quarter of the way along the floor: $u = 0.25$. Affine blending would put the texture\'s middle too near the camera.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-3-003-ch1',
      difficulty: 'easy',
      problem: 'The weights of a point are $(0.5, 0.5, 0)$. Where is it?',
      walkthrough: [
        { expression: '\\lambda_C = 0', annotation: 'It is on the edge opposite C: the edge AB.' },
        { expression: '0.5 A + 0.5 B', annotation: 'Equal parts of A and B.' },
      ],
      answer: 'It is the midpoint of the edge from A to B.',
    },
    {
      id: 'modelling-geometry-3-003-ch2',
      difficulty: 'medium',
      problem: 'A rasterizer works for every triangle in one mesh and draws nothing at all for every triangle in another. The second mesh came from a tool that winds faces clockwise. Why, and what are two fixes?',
      walkthrough: [
        { expression: '\\text{clockwise} \\Rightarrow E_{AB}(C) < 0', annotation: 'For a clockwise triangle, every inside point is to the right of each edge: all three edge functions are negative.' },
        { expression: '\\text{test } \\ge 0 \\text{ fails everywhere}', annotation: 'So no pixel passes.' },
        { expression: '\\text{fix: swap two corners, or test that all three have the sign of } E_{AB}(C)', annotation: 'Either make it anticlockwise, or accept whichever single sign the area has.' },
      ],
      answer: 'Its triangles are clockwise, so every inside point gives three negative edge functions and nothing passes a "all positive" test; swap two corners of each, or test that the three edge functions all share the sign of E_AB(C). (GPUs use this sign for back-face culling, lesson 1.2.)',
    },
    {
      id: 'modelling-geometry-3-003-ch3',
      difficulty: 'hard',
      problem: 'A transparent window is drawn as two triangles sharing a diagonal. With the rule "count centres on an edge", a darker line runs along the diagonal. Explain, and say which rule fixes it.',
      walkthrough: [
        { expression: 'E = 0 \\text{ on the diagonal for both triangles}', annotation: 'Centres exactly on the shared edge pass both triangles\' tests.' },
        { expression: '\\text{blended twice} \\Rightarrow \\text{darker}', annotation: 'A see-through colour drawn twice over the same pixel covers more of what is behind it.' },
        { expression: '\\text{top-left: the edge goes down in one triangle and up in the other}', annotation: 'The shared edge runs opposite ways in the two triangles, so exactly one owns it.' },
      ],
      answer: 'Pixels exactly on the diagonal are drawn by both triangles, so the see-through colour is applied twice; the top-left rule gives each such pixel to exactly one triangle, because the shared edge runs in opposite directions in the two.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'E_{ab}(p)', meaning: 'The edge function: a 2D cross product, positive when p is left of a → b; its size is twice the area of triangle a, b, p.' },
      { symbol: '(x + 0.5, \\; y + 0.5)', meaning: 'The centre of pixel (x, y), where coverage and colour are sampled.' },
      { symbol: '\\lambda_A, \\lambda_B, \\lambda_C', meaning: 'Barycentric weights: the share of each corner in a point; they add up to 1 and are all ≥ 0 inside.' },
      { symbol: 'E_{AB}(C)', meaning: 'Twice the triangle\'s area: the number every edge function is divided by.' },
      { symbol: '\\text{top-left rule}', meaning: 'A centre exactly on an edge belongs to the triangle only if that edge is a left or a top edge, so shared edges are drawn once.' },
      { symbol: 'u / w, \\; 1 / w', meaning: 'The quantities that change evenly across the screen; blend them and divide for perspective-correct values.' },
    ],
    rulesOfThumb: [
      'Test pixel centres, not corners.',
      'A weight comes from the edge opposite its corner.',
      'If nothing draws, check the winding: the edge functions are all negative for a clockwise triangle.',
      'If shared edges flicker, double-draw or crack, the tie-break on E = 0 is wrong.',
      'Blend anything that should look right in perspective as value / w and 1 / w.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-3-002', label: 'Projection', note: 'The corners arrive in pixels after the divide, each with its own w.' },
      { lessonId: 'modelling-geometry-2-001', label: 'Vectors, dot and cross', note: 'The edge function is the z part of a cross product; its size is an area.' },
      { lessonId: 'modelling-geometry-1-002', label: 'Winding and normals', note: 'Anticlockwise winding makes the inside the positive side of every edge.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-3-004', label: 'The depth buffer', note: 'Depth is blended across the triangle with these weights, then compared per pixel.' },
      { lessonId: 'modelling-geometry-3-005', label: 'Flat and smooth shading', note: 'Smooth shading blends vertex normals with these weights.' },
      { lessonId: 'modelling-geometry-4-001', label: 'Picking by ray', note: 'Ray–triangle intersection computes barycentric weights in 3D.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-3-003-1', label: 'Read how an edge function says which side a point is on', type: 'read' },
    { id: 'cp-modelling-geometry-3-003-2', label: 'Read how the edge functions become barycentric weights', type: 'read' },
    { id: 'cp-modelling-geometry-3-003-3', label: 'Read why perspective-correct blending uses 1 / w', type: 'read' },
    { id: 'cp-modelling-geometry-3-003-4', label: 'Run cells 1 to 3 and count the doubles and gaps under each rule', type: 'lab' },
    { id: 'cp-modelling-geometry-3-003-5', label: 'Run cells 4 and 5: fill a triangle, and blend in perspective', type: 'lab' },
    { id: 'cp-modelling-geometry-3-003-6', label: 'Work through example 2, the weights and a colour', type: 'example' },
    { id: 'cp-modelling-geometry-3-003-7', label: 'Work through example 3, a texture coordinate in perspective', type: 'example' },
    { id: 'cp-modelling-geometry-3-003-8', label: 'Complete the challenge: one pixel\'s blend', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-3-003-assess-1',
        type: 'choice',
        text: 'At a pixel centre the three edge functions are 7, 14 and 7, and twice the triangle\'s area is 28. What are the weights?',
        options: ['(0.25, 0.5, 0.25)', '(7, 14, 7)', '(0.5, 1, 0.5)', '(0.33, 0.33, 0.33)'],
        answer: '(0.25, 0.5, 0.25)',
        hint: 'Divide each edge function by twice the area, 28.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-3-003-quiz-1',
      type: 'choice',
      text: 'Where is pixel (3, 5) tested for coverage?',
      options: ['(3.5, 5.5)', '(3, 5)', '(4, 6)', 'At all four of its corners'],
      answer: '(3.5, 5.5)',
      hints: ['A pixel is sampled at one point.', 'Its centre.'],
      reviewSection: 'Warning "Sample at the centre, and divide by twice the area"',
    },
    {
      id: 'modelling-geometry-3-003-quiz-2',
      type: 'choice',
      text: 'For an anticlockwise triangle, what are the signs of the three edge functions at a point inside?',
      options: ['All positive', 'All negative', 'Two positive, one negative', 'All zero'],
      answer: 'All positive',
      hints: ['Inside means left of every edge going round anticlockwise.', 'Left of a → b gives a positive edge function.'],
      reviewSection: 'Intuition: the edge-function paragraph, and example 1',
    },
    {
      id: 'modelling-geometry-3-003-quiz-3',
      type: 'choice',
      text: 'Which edge function gives the weight of corner A?',
      options: ['E_BC(p)', 'E_AB(p)', 'E_CA(p)', 'E_AB(C)'],
      answer: 'E_BC(p)',
      hints: ['The weight of A is the area of the small triangle opposite A.', 'That triangle is p, B, C.'],
      reviewSection: 'Warning "Each weight comes from the edge opposite its corner"',
    },
    {
      id: 'modelling-geometry-3-003-quiz-4',
      type: 'choice',
      text: 'Two triangles share an edge. Which rule for centres exactly on it gives no doubles and no gaps?',
      options: ['The top-left rule', 'Always count them', 'Never count them', 'Count them for the bigger triangle'],
      answer: 'The top-left rule',
      hints: ['Always counting draws them twice; never counting leaves cracks.', 'Cell 3 counts each.'],
      reviewSection: 'Intuition: the shared-edge paragraph, and cell 3',
    },
    {
      id: 'modelling-geometry-3-003-quiz-5',
      type: 'choice',
      text: 'Which value does NOT need perspective-correct interpolation?',
      options: ['A value that is the same at all three corners', 'A texture coordinate on a floor', 'A colour on a wall seen at an angle', 'A normal on a long, tilted face'],
      answer: 'A value that is the same at all three corners',
      hints: ['Blending equal values gives that value whatever the weights.', 'Every other option varies across a face seen in perspective.'],
      reviewSection: 'Math: "Why perspective needs 1 / w"',
    },
    {
      id: 'modelling-geometry-3-003-quiz-6',
      type: 'choice',
      text: 'A point has weights (0.2, 0.3, 0.5). Is it inside the triangle?',
      options: ['Yes: all three are positive and they add up to 1', 'No: they are not equal', 'Only if 0.5 is C\'s weight', 'It is on an edge'],
      answer: 'Yes: all three are positive and they add up to 1',
      hints: ['Inside means every weight is above 0.', 'On an edge, one weight is 0.'],
      reviewSection: 'Rigor: formal statement',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'A triangle covers exactly as many pixels as its area.',
      whyStudentsThinkIt: 'Area and pixel count are both "how much of the screen".',
      correctionExample: 'Coverage counts pixel centres inside: the lesson\'s triangle has area 14 but covers 16 pixels, and moving it a fraction of a pixel changes the count.',
      contrastCase: 'For a huge triangle the count and the area agree to a tiny fraction; for a thin sliver they can differ completely (a sliver can cover zero centres).',
    },
    {
      falseBelief: 'Blending values linearly across the screen is always right.',
      whyStudentsThinkIt: 'Inside one triangle, everything seems linear.',
      correctionExample: 'On a floor from w = 1 to w = 3, halfway across the screen u is 0.25, not 0.5: linear on the surface is not linear on the screen.',
      contrastCase: 'In an orthographic view, w = 1 everywhere, and linear blending on screen is exactly right.',
    },
    {
      falseBelief: 'A point on an edge can belong to both triangles that share it without harm.',
      whyStudentsThinkIt: 'Mathematically, the edge belongs to both closed triangles.',
      correctionExample: 'Cell 3: counting them in both draws 8 pixels twice along the diagonal, which shows as a seam in anything transparent.',
      contrastCase: 'The top-left rule gives each of those 8 pixels to exactly one triangle.',
    },
  ],

  transferPrompts: [
    {
      situation: 'You need to know which triangle of a 2D mesh (a floor plan) a mouse click falls in, and where in it.',
      competingTechniques: ['Check the distance from the click to each triangle\'s centre', 'Compute the barycentric weights of the click for each nearby triangle and pick the one with all weights ≥ 0'],
      whyThisTechniqueWins: 'The nearest centre is often the wrong triangle for long, thin ones; the weights test is exact and also gives the click\'s position inside the triangle for blending values.',
    },
    {
      situation: 'A custom software renderer\'s textures bend along the diagonal of every floor quad.',
      competingTechniques: ['Split the quads into more triangles', 'Interpolate texture coordinates as u / w and 1 / w and divide'],
      whyThisTechniqueWins: 'The bend is affine interpolation disagreeing on the two triangles; more triangles only hide it, while perspective-correct interpolation removes it.',
    },
  ],

  debugging: [
    {
      commonError: 'Testing pixel corners (x, y) instead of centres.',
      symptom: 'Every triangle looks shifted half a pixel down and to the left; meshes look slightly offset from their outlines.',
      whyItHappened: 'The sample point is half a pixel off in both directions.',
      repairStrategy: 'Sample at (x + 0.5, y + 0.5); check a triangle with integer corners covers symmetric pixels.',
    },
    {
      commonError: 'Using the wrong edge function for a corner\'s weight.',
      symptom: 'The colours appear rotated: red where green should be, and so on.',
      whyItHappened: 'λ_A must use the edge opposite A (B → C); using E_AB shifts every weight to the next corner.',
      repairStrategy: 'Check at the corners: at A the weights must be (1, 0, 0).',
    },
    {
      commonError: 'Testing "all three ≥ 0" for a clockwise triangle.',
      symptom: 'Some meshes vanish entirely.',
      whyItHappened: 'For clockwise winding all three edge functions are negative inside.',
      repairStrategy: 'Fix the winding, or compare each edge function\'s sign with the sign of the area E_AB(C).',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Decide coverage with edge functions at pixel centres, compute barycentric weights, and blend corner values, perspective-correctly where needed.',
    explainVerbally: 'Explain why the edge function is twice an area, why the weights add up to 1, and why perspective needs 1 / w.',
    detectIncorrectApplication: 'Spot corner sampling, a wrong opposite edge, clockwise winding, double-drawn shared edges and swimming textures from their symptoms.',
    transferToUnfamiliar: 'Use barycentric weights to locate a click in a 2D mesh, or fix a software renderer\'s bending textures.',
  },
};
