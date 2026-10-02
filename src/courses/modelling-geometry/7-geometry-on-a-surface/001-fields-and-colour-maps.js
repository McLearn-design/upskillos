// Lesson 7.1: fields on a mesh and colour maps. A field is one number per vertex; between vertices it is
// interpolated linearly (barycentric weights). To show it, each value is turned into t ∈ [0, 1] by a range and then
// into a colour by a colour map; the GPU then blends the corners' colours, which is not the colour of the blended value.
import { withPicture } from '../notebookScene.js';

const HELPERS = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
// Turbo (Mikhailov 2019), the polynomial fit MeshLab uses: near-black → blue → cyan → green → yellow → dark red.
function turbo(t) {
  t = clamp01(t)
  const R = 0.13572138 + t * (4.6153926 + t * (-42.66032258 + t * (132.13108234 + t * (-152.94239396 + t * 59.28637943))))
  const G = 0.09140261 + t * (2.19418839 + t * (4.84296658 + t * (-14.18503333 + t * (4.27729857 + t * 2.82956604))))
  const B = 0.1066733 + t * (12.64194608 + t * (-60.58204836 + t * (110.36276771 + t * (-89.90310912 + t * 27.34824973))))
  return [clamp01(R), clamp01(G), clamp01(B)]
}
// Cool–warm for signed values: blue → near-white at the middle → red.
function coolwarm(t) {
  t = clamp01(t)
  const lo = [0.23, 0.3, 0.75], mid = [0.87, 0.87, 0.87], hi = [0.71, 0.02, 0.15]
  const [a, b, u] = t < 0.5 ? [lo, mid, t * 2] : [mid, hi, (t - 0.5) * 2]
  return a.map((x, k) => x + (b[k] - x) * u)
}
const rgb = (c) => '(' + c.map((x) => Math.round(x * 255)).join(', ') + ')'
// The hill of MeshLab's project, smaller: a 9 × 9 grid of vertices 4 wide, pushed up by a bump.
const N = 8, verts = [], faces = []
for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { const x = -2 + 4 * i / N, z = -2 + 4 * j / N; verts.push([x, 1.2 * Math.exp(-(x * x + z * z) / 1.5), z]) }
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) faces.push([i * (N + 1) + j, i * (N + 1) + j + 1, (i + 1) * (N + 1) + j + 1, (i + 1) * (N + 1) + j])
const height = verts.map((p) => p[1])            // the field: one number per vertex
`;

const FIELD = `${HELPERS}
// A field is an array with one number per vertex. Here, each vertex's height.
console.log(verts.length + ' vertices, ' + height.length + ' values')
console.log('the middle vertex (40): ' + r(height[40]) + '; a corner (0): ' + r(height[0]) + '; halfway out (38): ' + r(height[38]))
// Between vertices the field is interpolated (lesson 3.3): at a point with barycentric weights α, β, γ in a triangle
// a, b, c, the value is α f(a) + β f(b) + γ f(c). Predict first: the value at the centre of triangle 40, 41, 49?
const [a, b, c] = [40, 41, 49]
console.log('values at the corners: ' + [a, b, c].map((v) => r(height[v])).join(', ') + '; at the centre (⅓ each): ' + r((height[a] + height[b] + height[c]) / 3))`;

const RANGE = `${HELPERS}
// To colour a field, map each value into t ∈ [0, 1]: t = (value − low) / (high − low), clamped.
// Predict first: one vertex spikes to 12 (a measuring error). With low and high the min and max, how much of the hill
// gets t below 0.1?
const spiky = height.slice(); spiky[10] = 12
const tOf = (v, lo, hi) => clamp01((v - lo) / (hi - lo))
const share = (lo, hi) => spiky.filter((v) => tOf(v, lo, hi) < 0.1).length / spiky.length
const sorted = spiky.slice().sort((x, y) => x - y), pct = (p) => sorted[Math.round(p * (sorted.length - 1))]
console.log('min to max (' + r(sorted[0]) + ' to ' + r(sorted.at(-1)) + '): ' + Math.round(100 * share(sorted[0], sorted.at(-1))) + '% of vertices get t < 0.1, nearly one colour')
console.log('2nd to 98th percentile (' + r(pct(0.02)) + ' to ' + r(pct(0.98)) + '): ' + Math.round(100 * share(pct(0.02), pct(0.98))) + '%; the spike is clamped to t = 1')`;

const MAPS = `${HELPERS}
// Two colour maps, sampled. Turbo for values from low to high; cool–warm for signed values, centred on 0.
for (const t of [0, 0.25, 0.5, 0.75, 1]) console.log('t = ' + t + ': turbo ' + rgb(turbo(t)) + ', cool–warm ' + rgb(coolwarm(t)))
// How light each colour looks (relative luminance, Rec. 709): a map should not jump in lightness, or it shows edges
// that are not in the data.
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
console.log('turbo lightness: ' + [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => r(lum(turbo(t)))).join(', '))`;

const BLEND = `${HELPERS}
// The GPU is given a colour at each vertex and blends the colours across the triangle. Is that the colour of the
// blended value? Predict first: corners at t = 0, 0.5 and 1. At the centre, the value is t = 0.5: what does each give?
const corners = [0, 0.5, 1].map(turbo)
const blended = [0, 1, 2].map((k) => (corners[0][k] + corners[1][k] + corners[2][k]) / 3)
console.log('blended colours: ' + rgb(blended) + '; colour of the blended value, turbo(0.5): ' + rgb(turbo(0.5)))
// With more vertices the corners are closer together in t, and the difference shrinks.
for (const spread of [0.5, 0.2, 0.05]) {
  const ts = [0.5 - spread, 0.5, 0.5 + spread].map(clamp01), cs = ts.map(turbo)
  const b2 = [0, 1, 2].map((k) => (cs[0][k] + cs[1][k] + cs[2][k]) / 3), e = turbo((ts[0] + ts[1] + ts[2]) / 3)
  console.log('corners ' + ts.map(r).join(', ') + ': ' + Math.round(255 * Math.max(...b2.map((x, k) => Math.abs(x - e[k])))) + ' apart (out of 255)')
}`;

const PICTURE = withPicture(`${HELPERS}
// The hill coloured by height with turbo, one colour per vertex, blended by the GPU across every triangle.
let lo = Math.min(...height), hi = Math.max(...height)
const colors = height.map((v) => turbo((v - lo) / (hi - lo)))
console.log('heights ' + r(lo) + ' (darkest) to ' + r(hi) + ' (dark red)')
show({ verts, faces, colors, zoom: 1.4 })`);

const CHALLENGE = `// A signed field runs from −2 to 6. It is shown with a diverging map centred on 0, so the range is symmetric: −6 to 6.
// What t do the values 0 and 3 get?
const answer = { zero: 0, three: 0 }
console.log(answer)`;

const SOLVED = CHALLENGE.replace('const answer = { zero: 0, three: 0 }', 'const answer = { zero: 0.5, three: 0.75 }');

/** The challenge's check: with range −6 … 6, t(0) = 0.5 and t(3) = 0.75. */
export function checkDiverging(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+answer\s*=\s*\{([^}]*)\}/);
  if (!m) return no('Keep the line const answer = { zero: …, three: … }.');
  const get = (k) => { const g = m[1].match(new RegExp(k + '\\s*:\\s*(-?[\\d.]+)')); return g ? Number(g[1]) : NaN; };
  const zero = get('zero'), three = get('three');
  if ([zero, three].some(Number.isNaN)) return no('Give both as numbers: zero and three.');
  if (Math.abs(zero - 0.25) < 1e-6) return no('0.25 uses the range −2 to 6. A diverging map is symmetric round 0: −6 to 6, so 0 sits in the middle.');
  if (Math.abs(zero - 0.5) > 1e-6) return no(`t = (value − low) / (high − low) with low −6 and high 6: 0 is not at ${zero}.`);
  if (Math.abs(three - 0.625) < 1e-6) return no('0.625 uses the range −2 to 6. With −6 to 6: (3 + 6) / 12.');
  if (Math.abs(three - 0.5) < 1e-6) return no('3 is above 0, so it is past the middle: (3 + 6) / 12.');
  if (Math.abs(three - 0.75) > 1e-6) return no(`(3 − (−6)) / (6 − (−6)) is not ${three}.`);
  return { pass: true, message: '0.5 and 0.75. The diverging range is symmetric, −6 to 6, so 0 lands exactly on the near-white middle and 3 halfway into the reds; −2 gets t = 0.33, a pale blue. The blues never reach their darkest, because nothing is below −2.' };
}

export default {
  id: 'modelling-geometry-7-001',
  slug: 'fields-and-colour-maps',
  chapter: 'modelling-geometry',
  order: 1,
  title: 'Fields on a mesh and colour maps',
  subtitle: 'A number at every vertex, interpolated across faces, and turned into colours you can read.',
  tags: ['fields', 'colour maps', 'heat maps', 'interpolation', 'visualisation', 'turbo'],
  coreConcept: 'A field on a mesh is one number per vertex, extended across each face by linear (barycentric) interpolation. To show it, a range maps each value to t = (value − low) / (high − low), clamped to [0, 1], and a colour map turns t into a colour: turbo for values from low to high, a diverging map such as cool–warm, centred on zero, for signed values. A robust range (2nd to 98th percentile) stops a few extreme values from flattening everything else into one colour. The GPU blends the vertices\' colours across each triangle, which is not the colour of the interpolated value, so a coarse mesh can show colours that are not on the map.',
  prerequisites: ['modelling-geometry-6-005', 'modelling-geometry-3-003'],
  timeToComplete: 35,
  nextLesson: 'modelling-geometry-7-002',

  hook: {
    question: 'Curvature, temperature, distance, stress: all of them are a number at every point of a surface, and all are shown as colour. How does a number become a colour, and when does the picture lie?',
    realWorldContext: 'Engineers read stress on a part, doctors read thickness on a scanned bone, artists read weight maps on a character, all as heat maps on a mesh. Choosing the range and the colour map is the difference between seeing the answer and seeing an artefact.',
  },

  intuition: {
    prose: [
      'A **field** on a mesh is one number per vertex: an array as long as the vertex list. Height is the simplest: each vertex\'s $y$. Chapter 7 is about fields that measure the surface itself (curvature, distance) and the operators that compute them.',
      'Between vertices the field is **interpolated** linearly, with the barycentric weights of lesson 3.3: at a point with weights $\\alpha, \\beta, \\gamma$ in triangle $a, b, c$, the value is $\\alpha f_a + \\beta f_b + \\gamma f_c$. Before running cell 1, predict the value at the centre of a triangle: the average of its three corners.',
      'To colour it, first choose a **range** and map each value to $t = (\\text{value} - \\text{low}) / (\\text{high} - \\text{low})$, clamped to $[0, 1]$. Before running cell 2, predict: one vertex spikes to $12$ on a hill $1.2$ high, and the range is the min and max. Almost everything gets $t < 0.1$: one colour. A **robust** range, the 2nd to 98th percentile, ignores the spike (it is clamped to $t = 1$) and spreads the hill over the colours; only the flat ground round it, $43\\%$ of the vertices, stays below $0.1$.',
      'Then a **colour map** turns $t$ into a colour (cell 3). **Turbo** runs from near-black through blue, cyan, green and yellow to dark red, for values that go from low to high. A **diverging** map such as **cool–warm** runs blue → near-white → red, for signed values: its range is made symmetric round $0$, so $0$ is always the pale middle and blue and red mean below and above.',
      'Last, the GPU. It is given a colour at each vertex and **blends the colours** across each triangle. That is not the colour of the blended value: before running cell 4, predict the centre of a triangle whose corners have $t = 0, 0.5, 1$. The value there is $t = 0.5$, bright green; the blend of turbo\'s near-black, green and dark red is a muddy olive-brown, $155$ out of $255$ away. On a fine mesh the corners are close in $t$ and the difference vanishes (cell 4).',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Show a field as colours',
        body: 'Step 1. Compute the field: one number per vertex.\nStep 2. Choose the range: min–max, a robust 2nd–98th percentile, or ± the largest |value| for a signed field.\nStep 3. For each vertex, t = (value − low) / (high − low), clamped to [0, 1].\nStep 4. Colour = map(t): turbo for low → high, cool–warm for signed.\nStep 5. Give each vertex its colour; the GPU blends them across each triangle. Show a legend so colours read as numbers.',
      },
      {
        type: 'warning',
        title: 'One outlier can hide everything',
        body: 'With a min–max range, one extreme vertex stretches the scale and paints the rest one colour. Use a robust range, and say so in the legend: values beyond it are clamped.',
      },
      {
        type: 'warning',
        title: 'Signed fields need a centred map',
        body: 'Curvature, change and error are signed: the important line is zero. Colour them with a diverging map whose range is symmetric round zero, or the middle colour will sit at some meaningless value.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: vertex colours',
        body: 'A heat map is drawn as a colour attribute per vertex, interpolated by the rasteriser (lesson 3.3) and written straight to the pixel, unlit, so shading does not change the reading. Interpolating colours rather than values is cheap but inexact; a renderer that interpolates t and looks up the map per pixel (a 1D texture) is exact.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "a heat map colours faces". Each vertex has one colour, from its height; the colours change smoothly across the hill because the GPU blends them across every triangle: dark at the flat foot, through blue, green and yellow, to dark red on top.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'In the cells, height is Step 1; the percentile range in cell 2 is Step 2; tOf is Step 3; turbo and coolwarm are Step 4; the colors array passed to show() is Step 5.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'show() writes the colours into a vertex colour attribute; three.js interpolates it across each triangle in the fragment stage, exactly the blending cell 4 measures.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Heat map › Height (y), Mean curvature, Gaussian curvature, Distance… each computes a field and colours it, with a legend. Heat map › Trace the colour mapping traces the range, one vertex\'s t (predict it), its colour and the blending in one triangle. Scripts call mesh.showField(\'y\') and mesh.traceColours().' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: from numbers to colours',
        caption: 'A field and its interpolation, choosing a range, two colour maps, colour blending, and a coloured hill.',
        props: {
          lesson: {
            title: 'Fields on a mesh and colour maps',
            subtitle: 'Range, map, blend.',
            cells: [
              { type: 'js', instruction: '### 1. A field\nPredict first: the value at a triangle\'s centre.', startCode: FIELD },
              { type: 'js', instruction: '### 2. The range\nPredict first: with one spike, how much of the hill is one colour?', startCode: RANGE },
              { type: 'js', instruction: '### 3. Colour maps\nTurbo and cool–warm, and how light their colours are.', startCode: MAPS },
              { type: 'js', instruction: '### 4. Blending colours\nPredict first: the centre of a triangle with corners at t = 0, 0.5, 1.', startCode: BLEND },
              { type: 'js', instruction: '### 5. See it\nThe hill coloured by height. Drag to turn.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 340 },
              { type: 'challenge', instruction: '### 6. Challenge: a diverging range\nWhere 0 and 3 fall. The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkDiverging },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Fields on a mesh and colour maps" in MeshLab](#/lab/mesh-lab?project=fields). The hill is coloured by height and the colour mapping is traced: press Play, predict a vertex\'s t, and look at the blending step. Then switch to mean curvature and trace its diverging map.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Heat map menu:** Height (y), Mean curvature, Gaussian curvature, Distance from the selection, and more, each with a legend.\n- **Heat map › Trace the colour mapping** for the field now shown.\n- In a script: `mesh.showField(\'y\')`, `mesh.showField([…one value per vertex…])`, `mesh.traceColours()`.\n- **In Blender:** vertex colours or attributes shown in the viewport; weight paint mode is a heat map of a weight field.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Piecewise-linear fields.** On a triangle mesh, the field $f$ given at vertices extends to every point as $f(p) = \\sum_i \\varphi_i(p) f_i$, where $\\varphi_i$ is the "hat" function of vertex $i$: $1$ at $i$, $0$ at every other vertex, linear on each triangle. These hat functions are the basis that chapter 7\'s operators (the Laplacian, lesson 7.2) are built on.',
      '**Normalising.** $t = \\operatorname{clamp}\\big((f - \\ell) / (h - \\ell), 0, 1\\big)$. For a signed field with a diverging map, $\\ell = -m$, $h = m$ with $m = \\max |f|$ (or its 98th percentile), so $f = 0 \\mapsto t = \\tfrac12$.',
      '**Blending is not mapping.** The GPU computes $\\sum_i \\lambda_i\\, C(t_i)$, where $C$ is the colour map; the true colour is $C\\big(\\sum_i \\lambda_i t_i\\big)$. They agree when $C$ is linear; turbo is a degree-5 polynomial in each channel, so they differ, by roughly $\\tfrac12 C\'\'$ times the spread of $t$ squared: halving the spread quarters the error.',
      '**Lightness.** A good sequential map changes lightness steadily, so equal steps in value look equal. Turbo rises and then falls in lightness (dark blue, bright yellow-green, dark red); it trades monotone lightness for more distinguishable hues. For reading exact orderings, a single-hue or perceptually uniform map (viridis) is safer.',
    ],
    equations: [
      { label: 'Interpolation', latex: 'f(p) = \\alpha f_a + \\beta f_b + \\gamma f_c' },
      { label: 'Normalising', latex: 't = \\operatorname{clamp}\\big(\\tfrac{f - \\ell}{h - \\ell}, 0, 1\\big)' },
      { label: 'Blending', latex: '\\sum_i \\lambda_i\\, C(t_i) \\neq C\\Big(\\sum_i \\lambda_i t_i\\Big) \\text{ unless } C \\text{ is linear}' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** A vertex field defines a unique continuous function on the mesh that is linear on each triangle (the piecewise-linear interpolant). A colour map is a curve $C: [0, 1] \\to [0, 1]^3$; rendering by vertex colours shows the piecewise-linear interpolant of $C \\circ t$, which converges to $C \\circ t$ as the mesh is refined.',
      '**Invariant viewpoint.** A field is a function on the surface, not on the vertex numbering: renumbering vertices permutes the array but shows the same picture. Rescaling the field changes nothing if the range is rescaled with it.',
      '**Geometric picture.** The field is a landscape over the surface; the colour map is a legend that turns altitude into hue; the range decides which altitudes get the interesting colours.',
      '**Where this goes.** Lesson 7.2 builds the Laplacian, an operator on fields; 7.3 and 7.4 compute curvature fields; 7.6 a distance field; 7.8 draws contour lines of any field.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-7-001-ex1',
      title: 'Interpolating a value',
      problem: 'A triangle\'s corners have field values $2, 4, 9$. What is the value at the point with barycentric weights $(0.5, 0.25, 0.25)$?',
      steps: [{ expression: '0.5 \\cdot 2 + 0.25 \\cdot 4 + 0.25 \\cdot 9 = 4.25', annotation: 'Weighted sum.' }],
      conclusion: '4.25.',
    },
    {
      id: 'modelling-geometry-7-001-ex2',
      title: 'Normalising',
      problem: 'The range is $0.5$ to $2.5$. What are $t$ for the values $1$, $3$ and $0$?',
      steps: [
        { expression: '(1 - 0.5) / 2 = 0.25', annotation: 'Inside the range.' },
        { expression: '(3 - 0.5)/2 = 1.25 \\to 1', annotation: 'Clamped.' },
        { expression: '(0 - 0.5)/2 = -0.25 \\to 0', annotation: 'Clamped.' },
      ],
      conclusion: '0.25, 1 and 0.',
    },
    {
      id: 'modelling-geometry-7-001-ex3',
      title: 'Which map?',
      problem: 'You show (a) height above the floor and (b) the change in height after smoothing. Which colour maps?',
      steps: [
        { expression: '(a)\\; 0 \\text{ upwards: sequential (turbo)}', annotation: 'Low to high.' },
        { expression: '(b)\\; \\text{signed: diverging, centred on } 0', annotation: 'Up and down mean different things.' },
      ],
      conclusion: 'Turbo for height; cool–warm (symmetric range) for the change.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-7-001-ch1',
      difficulty: 'easy',
      problem: 'Why does a single spike make a min–max heat map useless?',
      walkthrough: [{ expression: '\\text{the range stretches to include the spike}', annotation: 'Everyone else is squeezed near t = 0.' }],
      answer: 'The spike sets the top of the range, so every ordinary value maps near t = 0 and gets nearly the same colour. A robust range clamps the spike and spreads the rest.',
    },
    {
      id: 'modelling-geometry-7-001-ch2',
      difficulty: 'medium',
      problem: 'A coarse heat map shows a thin purple-grey band between blue and red regions that is not on the colour map. Explain it and give two fixes.',
      walkthrough: [
        { expression: '\\text{triangles span blue to red corners}', annotation: 'The GPU blends blue and red.' },
        { expression: '\\text{fix: subdivide, or interpolate t and look up the map per pixel}', annotation: 'Cell 4.' },
      ],
      answer: 'Where a triangle has blue and red corners, the GPU blends those colours linearly, giving a grey-purple not on the turbo map. Refine the mesh (smaller jumps in t per triangle), or interpolate t and look up the colour per pixel with a 1D texture.',
    },
    {
      id: 'modelling-geometry-7-001-ch3',
      difficulty: 'hard',
      problem: 'Show that the error between blended colours and the colour of the blended value shrinks like the square of the spread in t.',
      walkthrough: [
        { expression: 'C(t_i) = C(\\bar t) + C\'(\\bar t)(t_i - \\bar t) + \\tfrac12 C\'\'(\\xi)(t_i - \\bar t)^2', annotation: 'Taylor\'s theorem.' },
        { expression: '\\sum \\lambda_i (t_i - \\bar t) = 0', annotation: 'The linear terms cancel.' },
        { expression: '\\text{error} \\le \\tfrac12 \\max|C\'\'| \\cdot \\text{spread}^2', annotation: 'Only the quadratic term is left.' },
      ],
      answer: 'Expanding C round the blended value t̄, the linear terms cancel because Σ λᵢ(tᵢ − t̄) = 0, leaving at most ½ max|C″| · spread²: halve the spread (by refining the mesh) and the error quarters, as cell 4 shows.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'f_i', meaning: 'The field\'s value at vertex i.' },
      { symbol: 't', meaning: 'The value normalised into [0, 1] by the range.' },
      { symbol: '[\\ell, h]', meaning: 'The range: the values that get the first and last colours.' },
      { symbol: 'C(t)', meaning: 'The colour map: a colour for each t.' },
      { symbol: '\\text{turbo}', meaning: 'A sequential map, near-black → blue → green → yellow → dark red, for values from low to high.' },
      { symbol: '\\text{cool–warm}', meaning: 'A diverging map, blue → white → red, for signed values centred on 0.' },
    ],
    rulesOfThumb: [
      'One number per vertex, linear in between.',
      'Use a robust range when there are outliers.',
      'Signed fields: diverging map, symmetric range.',
      'Always show a legend.',
      'Coarse meshes blend colours, not values.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-3-003', label: 'Rasterization', note: 'Barycentric weights, which interpolate both values and colours.' },
      { lessonId: 'modelling-geometry-6-005', label: 'Subdividing UVs', note: 'Another quantity stored per vertex (or corner) and interpolated.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-7-002', label: 'The Laplacian', note: 'An operator that turns one field into another.' },
      { lessonId: 'modelling-geometry-7-008', label: 'Level sets and contours', note: 'Drawing lines where a field takes chosen values.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-7-001-1', label: 'Read what a field on a mesh is and how it is interpolated', type: 'read' },
    { id: 'cp-modelling-geometry-7-001-2', label: 'Read how a range and a colour map turn values into colours', type: 'read' },
    { id: 'cp-modelling-geometry-7-001-3', label: 'Read why blending colours is not blending values', type: 'read' },
    { id: 'cp-modelling-geometry-7-001-4', label: 'Run cells 1 to 4: field, range, maps, blending', type: 'lab' },
    { id: 'cp-modelling-geometry-7-001-5', label: 'Trace the colour mapping of two heat maps in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-7-001-6', label: 'Work through example 2, normalising', type: 'example' },
    { id: 'cp-modelling-geometry-7-001-7', label: 'Work through example 3, which map', type: 'example' },
    { id: 'cp-modelling-geometry-7-001-8', label: 'Complete the challenge: a diverging range', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-7-001-assess-1',
        type: 'choice',
        text: 'The range is 10 to 30. What t does the value 15 get?',
        options: ['0.25', '0.5', '0.15', '0.75'],
        answer: '0.25',
        hint: '(15 − 10) / 20.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-7-001-quiz-1',
      type: 'choice',
      text: 'What is a field on a mesh?',
      options: ['One number per vertex', 'One colour per face', 'The mesh\'s normals', 'A texture'],
      answer: 'One number per vertex',
      hints: ['Cell 1.', 'An array as long as the vertex list.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-7-001-quiz-2',
      type: 'choice',
      text: 'Why use the 2nd–98th percentile as the range?',
      options: ['So a few extreme values do not squeeze the rest into one colour', 'To make the map brighter', 'It is faster', 'To remove negative values'],
      answer: 'So a few extreme values do not squeeze the rest into one colour',
      hints: ['Cell 2.', 'The spike.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-7-001-quiz-3',
      type: 'choice',
      text: 'Which map suits a signed field like mean curvature?',
      options: ['A diverging map centred on 0', 'Turbo with a min–max range', 'Grey', 'Any map'],
      answer: 'A diverging map centred on 0',
      hints: ['Warning "Signed fields need a centred map".', 'Example 3.'],
      reviewSection: 'Warning "Signed fields need a centred map"',
    },
    {
      id: 'modelling-geometry-7-001-quiz-4',
      type: 'choice',
      text: 'A triangle\'s corners are at t = 0, 0.5 and 1. What does the GPU show at its centre?',
      options: ['A blend of the three corner colours: a muddy colour not on the map', 'Turbo\'s green', 'Red', 'Blue'],
      answer: 'A blend of the three corner colours: a muddy colour not on the map',
      hints: ['Cell 4.', 'Colours are blended, not values.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-7-001-quiz-5',
      type: 'choice',
      text: 'How does refining the mesh affect the blending error?',
      options: ['It shrinks like the square of the spread in t', 'It does not change', 'It grows', 'It disappears completely at once'],
      answer: 'It shrinks like the square of the spread in t',
      hints: ['Challenge 3.', 'Cell 4.'],
      reviewSection: 'Maths: blending is not mapping',
    },
    {
      id: 'modelling-geometry-7-001-quiz-6',
      type: 'choice',
      text: 'The value at the centre of a triangle with corner values 1, 2 and 6 is:',
      options: ['3', '2', '6', '9'],
      answer: '3',
      hints: ['The average.', 'Cell 1.'],
      reviewSection: 'Cell 1',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'A heat map colours each face.',
      whyStudentsThinkIt: 'You see coloured patches.',
      correctionExample: 'Cell 5: colours are given per vertex and blended across faces.',
      contrastCase: 'Some tools do show one colour per face (flat), which looks blocky.',
    },
    {
      falseBelief: 'Min–max is always the right range.',
      whyStudentsThinkIt: 'It covers every value.',
      correctionExample: 'Cell 2: one spike puts most of the hill below t = 0.1.',
      contrastCase: 'With no outliers, min–max and percentile ranges barely differ.',
    },
    {
      falseBelief: 'The colour between two vertices is the colour of the value between them.',
      whyStudentsThinkIt: 'Values interpolate linearly.',
      correctionExample: 'Cell 4: blended colours and the colour of the blended value can be far apart.',
      contrastCase: 'With a linear colour map (two colours blended), they agree.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A stress map of a bracket is all blue except one red pixel at a bolt hole.',
      competingTechniques: ['Report the bracket as unstressed', 'Use a robust range, and check the bolt hole separately'],
      whyThisTechniqueWins: 'The red pixel stretched the scale; a robust range shows the stress pattern everywhere else, and the hole is examined on its own.',
    },
    {
      situation: 'You colour the error between a scan and a model, positive and negative.',
      competingTechniques: ['Turbo with a min–max range', 'Cool–warm with a symmetric range'],
      whyThisTechniqueWins: 'The diverging map makes zero error white and shows too-big and too-small in opposite colours.',
    },
  ],

  debugging: [
    {
      commonError: 'A min–max range with an outlier.',
      symptom: 'Almost the whole mesh is one colour.',
      whyItHappened: 'The outlier stretched the scale.',
      repairStrategy: 'Use the 2nd–98th percentile and clamp.',
    },
    {
      commonError: 'A sequential map on a signed field.',
      symptom: 'Zero falls on some arbitrary colour; positive and negative do not read as opposites.',
      whyItHappened: 'The map was not centred.',
      repairStrategy: 'Use a diverging map with a symmetric range.',
    },
    {
      commonError: 'Too coarse a mesh for a fast-changing field.',
      symptom: 'Colours not on the legend appear between regions.',
      whyItHappened: 'Colours, not values, were interpolated across big jumps.',
      repairStrategy: 'Subdivide, or interpolate t and look up colours per pixel.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Interpolate a field, normalise values with a range, and pick a map.',
    explainVerbally: 'Explain fields, robust and symmetric ranges, and why colour blending differs from value blending.',
    detectIncorrectApplication: 'Recognise outlier-squashed maps, uncentred signed maps and blending artefacts.',
    transferToUnfamiliar: 'Design a readable heat map for any per-vertex quantity.',
  },
};
