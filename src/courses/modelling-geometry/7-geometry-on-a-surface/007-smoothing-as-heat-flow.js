// Lesson 7.7: smoothing as heat flow. Laplacian smoothing (lesson 5.6) is the heat equation applied to the positions.
// Seen one frequency at a time: an explicit step multiplies a wave by 1 − λ(1 − cos θ), which is below −1 for the
// zigzag once λ > 1, so big steps blow up; an implicit step multiplies it by 1 / (1 + λ(1 − cos θ)), which is between
// 0 and 1 for any λ. Both shrink a closed surface: a sphere under mean-curvature flow has R² = R₀² − 4t.
import { withPicture } from '../notebookScene.js';

const RING = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
// A signal on a ring of n points: u[i] is the height at point i; point n − 1 is next to point 0.
const n = 32
const wave = (k) => Array.from({ length: n }, (_, i) => Math.cos(2 * Math.PI * k * i / n))
const avg = (u, i) => (u[(i + n - 1) % n] + u[(i + 1) % n]) / 2                     // the neighbours' average
const explicitStep = (u, lam) => u.map((x, i) => x + lam * (avg(u, i) - x))         // x ← x + λ (x̄ − x)
const size = (u) => Math.max(...u.map(Math.abs))
`;

const MODES = `${RING}
// One explicit step with λ = 0.5 on three pure waves: k = 1 (one bump round the ring), 4, and 16 (a zigzag).
// Predict first: which shrinks most, and by how much?
for (const k of [1, 4, 16]) {
  const theta = 2 * Math.PI * k / n, after = explicitStep(wave(k), 0.5)
  console.log('k = ' + k + ': size ' + r(size(after)) + ', formula 1 − λ(1 − cos θ) = ' + r(1 - 0.5 * (1 - Math.cos(theta))))
}`;

const BLOWUP = `${RING}
// Ten explicit steps on the zigzag (k = 16, θ = π), for three step sizes. The factor per step is 1 − 2λ.
// Predict first: what happens at λ = 1.5?
for (const lam of [0.5, 1, 1.5]) {
  let u = wave(16)
  for (let s = 0; s < 10; s++) u = explicitStep(u, lam)
  console.log('λ = ' + lam + ': factor per step ' + r(1 - 2 * lam) + ', size after 10 steps ' + r(size(u)))
}`;

const IMPLICIT = `${RING}
// The implicit step: find u' with u' − λ (ū' − u') = u, i.e. (1 + λ) u'_i − (λ/2)(u'_{i−1} + u'_{i+1}) = u_i.
// The matrix is symmetric positive definite, so conjugate gradients solves it (lesson 7.5).
function implicitStep(u, lam) {
  const A = (x) => x.map((v, i) => (1 + lam) * v - lam * avg(x, i))
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)
  let x = u.slice(), res = u.map((v, i) => v - A(x)[i]), p = res.slice(), rr = dot(res, res)
  for (let k = 0; k < 200 && rr > 1e-24; k++) {
    const Ap = A(p), a = rr / dot(p, Ap)
    x = x.map((v, i) => v + a * p[i]); res = res.map((v, i) => v - a * Ap[i])
    const rr2 = dot(res, res); p = res.map((v, i) => v + (rr2 / rr) * p[i]); rr = rr2
  }
  return x
}
// Predict first: the zigzag's factor at λ = 1.5, where the explicit step blew up.
for (const lam of [0.5, 1.5, 50]) {
  const z = size(implicitStep(wave(16), lam)), one = size(implicitStep(wave(1), lam))
  console.log('λ = ' + lam + ': zigzag × ' + r(z) + ' (1 / (1 + 2λ) = ' + r(1 / (1 + 2 * lam)) + '), one bump × ' + r(one))
}`;

const SURF = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const sub = (a, b) => a.map((x, i) => x - b[i]), dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a) => Math.hypot(...a)
const cotAt = (a, b, c) => { const u = sub(a, c), w = sub(b, c); return dot(u, w) / len(cross(u, w)) }   // angle at c
// Conjugate gradients on rows of (column → value), starting from x0 (lesson 7.5).
function cg(A, b, x0) {
  const mul = (x) => A.map((row) => { let s = 0; for (const [c, v] of row) s += v * x[c]; return s })
  let x = x0.slice(), Ax = mul(x), res = b.map((v, i) => v - Ax[i]), p = res.slice(), rr = dot(res, res); const bn = Math.sqrt(dot(b, b)) || 1
  for (let k = 0; k < 5000 && Math.sqrt(rr) / bn > 1e-12; k++) {
    const Ap = mul(p), a = rr / dot(p, Ap)
    x = x.map((v, i) => v + a * p[i]); res = res.map((v, i) => v - a * Ap[i])
    const rr2 = dot(res, res); p = res.map((v, i) => v + (rr2 / rr) * p[i]); rr = rr2
  }
  return x
}
// One implicit smoothing step on a closed triangle mesh: (M + tC) x' = M x, for x, y and z.
function implicitSmooth(V, T, t) {
  const C = V.map(() => new Map()), mass = V.map(() => 0)
  const put = (i, j, w) => C[i].set(j, (C[i].get(j) || 0) + w)
  for (const tri of T) tri.forEach((i, k) => {
    const j = tri[(k + 1) % 3], l = tri[(k + 2) % 3], w = cotAt(V[i], V[j], V[l]) / 2
    put(i, j, -w); put(j, i, -w); put(i, i, w); put(j, j, w)
    mass[i] += len(cross(sub(V[j], V[i]), sub(V[l], V[i]))) / 6
  })
  const A = C.map((row, i) => { const m = new Map([...row].map(([j, v]) => [j, t * v])); m.set(i, m.get(i) + mass[i]); return m })
  const cols = [0, 1, 2].map((c) => cg(A, V.map((p, i) => mass[i] * p[c]), V.map((p) => p[c])))
  return V.map((_, i) => [cols[0][i], cols[1][i], cols[2][i]])
}
// A UV sphere of radius 1, triangles only.
function sphere(S, R) {
  const V = [[0, 1, 0]], T = []
  for (let i = 1; i < R; i++) for (let j = 0; j < S; j++) { const a = Math.PI * i / R, b = 2 * Math.PI * j / S; V.push([Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)]) }
  V.push([0, -1, 0])
  const at = (i, j) => 1 + (i - 1) * S + (j % S), s = V.length - 1
  for (let j = 0; j < S; j++) T.push([0, at(1, j + 1), at(1, j)])
  for (let i = 1; i < R - 1; i++) for (let j = 0; j < S; j++) T.push([at(i, j), at(i, j + 1), at(i + 1, j + 1)], [at(i, j), at(i + 1, j + 1), at(i + 1, j)])
  for (let j = 0; j < S; j++) T.push([at(R - 1, j), at(R - 1, j + 1), s])
  return { V, T }
}
const meanRadius = (V) => V.reduce((s, p) => s + len(p), 0) / V.length
`;

