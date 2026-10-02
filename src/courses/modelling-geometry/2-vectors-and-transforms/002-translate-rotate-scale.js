// Lesson 2.2: translate, rotate, scale (docs/modelling-course-plan.md). Four parts: the maths (3×3 matrices,
// the 4×4 homogeneous form), building it (moving vertices by hand, then by matrices, and writing a matrix as a
// graded challenge), watching MeshLab do it (a traced M = T·R·S in Predict mode), and using the tool (Move,
// Rotate, Scale, the Inspector's matrices).
import { withPicture } from '../notebookScene.js';

const PYR = `const P = [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], [0, 1.5, 0]]   // the pyramid's vertices
const F = [[0, 1, 2, 3], [1, 0, 4], [2, 1, 4], [3, 2, 4], [0, 3, 4]]`;

const R4 = `const r = (x) => +(Math.abs(x) < 1e-12 ? 0 : x).toFixed(4)`;

const BY_HAND = `${PYR}
${R4}

// Scale by (1, 2, 1), turn 30° about the y axis, then move by (2, 0, -1): one step at a time.
const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6)
function place([x, y, z]) {
  ;[x, y, z] = [x * 1, y * 2, z * 1]                    // scale: multiply each coordinate by its factor
  ;[x, y, z] = [x * c + z * s, y, -x * s + z * c]        // rotate about y: x and z turn, y stays
  return [x + 2, y + 0, z - 1]                           // move: add the offset
}
P.forEach((p, i) => console.log('v' + i + ': ' + p.join(', ') + ' → ' + place(p).map(r).join(', ')))`;

const MATRIX3 = `${R4}

// The rotation as a 3×3 matrix. Multiplying a matrix by a column of numbers: each output is one row · the input.
const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6)
const R = [[c, 0, s], [0, 1, 0], [-s, 0, c]]
const times = (M, v) => M.map((row) => row.reduce((sum, m, j) => sum + m * v[j], 0))
// Where each axis goes is a column of R.
for (const [name, axis] of [['x', [1, 0, 0]], ['y', [0, 1, 0]], ['z', [0, 0, 1]]]) console.log(name + ' axis → ' + times(R, axis).map(r).join(', '))
// A rotation keeps lengths.
const v = [-1, 0, -1], w = times(R, v)
console.log('|v| = ' + r(Math.hypot(...v)) + ', |Rv| = ' + r(Math.hypot(...w)))`;

const MAT_FN = `// 4×4 matrices, written as rows; a vertex is the column (x, y, z, 1).
const mul = (A, B) => A.map((row) => B[0].map((_, j) => row.reduce((sum, a, k) => sum + a * B[k][j], 0)))
const apply = (M, [x, y, z]) => M.slice(0, 3).map((row) => row[0] * x + row[1] * y + row[2] * z + row[3])
const T = (x, y, z) => [[1, 0, 0, x], [0, 1, 0, y], [0, 0, 1, z], [0, 0, 0, 1]]
const S = (x, y, z) => [[x, 0, 0, 0], [0, y, 0, 0], [0, 0, z, 0], [0, 0, 0, 1]]
const Ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, s, 0], [0, 1, 0, 0], [-s, 0, c, 0], [0, 0, 0, 1]] }`;

const HOMOGENEOUS = `${PYR}
${R4}

${MAT_FN}

// One matrix that scales, then rotates, then moves: M = T · R · S (it acts on a vertex from the right).
const M = mul(T(2, 0, -1), mul(Ry(Math.PI / 6), S(1, 2, 1)))
M.forEach((row) => console.log('[ ' + row.map(r).join('  ') + ' ]'))
const moved = P.map((p) => apply(M, p))
console.log('v0 → ' + moved[0].map(r).join(', ') + ',  tip → ' + moved[4].map(r).join(', '))

// Draw the pyramid before (blue) and after (orange) as one picture.
show({ verts: [...P, ...moved], faces: [...F, ...F.map((f) => f.map((k) => k + 5))], groups: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1] })`;

