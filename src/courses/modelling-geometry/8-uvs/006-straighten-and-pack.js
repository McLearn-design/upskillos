// Lesson 8.6: straighten and pack. After flattening, each chart is turned to its smallest bounding box (one side lies
// along a hull edge: rotating calipers), scaled so its UV area equals its surface area (equal texel density), and the
// boxes are packed into the square: shelf packing, tallest first. Texel density = texture size / layout size.

const BASE = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const turn = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)]
const box = (P) => { const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]); return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) } }
`;

const CALIPERS = `${BASE}
// A four-sided chart (a long, slightly crooked strip), left at 30° by its pins.
// Predict first: how much smaller can its box get, and along which edge?
const chart = [[0, 0], [3, 0], [3.4, 1.1], [0.3, 0.8]].map((p) => turn(p, Math.PI / 6))
const b0 = box(chart)
console.log('as it is: ' + r(b0.w) + ' × ' + r(b0.h) + ' = ' + r(b0.w * b0.h))
// The smallest box has a side along one of the chart's (convex hull's) edges: try each edge direction.
let best = null
chart.forEach((p, i) => {
  const q = chart[(i + 1) % chart.length], a = Math.atan2(q[1] - p[1], q[0] - p[0]), b = box(chart.map((x) => turn(x, -a)))
  console.log('along edge ' + i + ' (' + r(a * 180 / Math.PI) + '°): ' + r(b.w) + ' × ' + r(b.h) + ' = ' + r(b.w * b.h))
  if (!best || b.w * b.h < best.area) best = { a, area: b.w * b.h }
})
console.log('smallest: turn by ' + r(-best.a * 180 / Math.PI) + '°, area ' + r(best.area))`;

const DENSITY = `${BASE}
// Two charts come out of LSCM at arbitrary scales: chart A covers 2 units² of surface but 0.5 of UV; chart B covers
// 1 unit² of surface and 1 of UV. Predict first: by what factor is each scaled for equal texel density?
const charts = [{ name: 'A', surface: 2, uv: 0.5 }, { name: 'B', surface: 1, uv: 1 }]
for (const c of charts) {
  const s = Math.sqrt(c.surface / c.uv)                     // areas scale by s², so lengths by s
  console.log(c.name + ': scale ' + r(s) + ', UV area after ' + r(c.uv * s * s) + ' = surface area')
}
// Before scaling, the same 1024² texture would give A only half as many texels per unit length as B.
const before = charts.map((c) => Math.sqrt(c.uv / c.surface)), after = charts.map(() => 1)
console.log('texels per unit length, relative: before ' + before.map(r).join(' : ') + ', after ' + after.join(' : '))`;

const SHELVES = `${BASE}
// Shelf packing: boxes left to right along a shelf; a new shelf above when the next will not fit.
let seed = 7
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const boxes = Array.from({ length: 24 }, () => ({ w: 0.2 + rand(), h: 0.2 + rand() }))
function shelves(list, rowWidth, gap = 0.02) {
  let x = gap, y = gap, rowH = 0, maxX = 0
  const at = []
  for (const b of list) {
    if (x + b.w + gap > rowWidth + gap && x > gap) { x = gap; y += rowH + gap; rowH = 0 }
    at.push([x, y]); x += b.w + gap; rowH = Math.max(rowH, b.h); maxX = Math.max(maxX, x)
  }
  const size = Math.max(maxX, y + rowH + gap), area = list.reduce((s, b) => s + b.w * b.h, 0)
  return { at, size, fill: area / (size * size) }
}
const total = boxes.reduce((s, b) => s + (b.w + 0.02) * (b.h + 0.02), 0), rowWidth = Math.sqrt(total) * 1.15
// Predict first: does sorting tallest first fill the square better?
const plain = shelves(boxes, rowWidth), sorted = shelves([...boxes].sort((a, b) => b.h - a.h), rowWidth)
console.log('in the order given: ' + r(100 * plain.fill) + '% of the square used')
console.log('tallest first: ' + r(100 * sorted.fill) + '% used')`;

const PICTURE = `${BASE}
// The 24 boxes packed tallest first, drawn in the unit square. Each shelf is as tall as its tallest box: the gaps above
// the shorter boxes are texture memory that nothing uses.
let seed = 7
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const boxes = Array.from({ length: 24 }, () => ({ w: 0.2 + rand(), h: 0.2 + rand() })).sort((a, b) => b.h - a.h)
const gap = 0.02, total = boxes.reduce((s, b) => s + (b.w + gap) * (b.h + gap), 0), rowWidth = Math.sqrt(total) * 1.15
let x = gap, y = gap, rowH = 0, maxX = 0
const at = [], shelfTops = []
for (const b of boxes) {
  if (x + b.w + gap > rowWidth + gap && x > gap) { shelfTops.push(y + rowH); x = gap; y += rowH + gap; rowH = 0 }
  at.push([x, y]); x += b.w + gap; rowH = Math.max(rowH, b.h); maxX = Math.max(maxX, x)
}
shelfTops.push(y + rowH)
const size = Math.max(maxX, y + rowH + gap)
const canvas = document.createElement('canvas'), W = 300, H = 300
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'); g.scale(2, 2); g.fillStyle = '#0f1923'; g.fillRect(0, 0, W, H)
const s = (W - 20) / size, X = (u) => 10 + u * s, Y = (v) => H - 10 - v * s
g.strokeStyle = '#64748b'; g.strokeRect(X(0), Y(size), size * s, size * s)
boxes.forEach((b, i) => { g.fillStyle = 'hsl(' + (i * 47) % 360 + ', 60%, 55%)'; g.fillRect(X(at[i][0]), Y(at[i][1] + b.h), b.w * s, b.h * s) })
g.strokeStyle = '#facc15'; g.setLineDash([4, 3]); for (const t of shelfTops) { g.beginPath(); g.moveTo(X(0), Y(t)); g.lineTo(X(size), Y(t)); g.stroke() }
console.log(shelfTops.length + ' shelves; ' + r(100 * boxes.reduce((s, b) => s + b.w * b.h, 0) / (size * size)) + '% of the square used')`;

const CHALLENGE = `// A model's charts are scaled to true area and packed; the layout's square is 4 surface units across. It gets a
// 2048 × 2048 texture. A round bolt head on the model is 0.25 units across. How many texels wide is it?
const texels = 0
console.log(texels)`;

const SOLVED = CHALLENGE.replace('const texels = 0', 'const texels = 2048 / 4 * 0.25');

/** The challenge's check: density = 2048 / 4 = 512 texels per unit, so 0.25 units = 128 texels. */
export function checkTexels(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+texels\s*=\s*([^\n]+)/);
  if (!m) return no('Keep the line const texels = …, with a number or plain arithmetic.');
  const expr = m[1].replace(/\/\/.*$/, '').trim().replace(/;$/, '');
  // Only plain arithmetic is evaluated: this runs in the page, not the cell's sandbox.
  if (!/^[\d.\s+\-*/()]+$/.test(expr)) return no('Write the count as a number or plain arithmetic, like 2048 / 2.');
  let v;
  try { v = Number(new Function('return (' + expr + ')')()); } catch { return no('That expression did not run.'); }
  if (!Number.isFinite(v)) return no('The count must be a number.');
  const near = (x) => Math.abs(v - x) < 1e-6;
  if (near(128)) return { pass: true, message: '128: the 2048 texels span the layout\'s 4 units, so the texel density is 512 texels per unit of surface, everywhere on the model (every chart was scaled to its true area). The 0.25-unit bolt head gets 512 × 0.25 = 128 texels across.' };
  if (v === 0) return no('First find the texel density: how many texels per unit of surface?');
  if (near(512)) return no('512 is the texel density, texels per unit of surface. The bolt head is only 0.25 units across.');
  if (near(2048 * 0.25)) return no('2048 × 0.25 treats the layout as 1 unit across. It is 4 units across, so each texel covers more surface.');
  if (near(2048)) return no('2048 is the whole texture\'s width. Divide by the layout\'s 4 units for the density, then multiply by the bolt\'s 0.25.');
  if (near(2048 * 4)) return no('The layout is 4 units wide, so divide 2048 by 4, not multiply.');
  return no(`${v} is not right. Texels per unit = texture size / layout size; then times the bolt\'s width.`);
}

