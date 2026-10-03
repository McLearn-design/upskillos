// Lesson 10.5: motion through a hierarchy. A child's world motion is its parents' animated transforms composed at
// each frame: World(f) = Parent(f) · Local(f). Simple keys on the joints (each a steady turn) give the tip a curved
// path no single key describes. Baking samples that world motion into keys on an object with no parent; straight
// lines between baked keys cut corners, by an amount that shrinks with the square of the step.

const ARM = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
// MeshLab's "Motion through a hierarchy" arm, in the plane: a shoulder at (0, 0.5), an upper arm 1.5 long, a
// forearm 1.2 long ending at the pen. Each joint turns 0° → 90° steadily over frames 1 to 49.
const L1 = 1.5, L2 = 1.2, shoulderAt = [0, 0.5]
const angle = (f) => (Math.PI / 2) * (f - 1) / 48                          // the same for both joints
const turn = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)]
// World of the pen = shoulder's transform · (elbow's offset + elbow's transform · pen's offset).
function pen(f) {
  const a = angle(f), b = angle(f)
  const inElbow = [L2, 0], inShoulder = [L1 + turn(inElbow, b)[0], turn(inElbow, b)[1]]   // the elbow turns the pen; the elbow sits L1 along
  const w = turn(inShoulder, a)                                                         // the shoulder turns everything below it
  return [shoulderAt[0] + w[0], shoulderAt[1] + w[1]]
}
`;

const COMPOSE = `${ARM}
// Predict first: where is the pen at frame 49, when both joints have turned 90°?
for (const f of [1, 13, 25, 37, 49]) console.log('frame ' + f + ': pen at (' + pen(f).map(r).join(', ') + ')')`;

const CURVE = `${ARM}
// Each joint turns at a steady rate, yet the pen's path is a curve. How long is it, against the straight line
// between its ends? Predict first: longer or shorter?
let length = 0
for (let f = 1; f < 49; f += 0.01) { const p = pen(f), q = pen(f + 0.01); length += Math.hypot(q[0] - p[0], q[1] - p[1]) }
const a = pen(1), b = pen(49)
console.log('path ' + r(length) + ', straight line ' + r(Math.hypot(b[0] - a[0], b[1] - a[1])))`;

const BAKE = `${ARM}
// Baking: sample the pen every n frames and join the samples with straight lines. How far does that stray from the
// true curve? Predict first: going from every 6 frames to every 3, by what factor does the worst gap shrink?
function bake(n) {
  const keys = []
  for (let f = 1; f < 49; f += n) keys.push(f)
  keys.push(49)
  let worst = 0
  for (let f = 1; f <= 49; f++) {
    const i = Math.max(0, keys.findIndex((k, j) => j + 1 < keys.length && keys[j + 1] >= f))
    const f0 = keys[i], f1 = keys[i + 1], t = (f - f0) / (f1 - f0), p0 = pen(f0), p1 = pen(f1), p = pen(f)
    worst = Math.max(worst, Math.hypot(p[0] - (p0[0] + t * (p1[0] - p0[0])), p[1] - (p0[1] + t * (p1[1] - p0[1]))))
  }
  return { keys: keys.length, worst }
}
for (const n of [1, 3, 6, 12]) { const b = bake(n); console.log('every ' + n + ' frames: ' + b.keys + ' keys, worst gap ' + r(b.worst)) }`;

const PICTURE = `${ARM}
// The arm at frames 1, 13, 25, 37, 49 (ghosts), the pen's true path (green), and its baking every 12 frames (orange).
const canvas = document.createElement('canvas'), W = 340, H = 260
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'); g.scale(2, 2); g.fillStyle = '#0f1923'; g.fillRect(0, 0, W, H)
const X = (x) => W / 2 + 10 + x * 55, Y = (y) => H - 40 - y * 55
for (const f of [1, 13, 25, 37, 49]) {
  const a = angle(f), elbow = [shoulderAt[0] + L1 * Math.cos(a), shoulderAt[1] + L1 * Math.sin(a)], p = pen(f)
  g.strokeStyle = 'rgba(148, 163, 184, ' + (0.35 + 0.65 * (f - 1) / 48) + ')'; g.lineWidth = 3
  g.beginPath(); g.moveTo(X(shoulderAt[0]), Y(shoulderAt[1])); g.lineTo(X(elbow[0]), Y(elbow[1])); g.lineTo(X(p[0]), Y(p[1])); g.stroke()
}
g.strokeStyle = '#4ade80'; g.lineWidth = 2; g.beginPath()
for (let f = 1; f <= 49; f += 0.5) (f === 1 ? g.moveTo : g.lineTo).call(g, X(pen(f)[0]), Y(pen(f)[1]))
g.stroke()
g.strokeStyle = '#f59e0b'; g.setLineDash([4, 3]); g.beginPath()
;[1, 13, 25, 37, 49].forEach((f, k) => (k ? g.lineTo : g.moveTo).call(g, X(pen(f)[0]), Y(pen(f)[1])))
g.stroke(); g.setLineDash([])
g.fillStyle = '#cbd5e1'; g.font = '11px sans-serif'; g.fillText('green: the pen\\'s path   orange: baked every 12 frames', 8, H - 10)
console.log('drawn')`;

const CHALLENGE = `// A two-joint arm in the plane: the shoulder at the origin, an upper arm 2 long, a forearm 1 long. The shoulder is
// turned 30° and the elbow 60° (relative to the upper arm). Where is the tip?
const tip = { x: 0, y: 0 }
console.log(tip)`;

const SOLVED = CHALLENGE.replace('const tip = { x: 0, y: 0 }', 'const tip = { x: 2 * Math.cos(Math.PI / 6), y: 2 * Math.sin(Math.PI / 6) + 1 }');

/** The challenge's check: elbow at (2 cos 30°, 2 sin 30°) = (1.732, 1); the forearm points at 30° + 60° = 90°: tip (1.732, 2). */
export function checkTip(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/x\s*:\s*([^,}]+),\s*y\s*:\s*([^,}\n]+)/);
  if (!m) return no('Keep the line const tip = { x: …, y: … }.');
  const ok = (s) => /^[\d.\s+\-*/()]*$/.test(s.replace(/Math\.(sin|cos|sqrt|PI)/g, ''));
  if (!ok(m[1]) || !ok(m[2])) return no('Use numbers, or Math.sin, Math.cos, Math.sqrt and Math.PI.');
  let x, y;
  try { x = Number(new Function('return (' + m[1] + ')')()); y = Number(new Function('return (' + m[2] + ')')()); } catch { return no('That did not run.'); }
  if (!Number.isFinite(x) || !Number.isFinite(y)) return no('x and y must be numbers.');
  const near = (a, b) => Math.abs(x - a) < 2e-3 && Math.abs(y - b) < 2e-3;
  if (near(Math.sqrt(3), 2)) return { pass: true, message: 'Right: the elbow is at (2 cos 30°, 2 sin 30°) = (1.732, 1). The elbow\'s 60° is measured from the upper arm, so the forearm points at 30° + 60° = 90°, straight up: the tip is (1.732, 2).' };
  if (x === 0 && y === 0) return no('Start with the elbow: 2 along the upper arm, which points at 30°.');
  if (near(Math.sqrt(3) + 0.5, 1 + Math.sqrt(3) / 2)) return no('The elbow\'s 60° is relative to its parent, the upper arm: the forearm points at 30° + 60°, not 60°.');
  if (near(Math.sqrt(3), 1)) return no('That is the elbow. Add the forearm, 1 long.');
  if (near(0.5, Math.sqrt(3) / 2)) return no('That is only the forearm on its own. It hangs off the elbow at (1.732, 1).');
  return no(`(${+x.toFixed(3)}, ${+y.toFixed(3)}): elbow = 2 (cos 30°, sin 30°); tip = elbow + (cos 90°, sin 90°).`);
}

export default {
  id: 'modelling-geometry-10-005',
  slug: 'motion-through-a-hierarchy',
  chapter: 'modelling-geometry',
  order: 5,
  title: 'Motion through a hierarchy',
  subtitle: 'How keys on parents move their children: world motion composed at every frame, the curves it makes, and baking it into keys.',
  tags: ['animation', 'hierarchy', 'forward kinematics', 'baking', 'motion paths', 'composition'],
  coreConcept: 'In a hierarchy each object is keyed in its parent\'s frame, and its world transform at frame f is the product of every animated local transform up the chain at that same frame: World(f) = Parent(f) · Local(f). Steady turns of two joints therefore give the tip a curved path that no single key on it describes (forward kinematics). Baking samples that world motion every few frames and stores it as keys on an object with no parent, so it no longer needs the hierarchy; straight lines between baked keys cut across the curve, by a worst gap that falls with the square of the step.',
  prerequisites: ['modelling-geometry-2-005', 'modelling-geometry-10-004'],
  timeToComplete: 35,
  nextLesson: 'modelling-geometry-10-006',

  hook: {
    question: 'An animator keys a shoulder and an elbow, and the hand traces a graceful arc it was never keyed to follow. A game engine importing the animation wants the hand\'s motion on its own, with no arm. How does motion pass down a chain, and how is it pulled back out?',
    realWorldContext: 'Every rigged character, robot arm and mechanical assembly moves this way (forward kinematics). Baking is used to export animations to engines, to attach props to hands, to turn simulations into keys, and to simplify rigs for games.',
  },

  intuition: {
    prose: [
      'Each object in a hierarchy is keyed **in its parent\'s frame** (lesson 2.5). At every frame, the software samples each object\'s keys, builds its local matrix, and multiplies down the chain: $W_\\text{pen}(f) = W_\\text{shoulder}(f)\\,L_\\text{elbow}(f)\\,L_\\text{pen}$. The pen has no keys; it moves because its parents do. Before running cell 1, predict where the pen is when both joints have turned $90°$: the upper arm points up, the forearm turns another $90°$, so it points left: $(-1.2, 2)$.',
      'Each joint turns at a steady rate, yet the pen\'s path is a **curve**: two rotations composed. Before running cell 2, predict whether the path is longer or shorter than the straight line between its ends: longer, as any curve is.',
      '**Baking** pulls the motion back out of the hierarchy: sample the pen\'s world position every $n$ frames and store the samples as keys on an object with no parent. Between keys the baked motion is a straight line, so it cuts across the curve. Before running cell 3, predict how much the worst gap shrinks when the step halves from 6 frames to 3: to about a quarter, because a chord\'s sag grows with the square of its length.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: World motion at frame f, and baking it',
        body: 'Step 1. For each object from the root down to the target: sample its position, rotation and scale keys at f (lessons 10.1–10.4), build its local matrix.\nStep 2. Multiply them in order: World = Root · … · Parent · Local.\nStep 3. To bake: repeat for f = start, start + n, …, end; read the position (and rotation) from each world matrix.\nStep 4. Store them as keys on an object with no parent.\nStep 5. Check the worst gap between the keys; halve n if it is too large (the gap falls by about 4).',
      },
      {
        type: 'warning',
        title: 'Sample every channel at the same frame',
        body: 'Mixing the parent\'s transform at one frame with the child\'s at another (a lag of a frame, common in naive update loops) makes children wobble behind their parents.',
      },
      {
        type: 'warning',
        title: 'Baking loses the edit',
        body: 'A baked object no longer follows its old parents: change the shoulder\'s keys and the baked marker stays on the old path. Keep the rig, and bake again for export.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: motion paths',
        body: 'Animation tools draw motion paths, the curve a point traces through the frames, by exactly this sampling. A path shows what keys on the parents do to a child before you play it.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "a child moves in straight lines between keys". The arm\'s ghosts turn steadily, and the pen sweeps a green curve; the orange dashed line, its baking every 12 frames, cuts across it.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'pen() is Steps 1–2 for a two-link chain in the plane; bake() is Steps 3–5.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Each frame the CPU composes the chain and uploads one world matrix per object; skinned characters upload one per bone (chapter 11). Baked animation skips the composition: the matrices come straight from the keys.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Object › Trace baking world motion (every 3 frames) shows the chain, the samples (predict how many keys) and the worst gap. In a script: obj.traceBake(n) returns the keys to put on another object. The robot-arm project bakes a carried block this way.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: motion through a hierarchy',
        caption: 'Composing joints at each frame, the curved path, baking and its error, and the arm\'s motion path.',
        props: {
          lesson: {
            title: 'Motion through a hierarchy',
            subtitle: 'Parents move children.',
            cells: [
              { type: 'js', instruction: '### 1. Composing at each frame\nPredict first: the pen at frame 49.', startCode: COMPOSE },
              { type: 'js', instruction: '### 2. A curved path\nPredict first: longer or shorter than the straight line?', startCode: CURVE },
              { type: 'js', instruction: '### 3. Baking\nPredict first: halving the step.', startCode: BAKE },
              { type: 'js', instruction: '### 4. See it\nThe arm, the path and the baking.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 310 },
              { type: 'challenge', instruction: '### 5. Challenge: where is the tip?\nThe check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkTip },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Motion through a hierarchy" in MeshLab](#/lab/mesh-lab?project=hierarchy-motion). The same arm in 3D; the pen\'s baking is traced: press Play, and predict the number of keys.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Object › Trace baking world motion** on any child.\n- [Open "Robot arm"](#/lab/mesh-lab?project=robot-arm): a block baked into the gripper\'s path.\n- [Open "Island fly-through"](#/lab/mesh-lab?project=island-flythrough): a camera keyed with lookAt and slerp.\n- **Elsewhere:** Blender\'s Bake Action and Motion Paths.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Forward kinematics.** For a chain with local transforms $L_k(f)$, the world transform of link $n$ is $W_n(f) = L_1(f)\\,L_2(f)\\cdots L_n(f)$. In the plane with joint angles $a$ and $b$ and link lengths $\\ell_1, \\ell_2$: tip $= \\ell_1(\\cos a, \\sin a) + \\ell_2(\\cos(a + b), \\sin(a + b))$.',
      '**Curved paths.** Even when $a(f)$ and $b(f)$ are linear in $f$, the tip is a sum of two circular motions: a curve.',
      '**Baking error.** For a path $p(f)$ with bounded second derivative $|p\'\'| \\le M$, linear interpolation between samples $n$ frames apart is off by at most $M n^2/8$: halving $n$ quarters the error.',
    ],
    equations: [
      { label: 'World at a frame', latex: 'W_n(f) = L_1(f)\\,L_2(f)\\cdots L_n(f)' },
      { label: 'Two-link tip', latex: '\\ell_1(\\cos a, \\sin a) + \\ell_2(\\cos(a + b), \\sin(a + b))' },
      { label: 'Baking error', latex: '\\max |p - p_\\text{baked}| \\le \\tfrac18 M n^2' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** Sampling each link\'s keys at f and composing gives W_n(f), a function of f as smooth as the slowest-varying key interpolation; the chord bound |p − p_lin| ≤ ⅛ max|p\'\'| h² for linear interpolation with spacing h (a standard result) bounds the baking error.',
      '**Invariant viewpoint.** Moving the root moves the whole motion rigidly: the tip\'s path in the root\'s frame is unchanged, which is why animations can be re-targeted to characters placed anywhere.',
      '**Geometric picture.** Hold a pen at the end of your arm and turn your shoulder and elbow at steady speeds: the pen draws a spiral-like curve though neither joint does anything but turn.',
      '**Where this goes.** Lesson 10.6 builds a walk from cyclic keys on a hierarchy; chapter 11 replaces the rigid links with a skinned mesh.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-10-005-ex1',
      title: 'Straight out',
      problem: 'Two links 1.5 and 1.2, both angles 0. Where is the tip (shoulder at the origin)?',
      steps: [{ expression: '(1.5 + 1.2, 0) = (2.7, 0)', annotation: 'Both along x.' }],
      conclusion: '(2.7, 0).',
    },
    {
      id: 'modelling-geometry-10-005-ex2',
      title: 'Folded back',
      problem: 'Shoulder 0°, elbow 180°. Tip?',
      steps: [{ expression: '(1.5, 0) + 1.2(\\cos 180°, \\sin 180°) = (0.3, 0)', annotation: 'The forearm points back.' }],
      conclusion: '(0.3, 0).',
    },
    {
      id: 'modelling-geometry-10-005-ex3',
      title: 'Halving the step',
      problem: 'Baking every 8 frames gives a worst gap of 0.02. Every 4 frames?',
      steps: [{ expression: '0.02 / 4 = 0.005', annotation: 'Error ∝ n².' }],
      conclusion: 'About 0.005.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-10-005-ch1',
      difficulty: 'easy',
      problem: 'Why does the pen move although it has no keys?',
      walkthrough: [{ expression: 'W_\\text{pen} = W_\\text{elbow}\\,L_\\text{pen}', annotation: 'Its parent moves.' }],
      answer: 'Its world transform is its parent\'s world transform times its own fixed local one; the parents are keyed, so the product changes every frame.',
    },
    {
      id: 'modelling-geometry-10-005-ch2',
      difficulty: 'medium',
      problem: 'Why bake an animation for a game engine instead of exporting the rig?',
      walkthrough: [{ expression: '\\text{keys on each object, no constraints}', annotation: 'Simple to play back.' }],
      answer: 'Engines may not support the tool\'s constraints, drivers or custom hierarchy; baked keys play back anywhere with no evaluation of the rig, at the cost of no longer being editable through it.',
    },
    {
      id: 'modelling-geometry-10-005-ch3',
      difficulty: 'hard',
      problem: 'In cell 3, the gap falls from 0.0303 (every 6) to 0.0067 (every 3). Explain the factor of about 4.',
      walkthrough: [
        { expression: '\\text{sag of a chord} \\approx \\tfrac18 \\kappa\\, s^2', annotation: 'κ the curvature, s the chord length.' },
        { expression: 's \\propto n', annotation: 'Chord length is proportional to the step.' },
      ],
      answer: 'A chord of length s across a curve of curvature κ sags by about κs²/8 in the middle. The chord length is proportional to the step n, so halving n quarters the sag: 0.0303 / 4 ≈ 0.0076, close to the measured 0.0067 (the curvature varies along the path, so the factor is not exactly 4).',
    },
  ],

  semantics: {
    core: [
      { symbol: 'W(f)', meaning: 'An object\'s world transform at frame f.' },
      { symbol: 'L(f)', meaning: 'Its local transform, from its own keys at f.' },
      { symbol: 'W = L_1 L_2 \\cdots L_n', meaning: 'Forward kinematics: composing down the chain.' },
      { symbol: 'n', meaning: 'The baking step, in frames.' },
      { symbol: 'Mn^2/8', meaning: 'The worst baking gap.' },
      { symbol: '\\text{motion path}', meaning: 'The curve a point traces over the frames.' },
    ],
    rulesOfThumb: [
      'Children move with their parents.',
      'Sample every link at the same frame.',
      'Steady joints, curved tips.',
      'Halve the step, quarter the gap.',
      'Bake for export, keep the rig for editing.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-2-005', label: 'Hierarchies', note: 'World = parent · local.' },
      { lessonId: 'modelling-geometry-10-004', label: 'Slerp', note: 'The rotations being composed.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-10-006', label: 'A walk cycle', note: 'Cyclic keys on a hierarchy.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-10-005-1', label: 'Read composing animated transforms', type: 'read' },
    { id: 'cp-modelling-geometry-10-005-2', label: 'Read why steady joints make curves', type: 'read' },
    { id: 'cp-modelling-geometry-10-005-3', label: 'Read baking and its error', type: 'read' },
    { id: 'cp-modelling-geometry-10-005-4', label: 'Run cells 1 to 3: composing, curve, baking', type: 'lab' },
    { id: 'cp-modelling-geometry-10-005-5', label: 'Trace baking in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-10-005-6', label: 'Work through example 2, folded back', type: 'example' },
    { id: 'cp-modelling-geometry-10-005-7', label: 'Work through example 3, halving the step', type: 'example' },
    { id: 'cp-modelling-geometry-10-005-8', label: 'Complete the challenge: where is the tip?', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-10-005-assess-1',
        type: 'choice',
        text: 'Links 1 and 1, shoulder 90°, elbow −90°. Tip (shoulder at the origin)?',
        options: ['(1, 1)', '(0, 2)', '(1, −1)', '(0, 0)'],
        answer: '(1, 1)',
        hint: 'Up 1, then the forearm at 90° − 90° = 0°.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-10-005-quiz-1',
      type: 'choice',
      text: 'The pen at frame 49, with both joints at 90°:',
      options: ['(−1.2, 2)', '(0, 3.2)', '(2.7, 0.5)', '(1.5, 1.7)'],
      answer: '(−1.2, 2)',
      hints: ['Cell 1.', 'Up 1.5, then left 1.2.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-10-005-quiz-2',
      type: 'choice',
      text: 'Two joints turning steadily move the tip along:',
      options: ['A curve', 'A straight line', 'A circle about the shoulder', 'Nowhere'],
      answer: 'A curve',
      hints: ['Cell 2.', 'Two rotations composed.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-10-005-quiz-3',
      type: 'choice',
      text: 'Halving the baking step changes the worst gap by about:',
      options: ['A factor of 4 smaller', 'A factor of 2 smaller', 'Nothing', 'A factor of 4 larger'],
      answer: 'A factor of 4 smaller',
      hints: ['Cell 3.', 'Challenge 3.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-10-005-quiz-4',
      type: 'choice',
      text: 'A child\'s world transform at frame f is:',
      options: ['Its parent\'s world transform at f times its own local at f', 'Its own keys only', 'Its parent\'s keys only', 'Its local at frame 1'],
      answer: 'Its parent\'s world transform at f times its own local at f',
      hints: ['Procedure.', 'Lesson 2.5.'],
      reviewSection: 'Procedure',
    },
    {
      id: 'modelling-geometry-10-005-quiz-5',
      type: 'choice',
      text: 'After baking, changing the shoulder\'s keys:',
      options: ['Does not move the baked object', 'Moves the baked object too', 'Deletes the baked keys', 'Re-bakes automatically'],
      answer: 'Does not move the baked object',
      hints: ['Warning "Baking loses the edit".', 'It has no parent.'],
      reviewSection: 'Warning "Baking loses the edit"',
    },
    {
      id: 'modelling-geometry-10-005-quiz-6',
      type: 'choice',
      text: 'Baking every frame from 1 to 49 makes how many keys?',
      options: ['49', '48', '50', '24'],
      answer: '49',
      hints: ['Cell 3.', 'Frames 1, 2, …, 49.'],
      reviewSection: 'Cell 3',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'A child moves in straight lines between keys.',
      whyStudentsThinkIt: 'Keys interpolate linearly.',
      correctionExample: 'The picture: the joints\' angles interpolate linearly, but the pen\'s position sweeps a curve.',
      contrastCase: 'A child of a parent that only translates does move in straight lines.',
    },
    {
      falseBelief: 'Baking with more keys is always better.',
      whyStudentsThinkIt: 'More samples, more accuracy.',
      correctionExample: 'Cell 3: every frame is exact, but every 3 frames is already within 0.0067; past a point, extra keys only cost memory.',
      contrastCase: 'Fast, jerky motion (impacts) does need dense keys.',
    },
    {
      falseBelief: 'The elbow\'s angle is measured from the world\'s x axis.',
      whyStudentsThinkIt: 'Angles usually are.',
      correctionExample: 'The challenge: it is measured from the upper arm, so it adds to the shoulder\'s.',
      contrastCase: 'The root\'s angle is measured in the world.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A character must pass a cup from one hand to the other during an animation.',
      competingTechniques: ['Parent the cup to each hand in turn', 'Bake the cup\'s world motion from the first hand, then key it into the second'],
      whyThisTechniqueWins: 'Baking gives the cup its own keys at the exact world positions, so it can switch "parents" without jumping.',
    },
    {
      situation: 'An industrial robot\'s controller needs the tool tip\'s path for collision checks.',
      competingTechniques: ['Interpolate the tip between start and end', 'Forward kinematics at each time step'],
      whyThisTechniqueWins: 'The tip follows the composed joint motions, a curve; only forward kinematics gives the true path.',
    },
  ],

  debugging: [
    {
      commonError: 'Updating a child before its parent in the frame loop.',
      symptom: 'Children trail their parents by one frame.',
      whyItHappened: 'The child used the parent\'s previous transform.',
      repairStrategy: 'Update parents first (or compute from the keys at f directly, as worldAt does).',
    },
    {
      commonError: 'Baking with too large a step.',
      symptom: 'Baked props drift off hands in curved motions.',
      whyItHappened: 'Chords cut corners by ∝ n².',
      repairStrategy: 'Halve the step until the worst gap is acceptable.',
    },
    {
      commonError: 'Baking position only for a turning object.',
      symptom: 'The baked object slides along the path without turning.',
      whyItHappened: 'Rotation was not sampled.',
      repairStrategy: 'Bake rotation too (as quaternions, slerped).',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Compose a chain at a frame and bake its motion with a chosen accuracy.',
    explainVerbally: 'Explain how parents move children, why paths curve, and what baking keeps and loses.',
    detectIncorrectApplication: 'Recognise frame lag, coarse baking and position-only bakes.',
    transferToUnfamiliar: 'Apply forward kinematics to rigs, robots and props.',
  },
};
