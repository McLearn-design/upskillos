// Mesh Engine 2.2 — Manual Alignment (Mating)
//
// LearningPath section 15A. The hand-driven companion to section 15's
// automatic ICP, and the reason it exists is accessibility: not every user can
// export an STL, and not every CAM system writes the stock model where the
// part expects it.
//
// Every number quoted was produced by field-fixes/verify/check-mating.py.
// That script's first version reported something geometrically impossible, and
// the reason is taught here rather than hidden.

const LESSON_MESH_2_2 = {
  title: 'One Mate Is Not Enough, Two Are Too Many',
  subtitle: 'Counting constraints before trusting a solver.',
  sequential: true,

  cells: [

    {
      type: 'markdown',
      instruction: `### When the model arrives in the wrong place

Lesson 14 moved a point between frames when you knew the transform. This lesson
is about the case where **nobody knows it**.

A stock model and a finished part were exported by different systems, at
different times, possibly by different people. They arrive in whatever
coordinates each system felt like writing. Before any of lessons 5–12 can run,
they have to be in the same frame.

There is an automatic answer — fit one cloud of points to the other — and it
needs overlapping geometry to fit *to*. A rough stock block against a finished
part often has very little. And some users cannot export a usable model at all.

So the fallback is the thing every CAD system offers: **point at two faces and
say "these go together."** That is a mate.

The interesting part is not how to compute one. It is **how much of the problem
a mate actually solves**, which turns out to be answerable exactly — by counting.

\`\`\`
a rigid transform          6 degrees of freedom   (3 rotation, 3 translation)
one face mate              ? constraints
\`\`\`

Fill in that question mark and everything else follows.`,
    },

    {
      type: 'js',
      instruction: `### The mate is satisfied. The part is somewhere else.

Two faces have been mated: the moving face's normal opposes the fixed one, and
their chosen points coincide. The constraint is met exactly.

Now drag the **spin** slider. It rotates the moving part about the shared
normal — which changes nothing about the mate, because the normal is unchanged
and the mated point is on the axis.

**Predict before you drag:** with the mate satisfied to floating-point
precision the whole time, how far do you expect a corner of the part 60 units
away to travel? Nothing, a little, or a long way?

The panel reports the mate residual and the corner's displacement together.
Watch them at the same time.`,
      html: `<div style="padding:8px 2px;font:11px ui-monospace,monospace;color:#7d8794;display:grid;grid-template-columns:auto 1fr auto;gap:6px 10px;align-items:center">
  <span>spin about the shared normal</span><input id="spin" type="range" min="0" max="360" step="1" value="0"><span id="spinv">0&deg;</span>
</div>
<canvas id="c" style="width:100%;height:230px;background:#0a0f1e;border-radius:8px"></canvas>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:8px 2px;white-space:pre"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `// ── small vector and matrix helpers, written out ────────────────────────
function sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function add(a, b) { return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
function scale(a, s) { return [a[0]*s, a[1]*s, a[2]*s]; }
function dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function cross(a, b) {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}
function norm(a) { return Math.sqrt(dot(a, a)); }
function unit(a) { var n = norm(a); return n === 0 ? a : scale(a, 1/n); }
function mul(A, B) {
  var M = [[0,0,0],[0,0,0],[0,0,0]];
  for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) {
    var t = 0;
    for (var k = 0; k < 3; k++) t += A[i][k]*B[k][j];
    M[i][j] = t;
  }
  return M;
}
function apply(M, v) {
  return [M[0][0]*v[0]+M[0][1]*v[1]+M[0][2]*v[2],
          M[1][0]*v[0]+M[1][1]*v[1]+M[1][2]*v[2],
          M[2][0]*v[0]+M[2][1]*v[1]+M[2][2]*v[2]];
}

// Rotation from an axis-angle pair, as a MATRIX. Lesson 14's warning applies:
// never carry a pose as angles between steps, only build matrices from them.
function rodrigues(axis, ang) {
  var k = unit(axis);
  var K = [[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]];
  var M = [[1,0,0],[0,1,0],[0,0,1]];
  for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) {
    M[i][j] += Math.sin(ang)*K[i][j];
    var kk = 0;
    for (var m = 0; m < 3; m++) kk += K[i][m]*K[m][j];
    M[i][j] += (1 - Math.cos(ang))*kk;
  }
  return M;
}

// The minimal rotation taking unit vector a onto unit vector b.
function alignVectors(a, b) {
  a = unit(a); b = unit(b);
  var v = cross(a, b), s = norm(v), c = dot(a, b);
  if (s < 1e-12) {
    if (c > 0) return [[1,0,0],[0,1,0],[0,0,1]];
    // anti-parallel: half a turn about ANY perpendicular axis
    var ax = Math.abs(a[0]) > 0.9 ? [0,1,0] : [1,0,0];
    return rodrigues(cross(a, ax), Math.PI);
  }
  return rodrigues(v, Math.atan2(s, c));
}

// ── the two faces ───────────────────────────────────────────────────────
var nFixed = [0, 0, 1], cFixed = [2, 1, 0];      // the face that stays put
var nMove  = [0, 0, 1], cMove  = [-3, 4, 7];     // the face that moves
var probe  = [50, -30, 12];                      // a corner far from the mate

var R0 = alignVectors(nMove, scale(nFixed, -1));  // normal must OPPOSE
var t0 = sub(cFixed, apply(R0, cMove));

function poseAt(deg) {
  var R = mul(rodrigues(nFixed, deg*Math.PI/180), R0);
  return { R: R, t: sub(cFixed, apply(R, cMove)) };
}

// How far the mate is from satisfied: normal opposition plus point coincidence.
function residual(p) {
  var n = add(apply(p.R, nMove), nFixed);
  var c = sub(add(apply(p.R, cMove), p.t), cFixed);
  return Math.sqrt(dot(n, n) + dot(c, c));
}

var canvas = document.getElementById('c');
var ctx = canvas.getContext('2d');
function sizeCanvas() {
  canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
  canvas.height = 230 * (window.devicePixelRatio || 1);
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
}
sizeCanvas();

var base = null;

function draw() {
  var deg = Number(document.getElementById('spin').value);
  document.getElementById('spinv').textContent = deg + '\\u00b0';
  var p = poseAt(deg);
  var pt = add(apply(p.R, probe), p.t);
  if (base === null) base = add(apply(poseAt(0).R, probe), poseAt(0).t);

  var W = canvas.clientWidth, H = 230, s = Math.min(W, H) / 170;
  function X(v) { return W/2 + (v[0]*0.92 - v[1]*0.38) * s; }
  function Y(v) { return H/2 - (v[2]*0.80 - v[1]*0.26 - v[0]*0.14) * s; }

  ctx.clearRect(0, 0, W, H);

  // the fixed face, as a small square in its own plane
  ctx.strokeStyle = '#5c9ce0'; ctx.lineWidth = 2;
  ctx.beginPath();
  [[-8,-8],[8,-8],[8,8],[-8,8],[-8,-8]].forEach(function (o, i) {
    var q = [cFixed[0]+o[0], cFixed[1]+o[1], cFixed[2]];
    if (i === 0) ctx.moveTo(X(q), Y(q)); else ctx.lineTo(X(q), Y(q));
  });
  ctx.stroke();

  // the moving face, transformed
  ctx.strokeStyle = '#e0a35c';
  ctx.beginPath();
  [[-8,-8],[8,-8],[8,8],[-8,8],[-8,-8]].forEach(function (o, i) {
    var local = [cMove[0]+o[0], cMove[1]+o[1], cMove[2]];
    var q = add(apply(p.R, local), p.t);
    if (i === 0) ctx.moveTo(X(q), Y(q)); else ctx.lineTo(X(q), Y(q));
  });
  ctx.stroke();

  // the spin axis
  ctx.strokeStyle = '#4a5568'; ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(X(sub(cFixed, scale(nFixed, 40))), Y(sub(cFixed, scale(nFixed, 40))));
  ctx.lineTo(X(add(cFixed, scale(nFixed, 40))), Y(add(cFixed, scale(nFixed, 40))));
  ctx.stroke();
  ctx.setLineDash([]);

  // the corner, and the circle it sweeps
  ctx.strokeStyle = '#3a4152';
  ctx.beginPath();
  for (var d = 0; d <= 360; d += 4) {
    var q = poseAt(d);
    var v = add(apply(q.R, probe), q.t);
    if (d === 0) ctx.moveTo(X(v), Y(v)); else ctx.lineTo(X(v), Y(v));
  }
  ctx.stroke();
  ctx.fillStyle = '#ffd43b';
  ctx.beginPath(); ctx.arc(X(pt), Y(pt), 5, 0, 2*Math.PI); ctx.fill();

  ctx.fillStyle = '#7d8794'; ctx.font = '10px ui-monospace, monospace';
  ctx.fillText('fixed face', X(cFixed) + 10, Y(cFixed) - 6);
  ctx.fillText('the corner', X(pt) + 8, Y(pt) - 6);

  document.getElementById('out').textContent = [
    'mate residual        ' + residual(p).toExponential(2)
      + '   (0 means perfectly satisfied)',
    'the corner has moved ' + norm(sub(pt, base)).toFixed(3) + ' units',
    '',
    residual(p) < 1e-9
      ? 'The mate is still exact. The part is not where it was.'
      : 'The mate has broken - that should not happen from a spin.',
  ].join('\\n');
}

document.getElementById('spin').addEventListener('input', draw);
window.addEventListener('resize', function () { sizeCanvas(); draw(); });
draw();`,
      outputHeight: 470,
    },

    {
      type: 'markdown',
      instruction: `### Count the constraints

A mate says two things:

\`\`\`
the moving face's normal must OPPOSE the fixed face's normal
a chosen point on the moving face must land on the fixed face's point
\`\`\`

Written as numbers that must all be zero, that is six rows — three for the
normal, three for the point. Measured, by the rank of the constraint Jacobian
— the same instrument lesson 14 used on gimbal lock:

\`\`\`
constraint rows           6
singular values           8.717  8.698  1.000  0.586  0.115  1.6e-16
independent constraints   5
degrees of freedom left   1
\`\`\`

**Six rows, five independent.** The last singular value is zero to machine
precision. That is not a numerical accident: **a unit normal has only two
degrees of freedom, not three** — it lives on a sphere — so one of the three
normal rows carries nothing the other two did not already say.

Five constraints against six parameters leaves **one**.

### And that one is not cosmetic

The spin above, measured:

| spin | mate residual | the corner moves |
|---|---|---|
| 0° | 1.2e-16 | 0.000 |
| 45° | 1.2e-16 | 48.194 |
| 90° | 4.6e-16 | 89.051 |
| 180° | 6.4e-16 | **125.936** |
| 270° | 1.2e-16 | 89.051 |

The mate holds to **6.4e-16** at every one of those while the part travels
**126 units**.

> **A single mate positions a face, not a part.**

Which means any interface that offers one mate and then draws the result has
already chosen that spin, silently, on the user's behalf. The honest options
are to expose the remaining freedom as something the user can drag, or to ask
for a second constraint — and the second constraint has its own problem.`,
    },

    {
      type: 'markdown',
      instruction: `### Two mates, and the second breaks the first

The instinct is obvious: one mate leaves a degree of freedom, so add another.
Count first.

\`\`\`
constraint rows           12      two mates, six rows each
independent constraints    6
degrees of freedom left    0
\`\`\`

The freedom is gone. **So is the slack.** Twelve rows against six parameters,
and there is no reason an arbitrary second face lands exactly where the first
one puts it — so in general **no transform satisfies both.**

Solved as least squares:

\`\`\`
best achievable residual                          1.6489
  contributed by the normals                      0.7490
  contributed by the points                       1.4690

the first mate, which WAS exact, is now off by    1.2268
\`\`\`

**Adding the second mate broke the first one.** Not by a rounding error — by
1.23 units, on a mate that was previously satisfied to 1.2e-16.

That residual is the number the user has to see. Snapping silently to the
least-squares answer puts the part somewhere *neither* mate asked for, and
nothing on screen says by how much. It is lesson 12's contested faces in a new
place: the system had two legitimate claims, resolved them by averaging, and
reported the result as though it were certain.

The honest interface says: *these two mates disagree by 1.65; here is the best
compromise; do you want to drop one?*

### The instrument was wrong before the geometry was

Worth keeping, because it is how this lesson nearly shipped a false claim.

The first version of the measurement carried the pose as a **rotation vector
plus a translation**, and recovered the rotation vector from a matrix with the
standard axis-angle formula. That formula divides by \`sin(angle)\`.

The case here is **exactly 180°** — the two normals are anti-parallel, so the
minimal rotation between them is a half turn, and \`sin(180°) = 0\`.

The measurement came back reporting that spinning about the shared normal
**broke the mate**, with residuals of 2.04, 7.66 and 15.4. That is
geometrically impossible: rotating about a vector cannot change that vector.

Carrying the pose as \`(R, t)\` and never round-tripping through angles gives
residuals of 1.2e-16 throughout.

**This is lesson 14's own warning, biting inside lesson 14's own subject.** A
result that contradicts geometry is a bug in the instrument, not a discovery —
and the tell was that it was wrong in a way the world cannot be.`,
    },

    {
      type: 'challenge',
      instruction: `### 🎯 Build the mate, and report what it did not decide

Two functions.

\`alignVectors(a, b)\` — the minimal rotation matrix taking unit vector \`a\`
onto unit vector \`b\`, as an array of three rows. It must handle the
**anti-parallel** case (\`b = −a\`), which is not optional here: mating two
faces together is exactly that case, and the cross product is zero there.

\`mate(fixed, moving)\` — each argument is \`{ normal, point }\`. Return
\`{ R, t, freedom }\`:

- \`R\`, \`t\` — a rigid transform putting the moving face against the fixed one,
  so the moving normal ends up **opposing** the fixed normal and the points
  coincide
- \`freedom\` — how many degrees of freedom the mate leaves unconstrained

It is checked on perpendicular faces, anti-parallel faces, already-aligned
faces, and by confirming that a spin about the shared normal leaves your
transform's residual unchanged.`,
      html: `<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:10px;white-space:pre;background:#0a0f1e;border-radius:8px;min-height:230px"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `// TODO 1: the minimal rotation taking unit vector a onto unit vector b.
//         The anti-parallel case (b = -a) has a zero cross product.
function alignVectors(a, b) {

  // your code here

  return [[1,0,0],[0,1,0],[0,0,1]];
}

// TODO 2: mate the moving face against the fixed one.
//         { R, t, freedom } - and freedom is not zero.
function mate(fixed, moving) {

  // your code here

  return { R: [[1,0,0],[0,1,0],[0,0,1]], t: [0,0,0], freedom: 0 };
}

// ── it runs itself below ──────────────────────────────────────────────────
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function sub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function add(a,b){return [a[0]+b[0],a[1]+b[1],a[2]+b[2]];}
function apply(M,v){return [M[0][0]*v[0]+M[0][1]*v[1]+M[0][2]*v[2],
                            M[1][0]*v[0]+M[1][1]*v[1]+M[1][2]*v[2],
                            M[2][0]*v[0]+M[2][1]*v[1]+M[2][2]*v[2]];}

var lines = ['  MATE RESIDUALS'];
[['anti-parallel faces', {normal:[0,0,1],point:[2,1,0]}, {normal:[0,0,1],point:[-3,4,7]}],
 ['perpendicular faces', {normal:[0,0,1],point:[0,0,0]}, {normal:[1,0,0],point:[5,5,5]}],
 ['already opposed',     {normal:[0,0,1],point:[0,0,0]}, {normal:[0,0,-1],point:[1,2,3]}]
].forEach(function (c) {
  var r = mate(c[1], c[2]);
  var n = add(apply(r.R, c[2].normal), c[1].normal);
  var p = sub(add(apply(r.R, c[2].point), r.t), c[1].point);
  lines.push('    ' + c[0].padEnd(22)
    + 'normal ' + Math.sqrt(dot(n,n)).toExponential(1)
    + '   point ' + Math.sqrt(dot(p,p)).toExponential(1)
    + '   freedom ' + r.freedom);
});
console.log(lines.join('\\n'));
document.getElementById('out').textContent = lines.join('\\n');`,
      check: (js) => {
        const no = (message) => ({ pass: false, message });
        let fn;
        try {
          const body = js.split(/\/\/[\s─-]*it runs itself below/)[0];
          const doc = { getElementById: () => ({ textContent: '', style: {} }) };
          // eslint-disable-next-line no-new-func
          fn = new Function('document', 'console',
            body + '\nreturn { alignVectors, mate };',
          )(doc, { log() {} });
        } catch (e) { return no('The code did not run: ' + e.message); }
        for (const n of ['alignVectors', 'mate']) {
          if (typeof fn[n] !== 'function') return no(n + ' is not a function.');
        }

        const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        const nrm = (a) => Math.sqrt(dot(a, a));
        const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
        const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
        const app = (M, v) => [0, 1, 2].map((i) =>
          M[i][0] * v[0] + M[i][1] * v[1] + M[i][2] * v[2]);
        const okMat = (M) => Array.isArray(M) && M.length === 3
          && M.every((r) => Array.isArray(r) && r.length === 3
            && r.every((x) => typeof x === 'number' && Number.isFinite(x)));

        // alignVectors, including the case the cross product cannot reach.
        const pairs = [
          ['perpendicular', [0, 0, 1], [1, 0, 0]],
          ['anti-parallel', [0, 0, 1], [0, 0, -1]],
          ['identical', [0, 0, 1], [0, 0, 1]],
          ['anti-parallel on x', [1, 0, 0], [-1, 0, 0]],
          ['oblique', [0.267, 0.535, 0.802], [-0.577, 0.577, 0.577]],
        ];
        for (const [label, a0, b0] of pairs) {
          // The contract is unit vectors, so normalise before comparing —
          // otherwise a correct implementation that normalises its inputs
          // is scored against a target that is not quite on the sphere.
          const a = ((v) => v.map((x) => x / nrm(v)))(a0);
          const b = ((v) => v.map((x) => x / nrm(v)))(b0);
          let R;
          try { R = fn.alignVectors(a, b); } catch (e) {
            return no('alignVectors threw on ' + label + ': ' + e.message);
          }
          if (!okMat(R)) {
            return no('alignVectors should return three rows of three finite '
              + 'numbers. On ' + label + ' it gave ' + JSON.stringify(R) + '.');
          }
          const got = app(R, a);
          if (nrm(sub(got, b)) > 1e-9) {
            if (label.includes('anti-parallel') && got.every((v, i) => Math.abs(v - a[i]) < 1e-9)) {
              return no('On ' + label + ' your rotation left the vector where it '
                + 'was. The cross product of a and −a is the zero vector, so '
                + 'the usual formula has no axis to rotate about. Handle it '
                + 'separately: a half turn about ANY axis perpendicular to a.');
            }
            return no('alignVectors(' + label + ') sent a to ['
              + got.map((v) => v.toFixed(4)).join(', ') + '], expected ['
              + b.map((v) => v.toFixed(4)).join(', ') + '].');
          }
          // It must be a rotation, not a reflection - lesson 14's rule.
          const det = R[0][0] * (R[1][1] * R[2][2] - R[1][2] * R[2][1])
                    - R[0][1] * (R[1][0] * R[2][2] - R[1][2] * R[2][0])
                    + R[0][2] * (R[1][0] * R[2][1] - R[1][1] * R[2][0]);
          if (Math.abs(det - 1) > 1e-9) {
            return no('alignVectors(' + label + ') returned a matrix with '
              + 'determinant ' + det.toFixed(4) + '. It must be +1 — lesson 14: '
              + 'a determinant of −1 is a reflection, and it would mirror the '
              + 'part while looking correct.');
          }
        }

        // mate, on the three cases the runner shows plus one more.
        const cases = [
          ['anti-parallel faces', { normal: [0, 0, 1], point: [2, 1, 0] },
                                  { normal: [0, 0, 1], point: [-3, 4, 7] }],
          ['perpendicular faces', { normal: [0, 0, 1], point: [0, 0, 0] },
                                  { normal: [1, 0, 0], point: [5, 5, 5] }],
          ['already opposed', { normal: [0, 0, 1], point: [0, 0, 0] },
                              { normal: [0, 0, -1], point: [1, 2, 3] }],
          ['oblique', { normal: [0.6, 0.8, 0], point: [1, 1, 1] },
                      { normal: [0, 0.6, 0.8], point: [-2, 3, 4] }],
        ];
        for (const [label, fixed, moving] of cases) {
          let r;
          try { r = fn.mate(fixed, moving); } catch (e) {
            return no('mate threw on ' + label + ': ' + e.message);
          }
          if (!r || !okMat(r.R) || !Array.isArray(r.t) || r.t.length !== 3
              || typeof r.freedom !== 'number') {
            return no('mate should return { R, t, freedom }. On ' + label
              + ' it gave ' + JSON.stringify(r) + '.');
          }
          const nres = nrm(add(app(r.R, moving.normal), fixed.normal));
          const pres = nrm(sub(add(app(r.R, moving.point), r.t), fixed.point));
          if (nres > 1e-9) {
            const same = nrm(sub(app(r.R, moving.normal), fixed.normal));
            if (same < 1e-9) {
              return no('On ' + label + ' the moving normal ended up EQUAL to the '
                + 'fixed normal, not opposite. Two faces that mate point away '
                + 'from each other — align the moving normal to −fixed.normal, '
                + 'not to fixed.normal. As drawn, the parts are interpenetrating.');
            }
            return no('On ' + label + ' the normal residual is ' + nres.toFixed(6)
              + ', expected 0. The moving normal must oppose the fixed one.');
          }
          if (pres > 1e-9) {
            return no('On ' + label + ' the normal is right but the points are '
              + pres.toFixed(6) + ' apart. After rotating, translate so the '
              + 'moving point lands on the fixed point: t = fixed.point − '
              + 'R × moving.point.');
          }
          if (r.freedom !== 1) {
            return no('On ' + label + ' you reported freedom = ' + r.freedom
              + '. A face mate writes six constraint rows but only FIVE are '
              + 'independent — a unit normal has two degrees of freedom, not '
              + 'three. Five constraints on six parameters leaves exactly 1, and '
              + 'reporting 0 tells the user the part is pinned when it can still '
              + 'spin 126 units away.');
          }
        }

        // The claimed freedom must be real: a spin about the shared normal
        // must leave the mate satisfied.
        const fixed = { normal: [0, 0, 1], point: [2, 1, 0] };
        const moving = { normal: [0, 0, 1], point: [-3, 4, 7] };
        const r = fn.mate(fixed, moving);
        const spin = (deg) => {
          const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180);
          return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
        };
        const mm = (A, B) => [0, 1, 2].map((i) => [0, 1, 2].map((j) =>
          A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j]));
        for (const deg of [45, 90, 180, 270]) {
          const R2 = mm(spin(deg), r.R);
          const t2 = sub(fixed.point, app(R2, moving.point));
          const nres = nrm(add(app(R2, moving.normal), fixed.normal));
          const pres = nrm(sub(add(app(R2, moving.point), t2), fixed.point));
          if (nres > 1e-9 || pres > 1e-9) {
            return no('Spinning your mate by ' + deg + ' degrees about the shared '
              + 'normal broke it (normal ' + nres.toExponential(1) + ', point '
              + pres.toExponential(1) + '). That cannot happen geometrically — '
              + 'rotating about a vector cannot change that vector — so the '
              + 'transform is not the one it claims to be.');
          }
        }

        return {
          pass: true,
          message: 'The normals oppose rather than match, the points coincide, the '
            + 'anti-parallel case is handled where the cross product vanishes, the '
            + 'matrix is a rotation rather than a reflection, and the leftover '
            + 'degree of freedom is reported instead of being silently chosen. '
            + 'That last one is the difference between positioning a face and '
            + 'claiming to have positioned a part.',
        };
      },
      successMessage: '✓ Mated, and honest about what it left undecided.',
      failMessage: '✗ Not yet.',
      outputHeight: 440,
    },

  ],
};

const PY_CELLS = [
  {
    id: 'pose',
    cellTitle: 'A pose is six numbers, and never angles between steps',
    prose: [
      'A rigid transform - rotation plus translation, no scaling or mirroring - has six degrees of freedom: three to say which way the part faces and three to say where it sits. Everything in this lesson is about how many of those six a mate removes.',
      'How the pose is carried matters more than it looks. Lesson 14 showed that three angles lose a degree of freedom at pitch 90, and that recovering angles from a matrix divides by something that reaches zero. Mating two faces means making their normals anti-parallel, which is a 180 degree rotation - precisely the degenerate case.',
      'So the pose is carried as a rotation matrix and a translation vector, and angles are only ever used to build a matrix, never to store one. The first version of this measurement ignored that and reported something geometrically impossible; the last cell shows what happened.',
    ],
    code: `import numpy as np

def rodrigues(w):
    """Rotation matrix from a rotation vector (axis * angle)."""
    th = float(np.linalg.norm(w))
    if th < 1e-14:
        return np.eye(3)
    k = w / th
    K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + np.sin(th) * K + (1 - np.cos(th)) * (K @ K)

def align(a, b):
    """Minimal rotation taking unit vector a onto unit vector b."""
    a, b = a / np.linalg.norm(a), b / np.linalg.norm(b)
    v = np.cross(a, b)
    s, c = float(np.linalg.norm(v)), float(a @ b)
    if s < 1e-12:
        if c > 0:
            return np.eye(3)
        # anti-parallel: the cross product is zero, so there is no axis to
        # read off. Half a turn about ANY perpendicular axis will do.
        axis = np.array([1.0, 0.0, 0.0])
        if abs(a @ axis) > 0.9:
            axis = np.array([0.0, 1.0, 0.0])
        axis = np.cross(a, axis)
        return rodrigues(axis / np.linalg.norm(axis) * np.pi)
    K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + K + K @ K * ((1 - c) / s**2)

# The two faces. The moving one currently points the SAME way as the fixed one,
# so mating them is the anti-parallel case.
n_fixed, c_fixed = np.array([0.0, 0.0, 1.0]), np.array([2.0, 1.0, 0.0])
n_move,  c_move  = np.array([0.0, 0.0, 1.0]), np.array([-3.0, 4.0, 7.0])

R0 = align(n_move, -n_fixed)
t0 = c_fixed - R0 @ c_move

print('the rotation that opposes the two normals:')
print(np.round(R0, 6))
print(f'\\n  determinant {np.linalg.det(R0):+.6f}   (must be +1, not -1 - lesson 14)')
print(f'  moving normal becomes {np.round(R0 @ n_move, 6)}')
print(f'  fixed normal is       {n_fixed}')
print(f'  they oppose: {np.allclose(R0 @ n_move, -n_fixed)}')
print(f'\\n  translation {np.round(t0, 6)}')
print(f'  moving point lands at {np.round(R0 @ c_move + t0, 6)}, '
      f'fixed point is {c_fixed}')`,
  },
  {
    id: 'count',
    cellTitle: 'Count the constraints before trusting the solver',
    prose: [
      'A mate says the normals must oppose and the points must coincide. Written as quantities that must all be zero that is six rows - three for the normal, three for the point. The question is how many of those six are actually independent.',
      'Measure it the way lesson 14 measured gimbal lock: build the Jacobian of the constraint with respect to a small change in the pose, and look at its rank. A rank below six means the constraint cannot pin down all six parameters, and the shortfall is exactly the freedom left over.',
      'Note how the Jacobian is taken. The derivative is with respect to a small increment applied at the current pose, so the angle parameterisation is always near zero and never anywhere awkward. That is the same discipline as the previous cell, applied to the measurement rather than to the result.',
    ],
    code: `def residual(R, t):
    """How far the mate is from satisfied. Six numbers, all should be zero."""
    return np.concatenate([R @ n_move + n_fixed, R @ c_move + t - c_fixed])

def jacobian(f, R, t, rows, h=1e-7):
    """Derivative w.r.t. a SMALL increment at the current pose:
    R -> rodrigues(dw) @ R, t -> t + dt. Six columns, always near zero."""
    base = f(R, t)
    J = np.zeros((rows, 6))
    for k in range(3):
        dw = np.zeros(3); dw[k] = h
        J[:, k] = (f(rodrigues(dw) @ R, t) - base) / h
    for k in range(3):
        dt = np.zeros(3); dt[k] = h
        J[:, 3 + k] = (f(R, t + dt) - base) / h
    return J

print(f'residual at the constructed pose: {np.linalg.norm(residual(R0, t0)):.2e}')

J = jacobian(residual, R0, t0, 6)
sv = np.linalg.svd(J, compute_uv=False)
rank = int(np.sum(sv > 1e-6 * sv[0]))

print()
print(f'  constraint rows        : {J.shape[0]}')
print(f'  singular values        : {np.array2string(sv, precision=4)}')
print(f'  independent constraints: {rank}')
print(f'  degrees of freedom left: {6 - rank}')
print()
print('The last singular value is zero to machine precision. That is not a')
print('numerical accident - a unit normal lives on a sphere and has only TWO')
print('degrees of freedom, so one of the three normal rows says nothing the')
print('other two did not. Five constraints on six parameters leaves one.')`,
  },
  {
    id: 'freedom',
    cellTitle: 'What the leftover degree of freedom actually does',
    prose: [
      'A count is only worth something if you can see what it means. The remaining freedom is a spin about the shared normal: rotating about that axis leaves the normal unchanged and leaves the mated point on the axis, so the constraint is untouched.',
      'Measure both things at once - how well the mate is still satisfied, and how far a corner of the part has travelled. If the first stays at zero while the second grows, the mate is not positioning the part.',
      'The corner is deliberately far from the mated face, because that is where the consequence shows up. A user mating a small face on a large part is exactly this situation.',
    ],
    code: `probe = np.array([50.0, -30.0, 12.0])      # a corner far from the mated face
base_pt = R0 @ probe + t0

print(f"{'spin about the shared normal':>30} {'mate residual':>15} {'corner moves':>15}")
worst_res, spans = 0.0, []
for deg in (0, 45, 90, 135, 180, 270, 359):
    Rs = rodrigues(np.radians(deg) * n_fixed) @ R0
    ts = c_fixed - Rs @ c_move
    res = float(np.linalg.norm(residual(Rs, ts)))
    moved = float(np.linalg.norm((Rs @ probe + ts) - base_pt))
    worst_res, _ = max(worst_res, res), spans.append(moved)
    print(f'{deg:>29}\\u00b0 {res:>15.2e} {moved:>15.3f}')

print()
print(f'the mate holds to {worst_res:.1e} at every one of those,')
print(f'while a corner of the part travels up to {max(spans):.1f} units.')
print()
print('A single mate positions a FACE, not a PART. Any interface that offers')
print('one mate and then draws the result has already picked that spin on the')
print('user\\'s behalf, without saying so.')`,
  },
  {
    id: 'two',
    cellTitle: 'Two mates over-constrain, and the second breaks the first',
    prose: [
      'One mate leaves a degree of freedom, so the instinct is to add a second. Count again before assuming that helps.',
      'Two mates write twelve rows against six parameters. The freedom disappears - but so does the slack, and there is no reason an arbitrary second face on the moving part lands exactly where the first mate puts it. In general no transform satisfies both, so a solver has to settle for least squares.',
      'What matters is not that least squares works. It is what it costs, and specifically what it does to the mate that was previously exact.',
    ],
    code: `n_f2, c_f2 = np.array([1.0, 0.0, 0.0]), np.array([0.0, 3.0, 5.0])
n_m2, c_m2 = np.array([1.0, 0.0, 0.0]), np.array([1.0, 1.0, 1.0])

def residual2(R, t):
    return np.concatenate([
        R @ n_move + n_fixed, R @ c_move + t - c_fixed,
        R @ n_m2   + n_f2,    R @ c_m2   + t - c_f2,
    ])

J2 = jacobian(residual2, R0, t0, 12)
sv2 = np.linalg.svd(J2, compute_uv=False)
rank2 = int(np.sum(sv2 > 1e-6 * sv2[0]))
print(f'  constraint rows        : {J2.shape[0]}   (two mates, six rows each)')
print(f'  independent constraints: {rank2}')
print(f'  degrees of freedom left: {max(6 - rank2, 0)}')

# Gauss-Newton on the manifold: the step is an increment, never an absolute
# angle, for exactly the reason the first cell gave.
R, t = R0.copy(), t0.copy()
for _ in range(200):
    step, *_ = np.linalg.lstsq(jacobian(residual2, R, t, 12), -residual2(R, t),
                               rcond=None)
    R, t = rodrigues(step[:3]) @ R, t + step[3:]
    if np.linalg.norm(step) < 1e-13:
        break

rf = residual2(R, t)
print()
print(f'  best achievable residual : {np.linalg.norm(rf):.4f}')
print(f'    from the normals       : {np.linalg.norm(rf[[0,1,2,6,7,8]]):.4f}')
print(f'    from the points        : {np.linalg.norm(rf[[3,4,5,9,10,11]]):.4f}')
print()
print(f'  the first mate WAS exact at {np.linalg.norm(residual(R0, t0)):.1e}')
print(f'  after adding the second it is off by {np.linalg.norm(residual(R, t)):.4f}')
print()
print('Adding the second mate broke the first. That residual is the number the')
print('user has to see - snapping silently to the compromise puts the part')
print('where NEITHER mate asked, and nothing on screen says by how much.')`,
  },
  {
    id: 'instrument',
    cellTitle: 'The measurement that contradicted geometry',
    prose: [
      'This lesson nearly shipped a false claim, and the way it was caught is worth more than the claim would have been.',
      'The first version carried the pose as a rotation vector plus a translation, recovering the rotation vector from a matrix with the standard axis-angle formula. That formula divides by the sine of the angle. Mating two faces makes their normals anti-parallel, so the rotation is exactly 180 degrees, and the sine of 180 degrees is zero.',
      'It reported that spinning about the shared normal broke the mate. That is impossible: rotating about a vector cannot change that vector. A result that contradicts geometry is a bug in the instrument, not a discovery - and the tell was that it was wrong in a way the world cannot be.',
      'There is a second lesson underneath the first. Measured, the recovery at exactly 180 degrees is perfect about the y axis and off by 2.828 - the entire rotation - about an oblique one, because for the axis-aligned case the vanishing numerator and vanishing denominator cancel. A test written at the exact degenerate point on a convenient axis passes and proves nothing. The failure lives in the neighbourhood, and on the axes nobody picks for a test.',
    ],
    code: `def rotvec_from_matrix_naive(R):
    """The textbook recovery. Correct almost everywhere, and useless at 180."""
    ang = np.arccos(np.clip((np.trace(R) - 1) / 2, -1, 1))
    if ang < 1e-12:
        return np.zeros(3)
    ax = np.array([R[2,1] - R[1,2], R[0,2] - R[2,0], R[1,0] - R[0,1]])
    return ax / (2 * np.sin(ang)) * ang        # sin(pi) == 0

oblique = np.array([0.3, 0.7, 0.2]); oblique /= np.linalg.norm(oblique)

print('approaching 180 degrees about an oblique axis:')
print(f"{'rotation':>12} {'sin(angle)':>12} {'round-trip error':>18}")
for deg in (90, 150, 179, 179.9, 179.99, 179.999, 180):
    R = rodrigues(np.radians(deg) * oblique)
    back = rodrigues(rotvec_from_matrix_naive(R))
    print(f'{deg:>11}\\u00b0 {np.sin(np.radians(deg)):>12.2e} '
          f'{np.linalg.norm(back - R):>18.3e}')

print()
print('Now the same formula at EXACTLY 180 degrees, about different axes:')
print(f"{'axis':>12} {'round-trip error':>18}")
for name, ax in (('y', [0, 1, 0]), ('x + y', [1, 1, 0]),
                 ('x + y + z', [1, 1, 1]), ('oblique', [0.3, 0.7, 0.2])):
    a = np.array(ax, float); a /= np.linalg.norm(a)
    R = rodrigues(np.pi * a)
    print(f'{name:>12} {np.linalg.norm(rodrigues(rotvec_from_matrix_naive(R)) - R):>18.3e}')

print()
print('Read those two tables together, because separately each one lies.')
print()
print('About y, at exactly 180, the recovery is PERFECT - the vanishing')
print('numerator and the vanishing denominator cancel. A test written on an')
print('axis-aligned rotation at exactly 180 degrees passes, and proves nothing.')
print()
print('About an oblique axis the same call is off by 2.828, which is the whole')
print('rotation. And the first table shows the approach: the error grows about')
print('a hundredfold for every tenfold step closer to 180.')
print()
print('The fix is not a better formula. It is to never round-trip: carry the')
print('pose as (R, t), and use angles only to BUILD a matrix, never to store')
print('one. Every cell above follows that rule, which is why the spin test')
print('came out at 1e-16 instead of 15.4.')`,
  },
  {
    id: 'ch-align',
    challengeType: 'write',
    challengeTitle: 'The rotation the cross product cannot find',
    difficulty: 'warm-up',
    prompt:
      'Write align_to(a, b) returning the minimal rotation matrix taking unit vector a '
      + 'onto unit vector b, handling the anti-parallel case where the cross product is '
      + 'zero. Then set report to a list of (label, a, b, max_error) rows covering the '
      + 'parallel, anti-parallel and general cases.',
    hint:
      'For the general case, Rodrigues from the cross product works. When the cross '
      + 'product has near-zero length there are two possibilities: the vectors already '
      + 'agree (identity) or they oppose, which needs a half turn about any axis '
      + 'perpendicular to a. Build that axis by crossing a with something not parallel to it.',
    code: `def align_to(a, b):
    # TODO
    pass


report = []
# TODO: (label, a, b, max_error) rows covering parallel, anti-parallel, general

for label, a, b, err in report:
    print(f'  {label:<24} error {err:.2e}')`,
    solution: `def align_to(a, b):
    a = np.asarray(a, float); b = np.asarray(b, float)
    a, b = a / np.linalg.norm(a), b / np.linalg.norm(b)
    v = np.cross(a, b)
    s, c = float(np.linalg.norm(v)), float(a @ b)
    if s < 1e-12:
        if c > 0:
            return np.eye(3)
        axis = np.array([1.0, 0.0, 0.0])
        if abs(a @ axis) > 0.9:
            axis = np.array([0.0, 1.0, 0.0])
        axis = np.cross(a, axis)
        return rodrigues(axis / np.linalg.norm(axis) * np.pi)
    K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + K + K @ K * ((1 - c) / s**2)


report = []
for label, a, b in (
    ('identical', [0, 0, 1], [0, 0, 1]),
    ('anti-parallel z', [0, 0, 1], [0, 0, -1]),
    ('anti-parallel x', [1, 0, 0], [-1, 0, 0]),
    ('perpendicular', [0, 0, 1], [1, 0, 0]),
    ('oblique', [0.267, 0.535, 0.802], [-0.577, 0.577, 0.577]),
):
    a_ = np.asarray(a, float); a_ = a_ / np.linalg.norm(a_)
    b_ = np.asarray(b, float); b_ = b_ / np.linalg.norm(b_)
    R = align_to(a_, b_)
    report.append((label, a_, b_, float(np.linalg.norm(R @ a_ - b_))))

for label, a, b, err in report:
    print(f'  {label:<24} error {err:.2e}')`,
    testCode: `assert report, "report is empty - nothing was aligned."
assert len(report) >= 4, f"only {len(report)} rows; cover parallel, anti-parallel and general"

for _label, _a, _b, _err in report:
    assert _err < 1e-9, f'"{_label}" left an error of {_err:.2e}'

# The anti-parallel case is the one that matters, and the one that breaks.
_R = align_to(np.array([0.0, 0.0, 1.0]), np.array([0.0, 0.0, -1.0]))
assert np.allclose(_R @ np.array([0.0, 0.0, 1.0]), [0, 0, -1], atol=1e-9), (
    "align_to failed on anti-parallel vectors. The cross product of a and -a is "
    "zero, so there is no axis to read off - handle it separately with a half "
    "turn about any axis perpendicular to a. This is not an edge case here: "
    "mating two faces means opposing their normals.")

# Every result must be a ROTATION, not a reflection (lesson 14).
for _label, _a, _b, _ in report:
    _R = align_to(_a, _b)
    assert np.allclose(_R.T @ _R, np.eye(3), atol=1e-9), f'"{_label}" is not orthogonal'
    assert abs(np.linalg.det(_R) - 1) < 1e-9, (
        f'"{_label}" has determinant {np.linalg.det(_R):+.4f}, not +1 - a '
        f'determinant of -1 is a reflection and would mirror the part')

# And a random sweep, because three hand-picked cases prove little.
_rng = np.random.default_rng(3)
for _ in range(500):
    _a = _rng.normal(size=3); _a /= np.linalg.norm(_a)
    _b = _rng.normal(size=3); _b /= np.linalg.norm(_b)
    _R = align_to(_a, _b)
    assert np.linalg.norm(_R @ _a - _b) < 1e-9, "failed on a random pair"
    assert abs(np.linalg.det(_R) - 1) < 1e-9, "a random pair gave a reflection"
"SUCCESS: the general case is a cross product, and the case that actually occurs when two faces mate is the one the cross product cannot express."`,
  },
  {
    id: 'ch-dof',
    challengeType: 'write',
    challengeTitle: 'Count what the mate did not decide',
    difficulty: 'core',
    prompt:
      'Write degrees_of_freedom(residual_fn, R, t, rows) returning how many of the six '
      + 'rigid-body parameters the constraint leaves free, using the rank of the Jacobian. '
      + 'Then set one_mate and two_mates to those counts for the one-mate and two-mate '
      + 'constraints already defined above.',
    hint:
      'jacobian(f, R, t, rows) is already in scope. Take its singular values with '
      + 'np.linalg.svd(..., compute_uv=False), count how many are meaningfully above zero '
      + 'relative to the largest, and subtract from 6. Clamp at zero.',
    code: `def degrees_of_freedom(residual_fn, R, t, rows):
    # TODO
    pass


one_mate = None
two_mates = None
# TODO: the counts for residual (6 rows) and residual2 (12 rows)

print('one mate leaves ', one_mate, 'degree(s) of freedom')
print('two mates leave ', two_mates)`,
    solution: `def degrees_of_freedom(residual_fn, R, t, rows):
    J = jacobian(residual_fn, R, t, rows)
    sv = np.linalg.svd(J, compute_uv=False)
    rank = int(np.sum(sv > 1e-6 * sv[0]))
    return max(6 - rank, 0)


one_mate = degrees_of_freedom(residual, R0, t0, 6)
two_mates = degrees_of_freedom(residual2, R0, t0, 12)

print('one mate leaves ', one_mate, 'degree(s) of freedom')
print('two mates leave ', two_mates)`,
    testCode: `assert one_mate is not None and two_mates is not None, "the counts were never set."

assert one_mate == 1, (
    f"one mate came out with {one_mate} degrees of freedom, expected 1. The "
    f"constraint writes six rows but only five are independent, because a unit "
    f"normal has two degrees of freedom rather than three.")
assert two_mates == 0, (
    f"two mates came out with {two_mates} degrees of freedom, expected 0.")

# The claimed freedom must be REAL: a spin about the shared normal must leave
# the one-mate residual untouched. A count nobody exercised proves nothing.
for _deg in (30, 90, 180, 250):
    _Rs = rodrigues(np.radians(_deg) * n_fixed) @ R0
    _ts = c_fixed - _Rs @ c_move
    assert np.linalg.norm(residual(_Rs, _ts)) < 1e-9, (
        f"spinning {_deg} degrees about the shared normal broke the mate "
        f"(residual {np.linalg.norm(residual(_Rs, _ts)):.2e}). That is "
        f"geometrically impossible, so something is round-tripping through an "
        f"angle parameterisation.")

# And the rank must genuinely be 5, not 6 with a loose tolerance.
_sv = np.linalg.svd(jacobian(residual, R0, t0, 6), compute_uv=False)
assert _sv[-1] < 1e-8 * _sv[0], (
    f"the smallest singular value is {_sv[-1]:.2e} against a largest of "
    f"{_sv[0]:.2e} - that is not a rank deficiency, so the counting is wrong")
"SUCCESS: five independent constraints on six parameters, and the leftover one is a real spin that moves the part 126 units while the mate stays exact."`,
  },
  {
    id: 'ch-residual',
    challengeType: 'write',
    challengeTitle: 'Report the disagreement instead of hiding it',
    difficulty: 'stretch',
    prompt:
      'Write fit_two_mates() returning (R, t, residual_norm) for the best least-squares '
      + 'compromise between both mates, by Gauss-Newton from the one-mate pose. Then set '
      + 'first_mate_error to how far the first mate - which was exact - has been pushed, '
      + 'and set verdict to "exact" or "compromised" accordingly.',
    hint:
      'Iterate: solve np.linalg.lstsq(jacobian(residual2, R, t, 12), -residual2(R, t)) for '
      + 'a 6-vector step, then apply it as R = rodrigues(step[:3]) @ R and t = t + step[3:]. '
      + 'Stop when the step is tiny. Never accumulate angles - apply each step as an '
      + 'increment to the matrix.',
    code: `def fit_two_mates():
    # TODO: return (R, t, residual_norm)
    pass


first_mate_error = None
verdict = None
# TODO

print('best compromise residual :', )
print('first mate pushed by     :', first_mate_error)
print('verdict                  :', verdict)`,
    solution: `def fit_two_mates():
    R, t = R0.copy(), t0.copy()
    for _ in range(200):
        step, *_ = np.linalg.lstsq(jacobian(residual2, R, t, 12),
                                   -residual2(R, t), rcond=None)
        R, t = rodrigues(step[:3]) @ R, t + step[3:]
        if np.linalg.norm(step) < 1e-13:
            break
    return R, t, float(np.linalg.norm(residual2(R, t)))


_R, _t, _res = fit_two_mates()
first_mate_error = float(np.linalg.norm(residual(_R, _t)))
verdict = 'exact' if _res < 1e-9 else 'compromised'

print('best compromise residual :', round(_res, 4))
print('first mate pushed by     :', first_mate_error)
print('verdict                  :', verdict)`,
    testCode: `assert first_mate_error is not None, "first_mate_error was never set."
assert verdict in ('exact', 'compromised'), f'verdict was {verdict!r}'

_R, _t, _res = fit_two_mates()

assert _res > 1e-6, (
    f"the two-mate fit came out exact ({_res:.2e}). Twelve constraint rows "
    f"against six parameters cannot be satisfied for arbitrary faces, so an "
    f"exact answer means the solver is not honouring both mates.")
assert verdict == 'compromised', (
    "with a residual this size the verdict must be 'compromised'")

# It must actually be the BEST compromise, not just some pose.
_rng = np.random.default_rng(11)
for _ in range(200):
    _dw = _rng.normal(size=3) * 0.05
    _dt = _rng.normal(size=3) * 0.5
    _alt = np.linalg.norm(residual2(rodrigues(_dw) @ _R, _t + _dt))
    assert _alt >= _res - 1e-9, (
        f"a nearby pose scored {_alt:.6f} against your {_res:.6f}, so this is "
        f"not the least-squares optimum - check the Gauss-Newton loop converged")

# The headline: the first mate was exact and is not any more.
assert np.linalg.norm(residual(R0, t0)) < 1e-9, "the one-mate pose should be exact"
assert first_mate_error > 0.1, (
    f"the first mate moved by only {first_mate_error:.4f}. Measured, adding the "
    f"second mate pushes it by over a unit - if it barely moved, the second "
    f"constraint is not being weighted at all.")
"SUCCESS: two mates have no exact answer, the compromise breaks the mate that was exact, and that number is what the user has to be shown."`,
  },
];

export default {
  id: 'mesh-engine-2-2-manual-alignment',
  slug: 'manual-alignment',
  chapter: 'mesh-engine.2',
  order: 1,
  title: 'Manual Alignment — Mating',
  subtitle: 'Counting constraints before trusting a solver, and saying what was left undecided.',
  tags: [
    'alignment', 'mate', 'constraints', 'degrees of freedom', 'rigid transform',
    'least squares', 'residual', 'rank', 'anti-parallel', 'over-constrained',
  ],
  aliases: 'manual alignment mate mating constraint face to face coincident align two models stock model wrong location degrees of freedom rigid transform rank deficiency over-constrained least squares residual anti-parallel normals ICP fallback',
  timeToComplete: 70,
  coreConcept:
    'Two models exported by different systems arrive in different frames, and an automatic fit needs overlapping geometry it may not have. The manual fallback is a mate: point at two faces and say they go together. How much that solves is answerable exactly by counting. A rigid transform has six degrees of freedom; a face mate writes six constraint rows of which only five are independent, because a unit normal has two degrees of freedom rather than three. So one mate leaves exactly one degree of freedom, and it is not cosmetic - spinning about the shared normal keeps the mate satisfied to 6.4e-16 while a corner of the part travels 126 units. A single mate positions a face, not a part. Two mates write twelve rows against six parameters, have no exact solution for arbitrary faces, and the least-squares compromise pushes the first mate - which was exact - off by 1.2268. That residual is what the user has to be shown.',
  prerequisites: ['mesh-engine-2-1-coordinate-systems'],
  nextLesson: 'mesh-engine-3-1-selection',

  semantics: {
    core: [
      { symbol: 'rigid transform', meaning: 'Rotation and translation, no scale or mirror. Six degrees of freedom.' },
      { symbol: 'a face mate', meaning: 'Normals oppose, chosen points coincide. Six rows, five independent.' },
      { symbol: 'rank of the constraint Jacobian', meaning: 'How many of the six parameters the constraint actually pins down. The shortfall is the freedom left.' },
      { symbol: 'the leftover degree of freedom', meaning: 'A spin about the shared normal. Keeps the mate exact and moves the part.' },
      { symbol: 'over-constrained', meaning: 'More independent constraints than parameters. No exact solution; only a compromise.' },
      { symbol: 'the residual', meaning: 'How far the best compromise still is from satisfying every constraint. The number the user must see.' },
      { symbol: 'anti-parallel', meaning: 'b = −a. The cross product vanishes, so the usual rotation formula has no axis — and this is the case mating always hits.' },
    ],
    rulesOfThumb: [
      'Count constraints against degrees of freedom before trusting any solver’s answer.',
      'Carry a pose as (R, t). Use angles only to build a matrix, never to store one.',
      'Expose the freedom a constraint leaves, rather than choosing it silently for the user.',
      'Report the residual whenever constraints are over-determined. A compromise presented as a solution is a lie about certainty.',
      'Handle the anti-parallel case explicitly. It is not an edge case in mating; it is the normal case.',
      'Check the determinant is +1 on any matrix a mate produces — a reflection mirrors the part and still looks right.',
      'A measurement that contradicts geometry is a bug in the instrument, not a discovery.',
    ],
  },

  hook: {
    question: 'You mate a face on the stock model to a face on the part. The constraint is satisfied to 1.2e-16. How far away from the correct position can the part still be?',
    realWorldContext: 'Measured: 126 units, on a corner 60 units from the mated face. Spinning the part about the shared normal changes nothing about the mate — the normal is unchanged and the mated point lies on the axis — so the constraint stays satisfied to floating-point precision through a full turn. A rigid transform has six degrees of freedom and a face mate writes six constraint rows, which looks like a complete answer until you measure the rank: only five of those rows are independent, because a unit normal has two degrees of freedom rather than three. One mate positions a face, not a part. Any interface that offers a single mate and then draws the result has already chosen that spin on the user’s behalf without saying so.',
    previewVisualizationId: 'JSNotebook',
  },

  intuition: {
    prose: [
      'Lesson 14 moved a point between frames when the transform was known. Here nobody knows it.',
      'Two models were exported by different systems at different times, and neither agreed where the origin is.',
      'Fitting them automatically needs overlapping geometry, and a rough stock block against a finished part often has very little.',
      'So the fallback is what every CAD system offers: point at two faces and say they go together.',
      'How much that settles is not a matter of opinion — it is a rank, and it can be measured.',
      'And what it does not settle has to be handed back to the user rather than guessed at.',
    ],
    callouts: [
      {
        type: 'insight',
        title: 'Six rows, five constraints, one degree of freedom',
        body: 'A mate says the normals oppose and the points coincide — six numbers that must all be zero. Measured by the rank of the constraint Jacobian, only five are independent: the singular values come out 8.717, 8.698, 1.000, 0.586, 0.115 and 1.6e-16. A unit normal lives on a sphere and has two degrees of freedom rather than three, so one of the three normal rows says nothing the other two did not. Five constraints against six parameters leaves exactly one.',
      },
      {
        type: 'warning',
        title: 'A single mate positions a face, not a part',
        body: 'The leftover freedom is a spin about the shared normal, and it is not cosmetic. Measured: the mate holds to 6.4e-16 at 0°, 45°, 90°, 180° and 270°, while a corner of the part 60 units from the mated face travels 0, 48.194, 89.051, 125.936 and 89.051 units. An interface that takes one mate and draws the result has picked that spin silently. The honest options are to expose it as something draggable, or to ask for a second constraint.',
      },
      {
        type: 'warning',
        title: 'The second mate breaks the first',
        body: 'Two mates write twelve rows against six parameters. The freedom goes, and so does the slack — there is no reason an arbitrary second face lands where the first mate put it, so in general no transform satisfies both. The least-squares compromise leaves a residual of 1.6489 (0.7490 from the normals, 1.4690 from the points), and the first mate, which was satisfied to 1.2e-16, is now off by 1.2268. Not a rounding error: over a unit.',
      },
      {
        type: 'insight',
        title: 'Anti-parallel is the normal case here, not an edge case',
        body: 'Mating two faces means making their normals oppose, so the rotation between them is close to or exactly a half turn. The cross product of a and −a is the zero vector, so the usual axis-angle construction has no axis to read off. Any code that treats this as a rare special case has treated the main case as rare.',
      },
      {
        type: 'warning',
        title: 'This lesson nearly shipped a false claim',
        body: 'The first measurement carried the pose as a rotation vector and recovered it from a matrix with the standard formula, which divides by sin(angle). At the 180° case that is a division by zero, and the measurement reported that spinning about the shared normal broke the mate — residuals of 2.04, 7.66 and 15.4. That is geometrically impossible: rotating about a vector cannot change that vector. Carrying the pose as (R, t) gives 1.2e-16 throughout. A result that contradicts geometry is a bug in the instrument, and the tell was that it was wrong in a way the world cannot be.',
      },
      {
        type: 'insight',
        title: 'The same failure as contested faces, in a new place',
        body: 'Lesson 12 measured 22.1% of a surface with two legitimate claimants and argued that resolving them silently throws away the only signal saying "look here". An over-constrained mate is the same situation: two legitimate claims, resolved by averaging, reported as though certain. The fix is the same — carry the disagreement alongside the answer.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'The mate is satisfied. The part is somewhere else.',
        caption: 'Spin about the shared normal and watch the residual stay at zero while the part travels.',
        props: {
          lesson: LESSON_MESH_2_2,
        },
      },
    ],
  },

  math: {
    prose: [
      'The first cell builds the mate and checks the matrix is a rotation rather than a reflection, which lesson 14 established is not automatic.',
      'Then the count, by the rank of the constraint Jacobian — the same instrument lesson 14 used on gimbal lock, taken as an increment at the current pose so nothing is ever parameterised far from the identity.',
      'Then what the leftover freedom does, and what happens when a second mate is added to remove it.',
      'The last cell is the instrument bug, kept deliberately: the textbook axis-angle recovery against the exact case this lesson lives in.',
    ],
    visualizations: [
      {
        id: 'PythonNotebook',
        title: 'Build it, count it, and find out what it cost',
        mathBridge: 'A rigid transform lives on a six-dimensional manifold, so any constraint on it can be written as a function whose zero set is the poses that satisfy it. The rank of that function’s Jacobian says how many directions the constraint actually resists; six minus the rank is the dimension of the solution set, which is what "degrees of freedom left" means precisely. A face mate gives six equations, but the three saying the normals oppose are equations on a unit vector, and a unit vector has only two independent components — which is why the rank comes out five rather than six, and why the answer is a one-dimensional family of poses rather than a single pose. Two mates give twelve equations on six unknowns, an over-determined system with no exact solution in general, so the best that exists is the least-squares minimiser and the residual is a real quantity rather than a failure to converge.',
        caption: 'Every figure measured, including the one that was wrong first.',
        props: {
          initialCells: PY_CELLS,
        },
      },
    ],
  },

  examples: [
    {
      title: 'The mate that holds while the part moves 126 units',
      prose: 'Spinning about the shared normal keeps the residual at 6.4e-16 through a full turn while a corner 60 units away sweeps a circle. The constraint is exact at every point on it.',
    },
    {
      title: 'Five of six',
      prose: 'Singular values 8.717, 8.698, 1.000, 0.586, 0.115, 1.6e-16. The last is zero to machine precision because a unit normal has two degrees of freedom, not three.',
    },
    {
      title: 'The compromise nobody asked for',
      prose: 'Two mates, least squares: residual 1.6489, and the first mate — previously exact to 1.2e-16 — is pushed off by 1.2268. The part ends up where neither mate specified.',
    },
    {
      title: 'The instrument reading 15.4 where the world says 0',
      prose: 'An axis-angle round trip at exactly 180° reported a spin breaking its own mate. Impossible by construction, which is what identified it as a tooling bug rather than a finding.',
    },
  ],

  challenges: [
    {
      prompt: 'Build the minimal rotation between two unit vectors, including the anti-parallel case the cross product cannot express.',
      hint: 'Zero cross product means either identical or opposed. The second needs a half turn about any perpendicular axis.',
    },
    {
      prompt: 'Count the degrees of freedom a constraint leaves, from the rank of its Jacobian, for one mate and for two.',
      hint: 'Six minus the number of meaningful singular values. Then confirm the freedom you counted is real by exercising it.',
    },
    {
      prompt: 'Fit two over-constrained mates by least squares and report how far the first mate was pushed.',
      hint: 'Gauss-Newton, applying each step as an increment to the matrix. Never accumulate angles.',
    },
    {
      prompt: 'In the browser, mate two faces and report the freedom rather than silently choosing it.',
      hint: 'The normals must oppose, not match. Reporting zero freedom claims a certainty the constraint does not have.',
    },
  ],

  misconceptions: [
    {
      claim: 'A face mate fully positions the part.',
      reality: 'It leaves one degree of freedom. Measured, the mate stays satisfied to 6.4e-16 while a corner travels 126 units. A single mate positions a face, not a part.',
    },
    {
      claim: 'A mate writes six constraints, which pins six parameters.',
      reality: 'Six rows, five independent. A unit normal has two degrees of freedom rather than three, so the smallest singular value is 1.6e-16 — a genuine rank deficiency, not noise.',
    },
    {
      claim: 'Adding a second mate removes the ambiguity cleanly.',
      reality: 'It over-constrains. Twelve rows on six parameters has no exact solution for arbitrary faces; least squares leaves 1.6489 and pushes the first mate — previously exact — off by 1.2268.',
    },
    {
      claim: 'Anti-parallel normals are a rare special case worth a quick guard.',
      reality: 'Mating two faces means opposing their normals, so it is the main case. The cross product is zero there and the standard construction has no axis to use.',
    },
    {
      claim: 'A rotation vector is a convenient way to pass a pose around.',
      reality: 'Recovering one from a matrix divides by sin(angle), which is zero at the 180° case mating always produces. It reported a spin breaking its own mate — residuals of 15.4 where the truth is 1.2e-16.',
    },
    {
      claim: 'If the solver converged, the answer is right.',
      reality: 'Least squares always converges to something. Convergence says nothing about whether the constraints were satisfiable, which is why the residual has to be reported rather than discarded.',
    },
  ],

  transferPrompts: [
    'A user mates two faces and the part looks wrong. What would you show them before changing any code?',
    'Your alignment tool takes three mates and always produces an answer. What should you be suspicious of?',
    'How would you decide whether a constraint system is under-constrained, exactly constrained, or over-constrained, without solving it?',
    'A measurement says something the geometry forbids. What is your first hypothesis?',
    'Where else in this application is a compromise being reported as though it were a solution?',
  ],

  debugging: [
    {
      symptom: 'The two parts interpenetrate after mating.',
      cause: 'The moving normal was aligned to the fixed normal rather than opposed to it.',
      fix: 'Align to −fixed.normal. Two faces that mate point away from each other.',
    },
    {
      symptom: 'The mate looks right but a feature is handed the wrong way.',
      cause: 'The rotation matrix has determinant −1 — it is a reflection.',
      fix: 'Check the determinant is +1 on every matrix the mate produces, as lesson 14 established.',
    },
    {
      symptom: 'Mating works for most face pairs and fails for some.',
      cause: 'The anti-parallel case, where the cross product is zero and the axis is undefined.',
      fix: 'Handle it explicitly: a half turn about any axis perpendicular to the source vector.',
    },
    {
      symptom: 'The part jumps to an unexpected orientation after one mate.',
      cause: 'Nothing is wrong. One mate leaves a spin free, and something chose it.',
      fix: 'Expose the remaining degree of freedom as a control rather than picking it silently.',
    },
    {
      symptom: 'Adding a second mate moved the first face off its target.',
      cause: 'Over-constrained. There is no pose satisfying both, so the solver compromised.',
      fix: 'Report the residual and offer to drop one. Measured, the first mate moves by 1.2268.',
    },
    {
      symptom: 'A spin about the mate axis appears to break the mate.',
      cause: 'A pose is being round-tripped through a rotation vector, and the case is 180°.',
      fix: 'Carry (R, t). The result contradicts geometry, so suspect the instrument first.',
    },
  ],

  mastery: {
    prerequisites:
      'Lesson 14 for rigid transforms, the determinant test and the warning about angle parameterisations — all three of which this lesson uses immediately. Lesson 12 for why an unreported ambiguity is worse than a reported one.',
    signals: [
      'Counts constraints against degrees of freedom before trusting a solver.',
      'Carries poses as matrices and never round-trips through angles.',
      'Treats the anti-parallel case as the main case, not an exception.',
      'Reports residuals on over-determined systems rather than presenting the compromise as the answer.',
      'Suspects the instrument when a measurement contradicts geometry.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'mesh-engine-2-1-coordinate-systems', why: 'Rigid transforms, the determinant test, and why angle parameterisations are treacherous.' },
      { lessonId: 'mesh-engine-1-2-vectors-and-triangles', why: 'The cross product, and what it means when it vanishes.' },
      { lessonId: 'mesh-engine-1-12-attribution', why: 'The argument for carrying a disagreement alongside an answer instead of resolving it silently.' },
    ],
    futureLinks: [],
  },

  checkpoints: [
    'I can say how many degrees of freedom a rigid transform has and how many one face mate removes.',
    'I can explain why six constraint rows give only five independent constraints.',
    'I can demonstrate that the leftover freedom moves the part without breaking the mate.',
    'I can say what happens when two mates are applied to arbitrary faces.',
    'I can build the rotation between two unit vectors including the anti-parallel case.',
    'I can recognise a measurement that contradicts geometry as an instrument bug.',
  ],

  assessment: {
    task: 'Given a stock model in the wrong frame and a part, bring them together by hand and state exactly what the alignment does and does not determine.',
    acceptance: [
      'Normals opposed rather than matched, and the determinant checked as +1.',
      'The anti-parallel case handled explicitly rather than guarded against.',
      'The pose carried as (R, t), with angles used only to build matrices.',
      'The leftover degree of freedom reported and exposed rather than chosen.',
      'Any over-constrained combination solved by least squares with its residual shown.',
      'The user able to see how far each individual mate was pushed by the compromise.',
    ],
  },

  quiz: [
    {
      question: 'How many degrees of freedom does one face mate leave?',
      options: [
        'One — a spin about the shared normal',
        'Zero; the part is fully positioned',
        'Three, since only the rotation is constrained',
        'It depends on the shape of the faces',
      ],
      answer: 0,
      explanation: 'Six constraint rows, five independent, six parameters. Measured, the mate holds to 6.4e-16 through a full spin while a corner travels 126 units.',
    },
    {
      question: 'Why are only five of the six constraint rows independent?',
      options: [
        'A unit normal has two degrees of freedom, not three, so one normal row adds nothing',
        'Floating-point error makes one row unreliable',
        'The point constraint absorbs one of the normal constraints',
        'The Jacobian is computed with too large a step',
      ],
      answer: 0,
      explanation: 'The smallest singular value comes out 1.6e-16 against a largest of 8.717 — a genuine rank deficiency, not numerical noise.',
    },
    {
      question: 'What happens when a second mate is added on arbitrary faces?',
      options: [
        'It over-constrains: no exact solution, and the first mate gets pushed off by 1.2268',
        'The part becomes fully and correctly positioned',
        'The solver fails to converge',
        'The second mate is ignored',
      ],
      answer: 0,
      explanation: 'Twelve rows on six parameters. Least squares leaves a residual of 1.6489, and the previously exact first mate moves by over a unit.',
    },
    {
      question: 'Why does the anti-parallel case matter so much here?',
      options: [
        'Mating faces means opposing their normals, so it is the main case — and the cross product is zero there',
        'It only arises when the model is mirrored',
        'It is rare, but causes a crash when it happens',
        'It does not; the general formula covers it',
      ],
      answer: 0,
      explanation: 'The cross product of a and −a is the zero vector, so there is no axis to read off. Code treating this as exceptional has treated the main case as exceptional.',
    },
    {
      question: 'A measurement reports that spinning about the shared normal breaks the mate. What is the first hypothesis?',
      options: [
        'The instrument is wrong — rotating about a vector cannot change that vector',
        'The mate was never satisfied in the first place',
        'Floating-point error accumulated over the spin',
        'The faces are not actually parallel',
      ],
      answer: 0,
      explanation: 'This happened while building this lesson: a rotation-vector round trip at exactly 180°, where the axis-angle recovery divides by sin(angle) = 0. The result was wrong in a way the world cannot be.',
    },
    {
      question: 'What must an alignment tool show the user after an over-constrained fit?',
      options: [
        'The residual, and how far each individual mate was pushed by the compromise',
        'Nothing; the solver found the best answer available',
        'Only whether the solver converged',
        'A warning that the model may be mirrored',
      ],
      answer: 0,
      explanation: 'A compromise presented as a solution is a lie about certainty — the same failure as lesson 12 silently resolving contested faces.',
    },
  ],
};
