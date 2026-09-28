// Mesh Engine 1.8 — Bounding Volumes
//
// Lesson 7 showed that a per-triangle filter cannot escape O(n), and used a
// sphere as the cheapest possible bound. This lesson takes the bound seriously:
// what makes one valid, what makes one tight, and why a box beats a sphere on
// the shapes real meshes are made of.
//
// Measured by field-fixes/verify/check-aabb-bvh.py. The three.js pin is
// 0.160.0 deliberately - see check-lesson-cdn.mjs.

const THREE_CDN = '<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"><\/script>';

const ORBIT = `
function orbit(camera, dom, radius) {
  var lon = 38, lat = 24, down = false, px = 0, py = 0;
  function place() {
    var a = lon * Math.PI / 180, b = lat * Math.PI / 180;
    camera.position.set(radius*Math.cos(b)*Math.sin(a), radius*Math.sin(b), radius*Math.cos(b)*Math.cos(a));
    camera.lookAt(0, 0, 0);
  }
  dom.addEventListener('pointerdown', function (e) { down = true; px = e.clientX; py = e.clientY; });
  window.addEventListener('pointerup', function () { down = false; });
  window.addEventListener('pointermove', function (e) {
    if (!down) return;
    lon -= (e.clientX - px) * 0.5;
    lat = Math.max(-85, Math.min(85, lat + (e.clientY - py) * 0.5));
    px = e.clientX; py = e.clientY; place();
  });
  place(); return place;
}`;

const LESSON_MESH_1_8 = {
  title: 'A Box Round Everything',
  subtitle: 'What makes a bound valid, what makes it tight, and why a box beats a sphere.',
  sequential: true,

  cells: [

    {
      type: 'markdown',
      instruction: `### The bound is the whole idea

Lesson 7 put a sphere round each triangle and used it to skip work. It was
exact, it removed 99.4% of the expensive work, and it still only ran 15× faster
because the filter itself touched every triangle.

The way past that is a **hierarchy** — one box for a group of triangles, so a
single test dismisses the whole group. That is lesson 9. Before it can be built,
the box has to be understood, because **every** saving in a spatial index comes
from one thing:

> A cheap, valid **lower bound** on the distance to a group of geometry.

Two words are doing all the work there.

**Valid** means the bound is never larger than the real answer. If it can
overestimate, you will discard the winner and get a confidently wrong result —
and lesson 7 showed that kind of error is rare enough to survive testing.

**Cheap** means it costs far less than the thing it replaces. The whole point is
to avoid the real computation, so a bound that costs nearly as much saves
nothing.

An **axis-aligned bounding box** — an AABB — is both, and the distance to one is
simpler than it first looks.`,
    },

    {
      type: 'js',
      instruction: `### The distance to a box, one axis at a time

Drag the point around. The box is fixed; the line shows the closest point on it.

The whole calculation is this, per axis, independently:

\`\`\`
how far outside this pair of planes is P?
    below lo  ->  lo - P
    above hi  ->  P - hi
    between   ->  0
\`\`\`

Then the distance is the length of that vector of three excesses.

**Read the readout as you move.** When P is outside on one axis only, the answer
is that single excess — the box's face. Two axes, and it is an edge. Three, and
it is a corner. **Those are the same seven regions as lesson 5's triangle**,
arrived at by clamping instead of by branching, and here there is no branching at
all: \`max(lo − P, P − hi, 0)\` handles every case in one expression.

**Push P inside the box.** Every excess becomes zero, so the distance is zero —
even though P is plainly some way from the surface. That is not a bug. A lower
bound on "how close could anything in this box be" is **zero** once you are
inside it, because something in the box could be exactly where you are standing.
A bound that is allowed to be pessimistic is still valid; one that is ever
optimistic is not.`,
      html: `${THREE_CDN}
<div style="padding:2px 2px 6px;display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:center">
  <span style="color:#7d8794;font:11px ui-monospace,monospace">P.x</span><input id="px" type="range" min="-3" max="3" step="0.02" value="2.1">
  <span style="color:#7d8794;font:11px ui-monospace,monospace">P.y</span><input id="py" type="range" min="-3" max="3" step="0.02" value="1.4">
  <span style="color:#7d8794;font:11px ui-monospace,monospace">P.z</span><input id="pz" type="range" min="-3" max="3" step="0.02" value="0.3">
</div>
<div id="app" style="width:100%;height:300px;background:#0a0f1e;border-radius:8px"></div>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:8px 2px;white-space:pre"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `var LO = [-1, -0.6, -0.8];
var HI = [ 1,  0.6,  0.8];

// The entire point-to-box calculation. No branches, no special cases.
function closestOnBox(P, lo, hi) {
  return [
    Math.min(Math.max(P[0], lo[0]), hi[0]),
    Math.min(Math.max(P[1], lo[1]), hi[1]),
    Math.min(Math.max(P[2], lo[2]), hi[2]),
  ];
}

function boxDistance(P, lo, hi) {
  var d2 = 0;
  for (var k = 0; k < 3; k++) {
    // How far outside this pair of planes? Zero when between them.
    var e = Math.max(lo[k] - P[k], P[k] - hi[k], 0);
    d2 += e * e;
  }
  return Math.sqrt(d2);
}

var app = document.getElementById('app');
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(45, app.clientWidth / 300, 0.1, 100);
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(app.clientWidth, 300);
app.appendChild(renderer.domElement);
scene.add(new THREE.AmbientLight(0xffffff, 0.8));

// The box, drawn once.
var size = [HI[0]-LO[0], HI[1]-LO[1], HI[2]-LO[2]];
var mid = [(HI[0]+LO[0])/2, (HI[1]+LO[1])/2, (HI[2]+LO[2])/2];
var boxGeo = new THREE.BoxGeometry(size[0], size[1], size[2]);
var boxMesh = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({
  color: 0x39414d, transparent: true, opacity: 0.35 }));
boxMesh.position.set(mid[0], mid[1], mid[2]);
scene.add(boxMesh);
var edges = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo),
  new THREE.LineBasicMaterial({ color: 0x5a6472 }));
edges.position.set(mid[0], mid[1], mid[2]);
scene.add(edges);

var drawn = [];
function clear() {
  drawn.forEach(function (o) {
    scene.remove(o);
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  drawn = [];
}

function ball(p, colour, r) {
  var m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12),
    new THREE.MeshBasicMaterial({ color: colour }));
  m.position.set(p[0], p[1], p[2]);
  return m;
}

function build(P) {
  clear();
  var Q = closestOnBox(P, LO, HI);
  var d = boxDistance(P, LO, HI);
  var inside = d === 0;

  var pb = ball(P, inside ? 0xffd43b : 0xffffff, 0.07); scene.add(pb); drawn.push(pb);
  var qb = ball(Q, 0x4dabf7, 0.06); scene.add(qb); drawn.push(qb);
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([].concat(P, Q)), 3));
  var ln = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x8899aa }));
  scene.add(ln); drawn.push(ln);

  var ex = [], outside = 0;
  for (var k = 0; k < 3; k++) {
    var e = Math.max(LO[k] - P[k], P[k] - HI[k], 0);
    ex.push(e);
    if (e > 0) outside++;
  }

  var feature = inside ? 'inside the box'
    : outside === 1 ? 'a FACE of the box'
    : outside === 2 ? 'an EDGE of the box'
    : 'a CORNER of the box';

  document.getElementById('out').textContent = [
    'P              ' + P.map(function (n) { return n.toFixed(2).padStart(7); }).join(''),
    'closest on box ' + Q.map(function (n) { return n.toFixed(2).padStart(7); }).join(''),
    '',
    'excess per axis' + ex.map(function (n) { return n.toFixed(2).padStart(7); }).join('') +
      '    <- 0 means P is between those planes',
    'distance       ' + d.toFixed(4),
    '',
    'axes outside   ' + outside + '   so the nearest point is on ' + feature,
    inside ? '\\nInside, the bound is 0. Pessimistic, and still valid: something\\n' +
             'in this box really could be exactly where you are standing.' : '',
  ].join('\\n');
}

