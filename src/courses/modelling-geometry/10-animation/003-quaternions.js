// Lesson 10.3: quaternions. A rotation by angle θ about unit axis a is the unit quaternion q = (a sin(θ/2), cos(θ/2)):
// four numbers on the 4D unit sphere. Rotations combine by quaternion multiplication; a point turns by q p q*;
// q and −q are the same rotation (a full turn is −1); and, unlike Euler angles, there is no gimbal lock.

const QUAT = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
// Quaternions as [x, y, z, w]: the axis part, then the scalar part.
const fromAxisAngle = (a, deg) => { const h = deg * Math.PI / 360, s = Math.sin(h); return [a[0] * s, a[1] * s, a[2] * s, Math.cos(h)] }
// The product: (v₁, w₁)(v₂, w₂) = (w₁v₂ + w₂v₁ + v₁ × v₂, w₁w₂ − v₁·v₂).
const mul = (p, q) => [
  p[3] * q[0] + q[3] * p[0] + p[1] * q[2] - p[2] * q[1],
  p[3] * q[1] + q[3] * p[1] + p[2] * q[0] - p[0] * q[2],
  p[3] * q[2] + q[3] * p[2] + p[0] * q[1] - p[1] * q[0],
  p[3] * q[3] - p[0] * q[0] - p[1] * q[1] - p[2] * q[2],
]
const conj = (q) => [-q[0], -q[1], -q[2], q[3]]
// Turn a point: q · (p, 0) · q*.
const rotate = (q, p) => mul(mul(q, [p[0], p[1], p[2], 0]), conj(q)).slice(0, 3)
const qstr = (q) => '(' + q.map(r).join(', ') + ')'
`;

const HALF = `${QUAT}
// A turn about y. Predict first: the quaternion of 90°, and of a full 360° turn.
for (const deg of [0, 90, 180, 270, 360]) console.log('y by ' + deg + '°: q = ' + qstr(fromAxisAngle([0, 1, 0], deg)))
// It turns the point (1, 0, 0) by the whole angle, not half: the half angle is used twice, in q and in q*.
console.log('(1, 0, 0) turned by 90° about y: ' + qstr(rotate(fromAxisAngle([0, 1, 0], 90), [1, 0, 0])))`;

const COMBINE = `${QUAT}
// Two turns: 90° about x, then 90° about y (in the world). As one quaternion: q = qy · qx (the later turn on the left).
// Predict first: what single turn is that?
const qx = fromAxisAngle([1, 0, 0], 90), qy = fromAxisAngle([0, 1, 0], 90), q = mul(qy, qx)
const angle = 2 * Math.acos(q[3]) * 180 / Math.PI, s = Math.sin(angle * Math.PI / 360)
console.log('q = ' + qstr(q) + ': one turn of ' + r(angle) + '° about ' + qstr(q.slice(0, 3).map((x) => x / s)))
console.log('the other order, qx · qy = ' + qstr(mul(qx, qy)) + ': not the same (rotations do not commute)')
const p = [0, 0, 1]
console.log('(0, 0, 1): one at a time ' + qstr(rotate(qy, rotate(qx, p))) + ', all at once ' + qstr(rotate(q, p)))`;

const LOCK = `${QUAT}
// Gimbal lock (lesson 2.7): Euler angles (x, 90°, z) only depend on x + z, losing a degree of freedom.
// Quaternions near that orientation still move in three independent directions. Predict first: do the quaternions of
// (10°, 90°, 20°) and (20°, 90°, 20°) differ? And (10°, 90°, 20°) and (0°, 90°, 30°)?
const euler = (x, y, z) => mul(mul(fromAxisAngle([1, 0, 0], x), fromAxisAngle([0, 1, 0], y)), fromAxisAngle([0, 0, 1], z))
console.log('(10°, 90°, 20°): ' + qstr(euler(10, 90, 20)))
console.log('(20°, 90°, 20°): ' + qstr(euler(20, 90, 20)) + '  ← a different orientation')
console.log('(0°, 90°, 30°):  ' + qstr(euler(0, 90, 30)) + '  ← the same as the first: only x + z counted')
// Small turns from there about each axis give three different quaternions: three ways to move.
const q0 = euler(10, 90, 20)
for (const a of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) console.log('nudge 1° about (' + a.join(', ') + '): ' + qstr(mul(fromAxisAngle(a, 1), q0)))`;

const PICTURE = `${QUAT}
// A turn about the axis (1, 1, 1)/√3, drawn at 0°, 60°, … 300°: an arrow pointing along x swept round the axis,
// seen from above the axis. Every arrow is q · (1, 0, 0) · q* for that angle's q.
const axis = [1, 1, 1].map((x) => x / Math.sqrt(3))
const canvas = document.createElement('canvas'), W = 320, H = 240
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'); g.scale(2, 2); g.fillStyle = '#0f1923'; g.fillRect(0, 0, W, H)
// View: look down the axis. Two directions across it span the screen.
const u = [1, -1, 0].map((x) => x / Math.SQRT2), v = [1, 1, -2].map((x) => x / Math.sqrt(6))
const P = (p) => [W / 2 + 90 * (p[0] * u[0] + p[1] * u[1] + p[2] * u[2]), H / 2 - 90 * (p[0] * v[0] + p[1] * v[1] + p[2] * v[2])]
const ends = []
for (let deg = 0; deg < 360; deg += 60) {
  const tip = rotate(fromAxisAngle(axis, deg), [1, 0, 0]), [x, y] = P(tip)
  g.strokeStyle = 'hsl(' + deg + ', 70%, 60%)'; g.lineWidth = 2; g.beginPath(); g.moveTo(W / 2, H / 2); g.lineTo(x, y); g.stroke()
  g.fillStyle = g.strokeStyle; g.font = '10px sans-serif'; g.fillText(deg + '°', x + 4, y)
  ends.push(tip)
}
g.fillStyle = '#facc15'; g.beginPath(); g.arc(W / 2, H / 2, 4, 0, 2 * Math.PI); g.fill()
g.fillStyle = '#cbd5e1'; g.fillText('axis (1, 1, 1), towards you', 8, H - 8)
console.log('the tip at 120°: ' + qstr(ends[2]) + ' (x goes to y)')`;

const CHALLENGE = `// A rotation of 120° about the axis (0, 0, 1). Write its quaternion as [x, y, z, w].
const q = [0, 0, 0, 0]
console.log(q)`;

const SOLVED = CHALLENGE.replace('const q = [0, 0, 0, 0]', 'const q = [0, 0, Math.sin(Math.PI / 3), Math.cos(Math.PI / 3)]');

/** The challenge's check: half angle 60°: (0, 0, sin 60°, cos 60°) = (0, 0, 0.8660, 0.5), or its negative. */
export function checkQuat(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+q\s*=\s*\[([^\]]*)\]/);
  if (!m) return no('Keep the line const q = [x, y, z, w].');
  // Only numbers and a few Math functions are evaluated: this runs in the page, not the cell's sandbox.
  const parts = m[1].split(',').map((s) => s.trim());
  if (parts.length !== 4) return no('A quaternion has four numbers: [x, y, z, w].');
  const ok = (s) => /^[\d.\s+\-*/()]*$/.test(s.replace(/Math\.(sin|cos|sqrt|PI)/g, ''));
  if (!parts.every(ok)) return no('Use numbers, or Math.sin, Math.cos, Math.sqrt and Math.PI.');
  let q;
  try { q = parts.map((s) => Number(new Function('return (' + s + ')')())); } catch { return no('That did not run.'); }
  if (!q.every(Number.isFinite)) return no('All four must be numbers.');
  const near = (a) => a.every((x, i) => Math.abs(x - q[i]) < 2e-3);
  const right = [0, 0, Math.sin(Math.PI / 3), 0.5];
  if (near(right) || near(right.map((x) => -x))) return { pass: true, message: `${near(right) ? '' : 'Its negative, which is the same rotation: '}(0, 0, sin 60°, cos 60°) = (0, 0, 0.866, 0.5). The quaternion uses half the angle, 60°, because it is applied twice (q p q*); its length is √(0.75 + 0.25) = 1.` };
  if (q.every((x) => x === 0)) return no('A turn by θ about unit axis a is (a sin(θ/2), cos(θ/2)).');
  if (near([0, 0, Math.sin(2 * Math.PI / 3), Math.cos(2 * Math.PI / 3)])) return no('That uses the whole 120°. Quaternions use half the angle: 60°.');
  if (near([0, 0, 1, 120]) || near([0, 0, 120, 0])) return no('A quaternion is not (axis, angle): it is (axis · sin(θ/2), cos(θ/2)).');
  if (near([0, 0, 0.5, Math.sin(Math.PI / 3)])) return no('sin and cos are swapped: the axis part gets sin(θ/2), w gets cos(θ/2).');
  if (near([Math.sin(Math.PI / 3), 0, 0, 0.5])) return no('The axis is z, so the sin goes in the z place.');
  return no('(axis · sin(θ/2), cos(θ/2)) with θ = 120° and axis (0, 0, 1).');
}

export default {
  id: 'modelling-geometry-10-003',
  slug: 'quaternions',
  chapter: 'modelling-geometry',
  order: 3,
  title: 'Quaternions',
  subtitle: 'Rotations as four numbers on a 4D sphere: half angles, multiplication, turning points, and no gimbal lock.',
  tags: ['animation', 'rotation', 'quaternions', 'axis-angle', 'gimbal lock', 'orientation'],
  coreConcept: 'A rotation by θ about a unit axis a is the unit quaternion q = (a sin(θ/2), cos(θ/2)), four numbers with x² + y² + z² + w² = 1: a point on the 4D unit sphere. Two rotations combine by quaternion multiplication (the later one on the left), which does not commute; a point p turns by q (p, 0) q*, where q* negates the axis part, so the half angle is applied twice and the point turns by the whole θ. q and −q are the same rotation (a full 360° turn is −1). Every orientation is one turn about one axis, and quaternions represent it without the singular orientations (gimbal lock) of Euler angles.',
  prerequisites: ['modelling-geometry-2-007', 'modelling-geometry-10-002'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-10-004',

  hook: {
    question: 'Euler angles are three easy numbers, but at some orientations two of them do the same thing and a degree of freedom disappears (lesson 2.7). Game engines, robots and spacecraft store orientation as four numbers instead. What are those four numbers, and why do they never lock?',
    realWorldContext: 'Unity, Unreal, three.js, glTF, robotics middleware (ROS) and spacecraft attitude control all store rotations as quaternions; phones fuse their gyroscope readings into a quaternion. Animators still type Euler angles, and tools convert.',
  },

  intuition: {
    prose: [
      'Any orientation is **one turn about one axis** (Euler\'s rotation theorem). A quaternion stores exactly that, in a particular way: for a turn of $\\theta$ about the unit axis $a$, $q = (a\\sin\\tfrac\\theta2,\\ \\cos\\tfrac\\theta2)$. Four numbers whose squares add to 1: a point on the unit sphere in four dimensions. Before running cell 1, predict the quaternion of $90°$ about $y$: $(0, 0.707, 0, 0.707)$; and of $360°$: $(0, 0, 0, -1)$.',
      'Why half the angle? A point $p$ is turned by $q\\,(p, 0)\\,q^*$, where $q^*$ is $q$ with its axis part negated. The quaternion acts twice, once from each side, so the half angle adds up to the whole. A consequence: $q$ and $-q$ turn every point the same way. A full turn gives $-1$, and two full turns $+1$.',
      'Rotations **combine by multiplication**: first $q_1$, then $q_2$, is $q_2 q_1$. Like matrices, the order matters. Before running cell 2, predict what single turn equals $90°$ about $x$ followed by $90°$ about $y$: one turn of $120°$ about a diagonal axis, $(1, 1, -1)/\\sqrt3$. The other order gives $(1, 1, 1)/\\sqrt3$: a different rotation.',
      'At gimbal lock, Euler angles $(x, 90°, z)$ only depend on $x + z$. The quaternion of an orientation is unique (up to sign) and smooth everywhere: small turns about any of the three axes move it in three independent directions. Before running cell 3, predict whether $(10°, 90°, 20°)$ and $(0°, 90°, 30°)$ have the same quaternion: yes, they are the same orientation; Euler angles just gave it two names.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Working with quaternions',
        body: 'Step 1. Axis and angle to q: (a sin(θ/2), cos(θ/2)), a a unit vector.\nStep 2. Combine: first q₁ then q₂ is q₂ q₁ (Hamilton product).\nStep 3. Turn a point: q (p, 0) q*, with q* = (−x, −y, −z, w).\nStep 4. Back to axis and angle: θ = 2 acos(w), a = (x, y, z)/sin(θ/2).\nStep 5. Keep it unit: renormalise after many multiplications.',
      },
      {
        type: 'warning',
        title: 'Half the angle',
        body: 'Writing (a sin θ, cos θ) instead of half angles turns everything by twice as much. The tell: a 180° turn should have w = 0.',
      },
      {
        type: 'warning',
        title: 'Two quaternions per orientation',
        body: 'q and −q are the same rotation. Comparing quaternions component by component, or interpolating between them without care, can take the long way round (lesson 10.4 fixes this).',
      },
      {
        type: 'insight',
        title: 'The graphics strand: rotation modes',
        body: 'Tools let you pick Euler for typing angles and quaternions for interpolating and storing. glTF files and three.js objects store a quaternion; Euler angles are converted on the way in.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "a quaternion is a rotation about x, then y, then z". Each arrow is one turn about a single tilted axis, (1, 1, 1): the arrow sweeps a cone round it, and at 120° x has gone exactly to y.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'fromAxisAngle is Step 1; mul is the Hamilton product; rotate is q p q*.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'The GPU gets a matrix built from the quaternion each frame (or the quaternion itself, for skinning by dual quaternions in lesson 11.7).' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Object › Trace the quaternion builds the selected object\'s quaternion from its Euler angles: one per axis (predict a half-angle cosine), the product, and the single axis and angle. The Timeline\'s rotation mode switches keys between Euler and quaternion interpolation. In a script: obj.traceQuaternion(), obj.rotationMode = "quaternion".' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: quaternions',
        caption: 'Half angles, combining turns, no gimbal lock, and one turn about a tilted axis.',
        props: {
          lesson: {
            title: 'Quaternions',
            subtitle: 'Four numbers for a rotation.',
            cells: [
              { type: 'js', instruction: '### 1. Half angles\nPredict first: 90° and 360° about y.', startCode: HALF },
              { type: 'js', instruction: '### 2. Combining turns\nPredict first: 90° about x, then 90° about y.', startCode: COMBINE },
              { type: 'js', instruction: '### 3. No gimbal lock\nPredict first: are the two names one orientation?', startCode: LOCK },
              { type: 'js', instruction: '### 4. See it\nOne axis, one turn.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 290 },
              { type: 'challenge', instruction: '### 5. Challenge: write a quaternion\nThe check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkQuat },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Quaternions" in MeshLab](#/lab/mesh-lab?project=quaternions). An arrow turned by (60°, 30°, 0°); its quaternion is traced: press Play, and predict the x axis\'s w.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Object › Trace the quaternion** on any object.\n- [Open "Euler angles and gimbal lock"](#/lab/mesh-lab?project=gimbal-lock) to see what quaternions avoid.\n- In a script: `obj.traceQuaternion()`.\n- **Elsewhere:** three.js Quaternion, glTF node rotation, Blender\'s Quaternion (WXYZ) rotation mode.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Quaternions.** $q = w + xi + yj + zk$ with $i^2 = j^2 = k^2 = ijk = -1$. Written $(v, w)$ with $v = (x, y, z)$, the product is $(v_1, w_1)(v_2, w_2) = (w_1 v_2 + w_2 v_1 + v_1 \\times v_2,\\ w_1 w_2 - v_1 \\cdot v_2)$. The cross product makes it non-commutative.',
      '**Rotations.** For unit $q = (a\\sin\\tfrac\\theta2, \\cos\\tfrac\\theta2)$, the map $p \\mapsto q\\,(p, 0)\\,q^*$ is the rotation by $\\theta$ about $a$ (Rodrigues\' formula follows by expanding). Unit quaternions form the 3-sphere $S^3$, which covers the rotations twice: $q$ and $-q$ give the same map.',
      '**Composition.** $q_2(q_1 p q_1^*)q_2^* = (q_2 q_1)\\,p\\,(q_2 q_1)^*$, so applying $q_1$ then $q_2$ is the single quaternion $q_2 q_1$.',
      '**No singularities.** The map from unit quaternions to rotations is a smooth local diffeomorphism everywhere, so every orientation has a neighbourhood described smoothly by three free directions; Euler angles fail this at $y = \\pm 90°$.',
    ],
    equations: [
      { label: 'Axis-angle', latex: 'q = \\big(a\\sin\\tfrac\\theta2,\\ \\cos\\tfrac\\theta2\\big)' },
      { label: 'Product', latex: '(v_1, w_1)(v_2, w_2) = (w_1 v_2 + w_2 v_1 + v_1 \\times v_2,\\ w_1 w_2 - v_1 \\cdot v_2)' },
      { label: 'Turning a point', latex: 'p\' = q\\,(p, 0)\\,q^*' },
      { label: 'Back to angle', latex: '\\theta = 2\\arccos w' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** The unit quaternions form the group SU(2) ≅ S³, and q ↦ (p ↦ qpq*) is a surjective group homomorphism onto SO(3) with kernel {1, −1}: every rotation has exactly two unit quaternions, q and −q.',
      '**Invariant viewpoint.** A quaternion describes a rotation, not a coordinate convention: its axis and angle mean the same thing in any frame, unlike Euler angles, whose meaning depends on the order of axes.',
      '**Geometric picture.** Hold a belt by both ends and twist one end a full turn: it stays twisted. Twist it two full turns and you can untangle it without turning the ends. That is −1 after one turn and +1 after two.',
      '**Where this goes.** Lesson 10.4 interpolates quaternions along the sphere; lesson 11.7 extends them to dual quaternions for skinning.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-10-003-ex1',
      title: '180° about x',
      problem: 'Write the quaternion of 180° about x.',
      steps: [{ expression: '(\\sin 90°, 0, 0, \\cos 90°) = (1, 0, 0, 0)', annotation: 'Half angle 90°.' }],
      conclusion: '(1, 0, 0, 0).',
    },
    {
      id: 'modelling-geometry-10-003-ex2',
      title: 'Read the angle',
      problem: 'q = (0, 0.6, 0, 0.8). What turn is it?',
      steps: [{ expression: '\\theta = 2\\arccos 0.8 = 73.74°', annotation: 'About y.' }],
      conclusion: '73.74° about y.',
    },
    {
      id: 'modelling-geometry-10-003-ex3',
      title: 'Undo',
      problem: 'What quaternion undoes q = (0, 0.6, 0, 0.8)?',
      steps: [{ expression: 'q^* = (0, -0.6, 0, 0.8)', annotation: 'The same turn the other way.' }],
      conclusion: '(0, −0.6, 0, 0.8): q q* = 1.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-10-003-ch1',
      difficulty: 'easy',
      problem: 'Why is a 360° turn the quaternion −1?',
      walkthrough: [{ expression: '\\cos 180° = -1, \\sin 180° = 0', annotation: 'Half of 360°.' }],
      answer: 'Its half angle is 180°: (a sin 180°, cos 180°) = (0, 0, 0, −1). It still turns every point by 360°, back to where it was, because −1 and +1 give the same rotation.',
    },
    {
      id: 'modelling-geometry-10-003-ch2',
      difficulty: 'medium',
      problem: 'Show that q and −q turn a point the same way.',
      walkthrough: [{ expression: '(-q)\\,p\\,(-q)^* = q\\,p\\,q^*', annotation: 'The two minus signs cancel.' }],
      answer: '(−q)* = −q*, so (−q) p (−q)* = (−1)(−1) q p q* = q p q*. Every rotation therefore has two quaternions, opposite points of the 4D sphere.',
    },
    {
      id: 'modelling-geometry-10-003-ch3',
      difficulty: 'hard',
      problem: 'Using the product formula, show that the quaternion of 90° about x followed by 90° about y is a 120° turn about (1, 1, 1)/√3 (up to the sign of the axis).',
      walkthrough: [
        { expression: 'q_x = (s, 0, 0, s), \\; q_y = (0, s, 0, s), \\; s = \\tfrac{\\sqrt2}{2}', annotation: 'Half angles of 45°.' },
        { expression: 'q_y q_x = (s^2, s^2, -s^2, s^2) = (\\tfrac12, \\tfrac12, -\\tfrac12, \\tfrac12)', annotation: 'w₁v₂ + w₂v₁ + v₁ × v₂ with v_y × v_x = (0, 0, −s²).' },
        { expression: '\\theta = 2\\arccos\\tfrac12 = 120°, \\; a = (1, 1, -1)/\\sqrt3', annotation: 'Axis and angle.' },
      ],
      answer: 'q_y q_x = (½, ½, −½, ½): w = ½ gives θ = 120°, and the axis is (1, 1, −1)/√3. (The other order, q_x q_y, gives the axis (1, 1, 1)/√3: the cross product\'s sign is what makes the two orders differ.)',
    },
  ],

  semantics: {
    core: [
      { symbol: 'q = (x, y, z, w)', meaning: 'A unit quaternion: an orientation.' },
      { symbol: '(a\\sin\\tfrac\\theta2, \\cos\\tfrac\\theta2)', meaning: 'A turn of θ about the axis a.' },
      { symbol: 'q^*', meaning: 'The conjugate: the same turn backwards.' },
      { symbol: 'q_2 q_1', meaning: 'First q₁, then q₂.' },
      { symbol: 'q\\,p\\,q^*', meaning: 'Turning a point.' },
      { symbol: '-q', meaning: 'The same orientation.' },
    ],
    rulesOfThumb: [
      'Half the angle goes in.',
      'Later turns multiply on the left.',
      'q and −q are the same.',
      'Renormalise after many products.',
      'No gimbal lock.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-2-007', label: 'Euler angles and gimbal lock', note: 'What quaternions avoid.' },
      { lessonId: 'modelling-geometry-10-002', label: 'Interpolation and easing', note: 'The blending quaternions will need.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-10-004', label: 'Slerp', note: 'Interpolating along the 4D sphere.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-10-003-1', label: 'Read the axis-angle quaternion and its half angle', type: 'read' },
    { id: 'cp-modelling-geometry-10-003-2', label: 'Read combining and turning points', type: 'read' },
    { id: 'cp-modelling-geometry-10-003-3', label: 'Read why there is no gimbal lock', type: 'read' },
    { id: 'cp-modelling-geometry-10-003-4', label: 'Run cells 1 to 3: half angles, combining, gimbal lock', type: 'lab' },
    { id: 'cp-modelling-geometry-10-003-5', label: 'Trace a quaternion in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-10-003-6', label: 'Work through example 2, read the angle', type: 'example' },
    { id: 'cp-modelling-geometry-10-003-7', label: 'Work through example 3, undo', type: 'example' },
    { id: 'cp-modelling-geometry-10-003-8', label: 'Complete the challenge: write a quaternion', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-10-003-assess-1',
        type: 'choice',
        text: 'The quaternion of 60° about z is:',
        options: ['(0, 0, 0.5, 0.866)', '(0, 0, 0.866, 0.5)', '(0, 0, 60, 1)', '(0.5, 0, 0, 0.866)'],
        answer: '(0, 0, 0.5, 0.866)',
        hint: 'Half angle 30°.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-10-003-quiz-1',
      type: 'choice',
      text: 'The quaternion of 90° about y:',
      options: ['(0, 0.707, 0, 0.707)', '(0, 1, 0, 0)', '(0, 90, 0, 1)', '(0.707, 0, 0, 0.707)'],
      answer: '(0, 0.707, 0, 0.707)',
      hints: ['Cell 1.', 'Half angle 45°.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-10-003-quiz-2',
      type: 'choice',
      text: 'A full 360° turn is the quaternion:',
      options: ['−1', '+1', '0', 'undefined'],
      answer: '−1',
      hints: ['Cell 1.', 'cos 180° = −1.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-10-003-quiz-3',
      type: 'choice',
      text: 'First q₁, then q₂, is the quaternion:',
      options: ['q₂ q₁', 'q₁ q₂', 'q₁ + q₂', 'Either order'],
      answer: 'q₂ q₁',
      hints: ['Cell 2.', 'Math, Composition.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-10-003-quiz-4',
      type: 'choice',
      text: 'Euler (10°, 90°, 20°) and (0°, 90°, 30°) are:',
      options: ['The same orientation (one quaternion)', 'Different orientations', 'Both invalid', 'Mirror images'],
      answer: 'The same orientation (one quaternion)',
      hints: ['Cell 3.', 'Gimbal lock: only x + z counts.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-10-003-quiz-5',
      type: 'choice',
      text: 'Why does the quaternion hold half the angle?',
      options: ['It is applied twice, in q p q*', 'To save space', 'A convention only', 'It doesn\'t'],
      answer: 'It is applied twice, in q p q*',
      hints: ['Intuition.', 'Challenge 2.'],
      reviewSection: 'Intuition',
    },
    {
      id: 'modelling-geometry-10-003-quiz-6',
      type: 'choice',
      text: 'How many unit quaternions describe one orientation?',
      options: ['Two (q and −q)', 'One', 'Three', 'Infinitely many'],
      answer: 'Two (q and −q)',
      hints: ['Warning "Two quaternions per orientation".', 'Rigor.'],
      reviewSection: 'Warning "Two quaternions per orientation"',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'A quaternion is three angles plus one more.',
      whyStudentsThinkIt: 'It has four numbers and replaces three angles.',
      correctionExample: 'The picture: it is one turn about one axis; the numbers are the axis times sin(θ/2) and cos(θ/2).',
      contrastCase: 'Euler angles really are three turns about fixed axes.',
    },
    {
      falseBelief: 'Each orientation has exactly one quaternion.',
      whyStudentsThinkIt: 'Each has one rotation matrix.',
      correctionExample: 'Cell 1: 0° gives +1 and 360° gives −1, the same orientation.',
      contrastCase: 'The rotation matrix is unique; the quaternion is unique up to sign.',
    },
    {
      falseBelief: 'Quaternion multiplication commutes like ordinary multiplication.',
      whyStudentsThinkIt: 'Numbers do.',
      correctionExample: 'Cell 2: qy·qx and qx·qy differ, as the two orders of turns do.',
      contrastCase: 'Two turns about the same axis do commute.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A drone\'s flight controller integrates gyroscope readings into an orientation many times a second.',
      competingTechniques: ['Euler angles', 'A unit quaternion, renormalised each step'],
      whyThisTechniqueWins: 'Quaternions never lock as the drone pitches straight up, and stay accurate with a cheap renormalisation.',
    },
    {
      situation: 'An animator wants to type "turn 30° about y" into a tool that stores quaternions.',
      competingTechniques: ['Type four numbers by hand', 'Let the tool convert axis-angle or Euler input'],
      whyThisTechniqueWins: 'Humans think in angles; the conversion (a sin(θ/2), cos(θ/2)) is exact and instant.',
    },
  ],

  debugging: [
    {
      commonError: 'Using the full angle instead of half.',
      symptom: 'Everything turns twice as far.',
      whyItHappened: '(a sin θ, cos θ) instead of half angles.',
      repairStrategy: 'Use θ/2: a 180° turn must have w = 0.',
    },
    {
      commonError: 'Multiplying in the wrong order.',
      symptom: 'Turns happen about the wrong axes.',
      whyItHappened: 'First q₁ then q₂ is q₂ q₁.',
      repairStrategy: 'Put the later rotation on the left (for world-axis turns).',
    },
    {
      commonError: 'Not renormalising after many multiplications.',
      symptom: 'Objects slowly grow or shrink.',
      whyItHappened: 'Rounding makes |q| drift from 1, and q p q* scales by |q|².',
      repairStrategy: 'Divide by |q| every so often.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Write a quaternion from an axis and angle, combine two, and turn a point.',
    explainVerbally: 'Explain half angles, q and −q, and why quaternions do not lock.',
    detectIncorrectApplication: 'Recognise full angles, wrong orders and drifting length.',
    transferToUnfamiliar: 'Use quaternions in engines, robots and sensors.',
  },
};
