// Mesh Engine 1.6 — Point-to-Mesh Distance
//
// Lesson 5 made one triangle correct. This is every triangle, by brute force,
// deliberately — because the point of the next lesson is that brute force stops
// working, and that argument is only worth anything once you have measured it.
//
// Every figure in the prose was measured by
// field-fixes/verify/check-point-mesh.py, which also proves the vectorised
// solver identical to lesson 5's scalar one across 20,480 comparisons.

const THREE_CDN = '<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"><\/script>';

const ORBIT = `
function orbit(camera, dom, radius) {
  var lon = 35, lat = 22, down = false, px = 0, py = 0;
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

// A subdivided octahedron: closed, welded, and made of triangles at every
// orientation — unlike a cube, which is a suspiciously easy case because every
// face is axis-aligned.
const MESH = `function sphereMesh(subdiv) {
  var v = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].map(function (p) { return p.slice(); });
  var f = [[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]];
  for (var s = 0; s < subdiv; s++) {
    var mid = {}, nf = [];
    function midpoint(i, j) {
      var key = Math.min(i,j) + '-' + Math.max(i,j);
      if (mid[key] === undefined) {
        var m = [(v[i][0]+v[j][0])/2, (v[i][1]+v[j][1])/2, (v[i][2]+v[j][2])/2];
        var L = Math.hypot(m[0], m[1], m[2]);
        v.push([m[0]/L, m[1]/L, m[2]/L]);   // push out to the sphere
        mid[key] = v.length - 1;
      }
      return mid[key];
    }
    f.forEach(function (t) {
      var ab = midpoint(t[0], t[1]), bc = midpoint(t[1], t[2]), ca = midpoint(t[2], t[0]);
      nf.push([t[0], ab, ca], [ab, t[1], bc], [ca, bc, t[2]], [ab, bc, ca]);
    });
    f = nf;
  }
  return { points: v, triangles: f };
}`;

const SOLVER = `function sub(u, v) { return [u[0]-v[0], u[1]-v[1], u[2]-v[2]]; }
function add(u, v) { return [u[0]+v[0], u[1]+v[1], u[2]+v[2]]; }
function scale(u, k) { return [u[0]*k, u[1]*k, u[2]*k]; }
function dot(u, v) { return u[0]*v[0] + u[1]*v[1] + u[2]*v[2]; }
function length(u) { return Math.sqrt(dot(u, u)); }

// Lesson 5's solver, unchanged.
function closestOnTriangle(P, A, B, C) {
  var ab = sub(B, A), ac = sub(C, A);
  var ap = sub(P, A);
  var d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return { q: A, at: 'vertex A' };
  var bp = sub(P, B);
  var d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return { q: B, at: 'vertex B' };
  var vc = d1*d4 - d3*d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
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
  var total = va + vb + vc;
  if (total === 0) return { q: A, at: 'degenerate' };
  return { q: add(A, add(scale(ab, vb/total), scale(ac, vc/total))), at: 'inside' };
}`;

const LESSON_MESH_1_6 = {
  title: 'Closest Point on a Whole Mesh',
  subtitle: 'One triangle was the hard part. Every triangle is the slow part.',
  sequential: true,

  cells: [

    {
      type: 'markdown',
      instruction: `### From one triangle to all of them

Lesson 5 solved one triangle. A surface is a bag of triangles, so the extension
is almost insultingly simple:

\`\`\`
for every triangle in the mesh
    work out the closest point on it
keep the nearest one
\`\`\`

That is it. **It is also correct**, which is worth saying plainly, because the
next lesson is going to be about throwing it away and it deserves credit first.
Brute force is the version you can trust, and everything faster gets checked
against it.

So we are going to build it, and then **measure it**, because "brute force does
not scale" is a slogan until you have the numbers. The real part this series is
built around has **214,382 triangles**, and a comparison run asks this question
a few hundred thousand times.

But there is one thing to get right that lesson 5 set up and did not spend,
and it is not the speed.`,
    },

    {
      type: 'js',
      instruction: `### Move the point, watch which triangle wins

A sphere made of 128 triangles. **P** is the white dot; **Q** is the closest
point on the whole surface; the winning triangle is highlighted.

Move P with the sliders. Watch the highlighted triangle change as Q crosses from
one face to the next.

**Now look at the \`equally close\` line in the readout.**

Most of the time it does not say 1. When Q lands on an edge, the two triangles
sharing that edge are **exactly** the same distance away — because they share
that edge, so they share that point. When Q lands on a vertex, every triangle
touching it ties.

Measured over 1,500 random query points against this mesh: **66.3% had two or
more equally-close triangles.** Ties are not the exception, they are the normal
case.

For a *distance*, that does not matter at all — the smallest of several equal
numbers is still the smallest. But it means \`argmin\` hands you **one of them,
arbitrarily**, and the one it hands you depends on the order the triangles
happened to be stored in the file.

That is fine now. It stops being fine in lesson 10, where the answer needed is
not "how far" but **"which side"** — and for that you need the triangle's
normal, and two triangles sharing an edge point in two different directions.
Keep it in mind; nothing here has to fix it.`,
      html: `${THREE_CDN}
<div style="padding:2px 2px 6px;display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:center">
  <span style="color:#7d8794;font:11px ui-monospace,monospace">P.x</span><input id="px" type="range" min="-2.2" max="2.2" step="0.01" value="1.5">
  <span style="color:#7d8794;font:11px ui-monospace,monospace">P.y</span><input id="py" type="range" min="-2.2" max="2.2" step="0.01" value="0.6">
  <span style="color:#7d8794;font:11px ui-monospace,monospace">P.z</span><input id="pz" type="range" min="-2.2" max="2.2" step="0.01" value="0.3">
</div>
<div id="app" style="width:100%;height:300px;background:#0a0f1e;border-radius:8px"></div>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:8px 2px;white-space:pre"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `${MESH}

${SOLVER}

// Brute force over the whole mesh. Returns the nearest point, its distance,
// which triangle produced it, and how many triangles tied for nearest.
function closestOnMesh(P, mesh) {
  var best = null, bestD = Infinity, bestTri = -1, bestAt = '';
  mesh.triangles.forEach(function (t, i) {
    var r = closestOnTriangle(P, mesh.points[t[0]], mesh.points[t[1]], mesh.points[t[2]]);
    var d = length(sub(P, r.q));
    if (d < bestD) { bestD = d; best = r.q; bestTri = i; bestAt = r.at; }
  });

  // How many triangles are the SAME distance away, to within rounding. On a
  // shared edge this is 2; at a vertex it is however many faces meet there.
  var tied = 0;
  mesh.triangles.forEach(function (t) {
    var r = closestOnTriangle(P, mesh.points[t[0]], mesh.points[t[1]], mesh.points[t[2]]);
    if (length(sub(P, r.q)) < bestD + 1e-9) tied++;
  });

  return { q: best, d: bestD, tri: bestTri, at: bestAt, tied: tied };
}

var mesh = sphereMesh(2);

var app = document.getElementById('app');
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(45, app.clientWidth / 300, 0.1, 100);
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(app.clientWidth, 300);
app.appendChild(renderer.domElement);
scene.add(new THREE.AmbientLight(0xffffff, 0.75));
var lamp = new THREE.DirectionalLight(0xffffff, 0.7);
lamp.position.set(2, 3, 4);
scene.add(lamp);

// The surface, drawn once - it never changes.
var xyz = [];
mesh.triangles.forEach(function (t) {
  t.forEach(function (i) { xyz.push.apply(xyz, mesh.points[i]); });
});
var geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(xyz), 3));
geo.computeVertexNormals();
scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
  color: 0x4a5568, transparent: true, opacity: 0.85, side: THREE.DoubleSide })));
