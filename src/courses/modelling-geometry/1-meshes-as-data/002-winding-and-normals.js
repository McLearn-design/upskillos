// Lesson 1.2: winding and normals (docs/modelling-course-plan.md). Four parts: the maths (the cross product and
// the right-hand rule), building it (a notebook with a graded face-list fix), watching MeshLab do it (a traced
// Flip normals in Predict mode), and using the tool (Normals overlay, Mesh › Flip normals, a challenge).
import { withPicture } from '../notebookScene.js';
import { readFaces } from '../faceList.js';

const PYRAMID = `const vertices = [
  [-1, 0, -1],   // vertex 0
  [ 1, 0, -1],   // vertex 1
  [ 1, 0,  1],   // vertex 2
  [-1, 0,  1],   // vertex 3
  [ 0, 1.5, 0],  // vertex 4: the tip
]`;

/** The pyramid's faces as they should be: every one anticlockwise seen from outside. */
const RIGHT = [[0, 1, 2, 3], [1, 0, 4], [2, 1, 4], [3, 2, 4], [0, 3, 4]];
const VERTS = [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], [0, 1.5, 0]];

/** Newell's normal of a face of VERTS (not normalised). */
function newell(f) {
  const n = [0, 0, 0];
  f.forEach((k, i) => {
    const p = VERTS[k], q = VERTS[f[(i + 1) % f.length]];
    n[0] += (p[1] - q[1]) * (p[2] + q[2]); n[1] += (p[2] - q[2]) * (p[0] + q[0]); n[2] += (p[0] - q[0]) * (p[1] + q[1]);
  });
  return n;
}

/** Whether two lists are the same corners round the same cycle, in either direction. */
function sameCycle(a, b) {
  if (a.length !== b.length || !a.every((v) => b.includes(v))) return false;
  const turns = (x, y) => x.some((_, s) => x.every((v, i) => v === y[(i + s) % y.length]));
  return turns(a, b) || turns(a, [...b].reverse());
}

/**
 * The challenge's check: read the face list from the code (without running it) and say what is wrong, naming the
 * face, but not how to fix it.
 */
export function checkWinding(code) {
  const no = (message) => ({ pass: false, message });
  const { faces, error } = readFaces(code);
  if (error) return no(error);
  if (faces.length !== 5) return no(`The pyramid has 5 faces; the list has ${faces.length} entries.`);
  for (const [i, f] of faces.entries()) {
    if (!sameCycle(f, RIGHT[i])) return no(`Face ${i} now has different corners (or a different order round its edge): change only which way round each face goes.`);
  }
  const centre = [0, 0.3, 0];
  const inward = faces.flatMap((f, i) => {
    const n = newell(f), c = f.reduce((a, k) => a.map((x, j) => x + VERTS[k][j] / f.length), [0, 0, 0]);
    return n[0] * (c[0] - centre[0]) + n[1] * (c[1] - centre[1]) + n[2] * (c[2] - centre[2]) < 0 ? [i] : [];
  });
  if (inward.length) return no(`Face${inward.length > 1 ? 's' : ''} ${inward.join(' and ')} still point${inward.length > 1 ? '' : 's'} into the pyramid: going round ${inward.length > 1 ? 'their' : 'its'} corners in order, the right-hand rule points inwards.`);
  return { pass: true, message: 'Every face goes anticlockwise seen from outside, so every normal points out.' };
}

const CROSS = `// The cross product of two edges of a triangle, by the formula.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

const A = [0, 0, 0], B = [2, 0, 0], C = [0, 1, 0]
console.log('A, B, C:', cross(sub(B, A), sub(C, A)).join(', '))   // along +z
console.log('A, C, B:', cross(sub(C, A), sub(B, A)).join(', '))   // the other way round: along -z`;

