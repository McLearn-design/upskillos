// Lesson 3.1: cameras. A camera is an object like any other; looking at a point builds its axes from cross
// products, and its view matrix is the inverse of its world matrix, which moves the world into camera space.
import { withPicture } from '../notebookScene.js';

// Vectors, and the camera of the whole lesson: at (4, 3, 5), looking at the box's centre (0, 0.5, 0).
const VEC = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(3)
const f = (v) => v.map(r).join(', ')
const sub = (a, b) => a.map((x, i) => x - b[i])
const add = (a, b) => a.map((x, i) => x + b[i])
const scale = (a, k) => a.map((x) => x * k)
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (a) => scale(a, 1 / Math.hypot(...a))

// Look-at: forward towards the target; right is forward × world up; up is right × forward.
function lookAt(eye, target) {
  const forward = unit(sub(target, eye))
  const right = unit(cross(forward, [0, 1, 0]))
  const up = cross(right, forward)
  return { eye, right, up, back: scale(forward, -1), forward }
}
const cam = lookAt([4, 3, 5], [0, 0.5, 0])
`;

const LOOK = `${VEC}
console.log('forward ' + f(cam.forward))
console.log('right ' + f(cam.right))
console.log('up ' + f(cam.up))
console.log('right · up = ' + r(dot(cam.right, cam.up)) + ', right · forward = ' + r(dot(cam.right, cam.forward)) + ', up · forward = ' + r(dot(cam.up, cam.forward)))`;

const VIEW = `${VEC}
// The view matrix: rows are the camera's right, up and back axes; the last column is minus each axis · eye.
const view = [cam.right, cam.up, cam.back].map((axis) => [...axis, -dot(axis, cam.eye)])
view.forEach((row, i) => console.log('row ' + (i + 1) + ': ' + f(row)))
// A world point in camera space: x right, y up, z back towards the viewer.
const toCamera = (p) => view.map((row) => dot(row, p) + row[3])
for (const p of [[0, 0.5, 0], [0, 0, 0], [0, 0, 10]]) {
  const c = toCamera(p)
  console.log('(' + f(p) + ') → (' + f(c) + ')' + (c[2] < 0 ? ', ' + r(-c[2]) + ' in front' : ', behind the camera'))
}`;

const MOVES = `${VEC}
const target = [0, 0.5, 0]
// Orbit: turn the eye 90° about the vertical line through the target.
const d = sub(cam.eye, target), a = Math.PI / 2
const orbit = add(target, [d[0] * Math.cos(a) + d[2] * Math.sin(a), d[1], -d[0] * Math.sin(a) + d[2] * Math.cos(a)])
console.log('orbit 90°: eye ' + f(orbit) + ', still ' + r(Math.hypot(...sub(orbit, target))) + ' from the target')
// Pan: move the eye and the target together, 1 along the camera's right.
console.log('pan 1 right: eye ' + f(add(cam.eye, cam.right)) + ', target ' + f(add(target, cam.right)))
// Zoom (dolly): move the eye halfway to the target along the line of sight.
console.log('zoom in to half: eye ' + f(add(target, scale(d, 0.5))) + ', ' + r(Math.hypot(...d) / 2) + ' from the target')`;

const PICTURE_CODE = `${VEC}
// Camera space to world: the camera's world matrix has right, up, back as columns and the eye as its origin.
const toWorld = (p) => add(cam.eye, add(scale(cam.right, p[0]), add(scale(cam.up, p[1]), scale(cam.back, p[2]))))
const verts = [], faces = [], groups = []
function box(map, lo, hi, group) {
  const k = verts.length
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) verts.push(map([x, y, z]))
  for (const q of [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]) { faces.push(q.map((i) => i + k)); groups.push(group) }
}
box((p) => p, [-0.5, 0, -0.5], [0.5, 1, 0.5], 0)                 // the box (blue)
// The camera's pyramid: the eye, and the image rectangle 1.5 in front (field of view 50°, 16:9).
const h = 1.5 * Math.tan(25 * Math.PI / 180), w = h * 16 / 9, k = verts.length
verts.push(cam.eye, ...[[-w, -h, -1.5], [w, -h, -1.5], [w, h, -1.5], [-w, h, -1.5]].map(toWorld))
faces.push([k, k + 2, k + 1], [k, k + 3, k + 2], [k, k + 4, k + 3], [k, k + 1, k + 4], [k + 1, k + 2, k + 3, k + 4]); groups.push(1, 1, 1, 1, 1)
// The line of sight: down the camera's −z axis to the target.
const along = Math.hypot(...sub([0, 0.5, 0], cam.eye))
box(toWorld, [-0.05, -0.05, -along], [0.05, 0.05, 0], 4)        // (red)
console.log('the camera (amber) is ' + r(along) + ' from the box, looking straight down its own −z axis (red)')
show({ verts, faces, groups })`;

const CHALLENGE = `// Frame selected: the box below fills the view of a camera with a 50° field of view.
// Its bounding sphere has the box's centre and half its diagonal as radius.
// MeshLab keeps a 10% margin: it multiplies the distance by 1.1.
const lo = [-1, 0, -1], hi = [1, 2, 1], fov = 50
// How far from the box's centre must the camera stand?
const distance = 0