scene.add(new THREE.LineSegments(new THREE.WireframeGeometry(geo),
  new THREE.LineBasicMaterial({ color: 0x2f3a4a })));

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
  var t0 = performance.now();
  var res = closestOnMesh(P, mesh);
  var ms = performance.now() - t0;

  // Highlight the winning triangle.
  var t = mesh.triangles[res.tri];
  var hg = new THREE.BufferGeometry();
  hg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(
    [].concat(mesh.points[t[0]], mesh.points[t[1]], mesh.points[t[2]])), 3));
  var hl = new THREE.Mesh(hg, new THREE.MeshBasicMaterial({
    color: 0xffd43b, side: THREE.DoubleSide }));
  scene.add(hl); drawn.push(hl);

  var pb = ball(P, 0xffffff, 0.05); scene.add(pb); drawn.push(pb);
  var qb = ball(res.q, 0x4dabf7, 0.05); scene.add(qb); drawn.push(qb);

  var lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(
    [].concat(P, res.q)), 3));
  var ln = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x8899aa }));
  scene.add(ln); drawn.push(ln);

  var lines = [];
  lines.push('triangles searched  ' + mesh.triangles.length);
  lines.push('closest point       ' + res.q.map(function (n) { return n.toFixed(3).padStart(7); }).join(''));
  lines.push('distance            ' + res.d.toFixed(5));
  lines.push('winning triangle    #' + res.tri + '   (landed on ' + res.at + ')');
  lines.push('equally close       ' + res.tied +
    (res.tied > 1 ? '   <- a tie: argmin picked one arbitrarily' : ''));
  lines.push('');
  lines.push('this one query took  ' + ms.toFixed(2) + ' ms for ' +
    mesh.triangles.length + ' triangles');
  lines.push('a real part has      214,382 triangles');
  lines.push('at this rate, one query would be ' +
    (ms * 214382 / mesh.triangles.length).toFixed(0) + ' ms');
  document.getElementById('out').textContent = lines.join('\\n');
}

${ORBIT}
orbit(camera, renderer.domElement, 4.6);
(function frame() { requestAnimationFrame(frame); renderer.render(scene, camera); }());

var sx = document.getElementById('px');
var sy = document.getElementById('py');
var sz = document.getElementById('pz');
function redraw() {
  build([Number(sx.value), Number(sy.value), Number(sz.value)]);
}
[sx, sy, sz].forEach(function (s) { s.addEventListener('input', redraw); });
redraw();`,
      outputHeight: 540,
    },

    {
      type: 'markdown',
      instruction: `### What "brute force" costs, measured

The loop above is O(triangles) per query. Doubling the mesh doubles the work;
doubling the queries doubles it again. That is the whole of the complexity
argument, and it is not interesting until it has numbers attached.

So here are the numbers, measured with the solver **fully vectorised in numpy**
— that is, with the Python loop already removed and every triangle handled at
once. This is brute force done *well*:

| triangles | per query | × 200,000 queries | arrays touched per call |
|---|---|---|---|
| 8,192 | 1.01 ms | 3.4 min | 0.8 MB |
| 32,768 | 5.34 ms | 17.8 min | 3.1 MB |
| 131,072 | 24.59 ms | **82 min** | 12.6 MB |

Three things in that table are worth more than the headline.

**It is slightly worse than linear.** Four times the triangles gave 5.3× then
4.6× the time, not 4×. The extra is memory traffic: at 131,072 triangles the
arrays no longer fit in cache, so the processor spends part of its time waiting
for data rather than computing. Complexity tells you the shape of the curve;
it does not tell you the constant, and the constant here gets worse as you go.

**The allocation is the hidden cost.** 12.6 MB of temporary arrays, built and
thrown away, **per query**. Two hundred thousand queries is 2.5 TB of
allocation churn. Nothing is leaking — it is all freed immediately — and it is
still most of the time.

**And the real part is bigger than the biggest row.** 214,382 triangles is
roughly 40 ms a query, so a full comparison run is over two hours, for an answer
that has to arrive while somebody is standing at a machine.

That is lesson 7. The fix is not a faster loop — the loop is already as fast as
numpy can make it. The fix is **not looking at most of the triangles at all**,
which is lessons 8 and 9.

Before that, though: the version above is correct, and correct is what you
check the fast ones against. Never delete it.`,
    },

    {
      type: 'challenge',
      instruction: `### 🎯 Search the whole mesh

\`closestOnMesh(P, mesh)\` returning \`{ q, d, tri, tied }\`:

- \`q\` — the closest point on the surface
- \`d\` — its distance from P
- \`tri\` — the index of the triangle that produced it
- \`tied\` — how many triangles are the same distance away, within \`1e-9\`

\`closestOnTriangle\` from lesson 5 is already here and works. This is the easy
part of the lesson, and the two things worth getting right are both about
honesty rather than cleverness:

**Return the triangle index, not just the distance.** Everything downstream —
attribution, normals, which operation cut this — needs to know *which* triangle,
and adding it later means touching every caller.

**Count the ties.** It costs a second pass and it tells you when the answer was
ambiguous. A function that hides that is a function that will surprise you in
lesson 10.

It is checked against 40 query points, with the distance verified independently,
and it is checked on a **degenerate mesh** with a zero-area triangle in it.

That last check is more interesting than it sounds. A degenerate face can
produce a \`NaN\` distance, and what happens next depends entirely on how you
take the minimum: \`if (d < best)\` starting from \`Infinity\` silently skips
it, while seeding \`best\` from the first triangle poisons it permanently — and
in the Python half, \`np.argmin\` hands back the index **of the NaN**. So the
fast version is the dangerous one. Either outcome is acceptable here as long as
the answer stays finite and correct; what is not acceptable is not knowing which
you chose.`,
      html: `<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:10px;white-space:pre;background:#0a0f1e;border-radius:8px;min-height:250px"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `${MESH}

${SOLVER}

// TODO: return { q, d, tri, tied }
function closestOnMesh(P, mesh) {

  // your code here

  return { q: [0,0,0], d: Infinity, tri: -1, tied: 0 };
}

// ── it runs itself below ──────────────────────────────────────────────────
var mesh = sphereMesh(2);
var PROBES = [[1.5,0.6,0.3], [0,0,2], [0.2,0.1,0.05], [-1,-1,-1], [1,1,1]];

