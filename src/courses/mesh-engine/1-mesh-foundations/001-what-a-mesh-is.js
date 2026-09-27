// Mesh Engine · Chapter 1 · Lesson 1
// What a Mesh Actually Is
//
// Order matters. The JSNotebook sits in `intuition` so triangles are on
// screen BEFORE anything computes over them. The PythonNotebook sits in
// `math`, which MicroCycleLesson renders after the examples.
//
// The Python cells assume Python basics and nothing else — no numpy, no
// data-science background. Arrays, shape, dtype and axis are each introduced
// against a plain-Python version of the same job first.

const THREE_CDN =
  '<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"><\/script>';

// Drag-to-orbit, written out rather than imported: OrbitControls has no
// classic-script build, and twelve lines is twelve lines the reader can see
// the whole of.
const ORBIT = `
function orbit(camera, dom, radius) {
  var lon = 35, lat = 25, down = false, px = 0, py = 0;
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

const LESSON_MESH_1_1 = {
  title: 'What a Mesh Actually Is',
  subtitle: 'Look at the triangles first. Then find out what they are made of.',
  sequential: true,

  cells: [

    {
      type: 'markdown',
      instruction: `### Nine numbers

A triangle, written out in full. Not a picture of one — the whole thing:

\`\`\`
 0.0   0.9   0.0
-0.8  -0.5   0.0
 0.8  -0.5   0.0
\`\`\`

Three rows, one per corner. Each row is **x, y, z** — across, up, and toward
you. Nine numbers, and there is nothing else in it: no colour, no thickness,
no material.

The cell below draws exactly those nine numbers. **Drag it to turn it.**`,
    },

    {
      type: 'markdown',
      instruction: `### The six three.js words, before you meet them

The drawing cells use a library called **three.js**. It is not the lesson, but
you should not have to guess at it either. Six names appear, and each does one
job:

| | |
|---|---|
| **Scene** | a list of things to draw. That is all it is |
| **PerspectiveCamera** | where you are looking from, and how wide the view is |
| **WebGLRenderer** | owns the canvas, and turns the scene into pixels |
| **BufferGeometry** | the shape, as raw numbers |
| **Material** | how a surface should look — here just a flat colour |
| **Mesh** | one geometry paired with one material. This is what goes in the Scene |

So every cell has the same five lines of setup:

\`\`\`js
var scene    = new THREE.Scene();                 // somewhere to put things
var camera   = new THREE.PerspectiveCamera(...);  // a point of view
var renderer = new THREE.WebGLRenderer(...);      // something to draw with
scene.add(new THREE.Mesh(geometry, material));    // put the shape in the list
renderer.render(scene, camera);                   // draw it once
\`\`\`

### The two that matter here

\`\`\`js
var geometry = new THREE.BufferGeometry();
geometry.setAttribute('position',
  new THREE.BufferAttribute(new Float32Array(CORNERS), 3));
\`\`\`

**\`Float32Array\`** is a block of memory holding plain decimal numbers, one
after another, with nothing between them. An ordinary JavaScript array of
numbers is a list of separate boxed values scattered around; this is one
contiguous run. The graphics card can only read the second kind.

**\`BufferAttribute(data, 3)\`** is that block plus the number **3**, meaning
"read these three at a time". Without the 3, nine numbers could be nine
points, three points, or anything else — the data does not say.

**\`'position'\`** is a name, and it has to be exactly that one. It is what the
graphics card's own program looks for. Call it anything else and nothing
appears, with no error.

That is the whole of what you need. \`renderer.render\` inside a
\`requestAnimationFrame\` loop just means "draw again before the next screen
refresh", which is what makes dragging look live.`,
    },

    {
      type: 'js',
      instruction: `### One triangle

Drag to turn it round. Two things to do, and the second is the point:

1. **Change a number** in \`CORNERS\` and run it again. One corner moves.
2. **Turn it edge-on.** It disappears — it has no thickness at all. Keep
   going and you see the back of it, drawn red.

A triangle has a front and a back, decided by the *order* its corners are
listed in. That matters in Lesson 2. For now just notice the thing has no
substance: **a mesh is a skin, not a lump.**`,
      html: `${THREE_CDN}
<div id="app" style="width:100%;height:340px;background:#0a0f1e;border-radius:8px"></div>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:8px 2px;white-space:pre"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `// Nine numbers. Change one, run again.
var CORNERS = [
   0.0,  0.9,  0.0,     // corner A   x, y, z
  -0.8, -0.5,  0.0,     // corner B
   0.8, -0.5,  0.0,     // corner C
];

var app = document.getElementById('app');
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(45, app.clientWidth / 340, 0.1, 100);
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(app.clientWidth, 340);
app.appendChild(renderer.domElement);

// A BufferGeometry is the GPU's idea of a shape: one flat run of numbers,
// plus a note saying "read these three at a time, they are positions".
var geometry = new THREE.BufferGeometry();
geometry.setAttribute('position',
  new THREE.BufferAttribute(new Float32Array(CORNERS), 3));

// Front blue, back red, so which side you are looking at is visible.
scene.add(new THREE.Mesh(geometry,
  new THREE.MeshBasicMaterial({ color: 0x4c9be8, side: THREE.FrontSide })));
scene.add(new THREE.Mesh(geometry,
  new THREE.MeshBasicMaterial({ color: 0xff6b6b, side: THREE.BackSide })));

${ORBIT}
orbit(camera, renderer.domElement, 3.2);
(function loop() { requestAnimationFrame(loop); renderer.render(scene, camera); }());

document.getElementById('out').textContent =
  'numbers stored   ' + CORNERS.length + '\\n' +
  'corners          ' + (CORNERS.length / 3) + '\\n' +
  'triangles        1';`,
      outputHeight: 430,
    },

    {
      type: 'markdown',
      instruction: `### Two triangles make a square

Write a second one the same way:

\`\`\`
0.0  0.0  0.0        triangle 1
1.0  0.0  0.0
1.0  1.0  0.0

0.0  0.0  0.0        triangle 2
1.0  1.0  0.0
0.0  1.0  0.0
\`\`\`

Eighteen numbers. **Count the distinct corners.** A square has four — but two
of them are written down twice, because both triangles use them.

Before you run the next cell, predict: to move one of those shared corners,
how many places would you have to change it?`,
    },

    {
      type: 'js',
      instruction: `### The same square, stored two ways

Three buttons.

- **Shared** — four corners in one list; each triangle says *which* of them it
  uses, by position.
- **Separate** — every triangle carries its own copy. Six corners for a
  four-corner square.
- **Pull apart** — try to drag the two triangles away from each other.

**That third button is the demonstration.** In *separate* they come apart,
because they are two independent surfaces that happen to be touching — and now
you can see two triangles, each with its own three edges, and the diagonal
drawn twice.

In *shared* nothing comes apart. There is nothing to pull: both triangles name
the same two corners, so moving one moves the other. The whole square just
sits there.

Each triangle's outline is drawn in its own colour, so you can count the edges.`,
      html: `${THREE_CDN}
<div style="display:flex;gap:8px;padding:8px 2px;flex-wrap:wrap">
  <button id="bShared" style="background:#1e3a5f;color:#dbeafe;border:1px solid #3b6ea5;border-radius:5px;padding:6px 14px;cursor:pointer;font:12px ui-monospace,monospace">Shared</button>
  <button id="bSep" style="background:#2b313a;color:#d7dade;border:1px solid #3d4550;border-radius:5px;padding:6px 14px;cursor:pointer;font:12px ui-monospace,monospace">Separate</button>
  <button id="bPull" style="background:#3a2b3f;color:#f0d7f5;border:1px solid #6a4a75;border-radius:5px;padding:6px 14px;cursor:pointer;font:12px ui-monospace,monospace">Pull apart</button>
</div>
<div id="app" style="width:100%;height:320px;background:#0a0f1e;border-radius:8px"></div>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:8px 2px;white-space:pre"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `var app = document.getElementById('app');
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(45, app.clientWidth / 320, 0.1, 100);
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(app.clientWidth, 320);
app.appendChild(renderer.domElement);

var mode = 'shared';
var pull = 0;            // how far apart to drag the two triangles

// SHARED: four corners. Triangle 2 reuses corners 0 and 2.
function shared() {
  return {
    label: 'shared',
    points: [[-0.7,-0.7,0], [0.7,-0.7,0], [0.7,0.7,0], [-0.7,0.7,0]],
    tris: [[0,1,2],[0,2,3]],
  };
}

// SEPARATE: six corners. Triangle 2 has its OWN copies of the two it shares.
function separate() {
  return {
    label: 'separate',
    points: [
      [-0.7,-0.7,0], [0.7,-0.7,0], [0.7,0.7,0],       // triangle 1
      [-0.7,-0.7,0], [0.7,0.7,0],  [-0.7,0.7,0],      // triangle 2 - copies
    ],
    tris: [[0,1,2],[3,4,5]],
  };
}

// Pulling apart moves each TRIANGLE's own points. With shared corners, the
// two triangles name the same points - so asking to move triangle 1's
// corners moves triangle 2's as well, and nothing separates.
function applyPull(model) {
  if (!pull) return model;
  var moved = model.points.map(function (p) { return p.slice(); });
  var away = [-0.55, 0.55, 0];                        // perpendicular-ish
  model.tris.forEach(function (t, n) {
    var sign = (n === 0) ? 1 : -1;
    t.forEach(function (i) {
      moved[i] = [
        moved[i][0] + away[0] * pull * sign,
        moved[i][1] + away[1] * pull * sign,
        moved[i][2],
      ];
    });
  });
  return { label: model.label, points: moved, tris: model.tris };
}

var drawn = [];

function build() {
  drawn.forEach(function (o) { scene.remove(o); });
  drawn = [];

  var model = applyPull(mode === 'shared' ? shared() : separate());

  // One filled mesh and one outline PER TRIANGLE, each its own colour, so
  // the edges can be counted.
  var colours = [0x4c9be8, 0x2ecc71];
  model.tris.forEach(function (t, n) {
    var flat = [];
    t.forEach(function (i) { flat.push(model.points[i][0], model.points[i][1], model.points[i][2]); });

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(flat), 3));

    var face = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: colours[n], side: THREE.DoubleSide, transparent: true, opacity: 0.45 }));
    scene.add(face); drawn.push(face);

    // Its three edges, closed back to the first corner.
    var loop = flat.concat([flat[0], flat[1], flat[2]]);
    var lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(loop), 3));
    var outline = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: colours[n] }));
    scene.add(outline); drawn.push(outline);
  });

  // One dot per STORED point.
  var dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.BufferAttribute(
    new Float32Array([].concat.apply([], model.points)), 3));
  var dots = new THREE.Points(dotGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.075 }));
  scene.add(dots); drawn.push(dots);

  var seen = {};
  model.points.forEach(function (p) { seen[p.join(',')] = 1; });

  document.getElementById('out').textContent =
    'storage          ' + model.label + '\\n' +
    'points stored    ' + model.points.length + '\\n' +
    'distinct corners ' + Object.keys(seen).length + '\\n' +
    'edges drawn      ' + (model.tris.length * 3) + '  (3 per triangle)\\n' +
    'indices          ' + JSON.stringify(model.tris) + '\\n' +
    'pulled apart     ' + (pull ? 'yes' : 'no') +
      (pull && model.label === 'shared'
        ? '   <- nothing moved apart: both triangles name the same corners'
        : '');
}

