// Lesson 10.6: a walk cycle. A walk is a loop of key poses per step (contact, down, passing, up), two steps to a
// cycle, the right leg half a cycle behind the left; playback wraps frames modulo the cycle. The body moves forward
// at a steady speed, and while a foot is planted its leg must sweep back at exactly that speed, or the foot slides.

const LEG = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
// A leg in the side view: a hip, a thigh 0.5 long, a shin 0.5 long. Angles in radians from straight down,
// positive swinging forward (+x). The foot is at the end of the shin.
const T = 0.5, S = 0.5
const foot = (hip, thigh, knee) => [hip[0] + T * Math.sin(thigh) + S * Math.sin(thigh + knee), hip[1] - T * Math.cos(thigh) - S * Math.cos(thigh + knee)]
`;

const POSES = `${LEG}
// One step, 12 frames: contact (frame 0), down (3), passing (6), up (9). Two steps make a 24-frame cycle; the right
// leg plays the left leg's keys 12 frames later. Predict first: at passing, is the free leg's foot higher or lower?
// Left leg keys [thigh, knee]. Stance (frames 0–12): a straight leg sweeping back under the hips. Swing (12–24): the knee bends.
// The hips travel 0.45 per step, so the stance angles are asin of the hip's offset from the planted foot.
const A = Math.asin(0.225), B = Math.asin(0.1125)
const left = { 0: [A, 0], 3: [B, 0], 6: [0, 0], 9: [-B, 0], 12: [-A, 0], 15: [-0.2, -0.8], 18: [0, -1], 21: [0.25, -0.5] }
const hipY = { 0: Math.cos(A), 3: Math.cos(B), 6: 1, 9: Math.cos(B) }   // the hips ride over the straight stance leg
for (const f of [0, 3, 6, 9]) {
  const L = left[f], R = left[(f + 12) % 24], y = hipY[f]
  console.log('frame ' + f + ': left foot height ' + r(foot([0, y], ...L)[1]) + ', right foot height ' + r(foot([0, y], ...R)[1]))
}`;

const LOOP = `${LEG}
// Playback loops: frame f of a 24-frame cycle starting at frame 1 plays the pose of 1 + ((f − 1) mod 24).
// Predict first: which frame of the first cycle does frame 50 play?
const inCycle = (f) => 1 + (((f - 1) % 24) + 24) % 24
for (const f of [1, 24, 25, 30, 50, 97]) console.log('frame ' + f + ' plays frame ' + inCycle(f))
// For the loop to be seamless, the keys at frame 25 must equal those at frame 1.`;

const SLIDE = `${LEG}
// While the left foot is planted (a straight leg, knee 0), the hips move forward 0.24 over 6 frames.
// Predict first: which thigh sweep keeps the foot still: ±0.06, ±0.12 or ±0.24 rad (keyed linearly)?
function slide(a0, a1) {
  let worst = 0, start = null
  for (let k = 0; k <= 6; k++) {
    const t = k / 6, hip = [-0.12 + 0.24 * t, 1], a = a0 + t * (a1 - a0), p = foot(hip, a, 0)
    if (!start) start = p
    worst = Math.max(worst, Math.abs(p[0] - start[0]))
  }
  return worst
}
for (const a of [0.06, 0.12, 0.24]) console.log('sweep ±' + a + ' rad: the foot slides ' + r(slide(a, -a)))
// The exact sweep keeps x_hip + sin a constant: a(t) = −asin(x_hip(t)), from asin(0.12) = 0.1203 to −0.1203.`;