const NEWELL = `// Newell's method: the normal of a face with any number of corners, from the corners in order.
function newell(points) {
  const n = [0, 0, 0]
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length]   // the next corner, wrapping round to the first
    n[0] += (p[1] - q[1]) * (p[2] + q[2])
    n[1] += (p[2] - q[2]) * (p[0] + q[0])
    n[2] += (p[0] - q[0]) * (p[1] + q[1])
  })
  return n
}
const unit = (v) => v.map((x) => +(x / Math.hypot(...v)).toFixed(3))

${PYRAMID}
const faces = [[0, 1, 2, 3], [1, 0, 4], [2, 1, 4], [3, 2, 4], [0, 3, 4]]
faces.forEach((f, i) => console.log('face', i, 'normal', unit(newell(f.map((k) => vertices[k]))).join(', ')))
show({ verts: vertices, faces })`;

const BENT = `// A quad with one corner lifted 0.4: it is no longer flat. Which normal does it have?
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (v) => v.map((x) => +(x / Math.hypot(...v)).toFixed(3))
function newell(points) {
  const n = [0, 0, 0]
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length]
    n[0] += (p[1] - q[1]) * (p[2] + q[2]); n[1] += (p[2] - q[2]) * (p[0] + q[0]); n[2] += (p[0] - q[0]) * (p[1] + q[1])
  })
  return n
}
const Q = [[0, 0, 0], [1, 0, 0], [1, 1, 0.4], [0, 1, 0]]
console.log('first three corners:', unit(cross(sub(Q[1], Q[0]), sub(Q[2], Q[0]))).join(', '))
console.log('last three corners: ', unit(cross(sub(Q[2], Q[0]), sub(Q[3], Q[0]))).join(', '))
console.log('Newell, all four:   ', unit(newell(Q)).join(', '))`;

const CHALLENGE = `// Two sides of this pyramid are listed the wrong way round, so their normals point in (red).
// Fix the face list so every face goes anticlockwise seen from outside, and every normal points out.
${PYRAMID}
const faces = [
  [0, 1, 2, 3],
  [1, 0, 4],
  [1, 2, 4],
  [3, 4, 2],
  [0, 3, 4],
]
show({ verts: vertices, faces })`;