${ORBIT}
orbit(camera, renderer.domElement, 3.0);
(function loopFrame() { requestAnimationFrame(loopFrame); renderer.render(scene, camera); }());

document.getElementById('bShared').onclick = function () { mode = 'shared'; build(); };
document.getElementById('bSep').onclick    = function () { mode = 'separate'; build(); };
document.getElementById('bPull').onclick   = function () { pull = pull ? 0 : 1; build(); };
build();`,
      outputHeight: 500,
    },

    {
      type: 'markdown',
      instruction: `### Vertices plus indices equals mesh

\`\`\`
points      [[0,0,0], [1,0,0], [1,1,0], [0,1,0]]      one xyz per corner
                 0         1        2        3         <- their positions

triangles   [[0,1,2], [0,2,3]]                        three INDICES each
\`\`\`

**A triangle does not hold coordinates. It holds three numbers saying which
points its corners are.**

That indirection is the whole reason a mesh is useful. When two triangles name
the same point they *meet* there — and "meet" is something a program can work
with. Which triangles surround this corner? What is next to this face? Is this
surface closed?

In the separate version none of those can be answered. Two triangles that
touch have no number in common, so nothing in the data says they touch.

### Why triangles, and not squares

Any three points lie in exactly one flat plane. Four points generally do not —
they can be bent, like a warped playing card.

So a triangle is the biggest shape *guaranteed* flat, which makes it the only
one where "which pixels are inside this" has a single answer. That is the
reason everything in graphics is triangles. Not tradition, not hardware.

### Where this bites, immediately

An STL — the file every CAM system exports — stores the **separate** form.
Three full corners per triangle, no indices at all. On a real machined part:

\`\`\`
stored corners     64,938
distinct corners   10,825
triangles          21,646
\`\`\`

64,938 is exactly 21,646 × 3. A corner where six triangles meet is written six
times. Working out which of those are the same point is the first job of any
mesh tool, and it is Lesson 3.`,
    },

    {
      type: 'js',
      instruction: `### Unfold it

**Drag the fold slider.** The cube opens out into a flat net, the way a dice
template is printed before it is cut and folded. Every corner carries its own
number and its own colour.

Six faces, four corners each, is **24 corner-slots**. But a cube only has
**8 corners**. So the same number has to turn up more than once — and the
question worth asking is how many times, and where.

Watch the \`distinct points\` line in the readout as you drag.

- **Folded: 8.** Three faces meet at each corner and all three agree where it
  is, so every slot with the same number sits at the same place.
- **Flat: 14.** Not 24, and not 8. Some numbers stayed put and some split.

**Stop on that 14.** A dice net is not six loose squares. Some of its edges are
*folds*, which stay joined, and the rest are *cuts*, which come apart. Corner 0
has folds on both sides of it, so on the paper it is still one point that three
panels share. Corner 3 has cuts either side, so it prints in three separate
places and you glue them back together. Click 0, then click 3, and look at the
difference.

**Now drag the second slider.** It shrinks each panel away from its neighbours
so nothing is shared at all, and the count reaches **24** — six separate
squares with no corner in common.

Those three numbers are one shape described three ways: **24 corners with
nothing shared, 14 with some shared, 8 with everything shared.** The cube never
changed. Only the bookkeeping did, and that bookkeeping is the whole subject of
the next lesson.

Click a number to light up just that one and follow it round.

One more thing to notice before you go on. Each panel has a **faint yellow line
across it**, corner 0 to corner 2. That is not decoration: a panel is not a
square as far as the computer is concerned, it is *two triangles*, and that line
is where they meet. Both triangles use the two corners at its ends. The next
cell is about nothing but those shared lines.

**Before you move on, predict two things.** The front face uses corners
0, 1, 5, 4 — which four does the top use? And with the panels pulled fully
apart, what should the count be for a single square drawn as two triangles?
Work both out before you look.`,
      html: `${THREE_CDN}
<div style="display:flex;gap:5px;padding:8px 2px;flex-wrap:wrap;align-items:center">
  <span style="color:#7d8794;font:11px ui-monospace,monospace;margin-right:4px">corner</span>
  <button data-c="0" style="background:#2b313a;color:#d7dade;border:1px solid #3d4550;border-radius:4px;padding:4px 9px;cursor:pointer;font:11px ui-monospace,monospace">0</button>
  <button data-c="1" style="background:#2b313a;color:#d7dade;border:1px solid #3d4550;border-radius:4px;padding:4px 9px;cursor:pointer;font:11px ui-monospace,monospace">1</button>
  <button data-c="2" style="background:#2b313a;color:#d7dade;border:1px solid #3d4550;border-radius:4px;padding:4px 9px;cursor:pointer;font:11px ui-monospace,monospace">2</button>
  <button data-c="3" style="background:#2b313a;color:#d7dade;border:1px solid #3d4550;border-radius:4px;padding:4px 9px;cursor:pointer;font:11px ui-monospace,monospace">3</button>
  <button data-c="4" style="background:#2b313a;color:#d7dade;border:1px solid #3d4550;border-radius:4px;padding:4px 9px;cursor:pointer;font:11px ui-monospace,monospace">4</button>
  <button data-c="5" style="background:#2b313a;color:#d7dade;border:1px solid #3d4550;border-radius:4px;padding:4px 9px;cursor:pointer;font:11px ui-monospace,monospace">5</button>
  <button data-c="6" style="background:#2b313a;color:#d7dade;border:1px solid #3d4550;border-radius:4px;padding:4px 9px;cursor:pointer;font:11px ui-monospace,monospace">6</button>
  <button data-c="7" style="background:#2b313a;color:#d7dade;border:1px solid #3d4550;border-radius:4px;padding:4px 9px;cursor:pointer;font:11px ui-monospace,monospace">7</button>
  <button data-c="all" style="background:#1e3a5f;color:#dbeafe;border:1px solid #3b6ea5;border-radius:4px;padding:4px 9px;cursor:pointer;font:11px ui-monospace,monospace">all</button>
</div>
<div style="padding:4px 2px 6px">
  <input id="fold" type="range" min="0" max="1" step="0.01" value="1" style="width:100%">
  <div style="display:flex;justify-content:space-between;color:#7d8794;font:10px ui-monospace,monospace">
    <span>flat (printed)</span><span>folded (a cube)</span>
  </div>
</div>
<div style="padding:2px 2px 8px">
  <input id="spread" type="range" min="0" max="1" step="0.01" value="0" style="width:100%">
  <div style="display:flex;justify-content:space-between;color:#7d8794;font:10px ui-monospace,monospace">
    <span>panels joined</span><span>panels apart</span>
  </div>
</div>
<div id="app" style="width:100%;height:330px;background:#0a0f1e;border-radius:8px"></div>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:8px 2px;white-space:pre"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `// The eight corners, numbered as in Lesson 1.
var CORNERS = [
  [-0.5,-0.5,-0.5], [0.5,-0.5,-0.5], [0.5,0.5,-0.5], [-0.5,0.5,-0.5],
  [-0.5,-0.5, 0.5], [0.5,-0.5, 0.5], [0.5,0.5, 0.5], [-0.5,0.5, 0.5],
];

// Each face: the four corners it is made of, and where each of those lands
// when the cube is cut open and laid flat. The two lists line up - corner
// FACES[f].corners[i] goes to FACES[f].flat[i].
var FACES = [
  { name: 'front',  corners: [0,1,5,4], flat: [[-0.5,-0.5],[ 0.5,-0.5],[ 0.5, 0.5],[-0.5, 0.5]] },
  { name: 'bottom', corners: [0,3,2,1], flat: [[-0.5,-0.5],[-0.5,-1.5],[ 0.5,-1.5],[ 0.5,-0.5]] },
  { name: 'top',    corners: [4,5,6,7], flat: [[-0.5, 0.5],[ 0.5, 0.5],[ 0.5, 1.5],[-0.5, 1.5]] },
  { name: 'right',  corners: [1,2,6,5], flat: [[ 0.5,-0.5],[ 1.5,-0.5],[ 1.5, 0.5],[ 0.5, 0.5]] },
  { name: 'left',   corners: [3,0,4,7], flat: [[-1.5,-0.5],[-0.5,-0.5],[-0.5, 0.5],[-1.5, 0.5]] },
  { name: 'back',   corners: [2,3,7,6], flat: [[ 1.5,-0.5],[ 2.5,-0.5],[ 2.5, 0.5],[ 1.5, 0.5]] },
];

// The net above runs from x = -1.5 to x = 2.5, so its middle is at x = 0.5,
// but the camera always looks at the origin. Slide the whole net left by half
// a unit so it is centred on screen. The folded cube is already centred, so
// this only moves the flat end.
var NET_SHIFT_X = -0.5;

// One colour per corner NUMBER, so the same number is the same colour
// wherever it turns up.
var COLOURS = [0xff6b6b, 0xffa94d, 0xffd43b, 0x69db7c,
               0x38d9a9, 0x4dabf7, 0xb197fc, 0xf783ac];

var app = document.getElementById('app');
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(45, app.clientWidth / 330, 0.1, 100);
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(app.clientWidth, 330);
app.appendChild(renderer.domElement);

var highlight = 'all';
var drawn = [];

// Straight-line interpolation between where a corner sits on the flat net
// and where it sits on the folded cube. Not a rigid hinge - a real fold
// rotates about each edge - but the two ends are exact, which is what the
// picture is for.
function place(face, i, t, spread) {
  var folded = CORNERS[face.corners[i]];
  var flatX = face.flat[i][0] + NET_SHIFT_X;
  var flatY = face.flat[i][1];
  var p = [
    flatX + (folded[0] - flatX) * t,
    flatY + (folded[1] - flatY) * t,
    0     + (folded[2] - 0)     * t,
  ];
  if (!spread) return p;

  // Shrink the panel towards its own middle. The shape of each panel is
  // unchanged - they just stop touching, so a corner that two panels used to
  // share becomes two separate points. That is the whole difference between
  // 8, 14 and 24 in the readout.
  var mid = [0, 0, 0];
  for (var k = 0; k < 4; k++) {
    var q = placeJoined(face, k, t);
    mid[0] += q[0] / 4; mid[1] += q[1] / 4; mid[2] += q[2] / 4;
  }
  var shrink = 1 - 0.22 * spread;
  return [0, 1, 2].map(function (a) { return mid[a] + (p[a] - mid[a]) * shrink; });
}

// place() without the shrink, so the panel's middle can be worked out without
// calling place() from inside itself.
function placeJoined(face, i, t) {
  return place(face, i, t, 0);
}

// How many separate points are on screen right now. Two slots landing on the
// same spot count once - which is the only reason 24, 14 and 8 differ.
function distinctPoints(t, spread) {
  var seen = {};
  FACES.forEach(function (face) {
    [0,1,2,3].forEach(function (i) {
      var p = place(face, i, t, spread);
      seen[p.map(function (v) { return v.toFixed(5); }).join(',')] = true;
    });
  });
  return Object.keys(seen).length;
}

// A corner's NUMBER, drawn on a small canvas and hung in the scene as a
// sprite. A sprite always turns to face the camera, so the digit stays
// readable however you orbit. One per number, made once and reused.
var LABELS = COLOURS.map(function (colour, n) {
  var canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#' + colour.toString(16).padStart(6, '0');
  ctx.beginPath(); ctx.arc(32, 32, 26, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0a0f1e';
  ctx.font = 'bold 40px ui-monospace, monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(n), 32, 34);
  return new THREE.CanvasTexture(canvas);
});

function build(t, spread) {
  drawn.forEach(function (o) { scene.remove(o); });
  drawn = [];
  var lines = [];

  FACES.forEach(function (face) {
    var pts = [0,1,2,3].map(function (i) { return place(face, i, t, spread); });

    // The quad, as two triangles - which is what the next cell asks for.
    var flat = [];
    [[0,1,2],[0,2,3]].forEach(function (tri) {
      tri.forEach(function (i) { flat.push(pts[i][0], pts[i][1], pts[i][2]); });
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(flat), 3));
    var panel = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0x39414d, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }));
    scene.add(panel); drawn.push(panel);

    // Its outline, and the diagonal where its two triangles meet. Without
    // that diagonal a panel looks like one square, and the next cell is
    // entirely about the line you would not be able to see.
    var loop = [];
    [0,1,2,3,0].forEach(function (i) { loop.push(pts[i][0], pts[i][1], pts[i][2]); });
    var lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(loop), 3));
    var outline = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x5a6472 }));
    scene.add(outline); drawn.push(outline);

    var diag = new THREE.BufferGeometry();
    diag.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      pts[0][0], pts[0][1], pts[0][2], pts[2][0], pts[2][1], pts[2][2],
    ]), 3));
    var split = new THREE.Line(diag, new THREE.LineBasicMaterial({
      color: 0xffd43b, transparent: true, opacity: 0.45 }));
    scene.add(split); drawn.push(split);

    // The numbered label at each corner. Same number, same colour, wherever
    // it turns up - which is the thing to watch as the net opens.
    [0,1,2,3].forEach(function (i) {
      var n = face.corners[i];
      var lit = (highlight === 'all' || highlight === n);
      var tag = new THREE.Sprite(new THREE.SpriteMaterial({
        map: LABELS[n], transparent: true, opacity: lit ? 1 : 0.22,
        depthTest: false }));
      tag.scale.setScalar(lit ? 0.30 : 0.19);
      tag.position.set(pts[i][0], pts[i][1], pts[i][2]);
      scene.add(tag); drawn.push(tag);
    });

    if (highlight !== 'all' && face.corners.indexOf(highlight) !== -1) {
      lines.push(face.name);
    }
  });

  var n = distinctPoints(t, spread);
  var note = n === 8  ? 'a folded cube - every shared corner agrees'
           : n === 24 ? 'nothing shared at all - six separate squares'
           : n === 14 ? 'the printed net - folds stay joined, cuts came apart'
           : 'part way';

  document.getElementById('out').textContent =
    'corner-slots    24   (6 faces x 4 corners)' +
    '\\n' +
    'distinct points ' + (n < 10 ? ' ' : '') + n + '   <- ' + note +
    '\\n' +
    'fold ' + (t === 0 ? 'flat  ' : t === 1 ? 'folded' : t.toFixed(2)) +
    '   panels ' + (spread === 0 ? 'joined' : spread === 1 ? 'apart ' : spread.toFixed(2)) +
    '\\n\\n' +
    (highlight === 'all'
      ? 'Click a number to follow one corner. Watch the count as you drag.'
      : 'corner ' + highlight + ' is on ' + lines.length + ' faces: ' + lines.join(', '));
}

