// Lesson 10.4: slerp. Interpolating rotations: blending Euler angles component by component takes a curving, usually
// longer path; blending quaternions straight (lerp) cuts through the sphere and speeds up in the middle; slerp moves
// along the great circle at constant angular speed: q(s) = sin((1−s)θ)/sin θ · q₀ + sin(sθ)/sin θ · q₁. If q₀·q₁ < 0,
// negate q₁ first so it takes the short way.

const QUAT = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const dot4 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
const norm4 = (q) => { const l = Math.hypot(...q); return q.map((x) => x / l) }
const fromAxisAngle = (a, deg) => { const h = deg * Math.PI / 360, s = Math.sin(h); return [a[0] * s, a[1] * s, a[2] * s, Math.cos(h)] }
const mul = (p, q) => [p[3] * q[0] + q[3] * p[0] + p[1] * q[2] - p[2] * q[1], p[3] * q[1] + q[3] * p[1] + p[2] * q[0] - p[0] * q[2], p[3] * q[2] + q[3] * p[2] + p[0] * q[1] - p[1] * q[0], p[3] * q[3] - p[0] * q[0] - p[1] * q[1] - p[2] * q[2]]
// Euler (x, y, z) in degrees to a quaternion: qx · qy · qz (three.js's XYZ order).
const fromEuler = (x, y, z) => mul(mul(fromAxisAngle([1, 0, 0], x), fromAxisAngle([0, 1, 0], y)), fromAxisAngle([0, 0, 1], z))
// The angle of the turn between two orientations, in degrees.
const turnBetween = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(dot4(a, b)))) * 180 / Math.PI
function slerp(a, b, s) {
  let d = dot4(a, b)
  if (d < 0) { b = b.map((x) => -x); d = -d }          // the short way round
  const th = Math.acos(Math.min(1, d))
  if (th < 1e-6) return norm4(a.map((x, i) => (1 - s) * x + s * b[i]))
  return a.map((x, i) => (Math.sin((1 - s) * th) * x + Math.sin(s * th) * b[i]) / Math.sin(th))
}
const lerp = (a, b, s) => norm4(a.map((x, i) => (1 - s) * x + s * b[i]))
`;

const EVEN = `${QUAT}
// From upright to a tumble of (0°, 150°, 120°), in 4 equal steps. How far does each step turn, and how much turning
// is that in all? Predict first: which method is both even and shortest?
const q0 = fromEuler(0, 0, 0), q1 = fromEuler(0, 150, 120)
const methods = {
  'Euler angles': (s) => fromEuler(0, 150 * s, 120 * s),
  'lerp (straight)': (s) => lerp(q0, q1, s),
  slerp: (s) => slerp(q0, q1, s),
}
for (const [name, f] of Object.entries(methods)) {
  const steps = [0, 1, 2, 3].map((k) => r(turnBetween(f(k / 4), f((k + 1) / 4))))
  console.log(name.padEnd(16) + ' turns per step: ' + steps.join('°, ') + '°; in all ' + r(steps.reduce((a, b) => a + b)) + '°')
}
console.log('the end is ' + r(turnBetween(q0, q1)) + '° from the start: no route can turn less')`;

const SHORT = `${QUAT}
// From 0° to 300° about y. The short way is 60° backwards. Predict first: with and without the sign check, which way?
const q0 = fromAxisAngle([0, 1, 0], 0), q1 = fromAxisAngle([0, 1, 0], 300)
console.log('q₀·q₁ = ' + r(dot4(q0, q1)) + (dot4(q0, q1) < 0 ? ': negative, so −q₁ is nearer' : ''))
const noCheck = (a, b, s) => { const th = Math.acos(Math.min(1, dot4(a, b))); return a.map((x, i) => (Math.sin((1 - s) * th) * x + Math.sin(s * th) * b[i]) / Math.sin(th)) }
const angleY = (q) => r(2 * Math.atan2(q[1], q[3]) * 180 / Math.PI)
console.log('halfway, without the check: y = ' + angleY(noCheck(q0, q1, 0.5)) + '°  (the long way: 150°)')
console.log('halfway, with the check:    y = ' + angleY(slerp(q0, q1, 0.5)) + '°  (the short way: −30°, same as 330°)')`;

const WEIGHTS = `${QUAT}
// The weights on q₀ and q₁. Predict first: at s = ½ for θ = 60°, are they ½ and ½?
for (const deg of [10, 60, 120, 170]) {
  const th = deg * Math.PI / 180, w = Math.sin(0.5 * th) / Math.sin(th)
  console.log('θ = ' + deg + '°: weights at s = ½ are ' + r(w) + ' and ' + r(w) + ' (sum ' + r(2 * w) + ')')
}`;

const PICTURE = `${QUAT}
// The tip of an arrow (pointing along z) during the turn from upright to (0°, 150°, 120°), every 1/12 of the way,
// seen from above: Euler angles (red) curve off along a longer route; slerp (green) follows one even arc.
const rot = (q, p) => { const t = mul(mul(q, [p[0], p[1], p[2], 0]), [-q[0], -q[1], -q[2], q[3]]); return t.slice(0, 3) }
const q0 = fromEuler(0, 0, 0), q1 = fromEuler(0, 150, 120)
const canvas = document.createElement('canvas'), W = 320, H = 260
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'); g.scale(2, 2); g.fillStyle = '#0f1923'; g.fillRect(0, 0, W, H)
const P = (p) => [W / 2 + 100 * p[0], H / 2 + 100 * p[2]]
g.strokeStyle = '#334155'; g.beginPath(); g.arc(W / 2, H / 2, 100, 0, 2 * Math.PI); g.stroke()
for (const [colour, f] of [['#f87171', (s) => fromEuler(0, 150 * s, 120 * s)], ['#4ade80', (s) => slerp(q0, q1, s)]]) {
  g.fillStyle = colour
  for (let k = 0; k <= 12; k++) { const [x, y] = P(rot(f(k / 12), [0, 0, 1])); g.beginPath(); g.arc(x, y, 3.5, 0, 2 * Math.PI); g.fill() }
}
g.fillStyle = '#cbd5e1'; g.font = '11px sans-serif'; g.fillText('red: Euler angles   green: slerp', 8, H - 8)
console.log('drawn: 13 positions each')`;

const CHALLENGE = `// Two orientations are θ = 90° apart on the 4D sphere (a 180° turn). At s = 0.25, what weight does slerp put on q₁?
const weight = 0
console.log(weight)`;

const SOLVED = CHALLENGE.replace('const weight = 0', 'const weight = Math.sin(0.25 * Math.PI / 2) / Math.sin(Math.PI / 2)');

/** The challenge's check: sin(22.5°)/sin(90°) = 0.3827. */
export function checkSlerpWeight(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+weight\s*=\s*([^\n]+)/);
  if (!m) return no('Keep the line const weight = …, with a number or an expression.');
  // Only arithmetic and a few Math functions are evaluated: this runs in the page, not the cell's sandbox.
  const e = m[1].replace(/\/\/.*$/, '').trim().replace(/;$/, '');
  if (!/^[\d.,\s+\-*/()]*$/.test(e.replace(/Math\.(sin|cos|PI)|\*\*/g, ''))) return no('Write the weight as a number, or arithmetic with Math.sin and Math.PI.');
  let v;
  try { v = Number(new Function('return (' + e + ')')()); } catch { return no('That expression did not run.'); }
  if (!Number.isFinite(v)) return no('The weight must be a number.');
  const near = (x) => Math.abs(v - x) < 1e-3;
  if (near(Math.sin(Math.PI / 8))) return { pass: true, message: `${+v.toFixed(4)}: sin(sθ)/sin θ = sin(22.5°)/sin(90°) = 0.383, more than lerp\'s 0.25, because the straight blend\'s chord runs inside the sphere and would slow the start of the turn.` };
  if (v === 0) return no('The weight on q₁ is sin(sθ)/sin θ.');
  if (near(0.25)) return no('0.25 is a straight blend\'s weight. Slerp uses sin(sθ)/sin θ.');
  if (near(Math.sin(0.25 * 90) / Math.sin(90))) return no('Math.sin takes radians: θ = π/2.');
  if (near(Math.sin(0.75 * Math.PI / 2))) return no('That is the weight on q₀, sin((1 − s)θ)/sin θ.');
  if (near(Math.sin(0.25 * Math.PI) / Math.sin(Math.PI))) return no('θ is the angle between the quaternions, 90°: half the 180° turn.');
  return no(`${+v.toFixed(4)}: sin(0.25 × 90°) / sin(90°).`);
}

