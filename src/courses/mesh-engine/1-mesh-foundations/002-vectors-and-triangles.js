// Mesh Engine · Chapter 1 · Lesson 2
// Vectors and Triangle Geometry
//
// From first principles: the cross product is written out from the
// determinant before np.cross is allowed anywhere near it.
//
// Maths prerequisites are linked by real lesson id in spiral.recoveryPoints,
// and the "Where the linear algebra comes in" cell says how each one applies
// rather than just naming it.

const THREE_CDN =
  '<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"><\/script>';

const ORBIT = `
function orbit(camera, dom, radius) {
  var lon = 40, lat = 22, down = false, px = 0, py = 0;
  function place() {
    var a = lon * Math.PI / 180, b = lat * Math.PI / 180;
    camera.position.set(
      radius * Math.cos(b) * Math.sin(a),
      radius * Math.sin(b),
      radius * Math.cos(b) * Math.cos(a));
    camera.lookAt(0, 0, 0);
  }
  dom.addEventListener('pointerdown', function (e) { down = true; px = e.clientX; py = e.clientY; });
  window.addEventListener('pointerup', function () { down = false; });
  window.addEventListener('pointermove', function (e) {
    if (!down) return;
    lon -= (e.clientX - px) * 0.5;
    lat = Math.max(-85, Math.min(85, lat + (e.clientY - py) * 0.5));
    px = e.clientX; py = e.clientY;
    place();
  });
  place();
  return place;
}`;

const LESSON_MESH_1_2 = {
  title: 'Vectors and Triangle Geometry',
  subtitle: 'Which way does a triangle face, how big is it, and why those are the same calculation.',
  sequential: true,

  cells: [

    {
      type: 'markdown',
      instruction: `### Two questions about one triangle

Lesson 1 left a triangle on screen with a front and a back, and no way to say
which was which except by looking. Two questions now:

1. **Which way does it face?**
2. **How big is it?**

They sound unrelated. They are the same calculation, and getting one gives you
the other for free. That is not a trick — it falls out of what the operation
means — and it is the reason every later stage of this course weights things
the way it does.

First, the only two vector operations needed to answer them.`,
    },

    {
      type: 'markdown',
      instruction: `### A vector here is just "from one point to another"

A **point** is a place: \`[1, 2, 0]\`.

A **vector** is a move: "go 1 across, 2 up, 0 along". Same three numbers,
different meaning — and the difference matters, because adding two places is
nonsense while adding two moves is not.

**Subtracting two points gives the vector between them.** That is where every
vector in this course comes from:

\`\`\`
B = [1, 0, 0]        a corner
A = [0, 0, 0]        another corner

B - A = [1, 0, 0]    the edge from A to B, as a direction and a distance
\`\`\`

A triangle has corners **A, B, C**. Two of its edges, as vectors from A:

\`\`\`
u = B - A
v = C - A
\`\`\`

Those two vectors are all the input the rest of this lesson needs.

### Length

\`\`\`
|u| = sqrt(ux² + uy² + uz²)
\`\`\`

Pythagoras, in three dimensions instead of two. A right-angled triangle in the
x-y plane gives \`sqrt(x² + y²)\`; adding a third axis adds one more squared
term under the same root.

**A unit vector** is one whose length is 1 — a pure direction with the
distance divided out:

\`\`\`
û = u / |u|
\`\`\`

That is called **normalising**, and it is why a divide-by-zero guard keeps
turning up: a vector of length 0 has no direction to extract.`,
    },

    {
      type: 'markdown',
      instruction: `### Where the linear algebra comes in — and what to read

Nothing in this lesson needs a linear algebra course first. But three ideas here are the concrete, three-dimensional case of something more general, and the general version is worth having later.

**la1-001 — What is a Vector?**
The point-versus-vector distinction above, done properly. Read it if "a place and a move are different things" felt like an assertion rather than a reason.
Applies here: every edge in this lesson is a point subtraction.

**la2-003 — Inverse Matrices and Determinants**
The cross product is a determinant in disguise. Below, it is written out as one. A 2x2 determinant is the signed AREA of the parallelogram two vectors span, and a 3x3 is the signed VOLUME — which is exactly why the cross product's length comes out as an area.
Applies here: it is the reason "which way does it face" and "how big is it" are one calculation rather than two.

**la1-005 — Lines and Planes in 3D**
A triangle lies in a plane, and a plane is defined by a point on it plus a normal. Lesson 5 needs this to find the closest point on a triangle.
Applies there: the normal you compute here IS the plane's definition.

Read them when you want the general statement. The three-dimensional case is self-contained and comes first.`,
    },

    {
      type: 'markdown',
      instruction: `### The cross product, written out

Given two vectors \`u\` and \`v\`, the **cross product** \`u × v\` is a third
vector that is perpendicular to both.

There is one formula, and it is worth writing by hand once:

\`\`\`
u × v = [ uy*vz - uz*vy,
          uz*vx - ux*vz,
          ux*vy - uy*vx ]
\`\`\`

Three lines, and each one is a small determinant: take the two axes that are
*not* the one you are computing, cross-multiply them, and subtract.

\`\`\`
the x component ignores x, and uses y and z
the y component ignores y, and uses z and x      <- note the order
the z component ignores z, and uses x and y
\`\`\`

**The middle line's order is the classic mistake.** It is \`z,x\` not \`x,z\`.
Write it \`ux*vz - uz*vx\` and you get a vector pointing the wrong way, which
draws a part whose faces are all inside out.

### Predict, before the next cell

\`u = [1, 0, 0]\` (one step along x) and \`v = [0, 1, 0]\` (one step along y).

Work \`u × v\` through the formula by hand. Which axis does the answer point
along, and how long is it?`,
    },

    {
      type: 'js',
      instruction: `### The cross product, as a picture

\`u\` is red, \`v\` is green, and \`u × v\` is the blue arrow standing off the
surface. The grey parallelogram is what \`u\` and \`v\` span.

Three things to do:

1. **Change \`v\` so it points more along \`u\`.** The parallelogram squashes,
   and the blue arrow gets *shorter*. Make them identical and it vanishes —
   two parallel vectors span no area and define no plane.
2. **Swap \`u\` and \`v\`** in the \`cross\` call. The arrow flips to point the
   other way. Same plane, opposite side — that is the winding order from
   Lesson 1, and this is where it comes from.
3. **Break the middle line** on purpose: change \`u[2]*v[0] - u[0]*v[2]\` to
   \`u[0]*v[2] - u[2]*v[0]\`. The arrow stops being perpendicular. The readout
   checks it with a dot product and will say so.`,
      html: `${THREE_CDN}
<div id="app" style="width:100%;height:340px;background:#0a0f1e;border-radius:8px"></div>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:8px 2px;white-space:pre"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `var u = [1.0, 0.0, 0.0];
var v = [0.3, 1.0, 0.0];

// Written out, not imported. Each line ignores its own axis.
function cross(a, b) {
  return [
    a[1]*b[2] - a[2]*b[1],     // x : uses y and z
    a[2]*b[0] - a[0]*b[2],     // y : uses z and x  <- this order
    a[0]*b[1] - a[1]*b[0],     // z : uses x and y
  ];
}
function dot(a, b)   { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function length(a)   { return Math.sqrt(dot(a, a)); }

var n = cross(u, v);

// ── draw ───────────────────────────────────────────────────────────────
var app = document.getElementById('app');
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(45, app.clientWidth / 340, 0.1, 100);
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(app.clientWidth, 340);
app.appendChild(renderer.domElement);

function arrow(vec, colour) {
  var len = length(vec);
  if (len < 1e-9) return null;
  var dir = new THREE.Vector3(vec[0]/len, vec[1]/len, vec[2]/len);
  return new THREE.ArrowHelper(dir, new THREE.Vector3(0,0,0), len, colour, 0.12, 0.07);
}

[[u, 0xff6b6b], [v, 0x2ecc71], [n, 0x4c9be8]].forEach(function (pair) {
  var a = arrow(pair[0], pair[1]);
  if (a) scene.add(a);
});

// The parallelogram u and v span: two triangles, 0-u-(u+v) and 0-(u+v)-v.
var uv = [u[0]+v[0], u[1]+v[1], u[2]+v[2]];
var quad = new Float32Array([
  0,0,0,  u[0],u[1],u[2],  uv[0],uv[1],uv[2],
  0,0,0,  uv[0],uv[1],uv[2],  v[0],v[1],v[2],
]);
var geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(quad, 3));
scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
  color: 0x8a9099, side: THREE.DoubleSide, transparent: true, opacity: 0.3 })));

