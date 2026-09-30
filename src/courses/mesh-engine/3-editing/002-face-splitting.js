// Mesh Engine 3.2 — Face Splitting and the Index Invariant
//
// LearningPath section 16B. A face covered by two toolpaths cannot show both,
// so it has to be cut. That is the easy half. The hard half is that every array
// indexed by face — attribution from lesson 12, per-face role, distance moved,
// the face lists inside baked images — has to survive the cut.
//
// Every number quoted was produced by field-fixes/verify/check-splitting.py.
// Three of that script's claims were wrong first; all three are taught here.

const LESSON_MESH_3_2 = {
  title: 'Cutting a Face Without Breaking Everything Else',
  subtitle: 'Where the crack actually is, and what one delete costs.',
  sequential: true,

  cells: [

    {
      type: 'markdown',
      instruction: `### One face, two operations, one colour

Lesson 12 attributed faces to operations. Lesson 16A let a person select them by
hand. Both assume a face *belongs* to something.

Some faces do not. A toolpath boundary lands wherever the machining changed, and
it has no reason to follow triangle edges — so it runs straight through faces,
leaving them half one operation and half the other. **A single colour per face
cannot say that.**

The obvious fix is a finer mesh. Measured, that does not work:

| grid | faces | straddling | % of faces | % of area |
|---|---|---|---|---|
| 10 | 120 | 12 | 10.00% | 10.00% |
| 20 | 480 | 24 | 5.00% | 5.00% |
| 40 | 1,920 | 48 | 2.50% | 2.50% |
| 80 | 7,680 | 96 | 1.25% | 1.25% |
| 160 | 30,720 | 192 | 0.62% | 0.62% |

The ratio between successive refinements is **2.00, 2.00, 2.00, 2.00** — exactly
\`1/n\`. That is the geometry: **the straddling faces sit along a line while the
total sits over an area**, so the fraction falls linearly and reaches zero only
in the limit.

And the cost is the whole mesh, not just the boundary. Going from a 10-grid to a
160-grid multiplied the faces by **256×** to cut the mixed fraction by **16×**.

So refining is the wrong lever. **Cut the faces where the boundary actually is.**`,
    },

    {
      type: 'js',
      instruction: `### Drag the cut, and stop it partway

A grid with a toolpath boundary through it. Straddling faces — half on each side
— are outlined in orange.

Turn **cut** on and those faces are split along the line, so every face ends up
wholly on one side. The readout tracks the surface **area** (which must not
change) and the **boundary edge** count (which reveals cracks).

Then drag **stop at** down, so the cut ends partway up the plate instead of
running all the way across.

**Predict before you touch anything:** a cut that runs all the way across the
mesh, splitting every face it crosses — how many cracks does it open?

Most people say "one per split". Watch the boundary edge count.`,
      html: `<div style="padding:8px 2px;font:11px ui-monospace,monospace;color:#7d8794;display:grid;grid-template-columns:auto 1fr auto;gap:5px 10px;align-items:center">
  <span>cut at x</span><input id="cut" type="range" min="0.6" max="9.4" step="0.01" value="3.17"><span id="cutv">3.17</span>
  <span>stop at y</span><input id="ystop" type="range" min="0.5" max="6" step="0.05" value="6"><span id="ystopv">6.00</span>
</div>
<div style="padding:4px 2px;font:11px ui-monospace,monospace;color:#7d8794">
  <label><input type="checkbox" id="docut"> cut the straddling faces</label>
  <label><input type="checkbox" id="prop"> repair T-junctions</label>
</div>
<canvas id="c" style="width:100%;height:225px;background:#0a0f1e;border-radius:8px"></canvas>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:8px 2px;white-space:pre"></div>`,
      css: `body{margin:0;background:#0a0f1e}label{margin-right:14px}`,
      startCode: `var NX = 16, NY = 10, W = 10, H = 6;

// A welded grid: triangles that meet share vertex indices.
function makePlate() {
  var verts = [], index = {}, faces = [];
  function vid(x, y) {
    var k = x.toFixed(9) + ',' + y.toFixed(9);
    if (!(k in index)) { index[k] = verts.length; verts.push([x, y]); }
    return index[k];
  }
  for (var i = 0; i < NX; i++) {
    for (var j = 0; j < NY; j++) {
      var x0 = i*W/NX, x1 = (i+1)*W/NX, y0 = j*H/NY, y1 = (j+1)*H/NY;
      var a = vid(x0,y0), b = vid(x1,y0), c = vid(x1,y1), d = vid(x0,y1);
      faces.push([a,b,c]); faces.push([a,c,d]);
    }
  }
  return { verts: verts, faces: faces, vid: vid };
}

function areaOf(verts, faces) {
  var s = 0;
  for (var k = 0; k < faces.length; k++) {
    var p = verts[faces[k][0]], q = verts[faces[k][1]], r = verts[faces[k][2]];
    s += Math.abs((q[0]-p[0])*(r[1]-p[1]) - (q[1]-p[1])*(r[0]-p[0])) / 2;
  }
  return s;
}

// An edge shared by one face only is a boundary edge. Counting them is how you
// find a crack: nothing else about the mesh changes when one opens.
function boundaryEdges(faces) {
  var count = {};
  faces.forEach(function (t) {
    [[t[0],t[1]],[t[1],t[2]],[t[2],t[0]]].forEach(function (e) {
      var k = Math.min(e[0],e[1]) + '-' + Math.max(e[0],e[1]);
      count[k] = (count[k] || 0) + 1;
    });
  });
  return Object.keys(count).filter(function (k) { return count[k] === 1; }).length;
}

function straddles(verts, t, cut) {
  var neg = 0, pos = 0;
  for (var i = 0; i < 3; i++) {
    if (verts[t[i]][0] < cut) neg++; else if (verts[t[i]][0] > cut) pos++;
  }
  return neg > 0 && pos > 0;
}

// Cut one triangle at x = cut. The lone vertex is the one by itself on its
// side; the line crosses the two edges leaving it. Three triangles out.
function cutTriangle(verts, t, cut, vid) {
  var d = [verts[t[0]][0]-cut, verts[t[1]][0]-cut, verts[t[2]][0]-cut];
  var sg = d.map(function (x) { return x > 0 ? 1 : -1; });
  var lone = -1;
  for (var i = 0; i < 3; i++) {
    if (sg[i] !== sg[(i+1)%3] && sg[i] !== sg[(i+2)%3]) lone = i;
  }
  if (lone < 0) return null;
  var a = t[lone], b = t[(lone+1)%3], c = t[(lone+2)%3];
  var da = d[lone], db = d[(lone+1)%3], dc = d[(lone+2)%3];
  // Interpolate to where the line actually crosses - not the midpoint.
  var tab = da/(da-db), tac = da/(da-dc);
  var pab = [verts[a][0] + (verts[b][0]-verts[a][0])*tab,
             verts[a][1] + (verts[b][1]-verts[a][1])*tab];
  var pac = [verts[a][0] + (verts[c][0]-verts[a][0])*tac,
             verts[a][1] + (verts[c][1]-verts[a][1])*tac];
  var mab = vid(pab[0], pab[1]), mac = vid(pac[0], pac[1]);
  return { tris: [[a,mab,mac],[mab,b,c],[mab,c,mac]],
           inserted: [[a,b,mab],[a,c,mac]] };
}

var canvas = document.getElementById('c');
var ctx = canvas.getContext('2d');
function sizeCanvas() {
  canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
  canvas.height = 225 * (window.devicePixelRatio || 1);
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
}
sizeCanvas();

function build() {
  var cut = Number(document.getElementById('cut').value);
  var ystop = Number(document.getElementById('ystop').value);
  var docut = document.getElementById('docut').checked;
  var prop = document.getElementById('prop').checked;

  var P = makePlate();
  var verts = P.verts, faces = P.faces, vid = P.vid;
  var base = { n: faces.length, area: areaOf(verts, faces), bnd: boundaryEdges(faces) };

  var straddling = [];
  faces.forEach(function (t, k) { if (straddles(verts, t, cut)) straddling.push(k); });

  if (!docut) {
    return { verts: verts, faces: faces, base: base, straddling: straddling,
             cut: cut, cracks: 0 };
  }

  // Only the faces below the stop line get cut - a real boundary ends somewhere.
  var todo = straddling.filter(function (k) {
    var t = faces[k];
    return (verts[t[0]][1] + verts[t[1]][1] + verts[t[2]][1]) / 3 < ystop;
  });

  var inserted = {}, dropped = {}, out = [];
  todo.forEach(function (k) {
    var r = cutTriangle(verts, faces[k], cut, vid);
    if (!r) return;
    dropped[k] = true;
    r.tris.forEach(function (x) { out.push(x); });
    r.inserted.forEach(function (e) {
      inserted[Math.min(e[0],e[1]) + '-' + Math.max(e[0],e[1])] = e[2];
    });
  });

  var keep = [];
  faces.forEach(function (t, k) { if (!dropped[k]) keep.push(t); });

  if (prop) {
    // Repair: a surviving face using an edge that gained a vertex must be split
    // AT THAT VERTEX. Re-applying the cut does nothing - it does not straddle.
    var fixed = [];
    keep.forEach(function (t) {
      var hit = null;
      [[t[0],t[1],t[2]],[t[1],t[2],t[0]],[t[2],t[0],t[1]]].forEach(function (e) {
        if (hit) return;
        var m = inserted[Math.min(e[0],e[1]) + '-' + Math.max(e[0],e[1])];
        if (m !== undefined) hit = [e[0], e[1], e[2], m];
      });
      if (!hit) fixed.push(t);
      else fixed.push([hit[0],hit[3],hit[2]], [hit[3],hit[1],hit[2]]);
    });
    keep = fixed;
  }

  var all = keep.concat(out);
  return { verts: verts, faces: all, base: base, straddling: straddling,
           cut: cut, ystop: ystop, cutCount: todo.length };
}

function draw() {
  ['cut','ystop'].forEach(function (id) {
    document.getElementById(id + 'v').textContent =
      Number(document.getElementById(id).value).toFixed(2);
  });
  var S = build();
  var CW = canvas.clientWidth, CH = 225;
  var s = Math.min(CW / (W + 0.8), (CH - 20) / (H + 0.8));
  function X(p) { return 10 + p[0]*s; }
  function Y(p) { return CH - 10 - p[1]*s; }

  ctx.clearRect(0, 0, CW, CH);
  var straddleSet = {};
  S.straddling.forEach(function (k) { straddleSet[k] = true; });

  S.faces.forEach(function (t, k) {
    var p = S.verts[t[0]], q = S.verts[t[1]], r = S.verts[t[2]];
    var cx = (p[0]+q[0]+r[0])/3;
    ctx.beginPath();
    ctx.moveTo(X(p),Y(p)); ctx.lineTo(X(q),Y(q)); ctx.lineTo(X(r),Y(r));
    ctx.closePath();
    ctx.fillStyle = cx < S.cut ? '#1e3a52' : '#3a2a52';
    ctx.fill();
    var isStraddle = !document.getElementById('docut').checked && straddleSet[k];
    ctx.strokeStyle = isStraddle ? '#c2853a' : '#2a3448';
    ctx.lineWidth = isStraddle ? 1.4 : 0.4;
    ctx.stroke();
  });

  ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(X([S.cut,0]), Y([0,0]));
  ctx.lineTo(X([S.cut,0]), Y([0, S.ystop === undefined ? H : S.ystop]));
  ctx.stroke();

  var bnd = boundaryEdges(S.faces);
  var extra = bnd - S.base.bnd;
  var perimeter = 2*(NX + NY);           // the plate's own outer edge count
  document.getElementById('out').textContent = [
    'faces          ' + String(S.faces.length).padStart(6)
      + '   (was ' + S.base.n + ')',
    'surface area   ' + areaOf(S.verts, S.faces).toFixed(6)
      + '   (was ' + S.base.area.toFixed(6) + ')',
    'boundary edges ' + String(bnd).padStart(6)
      + '   (was ' + S.base.bnd + ', so ' + (extra >= 0 ? '+' : '') + extra + ')',
    '',
    !document.getElementById('docut').checked
      ? S.straddling.length + ' faces straddle the cut and cannot be coloured correctly.'
      : extra <= 2
        ? 'No interior cracks. The extra boundary edges are on the plate rim,\\nwhere one edge became two.'
        : (extra - 2) + ' interior crack(s) - a T-junction where the cut stopped.',
  ].join('\\n');
}

['cut','ystop'].forEach(function (id) {
  document.getElementById(id).addEventListener('input', draw);
});
['docut','prop'].forEach(function (id) {
  document.getElementById(id).addEventListener('change', draw);
});
window.addEventListener('resize', function () { sizeCanvas(); draw(); });
draw();`,
      outputHeight: 540,
    },

    {
      type: 'markdown',
      instruction: `### The cut is exact, and the crack is not where I expected

Cutting a triangle at a line is not a midpoint subdivision. The line crosses two
of the three edges, and where it crosses is found by **interpolation** — so the
lone corner becomes one triangle and the remaining quad becomes two:

\`\`\`
1 triangle in  ->  3 triangles out
\`\`\`

Measured on a 1,920-face plate, cutting all 48 straddling faces:

\`\`\`
faces        1,920 -> 2,016      (+96, which is 48 x 2)
surface area    60.000000 -> 60.000000     change 0.00e+00
still mixed                  0
\`\`\`

**Area preserved exactly.** No geometry was invented, and every face now lies
wholly on one side of the boundary.

#### Now the boundary edges

| | boundary edges | |
|---|---|---|
| before anything | 128 | |
| cut all the way across | **130** | +2 |
| cut stopping partway | **132** | +4 |
| cut stopping partway, then repaired | **129** | +1 |
| one interior face split alone | **131** | +3 |

**I expected the full cut to open a crack per split. It opens none.**

A cut that runs all the way across the mesh crosses every interior edge **on
both sides** — both triangles sharing that edge get the same new vertex, and
they still meet. The cut is self-consistent by construction. The +2 is the
plate's own rim, where one edge became two.

**The crack is at the termination.** Where the cut stops, the last face split
has a new vertex partway along an edge whose neighbour was *not* split, so the
neighbour still names only the original two endpoints. That is a T-junction.

And splitting **one interior face by itself** — which is what a user does by
hand — adds exactly **3**, one per edge, because none of its three neighbours
was told.

> Nothing errors. The area is unchanged. The mesh still draws. It is a hairline
> you can see through, and every watertightness test and every clipping plane
> behaves differently along it.

This is the same failure section 16 records for decimation seams, arriving from
the opposite direction — there by **moving** a shared point, here by **adding**
one that is not shared.`,
    },

    {
      type: 'markdown',
      instruction: `### Repairing it means splitting the neighbour at the inserted point

My first repair attempt grew the set of faces to cut, adding every neighbour of
a straddling face, and re-applied the cut to them.

**It added faces and closed zero cracks.** Those neighbours sit wholly on one
side of the line, so the cut does nothing to them — the function returns them
unchanged.

Closing a T-junction is a **different operation**. The neighbour has to be split
**at the vertex that was inserted on the shared edge**, fanning from its opposite
corner:

\`\`\`
neighbour (u, v, w)  with a new vertex m on edge (u, v)

becomes  (u, m, w)  and  (m, v, w)
\`\`\`

Which means the cut has to **record which edge each new vertex landed on**, not
just where it is. A repair pass with only the points cannot find the faces that
need fixing.

Measured: repairing the terminated cut cost **1 extra face** and closed
**3 cracks**. That is a cheap fix, and it is only cheap because the cut stopped —
the number of cracks scales with the length of the cut's free end, not with the
cut itself.`,
    },

    {
      type: 'markdown',
      instruction: `### One \`delete\`, and 1,280 faces mean something else

Section 16 states the invariant:

> If other data indexes into the face array, changing the face ordering changes
> the meaning of all that data.

In this application that is **four arrays at once** — the per-face role, the
per-face distance moved, the face lists inside baked images, and the attribution
owner array from lesson 12.

A split has to **replace** a face, which is the case "append, never reorder" does
not directly cover. Measured on 1,920 faces, splitting face 640:

| scheme | faces | original indices still correct |
|---|---|---|
| delete and append | 1,921 | **640 of 1,920** |
| tombstone and append | 1,922 | **1,919 of 1,920** |

\`\`\`
delete-and-append renamed 1,280 faces' data
tombstone-and-append renamed 1  (the split face, deliberately)
faces after the victim:    1,279
\`\`\`

**One split. One \`delete\`.** Every face after it shifts down by one and now reads
somebody else's owner, role, distance and image entry. Nothing raises. The part
still draws. The colours are one face out for the entire remainder of the array.

#### The tombstone is not free

Leave the split face in place as a **degenerate triangle** — three identical
corners, zero area — and append its replacements. No existing index moves.

But they accumulate. Measured after 200 splits:

\`\`\`
2,320 faces, of which 200 are degenerate tombstones  (8.6%)
\`\`\`

Every pass over the face array now has to skip them, and **a pass that forgets
will compute a normal from a zero-area triangle** — which is a divide by zero,
and lesson 5's degenerate-triangle guard is exactly what catches it.

That is the real trade. Not "tombstoning is correct and deleting is wrong", but:
**one corrupted array against a permanent filtering obligation**, and the second
is far cheaper than the first.

#### A note on measuring this

The first version of this measurement looked faces up by their **vertex tuple**,
so it found each face wherever it had moved to — and reported **0** corruption
where the real figure is 1,280.

That measures *identity*. The invariant is about *indices*: does \`F2[i]\` still
mean what \`F[i]\` meant? A test that answers the wrong question passes
confidently.`,
    },

    {
      type: 'challenge',
      instruction: `### 🎯 Cut exactly, and keep every index meaning what it meant

Two functions.

\`cutTriangle(vertices, tri, cut, addVertex)\` — cut triangle \`tri\` at
\`x = cut\`. Return \`null\` if it does not straddle. Otherwise return
\`{ triangles, inserted }\`:

- \`triangles\` — **three** triangles, each wholly on one side
- \`inserted\` — one \`[u, v, m]\` per new vertex, naming the **edge** \`(u, v)\`
  it landed on and the new index \`m\`

Call \`addVertex(x, y)\` to create or reuse a vertex; it returns the index.
The crossing points are found by **interpolation**, not at the midpoint.

\`applySplit(faces, payload, faceIndex, newTriangles)\` — replace
\`faces[faceIndex]\` with \`newTriangles\` **without moving any existing index**.
Return \`{ faces, payload }\`. The retired face becomes a degenerate triangle;
every new face inherits the payload of the face it came from.

It is checked for exact area preservation, that both output sides are correct,
that \`inserted\` names real edges of the original triangle, and that every
original index still means what it meant.`,
      html: `<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:10px;white-space:pre;background:#0a0f1e;border-radius:8px;min-height:250px"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `// TODO 1: cut the triangle where the line actually crosses.
function cutTriangle(vertices, tri, cut, addVertex) {

  // your code here

  return null;
}

// TODO 2: replace one face without moving any existing index.
function applySplit(faces, payload, faceIndex, newTriangles) {

  // your code here

  return { faces: faces, payload: payload };
}

// ── it runs itself below ──────────────────────────────────────────────────
var verts = [[0,0],[4,0],[0,3]];
var tri = [0,1,2];
function mkAdd(vs) {
  var idx = {};
  vs.forEach(function (v, i) { idx[v[0].toFixed(9)+','+v[1].toFixed(9)] = i; });
  return function (x, y) {
    var k = x.toFixed(9)+','+y.toFixed(9);
    if (!(k in idx)) { idx[k] = vs.length; vs.push([x,y]); }
    return idx[k];
  };
}
function area(vs, t) {
  var p = vs[t[0]], q = vs[t[1]], r = vs[t[2]];
  return Math.abs((q[0]-p[0])*(r[1]-p[1]) - (q[1]-p[1])*(r[0]-p[0])) / 2;
}

var lines = ['  CUT A TRIANGLE AT x = 1.3'];
var vs = verts.map(function (v) { return v.slice(); });
var r = cutTriangle(vs, tri, 1.3, mkAdd(vs));
if (!r) lines.push('    returned null');
else {
  lines.push('    ' + r.triangles.length + ' triangles out');
  var total = r.triangles.reduce(function (s, t) { return s + area(vs, t); }, 0);
  lines.push('    area  ' + total.toFixed(6) + '   (original ' + area(verts, tri).toFixed(6) + ')');
  lines.push('    inserted on edges: ' + r.inserted.map(function (e) {
    return '(' + e[0] + ',' + e[1] + ')->' + e[2]; }).join(' '));
}

lines.push('');
lines.push('  APPLY IT WITHOUT MOVING AN INDEX');
var faces = [[0,1,2],[3,4,5],[6,7,8],[9,10,11]];
var payload = ['a','b','c','d'];
var res = applySplit(faces, payload, 1, [[3,4,9],[4,5,9]]);
lines.push('    faces   ' + JSON.stringify(res.faces));
lines.push('    payload ' + JSON.stringify(res.payload));
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
            body + '\nreturn { cutTriangle, applySplit };',
          )(doc, { log() {} });
        } catch (e) { return no('The code did not run: ' + e.message); }
        for (const n of ['cutTriangle', 'applySplit']) {
          if (typeof fn[n] !== 'function') return no(n + ' is not a function.');
        }

        const areaOf = (vs, t) => {
          const p = vs[t[0]], q = vs[t[1]], r = vs[t[2]];
          return Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) / 2;
        };
        const mkAdd = (vs) => {
          const idx = {};
          vs.forEach((v, i) => { idx[v[0].toFixed(9) + ',' + v[1].toFixed(9)] = i; });
          return (x, y) => {
            const k = x.toFixed(9) + ',' + y.toFixed(9);
            if (!(k in idx)) { idx[k] = vs.length; vs.push([x, y]); }
            return idx[k];
          };
        };

        // A triangle it must NOT cut.
        {
          const vs = [[0, 0], [4, 0], [0, 3]];
          const r = fn.cutTriangle(vs.map((v) => v.slice()), [0, 1, 2], 9.0, mkAdd(vs));
          if (r !== null) {
            return no('cutTriangle returned a result for a line at x = 9 that the '
              + 'triangle does not reach. Return null when the triangle does not '
              + 'straddle — otherwise a whole-mesh pass splits faces at random.');
          }
        }

        const cases = [
          ['a right triangle', [[0, 0], [4, 0], [0, 3]], [0, 1, 2], 1.3],
          ['the lone vertex on the right', [[0, 0], [4, 0], [0, 3]], [0, 1, 2], 3.1],
          ['an oblique triangle', [[-1, 0.5], [2.5, -1], [1.2, 2.8]], [0, 1, 2], 1.0],
          ['a thin sliver', [[0, 0], [5, 0.05], [5, 0]], [0, 1, 2], 2.5],
        ];
        for (const [label, baseV, tri, cut] of cases) {
          const vs = baseV.map((v) => v.slice());
          const before = areaOf(baseV, tri);
          let r;
          try { r = fn.cutTriangle(vs, tri, cut, mkAdd(vs)); } catch (e) {
            return no('cutTriangle threw on ' + label + ': ' + e.message);
          }
          if (!r || !Array.isArray(r.triangles) || !Array.isArray(r.inserted)) {
            return no('cutTriangle should return { triangles, inserted } on '
              + label + '. It gave ' + JSON.stringify(r) + '.');
          }
          if (r.triangles.length !== 3) {
            return no('On ' + label + ' you returned ' + r.triangles.length
              + ' triangles. A line crossing a triangle cuts off one corner and '
              + 'leaves a quad, and a quad needs two triangles — so the answer '
              + 'is always 3.');
          }
          const after = r.triangles.reduce((s, t) => s + areaOf(vs, t), 0);
          if (Math.abs(after - before) > 1e-9) {
            const mid = (() => {
              // Would a midpoint split give this area? It would still total
              // correctly, so check the crossing points directly instead.
              return false;
            })();
            return no('On ' + label + ' the pieces total ' + after.toFixed(9)
              + ' but the original area is ' + before.toFixed(9)
              + '. The cut must not invent or lose surface.' + (mid ? '' : ''));
          }
          // Diagnose the cause before the symptom: a point that is not on
          // the cut makes the pieces straddle, and naming the point is more
          // use to the reader than naming the consequence.
          for (const e of (r.inserted ?? [])) {
            const m = Array.isArray(e) ? e[2] : undefined;
            if (typeof m === 'number' && vs[m]
                && Math.abs(vs[m][0] - cut) > 1e-9) {
              return no('On ' + label + ' the new vertex sits at x = '
                + vs[m][0].toFixed(6) + ' but the cut is at x = ' + cut
                + '. Find the crossing by interpolating along the edge \u2014 '
                + 't = da / (da \u2212 db) \u2014 not by taking its midpoint. A '
                + 'midpoint looks almost right and leaves the pieces straddling '
                + 'the line.');
            }
          }

          // Every piece must be wholly on one side.
          for (const t of r.triangles) {
            const xs = t.map((i) => vs[i][0]);
            if (Math.min(...xs) < cut - 1e-9 && Math.max(...xs) > cut + 1e-9) {
              return no('On ' + label + ' one output triangle still straddles the '
                + 'cut. Every piece has to end up wholly on one side — that is '
                + 'the entire point of cutting.');
            }
          }
          // The new points must be ON the line, which is what rules out a midpoint split.
          if (r.inserted.length !== 2) {
            return no('On ' + label + ' you reported ' + r.inserted.length
              + ' inserted vertices, expected 2 — the line crosses exactly two '
              + 'of the three edges.');
          }
          for (const e of r.inserted) {
            if (!Array.isArray(e) || e.length !== 3) {
              return no('Each inserted entry should be [u, v, m]. Got '
                + JSON.stringify(e) + '.');
            }
            const [u, v, m] = e;
            if (!tri.includes(u) || !tri.includes(v) || u === v) {
              return no('On ' + label + ' inserted names edge (' + u + ', ' + v
                + '), which is not an edge of the original triangle ['
                + tri.join(', ') + ']. The repair pass needs the EDGE, not just '
                + 'the point — without it, it cannot find the neighbour to fix.');
            }
            if (Math.abs(vs[m][0] - cut) > 1e-9) {
              return no('On ' + label + ' inserted vertex ' + m + ' sits at x = '
                + vs[m][0].toFixed(6) + ', not on the cut at x = ' + cut
                + '. Find the crossing by interpolating along the edge '
                + '— t = da / (da − db) — not by taking its midpoint.');
            }
            // and it must actually lie between u and v
            const lo = Math.min(vs[u][0], vs[v][0]), hi = Math.max(vs[u][0], vs[v][0]);
            if (vs[m][0] < lo - 1e-9 || vs[m][0] > hi + 1e-9) {
              return no('On ' + label + ' the inserted point is not between the '
                + 'endpoints of the edge it claims to be on.');
            }
          }
        }

        // applySplit: nothing may move.
        {
          const faces = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11]];
          const payload = ['a', 'b', 'c', 'd'];
          const newTris = [[3, 4, 9], [4, 5, 9]];
          const snapFaces = JSON.parse(JSON.stringify(faces));
          let res;
          try {
            res = fn.applySplit(faces, payload, 1, newTris);
          } catch (e) { return no('applySplit threw: ' + e.message); }
          if (!res || !Array.isArray(res.faces) || !Array.isArray(res.payload)) {
            return no('applySplit should return { faces, payload }. Got '
              + JSON.stringify(res) + '.');
          }
          if (res.faces.length !== 6) {
            return no('applySplit produced ' + res.faces.length + ' faces, '
              + 'expected 6 — the original 4 with the split one retired in '
              + 'place, plus its 2 replacements appended. If you got 5, the '
              + 'retired face was removed and every index after it has shifted.');
          }
          if (res.payload.length !== res.faces.length) {
            return no('faces has ' + res.faces.length + ' entries and payload has '
              + res.payload.length + '. Every array indexed by face has to grow '
              + 'with it, or the new faces read past the end.');
          }
          for (const i of [0, 2, 3]) {
            if (JSON.stringify(res.faces[i]) !== JSON.stringify(snapFaces[i])) {
              return no('Index ' + i + ' used to be ['
                + snapFaces[i].join(', ') + '] and is now ['
                + res.faces[i].join(', ') + ']. Splitting face 1 must not move '
                + 'face ' + i + ' — measured, one delete renames 1,280 faces’ '
                + 'data and nothing raises.');
            }
            if (res.payload[i] !== payload[i]) {
              return no('The payload at index ' + i + ' changed from "'
                + payload[i] + '" to "' + res.payload[i] + '".');
            }
          }
          const retired = res.faces[1];
          if (new Set(retired).size === 3) {
            return no('Face 1 is still a real triangle ['
              + retired.join(', ') + ']. It has been replaced, so it must be '
              + 'retired in place as a degenerate triangle — three identical '
              + 'corners — or it will be drawn and measured twice.');
          }
          const tail = [res.faces[4], res.faces[5]].map((t) => JSON.stringify(t)).sort();
          const want = newTris.map((t) => JSON.stringify(t)).sort();
          if (tail.join('|') !== want.join('|')) {
            return no('The replacements should be appended at the end. Found '
              + tail.join(' and ') + '.');
          }
          if (res.payload[4] !== 'b' || res.payload[5] !== 'b') {
            return no('The new faces should inherit the payload of the face they '
              + 'came from ("b"), got "' + res.payload[4] + '" and "'
              + res.payload[5] + '".');
          }
        }

        // Splitting the LAST face must also behave.
        {
          const faces = [[0, 1, 2], [3, 4, 5]];
          const payload = [10, 20];
          const res = fn.applySplit(faces, payload, 1, [[3, 4, 6], [4, 5, 6]]);
          if (res.faces.length !== 4 || new Set(res.faces[1]).size === 3) {
            return no('Splitting the last face should still retire it in place '
              + 'and append — got ' + res.faces.length + ' faces with index 1 = '
              + JSON.stringify(res.faces[1]) + '.');
          }
        }

        return {
          pass: true,
          message: 'The cut lands where the line actually crosses rather than at a '
            + 'midpoint, every piece ends up on one side, the inserted vertices name '
            + 'the edges they sit on so a repair pass can find the neighbours, and no '
            + 'existing index moved. That last one is the whole lesson: the geometry '
            + 'was the easy half.',
        };
      },
      successMessage: '✓ Cut exactly, and nothing else moved.',
      failMessage: '✗ Not yet.',
      outputHeight: 470,
    },

  ],
};

