// Lesson 2.7: Euler angles and gimbal lock. Three angles in a fixed order build a rotation matrix; decoding the
// matrix back is not unique, and at y = ±90° two of the three angles turn about the same axis.
import { withPicture } from '../notebookScene.js';

// 3×3 rotations about the world axes (angles in degrees), a product, and a matrix times a vector.
const ROT = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const deg = Math.PI / 180
function rot(axis, a) {
  const c = Math.cos(a * deg), s = Math.sin(a * deg)
  if (axis === 'x') return [[1, 0, 0], [0, c, -s], [0, s, c]]
  if (axis === 'y') return [[c, 0, s], [0, 1, 0], [-s, 0, c]]
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]]
}
const mul = (A, B) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]))
const apply = (A, v) => A.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2])
// XYZ order, as MeshLab and three.js use: R = Rx · Ry · Rz (turn about z first, then y, then x).
const euler = ([x, y, z]) => mul(mul(rot('x', x), rot('y', y)), rot('z', z))
`;

const BUILD = `${ROT}
const R = euler([30, 45, 60])
R.forEach((row, i) => console.log('XYZ row ' + (i + 1) + ': ' + row.map(r).join(', ')))
// The same three angles in the other order: Rz · Ry · Rx.
const other = mul(mul(rot('z', 60), rot('y', 45)), rot('x', 30))
console.log('ZYX row 1: ' + other[0].map(r).join(', '))`;

const DECODE = `${ROT}
// Read the angles back. Row 1, column 3 of Rx·Ry·Rz is sin y.
function decode(R) {
  const y = Math.asin(Math.max(-1, Math.min(1, R[0][2])))
  if (Math.abs(R[0][2]) < 0.9999999) {
    return [Math.atan2(-R[1][2], R[2][2]), y, Math.atan2(-R[0][1], R[0][0])].map((a) => r(a / deg))
  }
  // cos y = 0: x and z can't be told apart. Put it all in x, set z = 0.
  return [Math.atan2(R[2][1], R[1][1]), y, 0].map((a) => r(a / deg))
}
console.log('(30, 45, 60) decodes to ' + decode(euler([30, 45, 60])).join(', '))
console.log('(210, 135, 240) decodes to ' + decode(euler([210, 135, 240])).join(', '))
const same = (A, B) => A.every((row, i) => row.every((x, j) => Math.abs(x - B[i][j]) < 1e-9))
console.log('same matrix: ' + same(euler([30, 45, 60]), euler([210, 135, 240])))`;

const LOCK = `${ROT}
const same = (A, B) => A.every((row, i) => row.every((x, j) => Math.abs(x - B[i][j]) < 1e-9))
const f = (v) => v.map(r).join(', ')
// At y = 90°: three different-looking triples.
console.log('(20, 90, 10) = (30, 90, 0): ' + same(euler([20, 90, 10]), euler([30, 90, 0])) + ';  = (0, 90, 30): ' + same(euler([20, 90, 10]), euler([0, 90, 30])))
// The jet's nose is its own +z, its wing its own +x. Add 10° to x, or to z.
for (const [label, a] of [['start', [20, 90, 10]], ['x + 10', [30, 90, 10]], ['z + 10', [20, 90, 20]]]) {
  const R = euler(a)
  console.log(label + ': nose ' + f(apply(R, [0, 0, 1])) + '   wing ' + f(apply(R, [1, 0, 0])))
}
// Away from 90° the two fields do different things.
console.log('y = 45: x + 10 moves the nose to ' + f(apply(euler([30, 45, 10]), [0, 0, 1])) + '; z + 10 leaves it at ' + f(apply(euler([20, 45, 20]), [0, 0, 1])))`;

const GIMBAL = `${ROT}
const y = 90                 // change to 45 and run again
const x = 20, z = 10
const verts = [], faces = [], groups = []
// A ring: a band of 48 quads round the given axis, turned by A.
function ring(A, R, axis, group) {
  const k = verts.length, n = 48, h = 0.06
  for (let i = 0; i < n; i++) {
    const t = 2 * Math.PI * i / n, c = R * Math.cos(t), s = R * Math.sin(t)
    for (const w of [-h, h]) verts.push(apply(A, axis === 'x' ? [w, c, s] : axis === 'y' ? [c, w, s] : [c, s, w]))
  }
  for (let i = 0; i < n; i++) { const a = k + 2 * i, b = k + 2 * ((i + 1) % n); faces.push([a, b, b + 1, a + 1]); groups.push(group) }
}
function box(A, half, group) {
  const k = verts.length
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) verts.push(apply(A, [sx * half[0], sy * half[1], sz * half[2]]))
  for (const f of [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]) { faces.push(f.map((i) => i + k)); groups.push(group) }
}
const X = rot('x', x), XY = mul(X, rot('y', y)), XYZ = mul(XY, rot('z', z))
ring(X, 1.5, 'x', 4)          // the outer ring turns about x (red)
ring(XY, 1.3, 'y', 2)         // inside it, the y ring (green)
ring(XYZ, 1.1, 'z', 0)        // inside that, the z ring (blue)
box(XYZ, [0.12, 0.08, 0.55], 1)   // the jet's body, nose along its own z (amber)
box(XYZ, [0.6, 0.02, 0.15], 1)    // its wings, along its own x
// The outer ring's axis is (1, 0, 0); the inner ring's is XYZ times (0, 0, 1).
const zAxis = apply(XYZ, [0, 0, 1])
console.log('y = ' + y + '°: the X and Z rings\\' axes are ' + r(Math.acos(Math.min(1, Math.abs(zAxis[0]))) / deg) + '° apart')
show({ verts, faces, groups })`;

const CHALLENGE = `// Give two DIFFERENT sets of Euler angles (degrees, XYZ order) that make
// the same rotation as (20, 90, 10). The check builds both matrices.
const a = [20, 90, 10]
const b = [20, 90, 10]

const d = Math.PI / 180
const rx = (t) => [[1, 0, 0], [0, Math.cos(t), -Math.sin(t)], [0, Math.sin(t), Math.cos(t)]]
const ry = (t) => [[Math.cos(t), 0, Math.sin(t)], [0, 1, 0], [-Math.sin(t), 0, Math.cos(t)]]
const rz = (t) => [[Math.cos(t), -Math.sin(t), 0], [Math.sin(t), Math.cos(t), 0], [0, 0, 1]]
const mul = (A, B) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]))
const euler = ([x, y, z]) => mul(mul(rx(x * d), ry(y * d)), rz(z * d))
const target = euler([20, 90, 10])
const matches = (v) => euler(v).every((row, i) => row.every((x, j) => Math.abs(x - target[i][j]) < 1e-6))
console.log('a matches: ' + matches(a) + ', b matches: ' + matches(b))`;

const SOLVED = CHALLENGE.replace('const b = [20, 90, 10]', 'const b = [30, 90, 0]');

// The same maths as the cells, for the check.
const D = Math.PI / 180;
const rx = (t) => [[1, 0, 0], [0, Math.cos(t), -Math.sin(t)], [0, Math.sin(t), Math.cos(t)]];
const ry = (t) => [[Math.cos(t), 0, Math.sin(t)], [0, 1, 0], [-Math.sin(t), 0, Math.cos(t)]];
const rz = (t) => [[Math.cos(t), -Math.sin(t), 0], [Math.sin(t), Math.cos(t), 0], [0, 0, 1]];
const mul3 = (A, B) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
const eulerMatrix = ([x, y, z]) => mul3(mul3(rx(x * D), ry(y * D)), rz(z * D));
const TARGET = eulerMatrix([20, 90, 10]);
const sameMatrix = (A, B) => A.every((row, i) => row.every((x, j) => Math.abs(x - B[i][j]) < 1e-6));
const mod360 = (a) => ((a % 360) + 360) % 360;

/** The challenge's check: both triples must make (20, 90, 10)'s matrix, and differ as turns. */
export function checkTwins(code) {
  const no = (message) => ({ pass: false, message });
  const read = (name) => {
    const m = code.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[([^\\]]*)\\]`));
    const v = m ? m[1].split(',').map((x) => Number(x.trim())) : [];
    return v.length === 3 && v.every(Number.isFinite) ? v : null;
  };
  const a = read('a'), b = read('b');
  if (!a || !b) return no('Keep the lines const a = [x, y, z] and const b = [x, y, z], with three numbers each, in degrees.');
  for (const [name, v] of [['a', a], ['b', b]]) {
    if (sameMatrix(eulerMatrix(v), TARGET)) continue;
    const [x, y, z] = v;
    if (Math.abs(mod360(y) - 90) > 1e-6) return no(`${name} = (${v.join(', ')}) has y = ${y}°. Away from y = 90° the three angles turn about three different axes, and no other y gives this matrix here: keep y = 90.`);
    if (Math.abs(mod360(x - z) - 30) < 1e-6) return no(`${name} keeps x − z = 30°. At y = +90° it is x + z that counts (x − z is what counts at y = −90°): here x + z = ${x + z}°, not 30°.`);
    return no(`${name} = (${v.join(', ')}) has x + z = ${x + z}°. At y = 90° the matrix holds only x + z, and for (20, 90, 10) that is 30°.`);
  }
  if ([0, 1, 2].every((i) => Math.abs(mod360(a[i] - b[i])) < 1e-6 || Math.abs(mod360(a[i] - b[i]) - 360) < 1e-6)) return no('a and b are the same angles. Find a second set: at y = 90°, what can you trade between x and z without changing the matrix?');
  return { pass: true, message: `Both make the matrix of (20, 90, 10). At y = 90° only x + z = 30° is in the matrix, so x and z can trade degrees freely: (${a.join(', ')}) and (${b.join(', ')}) are one rotation. One of the three ways to turn has been lost: gimbal lock.` };
}

