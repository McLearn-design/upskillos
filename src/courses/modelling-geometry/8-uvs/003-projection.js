// Lesson 8.3: projection. The quickest UVs need no seams: drop a coordinate (planar), use the angle round an axis
// (cylindrical), or pick a planar projection per face by its normal (box). The price is stretch: a face tilted θ
// from the projection plane is squashed by cos θ, so its angle distortion σ₁/σ₂ is 1/cos θ. Cylinders wrap: a face
// across the line where the angle restarts must have its low u values moved up by one turn.

const SVD = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const sub = (a, b) => a.map((x, i) => x - b[i]), dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (a) => a.map((x) => x / Math.hypot(...a))
// How a triangle's UV map stretches it: the singular values σ₁ ≥ σ₂ of the 2 × 2 map from the triangle's own plane
// to UV (lesson 8.5 builds this in full). σ₁/σ₂ = 1 means angles are kept.
function sigmas(P, T) {
  const e1 = sub(P[1], P[0]), e2 = sub(P[2], P[0]), x = unit(e1), y = unit(cross(cross(e1, e2), e1))
  const q1 = [dot(e1, x), 0], q2 = [dot(e2, x), dot(e2, y)]
  const du1 = T[1][0] - T[0][0], dv1 = T[1][1] - T[0][1], du2 = T[2][0] - T[0][0], dv2 = T[2][1] - T[0][1]
  const a = du1 / q1[0], c = dv1 / q1[0], b = (du2 - a * q2[0]) / q2[1], d = (dv2 - c * q2[0]) / q2[1]
  const s = a * a + b * b + c * c + d * d, t = Math.sqrt((a * a + b * b - c * c - d * d) ** 2 + 4 * (a * c + b * d) ** 2)
  return [Math.sqrt((s + t) / 2), Math.sqrt(Math.max(0, (s - t) / 2))]
}
`;

const TILT = `${SVD}
// A right triangle, tilted θ about the x axis, projected straight down: u = x, v = z.
// Predict first: σ₁/σ₂ at 60°.
for (const deg of [0, 30, 45, 60, 80]) {
  const th = deg * Math.PI / 180, tilt = ([x, y, z]) => [x, y * Math.cos(th) + z * Math.sin(th), -y * Math.sin(th) + z * Math.cos(th)]
  const P = [[0, 0, 0], [1, 0, 0], [0, 0, 1]].map(tilt), T = P.map(([x, , z]) => [x, z])
  const [s1, s2] = sigmas(P, T)
  console.log(deg + '°: σ₁ ' + r(s1) + ', σ₂ ' + r(s2) + ', σ₁/σ₂ ' + r(s1 / s2) + ' (1/cos θ = ' + r(1 / Math.cos(th)) + ')')
}`;

const WRAP = `${SVD}
// Cylindrical projection round the y axis: u = angle / 2π + ½ (0 … 1 round the axis), v = height.
// A 16-sided tube. The face between angles 157.5° and 180° sits next to the face that crosses ±180°.
const n = 16, turn = (x, z) => Math.atan2(z, x) / (2 * Math.PI) + 0.5
const ring = (k) => [Math.cos(2 * Math.PI * k / n + Math.PI / n), Math.sin(2 * Math.PI * k / n + Math.PI / n)]   // offset half a step
for (const k of [6, 7]) {
  const [a, b] = [ring(k), ring(k + 1)], us = [turn(...a), turn(...b)]
  const fixed = Math.max(...us) - Math.min(...us) > 0.5 ? us.map((u) => (u < 0.5 ? u + 1 : u)) : us
  console.log('face ' + k + ': u from ' + us.map(r).join(' to ') + ' (width ' + r(Math.abs(us[1] - us[0])) + '); after the fix ' + fixed.map(r).join(' to ') + ' (width ' + r(Math.abs(fixed[1] - fixed[0])) + ')')
}
console.log('one segment is ' + r(1 / n) + ' of a turn')`;

const SPHERE = `${SVD}
// A UV sphere (32 × 16), projected three ways. Predict first: which has the smallest worst stretch?
const S = 32, R = 16, V = [], T = []
for (let i = 0; i <= R; i++) for (let j = 0; j <= S; j++) { const a = Math.PI * i / R, b = 2 * Math.PI * j / S; V.push([Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)]) }
const at = (i, j) => i * (S + 1) + j
for (let i = 0; i < R; i++) for (let j = 0; j < S; j++) { if (i > 0) T.push([at(i, j), at(i, j + 1), at(i + 1, j + 1)]); if (i < R - 1) T.push([at(i, j), at(i + 1, j + 1), at(i + 1, j)]) }
// (The extra column j = S repeats j = 0 with its own vertices: the sphere's seam, so the cylinder needs no wrap fix.)
const ways = {
  'from above': (p) => [p[0], p[2]],
  'around (cylinder)': (p, j) => [j / S * 2 * Math.PI, p[1]],
  'box (by the normal)': (p, _, n) => { const k = [0, 1, 2].reduce((b, i) => (Math.abs(n[i]) > Math.abs(n[b]) ? i : b), 0); return [p[(k + 1) % 3], p[(k + 2) % 3]] },
}
for (const [name, f] of Object.entries(ways)) {
  const ratios = T.map((t) => {
    const P = t.map((i) => V[i]), n = unit(cross(sub(P[1], P[0]), sub(P[2], P[0])))
    const [s1, s2] = sigmas(P, t.map((i) => f(V[i], i % (S + 1), n)))
    return s2 > 1e-9 ? s1 / s2 : Infinity
  }).sort((a, b) => a - b)
  console.log(name + ': median ' + r(ratios[ratios.length >> 1]) + ', 95% of faces under ' + r(ratios[Math.floor(0.95 * ratios.length)]) + ', worst ' + (Number.isFinite(ratios.at(-1)) ? r(ratios.at(-1)) : 'infinite'))
}`;

const PICTURE = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
// A unit sphere drawn pixel by pixel, three times. Each pixel's point on the sphere is projected to UV and coloured
// by a 12 × 12 checker: from above (left), around the y axis (middle), and box projection by the normal (right).
const canvas = document.createElement('canvas'), W = 390, H = 160
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'), img = g.createImageData(W * 2, H * 2)
const tilt = 0.45, ct = Math.cos(tilt), st = Math.sin(tilt)                       // seen from a little above
const checker = (u, v) => ((Math.floor(u * 12) + Math.floor(v * 12)) % 2 + 2) % 2 === 0
const proj = [
  (p) => [(p[0] + 1) / 2, (p[2] + 1) / 2],
  (p) => [Math.atan2(p[2], p[0]) / (2 * Math.PI) + 0.5, (p[1] + 1) / (2 * Math.PI)],     // u and v both in turns of the equator
  (p) => { const k = [0, 1, 2].reduce((b, i) => (Math.abs(p[i]) > Math.abs(p[b]) ? i : b), 0); return [(p[(k + 1) % 3] + 1) / 2, (p[(k + 2) % 3] + 1) / 2] },
]
let lit = 0
for (let py = 0; py < H * 2; py++) for (let px = 0; px < W * 2; px++) {
  const k = Math.floor(px / (W * 2 / 3)), cx = (k + 0.5) * W * 2 / 3, cy = H - 8, R = H * 0.74
  const x = (px - cx) / R, y = (cy - py) / R, i = (py * W * 2 + px) * 4
  if (x * x + y * y > 1) { img.data.set([15, 25, 35, 255], i); continue }
  const z = Math.sqrt(1 - x * x - y * y)
  const p = [x, y * ct + z * st, -y * st + z * ct]                                 // view → sphere
  const [u, v] = proj[k](p), shade = 0.55 + 0.45 * z
  const c = checker(u, v) ? [235, 235, 235] : [70, 110, 220]
  img.data.set([c[0] * shade, c[1] * shade, c[2] * shade, 255], i); lit++
}
g.putImageData(img, 0, 0)
g.scale(2, 2); g.fillStyle = '#cbd5e1'; g.font = '11px sans-serif'; g.textAlign = 'center'
;['from above', 'around', 'box'].forEach((t, k) => g.fillText(t, (k + 0.5) * W / 3, H - 4))
console.log('pixels on the spheres: ' + lit)`;

