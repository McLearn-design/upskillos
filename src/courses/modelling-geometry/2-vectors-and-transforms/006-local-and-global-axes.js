// Lesson 2.6: local and global axes. The columns of an object's matrix are its own axes; the gizmo draws them
// divided by their lengths; a world point is changed into the object's coordinates by dot products with them.
import { withPicture } from '../notebookScene.js';

// The crate used throughout: at (1, 0.5, 2), turned 30° about y, stretched 1.5 times along its own z.
const CRATE = `const r = (x) => +x.toFixed(3)
const deg = Math.PI / 180
const c = Math.cos(30 * deg), s = Math.sin(30 * deg)

// M = T·R·S as rows: turn 30° about y, scale (1, 1, 1.5), move to (1, 0.5, 2).
const M = [
  [c, 0, s * 1.5, 1],
  [0, 1, 0,       0.5],
  [-s, 0, c * 1.5, 2],
  [0, 0, 0,       1],
]
const column = (j) => [M[0][j], M[1][j], M[2][j]]
const length = (v) => Math.hypot(...v)
`;

const COLUMNS = `${CRATE}
// The first three columns are where the crate's own x, y and z axes point in the world.
for (const [j, name] of ['x', 'y', 'z'].entries()) {
  const col = column(j)
  console.log(name + ' column ' + col.map(r).join(', ') + '   length ' + r(length(col)))
}
// Divide by the length to get a direction: what the gizmo draws in Local axes mode.
const z = column(2)
console.log('unit z ' + z.map((x) => r(x / length(z))).join(', '))`;

const MOVE = `${CRATE}
const position = [M[0][3], M[1][3], M[2][3]]
const unitX = column(0).map((x) => x / length(column(0)))

// The same drag, 1 unit, in the two gizmo modes.
const world = position.map((p, i) => p + [1, 0, 0][i])
const local = position.map((p, i) => p + unitX[i])
console.log('move 1 along world x: ' + world.map(r).join(', '))
console.log('move 1 along local x: ' + local.map(r).join(', '))`;

const BASIS = `${CRATE}
const origin = [M[0][3], M[1][3], M[2][3]]
const p = [3, 0.5, 2]                                   // a point in world coordinates
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

// 1. The offset from the crate's origin.
const offset = p.map((x, i) => x - origin[i])
// 2. How far along each unit axis the offset reaches.
const units = [0, 1, 2].map((j) => column(j).map((x) => x / length(column(j))))
const along = units.map((u) => dot(u, offset))
// 3. Divide by each axis's scale: the coordinates the crate's own mesh uses.
const scales = [0, 1, 2].map((j) => length(column(j)))
const local = along.map((a, j) => a / scales[j])

console.log('offset from origin: ' + offset.map(r).join(', '))
console.log('dot with unit axes: ' + along.map(r).join(', '))
console.log('local (divide by scales ' + scales.map(r).join(', ') + '): ' + local.map(r).join(', '))
// Check: M times the local point is the world point again.
const back = [0, 1, 2].map((i) => M[i][0] * local[0] + M[i][1] * local[1] + M[i][2] * local[2] + M[i][3])
console.log('check, M × local: ' + back.map(r).join(', '))`;

const AXES_PICTURE = `${CRATE}
// A box from its 8 corners, each corner sent through a matrix (rows, as M above).
const apply = (A, v) => [0, 1, 2].map((i) => A[i][0] * v[0] + A[i][1] * v[1] + A[i][2] * v[2] + A[i][3])
const verts = [], faces = [], groups = []
function box(A, lo, hi, group) {
  const k = verts.length
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) verts.push(apply(A, [x, y, z]))
  for (const f of [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]) { faces.push(f.map((i) => i + k)); groups.push(group) }
}
const I = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
// Turn and move, but no scale: the unit axes, as the gizmo draws them.
const TR = M.map((row) => [row[0], row[1], row[2] / 1.5, row[3]])   // the z column divided by its length, 1.5
const t = 0.06
box(M, [-0.5, -0.5, -0.5], [0.5, 0.5, 0.5], 1)          // the crate (amber), 1 × 1 × 1.5
box(I, [0, -t, -t], [1.6, t, t], 7)                     // world x, y, z at the world origin (grey)
box(I, [-t, 0, -t], [t, 1.6, t], 7)
box(I, [-t, -t, 0], [t, t, 1.6], 7)
box(TR, [0, -t, -t], [1.6, t, t], 4)                    // the crate's own x (red), y (green), z (blue)
box(TR, [-t, 0, -t], [t, 1.6, t], 2)
box(TR, [-t, -t, 0], [t, t, 1.6], 0)
box(I, [2.92, 0.42, 1.92], [3.08, 0.58, 2.08], 3)       // the point (3, 0.5, 2) (pink)
console.log(faces.length + ' faces: the crate, the world axes, its own axes, the point')
show({ verts, faces, groups })`;

