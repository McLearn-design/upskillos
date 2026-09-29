// Mesh Engine 1.11 — Thresholds and Classification
//
// The last lesson of the foundation. Everything before this produced numbers;
// this one turns them into decisions, and the point is that the turning is not
// a technicality.
//
// Measured by field-fixes/verify/check-thresholds.py. The threshold VALUES a
// particular shop uses are not here and should not be - what is here is how to
// arrive at one and what it costs to get wrong.

const LESSON_MESH_1_11 = {
  title: 'A Threshold Is a Decision',
  subtitle: 'It decides what gets flagged, what gets missed, and who gets called over.',
  sequential: true,

  cells: [

    {
      type: 'markdown',
      instruction: `### The number you cannot measure below

Lesson 10 ended with two parameters — a tolerance and a search band — and
treated them as things to pick. This lesson is about what picking them actually
commits you to.

Start with the part that is not negotiable. **There is an error floor, and it is
not floating point.**

Lesson 4 established that nothing curved is ever stored: a bore is a many-sided
prism, and the CAM system chose how many sides when it exported. Those corners
sit **on** the true circle, so every point between two corners is **inside** it.
The gap is the sagitta:

\`\`\`
error = R × (1 − cos(π / n))
\`\`\`

Measured, in thousandths of an inch:

| bore Ø | 16 facets | 32 | 64 | 128 |
|---|---|---|---|---|
| 0.25" | 2.40 | 0.60 | 0.15 | 0.04 |
| 0.5" | 4.80 | 1.20 | 0.30 | 0.08 |
| 1.0" | **9.61** | **2.41** | 0.60 | 0.15 |
| 2.0" | **19.21** | **4.82** | **1.20** | 0.30 |

A common tolerance is ±0.001" — one thou. **Eight of those sixteen combinations
have a faceting error larger than the tolerance being measured.** A 1" bore at
32 facets is out by 2.41 thou before anybody has machined anything.

And this is **not noise**. Every facet is inside the true circle, never outside,
so it is a **one-sided bias**. It does not average out over many points, it does
not cancel across a feature, and taking more measurements does not help.

For comparison, measured through the same solver:

| source | magnitude |
|---|---|
| float32 instead of float64 | 2.9 × 10⁻⁷ in |
| the part sitting 1000 units from the origin (float64) | 1.3 × 10⁻¹³ in |
| faceting, 1" bore at 64 facets | 6.0 × 10⁻⁴ in |

**Faceting is about two thousand times larger than the floating-point error.**
Worrying about float precision here is worrying about the wrong thing — though
note what the second row shows: in float64, moving a part a thousand units from
the origin costs essentially nothing, which is worth knowing because people
assume otherwise.`,
    },

    {
      type: 'js',
      instruction: `### Move the threshold and watch who pays

200,000 measured points. **8% of them are genuinely out of tolerance** — that is
ground truth, known because the data was generated that way.

Drag the threshold. Two numbers move in opposite directions:

- **false positives** — flagged, but actually fine. An operator walks over,
  looks, finds nothing.
- **false negatives** — not flagged, but actually out. A part ships with material
  where it should not be.

There is no setting where both are zero. **That is the whole lesson.** A
threshold does not find defects; it chooses which kind of mistake to make.

Then turn the **faceting bias** on. Watch the entire distribution slide left —
and watch what that does to your carefully chosen threshold. The bias shifts
every measurement the same way, so the threshold you wrote down stops meaning
what you thought.

Predict, before you drag: with a bias of 0.0012" and a threshold of 0.002", what
deviation are you *actually* flagging at?`,
      html: `<div style="padding:8px 2px;display:grid;grid-template-columns:auto 1fr;gap:5px 10px;align-items:center">
  <span style="color:#7d8794;font:11px ui-monospace,monospace">threshold</span><input id="thr" type="range" min="-0.001" max="0.006" step="0.0001" value="0.002">
  <span style="color:#7d8794;font:11px ui-monospace,monospace">bias</span><input id="bias" type="range" min="0" max="0.003" step="0.0001" value="0">
  <span style="color:#7d8794;font:11px ui-monospace,monospace">cost of a miss</span><input id="K" type="range" min="1" max="100" step="1" value="1">
</div>
<canvas id="hist" style="width:100%;height:190px;background:#0a0f1e;border-radius:8px"></canvas>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:8px 2px;white-space:pre"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `// A population whose truth is known, so false positives and negatives can
// actually be counted rather than estimated.
var N = 200000;
var TRUE_TOL = 0.002;      // beyond this is genuinely a defect
var NOISE = 0.0003;

var seed = 12345;
function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
function gauss() {          // Box-Muller, for the symmetric part of the error
  var u = Math.max(rnd(), 1e-12), v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

var isDefect = new Uint8Array(N);
var trueDev = new Float64Array(N);
var noise = new Float64Array(N);
var defects = 0;
for (var i = 0; i < N; i++) {
  isDefect[i] = rnd() < 0.08 ? 1 : 0;
  defects += isDefect[i];
  trueDev[i] = isDefect[i]
    ? TRUE_TOL + rnd() * (0.012 - TRUE_TOL)   // really out: 2 to 12 thou
    : rnd() * TRUE_TOL;                        // really fine
  noise[i] = gauss() * NOISE;
}

var canvas = document.getElementById('hist');
var ctx = canvas.getContext('2d');
function sizeCanvas() {
  canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
  canvas.height = 190 * (window.devicePixelRatio || 1);
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
}
sizeCanvas();

var LO = -0.004, HI = 0.014, BINS = 140;

function draw(thr, bias, K) {
  // The measurement: truth, minus the one-sided bias, plus symmetric noise.
  var okBins = new Float64Array(BINS), badBins = new Float64Array(BINS);
  var fp = 0, fn = 0, flagged = 0;
  for (var i = 0; i < N; i++) {
    var m = trueDev[i] - bias + noise[i];
    var b = Math.floor((m - LO) / (HI - LO) * BINS);
    if (b >= 0 && b < BINS) (isDefect[i] ? badBins : okBins)[b]++;
    var isFlagged = m > thr;
    if (isFlagged) flagged++;
    if (isFlagged && !isDefect[i]) fp++;
    if (!isFlagged && isDefect[i]) fn++;
  }

  var W = canvas.clientWidth, H = 190;
  ctx.clearRect(0, 0, W, H);
  var peak = 0;
  for (var k = 0; k < BINS; k++) peak = Math.max(peak, okBins[k] + badBins[k]);

  for (var k2 = 0; k2 < BINS; k2++) {
    var x = k2 / BINS * W, w = W / BINS + 0.5;
    var ho = okBins[k2] / peak * (H - 26);
    var hb = badBins[k2] / peak * (H - 26);
    ctx.fillStyle = '#3f4a5c';                       // genuinely fine
    ctx.fillRect(x, H - 18 - ho, w, ho);
    ctx.fillStyle = '#c2703a';                       // genuinely out
    ctx.fillRect(x, H - 18 - ho - hb, w, hb);
  }

  var tx = (thr - LO) / (HI - LO) * W;
  ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(tx, 0); ctx.lineTo(tx, H - 18); ctx.stroke();
  ctx.fillStyle = '#7d8794'; ctx.font = '10px ui-monospace, monospace';
  ctx.fillText('flag everything to the right of the line', 6, H - 5);
  ctx.fillStyle = '#c2703a'; ctx.fillText('- really out', W - 150, 12);
  ctx.fillStyle = '#3f4a5c'; ctx.fillText('- really fine', W - 70, 12);

  document.getElementById('out').textContent = [
    'threshold        ' + thr.toFixed(4) + '"    bias ' + bias.toFixed(4) + '"',
    '',
    'flagged          ' + flagged.toLocaleString() + ' of ' + N.toLocaleString(),
    'false positives  ' + fp.toLocaleString() + '   flagged, actually fine',
    'false negatives  ' + fn.toLocaleString() + '   missed, actually out  (' +
      (100 * fn / defects).toFixed(1) + '% of all defects)',
    '',
    'cost, if a miss is ' + K + 'x a false alarm:  ' + (fp + K * fn).toLocaleString(),
    '',
    bias > 0
      ? 'with a bias of ' + bias.toFixed(4) + ', a threshold of ' + thr.toFixed(4) +
        ' really flags beyond ' + (thr + bias).toFixed(4) +
        '\\n(' + (100 * (thr + bias) / Math.max(thr, 1e-9) - 100).toFixed(0) +
        '% wider than written)'
      : 'turn the bias up and watch the whole distribution slide left.',
  ].join('\\n');
}

var st = document.getElementById('thr'), sb = document.getElementById('bias'), sk = document.getElementById('K');
function redraw() { draw(Number(st.value), Number(sb.value), Number(sk.value)); }
[st, sb, sk].forEach(function (s) { s.addEventListener('input', redraw); });
window.addEventListener('resize', function () { sizeCanvas(); redraw(); });
redraw();`,
      outputHeight: 470,
    },

    {
      type: 'markdown',
      instruction: `### The trade, measured

Same 200,000 points, 16,141 genuinely out of tolerance:

| threshold | flagged | false positives | false negatives | % of defects missed |
|---|---|---|---|---|
| 0.0000 | 89,966 | 73,825 | 0 | 0.0% |
| 0.0010 | 19,879 | 4,098 | 360 | 2.2% |
| 0.0015 | 15,128 | 103 | 1,116 | 6.9% |
| 0.0020 | 14,276 | 0 | 1,865 | 11.6% |
| 0.0050 | 9,422 | 0 | 6,719 | **41.6%** |

Miss nothing and you flag 90,000 points, 74,000 of which are fine — nobody will
look at that list twice. Flag nothing spurious and you miss 1,865 real defects.

**The fewest total errors is at 0.0015.** That is also the wrong thing to
optimise, because the two mistakes do not cost the same.

#### So state the ratio

If a missed defect costs **K times** a false alarm, minimise \`FP + K × FN\`.
Measured:

| K | best threshold | flagged | missed |
|---|---|---|---|
| 1 | 0.0014 | 15,335 | 983 |
| 5 | 0.0012 | 16,470 | 642 |
| 20 | 0.0010 | 19,416 | 380 |
| 100 | 0.0007 | 30,070 | 124 |

**The threshold moves by a factor of two across that range**, and nothing about
the geometry changed. What changed is how much a scrapped part costs relative to
an operator's walk across the shop.

That is not something a geometry library can know, which is exactly why the
number cannot live buried in the code as \`0.001\`. It is a business decision
wearing a number's clothes.

#### And the bias, which is subtler than it looks

A pure bias shifts every measurement by the same amount, so it is **completely
absorbed by moving the threshold**. Measured: with the faceting bias present the
best achievable cost at K=20 was **11,255** at a threshold of 0.0010; with the
bias corrected it was **11,255** at a threshold of 0.0022. Identical.

**So a bias you know about is free.** It costs nothing to fix and nothing to
live with.

What it costs is **not knowing**:

\`\`\`
you write down a threshold of        0.0020"
the faceting bias is                 0.0012"  one-sided
so you are really flagging beyond    0.0032"
\`\`\`

**Your effective tolerance is 60% wider than the one you wrote down**, and
nothing in the output says so. The parts pass. The report looks clean.

Which is the argument for the rule the section ends on: **keep thresholds named
and explicit.** Not because naming is tidy, but because a number called
\`FACETING_BIAS_1IN_32FACET\` invites the question "is that still right for this
part?", and \`0.0012\` does not.`,
    },

    {
      type: 'challenge',
      instruction: `### 🎯 Name them, and report what they cost

Two functions.

\`facetingFloor(diameter, facets)\` — the largest error the model's own
resolution can contribute for a bore of that size: \`R × (1 − cos(π / n))\`. This
is the floor. A threshold below it is measuring the mesh, not the part.

\`classifyAll(measurements, truth, thresholds)\` — given the measured deviations,
the ground truth, and a **named** threshold object, return counts:
\`{ flagged, falsePositive, falseNegative, cost }\`.

\`thresholds\` arrives as an object, deliberately:

\`\`\`js
{ tolerance: 0.002, facetingBias: 0.0012, missCostRatio: 20 }
\`\`\`

- subtract \`facetingBias\` from nothing — the measurements already carry it;
  your job is to **compensate** by comparing against \`tolerance − facetingBias\`
- \`cost\` is \`falsePositive + missCostRatio × falseNegative\`

It is checked against a population whose truth is known, at several settings,
and it checks that changing \`missCostRatio\` changes the cost while changing
nothing else — because a threshold that ignores its own parameters is the bug
this lesson exists to prevent.`,
      html: `<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:10px;white-space:pre;background:#0a0f1e;border-radius:8px;min-height:260px"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `// TODO 1: the largest error the model's resolution can contribute.
//         A bore of this diameter drawn with this many flat facets.
function facetingFloor(diameter, facets) {

  // your code here

  return 0;
}

// TODO 2: count what a threshold choice actually costs.
//         thresholds = { tolerance, facetingBias, missCostRatio }
function classifyAll(measurements, truth, thresholds) {

  // your code here

  return { flagged: 0, falsePositive: 0, falseNegative: 0, cost: 0 };
}

// ── it runs itself below ──────────────────────────────────────────────────
var N = 50000, TRUE_TOL = 0.002, BIAS = 0.0012, NOISE = 0.0003;
var seed = 999;
function rnd() { seed = (seed*1103515245 + 12345) % 2147483648; return seed/2147483648; }
function gauss() { var u = Math.max(rnd(),1e-12), v = rnd();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }

var truth = new Uint8Array(N), measured = new Float64Array(N);
for (var i = 0; i < N; i++) {
  truth[i] = rnd() < 0.08 ? 1 : 0;
  var dev = truth[i] ? TRUE_TOL + rnd()*(0.012-TRUE_TOL) : rnd()*TRUE_TOL;
  measured[i] = dev - BIAS + gauss()*NOISE;
}

var lines = ['  FACETING FLOOR (thou)'];
[[0.25,16],[0.5,32],[1.0,32],[1.0,64],[2.0,128]].forEach(function (c) {
  lines.push('    ' + c[0] + '" at ' + c[1] + ' facets: ' +
    (facetingFloor(c[0], c[1]) * 1000).toFixed(2));
});
lines.push('');
lines.push('  COST AT DIFFERENT MISS RATIOS');
lines.push('       K   flagged   false pos   false neg       cost');
[1, 5, 20, 100].forEach(function (K) {
  var r = classifyAll(measured, truth, { tolerance: TRUE_TOL, facetingBias: BIAS, missCostRatio: K });
  lines.push('    ' + ('' + K).padStart(4) + ('' + r.flagged).padStart(10) +
    ('' + r.falsePositive).padStart(12) + ('' + r.falseNegative).padStart(12) +
    ('' + r.cost).padStart(11));
});
console.log(lines.join('\\n'));
document.getElementById('out').textContent = lines.join('\\n');`,
      check: (js) => {
        const no = (message) => ({ pass: false, message });
        let fn;
        try {
          // Keep only the learner's two functions. The demo runner below them
          // touches the DOM, and the shims cover it if the marker was deleted.
          const body = js.split(/\/\/[\s\u2500-]*it runs itself below/)[0];
          const doc = { getElementById: () => ({ textContent: '', style: {} }) };
          // eslint-disable-next-line no-new-func
          fn = new Function('document', 'console',
            body + '\nreturn { facetingFloor, classifyAll };',
          )(doc, { log() {} });
        } catch (e) { return no('The code did not run: ' + e.message); }
        for (const n of ['facetingFloor', 'classifyAll']) {
          if (typeof fn[n] !== 'function') return no(n + ' is not a function.');
        }

        // The floor, against values measured in the lesson.
        const want = [
          [0.25, 16, 0.002402], [0.5, 32, 0.001204],
          [1.0, 32, 0.002408], [1.0, 64, 0.000602], [2.0, 128, 0.000301],
        ];
        for (const [d, n, expect] of want) {
          let got;
          try { got = fn.facetingFloor(d, n); } catch (e) {
            return no('facetingFloor threw on (' + d + ', ' + n + '): ' + e.message);
          }
          if (typeof got !== 'number' || !Number.isFinite(got)) {
            return no('facetingFloor(' + d + ', ' + n + ') returned ' + got + '.');
          }
          if (Math.abs(got - expect) > 1e-6) {
            const asRadius = Math.abs(got - expect * 2) < 1e-6;
            return no('facetingFloor(' + d + ', ' + n + ') gave ' + got.toFixed(6)
              + ', expected ' + expect.toFixed(6) + '. '
              + (asRadius
                ? 'Yours is exactly double, so the DIAMETER is being used where the '
                  + 'radius belongs: R = diameter / 2.'
                : 'The sagitta is R x (1 - cos(pi / n)), with n the number of facets '
                  + 'around the full circle.'));
          }
        }

        // A population with known truth.
        let seed = 4242;
        const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
        const gauss = () => {
          const u = Math.max(rnd(), 1e-12), v = rnd();
          return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
        };
        const N = 40000, TOL = 0.002, BIAS = 0.0012, NOISE = 0.0003;
        const truth = new Uint8Array(N), measured = new Float64Array(N);
        for (let i = 0; i < N; i++) {
          truth[i] = rnd() < 0.08 ? 1 : 0;
          const dev = truth[i] ? TOL + rnd() * (0.012 - TOL) : rnd() * TOL;
          measured[i] = dev - BIAS + gauss() * NOISE;
        }

        // The reference: compensate for the bias, then count.
        const reference = (t) => {
          const cut = t.tolerance - t.facetingBias;
          let flagged = 0, fp = 0, fnn = 0;
          for (let i = 0; i < N; i++) {
            const f = measured[i] > cut;
            if (f) flagged++;
            if (f && !truth[i]) fp++;
            if (!f && truth[i]) fnn++;
          }
          return { flagged, falsePositive: fp, falseNegative: fnn,
                   cost: fp + t.missCostRatio * fnn };
        };

        const settings = [
          { tolerance: 0.002, facetingBias: 0.0012, missCostRatio: 1 },
          { tolerance: 0.002, facetingBias: 0.0012, missCostRatio: 20 },
          { tolerance: 0.003, facetingBias: 0.0012, missCostRatio: 5 },
          { tolerance: 0.002, facetingBias: 0.0000, missCostRatio: 5 },
        ];
        for (const t of settings) {
          let got;
          try { got = fn.classifyAll(measured, truth, t); } catch (e) {
            return no('classifyAll threw on ' + JSON.stringify(t) + ': ' + e.message);
          }
          if (!got || ['flagged', 'falsePositive', 'falseNegative', 'cost']
              .some((k) => typeof got[k] !== 'number')) {
            return no('classifyAll should return { flagged, falsePositive, '
              + 'falseNegative, cost } as numbers. Got ' + JSON.stringify(got) + '.');
          }
          const w = reference(t);
          if (got.flagged !== w.flagged) {
            const naive = (() => {
              let f = 0;
              for (let i = 0; i < N; i++) if (measured[i] > t.tolerance) f++;
              return f;
            })();
            return no('With ' + JSON.stringify(t) + ' you flagged ' + got.flagged
              + ', expected ' + w.flagged + '. '
              + (got.flagged === naive
                ? 'You compared against tolerance directly. The measurements already '
                  + 'carry the bias, so the cut has to be tolerance − facetingBias '
                  + '— otherwise the effective tolerance is wider than the one you '
                  + 'wrote down.'
                : 'Flag a point when its measured deviation exceeds the compensated '
                  + 'cut.'));
          }
          if (got.falsePositive !== w.falsePositive || got.falseNegative !== w.falseNegative) {
            return no('With ' + JSON.stringify(t) + ' you reported '
              + got.falsePositive + ' false positives and ' + got.falseNegative
              + ' false negatives; expected ' + w.falsePositive + ' and '
              + w.falseNegative + '. A false positive is flagged but truth is 0; a '
              + 'false negative is not flagged but truth is 1.');
          }
          if (got.cost !== w.cost) {
            return no('With ' + JSON.stringify(t) + ' the counts are right but cost '
              + 'came out ' + got.cost + ', expected ' + w.cost
              + ' = falsePositive + missCostRatio x falseNegative.');
          }
        }

        // Changing only the cost ratio must change only the cost.
        const a = fn.classifyAll(measured, truth, { tolerance: 0.002, facetingBias: 0.0012, missCostRatio: 1 });
        const b = fn.classifyAll(measured, truth, { tolerance: 0.002, facetingBias: 0.0012, missCostRatio: 50 });
        if (a.flagged !== b.flagged) {
          return no('Changing missCostRatio changed how many points were flagged. '
            + 'It must not — the ratio prices the mistakes, it does not decide '
            + 'which ones are made. Only the cost should move.');
        }
        if (a.cost === b.cost && a.falseNegative > 0) {
          return no('Changing missCostRatio from 1 to 50 did not change the cost, '
            + 'though there are ' + a.falseNegative + ' false negatives to price. '
            + 'cost = falsePositive + missCostRatio x falseNegative.');
        }

        return {
          pass: true,
          message: 'The floor is right, the bias is compensated rather than ignored, '
            + 'and the cost ratio prices the mistakes without changing which ones are '
            + 'made. Every one of those three is a named parameter someone can argue '
            + 'with — which is the point of naming them.',
        };
      },
      successMessage: '✓ Named, explicit, and costed.',
      failMessage: '✗ Not yet.',
      outputHeight: 460,
    },

  ],
};

const PY_CELLS = [
  {
    id: 'floor',
    cellTitle: 'The floor you cannot measure below',
    prose: [
      'Lesson 4 established that a bore is a many-sided prism and the roundness is gone, not compressed. This is what that costs when you try to measure against it.',
      'The facet corners sit ON the true circle, so every point between two corners is inside it. The gap is the sagitta, R times (1 - cos(pi/n)) - and crucially it is one-sided. Every facet is inside, never outside. That makes it a bias rather than noise: it does not average out over many points and taking more measurements does not help.',
      'Read the table against a tolerance you might actually be asked to hold. Half of these combinations have more faceting error than the tolerance itself.',
    ],
    code: `import numpy as np

def sagitta(diameter, facets):
    """Largest distance from the true circle to its inscribed n-gon."""
    return (diameter / 2) * (1 - np.cos(np.pi / facets))

print(f"{'bore dia':>9} {'facets':>7} {'error (in)':>12} {'= thou':>8}")
rows = []
for dia in (0.25, 0.5, 1.0, 2.0):
    for n in (16, 32, 64, 128):
        s = sagitta(dia, n)
        rows.append((dia, n, s))
        print(f'{dia:>8}" {n:>7} {s:>12.6f} {s*1000:>8.2f}')
    print()

TOL = 0.001
worse = [(d, n, s) for d, n, s in rows if s > TOL]
print(f'a common tolerance is +/-{TOL}" (1 thou)')
print(f"{len(worse)} of {len(rows)} combinations have MORE faceting error than that:")
for d, n, s in worse:
    print(f'  {d}" at {n} facets: {s*1000:.2f} thou')
print()
print("facets needed to get under a tolerance:")
print(f"{'bore':>7} {'0.0005in':>10} {'0.001in':>9} {'0.005in':>9}")
for dia in (0.25, 0.5, 1.0, 2.0):
    need = []
    for t in (0.0005, 0.001, 0.005):
        n = 3
        while sagitta(dia, n) > t and n < 100000:
            n += 1
        need.append(n)
    print(f'{dia:>6}" {need[0]:>10} {need[1]:>9} {need[2]:>9}')`,
  },
  {
    id: 'stack',
    cellTitle: 'What else is in the number, and how little it matters',
    prose: [
      'People reach for floating point when a measurement looks suspicious. Measure it instead, through the same solver the pipeline uses.',
      'Two variants worth testing: computing in float32 instead of float64, which some pipelines do to halve memory; and moving the whole part a thousand units from the origin, which machine coordinates do routinely and which is widely believed to hurt precision.',
      'Both come out far below the faceting error, and the second is essentially free in float64 - worth knowing, because the belief that it is expensive leads people to add re-centring steps that buy nothing.',
    ],
    code: `def closest_on_triangle(P, A, B, C):
    ab, ac = B - A, C - A
    ap = P - A
    d1, d2 = ab @ ap, ac @ ap
    if d1 <= 0 and d2 <= 0: return A
    bp = P - B
    d3, d4 = ab @ bp, ac @ bp
    if d3 >= 0 and d4 <= d3: return B
    vc = d1*d4 - d3*d2
    if vc <= 0 and d1 >= 0 and d3 <= 0:
        return A if d1 == d3 else A + (d1/(d1-d3))*ab
    cp = P - C
    d5, d6 = ab @ cp, ac @ cp
    if d6 >= 0 and d5 <= d6: return C
    vb = d5*d2 - d1*d6
    if vb <= 0 and d2 >= 0 and d6 <= 0:
        return A if d2 == d6 else A + (d2/(d2-d6))*ac
    va = d3*d6 - d5*d4
    if va <= 0 and (d4-d3) >= 0 and (d5-d6) >= 0:
        sp = (d4-d3)+(d5-d6)
        return B if sp == 0 else B + ((d4-d3)/sp)*(C-B)
    tot = va+vb+vc
    if tot == 0: return A
    return A + ab*(vb/tot) + ac*(vc/tot)

rng = np.random.default_rng(7)
worst32, worst_far = 0.0, 0.0
for _ in range(3000):
    A, B, C = rng.normal(size=3), rng.normal(size=3), rng.normal(size=3)
    P = rng.normal(size=3) * 2
    d64 = np.linalg.norm(P - closest_on_triangle(P, A, B, C))

    A3, B3, C3, P3 = (x.astype(np.float32).astype(np.float64) for x in (A,B,C,P))
    worst32 = max(worst32, abs(d64 - np.linalg.norm(P3 - closest_on_triangle(P3,A3,B3,C3))))

    off = np.array([1000.0, -500.0, 250.0])
    worst_far = max(worst_far, abs(d64 - np.linalg.norm(
        (P+off) - closest_on_triangle(P+off, A+off, B+off, C+off))))

fac = sagitta(1.0, 64)
print(f"{'source':<42} {'inches':>12} {'thou':>12}")
print(f"{'float32 instead of float64':<42} {worst32:>12.2e} {worst32*1000:>12.2e}")
print(f"{'part sitting 1000 units from the origin':<42} {worst_far:>12.2e} {worst_far*1000:>12.2e}")
print(f'{"faceting, 1in bore at 64 facets":<42} {fac:>12.2e} {fac*1000:>12.2f}')
print()
print(f"faceting is {fac/max(worst32, worst_far):,.0f}x the largest floating-point term")
print()
print("Worrying about float precision here is worrying about the wrong thing.")
print("And note the second row: in float64, being far from the origin costs")
print("essentially nothing, which is the opposite of what people assume.")`,
  },
  {
    id: 'trade',
    cellTitle: 'False positives against false negatives',
    prose: [
      'Now the decision itself. A population of 200,000 points whose truth is known by construction: 8% are genuinely out of tolerance, the rest are genuinely fine. What the pipeline measures is the truth, minus the one-sided faceting bias, plus symmetric noise.',
      'Sweep the threshold and count both mistakes. There is no setting where both are zero, and the two move in opposite directions - which is the entire content of the word "threshold".',
      'The row with the fewest total errors is easy to find and is the wrong thing to optimise, because a missed defect and a wasted trip across the shop do not cost the same. The next cell prices them.',
    ],
    code: `TRUE_TOL = 0.002
N = 200_000
rng = np.random.default_rng(3)

is_defect = rng.random(N) < 0.08
true_dev = np.where(is_defect,
                    rng.uniform(TRUE_TOL, 0.012, size=N),
                    rng.uniform(0.0, TRUE_TOL, size=N))

FACET_BIAS = 0.0012      # a 1in bore at 32 facets
NOISE = 0.0003
measured = true_dev - FACET_BIAS + rng.normal(0, NOISE, size=N)

print(f"{N:,} points, {is_defect.sum():,} genuinely out ({100*is_defect.mean():.1f}%)")
print(f"bias -{FACET_BIAS}in, noise sigma {NOISE}in")
print()
print(f"{'threshold':>10} {'flagged':>9} {'false pos':>10} {'false neg':>10} {'missed':>9}")
for thr in (0.0000, 0.0005, 0.0010, 0.0015, 0.0020, 0.0030, 0.0050):
    fl = measured > thr
    fp = int((fl & ~is_defect).sum())
    fn = int((~fl & is_defect).sum())
    print(f"{thr:>10.4f} {int(fl.sum()):>9,} {fp:>10,} {fn:>10,} "
          f"{100*fn/int(is_defect.sum()):>8.1f}%")

print()
print("Miss nothing and you flag 90,000 points, 74,000 of them fine - a list")
print("nobody reads twice. Flag nothing spurious and 1,865 real defects ship.")`,
  },
  {
    id: 'cost',
    cellTitle: 'Price the mistakes, then the threshold follows',
    prose: [
      'The two mistakes have different consequences, so minimising their sum is a choice nobody made deliberately. Write down the ratio instead: if a missed defect costs K times a false alarm, minimise false positives plus K times false negatives.',
      'Sweep K and watch the best threshold move. It changes by a factor of two across a plausible range, and nothing about the geometry changed - only how much a scrapped part costs relative to somebody walking over to look at nothing.',
      'Which is why the number cannot sit buried in the code as 0.001. A geometry library cannot know K. The person who does know it needs to be able to find the number, understand what it controls, and argue with it.',
    ],
    code: `def counts(thr):
    fl = measured > thr
    return int((fl & ~is_defect).sum()), int((~fl & is_defect).sum()), int(fl.sum())

grid = np.linspace(-0.002, 0.006, 401)

print(f"{'K':>5} {'best threshold':>16} {'flagged':>10} {'missed':>9} {'cost':>10}")
for K in (1, 5, 20, 100):
    best = min(((lambda fp, fn, fl: (fp + K*fn, t, fl, fn))(*counts(t)) for t in grid))
    cost, t, fl, fn = best
    print(f"{K:>5} {t:>16.4f} {fl:>10,} {fn:>9,} {cost:>10,}")

print()
print("A factor of two in the threshold, from a business question.")
print()
print("And the cost of a miss is rarely one number - it is scrap, plus rework,")
print("plus the chance it reaches a customer. That is exactly why it belongs in")
print("a named constant somebody can argue with, not inline in a comparison.")`,
  },
  {
    id: 'ch-floor',
    challengeType: 'write',
    challengeTitle: 'Is this threshold even measurable?',
    difficulty: 'warm-up',
    prompt:
      'Write is_measurable(tolerance, diameter, facets) returning True when the requested '
      + 'tolerance is larger than the faceting error - that is, when the mesh can actually '
      + 'represent a difference that size. Then write min_facets(tolerance, diameter) '
      + 'returning the smallest facet count that makes it measurable. Set report to a list '
      + 'of (diameter, facets, tolerance, measurable) rows covering both answers.',
    hint:
      'sagitta is already defined. Measurable means sagitta(diameter, facets) < tolerance. '
      + 'For min_facets, count upwards from 3 until the sagitta drops below the tolerance.',
    code: `def is_measurable(tolerance, diameter, facets):
    # TODO
    pass


def min_facets(tolerance, diameter):
    # TODO
    pass


report = []
# TODO: fill report with (diameter, facets, tolerance, measurable) rows

for d, n, t, m in report:
    print(f'  {d}" at {n:>4} facets, tol {t}: {"measurable" if m else "BELOW THE FLOOR"}')`,
    solution: `def is_measurable(tolerance, diameter, facets):
    return bool(sagitta(diameter, facets) < tolerance)


def min_facets(tolerance, diameter):
    n = 3
    while sagitta(diameter, n) >= tolerance and n < 1_000_000:
        n += 1
    return n


report = []
for d, n, t in ((1.0, 32, 0.001), (1.0, 64, 0.001), (1.0, 128, 0.001),
                (2.0, 32, 0.005), (0.25, 16, 0.001), (0.5, 64, 0.0005)):
    report.append((d, n, t, is_measurable(t, d, n)))

for d, n, t, m in report:
    print(f'  {d}" at {n:>4} facets, tol {t}: {"measurable" if m else "BELOW THE FLOOR"}')`,
    testCode: `assert report, "report is empty - nothing was measured."
assert len(report) >= 5, f"only {len(report)} rows; cover both measurable and not"

# Against values measured in the lesson.
assert is_measurable(0.001, 1.0, 64) is True, (
    '1" bore at 64 facets has 0.60 thou of error, so a 1 thou tolerance IS '
    'measurable')
assert is_measurable(0.001, 1.0, 32) is False, (
    '1" bore at 32 facets has 2.41 thou of error, which is MORE than a 1 thou '
    'tolerance - the mesh cannot represent a difference that small')
assert is_measurable(0.005, 2.0, 32) is True, (
    '2" bore at 32 facets has 4.82 thou of error, just under a 5 thou tolerance')

_n = min_facets(0.001, 1.0)
assert sagitta(1.0, _n) < 0.001, f"min_facets returned {_n}, which is still above the tolerance"
assert sagitta(1.0, _n - 1) >= 0.001, (
    f"min_facets returned {_n} but {_n-1} would also do - it should be the SMALLEST")

# Both outcomes must appear, or the report demonstrates nothing.
assert any(m for *_, m in report), "no measurable case in the report"
assert any(not m for *_, m in report), (
    "no BELOW THE FLOOR case in the report - include one where the faceting "
    "error exceeds the tolerance, such as a 1in bore at 32 facets against 0.001")
"SUCCESS: a threshold below the faceting floor is measuring the mesh, not the part - and now you can tell which you are doing."`,
  },
  {
    id: 'ch-cost',
    challengeType: 'write',
    challengeTitle: 'Let the cost choose the threshold',
    difficulty: 'core',
    prompt:
      'Write best_threshold(K) returning the threshold from the grid that minimises '
      + 'false_positives + K * false_negatives, and set by_K to a list of (K, threshold, '
      + 'flagged, missed) for several K. Then say what moved and what did not.',
    hint:
      'counts(thr) already returns (false_positives, false_negatives, flagged). Evaluate '
      + 'the cost at every threshold in grid and take the minimum. Nothing about the '
      + 'geometry changes as K varies - only the price of each kind of mistake.',
    code: `def best_threshold(K):
    # TODO: return the threshold minimising fp + K*fn
    pass


by_K = []
# TODO: fill by_K with (K, threshold, flagged, missed)

for K, t, fl, fn in by_K:
    print(f"  K={K:>4}  threshold {t:.4f}  flagged {fl:>7,}  missed {fn:>6,}")`,
    solution: `def best_threshold(K):
    best_cost, best_t = None, None
    for t in grid:
        fp, fn, fl = counts(t)
        c = fp + K * fn
        if best_cost is None or c < best_cost:
            best_cost, best_t = c, t
    return float(best_t)


by_K = []
for K in (1, 5, 20, 100):
    t = best_threshold(K)
    fp, fn, fl = counts(t)
    by_K.append((K, t, fl, fn))

for K, t, fl, fn in by_K:
    print(f"  K={K:>4}  threshold {t:.4f}  flagged {fl:>7,}  missed {fn:>6,}")`,
    testCode: `assert by_K, "by_K is empty - nothing was measured."
assert len(by_K) >= 3, f"only {len(by_K)} values of K; use at least three"

# Each reported threshold must really be the minimiser for its K.
for K, t, fl, fn in by_K:
    _best = min((lambda c: c[0] + K * c[1])(counts(x)) for x in grid)
    _fp, _fn, _fl = counts(t)
    assert _fp + K * _fn <= _best + 1e-9, (
        f"for K={K} you reported threshold {t:.4f} costing {_fp + K*_fn}, but "
        f"some threshold in the grid costs {_best}")
    assert _fl == fl, f"for K={K} the flagged count {fl} does not match threshold {t:.4f}"

# The threshold must FALL as a miss gets more expensive - flag more, miss less.
_ts = [t for _, t, _, _ in sorted(by_K)]
assert _ts == sorted(_ts, reverse=True), (
    f"thresholds came out {[round(x,4) for x in _ts]}. As a missed defect gets "
    f"more expensive the threshold should DROP, so that more is flagged and less "
    f"is missed.")
_missed = [fn for _, _, _, fn in sorted(by_K)]
assert _missed == sorted(_missed, reverse=True), (
    f"missed counts came out {_missed}. A higher K should miss fewer.")
assert _ts[0] / max(_ts[-1], 1e-9) > 1.5, (
    f"the threshold only moved from {_ts[0]:.4f} to {_ts[-1]:.4f}. Across K=1 to "
    f"K=100 it should move by roughly a factor of two - widen the range of K.")
"SUCCESS: the geometry never changed. The threshold moved by a factor of two because the price of a mistake did."`,
  },
  {
    id: 'ch-bias',
    challengeType: 'write',
    challengeTitle: 'What an unknown bias actually costs',
    difficulty: 'stretch',
    prompt:
      'A pure bias shifts every measurement equally, so it can be absorbed by moving the '
      + 'threshold. Test that: set cost_with and cost_without to the best achievable cost '
      + 'at K=20 with the bias present and with it corrected. They should be equal. Then '
      + 'set effective_tol to the deviation a nominal threshold of 0.002 is REALLY flagging '
      + 'at when the bias is present but unaccounted for.',
    hint:
      'Corrected means measured + FACET_BIAS. Search the same grid for both. For '
      + 'effective_tol, the measurement is true minus bias, so comparing it against 0.002 '
      + 'flags points whose true deviation exceeds 0.002 plus the bias.',
    code: `cost_with = None
cost_without = None
effective_tol = None

# TODO: best cost at K=20 with and without the bias, then the effective tolerance

print("best cost, bias present   :", cost_with)
print("best cost, bias corrected :", cost_without)
print("effective tolerance       :",
      f'{effective_tol:.4f}"' if effective_tol is not None else None)`,
    solution: `cost_with = None
cost_without = None
effective_tol = None

def cost_of(meas, thr, K):
    fl = meas > thr
    return int((fl & ~is_defect).sum()) + K * int((~fl & is_defect).sum())

cost_with = min(cost_of(measured, t, 20) for t in grid)
cost_without = min(cost_of(measured + FACET_BIAS, t, 20) for t in grid)
effective_tol = TRUE_TOL + FACET_BIAS

print("best cost, bias present   :", cost_with)
print("best cost, bias corrected :", cost_without)
print("effective tolerance       :",
      f'{effective_tol:.4f}"' if effective_tol is not None else None)`,
    testCode: `assert cost_with is not None and cost_without is not None, (
    "cost_with and cost_without were never set.")
assert effective_tol is not None, "effective_tol was never set."

assert cost_with == cost_without, (
    f"the best achievable cost came out {cost_with} with the bias and "
    f"{cost_without} without it. A PURE bias shifts every measurement equally, so "
    f"it is fully absorbed by moving the threshold - the achievable cost must be "
    f"identical. If they differ, the two searches are not over the same grid.")

assert abs(effective_tol - (TRUE_TOL + FACET_BIAS)) < 1e-9, (
    f"effective_tol came out {effective_tol}, expected "
    f"{TRUE_TOL + FACET_BIAS:.4f}. The measurement is true minus bias, so "
    f"comparing it against {TRUE_TOL} flags points whose TRUE deviation exceeds "
    f"{TRUE_TOL} plus the bias.")

# And the headline: how much wider the effective tolerance is.
_wider = 100 * (effective_tol / TRUE_TOL - 1)
assert _wider > 50, (
    f"the effective tolerance is only {_wider:.0f}% wider, which does not match "
    f"a bias of {FACET_BIAS} against a tolerance of {TRUE_TOL}")
"SUCCESS: a known bias is free - it only moves where the threshold sits. An unknown one silently widens your tolerance by 60%, and nothing in the output says so."`,
  },
];

export default {
  id: 'mesh-engine-1-11-thresholds',
  slug: 'thresholds',
  chapter: 'mesh-engine.1',
  order: 10,
  title: 'Thresholds and Classification',
  subtitle: 'The number that decides what gets flagged, what gets missed, and who gets called over.',
  tags: [
    'threshold', 'classification', 'false positive', 'false negative',
    'tolerance', 'chord tolerance', 'sagitta', 'bias', 'measurement error',
    'floating point', 'cost ratio',
  ],
  aliases: 'threshold classification decision false positive false negative tolerance band sagitta chord error faceting error model resolution systematic bias measurement error floating point precision cost ratio named constants explicit thresholds',
  timeToComplete: 60,
  coreConcept:
    'A threshold does not find defects. It chooses which kind of mistake to make, and the two kinds do not cost the same - so the right value follows from a price, not from the geometry. Below that sits an error floor set by the model’s own faceting: a bore drawn as an n-sided prism is inside the true circle by R(1-cos(pi/n)), which for a 1 inch bore at 32 facets is 2.41 thou against a 1 thou tolerance, and which is a one-sided bias that never averages out. Floating point is about two thousand times smaller and is not the thing to worry about. A bias you know about is free, because it is absorbed by moving the threshold; a bias you do not know about silently widens your effective tolerance - measured, by 60%.',
  prerequisites: ['mesh-engine-1-10-signed-distance'],
  nextLesson: 'mesh-engine-1-12-attribution',

  semantics: {
    core: [
      { symbol: 'R(1 - cos(pi/n))', meaning: 'The sagitta: how far inside the true circle an inscribed n-gon falls. The model’s own resolution error, and a floor no threshold can measure below.' },
      { symbol: 'one-sided bias', meaning: 'Every facet is inside, never outside. It does not average out, and more measurements do not help.' },
      { symbol: 'false positive', meaning: 'Flagged, actually fine. Costs an operator a walk across the shop.' },
      { symbol: 'false negative', meaning: 'Not flagged, actually out. Costs a part, and possibly a customer.' },
      { symbol: 'FP + K x FN', meaning: 'What to minimise, once somebody states how much more a miss costs than a false alarm.' },
      { symbol: 'effective tolerance', meaning: 'The deviation you are really flagging at, once an unaccounted bias is included. Measured 60% wider than the number written down.' },
      { symbol: 'named thresholds', meaning: 'A constant called FACETING_BIAS invites the question "is that right for this part". 0.0012 does not.' },
    ],
    rulesOfThumb: [
      'Work out the faceting floor before choosing a tolerance. A threshold below it is measuring the mesh, not the part.',
      'Treat faceting as a bias, not noise. It is one-sided, so averaging and repetition do not reduce it.',
      'Do not reach for floating point first. Measured, it is about two thousand times smaller than the faceting error.',
      'State the cost ratio between a miss and a false alarm. The threshold follows from it, and moves by a factor of two across a plausible range.',
      'Compensate for a known bias by shifting the threshold, which costs nothing. The damage comes from not knowing it is there.',
      'Name every threshold and say what it controls. An inline 0.001 cannot be argued with, and somebody needs to argue with it.',
    ],
  },

  hook: {
    question: 'A 1 inch bore, exported as a 32-sided prism, measured against a tolerance of one thou. How much of that one thou is used up before anybody machines anything?',
    realWorldContext: 'All of it, and more. The inscribed 32-gon falls 2.41 thou inside the true circle, so the model itself is out by more than twice the tolerance being held. It is not noise either - every facet is inside and none outside, so it is a one-sided bias that no amount of averaging removes. Eight of sixteen common bore-and-facet combinations have a faceting error larger than a one thou tolerance. Meanwhile the floating-point error through the same solver is about 3e-7 inches, roughly two thousand times smaller, and moving the part a thousand units from the origin costs 1e-13 inches - essentially nothing.',
    previewVisualizationId: 'JSNotebook',
  },

  intuition: {
    prose: [
      'A threshold does not detect anything. It partitions measurements, and every partition makes both kinds of mistake.',
      'Below it sits a floor set by the model: a curve became flats at export, and the gap between them is error you cannot measure through.',
      'That gap is one-sided, so it is a bias rather than noise - it does not cancel and it does not shrink with more samples.',
      'Floating point is far below that floor and is almost never the thing worth investigating.',
      'Between the two failure modes there is no free choice: tightening the threshold trades misses for false alarms, point for point.',
      'So the value follows from what each mistake costs, which is a question about the shop and not about the geometry.',
    ],
    callouts: [
      {
        type: 'warning',
        title: 'The model is out before you start',
        body: 'A bore exported as an n-sided prism is inside the true circle by R(1 - cos(pi/n)). Measured: a 1 inch bore at 32 facets is out by 2.41 thou, a 2 inch bore at 32 facets by 4.82, and a 2 inch bore at 16 facets by 19.21. Against a one thou tolerance, eight of sixteen common combinations have more faceting error than tolerance. Lesson 4 established that this is permanent - the roundness is absent from the file, not compressed - so the only remedies are a finer export or a threshold that acknowledges the floor.',
      },
      {
        type: 'insight',
        title: 'It is a bias, not noise, and that changes everything',
        body: 'Facet corners lie ON the true circle and everything between them is inside it. Never outside. So the error has a sign, the same sign, everywhere. Noise averages out over many points and shrinks with more samples; a bias does neither. Every statistical instinct about "take more measurements" fails here.',
      },
      {
        type: 'insight',
        title: 'Floating point is not your problem',
        body: 'Measured through the same solver: float32 instead of float64 costs up to 2.9e-7 inches, and moving the whole part a thousand units from the origin costs 1.3e-13 inches in float64. The faceting error on a 1 inch bore at 64 facets is 6.0e-4 inches - about two thousand times larger. The second figure is worth knowing on its own, because the belief that distance from the origin destroys precision leads people to add re-centring steps that buy nothing.',
      },
      {
        type: 'warning',
        title: 'There is no threshold where both mistakes are zero',
        body: 'Measured over 200,000 points with 16,141 genuinely out of tolerance: a threshold of 0 misses nothing and flags 89,966 points of which 73,825 are fine - a list nobody reads twice. A threshold of 0.002 produces no false alarms at all and ships 1,865 real defects. Everything in between trades one for the other. The fewest TOTAL errors is at 0.0015, and that is the wrong thing to optimise, because the two mistakes have different consequences.',
      },
      {
        type: 'insight',
        title: 'A known bias is free. An unknown one moves your tolerance',
        body: 'A pure bias shifts every measurement equally, so it is entirely absorbed by moving the threshold. Measured at K=20: best achievable cost 11,255 with the bias present at a threshold of 0.0010, and 11,255 with it corrected at 0.0022. Identical. So knowing costs nothing. NOT knowing costs this: write down a threshold of 0.002 with an unaccounted bias of 0.0012 and you are really flagging beyond 0.0032 - an effective tolerance 60% wider than the one on the drawing, with nothing in the output to say so.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Drag the threshold and watch who pays',
        caption: 'Two error counts moving in opposite directions, on a population whose truth is known.',
        props: {
          lesson: LESSON_MESH_1_11,
        },
      },
    ],
  },

  math: {
    prose: [
      'The first cell computes the faceting floor across real bore sizes and facet counts, and compares it against a tolerance somebody might actually be asked to hold.',
      'The second measures the floating-point terms through the same solver, so the comparison is a measurement rather than an assertion.',
      'Then the trade itself, on 200,000 points whose truth is known by construction, and the cost ratio that picks the threshold.',
      'The last challenge separates what a bias costs to know from what it costs not to know, which are very different numbers.',
    ],
    visualizations: [
      {
        id: 'PythonNotebook',
        title: 'The floor, the stack, the trade, and the price',
        mathBridge: 'The sagitta comes straight from the chord: for a circle of radius R and a central angle 2 pi / n, half the angle is pi / n and the perpendicular from the centre to the chord is R cos(pi/n), so the gap to the arc is R(1 - cos(pi/n)). Expanding the cosine gives approximately R pi^2 / (2 n^2), which is why doubling the facet count cuts the error by four and why the counts needed grow as the square root of the tolerance.',
        caption: 'Every figure in this lesson measured before it was written down.',
        props: {
          initialCells: PY_CELLS,
        },
      },
    ],
  },

  examples: [
    {
      title: 'The tolerance the model cannot hold',
      prose: 'A 1 inch bore at 32 facets is 2.41 thou inside the true circle. Asked to hold one thou, the mesh is out by more than double the tolerance before machining is considered. Eight of sixteen common combinations are in the same position.',
    },
    {
      title: 'The trade, at both extremes',
      prose: 'Threshold 0: nothing missed, 89,966 flagged, 73,825 of them fine. Threshold 0.005: no false alarms at all, 6,719 real defects missed - 41.6% of them.',
    },
    {
      title: 'A factor of two from a business question',
      prose: 'Best threshold at K=1 is 0.0014; at K=100 it is 0.0007. The geometry is identical in both. What changed is how much a scrapped part costs relative to an operator walking over to look at nothing.',
    },
    {
      title: 'The bias that widened the drawing',
      prose: 'Threshold written down: 0.002. Unaccounted faceting bias: 0.0012. Deviation actually flagged at: 0.0032, an effective tolerance 60% wider - and the report still looks clean.',
    },
  ],

  challenges: [
    {
      prompt: 'Compute the faceting floor and decide whether a requested tolerance is measurable at all, then find the facet count that would make it so.',
      hint: 'Measurable means the sagitta is below the tolerance. Count upwards from 3 for the minimum.',
    },
    {
      prompt: 'Write the classification counts with named thresholds, compensating for a known bias, and price the mistakes with a cost ratio.',
      hint: 'The measurements already carry the bias, so the cut is tolerance minus bias. Changing the ratio must change the cost and nothing else.',
    },
    {
      prompt: 'Sweep the cost ratio and show the best threshold moving, then say what changed and what did not.',
      hint: 'As a miss gets more expensive the threshold should fall, flagging more and missing less. The geometry never changes.',
    },
    {
      prompt: 'Show that a known bias costs nothing, and compute the effective tolerance an unknown one produces.',
      hint: 'Best achievable cost should be identical with and without. The effective tolerance is the nominal plus the bias.',
    },
  ],

  misconceptions: [
    {
      claim: 'Floating-point error is what limits the precision here.',
      reality: 'Measured, it is about two thousand times smaller than the faceting error. Being a thousand units from the origin costs 1e-13 inches in float64 - essentially nothing, despite the widespread belief otherwise.',
    },
    {
      claim: 'Faceting error averages out over many measurements.',
      reality: 'It is one-sided. Every facet is inside the true circle and none outside, so it is a bias, not noise. More samples do not reduce it and averaging does not cancel it.',
    },
    {
      claim: 'A tighter threshold is a safer threshold.',
      reality: 'It is safer against one mistake and worse against the other. Measured, dropping from 0.002 to 0 removes every missed defect and produces 73,825 false alarms - a list nobody will read.',
    },
    {
      claim: 'Pick the threshold that minimises total errors.',
      reality: 'That silently assumes both mistakes cost the same. They do not: one costs a walk across the shop, the other a scrapped part. State the ratio and the threshold follows from it.',
    },
    {
      claim: 'A systematic bias ruins the measurement.',
      reality: 'A bias you know about is free - it is absorbed entirely by moving the threshold, with identical achievable cost. What ruins the measurement is not knowing, because then the threshold on the drawing stops meaning what it says.',
    },
    {
      claim: 'The threshold is an implementation detail, so inline it.',
      reality: 'It encodes a cost ratio nobody in the code knows. Named, someone can find it and argue with it. Inline, it becomes a fact of nature that outlives everybody who understood it.',
    },
  ],

  transferPrompts: [
    'You are asked to hold one thou on a 1 inch bore. What do you need to know about the file before agreeing?',
    'Someone reports that results changed after moving the part origin. What would you check first, and what would you expect to find?',
    'Your classifier flags 40% of a part. Name two causes that have nothing to do with the machining.',
    'How would you find out whether an error source is a bias or noise, and why does it matter which?',
    'What has to be true before a threshold can sensibly be written into code at all?',
  ],

  debugging: [
    {
      symptom: 'Every point on a curved feature is flagged.',
      cause: 'The threshold is below the faceting floor, so the model’s own resolution is being measured.',
      fix: 'Compute R(1 - cos(pi/n)) for that feature. If it exceeds the tolerance, either re-export finer or raise the threshold and say why.',
    },
    {
      symptom: 'Results shift slightly when the part is re-fixtured or the origin moves.',
      cause: 'Almost certainly not floating point - measured at 1e-13 inches for a thousand-unit offset in float64.',
      fix: 'Look for a re-export at a different chord tolerance, or an alignment step, before suspecting precision.',
    },
    {
      symptom: 'Everything passes, and parts are still coming back wrong.',
      cause: 'An unaccounted one-sided bias, so the effective tolerance is wider than the one written down.',
      fix: 'Measure a known-good feature and see whether the reported deviation centres on zero. If it does not, that offset is the bias.',
    },
    {
      symptom: 'The flagged list is too long to be useful.',
      cause: 'The threshold was chosen to minimise misses without pricing false alarms.',
      fix: 'State the cost ratio and re-derive. Measured, the threshold moves by a factor of two across K = 1 to 100.',
    },
    {
      symptom: 'Nobody can say why the threshold is the value it is.',
      cause: 'It was inlined, and the reasoning left with the person who wrote it.',
      fix: 'Name it, record the cost ratio and the faceting assumption beside it, and the next argument about it becomes possible.',
    },
  ],

  mastery: {
    prerequisites:
      'Lesson 10 for the tolerance and band this lesson turns into decisions, lesson 4 for why the faceting is permanent, and lesson 6 for the solver the floating-point terms are measured through.',
    signals: [
      'Computes the faceting floor before agreeing to a tolerance.',
      'Distinguishes bias from noise and knows why averaging only helps one of them.',
      'States a cost ratio rather than minimising total errors.',
      'Names thresholds and records what each one assumes.',
      'Checks whether a reported deviation centres on zero before trusting it.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'mesh-engine-1-10-signed-distance', why: 'The tolerance and search band this lesson turns from parameters into decisions.' },
      { lessonId: 'mesh-engine-1-4-mesh-files', why: 'Why the curve became flats at export, permanently, and where the facet count comes from.' },
      { lessonId: 'mesh-engine-1-6-point-to-mesh', why: 'The solver the floating-point terms are measured through.' },
      { lessonId: 'py-0-2-values', why: 'Float imprecision itself, for anyone who wants the underlying mechanism rather than the measured size of it.' },
    ],
    futureLinks: [],
  },

  checkpoints: [
    'I can compute the faceting floor for a bore and say whether a tolerance is measurable against it.',
    'I can explain why faceting is a bias and what that rules out.',
    'I know roughly how large the floating-point terms are, from measurement.',
    'I can show the false positive and false negative trade on data with known truth.',
    'I can derive a threshold from a stated cost ratio.',
    'I can say what an unaccounted bias does to an effective tolerance.',
  ],

  assessment: {
    task: 'Given a feature, a requested tolerance and a measured population, produce a defensible threshold and state everything it assumes.',
    acceptance: [
      'The faceting floor computed and compared against the requested tolerance.',
      'Bias separated from noise, with the bias compensated explicitly.',
      'False positives and false negatives reported separately, never as a single accuracy figure.',
      'A stated cost ratio, and the threshold derived from it.',
      'Every constant named, with what it assumes recorded beside it.',
    ],
  },

  quiz: [
    {
      question: 'A 1 inch bore exported at 32 facets, measured against a one thou tolerance. How much error does the model itself contribute?',
      options: [
        '2.41 thou — more than double the tolerance, before anything is machined',
        'About 0.1 thou, well within tolerance',
        'None; faceting affects appearance, not measurement',
        'It depends on the machine',
      ],
      answer: 0,
      explanation: 'R(1 - cos(pi/n)) with R = 0.5 and n = 32. Eight of sixteen common bore-and-facet combinations exceed a one thou tolerance this way.',
    },
    {
      question: 'Why does taking more measurements not reduce the faceting error?',
      options: [
        'It is one-sided — every facet is inside the true circle, so it is a bias and not noise',
        'Because the measurements are correlated',
        'It does reduce it, as the square root of the count',
        'Because floating-point error dominates',
      ],
      answer: 0,
      explanation: 'Noise averages out; a bias does not. Every instinct about repeating a measurement fails against a systematic offset.',
    },
    {
      question: 'How large is the floating-point error compared with the faceting error?',
      options: [
        'About two thousand times smaller — 2.9e-7 inches against 6.0e-4',
        'Comparable, so both matter',
        'Larger, which is why float64 is essential',
        'It depends on how far the part is from the origin, which dominates',
      ],
      answer: 0,
      explanation: 'Measured through the same solver. And the last option is the myth: a thousand-unit offset costs 1.3e-13 inches in float64.',
    },
    {
      question: 'Which threshold should you choose?',
      options: [
        'The one that minimises false positives + K x false negatives, once somebody states K',
        'The one that minimises total errors',
        'The tightest one the measurement supports',
        'Whatever the drawing tolerance says',
      ],
      answer: 0,
      explanation: 'Minimising total errors assumes both mistakes cost the same. Measured, the best threshold moves from 0.0014 at K=1 to 0.0007 at K=100 with no change to the geometry.',
    },
    {
      question: 'What does a known systematic bias cost?',
      options: [
        'Nothing — it is absorbed entirely by moving the threshold, with identical achievable cost',
        'It doubles the error rate',
        'It cannot be corrected, only reduced by re-exporting',
        'It costs the same whether you know about it or not',
      ],
      answer: 0,
      explanation: 'Measured at K=20: cost 11,255 with the bias at threshold 0.0010, and 11,255 corrected at 0.0022. The damage comes from not knowing.',
    },
    {
      question: 'You write a threshold of 0.002 and there is an unaccounted bias of 0.0012. What are you really flagging at?',
      options: [
        '0.0032 — an effective tolerance 60% wider than written, with nothing in the output saying so',
        '0.002, since the bias affects all points equally',
        '0.0008, because the bias is subtracted',
        'It varies per point, so no single figure applies',
      ],
      answer: 0,
      explanation: 'The measurement is truth minus bias, so comparing against 0.002 passes anything up to 0.0032. The parts pass and the report looks clean.',
    },
  ],
};