${ORBIT}
var replace = orbit(camera, renderer.domElement, 4.4);
(function loopFrame() { requestAnimationFrame(loopFrame); renderer.render(scene, camera); }());

var foldSlider = document.getElementById('fold');
var spreadSlider = document.getElementById('spread');
function redraw() {
  build(Number(foldSlider.value), Number(spreadSlider.value));
}
foldSlider.addEventListener('input', redraw);
spreadSlider.addEventListener('input', redraw);

Array.prototype.forEach.call(document.querySelectorAll('button[data-c]'), function (b) {
  b.addEventListener('click', function () {
    var v = b.getAttribute('data-c');
    highlight = (v === 'all') ? 'all' : Number(v);
    redraw();
  });
});

redraw();`,
      outputHeight: 560,
    },

    {
      type: 'js',
      instruction: `### The shared edges

Corners were the easy half. This is the half that matters.

A triangle has three edges. Twelve triangles means **36 edge-slots** — and
just like the corners, most of them are the same edge counted more than once.

**Fold it up and read the count.** 36 slots, **18 distinct edges**, and every
single one is **used by exactly two triangles**.

That sentence is the definition of a closed solid, so it is worth saying
plainly: an edge with two triangles on it is a seam, and an edge with only one
triangle on it is **a hole you can see through**. Nothing else distinguishes a
watertight part from a broken one.

Use the stepper. Pick a triangle and the readout names its three edges and, for
each one, which other triangle is on the other side:

- two of them lead to a **neighbouring face** — drawn blue
- one leads to the **other triangle of the same face**, across the diagonal —
  drawn yellow

That third one catches people out. Face corners 0,1,5,4 split into [0,1,5] and
[0,5,4], and both of those contain 0 and 5. The diagonal 0–5 is shared, which
is exactly why the split has to be \`[a,b,c]\` and \`[a,c,d]\` and not any two
triangles you like.

**Predict before you drag anything.** Lay the net flat. Some seams will come
apart, so the count of distinct edges must go up and some edges will have only
one triangle. How many of the cube's 12 edges get cut, and how many stay as
folds? Work it out from the net in the cell above — then drag and check.

**Then pull the triangles apart.** Note that this slider goes further than the
one in the cell above. There the six panels came away from each other, but each
panel's own two triangles still met along their diagonal — six edges stayed
shared and the count stopped at 30. This one separates all twelve triangles, so
every slot becomes its own edge: **36 distinct, every one open, nothing shared
with anything.**

**That last state is what an STL file is.** An STL stores twelve triangles as
thirty-six independent corners and records no sharing whatsoever. Every blue
and yellow line you can see here is absent from the file — it has to be worked
out again from the numbers, and working it out is what the next lesson does.

So the edges tell the same story the corners did, one level up:

| | corners | edges |
|---|---|---|
| slots written down | 24 | 36 |
| folded, everything shared | 8 | 18 |
| flat as a printed net | 14 | 25 |
| nothing shared — an STL | 24 | 36 |

The shape never changed once.`,
      html: `${THREE_CDN}
<div style="display:flex;gap:6px;padding:8px 2px;flex-wrap:wrap;align-items:center">
  <button id="prev" style="background:#2b313a;color:#d7dade;border:1px solid #3d4550;border-radius:4px;padding:4px 10px;cursor:pointer;font:11px ui-monospace,monospace">&#9664; prev</button>
  <button id="next" style="background:#2b313a;color:#d7dade;border:1px solid #3d4550;border-radius:4px;padding:4px 10px;cursor:pointer;font:11px ui-monospace,monospace">next &#9654;</button>
  <button id="all" style="background:#1e3a5f;color:#dbeafe;border:1px solid #3b6ea5;border-radius:4px;padding:4px 10px;cursor:pointer;font:11px ui-monospace,monospace">all 12</button>
  <span style="flex:1"></span>
  <span style="color:#4dabf7;font:11px ui-monospace,monospace">&#9644; between faces</span>
  <span style="color:#ffd43b;font:11px ui-monospace,monospace">&#9644; the diagonal</span>
  <span style="color:#ff6b6b;font:11px ui-monospace,monospace">&#9644; open</span>
</div>
<div style="padding:4px 2px 6px">
  <input id="fold" type="range" min="0" max="1" step="0.01" value="1" style="width:100%">
  <div style="display:flex;justify-content:space-between;color:#7d8794;font:10px ui-monospace,monospace">
    <span>flat</span><span>folded</span>
  </div>
</div>
<div style="padding:2px 2px 8px">
  <input id="spread" type="range" min="0" max="1" step="0.01" value="0" style="width:100%">
  <div style="display:flex;justify-content:space-between;color:#7d8794;font:10px ui-monospace,monospace">
    <span>triangles joined</span><span>all 12 apart</span>
  </div>
</div>
<div id="app" style="width:100%;height:330px;background:#0a0f1e;border-radius:8px"></div>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:8px 2px;white-space:pre"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `// The same eight corners and six faces as the cell above.
var CORNERS = [
  [-0.5,-0.5,-0.5], [0.5,-0.5,-0.5], [0.5,0.5,-0.5], [-0.5,0.5,-0.5],
  [-0.5,-0.5, 0.5], [0.5,-0.5, 0.5], [0.5,0.5, 0.5], [-0.5,0.5, 0.5],
];
var FACES = [
  { name: 'front',  corners: [0,1,5,4], flat: [[-0.5,-0.5],[ 0.5,-0.5],[ 0.5, 0.5],[-0.5, 0.5]] },
  { name: 'bottom', corners: [0,3,2,1], flat: [[-0.5,-0.5],[-0.5,-1.5],[ 0.5,-1.5],[ 0.5,-0.5]] },
  { name: 'top',    corners: [4,5,6,7], flat: [[-0.5, 0.5],[ 0.5, 0.5],[ 0.5, 1.5],[-0.5, 1.5]] },
  { name: 'right',  corners: [1,2,6,5], flat: [[ 0.5,-0.5],[ 1.5,-0.5],[ 1.5, 0.5],[ 0.5, 0.5]] },
  { name: 'left',   corners: [3,0,4,7], flat: [[-1.5,-0.5],[-0.5,-0.5],[-0.5, 0.5],[-1.5, 0.5]] },
  { name: 'back',   corners: [2,3,7,6], flat: [[ 1.5,-0.5],[ 2.5,-0.5],[ 2.5, 0.5],[ 1.5, 0.5]] },
];
var NET_SHIFT_X = -0.5;

