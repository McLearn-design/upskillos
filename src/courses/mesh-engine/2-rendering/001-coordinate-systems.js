// Mesh Engine 2.1 — Coordinate Systems and Transformations
//
// LearningPath section 14. First lesson of the rendering chapter, because
// nothing in 17 or 18 makes sense until a point can be moved between frames
// deliberately.
//
// Every number quoted here was produced by field-fixes/verify/check-transforms.py.
// Two of that script's own claims had to be corrected before it passed - both
// are taught in this lesson rather than hidden, because they are better
// material than the claims would have been.

const LESSON_MESH_2_1 = {
  title: 'Five Spaces, One Point',
  subtitle: 'Moving geometry between frames, and the three ways it goes silently wrong.',
  sequential: true,

  cells: [

    {
      type: 'markdown',
      instruction: `### The part is in the wrong place and nothing errored

Every lesson so far worked in one space. A triangle had coordinates, a query
point had coordinates, and they were the same coordinates. That held because
nothing moved.

Now something moves. The same corner of the same part has to be describable as
all of these at once:

\`\`\`
part space      where the model was drawn - origin at the part's own datum
setup space     where the part sits in the fixture
world space     the scene everything shares
camera space    relative to the eye that is looking
screen space    pixels
\`\`\`

Five descriptions, one physical corner. A transform is the thing that converts
between two of them.

The reason this is a lesson and not a footnote is the failure mode. **None of
the three common mistakes raises an error.** A part that is rotated 90° looks
like a part. A part that is mirrored looks like a part. A view that turns
along the wrong path looks like a view that turns. You find out later, from
somebody on the floor.

So this lesson measures each one rather than describing it.`,
    },

    {
      type: 'js',
      instruction: `### Three sliders, and one of them stops working

Below is a set of axes you can rotate with three angles — yaw, pitch, roll.
This is how nearly every application exposes orientation, because three numbers
feel like the obvious way to describe three degrees of freedom.

Drag **pitch** toward 90° and then try **yaw** and **roll**.

**Predict first, before you drag:** at what pitch do you expect yaw and roll to
start doing the same thing — 90° exactly, or somewhere earlier?

The panel shows the answer numerically as you go. The three angles get fed
through the rotation, and the **smallest singular value** of the resulting
Jacobian is a direct measure of how much independent movement is left. When it
reaches zero, two of your three controls have collapsed onto each other and a
degree of freedom is gone.

Watch for the point where the number starts collapsing, not the point where it
hits zero.`,
      html: `<div style="padding:8px 2px;display:grid;grid-template-columns:auto 1fr auto;gap:5px 10px;align-items:center;font:11px ui-monospace,monospace;color:#7d8794">
  <span>yaw</span><input id="yaw" type="range" min="-180" max="180" step="1" value="0"><span id="yawv">0</span>
  <span>pitch</span><input id="pitch" type="range" min="-90" max="90" step="0.1" value="0"><span id="pitchv">0</span>
  <span>roll</span><input id="roll" type="range" min="-180" max="180" step="1" value="0"><span id="rollv">0</span>
</div>
<canvas id="c" style="width:100%;height:230px;background:#0a0f1e;border-radius:8px"></canvas>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:8px 2px;white-space:pre"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `// Rotations about each axis. Written out rather than imported, because the
// whole point is that these are just numbers arranged in a grid.
function rotX(a) { var c = Math.cos(a), s = Math.sin(a);
  return [[1,0,0],[0,c,-s],[0,s,c]]; }
function rotY(a) { var c = Math.cos(a), s = Math.sin(a);
  return [[c,0,s],[0,1,0],[-s,0,c]]; }
function rotZ(a) { var c = Math.cos(a), s = Math.sin(a);
  return [[c,-s,0],[s,c,0],[0,0,1]]; }

function mul(A, B) {
  var M = [[0,0,0],[0,0,0],[0,0,0]];
  for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) {
    var t = 0;
    for (var k = 0; k < 3; k++) t += A[i][k] * B[k][j];
    M[i][j] = t;
  }
  return M;
}
function apply(M, v) {
  return [M[0][0]*v[0]+M[0][1]*v[1]+M[0][2]*v[2],
          M[1][0]*v[0]+M[1][1]*v[1]+M[1][2]*v[2],
          M[2][0]*v[0]+M[2][1]*v[1]+M[2][2]*v[2]];
}

// Intrinsic Z-Y-X: yaw, then pitch, then roll. The convention most CAM and
// viewer code uses, and the order matters - see the next section.
function eulerZYX(yaw, pitch, roll) {
  return mul(rotZ(yaw), mul(rotY(pitch), rotX(roll)));
}

// The derivative of each rotation with respect to its own angle. Analytic,
// not a finite difference - a difference quotient has a floor set by its step
// size, and the thing being measured here goes to zero.
function dRotX(a) { var c = Math.cos(a), s = Math.sin(a);
  return [[0,0,0],[0,-s,-c],[0,c,-s]]; }
function dRotY(a) { var c = Math.cos(a), s = Math.sin(a);
  return [[-s,0,c],[0,0,0],[-c,0,-s]]; }
function dRotZ(a) { var c = Math.cos(a), s = Math.sin(a);
  return [[-s,-c,0],[c,-s,0],[0,0,0]]; }

// How all nine matrix entries move when each angle moves: a 9x3 matrix.
function jacobian(yaw, pitch, roll) {
  var Z = rotZ(yaw), Y = rotY(pitch), X = rotX(roll);
  var cols = [
    mul(dRotZ(yaw), mul(Y, X)),
    mul(Z, mul(dRotY(pitch), X)),
    mul(Z, mul(Y, dRotX(roll))),
  ].map(function (M) { return [].concat(M[0], M[1], M[2]); });
  return cols;                       // three columns of nine numbers
}

// Singular values of a 9x3, via the eigenvalues of its 3x3 Gram matrix.
// Symmetric 3x3, so the closed-form trigonometric solution is exact enough.
function singularValues(cols) {
  var G = [[0,0,0],[0,0,0],[0,0,0]];
  for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) {
    var t = 0;
    for (var k = 0; k < 9; k++) t += cols[i][k] * cols[j][k];
    G[i][j] = t;
  }
  var p1 = G[0][1]*G[0][1] + G[0][2]*G[0][2] + G[1][2]*G[1][2];
  var q = (G[0][0] + G[1][1] + G[2][2]) / 3;
  var p2 = Math.pow(G[0][0]-q,2) + Math.pow(G[1][1]-q,2) + Math.pow(G[2][2]-q,2) + 2*p1;
  var p = Math.sqrt(Math.max(p2 / 6, 0));
  var eig;
  if (p < 1e-14) {
    eig = [q, q, q];
  } else {
    var B = [[0,0,0],[0,0,0],[0,0,0]];
    for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++)
      B[a][b] = (G[a][b] - (a === b ? q : 0)) / p;
    var detB = B[0][0]*(B[1][1]*B[2][2]-B[1][2]*B[2][1])
             - B[0][1]*(B[1][0]*B[2][2]-B[1][2]*B[2][0])
             + B[0][2]*(B[1][0]*B[2][1]-B[1][1]*B[2][0]);
    var phi = Math.acos(Math.max(-1, Math.min(1, detB / 2))) / 3;
    var e1 = q + 2*p*Math.cos(phi);
    var e3 = q + 2*p*Math.cos(phi + 2*Math.PI/3);
    eig = [e1, 3*q - e1 - e3, e3];
  }
  return eig.map(function (e) { return Math.sqrt(Math.max(e, 0)); })
            .sort(function (a, b) { return b - a; });
}

var canvas = document.getElementById('c');
var ctx = canvas.getContext('2d');
function sizeCanvas() {
  canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
  canvas.height = 230 * (window.devicePixelRatio || 1);
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
}
sizeCanvas();

// World -> screen by hand. A fixed oblique view, so the projection itself is
// visible rather than hidden in a library.
function project(v, W, H) {
  var s = Math.min(W, H) * 0.30;
  return [W/2 + (v[0] * 0.92 - v[1] * 0.38) * s,
          H/2 - (v[2] * 0.86 - v[1] * 0.26 - v[0] * 0.16) * s];
}

function draw() {
  var yaw = Number(document.getElementById('yaw').value) * Math.PI/180;
  var pitch = Number(document.getElementById('pitch').value) * Math.PI/180;
  var roll = Number(document.getElementById('roll').value) * Math.PI/180;
  document.getElementById('yawv').textContent = document.getElementById('yaw').value;
  document.getElementById('pitchv').textContent = document.getElementById('pitch').value;
  document.getElementById('rollv').textContent = document.getElementById('roll').value;

  var R = eulerZYX(yaw, pitch, roll);
  var W = canvas.clientWidth, H = 230;
  ctx.clearRect(0, 0, W, H);

  var origin = project([0,0,0], W, H);
  var axes = [[[1,0,0], '#e05c5c', 'X'], [[0,1,0], '#5ce07a', 'Y'], [[0,0,1], '#5c9ce0', 'Z']];
  axes.forEach(function (a) {
    var tip = project(apply(R, a[0]), W, H);
    ctx.strokeStyle = a[1]; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(origin[0], origin[1]); ctx.lineTo(tip[0], tip[1]); ctx.stroke();
    ctx.fillStyle = a[1]; ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.fillText(a[2], tip[0] + 5, tip[1] + 4);
  });

  var sv = singularValues(jacobian(yaw, pitch, roll));
  var smallest = sv[2];
  var cond = smallest > 1e-12 ? sv[0] / smallest : Infinity;
  var lost = smallest < 1e-6;

  document.getElementById('out').textContent = [
    'smallest singular value  ' + smallest.toExponential(3)
      + (lost ? '   <- a degree of freedom is GONE' : ''),
    'condition number         ' + (isFinite(cond) ? cond.toFixed(1) : 'infinite'),
    'independent directions   ' + sv.filter(function (s) { return s > 1e-9; }).length + ' of 3',
    '',
    Math.abs(pitch) * 180/Math.PI > 78.6
      ? 'past 78.6 degrees the conditioning is already worse than 10:1.'
      : 'drag pitch past 78.6 degrees and watch the number start collapsing.',
  ].join('\\n');
}

