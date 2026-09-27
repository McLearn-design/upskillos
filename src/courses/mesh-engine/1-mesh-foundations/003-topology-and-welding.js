// Mesh Engine 1.3 — Mesh Topology and Welding
//
// Lesson 1 ended with the cube pulled apart: twelve triangles, thirty-six
// independent corners, nothing shared. That is not a teaching contrivance, it
// is what an STL file gives you. This lesson is about turning it back into a
// solid, and — more importantly — about knowing that it worked.
//
// Every number quoted in the prose here was measured first by
// field-fixes/verify/check-weld-numbers.py and check-weld-python.py, and
// cross-checked against trimesh 5.1.0, the same version Pyodide installs.

const THREE_CDN = '<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"><\/script>';

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

// The cube from lesson 1, wound so every triangle faces outward. Shared by
// several cells below, so it is written once here and pasted into each.
const CUBE_DATA = `// The eight corners, and the six faces as lesson 1 numbered them.
var CORNERS = [
  [-0.5,-0.5,-0.5], [0.5,-0.5,-0.5], [0.5,0.5,-0.5], [-0.5,0.5,-0.5],
  [-0.5,-0.5, 0.5], [0.5,-0.5, 0.5], [0.5,0.5, 0.5], [-0.5,0.5, 0.5],
];
var QUADS = [
  [0,1,5,4],   // front
  [0,3,2,1],   // bottom - note the order: see lesson 1
  [4,5,6,7],   // top
  [1,2,6,5],   // right
  [3,0,4,7],   // left
  [2,3,7,6],   // back
];

// The welded mesh: eight points, and twelve triangles that INDEX into them.
// Two faces that meet along an edge use the same two numbers for its ends,
// which is what "shared" means.
var WELDED_POINTS = CORNERS;
var WELDED_TRIS = [];
QUADS.forEach(function (q) {
  WELDED_TRIS.push([q[0], q[1], q[2]]);
  WELDED_TRIS.push([q[0], q[2], q[3]]);
});

// The exploded mesh: the SAME twelve triangles in the same places, but every
// triangle given its own private three corners. No number is ever reused, so
// nothing is shared with anything. This is the shape of an STL file.
var EXPLODED_POINTS = [];
var EXPLODED_TRIS = [];
WELDED_TRIS.forEach(function (t) {
  var base = EXPLODED_POINTS.length;
  t.forEach(function (n) { EXPLODED_POINTS.push(CORNERS[n].slice()); });
  EXPLODED_TRIS.push([base, base + 1, base + 2]);
});`;

// Counting how many triangles use each edge. This is the instrument the whole
// lesson turns on, so it is written out once and reused.
const EDGE_COUNTER = `// Count how many triangles use each edge.
//
// An edge is a PAIR OF POINT INDICES, not a pair of positions. That choice is
// the entire point: the exploded mesh has different indices in the same place,
// so counting by index is what notices.
function countEdges(triangles) {
  var counts = {};
  triangles.forEach(function (t) {
    // The three edges of a triangle, as pairs of its corners.
    var pairs = [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]];
    pairs.forEach(function (pair) {
      // Sort the pair so edge 3-7 and edge 7-3 are the same edge. Without
      // this, two triangles sharing an edge walk it in opposite directions
      // and every edge would be counted as two different ones.
      var lo = Math.min(pair[0], pair[1]);
      var hi = Math.max(pair[0], pair[1]);
      var key = lo + '-' + hi;
      counts[key] = (counts[key] || 0) + 1;
    });
  });
  return counts;
}

// The single number that says whether a mesh is one closed piece.
function boundaryEdges(triangles) {
  var counts = countEdges(triangles);
  var open = [];
  Object.keys(counts).forEach(function (key) {
    if (counts[key] === 1) open.push(key);
  });
  return open;
}`;

const LESSON_MESH_1_3 = {
  title: 'Two Meshes, One Solid',
  subtitle: 'They look the same. One of them is not a solid. Find out which, without reading the code.',
  sequential: true,

  cells: [

    {
      type: 'markdown',
      instruction: `### A simplification pass that did nothing, and said it worked

A real published model in the application this series is building:

\`\`\`
214,382 faces
643,146 distinct corner indices
\`\`\`

Divide those. **643,146 ÷ 214,382 = exactly 3.** Three corners per face, and
not one of them reused by any other face.

That is the cube from the end of lesson 1, at scale. Every triangle carries its
own private corners, so no two triangles share anything — and a simplification
pass that works by finding neighbouring faces and merging them found no
neighbours anywhere. It ran, it removed 0.0%, and it reported success.

Nothing was wrong with the simplifier. It was asking a question the mesh could
not answer.

**The mesh looks completely normal on screen.** That is the problem this lesson
is about: you cannot see this, and you will not be told. You have to measure
it.`,
    },

    {
      type: 'js',
      instruction: `### Which one is a solid?

Two cubes. Drag to turn them.

One is **welded**: eight points, twelve triangles indexing into them, faces
sharing corners the way lesson 1's folded cube did. The other is **exploded**:
thirty-six points, every triangle with its own private three, nothing shared —
the shape of an STL file.

**Before you press anything, decide which is which.** Turn them over, look
along the edges, look for a seam. Take a moment on it, because the answer
matters: if you can tell them apart by looking, then looking is a usable
instrument and the rest of this lesson is unnecessary.

Then press **the same numbers** and read what comes back.`,
      html: `${THREE_CDN}
<div style="display:flex;gap:6px;padding:8px 2px;flex-wrap:wrap;align-items:center">
  <button id="nums" style="background:#1e3a5f;color:#dbeafe;border:1px solid #3b6ea5;border-radius:4px;padding:5px 11px;cursor:pointer;font:11px ui-monospace,monospace">the same numbers</button>
  <button id="wire" style="background:#2b313a;color:#d7dade;border:1px solid #3d4550;border-radius:4px;padding:5px 11px;cursor:pointer;font:11px ui-monospace,monospace">edges on/off</button>
  <span style="flex:1"></span>
  <span style="color:#7d8794;font:11px ui-monospace,monospace">left: A &nbsp; right: B</span>
</div>
<div id="app" style="width:100%;height:300px;background:#0a0f1e;border-radius:8px"></div>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:8px 2px;white-space:pre"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `${CUBE_DATA}

// A is the exploded one and B is the welded one - but they are drawn from the
// same triangles in the same places, with the same material, so nothing about
// the picture can tell you that.
var MESHES = [
  { name: 'A', points: EXPLODED_POINTS, tris: EXPLODED_TRIS, x: -1.05 },
  { name: 'B', points: WELDED_POINTS,   tris: WELDED_TRIS,   x:  1.05 },
];

var app = document.getElementById('app');
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(45, app.clientWidth / 300, 0.1, 100);
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(app.clientWidth, 300);
app.appendChild(renderer.domElement);
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
var lamp = new THREE.DirectionalLight(0xffffff, 0.8);
lamp.position.set(2, 3, 4);
scene.add(lamp);

var showEdges = true;

function draw() {
  MESHES.forEach(function (m) {
    var xyz = [];
    m.tris.forEach(function (t) {
      t.forEach(function (i) {
        var p = m.points[i];
        xyz.push(p[0] + m.x, p[1], p[2]);
      });
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(xyz), 3));
    geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
      color: 0x8c96a3, side: THREE.DoubleSide })));

    if (showEdges) {
      scene.add(new THREE.LineSegments(
        new THREE.WireframeGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x3f4855 })));
    }
  });
}

function report() {
  var lines = ['            points   triangles'];
  MESHES.forEach(function (m) {
    lines.push('  mesh ' + m.name + '     ' +
      (m.points.length + '').padStart(6) + '      ' +
      (m.tris.length + '').padStart(6));
  });
  lines.push('');
  lines.push('Same twelve triangles, same places, same picture.');
  lines.push('A stores 36 corners for them. B stores 8.');
  lines.push('');
  lines.push('You could not see that, and nothing on screen was going to say so.');
  document.getElementById('out').textContent = lines.join('\\n');
}