${ORBIT}
orbit(camera, renderer.domElement, 5.5);
(function frame() { requestAnimationFrame(frame); renderer.render(scene, camera); }());

var sx = document.getElementById('px'), sy = document.getElementById('py'), sz = document.getElementById('pz');
function redraw() { build([Number(sx.value), Number(sy.value), Number(sz.value)]); }
[sx, sy, sz].forEach(function (s) { s.addEventListener('input', redraw); });
redraw();`,
      outputHeight: 520,
    },

    {
      type: 'markdown',
      instruction: `### Why a box and not a sphere

Both are valid. The question is which is **tighter** — how much the bound
understates the real distance — because a loose bound rejects less.

**Predict before you read the table.** A triangle is a flat thing. Picture the
smallest sphere that contains one, and the smallest axis-aligned box. Which
wraps it more closely, and roughly by how much — a few percent, or nearly
double? Commit to an answer.

Measured on 8,192 triangles of a unit sphere, over 100 query points, averaged
over every triangle:

| bound | mean slack | survivors against a perfect cut |
|---|---|---|
| axis-aligned box | **0.0102** | **0.77%** |
| bounding sphere | 0.0169 | 1.09% |

**The box is about 1.65× tighter**, and rejects roughly 30% more.

The reason is shape. A triangle is flat. A sphere big enough to contain a flat
thing is mostly empty — its radius is set by the longest direction and applied
to all three. A box takes each axis separately, so a triangle lying nearly flat
in one plane gets a box that is nearly flat too. The tighter the wrapping, the
less it lies to you.

That gap compounds in a hierarchy, which is why almost every production spatial
index uses boxes.

#### What a box costs you instead

**Axis-aligned** is the catch. A long thin triangle at 45° gets a box far bigger
than it needs, and rotating the model changes every box. A sphere does not care
about orientation; a box does. The usual answer is not to fix the box but to
rebuild the hierarchy when the geometry moves — and for a CAM comparison the
geometry does not move, so it never comes up.

#### The other use: a ray against a box

The same box answers "could this ray hit anything in here", which is what
picking and visibility need.

