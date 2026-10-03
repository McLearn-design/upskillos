// Lesson 10.7: animation in files. A glTF animation is channels (a node and a property) and samplers (input times in
// seconds, output values, an interpolation). MeshLab bakes every frame because its easings are not glTF's; this lesson
// builds the structure by hand, counts its bytes, and measures what baking buys over storing the keys alone.

const CLIP = `// The glTF animation for a scene: a Ball whose position is keyed, a Box whose rotation and scale are keyed.
// Predict first: how many channels does the file need?
const keyed = { Ball: ['translation'], Box: ['rotation', 'scale'] }
const animation = { channels: [], samplers: [] }
for (const [node, paths] of Object.entries(keyed)) {
  for (const path of paths) {
    animation.samplers.push({ input: 'times', output: node + ' ' + path + ' values', interpolation: 'LINEAR' })
    animation.channels.push({ sampler: animation.samplers.length - 1, target: { node, path } })
  }
}
console.log(animation.channels.length + ' channels')
for (const c of animation.channels) console.log('channel → ' + c.target.node + '.' + c.target.path + ' uses sampler ' + c.sampler)`;

const BYTES = `// One sampler's data: input times in seconds, output values. 49 frames (1 to 49) at 24 fps.
// Predict first: the time of the last key, and the bytes for the three samplers of cell 1.
const start = 1, end = 49, fps = 24
const times = new Float32Array(end - start + 1).map((_, i) => i / fps)
console.log(times.length + ' keys, from ' + times[0] + ' s to ' + times[times.length - 1] + ' s')
const floatsPerKey = { translation: 3, rotation: 4, scale: 3 }        // rotation: a quaternion (x, y, z, w)
let bytes = 0
for (const path of ['translation', 'rotation', 'scale']) {
  const b = times.byteLength + 4 * times.length * floatsPerKey[path]   // its own input, then its output
  console.log(path + ': ' + times.byteLength + ' + ' + (b - times.byteLength) + ' = ' + b + ' bytes')
  bytes += b
}
console.log('total ' + bytes + ' bytes')`;

const BAKE = `const r = (x) => +x.toFixed(4)
// The ball falls with ease-in (s = t²) from height 2.4 at frame 1 to 0.4 at frame 25. glTF has no ease-in:
// a player only does STEP, LINEAR or CUBICSPLINE. Store keys every n frames with LINEAR between them, and measure
// the worst height error, sampling 10 points between frames as a player at a higher frame rate would.
// Predict first: the error with keys only at frames 1 and 25.
const truth = (f) => 2.4 - 2 * ((f - 1) / 24) ** 2
function worst(n) {
  let w = 0
  for (let k = 0; k < 24 * 10; k++) {
    const f = 1 + k / 10, a = 1 + Math.floor((f - 1) / n) * n, b = Math.min(25, a + n)
    const lin = truth(a) + ((f - a) / (b - a)) * (truth(b) - truth(a))
    w = Math.max(w, Math.abs(lin - truth(f)))
  }
  return w
}
for (const n of [24, 4, 1]) console.log('a key every ' + (n === 1 ? 'frame' : n + ' frames') + ': ' + (24 / n + 1) + ' keys, worst error ' + r(worst(n)))`;

const PICTURE = `// The ball's height over the fall: the true ease-in curve (white), the baked keys (orange dots, every 2 frames),
// and the two-key LINEAR line a player would draw without baking (blue).
const truth = (f) => 2.4 - 2 * ((f - 1) / 24) ** 2
const canvas = document.createElement('canvas'), W = 380, H = 220
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'); g.scale(2, 2); g.fillStyle = '#0f1923'; g.fillRect(0, 0, W, H)
const X = (f) => 40 + (f - 1) * 13, Y = (y) => H - 30 - y * 70
g.strokeStyle = '#334155'; g.beginPath(); g.moveTo(X(1), Y(0)); g.lineTo(X(25), Y(0)); g.moveTo(X(1), Y(0)); g.lineTo(X(1), Y(2.6)); g.stroke()
g.strokeStyle = '#e2e8f0'; g.lineWidth = 2; g.beginPath()
for (let k = 0; k <= 240; k++) { const f = 1 + k / 10; k ? g.lineTo(X(f), Y(truth(f))) : g.moveTo(X(f), Y(truth(f))) }
g.stroke()
g.strokeStyle = '#60a5fa'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(1), Y(2.4)); g.lineTo(X(25), Y(0.4)); g.stroke()
g.fillStyle = '#f59e0b'
let dots = 0
for (let f = 1; f <= 25; f += 2) { g.beginPath(); g.arc(X(f), Y(truth(f)), 3, 0, 2 * Math.PI); g.fill(); dots++ }
g.fillStyle = '#cbd5e1'; g.font = '11px sans-serif'
g.fillText('height', 6, Y(2.6) + 4); g.fillText('frame 1', X(1) - 14, H - 12); g.fillText('frame 25', X(25) - 22, H - 12)
g.fillText('white: ease-in; orange: baked keys; blue: two keys, LINEAR', 50, Y(0.2))
console.log('baked keys drawn: ' + dots)`;

