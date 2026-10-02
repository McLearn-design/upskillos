// Lesson 2.4: the determinant (docs/modelling-course-plan.md). Four parts: the maths (area and volume scaling,
// the sign as a mirror), building it (2×2 and 3×3 determinants, the triple product and signed volume, what a
// mirror does to winding, and a graded "mirror and double" challenge), watching MeshLab do it (a traced
// determinant in Predict mode), and using the tool (negative scale, the determinant readout, flipping a baked
// mirror).
import { withPicture } from '../notebookScene.js';

const R4 = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)`;
const DET3 = `// The determinant of a 3×3 matrix (rows), expanded along the first row with signs + − +.
const det3 = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
                  - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
                  + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])`;
const M3 = `const mul = (A, B) => A.map((row) => B[0].map((_, j) => row.reduce((s, a, k) => s + a * B[k][j], 0)))
const times = (M, v) => M.map((row) => row.reduce((s, m, j) => s + m * v[j], 0))
const Ry = (a) => [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]]
const S = (x, y, z) => [[x, 0, 0], [0, y, 0], [0, 0, z]]`;

const AREA = `// A 2×2 matrix [[a, b], [c, d]] sends the unit square to a parallelogram of signed area ad − bc.
const det2 = ([[a, b], [c, d]]) => a * d - b * c
const cases = [
  ['stretch x by 2', [[2, 0], [0, 1]]],
  ['shear (slant)', [[1, 1], [0, 1]]],
  ['swap x and y (a mirror)', [[0, 1], [1, 0]]],
  ['squash onto a line', [[2, 4], [1, 2]]],
]
for (const [name, m] of cases) console.log(name + ': det ' + det2(m))`;

const VOLUME = `${R4}
${DET3}
${M3}

// The determinant is the factor every volume is multiplied by; its sign says whether there is a mirror.
const cases = [
  ['scale (2, 1, 0.5)', S(2, 1, 0.5)],
  ['turn 30° about y', Ry(Math.PI / 6)],
  ['mirror x', S(-1, 1, 1)],
  ['shear', [[1, 1, 0], [0, 1, 0], [0, 0, 1]]],
  ['turn, then stretch (2, 0.5, 0.5)', mul(S(2, 0.5, 0.5), Ry(Math.PI / 4))],
  ['stretch, then turn', mul(Ry(Math.PI / 4), S(2, 0.5, 0.5))],
]
for (const [name, m] of cases) console.log(name + ': det ' + r(det3(m)))`;

const SIGNED = `${R4}
${DET3}
${M3}

// The signed volume of a closed mesh: add up, for each triangle, the volume of the cone from the origin to it.
// Faces wound to point out give a positive total; inside out gives a negative one.
const box = []
for (let i = 0; i < 8; i++) box.push([i % 2 - 0.5, Math.floor(i / 2) % 2 - 0.5, Math.floor(i / 4) - 0.5])
const sides = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]]
function volume(verts, faces) {
  let v = 0
  for (const f of faces) for (let i = 1; i + 1 < f.length; i++) {
    const [a, b, c] = [verts[f[0]], verts[f[i]], verts[f[i + 1]]]
    v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6
  }
  return v
}
console.log('unit box: volume ' + r(volume(box, sides)))
for (const [name, M] of [['turned, then stretched', mul(S(2, 0.5, 0.5), Ry(Math.PI / 4))], ['mirrored and widened', S(-1.5, 1, 1)]]) {
  const moved = box.map((p) => times(M, p))
  console.log(name + ': volume ' + r(volume(moved, sides)) + ', det ' + r(det3(M)))
}`;

const MIRROR = `${R4}

// Mirror the pyramid left to right (x → −x) and keep its face lists: every face now winds the other way.
const P = [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], [0, 1.5, 0]]
const faces = [[0, 1, 2, 3], [1, 0, 4], [2, 1, 4], [3, 2, 4], [0, 3, 4]]
const mirrored = P.map(([x, y, z]) => [-x, y, z])
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
const pointsOut = (V, f) => { const c = f.map((k) => V[k]), n = cross(sub(c[1], c[0]), sub(c[2], c[0])), m = c.reduce((a, p) => a.map((x, i) => x + p[i] / c.length), [0, 0, 0]); return n[0] * m[0] + n[1] * (m[1] - 0.3) + n[2] * m[2] > 0 }
console.log('before: ' + faces.filter((f) => pointsOut(P, f)).length + ' of 5 faces point out')
console.log('mirrored: ' + faces.filter((f) => pointsOut(mirrored, f)).length + ' of 5 faces point out')
show({ verts: mirrored, faces })`;

const CHALLENGE = `// Choose a scale that mirrors the pyramid left to right (x), keeps its height, and doubles its volume.
// Red faces point inwards: a mirror reverses every face's winding, and nothing here turns them back.
const scale = [1, 1, 1]

