// Lesson 10.2: interpolation and easing. Easing reshapes t before blending: s = ease(t), still 0 at the first key
// and 1 at the second, but spending the time differently. ease-in s = t² starts slow (exactly gravity from rest),
// ease-out s = 1 − (1 − t)² ends slow (rising to rest), ease s = 3t² − 2t³ is slow at both ends. Their slopes at the
// keys decide whether the motion has corners.

const BASE = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const ease = {
  linear: (t) => t,
  'ease-in': (t) => t * t,
  'ease-out': (t) => 1 - (1 - t) * (1 - t),
  ease: (t) => t * t * (3 - 2 * t),
}
`;

const TABLE = `${BASE}
// s = ease(t) at five points. Predict first: ease-in at t = ½.
for (const [name, f] of Object.entries(ease)) console.log(name.padEnd(9) + [0, 0.25, 0.5, 0.75, 1].map((t) => r(f(t))).join('  '))`;

const GRAVITY = `${BASE}
// A ball falls 3 m from rest in 0.5 s. Physics: height = 3 − ½·g·time², with g = 24 m/s² so it lands at 0.5 s.
// Keys: 3 m at time 0, 0 m at time 0.5; t = time / 0.5. Which easing reproduces the physics exactly?
const g = 24, physics = (time) => 3 - 0.5 * g * time * time
for (const [name, f] of Object.entries(ease)) {
  let worst = 0
  for (let k = 0; k <= 50; k++) { const time = 0.5 * k / 50; worst = Math.max(worst, Math.abs(3 + f(time / 0.5) * (0 - 3) - physics(time))) }
  console.log(name.padEnd(9) + ' worst error ' + r(worst) + ' m')
}`;

const SLOPES = `${BASE}
// The speed at each key is the slope ds/dt there (times the gap's size). Predict first: which easings start at
// speed 0, and which arrive at speed 0?
const d = (f, t) => (f(Math.min(1, t + 1e-6)) - f(Math.max(0, t - 1e-6))) / (Math.min(1, t + 1e-6) - Math.max(0, t - 1e-6))
for (const [name, f] of Object.entries(ease)) console.log(name.padEnd(9) + ' slope at the first key ' + r(d(f, 0)) + ', at the second ' + r(d(f, 1)))
// A throw: up with ease-out, down with ease-in. At the top both slopes are 0: no corner.
console.log('top of a throw: arriving ' + r(d(ease['ease-out'], 1)) + ', leaving ' + r(d(ease['ease-in'], 0)))`;

const PICTURE = `${BASE}
// Left: the four curves s(t). Right: a ball dropped with each easing, drawn every 2 of its 12 frames (a strobe):
// wide gaps mean fast, tight gaps slow.
const canvas = document.createElement('canvas'), W = 380, H = 230
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'); g.scale(2, 2); g.fillStyle = '#0f1923'; g.fillRect(0, 0, W, H)
const colours = { linear: '#94a3b8', 'ease-in': '#f87171', 'ease-out': '#60a5fa', ease: '#4ade80' }
const X = (t) => 20 + t * 150, Y = (s) => H - 30 - s * 170
g.strokeStyle = '#334155'; g.strokeRect(X(0), Y(1), 150, 170)
for (const [name, f] of Object.entries(ease)) {
  g.strokeStyle = colours[name]; g.lineWidth = 2; g.beginPath()
  for (let k = 0; k <= 60; k++) (k ? g.lineTo : g.moveTo).call(g, X(k / 60), Y(f(k / 60)))
  g.stroke()
}
Object.keys(ease).forEach((name, i) => {
  const x = 220 + i * 40
  g.fillStyle = colours[name]
  for (let k = 0; k <= 12; k += 2) { const s = ease[name](k / 12); g.beginPath(); g.arc(x, 30 + s * 160, 5, 0, 2 * Math.PI); g.fill() }
  g.font = '9px sans-serif'; g.textAlign = 'center'; g.fillText(name, x, H - 10)
})
g.fillStyle = '#cbd5e1'; g.font = '10px sans-serif'; g.textAlign = 'left'; g.fillText('s against t', X(0), H - 12)
console.log('drawn')`;

const CHALLENGE = `// A ball is dropped from 2.45 m (g = 9.8 m/s²). At 24 frames per second, how many frames apart should the top key
// (ease-in) and the floor key be? Round to a whole frame.
const frames = 0
console.log(frames)`;

const SOLVED = CHALLENGE.replace('const frames = 0', 'const frames = Math.round(Math.sqrt(2 * 2.45 / 9.8) * 24)');

/** The challenge's check: time = √(2h/g) = √0.5 = 0.7071 s; × 24 = 16.97 → 17 frames. */
export function checkFallFrames(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+frames\s*=\s*([^\n]+)/);
  if (!m) return no('Keep the line const frames = …, with a number or an expression.');
  // Only arithmetic and a few Math functions are evaluated: this runs in the page, not the cell's sandbox.
  const e = m[1].replace(/\/\/.*$/, '').trim().replace(/;$/, '');
  if (!/^[\d.,\s+\-*/()]*$/.test(e.replace(/Math\.(sqrt|round|floor|ceil)|\*\*/g, ''))) return no('Write the count as a number, or arithmetic with Math.sqrt and Math.round.');
  let v;
  try { v = Number(new Function('return (' + e + ')')()); } catch { return no('That expression did not run.'); }
  if (!Number.isFinite(v)) return no('The count must be a number.');
  if (v === 17) return { pass: true, message: '17 frames: falling from rest, h = ½ g t², so t = √(2h/g) = √(2 × 2.45 / 9.8) = √0.5 = 0.707 s, and 0.707 × 24 = 16.97, so 17 frames. With ease-in on the top key, every frame in between is then where gravity would put the ball.' };
  if (v === 0) return no('Falling from rest: h = ½ g t². Solve for t, then multiply by 24 frames per second.');
  if (Math.abs(v - 16.97) < 0.05) return no('Round to a whole frame: keys sit on frames.');
  if (v === 12) return no('12 frames is 0.5 s: √(h/g) or 2h/g. Falling from rest, h = ½ g t², so t = √(2h/g).');
  if (v === 6) return no('h/g × 24 is not a time: solve h = ½ g t² for t.');
  if (v === 24) return no('24 is one second. The fall takes √(2h/g) seconds.');
  return no(`${v} frames: t = √(2h/g) seconds, times 24.`);
}

export default {
  id: 'modelling-geometry-10-002',
  slug: 'interpolation-and-easing',
  chapter: 'modelling-geometry',
  order: 2,
  title: 'Interpolation and easing',
  subtitle: 'Bending the straight line between keys so motion speeds up and slows down: ease-in, ease-out, and why t² is gravity.',
  tags: ['animation', 'easing', 'interpolation', 'gravity', 'smoothstep', 'velocity'],
  coreConcept: 'Easing reshapes t before the blend: s = ease(t) still runs from 0 at the first key to 1 at the second, but spends the time differently. Linear s = t moves at constant speed and turns sharp corners at keys; ease-in s = t² starts at rest and speeds up, exactly a fall under gravity (height ∝ time²); ease-out s = 1 − (1 − t)² slows to rest, like a throw reaching its top; ease s = 3t² − 2t³ starts and ends at rest. The slope ds/dt at each key is the speed there: matching slopes on both sides of a key (ease-out into ease-in at the top of a throw, both 0) removes the corner.',
  prerequisites: ['modelling-geometry-10-001'],
  timeToComplete: 30,
  nextLesson: 'modelling-geometry-10-003',

  hook: {
    question: 'Animate a ball falling with two linear keys and it looks wrong: it moves like a lift, not a ball. Animators fix it by "easing in". What does easing change, and why does one particular easing match gravity exactly?',
    realWorldContext: 'Easing is the default in every animation tool and UI framework (CSS ease, ease-in, ease-out; Blender\'s Bézier handles). The 12 principles of animation call it "slow in and slow out"; physically it is acceleration.',
  },

  intuition: {
    prose: [
      'Linear interpolation moves at a constant speed and stops dead at each key. Real things accelerate. **Easing** keeps the keys but bends the clock: instead of $t$, the blend uses $s = \\text{ease}(t)$, which still goes from 0 to 1 but not at a steady rate. Before running cell 1, predict ease-in, $s = t^2$, at $t = \\tfrac12$: only $\\tfrac14$ of the way, because it starts slow.',
      'Ease-in is not just a look: it is **gravity**. Falling from rest, the distance fallen is $\\tfrac12 g\\,\\text{time}^2$, proportional to time squared. So keys at the top and the bottom with ease-in on the top key put the ball exactly where physics would, on every frame. Before running cell 2, predict which easing has zero error.',
      'The **slope** of $s(t)$ at a key is the speed there. Linear has slope 1 at both ends: it arrives at full speed and leaves at full speed, so wherever the direction changes there is a corner. Ease-in starts at slope 0 (at rest) and ends at 2; ease-out the reverse; ease is 0 at both. Before running cell 3, predict the slopes at the top of a throw, ease-out going up and ease-in coming down: 0 and 0, so the turn is smooth.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Choosing an easing',
        body: 'Step 1. Starting from rest (falling, pushing off)? ease-in (s = t²).\nStep 2. Coming to rest (a throw\'s top, landing softly)? ease-out (s = 1 − (1 − t)²).\nStep 3. Rest to rest (a door, a camera move)? ease (s = 3t² − 2t³).\nStep 4. Constant speed (a conveyor, a spinning wheel)? linear.\nStep 5. A sudden change (a cut, a light switching)? constant.',
      },
      {
        type: 'warning',
        title: 'The easing belongs to the gap',
        body: 'Each key\'s interpolation shapes the gap after it, to the next key. To ease into the floor, set ease-in on the top key, not on the floor key.',
      },
      {
        type: 'warning',
        title: '"ease" is not gravity',
        body: 'The S-curve 3t² − 2t³ slows down at the bottom too: a falling ball keyed with it seems to float onto the floor. Gravity only speeds up: ease-in.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: motion that reads as weight',
        body: 'Viewers read acceleration as weight: a heavy object takes time to start and stop; a light one does not. Easing is how an animator gives weight without simulating physics.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "easing changes where the object goes". All four strobes start and end in the same places; only the spacing between the dots, how far it moves each frame, differs.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'ease[name] are the four formulas, exactly as in MeshLab\'s animation.ts; cell 2 compares ease-in with ½gt²; cell 3 measures the slopes numerically.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Easing happens on the CPU while sampling; the GPU only receives the resulting matrices. glTF stores LINEAR, STEP or CUBICSPLINE samplers, so other easings are baked into extra keys on export (lesson 10.7).' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Each key has an interpolation (constant, linear, ease, ease-in, ease-out) in the Timeline. Object › Trace sampling the keys shows t and s (predict s for an eased key). In a script: obj.keyframe(f, { position, interp: "ease-in" }).' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: easing',
        caption: 'Four easing curves, gravity, slopes at the keys, and a strobe of four drops.',
        props: {
          lesson: {
            title: 'Interpolation and easing',
            subtitle: 'Same keys, different timing.',
            cells: [
              { type: 'js', instruction: '### 1. Four easings\nPredict first: ease-in at t = ½.', startCode: TABLE },
              { type: 'js', instruction: '### 2. Gravity\nPredict first: which easing is exact?', startCode: GRAVITY },
              { type: 'js', instruction: '### 3. Slopes at the keys\nPredict first: the top of a throw.', startCode: SLOPES },
              { type: 'js', instruction: '### 4. See it\nThe curves, and four drops as strobes.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 280 },
              { type: 'challenge', instruction: '### 5. Challenge: time a drop\nThe check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkFallFrames },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Interpolation and easing" in MeshLab](#/lab/mesh-lab?project=easing). Four balls dropped with four easings; the ease-in one is traced: press Play, and predict s.' },
              { type: 'markdown', instruction: '### Use the tool\n- Set a key\'s interpolation in the **Timeline**.\n- [Open "Bouncing ball"](#/lab/mesh-lab?project=bouncing-ball): ease-in at every top, ease-out at every bounce.\n- [The "Land on 20" challenge](#/lab/mesh-lab?challenge=land-on-20).\n- **Elsewhere:** CSS transition-timing-function, Blender\'s interpolation modes and Bézier handles.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Easing functions.** Each maps $[0, 1] \\to [0, 1]$ with $e(0) = 0$, $e(1) = 1$: linear $t$; ease-in $t^2$; ease-out $1 - (1 - t)^2 = 2t - t^2$; ease (smoothstep) $3t^2 - 2t^3$.',
      '**Gravity.** From rest, $y(\\tau) = h - \\tfrac12 g\\tau^2$ for $\\tau \\in [0, T]$, $T = \\sqrt{2h/g}$. With $t = \\tau/T$, $y = h - h\\,t^2 = h + t^2(0 - h)$: linear interpolation with $s = t^2$. Rising to rest is the same motion reversed: $s = 1 - (1 - t)^2$.',
      '**Slopes.** $e\'(0), e\'(1)$: linear 1, 1; ease-in 0, 2; ease-out 2, 0; ease 0, 0. The velocity at a key is $e\'(\\cdot)\\,(v_1 - v_0)/(f_1 - f_0)$ per frame; the motion is smooth through a key when the velocities on both sides match.',
    ],
    equations: [
      { label: 'Ease-in', latex: 's = t^2' },
      { label: 'Ease-out', latex: 's = 1 - (1 - t)^2' },
      { label: 'Ease (smoothstep)', latex: 's = 3t^2 - 2t^3' },
      { label: 'Fall time', latex: 'T = \\sqrt{2h/g}' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** For keys (f₀, v₀), (f₁, v₁) and easing e, the interpolant v(f) = v₀ + e((f − f₀)/(f₁ − f₀))(v₁ − v₀) is C¹ across a key exactly when the one-sided derivatives agree: e₀\'(1)(v₁ − v₀)/(f₁ − f₀) = e₁\'(0)(v₂ − v₁)/(f₂ − f₁). With e(t) = t², the interpolant is the exact free-fall trajectory from rest.',
      '**Invariant viewpoint.** Easing reparametrises time without changing the path: the set of positions visited is the same, only when each is visited changes.',
      '**Geometric picture.** Same road, different driving: linear is cruise control; ease-in pulls away from the lights; ease-out brakes to a stop.',
      '**Where this goes.** Lesson 10.3 moves to rotations, where blending is not done per component at all.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-10-002-ex1',
      title: 'Ease-out at three quarters',
      problem: 's for ease-out at t = 0.75?',
      steps: [{ expression: '1 - 0.25^2 = 0.9375', annotation: 'Nearly there already.' }],
      conclusion: '0.9375.',
    },
    {
      id: 'modelling-geometry-10-002-ex2',
      title: 'Smoothstep at a quarter',
      problem: 's for ease at t = 0.25?',
      steps: [{ expression: '3(0.0625) - 2(0.015625) = 0.15625', annotation: '3t² − 2t³.' }],
      conclusion: '0.15625.',
    },
    {
      id: 'modelling-geometry-10-002-ex3',
      title: 'A falling key',
      problem: 'Ease-in from 4 m to 0 m. Height at t = 0.6?',
      steps: [{ expression: '4 + 0.36(0 - 4) = 2.56', annotation: 's = 0.36.' }],
      conclusion: '2.56 m.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-10-002-ch1',
      difficulty: 'easy',
      problem: 'Why does ease-in, not ease, match a fall?',
      walkthrough: [{ expression: 'e\'(1) = 2 \\text{ vs } 0', annotation: 'A fall is fastest at the bottom.' }],
      answer: 'A falling object is fastest when it lands; ease-in\'s slope is largest at the end (2), while ease slows to 0 at the end, as if the ball were lowered on a rope.',
    },
    {
      id: 'modelling-geometry-10-002-ch2',
      difficulty: 'medium',
      problem: 'A ball bounces: down with ease-in, up with ease-out. Is there a corner at the floor? Should there be?',
      walkthrough: [{ expression: '\\text{arriving slope } 2, \\text{ leaving slope } 2 \\text{ but reversed}', annotation: 'The velocity flips sign.' }],
      answer: 'Yes: it arrives moving down fast and leaves moving up fast, a sudden reversal. That is right for a bounce: the floor reverses the velocity in an instant. A smooth curve there would look like a soft landing.',
    },
    {
      id: 'modelling-geometry-10-002-ch3',
      difficulty: 'hard',
      problem: 'Show that ease-in with keys at the top and the floor reproduces y(τ) = h − ½gτ² exactly, given the frames are T = √(2h/g) apart.',
      walkthrough: [
        { expression: 't = \\tau/T, \\; s = t^2', annotation: 'Ease-in.' },
        { expression: 'y = h + t^2(0 - h) = h - h\\tau^2/T^2', annotation: 'The blend.' },
        { expression: 'h/T^2 = g/2', annotation: 'From T² = 2h/g.' },
      ],
      answer: 'With t = τ/T and s = t², the blend gives y = h − h τ²/T². Since T² = 2h/g, h/T² = g/2, so y = h − ½gτ²: exactly free fall, on every frame.',
    },
  ],

  semantics: {
    core: [
      { symbol: 's = \\text{ease}(t)', meaning: 'The reshaped fraction used for the blend.' },
      { symbol: 't^2', meaning: 'Ease-in: starts at rest, like a fall.' },
      { symbol: '1 - (1 - t)^2', meaning: 'Ease-out: ends at rest, like a throw\'s top.' },
      { symbol: '3t^2 - 2t^3', meaning: 'Ease (smoothstep): rest to rest.' },
      { symbol: 'e\'(0), e\'(1)', meaning: 'Speed at the keys.' },
      { symbol: '\\sqrt{2h/g}', meaning: 'Time to fall h from rest.' },
    ],
    rulesOfThumb: [
      'Easing changes timing, not path.',
      'Falling: ease-in on the top key.',
      'Rising to rest: ease-out.',
      'Rest to rest: ease.',
      'Match slopes to hide a key.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-10-001', label: 'Keyframes', note: 'The t being reshaped.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-10-003', label: 'Quaternions', note: 'Interpolating rotations.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-10-002-1', label: 'Read the four easings', type: 'read' },
    { id: 'cp-modelling-geometry-10-002-2', label: 'Read why t² is gravity', type: 'read' },
    { id: 'cp-modelling-geometry-10-002-3', label: 'Read slopes at the keys', type: 'read' },
    { id: 'cp-modelling-geometry-10-002-4', label: 'Run cells 1 to 3: easings, gravity, slopes', type: 'lab' },
    { id: 'cp-modelling-geometry-10-002-5', label: 'Trace an eased key in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-10-002-6', label: 'Work through example 1, ease-out at three quarters', type: 'example' },
    { id: 'cp-modelling-geometry-10-002-7', label: 'Work through example 3, a falling key', type: 'example' },
    { id: 'cp-modelling-geometry-10-002-8', label: 'Complete the challenge: time a drop', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-10-002-assess-1',
        type: 'choice',
        text: 'Ease-in at t = 0.4 gives s =',
        options: ['0.16', '0.4', '0.64', '0.352'],
        answer: '0.16',
        hint: 't².',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-10-002-quiz-1',
      type: 'choice',
      text: 'Ease-in at t = ½ gives s =',
      options: ['¼', '½', '¾', '1'],
      answer: '¼',
      hints: ['Cell 1.', 't².'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-10-002-quiz-2',
      type: 'choice',
      text: 'Which easing reproduces a fall from rest exactly?',
      options: ['ease-in', 'ease', 'linear', 'ease-out'],
      answer: 'ease-in',
      hints: ['Cell 2.', 'Height ∝ time².'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-10-002-quiz-3',
      type: 'choice',
      text: 'Which easing starts and ends at rest?',
      options: ['ease (3t² − 2t³)', 'ease-in', 'ease-out', 'linear'],
      answer: 'ease (3t² − 2t³)',
      hints: ['Cell 3.', 'Slopes 0 and 0.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-10-002-quiz-4',
      type: 'choice',
      text: 'To ease into the floor, set ease-in on:',
      options: ['The top key', 'The floor key', 'Both', 'Neither'],
      answer: 'The top key',
      hints: ['Warning "The easing belongs to the gap".', 'It shapes the gap after it.'],
      reviewSection: 'Warning "The easing belongs to the gap"',
    },
    {
      id: 'modelling-geometry-10-002-quiz-5',
      type: 'choice',
      text: 'Easing changes:',
      options: ['When the object reaches each point, not the path', 'The path', 'The key values', 'The frame rate'],
      answer: 'When the object reaches each point, not the path',
      hints: ['The picture.', 'Rigor, Invariant viewpoint.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-10-002-quiz-6',
      type: 'choice',
      text: 'A ball falling 2.45 m (g = 9.8) at 24 fps needs keys about how many frames apart?',
      options: ['17', '12', '24', '6'],
      answer: '17',
      hints: ['The challenge.', '√(2h/g) × 24.'],
      reviewSection: 'Challenge',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'Easing changes where the object goes.',
      whyStudentsThinkIt: 'The motion looks different.',
      correctionExample: 'The picture: every strobe starts and ends at the same points.',
      contrastCase: 'Overshooting curves (back, elastic) do leave the segment, on purpose.',
    },
    {
      falseBelief: 'The smooth S-curve is the most realistic easing.',
      whyStudentsThinkIt: 'It is the default.',
      correctionExample: 'Cell 2: for a fall, ease has a large error; ease-in has none.',
      contrastCase: 'For things that start and stop under control (doors, cameras), ease is right.',
    },
    {
      falseBelief: 'Easing on the second key controls the arrival.',
      whyStudentsThinkIt: 'The arrival is at that key.',
      correctionExample: 'Each key\'s interpolation shapes the gap after it: the first key of the gap decides.',
      contrastCase: 'Some tools have separate in and out handles per key, which do control both sides.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A UI menu should slide out quickly and settle gently.',
      competingTechniques: ['linear', 'ease-out'],
      whyThisTechniqueWins: 'Ease-out moves fast at first and slows to rest, which feels responsive and calm.',
    },
    {
      situation: 'A game needs a jumping character\'s height without a physics engine.',
      competingTechniques: ['Linear keys up and down', 'Ease-out up to the top key, ease-in down'],
      whyThisTechniqueWins: 'Those are exactly the two halves of a parabola, so the jump looks physical with three keys.',
    },
  ],

  debugging: [
    {
      commonError: 'Ease-in on the floor key.',
      symptom: 'The fall looks linear, and the bounce up looks wrong.',
      whyItHappened: 'The floor key\'s easing shapes the gap after it (the rise).',
      repairStrategy: 'Put ease-in on the key at the top of each fall.',
    },
    {
      commonError: 'Using ease (smoothstep) for a fall.',
      symptom: 'The ball slows down as it reaches the floor.',
      whyItHappened: 'Smoothstep ends at slope 0.',
      repairStrategy: 'ease-in for falls, ease-out for rises.',
    },
    {
      commonError: 'Keys for a fall placed by eye.',
      symptom: 'The fall looks floaty or too fast for the height.',
      whyItHappened: 'The timing ignores gravity.',
      repairStrategy: 'Space the keys by √(2h/g) seconds.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Compute s for any easing and time falls and throws.',
    explainVerbally: 'Explain why t² is gravity and how slopes at keys make or hide corners.',
    detectIncorrectApplication: 'Recognise easing on the wrong key and smoothstep used for falls.',
    transferToUnfamiliar: 'Choose easings for characters, cameras and interfaces.',
  },
};