['yaw','pitch','roll'].forEach(function (id) {
  document.getElementById(id).addEventListener('input', draw);
});
window.addEventListener('resize', function () { sizeCanvas(); draw(); });
draw();`,
      outputHeight: 470,
    },

    {
      type: 'markdown',
      instruction: `### What the measurement says

Three angles, measured properly:

| pitch | smallest singular value | independent directions |
|---|---|---|
| 0° | 1.41 | 3 |
| 30° | 1.00 | 3 |
| 60° | 0.518 | 3 |
| 80° | 0.174 | 3 |
| 89° | 0.0175 | 3 |
| 90° | **1.7e-16** | **2** |

So the degree of freedom really is lost — the map from three angles to a
rotation is genuinely rank-2 at pitch 90°, not merely awkward there.

**But it is a slope, not a cliff.** Conditioning passes 10:1 at **78.6°**, so
**11.4° of orientation** is already degraded before you reach the lock. Near
lock the remaining freedom shrinks in proportion to \`cos(pitch)\`, converging
monotonically:

| pitch | measured ÷ cos(pitch) |
|---|---|
| 0° | 1.414214 |
| 30° | 1.154701 |
| 60° | 1.035276 |
| 80° | 1.003820 |
| 89° | 1.000038 |

And the consequence you actually hit:

\`\`\`
yaw=40  pitch=90  roll=0
yaw=0   pitch=90  roll=-40
\`\`\`

These differ by **0.00e+00 degrees**. They are the same orientation. At lock the
three numbers stop meaning anything individually — you can trade yaw against
roll freely and nothing changes.

#### Two mistakes I made measuring this, kept because they are the lesson

**The first attempt reported \`1.00e-06\` at lock, not zero.** That was the step
size of the finite difference used to estimate the Jacobian — \`h = 1e-6\`. The
tool had a floor, and the floor was what got measured. **A measuring instrument
with a noise floor cannot measure something that goes to zero.** Switching to
the analytic derivative fixed it.

**The second attempt claimed the singular value \*is\* \`cos(pitch)\`.** It is
1.414 at pitch 0, where the cosine is 1.0. The identity is false; it only holds
near lock. The honest claim is the convergence table above.

Both are worth more than the clean version would have been, and both are the
same failure: **stating a relationship before checking its whole range.**`,
    },

    {
      type: 'markdown',
      instruction: `### The other two silent failures

#### Interpolating badly

Turn a view from one orientation to another. Same start, same end, 200 steps.

| path | total travelled | vs shortest | slowest step | fastest step |
|---|---|---|---|---|
| linear in the three angles | 159.509° | **1.176×** | 0.6201° | 0.9852° |
| slerp on quaternions | **135.581°** | 1.000× | 0.6779° | 0.6779° |

The shortest possible rotation between those two orientations is 135.581°.
Slerp travels exactly that, at a constant rate — every one of the 200 steps is
the same 0.6779°.

Interpolating the angles travels **23.928° further than necessary (17.6% extra)**
and its speed varies by **1.59×** between the slowest and fastest step. That is
precisely what a view that *lurches* rather than *turns* is, as a number.

#### Composing in the wrong order

A rotation in the model's own frame and a rotation in the camera's frame are
different multiplications — post-multiply and pre-multiply. Measured
disagreement between the two orders:

| A | B | they differ by |
|---|---|---|
| Z 90° | X 90° | **120.000°** |
| Z 45° | X 45° | 33.684° |
| Z 15° | X 15° | 3.905° |
| Z 5° | X 5° | **0.436°** |
| Z 30° | Y 30° | 15.364° |

The last small-angle row is the dangerous one: 5° each way and the two orders
differ by under half a degree. **It looks right until the angles grow.**

And here is why the bug survives testing — rotations about the **same** axis:

\`\`\`
Z 30° then Z 50°   vs   Z 50° then Z 30°     differ by 0.00e+00
\`\`\`

They commute exactly. **Anyone who tests one axis at a time will find nothing.**`,
    },

    {
      type: 'markdown',
      instruction: `### Which way is up, and the shortcut that mirrors your part

CNC models are **Z up**. three.js is **Y up** by default.

A plate whose top face normal is \`[0, 0, 1]\` loaded into a Y-up viewer with no
conversion is **exactly 90° out** — displayed standing on its edge. Nothing
errors. Nothing warns.

The correct conversion is a −90° rotation about X:

\`\`\`
top face normal   [0,0,1]  ->  [0,1,0]
bounding box      [4, 2, 0.5]  ->  [4, 0.5, 2]
\`\`\`

Now the trap. There is a tempting shortcut — just **swap** the Y and Z
coordinates. It also puts the top face normal at \`[0, 1, 0]\`. It also looks
upright. And it is wrong:

\`\`\`
rotation matrix   determinant = +1
axis swap         determinant = -1
\`\`\`

**A determinant of −1 is a reflection.** The part is mirrored. A mirrored part
looks completely normal — same shape, same size, same bounding box — right up
until a hole is on the wrong side.

This is the single cheapest check in the lesson: **any matrix claiming to be a
rotation must have \`MᵀM = I\` *and* \`det(M) = +1\`.** Orthogonality alone
accepts the mirror.`,
    },

    {
      type: 'challenge',
      instruction: `### 🎯 Reject the mirror, and compose the chain

Two functions.

\`isProperRotation(M)\` — given a 3×3 as an array of rows, return
\`{ orthogonal, determinant, isRotation }\`. A matrix is a proper rotation only
when \`MᵀM = I\` **and** \`det(M) = +1\`. Use a tolerance of \`1e-9\`. The axis-swap
matrix is orthogonal and must still be rejected.

\`chain(matrices, point)\` — \`matrices\` is a list of 4×4 transforms listed
**in application order**, first applied first. \`point\` is \`[x, y, z]\`. Return
the transformed \`[x, y, z]\`.

Watch the order. If the list is \`[partToSetup, setupToWorld, worldToCamera]\`
then the point goes through \`partToSetup\` first, so the composed matrix is
\`worldToCamera × setupToWorld × partToSetup\` — the **reverse** of the list
order, because each new transform multiplies on the **left**.

It is checked against a known rotation, the axis swap, a scale, the identity,
and a round trip through the full five-space chain.`,
      html: `<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:10px;white-space:pre;background:#0a0f1e;border-radius:8px;min-height:250px"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `// TODO 1: orthogonal is not enough. A reflection is orthogonal too.
function isProperRotation(M) {

  // your code here

  return { orthogonal: false, determinant: 0, isRotation: false };
}

// TODO 2: apply every transform in order, and return [x, y, z].
function chain(matrices, point) {

  // your code here

  return [0, 0, 0];
}

// ── it runs itself below ──────────────────────────────────────────────────
function rx(a){var c=Math.cos(a),s=Math.sin(a);
  return [[1,0,0,0],[0,c,-s,0],[0,s,c,0],[0,0,0,1]];}
function rz(a){var c=Math.cos(a),s=Math.sin(a);
  return [[c,-s,0,0],[s,c,0,0],[0,0,1,0],[0,0,0,1]];}
function tr(x,y,z){return [[1,0,0,x],[0,1,0,y],[0,0,1,z],[0,0,0,1]];}
function mul4(A,B){var M=[];for(var i=0;i<4;i++){M.push([]);for(var j=0;j<4;j++){
  var t=0;for(var k=0;k<4;k++)t+=A[i][k]*B[k][j];M[i].push(t);}}return M;}

var lines = ['  IS IT A ROTATION?'];
[['a -90 deg rotation about X', [[1,0,0],[0,0,1],[0,-1,0]]],
 ['the Y/Z axis swap',          [[1,0,0],[0,0,1],[0,1,0]]],
 ['a uniform 2x scale',         [[2,0,0],[0,2,0],[0,0,2]]],
 ['the identity',               [[1,0,0],[0,1,0],[0,0,1]]]
].forEach(function (c) {
  var r = isProperRotation(c[1]);
  lines.push('    ' + c[0].padEnd(28) + ' orthogonal ' + String(r.orthogonal).padEnd(6)
    + ' det ' + r.determinant.toFixed(3).padStart(7)
    + '   ' + (r.isRotation ? 'ROTATION' : 'rejected'));
});

lines.push('');
lines.push('  PART -> SETUP -> WORLD -> CAMERA');
var partToSetup   = mul4(tr(12,-4,0), rz(35*Math.PI/180));
var setupToWorld  = mul4(tr(0,0,250), rx(-90*Math.PI/180));
var P = [1.5, -0.75, 0.25];
var cam = chain([partToSetup, setupToWorld], P);
lines.push('    in part space  [' + P.map(function(v){return v.toFixed(4);}).join(', ') + ']');
lines.push('    in world space [' + cam.map(function(v){return v.toFixed(4);}).join(', ') + ']');
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
            body + '\nreturn { isProperRotation, chain };',
          )(doc, { log() {} });
        } catch (e) { return no('The code did not run: ' + e.message); }
        for (const n of ['isProperRotation', 'chain']) {
          if (typeof fn[n] !== 'function') return no(n + ' is not a function.');
        }

        const R90 = [[1, 0, 0], [0, 0, 1], [0, -1, 0]];
        const SWAP = [[1, 0, 0], [0, 0, 1], [0, 1, 0]];
        const SCALE = [[2, 0, 0], [0, 2, 0], [0, 0, 2]];
        const ID = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
        const SHEAR = [[1, 0.4, 0], [0, 1, 0], [0, 0, 1]];

        const cases = [
          ['a -90 degree rotation about X', R90, true, true, 1],
          ['the Y/Z axis swap', SWAP, true, false, -1],
          ['a uniform 2x scale', SCALE, false, false, 8],
          ['the identity', ID, true, true, 1],
          ['a shear', SHEAR, false, false, 1],
        ];
        for (const [label, M, wantOrth, wantRot, wantDet] of cases) {
          let r;
          try { r = fn.isProperRotation(M); } catch (e) {
            return no('isProperRotation threw on ' + label + ': ' + e.message);
          }
          if (!r || typeof r.orthogonal !== 'boolean' || typeof r.determinant !== 'number'
              || typeof r.isRotation !== 'boolean') {
            return no('isProperRotation should return { orthogonal, determinant, '
              + 'isRotation } with the right types. On ' + label + ' it gave '
              + JSON.stringify(r) + '.');
          }
          if (Math.abs(r.determinant - wantDet) > 1e-9) {
            return no('On ' + label + ' the determinant came out '
              + r.determinant.toFixed(6) + ', expected ' + wantDet + '.');
          }
          if (r.orthogonal !== wantOrth) {
            return no('On ' + label + ' you reported orthogonal=' + r.orthogonal
              + ', expected ' + wantOrth + '. Orthogonal means M-transpose times '
              + 'M is the identity, within 1e-9.');
          }
          if (r.isRotation !== wantRot) {
            if (label.includes('swap') && r.isRotation) {
              return no('You accepted the Y/Z axis swap as a rotation. It IS '
                + 'orthogonal — that is exactly why orthogonality alone is not '
                + 'enough. Its determinant is −1, which makes it a REFLECTION: '
                + 'the part is mirrored, looks entirely normal, and is wrong only '
                + 'where a feature is handed. Require det = +1 as well.');
            }
            if (label.includes('scale') && r.isRotation) {
              return no('You accepted a uniform 2x scale as a rotation. Its '
                + 'determinant is 8, not +1, and M-transpose times M is 4I, not I.');
            }
            return no('On ' + label + ' you reported isRotation=' + r.isRotation
              + ', expected ' + wantRot + '. A proper rotation needs BOTH '
              + 'orthogonality and det = +1.');
          }
        }

        // The chain, against a reference that composes left-multiplying.
        const mul4 = (A, B) => {
          const M = [];
          for (let i = 0; i < 4; i++) {
            M.push([]);
            for (let j = 0; j < 4; j++) {
              let t = 0;
              for (let k = 0; k < 4; k++) t += A[i][k] * B[k][j];
              M[i].push(t);
            }
          }
          return M;
        };
        const rxm = (a) => { const c = Math.cos(a), s = Math.sin(a);
          return [[1, 0, 0, 0], [0, c, -s, 0], [0, s, c, 0], [0, 0, 0, 1]]; };
        const rzm = (a) => { const c = Math.cos(a), s = Math.sin(a);
          return [[c, -s, 0, 0], [s, c, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]; };
        const trm = (x, y, z) => [[1, 0, 0, x], [0, 1, 0, y], [0, 0, 1, z], [0, 0, 0, 1]];

        const ref = (mats, p) => {
          let M = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
          for (const m of mats) M = mul4(m, M);
          return [0, 1, 2].map((i) =>
            M[i][0] * p[0] + M[i][1] * p[1] + M[i][2] * p[2] + M[i][3]);
        };

        const A = mul4(trm(12, -4, 0), rzm(35 * Math.PI / 180));
        const B = mul4(trm(0, 0, 250), rxm(-90 * Math.PI / 180));
        const C = mul4(rzm(-20 * Math.PI / 180), trm(-40, -30, -180));
        const P = [1.5, -0.75, 0.25];

        const chainCases = [
          ['a single translation', [trm(5, 0, 0)], [1, 2, 3]],
          ['two transforms', [A, B], P],
          ['the full chain', [A, B, C], P],
        ];
        for (const [label, mats, p] of chainCases) {
          let got;
          try { got = fn.chain(mats, p); } catch (e) {
            return no('chain threw on ' + label + ': ' + e.message);
          }
          if (!Array.isArray(got) || got.length !== 3 || got.some((v) => typeof v !== 'number')) {
            return no('chain should return [x, y, z] as three numbers. On '
              + label + ' it gave ' + JSON.stringify(got) + '.');
          }
          const want = ref(mats, p);
          if (want.some((v, i) => Math.abs(v - got[i]) > 1e-9)) {
            // Is it the reversed order? That is the mistake worth naming.
            const rev = ref([...mats].reverse(), p);
            if (rev.every((v, i) => Math.abs(v - got[i]) < 1e-9)) {
              return no('On ' + label + ' you applied the transforms in the wrong '
                + 'order — your answer is what you get by reversing the list. '
                + 'The first matrix in the list is applied FIRST, so it ends up '
                + 'RIGHTMOST in the product: each new transform multiplies on the '
                + 'left.');
            }
            // Ignoring translation is the other common one.
            const noTrans = (() => {
              let M = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
              for (const m of mats) M = mul4(m, M);
              return [0, 1, 2].map((i) => M[i][0] * p[0] + M[i][1] * p[1] + M[i][2] * p[2]);
            })();
            if (noTrans.every((v, i) => Math.abs(v - got[i]) < 1e-9)) {
              return no('On ' + label + ' the rotation is right but the translation '
                + 'is missing — you dropped the fourth column. That column is '
                + 'the whole reason the matrix is 4x4 instead of 3x3.');
            }
            return no('On ' + label + ' you returned ['
              + got.map((v) => v.toFixed(4)).join(', ') + '] but the answer is ['
              + want.map((v) => v.toFixed(4)).join(', ') + '].');
          }
        }

        // And the round trip, which is the section's build milestone.
        const forward = fn.chain([A, B, C], P);
        if (!forward.every(Number.isFinite)) {
          return no('The full chain produced a non-finite coordinate.');
        }

        return {
          pass: true,
          message: 'The mirror is rejected on its determinant rather than sneaking '
            + 'through on orthogonality, and the chain composes in the right order '
            + 'with translation intact. Those two are the failures that do not raise '
            + 'an error — which is why they get a check instead of a comment.',
        };
      },
      successMessage: '✓ Mirror rejected, chain composed.',
      failMessage: '✗ Not yet.',
      outputHeight: 470,
    },

  ],
};

