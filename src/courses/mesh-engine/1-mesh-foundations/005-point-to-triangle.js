// Mesh Engine 1.5 — Point-to-Triangle Distance
//
// The first real computational-geometry problem in the series, and the first
// one where the obvious implementation is wrong rather than slow.
//
// Every number in the prose was measured first by
// field-fixes/verify/check-point-triangle.py, which checks the analytic answer
// against a brute-force search over a dense sampling of the triangle, counts
// how often each of the seven regions is hit, and confirms the degenerate cases
// return a finite point instead of NaN.

const THREE_CDN = '<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"><\/script>';

const ORBIT = `
function orbit(camera, dom, radius) {
  var lon = 38, lat = 28, down = false, px = 0, py = 0;
  function place() {
    var a = lon * Math.PI / 180, b = lat * Math.PI / 180;
    camera.position.set(
      radius * Math.cos(b) * Math.sin(a),
      radius * Math.sin(b),
      radius * Math.cos(b) * Math.cos(a));
    camera.lookAt(0.3, 0.3, 0);
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

// The solver, written out once and pasted into the cells that need it. Every
// branch is a comparison of dot products; nothing here needs a square root.
const SOLVER = `// The triangle every cell in this lesson uses.
var A = [0, 0, 0], B = [1, 0, 0], C = [0, 1, 0];

function sub(u, v) { return [u[0]-v[0], u[1]-v[1], u[2]-v[2]]; }
function add(u, v) { return [u[0]+v[0], u[1]+v[1], u[2]+v[2]]; }
function scale(u, k) { return [u[0]*k, u[1]*k, u[2]*k]; }
function dot(u, v) { return u[0]*v[0] + u[1]*v[1] + u[2]*v[2]; }
function length(u) { return Math.sqrt(dot(u, u)); }

// Closest point on triangle ABC to the point P.
//
// Returns the point AND which of the seven features it landed on, because the
// classification is the useful half: it tells you whether the answer came from
// the face, an edge or a corner, and every later stage cares.
function closestPoint(P, A, B, C) {
  var ab = sub(B, A), ac = sub(C, A);

  // How far along AB and AC does P sit, measured from A? A dot product is
  // exactly this question: negative means "behind A".
  var ap = sub(P, A);
  var d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return { q: A, at: 'vertex A' };

  // Same question from B's point of view.
  var bp = sub(P, B);
  var d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return { q: B, at: 'vertex B' };

  // vc is proportional to the barycentric coordinate that edge AB would have
  // to give up. Negative means P is outside across AB, and since the two tests
  // above ruled out both corners, the answer is somewhere along the edge.
  var vc = d1*d4 - d3*d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    // d1 - d3 is the squared length of AB. Zero means A and B are the same
    // point, so there is no edge to slide along and the corner is the answer.
    var t = (d1 === d3) ? 0 : d1 / (d1 - d3);
    return { q: add(A, scale(ab, t)), at: 'edge AB' };
  }

  var cp = sub(P, C);
  var d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return { q: C, at: 'vertex C' };

  var vb = d5*d2 - d1*d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    var t2 = (d2 === d6) ? 0 : d2 / (d2 - d6);
    return { q: add(A, scale(ac, t2)), at: 'edge AC' };
  }

  var va = d3*d6 - d5*d4;
  if (va <= 0 && (d4-d3) >= 0 && (d5-d6) >= 0) {
    var span = (d4-d3) + (d5-d6);
    var t3 = (span === 0) ? 0 : (d4-d3) / span;
    return { q: add(B, scale(sub(C, B), t3)), at: 'edge BC' };
  }

  // Nothing was outside, so P projects into the face. va+vb+vc is twice the
  // triangle's area; zero means the corners are collinear and there is no
  // interior to be inside of.
  var total = va + vb + vc;
  if (total === 0) return { q: A, at: 'degenerate' };
  var v = vb / total, w = vc / total;
  return { q: add(A, add(scale(ab, v), scale(ac, w))), at: 'inside' };
}`;

const COLOURS = `var REGION_COLOUR = {
  'inside':   0x4dabf7,
  'edge AB':  0xffd43b,
  'edge AC':  0xffd43b,
  'edge BC':  0xffd43b,
  'vertex A': 0xff6b6b,
  'vertex B': 0xff6b6b,
  'vertex C': 0xff6b6b,
  'degenerate': 0xb197fc,
};`;

const LESSON_MESH_1_5 = {
  title: 'How Far Is That Point From This Triangle?',
  subtitle: 'The answer can land in seven different places, and the obvious method finds only four of them.',
  sequential: true,

  cells: [

    {
      type: 'markdown',
      instruction: `### The question the whole application is built on

Comparing two models — what was cut against what should have been cut — comes
down to one question asked a very large number of times:

> **How far is this point from that surface?**

A surface is triangles. So before anything else can work, this has to be right
for **one** triangle. Get it wrong here and every measurement downstream is
wrong by an amount nobody will notice, because it will not be wrong enough to
look broken.

The obvious approach goes like this, and it is worth writing down because it is
almost right:

> Drop a perpendicular from P onto the triangle's plane. If the foot of that
> perpendicular lands inside the triangle, that is the closest point. If it
> lands outside, use the nearest corner.

The first half is correct. **The second half is wrong**, and here is the
counterexample, which you can check by eye.