const PY_CELLS = [
  {
    id: 'why',
    cellTitle: 'Why refining the mesh is the wrong lever',
    prose: [
      'A toolpath boundary lands wherever the machining changed. It has no reason to follow triangle edges, so it runs through faces and leaves them half one operation and half the other. A single colour per face cannot express that.',
      'The instinct is to export a finer mesh. Measure whether that works: count the faces a boundary straddles at several grid densities, as a fraction of the whole.',
      'Watch the ratio between successive refinements rather than the raw numbers. The straddling faces sit along a line while the total sits over an area, so the fraction should fall linearly - which means it approaches zero and reaches it only in the limit, while the cost of getting there is the whole mesh.',
    ],
    code: `import numpy as np

def plate(nx, ny, W=10.0, H=6.0):
    verts, index, faces = [], {}, []
    def vid(p):
        key = (round(p[0], 9), round(p[1], 9))
        if key not in index:
            index[key] = len(verts); verts.append(key)
        return index[key]
    xs, ys = np.linspace(0, W, nx+1), np.linspace(0, H, ny+1)
    for i in range(nx):
        for j in range(ny):
            a = vid((xs[i], ys[j]));   b = vid((xs[i+1], ys[j]))
            c = vid((xs[i+1], ys[j+1])); d = vid((xs[i], ys[j+1]))
            faces += [[a,b,c], [a,c,d]]
    return np.array(verts, float), np.array(faces)

def area(V, F):
    t = V[F]; ab, ac = t[:,1]-t[:,0], t[:,2]-t[:,0]
    return float(np.abs(ab[:,0]*ac[:,1] - ab[:,1]*ac[:,0]).sum() / 2)

CUT = 3.17        # deliberately not on any grid line

def side(V, F):
    s = np.sign(V[F][:,:,0] - CUT)
    out = np.zeros(len(F))
    out[np.all(s <= 0, axis=1)] = -1
    out[np.all(s >= 0, axis=1)] = +1
    return out

print(f"{'grid':>8} {'faces':>9} {'straddling':>11} {'% faces':>9} {'% area':>8}")
rows = []
for n in (10, 20, 40, 80, 160):
    V, F = plate(n, max(n*3//5, 1))
    mixed = side(V, F) == 0
    rows.append((n, len(F), int(mixed.sum()), float(mixed.mean())))
    print(f'{n:>8} {len(F):>9,} {int(mixed.sum()):>11,} '
          f'{100*mixed.mean():>8.2f}% {100*area(V, F[mixed])/area(V, F):>7.2f}%')

ratios = [rows[i][3]/rows[i+1][3] for i in range(len(rows)-1)]
print()
print(f'ratio between successive refinements: '
      f'{", ".join(f"{r:.2f}" for r in ratios)}   (2.00 is exactly 1/n)')
print()
print(f'going from {rows[0][0]} to {rows[-1][0]} multiplied the faces by '
      f'{rows[-1][1]/rows[0][1]:.0f}x')
print(f'to cut the mixed fraction by {rows[0][3]/rows[-1][3]:.0f}x.')
print()
print('Refining helps and never finishes, and it pays across the whole mesh')
print('for a problem that lives on one line. Cut the faces instead.')`,
  },
  {
    id: 'cut',
    cellTitle: 'Cutting a triangle where the line actually crosses',
    prose: [
      'This is not a midpoint subdivision. The line crosses two of the three edges, and where it crosses is found by interpolating along each edge using the signed distances of its endpoints.',
      'Geometrically the line cuts off one corner and leaves a quadrilateral, and a quad needs two triangles - so one triangle in always gives three triangles out. The lone vertex is the one by itself on its side of the line.',
      'Two things must be checked rather than assumed: that the total area is unchanged, and that every output piece lies wholly on one side. The first says no surface was invented or lost; the second says the cut actually achieved its purpose.',
    ],
    code: `def split_triangle(V, tri, cut):
    """Cut at x = cut. Returns (inserted, triangles) where inserted records
    which EDGE each new point landed on - the repair pass needs that."""
    d = [V[i][0] - cut for i in tri]
    if all(x >= 0 for x in d) or all(x <= 0 for x in d):
        return [], [list(tri)]
    sg = [1 if x > 0 else -1 for x in d]
    lone = next(i for i in range(3)
                if sg[i] != sg[(i+1)%3] and sg[i] != sg[(i+2)%3])
    a, b, c = tri[lone], tri[(lone+1)%3], tri[(lone+2)%3]
    da, db, dc = d[lone], d[(lone+1)%3], d[(lone+2)%3]
    pab = V[a] + (V[b] - V[a]) * (da / (da - db))
    pac = V[a] + (V[c] - V[a]) * (da / (da - dc))
    return ([((a, b), tuple(pab)), ((a, c), tuple(pac))],
            [[a, 'AB', 'AC'], ['AB', b, c], ['AB', c, 'AC']])

V = np.array([[0.0, 0.0], [4.0, 0.0], [0.0, 3.0]])
tri = [0, 1, 2]
for cut in (1.3, 3.1, -1.0):
    ins, tris = split_triangle(V, tri, cut)
    if len(tris) == 1:
        print(f'  cut at x = {cut:>5}: does not straddle, returned unchanged')
        continue
    print(f'  cut at x = {cut:>5}: {len(tris)} triangles out')
    for (u, v), p in ins:
        print(f'      new vertex on edge ({u},{v}) at '
              f'({p[0]:.4f}, {p[1]:.4f})  - exactly on the line: '
              f'{abs(p[0]-cut) < 1e-12}')

print()
print('The new point is ON the cut, which is what a midpoint split would not')
print('give. It is found by interpolation: t = da / (da - db) along the edge.')`,
  },
  {
    id: 'crack',
    cellTitle: 'Where the crack is, and where it is not',
    prose: [
      'An edge used by only one face is a boundary edge. Counting them finds cracks, because nothing else about the mesh changes when one opens - the area is identical, the triangles are all valid, and it still draws.',
      'Three scenarios, and the first one is the surprise. I expected a cut that splits every face it crosses to open one crack per split. Measure it before believing that.',
      'Then a cut that stops partway, which is what a real toolpath boundary does, and finally a single face split by itself - which is what a user does by hand.',
    ],
    code: `def edge_map(F):
    em = {}
    for fi, (a, b, c) in enumerate(F):
        for u, v in ((a,b), (b,c), (c,a)):
            em.setdefault((min(u,v), max(u,v)), []).append(fi)
    return em

def boundary_edges(F):
    return sum(1 for v in edge_map(F).values() if len(v) == 1)

def split_mesh(V, F, cut, repair, y_stop=None):
    V2 = [tuple(v) for v in V]
    index = {(round(v[0],9), round(v[1],9)): i for i, v in enumerate(V2)}
    def vid(p):
        key = (round(p[0],9), round(p[1],9))
        if key not in index:
            index[key] = len(V2); V2.append(key)
        return index[key]

    todo = set(np.flatnonzero(side(V, F) == 0).tolist())
    if y_stop is not None:
        cents = V[F].mean(axis=1)
        todo = {i for i in todo if cents[i][1] < y_stop}

    out, dropped, inserted = [], set(), {}
    for fi in sorted(todo):
        ins, tris = split_triangle(V, F[fi], cut)
        if len(tris) == 1:
            continue
        dropped.add(fi)
        ids = {}
        for n, ((u, v), pt) in enumerate(ins):
            m = vid(np.asarray(pt))
            inserted[(min(u,v), max(u,v))] = m
            ids['AB' if n == 0 else 'AC'] = m
        for t in tris:
            out.append([ids[x] if isinstance(x, str) else x for x in t])

    keep = [list(F[i]) for i in range(len(F)) if i not in dropped]

    if repair:
        # A surviving face using an edge that gained a vertex must be split AT
        # THAT VERTEX. Re-applying the cut does nothing - it does not straddle.
        fixed = []
        for a, b, c in keep:
            hit = None
            for u, v, w in ((a,b,c), (b,c,a), (c,a,b)):
                m = inserted.get((min(u,v), max(u,v)))
                if m is not None:
                    hit = (u, v, w, m); break
            if hit is None:
                fixed.append([a,b,c])
            else:
                u, v, w, m = hit
                fixed += [[u,m,w], [m,v,w]]
        keep = fixed

    return np.array(V2, float), np.array(keep + out)

V, F = plate(40, 24)
base_a, base_b, base_n = area(V, F), boundary_edges(F), len(F)
print(f'  before: {base_n:,} faces, area {base_a:.6f}, {base_b:,} boundary edges')
print()

Y_STOP = 3.4
scenarios = {
    'cut all the way across': split_mesh(V, F, CUT, False),
    'cut stopping partway': split_mesh(V, F, CUT, False, Y_STOP),
    'cut stopping partway, repaired': split_mesh(V, F, CUT, True, Y_STOP),
}
print(f"{'scenario':>34} {'faces':>8} {'area':>12} {'boundary':>9}")
for label, (V2, F2) in scenarios.items():
    print(f'{label:>34} {len(F2):>8,} {area(V2, F2):>12.6f} '
          f'{boundary_edges(F2):>9,}')

def split_one_alone(V, F, fi):
    a, b, c = F[fi]
    edges = [(a,b,c), (b,c,a), (c,a,b)]
    lens = [np.linalg.norm(V[u]-V[v]) for u, v, _ in edges]
    u, v, w = edges[int(np.argmax(lens))]
    V2 = np.vstack([V, (V[u]+V[v])/2]); m = len(V2)-1
    F2 = np.vstack([np.delete(F, fi, axis=0), [[u,m,w], [m,v,w]]])
    return V2, F2

V1, F1 = split_one_alone(V, F, len(F)//2)
print(f'{"one interior face split alone":>34} {len(F1):>8,} '
      f'{area(V1, F1):>12.6f} {boundary_edges(F1):>9,}')

print()
print('A cut running ALL THE WAY ACROSS opens no interior cracks. It crosses')
print('every interior edge on BOTH sides, so both triangles gain the same new')
print('vertex and still meet. The +2 is the plate rim, where one edge became two.')
print()
print('The crack is at the TERMINATION - and a lone split adds 3, one per edge,')
print('because none of its three neighbours was told.')`,
  },
  {
    id: 'index',
    cellTitle: 'One delete, and 1,280 faces mean something else',
    prose: [
      'Section 16 states the invariant: if other data indexes into the face array, changing the ordering changes the meaning of all of it. In this application that is four arrays at once - the per-face role, the distance moved, the face lists inside baked images, and the attribution owner from lesson 12.',
      'A split has to replace a face, which is the case that "append, never reorder" does not directly cover. Compare two schemes: delete the face and append its replacements, or retire it in place as a degenerate triangle and append.',
      'Measure the right thing. The invariant is about indices, not identity - the question is whether the new array still means at index i what the old one meant at index i. An earlier version of this measurement looked faces up by their vertex tuple, found each one wherever it had moved to, and reported zero corruption where the real figure is 1,280.',
    ],
    code: `owner = (np.arange(len(F)) % 7).astype(int)     # stand-in for four real arrays
victim = len(F) // 3

def replacements(Fx, fi):
    a, b, c = Fx[fi]
    return [[a, b, c], [a, b, c]]              # two real rows, not placeholders

def delete_and_append(Fx, own, fi):
    rep = replacements(Fx, fi)
    return (np.vstack([np.delete(Fx, fi, axis=0), rep]),
            np.concatenate([np.delete(own, fi), [own[fi]]*len(rep)]))

def tombstone_and_append(Fx, own, fi):
    rep = replacements(Fx, fi)
    F2 = np.vstack([Fx, rep])
    F2[fi] = [Fx[fi][0]] * 3                   # retired in place, zero area
    return F2, np.concatenate([own, [own[fi]]*len(rep)])

def still_correct(F2, o2):
    """Does F2[i] still mean what F[i] meant? Indices, not identity."""
    return sum(1 for i in range(len(F))
               if i < len(F2) and np.array_equal(F2[i], F[i]) and o2[i] == owner[i])

Fd, od = delete_and_append(F, owner, victim)
Ft, ot = tombstone_and_append(F, owner, victim)

print(f"{'scheme':<24} {'faces':>8} {'original indices still correct':>32}")
print(f'{"delete and append":<24} {len(Fd):>8,} '
      f'{still_correct(Fd, od):>24,} of {len(F):,}')
print(f'{"tombstone and append":<24} {len(Ft):>8,} '
      f'{still_correct(Ft, ot):>24,} of {len(F):,}')
print()
print(f'  splitting face {victim:,} by delete renamed '
      f'{len(F)-still_correct(Fd, od):,} faces\\' data')
print(f'  by tombstone it renamed {len(F)-still_correct(Ft, ot):,} '
      f'(the split face, deliberately)')
print(f'  faces after the victim: {len(F)-victim-1:,}')
print()
print('One split. One delete. Every face after it shifts down by one and reads')
print('somebody else\\'s owner, role, distance and image entry. Nothing raises.')
print('The part still draws. The colours are one face out for the rest of the array.')`,
  },
  {
    id: 'price',
    cellTitle: 'The tombstone is not free',
    prose: [
      'Retiring a face in place solves the index problem completely, so it is tempting to stop there. It has a cost, and the cost is permanent rather than one-off.',
      'Every split leaves a degenerate triangle - three identical corners, zero area - in the face array forever. They accumulate, and every pass over the array from then on has to skip them.',
      'Measure how fast they build up, and be specific about what happens to a pass that forgets: a zero-area triangle has a zero-length normal, so normalising it divides by zero. That is exactly the degenerate guard lesson 5 put into the point-to-triangle solver, and it is needed here for a different reason.',
    ],
    code: `Fm, om = F.copy(), owner.copy()
print(f"{'splits':>8} {'faces':>9} {'tombstones':>11} {'% dead':>8}")
for target in (0, 50, 100, 200, 400):
    while True:
        done = int(np.sum([len(set(t)) < 3 for t in Fm]))
        if done >= target:
            break
        Fm, om = tombstone_and_append(Fm, om, (done * 7) % len(F))
    dead = int(np.sum([len(set(t)) < 3 for t in Fm]))
    print(f'{target:>8} {len(Fm):>9,} {dead:>11,} {100*dead/len(Fm):>7.1f}%')

# What a pass that forgets to skip them actually does.
t = Fm[np.flatnonzero([len(set(x)) < 3 for x in Fm])[0]]
P = np.array([list(V[i]) + [0.0] for i in t])
n = np.cross(P[1]-P[0], P[2]-P[0])
print()
print(f'  a tombstone triangle: corners {list(t)}')
print(f'  its normal before normalising: {n}  (length {np.linalg.norm(n)})')
with np.errstate(invalid='ignore', divide='ignore'):
    unit = n / np.linalg.norm(n)
print(f'  after normalising:             {unit}')
print()
print('nan, silently. It will propagate into every dot product it touches, and')
print('lesson 8 showed what a nan does to a comparison: np.argmin RETURNS its')
print('index while a JS "if (d < best)" SKIPS it. Same data, opposite bugs.')
print()
print('So the real trade is not "tombstone right, delete wrong". It is one')
print('corrupted array against a permanent filtering obligation - and the')
print('second is far cheaper than the first.')`,
  },
  {
    id: 'ch-cut',
    challengeType: 'write',
    challengeTitle: 'Cut it where the line is',
    difficulty: 'warm-up',
    prompt:
      'Write cut_at(V, tri, cut) returning (inserted, triangles) as split_triangle does: '
      + 'three triangles when the face straddles, and the inserted list naming which edge '
      + 'each new point landed on. Then set report to a list of (label, n_triangles, '
      + 'area_before, area_after) rows, including one triangle the line misses entirely.',
    hint:
      'Signed distances d = V[i][0] - cut. If they are all one sign, return the triangle '
      + 'unchanged. Otherwise the lone vertex is the one whose sign differs from both '
      + 'others, and the crossing on edge (a,b) is at t = da / (da - db).',
    code: `def cut_at(V, tri, cut):
    # TODO
    pass


def tri_area(V, t):
    p, q, r = V[t[0]], V[t[1]], V[t[2]]
    return abs((q[0]-p[0])*(r[1]-p[1]) - (q[1]-p[1])*(r[0]-p[0])) / 2


report = []
# TODO: (label, n_triangles, area_before, area_after) rows

for label, n, a0, a1 in report:
    print(f'  {label:<24} {n} triangles   area {a0:.6f} -> {a1:.6f}')`,
    solution: `def cut_at(V, tri, cut):
    d = [V[i][0] - cut for i in tri]
    if all(x >= 0 for x in d) or all(x <= 0 for x in d):
        return [], [list(tri)]
    sg = [1 if x > 0 else -1 for x in d]
    lone = next(i for i in range(3)
                if sg[i] != sg[(i+1)%3] and sg[i] != sg[(i+2)%3])
    a, b, c = tri[lone], tri[(lone+1)%3], tri[(lone+2)%3]
    da, db, dc = d[lone], d[(lone+1)%3], d[(lone+2)%3]
    pab = V[a] + (V[b] - V[a]) * (da / (da - db))
    pac = V[a] + (V[c] - V[a]) * (da / (da - dc))
    return ([((a, b), tuple(pab)), ((a, c), tuple(pac))],
            [[a, 'AB', 'AC'], ['AB', b, c], ['AB', c, 'AC']])


def tri_area(V, t):
    p, q, r = V[t[0]], V[t[1]], V[t[2]]
    return abs((q[0]-p[0])*(r[1]-p[1]) - (q[1]-p[1])*(r[0]-p[0])) / 2


report = []
for label, pts, cut in (
    ('lone vertex left',  [[0.0,0.0],[4.0,0.0],[0.0,3.0]], 1.3),
    ('lone vertex right', [[0.0,0.0],[4.0,0.0],[0.0,3.0]], 3.1),
    ('oblique',           [[-1.0,0.5],[2.5,-1.0],[1.2,2.8]], 1.0),
    ('line misses it',    [[0.0,0.0],[4.0,0.0],[0.0,3.0]], 9.0),
):
    Vx = np.array(pts, float)
    ins, tris = cut_at(Vx, [0,1,2], cut)
    a0 = tri_area(Vx, [0,1,2])
    Vfull = np.vstack([Vx] + ([np.array([p for _, p in ins])] if ins else []))
    names = {'AB': 3, 'AC': 4}
    resolved = [[names[x] if isinstance(x, str) else x for x in t] for t in tris]
    a1 = sum(tri_area(Vfull, t) for t in resolved)
    report.append((label, len(tris), a0, a1))

for label, n, a0, a1 in report:
    print(f'  {label:<24} {n} triangles   area {a0:.6f} -> {a1:.6f}')`,
    testCode: `assert report, "report is empty - nothing was cut."
assert len(report) >= 3, f"only {len(report)} rows; cover both lone-vertex sides"

for _label, _n, _a0, _a1 in report:
    assert abs(_a1 - _a0) < 1e-9, (
        f'"{_label}" changed the area from {_a0:.9f} to {_a1:.9f}. A cut must '
        f'neither invent nor lose surface.')

# A line that misses must return the triangle unchanged.
_V = np.array([[0.0,0.0],[4.0,0.0],[0.0,3.0]])
_ins, _tris = cut_at(_V, [0,1,2], 9.0)
assert len(_tris) == 1 and _ins == [], (
    "a line the triangle does not reach should return it unchanged with no "
    "inserted vertices")

# Both lone-vertex orientations must give three triangles and two crossings.
for _cut in (1.3, 3.1):
    _ins, _tris = cut_at(_V, [0,1,2], _cut)
    assert len(_tris) == 3, (
        f"at cut {_cut} you returned {len(_tris)} triangles. A line crossing a "
        f"triangle cuts off one corner and leaves a quad, which needs two "
        f"triangles - so the answer is always 3.")
    assert len(_ins) == 2, f"at cut {_cut} expected 2 inserted vertices"
    for (_u, _v), _p in _ins:
        assert abs(_p[0] - _cut) < 1e-12, (
            f"the inserted point sits at x = {_p[0]:.9f}, not on the cut at "
            f"{_cut}. Interpolate along the edge - t = da/(da-db) - rather than "
            f"taking its midpoint.")
        assert {_u, _v} <= {0,1,2} and _u != _v, (
            f"inserted names edge ({_u},{_v}), which is not an edge of the "
            f"triangle. The repair pass needs the EDGE, not just the point.")
        _lo, _hi = min(_V[_u][0], _V[_v][0]), max(_V[_u][0], _V[_v][0])
        assert _lo - 1e-12 <= _p[0] <= _hi + 1e-12, (
            "the inserted point is not between the endpoints of its edge")

# And a sliver, where a midpoint split would look almost right.
_S = np.array([[0.0,0.0],[5.0,0.05],[5.0,0.0]])
_ins, _tris = cut_at(_S, [0,1,2], 2.5)
assert len(_tris) == 3 and all(abs(p[0] - 2.5) < 1e-12 for _, p in _ins), (
    "the sliver case failed - this is where a midpoint split is hardest to "
    "spot by eye and easiest to catch by assertion")
"SUCCESS: one triangle in, three out, area exact, and every new point on the line rather than at a convenient midpoint."`,
  },
  {
    id: 'ch-crack',
    challengeType: 'write',
    challengeTitle: 'Find the crack by counting',
    difficulty: 'core',
    prompt:
      'Write count_boundary(F) returning the number of edges used by exactly one face. '
      + 'Then set cracks to a dict mapping each of "full", "partial", "repaired" and '
      + '"lone" to the number of INTERIOR cracks that scenario opens - that is, the '
      + 'increase in boundary edges beyond the 2 the plate rim contributes.',
    hint:
      'Build a dict keyed by the sorted vertex pair of every edge, counting faces. The '
      + 'scenarios dict and split_one_alone are already in scope, as are base_b and the '
      + 'original F. The rim contributes 2 when the cut reaches the edge of the plate.',
    code: `def count_boundary(F):
    # TODO
    pass


cracks = {}
# TODO: interior cracks for 'full', 'partial', 'repaired', 'lone'

for k, v in cracks.items():
    print(f'  {k:<10} {v} interior crack(s)')`,
    solution: `def count_boundary(F):
    counts = {}
    for a, b, c in F:
        for u, v in ((a,b), (b,c), (c,a)):
            key = (min(u,v), max(u,v))
            counts[key] = counts.get(key, 0) + 1
    return sum(1 for n in counts.values() if n == 1)


RIM = 2      # the cut reaches the plate edge, turning one edge into two

cracks = {
    'full':     count_boundary(scenarios['cut all the way across'][1]) - base_b - RIM,
    'partial':  count_boundary(scenarios['cut stopping partway'][1]) - base_b - RIM,
    'repaired': count_boundary(scenarios['cut stopping partway, repaired'][1]) - base_b - RIM,
    'lone':     count_boundary(F1) - base_b,
}

for k, v in cracks.items():
    print(f'  {k:<10} {v} interior crack(s)')`,
    testCode: `assert cracks, "cracks is empty - nothing was counted."
for _k in ('full', 'partial', 'repaired', 'lone'):
    assert _k in cracks, f'cracks is missing "{_k}"'

# count_boundary must agree with the reference on the untouched mesh.
assert count_boundary(F) == base_b, (
    f"count_boundary gave {count_boundary(F)} on the original mesh, expected "
    f"{base_b}")

assert cracks['full'] == 0, (
    f"a cut running all the way across reported {cracks['full']} interior "
    f"cracks. It opens none - it crosses every interior edge on BOTH sides, so "
    f"both triangles gain the same vertex and still meet. If you got a positive "
    f"number, the rim contribution has not been subtracted.")
assert cracks['partial'] > 0, (
    "a cut that stops partway must crack at its termination, where the last "
    "split face has a new vertex on an edge its neighbour knows nothing about")
assert cracks['repaired'] < cracks['partial'], (
    f"repairing left {cracks['repaired']} cracks against {cracks['partial']} "
    f"unrepaired - the repair must reduce them")
assert cracks['lone'] == 3, (
    f"splitting one interior face alone reported {cracks['lone']} cracks, "
    f"expected 3 - one per edge, because none of its three neighbours was told")
"SUCCESS: the full cut is self-consistent, the crack is at the termination, and a lone split cracks on all three edges. Counting boundary edges is how you find any of it."`,
  },
  {
    id: 'ch-index',
    challengeType: 'write',
    challengeTitle: 'Split a face without renaming anybody else',
    difficulty: 'stretch',
    prompt:
      'Write split_preserving(Fx, own, fi, new_tris) returning (F2, owner2) with the split '
      + 'face retired in place as a degenerate triangle and new_tris appended, so no '
      + 'existing index moves. Then set corrupted to a dict mapping "delete" and '
      + '"tombstone" to how many original indices no longer mean what they meant.',
    hint:
      'np.vstack to append, then overwrite row fi with three copies of one of its corners. '
      + 'The owner array must grow by the same number of rows, with the new faces '
      + 'inheriting own[fi]. To count corruption, compare F2[i] against F[i] and owner2[i] '
      + 'against owner[i] for every original i.',
    code: `def split_preserving(Fx, own, fi, new_tris):
    # TODO
    pass


corrupted = {}
# TODO: {'delete': n, 'tombstone': n}

print(corrupted)`,
    solution: `def split_preserving(Fx, own, fi, new_tris):
    F2 = np.vstack([Fx, np.array(new_tris)])
    F2[fi] = [Fx[fi][0]] * 3                        # retired in place
    own2 = np.concatenate([own, [own[fi]] * len(new_tris)])
    return F2, own2


def count_corrupted(F2, o2):
    return sum(1 for i in range(len(F))
               if not (i < len(F2) and np.array_equal(F2[i], F[i])
                       and o2[i] == owner[i]))


new_tris = replacements(F, victim)
Fd2, od2 = delete_and_append(F, owner, victim)
Ft2, ot2 = split_preserving(F, owner, victim, new_tris)

corrupted = {'delete': count_corrupted(Fd2, od2),
             'tombstone': count_corrupted(Ft2, ot2)}

print(corrupted)`,
    testCode: `assert corrupted, "corrupted is empty - nothing was measured."
for _k in ('delete', 'tombstone'):
    assert _k in corrupted, f'corrupted is missing "{_k}"'

assert corrupted['tombstone'] == 1, (
    f"tombstoning corrupted {corrupted['tombstone']} indices, expected exactly "
    f"1 - the split face itself, retired deliberately. Anything more means an "
    f"existing index moved.")
assert corrupted['delete'] == len(F) - victim, (
    f"delete-and-append corrupted {corrupted['delete']} indices, expected "
    f"{len(F) - victim} - the victim plus every one of the {len(F)-victim-1:,} "
    f"faces after it, each shifted down by one.")
assert corrupted['delete'] > 100 * corrupted['tombstone'], (
    "the two schemes should differ by orders of magnitude, not by a little")

# The retired row must actually be degenerate, or it gets drawn twice.
_F2, _o2 = split_preserving(F, owner, victim, replacements(F, victim))
assert len(set(_F2[victim].tolist())) < 3, (
    f"index {victim} is still a real triangle {_F2[victim].tolist()}. It has "
    f"been replaced, so it must be retired as a degenerate triangle or the same "
    f"surface is drawn and measured twice.")

# Every other original index must be untouched.
for _i in (0, 1, victim - 1, victim + 1, len(F) - 1):
    assert np.array_equal(_F2[_i], F[_i]) and _o2[_i] == owner[_i], (
        f"index {_i} changed, and it must not have")

# And the payload must grow with the faces.
assert len(_o2) == len(_F2), (
    f"faces has {len(_F2)} rows and owner has {len(_o2)} - every array indexed "
    f"by face has to grow with it, or the new faces read past the end")
assert all(_o2[len(F) + k] == owner[victim] for k in range(len(replacements(F, victim)))), (
    "the appended faces should inherit the owner of the face they came from")
"SUCCESS: one delete renames 1,280 faces' data and nothing raises; one tombstone renames exactly the face you retired."`,
  },
];

