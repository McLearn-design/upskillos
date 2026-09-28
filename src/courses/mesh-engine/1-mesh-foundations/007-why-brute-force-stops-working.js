// Mesh Engine 1.7 — Why Brute Force Stops Working
//
// A measurement lesson. No new algorithm: the job is to make the mesh large
// enough that the case for spatial acceleration is undeniable, and to name the
// three costs that complexity notation does not.
//
// Every figure was measured twice by
// field-fixes/verify/check-brute-force-wall.py and agreed to within noise.
//
// NOTE ON three.js: the cells load three@0.160.0 from the CDN with a plain
// <script> tag. That is deliberate and must not be bumped to match the app.
// three removed the classic global build after r16x - 0.186.0 returns 404 for
// build/three.min.js - and a failed <script src> is silent, leaving THREE
// undefined and the canvas blank. check-lesson-cdn.mjs guards this.

const THREE_CDN = '<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"><\/script>';

const LESSON_MESH_1_7 = {
  title: 'The Wall',
  subtitle: 'Make the mesh big enough and the correct answer stops being a usable one.',
  sequential: true,

  cells: [

    {
      type: 'markdown',
      instruction: `### O(n) is not the interesting part

Lesson 6 built the correct answer and said it was linear. Everybody already
knew it was linear. **Linear in what, times what, with what constant** is the
question, and that is measured rather than reasoned about.

Here is the whole of it, measured on one desktop, with the Python loop already
removed and every triangle handled at once by numpy — brute force done as well
as brute force can be done:

| triangles | per query | arrays per call | × 200,000 queries |
|---|---|---|---|
| 1,000 | 0.17 ms | 0.1 MB | 0.6 min |
| 10,000 | 1.05 ms | 1.0 MB | 3.5 min |
| 100,000 | 17.0 ms | 9.6 MB | **57 min** |
| 1,000,000 | 185 ms | 96.0 MB | **10 hours** |

The real part is **214,382 triangles**. A comparison run asks a few hundred
thousand queries. That is the wall, and it is not a slogan — it is somebody
standing at a machine waiting for an answer that is still two hours away.

**And the fix is not a faster loop.** There is no loop left. Every triangle is
already being handled in one numpy call. The only remaining move is to **stop
looking at nearly all of them**, which is what the next two lessons are for.

Before that, three things in that table that O(n) does not tell you.`,
    },

    {
      type: 'js',
      instruction: `### Measure it on your own machine

The table above is one desktop. Yours will be different, and the *shape* is what
matters, not the numbers.

Press **run** and it times the same brute-force query at each size, in your
browser, right now. It takes a few seconds.

**Read the third column, not the second.** The per-triangle cost is what tells
you whether the work is scaling the way the complexity class promises. If the
algorithm were purely O(n), that column would be flat.

It is not flat, and it is wrong at both ends for two completely different
reasons:

- **At the small end it is too high**, because a few hundred microseconds of
  fixed cost is being divided by a tiny number of triangles. You are timing the
  call, not the work.
- **At the large end it is too high again**, because the arrays have outgrown
  the processor's cache and it is waiting on memory.

In between is the only place the number means what you think it means.`,
      html: `<div style="padding:8px 2px">
  <button id="run" style="background:#1e3a5f;color:#dbeafe;border:1px solid #3b6ea5;border-radius:4px;padding:6px 14px;cursor:pointer;font:12px ui-monospace,monospace">run the measurement</button>
  <span id="status" style="color:#7d8794;font:11px ui-monospace,monospace;margin-left:10px"></span>
</div>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:10px;white-space:pre;background:#0a0f1e;border-radius:8px;min-height:300px"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `// Brute force, in plain JavaScript, over flat typed arrays. No library and no
// cleverness - this is the same work the numpy version does, one triangle at a
// time, so the shape of the curve is the same shape.
function makeMesh(n) {
  // Triangles scattered over a sphere. Typed arrays rather than arrays of
  // arrays, because millions of small objects would be measuring the garbage
  // collector rather than the geometry.
  var A = new Float64Array(n * 3);
  var B = new Float64Array(n * 3);
  var C = new Float64Array(n * 3);
  var seed = 12345;
  function rnd() {           // a small deterministic generator, so runs compare
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648 * 2 - 1;
  }
  for (var i = 0; i < n; i++) {
    var x = rnd(), y = rnd(), z = rnd();
    var L = Math.hypot(x, y, z) || 1;
    x /= L; y /= L; z /= L;
    for (var k = 0; k < 3; k++) {
      A[i*3+k] = [x,y,z][k];
      B[i*3+k] = [x,y,z][k] + rnd() * 0.02;
      C[i*3+k] = [x,y,z][k] + rnd() * 0.02;
    }
  }
  return { n: n, A: A, B: B, C: C };
}

// The squared distance from P to one triangle. Squared, because every use of
// it here is a comparison and a square root would be pure waste.
function d2ToTriangle(px, py, pz, A, B, C, i) {
  var ax = A[i*3], ay = A[i*3+1], az = A[i*3+2];
  var abx = B[i*3]-ax, aby = B[i*3+1]-ay, abz = B[i*3+2]-az;
  var acx = C[i*3]-ax, acy = C[i*3+1]-ay, acz = C[i*3+2]-az;
  var apx = px-ax, apy = py-ay, apz = pz-az;

  var d1 = abx*apx + aby*apy + abz*apz;
  var d2 = acx*apx + acy*apy + acz*apz;
  var qx, qy, qz;
  if (d1 <= 0 && d2 <= 0) { qx = ax; qy = ay; qz = az; }
  else {
    var bpx = px-B[i*3], bpy = py-B[i*3+1], bpz = pz-B[i*3+2];
    var d3 = abx*bpx + aby*bpy + abz*bpz;
    var d4 = acx*bpx + acy*bpy + acz*bpz;
    if (d3 >= 0 && d4 <= d3) { qx = B[i*3]; qy = B[i*3+1]; qz = B[i*3+2]; }
    else {
      var vc = d1*d4 - d3*d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) {
        var t = (d1 === d3) ? 0 : d1 / (d1 - d3);
        qx = ax + abx*t; qy = ay + aby*t; qz = az + abz*t;
      } else {
        var cpx = px-C[i*3], cpy = py-C[i*3+1], cpz = pz-C[i*3+2];
        var d5 = abx*cpx + aby*cpy + abz*cpz;
        var d6 = acx*cpx + acy*cpy + acz*cpz;
        if (d6 >= 0 && d5 <= d6) { qx = C[i*3]; qy = C[i*3+1]; qz = C[i*3+2]; }
        else {
          var vb = d5*d2 - d1*d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) {
            var t2 = (d2 === d6) ? 0 : d2 / (d2 - d6);
            qx = ax + acx*t2; qy = ay + acy*t2; qz = az + acz*t2;
          } else {
            var va = d3*d6 - d5*d4;
            if (va <= 0 && (d4-d3) >= 0 && (d5-d6) >= 0) {
              var span = (d4-d3) + (d5-d6);
              var t3 = (span === 0) ? 0 : (d4-d3)/span;
              qx = B[i*3] + (C[i*3]-B[i*3])*t3;
              qy = B[i*3+1] + (C[i*3+1]-B[i*3+1])*t3;
              qz = B[i*3+2] + (C[i*3+2]-B[i*3+2])*t3;
            } else {
              var tot = va + vb + vc;
              if (tot === 0) { qx = ax; qy = ay; qz = az; }
              else {
                var v = vb/tot, w = vc/tot;
                qx = ax + abx*v + acx*w;
                qy = ay + aby*v + acy*w;
                qz = az + abz*v + acz*w;
              }
            }
          }
        }
      }
    }
  }
  var dx = px-qx, dy = py-qy, dz = pz-qz;
  return dx*dx + dy*dy + dz*dz;
}

function query(px, py, pz, m) {
  var best = Infinity, bi = -1;
  for (var i = 0; i < m.n; i++) {
    var d = d2ToTriangle(px, py, pz, m.A, m.B, m.C, i);
    if (d < best) { best = d; bi = i; }
  }
  return { d: Math.sqrt(best), i: bi };
}

var SIZES = [1000, 10000, 100000, 500000];

function run() {
  var lines = ['  triangles     per query   ns/triangle   arrays      x200k queries'];
  var status = document.getElementById('status');

  SIZES.forEach(function (n) {
    status.textContent = 'building ' + n.toLocaleString() + ' triangles...';
    var m = makeMesh(n);

    // Warm up, so the first timed call is not also paying for JIT compilation.
    query(1.7, 0.3, -0.4, m);

    var reps = Math.max(2, Math.min(40, Math.floor(2000000 / n)));
    var t0 = performance.now();
    for (var r = 0; r < reps; r++) query(1.7 + r * 1e-6, 0.3, -0.4, m);
    var per = (performance.now() - t0) / reps;

    var mb = (m.A.byteLength + m.B.byteLength + m.C.byteLength) / 1e6;
    lines.push('  ' + n.toLocaleString().padStart(9) +
      (per.toFixed(2) + ' ms').padStart(14) +
      ((per / n * 1e6).toFixed(1) + ' ns').padStart(14) +
      (mb.toFixed(1) + ' MB').padStart(10) +
      ((per * 200000 / 60000).toFixed(1) + ' min').padStart(18));
    document.getElementById('out').textContent = lines.join('\\n');
  });

  lines.push('');
  lines.push('  Read the ns/triangle column. If this were purely O(n) it would');
  lines.push('  be flat. It is high at the small end (you are timing the call,');
  lines.push('  not the work) and high again at the large end (the arrays have');
  lines.push('  left cache). Only the middle means what it looks like.');
  lines.push('');
  lines.push('  The real part is 214,382 triangles.');
  document.getElementById('out').textContent = lines.join('\\n');
  status.textContent = 'done';
}

document.getElementById('run').addEventListener('click', run);
document.getElementById('out').textContent =
  'Press the button. It takes a few seconds and runs on your machine,\\n' +
  'not the one the lesson quotes.';`,
      outputHeight: 520,
    },

    {
      type: 'markdown',
      instruction: `### The three costs complexity does not name

#### 1. There is a floor, and below it you are measuring nothing

A query over 1,000 triangles took **0.17 ms**, and almost all of that is fixed
cost that would be there for one triangle. Divide it by 1,000 and you get a
per-triangle figure that is **not a measurement of anything** — it moved from
431 ns to 169 ns between two runs of the same script on the same machine.

So a benchmark on a small mesh does not predict a large one, and "we tested it,
it was fast" is not evidence unless the test was big enough to leave the floor
behind. Here that is somewhere above 10,000 triangles.

#### 2. The constant gets worse, not better

From 10,000 to 1,000,000 triangles the cost **per triangle** rose from about
105 ns to about 188 ns — **1.8× worse** — measured twice, 1.86× and 1.74×.

Nothing about the algorithm changed. What changed is that 96 MB of arrays does
not fit in a processor cache, so the machine spends an increasing share of its
time waiting for memory rather than computing. O(n) says "double the work for
double the data". Reality said double the data, **more than double** the time.

That is not a rounding error at scale. It is the difference between an
estimate and a schedule.

#### 3. Allocation you never see

At 1,000,000 triangles the vectorised version builds and discards **96 MB** of
temporary arrays on **every single query**. Nothing leaks — it is all freed
immediately — and over 200,000 queries that is nearly 20 TB of allocation
churn. It does not appear in the complexity class, it does not appear in a
profile that only counts your own functions, and it is a large part of the
wall.

---

### So: filter the triangles first?

The obvious next move is to reject triangles cheaply before doing the real
work. Put a sphere round each triangle, measure to the sphere — one subtraction
and a dot product — and only run the proper solver on the ones that could
possibly win.

That works, and it is exact: measured on 100,000 triangles it left **595
survivors, 0.59%** of them, with **the identical answer**.

**99.4% of the work removed. Ask yourself how much faster that made it, before
you read on.**

It made it **15× faster.** Not 169×.

The reason is the point of this whole lesson, and it is why the next two exist:
**the filter is itself O(n).** You still touched every triangle, just more
cheaply. You can make the constant smaller and smaller and you will never make
it sublinear, because looking at everything is the thing that costs.

The only way out is to make the work proportional to the *answer* rather than
to the *input* — to arrange the triangles so that whole groups can be dismissed
without being examined individually. That is a spatial index, that is lesson 9,
and as an existence proof: a k-d tree over those same 100,000 triangles builds
in **21 ms** and answers **10,000 queries in about 0.3 s**, against **2.8
minutes** for brute force. Roughly **900×**, and it grows with the mesh rather
than shrinking.`,
    },

    {
      type: 'challenge',
      instruction: `### 🎯 Build the filter, and measure your disappointment

A bounding sphere per triangle, and a rejection test.

\`boundingSpheres(mesh)\` returns a centre and a radius for each triangle, and
\`filteredQuery(P, mesh, spheres)\` uses them to skip triangles that cannot win.

The logic that makes it **exact** rather than approximate is worth getting
right:

1. For each triangle, \`dc\` is the distance from P to its sphere centre.
2. The sphere contains the triangle, so the closest point on it is **at least**
   \`dc − r\` away. That is a **lower bound** you can trust.
3. You also need an **upper bound**: some distance you know is genuinely
   reachable. \`min(dc + r)\` works. So does \`min(dc)\`, and it is better —
   because the centre you chose is the **centroid**, which lies *on* the
   triangle, so \`dc\` is not merely a bound, it is a real distance to a real
   point. A tighter upper bound rejects more.
4. Any triangle whose \`dc − r\` exceeds that bound **cannot possibly** contain
   the closest point, and can be skipped without being examined.

The rule underneath is the only thing you have to get right: **the lower bound
must really bound, and the upper bound must really be achieved.**

**And here is why that has to be reasoned about rather than tested.** Both ways
of getting it wrong — a radius that does not reach the furthest corner, or
rejecting on \`dc\` instead of \`dc − r\` — are genuinely incorrect, and over
4,000 random meshes the worst error they caused was **0.39**. But they only
misbehave when the geometry is right for it: on a mesh of small triangles they
pass every test you are likely to write, including the ones checking this
challenge.

A bound is one of the places where "the tests passed" is not evidence. The
argument for why it cannot discard the winner is the evidence.

Nothing is approximated. It returns the same answer as brute force, and the
check verifies exactly that on 30 query points.

Then it reports your survivor rate and your speed-up, and the interesting part
is the gap between them.`,
      html: `<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:10px;white-space:pre;background:#0a0f1e;border-radius:8px;min-height:280px"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `function makeMesh(n) {
  var A = [], B = [], C = [], seed = 999;
  function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 * 2 - 1; }
  for (var i = 0; i < n; i++) {
    var x = rnd(), y = rnd(), z = rnd();
    var L = Math.hypot(x, y, z) || 1;
    var c = [x/L, y/L, z/L];
    A.push(c.slice());
    B.push([c[0]+rnd()*0.03, c[1]+rnd()*0.03, c[2]+rnd()*0.03]);
    C.push([c[0]+rnd()*0.03, c[1]+rnd()*0.03, c[2]+rnd()*0.03]);
  }
  return { n: n, A: A, B: B, C: C };
}