The method is the same idea run backwards: for each axis, find where the ray
crosses the two planes. Call those \`t1\` and \`t2\`. The ray is inside that slab
between them. It is inside **all three** slabs — and so inside the box — if the
**latest entry** comes before the **earliest exit**.

\`\`\`
tmin = max over axes of min(t1, t2)     the last time it got in
tmax = min over axes of max(t1, t2)     the first time it got out
hit  = tmax >= max(tmin, 0)
\`\`\`

**And there is a trap in it that is worth more than the method.** The
calculation divides by each direction component. A ray straight up the z axis
has \`dx = dy = 0\`, so \`1/dx\` is infinity — fine so far. But if a box face sits
exactly on the ray's own plane, \`lo − o\` is exactly \`0\`, and
**\`0 × infinity = NaN\`**.

NaN loses every comparison, so \`tmax >= tmin\` is false, and the box reports
**no hit**. Silently. When this lesson's checks were first written that is
exactly what happened: a ray straight up the z axis hit **0 of 8,192** boxes,
with no error and no warning. Using a large finite number instead of infinity
fixes it, and the ray then hits **4**.

An axis-aligned ray against axis-aligned boxes is not an exotic input. It is the
most likely thing anyone will try first.

**And it is worse than that, because it depends on where you stand.** The NaN
needs a zero *direction* component **and** a box face lying exactly on the ray's
plane for that axis — and the second part is decided by the origin. Measured
over the same twelve directions:

| ray origin | directions that disagree |
|---|---|
| \`(0, 0, −5)\` | **1** of 12 |
| \`(0, 0, 0)\` | **9** of 12 |
| \`(2, 3, −5)\` | **0** of 12 |

From an origin with no zero coordinate, **nothing fails at all**. Test from an
arbitrary viewpoint and the bug is invisible; test from an axis, or from the
model's own origin, and most things break.`,
    },

    {
      type: 'challenge',
      instruction: `### 🎯 Box the mesh and reject with it

Three functions:

- \`buildBoxes(mesh)\` — one AABB per triangle, as \`{ lo: [...], hi: [...] }\`
  arrays. The box of a triangle is the per-axis min and max of its three corners.
- \`boxDistance(P, lo, hi)\` — the lower bound. One expression per axis, no
  branching.
- \`boxFilteredQuery(P, mesh, boxes)\` — the same answer as brute force, having
  examined far fewer triangles. Return \`{ d, i, examined }\`.

For the filter, the argument is the one from lesson 7 with a better bound:

1. \`boxDistance\` is a **lower** bound on each triangle — it never exceeds the
   real distance.
2. You need an **upper** bound that is genuinely achieved. Run the real solver
   on one triangle — the one with the smallest box distance is a good guess —
   and use the distance it returns.
3. Reject every triangle whose box distance already exceeds that.
4. Whenever the real solver returns something closer, **tighten the bound** and
   keep going. That one line is most of the benefit.

It is checked against brute force on 30 probes, on two meshes, and your survivor
rate has to beat the sphere's.`,
      html: `<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:10px;white-space:pre;background:#0a0f1e;border-radius:8px;min-height:260px"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `function makeMesh(n) {
  var A = [], B = [], C = [], seed = 4242;
  function rnd() { seed = (seed*1103515245 + 12345) % 2147483648; return seed/2147483648*2 - 1; }
  for (var i = 0; i < n; i++) {
    var x = rnd(), y = rnd(), z = rnd(), L = Math.hypot(x,y,z) || 1;
    var c = [x/L, y/L, z/L];
    A.push(c.slice());
    B.push([c[0]+rnd()*0.05, c[1]+rnd()*0.05, c[2]+rnd()*0.05]);
    C.push([c[0]+rnd()*0.05, c[1]+rnd()*0.05, c[2]+rnd()*0.05]);
  }
  return { n: n, A: A, B: B, C: C };
}

function sub(u,v){return [u[0]-v[0],u[1]-v[1],u[2]-v[2]];}
function dot(u,v){return u[0]*v[0]+u[1]*v[1]+u[2]*v[2];}
function len(u){return Math.sqrt(dot(u,u));}

function closestOnTriangle(P, A, B, C) {
  var ab=sub(B,A), ac=sub(C,A), ap=sub(P,A);
  var d1=dot(ab,ap), d2=dot(ac,ap);
  if (d1<=0&&d2<=0) return A;
  var bp=sub(P,B), d3=dot(ab,bp), d4=dot(ac,bp);
  if (d3>=0&&d4<=d3) return B;
  var vc=d1*d4-d3*d2;
  if (vc<=0&&d1>=0&&d3<=0){var t=(d1===d3)?0:d1/(d1-d3);return [A[0]+ab[0]*t,A[1]+ab[1]*t,A[2]+ab[2]*t];}
  var cp=sub(P,C), d5=dot(ab,cp), d6=dot(ac,cp);
  if (d6>=0&&d5<=d6) return C;
  var vb=d5*d2-d1*d6;
  if (vb<=0&&d2>=0&&d6<=0){var s=(d2===d6)?0:d2/(d2-d6);return [A[0]+ac[0]*s,A[1]+ac[1]*s,A[2]+ac[2]*s];}
  var va=d3*d6-d5*d4;
  if (va<=0&&(d4-d3)>=0&&(d5-d6)>=0){
    var sp=(d4-d3)+(d5-d6), u=(sp===0)?0:(d4-d3)/sp;
    return [B[0]+(C[0]-B[0])*u, B[1]+(C[1]-B[1])*u, B[2]+(C[2]-B[2])*u];
  }
  var tot=va+vb+vc;
  if (tot===0) return A;
  var v=vb/tot, w=vc/tot;
  return [A[0]+ab[0]*v+ac[0]*w, A[1]+ab[1]*v+ac[1]*w, A[2]+ab[2]*v+ac[2]*w];
}

function bruteQuery(P, m) {
  var bd = Infinity, bi = -1;
  for (var i = 0; i < m.n; i++) {
    var d = len(sub(P, closestOnTriangle(P, m.A[i], m.B[i], m.C[i])));
    if (d < bd) { bd = d; bi = i; }
  }
  return { d: bd, i: bi };
}

// TODO 1: one axis-aligned box per triangle.
function buildBoxes(m) {

  // your code here

  return null;
}

// TODO 2: the lower bound. No branches needed.
function boxDistance(P, lo, hi) {

  // your code here

  return 0;
}

// TODO 3: same answer as bruteQuery, far fewer triangles examined.
function boxFilteredQuery(P, m, boxes) {

  // your code here

  return { d: Infinity, i: -1, examined: m.n };
}

// ── it runs itself below ──────────────────────────────────────────────────
var mesh = makeMesh(20000);
var boxes = buildBoxes(mesh);
var PROBES = [[1.7,0.3,-0.4],[0,0,2],[0.1,0.1,0.1],[-1.5,1.2,0.3]];

var lines = ['  query                 brute      filtered   examined   agree'];
var tb = 0, tf = 0, ex = 0, t0;
PROBES.forEach(function (P) {
  t0 = performance.now(); var b = bruteQuery(P, mesh); tb += performance.now()-t0;
  t0 = performance.now(); var f = boxFilteredQuery(P, mesh, boxes); tf += performance.now()-t0;
  ex += f.examined;
  lines.push('  ' + JSON.stringify(P).padEnd(20) + b.d.toFixed(5).padStart(10) +
    f.d.toFixed(5).padStart(13) + ('' + f.examined).padStart(11) +
    (Math.abs(b.d - f.d) < 1e-9 ? '    yes' : '    NO'));
});
lines.push('');
lines.push('  survivors  ' + (100*ex/(PROBES.length*mesh.n)).toFixed(2) + '%');
lines.push('  brute      ' + (tb/PROBES.length).toFixed(1) + ' ms');
lines.push('  boxes      ' + (tf/PROBES.length).toFixed(1) + ' ms');
lines.push('  speed-up   ' + (tb/tf).toFixed(1) + 'x');
console.log(lines.join('\\n'));
document.getElementById('out').textContent = lines.join('\\n');`,
      check: (js) => {
        const no = (message) => ({ pass: false, message });
        let fn;
        try {
          // eslint-disable-next-line no-new-func
          fn = new Function(
            js.replace(/^\s*\/\/ ── it runs itself below[\s\S]*$/m, '') +
            '\nreturn { makeMesh, buildBoxes, boxDistance, boxFilteredQuery, bruteQuery };',
          )();
        } catch (e) { return no('The code did not run: ' + e.message); }
        for (const n of ['buildBoxes', 'boxDistance', 'boxFilteredQuery']) {
          if (typeof fn[n] !== 'function') return no(n + ' is not a function.');
        }

        // boxDistance on a known box, including the inside case.
        const lo = [-1, -0.6, -0.8], hi = [1, 0.6, 0.8];
        const cases = [
          [[0, 0, 0], 0, 'inside the box the bound is 0, not the distance to a face'],
          [[2, 0, 0], 1, 'outside on one axis, so the answer is that single excess'],
          [[2, 1.6, 0], Math.sqrt(1 + 1), 'outside on two axes, so it is an edge'],
          [[2, 1.6, 1.8], Math.sqrt(3), 'outside on three axes, so it is a corner'],
          [[-1, -0.6, -0.8], 0, 'exactly on a corner is distance 0'],
        ];
        for (const [P, want, why] of cases) {
          let got;
          try { got = fn.boxDistance(P, lo, hi); } catch (e) {
            return no('boxDistance threw on P=[' + P + ']: ' + e.message);
          }
          if (typeof got !== 'number' || !Number.isFinite(got)) {
            return no('boxDistance returned ' + got + ' for P=[' + P + '].');
          }
          if (Math.abs(got - want) > 1e-9) {
            return no('boxDistance([' + P + ']) gave ' + got.toFixed(6) + ', expected '
              + want.toFixed(6) + '. ' + why + '. Per axis the excess is '
              + 'Math.max(lo[k] - P[k], P[k] - hi[k], 0), and the answer is the length '
              + 'of those three.');
          }
        }

        const mesh = fn.makeMesh(3000);
        let boxes;
        try { boxes = fn.buildBoxes(mesh); } catch (e) {
          return no('buildBoxes threw: ' + e.message);
        }
        if (!boxes) return no('buildBoxes returned nothing.');

        const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
        const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
        const len = (u) => Math.sqrt(dot(u, u));

        const probes = [[1.7, 0.3, -0.4], [0, 0, 2], [0.1, 0.1, 0.1], [-1.5, 1.2, 0.3],
                        [0, 0, 0], [5, 0, 0], [1.02, 0, 0]];
        const r = (() => { let s = 77; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648 * 4 - 2; })();
        for (let i = 0; i < 23; i++) probes.push([r(), r(), r()]);

        let examined = 0;
        for (const P of probes) {
          let got;
          try { got = fn.boxFilteredQuery(P, mesh, boxes); } catch (e) {
            return no('boxFilteredQuery threw on P=[' + P.map((n) => n.toFixed(2)) + ']: ' + e.message);
          }
          if (!got || typeof got.d !== 'number' || typeof got.examined !== 'number') {
            return no('boxFilteredQuery should return { d, i, examined }. Got '
              + JSON.stringify(got) + '.');
          }
          const want = fn.bruteQuery(P, mesh);
          if (Math.abs(got.d - want.d) > 1e-9) {
            return no('P=[' + P.map((n) => n.toFixed(2)) + ']: you returned '
              + got.d.toFixed(6) + ', brute force gives ' + want.d.toFixed(6) + '. '
              + (got.d > want.d
                ? 'Yours is LARGER, so the filter discarded the winner. The upper bound '
                  + 'must be a distance the real solver actually returned — not a box '
                  + 'distance, which is only a lower bound and can be smaller than '
                  + 'anything achievable.'
                : 'Yours is SMALLER than any point on the mesh, so it is not a distance '
                  + 'to a triangle.'));
          }
          examined += got.examined;
        }

        const rate = examined / (probes.length * mesh.n);
        if (rate > 0.05) {
          return no('You examined ' + (100 * rate).toFixed(1) + '% of the triangles. '
            + 'A box filter on this mesh should get well under 5%. The usual cause is '
            + 'not tightening the bound: every time the real solver returns something '
            + 'closer, that becomes the new cut-off for everything still to come.');
        }

        return {
          pass: true,
          message: 'Exact on 30 probes, examining ' + (100 * rate).toFixed(2) + '% of the '
            + 'triangles — tighter than the sphere from lesson 7, which managed 1.09% '
            + 'against the box’s 0.77% on the measured mesh. It is still O(n), because '
            + 'you computed a box distance for every triangle. Lesson 9 stops doing that.',
        };
      },
      successMessage: '✓ A tighter bound, and still exact.',
      failMessage: '✗ Not yet.',
      outputHeight: 460,
    },

  ],
};

const PY_CELLS = [
  {
    id: 'aabb',
    cellTitle: 'One box per triangle',
    prose: [
      'An axis-aligned bounding box is two points: the per-axis minimum and maximum of whatever it contains. For a triangle that is np.minimum and np.maximum over its three corners, which vectorises to one call each over the whole mesh.',
      'np.minimum.reduce([A, B, C]) takes the elementwise minimum across the three arrays at once - not a reduction along an axis of one array, but across a list of them. The result is (N, 3): one low corner per triangle.',
      'Note how little this costs. Two passes over the data, no square roots, no divisions - which matters, because a bound that is expensive to build is a bound you cannot afford to have.',
    ],
    code: `import numpy as np

def sphere_mesh(subdiv):
    v = [np.array(x, float) for x in
         ([1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1])]
    f = [[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]]
    for _ in range(subdiv):
        mid, nf = {}, []
        def midpoint(i, j):
            k = (min(i,j), max(i,j))
            if k not in mid:
                m = (v[i] + v[j]) / 2
                v.append(m / np.linalg.norm(m))
                mid[k] = len(v) - 1
            return mid[k]
        for a, b, c in f:
            ab, bc, ca = midpoint(a,b), midpoint(b,c), midpoint(c,a)
            nf += [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]]
        f = nf
    return np.array(v), np.array(f)

