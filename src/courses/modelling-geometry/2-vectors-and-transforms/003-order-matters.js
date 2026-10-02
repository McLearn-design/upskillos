// Lesson 2.3: order matters (docs/modelling-course-plan.md). Four parts: the maths (matrix products do not
// commute), building it (comparing orders, taking a matrix apart into T, R and S, and putting steps in order
// as a graded challenge), watching MeshLab do it (a traced decomposition that finds a shear, in Predict mode),
// and using the tool (the Inspector's "How it is built", parents, Object › Decompose the matrix).
import { withPicture } from '../notebookScene.js';

const R4 = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)`;
const M3 = `// 3×3 matrices as rows.
const mul = (A, B) => A.map((row) => B[0].map((_, j) => row.reduce((s, a, k) => s + a * B[k][j], 0)))
const times = (M, v) => M.map((row) => row.reduce((s, m, j) => s + m * v[j], 0))
const Ry = (a) => [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]]
const Rx = (a) => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]]
const S = (x, y, z) => [[x, 0, 0], [0, y, 0], [0, 0, z]]`;

const NOT_COMMUTE = `${R4}
${M3}

// Stretch to (2, 0.5, 0.5) and turn 45° about y, in both orders.
const RS = mul(Ry(Math.PI / 4), S(2, 0.5, 0.5))   // stretch first, then turn
const SR = mul(S(2, 0.5, 0.5), Ry(Math.PI / 4))   // turn first, then stretch
console.log('R·S: ' + RS.map((row) => '[' + row.map(r).join(' ') + ']').join(' '))
console.log('S·R: ' + SR.map((row) => '[' + row.map(r).join(' ') + ']').join(' '))
console.log('the same: ' + (JSON.stringify(RS.map((row) => row.map(r))) === JSON.stringify(SR.map((row) => row.map(r)))))`;

const BOXES = `${R4}
${M3}

// A unit box, put through each order, and the angle between its edges that were at 90°.
const box = []
for (let i = 0; i < 8; i++) box.push([i % 2 - 0.5, Math.floor(i / 2) % 2 - 0.5, Math.floor(i / 4) - 0.5])
const sides = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]]
const angle = (M) => { const a = times(M, [1, 0, 0]), b = times(M, [0, 0, 1]); return r(Math.acos((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b))) * 180 / Math.PI) }
const RS = mul(Ry(Math.PI / 4), S(2, 0.5, 0.5)), SR = mul(S(2, 0.5, 0.5), Ry(Math.PI / 4))
console.log('stretch then turn: corner angle ' + angle(RS) + '°')
console.log('turn then stretch: corner angle ' + angle(SR) + '°')
const place = (M, dx) => box.map((p) => { const q = times(M, p); return [q[0] + dx, q[1], q[2]] })
show({ verts: [...place(RS, -1.6), ...place(SR, 1.6)], faces: [...sides, ...sides.map((f) => f.map((k) => k + 8))], groups: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1] })`;

const MORE = `${R4}
${M3}

// Moving and turning: move out by 3, turn 90° about y, in both orders. Where does the object's origin go?
const turn = (p) => times(Ry(Math.PI / 2), p), move = (p) => [p[0] + 3, p[1], p[2]]
console.log('turn, then move: ' + move(turn([0, 0, 0])).map(r).join(', ') + '   (turns in place, then moves)')
console.log('move, then turn: ' + turn(move([0, 0, 0])).map(r).join(', ') + '   (swings round the world origin)')
// Two turns do not commute either: where does the x axis go?
console.log('turn x then y: ' + times(mul(Ry(Math.PI / 2), Rx(Math.PI / 2)), [1, 0, 0]).map(r).join(', '))
console.log('turn y then x: ' + times(mul(Rx(Math.PI / 2), Ry(Math.PI / 2)), [1, 0, 0]).map(r).join(', '))`;

const DECOMPOSE = `${R4}
${M3}