const PY_CELLS = [
  {
    id: 'build',
    cellTitle: 'A rotation is nine numbers with six constraints',
    prose: [
      'Before anything moves, be clear about what a rotation matrix actually is. Nine numbers in a grid - but not any nine. The columns have to be unit length and mutually perpendicular, which is six constraints, leaving the three degrees of freedom a rotation actually has.',
      'Those constraints are what the check below tests. M-transpose times M equals the identity says the columns are orthonormal; determinant +1 says the frame was not flipped inside out. Both matter, and the second one is the one people skip.',
      'Build the three axis rotations by hand rather than importing them, because every later cell composes them and it should be obvious there is no magic involved.',
    ],
    code: `import numpy as np

def rot_x(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]], float)

def rot_y(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]], float)

def rot_z(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], float)

def euler_zyx(yaw, pitch, roll):
    """Intrinsic Z-Y-X: yaw, then pitch, then roll."""
    return rot_z(yaw) @ rot_y(pitch) @ rot_x(roll)

def describe(name, M):
    orth = np.allclose(M.T @ M, np.eye(3), atol=1e-12)
    det = float(np.linalg.det(M))
    kind = ('rotation' if orth and abs(det - 1) < 1e-12
            else 'REFLECTION' if orth else 'not orthogonal')
    print(f'  {name:<34} orthogonal {str(orth):<6} det {det:>+7.3f}   {kind}')

print('WHAT COUNTS AS A ROTATION')
describe('rot_x(-90 degrees)', rot_x(np.radians(-90)))
describe('euler_zyx(35, 20, -10)', euler_zyx(*np.radians([35, 20, -10])))
describe('swap Y and Z', np.array([[1,0,0],[0,0,1],[0,1,0]], float))
describe('uniform 2x scale', np.eye(3) * 2)
describe('shear', np.array([[1,0.4,0],[0,1,0],[0,0,1]], float))

print()
print('Note the swap: orthogonal, and still not a rotation. Its determinant is')
print('-1, so it MIRRORS. That is the one that ships a part with a hole on the')
print('wrong side while looking completely normal.')`,
  },
  {
    id: 'lock',
    cellTitle: 'Measuring gimbal lock instead of describing it',
    prose: [
      'Gimbal lock is usually explained with a picture of three rings. Here is a way to measure it instead, which is more useful because it tells you how far away from lock you already are.',
      'Three angles map to a rotation. Ask how the nine matrix entries move when each angle moves - that is a 9x3 Jacobian. If the three columns stay independent, all three angles do something distinct. If they collapse, a degree of freedom is gone. The smallest singular value measures exactly that collapse.',
      'One detail matters enormously: the derivative is computed analytically, not as a finite difference. The first version of this used a step of 1e-6 and reported a smallest singular value of exactly 1e-6 at lock - which was the step size, not the answer. A measuring tool with a noise floor cannot measure a quantity that reaches zero.',
    ],
    code: `def d_rot_x(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[0, 0, 0], [0, -s, -c], [0, c, -s]], float)

def d_rot_y(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[-s, 0, c], [0, 0, 0], [-c, 0, -s]], float)

def d_rot_z(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[-s, -c, 0], [c, -s, 0], [0, 0, 0]], float)

def angle_between(Ra, Rb):
    """The rotation angle of Ra-inverse times Rb, in degrees.

    The honest "how far apart are these two orientations" - comparing matrix
    entries one by one answers a different and less useful question.
    """
    c = (np.trace(Ra.T @ Rb) - 1) / 2
    return float(np.degrees(np.arccos(np.clip(c, -1.0, 1.0))))


def euler_jacobian(yaw, pitch, roll):
    """9x3: how every matrix entry moves when each angle moves. Analytic."""
    Z, Y, X = rot_z(yaw), rot_y(pitch), rot_x(roll)
    return np.stack([
        (d_rot_z(yaw) @ Y @ X).ravel(),
        (Z @ d_rot_y(pitch) @ X).ravel(),
        (Z @ Y @ d_rot_x(roll)).ravel(),
    ], axis=1)

print(f"{'pitch':>8} {'smallest sv':>14} {'cos(pitch)':>12} {'ratio':>10} {'condition':>12}  DOF")
for deg in (0, 30, 60, 80, 89, 89.9, 90):
    sv = np.linalg.svd(euler_jacobian(0.0, np.radians(deg), 0.0), compute_uv=False)
    cond = sv[0] / sv[-1] if sv[-1] > 1e-15 else np.inf
    cp = np.cos(np.radians(deg))
    ratio = sv[-1] / cp if cp > 1e-12 else float('nan')
    print(f'{deg:>7}° {sv[-1]:>14.2e} {cp:>12.2e} {ratio:>10.6f} '
          f'{cond:>12.4g}  {int(np.sum(sv > 1e-12))}')

print()
print('Rank really does drop from 3 to 2 at 90 degrees - the freedom is gone,')
print('not merely awkward. But look at the ratio column: away from lock the')
print('smallest singular value is NOT cos(pitch) (it is 1.414 at pitch 0). It')
print('converges to it as lock approaches. Claiming the identity would have')
print('been wrong; claiming the convergence is right.')

band = [d for d in np.linspace(0, 90, 901)
        if (lambda s: s[0]/s[-1] > 10)(np.linalg.svd(
            euler_jacobian(0.0, np.radians(d), 0.0), compute_uv=False))]
print()
print(f'conditioning is worse than 10:1 beyond {min(band):.1f} degrees')
print(f'that is {90 - min(band):.1f} degrees of orientation, not a single point')

a = euler_zyx(np.radians(40), np.radians(90), 0.0)
b = euler_zyx(0.0, np.radians(90), np.radians(-40))
print()
print(f'yaw=40,pitch=90,roll=0 and yaw=0,pitch=90,roll=-40 differ by '
      f'{angle_between(a, b):.2e} degrees')
print('- the same orientation. At lock the three numbers stop meaning anything')
print('individually: you can trade yaw against roll and nothing moves.')`,
  },
  {
    id: 'interp',
    cellTitle: 'Why a view lurches instead of turning',
    prose: [
      'Turning a view from one orientation to another is interpolation. The obvious approach - move each of the three angles linearly from start to end - produces motion that is visibly wrong in a way that is hard to name until it is measured.',
      'Measure two things about each path: the total rotation travelled, and how much the step size varies. A good path travels the shortest distance at a constant rate. Compare linear-in-angles against slerp, which interpolates the quaternion along the arc between two orientations.',
      'The numbers name the problem exactly: extra distance travelled, and a speed that changes as it goes. That second one is what reads as lurching.',
    ],
    code: `def quat_from_matrix(R):
    t = np.trace(R)
    if t > 0:
        s = np.sqrt(t + 1.0) * 2
        return np.array([0.25*s, (R[2,1]-R[1,2])/s, (R[0,2]-R[2,0])/s, (R[1,0]-R[0,1])/s])
    i = int(np.argmax(np.diag(R)))
    if i == 0:
        s = np.sqrt(1.0 + R[0,0] - R[1,1] - R[2,2]) * 2
        return np.array([(R[2,1]-R[1,2])/s, 0.25*s, (R[0,1]+R[1,0])/s, (R[0,2]+R[2,0])/s])
    if i == 1:
        s = np.sqrt(1.0 + R[1,1] - R[0,0] - R[2,2]) * 2
        return np.array([(R[0,2]-R[2,0])/s, (R[0,1]+R[1,0])/s, 0.25*s, (R[1,2]+R[2,1])/s])
    s = np.sqrt(1.0 + R[2,2] - R[0,0] - R[1,1]) * 2
    return np.array([(R[1,0]-R[0,1])/s, (R[0,2]+R[2,0])/s, (R[1,2]+R[2,1])/s, 0.25*s])

def quat_to_matrix(q):
    w, x, y, z = q / np.linalg.norm(q)
    return np.array([
        [1-2*(y*y+z*z), 2*(x*y-w*z),   2*(x*z+w*y)],
        [2*(x*y+w*z),   1-2*(x*x+z*z), 2*(y*z-w*x)],
        [2*(x*z-w*y),   2*(y*z+w*x),   1-2*(x*x+y*y)]])

def slerp(q0, q1, t):
    q0, q1 = q0/np.linalg.norm(q0), q1/np.linalg.norm(q1)
    d = float(np.dot(q0, q1))
    if d < 0:                 # take the short way round the sphere
        q1, d = -q1, -d
    if d > 0.9995:            # nearly identical: lerp and renormalise
        q = q0 + t*(q1 - q0)
        return q / np.linalg.norm(q)
    th = np.arccos(d)
    return (np.sin((1-t)*th)*q0 + np.sin(t*th)*q1) / np.sin(th)

start = np.radians([0.0, 0.0, 0.0])
end = np.radians([170.0, 60.0, 80.0])
R0, R1 = euler_zyx(*start), euler_zyx(*end)
q0, q1 = quat_from_matrix(R0), quat_from_matrix(R1)

STEPS = 200
ts = np.linspace(0, 1, STEPS + 1)
euler_path = [euler_zyx(*(start + (end - start)*t)) for t in ts]
quat_path = [quat_to_matrix(slerp(q0, q1, t)) for t in ts]

def stats(path):
    steps = np.array([angle_between(path[i], path[i+1]) for i in range(len(path)-1)])
    return steps.sum(), steps.min(), steps.max()

direct = angle_between(R0, R1)
print(f'the shortest possible rotation start -> end: {direct:.3f} degrees')
print()
print(f"{'path':>24} {'travelled':>12} {'vs shortest':>12} {'slowest':>10} {'fastest':>10}")
for label, path in (('linear in Euler angles', euler_path), ('slerp on quaternions', quat_path)):
    tot, lo, hi = stats(path)
    print(f'{label:>24} {tot:>11.3f}° {tot/direct:>11.3f}x {lo:>9.4f}° {hi:>9.4f}°')

e_tot, e_lo, e_hi = stats(euler_path)
print()
print(f'Euler travels {e_tot - direct:.3f} degrees further than needed '
      f'({100*(e_tot/direct - 1):.1f}% extra)')
print(f'and its speed varies by {e_hi/e_lo:.2f}x between slowest and fastest step.')
print('Slerp travels exactly the shortest distance at a constant rate.')`,
  },
  {
    id: 'order',
    cellTitle: 'The side you multiply on, and why testing misses it',
    prose: [
      'Rotating in the model frame and rotating in the camera frame are different operations. One post-multiplies, the other pre-multiplies. The map warns that getting this backwards gives a part that turns almost right, which is far harder to debug than one that is obviously wrong.',
      'Measure how far apart the two orders actually are, across a range of angles. The large-angle rows are obvious. The small-angle rows are the ones that ship, because a fraction of a degree looks like nothing.',
      'Then the reason the bug survives a test suite: rotations about the same axis commute exactly. Anyone who checks one axis at a time sees no difference at all.',
    ],
    code: `def axis_angle(axis, deg):
    axis = np.asarray(axis, float)
    axis = axis / np.linalg.norm(axis)
    a = np.radians(deg)
    K = np.array([[0, -axis[2], axis[1]],
                  [axis[2], 0, -axis[0]],
                  [-axis[1], axis[0], 0]], float)
    return np.eye(3) + np.sin(a)*K + (1 - np.cos(a))*(K @ K)   # Rodrigues

print(f"{'rotation A':>20} {'rotation B':>20} {'B@A vs A@B':>14}")
for ax_a, da, ax_b, db in (
    ([0,0,1], 90, [1,0,0], 90),
    ([0,0,1], 45, [1,0,0], 45),
    ([0,0,1], 15, [1,0,0], 15),
    ([0,0,1],  5, [1,0,0],  5),
    ([0,0,1], 30, [0,1,0], 30),
):
    A, B = axis_angle(ax_a, da), axis_angle(ax_b, db)
    print(f"{f'{ax_a} {da}deg':>20} {f'{ax_b} {db}deg':>20} "
          f'{angle_between(B @ A, A @ B):>13.3f}°')

A, B = axis_angle([0,0,1], 30), axis_angle([0,0,1], 50)
print()
print(f'about the SAME axis: {angle_between(B @ A, A @ B):.2e} degrees apart')
print()
print('Same-axis rotations commute exactly. So a test that exercises one axis')
print('at a time cannot detect a pre/post multiply bug at all - and that is')
print('how it reaches production.')`,
  },
  {
    id: 'updir',
    cellTitle: 'Z up against Y up, and the shortcut that mirrors the part',
    prose: [
      'CNC models are Z up. three.js is Y up by default. Nothing in either system errors when a Z-up model arrives in a Y-up viewer; the part is simply displayed lying on its side, and somebody eventually asks why the view resets to an orientation nobody would choose.',
      'The correct conversion is a rotation of -90 degrees about X. There is a tempting shortcut - just swap the Y and Z coordinates - which also stands the part upright and is wrong, because swapping two axes has determinant -1 and mirrors the geometry.',
      'A mirrored part has the same shape, size and bounding box as the real one. It is wrong only where a feature is handed, which is why it survives every check except the determinant.',
    ],
    code: `top_normal = np.array([0.0, 0.0, 1.0])
viewer_up = np.array([0.0, 1.0, 0.0])
corners = np.array([[0,0,0],[4,0,0],[4,2,0],[0,2,0],
                    [0,0,0.5],[4,0,0.5],[4,2,0.5],[0,2,0.5]], float)

tilt = np.degrees(np.arccos(np.clip(top_normal @ viewer_up, -1, 1)))
print(f'the plate top face normal in the file : {top_normal}')
print(f'what the viewer calls up              : {viewer_up}')
print(f'angle between them                    : {tilt:.1f} degrees')
print('nothing errors; the plate is just displayed standing on its edge.')
print()

Z_TO_Y = rot_x(np.radians(-90))
SWAP = np.array([[1,0,0],[0,0,1],[0,1,0]], float)

for name, M in (('rotate -90 about X', Z_TO_Y), ('swap Y and Z', SWAP)):
    moved = corners @ M.T
    print(f'  {name}')
    print(f'    top face normal -> {np.round(M @ top_normal, 6)}')
    print(f'    bounding box    -> {np.round(moved.max(0) - moved.min(0), 3)}')
    print(f'    determinant     -> {np.linalg.det(M):+.0f}'
          f'{"" if np.linalg.det(M) > 0 else "   <- REFLECTION, the part is mirrored"}')

print()
print('Both put the top face normal on +Y. Both look upright. One of them has')
print('silently mirrored the part, and the bounding boxes do not tell them')
print('apart - only the determinant does.')`,
  },
  {
    id: 'drift',
    cellTitle: 'Drift, and a piece of folklore that does not survive measurement',
    prose: [
      'The standard warning is that repeatedly composing rotation matrices accumulates error until the matrix stops being a rotation, and that quaternions are the fix. Measure it rather than repeating it: compose one small rotation a million times and watch both representations.',
      'In float64 the warning turns out not to apply at any realistic count. Both stay far below anything that could matter. Say so, rather than passing on advice that measurement contradicts.',
      'Then repeat in float32, which is what a GPU buffer actually stores. That is where the effect is real, and it is the version worth knowing.',
    ],
    code: `def quat_mul(p, q):
    w1,x1,y1,z1 = p
    w2,x2,y2,z2 = q
    return np.array([w1*w2-x1*x2-y1*y2-z1*z2, w1*x2+x1*w2+y1*z2-z1*y2,
                     w1*y2-x1*z2+y1*w2+z1*x2, w1*z2+x1*y2-y1*x2+z1*w2])

axis, ang = np.array([0.3,0.7,0.2]), np.radians(0.37)
u = axis/np.linalg.norm(axis)
qs = np.concatenate([[np.cos(ang/2)], np.sin(ang/2)*u])
Rs = quat_to_matrix(qs)      # same rotation, built from the quaternion

R = np.eye(3); q = np.array([1.0,0,0,0])
print(f"{'compositions':>13} {'matrix ||R^T R - I||':>22} {'quat |norm - 1|':>18}")
marks = {10**k for k in range(1, 7)}
for i in range(1, 1_000_001):
    R = Rs @ R
    q = quat_mul(qs, q)
    if i in marks:
        print(f'{i:>13,} {np.linalg.norm(R.T @ R - np.eye(3)):>22.3e} '
              f'{abs(np.linalg.norm(q) - 1.0):>18.3e}')

R32 = np.eye(3, dtype=np.float32); Rs32 = Rs.astype(np.float32)
for _ in range(100_000):
    R32 = (Rs32 @ R32).astype(np.float32)
err32 = np.linalg.norm(R32.astype(float).T @ R32.astype(float) - np.eye(3))

print()
print(f'the same matrix in float32 after 100,000 compositions: {err32:.3e}')
print()
print('In float64 neither drifts meaningfully in a million steps, so the usual')
print('warning is not what bites. In float32 - what a GPU buffer stores - the')
print('matrix is visibly off after a tenth as many steps.')
print()
print('The real argument for quaternions is not drift, it is bookkeeping:')
print('  rotation matrix   9 numbers, 6 constraints to maintain')
print('  quaternion        4 numbers, 1 constraint to maintain')
print('and one constraint is a division; six is a Gram-Schmidt pass.')`,
  },
  {
    id: 'ch-rotation',
    challengeType: 'write',
    challengeTitle: 'Reject the mirror',
    difficulty: 'warm-up',
    prompt:
      'Write classify(M) returning one of the strings "rotation", "reflection" or '
      + '"not orthogonal", using a tolerance of 1e-12. Then set report to a list of '
      + '(name, matrix, classification) covering all three outcomes. The axis swap '
      + 'must come out as "reflection", not "rotation" - it is orthogonal, so '
      + 'orthogonality alone is not enough to accept it.',
    hint:
      'Orthogonal means M.T @ M is the identity - np.allclose with atol=1e-12. Given '
      + 'that, the determinant is either +1 (rotation) or -1 (reflection). If it is '
      + 'not orthogonal at all, neither applies.',
    code: `def classify(M):
    # TODO
    pass


report = []
# TODO: fill report with (name, matrix, classification) covering all three

for name, M, kind in report:
    print(f'  {name:<30} {kind}')`,
    solution: `def classify(M):
    if not np.allclose(M.T @ M, np.eye(3), atol=1e-12):
        return "not orthogonal"
    return "rotation" if np.linalg.det(M) > 0 else "reflection"


report = []
for name, M in (
    ('rot_x(-90 degrees)', rot_x(np.radians(-90))),
    ('euler_zyx(35, 20, -10)', euler_zyx(*np.radians([35, 20, -10]))),
    ('identity', np.eye(3)),
    ('swap Y and Z', np.array([[1,0,0],[0,0,1],[0,1,0]], float)),
    ('negate every axis', -np.eye(3)),
    ('uniform 2x scale', np.eye(3) * 2),
    ('shear', np.array([[1,0.4,0],[0,1,0],[0,0,1]], float)),
):
    report.append((name, M, classify(M)))

for name, M, kind in report:
    print(f'  {name:<30} {kind}')`,
    testCode: `assert report, "report is empty - nothing was classified."
assert len(report) >= 5, f"only {len(report)} rows; cover all three outcomes"

_swap = np.array([[1,0,0],[0,0,1],[0,1,0]], float)
assert classify(_swap) == "reflection", (
    f'the Y/Z axis swap classified as "{classify(_swap)}". It IS orthogonal - '
    f'that is exactly the trap. Its determinant is -1, so it mirrors the part.')
assert classify(rot_x(np.radians(-90))) == "rotation"
assert classify(euler_zyx(*np.radians([35, 20, -10]))) == "rotation"
assert classify(np.eye(3) * 2) == "not orthogonal", (
    "a uniform 2x scale is not orthogonal - M.T @ M is 4I, not I")
assert classify(np.array([[1,0.4,0],[0,1,0],[0,0,1]], float)) == "not orthogonal"

# Negating all three axes is the subtle one: orthogonal, det -1 in 3D.
assert classify(-np.eye(3)) == "reflection", (
    "negating all three axes is orthogonal with determinant -1 in 3D, so it "
    "is a reflection - a fact that catches people who expect a double negative "
    "to cancel")

_kinds = {k for _, _, k in report}
for _want in ("rotation", "reflection", "not orthogonal"):
    assert _want in _kinds, f'no "{_want}" case in the report'
"SUCCESS: orthogonality alone accepts the mirror. The determinant is what separates a rotation from a part with its holes on the wrong side."`,
  },
  {
    id: 'ch-chain',
    challengeType: 'write',
    challengeTitle: 'Part to setup to world to camera, and back',
    difficulty: 'core',
    prompt:
      'Write homogeneous(R, t) building a 4x4 from a 3x3 rotation and a translation, '
      + 'and compose(mats) returning the single 4x4 that applies mats in order - first '
      + 'in the list applied first. Then set round_trip_error to the distance between '
      + 'a part-space point and itself after going through the full chain and back. '
      + 'The section build milestone is that this survives all five spaces.',
    hint:
      'A 4x4 is the identity with R in the top-left 3x3 and t in the first three rows '
      + 'of the last column. For compose, start from the identity and LEFT-multiply '
      + 'each matrix in turn: the first applied ends up rightmost in the product. '
      + 'Invert with np.linalg.inv.',
    code: `def homogeneous(R, t):
    # TODO
    pass


def compose(mats):
    # TODO: single 4x4 applying mats in order, first in the list applied first
    pass


part_to_setup = homogeneous(rot_z(np.radians(35)), [12.0, -4.0, 0.0])
setup_to_world = homogeneous(rot_x(np.radians(-90)), [0.0, 0.0, 250.0])
world_to_camera = np.linalg.inv(homogeneous(rot_y(np.radians(20)), [40.0, 30.0, 180.0]))

round_trip_error = None
# TODO: send a part-space point all the way to camera space and back

print('round-trip error:', round_trip_error)`,
    solution: `def homogeneous(R, t):
    M = np.eye(4)
    M[:3, :3] = R
    M[:3, 3] = t
    return M


def compose(mats):
    M = np.eye(4)
    for m in mats:
        M = m @ M          # each new transform multiplies on the LEFT
    return M


part_to_setup = homogeneous(rot_z(np.radians(35)), [12.0, -4.0, 0.0])
setup_to_world = homogeneous(rot_x(np.radians(-90)), [0.0, 0.0, 250.0])
world_to_camera = np.linalg.inv(homogeneous(rot_y(np.radians(20)), [40.0, 30.0, 180.0]))

chain = compose([part_to_setup, setup_to_world, world_to_camera])
P = np.array([1.5, -0.75, 0.25, 1.0])
P_cam = chain @ P
P_back = np.linalg.inv(chain) @ P_cam
round_trip_error = float(np.linalg.norm(P_back - P))

print('round-trip error:', round_trip_error)`,
    testCode: `assert round_trip_error is not None, "round_trip_error was never set."
assert round_trip_error < 1e-9, (
    f"the point came back {round_trip_error:.3e} away from where it started; "
    f"the chain should be invertible to floating-point precision")

_M = homogeneous(rot_z(np.radians(35)), [12.0, -4.0, 0.0])
assert _M.shape == (4, 4), f"homogeneous returned shape {_M.shape}, expected (4, 4)"
assert np.allclose(_M[3], [0, 0, 0, 1]), (
    f"the bottom row came out {_M[3]}, expected [0, 0, 0, 1]")
assert np.allclose(_M[:3, 3], [12.0, -4.0, 0.0]), (
    "the translation belongs in the first three rows of the LAST column")

# Order is the whole point: compose must apply the first matrix first.
_A = homogeneous(rot_z(np.radians(90)), [0.0, 0.0, 0.0])
_B = homogeneous(np.eye(3), [10.0, 0.0, 0.0])
_p = np.array([1.0, 0.0, 0.0, 1.0])
_got = compose([_A, _B]) @ _p
assert np.allclose(_got[:3], [10.0, 1.0, 0.0]), (
    f"rotating 90 degrees about Z and THEN translating +10 in X should send "
    f"[1,0,0] to [10,1,0]; you got {np.round(_got[:3], 4)}. If you got "
    f"[0,1,0]-ish the translation was applied first, so the matrices are "
    f"composed in the wrong order - the first in the list multiplies on the "
    f"RIGHT of everything that follows it.")

# And composing must equal applying one at a time.
_seq = _B @ (_A @ _p)
assert np.allclose(compose([_A, _B]) @ _p, _seq), (
    "composing then applying must equal applying one at a time")
"SUCCESS: one 4x4 now carries the whole part-to-camera chain, and a point survives it in both directions."`,
  },
  {
    id: 'ch-lock',
    challengeType: 'write',
    challengeTitle: 'How close to lock is this orientation?',
    difficulty: 'stretch',
    prompt:
      'Write lock_margin(yaw, pitch, roll) returning the smallest singular value of '
      + 'euler_jacobian at that orientation - a direct measure of how much independent '
      + 'freedom is left. Then set safe_limit to the largest pitch, searched in steps '
      + 'of 0.1 degrees, whose condition number is still under 10. Report a few '
      + 'orientations with their margins.',
    hint:
      'np.linalg.svd(..., compute_uv=False) returns singular values largest first, so '
      + 'the smallest is the last. The condition number is the first divided by the '
      + 'last. Step pitch upward and keep the last value that stays under 10.',
    code: `def lock_margin(yaw, pitch, roll):
    # TODO
    pass


safe_limit = None
# TODO: largest pitch in degrees whose condition number is still under 10

margins = []
# TODO: a few (label, pitch_degrees, margin) rows

for label, deg, m in margins:
    print(f'  {label:<26} pitch {deg:>6.1f}  margin {m:.4e}')
print('safe pitch limit:', safe_limit)`,
    solution: `def lock_margin(yaw, pitch, roll):
    sv = np.linalg.svd(euler_jacobian(yaw, pitch, roll), compute_uv=False)
    return float(sv[-1])


safe_limit = None
for deg in np.arange(0.0, 90.0, 0.1):
    sv = np.linalg.svd(euler_jacobian(0.0, np.radians(deg), 0.0), compute_uv=False)
    if sv[0] / sv[-1] < 10:
        safe_limit = round(float(deg), 1)

margins = []
for label, deg in (('flat', 0.0), ('tilted', 45.0), ('steep', 80.0),
                   ('nearly locked', 89.0), ('locked', 90.0)):
    margins.append((label, deg, lock_margin(0.0, np.radians(deg), 0.0)))

for label, deg, m in margins:
    print(f'  {label:<26} pitch {deg:>6.1f}  margin {m:.4e}')
print('safe pitch limit:', safe_limit)`,
    testCode: `assert margins, "margins is empty - nothing was measured."
assert safe_limit is not None, "safe_limit was never set."

# Against the values measured for this lesson.
assert abs(lock_margin(0.0, 0.0, 0.0) - np.sqrt(2)) < 1e-9, (
    f"at pitch 0 the margin should be sqrt(2) = 1.41421, got "
    f"{lock_margin(0.0, 0.0, 0.0):.6f}")
assert lock_margin(0.0, np.radians(90), 0.0) < 1e-12, (
    f"at pitch 90 the margin should be zero to floating-point precision, got "
    f"{lock_margin(0.0, np.radians(90), 0.0):.3e}. If it came out near 1e-6 the "
    f"Jacobian is being estimated by finite differences and you are measuring "
    f"the step size, not the derivative.")
assert abs(lock_margin(0.0, np.radians(89), 0.0) - np.cos(np.radians(89))) < 1e-5, (
    "near lock the margin should track cos(pitch) closely")

# The margin must fall monotonically as pitch rises toward lock.
_seq = [lock_margin(0.0, np.radians(d), 0.0) for d in (0, 30, 60, 80, 89, 90)]
assert _seq == sorted(_seq, reverse=True), (
    f"the margin should fall monotonically toward lock; got "
    f"{[round(v, 6) for v in _seq]}")

assert 78.0 <= safe_limit <= 79.0, (
    f"safe_limit came out {safe_limit}. Searching in 0.1 degree steps, the "
    f"condition number crosses 10 at about 78.6 degrees - so roughly 11 degrees "
    f"of orientation is already degraded before lock.")
"SUCCESS: lock is measurable as a distance, not just a place. Roughly 11 degrees of orientation is already compromised before the freedom is actually gone."`,
  },
];