// Split each face the way the challenge asks: a square a,b,c,d becomes
// [a,b,c] and [a,c,d]. Two per face, twelve in all. TRI_FACE remembers which
// face each triangle came off, which is what lets us tell a diagonal from a
// seam between two faces.
var TRIANGLES = [];
var TRI_FACE = [];
FACES.forEach(function (f) {
  TRIANGLES.push([f.corners[0], f.corners[1], f.corners[2]]); TRI_FACE.push(f);
  TRIANGLES.push([f.corners[0], f.corners[2], f.corners[3]]); TRI_FACE.push(f);
});

var BETWEEN  = 0x4dabf7;   // two triangles, on different faces
var DIAGONAL = 0xffd43b;   // two triangles, both on the same face
var OPEN     = 0xff6b6b;   // one triangle only: a hole

var app = document.getElementById('app');
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(45, app.clientWidth / 330, 0.1, 100);
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(app.clientWidth, 330);
app.appendChild(renderer.domElement);

var focus = null;      // null = show all twelve, otherwise a triangle index
var drawn = [];

// Where corner n of a face sits once the cube is folded by t. Same fold as
// the cell above; nothing is separated yet.
function foldPos(face, n, t) {
  var i = face.corners.indexOf(n);
  var folded = CORNERS[n];
  var flatX = face.flat[i][0] + NET_SHIFT_X, flatY = face.flat[i][1];
  return [
    flatX + (folded[0] - flatX) * t,
    flatY + (folded[1] - flatY) * t,
    folded[2] * t,
  ];
}

// Corner n of triangle ti, after shrinking that TRIANGLE towards its own
// middle.
//
// This goes one step further than the cell above. There the six panels came
// apart from each other, but each panel's two triangles still shared their
// diagonal - so six edges stayed shared and the count stopped at 30. Here
// every triangle comes away from every other, which is the only way to get to
// 36 with nothing shared at all.
function at(ti, n, t, spread) {
  var face = TRI_FACE[ti];
  var p = foldPos(face, n, t);
  if (!spread) return p;
  var mid = [0, 0, 0];
  TRIANGLES[ti].forEach(function (m) {
    var q = foldPos(face, m, t);
    mid[0] += q[0] / 3; mid[1] += q[1] / 3; mid[2] += q[2] / 3;
  });
  var shrink = 1 - 0.25 * spread;
  return [0, 1, 2].map(function (a) { return mid[a] + (p[a] - mid[a]) * shrink; });
}
function keyOf(p) {
  return p.map(function (v) { return v.toFixed(5); }).join(',');
}

// Walk all 36 edge-slots and group the ones that land in the same place. An
// edge is identified by WHERE its two ends are, not by the corner numbers, so
// two panels that have come apart count as two separate edges even though
// they are the same edge of the cube.
function edgeGroups(t, spread) {
  var groups = {};
  TRIANGLES.forEach(function (tri, ti) {
    for (var k = 0; k < 3; k++) {
      var n1 = tri[k], n2 = tri[(k + 1) % 3];
      var p1 = at(ti, n1, t, spread), p2 = at(ti, n2, t, spread);
      var a = keyOf(p1), b = keyOf(p2);
      var id = a < b ? a + '|' + b : b + '|' + a;
      if (!groups[id]) groups[id] = { p1: p1, p2: p2, tris: [] };
      groups[id].tris.push(ti);
    }
  });
  return groups;
}

function idFor(ti, n1, n2, t, spread) {
  var a = keyOf(at(ti, n1, t, spread)), b = keyOf(at(ti, n2, t, spread));
  return a < b ? a + '|' + b : b + '|' + a;
}

function colourOf(g) {
  if (g.tris.length === 1) return OPEN;
  return TRI_FACE[g.tris[0]] === TRI_FACE[g.tris[1]] ? DIAGONAL : BETWEEN;
}

// A line thick enough to see. LineBasicMaterial ignores linewidth on most
// machines, so each edge is a thin cylinder instead.
function tube(p1, p2, colour, radius, opacity) {
  var a = new THREE.Vector3(p1[0], p1[1], p1[2]);
  var b = new THREE.Vector3(p2[0], p2[1], p2[2]);
  var dir = new THREE.Vector3().subVectors(b, a);
  var len = dir.length();
  if (len < 1e-9) return null;
  var mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, len, 6),
    new THREE.MeshBasicMaterial({
      color: colour, transparent: opacity < 1, opacity: opacity }));
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

function clear() {
  drawn.forEach(function (o) {
    scene.remove(o);
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  drawn = [];
}

function build(t, spread) {
  clear();
  var groups = edgeGroups(t, spread);

  // The triangles themselves, faint, so the edges are what you look at.
  TRIANGLES.forEach(function (tri, ti) {
    var xyz = [];
    tri.forEach(function (n) {
      var p = at(ti, n, t, spread);
      xyz.push(p[0], p[1], p[2]);
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(xyz), 3));
    var lit = (focus === null || focus === ti);
    var mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: focus === ti ? 0x6d7a8c : 0x39414d,
      side: THREE.DoubleSide, transparent: true, opacity: lit ? 0.5 : 0.12 }));
    scene.add(mesh); drawn.push(mesh);
  });

  // Every distinct edge, coloured by how many triangles use it.
  var focusIds = {};
  if (focus !== null) {
    var ft = TRIANGLES[focus];
    for (var k = 0; k < 3; k++) {
      focusIds[idFor(focus, ft[k], ft[(k + 1) % 3], t, spread)] = true;
    }
  }
  Object.keys(groups).forEach(function (id) {
    var g = groups[id];
    var picked = (focus === null) || focusIds[id];
    var seg = tube(g.p1, g.p2, colourOf(g),
                   picked ? 0.022 : 0.008, picked ? 1 : 0.3);
    if (seg) { scene.add(seg); drawn.push(seg); }
  });

  report(groups, t, spread);
}

function pad(n) { return (n < 10 ? '  ' : n < 100 ? ' ' : '') + n; }

function report(groups, t, spread) {
  var ids = Object.keys(groups);
  var twice = 0, once = 0;
  ids.forEach(function (id) {
    if (groups[id].tris.length === 2) twice++;
    if (groups[id].tris.length === 1) once++;
  });

  var lines = [
    'edge-slots      36   (12 triangles x 3 edges)',
    'distinct edges ' + pad(ids.length),
    'used by 2      ' + pad(twice) + (once === 0 ? '   every edge is a seam: a closed solid' : ''),
    'used by 1      ' + pad(once)  + (once > 0 ? '   open - you can see through there' : ''),
    'fold ' + (t === 0 ? 'flat  ' : t === 1 ? 'folded' : t.toFixed(2)) +
      '   triangles ' + (spread === 0 ? 'joined' : spread === 1 ? 'apart ' : spread.toFixed(2)),
    '',
  ];

  if (focus === null) {
    lines.push('Step through the triangles to see which one is on the other');
    lines.push('side of each edge.');
  } else {
    var tri = TRIANGLES[focus], face = TRI_FACE[focus];
    lines.push('triangle ' + (focus + 1) + ' of 12   [' + tri.join(',') +
               ']   on the ' + face.name + ' face');
    for (var k = 0; k < 3; k++) {
      var n1 = tri[k], n2 = tri[(k + 1) % 3];
      var g = groups[idFor(focus, n1, n2, t, spread)];
      var other = null;
      g.tris.forEach(function (x) { if (x !== focus) other = x; });
      if (other === null) {
        lines.push('  edge ' + n1 + '-' + n2 + '   nothing on the other side: open');
      } else if (TRI_FACE[other] === face) {
        lines.push('  edge ' + n1 + '-' + n2 + '   triangle ' + (other + 1) +
                   ', same face - this is the diagonal');
      } else {
        lines.push('  edge ' + n1 + '-' + n2 + '   triangle ' + (other + 1) +
                   ', on the ' + TRI_FACE[other].name + ' face');
      }
    }
  }
  document.getElementById('out').textContent = lines.join('\\n');
}

${ORBIT}
orbit(camera, renderer.domElement, 4.4);
(function frame() { requestAnimationFrame(frame); renderer.render(scene, camera); }());