const SHRINK = `${SURF}
// Smoothing a sphere: every point moves inward at speed 2H = 2/R (mean-curvature flow), so R² = 1 − 4t exactly.
// Smooth for a total time 0.1 in 1, 4 and 16 implicit steps. Predict first: which is closest to √0.6 = 0.7746?
const { V, T } = sphere(32, 16)
for (const steps of [1, 4, 16]) {
  let W = V
  for (let s = 0; s < steps; s++) W = implicitSmooth(W, T, 0.1 / steps)
  console.log(steps + ' step' + (steps > 1 ? 's' : '') + ' of t = ' + r(0.1 / steps) + ': radius ' + r(meanRadius(W)))
}
console.log('the flow itself: radius ' + r(Math.sqrt(1 - 4 * 0.1)))`;

const PICTURE = withPicture(`${SURF}
// Three copies of one bumpy sphere: as it was, three explicit steps of λ = 2 (too big), and one implicit step.
// (With six neighbours per vertex the plain average damps more than on the ring, so it takes λ = 2 to blow up quickly.)
let seed = 3
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const { V: V0, T } = sphere(40, 20)
const bumpy = V0.map((p) => { const k = 1 + 0.08 * (rand() - 0.5); return p.map((x) => x * k) })
const nb = bumpy.map(() => new Set()); for (const t of T) t.forEach((a, k) => { nb[a].add(t[(k + 1) % 3]); nb[t[(k + 1) % 3]].add(a) })
let tooBig = bumpy
for (let s = 0; s < 3; s++) tooBig = tooBig.map((p, i) => { const a = [0, 0, 0]; for (const j of nb[i]) for (let c = 0; c < 3; c++) a[c] += tooBig[j][c] / nb[i].size; return p.map((x, c) => x + 2 * (a[c] - x)) })
const h = 2 * Math.PI / 40, smooth = implicitSmooth(bumpy, T, h * h)
const rough = (W) => { const R = W.map(len), m = R.reduce((a, b) => a + b) / R.length; return 100 * Math.sqrt(R.reduce((s, x) => s + (x - m) ** 2, 0) / R.length) / m }
console.log('roughness: bumpy ' + r(rough(bumpy)) + '%, explicit λ = 2 ×3 ' + r(rough(tooBig)) + '%, implicit ×1 ' + r(rough(smooth)) + '%')
// Drawn with smooth shading (one normal per vertex, the sum of its faces' normals) so bumps catch the light.
const verts = [], faces = [], groups = [], shading = []
;[bumpy, tooBig, smooth].forEach((W, k) => {
  const N = W.map(() => [0, 0, 0])
  for (const [a, b, c] of T) { const f = cross(sub(W[b], W[a]), sub(W[c], W[a])); for (const v of [a, b, c]) N[v] = N[v].map((x, q) => x + f[q]) }
  const o = verts.length
  for (const p of W) verts.push([p[0] + 2.6 * (k - 1), p[1], p[2]])
  for (const t of T) { faces.push(t.map((i) => i + o)); groups.push(k); shading.push(t.map((i) => N[i].map((x) => x / len(N[i])))) }
})
show({ verts, faces, groups, shading, zoom: 1.6 })`);