${R4}
const P = [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], [0, 1.5, 0]]
const faces = [[0, 1, 2, 3], [1, 0, 4], [2, 1, 4], [3, 2, 4], [0, 3, 4]]
const det = scale[0] * scale[1] * scale[2]
console.log('det = ' + r(det) + ': volume × ' + r(Math.abs(det)) + (det < 0 ? ', mirrored' : ''))
show({ verts: P.map((p) => p.map((x, i) => x * scale[i])), faces })`;

const SOLVED = CHALLENGE.replace('const scale = [1, 1, 1]', 'const scale = [-2, 1, 1]');

/** The challenge's check: read the scale and say what it does to height, mirroring and volume. */
export function checkScale(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+scale\s*=\s*\[([^\]]*)\]/);
  const s = m ? m[1].split(',').map((x) => Number(x.trim())) : [];
  if (s.length !== 3 || s.some((x) => !Number.isFinite(x))) return no('Keep the line const scale = [x, y, z], with three numbers.');
  const [x, y, z] = s, det = x * y * z;
  if (y !== 1) return no(`The y scale is ${y}: that changes the pyramid's height. Keep it 1.`);
  if (det === 0) return no('A scale of 0 squashes the pyramid flat: det = 0, no volume at all.');
  if (x > 0 && z > 0) return no(`det = ${+det.toFixed(4)}, which is positive: nothing is mirrored. A mirror needs a negative scale along the axis it flips.`);
  if (x < 0 && z < 0) return no(`Both x and z are negative, so det = ${+det.toFixed(4)} is positive: two mirrors make a half turn about y, not a mirror.`);
  if (z < 0) return no('z is negative: that mirrors the pyramid front to back, not left to right.');
  if (Math.abs(Math.abs(det) - 2) > 1e-9) return no(`det = ${+det.toFixed(4)}: mirrored left to right, but the volume is multiplied by ${+Math.abs(det).toFixed(4)}, not 2.`);
  return { pass: true, message: `det = ${+det.toFixed(4)}: mirrored (negative), twice the volume (|det| = 2), the same height. Its faces are red because the mirror reversed their winding.` };
}