scene.add(new THREE.AxesHelper(0.6));

${ORBIT}
orbit(camera, renderer.domElement, 3.4);
(function loopFrame() { requestAnimationFrame(loopFrame); renderer.render(scene, camera); }());

// Is it really perpendicular? Two dot products that should both be zero.
var du = dot(n, u), dv = dot(n, v);
var perpendicular = Math.abs(du) < 1e-9 && Math.abs(dv) < 1e-9;

document.getElementById('out').textContent =
  'u            [' + u.join(', ') + ']\\n' +
  'v            [' + v.join(', ') + ']\\n' +
  'u x v        [' + n.map(function (x) { return x.toFixed(3); }).join(', ') + ']\\n' +
  '\\n' +
  '|u x v|      ' + length(n).toFixed(4) + '   <- the parallelogram area\\n' +
  'triangle     ' + (length(n) / 2).toFixed(4) + '   <- half of it\\n' +
  '\\n' +
  'n . u        ' + du.toFixed(6) + '\\n' +
  'n . v        ' + dv.toFixed(6) + '\\n' +
  (perpendicular
    ? 'both zero, so u x v really is perpendicular to both'
    : 'NOT ZERO - this is not perpendicular. Check the middle line of cross().');`,
      outputHeight: 470,
    },

    {
      type: 'markdown',
      instruction: `### Why its length is an area

The cross product's length is

\`\`\`
|u × v| = |u| |v| sin(θ)
\`\`\`

where θ is the angle between them. That expression is the **area of the
parallelogram** \`u\` and \`v\` span: base times height, where the height is
\`|v| sin(θ)\` — the part of \`v\` that is genuinely perpendicular to \`u\`.

So the cell above showed one number doing two jobs:

\`\`\`
direction of u × v   ->   which way the surface faces
length of u × v      ->   the area of the parallelogram
length / 2           ->   the area of the triangle
\`\`\`

The triangle is half the parallelogram, because the parallelogram is two
copies of it.

### This is where the determinant link is

For two vectors in a plane, the 2x2 determinant

\`\`\`
| ux  vx |
| uy  vy |   =  ux*vy - uy*vx
\`\`\`

is the **signed** area of that parallelogram. Look at the z component of the
cross product above: \`ux*vy - uy*vx\`. The same expression.

The cross product is three of those determinants stacked — one per axis — and
each measures the area of the parallelogram's shadow on one plane. That is
\`la2-003\` in the linear algebra course, and the reason area comes out of a
direction calculation with no extra work.

### The consequence that matters more than the maths

\`\`\`
raw cross product   ->  direction AND size
normalised          ->  direction only, size thrown away
\`\`\`

Every later stage of this course averages normals over many triangles: which
way did this toolpath cut, which way should a view turn. **Normalise first and
every triangle votes equally.** Leave them raw and each triangle votes in
proportion to its own area.

On a real machined part the smallest triangle is \`4.05e-13\` and the largest
is \`0.805\` — two trillion to one. One flat face is a couple of huge
triangles; one radius is thousands of slivers. Weight by count and the slivers
decide.

**So the rule is: do not normalise unless you have a reason.** The raw cross
product already carries the weighting, for free.`,
    },

    {
      type: 'challenge',
      instruction: `### 🎯 Write the three functions

\`cross\`, \`triangleArea\` and \`unitNormal\`, from the formulas above. No
library — there is none in here to reach for.

\`\`\`
cross(a, b)        -> [x, y, z]   perpendicular to both
triangleArea(A,B,C) -> number      half the cross product's length
unitNormal(A,B,C)  -> [x, y, z]   length 1, or null for a degenerate triangle
\`\`\`

\`unitNormal\` must return \`null\` when the triangle has no area. Three points
in a line have no direction, and dividing by zero puts \`NaN\` through
everything downstream — where it compares false against every test and faces
quietly stop matching rules instead of erroring.

The tests below are run for you against known answers, including two
degenerate cases. It draws the triangle and its normal so a wrong direction is
visible, not just a failed count.`,
      html: `${THREE_CDN}
<div id="app" style="width:100%;height:280px;background:#0a0f1e;border-radius:8px"></div>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:8px 2px;white-space:pre"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `// TODO 1 — perpendicular to both. Mind the middle line's order.
function cross(a, b) {
  return [
    0,
    0,
    0,
  ];
}

function dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function length(a) { return Math.sqrt(dot(a, a)); }
function sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }

