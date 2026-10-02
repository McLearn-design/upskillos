// Lesson 3.4: the depth buffer. Each pixel keeps the depth of the nearest surface drawn so far; a new fragment is
// kept only if it is nearer. Depth is stored as a whole number of a fixed size, spread unevenly (as 1 / distance),
// so surfaces close together far away round to the same number and fight. The near plane sets the precision.

const DEPTH = `const depth = (d, near, far) => far * (d - near) / (d * (far - near))   // 0 at near, 1 at far
const store = (x, bits) => Math.round(x * (2 ** bits - 1))                     // the whole number kept per pixel
`;

const ZTEST = `// Two triangles on an 8 × 8 grid, each with a depth at every pixel (smaller = nearer).
// Red: flat at depth 2. Blue: tilted, depth 1 on the left to 3 on the right, so they cross in the middle.
const red = (x, y) => x + y <= 7 ? 2 : null           // the lower-left half
const blue = (x, y) => y >= 2 ? 1 + 2 * x / 7 : null  // the top six rows, tilted
function draw(order, test) {
  const colour = [], z = []
  for (let i = 0; i < 64; i++) { colour.push('.'); z.push(Infinity) }
  for (const [name, f] of order) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const d = f(x, y)
    if (d === null) continue
    if (!test || d < z[y * 8 + x]) { z[y * 8 + x] = d; colour[y * 8 + x] = name }
  }
  return colour
}
const count = (c, n) => c.filter((x) => x === n).length
const rb = draw([['R', red], ['B', blue]], true), br = draw([['B', blue], ['R', red]], true)
console.log('with the depth test, red first: ' + count(rb, 'R') + ' red, ' + count(rb, 'B') + ' blue; blue first: ' + count(br, 'R') + ' red, ' + count(br, 'B') + ' blue')
const noTest1 = draw([['R', red], ['B', blue]], false), noTest2 = draw([['B', blue], ['R', red]], false)
console.log('no depth test, red first: ' + count(noTest1, 'R') + ' red; blue first: ' + count(noTest2, 'R') + ' red')
for (let y = 7; y >= 0; y--) console.log('row ' + y + ': ' + rb.slice(y * 8, y * 8 + 8).join(''))`;

const PRECISION = `${DEPTH}
for (const near of [0.1, 1]) {
  const at = [1, 10, 100].map((d) => d + ' → ' + depth(d, near, 1000).toFixed(7))
  console.log('near ' + near + ', far 1000: ' + at.join(', '))
}
// A wall 100 away and a poster 0.001 in front of it, in a 24-bit depth buffer.
for (const near of [0.1, 1]) {
  const wall = store(depth(100, near, 1000), 24), poster = store(depth(99.999, near, 1000), 24)
  console.log('near ' + near + ': wall ' + wall + ', poster ' + poster + (wall === poster ? ' (the same: they fight)' : ' (different: the poster wins)'))
}`;

const RESOLUTION = `// One step of a 24-bit depth buffer, as a distance: d² (far − near) / (far · near · 2^24).
const step = (d, near, far) => d * d * (far - near) / (far * near * 2 ** 24)
for (const near of [0.01, 0.1, 1]) {
  console.log('near ' + near + ': ' + [1, 10, 100].map((d) => 'at ' + d + ' ' + step(d, near, 1000).toExponential(2)).join(', '))
}
// Moving far from 1000 to 100000 hardly matters; moving near from 0.01 to 1 makes everything 100 times finer.
console.log('far 100000, near 1, at 100: ' + step(100, 1, 100000).toExponential(2))`;

const STRIPES = `const bits = 8                // try 16, then 24
const q = (x) => Math.round(x * (2 ** bits - 1))
// Two surfaces drawn into a 64 × 64 image. Grey: depth runs 0.3 at the bottom to 0.7 at the top.
// Orange: the same, plus a tiny tilt left to right: 0.00025 nearer at the left edge, 0.00025 further at the right.
const N = 64, canvas = document.createElement('canvas')
canvas.width = canvas.height = N * 5
canvas.style.cssText = 'display: block; margin: 8px auto; image-rendering: pixelated'
document.body.appendChild(canvas)
const g = canvas.getContext('2d')
let leftWins = 0, rightWins = 0
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const grey = 0.3 + 0.4 * y / (N - 1), orange = grey + 0.0005 * (x / (N - 1) - 0.5)
  // Grey is drawn first; orange is kept only where its STORED depth is smaller.
  const wins = q(orange) < q(grey)
  if (wins) { if (x < N / 2) leftWins++; else rightWins++ }
  g.fillStyle = wins ? '#f59e0b' : '#64748b'
  g.fillRect(x * 5, (N - 1 - y) * 5, 5, 5)
}
console.log(bits + ' bits: orange wins ' + leftWins + ' of the ' + N * N / 2 + ' pixels on the left, where it is nearer, and ' + rightWins + ' on the right')`;