const CHALLENGE = `// A roof is a flat rectangle sloping at 30° from horizontal. Its UVs are projected straight down from above, and it
// carries a square checker. How many times longer than wide do the checker squares look, measured on the roof?
const ratio = 0
console.log(ratio)`;

const SOLVED = CHALLENGE.replace('const ratio = 0', 'const ratio = 1 / Math.cos(Math.PI / 6)');

/** The challenge's check: σ₁/σ₂ = 1/cos 30° = 1.1547 (the slope direction is squashed by cos 30° in UV). */
export function checkRoof(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+ratio\s*=\s*([^\n]+)/);
  if (!m) return no('Keep the line const ratio = …, with a number or an expression.');
  // Only arithmetic and a few Math functions are evaluated: this runs in the page, not the cell's sandbox.
  const expr = m[1].replace(/\/\/.*$/, '').trim().replace(/;$/, '');
  if (!/^[\d.,\s+\-*/()]*$/.test(expr.replace(/Math\.(sqrt|cos|sin|tan|PI)|\*\*/g, ''))) return no('Write the ratio as a number, or arithmetic with Math.cos, Math.sin, Math.tan, Math.sqrt and Math.PI.');
  let v;
  try { v = Number(new Function('return (' + expr + ')')()); } catch { return no('That expression did not run.'); }
  if (!Number.isFinite(v)) return no('The ratio must be a number.');
  const near = (x) => Math.abs(v - x) < 1e-3;
  if (near(1 / Math.cos(Math.PI / 6))) return { pass: true, message: `${+v.toFixed(4)}: projecting from above keeps the roof's width but squashes its slope by cos 30° = 0.866. A UV square therefore covers 1/0.866 = 1.1547 times as much roof along the slope as across it: σ₁/σ₂ = 1/cos 30°.` };
  if (v === 0) return no('Along the slope, how much shorter is the roof\'s projection than the roof itself?');
  if (near(Math.cos(Math.PI / 6))) return no('0.866 is how much the slope shrinks in UV. A square in UV then stretches on the roof the other way: 1 / 0.866.');
  if (near(2)) return no('2 is 1/sin 30°. The tilt from horizontal is 30°, and projecting down keeps the cosine of it.');
  if (near(Math.tan(Math.PI / 6)) || near(1 / Math.tan(Math.PI / 6))) return no('The tangent is the roof\'s rise over run. The projection shortens the slope by the cosine.');
  if (near(1 / Math.cos(30))) return no('Math.cos takes radians: 30° is Math.PI / 6.');
  return no(`${+v.toFixed(4)} is not right. How long is one unit of roof slope after projecting it onto the ground?`);
}

