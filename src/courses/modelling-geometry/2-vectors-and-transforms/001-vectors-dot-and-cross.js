// Lesson 2.1: vectors, dot and cross (docs/modelling-course-plan.md). Four parts: the maths (length, the dot
// product and angles, projection, the cross product), building it (vector code, and lighting a sphere by n · l
// with a graded "aim the light" challenge), watching MeshLab do it (a traced Measure angle in Predict mode), and
// using the tool (Inspector numbers, Mesh › Measure angle).
import { withPicture } from '../notebookScene.js';

const VEC_FN = `// Vectors as arrays of three numbers.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const length = (u) => Math.hypot(u[0], u[1], u[2])
const scale = (u, k) => [u[0] * k, u[1] * k, u[2] * k]
const unit = (u) => scale(u, 1 / length(u))
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
const r = (x) => +x.toFixed(4)`;

const PYR_VERTS = `const P = [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], [0, 1.5, 0]]   // the pyramid's vertices`;

const VECTORS = `${VEC_FN}
${PYR_VERTS}

// The two edges at vertex 0: to vertex 1 along the base, and up to the tip.
const u = sub(P[1], P[0]), v = sub(P[4], P[0])
console.log('u = ' + u.join(', ') + '   |u| = ' + r(length(u)))
console.log('v = ' + v.join(', ') + '   |v| = ' + r(length(v)))
console.log('v made length 1: ' + unit(v).map(r).join(', '))`;

const DOT = `${VEC_FN}
${PYR_VERTS}

// The angle between two vectors from the dot product: cos θ = u · v / (|u| |v|).
const angle = (u, v) => r(Math.acos(dot(u, v) / (length(u) * length(v))) * 180 / Math.PI)
const say = (name, u, v) => console.log(name + ': u · v = ' + r(dot(u, v)) + ', angle ' + angle(u, v) + '°')
say('base corner to the tip ', sub(P[1], P[0]), sub(P[4], P[0]))
say('two base edges         ', sub(P[1], P[0]), sub(P[3], P[0]))
say('out and back           ', [1, 0, 0], [-1, 1, 0])`;

const PROJECT = `${VEC_FN}
${PYR_VERTS}

// Split v into the part along u and the part at right angles to u.
const u = sub(P[1], P[0]), v = sub(P[4], P[0])
const along = scale(u, dot(u, v) / dot(u, u))
const across = sub(v, along)
console.log('along u: ' + along.map(r).join(', ') + '   at right angles: ' + across.map(r).join(', '))
console.log('check: (part at right angles) · u = ' + r(dot(across, u)))
// The triangle 1, 0, 4 has base |u| and height |across|; the cross product gives the same area.
console.log('area = ½ × base × height = ' + r(length(u) * length(across) / 2) + ';  ½ |u × v| = ' + r(length(cross(u, v)) / 2))`;

const LIGHT = `${VEC_FN}

// A low-poly sphere: rings of quads, a fan of triangles at each pole.
const rings = 8, segs = 12, vertices = [[0, 1, 0]], faces = []
for (let i = 1; i < rings; i++) for (let j = 0; j < segs; j++) {
  const t = Math.PI * i / rings, p = 2 * Math.PI * j / segs
  vertices.push([Math.sin(t) * Math.cos(p), Math.cos(t), -Math.sin(t) * Math.sin(p)])
}
vertices.push([0, -1, 0])
const at = (i, j) => 1 + (i - 1) * segs + (j % segs), bottom = vertices.length - 1
for (let j = 0; j < segs; j++) {
  faces.push([0, at(1, j), at(1, j + 1)])
  for (let i = 1; i < rings - 1; i++) faces.push([at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)])
  faces.push([at(rings - 1, j), bottom, at(rings - 1, j + 1)])
}

// Lambert lighting: a face's brightness is n · l, the cosine of the angle between its normal and the
// direction towards the light, or 0 if it faces away. Change light and run again.
const light = unit([1, 2, 1])
const normal = (f) => { const c = f.map((k) => vertices[k]); return unit(cross(sub(c[1], c[0]), sub(c[2], c[0]))) }
const values = faces.map((f) => Math.max(0, dot(normal(f), light)))
console.log(faces.length + ' faces, ' + values.filter((x) => x > 0).length + ' lit; brightest n · l = ' + r(Math.max(...values)))
show({ verts: vertices, faces, values })`;