// TODO 2 — half the length of the cross product of two edges from A.
function triangleArea(A, B, C) {
  return 0;
}

// TODO 3 — the normal, length 1. Return null if the triangle has no area.
function unitNormal(A, B, C) {
  return null;
}

// ── tests ──────────────────────────────────────────────────────────────
var T = [[0,0,0], [1,0,0], [0,1,0]];        // right triangle, legs 1, faces +z
var lines = [];
function check(name, got, want) {
  var ok;
  if (want === null) ok = (got === null);
  else if (typeof want === 'number') ok = (typeof got === 'number' && Math.abs(got - want) < 1e-9);
  else ok = Array.isArray(got) && want.every(function (w, i) { return Math.abs(got[i] - w) < 1e-9; });
  lines.push((ok ? 'PASS  ' : 'FAIL  ') + name +
    (ok ? '' : '   got ' + JSON.stringify(got) + '  want ' + JSON.stringify(want)));
  return ok;
}

var all = true;
all = check('cross([1,0,0],[0,1,0]) is +z', cross([1,0,0],[0,1,0]), [0,0,1]) && all;
all = check('cross([0,1,0],[1,0,0]) is -z', cross([0,1,0],[1,0,0]), [0,0,-1]) && all;
all = check('cross([1,0,0],[0,0,1]) is -y', cross([1,0,0],[0,0,1]), [0,-1,0]) && all;
all = check('area of the unit right triangle', triangleArea(T[0],T[1],T[2]), 0.5) && all;
all = check('area is 2 for legs 2 and 2', triangleArea([0,0,0],[2,0,0],[0,2,0]), 2) && all;
all = check('normal faces +z', unitNormal(T[0],T[1],T[2]), [0,0,1]) && all;
all = check('three points in a line -> null', unitNormal([0,0,0],[1,0,0],[2,0,0]), null) && all;
all = check('two identical corners -> null', unitNormal([0,0,0],[0,0,0],[1,0,0]), null) && all;

// ── draw the triangle and whatever normal came back ────────────────────
var app = document.getElementById('app');
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(45, app.clientWidth / 280, 0.1, 100);
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(app.clientWidth, 280);
app.appendChild(renderer.domElement);

var geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(
  new Float32Array([].concat.apply([], T)), 3));
scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
  color: 0x4c9be8, side: THREE.FrontSide })));
scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
  color: 0xff6b6b, side: THREE.BackSide })));

var n = unitNormal(T[0], T[1], T[2]);
if (n && length(n) > 1e-9) {
  var mid = [(T[0][0]+T[1][0]+T[2][0])/3, (T[0][1]+T[1][1]+T[2][1])/3, (T[0][2]+T[1][2]+T[2][2])/3];
  scene.add(new THREE.ArrowHelper(
    new THREE.Vector3(n[0], n[1], n[2]).normalize(),
    new THREE.Vector3(mid[0], mid[1], mid[2]), 0.7, 0x2ecc71, 0.12, 0.07));
}
scene.add(new THREE.AxesHelper(0.5));

${ORBIT}
orbit(camera, renderer.domElement, 2.6);
(function loopFrame() { requestAnimationFrame(loopFrame); renderer.render(scene, camera); }());