export default {
  id: 'modelling-geometry-8-006',
  slug: 'straighten-and-pack',
  chapter: 'modelling-geometry',
  order: 6,
  title: 'Straighten and pack',
  subtitle: 'Turning each chart to its tightest box, giving every chart its fair share of texels, and packing them into the square.',
  tags: ['uv', 'packing', 'bounding box', 'rotating calipers', 'shelf packing', 'texel density', 'texture atlas'],
  coreConcept: 'After flattening, the charts are laid out in the texture square. Each is turned so its bounding box is as small as possible; the smallest box of a convex polygon always has a side along one of its edges, so only the edge directions need trying (rotating calipers). Each chart is scaled by s = √(surface area / UV area) so that one unit of UV covers one unit of surface: equal texel density everywhere. The boxes are packed by shelves, tallest first, with a gap so filtering does not bleed between charts, and the whole layout is scaled into [0, 1]². Texel density is then texture size / layout size texels per unit of surface.',
  prerequisites: ['modelling-geometry-8-004', 'modelling-geometry-8-005'],
  timeToComplete: 35,
  nextLesson: 'modelling-geometry-9-001',

  hook: {
    question: 'Unwrap a model and every piece lands in the square at a random angle and size: one chart huge, another a speck, half the texture empty. How does a tool tidy them so no space is wasted and every part of the model gets the same sharpness?',
    realWorldContext: 'Texture atlases in games pack many charts (or many objects) into one texture to save memory and draw calls; artists check texel density so a character\'s face is not blurrier than its boots; lightmaps, decals and baked normal maps all depend on how well the charts are packed.',
  },

  intuition: {
    prose: [
      'LSCM leaves each chart at whatever angle its two pins set. A long thin chart standing diagonally wastes most of its bounding box. **Straighten** it: turn it until its box is smallest. The best box always has one side along one of the chart\'s (convex hull\'s) edges, so only those few directions need trying; that is the idea behind **rotating calipers**. Before running cell 1, predict how much a crooked strip left at $30°$ gains: its box shrinks from $7.26$ square units to $3.69$, along its long slanted edge.',
      'Next, **texel density**: how many texels cover one unit of surface. If one chart came out of the flattening at half the size of another, it gets a quarter of the texels per area and looks blurry. Scale each chart by $s = \\sqrt{\\text{surface area} / \\text{UV area}}$ (areas scale by $s^2$), so one unit of UV covers one unit of surface everywhere. Before running cell 2, predict the factor for a chart covering 2 units² of surface but 0.5 of UV: $2$.',
      'Then **pack** the boxes into the square. **Shelf packing** is simple and good: sort the boxes tallest first, place them left to right along a shelf, and start a new shelf above when the next one will not fit. Sorting matters because each shelf is as tall as its tallest box. Before running cell 3, predict whether tallest-first fills the square better than the given order.',
      'Last, scale the whole layout into the unit square. Every chart shrinks by the same factor, so densities stay equal. With a texture $T$ texels wide and a layout $L$ units wide, the density is $T/L$ texels per unit of surface. Packing tighter means a smaller $L$, so more texels for the same texture.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Straighten and pack',
        body: 'Step 1. For each chart, for each hull edge direction, turn the chart so that edge is horizontal and measure the box; keep the smallest.\nStep 2. Scale the chart by s = √(surface area / UV area).\nStep 3. Sort the boxes by height, tallest first.\nStep 4. Shelf by shelf: place left to right with a gap; start a new shelf when the next box will not fit in the row width (about √(total area) × 1.15).\nStep 5. Scale the layout into [0, 1]²; density = texture size / layout size.',
      },
      {
        type: 'warning',
        title: 'Leave a gap',
        body: 'Texture filtering and mipmaps blend neighbouring texels. Charts packed edge to edge bleed colour into each other at their borders, visibly along seams. Keep a few texels\' gap (and pad each chart\'s colour outward into it).',
      },
      {
        type: 'warning',
        title: 'Shelf packing is not optimal',
        body: 'Optimal packing is NP-hard. Shelves waste the space above short boxes; skyline and MaxRects packers fill gaps better, and some tools also try turning charts by 90°. Treat the fill percentage as a score to improve, not a fixed fact.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: texel density',
        body: 'Artists check density with a checker: on a well-packed model the squares are the same size on every part. Some tools deliberately give faces and hands more density than the soles of the feet, by scaling those charts up before packing.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "packing is just putting the pieces side by side". Each dashed line is the top of a shelf; the dark space above the shorter boxes, and at the ends of the shelves, is texture memory nothing uses.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'The edge loop in cell 1 is Step 1; s in cell 2 is Step 2; shelves() is Steps 3–4; the final division by size is Step 5.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'The GPU sees one texture and one UV per wedge; packing only moved the UVs. Mipmaps of an atlas average neighbouring charts at small sizes, which is why the gap matters more the further away the model is drawn.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Every UV › Unwrap packs. With Record traces on, packing is traced after the conformal solves: straighten chart 1, scale it to its true area (predict the factor), the shelves, and the fit with its fill percentage and texel density. The UV tab shows the layout; the Inspector\'s texture × sets the repeat.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: straightening and packing',
        caption: 'The smallest bounding box, equal texel density, shelf packing with and without sorting, and a packed layout.',
        props: {
          lesson: {
            title: 'Straighten and pack',
            subtitle: 'Tight boxes, fair shares, tidy shelves.',
            cells: [
              { type: 'js', instruction: '### 1. The smallest box\nPredict first: how much smaller, and along which edge?', startCode: CALIPERS },
              { type: 'js', instruction: '### 2. Equal texel density\nPredict first: the scale for chart A.', startCode: DENSITY },
              { type: 'js', instruction: '### 3. Shelf packing\nPredict first: does tallest-first help?', startCode: SHELVES },
              { type: 'js', instruction: '### 4. See it\nThe boxes on their shelves.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 360 },
              { type: 'challenge', instruction: '### 5. Challenge: texels on a bolt\nThe check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkTexels },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Straighten and pack" in MeshLab](#/lab/mesh-lab?project=pack-charts). A plank cut into six rectangles; the unwrap is traced through packing: press Play, and predict chart 1\'s scale.' },
              { type: 'markdown', instruction: '### Use the tool\n- **UV › Unwrap** packs automatically; the **UV tab** shows the layout.\n- Check density with the checker and the Inspector\'s texture ×.\n- [Open "Dining set"](#/lab/mesh-lab?project=dining-set): every box unwrapped and packed, with a wood texture.\n- **Elsewhere:** Blender\'s Pack Islands (with rotation and margin), xatlas, RectangleBinPack\'s MaxRects.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Minimum-area bounding box.** For a convex polygon, some minimum-area enclosing rectangle has a side collinear with a polygon edge (Freeman and Shapira, 1975). Rotating calipers walks the hull once and finds it in $O(n)$ after the hull; trying each edge direction directly is $O(n^2)$ and fine for small charts.',
      '**True area.** If a chart\'s UV area is $A_{uv}$ and its surface area $A$, scaling its UVs by $s = \\sqrt{A / A_{uv}}$ makes the areas equal, because areas scale by $s^2$. After every chart is scaled this way, one unit of UV is one unit of surface on average over each chart (exactly, if the chart is flat).',
      '**Texel density.** With the layout $L$ units wide scaled into a texture $T$ texels wide, every unit of surface gets $T/L$ texels per unit length, $(T/L)^2$ per unit area.',
      '**Packing.** Packing rectangles into the smallest square is NP-hard. Shelf packing with decreasing height is a classic approximation: its waste is bounded by the height differences within each shelf, which sorting keeps small.',
    ],
    equations: [
      { label: 'True-area scale', latex: 's = \\sqrt{A / A_{uv}}' },
      { label: 'Texel density', latex: '\\rho = \\frac{T}{L} \\text{ texels per unit length}' },
      { label: 'Fill', latex: '\\frac{\\sum_i w_i h_i}{L^2}' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** Given charts with UV areas A_uv,i and surface areas A_i, the layout that scales each chart by √(A_i / A_uv,i) and then the whole layout uniformly gives every chart the same ratio of texture area to surface area. Any packing of their bounding boxes into a square of side L then yields density T/L; minimising L over packings is the 2D bin-packing problem.',
      '**Invariant viewpoint.** Turning a chart or moving it in the square changes no distortion measure (σ₁, σ₂ are unchanged by rotations); only scaling changes area scale, and the true-area step undoes whatever scale the flattening happened to choose.',
      '**Geometric picture.** Trim each paper piece to the smallest rectangle around it, enlarge or shrink it to life size, then file them on shelves tallest first.',
      '**Where this goes.** Chapter 9 reads textures through these UVs: shading, normal maps and baked lighting all assume charts with equal density and clean gaps.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-8-006-ex1',
      title: 'A diagonal box',
      problem: 'A $2 \\times 1$ chart stands at $45°$. What is its axis-aligned box, and its smallest box?',
      steps: [{ expression: '(2 + 1)/\\sqrt2 \\text{ each way}: \\; 2.121^2 = 4.5', annotation: 'Width and height are both (2 cos 45° + 1 sin 45°).' }],
      conclusion: '4.5 as it stands; 2 once turned along an edge.',
    },
    {
      id: 'modelling-geometry-8-006-ex2',
      title: 'True area',
      problem: 'A chart covers 6 units² of surface and 1.5 of UV. By what factor are its UVs scaled?',
      steps: [{ expression: '\\sqrt{6 / 1.5} = 2', annotation: 'Lengths by 2, areas by 4.' }],
      conclusion: '2.',
    },
    {
      id: 'modelling-geometry-8-006-ex3',
      title: 'Density',
      problem: 'A layout 2.5 units wide gets a 1024 × 1024 texture. Texels per unit of surface length?',
      steps: [{ expression: '1024 / 2.5 = 409.6', annotation: 'T / L.' }],
      conclusion: '409.6 texels per unit length.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-8-006-ch1',
      difficulty: 'easy',
      problem: 'Why does sorting tallest first help shelf packing?',
      walkthrough: [{ expression: '\\text{shelf height} = \\max h', annotation: 'Waste is the gap above shorter boxes.' }],
      answer: 'Each shelf is as tall as its tallest box, and the space above shorter boxes on that shelf is wasted. Sorting by height puts boxes of similar height on the same shelf, so that space is small.',
    },
    {
      id: 'modelling-geometry-8-006-ch2',
      difficulty: 'medium',
      problem: 'Two charts both cover 1 unit² of surface; after packing, one shows a checker square 4 times the size of the other\'s. What went wrong, and what is the fix?',
      walkthrough: [{ expression: '4^2 = 16', annotation: 'Area ratio of their texel densities.' }],
      answer: 'They were not scaled to true area: one has 4 times the texels per unit length of the other (16 times per area). Scale each by √(surface area / UV area) before packing.',
    },
    {
      id: 'modelling-geometry-8-006-ch3',
      difficulty: 'hard',
      problem: 'Explain why the smallest bounding box of a convex polygon has a side along one of its edges.',
      walkthrough: [
        { expression: 'A(\\theta) = w(\\theta)\\,h(\\theta)', annotation: 'Area as the box turns.' },
        { expression: '\\text{between edge directions, } w, h \\text{ are sums of } a\\cos\\theta + b\\sin\\theta', annotation: 'The same support points touch the box.' },
        { expression: 'A \\text{ is concave there, so its minimum is at an end}', annotation: 'An edge direction.' },
      ],
      answer: 'While the box turns between two edge directions, the same four hull vertices touch its sides, so its width and height are each of the form a cos θ + b sin θ and their product is a concave function of θ on that interval. A concave function takes its minimum at an end of the interval, which is an angle where a side lines up with an edge.',
    },
  ],

  semantics: {
    core: [
      { symbol: 's = \\sqrt{A / A_{uv}}', meaning: 'The true-area scale of a chart.' },
      { symbol: 'T', meaning: 'The texture\'s width in texels.' },
      { symbol: 'L', meaning: 'The layout\'s width in surface units.' },
      { symbol: 'T / L', meaning: 'Texel density: texels per unit of surface length.' },
      { symbol: '\\text{shelf}', meaning: 'A row of boxes, as tall as its tallest.' },
      { symbol: '\\text{fill}', meaning: 'The fraction of the square the charts cover.' },
    ],
    rulesOfThumb: [
      'Turn each chart along an edge.',
      'Scale every chart to true area.',
      'Tallest first.',
      'Leave a gap for filtering.',
      'Density = texture size / layout size.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-8-004', label: 'Conformal maps and LSCM', note: 'Where the charts\' angles and sizes come from.' },
      { lessonId: 'modelling-geometry-8-005', label: 'Measuring distortion', note: 'Area scale σ₁σ₂, which true-area scaling evens out.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-9-001', label: 'Chapter 9: Shading and textures', note: 'Reading textures through the packed UVs.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-8-006-1', label: 'Read why the smallest box lies along an edge', type: 'read' },
    { id: 'cp-modelling-geometry-8-006-2', label: 'Read true-area scaling and texel density', type: 'read' },
    { id: 'cp-modelling-geometry-8-006-3', label: 'Read shelf packing', type: 'read' },
    { id: 'cp-modelling-geometry-8-006-4', label: 'Run cells 1 to 3: boxes, density, shelves', type: 'lab' },
    { id: 'cp-modelling-geometry-8-006-5', label: 'Trace packing a plank in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-8-006-6', label: 'Work through example 1, a diagonal box', type: 'example' },
    { id: 'cp-modelling-geometry-8-006-7', label: 'Work through example 3, density', type: 'example' },
    { id: 'cp-modelling-geometry-8-006-8', label: 'Complete the challenge: texels on a bolt', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-8-006-assess-1',
        type: 'choice',
        text: 'A chart covers 8 units² of surface and 2 of UV. Its true-area scale is:',
        options: ['2', '4', '0.5', '16'],
        answer: '2',
        hint: '√(8 / 2).',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-8-006-quiz-1',
      type: 'choice',
      text: 'The smallest bounding box of a convex chart has a side:',
      options: ['Along one of the chart\'s edges', 'Always horizontal', 'Through its centre', 'At 45°'],
      answer: 'Along one of the chart\'s edges',
      hints: ['Cell 1.', 'Rotating calipers.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-8-006-quiz-2',
      type: 'choice',
      text: 'The crooked strip in cell 1, straightened along its best edge, has a box of area about:',
      options: ['3.69', '7.26', '6.19', '3.0'],
      answer: '3.69',
      hints: ['Cell 1.', 'The smallest of the four edge directions.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-8-006-quiz-3',
      type: 'choice',
      text: 'Each chart is scaled by √(surface area / UV area) so that:',
      options: ['Every part of the model gets the same texel density', 'The charts fit the square', 'Angles are kept', 'Seams disappear'],
      answer: 'Every part of the model gets the same texel density',
      hints: ['Cell 2.', 'Procedure, Step 2.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-8-006-quiz-4',
      type: 'choice',
      text: 'Shelf packing sorts boxes:',
      options: ['Tallest first', 'Widest first', 'Randomly', 'By chart number'],
      answer: 'Tallest first',
      hints: ['Cell 3.', 'Challenge 1.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-8-006-quiz-5',
      type: 'choice',
      text: 'Why leave a gap between packed charts?',
      options: ['So filtering and mipmaps do not bleed colour between charts', 'To make room for seams', 'To keep angles', 'GPUs need it'],
      answer: 'So filtering and mipmaps do not bleed colour between charts',
      hints: ['Warning "Leave a gap".', 'Mipmaps average neighbours.'],
      reviewSection: 'Warning "Leave a gap"',
    },
    {
      id: 'modelling-geometry-8-006-quiz-6',
      type: 'choice',
      text: 'A layout 4 units wide on a 2048² texture has a texel density of:',
      options: ['512 texels per unit', '8192', '2048', '128'],
      answer: '512 texels per unit',
      hints: ['T / L.', 'The challenge.'],
      reviewSection: 'Challenge',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'Packing is just putting the pieces side by side.',
      whyStudentsThinkIt: 'Any layout without overlaps works.',
      correctionExample: 'Cell 3 and the picture: the order alone changes how much of the square is used, and every unused texel is wasted memory and sharpness.',
      contrastCase: 'A single chart needs no packing beyond fitting it.',
    },
    {
      falseBelief: 'Bigger charts in the layout look sharper because they are more important.',
      whyStudentsThinkIt: 'Size in UV looks like priority.',
      correctionExample: 'Cell 2: before true-area scaling, chart size in UV is an accident of the flattening.',
      contrastCase: 'Artists may scale important charts up on purpose, after true-area scaling.',
    },
    {
      falseBelief: 'Straightening changes the texture distortion.',
      whyStudentsThinkIt: 'The chart moves.',
      correctionExample: 'Turning a chart does not change σ₁ or σ₂; only the box (and so the packing) gets better.',
      contrastCase: 'Scaling does change the area scale, which is the point of true-area scaling.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A game character\'s texture looks blurry on the face but sharp on the boots.',
      competingTechniques: ['A bigger texture', 'Check and equalise texel density, then deliberately enlarge the face chart'],
      whyThisTechniqueWins: 'The blur is the face chart\'s low density; equalising and then favouring the face fixes it without doubling memory.',
    },
    {
      situation: 'Hundreds of small props must share one texture atlas.',
      competingTechniques: ['One texture each', 'Pack all their charts into one atlas with gaps'],
      whyThisTechniqueWins: 'One atlas means one texture to bind and fewer draw calls; tight packing with gaps keeps density high without bleeding.',
    },
  ],

  debugging: [
    {
      commonError: 'Packing charts edge to edge with no gap.',
      symptom: 'Thin lines of the wrong colour along seams, worse at a distance.',
      whyItHappened: 'Bilinear filtering and mipmaps read across chart borders.',
      repairStrategy: 'Leave a gap of a few texels and pad colours outward.',
    },
    {
      commonError: 'Skipping true-area scaling.',
      symptom: 'Checker squares of different sizes on different parts.',
      whyItHappened: 'Each chart kept the scale its flattening gave it.',
      repairStrategy: 'Scale each chart by √(surface area / UV area) before packing.',
    },
    {
      commonError: 'Measuring the bounding box only at 0° and 90°.',
      symptom: 'Diagonal charts waste most of their box.',
      whyItHappened: 'The best angle is along a chart edge, usually neither.',
      repairStrategy: 'Try every hull edge direction.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Straighten a chart, compute true-area scales and pack boxes into a square.',
    explainVerbally: 'Explain rotating calipers, texel density and why shelves are sorted.',
    detectIncorrectApplication: 'Recognise missing gaps, unequal densities and unstraightened charts.',
    transferToUnfamiliar: 'Lay out texture atlases and lightmaps with a target texel density.',
  },
};