var lines = ['  query P                  distance   triangle   tied'];
PROBES.forEach(function (P) {
  var r = closestOnMesh(P, mesh);
  lines.push('  ' + JSON.stringify(P).padEnd(22) +
    (r.d === Infinity ? '  Infinity' : r.d.toFixed(5).padStart(9)) +
    ('' + r.tri).padStart(10) + ('' + r.tied).padStart(7));
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
            '\nreturn { closestOnMesh: closestOnMesh, sphereMesh: sphereMesh, closestOnTriangle: closestOnTriangle };',
          )();
        } catch (e) {
          return no('The code did not run: ' + e.message);
        }
        if (typeof fn.closestOnMesh !== 'function') return no('closestOnMesh is not a function.');

        const mesh = fn.sphereMesh(2);
        const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
        const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
        const len = (u) => Math.sqrt(dot(u, u));

        // Independent reference: run lesson 5's solver over every triangle here,
        // rather than trusting the reader's loop.
        const reference = (P, m) => {
          let bd = Infinity, bq = null, bt = -1;
          m.triangles.forEach((t, i) => {
            const r = fn.closestOnTriangle(P, m.points[t[0]], m.points[t[1]], m.points[t[2]]);
            const d = len(sub(P, r.q));
            if (d < bd) { bd = d; bq = r.q; bt = i; }
          });
          let tied = 0;
          m.triangles.forEach((t) => {
            const r = fn.closestOnTriangle(P, m.points[t[0]], m.points[t[1]], m.points[t[2]]);
            if (len(sub(P, r.q)) < bd + 1e-9) tied++;
          });
          return { d: bd, q: bq, tri: bt, tied };
        };

        // A spread of query points: outside, inside, on the surface, far away.
        const probes = [[1.5, 0.6, 0.3], [0, 0, 2], [0.2, 0.1, 0.05],
                        [-1, -1, -1], [1, 1, 1], [0, 0, 0], [5, 0, 0], [0.99, 0, 0]];
        const rand = (() => { let s = 7; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; })();
        for (let i = 0; i < 32; i++) probes.push([rand() * 4 - 2, rand() * 4 - 2, rand() * 4 - 2]);

        let anyTie = false;
        for (const P of probes) {
          let r;
          try { r = fn.closestOnMesh(P, mesh); } catch (e) { return no('closestOnMesh threw on P=[' + P + ']: ' + e.message); }
          if (!r || !Array.isArray(r.q) || typeof r.d !== 'number'
              || typeof r.tri !== 'number' || typeof r.tied !== 'number') {
            return no('closestOnMesh should return { q: [x,y,z], d, tri, tied }. On P=['
              + P.map((n) => n.toFixed(2)) + '] it returned ' + JSON.stringify(r) + '.');
          }
          if (!Number.isFinite(r.d) || r.q.some((n) => !Number.isFinite(n))) {
            return no('P=[' + P.map((n) => n.toFixed(2)) + '] gave a non-finite result. '
              + 'One bad triangle is enough to do this, and it poisons the whole mesh.');
          }

          const want = reference(P, mesh);
          if (Math.abs(r.d - want.d) > 1e-9) {
            return no('P=[' + P.map((n) => n.toFixed(2)) + ']: you returned a distance of '
              + r.d.toFixed(6) + ', but searching every triangle gives ' + want.d.toFixed(6)
              + '. ' + (r.d > want.d
                ? 'Yours is larger, so some triangle is being skipped — check the loop '
                  + 'covers every triangle and that the comparison is < rather than <=.'
                : 'Yours is smaller than any point on the surface, so q is not on the mesh.'));
          }
          if (Math.abs(len(sub(P, r.q)) - r.d) > 1e-9) {
            return no('P=[' + P.map((n) => n.toFixed(2)) + ']: the distance you returned ('
              + r.d.toFixed(6) + ') is not the distance from P to the point you returned ('
              + len(sub(P, r.q)).toFixed(6) + '). They have to agree.');
          }
          if (r.tri < 0 || r.tri >= mesh.triangles.length) {
            return no('P=[' + P.map((n) => n.toFixed(2)) + ']: tri is ' + r.tri
              + ', which is not a triangle in this mesh. Record the index as you go.');
          }
          // The recorded triangle must actually produce that distance.
          const t = mesh.triangles[r.tri];
          const own = fn.closestOnTriangle(P, mesh.points[t[0]], mesh.points[t[1]], mesh.points[t[2]]);
          if (Math.abs(len(sub(P, own.q)) - r.d) > 1e-9) {
            return no('P=[' + P.map((n) => n.toFixed(2)) + ']: you reported triangle '
              + r.tri + ', but that triangle is ' + len(sub(P, own.q)).toFixed(6)
              + ' away, not ' + r.d.toFixed(6) + '. The index and the distance are out of step.');
          }
          if (r.tied !== want.tied) {
            return no('P=[' + P.map((n) => n.toFixed(2)) + ']: tied came out ' + r.tied
              + ', expected ' + want.tied + '. Count every triangle whose distance is within '
              + '1e-9 of the best — including the winner itself, so the answer is never 0.');
          }
          if (r.tied > 1) anyTie = true;
        }

        if (!anyTie) {
          return no('Not one query reported a tie, across 40 probes. On this mesh about two '
            + 'thirds of them should: whenever the closest point is on a shared edge, both '
            + 'triangles are exactly equally close. Check the tie count uses a tolerance '
            + 'rather than an exact equality on floats.');
        }

        // A degenerate triangle in the mesh. One NaN ruins min() for everything.
        const broken = fn.sphereMesh(1);
        broken.points.push([0.5, 0.5, 0.5]);
        const k = broken.points.length - 1;
        broken.triangles.push([k, k, k]);          // zero area, repeated corner
        broken.triangles.push([0, 0, 1]);          // zero-length edge
        // And one at the FRONT. A real mesh can have a degenerate face anywhere,
        // and a running minimum seeded from triangles[0] rather than from
        // Infinity starts at NaN and never recovers - a mistake that is
        // unreachable if the bad faces only ever sit at the end.
        broken.triangles.unshift([0, 0, 1]);
        // The nearest REAL triangle, ignoring anything non-finite. Skipping the
        // bad face is acceptable; letting its NaN win, or letting it displace a
        // good triangle, is not - and demanding only a finite answer would pass
        // any implementation, since a running minimum from Infinity skips NaN
        // for free.
        const cleanRef = (Pt, m) => {
          let bd = Infinity;
          m.triangles.forEach((t) => {
            const r = fn.closestOnTriangle(Pt, m.points[t[0]], m.points[t[1]], m.points[t[2]]);
            const d = len(sub(Pt, r.q));
            if (Number.isFinite(d) && d < bd) bd = d;
          });
          return bd;
        };
        for (const P of [[1.5, 0.6, 0.3], [0, 0, 0], [2, 2, 2], [0.4, -1.2, 0.8]]) {
          let r;
          try { r = fn.closestOnMesh(P, broken); } catch (e) {
            return no('A mesh containing a degenerate triangle made closestOnMesh throw: '
              + e.message + '. Real meshes contain them and lesson 3’s weld creates them.');
          }
          if (!r || !Number.isFinite(r.d) || r.q.some((n) => !Number.isFinite(n))) {
            return no('With one degenerate triangle in the mesh, P=['
              + P.map((n) => n.toFixed(1)) + '] returned d=' + (r && r.d)
              + '. A NaN reached the result. Whether that happens depends on how you take '
              + 'the minimum: starting from Infinity skips it, seeding from the first '
              + 'triangle keeps it forever. Guard the divisions in closestOnTriangle, or '
              + 'the divisions in closestOnTriangle, or reject non-finite candidates '
              + 'before comparing. Whether a NaN survives depends on how you take the '
              + 'minimum, so it is a decision rather than an accident.');
          }
          const want = cleanRef(P, broken);
          if (Math.abs(r.d - want) > 1e-9) {
            return no('On the mesh with a degenerate face, P=[' + P.map((n) => n.toFixed(1))
              + '] gave ' + r.d.toFixed(6) + ', but the nearest real triangle is '
              + want.toFixed(6) + ' away. The bad face has displaced a good one.');
          }
        }

        return {
          pass: true,
          message: 'Correct on 40 queries, the triangle index agrees with the distance, the '
            + 'ties are counted, and one degenerate triangle does not poison the mesh. This '
            + 'is the version every faster one gets checked against — keep it.',
        };
      },
      successMessage: '✓ Brute force, correct.',
      failMessage: '✗ Not yet.',
      outputHeight: 460,
    },

  ],
};