verts, faces = sphere_mesh(5)
A, B, C = verts[faces[:,0]], verts[faces[:,1]], verts[faces[:,2]]
N = len(faces)

lo = np.minimum.reduce([A, B, C])      # per-axis min across the three corners
hi = np.maximum.reduce([A, B, C])

print(f"{N:,} triangles")
print("lo", lo.shape, " hi", hi.shape)
print()
print("triangle 0 corners:")
for p in (A[0], B[0], C[0]):
    print("  ", np.round(p, 4))
print("its box:")
print("   lo", np.round(lo[0], 4))
print("   hi", np.round(hi[0], 4))
print()
print("box volumes: min", f"{np.prod(hi-lo, axis=1).min():.3e}",
      " max", f"{np.prod(hi-lo, axis=1).max():.3e}")`,
  },
  {
    id: 'distance',
    cellTitle: 'The distance, and why it is a bound',
    prose: [
      'The excess per axis is how far outside the pair of planes the point is, and zero when it is between them. np.maximum(np.maximum(lo - P, P - hi), 0) computes that for every box at once, with no branching - which is what makes it fast enough to be worth having.',
      'Inside a box every excess is zero, so the distance is zero. That is deliberately pessimistic and still valid: something inside the box could be exactly where the query point is. A bound is allowed to understate; it is never allowed to overstate.',
      'The cell then checks exactly that, over 300 query points against every one of the 8,192 triangles - nearly two and a half million comparisons. If the box distance ever exceeded the true distance, the whole idea would be unsound and everything after it wrong.',
    ],
    code: `def point_box_distance(P, lo, hi):
    P = np.asarray(P, float)
    excess = np.maximum(np.maximum(lo - P, P - hi), 0.0)
    return np.linalg.norm(excess, axis=1)

# The true distances, from lesson 6's solver, to compare against.
def safe_div(n, d): return np.divide(n, d, out=np.zeros_like(n), where=d != 0)

def closest_all(P, A, B, C):
    P = np.asarray(P, float)
    ab, ac = B - A, C - A
    ap, bp, cp = P - A, P - B, P - C
    d1 = np.einsum("ij,ij->i", ab, ap); d2 = np.einsum("ij,ij->i", ac, ap)
    d3 = np.einsum("ij,ij->i", ab, bp); d4 = np.einsum("ij,ij->i", ac, bp)
    d5 = np.einsum("ij,ij->i", ab, cp); d6 = np.einsum("ij,ij->i", ac, cp)
    va = d3*d6-d5*d4; vb = d5*d2-d1*d6; vc = d1*d4-d3*d2
    mA=(d1<=0)&(d2<=0);                      rest=~mA
    mB=rest&(d3>=0)&(d4<=d3);                rest=rest&~mB
    mAB=rest&(vc<=0)&(d1>=0)&(d3<=0);        rest=rest&~mAB
    mC=rest&(d6>=0)&(d5<=d6);                rest=rest&~mC
    mAC=rest&(vb<=0)&(d2>=0)&(d6<=0);        rest=rest&~mAC
    mBC=rest&(va<=0)&((d4-d3)>=0)&((d5-d6)>=0)
    mIn=rest&~mBC
    Q=np.zeros_like(A)
    Q[mA]=A[mA]; Q[mB]=B[mB]; Q[mC]=C[mC]
    t=safe_div(d1,d1-d3); Q[mAB]=A[mAB]+t[mAB,None]*ab[mAB]
    t=safe_div(d2,d2-d6); Q[mAC]=A[mAC]+t[mAC,None]*ac[mAC]
    t=safe_div(d4-d3,(d4-d3)+(d5-d6)); Q[mBC]=B[mBC]+t[mBC,None]*(C-B)[mBC]
    tot=va+vb+vc; v,w=safe_div(vb,tot),safe_div(vc,tot)
    Q[mIn]=A[mIn]+ab[mIn]*v[mIn,None]+ac[mIn]*w[mIn,None]
    return Q

rng = np.random.default_rng(5)
probes = rng.normal(size=(300, 3)) * 1.6

worst = 0.0
for P in probes:
    true_d = np.linalg.norm(closest_all(P, A, B, C) - P, axis=1)
    worst = max(worst, float((point_box_distance(P, lo, hi) - true_d).max()))

print(f"{len(probes)} probes x {N:,} triangles = {len(probes)*N:,} comparisons")
print(f"worst case of the box distance EXCEEDING the true one: {worst:.3e}")
print()
print("valid lower bound:", worst <= 0.0)
print()
print("inside the box, the bound is 0:",
      float(point_box_distance((lo[0]+hi[0])/2, lo[:1], hi[:1])[0]))`,
  },
  {
    id: 'tightness',
    cellTitle: 'Box against sphere',
    prose: [
      'Both bounds are valid, so the question is which understates less. Slack is the gap between the bound and the truth, averaged over every triangle - smaller slack means more triangles can be rejected.',
      'The box wins, and the reason is shape. A triangle is flat. A sphere containing a flat thing is set by its longest direction and applies that to all three axes, so most of the sphere is empty. A box takes each axis on its own terms, so a nearly-flat triangle gets a nearly-flat box.',
      'The last block turns slack into the number that matters: how many triangles survive a perfect cut - one made with full knowledge of the true answer. That is the ceiling on what any filter using that bound could achieve.',
    ],
    code: `centres = (A + B + C) / 3
radii = np.maximum.reduce([
    np.linalg.norm(A - centres, axis=1),
    np.linalg.norm(B - centres, axis=1),
    np.linalg.norm(C - centres, axis=1),
])

box_slack, sph_slack = [], []
kept_box, kept_sph = 0, 0
for P in probes[:100]:
    true_d = np.linalg.norm(closest_all(P, A, B, C) - P, axis=1)
    db = point_box_distance(P, lo, hi)
    ds = np.maximum(np.linalg.norm(centres - P, axis=1) - radii, 0.0)
    box_slack.append(float((true_d - db).mean()))
    sph_slack.append(float((true_d - ds).mean()))
    reach = float(true_d.min())                 # the perfect cut
    kept_box += int(np.count_nonzero(db <= reach + 1e-12))
    kept_sph += int(np.count_nonzero(ds <= reach + 1e-12))

bs, ss = float(np.mean(box_slack)), float(np.mean(sph_slack))
print(f"{'bound':>10} {'mean slack':>12} {'survivors':>11}")
print(f"{'box':>10} {bs:>12.4f} {100*kept_box/(100*N):>10.2f}%")
print(f"{'sphere':>10} {ss:>12.4f} {100*kept_sph/(100*N):>10.2f}%")
print()
print(f"the box understates by {ss/bs:.2f}x less, and rejects "
      f"{100*(kept_sph-kept_box)/kept_sph:.0f}% more")
