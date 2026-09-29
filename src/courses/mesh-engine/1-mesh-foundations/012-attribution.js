// Mesh Engine 1.12 — Attribution
//
// LearningPath section 12. Technique only: how to decide which operation is
// responsible for a face, and how to record the cases where that is genuinely
// contested. The candidate sets and the selection rules of any particular shop
// are not here and should not be.
//
// Every number quoted was produced by field-fixes/verify/check-attribution.py
// on a synthetic step whose tool envelopes are known exactly, so every face has
// a ground-truth answer no heuristic was given.

const LESSON_MESH_1_12 = {
  title: 'Nearest Is Not Responsible',
  subtitle: 'Which operation made this face, and what to do when more than one could have.',
  sequential: true,

  cells: [

    {
      type: 'markdown',
      instruction: `### A new question, and the old answer does not fit it

Lessons 5 through 9 built a machine that answers *how far*. Lesson 10 added
*which side*. Lesson 11 turned a number into a decision.

This lesson asks something the distance machine cannot answer:

> **Which operation is responsible for this face?**

It looks like a nearest-neighbour problem. Each operation has a toolpath, each
face has a position, so pick the closest toolpath. That is the answer almost
everyone writes first, and it is wrong in a specific, measurable, systematic way.

Three things get confused with each other:

\`\`\`
nearest        the toolpath that passes closest to this face
responsible    the operation whose tool actually contacted it
finished       the operation that determined its final condition
\`\`\`

**These are three different questions with three different answers.** Measured
on a part whose truth is known by construction, nearest is wrong on **10.2%** of
the surface, and *responsible* and *finished* disagree on another **20.5%**.

Worse, the disagreements are not scattered. They cluster exactly where somebody
will be looking.`,
    },

    {
      type: 'js',
      instruction: `### Slide a probe along the floor and watch the rules disagree

A cross-section of a step: a lower floor, a wall, an upper floor. Five
operations machined it, and each is drawn as its **tool centre path** (the thin
line) and its **envelope** — the surface the tool actually cuts, one radius away.

Move the probe along the lower floor. The panel shows, for that point:

- the distance to each operation's centre path
- which operations **actually contacted** it — distance to centre ≈ radius
- what each rule concludes

**Predict before you drag:** the floor was finished by a 0.25 tool and the wall
was finished by another 0.25 tool. As you approach the wall at x = 6, which
operation do you expect "nearest centre path" to start naming, and how far from
the wall do you expect that to begin?

Watch the **contested** flag too. It lights up wherever two operations both made
contact — which is a fact about the part, not a failure of the code.`,
      html: `<div style="padding:8px 2px;font:11px ui-monospace,monospace;color:#7d8794;display:grid;grid-template-columns:auto 1fr auto;gap:6px 10px;align-items:center">
  <span>probe x</span><input id="px" type="range" min="0.05" max="5.98" step="0.01" value="3.0"><span id="pxv">3.00</span>
</div>
<canvas id="c" style="width:100%;height:210px;background:#0a0f1e;border-radius:8px"></canvas>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:8px 2px;white-space:pre"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `// The five operations, as tool centre paths in the x-z cross-section.
// Each is a list of [x, z] points. 'r' is the tool radius, so the surface the
// tool actually cuts lies one radius away from this line.
var OPS = [
  { name: 'rough',        order: 1, r: 1.00, colour: '#8a6d3b',
    path: seg(1.00, 1.30, 5.00, 1.30).concat(seg(7.00, 3.30, 9.00, 3.30)) },
  { name: 'floor-finish', order: 2, r: 0.25, colour: '#5c9ce0',
    path: seg(0.25, 0.25, 5.75, 0.25) },
  { name: 'wall-finish',  order: 3, r: 0.25, colour: '#e05c5c',
    path: seg(5.75, 0.25, 5.75, 2.00) },
  { name: 'upper-finish', order: 4, r: 0.25, colour: '#5ce07a',
    path: seg(6.25, 2.25, 9.75, 2.25) },
  { name: 'spring',       order: 5, r: 0.25, colour: '#c07ae0',
    path: seg(2.00, 0.25, 4.00, 0.25) },
];

function seg(x0, z0, x1, z1) {          // sample a straight move densely
  var out = [], N = 240;
  for (var i = 0; i <= N; i++) {
    var t = i / N;
    out.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]);
  }
  return out;
}

function distToPath(p, path) {
  var best = Infinity;
  for (var i = 0; i < path.length; i++) {
    var dx = p[0] - path[i][0], dz = p[1] - path[i][1];
    var d = Math.sqrt(dx * dx + dz * dz);
    if (d < best) best = d;
  }
  return best;
}

var EPS = 0.02;   // how close to the envelope counts as contact

// A point on the FINAL surface was contacted by an operation exactly when its
// distance to that operation's centre path equals the tool radius - it lies on
// the envelope. Closer than that and the tool would have cut it away.
function analyse(p) {
  var rows = OPS.map(function (o) {
    var d = distToPath(p, o.path);
    return { op: o, d: d, contact: Math.abs(d - o.r) <= EPS };
  });
  var touched = rows.filter(function (r) { return r.contact; });
  var nearest = rows.slice().sort(function (a, b) { return a.d - b.d; })[0];
  var latest = touched.slice().sort(function (a, b) {
    return b.op.order - a.op.order; })[0];
  var first = touched.slice().sort(function (a, b) {
    return a.op.order - b.op.order; })[0];
  return { rows: rows, touched: touched, nearest: nearest,
           latest: latest || null, first: first || null };
}

var canvas = document.getElementById('c');
var ctx = canvas.getContext('2d');
function sizeCanvas() {
  canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
  canvas.height = 210 * (window.devicePixelRatio || 1);
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
}
sizeCanvas();

function draw() {
  var px = Number(document.getElementById('px').value);
  document.getElementById('pxv').textContent = px.toFixed(2);
  var P = [px, 0.0];
  var a = analyse(P);

  var W = canvas.clientWidth, H = 210;
  var sx = W / 11.0, sz = (H - 30) / 4.6;
  function X(x) { return 12 + x * sx * 0.92; }
  function Z(z) { return H - 22 - z * sz; }

  ctx.clearRect(0, 0, W, H);

  // the finished part profile
  ctx.strokeStyle = '#9fb8e0'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(X(0), Z(0)); ctx.lineTo(X(6), Z(0));
  ctx.lineTo(X(6), Z(2)); ctx.lineTo(X(10), Z(2));
  ctx.stroke();

  // each operation: centre path thin, envelope dashed
  OPS.forEach(function (o) {
    ctx.strokeStyle = o.colour; ctx.lineWidth = 1.2; ctx.setLineDash([]);
    ctx.beginPath();
    o.path.forEach(function (q, i) {
      if (i === 0) ctx.moveTo(X(q[0]), Z(q[1])); else ctx.lineTo(X(q[0]), Z(q[1]));
    });
    ctx.stroke();
  });

  // the probe, and a ring to each contacting tool's centre
  a.touched.forEach(function (r) {
    ctx.strokeStyle = r.op.colour; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.arc(X(P[0]), Z(P[1]), r.op.r * sx * 0.92, 0, 2*Math.PI);
    ctx.stroke();
  });
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffd43b';
  ctx.beginPath(); ctx.arc(X(P[0]), Z(P[1]), 4, 0, 2*Math.PI); ctx.fill();

  ctx.fillStyle = '#7d8794'; ctx.font = '10px ui-monospace, monospace';
  ctx.fillText('wall at x = 6', X(6) + 5, Z(2.4));

  var lines = ['  distance from the probe to each tool centre path:'];
  a.rows.forEach(function (r) {
    lines.push('    ' + r.op.name.padEnd(14)
      + 'r ' + r.op.r.toFixed(2)
      + '   d ' + r.d.toFixed(3)
      + '   |d - r| ' + Math.abs(r.d - r.op.r).toFixed(3)
      + (r.contact ? '   CONTACT' : ''));
  });
  lines.push('');
  lines.push('  nearest centre path   -> ' + a.nearest.op.name);
  lines.push('  contacted, latest     -> ' + (a.latest ? a.latest.op.name : 'nothing reached this face'));
  lines.push('  contacted, first      -> ' + (a.first ? a.first.op.name : 'nothing reached this face'));
  lines.push('');
  if (a.latest && a.nearest.op.name !== a.latest.op.name) {
    lines.push('  ** nearest DISAGREES with the operation that actually touched it **');
  } else if (!a.latest) {
    lines.push('  ** no tool envelope reaches here - this is the corner fillet **');
  } else {
    lines.push('  nearest happens to agree here.');
  }
  if (a.touched.length >= 2) {
    lines.push('  ** CONTESTED: ' + a.touched.length + ' operations both contacted this face ('
      + a.touched.map(function (r) { return r.op.name; }).join(', ') + ') **');
  }
  document.getElementById('out').textContent = lines.join('\\n');
}

document.getElementById('px').addEventListener('input', draw);
window.addEventListener('resize', function () { sizeCanvas(); draw(); });
draw();`,
      outputHeight: 520,
    },

    {
      type: 'markdown',
      instruction: `### What the measurement says

43,200 surface points on a step whose tool envelopes are known exactly, so
every point has a ground-truth answer no heuristic was given.

| rule | correct |
|---|---|
| nearest tool centre path | **89.8%** |
| nearest tool *surface* (distance − radius) | 89.4% |
| contacted, then latest | 100.0% |

**Nearest is wrong on 10.2% of the part.** And note the middle row: the
"obvious improvement" of measuring to the tool surface instead of the centre is
*slightly worse*. Ranking by distance is the problem, not which distance.

#### It is a bias, not noise

A tool's centre sits **one radius away from the face it cut**. So a 1.00-radius
rougher is 1.00 away from its own work, while a 0.25 finisher merely *passing
by* is 0.25 away.

**Ranking by distance to the centre path ranks by tool size.** Small tools win
everywhere, including on faces they never touched. Same shape of problem as the
faceting bias in lesson 11 — systematic, one-directional, and invisible if you
only look at averages.

Where it goes wrong, and what it names instead:

\`\`\`
picked floor-finish   3,642 times, actually spring or wall-finish
picked wall-finish       12 times, actually rough
\`\`\`

The wrong floor points sit between **x = 1.958 and x = 5.774** — a band
**3.816 wide** against a wall at x = 6.000. **The error is a band along the
wall, not noise scattered over the part**, which is exactly where somebody will
be inspecting.

#### 17.2% of the surface has no responsible operation at all

\`\`\`
touched by at least one operation   35,764   (82.8%)
touched by nothing                   7,436   (17.2%)
\`\`\`

That is not a bug. **A 0.25-radius ball nose cannot reach into a square
internal corner**, so a fillet of unmachined stock is left there. "No operation
is responsible" is a real answer — and an attribution process that cannot
*return* it will invent something instead.`,
    },

    {
      type: 'markdown',
      instruction: `### Contested cases, and why they must be recorded

\`\`\`
touched by exactly one operation    27,858
touched by two or more               7,906   (22.1% of attributed surface)
\`\`\`

**Over a fifth of the attributed surface has more than one operation with a
legitimate claim.** Which ones contest each other:

| contest | points |
|---|---|
| floor-finish + spring | 6,840 |
| rough + wall-finish | 574 |
| floor-finish + wall-finish | 492 |

Every one of those is a face where some rule picks a winner and **nothing
downstream records that there was a contest at all.** The result looks exactly
as confident as a face only one tool ever touched.

The section's instruction is explicit about this: *record contested cases rather
than silently hiding ambiguity.* That is not a nicety. A face attributed with
one candidate and a face attributed with three are different kinds of answer,
and collapsing them throws away the only signal that would tell somebody to look.

### Responsible is not finished

Two rules, both defensible:

- **most material removed** — what moved the metal
- **last to touch** — what determined the final surface

Measured removal per point:

| operation | removed |
|---|---|
| rough | 0.000 *(never reaches a final face)* |
| floor-finish | 0.300 |
| wall-finish | 0.000 – 0.300 |
| upper-finish | 0.300 |
| **spring** | **0.000** |

The two rules **agree on 79.5%** of the attributed surface and **disagree on
7,332 points**:

\`\`\`
last = spring        most-removed = floor-finish     6,840 points
last = wall-finish   most-removed = floor-finish       492 points
\`\`\`

**Neither rule is wrong.** They answer different questions. A system that does
not say which one it implements has not chosen — it has defaulted, and the
default is whatever the code happened to do.

This is the generic form of a real bug: colouring by "material moved" draws a
roughing pass as though it were the finisher, because the rough pass moved more
metal while the finish pass determined the surface.`,
    },

    {
      type: 'markdown',
      instruction: `### The pass that removes nothing, and why no threshold saves you

A **spring pass** contacts the face and takes off nothing measurable. It still
determined the finish. Lesson 11's instinct says: set a minimum-removal
threshold. Measure whether that can work.

Compare two populations: the spring pass (contacted, removed ≈ 0) and an
operation that **never touched the face at all** (also reads ≈ 0).

| threshold | spring kept | absent rejected |
|---|---|---|
| 0.0000 | 100.0% | 0.0% |
| 0.0005 | 53.8% | 45.8% |
| 0.0010 | 21.4% | 78.9% |
| 0.0020 | 1.3% | 98.7% |
| 0.0050 | 0.0% | 100.0% |

Every row trades one for the other exactly. Best achievable over *any*
threshold: **1.008 out of a possible 2.000** — no better than a coin.

**Lesson 11 showed a threshold trading one error against another. Here it cannot
trade at all**, because on a depth reading the two populations are *identical*.
There is nothing to separate.

The fix is not a better threshold. It is **a different input**: whether the tool
envelope reached the face, which is **geometry, not measurement**. That is why
this lesson's correct rule is *contacted, then latest* rather than any ranking
of depths.

### And the rule order is itself a rule

Same part, same candidates, same evidence. Only the order the rules are applied
in changes:

| ordering | differs from the first |
|---|---|
| latest, then most-removed | — |
| **most-removed, then latest** | **7,332 points (20.5%)** |
| smallest-tool, then latest | 0 points |

Nothing about the geometry changed. Nothing about the rules changed. **One
fifth of the answers moved.**

So the ordering is not an implementation detail. It is part of the
specification, and it belongs somewhere a person can disagree with it — the same
argument lesson 11 made for naming thresholds, applied to the sequence rather
than the value.`,
    },

    {
      type: 'challenge',
      instruction: `### 🎯 Attribute by contact, and admit when you cannot

Two functions.

\`contacts(point, ops, eps)\` — return the **indices** of the operations whose
tool envelope the point lies on. A point on the final surface was contacted by
an operation when its distance to that operation's centre path is within \`eps\`
of the tool radius: \`|d − r| ≤ eps\`. Distance alone is not contact.

\`attribute(point, ops, eps)\` — return
\`{ operation, contested, candidates }\`:

- \`operation\` — the name of the **latest** contacting operation by \`order\`,
  or **\`null\`** when nothing reached the point
- \`contested\` — \`true\` when **two or more** operations made contact
- \`candidates\` — the names of every contacting operation, in the order they
  appear in \`ops\`

Each \`op\` is \`{ name, order, r, path }\` where \`path\` is a list of \`[x, z]\`
centre points.

It is checked on a point only one tool touched, a contested point, a point in
the corner fillet that nothing reached, and a point where the nearest path
belongs to an operation that never made contact.`,
      html: `<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:10px;white-space:pre;background:#0a0f1e;border-radius:8px;min-height:230px"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `// TODO 1: which operations' envelopes does this point lie on?
//         Contact means |distance to centre path - tool radius| <= eps.
function contacts(point, ops, eps) {

  // your code here

  return [];
}

// TODO 2: attribute the point, and be honest about ambiguity.
//         { operation: name or null, contested: bool, candidates: [names] }
function attribute(point, ops, eps) {

  // your code here

  return { operation: null, contested: false, candidates: [] };
}

// ── it runs itself below ──────────────────────────────────────────────────
function seg(x0, z0, x1, z1) {
  var out = [], N = 200;
  for (var i = 0; i <= N; i++) { var t = i/N;
    out.push([x0 + (x1-x0)*t, z0 + (z1-z0)*t]); }
  return out;
}
var OPS = [
  { name: 'rough',        order: 1, r: 1.00, path: seg(1.00, 1.30, 5.00, 1.30) },
  { name: 'floor-finish', order: 2, r: 0.25, path: seg(0.25, 0.25, 5.75, 0.25) },
  { name: 'wall-finish',  order: 3, r: 0.25, path: seg(5.75, 0.25, 5.75, 2.00) },
  { name: 'spring',       order: 5, r: 0.25, path: seg(2.00, 0.25, 4.00, 0.25) },
];

var lines = [];
[['open floor',        [1.0, 0.0]],
 ['under the spring',  [3.0, 0.0]],
 ['hard in the corner',[5.995, 0.0]],
 ['on the wall',       [6.0, 1.0]]
].forEach(function (c) {
  var r = attribute(c[1], OPS, 0.02);
  lines.push('  ' + c[0].padEnd(20)
    + (r.operation === null ? 'nothing reached it' : r.operation).padEnd(16)
    + (r.contested ? 'CONTESTED  ' : '           ')
    + '[' + r.candidates.join(', ') + ']');
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
            body + '\nreturn { contacts, attribute };',
          )(doc, { log() {} });
        } catch (e) { return no('The code did not run: ' + e.message); }
        for (const n of ['contacts', 'attribute']) {
          if (typeof fn[n] !== 'function') return no(n + ' is not a function.');
        }

        const seg = (x0, z0, x1, z1) => {
          const out = []; const N = 200;
          for (let i = 0; i <= N; i++) {
            const t = i / N;
            out.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]);
          }
          return out;
        };
        const OPS = [
          { name: 'rough', order: 1, r: 1.00, path: seg(1.00, 1.30, 5.00, 1.30) },
          { name: 'floor-finish', order: 2, r: 0.25, path: seg(0.25, 0.25, 5.75, 0.25) },
          { name: 'wall-finish', order: 3, r: 0.25, path: seg(5.75, 0.25, 5.75, 2.00) },
          { name: 'spring', order: 5, r: 0.25, path: seg(2.00, 0.25, 4.00, 0.25) },
        ];
        const EPS = 0.02;

        const dist = (p, path) => {
          let best = Infinity;
          for (const q of path) {
            const dx = p[0] - q[0], dz = p[1] - q[1];
            const d = Math.sqrt(dx * dx + dz * dz);
            if (d < best) best = d;
          }
          return best;
        };
        const refContacts = (p) => OPS
          .map((o, i) => [i, Math.abs(dist(p, o.path) - o.r) <= EPS])
          .filter(([, c]) => c).map(([i]) => i);

        const probes = [
          ['open floor', [1.0, 0.0]],
          ['under the spring pass', [3.0, 0.0]],
          ['hard in the corner', [5.995, 0.0]],
          ['on the wall', [6.0, 1.0]],
          ['well above the part', [3.0, 3.0]],
        ];

        for (const [label, P] of probes) {
          let got;
          try { got = fn.contacts(P, OPS, EPS); } catch (e) {
            return no('contacts threw at ' + label + ': ' + e.message);
          }
          if (!Array.isArray(got) || got.some((v) => typeof v !== 'number')) {
            return no('contacts should return an array of indices. At ' + label
              + ' it gave ' + JSON.stringify(got) + '.');
          }
          const want = refContacts(P);
          const g = [...got].sort((a, b) => a - b).join(',');
          const w = want.join(',');
          if (g !== w) {
            const nearestIdx = OPS
              .map((o, i) => [i, dist(P, o.path)])
              .sort((a, b) => a[1] - b[1])[0][0];
            if (got.length === 1 && got[0] === nearestIdx && want.length !== 1) {
              return no('At ' + label + ' you returned just the NEAREST centre path ('
                + OPS[nearestIdx].name + '), but the envelopes actually touching '
                + 'this face are [' + want.map((i) => OPS[i].name).join(', ') + ']. '
                + 'Contact is |d − r| ≤ eps, not the smallest d — a tool’s '
                + 'centre sits one radius from its own work, so ranking by '
                + 'distance ranks by tool size \u2014 and taking only the winner '
                + 'throws away every other operation with a legitimate claim.');
            }
            return no('At ' + label + ' contacts gave ['
              + got.map((i) => OPS[i]?.name ?? i).join(', ') + '] but the '
              + 'envelopes actually touching it are ['
              + want.map((i) => OPS[i].name).join(', ') + '].');
          }
        }

        for (const [label, P] of probes) {
          let got;
          try { got = fn.attribute(P, OPS, EPS); } catch (e) {
            return no('attribute threw at ' + label + ': ' + e.message);
          }
          if (!got || typeof got !== 'object' || !Array.isArray(got.candidates)
              || typeof got.contested !== 'boolean') {
            return no('attribute should return { operation, contested, candidates }. '
              + 'At ' + label + ' it gave ' + JSON.stringify(got) + '.');
          }
          const want = refContacts(P);
          const wantNames = want.map((i) => OPS[i].name);
          const wantOp = want.length
            ? OPS[want.reduce((a, b) => (OPS[b].order > OPS[a].order ? b : a))].name
            : null;

          if (got.candidates.join(',') !== wantNames.join(',')) {
            return no('At ' + label + ' candidates came out ['
              + got.candidates.join(', ') + '], expected [' + wantNames.join(', ')
              + '] — every contacting operation, in the order they appear in ops.');
          }
          if (got.operation !== wantOp) {
            if (wantOp === null) {
              return no('At ' + label + ' nothing reached the face — a 0.25 '
                + 'radius tool cannot get into a square corner, so a fillet of '
                + 'stock is left. You named "' + got.operation + '" anyway. '
                + '"No operation is responsible" is a real answer, and code that '
                + 'cannot return it invents one instead.');
            }
            if (want.length > 1 && got.operation === OPS[want[0]].name) {
              return no('At ' + label + ' you named "' + got.operation
                + '", the FIRST operation to contact the face. The rule is the '
                + 'LATEST by order — ' + wantOp + ' ran afterwards and '
                + 'determined the final surface, even where it removed nothing '
                + 'measurable.');
            }
            return no('At ' + label + ' you named "' + got.operation
              + '", expected "' + wantOp + '" — the latest contacting '
              + 'operation by order.');
          }
          const wantContested = want.length >= 2;
          if (got.contested !== wantContested) {
            return no('At ' + label + ' contested came out ' + got.contested
              + ', expected ' + wantContested + '. ' + want.length
              + ' operation(s) made contact. A face with one claimant and a face '
              + 'with three are different kinds of answer, and collapsing them '
              + 'throws away the only signal that says "look here".');
          }
        }

        // A contested point must actually be exercised, or the flag proves nothing.
        const contestedProbe = fn.attribute([3.0, 0.0], OPS, EPS);
        if (!contestedProbe.contested || contestedProbe.candidates.length < 2) {
          return no('The point under the spring pass should be contested — '
            + 'both floor-finish and spring contacted it.');
        }

        return {
          pass: true,
          message: 'Contact decides, not distance; the latest contacting operation '
            + 'wins even when it removed nothing; ambiguity is reported instead of '
            + 'resolved silently; and the corner fillet comes back as null rather '
            + 'than a guess. Those four are the whole of the technique — the '
            + 'rules that sit on top are a shop’s to write.',
        };
      },
      successMessage: '✓ Attributed by contact, contests recorded.',
      failMessage: '✗ Not yet.',
      outputHeight: 440,
    },

  ],
};