${ORBIT}
orbit(camera, renderer.domElement, 4.6);
(function frame() { requestAnimationFrame(frame); renderer.render(scene, camera); }());

document.getElementById('nums').addEventListener('click', report);
document.getElementById('wire').addEventListener('click', function () {
  showEdges = !showEdges;
  while (scene.children.length > 2) scene.remove(scene.children[2]);
  draw();
});

draw();
document.getElementById('out').textContent =
  'Decide which is which first. Then press the button.';`,
      outputHeight: 470,
    },

    {
      type: 'markdown',
      instruction: `### So looking does not work. Counting does.

You cannot see it, so here is the instrument, and it is the one from lesson 1.

Every triangle has three edges. Walk all of them and **count how many triangles
use each edge**. There are exactly three answers and each means something
definite:

| count | name | what it means |
|---|---|---|
| **2** | interior edge | normal. Two triangles meet along it. |
| **1** | **boundary edge** | nothing on the other side. **A hole.** |
| **3 or more** | non-manifold | no solid object has this. Something is wrong. |

**A closed solid, welded correctly, has zero boundary edges.** That one number
is the best available answer to "is this in one piece", and it is how you find
out a weld worked instead of assuming it did.

Which is why it gets built **before** the weld. A weld you cannot check is not
an improvement, it is a second thing to distrust.

#### The one decision in the code

\`\`\`js
var lo = Math.min(pair[0], pair[1]);
var hi = Math.max(pair[0], pair[1]);
var key = lo + '-' + hi;
\`\`\`

Reading construct by construct:

- \`pair\` is two corner numbers, taken from one triangle, in the order that
  triangle lists them.
- \`Math.min\` / \`Math.max\` put the smaller first. **This is the whole trick.**
  Two triangles sharing an edge walk it in *opposite* directions — that is what
  consistent winding means, and it is why the cube's faces line up at all. So
  one triangle offers you \`3,7\` and its neighbour offers \`7,3\`. Left as
  written they are two different keys and every edge in a perfectly good solid
  would look like a boundary.
- \`lo + '-' + hi\` makes a string, because a JavaScript object can only key on
  strings. \`3-7\` and \`7-3\` both become \`"3-7"\`.
- \`counts[key] = (counts[key] || 0) + 1\` — \`||  0\` supplies the starting
  value the first time a key is seen, since \`counts[key]\` is \`undefined\`
  then and \`undefined + 1\` is \`NaN\`.

#### And now the part that is about design rather than syntax

Look at what \`countEdges\` is given:

\`\`\`js
function countEdges(triangles) {
\`\`\`

**Triangles. Not points.** There are no coordinates in scope, so there is
nothing to key on but indices — and that is deliberate.

It matters because the tempting mistake here is to use the coordinates. They
are right there in the mesh, they feel more real than a list of integers, and
an edge between two *places* sounds like a better definition than an edge
between two *numbers*. It is not. The exploded mesh has different indices at
bit-identical coordinates, so a position-keyed counter reports a flawless solid
with zero boundary edges. You would have built a tool that confirms what you
were hoping for.

The version of this in the real application was handed the points as well,
because it seemed harmless to pass them, and that is how the bug got in.

**So the function is given the narrowest input that can answer the question.**
Not as tidiness — it is what makes the wrong answer unreachable. When you can
choose what a function can see, you are choosing which bugs are possible.`,
    },

    {
      type: 'js',
      instruction: `### Now count them

Same two cubes, with every boundary edge drawn thick and red.

Press **count edges**.

Mesh B is a solid: 18 edges, every one used twice, nothing red. Mesh A has
**36 boundary edges** — every edge it has. It is not a cube with a crack in it,
it is twelve separate triangles that happen to be arranged cube-shaped.

Then press **break B**. It deletes one triangle from the welded cube. Predict
first: how many boundary edges should that produce? Count the edges of the
triangle you are removing, and remember its neighbours keep theirs.

The count tells you the hole is there. It does not tell you where — but the red
lines do, and in a real application that is exactly how you find the one bad
spot in two hundred thousand faces.`,
      html: `${THREE_CDN}
<div style="display:flex;gap:6px;padding:8px 2px;flex-wrap:wrap;align-items:center">
  <button id="count" style="background:#1e3a5f;color:#dbeafe;border:1px solid #3b6ea5;border-radius:4px;padding:5px 11px;cursor:pointer;font:11px ui-monospace,monospace">count edges</button>
  <button id="break" style="background:#3f2226;color:#ffd7d7;border:1px solid #6e3a3f;border-radius:4px;padding:5px 11px;cursor:pointer;font:11px ui-monospace,monospace">break B</button>
  <button id="reset" style="background:#2b313a;color:#d7dade;border:1px solid #3d4550;border-radius:4px;padding:5px 11px;cursor:pointer;font:11px ui-monospace,monospace">reset</button>
  <span style="flex:1"></span>
  <span style="color:#ff6b6b;font:11px ui-monospace,monospace">▬ boundary edge</span>
</div>
<div id="app" style="width:100%;height:300px;background:#0a0f1e;border-radius:8px"></div>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:8px 2px;white-space:pre"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `${CUBE_DATA}

${EDGE_COUNTER}

var broken = false;
var revealed = false;

function meshes() {
  var bTris = broken ? WELDED_TRIS.slice(0, WELDED_TRIS.length - 1) : WELDED_TRIS;
  return [
    { name: 'A (exploded)', points: EXPLODED_POINTS, tris: EXPLODED_TRIS, x: -1.05 },
    { name: 'B (welded)',   points: WELDED_POINTS,   tris: bTris,         x:  1.05 },
  ];
}

var app = document.getElementById('app');
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(45, app.clientWidth / 300, 0.1, 100);
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(app.clientWidth, 300);
app.appendChild(renderer.domElement);
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
var lamp = new THREE.DirectionalLight(0xffffff, 0.8);
lamp.position.set(2, 3, 4);
scene.add(lamp);

var drawn = [];

function tube(p1, p2, colour, radius) {
  var a = new THREE.Vector3(p1[0], p1[1], p1[2]);
  var b = new THREE.Vector3(p2[0], p2[1], p2[2]);
  var dir = new THREE.Vector3().subVectors(b, a);
  var len = dir.length();
  if (len < 1e-9) return null;
  var m = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, len, 6),
    new THREE.MeshBasicMaterial({ color: colour }));
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

function build() {
  drawn.forEach(function (o) {
    scene.remove(o);
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  drawn = [];

  var lines = ['                 points  triangles   edges   boundary'];

  meshes().forEach(function (m) {
    var xyz = [];
    m.tris.forEach(function (t) {
      t.forEach(function (i) {
        var p = m.points[i];
        xyz.push(p[0] + m.x, p[1], p[2]);
      });
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(xyz), 3));
    geo.computeVertexNormals();
    var body = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
      color: 0x8c96a3, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }));
    scene.add(body); drawn.push(body);

    var counts = countEdges(m.tris);
    var open = boundaryEdges(m.tris);

    if (revealed) {
      open.forEach(function (key) {
        var ends = key.split('-');
        var p1 = m.points[Number(ends[0])], p2 = m.points[Number(ends[1])];
        var seg = tube([p1[0] + m.x, p1[1], p1[2]],
                       [p2[0] + m.x, p2[1], p2[2]], 0xff6b6b, 0.022);
        if (seg) { scene.add(seg); drawn.push(seg); }
      });
    }

    lines.push('  ' + m.name.padEnd(15) +
      (m.points.length + '').padStart(6) +
      (m.tris.length + '').padStart(11) +
      (Object.keys(counts).length + '').padStart(8) +
      (revealed ? (open.length + '').padStart(11) : '          ?'));
  });

  lines.push('');
  if (!revealed) {
    lines.push('Press "count edges".');
  } else {
    lines.push('A: 36 edges from 36 slots - every edge used once, so every edge');
    lines.push('   is a boundary. Nothing is joined to anything.');
    lines.push('B: 18 edges from 36 slots - every edge used twice. A closed solid.');
    if (broken) {
      lines.push('');
      lines.push('B is missing one triangle. Its three edges each lost their');
      lines.push('second triangle, so three edges are now boundaries.');
    }
  }
  document.getElementById('out').textContent = lines.join('\\n');
}

