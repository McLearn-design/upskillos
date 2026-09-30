// Mesh Engine 4.2 — Colour as Information
//
// LearningPath section 18. "Learn the distinction between colour used for
// appearance and colour used to communicate data."
//
// Every number quoted was produced by field-fixes/verify/check-colour.py, which
// uses CIE76 (Euclidean distance in CIELAB) rather than CIEDE2000 — stated in
// the lesson too, because CIE76 overstates differences among saturated colours,
// so every "distinguishable" count here is if anything optimistic.
//
// Three of that script's claims were wrong first. All three are taught.

const LESSON_MESH_4_2 = {
  title: 'Colour as Information',
  subtitle: 'A picture that looks informative and is not.',
  sequential: true,

  cells: [

    {
      type: 'markdown',
      instruction: `### The last step, and the one that can lie

Lesson 17 got the mesh on screen correctly. This one decides what it *says*.

There are two entirely different jobs a colour can do:

\`\`\`
colour for appearance      make the part look like a part
colour for information     make the reader able to answer a question
\`\`\`

The first is a matter of taste. The second is a measurement problem, and it can
be **wrong** in ways that look fine — which is the only reason this is a lesson
rather than a preference.

Four things get measured here, and one of them overturned what I expected.

#### First, the tool

Perceptual distance below is **CIE76** — Euclidean distance in CIELAB — not
CIEDE2000. CIE76 overstates differences among saturated colours, so every
"distinguishable" count here is **optimistic**. A just-noticeable difference is
about **2.3**.

Said plainly rather than quietly, because a buggy CIEDE2000 would be worse than
an honest CIE76, and none of the conclusions turn on the difference.

The conversion is checked before it is used: white lands at \`L* = 100\`, black at
\`L* = 0\`, and 50% sRGB grey at \`L* = 53.39\` — the known value, which confirms the
gamma curve rather than assuming it.`,
    },

    {
      type: 'js',
      instruction: `### Two ramps, the same data

Below, a deviation measurement — say the distance a surface moved — coloured two
ways. The top strip is a **hue rainbow**, the classic. The bottom is a ramp built
to be perceptually uniform.

The chart under them plots the **perceived** step between each pair of adjacent
samples. A ramp that tells the truth is flat there.

**Predict before you look:** with equal steps in the *data* all the way across,
where do you expect the rainbow's perceived steps to be biggest?

Then drag the **threshold** marker. It sits at a real value in the data. Ask
yourself, on each strip, whether you could have found it by eye.`,
      html: `<div style="padding:8px 2px;font:11px ui-monospace,monospace;color:#7d8794;display:grid;grid-template-columns:auto 1fr auto;gap:5px 10px;align-items:center">
  <span>threshold at</span><input id="thr" type="range" min="0" max="1" step="0.005" value="0.62"><span id="thrv">0.62</span>
</div>
<canvas id="c" style="width:100%;height:250px;background:#0a0f1e;border-radius:8px"></canvas>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:8px 2px;white-space:pre"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `// ── sRGB -> CIELAB, so "how different do these look" can be a number ────
function srgbToLinear(c) {
  return c <= 0.04045 ? c/12.92 : Math.pow((c + 0.055)/1.055, 2.4);
}
function linearToSrgb(c) {
  c = Math.max(0, Math.min(1, c));
  return c <= 0.0031308 ? c*12.92 : 1.055*Math.pow(c, 1/2.4) - 0.055;
}
var M = [[0.4123908,0.3575843,0.1804808],
         [0.2126390,0.7151687,0.0721923],
         [0.0193308,0.1191948,0.9505322]];
var WHITE = [M[0][0]+M[0][1]+M[0][2], M[1][0]+M[1][1]+M[1][2], M[2][0]+M[2][1]+M[2][2]];

function rgbToLab(rgb) {
  var lin = rgb.map(srgbToLinear);
  var xyz = [0,1,2].map(function (i) {
    return M[i][0]*lin[0] + M[i][1]*lin[1] + M[i][2]*lin[2];
  });
  var d = 6/29;
  var f = xyz.map(function (v, i) {
    var t = v / WHITE[i];
    return t > d*d*d ? Math.cbrt(t) : t/(3*d*d) + 4/29;
  });
  return [116*f[1] - 16, 500*(f[0]-f[1]), 200*(f[1]-f[2])];
}

// CIE76. Overstates saturated differences, so counts below are optimistic.
function deltaE(c1, c2) {
  var a = rgbToLab(c1), b = rgbToLab(c2);
  return Math.sqrt(Math.pow(a[0]-b[0],2) + Math.pow(a[1]-b[1],2) + Math.pow(a[2]-b[2],2));
}

function hsvToRgb(h, s, v) {
  h = ((h % 1) + 1) % 1;
  var i = Math.floor(h*6), f = h*6 - i;
  var p = v*(1-s), q = v*(1-s*f), t = v*(1-s*(1-f));
  return [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i % 6];
}

// A perceptually uniform ramp, built in Lab rather than borrowed: lightness
// rises steadily while the hue angle turns a little.
function labToRgb(L, a, b) {
  var fy = (L + 16)/116, fx = fy + a/500, fz = fy - b/200;
  var d = 6/29;
  function inv(t) { return t > d ? t*t*t : 3*d*d*(t - 4/29); }
  var xyz = [inv(fx)*WHITE[0], inv(fy)*WHITE[1], inv(fz)*WHITE[2]];
  // inverse of M, computed once
  var Mi = [[ 3.2409699,-1.5373832,-0.4986108],
            [-0.9692436, 1.8759675, 0.0415551],
            [ 0.0556301,-0.2039770, 1.0569715]];
  return [0,1,2].map(function (i) {
    return linearToSrgb(Mi[i][0]*xyz[0] + Mi[i][1]*xyz[1] + Mi[i][2]*xyz[2]);
  });
}

var N = 256;
var rainbow = [], uniform = [];
for (var k = 0; k < N; k++) {
  var u = k/(N-1);
  rainbow.push(hsvToRgb(0.667*(1-u), 1, 1));
  var ang = (300 - 60*u) * Math.PI/180;
  uniform.push(labToRgb(20 + 70*u, 45*Math.cos(ang), 45*Math.sin(ang)));
}

function steps(ramp) {
  var out = [];
  for (var i = 0; i < ramp.length-1; i++) out.push(deltaE(ramp[i], ramp[i+1]));
  return out;
}
var rbSteps = steps(rainbow), unSteps = steps(uniform);

var canvas = document.getElementById('c');
var ctx = canvas.getContext('2d');
function sizeCanvas() {
  canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
  canvas.height = 250 * (window.devicePixelRatio || 1);
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
}
sizeCanvas();

function css(c) {
  return 'rgb(' + c.map(function (v) {
    return Math.round(Math.max(0, Math.min(1, v))*255); }).join(',') + ')';
}

function draw() {
  var thr = Number(document.getElementById('thr').value);
  document.getElementById('thrv').textContent = thr.toFixed(2);
  var W = canvas.clientWidth, H = 250, PAD = 8;
  ctx.clearRect(0, 0, W, H);

  var bw = (W - 2*PAD)/N;
  [['hue rainbow', rainbow, 18], ['uniform in Lab', uniform, 74]].forEach(function (row) {
    for (var k = 0; k < N; k++) {
      ctx.fillStyle = css(row[1][k]);
      ctx.fillRect(PAD + k*bw, row[2], bw + 0.6, 40);
    }
    ctx.fillStyle = '#9fb8e0'; ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(row[0], PAD, row[2] - 4);
    var tx = PAD + thr*(W - 2*PAD);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tx, row[2]-1); ctx.lineTo(tx, row[2]+41); ctx.stroke();
  });

  // perceived step per sample, both ramps on one axis
  var top = 132, ht = 96;
  var peak = Math.max.apply(null, rbSteps);
  ctx.fillStyle = '#7d8794'; ctx.font = '10px ui-monospace, monospace';
  ctx.fillText('perceived step between adjacent samples (flat = honest)', PAD, top - 4);
  [['#c2703a', rbSteps], ['#5c9ce0', unSteps]].forEach(function (s) {
    ctx.strokeStyle = s[0]; ctx.lineWidth = 1.4;
    ctx.beginPath();
    s[1].forEach(function (v, i) {
      var x = PAD + i*bw, y = top + ht - (v/peak)*ht;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });
  ctx.strokeStyle = '#3a4152'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD, top+ht); ctx.lineTo(W-PAD, top+ht); ctx.stroke();

  var i = Math.min(N-2, Math.round(thr*(N-1)));
  document.getElementById('out').textContent = [
    'at this point in the data, one step of data looks like:',
    '  hue rainbow     ' + rbSteps[i].toFixed(3)
      + '   (' + (rbSteps[i]/(rbSteps.reduce(function(a,b){return a+b;})/rbSteps.length)).toFixed(1)
      + 'x its own average)',
    '  uniform in Lab  ' + unSteps[i].toFixed(3),
    '',
    'over the whole ramp:',
    '  rainbow  smallest step ' + Math.min.apply(null, rbSteps).toFixed(3)
      + ', largest ' + Math.max.apply(null, rbSteps).toFixed(3)
      + '  -> ' + (Math.max.apply(null,rbSteps)/Math.min.apply(null,rbSteps)).toFixed(0) + 'x',
    '  uniform  smallest step ' + Math.min.apply(null, unSteps).toFixed(3)
      + ', largest ' + Math.max.apply(null, unSteps).toFixed(3)
      + '  -> ' + (Math.max.apply(null,unSteps)/Math.min.apply(null,unSteps)).toFixed(1) + 'x',
  ].join('\\n');
}

document.getElementById('thr').addEventListener('input', draw);
window.addEventListener('resize', function () { sizeCanvas(); draw(); });
draw();`,
      outputHeight: 560,
    },

    {
      type: 'markdown',
      instruction: `### RGB distance is not perceptual distance

Before anything about ramps, the foundation. Twenty thousand pairs of colours,
**every one exactly 0.10 apart in RGB**:

\`\`\`
perceived difference   1.22  to  29.85
a spread of            24.4x   for an identical RGB step
\`\`\`

So a palette spaced evenly in RGB is **not** evenly spaced to a reader. At the
same RGB step, some pairs are nearly the same colour and others are obviously
different.

Which means every intuition built on "I moved the red channel by 20" is
unreliable, and any palette that matters has to be spaced in a space where
distance means something.

### A rainbow invents boundaries and hides variation

Same data, equal steps all the way across:

| ramp | total path | smallest step | largest step | ratio |
|---|---|---|---|---|
| hue rainbow | 455.1 | 0.1161 | 3.2419 | **27.9×** |
| uniform in Lab | 101.6 | 0.3309 | 0.6159 | 1.9× |

**The rainbow's perceived step varies by 28×** across a ramp whose data steps are
identical. Two consequences, both bad:

- **Where the steps are largest, a reader sees an edge that is not in the data.**
  Measured, there are **2 distinct apparent boundaries**, at **12.2%** and
  **80.8%** of the range.
- **Where they are smallest, real variation is invisible** — down to 0.116 per
  step, **15× flatter than average**.

A reader asked *"where does this go out of tolerance?"* will point at one of
those two boundaries. Lesson 11 spent an entire lesson establishing that the
threshold is somewhere else entirely — and then the colour ramp moves it.

Note also the total path length: **455.1 against 101.6**. The rainbow spends four
and a half times as much perceptual "distance" to represent the same data, which
is why it looks vivid and reads badly. Vividness is not information.`,
    },

    {
      type: 'markdown',
      instruction: `### What an operation palette looks like to a dichromat

Roughly **8% of men** have a red-green deficiency. An 8-colour palette of evenly
spaced hues — the obvious way to colour an operation list — simulated through
each one:

| vision | pairs below the JND | closest pair |
|---|---|---|
| normal | 0 | 26.52 |
| protanopia | 0 | 11.40 |
| deuteranopia | 0 | **2.60** |
| tritanopia | **2** | **0.00** |

Under tritanopia, two pairs become **exactly identical** — 0.00 apart. Under
deuteranopia the closest pair falls from 26.52 to **2.60**, which is a **10×
reduction** and sits right on the just-noticeable difference.

**Evenly spaced hues are the obvious construction and the worst one**, because
hue is precisely the axis a dichromat loses.

> The normal-vision row can look perfect while another row does not. **A palette
> checked by the person who chose it is not checked.**

#### The fix is lightness, because lightness survives

| vision | hue-only | lightness varied |
|---|---|---|
| normal | 26.52 | 25.81 |
| protanopia | 11.40 | 3.47 |
| deuteranopia | 2.60 | **5.79** |
| tritanopia | **0.00** | **4.18** |

\`\`\`
worst case across all three deficiencies
  hue only          0.00
  lightness varied  3.47
\`\`\`

Not a triumph — 3.47 is only just above the JND — but it is the difference
between *hard to tell apart* and *the same colour*. And note the normal-vision
column barely moved: **the cost of making a palette robust was 26.52 → 25.81.**

Almost nothing. The hue-only palette was not buying anything with the
distinctness it gave up.`,
    },

    {
      type: 'markdown',
      instruction: `### How many categories fit — and the answer I got wrong

I expected normal vision to run out of distinguishable colours somewhere around
a dozen. **It does not**, and the measurement says so plainly.

Palettes built by farthest-point sampling in Lab, then simulated through each
deficiency:

| categories | normal | protan | deuteran | tritan | worst |
|---|---|---|---|---|---|
| 4 | 108.8 | 51.4 | 28.5 | 82.8 | 28.5 |
| **6** | 87.6 | 34.3 | 8.4 | **0.0** | **0.0** |
| 8 | 62.7 | 33.6 | 8.4 | 0.0 | 0.0 |
| 16 | 43.4 | 6.5 | 8.4 | 0.0 | 0.0 |
| 32 | **30.9** | 2.2 | 0.4 | 0.0 | 0.0 |

**With normal vision, 32 well-spaced colours are still 30.9 apart** — thirteen
times the just-noticeable difference. Normal vision is nowhere near the limit.

**The limit is colour-vision deficiency, and it arrives at 6 categories.**

That is a very different design constraint from the one I assumed. It does not
say "use fewer colours because eyes are limited". It says **the palette that
works for you keeps working long after it has stopped working for one reader in
twelve**, and no amount of care with *your* perception will reveal it.

A part with forty operations cannot be coloured one-per-operation for every
reader. Pretending otherwise produces a picture that looks informative and is
not.`,
    },

    {
      type: 'markdown',
      instruction: `### But the forty-way palette was never the problem

Two neighbouring regions in the same colour read as **one** region. Two regions
on opposite sides of the part in the same colour read as two regions that happen
to match.

So the requirement is not "every region a different colour". It is **every region
different from its neighbours** — which is graph colouring on the region
adjacency.

Measured on a 480-face plate with 20 regions:

| layout | regions | max neighbours | greedy, index order | greedy, busiest first |
|---|---|---|---|---|
| a 5×4 patchwork | 20 | 4 | 2 | 2 |
| **irregular regions** | 20 | 7 | 5 | **4** |

The patchwork is a checkerboard, so its answer is arithmetic rather than a
finding — worth saying, because it is the layout a test would reach for first.
The irregular layout is the one to quote, and real operation regions are not laid
out on a grid.

**20 regions, 4 colours, no two neighbours alike.**

Which resolves the previous section entirely. Four colours can be spaced properly
— robustly, across every deficiency — where twenty cannot. Note also that
ordering the greedy pass by busiest-region-first got 4 where index order got 5:
the same algorithm, a different traversal, one fewer colour.

#### And the trade, because there is one

**A colour no longer identifies a region on its own.** Two regions share one
deliberately, so:

- the legend cannot be "blue = operation 3"
- the colour separates regions **locally**, and something else has to name them
- clicking a face must report which region it is, because the colour cannot

That is a real cost, paid to get a palette that works for every reader. It is
the same shape of trade as lesson 12's contested faces: you can have a simple
answer or an honest one.`,
    },

    {
      type: 'challenge',
      instruction: `### 🎯 Measure a palette before trusting it

Two functions.

\`perceivedDistance(rgb1, rgb2)\` — CIE76 distance between two sRGB colours,
each \`[r, g, b]\` in 0…1. Convert through linear RGB and XYZ to CIELAB (D65),
then take the Euclidean distance. The gamma step is not optional: it is what
makes 50% grey land at \`L* = 53.39\` rather than 50.

\`auditPalette(palette, simulate)\` — return
\`{ closest, closestPair, belowJND }\` for a palette, where \`simulate\` is a
function mapping one colour to how it appears to a given reader (pass
\`null\` for normal vision). \`closest\` is the smallest perceived distance
between any two entries, \`closestPair\` is their indices \`[i, j]\` with
\`i < j\`, and \`belowJND\` counts pairs closer than **2.3**.

It is checked against known landmarks — white to black is 100, 50% grey is
\`L* 53.39\` — and against a hue palette whose collapse under simulation is
already measured.`,
      html: `<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:10px;white-space:pre;background:#0a0f1e;border-radius:8px;min-height:240px"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `// TODO 1: CIE76 distance between two sRGB colours.
function perceivedDistance(rgb1, rgb2) {

  // your code here

  return 0;
}

// TODO 2: audit a palette. simulate === null means normal vision.
function auditPalette(palette, simulate) {

  // your code here

  return { closest: 0, closestPair: [0, 1], belowJND: 0 };
}

// ── it runs itself below ──────────────────────────────────────────────────
function hsvToRgb(h, s, v) {
  h = ((h % 1) + 1) % 1;
  var i = Math.floor(h*6), f = h*6 - i;
  var p = v*(1-s), q = v*(1-s*f), t = v*(1-s*(1-f));
  return [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i % 6];
}
// Vienot, Brettel & Mollon (1999), via LMS.
var R2L = [[17.8824,43.5161,4.11935],[3.45565,27.1554,3.86714],
           [0.0299566,0.184309,1.46709]];
var L2R = [[0.0809,-0.1305,0.1167],[-0.0102,0.0540,-0.1136],
           [-0.0004,-0.0041,0.6935]];
var PLANES = {
  protanopia:   [[0,2.02344,-2.52581],[0,1,0],[0,0,1]],
  deuteranopia: [[1,0,0],[0.494207,0,1.24827],[0,0,1]],
  tritanopia:   [[1,0,0],[0,1,0],[-0.395913,0.801109,0]],
};
function mul3(Mx, v) {
  return [0,1,2].map(function (i) {
    return Mx[i][0]*v[0] + Mx[i][1]*v[1] + Mx[i][2]*v[2]; });
}
function makeSim(kind) {
  return function (rgb) {
    var lin = rgb.map(function (c) {
      return c <= 0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); });
    var out = mul3(L2R, mul3(PLANES[kind], mul3(R2L, lin)));
    return out.map(function (c) {
      c = Math.max(0, Math.min(1, c));
      return c <= 0.0031308 ? c*12.92 : 1.055*Math.pow(c, 1/2.4) - 0.055; });
  };
}

var K = 8, palette = [];
for (var i = 0; i < K; i++) palette.push(hsvToRgb(i/K, 0.75, 0.9));

var lines = ['  white to black: ' + perceivedDistance([1,1,1],[0,0,0]).toFixed(2)];
lines.push('');
lines.push('  AN 8-COLOUR HUE PALETTE');
lines.push('            vision   closest   pair   below JND');
[['normal', null], ['protanopia', makeSim('protanopia')],
 ['deuteranopia', makeSim('deuteranopia')], ['tritanopia', makeSim('tritanopia')]
].forEach(function (c) {
  var r = auditPalette(palette, c[1]);
  lines.push('    ' + c[0].padStart(14) + '   ' + r.closest.toFixed(2).padStart(7)
    + '   ' + ('(' + r.closestPair.join(',') + ')').padStart(6)
    + '   ' + String(r.belowJND).padStart(9));
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
            body + '\nreturn { perceivedDistance, auditPalette };',
          )(doc, { log() {} });
        } catch (e) { return no('The code did not run: ' + e.message); }
        for (const n of ['perceivedDistance', 'auditPalette']) {
          if (typeof fn[n] !== 'function') return no(n + ' is not a function.');
        }

        // Reference conversion.
        const toLin = (c) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        const M = [[0.4123908, 0.3575843, 0.1804808],
                   [0.2126390, 0.7151687, 0.0721923],
                   [0.0193308, 0.1191948, 0.9505322]];
        const WH = M.map((r) => r[0] + r[1] + r[2]);
        const lab = (rgb) => {
          const lin = rgb.map(toLin);
          const xyz = [0, 1, 2].map((i) => M[i][0] * lin[0] + M[i][1] * lin[1] + M[i][2] * lin[2]);
          const d = 6 / 29;
          const f = xyz.map((v, i) => {
            const t = v / WH[i];
            return t > d * d * d ? Math.cbrt(t) : t / (3 * d * d) + 4 / 29;
          });
          return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
        };
        const ref = (a, b) => {
          const p = lab(a), q = lab(b);
          return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
        };

        // Landmarks that pin the conversion down.
        const wk = fn.perceivedDistance([1, 1, 1], [0, 0, 0]);
        if (typeof wk !== 'number' || !Number.isFinite(wk)) {
          return no('perceivedDistance returned ' + wk + ' for white against black.');
        }
        if (Math.abs(wk - 100) > 0.01) {
          return no('White against black came out ' + wk.toFixed(3)
            + ', and it must be exactly 100 — that is the definition of the L* '
            + 'axis. If you got about 149, the a* and b* terms are non-zero for '
            + 'a neutral colour, which means the white point is wrong.');
        }
        const greyL = fn.perceivedDistance([0.5, 0.5, 0.5], [0, 0, 0]);
        if (Math.abs(greyL - 53.39) > 0.05) {
          if (Math.abs(greyL - 76.07) < 1.0 || Math.abs(greyL - 50) < 1.0) {
            return no('50% sRGB grey came out ' + greyL.toFixed(2)
              + ', which means the gamma step was skipped — you treated the sRGB '
              + 'value as linear light (that gives 76.07) or as a lightness '
              + 'directly (that gives 50). It should be 53.39: sRGB is encoded '
              + 'with a curve, and undoing it is what makes every distance in '
              + 'this lesson mean something.');
          }
          return no('50% sRGB grey came out ' + greyL.toFixed(3)
            + ', expected 53.39 — the known value, which is what confirms the '
            + 'gamma curve rather than assuming it.');
        }

        const rng = (() => { let s = 7; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; })();
        for (let i = 0; i < 300; i++) {
          const a = [rng(), rng(), rng()], b = [rng(), rng(), rng()];
          const got = fn.perceivedDistance(a, b), want = ref(a, b);
          if (Math.abs(got - want) > 1e-6) {
            return no('On a random pair you returned ' + got.toFixed(4)
              + ' but CIE76 gives ' + want.toFixed(4) + '.');
          }
        }
        // Symmetric and zero on identity.
        if (fn.perceivedDistance([0.2, 0.7, 0.4], [0.2, 0.7, 0.4]) > 1e-9) {
          return no('A colour against itself must be 0.');
        }

        // auditPalette on a hue palette whose behaviour is measured.
        const hsv = (h, s, v) => {
          h = ((h % 1) + 1) % 1;
          const i = Math.floor(h * 6), f = h * 6 - i;
          const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
          return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
        };
        const palette = Array.from({ length: 8 }, (_, i) => hsv(i / 8, 0.75, 0.9));

        const refAudit = (pal, sim) => {
          const P = sim ? pal.map(sim) : pal;
          let closest = Infinity, pair = [0, 1], below = 0;
          for (let i = 0; i < P.length; i++) {
            for (let j = i + 1; j < P.length; j++) {
              const d = ref(P[i], P[j]);
              if (d < 2.3) below++;
              if (d < closest) { closest = d; pair = [i, j]; }
            }
          }
          return { closest, closestPair: pair, belowJND: below };
        };

        let got;
        try { got = fn.auditPalette(palette, null); } catch (e) {
          return no('auditPalette threw on normal vision: ' + e.message);
        }
        if (!got || typeof got.closest !== 'number' || !Array.isArray(got.closestPair)
            || typeof got.belowJND !== 'number') {
          return no('auditPalette should return { closest, closestPair, belowJND }. '
            + 'Got ' + JSON.stringify(got) + '.');
        }
        const wantN = refAudit(palette, null);
        if (Math.abs(got.closest - wantN.closest) > 1e-6) {
          const furthest = (() => {
            let m = 0;
            for (let i = 0; i < palette.length; i++) {
              for (let j = i + 1; j < palette.length; j++) m = Math.max(m, ref(palette[i], palette[j]));
            }
            return m;
          })();
          if (Math.abs(got.closest - furthest) < 1e-6) {
            return no('You returned the FURTHEST pair, not the closest. The audit '
              + 'question is "can any two be confused", so the smallest distance '
              + 'is the one that matters — a palette is only as good as its worst '
              + 'pair.');
          }
          return no('On normal vision closest came out ' + got.closest.toFixed(3)
            + ', expected ' + wantN.closest.toFixed(3) + '.');
        }
        if (got.closestPair[0] >= got.closestPair[1]) {
          return no('closestPair came out [' + got.closestPair.join(', ')
            + ']; it should be [i, j] with i < j.');
        }
        if (Math.abs(ref(palette[got.closestPair[0]], palette[got.closestPair[1]])
                     - wantN.closest) > 1e-6) {
          return no('closestPair [' + got.closestPair.join(', ') + '] is not the '
            + 'pair at distance ' + wantN.closest.toFixed(3) + '.');
        }

        // Simulation must be applied before measuring, not after.
        const R2L = [[17.8824, 43.5161, 4.11935], [3.45565, 27.1554, 3.86714],
                     [0.0299566, 0.184309, 1.46709]];
        const L2R = [[0.0809, -0.1305, 0.1167], [-0.0102, 0.0540, -0.1136],
                     [-0.0004, -0.0041, 0.6935]];
        const PL = {
          protanopia: [[0, 2.02344, -2.52581], [0, 1, 0], [0, 0, 1]],
          deuteranopia: [[1, 0, 0], [0.494207, 0, 1.24827], [0, 0, 1]],
          tritanopia: [[1, 0, 0], [0, 1, 0], [-0.395913, 0.801109, 0]],
        };
        const mul = (Mx, v) => [0, 1, 2].map((i) => Mx[i][0] * v[0] + Mx[i][1] * v[1] + Mx[i][2] * v[2]);
        const mkSim = (kind) => (rgb) => {
          const lin = rgb.map(toLin);
          const out = mul(L2R, mul(PL[kind], mul(R2L, lin)));
          return out.map((c) => {
            c = Math.max(0, Math.min(1, c));
            return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
          });
        };

        for (const kind of ['protanopia', 'deuteranopia', 'tritanopia']) {
          const sim = mkSim(kind);
          let g;
          try { g = fn.auditPalette(palette, sim); } catch (e) {
            return no('auditPalette threw with a ' + kind + ' simulation: ' + e.message);
          }
          const w = refAudit(palette, sim);
          if (Math.abs(g.closest - w.closest) > 1e-6) {
            if (Math.abs(g.closest - wantN.closest) < 1e-6) {
              return no('With a ' + kind + ' simulation you returned the same answer '
                + 'as normal vision, so the simulate function was never applied. '
                + 'Map every colour through it BEFORE measuring — the whole point '
                + 'is that the palette is different for that reader.');
            }
            return no('With a ' + kind + ' simulation closest came out '
              + g.closest.toFixed(3) + ', expected ' + w.closest.toFixed(3) + '.');
          }
          if (g.belowJND !== w.belowJND) {
            return no('With a ' + kind + ' simulation belowJND came out '
              + g.belowJND + ', expected ' + w.belowJND
              + ' — pairs strictly closer than 2.3.');
          }
        }

        // And the finding must actually be reachable: tritanopia collapses pairs.
        const trit = fn.auditPalette(palette, mkSim('tritanopia'));
        if (trit.belowJND === 0) {
          return no('Internal check: the tritanopia simulation should collapse at '
            + 'least one pair on this palette.');
        }

        return {
          pass: true,
          message: 'The gamma step is there, so 50% grey lands at 53.39 rather than '
            + '50; the audit reports the WORST pair rather than the best; and the '
            + 'simulation is applied before measuring rather than after. That last '
            + 'one is the whole technique — a palette checked by the person who '
            + 'chose it is not checked.',
        };
      },
      successMessage: '✓ Audited, including for readers who are not you.',
      failMessage: '✗ Not yet.',
      outputHeight: 440,
    },

  ],
};

