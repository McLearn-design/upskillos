// Mesh Engine 1.10 — Signed Distance and Material Removal
//
// The first lesson that leaves pure geometry. Everything so far answered "how
// far"; this one answers "how much material changed here, and which way".
//
// The section's warning is "do not assume nearest Euclidean distance is
// sufficient". I assumed that meant the SIGN was unreliable. Measured, it is
// not: the nearest triangle's normal gave the correct inside/outside on 80,000
// points across convex and concave solids, with zero errors. The insufficiency
// is elsewhere, and the lesson says where.
//
// Measured by field-fixes/verify/check-signed-distance.py,
// check-signed-concave.py and check-normal-ray.py.

const THREE_CDN = '<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"><\/script>';

const ORBIT = `
function orbit(camera, dom, radius, look) {
  var lon = 40, lat = 22, down = false, px = 0, py = 0;
  look = look || [0, 0, 0];
  function place() {
    var a = lon * Math.PI / 180, b = lat * Math.PI / 180;
    camera.position.set(look[0] + radius*Math.cos(b)*Math.sin(a),
                        look[1] + radius*Math.sin(b),
                        look[2] + radius*Math.cos(b)*Math.cos(a));
    camera.lookAt(look[0], look[1], look[2]);
  }
  dom.addEventListener('pointerdown', function (e) { down = true; px = e.clientX; py = e.clientY; });
  window.addEventListener('pointerup', function () { down = false; });
  window.addEventListener('pointermove', function (e) {
    if (!down) return;
    lon -= (e.clientX - px) * 0.5;
    lat = Math.max(-85, Math.min(85, lat + (e.clientY - py) * 0.5));
    px = e.clientX; py = e.clientY; place();
  });
  place(); return place;
}`;

const LESSON_MESH_1_10 = {
  title: 'Which Side, and How Much',
  subtitle: 'Distance was never the question. The question is what changed, and in which direction.',
  sequential: true,

  cells: [

    {
      type: 'markdown',
      instruction: `### The question changes

Nine lessons of "how far is this point from that surface", and the application
has never actually wanted to know. What it wants is:

> At this spot, is there **more** material than there should be, **less**, or
> neither?

That is a different question in two ways. It needs a **direction**, not just a
magnitude. And it is asked about **two surfaces** — what was designed and what
was cut — rather than about one.

The obvious extension is: take the distance, then work out a sign from the
nearest triangle's normal. If the point is behind the surface it is inside, so
there is material; if in front, it is outside.

**I expected that to be the weak link,** because lesson 6 measured that two
thirds of queries are ties, and at a tie \`argmin\` picks a triangle by storage
order — so the normal used is arbitrary.

It is not the weak link. Measured:

| test | points | wrong sign |
|---|---|---|
| a convex cube, uniform | 40,000 | **0** |
| the same, within 0.02 of the surface | 20,000 | **0** |
| an L-shaped solid with a concave edge | 60,000 | **0** |
| the same, within 0.05 of the concave edge | 20,000 | **0** |

**Zero, everywhere, including at the tie.** The reason is that when two
triangles are equally close, the closest point is on the edge they share — and
whichever of the two normals you pick, the point is on the same side of both.
The choice is arbitrary and the answer is not.

So the sign is fine. The insufficiency is somewhere else, and it is worth
seeing before being told.`,
    },

    {
      type: 'js',
      instruction: `### Two answers, both correct, to different questions

A flat face — call it the **as-designed** surface — and a second surface above
it that you can tilt. Two measurements are drawn:

- **blue**: the shortest line from the point to the other surface. That is the
  nearest Euclidean distance, everything the series has built so far.
- **amber**: travel from the point **along the face's own normal** until you hit
  the other surface.

At zero tilt they are the same line. **Drag the tilt up and watch them come
apart.**

They are both correct. They answer different questions:

- *How close is the nearest bit of that surface to here?* — blue.
- *If I go straight out from this face, how far until I reach that surface?* —
  amber.

**The second one is what a machinist means** by how much stock is on a wall, or
how deep a cut went. It is measured along the surface's own normal, because that
is the direction material is added or removed in.

The readout gives the ratio. Predict it at 45° before you get there.`,
      html: `${THREE_CDN}
<div style="padding:2px 2px 6px;display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:center">
  <span style="color:#7d8794;font:11px ui-monospace,monospace">tilt</span><input id="tilt" type="range" min="0" max="80" step="1" value="0">
  <span style="color:#7d8794;font:11px ui-monospace,monospace">gap</span><input id="gap" type="range" min="0.02" max="0.4" step="0.01" value="0.15">
</div>
<div id="app" style="width:100%;height:290px;background:#0a0f1e;border-radius:8px"></div>
<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:8px 2px;white-space:pre"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `var app = document.getElementById('app');
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(42, app.clientWidth / 290, 0.1, 100);
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(app.clientWidth, 290);
app.appendChild(renderer.domElement);
scene.add(new THREE.AmbientLight(0xffffff, 0.85));

var drawn = [];
function clear() {
  drawn.forEach(function (o) { scene.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  drawn = [];
}
function line(a, b, colour, w) {
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([].concat(a, b)), 3));
  return new THREE.Line(g, new THREE.LineBasicMaterial({ color: colour, linewidth: w || 1 }));
}
function ball(p, colour, r) {
  var m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), new THREE.MeshBasicMaterial({ color: colour }));
  m.position.set(p[0], p[1], p[2]); return m;
}

function build(tiltDeg, gap) {
  clear();
  var th = tiltDeg * Math.PI / 180;

  // Surface A: the as-designed face, flat in the x-y plane, normal +z.
  var planeA = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0),
    new THREE.MeshBasicMaterial({ color: 0x39414d, side: THREE.DoubleSide, transparent: true, opacity: 0.6 }));
  scene.add(planeA); drawn.push(planeA);

  // Surface B: tilted by th about the y axis, passing through (0,0,gap).
  var planeB = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0),
    new THREE.MeshBasicMaterial({ color: 0x4a5568, side: THREE.DoubleSide, transparent: true, opacity: 0.6 }));
  planeB.rotation.y = th;
  planeB.position.set(0, 0, gap);
  scene.add(planeB); drawn.push(planeB);

  // B's unit normal after the tilt.
  var nB = [Math.sin(th), 0, Math.cos(th)];
  var P = [0, 0, 0];                       // the point on A we are measuring from
  var nA = [0, 0, 1];                      // A's own normal

  // Blue: shortest line to plane B. The foot of the perpendicular.
  var toPlane = (0 - 0) * nB[0] + (0 - 0) * nB[1] + (0 - gap) * nB[2];
  var perp = Math.abs(toPlane);
  var foot = [P[0] - toPlane * nB[0], P[1] - toPlane * nB[1], P[2] - toPlane * nB[2]];

  // Amber: travel along A's normal (+z) until the plane. Solve for t.
  var denom = nA[0]*nB[0] + nA[1]*nB[1] + nA[2]*nB[2];
  var along = denom !== 0 ? (gap * nB[2]) / denom : Infinity;
  var hit = [P[0] + nA[0]*along, P[1] + nA[1]*along, P[2] + nA[2]*along];

  var pb = ball(P, 0xffffff, 0.022); scene.add(pb); drawn.push(pb);
  var l1 = line(P, foot, 0x4dabf7); scene.add(l1); drawn.push(l1);
  var b1 = ball(foot, 0x4dabf7, 0.018); scene.add(b1); drawn.push(b1);
  var l2 = line(P, hit, 0xffd43b); scene.add(l2); drawn.push(l2);
  var b2 = ball(hit, 0xffd43b, 0.018); scene.add(b2); drawn.push(b2);

  // The face normal, for orientation.
  var l3 = line(P, [0, 0, 0.45], 0x6d7a8c); scene.add(l3); drawn.push(l3);

  document.getElementById('out').textContent = [
    'tilt of the other surface   ' + tiltDeg + ' degrees',
    'gap at this point           ' + gap.toFixed(3),
    '',
    'nearest distance (blue)     ' + perp.toFixed(5) + '   perpendicular to the OTHER surface',
    'along this face normal (amber) ' + along.toFixed(5) + '   what "stock on this wall" means',
    '',
    'ratio                       ' + (perp > 1e-9 ? (along/perp).toFixed(3) : 'inf') + 'x' +
      (tiltDeg === 0 ? '   <- identical while the surfaces are parallel' : ''),
    '',
    'They agree only at zero tilt. The gap grows as 1/cos^2, so it is 2x at',
    '45 degrees and 4x at 60 - and both numbers are right.',
  ].join('\\n');
}