export default {
  id: 'mesh-engine-3-2-face-splitting',
  slug: 'face-splitting',
  chapter: 'mesh-engine.3',
  order: 1,
  title: 'Face Splitting and the Index Invariant',
  subtitle: 'Where the crack actually is, and what one delete costs.',
  tags: [
    'face splitting', 'subdivision', 't-junction', 'crack', 'boundary edges',
    'index invariant', 'tombstone', 'degenerate triangle', 'parallel arrays', 'provenance',
  ],
  aliases: 'face splitting split a face subdivide triangle cut along a line toolpath boundary t-junction crack boundary edges watertight index invariant parallel arrays face indexed data tombstone degenerate triangle append never reorder',
  timeToComplete: 75,
  coreConcept:
    'A toolpath boundary crosses faces, and a face that is half one operation cannot be coloured correctly. Refining the mesh is the wrong lever: measured, the straddling fraction falls exactly like 1/n - 10.00% at a 10-grid down to 0.62% at 160 - because those faces sit along a line while the total sits over an area, so 256x the faces buys 16x the improvement and never reaches zero. Cutting the faces where the boundary is preserves area exactly and leaves nothing straddling. The crack is not where it looks: a cut running all the way across the mesh opens ZERO interior cracks, because it crosses every interior edge on both sides and both triangles gain the same vertex. The T-junction is at the termination, where the cut stops, and at a lone face split by hand, which adds exactly 3 boundary edges. Repairing it means splitting the neighbour at the inserted point, not re-applying the cut - so the cut must record which edge each new vertex landed on. Then the bookkeeping, which is the harder half: splitting face 640 of 1,920 by delete-and-append leaves 640 of 1,920 indices correct, silently renaming 1,280 faces of owner, role, distance and image data, while tombstoning renames exactly 1.',
  prerequisites: ['mesh-engine-3-1-selection'],
  nextLesson: null,

  semantics: {
    core: [
      { symbol: 'straddling face', meaning: 'A face the boundary crosses. Half one operation, half the other, and one colour cannot say so.' },
      { symbol: 't = da / (da − db)', meaning: 'Where the line crosses an edge, by interpolating the signed distances. Not the midpoint.' },
      { symbol: '1 triangle in, 3 out', meaning: 'The line cuts off one corner and leaves a quad, and a quad needs two triangles.' },
      { symbol: 'boundary edge', meaning: 'An edge used by exactly one face. Counting them is how a crack is found, because nothing else changes.' },
      { symbol: 'T-junction', meaning: 'A vertex partway along an edge whose neighbour still names only the endpoints. A visible hairline that nothing errors on.' },
      { symbol: 'the index invariant', meaning: 'Does F2[i] still mean what F[i] meant? About indices, not identity — a test on identity reports zero corruption.' },
      { symbol: 'tombstone', meaning: 'A retired face left in place as a degenerate triangle so no index moves. Costs a permanent filtering obligation.' },
    ],
    rulesOfThumb: [
      'Cut faces at the boundary rather than refining the mesh. Refining costs the whole model for a problem that lives on one line.',
      'Find the crossing by interpolation. A midpoint split looks almost right and is not on the line.',
      'Record which EDGE each new vertex landed on, not just where it is. A repair pass cannot find the neighbour otherwise.',
      'Count boundary edges before and after any topology change. It is the only cheap signal that a crack opened.',
      'Repair a T-junction by splitting the neighbour at the inserted point. Re-applying the cut does nothing — the neighbour does not straddle.',
      'Never delete from an array other data indexes into. Retire in place and append.',
      'Filter degenerate faces in every pass, and guard the normal. A zero-area triangle normalises to nan, silently.',
    ],
  },

  hook: {
    question: 'You cut every face a toolpath boundary crosses — 48 faces on a 1,920-face plate. How many cracks does that open in the mesh?',
    realWorldContext: 'None. Measured, the boundary edge count goes from 128 to 130, and both of those are on the plate rim where one edge became two. A cut that runs all the way across the mesh crosses every interior edge on BOTH sides, so both triangles sharing that edge gain the same new vertex and still meet — it is self-consistent by construction. I expected one crack per split and was wrong. The T-junction is somewhere else: at the point where the cut STOPS, because the last face split has a new vertex on an edge whose neighbour was never told. That is +4. And splitting one interior face by hand, which is what a user does, adds exactly 3 — one per edge. None of it raises an error, the area is unchanged, and the mesh still draws.',
    previewVisualizationId: 'JSNotebook',
  },

  intuition: {
    prose: [
      'A boundary between operations lands where the machining changed, not where the triangles are.',
      'So some faces are half one thing and half another, and a per-face colour cannot express that.',
      'Refining the mesh reduces those faces linearly while multiplying the cost quadratically, so it never wins.',
      'Cutting them is exact and cheap, and the geometry is the easy half of the job.',
      'The hard half is that every array indexed by face has to survive the cut.',
      'And the cheapest fix for that costs a degenerate triangle in the array forever.',
    ],
    callouts: [
      {
        type: 'warning',
        title: 'Refining does not converge fast enough to matter',
        body: 'Measured straddling fraction: 10.00% at a 10-grid, 5.00%, 2.50%, 1.25%, 0.62% at 160. The ratio between successive refinements is exactly 2.00 each time — the straddling faces sit along a LINE while the total sits over an AREA, so the fraction falls like 1/n. Going from 10 to 160 multiplied the faces by 256x to cut the mixed fraction by 16x, and it reaches zero only in the limit.',
      },
      {
        type: 'insight',
        title: 'A cut all the way across opens no cracks',
        body: 'Boundary edges: 128 before, 130 after cutting all 48 straddling faces — and both extras are the plate rim. The cut crosses every interior edge on both sides, so both triangles gain the same vertex and still meet. I expected one crack per split. The crack is at the TERMINATION: a cut stopping partway gives 132, and repairing it gives 129.',
      },
      {
        type: 'warning',
        title: 'A lone split cracks on all three edges',
        body: 'Splitting one interior face by itself — which is exactly what a user does by hand — takes the boundary count from 128 to 131. Three new boundary edges from one split, because none of its three neighbours was told. Nothing errors, the area is unchanged, and the result is a hairline you can see through that changes the behaviour of every watertightness test and every clipping plane along it.',
      },
      {
        type: 'insight',
        title: 'Repairing means a different operation, not more of the same',
        body: 'My first repair grew the set of faces to cut, adding every neighbour of a straddling face, and re-applied the cut. It added faces and closed zero cracks, because those neighbours sit wholly on one side and the cut does nothing to them. Closing a T-junction means splitting the neighbour AT THE INSERTED POINT, fanning from its opposite corner — which means the cut has to record which edge each new vertex landed on. Measured, the repair cost 1 extra face and closed 3 cracks.',
      },
      {
        type: 'warning',
        title: 'One delete renames 1,280 faces',
        body: 'Splitting face 640 of 1,920 by delete-and-append leaves 640 of 1,920 original indices still correct. Every face after the victim shifts down one and reads somebody else’s owner, role, distance moved and baked-image entry. Nothing raises. The part still draws. The attribution colours are one face out for the entire remainder of the array. Tombstoning leaves 1,919 of 1,920 correct — the one corruption is the face you retired on purpose.',
      },
      {
        type: 'insight',
        title: 'The tombstone buys correctness with a permanent obligation',
        body: 'Measured after 200 splits: 2,320 faces of which 200 are degenerate tombstones, 8.6% of the array. Every pass from then on must skip them, and a pass that forgets computes a normal from a zero-area triangle — which normalises to nan, silently. Lesson 8 showed what a nan does to a comparison: np.argmin returns its index while a JS "if (d < best)" skips it. Same data, opposite bugs. So the trade is one corrupted array against a permanent filtering duty, and the second is far cheaper.',
      },
      {
        type: 'warning',
        title: 'The invariant is about indices, and a test can miss that',
        body: 'The first version of this measurement looked faces up by their vertex tuple, which finds each face wherever it moved to, and reported 0 corruption where the real figure is 1,280. That measures identity. The invariant asks whether F2[i] still means what F[i] meant. A test that answers the wrong question passes confidently.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Drag the cut, and stop it partway',
        caption: 'Area and boundary edges tracked live, so the crack shows up as a number.',
        props: {
          lesson: LESSON_MESH_3_2,
        },
      },
    ],
  },

  math: {
    prose: [
      'The first cell measures whether refining the mesh solves the problem, because that is the fix everybody reaches for.',
      'Then the cut itself — interpolated to the line, three triangles out, area preserved exactly.',
      'Then boundary-edge counting across three scenarios, which is where the expected answer turns out to be wrong.',
      'Then the index invariant and the price of the fix, including what a tombstone does to a pass that forgets it.',
    ],
    visualizations: [
      {
        id: 'PythonNotebook',
        title: 'Cut it, count the cracks, keep the indices',
        mathBridge: 'The straddling faces are those the cut line intersects, so their count scales with the length of the line through the mesh divided by the edge length — order n — while the total face count scales with the area divided by the edge length squared — order n squared. Their ratio is therefore order 1/n, which is exactly the 2.00 per doubling the measurement shows, and it is why refinement is a losing strategy: cost grows as n squared for a benefit that grows as n. Cutting is a plane-polygon clip: the signed distance of each vertex to the cut plane partitions the three corners, and the single vertex on its own side is separated by two edge crossings found by linear interpolation, leaving a triangle and a quadrilateral whose areas sum exactly to the original because linear interpolation along an edge is exact in floating point up to rounding. The crack condition is purely combinatorial: an edge inserted into one of its two incident faces but not the other leaves that edge referenced once rather than twice, which is precisely the definition of a boundary edge, so counting them detects every T-junction and nothing else.',
        caption: 'Every figure measured, including three claims that were wrong first.',
        props: {
          initialCells: PY_CELLS,
        },
      },
    ],
  },

  examples: [
    {
      title: 'The refinement that buys 16x for 256x',
      prose: 'Going from a 10-grid to a 160-grid takes 120 faces to 30,720 and the straddling fraction from 10.00% to 0.62%. The ratio per doubling is exactly 2.00 — linear improvement, quadratic cost.',
    },
    {
      title: 'The cut that opens nothing',
      prose: '48 faces split, 1,920 to 2,016 faces, area 60.000000 unchanged to 0.00e+00, boundary edges 128 to 130 — and both extras are on the rim.',
    },
    {
      title: 'Three cracks from one manual split',
      prose: 'Splitting a single interior face takes boundary edges from 128 to 131. One per edge, because none of the three neighbours was told.',
    },
    {
      title: 'The delete that renamed 1,280 faces',
      prose: 'Splitting face 640 of 1,920 with a delete leaves 640 indices correct. The 1,279 faces after it each read the previous face’s owner, role, distance and image entry, silently.',
    },
  ],

  challenges: [
    {
      prompt: 'Cut a triangle at a line, preserving area exactly and recording which edge each new vertex landed on.',
      hint: 'The lone vertex is the one whose sign differs from both others. The crossing is at t = da / (da − db).',
    },
    {
      prompt: 'Count boundary edges to find where a split actually cracks the mesh.',
      hint: 'An edge used by exactly one face. Subtract the rim contribution before calling something an interior crack.',
    },
    {
      prompt: 'Split a face without moving any existing index, and measure what the alternative costs.',
      hint: 'Retire the face in place as a degenerate triangle and append. Compare F2[i] against F[i] for every original i.',
    },
    {
      prompt: 'In the browser, cut exactly and apply the split without renaming anybody else.',
      hint: 'Every array indexed by face has to grow with it, and the new faces inherit the payload of the face they came from.',
    },
  ],

  misconceptions: [
    {
      claim: 'A finer mesh removes the problem of faces covered by two operations.',
      reality: 'The straddling fraction falls like 1/n — measured 2.00 per doubling — so 256x the faces buys 16x the improvement and never reaches zero. It pays across the whole mesh for a problem on one line.',
    },
    {
      claim: 'Splitting a face means subdividing it at edge midpoints.',
      reality: 'That puts the new vertex in the wrong place. The cut has to land where the boundary actually crosses, found by interpolating signed distances: t = da / (da − db).',
    },
    {
      claim: 'Every split opens a crack in the neighbour.',
      reality: 'A cut running all the way across opens none — it crosses every interior edge on both sides, so both triangles gain the same vertex. Measured 128 to 130, and both extras are the rim.',
    },
    {
      claim: 'A crack will show up as an error or a failed watertightness check.',
      reality: 'The area is unchanged, every triangle is valid, and it still draws. Only the boundary edge count moves — 128 to 131 for a single manual split.',
    },
    {
      claim: 'To repair a T-junction, split the neighbour the same way you split the face.',
      reality: 'The neighbour does not straddle the cut, so re-applying it does nothing. My first attempt added faces and closed zero cracks. The neighbour must be split at the inserted point, which is why the edge has to be recorded.',
    },
    {
      claim: 'Deleting a face and appending its replacements is fine — the count comes out right.',
      reality: 'The count does. The meaning does not. Measured, one delete leaves 640 of 1,920 indices correct and silently renames 1,280 faces’ owner, role, distance and image data.',
    },
    {
      claim: 'Tombstoning is strictly better, so there is no decision to make.',
      reality: 'It leaves a degenerate triangle in the array forever — 8.6% of the array after 200 splits — and a pass that forgets to skip one normalises a zero-length vector to nan, silently. It is cheaper, not free.',
    },
  ],

  transferPrompts: [
    'Attribution colours look correct on one part and shifted by one face on another. What would you check first?',
    'A part develops a visible hairline after a user edits it. What single number would you measure before and after?',
    'Someone proposes exporting at four times the resolution to fix mixed faces. What would you measure to answer them?',
    'Your mesh passes a watertightness check and still shows a seam. What does that tell you about the check?',
    'Where else in this application does one array index into another, and what breaks if the first is reordered?',
  ],

  debugging: [
    {
      symptom: 'Faces along an operation boundary are the wrong colour, and refining the export barely helps.',
      cause: 'Those faces straddle the boundary, and the fraction only falls like 1/n.',
      fix: 'Cut the straddling faces at the boundary. Area is preserved exactly and nothing straddles afterwards.',
    },
    {
      symptom: 'A visible hairline appears after splitting faces.',
      cause: 'A T-junction — a vertex on an edge whose neighbour still names only the endpoints.',
      fix: 'Count boundary edges before and after. Repair by splitting the neighbour at the inserted point, fanning from its opposite corner.',
    },
    {
      symptom: 'A repair pass runs, adds faces, and the crack is still there.',
      cause: 'The repair re-applied the cut to neighbours that do not straddle it.',
      fix: 'Split at the inserted vertex instead, which needs the edge it landed on recorded at cut time.',
    },
    {
      symptom: 'Attribution, roles or distances are all shifted by one face.',
      cause: 'A face was deleted from an array other arrays index into.',
      fix: 'Retire in place and append. Measured, one delete corrupts every index after it — 1,280 of 1,920.',
    },
    {
      symptom: 'A normal comes out nan, or a distance comparison behaves inconsistently.',
      cause: 'A degenerate tombstone triangle reached a pass that does not skip them.',
      fix: 'Filter faces with fewer than three distinct corners, and keep lesson 5’s degenerate guard in the solver.',
    },
    {
      symptom: 'A test says the face data survived a split, and the display disagrees.',
      cause: 'The test matched faces by their vertices, which finds them wherever they moved to.',
      fix: 'Compare by index: does F2[i] equal F[i] and payload2[i] equal payload[i]?',
    },
  ],

  mastery: {
    prerequisites:
      'Lesson 3 for welding, shared edges and boundary-edge counting — the whole crack argument is built on it. Lesson 12 for the attribution array that a careless split corrupts. Lesson 16A for the selection whose stability under exactly this operation was the reason to prefer the centroid rule. Lesson 5 for the degenerate-triangle guard a tombstone needs.',
    signals: [
      'Reaches for cutting rather than refining when faces straddle a boundary.',
      'Counts boundary edges around any topology change.',
      'Records the edge a new vertex landed on, not just its position.',
      'Never deletes from an array other data indexes into.',
      'Tests the index invariant by index rather than by identity.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'mesh-engine-1-3-topology-and-welding', why: 'Shared edges and boundary-edge counting, which is how every crack in this lesson is found.' },
      { lessonId: 'mesh-engine-3-1-selection', why: 'Why the centroid rule was chosen — it is the only one stable under the split this lesson performs.' },
      { lessonId: 'mesh-engine-1-12-attribution', why: 'The per-face owner array that one careless delete renames 1,280 entries of.' },
      { lessonId: 'mesh-engine-1-5-point-to-triangle', why: 'The degenerate-triangle guard a tombstone makes permanently necessary.' },
    ],
    futureLinks: [],
  },

  checkpoints: [
    'I can say why refining the mesh does not solve mixed faces, with the scaling argument.',
    'I can cut a triangle at a line and show the area is unchanged.',
    'I can explain why a full cut opens no cracks and a terminated one does.',
    'I can find a crack by counting boundary edges.',
    'I can repair a T-junction, and say why re-applying the cut does not.',
    'I can split a face without moving any existing index, and say what that costs.',
  ],

  assessment: {
    task: 'Split the faces a toolpath boundary crosses, on a mesh whose per-face data must survive, and prove that nothing broke.',
    acceptance: [
      'Crossings found by interpolation and verified to lie on the boundary.',
      'Surface area identical before and after, to floating-point precision.',
      'No face left straddling the boundary.',
      'Boundary edge count checked, with any increase accounted for as rim or repaired as a T-junction.',
      'Every array indexed by face still meaning at index i what it meant, verified by index rather than by identity.',
      'Degenerate tombstones filtered in every pass, with the normal guarded.',
    ],
  },

  quiz: [
    {
      question: 'Why does exporting a finer mesh not fix faces covered by two operations?',
      options: [
        'The straddling fraction falls like 1/n while the face count grows like n² — 256× the faces for 16× the improvement',
        'Finer meshes have more straddling faces, not fewer',
        'Because the boundary moves when the mesh changes',
        'It does fix it, given enough resolution',
      ],
      answer: 0,
      explanation: 'Measured 10.00% → 0.62% across a 16× refinement, with a ratio of exactly 2.00 per doubling. Those faces lie along a line; the total covers an area.',
    },
    {
      question: 'How many triangles does cutting one triangle at a line produce?',
      options: [
        'Three — one corner is cut off and the remaining quad needs two triangles',
        'Two',
        'Four, as in a midpoint subdivision',
        'It depends where the line crosses',
      ],
      answer: 0,
      explanation: 'The line crosses two of the three edges, separating the lone vertex from the other two.',
    },
    {
      question: 'A cut that runs all the way across the mesh, splitting 48 faces. How many interior cracks?',
      options: [
        'None — it crosses every interior edge on both sides, so both triangles gain the same vertex',
        'One per split, so 48',
        'Two per split, so 96',
        'One, at the start of the cut',
      ],
      answer: 0,
      explanation: 'Boundary edges went 128 → 130, and both extras are the plate rim. The crack is at the termination, not along the cut.',
    },
    {
      question: 'Splitting one interior face by hand adds how many boundary edges?',
      options: [
        'Three — one per edge, because none of its three neighbours was told',
        'None, if the area is preserved',
        'One',
        'Six',
      ],
      answer: 0,
      explanation: 'Measured 128 → 131. This is the case a user creates, and nothing errors.',
    },
    {
      question: 'How do you repair a T-junction left by a terminated cut?',
      options: [
        'Split the neighbour at the inserted point, fanning from its opposite corner',
        'Re-apply the cut to the neighbour',
        'Weld the mesh again',
        'Delete the inserted vertex',
      ],
      answer: 0,
      explanation: 'The neighbour does not straddle the cut, so re-applying it does nothing — my first attempt added faces and closed zero cracks. The cut must record which edge the vertex landed on.',
    },
    {
      question: 'Splitting face 640 of 1,920 by deleting it and appending its replacements. How many original indices still mean what they meant?',
      options: [
        '640 — the 1,279 faces after it all shifted down one, silently',
        'All 1,920, since the count is corrected',
        '1,919 — only the split face changes',
        'None',
      ],
      answer: 0,
      explanation: 'Every face after the victim reads the previous face’s owner, role, distance and image entry. Tombstoning leaves 1,919 of 1,920 correct.',
    },
    {
      question: 'What does a tombstone cost?',
      options: [
        'A degenerate triangle in the array forever — 8.6% after 200 splits — and a nan normal in any pass that forgets to skip it',
        'Nothing; it is strictly better',
        'Extra memory proportional to the whole mesh',
        'It breaks watertightness',
      ],
      answer: 0,
      explanation: 'A zero-area triangle normalises to nan silently. The trade is one corrupted array against a permanent filtering obligation — and the second is far cheaper.',
    },
  ],
};