${ORBIT}
orbit(camera, renderer.domElement, 4.6);
(function frame() { requestAnimationFrame(frame); renderer.render(scene, camera); }());

document.getElementById('count').addEventListener('click', function () {
  revealed = true; build();
});
document.getElementById('break').addEventListener('click', function () {
  broken = true; revealed = true; build();
});
document.getElementById('reset').addEventListener('click', function () {
  broken = false; revealed = false; build();
});

build();`,
      outputHeight: 520,
    },

    {
      type: 'markdown',
      instruction: `### Two numbers agreed, and neither was an opinion

Look at what you just read off mesh B:

\`\`\`
36 edge-slots, each edge used twice  ->  18 edges
\`\`\`

That is not arithmetic that happens to work. It is the **Handshaking Lemma**:
every edge has two ends, so the total of all the counts is exactly twice the
number of edges. Lesson 1 used it without naming it when 36 halved to 18.

And there is a second, independent instrument. For the welded cube:

\`\`\`
points - edges + faces
   8   -   18   +  12   =  2
\`\`\`

**Euler's Formula**, \`V − E + F = 2\`, holds for every closed surface of this
kind. Run it on the exploded mesh and you get \`36 − 36 + 12 = 12\`, nowhere
near 2. So it detects the same problem by an entirely different route, which is
what makes the pair of them worth having: a bug that fools one is unlikely to
fool both.

Both of these are proved, not asserted, in
[Graph Theory: Networks, Paths & Puzzles](#/lesson/graph-theory-intro) —
the Handshaking Lemma and Euler's Formula are stated and derived there. If
"degree", "planar" or "connected" were words you would have stopped me on, that
is the lesson to read first.

The grouping step you are about to write is a **hash table**, and it is the
reason welding 200,000 points is fast rather than quadratic. Comparing every
point with every other is 200,000² ≈ 40 billion comparisons; grouping by key
is 200,000. [Hash Tables](#/lesson/dsa3-001) is where that cost argument lives.`,
    },

    {
      type: 'challenge',
      instruction: `### 🎯 Write the instrument

\`countEdges\` and \`boundaryEdges\`, from nothing.

You have twelve triangles. Produce, for every edge, how many triangles use it —
then list the ones used only once.

One thing to get right, and it is the one the prose spent its time on:
**sort each pair.** Neighbouring triangles walk a shared edge in opposite
directions, so \`3,7\` and \`7,3\` are the same edge and must produce the same
key.

Notice what you are *not* given: the points. Only \`triangles\`. You could not
key on coordinates here if you wanted to, which is the design argument above
made concrete.

It runs against both meshes and against a deliberately broken one, and prints
what you returned. The check wants 36, 0 and 3.`,
      html: `<div id="out" style="color:#9fb8e0;font:12px ui-monospace,monospace;padding:10px;white-space:pre;background:#0a0f1e;border-radius:8px;min-height:230px"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `${CUBE_DATA}

// TODO 1: return an object mapping each edge to how many triangles use it.
//         Key an edge on its two POINT INDICES, smaller first, joined with
//         '-' so that 3-7 and 7-3 both become "3-7".
function countEdges(triangles) {
  var counts = {};
  // your code here
  return counts;
}

// TODO 2: return an array of the edge keys used by exactly one triangle.
function boundaryEdges(triangles) {
  // your code here
  return [];
}

// ── it runs itself below; you should not need to change this ──────────────
var brokenTris = WELDED_TRIS.slice(0, WELDED_TRIS.length - 1);
var cases = [
  ['exploded (36 private corners)', EXPLODED_TRIS, 36, 36],
  ['welded (8 shared corners)',     WELDED_TRIS,   18,  0],
  ['welded, one triangle deleted',  brokenTris,    18,  3],
];
var lines = ['  mesh                             edges  boundary   want'];
cases.forEach(function (c) {
  var edges = Object.keys(countEdges(c[1])).length;
  var open = boundaryEdges(c[1]).length;
  lines.push('  ' + c[0].padEnd(32) +
    (edges + '').padStart(5) + (open + '').padStart(10) +
    ('  ' + c[2] + ' / ' + c[3]).padStart(9));
});
console.log(lines.join('\\n'));
document.getElementById('out').textContent = lines.join('\\n');`,
      check: (js) => {
        const no = (message) => ({ pass: false, message });

        const CORNERS = [
          [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5],
          [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5],
        ];
        const QUADS = [[0, 1, 5, 4], [0, 3, 2, 1], [4, 5, 6, 7],
                       [1, 2, 6, 5], [3, 0, 4, 7], [2, 3, 7, 6]];
        const welded = [];
        QUADS.forEach((q) => {
          welded.push([q[0], q[1], q[2]]);
          welded.push([q[0], q[2], q[3]]);
        });
        const exPts = [];
        const exploded = [];
        welded.forEach((t) => {
          const base = exPts.length;
          t.forEach((n) => exPts.push(CORNERS[n].slice()));
          exploded.push([base, base + 1, base + 2]);
        });

        let countEdges, boundaryEdges;
        try {
          // eslint-disable-next-line no-new-func
          const fns = new Function(
            js.replace(/^\s*\/\/ ── it runs itself[\s\S]*$/m, '') +
            '\nreturn { countEdges: countEdges, boundaryEdges: boundaryEdges };',
          )();
          countEdges = fns.countEdges;
          boundaryEdges = fns.boundaryEdges;
        } catch (e) {
          return no('The code did not run: ' + e.message);
        }
        if (typeof countEdges !== 'function') return no('countEdges is not a function.');
        if (typeof boundaryEdges !== 'function') return no('boundaryEdges is not a function.');

        let c;
        try { c = countEdges(welded); } catch (e) { return no('countEdges threw: ' + e.message); }
        if (!c || typeof c !== 'object') return no('countEdges should return an object.');

        const keys = Object.keys(c);
        if (keys.length === 36) {
          return no('countEdges found 36 edges in the welded cube, but it only has 18. '
            + 'Each edge is being counted twice — once as a-b and once as b-a. Sort the pair.');
        }
        if (keys.length !== 18) {
          return no('countEdges found ' + keys.length + ' edges in the welded cube. It has 18: '
            + 'its 12 cube edges plus the 6 face diagonals.');
        }
        const total = keys.reduce((s, k) => s + c[k], 0);
        if (total !== 36) {
          return no('The counts add up to ' + total + ', but 12 triangles x 3 edges is 36. '
            + 'Every edge-slot has to be counted exactly once.');
        }
        if (!keys.every((k) => c[k] === 2)) {
          return no('Some edge of the welded cube is not used by exactly 2 triangles, '
            + 'though it is a closed solid. Check the three pairs you take from each triangle: '
            + '[0,1], [1,2] and [2,0] — it is the last one that gets forgotten.');
        }

        let b;
        try { b = boundaryEdges(welded); } catch (e) { return no('boundaryEdges threw: ' + e.message); }
        if (!Array.isArray(b)) return no('boundaryEdges should return an array of edge keys.');
        if (b.length !== 0) {
          return no('boundaryEdges found ' + b.length + ' open edges in the welded cube. '
            + 'It is closed, so the answer is 0. Return only the edges whose count is exactly 1.');
        }

        // The exploded mesh shares nothing, so every one of its 36 edges is a
        // boundary. Anything less means indices are being merged somewhere they
        // should not be.
        let eb;
        try { eb = boundaryEdges(exploded); } catch (e) { return no('boundaryEdges threw on the exploded mesh: ' + e.message); }
        if (eb.length === 0) {
          return no('The exploded mesh came back with 0 boundary edges, but not one of its '
            + '36 corners is used twice. Something is treating two different indices as the '
            + 'same edge.');
        }
        if (eb.length !== 36) {
          return no('The exploded mesh has ' + eb.length + ' boundary edges; it should have all 36, '
            + 'because not one of its 36 corners is used by more than one triangle.');
        }

        const brokenTris = welded.slice(0, welded.length - 1);
        let bb;
        try { bb = boundaryEdges(brokenTris); } catch (e) { return no('boundaryEdges threw on the broken mesh: ' + e.message); }
        if (bb.length !== 3) {
          return no('With one triangle deleted the answer is 3 — that triangle’s three edges '
            + 'each lost their second user. You returned ' + bb.length + '.');
        }

        return {
          pass: true,
          message: '36, 0 and 3. You now have the only instrument in this series that '
            + 'answers "is this in one piece" without trusting anything.',
        };
      },
      successMessage: '✓ The instrument works.',
      failMessage: '✗ Not yet.',
      outputHeight: 420,
    },

  ],
};

// ── The Python half ───────────────────────────────────────────────────────
// Lesson 2 introduced np.array, shape, dtype, axis and points[triangles].
// This continues from exactly there and adds np.unique, which is the weld.
const PY_CELLS = [
  {
    id: 'build',
    cellTitle: 'Build both meshes',
    prose: [
      'The same two meshes as the drawings, in numpy. Nothing here is new except the explode itself.',
      'CORNERS[WELDED.ravel()] is the whole trick. ravel() flattens the 12x3 index array into 36 numbers; indexing CORNERS with those 36 numbers returns a 36x3 array of coordinates, with every duplicate written out in full. That is lesson 2\u2019s points[triangles] lookup used to throw sharing away rather than to make use of it.',
      'arange(36).reshape(12, 3) then numbers those corners 0 to 35 in order, so no index is ever reused. The last two lines are the point: the welded triangles 0 and 1 share two corners, and the exploded ones share nothing.',
    ],
    code: `import numpy as np

CORNERS = np.array([
    [-0.5,-0.5,-0.5], [0.5,-0.5,-0.5], [0.5,0.5,-0.5], [-0.5,0.5,-0.5],
    [-0.5,-0.5, 0.5], [0.5,-0.5, 0.5], [0.5,0.5, 0.5], [-0.5,0.5, 0.5],
], dtype=float)

QUADS = [(0,1,5,4), (0,3,2,1), (4,5,6,7), (1,2,6,5), (3,0,4,7), (2,3,7,6)]

# Two triangles per quad, sharing its diagonal.
WELDED = np.array([t for q in QUADS
                     for t in ((q[0],q[1],q[2]), (q[0],q[2],q[3]))])

exploded_points = CORNERS[WELDED.ravel()]
exploded_tris = np.arange(36).reshape(12, 3)

print("welded  ", CORNERS.shape, WELDED.shape)
print("exploded", exploded_points.shape, exploded_tris.shape)
print()
print("welded triangles 0 and 1 share corners",
      sorted(set(WELDED[0]) & set(WELDED[1])))
print("exploded triangles 0 and 1 share    ",
      sorted(set(exploded_tris[0]) & set(exploded_tris[1])), "<- nothing")`,
  },
  {
    id: 'byhand',
    cellTitle: 'Count the edges by hand first',
    prose: [
      'The same dictionary as the JavaScript, in Python, so what carries across is the idea and not the syntax.',
      'tuple(sorted(pair)) is the sort-the-pair step. A tuple can be a dictionary key where a list cannot, because a list can be changed after it has been used as a key and a key must stay fixed \u2014 so Python refuses lists outright.',
      'counts.get(key, 0) is the same guard as (counts[key] || 0) in the JavaScript: the first time a key is seen there is no entry, and asking for a missing key directly would raise KeyError.',
      'Read the two lines of output side by side. The edge count and the Euler characteristic both separate the two meshes, and neither one needed to look at a single coordinate.',
    ],
    code: `def count_edges(tris):
    counts = {}
    for t in tris:
        for a, b in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
            key = (a, b) if a < b else (b, a)   # sort, so 3-7 == 7-3
            counts[key] = counts.get(key, 0) + 1
    return counts

for name, tris in (("exploded", exploded_tris), ("welded", WELDED)):
    c = count_edges(tris)
    ones = sum(1 for n in c.values() if n == 1)
    twos = sum(1 for n in c.values() if n == 2)
    V, E, F = (36 if name == "exploded" else 8), len(c), len(tris)
    print(f"{name:>9}: {E:>3} edges from {len(tris)*3} slots  "
          f"| used once {ones:>3}  twice {twos:>3}")
    print(f"{'':>9}  V - E + F = {V} - {E} + {F} = {V - E + F}"
          f"   (2 for a closed surface)")`,
  },
  {
    id: 'vectorised',
    cellTitle: 'The same thing without a loop',
    prose: [
      'Twelve triangles is fine in a Python loop. Two hundred thousand is not, so the same count has to be expressed as array operations.',
      'tris[:, [0,1,2]] takes columns 0, 1 and 2 of every row at once, and ravel() strings them out; a and b together are the two ends of all 36 edges. np.minimum(a, b) then compares the two arrays elementwise and keeps the smaller of each pair \u2014 the sort step, done to all 36 edges in one operation with no loop at all.',
      'np.stack(..., axis=1) glues the two 36-long arrays into one 36x2 array, one row per edge.',
      'np.unique(edges, axis=0) is the part to be careful with. axis=0 tells it to treat each ROW as a single item and find the distinct rows. Leave axis out and numpy flattens the whole array and finds unique NUMBERS instead, which would tell you how many different corner indices appear and nothing about edges.',
      'return_counts=True gives how many times each distinct row appeared, which is exactly the dictionary we built by hand.',
    ],
    code: `def edge_counts(tris):
    a = tris[:, [0, 1, 2]].ravel()        # first end of each of the 36 edges
    b = tris[:, [1, 2, 0]].ravel()        # second end
    edges = np.stack([np.minimum(a, b), np.maximum(a, b)], axis=1)
    return np.unique(edges, axis=0, return_counts=True)

uniq, counts = edge_counts(WELDED)
print("welded  :", len(uniq), "distinct edges, counts seen", np.unique(counts))
print("           boundary edges:", int((counts == 1).sum()))

uniq_x, counts_x = edge_counts(exploded_tris)
print("exploded:", len(uniq_x), "distinct edges, counts seen", np.unique(counts_x))
print("           boundary edges:", int((counts_x == 1).sum()), "<- all of them")
print()
print("agrees with the hand-written version:",
      len(uniq) == len(count_edges(WELDED)))`,
  },
  {
    id: 'ch-boundary',
    challengeType: 'write',
    challengeTitle: 'Report on any mesh',
    difficulty: 'warm-up',
    prompt:
      'Write is_closed(tris, n_points) that returns a (boundary_count, euler) pair, '
      + 'using edge_counts from the cell above. Then say what it reports for the two meshes. '
      + 'The welded cube should give (0, 2) and the exploded one (36, 12).',
    hint:
      'edge_counts returns two things: the distinct edges and how many triangles used each. '
      + 'The boundary count is how many of those counts equal 1. Euler is points minus edges '
      + 'plus faces \u2014 len(uniq) is the edge count and len(tris) is the face count.',
    code: `def is_closed(tris, n_points):
    # TODO: return (boundary_count, euler)
    pass


print(is_closed(WELDED, 8), "expected (0, 2)")
print(is_closed(exploded_tris, 36), "expected (36, 12)")`,
    solution: `def is_closed(tris, n_points):
    uniq, counts = edge_counts(tris)
    boundary = int((counts == 1).sum())
    euler = n_points - len(uniq) + len(tris)
    return (boundary, euler)


print(is_closed(WELDED, 8), "expected (0, 2)")
print(is_closed(exploded_tris, 36), "expected (36, 12)")`,
    testCode: `try:
    w = is_closed(WELDED, 8)
    x = is_closed(exploded_tris, 36)
except Exception as e:
    raise AssertionError(f"is_closed raised {type(e).__name__}: {e}")

assert w is not None, "is_closed returned None - it still has 'pass' in it."
assert len(w) == 2, f"is_closed should return two values, got {len(w)}"
assert tuple(w) == (0, 2), (
    f"welded cube gave {tuple(w)}, expected (0, 2). It is closed, so no edge "
    f"is used only once, and 8 - 18 + 12 = 2.")
assert tuple(x) == (36, 12), (
    f"exploded mesh gave {tuple(x)}, expected (36, 12). Nothing in it is "
    f"shared, so all 36 edges are boundaries and 36 - 36 + 12 = 12.")
"SUCCESS: both instruments agree, and neither looked at a coordinate."`,
  },
  {
    id: 'weld',
    cellTitle: 'The weld',
    prose: [
      'np.unique does the whole weld, because welding IS finding the distinct points.',
      'return_inverse=True is the part that matters. Alongside the distinct rows it returns, for every original row, which distinct row it turned into \u2014 that is precisely an old-index-to-new-index map. Indexing that map with the triangle array rewrites all 36 indices in one go: inverse[exploded_tris] means "for every index in every triangle, look up what it became".',
      'Two details worth being told rather than discovering. np.unique SORTS its output, so the point order changes and lesson 1\u2019s corner numbering no longer applies \u2014 the geometry is identical, the labels moved. And the shape of the inverse array changed in numpy 2.0, so call .ravel() on it and the code works under either version.',
    ],
    code: `kept, inverse = np.unique(exploded_points, axis=0, return_inverse=True)
inverse = inverse.ravel()      # numpy 2.0 changed this shape; ravel is safe

welded_again = inverse[exploded_tris]

print("36 points ->", len(kept), " triangles:", welded_again.shape)
print("distinct indices now used:", len(np.unique(welded_again)))

uniq, counts = edge_counts(welded_again)
print(f"edges {len(uniq)}   boundary {int((counts == 1).sum())}"
      f"   V - E + F = {len(kept)} - {len(uniq)} + {len(welded_again)}"
      f" = {len(kept) - len(uniq) + len(welded_again)}")
print()
print("same set of points we started from:",
      bool(np.allclose(np.sort(kept, axis=0), np.sort(CORNERS, axis=0))))
print("but np.unique sorted them, so the numbering moved:")
print("  lesson 1's corner 3 was", CORNERS[3],
      "-> now index", int(np.where((kept == CORNERS[3]).all(axis=1))[0][0]))`,
  },
  {
    id: 'ch-weld',
    challengeType: 'write',
    challengeTitle: 'Weld it yourself, and prove it worked',
    difficulty: 'core',
    prompt:
      'Write weld(points, tris) returning (new_points, new_tris), then check your own '
      + 'work: it must turn 36 points into 8, keep all 12 triangles, and take the '
      + 'boundary-edge count from 36 to 0. Do not just call a library \u2014 the point is '
      + 'that you can say what each line does.',
    hint:
      'np.unique(points, axis=0, return_inverse=True) gives you the kept points and the '
      + 'old-to-new map. Remember .ravel() on the inverse, and that indexing the map with '
      + 'the triangle array rewrites every index at once.',
    code: `def weld(points, tris):
    # TODO: return (new_points, new_tris)
    pass


pts, tris = weld(exploded_points, exploded_tris)
print("points   ", len(exploded_points), "->", len(pts))
print("triangles", len(exploded_tris), "->", len(tris))
_, c = edge_counts(tris)
print("boundary edges now:", int((c == 1).sum()))`,
    solution: `def weld(points, tris):
    kept, inverse = np.unique(points, axis=0, return_inverse=True)
    return kept, inverse.ravel()[tris]


pts, tris = weld(exploded_points, exploded_tris)
print("points   ", len(exploded_points), "->", len(pts))
print("triangles", len(exploded_tris), "->", len(tris))
_, c = edge_counts(tris)
print("boundary edges now:", int((c == 1).sum()))`,
    testCode: `try:
    pts, tris = weld(exploded_points, exploded_tris)
except Exception as e:
    raise AssertionError(f"weld raised {type(e).__name__}: {e}")

assert pts is not None and tris is not None, "weld returned None - 'pass' is still there."
assert len(pts) == 8, (
    f"weld kept {len(pts)} points, expected 8. The 36 corners are bit-identical "
    f"duplicates of 8 distinct positions.")
assert len(tris) == 12, f"weld returned {len(tris)} triangles, expected 12 - none should be lost."
assert int(tris.max()) < 8, (
    f"an index of {int(tris.max())} still points past the end of the 8 kept points - "
    f"the triangles were not remapped.")
_, _c = edge_counts(np.asarray(tris))
_b = int((_c == 1).sum())
assert _b == 0, (
    f"{_b} boundary edges remain, so the weld did not join everything. "
    f"A closed solid has 0.")
_e = len(pts) - len(np.unique(np.asarray(tris).reshape(-1))) * 0 - 0
assert len(pts) - 18 + len(tris) == 2, (
    f"Euler came out {len(pts) - 18 + len(tris)}, not 2.")
"SUCCESS: 36 to 8, 12 triangles kept, 0 boundary edges, Euler 2."`,
  },
  {
    id: 'trimesh',
    cellTitle: 'A second opinion, from a library that did not write itself',
    prose: [
      'Your own checker agreeing with your own weld proves less than it appears to. Both could share the same wrong assumption. trimesh is an independent implementation, so run it on the same data and see whether it reaches the same verdict.',
      'It does, on the vertex count. Then the second half of the cell takes the welded cube and turns some of its faces inside out, and asks every instrument in this lesson about all three versions.',
      'Read that table slowly, because it is the honest limit of everything built here. Reversing a triangle\u2019s corner order turns it round, but it does not change which PAIRS of points its edges are made of \u2014 so edge counting cannot see it at all.',
    ],
    code: `import micropip
await micropip.install("trimesh")
import trimesh

raw = trimesh.Trimesh(vertices=exploded_points, faces=exploded_tris, process=False)
print("exploded, untouched")
print(f"  vertices {len(raw.vertices)}  watertight {raw.is_watertight}"
      f"  euler {raw.euler_number}")

fixed = trimesh.Trimesh(vertices=exploded_points, faces=exploded_tris, process=False)
fixed.merge_vertices()
print("after trimesh's own merge_vertices()")
print(f"  vertices {len(fixed.vertices)}  watertight {fixed.is_watertight}"
      f"  euler {fixed.euler_number}  unique edges {len(fixed.edges_unique)}")
print(f"  volume {fixed.volume}   area {fixed.area}")
print()
print("our weld and trimesh's agree on the vertex count:",
      len(fixed.vertices) == len(kept))
print()

# ── now the part worth slowing down for ────────────────────────────────────
flip_some = np.array([t[::-1] if i < 4 else t for i, t in enumerate(WELDED)])
flip_all  = WELDED[:, ::-1]

print(f"{'version':>22} {'boundary':>9} {'euler':>6} {'watertight':>11}"
      f" {'winding':>8} {'volume':>8}")
for label, tris in (("all 12 outward", WELDED),
                    ("4 of 12 flipped", flip_some),
                    ("all 12 flipped", flip_all)):
    _, counts = edge_counts(tris)
    m = trimesh.Trimesh(vertices=CORNERS, faces=tris, process=False)
    print(f"{label:>22} {int((counts == 1).sum()):>9} {m.euler_number:>6}"
          f" {str(m.is_watertight):>11} {str(m.is_winding_consistent):>8}"
          f" {m.volume:>+8.3f}")

print()
print("Every instrument in this lesson gives the SAME answer to all three.")
print("Zero boundary edges. Euler 2. Watertight. And the middle one has four")
print("faces inside out, while the last one is the whole cube inverted.")
print()
print("Only the SIGN of the volume separates the inverted one, and nothing")
print("here separates the middle one at all. Closed is not the same as")
print("correctly wound, and this lesson only measures closed.")`,
  },
  {
    id: 'tolerance',
    cellTitle: 'The tolerance, and why it is mostly a trap',
    prose: [
      'Everyone reaches for a tolerance: how close is close enough to call two points the same? Sweep it instead of picking one, and let the table decide.',
      'The snapping trick is worth reading carefully. np.round(points / tol) divides every coordinate by the tolerance and rounds, so any two points within roughly one step of each other land on the same whole number \u2014 the same grid cell. Grouping by cell is then the same np.unique call as before.',
      'The reason the answer turns out so blunt is floating point. STL duplicates are bit-identical copies of one number, not separate measurements that nearly agree, so exact comparison already catches every one of them. If 0.1 + 0.2 != 0.3 is not a familiar fact, the Python Values lesson is where to look first.',
      'Watch the area column as well as the counts. While the cube is whole it stays at exactly 6.0; the moment the tolerance is large enough to matter, triangles collapse and the shape is gone rather than simplified.',
    ],
    code: `def weld_tol(points, tris, tol):
    if tol == 0:
        kept, inverse = np.unique(points, axis=0, return_inverse=True)
    else:
        # Snap to a grid of the given size, then group by the grid cell.
        _, first, inverse = np.unique(np.round(points / tol), axis=0,
                                      return_index=True, return_inverse=True)
        kept = points[first]
    out = inverse.ravel()[tris]
    keep = np.array([len(set(t)) == 3 for t in out])   # drop collapsed triangles
    return kept, out[keep]

print(f"{'tolerance':>11} {'points':>7} {'triangles':>10} {'boundary':>9} {'area':>6}")
for tol in (0, 1e-9, 1e-7, 1e-5, 1e-3, 1e-2, 0.1, 0.4, 0.9, 1.0):
    pts, tris = weld_tol(exploded_points, exploded_tris, tol)
    if len(tris):
        _, counts = edge_counts(tris)
        boundary = int((counts == 1).sum())
        tp = pts[tris]
        cross = np.cross(tp[:,1] - tp[:,0], tp[:,2] - tp[:,0])
        area = float(np.linalg.norm(cross, axis=1).sum() / 2)
    else:
        boundary, area = 0, 0.0
    label = "0 (exact)" if tol == 0 else f"{tol:g}"
    print(f"{label:>11} {len(pts):>7} {len(tris):>10} {boundary:>9} {area:>6.2f}")

print()
print("Off, then whole, then destroyed. There is no gradual middle, and")
print("the 'right' tolerance turns out not to be a decision at all -")
print("until it is large enough to wreck the part.")`,
  },
  {
    id: 'ch-tolerance',
    challengeType: 'write',
    challengeTitle: 'Try to find the middle ground',
    difficulty: 'stretch',
    prompt:
      'The cell above claims there is no tolerance that leaves the cube PARTLY welded \u2014 '
      + 'some duplicates merged and some not. Test that claim properly: sweep a wide range '
      + 'of tolerances and collect every one that gives a point count strictly between '
      + '8 and 36. Set partial to that list. Report what you find.',
    hint:
      'np.logspace(-12, 0.2, 200) gives 200 tolerances spanning twelve orders of magnitude. '
      + 'weld_tol is already defined. A claim like this is only worth anything once you have '
      + 'tried hard to break it, so sweep more values than feels necessary.',
    code: `partial = []

# TODO: sweep tolerances with weld_tol and collect any that give a point
#       count strictly between 8 and 36.

print(f"{len(partial)} tolerance(s) gave a partial weld")
if partial:
    print("so 'off, then whole' is FALSE:", partial[:5])
else:
    print("every tolerance gave 36, or 8, or fewer than 8. No gradual middle.")`,
    solution: `partial = []

for tol in [0.0] + list(np.logspace(-12, 0.2, 200)):
    pts, _ = weld_tol(exploded_points, exploded_tris, float(tol))
    if 8 < len(pts) < 36:
        partial.append(float(tol))

print(f"{len(partial)} tolerance(s) gave a partial weld")
if partial:
    print("so 'off, then whole' is FALSE:", partial[:5])
else:
    print("every tolerance gave 36, or 8, or fewer than 8. No gradual middle.")`,
    testCode: `assert 'partial' in dir(), "partial was never set."
assert isinstance(partial, (list, tuple)), f"partial should be a list, got {type(partial).__name__}"

# Did they actually sweep? Re-run the search independently and compare.
_found = []
for _t in [0.0] + list(np.logspace(-12, 0.2, 200)):
    _p, _tr = weld_tol(exploded_points, exploded_tris, float(_t))
    if 8 < len(_p) < 36:
        _found.append(float(_t))

assert len(_found) == 0, (
    f"The independent sweep found {len(_found)} partial welds, so the lesson's "
    f"claim is wrong and needs correcting.")
assert len(partial) == 0, (
    f"You collected {len(partial)} partial welds, but a 200-point sweep across "
    f"twelve orders of magnitude finds none. Check the condition - it is "
    f"8 < len(points) < 36, strictly between.")
"SUCCESS: no partial weld exists. You did not take that on trust, which is the point."`,
  },
];

export default {
  id: 'mesh-engine-1-3-topology-and-welding',
  slug: 'topology-and-welding',
  chapter: 'mesh-engine.1',
  order: 2,
  title: 'Mesh Topology and Welding',
  subtitle: 'Two meshes look identical on screen. One is not a solid. The number that tells them apart.',
  tags: [
    'topology', 'welding', 'adjacency', 'boundary edges', 'manifold',
    'coincident vertices', 'exploded mesh', 'tolerance', 'Euler characteristic',
    'hash table', 'numpy', 'trimesh',
  ],
  aliases: 'weld vertices merge vertices coincident points boundary edge manifold non-manifold watertight adjacency exploded mesh shared vertices Euler formula handshaking lemma np.unique return_inverse trimesh merge_vertices tolerance',
  timeToComplete: 55,
  coreConcept:
    'A mesh file does not have to give you the topology your algorithms need. An exploded mesh — every triangle carrying its own private corners — draws identically to a solid and defeats anything that works by finding neighbours. Counting how many triangles use each edge is the instrument that tells them apart: two is interior, one is a hole, and a closed solid has zero of the latter. Build that counter before the weld, because it is how you learn the weld worked.',
  prerequisites: ['mesh-engine-1-2-vectors-and-triangles'],
  nextLesson: 'mesh-engine-1-4-mesh-files',

  semantics: {
    core: [
      { symbol: 'welded', meaning: 'One stored point per actual corner. Two triangles meeting at a corner use the same index for it, so "do these touch" is answerable by comparing numbers.' },
      { symbol: 'exploded', meaning: 'Every triangle carries its own three corners. Duplicates sit at identical coordinates with different indices. Nothing is shared, and nothing can be found by comparing indices.' },
      { symbol: 'coincident', meaning: 'Two points at the same place that the mesh does not know are the same point. The whole problem in one word.' },
      { symbol: 'edge key = min(a,b) + "-" + max(a,b)', meaning: 'The canonical name for an edge. Sorting is required because neighbouring triangles walk a shared edge in opposite directions.' },
      { symbol: 'used by 2', meaning: 'An interior edge. Normal.' },
      { symbol: 'used by 1', meaning: 'A boundary edge. Nothing on the other side — a hole.' },
      { symbol: 'used by 3+', meaning: 'Non-manifold. No solid object has this; something upstream is wrong.' },
      { symbol: 'V - E + F = 2', meaning: 'Euler’s formula. A second, independent check that a surface is closed. 8 - 18 + 12 = 2 for the welded cube; 36 - 36 + 12 = 12 for the exploded one.' },
    ],
    rulesOfThumb: [
      'Build the boundary-edge count before the weld. It is how you find out the weld worked rather than assuming it did.',
      'Key edges on point indices, never on coordinates - and give the function no access to the coordinates, so the wrong version cannot be written.',
      'Sort the two ends of every edge, or every edge in a good solid reads as a boundary.',
      'Zero boundary edges is the answer to "is this in one piece". Nothing else is as cheap or as definite.',
      'Watertight does not mean correctly wound. They are different properties and a mesh can have one without the other.',
      'Do not reach for a tolerance first. STL duplicates are bit-identical, so exact matching already works; a tolerance large enough to matter is large enough to destroy the part.',
      'Never trust your own weld checked by your own checker. Get a second opinion from something you did not write.',
    ],
  },

  hook: {
    question: 'A simplification pass ran on a 214,382-face model, removed 0.0%, and reported success. The model had 643,146 corner indices. What is 643,146 divided by 214,382, and what does that tell you?',
    realWorldContext: 'Exactly 3 — three private corners per face, no two faces sharing anything. The simplifier worked by finding neighbouring coplanar faces and merging them, and there were no neighbours to find anywhere in the file. Nothing was wrong with the simplifier; it was asking a question the mesh could not answer. On screen the model looked completely normal, and nothing was going to tell you otherwise.',
    previewVisualizationId: 'JSNotebook',
  },

  intuition: {
    prose: [
      'A mesh is points plus triangles-as-indices. Whether two triangles touch is a question about the indices, not about the coordinates.',
      'An exploded mesh gives every triangle its own corners. The coordinates still line up perfectly, so it draws identically — but no index is ever shared, so nothing can be found to be adjacent.',
      'That is what an STL file is, and it is why an adjacency-based algorithm can run on a real model and find nothing at all.',
      'Counting how many triangles use each edge separates the two cases immediately: 18 edges each used twice, or 36 edges each used once.',
      'Zero boundary edges means one closed piece. It is the cheapest true statement available about a mesh.',
      'Build the count before the weld. Otherwise a weld that silently did nothing looks exactly like a weld that worked.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: is this mesh one closed piece?',
        body: 'Step 1. For every triangle, take its three edges as pairs of point indices.\nStep 2. Sort each pair so a-b and b-a give the same key.\nStep 3. Count how many times each key appears.\nStep 4. Count the keys appearing exactly once. That is the boundary-edge count.\nStep 5. Zero means closed. Anything else means holes, and the keys tell you where.\nStep 6. Cross-check with V - E + F. It should be 2.',
      },
      {
        type: 'insight',
        title: 'countEdges is given triangles and not points, on purpose',
        body: 'Keying an edge on coordinates rather than indices is the one mistake that hides the exact bug being hunted: an exploded mesh has duplicates at bit-identical positions, so a position-keyed counter reports a flawless solid with zero boundary edges. The function here cannot make that mistake, because the coordinates are not in scope. That is the point. The equivalent function in the real application was passed the points too, since it seemed harmless, and that is how the bug got in. Choosing what a function can see is choosing which bugs are possible.',
      },
      {
        type: 'warning',
        title: 'Sort the pair, or everything looks broken',
        body: 'Two triangles sharing an edge traverse it in opposite directions — that is what consistent winding means. So one hands you 3,7 and the other hands you 7,3. Unsorted, those are two separate keys each counted once, and a flawless cube reports 36 boundary edges.',
      },
      {
        type: 'insight',
        title: 'Watertight is not the same as correctly wound',
        body: 'Measured on the welded cube. Leave all twelve triangles facing outward: 0 boundary edges, Euler 2, watertight, volume +1.000. Turn four of them inside out: 0 boundary edges, Euler 2, watertight, volume +1.000 — identical in every respect. Turn all twelve: still 0 boundary edges, Euler 2, watertight, and a volume of -1.000. Reversing a triangle does not change which pairs of points its edges are made of, so edge counting cannot see it at all. Closed and correctly-wound are separate properties and everything in this lesson measures the first. The sign of the volume catches a wholly inverted solid; nothing here catches a partly inverted one, which is what the next lesson’s stored normals are for.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Two cubes, then the number that separates them',
        caption: 'Decide which is the solid before pressing anything. Then count.',
        props: {
          lesson: LESSON_MESH_1_3,
        },
      },
    ],
  },

  math: {
    prose: [
      'The drawings did twelve triangles. The weld has to work on 214,382, and doing it by comparing every point with every other is 200,000 squared — about 40 billion comparisons. Grouping by a key is 200,000.',
      'The notebook writes the edge count by hand, vectorises it, then does the weld with np.unique and return_inverse, which is the whole operation in two lines once you can read it.',
      'Then it asks trimesh for a second opinion, because a weld checked only by the checker you wrote alongside it is not checked.',
      'The last cell sweeps the tolerance instead of choosing one, and the table is the argument.',
    ],
    visualizations: [
      {
        id: 'PythonNotebook',
        title: 'Count, weld, and get a second opinion',
        mathBridge: 'Two results from graph theory do the work here, and both are proved in the Graph Theory lesson. The Handshaking Lemma — the counts sum to twice the number of edges — is why 36 edge-slots become 18 edges. Euler’s Formula, V - E + F = 2, is an independent test of the same closedness: 8 - 18 + 12 = 2 for the welded cube against 36 - 36 + 12 = 12 for the exploded one.',
        caption: 'numpy from where lesson 2 left it, then trimesh as an independent check.',
        props: {
          initialCells: PY_CELLS,
        },
      },
    ],
  },

  examples: [
    {
      title: 'The published model that defeated its own simplifier',
      prose: '214,382 faces, 643,146 corner indices, exactly 3 per face. Coplanar merging removed 0.0% because no two faces shared an edge to merge across. Welding first and re-running removed 0.8% — still almost nothing, but for a completely different and more interesting reason, which section 16 is about.',
    },
    {
      title: 'The cube, both ways',
      prose: 'Welded: 8 points, 18 edges, 12 faces, 0 boundary edges, V - E + F = 2. Exploded: 36 points, 36 edges, 12 faces, 36 boundary edges, V - E + F = 12. Identical on screen; nothing else about them is the same.',
    },
    {
      title: 'One triangle deleted',
      prose: 'Delete a single triangle from the welded cube and the boundary count goes from 0 to 3 — that triangle’s three edges each lost their second user. The count found the hole; the three edge keys say where it is.',
    },
  ],

  challenges: [
    {
      prompt: 'Write countEdges and boundaryEdges from scratch, keyed on point indices with each pair sorted, and get 36, 0 and 3 from the exploded, welded and broken meshes.',
      hint: 'The three pairs of a triangle are [0,1], [1,2] and [2,0]. The last one is the one people forget, and forgetting it makes a closed cube report boundary edges.',
    },
    {
      prompt: 'Deliberately key the edge on coordinates instead of indices, and run it on the exploded mesh. Confirm it reports 0 boundary edges. Keep the result in mind — this is what a checker that agrees with you looks like.',
      hint: 'Join the six coordinates into a string. The duplicate corners are bit-identical, so the keys match exactly.',
    },
    {
      prompt: 'Weld the exploded mesh with np.unique and return_inverse, then verify with the boundary count AND with Euler’s formula. Both must agree before you believe it.',
      hint: 'inverse.ravel()[tris] rewrites every index at once. Remember np.unique sorts, so the point order changes.',
    },
    {
      prompt: 'Find a tolerance that leaves the cube partly welded — some duplicates merged, some not. Report what you find.',
      hint: 'There is not one. Establishing that is the exercise, and it is why the tolerance everyone worries about is not the decision they think it is.',
    },
  ],

  misconceptions: [
    {
      claim: 'If two points are at the same coordinates, the mesh knows they are the same point.',
      reality: 'It does not, and nothing makes it. Sharing is a statement about indices. Two points at identical coordinates with different indices are two different points as far as every algorithm is concerned — which is also why an edge must be named by indices and not by the places its ends sit.',
    },
    {
      claim: 'A mesh that renders correctly has usable topology.',
      reality: 'Rendering never needs to know which triangles are neighbours, so it works fine on a completely exploded mesh. Rendering correctly is evidence of nothing.',
    },
    {
      claim: 'An algorithm that runs without error and reports success did something.',
      reality: 'The simplification pass removed 0.0% and reported success. It found no neighbours because there were none to find. Always check the amount of work done, not the absence of an error.',
    },
    {
      claim: 'Welding needs a carefully chosen tolerance.',
      reality: 'On real STL data the duplicates are bit-identical copies, so exact comparison already merges them. Every tolerance from 0 up to nearly the size of the part gives the same answer, and past that it destroys the part. There is no gradual middle to tune.',
    },
    {
      claim: 'Zero boundary edges means the mesh is correct.',
      reality: 'It means the mesh is closed, and nothing else. Turn four of the cube’s twelve triangles inside out and every measurement in this lesson is unchanged: 0 boundary edges, Euler 2, watertight, volume +1.000. Reversing a triangle does not alter which point-pairs its edges use, so edge counting is blind to it by construction.',
    },
  ],

  transferPrompts: [
    'You are handed a mesh and asked whether it is one solid piece. What is the first number you compute, and what would make you distrust it?',
    'An adjacency-based operation reports that it found nothing to do. Name two completely different explanations and the measurement that separates them.',
    'Why is grouping points by a dictionary key the right shape for welding, rather than comparing every point with every other?',
    'You weld a mesh and your own checker says it worked. What would actually convince you?',
  ],

  debugging: [
    {
      symptom: 'A cube you know is closed reports 36 boundary edges.',
      cause: 'The two ends of each edge are not being sorted, so every edge is counted as two different keys, each once.',
      fix: 'Key on min(a,b) + "-" + max(a,b).',
    },
    {
      symptom: 'An obviously exploded mesh reports 0 boundary edges.',
      cause: 'The edge key is built from coordinates rather than indices. Coincident duplicates are bit-identical, so the keys collide and the mesh looks joined.',
      fix: 'Key on point indices. Positions are what the weld compares; indices are what topology is made of.',
    },
    {
      symptom: 'The counts do not add up to 3 x the number of triangles.',
      cause: 'Only two of each triangle’s three edges are being taken — usually [0,1] and [1,2], with [2,0] missed.',
      fix: 'Three pairs per triangle: [0,1], [1,2], [2,0].',
    },
    {
      symptom: 'After welding, some triangles have a repeated index.',
      cause: 'The tolerance was large enough to merge two corners of the same triangle, collapsing it to a line.',
      fix: 'Drop triangles whose three indices are not distinct, and treat their appearance as a sign the tolerance is far too large.',
    },
    {
      symptom: 'np.unique(..., return_inverse=True) gives an inverse whose shape will not index the triangle array.',
      cause: 'numpy 2.0 changed the shape of the inverse for axis-based calls.',
      fix: 'Call .ravel() on it, which is correct under every version.',
    },
  ],

  mastery: {
    prerequisites:
      'Comfortable with points-plus-indices from lesson 1, and with numpy arrays, shape and fancy indexing from lesson 2. No graph theory assumed — the two results used are named and linked where they appear.',
    signals: [
      'Can state what a boundary edge is and why zero of them matters, without reaching for a definition.',
      'Can explain why the edge key must be sorted, and what breaks without it.',
      'Can explain why keying on coordinates hides the exact bug being looked for.',
      'Can weld a mesh with np.unique and verify the result two independent ways.',
      'Treats "the algorithm reported success" as unverified until the amount of work is measured.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'mesh-engine-1-1-what-a-mesh-is', why: 'Points plus indices, and the 36-slots-to-18-edges count this lesson turns into an instrument.' },
      { lessonId: 'mesh-engine-1-2-vectors-and-triangles', why: 'Winding order — why two triangles walk a shared edge in opposite directions, which is why the edge key has to be sorted.' },
      { lessonId: 'graph-theory-intro', why: 'The Handshaking Lemma and Euler’s Formula, both proved rather than asserted.' },
      { lessonId: 'dsa3-001', why: 'Hash tables — why grouping by key is linear where comparing every pair is quadratic.' },
      { lessonId: 'py-0-2-values', why: 'Float imprecision, and why 0.1 + 0.2 != 0.3 is the reason a tolerance seems necessary before you measure whether it is.' },
    ],
    futureLinks: [
      { lessonId: 'mesh-engine-1-4-mesh-files', why: 'The STL format itself, and why it produces an exploded mesh by construction.' },
    ],
  },

  checkpoints: [
    'I can say what makes two triangles adjacent, and it is not their coordinates.',
    'I can count boundary edges and say what the number means.',
    'I know why sorting the edge pair is not optional.',
    'I know why keying on positions would have hidden the problem.',
    'I can weld with np.unique and check it two ways.',
    'I know that watertight and correctly-wound are different claims.',
  ],

  assessment: {
    task: 'Given an unknown mesh, report whether it is one closed piece, and justify the answer with two independent measurements.',
    acceptance: [
      'Boundary-edge count computed from indices with sorted pairs.',
      'Euler characteristic computed and compared against 2.',
      'A statement about what the result does NOT establish.',
    ],
  },

  quiz: [
    {
      question: 'A model has 643,146 corner indices for 214,382 faces. What does that ratio tell you?',
      options: [
        'Exactly 3 per face, so no two faces share a corner — the mesh is fully exploded',
        'The mesh is welded efficiently',
        'The file is corrupt',
        'Nothing without knowing the file format',
      ],
      answer: 0,
      explanation: '643,146 / 214,382 = 3 exactly. Three private corners per face means nothing is shared, so any adjacency-based operation finds no neighbours anywhere.',
    },
    {
      question: 'Why must the two ends of an edge be sorted before using them as a key?',
      options: [
        'Because neighbouring triangles walk a shared edge in opposite directions, so a-b and b-a are the same edge',
        'To make the output easier to read',
        'Because object keys must be sorted',
        'It is an optimisation and can be skipped',
      ],
      answer: 0,
      explanation: 'Consistent winding means two triangles traverse their shared edge in opposite directions. Unsorted, a perfect solid reports every edge as a boundary.',
    },
    {
      question: 'You key edges on coordinates instead of indices and run it on a fully exploded mesh. What does it report?',
      options: [
        'Zero boundary edges — a perfect solid, which is wrong',
        'All edges as boundaries, correctly',
        'An error',
        'The same as keying on indices',
      ],
      answer: 0,
      explanation: 'The duplicate corners are bit-identical, so position keys collide and the mesh looks fully joined. This is the mistake that hides the exact bug you are hunting.',
    },
    {
      question: 'The welded cube has 8 points, 18 edges and 12 faces. What is V - E + F, and what does it mean?',
      options: [
        '2, which is what a closed surface gives',
        '38, the total count',
        '0, meaning it is empty',
        '12, the number of faces',
      ],
      answer: 0,
      explanation: '8 - 18 + 12 = 2. Euler’s formula gives 2 for a closed surface of this kind. The exploded mesh gives 12, detecting the same problem by a different route.',
    },
    {
      question: 'Which tolerance correctly welds the cube from this lesson?',
      options: [
        'Every tolerance from 0 up to nearly the size of the cube gives the same result',
        'Only 1e-7',
        'Only 1e-5',
        'It depends on the units',
      ],
      answer: 0,
      explanation: 'The duplicates are bit-identical, so exact comparison already merges them and no tolerance below the part size changes anything. Above that it destroys the part. Off, then whole, then destroyed — no gradual middle.',
    },
    {
      question: 'A mesh reports zero boundary edges. What have you established?',
      options: [
        'That it is closed — and nothing about whether its faces are wound the right way',
        'That it is a valid solid in every respect',
        'That its normals are correct',
        'That it has no duplicate points',
      ],
      answer: 0,
      explanation: 'Closed and correctly-wound are separate properties. The cube here can have faces turned inside out, report zero boundary edges, and still give a volume of 1.0.',
    },
  ],
};
