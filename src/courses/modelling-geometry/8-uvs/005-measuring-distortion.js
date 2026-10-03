// Lesson 8.5: measuring distortion. Each triangle's UV map is linear: in the triangle's own flat frame it is a 2 × 2
// Jacobian J. A tiny circle goes to an ellipse with radii σ₁ ≥ σ₂, the singular values of J (square roots of the
// eigenvalues of JᵀJ). σ₁/σ₂ is the angle distortion, σ₁σ₂ = |det J| the area scale, det J < 0 a flip. Drawing those
// ellipses across a map is Tissot's indicatrix.

const BASE = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const sub = (a, b) => a.map((x, i) => x - b[i]), dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a) => Math.hypot(...a)
// The Jacobian of a triangle's UV map, in the triangle's own frame: corner 0 at the origin, edge 0→1 along x.
function jacobian(P, T) {
  const e1 = sub(P[1], P[0]), e2 = sub(P[2], P[0]), l1 = len(e1), x = e1.map((v) => v / l1)
  const d = dot(e2, x), y = sub(e2, x.map((v) => v * d)), h = len(y)
  const du1 = T[1][0] - T[0][0], dv1 = T[1][1] - T[0][1], du2 = T[2][0] - T[0][0], dv2 = T[2][1] - T[0][1]
  const a = du1 / l1, c = dv1 / l1, b = (du2 - a * d) / h, dd = (dv2 - c * d) / h
  return [[a, b], [c, dd]]
}
// Singular values: the square roots of the eigenvalues of JᵀJ.
function sigmas([[a, b], [c, d]]) {
  const s = a * a + b * b + c * c + d * d, t = Math.sqrt((a * a + b * b - c * c - d * d) ** 2 + 4 * (a * c + b * d) ** 2)
  return [Math.sqrt((s + t) / 2), Math.sqrt(Math.max(0, (s - t) / 2))]
}
`;

const JAC = `${BASE}
// A triangle on the surface and its corners' UVs. Predict first: J's top-left entry a (how fast u changes along edge 0→1).
const P = [[0, 0, 0], [2, 0, 0], [0.5, 0, 1]], T = [[0.1, 0.1], [0.5, 0.1], [0.2, 0.4]]
const J = jacobian(P, T)
console.log('J = [[' + J[0].map(r).join(', ') + '], [' + J[1].map(r).join(', ') + ']]')
// Check: J takes each edge, written in the frame, to the same edge in UV.
const frame = [[2, 0], [0.5, 1]]                     // the edges 0→1 and 0→2 in the triangle's own frame (here the x–z plane)
frame.forEach((q, k) => console.log('edge 0→' + (k + 1) + ': J·q = (' + [0, 1].map((i) => r(J[i][0] * q[0] + J[i][1] * q[1])).join(', ') + '), UV difference (' + [0, 1].map((i) => r(T[k + 1][i] - T[0][i])).join(', ') + ')'))`;

const SVD = `${BASE}
// J takes a circle of radius 1 to an ellipse. Its longest and shortest radii are σ₁ and σ₂.
// Predict first: σ₁ and σ₂ for the shear [[1, 0.5], [0, 1]].
const J = [[1, 0.5], [0, 1]]
let lo = Infinity, hi = 0
for (let k = 0; k < 3600; k++) { const t = 2 * Math.PI * k / 3600, x = J[0][0] * Math.cos(t) + J[0][1] * Math.sin(t), y = J[1][0] * Math.cos(t) + J[1][1] * Math.sin(t); lo = Math.min(lo, Math.hypot(x, y)); hi = Math.max(hi, Math.hypot(x, y)) }
const [s1, s2] = sigmas(J)
console.log('measured on the ellipse: longest ' + r(hi) + ', shortest ' + r(lo))
console.log('from JᵀJ: σ₁ ' + r(s1) + ', σ₂ ' + r(s2) + '; σ₁σ₂ = ' + r(s1 * s2) + ' = det J = ' + r(J[0][0] * J[1][1] - J[0][1] * J[1][0]))`;

const MEASURES = `${BASE}
// Four numbers from J: angle distortion σ₁/σ₂, area scale σ₁σ₂, flipped (det J < 0), and stretch max(σ₁, 1/σ₂),
// how far any length is from being kept. Predict first: which of these maps keeps angles, which keeps areas?
const maps = {
  'turn and double': [[0, -2], [2, 0]],
  'squash and stretch': [[2, 0], [0, 0.5]],
  'turn only': [[0.6, -0.8], [0.8, 0.6]],
  'mirror': [[-1, 0], [0, 1]],
}
for (const [name, J] of Object.entries(maps)) {
  const [s1, s2] = sigmas(J), det = J[0][0] * J[1][1] - J[0][1] * J[1][0]
  console.log(name + ': σ₁/σ₂ ' + r(s1 / s2) + ', area ' + r(s1 * s2) + ', ' + (det < 0 ? 'flipped' : 'not flipped') + ', stretch ' + r(Math.max(s1, 1 / s2)))
}`;

const DOME = `${BASE}
// A dome (the top half of a unit sphere) projected from above, u = x, v = z. A point at angle φ from the pole sits on a
// slope tilted φ, so lesson 8.3 predicts σ₁/σ₂ = 1/cos φ. Predict first: the ratio on the ring at φ = 60°.
const S = 24, R = 8, V = [[0, 1, 0]], T = []
for (let i = 1; i <= R; i++) for (let j = 0; j < S; j++) { const a = (Math.PI / 2) * i / R, b = 2 * Math.PI * j / S; V.push([Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)]) }
const at = (i, j) => 1 + (i - 1) * S + (j % S)
for (const i of [2, 4, 5, 7]) {
  // The band between rings i and i + 1: average σ₁/σ₂ of its triangles, against 1/cos φ at the band's middle.
  const ratios = []
  for (let j = 0; j < S; j++) for (const t of [[at(i, j), at(i, j + 1), at(i + 1, j + 1)], [at(i, j), at(i + 1, j + 1), at(i + 1, j)]]) {
    const [s1, s2] = sigmas(jacobian(t.map((k) => V[k]), t.map((k) => [V[k][0], V[k][2]]))); ratios.push(s1 / s2)
  }
  const phi = (Math.PI / 2) * (i + 0.5) / R
  console.log('φ ≈ ' + r(phi * 180 / Math.PI) + '°: mean σ₁/σ₂ ' + r(ratios.reduce((a, b) => a + b) / ratios.length) + ', 1/cos φ = ' + r(1 / Math.cos(phi)))
}`;

const PICTURE = `${BASE}
// Tissot's indicatrix: little circles on the dome, drawn where each UV map sends them. Left: projected from above.
// Right: stereographic, u = x/(1 + y), v = z/(1 + y), a conformal map. Same circles; one map turns them into ellipses.
const maps = [(p) => [p[0], p[2]], (p) => [p[0] / (1 + p[1]), p[2] / (1 + p[1])]]
const canvas = document.createElement('canvas'), W = 380, H = 210
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'); g.scale(2, 2); g.fillStyle = '#0f1923'; g.fillRect(0, 0, W, H)
const point = (phi, th) => [Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)]
const ratios = [[], []]
maps.forEach((f, k) => {
  const ox = (k + 0.5) * W / 2, oy = H / 2 - 8, s = 80
  g.strokeStyle = '#334155'; g.beginPath(); g.arc(ox, oy, s * Math.max(...[0, 1].map((i) => Math.abs(f(point(Math.PI / 2, 0))[i]))), 0, 2 * Math.PI); g.stroke()
  for (const phi of [0.2, 0.55, 0.9, 1.25, 1.5]) for (let j = 0; j < 8; j++) {
    const th = 2 * Math.PI * j / 8 + phi, p = point(phi, th), e = 1e-4, rad = 0.09
    // Two unit directions on the surface at p (down the slope, round the ring) and how the map moves along each.
    const dPhi = sub(point(phi + e, th), point(phi - e, th)).map((x) => x / (2 * e)), dTh = sub(point(phi, th + e), point(phi, th - e)).map((x) => x / (2 * e))
    const u1 = dPhi.map((x) => x / len(dPhi)), u2 = dTh.map((x) => x / len(dTh))
    const col = (u) => { const a = f(p.map((x, i) => x + e * u[i])), b = f(p.map((x, i) => x - e * u[i])); return [0, 1].map((i) => (a[i] - b[i]) / (2 * e)) }
    const c1 = col(u1), c2 = col(u2), [s1, s2] = sigmas([[c1[0], c2[0]], [c1[1], c2[1]]]); ratios[k].push(s1 / s2)
    const q = f(p)
    g.fillStyle = k ? 'rgba(96, 165, 250, 0.55)' : 'rgba(245, 158, 11, 0.55)'; g.beginPath()
    for (let m = 0; m <= 36; m++) { const t = 2 * Math.PI * m / 36, x = q[0] + rad * (c1[0] * Math.cos(t) + c2[0] * Math.sin(t)), y = q[1] + rad * (c1[1] * Math.cos(t) + c2[1] * Math.sin(t)); (m ? g.lineTo : g.moveTo).call(g, ox + s * x, oy - s * y) }
    g.fill()
  }
  g.fillStyle = '#cbd5e1'; g.font = '11px sans-serif'; g.textAlign = 'center'; g.fillText(k ? 'stereographic (conformal)' : 'from above', ox, H - 6)
})
console.log('worst σ₁/σ₂: from above ' + r(Math.max(...ratios[0])) + ', stereographic ' + r(Math.max(...ratios[1])))`;

const CHALLENGE = `// A triangle's UV map has Jacobian J = [[0, -2], [0.5, 0]]. What are its angle distortion σ₁/σ₂ and its area scale σ₁σ₂?
const answer = { angle: 0, area: 0 }
console.log(answer)`;

const SOLVED = CHALLENGE.replace('const answer = { angle: 0, area: 0 }', 'const answer = { angle: 4, area: 1 }');

/** The challenge's check: J's columns (0, 0.5) and (−2, 0) are orthogonal, so σ = 2 and 0.5: ratio 4, area 1. */
export function checkSigmas(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/angle\s*:\s*([^,}]+),\s*area\s*:\s*([^,}\n]+)/);
  if (!m) return no('Keep the line const answer = { angle: …, area: … }.');
  const num = (s) => { const e = s.trim(); if (!/^[\d.\s+\-*/()]+$/.test(e)) return NaN; try { return Number(new Function('return (' + e + ')')()); } catch { return NaN; } };
  const angle = num(m[1]), area = num(m[2]);
  if (!Number.isFinite(angle) || !Number.isFinite(area)) return no('Both answers must be numbers.');
  const near = (x, y) => Math.abs(x - y) < 1e-3;
  if (near(angle, 4) && near(area, 1)) return { pass: true, message: 'Right: J\'s columns, (0, 0.5) and (−2, 0), are at right angles with lengths 0.5 and 2, so J is a turn after stretching one direction by 2 and the other by 0.5: σ₁ = 2, σ₂ = 0.5. Angles are distorted 4 : 1, yet area is kept exactly (σ₁σ₂ = det J = 1).' };
  if (angle === 0 && area === 0) return no('Look at J\'s columns: how long is each, and at what angle are they to each other?');
  if (near(angle, 1) || near(angle, 0)) return no('The diagonal is zero, but that does not make J small or conformal: J is a turn of [[2, 0], [0, 0.5]] (or its transpose).');
  if (near(angle, 2) || near(angle, 0.5)) return no('σ₁ = 2 and σ₂ = 0.5 are the singular values; the angle distortion is their ratio.');
  if (near(area, -1)) return no('det J = 0·0 − (−2)(0.5) = +1: not flipped. The area scale is |det J| = 1.');
  if (near(angle, 4) && near(area, 2.5)) return no('σ₁ + σ₂ is not the area scale; the product σ₁σ₂ is.');
  if (near(angle, 4)) return no('The angle distortion is right. Area scale is σ₁σ₂ = |det J|.');
  if (near(area, 1)) return no('The area is right. Angle distortion is σ₁/σ₂, the ratio of the ellipse\'s radii.');
  return no('Find σ₁ and σ₂: the lengths of J\'s columns, since the columns are at right angles.');
}

export default {
  id: 'modelling-geometry-8-005',
  slug: 'measuring-distortion',
  chapter: 'modelling-geometry',
  order: 5,
  title: 'Measuring distortion',
  subtitle: 'How much a UV map stretches each triangle: the 2 × 2 Jacobian, its singular values, and the circles that become ellipses.',
  tags: ['uv', 'distortion', 'jacobian', 'singular values', 'svd', 'tissot indicatrix', 'heat map'],
  coreConcept: 'Laid flat in its own plane, each triangle\'s UV map is linear: a 2 × 2 Jacobian J, found from two edges. J sends a tiny circle to an ellipse whose radii σ₁ ≥ σ₂ are J\'s singular values, the square roots of the eigenvalues of JᵀJ. σ₁/σ₂ is the angle distortion (1 = conformal), σ₁σ₂ = |det J| the area scale (1 = area kept), det J < 0 a flipped triangle, and max(σ₁, 1/σ₂) how far any length is from being kept. A distortion heat map colours each vertex by the average over its triangles; drawing the ellipses is Tissot\'s indicatrix.',
  prerequisites: ['modelling-geometry-8-004', 'modelling-geometry-2-004'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-8-006',

  hook: {
    question: 'A checker texture on an unwrapped model shows squares in some places, rectangles in others, and big and small squares elsewhere. Cartographers drew little circles on the globe and watched them turn into ellipses on a flat map. How do you turn "it looks stretched" into a number for every triangle?',
    realWorldContext: 'Every unwrapping tool reports distortion (Blender\'s stretch display, the area and angle overlays of UV editors), unwrapping algorithms minimise it, texture artists check it before painting, and map projections are chosen by it: Mercator keeps angles, equal-area maps keep areas.',
  },

  intuition: {
    prose: [
      'Zoom in on one triangle. Its UV map is linear, so lay the triangle flat in its own plane (corner 0 at the origin, edge 0→1 along x) and the map is a $2 \\times 2$ matrix $J$, the **Jacobian**: it takes each edge, written in that frame, to the same edge in UV. Its first column is how UV changes per unit length along edge 0→1. Before running cell 1, predict $J$\'s top-left entry for an edge 2 long whose $u$ changes by $0.4$: $0.2$.',
      'Any $J$ sends a circle to an **ellipse**. Its longest and shortest radii, $\\sigma_1 \\ge \\sigma_2$, are $J$\'s **singular values**: the square roots of the eigenvalues of $J^{\\mathrm{T}}J$. Before running cell 2, predict them for a shear $\\begin{bmatrix} 1 & 0.5 \\\\ 0 & 1 \\end{bmatrix}$: not 1 and 1, though the shear keeps area. They come out $1.28$ and $0.78$, whose product is $\\det J = 1$.',
      'From $\\sigma_1$ and $\\sigma_2$ come all the measures. **Angle distortion** $\\sigma_1/\\sigma_2$: 1 when circles stay circles (conformal, lesson 8.4). **Area scale** $\\sigma_1\\sigma_2 = |\\det J|$: 1 when area is kept. **Flipped**: $\\det J < 0$, the texture mirrored. **Stretch** $\\max(\\sigma_1, 1/\\sigma_2)$: 1 only when every length is kept. Before running cell 3, predict which of four maps keeps angles and which keeps area: no map can keep both on a curved surface.',
      'Applied to every triangle these give a heat map. Cell 4 checks the numbers against lesson 8.3: a dome projected from above has $\\sigma_1/\\sigma_2 = 1/\\cos\\varphi$ at angle $\\varphi$ from the pole. Before running it, predict the ratio near $60°$: about 2.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Distortion of one triangle',
        body: 'Step 1. Frame: x along edge 0→1 (length l₁), y at right angles in the plane; corner 2 is (d, h).\nStep 2. J\'s first column: (Δu₁, Δv₁) / l₁. Second column: ((Δu₂, Δv₂) − d · first column) / h.\nStep 3. σ₁, σ₂ = √eigenvalues of JᵀJ: with s = a² + b² + c² + d² and t = √((a² + b² − c² − d²)² + 4(ac + bd)²), σ = √((s ± t)/2).\nStep 4. Report σ₁/σ₂ (angles), σ₁σ₂ (area, relative to the map\'s average), the sign of det J (flips).',
      },
      {
        type: 'warning',
        title: 'Area scale is relative',
        body: 'A whole UV layout is scaled to fit the square, so σ₁σ₂ alone means nothing. Compare each triangle\'s σ₁σ₂ with the map\'s total UV area over total surface area: 1 means its fair share of texels.',
      },
      {
        type: 'warning',
        title: 'Average carefully',
        body: 'A per-vertex heat map averages the triangles around each vertex, which hides a single very bad triangle. Look at the worst value too, and at flipped triangles, which averaging can hide completely.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: distortion heat maps',
        body: 'UV editors colour each face by its angle or area distortion, blue for none and red for a lot. The same per-triangle numbers drive texture-space effects: a texel-density check, mip-level choice, and where to add seams.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "a conformal map keeps everything". On the stereographic map (right) every circle is still a circle, but they grow towards the rim; projected from above (left) they stay the same width round the ring but flatten into ellipses down the slope.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'jacobian() is Steps 1–2, sigmas() is Step 3; cell 3 computes the four measures of Step 4.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'The GPU computes the same derivatives per pixel (dFdx, dFdy of the UV) to choose a mipmap level: where σ is large, texels are small on screen and a blurrier level is used.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'UV › Angle distortion heat map colours every vertex; UV › Trace the distortion (one face) traces one triangle: the frame, J (predict its top-left entry), σ₁ and σ₂, and the whole mesh\'s mean, worst, area spread and flips. In a script: obj.traceDistortion(face), mesh.uvDistortion().' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: measuring UV distortion',
        caption: 'One triangle\'s Jacobian, its singular values, four measures, a check against 1/cos φ, and Tissot\'s ellipses.',
        props: {
          lesson: {
            title: 'Measuring distortion',
            subtitle: 'Circles in, ellipses out.',
            cells: [
              { type: 'js', instruction: '### 1. One triangle\'s Jacobian\nPredict first: J\'s top-left entry.', startCode: JAC },
              { type: 'js', instruction: '### 2. Singular values\nPredict first: σ₁ and σ₂ of a shear.', startCode: SVD },
              { type: 'js', instruction: '### 3. Four measures\nPredict first: which keeps angles, which keeps area?', startCode: MEASURES },
              { type: 'js', instruction: '### 4. A dome from above\nPredict first: σ₁/σ₂ near 60°.', startCode: DOME },
              { type: 'js', instruction: '### 5. See it\nTissot\'s indicatrix on two maps of a dome.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 270 },
              { type: 'challenge', instruction: '### 6. Challenge: read J\nThe check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkSigmas },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Measuring distortion" in MeshLab](#/lab/mesh-lab?project=measuring-distortion). A globe cut on one meridian: one face at the pole is traced. Press Play, and predict J\'s top-left entry.' },
              { type: 'markdown', instruction: '### Use the tool\n- **UV › Angle distortion heat map** on any unwrapped object.\n- **Edit mode, select a face, UV › Trace the distortion.**\n- In a script: `obj.traceDistortion(face)` returns σ₁, σ₂, the ratio, the area scale and the whole mesh\'s numbers; `mesh.uvDistortion()` the per-vertex values.\n- [Open "Conformal maps and LSCM"](#/lab/mesh-lab?project=conformal-unwrap) to compare a projection with LSCM.\n- **Elsewhere:** Blender\'s UV editor Display Stretch (angle and area), the Tissot indicatrix in map projection tools.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**The Jacobian.** For a triangle with frame coordinates $q_0 = 0$, $q_1 = (l_1, 0)$, $q_2 = (d, h)$ and UVs $t_0, t_1, t_2$, $J$ solves $J\\,[q_1\\ q_2] = [t_1 - t_0\\ \\ t_2 - t_0]$: first column $(t_1 - t_0)/l_1$, second $\\big((t_2 - t_0) - d\\cdot\\text{first}\\big)/h$.',
      '**Singular values.** $J = U \\Sigma V^{\\mathrm{T}}$ with $U, V$ rotations (or reflections) and $\\Sigma = \\operatorname{diag}(\\sigma_1, \\sigma_2)$: every linear map is a turn, a stretch along two perpendicular directions, and a turn. $\\sigma_{1,2}^2$ are the eigenvalues of $J^{\\mathrm{T}}J$, giving the closed form in the procedure.',
      '**The measures.** Angle distortion $\\sigma_1/\\sigma_2 \\ge 1$; area scale $\\sigma_1\\sigma_2 = |\\det J|$; the conformal energy of lesson 8.4 is $\\tfrac12(\\sigma_1 - \\sigma_2)^2$ per unit area; an isometry has $\\sigma_1 = \\sigma_2 = 1$. Gauss\'s Theorema Egregium means a curved surface has no map with $\\sigma_1 = \\sigma_2 = 1$ everywhere.',
      '**Tissot\'s indicatrix.** The ellipse $J\\,\\{(\\cos t, \\sin t)\\}$ drawn at a point shows both measures at once: its shape is the angle distortion, its size the scale.',
    ],
    equations: [
      { label: 'Singular values', latex: '\\sigma_{1,2} = \\sqrt{\\frac{s \\pm t}{2}}, \\quad s = a^2 + b^2 + c^2 + d^2, \\; t = \\sqrt{(a^2 + b^2 - c^2 - d^2)^2 + 4(ac + bd)^2}' },
      { label: 'Angle distortion', latex: '\\frac{\\sigma_1}{\\sigma_2}' },
      { label: 'Area scale', latex: '\\sigma_1\\sigma_2 = |\\det J|' },
      { label: 'Conformal energy', latex: '\\tfrac12(\\sigma_1 - \\sigma_2)^2' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** For a piecewise-linear map from a triangle mesh to the plane, on each triangle T with Jacobian J_T (in an orthonormal frame of T), the map is conformal on T iff σ₁ = σ₂, area-preserving iff σ₁σ₂ = 1, an isometry iff both, and orientation-preserving iff det J_T > 0. These are invariant under the choice of frame, because changing frames multiplies J by a rotation, which does not change singular values.',
      '**Invariant viewpoint.** σ₁ and σ₂ depend only on the triangle\'s shape and its UVs, not on where the triangle is in space or how the UV layout is turned; scaling the whole layout scales both by the same factor, leaving σ₁/σ₂ unchanged.',
      '**Geometric picture.** Paint a tiny circle on each triangle; flatten. Circles that stay round mark kept angles; equal sizes mark kept areas; a circle traced backwards marks a flip.',
      '**Where this goes.** Lesson 8.6 scales charts so the average area scale is 1 everywhere (equal texel density); chapter 9 shows what distortion does to a texture under lighting.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-8-005-ex1',
      title: 'A diagonal Jacobian',
      problem: 'What are the measures of $J = \\begin{bmatrix} 3 & 0 \\\\ 0 & 1 \\end{bmatrix}$?',
      steps: [{ expression: '\\sigma_1 = 3, \\; \\sigma_2 = 1', annotation: 'Already diagonal.' }],
      conclusion: 'Angle distortion 3, area scale 3, not flipped, stretch 3.',
    },
    {
      id: 'modelling-geometry-8-005-ex2',
      title: 'The shear',
      problem: 'Find $\\sigma_1, \\sigma_2$ of $\\begin{bmatrix} 1 & 0.5 \\\\ 0 & 1 \\end{bmatrix}$.',
      steps: [
        { expression: 's = 2.25, \\; t = \\sqrt{0.25^2 + 4(0.5)^2} = 1.0308', annotation: 'a = 1, b = 0.5, c = 0, d = 1.' },
        { expression: '\\sigma = \\sqrt{(2.25 \\pm 1.0308)/2} = 1.2808, \\; 0.7808', annotation: 'Closed form.' },
      ],
      conclusion: 'σ₁/σ₂ = 1.6404; σ₁σ₂ = 1: area kept, angles not.',
    },
    {
      id: 'modelling-geometry-8-005-ex3',
      title: 'Relative area',
      problem: 'A layout covers 0.5 of the UV square for a surface of area 20. A triangle has σ₁σ₂ = 0.05. Does it get its fair share of texels?',
      steps: [{ expression: '0.5 / 20 = 0.025', annotation: 'The map\'s average area scale.' }, { expression: '0.05 / 0.025 = 2', annotation: 'Relative.' }],
      conclusion: 'Twice its share: its texels are finer than average.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-8-005-ch1',
      difficulty: 'easy',
      problem: 'Why is σ₁σ₂ equal to |det J|?',
      walkthrough: [{ expression: '|\\det J| = |\\det U|\\,\\sigma_1\\sigma_2\\,|\\det V| = \\sigma_1\\sigma_2', annotation: 'Rotations have determinant ±1.' }],
      answer: 'J = UΣVᵀ with U and V rotations or reflections (determinant ±1), so |det J| = det Σ = σ₁σ₂. Both measure how much J scales area.',
    },
    {
      id: 'modelling-geometry-8-005-ch2',
      difficulty: 'medium',
      problem: 'A map has σ₁/σ₂ = 1 everywhere but σ₁σ₂ varying from 1 to 4. What does a checker look like on it?',
      walkthrough: [{ expression: '\\text{conformal, not area-preserving}', annotation: 'Lesson 8.4.' }],
      answer: 'Every checker square is a square, but their sizes vary: where σ₁σ₂ = 4 the squares cover a quarter of the surface they cover where it is 1, so they look half as wide on the model. This is LSCM on a curved chart.',
    },
    {
      id: 'modelling-geometry-8-005-ch3',
      difficulty: 'hard',
      problem: 'Show that the conformal energy per unit area, ½((a − d)² + (b + c)²), equals ½(σ₁ − σ₂)² for an orientation-preserving J.',
      walkthrough: [
        { expression: '\\tfrac12((a - d)^2 + (b + c)^2) = \\tfrac12\\|J\\|_F^2 - \\det J', annotation: 'Lesson 8.4.' },
        { expression: '\\|J\\|_F^2 = \\sigma_1^2 + \\sigma_2^2, \\; \\det J = \\sigma_1\\sigma_2', annotation: 'Singular values.' },
        { expression: '\\tfrac12(\\sigma_1^2 + \\sigma_2^2) - \\sigma_1\\sigma_2 = \\tfrac12(\\sigma_1 - \\sigma_2)^2', annotation: 'A square.' },
      ],
      answer: 'The Frobenius norm squared is the sum of the squared singular values and, for det J > 0, det J = σ₁σ₂. So ½‖J‖² − det J = ½(σ₁² + σ₂²) − σ₁σ₂ = ½(σ₁ − σ₂)²: zero exactly when σ₁ = σ₂.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'J', meaning: 'The 2 × 2 Jacobian of a triangle\'s UV map, in its own frame.' },
      { symbol: '\\sigma_1 \\ge \\sigma_2', meaning: 'Singular values: the ellipse\'s longest and shortest radii.' },
      { symbol: '\\sigma_1/\\sigma_2', meaning: 'Angle distortion (1 = conformal).' },
      { symbol: '\\sigma_1\\sigma_2 = |\\det J|', meaning: 'Area scale (relative to the map\'s average).' },
      { symbol: '\\det J < 0', meaning: 'The triangle is flipped in UV.' },
      { symbol: '\\max(\\sigma_1, 1/\\sigma_2)', meaning: 'Stretch: how far any length is from kept.' },
    ],
    rulesOfThumb: [
      'Circles in, ellipses out.',
      'Ratio for angles, product for area.',
      'Compare area to the map\'s average.',
      'Check the worst triangle and the flips.',
      'Curved surfaces cannot have both at 1.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-8-004', label: 'Conformal maps and LSCM', note: 'The map that makes σ₁/σ₂ small.' },
      { lessonId: 'modelling-geometry-2-004', label: 'The determinant', note: 'det J: how area scales, and when it flips.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-8-006', label: 'Straighten and pack', note: 'Equal texel density: area scale 1 per chart.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-8-005-1', label: 'Read how a triangle\'s Jacobian is found', type: 'read' },
    { id: 'cp-modelling-geometry-8-005-2', label: 'Read singular values as the ellipse\'s radii', type: 'read' },
    { id: 'cp-modelling-geometry-8-005-3', label: 'Read the four measures', type: 'read' },
    { id: 'cp-modelling-geometry-8-005-4', label: 'Run cells 1 to 4: Jacobian, SVD, measures, a dome', type: 'lab' },
    { id: 'cp-modelling-geometry-8-005-5', label: 'Trace one face\'s distortion in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-8-005-6', label: 'Work through example 2, the shear', type: 'example' },
    { id: 'cp-modelling-geometry-8-005-7', label: 'Work through example 3, relative area', type: 'example' },
    { id: 'cp-modelling-geometry-8-005-8', label: 'Complete the challenge: read J', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-8-005-assess-1',
        type: 'choice',
        text: 'J = [[2, 0], [0, 2]]. Its angle distortion and area scale are:',
        options: ['1 and 4', '2 and 2', '1 and 2', '4 and 1'],
        answer: '1 and 4',
        hint: 'σ₁ = σ₂ = 2.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-8-005-quiz-1',
      type: 'choice',
      text: 'A triangle\'s UV map, in its own frame, is described by:',
      options: ['A 2 × 2 Jacobian', 'A 3 × 3 rotation', 'Its normal', 'Its area alone'],
      answer: 'A 2 × 2 Jacobian',
      hints: ['Cell 1.', 'Procedure, Steps 1–2.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-8-005-quiz-2',
      type: 'choice',
      text: 'The singular values of J are:',
      options: ['The longest and shortest radii of the ellipse J makes from a unit circle', 'J\'s diagonal entries', 'J\'s eigenvalues', 'The lengths of J\'s rows'],
      answer: 'The longest and shortest radii of the ellipse J makes from a unit circle',
      hints: ['Cell 2.', 'Math, Singular values.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-8-005-quiz-3',
      type: 'choice',
      text: 'A shear [[1, 0.5], [0, 1]] keeps:',
      options: ['Area, not angles', 'Angles, not area', 'Both', 'Neither'],
      answer: 'Area, not angles',
      hints: ['Cell 2: σ₁σ₂ = 1.', 'σ₁/σ₂ = 1.64.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-8-005-quiz-4',
      type: 'choice',
      text: 'A triangle with det J < 0 is:',
      options: ['Flipped: its texture is mirrored', 'Very small', 'Conformal', 'Degenerate'],
      answer: 'Flipped: its texture is mirrored',
      hints: ['Cell 3.', 'The mirror map.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-8-005-quiz-5',
      type: 'choice',
      text: 'Projected from above, a dome\'s angle distortion at angle φ from the pole is about:',
      options: ['1/cos φ', 'cos φ', 'φ', '1'],
      answer: '1/cos φ',
      hints: ['Cell 4.', 'Lesson 8.3.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-8-005-quiz-6',
      type: 'choice',
      text: 'On a conformal map, Tissot\'s circles:',
      options: ['Stay circles but change size', 'Become ellipses of equal area', 'Stay the same everywhere', 'Disappear'],
      answer: 'Stay circles but change size',
      hints: ['The picture.', 'Challenge 2.'],
      reviewSection: 'Cell 5',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'A conformal map keeps everything.',
      whyStudentsThinkIt: 'Squares stay square.',
      correctionExample: 'The picture: stereographic circles stay round but grow towards the rim; areas are not kept.',
      contrastCase: 'An isometry (σ₁ = σ₂ = 1) keeps everything, and exists only for flat or developable charts.',
    },
    {
      falseBelief: 'If area is kept, the map is undistorted.',
      whyStudentsThinkIt: 'Same number of texels per surface area.',
      correctionExample: 'Cell 2: the shear keeps area exactly but stretches angles 1.64 : 1.',
      contrastCase: 'Equal-area map projections are chosen for exactly this trade.',
    },
    {
      falseBelief: 'J\'s diagonal entries are its stretches.',
      whyStudentsThinkIt: 'For a diagonal J they are.',
      correctionExample: 'The challenge: J = [[0, −2], [0.5, 0]] has a zero diagonal but stretches by 2 and 0.5.',
      contrastCase: 'A diagonal J (no turning) does have its diagonal entries as singular values (in absolute value).',
    },
  ],

  transferPrompts: [
    {
      situation: 'A UV layout must be checked before a texture artist spends a day painting on it.',
      competingTechniques: ['Look at a checker by eye', 'Per-triangle σ₁/σ₂, relative area and flips'],
      whyThisTechniqueWins: 'The numbers find the worst triangle and every flip, including ones hidden on the far side or inside a crowded layout.',
    },
    {
      situation: 'A world map must show countries at their true relative sizes.',
      competingTechniques: ['A conformal (Mercator) projection', 'An equal-area projection (σ₁σ₂ = 1)'],
      whyThisTechniqueWins: 'Comparing sizes needs σ₁σ₂ constant; Mercator keeps angles but inflates areas towards the poles.',
    },
  ],

  debugging: [
    {
      commonError: 'Computing J from UV and 3D coordinates directly (a 2 × 3 matrix) without the triangle\'s own frame.',
      symptom: 'σ values that depend on how the model is turned in space.',
      whyItHappened: 'The 3D coordinates were not expressed in the triangle\'s plane.',
      repairStrategy: 'Build the frame: x along an edge, y at right angles within the plane.',
    },
    {
      commonError: 'Using eigenvalues of J instead of singular values.',
      symptom: 'Complex numbers, or zero stretch for a rotation-heavy J.',
      whyItHappened: 'Eigenvalues measure invariant directions, not stretch.',
      repairStrategy: 'Use the square roots of the eigenvalues of JᵀJ.',
    },
    {
      commonError: 'Reading σ₁σ₂ as absolute texel density.',
      symptom: 'Every chart looks too small or too large.',
      whyItHappened: 'The layout was scaled to fit the square.',
      repairStrategy: 'Divide by the map\'s total UV area over total surface area.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Compute a triangle\'s J, σ₁, σ₂ and the four measures.',
    explainVerbally: 'Explain what σ₁/σ₂, σ₁σ₂ and det J say about a texture on the surface.',
    detectIncorrectApplication: 'Recognise eigen-for-singular confusions, missing frames and absolute area readings.',
    transferToUnfamiliar: 'Read distortion overlays in any UV tool and choose map projections by what they keep.',
  },
};
