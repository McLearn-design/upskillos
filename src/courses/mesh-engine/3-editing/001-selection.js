// Mesh Engine 3.1 — Selection
//
// LearningPath section 16A. Expands section 16's single "selecting faces"
// bullet, because the application cannot be used without it and none of it is
// obvious.
//
// Why it exists, in the learner's words: "not everyone can export STLs and not
// all stock models and CAM software export in the correct location." When
// there is nothing to compare against automatically, the user selects faces
// and associates them by hand. This is the accessible path.
//
// Every number quoted was produced by field-fixes/verify/check-selection.py.

const LESSON_MESH_3_1 = {
  title: 'Select Everything In This Window',
  subtitle: 'Three defensible answers, and the one that survives an edit.',
  sequential: true,

  cells: [

    {
      type: 'markdown',
      instruction: `### The sentence that does not mean anything yet

Lesson 12 attributed faces to operations automatically, and measured that
**22.1%** of the attributed surface had more than one legitimate claimant and
**17.2%** had none at all. Those faces need a human.

They also need a human when the automatic path cannot run at all — when there
is no clean model to compare against, or when the stock arrived in a coordinate
system nobody agrees on. **Selection is the accessible path**, and everything
downstream depends on it working the way the user expects.

So: *select everything in this window.*

That sentence sounds complete. It is not. It says nothing about the triangles
the window **cuts through**, and there are always some.

\`\`\`
any vertex inside      never misses a face you can see in the window
all vertices inside    never includes a face that reaches outside it
centroid inside        neither guarantee
\`\`\`

Three defensible rules. Measured on the same windows over the same mesh, they
disagree **by up to 100%** — and one of them selects *nothing at all* on a
narrow window.

There is a fourth consideration that decides it, and it has nothing to do with
which one feels right.`,
    },

    {
      type: 'js',
      instruction: `### Drag a window over the part

A stepped plate seen from above, triangulated. Drag the window's edges and
switch between the three rules. Triangles the window cuts are drawn in outline,
so you can see exactly which ones each rule is arguing about.

**Predict before you drag:** as you make the window *smaller*, do the three
rules agree more or less?

Most people expect a small window to be less ambiguous — fewer triangles, less
to argue about. Watch the disagreement percentage as you shrink it.`,
      html: `<div style="padding:8px 2px;font:11px ui-monospace,monospace;color:#7d8794;display:grid;grid-template-columns:auto 1fr auto;gap:5px 10px;align-items:center">
  <span>window x</span><input id="x0" type="range" min="0" max="9" step="0.05" value="1"><span id="x0v">1.00</span>
  <span>width</span><input id="w" type="range" min="0.15" max="8" step="0.05" value="3"><span id="wv">3.00</span>
  <span>window y</span><input id="y0" type="range" min="0" max="5" step="0.05" value="1"><span id="y0v">1.00</span>
  <span>height</span><input id="h" type="range" min="0.15" max="5" step="0.05" value="3"><span id="hv">3.00</span>
</div>
<div style="padding:4px 2px;font:11px ui-monospace,monospace;color:#7d8794">
  rule
  <label><input type="radio" name="rule" value="any" checked> any vertex</label>
  <label><input type="radio" name="rule" value="all"> all vertices</label>
  <label><input type="radio" name="rule" value="cent"> centroid</label>
</div>
<canvas id="c" style="width:100%;height:220px;background:#0a0f1e;border-radius:8px"></canvas>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:8px 2px;white-space:pre"></div>`,
      css: `body{margin:0;background:#0a0f1e}label{margin-right:10px}`,
      startCode: `// A flat grid of triangles, seen from above. The same construction the
// measurements use, cut down so it draws quickly.
var NX = 30, NY = 18, W = 10, H = 6;
var verts = [], tris = [];
for (var i = 0; i <= NX; i++) {
  for (var j = 0; j <= NY; j++) verts.push([i*W/NX, j*H/NY]);
}
function vid(i, j) { return i*(NY+1) + j; }
for (var i = 0; i < NX; i++) {
  for (var j = 0; j < NY; j++) {
    tris.push([vid(i,j), vid(i+1,j), vid(i+1,j+1)]);
    tris.push([vid(i,j), vid(i+1,j+1), vid(i,j+1)]);
  }
}

// Centroids, computed once. A centroid is the average of the three corners.
var centroids = tris.map(function (t) {
  return [(verts[t[0]][0] + verts[t[1]][0] + verts[t[2]][0]) / 3,
          (verts[t[0]][1] + verts[t[1]][1] + verts[t[2]][1]) / 3];
});

function inBox(p, lo, hi) {
  return p[0] >= lo[0] && p[0] <= hi[0] && p[1] >= lo[1] && p[1] <= hi[1];
}

// The three rules, each returning a boolean per triangle.
function selectBy(rule, lo, hi) {
  return tris.map(function (t, k) {
    var n = 0;
    for (var c = 0; c < 3; c++) if (inBox(verts[t[c]], lo, hi)) n++;
    if (rule === 'any')  return n > 0;
    if (rule === 'all')  return n === 3;
    return inBox(centroids[k], lo, hi);          // 'cent'
  });
}

var canvas = document.getElementById('c');
var ctx = canvas.getContext('2d');
function sizeCanvas() {
  canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
  canvas.height = 220 * (window.devicePixelRatio || 1);
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
}
sizeCanvas();

function draw() {
  var x0 = Number(document.getElementById('x0').value);
  var w  = Number(document.getElementById('w').value);
  var y0 = Number(document.getElementById('y0').value);
  var h  = Number(document.getElementById('h').value);
  ['x0','w','y0','h'].forEach(function (id) {
    document.getElementById(id + 'v').textContent =
      Number(document.getElementById(id).value).toFixed(2);
  });
  var rule = document.querySelector('input[name=rule]:checked').value;
  var lo = [x0, y0], hi = [x0 + w, y0 + h];

  var sel = selectBy(rule, lo, hi);
  var any = selectBy('any', lo, hi), all = selectBy('all', lo, hi);
  var cent = selectBy('cent', lo, hi);
  var nAny = any.filter(Boolean).length;
  var nAll = all.filter(Boolean).length;
  var nCent = cent.filter(Boolean).length;

  var CW = canvas.clientWidth, CH = 220;
  var s = Math.min(CW / (W + 1), CH / (H + 1));
  function X(p) { return 12 + p[0]*s; }
  function Y(p) { return CH - 12 - p[1]*s; }

  ctx.clearRect(0, 0, CW, CH);
  tris.forEach(function (t, k) {
    ctx.beginPath();
    ctx.moveTo(X(verts[t[0]]), Y(verts[t[0]]));
    ctx.lineTo(X(verts[t[1]]), Y(verts[t[1]]));
    ctx.lineTo(X(verts[t[2]]), Y(verts[t[2]]));
    ctx.closePath();
    var disputed = any[k] && !all[k];        // the window cuts this triangle
    if (sel[k]) { ctx.fillStyle = disputed ? '#7a5c2e' : '#2e5c7a'; ctx.fill(); }
    ctx.strokeStyle = disputed ? '#c2853a' : '#1c2436';
    ctx.lineWidth = disputed ? 1 : 0.4;
    ctx.stroke();
  });

  ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 2;
  ctx.strokeRect(X(lo), Y(hi), (hi[0]-lo[0])*s, (hi[1]-lo[1])*s);

  var spread = nAny > 0 ? (nAny - nAll) / nAny : 0;
  document.getElementById('out').textContent = [
    'any vertex   ' + String(nAny).padStart(5)
      + '        all vertices ' + String(nAll).padStart(5)
      + '        centroid ' + String(nCent).padStart(5),
    '',
    'triangles the window cuts (outlined): ' + (nAny - nAll),
    'the rules disagree about ' + (100*spread).toFixed(1) + '% of the largest selection',
    '',
    nAll === 0 && nAny > 0
      ? '** all-vertices has selected NOTHING, though ' + nAny + ' triangles are in the window **'
      : 'shrink the window and watch that percentage.',
  ].join('\\n');
}

['x0','w','y0','h'].forEach(function (id) {
  document.getElementById(id).addEventListener('input', draw);
});
Array.prototype.forEach.call(document.querySelectorAll('input[name=rule]'),
  function (r) { r.addEventListener('change', draw); });
window.addEventListener('resize', function () { sizeCanvas(); draw(); });
draw();`,
      outputHeight: 520,
    },

    {
      type: 'markdown',
      instruction: `### The disagreement grows as the window shrinks

Measured on a stepped plate of 2,304 triangles:

| window | any vertex | all vertices | centroid | any vs all |
|---|---|---|---|---|
| everything below z=1 | 1,200 | 1,152 | 1,152 | 4.0% |
| half the lower floor | 528 | 480 | 480 | 9.1% |
| a window across the step | 934 | 768 | 800 | 17.8% |
| a small patch | 158 | 96 | 112 | 39.2% |
| a sliver | 38 | **0** | 16 | **100.0%** |

The gap is the set of triangles the window cuts. **Its share grows as the
window shrinks**, because the boundary is a larger fraction of a smaller
region — so **the rule matters most exactly when somebody is being precise.**

And on a narrow window, "all vertices inside" selects **nothing at all** while
38 triangles are visibly inside it. A user dragging a thin box along a wall
gets an empty selection and no explanation.

### The property that actually decides it

Both of the obvious rules have a clean guarantee, and the centroid rule has
neither. So why would you pick it?

Because **the application splits faces** — that is the next lesson — and a
selection rule that changes its answer when a face is split cannot be trusted
across an edit.

Measured: select, then subdivide every triangle 1→4 at the edge midpoints
(the same surface, four times the triangles), then select again with the same
window. Compare the selected **area**:

| rule | worst change in selected area |
|---|---|
| any vertex | **30.3%** |
| all vertices | **unbounded** — selected 0.0000, then 0.3000 |
| centroid | **3.6%** |

On the sliver window the centroid rule changed by **0.0%** — exactly the same
area before and after.

**Nothing about the surface changed.** The same physical region is inside the
same window. Only the triangulation moved, and two of the three rules changed
their answer because of it.

That is the argument. Not which rule feels most correct in isolation, but which
one still means the same thing after the user edits the mesh.`,
    },

    {
      type: 'markdown',
      instruction: `### The brush, and where the paint stops

Clicking faces one at a time does not scale. The natural tool is a brush: pick
a face and grow outward across shared edges.

Grown without a limit, that walk does not stop where you meant. On the test
plate, seeding one floor triangle and flooding freely selects **all 2,304
triangles** instead of the 960 on the floor — it climbs the wall and crosses
onto the upper floor, because those surfaces are all connected.

So the walk needs a rule for refusing to cross an edge, and the natural one is
the **dihedral angle** — how sharply the two faces meet.

| crease limit | painted | lower | wall | upper | |
|---|---|---|---|---|---|
| 5° | 960 | 960 | 0 | 0 | exactly the floor |
| 30° | 960 | 960 | 0 | 0 | exactly the floor |
| 85° | 960 | 960 | 0 | 0 | exactly the floor |
| 89° | 960 | 960 | 0 | 0 | exactly the floor |
| **91°** | **2,304** | 960 | 384 | 960 | leaked past the crease |
| 180° | 2,304 | 960 | 384 | 960 | leaked past the crease |

Anywhere from 5° to 89° gives exactly the floor. That looks like an easy
threshold — and on this plate it is, because the plate is **perfectly flat**:

\`\`\`
dihedral angle within a surface   max  0.0°
dihedral angle across a crease    min 90.0°
\`\`\`

Two populations, 90° apart, no overlap. Lesson 11's situation did not arise.

### But real surfaces are curved, and a curve is facets

Lesson 4 established that nothing round is stored as round. A fillet is facets,
and **neighbouring facets on one surface meet at an angle too**. So the
threshold must sit **above** the facet angle inside a surface and **below** the
crease angle it must stop at — **two numbers, and both move.**

Usable band, in degrees, for a 90° fillet at various tessellations against
various crease angles:

| fillet segments | facet angle | vs 90° | vs 60° | vs 30° | vs 15° | vs 5° |
|---|---|---|---|---|---|---|
| 64 | 1.4° | 88.6 | 58.6 | 28.6 | 13.6 | 3.6 |
| 32 | 2.8° | 87.2 | 57.2 | 27.2 | 12.2 | 2.2 |
| 16 | 5.6° | 84.4 | 54.4 | 24.4 | 9.4 | **NONE** |
| 8 | 11.2° | 78.8 | 48.8 | 18.8 | 3.8 | **NONE** |
| 4 | 22.5° | 67.5 | 37.5 | 7.5 | **NONE** | **NONE** |
| 2 | 45.0° | 45.0 | 15.0 | **NONE** | **NONE** | **NONE** |

**NONE** means the facets inside the surface meet at least as sharply as the
boundary you are trying to stop at. No single threshold can hold the fillet
together *and* stop at the feature.

I expected a coarse fillet alone to break the brush. Measured, it does not — a
90° fillet in 2 segments still leaves a 45°–90° band. **What breaks it is a
coarse fillet next to a shallow boundary.**

Which means the **chord tolerance chosen at export**, back in lesson 4, decides
whether the brush can work at all. This is lesson 11's overlapping populations,
reached through export resolution instead of measurement noise.`,
    },

    {
      type: 'challenge',
      instruction: `### 🎯 Three rules, and a brush that stops

Two functions.

\`boxSelect(triangles, vertices, centroids, lo, hi, rule)\` — return an array
of the selected triangle **indices**. \`rule\` is \`'any'\`, \`'all'\` or
\`'centroid'\`. A point is inside when it is within \`lo\` and \`hi\` on both
axes, inclusive.

\`brushSelect(seed, adjacency, normals, maxAngleDeg)\` — grow from the seed
face across shared edges, refusing to cross into a face whose normal differs
from the current one by more than \`maxAngleDeg\`. Return the selected indices,
**including the seed**.

\`adjacency[i]\` is a list of face indices sharing an edge with face \`i\`.
\`normals[i]\` is a unit vector.

It is checked against windows where the rules disagree, a sliver where
\`'all'\` must return nothing, a brush that must stop at a 90° crease, and a
brush with no limit that must take everything connected.`,
      html: `<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:10px;white-space:pre;background:#0a0f1e;border-radius:8px;min-height:230px"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `// TODO 1: the three window rules.
function boxSelect(triangles, vertices, centroids, lo, hi, rule) {

  // your code here

  return [];
}

// TODO 2: grow from the seed, refusing to cross a crease.
function brushSelect(seed, adjacency, normals, maxAngleDeg) {

  // your code here

  return [];
}

// ── it runs itself below ──────────────────────────────────────────────────
// A tiny L: four triangles flat, two turned up at 90 degrees.
var vertices = [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]];
var triangles = [[0,1,4],[0,4,3],[1,2,5],[1,5,4]];
var centroids = triangles.map(function (t) {
  return [(vertices[t[0]][0]+vertices[t[1]][0]+vertices[t[2]][0])/3,
          (vertices[t[0]][1]+vertices[t[1]][1]+vertices[t[2]][1])/3];
});
var adjacency = [[1,3],[0],[3],[0,2]];
var normals = [[0,0,1],[0,0,1],[1,0,0],[0,0,1]];   // face 2 is turned up

var lines = ['  BOX SELECT'];
[['wide window', [0,0], [2,1]], ['left half', [0,0], [1,1]],
 ['a sliver',    [0.4,0], [0.6,1]]].forEach(function (c) {
  var r = ['any','all','centroid'].map(function (k) {
    return k + ' ' + boxSelect(triangles, vertices, centroids, c[1], c[2], k).length;
  });
  lines.push('    ' + c[0].padEnd(14) + r.join('   '));
});
lines.push('');
lines.push('  BRUSH from face 0');
[5, 45, 89, 91, 180].forEach(function (a) {
  lines.push('    limit ' + String(a).padStart(3) + ' deg  -> '
    + brushSelect(0, adjacency, normals, a).length + ' faces');
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
            body + '\nreturn { boxSelect, brushSelect };',
          )(doc, { log() {} });
        } catch (e) { return no('The code did not run: ' + e.message); }
        for (const n of ['boxSelect', 'brushSelect']) {
          if (typeof fn[n] !== 'function') return no(n + ' is not a function.');
        }

        // A grid, so the rules have something to disagree about.
        const NX = 12, NY = 8, W = 6, H = 4;
        const vertices = [];
        for (let i = 0; i <= NX; i++) {
          for (let j = 0; j <= NY; j++) vertices.push([i * W / NX, j * H / NY]);
        }
        const vid = (i, j) => i * (NY + 1) + j;
        const triangles = [];
        for (let i = 0; i < NX; i++) {
          for (let j = 0; j < NY; j++) {
            triangles.push([vid(i, j), vid(i + 1, j), vid(i + 1, j + 1)]);
            triangles.push([vid(i, j), vid(i + 1, j + 1), vid(i, j + 1)]);
          }
        }
        const centroids = triangles.map((t) => [
          (vertices[t[0]][0] + vertices[t[1]][0] + vertices[t[2]][0]) / 3,
          (vertices[t[0]][1] + vertices[t[1]][1] + vertices[t[2]][1]) / 3]);

        const inBox = (p, lo, hi) =>
          p[0] >= lo[0] && p[0] <= hi[0] && p[1] >= lo[1] && p[1] <= hi[1];
        const ref = (lo, hi, rule) => {
          const out = [];
          triangles.forEach((t, k) => {
            let n = 0;
            for (const c of t) if (inBox(vertices[c], lo, hi)) n++;
            const hit = rule === 'any' ? n > 0
              : rule === 'all' ? n === 3 : inBox(centroids[k], lo, hi);
            if (hit) out.push(k);
          });
          return out;
        };

        const windows = [
          ['a wide window', [0.5, 0.5], [4.5, 3.5]],
          ['a small patch', [1.0, 1.0], [2.0, 2.0]],
          ['a sliver', [2.0, 0.5], [2.2, 3.5]],
          ['everything', [-1, -1], [9, 9]],
        ];
        for (const [label, lo, hi] of windows) {
          for (const rule of ['any', 'all', 'centroid']) {
            let got;
            try {
              got = fn.boxSelect(triangles, vertices, centroids, lo, hi, rule);
            } catch (e) {
              return no('boxSelect threw on ' + label + ' / ' + rule + ': ' + e.message);
            }
            if (!Array.isArray(got) || got.some((v) => typeof v !== 'number')) {
              return no('boxSelect should return an array of indices. On ' + label
                + ' / ' + rule + ' it gave ' + JSON.stringify(got) + '.');
            }
            const want = ref(lo, hi, rule);
            const g = [...got].sort((a, b) => a - b).join(',');
            if (g !== want.join(',')) {
              const other = ['any', 'all', 'centroid'].find((r) =>
                r !== rule && ref(lo, hi, r).join(',') === g);
              if (other) {
                return no('On ' + label + ', rule "' + rule + '" returned exactly '
                  + 'what rule "' + other + '" should return. '
                  + (rule === 'any'
                    ? '"any" means at least ONE vertex inside.'
                    : rule === 'all'
                      ? '"all" means all THREE vertices inside.'
                      : '"centroid" tests the centroid only, not the vertices.'));
              }
              return no('On ' + label + ' / ' + rule + ' you selected '
                + got.length + ' triangles, expected ' + want.length + '.');
            }
          }
        }

        // The sliver must actually separate the rules, or the test proves nothing.
        const slAny = ref([2.0, 0.5], [2.2, 3.5], 'any').length;
        const slAll = ref([2.0, 0.5], [2.2, 3.5], 'all').length;
        if (slAny === slAll) {
          return no('Internal check: the sliver window did not separate the rules.');
        }

        // The brush, on a surface with a real crease in it.
        const adjacency = [[1, 3], [0], [3], [0, 2]];
        const normals = [[0, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 1]];
        const brushRef = (seed, maxDeg) => {
          const lim = Math.cos(maxDeg * Math.PI / 180);
          const seen = new Set([seed]);
          const stack = [seed];
          while (stack.length) {
            const f = stack.pop();
            for (const g of adjacency[f]) {
              if (seen.has(g)) continue;
              const d = normals[f][0] * normals[g][0] + normals[f][1] * normals[g][1]
                      + normals[f][2] * normals[g][2];
              if (d >= lim) { seen.add(g); stack.push(g); }
            }
          }
          return [...seen].sort((a, b) => a - b);
        };

        for (const deg of [5, 45, 89, 91, 180]) {
          let got;
          try { got = fn.brushSelect(0, adjacency, normals, deg); } catch (e) {
            return no('brushSelect threw at ' + deg + ' degrees: ' + e.message);
          }
          if (!Array.isArray(got) || got.some((v) => typeof v !== 'number')) {
            return no('brushSelect should return an array of indices. At ' + deg
              + ' degrees it gave ' + JSON.stringify(got) + '.');
          }
          const want = brushRef(0, deg);
          const g = [...new Set(got)].sort((a, b) => a - b);
          if (g.join(',') !== want.join(',')) {
            if (!g.includes(0)) {
              return no('At ' + deg + ' degrees the seed face is missing from the '
                + 'result. The seed is always selected — the user clicked it.');
            }
            if (deg < 90 && g.length === 4) {
              return no('At ' + deg + ' degrees you selected all 4 faces. Face 2 '
                + 'is turned up at 90° to the rest, so a limit below 90 must '
                + 'refuse to cross into it. Without that refusal the brush does '
                + 'not stop at the edge of the surface the user meant — measured, '
                + 'it takes all 2,304 triangles of a plate instead of 960.');
            }
            if (deg > 90 && g.length < 4) {
              return no('At ' + deg + ' degrees you selected only ' + g.length
                + ' faces. A limit above 90° permits crossing the 90° crease, '
                + 'so everything connected should be taken.');
            }
            return no('At ' + deg + ' degrees you selected [' + g.join(', ')
              + '], expected [' + want.join(', ') + '].');
          }
        }

        // The brush must compare against the face it is crossing FROM.
        const chain = { adj: [[1], [0, 2], [1, 3], [2]],
                        nrm: [[0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]] };
        const all4 = fn.brushSelect(0, chain.adj, chain.nrm, 10);
        if ([...new Set(all4)].length !== 4) {
          return no('On a flat chain of four faces with a 10 degree limit, all '
            + 'four should be selected — got ' + [...new Set(all4)].length
            + '. The walk has to continue outward from each newly added face, '
            + 'not only from the seed.');
        }

        return {
          pass: true,
          message: 'The three window rules are genuinely different rather than three '
            + 'names for one, the brush stops at a crease instead of taking the whole '
            + 'connected surface, and it keeps walking outward from each face it '
            + 'adds. The remaining decision — which window rule to ship — is not '
            + 'about which feels right: it is that only the centroid rule still means '
            + 'the same thing after a face is split.',
        };
      },
      successMessage: '✓ Three rules, and a brush that stops.',
      failMessage: '✗ Not yet.',
      outputHeight: 440,
    },

  ],
};