${ORBIT}
orbit(camera, renderer.domElement, 1.9, [0, 0, 0.1]);
(function frame(){ requestAnimationFrame(frame); renderer.render(scene, camera); }());

var st = document.getElementById('tilt'), sg = document.getElementById('gap');
function redraw(){ build(Number(st.value), Number(sg.value)); }
[st, sg].forEach(function (s) { s.addEventListener('input', redraw); });
redraw();`,
      outputHeight: 480,
    },

    {
      type: 'markdown',
      instruction: `### Measured, so you do not have to trust the picture

Two planes, a gap of 0.05 at the measured point, the second tilted by θ:

| tilt | nearest (⊥ to B) | along A's normal | ratio |
|---|---|---|---|
| 0° | 0.05000 | 0.05000 | 1.00 |
| 15° | 0.04830 | 0.05176 | 1.07 |
| 30° | 0.04330 | 0.05774 | 1.33 |
| 45° | 0.03536 | 0.07071 | **2.00** |
| 60° | 0.02500 | 0.10000 | **4.00** |
| 75° | 0.01294 | 0.19319 | 14.93 |

The ratio is \`1/cos²θ\`, and it runs away quickly. **On anything that is not
parallel, these are not two estimates of one number — they are two different
numbers**, and using the wrong one on a 60° draft face is a factor of four.

So: build the **normal-directed ray test**.

\`\`\`
for each point on the as-designed surface
    shoot a ray along that surface's own normal
    find the FIRST intersection with the as-cut surface
    the sign of t is the direction
\`\`\`

Forward along the normal means the as-cut surface is **further out** than
designed — material was left on, or added. Backward means it is **further in** —
material was removed.

#### Three things that will bite

**Start the ray off the surface.** The origin lies exactly on the surface it
came from, so with no offset the ray immediately intersects its own origin
triangle at \`t = 0\`. The usual fix is to start at \`P + normal × ε\` and require
\`t > ε\`, and picking ε is a real decision — too small and floating-point noise
readmits the origin face, too large and you skip a genuinely thin feature.

**You must search both ways.** A ray only goes forwards. If nothing is hit going
out, the other surface is behind you, so the same ray has to be fired along
\`−normal\` as well, and the sign recorded accordingly.

**And you need a limit, or coincident surfaces lie to you.** Measured on a slot
of half-width 0.15: when the as-cut surface is **identical** to the as-designed
one, the backward ray misses the coincident face (the ε skipped it) and travels
on to hit the **opposite wall of the slot**, reporting a gap of **+0.300** — the
slot width — when the honest answer is "nothing changed here".

The fix is a **search band**: look out only to some maximum distance and,
beyond it, report **no corresponding surface found** rather than inventing a
number. With a band of 0.1 the same case correctly reports nothing.

#### And that exposes something the ray cannot do

Look carefully at what the band just did. It suppressed the far wall, which is
what it is for. It did **not** tell you the surfaces were identical. It told you
*nothing was found* - which is exactly what it says when there is genuinely no
corresponding surface at all.

**The ray cannot tell those apart, and it never can.** The epsilon that stops it
hitting its own origin face is precisely what stops it seeing a face in the same
place. Coincident and absent both produce no hit.

So the four states cannot come from the ray alone. The thing that supplies the
missing one is **nearest distance** - the measurement this lesson opened by
calling insufficient. It is insufficient as a *magnitude*. It is exactly right as
a *presence test*: if the nearest point on the as-cut surface is within tolerance
of here, a corresponding surface exists here and nothing changed.

\`\`\`
nearest distance <= tol        ->  unchanged      (a surface is right here)
otherwise, banded normal ray:
    hit forwards               ->  added
    hit backwards              ->  removed
    nothing within the band    ->  no surface
\`\`\`

Two measurements, each answering the part of the question the other cannot. It
took a failing test to find that: the first version of this challenge expected
the ray alone to report unchanged, and it cannot.`,
    },

    {
      type: 'challenge',
      instruction: `### 🎯 Classify it

\`classify(P, normal, surfaceB, band, tol)\` returning one of four strings:

- \`'removed'\` — the as-cut surface is **inside** where the design was
- \`'added'\` — it is **outside**
- \`'unchanged'\` — a surface was found, within \`tol\` of zero
- \`'no surface'\` — nothing within the band, so no honest answer exists

Plus the signed gap, as \`{ state, gap }\` — \`gap\` being \`NaN\` for
\`'no surface'\`.

The method needs **both** measurements, because the ray alone cannot produce
all four states:

1. **Presence first.** Find the nearest point on \`surfaceB\`. If it is within
   \`tol\`, a corresponding surface is right here and the answer is
   \`'unchanged'\` — stop.
2. Otherwise fire along \`+normal\` from \`P + normal × ε\`, keeping hits with
   \`t > ε\`.
3. Fire along \`−normal\` from \`P − normal × ε\`, the same way.
4. Discard anything beyond \`band\`.
5. Take whichever is nearer: forward positive (\`'added'\`), backward negative
   (\`'removed'\`).
6. Nothing left → \`'no surface'\`.

**Step 1 is not optional, and it is the part that is easy to miss.** The ε that
keeps the ray off its own origin face also blinds it to a face in the same
place, so coincident surfaces and absent surfaces both produce no hit. Without
the presence test you can never report \`'unchanged'\` at all.

**Step 4 is not optional either.** Without it, a point whose corresponding
surface is genuinely absent reports whatever unrelated geometry the ray reaches
next — a real number about the wrong place.

A Möller–Trumbore \`rayHits\` and a \`nearestDistance\` are supplied and both
work. The classification is yours.`,
      html: `<div id="out" style="color:#9fb8e0;font:11px ui-monospace,monospace;padding:10px;white-space:pre;background:#0a0f1e;border-radius:8px;min-height:280px"></div>`,
      css: `body{margin:0;background:#0a0f1e}`,
      startCode: `function sub(u,v){return [u[0]-v[0],u[1]-v[1],u[2]-v[2]];}
function add(u,v){return [u[0]+v[0],u[1]+v[1],u[2]+v[2]];}
function scale(u,k){return [u[0]*k,u[1]*k,u[2]*k];}
function dot(u,v){return u[0]*v[0]+u[1]*v[1]+u[2]*v[2];}
function cross(u,v){return [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];}

// Lesson 5's solver, needed by the presence test below.
function closestOnTriangle(P, A, B, C) {
  var ab=sub(B,A), ac=sub(C,A), ap=sub(P,A);
  var d1=dot(ab,ap), d2=dot(ac,ap);
  if (d1<=0&&d2<=0) return A;
  var bp=sub(P,B), d3=dot(ab,bp), d4=dot(ac,bp);
  if (d3>=0&&d4<=d3) return B;
  var vc=d1*d4-d3*d2;
  if (vc<=0&&d1>=0&&d3<=0){var t=(d1===d3)?0:d1/(d1-d3);return add(A,scale(ab,t));}
  var cp=sub(P,C), d5=dot(ab,cp), d6=dot(ac,cp);
  if (d6>=0&&d5<=d6) return C;
  var vb=d5*d2-d1*d6;
  if (vb<=0&&d2>=0&&d6<=0){var s2=(d2===d6)?0:d2/(d2-d6);return add(A,scale(ac,s2));}
  var va=d3*d6-d5*d4;
  if (va<=0&&(d4-d3)>=0&&(d5-d6)>=0){
    var sp=(d4-d3)+(d5-d6), u=(sp===0)?0:(d4-d3)/sp;
    return add(B, scale(sub(C,B), u));
  }
  var tot=va+vb+vc; if (tot===0) return A;
  return add(A, add(scale(ab, vb/tot), scale(ac, vc/tot)));
}

// Moller-Trumbore. Returns the t of every forward intersection with t > eps.
function rayHits(P, d, surf, eps) {
  eps = eps || 1e-9;
  var out = [];
  for (var i = 0; i < surf.length; i++) {
    var A = surf[i][0], B = surf[i][1], C = surf[i][2];
    var e1 = sub(B, A), e2 = sub(C, A);
    var h = cross(d, e2), a = dot(e1, h);
    if (Math.abs(a) < 1e-12) continue;          // ray parallel to the triangle
    var f = 1 / a, s = sub(P, A);
    var u = f * dot(s, h);
    if (u < -1e-12 || u > 1 + 1e-12) continue;
    var q = cross(s, e1);
    var v = f * dot(d, q);
    if (v < -1e-12 || u + v > 1 + 1e-12) continue;
    var t = f * dot(e2, q);
    if (t > eps) out.push(t);
  }
  return out;
}

// The nearest point on a surface, from lesson 5 and 6. This is the presence
// test: if it is within tolerance, a corresponding surface is right here.
function nearestDistance(P, surf) {
  var best = Infinity;
  for (var i = 0; i < surf.length; i++) {
    var q = closestOnTriangle(P, surf[i][0], surf[i][1], surf[i][2]);
    var d = Math.sqrt(dot(sub(P, q), sub(P, q)));
    if (d < best) best = d;
  }
  return best;
}

// TODO: return { state, gap }
function classify(P, normal, surfaceB, band, tol) {
  var eps = 1e-7;

  // your code here

  return { state: 'no surface', gap: NaN };
}

// ── it runs itself below ──────────────────────────────────────────────────
// A wall of the as-designed slot at x = -0.15, its normal pointing +x, out of
// the material and into the slot.
function wall(x, facing) {
  var A = [x,-0.5,-0.5], B = [x,0.5,-0.5], C = [x,0.5,0.5], D = [x,-0.5,0.5];
  return facing > 0 ? [[A,B,C],[A,C,D]] : [[A,C,B],[A,D,C]];
}
function slot(h) { return wall(-h, 1).concat(wall(h, -1)); }

var P = [-0.15, 0, 0], n = [1, 0, 0];
var CASES = [
  ['cut wider  (material removed)', slot(0.20), 'removed'],
  ['cut narrow (material added)',   slot(0.10), 'added'],
  ['exactly as designed',           slot(0.15), 'unchanged'],
  ['nothing anywhere near',         slot(2.00), 'no surface'],
];

var lines = ['  case                                gap      state        expected'];
CASES.forEach(function (c) {
  var r = classify(P, n, c[1], 0.1, 1e-4);
  lines.push('  ' + c[0].padEnd(32) +
    (isFinite(r.gap) ? r.gap.toFixed(4) : '   -').padStart(8) + '   ' +
    ('' + r.state).padEnd(12) + c[2]);
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
            '\nreturn { classify, rayHits };',
          )();
        } catch (e) { return no('The code did not run: ' + e.message); }
        if (typeof fn.classify !== 'function') return no('classify is not a function.');

        const wall = (x, facing) => {
          const A = [x, -0.5, -0.5], B = [x, 0.5, -0.5], C = [x, 0.5, 0.5], D = [x, -0.5, 0.5];
          return facing > 0 ? [[A, B, C], [A, C, D]] : [[A, C, B], [A, D, C]];
        };
        const slot = (h) => wall(-h, 1).concat(wall(h, -1));
        const P = [-0.15, 0, 0], n = [1, 0, 0];

        const cases = [
          ['cut wider', slot(0.20), 'removed', -0.05],
          ['cut a little wider', slot(0.17), 'removed', -0.02],
          ['cut narrower', slot(0.10), 'added', 0.05],
          ['cut a little narrower', slot(0.13), 'added', 0.02],
          ['exactly as designed', slot(0.15), 'unchanged', 0],
          ['far away', slot(2.0), 'no surface', NaN],
        ];

        for (const [label, surf, want, wantGap] of cases) {
          let r;
          try { r = fn.classify(P, n, surf, 0.1, 1e-4); } catch (e) {
            return no('classify threw on "' + label + '": ' + e.message);
          }
          if (!r || typeof r.state !== 'string' || !('gap' in r)) {
            return no('classify should return { state, gap }. On "' + label
              + '" it returned ' + JSON.stringify(r) + '.');
          }
          if (r.state !== want) {
            let hint = '';
            if (want === 'no surface' && r.state !== 'no surface') {
              hint = ' Nothing is within the band of 0.1 here, so the honest answer is '
                + '"no surface" — discard hits beyond the band before deciding.';
            } else if (want === 'unchanged') {
              hint = ' The as-cut surface is IDENTICAL to the designed one here, and the '
                + 'ray cannot see that: the eps that keeps it off its own origin face '
                + 'also blinds it to a face in the same place, so coincident and absent '
                + 'both give no hit. Use nearestDistance as a presence test first \u2014 '
                + 'if the nearest point on surfaceB is within tol, a corresponding '
                + 'surface is right here and nothing changed.';
            } else if (want === 'removed' && r.state === 'added') {
              hint = ' The sign is inverted. A hit going BACKWARD along the normal — '
                + 'into the material — means the as-cut surface is further in, so '
                + 'material was removed, and the gap is negative.';
            } else if (want === 'added' && r.state === 'removed') {
              hint = ' The sign is inverted. A hit going FORWARD along the normal means '
                + 'the as-cut surface is further out than designed, so material remains.';
            }
            return no('"' + label + '": you returned "' + r.state + '", expected "'
              + want + '".' + hint);
          }
          if (Number.isFinite(wantGap) && want !== 'unchanged') {
            if (!Number.isFinite(r.gap) || Math.abs(r.gap - wantGap) > 1e-4) {
              return no('"' + label + '": the state is right but the gap is '
                + r.gap + ', expected ' + wantGap.toFixed(4)
                + '. Forward hits are positive, backward hits negative, and the '
                + 'magnitude is the distance travelled.');
            }
          }
          if (want === 'no surface' && Number.isFinite(r.gap)) {
            return no('"' + label + '": state is "no surface" but gap is ' + r.gap
              + '. With nothing found there is no number to report — use NaN.');
          }
        }

        // The band must actually be used, not hard-coded around.
        const wide = fn.classify(P, n, slot(0.20), 0.01, 1e-4);
        if (wide.state !== 'no surface') {
          return no('With a band of 0.01 and the surface 0.05 away, nothing is within '
            + 'reach, so the answer must be "no surface" — you returned "'
            + wide.state + '". The band is a parameter, not a constant.');
        }

        // And tol must be used.
        const loose = fn.classify(P, n, slot(0.155), 0.1, 0.01);
        if (loose.state !== 'unchanged') {
          return no('With tol = 0.01 a gap of 0.005 counts as unchanged, but you '
            + 'returned "' + loose.state + '". Compare the magnitude of the gap '
            + 'against tol before deciding removed or added.');
        }

        return {
          pass: true,
          message: 'All four states, both signs, and the band and tolerance both '
            + 'honoured — including the coincident case, where without the band the '
            + 'backward ray reports the far wall of the slot as a real measurement. '
            + 'That fourth state is the one that stops a wrong answer looking like a '
            + 'right one.',
        };
      },
      successMessage: '✓ Four states, honestly.',
      failMessage: '✗ Not yet.',
      outputHeight: 460,
    },

  ],
};

const PY_CELLS = [
  {
    id: 'sign',
    cellTitle: 'The sign, and whether it can be trusted',
    prose: [
      'First the thing I expected to break. Take the nearest triangle and ask which side of it the point is on: dot the vector from the closest point to P against that triangle’s normal. Negative means behind the surface, which means inside.',
      'The worry is lesson 6’s result that most queries are ties, so the triangle argmin returns - and therefore the normal used - is chosen by the order the file happened to be written in.',
      'Measured against a cube, whose inside is known exactly, it is right every time. The reason is worth seeing: at a tie the closest point is ON the shared edge, and a point is on the same side of both triangles that meet there. The choice is arbitrary and the answer is not affected by it.',
      'The concave case is in the next cell, because a concave edge is where that argument looks least safe.',
    ],
    code: `import numpy as np

H = 0.5
corners = np.array([
    [-H,-H,-H], [H,-H,-H], [H,H,-H], [-H,H,-H],
    [-H,-H, H], [H,-H, H], [H,H, H], [-H,H, H]], float)
QUADS = [(0,1,5,4), (0,3,2,1), (4,5,6,7), (1,2,6,5), (3,0,4,7), (2,3,7,6)]
faces = np.array([t for q in QUADS
                    for t in ((q[0],q[1],q[2]), (q[0],q[2],q[3]))])
A, B, C = corners[faces[:,0]], corners[faces[:,1]], corners[faces[:,2]]
Nrm = np.cross(B - A, C - A)
Nrm /= np.linalg.norm(Nrm, axis=1, keepdims=True)

def safe_div(n_, d_): return np.divide(n_, d_, out=np.zeros_like(n_), where=d_ != 0)

def closest_all(P, A, B, C):
    P = np.asarray(P, float)
    ab, ac = B - A, C - A
    ap, bp, cp = P - A, P - B, P - C
    d1 = np.einsum("ij,ij->i", ab, ap); d2 = np.einsum("ij,ij->i", ac, ap)
    d3 = np.einsum("ij,ij->i", ab, bp); d4 = np.einsum("ij,ij->i", ac, bp)
    d5 = np.einsum("ij,ij->i", ab, cp); d6 = np.einsum("ij,ij->i", ac, cp)
    va = d3*d6-d5*d4; vb = d5*d2-d1*d6; vc = d1*d4-d3*d2
    mA=(d1<=0)&(d2<=0);                      rest=~mA
    mB=rest&(d3>=0)&(d4<=d3);                rest=rest&~mB
    mAB=rest&(vc<=0)&(d1>=0)&(d3<=0);        rest=rest&~mAB
    mC=rest&(d6>=0)&(d5<=d6);                rest=rest&~mC
    mAC=rest&(vb<=0)&(d2>=0)&(d6<=0);        rest=rest&~mAC
    mBC=rest&(va<=0)&((d4-d3)>=0)&((d5-d6)>=0)
    mIn=rest&~mBC
    Q=np.zeros_like(A)
    Q[mA]=A[mA]; Q[mB]=B[mB]; Q[mC]=C[mC]
    t=safe_div(d1,d1-d3); Q[mAB]=A[mAB]+t[mAB,None]*ab[mAB]
    t=safe_div(d2,d2-d6); Q[mAC]=A[mAC]+t[mAC,None]*ac[mAC]
    t=safe_div(d4-d3,(d4-d3)+(d5-d6)); Q[mBC]=B[mBC]+t[mBC,None]*(C-B)[mBC]
    tot=va+vb+vc; v,w=safe_div(vb,tot),safe_div(vc,tot)
    Q[mIn]=A[mIn]+ab[mIn]*v[mIn,None]+ac[mIn]*w[mIn,None]
    return Q

def sign_nearest(P):
    Q = closest_all(P, A, B, C)
    d = np.linalg.norm(Q - P, axis=1)
    i = int(np.argmin(d))
    tied = int(np.count_nonzero(d < d[i] + 1e-12))
    return float(np.dot(P - Q[i], Nrm[i])) < 0, float(d[i]), tied

rng = np.random.default_rng(11)
pts = rng.uniform(-0.9, 0.9, size=(20000, 3))
wrong = ties = 0
for P in pts:
    got, d, tied = sign_nearest(P)
    truth = bool(np.all(np.abs(P) < H))
    if tied > 1: ties += 1
    if got != truth: wrong += 1

print(f"{len(pts):,} points against a cube whose inside is known exactly")
print(f"  wrong sign : {wrong}  ({100*wrong/len(pts):.3f}%)")
print(f"  had a tie  : {ties}  ({100*ties/len(pts):.1f}%)")
print()
print("At a tie the closest point is on the shared EDGE, and a point sits on")
print("the same side of both triangles meeting there - so which normal argmin")
print("happened to pick does not change the answer.")`,
  },
  {
    id: 'divergence',
    cellTitle: 'Where nearest distance stops being the measurement you want',
    prose: [
      'The sign holds up. The insufficiency is that nearest distance answers a different question from the one being asked.',
      'Nearest distance is measured perpendicular to the OTHER surface. Stock on a wall, or depth of cut, is measured along THIS surface’s own normal - because that is the direction material is added or removed in.',
      'Those coincide only when the two surfaces are parallel. This cell sweeps the angle between them and reports both, and the ratio is 1/cos squared, which runs away faster than people expect: it is 2x at 45 degrees and 4x at 60.',
      'A draft face at 60 degrees is not unusual. Using the wrong measurement there is not a rounding difference, it is a factor of four.',
    ],
    code: `gap = 0.05
print(f"{'tilt':>6} {'nearest (perp to B)':>21} {'along A normal':>16} {'ratio':>9}")
for deg in (0, 5, 15, 30, 45, 60, 75):
    th = np.radians(deg)
    nB = np.array([np.sin(th), 0.0, np.cos(th)])
    perp = abs(np.dot(np.array([0,0,0]) - np.array([0,0,gap]), nB))
    along = gap / np.cos(th)
    print(f"{deg:>4} deg {perp:>21.5f} {along:>16.5f} {along/perp:>8.3f}x")

print()
print("ratio = 1 / cos^2(theta).  They are equal only when parallel.")
print()
print("Both numbers are correct. They answer:")
print("  perpendicular  - how close is the nearest bit of that surface")
print("  along-normal   - how far out from HERE until I reach it")
print("The second is what 'stock on this wall' means.")`,
  },
  {
    id: 'ray',
    cellTitle: 'The normal-directed ray',
    prose: [
      'Moller-Trumbore, vectorised over every triangle at once. It solves the ray against the triangle’s own plane in barycentric coordinates, so u, v and t come out together and the inside test is the same v >= 0, u + v <= 1 from lesson 5.',
      'Two things about the epsilon. The ray starts exactly on the surface it came from, so without an offset it intersects its own origin triangle at t = 0; the guard t > eps removes that. And eps is a genuine decision - too small and floating-point noise lets the origin face back in, too large and a genuinely thin feature is stepped over.',
      'A ray only travels forwards, so the search has to run both ways: along +n and along -n, with the sign recorded. Forward means the as-cut surface is further out than designed - material left on. Backward means further in - material removed.',
    ],
    code: `def ray_hits(P, d, A, B, C, eps=1e-9):
    P = np.asarray(P, float); d = np.asarray(d, float)
    e1, e2 = B - A, C - A
    h = np.cross(d, e2)
    a = np.einsum("ij,ij->i", e1, h)
    parallel = np.abs(a) < 1e-14
    f = safe_div(np.ones_like(a), a)
    s = P - A
    u = f * np.einsum("ij,ij->i", s, h)
    q = np.cross(s, e1)
    v = f * (q @ d)
    t = f * np.einsum("ij,ij->i", e2, q)
    ok_ = (~parallel) & (u >= -1e-12) & (v >= -1e-12) & (u+v <= 1+1e-12) & (t > eps)
    return t[ok_]

def signed_gap(P, n, A, B, C, band=np.inf, eps=1e-7):
    """Along the surface's own normal, both ways, within a band."""
    P = np.asarray(P, float); n = np.asarray(n, float)
    fwd = ray_hits(P + n*eps, n, A, B, C, eps)
    bck = ray_hits(P - n*eps, -n, A, B, C, eps)
    fwd = fwd[fwd <= band]; bck = bck[bck <= band]
    if len(fwd) and (not len(bck) or fwd.min() <= bck.min()):
        return float(fwd.min())
    if len(bck):
        return -float(bck.min())
    return np.nan

def wall(x, facing):
    a=[x,-0.5,-0.5]; b=[x,0.5,-0.5]; c=[x,0.5,0.5]; d=[x,-0.5,0.5]
    return [[a,b,c],[a,c,d]] if facing > 0 else [[a,c,b],[a,d,c]]

def slot(h):
    t = np.array(wall(-h, 1) + wall(h, -1), float)
    return t[:,0], t[:,1], t[:,2]

P = np.array([-0.15, 0.0, 0.0])      # on the designed wall
n = np.array([1.0, 0.0, 0.0])        # its normal, out of the material

print(f"{'as-cut slot':>14} {'signed gap':>12}   meaning")
for h in (0.20, 0.17, 0.15, 0.13, 0.10):
    g = signed_gap(P, n, *slot(h))
    meaning = ("removed" if g < -1e-9 else "added" if g > 1e-9 else "unchanged")
    print(f"{'+/-' + format(h, '.2f'):>14} {g:>+12.4f}   {meaning}")`,
  },
  {
    id: 'band',
    cellTitle: 'The band, and what happens without one',
    prose: [
      'The table above has a suspicious row. When the as-cut slot is exactly as designed the answer should be zero, and it is not - it is the distance to the OPPOSITE wall.',
      'The reason is the epsilon doing its job. The backward ray starts just inside the material and the coincident face is at t below eps, so it is correctly skipped as the origin surface - and then the ray carries on and hits the far wall, which is a real triangle at a real distance. Nothing malfunctioned. The number is simply an answer to a question nobody asked.',
      'A search band suppresses it: look out only as far as a change could plausibly be, and past that report that no corresponding surface was found.',
      'But read the band = 0.10 rows carefully, because they show what the band CANNOT do. The coincident case comes back as "no surface", not as "unchanged" - and that is not a bug in the band. The epsilon that keeps the ray off its own origin face also blinds it to a face in the same place, so coincident and absent are indistinguishable to a ray. It can never report unchanged.',
      'Which means the fourth state has to come from somewhere else, and the somewhere else is nearest distance - the measurement this lesson opened by calling insufficient. Insufficient as a magnitude; exactly right as a presence test. The next challenge uses both.',
    ],
    code: `print("no band:")
for h in (0.15, 0.20):
    g = signed_gap(P, n, *slot(h))
    print(f"  as-cut +/-{h:.2f}  ->  {g:+.4f}")
print(f"  the {signed_gap(P, n, *slot(0.15)):+.4f} is the far wall of the slot, "
      f"{2*0.15:.2f} away.")
print()

for band in (0.30, 0.10, 0.01):
    print(f"band = {band}:")
    for h in (0.15, 0.20, 0.10):
        g = signed_gap(P, n, *slot(h), band=band)
        state = ("no surface" if np.isnan(g)
                 else "unchanged" if abs(g) < 1e-4
                 else "removed" if g < 0 else "added")
        shown = "   -" if np.isnan(g) else f"{g:+.4f}"
        print(f"  as-cut +/-{h:.2f}  ->  {shown}   {state}")
    print()

print("A band of 0.30 is wide enough to see the far wall and reports the")
print("coincident case as removed, which is wrong. A band of 0.01 is too")
print("narrow to see a real 0.05 change and reports no surface for everything.")
print("The band is not a tidy-up, it is a measurement decision.")`,
  },
  {
    id: 'ch-classify',
    challengeType: 'write',
    challengeTitle: 'The four states',
    difficulty: 'core',
    prompt:
      'Write classify(P, n, surfB, band, tol) returning (state, gap) with state one of '
      + '"removed", "added", "unchanged" or "no surface". It needs BOTH measurements: the '
      + 'nearest distance to surfB as a presence test, then signed_gap for the magnitude. '
      + 'A ray cannot report "unchanged" - the epsilon that keeps it off its own face '
      + 'blinds it to a coincident one - so without the presence test that state is '
      + 'unreachable.',
    hint:
      'closest_all(P, *surfB) gives every nearest point; the smallest distance is the '
      + 'presence test. If it is within tol, return ("unchanged", 0.0) and stop. Otherwise '
      + 'call signed_gap with the band: nan means nothing found, negative means removed, '
      + 'positive means added.',
    code: `def classify(P, n, surfB, band, tol):
    # TODO: presence test first, then the signed gap. Return (state, gap).
    pass


for h, expect in ((0.20, "removed"), (0.10, "added"),
                  (0.15, "unchanged"), (2.00, "no surface")):
    st, g = classify(P, n, slot(h), 0.1, 1e-4)
    shown = "   -" if np.isnan(g) else f"{g:+.4f}"
    print(f"  as-cut +/-{h:.2f}  {shown}  {st:<12} expected {expect}")`,
    solution: `def classify(P, n, surfB, band, tol):
    # Presence test: is there a corresponding surface right here at all?
    near = float(np.linalg.norm(closest_all(P, *surfB) - P, axis=1).min())
    if near <= tol:
        return "unchanged", 0.0
    g = signed_gap(P, n, *surfB, band=band)
    if np.isnan(g):
        return "no surface", np.nan
    return ("removed" if g < 0 else "added"), g


for h, expect in ((0.20, "removed"), (0.10, "added"),
                  (0.15, "unchanged"), (2.00, "no surface")):
    st, g = classify(P, n, slot(h), 0.1, 1e-4)
    shown = "   -" if np.isnan(g) else f"{g:+.4f}"
    print(f"  as-cut +/-{h:.2f}  {shown}  {st:<12} expected {expect}")`,
    testCode: `for _h, _want, _gap in ((0.20, "removed", -0.05), (0.17, "removed", -0.02),
                        (0.10, "added", 0.05), (0.13, "added", 0.02),
                        (0.15, "unchanged", None), (2.00, "no surface", None)):
    _r = classify(P, n, slot(_h), 0.1, 1e-4)
    assert _r is not None, "classify returned None - 'pass' is still there."
    assert len(_r) == 2, f"expected (state, gap), got {_r!r}"
    _st, _g = _r
    assert _st == _want, (
        f"as-cut +/-{_h}: got '{_st}', expected '{_want}'." +
        (" The surfaces are IDENTICAL here and a ray cannot see that - the epsilon "
         "that keeps it off its own origin face also blinds it to a coincident one. "
         "Do the presence test first: if the nearest point on surfB is within tol, "
         "a corresponding surface is right here."
         if _want == "unchanged" else
         " Nothing is within the band of 0.1, so the honest answer is 'no surface'."
         if _want == "no surface" else ""))
    if _gap is not None:
        assert abs(_g - _gap) < 1e-4, (
            f"as-cut +/-{_h}: gap {_g:+.4f}, expected {_gap:+.4f}. Backward hits "
            f"are negative, forward hits positive.")
    if _want == "no surface":
        assert np.isnan(_g), f"with nothing found the gap should be nan, got {_g}"

# The band and the tolerance must both be used, not hard-coded around.
assert classify(P, n, slot(0.20), 0.01, 1e-4)[0] == "no surface", (
    "with a band of 0.01 and the surface 0.05 away, nothing is in reach")
assert classify(P, n, slot(0.155), 0.1, 0.01)[0] == "unchanged", (
    "with tol = 0.01 the nearest surface is 0.005 away, which is within tolerance - "
    "so the presence test should call it unchanged")
assert classify(P, n, slot(0.155), 0.1, 1e-6)[0] == "removed", (
    "with tol = 1e-6 that same 0.005 is a real change, and the ray should find it "
    "backwards along the normal")
"SUCCESS: four states, both signs, and the band and tolerance both honoured - including the coincident case that lies without a band."`,
  },
  {
    id: 'ch-eps',
    challengeType: 'write',
    challengeTitle: 'Pick the epsilon by measuring it',
    difficulty: 'stretch',
    prompt:
      'The ray starts on the surface it came from, so eps decides whether it escapes its own '
      + 'origin face. Too small and floating-point noise lets that face back in as a hit at '
      + 'almost zero; too large and a genuinely thin feature is stepped straight over. Sweep '
      + 'it: set eps_sweep to a list of (eps, gap_for_a_0.001_feature, gap_for_coincident) '
      + 'and eps_ok to the largest eps that still resolves the thin feature correctly.',
    hint:
      'A 0.001 change means the as-cut slot at +/-0.151 against a design at +/-0.15. Try eps '
      + 'from 1e-12 up to 1e-2. Watch what the coincident case does at small eps - the origin '
      + 'face comes back as a hit at nearly zero, which reads as "unchanged" for the wrong '
      + 'reason.',
    code: `eps_sweep = []
eps_ok = None

# TODO: sweep eps, recording what happens to a thin real change and to a
#       coincident surface

for e, thin, same in eps_sweep:
    print(f"  eps {e:>8.0e}   0.001 feature {thin:>+9.5f}   coincident {same:>+9.5f}")
print("largest eps that still resolves 0.001:", eps_ok)`,
    solution: `eps_sweep = []
eps_ok = None

for e in (1e-12, 1e-10, 1e-8, 1e-7, 1e-6, 1e-5, 1e-4, 1e-3, 1e-2):
    thin = signed_gap(P, n, *slot(0.151), band=0.1, eps=e)
    same = signed_gap(P, n, *slot(0.150), band=0.1, eps=e)
    eps_sweep.append((e, thin, same))
    if abs(thin + 0.001) < 1e-6:
        eps_ok = e

for e, thin, same in eps_sweep:
    print(f"  eps {e:>8.0e}   0.001 feature {thin:>+9.5f}   coincident {same:>+9.5f}")
print("largest eps that still resolves 0.001:", eps_ok)`,
    testCode: `assert eps_sweep, "eps_sweep is empty - nothing was measured."
assert len(eps_sweep) >= 6, f"only {len(eps_sweep)} values tried; use a wider sweep"
assert eps_ok is not None, "eps_ok was never set."

_es = [e for e, _, _ in eps_sweep]
assert min(_es) <= 1e-9 and max(_es) >= 1e-3, (
    "sweep a wide range - at least 1e-9 up to 1e-3 - or neither failure mode appears")

# The largest eps that still resolves the 0.001 feature must be smaller than
# the feature itself. An eps as large as the change cannot resolve it.
assert eps_ok < 1e-3, (
    f"eps_ok came out {eps_ok:g}, which is not smaller than the 0.001 feature it "
    f"has to resolve. Check the condition: the gap should come back as -0.001.")

# And an eps at or above the feature size must fail to see it.
_big = [(e, thin) for e, thin, _ in eps_sweep if e >= 1e-3]
assert _big, "include an eps of 1e-3 or larger, so the over-large failure shows"
assert any(abs(thin + 0.001) > 1e-6 or np.isnan(thin) for e, thin in _big), (
    "at an eps as large as the feature, the ray should step over it - if it still "
    "reports -0.001 exactly, the eps is not being passed through to ray_hits")
"SUCCESS: eps has to be far smaller than the smallest feature you intend to resolve, and it is a measurement decision rather than a constant."`,
  },
  {
    id: 'ch-band',
    challengeType: 'write',
    challengeTitle: 'What the band costs in both directions',
    difficulty: 'core',
    prompt:
      'A band that is too narrow reports "no surface" for changes that are really there; one '
      + 'that is too wide reports unrelated geometry as a change. Sweep it: set band_sweep '
      + 'to a list of (band, state_for_a_real_0.05_change, state_when_nothing_is_near) and '
      + 'band_range to the (low, high) pair of bands that get BOTH right.',
    hint:
      'Use classify from the earlier challenge. The real change is slot(0.20), which should '
      + 'be "removed". The nothing-near case is slot(2.00), which should be "no surface" - '
      + 'but with a wide enough band the ray reaches those far walls, 1.85 away, and reports '
      + 'them. Try bands from 0.01 to 3.0.',
    code: `band_sweep = []
band_range = None

# TODO: sweep the band and find where both cases come out right

for b, real, far in band_sweep:
    print(f"  band {b:>5.2f}   real change {real:<12} nothing near {far}")
print("bands that get both right:", band_range)`,
    solution: `band_sweep = []
band_range = None

for b in (0.01, 0.02, 0.04, 0.05, 0.08, 0.1, 0.5, 1.0, 1.9, 3.0):
    real = classify(P, n, slot(0.20), b, 1e-4)[0]
    far = classify(P, n, slot(2.00), b, 1e-4)[0]
    band_sweep.append((b, real, far))

good = [b for b, real, far in band_sweep
        if real == "removed" and far == "no surface"]
band_range = (min(good), max(good)) if good else None

for b, real, far in band_sweep:
    print(f"  band {b:>5.2f}   real change {real:<12} nothing near {far}")
print("bands that get both right:", band_range)`,
    testCode: `assert band_sweep, "band_sweep is empty - nothing was measured."
assert len(band_sweep) >= 6, f"only {len(band_sweep)} bands tried; use a wider sweep"
assert band_range is not None, (
    "no band got both cases right. There is a window: wide enough to see a 0.05 "
    "change, narrow enough not to reach unrelated geometry 1.85 away.")

_lo, _hi = band_range
assert _lo >= 0.05, (
    f"a band of {_lo} cannot see the real 0.05 change - it should report "
    f"'no surface' there, not 'removed'.")
assert _hi < 1.9, (
    f"a band of {_hi} reaches the far walls of slot(2.00), 1.85 away, so a point "
    f"with no corresponding surface gets reported as a real change.")

# Both failure modes must appear in the sweep, or it was too narrow to be
# evidence of anything.
assert any(real == "no surface" for _, real, _ in band_sweep), (
    "no band was small enough to miss the real 0.05 change - include 0.01 or 0.02")
assert any(far != "no surface" for _, _, far in band_sweep), (
    "no band was large enough to reach the unrelated geometry - include 1.9 or 3.0")
"SUCCESS: the band has a window, bounded below by the smallest change you must detect and above by the nearest unrelated surface. Both bounds come from the part, not from a convention."`,
  },
];

export default {
  id: 'mesh-engine-1-10-signed-distance',
  slug: 'signed-distance',
  chapter: 'mesh-engine.1',
  order: 9,
  title: 'Signed Distance and Material Removal',
  subtitle: 'Distance was never the question. What changed here, and in which direction?',
  tags: [
    'signed distance', 'inside outside', 'surface normal', 'ray casting',
    'Moller-Trumbore', 'first intersection', 'epsilon', 'tolerance band',
    'classification', 'material removal',
  ],
  aliases: 'signed distance field inside outside test surface normal direction ray cast first intersection Moller Trumbore epsilon self intersection search band material removed added unchanged no surface classification stock on wall depth of cut',
  timeToComplete: 65,
  coreConcept:
    'Comparing two surfaces asks what changed and which way, not how far. The sign from the nearest triangle’s normal turns out to be reliable - measured at zero errors over 80,000 points on convex and concave solids, because at a tie the closest point is on the shared edge and both normals agree about which side you are on. What is NOT sufficient is nearest Euclidean distance itself: it is measured perpendicular to the other surface, while stock and depth of cut are measured along this surface’s own normal, and those agree only when the two are parallel - diverging as 1/cos squared, so 2x at 45 degrees and 4x at 60. The normal-directed ray measures the right thing, and needs an epsilon to escape its own origin face and a search band so that coincident surfaces report nothing found rather than the far wall.',
  prerequisites: ['mesh-engine-1-9-bvh'],
  nextLesson: 'mesh-engine-1-11-thresholds',

  semantics: {
    core: [
      { symbol: 'sign of dot(P - Q, n)', meaning: 'Which side of the nearest triangle P is on. Negative is behind it, so inside. Measured reliable even at ties.' },
      { symbol: 'perpendicular distance', meaning: 'Measured at right angles to the OTHER surface. What every lesson so far computed.' },
      { symbol: 'along-normal distance', meaning: 'Measured along THIS surface’s normal. What stock on a wall and depth of cut mean.' },
      { symbol: '1 / cos^2(theta)', meaning: 'The ratio between them as the surfaces tilt apart. 2x at 45 degrees, 4x at 60.' },
      { symbol: 'epsilon', meaning: 'How far off its own surface a ray starts, and the smallest t counted as a hit. Too small readmits the origin face; too large steps over thin features.' },
      { symbol: 'search band', meaning: 'The maximum distance a corresponding surface may be. Beyond it the answer is "none found", not a number.' },
      { symbol: 'the four states', meaning: 'removed, added, unchanged, no surface. The fourth is what keeps the other three honest.' },
    ],
    rulesOfThumb: [
      'Measure along the surface’s own normal when the question is about material. Perpendicular distance answers a different question and diverges fast with angle.',
      'The nearest-triangle normal is a reliable source of sign. Ties do not break it, because the tied triangles share the edge the closest point is on.',
      'Offset the ray origin off its own surface and require t > epsilon, or every ray hits its own starting triangle at zero.',
      'Search both directions. A ray only goes forwards, and the other surface may be behind you.',
      'Always impose a search band. Without one, coincident surfaces report the next thing along, which is a real number about the wrong place.',
      'Report "no corresponding surface" as a first-class answer. "I do not know" beats a confident wrong number.',
    ],
  },

  hook: {
    question: 'Two surfaces 0.05 apart at the point you are measuring, with the second tilted 60 degrees to the first. The nearest-distance query says 0.025. The normal-directed ray says 0.100. Which is wrong?',
    realWorldContext: 'Neither. They answer different questions. Nearest distance is measured perpendicular to the other surface; stock on a wall and depth of cut are measured along this surface’s own normal, because that is the direction material is added or removed in. They agree only when the surfaces are parallel and diverge as 1/cos squared - a factor of 2 at 45 degrees and 4 at 60. A 60 degree draft face is not unusual, and using the wrong one there is not a rounding difference.',
    previewVisualizationId: 'JSNotebook',
  },

  intuition: {
    prose: [
      'The application never wanted a distance. It wants to know whether there is more material here than there should be, less, or neither.',
      'That needs a direction as well as a magnitude, and it is a question about two surfaces rather than one.',
      'The sign is the easy part: the nearest triangle’s normal supplies it, and measurement says it does not fail even at ties.',
      'The hard part is that nearest distance is perpendicular to the other surface, while material is measured along this one’s normal.',
      'Those agree only when the surfaces are parallel, and diverge as 1/cos squared - twice at 45 degrees, four times at 60.',
      'So fire a ray along the surface’s own normal, both ways, and take the first hit within a band you chose deliberately.',
    ],
    callouts: [
      {
        type: 'insight',
        title: 'The sign is reliable, including at ties',
        body: 'I expected this to be the weak link, because lesson 6 measured that most queries have two or more equally close triangles and argmin picks one by storage order. Measured on a cube whose inside is known exactly: 0 wrong out of 40,000 points, and 0 out of 20,000 within 0.02 of the surface. On an L-shaped solid with a concave edge: 0 out of 60,000, and 0 out of 20,000 within 0.05 of the concave edge itself. The reason is that when two triangles tie, the closest point lies on the edge they share - and a point is on the same side of both triangles meeting at an edge. The choice is arbitrary; the answer does not depend on it.',
      },
      {
        type: 'warning',
        title: 'Two correct answers to different questions',
        body: 'Nearest Euclidean distance is measured perpendicular to the other surface. Stock on a wall, or how deep a cut went, is measured along this surface’s own normal. Measured with a 0.05 gap: at 0 degrees both give 0.05000; at 45 degrees 0.03536 against 0.07071; at 60 degrees 0.02500 against 0.10000. The ratio is 1/cos squared and it runs away quickly. Neither is wrong - but only one of them is the measurement a machinist means.',
      },
      {
        type: 'warning',
        title: 'A ray hits its own starting surface',
        body: 'The origin sits exactly on the surface it came from, so with no offset the first intersection is that triangle at t = 0. Start at P + normal x epsilon and require t > epsilon. Epsilon is then a real decision: too small and floating-point noise readmits the origin face as a hit at almost zero, which reads as "unchanged"; too large and a genuinely thin feature is stepped straight over. It has to be far smaller than the smallest change you intend to resolve.',
      },
      {
        type: 'warning',
        title: 'Without a band, coincident surfaces lie',
        body: 'Measured on a slot of half-width 0.15 whose as-cut surface is IDENTICAL to the design: the backward ray correctly skips the coincident face via epsilon, carries on, and hits the opposite wall of the slot - reporting a gap of +0.300 when the answer is "nothing changed". Nothing malfunctioned; that is a real triangle at a real distance. A search band of 0.1 reports nothing found instead, which is the honest answer and the fourth classification the build milestone asks for.',
      },
      {
        type: 'insight',
        title: 'The band has a window, bounded at both ends',
        body: 'Too narrow and real changes are reported as "no surface"; too wide and unrelated geometry is reported as a change. Measured on the slot: a band below 0.05 cannot see a real 0.05 change, and a band of 0.30 or more reaches the far wall and calls a coincident surface "removed". The usable window is bounded below by the smallest change you must detect and above by the nearest unrelated surface - which makes it a measurement decision about the part, not a constant to inherit.',
      },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Tilt one surface and watch the two measurements come apart',
        caption: 'Blue is perpendicular, amber is along the face normal. Identical at zero tilt, 4x apart at 60 degrees.',
        props: {
          lesson: LESSON_MESH_1_10,
        },
      },
    ],
  },

  math: {
    prose: [
      'The first cell tests the thing I expected to break - the sign from the nearest normal - against a shape whose inside is known exactly, and finds it sound.',
      'The second sweeps the angle between two surfaces and shows where nearest distance stops being the measurement wanted.',
      'Then Moller-Trumbore, both directions, and the epsilon that keeps a ray off its own starting face.',
      'The last cells are about the band: what happens without one, and the window it has to sit in.',
    ],
    visualizations: [
      {
        id: 'PythonNotebook',
        title: 'The sign, the divergence, the ray, and the band',
        mathBridge: 'Moller-Trumbore solves the ray against the triangle in the same barycentric coordinates as lesson 5: the intersection is A + u(B-A) + v(C-A), and the inside test is again u >= 0, v >= 0, u + v <= 1. What changes is that the unknowns now include t along the ray, so it is a 3x3 linear system solved by Cramer’s rule - which is why a determinant near zero means the ray is parallel to the triangle and there is nothing to find. The 1/cos^2 divergence is the same projection idea seen twice: once going from A to B and once coming back.',
        caption: 'Sign reliability measured over 80,000 points before any of it is built on.',
        props: {
          initialCells: PY_CELLS,
        },
      },
    ],
  },

  examples: [
    {
      title: 'The sign that did not break',
      prose: '0 wrong signs out of 40,000 on a convex cube, 0 out of 20,000 near its surface, 0 out of 60,000 on a concave L-solid, 0 out of 20,000 at the concave edge itself. At a tie the closest point is on the shared edge and both normals agree which side you are on.',
    },
    {
      title: 'Two correct answers, four times apart',
      prose: 'A 0.05 gap with the other surface tilted 60 degrees: perpendicular distance 0.02500, along-normal distance 0.10000. The ratio is 1/cos squared, so 2x at 45 degrees and nearly 15x at 75.',
    },
    {
      title: 'The coincident surface that reported 0.300',
      prose: 'As-cut identical to as-designed, on a slot of half-width 0.15. The backward ray skips the coincident face via epsilon and hits the far wall, reporting +0.300. With a band of 0.1 it reports no corresponding surface, which is true.',
    },
  ],

  challenges: [
    {
      prompt: 'Write classify returning removed, added, unchanged or no surface, with the signed gap, honouring both a band and a tolerance.',
      hint: 'Fire both ways from an offset origin, discard hits beyond the band, take the nearer, then compare the magnitude against tol.',
    },
    {
      prompt: 'Sweep epsilon and find the largest value that still resolves a 0.001 feature, and show what happens when it is as large as the feature.',
      hint: 'Too small readmits the origin face at nearly zero; too large steps over the feature entirely.',
    },
    {
      prompt: 'Sweep the search band and find the window where both a coincident surface and a real 0.05 change are classified correctly.',
      hint: 'Bounded below by the smallest change you must see, above by the nearest unrelated surface - here the far wall at 0.30.',
    },
  ],

  misconceptions: [
    {
      claim: 'The sign from the nearest triangle is unreliable because of ties.',
      reality: 'Measured at zero errors over 80,000 points, convex and concave. At a tie the closest point is on the shared edge, and a point sits on the same side of both triangles meeting there, so the arbitrary choice does not affect the answer.',
    },
    {
      claim: 'Nearest distance and the normal-directed distance are two estimates of the same number.',
      reality: 'They are different numbers answering different questions, equal only when the surfaces are parallel. At 45 degrees they differ by 2x and at 60 by 4x.',
    },
    {
      claim: 'Signed distance is enough to say what changed.',
      reality: 'It gives a magnitude and a side. Which operation caused it, and whether the corresponding surface exists at all, are separate questions - the second of which needs the band and its fourth state.',
    },
    {
      claim: 'Epsilon is a small number you copy from somewhere.',
      reality: 'It sets the smallest feature you can resolve. Too small and the ray re-hits its own origin face through floating-point noise; too large and a thin feature is stepped over. It has to be chosen against the part.',
    },
    {
      claim: 'If the ray hits something, the measurement is valid.',
      reality: 'On coincident surfaces the ray skips the coincident face and hits whatever is next - measured, the far wall of a slot at 0.300. A real triangle at a real distance, and a meaningless answer.',
    },
    {
      claim: 'A wider search band is safer.',
      reality: 'It is unsafe in the other direction. Too wide and unrelated geometry is reported as a change; too narrow and real changes vanish. The usable window is bounded at both ends by the part itself.',
    },
  ],

  transferPrompts: [
    'When would perpendicular distance and along-normal distance give the same answer, and what does that tell you about when to worry?',
    'Why does an arbitrary choice between two tied triangles not corrupt the sign?',
    'Your classifier reports "unchanged" everywhere on one face. Name two causes and how you would tell them apart.',
    'What is the smallest feature your epsilon lets you resolve, and how would you find out?',
    'Why is "no corresponding surface" worth reporting rather than treating as zero?',
  ],

  debugging: [
    {
      symptom: 'Every point reports a gap of almost exactly zero.',
      cause: 'The ray is hitting its own origin triangle: no offset, or epsilon too small.',
      fix: 'Start at P + normal x epsilon and require t > epsilon, with epsilon well above floating-point noise and well below the smallest real feature.',
    },
    {
      symptom: 'Coincident surfaces are classified as removed, by a suspiciously round amount.',
      cause: 'No search band, so the ray skips the coincident face and reports the next surface along - often the far wall of the same feature.',
      fix: 'Impose a band and report "no corresponding surface" beyond it.',
    },
    {
      symptom: 'Distances on draft or angled faces look inflated compared to a CMM report.',
      cause: 'Along-normal and perpendicular measurements being compared as if they were the same quantity.',
      fix: 'Decide which the specification means. The ratio is 1/cos squared, so state the angle alongside the number.',
    },
    {
      symptom: 'Thin features disappear from the results.',
      cause: 'Epsilon as large as the feature, so the ray steps over it, or a band too narrow to reach the corresponding surface.',
      fix: 'Sweep both against a known thin feature rather than choosing them by feel.',
    },
    {
      symptom: 'Signs are inverted over a whole region.',
      cause: 'Inconsistent winding on the source surface, so its normals point inward there.',
      fix: 'Check winding with lesson 3’s volume sign before trusting any normal-directed measurement.',
    },
  ],

  mastery: {
    prerequisites:
      'Lesson 6 for the nearest-point query and the tie result this lesson re-examines, lesson 5 for the barycentric test Moller-Trumbore reuses, and lesson 3 for the winding check every normal depends on.',
    signals: [
      'Distinguishes perpendicular from along-normal measurement and can say when they differ.',
      'Can explain why ties do not corrupt the sign.',
      'Offsets ray origins and can say what epsilon costs in each direction.',
      'Treats "no corresponding surface" as an answer rather than a failure.',
      'Chooses a band by measuring the window rather than by picking a round number.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'mesh-engine-1-6-point-to-mesh', why: 'The nearest-point query and the tie measurement this lesson re-tests.' },
      { lessonId: 'mesh-engine-1-5-point-to-triangle', why: 'The barycentric inside test that Moller-Trumbore reuses.' },
      { lessonId: 'mesh-engine-1-3-topology-and-welding', why: 'The winding check, since every sign here depends on normals pointing outward.' },
      { lessonId: 'mesh-engine-1-2-vectors-and-triangles', why: 'The cross product that produces those normals.' },
    ],
    futureLinks: [
      { lessonId: 'mesh-engine-1-11-thresholds', why: 'The band and the tolerance chosen here become the classification decision itself.' },
    ],
  },

  checkpoints: [
    'I can say why the sign from the nearest normal survives ties.',
    'I can state when perpendicular and along-normal distance differ, and by how much.',
    'I can fire a ray along a surface normal in both directions and read the sign.',
    'I know why the ray needs an offset and what epsilon costs either way.',
    'I impose a search band and can say what bounds it at both ends.',
    'I report "no corresponding surface" rather than inventing a number.',
  ],

  assessment: {
    task: 'Given an as-designed and an as-cut surface, classify points on the first as material removed, added, unchanged or unmeasurable.',
    acceptance: [
      'Measurement taken along the surface normal, not as nearest distance, with the reason stated.',
      'Both ray directions searched, with the sign recorded.',
      'An epsilon justified against the smallest feature to be resolved.',
      'A search band justified at both ends, with "no corresponding surface" as a reported state.',
      'The coincident-surface case demonstrated as handled.',
    ],
  },

  quiz: [
    {
      question: 'Two surfaces 0.05 apart, the second tilted 60 degrees. Nearest distance says 0.025, the normal-directed ray says 0.100. Which is wrong?',
      options: [
        'Neither — they answer different questions, and agree only when the surfaces are parallel',
        'The nearest distance, which underestimates',
        'The ray, which overestimates',
        'Both — the true answer is 0.05',
      ],
      answer: 0,
      explanation: 'Perpendicular to the other surface versus along this one’s normal. The ratio is 1/cos squared: 2x at 45 degrees, 4x at 60. Only one of them is what stock on a wall means.',
    },
    {
      question: 'Two thirds of nearest-point queries are ties, so argmin picks a triangle by storage order. What does that do to the inside/outside sign?',
      options: [
        'Nothing — measured at zero errors over 80,000 points, because the tied triangles share the edge the closest point is on',
        'It makes it wrong about a third of the time',
        'It makes it wrong only on concave shapes',
        'It makes the sign undefined',
      ],
      answer: 0,
      explanation: 'At a tie the closest point lies on the shared edge, and a point is on the same side of both triangles meeting there. The choice is arbitrary and the answer does not depend on it.',
    },
    {
      question: 'Why must a normal-directed ray start slightly off the surface?',
      options: [
        'Its origin lies exactly on the surface, so with no offset the first hit is its own triangle at t = 0',
        'To avoid dividing by zero',
        'To make the maths symmetric',
        'It does not — the offset is an optimisation',
      ],
      answer: 0,
      explanation: 'Start at P + normal x epsilon and require t > epsilon. Epsilon then bounds the smallest feature that can be resolved, so it is a decision rather than a constant.',
    },
    {
      question: 'An as-cut surface identical to the design reports a gap of +0.300 on a slot of half-width 0.15. What happened?',
      options: [
        'The ray skipped the coincident face via epsilon and hit the far wall of the slot — a real triangle at a real distance, answering the wrong question',
        'A floating-point error',
        'The normal is inverted',
        'The slot is genuinely 0.3 wider than designed',
      ],
      answer: 0,
      explanation: 'Nothing malfunctioned. A search band is what turns this into "no corresponding surface found", which is the honest answer and the fourth classification.',
    },
    {
      question: 'What bounds a usable search band?',
      options: [
        'Below by the smallest change you must detect, above by the nearest unrelated surface',
        'Only below, by floating-point precision',
        'Only above, by memory',
        'Nothing — wider is always safer',
      ],
      answer: 0,
      explanation: 'Measured on the slot: below 0.05 a real 0.05 change is missed, and at 0.30 or more the far wall is reported as a change. It is a decision about the part.',
    },
    {
      question: 'Why report "no corresponding surface" as a state rather than returning zero?',
      options: [
        'Zero means "measured, and unchanged". No surface means "not measured" — collapsing them turns an unknown into a confident claim',
        'Because zero is ambiguous in floating point',
        'To make the output easier to plot',
        'There is no difference in practice',
      ],
      answer: 0,
      explanation: 'The two lead to opposite actions. One says the feature is right; the other says nobody looked, or there was nothing there to look at.',
    },
  ],
};