export default {
  id: 'mesh-engine-2-1-coordinate-systems',
  slug: 'coordinate-systems',
  chapter: 'mesh-engine.2',
  order: 0,
  title: 'Coordinate Systems and Transformations',
  subtitle: 'Five spaces, one point, and the three ways moving between them fails without an error.',
  tags: [
    'coordinate systems', 'transforms', 'rotation matrix', 'homogeneous coordinates',
    'quaternion', 'gimbal lock', 'slerp', 'determinant', 'reflection', 'composition',
  ],
  aliases: 'coordinate system transform transformation translation rotation matrix homogeneous coordinates composition local world camera screen space quaternion gimbal lock euler angles slerp interpolation determinant reflection mirrored part z up y up axis convention pre-multiply post-multiply',
  timeToComplete: 75,
  coreConcept:
    'A transform converts one description of a point into another, and the same physical corner has to be describable in part, setup, world, camera and screen space at once. Three things go wrong here and none of them raises an error. Three angles lose a degree of freedom at pitch 90 - genuinely rank-2, measured - and the conditioning is already worse than 10:1 by 78.6 degrees, so eleven degrees of orientation are degraded before the lock. Interpolating those angles travels 17.6% further than necessary at a speed that varies 1.59x, which is what a lurching view is. And an axis swap that stands a Z-up part upright in a Y-up viewer has determinant -1, so it mirrors the part: same shape, same bounding box, holes on the wrong side. Orthogonality alone accepts it; only the determinant rejects it.',
  prerequisites: ['mesh-engine-1-12-attribution'],
  nextLesson: 'mesh-engine-2-2-manual-alignment',

  semantics: {
    core: [
      { symbol: 'part / setup / world / camera / screen', meaning: 'Five descriptions of one physical corner. A transform converts between two of them.' },
      { symbol: 'MᵀM = I and det(M) = +1', meaning: 'Both conditions define a proper rotation. Orthogonality alone also admits reflections.' },
      { symbol: 'det(M) = −1', meaning: 'A reflection. The part is mirrored, with the same shape and bounding box, and is wrong only where a feature is handed.' },
      { symbol: 'smallest singular value of the Jacobian', meaning: 'How much independent freedom the three angles still have. Zero means a degree of freedom is gone.' },
      { symbol: 'slerp', meaning: 'Interpolation along the arc between two orientations. Shortest path, constant rate.' },
      { symbol: 'pre- vs post-multiply', meaning: 'Rotating in the camera frame versus the model frame. Different answers, by up to 120 degrees.' },
      { symbol: 'the fourth coordinate', meaning: 'A linear map fixes the origin, so translation cannot be a 3x3. The fourth row is what lets rotation and translation compose into one matrix.' },
    ],
    rulesOfThumb: [
      'Check both conditions before trusting a matrix: orthogonal AND determinant +1. The mirror passes the first.',
      'Decide the application’s up-axis once, write it down, and convert at the boundary rather than in five places.',
      'Store orientation as a quaternion and convert to angles only for display. Angles are a presentation format, not a state.',
      'Interpolate orientations with slerp, never by interpolating angles.',
      'Test composition order across two different axes. Same-axis rotations commute, so a one-axis test cannot see the bug.',
      'Measure the distance to gimbal lock rather than checking for it. It is a slope, and 78.6 degrees is already bad.',
      'Do not estimate a derivative with a finite difference when the quantity goes to zero. The step size becomes the floor.',
    ],
  },

  hook: {
    question: 'A Z-up part is loaded into a Y-up viewer and stands on its edge. Someone fixes it by swapping the Y and Z coordinates, and it now looks perfect. What did they just ship?',
    realWorldContext: 'A mirrored part. Swapping two axes is orthogonal, so it passes the obvious check, and it stands the part upright exactly as a real rotation would - but its determinant is -1, which makes it a reflection rather than a rotation. The shape is identical, the size is identical, the bounding box is identical. The only difference is handedness, so it looks completely normal until a hole is on the wrong side. The correct fix, a -90 degree rotation about X, has determinant +1. That single number is the whole difference between a fixed viewer and a scrapped part, and nothing in either system raises an error.',
    previewVisualizationId: 'JSNotebook',
  },

  intuition: {
    prose: [
      'Every lesson so far worked in one space, which held only because nothing moved.',
      'Now one physical corner needs five simultaneous descriptions, and a transform is what converts between two of them.',
      'Three angles feel like the natural way to describe three degrees of freedom, and they are, except where they are not.',
      'At pitch 90 two of the three controls collapse onto each other, and the collapse starts long before that.',
      'Interpolating those angles produces motion that is both longer than necessary and uneven, which is what lurching is.',
      'And a matrix that looks like a rotation may be a reflection, which changes nothing measurable except handedness.',
    ],
    callouts: [
      {
        type: 'warning',
        title: 'Orthogonality is not enough',
        body: 'A matrix claiming to be a rotation must satisfy MᵀM = I AND det(M) = +1. The Y/Z axis swap satisfies the first and fails the second: it is a reflection. Measured, it puts the top face normal on +Y exactly as the correct -90 degree X rotation does, and produces a bounding box of the same three numbers in a different order. Nothing distinguishes them except the determinant, and a mirrored part is wrong only where a feature is handed. Negating all three axes is the same trap - orthogonal, determinant -1 in 3D.',
      },
      {
        type: 'insight',
        title: 'Gimbal lock is a slope, not a cliff',
        body: 'Measured through the Jacobian of the angles-to-rotation map: rank really does drop from 3 to 2 at pitch 90, with the smallest singular value at 1.7e-16. But conditioning passes 10:1 at 78.6 degrees, so 11.4 degrees of orientation is already degraded. Near lock the remaining freedom shrinks like cos(pitch) - 0.174 at 80 degrees, 0.0175 at 89. The useful question is not "am I at lock" but "how far from it am I", and that is a number you can compute.',
      },
      {
        type: 'warning',
        title: 'At lock the three numbers stop meaning anything',
        body: 'yaw=40, pitch=90, roll=0 and yaw=0, pitch=90, roll=-40 differ by 0.00e+00 degrees. They are the same orientation. Any code that stores orientation as three angles and compares them, interpolates them, or averages them is working with numbers that no longer identify what they name.',
      },
      {
        type: 'insight',
        title: 'What a lurching view is, as a number',
        body: 'Same start, same end, 200 steps. Slerp travels 135.581 degrees - exactly the shortest possible rotation - with every step identical at 0.6779 degrees. Interpolating the three angles travels 159.509 degrees, 17.6% further than necessary, with the step size varying 1.59x between slowest and fastest. The extra distance is wasted motion; the varying speed is the lurch.',
      },
      {
        type: 'warning',
        title: 'The composition-order bug cannot be found by testing one axis',
        body: 'Z 90 then X 90, composed both ways, differ by 120 degrees. At 5 degrees each they differ by 0.436 degrees, which looks like nothing and is the version that ships. And rotations about the SAME axis commute exactly - 0.00e+00 apart - so any test that exercises one axis at a time sees no difference at all. The test has to cross two axes.',
      },
      {
        type: 'insight',
        title: 'The drift folklore does not survive measurement',
        body: 'The standard advice is that composing rotation matrices accumulates error and quaternions are the fix. Measured in float64 at one million compositions: matrix 1.6e-10, quaternion 3.9e-11. Neither matters. In float32 - what a GPU buffer stores - the matrix reaches 4.6e-03 after only 100,000 compositions, 28 million times worse. So the warning is real but about the wrong precision. The better argument for quaternions is bookkeeping: 4 numbers with 1 constraint against 9 with 6.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Three sliders, and one of them stops working',
        caption: 'Drag pitch toward 90 and watch the remaining freedom collapse, measured live.',
        props: {
          lesson: LESSON_MESH_2_1,
        },
      },
    ],
  },

  math: {
    prose: [
      'The first cell establishes what actually counts as a rotation, because the rest of the lesson turns on the distinction.',
      'Then gimbal lock, measured as a rank deficiency rather than described as a picture of rings - including why the derivative has to be analytic.',
      'Then the two motion failures: interpolation that travels too far unevenly, and composition in the wrong order.',
      'Then the up-axis conversion and its mirrored shortcut, and finally drift, where the usual advice is measured and found to be about the wrong precision.',
    ],
    visualizations: [
      {
        id: 'PythonNotebook',
        title: 'Rotations, lock, interpolation, order, up-axis, drift',
        mathBridge: 'A rotation matrix has nine entries and six constraints - three saying each column is a unit vector, three saying each pair is perpendicular - leaving the three degrees of freedom a rotation has. Writing orientation as three angles is a map from three numbers onto that three-dimensional set, and the Jacobian of that map says whether it is locally invertible. Where the Jacobian drops rank the map folds, two different inputs give one output, and the inverse stops existing - which is gimbal lock stated as linear algebra rather than as a mechanical picture. Translation is excluded from all of this because a linear map must fix the origin; adding a fourth coordinate embeds rotation and translation in one matrix that composes properly, at the cost of one extra row.',
        caption: 'Every figure in this lesson measured before it was written down.',
        props: {
          initialCells: PY_CELLS,
        },
      },
    ],
  },

  examples: [
    {
      title: 'The fix that mirrors the part',
      prose: 'A Z-up plate in a Y-up viewer is 90 degrees out. Swapping Y and Z stands it upright and has determinant -1; rotating -90 about X stands it upright and has determinant +1. Same appearance, same bounding box numbers, opposite handedness.',
    },
    {
      title: 'Eleven degrees of warning',
      prose: 'Conditioning of the angles-to-rotation map passes 10:1 at pitch 78.6 degrees. By 89 degrees the remaining freedom is 0.0175, and at 90 it is 1.7e-16 with rank 2. The failure announces itself for eleven degrees before it arrives.',
    },
    {
      title: 'Two names for one orientation',
      prose: 'yaw=40 pitch=90 roll=0 and yaw=0 pitch=90 roll=-40 differ by 0.00e+00. At lock, yaw and roll trade freely and the stored numbers no longer identify the orientation.',
    },
    {
      title: 'The order bug that passes its tests',
      prose: 'Z 90 and X 90 composed both ways differ by 120 degrees, but Z 30 and Z 50 composed both ways differ by 0.00e+00. A test suite that rotates about one axis at a time proves the code correct and finds nothing.',
    },
  ],

  challenges: [
    {
      prompt: 'Classify a matrix as a rotation, a reflection, or not orthogonal, and show all three outcomes including the axis swap.',
      hint: 'Orthogonal first, then the determinant decides between rotation and reflection.',
    },
    {
      prompt: 'Build 4x4 transforms, compose them in the right order, and round-trip a point through the whole part-to-camera chain.',
      hint: 'The first matrix applied ends up rightmost in the product; each new transform multiplies on the left.',
    },
    {
      prompt: 'Measure how far a given orientation is from gimbal lock, and find the pitch at which conditioning first passes 10:1.',
      hint: 'The smallest singular value of the analytic Jacobian. A finite difference would floor out at its own step size.',
    },
    {
      prompt: 'In the browser, reject the mirror on its determinant and compose a chain with translation intact.',
      hint: 'Orthogonality alone accepts the swap; dropping the fourth column loses the translation.',
    },
  ],

  misconceptions: [
    {
      claim: 'If a matrix is orthogonal it is a rotation.',
      reality: 'The Y/Z axis swap is orthogonal and has determinant -1, making it a reflection. It stands a Z-up part upright exactly as the correct rotation does and produces the same bounding box numbers. Only the determinant tells them apart, and a mirrored part is wrong only where a feature is handed.',
    },
    {
      claim: 'Gimbal lock is a corner case at exactly 90 degrees.',
      reality: 'Conditioning is already worse than 10:1 at 78.6 degrees - 11.4 degrees of orientation degraded before the lock. Measured, the remaining freedom shrinks like cos(pitch) on the way in.',
    },
    {
      claim: 'Three angles are a fine way to store orientation.',
      reality: 'At pitch 90, yaw=40/roll=0 and yaw=0/roll=-40 are the same orientation to 0.00e+00. The numbers stop identifying what they name, so comparing, averaging or interpolating them is meaningless there.',
    },
    {
      claim: 'Interpolating Euler angles is close enough for a camera.',
      reality: 'Measured: 17.6% further travelled than necessary, with the step size varying 1.59x. The extra distance is wasted motion and the varying speed is exactly what reads as a view lurching rather than turning.',
    },
    {
      claim: 'A pre-multiply/post-multiply mix-up would show up in testing.',
      reality: 'Only if the test crosses two axes. Rotations about the same axis commute exactly - 0.00e+00 apart - so a one-axis test cannot detect it. And at small angles the two orders differ by 0.436 degrees, which looks like nothing.',
    },
    {
      claim: 'Rotation matrices drift, so you must use quaternions.',
      reality: 'In float64 at a million compositions the matrix is off by 1.6e-10 and the quaternion by 3.9e-11. Neither matters. The advice is real only in float32, where the matrix hits 4.6e-03 after 100,000 steps. The better argument is bookkeeping: 4 numbers and 1 constraint against 9 and 6.',
    },
    {
      claim: 'A small finite difference is a fine way to estimate a derivative.',
      reality: 'Not when the quantity reaches zero. The first version of this lesson’s gimbal measurement used a step of 1e-6 and reported a smallest singular value of exactly 1e-6 at lock - the step size, not the derivative. A measuring tool with a noise floor cannot measure something that goes below it.',
    },
  ],

  transferPrompts: [
    'A part looks correct in the viewer but a feature is on the wrong side. What single number would you check first?',
    'Your orbit control feels fine near horizontal and strange when looking almost straight down. What would you measure, and at what angle would you expect to see it start?',
    'You are asked to store a camera orientation in a settings file. What would you store, and what would you convert it to only for display?',
    'A colleague says their transform tests all pass. What would you ask about how the tests are constructed?',
    'A measurement flatlines at exactly the resolution of the tool you used. What does that tell you, and what does it not tell you?',
  ],

  debugging: [
    {
      symptom: 'The part appears lying on its side, and nothing errored.',
      cause: 'A Z-up model loaded into a Y-up viewer with no conversion - exactly 90 degrees out.',
      fix: 'Rotate -90 degrees about X at the load boundary, once, and record the convention. Do not swap axes.',
    },
    {
      symptom: 'The part looks right but a hole or a pocket is handed the wrong way.',
      cause: 'A reflection got into the transform chain - most often an axis swap used to fix the up-direction.',
      fix: 'Check the determinant of every matrix in the chain. Any -1 is a mirror. Shape, size and bounding box will not reveal it.',
    },
    {
      symptom: 'Orbiting feels fine until the view is nearly top-down, then the controls fight each other.',
      cause: 'Gimbal lock approaching. Two of the three angles are collapsing onto the same axis.',
      fix: 'Compute the smallest singular value of the Jacobian as a live margin. Store orientation as a quaternion and treat angles as display only.',
    },
    {
      symptom: 'A view transition lurches - fast in the middle, slow at the ends, or the reverse.',
      cause: 'The three angles are being interpolated linearly.',
      fix: 'Slerp the quaternion. Measured, that is both the shortest path and a constant rate; the angle version is 17.6% longer and varies 1.59x.',
    },
    {
      symptom: 'The part turns almost correctly - close enough to look like a tuning problem.',
      cause: 'Pre-multiply where post-multiply was meant, or the reverse.',
      fix: 'Compose two rotations about DIFFERENT axes and compare both orders. Same-axis rotations commute, so the usual test proves nothing.',
    },
    {
      symptom: 'A measured error sits at exactly 1e-6, or exactly the tolerance of your tool.',
      cause: 'You are measuring your instrument, not the thing.',
      fix: 'Change the instrument, not the experiment. If the number moves with the step size, it was never the answer.',
    },
  ],

  mastery: {
    prerequisites:
      'Lesson 2 for vectors and the cross product, lesson 11 for the habit of measuring a claim before writing it down, and lesson 1 for winding - which is the same handedness question this lesson meets again as a determinant.',
    signals: [
      'Checks the determinant, not just orthogonality, before trusting a transform.',
      'Treats gimbal lock as a distance to be measured rather than a state to be checked.',
      'Stores orientation as a quaternion and converts to angles only for display.',
      'Writes composition tests that cross two axes.',
      'Recognises a measurement pinned at the resolution of its own instrument.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'mesh-engine-1-2-vectors-and-triangles', why: 'Vectors, dot and cross products, and the right-hand rule this lesson turns into a determinant.' },
      { lessonId: 'mesh-engine-1-1-what-a-mesh-is', why: 'Winding and handedness, which is the reflection question in its first form.' },
      { lessonId: 'mesh-engine-1-11-thresholds', why: 'The habit this lesson depends on: measure the claim, and rewrite it when the measurement disagrees.' },
    ],
    futureLinks: [],
  },

  checkpoints: [
    'I can say what makes a matrix a rotation rather than a reflection, and why the difference is invisible in a viewer.',
    'I can measure how far an orientation is from gimbal lock.',
    'I can explain why three angles stop identifying an orientation at lock.',
    'I can say what interpolating Euler angles costs, as two numbers.',
    'I can construct a composition test that would actually catch a pre/post multiply bug.',
    'I can move a point through all five spaces and back.',
    'I can recognise a measurement that is really measuring the instrument.',
  ],

  assessment: {
    task: 'Take a Z-up part, place it in a fixture, put it in a scene, look at it from a camera, and prove the chain is correct in both directions.',
    acceptance: [
      'Every matrix in the chain checked for orthogonality and determinant +1.',
      'The up-axis conversion done once, at the load boundary, and written down.',
      'A point round-tripped through all five spaces to floating-point precision.',
      'Orientation stored as a quaternion, with angles used only for display.',
      'A composition test that crosses two axes, not one.',
      'A live gimbal-lock margin rather than a check for the exact lock angle.',
    ],
  },

  quiz: [
    {
      question: 'A matrix satisfies MᵀM = I. Is it a rotation?',
      options: [
        'Not necessarily — if det(M) = −1 it is a reflection, and the part is mirrored',
        'Yes, that is the definition of a rotation',
        'Only if it is also symmetric',
        'Only if its trace is positive',
      ],
      answer: 0,
      explanation: 'The Y/Z axis swap is orthogonal with determinant −1. It stands a Z-up part upright exactly as the correct rotation does, with the same bounding box numbers, and mirrors it.',
    },
    {
      question: 'At what pitch does the angles-to-rotation map start being badly conditioned?',
      options: [
        '78.6° — about 11 degrees of orientation is degraded before the lock at 90°',
        'Exactly 90°, and not before',
        '45°, halfway to lock',
        'It depends on yaw and roll, not pitch',
      ],
      answer: 0,
      explanation: 'Measured: conditioning passes 10:1 at 78.6°. The remaining freedom shrinks like cos(pitch) on the way in — 0.174 at 80°, 0.0175 at 89°.',
    },
    {
      question: 'yaw=40, pitch=90, roll=0 versus yaw=0, pitch=90, roll=−40. How far apart are these orientations?',
      options: [
        '0.00e+00 — they are the same orientation',
        '40 degrees',
        '80 degrees',
        'Undefined, because pitch is at 90',
      ],
      answer: 0,
      explanation: 'At lock, yaw and roll act on the same axis and trade freely. The three stored numbers no longer identify the orientation.',
    },
    {
      question: 'What does interpolating Euler angles cost, compared with slerp?',
      options: [
        '17.6% further travelled, with the step size varying 1.59× — the extra distance and the lurch',
        'Nothing measurable; it is a matter of taste',
        'It is faster but less accurate',
        'It only differs when passing through gimbal lock',
      ],
      answer: 0,
      explanation: 'Measured over 200 steps: slerp travels exactly the shortest 135.581° at a constant 0.6779° per step; the angle version travels 159.509° unevenly.',
    },
    {
      question: 'Why does a pre-multiply/post-multiply bug survive a test suite?',
      options: [
        'Because rotations about the same axis commute exactly, so a one-axis test sees no difference',
        'Because the error is below floating-point precision',
        'Because it only appears in perspective projection',
        'Because test suites do not usually cover rotation',
      ],
      answer: 0,
      explanation: 'Z 30° and Z 50° composed both ways differ by 0.00e+00. The test has to cross two axes — Z 90° and X 90° differ by 120°.',
    },
    {
      question: 'Do rotation matrices drift enough to require quaternions?',
      options: [
        'Not in float64 — 1.6e-10 after a million compositions. In float32 they do: 4.6e-03 after 100,000',
        'Yes, drift makes matrices unusable after a few thousand compositions',
        'No, drift is never an issue at any precision',
        'Only when the rotation angle is large',
      ],
      answer: 0,
      explanation: 'The folklore is about the wrong precision. The better argument for quaternions is bookkeeping: 4 numbers with 1 constraint against 9 with 6.',
    },
    {
      question: 'A gimbal-lock measurement reports exactly 1.00e-06 at lock, using a finite difference with step 1e-6. What has been measured?',
      options: [
        'The step size — the instrument has a floor and cannot measure below it',
        'The true residual freedom at lock',
        'Floating-point round-off in the matrix multiply',
        'The condition number',
      ],
      answer: 0,
      explanation: 'This actually happened while building this lesson. The analytic derivative gives 1.7e-16 and rank 2. A tool with a noise floor cannot measure something that goes to zero.',
    },
  ],
};
