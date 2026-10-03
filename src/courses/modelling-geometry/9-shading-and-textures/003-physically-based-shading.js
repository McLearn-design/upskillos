// Lesson 9.3: physically based shading. A surface is modelled as countless tiny mirrors (microfacets). The highlight
// is D · F · G / (4 (N·L)(N·V)): D how many facets face along H (GGX), F how much each reflects (Fresnel, Schlick), G
// how many are hidden (Smith). Light that is reflected is not diffused, and metals have no diffuse at all: energy is
// conserved, so one model with roughness and metalness covers plastic, paint and metal.

const BASE = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)
const norm = (a) => a.map((x) => x / Math.hypot(...a))
const toSRGB = (c) => (c < 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)
const toLinear = (c) => (c < 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
// GGX microfacet distribution: how many facet normals point along H, for roughness r (α = r²).
const D = (nh, rough) => { const a2 = rough ** 4; return a2 / (Math.PI * ((nh * nh) * (a2 - 1) + 1) ** 2) }
// Schlick's Fresnel: reflectance at angle cos = V·H, from the head-on reflectance F0.
const F = (vh, F0) => F0 + (1 - F0) * Math.pow(1 - vh, 5)
// Smith (height-correlated) visibility: shadowing and masking, with 1/(4 (N·L)(N·V)) folded in.
const Vis = (nl, nv, rough) => { const a2 = rough ** 4, gv = nl * Math.sqrt(nv * nv * (1 - a2) + a2), gl = nv * Math.sqrt(nl * nl * (1 - a2) + a2); return 0.5 / (gv + gl) }
`;

const FACETS = `${BASE}
// D at the centre of the highlight (N·H = 1) and 10° and 30° away, for three roughnesses.
// Predict first: which is tallest at the centre, and which is still bright at 30°?
for (const rough of [0.15, 0.4, 0.8]) {
  const at = (deg) => r(D(Math.cos(deg * Math.PI / 180), rough))
  // The facets' projected area adds up to 1 whatever the roughness: ∫ D (N·H) dω over the hemisphere.
  let total = 0; const n = 2000
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n * Math.PI / 2; total += D(Math.cos(t), rough) * Math.cos(t) * Math.sin(t) * (Math.PI / 2 / n) * 2 * Math.PI }
  console.log('roughness ' + rough + ': D at 0° ' + at(0) + ', at 10° ' + at(10) + ', at 30° ' + at(30) + '; total ' + r(total))
}`;

const FRESNEL = `${BASE}
// Fresnel: how much light a facet reflects, by angle. F0 = 0.04 for plastic, glass, water; 0.95 for silver.
// Predict first: plastic at 80° from head-on.
for (const deg of [0, 30, 60, 80, 89]) {
  const vh = Math.cos(deg * Math.PI / 180)
  console.log(deg + '°: plastic ' + r(F(vh, 0.04)) + ', silver ' + r(F(vh, 0.95)))
}`;

const ENERGY = `${BASE}
// Light straight down onto the surface (L = N). What fraction does the highlight send back out, in all directions,
// if every facet reflected everything (F = 1)? Predict first: smooth against rough.
for (const rough of [0.15, 0.4, 0.8]) {
  let out = 0; const n = 300, m = 300
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const t = (i + 0.5) / n * Math.PI / 2, p = (j + 0.5) / m * 2 * Math.PI, V = [Math.sin(t) * Math.cos(p), Math.cos(t), Math.sin(t) * Math.sin(p)]
    const H = norm([V[0], V[1] + 1, V[2]])
    out += D(H[1], rough) * Vis(1, V[1], rough) * V[1] * Math.sin(t) * (Math.PI / 2 / n) * (2 * Math.PI / m)
  }
  console.log('roughness ' + rough + ': ' + r(out) + ' of the light reflected')
}`;

const PICTURE = `${BASE}
// Six gold-coloured balls: plastic on the bottom row, metal on the top; roughness 0.15, 0.4, 0.8 left to right.
// Each pixel: ambient + (diffuse + D·F·Vis) · π · light · (N·L), the same terms as MeshLab's trace.
const canvas = document.createElement('canvas'), W = 360, H = 240
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'), img = g.createImageData(W * 2, H * 2)
const L = norm([0.6, 0.6, 0.5]), V = [0, 0, 1], Hv = norm(L.map((l, i) => l + V[i])), base = [0.85, 0.64, 0.25].map(toLinear), light = 1
const rough = [0.15, 0.4, 0.8]
for (let py = 0; py < H * 2; py++) for (let px = 0; px < W * 2; px++) {
  const col = Math.floor(px / (W * 2 / 3)), row = py < H ? 0 : 1, metal = row === 0 ? 1 : 0, i = (py * W * 2 + px) * 4
  const cx = (col + 0.5) * W * 2 / 3, cy = (row + 0.5) * H, R = H * 0.42
  const x = (px - cx) / R, y = (cy - py) / R
  if (x * x + y * y > 1) { img.data.set([15, 25, 35, 255], i); continue }
  const N = [x, y, Math.sqrt(1 - x * x - y * y)], nl = Math.max(dot(N, L), 0), nv = Math.max(dot(N, V), 1e-4)
  const c = base.map((b) => {
    const F0 = 0.04 + (b - 0.04) * metal, f = F(Math.max(dot(V, Hv), 0), F0)
    const spec = nl > 0 ? D(Math.max(dot(N, Hv), 0), rough[col]) * f * Vis(Math.max(nl, 1e-4), nv, rough[col]) : 0
    const diffuse = (1 - f) * (1 - metal) * b / Math.PI
    return 0.04 * b + (diffuse + spec) * Math.PI * light * nl
  })
  img.data.set([...c.map((v) => Math.round(255 * Math.min(1, toSRGB(v)))), 255], i)
}
g.putImageData(img, 0, 0)
g.scale(2, 2); g.fillStyle = '#cbd5e1'; g.font = '10px sans-serif'
g.fillText('metal', 4, 12); g.fillText('plastic', 4, H / 2 + 12)
console.log('drawn: 2 rows × 3 roughnesses')`;

const CHALLENGE = `// Plastic (F0 = 0.04) seen at a grazing 75° (V·H = cos 75°). What fraction F does Schlick's formula reflect?
const F75 = 0
console.log(F75)`;

const SOLVED = CHALLENGE.replace('const F75 = 0', 'const F75 = 0.04 + 0.96 * Math.pow(1 - Math.cos(75 * Math.PI / 180), 5)');

/** The challenge's check: (1 − cos 75°)⁵ = 0.2237, so F = 0.04 + 0.96 · 0.2237 = 0.2547. */
export function checkFresnel(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+F75\s*=\s*([^\n]+)/);
  if (!m) return no('Keep the line const F75 = …, with a number or an expression.');
  // Only arithmetic and a few Math functions are evaluated: this runs in the page, not the cell's sandbox.
  const expr = m[1].replace(/\/\/.*$/, '').trim().replace(/;$/, '');
  if (!/^[\d.,\s+\-*/()]*$/.test(expr.replace(/Math\.(cos|pow|PI)|\*\*/g, ''))) return no('Write F as a number, or arithmetic with Math.cos, Math.pow and Math.PI.');
  if (/Math\.cos\(\s*75\s*\)/.test(expr)) return no('Math.cos takes radians: 75° is 75 * Math.PI / 180.');
  let v;
  try { v = Number(new Function('return (' + expr + ')')()); } catch { return no('That expression did not run.'); }
  if (!Number.isFinite(v)) return no('F must be a number.');
  const c = Math.cos(75 * Math.PI / 180), near = (x) => Math.abs(v - x) < 1e-3;
  if (near(0.04 + 0.96 * Math.pow(1 - c, 5))) return { pass: true, message: `${+v.toFixed(4)}: 1 − cos 75° = 0.741, and 0.741⁵ = 0.224; F = 0.04 + 0.96 × 0.224 = 0.255. Plastic that reflects 4% head-on reflects about a quarter of the light at 75°: why table tops and roads shine at a low angle.` };
  if (v === 0) return no('F = F₀ + (1 − F₀)(1 − V·H)⁵ with F₀ = 0.04 and V·H = cos 75°.');
  if (near(0.04)) return no('0.04 is F₀, the reflectance head-on. At 75° Schlick\'s term (1 − cos 75°)⁵ adds a lot more.');
  if (near(0.04 + 0.96 * Math.pow(c, 5))) return no('The power is of (1 − V·H), not of V·H: grazing angles (V·H small) reflect most.');
  if (near(0.04 + Math.pow(1 - c, 5))) return no('Close: the grazing term is weighted by (1 − F₀) = 0.96, so F never exceeds 1.');
  return no(`${+v.toFixed(4)} is not Schlick\'s F at 75°.`);
}

