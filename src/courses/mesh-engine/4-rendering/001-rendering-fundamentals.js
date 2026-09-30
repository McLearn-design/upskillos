// Mesh Engine 4.1 — Rendering Fundamentals
//
// LearningPath section 17. "Only now build the serious viewer... Understand what
// the renderer actually receives."
//
// Two kinds of content here, kept clearly apart:
//   - things measured in field-fixes/verify/check-rendering.py, quoted with
//     their numbers
//   - things the map records from the existing application, which cost days and
//     are written down rather than re-derived. Those are attributed as such.

const LESSON_MESH_4_1 = {
  title: 'What the Renderer Actually Receives',
  subtitle: 'Depth is 1/d, and almost everything else follows from that.',
  sequential: true,

  cells: [

    {
      type: 'markdown',
      instruction: `### Two surfaces a thou apart, and the buffer cannot tell

Most of what goes wrong in a viewer is not a shader problem. It is arithmetic
nobody looked at.

The central fact is this: **a perspective projection does not store depth
linearly.** After the divide, the value written to the depth buffer is

\`\`\`
z(d) = ((f + n) − 2·f·n/d) / (f − n)
\`\`\`

which is \`1/d\` wearing a costume. Quantise that into 24 bits and the smallest
separation two surfaces can have while still being distinguishable is

\`\`\`
Δ(d) = (f − n) · d² / (2²⁴ · f · n)
\`\`\`

Two things are in that expression, and both matter: **\`d\` squared** in the
numerator, and **\`n\`** in the denominator.

Verified against the projection it claims to describe — not just derived —
agreeing to **0.0536%** over 0.5 to 900 units. With near 0.1 and far 1000:

| distance | resolvable separation |
|---|---|
| 0.5 | 1.49e-07 |
| 1.0 | 5.96e-07 |
| 10 | 5.96e-05 |
| 100 | 5.96e-03 |
| 500 | **1.49e-01** |
| 900 | **4.83e-01** |

At 500 units, two surfaces closer than **0.149** collapse into one depth value.
On a part measured in inches that is **a seventh of an inch of geometry**
disappearing.

Everything in this lesson is downstream of that one curve.`,
    },

    {
      type: 'js',
      instruction: `### Move the near plane, not the far one

The chart shows where the depth buffer's precision goes. The horizontal axis is
distance from the camera; the shaded bars show what fraction of the 24-bit range
each slice of the view volume receives.

**Predict before you drag:** your part is flickering at 500 units. You have two
sliders — **near** and **far**. Which one do you reach for, and how much do you
expect it to buy?

Then try them. The readout gives the resolvable separation at your chosen
distance, and whether two surfaces that far apart would z-fight.`,
      html: `<div style="padding:8px 2px;font:11px ui-monospace,monospace;color:#7d8794;display:grid;grid-template-columns:auto 1fr auto;gap:5px 10px;align-items:center">
  <span>near plane</span><input id="near" type="range" min="-2" max="1.3" step="0.01" value="-1"><span id="nearv">0.10</span>
  <span>far plane</span><input id="far" type="range" min="1.7" max="4" step="0.01" value="3"><span id="farv">1000</span>
  <span>look at</span><input id="dist" type="range" min="0" max="3" step="0.01" value="2.7"><span id="distv">500</span>
  <span>surfaces apart</span><input id="sep" type="range" min="-4" max="0" step="0.01" value="-2.3"><span id="sepv">0.005</span>
</div>
<canvas id="c" style="width:100%;height:200px;background:#0a0f1e;border-radius:8px"></canvas>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:8px 2px;white-space:pre"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `var BITS = 24;

// What the depth buffer stores. Not d - a function of 1/d.
function zNdc(d, n, f) {
  return ((f + n) - 2*f*n/d) / (f - n);
}

// The smallest separation at distance d that still changes the stored value.
// One least-significant bit spans 2 / 2^BITS of the -1..1 NDC range.
function resolvable(d, n, f) {
  return (f - n) * d * d / (Math.pow(2, BITS) * f * n);
}

var canvas = document.getElementById('c');
var ctx = canvas.getContext('2d');
function sizeCanvas() {
  canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
  canvas.height = 200 * (window.devicePixelRatio || 1);
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
}
sizeCanvas();

function draw() {
  // The sliders are logarithmic, because every quantity here spans decades.
  var n = Math.pow(10, Number(document.getElementById('near').value));
  var f = Math.pow(10, Number(document.getElementById('far').value));
  var d = Math.pow(10, Number(document.getElementById('dist').value));
  var sep = Math.pow(10, Number(document.getElementById('sep').value));
  if (d < n) d = n;
  if (d > f) d = f;

  document.getElementById('nearv').textContent = n.toFixed(n < 1 ? 3 : 1);
  document.getElementById('farv').textContent = f.toFixed(0);
  document.getElementById('distv').textContent = d.toFixed(d < 10 ? 2 : 0);
  document.getElementById('sepv').textContent = sep.toPrecision(2);

  var W = canvas.clientWidth, H = 200, PAD = 26;
  ctx.clearRect(0, 0, W, H);

  // Ten equal slices of DISTANCE, showing how much DEPTH RANGE each receives.
  var SLICES = 10;
  var bars = [];
  for (var i = 0; i < SLICES; i++) {
    var d0 = n + (f - n) * i / SLICES;
    var d1 = n + (f - n) * (i + 1) / SLICES;
    bars.push(Math.abs(zNdc(d1, n, f) - zNdc(d0, n, f)) / 2);
  }

  var bw = (W - PAD - 8) / SLICES;
  for (var i2 = 0; i2 < SLICES; i2++) {
    var h = bars[i2] * (H - PAD - 14);
    var x = PAD + i2*bw;
    ctx.fillStyle = i2 === 0 ? '#c2703a' : '#2e5c7a';
    ctx.fillRect(x + 1, H - PAD + 2 - h, bw - 2, h);
    ctx.fillStyle = '#7d8794'; ctx.font = '9px ui-monospace, monospace';
    if (bars[i2] > 0.02) {
      ctx.fillText((100*bars[i2]).toFixed(0) + '%', x + 2, H - PAD - h - 3);
    }
  }
  ctx.strokeStyle = '#3a4152';
  ctx.beginPath(); ctx.moveTo(PAD, H - PAD + 2); ctx.lineTo(W - 6, H - PAD + 2); ctx.stroke();
  ctx.fillStyle = '#7d8794'; ctx.font = '10px ui-monospace, monospace';
  ctx.fillText('near', PAD, H - PAD + 14);
  ctx.fillText('far', W - 24, H - PAD + 14);
  ctx.fillText('share of the 24-bit depth range, per tenth of the view volume', PAD, 12);

  var r = resolvable(d, n, f);
  var fights = sep < r;
  document.getElementById('out').textContent = [
    'at ' + d.toPrecision(3) + ' units the buffer resolves ' + r.toExponential(2),
    'your two surfaces are ' + sep.toPrecision(2) + ' apart',
    '',
    fights ? '** they Z-FIGHT - the buffer cannot tell them apart **'
           : 'they are distinguishable.',
    '',
    'the first tenth of the view volume takes '
      + (100*bars[0]).toFixed(1) + '% of the depth range',
    '',
    'baseline (near 0.1, far 1000) resolves ' + resolvable(d, 0.1, 1000).toExponential(2)
      + ' here;',
    'you are ' + (resolvable(d, 0.1, 1000) / r).toFixed(1) + 'x better than that.',
  ].join('\\n');
}

['near','far','dist','sep'].forEach(function (id) {
  document.getElementById(id).addEventListener('input', draw);
});
window.addEventListener('resize', function () { sizeCanvas(); draw(); });
draw();`,
      outputHeight: 500,
    },

    {
      type: 'markdown',
      instruction: `### The far plane does nothing

Measured at 50 units, with every row inside its own view volume:

| near | far | resolvable at 50 | vs baseline |
|---|---|---|---|
| 0.1 | 1000 | 1.49e-03 | 1.0× |
| 0.1 | 500 | 1.49e-03 | **1.0×** |
| 0.1 | 100 | 1.49e-03 | **1.0×** |
| 1.0 | 1000 | 1.49e-04 | 10.0× |
| **10** | 1000 | **1.48e-05** | **101.0×** |
| 10 | 100 | 1.34e-05 | 111.1× |

\`\`\`
pulling FAR in from 1000 to 100 :   1.00x better
pushing NEAR out from 0.1 to 10 : 101.0x better
\`\`\`

**Pulling the far plane in by a factor of ten buys nothing at all** — 1.00×, to
two decimal places.

The reason is in the algebra. \`Δ\` is proportional to \`(f − n) / (f·n)\`, and for
\`f ≫ n\` that is very nearly **\`1/n\`**. The far plane cancels itself out. The
near plane is the entire story.

Which makes "pull the far plane in" — the usual instinct — **the one adjustment
that cannot help**, while the value nobody touches is worth two orders of
magnitude.

And here is the mechanism, from the other direction:

| near | share of the depth range used by the first 1% of the view volume |
|---|---|
| 0.01 | **99.9%** |
| 0.1 | **99.0%** |
| 1.0 | 91.0% |
| 10 | 50.3% |

With a near plane of 0.01, the closest **1%** of the scene consumes essentially
the whole buffer and everything beyond shares what is left.

For the part this application draws — 6 inches across, viewed from 24:

\`\`\`
near = 0.01   resolvable 3.43e-03 in   coplanar faces will flicker
near = 0.1    resolvable 3.43e-04 in   fine
near = 1.0    resolvable 3.43e-05 in   fine
\`\`\`

A default near plane of 0.01 is enough to make a part flicker at
**three thousandths of an inch** — above the finish threshold from lesson 11, so
real features vanish into the flicker.`,
    },

    {
      type: 'markdown',
      instruction: `### Depth test and depth write are two switches, not one

Now a section of this lesson that is **not** my measurement. The map records it
from the existing application, where it cost days:

> A highlight that should show *through* the part, a section cap that must not be
> hidden by the geometry it is cutting, and an edge line that must not z-fight
> with the face it lies on are three different combinations of these two
> switches. The current application ended up with **four highlight materials that
> differ in nothing else.**

The four combinations, and what each is for:

| test | write | behaviour | used for |
|---|---|---|---|
| on | on | ordinary opaque geometry | the part |
| on | **off** | drawn where visible, does not occlude later draws | transparent overlays, edge lines |
| **off** | on | drawn regardless of depth, and occludes what follows | section caps, gizmos that must be seen |
| off | off | drawn regardless, occludes nothing | screen-space annotations |

Four materials that "differ in nothing else" is the symptom of these two
switches having been discovered one at a time by trial. **Name them by what they
are for**, and there are four, not an unbounded family.

Two more the map records rather than re-derives:

- **The stencil buffer is not enabled by default.** Without it every stencil
  test passes, so a section cap paints over the whole part.
- **Render order is not inherited by children.** Setting it on a group does not
  set it on what the group contains.

Neither of those is discoverable by reasoning. They are facts about a specific
API, and the reason they are written down is that re-deriving them costs days
each time.`,
    },

    {
      type: 'markdown',
      instruction: `### A clipping plane lives in the world, and that is the bug

The map says: *"A section plane is defined in the world, but the part turns.
Leave the plane where it was and the cut visibly swims through the part as you
orbit."*

Measuring that took two attempts, and the first was wrong in a way worth showing.

**Attempt one.** Compare "test the world positions against the world plane"
against "pull the plane back into model space". Those are:

\`\`\`
(R·p) · n        and        p · (Rᵀ·n)
\`\`\`

**They are the same number.** Matrix–vector association, nothing more. I wrote
one computation twice and asserted the results would differ.

**Attempt two — ask the right question.** Orbiting changes where you look from,
not what the part *is*. So a section must remove **the same material at every
orbit angle**. Whether it does is the test.

With the orbit implemented by rotating the model, and a section plane left in
world space:

| orbit | plane fixed in the world | plane fixed to the part |
|---|---|---|
| 0° | 25.03% | 25.03% |
| 15° | 24.13% | 25.03% |
| 30° | 21.11% | 25.03% |
| 45° | 14.76% | 25.03% |
| 60° | 7.29% | 25.03% |
| 90° | **0.00%** | 25.03% |

**The section removes a quarter of the part at one viewing angle and none of it
at another** — a variation of **6.008 cubic inches** on a 6×2×2 plate. Nothing
about the part changed. The user only looked at it from somewhere else.

Because the change is smooth with the orbit, it reads as the section *swimming*
rather than as a bug.

Two ways out, **not equivalent**:

\`\`\`
store the plane in the part's frame, convert for display   always correct
move the CAMERA instead of the part                        never arises
\`\`\`

The second is an architectural choice made once. And note which mistake is
invisible: **at 0° both schemes agree exactly**, so a screenshot taken head-on
proves nothing.`,
    },

    {
      type: 'markdown',
      instruction: `### Welding saves 67%, and then the renderer un-welds it again

Lesson 3 welded a mesh and the visible result was *nothing*. Here is what it is
worth where the mesh has to be uploaded — 24 bytes per vertex (position and
normal at float32), 4 bytes per index:

| triangles | welded verts | non-indexed | indexed | saved |
|---|---|---|---|---|
| 12 | 8 | — | — | 61.1% |
| 1,000 | 502 | 0.07 MB | 0.02 MB | 66.6% |
| 21,646 | 10,825 | 1.56 MB | 0.52 MB | 66.7% |
| **214,382** | 107,193 | **15.44 MB** | **5.15 MB** | **66.7%** |

**Two thirds**, on the model from section 16. And it is only available because
the mesh was welded — an exploded mesh has no shared vertices to index.

#### But indexing buys one normal per vertex, and that is not always enough

A welded cube has 8 vertices and 6 face directions. A shared vertex cannot carry
the right normal for all three faces meeting at it.

Measured on a cylinder with a flat top — genuine curvature in the wall, a genuine
90° crease at the rim:

| normals | worst error on the wall | worst on the rim |
|---|---|---|
| flat, per face | **7.50°** | 0.00° |
| smooth, averaged, no limit | 2.51° | **33.97°** |
| smooth, 30° crease limit | 2.51° | **2.51°** |
| smooth, 80° crease limit | 2.51° | 2.51° |

Flat shading gets every edge right and every curve wrong — out by half the facet
angle, which is lesson 4's faceting appearing as a *lighting* error rather than a
*measurement* one.

Averaging without a limit fixes the wall and puts the rim normal **34° out**,
because it averages the wall and the cap together and points at neither.

Refusing to average across the crease fixes both. **And that is the same
threshold lesson 16A's brush needed** — the dihedral angle, doing a second job.

The consequence: the vertex on the rim needs **two** normals, one for the wall
and one for the cap, so it has to be **duplicated in the buffer**. The renderer
un-welds exactly where topology wanted welding, and it decides where using the
crease angle.

That is not a contradiction. Welding is about *topology* — which faces are
neighbours. The buffer is about *attributes* — what each corner carries. They
are different questions about the same mesh, and lesson 3's welded mesh is still
the thing that knows the answer to the first.`,
    },

    {
      type: 'markdown',
      instruction: `### Screen space and world space are different problems

The last thing the map records, and the one with a rule attached:

\`\`\`
anchoring a label to the face it names    a world problem
stopping two labels overlapping          a screen problem
\`\`\`

Mix them and you get the failure the existing application has: labels that
reposition themselves every time anything is recalculated, because the
"don't overlap" pass is scored against wherever the camera happens to be
pointing at that instant. **A data change then moves things on screen, which
reads as the view breaking.**

> **Rule: if a calculation reads the camera, it must be driven by camera events —
> never by a data event.**

That rule is worth more than the example. It is a test you can apply to any
piece of code in the viewer: *does this read the camera?* If yes, it belongs on
the camera's event path. If it also reads the data, it has to be split in two.`,
    },

    {
      type: 'challenge',
      instruction: `### 🎯 The depth budget, and the matrix that spends it

Two functions.

\`resolvableSeparation(d, near, far, bits)\` — the smallest separation at
distance \`d\` that still changes the stored depth value. Derive it from the
projection: one least-significant bit spans \`2 / 2^bits\` of the −1…+1 NDC
range.

\`perspective(fovDeg, aspect, near, far)\` — the projection matrix, as four rows
of four. Column-major or row-major is a real decision; here, **row \`i\`
column \`j\` is \`M[i][j]\`**, and the matrix multiplies a column vector
\`[x, y, z, 1]\`.

It is checked that \`near\` and \`far\` map to −1 and +1 after the divide, that the
fourth row produces \`w = depth\`, and that your separation formula matches the
projection it describes rather than merely looking like it.`,
      html: `<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:10px;white-space:pre;background:#0a0f1e;border-radius:8px;min-height:250px"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `// TODO 1: the smallest separation the depth buffer can resolve at distance d.
function resolvableSeparation(d, near, far, bits) {

  // your code here

  return 0;
}

// TODO 2: the perspective projection matrix, four rows of four.
function perspective(fovDeg, aspect, near, far) {

  // your code here

  return [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]];
}

// ── it runs itself below ──────────────────────────────────────────────────
function apply4(M, v) {
  var o = [0,0,0,0];
  for (var i = 0; i < 4; i++) {
    o[i] = M[i][0]*v[0] + M[i][1]*v[1] + M[i][2]*v[2] + M[i][3]*v[3];
  }
  return o;
}

var lines = ['  RESOLVABLE SEPARATION  (near 0.1, far 1000, 24 bits)'];
[0.5, 1, 10, 100, 500, 900].forEach(function (d) {
  lines.push('    at ' + String(d).padStart(5) + ' units: '
    + resolvableSeparation(d, 0.1, 1000, 24).toExponential(2));
});
lines.push('');
lines.push('  NEAR AGAINST FAR, at 50 units');
[[0.1,1000],[0.1,100],[10,1000]].forEach(function (c) {
  lines.push('    near ' + String(c[0]).padStart(5) + ' far ' + String(c[1]).padStart(5)
    + ': ' + resolvableSeparation(50, c[0], c[1], 24).toExponential(2));
});
lines.push('');
lines.push('  PROJECTION');
var P = perspective(50, 16/9, 0.1, 1000);
[[0,0,-0.1],[0,0,-1000],[0.5,0.3,-10]].forEach(function (p) {
  var c = apply4(P, [p[0],p[1],p[2],1]);
  lines.push('    camera [' + p.join(', ') + ']  w = ' + c[3].toFixed(3)
    + '   ndc z = ' + (c[3] !== 0 ? (c[2]/c[3]).toFixed(6) : 'n/a'));
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
            body + '\nreturn { resolvableSeparation, perspective };',
          )(doc, { log() {} });
        } catch (e) { return no('The code did not run: ' + e.message); }
        for (const n of ['resolvableSeparation', 'perspective']) {
          if (typeof fn[n] !== 'function') return no(n + ' is not a function.');
        }

        const zNdc = (d, n, f) => ((f + n) - 2 * f * n / d) / (f - n);
        const ref = (d, n, f, b) => (f - n) * d * d / (Math.pow(2, b) * f * n);

        // The formula must match the projection, not merely resemble it.
        for (const [d, n, f, b] of [[0.5, 0.1, 1000, 24], [50, 0.1, 1000, 24],
                                    [500, 0.1, 1000, 24], [50, 10, 1000, 24],
                                    [24, 0.01, 1000, 16]]) {
          let got;
          try { got = fn.resolvableSeparation(d, n, f, b); } catch (e) {
            return no('resolvableSeparation threw at d=' + d + ': ' + e.message);
          }
          if (typeof got !== 'number' || !Number.isFinite(got) || got <= 0) {
            return no('resolvableSeparation(' + [d, n, f, b] + ') returned '
              + got + '.');
          }
          const want = ref(d, n, f, b);
          if (Math.abs(got - want) / want > 1e-6) {
            // Diagnose the two mistakes that look plausible.
            const swapped = (f - n) * d * d / (Math.pow(2, b) * f * n) * (n / f) * (f / n);
            const linear = (f - n) * d / (Math.pow(2, b) * f * n);
            if (Math.abs(got - linear) / linear < 1e-6) {
              return no('At d=' + d + ' your answer is linear in d. The depth '
                + 'buffer stores a function of 1/d, so differentiating brings out '
                + 'a d SQUARED — which is why precision at 500 units is 10,000 '
                + 'times worse than at 5, not 100 times.');
            }
            const nearFarSwapped = (f - n) * d * d / (Math.pow(2, b) * n * f);
            if (Math.abs(nearFarSwapped - want) < 1e-12
                && Math.abs(got - want) / want > 1e-6) {
              // f*n is symmetric, so a swap is undetectable; fall through.
            }
            return no('At d=' + d + ', near=' + n + ', far=' + f + ', ' + b
              + ' bits you returned ' + got.toExponential(3) + ' but the '
              + 'projection resolves ' + want.toExponential(3) + '. One LSB spans '
              + '2 / 2^bits of the NDC range; convert that back to a distance '
              + 'through dz/dd.');
          }
        }

        // And it must genuinely be the LSB of the given projection.
        for (const [d, n, f] of [[50, 0.1, 1000], [500, 0.1, 1000], [50, 10, 1000]]) {
          const step = fn.resolvableSeparation(d, n, f, 24);
          const moved = Math.abs(zNdc(d + step, n, f) - zNdc(d, n, f));
          const lsb = 2 / Math.pow(2, 24);
          if (Math.abs(moved - lsb) / lsb > 0.05) {
            return no('Stepping ' + step.toExponential(3) + ' at d=' + d
              + ' moves the stored depth by ' + moved.toExponential(3)
              + ', but one least-significant bit is ' + lsb.toExponential(3)
              + '. The answer has to be the step that moves the buffer by '
              + 'exactly one bit.');
          }
        }

        // perspective
        let P;
        try { P = fn.perspective(50, 16 / 9, 0.1, 1000); } catch (e) {
          return no('perspective threw: ' + e.message);
        }
        const okMat = Array.isArray(P) && P.length === 4
          && P.every((r) => Array.isArray(r) && r.length === 4
            && r.every((x) => typeof x === 'number' && Number.isFinite(x)));
        if (!okMat) {
          return no('perspective should return four rows of four finite numbers. '
            + 'Got ' + JSON.stringify(P) + '.');
        }
        const app = (M, v) => [0, 1, 2, 3].map((i) =>
          M[i][0] * v[0] + M[i][1] * v[1] + M[i][2] * v[2] + M[i][3] * v[3]);

        // w must come out as the camera-space depth.
        for (const d of [0.1, 1, 10, 1000]) {
          const c = app(P, [0.3, -0.2, -d, 1]);
          if (Math.abs(c[3] - d) > 1e-9) {
            if (Math.abs(c[3] - 1) < 1e-9) {
              return no('At depth ' + d + ' your matrix gives w = 1, so there is '
                + 'no perspective divide at all — that is an ORTHOGRAPHIC '
                + 'projection. The fourth row has to be [0, 0, −1, 0], which '
                + 'copies the camera-space depth into w.');
            }
            return no('At camera depth ' + d + ' the matrix gives w = '
              + c[3].toFixed(4) + ', expected ' + d + '. The fourth row is what '
              + 'produces w, and it must be [0, 0, −1, 0].');
          }
        }
        // near and far must land on -1 and +1.
        for (const [d, want] of [[0.1, -1], [1000, 1]]) {
          const c = app(P, [0, 0, -d, 1]);
          const ndc = c[2] / c[3];
          if (Math.abs(ndc - want) > 1e-6) {
            return no('A point at the ' + (want < 0 ? 'near' : 'far') + ' plane '
              + '(depth ' + d + ') should land at ndc z = ' + want + ', got '
              + ndc.toFixed(6) + '. The third row sets that mapping.');
          }
        }
        // The field of view has to be honoured on both axes.
        {
          const t = 1 / Math.tan((50 * Math.PI / 180) / 2);
          if (Math.abs(P[1][1] - t) > 1e-9) {
            return no('P[1][1] is ' + P[1][1].toFixed(6) + ', expected '
              + t.toFixed(6) + ' = 1 / tan(fov / 2). The vertical field of view '
              + 'sets it directly.');
          }
          if (Math.abs(P[0][0] - t / (16 / 9)) > 1e-9) {
            const noAspect = Math.abs(P[0][0] - t) < 1e-9;
            return no('P[0][0] is ' + P[0][0].toFixed(6) + ', expected '
              + (t / (16 / 9)).toFixed(6) + '. ' + (noAspect
                ? 'You used the vertical term on both axes, so the aspect ratio '
                  + 'is ignored and the image is stretched.'
                : 'It is the vertical term divided by the aspect ratio.'));
          }
          // A point on the right edge of a 16:9 frame must land at x = +1.
          const edge = app(P, [Math.tan((50 * Math.PI / 180) / 2) * (16 / 9) * 5, 0, -5, 1]);
          if (Math.abs(edge[0] / edge[3] - 1) > 1e-6) {
            return no('A point on the right edge of the frame should land at '
              + 'ndc x = +1, got ' + (edge[0] / edge[3]).toFixed(6) + '.');
          }
        }

        return {
          pass: true,
          message: 'The separation formula is the real least-significant bit of the '
            + 'projection rather than something that merely has the right shape, and '
            + 'the matrix puts the camera-space depth into w so the divide actually '
            + 'produces perspective. Those two together are the whole depth budget '
            + '— and they are why the near plane is worth 101x and the far plane '
            + 'is worth 1.00x.',
        };
      },
      successMessage: '✓ The depth budget, derived rather than guessed.',
      failMessage: '✗ Not yet.',
      outputHeight: 470,
    },

  ],
};