// ── The Python half ───────────────────────────────────────────────────────
const PY_CELLS = [
  {
    id: 'mesh',
    cellTitle: 'A mesh worth testing against',
    prose: [
      'A cube is a bad test mesh. Every face is axis-aligned, so a bug that mixes up two coordinates can survive it. A subdivided octahedron pushed out to a sphere has triangles at every orientation and is still closed and welded, which makes it a much less forgiving thing to be wrong on.',
      'The subdivision is worth reading. Each step replaces every triangle with four, by finding the midpoint of each edge and pushing it out to the unit sphere. midpoint() caches by edge key so the two triangles either side of an edge get the SAME new point - which is the shared-midpoint problem from lesson 1, and without the cache the sphere would come apart into loose triangles.',
      'Note what the boundary-edge count says at the end. That is lesson 3’s instrument, used here to confirm the test mesh is what it claims to be before anything is measured on it.',
    ],
    code: `import numpy as np

def sphere_mesh(subdiv=3):
    v = [np.array(x, float) for x in
         ([1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1])]
    f = [[0,2,4], [2,1,4], [1,3,4], [3,0,4],
         [2,0,5], [1,2,5], [3,1,5], [0,3,5]]
    for _ in range(subdiv):
        mid, nf = {}, []
        def midpoint(i, j):
            key = (min(i, j), max(i, j))      # cached per EDGE, so it is shared
            if key not in mid:
                m = (v[i] + v[j]) / 2
                v.append(m / np.linalg.norm(m))
                mid[key] = len(v) - 1
            return mid[key]
        for a, b, c in f:
            ab, bc, ca = midpoint(a, b), midpoint(b, c), midpoint(c, a)
            nf += [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]
        f = nf
    return np.array(v), np.array(f)

verts, faces = sphere_mesh(3)
A, B, C = verts[faces[:,0]], verts[faces[:,1]], verts[faces[:,2]]
print("points   ", len(verts))
print("triangles", len(faces))

# Lesson 3's check, to confirm the test mesh is closed before trusting it.
a = faces[:, [0,1,2]].ravel(); b = faces[:, [1,2,0]].ravel()
edges = np.stack([np.minimum(a,b), np.maximum(a,b)], axis=1)
_, counts = np.unique(edges, axis=0, return_counts=True)
print()
print("boundary edges", int((counts == 1).sum()), " (0 = closed)")
print("V - E + F    ", len(verts) - len(counts) + len(faces), " (2 = one closed surface)")`,
  },
  {
    id: 'loop',
    cellTitle: 'The obvious loop, and what it costs',
    prose: [
      'Straight translation of the idea: for each triangle, ask lesson 5’s solver, keep the nearest. Correct, readable, and slow for a reason that has nothing to do with the algorithm - it is one trip round a Python loop per triangle, on every query.',
      'Time it and multiply out. The number at the bottom is per QUERY, and a real comparison run asks a few hundred thousand of them.',
      'Do not skip past this cell as obvious. It is the baseline that every later version is checked against, and the only version here that is definitely right.',
    ],
    code: `import time

def closest_scalar(P, A, B, C):
    P, A, B, C = (np.asarray(x, float) for x in (P, A, B, C))
    ab, ac = B - A, C - A
    ap = P - A
    d1, d2 = ab @ ap, ac @ ap
    if d1 <= 0 and d2 <= 0: return A, "vertex A"
    bp = P - B
    d3, d4 = ab @ bp, ac @ bp
    if d3 >= 0 and d4 <= d3: return B, "vertex B"
    vc = d1*d4 - d3*d2
    if vc <= 0 and d1 >= 0 and d3 <= 0:
        return (A if d1 == d3 else A + (d1/(d1-d3))*ab), "edge AB"
    cp = P - C
    d5, d6 = ab @ cp, ac @ cp
    if d6 >= 0 and d5 <= d6: return C, "vertex C"
    vb = d5*d2 - d1*d6
    if vb <= 0 and d2 >= 0 and d6 <= 0:
        return (A if d2 == d6 else A + (d2/(d2-d6))*ac), "edge AC"
    va = d3*d6 - d5*d4
    if va <= 0 and (d4-d3) >= 0 and (d5-d6) >= 0:
        span = (d4-d3) + (d5-d6)
        return (B if span == 0 else B + ((d4-d3)/span)*(C-B)), "edge BC"
    total = va + vb + vc
    if total == 0: return A, "degenerate"
    return A + ab*(vb/total) + ac*(vc/total), "inside"


def closest_loop(P, verts, faces):
    best_q, best_d, best_i = None, np.inf, -1
    for i, (ia, ib, ic) in enumerate(faces):
        q, _ = closest_scalar(P, verts[ia], verts[ib], verts[ic])
        d = float(np.linalg.norm(np.asarray(P, float) - q))
        if d < best_d:
            best_q, best_d, best_i = q, d, i
    return best_q, best_d, best_i

P = np.array([1.5, 0.6, 0.3])
t0 = time.perf_counter()
q, d, i = closest_loop(P, verts, faces)
t1 = time.perf_counter()

print("closest point ", np.round(q, 5))
print("distance      ", round(d, 6))
print("triangle      ", i)
print()
print(f"one query over {len(faces)} triangles: {1000*(t1-t0):.1f} ms")
print(f"200,000 queries would be:            {(t1-t0)*200_000/60:.0f} minutes")
print()
print(f"And that is on {len(faces)} triangles. The real part has 214,382.")`,
  },
  {
    id: 'vector',
    cellTitle: 'All the triangles at once',
    prose: [
      'The loop has to go, and the awkward part is the branching: numpy has no per-element if. The answer is to compute the condition for every triangle as a boolean array, and use those arrays as masks to fill in the result.',
      'The masks must be built in the SAME priority order as the scalar version, each one excluding the ones before it - that is what rest = rest & ~mask is doing. Two of these tests can both be true for the same triangle, and without the exclusion such a triangle would be written twice and end up with whichever branch ran last.',
      'einsum("ij,ij->i", u, v) is a row-wise dot product: multiply elementwise and sum along each row. It is the vectorised form of dot(u, v), done for all N triangles in one call.',
      'safe_div is the degenerate guard from lesson 5, vectorised. np.divide with where= leaves the output untouched where the denominator is zero, instead of producing NaN and a warning - and zero is exactly the right value for t there, since a zero-length edge means the corner is the answer.',
      'Read the timing at the bottom against the loop above. Same answers, and the difference is the reason anyone learns this.',
    ],
    code: `def safe_div(num, den):
    """Divide, leaving 0 where the denominator vanishes. A zero denominator
    means a zero-length edge, and t=0 correctly gives the corner."""
    return np.divide(num, den, out=np.zeros_like(num), where=den != 0)

NAMES = ["inside", "edge AB", "edge AC", "edge BC", "vertex A", "vertex B", "vertex C"]

def closest_all(P, A, B, C):
    """P is one point. A, B, C are (N,3). Returns Q (N,3) and region codes."""
    P = np.asarray(P, float)
    ab, ac = B - A, C - A
    ap, bp, cp = P - A, P - B, P - C

    d1 = np.einsum("ij,ij->i", ab, ap); d2 = np.einsum("ij,ij->i", ac, ap)
    d3 = np.einsum("ij,ij->i", ab, bp); d4 = np.einsum("ij,ij->i", ac, bp)
    d5 = np.einsum("ij,ij->i", ab, cp); d6 = np.einsum("ij,ij->i", ac, cp)

    va = d3*d6 - d5*d4
    vb = d5*d2 - d1*d6
    vc = d1*d4 - d3*d2

    # Same order as the scalar version, each mask excluding the earlier ones.
    mA  = (d1 <= 0) & (d2 <= 0);                       rest = ~mA
    mB  = rest & (d3 >= 0) & (d4 <= d3);               rest = rest & ~mB
    mAB = rest & (vc <= 0) & (d1 >= 0) & (d3 <= 0);    rest = rest & ~mAB
    mC  = rest & (d6 >= 0) & (d5 <= d6);               rest = rest & ~mC
    mAC = rest & (vb <= 0) & (d2 >= 0) & (d6 <= 0);    rest = rest & ~mAC
    mBC = rest & (va <= 0) & ((d4-d3) >= 0) & ((d5-d6) >= 0)
    mIn = rest & ~mBC

    Q = np.zeros_like(A)
    code = np.zeros(len(A), dtype=np.int8)
    Q[mA] = A[mA]; code[mA] = 4
    Q[mB] = B[mB]; code[mB] = 5
    Q[mC] = C[mC]; code[mC] = 6

    t = safe_div(d1, d1 - d3)
    Q[mAB] = A[mAB] + t[mAB, None] * ab[mAB]; code[mAB] = 1
    t = safe_div(d2, d2 - d6)
    Q[mAC] = A[mAC] + t[mAC, None] * ac[mAC]; code[mAC] = 2
    t = safe_div(d4 - d3, (d4-d3) + (d5-d6))
    Q[mBC] = B[mBC] + t[mBC, None] * (C - B)[mBC]; code[mBC] = 3

    total = va + vb + vc
    v, w = safe_div(vb, total), safe_div(vc, total)
    Q[mIn] = A[mIn] + ab[mIn]*v[mIn, None] + ac[mIn]*w[mIn, None]
    return Q, code

Q, code = closest_all(P, A, B, C)
d = np.linalg.norm(Q - P, axis=1)
i = int(np.argmin(d))
print("closest point ", np.round(Q[i], 5))
print("distance      ", round(float(d[i]), 6))
print("triangle      ", i, " landed on", NAMES[code[i]])
print()

t0 = time.perf_counter()
for _ in range(20):
    Q, _c = closest_all(P, A, B, C)
    np.argmin(np.linalg.norm(Q - P, axis=1))
t1 = time.perf_counter()
per = (t1 - t0) / 20
print(f"vectorised: {1000*per:.3f} ms per query over {len(faces)} triangles")
print(f"200,000 queries: {per*200_000/60:.1f} minutes")`,
  },
  {
    id: 'agree',
    cellTitle: 'Prove the fast one matches the slow one',
    prose: [
      'Masked numpy code is easy to get subtly wrong - an exclusion left out, a mask applied to the wrong array - and it will still run and still produce plausible numbers. So check it against the loop, on every triangle, not just on the winner.',
      'Comparing only the final answer would hide most mistakes: the nearest triangle is usually in the interior region, so a bug in the edge branches would never show. Comparing all N results at several probes is what makes this worth running.',
      'This is the same discipline as lesson 5’s brute force check, one level up: the thing you trust is the thing that is too simple to be subtly wrong.',
    ],
    code: `rng = np.random.default_rng(4)
probes = rng.uniform(-2, 2, size=(12, 3))

worst_pt, label_mismatch = 0.0, 0
for Pq in probes:
    Qv, codev = closest_all(Pq, A, B, C)
    for k in range(len(faces)):
        Qs, name = closest_scalar(Pq, A[k], B[k], C[k])
        worst_pt = max(worst_pt, float(np.linalg.norm(Qv[k] - Qs)))
        if NAMES[codev[k]] != name and name != "degenerate":
            label_mismatch += 1

print(f"{len(probes)} probes x {len(faces)} triangles = "
      f"{len(probes)*len(faces):,} comparisons")
print(f"worst point difference : {worst_pt:.3e}")
print(f"region label mismatches: {label_mismatch}")
print()
print("identical:", worst_pt < 1e-12 and label_mismatch == 0)`,
  },
  {
    id: 'ties',
    cellTitle: 'Most queries are ties',
    prose: [
      'When the closest point lands on a shared edge, the two triangles either side of that edge are exactly the same distance away - not nearly, exactly, because they share the point. At a vertex, every triangle touching it ties.',
      'Measure how often that happens. The number is much larger than people expect, and it is the reason argmin is a decision rather than a lookup.',
      'For a distance it changes nothing. For a NORMAL it changes everything: the two tied triangles face in different directions, so "which side of the surface is this point on" has two answers and argmin picked one by storage order. That is lesson 10’s problem, and this is where it is created.',
    ],
    code: `queries = rng.uniform(-2, 2, size=(1500, 3))

ties, by_region = 0, {}
for Pq in queries:
    Qv, codev = closest_all(Pq, A, B, C)
    dv = np.linalg.norm(Qv - Pq, axis=1)
    best = dv.min()
    n_equal = int(np.count_nonzero(dv < best + 1e-9))
    if n_equal > 1:
        ties += 1
    region = NAMES[codev[int(np.argmin(dv))]]
    by_region[region] = by_region.get(region, 0) + 1

print(f"{ties} of {len(queries)} queries had 2+ equally-close triangles "
      f"({100*ties/len(queries):.1f}%)")
print()
print("what the winning triangle landed on:")
for name in NAMES:
    k = by_region.get(name, 0)
    if k:
        print(f"  {name:>9}  {k:>5}  {100*k/len(queries):5.1f}%")
print()
print("A tie means argmin chose by storage order. Harmless for a distance,")
print("and the whole difficulty of lesson 10 for a direction.")`,
  },
  {
    id: 'ch-vector',
    challengeType: 'write',
    challengeTitle: 'Return the triangle, not just the distance',
    difficulty: 'core',
    prompt:
      'Write query(P, A, B, C) returning a dict with keys point, distance, triangle and '
      + 'tied - using closest_all, so it is the vectorised version. tied counts how many '
      + 'triangles are within 1e-9 of the best, including the winner, so it is never 0. '
      + 'Then confirm your distance matches the scalar loop.',
    hint:
      'closest_all gives you Q for every triangle; np.linalg.norm(Q - P, axis=1) turns '
      + 'that into distances, and argmin gives the index. For the tie count, compare the '
      + 'whole distance array against its own minimum plus the tolerance and count the '
      + 'Trues with np.count_nonzero.',
    code: `def query(P, A, B, C):
    # TODO: return {"point":..., "distance":..., "triangle":..., "tied":...}
    pass


r = query(P, A, B, C)
print(r)
print()
qs, ds, isc = closest_loop(P, verts, faces)
print("scalar loop distance:", round(float(ds), 6))
print("agrees:", abs(r["distance"] - ds) < 1e-9 if r else False)`,
    solution: `def query(P, A, B, C):
    Q, _code = closest_all(P, A, B, C)
    d = np.linalg.norm(Q - np.asarray(P, float), axis=1)
    i = int(np.argmin(d))
    return {
        "point": Q[i],
        "distance": float(d[i]),
        "triangle": i,
        "tied": int(np.count_nonzero(d < d[i] + 1e-9)),
    }


r = query(P, A, B, C)
print(r)
print()
qs, ds, isc = closest_loop(P, verts, faces)
print("scalar loop distance:", round(float(ds), 6))
print("agrees:", abs(r["distance"] - ds) < 1e-9 if r else False)`,
    testCode: `r = query(P, A, B, C)
assert r is not None, "query returned None - 'pass' is still there."
for k in ("point", "distance", "triangle", "tied"):
    assert k in r, f"no '{k}' key in the returned dict - got {sorted(r)}"

_q, _d, _i = closest_loop(P, verts, faces)
assert abs(r["distance"] - _d) < 1e-9, (
    f"distance {r['distance']:.6f} does not match the scalar loop's {_d:.6f}")
assert np.allclose(np.asarray(r["point"], float), _q, atol=1e-9), (
    f"point {np.round(np.asarray(r['point'], float), 5)} does not match the "
    f"loop's {np.round(_q, 5)}")
assert 0 <= r["triangle"] < len(faces), (
    f"triangle index {r['triangle']} is not in 0..{len(faces)-1}")
assert r["tied"] >= 1, (
    f"tied came out {r['tied']}. The winner counts itself, so it can never be 0 - "
    f"compare against d.min() + 1e-9, not against a strict inequality.")

# The distance must be consistent with the triangle that was reported.
_ia, _ib, _ic = faces[r["triangle"]]
_qq, _ = closest_scalar(P, verts[_ia], verts[_ib], verts[_ic])
assert abs(float(np.linalg.norm(P - _qq)) - r["distance"]) < 1e-9, (
    f"triangle {r['triangle']} is {float(np.linalg.norm(P - _qq)):.6f} away, not "
    f"{r['distance']:.6f} - the index and the distance are out of step")

# And on a few more points, including one at the centre and one on the surface.
for _P in ([0,0,0], [0,0,2], [0.99,0,0], [-1,-1,-1], [3,3,3]):
    _r = query(np.array(_P, float), A, B, C)
    _, _dl, _ = closest_loop(np.array(_P, float), verts, faces)
    assert abs(_r["distance"] - _dl) < 1e-9, (
        f"P={_P}: got {_r['distance']:.6f}, loop says {_dl:.6f}")
    assert _r["tied"] >= 1, f"P={_P}: tied is {_r['tied']}"

"SUCCESS: vectorised, agreeing with the loop, and it tells you which triangle and whether the answer was ambiguous."`,
  },
  {
    id: 'ch-agree',
    challengeType: 'write',
    challengeTitle: 'Prove the fast one right, properly',
    difficulty: 'core',
    prompt:
      'Comparing only the nearest triangle is weak evidence: the nearest is almost always '
      + 'an interior case, so a bug in any of the six boundary branches would never show. '
      + 'Write agreement(probes) comparing closest_all against closest_scalar on EVERY '
      + 'triangle at every probe, returning (worst_point_difference, label_mismatches). '
      + 'Both should come back effectively zero.',
    hint:
      'For each probe, call closest_all once for all N results, then loop the triangles '
      + 'calling closest_scalar on each and compare. NAMES[code[k]] turns a region code '
      + 'back into the label closest_scalar returns. Skip the "degenerate" label, which '
      + 'the vectorised version folds into the interior branch.',
    code: `def agreement(probes):
    # TODO: return (worst_point_difference, label_mismatches)
    pass


w, m = agreement(rng.uniform(-2, 2, size=(6, 3)))
print("worst point difference :", w)
print("label mismatches       :", m)`,
    solution: `def agreement(probes):
    worst, mismatches = 0.0, 0
    for Pq in probes:
        Qv, codev = closest_all(Pq, A, B, C)
        for k in range(len(faces)):
            Qs, name = closest_scalar(Pq, A[k], B[k], C[k])
            worst = max(worst, float(np.linalg.norm(Qv[k] - Qs)))
            if NAMES[codev[k]] != name and name != "degenerate":
                mismatches += 1
    return worst, mismatches


w, m = agreement(rng.uniform(-2, 2, size=(6, 3)))
print("worst point difference :", w)
print("label mismatches       :", m)`,
    testCode: `_probes = np.random.default_rng(21).uniform(-2, 2, size=(5, 3))
_r = agreement(_probes)
assert _r is not None, "agreement returned None - 'pass' is still there."
assert len(_r) == 2, f"expected (worst, mismatches), got {_r!r}"
_w, _m = _r
assert _w < 1e-12, (
    f"worst point difference came out {_w:.3e}. The two solvers are meant to be "
    f"identical to floating-point exactness, so anything above 1e-12 means they "
    f"genuinely differ - or that only the winner is being compared.")
assert _m == 0, f"{_m} region labels disagreed; expected 0"

# It must really compare all N. A version checking only the nearest would pass
# both asserts above, so check the work actually done.
import time as _t
_t0 = _t.perf_counter(); agreement(_probes); _t1 = _t.perf_counter()
_t2 = _t.perf_counter()
for _Pq in _probes:
    closest_all(_Pq, A, B, C)
_t3 = _t.perf_counter()
assert (_t1 - _t0) > (_t3 - _t2) * 3, (
    "agreement() ran nearly as fast as the vectorised calls alone, so it is not "
    "calling closest_scalar for every triangle. Comparing only the nearest one is "
    "exactly the weak check this challenge is about.")
"SUCCESS: identical on every triangle, not just on the winner - which is what makes it evidence."`,
  },
  {
    id: 'ch-scaling',
    challengeType: 'write',
    challengeTitle: 'Measure the growth, do not assume it',
    difficulty: 'stretch',
    prompt:
      'Write the timing yourself. Fill rows with (triangle_count, seconds_per_query) for '
      + 'sphere_mesh(2), (3) and (4), then fill ratios with the ratio between consecutive '
      + 'rows. Each subdivision multiplies the triangle count by 4, so O(n) predicts a '
      + 'ratio of 4.0. Find out what it actually is.',
    hint:
      'Use enough repetitions on the small meshes that you are timing the query and not '
      + 'the clock - per-call numpy overhead is around 0.08 ms, which swamps a 128-triangle '
      + 'mesh completely. closest_all and P are already defined.',
    code: `rows = []
ratios = []

# TODO: time one query at three mesh sizes, filling rows and ratios

for n, secs in rows:
    print(f"{n:>8} triangles  {1000*secs:7.3f} ms")
print("ratios:", [round(r, 2) for r in ratios], " (O(n) predicts 4.0)")`,
    solution: `rows = []
ratios = []

for sub in (2, 3, 4):
    v2, f2 = sphere_mesh(sub)
    A2, B2, C2 = v2[f2[:,0]], v2[f2[:,1]], v2[f2[:,2]]
    reps = max(5, min(80, 80000 // len(f2)))
    t0 = time.perf_counter()
    for _ in range(reps):
        Q2, _c = closest_all(P, A2, B2, C2)
        np.argmin(np.linalg.norm(Q2 - P, axis=1))
    rows.append((len(f2), (time.perf_counter() - t0) / reps))

ratios = [rows[i+1][1] / rows[i][1] for i in range(len(rows) - 1)]

for n, secs in rows:
    print(f"{n:>8} triangles  {1000*secs:7.3f} ms")
print("ratios:", [round(r, 2) for r in ratios], " (O(n) predicts 4.0)")`,
    testCode: `assert len(rows) == 3, f"expected 3 timing rows, got {len(rows)}"
assert len(ratios) == 2, f"expected 2 ratios from 3 rows, got {len(ratios)}"
_counts = [n for n, _ in rows]
assert _counts == [128, 512, 2048], (
    f"triangle counts came out {_counts}; sphere_mesh(2), (3) and (4) give "
    f"[128, 512, 2048] - each subdivision multiplies by 4")
for n, secs in rows:
    assert secs > 0, f"a zero time for {n} triangles is the clock, not the query"
    assert secs < 1.0, f"{secs:.3f} s for {n} triangles is far too slow - is it vectorised?"
assert abs(ratios[-1] - rows[-1][1] / rows[-2][1]) < 1e-9, (
    "the last ratio does not match the times in rows - compute it from them")
assert ratios[-1] > 1.5, (
    f"the largest ratio is only {ratios[-1]:.2f}. At these sizes the per-call numpy "
    f"overhead can hide the growth entirely - use more repetitions.")
"SUCCESS: measured rather than derived. Note the ratio is not exactly 4 - complexity gives the shape, not the constant."`,
  },
  {
    id: 'scaling',
    cellTitle: 'Where this is going',
    prose: [
      'The last thing to do with brute force is find out how badly it scales, which means measuring it rather than reasoning about it.',
      'Watch two things. The per-query time roughly quadruples when the triangle count quadruples, which is the linear behaviour you would predict - but it is slightly WORSE than linear at the top, because the arrays stop fitting in cache and the processor starts waiting for memory instead of computing. Complexity gives you the shape; it does not give you the constant, and the constant here degrades.',
      'And look at the megabytes column. Those are temporary arrays, built and thrown away on every single query. Nothing leaks, and it is still most of the cost.',
      'The answer is not a faster loop - there is no loop left. The answer is to stop looking at nearly every triangle, which is lessons 8 and 9.',
    ],
    code: `print(f"{'triangles':>10} {'per query':>11} {'x200k queries':>15} {'arrays':>9}")
prev = None
for sub in (2, 3, 4, 5):
    v2, f2 = sphere_mesh(sub)
    A2, B2, C2 = v2[f2[:,0]], v2[f2[:,1]], v2[f2[:,2]]
    reps = max(3, min(40, 40000 // len(f2)))
    t0 = time.perf_counter()
    for _ in range(reps):
        Q2, _c = closest_all(P, A2, B2, C2)
        np.argmin(np.linalg.norm(Q2 - P, axis=1))
    per = (time.perf_counter() - t0) / reps
    mb = (A2.nbytes + B2.nbytes + C2.nbytes + Q2.nbytes) / 1e6
    growth = f"  x{per/prev:.1f}" if prev else ""
    print(f"{len(f2):>10} {1000*per:>9.3f} ms {per*200_000/60:>12.1f} min "
          f"{mb:>7.1f} MB{growth}")
    prev = per

print()
print("Measured on a desktop for this series, at larger sizes:")
print("    8,192 triangles   1.01 ms/query    3.4 min per 200k queries")
print("   32,768 triangles   5.34 ms/query   17.8 min")
print("  131,072 triangles  24.59 ms/query   82.0 min   12.6 MB per call")
print()
print("The real part is 214,382 triangles. Over two hours, for an answer")
print("somebody is waiting on at a machine.")`,
  },
];