export default {
  id: 'modelling-geometry-9-003',
  slug: 'physically-based-shading',
  chapter: 'modelling-geometry',
  order: 3,
  title: 'Physically based shading',
  subtitle: 'Surfaces as fields of tiny mirrors: microfacets, Fresnel and shadowing, and why one model with roughness and metalness covers everything.',
  tags: ['shading', 'pbr', 'microfacets', 'ggx', 'fresnel', 'schlick', 'smith', 'cook-torrance', 'roughness', 'metalness'],
  coreConcept: 'Physically based shading models a surface as countless microscopic mirrors (microfacets). The highlight is the Cook–Torrance term D·F·G / (4 (N·L)(N·V)): D, the GGX distribution, is how many facets face along the half vector H (tall and narrow when smooth, wide when rough, always adding up to the same area); F, Fresnel (Schlick: F₀ + (1 − F₀)(1 − V·H)⁵), is how much each reflects, about 4% head-on for non-metals, rising towards 100% at grazing angles, and the metal\'s own colour for metals; G (Smith) removes facets hidden by their neighbours. Light reflected by the facets is not available to the diffuse part, and metals have none: energy is conserved, so roughness and metalness alone describe plastic, paint, rubber and metal.',
  prerequisites: ['modelling-geometry-9-002'],
  timeToComplete: 45,
  nextLesson: 'modelling-geometry-9-004',

  hook: {
    question: 'Blinn–Phong needs an artist to tune shininess and specular strength until things look right, and the same numbers look wrong under different light. Modern engines use two sliders, roughness and metalness, and the material looks right everywhere. What physics makes that possible?',
    realWorldContext: 'Physically based rendering is the standard in Unreal, Unity, Blender (Principled BSDF), glTF and film renderers; material libraries and scanned materials are authored as base colour, roughness and metalness maps because those numbers mean the same thing in every engine.',
  },

  intuition: {
    prose: [
      'Look at a surface under a microscope and it is a landscape of tiny flat facets, each a perfect mirror tilted a little differently. Light from $L$ reaches the eye at $V$ only off facets whose normal is exactly the half vector $H$ (lesson 9.2). **D**, the microfacet distribution, says how many facets point that way. On a smooth surface they all point near $N$: a tall narrow peak, a small bright highlight. On a rough one they spread out: a low wide hump. The total stays the same, because the facets always cover the same surface. Before running cell 1, predict which roughness is tallest at the centre, and which is still bright $30°$ away.',
      '**F**, Fresnel, is how much a facet reflects, and it depends on the angle. Head-on, plastic, glass and water reflect about 4% ($F_0 = 0.04$); at grazing angles nearly everything (look along a table top or a lake). Metals reflect a lot at every angle, and in their own colour: gold reflects more red than blue, which is why its highlight is gold. Schlick\'s formula $F = F_0 + (1 - F_0)(1 - V\\cdot H)^5$ captures both. Before running cell 2, predict plastic at $80°$: about 0.41.',
      '**G**, geometry, accounts for facets hidden by their neighbours, from the light (shadowing) or from the eye (masking), more so at grazing angles and on rough surfaces. Together, $D\\,F\\,G / (4 (N\\cdot L)(N\\cdot V))$ is the Cook–Torrance highlight. Before running cell 3, predict how much light a perfect reflector sends back: all of it when smooth, noticeably less when very rough, because light that would bounce twice between facets is not counted.',
      '**Energy conservation** ties it together: light reflected at the surface (F) is not available to enter and scatter as diffuse colour, so the diffuse part is scaled by $1 - F$; metals absorb what they do not reflect, so they have no diffuse at all. That is why two numbers suffice: **roughness** sets D and G, **metalness** chooses between a dielectric ($F_0 = 0.04$, coloured diffuse, white highlight) and a metal ($F_0$ = the base colour, no diffuse, coloured highlight).',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Cook–Torrance at one pixel',
        body: 'Step 1. N, L, V, H = normalize(L + V); α = roughness².\nStep 2. D = α² / (π ((N·H)²(α² − 1) + 1)²).\nStep 3. F₀ = mix(0.04, base, metalness); F = F₀ + (1 − F₀)(1 − V·H)⁵.\nStep 4. Visibility V = 0.5 / (N·L √((N·V)²(1 − α²) + α²) + N·V √((N·L)²(1 − α²) + α²)) (Smith with the 1/(4 N·L N·V) folded in).\nStep 5. Specular = D·F·V; diffuse = (1 − F)(1 − metalness) · base / π.\nStep 6. Colour = ambient·base + (diffuse + specular) · π · light · max(N·L, 0); encode.',
      },
      {
        type: 'warning',
        title: 'Roughness is squared',
        body: 'GGX uses α = roughness², so the slider feels even: roughness 0.5 is half-way in appearance. Passing roughness straight in as α makes everything look too smooth.',
      },
      {
        type: 'warning',
        title: 'Metalness is (almost) 0 or 1',
        body: 'Real materials are metals or not. Values between are for blends (dust on metal, painted edges worn through). A grey metalness of 0.5 on a whole object looks like neither.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: roughness and metalness',
        body: 'Material maps store base colour, roughness and metalness per texel, so one mesh can be rusty metal in one place and painted in another. glTF, Unreal, Unity and Blender all read the same three maps.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "metal is just a shinier plastic". The bottom row keeps its gold colour in the diffuse with a white highlight; the top row has no diffuse colour at all, and its highlight is gold. Roughness spreads both highlights the same way. The metals look dark because there is nothing around them to reflect but the one light; real scenes surround metals with sky (an environment map).',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'D(), F() and Vis() in the first lines are Steps 2–4; the picture loop is Steps 5–6.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'three.js\'s MeshStandardMaterial runs these terms (BRDF_GGX: D_GGX, F_Schlick, V_GGX_SmithCorrelated) in its fragment shader, adds light from an environment map, and its light units differ, so its pixels are not exactly cell 4\'s.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Inspector › Shader: PBR, with Roughness and Metalness. Mesh › Trace the shading on a PBR object traces the microfacets D, Fresnel F (predict it), shadowing, and the energy split, in the textbook form above. In a script: obj.traceShading(v, { eye }).' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: physically based shading',
        caption: 'The GGX distribution, Fresnel by angle, energy, and six materials from two numbers.',
        props: {
          lesson: {
            title: 'Physically based shading',
            subtitle: 'Microfacets, Fresnel, shadowing.',
            cells: [
              { type: 'js', instruction: '### 1. Microfacets\nPredict first: tallest at the centre, brightest at 30°.', startCode: FACETS },
              { type: 'js', instruction: '### 2. Fresnel\nPredict first: plastic at 80°.', startCode: FRESNEL },
              { type: 'js', instruction: '### 3. Energy\nPredict first: smooth against rough.', startCode: ENERGY },
              { type: 'js', instruction: '### 4. See it\nPlastic and metal, three roughnesses.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 290 },
              { type: 'challenge', instruction: '### 5. Challenge: a grazing angle\nThe check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkFresnel },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Physically based shading" in MeshLab](#/lab/mesh-lab?project=pbr-materials). Six balls; the brightest vertex of the middle plastic one is traced: press Play, and predict F.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Inspector › Shader: PBR**; Roughness and Metalness.\n- **Mesh › Trace the shading** on a PBR object.\n- In a script: `obj.material.roughness = 0.3`, `obj.material.metalness = 1`.\n- **Elsewhere:** Blender\'s Principled BSDF, glTF\'s metallicRoughness material, the Disney BRDF paper (Burley, 2012).' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Cook–Torrance.** $f_r = \\dfrac{D(H)\\,F(V\\cdot H)\\,G(L, V)}{4\\,(N\\cdot L)(N\\cdot V)}$, and the reflected radiance is $L_o = \\int f_r\\,L_i\\,(N\\cdot L)\\,d\\omega$; for one light, $f_r \\cdot \\text{light} \\cdot (N\\cdot L)$.',
      '**GGX.** $D(H) = \\dfrac{\\alpha^2}{\\pi\\,((N\\cdot H)^2(\\alpha^2 - 1) + 1)^2}$, normalised so $\\int D(H)\\,(N\\cdot H)\\,d\\omega_H = 1$: the microfacets\' projected area equals the surface\'s.',
      '**Schlick.** $F \\approx F_0 + (1 - F_0)(1 - V\\cdot H)^5$, a fit to the exact Fresnel equations. For a dielectric of refractive index $n$, $F_0 = ((n - 1)/(n + 1))^2$: 0.04 for $n = 1.5$.',
      '**Smith.** $G = G_1(L)\\,G_1(V)$ (or the height-correlated form), with $G_1$ the fraction of facets visible from one direction. Single scattering loses energy on rough surfaces (cell 3); production renderers add a multiple-scattering correction.',
    ],
    equations: [
      { label: 'Cook–Torrance', latex: 'f_r = \\frac{D\\,F\\,G}{4\\,(N\\cdot L)(N\\cdot V)}' },
      { label: 'GGX', latex: 'D = \\frac{\\alpha^2}{\\pi\\big((N\\cdot H)^2(\\alpha^2 - 1) + 1\\big)^2}, \\quad \\alpha = \\text{roughness}^2' },
      { label: 'Schlick', latex: 'F = F_0 + (1 - F_0)(1 - V\\cdot H)^5' },
      { label: 'Dielectric F₀', latex: 'F_0 = \\Big(\\frac{n - 1}{n + 1}\\Big)^2' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** A BRDF is physically plausible if it is non-negative, reciprocal (f_r(L, V) = f_r(V, L)) and energy-conserving (∫ f_r (N·L) dω ≤ 1 for every V). Cook–Torrance with a normalised D, Schlick F and Smith G satisfies all three for single scattering; the diffuse term scaled by (1 − F)(1 − metalness) keeps the sum within bounds.',
      '**Invariant viewpoint.** D, F and G depend only on angles between N, L, V and H, so the material looks the same under any rotation of the scene, and its parameters do not need re-tuning when the lighting changes: the point of "physically based".',
      '**Geometric picture.** A smooth sea reflects the sun as one sharp spot; a choppy sea breaks it into a broad glitter path: the same water, more varied facet normals.',
      '**Where this goes.** Lesson 9.4 throws physics away on purpose for cartoon looks; 9.6 makes roughness and colour vary across a surface with textures.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-9-003-ex1',
      title: 'F₀ of glass',
      problem: 'Glass has refractive index 1.5. What is F₀?',
      steps: [{ expression: '((1.5 - 1)/(1.5 + 1))^2 = 0.2^2 = 0.04', annotation: 'Head-on reflectance.' }],
      conclusion: '0.04: 4% reflected head-on.',
    },
    {
      id: 'modelling-geometry-9-003-ex2',
      title: 'The peak of D',
      problem: 'At N·H = 1, what is D for roughness 0.4?',
      steps: [{ expression: 'D = \\alpha^2 / (\\pi\\alpha^4) = 1/(\\pi\\alpha^2), \\; \\alpha = 0.16', annotation: '(N·H)²(α² − 1) + 1 = α².' }],
      conclusion: '1/(π · 0.0256) = 12.43.',
    },
    {
      id: 'modelling-geometry-9-003-ex3',
      title: 'Gold\'s highlight',
      problem: 'Gold\'s base colour is (1.0, 0.77, 0.34) in linear units, metalness 1. What is F₀?',
      steps: [{ expression: 'F_0 = \\text{mix}(0.04, \\text{base}, 1) = \\text{base}', annotation: 'A metal reflects in its own colour.' }],
      conclusion: 'F₀ = (1.0, 0.77, 0.34): a gold-coloured highlight.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-9-003-ch1',
      difficulty: 'easy',
      problem: 'Why does a rough surface have a dimmer but wider highlight than a smooth one?',
      walkthrough: [{ expression: '\\int D\\,(N\\cdot H)\\,d\\omega = 1', annotation: 'The facets always add up to the same area.' }],
      answer: 'D is normalised: the same total of facets spread over more directions. A rough surface has fewer facets pointing exactly along H (dimmer peak) but more pointing nearly along it (wider).',
    },
    {
      id: 'modelling-geometry-9-003-ch2',
      difficulty: 'medium',
      problem: 'Why do metals have no diffuse colour in this model?',
      walkthrough: [{ expression: 'k_d = (1 - F)(1 - \\text{metalness})', annotation: '0 for metals.' }],
      answer: 'Diffuse colour comes from light that enters a material, scatters inside and comes back out. In a metal, free electrons absorb light that is not reflected at the surface almost immediately, so nothing scatters back out: all its colour is in the reflection (F₀ = base colour).',
    },
    {
      id: 'modelling-geometry-9-003-ch3',
      difficulty: 'hard',
      problem: 'Show that D_GGX at N·H = 1 equals 1/(πα²), and explain why it grows without limit as roughness → 0.',
      walkthrough: [
        { expression: '(N\\cdot H)^2(\\alpha^2 - 1) + 1 = \\alpha^2', annotation: 'At N·H = 1.' },
        { expression: 'D = \\alpha^2/(\\pi\\alpha^4) = 1/(\\pi\\alpha^2)', annotation: 'Simplify.' },
      ],
      answer: 'At N·H = 1 the bracket is α², so D = 1/(πα²). As α → 0 all the facets point along N; D becomes a spike of unbounded height and vanishing width whose integral stays 1: a perfect mirror, which reflects the light only in exactly the mirror direction.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'D', meaning: 'GGX: the share of microfacets facing along H.' },
      { symbol: 'F', meaning: 'Fresnel: how much a facet reflects at that angle.' },
      { symbol: 'G', meaning: 'Smith: the facets not hidden from the light or the eye.' },
      { symbol: 'F_0', meaning: 'Reflectance head-on: 0.04 for dielectrics, the base colour for metals.' },
      { symbol: '\\alpha = \\text{roughness}^2', meaning: 'GGX\'s width parameter.' },
      { symbol: '(1 - F)(1 - \\text{metalness})', meaning: 'What is left for the diffuse part.' },
    ],
    rulesOfThumb: [
      'Roughness spreads, metalness tints.',
      'Everything reflects more at grazing angles.',
      'Dielectrics: F₀ ≈ 0.04, white highlight.',
      'Metals: no diffuse, coloured highlight.',
      'Same numbers, any lighting.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-9-002', label: 'Highlights', note: 'The half vector, now the microfacet normal.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-9-004', label: 'Stylised shading', note: 'Breaking the physics on purpose.' },
      { lessonId: 'modelling-geometry-9-006', label: 'Procedural textures', note: 'Varying colour and roughness across a surface.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-9-003-1', label: 'Read microfacets and the GGX distribution', type: 'read' },
    { id: 'cp-modelling-geometry-9-003-2', label: 'Read Fresnel and Schlick\'s formula', type: 'read' },
    { id: 'cp-modelling-geometry-9-003-3', label: 'Read energy conservation and metalness', type: 'read' },
    { id: 'cp-modelling-geometry-9-003-4', label: 'Run cells 1 to 3: D, F, energy', type: 'lab' },
    { id: 'cp-modelling-geometry-9-003-5', label: 'Trace PBR shading in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-9-003-6', label: 'Work through example 1, F₀ of glass', type: 'example' },
    { id: 'cp-modelling-geometry-9-003-7', label: 'Work through example 2, the peak of D', type: 'example' },
    { id: 'cp-modelling-geometry-9-003-8', label: 'Complete the challenge: a grazing angle', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-9-003-assess-1',
        type: 'choice',
        text: 'A copper ball with metalness 1 has a highlight that is:',
        options: ['Copper-coloured', 'White', 'Black', 'The light\'s colour only'],
        answer: 'Copper-coloured',
        hint: 'F₀ = base colour for metals.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-9-003-quiz-1',
      type: 'choice',
      text: 'D, the microfacet distribution, measures:',
      options: ['How many facets face along H', 'How much each facet reflects', 'How many are hidden', 'The base colour'],
      answer: 'How many facets face along H',
      hints: ['Cell 1.', 'GGX.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-9-003-quiz-2',
      type: 'choice',
      text: 'Plastic reflects about how much light head-on?',
      options: ['4%', '50%', '0%', '100%'],
      answer: '4%',
      hints: ['Cell 2.', 'F₀ = 0.04.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-9-003-quiz-3',
      type: 'choice',
      text: 'At grazing angles, every surface:',
      options: ['Reflects much more', 'Reflects less', 'Reflects the same', 'Becomes diffuse'],
      answer: 'Reflects much more',
      hints: ['Cell 2.', 'Schlick.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-9-003-quiz-4',
      type: 'choice',
      text: 'Single-scattering GGX loses energy on rough surfaces because:',
      options: ['Light bouncing between facets is not counted', 'D is not normalised', 'Fresnel is wrong', 'It does not'],
      answer: 'Light bouncing between facets is not counted',
      hints: ['Cell 3.', 'Math, Smith.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-9-003-quiz-5',
      type: 'choice',
      text: 'GGX\'s α is:',
      options: ['roughness²', 'roughness', '1 − roughness', 'shininess'],
      answer: 'roughness²',
      hints: ['Warning "Roughness is squared".', 'Procedure, Step 1.'],
      reviewSection: 'Warning "Roughness is squared"',
    },
    {
      id: 'modelling-geometry-9-003-quiz-6',
      type: 'choice',
      text: 'The diffuse part is scaled by (1 − F)(1 − metalness) because:',
      options: ['Reflected light cannot also be diffused, and metals do not diffuse', 'It looks better', 'GPUs need it', 'D requires it'],
      answer: 'Reflected light cannot also be diffused, and metals do not diffuse',
      hints: ['Energy conservation.', 'Challenge 2.'],
      reviewSection: 'Intuition',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'Metal is just a shinier plastic.',
      whyStudentsThinkIt: 'Both have highlights.',
      correctionExample: 'The picture: metal has no diffuse colour and a coloured highlight; plastic has a coloured diffuse and a white highlight.',
      contrastCase: 'At high roughness both look matte, but their colours still sit in different terms.',
    },
    {
      falseBelief: 'Non-metals barely reflect.',
      whyStudentsThinkIt: '4% head-on is small.',
      correctionExample: 'Cell 2: at 80° plastic reflects 41%, at 89° nearly all of it.',
      contrastCase: 'Head-on, 4% is indeed small.',
    },
    {
      falseBelief: 'A rough surface reflects less light in total.',
      whyStudentsThinkIt: 'Its highlight is dimmer.',
      correctionExample: 'Cell 1: D always adds up to 1; the light is spread wider, not lost (apart from the multiple bounces cell 3 shows).',
      contrastCase: 'Absorption, set by the base colour, does reduce the total.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A material must look right both in a sunny outdoor scene and a dim interior.',
      competingTechniques: ['Blinn–Phong tuned for each scene', 'PBR with measured roughness and metalness'],
      whyThisTechniqueWins: 'PBR parameters describe the surface, not the lighting, so the same values work under any light.',
    },
    {
      situation: 'A painted metal railing with chipped paint.',
      competingTechniques: ['One metalness for the whole railing', 'A metalness map: 0 where painted, 1 where chipped'],
      whyThisTechniqueWins: 'Paint is a dielectric and bare steel a metal: they differ in which term holds the colour, which only a per-texel metalness can express.',
    },
  ],

  debugging: [
    {
      commonError: 'Using roughness directly as α.',
      symptom: 'Everything looks too glossy; roughness 0.5 is nearly mirror-like.',
      whyItHappened: 'GGX\'s α is roughness².',
      repairStrategy: 'α = roughness * roughness.',
    },
    {
      commonError: 'Adding a full diffuse term to metals.',
      symptom: 'Metals look like coloured plastic.',
      whyItHappened: 'Metals have no diffuse.',
      repairStrategy: 'Scale diffuse by (1 − metalness).',
    },
    {
      commonError: 'Dividing by 4 (N·L)(N·V) without guarding against zero.',
      symptom: 'Bright fireflies and NaN pixels at silhouettes.',
      whyItHappened: 'N·V → 0 at the edge of an object.',
      repairStrategy: 'Clamp N·L and N·V to a small minimum, or use the folded visibility form.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Compute D, F and the Smith visibility for given vectors and material.',
    explainVerbally: 'Explain microfacets, Fresnel, shadowing and energy conservation.',
    detectIncorrectApplication: 'Recognise unsquared roughness, diffuse metals and unguarded divisions.',
    transferToUnfamiliar: 'Author materials with roughness and metalness for any engine.',
  },
};