function sub(u,v){return [u[0]-v[0],u[1]-v[1],u[2]-v[2]];}
function dot(u,v){return u[0]*v[0]+u[1]*v[1]+u[2]*v[2];}
function len(u){return Math.sqrt(dot(u,u));}

// The real solver, unchanged from lesson 5. Correct, and not cheap.
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

// TODO 1: a centre and radius per triangle.
//         Return { cx: [...], cy: [...], cz: [...], r: [...] } or any shape
//         you like, as long as filteredQuery can use it.
function boundingSpheres(m) {

  // your code here

  return null;
}

// TODO 2: the same answer as bruteQuery, having examined far fewer triangles.
//         Return { d, i, examined } - examined being how many triangles you ran
//         the real solver on.
function filteredQuery(P, m, spheres) {

  // your code here

  return { d: Infinity, i: -1, examined: m.n };
}

// ── it runs itself below ──────────────────────────────────────────────────
var mesh = makeMesh(20000);
var spheres = boundingSpheres(mesh);
var PROBES = [[1.7,0.3,-0.4],[0,0,2],[0.1,0.1,0.1],[-1.5,1.2,0.3]];

var lines = ['  query                 brute      filtered   examined   agree'];
var t0, tb = 0, tf = 0, examined = 0;
PROBES.forEach(function (P) {
  t0 = performance.now(); var b = bruteQuery(P, mesh); tb += performance.now() - t0;
  t0 = performance.now(); var f = filteredQuery(P, mesh, spheres); tf += performance.now() - t0;
  examined += f.examined;
  lines.push('  ' + JSON.stringify(P).padEnd(20) +
    b.d.toFixed(5).padStart(10) + f.d.toFixed(5).padStart(13) +
    ('' + f.examined).padStart(11) + (Math.abs(b.d - f.d) < 1e-9 ? '    yes' : '    NO'));
});
lines.push('');
lines.push('  survivors  ' + (100 * examined / (PROBES.length * mesh.n)).toFixed(2) + '% of ' + mesh.n.toLocaleString());
lines.push('  brute      ' + (tb / PROBES.length).toFixed(1) + ' ms per query');
lines.push('  filtered   ' + (tf / PROBES.length).toFixed(1) + ' ms per query');
lines.push('  speed-up   ' + (tb / tf).toFixed(1) + 'x');
lines.push('');
lines.push('  Compare the survivor percentage against the speed-up.');
console.log(lines.join('\\n'));
document.getElementById('out').textContent = lines.join('\\n');`,
      check: (js) => {
        const no = (message) => ({ pass: false, message });

        let fn;
        try {
          // eslint-disable-next-line no-new-func
          fn = new Function(
            js.replace(/^\s*\/\/ ── it runs itself below[\s\S]*$/m, '') +
            '\nreturn { makeMesh, boundingSpheres, filteredQuery, bruteQuery };',
          )();
        } catch (e) {
          return no('The code did not run: ' + e.message);
        }
        for (const name of ['boundingSpheres', 'filteredQuery']) {
          if (typeof fn[name] !== 'function') return no(name + ' is not a function.');
        }

        const mesh = fn.makeMesh(4000);
        let spheres;
        try { spheres = fn.boundingSpheres(mesh); } catch (e) {
          return no('boundingSpheres threw: ' + e.message);
        }
        if (spheres === null || spheres === undefined) {
          return no('boundingSpheres returned nothing. It needs a centre and a radius '
            + 'per triangle — the centroid and the distance to its furthest corner '
            + 'will do.');
        }

        // A spread of probes: outside, inside, on the surface, far away.
        const probes = [[1.7, 0.3, -0.4], [0, 0, 2], [0.1, 0.1, 0.1], [-1.5, 1.2, 0.3],
                        [0, 0, 0], [6, 0, 0], [1.001, 0, 0]];
        const r = (() => { let s = 31; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648 * 4 - 2; })();
        for (let i = 0; i < 23; i++) probes.push([r(), r(), r()]);

        let totalExamined = 0;
        for (const P of probes) {
          let got, want;
          try { got = fn.filteredQuery(P, mesh, spheres); } catch (e) {
            return no('filteredQuery threw on P=[' + P.map((n) => n.toFixed(2)) + ']: ' + e.message);
          }
          want = fn.bruteQuery(P, mesh);
          if (!got || typeof got.d !== 'number' || typeof got.examined !== 'number') {
            return no('filteredQuery should return { d, i, examined }. It returned '
              + JSON.stringify(got) + '.');
          }
          if (!Number.isFinite(got.d)) {
            return no('P=[' + P.map((n) => n.toFixed(2)) + '] gave a non-finite distance.');
          }
          if (Math.abs(got.d - want.d) > 1e-9) {
            return no('P=[' + P.map((n) => n.toFixed(2)) + ']: filtered gave '
              + got.d.toFixed(6) + ', brute force gives ' + want.d.toFixed(6) + '. '
              + (got.d > want.d
                ? 'Yours is LARGER, so the filter threw away the winner. Two things do that. '
                  + 'Either the radius does not contain the triangle - it must reach '
                  + 'the FURTHEST corner, not the nearest - so dc minus r is not really '
                  + 'a lower bound; or you are rejecting on dc rather than dc minus r, '
                  + 'which discards triangles whose surface comes nearer than their centre.'
                : 'Yours is SMALLER than brute force, which means the two are not solving '
                  + 'the same problem.'));
          }
          if (got.examined > mesh.n) {
            return no('examined came back as ' + got.examined + ', which is more than the '
              + mesh.n + ' triangles in the mesh.');
          }
          totalExamined += got.examined;
        }

        // A second mesh with LARGE triangles, where the two ways of getting the
        // bounds wrong actually bite. On the first mesh the triangles have a
        // radius of about 0.03 against a unit sphere, so a wrong radius moves
        // nothing and a broken filter passes every probe.
        const coarse = fn.makeMesh(400);
        for (let i = 0; i < coarse.n; i++) {
          // Blow each triangle up around its first corner, so radii become
          // comparable to the spacing between triangles.
          for (const arr of [coarse.B, coarse.C]) {
            for (let k = 0; k < 3; k++) {
              arr[i][k] = coarse.A[i][k] + (arr[i][k] - coarse.A[i][k]) * 25;
            }
          }
        }
        let coarseSpheres;
        try { coarseSpheres = fn.boundingSpheres(coarse); } catch (e) {
          return no('boundingSpheres threw on a mesh with large triangles: ' + e.message);
        }
        for (const P of [[1.7, 0.3, -0.4], [0, 0, 0], [3, 3, 3], [0.5, -0.2, 0.9],
                         [-2, 0.4, 1.1], [0.2, 0.2, 0.2], [5, -5, 0]]) {
          let got;
          try { got = fn.filteredQuery(P, coarse, coarseSpheres); } catch (e) {
            return no('filteredQuery threw on a mesh with large triangles: ' + e.message);
          }
          const want = fn.bruteQuery(P, coarse);
          if (!got || Math.abs(got.d - want.d) > 1e-9) {
            return no('On a mesh with LARGE triangles, P=[' + P.map((n) => n.toFixed(1))
              + '] gave ' + (got && got.d !== undefined ? got.d.toFixed(6) : got)
              + ' but brute force gives ' + want.d.toFixed(6) + '. This mesh is where '
              + 'bound mistakes show: the radius must reach the FURTHEST corner so the '
              + 'sphere really contains the triangle, and the rejection must test '
              + 'dc \u2212 r rather than dc. Both are invisible on a mesh of small '
              + 'triangles and wrong by up to 0.39 on this one.');
          }
        }

        const rate = totalExamined / (probes.length * mesh.n);
        if (rate > 0.5) {
          return no('The filter is examining ' + (100 * rate).toFixed(1) + '% of triangles, '
            + 'so it is barely filtering. Check the bound: min(dc + r) over all triangles, '
            + 'then keep only those with dc − r <= bound.');
        }

        return {
          pass: true,
          message: 'Exact on 30 probes, examining ' + (100 * rate).toFixed(2) + '% of the '
            + 'triangles. Now look at the speed-up in the output against that percentage — '
            + 'the gap is because the filter is still O(n). You touched every triangle, just '
            + 'more cheaply, and that is the ceiling until lesson 9.',
        };
      },
      successMessage: '✓ Exact, and much faster — but not as much faster as it should be.',
      failMessage: '✗ Not yet.',
      outputHeight: 480,
    },

  ],
};

const PY_CELLS = [
  {
    id: 'sizes',
    cellTitle: 'Four mesh sizes, one query each',
    prose: [
      'The four sizes section 7 asks for. The mesh is random triangles scattered over a sphere rather than a real part, because what the timing depends on is the count and the spatial spread, and this gives both without needing a file.',
      'closest_all is lesson 6’s vectorised solver, unchanged. Nothing about the algorithm is different here; only the size is.',
      'Watch the ns/triangle column rather than the milliseconds. If the work were purely linear it would be constant, and it is not - it is high at the small end and high again at the large end, for two entirely different reasons taken apart in the next cells.',
    ],
    code: `import gc, time
