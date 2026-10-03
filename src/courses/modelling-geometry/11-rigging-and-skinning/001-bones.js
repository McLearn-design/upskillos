// Lesson 11.1: bones. A bone is a head, a tail and a roll; from them comes a frame (x, y, z axes with y along the
// bone, origin at the head) and the rest matrix B = T(head) · R(+y → bone) · R_y(roll). The notebook builds B by
// hand for MeshLab's "Arm" bone and checks it carries points between the bone's frame and the armature's.

const VEC = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const v = (a) => '(' + a.map(r).join(', ') + ')'
const sub = (a, b) => a.map((x, i) => x - b[i]), add = (a, b) => a.map((x, i) => x + b[i]), mul = (a, s) => a.map((x) => x * s)
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.sqrt(dot(a, a))
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
// Turn p about the unit axis k by angle t (Rodrigues).
const turn = (p, k, t) => add(add(mul(p, Math.cos(t)), mul(cross(k, p), Math.sin(t))), mul(k, dot(k, p) * (1 - Math.cos(t))))
// A bone's frame: y along the bone (the shortest turn from +y), then x and z turned by the roll about y.
function frame(head, tail, roll = 0) {
  const d = mul(sub(tail, head), 1 / len(sub(tail, head))), c = cross([0, 1, 0], d), s = len(c)
  const k = s > 1e-12 ? mul(c, 1 / s) : [1, 0, 0], a = Math.acos(Math.max(-1, Math.min(1, d[1])))
  let x = turn([1, 0, 0], k, a), z = turn([0, 0, 1], k, a)
  if (roll) { x = turn(x, d, roll); z = turn(z, d, roll) }
  return { x, y: d, z, o: head }
}
`;

const DIRECTION = `${VEC}
// MeshLab's Arm bone: head (0, 1.5, 0), tail (0.3, 1.9, 1.2). Predict first: how long is it?
const head = [0, 1.5, 0], tail = [0.3, 1.9, 1.2]
const d = sub(tail, head)
console.log('tail − head = ' + v(d) + ', length ' + r(len(d)))
console.log('unit direction ' + v(mul(d, 1 / len(d))))`;

const TURN = `${VEC}
// The bone's y axis must lie along it. Turn the armature's axes as little as possible: about y × d, by acos(y · d).
// Predict first: the angle, in degrees, for the Arm (direction (0.3, 0.4, 1.2) / 1.3).
const f = frame([0, 1.5, 0], [0.3, 1.9, 1.2])
console.log('turned ' + r(Math.acos(f.y[1]) * 180 / Math.PI) + '° from +y')
console.log('x ' + v(f.x) + '  y ' + v(f.y) + '  z ' + v(f.z))
console.log('lengths ' + [f.x, f.y, f.z].map((a) => r(len(a))).join(', ') + '; x·y ' + r(dot(f.x, f.y)) + ', y·z ' + r(dot(f.y, f.z)) + ', z·x ' + r(dot(f.z, f.x)))`;

const ROLL = `${VEC}
// Roll turns x and z about the bone's own y. MeshLab's Tilted bone: head (1.5, 0, 0), tail (1.5, 1, 1).
// Predict first: with a roll of 90°, does the tail move?
for (const deg of [0, 90]) {
  const f = frame([1.5, 0, 0], [1.5, 1, 1], deg * Math.PI / 180)
  console.log('roll ' + deg + '°: x ' + v(f.x) + ', y ' + v(f.y) + ', z ' + v(f.z) + '; tail ' + v(add(f.o, mul(f.y, Math.SQRT2))))
}`;

const MATRIX = `${VEC}
// B has the axes as columns and the head as its last column: B · (a, b, c, 1) = head + a·x + b·y + c·z.
// B⁻¹ undoes it: the coordinates of a point p in the bone's frame are (x·(p − head), y·(p − head), z·(p − head)).
// Predict first: the Arm's tail in its own frame.
const f = frame([0, 1.5, 0], [0.3, 1.9, 1.2])
const B = (q) => add(f.o, add(add(mul(f.x, q[0]), mul(f.y, q[1])), mul(f.z, q[2])))
const Binv = (p) => { const w = sub(p, f.o); return [dot(f.x, w), dot(f.y, w), dot(f.z, w)] }
console.log('rows of B:')
for (let i = 0; i < 3; i++) console.log('  [' + [f.x[i], f.y[i], f.z[i], f.o[i]].map(r).join(', ') + ']')
console.log('  [0, 0, 0, 1]')
console.log('tail in the bone\\'s frame: ' + v(Binv([0.3, 1.9, 1.2])))
console.log('halfway along the bone, (0, 0.65, 0), in the armature: ' + v(B([0, 0.65, 0])))`;

const PICTURE = `${VEC}
// MeshLab's three bones drawn as Blender draws them (an octahedron from head to tail), with each bone's axes at its
// head: x red, y green, z blue. Seen from the front, a little from the right and above.
const bones = [['Spine', [0, 0, 0], [0, 1.5, 0], 0], ['Tilted', [1.5, 0, 0], [1.5, 1, 1], Math.PI / 2], ['Arm', [0, 1.5, 0], [0.3, 1.9, 1.2], 0]]
const canvas = document.createElement('canvas'), W = 380, H = 260
canvas.width = W * 2; canvas.height = H * 2; canvas.style.cssText = 'width: ' + W + 'px; height: ' + H + 'px; display: block; margin: 0 auto'
document.body.appendChild(canvas)
const g = canvas.getContext('2d'); g.scale(2, 2); g.fillStyle = '#0f1923'; g.fillRect(0, 0, W, H)
const P = (p) => [150 + 90 * (p[0] - 0.35 * p[2]), H - 30 - 90 * (p[1] + 0.2 * p[2])]
const line = (a, b, c, w = 1.5) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(...P(a)); g.lineTo(...P(b)); g.stroke() }
let drawn = 0
for (const [name, h, t, roll] of bones) {
  const f = frame(h, t, roll), L = len(sub(t, h)), w = 0.1 * L, m = add(h, mul(f.y, 0.2 * L))
  const ring = [add(m, mul(f.x, w)), add(m, mul(f.z, w)), add(m, mul(f.x, -w)), add(m, mul(f.z, -w))]
  for (let i = 0; i < 4; i++) { line(h, ring[i], '#94a3b8', 1); line(ring[i], t, '#94a3b8', 1); line(ring[i], ring[(i + 1) % 4], '#94a3b8', 1) }
  line(h, add(h, mul(f.x, 0.35)), '#ef4444', 2); line(h, add(h, mul(f.y, 0.35)), '#22c55e', 2); line(h, add(h, mul(f.z, 0.35)), '#3b82f6', 2)
  g.fillStyle = '#cbd5e1'; g.font = '11px sans-serif'; g.fillText(name, P(t)[0] + 6, P(t)[1])
  drawn++
}
console.log('bones drawn: ' + drawn)`;

const CHALLENGE = `// A bone has head (2, 0, 1) and tail (2, 3, 5). By how many degrees must +y turn to lie along it?
const degrees = 0
console.log(degrees)`;

const SOLVED = CHALLENGE.replace('const degrees = 0', 'const degrees = Math.acos(3 / 5) * 180 / Math.PI');

/** The challenge's check: d = (0, 3, 4) / 5, so the turn is acos(0.6) = 53.13°. */
export function checkBoneTurn(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+degrees\s*=\s*([^\n]+)/);
  if (!m) return no('Keep the line const degrees = …, with a number or arithmetic using Math functions.');
  const e = m[1].replace(/\/\/.*$/, '').trim().replace(/;$/, '');
  if (!/^(?:[\d.\s+\-*/(),]|Math\.(?:acos|asin|atan|atan2|sqrt|hypot|PI))+$/.test(e)) return no('Write the angle as a number or arithmetic with Math.acos, Math.sqrt, Math.PI and the like.');
  let v;
  try { v = Number(new Function('return (' + e + ')')()); } catch { return no('That expression did not run.'); }
  const want = (Math.acos(0.6) * 180) / Math.PI;
  const near = (x, tol = 0.02) => Math.abs(v - x) < tol;
  if (near(want)) return { pass: true, message: '53.13°: the bone runs along (0, 3, 4), length 5, so y · d = 3/5 and the turn is acos(0.6). It turns about y × d = (4, 0, 0)/5, the x axis.' };
  if (v === 0) return no('Find the unit direction (tail − head) / length; its y component is the cosine of the turn.');
  if (near(Math.acos(0.6), 1e-3)) return no('That is in radians. Multiply by 180/π.');
  if (near(90 - want)) return no('36.87° is the angle from the horizontal (or acos of the z component). The turn is from +y: acos(d_y).');
  if (near(180 - want)) return no('Not the reflex way round: d_y = +0.6, the bone points upwards, so the turn is less than 90°.');
  if (Number.isNaN(v)) return no('acos needs the unit direction: divide (0, 3, 4) by its length, 5.');
  return no(`${v.toFixed(2)}°: cos θ = d_y, with d the unit direction (tail − head) / |tail − head|.`);
}

export default {
  id: 'modelling-geometry-11-001',
  slug: 'bones',
  chapter: 'modelling-geometry',
  order: 1,
  title: 'Bones',
  subtitle: 'Two points and a roll make a frame: the rest matrix that every pose, weight and skin is measured from.',
  tags: ['rigging', 'bones', 'armature', 'rest matrix', 'roll', 'frames'],
  coreConcept: 'An armature is a tree of bones. Each bone is stored as a head (where it pivots), a tail, and a roll. From them comes the bone\'s frame: its y axis runs from head to tail, found by the shortest turn of +y onto that direction (about y × d, by acos(y · d)); the roll then turns its x and z axes about y. The rest matrix B = T(head) · R(+y → bone) · R_y(roll) has those axes as its columns and the head as its origin. B carries a point given in the bone\'s own frame to armature space; B⁻¹ carries it back. Every later step, posing, skinning and weights, is measured against B.',
  prerequisites: ['modelling-geometry-10-005', 'modelling-geometry-10-003'],
  timeToComplete: 35,
  nextLesson: 'modelling-geometry-11-002',

  hook: {
    question: 'A bone looks like a stick. But to turn a forearm, a program must know which way is "bend" and which is "twist" at that elbow. Where does a bone keep that, if all it stores is two points?',
    realWorldContext: 'Every skeletal rig, in Blender, Maya, Unreal, Unity or a glTF file, gives each bone a local frame. Blender stores head, tail and roll; glTF stores each joint\'s rest transform and the inverse bind matrix B⁻¹. Getting roll wrong is the classic reason a rigged arm bends the wrong way.',
  },

  intuition: {
    prose: [
      'A bone is a **head**, a **tail** and a **roll**. The head is where it pivots; head to tail is the direction it points. Before running cell 1, predict the length of MeshLab\'s Arm bone, head (0, 1.5, 0) to tail (0.3, 1.9, 1.2): 1.3.',
      'From the direction comes a **frame**. The bone\'s y axis lies along it, and x and z come from the **shortest turn** that takes +y there. That turn is about $y \\times d$ by the angle $\\arccos(y \\cdot d)$. Before running cell 2, predict the Arm\'s angle: $\\arccos(0.4/1.3) \\approx 72.08°$.',
      'The direction fixes only y. **Roll** turns x and z about the bone\'s length. Before running cell 3, predict whether a 90° roll moves the tail: no. The bone stays put, and only its x and z face another way. That decides which way a pose bends it (lesson 11.3).',
      'The **rest matrix** $B$ has the axes as columns and the head as origin. $B$ takes coordinates in the bone\'s own frame to the armature, and $B^{-1}$ takes them back. Before running cell 4, predict the Arm\'s tail in its own frame: $(0, 1.3, 0)$, its length straight up its y axis.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: A bone\'s rest matrix',
        body: 'Step 1. d = (tail − head) / |tail − head|; the length is |tail − head|.\nStep 2. The turn: axis y × d (normalised), angle acos(d_y). Turn x and z by it; y lands on d.\nStep 3. Roll: turn x and z about d by the roll angle.\nStep 4. B = [x y z head; 0 0 0 1]: the axes are columns, the head is the last column.\nStep 5. B⁻¹ (p) = (x·(p − head), y·(p − head), z·(p − head)): the transpose of the rotation, after removing the head.',
      },
      {
        type: 'warning',
        title: 'Straight down has no shortest turn axis',
        body: 'A bone pointing along −y needs a half-turn, and y × d is zero: any horizontal axis will do. Programs pick one (MeshLab: x), so roll on a straight-down bone is measured from that choice. Avoid surprises by checking the x axis after you set roll.',
      },
      {
        type: 'warning',
        title: 'Roll numbers differ between programs',
        body: 'Blender measures roll from a different zero than MeshLab\'s shortest turn, so the same roll number can face a different way there. The frame is what matters: look at the axes, not the number.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: drawing bones',
        body: 'Blender draws a bone as an octahedron from head to tail, thickest a fifth of the way along, so you can see which end is the head and how the bone is rolled. MeshLab draws the same shape and its axes in Edit bones mode.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "a bone is just a line". Each bone carries three axes at its head. The Tilted bone\'s x (red) is not horizontal: its roll of 90° turned it about the bone, while the bone itself points exactly where it did.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'frame() is steps 1–3; B and Binv are step 4 and 5, written with dot products instead of a 4×4 inverse.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'B⁻¹ is computed once per bone at bind time and sent to the GPU as the "inverse bind matrix"; each frame the skinning shader multiplies it by the posed matrix (lesson 11.2).' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Object › Trace the rest matrix (active bone) builds B for the selected bone: direction (predict the length), turn (predict the angle), roll, and the matrix with its axes drawn as arrows. In a script: rig.bone("Arm").traceRest(). Tab on an armature edits bones; E extrudes a new bone from a selected tail.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: a bone\'s frame',
        caption: 'Direction, turn, roll, and the rest matrix.',
        props: {
          lesson: {
            title: 'Bones',
            subtitle: 'Head, tail, roll.',
            cells: [
              { type: 'js', instruction: '### 1. Direction and length\nPredict first: the Arm\'s length.', startCode: DIRECTION },
              { type: 'js', instruction: '### 2. The shortest turn\nPredict first: the angle from +y.', startCode: TURN },
              { type: 'js', instruction: '### 3. Roll\nPredict first: does the tail move?', startCode: ROLL },
              { type: 'js', instruction: '### 4. The rest matrix\nPredict first: the tail in the bone\'s frame.', startCode: MATRIX },
              { type: 'js', instruction: '### 5. See it\nThe three bones and their axes.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 310 },
              { type: 'challenge', instruction: '### 6. Challenge: a bone\'s turn\nThe check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkBoneTurn },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Bones and their frames" in MeshLab](#/lab/mesh-lab?project=bone-frames). The same three bones; the Arm\'s rest matrix is traced: press Play, predict its length and turn.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Add › Armature (one bone)**, then **Tab** for Edit bones: drag joints, **E** to extrude a bone from a tail.\n- **Object › Trace the rest matrix (active bone)**.\n- In a script: `scene.add.armature({ bones: [{ name, head, tail, roll }] })`, `rig.bone(name).traceRest()`.\n- **Elsewhere:** Blender\'s Edit Bones (Roll in the bone properties); glTF\'s `skins[].inverseBindMatrices`.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**The frame.** With $d = (t - h)/|t - h|$, the shortest rotation taking $\\hat{y}$ to $d$ has axis $k = \\hat{y} \\times d / |\\hat{y} \\times d|$ and angle $\\theta = \\arccos d_y$. Rodrigues\' formula turns any vector $p$: $p\' = p\\cos\\theta + (k \\times p)\\sin\\theta + k\\,(k \\cdot p)(1 - \\cos\\theta)$.',
      '**Roll** is a further rotation by $\\rho$ about $d$, applied to the turned $x$ and $z$: $B = T(h)\\,R_{\\hat{y} \\to d}\\,R_y(\\rho)$.',
      '**Inverse.** $B$ is rigid (rotation $Q$ and translation $h$), so $B^{-1}p = Q^{\\mathrm{T}}(p - h)$: dot products with the three axes.',
    ],
    equations: [
      { label: 'Direction', latex: 'd = \\frac{t - h}{|t - h|}' },
      { label: 'Turn', latex: '\\theta = \\arccos d_y,\\quad k = \\frac{\\hat{y} \\times d}{|\\hat{y} \\times d|}' },
      { label: 'Rest matrix', latex: 'B = T(h)\\,R_{\\hat{y} \\to d}\\,R_y(\\rho) = \\begin{pmatrix} x & y & z & h \\\\ 0 & 0 & 0 & 1 \\end{pmatrix}' },
      { label: 'Inverse', latex: 'B^{-1}p = Q^{\\mathrm{T}}(p - h)' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** A bone defines an element of SE(3): a rotation Q ∈ SO(3) with Q ŷ = d, unique up to a rotation about d (the roll), and a translation h. The shortest-turn choice fixes the roll\'s zero; any other convention differs by a rotation about d.',
      '**Invariant viewpoint.** Length and direction are independent of the frame\'s roll; the bone\'s shape on screen is too. Only what is measured in the bone\'s frame, like a pose rotation about x, sees the roll.',
      '**Geometric picture.** Imagine a small set of axes riding on the bone\'s head, its green arm along the bone. Roll twirls the red and blue arms around the green one.',
      '**Where this goes.** Lesson 11.2 poses bones: each pose rotates in this frame, and the chain multiplies the frames together.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-11-001-ex1',
      title: 'A vertical bone',
      problem: 'Head (0, 0, 0), tail (0, 2, 0), no roll. What is B?',
      steps: [
        { expression: 'd = (0, 1, 0),\\ \\theta = 0', annotation: 'Already along +y: no turn.' },
        { expression: 'B = I', annotation: 'Axes unchanged, head at the origin.' },
      ],
      conclusion: 'The identity: a vertical bone at the origin has the armature\'s own frame.',
    },
    {
      id: 'modelling-geometry-11-001-ex2',
      title: 'A horizontal bone',
      problem: 'Head (0, 1, 0), tail (2, 1, 0). The turn?',
      steps: [
        { expression: 'd = (1, 0, 0),\\ \\theta = \\arccos 0 = 90°', annotation: 'A right angle.' },
        { expression: 'k = \\hat{y} \\times \\hat x = (0, 0, -1)', annotation: 'Turned about −z.' },
      ],
      conclusion: '90° about −z. The turn carries x = (1, 0, 0) to (0, −1, 0) and leaves z = (0, 0, 1): the bone\'s x axis points down.',
    },
    {
      id: 'modelling-geometry-11-001-ex3',
      title: 'Back into the bone\'s frame',
      problem: 'With the bone of example 2, where is the point (1, 1, 0) in the bone\'s frame?',
      steps: [
        { expression: 'p - h = (1, 0, 0)', annotation: 'Remove the head.' },
        { expression: '(x \\cdot w, y \\cdot w, z \\cdot w) = (0, 1, 0)', annotation: 'x = (0, −1, 0), y = (1, 0, 0), z = (0, 0, 1).' },
      ],
      conclusion: '(0, 1, 0): one unit along the bone, halfway to the tail.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-11-001-ch1',
      difficulty: 'easy',
      problem: 'Why does a bone need a roll, if head and tail already say where it points?',
      walkthrough: [{ expression: 'Q\\hat{y} = d', annotation: 'Fixes y; x and z can still spin about it.' }],
      answer: 'Head and tail fix only the bone\'s y axis. Its x and z can be anywhere around it; roll chooses where. That matters because a pose rotation about x bends the bone in the plane of y and z.',
    },
    {
      id: 'modelling-geometry-11-001-ch2',
      difficulty: 'medium',
      problem: 'Show that B⁻¹ of the tail is (0, length, 0) for any bone.',
      walkthrough: [
        { expression: 't - h = L\\,d', annotation: 'L the length.' },
        { expression: 'Q^{\\mathrm{T}}(L\\,d) = L\\,Q^{\\mathrm{T}}d = L\\,\\hat{y}', annotation: 'Q ŷ = d.' },
      ],
      answer: 'B⁻¹t = Qᵀ(t − h) = L Qᵀd = L ŷ = (0, L, 0), whatever the roll: roll turns about ŷ and leaves it fixed. Cell 4 prints (0, 1.3, 0) for the Arm.',
    },
    {
      id: 'modelling-geometry-11-001-ch3',
      difficulty: 'hard',
      problem: 'Prove that the turned x, y, z from cell 2 are orthonormal, and that y = d.',
      walkthrough: [
        { expression: 'R_k(\\theta)\\hat{y} = d', annotation: 'Rodrigues with k ⊥ ŷ: ŷ cos θ + (k × ŷ) sin θ.' },
        { expression: 'R^{\\mathrm{T}}R = I', annotation: 'Rotations preserve dot products.' },
      ],
      answer: 'Rodrigues\' formula is a rotation, so it preserves lengths and dot products: the turned axes stay orthonormal. For p = ŷ, with k ⊥ ŷ, p\' = ŷ cos θ + (k × ŷ) sin θ; k × ŷ is the unit vector in the plane of ŷ and d perpendicular to ŷ, so p\' = d. Cell 2 prints lengths 1 and dot products 0.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'h, t', meaning: 'The bone\'s head (pivot) and tail.' },
      { symbol: '\\rho', meaning: 'Roll: a turn of x and z about the bone.' },
      { symbol: 'd', meaning: 'The unit direction, the bone\'s y axis.' },
      { symbol: '\\theta = \\arccos d_y', meaning: 'The shortest turn from +y.' },
      { symbol: 'B', meaning: 'The rest matrix: bone frame to armature.' },
      { symbol: 'B^{-1}', meaning: 'Armature to bone frame (the inverse bind matrix).' },
    ],
    rulesOfThumb: [
      'y runs from head to tail.',
      'Roll moves the axes, not the bone.',
      'B\'s columns are the axes and the head.',
      'B⁻¹ = dot with each axis after removing the head.',
      'The tail in the bone\'s frame is (0, length, 0).',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-10-005', label: 'Motion through a hierarchy', note: 'Parent and child frames.' },
      { lessonId: 'modelling-geometry-10-003', label: 'Quaternions', note: 'Axis-angle rotations.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-11-002', label: 'Posing', note: 'Turning bones in their frames.' },
      { lessonId: 'modelling-geometry-11-003', label: 'Roll and editing joints', note: 'What roll does to a bend.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-11-001-1', label: 'Read what a bone stores', type: 'read' },
    { id: 'cp-modelling-geometry-11-001-2', label: 'Read how the frame is built', type: 'read' },
    { id: 'cp-modelling-geometry-11-001-3', label: 'Read what roll does', type: 'read' },
    { id: 'cp-modelling-geometry-11-001-4', label: 'Run cells 1 to 4: direction, turn, roll, matrix', type: 'lab' },
    { id: 'cp-modelling-geometry-11-001-5', label: 'Trace a rest matrix in MeshLab and extrude a bone', type: 'lab' },
    { id: 'cp-modelling-geometry-11-001-6', label: 'Work through example 2, a horizontal bone', type: 'example' },
    { id: 'cp-modelling-geometry-11-001-7', label: 'Work through example 3, back into the bone\'s frame', type: 'example' },
    { id: 'cp-modelling-geometry-11-001-8', label: 'Complete the challenge: a bone\'s turn', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-11-001-assess-1',
        type: 'choice',
        text: 'A bone from (0, 0, 0) to (0, 0, 3). Its turn from +y is:',
        options: ['90°', '0°', '45°', '180°'],
        answer: '90°',
        hint: 'd_y = 0.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-11-001-quiz-1',
      type: 'choice',
      text: 'A bone\'s y axis points:',
      options: ['From head to tail', 'Straight up', 'Along its roll', 'From tail to head'],
      answer: 'From head to tail',
      hints: ['Cell 2.', 'Procedure, Step 2.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-11-001-quiz-2',
      type: 'choice',
      text: 'Changing a bone\'s roll:',
      options: ['Turns its x and z axes; the bone does not move', 'Moves its tail', 'Changes its length', 'Moves its head'],
      answer: 'Turns its x and z axes; the bone does not move',
      hints: ['Cell 3.', 'The tail prints the same.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-11-001-quiz-3',
      type: 'choice',
      text: 'The last column of B is:',
      options: ['The head', 'The tail', 'The roll', 'The length'],
      answer: 'The head',
      hints: ['Cell 4.', 'B carries the bone\'s origin to the head.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-11-001-quiz-4',
      type: 'choice',
      text: 'The tail, in the bone\'s own frame, is:',
      options: ['(0, length, 0)', '(length, 0, 0)', '(0, 0, 0)', 'The same as in the armature'],
      answer: '(0, length, 0)',
      hints: ['Cell 4.', 'Challenge 2.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-11-001-quiz-5',
      type: 'choice',
      text: 'The shortest turn from +y onto d has angle:',
      options: ['acos(d_y)', 'acos(d_x)', 'atan(d_z)', 'd_y in radians'],
      answer: 'acos(d_y)',
      hints: ['Cell 2.', 'y · d = d_y.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-11-001-quiz-6',
      type: 'choice',
      text: 'B⁻¹ of a point p is:',
      options: ['Its dot products with x, y, z after subtracting the head', 'p − head', 'B times p', 'p with y and z swapped'],
      answer: 'Its dot products with x, y, z after subtracting the head',
      hints: ['Cell 4.', 'Procedure, Step 5.'],
      reviewSection: 'Cell 4',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'A bone is just a line segment.',
      whyStudentsThinkIt: 'It is drawn as a stick.',
      correctionExample: 'Each bone has a full frame; the picture shows its axes, and roll turns them.',
      contrastCase: 'A camera, also drawn as a shape, has a frame too (lesson 3.7).',
    },
    {
      falseBelief: 'Roll rotates the bone.',
      whyStudentsThinkIt: 'It is an angle.',
      correctionExample: 'Cell 3: the tail is the same at roll 0 and 90°.',
      contrastCase: 'A pose rotation about y does twist the bone and everything bound to it.',
    },
    {
      falseBelief: 'The bone\'s y axis is the armature\'s y axis.',
      whyStudentsThinkIt: 'Bones often start vertical.',
      correctionExample: 'The Arm\'s y axis is (0.2308, 0.3077, 0.9231).',
      contrastCase: 'For a vertical bone at the origin they coincide (example 1).',
    },
  ],

  transferPrompts: [
    {
      situation: 'A rigged arm bends backwards at the elbow when you rotate the forearm about x.',
      competingTechniques: ['Rotate about z instead in every key', 'Fix the forearm\'s roll so its x axis is the elbow\'s hinge'],
      whyThisTechniqueWins: 'Roll sets the bone\'s bending plane once; fixing it makes every later pose and every animator\'s keys bend the right way.',
    },
    {
      situation: 'Importing a skeleton from another program, the bones look right but poses come out twisted.',
      competingTechniques: ['Re-key every animation', 'Compare the bone frames (roll conventions) and convert'],
      whyThisTechniqueWins: 'The bones\' positions agree but their frames differ by a roll; poses are measured in those frames.',
    },
  ],

  debugging: [
    {
      commonError: 'A bone with head equal to its tail.',
      symptom: 'The bone vanishes or its frame is undefined.',
      whyItHappened: 'The direction is (0, 0, 0)/0.',
      repairStrategy: 'Give every bone a length; MeshLab falls back to the armature\'s axes.',
    },
    {
      commonError: 'Forgetting the head when going into the bone\'s frame.',
      symptom: 'Coordinates off by the head\'s position.',
      whyItHappened: 'B⁻¹p = Qᵀ(p − h), not Qᵀp.',
      repairStrategy: 'Subtract the head first.',
    },
    {
      commonError: 'acos of an unnormalised component.',
      symptom: 'NaN.',
      whyItHappened: 'acos needs a value in [−1, 1].',
      repairStrategy: 'Divide tail − head by its length first.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Build any bone\'s rest matrix from head, tail and roll.',
    explainVerbally: 'Explain the frame, the shortest turn, roll, and B⁻¹.',
    detectIncorrectApplication: 'Spot wrong rolls and missing head subtraction.',
    transferToUnfamiliar: 'Read joint frames in Blender and glTF.',
  },
};