export default {
  id: 'modelling-geometry-8-003',
  slug: 'projection',
  chapter: 'modelling-geometry',
  order: 3,
  title: 'Projection',
  subtitle: 'The quickest UVs: drop a coordinate, or use the angle round an axis. What they cost on steep faces, and the wrap-around line.',
  tags: ['uv', 'projection', 'planar', 'cylindrical', 'box mapping', 'triplanar', 'stretching', 'distortion'],
  coreConcept: 'Projection makes UVs without seams or solving: planar projection keeps two coordinates (from above, u = x and v = z); cylindrical projection uses the angle round an axis for u and the height for v; box projection gives each face the planar projection along its normal\'s largest axis. A face tilted θ away from the projection plane keeps its width but is squashed by cos θ, so its angle distortion σ₁/σ₂ is 1/cos θ, unbounded for faces seen edge-on. A cylindrical map wraps: faces across the line where the angle restarts need their low u values moved up by one turn.',
  prerequisites: ['modelling-geometry-8-002', 'modelling-geometry-3-002'],
  timeToComplete: 35,
  nextLesson: 'modelling-geometry-8-004',

  hook: {
    question: 'Texture a landscape by taking its UVs straight from the map: u is east, v is north. It looks perfect on the fields, and terrible on the cliffs, where the grass stretches into streaks. Why there, and what are the other quick ways to give a model UVs?',
    realWorldContext: 'Terrain is textured by planar projection from above; pipes, bottles and tree trunks by cylindrical projection; architecture and rocks by box (triplanar) projection, often computed in the shader with no UVs at all. Decals and projectors in games are planar projections from a camera.',
  },

  intuition: {
    prose: [
      'The quickest UV map is a **projection**: forget one direction. From above, $u = x$ and $v = z$ (fitted into the square), as if the texture were shone straight down like a slide projector. No seams, no solving, and on a flat field it is perfect.',
      'On a slope it is not. A face tilted $\\theta$ from horizontal keeps its width across the slope, but its length down the slope shrinks to $\\cos\\theta$ of itself in UV. A square of texture therefore covers $1/\\cos\\theta$ times as much surface down the slope as across it. Before running cell 1, predict the stretch $\\sigma_1/\\sigma_2$ at $60°$: $1/\\cos 60° = 2$. At $90°$ (a vertical wall) the face collapses to a line.',
      'For things built round an axis, project **around** it: $u$ is the angle (as a fraction of a turn) and $v$ the height. A tube\'s sides map without stretch, like a label peeled off a can. But the angle restarts after a full turn, so a face straddling that line would have one corner near $u = 1$ and the next near $u = 0$ and smear across the whole texture. Before running cell 2, predict the straddling face\'s width before and after moving its low $u$ up by one: $0.9375$, then $0.0625$, one segment.',
      '**Box projection** gives each face the planar projection along whichever axis its normal points most: tops from above, sides from the front or the side. The worst case is a face pointing diagonally, at $54.7°$ to all three axes, where $1/\\cos$ is $\\sqrt3 = 1.73$. Before running cell 3, predict which of the three projections stretches a sphere least in its worst places.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Projected UVs',
        body: 'Step 1. Choose the projection: planar (a direction), cylindrical (an axis), or box (per face, by its normal).\nStep 2. Planar: keep the two coordinates across the direction. Cylindrical: u = angle / 2π + ½, v = height along the axis.\nStep 3. Fit to the square with one scale for both, so squares stay square (cylindrical: measure u in arc length, 2πR per turn).\nStep 4. Cylindrical: for each face spanning more than half a turn in u, add 1 to its corners below ½.\nStep 5. Check the stretch: 1/cos θ for a face tilted θ from the projection plane.',
      },
      {
        type: 'warning',
        title: 'Edge-on faces collapse',
        body: 'A face parallel to the projection direction (a wall under a top-down projection, a lid under a cylindrical one) maps to a line: every texel along it is the same. Give those faces their own projection, or unwrap them (lesson 8.4).',
      },
      {
        type: 'warning',
        title: 'Scale u and v together',
        body: 'Fitting u and v into the square separately turns squares into rectangles. A cylinder\'s u goes once round (2πR of surface) and v up its height: use one scale for both.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: stretching on steep faces',
        body: 'Projected textures streak on steep faces. Shaders hide it with triplanar mapping: sample the texture three times (from x, y and z) and blend by the normal, so no face is ever seen edge-on.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "one projection fits every shape". From above (left) the checker is clean on top and streaks at the sides; around (middle) the squares are square at the equator and pinch into slivers towards the poles; box (right) is never worse than √3 but has visible joins.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'sigmas() measures the stretch (lesson 8.5 explains it); the tilt loop checks 1/cos θ; the wrap fix is the u < 0.5 ? u + 1 : u line; the box projection picks the largest |n|.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'A projection is cheap enough to do per pixel in the fragment shader, with no UVs stored at all: world position in, texture coordinates out. That is how terrain and triplanar materials work.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'UV › Project from above and UV › Project around (cylinder). With Record traces on each is traced: the axis and scale, one vertex\'s UV (predict it), the wrap-around faces, and the stretch on every face. UV › Angle distortion heat map shows where it stretches. In a script: mesh.unwrap({ method: "planar" }) or { method: "cylinder" }.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: projected UVs',
        caption: 'Stretch against tilt, the cylinder\'s wrap line, three projections of a sphere, and the checker drawn pixel by pixel.',
        props: {
          lesson: {
            title: 'Projection',
            subtitle: 'From above, around, and by the normal.',
            cells: [
              { type: 'js', instruction: '### 1. Stretch against tilt\nPredict first: σ₁/σ₂ at 60°.', startCode: TILT },
              { type: 'js', instruction: '### 2. The wrap line\nPredict first: the straddling face\'s width before and after.', startCode: WRAP },
              { type: 'js', instruction: '### 3. A sphere, three ways\nPredict first: which has the smallest worst stretch?', startCode: SPHERE },
              { type: 'js', instruction: '### 4. See it\nThe checker on a sphere: from above, around, box.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 240 },
              { type: 'challenge', instruction: '### 5. Challenge: a sloping roof\nThe check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkRoof },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Projecting UVs" in MeshLab](#/lab/mesh-lab?project=uv-projection). A cliff projected from above and a pillar projected around; the pillar\'s projection is traced: press Play, and predict one vertex\'s UV.' },
              { type: 'markdown', instruction: '### Use the tool\n- **UV › Project from above** and **UV › Project around (cylinder)**; then **UV › Angle distortion heat map**.\n- In a script: `mesh.unwrap({ method: "planar" })`, `mesh.unwrap({ method: "cylinder" })`, `mesh.uvDistortion()`.\n- [Open "Low-poly island"](#/lab/mesh-lab?project=island): its grass is projected from above.\n- **Elsewhere:** Blender\'s Project from View, Cylinder Projection and Cube Projection; triplanar nodes in shader editors.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Planar projection** along a unit direction $d$: choose two unit vectors $a, b$ with $a, b, d$ orthonormal; $u = (p \\cdot a - u_0)/s$, $v = (p \\cdot b - v_0)/s$ with one scale $s$ for both.',
      '**Stretch.** On a face with unit normal $n$ at angle $\\theta$ to $d$ (so $|n \\cdot d| = \\cos\\theta$), the projection keeps lengths along the line where the face meets the projection plane and multiplies lengths across it by $\\cos\\theta$. Its Jacobian has singular values $1/s$ and $\\cos\\theta/s$, so $\\sigma_1/\\sigma_2 = 1/\\cos\\theta$, and the area shrinks by $\\cos\\theta$.',
      '**Cylindrical projection** about the y axis: $u = (\\operatorname{atan2}(z, x)/2\\pi + \\tfrac12)\\cdot 2\\pi R / s$, $v = (y - y_0)/s$. On a cylinder of radius $R$ it is an isometry (up to scale): no stretch at all. The angle is discontinuous where $\\operatorname{atan2}$ jumps, so faces straddling it are fixed by adding a whole turn.',
      '**Box projection** chooses $d$ per face as the axis maximising $|n_i|$. Then $\\cos\\theta = \\max_i |n_i| \\ge 1/\\sqrt3$, so the stretch is at most $\\sqrt3$.',
    ],
    equations: [
      { label: 'Planar', latex: 'u = \\frac{x - x_0}{s}, \\quad v = \\frac{z - z_0}{s}' },
      { label: 'Stretch', latex: '\\frac{\\sigma_1}{\\sigma_2} = \\frac{1}{\\cos\\theta}' },
      { label: 'Cylindrical', latex: 'u = \\Big(\\frac{\\operatorname{atan2}(z, x)}{2\\pi} + \\tfrac12\\Big)\\frac{2\\pi R}{s}, \\quad v = \\frac{y - y_0}{s}' },
      { label: 'Box bound', latex: '\\max_i |n_i| \\ge \\frac{1}{\\sqrt3}' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** A linear projection P restricted to a face with normal n has singular values 1 and |n · d| (for unit d); it is conformal on the face iff the face is perpendicular to d, and degenerate iff n · d = 0. A cylindrical projection restricted to the cylinder of radius R about its axis is an isometry onto a strip of width 2πR, discontinuous along one ruling.',
      '**Invariant viewpoint.** Moving the object changes a projection\'s UVs unless the projection moves with it: projecting in world space makes the texture slide across a moving object, so projections are computed in the object\'s own space and then stored.',
      '**Geometric picture.** A slide projector shines the texture onto the model. Wherever the surface faces the projector the picture lands sharp and square; where it turns away the picture smears out along it.',
      '**Where this goes.** Lesson 8.4 replaces projection with a map that keeps angles everywhere on a disc (LSCM); lesson 8.5 measures stretch on any map.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-8-003-ex1',
      title: 'A 45° ramp',
      problem: 'A ramp at 45° is projected from above. What is its stretch?',
      steps: [{ expression: '1/\\cos 45° = \\sqrt2 = 1.414', annotation: 'Width kept; slope shortened by cos 45°.' }],
      conclusion: '1.414: squares look 41% longer down the ramp.',
    },
    {
      id: 'modelling-geometry-8-003-ex2',
      title: 'A can\'s label',
      problem: 'A can of radius 3 cm and height 10 cm is projected around its axis. In the same units, how wide and tall is its UV strip?',
      steps: [{ expression: '2\\pi \\cdot 3 = 18.85, \\; 10', annotation: 'u in arc length, v in height.' }],
      conclusion: '18.85 by 10, scaled by the larger, 18.85: u from 0 to 1, v from 0 to 0.53.',
    },
    {
      id: 'modelling-geometry-8-003-ex3',
      title: 'Box projection\'s worst face',
      problem: 'A face\'s normal is $(0.6, 0.64, 0.48)$. Which axis does box projection use, and what is the stretch?',
      steps: [{ expression: '\\max |n_i| = 0.64 \\Rightarrow y', annotation: 'Project from above.' }, { expression: '1/0.64 = 1.5625', annotation: '1/cos θ.' }],
      conclusion: 'From above (y), stretch 1.5625.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-8-003-ch1',
      difficulty: 'easy',
      problem: 'Why does a top-down projection leave a vertical wall\'s texture as stripes?',
      walkthrough: [{ expression: '\\cos 90° = 0', annotation: 'The wall maps to a line.' }],
      answer: 'Every point of the wall straight above another has the same (x, z), so the whole height of the wall reads one line of texels: vertical stripes.',
    },
    {
      id: 'modelling-geometry-8-003-ch2',
      difficulty: 'medium',
      problem: 'In cylindrical projection, why does a face across the wrap line get one corner near u = 1 and one near u = 0, and why does adding 1 fix it?',
      walkthrough: [
        { expression: '\\operatorname{atan2} \\text{ jumps from } \\pi \\text{ to } -\\pi', annotation: 'u jumps from 1 to 0.' },
      ],
      answer: 'The angle restarts after a full turn, so neighbouring corners on either side of the line get u ≈ 1 and u ≈ 0, and the face spans the whole texture. Adding 1 to the low corners puts them just past 1; with the texture repeating, u = 1.02 reads the same texels as 0.02, and the face is narrow again.',
    },
    {
      id: 'modelling-geometry-8-003-ch3',
      difficulty: 'hard',
      problem: 'Prove that box projection never stretches a face by more than √3.',
      walkthrough: [
        { expression: 'n_x^2 + n_y^2 + n_z^2 = 1', annotation: 'A unit normal.' },
        { expression: '\\max_i n_i^2 \\ge \\tfrac13', annotation: 'The largest of three numbers summing to 1.' },
        { expression: '\\frac{1}{\\cos\\theta} = \\frac{1}{\\max_i |n_i|} \\le \\sqrt3', annotation: 'Stretch.' },
      ],
      answer: 'The three squared components of a unit normal add to 1, so the largest is at least 1/3 and its absolute value at least 1/√3. Box projection projects along that axis, where cos θ = max |nᵢ| ≥ 1/√3, so the stretch 1/cos θ ≤ √3, reached by faces pointing along a cube\'s diagonal.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'd', meaning: 'The projection direction.' },
      { symbol: '\\theta', meaning: 'A face\'s tilt from the projection plane (the angle between n and d).' },
      { symbol: '1/\\cos\\theta', meaning: 'The stretch σ₁/σ₂ of a planar projection on that face.' },
      { symbol: 'u = \\operatorname{atan2}(z, x)/2\\pi + \\tfrac12', meaning: 'Cylindrical u: the fraction of a turn.' },
      { symbol: '\\max_i |n_i|', meaning: 'Box projection\'s chosen axis, and its cos θ.' },
      { symbol: '\\sqrt3', meaning: 'Box projection\'s worst stretch.' },
    ],
    rulesOfThumb: [
      'Project where the surface faces you.',
      'Stretch is 1/cos θ.',
      'Cylinders: scale u by 2πR, fix the wrap.',
      'Box projection: never worse than √3.',
      'Edge-on faces need another method.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-8-002', label: 'Seams and charts', note: 'The other way to flatten: cut first.' },
      { lessonId: 'modelling-geometry-3-002', label: 'Projection (the camera)', note: 'The same idea, from 3D to the screen.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-8-004', label: 'Conformal maps and LSCM', note: 'Keeping angles everywhere on a disc.' },
      { lessonId: 'modelling-geometry-8-005', label: 'Measuring distortion', note: 'σ₁ and σ₂ in full.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-8-003-1', label: 'Read planar projection and its 1/cos θ stretch', type: 'read' },
    { id: 'cp-modelling-geometry-8-003-2', label: 'Read cylindrical projection and the wrap line', type: 'read' },
    { id: 'cp-modelling-geometry-8-003-3', label: 'Read box projection and its √3 bound', type: 'read' },
    { id: 'cp-modelling-geometry-8-003-4', label: 'Run cells 1 to 3: tilt, wrap, a sphere three ways', type: 'lab' },
    { id: 'cp-modelling-geometry-8-003-5', label: 'Trace a cylindrical projection in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-8-003-6', label: 'Work through example 1, a 45° ramp', type: 'example' },
    { id: 'cp-modelling-geometry-8-003-7', label: 'Work through example 3, box projection\'s worst face', type: 'example' },
    { id: 'cp-modelling-geometry-8-003-8', label: 'Complete the challenge: a sloping roof', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-8-003-assess-1',
        type: 'choice',
        text: 'Projected from above, a face tilted 60° from horizontal is stretched by:',
        options: ['2', '1.5', '0.5', '1.155'],
        answer: '2',
        hint: '1/cos 60°.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-8-003-quiz-1',
      type: 'choice',
      text: 'A face tilted θ from the projection plane has angle distortion:',
      options: ['1/cos θ', 'cos θ', '1/sin θ', 'tan θ'],
      answer: '1/cos θ',
      hints: ['Cell 1.', 'Width kept, length times cos θ.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-8-003-quiz-2',
      type: 'choice',
      text: 'Under a top-down projection, a vertical wall:',
      options: ['Collapses to a line', 'Is perfect', 'Is stretched 2 : 1', 'Is mirrored'],
      answer: 'Collapses to a line',
      hints: ['cos 90° = 0.', 'Warning "Edge-on faces collapse".'],
      reviewSection: 'Warning "Edge-on faces collapse"',
    },
    {
      id: 'modelling-geometry-8-003-quiz-3',
      type: 'choice',
      text: 'In a 16-sided tube, the face across the wrap line has u width, before the fix:',
      options: ['0.9375', '0.0625', '0.5', '1'],
      answer: '0.9375',
      hints: ['Cell 2.', 'One corner near 1, the other near 0.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-8-003-quiz-4',
      type: 'choice',
      text: 'Box projection\'s worst stretch is:',
      options: ['√3 ≈ 1.73', '2', '√2', 'Unbounded'],
      answer: '√3 ≈ 1.73',
      hints: ['Cell 3.', 'Challenge 3.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-8-003-quiz-5',
      type: 'choice',
      text: 'Cylindrical projection on a perfect cylinder\'s sides:',
      options: ['Keeps every angle and length (up to scale)', 'Stretches 2 : 1', 'Collapses them', 'Mirrors them'],
      answer: 'Keeps every angle and length (up to scale)',
      hints: ['The can\'s label.', 'Math, Cylindrical projection.'],
      reviewSection: 'Math',
    },
    {
      id: 'modelling-geometry-8-003-quiz-6',
      type: 'choice',
      text: 'Why measure a cylinder\'s u in arc length (2πR per turn)?',
      options: ['So u and v use the same units and squares stay square', 'To avoid the wrap line', 'Because the texture is square', 'It does not matter'],
      answer: 'So u and v use the same units and squares stay square',
      hints: ['Warning "Scale u and v together".', 'Example 2.'],
      reviewSection: 'Warning "Scale u and v together"',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'One projection fits every shape.',
      whyStudentsThinkIt: 'Each works perfectly on its own test shape.',
      correctionExample: 'The picture: from above streaks the sides, around crowds the poles, box shows joins.',
      contrastCase: 'Terrain (from above) and pipes (around) do suit one projection each.',
    },
    {
      falseBelief: 'A steeper face just shows less of the texture.',
      whyStudentsThinkIt: 'It is seen at a slant.',
      correctionExample: 'Cell 1: it shows the same width of texture stretched over more surface, 2 : 1 at 60°.',
      contrastCase: 'A face perpendicular to the projection shows the texture undistorted.',
    },
    {
      falseBelief: 'The wrap line is a bug in the projection.',
      whyStudentsThinkIt: 'The texture jumps there.',
      correctionExample: 'Cell 2: the angle must restart somewhere; the fix keeps faces narrow, and the line is a seam like any other.',
      contrastCase: 'A planar projection has no wrap line.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A rocky terrain must be textured without visible streaks on its cliffs, and without unwrapping.',
      competingTechniques: ['Planar projection from above', 'Triplanar (box) projection blended by the normal'],
      whyThisTechniqueWins: 'Triplanar never sees a face at more than 54.7°, so the stretch is at most √3, and blending hides the joins.',
    },
    {
      situation: 'A bottle\'s label must wrap round it without distortion.',
      competingTechniques: ['Planar projection from the front', 'Cylindrical projection about the bottle\'s axis'],
      whyThisTechniqueWins: 'The bottle\'s sides are close to a cylinder, where cylindrical projection is an isometry; from the front, the sides turn edge-on and stretch.',
    },
  ],

  debugging: [
    {
      commonError: 'Fitting u and v to [0, 1] separately.',
      symptom: 'Checker squares are rectangles everywhere.',
      whyItHappened: 'Different scales on u and v.',
      repairStrategy: 'Use one scale: the larger of the two extents.',
    },
    {
      commonError: 'No wrap fix in a cylindrical projection.',
      symptom: 'One column of faces shows the whole texture squeezed backwards.',
      whyItHappened: 'Its corners have u near 1 and near 0.',
      repairStrategy: 'For faces spanning more than half a turn, add 1 to the corners below ½.',
    },
    {
      commonError: 'Projecting in world space for a moving object.',
      symptom: 'The texture slides across the object as it moves.',
      whyItHappened: 'The projection did not move with the object.',
      repairStrategy: 'Project in object space, once, and store the UVs.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Project UVs from above, around an axis and per face, and predict the stretch.',
    explainVerbally: 'Explain 1/cos θ, the wrap line and box projection\'s bound.',
    detectIncorrectApplication: 'Recognise separate scales, missing wrap fixes and edge-on collapse.',
    transferToUnfamiliar: 'Choose a projection for terrain, pipes, buildings and decals.',
  },
};