const CHALLENGE = `// A character's walk is exported with 20 bones keyed (rotation only) and the root's translation keyed, for frames
// 1 to 61 at 30 fps, every frame baked. How many bytes of float data does the clip hold?
const bytes = 0
console.log(bytes)`;

const SOLVED = CHALLENGE.replace('const bytes = 0', 'const bytes = 20 * 4 * 61 * (1 + 4) + 4 * 61 * (1 + 3)');

/** The challenge's check: 21 samplers of 61 keys: 20 × 4·61·5 + 4·61·4 = 25376 bytes. */
export function checkClipBytes(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+bytes\s*=\s*([^\n]+)/);
  if (!m) return no('Keep the line const bytes = …, with a number or plain arithmetic.');
  const e = m[1].replace(/\/\/.*$/, '').trim().replace(/;$/, '');
  if (!/^[\d.\s+\-*/()]+$/.test(e)) return no('Write the bytes as a number or plain arithmetic.');
  let v;
  try { v = Number(new Function('return (' + e + ')')()); } catch { return no('That expression did not run.'); }
  const want = 20 * 4 * 61 * 5 + 4 * 61 * 4;
  if (v === want) return { pass: true, message: '25376 bytes: 21 samplers of 61 keys. Each bone\'s rotation sampler holds 61 times and 61 quaternions, 4·61·5 = 1220 bytes; the root\'s translation holds 61 times and 61 vectors, 4·61·4 = 976.' };
  if (v === 0) return no('Count the samplers, then the floats per key in each (one time plus the value), times 4 bytes.');
  if (v === 20 * 4 * 61 * 4 + 4 * 61 * 3) return no('Each sampler also stores its input: one time per key. Add 1 float per key.');
  if (v === 20 * 4 * 60 * 5 + 4 * 60 * 4) return no('Frames 1 to 61 are 61 keys, not 60 (both ends are keyed).');
  if (v === 20 * 4 * 61 * 4 + 4 * 61 * 4) return no('glTF stores rotation as a quaternion: 4 floats, not 3 Euler angles.');
  if (v === want / 4) return no('That counts floats. Each float is 4 bytes.');
  if (v === 20 * 4 * 61 * 5) return no('The root\'s translation is a channel too: one more sampler, 3 floats per key plus its times.');
  return no(`${v}: Σ over samplers of 4 bytes × keys × (1 + floats per key).`);
}