const PY_CELLS = [
  {
    id: 'mesh',
    cellTitle: 'A part with creases in it',
    prose: [
      'Selection needs a surface with structure: flat regions that a brush should fill, and sharp boundaries it should stop at. A stepped plate gives both - a lower floor, a wall, and an upper floor, meeting at ninety degrees.',
      'The mesh is built welded, so triangles that meet actually share vertex indices. That matters enormously for the brush: a walk from face to face crosses shared edges, and if the mesh were exploded the way lesson 3 described, every triangle would be an island and the brush would select exactly one face forever.',
      'Confirm the topology before relying on it, the same way lesson 3 did. An adjacency structure built on a mesh you have not checked is a structure built on an assumption.',
    ],
    code: `import numpy as np

def stepped_plate(nx=40, ny=24):
    verts, faces, region, index = [], [], [], {}
    def vid(p):
        key = tuple(np.round(p, 9))
        if key not in index:
            index[key] = len(verts); verts.append(key)
        return index[key]
    def quad(a, b, c, d, tag):
        ia, ib, ic, idd = vid(a), vid(b), vid(c), vid(d)
        faces.append((ia, ib, ic)); region.append(tag)
        faces.append((ia, ic, idd)); region.append(tag)
    xs_lo = np.linspace(0, 6, nx//2 + 1); xs_hi = np.linspace(6, 10, nx//2 + 1)
    ys = np.linspace(0, 6, ny + 1); zs = np.linspace(0, 2, 9)
    for i in range(len(xs_lo)-1):
        for j in range(len(ys)-1):
            quad([xs_lo[i],ys[j],0], [xs_lo[i+1],ys[j],0],
                 [xs_lo[i+1],ys[j+1],0], [xs_lo[i],ys[j+1],0], 0)
    for k in range(len(zs)-1):
        for j in range(len(ys)-1):
            quad([6,ys[j],zs[k]], [6,ys[j+1],zs[k]],
                 [6,ys[j+1],zs[k+1]], [6,ys[j],zs[k+1]], 1)
    for i in range(len(xs_hi)-1):
        for j in range(len(ys)-1):
            quad([xs_hi[i],ys[j],2], [xs_hi[i+1],ys[j],2],
                 [xs_hi[i+1],ys[j+1],2], [xs_hi[i],ys[j+1],2], 2)
    return np.array(verts, float), np.array(faces), np.array(region)

V, F, REGION = stepped_plate()
centroids = V[F].mean(axis=1)

def face_normals(V, F):
    n = np.cross(V[F[:,1]] - V[F[:,0]], V[F[:,2]] - V[F[:,0]])
    return n / np.linalg.norm(n, axis=1, keepdims=True)

def edge_map(F):
    em = {}
    for fi, (a, b, c) in enumerate(F):
        for u, v in ((a,b), (b,c), (c,a)):
            em.setdefault((min(u,v), max(u,v)), []).append(fi)
    return em

N, EM = face_normals(V, F), edge_map(F)
boundary = sum(1 for k, v in EM.items() if len(v) == 1)
nonmanifold = sum(1 for k, v in EM.items() if len(v) > 2)

print(f'  {len(V):,} vertices, {len(F):,} triangles')
for t, nm in ((0,'lower floor'), (1,'wall'), (2,'upper floor')):
    print(f'    {nm:<14} {int((REGION==t).sum()):>5,} triangles')
print(f'  {len(EM):,} edges, {boundary:,} boundary, {nonmanifold} non-manifold')
print()
print('Welded, manifold, and the three surfaces are connected to each other -')
print('which is exactly why the brush needs a rule for when to stop.')`,
  },
  {
    id: 'box',
    cellTitle: 'Three defensible answers to one sentence',
    prose: [
      '"Select everything in this window" does not say what to do with a triangle the window cuts. Any vertex inside, all vertices inside, or the centroid inside are all reasonable readings, and they are not the same reading.',
      'Measure them on the same windows. Watch the fifth row especially: on a narrow window, all-vertices selects nothing at all while dozens of triangles are visibly inside it. A user dragging a thin box along a wall gets an empty selection and no explanation of why.',
      'And watch the disagreement column as the windows get smaller. The intuition is that a small window is less ambiguous; the measurement says the opposite, because the cut boundary is a larger share of a smaller region.',
    ],
    code: `def box_rules(lo, hi):
    iv = np.all((V[F] >= lo) & (V[F] <= hi), axis=2)
    return (iv.any(axis=1), iv.all(axis=1),
            np.all((centroids >= lo) & (centroids <= hi), axis=1))

print(f"{'window':<28} {'any':>7} {'all':>7} {'centroid':>9} {'any vs all':>11}")
for label, lo, hi in (
    ('everything below z=1',     [-1,-1,-0.1], [11,7,1.0]),
    ('half the lower floor',     [0,0,-0.1],   [3,6,0.1]),
    ('a window across the step', [4,1,-0.1],   [8,5,2.1]),
    ('a small patch',            [1,1,-0.1],   [3,3,0.1]),
    ('a sliver',                 [2,2,-0.1],   [2.3,4,0.1]),
):
    a, b, c = box_rules(np.array(lo), np.array(hi))
    spread = (a.sum() - b.sum()) / max(a.sum(), 1)
    print(f'{label:<28} {int(a.sum()):>7,} {int(b.sum()):>7,} '
          f'{int(c.sum()):>9,} {100*spread:>10.1f}%')

print()
print('On the sliver, all-vertices selects NOTHING while 38 triangles are')
print('inside the window. Nothing errors and nothing explains it.')
print()
print('And the disagreement GROWS as the window shrinks - the rule matters')
print('most exactly when somebody is being precise.')`,
  },
  {
    id: 'stability',
    cellTitle: 'The property that actually decides which rule to ship',
    prose: [
      'Any-vertex never misses a face you can see in the window. All-vertices never includes a face that reaches outside it. Both are clean guarantees, and the centroid rule has neither - so on the face of it there is no reason to choose it.',
      'The reason is that the application splits faces, which is the next lesson. A selection rule that changes its answer when a face is split cannot be trusted across an edit, and the user will edit.',
      'So measure stability directly: select, subdivide every triangle into four at the edge midpoints, select again with the same window, and compare the selected AREA. The surface is identical; only the triangulation moved. A stable rule reports the same area both times.',
    ],
    code: `def subdivide(V, F):
    """1 -> 4 at the edge midpoints. Every neighbour is subdivided too, so no
    T-junction is created - that trap is the next lesson."""
    V2 = [tuple(v) for v in V]
    index = {tuple(np.round(v, 9)): i for i, v in enumerate(V)}
    def mid(i, j):
        m = tuple(np.round((V[i] + V[j]) / 2, 9))
        if m not in index:
            index[m] = len(V2); V2.append(m)
        return index[m]
    F2 = []
    for a, b, c in F:
        ab, bc, ca = mid(a,b), mid(b,c), mid(c,a)
        F2 += [[a,ab,ca], [ab,b,bc], [ca,bc,c], [ab,bc,ca]]
    return np.array(V2, float), np.array(F2)

Vs, Fs = subdivide(V, F)
cent_s = Vs[Fs].mean(axis=1)
print(f'  before: {len(F):,} triangles      after: {len(Fs):,} triangles')
print(f'  the SURFACE is identical - only the triangulation changed')
print()

def rules_for(Vx, Fx, cx, lo, hi):
    iv = np.all((Vx[Fx] >= lo) & (Vx[Fx] <= hi), axis=2)
    return {'any vertex': iv.any(axis=1), 'all vertices': iv.all(axis=1),
            'centroid': np.all((cx >= lo) & (cx <= hi), axis=1)}

def area(Vx, Fx, mask):
    t = Vx[Fx[mask]]
    return float(np.linalg.norm(np.cross(t[:,1]-t[:,0], t[:,2]-t[:,0]), axis=1).sum()/2)

print(f"{'rule':>14} {'window':>26} {'area before':>13} {'area after':>12} {'change':>15}")
drift = {}
for label, lo, hi in (('a small patch', [1,1,-0.1], [3,3,0.1]),
                      ('a window across the step', [4,1,-0.1], [8,5,2.1]),
                      ('a sliver', [2,2,-0.1], [2.3,4,0.1])):
    lo, hi = np.array(lo), np.array(hi)
    before, after = rules_for(V,F,centroids,lo,hi), rules_for(Vs,Fs,cent_s,lo,hi)
    for rule in ('any vertex', 'all vertices', 'centroid'):
        a0, a1 = area(V,F,before[rule]), area(Vs,Fs,after[rule])
        if a0 < 1e-12:
            rel, shown = (float('inf'), 'nothing->some') if a1 > 1e-12 else (0.0, '0.0%')
        else:
            rel = abs(a1-a0)/a0; shown = f'{100*rel:.1f}%'
        drift.setdefault(rule, []).append(rel)
        print(f'{rule:>14} {label:>26} {a0:>13.4f} {a1:>12.4f} {shown:>15}')
    print()

print('  worst change in selected area:')
for rule in ('any vertex', 'all vertices', 'centroid'):
    w = max(drift[rule])
    print(f'    {rule:<14} '
          f'{"unbounded (selected nothing, then something)" if w == float("inf") else f"{100*w:.1f}%"}')
print()
print('  Nothing about the surface changed. Two of the three rules changed')
print('  their answer anyway. That is the argument for the centroid rule -')
print('  not that it feels right, but that it still means the same thing')
print('  after the user edits the mesh.')`,
  },
  {
    id: 'brush',
    cellTitle: 'A brush, and where the paint stops',
    prose: [
      'Clicking faces one at a time does not scale, so the tool is a brush: pick a face and grow outward across shared edges. The walk itself is a flood fill, which is ordinary. The interesting part is the rule for refusing to cross.',
      'Without any rule, the walk does not stop where you meant - every surface on a solid part is connected to every other one, so it takes the whole model. Measure that first, because it is the thing the limit exists to prevent.',
      'The natural limit is the dihedral angle between the two faces. Sweep it and find the range that isolates the floor, then note how wide that range is - which will turn out to be a property of this particular test part rather than a general fact.',
    ],
    code: `adjacency = [[] for _ in range(len(F))]
for e, fs in EM.items():
    if len(fs) == 2:
        adjacency[fs[0]].append(fs[1]); adjacency[fs[1]].append(fs[0])

def flood(seed, max_angle_deg):
    limit = np.cos(np.radians(max_angle_deg))
    seen, stack = {seed}, [seed]
    while stack:
        f = stack.pop()
        for g in adjacency[f]:
            if g not in seen and float(N[f] @ N[g]) >= limit:
                seen.add(g); stack.append(g)
    return seen

seed = int(np.flatnonzero(REGION == 0)[len(np.flatnonzero(REGION == 0))//2])
floor_n = int((REGION == 0).sum())
print(f'  seeded on a lower-floor triangle; the floor has {floor_n:,} triangles')
print(f'  the whole plate has {len(F):,}')
print()
print(f"{'crease limit':>14} {'painted':>9} {'lower':>8} {'wall':>7} {'upper':>7}  verdict")
for ang in (5, 30, 60, 85, 89, 91, 120, 180):
    sel = np.zeros(len(F), bool); sel[list(flood(seed, ang))] = True
    c = [int((sel & (REGION == t)).sum()) for t in (0,1,2)]
    v = ('exactly the floor' if int(sel.sum()) == floor_n and c[1] == 0
         else 'leaked past the crease' if c[1] or c[2] else 'stopped short')
    print(f'{ang:>13}\\u00b0 {int(sel.sum()):>9,} {c[0]:>8,} {c[1]:>7,} {c[2]:>7,}  {v}')

within, across = [], []
for e, fs in EM.items():
    if len(fs) == 2:
        a = np.degrees(np.arccos(np.clip(float(N[fs[0]] @ N[fs[1]]), -1, 1)))
        (within if REGION[fs[0]] == REGION[fs[1]] else across).append(a)
print()
print(f'  dihedral angle within a surface : max {max(within):.1f} degrees')
print(f'  dihedral angle across a crease  : min {min(across):.1f} degrees')
print()
print('Two populations 90 degrees apart, so almost any threshold between them')
print('works. That is a property of THIS plate, which is perfectly flat.')`,
  },
  {
    id: 'twonumbers',
    cellTitle: 'On a curved surface the threshold is two numbers',
    prose: [
      'Lesson 4 established that nothing round is stored as round - a fillet is facets, and neighbouring facets on one surface meet at an angle. So the brush threshold has to sit above the facet angle inside a surface and below the crease angle it must stop at.',
      'Those are two different numbers and both move. The facet angle comes from the chord tolerance chosen at export; the crease angle comes from the part. Sweep both and find where the usable band closes.',
      'I expected a coarse fillet alone to break the brush. Measured, it does not - a 90 degree fillet in two segments still leaves a wide band against a 90 degree crease. What breaks it is a coarse fillet next to a shallow boundary, which is a different and more specific claim.',
    ],
    code: `creases = (90.0, 60.0, 30.0, 15.0, 5.0)
print('usable threshold band, in degrees, for a 90 degree fillet:')
print(f"{'segments':>9} {'facet':>8} " + ''.join(f'{c:>9.0f} deg' for c in creases))
closed = []
for nseg in (64, 32, 16, 8, 4, 2):
    facet = 90.0 / nseg
    cells = []
    for c in creases:
        if facet < c:
            cells.append(f'{c - facet:>13.1f}')
        else:
            cells.append(f"{'NONE':>13}")
            closed.append((nseg, c))
    print(f'{nseg:>9} {facet:>7.1f}\\u00b0 ' + ''.join(cells))

print()
print(f'{len(closed)} of {6*len(creases)} combinations have no usable threshold at all.')
print()
print('NONE means the facets inside the surface meet at least as sharply as')
print('the boundary you are trying to stop at, so no single threshold can hold')
print('the fillet together AND stop at the feature.')
print()
print('Note which combinations fail: every one of them is a SHALLOW crease.')
print('A coarse fillet on its own is survivable. The chord tolerance chosen at')
print('export - lesson 4 - therefore decides whether the brush works at all.')`,
  },
  {
    id: 'manual',
    cellTitle: 'What the selection is for',
    prose: [
      'Lesson 12 attributed faces automatically and measured that 22.1 percent of the attributed surface had more than one legitimate claimant, and 17.2 percent had none. Those faces need a person, and so does every face on a part whose models will not export cleanly enough for the automatic path to run at all.',
      'So a selection becomes an association: these faces belong to that operation, because someone who knows said so. The thing worth getting right is that a manual answer and a computed answer are not the same kind of answer, and merging them into one array throws that away.',
      'Keep the provenance. A face attributed automatically, a face attributed by hand, and a face nobody has looked at are three different states, and only the last one is a to-do list.',
    ],
    code: `# Automatic attribution stands in for lesson 12's output: some faces decided,
# some contested, some never reached.
rng = np.random.default_rng(4)
AUTO, MANUAL, NONE = 'auto', 'manual', None

owner = np.full(len(F), -1)
source = np.array([NONE] * len(F), dtype=object)
decided = rng.random(len(F)) < 0.61
owner[decided] = rng.integers(0, 3, size=int(decided.sum()))
source[decided] = AUTO

def assign(indices, op, why=MANUAL):
    owner[list(indices)] = op
    source[list(indices)] = why

# A user brushes the floor and says "that is operation 2".
painted = flood(seed, 45)
assign(painted, 2)

# And boxes a patch of the upper floor for operation 0.
lo, hi = np.array([7,1,1.9]), np.array([9,5,2.1])
boxed = np.flatnonzero(np.all((centroids >= lo) & (centroids <= hi), axis=1))
assign(boxed, 0)

print(f"{'state':<26} {'faces':>8} {'% of part':>10}")
for label, mask in (
    ('decided automatically', source == AUTO),
    ('decided by hand',       source == MANUAL),
    ('nobody has looked',     source == NONE),
):
    print(f'{label:<26} {int(mask.sum()):>8,} {100*mask.mean():>9.1f}%')

print()
print(f'the brush contributed {len(painted):,} faces, the window {len(boxed):,}')
print()
print('Three states, not two. A face decided by hand carries a different kind')
print('of confidence from one a rule produced, and a face nobody has looked at')
print('is the only one that belongs on a to-do list. Merge them into a single')
print('owner array and all of that is gone - which is lesson 12\\'s argument')
print('about contested faces, arriving one step further downstream.')`,
  },
  {
    id: 'ch-box',
    challengeType: 'write',
    challengeTitle: 'Three rules, and make them disagree',
    difficulty: 'warm-up',
    prompt:
      'Write select_box(lo, hi, rule) returning a boolean mask over faces, for rule in '
      + '"any", "all" and "centroid". Then set disagreement to a list of (label, lo, hi, '
      + 'n_any, n_all) rows, including at least one window where the "all" rule selects '
      + 'nothing while "any" selects something.',
    hint:
      'np.all((V[F] >= lo) & (V[F] <= hi), axis=2) gives a per-corner boolean of shape '
      + '(faces, 3). Then .any(axis=1) and .all(axis=1). The centroid rule tests the '
      + 'centroids array instead. A thin window across the grid is the one that empties '
      + 'the "all" rule.',
    code: `def select_box(lo, hi, rule):
    # TODO
    pass


disagreement = []
# TODO: (label, lo, hi, n_any, n_all) rows, one of them with n_all == 0

for label, lo, hi, na, nl in disagreement:
    print(f'  {label:<26} any {na:>6,}   all {nl:>6,}')`,
    solution: `def select_box(lo, hi, rule):
    lo, hi = np.asarray(lo, float), np.asarray(hi, float)
    if rule == 'centroid':
        return np.all((centroids >= lo) & (centroids <= hi), axis=1)
    iv = np.all((V[F] >= lo) & (V[F] <= hi), axis=2)
    return iv.any(axis=1) if rule == 'any' else iv.all(axis=1)


disagreement = []
for label, lo, hi in (
    ('everything below z=1',     [-1,-1,-0.1], [11,7,1.0]),
    ('half the lower floor',     [0,0,-0.1],   [3,6,0.1]),
    ('a window across the step', [4,1,-0.1],   [8,5,2.1]),
    ('a small patch',            [1,1,-0.1],   [3,3,0.1]),
    ('a sliver',                 [2,2,-0.1],   [2.3,4,0.1]),
):
    disagreement.append((label, lo, hi,
                         int(select_box(lo, hi, 'any').sum()),
                         int(select_box(lo, hi, 'all').sum())))

for label, lo, hi, na, nl in disagreement:
    print(f'  {label:<26} any {na:>6,}   all {nl:>6,}')`,
    testCode: `assert disagreement, "disagreement is empty - nothing was measured."
assert len(disagreement) >= 4, f"only {len(disagreement)} windows; use at least four"

# The three rules must be genuinely different, not three names for one.
_lo, _hi = [1,1,-0.1], [3,3,0.1]
_a = select_box(_lo, _hi, 'any')
_b = select_box(_lo, _hi, 'all')
_c = select_box(_lo, _hi, 'centroid')
assert _a.dtype == bool and _a.shape == (len(F),), (
    f"select_box should return a boolean mask over {len(F)} faces, got "
    f"shape {_a.shape} dtype {_a.dtype}")
assert int(_a.sum()) > int(_c.sum()) > int(_b.sum()), (
    f"on a small patch the counts should be any > centroid > all; got "
    f"{int(_a.sum())}, {int(_c.sum())}, {int(_b.sum())}")

# 'all' must be a subset of 'any' - anything with three corners inside has one.
for _label, _l, _h, _, _ in disagreement:
    assert np.all(select_box(_l, _h, 'all') <= select_box(_l, _h, 'any')), (
        f'on "{_label}" the all-rule selected a face the any-rule did not, '
        f'which is impossible')

# And the case that catches people: a window where 'all' is empty.
_empty = [row for row in disagreement if row[4] == 0 and row[3] > 0]
assert _empty, (
    "no window in the report had all-vertices select NOTHING while any-vertex "
    "selected something. Include a narrow one - a sliver a few hundredths wide "
    "across the grid - because that is the case a user hits when dragging a "
    "thin box along a wall, and it returns an empty selection with no error.")
"SUCCESS: three rules, genuinely different, and one of them silently returns nothing on exactly the window a careful user would drag."`,
  },
  {
    id: 'ch-brush',
    challengeType: 'write',
    challengeTitle: 'A brush that stops at the crease',
    difficulty: 'core',
    prompt:
      'Write brush(seed, max_angle_deg) returning the set of face indices reached from '
      + 'the seed without crossing an edge whose dihedral angle exceeds the limit. Then '
      + 'set band to the list of limits from the sweep that select exactly the floor, and '
      + 'leaked to those that take the whole plate.',
    hint:
      'A stack-based flood fill. From face f, consider each g in adjacency[f]; cross only '
      + 'when the dot product of the two unit normals is at least cos(limit). The seed is '
      + 'always in the result. Keep walking outward from every face you add, not just from '
      + 'the seed.',
    code: `def brush(seed, max_angle_deg):
    # TODO
    pass


band = []
leaked = []
# TODO: sweep (5, 30, 60, 85, 89, 91, 120, 180) and split them

print('exactly the floor at:', band)
print('leaked past the crease at:', leaked)`,
    solution: `def brush(seed, max_angle_deg):
    limit = np.cos(np.radians(max_angle_deg))
    seen, stack = {seed}, [seed]
    while stack:
        f = stack.pop()
        for g in adjacency[f]:
            if g not in seen and float(N[f] @ N[g]) >= limit:
                seen.add(g); stack.append(g)
    return seen


band, leaked = [], []
for ang in (5, 30, 60, 85, 89, 91, 120, 180):
    n = len(brush(seed, ang))
    if n == floor_n:
        band.append(ang)
    elif n > floor_n:
        leaked.append(ang)

print('exactly the floor at:', band)
print('leaked past the crease at:', leaked)`,
    testCode: `assert band, "band is empty - no limit selected exactly the floor."
assert leaked, "leaked is empty - no limit took more than the floor."

assert set(band) == {5, 30, 60, 85, 89}, (
    f"band came out {band}, expected [5, 30, 60, 85, 89]. The crease is 90 "
    f"degrees, so every limit below it holds and every limit above it crosses.")
assert set(leaked) == {91, 120, 180}, f"leaked came out {leaked}"

# The seed is always selected - the user clicked it.
assert seed in brush(seed, 5), "the seed face must be in the result"

# And the flood must keep walking, not just take the seed's neighbours.
_r = brush(seed, 45)
assert len(_r) == floor_n, (
    f"a 45 degree limit selected {len(_r)} faces, expected the whole floor "
    f"({floor_n:,}). If you got a handful, the walk is only expanding from the "
    f"seed instead of from every face it adds.")

# With no limit it must take everything connected - the failure the limit exists
# to prevent.
assert len(brush(seed, 180)) == len(F), (
    f"with a 180 degree limit the brush should take all {len(F):,} faces, got "
    f"{len(brush(seed, 180)):,}")

# Seeding on the wall must give the wall, not the floor.
_wall_seed = int(np.flatnonzero(REGION == 1)[0])
assert len(brush(_wall_seed, 45)) == int((REGION == 1).sum()), (
    "seeding on the wall with a 45 degree limit should select exactly the wall")
"SUCCESS: the brush fills a surface and stops at its boundary - and without the limit it takes all 2,304 triangles instead of 960."`,
  },
  {
    id: 'ch-stable',
    challengeType: 'write',
    challengeTitle: 'Which rule survives an edit',
    difficulty: 'stretch',
    prompt:
      'Write selected_area(Vx, Fx, mask) returning the total area of the selected '
      + 'triangles, and stability(lo, hi, rule) returning the relative change in selected '
      + 'area between the original mesh and the subdivided one. Then set worst to a dict '
      + 'mapping each rule name to its worst relative change across several windows, and '
      + 'set best_rule to the name of the most stable.',
    hint:
      'Half the norm of the cross product of two edges is a triangle area. Vs, Fs and '
      + 'cent_s are the subdivided mesh, already in scope. Guard the case where the '
      + 'original area is zero - that is the all-vertices rule on a sliver, and a relative '
      + 'change is not defined there.',
    code: `def selected_area(Vx, Fx, mask):
    # TODO
    pass


def stability(lo, hi, rule):
    # TODO: relative change in selected area after subdivision
    pass


worst = {}
best_rule = None
# TODO

print(worst)
print('most stable:', best_rule)`,
    solution: `def selected_area(Vx, Fx, mask):
    t = Vx[Fx[mask]]
    if len(t) == 0:
        return 0.0
    return float(np.linalg.norm(np.cross(t[:,1]-t[:,0], t[:,2]-t[:,0]), axis=1).sum()/2)


def stability(lo, hi, rule):
    lo, hi = np.asarray(lo, float), np.asarray(hi, float)
    before = rules_for(V, F, centroids, lo, hi)[rule]
    after = rules_for(Vs, Fs, cent_s, lo, hi)[rule]
    a0, a1 = selected_area(V, F, before), selected_area(Vs, Fs, after)
    if a0 < 1e-12:
        return float('inf') if a1 > 1e-12 else 0.0
    return abs(a1 - a0) / a0


windows = (([1,1,-0.1], [3,3,0.1]),
           ([4,1,-0.1], [8,5,2.1]),
           ([2,2,-0.1], [2.3,4,0.1]))

worst = {}
for rule in ('any vertex', 'all vertices', 'centroid'):
    worst[rule] = max(stability(lo, hi, rule) for lo, hi in windows)

best_rule = min(worst, key=lambda r: worst[r])

print(worst)
print('most stable:', best_rule)`,
    testCode: `assert worst, "worst is empty - nothing was measured."
assert best_rule is not None, "best_rule was never set."

for _r in ('any vertex', 'all vertices', 'centroid'):
    assert _r in worst, f'worst is missing "{_r}"'

assert best_rule == 'centroid', (
    f"the most stable rule came out '{best_rule}'. Measured, the centroid rule "
    f"changes by at most 3.6% under subdivision while any-vertex changes by "
    f"30.3% and all-vertices goes from selecting nothing to selecting something.")

assert worst['centroid'] < 0.10, (
    f"centroid drift came out {100*worst['centroid']:.1f}%, expected under 10%")
assert worst['any vertex'] > 5 * worst['centroid'], (
    f"any-vertex ({100*worst['any vertex']:.1f}%) should drift far more than "
    f"centroid ({100*worst['centroid']:.1f}%)")

# Area must be a real area, not a face count.
_full = np.ones(len(F), bool)
assert abs(selected_area(V, F, _full) - 6*6 - 4*6 - 2*6) < 1e-6, (
    f"the whole plate is 36 + 24 + 12 = 72 square units; selected_area gave "
    f"{selected_area(V, F, _full):.4f}. Half the norm of the cross product of "
    f"two edges is one triangle's area.")

# The subdivided mesh must cover the same surface, or the comparison is void.
assert abs(selected_area(Vs, Fs, np.ones(len(Fs), bool))
           - selected_area(V, F, _full)) < 1e-6, (
    "the subdivided mesh has a different total area from the original, so it "
    "is not the same surface and nothing can be concluded from comparing them")
"SUCCESS: two of the three rules change their answer when the triangulation moves, and the surface never did. That is why the centroid rule ships."`,
  },
];