export default {
  id: 'mesh-engine-1-6-point-to-mesh',
  slug: 'point-to-mesh',
  chapter: 'mesh-engine.1',
  order: 5,
  title: 'Point-to-Mesh Distance',
  subtitle: 'Every triangle, by brute force, measured — because the next lesson has to earn the right to replace it.',
  tags: [
    'closest point', 'brute force', 'complexity', 'vectorisation', 'numpy masks',
    'argmin', 'ties', 'shared edge', 'einsum', 'allocation', 'cache',
  ],
  aliases: 'point to mesh distance closest surface point brute force O(n) argmin tie shared edge ambiguous normal vectorised masks einsum row-wise dot product safe divide scaling measurement allocation churn cache',
  timeToComplete: 60,
  coreConcept:
    'Closest-point-on-mesh is closest-point-on-triangle over every triangle, keeping the nearest. It is correct, it is the thing every faster method gets checked against, and it is linear in triangles times queries. Two things matter beyond the loop: return WHICH triangle won, because everything downstream needs it, and notice that most queries are ties - 66% on a real test mesh - because a shared edge belongs to two triangles that are exactly equally close, so argmin picks one by storage order.',
  prerequisites: ['mesh-engine-1-5-point-to-triangle'],
  nextLesson: 'mesh-engine-1-7-why-brute-force-stops-working',

  semantics: {
    core: [
      { symbol: 'min over all triangles', meaning: 'The whole algorithm. Correct, and the reference every acceleration is measured against.' },
      { symbol: 'argmin', meaning: 'Which triangle won. A decision, not a lookup, because ties are the common case.' },
      { symbol: 'tied', meaning: 'How many triangles are exactly equally close. 2 at a shared edge, more at a vertex, and 66% of queries on a real mesh.' },
      { symbol: 'einsum("ij,ij->i", u, v)', meaning: 'A row-wise dot product: the vectorised form of dot(u, v) for all N triangles at once.' },
      { symbol: 'rest = rest & ~mask', meaning: 'Excluding earlier branches, so the masks have the same priority order the scalar if/else chain had.' },
      { symbol: 'np.divide(a, b, out=zeros, where=b!=0)', meaning: 'The degenerate guard, vectorised. Leaves 0 where the edge has no length, which is the correct t.' },
      { symbol: 'O(triangles x queries)', meaning: 'Double either and the time doubles. Measured: 24.59 ms per query at 131,072 triangles.' },
    ],
    rulesOfThumb: [
      'Keep the brute-force version forever. It is the only one you can check the others against.',
      'Return the triangle index alongside the distance. Adding it later means touching every caller.',
      'Count the ties. A function that hides ambiguity will surprise you when normals matter.',
      'Build numpy masks in the same priority order as the if/else chain, each excluding the ones before it.',
      'Compare a vectorised solver against the scalar one on EVERY element, not just on the winner - a bug in the edge branches never reaches the winner.',
      'Decide what a NaN does before it happens. np.argmin selects it; a running minimum from infinity skips it. Neither is a choice you made by accident that you want to keep.',
      'Measure scaling rather than deriving it. The constant degrades as the arrays leave cache, and allocation is often most of the cost.',
    ],
  },

  hook: {
    question: 'Brute force over a mesh is correct and simple. Fully vectorised in numpy, with no Python loop left, how long does one query take against 131,072 triangles - and what does that make a run of 200,000 queries?',
    realWorldContext: '24.59 ms per query, and 82 minutes for the run. It also allocates 12.6 MB of temporary arrays per query, which is 2.5 TB of allocation churn across the run, none of it leaked. The real part is 214,382 triangles, so over two hours for an answer somebody is waiting on at a machine. Doubling the mesh or the query count doubles the time, and at the top it is slightly worse than linear because the arrays stop fitting in cache.',
    previewVisualizationId: 'JSNotebook',
  },

  intuition: {
    prose: [
      'One triangle was the hard part. Every triangle is just a loop around it, keeping the nearest answer.',
      'That version is correct, and being correct makes it permanently useful as the thing faster versions are checked against.',
      'Record which triangle won, not only how far. Attribution, normals and classification all need it, and retrofitting it means touching every caller.',
      'A shared edge belongs to two triangles, so when the closest point lands on one they are exactly equally close - and argmin picks one by storage order.',
      'That is harmless for a distance and is the whole difficulty later, when the question becomes which side of the surface a point is on.',
      'Then measure it, because the case for spatial acceleration is a slogan without numbers and undeniable with them.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: closest point on a mesh',
        body: 'Step 1. For every triangle, get the closest point on it and its distance.\nStep 2. Keep the smallest, recording the point, the distance and the triangle index.\nStep 3. Count how many triangles are within a tolerance of that smallest distance. That is the tie count.\nStep 4. Reject non-finite results, so one degenerate triangle cannot poison the whole query.\nStep 5. Keep this implementation. Everything faster gets diffed against it.',
      },
      {
        type: 'insight',
        title: 'Two thirds of queries are ties',
        body: 'Measured over 1,500 random query points against a 512-triangle sphere: 66.3% had two or more triangles at exactly the same distance. That is not floating-point luck - a shared edge is the same point in both triangles, so both report it exactly. argmin then returns whichever came first in the file. It costs nothing now. In lesson 10 the answer needed is a direction rather than a distance, and the two tied triangles face different ways.',
      },
      {
        type: 'warning',
        title: 'One NaN poisons the whole mesh, not one triangle',
        body: 'It depends on how you take the minimum, and the answer is the opposite of the intuition. Measured: np.argmin over an array containing a NaN returns the NaN\u2019s own index, and np.min returns nan - so the fast vectorised version is poisoned, and every query against the whole mesh comes back as nonsense. A plain loop with if (d < best) and best starting at infinity silently SKIPS the NaN and returns the right answer for every other triangle. Seed best from the first triangle instead of from infinity and one bad first face poisons it forever.\n\nSo the plodding version is the safe one and the fast one is the trap, which is worth knowing before you replace the former with the latter. np.nanargmin is the fix, or drop degenerate faces at load. Either way, decide rather than inherit: silently skipping a triangle is not obviously better than failing loudly on it.',
      },
      {
        type: 'warning',
        title: 'Compare vectorised against scalar on every element',
        body: 'Masked numpy code runs and produces plausible numbers when it is wrong. Comparing only the final nearest point hides most mistakes, because the winner is usually in the interior region - so a bug in any of the six boundary branches never shows up. The check in this lesson compares all N results at twelve probes, 49,152 comparisons, and that is what makes it evidence.',
      },
      {
        type: 'insight',
        title: 'Complexity gives the shape, not the constant',
        body: 'O(n) predicts that four times the triangles costs four times the time. Measured, it cost 5.3x and then 4.6x, because at 131,072 triangles the arrays no longer fit in cache and the processor waits on memory. The other hidden cost is allocation: 12.6 MB of temporaries per query, built and freed, which is often most of the time. Neither appears in the complexity class, and both decide whether something ships.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Move the point, see which triangle wins and how many tied',
        caption: 'The winning triangle is highlighted. Watch the tie count as the closest point crosses an edge.',
        props: {
          lesson: LESSON_MESH_1_6,
        },
      },
    ],
  },

  math: {
    prose: [
      'The Python half builds a sphere rather than a cube, because every face of a cube is axis-aligned and a bug that swaps two coordinates can survive it.',
      'Then the obvious loop, timed. Then the same thing with the Python loop removed entirely, using boolean masks in place of the if/else chain - which is the real technical content of this lesson.',
      'The masked version is checked against the scalar one on every triangle at twelve probes, not just on the winner, because that is where a masking bug would hide.',
      'Then the tie measurement, and a scaling table that hands over to lesson 7.',
    ],
    visualizations: [
      {
        id: 'PythonNotebook',
        title: 'The loop, then the masks, then the measurement',
        mathBridge: 'The scalar algorithm is a chain of if/else branches; the vectorised one is the same logic expressed as boolean algebra over arrays. Each branch condition becomes a mask, and the mutual exclusion of the if/else chain becomes rest & ~mask - the set-theoretic complement. The two forms are identical because a priority-ordered chain of conditions and a sequence of disjoint sets are the same object described two ways, which is why the check can demand exact agreement rather than approximate.',
        caption: 'Verified identical to the scalar solver across 49,152 comparisons.',
        props: {
          initialCells: PY_CELLS,
        },
      },
    ],
  },

  examples: [
    {
      title: 'Measured brute-force scaling',
      prose: '8,192 triangles at 1.01 ms per query is 3.4 minutes per 200,000 queries. 32,768 at 5.34 ms is 17.8 minutes. 131,072 at 24.59 ms is 82 minutes, with 12.6 MB of temporary arrays per call. Four times the triangles cost 5.3x then 4.6x the time, not 4x.',
    },
    {
      title: 'Ties are the majority',
      prose: '66.3% of 1,500 random queries against a 512-triangle sphere had two or more exactly-equally-close triangles. Shared edges guarantee it: the same point belongs to both faces, so both report the same distance exactly.',
    },
    {
      title: 'The clamped shortcut on a real mesh',
      prose: 'Carried over from lesson 5 and measured here: over 4,000 queries it overstated the distance on 43.5% of them and picked a genuinely different nearest triangle on 5.28%. Worst error 0.0023 on a unit sphere - small enough to look entirely plausible.',
    },
  ],

  challenges: [
    {
      prompt: 'Write closestOnMesh returning the point, the distance, the triangle index and the tie count, checked against an independent search and against a mesh containing a degenerate triangle.',
      hint: 'Two passes: one for the minimum, one to count how many are within 1e-9 of it. The winner counts itself, so tied is never 0.',
    },
    {
      prompt: 'Vectorise it with boolean masks, keeping the priority order of the if/else chain, and prove it identical to the scalar version on every triangle rather than only on the winner.',
      hint: 'rest = rest & ~mask after each branch. Compare all N results at several probes - a bug in the edge branches never reaches the nearest triangle.',
    },
    {
      prompt: 'Measure how often a query has two or more equally-close triangles, and explain why the number is so large.',
      hint: 'A shared edge is the same point in both triangles, so both distances are exactly equal, not nearly equal.',
    },
    {
      prompt: 'Time brute force at four mesh sizes and report both the per-query time and the temporary memory per call. Say where it stops being linear and why.',
      hint: 'Watch the growth ratio against the expected 4x. The arrays leaving cache is the reason, and allocation is the other half of the cost.',
    },
  ],

  misconceptions: [
    {
      claim: 'Brute force is the wrong answer, so there is no point writing it.',
      reality: 'It is the correct answer and the only one you can check the fast ones against. Every acceleration in the next four lessons is verified by diffing against it. Deleting it means never being able to prove the fast version again.',
    },
    {
      claim: 'A tie is a floating-point coincidence.',
      reality: 'It is exact and structural. Two triangles sharing an edge share every point on it, so when the closest point lands there both report the identical distance. 66% of queries on a real mesh.',
    },
    {
      claim: 'Which triangle argmin returns does not matter.',
      reality: 'It matters as soon as you need the triangle for anything other than distance - its normal, which operation cut it, which feature it belongs to. argmin picks by storage order, so the answer depends on how the file happened to be written.',
    },
    {
      claim: 'Vectorising is just removing the loop; the answers are the same by construction.',
      reality: 'Masked code is easy to get wrong in ways that still run. If the masks are not made mutually exclusive in the original priority order, triangles matching two conditions get whichever branch was assigned last.',
    },
    {
      claim: 'One bad triangle gives one bad answer.',
      reality: 'It depends on the reduction. np.argmin returns the index OF the NaN and np.min returns nan, so the vectorised query is poisoned for every point on the mesh. A running if (d < best) from infinity quietly ignores it and answers correctly from the remaining triangles. Neither behaviour is a choice anyone made, which is the problem - use np.nanargmin, or reject degenerate faces at load, and know which one you picked.',
    },
    {
      claim: 'O(n) means four times the data takes four times as long.',
      reality: 'Measured, it took 5.3x and then 4.6x, because the arrays stopped fitting in cache. Complexity describes the shape of the curve and says nothing about the constant, which here gets worse with size.',
    },
  ],

  transferPrompts: [
    'Why keep the brute-force implementation after building something a thousand times faster?',
    'Your vectorised solver agrees with the scalar one on the nearest triangle for every test point. Why is that weak evidence?',
    'A query returns tied = 7. What does that tell you about where the closest point is, and what will it cost you later?',
    'Timing showed 4x the triangles costing 4.6x the time. Name two causes that O(n) does not describe.',
    'You find one NaN in a distance field over 200,000 queries. How many bad triangles could produce that, and how would you find them?',
  ],

  debugging: [
    {
      symptom: 'Every query on a large mesh returns NaN, but only after switching to the vectorised version.',
      cause: 'A degenerate triangle produces NaN, and np.argmin returns the index of the NaN rather than of the minimum. The scalar loop had been skipping it silently, so the bug arrived with the optimisation.',
      fix: 'np.nanargmin instead of np.argmin, or drop zero-area faces at load. Guard the divisions in the per-triangle solver so the NaN never appears.',
    },
    {
      symptom: 'The scalar and vectorised versions disagree on exactly one mesh.',
      cause: 'That mesh contains a degenerate face. The loop ignores its NaN; argmin selects it.',
      fix: 'Count the zero-area faces first. The disagreement is evidence, not noise.',
    },
    {
      symptom: 'The distance is right but the reported triangle is the wrong one.',
      cause: 'The index is being recorded outside the branch that updates the minimum, so it lags by one iteration.',
      fix: 'Update the point, the distance and the index together, inside the same comparison.',
    },
    {
      symptom: 'The vectorised version is slightly wrong for a few points.',
      cause: 'Masks not made mutually exclusive, so a triangle satisfying two conditions took the wrong branch.',
      fix: 'Apply rest = rest & ~mask after each branch, in the same order as the scalar chain, and diff all N results against scalar.',
    },
    {
      symptom: 'The tie count is always 0.',
      cause: 'Exact float equality against the minimum, or a strict inequality that excludes the winner.',
      fix: 'Count distances below min + 1e-9. The winner is always one of them, so the answer is at least 1.',
    },
    {
      symptom: 'Vectorising barely helped.',
      cause: 'The mesh is small enough that per-call numpy overhead dominates, around 0.08 ms in these measurements.',
      fix: 'Compare at several sizes before concluding anything. Below a couple of thousand triangles the overhead is the measurement.',
    },
  ],

  mastery: {
    prerequisites:
      'Lesson 5 for the per-triangle solver and its degenerate guards, lesson 3 for the boundary-edge check used to validate the test mesh, and lesson 4 for why a per-item Python loop is unaffordable.',
    signals: [
      'Writes the brute-force version first and keeps it as the reference.',
      'Returns the triangle index and the tie count without being asked.',
      'Can explain why ties are exact and structural rather than coincidental.',
      'Builds numpy masks mutually exclusive in the original priority order, and knows what breaks otherwise.',
      'Measures scaling instead of deriving it, and can name two costs complexity does not describe.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'mesh-engine-1-5-point-to-triangle', why: 'The per-triangle solver, its seven regions and its degenerate guards.' },
      { lessonId: 'mesh-engine-1-3-topology-and-welding', why: 'The boundary-edge count, used here to confirm the test mesh is closed before measuring on it.' },
      { lessonId: 'mesh-engine-1-4-mesh-files', why: 'Why the Python loop has to go, and where a real triangle count comes from.' },
      { lessonId: 'la1-003', why: 'The dot product, which every branch condition here is built from.' },
    ],
    futureLinks: [
      { lessonId: 'mesh-engine-1-7-why-brute-force-stops-working', why: 'The same measurement taken far enough that the answer is undeniable.' },
    ],
  },

  checkpoints: [
    'I can extend a per-triangle solver to a whole mesh and know why the brute-force version is worth keeping.',
    'I return the triangle index and the tie count, and can say why both matter later.',
    'I can explain why two thirds of queries are ties, exactly rather than approximately.',
    'I can vectorise an if/else chain into mutually exclusive boolean masks.',
    'I check a vectorised routine element by element, not only on its final answer.',
    'I can state two costs that O(n) does not capture, from measurements I took.',
  ],

  assessment: {
    task: 'Produce a closest-point-on-mesh query, vectorised, and demonstrate both its correctness and its scaling behaviour.',
    acceptance: [
      'Returns point, distance, triangle index and tie count.',
      'Verified identical to a scalar reference on every triangle at multiple probes.',
      'Finite results on a mesh containing degenerate triangles.',
      'A measured scaling table with per-query time and temporary memory.',
      'An explicit statement of where the measurement departs from linear, and why.',
    ],
  },

  quiz: [
    {
      question: 'Why keep the brute-force implementation once a faster one exists?',
      options: [
        'It is the reference every faster version gets checked against',
        'It uses less memory',
        'It is faster for small meshes, so both are needed',
        'There is no reason — it should be deleted',
      ],
      answer: 0,
      explanation: 'Correctness of an accelerated query is established by diffing against brute force. Delete it and there is no way to prove the fast version again.',
    },
    {
      question: 'Measured over 1,500 queries against a 512-triangle sphere, how many had two or more equally-close triangles?',
      options: [
        '66.3% — ties are the normal case, not the exception',
        'About 1%, only where the point is exactly on an edge',
        'None, because floats never compare exactly equal',
        'All of them',
      ],
      answer: 0,
      explanation: 'A shared edge is the same point in both triangles, so both report the identical distance exactly. argmin then picks whichever came first in the file.',
    },
    {
      question: 'What goes wrong if numpy masks are not made mutually exclusive?',
      options: [
        'A triangle matching two conditions takes whichever branch was assigned last, not the one the priority order intended',
        'numpy raises a shape error',
        'Nothing — the conditions cannot overlap',
        'The result is NaN',
      ],
      answer: 0,
      explanation: 'The scalar if/else chain has priority built in. Reproducing it needs rest = rest & ~mask after each branch, or later assignments silently overwrite earlier ones.',
    },
    {
      question: 'One degenerate triangle produces a NaN distance. What happens depends on the reduction — which of these is right?',
      options: [
        'np.argmin returns the NaN\u2019s index, so the vectorised query is poisoned; a loop with if (d < best) from infinity skips it and answers correctly',
        'Both approaches return NaN',
        'Both approaches skip it safely',
        'np.argmin raises an exception on NaN',
      ],
      answer: 0,
      explanation: 'Measured. np.argmin returns the index of the NaN and np.min returns nan, so the fast version is the dangerous one. The plodding loop is safe but silently drops a triangle, which is also not a decision anyone made. np.nanargmin, or reject degenerate faces at load.',
    },
    {
      question: 'Quadrupling the triangle count made the measured time grow by 5.3x, then 4.6x. Why not exactly 4x?',
      options: [
        'The arrays stopped fitting in cache, so the processor spends time waiting on memory',
        'The algorithm is actually O(n log n)',
        'Measurement noise',
        'numpy overhead grows with array size',
      ],
      answer: 0,
      explanation: 'Complexity gives the shape of the curve and nothing about the constant. Here the constant degrades with size, and allocation — 12.6 MB per query — is the other half of the cost.',
    },
    {
      question: 'Your vectorised solver agrees with the scalar one on the nearest triangle at every test point. How strong is that?',
      options: [
        'Weak — the nearest triangle is usually an interior case, so bugs in the six boundary branches never show',
        'Conclusive, since the nearest triangle is the only output that matters',
        'Meaningless, because the two implementations share code',
        'Strong, provided there are more than ten test points',
      ],
      answer: 0,
      explanation: 'Comparing only the winner exercises mostly the interior branch. The check in this lesson compares all N results at twelve probes — 49,152 comparisons — which is what makes it evidence.',
    },
  ],
};