export default {
  id: 'modelling-geometry-10-007',
  slug: 'animation-in-files',
  chapter: 'modelling-geometry',
  order: 7,
  title: 'Animation in files',
  subtitle: 'Channels, samplers, seconds and quaternions: how glTF stores a clip, and why MeshLab bakes every frame.',
  tags: ['animation', 'glTF', 'GLB', 'channels', 'samplers', 'baking', 'file formats'],
  coreConcept: 'A glTF animation is a list of channels and samplers. A channel targets one node and one property: translation, rotation or scale (a bone is a node). It points to a sampler, which holds an input (the key times in seconds) and an output (one value per time: 3 floats for translation and scale, a 4-float unit quaternion for rotation). An interpolation says what happens between keys: STEP, LINEAR (slerp for rotations) or CUBICSPLINE. MeshLab\'s easings are none of these, so its GLB export bakes every frame and uses LINEAR, which reproduces the motion exactly at every frame at the cost of one key per frame per channel. The cost is easy to count: 4 bytes × keys × (1 + floats per key), per sampler.',
  prerequisites: ['modelling-geometry-10-006', 'modelling-geometry-10-003'],
  timeToComplete: 30,
  nextLesson: 'modelling-geometry-11-001',

  hook: {
    question: 'You animate a bouncing ball in one program and open it in another: a game engine, a web viewer, Blender. What exactly travels in the file, and why does the bounce still look the same?',
    realWorldContext: 'glTF is the web\'s and most engines\' interchange format for animated models; its animation block is the same for a bouncing ball and a skinned character with a hundred bones. Exporters bake for the same reason MeshLab does: the receiving player knows only three interpolations.',
  },

  intuition: {
    prose: [
      'A clip is a set of **channels**. Each targets one node and one property: **translation**, **rotation** or **scale**. Only keyed properties are stored. Before running cell 1, predict the channel count for a ball with position keys and a box with rotation and scale keys: 3.',
      'Each channel points to a **sampler**: an **input** list of times in seconds, $t = (f - f_0)/\\text{fps}$, and an **output** list of values, one per time. Rotations are stored as quaternions (lesson 10.3), never as Euler angles. Before running cell 2, predict the last time for frames 1 to 49 at 24 fps (2 s) and the bytes of the three samplers (2548).',
      'Between keys a player uses the sampler\'s **interpolation**: STEP, LINEAR (slerp for rotations, lesson 10.4) or CUBICSPLINE. MeshLab\'s ease-in is none of these, so its export **bakes**: a key on every frame, LINEAR between. Before running cell 3, predict the error of a fall stored as just two keys, LINEAR: half a unit, a quarter of the fall.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Writing an animation clip',
        body: 'Step 1. List every keyed property of every node (bones included): each is a channel.\nStep 2. Choose the key times: every frame when baking. Convert to seconds: t = (frame − start) / fps.\nStep 3. Sample each property at those frames; convert rotations to quaternions.\nStep 4. Store times and values as float arrays (accessors) and point each sampler at them.\nStep 5. Set the interpolation: LINEAR for baked keys.\nStep 6. Check the clip by playing it in another program.',
      },
      {
        type: 'warning',
        title: 'Seconds, not frames',
        body: 'glTF has no frame rate. A clip keyed at 24 fps plays at the same speed anywhere because its times are in seconds; a player can sample it at 60 fps or 144 fps.',
      },
      {
        type: 'warning',
        title: 'Eased keys do not survive as keys',
        body: 'Exporting only your keys with LINEAR turns every ease into a straight line: a fall that should accelerate drifts down at a constant speed. Bake, or let the exporter bake.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: playback elsewhere',
        body: 'The receiving player, three.js\'s AnimationMixer or a game engine, reads the samplers, finds the two keys around the current time, interpolates, and writes the result into the node before drawing. It knows nothing of MeshLab\'s easings; baking is what makes the bounce look the same.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "the keys are the animation". The white ease-in curve is the motion; two keys with LINEAR (blue) cut straight across it; baked keys (orange) sit on the curve, and LINEAR between neighbours is almost indistinguishable from it.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'animation.channels and animation.samplers are the JSON; times and its Float32Array are an accessor; bytes is 4 × keys × (1 + floats per key).' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Animation never reaches the GPU as keys: the player samples on the CPU each frame and uploads the resulting matrices, a node\'s transform or a skeleton\'s bone matrices (chapter 11).' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'File › Trace the glTF clip shows what File › Export GLB will write: the channels, the times (predict one), the values, the interpolation, and the bytes (predict them). In a script: scene.traceClip(). MeshLab\'s tests export the GLB and check the trace against the file\'s own channels and accessors.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: a glTF clip',
        caption: 'Channels, samplers and bytes; and what baking buys.',
        props: {
          lesson: {
            title: 'Animation in files',
            subtitle: 'Channels and samplers.',
            cells: [
              { type: 'js', instruction: '### 1. Channels\nPredict first: how many channels.', startCode: CLIP },
              { type: 'js', instruction: '### 2. Samplers and bytes\nPredict first: the last time, and the bytes.', startCode: BYTES },
              { type: 'js', instruction: '### 3. Why bake\nPredict first: the error with two keys.', startCode: BAKE },
              { type: 'js', instruction: '### 4. See it\nThe curve, the baked keys, and two keys with LINEAR.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 270 },
              { type: 'challenge', instruction: '### 5. Challenge: a character\'s clip\nThe check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkClipBytes },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Animation in files" in MeshLab](#/lab/mesh-lab?project=gltf-clip). A bouncing ball and a turning box; the clip is traced: press Play, and predict the time of frame 25 and the bytes.' },
              { type: 'markdown', instruction: '### Use the tool\n- **File › Trace the glTF clip**, then **File › Export GLB**.\n- In a script: `scene.traceClip()` returns the channels, keys, seconds and bytes.\n- Drop the GLB into Blender (File › Import › glTF) or any web glTF viewer: it plays at the same speed.\n- **Elsewhere:** the glTF 2.0 specification, section "Animations".' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Channels.** A clip is a set of pairs (target, sampler), the target a node and a path in {translation, rotation, scale, weights}.',
      '**Samplers.** A sampler is two arrays of equal length $n$: times $t_0 < t_1 < \\dots < t_{n-1}$ in seconds, and values $v_i$. At time $t$ with $t_i \\le t \\le t_{i+1}$, LINEAR gives $\\text{lerp}(v_i, v_{i+1}, u)$ with $u = (t - t_i)/(t_{i+1} - t_i)$, or $\\text{slerp}$ for rotations; STEP gives $v_i$; CUBICSPLINE stores an in-tangent, value and out-tangent per key (three times the floats) and uses a Hermite cubic.',
      '**Cost.** A sampler of $n$ keys of $k$ floats stores $4n(1 + k)$ bytes. **Baking error.** Sampling a curve with second derivative bounded by $|y\'\'|\\le a$ every $h$ seconds and joining with lines is off by at most $a h^2 / 8$: halving the spacing quarters the error (lesson 10.5).',
    ],
    equations: [
      { label: 'Time', latex: 't = \\frac{f - f_0}{\\text{fps}}' },
      { label: 'Linear', latex: 'v(t) = v_i + u\\,(v_{i+1} - v_i),\\quad u = \\frac{t - t_i}{t_{i+1} - t_i}' },
      { label: 'Bytes', latex: '\\text{bytes} = \\sum_\\text{samplers} 4\\,n\\,(1 + k)' },
      { label: 'Baking error', latex: '|e| \\le \\frac{a\\,h^2}{8}' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** A glTF animation defines, for each target, a function of time: piecewise constant (STEP), piecewise linear or slerp (LINEAR), or piecewise cubic Hermite (CUBICSPLINE) on the sampler\'s knots. Baking replaces MeshLab\'s eased curve by its piecewise linear interpolant on the frame grid, exact at every frame.',
      '**Invariant viewpoint.** Times in seconds make the clip independent of frame rate: resampling at any rate gives the same motion.',
      '**Geometric picture.** Each sampler is a polyline through the true curve; baking chooses the vertices dense enough that the polyline and the curve cannot be told apart.',
      '**Where this goes.** Lesson 11.8 adds the skin: joints, inverse bind matrices and four weights per vertex in the same file.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-10-007-ex1',
      title: 'A time',
      problem: 'A clip starts at frame 1 at 24 fps. What time does frame 25 get?',
      steps: [{ expression: '(25 - 1)/24 = 1', annotation: 'Seconds.' }],
      conclusion: '1 s.',
    },
    {
      id: 'modelling-geometry-10-007-ex2',
      title: 'One rotation sampler',
      problem: 'A rotation baked over frames 1 to 49. Bytes?',
      steps: [{ expression: '4 \\times 49 \\times (1 + 4) = 980', annotation: 'Times plus quaternions.' }],
      conclusion: '980 bytes.',
    },
    {
      id: 'modelling-geometry-10-007-ex3',
      title: 'CUBICSPLINE',
      problem: 'The same 49-key rotation stored as CUBICSPLINE. Bytes?',
      steps: [{ expression: '4 \\times 49 \\times (1 + 3 \\times 4) = 2548', annotation: 'In-tangent, value, out-tangent per key.' }],
      conclusion: '2548 bytes: smoother between keys, but nearly three times the size.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-10-007-ch1',
      difficulty: 'easy',
      problem: 'Why does a glTF file store times in seconds instead of frames?',
      walkthrough: [{ expression: 't = (f - f_0)/\\text{fps}', annotation: 'The frame rate is folded in.' }],
      answer: 'Players run at different rates (30, 60, 144 fps). Seconds make the clip play at the same speed everywhere; the player samples it at whatever times its frames fall.',
    },
    {
      id: 'modelling-geometry-10-007-ch2',
      difficulty: 'medium',
      problem: 'A fall with s = t² from 2.4 to 0.4 over 24 frames is stored as two keys with LINEAR. What is the worst error, and where?',
      walkthrough: [
        { expression: 'e(t) = 2(t - t^2)', annotation: 'The line minus the curve, t the fraction of the fall.' },
        { expression: 'e(1/2) = 0.5', annotation: 'Largest halfway.' },
      ],
      answer: '0.5, halfway through the fall (frame 13): the line says 1.4, the ball is really at 1.9. Cell 3 measures 0.5.',
    },
    {
      id: 'modelling-geometry-10-007-ch3',
      difficulty: 'hard',
      problem: 'Show that baking the same fall every frame (h = 1 frame) and playing it at a higher frame rate is off by at most a h²/8, and evaluate it.',
      walkthrough: [
        { expression: 'y = 2.4 - 2(f-1)^2/24^2,\\ |y\'\'| = 4/576', annotation: 'Per frame².' },
        { expression: 'a h^2/8 = (4/576)/8 \\approx 0.00087', annotation: 'h = 1 frame.' },
      ],
      answer: 'The chord of a curve over an interval h is off by at most max|y\'\'|·h²/8 (the error of linear interpolation). Here y\'\' = −4/576 per frame², so the bound is 0.00087, which cell 3 measures (0.0009 to four places) for a key every frame; a key every 4 frames gives 16 times that, 0.0139.',
    },
  ],

  semantics: {
    core: [
      { symbol: '\\text{channel}', meaning: 'A node, a property, and the sampler that animates it.' },
      { symbol: '\\text{sampler}', meaning: 'Input times, output values, an interpolation.' },
      { symbol: 't = (f - f_0)/\\text{fps}', meaning: 'A key\'s time in seconds.' },
      { symbol: '\\text{LINEAR}', meaning: 'Lerp between keys; slerp for rotations.' },
      { symbol: '4n(1 + k)', meaning: 'Bytes of a sampler of n keys of k floats.' },
      { symbol: '\\text{baking}', meaning: 'A key on every frame, so the player\'s LINEAR matches the original curve.' },
    ],
    rulesOfThumb: [
      'One channel per keyed property.',
      'Times in seconds.',
      'Rotations as quaternions.',
      'Bake anything glTF cannot interpolate.',
      'Bytes = 4 × keys × (1 + floats per key).',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-10-003', label: 'Quaternions', note: 'How rotations are stored.' },
      { lessonId: 'modelling-geometry-10-005', label: 'Motion through a hierarchy', note: 'Baking and its error.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-11-001', label: 'Bones', note: 'The nodes a character\'s channels target.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-10-007-1', label: 'Read what a channel is', type: 'read' },
    { id: 'cp-modelling-geometry-10-007-2', label: 'Read what a sampler holds', type: 'read' },
    { id: 'cp-modelling-geometry-10-007-3', label: 'Read why MeshLab bakes', type: 'read' },
    { id: 'cp-modelling-geometry-10-007-4', label: 'Run cells 1 to 3: channels, bytes, baking', type: 'lab' },
    { id: 'cp-modelling-geometry-10-007-5', label: 'Trace the glTF clip in MeshLab and export it', type: 'lab' },
    { id: 'cp-modelling-geometry-10-007-6', label: 'Work through example 2, one rotation sampler', type: 'example' },
    { id: 'cp-modelling-geometry-10-007-7', label: 'Work through example 3, CUBICSPLINE', type: 'example' },
    { id: 'cp-modelling-geometry-10-007-8', label: 'Complete the challenge: a character\'s clip', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-10-007-assess-1',
        type: 'choice',
        text: 'A translation baked over frames 1 to 25 takes how many bytes?',
        options: ['400', '300', '100', '500'],
        answer: '400',
        hint: '4 × 25 × (1 + 3).',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-10-007-quiz-1',
      type: 'choice',
      text: 'A glTF channel targets:',
      options: ['A node and one property', 'A whole scene', 'One keyframe', 'A material'],
      answer: 'A node and one property',
      hints: ['Cell 1.', 'translation, rotation or scale.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-10-007-quiz-2',
      type: 'choice',
      text: 'A sampler\'s input holds:',
      options: ['Key times in seconds', 'Frame numbers', 'Euler angles', 'Bone names'],
      answer: 'Key times in seconds',
      hints: ['Cell 2.', 'Warning "Seconds, not frames".'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-10-007-quiz-3',
      type: 'choice',
      text: 'glTF stores a rotation as:',
      options: ['A quaternion (x, y, z, w)', 'Euler angles', 'A 3×3 matrix', 'An axis only'],
      answer: 'A quaternion (x, y, z, w)',
      hints: ['Cell 2.', 'Lesson 10.3.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-10-007-quiz-4',
      type: 'choice',
      text: 'MeshLab bakes every frame on export because:',
      options: ['glTF has no ease-in interpolation', 'glTF requires it', 'It makes the file smaller', 'Players cannot read keys'],
      answer: 'glTF has no ease-in interpolation',
      hints: ['Cell 3.', 'STEP, LINEAR, CUBICSPLINE.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-10-007-quiz-5',
      type: 'choice',
      text: 'For a rotation, LINEAR interpolation in glTF means:',
      options: ['Slerp', 'Lerp of Euler angles', 'Hold the value', 'A cubic curve'],
      answer: 'Slerp',
      hints: ['Math, Samplers.', 'Lesson 10.4.'],
      reviewSection: 'Math',
    },
    {
      id: 'modelling-geometry-10-007-quiz-6',
      type: 'choice',
      text: 'Keys every 4 frames instead of every frame make the baking error about:',
      options: ['16 times larger', '4 times larger', 'The same', '2 times larger'],
      answer: '16 times larger',
      hints: ['Cell 3.', 'Error ∝ h².'],
      reviewSection: 'Cell 3',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'The exported keys are the keys I set.',
      whyStudentsThinkIt: 'In the editor, the keys are the animation.',
      correctionExample: 'MeshLab writes a key for every frame (cell 2: 49 keys for three keyframes).',
      contrastCase: 'An exporter could keep the original keys only if the player had the same easings.',
    },
    {
      falseBelief: 'glTF animations are stored in frames.',
      whyStudentsThinkIt: 'Animation tools count frames.',
      correctionExample: 'The sampler input is seconds: frame 25 at 24 fps from frame 1 is 1 s.',
      contrastCase: 'The frame rate survives only implicitly, in the spacing of baked keys.',
    },
    {
      falseBelief: 'Rotations are stored as the angles you typed.',
      whyStudentsThinkIt: 'The Inspector shows Euler angles.',
      correctionExample: 'Every rotation output is a quaternion; the Euler angles are converted per frame.',
      contrastCase: 'Translation and scale are stored as they are.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A clip must be as small as possible for a web page.',
      competingTechniques: ['Bake every frame', 'Bake, then remove keys that LINEAR between their neighbours already predicts within a tolerance'],
      whyThisTechniqueWins: 'Key reduction keeps the error bounded while dropping most keys on smooth stretches; glTF optimisers such as gltfpack do this.',
    },
    {
      situation: 'Exported animation plays too fast in an engine.',
      competingTechniques: ['Change the keys', 'Check the times: frames were divided by the wrong fps'],
      whyThisTechniqueWins: 'Speed lives in the input times; a wrong fps at export scales every time.',
    },
  ],

  debugging: [
    {
      commonError: 'Exporting eased keys with LINEAR and no baking.',
      symptom: 'Motion looks mechanical: no acceleration.',
      whyItHappened: 'The player draws straight lines between keys.',
      repairStrategy: 'Bake every frame (MeshLab does), or use CUBICSPLINE with matching tangents.',
    },
    {
      commonError: 'Storing frames in the input.',
      symptom: 'The clip plays 24 times too slowly.',
      whyItHappened: 'Times must be seconds.',
      repairStrategy: 't = (frame − start) / fps.',
    },
    {
      commonError: 'Node names with dots break playback in three.js.',
      symptom: 'Tracks bound to the wrong node, or to none.',
      whyItHappened: 'three.js track names use the dot to separate node and property.',
      repairStrategy: 'glTF itself targets nodes by index; MeshLab names tracks by uuid before export for this reason.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Describe and size the glTF clip for any keyed scene.',
    explainVerbally: 'Explain channels, samplers, seconds, quaternions and baking.',
    detectIncorrectApplication: 'Recognise frame-based times, Euler rotations and unbaked eases.',
    transferToUnfamiliar: 'Read the animation block of any glTF file.',
  },
};