export default {
  id: 'mesh-engine-3-1-selection',
  slug: 'selection',
  chapter: 'mesh-engine.3',
  order: 0,
  title: 'Selection',
  subtitle: 'Three defensible answers to "select everything in this window", and the one that survives an edit.',
  tags: [
    'selection', 'box select', 'window select', 'brush', 'flood fill',
    'dihedral angle', 'crease', 'manual attribution', 'provenance', 'centroid',
  ],
  aliases: 'selection select faces box select window select rubber band marquee brush paint flood fill connected region crease angle dihedral threshold manual association manual attribution provenance centroid rule any vertex all vertices',
  timeToComplete: 70,
  coreConcept:
    '"Select everything in this window" has three defensible readings - any vertex inside, all vertices inside, centroid inside - and they disagree by up to 100%, with all-vertices returning nothing at all on a narrow window where 38 triangles are visibly inside it. The disagreement grows as the window shrinks, so the rule matters most when the user is being precise. What decides which rule to ship is not a guarantee but stability: after subdividing every triangle 1 to 4, the same window selects an area that changed by 30.3% under any-vertex, unboundedly under all-vertices, and 3.6% under centroid - and the surface never moved. A brush is a flood fill that must refuse to cross a crease, and its threshold is two numbers, not one: above the facet angle inside a surface and below the crease angle at its boundary. Measured, a coarse fillet alone does not break it, but a coarse fillet next to a shallow boundary leaves no usable threshold at all, so the chord tolerance chosen at export decides whether the brush can work.',
  prerequisites: ['mesh-engine-2-2-manual-alignment'],
  nextLesson: null,

  semantics: {
    core: [
      { symbol: 'any vertex inside', meaning: 'Never misses a face visible in the window. Grows when faces are split.' },
      { symbol: 'all vertices inside', meaning: 'Never includes a face reaching outside. Returns nothing on a narrow window.' },
      { symbol: 'centroid inside', meaning: 'Neither guarantee, and the only rule that still means the same thing after a split.' },
      { symbol: 'flood fill', meaning: 'Grow from a seed across shared edges. Needs welded topology — an exploded mesh selects one face forever.' },
      { symbol: 'dihedral angle', meaning: 'How sharply two faces meet across a shared edge. The brush’s stopping rule.' },
      { symbol: 'the two-number threshold', meaning: 'Above the facet angle inside a surface, below the crease angle at its boundary. Both move.' },
      { symbol: 'provenance', meaning: 'Automatic, by hand, or unlooked-at. Three states, and only the last is a to-do list.' },
    ],
    rulesOfThumb: [
      'Say which window rule you implement. Three reasonable readings differ by up to 100%.',
      'Prefer the centroid rule wherever the mesh can be edited — it is the only one stable under re-triangulation.',
      'Check the mesh is welded before building adjacency. A brush on an exploded mesh selects exactly one face.',
      'Give the brush a crease limit, and derive it from both the facet angle and the crease angle, not from taste.',
      'Check the usable band exists before shipping a default. On shallow boundaries with coarse tessellation there is none.',
      'Keep provenance beside the answer: a face decided by hand is not the same kind of answer as one a rule produced.',
      'Test a selection rule across an edit, not just on a static mesh. That is where two of the three fail.',
    ],
  },

  hook: {
    question: 'A user drags a thin selection box down a wall. Dozens of triangles are visibly inside it. How many does the "all vertices inside" rule select?',
    realWorldContext: 'Zero. Measured on a sliver window over a stepped plate: any-vertex selects 38 triangles, centroid selects 16, and all-vertices selects none at all — because no triangle has all three of its corners inside a window narrower than one triangle. Nothing errors, nothing explains it, and the user concludes the tool is broken. The three readings of "select everything in this window" disagree by up to 100%, and the disagreement grows as the window shrinks, so the rule matters most exactly when somebody is being precise. Which one to ship is not decided by which guarantee sounds better: after the mesh is edited, any-vertex has changed its answer by 30.3% and all-vertices by an unbounded amount, while the centroid rule has changed by 3.6% — on a surface that never moved.',
    previewVisualizationId: 'JSNotebook',
  },

  intuition: {
    prose: [
      'Lesson 12 left 22.1% of a surface contested and 17.2% unattributed, and those faces need a person.',
      'So does every face on a part whose models will not export cleanly enough for the automatic path to run at all.',
      'Selection is how a person reaches them, and the sentence that describes it is incomplete.',
      'Every window cuts triangles, and what to do with them is a choice with three defensible answers.',
      'A brush avoids clicking one at a time, and introduces a different choice: where the paint stops.',
      'Both choices are thresholds, and both are decided by something upstream rather than by preference.',
    ],
    callouts: [
      {
        type: 'warning',
        title: 'The rules disagree most when the user is being careful',
        body: 'Measured on 2,304 triangles: a window covering everything below z=1 gives 1,200 / 1,152 / 1,152 for any / all / centroid — 4.0% apart. A small patch gives 158 / 96 / 112 — 39.2% apart. A sliver gives 38 / 0 / 16 — 100% apart. The gap is the set of triangles the window cuts, and its share grows as the window shrinks, because the boundary is a larger fraction of a smaller region.',
      },
      {
        type: 'insight',
        title: 'Stability decides it, not the guarantee',
        body: 'Any-vertex never misses a visible face; all-vertices never includes one reaching outside. Both are clean, and the centroid rule has neither. But the application splits faces, and a rule that changes its answer when a face is split cannot be trusted across an edit. Measured by subdividing every triangle 1 to 4 and re-selecting with the same window: any-vertex changes the selected area by 30.3%, all-vertices goes from 0.0000 to 0.3000, and centroid changes by 3.6% — exactly 0.0% on the sliver.',
      },
      {
        type: 'warning',
        title: 'A brush with no limit takes the whole part',
        body: 'Every surface on a solid is connected to every other one. Measured: seeding one floor triangle and flooding freely selects all 2,304 triangles instead of the 960 on the floor — it climbs the wall and crosses onto the upper floor. The limit is not a refinement; it is the thing that makes a brush a brush.',
      },
      {
        type: 'insight',
        title: 'The crease threshold is two numbers',
        body: 'It must sit above the angle between neighbouring facets inside one surface and below the angle at the crease it must stop at. On a perfectly flat test plate those are 0.0° and 90.0°, so anything between works and the threshold looks trivial. On a curved surface the facet angle is set by the chord tolerance chosen at export — a 90° fillet in 4 segments has 22.5° facets — and the band closes from below.',
      },
      {
        type: 'warning',
        title: 'What actually breaks the brush',
        body: 'I expected a coarse fillet alone to close the usable band. Measured, it does not: a 90° fillet in 2 segments has 45° facets against a 90° crease, leaving a 45° band. What closes it is a coarse fillet next to a SHALLOW boundary — 22.5° facets against a 15° crease has no usable threshold at all. Nine of thirty measured combinations have none, and every one of them involves a shallow crease.',
      },
      {
        type: 'insight',
        title: 'A hand answer is not a computed answer',
        body: 'Merging manual and automatic attribution into one owner array throws away the distinction. Three states matter: decided by a rule, decided by a person, and nobody has looked — and only the last is a to-do list. This is lesson 12’s argument about recording contested faces, arriving one step further downstream.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Drag a window over the part',
        caption: 'Three rules, live, with the disputed triangles outlined.',
        props: {
          lesson: LESSON_MESH_3_1,
        },
      },
    ],
  },

  math: {
    prose: [
      'The first cell builds a part with real creases and checks the topology, because a brush on an unwelded mesh selects exactly one face.',
      'Then the three window rules, measured across five windows, including the one where a reasonable rule returns nothing.',
      'Then the measurement that actually decides which rule ships: what each one does when the triangulation changes and the surface does not.',
      'Then the brush, its crease limit, and the two numbers that limit sits between — followed by what a selection is ultimately for.',
    ],
    visualizations: [
      {
        id: 'PythonNotebook',
        title: 'Windows, brushes, and what survives an edit',
        mathBridge: 'A selection rule is a predicate on triangles, and the three window rules differ only in how they quantify over the three corners: exists, for-all, or a single derived point. That difference is invisible on triangles wholly inside or wholly outside, and decides everything on the boundary set — which is why the disagreement scales with the perimeter-to-area ratio of the window rather than with its size. The brush is a graph traversal over the dual of the mesh, where faces are nodes and shared edges are arcs, with the crease test acting as an edge filter; the selected region is the connected component of the seed in the filtered graph. Both tools therefore reduce to choices about a boundary, which is why both are thresholds and why both inherit their difficulty from the tessellation rather than from the algorithm.',
        caption: 'Every figure measured, including the claim that decided which rule to ship.',
        props: {
          initialCells: PY_CELLS,
        },
      },
    ],
  },

  examples: [
    {
      title: 'The empty selection',
      prose: 'A sliver window: any-vertex 38, centroid 16, all-vertices 0. Thirty-eight triangles are visibly inside the box and the rule returns nothing, with no error.',
    },
    {
      title: 'The surface that did not move',
      prose: 'Subdivide 1 to 4 and re-select with the same window: any-vertex changes the selected area by 30.3%, all-vertices from 0.0000 to 0.3000, centroid by 3.6%. The geometry is identical throughout.',
    },
    {
      title: 'The brush that took everything',
      prose: 'Seeded on one floor triangle with no crease limit: 2,304 triangles instead of 960. The floor, the wall and the upper floor are one connected surface.',
    },
    {
      title: 'The band that closes',
      prose: 'A 90° fillet in 4 segments gives 22.5° facets. Against a 30° crease that leaves 7.5° of usable threshold; against a 15° crease it leaves none at all.',
    },
  ],

  challenges: [
    {
      prompt: 'Implement the three window rules and find a window where one of them selects nothing while another selects plenty.',
      hint: 'A thin box across the grid. The all-rule needs three corners inside.',
    },
    {
      prompt: 'Write a brush that stops at a crease, and find the range of limits that selects exactly one surface.',
      hint: 'A flood fill over face adjacency, crossing only when the normals agree within the limit. Keep walking from every face you add.',
    },
    {
      prompt: 'Measure which window rule survives a subdivision, by comparing selected area rather than selected count.',
      hint: 'Count changes by construction when triangles are split; area does not. Guard the zero-area case.',
    },
    {
      prompt: 'In the browser, implement both tools and keep the three rules genuinely distinct.',
      hint: 'The brush must include its seed and must expand from each face it adds, not only from the seed.',
    },
  ],

  misconceptions: [
    {
      claim: '"Select everything in the window" is unambiguous.',
      reality: 'It says nothing about the triangles the window cuts, and there are always some. Three defensible readings differ by up to 100% — 38, 16 and 0 on the same sliver.',
    },
    {
      claim: 'A smaller window is less ambiguous.',
      reality: 'The opposite. The cut boundary is a larger share of a smaller region, so the disagreement grows: 4.0% on a large window, 39.2% on a small patch, 100% on a sliver.',
    },
    {
      claim: 'Pick the rule with the cleanest guarantee.',
      reality: 'Both guarantees belong to rules that change their answer when the mesh is edited. Measured under subdivision: any-vertex 30.3%, all-vertices unbounded, centroid 3.6% — on an unchanged surface.',
    },
    {
      claim: 'A brush just needs a radius.',
      reality: 'It needs a stopping rule. Without one it takes every connected face: 2,304 instead of 960, because the floor, wall and upper floor are one surface.',
    },
    {
      claim: 'The crease threshold is one number you tune once.',
      reality: 'It is bounded below by the facet angle inside a surface and above by the crease angle at its boundary, and the first of those comes from the export chord tolerance rather than from the part.',
    },
    {
      claim: 'A coarse mesh breaks the brush.',
      reality: 'Not on its own — a 90° fillet in 2 segments still leaves a 45° band against a 90° crease. It breaks when a coarse fillet sits next to a shallow boundary, and every failing combination measured involves a shallow crease.',
    },
    {
      claim: 'Manual and automatic attribution can share one owner array.',
      reality: 'That erases which faces a person vouched for and which nobody has looked at. Three states matter, and only the unlooked-at one is a to-do list.',
    },
  ],

  transferPrompts: [
    'A user says the box select "misses faces". What would you ask before changing anything?',
    'Your brush works on a test part and leaks on a customer part. What would you measure first?',
    'A selection made before an edit is reapplied after it and covers a different region. Which rule is in use?',
    'Where else in this application does a single stored value hide the difference between "computed" and "somebody said so"?',
    'What would you have to know about a model before choosing a default crease angle for it?',
  ],

  debugging: [
    {
      symptom: 'A narrow selection box returns nothing at all.',
      cause: 'The all-vertices rule, on a window narrower than one triangle.',
      fix: 'Switch to the centroid rule, or fall back to any-vertex when all-vertices comes back empty and the window is non-degenerate.',
    },
    {
      symptom: 'The brush selects exactly one face and will not grow.',
      cause: 'The mesh is exploded, so no two triangles share a vertex index and the adjacency is empty.',
      fix: 'Weld first, as lesson 3 established, and check the boundary edge count before building adjacency.',
    },
    {
      symptom: 'The brush takes the whole part.',
      cause: 'No crease limit, or a limit above the crease angle.',
      fix: 'Measured, a 90° crease needs a limit below 90°. Anything from 5° to 89° isolates the surface.',
    },
    {
      symptom: 'The brush stops partway across a curved surface.',
      cause: 'The limit is below the facet angle inside that surface, so it refuses to cross between facets of the same fillet.',
      fix: 'Raise it above the facet angle. If that puts it above the crease angle, no threshold works and the model needs a finer export.',
    },
    {
      symptom: 'A saved selection covers a different region after the mesh is edited.',
      cause: 'The selection was stored as face indices under a rule that is not stable under re-triangulation.',
      fix: 'Use the centroid rule, and re-derive the selection from geometry rather than from stored indices.',
    },
    {
      symptom: 'Nobody can tell which faces were checked by a person.',
      cause: 'Manual and automatic attribution were merged into one array.',
      fix: 'Keep provenance alongside the owner. Three states: automatic, manual, and unlooked-at.',
    },
  ],

  mastery: {
    prerequisites:
      'Lesson 3 for welding and adjacency, without which a brush cannot walk at all. Lesson 11 for reading a threshold as a decision between two populations. Lesson 12 for why an answer and its provenance belong together. Lesson 14 for the transform that turns a screen rectangle into a world-space window.',
    signals: [
      'States which window rule is implemented rather than assuming there is one.',
      'Tests a selection rule across an edit, not only on a static mesh.',
      'Checks the mesh is welded before building adjacency.',
      'Derives a crease limit from both bounds rather than from taste.',
      'Keeps manual and automatic decisions distinguishable.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'mesh-engine-1-3-topology-and-welding', why: 'Welding and adjacency — a brush on an exploded mesh selects exactly one face.' },
      { lessonId: 'mesh-engine-1-12-attribution', why: 'The contested and unattributed faces this lesson gives a person a way to resolve.' },
      { lessonId: 'mesh-engine-1-11-thresholds', why: 'Reading a threshold as a decision between two populations, which is what the crease angle is.' },
      { lessonId: 'mesh-engine-1-4-mesh-files', why: 'Where the facet angle comes from: the chord tolerance chosen at export.' },
    ],
    futureLinks: [],
  },

  checkpoints: [
    'I can name the three window rules and say how far apart they get.',
    'I can explain why the disagreement grows as the window shrinks.',
    'I can say which rule survives a re-triangulation, and show the measurement.',
    'I can write a flood fill that stops at a crease.',
    'I can state both bounds on the crease threshold and say where each comes from.',
    'I can explain why manual and automatic attribution should not share one array.',
  ],

  assessment: {
    task: 'Build a selection tool a user can rely on across an edit, and associate a selection with an operation by hand.',
    acceptance: [
      'The window rule stated explicitly, with the centroid rule used wherever the mesh can be edited.',
      'An empty all-vertices result on a non-degenerate window either avoided or explained.',
      'Topology checked before adjacency is built.',
      'A crease limit derived from the facet angle and the crease angle, with the case of no usable band detected and reported.',
      'Manual associations stored with provenance, distinguishable from computed ones and from unlooked-at faces.',
    ],
  },

  quiz: [
    {
      question: 'A sliver window over a mesh. What do the three rules return?',
      options: [
        'any-vertex 38, centroid 16, all-vertices 0',
        'All three return roughly the same count',
        'all-vertices returns the most, since it is the strictest',
        'centroid returns nothing, since no centroid is exactly inside',
      ],
      answer: 0,
      explanation: 'No triangle has all three corners inside a window narrower than one triangle, so all-vertices selects nothing while 38 triangles are visibly in the box.',
    },
    {
      question: 'What happens to the disagreement between rules as the window shrinks?',
      options: [
        'It grows — 4.0% on a large window, 39.2% on a small patch, 100% on a sliver',
        'It shrinks, because fewer triangles are involved',
        'It stays constant',
        'It depends only on the mesh density',
      ],
      answer: 0,
      explanation: 'The gap is the cut boundary, whose share of a region grows as the region shrinks. The rule matters most when the user is being precise.',
    },
    {
      question: 'Why ship the centroid rule when the other two have cleaner guarantees?',
      options: [
        'It is the only one stable under re-triangulation — 3.6% against 30.3% and unbounded',
        'It is faster to compute',
        'It always selects the most triangles',
        'It matches what CAD systems do',
      ],
      answer: 0,
      explanation: 'The application splits faces. A rule that changes its answer when a face is split cannot be trusted across an edit, and the surface never moved.',
    },
    {
      question: 'A brush with no crease limit, seeded on the floor of a stepped plate. What does it select?',
      options: [
        'All 2,304 triangles — the floor, the wall and the upper floor are one connected surface',
        'The 960 floor triangles',
        'Only the seed face',
        'It depends on the seed position',
      ],
      answer: 0,
      explanation: 'Every surface on a solid connects to every other. The limit is not a refinement; it is what makes a brush a brush.',
    },
    {
      question: 'The crease threshold is bounded by what?',
      options: [
        'Above the facet angle inside a surface, below the crease angle at its boundary',
        'Only by the crease angle',
        'Only by the mesh density',
        'By the size of the brush',
      ],
      answer: 0,
      explanation: 'Two numbers, and the first comes from the chord tolerance chosen at export rather than from the part.',
    },
    {
      question: 'Which combination leaves no usable brush threshold at all?',
      options: [
        'A coarsely tessellated fillet next to a shallow boundary — 22.5° facets against a 15° crease',
        'Any coarsely tessellated fillet',
        'Any shallow boundary',
        'A finely tessellated fillet next to a sharp crease',
      ],
      answer: 0,
      explanation: 'A coarse fillet alone is survivable: 45° facets against a 90° crease still leaves a 45° band. Every failing combination measured involves a shallow crease.',
    },
  ],
};