var foldSlider = document.getElementById('fold');
var spreadSlider = document.getElementById('spread');
function redraw() {
  build(Number(foldSlider.value), Number(spreadSlider.value));
}
foldSlider.addEventListener('input', redraw);
spreadSlider.addEventListener('input', redraw);

document.getElementById('next').addEventListener('click', function () {
  focus = (focus === null) ? 0 : (focus + 1) % 12;
  redraw();
});
document.getElementById('prev').addEventListener('click', function () {
  focus = (focus === null) ? 11 : (focus + 11) % 12;
  redraw();
});
document.getElementById('all').addEventListener('click', function () {
  focus = null;
  redraw();
});

redraw();`,
      outputHeight: 620,
    },

    {
      type: 'challenge',
      instruction: `### 🎯 Build a cube

\`CORNERS\` holds the 8 distinct corners, already written. Your job is
\`TRIANGLES\` — 12 of them, two per face, six faces. **Indices only, no
coordinates.**

\`\`\`
z = -0.5 (bottom)      z = +0.5 (top)
  3 ---- 2               7 ---- 6
  |      |               |      |
  0 ---- 1               4 ---- 5
\`\`\`

The bottom face is done as the pattern: a square \`a,b,c,d\` becomes
\`[a,b,c]\` and \`[a,c,d]\`.

**The other five are not given.** Go back to the unfold and read them off —
lay the net flat, or click a corner number and see which faces it belongs to.
That is what the net is for.

Keep the split rule the way the last cell showed it: both triangles of a face
must share the diagonal. \`[a,b,c]\` and \`[a,c,d]\` do. \`[a,b,c]\` and
\`[b,c,d]\` do not — those two overlap and leave a gap.

**One thing will catch you, and it caught this lesson.** The order you list a
face's four corners in decides which way it faces. The bottom face above is
written \`0,3,2,1\`, not \`0,1,2,3\` — because going round the bottom the same
direction as the top makes both loops turn the same way *in space*, and for the
bottom that is into the solid. It draws dark or vanishes when you look up at it
from underneath.

You do not have to get that right to pass. The check accepts a cube with faces
turned the wrong way, tells you how many, and lets you turn it round and see
them. **Which way a triangle faces, and what decides it, is the whole of the
next lesson.**

It draws what you write, so a face you miss is a hole you can turn round and
look through — and a face wound the wrong way shows red from outside.`,
      html: `${THREE_CDN}
<div id="app" style="width:100%;height:320px;background:#0a0f1e;border-radius:8px"></div>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:8px 2px;white-space:pre"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `// The 8 distinct corners. Already done — not the exercise.
var CORNERS = [
  [-0.5,-0.5,-0.5], [0.5,-0.5,-0.5], [0.5,0.5,-0.5], [-0.5,0.5,-0.5],   // 0 1 2 3  bottom
  [-0.5,-0.5, 0.5], [0.5,-0.5, 0.5], [0.5,0.5, 0.5], [-0.5,0.5, 0.5],   // 4 5 6 7  top
];

// TODO: 12 triangles. Two per face, six faces. Indices into CORNERS.
//
// The bottom face is done, as the pattern: a square a,b,c,d becomes
// [a,b,c] and [a,c,d].
//
// Note its corner order: 0,3,2,1 and not 0,1,2,3. Going round the bottom the
// same way you would go round the top makes it face INTO the cube, because
// the two loops then turn the same direction in space. See below.
//
// The other five faces are NOT listed. Read their corners off the unfold in
// the cell above - click a corner number to see which faces it belongs to,
// or lay the net flat and read each panel.
var TRIANGLES = [
  [0,3,2], [0,2,1],      // bottom
  // top
  // front
  // right
  // back
  // left
];

// ── draws whatever you wrote ───────────────────────────────────────────
var app = document.getElementById('app');
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(45, app.clientWidth / 320, 0.1, 100);
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(app.clientWidth, 320);
app.appendChild(renderer.domElement);

var flat = [];
TRIANGLES.forEach(function (t) {
  if (!t || t.length !== 3) return;
  t.forEach(function (i) {
    var c = CORNERS[i];
    if (c) flat.push(c[0], c[1], c[2]);
  });
});

var geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(flat), 3));
scene.add(new THREE.Mesh(geometry,
  new THREE.MeshBasicMaterial({ color: 0x4c9be8, side: THREE.FrontSide })));
scene.add(new THREE.Mesh(geometry,
  new THREE.MeshBasicMaterial({ color: 0xff6b6b, side: THREE.BackSide })));
scene.add(new THREE.LineSegments(new THREE.WireframeGeometry(geometry),
  new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })));

${ORBIT}
orbit(camera, renderer.domElement, 2.6);
(function loop() { requestAnimationFrame(loop); renderer.render(scene, camera); }());

var all = [];
TRIANGLES.forEach(function (t) { (t || []).forEach(function (i) { all.push(i); }); });
var used = {};
all.forEach(function (i) { used[i] = 1; });
var bad = all.filter(function (i) { return !(i >= 0 && i < 8); });