document.getElementById('out').textContent =
  lines.join('\\n') + '\\n\\n' +
  (all ? 'all eight pass' : 'read the first FAIL above');`,
      check: (js) => {
        // Run the learner's three functions against the same expectations the
        // cell shows, so passing requires the functions and not the printout.
        const body = js.split('// ── tests')[0];
        let cross, area, normal;
        try {
          // eslint-disable-next-line no-new-func
          const made = new Function(
            body + '\nreturn { cross: cross, triangleArea: triangleArea, unitNormal: unitNormal };',
          )();
          cross = made.cross; area = made.triangleArea; normal = made.unitNormal;
        } catch { return false; }
        if (typeof cross !== 'function' || typeof area !== 'function' || typeof normal !== 'function') return false;

        const near = (a, b) => Math.abs(a - b) < 1e-9;
        const nearVec = (got, want) =>
          Array.isArray(got) && got.length === 3 && want.every((w, i) => near(got[i], w));

        try {
          if (!nearVec(cross([1, 0, 0], [0, 1, 0]), [0, 0, 1])) return false;
          if (!nearVec(cross([0, 1, 0], [1, 0, 0]), [0, 0, -1])) return false;
          if (!nearVec(cross([1, 0, 0], [0, 0, 1]), [0, -1, 0])) return false;
          if (!nearVec(cross([2, 3, 4], [5, 6, 7]), [-3, 6, -3])) return false;
          if (!near(area([0, 0, 0], [1, 0, 0], [0, 1, 0]), 0.5)) return false;
          if (!near(area([0, 0, 0], [2, 0, 0], [0, 2, 0]), 2)) return false;
          if (!near(area([1, 1, 1], [1, 1, 1], [2, 2, 2]), 0)) return false;
          if (!nearVec(normal([0, 0, 0], [1, 0, 0], [0, 1, 0]), [0, 0, 1])) return false;
          if (normal([0, 0, 0], [1, 0, 0], [2, 0, 0]) !== null) return false;
          if (normal([0, 0, 0], [0, 0, 0], [1, 0, 0]) !== null) return false;
        } catch { return false; }
        return true;
      },
      successMessage: '✓ All three, from the formula, with the degenerate cases handled. You now have everything Lesson 3 needs: a direction per face, an area per face, and a guard that stops a zero-area triangle poisoning an average with NaN.',
      failMessage: 'Read the first FAIL under the drawing. If cross([1,0,0],[0,1,0]) is right but cross([1,0,0],[0,0,1]) is wrong, the middle line has its order backwards — it is a[2]*b[0] - a[0]*b[2]. If unitNormal returns [NaN,NaN,NaN] rather than null, the length check is missing.',
      outputHeight: 420,
    },

  ],
};

export default {
  id: 'mesh-engine-1-2-vectors-and-triangles',
  slug: 'vectors-and-triangles',
  chapter: 'mesh-engine.1',
  order: 1,
  title: 'Vectors and Triangle Geometry',
  subtitle: 'Which way does a triangle face, how big is it, and why those are the same calculation.',
  tags: [
    'vectors', 'cross product', 'dot product', 'normal', 'area',
    'winding order', 'normalise', 'determinant', 'degenerate', 'numpy',
  ],
  aliases: 'cross product dot product triangle normal triangle area winding order normalise unit vector determinant area weighting degenerate triangle NaN',
  timeToComplete: 50,
  coreConcept:
    'Two edge vectors from one corner give the cross product, whose direction is which way the triangle faces and whose length is twice the triangle area. Because both come from one operation, area weighting is free — and leaving the cross product un-normalised is what makes a large face count for more than a sliver.',
  prerequisites: ['mesh-engine-1-1-what-a-mesh-is'],
  nextLesson: 'mesh-engine-1-3-topology-and-welding',

  semantics: {
    core: [
      { symbol: 'B - A', meaning: 'Subtracting two points gives the vector between them. Every vector in this lesson starts as a point subtraction.' },
      { symbol: 'u x v', meaning: 'The cross product: a third vector perpendicular to both, whose length is the area of the parallelogram they span.' },
      { symbol: '|u x v| / 2', meaning: 'The triangle area. The triangle is half the parallelogram because the parallelogram is two copies of it.' },
      { symbol: 'u . v', meaning: 'The dot product. Zero means perpendicular, which is how you check a cross product came out right.' },
      { symbol: 'u / |u|', meaning: 'Normalising — direction kept, size discarded. Almost always the wrong thing to do before averaging normals.' },
      { symbol: 'winding order', meaning: 'The order the three corners are listed in. Swap two and the cross product flips, so the triangle faces the other way.' },
    ],
    rulesOfThumb: [
      'Do not normalise unless you have a reason. The raw cross product carries the area weighting for free.',
      'Check a cross product with two dot products. Both must be zero.',
      'The middle line of the cross product is z,x — not x,z. Getting it wrong yields a vector that is not perpendicular.',
      'Guard every normalise against zero length, and return nothing rather than NaN.',
      'Swapping any two corners of a triangle reverses which way it faces.',
    ],
  },

  hook: {
    question: 'A real machined part has a largest triangle two trillion times the area of its smallest. If you average the face directions to ask which way a toolpath cut, what happens if every triangle gets one vote?',
    realWorldContext: 'One flat face is a couple of huge triangles; one radius is thousands of slivers. Normalise the normals before averaging and the slivers decide the answer. Leaving the cross product raw gives each triangle a vote proportional to its own area, and costs nothing — the weighting is already in the number.',
    previewVisualizationId: 'JSNotebook',
  },

  intuition: {
    prose: [
      'A point is a place; a vector is a move. Subtracting two points gives the vector between them, and that is where every vector here comes from.',
      'Two edges from one corner, u = B - A and v = C - A, are all the input needed.',
      'The cross product u x v is perpendicular to both, so its direction is which way the triangle faces.',
      'Its length is the area of the parallelogram u and v span, so half of it is the triangle area.',
      'One operation, two answers. That is why area weighting is free and why normalising throws it away.',
      'A triangle with three points in a line has no area and no direction, so normalising it must be guarded.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: the direction and area of a triangle',
        body: 'Step 1. u = B - A, v = C - A.\nStep 2. n = u x v, written out: [uy*vz - uz*vy, uz*vx - ux*vz, ux*vy - uy*vx].\nStep 3. area = |n| / 2.\nStep 4. If |n| is zero, stop — the triangle is degenerate and has no direction.\nStep 5. Only if a pure direction is wanted, and only then: n / |n|.',
      },
      {
        type: 'warning',
        title: 'The middle line is z,x — not x,z',
        body: 'The y component of the cross product is ux*vz - uz*vx written the other way round: uz*vx - ux*vz. Get it backwards and the result is not perpendicular to either input, which draws a part whose faces are inside out. Two dot products catch it immediately, and both must be zero.',
      },
      {
        type: 'insight',
        title: 'Do not normalise unless you have a reason',
        body: 'The raw cross product carries direction and area together. Every later stage averages normals over many faces, and the raw version weights each face by its own area automatically. Normalising first gives a thousand slivers the same say as the face you are looking at.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'See the cross product before computing with it',
        caption: 'Drag to turn. Change u and v and watch the arrow and the area move together.',
        props: {
          lesson: LESSON_MESH_1_2,
        },
      },
    ],
  },

  math: {
    prose: [
      'The drawings did one triangle at a time. A real part has 214,382 of them, and the point of numpy is doing all of them in one expression.',
      'The notebook writes the cross product out from the formula first, checks it against np.cross, and only then goes vectorised — so the library is a confirmation rather than the answer.',
      'The last cell is the area-weighting claim, measured on a spread of triangle sizes rather than asserted.',
    ],
    visualizations: [
      {
        id: 'PythonNotebook',
        title: 'The cross product by hand, then for every face at once',
        mathBridge: 'The z component ux*vy - uy*vx is the 2x2 determinant of u and v projected onto the x-y plane — the signed area of their parallelogram\'s shadow there. The cross product is three of those stacked, which is why a direction calculation yields an area.',
        caption: 'Cells run in order and share a namespace. Nothing is imported until it has been written by hand first.',
        props: {
          initialCells: [
            {
              id: 1,
              cellTitle: 'Vectors from points, and length',
              prose: [
                'Subtracting two points gives the vector between them. In numpy that is just a subtraction — no loop, because arrays subtract elementwise.',
                'Length is Pythagoras with a third term. Written out first, then with the library call, so you can see they agree.',
              ],
              code: `import numpy as np