const CHALLENGE = `// Aim the light: make face 2 of the pyramid as bright as it can be (n · l close to 1), and face 4 dark
// (n · l of 0 or less). Change only the light's direction. The picture is shaded by n · l alone.
const light = [0, 1, 0]

${VEC_FN}
${PYR_VERTS}
const faces = [[0, 1, 2, 3], [1, 0, 4], [2, 1, 4], [3, 2, 4], [0, 3, 4]]
const normal = (f) => { const c = f.map((k) => P[k]); return unit(cross(sub(c[1], c[0]), sub(c[2], c[0]))) }
const l = unit(light)
const values = faces.map((f) => Math.max(0, dot(normal(f), l)))
faces.forEach((f, i) => console.log('face ' + i + ': n · l = ' + r(dot(normal(f), l))))
show({ verts: P, faces, values })`;

const SOLVED = CHALLENGE.replace('const light = [0, 1, 0]', 'const light = [3, 2, 0]');

// The pyramid's unit face normals (lesson 1.2), for the check.
const N2 = [0.83205, 0.5547, 0], N4 = [-0.83205, 0.5547, 0];

/** The challenge's check: read the light direction and say how far it is from lighting face 2 fully, face 4 not at all. */
export function checkLight(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+light\s*=\s*\[([^\]]*)\]/);
  const l = m ? m[1].split(',').map((x) => Number(x.trim())) : [];
  if (l.length !== 3 || l.some((x) => !Number.isFinite(x))) return no('Keep the line const light = [x, y, z], with three numbers.');
  const len = Math.hypot(...l);
  if (len === 0) return no('The light needs a direction: [0, 0, 0] has none.');
  const u = l.map((x) => x / len), d2 = u[0] * N2[0] + u[1] * N2[1] + u[2] * N2[2], d4 = u[0] * N4[0] + u[1] * N4[1] + u[2] * N4[2];
  const deg = Math.acos(Math.min(1, d2)) * 180 / Math.PI;
  if (deg > 5) return no(`Face 2 gets n · l = ${d2.toFixed(3)}: the light is ${deg.toFixed(1)}° away from its normal, so it gets cos ${deg.toFixed(1)}° of full brightness.`);
  if (d4 > 0) return no(`Face 2 is lit well, but face 4 still gets n · l = ${d4.toFixed(3)}.`);
  return { pass: true, message: `Face 2 gets n · l = ${d2.toFixed(3)} (the light is ${deg.toFixed(1)}° from its normal) and face 4 gets ${d4.toFixed(3)}, so it is dark.` };
}