const CHALLENGE = `// Write the 4×4 matrix (as rows) that makes the pyramid twice as tall and then moves it by (3, 1, 0):
// its tip, at (0, 1.5, 0), should end up at (3, 4, 0). It starts as the identity, which changes nothing.
const M = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
]

${PYR}
${R4}
const apply = (M, [x, y, z]) => M.slice(0, 3).map((row) => row[0] * x + row[1] * y + row[2] * z + row[3])
const moved = P.map((p) => apply(M, p))
console.log('tip → ' + moved[4].map(r).join(', '))
show({ verts: [...P, ...moved], faces: [...F, ...F.map((f) => f.map((k) => k + 5))], groups: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1] })`;

const SOLVED = CHALLENGE.replace('  [1, 0, 0, 0],\n  [0, 1, 0, 0],\n  [0, 0, 1, 0],', '  [1, 0, 0, 3],\n  [0, 2, 0, 1],\n  [0, 0, 1, 0],');

const PTS = [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], [0, 1.5, 0]];
const want = ([x, y, z]) => [x + 3, 2 * y + 1, z];
const fmt = (p) => `(${p.map((x) => +x.toFixed(4)).join(', ')})`;

/** The challenge's check: read M, apply it to every vertex, and say what it does wrong. */
export function checkMatrix(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+M\s*=\s*(\[[\s\S]*?\n\s*\])/);
  let M = null;
  try { M = m && JSON.parse(m[1].replace(/\/\/.*$/gm, '').replace(/,\s*\]/g, ']')); } catch { M = null; }
  if (!Array.isArray(M) || M.length !== 4 || M.some((row) => !Array.isArray(row) || row.length !== 4 || row.some((x) => typeof x !== 'number'))) return no('M should be 4 rows of 4 numbers, as const M = [ … ].');
  if (M[3].join() !== '0,0,0,1') return no(`The bottom row is ${M[3].join(', ')}. For moving, turning and scaling it is 0, 0, 0, 1, so a vertex's fourth coordinate stays 1.`);
  const apply = ([x, y, z]) => M.slice(0, 3).map((row) => row[0] * x + row[1] * y + row[2] * z + row[3]);
  const close = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  // S·T moves first and scales the move as well: the tip lands at (3, 5, 0).
  if (close(apply([0, 1.5, 0]), [3, 5, 0])) return no('M sends the tip to (3, 5, 0): it moves first and then scales, so the move is stretched too. Scale first, then move (M = T·S): the move belongs in the fourth column unscaled.');
  for (const [i, p] of PTS.entries()) {
    const got = apply(p), goal = want(p);
    if (!close(got, goal)) return no(`M sends v${i} ${fmt(p)} to ${fmt(got)}; it should go to ${fmt(goal)}.`);
  }
  return { pass: true, message: 'Every vertex lands where it should: y doubled on the diagonal, then (3, 1, 0) added from the fourth column.' };
}