const CHALLENGE = `// The crate: at (1, 0.5, 2), turned 30° about y, stretched 1.5 times along its own z.
// The z column of its world matrix is (0.75, 0, 1.299).
// Push it 2 forward along its OWN z axis. What do you add to its position?
const move = [0, 0, 2]

const position = [1, 0.5, 2].map((x, i) => x + move[i])
const r = (x) => +x.toFixed(3)
console.log('crate moves to ' + position.map(r).join(', ') + ', a distance of ' + r(Math.hypot(...move)))`;

const SOLVED = CHALLENGE.replace('const move = [0, 0, 2]', 'const move = [1, 0, 1.732]');

const UNIT_Z = [0.5, 0, Math.sqrt(3) / 2];

/** The challenge's check: read the move, and say what it does if it is not 2 along the crate's own z. */
export function checkMove(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+move\s*=\s*\[([^\]]*)\]/);
  const v = m ? m[1].split(',').map((x) => Number(x.trim())) : [];
  if (v.length !== 3 || !v.every(Number.isFinite)) return no('Keep the line const move = [x, y, z], with three numbers.');
  const fmt = (p) => `(${p.map((x) => +x.toFixed(3)).join(', ')})`;
  const len = Math.hypot(...v);
  const near = (a, b, tol = 0.01) => a.every((x, i) => Math.abs(x - b[i]) <= tol);
  if (near(v, UNIT_Z.map((x) => 2 * x))) return { pass: true, message: `${fmt(v)} is 2 × the unit z axis (0.5, 0, 0.866): the crate moves 2 along its own z, to (2, 0.5, 3.732). The world's z did not come into it.` };
  if (near(v, [0, 0, 2])) return no('That is 2 along the world\'s z. The crate is turned 30° about y, so its own z points somewhere else: read it off the z column and divide by the column\'s length.');
  if (near(v, [1.5, 0, 2.598])) return no('That moves 3, not 2: (1.5, 0, 2.598) is twice the z column, and the column is 1.5 long because of the scale. Divide the column by its length first.');
  if (len < 1e-9) return no('That does not move the crate at all.');
  const cos = (v[0] * UNIT_Z[0] + v[1] * UNIT_Z[1] + v[2] * UNIT_Z[2]) / len;
  const angle = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
  if (angle < 0.5) return no(`Right direction, but it moves ${+len.toFixed(3)}, not 2.`);
  if (Math.abs(len - 2) < 0.01) return no(`It moves 2, but along ${fmt(v.map((x) => x / len))}, which is ${+angle.toFixed(1)}° away from the crate's own z axis.`);
  return no(`It moves ${+len.toFixed(3)} along ${fmt(v.map((x) => x / len))}, ${+angle.toFixed(1)}° away from the crate's own z axis. It should move 2 along that axis.`);
}