const PY_CELLS = [
  {
    id: 'space',
    cellTitle: 'A colour space where distance means something',
    prose: [
      'Every claim in this lesson is a distance between two colours, so the conversion producing that distance has to be right before anything else is measured. sRGB values are encoded with a gamma curve, so they are not proportional to light; undoing that curve, converting to XYZ, and then to CIELAB gives a space where Euclidean distance approximates how different two colours look.',
      'Check it against landmarks rather than trusting it. White must land at L* 100 and black at L* 0, both perfectly neutral. And 50% sRGB grey must land at L* 53.39 - a known value, and the one that confirms the gamma step actually happened. Skip the gamma and it comes out near 50 instead, which looks plausible and is wrong.',
      'A note on the metric: this is CIE76, plain Euclidean distance in Lab, not CIEDE2000. CIE76 overstates differences among saturated colours, so every distinguishability count below is optimistic. That is said rather than hidden, because a buggy CIEDE2000 would be worse than an honest CIE76 and none of the conclusions turn on the difference. A just-noticeable difference is about 2.3.',
    ],
    code: `import numpy as np

JND = 2.3

def srgb_to_linear(c):
    c = np.asarray(c, float)
    return np.where(c <= 0.04045, c/12.92, ((c + 0.055)/1.055)**2.4)

def linear_to_srgb(c):
    c = np.clip(np.asarray(c, float), 0, 1)
    return np.where(c <= 0.0031308, c*12.92, 1.055*c**(1/2.4) - 0.055)

M_RGB2XYZ = np.array([[0.4123908, 0.3575843, 0.1804808],
                      [0.2126390, 0.7151687, 0.0721923],
                      [0.0193308, 0.1191948, 0.9505322]])
WHITE = M_RGB2XYZ @ np.ones(3)          # D65

def rgb_to_lab(rgb):
    xyz = srgb_to_linear(rgb) @ M_RGB2XYZ.T
    t = xyz / WHITE
    d = 6/29
    f = np.where(t > d**3, np.cbrt(t), t/(3*d*d) + 4/29)
    return np.stack([116*f[...,1] - 16,
                     500*(f[...,0] - f[...,1]),
                     200*(f[...,1] - f[...,2])], axis=-1)

def delta_e(c1, c2):
    """CIE76."""
    return np.linalg.norm(rgb_to_lab(c1) - rgb_to_lab(c2), axis=-1)

print('landmarks that pin the conversion down:')
print(f'  white -> {np.round(rgb_to_lab(np.array([1.0,1,1])), 4)}')
print(f'  black -> {np.round(rgb_to_lab(np.array([0.0,0,0])), 4)}')
print(f'  50% sRGB grey -> L* {rgb_to_lab(np.array([0.5,0.5,0.5]))[0]:.4f}'
      f'   (known value 53.39)')
print()
print('Without undoing the gamma curve that last one comes out near 50, which')
print('looks plausible and is wrong - so it is the check worth having.')
print()
print(f'white to black: {delta_e(np.array([1.0,1,1]), np.array([0.0,0,0])):.4f}')
print('which is 100 by definition of the L* axis.')`,
  },
  {
    id: 'rgb',
    cellTitle: 'RGB distance is not perceptual distance',
    prose: [
      'The foundation for everything else. Take pairs of colours that are exactly the same distance apart in RGB, and measure how far apart they actually look.',
      'If RGB distance were perceptual distance, every pair would come back the same. Measure the spread instead of assuming, because the size of it decides whether a palette can be built by nudging channels.',
      'This is why any palette that matters has to be spaced in a space where distance means something, and why an intuition built on "I moved the red channel by 20" cannot be trusted.',
    ],
    code: `rng = np.random.default_rng(11)
STEP = 0.10

pairs = []
while len(pairs) < 20000:
    a = rng.random(3)
    d = rng.normal(size=3); d /= np.linalg.norm(d)
    b = a + d*STEP
    if np.all((b >= 0) & (b <= 1)):
        pairs.append((a, b))
A = np.array([p[0] for p in pairs]); B = np.array([p[1] for p in pairs])
de = delta_e(A, B)

print(f'{len(pairs):,} pairs, every one exactly {STEP} apart in RGB')
print()
print(f'  perceived difference   {de.min():.2f} to {de.max():.2f}')
print(f'  a spread of            {de.max()/de.min():.1f}x')
print(f'  below the JND of {JND}   {100*(de < JND).mean():.1f}%')
print()
print('At an identical RGB step, some pairs are nearly the same colour and')
print('others are obviously different. A palette spaced evenly in RGB is not')
print('evenly spaced to a reader.')`,
  },
  {
    id: 'ramp',
    cellTitle: 'What a rainbow does to a scalar',
    prose: [
      'Colouring a deviation measurement with a hue ramp is the default in most viewers. Equal steps in the data should look like equal steps to the reader; measure whether they do.',
      'Compare against a ramp built to be uniform in Lab - lightness rising steadily while the hue angle turns a little. It is constructed here rather than borrowed so that its uniformity is by construction rather than by reputation.',
      'Then find the peaks. Where the perceived step is largest a reader sees a boundary that is not in the data, and where it is smallest real variation is invisible. Both matter, and the first one matters most because lesson 11 spent a whole lesson putting the threshold somewhere specific.',
    ],
    code: `def hsv_to_rgb(h, s, v):
    h = np.asarray(h, float) % 1.0
    i = np.floor(h*6).astype(int); f = h*6 - i
    p, q, t = v*(1-s), v*(1-s*f), v*(1-s*(1-f))
    out = np.zeros(np.shape(h) + (3,))
    for k, cols in enumerate(((v,t,p),(q,v,p),(p,v,t),(p,q,v),(t,p,v),(v,p,q))):
        m = i == k
        for c in range(3):
            out[...,c] = np.where(m, np.broadcast_to(cols[c], np.shape(h)), out[...,c])
    return out

def lab_to_rgb(lab):
    L, a, b = lab[...,0], lab[...,1], lab[...,2]
    fy = (L + 16)/116; fx, fz = fy + a/500, fy - b/200
    d = 6/29
    inv = lambda t: np.where(t > d, t**3, 3*d*d*(t - 4/29))
    xyz = np.stack([inv(fx), inv(fy), inv(fz)], axis=-1) * WHITE
    return linear_to_srgb(xyz @ np.linalg.inv(M_RGB2XYZ).T)

N = 256
u = np.linspace(0, 1, N)
rainbow = hsv_to_rgb(0.667*(1-u), np.ones(N), np.ones(N))
ang = np.radians(300 - 60*u)
uniform = lab_to_rgb(np.stack([20 + 70*u, 45*np.cos(ang), 45*np.sin(ang)], axis=-1))

print(f"{'ramp':>18} {'total path':>12} {'smallest':>10} {'largest':>10} {'ratio':>8}")
for name, ramp in (('hue rainbow', rainbow), ('uniform in Lab', uniform)):
    st = delta_e(ramp[:-1], ramp[1:])
    print(f'{name:>18} {st.sum():>12.1f} {st.min():>10.4f} {st.max():>10.4f} '
          f'{st.max()/st.min():>7.1f}x')

rb = delta_e(rainbow[:-1], rainbow[1:])
# Distinct peaks, not consecutive samples of one. An earlier version took the
# top four steps and reported 11.4%, 11.8%, 12.2% and 12.5% as four boundaries;
# they are one.
local = [i for i in range(1, len(rb)-1)
         if rb[i] >= rb[i-1] and rb[i] >= rb[i+1] and rb[i] > 1.3*rb.mean()]
peaks = []
for i in sorted(local, key=lambda k: -rb[k]):
    if all(abs(i - j) > len(rb)//12 for j in peaks):
        peaks.append(i)

print()
print(f'{len(peaks)} distinct apparent boundaries the data does not contain:')
for i in sorted(peaks):
    print(f'  at {100*u[i]:.1f}% of the range, step {rb[i]:.3f} '
          f'({rb[i]/rb.mean():.1f}x average)')
print()
print(f'and the flattest stretch runs down to {rb.min():.3f} per step, '
      f'{rb.mean()/rb.min():.0f}x flatter than average - where real variation')
print('is simply invisible.')
print()
print('Note the total path: the rainbow spends four and a half times as much')
print('perceptual distance on the same data. Vividness is not information.')`,
  },
  {
    id: 'cvd',
    cellTitle: 'The palette checked by the person who chose it',
    prose: [
      'Roughly 8% of men have a red-green deficiency. Simulating it is a documented transform - Vienot, Brettel and Mollon (1999): convert to LMS cone responses, project onto the plane the dichromat can represent, convert back.',
      'Audit an eight-colour palette of evenly spaced hues, which is the obvious way to colour an operation list. Look at the closest pair under each kind of vision, because a palette is only as good as its worst pair - the question is whether any two can be confused, not whether most are fine.',
      'Then try the fix. Lightness survives dichromacy, so varying it as well as hue should help. Measure what it costs in the normal-vision column, because a fix that ruins the common case is not a fix.',
    ],
    code: `M_RGB2LMS = np.array([[17.8824, 43.5161, 4.11935],
                      [3.45565, 27.1554, 3.86714],
                      [0.0299566, 0.184309, 1.46709]])
M_LMS2RGB = np.linalg.inv(M_RGB2LMS)
SIM = {'protanopia':   np.array([[0, 2.02344, -2.52581], [0,1,0], [0,0,1]]),
       'deuteranopia': np.array([[1,0,0], [0.494207, 0, 1.24827], [0,0,1]]),
       'tritanopia':   np.array([[1,0,0], [0,1,0], [-0.395913, 0.801109, 0]])}

def simulate(rgb, kind):
    lms = srgb_to_linear(rgb) @ M_RGB2LMS.T
    return linear_to_srgb((lms @ SIM[kind].T) @ M_LMS2RGB.T)

def audit(pal):
    """The worst pair, because that is the one that gets confused."""
    worst, wpair, below = np.inf, None, 0
    for i in range(len(pal)):
        for j in range(i+1, len(pal)):
            d = float(delta_e(pal[i], pal[j]))
            if d < JND: below += 1
            if d < worst: worst, wpair = d, (i, j)
    return worst, wpair, below

K = 8
hue_pal = hsv_to_rgb(np.arange(K)/K, np.full(K, 0.75), np.full(K, 0.9))

# The fix: vary lightness as well, since lightness survives dichromacy.
safe_pal = np.clip(lab_to_rgb(np.stack([
    np.linspace(35, 85, K),
    45*np.cos(np.radians(np.linspace(20, 340, K))),
    45*np.sin(np.radians(np.linspace(20, 340, K)))], axis=-1)), 0, 1)

print(f"{'vision':>14} {'hue closest':>13} {'pair':>7} {'below JND':>10} "
      f"{'lightness-varied':>18}")
for kind in ('normal', 'protanopia', 'deuteranopia', 'tritanopia'):
    p1 = hue_pal if kind == 'normal' else simulate(hue_pal, kind)
    p2 = safe_pal if kind == 'normal' else simulate(safe_pal, kind)
    w1, pair, below = audit(p1)
    w2, _, _ = audit(p2)
    print(f'{kind:>14} {w1:>13.2f} {str(pair):>7} {below:>10} {w2:>18.2f}')

wh = min(audit(simulate(hue_pal, k))[0] for k in SIM)
ws = min(audit(simulate(safe_pal, k))[0] for k in SIM)
print()
print(f'worst case across all three deficiencies: {wh:.2f} for hue only, '
      f'{ws:.2f} varied')
print(f'and the cost in the normal column: {audit(hue_pal)[0]:.2f} -> '
      f'{audit(safe_pal)[0]:.2f}')
print()
print('Almost nothing. The hue-only palette was not buying anything with the')
print('distinctness it gave up. And note that its normal-vision row looks')
print('perfect throughout - a palette checked by the person who chose it is')
print('not checked.')`,
  },
  {
    id: 'count',
    cellTitle: 'How many categories fit, and the answer I expected',
    prose: [
      'I expected normal vision to run out of distinguishable colours somewhere around a dozen, and built this cell to find where. It does not run out, and the measurement says so plainly - which is a better finding than the one I was looking for.',
      'Build palettes by farthest-point sampling in Lab: pick a colour, then repeatedly add whichever candidate is furthest from everything chosen so far. That is a greedy approximation to the best possible spacing, so if it cannot separate the colours nothing can.',
      'Then audit each palette under each deficiency as well as under normal vision. The column that runs out is the finding.',
    ],
    code: `g = np.linspace(0.05, 0.95, 10)
cand = np.array(np.meshgrid(g, g, g, indexing='ij')).reshape(3, -1).T
cand_lab = rgb_to_lab(cand)

def farthest_point_palette(k, seed=0):
    chosen = [seed]
    d = np.linalg.norm(cand_lab - cand_lab[seed], axis=1)
    for _ in range(k-1):
        nxt = int(np.argmax(d)); chosen.append(nxt)
        d = np.minimum(d, np.linalg.norm(cand_lab - cand_lab[nxt], axis=1))
    return cand[chosen]

print(f"{'categories':>11} {'normal':>9} {'protan':>9} {'deuteran':>10} "
      f"{'tritan':>8} {'worst':>8}")
cvd_limit = None
for k in (4, 6, 8, 10, 12, 16, 20, 24, 32):
    pal = farthest_point_palette(k)
    normal = audit(pal)[0]
    per = {kind: audit(simulate(pal, kind))[0] for kind in SIM}
    w = min(per.values())
    if cvd_limit is None and w < 2*JND:
        cvd_limit = k
    print(f'{k:>11} {normal:>9.1f} {per["protanopia"]:>9.1f} '
          f'{per["deuteranopia"]:>10.1f} {per["tritanopia"]:>8.1f} {w:>8.1f}')

n32 = audit(farthest_point_palette(32))[0]
print()
print(f'With NORMAL vision, 32 well-spaced colours are still {n32:.1f} apart -')
print(f'{n32/JND:.0f} times the just-noticeable difference. Normal vision is')
print('nowhere near the limit, and I expected it to be.')
print()
print(f'The limit is colour-vision deficiency, and it arrives at {cvd_limit} categories.')
print()
print('That is a different constraint from the one I assumed. It does not say')
print('"use fewer colours because eyes are limited". It says the palette that')
print('works for you keeps working long after it has stopped working for one')
print('reader in twelve, and no care with YOUR perception will reveal it.')`,
  },
  {
    id: 'adjacency',
    cellTitle: 'The forty-way palette was never the problem',
    prose: [
      'Two neighbouring regions in the same colour read as one region. Two regions on opposite sides of a part in the same colour read as two regions that happen to match. So the requirement is not that every region differs from every other, only that it differs from its neighbours.',
      'That is graph colouring on the region adjacency graph, and greedy colouring solves it well enough. Build the adjacency by walking shared edges, exactly as lesson 3 built face adjacency and lesson 16A used it for the brush.',
      'Measure two layouts. A regular patchwork is a checkerboard and therefore two-colourable by arithmetic rather than by anything interesting - worth including precisely because it is the layout a test would reach for first and would prove nothing. The irregular one is the one to quote.',
    ],
    code: `def plate(nx=20, ny=12):
    verts, index, faces, reg = [], {}, [], []
    def vid(p):
        k = tuple(np.round(p, 9))
        if k not in index:
            index[k] = len(verts); verts.append(k)
        return index[k]
    xs, ys = np.linspace(0, 10, nx+1), np.linspace(0, 6, ny+1)
    for i in range(nx):
        for j in range(ny):
            a = vid((xs[i],ys[j],0.)); b = vid((xs[i+1],ys[j],0.))
            c = vid((xs[i+1],ys[j+1],0.)); d = vid((xs[i],ys[j+1],0.))
            faces += [[a,b,c], [a,c,d]]
            reg += [min(i*5//nx, 4)*4 + min(j*4//ny, 3)]*2
    return np.array(verts, float), np.array(faces), np.array(reg)

V, F, REG_GRID = plate()

def irregular(V, F, nreg=20, seed=3):
    """Nearest-seed assignment. Real operation regions are not on a grid."""
    rng = np.random.default_rng(seed)
    cents = V[F].mean(axis=1)
    seeds = cents[rng.choice(len(cents), size=nreg, replace=False)]
    return np.argmin(np.linalg.norm(cents[:,None,:] - seeds[None,:,:], axis=2), axis=1)

def build_adjacency(F, REG, nreg):
    adj, owner = {r: set() for r in range(nreg)}, {}
    for fi, (a,b,c) in enumerate(F):
        for u, v in ((a,b),(b,c),(c,a)):
            key = (min(u,v), max(u,v))
            if key in owner:
                r1, r2 = int(REG[owner[key]]), int(REG[fi])
                if r1 != r2:
                    adj[r1].add(r2); adj[r2].add(r1)
            else:
                owner[key] = fi
    return adj

def greedy_colour(adj, order):
    colour = {}
    for r in order:
        used = {colour[n] for n in adj[r] if n in colour}
        k = 0
        while k in used: k += 1
        colour[r] = k
    return colour

print(f'  {len(F):,} faces\\n')
print(f"{'layout':>22} {'regions':>9} {'max neighbours':>16} "
      f"{'index order':>13} {'busiest first':>15}")
for label, REG in (('a 5 x 4 patchwork', REG_GRID), ('irregular regions', irregular(V, F))):
    nreg = int(REG.max()) + 1
    adj = build_adjacency(F, REG, nreg)
    a = greedy_colour(adj, list(range(nreg)))
    b = greedy_colour(adj, sorted(range(nreg), key=lambda r: -len(adj[r])))
    clash = sum(1 for r in range(nreg) for n in adj[r] if a[r] == a[n]) \\
          + sum(1 for r in range(nreg) for n in adj[r] if b[r] == b[n])
    assert clash == 0
    print(f'{label:>22} {nreg:>9} {max(len(v) for v in adj.values()):>16} '
          f'{max(a.values())+1:>13} {max(b.values())+1:>15}')

print()
print('The patchwork is a checkerboard, so its answer is arithmetic. The')
print('irregular layout is the finding: 20 regions, 4 colours, no two')
print('neighbours alike - and busiest-first got 4 where index order got 5.')
print()
print('Which resolves the previous cell. Four colours can be spaced robustly')
print('across every deficiency where twenty cannot.')
print()
print('The trade: a colour no longer identifies a region on its own. Two')
print('regions share one deliberately, so the legend cannot say "blue =')
print('operation 3", and clicking a face has to report which region it is.')`,
  },
  {
    id: 'ch-space',
    challengeType: 'write',
    challengeTitle: 'Get the conversion right first',
    difficulty: 'warm-up',
    prompt:
      'Write lab_of(rgb) returning CIELAB for an sRGB colour, and cie76(c1, c2) for the '
      + 'distance between two. Then set landmarks to a list of (label, value) rows proving '
      + 'the conversion is right: white to black, 50% grey lightness, and the a* and b* of a '
      + 'neutral colour.',
    hint:
      'srgb_to_linear, M_RGB2XYZ and WHITE are already in scope. The Lab f() function is '
      + 'cube root above (6/29)^3 and linear below. Undoing the gamma is the step that makes '
      + '50% grey land at 53.39 rather than 50.',
    code: `def lab_of(rgb):
    # TODO
    pass


def cie76(c1, c2):
    # TODO
    pass


landmarks = []
# TODO: (label, value) rows - white-to-black, 50% grey L*, neutral a* and b*

for label, v in landmarks:
    print(f'  {label:<34} {v:.4f}')`,
    solution: `def lab_of(rgb):
    xyz = srgb_to_linear(rgb) @ M_RGB2XYZ.T
    t = xyz / WHITE
    d = 6/29
    f = np.where(t > d**3, np.cbrt(t), t/(3*d*d) + 4/29)
    return np.stack([116*f[...,1] - 16,
                     500*(f[...,0] - f[...,1]),
                     200*(f[...,1] - f[...,2])], axis=-1)


def cie76(c1, c2):
    return float(np.linalg.norm(lab_of(np.asarray(c1, float))
                                - lab_of(np.asarray(c2, float))))


landmarks = [
    ('white to black', cie76([1.0,1,1], [0.0,0,0])),
    ('50% sRGB grey L*', float(lab_of(np.array([0.5,0.5,0.5]))[0])),
    ('50% grey a*', float(lab_of(np.array([0.5,0.5,0.5]))[1])),
    ('50% grey b*', float(lab_of(np.array([0.5,0.5,0.5]))[2])),
    ('white L*', float(lab_of(np.array([1.0,1,1]))[0])),
]

for label, v in landmarks:
    print(f'  {label:<34} {v:.4f}')`,
    testCode: `assert landmarks, "landmarks is empty - nothing was checked."
assert len(landmarks) >= 4, f"only {len(landmarks)} landmarks"

_d = dict(landmarks)
assert abs(cie76([1.0,1,1], [0.0,0,0]) - 100) < 1e-6, (
    f"white to black came out {cie76([1.0,1,1],[0.0,0,0]):.4f} and must be "
    f"exactly 100 - that is the definition of the L* axis. If you got about "
    f"149, a* and b* are non-zero for a neutral colour and the white point is "
    f"wrong.")

_grey = lab_of(np.array([0.5, 0.5, 0.5]))
assert abs(_grey[0] - 53.3890) < 0.01, (
    f"50% sRGB grey came out L* {_grey[0]:.4f}, expected 53.39. If you got "
    f"about 50, the gamma step was skipped - the sRGB value was treated as "
    f"linear light.")
assert abs(_grey[1]) < 1e-9 and abs(_grey[2]) < 1e-9, (
    f"a neutral colour must have a* = b* = 0; got {_grey[1]:.2e}, {_grey[2]:.2e}")

# Agreement with the reference across the whole cube, not just the landmarks.
_rng = np.random.default_rng(5)
for _ in range(500):
    _a, _b = _rng.random(3), _rng.random(3)
    assert abs(cie76(_a, _b) - float(delta_e(_a, _b))) < 1e-9, (
        "cie76 disagrees with delta_e on a random pair")

# Symmetric, and zero on identity.
_a, _b = np.array([0.2,0.7,0.4]), np.array([0.9,0.1,0.3])
assert abs(cie76(_a, _a)) < 1e-12, "a colour against itself must be 0"
assert abs(cie76(_a, _b) - cie76(_b, _a)) < 1e-12, "distance must be symmetric"

# Dark colours must not be crushed - the gamma curve is what prevents it.
assert lab_of(np.array([0.1,0.1,0.1]))[0] > 9.0, (
    "10% sRGB grey should sit near L* 10.4, not near L* 1 - undoing the gamma "
    "is what keeps the dark end from collapsing")
"SUCCESS: 50% grey lands at 53.39 rather than 50, which is the one check that catches a skipped gamma step - and every distance in this lesson depends on it."`,
  },
  {
    id: 'ch-audit',
    challengeType: 'write',
    challengeTitle: 'Audit a palette for readers who are not you',
    difficulty: 'core',
    prompt:
      'Write audit_for(palette, kind) returning (closest, pair, below_jnd) for a palette as '
      + 'seen under a given vision - kind is None for normal vision, or one of the keys of '
      + 'SIM. Then set table to a list of (kind, closest, below_jnd) rows for the hue '
      + 'palette, and set worst_kind to whichever deficiency is hardest on it.',
    hint:
      'simulate(rgb, kind) and audit(pal) are already in scope. The palette must be '
      + 'simulated BEFORE measuring - that is the whole technique. A palette is only as good '
      + 'as its worst pair, so report the minimum distance, not the average.',
    code: `def audit_for(palette, kind):
    # TODO
    pass


table = []
worst_kind = None
# TODO

for kind, closest, below in table:
    print(f'  {str(kind):<14} closest {closest:>6.2f}   below JND {below}')
print('hardest on this palette:', worst_kind)`,
    solution: `def audit_for(palette, kind):
    pal = palette if kind is None else simulate(palette, kind)
    return audit(pal)


table = []
for kind in (None, 'protanopia', 'deuteranopia', 'tritanopia'):
    closest, pair, below = audit_for(hue_pal, kind)
    table.append((kind, closest, below))

worst_kind = min((k for k in SIM), key=lambda k: audit_for(hue_pal, k)[0])

for kind, closest, below in table:
    print(f'  {str(kind):<14} closest {closest:>6.2f}   below JND {below}')
print('hardest on this palette:', worst_kind)`,
    testCode: `assert table, "table is empty - nothing was audited."
assert worst_kind is not None, "worst_kind was never set."
assert len(table) >= 4, f"only {len(table)} rows; cover normal and all three"

_d = {k: (c, b) for k, c, b in table}
assert None in _d, "the table must include normal vision as a baseline"

# Agreement with the reference.
for _kind in (None, 'protanopia', 'deuteranopia', 'tritanopia'):
    _got = audit_for(hue_pal, _kind)
    _want = audit(hue_pal if _kind is None else simulate(hue_pal, _kind))
    assert abs(_got[0] - _want[0]) < 1e-9, (
        f"audit_for({_kind}) gave closest {_got[0]:.4f}, expected {_want[0]:.4f}")
    assert _got[2] == _want[2], f"audit_for({_kind}) below-JND count disagrees"

# The simulation must actually be applied.
assert abs(audit_for(hue_pal, 'tritanopia')[0] - audit_for(hue_pal, None)[0]) > 1.0, (
    "the tritanopia audit matched normal vision, so the simulation was never "
    "applied. Map every colour through it BEFORE measuring - the point is that "
    "the palette is a different palette for that reader.")

# The measured findings.
assert _d[None][0] > 20, (
    f"normal vision closest came out {_d[None][0]:.2f}; the 8-hue palette should "
    f"be about 26.5 apart with normal vision - which is exactly why it looks fine")
assert _d['tritanopia'][1] > 0, (
    "tritanopia should collapse at least one pair below the JND on an evenly "
    "spaced hue palette - hue is the axis a dichromat loses")
assert _d['deuteranopia'][0] < _d[None][0] / 5, (
    f"deuteranopia closest came out {_d['deuteranopia'][0]:.2f} against "
    f"{_d[None][0]:.2f} normal - measured, it falls about tenfold")
assert worst_kind == 'tritanopia', (
    f"worst_kind came out {worst_kind}; on this palette tritanopia collapses a "
    f"pair to 0.00, which is the worst possible")
"SUCCESS: the palette looks perfect to the person who chose it and has two identical pairs for another reader. That is why the audit runs the simulation, not the eye."`,
  },
  {
    id: 'ch-adjacency',
    challengeType: 'write',
    challengeTitle: 'Colour by neighbour, not by count',
    difficulty: 'stretch',
    prompt:
      'Write colours_needed(REG) returning the number of colours a greedy pass needs so no '
      + 'two adjacent regions share one, trying both index order and busiest-first and '
      + 'taking the better. Then set comparison to a list of (label, n_regions, n_colours) '
      + 'rows for the patchwork and an irregular layout, and set saving to how many fewer '
      + 'colours the irregular layout needs than it has regions.',
    hint:
      'build_adjacency and greedy_colour are already in scope. Verify the result before '
      + 'returning it - a greedy colouring that leaves two neighbours sharing a colour is '
      + 'worse than useless, because the picture looks fine.',
    code: `def colours_needed(REG):
    # TODO
    pass


comparison = []
saving = None
# TODO

for label, nreg, ncol in comparison:
    print(f'  {label:<22} {nreg} regions -> {ncol} colours')
print('colours saved on the irregular layout:', saving)`,
    solution: `def colours_needed(REG):
    nreg = int(REG.max()) + 1
    adj = build_adjacency(F, REG, nreg)
    best = None
    for order in (list(range(nreg)),
                  sorted(range(nreg), key=lambda r: -len(adj[r]))):
        col = greedy_colour(adj, order)
        clashes = sum(1 for r in range(nreg) for n in adj[r] if col[r] == col[n])
        assert clashes == 0, 'greedy left adjacent regions sharing a colour'
        k = max(col.values()) + 1
        best = k if best is None else min(best, k)
    return best


REG_IRR = irregular(F=F, V=V)
comparison = [
    ('a 5 x 4 patchwork', int(REG_GRID.max()) + 1, colours_needed(REG_GRID)),
    ('irregular regions', int(REG_IRR.max()) + 1, colours_needed(REG_IRR)),
]
saving = (int(REG_IRR.max()) + 1) - colours_needed(REG_IRR)

for label, nreg, ncol in comparison:
    print(f'  {label:<22} {nreg} regions -> {ncol} colours')
print('colours saved on the irregular layout:', saving)`,
    testCode: `assert comparison, "comparison is empty - nothing was measured."
assert saving is not None, "saving was never set."
assert len(comparison) >= 2, "measure both a regular and an irregular layout"

_grid = colours_needed(REG_GRID)
assert _grid == 2, (
    f"the 5 x 4 patchwork needed {_grid} colours. It is a checkerboard, so the "
    f"answer is 2 by arithmetic - which is exactly why it is the wrong layout "
    f"to draw a conclusion from.")

_irr_reg = irregular(F=F, V=V)
_irr = colours_needed(_irr_reg)
assert 3 <= _irr <= 6, (
    f"the irregular layout needed {_irr} colours; measured, greedy gets 4 "
    f"(busiest-first) or 5 (index order)")
assert _irr < int(_irr_reg.max()) + 1, "fewer colours than regions, or nothing was gained"
assert saving == (int(_irr_reg.max()) + 1) - _irr, (
    f"saving came out {saving}, expected "
    f"{(int(_irr_reg.max()) + 1) - _irr}")
assert saving >= 14, (
    f"only {saving} colours saved; 20 regions needing about 4 colours should "
    f"save about 16")

# Busiest-first must actually help, or the ordering claim is unsupported.
_adj = build_adjacency(F, _irr_reg, int(_irr_reg.max()) + 1)
_a = max(greedy_colour(_adj, list(range(int(_irr_reg.max()) + 1))).values()) + 1
_b = max(greedy_colour(_adj, sorted(range(int(_irr_reg.max()) + 1),
                                    key=lambda r: -len(_adj[r]))).values()) + 1
assert _b <= _a, (
    f"busiest-first needed {_b} colours against index order's {_a}; it should "
    f"be no worse, and measured it is one better")
"SUCCESS: 20 regions, 4 colours, no two neighbours alike - so the forty-way palette problem was never the problem. The cost is that a colour no longer names a region."`,
  },
];