export default {
  id: 'modelling-geometry-2-002',
  slug: 'translate-rotate-scale',
  chapter: 'modelling-geometry-2',
  order: 2,
  title: 'Translate, Rotate, Scale',
  subtitle: 'Moving an object never touches its vertex list: one matrix does it all.',
  tags: ['transforms', 'matrices', 'homogeneous coordinates', 'model matrix', 'rotation'],
  aliases: 'translate rotate scale trs matrix 3x3 4x4 homogeneous coordinates model matrix affine transform rotation matrix vertex shader meshlab inspector',
  timeToComplete: 50,
  coreConcept: 'An object keeps its vertices in its own coordinates and carries a transform: scale, then rotate, then move. Scaling and rotating are 3×3 matrices; moving needs a fourth row and column, so all three combine into one 4×4 matrix M = T·R·S that takes each vertex (x, y, z, 1) to where it is drawn.',
  prerequisites: ['modelling-geometry-2-001'],
  nextLesson: null,

  hook: {
    question: 'Drag an object across the screen in a modelling tool and its vertex list does not change at all. So where is the move stored, and how is a vertex drawn somewhere other than where its numbers say?',
    realWorldContext: 'Every object in every 3D tool, game engine and file format carries a transform: position, rotation and scale, combined into a model matrix. The GPU multiplies every vertex by it, every frame. Instancing a thousand trees is one mesh and a thousand matrices.',
  },

  intuition: {
    prose: [
      'The pyramid\'s vertices are in its own coordinates: the base round the origin, the tip at $(0, 1.5, 0)$. To place it in the world, take each vertex through three steps. **Scale**: multiply each coordinate by its own factor; scaling by $(1, 2, 1)$ doubles the height, so the tip goes to $(0, 3, 0)$. **Rotate**: turning by 30° about the $y$ axis mixes $x$ and $z$ and leaves $y$ alone. **Translate**: add an offset, here $(2, 0, -1)$, so the tip ends at $(2, 3, -1)$.',
      'Rotating $(x, y, z)$ by $\\theta$ about $y$ gives $(x\\cos\\theta + z\\sin\\theta,\\ y,\\ -x\\sin\\theta + z\\cos\\theta)$. Vertex 0 at $(-1, 0, -1)$, turned 30°: $(-1.366, 0, -0.366)$; moved: $(0.634, 0, -1.366)$.',
      'Written as a **matrix**, the rotation is a grid of 9 numbers, and applying it is a dot product of each row with the vertex. Its columns are where the $x$, $y$ and $z$ axes end up: for 30° about $y$, the $x$ axis goes to $(0.866, 0, -0.5)$. Scaling is a matrix too, with its factors down the diagonal. Matrices multiply, so scale-then-rotate is one matrix $R\\,S$.',
      'Before reading on, predict: can moving by $(2, 0, -1)$ be a 3×3 matrix? No: any 3×3 matrix sends $(0, 0, 0)$ to $(0, 0, 0)$, and a move shifts the origin. The fix is a fourth coordinate. Write each vertex as $(x, y, z, 1)$ and use 4×4 matrices: the fourth column multiplies that 1, so it adds a constant, which is exactly a move. These are **homogeneous coordinates**.',
      'Now all three steps are 4×4 matrices and multiply into one: $M = T\\,R\\,S$. Read right to left, because the matrix nearest the vertex acts first: scale, then rotate, then move. $M$\'s first three columns are where the object\'s axes point (scaled), and its fourth column is where its origin goes, its position. The vertex list never changes; only $M$ does.',
      'This is what MeshLab\'s Inspector shows for each object: Position, Rotation and Scale, the matrix they make, and under "How it is built" the three matrices T, R and S.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Build a model matrix and apply it',
        body: 'Step 1. S: the scale factors down the diagonal.\nStep 2. R: the rotation (for one axis, cos and sin in the two coordinates that turn).\nStep 3. T: the identity with the move in the fourth column.\nStep 4. $M = T\\,R\\,S$.\nStep 5. For each vertex, multiply $M$ by $(x, y, z, 1)$ and keep the first three numbers.',
      },
      {
        type: 'warning',
        title: 'Points get the move; directions do not',
        body: 'A point is $(x, y, z, 1)$ and picks up the fourth column. A direction, such as a normal or an edge vector, is $(x, y, z, 0)$: moving an object does not change which way its faces point. Treat a normal as a point and every normal is shifted by the position, and the lighting goes wrong.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: the model matrix in the vertex shader',
        body: 'Each object\'s M is sent to the GPU as 16 numbers (a "uniform"), stored column by column. The vertex shader runs once per vertex and starts with modelMatrix * vec4(position, 1.0): the 1.0 is the homogeneous coordinate that lets the matrix move the vertex. The view and projection matrices of chapter 3 are multiplied on afterwards. The mesh in GPU memory never changes as an object moves; only its matrix does.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: matrices',
        props: {
          lesson: {
            title: 'Translate, rotate, scale',
            subtitle: 'Place the pyramid by hand, as 3×3 matrices, and as one 4×4 matrix, then write one yourself.',
            cells: [
              { type: 'js', instruction: '### 1. By hand\nScale, rotate, move, one step at a time, for every vertex of the pyramid.', startCode: BY_HAND },
              { type: 'js', instruction: '### 2. A rotation matrix\nEach column of R is where an axis goes; multiplying by R keeps lengths.', startCode: MATRIX3 },
              { type: 'js', instruction: '### 3. One 4×4 matrix\nT, R and S as 4×4 matrices, multiplied into M = T·R·S. Applying M gives the same places as cell 1. Blue is the pyramid in its own coordinates, orange is where M draws it.', startCode: withPicture(HOMOGENEOUS), showPreviewByDefault: true, outputHeight: 340 },
              { type: 'challenge', instruction: '### 4. Challenge: write the matrix\nWrite M so the pyramid becomes twice as tall and is then moved by (3, 1, 0). The check applies your M to every vertex and names the first one that lands in the wrong place.', startCode: withPicture(CHALLENGE), solutionCode: withPicture(SOLVED), check: checkMatrix, showPreviewByDefault: true, outputHeight: 340 },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Translate, rotate, scale" in MeshLab](#/lab/mesh-lab?project=translate-rotate-scale). It places the same pyramid as cells 1 and 3 (scale (1, 2, 1), 30° about y, moved by (2, 0, −1)) and traces its matrix with **Record traces** on. The Algorithm trace is in **Predict** mode: after building S, R and T it asks for the fourth column of M, then where vertex 0 is drawn. Compare its numbers with your cell 1. Then change the rotation and trace it again.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Move, Rotate, Scale** in the toolbar (keys G, R, S) change Position, Rotation and Scale; the Inspector shows the matrix as it changes, and "How it is built: T, R and S".\n- **Object › Trace the transform (T·R·S)** traces the selected object\'s matrix on its vertices.\n- In a script: object.position, .rotation (in radians) and .scale; object.traceTransform().\n- **In Blender:** G, R and S, and the N panel\'s Transform. Ctrl+A › All Transforms bakes the matrix into the vertices, leaving the object at the origin with no rotation and scale 1.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      'Scale and rotation about $y$ as 3×3 matrices: $S = \\begin{pmatrix} s_x & 0 & 0 \\\\ 0 & s_y & 0 \\\\ 0 & 0 & s_z \\end{pmatrix}$, $R_y(\\theta) = \\begin{pmatrix} \\cos\\theta & 0 & \\sin\\theta \\\\ 0 & 1 & 0 \\\\ -\\sin\\theta & 0 & \\cos\\theta \\end{pmatrix}$. A matrix times a column: output $i$ is row $i$ dotted with the input.',
      'In homogeneous coordinates a point is $(x, y, z, 1)$ and a translation is $T = \\begin{pmatrix} 1 & 0 & 0 & t_x \\\\ 0 & 1 & 0 & t_y \\\\ 0 & 0 & 1 & t_z \\\\ 0 & 0 & 0 & 1 \\end{pmatrix}$: $T\\,(x, y, z, 1) = (x + t_x, y + t_y, z + t_z, 1)$.',
      'The model matrix $M = T\\,R\\,S$ has the form $\\begin{pmatrix} A & t \\\\ 0 & 1 \\end{pmatrix}$ with $A = R\\,S$ (3×3) and $t$ the position. So $M\\,(p, 1) = (A\\,p + t, 1)$: a linear part and a move.',
      'For the lesson\'s pyramid: $A = R_y(30°)\\,\\mathrm{diag}(1, 2, 1)$, $t = (2, 0, -1)$. Vertex 0: $A\\,(-1, 0, -1) = (-1.366, 0, -0.366)$, plus $t$: $(0.634, 0, -1.366)$.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Why the columns are the axes\' images: $A\\,(1, 0, 0) = $ the first column of $A$, and any vertex $(x, y, z) = x(1,0,0) + y(0,1,0) + z(0,0,1)$ goes to $x$ times the first column plus $y$ times the second plus $z$ times the third. So a matrix is completely described by where it sends the three axes.',
      'A rotation matrix has columns that are unit vectors at right angles to each other, so $R^{\\mathsf T} R = I$ and $R^{-1} = R^{\\mathsf T}$: undoing a rotation is transposing it. It keeps every length and angle, and its determinant is 1 (lesson 2.4).',
      'Matrices that keep the bottom row $(0, 0, 0, 1)$ are **affine**: they keep straight lines straight and parallel lines parallel, and send midpoints to midpoints. Every combination of moves, rotations and scales is affine. The projection matrix of chapter 3 is not, and its bottom row is what makes far things smaller.',
      'Normals are directions, so they take $w = 0$ and no move. Under a non-uniform scale they also need the inverse transpose of $A$, not $A$ itself, to stay at right angles to the surface: a sphere scaled to an ellipsoid with plain $A$ applied to its normals is lit as if still round. Chapter 3 returns to this.',
    ],
    callouts: [
      { type: 'insight', title: 'Bridge: from matrices to code', body: 'mul and apply in cell 3 are the definitions: row dotted with column, and the fourth column added because w = 1.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'M is the model matrix uniform; modelMatrix * vec4(position, 1.0) is apply(M, p) run on the GPU for every vertex.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'The Inspector\'s matrix is the object\'s M; Object › Trace the transform builds it from T, R and S and applies it vertex by vertex.' },
    ],
    visualizations: [],
  },

  examples: [
    {
      id: 'modelling-geometry-2-002-ex1',
      title: 'Scaling then moving the tip',
      difficulty: 'easy',
      problem: 'Scale the tip $(0, 1.5, 0)$ by $(1, 2, 1)$, then move it by $(2, 0, -1)$.',
      steps: [
        { expression: '(0, 1.5, 0) \\to (0, 3, 0)', annotation: 'Each coordinate times its factor.', strategyTitle: 'Step 1: Scale' },
        { expression: '(0, 3, 0) + (2, 0, -1) = (2, 3, -1)', annotation: 'Add the offset. (A rotation about y would leave a point on the y axis where it is.)', strategyTitle: 'Step 2: Move' },
      ],
      answer: '(2, 3, −1).',
    },
    {
      id: 'modelling-geometry-2-002-ex2',
      title: 'A quarter turn',
      difficulty: 'medium',
      problem: 'Where do the x axis and the point $(1, 0, 2)$ go under a 90° turn about y?',
      steps: [
        { expression: 'R_y(90°) = \\begin{pmatrix} 0 & 0 & 1 \\\\ 0 & 1 & 0 \\\\ -1 & 0 & 0 \\end{pmatrix}', annotation: 'cos 90° = 0, sin 90° = 1.', strategyTitle: 'Step 1: The matrix' },
        { expression: '(1, 0, 0) \\to (0, 0, -1),\\ (1, 0, 2) \\to (2, 0, -1)', annotation: 'First column for the axis; rows dotted with the point.', strategyTitle: 'Step 2: Apply' },
      ],
      answer: 'The x axis goes to (0, 0, −1); (1, 0, 2) goes to (2, 0, −1).',
    },
    {
      id: 'modelling-geometry-2-002-ex3',
      title: 'Reading a matrix',
      difficulty: 'hard',
      problem: 'An object\'s matrix has columns $(0, 0, -2)$, $(0, 2, 0)$, $(2, 0, 0)$ and $(5, 1, 0)$. What are its scale, rotation and position?',
      steps: [
        { expression: '|\\text{columns 1–3}| = 2', annotation: 'Each axis is twice as long: uniform scale 2.', strategyTitle: 'Step 1: Scale' },
        { expression: 'x \\to -z,\\ y \\to y,\\ z \\to x', annotation: 'The axes, divided by 2: a 90° turn about y.', strategyTitle: 'Step 2: Rotation' },
        { expression: 't = (5, 1, 0)', annotation: 'The fourth column.', strategyTitle: 'Step 3: Position' },
      ],
      answer: 'Scale 2, a 90° turn about y, at position (5, 1, 0).',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-2-002-ch1',
      title: 'The identity',
      difficulty: 'easy',
      problem: 'What does a model matrix with 1s down the diagonal and 0s everywhere else do?',
      hint: 'Multiply it by any (x, y, z, 1).',
      answer: 'Nothing: every vertex stays where it is. Position 0, no rotation, scale 1.',
      walkthrough: [],
    },
    {
      id: 'modelling-geometry-2-002-ch2',
      title: 'Why four numbers?',
      difficulty: 'medium',
      problem: 'Show that no 3×3 matrix can move every point by (2, 0, 0).',
      hint: 'Where does any 3×3 matrix send (0, 0, 0)?',
      answer: 'Any matrix times (0, 0, 0) is (0, 0, 0), but a move must send it to (2, 0, 0). So moving needs the fourth coordinate.',
      walkthrough: [],
    },
    {
      id: 'modelling-geometry-2-002-ch3',
      title: 'Moved normals',
      difficulty: 'hard',
      problem: 'A program applies the full model matrix, translation included, to its normals as if they were points. The object is at (10, 0, 0). What goes wrong?',
      hint: 'What should w be for a direction?',
      answer: 'Every normal has (10, 0, 0) added, so they all lean towards +x and the lighting is wrong. Normals are directions: use w = 0 (or only the 3×3 part).',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      { symbol: 'S', meaning: 'A scale matrix: the factors down the diagonal.' },
      { symbol: 'R', meaning: 'A rotation matrix: its columns are where the axes go.' },
      { symbol: 'T', meaning: 'A translation: the identity with the move in the fourth column.' },
      { symbol: '(x, y, z, 1)', meaning: 'A point in homogeneous coordinates; a direction has 0 for its fourth number.' },
      { symbol: 'M = T\\,R\\,S', meaning: 'The model matrix: scale, then rotate, then move.' },
      { symbol: '\\text{affine}', meaning: 'A transform with bottom row 0, 0, 0, 1: straight lines stay straight, parallels stay parallel.' },
    ],
    rulesOfThumb: [
      'The matrix nearest the vertex acts first: T·R·S scales first.',
      'The fourth column is the position.',
      'Points have w = 1, directions w = 0.',
      'Moving an object changes its matrix, never its vertex list.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'Moving an object changes its vertices.',
      whyStudentsThinkIt: 'On screen, the vertices are somewhere else.',
      correctionExample: 'The project\'s pyramid keeps the same 5 vertices; only its matrix changes.',
      contrastCase: 'Applying the transform (Blender\'s Ctrl+A) does rewrite the vertices, and resets the matrix to the identity.',
    },
    {
      falseBelief: 'T·R·S applies T first because it is written first.',
      whyStudentsThinkIt: 'We read left to right.',
      correctionExample: 'M·v = T·(R·(S·v)): S touches the vertex first.',
      contrastCase: 'Lesson 2.3 shows what goes wrong when the order is changed.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A forest needs a thousand copies of the same tree, each in a different place and size.',
      competingTechniques: ['One mesh and a thousand matrices', 'A thousand copies of the vertex list'],
      whyThisTechniqueWins: 'Each copy is 16 numbers instead of thousands of vertices, and the GPU can draw them in one call (instancing).',
    },
    {
      situation: 'You need an object\'s position, rotation and scale but only have its matrix.',
      competingTechniques: ['Read them off the columns', 'Guess from the picture'],
      whyThisTechniqueWins: 'The fourth column is the position, the column lengths are the scale, and the columns divided by their lengths are the rotation.',
    },
  ],

  debugging: [
    {
      commonError: 'Writing the translation in the bottom row instead of the fourth column.',
      symptom: 'Objects do not move, or move strangely when rotated; the fourth coordinate stops being 1.',
      whyItHappened: 'Row and column conventions got mixed up (some texts write vectors as rows).',
      repairStrategy: 'With column vectors, as here and in three.js and GLSL, the move goes in the fourth column and the bottom row is 0, 0, 0, 1.',
    },
    {
      commonError: 'Using degrees where radians are expected.',
      symptom: 'An object set to rotate 90° spins to some unrelated angle.',
      whyItHappened: 'Math.cos(90) is the cosine of 90 radians.',
      repairStrategy: 'Convert: radians = degrees × π / 180 (MeshLab\'s Inspector shows degrees; scripts use radians).',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Build T, R and S, multiply them into M, and apply M to vertices.',
    explainVerbally: 'Explain why a move needs a fourth coordinate, and why T·R·S scales first.',
    detectIncorrectApplication: 'Recognise a wrongly placed translation, a points-versus-directions mix-up, and degrees used as radians.',
    transferToUnfamiliar: 'Read position, rotation and scale off any model matrix.',
  },

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-2-002-assess-1',
        type: 'choice',
        text: 'In a model matrix (column vectors), the object\'s position is…',
        options: ['The fourth column', 'The bottom row', 'The diagonal', 'The first column'],
        answer: 'The fourth column',
        hint: 'It multiplies the vertex\'s 1.',
      },
    ],
  },

  quiz: [
    { id: 'modelling-geometry-2-002-quiz-1', type: 'choice', text: 'Scaling (0, 1.5, 0) by (1, 2, 1) gives…', options: ['(0, 3, 0)', '(1, 3.5, 1)', '(0, 0.75, 0)', '(0, 1.5, 0)'], answer: '(0, 3, 0)', hints: ['Multiply each coordinate by its factor.'], reviewSection: 'Intuition — scale' },
    { id: 'modelling-geometry-2-002-quiz-2', type: 'choice', text: 'A rotation about the y axis changes…', options: ['x and z', 'y only', 'all three', 'nothing'], answer: 'x and z', hints: ['The axis itself stays put.'], reviewSection: 'Intuition — rotate' },
    { id: 'modelling-geometry-2-002-quiz-3', type: 'choice', text: 'Why is a point written (x, y, z, 1)?', options: ['So a 4×4 matrix can move it', 'To store its colour', 'To normalise it', 'For the GPU\'s alignment'], answer: 'So a 4×4 matrix can move it', hints: ['The fourth column multiplies the 1.'], reviewSection: 'Intuition — homogeneous coordinates' },
    { id: 'modelling-geometry-2-002-quiz-4', type: 'choice', text: 'In M = T·R·S, which acts on the vertex first?', options: ['S', 'T', 'R', 'All at once'], answer: 'S', hints: ['The one nearest the vertex.'], reviewSection: 'Intuition — one matrix' },
    { id: 'modelling-geometry-2-002-quiz-5', type: 'choice', text: 'The first column of a rotation matrix is…', options: ['Where the x axis goes', 'The position', 'The scale', 'Always (1, 0, 0)'], answer: 'Where the x axis goes', hints: ['R times (1, 0, 0).'], reviewSection: 'Rigor — columns' },
    { id: 'modelling-geometry-2-002-quiz-6', type: 'choice', text: 'What does the vertex shader multiply each vertex by first?', options: ['The model matrix', 'The normal', 'The colour', 'The light direction'], answer: 'The model matrix', hints: ['modelMatrix * vec4(position, 1.0).'], reviewSection: 'Intuition — the graphics strand' },
  ],

  checkpoints: [
    { id: 'cp-modelling-geometry-2-002-1', label: 'Read scale, rotate and move as steps', type: 'read' },
    { id: 'cp-modelling-geometry-2-002-2', label: 'Read homogeneous coordinates and M = T·R·S', type: 'read' },
    { id: 'cp-modelling-geometry-2-002-3', label: 'Read the model matrix in the vertex shader', type: 'read' },
    { id: 'cp-modelling-geometry-2-002-4', label: 'Complete the write-the-matrix challenge in the notebook', type: 'lab' },
    { id: 'cp-modelling-geometry-2-002-5', label: 'Predict M and vertex 0 in MeshLab\'s trace, then trace a quarter turn', type: 'lab' },
    { id: 'cp-modelling-geometry-2-002-6', label: 'Work through the quarter-turn example', type: 'example' },
    { id: 'cp-modelling-geometry-2-002-7', label: 'Work through the reading-a-matrix example', type: 'example' },
    { id: 'cp-modelling-geometry-2-002-8', label: 'Attempt the moved-normals challenge', type: 'challenge' },
  ],
};