export default {
  id: 'modelling-geometry-2-001',
  slug: 'vectors-dot-and-cross',
  chapter: 'modelling-geometry-2',
  order: 1,
  title: 'Vectors, Dot and Cross',
  subtitle: 'Arrows you can add, measure and multiply: the language of every 3D calculation.',
  tags: ['vectors', 'dot product', 'cross product', 'lighting', 'angles'],
  aliases: 'vector length magnitude normalize unit vector dot product angle cosine projection cross product area lambert lighting n dot l measure angle meshlab',
  timeToComplete: 45,
  coreConcept: 'A vector is a direction and a length, written as three numbers. Its length comes from Pythagoras; the dot product u · v = |u| |v| cos θ gives angles and projections; the cross product gives a vector at right angles to both with length equal to the parallelogram\'s area. Lighting is a dot product: a surface\'s brightness is n · l.',
  prerequisites: ['modelling-geometry-1-007'],
  nextLesson: null,

  hook: {
    question: 'A light shines on a sphere. Why is the side facing the light bright, the edge dim, and the far side dark, and how does the GPU work that out for a million pixels sixty times a second?',
    realWorldContext: 'Every shader lights surfaces with a dot product; every modelling tool measures angles, snaps to directions and builds normals with dot and cross products. Chapter 1 used vectors already (edges, normals, distances); this lesson makes them a tool you can reason with.',
  },

  intuition: {
    prose: [
      'A **vector** is an arrow: a direction and a length, written as three numbers. The edge of the pyramid from vertex 0 at $(-1, 0, -1)$ to vertex 1 at $(1, 0, -1)$ is $u = (2, 0, 0)$: subtract the start from the end, coordinate by coordinate. The edge up to the tip is $v = (0, 1.5, 0) - (-1, 0, -1) = (1, 1.5, 1)$.',
      'Its **length** is Pythagoras in three dimensions: $|v| = \\sqrt{1^2 + 1.5^2 + 1^2} = \\sqrt{4.25} \\approx 2.0616$. Dividing a vector by its length gives a **unit vector**, the same direction with length 1: normals and light directions are always written this way.',
      'The **dot product** multiplies matching coordinates and adds them: $u \\cdot v = 2 \\times 1 + 0 \\times 1.5 + 0 \\times 1 = 2$. It equals $|u|\\,|v| \\cos\\theta$, where $\\theta$ is the angle between them. So $\\cos\\theta = 2 / (2 \\times 2.0616) \\approx 0.485$ and $\\theta \\approx 60.98°$: the angle at the pyramid\'s base corner.',
      'Before reading on, predict: what is the dot product of two base edges that meet at a corner, $(2, 0, 0)$ and $(0, 0, 2)$? It is 0. A dot product of zero means a right angle; positive means less than $90°$, negative more.',
      'The dot product also **projects**: the part of $v$ along $u$ is $\\frac{u \\cdot v}{u \\cdot u}\\,u = (1, 0, 0)$, and what is left, $(0, 1.5, 1)$, is at right angles to $u$. That leftover is the triangle\'s height. The **cross product** (lesson 1.2) does the complementary job: $u \\times v = (0, -2, 3)$ is at right angles to both, and its length $|u|\\,|v| \\sin\\theta = \\sqrt{13}$ is twice the triangle\'s area.',
      '**Lighting** is a dot product. A surface facing the light straight on gets the full light; tilted by $\\theta$ it gets $\\cos\\theta$ of it, because the same beam is spread over more area; facing away it gets none. With unit normal $n$ and unit direction towards the light $l$, the brightness is $\\max(0, n \\cdot l)$. This is Lambert\'s law, and it is the first line of almost every shader.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: The angle between two edges',
        body: 'Step 1. Make both vectors start at the shared corner: $u = A - B$, $v = C - B$.\nStep 2. Lengths: $|u| = \\sqrt{u \\cdot u}$, $|v| = \\sqrt{v \\cdot v}$.\nStep 3. Dot product: $u \\cdot v = u_x v_x + u_y v_y + u_z v_z$.\nStep 4. $\\cos\\theta = u \\cdot v / (|u|\\,|v|)$, then $\\theta = \\arccos$ of that.\nStep 5. For the area of triangle $A, B, C$: $\\tfrac{1}{2}|u \\times v|$.',
      },
      {
        type: 'warning',
        title: 'Normalise before lighting',
        body: 'n · l is the cosine only when both are unit vectors. An unnormalised normal of length 2 makes a face twice as bright as it should be; a light direction pointing from the light instead of towards it lights the back of every object instead of the front.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: n · l on the GPU',
        body: 'For every pixel, the fragment shader receives the surface normal (interpolated across the triangle) and computes max(dot(N, L), 0.0), then multiplies the surface colour by it. three.js\'s MeshLambertMaterial does exactly this; MeshStandardMaterial adds more terms on top. The GPU does a dot product per pixel because it is three multiplications and two additions, and its hardware is built for millions of them at once.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: vectors and light',
        props: {
          lesson: {
            title: 'Vectors, dot and cross',
            subtitle: 'Measure edges, find angles and projections, light a sphere by n · l, and aim a light.',
            cells: [
              { type: 'js', instruction: '### 1. Vectors and lengths\nThe two edges at the pyramid\'s base corner, as vectors, with their lengths and one made into a unit vector.', startCode: VECTORS },
              { type: 'js', instruction: '### 2. Angles from the dot product\nAn acute angle (positive dot product), a right angle (zero) and an obtuse one (negative).', startCode: DOT },
              { type: 'js', instruction: '### 3. Projection\nSplit v into a part along u and a part at right angles to it. The part at right angles is the triangle\'s height, and ½ × base × height agrees with ½ |u × v|.', startCode: PROJECT },
              { type: 'js', instruction: '### 4. Light a sphere by n · l\nEach face is shaded only by max(0, n · l): no lights, no materials, just your numbers. Change light and run again; drag the picture to turn it.', startCode: withPicture(LIGHT), showPreviewByDefault: true, outputHeight: 340 },
              { type: 'challenge', instruction: '### 5. Challenge: aim the light\nChoose the light\'s direction so face 2 is lit almost fully (within 5° of its normal) and face 4 not at all. The check works out n · l for both from your direction.', startCode: withPicture(CHALLENGE), solutionCode: withPicture(SOLVED), check: checkLight, showPreviewByDefault: true, outputHeight: 340 },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Vectors, dot and cross" in MeshLab](#/lab/mesh-lab?project=vectors-dot-cross). It measures the angle at the pyramid\'s base corner with **Record traces** on, using the same two edges as cells 1 and 2. The Algorithm trace is in **Predict** mode: after building the vectors it asks for their dot product, then for the angle. Compare its answers with your cell 2. Then measure the tip yourself.' },
              { type: 'markdown', instruction: '### Use the tool\n- The Inspector\'s **Position**, **Rotation** and **Scale** are vectors: three numbers each.\n- **Mesh › Measure angle** (edit mode, two edges selected that meet at a corner) shows the angle, the dot product and both lengths in the status line, and traces the working.\n- In a script: mesh.measure(a, b, c) for the angle at vertex b.\n- **In Blender:** in edit mode, Viewport Overlays › Measurement shows edge lengths, edge angles and face angles on the selection; the Measure tool in the toolbar draws a ruler, and dragging from its middle turns it into a protractor.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      'For $u = (u_x, u_y, u_z)$: $|u| = \\sqrt{u_x^2 + u_y^2 + u_z^2}$, and the unit vector is $\\hat{u} = u / |u|$.',
      '$u \\cdot v = u_x v_x + u_y v_y + u_z v_z = |u|\\,|v| \\cos\\theta$. It is symmetric ($u \\cdot v = v \\cdot u$), and $u \\cdot u = |u|^2$.',
      'The projection of $v$ onto $u$ is $\\mathrm{proj}_u v = \\frac{u \\cdot v}{u \\cdot u}\\,u$, and $v - \\mathrm{proj}_u v$ is at right angles to $u$: its dot product with $u$ is $u \\cdot v - \\frac{u \\cdot v}{u \\cdot u}\\,u \\cdot u = 0$.',
      '$|u \\times v| = |u|\\,|v| \\sin\\theta$, so $|u \\times v|^2 + (u \\cdot v)^2 = |u|^2 |v|^2$. For the base corner: $13 + 4 = 4 \\times 4.25 = 17$.',
    ],
    equations: [],
    callouts: [],
    visualizations: [],
  },

  rigor: {
    prose: [
      'Why $u \\cdot v = |u|\\,|v|\\cos\\theta$: by the law of cosines on the triangle with sides $u$, $v$ and $u - v$, $|u - v|^2 = |u|^2 + |v|^2 - 2|u|\\,|v|\\cos\\theta$. Expanding the left side coordinate by coordinate gives $|u|^2 + |v|^2 - 2\\,u \\cdot v$. Comparing the two gives the formula.',
      'Numerical care: $u \\cdot v / (|u|\\,|v|)$ can come out a hair above 1 for nearly parallel vectors because of rounding, and $\\arccos$ of that is not a number. MeshLab clamps it to $[-1, 1]$ before taking the inverse cosine. For small angles, $\\theta = \\operatorname{atan2}(|u \\times v|, u \\cdot v)$ is more accurate than $\\arccos$.',
      'Lambert\'s law assumes a matte surface that scatters light equally in every direction; shiny surfaces add a term that depends on where the viewer is (chapter 9). The $\\cos\\theta$ factor is geometry: a beam of cross-section $A$ hitting a surface at angle $\\theta$ from its normal covers area $A / \\cos\\theta$, so each unit of surface gets $\\cos\\theta$ of the light.',
      'A normal used for lighting must be unit length, and after a non-uniform scale a normal must be transformed differently from a position (lesson 2.4 and chapter 3): a common source of lighting that looks subtly wrong.',
    ],
    callouts: [
      { type: 'insight', title: 'Bridge: from formulas to code', body: 'Each formula is one line of VEC_FN: length is Math.hypot, dot is three products added, cross is three two-by-two determinants.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Cell 4\'s max(0, dot(n, l)) per face is what a fragment shader does per pixel.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Mesh › Measure angle runs mesh.measure: the same vectors, dot product, clamped arccos and cross product, traced.' },
    ],
    visualizations: [],
  },

  examples: [
    {
      id: 'modelling-geometry-2-001-ex1',
      title: 'A length and a unit vector',
      difficulty: 'easy',
      problem: 'Find the length of $v = (1, 1.5, 1)$ and the unit vector in its direction.',
      steps: [
        { expression: '|v| = \\sqrt{1 + 2.25 + 1} = \\sqrt{4.25} \\approx 2.0616', annotation: 'Pythagoras.', strategyTitle: 'Step 1: Length' },
        { expression: '\\hat{v} \\approx (0.4851, 0.7276, 0.4851)', annotation: 'Divide each coordinate by the length.', strategyTitle: 'Step 2: Unit vector' },
      ],
      answer: '|v| ≈ 2.0616; the unit vector is about (0.4851, 0.7276, 0.4851).',
    },
    {
      id: 'modelling-geometry-2-001-ex2',
      title: 'The angle at the tip',
      difficulty: 'medium',
      problem: 'Find the angle at the pyramid\'s tip between the edges to vertices 0 and 1.',
      steps: [
        { expression: 'u = (-1, -1.5, -1),\\ v = (1, -1.5, -1)', annotation: 'Vertex minus the tip (0, 1.5, 0).', strategyTitle: 'Step 1: Vectors' },
        { expression: 'u \\cdot v = -1 + 2.25 + 1 = 2.25', annotation: 'Matching coordinates multiplied and added.', strategyTitle: 'Step 2: Dot product' },
        { expression: '\\cos\\theta = 2.25 / 4.25 \\approx 0.5294,\\ \\theta \\approx 58.03°', annotation: 'Both lengths are √4.25.', strategyTitle: 'Step 3: Angle' },
      ],
      answer: 'About 58.03°.',
    },
    {
      id: 'modelling-geometry-2-001-ex3',
      title: 'How bright is a face?',
      difficulty: 'hard',
      problem: 'Face 2 of the pyramid has unit normal (0.832, 0.555, 0). Light comes from straight above, $l = (0, 1, 0)$. What fraction of full brightness does the face get, and at what angle does the light hit it?',
      steps: [
        { expression: 'n \\cdot l = 0.555', annotation: 'Only the y coordinates multiply to something non-zero.', strategyTitle: 'Step 1: Dot product' },
        { expression: '\\theta = \\arccos 0.555 \\approx 56.3°', annotation: 'Both are unit vectors, so n · l is cos θ.', strategyTitle: 'Step 2: Angle' },
      ],
      answer: 'About 0.555 of full brightness; the light is about 56.3° from the face\'s normal.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-2-001-ch1',
      title: 'Right angle or not',
      difficulty: 'easy',
      problem: 'Are (1, 2, 3) and (3, 0, −1) at right angles?',
      hint: 'Compute the dot product.',
      answer: 'Yes: 3 + 0 − 3 = 0.',
      walkthrough: [],
    },
    {
      id: 'modelling-geometry-2-001-ch2',
      title: 'A shadow on the floor',
      difficulty: 'medium',
      problem: 'Project v = (1, 1.5, 1) onto the floor direction u = (1, 0, 0). What are the part along u and the part at right angles?',
      hint: 'proj = (u · v / u · u) u.',
      answer: 'Along u: (1, 0, 0). At right angles: (0, 1.5, 1).',
      walkthrough: [],
    },
    {
      id: 'modelling-geometry-2-001-ch3',
      title: 'The inside-out sphere',
      difficulty: 'hard',
      problem: 'A sphere renders lit on the side away from the light and dark on the side towards it. Name two causes, each a vector mistake.',
      hint: 'Which two vectors go into n · l, and which way should each point?',
      answer: 'The normals point inwards (winding reversed, lesson 1.2), or the light vector points from the light instead of towards it. Either flips the sign of n · l.',
      walkthrough: [],
    },
  ],

  semantics: {
    core: [
      { symbol: 'u = (u_x, u_y, u_z)', meaning: 'A vector: a direction and a length, as three numbers.' },
      { symbol: '|u|', meaning: 'The length: √(uₓ² + u_y² + u_z²).' },
      { symbol: '\\hat{u}', meaning: 'The unit vector: u divided by its length.' },
      { symbol: 'u \\cdot v', meaning: 'The dot product: |u| |v| cos θ.' },
      { symbol: 'u \\times v', meaning: 'The cross product: at right angles to both, length |u| |v| sin θ.' },
      { symbol: '\\max(0, n \\cdot l)', meaning: 'Lambert brightness: how much light a matte surface receives.' },
    ],
    rulesOfThumb: [
      'Vector from A to B: B − A.',
      'Dot product zero: right angle. Positive: acute. Negative: obtuse.',
      'Normalise normals and light directions before lighting.',
      'Cross product for "at right angles to both" and for areas.',
    ],
  },

  misconceptions: [
    {
      falseBelief: 'The dot product of two vectors is a vector.',
      whyStudentsThinkIt: 'The cross product is.',
      correctionExample: '(2, 0, 0) · (1, 1.5, 1) = 2, a single number.',
      contrastCase: '(2, 0, 0) × (1, 1.5, 1) = (0, −2, 3), a vector.',
    },
    {
      falseBelief: 'A face tilted 60° from the light gets two thirds of the light.',
      whyStudentsThinkIt: 'Brightness seems to fall off evenly with the angle.',
      correctionExample: 'It gets cos 60° = 0.5.',
      contrastCase: 'At 0° it gets 1, at 90° it gets 0; in between it follows the cosine, not a straight line.',
    },
  ],

  transferPrompts: [
    {
      situation: 'You need to know whether a face faces the camera.',
      competingTechniques: ['The sign of n · (direction to the camera)', 'Comparing the face\'s position with the camera\'s'],
      whyThisTechniqueWins: 'The sign of a dot product answers "facing or not" directly, whatever the positions.',
    },
    {
      situation: 'You need the height of a triangle above one of its sides.',
      competingTechniques: ['Project and take the part at right angles (or use the cross product)', 'Measure by eye in the viewport'],
      whyThisTechniqueWins: 'Projection gives the exact height in one line, and the cross product checks it.',
    },
  ],

  debugging: [
    {
      commonError: 'Taking arccos of u · v without dividing by the lengths.',
      symptom: 'NaN angles, or angles that change when the mesh is scaled.',
      whyItHappened: 'u · v is |u| |v| cos θ, not cos θ.',
      repairStrategy: 'Divide by |u| |v| first, and clamp to [−1, 1].',
    },
    {
      commonError: 'Using an unnormalised normal for lighting.',
      symptom: 'Large faces look brighter than small ones facing the same way.',
      whyItHappened: 'A cross-product normal\'s length is twice the face area.',
      repairStrategy: 'Normalise: divide by the length before taking n · l.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Compute lengths, angles, projections and areas from coordinates, and light a surface by n · l.',
    explainVerbally: 'Explain why the dot product gives cosines, and why lighting follows the cosine.',
    detectIncorrectApplication: 'Spot an unnormalised normal, a reversed light vector or a missing division by the lengths.',
    transferToUnfamiliar: 'Use dot and cross products for facing tests, heights and areas in new problems.',
  },

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-2-001-assess-1',
        type: 'choice',
        text: 'u · v = 0 means the two vectors are…',
        options: ['At right angles', 'Parallel', 'The same length', 'Pointing opposite ways'],
        answer: 'At right angles',
        hint: 'cos 90° = 0.',
      },
    ],
  },

  quiz: [
    { id: 'modelling-geometry-2-001-quiz-1', type: 'choice', text: 'The vector from (−1, 0, −1) to (1, 0, −1) is…', options: ['(2, 0, 0)', '(−2, 0, 0)', '(0, 0, 0)', '(1, 0, −1)'], answer: '(2, 0, 0)', hints: ['End minus start. (−2, 0, 0) is start minus end.'], reviewSection: 'Intuition — vectors' },
    { id: 'modelling-geometry-2-001-quiz-2', type: 'choice', text: 'The length of (1, 1.5, 1) is about…', options: ['2.06', '3.5', '4.25', '1.5'], answer: '2.06', hints: ['√4.25; 4.25 is the length squared.'], reviewSection: 'Intuition — length' },
    { id: 'modelling-geometry-2-001-quiz-3', type: 'choice', text: '(2, 0, 0) · (1, 1.5, 1) =', options: ['2', '(2, 0, 0)', '4.5', '0'], answer: '2', hints: ['2×1 + 0×1.5 + 0×1.'], reviewSection: 'Intuition — the dot product' },
    { id: 'modelling-geometry-2-001-quiz-4', type: 'choice', text: 'A negative dot product means the angle is…', options: ['More than 90°', 'Less than 90°', 'Exactly 90°', 'Zero'], answer: 'More than 90°', hints: ['Cosine is negative past 90°.'], reviewSection: 'Intuition — the sign' },
    { id: 'modelling-geometry-2-001-quiz-5', type: 'choice', text: 'A surface 60° from facing the light gets what fraction of full brightness?', options: ['0.5', '0.67', '0.87', '0.33'], answer: '0.5', hints: ['cos 60°.'], reviewSection: 'Intuition — lighting' },
    { id: 'modelling-geometry-2-001-quiz-6', type: 'choice', text: 'Per pixel, a Lambert fragment shader computes…', options: ['max(dot(N, L), 0)', 'cross(N, L)', 'length(N)', 'N + L'], answer: 'max(dot(N, L), 0)', hints: ['The brightness.'], reviewSection: 'Intuition — the graphics strand' },
  ],

  checkpoints: [
    { id: 'cp-modelling-geometry-2-001-1', label: 'Read vectors, lengths and unit vectors', type: 'read' },
    { id: 'cp-modelling-geometry-2-001-2', label: 'Read the dot product, angles and projection', type: 'read' },
    { id: 'cp-modelling-geometry-2-001-3', label: 'Read how lighting is a dot product', type: 'read' },
    { id: 'cp-modelling-geometry-2-001-4', label: 'Complete the aim-the-light challenge in the notebook', type: 'lab' },
    { id: 'cp-modelling-geometry-2-001-5', label: 'Predict the dot product and angle in MeshLab\'s trace, then measure the tip', type: 'lab' },
    { id: 'cp-modelling-geometry-2-001-6', label: 'Work through the angle-at-the-tip example', type: 'example' },
    { id: 'cp-modelling-geometry-2-001-7', label: 'Work through the face-brightness example', type: 'example' },
    { id: 'cp-modelling-geometry-2-001-8', label: 'Attempt the inside-out sphere challenge', type: 'challenge' },
  ],
};