const PY_CELLS = [
  {
    id: 'setup',
    cellTitle: 'A part whose answer is already known',
    prose: [
      'To measure whether an attribution rule is right, you need faces whose correct answer is known independently of the rule. Real parts do not come with that, so build a synthetic one where every tool envelope is exact.',
      'The geometry is a step: a lower floor, a wall, an upper floor. Five operations machined it, each a ball-nose tool of known radius following a known centre path. A ball nose removes everything within one radius of its centre path, so a point that survives on the final surface was contacted by an operation exactly when its distance to that centre path equals the radius - it sits on the envelope.',
      'That contact test is the ground truth. No heuristic below is given it; they all have to earn their answers from distance and ordering alone.',
    ],
    code: `import numpy as np
from scipy.spatial import cKDTree

EPS = 0.004          # how close to the envelope counts as contact
STOCK = 0.30         # what roughing leaves above the final surface

def grid(xs, ys, zs):
    X, Y, Z = np.meshgrid(xs, ys, zs, indexing='ij')
    return np.column_stack([X.ravel(), Y.ravel(), Z.ravel()])

ys = np.linspace(0.25, 5.75, 120)
ops = []
def add_op(name, order, r, centres, leaves):
    ops.append(dict(name=name, order=order, r=r,
                    tree=cKDTree(centres), leaves=leaves, n=len(centres)))

add_op('rough', 1, 1.00, np.vstack([
    grid(np.linspace(1.0, 5.0, 60), ys, [0.3 + 1.00]),
    grid(np.linspace(7.0, 9.0, 30), ys, [2.3 + 1.00])]), 0.30)
add_op('floor-finish', 2, 0.25, grid(np.linspace(0.25, 5.75, 180), ys, [0.25]), 0.0)
add_op('wall-finish',  3, 0.25, grid([5.75], ys, np.linspace(0.25, 2.00, 90)), 0.0)
add_op('upper-finish', 4, 0.25, grid(np.linspace(6.25, 9.75, 120), ys, [2.25]), 0.0)
add_op('spring',       5, 0.25, grid(np.linspace(2.0, 4.0, 70), ys, [0.25]), 0.0)

surface = np.vstack([
    grid(np.linspace(0, 6, 240), np.linspace(0, 6, 90), [0.0]),
    grid([6.0], np.linspace(0, 6, 90), np.linspace(0, 2, 80)),
    grid(np.linspace(6, 10, 160), np.linspace(0, 6, 90), [2.0])])

D = np.column_stack([o['tree'].query(surface)[0] for o in ops])
R = np.array([o['r'] for o in ops])
ORDER = np.array([o['order'] for o in ops])
NAMES = [o['name'] for o in ops]
LEAVES = np.array([o['leaves'] for o in ops])

contact = np.abs(D - R[None, :]) <= EPS
any_contact = contact.any(axis=1)
truth = np.full(len(surface), -1)
truth[any_contact] = np.argmax(np.where(contact, ORDER[None, :], -1)[any_contact], axis=1)
known = truth >= 0

for o in ops:
    print(f"  {o['order']}. {o['name']:<14} r={o['r']:.2f}  leaves {o['leaves']:.2f}  "
          f"{o['n']:>6,} centre points")
print()
print(f'  {len(surface):,} surface points')
print(f'  {int(any_contact.sum()):,} touched by at least one operation '
      f'({100*any_contact.mean():.1f}%)')
print(f'  {int((~any_contact).sum()):,} touched by NOTHING '
      f'({100*(~any_contact).mean():.1f}%)')
print()
print('  That last group is not a bug. A 0.25 radius ball nose cannot reach into')
print('  a square internal corner, so a fillet of stock is left there. "No')
print('  operation is responsible" is a real answer, and a process that cannot')
print('  return it will invent one.')`,
  },
  {
    id: 'nearest',
    cellTitle: 'Nearest is wrong, and it is wrong systematically',
    prose: [
      'The first rule anyone writes is nearest: attribute each face to whichever toolpath passes closest. Score it against the ground truth, along with the obvious improvement of measuring to the tool surface instead of its centre.',
      'Then look at where the errors are. If they were scattered noise you could argue about tolerances. They are not - they form a band along the wall, because the failure has a direction.',
      'The reason is geometric and unavoidable: a tool centre sits one radius from the face it cut. A large rougher is therefore far from its own work while a small finisher merely passing by is close. Ranking faces by distance to a centre path ranks them by tool size.',
    ],
    code: `h_nearest = np.argmin(D, axis=1)
h_surface = np.argmin(np.abs(D - R[None, :]), axis=1)

acc_n = float((h_nearest[known] == truth[known]).mean())
acc_s = float((h_surface[known] == truth[known]).mean())

print(f"{'rule':<34} {'correct':>9}")
print(f"{'nearest tool centre path':<34} {100*acc_n:>8.1f}%")
print(f"{'nearest tool surface':<34} {100*acc_s:>8.1f}%")
print(f"{'contacted, then latest':<34} {100.0:>8.1f}%   (the truth)")
print()
print('Note the middle row: measuring to the tool SURFACE instead of its centre')
print('is the obvious improvement, and it is slightly WORSE. Ranking by distance')
print('is the problem, not which distance you rank by.')

wrong = known & (h_nearest != truth)
picked, actual = np.array(NAMES)[h_nearest[wrong]], np.array(NAMES)[truth[wrong]]
print()
print('where nearest is wrong, what it names instead:')
for nm in sorted(set(picked)):
    sel = picked == nm
    print(f'  picked {nm:<14} {int(sel.sum()):>6,} times, '
          f'actually {", ".join(sorted(set(actual[sel])))}')

floor_wrong = surface[wrong][np.abs(surface[wrong][:, 2]) < 1e-9]
print()
print(f'those wrong floor points run from x = {floor_wrong[:,0].min():.3f} '
      f'to x = {floor_wrong[:,0].max():.3f}')
print(f'a band {floor_wrong[:,0].max()-floor_wrong[:,0].min():.3f} wide against '
      f'a wall at x = 6.000')
print()
print('A band, not scatter. And it sits exactly where somebody inspects.')`,
  },
  {
    id: 'contested',
    cellTitle: 'How much of the part is genuinely contested',
    prose: [
      'The section says to record contested cases rather than silently hiding ambiguity. Before deciding how to record them, measure how many there are - a rule that quietly resolves 2% of faces is a different proposition from one that quietly resolves a fifth of them.',
      'A face is contested when more than one operation actually made contact. That is not a failure of the code and not a tolerance problem; it is a fact about how the part was machined. A spring pass over a finished floor contests every face it covers, by construction.',
      'What matters downstream is that a face with one claimant and a face with three currently come back looking equally confident.',
    ],
    code: `n_contact = contact.sum(axis=1)
contested = n_contact >= 2

print(f'  touched by exactly one operation : {int((n_contact == 1).sum()):>7,}')
print(f'  touched by two or more           : {int(contested.sum()):>7,} '
      f'({100*contested.sum()/known.sum():.1f}% of attributed surface)')
print()
pairs = {}
for i in np.flatnonzero(contested):
    key = ' + '.join(sorted(np.array(NAMES)[contact[i]]))
    pairs[key] = pairs.get(key, 0) + 1
print('  which operations contest each other:')
for k, v in sorted(pairs.items(), key=lambda kv: -kv[1]):
    print(f'    {k:<34} {v:>7,}')
print()
print('  Every one of those is a face where some rule picks a winner and')
print('  nothing downstream records that there was a contest. The answer looks')
print('  exactly as confident as a face only one tool ever touched.')`,
  },
  {
    id: 'responsible',
    cellTitle: 'Responsible is not finished',
    prose: [
      'Two rules, both defensible. Most material removed answers "what moved the metal". Last to touch answers "what determined the final surface". They are not the same question and they do not give the same answer.',
      'Computing removal correctly matters more than it looks. How much an operation removed at a point depends on what was there when it ran - the leave of the previous operation that contacted that same point. That is per-point, not a property of the operation. Getting it wrong scores a spring pass as removing as much as the finish pass it follows, which quietly erases the whole distinction.',
      'This is the generic form of a real bug: colour by "material moved" and a roughing pass gets drawn as though it were the finisher.',
    ],
    code: `removed = np.full(contact.shape, -1.0)
for i in np.flatnonzero(any_contact):
    cands = np.flatnonzero(contact[i])
    standing = STOCK                      # what is left above the final face
    for c in cands[np.argsort(ORDER[cands])]:
        removed[i, c] = standing - LEAVES[c]
        standing = LEAVES[c]

print('  how much each operation removed, where it contacted:')
for j, nm in enumerate(NAMES):
    v = removed[contact[:, j], j]
    if len(v):
        print(f'    {nm:<14} min {v.min():.3f}  max {v.max():.3f}  '
              f'on {len(v):>6,} points')

h_most = np.argmax(removed, axis=1)
agree = int((h_most[known] == truth[known]).sum())
print()
print(f'  "last to touch" and "most removed" agree on '
      f'{100*agree/known.sum():.1f}% of attributed surface')
disagree = known & (h_most != truth)
print(f'  they disagree on {int(disagree.sum()):,} points:')
for nm in sorted(set(np.array(NAMES)[truth[disagree]])):
    sel = disagree & (np.array(NAMES)[truth] == nm)
    alt = sorted(set(np.array(NAMES)[h_most[sel]]))
    print(f'    last = {nm:<14} most-removed = {", ".join(alt):<16} '
          f'{int(sel.sum()):>6,} points')
print()
print('  Neither rule is wrong. A system that does not say which one it')
print('  implements has not chosen - it has defaulted to whatever the code did.')`,
  },
  {
    id: 'spring',
    cellTitle: 'The pass that removes nothing, and why a threshold cannot help',
    prose: [
      'A spring pass contacts the face and takes off nothing measurable, and it still determined the finish. Lesson 11 built the instinct to reach for a threshold, so test whether one can work here.',
      'Set up the comparison honestly: the spring pass reads about zero because it removed about zero, and an operation that never touched the face also reads about zero. Both are noise around the same value.',
      'Lesson 11 showed a threshold trading one error against another, which is a real if uncomfortable choice. This is a different situation - there is nothing to trade, because the two populations are the same measurement. The conclusion is not a better threshold but a different input.',
    ],
    code: `rng = np.random.default_rng(5)
NOISE = 0.0008
n = int((known & (truth == NAMES.index('spring'))).sum())

spring_reading = np.abs(rng.normal(0, NOISE, size=n))   # contacted, removed ~0
absent_reading = np.abs(rng.normal(0, NOISE, size=n))   # never touched the face

print(f'{"threshold":>11} {"spring kept":>13} {"absent rejected":>17}')
for thr in (0.0000, 0.0005, 0.0010, 0.0020, 0.0050):
    print(f'{thr:>11.4f} {100*(spring_reading > thr).mean():>12.1f}% '
          f'{100*(absent_reading <= thr).mean():>16.1f}%')

best = max((spring_reading > t).mean() + (absent_reading <= t).mean()
           for t in np.linspace(0, 0.01, 201))
print()
print(f'best achievable kept + rejected, over ANY threshold: {best:.3f} of 2.000')
print()
print('Every row trades one for the other exactly, and the best case is no')
print('better than a coin. On a depth reading the two populations are')
print('identical, so there is nothing for a threshold to separate.')
print()
print('The fix is a different input: whether the tool envelope reached the face')
print('at all. That is geometry, not measurement - which is why the correct')
print('rule is "contacted, then latest" and not a ranking of depths.')`,
  },
  {
    id: 'order',
    cellTitle: 'The order of the rules is itself a rule',
    prose: [
      'An attribution process is a sequence of rules applied until one candidate remains. Which rules you use is an obvious decision. The order you apply them in is an easy one to make by accident.',
      'Run the same rules on the same evidence in three different orders and measure how many faces change hands. Nothing about the part changes and nothing about the rules changes.',
      'Watch the tie-break at the end too. When rules run out and more than one candidate survives, something still has to pick - and taking the first in the list is an unwritten rule that nobody agreed to.',
    ],
    code: `def attribute(rule_order):
    out = np.full(len(surface), -1)
    for i in np.flatnonzero(known):
        cands = np.flatnonzero(contact[i])
        for rule in rule_order:
            if len(cands) <= 1:
                break
            if rule == 'latest':
                cands = cands[ORDER[cands] == ORDER[cands].max()]
            elif rule == 'most-removed':
                cands = cands[removed[i, cands] == removed[i, cands].max()]
            elif rule == 'smallest-tool':
                cands = cands[R[cands] == R[cands].min()]
        out[i] = cands[0]      # an unwritten rule, and the point of the exercise
    return out

orders = {
    'latest, then most-removed':  ['latest', 'most-removed'],
    'most-removed, then latest':  ['most-removed', 'latest'],
    'smallest-tool, then latest': ['smallest-tool', 'latest'],
}
results = {k: attribute(v) for k, v in orders.items()}
base = results['latest, then most-removed']
for k, v in results.items():
    d = int((v[known] != base[known]).sum())
    print(f'  {k:<30} differs from the first on {d:>6,} points '
          f'({100*d/known.sum():.1f}%)')
print()
print('  Nothing about the part changed. The rules did not change. One fifth of')
print('  the answers moved. So the ordering is not an implementation detail - it')
print('  is part of the specification, and it belongs somewhere a person can')
print('  disagree with it.')`,
  },
  {
    id: 'ch-contact',
    challengeType: 'write',
    challengeTitle: 'Contact, not distance',
    difficulty: 'warm-up',
    prompt:
      'Write contacted_by(i) returning the indices of every operation whose envelope '
      + 'touches surface point i, and nearest_op(i) returning the index of the operation '
      + 'whose centre path is closest. Then set differ to the number of attributed points '
      + 'where the nearest operation is not among the ones that actually made contact.',
    hint:
      'contact[i] is already a boolean row - np.flatnonzero turns it into indices. '
      + 'D[i] holds the distance from point i to each centre path. A point counts for '
      + 'differ only where known[i] is True.',
    code: `def contacted_by(i):
    # TODO
    pass


def nearest_op(i):
    # TODO
    pass


differ = None
# TODO: attributed points where nearest is not among the contacting operations

print('nearest never touched the face on', differ, 'points')`,
    solution: `def contacted_by(i):
    return np.flatnonzero(contact[i])


def nearest_op(i):
    return int(np.argmin(D[i]))


differ = int(sum(1 for i in np.flatnonzero(known)
                 if nearest_op(i) not in set(contacted_by(i).tolist())))

print('nearest never touched the face on', differ, 'points')`,
    testCode: `assert differ is not None, "differ was never set."

# Against the ground truth already in scope.
_ref = int(sum(1 for i in np.flatnonzero(known)
               if int(np.argmin(D[i])) not in set(np.flatnonzero(contact[i]).tolist())))
assert differ == _ref, f"differ came out {differ}, expected {_ref}"
assert differ > 0, (
    "no point had a nearest operation that never touched it - that is the "
    "whole finding, so something is wrong with the contact test")

# contacted_by must use the envelope test, not a distance ranking.
for _i in np.flatnonzero(known)[::53]:
    _got = sorted(int(x) for x in contacted_by(_i))
    _want = sorted(int(x) for x in np.flatnonzero(contact[_i]))
    assert _got == _want, (
        f"at point {_i} contacted_by gave {_got}, expected {_want}. Contact is "
        f"|distance - radius| <= EPS, not the smallest distance.")

# And the disagreements must sit where the lesson says they do. Slicing the
# FIRST few thousand points would find none - the grid runs x-major, so those
# are all far from the wall. Stride across the whole part.
_disagreements = [i for i in np.flatnonzero(known)
                  if nearest_op(i) not in set(np.flatnonzero(contact[i]).tolist())]
assert _disagreements, (
    "nearest_op and contacted_by never disagreed - check that nearest_op ranks "
    "by raw distance in D, not by |D - R|")
_xs = surface[_disagreements][:, 0]
assert _xs.min() > 1.5, (
    f"the disagreements start at x = {_xs.min():.3f}. Measured, they form a "
    f"band against the wall at x = 6.000, not scatter across the whole floor.")
"SUCCESS: a tool's centre sits one radius from its own work, so ranking by distance ranks by tool size. Contact is a different test, not a tighter one."`,
  },
  {
    id: 'ch-attribute',
    challengeType: 'write',
    challengeTitle: 'Attribute, and record the contest',
    difficulty: 'core',
    prompt:
      'Write attribute_point(i) returning a dict with keys operation (the name of the '
      + 'latest contacting operation, or None when nothing reached the point), contested '
      + '(True when two or more contacted it) and candidates (the names of all of them). '
      + 'Then set summary to a dict with counts for unattributed, single and contested.',
    hint:
      'Use contacted_by from the previous challenge, or np.flatnonzero(contact[i]). '
      + 'Latest means the largest ORDER among the contacting indices. An empty candidate '
      + 'list must give operation None rather than an exception or a guess.',
    code: `def attribute_point(i):
    # TODO
    pass


summary = None
# TODO: {'unattributed': n, 'single': n, 'contested': n} over every surface point

print(summary)`,
    solution: `def attribute_point(i):
    cands = np.flatnonzero(contact[i])
    names = [NAMES[c] for c in cands]
    if len(cands) == 0:
        return {'operation': None, 'contested': False, 'candidates': []}
    latest = cands[int(np.argmax(ORDER[cands]))]
    return {'operation': NAMES[latest],
            'contested': len(cands) >= 2,
            'candidates': names}


summary = {'unattributed': 0, 'single': 0, 'contested': 0}
for i in range(len(surface)):
    r = attribute_point(i)
    if r['operation'] is None:
        summary['unattributed'] += 1
    elif r['contested']:
        summary['contested'] += 1
    else:
        summary['single'] += 1

print(summary)`,
    testCode: `assert summary is not None, "summary was never set."
for _k in ('unattributed', 'single', 'contested'):
    assert _k in summary, f'summary is missing "{_k}"'
assert sum(summary.values()) == len(surface), (
    f"the three counts total {sum(summary.values())} but there are "
    f"{len(surface)} surface points - every point falls in exactly one group")

assert summary['unattributed'] == int((~any_contact).sum()), (
    f"unattributed came out {summary['unattributed']}, expected "
    f"{int((~any_contact).sum())} - the corner fillet no tool can reach")
assert summary['contested'] == int((contact.sum(axis=1) >= 2).sum()), (
    f"contested came out {summary['contested']}, expected "
    f"{int((contact.sum(axis=1) >= 2).sum())}")
assert summary['contested'] > 0.15 * known.sum(), (
    "the contested group should be a large minority of the attributed surface, "
    "not a rounding error - measured, it is over a fifth")

# A point nothing reached must come back as None, not as a guess.
_empty = int(np.flatnonzero(~any_contact)[0])
_r = attribute_point(_empty)
assert _r['operation'] is None, (
    f'point {_empty} was touched by nothing, but attribute_point named '
    f'"{_r["operation"]}". "No operation is responsible" is a real answer.')
assert _r['candidates'] == [], "a point nothing reached has no candidates"

# A contested point must name the LATEST, not the first.
_c = int(np.flatnonzero(contact.sum(axis=1) >= 2)[0])
_r = attribute_point(_c)
_cands = np.flatnonzero(contact[_c])
assert _r['contested'] is True, f"point {_c} has {len(_cands)} claimants"
assert _r['operation'] == NAMES[_cands[int(np.argmax(ORDER[_cands]))]], (
    f'at a contested point you named "{_r["operation"]}". The rule is the '
    f'LATEST contacting operation by order, which is how a spring pass that '
    f'removed nothing still owns the face it finished.')
"SUCCESS: contested faces are now reported as contested instead of being resolved silently, and the corner fillet comes back as None instead of a guess."`,
  },
  {
    id: 'ch-order',
    challengeType: 'write',
    challengeTitle: 'Show that the order is a decision',
    difficulty: 'stretch',
    prompt:
      'Write resolve(i, rule_order) applying the named rules in sequence to the '
      + 'candidates at point i until one remains, returning the surviving operation '
      + 'name. Support "latest", "most-removed" and "smallest-tool". Then set '
      + 'disagreement to the number of attributed points where ["latest","most-removed"] '
      + 'and ["most-removed","latest"] give different answers.',
    hint:
      'Narrow the candidate array with each rule: latest keeps ORDER == max, '
      + 'most-removed keeps removed[i] == max, smallest-tool keeps R == min. Stop early '
      + 'once one candidate is left, and take the first survivor at the end.',
    code: `def resolve(i, rule_order):
    # TODO
    pass


disagreement = None
# TODO: attributed points where the two orderings disagree

print('the two orderings disagree on', disagreement, 'points')`,
    solution: `def resolve(i, rule_order):
    cands = np.flatnonzero(contact[i])
    if len(cands) == 0:
        return None
    for rule in rule_order:
        if len(cands) <= 1:
            break
        if rule == 'latest':
            cands = cands[ORDER[cands] == ORDER[cands].max()]
        elif rule == 'most-removed':
            cands = cands[removed[i, cands] == removed[i, cands].max()]
        elif rule == 'smallest-tool':
            cands = cands[R[cands] == R[cands].min()]
    return NAMES[cands[0]]


disagreement = int(sum(1 for i in np.flatnonzero(known)
                       if resolve(i, ['latest', 'most-removed'])
                       != resolve(i, ['most-removed', 'latest'])))

print('the two orderings disagree on', disagreement, 'points')`,
    testCode: `assert disagreement is not None, "disagreement was never set."
assert disagreement > 0, (
    "the two orderings agreed everywhere. If removal is computed per OPERATION "
    "rather than per POINT, a spring pass scores the same removal as the finish "
    "pass it follows and the distinction vanishes.")
assert disagreement > 0.1 * known.sum(), (
    f"only {disagreement} points ({100*disagreement/known.sum():.1f}%) changed; "
    f"measured, reordering these two rules moves about a fifth of the answers")

# "latest first" must reproduce the ground truth exactly.
_sample = np.flatnonzero(known)[::97]
for _i in _sample:
    assert resolve(int(_i), ['latest', 'most-removed']) == NAMES[truth[_i]], (
        f"at point {_i} 'latest first' gave {resolve(int(_i), ['latest','most-removed'])} "
        f"but the truth is {NAMES[truth[_i]]}")

# A point nothing reached has nothing to resolve.
assert resolve(int(np.flatnonzero(~any_contact)[0]), ['latest']) is None, (
    "a point no tool reached should resolve to None, not to a candidate")

# Rule order must actually be honoured, not ignored.
_c = int(np.flatnonzero(contact.sum(axis=1) >= 2)[0])
assert resolve(_c, ['latest']) is not None
"SUCCESS: same part, same rules, same evidence - and a fifth of the answers move when the order changes. The order is part of the specification, not an implementation detail."`,
  },
];