Take the triangle \`A(0,0,0)\`, \`B(1,0,0)\`, \`C(0,1,0)\` — flat on the ground,
with a right angle at A. Put P at \`(0.5, -1, 0)\`: level with the ground,
directly out in front of the middle of edge AB.

- The closest point is \`(0.5, 0, 0)\` — the **midpoint of edge AB**. Distance
  **exactly 1.0**.
- The nearest corner is A (or B, equally far), at distance
  **√1.25 = 1.118034**.

The shortcut overstates it by **11.8%**, and nothing about that answer looks
wrong. It is a real distance to a real point on the triangle. It is just not the
smallest one.

**The closest point can be in the middle of an edge, and a method that only
ever returns the interior or a corner can never find it.**

So the answer can land in **seven** places: inside the face, on one of the three
edges, or at one of the three corners. This lesson is about telling them apart.`,
    },

    {
      type: 'js',
      instruction: `### Move the point and watch where the answer lands

The triangle is on the ground. **P** is the white dot; **Q** is the closest point
on the triangle, joined to P by a line.

Q is coloured by what it landed on: **blue** for the face, **yellow** for an
edge, **red** for a corner. The feature it landed on lights up too.

Use the buttons to jump to a point in each region, then the sliders to move P
by hand. Drag on the picture to turn it.

**Two things to do deliberately.**

First, press **edge AB** and look at the readout. Q is at \`(0.5, 0, 0)\` and
the distance is exactly 1. Then read the line below it — that is what the
nearest-corner shortcut would have said.

Second, start at **inside** and walk P out past an edge using the sliders.
Watch the moment Q stops moving freely across the face and starts sliding along
the edge instead, and then the moment it sticks at a corner and stops moving at
all. Those two transitions are the whole algorithm.`,
      html: `${THREE_CDN}
<div style="display:flex;gap:5px;padding:8px 2px;flex-wrap:wrap;align-items:center">
  <button data-p="0.25,0.25,0.6" style="background:#12314f;color:#bfe0ff;border:1px solid #2f6da8;border-radius:4px;padding:4px 9px;cursor:pointer;font:11px ui-monospace,monospace">inside</button>
  <button data-p="0.5,-1,0" style="background:#3d3410;color:#ffe9a8;border:1px solid #7a6a20;border-radius:4px;padding:4px 9px;cursor:pointer;font:11px ui-monospace,monospace">edge AB</button>
  <button data-p="-1,0.5,0" style="background:#3d3410;color:#ffe9a8;border:1px solid #7a6a20;border-radius:4px;padding:4px 9px;cursor:pointer;font:11px ui-monospace,monospace">edge AC</button>
  <button data-p="0.9,0.9,0" style="background:#3d3410;color:#ffe9a8;border:1px solid #7a6a20;border-radius:4px;padding:4px 9px;cursor:pointer;font:11px ui-monospace,monospace">edge BC</button>
  <button data-p="-1,-1,0" style="background:#3f2226;color:#ffd7d7;border:1px solid #6e3a3f;border-radius:4px;padding:4px 9px;cursor:pointer;font:11px ui-monospace,monospace">vertex A</button>
  <button data-p="2,-1,0" style="background:#3f2226;color:#ffd7d7;border:1px solid #6e3a3f;border-radius:4px;padding:4px 9px;cursor:pointer;font:11px ui-monospace,monospace">vertex B</button>
  <button data-p="-1,2,0" style="background:#3f2226;color:#ffd7d7;border:1px solid #6e3a3f;border-radius:4px;padding:4px 9px;cursor:pointer;font:11px ui-monospace,monospace">vertex C</button>
</div>
<div style="padding:2px 2px 6px;display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:center">
  <span style="color:#7d8794;font:11px ui-monospace,monospace">P.x</span><input id="px" type="range" min="-1.5" max="2.5" step="0.01" value="0.5">
  <span style="color:#7d8794;font:11px ui-monospace,monospace">P.y</span><input id="py" type="range" min="-1.5" max="2.5" step="0.01" value="-1">
  <span style="color:#7d8794;font:11px ui-monospace,monospace">P.z</span><input id="pz" type="range" min="-1.5" max="1.5" step="0.01" value="0">
</div>
<div id="app" style="width:100%;height:300px;background:#0a0f1e;border-radius:8px"></div>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:8px 2px;white-space:pre"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `${SOLVER}

${COLOURS}

// The shortcut from the prose, so the two can be compared side by side. It
// projects onto the plane, and falls back to the nearest CORNER - which is
// exactly the step that cannot produce a point on an edge.
function shortcut(P, A, B, C) {
  var ab = sub(B, A), ac = sub(C, A);
  var n = [ab[1]*ac[2]-ab[2]*ac[1], ab[2]*ac[0]-ab[0]*ac[2], ab[0]*ac[1]-ab[1]*ac[0]];
  var nl = length(n);
  n = scale(n, 1/nl);
  var foot = sub(P, scale(n, dot(sub(P, A), n)));

  // Barycentric test: is the foot inside the triangle?
  var f = sub(foot, A);
  var d00 = dot(ab, ab), d01 = dot(ab, ac), d11 = dot(ac, ac);
  var den = d00*d11 - d01*d01;
  var v = (d11*dot(f, ab) - d01*dot(f, ac)) / den;
  var w = (d00*dot(f, ac) - d01*dot(f, ab)) / den;
  if (v >= 0 && w >= 0 && v + w <= 1) return foot;

  var best = A, bd = length(sub(P, A));
  [B, C].forEach(function (V) {
    var d = length(sub(P, V));
    if (d < bd) { bd = d; best = V; }
  });
  return best;
}

var app = document.getElementById('app');
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(45, app.clientWidth / 300, 0.1, 100);
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(app.clientWidth, 300);
app.appendChild(renderer.domElement);

var drawn = [];
function clear() {
  drawn.forEach(function (o) {
    scene.remove(o);
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  drawn = [];
}

function tube(p1, p2, colour, radius) {
  var a = new THREE.Vector3(p1[0], p1[1], p1[2]);
  var b = new THREE.Vector3(p2[0], p2[1], p2[2]);
  var dir = new THREE.Vector3().subVectors(b, a);
  var L = dir.length();
  if (L < 1e-9) return null;
  var m = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, L, 8),
    new THREE.MeshBasicMaterial({ color: colour }));
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

function ball(p, colour, r) {
  var m = new THREE.Mesh(
    new THREE.SphereGeometry(r, 14, 12),
    new THREE.MeshBasicMaterial({ color: colour }));
  m.position.set(p[0], p[1], p[2]);
  return m;
}

function build(P) {
  clear();
  var res = closestPoint(P, A, B, C);
  var colour = REGION_COLOUR[res.at] || 0xffffff;

  // The triangle face.
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(
    [].concat(A, B, C)), 3));
  var face = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0x39414d, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }));
  scene.add(face); drawn.push(face);

  // Its three edges, with the winning one thickened.
  [['edge AB', A, B], ['edge BC', B, C], ['edge AC', A, C]].forEach(function (e) {
    var lit = res.at === e[0];
    var t = tube(e[1], e[2], lit ? 0xffd43b : 0x5a6472, lit ? 0.02 : 0.008);
    if (t) { scene.add(t); drawn.push(t); }
  });

  // Its three corners, with the winning one enlarged.
  [['vertex A', A], ['vertex B', B], ['vertex C', C]].forEach(function (v) {
    var lit = res.at === v[0];
    var b = ball(v[1], lit ? 0xff6b6b : 0x6d7a8c, lit ? 0.055 : 0.025);
    scene.add(b); drawn.push(b);
  });

  // P, Q, and the line between them.
  var pb = ball(P, 0xffffff, 0.045); scene.add(pb); drawn.push(pb);
  var qb = ball(res.q, colour, 0.045); scene.add(qb); drawn.push(qb);
  var link = tube(P, res.q, 0x8899aa, 0.006);
  if (link) { scene.add(link); drawn.push(link); }

  // What the shortcut would have said.
  var sq = shortcut(P, A, B, C);
  var sd = length(sub(P, sq));
  var d = length(sub(P, res.q));

  var lines = [];
  lines.push('P          ' + P.map(function (n) { return n.toFixed(2).padStart(6); }).join(' '));
  lines.push('Q          ' + res.q.map(function (n) { return n.toFixed(3).padStart(6); }).join(' '));
  lines.push('landed on  ' + res.at);
  lines.push('distance   ' + d.toFixed(6));
  lines.push('');
  lines.push('nearest-corner shortcut');
  lines.push('  Q        ' + sq.map(function (n) { return n.toFixed(3).padStart(6); }).join(' '));
  lines.push('  distance ' + sd.toFixed(6) +
    (sd - d > 1e-9
      ? '   <- overstated by ' + (sd - d).toFixed(6) +
        ' (' + (100 * (sd / d - 1)).toFixed(1) + '%)'
      : '   <- agrees here'));
  document.getElementById('out').textContent = lines.join('\\n');
}

${ORBIT}
orbit(camera, renderer.domElement, 4.2);
(function frame() { requestAnimationFrame(frame); renderer.render(scene, camera); }());

var sx = document.getElementById('px');
var sy = document.getElementById('py');
var sz = document.getElementById('pz');
function fromSliders() {
  build([Number(sx.value), Number(sy.value), Number(sz.value)]);
}
[sx, sy, sz].forEach(function (s) { s.addEventListener('input', fromSliders); });

Array.prototype.forEach.call(document.querySelectorAll('button[data-p]'), function (b) {
  b.addEventListener('click', function () {
    var p = b.getAttribute('data-p').split(',').map(Number);
    sx.value = p[0]; sy.value = p[1]; sz.value = p[2];
    build(p);
  });
});

fromSliders();`,
      outputHeight: 560,
    },

    {
      type: 'markdown',
      instruction: `### Edges are not a rare case

It would be easy to assume the edge and corner answers are unusual — awkward
situations at the boundary that barely come up. That assumption is what makes
the shortcut feel safe.

So it was measured. **40,000 random points** in a box around this triangle
(x and y from −1 to 2, z from −1 to 1), classified by where the closest point
landed:

| landed on | count | share |
|---|---|---|
| inside the face | 2,180 | **5.5%** |
| edge AB | 4,494 | 11.2% |
| edge AC | 4,403 | 11.0% |
| edge BC | 11,071 | 27.7% |
| vertex A | 4,422 | 11.1% |
| vertex B | 6,688 | 16.7% |
| vertex C | 6,742 | 16.9% |

**94.5% of the answers were not inside the face.** Roughly half landed on an
edge — the exact case the shortcut cannot represent. The worst overstatement
across those 40,000 points was **0.6267** on a triangle whose longest side is
√2.

Two honest notes about that table. The shares depend on the box: sample closer
to the triangle and more answers land inside it. And the 27.7% for edge BC is
larger than the other two edges because BC is the hypotenuse, so it faces more
of the box. Neither changes the conclusion — **the interior is the minority
case**, and a method that handles only the interior and the corners is wrong
most of the time it is asked.

#### Barycentric coordinates, which is what the tests are really about

Any point in the plane of the triangle can be written as