export default {
  id: 'modelling-geometry-2-006',
  slug: 'local-and-global-axes',
  chapter: 'modelling-geometry',
  order: 6,
  title: 'Local and global axes',
  subtitle: 'The columns of an object\'s matrix are its own axes: read them, move along them, and measure in them.',
  tags: ['transforms', 'change of basis', 'local axes', 'gizmo', 'coordinate frames'],
  coreConcept: 'The first three columns of an object\'s world matrix are its own x, y and z axes in world coordinates; divided by their lengths they are the gizmo\'s local arrows, and dot products with them turn a world point into the object\'s own coordinates.',
  prerequisites: ['modelling-geometry-2-001', 'modelling-geometry-2-002', 'modelling-geometry-2-005'],
  timeToComplete: 35,
  nextLesson: 'modelling-geometry-2-007',

  hook: {
    question: 'A car model is turned 30°. You press "forward" and add 2 to its z position. Why does it drift off 30° to the side instead of driving straight ahead?',
    realWorldContext: 'Every modelling tool lets you drag along the object\'s own axes or the world\'s. Game code moves a character "forward" every frame, and a camera flies "along its view". All of these read an axis off a matrix. Get it wrong and things slide, drift or move too far.',
  },

  intuition: {
    prose: [
      'Take a crate at $(1, 0.5, 2)$, turned $30°$ about $y$ and stretched $1.5$ times along its own $z$. Lesson 2.2 built its matrix $M = T \\cdot R \\cdot S$. Multiply $M$ by the crate\'s own point $(1, 0, 0)$ and you get $M$\'s first column, plus the move: $(0.866, 0, -0.5)$ from the origin. Multiply by $(0, 0, 1)$ and you get the third column, $(0.75, 0, 1.299)$.',
      'So each column is the place one of the crate\'s own axes ends up in the world. The first column is the crate\'s $x$ axis, the second its $y$ axis, the third its $z$ axis. These are its **local axes**. The world\'s own $(1, 0, 0)$, $(0, 1, 0)$ and $(0, 0, 1)$ are the **global axes** (also called world axes).',
      'The third column is $1.5$ long, not $1$. The scale stretched it. Its **length** $|c|$ (the square root of the sum of its squared entries, from lesson 2.1) is the scale along that axis. Divide a column by its length and you get a **unit axis** $\\hat{u}$: a pure direction, $1$ long. The crate\'s unit $z$ axis is $(0.5, 0, 0.866)$.',
      'Before running cell 2, predict: the crate starts at $(1, 0.5, 2)$. Where is it after you drag it $1$ along the world\'s $x$? Where is it after $1$ along its own $x$? Write down both, then run the cell.',
      'Dragging $1$ along the world\'s $x$ adds $(1, 0, 0)$: the crate goes to $(2, 0.5, 2)$. Dragging $1$ along its own $x$ adds its unit $x$ axis, $(0.866, 0, -0.5)$: it goes to $(1.866, 0.5, 1.5)$. The two agree only when the object is not turned.',
      'Now go the other way. The world point $p = (3, 0.5, 2)$: where is it in the crate\'s own coordinates? First take the **offset** $p - o$ from the crate\'s origin $o = (1, 0.5, 2)$. That is $(2, 0, 0)$.',
      'The dot product of the offset with a unit axis is how far along that axis the offset reaches (lesson 2.1: $a \\cdot \\hat{u}$ is the length of $a$\'s shadow on $\\hat{u}$). With unit $x$: $2 \\times 0.866 = 1.732$. With unit $y$: $0$. With unit $z$: $2 \\times 0.5 = 1$.',
      'Those are distances in the world. The crate\'s mesh measures its $z$ in units stretched by $1.5$, so divide by each scale: $(1.732, 0, 1 / 1.5) = (1.732, 0, 0.667)$. Check: $M$ times $(1.732, 0, 0.667)$ gives back $(3, 0.5, 2)$. Rewriting a point in another set of axes like this is a **change of basis**.',
      'This only works because the crate\'s unit axes are at right angles: each dot product picks out one axis and ignores the others. Lesson 2.3 showed a child under an unevenly scaled parent gets sheared, and its axes are not at right angles. Then use the inverse matrix instead (example 3).',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Read an object\'s axes, and change a point into them',
        body: 'Step 1. Take the object\'s world matrix $M$ (lesson 2.5 for a child: parent\'s world × local).\nStep 2. Its first three columns $c_x, c_y, c_z$ are the object\'s own axes in world coordinates.\nStep 3. Their lengths $|c_x|, |c_y|, |c_z|$ are the scales; $\\hat{u} = c / |c|$ are the unit axes the gizmo draws.\nStep 4. To move $d$ along a local axis, add $d \\, \\hat{u}$ to the position.\nStep 5. To find world point $p$ in local coordinates, take the offset $p - o$ from the fourth column $o$.\nStep 6. Check the unit axes are at right angles (each pair\'s dot product is $0$). If so, coordinate $i$ is $(\\hat{u}_i \\cdot (p - o)) / |c_i|$. If not, use $M^{-1} p$.',
      },
      {
        type: 'warning',
        title: 'Divide by the length before you use a column as a direction',
        body: 'A column is as long as the scale along it. Moving "2 along the crate\'s z" with the raw z column $(0.75, 0, 1.299)$ moves it $3$, because that column is $1.5$ long. A direction must be a unit vector first.',
      },
      {
        type: 'warning',
        title: 'Dot products only work on axes at right angles',
        body: 'If the axes are sheared, the dot product with $\\hat{u}_x$ also picks up part of $z$, and the coordinates come out wrong. Check the three dot products between the unit axes; if any is not $0$, use the inverse matrix.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: drawing the gizmo',
        body: 'The move gizmo is three arrows drawn at the object\'s world origin (the fourth column). In World axes mode they point along $(1, 0, 0)$, $(0, 1, 0)$, $(0, 0, 1)$. In Local axes mode they point along the unit columns. It is drawn on top of everything (no depth test) and at a fixed size on screen, so it never hides inside the mesh or shrinks with distance. Dragging an arrow projects the mouse\'s motion onto that one direction (lesson 4.4).',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "local axes are the world axes moved to the object". The crate\'s own axes (red, green, blue) are turned $30°$ from the grey world axes, and its three axes are drawn the same length although the crate is $1.5$ deep along z: a unit axis is a direction, not a size. Invariant: the green $y$ axis is the same in both, because the turn is about $y$.',
      },
      { type: 'insight', title: 'Bridge: from the chain rule to code', body: 'column(j) in the cells is $M e_j$: the matrix times a unit vector picks out one column. Dividing by length(column(j)) is $\\hat{u} = c / |c|$.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'The renderer never splits a matrix into axes; it sends the whole of $M$ to the vertex shader. The tool needs the axes for the gizmo, for "move along local", and for snapping, all done on the CPU.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Object › Trace the local axes reads the columns, divides by their lengths, checks the right angles and changes the world origin into local coordinates, step by step. The toolbar\'s Local axes / World axes button switches what the gizmo\'s arrows follow.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: axes from a matrix',
        caption: 'Read the axes off the columns, move along them, and change a point into them. Then do it in MeshLab.',
        props: {
          lesson: {
            title: 'Local and global axes',
            subtitle: 'Read a crate\'s own axes off its matrix, move it along them, and find a world point in its coordinates.',
            cells: [
              { type: 'js', instruction: '### 1. The columns are the axes\nEach column of M is one of the crate\'s own axes, as long as its scale.', startCode: COLUMNS },
              { type: 'js', instruction: '### 2. Two ways to move 1\nPredict both positions first. World x adds (1, 0, 0); local x adds the unit x axis.', startCode: MOVE },
              { type: 'js', instruction: '### 3. Change of basis\nOffset, dot with each unit axis, divide by each scale. Then check by multiplying back.', startCode: BASIS },
              { type: 'js', instruction: '### 4. See both sets of axes\nGrey: the world\'s axes at the world origin. Red, green, blue: the crate\'s own unit axes at its origin. Pink: the point (3, 0.5, 2). Drag to turn the picture.', startCode: withPicture(AXES_PICTURE), showPreviewByDefault: true, outputHeight: 340 },
              { type: 'challenge', instruction: '### 5. Challenge: push it forward\nMove the crate 2 along its own z axis. The check says what your move does if it is wrong.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkMove },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Local and global axes" in MeshLab](#/lab/mesh-lab?project=local-and-global-axes). It builds the same crate and runs **Object › Trace the local axes** with **Record traces** on. The trace is in **Predict** mode: predict the unit x axis, then where the world point (3, 0.5, 2) is in the crate\'s coordinates. Compare with cells 1 and 3.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Local axes / World axes** (toolbar): what the move gizmo\'s arrows follow. Press **Move**, then drag an arrow.\n- The small red, green and blue lines on the selected object are its own axes.\n- **Object › Trace the local axes** traces the columns, the unit axes, the right-angle check and a change of basis.\n- In a script: object.traceAxes([x, y, z]) returns the unit axes, the scales and that world point in local coordinates.\n- **In Blender:** the Transform Orientation menu (Global, Local) sets the gizmo; after G, pressing X once moves along the global x and pressing X again switches to the local x.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Why the columns are the axes.** Write $e_x = (1, 0, 0)$, $e_y = (0, 1, 0)$, $e_z = (0, 0, 1)$ for the crate\'s own axes, with a fourth coordinate $0$ because they are directions, not points (lesson 2.2: the $0$ means the move does not apply). Multiplying $M$ by $e_x$ takes $1 \\times$ the first column and $0 \\times$ the others. So $M e_x = c_x$, and likewise $M e_y = c_y$, $M e_z = c_z$.',
      '**Why the length is the scale.** $M = T R S$, and the direction part is $R S$. $S e_z = 1.5 \\, e_z$, and a rotation keeps lengths (lesson 2.2). So $|c_z| = |R (1.5 \\, e_z)| = 1.5$, and $c_z / |c_z| = R e_z$: the unit axis is the rotation alone.',
      '**Why the dot products give the coordinates.** A local point $(q_1, q_2, q_3)$ lands at $p = o + q_1 c_x + q_2 c_y + q_3 c_z$. Subtract $o$ and dot with $\\hat{u}_x$. Because the unit axes are at right angles, $\\hat{u}_x \\cdot c_y = 0$ and $\\hat{u}_x \\cdot c_z = 0$ (lesson 2.1: perpendicular means dot product $0$). And $\\hat{u}_x \\cdot c_x = |c_x|$. So $\\hat{u}_x \\cdot (p - o) = q_1 |c_x|$, and $q_1 = \\hat{u}_x \\cdot (p - o) / |c_x|$.',
      '**When it fails.** The step "$\\hat{u}_x \\cdot c_z = 0$" needs right angles. If the axes are sheared, that term is not $0$, and the dot product mixes $q_3$ into $q_1$. The inverse matrix $M^{-1}$ undoes $M$ whatever its shape, so $M^{-1} p$ is always right (if $\\det M \\neq 0$, lesson 2.4).',
    ],
    equations: [
      { label: 'Columns are axes', latex: 'M e_x = c_x, \\quad M e_y = c_y, \\quad M e_z = c_z' },
      { label: 'Unit axis and scale', latex: '\\hat{u}_i = \\frac{c_i}{|c_i|}, \\qquad s_i = |c_i|' },
      { label: 'Move along a local axis', latex: 'o\' = o + d \\, \\hat{u}_i' },
      { label: 'Change of basis (axes at right angles)', latex: 'p_{\\text{local}, i} = \\frac{\\hat{u}_i \\cdot (p - o)}{|c_i|}' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** Let $M$ be an invertible affine $4 \\times 4$ matrix with linear part $A$ (its top-left $3 \\times 3$) and translation $o$. The columns $c_1, c_2, c_3$ of $A$ form a basis of $\\mathbb{R}^3$, and every world point $p$ has unique local coordinates $q = A^{-1}(p - o)$. If the columns are mutually orthogonal, $A^{-1} = D^{-2} A^{\\top}$ with $D = \\operatorname{diag}(|c_1|, |c_2|, |c_3|)$, which is exactly the dot-product formula. Without orthogonality only the general inverse is valid.',
      '**Invariant viewpoint.** A change of basis changes the coordinates of a point, never the point. $(3, 0.5, 2)$ in the world and $(1.732, 0, 0.667)$ in the crate name the same place. Distances and angles are invariant under the rotation part, so the unit axes stay orthonormal under any $T R$. Only the scale changes lengths, and only a shear changes angles.',
      '**Geometric picture.** The columns span a slanted, stretched grid. Local coordinates are how many steps along each grid direction reach $p$. With right angles, a step along one direction does not move you along another, so each coordinate is a separate projection. With shear, the grid cells are parallelograms, and projecting onto one edge overshoots, as in example 3.',
      '**Where this goes.** The view matrix of a camera is the inverse of the camera\'s world matrix: it changes every point into the camera\'s coordinates (lesson 3.1). Normals change by $(A^{-1})^{\\top}$, not $A$, so they stay perpendicular to surfaces under uneven scale (lesson 3.5). Tangent space for normal maps is another local frame (chapter 9), built from three axes and used through these same dot products.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-2-006-ex1',
      title: 'Read an axis and move along it',
      problem: 'A box at the origin is turned $90°$ about $y$, scale $1$. Its matrix has first column $(0, 0, -1)$. Move it $1$ along its own $x$.',
      steps: [
        { expression: 'c_x = (0, 0, -1)', annotation: 'Step 2: the first column is where the box\'s own x axis points.' },
        { expression: '|c_x| = \\sqrt{0^2 + 0^2 + (-1)^2} = 1', annotation: 'Step 3: its length is 1, so the scale along x is 1 and the column is already a unit axis.' },
        { expression: '\\hat{u}_x = (0, 0, -1)', annotation: 'Dividing by 1 changes nothing. This is the direction of the gizmo\'s red arrow in Local axes mode.' },
        { expression: 'o\' = (0, 0, 0) + 1 \\cdot (0, 0, -1) = (0, 0, -1)', annotation: 'Step 4: add the unit axis times the distance. The box moves along the world\'s −z, not along the world\'s x.' },
      ],
      conclusion: 'Moving 1 along the box\'s own x moves it to $(0, 0, -1)$; along the world\'s x it would go to $(1, 0, 0)$.',
    },
    {
      id: 'modelling-geometry-2-006-ex2',
      title: 'A world point in the crate\'s coordinates',
      problem: 'The crate has origin $o = (1, 0.5, 2)$, unit axes $(0.866, 0, -0.5)$, $(0, 1, 0)$, $(0.5, 0, 0.866)$ and scales $(1, 1, 1.5)$. Where is $p = (3, 0.5, 2)$ in its coordinates?',
      steps: [
        { expression: 'p - o = (2, 0, 0)', annotation: 'Step 5: the offset from the crate\'s origin.' },
        { expression: '\\hat{u}_x \\cdot \\hat{u}_z = 0.433 + 0 - 0.433 = 0', annotation: 'Step 6: check the right angles (and the same for the other two pairs). They are, so dot products will work.' },
        { expression: '\\hat{u}_x \\cdot (2, 0, 0) = 1.732, \\; \\hat{u}_y \\cdot (2, 0, 0) = 0, \\; \\hat{u}_z \\cdot (2, 0, 0) = 1', annotation: 'How far the offset reaches along each of the crate\'s directions, in world units.' },
        { expression: '(1.732 / 1, \\; 0 / 1, \\; 1 / 1.5) = (1.732, 0, 0.667)', annotation: 'Divide by each scale: the crate\'s mesh counts z in steps 1.5 long.' },
        { expression: 'M (1.732, 0, 0.667) = (3, 0.5, 2)', annotation: 'Multiply back to check: the same world point.' },
      ],
      conclusion: 'The point is at $(1.732, 0, 0.667)$ in the crate\'s coordinates: the same answer as cell 3 and MeshLab\'s trace.',
    },
    {
      id: 'modelling-geometry-2-006-ex3',
      title: 'Sheared axes: when dot products fail',
      problem: 'A child turned $45°$ about $y$ sits at the origin under a parent scaled $(3, 1, 1)$. Its world columns are $c_x = (2.121, 0, -0.707)$ and $c_z = (2.121, 0, 0.707)$. Find $p = (3, 0, 0)$ in its coordinates.',
      steps: [
        { expression: '|c_x| = |c_z| = 2.236, \\; \\hat{u}_x = (0.949, 0, -0.316), \\; \\hat{u}_z = (0.949, 0, 0.316)', annotation: 'Step 3: lengths and unit axes, as before.' },
        { expression: '\\hat{u}_x \\cdot \\hat{u}_z = 0.9 - 0.1 = 0.8 \\neq 0', annotation: 'Step 6: not at right angles. The axes are 36.87° apart, not 90°. The parent\'s uneven scale sheared them (lesson 2.3).' },
        { expression: '\\text{dot shortcut: } (1.273, 0, 1.273) \\quad \\text{(wrong)}', annotation: 'Using the dot products anyway gives this. Multiply back: 1.273 × c_x + 1.273 × c_z = (5.4, 0, 0), not (3, 0, 0).' },
        { expression: 'M = S_{\\text{parent}} R, \\quad M^{-1} p = R^{\\top} S^{-1} p = R^{\\top} (1, 0, 0) = (0.707, 0, 0.707)', annotation: 'Undo the parent\'s scale (divide x by 3), then undo the turn (the transpose of a rotation is its inverse).' },
        { expression: '0.707 \\, c_x + 0.707 \\, c_z = (3, 0, 0)', annotation: 'Multiply back: correct.' },
      ],
      conclusion: 'With sheared axes, only the inverse matrix gives $(0.707, 0, 0.707)$; the dot products give a point that is not even on the right spot.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-2-006-ch1',
      difficulty: 'easy',
      problem: 'In Local axes mode, an object\'s red gizmo arrow points along $(0, 0, -1)$. Its scale is $1$. Which way has it been turned about $y$? (Turning $\\theta$ about $y$ sends $(1, 0, 0)$ to $(\\cos\\theta, 0, -\\sin\\theta)$.)',
      walkthrough: [
        { expression: '(\\cos\\theta, 0, -\\sin\\theta) = (0, 0, -1)', annotation: 'The red arrow is the unit x axis, the rotated $(1, 0, 0)$. Match the two.' },
        { expression: '\\cos\\theta = 0, \\; \\sin\\theta = 1 \\Rightarrow \\theta = 90°', annotation: 'Cosine 0 and sine 1 happen only at 90°.' },
      ],
      answer: 'It has been turned 90° about y: reading an axis backwards gives the rotation.',
    },
    {
      id: 'modelling-geometry-2-006-ch2',
      difficulty: 'medium',
      problem: 'A game moves a car "forward" every frame with `position.z += speed`. When the car is turned $30°$ about $y$, it slides at an angle instead of driving straight. Name the error and give the correct line, in terms of the car\'s world matrix.',
      walkthrough: [
        { expression: '\\text{position.z += speed} \\;\\Rightarrow\\; \\text{moves along } (0, 0, 1)', annotation: 'Adding to z moves along the world\'s z, whatever way the car faces.' },
        { expression: '\\hat{u}_z = c_z / |c_z| = (0.5, 0, 0.866)', annotation: 'The car\'s own forward is its z column divided by its length.' },
        { expression: '\\text{position} \\mathrel{+}= \\text{speed} \\cdot \\hat{u}_z', annotation: 'Add the unit axis times the speed. Not the raw column: a scaled car would then go faster.' },
      ],
      answer: 'It moves along the world\'s z, not the car\'s. Add speed × (the car\'s z column divided by its length) to the position instead.',
    },
    {
      id: 'modelling-geometry-2-006-ch3',
      difficulty: 'hard',
      problem: 'An object at the origin is turned $90°$ about $y$ and scaled $(2, 1, 1)$. Find the world point $(0, 0, -4)$ in its coordinates, and check your answer.',
      walkthrough: [
        { expression: 'c_x = R (2, 0, 0) = (0, 0, -2), \\; c_y = (0, 1, 0), \\; c_z = R (0, 0, 1) = (1, 0, 0)', annotation: 'Each column is a scaled, turned own axis.' },
        { expression: '\\hat{u}_x = (0, 0, -1), \\; \\hat{u}_z = (1, 0, 0); \\; \\hat{u}_x \\cdot \\hat{u}_z = 0', annotation: 'Unit axes, at right angles: dot products are allowed.' },
        { expression: '\\hat{u}_x \\cdot (0, 0, -4) = 4, \\; \\hat{u}_y \\cdot p = 0, \\; \\hat{u}_z \\cdot p = 0', annotation: 'The offset is p itself, because the origin is (0, 0, 0).' },
        { expression: '(4 / 2, 0, 0) = (2, 0, 0)', annotation: 'Divide by the scales (2, 1, 1).' },
        { expression: '2 \\, c_x = (0, 0, -4) \\; \\checkmark', annotation: 'Multiply back.' },
      ],
      answer: 'The point is at (2, 0, 0) in the object\'s coordinates: two of its own x-units, each 2 long in the world.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'c_x, c_y, c_z', meaning: 'The first three columns of the world matrix: where the object\'s own x, y and z axes point in the world, each as long as the scale along it.' },
      { symbol: '|c|', meaning: 'A column\'s length: the scale along that axis.' },
      { symbol: '\\hat{u} = c / |c|', meaning: 'A unit axis: the column divided by its length, a direction 1 long. The gizmo draws these in Local axes mode.' },
      { symbol: 'o', meaning: 'The fourth column: where the object\'s origin is in the world.' },
      { symbol: 'p - o', meaning: 'The offset of a world point from the object\'s origin; dotting it with a unit axis measures how far along that axis it reaches.' },
      { symbol: 'M^{-1} p', meaning: 'The inverse matrix applied to a world point: its local coordinates, correct even when the axes are sheared.' },
    ],
    rulesOfThumb: [
      'To move "forward" for an object, use its own unit z (or whichever axis faces forward), never the world\'s z.',
      'Never use a raw column as a direction: divide by its length, or a scaled object moves too far.',
      'Before using dot products for local coordinates, check that the three dot products between the unit axes are 0.',
      'When in doubt, multiply back: M times the local point must give the world point.',
      'The green (y) arrow is the same in Local and World mode only when the object is turned about y alone.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-2-001', label: 'Vectors, dot and cross', note: 'Length of a vector, the dot product as a shadow length, and perpendicular meaning dot product 0.' },
      { lessonId: 'modelling-geometry-2-002', label: 'Translate, rotate, scale', note: 'M = T·R·S, and the fourth coordinate: 1 for points, 0 for directions.' },
      { lessonId: 'modelling-geometry-2-005', label: 'Hierarchies', note: 'A child\'s world matrix is parent\'s world × local: read the axes off that, not the local matrix.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-2-007', label: 'Euler angles and gimbal lock', note: 'Rotations about local versus global axes are the two ways to read an Euler order.' },
      { lessonId: 'modelling-geometry-3-001', label: 'Cameras', note: 'The view matrix is the inverse of the camera\'s world matrix: a change of basis into the camera\'s axes.' },
      { lessonId: 'modelling-geometry-4-004', label: 'Dragging with a gizmo', note: 'Dragging an arrow projects the mouse motion onto exactly the unit axis read here.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-2-006-1', label: 'Read why each column of M is one of the object\'s own axes', type: 'read' },
    { id: 'cp-modelling-geometry-2-006-2', label: 'Read the procedure for moving along a local axis', type: 'read' },
    { id: 'cp-modelling-geometry-2-006-3', label: 'Read why dot products need axes at right angles', type: 'read' },
    { id: 'cp-modelling-geometry-2-006-4', label: 'Run cells 1 to 4 and compare the two moves with your prediction', type: 'lab' },
    { id: 'cp-modelling-geometry-2-006-5', label: 'Run Object › Trace the local axes in MeshLab in Predict mode', type: 'lab' },
    { id: 'cp-modelling-geometry-2-006-6', label: 'Work through example 2, the crate\'s change of basis', type: 'example' },
    { id: 'cp-modelling-geometry-2-006-7', label: 'Work through example 3, the sheared axes', type: 'example' },
    { id: 'cp-modelling-geometry-2-006-8', label: 'Complete the challenge: push the crate 2 along its own z', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-2-006-assess-1',
        type: 'choice',
        text: 'An object\'s world matrix has third column $(0, 0, 3)$. What is its unit z axis, and its scale along z?',
        options: ['(0, 0, 1), scale 3', '(0, 0, 3), scale 1', '(0, 0, 1), scale 1', '(0, 0, 0.333), scale 3'],
        answer: '(0, 0, 1), scale 3',
        hint: 'The length of the column is the scale; dividing the column by it leaves the direction.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-2-006-quiz-1',
      type: 'choice',
      text: 'Which part of an object\'s world matrix tells you where its own x axis points?',
      options: ['The first column', 'The first row', 'The fourth column', 'The diagonal'],
      answer: 'The first column',
      hints: ['M times (1, 0, 0) picks out one part of M.', 'Multiplying by a unit vector keeps exactly one column.'],
      reviewSection: 'Intuition: the first paragraph, and the math section "Why the columns are the axes"',
    },
    {
      id: 'modelling-geometry-2-006-quiz-2',
      type: 'choice',
      text: 'A crate at (1, 0.5, 2) is turned 30° about y. You drag it 1 along its own x. Where does it go?',
      options: ['(1.866, 0.5, 1.5)', '(2, 0.5, 2)', '(1.866, 0.5, 2.5)', '(1.5, 0.5, 2.866)'],
      answer: '(1.866, 0.5, 1.5)',
      hints: ['Its own x axis is (cos 30°, 0, −sin 30°).', 'Add (0.866, 0, −0.5) to the position.'],
      reviewSection: 'Intuition: the paragraph on the two ways to move, and cell 2',
    },
    {
      id: 'modelling-geometry-2-006-quiz-3',
      type: 'choice',
      text: 'The crate\'s z column is (0.75, 0, 1.299). To push it 2 along its own z, what do you add to its position?',
      options: ['(1, 0, 1.732)', '(1.5, 0, 2.598)', '(0, 0, 2)', '(0.75, 0, 1.299)'],
      answer: '(1, 0, 1.732)',
      hints: ['The column is 1.5 long. A direction must be 1 long.', 'Divide by 1.5, then multiply by 2.'],
      reviewSection: 'Callout "Divide by the length before you use a column as a direction"',
    },
    {
      id: 'modelling-geometry-2-006-quiz-4',
      type: 'choice',
      text: 'In which case can you NOT get local coordinates by dotting the offset with the unit axes?',
      options: ['A child turned 45° under a parent scaled (3, 1, 1)', 'An object turned 30° about y', 'An object scaled (2, 1, 1.5) and turned 60°', 'An object moved to (5, 0, 0) and not turned'],
      answer: 'A child turned 45° under a parent scaled (3, 1, 1)',
      hints: ['Dot products need the unit axes at right angles.', 'An uneven scale above a turn shears the axes (lesson 2.3).'],
      reviewSection: 'Callout "Dot products only work on axes at right angles", and example 3',
    },
    {
      id: 'modelling-geometry-2-006-quiz-5',
      type: 'choice',
      text: 'An object at (0, 0, 0) with unit axes at right angles and scales (2, 1, 1) has unit x axis (1, 0, 0). Where is the world point (4, 0, 0) in its coordinates?',
      options: ['(2, 0, 0)', '(4, 0, 0)', '(8, 0, 0)', '(1, 0, 0)'],
      answer: '(2, 0, 0)',
      hints: ['The dot product gives 4 world units along x.', 'Each of the object\'s x-units is 2 long in the world.'],
      reviewSection: 'Procedure step 6, and example 2',
    },
    {
      id: 'modelling-geometry-2-006-quiz-6',
      type: 'choice',
      text: 'An object is turned 90° about y. In which gizmo mode does the green arrow point the same way?',
      options: ['Both: local y and world y are both (0, 1, 0)', 'Only in World axes mode', 'Only in Local axes mode', 'Neither: a turn moves every axis'],
      answer: 'Both: local y and world y are both (0, 1, 0)',
      hints: ['A turn about y leaves the y axis where it is.', 'Which column does the turn not change?'],
      reviewSection: 'Callout "What the picture shows (cell 4)"',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'An object\'s local axes are the world axes, moved to the object\'s origin.',
      whyStudentsThinkIt: 'For an object that is only moved, they are, and most objects start unturned.',
      correctionExample: 'The crate turned 30° about y has local x along (0.866, 0, −0.5), not (1, 0, 0): dragging 1 along it ends at (1.866, 0.5, 1.5), not (2, 0.5, 2).',
      contrastCase: 'A box that is only moved to (5, 0, 0): its columns are (1, 0, 0), (0, 1, 0), (0, 0, 1), and local and world moves agree.',
    },
    {
      falseBelief: 'A column of the matrix is a direction you can use as it is.',
      whyStudentsThinkIt: 'For an unscaled object every column is already 1 long, so it works until something is scaled.',
      correctionExample: 'The crate\'s z column (0.75, 0, 1.299) is 1.5 long. Twice it moves the crate 3, not 2.',
      contrastCase: 'An unscaled turned object: its z column is already a unit vector, so the mistake hides.',
    },
    {
      falseBelief: 'Dot products with the unit axes always give local coordinates.',
      whyStudentsThinkIt: 'It works for every rotation and scale of a single object, the common case.',
      correctionExample: 'The sheared child of example 3: the dot products give (1.273, 0, 1.273), which multiplies back to (5.4, 0, 0) instead of (3, 0, 0).',
      contrastCase: 'The crate: its unit axes are at right angles, and the dot products give the right (1.732, 0, 0.667).',
    },
  ],

  transferPrompts: [
    {
      situation: 'A camera flies "forward" through a scene at 5 m/s, wherever it is pointing.',
      competingTechniques: ['Add 5 × dt to its z position', 'Add 5 × dt × its unit view axis (minus its z column, divided by its length)'],
      whyThisTechniqueWins: 'Its own view axis is read from its matrix and follows every turn; adding to z ignores where the camera faces. A camera looks along its own −z.',
    },
    {
      situation: 'You need to know whether a point is in front of or behind a character, who is turned and scaled.',
      competingTechniques: ['Compare the point\'s world z with the character\'s world z', 'Dot the offset (point − origin) with the character\'s unit forward axis and check the sign', 'Invert the whole matrix'],
      whyThisTechniqueWins: 'Only the sign of one local coordinate matters, and one dot product gives it. Comparing world z is wrong once the character turns; a full inverse works but does more than needed.',
    },
  ],

  debugging: [
    {
      commonError: 'Moving along a local axis with the raw matrix column.',
      symptom: 'The object moves the right way but too far, by exactly its scale along that axis.',
      whyItHappened: 'Each column is as long as the scale along it; only a unit vector is a pure direction.',
      repairStrategy: 'Divide the column by its length before multiplying by the distance; check that Math.hypot of the move equals the distance you asked for.',
    },
    {
      commonError: 'Reading the axes from the local matrix of a child.',
      symptom: 'The gizmo or your "forward" points the right way only while the parent is unturned.',
      whyItHappened: 'The local matrix holds the axes in the parent\'s frame. The world axes come from the world matrix, parent\'s world × local (lesson 2.5).',
      repairStrategy: 'Take the columns of scene.worldMatrix(o), not of o\'s own position, rotation and scale; MeshLab\'s Trace the local axes does this.',
    },
    {
      commonError: 'Using dot products for local coordinates under an unevenly scaled parent.',
      symptom: 'Multiplying the local point back by M does not give the world point.',
      whyItHappened: 'The parent\'s uneven scale shears the child\'s axes, so they are not at right angles.',
      repairStrategy: 'Check the three dot products between the unit axes; if any is not 0, use the inverse matrix (Matrix4.invert in three.js).',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Read an object\'s unit axes and scales off its world matrix, move it a given distance along one of them, and change a world point into its coordinates.',
    explainVerbally: 'Explain why the columns of the matrix are the object\'s axes, and why the dot-product shortcut needs them at right angles.',
    detectIncorrectApplication: 'Recognise when a column has not been divided by its length, or when the axes are sheared and only the inverse will do.',
    transferToUnfamiliar: 'Move a camera along its own view direction, or decide whether a point is in front of a turned character, from their matrices.',
  },
};