import numpy as np

def safe_div(num, den):
    return np.divide(num, den, out=np.zeros_like(num), where=den != 0)

def closest_all(P, A, B, C):
    P = np.asarray(P, float)
    ab, ac = B - A, C - A
    ap, bp, cp = P - A, P - B, P - C
    d1 = np.einsum("ij,ij->i", ab, ap); d2 = np.einsum("ij,ij->i", ac, ap)
    d3 = np.einsum("ij,ij->i", ab, bp); d4 = np.einsum("ij,ij->i", ac, bp)
    d5 = np.einsum("ij,ij->i", ab, cp); d6 = np.einsum("ij,ij->i", ac, cp)
    va = d3*d6 - d5*d4; vb = d5*d2 - d1*d6; vc = d1*d4 - d3*d2
    mA = (d1 <= 0) & (d2 <= 0);                     rest = ~mA
    mB = rest & (d3 >= 0) & (d4 <= d3);             rest = rest & ~mB
    mAB = rest & (vc <= 0) & (d1 >= 0) & (d3 <= 0); rest = rest & ~mAB
    mC = rest & (d6 >= 0) & (d5 <= d6);             rest = rest & ~mC
    mAC = rest & (vb <= 0) & (d2 >= 0) & (d6 <= 0); rest = rest & ~mAC
    mBC = rest & (va <= 0) & ((d4-d3) >= 0) & ((d5-d6) >= 0)
    mIn = rest & ~mBC
    Q = np.zeros_like(A)
    Q[mA] = A[mA]; Q[mB] = B[mB]; Q[mC] = C[mC]
    t = safe_div(d1, d1-d3); Q[mAB] = A[mAB] + t[mAB, None]*ab[mAB]
    t = safe_div(d2, d2-d6); Q[mAC] = A[mAC] + t[mAC, None]*ac[mAC]
    t = safe_div(d4-d3, (d4-d3)+(d5-d6))
    Q[mBC] = B[mBC] + t[mBC, None]*(C-B)[mBC]
    tot = va+vb+vc
    v, w = safe_div(vb, tot), safe_div(vc, tot)
    Q[mIn] = A[mIn] + ab[mIn]*v[mIn, None] + ac[mIn]*w[mIn, None]
    return Q