export default {
  id: 'modelling-geometry-2-004',
  slug: 'the-determinant',
  chapter: 'modelling-geometry-2',
  order: 4,
  title: 'The Determinant',
  subtitle: 'One number from a matrix: how much it scales volume, and whether it mirrors.',
  tags: ['matrices', 'determinant', 'volume', 'mirror', 'winding'],
  aliases: 'determinant volume scale factor negative determinant mirror reflection handedness winding triple product signed volume negative scale flip normals meshlab',
  timeToComplete: 45,
  coreConcept: 'The determinant of a transform\'s 3×3 part is the factor by which it multiplies every volume. Its sign says whether it mirrors: a negative determinant swaps handedness, so every face winds the other way on screen and a mesh with the mirror baked into its vertices is inside out until its faces are flipped.',
  prerequisites: ['modelling-geometry-2-003'],
  nextLesson: null,

  hook: {
    question: 'Scale a box by (2, 1, 0.5): it is twice as long and half as deep. Has its volume changed? And what happens when a scale is negative: why does a mirrored model sometimes render inside out?',
    realWorldContext: 'Modellers mirror halves of characters, cars and buildings every day. Engines, exporters and tools all check the determinant to know when a mirror has reversed the winding, and a forgotten check is the classic cause of models that look dark or hollow after an import.',
  },

  intuition: {
    prose: [
      'Every matrix stretches space somehow. The unit square, under the 2×2 matrix $\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$, becomes a parallelogram of area $ad - bc$: the **determinant**. Stretch $x$ by 2: area 2. Slant it (a shear): the area stays 1, because a slanted parallelogram has the same base and height. Squash everything onto a line: area 0.',
      'In 3D the determinant of the 3×3 part is the factor every volume is multiplied by. A scale by $(2, 1, 0.5)$ has determinant $2 \\times 1 \\times 0.5 = 1$: twice as long and half as deep, so the volume is unchanged. A rotation has determinant 1: turning keeps volume. The turned-then-stretched box from lesson 2.3 has determinant $2 \\times 0.5 \\times 0.5 = 0.5$, the same as stretched-then-turned: the order changed the shape, not the volume.',
      'Before reading on, predict: what is the determinant of a scale by $(-1, 1, 1)$? It is $-1$. The volume is unchanged ($|{-1}| = 1$), but the sign is negative: the object is **mirrored**. A right hand becomes a left hand; no turning can undo that.',
      'A mirror reverses the order of every face\'s corners as seen from outside. The pyramid\'s faces, mirrored left to right with their face lists unchanged, all go clockwise seen from outside, so by the right-hand rule (lesson 1.2) every normal now points in. The signed volume, which adds up the faces, comes out negative.',
      'Renderers know this. When an object\'s world matrix has a negative determinant, three.js (and so MeshLab) swaps which winding counts as the front, so a mirrored object still draws correctly. But if the mirror is **baked** into the vertices, the matrix is the identity again and nothing compensates: the model is inside out until its faces are flipped.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: The determinant of a 3×3 matrix',
        body: 'Step 1. Take the first row $a, b, c$.\nStep 2. For each, cross out its row and column and take the 2×2 determinant of what is left ($pt - qs$).\nStep 3. $\\det = a \\cdot (\\ldots) - b \\cdot (\\ldots) + c \\cdot (\\ldots)$: signs + − +.\nStep 4. Check: column 1 · (column 2 × column 3) gives the same number.\nStep 5. Read it: $|\\det|$ is the volume factor; negative means mirrored; 0 means flattened.',
      },
      {
        type: 'warning',
        title: 'Baking a mirror flips the faces',
        body: 'Applying a negative scale to the vertices (in a script, or with Apply transform in many tools) leaves every face wound backwards. The model goes dark or hollow. Flip its normals afterwards, or let the tool do it if it offers to.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: mirroring and culling',
        body: 'The GPU decides which side of a triangle faces the camera from its winding on screen (lesson 1.2). A matrix with a negative determinant reverses that winding, so with back-face culling on, a mirrored object shows its insides. three.js checks the determinant of each object\'s world matrix and flips the front-face setting for it; engines that do not need the same check, or the mesh\'s winding reversed.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: the determinant',
        props: {
          lesson: {
            title: 'The determinant',
            subtitle: 'Areas, volumes and signs from matrices; the signed volume of a mesh; what a mirror does to winding; and a mirror with twice the volume.',
            cells: [
              { type: 'js', instruction: '### 1. Area in 2D\nStretch, slant, mirror and squash the unit square: the determinant is the signed area it becomes.', startCode: AREA },
              { type: 'js', instruction: '### 2. Volume in 3D\nScale, turn, mirror, shear, and the two orders from lesson 2.3: each determinant is a volume factor, and only the mirror is negative.', startCode: VOLUME },
              { type: 'js', instruction: '### 3. Signed volume of a mesh\nAdd up a cone from the origin to every triangle. A transformed unit box measures exactly its matrix\'s determinant, sign included.', startCode: SIGNED },
              { type: 'js', instruction: '### 4. What a mirror does to faces\nMirror the pyramid and keep its face lists: every face now points in (red). Drag the picture to turn it.', startCode: withPicture(MIRROR), showPreviewByDefault: true, outputHeight: 340 },
              { type: 'challenge', instruction: '### 5. Challenge: mirror and double\nChoose a scale that mirrors the pyramid left to right, keeps its height and doubles its volume. The check works out the determinant of your scale and says what it does.', startCode: withPicture(CHALLENGE), solutionCode: withPicture(SOLVED), check: checkScale, showPreviewByDefault: true, outputHeight: 340 },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "The determinant" in MeshLab](#/lab/mesh-lab?project=the-determinant). It makes a box scaled (2, 1, 0.5), a box scaled (−1.5, 1, 1), and the pyramid with its mirror baked into the vertices. It works out the mirrored box\'s determinant with **Record traces** on. The Algorithm trace is in **Predict** mode: predict the determinant (−1.5), then the signed volume the unit box fills in the world. Then turn the baked pyramid right side out yourself.' },
              { type: 'markdown', instruction: '### Use the tool\n- Type a negative number into a Scale field to mirror an object; the Inspector\'s World matrix line gives its determinant, and says when it is mirrored.\n- **Object › Determinant of the matrix** traces the working.\n- The MESH section\'s Volume reads negative ("inside out!") for a mesh whose faces point in; **Mesh › Flip normals** on all its faces fixes it.\n- In a script: object.determinant().\n- **In Blender:** a negative scale mirrors an object, and its Mirror modifier mirrors half a model. After applying a negative scale, check the normals with the Face Orientation overlay.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '$\\det \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} = ad - bc$. For 3×3, along the first row: $\\det A = a_{11}(a_{22}a_{33} - a_{23}a_{32}) - a_{12}(a_{21}a_{33} - a_{23}a_{31}) + a_{13}(a_{21}a_{32} - a_{22}a_{31})$.',
      'With columns $c_1, c_2, c_3$: $\\det A = c_1 \\cdot (c_2 \\times c_3)$, the signed volume of the box the columns span. The unit cube\'s edges are the axes, which $A$ sends to its columns, so the unit cube becomes that box.',
      '$\\det(A\\,B) = \\det A \\cdot \\det B$. So $\\det(T\\,R\\,S) = 1 \\cdot 1 \\cdot s_x s_y s_z$ (a translation does not change volume; a rotation has determinant 1), and $R\\,S$ and $S\\,R$ have the same determinant though they are different matrices.',
      'The signed volume of a closed mesh is $V = \\frac{1}{6} \\sum_{\\text{triangles}} p_0 \\cdot (p_1 \\times p_2)$. Transforming every vertex by $A$ multiplies each term, and so $V$, by $\\det A$.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Why a negative determinant cannot be turned away: rotations have determinant $+1$, and $\\det(R\\,M) = \\det M$, so turning never changes the sign. Mirrored and unmirrored objects are separated: no smooth path of transforms with nonzero determinant connects a determinant of $-1$ to one of $+1$.',
      'Why the triple product gives the signed volume: $c_2 \\times c_3$ is at right angles to the face spanned by $c_2$ and $c_3$, with length equal to its area (lesson 2.1); dotting with $c_1$ multiplies that area by the height of $c_1$ above it, signed by which side $c_1$ is on.',
      'Determinant 0 means the columns lie in one plane: some direction is squashed to nothing, and the matrix has no inverse. A scale of 0 along an axis does this; so does projecting onto a plane (chapter 3\'s shadows).',
      'Why mirroring reverses winding: a face\'s normal by the right-hand rule is a cross product of its edges. Under a linear map with $\\det A < 0$, the cross product of the images points opposite to the image of the cross product (more precisely, $Au \\times Av = \\det(A)\\,A^{-\\mathsf{T}}(u \\times v)$), so the right-hand rule now gives the inward side. That formula is also why normals transform with the inverse transpose.',
    ],
    callouts: [
      { type: 'insight', title: 'Bridge: from formula to code', body: 'det3 in the notebook is the first-row expansion; the trace in MeshLab prints each of its three terms.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'A negative det means reversed screen winding; three.js flips the front face for that object, so culling still removes the right side.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'The Inspector\'s World matrix line and Object › Determinant of the matrix show the same number; the MESH section\'s negative volume is a mirror baked into the vertices.' },
    ],
    visualizations: [],
  },

  examples: [
    {
      id: 'modelling-geometry-2-004-ex1',
      title: 'A diagonal matrix',
      difficulty: 'easy',
      problem: 'What is the determinant of a scale by (2, 1, 0.5), and what happens to a box of volume 6 under it?',
      steps: [
        { expression: '\\det = 2 \\times 1 \\times 0.5 = 1', annotation: 'For a diagonal matrix, the product of the diagonal.', strategyTitle: 'Step 1: Determinant' },
        { expression: '6 \\times 1 = 6', annotation: 'Volumes are multiplied by det.', strategyTitle: 'Step 2: Volume' },
      ],
      answer: 'det = 1, so the volume stays 6.',
    },
    {
      id: 'modelling-geometry-2-004-ex2',
      title: 'Expanding a 3×3',
      difficulty: 'medium',
      problem: 'Find the determinant of the shear $\\begin{pmatrix} 1 & 1 & 0 \\\\ 0 & 1 & 0 \\\\ 0 & 0 & 1 \\end{pmatrix}$.',
      steps: [
        { expression: '1 \\cdot (1 \\cdot 1 - 0) - 1 \\cdot (0 \\cdot 1 - 0) + 0 = 1', annotation: 'Along the first row, signs + − +.', strategyTitle: 'Step 1: Expand' },
      ],
      answer: '1: a shear slants but keeps volume.',
    },
    {
      id: 'modelling-geometry-2-004-ex3',
      title: 'A mirror baked in',
      difficulty: 'hard',
      problem: 'The pyramid (volume 2) is mirrored by scaling its vertices by (−1, 1, 1), face lists unchanged. What is its signed volume, and how do you fix it?',
      steps: [
        { expression: 'V\' = \\det \\cdot V = -1 \\times 2 = -2', annotation: 'The signed volume scales by the determinant.', strategyTitle: 'Step 1: Volume' },
        { expression: '\\text{reverse every face\'s corners}', annotation: 'Flipping all faces turns the normals out again, and the volume back to +2.', strategyTitle: 'Step 2: Fix' },
      ],
      answer: '−2 (inside out); flip all its normals to get +2.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-2-004-ch1',
      title: 'Turning keeps volume',
      difficulty: 'easy',
      problem: 'What is the determinant of any rotation, and what does it say?',
      hint: 'Does turning change volume or handedness?',
      answer: '1: volume is unchanged and nothing is mirrored.',
      walkthrough: [],
    },
    {
      id: 'modelling-geometry-2-004-ch2',
      title: 'Two mirrors',
      difficulty: 'medium',
      problem: 'Scale by (−1, 1, −1). Is the object mirrored?',
      hint: 'Multiply the diagonal.',
      answer: 'No: det = +1. Two mirrors make a half turn about y.',
      walkthrough: [],
    },
    {
      id: 'modelling-geometry-2-004-ch3',
      title: 'A flat matrix',
      difficulty: 'hard',
      problem: 'A matrix\'s columns are (1, 0, 0), (0, 1, 0) and (1, 1, 0). What is its determinant, and what does it do to a box?',
      hint: 'Do the columns lie in one plane?',
      answer: '0: all three columns lie in the plane z = 0, so every box is squashed flat. The matrix cannot be undone.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      { symbol: '\\det A', meaning: 'The determinant: the volume factor of A, signed.' },
      { symbol: 'ad - bc', meaning: 'The 2×2 determinant: the signed area of the parallelogram.' },
      { symbol: 'c_1 \\cdot (c_2 \\times c_3)', meaning: 'The triple product: the same number as det, from the columns.' },
      { symbol: '\\det < 0', meaning: 'A mirror: handedness swapped, winding reversed.' },
      { symbol: '\\det = 0', meaning: 'Flattened: some direction squashed to nothing; no inverse.' },
      { symbol: '\\det(A\\,B) = \\det A \\det B', meaning: 'Determinants multiply, so order never changes them.' },
    ],
    rulesOfThumb: [
      'Diagonal (scale) matrix: det is the product of the scales.',
      'Rotation: 1. Mirror: −1. Shear: 1.',
      'Negative det: check the winding.',
      'A mirror baked into vertices needs its faces flipped.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'Any stretch changes the volume.',
      whyStudentsThinkIt: 'The shape clearly changes.',
      correctionExample: 'Scale (2, 1, 0.5): twice as long, half as deep, det 1, the same volume.',
      contrastCase: 'Scale (2, 1, 1) does double the volume: det 2.',
    },
    {
      falseBelief: 'A mirrored object can be turned back to the original.',
      whyStudentsThinkIt: 'It looks like it might just be facing the other way.',
      correctionExample: 'det −1 stays −1 under any rotation: a left hand never turns into a right hand.',
      contrastCase: 'Two mirrors together are a rotation (det +1).',
    },
  ],

  transferPrompts: [
    {
      situation: 'An imported model renders hollow: you see the inside of the far wall.',
      competingTechniques: ['Check the determinant and the signed volume, then flip the faces', 'Turn off back-face culling'],
      whyThisTechniqueWins: 'A negative determinant or negative volume names the cause; turning off culling hides it and still lights the faces wrongly.',
    },
    {
      situation: 'You need to know if a simulation step crushed some cells of a mesh flat.',
      competingTechniques: ['Check each cell\'s determinant for values near 0 or below', 'Look at the render'],
      whyThisTechniqueWins: 'A determinant at or below 0 is exactly "flattened or inverted", and it can be checked for every cell automatically.',
    },
  ],

  debugging: [
    {
      commonError: 'Getting the signs of the expansion wrong (+ + + instead of + − +).',
      symptom: 'Determinants that do not match the product of scales for a diagonal matrix, or a nonzero det for flat columns.',
      whyItHappened: 'The middle term of the first-row expansion is subtracted.',
      repairStrategy: 'Check with diag(2, 3, 4) (det 24) and a matrix with two equal columns (det 0).',
    },
    {
      commonError: 'Baking a negative scale without flipping faces.',
      symptom: 'The model is dark, culled, or its volume is negative.',
      whyItHappened: 'The mirror reversed every face\'s winding.',
      repairStrategy: 'Flip all normals after baking, or check det < 0 in the export code and reverse each face.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Compute 2×2 and 3×3 determinants and the signed volume of a mesh.',
    explainVerbally: 'Explain why det is a volume factor, and why a negative det reverses winding.',
    detectIncorrectApplication: 'Recognise sign errors in the expansion, and a baked mirror from its symptoms.',
    transferToUnfamiliar: 'Use the determinant to detect mirrors, flattening and crushed cells in new settings.',
  },

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-2-004-assess-1',
        type: 'choice',
        text: 'A scale of (−1.5, 1, 1) has determinant…',
        options: ['−1.5', '1.5', '−1', '0'],
        answer: '−1.5',
        hint: 'Multiply the diagonal.',
      },
    ],
  },

  quiz: [
    { id: 'modelling-geometry-2-004-quiz-1', type: 'choice', text: 'det of [[2, 0], [0, 1]] is…', options: ['2', '1', '3', '0'], answer: '2', hints: ['ad − bc.'], reviewSection: 'Intuition — area' },
    { id: 'modelling-geometry-2-004-quiz-2', type: 'choice', text: 'A shear [[1, 1], [0, 1]] has determinant…', options: ['1', '2', '0', '−1'], answer: '1', hints: ['Same base, same height.'], reviewSection: 'Intuition — area' },
    { id: 'modelling-geometry-2-004-quiz-3', type: 'choice', text: 'Scale (2, 1, 0.5) changes the volume by a factor of…', options: ['1', '3.5', '2', '0.5'], answer: '1', hints: ['2 × 1 × 0.5.'], reviewSection: 'Examples — a diagonal matrix' },
    { id: 'modelling-geometry-2-004-quiz-4', type: 'choice', text: 'A negative determinant means…', options: ['The transform mirrors', 'The volume shrinks', 'The object moved', 'The matrix is wrong'], answer: 'The transform mirrors', hints: ['Handedness swaps.'], reviewSection: 'Intuition — the sign' },
    { id: 'modelling-geometry-2-004-quiz-5', type: 'choice', text: 'R·S and S·R (lesson 2.3) have determinants that are…', options: ['Equal', 'Opposite in sign', 'Different', 'Both zero'], answer: 'Equal', hints: ['det(AB) = det A det B.'], reviewSection: 'Math — products' },
    { id: 'modelling-geometry-2-004-quiz-6', type: 'choice', text: 'Why does three.js still draw a mirrored object correctly?', options: ['It flips the front-face winding when det < 0', 'It ignores negative scales', 'It recomputes the normals every frame', 'It turns off culling'], answer: 'It flips the front-face winding when det < 0', hints: ['It checks the world matrix\'s determinant.'], reviewSection: 'Intuition — the graphics strand' },
  ],

  checkpoints: [
    { id: 'cp-modelling-geometry-2-004-1', label: 'Read the determinant as area and volume', type: 'read' },
    { id: 'cp-modelling-geometry-2-004-2', label: 'Read why a negative determinant mirrors and reverses winding', type: 'read' },
    { id: 'cp-modelling-geometry-2-004-3', label: 'Read how renderers handle mirrored objects', type: 'read' },
    { id: 'cp-modelling-geometry-2-004-4', label: 'Complete the mirror-and-double challenge', type: 'lab' },
    { id: 'cp-modelling-geometry-2-004-5', label: 'Predict the determinant and world volume in MeshLab\'s trace, then fix the baked mirror', type: 'lab' },
    { id: 'cp-modelling-geometry-2-004-6', label: 'Work through the expanding-a-3×3 example', type: 'example' },
    { id: 'cp-modelling-geometry-2-004-7', label: 'Work through the baked-mirror example', type: 'example' },
    { id: 'cp-modelling-geometry-2-004-8', label: 'Attempt the flat-matrix challenge', type: 'challenge' },
  ],
};
