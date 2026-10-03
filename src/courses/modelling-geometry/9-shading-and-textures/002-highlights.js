// Lesson 9.2: highlights. A shiny surface reflects light most towards the mirror direction. Phong measures how close
// the eye is to the reflected ray, (R·V)^n; Blinn–Phong measures how close the normal is to the half vector between
// light and eye, (N·H)^n, cheaper and better behaved. The exponent (shininess) sets the highlight's size.

const BASE = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)
const norm = (a) => a.map((x) => x / Math.hypot(...a))
const deg = (rad) => rad * 180 / Math.PI
const toSRGB = (c) => (c < 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)
const toLinear = (c) => (c < 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
`;

const MIRROR = `${BASE}
// Light from 40° to one side of the normal. The mirror direction R = 2(N·L)N − L is 40° to the other side.
// Move the eye round and compare Phong's angle (between R and V) with Blinn's (between N and H = normalize(L + V)).
// Predict first: when the eye is 20° from R, how far is N from H?
const N = [0, 1, 0], L = [Math.sin(-40 * Math.PI / 180), Math.cos(40 * Math.PI / 180), 0]
const R = N.map((n, i) => 2 * dot(N, L) * n - L[i])
console.log('R = (' + R.map(r).join(', ') + '), ' + r(deg(Math.acos(R[1]))) + '° from N')
for (const eyeDeg of [40, 50, 60, 80]) {
  const V = [Math.sin(eyeDeg * Math.PI / 180), Math.cos(eyeDeg * Math.PI / 180), 0], H = norm(L.map((l, i) => l + V[i]))
  console.log('eye at ' + eyeDeg + '°: R to V ' + r(deg(Math.acos(Math.min(1, dot(R, V))))) + '°, N to H ' + r(deg(Math.acos(Math.min(1, dot(N, H))))) + '°')
}`;

const WIDTH = `${BASE}
// How wide is the highlight? It falls to half where (cos α)^n = ½, α the angle between N and H: α = acos(½^(1/n)).
// Predict first: for shininess 40, about how many degrees?
for (const n of [5, 10, 40, 100, 200]) console.log('shininess ' + n + ': half brightness ' + r(deg(Math.acos(Math.pow(0.5, 1 / n)))) + '° from the centre')`;

const COLOUR = `${BASE}
// A red plastic and a red metal under white light, at the centre of the highlight (N·H = 1) with N·L = 0.8.
// Plastic: the highlight is the light's colour. Metal: it is tinted by the metal itself (lesson 9.3 explains why).
// Predict first: the colour of each highlight.
const red = [0.8, 0.1, 0.1], light = [1, 1, 1], d = 0.8, s = 1, strength = 0.6
const plastic = red.map((b, k) => b * d * light[k] + s * strength * light[k])
const metal = red.map((b, k) => s * strength * b * light[k])
console.log('plastic: (' + plastic.map(r).join(', ') + ')  →  screen (' + plastic.map((c) => Math.round(255 * Math.min(1, toSRGB(c)))).join(', ') + ')')
console.log('metal:   (' + metal.map(r).join(', ') + ')  →  screen (' + metal.map((c) => Math.round(255 * Math.min(1, toSRGB(c)))).join(', ') + ')')`;

const PICTURE = `${BASE}
// Three Blinn–Phong balls, shininess 5, 40 and 200, lit from the upper right, drawn pixel by pixel.
const canvas = document.createElement('canvas'), W = 390, H = 150
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'), img = g.createImageData(W * 2, H * 2)
const L = norm([0.6, 0.6, 0.55]), V = [0, 0, 1], Hv = norm(L.map((l, i) => l + V[i])), base = [0.23, 0.44, 0.83].map(toLinear), ambient = 0.05
const shin = [5, 40, 200], peak = [0, 0, 0]
for (let py = 0; py < H * 2; py++) for (let px = 0; px < W * 2; px++) {
  const k = Math.floor(px / (W * 2 / 3)), cx = (k + 0.5) * W * 2 / 3, cy = H - 6, R = H * 0.78, i = (py * W * 2 + px) * 4
  const x = (px - cx) / R, y = (cy - py) / R
  if (x * x + y * y > 1) { img.data.set([15, 25, 35, 255], i); continue }
  const N = [x, y, Math.sqrt(1 - x * x - y * y)], d = Math.max(dot(N, L), 0), s = d > 0 ? Math.pow(Math.max(dot(N, Hv), 0), shin[k]) : 0
  peak[k] = Math.max(peak[k], s)
  img.data.set([...base.map((b) => Math.round(255 * Math.min(1, toSRGB(b * (ambient + d) + 0.6 * s)))), 255], i)
}
g.putImageData(img, 0, 0)
g.scale(2, 2); g.fillStyle = '#cbd5e1'; g.font = '11px sans-serif'; g.textAlign = 'center'
shin.forEach((n, k) => g.fillText('shininess ' + n, (k + 0.5) * W / 3, H - 2))
console.log('brightest highlight on each: ' + peak.map(r).join(', '))`;

const CHALLENGE = `// You want a highlight that falls to half its brightness 10° from its centre (N·H = cos 10°).
// What shininess n gives (cos 10°)^n = 0.5?
const n = 0
console.log(n)`;

const SOLVED = CHALLENGE.replace('const n = 0', 'const n = Math.log(0.5) / Math.log(Math.cos(10 * Math.PI / 180))');

/** The challenge's check: n = ln ½ / ln cos 10° = 45.27. */
export function checkShininess(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+n\s*=\s*([^\n]+)/);
  if (!m) return no('Keep the line const n = …, with a number or an expression.');
  // Only arithmetic and a few Math functions are evaluated: this runs in the page, not the cell's sandbox.
  const expr = m[1].replace(/\/\/.*$/, '').trim().replace(/;$/, '');
  if (!/^[\d.,\s+\-*/()]*$/.test(expr.replace(/Math\.(log|cos|sin|acos|pow|PI|sqrt)|\*\*/g, ''))) return no('Write n as a number, or arithmetic with Math.log, Math.cos, Math.pow and Math.PI.');
  if (/Math\.cos\(\s*10\s*\)/.test(expr)) return no('Math.cos takes radians: 10° is 10 * Math.PI / 180.');
  let v;
  try { v = Number(new Function('return (' + expr + ')')()); } catch { return no('That expression did not run.'); }
  if (!Number.isFinite(v)) return no('n must be a number.');
  const right = Math.log(0.5) / Math.log(Math.cos(10 * Math.PI / 180));
  if (Math.abs(v - right) < 0.5) return { pass: true, message: `${+v.toFixed(2)}: take logs of (cos 10°)ⁿ = ½: n · ln(cos 10°) = ln ½, so n = ln ½ / ln(cos 10°) = −0.693 / −0.01531 = 45.3. Shininess 40 (the default) is a little wider.` };
  if (v === 0) return no('Take logarithms of both sides: n · ln(cos 10°) = ln(½).');
  if (Math.abs(v - Math.log(Math.cos(10 * Math.PI / 180)) / Math.log(0.5)) < 0.01) return no('Upside down: n = ln(½) / ln(cos 10°).');
  if (Math.abs(v - 0.5 / (1 - Math.cos(10 * Math.PI / 180))) < 0.5) return no('(cos 10°)ⁿ is not linear in n: take logarithms instead of dividing.');
  return no(`${+v.toFixed(3)} does not make (cos 10°)ⁿ = 0.5: try it, then solve with logarithms.`);
}

export default {
  id: 'modelling-geometry-9-002',
  slug: 'highlights',
  chapter: 'modelling-geometry',
  order: 2,
  title: 'Highlights',
  subtitle: 'The bright spot on shiny things: the mirror direction, the half vector, and how shininess sets its size.',
  tags: ['shading', 'specular', 'phong', 'blinn-phong', 'half vector', 'shininess', 'highlights'],
  coreConcept: 'A shiny surface sends most of its reflected light along the mirror direction R = 2(N·L)N − L, so it looks brightest where the eye is close to R. Phong\'s model adds (R·V)^n; Blinn–Phong adds (N·H)^n with the half vector H = normalize(L + V), which peaks at the same place, is cheaper, and never cuts off abruptly. The exponent n (shininess) sets the size: the highlight falls to half at α = acos(½^(1/n)) from its centre. Unlike the diffuse term, the highlight depends on where the eye is, and it is added in the light\'s colour for plastics and in the material\'s colour for metals.',
  prerequisites: ['modelling-geometry-9-001'],
  timeToComplete: 35,
  nextLesson: 'modelling-geometry-9-003',

  hook: {
    question: 'Walk past a polished car and its bright spots slide along the body with you, while the matte paint stays the same. Why do highlights move when you move, and what decides whether one is a small sharp sparkle or a broad soft sheen?',
    realWorldContext: 'Blinn–Phong (1977) was the standard highlight in OpenGL\'s fixed pipeline and is still used in stylised and mobile rendering; physically based shading (lesson 9.3) replaced it in most engines, but its half vector lives on inside the GGX highlight.',
  },

  intuition: {
    prose: [
      'A mirror sends light from $L$ to exactly one direction, $R = 2(N\\cdot L)N - L$: the reflection of $L$ across $N$. A glossy surface is a slightly imperfect mirror: it sends most of the light near $R$ and less further away. So the surface looks brightest where the eye\'s direction $V$ is close to $R$, and that depends on where you stand: the highlight moves when you move.',
      '**Phong** measures that closeness directly: $(R\\cdot V)^n$. **Blinn–Phong** measures it differently: the half vector $H = \\text{normalize}(L + V)$ is the normal a perfect mirror would need to send $L$ to $V$, so the surface is bright where $N$ is close to $H$: $(N\\cdot H)^n$. Both peak at the same place, but the angle between $N$ and $H$ is half the angle between $R$ and $V$. Before running cell 1, predict: when the eye is $20°$ from $R$, $N$ is $10°$ from $H$.',
      'The exponent $n$, the **shininess**, decides the size. Raising a number just below 1 to a high power makes it fall fast: the highlight is half as bright at $\\alpha = \\arccos(\\tfrac12^{1/n})$ from its centre. Before running cell 2, predict that angle for shininess 40: about $10.6°$.',
      'The highlight is light reflected at the surface before it enters the material, so on plastic, paint and skin it has the **light\'s** colour: a white spot on a red ball. Metals have no "inside" to colour the light, so their highlight takes the **metal\'s** colour (cell 3; lesson 9.3).',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Blinn–Phong at one pixel',
        body: 'Step 1. Lambert part: base · (ambient + max(N·L, 0) · light) (lesson 9.1).\nStep 2. H = normalize(L + V).\nStep 3. s = max(N·H, 0)^shininess, and 0 if N·L ≤ 0 (no highlight on the dark side).\nStep 4. Add s · light · specular strength.\nStep 5. Encode to sRGB.',
      },
      {
        type: 'warning',
        title: 'No highlight on the dark side',
        body: 'N·H can be positive where N·L is negative (light behind the surface, eye in front). Without the d > 0 test a highlight appears on the unlit side. MeshLab\'s shader checks it.',
      },
      {
        type: 'warning',
        title: 'Blinn needs a larger exponent',
        body: 'The N–H angle is about half the R–V angle, so (N·H)^n gives a wider highlight than (R·V)^n with the same n. To match a Phong highlight, use roughly four times the exponent.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: shininess',
        body: 'Shininess is the slider artists use for "how polished": 5 is brushed, 40 is plastic, 200 is lacquer. A highlight narrower than the gaps between vertices only appears if it is computed per pixel, which is why lighting moved from the vertex shader to the fragment shader.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "a shinier surface has a brighter highlight". All three peaks reach the same brightness; the higher shininess only makes the spot smaller.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'R in cell 1 is 2(N·L)N − L; Hv = norm(L + V) is the half vector; Math.pow(N·H, n) is the highlight.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'GLSL has reflect() for R and pow() for the exponent. H costs one normalize per pixel; for a distant light and a distant viewer it is even constant across the screen.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Inspector › Shader: Blinn–Phong, with Shininess; specular strength is 0.9 × (1 − roughness). Mesh › Trace the shading adds the half vector and the highlight (predict s) to the Lambert steps. In a script: obj.traceShading(v, { eye }).' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: highlights',
        caption: 'The mirror direction and the half vector, the highlight\'s width, its colour, and three shininesses.',
        props: {
          lesson: {
            title: 'Highlights',
            subtitle: 'Where the mirror would send the light.',
            cells: [
              { type: 'js', instruction: '### 1. R and H\nPredict first: the N–H angle when the eye is 20° from R.', startCode: MIRROR },
              { type: 'js', instruction: '### 2. The highlight\'s width\nPredict first: shininess 40.', startCode: WIDTH },
              { type: 'js', instruction: '### 3. The highlight\'s colour\nPredict first: plastic and metal.', startCode: COLOUR },
              { type: 'js', instruction: '### 4. See it\nShininess 5, 40, 200.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 220 },
              { type: 'challenge', instruction: '### 5. Challenge: choose a shininess\nThe check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkShininess },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Highlights" in MeshLab](#/lab/mesh-lab?project=highlights). Three balls of different shininess; the brightest vertex of the middle one is traced: press Play, and predict s.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Inspector › Shader: Blinn–Phong**, then change Shininess and Roughness.\n- **Mesh › Trace the shading** on a vertex near the highlight; orbit and trace again.\n- In a script: `obj.material.shininess = 40`, `obj.traceShading(v, { eye: [0, 1, 7] })`.\n- [Open the "Shader gallery"](#/lab/mesh-lab?project=shader-gallery): Blinn–Phong 10 against 120.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Reflection.** The mirror image of unit $L$ across unit $N$ is $R = 2(N\\cdot L)N - L$: the component along $N$ is kept, the component across it reversed.',
      '**Phong and Blinn–Phong.** $s_P = \\max(R\\cdot V, 0)^n$, $s_B = \\max(N\\cdot H, 0)^n$ with $H = (L + V)/|L + V|$. When $N$, $L$ and $V$ lie in one plane, the angle between $N$ and $H$ is exactly half the angle between $R$ and $V$; in general it is close to half.',
      '**Width.** $s$ falls to $\\tfrac12$ where $\\cos^n\\alpha = \\tfrac12$, i.e. $\\alpha_{1/2} = \\arccos(2^{-1/n})$; for large $n$, $\\alpha_{1/2} \\approx \\sqrt{2\\ln 2 / n}$ radians, so the width shrinks like $1/\\sqrt n$.',
      '**Normalisation.** The total light a $\\cos^n$ lobe reflects grows smaller as $n$ grows. Energy-conserving versions multiply by $(n + 8)/(8\\pi)$ so shinier surfaces get brighter, smaller highlights; MeshLab\'s keeps the peak at 1, the classic choice.',
    ],
    equations: [
      { label: 'Mirror direction', latex: 'R = 2(N\\cdot L)\\,N - L' },
      { label: 'Half vector', latex: 'H = \\frac{L + V}{|L + V|}' },
      { label: 'Blinn–Phong', latex: 's = \\max(N\\cdot H, 0)^n' },
      { label: 'Half width', latex: '\\alpha_{1/2} = \\arccos\\big(2^{-1/n}\\big)' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** For coplanar unit vectors N, L, V with angles measured from N, if L is at −a and V at b, then R is at a and H at (b − a)/2, so ∠(R, V) = b − a = 2∠(N, H). Hence s_B with exponent 4n approximates s_P with exponent n near the peak (both ≈ exp(−n(b − a)²/2)).',
      '**Invariant viewpoint.** The highlight depends on L, V and N together: it moves with the eye, while the Lambert part does not. Rotating the whole scene (light, eye and object) leaves both unchanged.',
      '**Geometric picture.** The highlight is the reflection of the light source in a slightly blurry mirror: a polished ball shows a small sharp image of the sun, a satin one a soft glow.',
      '**Where this goes.** Lesson 9.3 replaces the cosine power by a physically based distribution of microfacet normals around H, with Fresnel and shadowing; 9.4 turns the highlight into a hard-edged cartoon spot.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-9-002-ex1',
      title: 'The mirror direction',
      problem: 'N = (0, 1, 0), L = (0.6, 0.8, 0). Find R.',
      steps: [{ expression: '2 \\cdot 0.8 \\cdot (0, 1, 0) - (0.6, 0.8, 0) = (-0.6, 0.8, 0)', annotation: 'N·L = 0.8.' }],
      conclusion: 'R = (−0.6, 0.8, 0): mirrored across N.',
    },
    {
      id: 'modelling-geometry-9-002-ex2',
      title: 'A highlight value',
      problem: 'N·H = 0.98, shininess 40. What is s?',
      steps: [{ expression: '0.98^{40} = 0.446', annotation: 'A small miss costs a lot.' }],
      conclusion: '0.446: less than half the peak, though N is only 11.5° from H.',
    },
    {
      id: 'modelling-geometry-9-002-ex3',
      title: 'Half width',
      problem: 'At what angle does a shininess-200 highlight fall to half?',
      steps: [{ expression: '\\arccos(0.5^{1/200}) = 4.77°', annotation: 'Narrow.' }],
      conclusion: '4.77°.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-9-002-ch1',
      difficulty: 'easy',
      problem: 'Why does the highlight move when the camera moves, but the diffuse shading does not?',
      walkthrough: [{ expression: 'H = \\text{normalize}(L + V)', annotation: 'V depends on the camera.' }],
      answer: 'The highlight uses V (through R·V or H), the direction to the eye; the Lambert term uses only N and L. Moving the camera changes V, so the place where N is closest to H moves.',
    },
    {
      id: 'modelling-geometry-9-002-ch2',
      difficulty: 'medium',
      problem: 'Why test N·L > 0 before adding the highlight?',
      walkthrough: [{ expression: 'N\\cdot L < 0 \\text{ but } N\\cdot H > 0', annotation: 'Possible when L and V are on opposite sides.' }],
      answer: 'With the light behind the surface and the eye in front, H can still point partly along N, giving a highlight on the unlit side, which is impossible. Requiring N·L > 0 removes it.',
    },
    {
      id: 'modelling-geometry-9-002-ch3',
      difficulty: 'hard',
      problem: 'Show that for large n the highlight\'s half width is about √(2 ln 2 / n) radians.',
      walkthrough: [
        { expression: '\\cos^n\\alpha \\approx (1 - \\alpha^2/2)^n \\approx e^{-n\\alpha^2/2}', annotation: 'Small α.' },
        { expression: 'e^{-n\\alpha^2/2} = \\tfrac12 \\Rightarrow \\alpha = \\sqrt{2\\ln 2/n}', annotation: 'Solve.' },
      ],
      answer: 'For small α, cos α ≈ 1 − α²/2, and (1 − α²/2)ⁿ ≈ e^(−nα²/2). Setting it to ½ gives α² = 2 ln 2 / n. For n = 40: √(0.0347) = 0.186 rad = 10.7°, matching cell 2\'s 10.6°.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'R = 2(N\\cdot L)N - L', meaning: 'The mirror direction.' },
      { symbol: 'V', meaning: 'Towards the eye.' },
      { symbol: 'H = \\text{normalize}(L + V)', meaning: 'The half vector: the normal a mirror would need.' },
      { symbol: 'n', meaning: 'Shininess: the exponent that sets the highlight\'s size.' },
      { symbol: '(N\\cdot H)^n', meaning: 'The Blinn–Phong highlight.' },
      { symbol: '\\alpha_{1/2}', meaning: 'Where the highlight falls to half.' },
    ],
    rulesOfThumb: [
      'Highlights move with the eye.',
      'Bigger shininess, smaller spot, same peak.',
      'Blinn needs about 4× Phong\'s exponent.',
      'No highlight where N·L ≤ 0.',
      'Plastic: light\'s colour. Metal: its own.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-9-001', label: 'Light and the cosine law', note: 'The diffuse part the highlight is added to.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-9-003', label: 'Physically based shading', note: 'Microfacets, Fresnel and energy.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-9-002-1', label: 'Read the mirror direction and why highlights move', type: 'read' },
    { id: 'cp-modelling-geometry-9-002-2', label: 'Read Phong against Blinn–Phong', type: 'read' },
    { id: 'cp-modelling-geometry-9-002-3', label: 'Read how shininess sets the width', type: 'read' },
    { id: 'cp-modelling-geometry-9-002-4', label: 'Run cells 1 to 3: R and H, width, colour', type: 'lab' },
    { id: 'cp-modelling-geometry-9-002-5', label: 'Trace a highlight in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-9-002-6', label: 'Work through example 1, the mirror direction', type: 'example' },
    { id: 'cp-modelling-geometry-9-002-7', label: 'Work through example 2, a highlight value', type: 'example' },
    { id: 'cp-modelling-geometry-9-002-8', label: 'Complete the challenge: choose a shininess', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-9-002-assess-1',
        type: 'choice',
        text: 'L = (0, 1, 0) and V = (1, 0, 0). The half vector H is:',
        options: ['(0.707, 0.707, 0)', '(1, 1, 0)', '(0.5, 0.5, 0)', '(0, 0, 1)'],
        answer: '(0.707, 0.707, 0)',
        hint: 'Add, then normalise.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-9-002-quiz-1',
      type: 'choice',
      text: 'Why does a highlight move when you walk past a shiny object?',
      options: ['It depends on the direction to the eye', 'The light moves', 'The surface changes', 'It does not move'],
      answer: 'It depends on the direction to the eye',
      hints: ['Challenge 1.', 'V.'],
      reviewSection: 'Intuition',
    },
    {
      id: 'modelling-geometry-9-002-quiz-2',
      type: 'choice',
      text: 'When N, L, V lie in one plane, the angle between N and H is:',
      options: ['Half the angle between R and V', 'Equal to it', 'Twice it', 'Unrelated'],
      answer: 'Half the angle between R and V',
      hints: ['Cell 1.', 'Math, Phong and Blinn–Phong.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-9-002-quiz-3',
      type: 'choice',
      text: 'A shininess-40 highlight falls to half brightness about how far from its centre?',
      options: ['10.6°', '40°', '1°', '45°'],
      answer: '10.6°',
      hints: ['Cell 2.', 'acos(0.5^(1/40)).'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-9-002-quiz-4',
      type: 'choice',
      text: 'Raising the shininess (with the peak kept at 1) makes the highlight:',
      options: ['Smaller, not brighter', 'Brighter and bigger', 'Coloured', 'Move'],
      answer: 'Smaller, not brighter',
      hints: ['The picture.', 'Same peak.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-9-002-quiz-5',
      type: 'choice',
      text: 'A red plastic ball under white light has a highlight that is:',
      options: ['White (the light\'s colour)', 'Red', 'Black', 'Blue'],
      answer: 'White (the light\'s colour)',
      hints: ['Cell 3.', 'Reflected before entering the material.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-9-002-quiz-6',
      type: 'choice',
      text: 'To match a Phong highlight of exponent 20 with Blinn–Phong, use about:',
      options: ['80', '20', '5', '10'],
      answer: '80',
      hints: ['Warning "Blinn needs a larger exponent".', 'The angle halves.'],
      reviewSection: 'Warning "Blinn needs a larger exponent"',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'A shinier surface has a brighter highlight.',
      whyStudentsThinkIt: 'Polished things sparkle.',
      correctionExample: 'The picture: shininess 5, 40 and 200 all peak at about 1; only the size changes.',
      contrastCase: 'Energy-conserving models do brighten the peak as it narrows (Math, Normalisation).',
    },
    {
      falseBelief: 'Highlights are painted on, like the base colour.',
      whyStudentsThinkIt: 'They look like spots on the surface.',
      correctionExample: 'Cell 1 and the MeshLab project: the highlight sits where N is near H, which moves with the eye.',
      contrastCase: 'Baked-in highlights in a texture do not move, which is why they look wrong in 3D.',
    },
    {
      falseBelief: 'The highlight is the surface\'s colour, made lighter.',
      whyStudentsThinkIt: 'It is on the surface.',
      correctionExample: 'Cell 3: on plastic it is the light\'s colour (white on a red ball).',
      contrastCase: 'On metal it is the metal\'s colour.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A product render of a glossy phone case needs a tight, sharp highlight.',
      competingTechniques: ['Brighten the light', 'Raise the shininess'],
      whyThisTechniqueWins: 'Sharpness is the exponent; brightening the light also brightens the diffuse and washes out the colour.',
    },
    {
      situation: 'A low-poly model shows its highlight as a blotchy star shape.',
      competingTechniques: ['More shininess', 'Compute lighting per pixel instead of per vertex'],
      whyThisTechniqueWins: 'A narrow highlight falls between vertices; per-vertex lighting interpolates colours and smears it. Per-pixel lighting evaluates (N·H)^n with the interpolated normal.',
    },
  ],

  debugging: [
    {
      commonError: 'Not normalising H.',
      symptom: 'Highlights too dim and too wide.',
      whyItHappened: 'L + V has a length anywhere from 0 to 2, not 1, so N·(L + V) is not a cosine.',
      repairStrategy: 'H = normalize(L + V).',
    },
    {
      commonError: 'Adding the highlight on surfaces facing away from the light.',
      symptom: 'Bright spots on the dark side.',
      whyItHappened: 'N·H > 0 there.',
      repairStrategy: 'Multiply by (N·L > 0).',
    },
    {
      commonError: 'Tinting the highlight with the base colour on plastic.',
      symptom: 'Highlights look like a lighter patch of paint rather than a reflection.',
      whyItHappened: 'Specular light was multiplied by the base colour.',
      repairStrategy: 'Use the light\'s colour for dielectrics; the base colour only for metals.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Compute R, H and a Blinn–Phong highlight, and choose a shininess for a given width.',
    explainVerbally: 'Explain why highlights move with the eye and how shininess sets their size.',
    detectIncorrectApplication: 'Recognise unnormalised H, dark-side highlights and tinted plastic highlights.',
    transferToUnfamiliar: 'Tune highlights for products, characters and stylised scenes.',
  },
};