export default {
  id: 'mesh-engine-1-12-attribution',
  slug: 'attribution',
  chapter: 'mesh-engine.1',
  order: 11,
  title: 'Attribution',
  subtitle: 'Which operation is responsible for this face, and what to do when more than one could be.',
  tags: [
    'attribution', 'candidates', 'contact', 'tool envelope', 'contested',
    'ambiguity', 'responsibility', 'rule order', 'spring pass', 'provenance',
  ],
  aliases: 'attribution attribute face to operation responsible tool candidate selection contested ambiguous nearest is not responsible tool envelope contact test rule order provenance spring pass material removed last to touch',
  timeToComplete: 70,
  coreConcept:
    'Attributing a face to the operation that made it looks like a nearest-neighbour problem and is not. A tool centre sits one radius from the face it cut, so ranking faces by distance to a centre path ranks them by tool size - measured, nearest is wrong on 10.2% of a part, in a band 3.816 wide along a wall rather than scattered as noise. The correct test is contact: a final-surface point was touched by an operation when its distance to that centre path equals the tool radius. On top of that sits a choice nobody makes deliberately, because "most material removed" and "last to touch" are both defensible and disagree on 20.5% of the surface - and reordering the same two rules moves the same fifth of the answers. Two outcomes must be representable that usually are not: 17.2% of the surface was reached by no tool at all (the corner fillet), and 22.1% of the attributed surface has two or more legitimate claimants.',
  prerequisites: ['mesh-engine-1-11-thresholds'],
  nextLesson: 'mesh-engine-2-1-coordinate-systems',

  semantics: {
    core: [
      { symbol: 'nearest', meaning: 'The toolpath passing closest to a face. Ranks by tool size, not by responsibility.' },
      { symbol: 'contact: |d − r| ≤ ε', meaning: 'The face lies on this tool’s envelope, so this tool actually touched it. Geometry, not measurement.' },
      { symbol: 'responsible', meaning: 'The operation whose tool contacted the face. More than one can qualify.' },
      { symbol: 'finished', meaning: 'The operation that determined the face’s final condition — the latest to contact it, even if it removed nothing.' },
      { symbol: 'contested', meaning: 'Two or more operations made contact. A fact about the part, not a failure of the code.' },
      { symbol: 'null / unattributed', meaning: 'No tool envelope reached the face. A real answer, and code that cannot return it invents one.' },
      { symbol: 'rule order', meaning: 'The sequence rules are applied in. Part of the specification: reordering two rules moved 20.5% of the answers.' },
    ],
    rulesOfThumb: [
      'Attribute by contact, never by a distance ranking. A tool’s centre is one radius from its own work.',
      'Make "no operation reached this face" a representable answer before writing any rule.',
      'Carry the full candidate list alongside the winner, so a contested face is distinguishable from a certain one.',
      'Say which question the system answers — what moved the metal, or what determined the surface. They differ on a fifth of the part.',
      'Write the rule order down where somebody can disagree with it, and name the final tie-break instead of letting it be list position.',
      'Compute material removed per point, from what the previous contacting operation left. Per-operation removal erases the spring pass.',
      'When two populations are the same measurement, no threshold separates them. Change the input, not the number.',
    ],
  },

  hook: {
    question: 'A floor and a wall meet at a corner, each finished by its own 0.25 tool. You attribute every floor face to whichever toolpath passes closest. How much of the floor gets the wall’s operation?',
    realWorldContext: 'A band 3.816 wide against the wall, measured — and the errors are not scattered noise, they are a contiguous strip sitting exactly where somebody inspects. The cause is geometric and unavoidable: a tool’s centre path sits one full radius from the face it cut, so a large rougher is far from its own work while a small finisher merely passing by is close. Ranking by distance to a centre path ranks by tool size. Overall, nearest is wrong on 10.2% of the part, and the obvious improvement — measuring to the tool surface instead of the centre — scores 89.4%, slightly worse. The fix is not a better distance. It is a different test.',
    previewVisualizationId: 'JSNotebook',
  },

  intuition: {
    prose: [
      'Every lesson so far answered how far, which side, or how much. This one asks who did it.',
      'That looks like the same machinery, so the first answer is always nearest — and nearest encodes tool size, not responsibility.',
      'Contact is the right test, because a face on the final surface lies exactly one radius from the centre path of whatever cut it.',
      'Contact often returns more than one operation, which is a fact about the part rather than a problem to resolve away.',
      'It also sometimes returns none, because a round tool cannot reach a square corner.',
      'And once several candidates are legitimate, choosing between them is a rule set whose order is part of the specification.',
    ],
    callouts: [
      {
        type: 'warning',
        title: 'Ranking by distance ranks by tool size',
        body: 'A tool’s centre path sits one full radius from the face it cut. So a 1.00-radius rougher is 1.00 away from its own work while a 0.25 finisher merely passing by is 0.25 away. Measured: nearest-centre is correct on 89.8%, wrong on 10.2%, and the errors form a band 3.816 wide along the wall rather than scattering. Measuring to the tool surface instead scores 89.4% — slightly worse. The problem is the ranking, not the distance.',
      },
      {
        type: 'insight',
        title: 'Contact is a geometric test, not a measurement',
        body: 'A point that survives on the final surface was touched by an operation exactly when its distance to that operation’s centre path equals the tool radius — it lies on the envelope. Closer than that and the tool would have cut it away. This is why contact succeeds where every depth-based rule fails: it asks whether the tool could have been there, which the geometry answers exactly, instead of how much came off, which the measurement cannot resolve.',
      },
      {
        type: 'warning',
        title: 'Two outcomes most code cannot represent',
        body: 'Measured on one part: 17.2% of the surface was reached by no tool at all — a 0.25-radius ball nose cannot get into a square internal corner, so a fillet of stock is left. And 22.1% of the attributed surface had two or more operations make contact. Code that returns a single operation per face cannot say either thing, so it says something else instead, with no indication that it did.',
      },
      {
        type: 'insight',
        title: 'Two defensible rules, disagreeing on a fifth of the part',
        body: '"Most material removed" and "last to touch" agree on 79.5% and disagree on 7,332 points. On 6,840 of those, last = spring and most-removed = floor-finish: the spring pass contacted the face and removed 0.000, while the finish pass before it removed 0.300. Neither answer is wrong — they answer different questions. A system that does not say which one it implements has not chosen, it has defaulted.',
      },
      {
        type: 'warning',
        title: 'Here a threshold cannot help at all',
        body: 'A spring pass reads about zero because it removed about zero. An operation that never touched the face also reads about zero. Sweeping a minimum-removal threshold: best achievable kept-plus-rejected is 1.008 out of 2.000, no better than a coin. Lesson 11 showed a threshold trading one error against another, which is a real choice. Here there is nothing to trade, because the two populations are the same measurement. Change the input, not the number.',
      },
      {
        type: 'insight',
        title: 'The order of the rules is part of the specification',
        body: 'Same part, same candidates, same evidence. "latest, then most-removed" against "most-removed, then latest" differ on 7,332 points — 20.5% of the attributed surface. Nothing about the geometry changed and no rule changed. And when the rules run out with several candidates still standing, something still picks: taking the first in the list is an unwritten rule nobody agreed to.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Slide a probe along the floor and watch the rules disagree',
        caption: 'Tool envelopes, contact tests and three rules, live on a cross-section.',
        props: {
          lesson: LESSON_MESH_1_12,
        },
      },
    ],
  },

  math: {
    prose: [
      'The first cell builds a part whose answer is known independently of any rule, which is the only way to score one.',
      'Then nearest, scored and dissected — including why its errors form a band rather than scatter.',
      'Then the two things most attribution code cannot represent: contested faces, and faces no tool reached.',
      'Then the responsible-versus-finished split, the spring pass that defeats every threshold, and the ordering that moves a fifth of the answers.',
    ],
    visualizations: [
      {
        id: 'PythonNotebook',
        title: 'Contact, contest, and the rules that sit on top',
        mathBridge: 'A ball-nose tool of radius r following a centre path removes every point within r of that path — the swept volume is the Minkowski sum of the path with a ball. A point that survives on the final surface therefore cannot be closer than r to any path that ran, and it was touched by a given operation exactly when its distance equals r: it lies on the boundary of that operation’s swept volume. So "did this tool touch this face" reduces to a distance query of precisely the kind lessons 5 to 9 built, evaluated against r rather than minimised. The attribution problem is not a new geometric machine; it is the same machine asked a different question.',
        caption: 'Every figure measured on a part whose tool envelopes are known exactly.',
        props: {
          initialCells: PY_CELLS,
        },
      },
    ],
  },

  examples: [
    {
      title: 'The band along the wall',
      prose: 'Floor points from x = 1.958 to x = 5.774 — a strip 3.816 wide against a wall at x = 6.000 — get attributed to the wall operation or the wrong floor pass by nearest-centre. Contiguous, not scattered, and exactly where inspection happens.',
    },
    {
      title: 'The corner nothing made',
      prose: '7,436 of 43,200 surface points (17.2%) were reached by no tool envelope at all. A 0.25-radius ball nose cannot enter a square internal corner. "No operation is responsible" is the correct answer there.',
    },
    {
      title: 'The pass that removed nothing and owns the face',
      prose: 'Over 6,840 points the spring pass removed 0.000 while the finish pass before it removed 0.300. Last-to-touch names the spring pass; most-removed names the finish pass. Both are defensible.',
    },
    {
      title: 'A fifth of the answers, from the order alone',
      prose: 'Swapping "latest" and "most-removed" in the rule sequence moved 7,332 points — 20.5% of the attributed surface — with no change to the part, the candidates or the rules themselves.',
    },
  ],

  challenges: [
    {
      prompt: 'Separate contact from proximity, and count the faces where the nearest toolpath never touched them.',
      hint: 'Contact is |distance − radius| ≤ eps. Nearest is the smallest distance. They are different tests, not tighter and looser versions of one.',
    },
    {
      prompt: 'Attribute a face to the latest contacting operation, report the contest, and return null when nothing reached it.',
      hint: 'An empty candidate list must produce null rather than an exception or a guess.',
    },
    {
      prompt: 'Apply the same rules in two orders and measure how many faces change hands.',
      hint: 'Narrow the candidate set with each rule in turn. Removal has to be computed per point, or the spring pass disappears.',
    },
    {
      prompt: 'In the browser, attribute by contact on a cross-section and flag contested faces.',
      hint: 'Four outcomes have to be representable: one claimant, several, none, and the nearest path that never touched the face.',
    },
  ],

  misconceptions: [
    {
      claim: 'The operation whose toolpath is closest is the one that made the face.',
      reality: 'A tool’s centre sits one radius from the face it cut, so distance ranks by tool size. Measured, nearest-centre is wrong on 10.2% of a part, concentrated in a band 3.816 wide along a wall.',
    },
    {
      claim: 'Measuring to the tool surface instead of the centre fixes it.',
      reality: 'Measured at 89.4% against nearest-centre’s 89.8% — slightly worse. Ranking by distance is the problem; the correct test is contact, which asks whether the envelope reached the face at all.',
    },
    {
      claim: 'Every face was made by some operation.',
      reality: '17.2% of the measured surface was reached by no tool envelope. A round tool cannot enter a square corner, so a fillet of stock remains. Code that cannot return "none" will name something.',
    },
    {
      claim: 'Ambiguity is rare enough to resolve silently.',
      reality: '22.1% of the attributed surface had two or more operations make contact. A face with one claimant and a face with three currently come back looking equally confident.',
    },
    {
      claim: 'Colouring by material removed shows which operation finished each face.',
      reality: 'It shows what moved metal. Measured, that disagrees with what determined the surface on 7,332 points — including 6,840 where a spring pass removed 0.000 and finished the face.',
    },
    {
      claim: 'A minimum-removal threshold will filter out operations that did not really do anything.',
      reality: 'A spring pass and an operation that never touched the face are the same depth reading. Best achievable over any threshold is 1.008 of 2.000 — no better than a coin. Change the input, not the number.',
    },
    {
      claim: 'Which rules you use matters; the order is an implementation detail.',
      reality: 'Reordering two rules moved 20.5% of the answers on an unchanged part. And the final tie-break — usually list position — is an unwritten rule nobody agreed to.',
    },
  ],

  transferPrompts: [
    'A face is coloured as belonging to an operation that a machinist says never went near it. What would you check first?',
    'Your attribution returns exactly one operation for every face on the part. What does that tell you before you look at any of the answers?',
    'Someone proposes filtering out operations that removed less than a small amount. What would you ask them to measure first?',
    'Two engineers disagree about which operation owns a face and both have a defensible argument. What does that mean the system is missing?',
    'Where else does a system quietly pick a winner among equals, and what would it cost to record the contest instead?',
  ],

  debugging: [
    {
      symptom: 'Faces near a wall or a corner are attributed to the wrong operation.',
      cause: 'Attribution is ranking by distance to a centre path, which ranks by tool size.',
      fix: 'Switch to a contact test: |distance − radius| ≤ eps. Measured, that takes the same part from 89.8% to 100%.',
    },
    {
      symptom: 'Every face has exactly one operation and nothing is ever ambiguous.',
      cause: 'The data structure cannot represent a contest, so a rule is resolving one silently.',
      fix: 'Return the full candidate list alongside the winner. Measured, 22.1% of the attributed surface has two or more claimants.',
    },
    {
      symptom: 'Corners and fillets are attributed to a nearby operation that could not physically reach them.',
      cause: '"No operation" is not a representable answer, so something else is returned.',
      fix: 'Make null a first-class outcome. Measured, 17.2% of a surface was reached by no envelope at all.',
    },
    {
      symptom: 'A roughing pass is displayed as though it finished a face.',
      cause: 'The rule is "most material removed", which answers a different question from "what determined the surface".',
      fix: 'Decide which question the system answers and name it. Measured, they disagree on 20.5% of the surface.',
    },
    {
      symptom: 'A spring pass or a zero-offset pass never appears in the results.',
      cause: 'Removal is computed per operation rather than per point, or a minimum-removal threshold is filtering it out.',
      fix: 'Compute removal from what the previous contacting operation left at that point, and attribute by contact rather than by depth.',
    },
    {
      symptom: 'Results changed after a refactor that did not change any rule.',
      cause: 'The order the rules are applied in changed, or the final tie-break moved with list order.',
      fix: 'Write the ordering and the tie-break into the specification. Measured, reordering two rules moved a fifth of the answers.',
    },
  ],

  mastery: {
    prerequisites:
      'Lessons 5 to 9 for the distance machine this reuses, lesson 10 for envelopes and contact, and lesson 11 for the habit of asking whether a threshold can separate two populations before reaching for one.',
    signals: [
      'Reaches for a contact test rather than a nearest-neighbour ranking.',
      'Treats "no operation" and "several operations" as answers to be returned, not cases to be avoided.',
      'States which question an attribution answers before arguing about the rules.',
      'Computes material removed per point rather than per operation.',
      'Writes the rule order and the tie-break down as specification.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'mesh-engine-1-10-signed-distance', why: 'Envelopes, contact and the difference between a presence test and a magnitude.' },
      { lessonId: 'mesh-engine-1-9-bvh', why: 'The spatial index that makes a contact query over many toolpaths affordable.' },
      { lessonId: 'mesh-engine-1-11-thresholds', why: 'Why a threshold trades errors, and how to tell when it cannot trade at all.' },
      { lessonId: 'mesh-engine-1-6-point-to-mesh', why: 'Ties, and why the winner of a near-tie is decided by storage order.' },
    ],
    futureLinks: [],
  },

  checkpoints: [
    'I can say why nearest ranks by tool size rather than by responsibility.',
    'I can write the contact test and explain why it is geometry rather than measurement.',
    'I can name the two outcomes most attribution code cannot represent.',
    'I can distinguish "what moved the metal" from "what determined the surface" and say how far apart they are.',
    'I can explain why no threshold separates a spring pass from an absent operation.',
    'I can show that the order of the rules changes the answer.',
  ],

  assessment: {
    task: 'Given a surface and a set of operations, produce an attribution that is defensible and says what it does not know.',
    acceptance: [
      'Attribution by contact against the tool envelope, not by a distance ranking.',
      'Faces reached by no operation returned as such, not assigned to the nearest thing.',
      'The full candidate list carried alongside the winner, and contested faces flagged.',
      'A stated answer to which question the attribution answers, and why.',
      'Material removed computed per point from the previous contacting operation.',
      'The rule order and the final tie-break written down as specification.',
    ],
  },

  quiz: [
    {
      question: 'Why does attributing a face to the nearest toolpath fail?',
      options: [
        'A tool’s centre sits one radius from the face it cut, so distance ranks by tool size',
        'Toolpaths are stored at too low a resolution',
        'Floating-point error in the distance calculation',
        'It does not fail; it is the standard method',
      ],
      answer: 0,
      explanation: 'Measured: nearest-centre is wrong on 10.2% of a part, in a band 3.816 wide along a wall. A 1.00 rougher is 1.00 from its own work; a 0.25 finisher passing by is 0.25 away.',
    },
    {
      question: 'What is the contact test for a point on the final surface?',
      options: [
        'Its distance to the tool centre path equals the tool radius, within a tolerance',
        'Its distance to the tool centre path is smaller than for any other tool',
        'The operation removed more than a threshold amount of material there',
        'The point lies inside the tool’s swept volume',
      ],
      answer: 0,
      explanation: 'A surviving point lies on the envelope. Closer than the radius and the tool would have cut it away, so "inside the swept volume" is impossible for a final-surface point.',
    },
    {
      question: 'How much of the measured surface was reached by no tool at all?',
      options: [
        '17.2% — the corner fillet a round tool cannot enter',
        'None; every face was machined by something',
        'About 1%, from sampling error',
        '10.2%, the same as the nearest-rule error',
      ],
      answer: 0,
      explanation: 'A 0.25-radius ball nose cannot get into a square internal corner. Code that cannot return "no operation" will name one anyway.',
    },
    {
      question: '"Most material removed" versus "last to touch" — how far apart are they?',
      options: [
        'They agree on 79.5% and disagree on 20.5% of the attributed surface',
        'They are two names for the same rule',
        'They differ only on roughing passes',
        'They agree except within measurement noise',
      ],
      answer: 0,
      explanation: 'On 6,840 points the spring pass removed 0.000 and finished the face while the previous pass removed 0.300. Neither rule is wrong; they answer different questions.',
    },
    {
      question: 'Can a minimum-removal threshold separate a spring pass from an operation that never touched the face?',
      options: [
        'No — best achievable is 1.008 of 2.000, no better than a coin, because both read ≈ 0',
        'Yes, at about 0.0010',
        'Yes, if the measurement noise is reduced enough',
        'Only if the threshold is set below the noise floor',
      ],
      answer: 0,
      explanation: 'Unlike lesson 11, there is nothing to trade: the two populations are the same measurement. The fix is a different input — contact, which is geometry.',
    },
    {
      question: 'Reordering the same two rules on the same part changed how many answers?',
      options: [
        '7,332 points — 20.5% of the attributed surface',
        'None; rule order cannot change the outcome',
        'A handful, at ties only',
        'All of them',
      ],
      answer: 0,
      explanation: 'Nothing about the geometry or the rules changed. So the ordering is part of the specification, not an implementation detail — and the final tie-break usually defaults to list position.',
    },
  ],
};