A = np.array([0.0, 0.0, 0.0])
B = np.array([1.0, 0.0, 0.0])
C = np.array([0.0, 1.0, 0.0])

u = B - A
v = C - A
print("u =", u)
print("v =", v)

# Length, by hand: sqrt of the sum of the squares.
by_hand = (u[0]**2 + u[1]**2 + u[2]**2) ** 0.5
print("\\nlength by hand   ", by_hand)
print("np.linalg.norm   ", np.linalg.norm(u))

# A unit vector: direction kept, size divided out.
print("\\nu normalised     ", u / np.linalg.norm(u))
print("its length       ", np.linalg.norm(u / np.linalg.norm(u)))`,
            },
            {
              id: 2,
              cellTitle: 'The cross product, written out from the formula',
              prose: [
                'Three lines, each ignoring its own axis. This is the formula from the lesson, typed straight in.',
                'Then np.cross on the same inputs. If they disagree, the hand-written one is wrong — most likely the middle line.',
                'Predict the answer for u=[1,0,0] and v=[0,1,0] before running it.',
              ],
              code: `import numpy as np

def cross_by_hand(a, b):
    """u x v, from the formula. Note the middle line's order: z,x not x,z."""
    return np.array([
        a[1]*b[2] - a[2]*b[1],    # x : uses y and z
        a[2]*b[0] - a[0]*b[2],    # y : uses z and x
        a[0]*b[1] - a[1]*b[0],    # z : uses x and y
    ])

u = np.array([1.0, 0.0, 0.0])
v = np.array([0.0, 1.0, 0.0])

print("by hand  ", cross_by_hand(u, v))
print("np.cross ", np.cross(u, v))
print("agree    ", np.allclose(cross_by_hand(u, v), np.cross(u, v)))

# A case where a wrong middle line shows up. Try breaking cross_by_hand
# and re-running: swap a[2]*b[0] - a[0]*b[2] round.
p = np.array([2.0, 3.0, 4.0])
q = np.array([5.0, 6.0, 7.0])
print("\\nby hand  ", cross_by_hand(p, q))
print("np.cross ", np.cross(p, q))
print("agree    ", np.allclose(cross_by_hand(p, q), np.cross(p, q)))

# The check that does not need a reference implementation: perpendicular
# means both dot products are zero.
n = cross_by_hand(p, q)
print("\\nn . p =", np.dot(n, p), "   n . q =", np.dot(n, q))`,
            },
            {
              id: 3,
              cellTitle: 'Direction and area from one operation',
              prose: [
                'The length of the cross product is the parallelogram area, so half of it is the triangle.',
                'Checked here against the school formula for a right triangle — half base times height — on a case where you already know the answer.',
                'Also: what normalising throws away, printed side by side.',
              ],
              code: `import numpy as np

def triangle(A, B, C):
    u, v = B - A, C - A
    n = np.cross(u, v)
    length = np.linalg.norm(n)
    return {
        "raw": n,
        "area": length / 2,
        # None, not NaN. A degenerate triangle has no direction, and NaN
        # would spread silently through every later average.
        "unit": (n / length) if length > 1e-12 else None,
    }

A = np.array([0.0, 0.0, 0.0])
B = np.array([3.0, 0.0, 0.0])
C = np.array([0.0, 4.0, 0.0])

t = triangle(A, B, C)
print("raw cross product ", t["raw"])
print("area              ", t["area"])
print("half base x height", 0.5 * 3 * 4, "  <- agrees")
print("unit normal       ", t["unit"])

# Swap two corners: same triangle, opposite side.
print("\\nswapped B and C   ", triangle(A, C, B)["unit"])

# Degenerate: three points in a line.
flat = triangle(np.array([0.,0,0]), np.array([1.,0,0]), np.array([2.,0,0]))
print("\\ncollinear area    ", flat["area"])
print("collinear unit    ", flat["unit"], "  <- None, not NaN")`,
            },
            {
              id: 4,
              cellTitle: 'Every face at once',
              prose: [
                'Lesson 1 ended with points[triangles] giving an (m,3,3) array: every triangle, its three corners, each three coordinates.',
                'Slice that on the middle axis to get all the A corners, all the B corners, all the C corners — as three (m,3) arrays.',
                'Then the whole calculation runs once for every face, with no loop. np.cross takes axis=1 to say which direction holds the xyz.',
              ],
              code: `import numpy as np

points = np.array([
    [0,0,0], [1,0,0], [1,1,0], [0,1,0],
    [0,0,1], [1,0,1], [1,1,1], [0,1,1],
], dtype=float)
triangles = np.array([
    [0,1,2], [0,2,3], [4,6,5], [4,7,6], [0,5,1], [0,4,5],
    [1,6,2], [1,5,6], [2,7,3], [2,6,7], [3,4,0], [3,7,4],
], dtype=np.int64)

corners = points[triangles]          # (12, 3, 3)
print("corners.shape", corners.shape)

# Split the middle axis: every A, every B, every C.
A = corners[:, 0, :]                 # (12, 3)
B = corners[:, 1, :]
C = corners[:, 2, :]
print("A.shape      ", A.shape)

u = B - A
v = C - A
normals = np.cross(u, v, axis=1)     # (12, 3) - one per face
lengths = np.linalg.norm(normals, axis=1)
areas = lengths / 2

print("\\nnormals.shape", normals.shape)
print("areas.shape  ", areas.shape)
print("\\ntotal surface area", areas.sum(), "  <- a unit cube: 6 faces of area 1")
print("every face area   ", np.unique(np.round(areas, 9)))

# Which way each face points, rounded so the six directions are readable.
print("\\nthe six face directions:")
unit = normals / lengths[:, None]
for direction in np.unique(np.round(unit, 6), axis=0):
    print("  ", direction)`,
            },
            {
              id: 5,
              cellTitle: 'The area-weighting claim, measured',
              prose: [
                'The lesson claims that normalising before averaging lets slivers outvote a large face. This tests it.',
                'One big triangle facing +z, and four hundred tiny ones facing -z. By count, -z wins 400 to 1. By area, +z wins overwhelmingly.',
                'Predict which way each average points before running it.',
              ],
              code: `import numpy as np