const CHALLENGE = `// On the ring of points, smoothing the zigzag (neighbours at −1 when you are at +1).
// 1. The largest λ for which explicit steps do not make the zigzag grow.
// 2. The factor one implicit step with λ = 3 multiplies the zigzag by.
const answer = { explicitLimit: 0, implicitFactor: 0 }
console.log(answer)`;

const SOLVED = CHALLENGE.replace('const answer = { explicitLimit: 0, implicitFactor: 0 }', 'const answer = { explicitLimit: 1, implicitFactor: 1 / 7 }');

/** The challenge's check: |1 − 2λ| ≤ 1 gives λ ≤ 1; 1 / (1 + 2·3) = 1/7. */
export function checkZigzag(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/explicitLimit\s*:\s*([^,}]+),\s*implicitFactor\s*:\s*([^,}\n]+)/);
  if (!m) return no('Keep the line const answer = { explicitLimit: …, implicitFactor: … }.');
  // Only arithmetic is evaluated: this runs in the page, not the cell's sandbox.
  const num = (s) => { const e = s.trim(); if (!/^[\d.\s+\-*/()]+$/.test(e)) return NaN; try { return Number(new Function('return (' + e + ')')()); } catch { return NaN; } };
  const L = num(m[1]), F = num(m[2]);
  if (!Number.isFinite(L) || !Number.isFinite(F)) return no('Both answers must be numbers or plain arithmetic, like 1 / 7.');
  const near = (a, b) => Math.abs(a - b) < 1e-3;
  if (near(L, 0) && near(F, 0)) return no('For the zigzag, x̄ − x = −2x. Write down the factor each step multiplies it by.');
  if (near(L, 0.5)) return no('At λ = 0.5 the zigzag goes to zero in one step. It still does not grow up to the λ where the factor 1 − 2λ reaches −1.');
  if (near(L, 2)) return no('The factor is 1 − 2λ; it must stay at least −1, so 2λ ≤ 2.');
  if (!near(L, 1)) return no(`explicitLimit ${+L.toFixed(4)}: the explicit factor for the zigzag is 1 − 2λ, and it must not go below −1.`);
  if (near(F, -5)) return no('−5 is the explicit factor 1 − 2λ at λ = 3. The implicit step divides instead: u′ (1 + 2λ) = u.');
  if (near(F, 0.25)) return no('1/(1 + λ) forgets that x̄ − x is −2x for the zigzag: the implicit factor is 1/(1 + 2λ).');
  if (near(F, 1 / 3)) return no('Close: with λ = 3, 2λ = 6, so the factor is 1/(1 + 6).');
  if (!near(F, 1 / 7)) return no(`implicitFactor ${+F.toFixed(4)}: solve u′ − λ(ū′ − u′) = u with ū′ = −u′.`);
  return { pass: true, message: 'Right: the explicit factor 1 − 2λ stays at or above −1 only while λ ≤ 1; the implicit factor 1/(1 + 2λ) = 1/7 at λ = 3, and is between 0 and 1 for any λ.' };
}