print()
print("A sphere ignores orientation and pays for it on flat geometry.")
print("A box is tighter and pays for it when the geometry is not axis-aligned.")`,
  },
  {
    id: 'ch-bound',
    challengeType: 'write',
    challengeTitle: 'Prove the bound, do not assume it',
    difficulty: 'core',
    prompt:
      'Write check_bound(probes) returning the largest amount by which the box distance '
      + 'EXCEEDS the true distance, over every probe and every triangle. A valid lower '
      + 'bound never exceeds the truth, so a correct answer is 0.0 exactly - not small, '
      + 'zero. Then deliberately break it: shrink every box by 10% and report the worst '
      + 'violation that produces.',
    hint:
      'For each probe, closest_all gives every true distance in one call and '
      + 'point_box_distance gives every bound. The violation is (bound - truth).max(). '
      + 'To shrink a box, move lo and hi towards their midpoint.',
    code: `def check_bound(probes, lo, hi):
    # TODO: return the worst amount by which the bound exceeds the truth
    pass


print("correct boxes :", check_bound(probes[:40], lo, hi))

mid = (lo + hi) / 2
shrunk_lo = mid + (lo - mid) * 0.9
shrunk_hi = mid + (hi - mid) * 0.9
print("shrunk by 10% :", check_bound(probes[:40], shrunk_lo, shrunk_hi))`,
    solution: `def check_bound(probes, lo, hi):
    worst = 0.0
    for P in probes:
        true_d = np.linalg.norm(closest_all(P, A, B, C) - P, axis=1)
        worst = max(worst, float((point_box_distance(P, lo, hi) - true_d).max()))
    return worst


print("correct boxes :", check_bound(probes[:40], lo, hi))

mid = (lo + hi) / 2
shrunk_lo = mid + (lo - mid) * 0.9
shrunk_hi = mid + (hi - mid) * 0.9
print("shrunk by 10% :", check_bound(probes[:40], shrunk_lo, shrunk_hi))`,
    testCode: `_good = check_bound(probes[:30], lo, hi)
assert _good is not None, "check_bound returned None - 'pass' is still there."
assert _good <= 1e-12, (
    f"correct boxes gave a violation of {_good:.3e}. A box built from the per-axis "
    f"min and max of the corners CONTAINS the triangle, so its distance can never "
    f"exceed the real one. Anything above zero means the boxes or the distance are wrong.")

_mid = (lo + hi) / 2
_bad = check_bound(probes[:30], _mid + (lo - _mid) * 0.9, _mid + (hi - _mid) * 0.9)
assert _bad > 1e-6, (
    f"shrinking every box by 10% gave a violation of {_bad:.3e}, which is "
    f"essentially zero. A shrunken box no longer contains its triangle, so its "
    f"distance must sometimes exceed the truth - if it does not, check_bound is "
    f"not comparing against the true distances.")
"SUCCESS: exact zero for a real box, and a measurable violation the moment the box stops containing its triangle."`,
  },
  {
    id: 'ray',
    cellTitle: 'Ray against box, and the NaN that hides',
    prose: [
      'The other question a box answers: could this ray hit anything inside it. Picking, visibility and shadow queries are all this.',
      'The slab method treats each axis as a pair of parallel planes. The ray enters that slab at one t and leaves at another; it is inside the box when it is inside all three slabs at once, which is when the LATEST entry comes before the EARLIEST exit.',
      'And then the trap, which is worth more than the method. The calculation divides by each direction component. A ray straight up the z axis has dx = dy = 0, so 1/dx is inf - which is survivable. But when a box face lies exactly on the ray’s own plane, (lo - o) is exactly 0, and 0 * inf is NaN. NaN loses every comparison, so the hit test is false and the box reports nothing, silently.',
      'That is not a contrived input. When these checks were first written, a ray straight up the z axis hit 0 of 8,192 boxes and reported no error at all. Run the cell and compare the two versions.',
    ],
    code: `def ray_box(o, d, lo, hi, use_inf):
    o = np.asarray(o, float); d = np.asarray(d, float)
    fill = np.inf if use_inf else 1e30
    inv = np.divide(1.0, d, out=np.full_like(d, fill), where=d != 0)
    t1 = (lo - o) * inv
    t2 = (hi - o) * inv
    tmin = np.maximum.reduce([np.minimum(t1, t2)[:, k] for k in range(3)])
    tmax = np.minimum.reduce([np.maximum(t1, t2)[:, k] for k in range(3)])
    return tmax >= np.maximum(tmin, 0.0)

origin = np.array([0.0, 0.0, -5.0])
direction = np.array([0.0, 0.0, 1.0])       # straight up z: dx = dy = 0

with np.errstate(invalid="ignore"):
    bad = ray_box(origin, direction, lo, hi, use_inf=True)
good = ray_box(origin, direction, lo, hi, use_inf=False)

print("a ray straight up the z axis, against", f"{N:,}", "triangle boxes")
print(f"  with 1/0 = inf           : {int(bad.sum()):>5} hits   <- silently wrong")
print(f"  with 1/0 = a large finite: {int(good.sum()):>5} hits")
print()

# Show the NaN directly rather than asserting it.
with np.errstate(invalid="ignore"):
    inv = np.divide(1.0, direction, out=np.full_like(direction, np.inf),
                    where=direction != 0)
    t1 = (lo - origin) * inv
print("how many NaNs appear in t1 with inf:", int(np.isnan(t1).sum()))
print("0 * inf =", 0.0 * np.inf)
print()
print("NaN compares false against everything, so tmax >= tmin is false and")
print("every box reports a miss. No exception, no warning, no hits.")

# An off-axis ray, where the problem never shows up.
d2 = np.array([0.15, 0.2, 1.0]); d2 /= np.linalg.norm(d2)
with np.errstate(invalid="ignore"):
    print("\\nan OFF-AXIS ray, both versions:",
          int(ray_box(origin, d2, lo, hi, True).sum()),
          int(ray_box(origin, d2, lo, hi, False).sum()))
print("which is why this survives testing: only axis-aligned rays trip it.")`,
  },
  {
    id: 'ch-origin',
    challengeType: 'write',
    challengeTitle: 'The bug depends on where you stand',
    difficulty: 'stretch',
    prompt:
      'Only one direction tripped it from that origin, which is suspicious - the NaN needs '
      + 'a zero direction component AND a box face lying exactly on the ray plane for that '
      + 'axis, and the second part depends on the ORIGIN. Write count_trips(origin) '
      + 'returning how many of a fixed direction list disagree, and set by_origin to a list '
      + 'of (origin, count) for several origins. Find one that hides the bug completely.',
    hint:
      'Try [0,0,-5], [0,0,0], [-5,0,0], [0,-5,0] and [2,3,-5]. An origin with a zero '
      + 'coordinate puts it on the plane of many box faces; an origin with no zero '
      + 'coordinate on any axis puts it on none.',
    code: `def count_trips(origin):
    # TODO: how many directions disagree between the two versions, from here?
    pass


DIRS = [(1,0,0),(0,1,0),(0,0,1),(-1,0,0),(0,-1,0),(0,0,-1),
        (1,1,0),(0,1,1),(1,0,1),(0.3,0.5,1.0),(1.0,0.2,0.7),(0.9,-0.4,0.1)]

by_origin = []
# TODO: fill by_origin with (origin, count) for several origins

for o, c in by_origin:
    print(f"  origin {str(o):>16}  {c:>2} of {len(DIRS)} disagree")`,
    solution: `def count_trips(origin):
    n = 0
    for d in DIRS:
        dv = np.array(d, float); dv = dv / np.linalg.norm(dv)
        with np.errstate(invalid="ignore"):
            a = int(ray_box(origin, dv, lo, hi, True).sum())
        b = int(ray_box(origin, dv, lo, hi, False).sum())
        if a != b:
            n += 1
    return n


