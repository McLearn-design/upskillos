// Lesson 2.5: hierarchies (docs/modelling-course-plan.md). Four parts: the maths (world = parent × local, all
// the way up), building it (an arm's joints by hand and by matrices, re-parenting with an inverse, and a graded
// "reach the target" challenge), watching MeshLab do it (a traced walk up and down the parent chain in Predict
// mode), and using the tool (parenting in the Scene list, Clear parent, the robot arm).
import { withPicture } from '../notebookScene.js';

const R4 = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(3)`;
const MAT = `// 4×4 matrices as rows. A joint turns about z (in the picture's plane) and sits at an offset in its parent.
const mul = (A, B) => A.map((row) => B[0].map((_, j) => row.reduce((s, a, k) => s + a * B[k][j], 0)))
const apply = (M, [x, y, z]) => M.slice(0, 3).map((row) => row[0] * x + row[1] * y + row[2] * z + row[3])
const joint = (offset, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0, offset[0]], [s, c, 0, offset[1]], [0, 0, 1, offset[2]], [0, 0, 0, 1]] }`;

const BY_HAND = `${R4}

// Shoulder at (0, 1, 0), turned 30°. Elbow 2 up the upper arm, turned a further 45°. Hand 1.5 up the forearm.
// Each offset is in its parent's frame, so it is turned by all the turns above it before it is added.
const turn = ([x, y, z], deg) => { const a = deg * Math.PI / 180; return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z] }
const add = (p, q) => p.map((x, i) => x + q[i])
const shoulder = [0, 1, 0]
const elbow = add(shoulder, turn([0, 2, 0], 30))         // turned by the shoulder's 30°
const hand = add(elbow, turn([0, 1.5, 0], 30 + 45))      // turned by 30° + 45°: the turns add up
console.log('shoulder ' + shoulder.map(r).join(', ') + '   elbow ' + elbow.map(r).join(', ') + '   hand ' + hand.map(r).join(', '))`;

const MATRICES = `${R4}
${MAT}

// The same arm as matrices: each world matrix is the parent's world matrix times the local one.
const S = joint([0, 1, 0], 30), E = joint([0, 2, 0], 45), H = joint([0, 1.5, 0], 0)
const worldS = S, worldE = mul(worldS, E), worldH = mul(worldE, H)
for (const [name, W] of [['shoulder', worldS], ['elbow', worldE], ['hand', worldH]]) {
  const angle = Math.atan2(W[1][0], W[0][0]) * 180 / Math.PI
  console.log(name + ': origin ' + apply(W, [0, 0, 0]).map(r).join(', ') + ', turned ' + r(angle) + '°')
}`;

const SWEEP = `${R4}
${MAT}

// Turn only the elbow, and the forearm and hand follow: their world matrices include the elbow's.
const bar = (len, w) => [[-w, 0], [w, 0], [w, len], [-w, len]].flatMap(([x, y]) => [[x, y, -w], [x, y, w]])
const barFaces = [[0, 2, 4, 6], [1, 7, 5, 3], [0, 1, 3, 2], [2, 3, 5, 4], [4, 5, 7, 6], [6, 7, 1, 0]]
const verts = [], faces = [], groups = []
function draw(W, len, w, group) {
  const base = verts.length
  for (const p of bar(len, w)) verts.push(apply(W, p))
  for (const f of barFaces) { faces.push(f.map((k) => k + base)); groups.push(group) }
}
for (const [k, elbowDeg] of [0, 45, 90].entries()) {
  const S = joint([0, 1, 0], 30), E = mul(S, joint([0, 2, 0], elbowDeg)), H = mul(E, joint([0, 1.5, 0], 0))
  draw(S, 2, 0.1, 0)
  draw(E, 1.5, 0.08, k + 1)
  console.log('elbow ' + elbowDeg + '°: hand at ' + apply(H, [0, 0, 0]).map(r).join(', '))
}
show({ verts, faces, groups })`;

const REPARENT = `${R4}
${MAT}