const PY_CELLS = [
  {
    id: 'depth',
    cellTitle: 'The depth buffer stores 1/d, and everything follows',
    prose: [
      'Z-fighting is usually blamed on coplanar geometry, as though it were a modelling problem. It is a quantisation problem with a closed form, and the form says exactly when it will happen.',
      'After the projection and the divide by w, the value written to the depth buffer is ((f+n) - 2fn/d) / (f-n) - a function of 1/d, not of d. Differentiate it and the smallest separation that still changes the stored value comes out as (f-n) d squared / (2^bits f n).',
      'Two things are in that expression and both matter: d squared in the numerator, and the near plane in the denominator. Rather than trusting the algebra, check it: step by the predicted amount and confirm the stored depth moves by exactly one least-significant bit.',
    ],
    code: `import numpy as np

BITS = 24

def z_ndc(d, n, f):
    """What the depth buffer stores for a point at camera depth d."""
    return ((f + n) - 2.0*f*n/d) / (f - n)

def resolvable(d, n, f, bits=BITS):
    """Smallest separation at d that still changes the stored value."""
    return (f - n) * d*d / (2**bits * f * n)

# Verify the closed form against the projection it claims to describe.
n, f = 0.1, 1000.0
lsb = 2.0 / 2**BITS                      # one bit over the -1..+1 NDC range
print(f"{'distance':>10} {'predicted step':>16} {'depth actually moved':>22} {'vs one LSB':>12}")
worst = 0.0
for d in (0.5, 1.0, 10.0, 100.0, 500.0, 900.0):
    step = resolvable(d, n, f)
    moved = abs(z_ndc(d + step, n, f) - z_ndc(d, n, f))
    worst = max(worst, abs(moved - lsb)/lsb)
    print(f'{d:>10} {step:>16.3e} {moved:>22.3e} {moved/lsb:>11.4f}x')

print()
print(f'the closed form agrees with the projection to {100*worst:.4f}%')
print()
print(f"{'distance':>10} {'resolvable separation':>24}")
for d in (0.5, 1.0, 10.0, 100.0, 500.0, 900.0):
    print(f'{d:>10} {resolvable(d, n, f):>20.2e} in')
print()
print(f'At 500 units, surfaces closer than {resolvable(500.0, n, f):.4f} in are')
print('one depth value. On a part measured in inches that is a seventh of an')
print('inch of geometry disappearing - and nothing reports it.')`,
  },
  {
    id: 'planes',
    cellTitle: 'Which plane controls it, and which one everybody adjusts',
    prose: [
      'The usual response to z-fighting is to pull the far plane in. Measure whether that helps before doing it.',
      'Every row is evaluated at the same distance, and that distance is inside every view volume in the table - measuring precision at a point beyond the far plane would be measuring nothing, which an earlier version of this script did and printed nan for its trouble.',
      'Then look at the algebra the numbers point to. Delta is proportional to (f-n)/(f n), and when the far plane is much larger than the near plane that expression is very nearly 1/n. The far plane cancels itself.',
    ],
    code: `D0 = 50.0
base = resolvable(D0, 0.1, 1000.0)

print(f"{'near':>8} {'far':>8} {'resolvable at 50':>20} {'vs baseline':>13}")
for nn, ff in ((0.1, 1000.0), (0.1, 500.0), (0.1, 100.0),
               (1.0, 1000.0), (10.0, 1000.0), (10.0, 100.0)):
    r = resolvable(D0, nn, ff)
    print(f'{nn:>8} {ff:>8} {r:>17.2e} {base/r:>11.1f}x')

far_gain = base / resolvable(D0, 0.1, 100.0)
near_gain = base / resolvable(D0, 10.0, 1000.0)
print()
print(f'pulling FAR in from 1000 to 100 : {far_gain:>6.2f}x better')
print(f'pushing NEAR out from 0.1 to 10 : {near_gain:>6.1f}x better')
print()
print('The adjustment everybody reaches for buys nothing at all.')
print()

# The mechanism, from the other side: where the depth range goes.
print('share of the depth range spent on the first 1% of the view volume:')
for nn in (0.01, 0.1, 1.0, 10.0):
    span = z_ndc(nn + 0.01*(1000.0 - nn), nn, 1000.0) - z_ndc(nn, nn, 1000.0)
    print(f'  near = {nn:>5} : {100*span/2:>5.1f}%')
print()
print('And for the part this application draws - 6 inches across, seen from 24:')
for nn in (0.01, 0.1, 1.0, 10.0):
    r = resolvable(24.0, nn, 1000.0)
    print(f'  near = {nn:>5} : resolvable {r:.2e} in'
          + ('   coplanar faces will flicker' if r > 5e-4 else '   fine'))
print()
print('A default near plane of 0.01 makes a part flicker at three thousandths')
print('of an inch - above lesson 11\\'s finish threshold, so real features')
print('vanish into the flicker.')`,
  },
  {
    id: 'buffers',
    cellTitle: 'What welding is worth, in bytes',
    prose: [
      'Lesson 3 welded a mesh and the visible result was nothing at all - the same picture, the same measurements. This is where it pays: the mesh has to be uploaded to the GPU, and a welded mesh can be indexed.',
      'Count it honestly. Each vertex carries a position and a normal, three float32 each, so 24 bytes. An indexed mesh also needs one uint32 per triangle corner. Non-indexed stores a full vertex per corner and no indices.',
      'Then note the cost that comes with indexing, because it is the subject of the next cell: one vertex means one normal, and a vertex where three differently-facing faces meet cannot carry the right normal for all of them.',
    ],
    code: `VERT_BYTES = 3*4 + 3*4      # position + normal, float32
IDX_BYTES = 4               # uint32 per corner

print(f"{'triangles':>11} {'welded verts':>13} {'non-indexed':>14} {'indexed':>12} {'saved':>8}")
for tris, verts in ((12, 8), (1_000, 502), (21_646, 10_825), (214_382, 107_193)):
    non = tris * 3 * VERT_BYTES
    idx = verts * VERT_BYTES + tris * 3 * IDX_BYTES
    print(f'{tris:>11,} {verts:>13,} {non/1e6:>11.2f} MB {idx/1e6:>9.2f} MB '
          f'{100*(1-idx/non):>7.1f}%')

non = 214_382 * 3 * VERT_BYTES
idx = 107_193 * VERT_BYTES + 214_382 * 3 * IDX_BYTES
print()
print(f'On the 214,382-face model: {non/1e6:.1f} MB against {idx/1e6:.1f} MB, '
      f'{100*(1-idx/non):.0f}% saved.')
print()
print('Available only because the mesh was welded - an exploded mesh has no')
print('shared vertices to index. Lesson 3 paid for this and showed nothing.')
print()
print('The catch: indexing buys ONE normal per vertex. A welded cube has 8')
print('vertices and 6 face directions, so a corner cannot carry the right')
print('normal for all three faces meeting there.')`,
  },
  {
    id: 'clip',
    cellTitle: 'A clipping plane lives in the world, and asking the right question',
    prose: [
      'The map records that a world-space section plane makes the cut swim through the part as you orbit. Measuring that took two attempts, and the first was wrong in a way worth keeping.',
      'Attempt one compared testing world positions against a world plane with pulling the plane back into model space. Those are (R p) dot n and p dot (R-transpose n), which are the same number by association - one computation written twice, then asserted to differ. Nothing was being compared.',
      'Attempt two asks the question that actually distinguishes them: orbiting changes where you look from, not what the part is, so a section must remove the same material at every orbit angle. Whether it does is the test. Note also that the plate is deliberately not square - a square one hides the effect behind its own symmetry.',
    ],
    code: `def rot_z(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c,-s,0], [s,c,0], [0,0,1]], float)

rng = np.random.default_rng(7)
pts = rng.uniform([-3,-1,-1], [3,1,1], size=(200_000, 3))    # a 6 x 2 x 2 plate
volume = 6.0 * 2.0 * 2.0
PLANE_N, PLANE_C = np.array([1.0, 0.0, 0.0]), 1.5   # offset, not 50% by symmetry

print(f"{'orbit':>8} {'plane fixed in the world':>26} {'plane fixed to the part':>26}")
world, part = [], []
for deg in (0, 15, 30, 45, 60, 90):
    R = rot_z(np.radians(deg))
    w = float(((pts @ R.T) @ PLANE_N > PLANE_C).mean())   # plane left in world space
    p = float((pts @ PLANE_N > PLANE_C).mean())           # plane belongs to the part
    world.append(w); part.append(p)
    print(f'{deg:>7}\\u00b0 {100*w:>23.2f}% {100*p:>25.2f}%')

print()
print(f'material removed varies by {(max(world)-min(world))*volume:.3f} cubic inches')
print(f'when the plane is left in world space, and by '
      f'{(max(part)-min(part))*volume:.3f} when it belongs to the part.')
print()
print('Nothing about the part changed. The user looked at it from somewhere')
print('else. Because it varies smoothly with the orbit it reads as the section')
print('SWIMMING rather than as a bug.')
print()
print('And note which mistake is invisible: at 0 degrees both schemes agree')
print('exactly, so a screenshot taken head-on proves nothing.')`,
  },
  {
    id: 'normals',
    cellTitle: 'Flat, smooth, and the crease angle doing a second job',
    prose: [
      'A flat normal is per face; a smooth normal is the average of the faces meeting at a vertex. Neither is right everywhere, and the test needs a shape with both kinds of edge in it: a cylinder with a flat top has genuine curvature in the wall and a genuine ninety degree crease at the rim.',
      'Score both against ground truth, which for this shape is known analytically - radial on the wall, straight up on the cap. Flat shading should be wrong on the curve and right at the edge; averaging should be right on the curve and wrong at the edge.',
      'Then add a crease limit and watch both become right. The threshold that does it is the dihedral angle from lesson 16A - the same number the brush needed to stop painting, now deciding where a normal may be averaged.',
    ],
    code: `def cylinder_with_cap(nseg=24, r=1.0, h=2.0):
    V, F = [], []
    for i in range(nseg):
        a0, a1 = 2*np.pi*i/nseg, 2*np.pi*(i+1)/nseg
        p0 = [r*np.cos(a0), r*np.sin(a0)]; p1 = [r*np.cos(a1), r*np.sin(a1)]
        b = len(V)
        V += [p0+[0.0], p1+[0.0], p1+[h], p0+[h]]
        F += [[b,b+1,b+2], [b,b+2,b+3]]
    top = len(V); V.append([0.0, 0.0, h])
    for i in range(nseg):
        a0, a1 = 2*np.pi*i/nseg, 2*np.pi*(i+1)/nseg
        b = len(V)
        V += [[r*np.cos(a0), r*np.sin(a0), h], [r*np.cos(a1), r*np.sin(a1), h]]
        F.append([top, b, b+1])
    return np.array(V, float), np.array(F)

V2, F2 = cylinder_with_cap()
fn = np.cross(V2[F2[:,1]]-V2[F2[:,0]], V2[F2[:,2]]-V2[F2[:,0]])
fn /= np.linalg.norm(fn, axis=1, keepdims=True)

key, remap = {}, np.zeros(len(V2), int)
for i, p in enumerate(V2):
    k = tuple(np.round(p, 9))
    key.setdefault(k, len(key)); remap[i] = key[k]
nv = len(key); inv = {v: k for k, v in key.items()}
print(f'  {len(F2)} faces, {len(V2)} raw corners, {nv} welded vertices')

def vertex_normals(limit_deg=None):
    acc = np.zeros((nv, 3))
    if limit_deg is None:
        for fi, tri in enumerate(F2):
            for c in tri:
                acc[remap[c]] += fn[fi]
    else:
        cl = np.cos(np.radians(limit_deg))
        groups = {}
        for fi, tri in enumerate(F2):
            for c in tri:
                v = remap[c]; placed = False
                for g in groups.setdefault(v, []):
                    if float(fn[fi] @ fn[g[0]]) >= cl:
                        g.append(fi); placed = True; break
                if not placed:
                    groups[v].append([fi])
        for v, gs in groups.items():
            acc[v] = fn[gs[0]].sum(axis=0)
    ln = np.linalg.norm(acc, axis=1, keepdims=True)
    return acc / np.where(ln == 0, 1, ln)

def truth_at(p):
    if abs(p[2]-2.0) < 1e-9 and np.hypot(p[0], p[1]) < 1.0-1e-9:
        return np.array([0.0,0.0,1.0])
    rad = np.array([p[0], p[1], 0.0]); ln = np.linalg.norm(rad)
    return rad/ln if ln > 1e-12 else np.array([0.0,0.0,1.0])

rim = [v for k, v in key.items() if abs(k[2]-2.0) < 1e-9 and np.hypot(k[0],k[1]) > 0.5]
wall = [v for k, v in key.items() if abs(k[2]) < 1e-9]

def worst(vn, group):
    return max(np.degrees(np.arccos(np.clip(
        vn[v] @ truth_at(np.array(inv[v])), -1, 1))) for v in group)

print()
print(f"{'normals':>26} {'worst on the wall':>20} {'worst on the rim':>18}")
print(f"{'flat (per face)':>26} {360/24/2:>19.2f}\\u00b0 {0.0:>17.2f}\\u00b0")
for label, lim in (('smooth, no limit', None), ('smooth, 30 degree limit', 30.0),
                   ('smooth, 80 degree limit', 80.0)):
    vn = vertex_normals(lim)
    print(f'{label:>26} {worst(vn, wall):>19.2f}\\u00b0 {worst(vn, rim):>17.2f}\\u00b0')

print()
print('Flat gets every edge right and every curve wrong, by half the facet')
print('angle - lesson 4\\'s faceting showing up as a LIGHTING error.')
print()
print('Averaging without a limit fixes the curve and puts the rim 34 degrees')
print('out, because it averages the wall and the cap and points at neither.')
print()
print('So the rim vertex needs TWO normals and has to be duplicated in the')
print('buffer. The renderer un-welds exactly where topology wanted welding,')
print('and it decides where using lesson 16A\\'s crease angle.')`,
  },
  {
    id: 'ch-depth',
    challengeType: 'write',
    challengeTitle: 'Find a near plane that will not flicker',
    difficulty: 'warm-up',
    prompt:
      'Write resolvable_at(d, near, far, bits) for the smallest separation the depth buffer '
      + 'can distinguish, and safe_near(d, tolerance, far, bits) returning the smallest '
      + 'near plane whose resolvable separation at d is below tolerance. Then set report to '
      + 'a list of (near, resolvable, flickers) rows for a part at 24 units against a '
      + '0.0005 inch tolerance.',
    hint:
      'resolvable is already defined above and yours must agree with it. For safe_near, '
      + 'note that the separation falls as the near plane grows, so search upward - or '
      + 'solve it directly, since delta is proportional to (f-n)/(f n).',
    code: `def resolvable_at(d, near, far, bits=24):
    # TODO
    pass


def safe_near(d, tolerance, far=1000.0, bits=24):
    # TODO: smallest near plane whose resolvable separation at d is under tolerance
    pass


report = []
# TODO: (near, resolvable, flickers) rows for d = 24, tolerance 0.0005

for nr, r, fl in report:
    print(f'  near {nr:>7} : {r:.2e} in   {"FLICKERS" if fl else "fine"}')`,
    solution: `def resolvable_at(d, near, far, bits=24):
    return (far - near) * d*d / (2**bits * far * near)


def safe_near(d, tolerance, far=1000.0, bits=24):
    lo, hi = 1e-6, far * 0.5
    for _ in range(200):
        mid = (lo + hi) / 2
        if resolvable_at(d, mid, far, bits) < tolerance:
            hi = mid
        else:
            lo = mid
    return hi


report = []
for nr in (0.01, 0.1, 1.0, 10.0):
    r = resolvable_at(24.0, nr, 1000.0)
    report.append((nr, r, r > 0.0005))

for nr, r, fl in report:
    print(f'  near {nr:>7} : {r:.2e} in   {"FLICKERS" if fl else "fine"}')
print(f'  smallest safe near plane: {safe_near(24.0, 0.0005):.4f}')`,
    testCode: `assert report, "report is empty - nothing was measured."
assert len(report) >= 3, f"only {len(report)} rows"

# Must agree with the reference formula, which was itself verified against the
# projection in the first cell.
for _d, _n, _f, _b in ((0.5, 0.1, 1000.0, 24), (50.0, 0.1, 1000.0, 24),
                       (500.0, 0.1, 1000.0, 24), (50.0, 10.0, 1000.0, 24),
                       (24.0, 0.01, 1000.0, 16)):
    _got, _want = resolvable_at(_d, _n, _f, _b), resolvable(_d, _n, _f, _b)
    assert abs(_got - _want) / _want < 1e-9, (
        f"resolvable_at({_d}, {_n}, {_f}, {_b}) gave {_got:.4e}, expected "
        f"{_want:.4e}")

# It must scale as d squared, not linearly - that is the whole point.
_r1, _r2 = resolvable_at(5.0, 0.1, 1000.0), resolvable_at(50.0, 0.1, 1000.0)
assert abs(_r2/_r1 - 100.0) < 1e-6, (
    f"ten times the distance changed the answer by {_r2/_r1:.1f}x. The depth "
    f"buffer stores a function of 1/d, so the separation goes as d SQUARED - "
    f"100x, not 10x.")

# And the far plane must barely matter while the near plane dominates.
_far_gain = resolvable_at(50.0, 0.1, 1000.0) / resolvable_at(50.0, 0.1, 100.0)
_near_gain = resolvable_at(50.0, 0.1, 1000.0) / resolvable_at(50.0, 10.0, 1000.0)
assert _far_gain < 1.05, (
    f"pulling the far plane in gave {_far_gain:.2f}x, which should be ~1.00x")
assert _near_gain > 50, (
    f"pushing the near plane out gave only {_near_gain:.1f}x, expected ~101x")

# safe_near must be genuinely the boundary.
_sn = safe_near(24.0, 0.0005)
assert resolvable_at(24.0, _sn, 1000.0) < 0.0005, (
    f"safe_near returned {_sn:.6f}, which still resolves "
    f"{resolvable_at(24.0, _sn, 1000.0):.2e} - above the tolerance")
assert resolvable_at(24.0, _sn * 0.9, 1000.0) > 0.0005 * 0.95, (
    f"safe_near returned {_sn:.6f} but a smaller near plane would also do - it "
    f"should be the SMALLEST that works")

# The report must show the failure as well as the fix.
assert any(fl for _, _, fl in report), (
    "no row in the report flickers - include near = 0.01, which resolves "
    "3.43e-03 in and is above a 0.0005 in tolerance")
assert any(not fl for _, _, fl in report), "no row in the report is safe"
"SUCCESS: precision goes as d squared, the far plane is worth 1.00x, and the near plane nobody adjusts is worth 101x."`,
  },
  {
    id: 'ch-project',
    challengeType: 'write',
    challengeTitle: 'Build the matrix that spends the budget',
    difficulty: 'core',
    prompt:
      'Write perspective(fov_deg, aspect, near, far) returning the 4x4 projection matrix, '
      + 'and project(P, point) returning the NDC coordinates after the divide by w. Then '
      + 'set checks to a list of (label, ndc) rows showing that the near plane lands at '
      + 'z = -1, the far plane at z = +1, and the frame edge at x = +1.',
    hint:
      'With t = 1/tan(fov/2): M[0][0] = t/aspect, M[1][1] = t, M[2][2] = -(f+n)/(f-n), '
      + 'M[2][3] = -2fn/(f-n), M[3][2] = -1. Camera space looks down -z, so a point at '
      + 'depth d has z = -d. The divide by w is what makes it a perspective.',
    code: `def perspective(fov_deg, aspect, near, far):
    # TODO
    pass


def project(P, point):
    # TODO: returns [x, y, z] in NDC, after the divide by w
    pass


checks = []
# TODO: (label, ndc) rows for the near plane, the far plane, and the frame edge

for label, ndc in checks:
    print(f'  {label:<22} ndc [{ndc[0]:+.6f} {ndc[1]:+.6f} {ndc[2]:+.6f}]')`,
    solution: `def perspective(fov_deg, aspect, near, far):
    t = 1.0 / np.tan(np.radians(fov_deg) / 2)
    return np.array([
        [t/aspect, 0, 0, 0],
        [0, t, 0, 0],
        [0, 0, -(far+near)/(far-near), -2*far*near/(far-near)],
        [0, 0, -1, 0],
    ], float)


def project(P, point):
    v = np.array(list(point) + [1.0], float)
    clip = P @ v
    return clip[:3] / clip[3]


P = perspective(50.0, 16/9, 0.1, 1000.0)
half = np.tan(np.radians(50.0)/2)

checks = [
    ('at the near plane',  project(P, [0.0, 0.0, -0.1])),
    ('at the far plane',   project(P, [0.0, 0.0, -1000.0])),
    ('right frame edge',   project(P, [half*(16/9)*5, 0.0, -5.0])),
    ('top frame edge',     project(P, [0.0, half*5, -5.0])),
]

for label, ndc in checks:
    print(f'  {label:<22} ndc [{ndc[0]:+.6f} {ndc[1]:+.6f} {ndc[2]:+.6f}]')`,
    testCode: `assert checks, "checks is empty - nothing was projected."

_P = perspective(50.0, 16/9, 0.1, 1000.0)
assert np.asarray(_P).shape == (4, 4), f"perspective returned shape {np.asarray(_P).shape}"

# w must be the camera-space depth, or there is no perspective at all.
for _d in (0.1, 1.0, 10.0, 1000.0):
    _clip = np.asarray(_P) @ np.array([0.3, -0.2, -_d, 1.0])
    assert abs(_clip[3] - _d) < 1e-9, (
        f"at depth {_d} the matrix gives w = {_clip[3]:.4f}, expected {_d}. The "
        f"fourth row must be [0, 0, -1, 0] - that is what copies the depth into "
        f"w. With [0, 0, 0, 1] you have built an ORTHOGRAPHIC projection.")

# near and far must map to -1 and +1.
assert abs(project(_P, [0.0, 0.0, -0.1])[2] + 1.0) < 1e-6, (
    "the near plane must land at ndc z = -1")
assert abs(project(_P, [0.0, 0.0, -1000.0])[2] - 1.0) < 1e-6, (
    "the far plane must land at ndc z = +1")

# The aspect ratio must be honoured, or the image is stretched.
_t = 1.0 / np.tan(np.radians(50.0)/2)
assert abs(np.asarray(_P)[1][1] - _t) < 1e-9, (
    f"P[1][1] is {np.asarray(_P)[1][1]:.6f}, expected {_t:.6f} = 1/tan(fov/2)")
assert abs(np.asarray(_P)[0][0] - _t/(16/9)) < 1e-9, (
    f"P[0][0] is {np.asarray(_P)[0][0]:.6f}, expected {_t/(16/9):.6f}. If it "
    f"equals P[1][1] the aspect ratio is being ignored and the image stretches.")

_half = np.tan(np.radians(50.0)/2)
assert abs(project(_P, [_half*(16/9)*5, 0.0, -5.0])[0] - 1.0) < 1e-6, (
    "a point on the right edge of the frame must land at ndc x = +1")
assert abs(project(_P, [0.0, _half*5, -5.0])[1] - 1.0) < 1e-6, (
    "a point on the top edge of the frame must land at ndc y = +1")

# And the projected depth must reproduce the z_ndc used in the first cell.
for _d in (0.5, 10.0, 500.0):
    assert abs(project(_P, [0.0, 0.0, -_d])[2] - z_ndc(_d, 0.1, 1000.0)) < 1e-9, (
        f"at depth {_d} the matrix and the z_ndc formula disagree, so the depth "
        f"table earlier in this lesson does not describe this projection")

# The report must actually demonstrate the three mappings.
_labels = ' '.join(l for l, _ in checks).lower()
for _want in ('near', 'far', 'edge'):
    assert _want in _labels, f'no "{_want}" row in checks'
"SUCCESS: w carries the camera-space depth, so the divide produces perspective - and the depth table earlier in this lesson is a property of this matrix, not a separate claim."`,
  },
  {
    id: 'ch-normals',
    challengeType: 'write',
    challengeTitle: 'Stop averaging across the crease',
    difficulty: 'stretch',
    prompt:
      'Write smooth_normals(limit_deg) returning one normal per welded vertex, refusing to '
      + 'average two faces whose normals differ by more than limit_deg. Then set errors to '
      + 'a dict mapping each of "flat", "none", "30" and "80" to (wall_error, rim_error) in '
      + 'degrees, and set split_vertices to how many vertices need more than one normal at '
      + 'a 30 degree limit.',
    hint:
      'Group the faces at each vertex: for each face, join an existing group whose first '
      + 'face agrees within the limit, or start a new one. The number of groups at a vertex '
      + 'is the number of normals it needs. worst(vn, group) and truth_at are already in '
      + 'scope, as are fn, F2, remap and key.',
    code: `def smooth_normals(limit_deg):
    # TODO
    pass


def normal_groups(limit_deg):
    # TODO: {vertex: [[face, ...], ...]} - one list per distinct normal needed
    pass


errors = {}
split_vertices = None
# TODO

for k, (w, r) in errors.items():
    print(f'  {k:<6} wall {w:>6.2f} deg   rim {r:>6.2f} deg')
print('vertices needing more than one normal:', split_vertices)`,
    solution: `def normal_groups(limit_deg):
    cl = np.cos(np.radians(limit_deg))
    groups = {}
    for fi, tri in enumerate(F2):
        for c in tri:
            v = remap[c]
            placed = False
            for g in groups.setdefault(v, []):
                if float(fn[fi] @ fn[g[0]]) >= cl:
                    g.append(fi); placed = True; break
            if not placed:
                groups[v].append([fi])
    return groups


def smooth_normals(limit_deg):
    acc = np.zeros((nv, 3))
    if limit_deg is None:
        for fi, tri in enumerate(F2):
            for c in tri:
                acc[remap[c]] += fn[fi]
    else:
        for v, gs in normal_groups(limit_deg).items():
            acc[v] = fn[gs[0]].sum(axis=0)
    ln = np.linalg.norm(acc, axis=1, keepdims=True)
    return acc / np.where(ln == 0, 1, ln)


errors = {'flat': (360/24/2, 0.0)}
for name, lim in (('none', None), ('30', 30.0), ('80', 80.0)):
    vn = smooth_normals(lim)
    errors[name] = (worst(vn, wall), worst(vn, rim))

split_vertices = sum(1 for gs in normal_groups(30.0).values() if len(gs) > 1)

for k, (w, r) in errors.items():
    print(f'  {k:<6} wall {w:>6.2f} deg   rim {r:>6.2f} deg')
print('vertices needing more than one normal:', split_vertices)`,
    testCode: `assert errors, "errors is empty - nothing was measured."
for _k in ('flat', 'none', '30', '80'):
    assert _k in errors, f'errors is missing "{_k}"'
assert split_vertices is not None, "split_vertices was never set."

# Flat shading: right at the edge, wrong on the curve by half the facet angle.
_fw, _fr = errors['flat']
assert abs(_fw - 7.5) < 0.01, (
    f"flat shading should be out by half the 15 degree facet angle on the wall, "
    f"got {_fw:.2f}")
assert _fr < 0.01, "flat shading gets the edge exactly right"

# Averaging with no limit: fixes the curve, wrecks the rim.
_nw, _nr = errors['none']
assert _nw < 3.0, f"unlimited averaging should fix the wall, got {_nw:.2f} degrees"
assert _nr > 20.0, (
    f"unlimited averaging should put the rim badly out - measured about 34 "
    f"degrees - got {_nr:.2f}. If the rim is fine, the mesh is not welded at "
    f"the rim and the wall and cap are not actually sharing a vertex.")

# A crease limit fixes both.
for _k in ('30', '80'):
    _w, _r = errors[_k]
    assert _w < 3.0 and _r < 3.0, (
        f'a {_k} degree limit should fix both the wall ({_w:.2f}) and the rim '
        f'({_r:.2f}) - the crease is 90 degrees, so any limit below it works')

assert errors['30'][1] < errors['none'][1] / 5, (
    "the crease limit should improve the rim by a large factor, not a little")

# And the consequence for the buffer.
assert split_vertices > 0, (
    "no vertex needed more than one normal, which cannot be right - the rim "
    "vertices each touch a wall face and a cap face 90 degrees apart")
assert split_vertices == len(rim), (
    f"{split_vertices} vertices need splitting but there are {len(rim)} rim "
    f"vertices - it should be exactly the rim, since that is where the crease is")
"SUCCESS: flat is wrong on curves, averaging is wrong at creases, and the crease angle from lesson 16A fixes both - at the cost of duplicating every rim vertex in the buffer."`,
  },
];