document.getElementById('out').textContent =
  'triangles     ' + TRIANGLES.length + '  (want 12)\\n' +
  'indices       ' + all.length + '  (want 36)\\n' +
  'corners used  ' + Object.keys(used).length + ' of 8\\n' +
  (bad.length ? 'OUT OF RANGE: ' + bad.join(', ') : 'all indices in range');`,
      check: (js) => {
        // Returns { pass, message }. The message is the point: this check is
        // strict, so a bare "no" would leave the reader hunting one digit.
        const no = (message) => ({ pass: false, message });

        const match = /var\s+TRIANGLES\s*=\s*(\[[\s\S]*?\n\];)/.exec(js);
        if (!match) return no('Could not find "var TRIANGLES = [ ... ];" — keep that line as it is and fill in the middle.');

        let tris;
        try {
          // eslint-disable-next-line no-new-func
          tris = new Function('return ' + match[1].replace(/;$/, ''))();
        } catch {
          return no('TRIANGLES is not valid JavaScript yet — check for a missing comma or bracket.');
        }

        if (!Array.isArray(tris)) return no('TRIANGLES is not a list.');
        if (tris.length !== 12) {
          return no('Found ' + tris.length + ' triangles, not 12. Six faces, two triangles each.'
            + (tris.length < 12 ? ' ' + (12 - tris.length) + ' still to go.' : ''));
        }

        const badShape = tris.findIndex((t) => !Array.isArray(t) || t.length !== 3);
        if (badShape >= 0) {
          return no('Triangle ' + (badShape + 1) + ' does not have exactly three corner numbers.');
        }

        const flat = tris.flat();
        const outOfRange = flat.find((i) => !Number.isInteger(i) || i < 0 || i > 7);
        if (outOfRange !== undefined) {
          return no('The number ' + outOfRange + ' is not a corner. CORNERS has eight entries, so the indices run 0 to 7.');
        }

        const unused = [0,1,2,3,4,5,6,7].filter((n) => flat.indexOf(n) === -1);
        if (unused.length) {
          return no('Corner ' + unused.join(' and ') + ' never appears. Every corner of a cube is on three faces, so each number should turn up more than once.');
        }

        // Three DIFFERENT corners. [3,3,4] passes every count above and has no
        // area at all — it would draw nothing, next to a green tick.
        const degenerate = tris.findIndex((t) => new Set(t).size !== 3);
        if (degenerate >= 0) {
          return no('Triangle ' + (degenerate + 1) + ' (' + tris[degenerate].join(',') + ') uses the same corner twice, so it has no area and draws nothing.');
        }

        // No triangle twice. Twelve entries where two are the same leaves a
        // hole somewhere else, which the counts alone would not notice.
        const key = (t) => t.slice().sort((a, b) => a - b).join('-');
        const keys = tris.map(key);
        const repeat = keys.find((k, i) => keys.indexOf(k) !== i);
        if (repeat) {
          return no('The triangle ' + repeat.split('-').join(',') + ' is in the list twice, which means some other face is missing.');
        }

        const CUBE = [
          [-0.5,-0.5,-0.5], [0.5,-0.5,-0.5], [0.5,0.5,-0.5], [-0.5,0.5,-0.5],
          [-0.5,-0.5, 0.5], [0.5,-0.5, 0.5], [0.5,0.5, 0.5], [-0.5,0.5, 0.5],
        ];
        const AXIS = ['x', 'y', 'z'];

        // Every triangle has to lie ON a face, not slice through the middle.
        // Its three corners must agree on one of x, y or z, and that shared
        // value must be +/-0.5 — the surface, not the inside.
        const faceOf = (t) => {
          for (const axis of [0, 1, 2]) {
            const v = CUBE[t[0]][axis];
            if (t.every((n) => CUBE[n][axis] === v) && Math.abs(v) === 0.5) {
              return AXIS[axis] + ' = ' + v;
            }
          }
          return null;
        };
        const faces = tris.map(faceOf);
        const slicing = faces.indexOf(null);
        if (slicing >= 0) {
          return no('Triangle ' + (slicing + 1) + ' (' + tris[slicing].join(',') + ') cuts through the inside of the cube. Its three corners do not all sit on one face — they need to share an x, a y or a z.');
        }

        // Six faces, two triangles each. This is what makes it a closed cube
        // rather than twelve triangles that happen to be on the surface.
        const perFace = {};
        faces.forEach((f, i) => { (perFace[f] = perFace[f] || []).push(tris[i]); });
        const named = Object.keys(perFace);
        const ALL = ['x = -0.5', 'x = 0.5', 'y = -0.5', 'y = 0.5', 'z = -0.5', 'z = 0.5'];
        const missing = ALL.filter((f) => !perFace[f]);
        if (missing.length) {
          return no('No triangles on the face ' + missing.join(' or ') + ' — that side is an open hole. Turn the cube round and you can look straight through it.');
        }
        const wrongCount = named.find((f) => perFace[f].length !== 2);
        if (wrongCount) {
          return no('The face ' + wrongCount + ' has ' + perFace[wrongCount].length + ' triangles, not 2.');
        }

        // The two triangles on a face must TILE it, not overlap it. Bottom as
        // [0,1,2] and [1,2,3] is two different triangles using all four
        // corners, and still leaves a hole — because they meet along an edge
        // instead of across the middle.
        //
        // Two corners one step apart (differing in a single coordinate) are an
        // edge of the square. Two differing in two coordinates are its
        // diagonal. A correct pair shares the diagonal.
        for (const f of named) {
          const [a, b] = perFace[f];
          const shared = a.filter((n) => b.indexOf(n) !== -1);
          const covers = new Set(a.concat(b)).size === 4;
          const diagonal = shared.length === 2 &&
            [0, 1, 2].filter((k) => CUBE[shared[0]][k] !== CUBE[shared[1]][k]).length === 2;
          if (!covers || !diagonal) {
            return no('On the face ' + f + ', the two triangles overlap instead of splitting the square in half. They should meet corner-to-corner across the middle, not along an edge: a square a,b,c,d becomes [a,b,c] and [a,c,d].');
          }
        }

        // Winding is lesson 2's subject, so it does not gate this challenge -
        // but passing a cube with faces turned inside out while saying nothing
        // is how a reader ends up trusting a wrong mesh. Count them and say.
        //
        // The cube is centred on the origin, so a triangle faces outward when
        // its cross product points the same way as its own middle.
        var inward = [];
        tris.forEach(function (t, i) {
          var A = CUBE[t[0]], B = CUBE[t[1]], C = CUBE[t[2]];
          var u = [B[0]-A[0], B[1]-A[1], B[2]-A[2]];
          var v = [C[0]-A[0], C[1]-A[1], C[2]-A[2]];
          var n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
          var mid = [(A[0]+B[0]+C[0])/3, (A[1]+B[1]+C[1])/3, (A[2]+B[2]+C[2])/3];
          if (n[0]*mid[0] + n[1]*mid[1] + n[2]*mid[2] <= 0) inward.push(i + 1);
        });

        if (inward.length) {
          return {
            pass: true,
            message: 'A closed cube \u2014 all six faces, no holes. Note: ' +
              inward.length + ' of the 12 triangles (' + inward.join(', ') +
              ') face INTO the cube, so they draw dark or vanish from outside. ' +
              'Swapping any two of a triangle\u2019s corners turns it round. ' +
              'That is the next lesson, so it is fine to leave.',
          };
        }
        return {
          pass: true,
          message: 'A closed cube, and every one of the 12 triangles faces outward.',
        };
      },
      successMessage: '✓ A cube, from 8 corners and 36 indices. Notice what you never wrote: a coordinate. The shape lives in CORNERS and the surface lives in TRIANGLES — move one corner and three faces follow, because all three point at it.',
      failMessage: 'Read the counts under the cube. 12 triangles, 36 indices, all 8 corners used, every index 0–7. Each face is four corners split into two triangles, the way the bottom face shows.',
      outputHeight: 450,
    },

  ],
};

export default {
  id: 'mesh-engine-1-1-what-a-mesh-is',
  slug: 'what-a-mesh-is',
  chapter: 'mesh-engine.1',
  order: 0,
  title: 'What a Mesh Actually Is',
  subtitle: 'Look at the triangles first. Then find out what they are made of.',
  tags: [
    'mesh', 'vertices', 'triangles', 'indices', 'indexed geometry',
    'welded', 'exploded', 'STL', 'bounds', 'numpy', 'three.js',
  ],
  aliases: 'mesh vertices triangles indices indexed geometry vertex buffer welded exploded shared vertices bounds numpy array shape axis dtype',
  timeToComplete: 45,
  coreConcept:
    'A mesh is two arrays — the distinct corner positions, and per triangle the three indices of its corners. The indirection is what lets two triangles be known to meet, and every later operation depends on it. An STL omits it and stores three private corners per triangle instead.',
  prerequisites: [],
  nextLesson: 'mesh-engine-1-2-vectors-and-triangles',

  semantics: {
    core: [
      { symbol: 'points', meaning: 'One xyz per distinct corner. Holds the shape — move a point and every triangle using it moves with it.' },
      { symbol: 'triangles', meaning: 'Three indices per triangle, pointing into points. Holds the surface — change these and the shape stays still while what-connects-to-what changes.' },
      { symbol: 'shape', meaning: 'A numpy array\'s dimensions as a tuple. (8, 3) is eight rows of three. The first thing to print when an array is not doing what you expect.' },
      { symbol: 'axis', meaning: 'Which direction to collapse when summarising. axis=0 goes down the rows, giving one answer per column; axis=1 goes across, giving one per row.' },
      { symbol: 'points[triangles]', meaning: 'Indexing an array with another array. Each index is replaced by the row it names, so (12,3) indices against (8,3) points gives (12,3,3).' },
      { symbol: 'bounds', meaning: 'Smallest and largest value on each axis. How you find out a model is in the wrong units or nowhere near the origin.' },
    ],
    rulesOfThumb: [
      'A triangle stores indices, never coordinates. Copying an xyz into the triangle list means you have left the indexed form.',
      'When an array misbehaves, print its .shape before anything else.',
      'axis=0 is the one you want for per-coordinate answers like bounds.',
      'Validate indices where the mesh is built — out of range fails far from its cause.',
      'If two triangles must be known to touch, they must share an index. Being in the same place is not enough.',
    ],
  },

  hook: {
    question: 'A square made of two triangles needs four corners. An STL file stores six. Which two are duplicated, and what can no longer be asked once they are?',
    realWorldContext: 'Every CAM system exports STL, and every STL stores three full corners per triangle with no indices. On a real machined part: 64,938 stored corners for 21,646 triangles, reducing to 10,825 distinct points. Working out which are the same point is the first job of any mesh tool, and nothing in the file helps.',
    previewVisualizationId: 'JSNotebook',
  },

  intuition: {
    prose: [
      'A triangle is nine numbers — three corners, three coordinates each. Nothing else is in it: no colour, no thickness, no material.',
      'Turn one edge-on and it disappears. A mesh is a skin, not a lump.',
      'A square made of two triangles has four distinct corners, but written out naively it takes six, with two duplicated.',
      'The fix is indirection: keep the distinct corners in one list, and have each triangle hold three positions in that list.',
      'Two triangles meet where they share an index. Without shared indices, nothing can be asked about what touches what.',
      'Any three points lie in exactly one plane; four generally do not. That is why triangles.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: describing any mesh',
        body: 'Step 1. Collect the distinct corner positions into one list.\nStep 2. Give each one an index — its position in that list.\nStep 3. For each triangle, record its three corner indices, in order.\nStep 4. Report point count, triangle count, and the bounds on each axis.\nStep 5. Check every index is at least 0 and less than the point count.',
      },
      {
        type: 'warning',
        title: 'An out-of-range index does not fail where you made it',
        body: 'Writing an index past the end of the point list raises nothing at the time. It raises later, inside a draw call or a geometry query, with a message naming that operation rather than the mistake. Validate where the mesh is built.',
      },
      {
        type: 'insight',
        title: 'Why triangles',
        body: 'Three points define exactly one plane. Four can be bent. A triangle is the largest polygon guaranteed flat, which makes it the only one where "which pixels are inside" has one answer.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'See the triangles before computing anything about them',
        caption: 'Drag to turn each one. Change the numbers and run the cell again.',
        props: {
          lesson: LESSON_MESH_1_1,
        },
      },
    ],
  },

  math: {
    prose: [
      'The drawings above resolved the indirection by hand: for each triangle, look up its three corners and push nine numbers.',
      'Doing that across 214,382 triangles needs it done to the whole array at once, which is what numpy is for.',
      'The notebook below introduces numpy against plain Python — the same job twice, so what the library saves is visible rather than asserted. It assumes no prior numpy.',
    ],
    visualizations: [
      {
        id: 'PythonNotebook',
        title: 'The same mesh, in plain Python and then in numpy',
        mathBridge: 'points[triangles] resolves the indirection for every triangle at once: an (m,3) index array against an (n,3) point array gives (m,3,3) — every triangle, its three corners, each three coordinates.',
        caption: 'Run the cells in order; each uses what the last one defined. Nothing here assumes you have used numpy before.',
        props: {
          initialCells: [
            {
              id: 1,
              cellTitle: 'Plain Python first — no numpy',
              prose: [
                'The cube from the challenge, as ordinary Python lists. Nothing new yet.',
                'The job: find the smallest and largest x, y and z — the bounding box. Written the way you would write it with no library at all.',
                'It works. Notice how much of it is loop bookkeeping rather than the actual question.',
              ],
              code: `points = [
    [0,0,0], [1,0,0], [1,1,0], [0,1,0],
    [0,0,1], [1,0,1], [1,1,1], [0,1,1],
]

triangles = [
    [0,1,2], [0,2,3],   # bottom
    [4,6,5], [4,7,6],   # top
    [0,5,1], [0,4,5],   # front
    [1,6,2], [1,5,6],   # right
    [2,7,3], [2,6,7],   # back
    [3,4,0], [3,7,4],   # left
]

print("points   ", len(points))
print("triangles", len(triangles))

# Bounds, by hand: one pass, tracking six numbers.
low = [points[0][0], points[0][1], points[0][2]]
high = [points[0][0], points[0][1], points[0][2]]
for p in points:
    for axis in range(3):
        if p[axis] < low[axis]:
            low[axis] = p[axis]
        if p[axis] > high[axis]:
            high[axis] = p[axis]

print("low      ", low)
print("high     ", high)`,
            },
            {
              id: 2,
              cellTitle: 'An array is a list that knows its shape',
              prose: [
                'numpy is a library for working on whole lists of numbers at once. Its one type is the array.',
                'An array holds the same numbers a list of lists holds — but it also knows its SHAPE: how many rows, how many columns.',
                'Read a shape right to left: (8, 3) means "8 things, each of 3 numbers". Eight corners, xyz each.',
                'Predict what triangles.shape will be before running this.',
              ],
              code: `import numpy as np

# Same numbers as cell 1. np.array turns the lists into arrays.
points = np.array([
    [0,0,0], [1,0,0], [1,1,0], [0,1,0],
    [0,0,1], [1,0,1], [1,1,1], [0,1,1],
], dtype=float)