DIRS = [(1,0,0),(0,1,0),(0,0,1),(-1,0,0),(0,-1,0),(0,0,-1),
        (1,1,0),(0,1,1),(1,0,1),(0.3,0.5,1.0),(1.0,0.2,0.7),(0.9,-0.4,0.1)]

by_origin = []
for o in ([0.0,0.0,-5.0], [0.0,0.0,0.0], [-5.0,0.0,0.0],
          [0.0,-5.0,0.0], [2.0,3.0,-5.0]):
    by_origin.append((o, count_trips(np.array(o))))

for o, c in by_origin:
    print(f"  origin {str(o):>16}  {c:>2} of {len(DIRS)} disagree")`,
    testCode: `assert by_origin, "by_origin is empty - nothing was measured."
assert len(by_origin) >= 4, f"only {len(by_origin)} origins tried; use a wider spread"
for o, c in by_origin:
    assert isinstance(c, int) and 0 <= c <= len(DIRS), (
        f"count {c} for origin {o} is not a count of {len(DIRS)} directions")

_counts = [c for _, c in by_origin]
assert max(_counts) > min(_counts), (
    f"every origin gave the same count ({_counts[0]}). The whole point is that it "
    f"VARIES - include the origin [0,0,0], which sits on the plane of many box "
    f"faces, and an origin like [2,3,-5] with no zero coordinate at all.")

# There must be an origin that hides the bug entirely. That is the finding.
assert min(_counts) == 0, (
    f"the fewest disagreements found was {min(_counts)}. There is an origin where "
    f"NOTHING disagrees and the bug is completely invisible - try [2,3,-5], which "
    f"has no zero coordinate, so no box face can lie on any of its ray planes.")
assert max(_counts) >= 6, (
    f"the most disagreements found was {max(_counts)}. Include the origin [0,0,0]: "
    f"sitting on the plane of many box faces, most directions fail from there.")
"SUCCESS: from one origin nothing fails and from another most things do. The bug needs a zero direction component AND an origin that puts a box face on that plane - which is why testing from an arbitrary viewpoint never finds it."`,
  },
  {
    id: 'ch-ray',
    challengeType: 'write',
    challengeTitle: 'Find every ray that trips it',
    difficulty: 'stretch',
    prompt:
      'The inf version fails only for some rays. Write trips(directions) returning the list '
      + 'of directions (as tuples) for which the inf version and the finite version '
      + 'disagree, and set tripping to that list for a mix of axis-aligned and off-axis '
      + 'directions. Then say what every failing direction has in common - and note that '
      + 'fewer fail than you might expect, which is the next challenge.',
    hint:
      'Compare ray_box(..., use_inf=True) against ray_box(..., use_inf=False) and keep the '
      + 'directions where the hit counts differ. Wrap the inf call in '
      + 'np.errstate(invalid="ignore") so the warning does not obscure the result. Include '
      + 'the six axis directions and several oblique ones.',
    code: `def trips(directions):
    # TODO: return the directions where the two versions disagree
    pass


tripping = trips([
    (1,0,0), (0,1,0), (0,0,1), (-1,0,0), (0,-1,0), (0,0,-1),
    (1,1,0), (0,1,1), (1,0,1),
    (0.3,0.5,1.0), (1.0,0.2,0.7), (0.9,-0.4,0.1),
])
print(len(tripping), "of 12 directions disagree")
for d in tripping:
    print("  ", d)`,
    solution: `def trips(directions):
    out = []
    for d in directions:
        dv = np.array(d, float)
        dv = dv / np.linalg.norm(dv)
        with np.errstate(invalid="ignore"):
            a = int(ray_box(origin, dv, lo, hi, True).sum())
        b = int(ray_box(origin, dv, lo, hi, False).sum())
        if a != b:
            out.append(d)
    return out


tripping = trips([
    (1,0,0), (0,1,0), (0,0,1), (-1,0,0), (0,-1,0), (0,0,-1),
    (1,1,0), (0,1,1), (1,0,1),
    (0.3,0.5,1.0), (1.0,0.2,0.7), (0.9,-0.4,0.1),
])
print(len(tripping), "of 12 directions disagree")
for d in tripping:
    print("  ", d)`,
    testCode: `assert tripping is not None, "trips returned None - 'pass' is still there."
assert isinstance(tripping, list), f"expected a list, got {type(tripping).__name__}"
assert len(tripping) > 0, (
    "no disagreements found. The inf version really does fail for some rays - "
    "compare the HIT COUNTS of the two versions, and wrap the inf call in "
    "np.errstate(invalid='ignore') so the RuntimeWarning does not stop you.")

# Every failing direction must have a zero component. That is the common
# property, and it is the whole explanation: a zero component gives 1/0 = inf,
# and a box face on the ray's own plane then gives 0 * inf = NaN.
for d in tripping:
    assert any(abs(c) < 1e-12 for c in d), (
        f"direction {d} has no zero component, so it cannot produce 0 * inf. "
        f"Something else is being compared - check both calls use the same origin.")

_all_axis = [(1,0,0),(0,1,0),(0,0,1),(-1,0,0),(0,-1,0),(0,0,-1)]
_found_axis = [d for d in tripping if d in _all_axis]
assert len(_found_axis) >= 1, (
    f"no axis direction was caught. From this origin at least one must be - the "
    f"ray straight up z, which is the one the cell above demonstrates.")