def make(tris):
    tris = np.asarray(tris, dtype=float)
    u = tris[:, 1, :] - tris[:, 0, :]
    v = tris[:, 2, :] - tris[:, 0, :]
    return np.cross(u, v, axis=1)

# One big triangle, legs of 10, wound to face +z.
big = [[[0,0,0], [10,0,0], [0,10,0]]]

# Four hundred tiny ones, legs of 0.05, wound the other way to face -z.
small = [[[0,0,0], [0,0.05,0], [0.05,0,0]]] * 400

normals = make(big + small)
lengths = np.linalg.norm(normals, axis=1)
areas = lengths / 2

print(f"triangles          {len(normals)}")
print(f"big triangle area  {areas[0]:.4f}")
print(f"all small together {areas[1:].sum():.4f}")
print()

# Weighted by area: the raw cross products, summed.
raw = normals.sum(axis=0)
print("sum of RAW normals        ", np.round(raw, 4))
print("  points", "+z" if raw[2] > 0 else "-z", " <- the big face wins, correctly")
print()

# Every triangle one vote: normalise first, then average.
unit = normals / lengths[:, None]
voted = unit.sum(axis=0)
print("sum of NORMALISED normals ", np.round(voted, 4))
print("  points", "+z" if voted[2] > 0 else "-z", " <- 400 slivers outvote it")
print()
print("Same geometry. Two answers. The only difference is whether the")
print("area was divided out before summing.")