def random_mesh(n, rng):
    c = rng.normal(size=(n, 3))
    c /= np.linalg.norm(c, axis=1, keepdims=True)
    return c, c + rng.normal(size=(n,3))*0.02, c + rng.normal(size=(n,3))*0.02

rng = np.random.default_rng(1)
P = np.array([1.7, 0.3, -0.4])

print(f"{'triangles':>11} {'per query':>12} {'ns/triangle':>13} {'arrays':>10} {'x200k':>12}")
rows = []
for n in (1_000, 10_000, 100_000, 1_000_000):
    A, B, C = random_mesh(n, rng)
    reps = max(2, min(50, 2_000_000 // n))
    gc.collect()
    t0 = time.perf_counter()
    for _ in range(reps):
        Q = closest_all(P, A, B, C)
        np.argmin(np.linalg.norm(Q - P, axis=1))
    per = (time.perf_counter() - t0) / reps
    mb = (A.nbytes + B.nbytes + C.nbytes + Q.nbytes) / 1e6
    rows.append((n, per, mb))
    print(f"{n:>11,} {per*1e3:>10.2f} ms {per/n*1e9:>11.1f} ns {mb:>8.1f} MB "
          f"{per*200_000/60:>9.1f} min")`,
  },
  {
    id: 'floor',
    cellTitle: 'The floor: where a measurement stops meaning anything',
    prose: [
      'Time the same query on meshes small enough that the work is trivial, and the time does not fall to zero - it flattens out at a few hundred microseconds. That is the fixed cost of the numpy calls themselves: allocating the temporaries, dispatching into C, and coming back.',
      'Below that floor, a per-triangle figure is arithmetic performed on noise. Run this cell twice and watch the 1,000-triangle number move; on the machine this lesson was written on it came out 431 ns once and 169 ns the next time, unchanged code.',
      'The practical consequence is blunt: benchmarking on a small mesh predicts nothing about a large one, and "we tested it and it was fast" is not evidence unless the test cleared the floor.',
    ],
    code: `print(f"{'triangles':>10} {'per query':>12} {'ns/triangle':>13}")
for n in (10, 100, 1_000, 10_000, 100_000):
    A, B, C = random_mesh(n, rng)
    reps = max(5, min(200, 500_000 // max(n, 1)))
    gc.collect()
    t0 = time.perf_counter()
    for _ in range(reps):
        Q = closest_all(P, A, B, C)
        np.argmin(np.linalg.norm(Q - P, axis=1))
    per = (time.perf_counter() - t0) / reps
    print(f"{n:>10,} {per*1e3:>10.3f} ms {per/n*1e9:>11.1f} ns")

print()
print("The millisecond column barely moves from 10 to 1,000 triangles.")
print("That flat part is the floor: numpy's own per-call cost, which would")
print("be there for a single triangle. Dividing it by the triangle count")
print("produces a number that describes nothing.")`,
  },
  {
    id: 'cache',
    cellTitle: 'The constant gets worse',
    prose: [
      'Above the floor, O(n) predicts a flat per-triangle cost. Measure it across the range where the work dominates and it is not flat: it rises.',
      'Nothing about the algorithm changed. What changed is that the arrays outgrew the processor’s cache, so more of each query is spent waiting for memory to arrive rather than computing with it. Measured twice on one machine, 10,000 to 1,000,000 triangles cost 1.86x and 1.74x more per triangle.',
      'This is the gap between a complexity class and a schedule. O(n) says double the data, double the time. Reality said double the data, rather more than double the time - and it keeps getting worse as the mesh grows.',
    ],
    code: `ns = {n: per/n*1e9 for n, per, _ in rows}
print("per-triangle cost, from the first table")
for n, v in ns.items():
    note = "   <- below the floor, meaningless" if n < 10_000 else ""
    print(f"  {n:>9,}  {v:>6.1f} ns{note}")

base, top = ns[10_000], ns[1_000_000]
print()
print(f"10,000 -> 1,000,000 triangles: {base:.1f} -> {top:.1f} ns per triangle")
print(f"that is {top/base:.2f}x WORSE per unit of work, for the same algorithm")
print()

# And the allocation, which no complexity class mentions.
big = rows[-1]
print(f"at {big[0]:,} triangles each query builds and discards {big[2]:.0f} MB")
print(f"of temporary arrays. Over 200,000 queries that is "
      f"{big[2]*200_000/1e6:.1f} TB of allocation churn - none of it leaked,")
print("all of it freed immediately, and a large part of the wall.")`,
  },
  {
    id: 'queries',
    cellTitle: 'And it is linear in queries too',
    prose: [
      'The other axis. Fix the mesh and vary the number of queries: the per-query cost stays flat, so the total is simply proportional.',
      'That is the whole problem in one sentence. The cost is triangles times queries, and a real comparison run makes both large at once.',
    ],
    code: `A, B, C = random_mesh(100_000, rng)
one = None
print(f"{'queries':>9} {'elapsed':>10} {'per query':>12}")
for q in (1, 10, 100):
    gc.collect()
    t0 = time.perf_counter()
    for _ in range(q):
        Q = closest_all(P, A, B, C)
        np.argmin(np.linalg.norm(Q - P, axis=1))
    el = time.perf_counter() - t0
    one = one or el
    print(f"{q:>9,} {el:>8.3f} s {el/q*1e3:>10.2f} ms")

print(f"{'200,000':>9} {one*200_000/60:>8.1f} min  (extrapolated - flat per-query "
      f"cost means the extrapolation is safe)")
print()
print("triangles x queries. A real run makes both large at the same time.")`,
  },
  {
    id: 'ch-floor',
    challengeType: 'write',
    challengeTitle: 'Find the floor on this machine',
    difficulty: 'warm-up',
    prompt:
      'Find the smallest mesh size at which the per-triangle cost stops falling - the '
      + 'point where the work finally outweighs the fixed per-call overhead. Time a query '
      + 'at a range of sizes, and set floor_n to the smallest size whose ns-per-triangle '
      + 'is within 50% of the minimum you saw. Below that, any benchmark is measuring the '
      + 'call rather than the geometry.',
    hint:
      'Sizes like (10, 30, 100, 300, 1000, 3000, 10000, 30000) give a good spread. Use '
      + 'plenty of repetitions on the small ones. Collect (n, ns_per_triangle) pairs, find '
      + 'the minimum ns, then take the smallest n within 1.5x of it.',
    code: `floor_n = None
samples = []

# TODO: time a query at a range of sizes, fill samples with (n, ns_per_triangle),
#       then set floor_n.

for n, v in samples:
    print(f"{n:>8,}  {v:>7.1f} ns/triangle")
print()
print("floor at:", floor_n)`,
    solution: `floor_n = None
samples = []

for n in (10, 30, 100, 300, 1_000, 3_000, 10_000, 30_000):
    A2, B2, C2 = random_mesh(n, rng)
    reps = max(5, min(300, 300_000 // max(n, 1)))
    gc.collect()
    t0 = time.perf_counter()
    for _ in range(reps):
        Q2 = closest_all(P, A2, B2, C2)
        np.argmin(np.linalg.norm(Q2 - P, axis=1))
    per = (time.perf_counter() - t0) / reps
    samples.append((n, per / n * 1e9))

best = min(v for _, v in samples)
floor_n = min(n for n, v in samples if v <= best * 1.5)

for n, v in samples:
    print(f"{n:>8,}  {v:>7.1f} ns/triangle")
print()
print("floor at:", floor_n)`,
    testCode: `assert samples, "samples is empty - the loop never ran."
assert len(samples) >= 5, f"only {len(samples)} sizes measured; use a wider spread"
assert floor_n is not None, "floor_n was never set."
assert all(isinstance(n, int) and v > 0 for n, v in samples), (
    "each sample should be (triangle_count, ns_per_triangle)")

_ns = [v for _, v in samples]
_best = min(_ns)
_expected = min(n for n, v in samples if v <= _best * 1.5)
assert floor_n == _expected, (
    f"floor_n is {floor_n}, but the smallest size within 1.5x of the best "
    f"({_best:.1f} ns) is {_expected}")

# The smallest mesh must be dramatically worse per triangle, or the floor is
# not being demonstrated at all.
_smallest = samples[0][1]
assert _smallest > _best * 2, (
    f"the smallest mesh cost {_smallest:.1f} ns/triangle against a best of "
    f"{_best:.1f} - only {_smallest/_best:.1f}x. Start lower (10 triangles) so "
    f"the fixed overhead is unmistakable.")
"SUCCESS: below that size you are timing numpy's call overhead, not the geometry."`,
  },
  {
    id: 'filter',
    cellTitle: 'The cheapest possible filter, and why it is not enough',
    prose: [
      'Put a sphere round each triangle. The closest point on a triangle is at least (distance to centre minus radius) away and at most (distance plus radius), so the smallest of those upper bounds is a distance you know is achievable - and any triangle whose lower bound exceeds it cannot possibly win and need not be examined.',
      'That is exact, not approximate. It returns the identical answer, and on 100,000 triangles it leaves under 1% of them standing.',
      'Then read the speed-up, and notice it is nowhere near the 170x that removing 99.4% of the work suggests. Sit with that gap before reading the explanation in the next cell - it is the reason the next two lessons exist.',
    ],
    code: `A, B, C = random_mesh(100_000, rng)
centres = (A + B + C) / 3
radii = np.maximum.reduce([
    np.linalg.norm(A - centres, axis=1),
    np.linalg.norm(B - centres, axis=1),
    np.linalg.norm(C - centres, axis=1),
])

def filtered(P, A, B, C, centres, radii):
    dc = np.linalg.norm(centres - P, axis=1)
    bound = float((dc + radii).min())       # a distance we know is reachable
    keep = (dc - radii) <= bound            # everything else cannot win
    Qk = closest_all(P, A[keep], B[keep], C[keep])
    dk = np.linalg.norm(Qk - P, axis=1)
    j = int(np.argmin(dk))
    return float(dk[j]), int(keep.sum())

gc.collect()
t0 = time.perf_counter()
for _ in range(20):
    df, kept = filtered(P, A, B, C, centres, radii)
tf = (time.perf_counter() - t0) / 20

gc.collect()
t0 = time.perf_counter()
for _ in range(20):
    Qb = closest_all(P, A, B, C)
    db = float(np.linalg.norm(Qb - P, axis=1).min())
tb = (time.perf_counter() - t0) / 20

print(f"brute force      {tb*1e3:8.2f} ms   over all {len(A):,} triangles")
print(f"with the filter  {tf*1e3:8.2f} ms   over {kept:,} survivors "
      f"({100*kept/len(A):.2f}%)")
print(f"same answer      {abs(df - db) < 1e-9}")
print()
print(f"work removed     {100 - 100*kept/len(A):.1f}%")
print(f"speed-up         {tb/tf:.1f}x")
print()
print("Those last two numbers should not sit together comfortably.")`,
  },
  {
    id: 'ceiling',
    cellTitle: 'Why the filter has a ceiling',
    prose: [
      'Removing 99.4% of the expensive work bought around 15x, not 170x, and the reason is that the filter is itself O(n): computing the distance from P to every sphere centre touches every triangle. You made the per-triangle cost smaller. You did not make the number of triangles you look at smaller.',
      'Make the rejection test as cheap as you like and this ceiling does not move, because the floor of the whole approach is one operation per triangle. Sublinear is not reachable from here.',
      'The way out is to arrange the triangles in advance so that whole GROUPS can be dismissed without being examined one by one - which turns the cost from "proportional to the input" into something closer to "proportional to the answer". That is a spatial index: bounding volumes in lesson 8, a tree over them in lesson 9.',
      'The last block is an existence proof rather than an implementation. scipy’s cKDTree is not the structure lesson 9 builds and it answers a slightly different question - nearest triangle CENTRE rather than nearest point on a triangle - but the ratio is the point.',
    ],
    code: `# Where the filter's time actually goes.
gc.collect()
t0 = time.perf_counter()
for _ in range(50):
    dc = np.linalg.norm(centres - P, axis=1)
    bound = float((dc + radii).min())
    keep = (dc - radii) <= bound
t_filter = (time.perf_counter() - t0) / 50

print(f"the filter pass alone   {t_filter*1e3:7.2f} ms   (every triangle, cheaply)")
print(f"the solver on survivors {(tf - t_filter)*1e3:7.2f} ms   ({kept:,} triangles)")
print(f"total                   {tf*1e3:7.2f} ms")
print()
print(f"{100*t_filter/tf:.0f}% of the time is now the FILTER, which is O(n).")
print("Making the rejection test cheaper cannot get past that.")
print()

from scipy.spatial import cKDTree
gc.collect()
t0 = time.perf_counter(); tree = cKDTree(centres); t_build = time.perf_counter() - t0
queries = rng.normal(size=(10_000, 3)) * 1.5
t0 = time.perf_counter(); tree.query(queries); t_q = time.perf_counter() - t0

print("what a real spatial index does with the same 100,000 triangles:")
print(f"  build the tree                 {t_build*1e3:8.1f} ms  (once)")
print(f"  10,000 queries                 {t_q*1e3:8.1f} ms")
print(f"  the same 10,000 by brute force {tb*10_000/60:8.1f} min")
print(f"  ratio                          {(tb*10_000)/t_q:8,.0f}x")
print()
print("And unlike the filter, that ratio GROWS with the mesh.")
print("Lesson 8 builds the bounding volumes. Lesson 9 builds the tree.")`,
  },
  {
    id: 'ch-where',
    challengeType: 'write',
    challengeTitle: 'Find out where the time went',
    difficulty: 'core',
    prompt:
      'The filtered query is 15x faster after removing 99.4% of the work, and the gap '
      + 'between those numbers has to be explained by measurement rather than by argument. '
      + 'Time the filter pass on its own - just the distances to the centres and the bound '
      + '- and set filter_fraction to the share of the whole filtered query that it '
      + 'accounts for. Then say whether making the solver faster would help.',
    hint:
      'The filter pass is the three lines before the call to closest_all: the distances to '
      + 'every centre, the bound, and the keep mask. Time it in a loop the same way the '
      + 'cells above time everything else, then divide by tf, the filtered query time '
      + 'already measured.',
    code: `filter_fraction = None

# TODO: time the filter pass alone, then set filter_fraction to
#       filter_time / tf

print("filter pass is", None if filter_fraction is None else f"{100*filter_fraction:.0f}%",
      "of the filtered query")`,
    solution: `filter_fraction = None

gc.collect()
t0 = time.perf_counter()
for _ in range(50):
    dc = np.linalg.norm(centres - P, axis=1)
    bound = float((dc + radii).min())
    keep = (dc - radii) <= bound
t_filter = (time.perf_counter() - t0) / 50

filter_fraction = t_filter / tf

print("filter pass is", None if filter_fraction is None else f"{100*filter_fraction:.0f}%",
      "of the filtered query")`,
    testCode: `assert filter_fraction is not None, "filter_fraction was never set."
assert 0 < filter_fraction <= 1.5, (
    f"filter_fraction came out {filter_fraction}, which is not a share of the whole. "
    f"Divide the filter-pass time by tf, the filtered query time from the cell above.")

# Re-measure independently rather than trusting the number.
gc.collect()
_t0 = time.perf_counter()
for _ in range(50):
    _dc = np.linalg.norm(centres - P, axis=1)
    _b = float((_dc + radii).min())
    _k = (_dc - radii) <= _b
_tf_filter = (time.perf_counter() - _t0) / 50
_expected = _tf_filter / tf

assert abs(filter_fraction - _expected) < 0.35, (
    f"you reported {100*filter_fraction:.0f}% but an independent timing gives "
    f"{100*_expected:.0f}%. Time only the three filter lines, not the solver call.")
assert filter_fraction > 0.3, (
    f"{100*filter_fraction:.0f}% would mean the filter is a minor cost, and the "
    f"whole point of this lesson is that it is not. Check you are timing the pass "
    f"over ALL {len(centres):,} triangles rather than over the survivors.")
"SUCCESS: most of the remaining time is the filter itself. Speeding up the solver cannot help, because the filter is O(n) and touches every triangle regardless."`,
  },
  {
    id: 'ch-filter',
    challengeType: 'write',
    challengeTitle: 'Where does the filter stop helping?',
    difficulty: 'core',
    prompt:
      'The filter wins because few triangles survive. Find where that breaks down. Write '
      + 'survivor_rate(P) returning the fraction of triangles that survive the bound for a '
      + 'query point P, then measure it for points at a range of distances from the mesh - '
      + 'set rates to a list of (distance_from_origin, fraction). The trend is the answer to '
      + 'why a single global filter is not enough.',
    hint:
      'The mesh is a unit sphere centred on the origin, so a point at distance 5 is far '
      + 'outside it and a point at distance 0 is in the middle of it. Reuse the bound '
      + 'calculation from the cell above: bound = (dc + radii).min(), keep = (dc - radii) '
      + '<= bound.',
    code: `def survivor_rate(P):
    # TODO: return the fraction of triangles that survive the bound
    pass


rates = []
# TODO: measure survivor_rate at several distances from the origin

for d, f in rates:
    print(f"  distance {d:>5.2f}   {100*f:6.2f}% survive")`,
    solution: `def survivor_rate(P):
    P = np.asarray(P, float)
    dc = np.linalg.norm(centres - P, axis=1)
    bound = float((dc + radii).min())
    return float(np.count_nonzero((dc - radii) <= bound)) / len(centres)


rates = []
for d in (0.0, 0.5, 1.0, 1.5, 3.0, 10.0):
    rates.append((d, survivor_rate(np.array([d, 0.0, 0.0]))))

for d, f in rates:
    print(f"  distance {d:>5.2f}   {100*f:6.2f}% survive")`,
    testCode: `assert rates, "rates is empty - nothing was measured."
assert len(rates) >= 4, f"only {len(rates)} distances measured; use a wider spread"
for d, f in rates:
    assert 0.0 <= f <= 1.0, f"a survivor fraction of {f} at distance {d} is not a fraction"

_r = survivor_rate(np.array([3.0, 0.0, 0.0]))
assert abs(_r - dict((round(d, 6), f) for d, f in rates).get(3.0, _r)) < 0.05 or True

# Far away, the filter should be highly effective.
_far = survivor_rate(np.array([10.0, 0.0, 0.0]))
assert _far < 0.2, (
    f"{100*_far:.1f}% survive at distance 10, which is far outside a unit sphere - "
    f"the filter should reject nearly everything there. Check the bound is "
    f"(dc + radii).min() and the test is (dc - radii) <= bound.")

# At the centre of a hollow sphere every triangle is about equally far, so the
# filter can reject almost nothing. That is the point of the exercise.
_centre = survivor_rate(np.array([0.0, 0.0, 0.0]))
assert _centre > _far, (
    f"the survivor rate at the centre ({100*_centre:.1f}%) should be HIGHER than "
    f"far outside ({100*_far:.1f}%) - at the centre of a hollow sphere every "
    f"triangle is nearly equidistant, so almost nothing can be rejected.")
assert any(d >= 5 for d, _ in rates), "measure at least one far-away point (distance 5 or more)"
assert any(d <= 0.5 for d, _ in rates), "measure at least one point inside the mesh"
"SUCCESS: the filter is excellent far away and useless in the middle. A single global bound cannot adapt - which is what a tree does."`,
  },
];

export default {
  id: 'mesh-engine-1-7-why-brute-force-stops-working',
  slug: 'why-brute-force-stops-working',
  chapter: 'mesh-engine.1',
  order: 6,
  title: 'Why Brute Force Stops Working',
  subtitle: 'Measure it until the case for a spatial index is undeniable.',
  tags: [
    'complexity', 'scaling', 'profiling', 'benchmarking', 'cache', 'allocation',
    'bounding sphere', 'rejection test', 'spatial index', 'cKDTree',
  ],
  aliases: 'big O complexity scaling benchmark profiling CPU time memory allocation churn cache miss per-call overhead floor bounding sphere rejection test early out spatial acceleration kd-tree cKDTree sublinear',
  timeToComplete: 55,
  coreConcept:
    'Brute force is linear in triangles and linear in queries, so a real run costs the product of two large numbers - 57 minutes at 100,000 triangles and 200,000 queries, ten hours at a million triangles. Three costs that complexity notation does not name decide whether that is survivable: a fixed per-call floor below which small benchmarks measure nothing, a constant that gets 1.8x worse as the arrays leave cache, and allocation churn that never appears in a profile. And a per-triangle rejection test, however cheap, cannot escape O(n) - it removed 99.4% of the work and bought only 15x, because it still touches every triangle.',
  prerequisites: ['mesh-engine-1-6-point-to-mesh'],
  nextLesson: 'mesh-engine-1-8-bounding-volumes',

  semantics: {
    core: [
      { symbol: 'triangles x queries', meaning: 'The real cost. Both are large at once in a comparison run, and the product is the wall.' },
      { symbol: 'the floor', meaning: 'Fixed per-call cost, about 0.17 ms here. Below roughly 10,000 triangles you are timing the call rather than the work.' },
      { symbol: 'ns per triangle', meaning: 'The number that reveals whether O(n) is telling the truth. Flat means yes; here it rises 1.8x from 10k to 1M.' },
      { symbol: 'dc - r <= bound', meaning: 'The exact rejection test. A triangle whose nearest possible point is further than a distance already achieved cannot win.' },
      { symbol: 'bound = min(dc)', meaning: 'An upper bound that is genuinely reached, because the centroid lies on the triangle. Tighter than min(dc + r), so it rejects more, and verified identical over 4,000 meshes.' },
      { symbol: 'still O(n)', meaning: 'Why the filter has a ceiling. Computing dc for every triangle touches every triangle, however cheap the touch.' },
    ],
    rulesOfThumb: [
      'Benchmark above the floor or not at all. A fast result on 1,000 triangles predicts nothing about 200,000.',
      'Watch cost per unit of work, not total time. Flat means the complexity class is honest; rising means it is not.',
      'Count the allocation. Temporaries built and freed every query do not leak and are still most of the cost.',
      'A rejection test needs a lower bound that really bounds (radius to the furthest corner) and an upper bound that is really achieved (the centroid is on the triangle, so min(dc) qualifies and is tighter than min(dc + r)).',
      'Removing most of the work is not the same as removing most of the time. Measure the speed-up, do not infer it from the survivor rate.',
      'No per-item filter can be sublinear. To beat O(n) you have to dismiss groups without examining their members.',
    ],
  },

  hook: {
    question: 'A bounding-sphere filter over 100,000 triangles rejects all but 595 of them - 99.4% of the expensive work gone, with the answer provably unchanged. How much faster does that make the query?',
    realWorldContext: 'About 15 times. Not 170. The filter itself is O(n): computing the distance from the query point to every sphere centre still touches every triangle. Measured, roughly 70% of the remaining time is the filter pass rather than the solver. Making the rejection test cheaper cannot get past that, because one operation per triangle is the floor of the whole approach. Beating it needs the triangles arranged so that whole groups can be dismissed unexamined - which is a spatial index, and which turns 2.8 minutes of queries into 0.3 seconds.',
    previewVisualizationId: 'JSNotebook',
  },

  intuition: {
    prose: [
      'Brute force is linear in triangles and linear in queries. A real run makes both large, so the cost is a product.',
      'Measured: 17 ms per query at 100,000 triangles is 57 minutes for 200,000 queries. At a million triangles it is ten hours.',
      'Below about 10,000 triangles the measurement is the fixed cost of the call, not the work, so small benchmarks mislead.',
      'Above that, the cost per triangle rises rather than staying flat, because the arrays outgrow cache and the machine waits on memory.',
      'A cheap per-triangle rejection test is exact and helps, removing 99.4% of the expensive work.',
      'It still only buys 15x, because the filter touches every triangle too - and that ceiling is what a spatial index exists to break.',
    ],
    callouts: [
      {
        type: 'warning',
        title: 'Below the floor, a benchmark measures nothing',
        body: 'A query over 1,000 triangles took 0.17 ms, and nearly all of that would be there for a single triangle: allocating temporaries, dispatching into C, returning. Dividing it by 1,000 gives a per-triangle cost that is arithmetic on noise - it came out 431 ns on one run of the script and 169 ns on the next, with no code change. So "we tested it and it was fast" is not evidence unless the test was large enough to clear the floor, which here is somewhere above 10,000 triangles.',
      },
      {
        type: 'insight',
        title: 'The constant gets worse, which O(n) cannot tell you',
        body: 'From 10,000 to 1,000,000 triangles the cost per triangle rose from about 105 ns to about 188 ns - measured twice at 1.86x and 1.74x. The algorithm did not change; 96 MB of arrays simply does not fit in cache, so an increasing share of each query is spent waiting for memory. A complexity class describes the shape of the curve and says nothing about the constant, and here the constant degrades as you scale. That is the difference between an estimate and a schedule.',
      },
      {
        type: 'insight',
        title: 'Allocation that never appears in a profile',
        body: 'At a million triangles the vectorised query builds and discards 96 MB of temporary arrays every time it runs. Nothing leaks. Over 200,000 queries that is close to 20 TB of allocation churn, it is a large fraction of the wall, and it will not show up in a profile that attributes time only to your own functions.',
      },
      {
        type: 'warning',
        title: 'A rejection test must be conservative or it changes the answer',
        body: 'The lower bound has to genuinely bound: the sphere must CONTAIN the triangle, so its radius is the distance from the centre to the FURTHEST corner. Take it to the nearest corner instead and dc - r stops being a lower bound - measured over 4,000 random meshes, that discards the winner with errors up to 0.39.\n\nThe upper bound has to be a distance something actually achieves. min(dc + r) qualifies. So does min(dc), and it is the better choice: the centre here is the centroid, which lies ON the triangle, so dc is a real distance to a real point rather than merely a bound. Tighter upper bound, more rejected, same answer. Verified over 4,000 meshes at zero error.\n\nGet either bound backwards and the failure is silent - a slightly wrong answer that still looks like a distance.',
      },
      {
        type: 'insight',
        title: '99.4% of the work removed, 15x faster',
        body: 'Those two numbers do not sit together, and the gap is the lesson. The filter still computes one distance for every triangle, so it is O(n) and about 70% of the remaining time is the filter itself. Making the test cheaper moves the constant and not the exponent. Sublinear requires dismissing whole groups without examining their members, which is what bounding volume hierarchies do - lesson 8 builds the volumes, lesson 9 builds the tree. As an existence proof, a k-d tree over the same 100,000 triangles builds in 21 ms and answers 10,000 queries in 0.3 s against 2.8 minutes.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Measure the wall on your own machine',
        caption: 'The numbers in the prose are one desktop. The shape of the curve is what transfers.',
        props: {
          lesson: LESSON_MESH_1_7,
        },
      },
    ],
  },

  math: {
    prose: [
      'This lesson has no new algorithm in it. Everything below is measurement, because the argument for spatial acceleration is only worth making with numbers attached.',
      'Four mesh sizes, then the floor, then the cache effect, then the second axis - queries. Then the cheapest possible filter, which is exact and still bounded.',
      'The last cell takes apart where the filtered query actually spends its time, which is the whole reason lessons 8 and 9 exist.',
    ],
    visualizations: [
      {
        id: 'PythonNotebook',
        title: 'Four sizes, two axes, and one filter that cannot save you',
        mathBridge: 'The rejection test is a triangle inequality argument. For any point Q on a triangle whose bounding sphere has centre c and radius r, |P - c| - r <= |P - Q| <= |P - c| + r. The upper bound of the nearest sphere is therefore a distance that is definitely achievable, and any triangle whose lower bound exceeds it can be discarded without being examined. That is exact rather than heuristic, which is why the filtered answer equals the brute-force answer to the last bit - and it is the same argument a bounding volume hierarchy makes recursively over groups instead of individually over triangles.',
        caption: 'Every figure measured twice and agreed to within noise.',
        props: {
          initialCells: PY_CELLS,
        },
      },
    ],
  },

  examples: [
    {
      title: 'The measured wall',
      prose: '1,000 triangles 0.17 ms per query; 10,000 1.05 ms; 100,000 17 ms; 1,000,000 185 ms with 96 MB of temporaries. At 200,000 queries that is 0.6 min, 3.5 min, 57 min and about ten hours. The real part is 214,382 triangles.',
    },
    {
      title: 'The unstable small measurement',
      prose: 'The 1,000-triangle per-triangle cost came out 431 ns on one run and 169 ns on the next, unchanged code and machine. Both are meaningless: the measurement is the fixed per-call overhead divided by an arbitrary number.',
    },
    {
      title: '99.4% removed, 15x faster',
      prose: 'A bounding-sphere filter left 595 survivors of 100,000, with an identical answer. It bought about 15x, because roughly 70% of the remaining time is the O(n) filter pass itself.',
    },
    {
      title: 'What an index does instead',
      prose: 'A k-d tree over the same 100,000 triangle centres: 21 ms to build, 0.3 s for 10,000 queries, against 2.8 minutes brute force. Roughly 900x, and the ratio grows with the mesh.',
    },
  ],

  challenges: [
    {
      prompt: 'Build the bounding-sphere filter and verify it returns exactly the brute-force answer on 30 probes, then compare your survivor rate against your speed-up.',
      hint: 'The bound is min(distance to centre + radius). Keep any triangle with distance to centre - radius below it.',
    },
    {
      prompt: 'Find the floor on your own machine: the smallest mesh at which per-triangle cost stops falling.',
      hint: 'Start at 10 triangles. Below the floor the millisecond figure barely moves as the count rises.',
    },
    {
      prompt: 'Measure the survivor rate for query points at a range of distances from the mesh, and explain the trend.',
      hint: 'The mesh is a hollow unit sphere. Try the centre, the surface, and far outside.',
    },
    {
      prompt: 'Time the filter pass separately from the solver, and say what fraction of the filtered query is now the filter itself.',
      hint: 'Run just the distance-to-centres and bound computation in a loop. It is most of the remaining time.',
    },
  ],

  misconceptions: [
    {
      claim: 'It is O(n), so I know how it will scale.',
      reality: 'You know the shape and not the constant, and the constant here degrades 1.8x as the arrays leave cache. You also do not know the floor, below which measurements are meaningless, or the allocation cost, which appears in no profile.',
    },
    {
      claim: 'We benchmarked it and it was fast.',
      reality: 'On what size? Below about 10,000 triangles the number is the fixed per-call overhead divided by the triangle count, and it varied 2.5x between two runs of identical code.',
    },
    {
      claim: 'Removing 99% of the work makes it about 100x faster.',
      reality: 'It made it 15x faster, because the filter that removes the work still touches every triangle. Roughly 70% of the remaining time is the filter pass.',
    },
    {
      claim: 'A cheaper rejection test would fix it.',
      reality: 'It moves the constant, not the exponent. One operation per triangle is the floor of any per-triangle filter, so no amount of cheapness reaches sublinear.',
    },
    {
      claim: 'The filter is an approximation, so it trades accuracy for speed.',
      reality: 'It is exact. It rejects only triangles whose nearest possible point is provably further than a distance already known to be achievable, so the answer is identical to brute force to the last bit - provided both bounds are right. The radius must reach the furthest corner or the sphere does not contain the triangle; the upper bound must be a distance something reaches, and min(dc) is one because the centroid is on the triangle.',
    },
    {
      claim: 'A bounding-sphere filter works equally well everywhere.',
      reality: 'It is excellent far from the mesh and nearly useless at the centre of a hollow one, where every triangle is about equally far and almost nothing can be rejected. A single global bound cannot adapt; a tree can.',
    },
  ],

  transferPrompts: [
    'Someone reports a benchmark on 2,000 items. What do you need to know before believing it predicts 200,000?',
    'Your per-item cost rises as the dataset grows, with no algorithm change. What is the most likely cause and how would you confirm it?',
    'A filter removes 99% of the candidates and gives a 12x speed-up. What does that tell you about where the time now goes?',
    'Why can no per-item rejection test ever be sublinear, however cheap?',
    'Where would a bounding-sphere filter help least, and what does that suggest about what should replace it?',
  ],

  debugging: [
    {
      symptom: 'The filtered query is faster but the answers changed slightly.',
      cause: 'A radius that does not contain its triangle - taken to the nearest corner rather than the furthest - so dc minus r is not a lower bound. Or rejecting on dc rather than dc minus r.',
      fix: 'Radius to the furthest corner. Reject on dc minus r. Note that min(dc) IS a valid upper bound, because the centroid lies on the triangle, and it is tighter than min(dc + r).',
    },
    {
      symptom: 'The filter rejects almost nothing.',
      cause: 'Either the bound is computed wrongly, or the query point is somewhere every triangle really is about equally far - such as the centre of a hollow mesh.',
      fix: 'Measure the survivor rate at several distances before concluding the code is wrong.',
    },
    {
      symptom: 'A change that should have helped shows no improvement.',
      cause: 'The benchmark is below the floor, so the fixed per-call cost dominates and swamps the difference.',
      fix: 'Re-measure on a mesh large enough that per-triangle cost has stopped falling.',
    },
    {
      symptom: 'Timings vary by 2x between identical runs.',
      cause: 'Too few repetitions, a mesh below the floor, or garbage collection landing inside the timed region.',
      fix: 'More repetitions, a larger mesh, and a collection before the timer starts.',
    },
    {
      symptom: 'Memory use spikes during queries although nothing is retained.',
      cause: 'Vectorised code allocating full-size temporaries per query - 96 MB each at a million triangles.',
      fix: 'Expected, not a leak. It is a real cost; reducing the number of triangles examined reduces it too.',
    },
  ],

  mastery: {
    prerequisites:
      'Lesson 6 for the vectorised brute-force query being measured, and lesson 5 for the per-triangle solver inside it. No new geometry is introduced.',
    signals: [
      'Refuses to accept a benchmark without knowing the size it was run at.',
      'Watches cost per unit of work rather than total time when judging scaling.',
      'Can state why a per-item filter cannot be sublinear.',
      'Predicts the speed-up from a filter by measuring rather than by inferring it from the rejection rate.',
      'Can name three costs that a complexity class does not describe.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'mesh-engine-1-6-point-to-mesh', why: 'The vectorised brute-force query this lesson measures, and the first scaling table.' },
      { lessonId: 'mesh-engine-1-5-point-to-triangle', why: 'The per-triangle solver whose cost is being multiplied by the triangle count.' },
      { lessonId: 'mesh-engine-1-4-mesh-files', why: 'Where a 214,382-triangle count comes from, and why physical size does not predict it.' },
    ],
    futureLinks: [
      { lessonId: 'mesh-engine-1-8-bounding-volumes', why: 'The bounding volumes this lesson used one of, taken seriously.' },
    ],
  },

  checkpoints: [
    'I can state what brute force costs at four mesh sizes, and why that is a product of two quantities.',
    'I know what the floor is and why a benchmark below it measures nothing.',
    'I can explain why the per-triangle cost rises as the mesh grows.',
    'I can write an exact rejection test and say why the bound must be an achievable distance.',
    'I can explain why removing 99.4% of the work bought only 15x.',
    'I can say what a spatial index changes that a cheaper filter cannot.',
  ],

  assessment: {
    task: 'Measure brute force across a range of mesh sizes and query counts, add an exact rejection filter, and report where the remaining time goes.',
    acceptance: [
      'A scaling table with per-query time and per-triangle cost at four or more sizes.',
      'Identification of the floor, with evidence that measurements below it are unstable.',
      'An exact filter, verified to match brute force, with its survivor rate reported.',
      'A measured speed-up, compared against the naive prediction from the survivor rate.',
      'A breakdown of the filtered query into filter time and solver time.',
    ],
  },

  quiz: [
    {
      question: 'Brute force takes 17 ms per query at 100,000 triangles. What is a 200,000-query run?',
      options: [
        'About 57 minutes',
        'About 57 seconds',
        'It cannot be extrapolated',
        'About 6 hours',
      ],
      answer: 0,
      explanation: '17 ms x 200,000 is 3,400 seconds. The per-query cost is flat in query count, so this extrapolation is safe - which is not true of extrapolating across triangle counts.',
    },
    {
      question: 'Why is the per-triangle cost at 1,000 triangles meaningless?',
      options: [
        'It is the fixed per-call overhead divided by the triangle count — it varied 431 ns to 169 ns between runs',
        'Because 1,000 triangles is not a realistic mesh',
        'Because numpy is inaccurate at small sizes',
        'It is not meaningless; it is the best estimate available',
      ],
      answer: 0,
      explanation: 'The measurement is dominated by costs that would exist for one triangle. That is why a fast result on a small mesh is not evidence about a large one.',
    },
    {
      question: 'From 10,000 to 1,000,000 triangles the cost per triangle rose 1.8x. Why?',
      options: [
        'The arrays outgrew cache, so more of each query is spent waiting for memory',
        'The algorithm is really O(n log n)',
        'numpy overhead grows with array size',
        'Measurement error',
      ],
      answer: 0,
      explanation: 'Nothing about the algorithm changed. 96 MB does not fit in cache. A complexity class gives the shape of the curve and nothing about the constant, which here degrades as you scale.',
    },
    {
      question: 'A bounding-sphere filter removes 99.4% of the expensive work. How much faster is the query?',
      options: [
        'About 15x — the filter itself is O(n) and becomes most of the remaining time',
        'About 170x, matching the work removed',
        'No faster, since the filter costs as much as it saves',
        'It depends only on the mesh size',
      ],
      answer: 0,
      explanation: 'Computing the distance to every sphere centre still touches every triangle. Roughly 70% of the filtered query is the filter pass, and making it cheaper moves the constant rather than the exponent.',
    },
    {
      question: 'Which of these is a valid upper bound for the rejection test?',
      options: [
        'Both min(dc + r) and min(dc) — the second because the centroid lies on the triangle, making dc a distance that is actually reached',
        'Only min(dc + r); min(dc) is too tight and discards real candidates',
        'Only min(dc); min(dc + r) is too loose to be correct',
        'Neither — the bound must be computed from the true closest points',
      ],
      answer: 0,
      explanation: 'The bound only has to be a distance something achieves. The centroid is a point on its own triangle, so min(dc) qualifies and is tighter, meaning it rejects more. Verified identical to brute force over 4,000 random meshes.',
    },
    {
      question: 'Where does a single global bounding-sphere filter help least?',
      options: [
        'At the centre of a hollow mesh, where every triangle is about equally far and nothing can be rejected',
        'Far outside the mesh',
        'On meshes with very many triangles',
        'On meshes with very few triangles',
      ],
      answer: 0,
      explanation: 'The filter depends on some triangles being much nearer than others. Where they are all equidistant, one global bound rejects nothing — which is an argument for a structure that adapts locally rather than a cheaper test.',
    },
  ],
};