export default {
  id: 'mesh-engine-4-2-colour-as-information',
  slug: 'colour-as-information',
  chapter: 'mesh-engine.4',
  order: 1,
  title: 'Colour as Information',
  subtitle: 'A picture that looks informative and is not.',
  tags: [
    'colour', 'CIELAB', 'perceptual distance', 'colour vision deficiency',
    'palette', 'rainbow colormap', 'graph colouring', 'adjacency', 'legend', 'accessibility',
  ],
  aliases: 'colour color as information colormap rainbow jet perceptually uniform CIELAB CIE76 delta E perceptual distance just noticeable difference colour blind colour vision deficiency protanopia deuteranopia tritanopia palette generation categorical palette adjacency aware colouring graph colouring legend',
  timeToComplete: 75,
  coreConcept:
    'Colour for appearance is taste; colour for information is a measurement problem that can be wrong while looking fine. Four measured facts. RGB distance is not perceptual distance: 20,000 pairs exactly 0.10 apart in RGB span perceived differences from 1.22 to 29.85, a 24x spread. A hue rainbow varies its perceived step by 28x across data steps that are identical, inventing 2 apparent boundaries at 12.2% and 80.8% of the range and flattening elsewhere to 15x below average - so a reader asked where the tolerance is will point at a boundary the data does not contain. An 8-colour palette of evenly spaced hues has a closest pair of 26.52 with normal vision, 2.60 under deuteranopia and 0.00 under tritanopia, and varying lightness as well as hue raises the worst case from 0.00 to 3.47 while costing only 26.52 to 25.81 in the normal case. And the count: with normal vision 32 well-spaced colours are still 30.9 apart, thirteen times the just-noticeable difference, so normal vision is not the limit - colour-vision deficiency is, and it arrives at 6 categories. But the many-way palette was never the problem, because regions only need to differ from their neighbours: 20 irregular regions need 4 colours, at the cost that a colour no longer identifies a region on its own.',
  prerequisites: ['mesh-engine-4-1-rendering-fundamentals'],
  nextLesson: null,

  semantics: {
    core: [
      { symbol: 'CIELAB', meaning: 'A space where Euclidean distance approximates perceived difference. Requires undoing the sRGB gamma first.' },
      { symbol: 'CIE76 ΔE', meaning: 'Euclidean distance in Lab. Overstates differences among saturated colours, so counts based on it are optimistic.' },
      { symbol: 'JND ≈ 2.3', meaning: 'The just-noticeable difference in CIE76. Below it, two colours are the same colour to a reader.' },
      { symbol: 'perceptually uniform ramp', meaning: 'Equal data steps give equal perceived steps. A rainbow is 28x from uniform.' },
      { symbol: 'dichromacy simulation', meaning: 'Project LMS cone responses onto the plane the reader can represent. Viénot, Brettel & Mollon (1999).' },
      { symbol: 'the worst pair', meaning: 'A palette is only as good as its closest two entries, because those are the ones that get confused.' },
      { symbol: 'adjacency-aware colouring', meaning: 'Graph colouring on the region adjacency. Regions need only differ from neighbours, not from everything.' },
    ],
    rulesOfThumb: [
      'Never space a palette in RGB. Equal RGB steps span a 24x range of perceived difference.',
      'Never use a hue ramp for a scalar. It invents boundaries where its steps are large and hides variation where they are small.',
      'Audit a palette under simulated colour-vision deficiency, not by looking at it. Yours is not the only reader.',
      'Vary lightness as well as hue. Lightness survives dichromacy, and the cost in the normal case is almost nothing.',
      'Report the closest pair, not the average separation. The closest pair is the one that gets confused.',
      'Colour regions by their neighbours, not by their count — and then find another way to name them, because the colour no longer can.',
      'Check the conversion against a landmark before trusting any distance. 50% sRGB grey is L* 53.39, not 50.',
    ],
  },

  hook: {
    question: 'Your eight-colour operation palette has a closest pair 26.5 apart — comfortably distinct. What is that number for one reader in twelve?',
    realWorldContext: 'Measured: 2.60 under deuteranopia, and 0.00 under tritanopia — two pairs become exactly identical. Evenly spaced hues are the obvious way to build a categorical palette and the worst one, because hue is precisely the axis a dichromat loses. The normal-vision row looks perfect throughout, which is the problem: a palette checked by the person who chose it is not checked. Varying lightness as well as hue raises the worst case across all three deficiencies from 0.00 to 3.47, and costs only 26.52 → 25.81 in the normal case — so the hue-only palette was not buying anything with the distinctness it gave up.',
    previewVisualizationId: 'JSNotebook',
  },

  intuition: {
    prose: [
      'Lesson 17 got the mesh on screen correctly. This one decides what it says.',
      'Colour doing a decorative job is a matter of taste and nothing here applies to it.',
      'Colour carrying a measurement is a measurement problem, and it can be wrong while looking fine.',
      'It goes wrong in four measurable ways, three of which are invisible to the person who chose the colours.',
      'And the fourth turns out to dissolve the problem rather than constrain it.',
      'None of this is about taste, which is why every claim here has a number attached.',
    ],
    callouts: [
      {
        type: 'warning',
        title: 'RGB distance is not perceptual distance',
        body: 'Measured: 20,000 pairs of colours, every one exactly 0.10 apart in RGB, span perceived differences from 1.22 to 29.85 — a 24x spread for an identical RGB step. So a palette spaced evenly in RGB is not evenly spaced to a reader, and every intuition built on "I moved the red channel by 20" is unreliable.',
      },
      {
        type: 'warning',
        title: 'A rainbow ramp invents boundaries',
        body: 'Across data steps that are identical, a hue rainbow’s perceived step varies by 28x (0.1161 to 3.2419) against 1.9x for a ramp built uniform in Lab. Where the steps are largest a reader sees an edge that is not in the data — measured, 2 distinct ones at 12.2% and 80.8% of the range. Where they are smallest, real variation is invisible, down to 15x flatter than average. Lesson 11 spent a whole lesson putting the threshold somewhere specific, and then the colour ramp moves it.',
      },
      {
        type: 'insight',
        title: 'Vividness is not information',
        body: 'The rainbow’s total perceptual path is 455.1 against the uniform ramp’s 101.6 — four and a half times as much perceived variation spent on the same data. That is why it looks vivid and reads badly: the extra distance is not carrying anything, it is just unevenly distributed.',
      },
      {
        type: 'warning',
        title: 'A palette checked by the person who chose it is not checked',
        body: 'An 8-hue palette: closest pair 26.52 normal, 11.40 protanopia, 2.60 deuteranopia, 0.00 tritanopia — two pairs exactly identical. The normal-vision row never hints at it. Roughly 8% of men have a red-green deficiency, so this is not an edge case; it is one reader in twelve on a picture whose whole job is to be read.',
      },
      {
        type: 'insight',
        title: 'Lightness survives, and costs almost nothing',
        body: 'Varying lightness as well as hue raises the worst case across all three deficiencies from 0.00 to 3.47, while the normal-vision closest pair moves only from 26.52 to 25.81. Not a triumph — 3.47 is barely above the JND — but it is the difference between hard to tell apart and the same colour, bought for essentially nothing.',
      },
      {
        type: 'warning',
        title: 'Normal vision is not the limit, and I expected it to be',
        body: 'I built the measurement to find where distinguishable colours run out for a normal reader. They do not: 32 farthest-point colours are still 30.9 apart, thirteen times the JND. The limit is colour-vision deficiency and it arrives at 6 categories. So the constraint is not "eyes are limited" — it is that a palette keeps working for you long after it has stopped working for someone else, and no care with your own perception will reveal it.',
      },
      {
        type: 'insight',
        title: 'Regions only need to differ from their neighbours',
        body: 'Two adjacent regions sharing a colour read as one region; two distant ones sharing a colour read as two that happen to match. So this is graph colouring: 20 irregular regions need 4 colours, and busiest-first greedy gets 4 where index order gets 5. Four colours can be spaced robustly where twenty cannot. The cost is real — a colour no longer identifies a region on its own, so the legend cannot say "blue = operation 3" and clicking a face has to report which region it is.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Two ramps, the same data',
        caption: 'The perceived step per sample. A ramp that tells the truth is flat.',
        props: {
          lesson: LESSON_MESH_4_2,
        },
      },
    ],
  },

  math: {
    prose: [
      'The first cell builds the conversion and checks it against landmarks, because every later claim is a distance it produces.',
      'Then the foundation — RGB distance against perceived distance — and what a hue ramp does to a scalar.',
      'Then the audit under simulated dichromacy, and the fix that costs almost nothing.',
      'Then the category count, where the measurement contradicted what the cell was built to find, and finally the adjacency result that dissolves the problem.',
    ],
    visualizations: [
      {
        id: 'PythonNotebook',
        title: 'Distance, ramps, deficiency and adjacency',
        mathBridge: 'CIELAB exists because the eye’s response to light is not linear in intensity and not uniform across hue. The cube-root transform in the L* definition approximates the compressive response of the visual system, which is why it turns a physically linear luminance into something proportional to perceived lightness — and why skipping the sRGB decode first gives 50 instead of 53.39 for mid grey. Dichromacy is a rank reduction: a trichromat’s colour space is three-dimensional because three cone types respond independently, and losing one collapses it to a plane, so simulating it is a linear projection in LMS coordinates rather than a filter in RGB. That is why hue separation vanishes while lightness separation survives — lightness is the direction the projection preserves. And adjacency-aware colouring is graph colouring on the region adjacency graph, where the chromatic number is bounded by one more than the maximum degree, which is why 20 regions with at most 7 neighbours each need nowhere near 20 colours.',
        caption: 'Every figure measured, including the one that contradicted the cell it was in.',
        props: {
          initialCells: PY_CELLS,
        },
      },
    ],
  },

  examples: [
    {
      title: 'The same RGB step, 24× apart',
      prose: '20,000 pairs exactly 0.10 apart in RGB, perceived differences from 1.22 to 29.85. Evenly spaced in RGB is not evenly spaced to a reader.',
    },
    {
      title: 'The boundary that is not in the data',
      prose: 'A hue rainbow has 2 distinct perceived edges, at 12.2% and 80.8% of its range, with steps 1.8× and 1.3× its own average. A reader asked where the tolerance is will point at one of them.',
    },
    {
      title: 'Two colours that are one colour',
      prose: 'An 8-hue palette, closest pair 26.52 to a normal reader and 0.00 under tritanopia — exactly identical. Nothing in the normal-vision audit hints at it.',
    },
    {
      title: 'Twenty regions, four colours',
      prose: 'Greedy colouring on irregular region adjacency: 4 colours with busiest-first, 5 with index order, no two neighbours alike. Four can be spaced robustly where twenty cannot.',
    },
  ],

  challenges: [
    {
      prompt: 'Build the sRGB to CIELAB conversion and prove it with landmarks.',
      hint: '50% grey is L* 53.39, not 50. That single check catches a skipped gamma step.',
    },
    {
      prompt: 'Audit a palette under each colour-vision deficiency and report the worst pair.',
      hint: 'Simulate before measuring. A palette is only as good as its closest two entries.',
    },
    {
      prompt: 'Colour regions so no two neighbours match, and measure how many colours that takes.',
      hint: 'Graph colouring on region adjacency. Verify no clash before returning — a bad colouring looks fine.',
    },
    {
      prompt: 'In the browser, measure perceived distance and audit a palette for readers who are not you.',
      hint: 'The gamma step is not optional, and the simulation has to be applied before measuring.',
    },
  ],

  misconceptions: [
    {
      claim: 'Colours evenly spaced in RGB are evenly spaced to the eye.',
      reality: 'Measured, an identical RGB step of 0.10 produces perceived differences from 1.22 to 29.85 — a 24× spread.',
    },
    {
      claim: 'A rainbow colormap shows the most detail because it uses the most colour.',
      reality: 'It spends 455.1 of perceptual path against a uniform ramp’s 101.6, distributed 28× unevenly — so it invents 2 boundaries and hides variation elsewhere by 15×. The extra distance carries nothing.',
    },
    {
      claim: 'A palette that looks clearly distinct is clearly distinct.',
      reality: 'To whom? An 8-hue palette with a closest pair of 26.52 has a closest pair of 0.00 under tritanopia. The normal-vision audit gives no warning.',
    },
    {
      claim: 'Making a palette colour-blind safe means giving up distinctness.',
      reality: 'Measured, varying lightness as well as hue moved the normal-vision closest pair from 26.52 to 25.81 while raising the worst deficiency case from 0.00 to 3.47. The cost is almost nothing.',
    },
    {
      claim: 'The eye can only distinguish about a dozen colours, so keep palettes small.',
      reality: 'With normal vision, 32 well-spaced colours are still 30.9 apart — 13× the JND. Normal vision is not the limit. Colour-vision deficiency is, at 6 categories.',
    },
    {
      claim: 'Forty operations need forty distinguishable colours.',
      reality: 'They need to differ from their neighbours. Measured, 20 irregular regions need 4 colours — and 4 can be spaced robustly where 20 cannot.',
    },
    {
      claim: 'Adjacency-aware colouring is a free improvement.',
      reality: 'It costs the legend. A colour no longer identifies a region on its own, so "blue = operation 3" stops being true and clicking a face has to report which region it is.',
    },
  ],

  transferPrompts: [
    'Someone points at a colour boundary and says "it goes out of tolerance here". What would you check before agreeing?',
    'Your deviation plot looks detailed and nobody can read a number off it. What is the first thing you would change?',
    'How would you find out whether your operation palette works, without asking anyone?',
    'A viewer shows forty operations in forty colours. What has to be true for that to be readable, and is it?',
    'You switch to a four-colour adjacency-aware scheme. What else in the interface has to change?',
  ],

  debugging: [
    {
      symptom: 'Readers disagree about where a feature boundary is on a deviation plot.',
      cause: 'A hue ramp, whose perceived steps vary 28× — so there are apparent edges the data does not contain.',
      fix: 'Use a ramp uniform in Lab. Measure the per-step perceived difference and check it is flat.',
    },
    {
      symptom: 'Two operations look the same to a colleague and different to you.',
      cause: 'A palette built from evenly spaced hues, which collapses under red-green deficiency.',
      fix: 'Audit under simulation and vary lightness. Measured, the worst case goes 0.00 → 3.47 for almost no cost.',
    },
    {
      symptom: 'Colours look subtly wrong or the dark end is crushed.',
      cause: 'The sRGB gamma was not undone before converting or interpolating.',
      fix: 'Check 50% grey lands at L* 53.39. If it lands near 50, the encode was treated as linear light.',
    },
    {
      symptom: 'A palette was tuned by nudging RGB channels and is still uneven.',
      cause: 'RGB distance is not perceptual distance — a 24× spread for an identical step.',
      fix: 'Space it in Lab, by farthest-point sampling or by construction.',
    },
    {
      symptom: 'Regions adjacent on the part read as one region.',
      cause: 'Colours assigned by index rather than by adjacency, so neighbours can collide.',
      fix: 'Greedy-colour the region adjacency graph and verify no adjacent pair shares a colour before drawing.',
    },
    {
      symptom: 'After moving to adjacency-aware colouring, users cannot tell which operation a face belongs to.',
      cause: 'Expected. A colour no longer identifies a region on its own.',
      fix: 'Report the region on hover or click, and drop any legend that maps a colour to a single operation.',
    },
  ],

  mastery: {
    prerequisites:
      'Lesson 17 for getting the mesh on screen at all. Lesson 11 for the threshold a colour ramp can quietly move. Lesson 12 for the attribution this colours, and for the argument that an honest answer beats a simple one. Lesson 3 for the adjacency the graph colouring runs on, and lesson 16A for having used it before.',
    signals: [
      'Checks a colour conversion against a landmark before trusting a distance from it.',
      'Refuses a hue ramp for a scalar, and can say by how much it lies.',
      'Audits a palette under simulation rather than by looking at it.',
      'Reports the closest pair rather than the average separation.',
      'Colours regions by adjacency, and changes the legend to match.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'mesh-engine-4-1-rendering-fundamentals', why: 'Getting the mesh on screen correctly, which this lesson then gives something to say.' },
      { lessonId: 'mesh-engine-1-11-thresholds', why: 'The threshold a rainbow ramp visually relocates.' },
      { lessonId: 'mesh-engine-1-12-attribution', why: 'The per-face attribution this colours, contested faces included.' },
      { lessonId: 'mesh-engine-1-3-topology-and-welding', why: 'The shared-edge adjacency the region colouring is built on.' },
    ],
    futureLinks: [],
  },

  checkpoints: [
    'I can say why RGB distance cannot be used to space a palette.',
    'I can state how far a hue ramp is from uniform, and what that does to a reader.',
    'I can audit a palette under simulated colour-vision deficiency.',
    'I can say what varying lightness buys and what it costs.',
    'I can say what actually limits the number of categories, and it is not normal vision.',
    'I can colour regions by adjacency and say what that breaks.',
  ],

  assessment: {
    task: 'Make a viewer communicate attribution and deviation so that any reader can answer a question from it.',
    acceptance: [
      'Any scalar shown with a ramp measured flat in perceived step, not a hue ramp.',
      'Any categorical palette audited under all three deficiencies, with the worst pair reported.',
      'Lightness varied as well as hue, with the normal-vision cost measured.',
      'The number of categories justified against the deficiency limit, not the normal-vision one.',
      'Region colours assigned by adjacency, with no adjacent pair sharing a colour, verified rather than assumed.',
      'A way to name a region that does not depend on its colour being unique.',
    ],
  },

  quiz: [
    {
      question: 'Two pairs of colours are each exactly 0.10 apart in RGB. How different can they look?',
      options: [
        'Very — measured, perceived difference ranges from 1.22 to 29.85, a 24× spread',
        'Identically, by definition of distance',
        'Within about 10% of each other',
        'It depends only on their brightness',
      ],
      answer: 0,
      explanation: 'RGB distance is not perceptual distance, which is why a palette cannot be spaced by nudging channels.',
    },
    {
      question: 'What does a hue rainbow do to a scalar with evenly spaced data?',
      options: [
        'Varies its perceived step by 28×, inventing 2 apparent boundaries and flattening elsewhere by 15×',
        'Shows the most detail, because it uses the most colour',
        'Behaves like any other ramp',
        'Compresses only the extreme ends',
      ],
      answer: 0,
      explanation: 'A reader asked where the tolerance is will point at one of those boundaries — and lesson 11 established it is somewhere else.',
    },
    {
      question: 'An 8-colour hue palette has a closest pair of 26.52 with normal vision. Under tritanopia?',
      options: [
        '0.00 — two pairs become exactly identical',
        'About 20, so still distinct',
        'About 13, half as distinct',
        'Unchanged, since tritanopia affects only blue',
      ],
      answer: 0,
      explanation: 'Hue is the axis a dichromat loses, so evenly spaced hues is the obvious construction and the worst one.',
    },
    {
      question: 'What does making that palette robust cost in the normal-vision case?',
      options: [
        'Almost nothing — the closest pair moves from 26.52 to 25.81',
        'About half the distinctness',
        'It cannot be done without losing colours',
        'The palette has to shrink to four entries',
      ],
      answer: 0,
      explanation: 'Varying lightness raises the worst deficiency case from 0.00 to 3.47. The hue-only palette was not buying anything with what it gave up.',
    },
    {
      question: 'What limits the number of distinguishable categorical colours?',
      options: [
        'Colour-vision deficiency, at about 6 — normal vision still has 32 colours 30.9 apart',
        'Normal vision, at about a dozen',
        'Screen gamut, at about 20',
        'Nothing; any number can be distinguished',
      ],
      answer: 0,
      explanation: 'This measurement was built to find a normal-vision limit and found there is not one at these sizes. 30.9 is thirteen times the just-noticeable difference.',
    },
    {
      question: 'Twenty operation regions on a part. How many colours are needed?',
      options: [
        'About 4 — regions only need to differ from their neighbours',
        'Twenty, one per region',
        'Two, like any map',
        'It depends on the number of faces',
      ],
      answer: 0,
      explanation: 'Graph colouring on region adjacency. Measured, greedy gets 4 busiest-first and 5 index-order on an irregular layout.',
    },
    {
      question: 'What does adjacency-aware colouring cost?',
      options: [
        'The legend — a colour no longer identifies a region on its own',
        'Nothing; it is a free improvement',
        'Rendering performance',
        'Accessibility, since fewer colours means less information',
      ],
      answer: 0,
      explanation: 'Two regions share a colour deliberately, so "blue = operation 3" stops being true and clicking a face has to report which region it is.',
    },
  ],
};
