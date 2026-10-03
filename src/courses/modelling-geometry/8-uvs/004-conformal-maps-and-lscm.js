// Lesson 8.4: conformal maps and LSCM. A map is conformal where it keeps angles: its 2 × 2 Jacobian is a rotation
// times a scale, which is the Cauchy–Riemann condition a = d, b = −c. LSCM (least squares conformal maps) finds the
// UVs of a disc that come closest: minimise E = E_D − A, the Dirichlet energy minus the UV area, which is zero
// exactly for a conformal map. E is quadratic, so with two vertices pinned it is one sparse symmetric solve.

const BASE = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const sub = (a, b) => a.map((x, i) => x - b[i]), dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a) => Math.hypot(...a)
const cotAt = (a, b, c) => { const u = sub(a, c), w = sub(b, c); return dot(u, w) / len(cross(u, w)) }   // angle at c
`;

const CR = `${BASE}
// A 2 × 2 map J = [[a, b], [c, d]] takes a little square to a parallelogram. It keeps angles when it is a rotation
// times a scale: a = d and b = −c (the Cauchy–Riemann equations). Predict first: which of these keep angles?
const maps = {
  'turn 30°, scale 2': [[2 * Math.cos(Math.PI / 6), -2 * Math.sin(Math.PI / 6)], [2 * Math.sin(Math.PI / 6), 2 * Math.cos(Math.PI / 6)]],
  'shear by 0.5': [[1, 0.5], [0, 1]],
  'squash y by half': [[1, 0], [0, 0.5]],
  'mirror in x': [[-1, 0], [0, 1]],
}
for (const [name, [[a, b], [c, d]]] of Object.entries(maps)) {
  const s = a * a + b * b + c * c + d * d, t = Math.sqrt((a * a + b * b - c * c - d * d) ** 2 + 4 * (a * c + b * d) ** 2)
  const s1 = Math.sqrt((s + t) / 2), s2 = Math.sqrt(Math.max(0, (s - t) / 2))
  console.log(name + ': (a − d)² + (b + c)² = ' + r((a - d) ** 2 + (b + c) ** 2) + ', σ₁/σ₂ = ' + r(s1 / s2) + ', det ' + r(a * d - b * c))
}`;

const ENERGY = `${BASE}
// The conformal energy of UVs on a triangle mesh: E = E_D − A.
//   E_D = ½ Σ over edges of w_ij (|u_i − u_j|² + |v_i − v_j|²), w_ij the cotan weight (lesson 7.2): how much the map stretches.
//   A   = the signed area the UVs cover.
// E ≥ 0 always, and E = 0 exactly when the map is conformal.
function energy(V, T, uv) {
  let ED = 0, A = 0
  for (const t of T) {
    t.forEach((i, k) => { const j = t[(k + 1) % 3], l = t[(k + 2) % 3], w = cotAt(V[i], V[j], V[l]) / 2; ED += 0.5 * w * ((uv[i][0] - uv[j][0]) ** 2 + (uv[i][1] - uv[j][1]) ** 2) })
    const [p, q, s] = t.map((i) => uv[i]); A += ((q[0] - p[0]) * (s[1] - p[1]) - (s[0] - p[0]) * (q[1] - p[1])) / 2
  }
  return { ED, A, E: ED - A }
}
// A flat 2 × 2 sheet in the x–z plane, cut into 8 × 8 squares, each into two counter-clockwise triangles.
const N = 8, V = [], T = [], id = (i, j) => i * (N + 1) + j
for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) V.push([-1 + 2 * i / N, 0, -1 + 2 * j / N])
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) T.push([id(i, j), id(i + 1, j), id(i + 1, j + 1)], [id(i, j), id(i + 1, j + 1), id(i, j + 1)])
// Predict first: E for UVs (x, z), and for the sheared UVs (x + 0.5 z, z).
for (const [name, f] of [['u = x, v = z', (p) => [p[0], p[2]]], ['u = x + 0.5 z, v = z', (p) => [p[0] + 0.5 * p[2], p[2]]], ['u = 2x, v = 2z', (p) => [2 * p[0], 2 * p[2]]]]) {
  const { ED, A, E } = energy(V, T, V.map(f))
  console.log(name + ': E_D ' + r(ED) + ', A ' + r(A) + ', E ' + r(E))
}`;

const DOME = `${BASE}
// A dome: the top half of a unit sphere, a pole and 8 rings of 24, as counter-clockwise triangles. One rim: a disc.
const S = 24, R = 8, V = [[0, 1, 0]], T = []
for (let i = 1; i <= R; i++) for (let j = 0; j < S; j++) { const a = (Math.PI / 2) * i / R, b = 2 * Math.PI * j / S; V.push([Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)]) }
const at = (i, j) => 1 + (i - 1) * S + (j % S), n = V.length
for (let j = 0; j < S; j++) T.push([0, at(1, j + 1), at(1, j)])
for (let i = 1; i < R; i++) for (let j = 0; j < S; j++) T.push([at(i, j), at(i, j + 1), at(i + 1, j + 1)], [at(i, j), at(i + 1, j + 1), at(i + 1, j)])
// LSCM: x = (u_0 … u_{n−1}, v_0 … v_{n−1}) minimises ½ xᵀ H x with H = [[C, −S/2], [S/2, C]].
// C is the cotan matrix; S has +1 at (i, j) and −1 at (j, i) for each boundary edge i → j, so ½ uᵀ S v is the area.
function lscm(V, T, pins) {
  const n = V.length, H = Array.from({ length: 2 * n }, () => new Map()), add = (i, j, x) => H[i].set(j, (H[i].get(j) || 0) + x)
  const used = new Map()
  for (const t of T) t.forEach((i, k) => {
    const j = t[(k + 1) % 3], l = t[(k + 2) % 3], w = cotAt(V[i], V[j], V[l]) / 2
    for (const o of [0, n]) { add(o + i, o + j, -w); add(o + j, o + i, -w); add(o + i, o + i, w); add(o + j, o + j, w) }
    const key = Math.min(i, j) + ',' + Math.max(i, j); used.set(key, used.has(key) ? null : [i, j])
  })
  for (const e of used.values()) if (e) { const [i, j] = e; add(i, n + j, -0.5); add(j, n + i, 0.5); add(n + i, j, 0.5); add(n + j, i, -0.5) }
  // Pinned unknowns move to the right-hand side; conjugate gradients on the rest.
  const fixed = new Map(pins.flatMap(([v, [pu, pv]]) => [[v, pu], [n + v, pv]])), free = [...H.keys()].filter((g) => !fixed.has(g)), slot = new Map(free.map((g, k) => [g, k]))
  const b = free.map((g) => { let s = 0; for (const [c, x] of H[g]) if (fixed.has(c)) s -= x * fixed.get(c); return s })
  const mul = (x) => free.map((g) => { let s = 0; for (const [c, h] of H[g]) if (slot.has(c)) s += h * x[slot.get(c)]; return s })
  let x = b.map(() => 0), res = b.slice(), p = b.slice(), rr = dot(res, res), its = 0
  for (; its < 5000 && Math.sqrt(rr) > 1e-12; its++) { const Ap = mul(p), a = rr / dot(p, Ap); x = x.map((v, i) => v + a * p[i]); res = res.map((v, i) => v - a * Ap[i]); const r2 = dot(res, res); p = res.map((v, i) => v + (r2 / rr) * p[i]); rr = r2 }
  const all = [...H.keys()].map((g) => (fixed.has(g) ? fixed.get(g) : x[slot.get(g)]))
  return { uv: V.map((_, i) => [all[i], all[n + i]]), its }
}
// Each triangle's angle distortion σ₁/σ₂ and area scale σ₁σ₂ (lesson 8.5).
function stretch(P, Q) {
  const e1 = sub(P[1], P[0]), e2 = sub(P[2], P[0]), x = e1.map((v) => v / len(e1)), y = cross(cross(e1, e2), e1), yn = y.map((v) => v / len(y))
  const q1 = dot(e1, x), q2 = [dot(e2, x), dot(e2, yn)]
  const A = (Q[1][0] - Q[0][0]) / q1, C = (Q[1][1] - Q[0][1]) / q1, B = (Q[2][0] - Q[0][0] - A * q2[0]) / q2[1], D = (Q[2][1] - Q[0][1] - C * q2[0]) / q2[1]
  const s = A * A + B * B + C * C + D * D, t = Math.sqrt((A * A + B * B - C * C - D * D) ** 2 + 4 * (A * C + B * D) ** 2)
  const s1 = Math.sqrt((s + t) / 2), s2 = Math.sqrt(Math.max(0, (s - t) / 2)); return [s1 / s2, s1 * s2]
}
const report = (uv) => { const st = T.map((t) => stretch(t.map((i) => V[i]), t.map((i) => uv[i]))), q = st.map((s) => s[0]), a = st.map((s) => s[1]); return 'angle distortion mean ' + r(q.reduce((x, y) => x + y) / q.length) + ', worst ' + r(Math.max(...q)) + '; area scale varies ' + r(Math.max(...a) / Math.min(...a)) + '×' }
`;

const SOLVE = `${DOME}
// Pin two rim vertices on opposite sides, as far apart as on the surface (2), and solve.
// Predict first: how close to 1 is the angle distortion? Are areas kept too?
const p1 = at(R, 0), p2 = at(R, S / 2)
const { uv, its } = lscm(V, T, [[p1, [0, 0]], [p2, [len(sub(V[p1], V[p2])), 0]]])
console.log('LSCM, ' + its + ' CG iterations: ' + report(uv))
console.log('projected from above: ' + report(V.map((p) => [p[0], p[2]])))`;

const PINS = `${DOME}
// Why two pins? Predict first: with one pin, what does the "best" map look like?
const p1 = at(R, 0), p2 = at(R, S / 2)
const one = lscm(V, T, [[p1, [0, 0]]]).uv
console.log('one pin: the UVs span ' + r(Math.max(...one.map((q) => Math.hypot(...q)))) + ' (everything collapses onto the pin: E = 0 for a point)')
// Two pins at any distance: the same shape, only its size changes.
for (const L of [1, 2, 4]) {
  const { uv } = lscm(V, T, [[p1, [0, 0]], [p2, [L, 0]]])
  console.log('pins ' + L + ' apart: ' + report(uv))
}`;

const PICTURE = `${DOME}
// The dome's UV layout two ways: LSCM (left) and projected from above (right), drawn as its rings and spokes.
const p1 = at(R, 0), p2 = at(R, S / 2)
const lsc = lscm(V, T, [[p1, [0, 0]], [p2, [2, 0]]]).uv, top = V.map((p) => [p[0], p[2]])
const canvas = document.createElement('canvas'), W = 380, H = 200
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'); g.scale(2, 2); g.fillStyle = '#0f1923'; g.fillRect(0, 0, W, H)
;[[lsc, 'LSCM'], [top, 'from above']].forEach(([uv, name], k) => {
  const us = uv.map((q) => q[0]), vs = uv.map((q) => q[1]), cu = (Math.min(...us) + Math.max(...us)) / 2, cv = (Math.min(...vs) + Math.max(...vs)) / 2
  const s = 150 / Math.max(Math.max(...us) - Math.min(...us), Math.max(...vs) - Math.min(...vs)), ox = (k + 0.5) * W / 2
  const X = (q) => ox + (q[0] - cu) * s, Y = (q) => H / 2 - 8 - (q[1] - cv) * s
  // Draw the rings and the spokes from the pole (the triangles' diagonals are left out, to keep it readable).
  g.strokeStyle = k ? '#f59e0b' : '#60a5fa'; g.lineWidth = 1
  const line = (ids) => { g.beginPath(); ids.forEach((i, m) => (m ? g.lineTo : g.moveTo).call(g, X(uv[i]), Y(uv[i]))); g.stroke() }
  for (let i = 1; i <= R; i++) line(Array.from({ length: S + 1 }, (_, j) => at(i, j)))
  for (let j = 0; j < S; j++) line([0, ...Array.from({ length: R }, (_, i) => at(i + 1, j))])
  g.fillStyle = '#cbd5e1'; g.font = '11px sans-serif'; g.textAlign = 'center'; g.fillText(name, ox, H - 6)
})
console.log('drawn: ' + T.length + ' triangles, twice')`;

const CHALLENGE = `// A triangle's map has Jacobian J = [[0.6, b], [0.8, d]]. Choose b and d so that the map keeps angles and does not
// mirror the triangle.
const answer = { b: 0, d: 0 }
console.log(answer)`;

const SOLVED = CHALLENGE.replace('const answer = { b: 0, d: 0 }', 'const answer = { b: -0.8, d: 0.6 }');

/** The challenge's check: Cauchy–Riemann a = d, b = −c, so d = 0.6 and b = −0.8 (a turn by 53.13°, scale 1). */
export function checkConformal(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/\bb\s*:\s*([^,}]+),\s*d\s*:\s*([^,}\n]+)/);
  if (!m) return no('Keep the line const answer = { b: …, d: … }.');
  const num = (s) => { const e = s.trim(); if (!/^[\d.\s+\-*/()]+$/.test(e)) return NaN; try { return Number(new Function('return (' + e + ')')()); } catch { return NaN; } };
  const b = num(m[1]), d = num(m[2]);
  if (!Number.isFinite(b) || !Number.isFinite(d)) return no('b and d must be numbers.');
  const near = (x, y) => Math.abs(x - y) < 1e-3;
  if (near(b, -0.8) && near(d, 0.6)) return { pass: true, message: 'Right: a = d = 0.6 and b = −c = −0.8. J is a turn by atan2(0.8, 0.6) = 53.13° with scale √(0.6² + 0.8²) = 1, so every angle (and here every length) is kept; det J = 0.36 + 0.64 = 1 > 0, so nothing is mirrored.' };
  if (b === 0 && d === 0) return no('The Cauchy–Riemann equations tie d to a and b to c. Which way round, and with what sign?');
  if (near(b, 0.8) && near(d, -0.6)) return no('That is a reflection: a = −d and b = c keep angles but mirror the triangle (det J = −1). Flip both signs.');
  if (near(b, 0.8) && near(d, 0.6)) return no('b = c gives a symmetric matrix: it stretches along one direction. Conformal needs b = −c.');
  if (near(d, 0.6)) return no('d is right. b must be −c for the map to be a turn.');
  if (near(b, -0.8)) return no('b is right. d must equal a.');
  return no('A map keeps angles when J = s · [[cos θ, −sin θ], [sin θ, cos θ]]: a = d and b = −c.');
}

export default {
  id: 'modelling-geometry-8-004',
  slug: 'conformal-maps-and-lscm',
  chapter: 'modelling-geometry',
  order: 4,
  title: 'Conformal maps and LSCM',
  subtitle: 'UVs that keep every angle as well as they can: the Cauchy–Riemann equations, an energy that measures failure, and one sparse solve.',
  tags: ['uv', 'unwrap', 'lscm', 'conformal', 'cauchy-riemann', 'dirichlet energy', 'least squares', 'pins'],
  coreConcept: 'A map keeps angles (is conformal) where its 2 × 2 Jacobian is a rotation times a scale: a = d and b = −c, the Cauchy–Riemann equations. A curved surface cannot be flattened keeping both angles and areas, so LSCM keeps angles as well as possible: minimise the conformal energy E = E_D − A, the Dirichlet energy ½ Σ w_ij |uv_i − uv_j|² (cotan weights) minus the signed UV area, which is never negative and is zero exactly for a conformal map. E is quadratic in the UVs and does not change when the map is moved, turned or scaled, so two vertices are pinned and one sparse symmetric positive definite system is solved by conjugate gradients. Squares stay square; their sizes vary.',
  prerequisites: ['modelling-geometry-8-002', 'modelling-geometry-7-005'],
  timeToComplete: 45,
  nextLesson: 'modelling-geometry-8-005',

  hook: {
    question: 'Press U in Blender or MeshLab and a curved piece of a model lands flat in the UV square, every checker square still square. A sphere cannot lie flat, so something has to give. What does the unwrapper keep, what does it give up, and how does it find the answer in a fraction of a second?',
    realWorldContext: 'LSCM (Lévy, Petitjean, Ray and Maillot, 2002) is Blender\'s default unwrap and a standard in game and film tools; its relatives (ABF++, conformal energy minimisation, boundary-first flattening) are used for texture atlases, remeshing, and flattening scans of skin and fabric.',
  },

  intuition: {
    prose: [
      'A UV map squeezes and turns each little piece of surface. Zoom in far enough on one triangle and the map is linear: a $2 \\times 2$ matrix $J = \\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}$ (its **Jacobian**) taking the triangle\'s own flat coordinates to UV. It keeps angles when it is just a turn and a scale: $a = d$ and $b = -c$, the **Cauchy–Riemann equations**. Before running cell 1, predict which of four maps (a turn with scaling, a shear, a squash, a mirror) keep angles. The mirror does too, but turns the triangle over, which UVs must not do.',
      'A curved surface cannot be flattened keeping both angles and areas (lesson 7.4: Gaussian curvature is exactly what stops it). **Conformal** maps keep the angles and let the sizes vary, which is what a checker texture shows best: squares stay square.',
      'How far is a map from conformal? The **conformal energy** $E = E_D - A$. $E_D$, the Dirichlet energy, adds up how much the map stretches (the same cotan weights as lesson 7.2); $A$ is the area it covers. For any map $E_D \\ge A$, with equality exactly when it is conformal. Before running cell 2, predict $E$ for the UVs $(x, z)$ of a flat sheet (zero) and for a shear (positive).',
      '$E$ is a quadratic in the unknown UVs, so its minimum solves a linear system: sparse, symmetric, and positive definite once the map cannot drift. But a conformal map stays conformal when moved, turned or scaled, and a map that shrinks to a point has $E = 0$. **Pinning** two vertices fixes all four freedoms. Before running cell 4, predict what happens with only one pin: everything collapses onto it.',
      'Before running cell 3, predict how close LSCM gets on a dome: angle distortion within a few percent of 1, while the squares at the rim come out several times the area of those at the top. Projected from above, the same dome has its rim squashed into slivers.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: LSCM on one chart',
        body: 'Step 1. Check the chart is a disc (lesson 8.2).\nStep 2. Build the cotan matrix C and the boundary matrix S (+1 at (i, j), −1 at (j, i) for each boundary edge i → j).\nStep 3. Unknowns x = (u, v); H = [[C, −S/2], [S/2, C]], so E = ½ xᵀHx.\nStep 4. Pin two boundary vertices far apart: one at (0, 0), the other at (L, 0), L their distance on the surface.\nStep 5. Move the pinned columns to the right-hand side; solve the rest by conjugate gradients.\nStep 6. If the UV area is negative, mirror u; then scale to true area and pack (lesson 8.6).',
      },
      {
        type: 'warning',
        title: 'Conformal is not area-preserving',
        body: 'LSCM keeps angles, not sizes. On a strongly curved chart, texels near the tip can be many times larger than at the rim, so the texture gets blurry there. Cut more seams (smaller, flatter charts) or use an area-aware method.',
      },
      {
        type: 'warning',
        title: 'Pins matter',
        body: 'With no pins the minimum is a point; with one, still a point. Two pins far apart give a well-conditioned system and a sensible size. Pinning two close vertices can let the chart fold or flip near the far side.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: checker squares stay square',
        body: 'A checker on a conformal map shows only squares, of varying size. Any rectangle or rhombus is angle distortion; any change in size is area distortion. Lesson 8.5 turns both into numbers.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "the best flattening keeps every triangle the same size". LSCM\'s layout (left) spreads the rings out towards the rim so every triangle keeps its shape; projected from above (right), the rings bunch up at the rim and the triangles there are squashed flat.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'lscm() is the procedure: the cotan loop is C, used collects boundary edges for S, fixed holds the pins, and the loop at the end is conjugate gradients.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'The solve runs once, when the model is unwrapped; the GPU only ever sees the resulting UVs. Packing (lesson 8.6) then arranges every chart in the square.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'UV › Unwrap (LSCM), or U in edit mode. With Record traces on it is traced: the charts, the two pins (predict where the second goes), the conformal solve, the angles kept, and the packing. UV › Angle distortion heat map shows the result. In a script: mesh.unwrap().' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: least squares conformal maps',
        caption: 'Cauchy–Riemann, the conformal energy, an LSCM solve on a dome, why two pins, and the two layouts.',
        props: {
          lesson: {
            title: 'Conformal maps and LSCM',
            subtitle: 'Keep the angles; let the sizes go.',
            cells: [
              { type: 'js', instruction: '### 1. Which maps keep angles?\nPredict first.', startCode: CR },
              { type: 'js', instruction: '### 2. The conformal energy\nPredict first: E for (x, z), a shear, and a doubling.', startCode: ENERGY },
              { type: 'js', instruction: '### 3. LSCM on a dome\nPredict first: angle distortion, and area.', startCode: SOLVE },
              { type: 'js', instruction: '### 4. Why two pins\nPredict first: one pin.', startCode: PINS },
              { type: 'js', instruction: '### 5. See it\nThe two layouts.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 260 },
              { type: 'challenge', instruction: '### 6. Challenge: make it conformal\nThe check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkConformal },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Conformal maps and LSCM" in MeshLab](#/lab/mesh-lab?project=conformal-unwrap). The same dome, unwrapped and projected; the unwrap is traced: press Play, and predict where the second pin goes.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Edit mode, U** (UV › Unwrap (LSCM)); mark seams first if the piece is not a disc.\n- **UV › Angle distortion heat map** to check it.\n- In a script: `mesh.unwrap()`, `mesh.uvDistortion()`.\n- [Open "Unwrap a cube and a sphere"](#/lab/mesh-lab?project=unwrap-basics): six perfect squares, and a sphere whose squares change size.\n- **Elsewhere:** Blender\'s Unwrap (Conformal), libigl\'s lscm, CGAL\'s Surface_mesh_parameterization.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Conformality.** In a triangle\'s own orthonormal frame, the map to UV is affine with Jacobian $J$. $J$ keeps angles and orientation iff $J = s R_\\theta$, i.e. $a = d$ and $b = -c$; equivalently its singular values are equal, $\\sigma_1 = \\sigma_2 = s$, and $\\det J > 0$.',
      '**The energy.** $\\tfrac12 \\|J\\|_F^2 - \\det J = \\tfrac12\\big((a - d)^2 + (b + c)^2\\big) \\ge 0$. Integrated over the surface: $E = E_D - A$, with $E_D = \\tfrac12\\int (|\\nabla u|^2 + |\\nabla v|^2) = \\tfrac12(u^{\\mathrm{T}}Cu + v^{\\mathrm{T}}Cv)$ and $A = \\int \\det J$, the signed UV area, which depends only on the boundary: $A = \\tfrac12 u^{\\mathrm{T}}S v$ by the shoelace formula.',
      '**The system.** With $x = (u, v)$, $E = \\tfrac12 x^{\\mathrm{T}} H x$ for $H = \\begin{bmatrix} C & -S/2 \\\\ S/2 & C \\end{bmatrix}$, symmetric because $S$ is antisymmetric. $H$ is positive semi-definite, with null space the similarity maps (and the point maps); fixing two vertices removes it, leaving a symmetric positive definite system in $2n - 4$ unknowns, solved by conjugate gradients (lesson 7.5).',
      '**What is lost.** A conformal map scales lengths by $s = \\sigma_1 = \\sigma_2$, varying over the surface. On a disc of positive Gaussian curvature $s$ must grow towards the boundary: for the stereographic map of a hemisphere, $s = 2/(1 + \\cos\\phi)$, from 1 at the top to 2 at the rim, area ratio 4.',
    ],
    equations: [
      { label: 'Cauchy–Riemann', latex: 'a = d, \\quad b = -c' },
      { label: 'Pointwise energy', latex: '\\tfrac12\\|J\\|_F^2 - \\det J = \\tfrac12\\big((a - d)^2 + (b + c)^2\\big)' },
      { label: 'Conformal energy', latex: 'E = \\tfrac12(u^{\\mathrm{T}}Cu + v^{\\mathrm{T}}Cv) - \\tfrac12 u^{\\mathrm{T}}S v' },
      { label: 'The system', latex: 'H = \\begin{bmatrix} C & -S/2 \\\\ S/2 & C \\end{bmatrix}' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** For a disc-topology triangle mesh with positive cotan weights, the discrete conformal energy E(u, v) is a positive semi-definite quadratic form whose null space is spanned by the constant maps and the discrete similarities; constraining two distinct vertices makes it positive definite, and its unique minimiser is the LSCM parameterisation. Mullen et al. (2008) showed this form equals the original least-squares Cauchy–Riemann energy of Lévy et al.',
      '**Invariant viewpoint.** E depends only on the surface\'s edge lengths and angles (through the cotan weights and areas), so bending a chart without stretching does not change its unwrap. Its minimiser changes by a similarity when the pins move: the shape of the layout is fixed by the surface, not by the pins.',
      '**Geometric picture.** Flatten a curved rubber patch so that every tiny circle drawn on it stays a circle: the patch must stretch more in some places than others, but never in one direction more than another.',
      '**Where this goes.** Lesson 8.5 measures σ₁ and σ₂ everywhere; lesson 8.6 scales charts to their true area and packs them; chapter 9 reads textures through these UVs.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-8-004-ex1',
      title: 'Is it conformal?',
      problem: 'Is $J = \\begin{bmatrix} 3 & -4 \\\\ 4 & 3 \\end{bmatrix}$ conformal? What does it do?',
      steps: [{ expression: 'a = d = 3, \\; b = -c = -4', annotation: 'Cauchy–Riemann holds.' }, { expression: 's = \\sqrt{3^2 + 4^2} = 5', annotation: 'The scale.' }],
      conclusion: 'Yes: a turn by atan2(4, 3) = 53.13° and a scale of 5.',
    },
    {
      id: 'modelling-geometry-8-004-ex2',
      title: 'The energy of a shear',
      problem: 'For $J = \\begin{bmatrix} 1 & 0.5 \\\\ 0 & 1 \\end{bmatrix}$, what is $\\tfrac12((a - d)^2 + (b + c)^2)$?',
      steps: [{ expression: '\\tfrac12(0 + 0.25) = 0.125', annotation: 'Per unit area.' }],
      conclusion: '0.125 per unit area: cell 2\'s sheet of area 4 has E = 0.5.',
    },
    {
      id: 'modelling-geometry-8-004-ex3',
      title: 'How many unknowns',
      problem: 'A chart has 193 vertices. How many unknowns does LSCM solve for after pinning two?',
      steps: [{ expression: '2 \\times 193 - 4 = 382', annotation: 'A u and a v per vertex, minus two pinned vertices.' }],
      conclusion: '382.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-8-004-ch1',
      difficulty: 'easy',
      problem: 'Why does LSCM need two pins and not one?',
      walkthrough: [{ expression: 'E(\\text{all UVs at the pin}) = 0', answer: '' }],
      answer: 'Collapsing the whole chart onto one point has E_D = 0 and A = 0, so E = 0: the minimum. One pin does not prevent it (cell 4). A second pin at a distance forces the chart to have a size.',
    },
    {
      id: 'modelling-geometry-8-004-ch2',
      difficulty: 'medium',
      problem: 'Why is E = E_D − A never negative, and when is it zero?',
      walkthrough: [
        { expression: '\\tfrac12(a^2 + b^2 + c^2 + d^2) - (ad - bc) = \\tfrac12((a - d)^2 + (b + c)^2)', annotation: 'Expand.' },
      ],
      answer: 'Per triangle, half the squared size of J minus its determinant equals half of (a − d)² + (b + c)², a sum of squares. It is zero exactly when a = d and b = −c: when the map is conformal there.',
    },
    {
      id: 'modelling-geometry-8-004-ch3',
      difficulty: 'hard',
      problem: 'Show that the area term A depends only on the UVs of boundary vertices.',
      walkthrough: [
        { expression: 'A = \\sum_T \\text{signed area}(T)', annotation: 'Each triangle\'s shoelace sum.' },
        { expression: '\\text{interior edges appear twice, in opposite directions}', annotation: 'They cancel.' },
        { expression: 'A = \\tfrac12 \\sum_{\\text{boundary } i \\to j} (u_i v_j - u_j v_i)', annotation: 'The shoelace formula round the rim.' },
      ],
      answer: 'Each triangle\'s signed area is ½ Σ over its edges i → j of (u_i v_j − u_j v_i). An interior edge is used by two triangles in opposite directions, so its terms cancel; only boundary edges remain, giving the shoelace formula for the polygon traced by the rim: ½ uᵀ S v.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'J = \\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}', meaning: 'The map from a triangle\'s plane to UV.' },
      { symbol: 'a = d, \\; b = -c', meaning: 'Cauchy–Riemann: a turn times a scale.' },
      { symbol: 'E_D', meaning: 'Dirichlet energy: how much the map stretches.' },
      { symbol: 'A', meaning: 'The signed area the UVs cover.' },
      { symbol: 'E = E_D - A', meaning: 'Conformal energy: zero exactly for a conformal map.' },
      { symbol: 'H', meaning: 'The LSCM matrix [[C, −S/2], [S/2, C]].' },
    ],
    rulesOfThumb: [
      'Conformal: squares stay square.',
      'Curved surfaces lose area accuracy.',
      'Two pins, far apart.',
      'One sparse SPD solve per chart.',
      'Check with a checker.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-8-002', label: 'Seams and charts', note: 'LSCM flattens one disc at a time.' },
      { lessonId: 'modelling-geometry-7-005', label: 'Sparse linear systems', note: 'The conjugate-gradient solve.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-8-005', label: 'Measuring distortion', note: 'σ₁, σ₂ and what they mean.' },
      { lessonId: 'modelling-geometry-8-006', label: 'Straighten and pack', note: 'Scaling and arranging the charts.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-8-004-1', label: 'Read the Cauchy–Riemann equations', type: 'read' },
    { id: 'cp-modelling-geometry-8-004-2', label: 'Read the conformal energy E = E_D − A', type: 'read' },
    { id: 'cp-modelling-geometry-8-004-3', label: 'Read why two pins are needed', type: 'read' },
    { id: 'cp-modelling-geometry-8-004-4', label: 'Run cells 1 to 4: Cauchy–Riemann, energy, a dome, pins', type: 'lab' },
    { id: 'cp-modelling-geometry-8-004-5', label: 'Trace an LSCM unwrap in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-8-004-6', label: 'Work through example 1, is it conformal?', type: 'example' },
    { id: 'cp-modelling-geometry-8-004-7', label: 'Work through example 2, the energy of a shear', type: 'example' },
    { id: 'cp-modelling-geometry-8-004-8', label: 'Complete the challenge: make it conformal', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-8-004-assess-1',
        type: 'choice',
        text: 'Which Jacobian is conformal (keeps angles and orientation)?',
        options: ['[[2, −1], [1, 2]]', '[[2, 1], [1, 2]]', '[[1, 0], [0, 2]]', '[[−1, 0], [0, 1]]'],
        answer: '[[2, −1], [1, 2]]',
        hint: 'a = d and b = −c.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-8-004-quiz-1',
      type: 'choice',
      text: 'A map is conformal at a point when its Jacobian:',
      options: ['Is a rotation times a scale', 'Has determinant 1', 'Is symmetric', 'Is diagonal'],
      answer: 'Is a rotation times a scale',
      hints: ['Cell 1.', 'Cauchy–Riemann.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-8-004-quiz-2',
      type: 'choice',
      text: 'For the UVs (x, z) of a flat sheet, the conformal energy E is:',
      options: ['0', 'The sheet\'s area', '1', 'Negative'],
      answer: '0',
      hints: ['Cell 2.', 'The identity keeps angles.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-8-004-quiz-3',
      type: 'choice',
      text: 'What does LSCM keep on a curved chart?',
      options: ['Angles (approximately), not areas', 'Areas, not angles', 'Both exactly', 'Neither'],
      answer: 'Angles (approximately), not areas',
      hints: ['Cell 3.', 'Warning "Conformal is not area-preserving".'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-8-004-quiz-4',
      type: 'choice',
      text: 'With only one pinned vertex, the LSCM minimum:',
      options: ['Collapses the chart onto the pin', 'Is the same as with two', 'Has no solution', 'Is a mirror image'],
      answer: 'Collapses the chart onto the pin',
      hints: ['Cell 4.', 'Challenge 1.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-8-004-quiz-5',
      type: 'choice',
      text: 'The LSCM matrix H is:',
      options: ['Symmetric, and positive definite once two vertices are pinned', 'Antisymmetric', 'Dense', 'Diagonal'],
      answer: 'Symmetric, and positive definite once two vertices are pinned',
      hints: ['Math, The system.', 'S is antisymmetric.'],
      reviewSection: 'Math',
    },
    {
      id: 'modelling-geometry-8-004-quiz-6',
      type: 'choice',
      text: 'The area term A depends on:',
      options: ['Only the boundary vertices\' UVs', 'Every vertex equally', 'Only the pins', 'The 3D positions'],
      answer: 'Only the boundary vertices\' UVs',
      hints: ['Challenge 3.', 'The shoelace formula.'],
      reviewSection: 'Challenge',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'The best flattening keeps every triangle the same size.',
      whyStudentsThinkIt: 'Equal texel density sounds ideal.',
      correctionExample: 'Cell 3 and the picture: on a dome, keeping shapes forces triangle areas to vary 4.1×; keeping sizes would force shapes to skew.',
      contrastCase: 'A flat or cylindrical chart can keep both.',
    },
    {
      falseBelief: 'A mirror image is conformal enough.',
      whyStudentsThinkIt: 'It keeps every angle\'s size.',
      correctionExample: 'Cell 1: the mirror has σ₁/σ₂ = 1 but det < 0: the triangle is turned over, and its texture reads backwards.',
      contrastCase: 'LSCM checks the UV area\'s sign and mirrors u back if needed.',
    },
    {
      falseBelief: 'LSCM needs an iterative optimiser.',
      whyStudentsThinkIt: 'It minimises an energy.',
      correctionExample: 'The energy is quadratic, so its minimum is one linear solve (cell 3 shows the iteration count of that one solve).',
      contrastCase: 'Non-quadratic energies (area-preserving, ARAP) do need repeated solves.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A character\'s face must be unwrapped so painted freckles stay round everywhere.',
      competingTechniques: ['Planar projection from the front', 'LSCM on the face chart'],
      whyThisTechniqueWins: 'Round freckles need conformal UVs. A front projection squashes the sides of the face; LSCM keeps shapes everywhere, at the cost of varying size.',
    },
    {
      situation: 'A strongly curved chart (a fingertip) shows a blurry texture at its tip after LSCM.',
      competingTechniques: ['A bigger texture', 'More seams: split the chart into flatter pieces'],
      whyThisTechniqueWins: 'The blur is area distortion from curvature; smaller, flatter charts reduce it without doubling memory.',
    },
  ],

  debugging: [
    {
      commonError: 'Pinning two vertices that are close together.',
      symptom: 'The chart is huge, twisted or folded on the far side.',
      whyItHappened: 'Small errors near the pins are magnified across the chart.',
      repairStrategy: 'Pin the two boundary vertices farthest apart.',
    },
    {
      commonError: 'Unwrapping a chart that is not a disc.',
      symptom: 'Overlapping or collapsed UVs.',
      whyItHappened: 'A tube or closed chart has no planar layout with one rim.',
      repairStrategy: 'Add seams until Trace the charts reports only discs.',
    },
    {
      commonError: 'Using uniform weights instead of cotan weights in E_D.',
      symptom: 'Squares visibly skewed on irregular meshes.',
      whyItHappened: 'The umbrella Laplacian ignores triangle shape (lesson 7.2).',
      repairStrategy: 'Use the cotan matrix.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Test a Jacobian for conformality, compute E, and solve LSCM on a disc.',
    explainVerbally: 'Explain Cauchy–Riemann, the energy, the pins and what LSCM gives up.',
    detectIncorrectApplication: 'Recognise mirrored charts, close pins and non-disc charts.',
    transferToUnfamiliar: 'Choose between projection and LSCM, and decide where to add seams.',
  },
};