// Take a 3×3 matrix apart: column lengths are the scale, columns divided by them the rotation, if the columns
// are at right angles. If not, there is a shear that no rotation and scale can describe.
const col = (M, j) => M.map((row) => row[j])
function decompose(M) {
  const c = [0, 1, 2].map((j) => col(M, j)), scale = c.map((v) => Math.hypot(...v))
  const u = c.map((v, i) => v.map((x) => x / scale[i]))
  const deg = (a, b) => Math.acos(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) * 180 / Math.PI
  return { scale: scale.map(r), angles: [deg(u[0], u[1]), deg(u[0], u[2]), deg(u[1], u[2])].map(r) }
}
const show2 = (name, M) => { const d = decompose(M); console.log(name + ': scale ' + d.scale.join(', ') + '; angles between columns ' + d.angles.join('°, ') + '°') }
show2('stretch then turn', mul(Ry(Math.PI / 4), S(2, 0.5, 0.5)))
show2('turn then stretch', mul(S(2, 0.5, 0.5), Ry(Math.PI / 4)))`;

const CHALLENGE = `// Put the three steps in the order that gives the target (blue): a box stretched along its own length,
// turned so that length runs along z, and standing at (0, 0, 3). Your result is orange.
const order = ['rotate', 'move', 'scale']

${R4}
const steps = {
  scale: ([x, y, z]) => [2 * x, y, z],                 // stretch along x to twice the length
  rotate: ([x, y, z]) => [z, y, -x],                   // a quarter turn about y: x goes to −z
  move: ([x, y, z]) => [x, y, z + 3],                  // move by (0, 0, 3)
}
const box = []
for (let i = 0; i < 8; i++) box.push([i % 2 - 0.5, Math.floor(i / 2) % 2 - 0.5, Math.floor(i / 4) - 0.5])
const sides = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]]
const run = (names) => box.map((p) => names.reduce((q, name) => steps[name](q), p))
const yours = run(order), target = run(['scale', 'rotate', 'move'])
const size = (pts) => [0, 1, 2].map((j) => r(Math.max(...pts.map((p) => p[j])) - Math.min(...pts.map((p) => p[j]))))
const centre = (pts) => [0, 1, 2].map((j) => r(pts.reduce((s, p) => s + p[j], 0) / pts.length))
console.log('yours: centre ' + centre(yours).join(', ') + ', size ' + size(yours).join(' × '))
show({ verts: [...target, ...yours], faces: [...sides, ...sides.map((f) => f.map((k) => k + 8))], groups: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1] })`;

const SOLVED = CHALLENGE.replace("const order = ['rotate', 'move', 'scale']", "const order = ['scale', 'rotate', 'move']");

const STEPS = { scale: ([x, y, z]) => [2 * x, y, z], rotate: ([x, y, z]) => [z, y, -x], move: ([x, y, z]) => [x, y, z + 3] };
const BOX = Array.from({ length: 8 }, (_, i) => [i % 2 - 0.5, Math.floor(i / 2) % 2 - 0.5, Math.floor(i / 4) - 0.5]);

/** The challenge's check: apply the steps in the chosen order and say what came out wrong, and why. */
export function checkOrder(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+order\s*=\s*\[([^\]]*)\]/);
  const order = m ? [...m[1].matchAll(/['"](\w+)['"]/g)].map((x) => x[1]) : [];
  if (order.length !== 3 || [...order].sort().join() !== 'move,rotate,scale') return no("The order should list 'scale', 'rotate' and 'move', each once.");
  const pts = BOX.map((p) => order.reduce((q, name) => STEPS[name](q), p));
  const centre = [0, 1, 2].map((j) => pts.reduce((s, p) => s + p[j], 0) / 8);
  const size = [0, 1, 2].map((j) => Math.max(...pts.map((p) => p[j])) - Math.min(...pts.map((p) => p[j])));
  const fmt = (v) => v.map((x) => +x.toFixed(3) + 0).join(', ');
  const i = (name) => order.indexOf(name);
  if (Math.hypot(centre[0], centre[1], centre[2] - 3) > 1e-9) {
    return no(`Its centre ends at (${fmt(centre)}), not (0, 0, 3): it was moved before it was turned, so the turn swung it round the world's origin${i('scale') === 2 ? ', and then the stretch along x pulled it further out' : ''}.`);
  }
  if (Math.abs(size[2] - 2) > 1e-9) return no(`It is ${fmt(size).replace(/, /g, ' × ')}: long along x, not z. It was stretched after it was turned, so the stretch went along the world's x axis instead of along the box's own length.`);
  return { pass: true, message: 'Stretched along its own length, then turned, then moved: M = T·R·S, the order every object\'s own matrix uses.' };
}