// Undo a rigid matrix (turn and move): turn back, then move back. inverse(W) = [Rᵀ, −Rᵀ t].
function inverse(W) {
  const R = [0, 1, 2].map((i) => [0, 1, 2].map((j) => W[j][i])), t = [W[0][3], W[1][3], W[2][3]]
  const back = R.map((row) => -(row[0] * t[0] + row[1] * t[1] + row[2] * t[2]))
  return [[...R[0], back[0]], [...R[1], back[1]], [...R[2], back[2]], [0, 0, 0, 1]]
}
const S = joint([0, 1, 0], 30), E = mul(S, joint([0, 2, 0], 45)), H = mul(E, joint([0, 1.5, 0], 0))
// Clear parent: the hand keeps its world matrix as its new local one, so it does not move.
console.log('hand, unparented: local position ' + [H[0][3], H[1][3], H[2][3]].map(r).join(', '))
// Parent the hand to the shoulder instead, keeping it in place: local = inverse(shoulder's world) × hand's world.
const local = mul(inverse(S), H)
console.log('hand under the shoulder: local position ' + [local[0][3], local[1][3], local[2][3]].map(r).join(', ') + ', turned ' + r(Math.atan2(local[1][0], local[0][0]) * 180 / Math.PI) + '°')
console.log('check, shoulder × local = world: ' + apply(mul(S, local), [0, 0, 0]).map(r).join(', '))`;

const CHALLENGE = `// Turn the elbow so the hand reaches the target at (-0.25, 4.031, 0). The shoulder stays at 30°.
const elbowDeg = 0