\`\`\`
Q = A + v(B − A) + w(C − A)
\`\`\`

Two numbers, \`v\` and \`w\`, say how far to go along each of the two edges
leaving A. Those are **barycentric coordinates**, and the triangle is exactly
the set of points where

\`\`\`
v ≥ 0     w ≥ 0     v + w ≤ 1
\`\`\`

Break the first and you are past edge AC. Break the second and you are past
AB. Break the third and you are past BC. **Each of the three conditions
corresponds to one edge**, which is why there are exactly seven outcomes: the
interior, three ways to fail one condition, and three ways to fail two at once.

The solver never computes \`v\` and \`w\` for points outside, because it does
not need to — it only needs to know **which** condition failed. That is what
every one of those dot-product comparisons is doing, and it is why there is no
square root anywhere until the very end.

**And it is why clamping is not a shortcut to the same answer.** Forcing \`v\`
and \`w\` back into range looks equivalent and is not. Measured over 60,000
random points against this triangle, clamping disagrees with the exact answer on
**34%** of them — and the biggest group is **edge BC**, not a corner. It comes
out exact on the interior, on edge AB, on edge AC and at vertex A, which are
precisely the features touching **A** — the corner the whole coordinate system
is built from. Clamping \`v\` to 0 puts you on AC and \`w\` to 0 puts you on
AB, so those come free; but the \`v + w > 1\` case slides towards A instead of
dropping perpendicularly onto BC, and everything opposite A is wrong. Comparing squared quantities answers
"which is closer" perfectly well, and a square root is expensive when you are
about to do this a few hundred thousand times.

If the dot product needs revisiting, that is
[Dot and Cross Products](#/lesson/la1-003), and projecting onto a plane is
[Lines and Planes in 3D](#/lesson/la1-005).`,
    },

    {
      type: 'challenge',
      instruction: `### 🎯 Write it

\`closestPoint(P, A, B, C)\` returning \`{ q, at }\` — the closest point, and
which of the seven features it landed on as one of:
\`'inside'\`, \`'edge AB'\`, \`'edge AC'\`, \`'edge BC'\`, \`'vertex A'\`,
\`'vertex B'\`, \`'vertex C'\`.

Work through the regions in order. For each one the question is the same shape:
**is P outside across this boundary?** — and a dot product answers it.

\`\`\`
1. behind A on both edges?          -> vertex A
2. behind B?                        -> vertex B
3. outside across AB, between them? -> edge AB, slide along it
4. behind C?                        -> vertex C
5. outside across AC?               -> edge AC
6. outside across BC?               -> edge BC
7. none of the above                -> inside
\`\`\`

For an edge, the answer is \`A + t·(B − A)\` where \`t\` is how far along, from
0 to 1.

It is checked against a brute-force search over 250,000 points spread across
the triangle, at seven probe positions — one per region. Classification is
checked too, not just the distance, because a right distance with a wrong
label means the next lesson gets the wrong answer for the right reason.

**One thing that will bite.** A triangle with two identical corners gives an
edge of zero length, and dividing by it produces \`NaN\` — which does not throw,
spreads through every \`Math.min\` it touches, and silently poisons the result.
The check feeds you one of those.`,
      html: `<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:10px;white-space:pre;background:#0a0f1e;border-radius:8px;min-height:280px"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `var A = [0, 0, 0], B = [1, 0, 0], C = [0, 1, 0];

function sub(u, v) { return [u[0]-v[0], u[1]-v[1], u[2]-v[2]]; }
function add(u, v) { return [u[0]+v[0], u[1]+v[1], u[2]+v[2]]; }
function scale(u, k) { return [u[0]*k, u[1]*k, u[2]*k]; }
function dot(u, v) { return u[0]*v[0] + u[1]*v[1] + u[2]*v[2]; }
function length(u) { return Math.sqrt(dot(u, u)); }

// TODO: return { q: closestPoint, at: whichFeature }
function closestPoint(P, A, B, C) {
  var ab = sub(B, A), ac = sub(C, A);

  // your code here

  return { q: A, at: 'vertex A' };
}

// ── it runs itself below ──────────────────────────────────────────────────
var PROBES = [
  ['inside',   [0.25, 0.25, 0.6]],
  ['edge AB',  [0.5, -1, 0]],
  ['edge AC',  [-1, 0.5, 0]],
  ['edge BC',  [0.9, 0.9, 0]],
  ['vertex A', [-1, -1, 0]],
  ['vertex B', [2, -1, 0]],
  ['vertex C', [-1, 2, 0]],
];

var lines = ['  probe P                 landed on    distance    want'];
PROBES.forEach(function (probe) {
  var r = closestPoint(probe[1], A, B, C);
  var d = (r && r.q) ? length(sub(probe[1], r.q)) : NaN;
  lines.push('  ' + JSON.stringify(probe[1]).padEnd(20) +
    ('' + (r && r.at)).padEnd(13) +
    d.toFixed(4).padStart(8) + '    ' + probe[0]);
});
console.log(lines.join('\\n'));
document.getElementById('out').textContent = lines.join('\\n');`,
      check: (js) => {
        const no = (message) => ({ pass: false, message });

        let fn;
        try {
          // eslint-disable-next-line no-new-func
          fn = new Function(
            js.replace(/^\s*\/\/ ── it runs itself below[\s\S]*$/m, '') +
            '\nreturn closestPoint;',
          )();
        } catch (e) {
          return no('The code did not run: ' + e.message);
        }
        if (typeof fn !== 'function') return no('closestPoint is not a function.');

        const A = [0, 0, 0], B = [1, 0, 0], C = [0, 1, 0];
        const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
        const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
        const dist = (u, v) => Math.sqrt(dot(sub(u, v), sub(u, v)));

        // Brute force over a dense sampling of the triangle. Slow, obviously
        // correct, and completely independent of how the reader did it.
        const brute = (P, a, b, c) => {
          const N = 500;
          let best = Infinity;
          for (let i = 0; i <= N; i++) {
            const u = i / N;
            for (let j = 0; j <= N - i; j++) {
              const v = j / N;
              const q = [
                a[0] + u * (b[0] - a[0]) + v * (c[0] - a[0]),
                a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1]),
                a[2] + u * (b[2] - a[2]) + v * (c[2] - a[2]),
              ];
              const d = dist(P, q);
              if (d < best) best = d;
            }
          }
          return best;
        };

        const probes = [
          ['inside', [0.25, 0.25, 0.6]],
          ['edge AB', [0.5, -1, 0]],
          ['edge AC', [-1, 0.5, 0]],
          ['edge BC', [0.9, 0.9, 0]],
          ['vertex A', [-1, -1, 0]],
          ['vertex B', [2, -1, 0]],
          ['vertex C', [-1, 2, 0]],
        ];

        for (const [want, P] of probes) {
          let r;
          try { r = fn(P, A, B, C); } catch (e) { return no('closestPoint threw on P=[' + P + ']: ' + e.message); }
          if (!r || !Array.isArray(r.q) || typeof r.at !== 'string') {
            return no('closestPoint should return { q: [x,y,z], at: "..." }. On P=[' + P
              + '] it returned ' + JSON.stringify(r) + '.');
          }
          if (r.q.some((n) => !Number.isFinite(n))) {
            return no('P=[' + P + '] produced a non-finite point: [' + r.q.join(', ')
              + ']. A NaN here is almost always a division by a zero-length edge.');
          }

          const got = dist(P, r.q);
          const truth = brute(P, A, B, C);
          if (Math.abs(got - truth) > 2e-3) {
            const hint = got > truth
              ? 'Your answer is FURTHER than the true closest point, so a nearer region '
                + 'is being missed — usually the edge cases, which is the whole point of '
                + 'this lesson.'
              : 'Your answer is NEARER than any point on the triangle, so q is off the '
                + 'triangle altogether — check the edge parameter t is clamped to 0..1.';
            return no('P=[' + P + ']: you returned a distance of ' + got.toFixed(4)
              + ', but a brute-force search of the triangle finds ' + truth.toFixed(4)
              + '. ' + hint);
          }

          if (r.at !== want) {
            return no('P=[' + P + ']: the distance is right but you labelled it "'
              + r.at + '" instead of "' + want + '". The classification is used by the '
              + 'next lesson, so a right distance with a wrong label is still wrong.');
          }
        }

        // The degenerate triangle. Two identical corners means a zero-length
        // edge, and the unguarded division returns NaN without throwing.
        const degenerates = [
          ['two corners identical', [0, 0, 0], [0, 0, 0], [1, 0, 0]],
          ['all three identical', [1, 2, 3], [1, 2, 3], [1, 2, 3]],
          ['three points in a line', [0, 0, 0], [1, 0, 0], [2, 0, 0]],
        ];
        for (const [label, a, b, c] of degenerates) {
          let r;
          try { r = fn([0.5, 1, 0], a, b, c); } catch (e) {
            return no('A degenerate triangle (' + label + ') made closestPoint throw: '
              + e.message + '. Real meshes contain these, and lesson 3’s weld can '
              + 'create them, so it has to return something finite.');
          }
          if (!r || !Array.isArray(r.q) || r.q.some((n) => !Number.isFinite(n))) {
            return no('A degenerate triangle (' + label + ') produced '
              + JSON.stringify(r && r.q) + '. Dividing by a zero-length edge gives NaN, '
              + 'which does not throw and spreads through every comparison it touches. '
              + 'Guard the divisions: if the edge has no length, the corner is the answer.');
          }
        }

        return {
          pass: true,
          message: 'All seven regions correct, agreeing with a brute-force search, and '
            + 'the degenerate triangles return a finite point instead of NaN. This is the '
            + 'one triangle everything else is built on.',
        };
      },
      successMessage: '✓ One triangle, correct.',
      failMessage: '✗ Not yet.',
      outputHeight: 460,
    },

  ],
};

// ── The Python half ───────────────────────────────────────────────────────
const PY_CELLS = [
  {
    id: 'bary',
    cellTitle: 'Barycentric coordinates, by hand',
    prose: [
      'Before any region tests, get comfortable with the two numbers the whole thing is built on. Any point in the triangle’s plane is A + v(B-A) + w(C-A), and v and w say how far along each edge leaving A to travel.',
      'Solving for v and w from a point is a 2x2 linear system, and the code below is that solution written out. d00, d01 and d11 are the three dot products of the two edge vectors with each other; den is the determinant of the system, which is also twice the triangle’s area squared.',
      'Run it and read the table. Inside the triangle both v and w are positive and their sum is at most 1. Outside, exactly one of those three conditions fails for an edge case, and two fail at a corner - which is where the seven regions come from.',
    ],
    code: `import numpy as np

A = np.array([0.0, 0.0, 0.0])
B = np.array([1.0, 0.0, 0.0])
C = np.array([0.0, 1.0, 0.0])

def barycentric(P, A, B, C):
    ab, ac, ap = B - A, C - A, np.asarray(P, float) - A
    d00, d01, d11 = ab @ ab, ab @ ac, ac @ ac
    d20, d21 = ap @ ab, ap @ ac
    den = d00 * d11 - d01 * d01          # = 4 x area^2
    v = (d11 * d20 - d01 * d21) / den
    w = (d00 * d21 - d01 * d20) / den
    return v, w

print(f"{'point':>18} {'v':>7} {'w':>7} {'v+w':>7}   which condition fails")
for label, P in [
    ("centre",        [1/3, 1/3, 0]),
    ("at A",          [0, 0, 0]),
    ("at B",          [1, 0, 0]),
    ("past AB",       [0.5, -1, 0]),
    ("past AC",       [-1, 0.5, 0]),
    ("past BC",       [0.9, 0.9, 0]),
    ("past AB and AC",[-1, -1, 0]),
]:
    v, w = barycentric(P, A, B, C)
    broken = []
    if v < -1e-12: broken.append("v >= 0")
    if w < -1e-12: broken.append("w >= 0")
    if v + w > 1 + 1e-12: broken.append("v + w <= 1")
    print(f"{label:>18} {v:>7.3f} {w:>7.3f} {v+w:>7.3f}   "
          f"{', '.join(broken) if broken else 'none - inside'}")`,
  },
  {
    id: 'solver',
    cellTitle: 'The region test',
    prose: [
      'Now the solver. Each block asks one question - is P outside across this boundary - and every question is a comparison of dot products, so there is no square root and no division until a division is unavoidable.',
      'Read the guards on the divisions. d1 - d3 is the squared length of AB; if it is zero then A and B are the same point, there is no edge to slide along, and the corner is the answer. Without that guard the function returns NaN, which does NOT raise - it spreads silently through every comparison downstream.',
      'That is not a hypothetical. Real meshes contain degenerate triangles, and the weld in lesson 3 can create them by merging two corners of the same face.',
    ],
    code: `def closest_point(P, A, B, C):
    P, A, B, C = (np.asarray(x, float) for x in (P, A, B, C))
    ab, ac = B - A, C - A

    ap = P - A
    d1, d2 = ab @ ap, ac @ ap
    if d1 <= 0 and d2 <= 0:
        return A, "vertex A"

    bp = P - B
    d3, d4 = ab @ bp, ac @ bp
    if d3 >= 0 and d4 <= d3:
        return B, "vertex B"

    vc = d1 * d4 - d3 * d2
    if vc <= 0 and d1 >= 0 and d3 <= 0:
        # d1 - d3 is |AB|^2. Zero means A and B coincide: no edge, so the corner.
        return (A if d1 == d3 else A + (d1 / (d1 - d3)) * ab), "edge AB"

    cp = P - C
    d5, d6 = ab @ cp, ac @ cp
    if d6 >= 0 and d5 <= d6:
        return C, "vertex C"

    vb = d5 * d2 - d1 * d6
    if vb <= 0 and d2 >= 0 and d6 <= 0:
        return (A if d2 == d6 else A + (d2 / (d2 - d6)) * ac), "edge AC"

    va = d3 * d6 - d5 * d4
    if va <= 0 and (d4 - d3) >= 0 and (d5 - d6) >= 0:
        span = (d4 - d3) + (d5 - d6)
        return (B if span == 0 else B + ((d4 - d3) / span) * (C - B)), "edge BC"

    total = va + vb + vc           # twice the area; zero means collinear
    if total == 0:
        return A, "degenerate"
    return A + ab * (vb / total) + ac * (vc / total), "inside"


print(f"{'probe P':>20} {'region':>10} {'closest point':>24} {'distance':>9}")
for P in [[0.25,0.25,0.6], [0.5,-1,0], [-1,0.5,0], [0.9,0.9,0],
          [-1,-1,0], [2,-1,0], [-1,2,0]]:
    q, at = closest_point(P, A, B, C)
    d = np.linalg.norm(np.array(P, float) - q)
    print(f"{str(P):>20} {at:>10} {str(np.round(q,4)):>24} {d:>9.4f}")`,
  },
  {
    id: 'brute',
    cellTitle: 'Check it against something obviously correct',
    prose: [
      'Seven branches of comparisons is enough code to be confidently wrong in. So check it against a method that is too stupid to be subtly wrong: sample the triangle densely and take the nearest sample.',
      'Brute force is far too slow to use, and that is fine - its only job is to be obviously right. If the fast version and the slow version agree at every probe, the fast one is probably correct. If they disagree, the fast one is wrong, and no amount of re-reading it counts as evidence.',
      'This is the pattern worth taking away from the whole lesson: a second implementation you did not optimise is the cheapest correctness check available.',
    ],
    code: `def brute_force(P, A, B, C, n=600):
    P = np.asarray(P, float)
    best, best_d = None, np.inf
    for i in range(n + 1):
        u = i / n
        vs = np.linspace(0, 1 - u, max(2, int(n * (1 - u)) + 1))
        pts = A + u * (B - A) + vs[:, None] * (C - A)
        d = np.linalg.norm(pts - P, axis=1)
        k = int(np.argmin(d))
        if d[k] < best_d:
            best_d, best = d[k], pts[k]
    return best, best_d

print(f"{'probe P':>20} {'analytic':>10} {'brute':>10}  agree")
worst = 0.0
for P in [[0.25,0.25,0.6], [0.5,-1,0], [-1,0.5,0], [0.9,0.9,0],
          [-1,-1,0], [2,-1,0], [-1,2,0], [0.4,0.4,-0.9]]:
    q, at = closest_point(P, A, B, C)
    d = float(np.linalg.norm(np.array(P, float) - q))
    _, bd = brute_force(P, A, B, C)
    worst = max(worst, abs(d - bd))
    print(f"{str(P):>20} {d:>10.5f} {bd:>10.5f}  {abs(d-bd) < 2e-3}")

print()
print(f"worst disagreement: {worst:.2e}")
print("(not zero, because brute force only samples - it approaches the true")
print(" answer from above as the sampling gets finer.)")`,
  },
  {
    id: 'ch-solver',
    challengeType: 'write',
    challengeTitle: 'Write the solver, and prove it with brute force',
    difficulty: 'core',
    prompt:
      'Write my_closest(P, A, B, C) returning (point, label) for all seven regions. '
      + 'Do not copy the cell above - work from the barycentric conditions: which of '
      + 'v >= 0, w >= 0, v + w <= 1 has failed tells you which edge you are past, and '
      + 'two failing at once puts you at a corner. The test checks it against brute '
      + 'force at every probe, and feeds it a degenerate triangle.',
    hint:
      'Work the cases in the order that lets each one assume the previous ones are '
      + 'ruled out: corner A, corner B, edge AB, corner C, edge AC, edge BC, then '
      + 'inside. For an edge, clamp the parameter t into 0..1 and return A + t*(B-A). '
      + 'Guard every division against a zero-length edge.',
    code: `def my_closest(P, A, B, C):
    # TODO: return (closest_point_as_array, label)
    #       labels: "inside", "edge AB", "edge AC", "edge BC",
    #               "vertex A", "vertex B", "vertex C"
    pass


for P in [[0.25,0.25,0.6], [0.5,-1,0], [0.9,0.9,0], [-1,-1,0]]:
    print(P, "->", my_closest(P, A, B, C))`,
    solution: `def my_closest(P, A, B, C):
    P, A, B, C = (np.asarray(x, float) for x in (P, A, B, C))
    ab, ac = B - A, C - A

    ap = P - A
    d1, d2 = ab @ ap, ac @ ap
    if d1 <= 0 and d2 <= 0:
        return A, "vertex A"

    bp = P - B
    d3, d4 = ab @ bp, ac @ bp
    if d3 >= 0 and d4 <= d3:
        return B, "vertex B"

    vc = d1 * d4 - d3 * d2
    if vc <= 0 and d1 >= 0 and d3 <= 0:
        return (A if d1 == d3 else A + (d1 / (d1 - d3)) * ab), "edge AB"

    cp = P - C
    d5, d6 = ab @ cp, ac @ cp
    if d6 >= 0 and d5 <= d6:
        return C, "vertex C"

    vb = d5 * d2 - d1 * d6
    if vb <= 0 and d2 >= 0 and d6 <= 0:
        return (A if d2 == d6 else A + (d2 / (d2 - d6)) * ac), "edge AC"

    va = d3 * d6 - d5 * d4
    if va <= 0 and (d4 - d3) >= 0 and (d5 - d6) >= 0:
        span = (d4 - d3) + (d5 - d6)
        return (B if span == 0 else B + ((d4 - d3) / span) * (C - B)), "edge BC"

    total = va + vb + vc
    if total == 0:
        return A, "degenerate"
    return A + ab * (vb / total) + ac * (vc / total), "inside"


for P in [[0.25,0.25,0.6], [0.5,-1,0], [0.9,0.9,0], [-1,-1,0]]:
    print(P, "->", my_closest(P, A, B, C))`,
    testCode: `PROBES = [
    ("inside",   [0.25, 0.25, 0.6]),
    ("edge AB",  [0.5, -1, 0]),
    ("edge AC",  [-1, 0.5, 0]),
    ("edge BC",  [0.9, 0.9, 0]),
    ("vertex A", [-1, -1, 0]),
    ("vertex B", [2, -1, 0]),
    ("vertex C", [-1, 2, 0]),
]
for want, P in PROBES:
    r = my_closest(P, A, B, C)
    assert r is not None, "my_closest returned None - 'pass' is still there."
    assert len(r) == 2, f"expected (point, label), got {r!r}"
    q, at = r
    q = np.asarray(q, float)
    assert np.all(np.isfinite(q)), (
        f"P={P} gave a non-finite point {q} - almost always a division by a "
        f"zero-length edge")
    d = float(np.linalg.norm(np.array(P, float) - q))
    _, bd = brute_force(P, A, B, C, n=300)
    assert abs(d - bd) < 4e-3, (
        f"P={P}: you returned {d:.5f} but brute force finds {bd:.5f}. "
        + ("A larger distance means a nearer region is being missed."
           if d > bd else
           "A smaller distance means q is not on the triangle at all."))
    assert at == want, (
        f"P={P}: distance is right but the label is '{at}', expected '{want}'. "
        f"The classification is what lesson 6 uses.")

# Degenerate triangles, which real meshes contain.
for label, tri in [
    ("two corners identical", ([0,0,0], [0,0,0], [1,0,0])),
    ("all three identical",   ([1,2,3], [1,2,3], [1,2,3])),
    ("three points in a line",([0,0,0], [1,0,0], [2,0,0])),
]:
    q, at = my_closest([0.5, 1, 0], *tri)
    q = np.asarray(q, float)
    assert np.all(np.isfinite(q)), (
        f"a degenerate triangle ({label}) produced {q}. Dividing by a zero-length "
        f"edge gives NaN, which does not raise and poisons everything downstream. "
        f"Guard the divisions.")

"SUCCESS: seven regions, agreeing with brute force, and no NaN on a degenerate face."`,
  },
  {
    id: 'vectorised',
    cellTitle: 'All the points at once',
    prose: [
      'The solver takes one point. The application asks about hundreds of thousands, and a Python loop over those is not viable - lesson 4 showed what a per-item Python loop costs.',
      'The branches are the difficulty: numpy has no if statement that works per-element. The answer is to compute every candidate for every point, then use np.where to select - so the work is done for all seven regions and the right one is picked. That sounds wasteful and is still far faster than branching one point at a time.',
      'The version below does the simpler half: clamp v and w into range, renormalising when they overshoot. It is a genuine approximation, and where it is wrong is not where you would guess.',
      'Measured over 60,000 random points, it disagrees with the exact solver on 34% of them for this right triangle - and the largest group is edge BC, not a corner. It is exact on the interior, on edge AB, on edge AC and at vertex A, and wrong on edge BC and at vertices B and C. Those first four are exactly the features touching A, the corner the coordinate system is built from: clamping v to 0 lands you on AC and w to 0 on AB, so those two edges come out right for free, while the v + w > 1 case is a radial projection towards A rather than a perpendicular one onto BC.',
      'It gets worse as the triangle gets less even. On a skewed obtuse triangle the disagreement is 88% of points, and on a thin sliver 98%, with errors of 2.46 and 3.00 against a triangle only 3 units long. Real meshes are full of slivers.',
      'None of that makes it useless - it makes it an approximation whose failure mode you know, which is a different thing from a method you believe is exact. And this is where lesson 7 starts, because even fully vectorised, every point against every triangle does not scale.',
    ],
    code: `import time

def clamped_barycentric(P, A, B, C):
    """Vectorised, and deliberately incomplete: clamps v and w into the
    triangle. Right for the interior and the edges, wrong at some corners."""
    P = np.atleast_2d(np.asarray(P, float))
    ab, ac = B - A, C - A
    ap = P - A
    d00, d01, d11 = ab @ ab, ab @ ac, ac @ ac
    den = d00 * d11 - d01 * d01
    d20, d21 = ap @ ab, ap @ ac
    v = (d11 * d20 - d01 * d21) / den
    w = (d00 * d21 - d01 * d20) / den
    v = np.clip(v, 0, 1)
    w = np.clip(w, 0, 1)
    over = v + w > 1
    s = np.where(over, v + w, 1.0)
    v, w = np.where(over, v / s, v), np.where(over, w / s, w)
    return A + v[:, None] * ab + w[:, None] * ac

probes = np.array([[0.25,0.25,0.6], [0.5,-1,0], [-1,0.5,0], [0.9,0.9,0],
                   [-1,-1,0], [2,-1,0], [-1,2,0]])
fast = clamped_barycentric(probes, A, B, C)

print(f"{'probe':>18} {'exact':>9} {'clamped':>9}  {'region':>9}  agree")
for P, qf in zip(probes, fast):
    q, at = closest_point(P, A, B, C)
    de = float(np.linalg.norm(P - q))
    df = float(np.linalg.norm(P - qf))
    print(f"{str(list(P)):>18} {de:>9.4f} {df:>9.4f}  {at:>9}  "
          f"{abs(de-df) < 1e-9}")

print()
print("Where they disagree is where clamping is not the same as choosing.")
print()

# And the speed, which is the reason to bother.
many = np.random.default_rng(3).uniform(-1, 2, size=(200_000, 3))
t0 = time.perf_counter(); clamped_barycentric(many, A, B, C); t1 = time.perf_counter()
n = 2000
t2 = time.perf_counter()
for P in many[:n]:
    closest_point(P, A, B, C)
t3 = time.perf_counter()
print(f"vectorised, 200,000 points : {1000*(t1-t0):8.1f} ms")
print(f"loop, {n} points          : {1000*(t3-t2):8.1f} ms"
      f"  -> {1000*(t3-t2)*(200_000/n):.0f} ms for 200,000")`,
  },
  {
    id: 'ch-vector',
    challengeType: 'write',
    challengeTitle: 'Find out where clamping actually fails',
    difficulty: 'core',
    prompt:
      'clamped_barycentric is an approximation. Find out which features it gets wrong, '
      + 'by searching rather than by reasoning. Sample at least 5,000 random points around '
      + 'the triangle, and for each one compare its distance against closest_point. Collect '
      + 'the region labels where they differ by more than 1e-9 into a set called bad_regions. '
      + 'The answer is not the one most people predict.',
    hint:
      'The seven probe points from earlier all happen to agree, so testing those finds '
      + 'nothing - you have to sample. rng.uniform(-2, 3, size=(5000, 3)) is plenty. '
      + 'closest_point returns (point, label); compare float distances, not points.',
    code: `bad_regions = set()

# TODO: sample points, compare clamped_barycentric against closest_point,
#       and collect the region labels where they disagree.

print("clamping is wrong on:", sorted(bad_regions))
print("clamping is exact on:", sorted(
    {"inside", "edge AB", "edge AC", "edge BC", "vertex A", "vertex B", "vertex C"}
    - bad_regions))`,
    solution: `bad_regions = set()

rng3 = np.random.default_rng(5)
sample = rng3.uniform(-2, 3, size=(6000, 3))
sample[:, 2] = rng3.uniform(-1.5, 1.5, size=6000)

fast = clamped_barycentric(sample, A, B, C)
for P, qf in zip(sample, fast):
    q, at = closest_point(P, A, B, C)
    if float(np.linalg.norm(P - qf)) - float(np.linalg.norm(P - q)) > 1e-9:
        bad_regions.add(at)

print("clamping is wrong on:", sorted(bad_regions))
print("clamping is exact on:", sorted(
    {"inside", "edge AB", "edge AC", "edge BC", "vertex A", "vertex B", "vertex C"}
    - bad_regions))`,
    testCode: `assert isinstance(bad_regions, set), (
    f"bad_regions should be a set of region labels, got {type(bad_regions).__name__}")
assert len(bad_regions) > 0, (
    "no disagreements found. clamped_barycentric is NOT exact - but the seven probe "
    "points all happen to agree, so you have to SAMPLE random points to find where "
    "it fails.")

# Work out the answer independently rather than trusting the set.
_rng = np.random.default_rng(99)
_pts = _rng.uniform(-2, 3, size=(20000, 3))
_pts[:, 2] = _rng.uniform(-1.5, 1.5, size=20000)
_fast = clamped_barycentric(_pts, A, B, C)
_truth = set()
for _P, _qf in zip(_pts, _fast):
    _q, _at = closest_point(_P, A, B, C)
    if float(np.linalg.norm(_P - _qf)) - float(np.linalg.norm(_P - _q)) > 1e-9:
        _truth.add(_at)

_missed = _truth - bad_regions
_extra = bad_regions - _truth
assert not _extra, (
    f"you listed {sorted(_extra)} as wrong, but an independent 20,000-point search "
    f"finds clamping exact there. Compare distances with a tolerance of 1e-9.")
assert not _missed, (
    f"you missed {sorted(_missed)}. Sample more points, or over a wider box - "
    f"some regions are only reached from certain directions.")

assert "edge BC" in bad_regions, (
    "edge BC has to be in there, and it is the surprise: clamping fails on an EDGE, "
    "not only at corners.")
assert "edge AB" not in bad_regions and "edge AC" not in bad_regions, (
    "edges AB and AC should come out exact. Clamping v to 0 lands you on AC and w to 0 "
    "lands you on AB, so the two edges touching A are free.")
assert "vertex A" not in bad_regions, (
    "vertex A should come out exact - clamping both coordinates to 0 gives A.")
assert "inside" not in bad_regions, "the interior is exact; nothing is clamped there."
"SUCCESS: wrong on edge BC and vertices B and C, exact on everything touching A. The method is biased towards the corner its coordinates are built from."`,
  },
  {
    id: 'regions',
    cellTitle: 'Measure how often the answer is not on the face',
    prose: [
      'The shortcut in the JavaScript half - project onto the plane, and if the foot lands outside, snap to the nearest corner - is only defensible if edge answers are rare. So count them rather than guessing.',
      'The result is the justification for the whole lesson, and it is not close. Note that the exact shares depend on the sampling box: points drawn nearer the triangle land inside it more often. The conclusion does not depend on the box, though - the interior is a minority everywhere except right up against the face.',
    ],
    code: `def shortcut(P, A, B, C):
    n = np.cross(B - A, C - A)
    n = n / np.linalg.norm(n)
    P = np.asarray(P, float)
    foot = P - n * ((P - A) @ n)
    v, w = barycentric(foot, A, B, C)
    if v >= 0 and w >= 0 and v + w <= 1:
        return foot
    return min((A, B, C), key=lambda V: np.linalg.norm(P - V))

rng = np.random.default_rng(7)
pts = rng.uniform(-1, 2, size=(8000, 3))
pts[:, 2] = rng.uniform(-1, 1, size=8000)

tally, worst = {}, 0.0
for P in pts:
    q, at = closest_point(P, A, B, C)
    tally[at] = tally.get(at, 0) + 1
    worst = max(worst, float(np.linalg.norm(P - shortcut(P, A, B, C))
                            - np.linalg.norm(P - q)))

total = sum(tally.values())
for at in ["inside", "edge AB", "edge AC", "edge BC",
           "vertex A", "vertex B", "vertex C"]:
    k = tally.get(at, 0)
    print(f"  {at:>9}  {k:>5}  {100*k/total:5.1f}%")

off = total - tally.get("inside", 0)
print()
print(f"  not inside the face: {off} of {total} = {100*off/total:.1f}%")
print(f"  worst overstatement by the shortcut: {worst:.4f}")
print()
print("  About half of all answers sit on an edge - the one case the")
print("  nearest-corner shortcut can never produce.")`,
  },
  {
    id: 'ch-worst',
    challengeType: 'write',
    challengeTitle: 'Find where the shortcut is worst',
    difficulty: 'stretch',
    prompt:
      'Search for the point where the nearest-corner shortcut overstates the distance '
      + 'by the largest fraction. Set worst_P to that point and worst_ratio to '
      + 'shortcut_distance / true_distance there. Then say which region the true answer '
      + 'was in - the answer should not surprise you by now.',
    hint:
      'Sample a few thousand points, compute both distances for each, and keep the '
      + 'largest ratio. Exclude points very close to the triangle, where the true '
      + 'distance approaches zero and the ratio blows up for uninteresting reasons - '
      + 'require a true distance of at least 0.05.',
    code: `worst_P = None
worst_ratio = 1.0

# TODO: search for the worst ratio, ignoring points closer than 0.05

print("worst_P     ", worst_P)
print("worst_ratio ", round(worst_ratio, 4) if worst_P is not None else None)
if worst_P is not None:
    print("true region ", closest_point(worst_P, A, B, C)[1])`,
    solution: `worst_P = None
worst_ratio = 1.0

rng2 = np.random.default_rng(11)
candidates = rng2.uniform(-1.5, 2.5, size=(6000, 3))
candidates[:, 2] = rng2.uniform(-1, 1, size=6000)

for P in candidates:
    q, at = closest_point(P, A, B, C)
    true_d = float(np.linalg.norm(P - q))
    if true_d < 0.05:
        continue
    ratio = float(np.linalg.norm(P - shortcut(P, A, B, C))) / true_d
    if ratio > worst_ratio:
        worst_ratio, worst_P = ratio, P

print("worst_P     ", worst_P)
print("worst_ratio ", round(worst_ratio, 4) if worst_P is not None else None)
if worst_P is not None:
    print("true region ", closest_point(worst_P, A, B, C)[1])`,
    testCode: `assert worst_P is not None, "worst_P was never set - the search did not run."
assert worst_ratio > 1.0, (
    f"worst_ratio came out {worst_ratio}, which would mean the shortcut is never "
    f"worse than the exact answer. It is.")

_P = np.asarray(worst_P, float)
_q, _at = closest_point(_P, A, B, C)
_true = float(np.linalg.norm(_P - _q))
assert _true >= 0.05 - 1e-9, (
    f"worst_P sits {_true:.4f} from the triangle; points nearer than 0.05 were "
    f"meant to be excluded, because the ratio blows up there for uninteresting reasons")
_ratio = float(np.linalg.norm(_P - shortcut(_P, A, B, C))) / _true
assert abs(_ratio - worst_ratio) < 1e-6, (
    f"worst_ratio is {worst_ratio:.6f} but at worst_P the ratio is {_ratio:.6f}")
assert worst_ratio > 1.15, (
    f"the worst ratio found was only {worst_ratio:.4f}. A wider or larger search "
    f"finds considerably worse - the shortcut can overstate by well over 20%.")
assert "edge" in _at, (
    f"the worst case landed on '{_at}'. It should be an edge: that is the one "
    f"region the nearest-corner shortcut cannot represent.")
"SUCCESS: the worst case is on an edge, which is exactly the case the shortcut cannot reach."`,
  },
];

export default {
  id: 'mesh-engine-1-5-point-to-triangle',
  slug: 'point-to-triangle',
  chapter: 'mesh-engine.1',
  order: 4,
  title: 'Point-to-Triangle Distance',
  subtitle: 'The closest point can land in seven places, and the obvious method finds only four.',
  tags: [
    'closest point', 'distance', 'barycentric coordinates', 'dot product',
    'region test', 'Voronoi regions', 'degenerate triangle', 'NaN',
    'brute force check', 'vectorisation',
  ],
  aliases: 'closest point on triangle point triangle distance barycentric coordinates v w region test Voronoi region edge case vertex region Ericson clamp degenerate triangle NaN guard brute force verification',
  timeToComplete: 65,
  coreConcept:
    'The closest point on a triangle to an arbitrary point lies in one of seven places: inside the face, along one of three edges, or at one of three corners. Which one is decided entirely by comparisons of dot products, with no square roots needed until the end. The obvious method - project onto the plane and fall back to the nearest corner - can never return a point in the middle of an edge, and measured over 40,000 random probes roughly half of all answers are exactly that.',
  prerequisites: ['mesh-engine-1-4-mesh-files'],
  nextLesson: 'mesh-engine-1-6-point-to-mesh',

  semantics: {
    core: [
      { symbol: 'Q = A + v(B-A) + w(C-A)', meaning: 'Any point in the triangle’s plane, written from corner A. v and w are its barycentric coordinates.' },
      { symbol: 'v >= 0, w >= 0, v + w <= 1', meaning: 'The three conditions that define the triangle. Each one corresponds to one edge, which is where the seven regions come from.' },
      { symbol: 'dot(ab, ap)', meaning: 'How far along AB the point P sits, measured from A. Negative means behind A.' },
      { symbol: 'vc = d1*d4 - d3*d2', meaning: 'Proportional to the barycentric weight edge AB would have to give up. Negative means P is outside across AB.' },
      { symbol: 'd1 - d3', meaning: 'The squared length of AB. Zero means A and B are the same point, and dividing by it produces NaN.' },
      { symbol: 'va + vb + vc', meaning: 'Twice the triangle’s area. Zero means the three corners are collinear and there is no interior.' },
      { symbol: 'the seven regions', meaning: 'inside, edge AB, edge AC, edge BC, vertex A, vertex B, vertex C. The classification matters as much as the distance.' },
    ],
    rulesOfThumb: [
      'Never fall back to the nearest corner. The closest point is often in the middle of an edge, and measured on a random box roughly half the time.',
      'Compare squared distances. A square root is only needed once, at the end, if at all.',
      'Return the region alongside the point. Later stages need to know whether the answer came from a face, an edge or a corner.',
      'Guard every division against a zero-length edge, and against a zero-area triangle. NaN does not throw and spreads silently.',
      'Check a branchy geometric routine against brute force. A second implementation you did not optimise is the cheapest correctness evidence there is.',
      'Clamping barycentric coordinates is not the same as choosing the closest feature. Measured: it is exact only on the interior and on the features touching the corner the coordinates are built from, and wrong on everything opposite - 34% of random points on a right triangle, 98% on a sliver.',
    ],
  },

  hook: {
    question: 'Triangle A(0,0,0) B(1,0,0) C(0,1,0), and the point P(0.5, -1, 0). Project P onto the triangle’s plane; the foot lands outside the triangle. So take the nearest corner. How wrong is that answer?',
    realWorldContext: 'The nearest corner is A, at distance sqrt(1.25) = 1.118034. The true closest point is (0.5, 0, 0) — the midpoint of edge AB — at distance exactly 1.0. The shortcut overstates by 11.8%, and nothing about its answer looks wrong: it is a real distance to a real point on the triangle. It is simply not the smallest one. Over 40,000 random probes the closest point landed off the face 94.5% of the time, and on an edge in about half of all cases.',
    previewVisualizationId: 'JSNotebook',
  },

  intuition: {
    prose: [
      'Comparing two models reduces to one question asked hundreds of thousands of times: how far is this point from that surface. A surface is triangles, so one triangle has to be right first.',
      'Any point in the triangle’s plane is A + v(B-A) + w(C-A). The triangle is where v >= 0, w >= 0 and v + w <= 1.',
      'Each of those three conditions corresponds to one edge. Break one and you are past that edge; break two and you are at the corner between them.',
      'That gives seven possible answers: the interior, three edges, three corners. Nothing else is possible.',
      'Deciding which needs only comparisons of dot products - no square roots, and no division until one is unavoidable.',
      'The obvious shortcut is to project and fall back to the nearest corner, and it is wrong precisely because it can never land mid-edge.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: closest point on a triangle',
        body: 'Step 1. Is P behind A along both edges leaving it? Then A.\nStep 2. Is P behind B? Then B.\nStep 3. Is P outside across AB, and between A and B along it? Then slide along AB.\nStep 4. Is P behind C? Then C.\nStep 5. Outside across AC? Slide along AC.\nStep 6. Outside across BC? Slide along BC.\nStep 7. Otherwise P projects into the face; use its barycentric coordinates.\nEach step may assume every earlier one has been ruled out, which is why the order matters and why no step needs the full barycentric solve.',
      },
      {
        type: 'warning',
        title: 'The nearest corner is not the nearest point',
        body: 'Projecting onto the plane and falling back to the nearest corner when the foot lands outside is the first thing most people write. It is wrong for every point whose closest feature is the middle of an edge. On the standard example it overstates by 11.8%, and the worst case measured over 40,000 probes overstated by 0.6267 on a triangle whose longest side is only sqrt(2). The answer never looks wrong, because it is a genuine distance to a genuine point on the triangle.',
      },
      {
        type: 'warning',
        title: 'A zero-length edge returns NaN, and NaN does not throw',
        body: 'The edge parameter divides by the squared length of the edge. On a triangle with two identical corners that is zero, and the result is NaN - which raises nothing, compares false against everything, and survives Math.min to poison whatever uses it. Real meshes contain degenerate triangles, and the weld in lesson 3 can create them by merging two corners of one face. Guard the divisions: no edge means the corner is the answer.',
      },
      {
        type: 'insight',
        title: 'No square roots',
        body: 'Every decision in the algorithm is a comparison, and comparing squared lengths orders points exactly as comparing lengths does. So the square root is needed once at the very end, if a distance is wanted at all - and when the question is only "which triangle is nearest", never. At a few hundred thousand queries that is not a micro-optimisation.',
      },
      {
        type: 'insight',
        title: 'Brute force is the check, not the method',
        body: 'Seven branches of dot-product comparisons is enough code to be confidently wrong in, and re-reading it is not evidence. Sampling the triangle densely and taking the nearest sample is far too slow to use and far too simple to be subtly wrong, which makes it the ideal second opinion. Both halves of this lesson check against it, and the challenge does too.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Move the point, watch which of the seven answers you get',
        caption: 'Blue for the face, yellow for an edge, red for a corner — with what the shortcut would have said, alongside.',
        props: {
          lesson: LESSON_MESH_1_5,
        },
      },
    ],
  },

  math: {
    prose: [
      'The Python half derives the barycentric solve, builds the region test with its guards, and then checks the whole thing against brute force rather than against its own reasoning.',
      'Then it vectorises - and shows that the easy vectorisation, clamping the barycentric coordinates, is right for the interior and the edges and wrong at some corners. Knowing which approximation you are using matters more than having one.',
      'The last cells measure how often the answer is off the face, and search for the point where the shortcut is worst. It lands on an edge, every time.',
    ],
    visualizations: [
      {
        id: 'PythonNotebook',
        title: 'Barycentric, the region test, brute force, then all the points at once',
        mathBridge: 'Solving for v and w is a 2x2 linear system in the edge vectors, and its determinant d00*d11 - d01*d01 is four times the squared area - so it vanishing is exactly the statement that the triangle is degenerate. The region tests are the same system read without being solved: each cross-term like d1*d4 - d3*d2 has the sign of the barycentric weight one edge would need, which is why the branch conditions are products of dot products rather than divisions.',
        caption: 'Every claim checked against a brute-force search before it is made.',
        props: {
          initialCells: PY_CELLS,
        },
      },
    ],
  },

  examples: [
    {
      title: 'The 11.8% counterexample',
      prose: 'P(0.5, -1, 0) against A(0,0,0) B(1,0,0) C(0,1,0). True closest point (0.5, 0, 0) on edge AB, distance exactly 1.0. Nearest corner A, distance sqrt(1.25) = 1.118034. Both are real points on the triangle; only one is closest.',
    },
    {
      title: 'Where 40,000 answers landed',
      prose: 'Inside the face 5.5%. On an edge 49.9% (AB 11.2, AC 11.0, BC 27.7). At a corner 44.7%. BC takes the largest share because it is the hypotenuse and faces more of the sampled box. The interior is the minority case.',
    },
    {
      title: 'The degenerate triangle that returns NaN',
      prose: 'A = B = (0,0,0), C = (1,0,0). The edge-AB branch divides by |AB|^2 = 0. Unguarded it returns NaN, which does not raise, compares false against everything, and survives min() into whatever consumes it.',
    },
  ],

  challenges: [
    {
      prompt: 'Write closestPoint returning both the point and which of the seven features it landed on, checked against brute force at one probe per region.',
      hint: 'Order the cases so each may assume the earlier ones are ruled out. Clamp every edge parameter into 0..1.',
    },
    {
      prompt: 'Feed it a triangle with two identical corners and confirm it returns a finite point rather than NaN.',
      hint: 'The edge parameter divides by the squared edge length. If that is zero there is no edge, so return the corner.',
    },
    {
      prompt: 'Implement the nearest-corner shortcut, then find the point where it is worst as a fraction of the true distance. Report which region the true answer was in.',
      hint: 'Exclude points nearer than 0.05, where the ratio blows up for uninteresting reasons. The worst case will be on an edge.',
    },
    {
      prompt: 'Vectorise the clamped-barycentric version over 200,000 points and compare its answers against the exact solver. Identify which probes disagree and why.',
      hint: 'Clamping v and w is not the same as choosing the closest feature. The disagreements are at corners.',
    },
  ],

  misconceptions: [
    {
      claim: 'If the projection onto the plane falls outside the triangle, the nearest corner is the closest point.',
      reality: 'Only when the closest feature happens to be a corner. When it is the middle of an edge - about half the time on a random box - the corner answer is too large. On the standard example it overstates by 11.8%.',
    },
    {
      claim: 'Edge and corner cases are rare enough to ignore.',
      reality: 'Measured over 40,000 random probes, 94.5% of answers were not inside the face and roughly half were on an edge. The interior is the minority case.',
    },
    {
      claim: 'Clamping the barycentric coordinates into range gives the closest point.',
      reality: 'It is exact on the interior and on the three features touching the corner the coordinates are built from - edge AB, edge AC and vertex A - and wrong on edge BC and at vertices B and C. Measured over 60,000 random points that is 34% wrong on a right triangle, rising to 88% on a skewed one and 98% on a thin sliver, with a worst error of 3.00 on a triangle 3 units long. The failure is not at the corners as such; it is everything opposite the corner the coordinate system starts from.',
    },
    {
      claim: 'A wrong answer here will be obvious.',
      reality: 'Every wrong answer this produces is a real distance to a real point on the triangle. It is never absurd, just slightly too large, which is precisely why it survives review.',
    },
    {
      claim: 'You need the distance, so you need a square root.',
      reality: 'Every decision in the algorithm is a comparison, and squared lengths compare identically. The square root is needed once at the end, and not at all when the question is which triangle is nearest.',
    },
    {
      claim: 'A degenerate triangle will make the function throw, so it will be noticed.',
      reality: 'It returns NaN. NaN raises nothing, compares false against everything including itself, and passes through min() unnoticed into whatever uses the result.',
    },
  ],

  transferPrompts: [
    'Why are there exactly seven regions, and not six or eight?',
    'You are given a closest-point routine and told it is correct. What would you do to find out, without reading it?',
    'Where does a square root become necessary in this algorithm, and where would adding one be waste?',
    'Your distance field has a few NaNs in it. Name the most likely cause and the input that produces it.',
    'Why does returning the region alongside the point matter, when the caller asked for a distance?',
  ],

  debugging: [
    {
      symptom: 'Distances are slightly too large, and only for some points.',
      cause: 'The edge cases are falling through to a nearest-corner fallback.',
      fix: 'Handle all three edges explicitly. Check against brute force at a point directly out from the middle of each edge.',
    },
    {
      symptom: 'Distances are smaller than any point on the triangle.',
      cause: 'The edge parameter is not clamped, so the answer slid off the end of the edge.',
      fix: 'Clamp t into 0..1, or rely on the region tests to have ruled out the corners first.',
    },
    {
      symptom: 'NaN appears in the results, usually a handful out of hundreds of thousands.',
      cause: 'A degenerate triangle with a zero-length edge, dividing by zero in the edge branch.',
      fix: 'Guard every division. If the edge has no length, the corner is the answer. Consider dropping degenerate faces at load.',
    },
    {
      symptom: 'The distance is right but the classification is wrong.',
      cause: 'Region tests in the wrong order, so a later case catches a point an earlier one should have.',
      fix: 'Corners first, then edges, then the interior. Each test assumes the earlier ones failed.',
    },
    {
      symptom: 'It is correct but far too slow over a real mesh.',
      cause: 'A per-point Python loop, or a square root inside the comparison.',
      fix: 'Compare squared distances, vectorise, and then read lesson 7 - because even vectorised, every point against every triangle does not scale.',
    },
  ],

  mastery: {
    prerequisites:
      'Lesson 2 for the dot and cross products, lesson 4 for why a per-item Python loop is unaffordable. Barycentric coordinates are derived here from nothing. The dot product itself has a fuller treatment in Dot and Cross Products, and projection onto a plane in Lines and Planes in 3D.',
    signals: [
      'Can say why there are exactly seven regions, from the three barycentric conditions.',
      'Can name the case the nearest-corner shortcut cannot represent, and produce a counterexample.',
      'Can write the solver with correctly ordered region tests and guarded divisions.',
      'Checks a geometric routine against brute force rather than against re-reading it.',
      'Knows why no square root is needed until the end, and often not at all.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'mesh-engine-1-2-vectors-and-triangles', why: 'The dot and cross products every branch here is built from, and the degenerate-triangle guard.' },
      { lessonId: 'mesh-engine-1-4-mesh-files', why: 'Why a per-point Python loop is not affordable, and where the triangles come from.' },
      { lessonId: 'la1-003', why: 'The dot product in full, including what its sign means geometrically.' },
      { lessonId: 'la1-005', why: 'Lines and planes in 3D, and projecting a point onto a plane.' },
    ],
    futureLinks: [
      { lessonId: 'mesh-engine-1-6-point-to-mesh', why: 'One triangle correct, now every triangle in the mesh - and the classification from here is what makes a shared edge not get counted twice.' },
    ],
  },

  checkpoints: [
    'I can write any point in the triangle’s plane in barycentric form.',
    'I can say which edge each of the three conditions corresponds to.',
    'I can explain why there are seven regions and name them.',
    'I can produce a point where the nearest-corner shortcut is wrong, and say by how much.',
    'I guard every division and know what NaN does if I do not.',
    'I check against brute force rather than against my own reading.',
  ],

  assessment: {
    task: 'Implement closest-point-on-triangle returning point, distance and classification, and demonstrate its correctness independently of the implementation.',
    acceptance: [
      'All seven regions returned and correctly labelled.',
      'Agreement with a brute-force search at one probe per region.',
      'Finite output on degenerate triangles, with the guard explained.',
      'No square root inside any comparison.',
      'A counterexample to the nearest-corner shortcut, with the measured error.',
    ],
  },

  quiz: [
    {
      question: 'Why are there exactly seven regions?',
      options: [
        'Three barycentric conditions: the interior, three ways to fail one, three ways to fail two',
        'Three vertices plus three edges plus the plane',
        'It is arbitrary — some implementations use more',
        'Because a triangle has three sides and three angles, plus one interior',
      ],
      answer: 0,
      explanation: 'v >= 0, w >= 0 and v + w <= 1. Each corresponds to one edge. Fail none and you are inside; fail one and you are past that edge; fail two and you are at the corner between them.',
    },
    {
      question: 'For A(0,0,0) B(1,0,0) C(0,1,0) and P(0.5, -1, 0), what is the closest point?',
      options: [
        '(0.5, 0, 0) on edge AB, at distance exactly 1.0',
        'A, at distance sqrt(1.25)',
        'The centroid, at distance 1.05',
        'There is no closest point because P is outside',
      ],
      answer: 0,
      explanation: 'The midpoint of edge AB. The nearest corner is sqrt(1.25) = 1.118034 away, which is why the nearest-corner shortcut overstates by 11.8% here.',
    },
    {
      question: 'Over 40,000 random probes around this triangle, how often did the closest point land inside the face?',
      options: [
        '5.5% — the interior is the minority case',
        'About half the time',
        'Almost always, which is why the shortcut is acceptable',
        'It depends only on the triangle, not on where the points are',
      ],
      answer: 0,
      explanation: '94.5% landed off the face, and roughly half of all answers were on an edge. The share does depend on the sampling box, but the interior is a minority except right against the face.',
    },
    {
      question: 'Why does the algorithm avoid square roots until the end?',
      options: [
        'Every decision is a comparison, and squared lengths compare identically',
        'Square roots are inaccurate for small numbers',
        'Because barycentric coordinates cannot be square-rooted',
        'It does not — each branch needs one',
      ],
      answer: 0,
      explanation: 'Ordering by squared length is the same ordering as by length. One root at the end if a distance is wanted, and none at all when the question is which triangle is nearest.',
    },
    {
      question: 'A triangle has two identical corners. What does an unguarded solver return?',
      options: [
        'NaN, which does not throw and spreads silently through later comparisons',
        'An exception, so the bad input gets noticed',
        'The correct answer, since a degenerate triangle is still a triangle',
        'Infinity',
      ],
      answer: 0,
      explanation: 'The edge parameter divides by the squared edge length, which is zero. NaN compares false against everything including itself and survives min() into whatever consumes the result.',
    },
    {
      question: 'Clamping the barycentric coordinates into 0..1 and renormalising is exact for which features?',
      options: [
        'The interior, edge AB, edge AC and vertex A — the features touching the corner the coordinates start from',
        'Every feature — it is exact',
        'The interior and all three edges, failing only at corners',
        'Only the interior',
      ],
      answer: 0,
      explanation: 'Measured over 60,000 points it disagrees on 34% of them for a right triangle, and the largest group is edge BC. Clamping v to 0 lands on AC and w to 0 lands on AB, so those two edges and vertex A come out right for free; the v + w > 1 case slides towards A rather than dropping perpendicularly onto BC, so everything opposite A is wrong. 88% wrong on a skewed triangle, 98% on a sliver.',
    },
  ],
};