export default {
  id: 'mesh-engine-4-1-rendering-fundamentals',
  slug: 'rendering-fundamentals',
  chapter: 'mesh-engine.4',
  order: 0,
  title: 'Rendering Fundamentals',
  subtitle: 'Depth is 1/d, and almost everything else follows from that.',
  tags: [
    'rendering', 'depth buffer', 'z-fighting', 'near plane', 'projection',
    'vertex buffer', 'index buffer', 'clipping plane', 'normals', 'depth test',
  ],
  aliases: 'rendering fundamentals depth buffer z-fighting depth precision near plane far plane projection matrix perspective divide vertex buffer index buffer indexed geometry clipping plane section plane world space flat normals smooth normals vertex normals crease angle depth test depth write stencil render order screen space',
  timeToComplete: 80,
  coreConcept:
    'A perspective projection stores a function of 1/d, not d, so the smallest separation the depth buffer can resolve is (f-n) d squared / (2^bits f n) - verified against the projection to 0.0536%. Two consequences. Precision falls as d squared: at 500 units with near 0.1 the buffer cannot distinguish surfaces closer than 0.149. And because delta is proportional to (f-n)/(f n), which for f much larger than n is nearly 1/n, the far plane cancels itself out: pulling it in from 1000 to 100 is worth 1.00x while pushing the near plane from 0.1 to 10 is worth 101x. The adjustment everybody reaches for is the one that cannot help. Around that sit four more facts. Welding pays here rather than in lesson 3 - indexing a 214,382-face model saves 67%, 15.4 MB to 5.1 MB - but indexing buys one normal per vertex, and a rim vertex averaged across a 90 degree crease is 34 degrees out, so the renderer must un-weld exactly where topology wanted welding, using lesson 16A’s crease angle. A section plane left in world space while the orbit rotates the model removes 25% of a part at one viewing angle and 0% at another, a variation of 6.008 cubic inches, and the two schemes agree exactly head-on so a screenshot proves nothing.',
  prerequisites: ['mesh-engine-3-2-face-splitting'],
  nextLesson: null,

  semantics: {
    core: [
      { symbol: 'z(d) = ((f+n) − 2fn/d)/(f−n)', meaning: 'What the depth buffer stores. A function of 1/d, which is why precision is not uniform.' },
      { symbol: 'Δ(d) = (f−n)d²/(2ᵇ f n)', meaning: 'The smallest resolvable separation at distance d. Verified against the projection, not just derived.' },
      { symbol: 'the near plane', meaning: 'Controls depth precision almost entirely, because Δ ∝ (f−n)/(fn) ≈ 1/n for f ≫ n.' },
      { symbol: 'w = camera-space depth', meaning: 'What the fourth row [0,0,−1,0] produces. The divide by it is the perspective.' },
      { symbol: 'depth test / depth write', meaning: 'Two independent switches, four combinations, each with a purpose. Not one setting.' },
      { symbol: 'indexed geometry', meaning: 'One vertex per welded position plus one index per corner. Saves 67%, and buys only one normal per vertex.' },
      { symbol: 'the crease angle', meaning: 'Lesson 16A’s threshold, reused: where a normal may not be averaged, and therefore where a vertex must be duplicated.' },
    ],
    rulesOfThumb: [
      'When geometry flickers, move the near plane out. Pulling the far plane in is worth 1.00x.',
      'Compute the resolvable separation at your viewing distance and compare it against the tolerance you care about.',
      'Treat depth test and depth write as two switches and name the four combinations by what they are for.',
      'Store a section plane in the part’s frame, or move the camera instead of the part. Never leave the plane in world space while the model rotates.',
      'Index the mesh, and un-weld only where the crease angle says a vertex needs a second normal.',
      'If a calculation reads the camera, drive it from camera events — never from a data event.',
      'Verify any precision formula against the projection it describes, not against its own algebra.',
    ],
  },

  hook: {
    question: 'Your part flickers at 500 units. You can move the near plane or the far plane. One of them is worth 101 times more than the other — which, and why?',
    realWorldContext: 'The near plane, and it is not close. Measured at 50 units: pulling the far plane in from 1000 to 100 changes the resolvable separation by 1.00x — nothing, to two decimal places — while pushing the near plane out from 0.1 to 10 changes it by 101x. The reason is in the algebra: the resolvable separation is proportional to (f−n)/(f·n), and when the far plane is much larger than the near plane that expression is very nearly 1/n, so the far plane cancels itself out. Which makes "pull the far plane in" — the usual instinct — the one adjustment that cannot help. And the stakes are real: on a part 6 inches across viewed from 24, a default near plane of 0.01 makes coplanar faces flicker at three thousandths of an inch, which is above the finish threshold from lesson 11, so real features vanish into the flicker.',
    previewVisualizationId: 'JSNotebook',
  },

  intuition: {
    prose: [
      'Almost nothing in a viewer goes wrong in a shader. It goes wrong in arithmetic nobody looked at.',
      'The depth buffer does not store distance; it stores something proportional to one over distance.',
      'So precision is lavished on what is near the camera and starved everywhere else.',
      'That single fact decides which knob fixes z-fighting, and it is not the knob people turn.',
      'Around it sit four facts about what the renderer receives: buffers, normals, clipping planes, and draw state.',
      'Each of them has a version that looks right in a screenshot and is wrong the moment anything moves.',
    ],
    callouts: [
      {
        type: 'insight',
        title: 'The depth buffer stores 1/d',
        body: 'After the divide, the stored value is ((f+n) − 2fn/d)/(f−n). Differentiating gives a resolvable separation of (f−n)d²/(2ᵇfn) — verified against the projection to 0.0536% over 0.5 to 900 units rather than merely derived. With near 0.1 and far 1000: 1.49e-07 at half a unit, 5.96e-03 at 100, and 1.49e-01 at 500. Precision falls as d squared, so ten times further away is a hundred times worse.',
      },
      {
        type: 'warning',
        title: 'The far plane is worth 1.00x',
        body: 'Measured at 50 units: near 0.1 with far 1000, 500 and 100 all resolve 1.49e-03 — identical. Pushing near from 0.1 to 10 resolves 1.48e-05, which is 101x better. Δ ∝ (f−n)/(fn), and for f ≫ n that is nearly 1/n, so the far plane cancels. The adjustment everybody reaches for is the one that does nothing, and the value nobody touches is worth two orders of magnitude.',
      },
      {
        type: 'warning',
        title: 'A default near plane can hide real features',
        body: 'On a part 6 inches across viewed from 24 units: near 0.01 resolves 3.43e-03 in, near 0.1 resolves 3.43e-04 in. The first is above lesson 11’s finish threshold, so a genuine feature and a flickering artefact are the same size. And the mechanism is stark — with near 0.01 the first 1% of the view volume consumes 99.9% of the depth range.',
      },
      {
        type: 'insight',
        title: 'Welding pays here, and then the renderer undoes it',
        body: 'Indexing the 214,382-face model takes it from 15.44 MB to 5.15 MB — 67% saved, available only because the mesh was welded. But indexing buys one normal per vertex. Measured on a cylinder with a flat top: averaging across the 90° rim puts the normal 33.97° out, and a 30° crease limit brings it to 2.51°. So the rim vertex needs two normals and must be duplicated. Welding answers a question about topology; the buffer answers a question about attributes. They are different questions about the same mesh.',
      },
      {
        type: 'warning',
        title: 'Flat shading is lesson 4 appearing as a lighting error',
        body: 'Flat normals are exact at every edge and wrong on every curve by half the facet angle — measured 7.50° on a 24-segment cylinder. That is the faceting from lesson 4, which was a measurement problem there and is a shading problem here. The same export decision drives both.',
      },
      {
        type: 'warning',
        title: 'A section plane left in world space swims through the part',
        body: 'With the orbit implemented by rotating the model, a world-space section removes 25.03% of a plate at 0° and 0.00% at 90° — a variation of 6.008 cubic inches on a 6×2×2 part. Nothing about the part changed; the user only looked from somewhere else. And at 0° the correct and incorrect schemes agree exactly, so a screenshot taken head-on proves nothing.',
      },
      {
        type: 'insight',
        title: 'Measuring this took two attempts, and the first compared nothing',
        body: 'My first version compared (R·p)·n against p·(Rᵀ·n). Those are the same number by matrix–vector association — one computation written twice, then asserted to differ. The right question is not "which space" but "does orbiting change what the section removes", because orbiting changes the viewpoint and nothing else.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Move the near plane, not the far one',
        caption: 'Where the 24-bit depth range actually goes, and whether two surfaces survive it.',
        props: {
          lesson: LESSON_MESH_4_1,
        },
      },
    ],
  },

  math: {
    prose: [
      'The first cell derives the resolvable separation and then checks it against the projection, rather than trusting the algebra.',
      'The second settles the near-versus-far question, with every row evaluated inside its own view volume.',
      'Then what welding is worth in bytes, and the normal problem that indexing creates.',
      'Then the clipping plane, measured by the only question that distinguishes the two schemes.',
    ],
    visualizations: [
      {
        id: 'PythonNotebook',
        title: 'Depth, buffers, planes and normals',
        mathBridge: 'The projection maps camera-space depth d to a clip-space pair (z, w) with w = d, so the stored value is z/w and the mapping is a Möbius function of d rather than a linear one. That is forced, not chosen: the same divide that produces perspective foreshortening in x and y also divides z, and a single matrix cannot foreshorten x and y while leaving z alone. Differentiating z(d) gives dz/dd = 2fn/((f−n)d²), so a fixed quantisation step in z corresponds to a step in d that grows as d squared — hyperbolic depth distribution is a consequence of wanting perspective at all. The (f−n)/(fn) factor rearranges to 1/n − 1/f, which makes the far plane’s irrelevance explicit: for f ≫ n the second term vanishes and only the reciprocal of the near plane survives.',
        caption: 'Every figure measured, including the one that had to be measured twice.',
        props: {
          initialCells: PY_CELLS,
        },
      },
    ],
  },

  examples: [
    {
      title: 'The knob that does nothing',
      prose: 'At 50 units, far planes of 1000, 500 and 100 all resolve 1.49e-03 — identical to three significant figures. The near plane at 10 instead of 0.1 resolves 1.48e-05.',
    },
    {
      title: 'A hundredth of a unit costing a thousandth of an inch',
      prose: 'A near plane of 0.01 on a part viewed from 24 units resolves 3.43e-03 in — above lesson 11’s finish threshold. Changing it to 0.1 gives 3.43e-04 in.',
    },
    {
      title: 'The rim that needs two normals',
      prose: 'Averaging across a 90° crease puts the rim normal 33.97° out. A 30° limit brings it to 2.51°, at the cost of duplicating every rim vertex in the buffer.',
    },
    {
      title: 'The section that vanishes when you turn the part',
      prose: '25.03% of the plate removed at 0°, 0.00% at 90°, with the plane left in world space. Both schemes agree exactly at 0°.',
    },
  ],

  challenges: [
    {
      prompt: 'Compute the resolvable depth separation and find the smallest near plane that keeps a part below a stated tolerance.',
      hint: 'One LSB spans 2/2ᵇ of the NDC range. The separation goes as d squared.',
    },
    {
      prompt: 'Build the perspective matrix and project points, verifying the near and far planes land at −1 and +1.',
      hint: 'The fourth row is [0, 0, −1, 0]. With [0, 0, 0, 1] you have built an orthographic projection.',
    },
    {
      prompt: 'Compute vertex normals with a crease limit, and count how many vertices need more than one normal.',
      hint: 'Group faces at each vertex by whether they agree within the limit. The group count is the normal count.',
    },
    {
      prompt: 'In the browser, derive the depth budget and the matrix that spends it.',
      hint: 'The formula has to be the real LSB of the projection, not something with the right shape.',
    },
  ],

  misconceptions: [
    {
      claim: 'Z-fighting means the geometry is coplanar and the model needs fixing.',
      reality: 'It means the separation is below the buffer’s resolution at that distance. Measured, at 500 units with near 0.1 anything closer than 0.149 collapses — which is most of a part, not a modelling error.',
    },
    {
      claim: 'Pull the far plane in to improve depth precision.',
      reality: 'Measured 1.00x — no change at all from 1000 down to 100. Δ ∝ 1/n − 1/f, and for f ≫ n the far term is negligible.',
    },
    {
      claim: 'Depth precision falls off linearly with distance.',
      reality: 'It falls as d squared. Ten times further is a hundred times worse: 5.96e-05 at 10 units against 5.96e-03 at 100.',
    },
    {
      claim: 'Depth test and depth write are one setting.',
      reality: 'Two independent switches with four useful combinations. The map records an application that ended up with four highlight materials differing in nothing else, because the combinations were discovered one at a time.',
    },
    {
      claim: 'Welding the mesh was a topology exercise with no practical payoff.',
      reality: 'It is what makes indexing possible — 67% saved, 15.44 MB to 5.15 MB on a real model. An exploded mesh has no shared vertices to index.',
    },
    {
      claim: 'Smooth normals are the better default.',
      reality: 'Averaging across a crease puts the normal 33.97° out and rounds off the edge. Both flat and unlimited smooth are wrong somewhere; the crease angle is what makes either correct.',
    },
    {
      claim: 'A section plane in world space is fine as long as the maths is right.',
      reality: 'It removes 25% of the part at one orbit angle and 0% at another. And because both schemes agree exactly head-on, the bug is invisible in a screenshot.',
    },
  ],

  transferPrompts: [
    'Two faces flicker against each other only when the camera pulls back. What do you change, and what do you expect it to buy?',
    'A viewer looks correct in every screenshot and wrong the moment a user orbits. What class of bug is that?',
    'Your model is 15 MB on the GPU and you have not changed the geometry. What would you check first?',
    'An edge highlight z-fights with the face it lies on. Which two switches would you reach for, and in which combination?',
    'A label moves on screen when the underlying data is recalculated but the camera has not moved. What rule has been broken?',
  ],

  debugging: [
    {
      symptom: 'Coplanar or nearly coplanar faces flicker, worse the further away the camera is.',
      cause: 'The separation is below the depth buffer’s resolution at that distance, which grows as d squared.',
      fix: 'Compute Δ(d) and push the NEAR plane out until it is below your tolerance. Pulling the far plane in is worth 1.00x.',
    },
    {
      symptom: 'Everything flickers, even close geometry.',
      cause: 'A very small near plane — at 0.01 the first 1% of the view volume takes 99.9% of the depth range.',
      fix: 'Raise it to the largest value that does not clip the part. Measured, 0.1 is 10x better and 10 is 101x.',
    },
    {
      symptom: 'A section cut moves through the part as the user orbits.',
      cause: 'The plane is stored in world space while the orbit rotates the model.',
      fix: 'Store it in the part’s frame, or orbit the camera instead. Note that the bug is invisible head-on.',
    },
    {
      symptom: 'Sharp edges look rounded, or a curved surface looks faceted.',
      cause: 'Normals averaged across a crease, or flat normals on a curve.',
      fix: 'Average within a crease limit only, and duplicate the vertices that need a second normal. Measured, a 30° limit fixes a 90° rim from 33.97° to 2.51°.',
    },
    {
      symptom: 'A section cap paints over the entire part.',
      cause: 'The stencil buffer is not enabled, so every stencil test passes.',
      fix: 'Enable it explicitly. This is recorded in the map rather than re-derived, because re-deriving it costs days.',
    },
    {
      symptom: 'Labels jump around when data is recalculated and the camera has not moved.',
      cause: 'A screen-space pass driven by a data event.',
      fix: 'If a calculation reads the camera, drive it from camera events. If it reads both, split it in two.',
    },
  ],

  mastery: {
    prerequisites:
      'Lesson 14 for the projection matrix and homogeneous coordinates — the fourth row does the real work here. Lesson 3 for welding, whose payoff is the indexed buffer. Lesson 4 for faceting, which reappears as a shading error. Lesson 16A for the crease angle, which decides where a vertex needs a second normal. Lesson 11 for the tolerance the depth precision has to beat.',
    signals: [
      'Computes the resolvable separation before blaming geometry for z-fighting.',
      'Reaches for the near plane rather than the far plane.',
      'Treats depth test and depth write as two switches with four named purposes.',
      'Stores a section plane in the part’s frame, or orbits the camera.',
      'Knows why an indexed mesh sometimes has more vertices than the welded one.',
      'Distrusts a viewer bug that does not reproduce in a static screenshot.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'mesh-engine-2-1-coordinate-systems', why: 'Homogeneous coordinates and the fourth row, which here produces the perspective divide.' },
      { lessonId: 'mesh-engine-1-3-topology-and-welding', why: 'Welding, whose payoff is the 67% saved by an indexed buffer.' },
      { lessonId: 'mesh-engine-1-4-mesh-files', why: 'Faceting and chord tolerance, which return here as a shading error.' },
      { lessonId: 'mesh-engine-3-1-selection', why: 'The crease angle, reused to decide where a vertex needs a second normal.' },
      { lessonId: 'mesh-engine-1-11-thresholds', why: 'The finish tolerance the depth precision has to stay below.' },
    ],
    futureLinks: [],
  },

  checkpoints: [
    'I can say what the depth buffer stores and why precision is not uniform.',
    'I can compute the resolvable separation at a given distance.',
    'I can say which plane controls depth precision, and by how much.',
    'I can name the four depth test / depth write combinations and what each is for.',
    'I can say what indexing saves and what it costs.',
    'I can explain why a section plane in world space swims, and why a screenshot will not show it.',
    'I can state the rule about calculations that read the camera.',
  ],

  assessment: {
    task: 'Set up a viewer for a real part and justify every numeric choice in the camera and the buffers.',
    acceptance: [
      'A near plane derived from the resolvable separation and the tolerance that matters, not left at a default.',
      'The far plane chosen to contain the scene, with the understanding that it does not affect precision.',
      'Depth test and depth write set deliberately per material, with the purpose named.',
      'An indexed buffer, with vertices duplicated only where the crease angle requires a second normal.',
      'Any section plane stored in the part’s frame, or the camera orbited instead.',
      'Every camera-reading calculation driven by camera events.',
    ],
  },

  quiz: [
    {
      question: 'What does the depth buffer store?',
      options: [
        'A function of 1/d — ((f+n) − 2fn/d)/(f−n)',
        'The camera-space distance d, scaled into 0…1',
        'The distance along the view direction, linearly',
        'The squared distance, for speed',
      ],
      answer: 0,
      explanation: 'The same divide that produces perspective in x and y also divides z. Everything else in this lesson follows from that.',
    },
    {
      question: 'Ten times further from the camera. How much worse is depth precision?',
      options: [
        'A hundred times — it falls as d squared',
        'Ten times — linearly',
        'Unchanged — the buffer is uniform',
        'It depends on the field of view',
      ],
      answer: 0,
      explanation: 'Measured: 5.96e-05 at 10 units, 5.96e-03 at 100 units.',
    },
    {
      question: 'Your part flickers. Which plane do you move?',
      options: [
        'The near plane — worth 101×, against the far plane’s 1.00×',
        'The far plane — pulling it in tightens the range',
        'Either; they have equal effect',
        'Neither; the geometry must be fixed',
      ],
      answer: 0,
      explanation: 'Δ ∝ 1/n − 1/f, so for f ≫ n the far term is negligible. Measured, far 1000 → 100 changes nothing to two decimal places.',
    },
    {
      question: 'How many useful combinations of depth test and depth write are there?',
      options: [
        'Four — they are two independent switches, each combination with a purpose',
        'One — they are the same setting',
        'Two — on and off',
        'Unbounded, which is why materials multiply',
      ],
      answer: 0,
      explanation: 'The map records an application that ended up with four highlight materials differing in nothing else, because the combinations were found one at a time.',
    },
    {
      question: 'What does indexing an indexed buffer cost?',
      options: [
        'One normal per vertex — so a vertex on a crease needs duplicating anyway',
        'Nothing; it is a pure saving',
        'Extra draw calls',
        'Precision in the vertex positions',
      ],
      answer: 0,
      explanation: 'Averaging across a 90° rim puts the normal 33.97° out. The fix duplicates the rim vertices, using lesson 16A’s crease angle to decide where.',
    },
    {
      question: 'A section plane left in world space while the orbit rotates the model. What happens?',
      options: [
        'It removes 25% of the part at one angle and 0% at another — and looks correct head-on',
        'Nothing; the maths is equivalent',
        'The cut disappears entirely',
        'The part is clipped away completely',
      ],
      answer: 0,
      explanation: 'Measured variation: 6.008 cubic inches on a 6×2×2 plate. Both schemes agree exactly at 0°, so a screenshot proves nothing.',
    },
    {
      question: 'A label moves on screen when data is recalculated but the camera has not moved. What rule was broken?',
      options: [
        'If a calculation reads the camera, it must be driven by camera events — never by a data event',
        'Labels should be in world space',
        'Screen-space passes should run every frame',
        'Render order must be set on the parent group',
      ],
      answer: 0,
      explanation: 'Anchoring a label is a world problem; de-overlapping labels is a screen problem. Mixing them makes a data change look like the view breaking.',
    },
  ],
};