const PICTURE = `${LEG}
// The left leg over one 24-frame cycle, drawn every 3 frames side by side (a strobe), with the hips moving forward.
// The foot is orange while it is on the ground.
// The body covers 0.9 per cycle (0.0375 per frame).
const A = Math.asin(0.225), B = Math.asin(0.1125)
const left = { 0: [A, 0], 3: [B, 0], 6: [0, 0], 9: [-B, 0], 12: [-A, 0], 15: [-0.2, -0.8], 18: [0, -1], 21: [0.25, -0.5], 24: [A, 0] }
const hipY = (f) => Math.cos([A, B, 0, B][(f % 12) / 3])
const canvas = document.createElement('canvas'), W = 380, H = 200
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'); g.scale(2, 2); g.fillStyle = '#0f1923'; g.fillRect(0, 0, W, H)
const X = (x) => 50 + x * 250, Y = (y) => H - 30 - y * 140
g.strokeStyle = '#334155'; g.beginPath(); g.moveTo(10, Y(0)); g.lineTo(W - 10, Y(0)); g.stroke()
const planted = new Set()
for (let f = 0; f <= 24; f += 3) {
  const hip = [f * 0.0375, hipY(f)], [a, b] = left[f], knee = [hip[0] + T * Math.sin(a), hip[1] - T * Math.cos(a)], p = foot(hip, a, b)
  g.strokeStyle = 'rgba(148, 163, 184, 0.8)'; g.lineWidth = 2
  g.beginPath(); g.moveTo(X(hip[0]), Y(hip[1])); g.lineTo(X(knee[0]), Y(knee[1])); g.lineTo(X(p[0]), Y(p[1])); g.stroke()
  const low = p[1] < 0.01
  if (low) planted.add(r(p[0]))
  g.fillStyle = low ? '#f59e0b' : '#60a5fa'; g.beginPath(); g.arc(X(p[0]), Y(p[1]), 3.5, 0, 2 * Math.PI); g.fill()
}
g.fillStyle = '#cbd5e1'; g.font = '11px sans-serif'; g.fillText('one cycle, every 3 frames; orange: foot on the ground', 8, 14)
console.log('poses drawn: 9; the foot touches the ground at x = ' + [...planted].join(' and ') + ' (one stride apart)')`;

const CHALLENGE = `// A walk cycle of 24 frames moves the body 0.9 m forward (two steps of 0.45 m). Played at 24 frames per second, how
// fast does the character walk, in metres per second?
const speed = 0
console.log(speed)`;

const SOLVED = CHALLENGE.replace('const speed = 0', 'const speed = 0.9 / (24 / 24)');

/** The challenge's check: 0.9 m per 24 frames = 0.9 m per second at 24 fps. */
export function checkWalkSpeed(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+speed\s*=\s*([^\n]+)/);
  if (!m) return no('Keep the line const speed = …, with a number or plain arithmetic.');
  const e = m[1].replace(/\/\/.*$/, '').trim().replace(/;$/, '');
  if (!/^[\d.\s+\-*/()]+$/.test(e)) return no('Write the speed as a number or plain arithmetic.');
  let v;
  try { v = Number(new Function('return (' + e + ')')()); } catch { return no('That expression did not run.'); }
  const near = (x) => Math.abs(v - x) < 1e-3;
  if (near(0.9)) return { pass: true, message: '0.9 m/s: one cycle is 24 frames, which at 24 fps is exactly one second, and it covers 0.9 m. A brisk human walk is about 1.4 m/s; this character strolls.' };
  if (v === 0) return no('How long does one cycle take, in seconds? Then divide the distance by it.');
  if (near(0.45)) return no('0.45 m is one step. A cycle is two steps: 0.9 m in 24 frames.');
  if (near(0.9 / 24) || near(0.0375)) return no('0.0375 m is per frame. At 24 frames per second, multiply by 24.');
  if (near(0.9 * 24)) return no('24 frames is one second at 24 fps, so the cycle\'s 0.9 m takes one second, not 1/24 of one.');
  return no(`${v} m/s: distance per cycle ÷ seconds per cycle.`);
}