# How much the normals agree - the number Lesson 5 onward needs.
print()
print(f"agreement |sum| / total area = {np.linalg.norm(raw) / lengths.sum():.4f}")
print("Near 1 means the faces point the same way. Near 0 means they cancel,")
print("like the inside of a bore, where no single direction is honest.")`,
            },
          ],
        },
      },
    ],
  },

  examples: [
    {
      id: 'mesh-engine-1-2-ex1',
      title: 'The unit right triangle',
      steps: [
        { expression: 'A=[0,0,0]  B=[1,0,0]  C=[0,1,0]', annotation: 'Legs of 1 along x and y.' },
        { expression: 'u = B - A = [1,0,0]   v = C - A = [0,1,0]', annotation: 'Two edges from A, as vectors.' },
        { expression: 'u x v = [0*0-0*1, 0*0-1*0, 1*1-0*0] = [0,0,1]', annotation: 'Each line ignores its own axis. Only the z term survives.' },
        { expression: 'area = |[0,0,1]| / 2 = 0.5', annotation: 'Half base times height is 0.5 x 1 x 1. Agrees.' },
      ],
    },
    {
      id: 'mesh-engine-1-2-ex2',
      title: 'Winding order flips the direction',
      steps: [
        { expression: 'cross([1,0,0],[0,1,0]) = [0,0,1]', annotation: 'Points along +z.' },
        { expression: 'cross([0,1,0],[1,0,0]) = [0,0,-1]', annotation: 'Same two vectors, swapped. Opposite answer.' },
        { expression: 'the plane is identical', annotation: 'Only the side changed. That is what a front and a back are.' },
        { expression: 'so listing corners A,C,B instead of A,B,C turns the face inside out', annotation: 'One transposition, and the triangle faces the other way.' },
      ],
    },
    {
      id: 'mesh-engine-1-2-ex3',
      title: 'Why the middle line traps people',
      steps: [
        { expression: 'x: uy*vz - uz*vy', annotation: 'Ignores x, uses y then z. Alphabetical.' },
        { expression: 'y: uz*vx - ux*vz', annotation: 'Ignores y, uses z then x. NOT x then z.' },
        { expression: 'z: ux*vy - uy*vx', annotation: 'Ignores z, uses x then y. Alphabetical again.' },
        { expression: 'the pattern is cyclic: x->y->z->x', annotation: 'Each line uses the next two axes in that cycle. The middle one looks backwards only if you expect alphabetical.' },
      ],
    },
  ],

  challenges: [
    {
      id: 'mesh-engine-1-2-ch1',
      prompt: 'A triangle has corners [0,0,0], [2,0,0] and [0,0,5]. Which way does it face, and what is its area?',
      walkthrough: [
        { expression: 'u = [2,0,0]   v = [0,0,5]', annotation: 'Both edges from the first corner.' },
        { expression: 'x: 0*5 - 0*0 = 0', annotation: 'No y or z component in u to contribute.' },
        { expression: 'y: 0*0 - 2*5 = -10', annotation: 'The middle line. uz*vx - ux*vz.' },
        { expression: 'z: 2*0 - 0*0 = 0', annotation: '' },
        { expression: 'n = [0,-10,0], |n| = 10, area = 5', annotation: 'It faces along -y, and the area is 5.' },
      ],
      answer: 'It faces along negative y, and its area is 5. The triangle lies in the x-z plane, so its normal must be along y — and the sign says which side, which follows from the corner order.',
    },
    {
      id: 'mesh-engine-1-2-ch2',
      prompt: 'Your cross product returns a vector, but the two dot-product checks give 26 and -14 instead of zero. What is wrong, and how do you know it is not a rounding problem?',
      walkthrough: [
        { expression: 'perpendicular means both dots are exactly 0', annotation: 'Not approximately — the arithmetic is exact for these inputs.' },
        { expression: '26 and -14 are not rounding', annotation: 'Floating point error would be around 1e-16, not tens.' },
        { expression: 'a wrong sign or a swapped pair breaks perpendicularity outright', annotation: 'The result is then some other vector entirely, not a slightly-off normal.' },
        { expression: 'check the middle line first', annotation: 'It is the only one whose order is not alphabetical, and it is the usual culprit.' },
      ],
      answer: 'One of the three lines is wrong — almost certainly the middle one, written ux*vz - uz*vx instead of uz*vx - ux*vz. It is not rounding: floating point error on these magnitudes would be about 1e-16, and 26 is fourteen orders of magnitude larger. The two dot products are the right test precisely because a correct cross product makes them exactly zero.',
    },
    {
      id: 'mesh-engine-1-2-ch3',
      prompt: 'You are asked which way a toolpath cut, given the thousands of faces it produced. Somebody suggests averaging the unit normals because "that is what an average direction means". When is that right, and when is it badly wrong?',
      walkthrough: [
        { expression: 'right when every face is the same size', annotation: 'A regular tessellation of one flat face — then count and area agree.' },
        { expression: 'wrong when sizes vary', annotation: 'A real part spans twelve orders of magnitude in triangle area.' },
        { expression: 'the raw sum weights by area for free', annotation: 'Because |u x v| is twice the area, so a big face contributes proportionally.' },
        { expression: 'and a bore cancels either way', annotation: 'Normals pointing outward all round a circle sum to nearly zero. That is the honest answer, and it needs detecting rather than dividing.' },
      ],
      answer: 'Averaging unit normals is right only when the faces are all about the same size, which on a machined part they never are. Summing the raw cross products weights each face by its own area at no extra cost. Separately, both methods return nearly zero for a bore, whose normals cancel — so the magnitude of the sum relative to the total area has to be checked before the direction is trusted at all.',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'You should normalise a normal — it is in the name.',
      whyStudentsThinkIt: 'A unit vector is the tidy form, and most textbook formulas present normals already normalised.',
      correctionExample: 'One triangle of area 50 facing +z, and 400 of total area 0.5 facing -z. Summing raw cross products points +z. Normalising first points -z, because 400 votes beat 1.',
      contrastCase: 'On a regular grid of identical triangles both methods agree exactly — which is why the bug survives testing on simple geometry and appears on a real part.',
    },
    {
      falseBelief: 'The cross product formula is symmetric, so the order of the three lines does not matter much.',
      whyStudentsThinkIt: 'Two of the three lines do follow the obvious alphabetical pattern, so the third looks like a typo in the reference.',
      correctionExample: 'cross([1,0,0],[0,0,1]) is [0,-1,0]. Write the middle line as ux*vz - uz*vx and you get [0,1,0] — pointing the opposite way.',
      contrastCase: 'cross([1,0,0],[0,1,0]) gives [0,0,1] either way, because the middle line contributes nothing there. So the mistake passes the first test anybody writes.',
    },
    {
      falseBelief: 'A zero-length normal can just be skipped with an if, or left as it is.',
      whyStudentsThinkIt: 'Degenerate triangles feel like a rare edge case not worth guarding.',
      correctionExample: 'A real part has 9 triangles under 1e-10 in area and none exactly zero, so an == 0 check finds nothing while the division still produces values with no meaning.',
      contrastCase: 'NaN compares false against every test, so a face carrying it stops matching rules rather than raising — and the symptom appears in whatever consumed the average, not here.',
    },
  ],

  transferPrompts: [
    {
      situation: 'You need to know whether a surface patch is flat or curved, given only its triangles.',
      competingTechniques: ['compare each normal against its neighbours pairwise', 'sum the raw cross products and compare the length of the sum against the total area'],
      whyThisTechniqueWins: 'The ratio |sum| / total area is one pass and one number: near 1 means the faces agree, near 0 means they cancel. Pairwise comparison is quadratic and gives no single answer to threshold.',
    },
    {
      situation: 'A model renders with some faces black and others lit, and the geometry looks correct.',
      competingTechniques: ['adjust the lighting', 'check the winding order of the dark faces'],
      whyThisTechniqueWins: 'Lighting uses the normal, and the normal comes from the corner order. A face wound the wrong way has a normal pointing into the solid, so it faces away from every light. Changing the lighting hides it on one side and breaks it on the other.',
    },
  ],

  debugging: [
    {
      commonError: 'The middle line of the cross product written in alphabetical order.',
      symptom: 'Simple axis-aligned tests pass, then a real model draws with faces inside out or lit wrongly.',
      whyItHappened: 'Two of the three lines are alphabetical and the middle one is not, so the correct version looks like an error in whatever you copied from.',
      repairStrategy: 'Check with two dot products against the inputs; both must be exactly zero. Then test cross([1,0,0],[0,0,1]), which is the case the middle line actually affects.',
    },
    {
      commonError: 'Normalising before averaging normals.',
      symptom: 'The averaged direction is right on test geometry and wrong on a real part, often pointing roughly opposite to what you expect.',
      whyItHappened: 'Test meshes have uniformly sized triangles, so count-weighting and area-weighting agree. Real meshes do not.',
      repairStrategy: 'Sum the raw cross products, and normalise only the final result if a direction is what you need. Print the triangle area range on real data to see how far apart the two answers can be.',
    },
    {
      commonError: 'Dividing by the normal length without checking it.',
      symptom: 'NaN appearing somewhere unrelated, often in a comparison that silently stops matching.',
      whyItHappened: 'A degenerate triangle has zero length, and floating point division by zero produces NaN rather than raising.',
      repairStrategy: 'Guard with a tolerance, not equality — real degenerate triangles are 1e-13, not exactly 0 — and return None or null so the caller has to handle it.',
    },
  ],

  mastery: {
    targetLevel: 2,
    solveIndependently: 'Given three corners, compute the normal direction and the area by hand, and say which way the face points.',
    explainVerbally: 'Explain why one operation yields both a direction and an area, and what normalising discards.',
    detectIncorrectApplication: 'Given an averaged normal that looks wrong on real geometry, determine whether the cause is a wrong cross-product line, premature normalising, or genuinely cancelling normals.',
    transferToUnfamiliar: 'Given a surface patch, decide whether a single direction describes it at all, using the ratio of the summed magnitude to the total area.',
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'la1-001', label: 'What is a Vector?', note: 'The point-versus-vector distinction. Read it if "a place and a move are different things" needs a reason rather than an assertion — every vector here is a point subtraction.' },
      { lessonId: 'la2-003', label: 'Inverse Matrices and Determinants', note: 'The z component of the cross product, ux*vy - uy*vx, IS the 2x2 determinant of u and v. A determinant is a signed area, which is why a direction calculation hands you an area for free.' },
      { lessonId: 'mesh-engine-1-1-what-a-mesh-is', label: 'What a Mesh Actually Is', note: 'points[triangles] giving an (m,3,3) array. Cell 4 slices that on its middle axis to get every A, B and C corner at once.' },
    ],
    futureLinks: [
      { lessonId: 'mesh-engine-1-3-topology-and-welding', label: 'Topology and Welding', note: 'Uses the area from here to judge whether a weld destroyed geometry: surface area must survive a weld that only merges duplicates.' },
      { lessonId: 'la1-005', label: 'Lines and Planes in 3D', note: 'A plane is a point plus a normal, and the normal is what you computed here. Lesson 5 needs it to project a point onto a triangle.' },
      { lessonId: 'la4-001', label: 'Orthogonal Projections', note: 'Finding the closest point on a triangle starts by projecting onto its plane, which is a projection along the normal from this lesson.' },
    ],
  },

  checkpoints: [
    { id: 'cp-mesh-engine-1-2-1', label: 'Read why subtracting two points gives a vector', type: 'read' },
    { id: 'cp-mesh-engine-1-2-2', label: 'Read the cross product formula and the middle line warning', type: 'read' },
    { id: 'cp-mesh-engine-1-2-3', label: 'Read which linear algebra lessons apply and how', type: 'read' },
    { id: 'cp-mesh-engine-1-2-4', label: 'Run the cross product viewer and make u and v parallel', type: 'lab' },
    { id: 'cp-mesh-engine-1-2-5', label: 'Break the middle line on purpose and watch the dot products stop being zero', type: 'lab' },
    { id: 'cp-mesh-engine-1-2-6', label: 'Run the area-weighting cell and predict both answers first', type: 'lab' },
    { id: 'cp-mesh-engine-1-2-7', label: 'Complete the unit right triangle example by hand', type: 'example' },
    { id: 'cp-mesh-engine-1-2-8', label: 'Attempt the three functions until all eight tests pass', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'mesh-engine-1-2-assess-1',
        type: 'choice',
        text: 'Why does one operation give you both the direction a triangle faces and its area?',
        options: [
          'The cross product\'s direction is perpendicular to both edges, and its length is the area of the parallelogram they span',
          'Area and direction are always numerically equal for a triangle',
          'The dot product gives the area and the cross product gives the direction',
          'It does not — the area has to be computed separately with half base times height',
        ],
        answer: 'The cross product\'s direction is perpendicular to both edges, and its length is the area of the parallelogram they span',
        hint: '|u x v| = |u||v|sin(theta), which is base times perpendicular height. The triangle is half that parallelogram.',
      },
    ],
  },

  quiz: [
    {
      id: 'mesh-engine-1-2-quiz-1',
      type: 'choice',
      text: 'cross([1,0,0], [0,1,0]) gives [0,0,1]. What does cross([0,1,0], [1,0,0]) give?',
      options: [
        '[0,0,-1]',
        '[0,0,1]',
        '[1,1,0]',
        '[0,0,0]',
      ],
      answer: '[0,0,-1]',
      hints: ['Swapping the two inputs reverses the result.', 'Same plane, opposite side — that is what a front and a back are.'],
      reviewSection: 'Examples — Winding order flips the direction',
    },
    {
      id: 'mesh-engine-1-2-quiz-2',
      type: 'choice',
      text: 'A triangle has one face of area 50 pointing +z, and 400 slivers of total area 0.5 pointing -z. You sum the RAW cross products. Which way does the result point?',
      options: [
        '+z — the raw sum weights each face by its own area',
        '-z — there are 400 of them against 1',
        'Nowhere; they cancel exactly',
        'It depends on the order they are summed in',
      ],
      answer: '+z — the raw sum weights each face by its own area',
      hints: ['|u x v| is twice the triangle area, so a big face contributes a big vector.', 'The 400 slivers contribute 0.5 of area between them.'],
      reviewSection: 'Lab — The area-weighting claim, measured',
    },
    {
      id: 'mesh-engine-1-2-quiz-3',
      type: 'choice',
      text: 'Which of these is the correct y component of u x v?',
      options: [
        'uz*vx - ux*vz',
        'ux*vz - uz*vx',
        'ux*vy - uy*vx',
        'uy*vz - uz*vy',
      ],
      answer: 'uz*vx - ux*vz',
      hints: ['Each line ignores its own axis and uses the next two in the cycle x -> y -> z -> x.', 'The y line is the one that does not look alphabetical.'],
      reviewSection: 'Examples — Why the middle line traps people',
    },
    {
      id: 'mesh-engine-1-2-quiz-4',
      type: 'choice',
      text: 'Your cross product returns a vector whose dot products with both inputs are 26 and -14. What does that tell you?',
      options: [
        'The formula is wrong — a correct cross product gives exactly zero for both',
        'Floating point rounding; the values are close enough to zero',
        'The inputs were not unit vectors',
        'The triangle is degenerate',
      ],
      answer: 'The formula is wrong — a correct cross product gives exactly zero for both',
      hints: ['Rounding error on these magnitudes is around 1e-16.', '26 is fourteen orders of magnitude bigger than rounding.'],
      reviewSection: 'Challenges — challenge 2',
    },
    {
      id: 'mesh-engine-1-2-quiz-5',
      type: 'choice',
      text: 'A bore is tessellated all the way round. You sum the raw cross products of its faces. What comes out, and what does it mean?',
      options: [
        'Nearly zero, because the normals point outward all round and cancel — so no single direction honestly describes it',
        'A vector along the bore axis, because that is the direction of the hole',
        'A large vector, because there are many triangles',
        'Exactly zero, which means the geometry is broken',
      ],
      answer: 'Nearly zero, because the normals point outward all round and cancel — so no single direction honestly describes it',
      hints: ['Think about what direction the inside of a hole faces.', 'The lesson calls the ratio of |sum| to total area "agreement".'],
      reviewSection: 'Lab — The area-weighting claim, measured',
    },
    {
      id: 'mesh-engine-1-2-quiz-6',
      type: 'choice',
      text: 'Why should unitNormal return null rather than [NaN, NaN, NaN] for a degenerate triangle?',
      options: [
        'NaN compares false against every test, so the face silently stops matching rules instead of erroring',
        'NaN takes more memory than null',
        'null draws as nothing while NaN draws as a black triangle',
        'There is no difference; both are fine',
      ],
      answer: 'NaN compares false against every test, so the face silently stops matching rules instead of erroring',
      hints: ['What happens to NaN > 0.5?', 'The symptom turns up in whatever consumed the value, not where it was made.'],
      reviewSection: 'Debugging — dividing by the normal length',
    },
  ],
};

export { LESSON_MESH_1_2 };