const OFFSET = `// Polygon offset: push one surface a fixed amount towards (or away from) the camera in depth only.
// An outline or a decal drawn exactly on a face would fight it; an offset settles who wins.
const q = (x) => Math.round(x * (2 ** 24 - 1))
let fights = 0, decalWins = 0
for (let i = 0; i < 1000; i++) {
  const face = 0.9 + 0.09 * i / 999          // the face's depth across 1000 pixels
  const decal = face + (i % 7 - 3) * 1e-9     // the same surface, computed slightly differently: rounding noise
  if (q(decal) === q(face)) fights++
  if (q(decal - 4 / 2 ** 24) < q(face)) decalWins++   // offset by 4 depth steps towards the camera
}
console.log('no offset: ' + fights + ' of 1000 pixels tie (the winner then depends on draw order and rounding)')
console.log('offset by 4 steps: the decal wins ' + decalWins + ' of 1000')`;

const CHALLENGE = `// A camera's far plane is 1000. A poster hangs 0.001 in front of a wall 100 away.
// What is the SMALLEST near plane that lets a 24-bit depth buffer tell them apart?
// (One depth step at distance d is d² (far − near) / (far · near · 2^24).)
const near = 0.01

const step = 100 * 100 * (1000 - near) / (1000 * near * 2 ** 24)
console.log('near ' + near + ': one step at 100 is ' + step.toFixed(6) + (step <= 0.001 ? ' (separated)' : ' (they fight)'))`;

const SOLVED = CHALLENGE.replace('const near = 0.01', 'const near = 0.596');

const stepAt = (n) => (100 * 100 * (1000 - n)) / (1000 * n * 2 ** 24);
const MIN_NEAR = (100 * 100 * 1000) / (0.001 * 1000 * 2 ** 24 + 100 * 100);

/** The challenge's check: the near plane must separate the surfaces without wasting more of the scene than needed. */
export function checkNear(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/^\s*const\s+near\s*=\s*([\d.eE+-]+)\s*$/m);
  const n = m ? Number(m[1]) : NaN;
  if (!Number.isFinite(n)) return no('Keep the line const near = …, with a number.');
  if (n <= 0) return no('The near plane must be in front of the camera: above 0.');
  if (n >= 100) return no(`At near ${n} the wall itself, 100 away, is closer than the near plane and is not drawn at all.`);
  const s = stepAt(n);
  if (s > 0.001) return no(`At near ${n}, one depth step at distance 100 is ${+s.toFixed(6)}, longer than the 0.001 between poster and wall, so they still fight. Move the near plane further out.`);
  if (n > MIN_NEAR * 1.1) return no(`Near ${n} works (one step is ${+s.toFixed(6)}), but it cuts off everything closer than ${n}. The smallest near plane that works is a little under 0.6: solve d² (far − near) / (far · near · 2^24) = 0.001 for near.`);
  return { pass: true, message: `Near ${n}: one step at 100 is ${+s.toFixed(6)}, just under 0.001. The smallest near plane that works is ${+MIN_NEAR.toFixed(4)}, 60 times the original 0.01. Changing far would hardly have helped.` };
}