export default {
  id: 'modelling-geometry-2-007',
  slug: 'euler-angles-and-gimbal-lock',
  chapter: 'modelling-geometry',
  order: 7,
  title: 'Euler angles and gimbal lock',
  subtitle: 'Three angles in a fixed order make a rotation. Read them back from the matrix, and see where two of them become one.',
  tags: ['rotation', 'Euler angles', 'gimbal lock', 'rotation order', 'transforms'],
  coreConcept: 'Euler angles (x, y, z) build R = Rx·Ry·Rz in a fixed order; decoding y = asin(r13) and x, z by atan2 recovers them, except at y = ±90°, where the first and last turns share an axis and only their sum (or difference) survives.',
  prerequisites: ['modelling-geometry-2-002', 'modelling-geometry-2-003', 'modelling-geometry-2-006'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-2-008',

  hook: {
    question: 'An animator points a jet straight along the world\'s x axis by setting its Y rotation to 90°. Now the X field and the Z field both just roll it about its nose. Where did the third way to turn go?',
    realWorldContext: 'Every 3D tool shows rotation as three angles, because people can type and read them. Behind them is one matrix. At certain angles two of the fields do the same thing, the rotation curves in an animation flip, and an aircraft simulator loses a degree of freedom. The Apollo spacecraft\'s guidance platform had three gimbals, and its crews had to keep it away from the lock.',
  },

  intuition: {
    prose: [
      'Type $(30, 45, 60)$ into an object\'s Rotation fields. MeshLab turns it $60°$ about $z$, then $45°$ about $y$, then $30°$ about $x$, all about the world\'s axes. Lesson 2.3 showed order matters, so the order is part of the definition: these are **Euler angles** in **XYZ order**, and the rotation matrix is $R = R_x R_y R_z$.',
      'Multiply it out (cell 1) and the top row is $(0.3536, -0.6124, 0.7071)$. Put the same three angles in the other order, $R_z R_y R_x$, and the top row is $(0.3536, -0.5732, 0.7392)$: a different rotation. Three angles mean nothing until you know the order.',
      'Going back, from a matrix to angles, is **decoding**. Write $r_{ij}$ for the entry in row $i$, column $j$ of $R$. Multiplying out $R_x R_y R_z$ gives $r_{13} = \\sin y$, so $y = \\arcsin(r_{13})$: here $\\arcsin(0.7071) = 45°$.',
      'For $x$ and $z$: $r_{23} = -\\sin x \\cos y$ and $r_{33} = \\cos x \\cos y$. The two-argument arctangent $\\operatorname{atan2}(s, c)$ is the angle whose sine and cosine are in the ratio $s : c$, with the right quarter of the circle. So $x = \\operatorname{atan2}(-r_{23}, r_{33})$, because the $\\cos y$ cancels. In the same way $z = \\operatorname{atan2}(-r_{12}, r_{11})$. Cell 2 gets $(30, 45, 60)$ back.',
      'Decoding gives one answer, but other angles make the same matrix. $(210, 135, 240)$ is the same rotation as $(30, 45, 60)$ (cell 2 checks). Decoding always picks $y$ between $-90°$ and $90°$, so it returns $(30, 45, 60)$ for both.',
      'Before running cell 3, predict: the jet has Rotation $(20, 90, 10)$. You add $10°$ to $x$. Then, instead, you add $10°$ to $z$. Do the two changes turn the jet the same way or different ways?',
      'They turn it the same way. At $(20, 90, 10)$ the jet\'s nose points along $(1, 0, 0)$. Adding $10°$ to $x$ leaves the nose there and rolls the wing from $(0, 0.5, -0.866)$ to $(0, 0.643, -0.766)$. Adding $10°$ to $z$ does exactly the same.',
      'Here is why. The $z$ turn happens first, about the jet\'s own nose. Then $R_y$ at $90°$ swings that nose onto the world\'s $x$ axis. Then the $x$ turn spins about the world\'s $x$ axis: the line the nose now lies on. So the first and last turns are about the same line. This is **gimbal lock**.',
      'In lock, the matrix only holds $x + z$. $(20, 90, 10)$, $(30, 90, 0)$ and $(0, 90, 30)$ are all one rotation, and decoding returns $(30, 90, 0)$. At $y = -90°$ it holds $x - z$ instead. The jet can still turn every way. But one of the three fields has stopped adding a new direction.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Euler angles to a matrix and back (XYZ order)',
        body: 'Step 1. Build $R_x$, $R_y$, $R_z$ from the three angles.\nStep 2. Multiply in the order\'s order: $R = R_x R_y R_z$ (turn about $z$ first).\nStep 3. To decode, take $y = \\arcsin(r_{13})$.\nStep 4. If $|r_{13}| < 1$ (so $\\cos y \\neq 0$): $x = \\operatorname{atan2}(-r_{23}, r_{33})$ and $z = \\operatorname{atan2}(-r_{12}, r_{11})$.\nStep 5. If $|r_{13}| = 1$, it is gimbal lock: set $z = 0$ and $x = \\operatorname{atan2}(r_{32}, r_{22})$, which holds $x + z$ (or $x - z$ at $y = -90°$).\nStep 6. Check by building $R$ again from the decoded angles: it must match, even if the angles differ from the ones you started with.',
      },
      {
        type: 'warning',
        title: 'Decoded angles need not be the angles you typed',
        body: 'Decoding returns one of many triples for the same matrix: $y$ always between $-90°$ and $90°$, and $z = 0$ in lock. Compare rotations by their matrices, never by their angles. $(210, 135, 240)$ and $(30, 45, 60)$ are equal.',
      },
      {
        type: 'warning',
        title: 'Never animate through the lock by blending the three angles',
        body: 'Near $y = 90°$, a small change of the rotation can need a huge change of $x$ and $z$, because only their sum is fixed. Blending angles from key to key then swings the object round wildly. Chapter 10 blends quaternions instead (the euler-vs-slerp project shows both).',
      },
      {
        type: 'insight',
        title: 'The graphics strand: visible gimbal lock',
        body: 'The GPU only ever sees the final matrix, so lock is never a rendering bug. It shows up in the tool: dragging the X and Z fields rolls the object the same way, a rotate gizmo\'s outer and inner rings line up, and an animation\'s rotation curves suddenly jump by $180°$ where decoding switches branch.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "three angles always give three independent ways to turn". The red ring turns about $x$, the green about $y$ inside it, the blue about $z$ inside that. At $y = 90°$ the red and blue rings lie in one plane, so they spin about the same line. Change $y$ to $45$: they separate. Invariant: the rings\' nesting order, X outside Y outside Z, which is the XYZ order itself.',
      },
      { type: 'insight', title: 'Bridge: from the chain rule to code', body: 'euler([x, y, z]) in the cells is $R_x R_y R_z$; decode() is Steps 3 to 5, and its lock branch is the $|r_{13}| = 1$ case.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Only $R$ (inside the model matrix) goes to the GPU. Euler angles live in the inspector and the animation curves; they are turned into $R$ before anything is drawn.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Object › Trace the Euler angles builds $R_x R_y R_z$, decodes it and reports gimbal lock, step by step. MeshLab\'s Rotation fields are XYZ Euler angles in degrees.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: Euler angles and the lock',
        caption: 'Build the matrix, decode it, find the lock, and see the gimbal. Then do it in MeshLab.',
        props: {
          lesson: {
            title: 'Euler angles and gimbal lock',
            subtitle: 'Three angles in a fixed order: build the matrix, read the angles back, and find where two of them become one.',
            cells: [
              { type: 'js', instruction: '### 1. Angles to a matrix\nXYZ order means R = Rx · Ry · Rz. The same angles in ZYX order make a different matrix.', startCode: BUILD },
              { type: 'js', instruction: '### 2. A matrix back to angles\ny from asin of row 1, column 3; x and z from atan2. Two different triples, one matrix.', startCode: DECODE },
              { type: 'js', instruction: '### 3. Gimbal lock\nPredict first: at (20, 90, 10), do x + 10 and z + 10 turn the jet the same way?', startCode: LOCK },
              { type: 'js', instruction: '### 4. The gimbal\nRed turns about x, green about y inside it, blue about z inside that. At y = 90 the red and blue rings line up. Change y to 45 and run again. Drag to turn the picture.', startCode: withPicture(GIMBAL), showPreviewByDefault: true, outputHeight: 340 },
              { type: 'challenge', instruction: '### 5. Challenge: two names for one rotation\nGive two different sets of angles that both make the rotation (20, 90, 10). The check builds both matrices.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkTwins },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Euler angles and gimbal lock" in MeshLab](#/lab/mesh-lab?project=gimbal-lock). On the left, a gimbal of three nested rings carries a jet; on the right, a jet with Rotation (20, 90, 10). With **Record traces** on, **Object › Trace the Euler angles** builds Rx·Ry·Rz and decodes it. In **Predict** mode, predict the top-right entry (sin y), then the decoded angles. Compare with cell 2.' },
              { type: 'markdown', instruction: '### Use the tool\n- The Inspector\'s **Rotation °** fields are XYZ Euler angles in degrees: turn about z, then y, then x.\n- At Y = 90 (or −90), the X and Z fields do the same thing. Turn Y away from 90 to get three independent fields back.\n- **Object › Trace the Euler angles** traces the matrix, the decoding and the lock check. In a script: object.traceEuler().\n- For animation, blend rotations as quaternions, not angles: [the Euler vs quaternion project](#/lab/mesh-lab?project=euler-vs-slerp).\n- **In Blender:** the Rotation Mode menu in the Object properties chooses the order (XYZ Euler, ZXY Euler, …) or Quaternion. Changing the order changes which middle angle locks.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Why $r_{13} = \\sin y$.** Row 1 of $R_x$ is $(1, 0, 0)$, so row 1 of $R = R_x (R_y R_z)$ is row 1 of $R_y R_z$. Row 1 of $R_y$ is $(\\cos y, 0, \\sin y)$, and column 3 of $R_z$ is $(0, 0, 1)$. So $r_{13} = \\cos y \\cdot 0 + 0 \\cdot 0 + \\sin y \\cdot 1 = \\sin y$.',
      '**Why $x = \\operatorname{atan2}(-r_{23}, r_{33})$.** Column 3 of $R_y R_z$ is $(\\sin y, 0, \\cos y)$, because $R_z$ leaves the $z$ axis alone. $R_x$ turns it to $(\\sin y, -\\sin x \\cos y, \\cos x \\cos y)$: that is column 3 of $R$. So $-r_{23} : r_{33} = \\sin x : \\cos x$ when $\\cos y > 0$, and atan2 returns $x$. The same reasoning on row 1 gives $z$.',
      '**Why only $x + z$ survives at $y = 90°$.** $R_y(90°)$ sends the $z$ axis to the $x$ axis. So turning $z$ by $c$ first and then applying $R_y(90°)$ is the same as applying $R_y(90°)$ first and then turning about $x$ by $c$: $R_y(90°) R_z(c) = R_x(c) R_y(90°)$. Then $R_x(a) R_y(90°) R_z(c) = R_x(a) R_x(c) R_y(90°) = R_x(a + c) R_y(90°)$. Only $a + c$ is left.',
      '**Why decoding fails there.** At $\\cos y = 0$, $r_{23}$, $r_{33}$, $r_{12}$ and $r_{11}$ are all $0$, and $\\operatorname{atan2}(0, 0)$ has no answer. The sum $a + c$ is still in the matrix, in $r_{32}$ and $r_{22}$, which is what Step 5 reads.',
    ],
    equations: [
      { label: 'XYZ order', latex: 'R = R_x(x) \\, R_y(y) \\, R_z(z)' },
      { label: 'Decoding', latex: 'y = \\arcsin r_{13}, \\quad x = \\operatorname{atan2}(-r_{23}, r_{33}), \\quad z = \\operatorname{atan2}(-r_{12}, r_{11})' },
      { label: 'Gimbal lock at y = 90°', latex: 'R_x(a) \\, R_y(90°) \\, R_z(c) = R_x(a + c) \\, R_y(90°)' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** The map $E : (x, y, z) \\mapsto R_x(x) R_y(y) R_z(z)$ from $\\mathbb{R}^3$ onto the rotation group $SO(3)$ is smooth and onto, but not one-to-one. On $y \\in (-90°, 90°)$, $x, z \\in (-180°, 180°]$ it is one-to-one and has a smooth inverse (the decoding formulas). Where $\\cos y = 0$ its derivative has rank 2, not 3: two of the three partial derivatives point the same way. Those are the gimbal-lock points.',
      '**Invariant viewpoint.** The rotation, the matrix $R$, is the invariant object. The angles are coordinates on it, like latitude and longitude on a globe. At the poles of a globe every longitude names the same point. At $y = \\pm 90°$ every split of $x + z$ names the same rotation. Nothing physical is wrong there; the coordinates are.',
      '**Geometric picture.** The three gimbal rings are three axes. A gimbal can turn its contents in three independent directions while its axes span space. When the middle ring turns $90°$, the outer and inner axes coincide, and the three axes span only a plane: the contents can still be turned every way, but not by a small motion of the rings in that missing direction.',
      '**Where this goes.** No Euler order avoids this: each of the twelve orders locks when its middle angle reaches its singular value. More generally, no single three-number chart covers every rotation smoothly, because $SO(3)$ is compact and an open set of $\\mathbb{R}^3$ is not. Quaternions use four numbers with one constraint and have no lock. They are how animation blends rotations (chapter 10) and how the trackball and gizmo rotate objects (lesson 4.4).',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-2-007-ex1',
      title: 'Build and decode one turn',
      problem: 'Rotation $(90, 0, 0)$: build $R$ in XYZ order and decode it back.',
      steps: [
        { expression: 'R_y(0) = R_z(0) = I', annotation: 'Step 1: a turn of 0° is the identity, so only R_x matters.' },
        { expression: 'R = R_x(90°) = \\begin{pmatrix} 1 & 0 & 0 \\\\ 0 & 0 & -1 \\\\ 0 & 1 & 0 \\end{pmatrix}', annotation: 'Step 2: cos 90° = 0 and sin 90° = 1 in the y and z rows.' },
        { expression: 'y = \\arcsin(r_{13}) = \\arcsin(0) = 0°', annotation: 'Step 3: the top-right entry is 0.' },
        { expression: 'x = \\operatorname{atan2}(-r_{23}, r_{33}) = \\operatorname{atan2}(1, 0) = 90°', annotation: 'Step 4: sine 1, cosine 0 is 90°.' },
        { expression: 'z = \\operatorname{atan2}(-r_{12}, r_{11}) = \\operatorname{atan2}(0, 1) = 0°', annotation: 'Sine 0, cosine 1 is 0°.' },
      ],
      conclusion: 'Decoding gives back $(90, 0, 0)$: away from $y = \\pm 90°$, the angles come back as typed (within the ranges decoding uses).',
    },
    {
      id: 'modelling-geometry-2-007-ex2',
      title: 'Two triples, one rotation',
      problem: 'Show that $(210, 135, 240)$ makes the same matrix as $(30, 45, 60)$, and say which one decoding returns.',
      steps: [
        { expression: '\\sin 135° = \\sin 45° = 0.7071', annotation: 'Step 3 sees only r13 = sin y, and 135° and 45° have the same sine.' },
        { expression: '\\cos 135° = -0.7071 = -\\cos 45°', annotation: 'cos y flips sign; adding 180° to x and to z flips the signs of their sines and cosines too.' },
        { expression: 'r_{23} = -\\sin 210° \\cos 135° = -(-0.5)(-0.7071) = -0.3536', annotation: 'Two sign flips cancel: the same r23 as for (30, 45, 60).' },
        { expression: 'R(210, 135, 240) = R(30, 45, 60)', annotation: 'Cell 2 checks every entry.' },
        { expression: '\\text{decode} \\to (30, 45, 60)', annotation: 'arcsin returns y in [−90°, 90°], so decoding picks 45°, and then x and z follow.' },
      ],
      conclusion: 'One rotation, two names; decoding always returns the one with $y$ between $-90°$ and $90°$.',
    },
    {
      id: 'modelling-geometry-2-007-ex3',
      title: 'Decoding in the lock',
      problem: 'The matrix of $(20, 90, 10)$ has rows $(0, 0, 1)$, $(0.5, 0.866, 0)$, $(-0.866, 0.5, 0)$. Decode it.',
      steps: [
        { expression: 'r_{13} = 1 \\Rightarrow y = 90°', annotation: 'Step 3.' },
        { expression: 'r_{23} = r_{33} = r_{12} = r_{11} = 0', annotation: 'Step 4 would need atan2(0, 0): no answer. This is the lock.' },
        { expression: 'x = \\operatorname{atan2}(r_{32}, r_{22}) = \\operatorname{atan2}(0.5, 0.866) = 30°, \\; z = 0', annotation: 'Step 5: the sum x + z = 30° sits in rows 2 and 3, column 2.' },
        { expression: 'R(30, 90, 0) = R(20, 90, 10)', annotation: 'Step 6: rebuild and compare. Same matrix, different angles.' },
      ],
      conclusion: 'Decoding returns $(30, 90, 0)$: the $10°$ of $z$ has moved into $x$, because only $x + z$ is in the matrix.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-2-007-ch1',
      difficulty: 'easy',
      problem: 'A matrix has $r_{13} = -0.5$. What is $y$ in its XYZ Euler angles, as decoding returns it?',
      walkthrough: [
        { expression: 'y = \\arcsin(-0.5)', annotation: 'Step 3: the top-right entry is sin y.' },
        { expression: 'y = -30°', annotation: 'arcsin returns the angle between −90° and 90°.' },
      ],
      answer: 'y = −30°, since decoding takes arcsin of the top-right entry and arcsin returns −30° for −0.5.',
    },
    {
      id: 'modelling-geometry-2-007-ch2',
      difficulty: 'medium',
      problem: 'A rig\'s turret is turned $(0, -90, 0)$. A script adds $15°$ to its $x$ and $15°$ to its $z$, expecting two separate motions. What does the turret actually do?',
      walkthrough: [
        { expression: 'y = -90° \\Rightarrow \\text{only } x - z \\text{ counts}', annotation: 'At y = −90° the first and last turns share an axis, with opposite signs.' },
        { expression: 'x - z = 15° - 15° = 0°', annotation: 'The two changes cancel.' },
        { expression: 'R(15, -90, 15) = R(0, -90, 0)', annotation: 'The same matrix as before.' },
      ],
      answer: 'Nothing visible: at y = −90° only x − z is in the matrix, and the two 15° changes cancel, so the turret does not move.',
    },
    {
      id: 'modelling-geometry-2-007-ch3',
      difficulty: 'hard',
      problem: 'Two keys of an animation decode to $(170, 89, 0)$ and $(-170, 89, 0)$. Blending the angles halfway gives $(0, 89, 0)$. Is that halfway between the two rotations? Choose a better method.',
      walkthrough: [
        { expression: '170° \\text{ and } -170° \\text{ are } 20° \\text{ apart, not } 340°', annotation: 'Going from 170° to −170° the short way crosses 180°, not 0°.' },
        { expression: '\\text{halfway in angles: } x = 0° \\text{ turns the object almost } 180° \\text{ away}', annotation: 'Blending the numbers goes the long way round, through a rotation neither key is near.' },
        { expression: 'y = 89° \\text{ is next to the lock: } x \\text{ and } z \\text{ nearly share an axis}', annotation: 'Near the lock, small rotations need big angle changes, so angle blending is worst here.' },
        { expression: '\\text{blend the rotations: quaternion slerp}', annotation: 'Turn each key into a rotation and blend those (chapter 10): the shortest turn between them.' },
      ],
      answer: 'No: blending angles swings the object through x = 0°, nearly 180° from both keys. Blend the rotations themselves with quaternion slerp, which takes the 20° short way.',
    },
  ],

  semantics: {
    core: [
      { symbol: '(x, y, z)', meaning: 'Euler angles: three turns about the world\'s axes, applied in a fixed order. In XYZ order, z is applied first and x last.' },
      { symbol: 'R = R_x R_y R_z', meaning: 'The rotation matrix the three angles build in XYZ order; read right to left, it turns about z, then y, then x.' },
      { symbol: 'r_{ij}', meaning: 'The entry of R in row i, column j; decoding reads angles out of particular entries.' },
      { symbol: 'r_{13} = \\sin y', meaning: 'The top-right entry of R, which gives y directly by arcsin.' },
      { symbol: '\\operatorname{atan2}(s, c)', meaning: 'The angle whose sine and cosine are in the ratio s to c, in the right quarter of the circle; decoding uses it for x and z.' },
      { symbol: 'x + z', meaning: 'In gimbal lock at y = 90°, the only combination of x and z the matrix still holds.' },
    ],
    rulesOfThumb: [
      'Three angles mean nothing until you know the order: always say "XYZ" (or whichever).',
      'Compare rotations by their matrices, not their angles: many triples name one rotation.',
      'Keep the middle angle away from ±90° if the other two must stay independent: that is where the lock is.',
      'If decoded angles look strange, rebuild the matrix from them: it is usually the same rotation by another name.',
      'Never blend Euler angles through or near the lock; blend rotations (quaternions) instead.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-2-002', label: 'Translate, rotate, scale', note: 'The 3×3 rotation matrices about x, y and z, with cos and sin in their rows.' },
      { lessonId: 'modelling-geometry-2-003', label: 'Order matters', note: 'Rotations about different axes do not commute, which is why the Euler order is part of the definition.' },
      { lessonId: 'modelling-geometry-2-006', label: 'Local and global axes', note: 'Columns of R are the object\'s own axes; the jet\'s nose is R times (0, 0, 1).' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-2-008', label: 'Numbers you can type', note: 'The Rotation fields accept expressions such as 90/4, parsed before they become Euler angles.' },
      { lessonId: 'modelling-geometry-4-004', label: 'Dragging with a gizmo', note: 'The rotate gizmo\'s rings are a gimbal; dragging one composes a turn about that ring\'s axis.' },
      { lessonId: 'modelling-geometry-10-002', label: 'Interpolation', note: 'Blending rotations between keys: why slerp of quaternions replaces blending Euler angles.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-2-007-1', label: 'Read how XYZ order builds R = Rx·Ry·Rz', type: 'read' },
    { id: 'cp-modelling-geometry-2-007-2', label: 'Read the decoding procedure and its lock branch', type: 'read' },
    { id: 'cp-modelling-geometry-2-007-3', label: 'Read why only x + z survives at y = 90°', type: 'read' },
    { id: 'cp-modelling-geometry-2-007-4', label: 'Run cells 1 to 4, and change y to 45 in cell 4', type: 'lab' },
    { id: 'cp-modelling-geometry-2-007-5', label: 'Run Object › Trace the Euler angles in MeshLab in Predict mode', type: 'lab' },
    { id: 'cp-modelling-geometry-2-007-6', label: 'Work through example 2, two triples for one rotation', type: 'example' },
    { id: 'cp-modelling-geometry-2-007-7', label: 'Work through example 3, decoding in the lock', type: 'example' },
    { id: 'cp-modelling-geometry-2-007-8', label: 'Complete the challenge: two names for one rotation', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-2-007-assess-1',
        type: 'choice',
        text: 'In XYZ order, which Euler angles make the same rotation as (40, 90, 0)?',
        options: ['(10, 90, 30)', '(40, 90, 40)', '(0, 90, -40)', '(40, 0, 90)'],
        answer: '(10, 90, 30)',
        hint: 'At y = 90° only x + z counts, and 10 + 30 = 40.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-2-007-quiz-1',
      type: 'choice',
      text: 'In MeshLab\'s XYZ order, which turn is applied to the object first?',
      options: ['The z turn', 'The x turn', 'The y turn', 'All three at once'],
      answer: 'The z turn',
      hints: ['R = Rx·Ry·Rz acts on a vertex from the right.', 'The matrix nearest the vertex acts first.'],
      reviewSection: 'Intuition: the first paragraph, and the procedure step 2',
    },
    {
      id: 'modelling-geometry-2-007-quiz-2',
      type: 'choice',
      text: 'A rotation matrix in XYZ order has top-right entry r13 = 0.866. What is y?',
      options: ['60°', '30°', '−60°', '0.866°'],
      answer: '60°',
      hints: ['r13 = sin y.', 'Which angle between −90° and 90° has sine 0.866?'],
      reviewSection: 'Math: "Why r13 = sin y"',
    },
    {
      id: 'modelling-geometry-2-007-quiz-3',
      type: 'choice',
      text: 'An object is at Rotation (20, 90, 10). Which change leaves it exactly where it is?',
      options: ['x to 25 and z to 5', 'x to 25 and z to 15', 'y to 85', 'x to 10 and z to 20 and y to 80'],
      answer: 'x to 25 and z to 5',
      hints: ['At y = 90° only x + z counts.', 'Which option keeps x + z = 30 and y = 90?'],
      reviewSection: 'Intuition: the gimbal-lock paragraphs, and cell 3',
    },
    {
      id: 'modelling-geometry-2-007-quiz-4',
      type: 'choice',
      text: 'Which of these is NOT gimbal lock in XYZ order?',
      options: ['(30, 0, 90)', '(30, 90, 0)', '(0, -90, 45)', '(15, 90, 15)'],
      answer: '(30, 0, 90)',
      hints: ['In XYZ order the lock is about the middle angle.', 'Only y = ±90° locks; z = 90° does not.'],
      reviewSection: 'Callout "What the picture shows (cell 4)"',
    },
    {
      id: 'modelling-geometry-2-007-quiz-5',
      type: 'choice',
      text: 'You decode a rotation you built from (210, 135, 240). What does decoding return?',
      options: ['(30, 45, 60)', '(210, 135, 240)', '(−150, 135, −120)', 'It cannot be decoded'],
      answer: '(30, 45, 60)',
      hints: ['Decoding picks y between −90° and 90°.', 'sin 135° = sin 45°.'],
      reviewSection: 'Example 2, and the warning "Decoded angles need not be the angles you typed"',
    },
    {
      id: 'modelling-geometry-2-007-quiz-6',
      type: 'choice',
      text: 'At y = −90°, which combination of x and z is still in the matrix?',
      options: ['x − z', 'x + z', 'x × z', 'Neither: both are lost'],
      answer: 'x − z',
      hints: ['At y = +90° it is x + z.', 'R_y(−90°) sends z onto −x, so the z turn runs backwards.'],
      reviewSection: 'Intuition: the last paragraph, and the procedure step 5',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'Three Euler angles always give three independent ways to turn an object.',
      whyStudentsThinkIt: 'Away from y = ±90° they do, and that is where objects usually sit.',
      correctionExample: 'At (20, 90, 10), adding 10° to x and adding 10° to z both roll the wing from (0, 0.5, −0.866) to (0, 0.643, −0.766): the same motion.',
      contrastCase: 'At y = 45°, adding 10° to x moves the nose and adding 10° to z does not: two different motions.',
    },
    {
      falseBelief: 'If two sets of Euler angles are different, they are different rotations.',
      whyStudentsThinkIt: 'Two different sets of numbers usually mean two different things.',
      correctionExample: '(210, 135, 240) and (30, 45, 60) build exactly the same matrix.',
      contrastCase: '(30, 45, 60) and (30, 45, 61): a 1° change of z, which away from the lock always changes the rotation.',
    },
    {
      falseBelief: 'Gimbal lock means the object can no longer turn some way at all.',
      whyStudentsThinkIt: '"Lock" sounds like something is stuck.',
      correctionExample: 'At (20, 90, 10), changing y still moves the nose; and any rotation can still be reached by typing new angles. What is lost is one independent direction of small change from the three fields.',
      contrastCase: 'A real hinge that has hit its stop cannot turn further at all; a locked gimbal can, but not by its two lined-up rings.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A flight simulator stores the aircraft\'s attitude as heading, pitch and roll, and the plane can loop straight up through vertical.',
      competingTechniques: ['Store heading, pitch and roll and add to them each frame', 'Store a rotation matrix or quaternion and multiply in each frame\'s small turn'],
      whyThisTechniqueWins: 'Straight up is pitch = 90°: the lock, where heading and roll become one. Composing small rotations on a matrix or quaternion never passes through a singular point.',
    },
    {
      situation: 'You need to tell whether two imported objects are turned the same way; their files give Euler angles that differ.',
      competingTechniques: ['Compare the three angles one by one', 'Build both matrices and compare those'],
      whyThisTechniqueWins: 'Different angles can name one rotation (and one rotation has many angle triples), so only the matrices can be compared directly.',
    },
  ],

  debugging: [
    {
      commonError: 'Building R in the wrong order (Rz·Ry·Rx for an XYZ tool).',
      symptom: 'Objects match the tool when only one angle is non-zero, and turn differently once two are.',
      whyItHappened: 'With one turn the order does not matter; with two it does (lesson 2.3).',
      repairStrategy: 'Write the order next to the code (XYZ: R = Rx·Ry·Rz, z applied first) and test with two non-zero angles, such as (30, 45, 0).',
    },
    {
      commonError: 'Decoding with plain atan or acos instead of atan2 and asin.',
      symptom: 'Angles come back right in one quarter of the circle and off by 180° or with the wrong sign elsewhere.',
      whyItHappened: 'atan(s / c) loses the signs of s and c separately, so it cannot tell 30° from 210°.',
      repairStrategy: 'Use atan2(s, c) for x and z, and asin only for y; then rebuild R from the result and compare.',
    },
    {
      commonError: 'Dividing by cos y in the decoding with no lock check.',
      symptom: 'NaN or wildly jumping angles when the object points straight up or along x.',
      whyItHappened: 'At y = ±90°, cos y = 0, and the x and z formulas become 0 / 0.',
      repairStrategy: 'Test |r13| against a value just under 1 first, and use the lock branch (z = 0, x from r32 and r22) when it passes.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Build the XYZ rotation matrix from three angles, decode a matrix back to angles, and handle the lock branch.',
    explainVerbally: 'Explain why r13 = sin y, and why at y = 90° only x + z survives.',
    detectIncorrectApplication: 'Recognise when two angle triples are the same rotation, when an object is in or near gimbal lock, and when angle blending will misbehave.',
    transferToUnfamiliar: 'Choose matrices or quaternions over angles for a flight simulator or an animation that passes through vertical.',
  },
};