export default {
  id: 'modelling-geometry-7-007',
  slug: 'smoothing-as-heat-flow',
  chapter: 'modelling-geometry',
  order: 7,
  title: 'Smoothing as heat flow',
  subtitle: 'Laplacian smoothing is the heat equation on the positions: why big explicit steps explode, why implicit ones never do, and why everything shrinks.',
  tags: ['smoothing', 'heat equation', 'implicit', 'explicit', 'stability', 'mean curvature flow', 'shrinkage'],
  coreConcept: 'Moving each vertex towards its neighbours\' average, x ← x + λ(x̄ − x), is one explicit (forward Euler) step of the heat equation applied to the positions. Each frequency is multiplied by 1 − λ(1 − cos θ): high frequencies (bumps) shrink fastest, but for the zigzag the factor is 1 − 2λ, which is below −1 once λ > 1, so large steps blow up. The implicit (backward Euler) step solves (M + tC) x\' = M x and multiplies each frequency by 1/(1 + λ(1 − cos θ)), between 0 and 1 for any step size: one large, stable step. Both are mean-curvature flow on a surface, which shrinks it: a sphere has R² = R₀² − 4t.',
  prerequisites: ['modelling-geometry-7-005', 'modelling-geometry-5-006'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-7-008',

  hook: {
    question: 'Smoothing with λ = 0.5 works. Raise λ to 1.5 to finish faster, and the model turns into spikes. Why does doing more of a smoothing operation make it rougher, and how do real tools take big smoothing steps safely?',
    realWorldContext: 'Smoothing cleans up scanned meshes, sculpting brushes relax surfaces, fairing makes car bodies and product shells pleasant to look at, and cloth and hair simulations face the same explicit-versus-implicit choice. The idea that a large step must be implicit to be stable runs through all of simulation.',
  },

  intuition: {
    prose: [
      'Lesson 5.6 smoothed by moving each vertex part of the way to its neighbours\' average: $x \\leftarrow x + \\lambda(\\bar{x} - x)$. That is heat flow. Heat spreads from hot to cold until everything is the same temperature; here the "temperature" is the position, and spreading it evens out the bumps.',
      'The cleanest way to see what one step does is one **frequency** at a time. On a ring of points, a wave that goes round $k$ times has $\\bar{x} - x = -(1 - \\cos\\theta)\\,x$ with $\\theta = 2\\pi k/n$, so one step multiplies it by $1 - \\lambda(1 - \\cos\\theta)$. Before running cell 1, predict which of $k = 1, 4, 16$ shrinks most. The zigzag ($k = 16$, $\\theta = \\pi$) goes straight to $0$ at $\\lambda = 0.5$; one bump round the ring barely changes.',
      'Now the danger. For the zigzag the factor is $1 - 2\\lambda$. At $\\lambda = 1$ it is $-1$: the zigzag flips every step and never shrinks. At $\\lambda = 1.5$ it is $-2$: every step **doubles** it and flips it. Before running cell 2, predict the size after 10 steps of $\\lambda = 1.5$: $2^{10} = 1024$. That is the spiky model in the hook: each vertex overshoots its neighbours\' average by more than it started.',
      'The **implicit** step asks a different question: which new positions $x\'$, smoothed, would give back the old ones? $x\' - \\lambda(\\bar{x}\' - x\') = x$. For a wave that divides instead of multiplying: the factor is $1/(1 + \\lambda(1 - \\cos\\theta))$, between $0$ and $1$ for **every** $\\lambda$. Before running cell 3, predict the zigzag\'s factor at $\\lambda = 1.5$: $1/4$. The price is a linear system each step, symmetric positive definite, so conjugate gradients (lesson 7.5).',
      'On a surface, with cotan weights and areas, smoothing is **mean-curvature flow**: every point moves inward at speed $2H$. A sphere of radius $R$ has $H = 1/R$, so it shrinks with $R^2 = R_0^2 - 4t$. Cell 4 checks the implicit step against that. Before running it, predict: one big step shrinks the sphere less than the flow does ($0.833$ against $0.775$), because it uses the curvature of the sphere it started from; more, smaller steps converge. Shrinking is not a bug of one method: it is what the heat equation does to a closed surface.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Implicit smoothing',
        body: 'Step 1. Build C (cotan) and M (areas) for the current mesh; h = mean edge length; t = strength · h².\nStep 2. Vertices that must stay put (open edges, unselected) move to the right-hand side.\nStep 3. Solve (M + tC) x\' = M x for x, then y, then z: one matrix, three right-hand sides, conjugate gradients starting from the current positions.\nStep 4. Repeat if wanted, rebuilding C and M; rescale or use Taubin steps if the volume must be kept.',
      },
      {
        type: 'warning',
        title: 'Explicit steps have a speed limit',
        body: 'With the plain average, λ must be at most 1 or the zigzag grows. With cotan weights and areas, the limit depends on the smallest triangles: t below about h²/4 for the worst ones. A mesh with one tiny triangle forces tiny steps everywhere. Implicit steps have no limit.',
      },
      {
        type: 'warning',
        title: 'Smoothing shrinks',
        body: 'Every heat-flow step moves points against their mean curvature, so convex parts move inward. Forty steps of λ = 0.5 lose nearly half a sphere\'s volume (project "Noise and smoothing"). Counter it by rescaling to the starting volume, or by Taubin\'s λ|μ pairs of steps (lesson 5.6).',
      },
      {
        type: 'insight',
        title: 'The graphics strand: before and after',
        body: 'Smoothing is judged by eye with smooth shading or reflection lines: bumps catch the light. The picture shows the same bumpy sphere before, after three explicit steps that are too big, and after one implicit step.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "a bigger smoothing step smooths more". Blue is the bumpy sphere (roughness 2.3%). The orange one had three explicit steps of λ = 2: 8.5%, spikier than it started. The green one had one implicit step: 0.8%, and smooth.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'explicitStep is x + λ(x̄ − x); implicitStep solves (1 + λ)x\'_i − (λ/2)(x\'_{i−1} + x\'_{i+1}) = x_i with conjugate gradients; implicitSmooth is the same on a surface, with cotan weights and areas.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Smoothing changes positions, so the normals must be recomputed afterwards; it is a geometry operation run once, not per frame. Sculpting brushes run small explicit steps on the GPU because each is cheap; large steps go through a sparse solver on the CPU.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Mesh › Smooth vertices is the explicit step (λ in the Adjust panel, capped at 1); Mesh › Smooth vertices (implicit) is the implicit one, with strength = t/h². With Record traces on it is traced: the system (predict a diagonal entry), the three solves, and the shrinkage. In scripts: mesh.smooth({ lambda, iterations }) and mesh.smoothImplicit({ strength }).' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: smoothing, one frequency at a time',
        caption: 'Waves on a ring under explicit and implicit steps, a sphere shrinking by mean-curvature flow, and a bumpy sphere smoothed two ways.',
        props: {
          lesson: {
            title: 'Smoothing as heat flow',
            subtitle: 'Explicit, implicit, and shrinkage.',
            cells: [
              { type: 'js', instruction: '### 1. One frequency at a time\nPredict first: which wave shrinks most?', startCode: MODES },
              { type: 'js', instruction: '### 2. Too big a step\nPredict first: the zigzag after 10 steps of λ = 1.5.', startCode: BLOWUP },
              { type: 'js', instruction: '### 3. The implicit step\nPredict first: its factor on the zigzag at λ = 1.5.', startCode: IMPLICIT },
              { type: 'js', instruction: '### 4. A sphere shrinks\nPredict first: which step count lands closest to the flow?', startCode: SHRINK },
              { type: 'js', instruction: '### 5. See it\nBumpy, explicit λ = 2 three times, implicit once. Drag to turn.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 340 },
              { type: 'challenge', instruction: '### 6. Challenge: the zigzag\'s factors\nThe check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkZigzag },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Smoothing as heat flow" in MeshLab](#/lab/mesh-lab?project=implicit-smoothing). Four copies of a bumpy sphere; the implicit step is traced: press Play, and predict a diagonal entry of M + tC.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Edit mode, select vertices, Mesh › Smooth vertices (implicit),** then the strength in the Adjust panel.\n- In a script: `mesh.smoothImplicit({ strength: 2 })`, or explicit `mesh.smooth({ iterations: 5, lambda: 0.5 })`.\n- [Open "Noise and smoothing" in MeshLab](#/lab/mesh-lab?project=smoothing) to watch explicit steps shrink a sphere.\n- **Elsewhere:** Blender\'s Laplacian Smooth modifier (with volume preservation), libigl\'s implicit smoothing, MeshLab (the program)\'s HC Laplacian.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**The heat equation on positions.** $\\partial_t x = \\Delta x$. On a surface, the Laplace–Beltrami operator of the position is $\\Delta x = -2H\\,n$ (lesson 7.3), so smoothing moves every point along its normal at speed $2H$: mean-curvature flow. Discretely, $\\Delta \\approx -M^{-1}C$.',
      '**Explicit (forward Euler).** $x_{k+1} = x_k - t\\,M^{-1}C\\,x_k$. On an eigenvector of $M^{-1}C$ with eigenvalue $\\mu$ the factor is $1 - t\\mu$; stable only if $t\\mu \\le 2$ for the largest $\\mu$, which grows like $1/h^2$. With uniform weights and $\\lambda$ it is the factor $1 - \\lambda(1 - \\cos\\theta)$ of the ring.',
      '**Implicit (backward Euler).** $(M + tC)\\,x_{k+1} = M\\,x_k$. The factor is $1/(1 + t\\mu)$, in $(0, 1]$ for every $t \\ge 0$: unconditionally stable. $M + tC$ is symmetric positive definite, so each step is a conjugate-gradient solve.',
      '**Shrinkage.** For a sphere, $\\dot R = -2/R$, so $R^2 = R_0^2 - 4t$ and it vanishes at $t = R_0^2/4$. One implicit step of length $t$ uses the operators of the sphere it starts from, where $C x = (2/R^2) M x$, so $(1 + 2t/R^2)\,R\' = R$: it shrinks less than the flow. It is first-order accurate, so the error roughly halves as the step halves (cell 4: $0.059$, $0.021$, $0.006$ for $1$, $4$, $16$ steps).',
    ],
    equations: [
      { label: 'Explicit', latex: 'x_{k+1} = x_k + \\lambda(\\bar{x}_k - x_k)' },
      { label: 'Explicit factor', latex: '1 - \\lambda(1 - \\cos\\theta)' },
      { label: 'Implicit', latex: '(M + tC)\\,x_{k+1} = M\\,x_k' },
      { label: 'Implicit factor', latex: '\\frac{1}{1 + \\lambda(1 - \\cos\\theta)}' },
      { label: 'Sphere', latex: 'R^2 = R_0^2 - 4t' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** For symmetric positive semi-definite $C$ and positive diagonal $M$, the generalised eigenvectors of $(C, M)$ diagonalise both schemes. Forward Euler multiplies mode $\\mu$ by $1 - t\\mu$ and is stable iff $t \\le 2/\\mu_{\\max}$; backward Euler multiplies it by $(1 + t\\mu)^{-1}$ and is stable for all $t \\ge 0$. Constant positions ($\\mu = 0$) are untouched by both.',
      '**Invariant viewpoint.** The cotan Laplacian and the areas depend only on the surface, not on how it sits in space, so smoothing commutes with rigid motions; uniform weights depend on the connectivity, so they also move vertices sideways towards a regular spacing.',
      '**Geometric picture.** Each vertex sits on a little drum skin pulled by its neighbours. A small explicit step lets it move part of the way; a big one flings it past the middle. The implicit step finds where the whole skin settles after the time t, all at once.',
      '**Where this goes.** Lesson 7.8 draws level sets of fields; chapter 11\'s bone weights diffuse by the same implicit heat step; cloth simulation (chapter 10) faces the same stability choice for its springs.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-7-007-ex1',
      title: 'A wave\'s factor',
      problem: 'On a ring of 32 points, a wave with $k = 8$ ($\\theta = \\pi/2$). One explicit step with $\\lambda = 0.5$?',
      steps: [{ expression: '1 - 0.5(1 - \\cos 90°) = 0.5', annotation: 'cos 90° = 0.' }],
      conclusion: 'It halves.',
    },
    {
      id: 'modelling-geometry-7-007-ex2',
      title: 'Overshooting',
      problem: 'A vertex is at height 1; its neighbours are at −1. One explicit step with $\\lambda = 1.5$?',
      steps: [{ expression: '1 + 1.5(-1 - 1) = -2', annotation: 'x + λ(x̄ − x).' }],
      conclusion: '−2: past the average and further from it than before.',
    },
    {
      id: 'modelling-geometry-7-007-ex3',
      title: 'How long a sphere lasts',
      problem: 'Under mean-curvature flow, how long until a sphere of radius 2 shrinks to nothing?',
      steps: [{ expression: 'R_0^2 - 4t = 0 \\Rightarrow t = 4/4 = 1', annotation: 'R² = R₀² − 4t.' }],
      conclusion: 't = 1.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-7-007-ch1',
      difficulty: 'easy',
      problem: 'Why do bumps disappear before the overall shape changes?',
      walkthrough: [{ expression: '1 - \\lambda(1 - \\cos\\theta)', annotation: 'Small θ (long waves): factor near 1.' }],
      answer: 'Each frequency is multiplied by 1 − λ(1 − cos θ). Bumps are high frequencies (θ near π) with factors near 1 − 2λ; the overall shape is low frequency (θ near 0) with factors near 1.',
    },
    {
      id: 'modelling-geometry-7-007-ch2',
      difficulty: 'medium',
      problem: 'A mesh has one sliver triangle, a hundred times smaller than the rest. Why does explicit cotan smoothing need tiny steps everywhere, and implicit smoothing not?',
      walkthrough: [
        { expression: '\\mu_{\\max} \\sim 1/h_{\\min}^2', annotation: 'The tiny triangle sets the largest eigenvalue.' },
        { expression: 't \\le 2/\\mu_{\\max}', annotation: 'Explicit limit.' },
      ],
      answer: 'The largest eigenvalue of M⁻¹C grows like one over the smallest triangle\'s size squared, and the explicit step must satisfy t ≤ 2/μ_max everywhere at once. The implicit factor 1/(1 + tμ) is below 1 for every μ, so the sliver only makes its modes decay faster.',
    },
    {
      id: 'modelling-geometry-7-007-ch3',
      difficulty: 'hard',
      problem: 'Show that one implicit step on a unit sphere with time t gives R\' = 1/(1 + 2t), and compare it with the flow at t = 0.1.',
      walkthrough: [
        { expression: 'C x = 2 M x', annotation: 'On the unit sphere, Δx = −2x: C and M are built on the sphere the step starts from.' },
        { expression: "(M + 2tM)\\,x' = M x", annotation: 'Substitute into (M + tC) x\' = M x.' },
        { expression: "x' = \\frac{x}{1 + 2t} = \\frac{x}{1.2}", annotation: 'Every point moves in by the same factor.' },
      ],
      answer: 'R′ = 1/1.2 = 0.8333 against the flow\'s √0.6 = 0.7746: one large step shrinks it less, because it keeps using the curvature of the starting sphere. Cell 4\'s single step gives 0.8334; 16 steps give 0.7806.',
    },
  ],

  semantics: {
    core: [
      { symbol: '\\lambda', meaning: 'Explicit step size: the fraction of the way to the neighbours\' average.' },
      { symbol: 't', meaning: 'Time step of the heat equation; strength · h² in MeshLab.' },
      { symbol: '\\theta = 2\\pi k / n', meaning: 'A wave\'s frequency on a ring of n points.' },
      { symbol: '1 - \\lambda(1 - \\cos\\theta)', meaning: 'What one explicit step multiplies that wave by.' },
      { symbol: '1/(1 + \\lambda(1 - \\cos\\theta))', meaning: 'What one implicit step multiplies it by.' },
      { symbol: '(M + tC)x\' = Mx', meaning: 'The implicit step on a surface.' },
    ],
    rulesOfThumb: [
      'High frequencies go first.',
      'Explicit: λ ≤ 1 with the plain average.',
      'Implicit: any step; one solve per coordinate.',
      'All smoothing shrinks closed surfaces.',
      'Keep volume by rescaling or Taubin steps.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-5-006', label: 'Merge and smooth vertices', note: 'The explicit step, and Taubin smoothing.' },
      { lessonId: 'modelling-geometry-7-005', label: 'Sparse linear systems', note: 'The solve each implicit step needs.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-7-008', label: 'Level sets and contours', note: 'Drawing a field\'s equal-value lines.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-7-007-1', label: 'Read smoothing as the heat equation', type: 'read' },
    { id: 'cp-modelling-geometry-7-007-2', label: 'Read the explicit and implicit factors', type: 'read' },
    { id: 'cp-modelling-geometry-7-007-3', label: 'Read why smoothing shrinks', type: 'read' },
    { id: 'cp-modelling-geometry-7-007-4', label: 'Run cells 1 to 4: waves, blow-up, implicit, the sphere', type: 'lab' },
    { id: 'cp-modelling-geometry-7-007-5', label: 'Trace an implicit smoothing step in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-7-007-6', label: 'Work through example 2, overshooting', type: 'example' },
    { id: 'cp-modelling-geometry-7-007-7', label: 'Work through example 3, how long a sphere lasts', type: 'example' },
    { id: 'cp-modelling-geometry-7-007-8', label: 'Complete the challenge: the zigzag\'s factors', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-7-007-assess-1',
        type: 'choice',
        text: 'One implicit step with λ = 1 multiplies the zigzag by:',
        options: ['1/3', '−1', '1/2', '0'],
        answer: '1/3',
        hint: '1/(1 + 2λ).',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-7-007-quiz-1',
      type: 'choice',
      text: 'One explicit step with λ = 0.5 multiplies the zigzag (θ = π) by:',
      options: ['0', '0.5', '1', '−1'],
      answer: '0',
      hints: ['1 − 2λ.', 'Cell 1.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-7-007-quiz-2',
      type: 'choice',
      text: 'Ten explicit steps with λ = 1.5 multiply the zigzag\'s size by:',
      options: ['1024', '0', '1', '15'],
      answer: '1024',
      hints: ['Each step multiplies by −2.', 'Cell 2.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-7-007-quiz-3',
      type: 'choice',
      text: 'For which step sizes is the implicit step stable?',
      options: ['All of them', 'λ ≤ 1', 'λ ≤ 0.5', 'None'],
      answer: 'All of them',
      hints: ['Its factor is 1/(1 + …).', 'Cell 3.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-7-007-quiz-4',
      type: 'choice',
      text: 'Under mean-curvature flow, a unit sphere after time 0.1 has radius:',
      options: ['√0.6 ≈ 0.775', '0.9', '0.6', '1'],
      answer: '√0.6 ≈ 0.775',
      hints: ['R² = 1 − 4t.', 'Cell 4.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-7-007-quiz-5',
      type: 'choice',
      text: 'Why does every smoothing method shrink a closed surface?',
      options: ['Heat flow moves points against their mean curvature', 'Rounding errors', 'Only explicit steps shrink', 'The boundary is fixed'],
      answer: 'Heat flow moves points against their mean curvature',
      hints: ['Δx = −2Hn.', 'Warning "Smoothing shrinks".'],
      reviewSection: 'Warning "Smoothing shrinks"',
    },
    {
      id: 'modelling-geometry-7-007-quiz-6',
      type: 'choice',
      text: 'What does each implicit smoothing step cost?',
      options: ['A sparse solve for each of x, y and z', 'One average per vertex', 'Nothing extra', 'A dense matrix inverse'],
      answer: 'A sparse solve for each of x, y and z',
      hints: ['(M + tC) x\' = M x.', 'Procedure.'],
      reviewSection: 'Procedure',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'A bigger smoothing step smooths more.',
      whyStudentsThinkIt: 'Up to λ = 0.5 it does.',
      correctionExample: 'Cell 2: λ = 1.5 doubles the zigzag each step; the picture\'s λ = 2 sphere is nearly four times rougher than it started.',
      contrastCase: 'Implicit steps do smooth more as t grows (cell 3).',
    },
    {
      falseBelief: 'Implicit smoothing does not shrink.',
      whyStudentsThinkIt: 'It is the "better" method.',
      correctionExample: 'Cell 4: the sphere shrinks to between 0.78 and 0.83 whatever the step count; the MeshLab trace reports the volume lost.',
      contrastCase: 'Rescaling, or Taubin\'s λ|μ steps, keep the volume.',
    },
    {
      falseBelief: 'Smoothing affects all detail equally.',
      whyStudentsThinkIt: 'Every vertex moves.',
      correctionExample: 'Cell 1: the zigzag goes to 0 while one bump round the ring keeps 99% of its size.',
      contrastCase: 'Very long smoothing does eventually remove the low frequencies too, collapsing the shape.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A scanned mesh has noise and a few tiny sliver triangles; it must be smoothed in one go.',
      competingTechniques: ['Many explicit cotan steps', 'One implicit step'],
      whyThisTechniqueWins: 'The slivers force explicit steps to be tiny everywhere; the implicit step is stable at any size and needs one solve per coordinate.',
    },
    {
      situation: 'A product shell must be faired without changing its volume.',
      competingTechniques: ['Plain smoothing', 'Smoothing followed by rescaling, or Taubin λ|μ steps'],
      whyThisTechniqueWins: 'All heat flow shrinks; rescaling or alternating shrink and inflate steps keeps the volume while removing bumps.',
    },
  ],

  debugging: [
    {
      commonError: 'Explicit smoothing with λ above 1.',
      symptom: 'Spikes that grow every iteration.',
      whyItHappened: 'The zigzag\'s factor 1 − 2λ is below −1.',
      repairStrategy: 'Keep λ ≤ 1 (≤ 0.5 to damp the zigzag fully), or switch to implicit steps.',
    },
    {
      commonError: 'Solving (C + tM) instead of (M + tC).',
      symptom: 'Almost no smoothing, or a singular solve.',
      whyItHappened: 'The time step multiplies the stiffness C, not the mass.',
      repairStrategy: 'Write it as M(x\' − x)/t = −C x\' and rearrange.',
    },
    {
      commonError: 'Including boundary vertices as unknowns.',
      symptom: 'The outline of an open mesh shrinks inward.',
      whyItHappened: 'Their heat flows like any other vertex\'s.',
      repairStrategy: 'Fix them: move their columns to the right-hand side.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Write explicit and implicit smoothing and predict each wave\'s factor.',
    explainVerbally: 'Explain why big explicit steps blow up, why implicit ones do not, and why smoothing shrinks.',
    detectIncorrectApplication: 'Recognise overshooting, swapped M and C, and drifting boundaries.',
    transferToUnfamiliar: 'Choose explicit or implicit steps for brushes, fairing and simulation.',
  },
};