triangles = np.array([
    [0,1,2], [0,2,3], [4,6,5], [4,7,6], [0,5,1], [0,4,5],
    [1,6,2], [1,5,6], [2,7,3], [2,6,7], [3,4,0], [3,7,4],
], dtype=np.int64)

print("points.shape   ", points.shape, "  <- 8 corners, 3 coordinates each")
print("triangles.shape", triangles.shape, "  <- 12 triangles, 3 indices each")
print()

# dtype is what kind of number is inside. Coordinates are decimals; indices
# are whole numbers and must stay whole, or they cannot look anything up.
print("points.dtype   ", points.dtype)
print("triangles.dtype", triangles.dtype)
print()

print("points[0]      ", points[0], "  <- corner 0, the whole row")
print("points[0][1]   ", points[0][1], "  <- its y")`,
            },
            {
              id: 3,
              cellTitle: 'axis — which way to collapse',
              prose: [
                'The bounds loop in cell 1 was six numbers of bookkeeping. numpy does it in one call, but you have to say which direction to collapse.',
                'An (8, 3) array is a grid: 8 rows down, 3 columns across.',
                'axis=0 collapses DOWN the rows, leaving one answer per column — three answers, one per coordinate. That is what a bounding box is.',
                'axis=1 collapses ACROSS the columns, leaving one answer per row — eight answers, one per corner. A real question, just not this one.',
                'Both are printed, so the difference is something you see rather than memorise.',
              ],
              code: `import numpy as np

points = np.array([
    [0,0,0], [1,0,0], [1,1,0], [0,1,0],
    [0,0,1], [1,0,1], [1,1,1], [0,1,1],
], dtype=float)

print("the array, as a grid:")
print(points)
print()

print("points.min(axis=0)", points.min(axis=0), " <- down the rows: one per COLUMN (x, y, z)")
print("points.min(axis=1)", points.min(axis=1), " <- across:        one per ROW (per corner)")
print()