console.log('stand ' + distance + ' from the centre')`;

const SOLVED = CHALLENGE.replace('const distance = 0', 'const distance = Math.hypot(2, 2, 2) / 2 / Math.sin(fov / 2 * Math.PI / 180) * 1.1');

const RADIUS = Math.sqrt(12) / 2;
const RIGHT = RADIUS / Math.sin(25 * Math.PI / 180) * 1.1;

/** The challenge's check: read the distance (a number, or arithmetic with Math, lo, hi and fov) and name what went wrong. */
export function checkFraming(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+distance\s*=\s*([^\n]+)/);
  if (!m) return no('Keep the line const distance = …');
  // Evaluate the right-hand side with only Math and the three givens in scope.
  const expr = m[1].trim();
  if (!/^[\w\s.+\-*/(),[\]]*$/.test(expr) || /\b(?!Math\b|PI\b|sin\b|cos\b|tan\b|asin\b|atan\b|hypot\b|sqrt\b|lo\b|hi\b|fov\b)[A-Za-z_]\w*/.test(expr)) return no('Write the distance as a number, or arithmetic using Math, lo, hi and fov.');
  let d;
  try { d = Function('Math', 'lo', 'hi', 'fov', `"use strict"; return (${expr});`)(Math, [-1, 0, -1], [1, 2, 1], 50); } catch { return no('The distance could not be worked out: check the brackets.'); }
  if (typeof d !== 'number' || !Number.isFinite(d)) return no('The distance should come out as a number.');
  const near = (x) => Math.abs(d - x) < 0.01;
  if (near(RIGHT)) return { pass: true, message: `${+d.toFixed(3)}: the radius ${+RADIUS.toFixed(3)} over sin 25° is ${+(RADIUS / Math.sin(25 * Math.PI / 180)).toFixed(3)}, where the edge of the view just touches the sphere, and 10% more for the margin. The same sum as MeshLab's Frame selected.` };
  if (d === 0) return no('Work out the distance: the radius, the half field of view, and the margin.');
  if (d < 0) return no(`${+d.toFixed(3)} is negative: Math.sin takes radians, so 25 must be turned into 25 × π / 180 first.`);
  if (near(RADIUS / Math.tan(25 * Math.PI / 180) * 1.1)) return no(`${+d.toFixed(3)} uses tan. The edge of the view touches the sphere, so the radius meets the line of sight at a right angle at the sphere's edge, not at the centre: the radius is opposite the half angle and the distance is the hypotenuse. That is sin.`);
  if (near(RADIUS / Math.sin(25 * Math.PI / 180))) return no(`${+d.toFixed(3)} is the distance at which the sphere just touches the edges. MeshLab stands 10% further back: multiply by 1.1.`);
  if (near(RADIUS / Math.sin(50 * Math.PI / 180) * 1.1)) return no(`${+d.toFixed(3)} uses all 50°. The half angle, from the line of sight to one edge, is 25°.`);
  if (near(2 * RIGHT)) return no(`${+d.toFixed(3)} is twice too far: the radius is half the box's diagonal, ${+RADIUS.toFixed(3)}, not the whole diagonal.`);
  const edge = d > RADIUS ? Math.asin(RADIUS / d) * 180 / Math.PI : 90;
  return no(`At ${+d.toFixed(3)} the sphere's edge is ${+edge.toFixed(1)}° from the line of sight; the view's edge is at 25°, and MeshLab stands 10% further back than where they meet.`);
}