export default {
  id: 'modelling-geometry-10-004',
  slug: 'slerp',
  chapter: 'modelling-geometry',
  order: 4,
  title: 'Slerp',
  subtitle: 'Turning smoothly from one orientation to another: why blending Euler angles goes wrong, and the great-circle blend that does not.',
  tags: ['animation', 'rotation', 'slerp', 'quaternions', 'interpolation', 'great circle'],
  coreConcept: 'Interpolating rotations by blending Euler angles component by component gives a curving path that is generally not the shortest (between the lesson\'s two keys it turns 191° to end 165° away). Blending quaternions in a straight line and renormalising (lerp) takes the right path but speeds up in the middle, because the straight chord runs inside the 4D sphere. Slerp follows the great circle between the two quaternions at constant angular speed: q(s) = sin((1 − s)θ)/sin θ · q₀ + sin(sθ)/sin θ · q₁ with cos θ = q₀·q₁. Because q and −q are the same orientation, q₁ is negated when q₀·q₁ < 0, so the turn takes the short way round.',
  prerequisites: ['modelling-geometry-10-003'],
  timeToComplete: 35,
  nextLesson: 'modelling-geometry-10-005',

  hook: {
    question: 'Key a camera to point at one thing, then at another, and blend the Euler angles between: the camera lurches, swings wide, and sometimes spins nearly all the way round. What does a smooth turn from one orientation to another actually look like, and how do you compute it?',
    realWorldContext: 'Slerp (Shoemake, 1985) interpolates bone rotations in every game engine and glTF player, aims cameras, blends animation poses, and smooths orientation data from phones and VR headsets.',
  },

  intuition: {
    prose: [
      'Euler angles are three separate turns, and blending them separately does not give a single turn about one axis: the object swings along a curving route. Before running cell 1, predict which of three methods, in four equal steps from upright to $(0°, 150°, 120°)$, is both even and shortest. Here the Euler blend is even, but it turns $191°$ in all to end up $165°$ away; a straight blend of quaternions is uneven; only slerp is both.',
      'Quaternions are points on the 4D unit sphere, and the shortest way from one orientation to another is the **great circle** between their quaternions. A straight blend, $(1 - s)q_0 + s q_1$, cuts across the inside of the sphere; after renormalising it lands on the right path but moves faster in the middle. **Slerp** walks the great circle at an even speed: $q(s) = \\frac{\\sin((1 - s)\\theta)}{\\sin\\theta} q_0 + \\frac{\\sin(s\\theta)}{\\sin\\theta} q_1$.',
      'Because $q$ and $-q$ are the same orientation, there are two great circles to choose from, one each way round. If $q_0\\cdot q_1 < 0$, the two are more than $90°$ apart on the sphere (a turn of more than $180°$), and negating $q_1$ gives the short way. Before running cell 2, predict which way a turn from $0°$ to $300°$ about $y$ goes with and without the check: the long way (through $150°$) without it, $60°$ backwards with it.',
      'Before running cell 3, predict the weights at $s = \\tfrac12$: not $\\tfrac12$ and $\\tfrac12$ but $\\sin(\\theta/2)/\\sin\\theta$ each, which adds up to more than 1 and pushes the midpoint back out onto the sphere.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Slerp from q₀ to q₁',
        body: 'Step 1. d = q₀·q₁. If d < 0, set q₁ ← −q₁ and d ← −d (the short way).\nStep 2. θ = acos(d), the angle between them on the 4D sphere (the turn is 2θ).\nStep 3. If θ is tiny, lerp and renormalise (sin θ ≈ 0).\nStep 4. q(s) = (sin((1 − s)θ) q₀ + sin(sθ) q₁) / sin θ.\nStep 5. Use s = ease(t) for eased keys (lesson 10.2).',
      },
      {
        type: 'warning',
        title: 'Check the sign',
        body: 'Without the q₀·q₁ < 0 test, interpolating between nearly equal orientations can spin almost a full turn the long way: the classic "wrist flip" in animation.',
      },
      {
        type: 'warning',
        title: 'Euler keys for big turns',
        body: 'Euler interpolation is fine for small turns about one axis (a door, a wheel). For turns about several axes, or more than about 90°, use quaternion keys.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: smooth turns',
        body: 'A turn that changes speed reads as a jerk; one that swings wide reads as a wobble. Slerp\'s constant angular speed is what makes camera moves and limb rotations look deliberate.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "the same start and end means the same turn". Both sets of dots start and end at the same place. The Euler ones (red) take a different, curving route; the slerp ones (green) are evenly spaced along one arc.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'slerp() is the procedure: the sign flip is Step 1, acos Step 2, the lerp fallback Step 3, the sine weights Step 4.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Slerp runs on the CPU per bone per frame; the result becomes a matrix (or stays a quaternion for dual-quaternion skinning, lesson 11.7). glTF players slerp rotation channels between samples.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Set the Timeline\'s rotation mode to quaternion; Object › Trace sampling the keys then shows the quaternions, the shortest-path check, the weights (predict the weight on q₁) and the result. In a script: obj.rotationMode = "quaternion", obj.traceSample("rotation", f).' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: slerp',
        caption: 'Even steps, the short way round, the weights, and two paths of an arrow\'s tip.',
        props: {
          lesson: {
            title: 'Slerp',
            subtitle: 'Along the great circle.',
            cells: [
              { type: 'js', instruction: '### 1. Even steps\nPredict first: which method turns evenly?', startCode: EVEN },
              { type: 'js', instruction: '### 2. The short way\nPredict first: halfway from 0° to 300°.', startCode: SHORT },
              { type: 'js', instruction: '### 3. The weights\nPredict first: are they ½ and ½?', startCode: WEIGHTS },
              { type: 'js', instruction: '### 4. See it\nAn arrow\'s tip, two ways.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 310 },
              { type: 'challenge', instruction: '### 5. Challenge: a weight\nThe check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkSlerpWeight },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Slerp" in MeshLab](#/lab/mesh-lab?project=slerp-turn). Two boxes, Euler and slerp, between the same keys; the slerp box is traced halfway: press Play, and predict the weight on q₁.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Timeline › rotation mode: quaternion.**\n- **Object › Trace sampling the keys** on a rotating object.\n- [Open "Euler vs slerp"](#/lab/mesh-lab?project=euler-vs-slerp) for a side-by-side.\n- **Elsewhere:** three.js Quaternion.slerp, Blender\'s quaternion rotation mode.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Slerp.** For unit $q_0, q_1$ with $\\cos\\theta = q_0\\cdot q_1 \\ge 0$: $q(s) = \\frac{\\sin((1-s)\\theta)}{\\sin\\theta} q_0 + \\frac{\\sin(s\\theta)}{\\sin\\theta} q_1$. It is the unit-speed great-circle arc through both, reparametrised to $s \\in [0, 1]$: $|q(s)| = 1$ and the angle from $q_0$ to $q(s)$ is $s\\theta$.',
      '**Constant angular speed.** The rotation from $q(s)$ to $q(s + \\delta)$ turns by $2\\delta\\theta$, independent of $s$. Lerp-and-normalise follows the same arc but its angle grows like $\\arctan$ of the chord parameter, fastest at $s = \\tfrac12$.',
      '**Shortest path.** $q_1$ and $-q_1$ are the same rotation; choosing the one with $q_0\\cdot q_1 \\ge 0$ makes $\\theta \\le 90°$, so the turn is at most $180°$, the shorter of the two ways.',
      '**Composition form.** Equivalently $q(s) = q_0\\,(q_0^{*} q_1)^s$: the relative rotation, raised to a fractional power (its angle scaled by $s$), applied after $q_0$.',
    ],
    equations: [
      { label: 'Slerp', latex: 'q(s) = \\frac{\\sin((1 - s)\\theta)}{\\sin\\theta}\\,q_0 + \\frac{\\sin(s\\theta)}{\\sin\\theta}\\,q_1' },
      { label: 'Angle', latex: '\\cos\\theta = q_0\\cdot q_1' },
      { label: 'Power form', latex: 'q(s) = q_0\\,(q_0^{*}q_1)^{s}' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** On S³ with the round metric, slerp is the constant-speed geodesic from q₀ to q₁; projected to SO(3) it is the constant-angular-velocity rotation about the fixed axis of q₀*q₁. With the sign chosen so q₀·q₁ ≥ 0 it is the minimal geodesic in SO(3).',
      '**Invariant viewpoint.** Slerp commutes with rotating the whole scene: slerp(r q₀, r q₁, s) = r slerp(q₀, q₁, s). Euler interpolation does not: it depends on which axes the angles are measured about.',
      '**Geometric picture.** On a globe, the shortest flight between two cities follows a great circle at a steady speed; slerp is that flight on the sphere of orientations.',
      '**Where this goes.** Lesson 10.5 composes interpolated rotations through a hierarchy; chapter 11 blends whole skeletons of them.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-10-004-ex1',
      title: 'Halfway weights',
      problem: 'θ = 60°. Weights at s = ½?',
      steps: [{ expression: '\\sin 30°/\\sin 60° = 0.5774', annotation: 'Each.' }],
      conclusion: '0.577 each: they add to 1.155, which pushes the blend back out to unit length.',
    },
    {
      id: 'modelling-geometry-10-004-ex2',
      title: 'The short way',
      problem: 'q₀·q₁ = −0.8. What does slerp do first?',
      steps: [{ expression: 'q_1 \\leftarrow -q_1, \\; \\cos\\theta = 0.8', annotation: 'θ = 36.87°.' }],
      conclusion: 'Negate q₁: the turn is then 2θ = 73.7°, the short way.',
    },
    {
      id: 'modelling-geometry-10-004-ex3',
      title: 'How far at a quarter',
      problem: 'A 120° turn by slerp. How far has it turned at s = 0.25?',
      steps: [{ expression: '0.25 \\times 120° = 30°', annotation: 'Constant angular speed.' }],
      conclusion: '30°.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-10-004-ch1',
      difficulty: 'easy',
      problem: 'Why does a straight blend of quaternions need renormalising?',
      walkthrough: [{ expression: '|(1 - s)q_0 + s q_1| < 1', annotation: 'The chord is inside the sphere.' }],
      answer: 'The straight line between two points on a sphere passes inside it, so the blend is shorter than 1 and would scale the object (q p q* scales by |q|²). Dividing by its length puts it back on the sphere, but unevenly spaced.',
    },
    {
      id: 'modelling-geometry-10-004-ch2',
      difficulty: 'medium',
      problem: 'Why does skipping the sign check sometimes produce a near-full spin?',
      walkthrough: [{ expression: 'q_0\\cdot q_1 < 0 \\Rightarrow \\theta > 90°', annotation: 'More than half a turn on the sphere.' }],
      answer: 'If q₁ happens to be stored as the far one of its pair, the great circle from q₀ to it is more than 90° on the sphere, a turn of more than 180°: the long way. Two orientations only 10° apart can then interpolate through 350°.',
    },
    {
      id: 'modelling-geometry-10-004-ch3',
      difficulty: 'hard',
      problem: 'Show that slerp\'s result has unit length.',
      walkthrough: [
        { expression: '|q(s)|^2 = \\frac{\\sin^2((1-s)\\theta) + \\sin^2(s\\theta) + 2\\sin((1-s)\\theta)\\sin(s\\theta)\\cos\\theta}{\\sin^2\\theta}', annotation: 'Expand with q₀·q₁ = cos θ.' },
        { expression: '= 1', annotation: 'The law of cosines for the triangle with angles (1 − s)θ and sθ.' },
      ],
      answer: 'Expanding |a q₀ + b q₁|² with |q₀| = |q₁| = 1 and q₀·q₁ = cos θ gives (a² + b² + 2ab cos θ) with a = sin((1 − s)θ)/sin θ, b = sin(sθ)/sin θ; a trigonometric identity (the sine rule in the triangle formed by q₀, q₁ and q(s) in their plane) makes it exactly 1.',
    },
  ],

  semantics: {
    core: [
      { symbol: '\\theta', meaning: 'The angle between the quaternions; the turn is 2θ.' },
      { symbol: 'q_0\\cdot q_1 < 0', meaning: 'The far representative: negate q₁.' },
      { symbol: '\\frac{\\sin(s\\theta)}{\\sin\\theta}', meaning: 'Slerp\'s weight on q₁.' },
      { symbol: '\\text{lerp}', meaning: 'The straight blend, renormalised: right path, uneven speed.' },
      { symbol: '\\text{great circle}', meaning: 'The shortest path on the sphere.' },
      { symbol: 'q_0 (q_0^* q_1)^s', meaning: 'The power form of slerp.' },
    ],
    rulesOfThumb: [
      'Interpolate orientations, not angles.',
      'Always check the sign.',
      'Slerp turns at constant speed.',
      'Lerp is close for small turns.',
      'Euler keys only for one-axis turns.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-10-003', label: 'Quaternions', note: 'The sphere slerp moves on.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-10-005', label: 'Motion through a hierarchy', note: 'Interpolated rotations composed down a chain.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-10-004-1', label: 'Read why Euler blending goes wrong', type: 'read' },
    { id: 'cp-modelling-geometry-10-004-2', label: 'Read the slerp formula', type: 'read' },
    { id: 'cp-modelling-geometry-10-004-3', label: 'Read the shortest-path sign check', type: 'read' },
    { id: 'cp-modelling-geometry-10-004-4', label: 'Run cells 1 to 3: even steps, short way, weights', type: 'lab' },
    { id: 'cp-modelling-geometry-10-004-5', label: 'Trace a slerp in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-10-004-6', label: 'Work through example 1, halfway weights', type: 'example' },
    { id: 'cp-modelling-geometry-10-004-7', label: 'Work through example 2, the short way', type: 'example' },
    { id: 'cp-modelling-geometry-10-004-8', label: 'Complete the challenge: a weight', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-10-004-assess-1',
        type: 'choice',
        text: 'Slerp of a 90° turn at s = ⅓ has turned:',
        options: ['30°', '45°', '22.5°', '33°'],
        answer: '30°',
        hint: 'Constant angular speed.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-10-004-quiz-1',
      type: 'choice',
      text: 'Which interpolation turns evenly and also takes the shortest route?',
      options: ['Slerp', 'Euler angles', 'Lerp', 'All three'],
      answer: 'Slerp',
      hints: ['Cell 1.', 'Euler is even here but turns 191° for a 165° change; lerp is uneven.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-10-004-quiz-2',
      type: 'choice',
      text: 'If q₀·q₁ < 0, slerp:',
      options: ['Negates q₁ first, to take the short way', 'Gives up', 'Negates q₀ and q₁', 'Takes the long way'],
      answer: 'Negates q₁ first, to take the short way',
      hints: ['Cell 2.', 'q and −q are the same orientation.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-10-004-quiz-3',
      type: 'choice',
      text: 'At s = ½, slerp\'s two weights:',
      options: ['Are equal and add to more than 1', 'Are ½ and ½', 'Add to less than 1', 'Are 1 and 0'],
      answer: 'Are equal and add to more than 1',
      hints: ['Cell 3.', 'sin(θ/2)/sin θ each.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-10-004-quiz-4',
      type: 'choice',
      text: 'Why does a renormalised straight blend speed up in the middle?',
      options: ['Its chord runs inside the sphere', 'It uses Euler angles', 'It forgets the sign', 'It doesn\'t'],
      answer: 'Its chord runs inside the sphere',
      hints: ['Challenge 1.', 'Math, Constant angular speed.'],
      reviewSection: 'Math',
    },
    {
      id: 'modelling-geometry-10-004-quiz-5',
      type: 'choice',
      text: 'Halfway from 0° to 300° about y, with the sign check, the object is at:',
      options: ['−30° (330°)', '150°', '0°', '300°'],
      answer: '−30° (330°)',
      hints: ['Cell 2.', '60° backwards, halved.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-10-004-quiz-6',
      type: 'choice',
      text: 'Euler-angle keys are fine for:',
      options: ['Small turns about one axis', 'Any turn', 'Turns over 180°', 'Camera tumbles'],
      answer: 'Small turns about one axis',
      hints: ['Warning "Euler keys for big turns".', 'A door.'],
      reviewSection: 'Warning "Euler keys for big turns"',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'Same start and end means the same turn.',
      whyStudentsThinkIt: 'The keys match.',
      correctionExample: 'Cell 1 and the picture: the Euler blend shares slerp\'s ends but turns 191° along the way to slerp\'s 165°.',
      contrastCase: 'For a turn about a single axis, Euler and slerp agree.',
    },
    {
      falseBelief: 'Blending quaternions is like blending positions.',
      whyStudentsThinkIt: 'They are just four numbers.',
      correctionExample: 'Cell 1: the straight blend must be renormalised and still moves unevenly.',
      contrastCase: 'For very small turns lerp and slerp are almost identical.',
    },
    {
      falseBelief: 'Slerp always turns the way the keys "say".',
      whyStudentsThinkIt: 'Keys at 0° and 300° suggest 300°.',
      correctionExample: 'Cell 2: slerp turns 60° backwards; orientations don\'t remember how many turns got there.',
      contrastCase: 'To spin 300° on purpose, add intermediate keys less than 180° apart.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A security camera must pan between two targets smoothly.',
      competingTechniques: ['Blend its pan and tilt angles', 'Slerp its orientation'],
      whyThisTechniqueWins: 'Slerp turns at a constant rate along the shortest path; angle blending can swing wide when tilt is large.',
    },
    {
      situation: 'A character\'s hand spins nearly a full turn between two almost identical keys.',
      competingTechniques: ['Add more keys', 'Check the sign of q₀·q₁ before interpolating'],
      whyThisTechniqueWins: 'The spin is the long way round on the quaternion sphere; flipping q₁ when the dot is negative fixes it at the source.',
    },
  ],

  debugging: [
    {
      commonError: 'No sign check.',
      symptom: 'Occasional near-full spins between similar keys.',
      whyItHappened: 'q₁ was the far representative.',
      repairStrategy: 'If q₀·q₁ < 0, negate q₁.',
    },
    {
      commonError: 'Dividing by sin θ when θ ≈ 0.',
      symptom: 'NaN orientations between identical keys.',
      whyItHappened: 'sin θ = 0.',
      repairStrategy: 'Fall back to lerp and normalise for tiny θ.',
    },
    {
      commonError: 'Lerping quaternions without renormalising.',
      symptom: 'Objects shrink in the middle of a turn.',
      whyItHappened: 'The blend is shorter than 1.',
      repairStrategy: 'Normalise, or use slerp.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Slerp two quaternions with the sign check and compute the weights.',
    explainVerbally: 'Explain why Euler blending fails and why slerp turns evenly the short way.',
    detectIncorrectApplication: 'Recognise missing sign checks, tiny-angle divisions and unnormalised blends.',
    transferToUnfamiliar: 'Interpolate cameras, bones and sensor orientations.',
  },
};
