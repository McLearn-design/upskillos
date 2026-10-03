// Lesson 9.4: stylised shading. Cartoon (toon, cel) shading deliberately breaks the smooth cosine: d = max(N·L, 0) is
// quantised into a few flat bands, floor(d · bands) / bands; a rim light (1 − N·V)^k picks out the silhouette; and an
// outline is drawn where the surface turns away from the eye. The same vectors as Lambert, a different function of them.

const BASE = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)
const norm = (a) => a.map((x) => x / Math.hypot(...a))
const toSRGB = (c) => (c < 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)
const toLinear = (c) => (c < 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const band = (d, n) => Math.floor(d * n) / n
`;

const BANDS = `${BASE}
// Rounding the cosine down to one of n levels. Predict first: with 3 bands, which level does d = 0.5 get? And 0.99?
for (const d of [1, 0.99, 0.7, 0.5, 0.34, 0.33, 0.1]) console.log('d ' + d + ': 3 bands → ' + r(band(d, 3)) + ', 4 bands → ' + r(band(d, 4)))
// Where do the steps fall on a ball lit from above? At the angles whose cosine is k / n.
console.log('3-band edges at ' + [1, 2].map((k) => r(Math.acos(k / 3) * 180 / Math.PI) + '°').join(', ') + ' from the light')`;

const RIM = `${BASE}
// A rim light: (1 − N·V)^4, strongest where the surface turns edge-on to the eye. Predict first: how fast does it fall?
for (const deg of [90, 80, 70, 60, 45, 0]) {
  const nv = Math.cos(deg * Math.PI / 180)
  console.log('N at ' + deg + '° from V (N·V ' + r(nv) + '): rim ' + r(Math.pow(1 - nv, 4)))
}`;

const OUTLINE = `${BASE}
// An outline where the surface is nearly edge-on: N·V below a threshold. On a ball seen from the front, which part
// of the visible disc is that? Predict first: for N·V < 0.25, what fraction of the disc's radius is outline?
for (const t of [0.1, 0.25, 0.4]) {
  // A point at radius ρ on the disc has N·V = √(1 − ρ²); the outline starts where that equals t.
  const rho = Math.sqrt(1 - t * t)
  console.log('threshold ' + t + ': outline from radius ' + r(rho) + ' out, ' + r(100 * (1 - rho)) + '% of the radius, ' + r(100 * (1 - rho * rho)) + '% of the disc\\'s area')
}`;

const PICTURE = `${BASE}
// Three balls lit from the upper left: Lambert, toon with 3 bands and a rim, and toon with an outline (N·V < 0.25).
const canvas = document.createElement('canvas'), W = 390, H = 150
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'), img = g.createImageData(W * 2, H * 2)
const L = norm([-0.5, 0.7, 0.5]), base = [0.88, 0.39, 0.24].map(toLinear), ambient = 0.12
const counts = [new Set(), new Set(), new Set()]
for (let py = 0; py < H * 2; py++) for (let px = 0; px < W * 2; px++) {
  const k = Math.floor(px / (W * 2 / 3)), cx = (k + 0.5) * W * 2 / 3, cy = H - 6, R = H * 0.78, i = (py * W * 2 + px) * 4
  const x = (px - cx) / R, y = (cy - py) / R
  if (x * x + y * y > 1) { img.data.set([15, 25, 35, 255], i); continue }
  const N = [x, y, Math.sqrt(1 - x * x - y * y)], d = Math.max(dot(N, L), 0), nv = N[2]
  let c
  if (k === 0) c = base.map((b) => b * (ambient + d))
  else if (k === 2 && nv < 0.25) c = [0.02, 0.02, 0.03]
  else { const q = band(d, 3), rim = Math.pow(1 - nv, 4); c = base.map((b) => b * (ambient + q) + rim * 0.35); counts[k].add(q) }
  img.data.set([...c.map((v) => Math.round(255 * Math.min(1, toSRGB(v)))), 255], i)
}
g.putImageData(img, 0, 0)
g.scale(2, 2); g.fillStyle = '#cbd5e1'; g.font = '11px sans-serif'; g.textAlign = 'center'
;['Lambert', 'toon', 'toon + outline'].forEach((t, k) => g.fillText(t, (k + 0.5) * W / 3, H - 2))
console.log('light levels on the toon ball: ' + [...counts[1]].sort().map(r).join(', '))`;

const CHALLENGE = `// A toon shader with 4 bands. Its brightest band is d ≥ 0.75. How many degrees from the light direction does the
// brightest band reach on a sphere (where does N·L drop below 0.75)?
const degrees = 0
console.log(degrees)`;

const SOLVED = CHALLENGE.replace('const degrees = 0', 'const degrees = Math.acos(0.75) * 180 / Math.PI');

/** The challenge's check: acos(0.75) = 41.41°. */
export function checkBandEdge(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+degrees\s*=\s*([^\n]+)/);
  if (!m) return no('Keep the line const degrees = …, with a number or an expression.');
  // Only arithmetic and a few Math functions are evaluated: this runs in the page, not the cell's sandbox.
  const expr = m[1].replace(/\/\/.*$/, '').trim().replace(/;$/, '');
  if (!/^[\d.,\s+\-*/()]*$/.test(expr.replace(/Math\.(acos|cos|PI)|\*\*/g, ''))) return no('Write the angle as a number, or arithmetic with Math.acos and Math.PI.');
  let v;
  try { v = Number(new Function('return (' + expr + ')')()); } catch { return no('That expression did not run.'); }
  if (!Number.isFinite(v)) return no('The angle must be a number.');
  const near = (x, t = 0.05) => Math.abs(v - x) < t;
  if (near(Math.acos(0.75) * 180 / Math.PI)) return { pass: true, message: `${+v.toFixed(2)}°: the band edge is where N·L = cos θ = 0.75, so θ = acos(0.75) = 41.41°. The next edges, at 0.5 and 0.25, are at 60° and 75.5°: the bands are equal steps of light, not of angle.` };
  if (v === 0) return no('The band ends where N·L = 0.75, and N·L = cos θ.');
  if (near(Math.acos(0.75), 0.005)) return no('That is in radians: multiply by 180 / π.');
  if (near(67.5, 0.5)) return no('67.5° assumes the bands are equal steps of angle (90° × ¾). They are equal steps of N·L = cos θ.');
  if (near(22.5, 0.5)) return no('22.5° splits 90° into four equal angles. The bands split N·L, the cosine, into four.');
  if (near(Math.acos(0.25) * 180 / Math.PI)) return no('75.5° is where the darkest lit band ends (N·L = 0.25). The brightest band is N·L ≥ 0.75.');
  return no(`${+v.toFixed(2)}° does not have N·L = 0.75.`);
}

export default {
  id: 'modelling-geometry-9-004',
  slug: 'stylised-shading',
  chapter: 'modelling-geometry',
  order: 4,
  title: 'Stylised shading',
  subtitle: 'Cartoon looks from the same vectors: the cosine rounded into bands, a rim of light, and outlines where the surface turns away.',
  tags: ['shading', 'toon', 'cel shading', 'npr', 'quantisation', 'rim light', 'outlines'],
  coreConcept: 'Non-photorealistic shading uses the same N, L and V as Lambert but a different function of them. Toon (cel) shading quantises the cosine: d = max(N·L, 0) becomes floor(d · n)/n, so light changes in n flat steps, with edges at the angles where cos θ = k/n. A rim light (1 − N·V)^k brightens where the surface turns edge-on to the eye, picking out the silhouette, and an outline is drawn where N·V falls below a threshold (or from a slightly enlarged back-face hull). The result reads as hand-drawn because it removes the smooth gradients that signal photography.',
  prerequisites: ['modelling-geometry-9-001', 'modelling-geometry-3-006'],
  timeToComplete: 30,
  nextLesson: 'modelling-geometry-9-005',

  hook: {
    question: 'Cartoon characters in games like Zelda: Breath of the Wild or Borderlands are fully 3D and lit by a moving sun, yet they look hand-painted: flat areas of colour, a crisp shadow edge, a dark outline. How does a shader turn smooth lighting into that?',
    realWorldContext: 'Cel shading is used in anime-style games and films, technical illustration (where flat tones read better than gradients), and product sketches; outline and rim techniques also appear in selection highlights and x-ray views in editors.',
  },

  intuition: {
    prose: [
      'A hand-painted cartoon uses two or three flat tones for light and shadow, with a crisp edge between them. The toon shader gets that from Lambert\'s cosine by **rounding it down** to one of $n$ levels: $\\lfloor d \\cdot n \\rfloor / n$. Before running cell 1, predict the 3-band level of $d = 0.5$: $\\tfrac13$. And of $0.99$: $\\tfrac23$, because only $d = 1$ exactly reaches the top level when rounding down.',
      'The band edges fall where $\\cos\\theta = k/n$. They are equal steps of light, not of angle: with 3 bands, at $48.2°$ and $70.5°$ from the light. The bright cap is wide and the dark bands narrow towards the terminator, which is what makes the shading still read as round.',
      'A **rim light** adds a glow where the surface turns edge-on to the eye: $(1 - N\\cdot V)^4$, zero facing the eye and 1 at the silhouette. The fourth power keeps it to a thin rim. Before running cell 2, predict the rim when $N$ is $60°$ from $V$: $0.0625$, already small.',
      'An **outline** draws the silhouette dark. The simplest way per pixel: where $N\\cdot V$ is below a threshold, paint black. Before running cell 3, predict how thick a threshold of 0.25 makes it on a ball: the outer 3% of the radius (6% of the area), because the surface turns edge-on so quickly near the edge. Games often draw it instead from a copy of the mesh pushed out along its normals, showing only its back faces (the inverted hull), which gives an even width.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Toon shading',
        body: 'Step 1. d = max(N·L, 0), as for Lambert.\nStep 2. Band: q = floor(d · n) / n.\nStep 3. Rim: (1 − max(N·V, 0))^4, scaled by a strength.\nStep 4. Colour = base · (ambient + q · light) + rim · strength · light.\nStep 5. Outline: where N·V < threshold, use the outline colour (or draw an inverted hull).',
      },
      {
        type: 'warning',
        title: 'Bands are steps of light, not angle',
        body: 'Equal bands of N·L are unequal bands of angle: a 4-band shader\'s edges are at 41°, 60° and 76° from the light. For equal-angle bands, quantise θ = acos(d) instead.',
      },
      {
        type: 'warning',
        title: 'Threshold outlines vary in width',
        body: 'An N·V threshold gives thin lines on round objects and thick smudges on flat faces seen edge-on (N·V near 0 everywhere). Inverted-hull or screen-space edge detection gives an even width.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: outlines with toon',
        body: 'Toon shading flattens the tones, so the eye loses the shape\'s edges; outlines give them back. MeshLab\'s silhouette trace (lesson 5.8) finds the same edges geometrically: where front-facing and back-facing faces meet.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "toon shading needs special lighting". All three balls use the same light and normals. The middle one rounds the light into three levels and adds a rim; the right one also paints the edge-on rim black.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'band() is Step 2; Math.pow(1 − nv, 4) is Step 3; the nv < 0.25 test is Step 5.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'In GLSL: floor(max(dot(N, L), 0.0) * uBands) / uBands. Using step() or a small 1D ramp texture instead of floor() gives artists control over where each band starts and what colour it is.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Inspector › Shader: Toon (3 bands, rim 0.35). Mesh › Trace the shading on a toon object adds the bands (predict the level) and the rim to the Lambert steps. The Shader tab shows its GLSL; copy it into Custom to change the number of bands.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: toon shading',
        caption: 'Bands, the rim, outline thickness, and three balls.',
        props: {
          lesson: {
            title: 'Stylised shading',
            subtitle: 'Round the light, mark the edge.',
            cells: [
              { type: 'js', instruction: '### 1. Bands\nPredict first: d = 0.5 and 0.99 with 3 bands.', startCode: BANDS },
              { type: 'js', instruction: '### 2. The rim\nPredict first: the rim at 60°.', startCode: RIM },
              { type: 'js', instruction: '### 3. Outlines\nPredict first: how much of the disc a 0.25 threshold paints.', startCode: OUTLINE },
              { type: 'js', instruction: '### 4. See it\nLambert, toon, toon with outline.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 220 },
              { type: 'challenge', instruction: '### 5. Challenge: a band edge\nThe check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkBandEdge },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Stylised shading" in MeshLab](#/lab/mesh-lab?project=toon-shading). A toon ball beside a Lambert one; a vertex 45° from the light is traced: press Play, and predict its band.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Inspector › Shader: Toon.**\n- **Mesh › Trace the shading** on a vertex near a band edge, and one near the silhouette.\n- In a script: `obj.material.shader = "toon"`.\n- [The "Shader gallery"](#/lab/mesh-lab?project=shader-gallery): copy the toon body into Custom and change the bands.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Quantisation.** $q = \\lfloor n\\,\\max(N\\cdot L, 0) \\rfloor / n$ takes the values $0, \\tfrac1n, \\ldots, 1$; level $k/n$ covers $\\cos\\theta \\in [k/n, (k+1)/n)$, i.e. $\\theta \\in (\\arccos\\tfrac{k+1}{n}, \\arccos\\tfrac{k}{n}]$.',
      '**Rim.** $\\text{rim} = (1 - N\\cdot V)^p$. Near the silhouette, with $N\\cdot V = \\cos\\phi$ and $\\phi$ close to $90°$, it is about $1 - p\\cos\\phi$, so it fades within a few degrees for large $p$.',
      '**Outline thickness on a sphere.** Seen head-on, a point at radius $\\rho$ of the disc has $N\\cdot V = \\sqrt{1 - \\rho^2}$. The outline $N\\cdot V < t$ is the ring $\\rho > \\sqrt{1 - t^2}$, a fraction $t^2$ of the disc\'s area.',
    ],
    equations: [
      { label: 'Bands', latex: 'q = \\frac{\\lfloor n\\,\\max(N\\cdot L, 0)\\rfloor}{n}' },
      { label: 'Band edges', latex: '\\theta_k = \\arccos\\frac{k}{n}' },
      { label: 'Rim', latex: '\\text{rim} = (1 - N\\cdot V)^4' },
      { label: 'Outline area', latex: '1 - \\rho^2 = t^2' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** The toon shade is a step function of N·L: piecewise constant on the regions {θ : k/n ≤ cos θ < (k + 1)/n}, so its level sets are the circles of constant θ around the light direction on a sphere, exactly where Lambert\'s smooth shading has the same values.',
      '**Invariant viewpoint.** Bands depend only on N and L, so they stay fixed on the object as the camera moves; the rim and outline depend on V and slide over the surface with the view, as a drawn outline should.',
      '**Geometric picture.** Paint a ball by numbers: a few rings around the point facing the lamp, each one flat colour, and ink round the edge you see.',
      '**Where this goes.** Lesson 9.5 shows N and UV themselves as colours; 9.7 writes your own shade() body, toon or anything else.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-9-004-ex1',
      title: 'A band',
      problem: 'With 3 bands, which level does d = 0.7 get?',
      steps: [{ expression: '\\lfloor 2.1 \\rfloor / 3 = 2/3', annotation: 'Round down.' }],
      conclusion: '⅔.',
    },
    {
      id: 'modelling-geometry-9-004-ex2',
      title: 'Band edges',
      problem: 'Where are the edges of a 2-band shader?',
      steps: [{ expression: '\\arccos(1/2) = 60°', annotation: 'One edge.' }],
      conclusion: 'At 60° from the light (and 90°, where the light ends): a bright cap and one shadow band.',
    },
    {
      id: 'modelling-geometry-9-004-ex3',
      title: 'Rim',
      problem: 'N·V = 0.1 at a point near the silhouette. Rim?',
      steps: [{ expression: '0.9^4 = 0.656', annotation: '(1 − N·V)⁴.' }],
      conclusion: '0.656.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-9-004-ch1',
      difficulty: 'easy',
      problem: 'Why does the rim light move over the surface when the camera moves, but the bands do not?',
      walkthrough: [{ expression: '\\text{rim uses } V', annotation: 'Bands use only N and L.' }],
      answer: 'The rim is (1 − N·V)⁴, which depends on the direction to the eye; the bands depend only on N·L. Moving the camera changes V, so the rim follows the silhouette.',
    },
    {
      id: 'modelling-geometry-9-004-ch2',
      difficulty: 'medium',
      problem: 'A flat floor seen at a low angle turns entirely black with an N·V < 0.25 outline. Why, and what is the fix?',
      walkthrough: [{ expression: 'N\\cdot V \\approx \\sin(\\text{elevation}) < 0.25', annotation: 'Below about 14°.' }],
      answer: 'On a flat floor N·V is the same everywhere, the sine of the view\'s elevation; below about 14° it is under 0.25 across the whole floor. Threshold outlines cannot tell an edge from a slanted face; inverted hulls or screen-space edge detection (depth and normal jumps) draw only real edges.',
    },
    {
      id: 'modelling-geometry-9-004-ch3',
      difficulty: 'hard',
      problem: 'Show that the outline N·V < t covers a fraction t² of a sphere\'s visible disc.',
      walkthrough: [
        { expression: 'N\\cdot V = \\sqrt{1 - \\rho^2}', annotation: 'Head-on view of a unit sphere.' },
        { expression: '\\sqrt{1 - \\rho^2} < t \\iff \\rho^2 > 1 - t^2', annotation: 'The outline ring.' },
        { expression: '\\frac{\\pi(1 - (1 - t^2))}{\\pi} = t^2', annotation: 'Ring area over disc area.' },
      ],
      answer: 'A point at radius ρ on the disc is on the sphere with N = (x, y, √(1 − ρ²)), so N·V = √(1 − ρ²). It is outline when ρ² > 1 − t², a ring of area π t² in a disc of area π: a fraction t². For t = 0.25, 6.25%.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'n', meaning: 'The number of bands.' },
      { symbol: '\\lfloor nd \\rfloor / n', meaning: 'The quantised light.' },
      { symbol: '\\arccos(k/n)', meaning: 'Where band k starts.' },
      { symbol: '(1 - N\\cdot V)^4', meaning: 'The rim light.' },
      { symbol: 't', meaning: 'The outline threshold on N·V.' },
      { symbol: 't^2', meaning: 'The share of a sphere\'s disc the outline covers.' },
    ],
    rulesOfThumb: [
      'Same vectors, different function.',
      'Bands are equal steps of light.',
      'Rim and outline follow the eye.',
      'Threshold outlines vary in width.',
      'Toon flattens tones; outlines restore edges.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-9-001', label: 'Light and the cosine law', note: 'The d being quantised.' },
      { lessonId: 'modelling-geometry-3-006', label: 'Lines, outlines and overlays', note: 'Drawing outlines on the GPU.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-9-005', label: 'Debug views', note: 'N and UV as colours.' },
      { lessonId: 'modelling-geometry-9-007', label: 'Write a shader', note: 'Your own shade() body.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-9-004-1', label: 'Read quantising the cosine into bands', type: 'read' },
    { id: 'cp-modelling-geometry-9-004-2', label: 'Read the rim light', type: 'read' },
    { id: 'cp-modelling-geometry-9-004-3', label: 'Read the two ways to draw outlines', type: 'read' },
    { id: 'cp-modelling-geometry-9-004-4', label: 'Run cells 1 to 3: bands, rim, outline', type: 'lab' },
    { id: 'cp-modelling-geometry-9-004-5', label: 'Trace a toon vertex in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-9-004-6', label: 'Work through example 1, a band', type: 'example' },
    { id: 'cp-modelling-geometry-9-004-7', label: 'Work through example 2, band edges', type: 'example' },
    { id: 'cp-modelling-geometry-9-004-8', label: 'Complete the challenge: a band edge', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-9-004-assess-1',
        type: 'choice',
        text: 'With 4 bands, d = 0.6 is shaded at:',
        options: ['0.5', '0.6', '0.75', '0.25'],
        answer: '0.5',
        hint: 'floor(2.4) / 4.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-9-004-quiz-1',
      type: 'choice',
      text: 'With 3 bands, d = 0.99 is shaded at:',
      options: ['⅔', '1', '⅓', '0.99'],
      answer: '⅔',
      hints: ['Cell 1.', 'Rounding down.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-9-004-quiz-2',
      type: 'choice',
      text: 'A 3-band shader\'s edges are at:',
      options: ['48.2° and 70.5° from the light', '30° and 60°', '45° and 90°', '33° and 66°'],
      answer: '48.2° and 70.5° from the light',
      hints: ['Cell 1.', 'acos(k/3).'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-9-004-quiz-3',
      type: 'choice',
      text: 'The rim light is strongest where:',
      options: ['The surface is edge-on to the eye', 'The surface faces the light', 'The surface faces the eye', 'The bands meet'],
      answer: 'The surface is edge-on to the eye',
      hints: ['Cell 2.', 'N·V near 0.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-9-004-quiz-4',
      type: 'choice',
      text: 'An N·V < 0.25 outline covers how much of a sphere\'s visible disc?',
      options: ['6.25%', '25%', '50%', '3%'],
      answer: '6.25%',
      hints: ['Cell 3.', 't².'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-9-004-quiz-5',
      type: 'choice',
      text: 'Which part of toon shading stays fixed on the object when the camera moves?',
      options: ['The bands', 'The rim', 'The outline', 'None of it'],
      answer: 'The bands',
      hints: ['Challenge 1.', 'They use only N and L.'],
      reviewSection: 'Challenge',
    },
    {
      id: 'modelling-geometry-9-004-quiz-6',
      type: 'choice',
      text: 'Why do threshold outlines blacken a floor seen at a low angle?',
      options: ['N·V is small everywhere on it', 'The floor is too big', 'Bands are wrong', 'The light is low'],
      answer: 'N·V is small everywhere on it',
      hints: ['Challenge 2.', 'Warning "Threshold outlines vary in width".'],
      reviewSection: 'Challenge',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'Toon shading needs special lighting.',
      whyStudentsThinkIt: 'It looks so different.',
      correctionExample: 'The picture: the same N, L and light as Lambert, only a different function of N·L.',
      contrastCase: 'Artists do often add a fixed "key light" for consistent cartoon shadows, as a style choice.',
    },
    {
      falseBelief: 'Equal bands cover equal angles.',
      whyStudentsThinkIt: 'Bands look evenly spaced on a flat diagram.',
      correctionExample: 'Cell 1: 3-band edges at 48.2° and 70.5°, not 30° and 60°.',
      contrastCase: 'Quantising the angle acos(d) instead does give equal angles.',
    },
    {
      falseBelief: 'The rim light is a second light behind the object.',
      whyStudentsThinkIt: 'In photography it is.',
      correctionExample: 'Cell 2: here it is computed from N·V alone, with no light direction at all.',
      contrastCase: 'A real back light would depend on L and only appear on the side facing it.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A technical manual needs 3D part renders that print clearly in two greys.',
      competingTechniques: ['Smooth Lambert shading', 'Two-band toon shading with outlines'],
      whyThisTechniqueWins: 'Two flat tones and an outline survive printing and photocopying; smooth gradients turn muddy.',
    },
    {
      situation: 'A stylised game wants outlines of even width on every object.',
      competingTechniques: ['N·V threshold in the fragment shader', 'Inverted hull or screen-space edge detection'],
      whyThisTechniqueWins: 'The threshold\'s width depends on curvature; hulls and edge detection draw a constant-width line at true silhouettes.',
    },
  ],

  debugging: [
    {
      commonError: 'Rounding to nearest instead of down.',
      symptom: 'Band edges shifted by half a band; the top band appears too early.',
      whyItHappened: 'round() instead of floor().',
      repairStrategy: 'Use floor(d · n) / n (or decide deliberately where each edge goes).',
    },
    {
      commonError: 'Rim computed with N·V that can be negative.',
      symptom: 'Rim values above 1 on back faces seen through gaps.',
      whyItHappened: '1 − N·V > 1 when N·V < 0.',
      repairStrategy: 'Use max(N·V, 0).',
    },
    {
      commonError: 'Band edges flickering as the object turns.',
      symptom: 'Jagged, crawling band boundaries on low-poly meshes.',
      whyItHappened: 'Per-vertex shading quantised before interpolation.',
      repairStrategy: 'Quantise per pixel, after interpolating the normal.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Compute bands, band edges, rims and outline thickness.',
    explainVerbally: 'Explain how toon shading reuses Lambert\'s vectors and why outlines restore shape.',
    detectIncorrectApplication: 'Recognise round-for-floor, negative rims and threshold outline artefacts.',
    transferToUnfamiliar: 'Design stylised looks for games and illustration.',
  },
};