export default {
  id: 'modelling-geometry-1-002',
  slug: 'winding-and-normals',
  chapter: 'modelling-geometry-1',
  order: 2,
  title: 'Winding and Normals',
  subtitle: 'Which way a face points is decided by the order of its corners.',
  tags: ['meshes', 'normals', 'cross product', 'winding', 'graphics'],
  aliases: 'winding order face normal cross product right hand rule newell back face culling flip normals meshlab',
  timeToComplete: 40,
  coreConcept: 'A face\'s normal is the cross product of its edges taken in the order its corners are listed (the right-hand rule), so the order, the winding, decides which way the face points; reversing it flips the normal.',
  prerequisites: ['modelling-geometry-1-001'],
  nextLesson: null,

  hook: {
    question: 'A face is a list of corners, such as [1, 0, 4]. Nothing in that list says which side of the face is the outside. So how does a renderer know which way the face points, and why does one wrong list make a face go dark?',
    realWorldContext: 'Every 3D file, game engine and GPU decides the outside of a face from the order of its corners. Get it wrong and faces render black, vanish from one side, or make a model look inside out. "Recalculate normals" is one of the first fixes every modeller learns.',
  },

  intuition: {
    prose: [
      'Take a triangle with corners $A = (0, 0, 0)$, $B = (2, 0, 0)$ and $C = (0, 1, 0)$. Its edges from $A$ are $B - A = (2, 0, 0)$ and $C - A = (0, 1, 0)$. Their **cross product** is a third vector at right angles to both: $(0, 0, 2)$, pointing along $+z$, straight up off the triangle.',
      'Before reading on, predict: list the same corners as $A, C, B$. What does the cross product of the edges give now? It is $(0, 0, -2)$: the same line, the other direction. Same triangle, same three points; only the order changed, and the face now points the other way.',
      'That order is the face\'s **winding**. The rule that links it to a direction is the **right-hand rule**: curl the fingers of your right hand round the corners in order, and your thumb points along the normal. Seen from the side the thumb points to, the corners go anticlockwise.',
      'The **normal** is that direction made length 1: divide by its length. For the triangle, $(0, 0, 2)$ has length 2, so the normal is $(0, 0, 1)$. The length 2 is not wasted: it is twice the triangle\'s area (here the area is 1).',
      'A face with more corners uses all of them. **Newell\'s method** adds up, round the face, a cross-product term for every edge; for a flat face it gives the same normal as any two edges, and for a bent face it gives the best compromise. MeshLab and Blender both use it.',
      'So a closed model is consistent when every face is listed anticlockwise seen from outside: every normal points out. One face listed the other way points in, and the renderer treats its inside as its front.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Find which way a face points',
        body: 'Step 1. Take the face\'s corners in the order they are listed.\nStep 2. For a triangle, form two edges from the first corner: $B - A$ and $C - A$. For more corners, use Newell\'s sum over every edge.\nStep 3. Take the cross product: $(a_y b_z - a_z b_y,\\ a_z b_x - a_x b_z,\\ a_x b_y - a_y b_x)$.\nStep 4. Divide by its length for the unit normal; half the length is the triangle\'s area.\nStep 5. Check against the right-hand rule: seen from where the normal points, the corners go anticlockwise.',
      },
      {
        type: 'warning',
        title: 'Reversing the order flips the face',
        body: 'Writing a face as [1, 2, 4] instead of [2, 1, 4] uses the same three corners but turns its normal round. On screen the face shades dark (light seems to come from behind it), or disappears when the renderer skips faces that point away (back-face culling).',
      },
      {
        type: 'insight',
        title: 'The graphics strand: what the GPU does with winding',
        body: 'The GPU receives triangles as three corner indices. After projecting them to the screen it checks their winding there: anticlockwise means facing the camera (by OpenGL\'s and three.js\'s convention). With back-face culling on, clockwise triangles are never drawn, which is why a wrongly wound face can vanish. Lighting uses the normal: brightness goes with $\\mathbf{n} \\cdot \\mathbf{l}$, which is negative for a normal pointing into the model.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: normals from corners',
        props: {
          lesson: {
            title: 'Winding and normals, by hand',
            subtitle: 'Compute normals from corner orders, see them drawn, and fix a face list.',
            cells: [
              { type: 'js', instruction: '### 1. The cross product\nRun it. The same three corners in two orders give opposite vectors: (0, 0, 2) and (0, 0, −2).', startCode: CROSS },
              { type: 'js', instruction: '### 2. Newell\'s method, and the pyramid\'s normals\nThis is the pyramid from lesson 1.1, with every face anticlockwise seen from outside. The base\'s normal is (0, −1, 0), down and out; each side leans out and up. Blue faces point away from the centre. Drag the picture to turn it.', startCode: withPicture(NEWELL), showPreviewByDefault: true, outputHeight: 340 },
              { type: 'js', instruction: '### 3. A face that is not flat\nLift one corner of a square. Two edges give different answers depending on which three corners you pick; Newell\'s sum of all four lies between them.', startCode: BENT },
              { type: 'challenge', instruction: '### 4. Challenge: turn the faces outwards\nTwo sides are listed the wrong way round and show red. Change only the order of their corners until every face is blue and every normal points out. The check reads your list and names any face still pointing in.', startCode: withPicture(CHALLENGE), solutionCode: withPicture(CHALLENGE.replace('[1, 2, 4],', '[2, 1, 4],').replace('[3, 4, 2],', '[3, 2, 4],')), check: checkWinding, showPreviewByDefault: true, outputHeight: 340 },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Winding and normals" in MeshLab](#/lab/mesh-lab?project=winding-and-normals). It builds the same pyramid with faces 2 and 3 wrong, and turns face 2 round with **Record traces** on. The Algorithm trace is in **Predict** mode: before it shows the flipped face, it gives you the old normal and the new corner order and asks for the new normal. Your notebook printed face 2\'s correct normal, (0.832, 0.555, 0); MeshLab\'s trace starts from the wrong one, (−0.832, −0.555, 0), and asks you to reverse it.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Normals** in MeshLab\'s toolbar draws a short line along every face\'s normal; one pointing inwards is a face wound the wrong way.\n- In edit mode (**Tab**), press **3** for face select, click the bad face, then **Mesh › Flip normals**: it reverses the corner order, and GUI → code shows `scene.get("Pyramid").mesh.flip([3])`.\n- **In Blender:** Viewport Overlays › Face Orientation colours outward faces blue and inward faces red. **Mesh › Normals › Flip** reverses the selection; **Recalculate Outside** (Shift+N) makes a closed mesh consistent all at once.\n- Practise on a box with two inward faces: [MeshLab challenge: Turn the faces outwards](#/lab/mesh-lab?challenge=fix-the-normals).' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      'The cross product of $\\mathbf{a} = (a_x, a_y, a_z)$ and $\\mathbf{b} = (b_x, b_y, b_z)$ is $\\mathbf{a} \\times \\mathbf{b} = (a_y b_z - a_z b_y,\\ a_z b_x - a_x b_z,\\ a_x b_y - a_y b_x)$. For $\\mathbf{a} = (2, 0, 0)$ and $\\mathbf{b} = (0, 1, 0)$: $(0 \\cdot 0 - 0 \\cdot 1,\\ 0 \\cdot 0 - 2 \\cdot 0,\\ 2 \\cdot 1 - 0 \\cdot 0) = (0, 0, 2)$.',
      'Swapping the two vectors swaps every pair of products in each component, so $\\mathbf{b} \\times \\mathbf{a} = -(\\mathbf{a} \\times \\mathbf{b})$: the cross product is anticommutative. Listing a triangle as $A, C, B$ instead of $A, B, C$ swaps its two edges, which is exactly why the normal turns round.',
      'Its length is $|\\mathbf{a}||\\mathbf{b}|\\sin\\theta$, the area of the parallelogram the two edges span; the triangle is half of it. So the triangle $A, B, C$ has area $\\tfrac{1}{2}|(0, 0, 2)| = 1$, and the unit normal is $\\mathbf{n} = (\\mathbf{a} \\times \\mathbf{b}) / |\\mathbf{a} \\times \\mathbf{b}|$.',
      'Newell\'s method for corners $p_0, \\ldots, p_{k-1}$ sums, for each edge from $p_i$ to $p_{i+1}$ (wrapping round), $n_x \\mathrel{+}= (y_i - y_{i+1})(z_i + z_{i+1})$, and the same with the coordinates turned round for $n_y$ and $n_z$. Each component is twice the area of the face\'s shadow on a coordinate plane. For the pyramid\'s base it gives $(0, -8, 0)$: twice its area of 4, pointing down.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Formally, a face\'s winding is an orientation of its boundary cycle, and a mesh is consistently oriented when every interior edge is traversed in opposite directions by its two faces. A connected closed surface is orientable exactly when such a choice exists; the Möbius strip is the classic surface where it does not.',
      'What does not change when a face is flipped: its corners, its plane, its area and its shape. Only the sign of the normal and the direction its boundary is walked change, which is why flipping is undoable and costs nothing but a reversed list.',
      'Geometrically, the cross product is the oriented area of the parallelogram on two edges, and Newell\'s sum is the oriented area of the polygon projected on each axis plane. For a closed, consistently outward mesh these oriented areas give its volume by the divergence theorem: positive when the normals point out, negative when every face is turned in.',
      'Later lessons depend on consistent winding: vertex normals for smooth shading (3.5) average face normals, extrude (5.1) pushes along them, and curvature (chapter 7) and UV unwrapping (chapter 8) assume an oriented surface. One flipped face shows up in all of them.',
    ],
    callouts: [
      { type: 'insight', title: 'Bridge: from formula to code', body: 'Each component of the cross product is one line in `cross`, and each Newell term one line in `newell`; the notebook\'s printed normals are the formulas evaluated.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'three.js computes vertex normals from the triangles\' winding, and the GPU culls by screen-space winding: the same order decides lighting and visibility.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'MeshLab\'s Flip normals reverses corner lists (mesh.flip in GUI → code), and its Normals overlay draws Newell\'s normal at each face\'s centre.' },
    ],
    visualizations: [],
  },

  examples: [
    {
      id: 'modelling-geometry-1-002-ex1',
      title: 'A triangle\'s normal',
      difficulty: 'easy',
      problem: 'Corners $A = (0, 0, 0)$, $B = (2, 0, 0)$, $C = (0, 1, 0)$ in that order. Find the unit normal and the area.',
      steps: [
        { expression: 'B - A = (2, 0, 0),\\ C - A = (0, 1, 0)', annotation: 'Two edges from the first corner, in the listed order.', strategyTitle: 'Step 1: Edges' },
        { expression: '(2, 0, 0) \\times (0, 1, 0) = (0, 0, 2)', annotation: 'The cross product, component by component.', strategyTitle: 'Step 2: Cross product' },
        { expression: '\\mathbf{n} = (0, 0, 1),\\ \\text{area} = \\tfrac{1}{2} \\times 2 = 1', annotation: 'Divide by the length for the normal; half the length is the area.', strategyTitle: 'Step 3: Normalise' },
      ],
      answer: 'The normal is (0, 0, 1) and the area is 1.',
    },
    {
      id: 'modelling-geometry-1-002-ex2',
      title: 'A pyramid side',
      difficulty: 'medium',
      problem: 'Face [1, 0, 4] of the pyramid: vertex 1 = (1, 0, −1), vertex 0 = (−1, 0, −1), vertex 4 = (0, 1.5, 0). Which way does it point?',
      steps: [
        { expression: 'v_0 - v_1 = (-2, 0, 0),\\ v_4 - v_1 = (-1, 1.5, 1)', annotation: 'Edges from the first listed corner, vertex 1.', strategyTitle: 'Step 1: Edges' },
        { expression: '(-2, 0, 0) \\times (-1, 1.5, 1) = (0, 2, -3)', annotation: '(0·1 − 0·1.5, 0·(−1) − (−2)·1, (−2)·1.5 − 0·(−1)).', strategyTitle: 'Step 2: Cross product' },
        { expression: '\\mathbf{n} = (0, 2, -3)/\\sqrt{13} \\approx (0, 0.555, -0.832)', annotation: 'Out through the side at z = −1, and a little up: outwards.', strategyTitle: 'Step 3: Normalise and check' },
      ],
      answer: 'It points out of the pyramid, towards −z and slightly up: about (0, 0.555, −0.832).',
    },
    {
      id: 'modelling-geometry-1-002-ex3',
      title: 'Spotting a wrong face',
      difficulty: 'hard',
      problem: 'The pyramid lists its +x side as [1, 2, 4]. Is it right?',
      steps: [
        { expression: 'v_2 - v_1 = (0, 0, 2),\\ v_4 - v_1 = (-1, 1.5, 1)', annotation: 'Edges from vertex 1.', strategyTitle: 'Step 1: Edges' },
        { expression: '(0, 0, 2) \\times (-1, 1.5, 1) = (-3, -2, 0)', annotation: 'Points towards −x: into the pyramid from its +x side.', strategyTitle: 'Step 2: Cross product' },
        { expression: '[2, 1, 4] \\Rightarrow (3, 2, 0)', annotation: 'Reversing two corners reverses the normal: now it points out.', strategyTitle: 'Step 3: Fix' },
      ],
      answer: 'No: [1, 2, 4] points in; [2, 1, 4] (or any rotation of it, such as [1, 4, 2]) points out.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-1-002-ch1',
      title: 'Which way, by hand',
      difficulty: 'easy',
      problem: 'Corners (0, 0, 0), (0, 3, 0), (0, 0, 1) in that order. Which way does the face point?',
      hint: 'Edges from the first corner, then the cross product.',
      answer: 'Along +x: (0, 3, 0) × (0, 0, 1) = (3, 0, 0).',
      walkthrough: [{ expression: '(3 \\cdot 1 - 0 \\cdot 0,\\ 0 \\cdot 0 - 0 \\cdot 1,\\ 0 \\cdot 0 - 3 \\cdot 0) = (3, 0, 0)', annotation: 'Positive x, so the face points along +x.' }],
    },
    {
      id: 'modelling-geometry-1-002-ch2',
      title: 'Same face, three ways to write it',
      difficulty: 'medium',
      problem: 'Are [2, 1, 4], [1, 4, 2] and [4, 2, 1] the same face pointing the same way?',
      hint: 'Rotating a list keeps the cycle; reversing it changes the direction.',
      answer: 'Yes: each is a rotation of the others, the same cycle in the same direction, so all three have the same normal.',
      walkthrough: [],
    },
    {
      id: 'modelling-geometry-1-002-ch3',
      title: 'Debug the dark lid',
      difficulty: 'hard',
      problem: 'A box\'s top face renders black in a game, though it looks fine in the editor with two-sided lighting. Its corners are listed clockwise seen from above. Explain both behaviours and the fix.',
      hint: 'Which way does its normal point, and what does two-sided lighting hide?',
      answer: 'Clockwise from above means the normal points down, into the box, so the game lights its back and it goes dark (or culls it); two-sided lighting hid this. Reversing its corner order (Flip normals) fixes it.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      { symbol: '\\text{winding}', meaning: 'The order a face\'s corners are listed in; it decides which side is the front.' },
      { symbol: '\\mathbf{a} \\times \\mathbf{b}', meaning: 'The cross product: a vector at right angles to both, as long as their parallelogram\'s area.' },
      { symbol: '\\text{right-hand rule}', meaning: 'Fingers round the corners in order, thumb along the normal; anticlockwise seen from the front.' },
      { symbol: '\\mathbf{n}', meaning: 'The unit normal: the cross product divided by its length.' },
      { symbol: '\\text{Newell\'s method}', meaning: 'A normal from all of a face\'s corners at once, by summing a term per edge.' },
      { symbol: '\\text{back-face culling}', meaning: 'Skipping triangles that wind clockwise on screen, because they face away.' },
    ],
    rulesOfThumb: [
      'List every face anticlockwise as seen from outside.',
      'If a face goes dark or disappears, suspect its winding first.',
      'Rotating a corner list changes nothing; reversing it flips the face.',
      'Use Newell\'s method for faces with more than three corners.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'A face\'s normal is stored with it, separately from its corners.',
      whyStudentsThinkIt: 'File formats can carry normals, and tools draw them as their own lines.',
      correctionExample: '[2, 1, 4] and [1, 2, 4] use the same corners; the first points along (3, 2, 0), the second along (−3, −2, 0), purely from the order.',
      contrastCase: 'Stored vertex normals for smooth shading exist, but the face\'s front is still decided by its winding.',
    },
    {
      falseBelief: 'Any order of a face\'s corners is the same face.',
      whyStudentsThinkIt: 'It is the same set of points.',
      correctionExample: 'A, B, C gives (0, 0, 2); A, C, B gives (0, 0, −2).',
      contrastCase: 'Rotations (B, C, A) keep the direction; only reversing it turns the face round.',
    },
  ],

  transferPrompts: [
    {
      situation: 'You write a script that makes a box from six quads and some sides render dark.',
      competingTechniques: ['Check each face\'s winding with the cross product and reverse the wrong ones', 'Turn on two-sided lighting'],
      whyThisTechniqueWins: 'Two-sided lighting hides the symptom but the faces still point in, which breaks culling, extrusion and smooth shading.',
    },
    {
      situation: 'You need the normal of a five-sided face that is slightly bent.',
      competingTechniques: ['Newell\'s method over all five corners', 'The cross product of the first two edges'],
      whyThisTechniqueWins: 'The first two edges give a normal that depends on which corner you start from; Newell\'s sum uses all of them and does not.',
    },
  ],

  debugging: [
    {
      commonError: 'Writing the cross product\'s middle component as a_x b_z − a_z b_x.',
      symptom: 'Normals come out mirrored in y: up-facing faces seem to face down.',
      whyItHappened: 'The middle component is a_z b_x − a_x b_z; the sign is easy to swap.',
      repairStrategy: 'Check with (1, 0, 0) × (0, 1, 0), which must be (0, 0, 1).',
    },
    {
      commonError: 'Fixing a wrong face by changing a corner instead of reversing the order.',
      symptom: 'The face points out but the model has a hole or a twisted face.',
      whyItHappened: 'A different corner is a different face, not a flipped one.',
      repairStrategy: 'Keep the same corners and reverse their order (Flip normals).',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Compute a face\'s normal from its corner order, and fix a face list so every face points out.',
    explainVerbally: 'Explain why reversing the corner order reverses the normal, using the cross product.',
    detectIncorrectApplication: 'Recognise a wrongly wound face from its shading or its normal, in a notebook and in MeshLab.',
    transferToUnfamiliar: 'Use Newell\'s method on bent and many-sided faces, and reason about culling on the GPU.',
  },

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-1-002-assess-1',
        type: 'choice',
        text: 'Corners A, B, C give the normal (0, 0, 1). What do A, C, B give?',
        options: ['(0, 0, −1)', '(0, 0, 1)', '(1, 0, 0)', 'It depends on the lighting'],
        answer: '(0, 0, −1)',
        hint: 'Swapping two edges reverses the cross product.',
      },
    ],
  },

  quiz: [
    { id: 'modelling-geometry-1-002-quiz-1', type: 'choice', text: 'What decides which way a face points?', options: ['The order its corners are listed', 'Its colour', 'The camera', 'Which corner is lowest'], answer: 'The order its corners are listed', hints: ['The winding.'], reviewSection: 'Intuition — the winding paragraph' },
    { id: 'modelling-geometry-1-002-quiz-2', type: 'choice', text: '(2, 0, 0) × (0, 1, 0) is…', options: ['(0, 0, 2)', '(0, 0, −2)', '(2, 1, 0)', '(0, 2, 0)'], answer: '(0, 0, 2)', hints: ['(0, 0, −2) is the near-miss: that is (0, 1, 0) × (2, 0, 0).'], reviewSection: 'Math — the cross product' },
    { id: 'modelling-geometry-1-002-quiz-3', type: 'choice', text: 'Seen from the side the normal points to, the corners go…', options: ['Anticlockwise', 'Clockwise', 'Either way', 'In alphabetical order'], answer: 'Anticlockwise', hints: ['The right-hand rule.'], reviewSection: 'Intuition — the right-hand rule' },
    { id: 'modelling-geometry-1-002-quiz-4', type: 'choice', text: 'Which list is NOT the same face pointing the same way as [2, 1, 4]?', options: ['[1, 2, 4]', '[1, 4, 2]', '[4, 2, 1]', '[2, 1, 4]'], answer: '[1, 2, 4]', hints: ['The others are rotations; [1, 2, 4] is reversed.'], reviewSection: 'Challenges — three ways to write it' },
    { id: 'modelling-geometry-1-002-quiz-5', type: 'choice', text: 'What does the length of a triangle\'s edge cross product tell you?', options: ['Twice its area', 'Its perimeter', 'Its angle', 'Nothing'], answer: 'Twice its area', hints: ['The parallelogram is twice the triangle.'], reviewSection: 'Math — the length' },
    { id: 'modelling-geometry-1-002-quiz-6', type: 'choice', text: 'Why can a wrongly wound face vanish in a game?', options: ['Back-face culling skips triangles that wind clockwise on screen', 'Its normal is too long', 'The GPU cannot draw quads', 'Its corners are too far apart'], answer: 'Back-face culling skips triangles that wind clockwise on screen', hints: ['It looks like a back face.'], reviewSection: 'Intuition — the graphics strand' },
  ],

  checkpoints: [
    { id: 'cp-modelling-geometry-1-002-1', label: 'Read how the corner order decides the normal', type: 'read' },
    { id: 'cp-modelling-geometry-1-002-2', label: 'Read the right-hand rule and Newell\'s method', type: 'read' },
    { id: 'cp-modelling-geometry-1-002-3', label: 'Read what the GPU does with winding', type: 'read' },
    { id: 'cp-modelling-geometry-1-002-4', label: 'Complete the face-list challenge in the notebook', type: 'lab' },
    { id: 'cp-modelling-geometry-1-002-5', label: 'Predict the flipped normal in MeshLab\'s trace, then fix the last face', type: 'lab' },
    { id: 'cp-modelling-geometry-1-002-6', label: 'Work through the pyramid-side example', type: 'example' },
    { id: 'cp-modelling-geometry-1-002-7', label: 'Work through the wrong-face example', type: 'example' },
    { id: 'cp-modelling-geometry-1-002-8', label: 'Attempt the dark-lid challenge', type: 'challenge' },
  ],
};