export default {
  id: 'modelling-geometry-3-001',
  slug: 'cameras',
  chapter: 'modelling-geometry',
  order: 1,
  title: 'Cameras',
  subtitle: 'Aim a camera with cross products, and move the whole world in front of it with the inverse of its matrix.',
  tags: ['camera', 'view matrix', 'look-at', 'camera space', 'orbit'],
  coreConcept: 'A camera is an object whose −z axis is its line of sight; look-at builds its right and up axes by cross products, and its view matrix is the inverse of its world matrix, carrying every world point into camera space, where in front means z < 0.',
  prerequisites: ['modelling-geometry-2-001', 'modelling-geometry-2-005', 'modelling-geometry-2-006'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-3-002',

  hook: {
    question: 'When you orbit round a model, does the camera move or does the world move? For the GPU, the answer is: the world.',
    realWorldContext: 'Every 3D view, from a modelling tool\'s viewport to a game\'s third-person camera, works the same way: place a camera, aim it, then move every vertex into the camera\'s own coordinates before drawing. Orbit, pan, zoom and "frame selected" are all small sums on the camera\'s position and axes.',
  },

  intuition: {
    prose: [
      'Put a camera at $(4, 3, 5)$ and aim it at the centre of a box, $(0, 0.5, 0)$. A camera is an object like any other, with a position and three axes. By convention it looks down its own $-z$ axis, with its $+y$ axis up and its $+x$ axis to the right.',
      'The position is the **eye**. The point it aims at is the **target**. The direction from eye to target, made one unit long, is **forward**: $(0 - 4, 0.5 - 3, 0 - 5) = (-4, -2.5, -5)$, which is $6.874$ long, so forward is $(-0.582, -0.364, -0.727)$.',
      'Forward alone does not fix the camera: it could still roll about that line. **Look-at** settles the roll by keeping the camera upright. The cross product (lesson 2.1) of forward and the world\'s up, $(0, 1, 0)$, is perpendicular to both: it points to the camera\'s **right**, $(0.781, 0, -0.625)$ once made unit length.',
      'Then the camera\'s own **up** is right × forward: $(-0.227, 0.932, -0.284)$. It tilts back a little, because the camera looks down at the box. The three axes are at right angles; cell 1 checks every dot product is $0$.',
      'These axes go into the camera\'s world matrix as columns (lesson 2.6): right, up, and **back** $= -$forward, with the eye as the fourth column. Before reading on, predict: to draw the box as this camera sees it, do we move the camera, or the box?',
      'We move the box, and everything else. The GPU always draws as if the eye were at the origin looking down $-z$. So every vertex is carried by the inverse of the camera\'s world matrix: the **view matrix** $V$. Its result is **camera space**: $x$ to the right, $y$ up, $z$ back towards the viewer.',
      'Because the axes are unit length and at right angles, the inverse is easy: the rows of $V$ are right, up and back, and its fourth column is minus each axis dotted with the eye. The box\'s centre lands at $(0, 0, -6.874)$: straight ahead ($x = y = 0$), $6.874$ in front. The point $(0, 0, 10)$ lands at $z = +0.218$: just behind the camera.',
      'Moving the viewport changes only the eye and the target. **Orbit** turns the eye round the target, keeping its distance. **Pan** moves eye and target together along the camera\'s right and up. **Zoom** (a dolly) moves the eye along the line of sight. After each, look-at rebuilds the axes, and $V$ follows.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Aim a camera and build its view matrix',
        body: 'Step 1. Take the eye $e$ and the target $t$.\nStep 2. Forward $f = (t - e) / |t - e|$.\nStep 3. Right $r = (f \\times (0, 1, 0)) / |f \\times (0, 1, 0)|$.\nStep 4. Up $u = r \\times f$; back $b = -f$.\nStep 5. The view matrix has rows $r$, $u$, $b$, and fourth column $(-r \\cdot e, \\; -u \\cdot e, \\; -b \\cdot e)$.\nStep 6. A world point $p$ goes to camera space $(r \\cdot (p - e), \\; u \\cdot (p - e), \\; b \\cdot (p - e))$; it is in front if the last number is negative.',
      },
      {
        type: 'warning',
        title: 'Looking straight up or down breaks look-at',
        body: 'If forward is parallel to the world\'s up, $f \\times (0, 1, 0) = (0, 0, 0)$ and there is no right axis to normalise. Tools nudge the up vector or keep the last good right axis. MeshLab\'s orbit (three.js OrbitControls) stops just short of straight up and straight down for this reason.',
      },
      {
        type: 'warning',
        title: 'In front is negative z',
        body: 'In camera space the camera looks down $-z$, so a point $5$ in front has $z = -5$. Testing "is it visible" with $z > 0$ gets every point backwards.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: camera space',
        body: 'The vertex shader receives each object\'s model matrix $M$ (lesson 2.2) and the camera\'s view matrix $V$, usually multiplied together as the model-view matrix $V M$. Every vertex is carried into camera space by it. Lesson 3.2\'s projection then squeezes camera space into the screen. Lighting is often computed in camera space too.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 4)',
        body: 'Misconception it contradicts: "a camera is a special thing with no transform". The amber pyramid is the camera: its tip is the eye, its open end is the image rectangle, drawn 1.5 in front, and the red line is its $-z$ axis, ending at the box\'s centre. Invariant: whatever the eye and target, the target is on the camera\'s $-z$ axis.',
      },
      { type: 'insight', title: 'Bridge: from the chain rule to code', body: 'lookAt() in the cells is Steps 2 to 4; view is Step 5, one row per axis; toCamera() is Step 6.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'The renderer computes $V$ once per frame from the camera, and sends $V M$ for each object. three.js calls $V$ camera.matrixWorldInverse.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Object › Trace the view matrix (camera) reads the selected camera\'s axes off its world matrix, builds $V$ and puts the first mesh\'s origin into camera space. Add › Camera places one; 0 looks through it; View › Frame selected moves the viewport\'s camera.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: look-at and the view matrix',
        caption: 'Aim the camera, build its view matrix, move it, and frame an object. Then do it in MeshLab.',
        props: {
          lesson: {
            title: 'Cameras',
            subtitle: 'Build a camera\'s axes by look-at, its view matrix as an inverse, and orbit, pan and zoom.',
            cells: [
              { type: 'js', instruction: '### 1. Look-at\nForward to the target; right from a cross product with world up; up from another. All three at right angles.', startCode: LOOK },
              { type: 'js', instruction: '### 2. The view matrix\nRows: right, up, back. Then three world points in camera space: in front means z < 0.', startCode: VIEW },
              { type: 'js', instruction: '### 3. Orbit, pan, zoom\nEach moves the eye (and pan the target too). Look-at then rebuilds the axes.', startCode: MOVES },
              { type: 'js', instruction: '### 4. See the camera\nThe amber pyramid is the camera: its tip is the eye. The red line is its −z axis, ending at the box. Drag to turn the picture.', startCode: withPicture(PICTURE_CODE), showPreviewByDefault: true, outputHeight: 340 },
              { type: 'challenge', instruction: '### 5. Challenge: frame selected\nHow far back must the camera stand so the box\'s bounding sphere fits its 50° view, with MeshLab\'s 10% margin? The check names any mistake.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkFraming },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Cameras" in MeshLab](#/lab/mesh-lab?project=cameras). The script aims a camera at a box with lookAt, then traces **Object › Trace the view matrix (camera)** with **Record traces** on. In **Predict** mode, predict which way it looks, then the box\'s centre in camera space. Compare with cells 1 and 2.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Viewport:** left-drag orbits, right-drag pans, the wheel zooms. View › **Frame selected** (.) and **Frame all** (Home) move the viewport\'s camera.\n- **Add › Camera** places a scene camera; **0** looks through it; **Ctrl+Alt+0** puts it where you are looking from.\n- **Object › Trace the view matrix (camera)** traces the selected camera\'s view matrix.\n- In a script: scene.add.camera({ position, lookAt }), camera.lookAt(point), camera.traceView(point).\n- **In Blender:** the middle mouse button orbits, Shift+middle pans, the wheel zooms; Numpad . frames the selection; Numpad 0 looks through the scene camera; Ctrl+Alt+Numpad 0 moves it to the view.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Why the axes are at right angles.** Right is a cross product with forward, so it is perpendicular to forward (lesson 2.1). Up is right × forward, so it is perpendicular to both. All three are unit length: right because we divided by its length, forward likewise, and up because it is the cross product of two perpendicular unit vectors, whose length is $1 \\cdot 1 \\cdot \\sin 90° = 1$.',
      '**Why the view matrix is the inverse.** The camera\'s world matrix $W$ sends camera-space $(0, 0, 0)$ to the eye and camera-space $(0, 0, -1)$ to one step forward. $V = W^{-1}$ sends them back: the eye to the origin, and forward to $-z$. So $V$ moves the world exactly as if the camera were at the origin looking down $-z$.',
      '**Why the rows are the axes.** $W = T R$, with $R$ having columns $r$, $u$, $b$. A rotation\'s inverse is its transpose, so $R^{-1}$ has rows $r$, $u$, $b$. $W^{-1} = R^{-1} T^{-1}$: first subtract the eye, then take the dot products with $r$, $u$, $b$ (lesson 2.6: dot products with unit axes at right angles give coordinates). That is the fourth column $-r \\cdot e$, $-u \\cdot e$, $-b \\cdot e$.',
      '**Why frame selected uses sine.** Fit a sphere of radius $\\rho$ in a view whose edges are at angle $\\theta / 2$ from the line of sight. At the closest distance, the edge of the view just touches the sphere. The touching radius is perpendicular to the edge line, so the right angle is at the sphere\'s surface. The distance $d$ from the eye to the centre is the hypotenuse, opposite the angle $\\theta / 2$ is $\\rho$, so $\\sin(\\theta / 2) = \\rho / d$.',
    ],
    equations: [
      { label: 'Look-at axes', latex: 'f = \\frac{t - e}{|t - e|}, \\quad r = \\frac{f \\times \\hat{y}}{|f \\times \\hat{y}|}, \\quad u = r \\times f, \\quad b = -f' },
      { label: 'View matrix', latex: 'V = W^{-1} = \\begin{pmatrix} r_x & r_y & r_z & -r \\cdot e \\\\ u_x & u_y & u_z & -u \\cdot e \\\\ b_x & b_y & b_z & -b \\cdot e \\\\ 0 & 0 & 0 & 1 \\end{pmatrix}' },
      { label: 'Frame selected', latex: 'd = \\frac{\\rho}{\\sin(\\theta / 2)} \\times 1.1' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** Let $W \\in SE(3)$ be a rigid transform (rotation $R$, translation $e$). Then $W^{-1}$ is the rigid transform with rotation $R^{\\top}$ and translation $-R^{\\top} e$. Look-at defines $R = [\\,r \\; u \\; b\\,]$ from $e$, $t$ and a reference up $\\hat{y}$, and is defined exactly when $t \\neq e$ and $t - e$ is not parallel to $\\hat{y}$.',
      '**Invariant viewpoint.** Moving the camera by a transform $A$ and moving the whole world by $A^{-1}$ give the same picture: $V$ changes from $W^{-1}$ to $(A W)^{-1} = W^{-1} A^{-1}$. Only the relative placement of camera and world is visible. Distances and angles between points are the same in world and camera space.',
      '**Geometric picture.** Camera space is the world seen in the camera\'s own frame: a change of basis (lesson 2.6) with the eye as origin and right, up, back as axes. Orbit moves the eye on a sphere round the target; pan slides the sphere; zoom shrinks it.',
      '**Where this goes.** Lesson 3.2 projects camera space onto the screen. Lesson 4.1 runs the camera backwards: a mouse click becomes a ray from the eye through the image, carried into the world by $W$. Lesson 3.7 puts a camera in the scene, renders a still from it, and builds look-at for an object with a parent.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-3-001-ex1',
      title: 'A camera on the z axis',
      problem: 'A camera at $e = (0, 0, 5)$ looks at the origin. Build its axes and put $p = (1, 2, 0)$ into camera space.',
      steps: [
        { expression: 'f = (0, 0, -5) / 5 = (0, 0, -1)', annotation: 'Step 2: forward, from the eye to the target, made unit length.' },
        { expression: 'r = (0, 0, -1) \\times (0, 1, 0) = (1, 0, 0)', annotation: 'Step 3: right is the world\'s x; already unit length.' },
        { expression: 'u = (1, 0, 0) \\times (0, 0, -1) = (0, 1, 0), \\quad b = (0, 0, 1)', annotation: 'Step 4: up is the world\'s y, back the world\'s z: the camera is not turned at all.' },
        { expression: 'p - e = (1, 2, -5) \\Rightarrow (1, 2, -5)', annotation: 'Step 6: dotting with axes (1,0,0), (0,1,0), (0,0,1) changes nothing. z = −5: 5 in front.' },
      ],
      conclusion: 'For an unturned camera, camera space is the world shifted by $-e$: $p$ lands at $(1, 2, -5)$.',
    },
    {
      id: 'modelling-geometry-3-001-ex2',
      title: 'The lesson\'s camera',
      problem: 'The camera at $(4, 3, 5)$ looks at $(0, 0.5, 0)$. Find the world origin in its camera space.',
      steps: [
        { expression: 'r = (0.7809, 0, -0.6247), \\; u = (-0.2272, 0.9315, -0.2840), \\; b = (0.5819, 0.3637, 0.7274)', annotation: 'Steps 2 to 4, from cell 1, to four places so the sums below come out to three.' },
        { expression: 'p - e = (0, 0, 0) - (4, 3, 5) = (-4, -3, -5)', annotation: 'Step 6: the offset from the eye.' },
        { expression: 'r \\cdot (p - e) = -3.1235 + 0 + 3.1235 = 0', annotation: 'Neither left nor right of the line of sight.' },
        { expression: 'u \\cdot (p - e) = 0.9088 - 2.7946 + 1.4200 = -0.466', annotation: 'A little below the centre of the view: the origin is 0.5 below the target.' },
        { expression: 'b \\cdot (p - e) = -2.3277 - 1.0911 - 3.6370 = -7.056', annotation: 'Negative: in front, 7.056 away.' },
      ],
      conclusion: 'The world origin is at $(0, -0.466, -7.056)$ in camera space, as cell 2 prints.',
    },
    {
      id: 'modelling-geometry-3-001-ex3',
      title: 'Orbit, then the view again',
      problem: 'Orbit the camera $90°$ about the vertical line through the target. Where is the eye, and where is the target in camera space now?',
      steps: [
        { expression: 'e - t = (4, 2.5, 5)', annotation: 'The eye relative to the target.' },
        { expression: '(4 \\cos 90° + 5 \\sin 90°, \\; 2.5, \\; -4 \\sin 90° + 5 \\cos 90°) = (5, 2.5, -4)', annotation: 'Turn about y by 90° (lesson 2.2): the height stays, x and z swap round.' },
        { expression: 'e\' = t + (5, 2.5, -4) = (5, 3, -4)', annotation: 'Back to world coordinates. Still 6.874 from the target.' },
        { expression: 'V\' t = (0, 0, -6.874)', annotation: 'Look-at aims the new axes at the target again, so it is still straight ahead at the same distance.' },
      ],
      conclusion: 'Orbiting moves the eye to $(5, 3, -4)$; the target stays at $(0, 0, -6.874)$ in camera space, because orbit keeps the distance and look-at keeps the aim.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-3-001-ch1',
      difficulty: 'easy',
      problem: 'In camera space, a point is at $(0.5, -1, 3)$. Can the camera see it?',
      walkthrough: [
        { expression: 'z = 3 > 0', annotation: 'The camera looks down −z; positive z is behind it.' },
      ],
      answer: 'No: its z is positive, so it is behind the camera, whatever its x and y.',
    },
    {
      id: 'modelling-geometry-3-001-ch2',
      difficulty: 'medium',
      problem: 'A camera at $(0, 10, 0)$ is told to look at the origin, straight down. Look-at returns NaN for every axis. Why, and what is a fix?',
      walkthrough: [
        { expression: 'f = (0, -1, 0)', annotation: 'Forward points straight down.' },
        { expression: 'f \\times (0, 1, 0) = (0, 0, 0)', annotation: 'Parallel vectors have a zero cross product: no right axis.' },
        { expression: '(0, 0, 0) / 0 = \\text{NaN}', annotation: 'Normalising divides by zero length.' },
        { expression: '\\text{use a different reference up, e.g. } (0, 0, -1)', annotation: 'Any up not parallel to forward gives a right axis; for a top view, the world\'s −z is a common choice.' },
      ],
      answer: 'Forward is parallel to the world\'s up, so their cross product is zero and cannot be normalised; use a different reference up, such as (0, 0, −1), when looking straight up or down.',
    },
    {
      id: 'modelling-geometry-3-001-ch3',
      difficulty: 'hard',
      problem: 'A camera is the child of a moving car: its local matrix is $L$, the car\'s world matrix is $C$. Write its view matrix, and say which to recompute each frame.',
      walkthrough: [
        { expression: 'W = C L', annotation: 'Lesson 2.5: the camera\'s world matrix is the parent\'s world times its local.' },
        { expression: 'V = W^{-1} = L^{-1} C^{-1}', annotation: 'The inverse of a product is the product of the inverses, in reverse order.' },
        { expression: '\\text{recompute } C^{-1} \\text{ each frame; } L^{-1} \\text{ only when the camera moves on the car}', annotation: 'The car moves every frame; the camera\'s mount does not.' },
      ],
      answer: 'The view matrix is V = (C L)⁻¹ = L⁻¹ C⁻¹; the car\'s inverse changes every frame, while L⁻¹ can be kept until the camera is moved on the car.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'e, \\; t', meaning: 'The eye (where the camera stands) and the target (the point it aims at).' },
      { symbol: 'f, \\; r, \\; u, \\; b', meaning: 'The camera\'s forward, right, up and back axes, unit length and at right angles; b = −f.' },
      { symbol: 'W', meaning: 'The camera\'s world matrix: columns r, u, b and the eye e.' },
      { symbol: 'V = W^{-1}', meaning: 'The view matrix: it carries every world point into camera space, as if the eye were at the origin looking down −z.' },
      { symbol: 'z < 0', meaning: 'In camera space, the test for "in front of the camera"; the distance in front is −z.' },
      { symbol: 'd = \\rho / \\sin(\\theta / 2)', meaning: 'The distance at which a sphere of radius ρ just fits a view of field θ; Frame selected adds 10%.' },
    ],
    rulesOfThumb: [
      'A camera looks down its own −z: in front is negative z.',
      'Never invert a camera matrix with a general inverse when it has no scale: use the transpose of the turn and minus the turned eye.',
      'If look-at gives NaN, forward is parallel to up: change the reference up.',
      'Orbit changes direction, pan changes position, zoom changes distance; the target is what orbit turns round.',
      'To frame a sphere, divide its radius by the sine of half the field of view.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-2-001', label: 'Vectors, dot and cross', note: 'The cross product is perpendicular to both inputs; it builds the camera\'s right and up axes.' },
      { lessonId: 'modelling-geometry-2-005', label: 'Hierarchies', note: 'A camera\'s world matrix is built like any object\'s, including from a parent.' },
      { lessonId: 'modelling-geometry-2-006', label: 'Local and global axes', note: 'Columns are axes, and dot products with unit axes give coordinates: the view matrix in one sentence.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-3-002', label: 'Projection', note: 'Camera space is the input to the projection matrix and the perspective divide.' },
      { lessonId: 'modelling-geometry-3-007', label: 'A camera you can place, and a still image', note: 'The camera becomes a scene object you render from.' },
      { lessonId: 'modelling-geometry-4-001', label: 'Picking by ray', note: 'A click is turned into a ray by running the camera backwards with W.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-3-001-1', label: 'Read how look-at builds right and up with cross products', type: 'read' },
    { id: 'cp-modelling-geometry-3-001-2', label: 'Read why the view matrix is the inverse of the camera\'s world matrix', type: 'read' },
    { id: 'cp-modelling-geometry-3-001-3', label: 'Read why frame selected divides by a sine', type: 'read' },
    { id: 'cp-modelling-geometry-3-001-4', label: 'Run cells 1 to 4 and find the point behind the camera', type: 'lab' },
    { id: 'cp-modelling-geometry-3-001-5', label: 'Run Object › Trace the view matrix in MeshLab in Predict mode, and look through the camera', type: 'lab' },
    { id: 'cp-modelling-geometry-3-001-6', label: 'Work through example 2, the world origin in camera space', type: 'example' },
    { id: 'cp-modelling-geometry-3-001-7', label: 'Work through example 3, orbit and the view again', type: 'example' },
    { id: 'cp-modelling-geometry-3-001-8', label: 'Complete the challenge: frame selected', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-3-001-assess-1',
        type: 'choice',
        text: 'A camera at (0, 0, 5) looks at the origin. Where is the world point (0, 0, 2) in its camera space?',
        options: ['(0, 0, -3)', '(0, 0, 3)', '(0, 0, 2)', '(0, 0, -7)'],
        answer: '(0, 0, -3)',
        hint: 'Subtract the eye: (0, 0, −3). The camera is unturned, so that is camera space; negative z is in front.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-3-001-quiz-1',
      type: 'choice',
      text: 'Which of a camera\'s own axes does it look along?',
      options: ['−z', '+z', '+x', '−y'],
      answer: '−z',
      hints: ['Its +y is up and its +x is right.', 'In front of the camera, z is negative.'],
      reviewSection: 'Intuition: the first paragraph',
    },
    {
      id: 'modelling-geometry-3-001-quiz-2',
      type: 'choice',
      text: 'Look-at has forward f. How does it get the camera\'s right axis?',
      options: ['f × (0, 1, 0), made unit length', 'f + (1, 0, 0)', '(0, 1, 0) − f', 'f · (0, 1, 0)'],
      answer: 'f × (0, 1, 0), made unit length',
      hints: ['It must be perpendicular to forward and to the world\'s up.', 'Which operation gives a vector perpendicular to two others?'],
      reviewSection: 'Procedure step 3',
    },
    {
      id: 'modelling-geometry-3-001-quiz-3',
      type: 'choice',
      text: 'What are the first three rows of a camera\'s view matrix (no scale)?',
      options: ['Its right, up and back axes', 'Its right, up and forward axes', 'The eye, three times', 'The world\'s x, y and z axes'],
      answer: 'Its right, up and back axes',
      hints: ['The view matrix undoes the turn; a turn\'s inverse is its transpose.', 'The camera\'s z axis points back, not forward.'],
      reviewSection: 'Math: "Why the rows are the axes"',
    },
    {
      id: 'modelling-geometry-3-001-quiz-4',
      type: 'choice',
      text: 'Which of these does NOT change the camera\'s distance to its target?',
      options: ['Orbit', 'Zoom (dolly)', 'Frame selected on a bigger object', 'Moving the eye along the line of sight'],
      answer: 'Orbit',
      hints: ['Orbit moves the eye round the target.', 'Zoom moves it along the line of sight.'],
      reviewSection: 'Intuition: the last paragraph, and cell 3',
    },
    {
      id: 'modelling-geometry-3-001-quiz-5',
      type: 'choice',
      text: 'A sphere of radius 2 must just fit a 60° field of view (no margin). How far is the eye from its centre?',
      options: ['4', '3.464', '2.309', '2'],
      answer: '4',
      hints: ['d = ρ / sin(θ / 2).', 'sin 30° = 0.5.'],
      reviewSection: 'Math: "Why frame selected uses sine"',
    },
    {
      id: 'modelling-geometry-3-001-quiz-6',
      type: 'choice',
      text: 'Look-at is asked to aim a camera standing at the origin at the point (0, 10, 0). What goes wrong?',
      options: ['Forward is parallel to world up, so right = f × up is zero', 'Nothing: it looks straight up', 'Forward has length zero', 'The view matrix has a negative determinant'],
      answer: 'Forward is parallel to world up, so right = f × up is zero',
      hints: ['Forward is (0, 1, 0).', 'What is the cross product of two parallel vectors?'],
      reviewSection: 'Warning "Looking straight up or down breaks look-at"',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'When the view orbits, the GPU moves a camera round a still world.',
      whyStudentsThinkIt: 'In the tool it looks and feels as if the camera moves.',
      correctionExample: 'The GPU always draws from the origin looking down −z; the view matrix moves the box\'s centre to (0, 0, −6.874) so it appears in front.',
      contrastCase: 'Moving the camera by A or the world by A⁻¹ gives the same picture: only the relative placement is visible.',
    },
    {
      falseBelief: 'A point with positive z in camera space is in front of the camera.',
      whyStudentsThinkIt: 'In world space, people often think of +z as "forward".',
      correctionExample: '(0, 0, 10) lands at z = +0.218 in this camera\'s space: just behind it, not in front.',
      contrastCase: 'The box\'s centre lands at z = −6.874: in front.',
    },
    {
      falseBelief: 'Forward alone fixes how a camera is turned.',
      whyStudentsThinkIt: 'A direction feels like a complete orientation.',
      correctionExample: 'The camera can still roll about the forward line; look-at chooses the roll that keeps right horizontal, (0.781, 0, −0.625).',
      contrastCase: 'An arrow or a laser, unlike a camera, has no up: for it, forward is enough.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A third-person game camera must follow a character, staying 4 m behind and 2 m above, always looking at the character\'s head.',
      competingTechniques: ['Copy the character\'s world matrix to the camera', 'Put the eye at head − 4 × character forward + (0, 2, 0) and use look-at towards the head'],
      whyThisTechniqueWins: 'Look-at keeps the camera upright and aimed at the head wherever the eye goes; copying the matrix would make the camera tilt and roll with every step the character takes.',
    },
    {
      situation: 'You must decide quickly whether each of 10,000 objects might be visible, before drawing anything.',
      competingTechniques: ['Draw everything and let the depth buffer sort it out', 'Put each object\'s bounding-sphere centre into camera space and skip it if z is more than its radius behind'],
      whyThisTechniqueWins: 'One dot product per object rejects everything behind the camera; drawing everything costs far more. (Lesson 3.2 adds the sides of the view.)',
    },
  ],

  debugging: [
    {
      commonError: 'Using forward instead of back as the third row of the view matrix.',
      symptom: 'Everything is mirrored front to back: objects in front vanish and objects behind appear.',
      whyItHappened: 'The camera\'s z axis points back; using forward flips the sign of every z.',
      repairStrategy: 'Use b = −f as the third row, and check that the target lands at negative z.',
    },
    {
      commonError: 'Crossing in the wrong order: up × forward instead of forward × up for right.',
      symptom: 'The image is mirrored left to right.',
      whyItHappened: 'The cross product changes sign when its inputs swap, so right points left.',
      repairStrategy: 'Check right · (1, 0, 0) for a camera looking down −z from +z: it must be +1.',
    },
    {
      commonError: 'Treating the view matrix as the camera\'s world matrix.',
      symptom: 'Moving the camera to the right makes the scene slide to the right too, as if dragged.',
      whyItHappened: 'The view matrix is the inverse; using W moves the world with the camera instead of against it.',
      repairStrategy: 'Compute V = W⁻¹ (rows r, u, b and −axis · eye), and test that the eye maps to the origin.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Build a camera\'s axes by look-at, its view matrix, and the camera-space coordinates of a point; compute a frame-selected distance.',
    explainVerbally: 'Explain why the view matrix is the inverse of the camera\'s world matrix, and why frame selected uses a sine.',
    detectIncorrectApplication: 'Spot a point behind the camera, a look-at that fails looking straight up, and a view matrix mirrored by a wrong row or cross order.',
    transferToUnfamiliar: 'Set up a follow camera, or reject objects behind the camera before drawing.',
  },
};
