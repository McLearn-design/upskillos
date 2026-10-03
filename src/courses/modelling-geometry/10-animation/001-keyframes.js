// Lesson 10.1: keyframes. An animated value is a piecewise function of time: keys pin it at chosen frames, and every
// other frame is computed from the two keys around it, t = (f − f₀)/(f₁ − f₀), value = v₀ + t (v₁ − v₀). Before the
// first key the first value holds; after the last, the last. Finding the gap is a search; drawing a frame means
// sampling every animated channel at that frame and redrawing.

const BASE = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
// Keys: { frame, value }, sorted by frame. Sample a channel at any frame (linear between keys, held outside them).
function sample(keys, f) {
  if (f <= keys[0].frame) return keys[0].value
  if (f >= keys[keys.length - 1].frame) return keys[keys.length - 1].value
  let i = 0
  while (keys[i + 1].frame < f) i++
  const k0 = keys[i], k1 = keys[i + 1], t = (f - k0.frame) / (k1.frame - k0.frame)
  return k0.value + t * (k1.value - k0.value)
}
`;

const PIECEWISE = `${BASE}
// The box from MeshLab's "Keyframes" project: x keyed at −3, 0, 3 on frames 1, 25, 49.
// Predict first: x at frame 7, and at frame 60.
const x = [{ frame: 1, value: -3 }, { frame: 25, value: 0 }, { frame: 49, value: 3 }]
for (const f of [1, 7, 13, 25, 37, 49, 60]) console.log('frame ' + f + ': x = ' + r(sample(x, f)))`;

const TIME = `${BASE}
// Frames are time: at 24 frames per second, frame f is (f − 1) / 24 seconds after the start.
// The same keys played at 12 fps take twice as long. Predict first: how long does the move from frame 1 to 49 take?
for (const fps of [24, 30, 12]) console.log(fps + ' fps: frames 1 → 49 take ' + r((49 - 1) / fps) + ' s')
// Sampling at a time between frames (motion blur, slow motion) works the same way: f can be any number.
const x = [{ frame: 1, value: -3 }, { frame: 25, value: 0 }]
console.log('at frame 7.5: x = ' + r(sample(x, 7.5)))`;

const SEARCH = `${BASE}
// With many keys, which gap is the frame in? A walk from the start checks them one by one; a binary search halves
// the range each time. Predict first: how many checks does each need for 1000 keys?
const keys = Array.from({ length: 1000 }, (_, i) => ({ frame: i * 2, value: Math.sin(i / 20) }))
function walk(f) { let i = 0, checks = 0; while (keys[i + 1].frame < f) { i++; checks++ } return checks + 1 }
function binary(f) { let lo = 0, hi = keys.length - 1, checks = 0; while (hi - lo > 1) { const mid = (lo + hi) >> 1; checks++; if (keys[mid].frame < f) lo = mid; else hi = mid } return checks }
for (const f of [3, 1001, 1997]) console.log('frame ' + f + ': walking ' + walk(f) + ' checks, binary search ' + binary(f))`;

const PICTURE = `${BASE}
// A graph editor: the box's x and y against the frame, with the keys as dots. Between keys, straight lines.
const x = [{ frame: 1, value: -3 }, { frame: 25, value: 0 }, { frame: 49, value: 3 }]
const y = [{ frame: 1, value: 0.3 }, { frame: 25, value: 2.3 }, { frame: 49, value: 0.3 }]
const canvas = document.createElement('canvas'), W = 380, H = 220
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'); g.scale(2, 2); g.fillStyle = '#0f1923'; g.fillRect(0, 0, W, H)
const X = (f) => 30 + (f - 1) / 59 * (W - 50), Y = (v) => H / 2 - v * 28
g.strokeStyle = '#334155'; g.beginPath(); g.moveTo(30, Y(0)); g.lineTo(W - 20, Y(0)); g.stroke()
for (const [keys, colour, name] of [[x, '#f87171', 'x'], [y, '#4ade80', 'y']]) {
  g.strokeStyle = colour; g.lineWidth = 2; g.beginPath()
  for (let f = 1; f <= 60; f += 0.25) (f === 1 ? g.moveTo : g.lineTo).call(g, X(f), Y(sample(keys, f)))
  g.stroke(); g.fillStyle = colour
  for (const k of keys) { g.beginPath(); g.arc(X(k.frame), Y(k.value), 4, 0, 2 * Math.PI); g.fill() }
  g.font = '11px sans-serif'; g.fillText(name, X(60) - 4, Y(sample(keys, 60)) - 6)
}
g.fillStyle = '#cbd5e1'; g.font = '10px sans-serif'; g.fillText('frame 1', 22, H - 6); g.fillText('frame 60', W - 60, H - 6)
console.log('keys at frames ' + x.map((k) => k.frame).join(', '))`;

const CHALLENGE = `// A door's angle is keyed at 2° on frame 10 and 92° on frame 40, linear. What is its angle on frame 16?
const angle = 0
console.log(angle)`;

const SOLVED = CHALLENGE.replace('const angle = 0', 'const angle = 2 + (16 - 10) / (40 - 10) * (92 - 2)');

/** The challenge's check: t = 6/30 = 0.2; 2 + 0.2 × 90 = 20. */
export function checkKeyValue(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+angle\s*=\s*([^\n]+)/);
  if (!m) return no('Keep the line const angle = …, with a number or plain arithmetic.');
  const e = m[1].replace(/\/\/.*$/, '').trim().replace(/;$/, '');
  if (!/^[\d.\s+\-*/()]+$/.test(e)) return no('Write the angle as a number or plain arithmetic.');
  let v;
  try { v = Number(new Function('return (' + e + ')')()); } catch { return no('That expression did not run.'); }
  const near = (x) => Math.abs(v - x) < 1e-6;
  if (near(20)) return { pass: true, message: '20°: frame 16 is 6 of the 30 frames between the keys, t = 0.2; the angle moves 0.2 of the way from 2° to 92°: 2 + 0.2 × 90 = 20°.' };
  if (v === 0) return no('How far through the gap from frame 10 to frame 40 is frame 16? Then move that fraction of the way from 2° to 92°.');
  if (near(18)) return no('18 = 0.2 × 90 is how far it has turned since the first key; add the first key\'s 2°.');
  if (near(92 * 16 / 40) || near(2 + 90 * 16 / 40)) return no('t counts from the first key: (16 − 10) / (40 − 10), not 16 / 40.');
  if (near(2 + 90 * 16 / 30)) return no('t is (16 − 10) / 30: subtract the first key\'s frame first.');
  return no(`${+v.toFixed(3)}°: t = (16 − 10) / (40 − 10), then 2 + t × (92 − 2).`);
}

export default {
  id: 'modelling-geometry-10-001',
  slug: 'keyframes',
  chapter: 'modelling-geometry',
  order: 1,
  title: 'Keyframes',
  subtitle: 'Animation as a piecewise function of time: keys pin a value at chosen frames, and every frame between is worked out from the two around it.',
  tags: ['animation', 'keyframes', 'interpolation', 'timeline', 'piecewise functions', 'binary search'],
  coreConcept: 'An animated value is a piecewise function of time. Keys pin it to chosen values at chosen frames; for any other frame f, the two keys around it give t = (f − f₀)/(f₁ − f₀), how far through the gap the frame is, and the value is v₀ + t (v₁ − v₀) for linear keys (lesson 10.2 bends t). Before the first key the first value holds, after the last the last. Frames are time, (f − 1)/fps seconds from the start, and sampling works at any time, not only whole frames. With many keys, the gap is found by binary search; playing an animation means sampling every animated channel at the current frame and redrawing.',
  prerequisites: ['modelling-geometry-2-002'],
  timeToComplete: 30,
  nextLesson: 'modelling-geometry-10-002',

  hook: {
    question: 'An animator moving a character\'s arm sets its pose at a handful of frames, and the software fills in the other hundred. What is the rule that fills them in, and what does "frame 37" mean to a computer?',
    realWorldContext: 'Keyframes drive animation in Blender, Maya, After Effects, CSS (@keyframes), game engines and glTF files. Motion capture produces a key on every frame; hand animation uses a few keys and lets interpolation do the rest.',
  },

  intuition: {
    prose: [
      'A **keyframe** pins a value (an object\'s position, a rotation, a scale) at one frame. Between two keys the software interpolates: it works out how far through the gap the frame is, $t = (f - f_0)/(f_1 - f_0)$, from 0 at the first key to 1 at the second, and moves the value that fraction of the way: $v_0 + t\\,(v_1 - v_0)$. Before running cell 1, predict the box\'s $x$ at frame 7, a quarter of the way from frame 1 to frame 25: $-2.25$.',
      'Outside the keys the value **holds**: before the first key it is the first value, after the last it is the last. Before running cell 1, predict $x$ at frame 60: still 3.',
      '**Frames are time.** At 24 frames per second, frame $f$ is $(f - 1)/24$ seconds from the start; the same keys played at 12 fps take twice as long. Nothing stops sampling at frame 7.5: that is how motion blur and slow motion work. Before running cell 2, predict how long frames 1 to 49 take at 24 fps: 2 seconds.',
      'Long animations have thousands of keys. Walking from the start to find the right gap gets slow; a **binary search** halves the range each step. Before running cell 3, predict the number of checks for 1000 keys: about 10 ($2^{10} = 1024$).',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Sampling a channel at frame f',
        body: 'Step 1. If f is at or before the first key, return its value; at or after the last, return the last.\nStep 2. Find the keys k₀, k₁ with k₀.frame ≤ f < k₁.frame (binary search for long channels).\nStep 3. t = (f − k₀.frame)/(k₁.frame − k₀.frame).\nStep 4. s = ease(t) from k₀\'s interpolation (lesson 10.2; linear: s = t).\nStep 5. value = v₀ + s (v₁ − v₀), per component.',
      },
      {
        type: 'warning',
        title: 'Keys must be in order',
        body: 'Sampling assumes keys sorted by frame. Inserting a key at the end of the list instead of in its place makes the search pick the wrong gap. MeshLab inserts keys in order (setKey), and replaces a key at the same frame.',
      },
      {
        type: 'warning',
        title: 'Linear keys make corners',
        body: 'Straight-line interpolation changes speed instantly at every key: the box\'s y goes up and turns down with a sharp corner. Real motion eases in and out (lesson 10.2).',
      },
      {
        type: 'insight',
        title: 'The graphics strand: redrawing per frame',
        body: 'Playing an animation is a loop: advance the frame, sample every animated channel, rebuild the world matrices (lesson 2.5), draw. MeshLab\'s timeline does exactly that 24 times a second.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "an animation stores every frame". The two curves are the box\'s x and y; only the dots are stored. Every other point is computed when needed, and the corners at the dots are where linear keys change direction.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'sample() is the procedure; binary() in cell 3 is Step 2 for long channels.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'The GPU never sees keys: each frame, the CPU samples them into transforms and uploads the matrices. (Skinned characters, chapter 11, upload one matrix per bone.)' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Press I to insert a key for the selected object at the current frame; the Timeline shows and plays the keys. Object › Trace sampling the keys (this frame) traces the keys, t, the easing and the blend (predict the value). In a script: obj.keyframe(frame, { position }), obj.traceSample(channel, frame).' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: keyframes',
        caption: 'Sampling keys, frames as time, finding the gap, and the curves a graph editor draws.',
        props: {
          lesson: {
            title: 'Keyframes',
            subtitle: 'Pin a few frames; compute the rest.',
            cells: [
              { type: 'js', instruction: '### 1. A piecewise function\nPredict first: x at frames 7 and 60.', startCode: PIECEWISE },
              { type: 'js', instruction: '### 2. Frames are time\nPredict first: frames 1 to 49 at 24 fps.', startCode: TIME },
              { type: 'js', instruction: '### 3. Finding the gap\nPredict first: checks for 1000 keys.', startCode: SEARCH },
              { type: 'js', instruction: '### 4. See it\nThe graph editor.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 270 },
              { type: 'challenge', instruction: '### 5. Challenge: a door\nThe check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkKeyValue },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Keyframes" in MeshLab](#/lab/mesh-lab?project=keyframes). A box with three keys; frame 7 is traced: press Play, and predict its position.' },
              { type: 'markdown', instruction: '### Use the tool\n- **I** inserts a key at the current frame; the **Timeline** tab plays and scrubs.\n- **Object › Trace sampling the keys (this frame).**\n- In a script: `obj.keyframe(25, { position: [0, 2, 0] })`, `obj.traceSample("position", 13)`.\n- [Open "Bouncing ball"](#/lab/mesh-lab?project=bouncing-ball) for keys that model gravity.\n- **Elsewhere:** Blender\'s Graph Editor and Dope Sheet, CSS @keyframes.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Piecewise linear interpolation.** For keys $(f_0, v_0), \\ldots, (f_n, v_n)$ with $f_0 < \\ldots < f_n$: $v(f) = v_i + \\frac{f - f_i}{f_{i+1} - f_i}(v_{i+1} - v_i)$ for $f_i \\le f \\le f_{i+1}$, $v(f) = v_0$ for $f < f_0$ and $v_n$ for $f > f_n$. It is continuous, but its slope jumps at each key.',
      '**Time.** With frame rate $r$, frame $f$ is at time $(f - f_\\text{start})/r$; the velocity between keys is $(v_{i+1} - v_i)\\,r/(f_{i+1} - f_i)$ units per second.',
      '**Search.** Finding $i$ with $f_i \\le f < f_{i+1}$ by binary search takes $\\lceil \\log_2 n \\rceil$ comparisons; when playing forwards, starting from the previous frame\'s gap makes it nearly free.',
    ],
    equations: [
      { label: 'How far', latex: 't = \\frac{f - f_0}{f_1 - f_0}' },
      { label: 'Linear', latex: 'v(f) = v_0 + t\\,(v_1 - v_0)' },
      { label: 'Time', latex: '\\text{seconds} = \\frac{f - f_\\text{start}}{\\text{fps}}' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** Linear key interpolation defines the unique continuous function that is affine on each interval [f_i, f_{i+1}] and passes through every key; with clamping outside, it is defined for every real f.',
      '**Invariant viewpoint.** Changing the frame rate rescales time but not the shape of the motion: the same keys give the same path, slower or faster.',
      '**Geometric picture.** Plot the value against the frame and join the dots with a ruler: that drawing is the animation.',
      '**Where this goes.** Lesson 10.2 bends the straight segments with easing; 10.4 interpolates rotations properly; 10.7 stores keys in files.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-10-001-ex1',
      title: 'Halfway',
      problem: 'Keys: 0 at frame 1, 10 at frame 11. Value at frame 6?',
      steps: [{ expression: 't = 5/10 = 0.5, \\; 0 + 0.5 \\cdot 10 = 5', annotation: 'Linear.' }],
      conclusion: '5.',
    },
    {
      id: 'modelling-geometry-10-001-ex2',
      title: 'Speed',
      problem: 'A box moves 6 m between keys 48 frames apart at 24 fps. How fast?',
      steps: [{ expression: '6 / (48/24) = 3', annotation: 'Metres per second.' }],
      conclusion: '3 m/s.',
    },
    {
      id: 'modelling-geometry-10-001-ex3',
      title: 'After the last key',
      problem: 'The last key is 4 at frame 30. Value at frame 100?',
      steps: [{ expression: 'f > f_n \\Rightarrow v_n', annotation: 'Held.' }],
      conclusion: '4.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-10-001-ch1',
      difficulty: 'easy',
      problem: 'Why does a value hold after the last key instead of continuing at its last speed?',
      walkthrough: [{ expression: 'v(f) = v_n, \\; f > f_n', annotation: 'Clamping.' }],
      answer: 'Holding is the predictable default: an object stops where its last key put it. Extrapolating would send it off at its last speed forever; tools offer that as an option, not the default.',
    },
    {
      id: 'modelling-geometry-10-001-ch2',
      difficulty: 'medium',
      problem: 'Keys at frames 1, 25 and 49 with linear interpolation. Is the motion smooth at frame 25?',
      walkthrough: [{ expression: '\\text{slope } +2/24 \\to -2/24 \\text{ in } y', annotation: 'The velocity jumps.' }],
      answer: 'The position is continuous but the velocity jumps at the key (the y curve has a corner there), which reads as a sudden change of direction. Easing or smooth splines make the velocity continuous too.',
    },
    {
      id: 'modelling-geometry-10-001-ch3',
      difficulty: 'hard',
      problem: 'Explain why sampling during playback can find the gap in constant time on average, even without binary search.',
      walkthrough: [{ expression: 'f_{\\text{now}} = f_{\\text{previous}} + 1', annotation: 'Frames advance by one.' }],
      answer: 'During playback each frame is just after the previous one, so the gap is either the same as last time or the next one. Remembering the previous gap and walking forward from it costs O(1) per frame on average; binary search is only needed when jumping to an arbitrary frame.',
    },
  ],

  semantics: {
    core: [
      { symbol: '(f_i, v_i)', meaning: 'A key: a value pinned at a frame.' },
      { symbol: 't', meaning: 'How far through the gap between two keys, 0 to 1.' },
      { symbol: 'v_0 + t(v_1 - v_0)', meaning: 'Linear interpolation.' },
      { symbol: '\\text{fps}', meaning: 'Frames per second: converts frames to time.' },
      { symbol: '\\log_2 n', meaning: 'Checks a binary search needs among n keys.' },
      { symbol: '\\text{hold}', meaning: 'The value outside the keys: the nearest key\'s.' },
    ],
    rulesOfThumb: [
      'Store a few keys; compute the rest.',
      't counts from the first key.',
      'Values hold outside the keys.',
      'Frames are time: divide by fps.',
      'Linear keys make corners.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-2-002', label: 'Translate, rotate, scale', note: 'The channels keys animate.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-10-002', label: 'Interpolation and easing', note: 'Bending t for natural motion.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-10-001-1', label: 'Read keys as a piecewise function', type: 'read' },
    { id: 'cp-modelling-geometry-10-001-2', label: 'Read frames as time', type: 'read' },
    { id: 'cp-modelling-geometry-10-001-3', label: 'Read finding the gap', type: 'read' },
    { id: 'cp-modelling-geometry-10-001-4', label: 'Run cells 1 to 3: sampling, time, search', type: 'lab' },
    { id: 'cp-modelling-geometry-10-001-5', label: 'Trace sampling a key in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-10-001-6', label: 'Work through example 1, halfway', type: 'example' },
    { id: 'cp-modelling-geometry-10-001-7', label: 'Work through example 2, speed', type: 'example' },
    { id: 'cp-modelling-geometry-10-001-8', label: 'Complete the challenge: a door', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-10-001-assess-1',
        type: 'choice',
        text: 'Keys: 10 at frame 20, 30 at frame 40. Value at frame 35?',
        options: ['25', '35', '17.5', '26.25'],
        answer: '25',
        hint: 't = 15/20.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-10-001-quiz-1',
      type: 'choice',
      text: 'The box\'s x at frame 7, between −3 at frame 1 and 0 at frame 25:',
      options: ['−2.25', '−1.5', '0.875', '−2.75'],
      answer: '−2.25',
      hints: ['Cell 1.', 't = 6/24.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-10-001-quiz-2',
      type: 'choice',
      text: 'After the last key, a channel:',
      options: ['Holds the last key\'s value', 'Continues at its last speed', 'Returns to the first value', 'Is undefined'],
      answer: 'Holds the last key\'s value',
      hints: ['Cell 1, frame 60.', 'Clamping.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-10-001-quiz-3',
      type: 'choice',
      text: 'Frames 1 to 49 at 24 fps take:',
      options: ['2 seconds', '49 seconds', '1 second', '24 seconds'],
      answer: '2 seconds',
      hints: ['Cell 2.', '48 / 24.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-10-001-quiz-4',
      type: 'choice',
      text: 'Binary search among 1000 keys needs about:',
      options: ['10 checks', '1000', '500', '1'],
      answer: '10 checks',
      hints: ['Cell 3.', '2¹⁰ = 1024.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-10-001-quiz-5',
      type: 'choice',
      text: 'With linear keys, at each key the motion\'s:',
      options: ['Velocity can jump (a corner)', 'Position jumps', 'Nothing changes', 'Time stops'],
      answer: 'Velocity can jump (a corner)',
      hints: ['Warning "Linear keys make corners".', 'Challenge 2.'],
      reviewSection: 'Warning "Linear keys make corners"',
    },
    {
      id: 'modelling-geometry-10-001-quiz-6',
      type: 'choice',
      text: 'What does an animation file store for a hand-keyed move?',
      options: ['The keys only', 'Every frame', 'A video', 'The velocity'],
      answer: 'The keys only',
      hints: ['The picture.', 'Everything else is computed.'],
      reviewSection: 'Cell 4',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'An animation stores every frame.',
      whyStudentsThinkIt: 'Video does.',
      correctionExample: 'The picture: three dots per curve; every other point is computed on demand.',
      contrastCase: 'Motion capture and baked animation do store a key on every frame.',
    },
    {
      falseBelief: 't is the frame divided by the last frame.',
      whyStudentsThinkIt: 'It is "how far through".',
      correctionExample: 'The challenge: t counts through the gap between the two surrounding keys, (f − f₀)/(f₁ − f₀).',
      contrastCase: 'With one gap starting at frame 0, the two agree.',
    },
    {
      falseBelief: 'Only whole frames can be sampled.',
      whyStudentsThinkIt: 'The timeline shows whole frames.',
      correctionExample: 'Cell 2: frame 7.5 works exactly the same, which is how motion blur and slow motion work.',
      contrastCase: 'Constant (stepped) keys only change at whole frames by design.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A UI panel must slide in over 0.3 s on a 60 Hz display.',
      competingTechniques: ['Move it a fixed amount each frame', 'Key its position at time 0 and 0.3 s and sample at each frame\'s time'],
      whyThisTechniqueWins: 'Sampling by time gives the same motion at any frame rate; per-frame steps run slow on a slow display.',
    },
    {
      situation: 'A long motion-capture take has 30 000 keys per channel and scrubbing is slow.',
      competingTechniques: ['Walk the keys from the start', 'Binary search, and remember the last gap during playback'],
      whyThisTechniqueWins: 'Binary search finds a gap in about 15 checks; playback from the last gap is nearly free.',
    },
  ],

  debugging: [
    {
      commonError: 'Keys appended out of frame order.',
      symptom: 'The object jumps or moves backwards between keys.',
      whyItHappened: 'The search assumes sorted keys.',
      repairStrategy: 'Insert keys in order (or sort after adding).',
    },
    {
      commonError: 'Computing t from the start of the animation.',
      symptom: 'Values overshoot or lag between keys.',
      whyItHappened: 't must count through the current gap.',
      repairStrategy: 't = (f − f₀)/(f₁ − f₀) with the surrounding keys.',
    },
    {
      commonError: 'Dividing by zero for two keys on the same frame.',
      symptom: 'NaN positions.',
      whyItHappened: 'f₁ − f₀ = 0.',
      repairStrategy: 'Replace a key at an existing frame instead of adding a second one.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Sample keys at any frame or time, and find the gap efficiently.',
    explainVerbally: 'Explain keys as a piecewise function, holding, and frames as time.',
    detectIncorrectApplication: 'Recognise unsorted keys, t from the wrong origin and duplicate frames.',
    transferToUnfamiliar: 'Use keyed animation in UIs, games and files.',
  },
};