${R4}
${MAT}
const S = joint([0, 1, 0], 30), E = mul(S, joint([0, 2, 0], elbowDeg)), H = mul(E, joint([0, 1.5, 0], 0))
const hand = apply(H, [0, 0, 0]), target = [-0.25, 4.031, 0]
console.log('hand at ' + hand.map(r).join(', ') + ', ' + r(Math.hypot(hand[0] - target[0], hand[1] - target[1])) + ' from the target')`;

const SOLVED = CHALLENGE.replace('const elbowDeg = 0', 'const elbowDeg = -60');

const TARGET = [-0.25, 4.031];
/** Where the hand ends up for an elbow angle (degrees), with the shoulder at 30°. */
function handAt(deg) {
  const t = (a) => a * Math.PI / 180;
  const e = [-2 * Math.sin(t(30)), 1 + 2 * Math.cos(t(30))];
  return [e[0] - 1.5 * Math.sin(t(30 + deg)), e[1] + 1.5 * Math.cos(t(30 + deg))];
}

/** The challenge's check: put the hand where the chosen elbow angle puts it and say how far off it is, and which way. */
export function checkReach(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+elbowDeg\s*=\s*([-+0-9.eE]+)/);
  const deg = m ? Number(m[1]) : NaN;
  if (!Number.isFinite(deg)) return no('Keep the line const elbowDeg = …, with a number of degrees.');
  const h = handAt(deg), d = Math.hypot(h[0] - TARGET[0], h[1] - TARGET[1]);
  const fmt = (p) => `(${p.map((x) => +x.toFixed(3)).join(', ')}, 0)`;
  if (d > 0.02) {
    // Positive angles turn anticlockwise (in the picture's plane). The target needs a clockwise turn from 0.
    const better = handAt(deg - 1), worse = Math.hypot(better[0] - TARGET[0], better[1] - TARGET[1]) < d;
    return no(`At ${deg}° the hand reaches ${fmt(h)}, ${+d.toFixed(3)} from the target. Turn the elbow ${worse ? 'clockwise (a smaller angle)' : 'anticlockwise (a larger angle)'}.`);
  }
  return { pass: true, message: `At ${deg}° the hand reaches ${fmt(h)}: the forearm points 30° + (${deg}°) = ${30 + deg}° from straight up, the turns of the shoulder and the elbow added.` };
}

export default {
  id: 'modelling-geometry-2-005',
  slug: 'hierarchies',
  chapter: 'modelling-geometry-2',
  order: 5,
  title: 'Hierarchies',
  subtitle: 'Parents carry their children: world = parent × local, all the way up.',
  tags: ['transforms', 'hierarchy', 'scene graph', 'parenting', 'forward kinematics'],
  aliases: 'hierarchy parent child scene graph world matrix local matrix forward kinematics robot arm clear parent reparent inverse matrix outliner meshlab',
  timeToComplete: 45,
  coreConcept: 'An object can sit inside another: its position, rotation and scale are then relative to its parent. Its world matrix is its parent\'s world matrix times its own local matrix, repeated up the chain to the root, so moving or turning a parent carries everything below it.',
  prerequisites: ['modelling-geometry-2-004'],
  nextLesson: null,

  hook: {
    question: 'Turn a robot\'s shoulder and its whole arm swings: elbow, wrist, hand, the tool it holds. Nobody moved the hand. How does the hand know where to be?',
    realWorldContext: 'Every 3D scene is a tree: wheels on a car, a character\'s bones, a lamp on a desk in a room. Game engines, Blender\'s Outliner, glTF files and robot controllers all store each part relative to its parent and multiply down the tree.',
  },

  intuition: {
    prose: [
      'Make an arm from three parts. The shoulder is at $(0, 1, 0)$, turned 30°. The elbow is a **child** of the shoulder, 2 units up the upper arm: its position $(0, 2, 0)$ is measured in the shoulder\'s frame, along the shoulder\'s own (turned) up direction. The hand is a child of the elbow, 1.5 up the forearm, and the elbow is turned a further 45°.',
      'Where is the elbow in the world? Turn its offset $(0, 2, 0)$ by the shoulder\'s 30°: $(-1, 1.732, 0)$. Add the shoulder\'s position: $(-1, 2.732, 0)$. Where is the hand? Its offset $(0, 1.5, 0)$ is turned by both turns above it, $30° + 45° = 75°$: $(-1.449, 0.388, 0)$; add the elbow\'s world position: $(-2.449, 3.120, 0)$. The turns add up down the chain.',
      'With matrices it is one rule. Each object has a **local** matrix (lesson 2.2) built from its own position, rotation and scale. Its **world** matrix is its parent\'s world matrix times its local matrix: $W_{\\text{hand}} = W_{\\text{elbow}}\\,L_{\\text{hand}} = L_{\\text{shoulder}}\\,L_{\\text{elbow}}\\,L_{\\text{hand}}$. The local matrix nearest the vertex acts first: the hand\'s own placement, then the elbow\'s, then the shoulder\'s.',
      'Before reading on, predict: turn only the elbow from 45° to 90°. What changes? The elbow\'s local matrix, and so the world matrices of the elbow and everything below it: forearm and hand swing round the elbow. The shoulder and upper arm do not move. This is **forward kinematics**: set the joint angles, and the positions follow.',
      'Changing a parent without moving the object needs the inverse. **Clearing** the parent makes the old world matrix the new local one. **Re-parenting** under $P$ while keeping the object in place sets its local matrix to $W_P^{-1}\\,W$, so that $W_P$ times it gives back $W$. MeshLab does this whenever you drag an object onto another in the Scene list or use Clear parent.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Find an object\'s world matrix',
        body: 'Step 1. Walk up from the object through its parents to the root, and list them.\nStep 2. Start from the root: its world matrix is its local matrix.\nStep 3. Going down, multiply: world = parent\'s world × local.\nStep 4. The object\'s world matrix is the last product; its fourth column is where it is in the world.\nStep 5. To re-parent without moving it: new local = inverse(new parent\'s world) × world.',
      },
      {
        type: 'warning',
        title: 'Scale the parts, not the joints',
        body: 'A parent\'s scale is in every child\'s world matrix. Scale a joint unevenly and every child turned under it shears (lesson 2.3). Rigs and robot arms keep joints as unscaled empties and put each visible part, with its own scale, as a child of its joint, as the robot-arm project does.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: the scene graph',
        body: 'Before drawing a frame, three.js walks the tree from each root and updates every object\'s matrixWorld = parent.matrixWorld × matrix, so each world matrix is computed once per frame however deep the tree is. Then it draws objects in whatever order suits the GPU: the hierarchy decides where things are, not the order they are drawn. Each mesh still receives only its own world matrix as the model matrix uniform.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: a chain of joints',
        props: {
          lesson: {
            title: 'Hierarchies',
            subtitle: 'Place an arm\'s joints by hand and by matrices, swing its forearm, re-parent with an inverse, and reach a target.',
            cells: [
              { type: 'js', instruction: '### 1. By hand\nEach offset is turned by all the turns above it, then added to the parent\'s position.', startCode: BY_HAND },
              { type: 'js', instruction: '### 2. As matrices\nworld = parent\'s world × local, down the chain. The hand is turned 75°: 30° from the shoulder plus 45° from the elbow.', startCode: MATRICES },
              { type: 'js', instruction: '### 3. Turn one joint\nThe upper arm (blue) does not move; the forearm is drawn for the elbow at 0°, 45° and 90°. Drag to turn the picture.', startCode: withPicture(SWEEP), showPreviewByDefault: true, outputHeight: 340 },
              { type: 'js', instruction: '### 4. Re-parenting\nClearing the parent keeps the world matrix as the local one. Moving the hand under the shoulder instead needs inverse(shoulder\'s world) × hand\'s world.', startCode: REPARENT },
              { type: 'challenge', instruction: '### 5. Challenge: reach the target\nChoose the elbow\'s angle (degrees, anticlockwise positive) so the hand reaches (−0.25, 4.031, 0). The check puts the hand where your angle puts it and says which way to turn.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkReach },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Hierarchies" in MeshLab](#/lab/mesh-lab?project=hierarchies). It builds the same arm as cells 1 and 2 and traces the Hand\'s world matrix with **Record traces** on: up the chain to the root, then multiplied back down. The Algorithm trace is in **Predict** mode: predict where the Elbow\'s origin lands, then the Hand\'s, and compare with your cell 1. Then turn the elbow and unparent the hand.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Parenting:** in the Scene list, drag an object onto another to make it a child; drag it to the empty space below to clear its parent. **Object › Clear parent** does the same. Either way the object stays where it is.\n- The Inspector shows the **local** transform (relative to the parent) and the **world** matrix, the product down the chain.\n- **Object › Trace the world matrix (parents)** traces how the selected object\'s world matrix is built.\n- In a script: scene.add.cube({ parent: other, … }), object.parent = other or null, object.traceWorld().\n- See a deeper chain move: [the robot arm project](#/lab/mesh-lab?project=robot-arm).\n- **In Blender:** Ctrl+P parents to the active object; Alt+P › Clear and Keep Transformation unparents without moving.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      'For an object $o$ with parent chain $o_1$ (the root), $o_2$, …, $o_k = o$: $W_o = L_{o_1} L_{o_2} \\cdots L_{o_k}$, and recursively $W_{o} = W_{\\text{parent}}\\,L_{o}$.',
      'With rigid joints (no scale), $W = \\begin{pmatrix} R & t \\\\ 0 & 1 \\end{pmatrix}$ composes as $R = R_1 R_2 \\cdots R_k$ and $t = t_1 + R_1 t_2 + R_1 R_2 t_3 + \\cdots$: each offset turned by the rotations above it. For turns about one axis, the angles add.',
      'The inverse of a rigid matrix is $\\begin{pmatrix} R^{\\mathsf{T}} & -R^{\\mathsf{T}} t \\\\ 0 & 1 \\end{pmatrix}$: turn back, then move back. Re-parenting under $P$ while keeping the world matrix $W$: $L = W_P^{-1} W$.',
      'For the arm: $t_{\\text{hand}} = (0, 1, 0) + R(30°)(0, 2, 0) + R(75°)(0, 1.5, 0) = (-2.449, 3.120, 0)$.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'The tree has to be a tree: an object cannot be its own ancestor, or the walk up never ends. MeshLab refuses to parent an object to one of its own descendants for that reason.',
      'Cost: computing every world matrix by walking each object\'s chain separately is $O(n \\cdot \\text{depth})$; walking the tree once from the root, passing each world matrix down to the children, is $O(n)$. Engines do the second, once per frame, and skip branches that have not changed.',
      'Forward kinematics is the easy direction: angles to positions. The reverse, inverse kinematics (positions to angles), has zero, one or many answers: the challenge\'s target is reached at −60°, but a target out of reach has none, and a two-joint arm usually reaches a point in two ways (elbow up or elbow down). Chapter 11 returns to it for rigs.',
      'Keeping world position when parenting is a choice. Without the inverse, the object\'s local numbers would be read in the new parent\'s frame, and it would jump. Some tools offer both; MeshLab always keeps the world position.',
    ],
    callouts: [
      { type: 'insight', title: 'Bridge: from the chain rule to code', body: 'mul(worldE, H) in cell 2 is W_hand = W_elbow × L_hand; the loop down the chain is the whole algorithm.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'The renderer computes the same products once per frame and sends each mesh only its final world matrix.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Object › Trace the world matrix walks the chain exactly as cell 2 does; Clear parent and re-parenting use the inverse from cell 4.' },
    ],
    visualizations: [],
  },

  examples: [
    {
      id: 'modelling-geometry-2-005-ex1',
      title: 'A child of a moved parent',
      difficulty: 'easy',
      problem: 'A lamp at (0, 0.8, 0) is a child of a desk at (3, 0, 2), neither turned. Where is the lamp in the world?',
      steps: [{ expression: '(3, 0, 2) + (0, 0.8, 0) = (3, 0.8, 2)', annotation: 'Without turns, offsets just add.', strategyTitle: 'Step 1: Add' }],
      answer: '(3, 0.8, 2).',
    },
    {
      id: 'modelling-geometry-2-005-ex2',
      title: 'A turned parent',
      difficulty: 'medium',
      problem: 'The desk is turned 90° about y. Now where is a mug at (1, 0.8, 0) on it?',
      steps: [
        { expression: 'R_y(90°)\\,(1, 0.8, 0) = (0, 0.8, -1)', annotation: 'The offset is turned by the parent\'s rotation.', strategyTitle: 'Step 1: Turn' },
        { expression: '(3, 0, 2) + (0, 0.8, -1) = (3, 0.8, 1)', annotation: 'Then added to the parent\'s position.', strategyTitle: 'Step 2: Add' },
      ],
      answer: '(3, 0.8, 1).',
    },
    {
      id: 'modelling-geometry-2-005-ex3',
      title: 'The arm\'s hand',
      difficulty: 'hard',
      problem: 'Shoulder at (0, 1, 0) turned 30° about z; elbow at (0, 2, 0) in the shoulder, turned 45°; hand at (0, 1.5, 0) in the elbow. Where is the hand?',
      steps: [
        { expression: 't_E = (0,1,0) + R(30°)(0,2,0) = (-1, 2.732, 0)', annotation: 'The elbow, turned by the shoulder.', strategyTitle: 'Step 1: Elbow' },
        { expression: 't_H = t_E + R(75°)(0,1.5,0) = (-2.449, 3.120, 0)', annotation: 'The hand, turned by both: 30° + 45°.', strategyTitle: 'Step 2: Hand' },
      ],
      answer: '(−2.449, 3.120, 0), as MeshLab\'s trace computes.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-2-005-ch1',
      title: 'Who moves?',
      difficulty: 'easy',
      problem: 'In the arm, which parts move when the shoulder turns? When the hand turns?',
      hint: 'A turn carries everything below it.',
      answer: 'Shoulder: everything (upper arm, elbow, forearm, hand). Hand: only the hand and anything parented to it.',
      walkthrough: [],
    },
    {
      id: 'modelling-geometry-2-005-ch2',
      title: 'Unparent in place',
      difficulty: 'medium',
      problem: 'The hand\'s world matrix is W. You clear its parent and want it not to move. What must its new local matrix be?',
      hint: 'With no parent, world = local.',
      answer: 'W itself: its old world matrix becomes its local one.',
      walkthrough: [],
    },
    {
      id: 'modelling-geometry-2-005-ch3',
      title: 'Two ways to reach',
      difficulty: 'hard',
      problem: 'A two-joint arm (upper arm 2, forearm 1.5) must reach a point 3 from the shoulder. How many elbow angles do it, and why?',
      hint: 'The elbow can bend either way.',
      answer: 'Two in general: elbow bent one way or the mirror-image way, both giving a triangle with sides 2, 1.5 and 3. Points further than 3.5 or nearer than 0.5 cannot be reached at all.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      { symbol: 'L_o', meaning: 'An object\'s local matrix: its transform relative to its parent.' },
      { symbol: 'W_o = W_{\\text{parent}} L_o', meaning: 'Its world matrix, built down the chain.' },
      { symbol: '\\text{root}', meaning: 'An object with no parent: its world matrix is its local one.' },
      { symbol: '\\text{forward kinematics}', meaning: 'Setting joint angles and computing where the parts end up.' },
      { symbol: 'W_P^{-1} W', meaning: 'The local matrix that keeps an object in place under a new parent P.' },
      { symbol: '\\text{scene graph}', meaning: 'The tree of objects and their parents that a renderer walks each frame.' },
    ],
    rulesOfThumb: [
      'Positions in the Inspector are relative to the parent.',
      'Turning a parent carries its children; the turns add up down the chain.',
      'Joints as unscaled empties; scale only the visible parts.',
      'Re-parent with the inverse so nothing jumps.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'A child\'s position is where it is in the world.',
      whyStudentsThinkIt: 'For objects without a parent, it is.',
      correctionExample: 'The hand\'s position is (0, 1.5, 0), but it is at (−2.449, 3.120, 0) in the world.',
      contrastCase: 'The shoulder has no parent, so its position (0, 1, 0) is its world position.',
    },
    {
      falseBelief: 'Moving a child moves its parent.',
      whyStudentsThinkIt: 'They are connected.',
      correctionExample: 'Turning the hand leaves the elbow and shoulder exactly where they were.',
      contrastCase: 'Moving the parent moves every child.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A car\'s wheels must turn with the car and spin on their own axles.',
      competingTechniques: ['Wheels as children of the car, each spinning in its own frame', 'Animating each wheel\'s world position by hand'],
      whyThisTechniqueWins: 'As children they follow the car automatically; each only needs its own spin.',
    },
    {
      situation: 'A character picks up a cup, and the cup must move with the hand from then on.',
      competingTechniques: ['Re-parent the cup to the hand, keeping its world matrix', 'Set the cup\'s position to the hand\'s every frame'],
      whyThisTechniqueWins: 'Re-parenting with the inverse keeps the cup in place at the moment of the grab, and the hierarchy carries it after.',
    },
  ],

  debugging: [
    {
      commonError: 'Multiplying local × parent instead of parent × local.',
      symptom: 'Children swing round the world origin, or are pushed by their parents\' scale in strange directions.',
      whyItHappened: 'The parent\'s matrix was applied first.',
      repairStrategy: 'World = parent\'s world × local, with the parent on the left.',
    },
    {
      commonError: 'Re-parenting without the inverse.',
      symptom: 'An object jumps when parented, as if its numbers were read in the new parent\'s frame.',
      whyItHappened: 'Its local matrix was left as it was, now relative to a different parent.',
      repairStrategy: 'Set local = inverse(parent\'s world) × world when changing parents.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Compute world positions down a chain of joints, by hand and with matrices.',
    explainVerbally: 'Explain why turns add up down the chain and why re-parenting needs an inverse.',
    detectIncorrectApplication: 'Recognise a reversed multiplication or a missing inverse from what moves and jumps.',
    transferToUnfamiliar: 'Build hierarchies for cars, characters and robots, and reason about reaching targets.',
  },

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-2-005-assess-1',
        type: 'choice',
        text: 'An object\'s world matrix is…',
        options: ['Its parent\'s world matrix × its local matrix', 'Its local matrix × its parent\'s world matrix', 'Its local matrix', 'The sum of all matrices above it'],
        answer: 'Its parent\'s world matrix × its local matrix',
        hint: 'The parent is on the left.',
      },
    ],
  },

  quiz: [
    { id: 'modelling-geometry-2-005-quiz-1', type: 'choice', text: 'A child\'s position in the Inspector is measured…', options: ['In its parent\'s frame', 'In the world', 'From the camera', 'From the root'], answer: 'In its parent\'s frame', hints: ['Local, not world.'], reviewSection: 'Intuition — children' },
    { id: 'modelling-geometry-2-005-quiz-2', type: 'choice', text: 'The hand is turned by the shoulder\'s 30° and the elbow\'s 45°. In the world it is turned…', options: ['75°', '45°', '30°', '15°'], answer: '75°', hints: ['Turns about one axis add.'], reviewSection: 'Intuition — turns add up' },
    { id: 'modelling-geometry-2-005-quiz-3', type: 'choice', text: 'Turning only the elbow moves…', options: ['The elbow, forearm and hand', 'Everything', 'Only the hand', 'Only the shoulder'], answer: 'The elbow, forearm and hand', hints: ['Everything below the joint.'], reviewSection: 'Intuition — forward kinematics' },
    { id: 'modelling-geometry-2-005-quiz-4', type: 'choice', text: 'To re-parent without moving, the new local matrix is…', options: ['inverse(parent\'s world) × world', 'world × parent\'s world', 'world', 'the identity'], answer: 'inverse(parent\'s world) × world', hints: ['parent\'s world × local must give world back.'], reviewSection: 'Intuition — re-parenting' },
    { id: 'modelling-geometry-2-005-quiz-5', type: 'choice', text: 'Why keep joints unscaled?', options: ['A joint\'s scale shears its turned children', 'Scale is not allowed on empties', 'It makes the file smaller', 'Joints cannot be scaled'], answer: 'A joint\'s scale shears its turned children', hints: ['Lesson 2.3.'], reviewSection: 'Intuition — the warning' },
    { id: 'modelling-geometry-2-005-quiz-6', type: 'choice', text: 'Each frame, a renderer updates world matrices by…', options: ['Walking the tree from the roots, parent × local', 'Sorting objects by name', 'Drawing parents first', 'Reading them from the file'], answer: 'Walking the tree from the roots, parent × local', hints: ['Once per object per frame.'], reviewSection: 'Intuition — the graphics strand' },
  ],

  checkpoints: [
    { id: 'cp-modelling-geometry-2-005-1', label: 'Read local and world, and how turns add up', type: 'read' },
    { id: 'cp-modelling-geometry-2-005-2', label: 'Read forward kinematics and re-parenting', type: 'read' },
    { id: 'cp-modelling-geometry-2-005-3', label: 'Read how a renderer walks the scene graph', type: 'read' },
    { id: 'cp-modelling-geometry-2-005-4', label: 'Complete the reach-the-target challenge', type: 'lab' },
    { id: 'cp-modelling-geometry-2-005-5', label: 'Predict the elbow and hand in MeshLab\'s trace, then turn and unparent', type: 'lab' },
    { id: 'cp-modelling-geometry-2-005-6', label: 'Work through the turned-parent example', type: 'example' },
    { id: 'cp-modelling-geometry-2-005-7', label: 'Work through the arm\'s-hand example', type: 'example' },
    { id: 'cp-modelling-geometry-2-005-8', label: 'Attempt the two-ways-to-reach challenge', type: 'challenge' },
  ],
};
