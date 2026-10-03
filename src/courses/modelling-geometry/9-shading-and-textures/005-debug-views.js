// Lesson 9.5: debug views. Shader models that light nothing but show data as colour: the normal N as N·½ + ½ (each
// component from −1…1 squeezed into 0…1), the UV as (u, v, 0). They make wrong normals, flipped faces, seams and
// stretched UVs visible at a glance; the same encoding is how normal maps store directions in a texture.

const BASE = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const norm = (a) => a.map((x) => x / Math.hypot(...a))
const encode = (N) => N.map((x) => x * 0.5 + 0.5)
const decode = (c) => norm(c.map((x) => 2 * x - 1))
`;

const ENCODE = `${BASE}
// Each direction becomes a colour. Predict first: the colour of a normal pointing straight up, (0, 1, 0).
for (const [name, N] of [['up', [0, 1, 0]], ['down', [0, -1, 0]], ['+x', [1, 0, 0]], ['+z (towards you)', [0, 0, 1]], ['diagonal', norm([1, 1, 1])]]) {
  const c = encode(N)
  console.log(name + ': N (' + N.map(r).join(', ') + ') → colour (' + c.map(r).join(', ') + ') → back to (' + decode(c).map(r).join(', ') + ')')
}`;

const FLIPPED = `${BASE}
// A cube with one face wound the wrong way. Its normal (Newell's, from the corner order) points inward.
// Predict first: how can the colours show which face is wrong?
const V = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]
const F = [[1, 2, 3, 0], [4, 5, 6, 7], [0, 4, 7, 3], [1, 2, 6, 5], [0, 1, 5, 4], [3, 7, 6, 2]]   // face 0 reversed
function normal(f) {
  let n = [0, 0, 0]
  f.forEach((k, i) => { const p = V[k], q = V[f[(i + 1) % f.length]]; n = [n[0] + (p[1] - q[1]) * (p[2] + q[2]), n[1] + (p[2] - q[2]) * (p[0] + q[0]), n[2] + (p[0] - q[0]) * (p[1] + q[1])] })
  return norm(n)
}
F.forEach((f, i) => {
  const n = normal(f), c = f.reduce((s, k) => s.map((x, j) => x + V[k][j] / 4), [0, 0, 0]), out = n.reduce((s, x, j) => s + x * c[j], 0) > 0
  console.log('face ' + i + ': colour (' + encode(n).map(r).join(', ') + ')' + (out ? '' : '  ← points inward: flipped'))
})`;

const SEAMS = `${BASE}
// The UV view shows u as red. Going round a cylinder, u climbs from 0 to 1 and then restarts. Neighbouring corners
// whose u differs by more than a few steps mark a seam. Predict first: where is the jump?
const n = 12
const us = Array.from({ length: n + 1 }, (_, k) => +((k / n) % 1).toFixed(4))     // the last corner wraps back to 0
for (let k = 0; k < n; k++) {
  const jump = Math.abs(us[k + 1] - us[k])
  if (jump > 0.5) console.log('between corners ' + k + ' and ' + (k + 1) + ': red ' + us[k] + ' → ' + us[k + 1] + '  ← a seam')
}
console.log('every other step: ' + r(1 / n) + ' of red')`;

const PRECISION = `${BASE}
// Normal maps store N·½ + ½ in 8 bits per channel: 256 levels. How far off can a decoded normal be?
// Predict first: the worst error, in degrees.
let worst = 0
for (let i = 0; i < 20000; i++) {
  const t = Math.acos(1 - 2 * ((i + 0.5) / 20000)), p = i * 2.399963, N = [Math.sin(t) * Math.cos(p), Math.sin(t) * Math.sin(p), Math.cos(t)]
  const stored = encode(N).map((x) => Math.round(x * 255) / 255), back = decode(stored)
  const err = Math.acos(Math.min(1, N.reduce((s, x, j) => s + x * back[j], 0))) * 180 / Math.PI
  worst = Math.max(worst, err)
}
console.log('worst error over 20 000 directions: ' + r(worst) + '°')`;

const PICTURE = `${BASE}
// A sphere drawn twice, pixel by pixel: left with the Normals view (N·½ + ½), right with the UV view (u, v, 0) for
// UVs around the y axis. Along the seam (turned into view on the right) red drops from 1 to 0: orange meets green.
const toSRGB = (c) => (c < 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)
const canvas = document.createElement('canvas'), W = 340, H = 170
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'), img = g.createImageData(W * 2, H * 2)
const turn = 2.5
for (let py = 0; py < H * 2; py++) for (let px = 0; px < W * 2; px++) {
  const k = px < W ? 0 : 1, cx = (k + 0.5) * W, cy = H - 6, R = H * 0.8, i = (py * W * 2 + px) * 4
  const x = (px - cx) / R, y = (cy - py) / R
  if (x * x + y * y > 1) { img.data.set([15, 25, 35, 255], i); continue }
  const N = [x, y, Math.sqrt(1 - x * x - y * y)]
  // Turn the sphere about y so the UV seam (u = 0 at angle π) comes into view.
  const a = Math.atan2(N[2], N[0]) + turn, u = ((a / (2 * Math.PI) + 0.5) % 1 + 1) % 1, v = Math.acos(-N[1]) / Math.PI
  const c = k ? [u, v, 0] : encode(N)
  img.data.set([...c.map((t) => Math.round(255 * toSRGB(t))), 255], i)
}
g.putImageData(img, 0, 0)
g.scale(2, 2); g.fillStyle = '#cbd5e1'; g.font = '11px sans-serif'; g.textAlign = 'center'
g.fillText('Normals', W / 4, H - 2); g.fillText('UV', W * 3 / 4, H - 2)
console.log('drawn')`;

const CHALLENGE = `// A normal map texel holds the colour (0.75, 0.25, 0.5) (each 0 to 1). Which unit direction does it store?
const N = { x: 0, y: 0, z: 0 }
console.log(N)`;

const SOLVED = CHALLENGE.replace('const N = { x: 0, y: 0, z: 0 }', 'const N = { x: Math.SQRT1_2, y: -Math.SQRT1_2, z: 0 }');

/** The challenge's check: 2c − 1 = (0.5, −0.5, 0), normalised (0.7071, −0.7071, 0). */
export function checkDecode(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/x\s*:\s*([^,}]+),\s*y\s*:\s*([^,}]+),\s*z\s*:\s*([^,}\n]+)/);
  if (!m) return no('Keep the line const N = { x: …, y: …, z: … }.');
  const num = (s) => { const e = s.trim().replace(/Math\.SQRT1_2/g, String(Math.SQRT1_2)).replace(/Math\.SQRT2/g, String(Math.SQRT2)); if (!/^[\d.\s+\-*/()]+$/.test(e)) return NaN; try { return Number(new Function('return (' + e + ')')()); } catch { return NaN; } };
  const v = [num(m[1]), num(m[2]), num(m[3])];
  if (!v.every(Number.isFinite)) return no('x, y and z must be numbers (Math.SQRT1_2 is allowed).');
  const near = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 2e-3);
  if (near(v, [Math.SQRT1_2, -Math.SQRT1_2, 0])) return { pass: true, message: 'Right: undo the encoding, N = 2c − 1 = (0.5, −0.5, 0), then normalise (8-bit storage and filtering shorten it): (0.7071, −0.7071, 0). It points along +x and −y, 45° between them.' };
  if (v.every((x) => x === 0)) return no('Undo the encoding: c = N · ½ + ½, so N = 2c − 1.');
  if (near(v, [0.5, -0.5, 0])) return no('(0.5, −0.5, 0) has length 0.707, not 1: normalise it.');
  if (near(v, [0.75, 0.25, 0.5])) return no('That is the colour itself. The colour is N · ½ + ½; solve for N.');
  if (near(v, [0.5, 0, 0.5]) || near(v, [0.25, -0.25, 0])) return no('Undo the encoding with N = 2c − 1 (multiply by 2, then subtract 1).');
  return no('Decode with N = 2c − 1 for each channel, then divide by the length.');
}

export default {
  id: 'modelling-geometry-9-005',
  slug: 'debug-views',
  chapter: 'modelling-geometry',
  order: 5,
  title: 'Debug views',
  subtitle: 'Shading that shows data instead of light: normals and UVs as colours, and the faults they make obvious.',
  tags: ['shading', 'debugging', 'normals', 'uv', 'normal maps', 'encoding', 'rgb'],
  coreConcept: 'A debug view is a shader that paints data as colour. The Normals view encodes the unit normal as c = N · ½ + ½, so each component from −1 to 1 becomes a channel from 0 to 1: +x red, +y green, +z blue. A face wound the wrong way shows the colour of the face opposite it; a bad vertex normal shows as a smudge of the wrong hue. The UV view paints (u, v, 0): smooth gradients mean smooth UVs, a sudden jump is a seam, stretched gradients are distortion. The same encoding stores directions in normal maps, decoded with N = normalize(2c − 1); 8 bits per channel keeps every direction within about 0.4°.',
  prerequisites: ['modelling-geometry-9-001', 'modelling-geometry-1-002'],
  timeToComplete: 30,
  nextLesson: 'modelling-geometry-9-006',

  hook: {
    question: 'A model looks fine from the front but one panel is mysteriously dark, and a texture shows a crack along the back. Neither number is visible in a normal render. How do you see a mesh\'s normals and UVs directly?',
    realWorldContext: 'Every engine and modelling tool has normal and UV debug views (Blender\'s Face Orientation and UV overlays, Unity\'s and Unreal\'s buffer visualisations). Normal maps, the purple-blue textures used everywhere in games, are the same encoding stored in an image.',
  },

  intuition: {
    prose: [
      'A shader does not have to compute light. The **Normals** view returns the normal itself as the colour, squeezed from $-1 \\ldots 1$ into $0 \\ldots 1$: $c = N \\cdot \\tfrac12 + \\tfrac12$. Pointing along $+x$ is red, $+y$ green, $+z$ (towards the default camera) blue; pointing the other way gives the opposite colour. Before running cell 1, predict the colour of a normal pointing straight up: $(0.5, 1, 0.5)$, a light green.',
      'Now faults stand out. A face wound the wrong way (lesson 1.2) has its normal pointing inward, so it shows the colour of the face **opposite** it: the back of a box turning the front\'s blue. Before running cell 2, predict how to spot the flipped face from the colours alone: two faces share one colour and the other is missing.',
      'The **UV** view returns $(u, v, 0)$: red grows along $u$, green along $v$. On a good unwrap the colours change smoothly; along a seam, where neighbouring corners have different UVs (lesson 8.1), the colour jumps. Before running cell 3, predict where the jump is on a cylinder: where $u$ restarts from 1 to 0.',
      '**Normal maps** store directions in images with the same encoding, which is why they look purple-blue: most stored normals point mostly along $+z$, colour $(0.5, 0.5, 1)$. Decoding is $N = \\text{normalize}(2c - 1)$. With 8 bits per channel there are only 256 levels; before running cell 4, predict the worst direction error: under half a degree (0.38°), too small to see.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Debugging with views',
        body: 'Step 1. Switch to the Normals view. Look for faces whose colour matches the face opposite (flipped) and smudges of the wrong hue across smooth areas (bad vertex normals).\nStep 2. Flip the wrong faces (Mesh › Flip normals) or recalculate normals.\nStep 3. Switch to the UV view. Look for sudden colour jumps (seams) where you did not mean one, and stretched or squeezed gradients (distortion).\nStep 4. Switch back to the lit view.',
      },
      {
        type: 'warning',
        title: 'World or object or tangent space',
        body: 'MeshLab\'s view shows world-space normals: turning the object changes the colours. Some tools show object-space normals; normal maps are usually in tangent space, where (0, 0, 1) means "straight out of the surface". Know which before reading the colours.',
      },
      {
        type: 'warning',
        title: 'Normal maps are not colour',
        body: 'A normal map holds numbers, not colours: it must be read without sRGB decoding. Loaded as sRGB, every stored direction is bent towards the axes, and the lighting goes subtly wrong.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: finding bad normals and UVs',
        body: 'A wrong normal is invisible in a matte render from some angles and obvious from others; in the Normals view it is obvious from everywhere. The UV view does the same for seams before any texture is painted.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "debug views are just odd-looking materials". The left sphere\'s colour is its normal: green on top, red to the right, blue facing you. The right one\'s is its UV: red grows round the sphere and drops from 1 to 0 at the seam, a sharp line where orange meets green.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'encode() is c = N·½ + ½, decode() is normalize(2c − 1); the inward test in cell 2 is lesson 1.2\'s normal-against-centre check; the jump test in cell 3 finds seams.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'In GLSL the Normals body is one line, return N * 0.5 + 0.5; the UV body is return vec3(uv, 0.0). The output is then sRGB-encoded like any colour, so 0.5 reaches the screen as 188.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Inspector › Shader: Normals or UV. Mesh › Trace the shading on a Normals object traces the encoding (predict the colour). Mesh › Flip normals fixes a flipped face; UV › Mark seam and Unwrap change what the UV view shows.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: debug views',
        caption: 'Encoding normals, finding a flipped face, finding a seam, 8-bit precision, and two views of a sphere.',
        props: {
          lesson: {
            title: 'Debug views',
            subtitle: 'Data as colour.',
            cells: [
              { type: 'js', instruction: '### 1. Directions as colours\nPredict first: straight up.', startCode: ENCODE },
              { type: 'js', instruction: '### 2. A flipped face\nPredict first: how the colours give it away.', startCode: FLIPPED },
              { type: 'js', instruction: '### 3. A seam\nPredict first: where u jumps.', startCode: SEAMS },
              { type: 'js', instruction: '### 4. 8-bit normals\nPredict first: the worst error.', startCode: PRECISION },
              { type: 'js', instruction: '### 5. See it\nNormals and UV views of a sphere.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 230 },
              { type: 'challenge', instruction: '### 6. Challenge: decode a texel\nThe check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkDecode },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Debug views" in MeshLab](#/lab/mesh-lab?project=debug-views). A box with a flipped face in the Normals view, a globe in the UV view; a corner of the flipped face is traced: press Play, and predict its colour.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Inspector › Shader: Normals** or **UV**.\n- **Mesh › Flip normals** on a wrong face; **Mesh › Trace the shading** to see the encoding.\n- [Open "Winding and normals"](#/lab/mesh-lab?project=winding-and-normals): more faces to fix.\n- **Elsewhere:** Blender\'s Face Orientation overlay (blue out, red in) and its UV editor; engines\' G-buffer views.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Encoding.** $c = \\tfrac12 N + \\tfrac12$ maps the cube $[-1, 1]^3$ (which contains the unit sphere) onto $[0, 1]^3$. It is affine and invertible: $N = 2c - 1$.',
      '**Quantisation.** Storing each channel in $b$ bits rounds $c$ to the nearest of $2^b$ levels, an error of at most $\\tfrac{1}{2(2^b - 1)}$ in $c$ and twice that in $N$: $\\approx 0.004$ for 8 bits. Renormalising after decoding keeps the length 1; the angle error is then at most about $\\sqrt3 \\times 0.004 = 0.0068$ radians, $0.39°$.',
      '**Flipped faces.** Reversing a face\'s corners negates its Newell normal, so its encoded colour becomes $1 - c$: the colour of the face pointing the opposite way.',
      '**Seams in the UV view.** Across a seam the two sides\' UVs differ by a jump; across any other edge they agree, so the colour is continuous.',
    ],
    equations: [
      { label: 'Encode', latex: 'c = \\tfrac12 N + \\tfrac12' },
      { label: 'Decode', latex: 'N = \\text{normalize}(2c - 1)' },
      { label: 'Flipped', latex: 'c(-N) = 1 - c(N)' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** The encoding E(N) = ½N + ½ is a bijection from ℝ³ to ℝ³ that maps the unit sphere into [0, 1]³; with quantisation Q to 8 bits, normalize(2Q(E(N)) − 1) differs from N by an angle bounded by about 0.007 rad for all unit N.',
      '**Invariant viewpoint.** World-space normal colours change when the object turns; object-space colours do not; tangent-space colours depend only on the surface\'s own bumps. The data is the same vector, expressed in different frames.',
      '**Geometric picture.** Paint the eight corners of a colour cube on the eight octants of a sphere: every direction gets its own colour, and opposite directions get complementary ones.',
      '**Where this goes.** Lesson 9.6 builds textures from formulas; 9.7 writes shaders, where these views are the first tool for finding mistakes.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-9-005-ex1',
      title: 'Encode',
      problem: 'What colour does N = (−0.6, 0.8, 0) get?',
      steps: [{ expression: '(-0.3 + 0.5, \\; 0.4 + 0.5, \\; 0.5) = (0.2, 0.9, 0.5)', annotation: '½N + ½.' }],
      conclusion: '(0.2, 0.9, 0.5): mostly green, little red.',
    },
    {
      id: 'modelling-geometry-9-005-ex2',
      title: 'A flipped top',
      problem: 'The top face of a box shows (0.5, 0, 0.5). What is wrong?',
      steps: [{ expression: 'N = 2c - 1 = (0, -1, 0)', annotation: 'Pointing down.' }],
      conclusion: 'The top face points down: it is flipped.',
    },
    {
      id: 'modelling-geometry-9-005-ex3',
      title: 'A normal-map texel',
      problem: 'Decode (128, 128, 255) out of 255.',
      steps: [{ expression: '2(0.502, 0.502, 1) - 1 = (0.004, 0.004, 1)', annotation: 'Then normalise.' }],
      conclusion: 'Straight out of the surface: the flat colour of a normal map.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-9-005-ch1',
      difficulty: 'easy',
      problem: 'In the Normals view, why does a flipped face look like the face opposite it?',
      walkthrough: [{ expression: 'c(-N) = 1 - c(N)', annotation: 'Reversed corners negate the normal.' }],
      answer: 'Reversing the corner order negates the face\'s normal, and the encoding of −N is the colour of the face that really points that way: the opposite face\'s.',
    },
    {
      id: 'modelling-geometry-9-005-ch2',
      difficulty: 'medium',
      problem: 'Why do normal maps look mostly purple-blue?',
      walkthrough: [{ expression: 'N \\approx (0, 0, 1) \\Rightarrow c \\approx (0.5, 0.5, 1)', annotation: 'Tangent space.' }],
      answer: 'Normal maps are stored in tangent space, where (0, 0, 1) means straight out of the surface. Most texels are close to that, encoding to (0.5, 0.5, 1): a light purple-blue; bumps tilt them towards red or green.',
    },
    {
      id: 'modelling-geometry-9-005-ch3',
      difficulty: 'hard',
      problem: 'Estimate the worst angle error of an 8-bit normal and compare with cell 4.',
      walkthrough: [
        { expression: '\\Delta c \\le \\tfrac{1}{510}', annotation: 'Half a level.' },
        { expression: '\\Delta N \\le \\tfrac{2}{510} \\text{ per component}', annotation: 'N = 2c − 1.' },
        { expression: '|\\Delta N| \\lesssim \\sqrt3 \\cdot 0.0039 = 0.0068 \\text{ rad}', annotation: 'All three components off at once.' },
      ],
      answer: 'Each component is off by at most 2/510 ≈ 0.0039; with all three off at once the error vector is at most √3 × 0.0039 ≈ 0.0068 long, and for a unit vector that is about 0.0068 rad ≈ 0.39° of angle. Cell 4 measures 0.38°.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'c = \\tfrac12 N + \\tfrac12', meaning: 'A direction as a colour.' },
      { symbol: 'N = \\text{normalize}(2c - 1)', meaning: 'A colour back to a direction.' },
      { symbol: '(u, v, 0)', meaning: 'The UV view\'s colour.' },
      { symbol: '1 - c', meaning: 'The colour of the opposite direction.' },
      { symbol: '2^8 = 256', meaning: 'Levels per channel in an 8-bit texture.' },
      { symbol: '(0.5, 0.5, 1)', meaning: 'The flat normal-map colour.' },
    ],
    rulesOfThumb: [
      'Red x, green y, blue z.',
      'Flipped face: the opposite face\'s colour.',
      'UV jumps are seams.',
      'Decode with 2c − 1, then normalise.',
      'Normal maps are data, not sRGB.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-9-001', label: 'Light and the cosine law', note: 'The shader frame these views reuse.' },
      { lessonId: 'modelling-geometry-1-002', label: 'Winding and normals', note: 'Why reversed corners flip a normal.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-9-006', label: 'Procedural textures', note: 'Images made from formulas.' },
      { lessonId: 'modelling-geometry-9-007', label: 'Write a shader', note: 'Debugging your own.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-9-005-1', label: 'Read how a normal is encoded as a colour', type: 'read' },
    { id: 'cp-modelling-geometry-9-005-2', label: 'Read what a flipped face and a seam look like', type: 'read' },
    { id: 'cp-modelling-geometry-9-005-3', label: 'Read normal maps and 8-bit precision', type: 'read' },
    { id: 'cp-modelling-geometry-9-005-4', label: 'Run cells 1 to 4: encoding, flipped face, seam, precision', type: 'lab' },
    { id: 'cp-modelling-geometry-9-005-5', label: 'Find and fix a flipped face in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-9-005-6', label: 'Work through example 1, encode', type: 'example' },
    { id: 'cp-modelling-geometry-9-005-7', label: 'Work through example 2, a flipped top', type: 'example' },
    { id: 'cp-modelling-geometry-9-005-8', label: 'Complete the challenge: decode a texel', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-9-005-assess-1',
        type: 'choice',
        text: 'In the Normals view, a face pointing along −x is shown as:',
        options: ['(0, 0.5, 0.5)', '(1, 0.5, 0.5)', '(0, 0, 0)', '(0.5, 0, 0.5)'],
        answer: '(0, 0.5, 0.5)',
        hint: '½N + ½.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-9-005-quiz-1',
      type: 'choice',
      text: 'A normal pointing straight up shows as:',
      options: ['(0.5, 1, 0.5)', '(0, 1, 0)', '(1, 1, 1)', '(0.5, 0.5, 1)'],
      answer: '(0.5, 1, 0.5)',
      hints: ['Cell 1.', '½N + ½.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-9-005-quiz-2',
      type: 'choice',
      text: 'A flipped face in the Normals view shows:',
      options: ['The colour of the face opposite it', 'Black', 'White', 'Its own colour, darker'],
      answer: 'The colour of the face opposite it',
      hints: ['Cell 2.', 'c(−N) = 1 − c(N).'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-9-005-quiz-3',
      type: 'choice',
      text: 'In the UV view a seam shows as:',
      options: ['A sudden jump in colour', 'A black line', 'A smooth gradient', 'Nothing'],
      answer: 'A sudden jump in colour',
      hints: ['Cell 3.', 'Neighbouring corners with different UVs.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-9-005-quiz-4',
      type: 'choice',
      text: '8 bits per channel keeps a normal map\'s directions within about:',
      options: ['Less than half a degree', '5 degrees', '0.001 degrees', '1 degree per bit'],
      answer: 'Less than half a degree',
      hints: ['Cell 4.', 'Challenge 3.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-9-005-quiz-5',
      type: 'choice',
      text: 'Why are normal maps mostly purple-blue?',
      options: ['Most stored normals point almost straight out: (0.5, 0.5, 1)', 'They are compressed', 'It is a convention for artists', 'Blue is cheaper'],
      answer: 'Most stored normals point almost straight out: (0.5, 0.5, 1)',
      hints: ['Challenge 2.', 'Tangent space.'],
      reviewSection: 'Challenge',
    },
    {
      id: 'modelling-geometry-9-005-quiz-6',
      type: 'choice',
      text: 'A normal map should be loaded:',
      options: ['Without sRGB decoding', 'As sRGB', 'In 1 bit', 'Upside down'],
      answer: 'Without sRGB decoding',
      hints: ['Warning "Normal maps are not colour".', 'They are data.'],
      reviewSection: 'Warning "Normal maps are not colour"',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'Debug views are just odd-looking materials.',
      whyStudentsThinkIt: 'They look like colourful shading.',
      correctionExample: 'The picture: every colour is a number, the normal or the UV, readable back exactly.',
      contrastCase: 'A colourful lit material\'s colours depend on the light; these never do.',
    },
    {
      falseBelief: 'A flipped face is easy to see in a normal render.',
      whyStudentsThinkIt: 'It is wrong, so it should look wrong.',
      correctionExample: 'From some angles it only looks slightly dark; in the Normals view it shows the opposite face\'s colour from every angle.',
      contrastCase: 'With back-face culling on, it vanishes instead, which is also a clue.',
    },
    {
      falseBelief: 'The normal map colour is the normal.',
      whyStudentsThinkIt: 'It is stored in the texture.',
      correctionExample: 'The challenge: the colour (0.75, 0.25, 0.5) decodes to (0.71, −0.71, 0).',
      contrastCase: 'The encoding is simple and exactly invertible.',
    },
  ],

  transferPrompts: [
    {
      situation: 'An imported model has dark patches only visible from certain angles.',
      competingTechniques: ['Brighten the lights', 'Switch to the Normals view and look for faces showing the opposite colour'],
      whyThisTechniqueWins: 'Dark patches from some angles are the classic sign of flipped faces or bad normals; the Normals view shows them from every angle.',
    },
    {
      situation: 'A baked normal map makes lighting look subtly off.',
      competingTechniques: ['Re-bake at higher resolution', 'Check the texture is loaded as linear data, not sRGB'],
      whyThisTechniqueWins: 'sRGB decoding bends every stored direction; the fix is a texture setting, not more texels.',
    },
  ],

  debugging: [
    {
      commonError: 'Forgetting to normalise after decoding.',
      symptom: 'Lighting slightly too dark on bumpy areas.',
      whyItHappened: 'Quantised and filtered normals are shorter than 1.',
      repairStrategy: 'N = normalize(2c − 1).',
    },
    {
      commonError: 'Reading world-space colours as if they were tangent-space.',
      symptom: 'Normals "look wrong" after the object is rotated.',
      whyItHappened: 'World-space colours change with the object\'s orientation.',
      repairStrategy: 'Know the space; compare colours only within one.',
    },
    {
      commonError: 'Showing the debug colour without the screen encoding in mind.',
      symptom: '0.5 reads as 188 in a screenshot colour picker.',
      whyItHappened: 'The output is sRGB-encoded like any colour.',
      repairStrategy: 'Decode the screenshot value (188 → 0.5), or read the shader output directly.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Encode and decode normals and read faults off the Normals and UV views.',
    explainVerbally: 'Explain the encoding, why flipped faces show the opposite colour, and why normal maps are blue.',
    detectIncorrectApplication: 'Recognise unnormalised decodes, wrong spaces and sRGB-loaded normal maps.',
    transferToUnfamiliar: 'Debug imported models and baked maps in any tool.',
  },
};