export default {
  id: 'modelling-geometry-10-006',
  slug: 'a-walk-cycle',
  chapter: 'modelling-geometry',
  order: 6,
  title: 'A walk cycle',
  subtitle: 'Four key poses per step, a loop that joins seamlessly, and the walk\'s commonest fault: feet that slide.',
  tags: ['animation', 'walk cycle', 'loops', 'key poses', 'foot sliding', 'cyclic animation'],
  coreConcept: 'A walk is a loop. Each step has four key poses: contact (heel down, legs apart), down (the weight lands, the hips dip), passing (the free leg swings past, knee bent, hips back up), and up (pushing off). Two steps make a cycle, the right leg playing the left leg\'s keys half a cycle later. Playback wraps the frame modulo the cycle, so the keys at the end of a cycle must equal those at its start. The body moves forward at a steady speed; while a foot is planted its leg must sweep back at exactly that speed, so the foot stays still in the world. If not, the foot slides: the most visible walk fault, measured by following the ankle\'s world position through the planted frames.',
  prerequisites: ['modelling-geometry-10-005', 'modelling-geometry-10-002'],
  timeToComplete: 35,
  nextLesson: 'modelling-geometry-10-007',

  hook: {
    question: 'Game characters walk for hours on a few seconds of animation. How is a walk built from a handful of poses, how does it repeat without a hitch, and why do so many walks look like the character is skating?',
    realWorldContext: 'Walk and run cycles are the first exercise in every animation course and the backbone of game locomotion; engines blend cycles of different speeds and correct foot sliding with inverse kinematics (foot locking) at runtime.',
  },

  intuition: {
    prose: [
      'A walk repeats, so it is built once as a **cycle**. Each step has four **key poses**: contact, down, passing, up. A cycle is two steps: the left foot leads, then the right. The right leg can use the left leg\'s keys **half a cycle later**. Before running cell 1, predict the feet at contact and at passing: at contact both feet are on the ground, one in front and one behind; at passing the free foot is lifted (0.23 here) because its knee bends to clear the ground. In this straight-leg model the hips ride highest at passing and lowest at contact; a real walk also bends the stance knee after contact, which moves the lowest point to the down pose.',
      'Playback **loops**: frame $f$ plays frame $1 + ((f - 1) \\bmod 24)$ of a 24-frame cycle. For the join to be invisible, the keys at frame 25 must equal those at frame 1 (and their easing must match, lesson 10.2). Before running cell 2, predict which frame frame 50 plays: frame 2.',
      'The body moves forward steadily. A planted foot must not: while it is on the ground, its leg must sweep back exactly as fast as the hips move forward, so the foot stays at one point of the world. Before running cell 3, predict which sweep keeps the foot still while the hips move 0.24 forward: about $\\pm 0.12$ rad, since the leg is 1 long and $\\sin a \\approx a$, so the foot moves back $2 \\times 0.12$. A smaller sweep lets the foot drift forward and a larger one drags it back: **foot sliding**.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Building a walk cycle',
        body: 'Step 1. Choose the cycle length (24 frames = one second at 24 fps) and the stride.\nStep 2. Key the left leg\'s four poses per step: contact, down, passing, up (every 3 frames for a 12-frame step).\nStep 3. Copy them to the right leg, half a cycle later.\nStep 4. Key the hips: low around contact and down, high at passing; forward at a constant speed (linear).\nStep 5. Make the last keys equal the first, and play it in a loop.\nStep 6. Measure the planted foot\'s slide; adjust the leg sweep (or pin the foot with inverse kinematics) until it is still.',
      },
      {
        type: 'warning',
        title: 'Ease the poses, not the travel',
        body: 'Eased forward motion makes the character surge and stall every step. The body\'s forward position should be linear; the joint angles and the hips\' height carry the easing.',
      },
      {
        type: 'warning',
        title: 'Match the first and last keys',
        body: 'If frame 25 differs from frame 1 even slightly, the loop pops once a second. Copy the first keys to the end rather than re-posing them.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: foot sliding',
        body: 'Viewers notice a sliding foot instantly: it breaks the illusion of weight. Games fix it at runtime by "foot locking", solving the leg with inverse kinematics so the foot stays where it landed.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "the foot moves with the body". The hips move steadily right; the foot is planted (orange) for part of the cycle and should hold still there, then swings forward (blue) to the next contact.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'foot() is the leg\'s forward kinematics (lesson 10.5); inCycle() is the loop; slide() follows the planted foot through the contact.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Each frame the skeleton is posed from the cycle\'s keys and uploaded as bone matrices (chapter 11); looping costs nothing, it only changes which frame is sampled.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Object › Trace foot sliding (active bone, 24-frame cycle) follows the active bone\'s tail through every frame: the path, the planted frames, the worst slide, and the loop check (predict the frame that must match frame 1). In a script: rig.traceFootSlide("Shin.L", 24, 0.05).' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: a walk cycle',
        caption: 'Four poses, a seamless loop, sliding feet, and one leg through a cycle.',
        props: {
          lesson: {
            title: 'A walk cycle',
            subtitle: 'Contact, down, passing, up.',
            cells: [
              { type: 'js', instruction: '### 1. Four poses\nPredict first: both feet at contact, the free foot at passing.', startCode: POSES },
              { type: 'js', instruction: '### 2. The loop\nPredict first: which frame frame 50 plays.', startCode: LOOP },
              { type: 'js', instruction: '### 3. Foot sliding\nPredict first: which sweep keeps the foot still.', startCode: SLIDE },
              { type: 'js', instruction: '### 4. See it\nOne leg through one cycle.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 250 },
              { type: 'challenge', instruction: '### 5. Challenge: walking speed\nThe check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkWalkSpeed },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "A walk cycle" in MeshLab](#/lab/mesh-lab?project=walk-sliding). The rigged character\'s walk, measured; the left ankle is traced: press Play, and predict the frame that must match frame 1.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Object › Trace foot sliding** with a leg bone active.\n- [Open "Walk cycle"](#/lab/mesh-lab?project=walk-cycle) to play and edit the walk.\n- In a script: `rig.bone("Thigh.L").keyframe(f, { rotation })`, `rig.traceFootSlide("Shin.L", 24)`.\n- **Elsewhere:** Richard Williams\' The Animator\'s Survival Kit; game-engine foot IK.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Cycles.** A cyclic channel satisfies $v(f + C) = v(f)$ for cycle length $C$; playback samples at $f_\\text{start} + ((f - f_\\text{start}) \\bmod C)$. The right leg is the left shifted: $v_R(f) = v_L(f + C/2)$.',
      '**Steady travel.** With stride $s$ per cycle and $C$ frames per cycle at $r$ fps, the speed is $s\\,r/C$.',
      '**No sliding.** For a straight leg of length $\\ell$ pivoting at the hip, the foot\'s horizontal position is $x_\\text{hip} + \\ell\\sin a$. Planted means $\\dot{x}_\\text{hip} + \\ell\\cos a\\,\\dot{a} = 0$: the angle must sweep back at $\\dot{a} = -\\dot{x}_\\text{hip}/(\\ell\\cos a)$. Keying $a$ linearly only approximates this; the error is small for small sweeps.',
    ],
    equations: [
      { label: 'Loop', latex: 'f \\mapsto f_0 + ((f - f_0) \\bmod C)' },
      { label: 'Right leg', latex: 'v_R(f) = v_L(f + C/2)' },
      { label: 'Speed', latex: '\\text{speed} = \\frac{s\\,r}{C}' },
      { label: 'Planted', latex: '\\dot{x}_\\text{hip} + \\ell\\cos a\\,\\dot{a} = 0' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** A walk cycle is a periodic map from frames to joint angles (period C) plus a linear root translation; the planted-foot condition is a holonomic constraint x_foot(f) = const on the contact interval, which forward kinematics satisfies only for the right angle schedule, and which inverse kinematics enforces exactly.',
      '**Invariant viewpoint.** Shifting the whole walk in time by any number of cycles changes nothing; shifting it by half a cycle swaps the legs.',
      '**Geometric picture.** Stand on one foot and walk your body over it: the foot does not move while the hip swings forward over it, like an upside-down pendulum.',
      '**Where this goes.** Lesson 10.7 stores the cycle in a file; chapter 11 skins a body to the skeleton that walks.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-10-006-ex1',
      title: 'The right leg',
      problem: 'The left thigh\'s contact key is at frame 1 of a 24-frame cycle. When does the right thigh hit the same pose?',
      steps: [{ expression: '1 + 24/2 = 13', annotation: 'Half a cycle later.' }],
      conclusion: 'Frame 13.',
    },
    {
      id: 'modelling-geometry-10-006-ex2',
      title: 'Wrapping',
      problem: 'A 24-frame cycle starting at 1. Which frame does frame 73 play?',
      steps: [{ expression: '1 + (72 \\bmod 24) = 1', annotation: '72 is three whole cycles.' }],
      conclusion: 'Frame 1.',
    },
    {
      id: 'modelling-geometry-10-006-ex3',
      title: 'A running cycle',
      problem: 'A run covers 2.4 m in a 16-frame cycle at 24 fps. Speed?',
      steps: [{ expression: '2.4 \\times 24 / 16 = 3.6', annotation: 'm/s.' }],
      conclusion: '3.6 m/s.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-10-006-ch1',
      difficulty: 'easy',
      problem: 'Why can the right leg reuse the left leg\'s keys?',
      walkthrough: [{ expression: 'v_R(f) = v_L(f + C/2)', annotation: 'The same motion, half a cycle apart.' }],
      answer: 'A walk is symmetric: the right leg does exactly what the left did, half a cycle later. Reusing the keys with a shift halves the work and keeps the two legs consistent.',
    },
    {
      id: 'modelling-geometry-10-006-ch2',
      difficulty: 'medium',
      problem: 'Why should the body\'s forward position be keyed linear, not eased?',
      walkthrough: [{ expression: '\\text{ease at every key} \\Rightarrow \\text{stop-start}', annotation: 'Speed drops to zero at each key.' }],
      answer: 'Easing makes the speed zero at every key, so an eased root surges and stalls each step. A walking body\'s forward speed is nearly constant; the up-and-down of the hips carries the weight shift instead.',
    },
    {
      id: 'modelling-geometry-10-006-ch3',
      difficulty: 'hard',
      problem: 'Show that a straight leg of length 1 keeps its foot still if the hips move from −0.12 to 0.12 while the leg angle goes from asin(0.12) to −asin(0.12), and estimate the slide when the angle is keyed linearly instead.',
      walkthrough: [
        { expression: 'x_\\text{foot} = x_\\text{hip} + \\sin a', annotation: 'Forward kinematics.' },
        { expression: 'a(t) = -\\arcsin(x_\\text{hip}(t))', annotation: 'Keeps x_foot = 0.' },
        { expression: 'a_\\text{lin}(t) + \\arcsin x_\\text{hip}(t) = O(a^3)', annotation: 'arcsin x = x + x³/6 + …, so a linear schedule is off by a cubic term.' },
      ],
      answer: 'x_foot = x_hip + sin a is 0 for every frame exactly when a = −asin(x_hip). Keying a linearly from 0.12 to −0.12 (cell 3; asin(0.12) = 0.1203) differs from −asin(x_hip) by terms of order a³/6 ≈ 0.0003: under a millimetre, which is why cell 3\'s matched sweep slides 0.0006 while the mismatched ones slide 0.12 and 0.24.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'C', meaning: 'The cycle length in frames.' },
      { symbol: 'f_0 + ((f - f_0) \\bmod C)', meaning: 'Which frame of the cycle frame f plays.' },
      { symbol: 'C/2', meaning: 'The right leg\'s delay.' },
      { symbol: 'sr/C', meaning: 'Walking speed: stride × fps / cycle.' },
      { symbol: '\\text{contact, down, passing, up}', meaning: 'The four key poses of a step.' },
      { symbol: '\\text{foot sliding}', meaning: 'A planted foot moving in the world.' },
    ],
    rulesOfThumb: [
      'Two steps per cycle.',
      'Right leg = left leg, half a cycle later.',
      'Last keys = first keys.',
      'Linear travel, eased poses.',
      'Planted feet must not move.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-10-005', label: 'Motion through a hierarchy', note: 'The leg\'s forward kinematics.' },
      { lessonId: 'modelling-geometry-10-002', label: 'Interpolation and easing', note: 'Which channels to ease.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-10-007', label: 'Animation in files', note: 'Storing the cycle.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-10-006-1', label: 'Read the four key poses of a step', type: 'read' },
    { id: 'cp-modelling-geometry-10-006-2', label: 'Read how a cycle loops', type: 'read' },
    { id: 'cp-modelling-geometry-10-006-3', label: 'Read why planted feet slide', type: 'read' },
    { id: 'cp-modelling-geometry-10-006-4', label: 'Run cells 1 to 3: poses, loop, sliding', type: 'lab' },
    { id: 'cp-modelling-geometry-10-006-5', label: 'Trace foot sliding in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-10-006-6', label: 'Work through example 2, wrapping', type: 'example' },
    { id: 'cp-modelling-geometry-10-006-7', label: 'Work through example 3, a running cycle', type: 'example' },
    { id: 'cp-modelling-geometry-10-006-8', label: 'Complete the challenge: walking speed', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-10-006-assess-1',
        type: 'choice',
        text: 'In a 24-frame cycle starting at frame 1, frame 30 plays frame:',
        options: ['6', '30', '5', '7'],
        answer: '6',
        hint: '1 + (29 mod 24).',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-10-006-quiz-1',
      type: 'choice',
      text: 'The four key poses of a step are:',
      options: ['Contact, down, passing, up', 'Start, middle, end, loop', 'Left, right, left, right', 'Heel, toe, knee, hip'],
      answer: 'Contact, down, passing, up',
      hints: ['Cell 1.', 'Procedure, Step 2.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-10-006-quiz-2',
      type: 'choice',
      text: 'Frame 50 of a 24-frame cycle starting at 1 plays frame:',
      options: ['2', '26', '50', '1'],
      answer: '2',
      hints: ['Cell 2.', '1 + (49 mod 24).'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-10-006-quiz-3',
      type: 'choice',
      text: 'The right leg uses the left leg\'s keys:',
      options: ['Half a cycle later', 'Mirrored in time', 'One frame later', 'It needs its own keys'],
      answer: 'Half a cycle later',
      hints: ['Challenge 1.', 'C/2.'],
      reviewSection: 'Challenge',
    },
    {
      id: 'modelling-geometry-10-006-quiz-4',
      type: 'choice',
      text: 'A planted foot slides when:',
      options: ['Its leg does not sweep back at the body\'s forward speed', 'The cycle is too long', 'The keys are eased', 'The hips dip'],
      answer: 'Its leg does not sweep back at the body\'s forward speed',
      hints: ['Cell 3.', 'Math, No sliding.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-10-006-quiz-5',
      type: 'choice',
      text: 'The body\'s forward position in a walk should be keyed:',
      options: ['Linear', 'Ease', 'Ease-in', 'Constant'],
      answer: 'Linear',
      hints: ['Warning "Ease the poses, not the travel".', 'Challenge 2.'],
      reviewSection: 'Warning "Ease the poses, not the travel"',
    },
    {
      id: 'modelling-geometry-10-006-quiz-6',
      type: 'choice',
      text: 'For a seamless loop, the keys at frame 25 (of a 24-frame cycle from frame 1) must:',
      options: ['Equal those at frame 1', 'Be empty', 'Be eased', 'Differ slightly'],
      answer: 'Equal those at frame 1',
      hints: ['Cell 2.', 'Warning "Match the first and last keys".'],
      reviewSection: 'Cell 2',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'The feet move along with the body.',
      whyStudentsThinkIt: 'The whole character moves forward.',
      correctionExample: 'The picture: the planted foot holds still while the hips pass over it.',
      contrastCase: 'The swinging foot does move, faster than the body.',
    },
    {
      falseBelief: 'Easing everything makes a walk smoother.',
      whyStudentsThinkIt: 'Easing is smooth.',
      correctionExample: 'Eased travel surges and stalls every step (challenge 2).',
      contrastCase: 'Eased joint angles are what make the poses flow.',
    },
    {
      falseBelief: 'A loop just needs the animation to end where it starts roughly.',
      whyStudentsThinkIt: 'Small differences seem invisible.',
      correctionExample: 'Any difference at frame 25 pops once per cycle, every second.',
      contrastCase: 'The root\'s forward position is meant to differ: it keeps travelling.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A game character must walk at different speeds with one walk cycle.',
      competingTechniques: ['Play the cycle faster', 'Scale the stride with speed and correct the feet with IK'],
      whyThisTechniqueWins: 'Playing faster changes the cadence but not the stride, so the feet slide; matching the stride to the speed (and IK foot locking) keeps feet planted.',
    },
    {
      situation: 'An animation loops but pops once a second.',
      competingTechniques: ['Add more keys in the middle', 'Copy the first frame\'s keys exactly to the last frame'],
      whyThisTechniqueWins: 'The pop is a mismatch between the cycle\'s end and start; making them identical removes it.',
    },
  ],

  debugging: [
    {
      commonError: 'The right leg keyed independently of the left.',
      symptom: 'Limping or asymmetric steps.',
      whyItHappened: 'The two legs\' timings drift apart.',
      repairStrategy: 'Copy the left leg\'s keys to the right, shifted half a cycle.',
    },
    {
      commonError: 'Ease on the root\'s forward motion.',
      symptom: 'The character surges every step.',
      whyItHappened: 'Speed drops to zero at each key.',
      repairStrategy: 'Linear interpolation for forward travel.',
    },
    {
      commonError: 'Feet slide during contact.',
      symptom: 'The character looks like it is skating.',
      whyItHappened: 'Leg sweep and body speed do not match.',
      repairStrategy: 'Measure the slide (Trace foot sliding) and adjust the sweep, or pin the foot with IK.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Key a walk cycle that loops and measure its foot sliding.',
    explainVerbally: 'Explain the four poses, the half-cycle offset, looping and sliding.',
    detectIncorrectApplication: 'Recognise mismatched loops, eased travel and sliding feet.',
    transferToUnfamiliar: 'Build runs, crawls and other cycles.',
  },
};