export default {
  id: 'modelling-geometry-2-003',
  slug: 'order-matters',
  chapter: 'modelling-geometry-2',
  order: 3,
  title: 'Order Matters',
  subtitle: 'Turn then stretch is not stretch then turn: matrix products depend on their order.',
  tags: ['transforms', 'matrices', 'composition', 'shear', 'decomposition'],
  aliases: 'matrix multiplication order non commutative trs order shear decompose matrix position rotation scale parent non uniform scale orbit meshlab',
  timeToComplete: 45,
  coreConcept: 'Matrix products depend on order: A·B is generally not B·A. Scaling after rotating stretches along the world\'s axes and slants the shape (a shear); moving before rotating swings an object round the origin. An object\'s own matrix is always T·R·S, and taking a matrix apart (position from the fourth column, scale from the column lengths, rotation from the rest) shows whether it really is.',
  prerequisites: ['modelling-geometry-2-002'],
  nextLesson: null,

  hook: {
    question: 'Give two boxes the same stretch and the same turn, and one comes out a neat long box while the other is a slanted diamond. Nothing was different except the order. Why does order change the shape?',
    realWorldContext: 'Order bugs are among the most common in 3D code: a model that shears when its parent is scaled, a planet that orbits when it should spin, a gun that fires from the wrong place. Every engine fixes one order for objects (scale, rotate, move) for exactly this reason.',
  },

  intuition: {
    prose: [
      'Numbers multiply in any order: $2 \\times 3 = 3 \\times 2$. Matrices do not. Take $S$, stretching to $(2, 0.5, 0.5)$, and $R$, a 45° turn about $y$. $R\\,S$ stretches first and then turns: a long box, turned. $S\\,R$ turns first and then stretches along the world\'s axes, which now run diagonally across the box: the box\'s right-angled corners are pulled into a slant, a **shear**. The two products have different numbers in them.',
      'Measure it: in $R\\,S$ the box\'s edges still meet at 90°; in $S\\,R$ the edges that started along $x$ and $z$ meet at about 28°. The shape is no longer a box at all.',
      'Moving and turning do not commute either. Turn an object 90° and then move it 3 along $x$: it ends at $(3, 0, 0)$, turned. Move it first and then turn: the turn is about the world\'s origin, so it swings round to $(0, 0, -3)$, like a moon on its orbit. Even two turns depend on order: turn about $x$ then $y$, and the $x$ axis ends at $(0, 0, -1)$; turn about $y$ then $x$, and it ends at $(0, 1, 0)$.',
      'Before reading on, predict: why do objects in a modelling tool never shear, however you scale and turn them? Because every object\'s own matrix is built in one fixed order, $T\\,R\\,S$: stretch along its own axes, then turn, then move. A shear appears only when a stretch is applied after a turn, and that happens when a child is turned under a parent that is stretched: the parent\'s scale comes after the child\'s rotation.',
      'You can test a matrix for this by **decomposing** it. The fourth column is the position. The first three columns are where the axes went: their lengths are the scale, and divided by their lengths they should be a rotation, three unit vectors at right angles. If they are not at right angles, the matrix has a shear, and no position, rotation and scale can make it.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Decompose a matrix',
        body: 'Step 1. Position: the fourth column.\nStep 2. Scale: the lengths of columns 1, 2 and 3.\nStep 3. Rotation: each column divided by its length.\nStep 4. Check: the unit columns should be at 90° to each other (dot products 0). If not, the matrix has a shear and is not a T·R·S.\nStep 5. (Lesson 2.4: a negative determinant means one scale is negative, a mirror.)',
      },
      {
        type: 'warning',
        title: 'A stretched parent shears its turned children',
        body: 'Scale a parent unevenly (say only along x) and any child that is turned relative to it gets a world matrix of the form S·R: it slants. Blender and MeshLab both allow it, and a file format that stores position, rotation and scale cannot save it. Keep parents at even scale, or apply the scale to the parent\'s mesh.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: one matrix, built once',
        body: 'three.js builds every object\'s matrix with compose(position, quaternion, scale), which is always T·R·S, and multiplies parent matrices on the left to get the world matrix. The vertex shader receives only the final product, so a wrong order upstream shows on screen as distortion: slanted boxes, normals that light a sheared surface as if it were not, outlines that no longer fit.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: order',
        props: {
          lesson: {
            title: 'Order matters',
            subtitle: 'Compare orders as numbers and as shapes, see moves and turns disagree, decompose a matrix, and put three steps in order.',
            cells: [
              { type: 'js', instruction: '### 1. R·S is not S·R\nThe same stretch and the same turn, multiplied both ways: different matrices.', startCode: NOT_COMMUTE },
              { type: 'js', instruction: '### 2. What it does to a box\nBlue: stretched, then turned, still a box (corners at 90°). Orange: turned, then stretched, slanted (corners at about 28°). Drag to turn the picture.', startCode: withPicture(BOXES), showPreviewByDefault: true, outputHeight: 340 },
              { type: 'js', instruction: '### 3. Moves and turns\nMoving before turning swings an object round the origin; and two turns about different axes disagree too.', startCode: MORE },
              { type: 'js', instruction: '### 4. Decompose\nColumn lengths give the scale; angles between the columns show whether the rest is a rotation. The turned-then-stretched matrix fails the check.', startCode: DECOMPOSE },
              { type: 'challenge', instruction: '### 5. Challenge: put the steps in order\nArrange scale, rotate and move so the orange box matches the blue target. The check applies your order and says what went wrong and why.', startCode: withPicture(CHALLENGE), solutionCode: withPicture(SOLVED), check: checkOrder, showPreviewByDefault: true, outputHeight: 340 },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Order matters" in MeshLab](#/lab/mesh-lab?project=order-matters). It builds cell 2\'s two boxes: one with its own stretch and turn, one turned under a stretched parent. It takes both world matrices apart; the second is traced with **Record traces** on. The Algorithm trace is in **Predict** mode: predict the length of the first column (about 1.458), then the angle between columns 1 and 3 (about 28°, as in your cell 2). Then remove the shear yourself.' },
              { type: 'markdown', instruction: '### Use the tool\n- The Inspector\'s **How it is built: T, R and S** shows that every object\'s own matrix is T·R·S; its **world** matrix multiplies in its parents\'.\n- **Object › Decompose the matrix** takes the selected object\'s world matrix apart and reports any shear.\n- In a script: object.decompose().\n- **In Blender:** an object under a parent with uneven scale shears the same way when turned. Ctrl+A › Scale on the parent bakes its scale into its mesh and avoids it.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      'For 3×3 matrices, $(A\\,B)\\,v = A\\,(B\\,v)$: $B$ acts first. In general $A\\,B \\ne B\\,A$. With $S = \\mathrm{diag}(2, 0.5, 0.5)$ and $R = R_y(45°)$: $R\\,S$ has columns $(1.414, 0, -1.414)$, $(0, 0.5, 0)$, $(0.354, 0, 0.354)$, while $S\\,R$ has columns $(1.414, 0, -0.354)$, $(0, 0.5, 0)$, $(1.414, 0, 0.354)$.',
      'Some pairs do commute: two rotations about the same axis, two scales, two translations, and a uniform scale with anything linear. Scale and rotation commute exactly when the scale is the same along every axis the rotation moves.',
      'Decomposition: for $M = \\begin{pmatrix} A & t \\\\ 0 & 1 \\end{pmatrix}$, position $= t$, $s_j = |a_j|$ (the column lengths), and $R = A\\,\\mathrm{diag}(1/s_1, 1/s_2, 1/s_3)$. $M$ is a T·R·S exactly when $R^{\\mathsf T} R = I$, that is, when the columns of $A$ are at right angles.',
      'For $S\\,R$ above: $|a_1| = |a_3| = \\sqrt{2 + 0.125} \\approx 1.458$, and the unit columns meet at $\\arccos(1.875 / 2.125) \\approx 28.07°$, a shear of about 61.93° from square.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Any invertible 3×3 matrix $A$ can be written $A = Q\\,P$ with $Q$ a rotation (or a rotation and a mirror) and $P$ a symmetric stretch along some three perpendicular directions: the polar decomposition. T·R·S is the special case where those directions are the object\'s own axes. A shear is a stretch along other directions, which is why it needs more than three scale numbers to describe.',
      'A product of T·R·S matrices is not always a T·R·S: $(T_1 R_1 S_1)(T_2 R_2 S_2)$ contains $S_1 R_2$, which shears unless $S_1$ is uniform. That is the parent–child case, and why file formats that store only position, rotation and scale per node (glTF\'s TRS form) cannot store every hierarchy exactly.',
      'The order of the three letters is a convention, chosen because it is the one that never shears: scaling first, in the object\'s own frame, keeps the stretch aligned with the object. Some older software used other orders, which is a classic source of import bugs.',
      'Inverting reverses order: $(T\\,R\\,S)^{-1} = S^{-1} R^{-1} T^{-1}$. To undo, unmove first, then unturn, then unstretch, like taking off shoes and socks in the opposite order you put them on. Chapter 3 inverts the camera\'s matrix this way.',
    ],
    callouts: [
      { type: 'insight', title: 'Bridge: from algebra to code', body: 'mul(Ry, S) and mul(S, Ry) in cell 1 are A·B and B·A; the different numbers are non-commutativity made visible.' },
      { type: 'insight', title: 'Bridge: from code to the screen', body: 'Cell 2 draws the two products: the slant is the shear the decomposition in cell 4 detects.' },
      { type: 'insight', title: 'Bridge: from the screen to MeshLab', body: 'Object › Decompose the matrix runs the same steps on an object\'s world matrix, parent included.' },
    ],
    visualizations: [],
  },

  examples: [
    {
      id: 'modelling-geometry-2-003-ex1',
      title: 'Turn and move',
      difficulty: 'easy',
      problem: 'The origin is moved by (3, 0, 0) and turned 90° about y. Where does it end up in each order?',
      steps: [
        { expression: '\\text{turn, then move: } (0,0,0) \\to (0,0,0) \\to (3,0,0)', annotation: 'Turning the origin leaves it where it is.', strategyTitle: 'Step 1: Turn first' },
        { expression: '\\text{move, then turn: } (3,0,0) \\to (0,0,-3)', annotation: 'A quarter turn about y sends x to −z.', strategyTitle: 'Step 2: Move first' },
      ],
      answer: 'Turn then move: (3, 0, 0). Move then turn: (0, 0, −3).',
    },
    {
      id: 'modelling-geometry-2-003-ex2',
      title: 'Spotting a shear',
      difficulty: 'medium',
      problem: 'A matrix has first column (1.414, 0, −0.354) and third column (1.414, 0, 0.354). Are they at right angles?',
      steps: [
        { expression: '1.414^2 - 0.354^2 = 2 - 0.125 = 1.875', annotation: 'Their dot product.', strategyTitle: 'Step 1: Dot product' },
        { expression: '\\cos\\theta = 1.875 / 2.125 \\approx 0.882,\\ \\theta \\approx 28.07°', annotation: 'Both lengths are √2.125.', strategyTitle: 'Step 2: Angle' },
      ],
      answer: 'No: about 28°, so the matrix has a shear and is not a T·R·S.',
    },
    {
      id: 'modelling-geometry-2-003-ex3',
      title: 'Undoing a transform',
      difficulty: 'hard',
      problem: 'M = T·R·S with T a move by (2, 0, −1), R a 30° turn about y, S a scale by (1, 2, 1). Write the steps that undo it, in order.',
      steps: [
        { expression: 'M^{-1} = S^{-1} R^{-1} T^{-1}', annotation: 'Inverses in reverse order.', strategyTitle: 'Step 1: Reverse' },
        { expression: '\\text{move by } (-2, 0, 1),\\ \\text{turn } -30°,\\ \\text{scale by } (1, 0.5, 1)', annotation: 'T⁻¹ acts first.', strategyTitle: 'Step 2: The steps' },
      ],
      answer: 'Move by (−2, 0, 1), then turn −30° about y, then scale by (1, 0.5, 1).',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-2-003-ch1',
      title: 'Does it matter here?',
      difficulty: 'easy',
      problem: 'An object is scaled evenly by 2 and turned 45°. Does the order matter?',
      hint: 'Is the scale the same along every axis?',
      answer: 'No: a uniform scale commutes with any rotation.',
      walkthrough: [],
    },
    {
      id: 'modelling-geometry-2-003-ch2',
      title: 'The orbiting moon',
      difficulty: 'medium',
      problem: 'You want a moon to circle a planet at the origin at distance 3. Should its matrix be "move out, then turn" or "turn, then move out"?',
      hint: 'Which order swings the moon round the origin?',
      answer: 'Move out by 3 first, then turn: R·T. Changing the turn angle over time then moves the moon round the circle.',
      walkthrough: [],
    },
    {
      id: 'modelling-geometry-2-003-ch3',
      title: 'The slanted wheel',
      difficulty: 'hard',
      problem: 'A car body is scaled (1, 1, 2) to make it longer, and its front wheels are children of the body. Steered 30°, they look like slanted ovals; pointing straight ahead they look fine. Explain, and fix it.',
      hint: 'What is each wheel\'s world matrix?',
      answer: 'Each wheel\'s world matrix is the body\'s uneven scale times the wheel\'s turn, S·R. Straight ahead there is no turn, so it is only a stretch; at 30° the stretch is along the car, not the wheel, and the wheel shears. Apply the body\'s scale to its mesh (so the body is scaled 1), or unparent the wheels from the scaled part.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      { symbol: 'A\\,B \\ne B\\,A', meaning: 'Matrix products depend on order: B acts first in A·B.' },
      { symbol: '\\text{shear}', meaning: 'A slant: axes that were at right angles no longer are.' },
      { symbol: '\\text{decompose}', meaning: 'Take a matrix apart into position, scale and rotation.' },
      { symbol: '|a_j|', meaning: 'The length of column j: the scale along axis j.' },
      { symbol: 'R^{\\mathsf{T}} R = I', meaning: 'The test that the unit columns really form a rotation.' },
      { symbol: '(A\\,B)^{-1} = B^{-1} A^{-1}', meaning: 'Undoing reverses the order.' },
    ],
    rulesOfThumb: [
      'Objects: always scale, then rotate, then move.',
      'Stretch after turn shears; move before turn orbits.',
      'Keep parents evenly scaled if their children turn.',
      'To undo, reverse the steps and invert each one.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'Transforms can be applied in any order with the same result.',
      whyStudentsThinkIt: 'Ordinary multiplication does not care about order.',
      correctionExample: 'Stretch then turn gives a box; turn then stretch gives a slanted diamond.',
      contrastCase: 'Uniform scale with a rotation, or two turns about the same axis, do commute.',
    },
    {
      falseBelief: 'Any matrix can be described by a position, a rotation and a scale.',
      whyStudentsThinkIt: 'The Inspector always shows those three.',
      correctionExample: 'The turned-then-stretched box\'s world matrix has columns 28° apart: no T·R·S gives that.',
      contrastCase: 'An object\'s own matrix is always exactly T·R·S.',
    },
  ],

  transferPrompts: [
    {
      situation: 'An exported model looks right in your tool but slanted in a game engine.',
      competingTechniques: ['Decompose the world matrices and look for shear', 'Re-export with different settings at random'],
      whyThisTechniqueWins: 'A shear means a stretched parent with turned children, which TRS-based formats cannot store; finding it names the node to fix.',
    },
    {
      situation: 'An object should spin in place, but it swings around the scene.',
      competingTechniques: ['Check the order of the turn and the move', 'Adjust the turn speed'],
      whyThisTechniqueWins: 'Swinging around the origin is the signature of moving before turning.',
    },
  ],

  debugging: [
    {
      commonError: 'Multiplying parent and child matrices in the wrong order.',
      symptom: 'Children move strangely: they are pushed by the parent\'s scale, or swing round the world origin.',
      whyItHappened: 'World = parent × child; child × parent applies the parent first.',
      repairStrategy: 'Multiply parents on the left, from the root down (lesson 2.5).',
    },
    {
      commonError: 'Reading the scale off the diagonal of a rotated matrix.',
      symptom: 'A box turned 90° seems to have scale (0, 1, 0).',
      whyItHappened: 'After a rotation the scale is spread across each column.',
      repairStrategy: 'The scale is the length of each column, not the diagonal entry.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Predict the effect of each order, and decompose a matrix into position, scale and rotation.',
    explainVerbally: 'Explain why stretching after turning shears, and why objects use T·R·S.',
    detectIncorrectApplication: 'Recognise orbiting, shearing and diagonal-for-scale mistakes from their symptoms.',
    transferToUnfamiliar: 'Find the cause of a slanted or swinging object in a hierarchy, and undo a transform.',
  },

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-2-003-assess-1',
        type: 'choice',
        text: 'A child is turned under a parent stretched only along x. The child looks…',
        options: ['Slanted (sheared)', 'Exactly the same', 'Mirrored', 'Smaller everywhere'],
        answer: 'Slanted (sheared)',
        hint: 'Its world matrix is S·R.',
      },
    ],
  },

  quiz: [
    { id: 'modelling-geometry-2-003-quiz-1', type: 'choice', text: 'In A·B applied to a vertex, which acts first?', options: ['B', 'A', 'Both at once', 'It depends on the vertex'], answer: 'B', hints: ['A·(B·v).'], reviewSection: 'Math — order' },
    { id: 'modelling-geometry-2-003-quiz-2', type: 'choice', text: 'Turn 90° about y, then move by (3, 0, 0). The origin ends at…', options: ['(3, 0, 0)', '(0, 0, −3)', '(0, 0, 3)', '(0, 3, 0)'], answer: '(3, 0, 0)', hints: ['(0, 0, −3) is move then turn.'], reviewSection: 'Examples — turn and move' },
    { id: 'modelling-geometry-2-003-quiz-3', type: 'choice', text: 'Which pair always commutes?', options: ['A uniform scale and a rotation', 'An uneven scale and a rotation', 'A move and a rotation', 'Turns about x and about y'], answer: 'A uniform scale and a rotation', hints: ['Even scale looks the same in every direction.'], reviewSection: 'Math — what commutes' },
    { id: 'modelling-geometry-2-003-quiz-4', type: 'choice', text: 'When decomposing, the scale along an axis is…', options: ['The length of that column', 'The diagonal entry', 'The fourth column', 'The determinant'], answer: 'The length of that column', hints: ['A rotation spreads it across the column.'], reviewSection: 'Intuition — decomposing' },
    { id: 'modelling-geometry-2-003-quiz-5', type: 'choice', text: 'A matrix\'s unit columns meet at 28°. It is…', options: ['Not a T·R·S: it has a shear', 'A rotation', 'A mirror', 'The identity'], answer: 'Not a T·R·S: it has a shear', hints: ['A rotation\'s columns meet at 90°.'], reviewSection: 'Examples — spotting a shear' },
    { id: 'modelling-geometry-2-003-quiz-6', type: 'choice', text: 'Why do objects in three.js never shear by themselves?', options: ['Their matrix is always built as T·R·S', 'The GPU forbids it', 'Scale is always uniform', 'Rotations are stored as quaternions'], answer: 'Their matrix is always built as T·R·S', hints: ['compose(position, quaternion, scale).'], reviewSection: 'Intuition — the graphics strand' },
  ],

  checkpoints: [
    { id: 'cp-modelling-geometry-2-003-1', label: 'Read why R·S and S·R differ', type: 'read' },
    { id: 'cp-modelling-geometry-2-003-2', label: 'Read moves, turns and orbits', type: 'read' },
    { id: 'cp-modelling-geometry-2-003-3', label: 'Read how decomposing finds a shear', type: 'read' },
    { id: 'cp-modelling-geometry-2-003-4', label: 'Complete the put-the-steps-in-order challenge', type: 'lab' },
    { id: 'cp-modelling-geometry-2-003-5', label: 'Predict the column length and angle in MeshLab\'s trace, then remove the shear', type: 'lab' },
    { id: 'cp-modelling-geometry-2-003-6', label: 'Work through the spotting-a-shear example', type: 'example' },
    { id: 'cp-modelling-geometry-2-003-7', label: 'Work through the undoing example', type: 'example' },
    { id: 'cp-modelling-geometry-2-003-8', label: 'Attempt the slanted-wheel challenge', type: 'challenge' },
  ],
};