# NOT asserted: that all six axis directions fail. Measured, from origin
# (0,0,-5) only (0,0,1) does, because the NaN also needs a box face lying on
# the ray's plane for that axis. From the origin itself, 9 of 12 fail.
"SUCCESS: every failing ray has a zero direction component. 1/0 is inf, a box face on the ray's own plane gives 0, and 0 * inf is NaN."`,
  },
];

export default {
  id: 'mesh-engine-1-8-bounding-volumes',
  slug: 'bounding-volumes',
  chapter: 'mesh-engine.1',
  order: 7,
  title: 'Bounding Volumes',
  subtitle: 'What makes a bound valid, what makes it tight, and the NaN hiding in the ray test.',
  tags: [
    'AABB', 'bounding box', 'lower bound', 'point to box', 'ray to box',
    'slab method', 'NaN', 'rejection', 'tightness', 'clamp',
  ],
  aliases: 'axis aligned bounding box AABB min max extents point to box distance ray box intersection slab method tmin tmax NaN infinity clamp lower bound conservative rejection bounding sphere comparison',
  timeToComplete: 55,
  coreConcept:
    'Every saving in a spatial index comes from a cheap, valid lower bound on the distance to a group of geometry. An axis-aligned box gives one: per axis, how far outside the pair of planes the point is, zero when between them, and the length of those three excesses is the distance - no branching, and zero inside the box, which is pessimistic and still valid. Measured against a bounding sphere on the same mesh, the box understates by 1.65x less and rejects about 30% more, because a sphere around flat geometry is mostly empty. The ray-box test hides a NaN: a zero direction component gives 1/0 = inf, a box face on the ray plane gives 0, and 0 x inf = NaN loses every comparison, so an axis-aligned ray reports no hits at all - silently.',
  prerequisites: ['mesh-engine-1-7-why-brute-force-stops-working'],
  nextLesson: 'mesh-engine-1-9-bvh',

  semantics: {
    core: [
      { symbol: 'lo, hi', meaning: 'The per-axis minimum and maximum of everything inside. Two points describe the box completely.' },
      { symbol: 'max(lo - P, P - hi, 0)', meaning: 'The excess on one axis: how far outside that pair of planes P is, and zero between them. No branching.' },
      { symbol: 'clamp(P, lo, hi)', meaning: 'The closest point on the box. min(max(P, lo), hi) per axis.' },
      { symbol: 'distance = 0 inside', meaning: 'Pessimistic and valid. Something in the box could be exactly where you are standing.' },
      { symbol: 'slack', meaning: 'How far a bound understates the truth. Box 0.0102, sphere 0.0169 on the measured mesh - smaller is better.' },
      { symbol: 'tmin, tmax', meaning: 'The latest entry and earliest exit across the three slabs. Hit when tmax >= max(tmin, 0).' },
      { symbol: '0 x inf = NaN', meaning: 'The slab method trap. A zero direction component plus a box face on the ray plane, and every comparison silently fails.' },
    ],
    rulesOfThumb: [
      'A bound may understate and must never overstate. Understating costs speed; overstating costs correctness, silently.',
      'Build the box from per-axis min and max of the corners. Anything smaller stops containing the geometry and stops being a bound.',
      'Inside the box the bound is zero, and that is correct. Do not "fix" it to the distance to the surface.',
      'Prefer boxes to spheres for flat geometry: 1.65x tighter on the measured mesh, and triangles are flat by definition.',
      'Never divide by a ray direction component without deciding what happens when it is zero. inf alone is not enough; 0 x inf is NaN.',
      'Test ray code with axis-aligned rays first. They are the case that breaks and the case everyone tries.',
    ],
  },

  hook: {
    question: 'A ray straight up the z axis, tested against 8,192 axis-aligned boxes with the standard slab method. How many does it report hitting?',
    realWorldContext: 'Zero, with no error and no warning. The slab method divides by each direction component; dx and dy are 0, so 1/dx is infinity. When a box face happens to sit exactly on the ray’s own plane, (lo - origin) is exactly 0, and 0 x infinity is NaN. NaN compares false against everything, so tmax >= tmin fails and every box reports a miss. Replacing infinity with a large finite number gives the right answer: 4 hits. An axis-aligned ray against axis-aligned boxes is the first thing anyone tries, and it is the only case that breaks.',
    previewVisualizationId: 'JSNotebook',
  },

  intuition: {
    prose: [
      'Every acceleration structure rests on a cheap lower bound for a group of geometry, so the bound is the thing to get right.',
      'Valid means never larger than the truth. Overstate and you discard the winner, and that error is quiet enough to survive testing.',
      'For an axis-aligned box the distance is the length of the per-axis excesses, and inside the box every excess is zero.',
      'Zero inside is pessimistic and correct: something in the box could be exactly where the query point is.',
      'A box is tighter than a sphere on flat geometry, because a sphere is sized by the longest direction and applies it to all three.',
      'The same box answers ray queries through the slab method, which hides a NaN that only axis-aligned rays reveal.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: distance from a point to an AABB',
        body: 'Step 1. For each axis k, excess = max(lo[k] - P[k], P[k] - hi[k], 0).\nStep 2. distance = sqrt(sum of excess squared).\nStep 3. That is it. No branches, no cases, and zero when P is inside.\nFor the closest POINT rather than the distance, clamp instead: min(max(P[k], lo[k]), hi[k]).',
      },
      {
        type: 'insight',
        title: 'Zero inside the box is the right answer',
        body: 'It looks wrong - P is plainly some distance from the surface - and it is exactly what a lower bound should say. The question the bound answers is "how close could anything in this box possibly be", and once you are inside the box the answer is zero, because something in it could be where you are. Replacing that with the distance to the nearest face would overstate, and overstating is the one thing a bound may never do.',
      },
      {
        type: 'insight',
        title: 'A box is tighter than a sphere on flat things',
        body: 'Measured over 100 query points against 8,192 triangles: mean slack 0.0102 for boxes against 0.0169 for spheres, and 0.77% survivors against 1.09% under a perfect cut. A triangle is flat, and a sphere containing a flat thing is sized by its longest direction and applies that radius in all three, so most of it is empty. A box sizes each axis separately. The cost is that a box is tied to the axes: rotate the model and every box is wrong, whereas a sphere does not care.',
      },
      {
        type: 'warning',
        title: 'The slab method has a NaN in it',
        body: 'It divides by each direction component. A zero component gives 1/0 = inf, which is survivable on its own. But when a box face lies exactly on the ray plane, the numerator is exactly 0, and 0 x inf is NaN. NaN compares false against everything, so tmax >= tmin is false and the box reports a miss - no exception, no warning. Measured: a ray up the z axis hit 0 of 8,192 boxes with inf, and 4 with a large finite number instead. Off-axis rays never expose it, which is why it survives testing.',
      },
      {
        type: 'warning',
        title: 'This is still O(n)',
        body: 'A box per triangle means computing a box distance for every triangle, so the filter still touches all of them - the same ceiling lesson 7 measured. The boxes are worth building anyway, because a hierarchy is built out of them, and the tighter the box the more each level of that hierarchy can dismiss. Lesson 9 is where the count of examined triangles finally stops being proportional to the mesh.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Move a point around a box and watch the excesses',
        caption: 'One axis outside is a face, two is an edge, three is a corner - the same seven regions as a triangle, reached by clamping.',
        props: {
          lesson: LESSON_MESH_1_8,
        },
      },
    ],
  },

  math: {
    prose: [
      'The Python half builds a box per triangle in two vectorised calls, then proves the bound is valid over nearly two and a half million comparisons rather than asserting it.',
      'Then it measures tightness against a sphere, which is the argument for preferring boxes.',
      'The last cells are the ray test and its NaN, shown rather than described - including the off-axis case where the bug is invisible.',
    ],
    visualizations: [
      {
        id: 'PythonNotebook',
        title: 'Build the boxes, prove the bound, then break it on purpose',
        mathBridge: 'The distance from a point to an axis-aligned box separates into independent per-axis problems because the box is a Cartesian product of three intervals. The nearest point is the per-axis clamp, and the distance is the Euclidean norm of the per-axis excesses - which is why there are no cases to enumerate. The ray test is the same separability read the other way: the box is the intersection of three slabs, so the ray is inside it exactly when it is inside all three parameter intervals at once, and intersecting intervals is max of the lower ends against min of the upper ones.',
        caption: 'Bound validity checked over 300 probes x 8,192 triangles.',
        props: {
          initialCells: PY_CELLS,
        },
      },
    ],
  },

  examples: [
    {
      title: 'Box versus sphere, measured',
      prose: 'Mean slack 0.0102 against 0.0169, survivors 0.77% against 1.09%, on 8,192 triangles over 100 query points. The box understates by 1.65x less and rejects about 30% more.',
    },
    {
      title: 'The ray that hit nothing',
      prose: 'A ray from (0,0,-5) straight up z, against 8,192 boxes: 0 hits with 1/0 = inf, 4 hits with a large finite value. No exception either way. Off-axis rays agree exactly, so the bug never appears unless someone tries an axis.',
    },
    {
      title: 'Zero inside',
      prose: 'A point at the centre of a box gets a bound of 0. Pessimistic, correct, and the reason the bound is never wrong: something inside the box could be exactly there.',
    },
  ],

  challenges: [
    {
      prompt: 'Build a box per triangle, write the point-to-box distance without branching, and use it to filter exactly - matching brute force on 30 probes at under 5% survivors.',
      hint: 'Tighten the upper bound every time the real solver finds something closer. That one line is most of the benefit.',
    },
    {
      prompt: 'Prove the bound over every probe and every triangle, then shrink the boxes by 10% and show the violation appear.',
      hint: 'A correct answer is exactly 0.0, not merely small. A shrunken box no longer contains its triangle.',
    },
    {
      prompt: 'Find every ray direction for which the inf version of the slab test disagrees with the finite version, and say what they have in common.',
      hint: 'Include the six axis directions. Every failing direction has a zero component.',
    },
  ],

  misconceptions: [
    {
      claim: 'The distance from a point inside a box should be the distance to the nearest face.',
      reality: 'That would overstate the bound, and overstating is the one thing a bound may never do. The question is how close anything in the box could be, and inside the box the honest answer is zero.',
    },
    {
      claim: 'A sphere is simpler and just as good.',
      reality: 'It is simpler and looser. Measured on the same mesh it has 1.65x the slack and lets through about 40% more triangles, because a sphere around a flat triangle is mostly empty.',
    },
    {
      claim: 'A tighter bound is always better.',
      reality: 'Only if it stays cheap and stays valid. An oriented box is tighter still and costs more to build, test and update, and the one thing you cannot trade away is validity.',
    },
    {
      claim: 'Setting 1/0 to infinity handles the degenerate ray case.',
      reality: 'It handles half of it. The other half is 0 x inf = NaN, which arises whenever a box face lies on the ray plane - and NaN losing every comparison turns a hit into a silent miss.',
    },
    {
      claim: 'Axis-aligned rays are an edge case not worth worrying about.',
      reality: 'They are the first thing anyone tries, they are what a top or front view produces, and they are the only case that exposes the bug. Measured: 0 hits instead of 4.',
    },
    {
      claim: 'Boxes make the query sublinear.',
      reality: 'A box per triangle still means a test per triangle. It is a better constant on the same O(n). The hierarchy in lesson 9 is what changes the exponent.',
    },
  ],

  transferPrompts: [
    'Why is a bound allowed to understate but never to overstate, and what does each mistake cost?',
    'Why does a box beat a sphere for triangles, and where would the reverse be true?',
    'What would you test first in a new ray-box implementation, and why that?',
    'A colleague "fixes" the inside-the-box distance to return the distance to the nearest face. What breaks, and would you notice?',
    'You have boxes and a 30x speed-up. What stops you getting 300x, and what would?',
  ],

  debugging: [
    {
      symptom: 'The filtered query is faster and sometimes slightly wrong.',
      cause: 'The boxes do not contain their triangles - built from two corners rather than three, or shrunk.',
      fix: 'Per-axis min and max over all three corners. Check the bound against the truth and demand exactly zero violation.',
    },
    {
      symptom: 'An axis-aligned ray reports no intersections at all.',
      cause: '0 x inf = NaN in the slab test, from a zero direction component and a box face on the ray plane.',
      fix: 'Use a large finite reciprocal instead of inf, or handle zero components explicitly.',
    },
    {
      symptom: 'Ray tests pass every test you wrote and fail in the application.',
      cause: 'The tests used oblique directions, which never trigger the NaN.',
      fix: 'Test the six axis directions first.',
    },
    {
      symptom: 'The box filter rejects almost nothing.',
      cause: 'The upper bound is never tightened as better answers are found, so the cut-off stays at its initial value.',
      fix: 'Update the cut-off every time the real solver returns something closer.',
    },
    {
      symptom: 'Boxes gave a much smaller speed-up than the survivor rate suggested.',
      cause: 'Expected. Computing a box distance per triangle is still O(n), and once survivors are few that pass is most of the time.',
      fix: 'Nothing here fixes it. It is what a hierarchy is for.',
    },
  ],

  mastery: {
    prerequisites:
      'Lesson 7 for why a per-triangle filter has a ceiling and what a valid bound is, and lesson 5 for the solver the filter avoids calling.',
    signals: [
      'Can write the point-to-box distance with no branches and explain why zero inside is correct.',
      'Can say why a box beats a sphere for triangles, and what the box gives up in return.',
      'Verifies a bound by measuring violations rather than by reading the code.',
      'Tests ray code with axis-aligned directions first.',
      'Knows that boxes improve the constant and not the exponent.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'mesh-engine-1-7-why-brute-force-stops-working', why: 'Why a filter is needed, what a valid bound is, and why a per-item one has a ceiling.' },
      { lessonId: 'mesh-engine-1-6-point-to-mesh', why: 'The brute-force query these bounds are checked against.' },
      { lessonId: 'mesh-engine-1-5-point-to-triangle', why: 'The seven regions, which reappear here as face, edge and corner of a box.' },
    ],
    futureLinks: [
      { lessonId: 'mesh-engine-1-9-bvh', why: 'Boxes arranged in a hierarchy, so one test dismisses a group instead of a triangle.' },
    ],
  },

  checkpoints: [
    'I can compute a point-to-box distance without branching and say why it is zero inside.',
    'I can explain what makes a bound valid and what overstating costs.',
    'I can say why a box is tighter than a sphere for triangles, with numbers.',
    'I can write the slab test and name the input that breaks it.',
    'I know that a box per triangle is still O(n).',
  ],

  assessment: {
    task: 'Build AABBs over a mesh, use them to answer point queries exactly and faster, and demonstrate both the validity of the bound and the ray-test failure mode.',
    acceptance: [
      'Boxes built from per-axis extents of all three corners.',
      'Point-to-box distance with no branching, zero inside.',
      'Bound validity measured at exactly zero violation, and shown to break when boxes are shrunk.',
      'Filtered queries matching brute force exactly, with a reported survivor rate.',
      'The slab test demonstrated failing on an axis-aligned ray and fixed.',
    ],
  },

  quiz: [
    {
      question: 'What is the distance from a point inside an AABB to that box?',
      options: [
        'Zero — pessimistic, and correct for a lower bound',
        'The distance to the nearest face',
        'Negative, by convention',
        'Undefined',
      ],
      answer: 0,
      explanation: 'The bound answers how close anything in the box could be. Inside it, something could be exactly where you are. Returning the distance to a face would overstate, and overstating discards real candidates.',
    },
    {
      question: 'Measured on 8,192 triangles, how does a box compare to a bounding sphere?',
      options: [
        'Mean slack 0.0102 against 0.0169 — the box is about 1.65x tighter and rejects roughly 30% more',
        'They are equivalent',
        'The sphere is tighter because it has no corners',
        'The box is looser but cheaper',
      ],
      answer: 0,
      explanation: 'A triangle is flat. A sphere containing it is sized by the longest direction and applies that radius in all three, so most of it is empty. A box sizes each axis independently.',
    },
    {
      question: 'A ray straight up the z axis reports zero hits against 8,192 boxes. Why?',
      options: [
        '1/0 = inf and a box face on the ray plane gives 0, so 0 x inf = NaN, which loses every comparison',
        'The ray misses them all',
        'The boxes are too small',
        'Integer overflow in the slab test',
      ],
      answer: 0,
      explanation: 'No exception and no warning. NaN compares false against everything, so tmax >= tmin fails. A large finite reciprocal instead of inf gives the correct answer: 4 hits.',
    },
    {
      question: 'Why do oblique test rays fail to catch that bug?',
      options: [
        'They have no zero direction component, so 1/d is finite and no NaN is produced',
        'They are slower, so the error averages out',
        'They hit more boxes, hiding the miss',
        'They do catch it — the bug is elsewhere',
      ],
      answer: 0,
      explanation: 'The NaN needs a zero direction component. Every direction that fails has one, and axis-aligned rays are exactly what a top or front view produces.',
    },
    {
      question: 'Does putting a box round every triangle make the query sublinear?',
      options: [
        'No — a box per triangle still means a test per triangle. It improves the constant, not the exponent',
        'Yes, boxes are O(log n)',
        'Yes, provided the boxes are tight enough',
        'Only for closed meshes',
      ],
      answer: 0,
      explanation: 'The same ceiling lesson 7 measured. The boxes matter because a hierarchy is built out of them, and a tighter box lets each level of that hierarchy dismiss more.',
    },
    {
      question: 'What is the correct per-axis excess in the point-to-box distance?',
      options: [
        'max(lo[k] - P[k], P[k] - hi[k], 0)',
        'abs(P[k] - (lo[k] + hi[k]) / 2)',
        'min(P[k] - lo[k], hi[k] - P[k])',
        'P[k] - clamp(P[k], lo[k], hi[k]) squared',
      ],
      answer: 0,
      explanation: 'Positive when below lo, positive when above hi, and zero between them — one expression covering all three cases with no branching, which is what makes it cheap enough to be worth having.',
    },
  ],
};