low = points.min(axis=0)
high = points.max(axis=0)
print("low   ", low)
print("high  ", high)
print("size  ", high - low, "  <- arrays subtract elementwise, no loop")`,
            },
            {
              id: 4,
              cellTitle: 'The move this whole course rests on',
              prose: [
                'In the drawings, resolving the indirection meant a loop: for each triangle, look up its three corners.',
                'numpy does it in one expression. Index an array WITH another array and every index is replaced by the row it names.',
                'points is (8, 3). triangles is (12, 3). So points[triangles] keeps the (12, 3) arrangement and swaps each index for a row of 3 — giving (12, 3, 3).',
                'Read that as: 12 triangles, each with 3 corners, each with 3 coordinates.',
                'Predict the shape before running it.',
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

# Start small: one index gives one row.
print("points[3]         ", points[3])
print()

# A list of indices gives a row each.
print("points[[3, 5]] ->")
print(points[[3, 5]])
print()

# The whole triangle array at once.
corners = points[triangles]
print("triangles.shape        ", triangles.shape)
print("points[triangles].shape", corners.shape, "  <- 12 tris x 3 corners x 3 coords")
print()
print("triangle 0's indices", triangles[0])
print("triangle 0's corners ->")
print(corners[0])`,
            },
            {
              id: 5,
              cellTitle: 'Describing a mesh — the build milestone',
              prose: [
                'Cells 2 to 4 put together: count it, measure it, and check it is internally consistent.',
                'Step 5 of the procedure is the one that earns its place. The last few lines break the mesh on purpose to show that nothing complains at the time.',
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


def describe(points, triangles):
    """Everything a mesh can say about itself, before any geometry."""
    low = points.min(axis=0)
    high = points.max(axis=0)
    return {
        "points": len(points),
        "triangles": len(triangles),
        "corners_shape": points[triangles].shape,
        "low": low,
        "high": high,
        "size": high - low,
        # np.unique gives the distinct values. Fewer than len(points) means
        # the file carries corners nothing references.
        "points_used": len(np.unique(triangles)),
        # Step 5.
        "indices_valid": bool(triangles.min() >= 0 and triangles.max() < len(points)),
    }


for key, value in describe(points, triangles).items():
    print(f"{key:15} {value}")

print()
print("now break it on purpose:")
broken = triangles.copy()
broken[0][0] = 99                      # an index that does not exist
print("indices_valid  ", describe(points, broken)["indices_valid"])
print("Nothing raised. It would raise later, somewhere that looks unrelated.")`,
            },
            {
              id: 6,
              cellTitle: 'What the other storage costs',
              prose: [
                'Explode the cube — give every triangle private copies of its corners — and compare.',
                'This is the form an STL arrives in, and the ratio at the end is why the storage question is not academic.',
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

# reshape(-1, 3) means "3 columns, work out how many rows yourself".
exploded_points = points[triangles].reshape(-1, 3)
exploded_tris = np.arange(len(exploded_points)).reshape(-1, 3)

print(f"{'':10} {'points':>8} {'triangles':>10} {'numbers':>9}")
print(f"{'indexed':10} {len(points):>8} {len(triangles):>10} {points.size:>9}")
print(f"{'exploded':10} {len(exploded_points):>8} {len(exploded_tris):>10} {exploded_points.size:>9}")
print()
print(f"ratio  {exploded_points.size / points.size:.1f}x the coordinates, same cube")
print()
print("exploded indices are just a count:", exploded_tris[:3].tolist(), "...")
print("They carry no information. Nothing states that two triangles meet,")
print("and working that out again is Lesson 3.")`,
            },
          ],
        },
      },
    ],
  },

  examples: [
    {
      id: 'mesh-engine-1-1-ex1',
      title: 'A square, both ways',
      steps: [
        { expression: 'points = [[0,0],[1,0],[1,1],[0,1]]', annotation: 'Four distinct corners, numbered 0 to 3 by their position in the list.' },
        { expression: 'triangles = [[0,1,2],[0,2,3]]', annotation: 'Two triangles. Corners 0 and 2 appear in both — that shared pair is the diagonal.' },
        { expression: 'stored numbers = 4x2 + 2x3 = 14', annotation: 'Eight coordinates plus six indices.' },
        { expression: 'exploded = 6 points, 12 coordinates', annotation: 'Same square, private copies. Move a shared corner and only one copy follows, so it tears.' },
      ],
    },
    {
      id: 'mesh-engine-1-1-ex2',
      title: 'A cube',
      steps: [
        { expression: '8 distinct corners', annotation: 'Not 24 — each corner is shared by three faces.' },
        { expression: '6 faces x 2 triangles = 12 triangles', annotation: 'Every square face splits into two.' },
        { expression: '12 x 3 = 36 indices', annotation: 'Each of the 8 corners is referenced several times. That reuse is the point.' },
        { expression: 'exploded: 36 points instead of 8', annotation: '4.5x the coordinates for the identical shape.' },
      ],
    },
    {
      id: 'mesh-engine-1-1-ex3',
      title: 'Reading a shape',
      steps: [
        { expression: 'points.shape -> (8, 3)', annotation: 'Eight rows of three. Eight corners, xyz each.' },
        { expression: 'triangles.shape -> (12, 3)', annotation: 'Twelve rows of three. Twelve triangles, three indices each.' },
        { expression: 'points[triangles].shape -> (12, 3, 3)', annotation: 'The (12,3) arrangement is kept, and each index becomes a row of 3.' },
        { expression: 'read it right to left', annotation: '3 coordinates, in 3 corners, in 12 triangles.' },
      ],
    },
  ],

  challenges: [
    {
      id: 'mesh-engine-1-1-ch1',
      prompt: 'A triangular prism — two triangular ends and three rectangular sides. How many distinct corners, and how many triangles?',
      walkthrough: [
        { expression: '6 corners', annotation: 'Three per end, and the two ends share none.' },
        { expression: '2 + 6 = 8 triangles', annotation: 'One per triangular end, plus two per rectangular side for three sides.' },
      ],
      answer: 'A triangular prism has 6 distinct corners and 8 triangles, so 24 indices.',
    },
    {
      id: 'mesh-engine-1-1-ch2',
      prompt: 'You ask for the bounding box and get eight numbers instead of three. What did you write, and what should you have written?',
      walkthrough: [
        { expression: 'eight numbers = one per row', annotation: 'The array has 8 rows, so an answer per row means it collapsed across the columns.' },
        { expression: 'you wrote axis=1', annotation: 'That asks "the smallest coordinate within each corner" — a real question, just not this one.' },
        { expression: 'you wanted axis=0', annotation: 'Collapse down the rows, leaving one answer per column: smallest x, smallest y, smallest z.' },
      ],
      answer: 'axis=1 was used instead of axis=0. An (8,3) array collapsed across its columns gives eight answers, one per corner; a bounding box needs it collapsed down the rows, giving three. The count of numbers that come back tells you which axis you used.',
    },
    {
      id: 'mesh-engine-1-1-ch3',
      prompt: 'Somebody proposes storing meshes exploded, on the grounds that removing a layer of indirection is simpler. Give the strongest argument for their position, then the reason it is still wrong here.',
      walkthrough: [
        { expression: 'for: the GPU wants exploded', annotation: 'Genuinely true. A vertex buffer is a flat run of coordinates, and per-face colour needs unshared corners because colour lives on vertices.' },
        { expression: 'for: nothing to validate', annotation: 'Indices are just a count, so they cannot be out of range.' },
        { expression: 'against: adjacency is gone', annotation: 'Two triangles that touch share no number, so nothing can be walked, merged, simplified, or checked for holes.' },
        { expression: 'against: this application measures', annotation: 'Comparing surfaces, finding neighbours, reducing a mesh — all need adjacency. Drawing is the only thing exploded is better at.' },
      ],
      answer: 'They are right that the GPU consumes the exploded form and that it needs no index validation. But adjacency cannot be recovered without re-deriving it, and every operation beyond drawing depends on it. Keep the indexed form as the source of truth and explode only at the boundary where the GPU is handed the data.',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'A mesh is a list of triangles.',
      whyStudentsThinkIt: 'That is how it is drawn and how it is described in conversation, and the exploded form really is just a list of triangles.',
      correctionExample: 'A cube is 8 points and 12 triangles. As a plain list of triangles it is 36 points — the same shape at 4.5x the coordinates, with no way to tell two faces meet at an edge.',
      contrastCase: 'Move one corner of the indexed cube and the three faces using it follow. Move one corner of the exploded cube and it tears, because each face held its own copy.',
    },
    {
      falseBelief: 'Two triangles in the same place are known to be joined.',
      whyStudentsThinkIt: 'They look joined, and they are joined in the physical object the file describes.',
      correctionExample: 'In the exploded square, points 0 and 3 hold identical coordinates but are separate entries. Asking for triangle 1\'s neighbours returns nothing, because no index is shared.',
      contrastCase: 'A real STL of a closed solid has every edge appearing twice — as unshared duplicates. A program asking for adjacency finds none and reports the part as entirely holes.',
    },
    {
      falseBelief: 'axis=0 means the x axis.',
      whyStudentsThinkIt: 'In a lesson full of xyz, the word "axis" reads as a direction in space.',
      correctionExample: 'points.min(axis=0) on an (8,3) array returns three numbers — the smallest x, y and z. It collapsed the 8 rows, not the x column.',
      contrastCase: 'points.min(axis=1) returns eight numbers, one per corner. Neither result is about the x axis; axis names a dimension of the array, not of space.',
    },
  ],

  transferPrompts: [
    {
      situation: 'You need to give every triangle of a model its own colour, and your file format stores colour per vertex.',
      competingTechniques: ['keep the indexed mesh and store a parallel per-triangle colour array', 'explode the mesh so each triangle owns its corners'],
      whyThisTechniqueWins: 'Exploding is what the format forces, and it is why STL and coloured OBJ carry three private corners per face. It should happen at the writing boundary only — keeping the indexed form as the source of truth preserves the adjacency everything else needs.',
    },
    {
      situation: 'A model loads and draws correctly, but a simplification pass reports it removed nothing.',
      competingTechniques: ['assume the simplification algorithm is broken', 'check whether the mesh is welded'],
      whyThisTechniqueWins: 'Anything working by adjacency finds nothing on an exploded mesh and reports success, having correctly found zero neighbouring pairs. Drawing works either way, so the symptom appears in the algorithm while the cause is in the representation.',
    },
  ],

  debugging: [
    {
      commonError: 'Putting coordinates into the triangle array instead of indices.',
      symptom: 'Either an out-of-range error from a huge index, or a shape that draws as a few enormous slivers stretching off screen.',
      whyItHappened: 'Both arrays are (n,3) and both are full of numbers, so nothing about their shape distinguishes them.',
      repairStrategy: 'Print the dtype and the range. Indices are integers between 0 and len(points)-1; if the triangle array holds floats, or values above the point count, it is holding coordinates.',
    },
    {
      commonError: 'Using axis=1 when you wanted axis=0.',
      symptom: 'The right kind of answer but the wrong number of them — eight values where you expected three.',
      whyItHappened: 'Both are valid, so nothing errors. axis names a dimension of the array and reads as though it names a direction in space.',
      repairStrategy: 'Count what came back. One answer per coordinate means axis=0; one per row means axis=1. Print the result\'s .shape before using it.',
    },
    {
      commonError: 'Winding two faces of a closed solid in opposite directions.',
      symptom: 'The shape is right, but a face shows red from outside — or disappears from one side and appears from the other.',
      whyItHappened: 'The order of the three indices decides which way the triangle faces, and it is easy to write one face clockwise and its neighbour anticlockwise.',
      repairStrategy: 'Pick one rule and apply it to every face: walk each face anticlockwise as seen from outside. The cube cell colours back faces red so this is visible rather than subtle.',
    },
  ],

  mastery: {
    targetLevel: 2,
    solveIndependently: 'Given the corners of a simple solid, write its index list with the right count, every index in range, and every corner used.',
    explainVerbally: 'Explain why a triangle stores indices rather than coordinates, and what becomes impossible when it does not.',
    detectIncorrectApplication: 'Given a mesh, determine whether it is welded or exploded, and predict which operations will silently do nothing.',
    transferToUnfamiliar: 'Given a file format storing colour per vertex, explain why per-face colour forces an exploded mesh and where in a pipeline that explosion belongs.',
  },

  spiral: {
    recoveryPoints: [],
    futureLinks: [
      { lessonId: 'mesh-engine-1-2-vectors-and-triangles', label: 'Vectors and Triangle Geometry', note: 'Uses points[triangles] from cell 4 to get each triangle\'s corners, then the cross product for its direction and area.' },
      { lessonId: 'mesh-engine-1-3-topology-and-welding', label: 'Topology and Welding', note: 'Takes the exploded form from cell 6 and reconstructs the indices, which is what makes adjacency exist.' },
    ],
  },

  checkpoints: [
    { id: 'cp-mesh-engine-1-1-1', label: 'Read the nine-numbers opening and count the square\'s distinct corners', type: 'read' },
    { id: 'cp-mesh-engine-1-1-2', label: 'Read the procedure for describing any mesh', type: 'read' },
    { id: 'cp-mesh-engine-1-1-3', label: 'Read why an out-of-range index fails far from its cause', type: 'read' },
    { id: 'cp-mesh-engine-1-1-4', label: 'Run the single triangle and turn it edge-on until it vanishes', type: 'lab' },
    { id: 'cp-mesh-engine-1-1-5', label: 'Run the square with MOVE_CORNER true and watch the separate one tear', type: 'lab' },
    { id: 'cp-mesh-engine-1-1-6', label: 'Complete the reading-a-shape example', type: 'example' },
    { id: 'cp-mesh-engine-1-1-7', label: 'Run the numpy cells and predict each shape before it prints', type: 'example' },
    { id: 'cp-mesh-engine-1-1-8', label: 'Attempt the cube until all four counts pass', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'mesh-engine-1-1-assess-1',
        type: 'choice',
        text: 'What does a triangle in an indexed mesh actually store?',
        options: [
          'Three indices into a separate list of points',
          'Three xyz coordinates',
          'Three xyz coordinates and a normal',
          'A reference to its neighbouring triangles',
        ],
        answer: 'Three indices into a separate list of points',
        hint: 'The shape lives in the point list. The triangle records only which of those points its corners are — which is what lets two triangles name the same one.',
      },
    ],
  },

  quiz: [
    {
      id: 'mesh-engine-1-1-quiz-1',
      type: 'choice',
      text: 'A cube has 8 distinct corners. How many triangles and how many indices?',
      options: [
        '12 triangles, 36 indices',
        '6 triangles, 18 indices',
        '12 triangles, 24 indices',
        '8 triangles, 24 indices',
      ],
      answer: '12 triangles, 36 indices',
      hints: ['Six faces, and each square face needs two triangles.', 'Every triangle holds exactly three indices.'],
      reviewSection: 'Intuition — Procedure: describing any mesh',
    },
    {
      id: 'mesh-engine-1-1-quiz-2',
      type: 'choice',
      text: 'An array has shape (12, 3, 3). Reading it right to left, what is in it?',
      options: [
        '12 triangles, each with 3 corners, each with 3 coordinates',
        '12 coordinates, in 3 corners, in 3 triangles',
        'A 12x3 grid of 3s',
        '3 triangles with 12 corners each',
      ],
      answer: '12 triangles, each with 3 corners, each with 3 coordinates',
      hints: ['The rightmost number is the innermost grouping.', 'It came from indexing an (8,3) point array with a (12,3) triangle array.'],
      reviewSection: 'Lab — The move this whole course rests on',
    },
    {
      id: 'mesh-engine-1-1-quiz-3',
      type: 'choice',
      text: 'You call points.min(axis=0) on an (8, 3) array. How many numbers come back, and what are they?',
      options: [
        'Three — the smallest x, the smallest y and the smallest z',
        'Eight — the smallest coordinate of each corner',
        'One — the smallest number in the whole array',
        'Twenty-four — every value, sorted',
      ],
      answer: 'Three — the smallest x, the smallest y and the smallest z',
      hints: ['axis=0 collapses down the rows, leaving one answer per column.', 'The array has 3 columns.'],
      reviewSection: 'Lab — axis, which way to collapse',
    },
    {
      id: 'mesh-engine-1-1-quiz-4',
      type: 'choice',
      text: 'Why is everything in graphics made of triangles rather than squares?',
      options: [
        'Any three points define exactly one plane, so "inside" has a single unambiguous answer',
        'Triangles use less memory than squares',
        'GPUs can only store three vertices at a time',
        'Squares cannot be given a colour',
      ],
      answer: 'Any three points define exactly one plane, so "inside" has a single unambiguous answer',
      hints: ['Think about four points that are not all in the same plane.', 'A warped playing card has no single inside.'],
      reviewSection: 'Intuition — Why triangles',
    },
    {
      id: 'mesh-engine-1-1-quiz-5',
      type: 'choice',
      text: 'Which of these is NOT something the indexed representation gives you?',
      options: [
        'A statement of which side of the surface is solid material',
        'The ability to find which triangles surround a corner',
        'The ability to walk from one triangle to its neighbour',
        'The ability to move a corner and have every triangle using it follow',
      ],
      answer: 'A statement of which side of the surface is solid material',
      hints: ['Three of these follow from triangles being able to share an index.', 'A mesh is a skin. Neither array says which side is metal.'],
      reviewSection: 'Intuition — Vertices plus indices equals mesh',
    },
    {
      id: 'mesh-engine-1-1-quiz-6',
      type: 'choice',
      text: 'A simplification pass runs on a freshly loaded STL and reports it removed no triangles. Most likely cause?',
      options: [
        'The mesh is exploded, so the pass correctly found zero pairs of neighbouring faces',
        'The simplification tolerance was set too low',
        'The mesh has too few triangles to simplify',
        'The file was corrupt and loaded as an empty mesh',
      ],
      answer: 'The mesh is exploded, so the pass correctly found zero pairs of neighbouring faces',
      hints: ['Anything working by adjacency needs shared indices.', 'It drew correctly, so the mesh loaded fine.'],
      reviewSection: 'Transfer prompts',
    },
  ],
};

export { LESSON_MESH_1_1 };