export default {
  id: 'modelling-geometry-3-004',
  slug: 'the-depth-buffer',
  chapter: 'modelling-geometry',
  order: 4,
  title: 'The depth buffer',
  subtitle: 'Keep the nearest surface at every pixel, and see why surfaces far away fight when the near plane is too close.',
  tags: ['depth buffer', 'z-buffer', 'z-fighting', 'precision', 'polygon offset'],
  coreConcept: 'Each pixel stores the depth of the nearest surface drawn so far and keeps a new fragment only if it is nearer; depth is stored as a whole number spread as 1 / distance, so one step covers d²(f − n)/(f n 2^bits) at distance d, and surfaces closer than that fight, which the near plane (not the far one) controls.',
  prerequisites: ['modelling-geometry-3-002', 'modelling-geometry-3-003'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-3-005',

  hook: {
    question: 'Draw a red triangle, then a blue one partly behind it. Which colour is on top? Without help, the last one drawn, even if it is further away. How does the GPU get it right regardless of order?',
    realWorldContext: 'Every 3D scene is drawn in whatever order its objects happen to come in, and the depth buffer sorts it out, pixel by pixel. When it fails you see z-fighting: decals flickering on walls, roads shimmering through terrain, outlines breaking up. The fix is almost always one number: the camera\'s near plane.',
  },

  intuition: {
    prose: [
      'On an $8 \\times 8$ grid, draw a red triangle at depth $2$ (smaller depth is nearer). Then draw a blue one that tilts from depth $1$ on the left to $3$ on the right, overlapping the red. Without any test, whichever is drawn last covers the other completely. Draw them the other way round and the picture changes.',
      'The **depth buffer** (or z-buffer) fixes this. It keeps one more number per pixel: the depth of the nearest thing drawn there so far. A new fragment (a pixel of a triangle, lesson 3.3) is kept only if its depth is smaller; then its depth replaces the stored one. This is the **depth test**. Cell 1 draws both orders and gets the same picture either way, $18$ red pixels and $45$ blue: blue wherever it is nearer, red where blue is further or absent.',
      'The depth used is the one after the divide (lesson 3.2), moved to run from $0$ at the near plane to $1$ at the far plane: $\\text{depth}(d) = \\frac{f (d - n)}{d (f - n)}$ for a point $d$ in front, near $n$, far $f$. It is blended across each triangle with the barycentric weights (lesson 3.3), perspective-correctly.',
      'Before running cell 2, predict: with near $0.1$ and far $1000$, what depth does a point $10$ in front get? Halfway, $0.5$? No: $0.99$. Depth goes as $1 / d$, so almost the whole range is used up close to the camera.',
      'The buffer stores depth as a whole number: with $24$ **bits**, from $0$ to $2^{24} - 1 = 16{,}777{,}215$. Two depths closer together than one step round to the same number. A wall $100$ away and a poster $0.001$ in front of it both store $16{,}762{,}114$ when near is $0.1$. The depth test then cannot tell which is in front: the two surfaces **fight**, flickering in stripes.',
      'How long is one step, as a distance? Differentiating the depth formula gives $\\Delta d \\approx \\frac{d^2 (f - n)}{f \\, n \\, 2^{24}}$. It grows with the square of the distance, and it shrinks as the **near plane** moves out: near $0.01$ gives $0.06$ at $100$; near $1$ gives $0.0006$. Moving far out hardly matters, because $(f - n) / f$ is almost $1$ whatever $f$ is.',
      'Sometimes two surfaces really are at the same depth: a wireframe drawn on top of its own faces, or a decal on a wall. Rounding then makes them tie at random. **Polygon offset** shifts one of them a few depth steps nearer (or further) before the test, so the same one always wins. **X-ray** goes the other way: faces stop writing depth at all and are drawn see-through.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: The depth test, and choosing near and far',
        body: 'Step 1. Clear every pixel\'s depth to $1$ (the far plane).\nStep 2. For each fragment, compute its depth: blend the corners\' depths with the barycentric weights.\nStep 3. If the fragment\'s depth is less than the stored depth, write its colour and its depth; otherwise drop it.\nStep 4. To check precision at distance $d$: one step is $d^2 (f - n) / (f \\, n \\, 2^{\\text{bits}})$.\nStep 5. If surfaces $\\delta$ apart fight at distance $d$, raise $n$ until the step is below $\\delta$: $n \\ge \\frac{d^2 f}{\\delta f 2^{\\text{bits}} + d^2}$.\nStep 6. For surfaces meant to lie on each other (outlines, decals), add a polygon offset of a few steps to one of them.',
      },
      {
        type: 'warning',
        title: 'Raise near, not far',
        body: 'Depth precision is set almost entirely by the near plane. Pushing far from $1000$ to $100{,}000$ changes the step at $100$ by less than $0.1\\%$; pulling near in from $1$ to $0.01$ makes it $100$ times coarser. Set near as far out as the closest thing you need to see.',
      },
      {
        type: 'warning',
        title: 'Transparent things and the depth buffer',
        body: 'A see-through surface must not hide what is behind it, so it is usually drawn without writing depth, after everything solid, back to front. That is what X-ray does to every face.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: the Z-test and polygon offset',
        body: 'GPUs do the depth test in hardware, often before the fragment shader runs (early-z), so hidden pixels cost almost nothing. WebGL\'s gl.polygonOffset(factor, units) shifts a triangle\'s depth by a slope-dependent amount plus a few steps: MeshLab draws faces with an offset of 1 so the wire and selection outlines drawn over them always win.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "z-fighting is random flicker". It is rounding: with 8 bits, the orange surface (nearer on the left) wins only where the two depths happen to round to different numbers, which makes stripes along lines of equal depth. Invariant: on the right half, where orange is further away, it never wins at any number of bits. Try 16 and 24.',
      },
      { type: 'insight', title: 'Bridge: from the chain rule to code', body: 'draw() in cell 1 is Steps 1 to 3; step() in cell 3 is Step 4; the challenge is Step 5.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'The depth buffer is a second image the size of the screen, cleared each frame; three.js turns the test on for every material unless depthTest or depthWrite is set to false.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Object › Trace the depth buffer (camera) takes the first two meshes through the selected camera\'s depth buffer and reports whether they fight. The Inspector\'s Near, far fields set the camera\'s planes; X-ray turns off depth writes for faces.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: a depth buffer',
        caption: 'The depth test, uneven depth, the resolution formula, z-fighting stripes, and polygon offset.',
        props: {
          lesson: {
            title: 'The depth buffer',
            subtitle: 'Keep the nearest surface per pixel; measure how far apart surfaces must be to stay apart.',
            cells: [
              { type: 'js', instruction: '### 1. The depth test\nThe same picture in either drawing order with the test; without it, the last drawn wins.', startCode: ZTEST },
              { type: 'js', instruction: '### 2. Depth is uneven\nPredict first: what depth does a point 10 in front get, with near 0.1 and far 1000? Then a wall and a poster 0.001 apart.', startCode: PRECISION },
              { type: 'js', instruction: '### 3. One step, as a distance\nThe resolution at 1, 10 and 100 for three near planes, and what a much further far plane does.', startCode: RESOLUTION },
              { type: 'js', instruction: '### 4. Z-fighting\nTwo surfaces 0.00025 apart. With 8 bits, the nearer one wins only in stripes. Change bits to 16 and 24.', startCode: STRIPES, showPreviewByDefault: true, outputHeight: 360 },
              { type: 'js', instruction: '### 5. Polygon offset\nA decal on the same surface ties at random; an offset of a few steps settles it.', startCode: OFFSET },
              { type: 'challenge', instruction: '### 6. Challenge: the near plane\nFind the smallest near plane that stops the poster fighting the wall. The check says if it still fights, or wastes too much.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkNear },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "The depth buffer" in MeshLab](#/lab/mesh-lab?project=depth-buffer). Look through the camera (0) to see the poster fight the wall. With **Record traces** on, **Object › Trace the depth buffer (camera)** stores both in a 24-bit buffer. In **Predict** mode, predict the wall\'s depth and the resolution at 100. Then set Near to 1 and trace again.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Inspector › Camera › Near, far:** the camera\'s planes. Raise near to cure z-fighting.\n- **X-ray** (toolbar): faces see-through, not writing depth; edges and vertices show through.\n- **Wire** draws edges over faces, which MeshLab offsets so the edges win.\n- **Object › Trace the depth buffer (camera)** traces two meshes through the depth buffer. In a script: camera.near = 1, camera.traceDepth(a, b).\n- **In Blender:** the camera\'s Clip Start and Clip End are near and far; the viewport has its own in the View sidebar. Alt+Z toggles X-ray.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Why depth goes as $1 / d$.** After the divide (lesson 3.2), NDC depth is $\\frac{f + n}{f - n} - \\frac{2 f n}{(f - n) d}$: a constant minus a multiple of $1 / d$. Moving it from $[-1, 1]$ to $[0, 1]$ gives $\\text{depth}(d) = \\frac{f (d - n)}{d (f - n)}$. At $d = n$ it is $0$; at $d = f$ it is $1$.',
      '**Why one step is $d^2 (f - n) / (f n 2^{b})$.** The depth changes with distance at the rate $\\frac{d}{dd} \\text{depth} = \\frac{f n}{(f - n) d^2}$. One stored step is $1 / 2^{b}$ of depth. Dividing, one step covers a distance of $\\frac{1}{2^{b}} \\cdot \\frac{(f - n) d^2}{f n}$.',
      '**Why near matters and far does not.** In $\\frac{f - n}{f n}$, the far plane appears as $\\frac{f - n}{f}$, which is close to $1$ for any $f$ much bigger than $n$. The near plane appears as $1 / n$ directly. So the step is roughly $d^2 / (n \\, 2^{b})$.',
      '**Why the smallest near is a formula.** Setting the step equal to the gap $\\delta$: $d^2 (f - n) = \\delta f n 2^{b}$, so $d^2 f = n (\\delta f 2^{b} + d^2)$, and $n = \\frac{d^2 f}{\\delta f 2^{b} + d^2}$. For $d = 100$, $f = 1000$, $\\delta = 0.001$, $b = 24$: $n = 0.5957$.',
    ],
    equations: [
      { label: 'Stored depth', latex: '\\text{depth}(d) = \\frac{f (d - n)}{d (f - n)}, \\qquad \\text{stored} = \\operatorname{round}\\big(\\text{depth} \\cdot (2^{b} - 1)\\big)' },
      { label: 'Depth resolution', latex: '\\Delta d \\approx \\frac{d^2 (f - n)}{f \\, n \\, 2^{b}}' },
      { label: 'Smallest near plane', latex: 'n_{\\text{min}} = \\frac{d^2 f}{\\delta f 2^{b} + d^2}' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** The depth test computes, for each pixel, the minimum of the fragments\' depths over all triangles covering it, in any order, because minimum is associative and commutative. With finite precision it computes the minimum of the rounded depths; ties are broken by draw order and the comparison chosen (less, or less-or-equal).',
      '**Invariant viewpoint.** The visible surface at a pixel does not depend on the order objects are drawn: that order independence is what the depth buffer buys. What it does not preserve is anything that needs several surfaces per pixel, such as transparency, which is why see-through objects are sorted instead.',
      '**Geometric picture.** The stored depths divide space in front of the camera into slabs, one per whole number. They are thin near the camera and grow as $d^2$: by $100$ with near $0.01$, a slab is $6$ cm deep. Two surfaces in the same slab are indistinguishable.',
      '**Where this goes.** Reversed-Z (storing $1$ at near and $0$ at far in floating point) spreads precision almost evenly and is used by modern engines. Shadow maps (chapter 9) are depth buffers rendered from a light, and fight in the same way (shadow acne), cured by the same offset (a bias). Picking by colour (lesson 4.1) reads the depth buffer to find what is under the mouse.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-3-004-ex1',
      title: 'The test at one pixel',
      problem: 'A pixel\'s stored depth is $1$. A red fragment at depth $0.6$ arrives, then a blue one at $0.8$, then a green one at $0.4$. What colour is the pixel?',
      steps: [
        { expression: '0.6 < 1 \\Rightarrow \\text{red}, \\text{ stored } 0.6', annotation: 'Step 3: nearer than what is there, so it is kept.' },
        { expression: '0.8 > 0.6 \\Rightarrow \\text{dropped}', annotation: 'Blue is behind red.' },
        { expression: '0.4 < 0.6 \\Rightarrow \\text{green}, \\text{ stored } 0.4', annotation: 'Green is nearest so far.' },
      ],
      conclusion: 'The pixel ends green: the nearest of the three, whatever the order they came in.',
    },
    {
      id: 'modelling-geometry-3-004-ex2',
      title: 'Two surfaces in one step',
      problem: 'Near $0.1$, far $1000$, $24$ bits. A wall is $100$ away and a poster $0.001$ in front of it. Do they fight?',
      steps: [
        { expression: '\\text{depth}(100) = \\frac{1000 \\times 99.9}{100 \\times 999.9} = 0.9990999', annotation: 'Step 2, for the wall.' },
        { expression: '\\Delta d = \\frac{100^2 \\times 999.9}{1000 \\times 0.1 \\times 2^{24}} = 0.00596', annotation: 'Step 4: one step at 100 is 6 mm long.' },
        { expression: '0.001 < 0.00596', annotation: 'The poster is less than one step in front.' },
        { expression: '\\text{both store } 16{,}762{,}114', annotation: 'Cell 2 confirms it.' },
      ],
      conclusion: 'They fight: the gap, $1$ mm, is smaller than one depth step, $6$ mm, at that distance.',
    },
    {
      id: 'modelling-geometry-3-004-ex3',
      title: 'Fixing it with the near plane',
      problem: 'Keep far $= 1000$. What is the smallest near plane that separates the poster from the wall?',
      steps: [
        { expression: 'n = \\frac{d^2 f}{\\delta f 2^{24} + d^2} = \\frac{10^4 \\times 1000}{0.001 \\times 1000 \\times 2^{24} + 10^4}', annotation: 'Step 5, with d = 100, δ = 0.001.' },
        { expression: '= \\frac{10^7}{16{,}777{,}216 + 10{,}000} = 0.5957', annotation: 'Just under 0.6.' },
        { expression: '\\Delta d (n = 1) = 0.000595 < 0.001', annotation: 'Check with near 1: separated, with room to spare.' },
      ],
      conclusion: 'Any near plane from about $0.6$ up separates them; near $1$ stores $16{,}626{,}069$ and $16{,}626{,}067$, two steps apart.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-3-004-ch1',
      difficulty: 'easy',
      problem: 'With near $1$ and far $100$, what depth (0 to 1) does a point $2$ in front get?',
      walkthrough: [
        { expression: '\\frac{100 \\times (2 - 1)}{2 \\times 99} = \\frac{100}{198} = 0.505', annotation: 'Step 2\'s formula.' },
      ],
      answer: 'About 0.505: a point only 2 in front is already past halfway through the depth range.',
    },
    {
      id: 'modelling-geometry-3-004-ch2',
      difficulty: 'medium',
      problem: 'A road and its painted lines fight far from the camera. A teammate doubles the far plane from $1000$ to $2000$ "to give more depth range". Does it help?',
      walkthrough: [
        { expression: '\\Delta d \\propto \\frac{f - n}{f n}', annotation: 'The far plane appears only as (f − n) / f.' },
        { expression: '\\frac{999}{1000} \\to \\frac{1999}{2000}', annotation: 'With n = 1: 0.999 to 0.9995.' },
        { expression: '\\text{change: } +0.05\\%', annotation: 'The step at any distance gets very slightly worse.' },
      ],
      answer: 'No: it makes each depth step about 0.05% coarser; the cure is to raise the near plane, which scales the step down in proportion.',
    },
    {
      id: 'modelling-geometry-3-004-ch3',
      difficulty: 'hard',
      problem: 'A modelling tool draws each face and then its outline exactly on top. The outline breaks into dashes. Explain, and give two fixes with their costs.',
      walkthrough: [
        { expression: '\\text{same surface, different rasterization} \\Rightarrow \\text{depths differ by rounding}', annotation: 'Lines and triangles compute depth slightly differently, so they tie or swap at random.' },
        { expression: '\\text{fix 1: polygon offset on the faces}', annotation: 'Push the faces a few steps back so the outline always wins. Costs nothing; a large offset lets lines show through nearby faces.' },
        { expression: '\\text{fix 2: draw outlines with no depth test}', annotation: 'Always on top, like X-ray; but outlines of hidden faces then show too.' },
      ],
      answer: 'The outline and the face are at the same depth and round differently pixel by pixel, so they tie at random; offset the faces back a few steps (MeshLab does, with factor 1), or draw the outline without the depth test, which also shows hidden edges.',
    },
  ],

  semantics: {
    core: [
      { symbol: '\\text{depth}(d)', meaning: 'The depth stored for a point d in front: 0 at the near plane, 1 at the far, spread as 1 / d.' },
      { symbol: 'n, \\; f', meaning: 'The near and far planes; n sets the depth precision almost by itself.' },
      { symbol: 'b', meaning: 'The number of bits per pixel in the depth buffer, usually 24: depths are kept as whole numbers below 2^b.' },
      { symbol: '\\Delta d', meaning: 'One depth step as a distance at d: d²(f − n)/(f n 2^b). Surfaces closer than this fight.' },
      { symbol: '\\text{depth test}', meaning: 'Keep a fragment only if its depth is smaller than the stored one, then store it.' },
      { symbol: '\\text{polygon offset}', meaning: 'A small shift in depth only, so a surface lying exactly on another always wins (or loses).' },
    ],
    rulesOfThumb: [
      'Set the near plane as far out as you can; leave far wherever it is convenient.',
      'Depth resolution grows with the square of the distance: what is fine at 10 fights at 100.',
      'If two surfaces are meant to touch, offset one; do not rely on rounding.',
      'Transparent things: draw after the solid ones, without writing depth.',
      'Z-fighting that forms stripes along a surface is rounding, not a bug in the model.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-3-002', label: 'Projection', note: 'Depth after the divide goes as 1 / distance; near and far map to the ends.' },
      { lessonId: 'modelling-geometry-3-003', label: 'Rasterization', note: 'Each fragment\'s depth is blended from the corners with barycentric weights.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-3-006', label: 'Lines, outlines and overlays', note: 'Outlines rely on polygon offset and on the stencil test, a second per-pixel buffer.' },
      { lessonId: 'modelling-geometry-4-001', label: 'Picking by ray', note: 'What is under the mouse is the nearest surface, the same question the depth test answers.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-3-004-1', label: 'Read how the depth test keeps the nearest fragment', type: 'read' },
    { id: 'cp-modelling-geometry-3-004-2', label: 'Read why depth is uneven and how one step is measured', type: 'read' },
    { id: 'cp-modelling-geometry-3-004-3', label: 'Read why the near plane, not the far, sets precision', type: 'read' },
    { id: 'cp-modelling-geometry-3-004-4', label: 'Run cells 1 to 3 and compare the steps for three near planes', type: 'lab' },
    { id: 'cp-modelling-geometry-3-004-5', label: 'Run cell 4 at 8, 16 and 24 bits, and trace the depth buffer in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-3-004-6', label: 'Work through example 2, two surfaces in one step', type: 'example' },
    { id: 'cp-modelling-geometry-3-004-7', label: 'Work through example 3, fixing it with the near plane', type: 'example' },
    { id: 'cp-modelling-geometry-3-004-8', label: 'Complete the challenge: the smallest near plane', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-3-004-assess-1',
        type: 'choice',
        text: 'Two surfaces fight at distance 50. Which change helps most?',
        options: ['Raise the near plane from 0.01 to 0.5', 'Raise the far plane from 1000 to 10000', 'Lower the far plane from 1000 to 900', 'Draw the nearer surface first'],
        answer: 'Raise the near plane from 0.01 to 0.5',
        hint: 'One step is about d² / (n · 2^24): it scales with 1 / near, and hardly at all with far.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-3-004-quiz-1',
      type: 'choice',
      text: 'A pixel stores depth 0.5. A fragment arrives at depth 0.7. What happens?',
      options: ['It is dropped', 'It replaces the stored colour and depth', 'It is blended with the stored colour', 'The stored depth becomes 0.7, but the colour stays'],
      answer: 'It is dropped',
      hints: ['Smaller depth is nearer.', '0.7 is behind 0.5.'],
      reviewSection: 'Procedure step 3, and example 1',
    },
    {
      id: 'modelling-geometry-3-004-quiz-2',
      type: 'choice',
      text: 'With near 0.1 and far 1000, roughly what depth does a point 10 in front get?',
      options: ['0.99', '0.01', '0.5', '0.1'],
      answer: '0.99',
      hints: ['Depth goes as 1 / distance.', 'f (d − n) / (d (f − n)) with d = 10.'],
      reviewSection: 'Intuition: the prediction, and cell 2',
    },
    {
      id: 'modelling-geometry-3-004-quiz-3',
      type: 'choice',
      text: 'How does one depth step (as a distance) change when the distance doubles?',
      options: ['It becomes 4 times longer', 'It doubles', 'It stays the same', 'It halves'],
      answer: 'It becomes 4 times longer',
      hints: ['Δd ≈ d² (f − n) / (f n 2^b).', 'The square of the distance.'],
      reviewSection: 'Math: "Why one step is d²(f − n)/(f n 2^b)"',
    },
    {
      id: 'modelling-geometry-3-004-quiz-4',
      type: 'choice',
      text: 'Which of these is NOT a cure for z-fighting?',
      options: ['Raising the far plane', 'Raising the near plane', 'Moving the surfaces further apart', 'Polygon offset on one of them'],
      answer: 'Raising the far plane',
      hints: ['Far appears only as (f − n) / f.', 'That ratio is about 1 for any large far.'],
      reviewSection: 'Warning "Raise near, not far"',
    },
    {
      id: 'modelling-geometry-3-004-quiz-5',
      type: 'choice',
      text: 'What does X-ray mode do to faces?',
      options: ['Draws them see-through and stops them writing depth', 'Removes them', 'Draws them with polygon offset', 'Turns off the near plane'],
      answer: 'Draws them see-through and stops them writing depth',
      hints: ['Things behind must show through.', 'A surface that writes depth hides what is behind it.'],
      reviewSection: 'Intuition: the last paragraph, and warning "Transparent things and the depth buffer"',
    },
    {
      id: 'modelling-geometry-3-004-quiz-6',
      type: 'choice',
      text: 'With the depth test on, does drawing order change which surface you see at a pixel (ignoring exact ties)?',
      options: ['No: the nearest wins in any order', 'Yes: the last drawn wins', 'Yes: the first drawn wins', 'Only for transparent surfaces'],
      answer: 'No: the nearest wins in any order',
      hints: ['The test keeps the minimum depth.', 'Cell 1 draws both orders.'],
      reviewSection: 'Intuition: the second paragraph, and cell 1',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'Depth is spread evenly from the near plane to the far plane.',
      whyStudentsThinkIt: 'Near and far map to 0 and 1, so it seems natural that halfway maps to 0.5.',
      correctionExample: 'With near 0.1 and far 1000, a point 10 in front already has depth 0.990: 99% of the range is used in the first 1% of the distance.',
      contrastCase: 'An orthographic camera\'s depth is spread evenly, because it has no divide by distance.',
    },
    {
      falseBelief: 'A bigger far plane means less precision, so shrinking far fixes z-fighting.',
      whyStudentsThinkIt: 'More range to cover with the same bits sounds like coarser steps.',
      correctionExample: 'Going from far 1000 to far 100000 at near 1 changes the step at 100 from 5.955e-4 to 5.960e-4: almost nothing.',
      contrastCase: 'Going from near 0.01 to near 1 changes the step at 100 from 0.06 to 0.0006: 100 times finer.',
    },
    {
      falseBelief: 'Z-fighting is a random glitch of the graphics card.',
      whyStudentsThinkIt: 'It flickers as the camera moves, which looks random.',
      correctionExample: 'In cell 4 the stripes are exactly where two depths round to different numbers; the same inputs always give the same stripes.',
      contrastCase: 'Separated by more than one step, the surfaces never fight: at 16 bits the left half is almost all orange.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A flight simulator must show the cockpit 0.3 m away and mountains 50 km away in one view.',
      competingTechniques: ['One camera with near 0.01 and far 50,000', 'Two passes: the cockpit with near 0.1 and far 5, then the world with near 5 and far 50,000, clearing depth between', 'Raise far to 1,000,000'],
      whyThisTechniqueWins: 'Splitting the depth range lets each pass have a sensible near plane; one camera with near 0.01 gives a step of metres at 50 km, and raising far changes almost nothing.',
    },
    {
      situation: 'Bullet-hole decals flicker on walls in a game.',
      competingTechniques: ['Move each decal 1 cm off the wall', 'Draw decals with a small polygon offset towards the camera'],
      whyThisTechniqueWins: 'An offset in depth only keeps the decal exactly on the wall in the picture; moving it 1 cm makes it visibly float at grazing angles and still fights far away.',
    },
  ],

  debugging: [
    {
      commonError: 'Setting the near plane to something tiny "so nothing is ever clipped".',
      symptom: 'Distant surfaces that are close together shimmer and stripe; the problem gets worse further away.',
      whyItHappened: 'The depth step scales as 1 / near: near 0.001 makes it 1000 times coarser than near 1.',
      repairStrategy: 'Set near to the closest distance you actually need (often 0.1 to 1 for a scene in metres), and check the step at the furthest important distance.',
    },
    {
      commonError: 'Drawing transparent objects with depth writes on.',
      symptom: 'Objects behind a window vanish when the window is drawn first.',
      whyItHappened: 'The window wrote its depth, so everything behind it failed the depth test.',
      repairStrategy: 'Draw opaque objects first, then transparent ones back to front with depthWrite: false.',
    },
    {
      commonError: 'Comparing depths with "less" when two passes draw the same geometry.',
      symptom: 'A second pass over the same mesh (an outline, a highlight) draws nothing.',
      whyItHappened: 'Its depth equals what the first pass stored, and "less" rejects equal depths.',
      repairStrategy: 'Use "less or equal" for the second pass, or a polygon offset.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Run the depth test by hand, compute a point\'s stored depth, the depth step at a distance, and the smallest near plane that separates two surfaces.',
    explainVerbally: 'Explain why depth goes as 1 / distance, why the step grows as d², and why near matters and far does not.',
    detectIncorrectApplication: 'Recognise z-fighting from its stripes, a near plane set too small, and transparency drawn with depth writes on.',
    transferToUnfamiliar: 'Split a huge depth range into passes, or choose polygon offset for decals and outlines.',
  },
};
