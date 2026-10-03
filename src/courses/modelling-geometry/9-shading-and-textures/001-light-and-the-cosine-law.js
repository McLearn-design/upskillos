// Lesson 9.1: light and the cosine law. A beam of light spread over a tilted surface covers 1/cos θ more area, so the
// light per unit area (irradiance) is proportional to cos θ = N·L. Lambert's matte model: colour = base · (ambient +
// max(N·L, 0) · light), computed per pixel in the fragment shader in linear units, then encoded to sRGB for the screen.

const BASE = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)
const norm = (a) => a.map((x) => x / Math.hypot(...a))
// The screen's sRGB encoding of a linear value (0 … 1).
const toSRGB = (c) => (c < 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)
`;

const RAYS = `${BASE}
// Rain down parallel rays, one per square of a fine grid, onto a 1 × 1 plate tilted θ from horizontal.
// Count how many hit it. Predict first: at 60°, what fraction of the rays that hit it flat still hit it?
// The plate's points are (u, w sin θ, w cos θ) for u, w from 0 to 1: one edge on the ground, tilted up by θ.
function hits(deg) {
  const th = deg * Math.PI / 180, n = 400; let count = 0
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = (i + 0.5) / n, z = (j + 0.5) / n            // a vertical ray straight down at (x, z)
    const u = x, w = Math.cos(th) > 1e-12 ? z / Math.cos(th) : Infinity    // where it meets the plate's plane
    if (u >= 0 && u <= 1 && w >= 0 && w <= 1) count++
  }
  return count / (n * n)
}
for (const deg of [0, 30, 60, 80, 90]) console.log(deg + '°: ' + r(hits(deg)) + ' of the rays (cos θ = ' + r(Math.cos(deg * Math.PI / 180)) + ')')`;

const LAMBERT = `${BASE}
// Lambert: colour = base · (ambient + max(N·L, 0) · light). A grey surface, a white sun overhead, a dim ambient.
const base = [0.6, 0.6, 0.6], light = 1, ambient = 0.1, L = [0, 1, 0]
// Predict first: the colour where N is tilted 60° from L, and where it faces down.
for (const [name, N] of [['facing the sun', [0, 1, 0]], ['tilted 60°', [Math.sin(Math.PI / 3), 0.5, 0]], ['side on', [1, 0, 0]], ['facing down', [0, -1, 0]]]) {
  const d = Math.max(dot(norm(N), L), 0)
  console.log(name + ': N·L ' + r(dot(norm(N), L)) + ', d ' + r(d) + ', colour ' + r(base[0] * (ambient + d * light)))
}`;

const SRGB = `${BASE}
// The shader computes in linear units: twice the light is twice the number. Screens are not linear: their 256 levels
// are spread to suit the eye (sRGB). Predict first: a white surface getting half the light. Which screen value, 0–255?
for (const c of [1, 0.5, 0.25, 0.1, 0.01]) console.log('linear ' + c + ' → screen ' + Math.round(255 * toSRGB(c)) + ' (without encoding: ' + Math.round(255 * c) + ')')`;

const PICTURE = `${BASE}
// Two Lambert balls, lit from the upper left, drawn pixel by pixel. Left: linear light, encoded to sRGB for the screen
// (what the shaders do). Right: the same numbers sent to the screen without encoding.
const canvas = document.createElement('canvas'), W = 360, H = 180
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'), img = g.createImageData(W * 2, H * 2)
// The base colour is chosen as sRGB (like a hex colour), so it is decoded to linear before any lighting.
const toLinear = (c) => (c < 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const L = norm([-0.6, 0.7, 0.5]), base = [0.85, 0.45, 0.25].map(toLinear), ambient = 0.04
let lit = 0
for (let py = 0; py < H * 2; py++) for (let px = 0; px < W * 2; px++) {
  const k = px < W ? 0 : 1, cx = (k + 0.5) * W, cy = H, R = H * 0.8, i = (py * W * 2 + px) * 4
  const x = (px - cx) / R, y = (cy - py) / R
  if (x * x + y * y > 1) { img.data.set([15, 25, 35, 255], i); continue }
  const N = [x, y, Math.sqrt(1 - x * x - y * y)], d = Math.max(dot(N, L), 0)
  const c = base.map((b) => b * (ambient + d))
  img.data.set([...c.map((v) => Math.round(255 * Math.min(1, k ? v : toSRGB(v)))), 255], i); lit++
}
g.putImageData(img, 0, 0)
g.scale(2, 2); g.fillStyle = '#cbd5e1'; g.font = '11px sans-serif'; g.textAlign = 'center'
g.fillText('linear, encoded', W / 4, H - 4); g.fillText('not encoded', W * 3 / 4, H - 4)
console.log('pixels shaded: ' + lit)`;

const CHALLENGE = `// A white surface (base 1) has normal N = (0, 0.6, 0.8). The sun is straight overhead, L = (0, 1, 0), light 1, and there
// is no ambient. What is d = max(N·L, 0), and what screen value (0–255, after sRGB encoding) does the pixel get?
const answer = { d: 0, screen: 0 }
console.log(answer)`;

const SOLVED = CHALLENGE.replace('const answer = { d: 0, screen: 0 }', 'const answer = { d: 0.6, screen: 203 }');

/** The challenge's check: d = 0.6; sRGB(0.6) = 1.055 · 0.6^(1/2.4) − 0.055 = 0.798, so 203. */
export function checkLambertPixel(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/\bd\s*:\s*([^,}]+),\s*screen\s*:\s*([^,}\n]+)/);
  if (!m) return no('Keep the line const answer = { d: …, screen: … }.');
  const num = (s) => { const e = s.trim(); if (!/^[\d.\s+\-*/()]+$/.test(e)) return NaN; try { return Number(new Function('return (' + e + ')')()); } catch { return NaN; } };
  const d = num(m[1]), screen = num(m[2]);
  if (!Number.isFinite(d) || !Number.isFinite(screen)) return no('Both answers must be numbers.');
  const near = (a, b, t = 1e-3) => Math.abs(a - b) <= t;
  if (near(d, 0.6) && near(screen, 203, 1)) return { pass: true, message: 'Right: N·L = 0·0 + 0.6·1 + 0.8·0 = 0.6, so the surface gets 0.6 of the light. The screen value is sRGB-encoded: 1.055 · 0.6^(1/2.4) − 0.055 = 0.798, times 255 = 203. Sending 0.6 straight to the screen would show 153, too dark.' };
  if (d === 0 && screen === 0) return no('Start with N·L: multiply matching components and add.');
  if (near(d, 0.8)) return no('0.8 is N\'s z component. L points along y, so N·L picks out N\'s y component.');
  if (!near(d, 0.6)) return no(`d = ${d} is not N·L. N·L = NₓLₓ + N_yL_y + N_zL_z.`);
  if (near(screen, 153, 1)) return no('153 is 0.6 × 255 without the sRGB encoding. The screen expects encoded values: 1.055 · 0.6^(1/2.4) − 0.055.');
  if (near(screen, Math.round(255 * Math.pow(0.6, 2.2)), 1)) return no('That decodes instead of encodes: the power is 1/2.4 (about 1/2.2), which makes the value larger, not smaller.');
  return no(`screen = ${screen}: encode 0.6 with sRGB, then multiply by 255 and round.`);
}

export default {
  id: 'modelling-geometry-9-001',
  slug: 'light-and-the-cosine-law',
  chapter: 'modelling-geometry',
  order: 1,
  title: 'Light and the cosine law',
  subtitle: 'Why a surface tilted away from the light is darker, how a fragment shader computes it, and why the answer is encoded before it reaches the screen.',
  tags: ['shading', 'lambert', 'cosine law', 'irradiance', 'fragment shader', 'srgb', 'linear light'],
  coreConcept: 'A beam of light falling on a surface tilted θ from facing it spreads over 1/cos θ more area, so the light per unit area (irradiance) is proportional to cos θ = N·L for unit vectors N (the normal) and L (towards the light). A matte (Lambertian) surface reflects that light equally in every direction, so its colour does not depend on where you look from: colour = base · (ambient + max(N·L, 0) · light). The fragment shader evaluates this for every pixel, in linear units where light adds, and the result is encoded to sRGB for the screen, which spends more of its levels on dark shades.',
  prerequisites: ['modelling-geometry-3-005', 'modelling-geometry-2-001'],
  timeToComplete: 35,
  nextLesson: 'modelling-geometry-9-002',

  hook: {
    question: 'The ground is warmer at noon than at sunset, though the same sun shines on it. A ball under a lamp is bright on top and dark at the sides. What rule decides how bright each point is, and how does a GPU apply it to millions of pixels a frame?',
    realWorldContext: 'Lambert\'s cosine law (1760) is the base of every lighting model in games, film and CAD: it is the diffuse term inside Blinn–Phong and physically based shading, in solar-panel and climate calculations, and in how photographers think about light angle.',
  },

  intuition: {
    prose: [
      'Shine a torch straight at a wall: a small bright disc. Tilt the wall and the same light spreads into a longer, dimmer ellipse. The light is the same; the area it covers has grown by $1/\\cos\\theta$, so the light per unit area falls to $\\cos\\theta$ of what it was. Before running cell 1, predict what fraction of the rays still hit a plate tilted $60°$: half.',
      'With unit vectors, $\\cos\\theta = N \\cdot L$: $N$ the surface normal, $L$ the direction towards the light. A **matte** (Lambertian) surface scatters what it receives equally in all directions, so where you look from does not matter: colour $= \\text{base} \\cdot (\\text{ambient} + \\max(N \\cdot L, 0) \\cdot \\text{light})$. The $\\max$ stops surfaces facing away from receiving negative light; the **ambient** term stands for light bounced from the sky and the ground, which keeps them from being black. Before running cell 2, predict the colour of a grey surface tilted $60°$ from the sun.',
      'The **fragment shader** runs this formula for every pixel covered by a triangle, with $N$ interpolated from the vertices (smooth shading, lesson 3.5). Its arithmetic is in **linear** units, where twice the light is twice the number. Screens are not linear: their 256 levels are spread to suit the eye, which is far more sensitive to differences between dark shades. So the final value is **encoded** to sRGB, roughly $c^{1/2.2}$. Before running cell 3, predict the screen value of a white surface getting half the light: not 128 but 188.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Lambert shading of one pixel',
        body: 'Step 1. N: the interpolated normal, normalised. L: towards the light, normalised.\nStep 2. Ambient: blend the ground and sky colours by how far N points up.\nStep 3. d = max(N·L, 0).\nStep 4. Linear colour = base · (ambient + d · light).\nStep 5. Encode each channel to sRGB, clamp to 0–1, scale to 0–255.',
      },
      {
        type: 'warning',
        title: 'Normalise N after interpolating',
        body: 'Blending unit vectors across a triangle gives vectors shorter than 1 in its middle, and N·L comes out too small: dark smudges in the middle of faces. Normalise in the fragment shader.',
      },
      {
        type: 'warning',
        title: 'Light in linear, show in sRGB',
        body: 'Doing the arithmetic on sRGB values, or skipping the final encoding, makes the shading wrong: terminators too harsh, mid-tones too dark (the right ball in the picture). Colours given as hex are sRGB; decode them to linear before lighting.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: the fragment shader',
        body: 'The vertex shader places each vertex and passes its normal on; the rasterizer interpolates it across the triangle; the fragment shader turns it into a colour. MeshLab\'s shaders all share that frame (core/shading.ts); the Lambert body is two lines.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "the screen shows the numbers the shader computes". Both balls compute the same linear light. The left one is encoded for the screen: its lit side shows the chosen colour and falls off softly. The right one, sent raw, is too dark and too saturated, with a harsh edge to its shadow.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'dot(N, L) is the cosine; Math.max(…, 0) is the facing-away cut; base · (ambient + d · light) is Lambert; toSRGB() is Step 5.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'In GLSL the body is float d = max(dot(N, L), 0.0); return base * (ambient + d * light); three.js then appends the sRGB encoding (colorspace_fragment).' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Set a material\'s Shader to Lambert in the Inspector; the Shader tab shows its GLSL. Mesh › Trace the shading (one vertex) computes one vertex\'s colour step by step: N, L and V as arrows, the ambient, the cosine law (predict d), the colour and its sRGB encoding. In a script: obj.traceShading(v).' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: the cosine law',
        caption: 'Rays on a tilted plate, Lambert shading, linear against screen values, and two balls.',
        props: {
          lesson: {
            title: 'Light and the cosine law',
            subtitle: 'Brightness is N·L.',
            cells: [
              { type: 'js', instruction: '### 1. Rays on a tilted plate\nPredict first: the fraction at 60°.', startCode: RAYS },
              { type: 'js', instruction: '### 2. Lambert\nPredict first: the colour tilted 60°.', startCode: LAMBERT },
              { type: 'js', instruction: '### 3. Linear and screen values\nPredict first: half the light on white.', startCode: SRGB },
              { type: 'js', instruction: '### 4. See it\nEncoded and not encoded.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 230 },
              { type: 'challenge', instruction: '### 5. Challenge: one pixel\nThe check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkLambertPixel },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Light and the cosine law" in MeshLab](#/lab/mesh-lab?project=cosine-law). A matte ball under an overhead sun; one vertex 60° from the top is traced: press Play, and predict d.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Inspector › Material › Shader: Lambert**; the Shader tab shows the GLSL.\n- **Edit mode, select one vertex, Mesh › Trace the shading.**\n- Move the Light object: it is the sun.\n- In a script: `obj.material.shader = "lambert"`, `obj.traceShading(v)`.\n- [Open the "Shader gallery"](#/lab/mesh-lab?project=shader-gallery): the same ball under every model.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Irradiance.** A parallel beam carrying power $\\Phi$ through a cross-section of area $A_\\perp$ lands on an area $A = A_\\perp/\\cos\\theta$ of a surface tilted $\\theta$. The irradiance $E = \\Phi/A = (\\Phi/A_\\perp)\\cos\\theta$.',
      '**Lambertian reflection.** A surface whose outgoing radiance is the same in every direction reflects $L_o = \\frac{\\rho}{\\pi} E$, with albedo $\\rho$ (the base colour). In real-time shading the $1/\\pi$ and the light\'s units are folded into "light", leaving $\\text{base}\\cdot\\max(N\\cdot L, 0)\\cdot\\text{light}$.',
      '**Hemisphere ambient.** MeshLab\'s ambient is $\\text{mix}(\\text{ground}, \\text{sky}, \\tfrac12 N_y + \\tfrac12)$: a cheap stand-in for light arriving from the whole sky above and the ground below.',
      '**sRGB.** Encoding: $c_s = 12.92\\,c$ for $c < 0.0031308$, else $1.055\\,c^{1/2.4} - 0.055$; decoding is its inverse. Close to $c^{1/2.2}$ over most of the range.',
    ],
    equations: [
      { label: 'Cosine law', latex: 'E = E_\\perp \\cos\\theta = E_\\perp\\,(N \\cdot L)' },
      { label: 'Lambert', latex: 'c = \\text{base} \\cdot \\big(\\text{ambient} + \\max(N \\cdot L, 0)\\cdot \\text{light}\\big)' },
      { label: 'sRGB encoding', latex: 'c_s = 1.055\\,c^{1/2.4} - 0.055' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** For a distant light of radiance L_i from unit direction L, a Lambertian surface with unit normal N and albedo ρ has outgoing radiance L_o = (ρ/π) L_i max(N·L, 0), independent of the view direction. The cosine factor is the Jacobian between the beam\'s cross-section and the surface.',
      '**Invariant viewpoint.** N·L depends only on the angle between the two vectors, so it is unchanged by any rotation of the whole scene; moving the light or turning the object changes it, moving the camera does not.',
      '**Geometric picture.** Hold a sheet of paper under a lamp and tilt it: the patch of light stretches and dims together.',
      '**Where this goes.** Lesson 9.2 adds highlights that do depend on the view; 9.3 adds physical microfacets and energy conservation; 9.4 rounds the cosine into bands.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-9-001-ex1',
      title: 'A 45° slope',
      problem: 'Sun overhead, surface tilted 45°, base 0.8, light 1, no ambient. Linear colour?',
      steps: [{ expression: '0.8 \\cdot \\cos 45° = 0.566', annotation: 'Lambert.' }],
      conclusion: '0.566 linear, which the screen shows as 198.',
    },
    {
      id: 'modelling-geometry-9-001-ex2',
      title: 'Facing away',
      problem: 'N·L = −0.4, base 1, ambient 0.1. Colour?',
      steps: [{ expression: '1 \\cdot (0.1 + 0 \\cdot \\text{light}) = 0.1', annotation: 'max(N·L, 0) = 0.' }],
      conclusion: '0.1: ambient only.',
    },
    {
      id: 'modelling-geometry-9-001-ex3',
      title: 'Half the light',
      problem: 'What screen value does linear 0.5 get?',
      steps: [{ expression: '1.055 \\cdot 0.5^{1/2.4} - 0.055 = 0.735', annotation: 'sRGB.' }],
      conclusion: '0.735 × 255 = 188, not 128.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-9-001-ch1',
      difficulty: 'easy',
      problem: 'Why does a Lambert surface look the same from every viewing direction?',
      walkthrough: [{ expression: 'c = \\text{base}\\cdot(\\ldots + \\max(N \\cdot L, 0)\\cdot\\text{light})', annotation: 'No V in the formula.' }],
      answer: 'The formula uses only N and L, never V: a matte surface scatters equally in all directions, so its brightness depends on how it faces the light, not on where you stand.',
    },
    {
      id: 'modelling-geometry-9-001-ch2',
      difficulty: 'medium',
      problem: 'Interpolated normals in the middle of a triangle have length 0.9. What happens to N·L if they are not normalised?',
      walkthrough: [{ expression: '(0.9 N) \\cdot L = 0.9\\,(N \\cdot L)', annotation: '10% too dark.' }],
      answer: 'N·L comes out 10% too small, so the middle of each face is darker than its corners: a faint pattern following the triangles. Normalising N in the fragment shader removes it.',
    },
    {
      id: 'modelling-geometry-9-001-ch3',
      difficulty: 'hard',
      problem: 'Two lights, each giving linear 0.25 on a white surface, together give 0.5. Show that adding their screen values instead would be wrong.',
      walkthrough: [
        { expression: '\\text{sRGB}(0.25) = 0.537 \\Rightarrow 137', annotation: 'Each light alone.' },
        { expression: '137 + 137 = 274 \\ne 188', annotation: 'Screen values do not add.' },
      ],
      answer: 'Each light alone shows as 137; adding screen values gives 274 (clipped to 255), while the true combined light 0.5 shows as 188. Light adds in linear units, so all lighting arithmetic must be done before encoding.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'N', meaning: 'The unit surface normal.' },
      { symbol: 'L', meaning: 'The unit direction towards the light.' },
      { symbol: 'N \\cdot L = \\cos\\theta', meaning: 'How squarely the light hits.' },
      { symbol: '\\max(N \\cdot L, 0)', meaning: 'No light on surfaces facing away.' },
      { symbol: '\\text{ambient}', meaning: 'Light from the sky and ground, from all directions.' },
      { symbol: 'c_s', meaning: 'A value encoded to sRGB for the screen.' },
    ],
    rulesOfThumb: [
      'Brightness is N·L.',
      'Matte does not depend on the eye.',
      'Normalise N per pixel.',
      'Light in linear, show in sRGB.',
      'Half the light is 188, not 128.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-3-005', label: 'Flat and smooth shading', note: 'Normals interpolated across faces.' },
      { lessonId: 'modelling-geometry-2-001', label: 'Vectors, dot and cross', note: 'The dot product as a cosine.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-9-002', label: 'Highlights', note: 'Light that depends on where you look.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-9-001-1', label: 'Read why light falls with the cosine', type: 'read' },
    { id: 'cp-modelling-geometry-9-001-2', label: 'Read the Lambert formula', type: 'read' },
    { id: 'cp-modelling-geometry-9-001-3', label: 'Read linear light and sRGB', type: 'read' },
    { id: 'cp-modelling-geometry-9-001-4', label: 'Run cells 1 to 3: rays, Lambert, encoding', type: 'lab' },
    { id: 'cp-modelling-geometry-9-001-5', label: 'Trace one vertex\'s shading in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-9-001-6', label: 'Work through example 1, a 45° slope', type: 'example' },
    { id: 'cp-modelling-geometry-9-001-7', label: 'Work through example 3, half the light', type: 'example' },
    { id: 'cp-modelling-geometry-9-001-8', label: 'Complete the challenge: one pixel', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-9-001-assess-1',
        type: 'choice',
        text: 'A surface tilted 60° from facing the light receives what fraction of the light it would facing it?',
        options: ['½', '√3/2', '⅓', '0'],
        answer: '½',
        hint: 'cos 60°.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-9-001-quiz-1',
      type: 'choice',
      text: 'Why does tilting a surface away from the light darken it?',
      options: ['The same light spreads over more area', 'Less light is emitted', 'The light is absorbed by the air', 'The surface changes colour'],
      answer: 'The same light spreads over more area',
      hints: ['Cell 1.', 'Irradiance.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-9-001-quiz-2',
      type: 'choice',
      text: 'In Lambert shading, a surface facing away from the light gets:',
      options: ['Only the ambient light', 'Negative light', 'Full light', 'No colour at all'],
      answer: 'Only the ambient light',
      hints: ['Cell 2.', 'max(N·L, 0).'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-9-001-quiz-3',
      type: 'choice',
      text: 'Does a Lambert surface\'s brightness depend on the camera position?',
      options: ['No', 'Yes', 'Only for metals', 'Only in sRGB'],
      answer: 'No',
      hints: ['Challenge 1.', 'No V in the formula.'],
      reviewSection: 'Challenge',
    },
    {
      id: 'modelling-geometry-9-001-quiz-4',
      type: 'choice',
      text: 'Linear 0.5 (half the light on white) shows on the screen as about:',
      options: ['188', '128', '64', '255'],
      answer: '188',
      hints: ['Cell 3.', 'sRGB encoding.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-9-001-quiz-5',
      type: 'choice',
      text: 'Where is lighting arithmetic done?',
      options: ['In linear units, encoded to sRGB at the end', 'In sRGB', 'In 0–255 integers', 'It does not matter'],
      answer: 'In linear units, encoded to sRGB at the end',
      hints: ['Warning "Light in linear, show in sRGB".', 'Challenge 3.'],
      reviewSection: 'Warning "Light in linear, show in sRGB"',
    },
    {
      id: 'modelling-geometry-9-001-quiz-6',
      type: 'choice',
      text: 'Which program evaluates the lighting formula for every pixel?',
      options: ['The fragment shader', 'The vertex shader', 'The rasterizer', 'The CPU'],
      answer: 'The fragment shader',
      hints: ['The graphics strand.', 'Lesson 3.3.'],
      reviewSection: 'Intuition',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'Brightness falls in a straight line with the angle.',
      whyStudentsThinkIt: 'Tilting more makes it darker steadily.',
      correctionExample: 'Cell 1: 30° keeps 87% of the light, 60° keeps 50%, 80° only 17%: the cosine.',
      contrastCase: 'Near facing the light, small tilts change almost nothing.',
    },
    {
      falseBelief: 'The screen shows the numbers the shader computes.',
      whyStudentsThinkIt: 'A colour is a colour.',
      correctionExample: 'Cell 3 and the picture: linear 0.5 is shown as 188 after encoding; without it, mid-tones are too dark.',
      contrastCase: 'At 0 and 1 the two agree.',
    },
    {
      falseBelief: 'Shadows are just surfaces facing away from the light.',
      whyStudentsThinkIt: 'Both are dark.',
      correctionExample: 'N·L only knows the surface\'s own direction; a surface facing the sun but behind a wall is still lit by this formula. Cast shadows need a separate test (shadow maps).',
      contrastCase: 'Self-shading of a convex object is exactly N·L < 0.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A solar panel must be tilted for the most energy at noon in winter, sun 30° above the horizon.',
      competingTechniques: ['Lay it flat', 'Tilt it 60° to face the sun'],
      whyThisTechniqueWins: 'Flat, N·L = cos 60° = 0.5; facing the sun, N·L = 1: twice the energy.',
    },
    {
      situation: 'A game\'s lighting looks too contrasty and dark in the mid-tones.',
      competingTechniques: ['Brighten every light', 'Check that colours are decoded to linear and the output encoded to sRGB'],
      whyThisTechniqueWins: 'The symptom is a missing encoding step; brightening lights only clips the highlights.',
    },
  ],

  debugging: [
    {
      commonError: 'Not normalising the interpolated normal.',
      symptom: 'Faces darker in their middles; a faint triangle pattern.',
      whyItHappened: 'Blended unit vectors are shorter than 1.',
      repairStrategy: 'N = normalize(vNormal) in the fragment shader.',
    },
    {
      commonError: 'L pointing from the light to the surface.',
      symptom: 'Lit and dark sides swapped.',
      whyItHappened: 'N·L uses the direction towards the light.',
      repairStrategy: 'L = normalize(lightPosition − point), or the sun\'s direction towards it.',
    },
    {
      commonError: 'Lighting hex colours without decoding them.',
      symptom: 'Washed-out or muddy colours.',
      whyItHappened: 'Hex values are sRGB, not linear.',
      repairStrategy: 'Decode to linear first (three.js does this for Color.set).',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Compute a Lambert pixel from N, L, base, ambient and light, and encode it.',
    explainVerbally: 'Explain the cosine law, the ambient term and why lighting is linear.',
    detectIncorrectApplication: 'Recognise unnormalised normals, flipped L and missing encodings.',
    transferToUnfamiliar: 'Apply N·L to panels, lamps and any matte surface.',
  },
};
