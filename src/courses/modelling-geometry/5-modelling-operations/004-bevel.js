// Lesson 5.4: bevel. Each corner at the end of a bevelled edge slides the width w along the face's other edge; a
// strip of faces joins the two sides of the edge, following a quadratic Bézier curve when there is more than one
// segment; where three bevelled edges meet, a patch fills the corner. The strips catch the light along the edge.
import { withPicture } from '../notebookScene.js';

const HELPERS = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const f3 = (v) => v.map(r).join(', ')
const sub = (a, b) => a.map((x, i) => x - b[i]), add = (a, b) => a.map((x, i) => x + b[i]), mul = (a, s) => a.map((x) => x * s)
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l) }
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
`;

const SLIDE = `${HELPERS}
// A cube 2 wide. Bevel its top front edge, from A = (-1, 1, 1) to B = (1, 1, 1), by w = 0.3.
const A = [-1, 1, 1], w = 0.3
// The top face's corner at A slides along the top face's other edge at A, towards (-1, 1, -1).
// The front face's corner at A slides down its other edge, towards (-1, -1, 1).
// Predict first: where do the two new points go?
const slide = (v, o) => add(v, mul(unit(sub(o, v)), w))
console.log('top face:   ' + f3(slide(A, [-1, 1, -1])))
console.log('front face: ' + f3(slide(A, [-1, -1, 1])))
// The left face (x = -1) has neither of its edges at A bevelled: its corner is cut off between those two points.
console.log('the left face loses corner A; its outline runs ' + f3(slide(A, [-1, 1, -1])) + ' → ' + f3(slide(A, [-1, -1, 1])) + ' instead')`;

const PROFILE = `${HELPERS}
// Across the edge, the bevel runs from p (on the top face) to q (on the front face), w from the old corner v.
// In the plane across the edge (y and z only): v = (1, 1), p = (1, 0.7), q = (0.7, 1).
const w = 0.3, v = [1, 1], p = [1, 1 - w], q = [1 - w, 1]
// A quadratic Bézier with the old corner as its control point: B(t) = (1 - t)² p + 2t(1 - t) v + t² q.
const B = (t) => add(add(mul(p, (1 - t) ** 2), mul(v, 2 * t * (1 - t))), mul(q, t * t))
// Predict first: where is B(0.5)?
console.log('B(0.5) = ' + f3(B(0.5)))
// A true round edge would be a quarter circle of radius w, centred at (1 - w, 1 - w). How far off is the curve?
const centre = [1 - w, 1 - w]
for (const n of [1, 2, 4, 8]) {
  const pts = Array.from({ length: n + 1 }, (_, s) => B(s / n))
  console.log(n + ' segment' + (n > 1 ? 's' : '') + ': points at distance ' + pts.map((x) => r(Math.hypot(...sub(x, centre)))).join(', ') + ' from the centre (a circle: all ' + w + ')')
}`;

// A cube with its top front edge bevelled, built directly: the cube's cross-section (y, z) with one corner rounded,
// swept along x from -1 to 1. Each side of the cross-section becomes a face along the edge.
const PRISM = `${HELPERS}
function bevelledCube(n, w) {
  const v = [1, 1], p = [1, 1 - w], q = [1 - w, 1]
  const B = (t) => add(add(mul(p, (1 - t) ** 2), mul(v, 2 * t * (1 - t))), mul(q, t * t))
  // The cross-section, counter-clockwise seen from +x: the square with the corner (1, 1) replaced by the curve.
  const section = [[-1, -1], [1, -1], ...Array.from({ length: n + 1 }, (_, s) => B(s / n)), [-1, 1]]
  const k = section.length, verts = [], faces = []
  for (const x of [-1, 1]) for (const [y, z] of section) verts.push([x, y, z])
  for (let i = 0; i < k; i++) faces.push([i, (i + 1) % k, k + (i + 1) % k, k + i])     // along the edge
  faces.push([...Array(k).keys()].reverse(), [...Array(k).keys()].map((i) => k + i))   // the two ends
  return { verts, faces, strips: Array.from({ length: n }, (_, s) => 2 + s) }
}
const normalOf = (verts, f) => unit(cross(sub(verts[f[1]], verts[f[0]]), sub(verts[f[2]], verts[f[0]])))
`;

const STRIPS = `${PRISM}
for (const n of [1, 2, 4]) {
  const { verts, faces, strips } = bevelledCube(n, 0.3)
  const E = new Set(); faces.forEach((f) => f.forEach((a, i) => { const b = f[(i + 1) % f.length]; E.add(Math.min(a, b) + '-' + Math.max(a, b)) }))
  console.log(n + ' segment' + (n > 1 ? 's' : '') + ': V ' + verts.length + ', E ' + E.size + ', F ' + faces.length + ', V − E + F = ' + (verts.length - E.size + faces.length) + '; the end faces have ' + faces.at(-1).length + ' corners')
  // Each strip face's normal turns a step further from the top (+y) towards the front (+z).
  console.log('   strip normals, degrees from up: ' + strips.map((s) => r(Math.acos(normalOf(verts, faces[s])[1]) * 180 / Math.PI)).join(', '))
}`;

const CORNER = `${HELPERS}
// Three bevelled edges meet at the cube's corner v = (1, 1, 1). Each of the three faces there is between two bevels,
// so its corner becomes one point: w along each of its two edges at v.
const v = [1, 1, 1], w = 0.3
const dirs = { x: [-1, 0, 0], y: [0, -1, 0], z: [0, 0, -1] }      // along the three edges, away from v
const faces = { top: ['x', 'z'], front: ['x', 'y'], right: ['y', 'z'] }
const pts = {}
for (const [name, [a, b]] of Object.entries(faces)) {
  pts[name] = add(v, add(mul(dirs[a], w), mul(dirs[b], w)))
  console.log(name + ' face corner → ' + f3(pts[name]))
}
// One segment: the three points leave a triangle hole at the corner, filled by one patch.
console.log('1 segment: a 3-sided patch')
// Two segments: between each pair, the curve's middle point, bent towards v (B(0.5) = p/4 + v/2 + q/4).
const mid = (p, q) => add(add(mul(p, 0.25), mul(v, 0.5)), mul(q, 0.25))
console.log('2 segments: a 6-sided patch; between top and front, ' + f3(mid(pts.top, pts.front)))`;

const PICTURE = withPicture(`${PRISM}
// A cube with one edge bevelled in 4 segments, lit from the upper front: brightness = N · L for each face.
// Faces 0–7 run along the edge: back, top, the 4 strips, front, bottom; then the two ends.
const { verts, faces } = bevelledCube(4, 0.3)
const L = unit([0.3, 1, 0.6])
const values = faces.map((f) => Math.max(0, dot(normalOf(verts, f), L)))
console.log('brightness: top ' + r(values[1]) + ', strips ' + [2, 3, 4, 5].map((s) => r(values[s])).join(', ') + ', front ' + r(values[6]))
show({ verts, faces, values, zoom: 1.2 })`);

const CHALLENGE = `// You bevel one edge of a cube with 3 segments.
// How many faces does the cube have now, and how many corners does each of the two end faces have?
const answer = { faces: 0, endCorners: 0 }
console.log(answer)`;

const SOLVED = CHALLENGE.replace('const answer = { faces: 0, endCorners: 0 }', 'const answer = { faces: 9, endCorners: 7 }');

/** The challenge's check: a cube with one edge bevelled in 3 segments has 9 faces, and each end face 7 corners. */
export function checkSegments(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+answer\s*=\s*\{([^}]*)\}/);
  if (!m) return no('Keep the line const answer = { faces: …, endCorners: … }.');
  const get = (k) => { const g = m[1].match(new RegExp(k + '\\s*:\\s*(-?\\d+(?:\\.\\d+)?)')); return g ? Number(g[1]) : NaN; };
  const faces = get('faces'), ends = get('endCorners');
  if ([faces, ends].some(Number.isNaN)) return no('Give both as numbers: faces and endCorners.');
  if (faces === 7) return no('7 is right for one segment. Each segment is one strip face: 3 segments, 3 strip faces in place of the edge.');
  if (faces === 8) return no('The bevelled edge disappears and 3 strip faces take its place, added to the cube\'s 6 faces.');
  if (faces !== 9) return no(`${faces} is not 6 faces plus one strip face per segment.`);
  if (ends === 4) return no('Each end face had a corner at the bevelled edge. That corner is cut off by the curve: it is replaced by the curve\'s points.');
  if (ends === 5) return no('5 is right for one segment, where the corner is replaced by 2 points. With 3 segments the curve has 4 points.');
  if (ends === 6) return no('The curve has one point more than it has segments: 3 segments, 4 points, in place of 1 corner.');
  if (ends !== 7) return no(`${ends} is not 4 − 1 + (segments + 1).`);
  return { pass: true, message: '9 faces and 7-cornered ends. The edge becomes a strip of 3 faces (6 + 3 = 9), and each end face loses its corner at the edge but gains the curve\'s 4 points: 4 − 1 + 4 = 7. V − E + F stays 2.' };
}

export default {
  id: 'modelling-geometry-5-004',
  slug: 'bevel',
  chapter: 'modelling-geometry',
  order: 4,
  title: 'Bevel',
  subtitle: 'Slide corners along their edges, bridge each bevelled edge with a strip, and patch the corners where bevels meet.',
  tags: ['bevel', 'bezier', 'chamfer', 'hard-surface', 'shading', 'modelling'],
  coreConcept: 'Bevel replaces a sharp edge with a strip of faces. At each end of the edge, every face corner is replaced by new points: a corner beside the bevelled edge slides the width w along the face\'s other edge; a corner between two bevelled edges becomes one point, w along each; a corner with no bevelled edge is cut off between its neighbours\' slid points. A strip joins the two sides of the edge; with n segments it follows a quadratic Bézier curve with the old corner as control point, B(t) = (1 − t)² p + 2t(1 − t) v + t² q. Where three bevelled edges meet, a patch fills the corner. The strip\'s in-between normals catch the light along the edge.',
  prerequisites: ['modelling-geometry-5-003', 'modelling-geometry-3-005'],
  timeToComplete: 45,
  nextLesson: 'modelling-geometry-5-005',

  hook: {
    question: 'Real objects have no perfectly sharp edges, and in a render a sharp edge looks fake: it never catches the light. How does Ctrl+B round an edge off, and what does it do where three rounded edges meet?',
    realWorldContext: 'Every machined, moulded or cast product has rounded or chamfered edges, and every hard-surface model (vehicles, props, product shots) bevels its edges so they catch a thin highlight. CAD calls them fillets and chamfers.',
  },

  intuition: {
    prose: [
      'Take a cube and bevel its top front edge by $w = 0.3$. At each end of the edge, three faces meet. Each face\'s corner there is replaced by new points, depending on how many of that face\'s two edges at the corner are bevelled.',
      '**One bevelled edge** (the top face, and the front face): the corner slides $w$ along the face\'s other edge, away from the bevel: $v + w\\,\\widehat{(o - v)}$. Before running cell 1, predict: the top face\'s corner at $A = (-1, 1, 1)$ slides towards $(-1, 1, -1)$. Where does it go? $(-1, 1, 0.7)$.',
      '**No bevelled edge** (the left end face): both its edges at $A$ were slid along by its neighbours, so its corner is cut off between those two slid points. **Two bevelled edges** (where bevels meet at a corner): one point, $w$ along each edge.',
      'A **strip** of faces then joins the top face\'s new edge to the front face\'s. With one segment it is a single flat face, a **chamfer**. With $n$ segments it follows a curve with $n + 1$ points: a quadratic Bézier from $p$ to $q$ that bends towards the old corner $v$, $B(t) = (1 - t)^2 p + 2t(1 - t)\\,v + t^2 q$.',
      'Before running cell 2, predict $B(0.5)$ for $p = (1, 0.7)$, $v = (1, 1)$, $q = (0.7, 1)$: $\\tfrac14 p + \\tfrac12 v + \\tfrac14 q = (0.925, 0.925)$. The curve is not quite a circle: its middle point is $0.318$ from the circle\'s centre where a circle would be $0.3$, a $6\\%$ bulge. Visually it reads as round.',
      'The end faces gain the curve\'s points: a square end loses one corner and gains $n + 1$ points (cell 3). Where **three** bevelled edges meet, the three faces\' new points leave a hole round the corner: a triangle with one segment, a hexagon with two (the curves\' middle points between them). A **patch** fills it (cell 4); a curved patch is fanned into triangles from its centre.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Bevel edges by w with n segments',
        body: 'Step 1. Clamp w below half the shortest edge at any bevelled vertex, so bevels from two ends cannot cross.\nStep 2. At each end vertex v, for each face corner at v, with the face\'s edges to p and q:\n   both edges bevelled: one point v + w·unit(p − v) + w·unit(q − v);\n   one bevelled: slide along the other, v + w·unit(o − v);\n   neither: cut the corner off between the neighbours\' slid points (along the curve if n > 1).\nStep 3. For each bevelled edge, a strip of n quads between its two sides, through B(s/n) = (1 − t)² p + 2t(1 − t) v + t² q at each end.\nStep 4. Where the new points round v leave a hole (three or more bevels meeting), fill it with a patch; if n > 1, fan it from its centre.',
      },
      {
        type: 'warning',
        title: 'The width is clamped',
        body: 'Asking for more width than an edge can take makes the bevels from its two ends overlap and the mesh fold. MeshLab clamps w to just under half the shortest edge at a bevelled vertex, and the trace says so; Blender has a Clamp Overlap option that does the same.',
      },
      {
        type: 'warning',
        title: 'A chamfer is not a round',
        body: 'With one segment the bevel is a flat 45° face: a chamfer. It catches the light as one flat band. Two or three segments are usually enough for a round edge to read as round at a distance; more is wasted geometry unless the edge is close to the camera.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: catching highlights on edges',
        body: 'A sharp 90° edge has two face normals and nothing in between, so no light direction lights the edge itself: it renders as a hard line between two tones. A bevel\'s strip faces have normals in between (cell 3: 18° and 72° from up with two segments; 8°, 31°, 59° and 82° with four), so the edge picks up a thin highlight from lights the big faces miss. With smooth shading the strip blends into a soft gradient; the big faces stay flat because their normals are unchanged.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "a bevel this small cannot change how the model looks". The top and front faces are lit at about 0.8 and 0.5; the strip between them steps through the brightnesses in between, and the brightest face of the whole model is a strip face: the highlight along the edge.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'slide() in cell 1 is Step 2\'s one-bevel case; B() in cell 2 is Step 3\'s curve; bevelledCube() builds Step 3\'s strip for one edge; cell 4 is Step 4\'s patch.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'Each strip face is drawn as two triangles with its own normal (flat) or with averaged vertex normals (smooth). Either way the GPU only sees more normals in between; the highlight comes from the fragment shader\'s N · L (lesson 3.5).' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Ctrl+B bevels the selected edges; change Width and Segments in the Adjust panel. With Record traces on, the trace shows the width (and any clamp), the first slide (predict it), the first curve point (predict it), what replaces each face corner, the strips and the patches. Scripts call mesh.bevel(edges, width, segments).' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: bevel an edge',
        caption: 'Slid corners, the Bézier profile, the strip and its normals, the corner patch, and the highlight.',
        props: {
          lesson: {
            title: 'Bevel',
            subtitle: 'Slide, curve, strip and patch.',
            cells: [
              { type: 'js', instruction: '### 1. Corners slide along their edges\nPredict first: where does the top face\'s corner at A go?', startCode: SLIDE },
              { type: 'js', instruction: '### 2. The profile\nPredict first: B(0.5). Then compare the curve with a true circle.', startCode: PROFILE },
              { type: 'js', instruction: '### 3. The strip\nOne edge bevelled with 1, 2 and 4 segments: counts, end faces, and the strip normals.', startCode: STRIPS },
              { type: 'js', instruction: '### 4. Where three bevels meet\nThe patch at the corner.', startCode: CORNER },
              { type: 'js', instruction: '### 5. See the highlight\nEach face\'s brightness N · L, with no other lighting. Drag to turn.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 360 },
              { type: 'challenge', instruction: '### 6. Challenge: three segments\nCount the faces and the end faces\' corners. The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkSegments },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Bevel" in MeshLab](#/lab/mesh-lab?project=bevel). Three edges at one corner of a block are bevelled with **Record traces** on: press Play, predict where the first corner slides and where the first curve point goes, and watch the 6-sided patch fill the corner. Then bevel an edge yourself with Ctrl+B.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Edit mode, edges selected, Ctrl+B:** bevel; change **Width** and **Segments** in the Adjust panel.\n- **Object › Shade smooth** to see the bevel as a soft highlight; leave the big faces\' edges unbevelled where you want them crisp.\n- In a script: `mesh.bevel([[a, b], …], 0.08, 2)`.\n- [Open "Hard-surface crate" in MeshLab](#/lab/mesh-lab?project=crate): every edge bevelled with two segments.\n- [Open "Dining set" in MeshLab](#/lab/mesh-lab?project=dining-set): bevels on furniture edges.\n- **In Blender:** Ctrl+B (scroll for segments), and the Bevel modifier for a non-destructive bevel; its Shape setting changes the profile.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Sliding.** A point $w$ along the edge from $v$ to $o$ is $v + w\\,(o - v)/\\|o - v\\|$. Sliding along the face\'s other edge keeps the new point on the face, so the face stays flat; the clamp $w < \\tfrac12\\|o - v\\|$ keeps the slid points from both ends of an edge in order.',
      '**The Bézier profile.** $B(t) = (1 - t)^2 p + 2t(1 - t)\\,v + t^2 q$ has $B(0) = p$, $B(1) = q$, and $B\'(0) = 2(v - p)$, $B\'(1) = 2(q - v)$: it leaves $p$ heading straight for the old corner, along the face it came from, and arrives at $q$ along the other face. So the curve meets both faces tangentially: no crease where the bevel joins them.',
      '**Not a circle.** For a $90°$ corner with $p, q$ at distance $w$ from $v$, the circle through $p$ and $q$ tangent to both faces has radius $w$. $B(\\tfrac12) = \\tfrac14 p + \\tfrac12 v + \\tfrac14 q$ is $v - \\tfrac14(w, w)$ in the cross-section, and the centre is $v - (w, w)$, so it is $\\tfrac34(w, w)$ from the centre: a distance of $\\tfrac34\\sqrt2\\,w \\approx 1.061w$ (cell 2: $0.3182$ for $w = 0.3$). A quadratic Bézier cannot draw a circle exactly; rational Béziers (NURBS) can, which is what CAD uses.',
      '**Counts.** Bevelling one edge of a cube with $n$ segments gives a prism over a cross-section with $n + 4$ sides: $V = 2(n + 4)$, $E = 3(n + 4)$, $F = (n + 4) + 2 = n + 6$, so $V - E + F = 2$, and each end face has $n + 4$ corners.',
    ],
    equations: [
      { label: 'Slide', latex: "v' = v + w\\,\\frac{o - v}{\\|o - v\\|}" },
      { label: 'Profile', latex: 'B(t) = (1 - t)^2\\,p + 2t(1 - t)\\,v + t^2\\,q, \\quad t = \\tfrac{s}{n}' },
      { label: 'Tangents', latex: "B'(0) = 2(v - p), \\quad B'(1) = 2(q - v)" },
      { label: 'One edge, n segments', latex: 'F = 6 + n, \\qquad \\text{end faces: } n + 4 \\text{ corners}' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** For a set of edges on a closed manifold mesh and a width $w$ below half the shortest edge at their ends, bevelling with $n$ segments replaces each bevelled edge by a strip of $n$ quads whose cross-section is the quadratic Bézier from $p$ to $q$ with control point $v$, replaces each face corner at an end vertex as in Step 2, and fills each hole left round a vertex with a patch. The result is a closed manifold with the same Euler characteristic.',
      '**Invariant viewpoint.** The bevel does not depend on the mesh\'s numbering and commutes with rigid motions. It does depend on scale: $w$ is a length, so a model scaled up gets relatively thinner bevels unless $w$ scales with it.',
      '**Geometric picture.** A bevel rolls a ball of radius about $w$ along the edge (approximately: the Bézier bulges 6%) and keeps the surface the ball touches; where three edges meet, the ball rolls into the corner and the patch is a piece of that ball.',
      '**Where this goes.** Lesson 5.5 dissolves faces without changing the shape, the opposite of adding them; lesson 6.4 shows how loops near an edge do under subdivision what a bevel does by hand.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-5-004-ex1',
      title: 'A slid corner',
      problem: 'The corner $v = (2, 0, 0)$ of a face slides $w = 0.25$ along the face\'s edge towards $o = (2, 0, -1)$. Where does it go?',
      steps: [
        { expression: 'o - v = (0, 0, -1), \\quad \\|o - v\\| = 1', annotation: 'The edge direction.' },
        { expression: "v' = (2, 0, 0) + 0.25\\,(0, 0, -1) = (2, 0, -0.25)", annotation: 'Step 2, one bevel.' },
      ],
      conclusion: '(2, 0, −0.25).',
    },
    {
      id: 'modelling-geometry-5-004-ex2',
      title: 'A curve point',
      problem: 'A bevel profile has $p = (0, 1)$, $v = (1, 1)$, $q = (1, 0)$. Find $B(\\tfrac13)$.',
      steps: [
        { expression: '(1 - t)^2 = \\tfrac49,\\; 2t(1 - t) = \\tfrac49,\\; t^2 = \\tfrac19', annotation: 'The weights; they sum to 1.' },
        { expression: 'B = \\tfrac49(0, 1) + \\tfrac49(1, 1) + \\tfrac19(1, 0) = (\\tfrac59, \\tfrac89)', annotation: 'Weighted sum.' },
      ],
      conclusion: 'B(1/3) = (0.556, 0.889).',
    },
    {
      id: 'modelling-geometry-5-004-ex3',
      title: 'Counting a bevelled box',
      problem: 'All 12 edges of a cube are bevelled with 1 segment. How many faces?',
      steps: [
        { expression: '6\\text{ original faces, shrunk}', annotation: 'They keep their 4 corners: each corner is between two bevels.' },
        { expression: '12\\text{ strips}', annotation: 'One per edge.' },
        { expression: '8\\text{ triangle patches}', annotation: 'Three bevels meet at every corner.' },
      ],
      conclusion: '6 + 12 + 8 = 26 faces.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-5-004-ch1',
      difficulty: 'easy',
      problem: 'Why is the width clamped below half the shortest edge at a bevelled vertex?',
      walkthrough: [{ expression: '\\text{each end slides } w \\text{ towards the other}', annotation: 'Past half way, they cross.' }],
      answer: 'Points slide w in from both ends of an edge; if w were more than half the edge, the two would pass each other and the faces would fold over.',
    },
    {
      id: 'modelling-geometry-5-004-ch2',
      difficulty: 'medium',
      problem: 'Show that the Bézier profile meets each face tangentially.',
      walkthrough: [
        { expression: "B'(0) = 2(v - p)", annotation: 'Differentiate at t = 0.' },
        { expression: 'v - p \\text{ lies along the face that } p \\text{ is on}', annotation: 'p was slid from v along that face.' },
      ],
      answer: "B′(0) = 2(v − p) points from p back along its face towards v, so the curve leaves p along the face; likewise B′(1) = 2(q − v) arrives at q along the other face. No crease at either side.",
    },
    {
      id: 'modelling-geometry-5-004-ch3',
      difficulty: 'hard',
      problem: 'All 12 edges of a cube are bevelled with 1 segment (example 3: 26 faces). Count V and E, and check V − E + F = 2.',
      walkthrough: [
        { expression: 'V = 8 \\times 3 = 24', annotation: 'Each corner is replaced by one point on each of its 3 faces; the corners themselves go.' },
        { expression: 'E = 6 \\times 4 + 8 \\times 3 = 48', annotation: 'Every edge is on a shrunk face or a corner triangle, never both; each strip\'s 4 edges are 2 of each.' },
        { expression: '24 - 48 + 26 = 2', annotation: 'Still a sphere-like closed surface.' },
      ],
      answer: 'V = 24 (3 new points per corner), E = 48 (the 6 shrunk faces\' 24 edges plus the 8 triangles\' 24; the strips share all of theirs), F = 26: 24 − 48 + 26 = 2.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'w', meaning: 'The width: how far each corner slides along its edge.' },
      { symbol: 'n', meaning: 'Segments: how many strip faces across each bevelled edge.' },
      { symbol: 'v', meaning: 'The old corner: the vertex at the end of a bevelled edge, and the curve\'s control point.' },
      { symbol: 'p, q', meaning: 'The slid points on the two faces beside a bevelled edge, where the curve starts and ends.' },
      { symbol: 'B(t)', meaning: 'The quadratic Bézier profile, (1 − t)² p + 2t(1 − t) v + t² q.' },
      { symbol: '\\text{patch}', meaning: 'The face filling the hole where three or more bevelled edges meet.' },
    ],
    rulesOfThumb: [
      'One segment is a chamfer; two or three read as round.',
      'Width is a length: it does not scale with the model.',
      'Three bevels at a corner make a patch.',
      'The highlight lives on the strip faces.',
      'Bevel the edges that should catch light; leave the rest sharp.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-3-005', label: 'Flat and smooth shading', note: 'Why the strip\'s in-between normals catch the light.' },
      { lessonId: 'modelling-geometry-5-003', label: 'Edge rings and loop cuts', note: 'Another way to add strips of faces along edges.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-5-005', label: 'Dissolve and delete', note: 'Merging faces back without changing the shape.' },
      { lessonId: 'modelling-geometry-6-004', label: 'Keeping edges sharp', note: 'Support loops: what subdivision needs instead of a bevel.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-5-004-1', label: 'Read the three ways a face corner is replaced', type: 'read' },
    { id: 'cp-modelling-geometry-5-004-2', label: 'Read how the Bézier profile meets both faces', type: 'read' },
    { id: 'cp-modelling-geometry-5-004-3', label: 'Read why a bevel catches the light', type: 'read' },
    { id: 'cp-modelling-geometry-5-004-4', label: 'Run cells 1 to 4: slide, profile, strip, patch', type: 'lab' },
    { id: 'cp-modelling-geometry-5-004-5', label: 'Trace a corner bevel in MeshLab and predict a slide and a curve point', type: 'lab' },
    { id: 'cp-modelling-geometry-5-004-6', label: 'Work through example 2, a curve point', type: 'example' },
    { id: 'cp-modelling-geometry-5-004-7', label: 'Work through example 3, a bevelled box', type: 'example' },
    { id: 'cp-modelling-geometry-5-004-8', label: 'Complete the challenge: three segments', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-5-004-assess-1',
        type: 'choice',
        text: 'One edge of a cube is bevelled with 2 segments. How many faces does the cube have?',
        options: ['8', '7', '10', '6'],
        answer: '8',
        hint: '6 + one strip face per segment.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-5-004-quiz-1',
      type: 'choice',
      text: 'A face corner has exactly one of its two edges bevelled. What replaces it?',
      options: ['A point w along its other edge', 'A point w along each edge', 'Nothing: the corner stays', 'The curve\'s points'],
      answer: 'A point w along its other edge',
      hints: ['Cell 1.', 'Step 2, one bevel.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-5-004-quiz-2',
      type: 'choice',
      text: 'What is B(0.5) for p = (1, 0.7), v = (1, 1), q = (0.7, 1)?',
      options: ['(0.925, 0.925)', '(0.85, 0.85)', '(1, 1)', '(0.788, 0.788)'],
      answer: '(0.925, 0.925)',
      hints: ['p/4 + v/2 + q/4.', 'Cell 2.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-5-004-quiz-3',
      type: 'choice',
      text: 'What fills the corner where three bevelled edges meet?',
      options: ['A patch face (fanned into triangles if curved)', 'Nothing: the strips meet exactly', 'A fourth strip', 'The original corner vertex'],
      answer: 'A patch face (fanned into triangles if curved)',
      hints: ['Cell 4.', 'Step 4.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-5-004-quiz-4',
      type: 'choice',
      text: 'Why does a bevelled edge catch a highlight that a sharp edge does not?',
      options: ['Its strip faces have normals between the two big faces\'', 'It is smoother to the GPU', 'It has more vertices', 'Bevels are always lit'],
      answer: 'Its strip faces have normals between the two big faces\'',
      hints: ['Cell 3: 8°, 31°, 59°, 82° from up.', 'The graphics strand.'],
      reviewSection: 'Insight "The graphics strand"',
    },
    {
      id: 'modelling-geometry-5-004-quiz-5',
      type: 'choice',
      text: 'You ask for a bevel width of 1 on an edge whose neighbouring edges are 1 long. What does MeshLab do?',
      options: ['Clamps the width to just under 0.5', 'Uses 1, and the faces fold', 'Refuses to bevel', 'Scales the model'],
      answer: 'Clamps the width to just under 0.5',
      hints: ['Warning "The width is clamped".', 'Step 1.'],
      reviewSection: 'Warning "The width is clamped"',
    },
    {
      id: 'modelling-geometry-5-004-quiz-6',
      type: 'choice',
      text: 'How many corners does an end face of a cube have after one of its edges is bevelled with n segments?',
      options: ['n + 4', '4', 'n + 3', '2n + 2'],
      answer: 'n + 4',
      hints: ['It loses 1 corner and gains n + 1 points.', 'Cell 3.'],
      reviewSection: 'Cell 3',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'A bevel only moves the edge; it adds no faces.',
      whyStudentsThinkIt: 'In the viewport the edge just looks softer.',
      correctionExample: 'Cell 3: one edge with 4 segments takes the cube from 6 faces to 10.',
      contrastCase: 'A smooth-shading trick (auto smooth) softens how an edge looks without adding faces, but it cannot catch a highlight on the edge.',
    },
    {
      falseBelief: 'More segments make a perfect circle.',
      whyStudentsThinkIt: 'The profile looks round.',
      correctionExample: 'Cell 2: the quadratic Bézier\'s middle point is 0.318 from the centre, not 0.3, however many segments sample it.',
      contrastCase: 'Rational Béziers and NURBS in CAD can make exact circular fillets.',
    },
    {
      falseBelief: 'Where three bevels meet, the strips simply overlap.',
      whyStudentsThinkIt: 'Each strip is made on its own.',
      correctionExample: 'Cell 4: the three faces\' new points leave a hole, and a patch fills it.',
      contrastCase: 'Where only two bevelled edges meet with no third face between them, no hole is left.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A product render looks like a computer model even though the shapes are right.',
      competingTechniques: ['Add more lights', 'Bevel the visible edges with 2–3 segments'],
      whyThisTechniqueWins: 'Real objects have no knife-sharp edges; the bevel gives each edge a thin highlight, which is what reads as "real".',
    },
    {
      situation: 'A game asset must stay low in polygons but look finished.',
      competingTechniques: ['Bevel every edge with many segments', 'Chamfer (1 segment) only the silhouette edges, and use smooth shading'],
      whyThisTechniqueWins: 'One segment on the edges that catch light gives most of the effect for a few faces each.',
    },
  ],

  debugging: [
    {
      commonError: 'A width larger than the shortest edge allows.',
      symptom: 'Faces fold over or overlap near short edges.',
      whyItHappened: 'Slid points from both ends crossed.',
      repairStrategy: 'Clamp w below half the shortest edge at the bevelled vertices.',
    },
    {
      commonError: 'Leaving the end faces\' corners in place.',
      symptom: 'A sliver hole or a non-planar face at each end of the bevel.',
      whyItHappened: 'The end face still uses the old corner, which the strip no longer reaches.',
      repairStrategy: 'Replace an unbevelled corner by the curve\'s points between its slid neighbours (Step 2, neither).',
    },
    {
      commonError: 'No patch where three bevels meet.',
      symptom: 'A small hole at each bevelled corner; the mesh is no longer closed.',
      whyItHappened: 'Each strip ends at its own points, which do not meet.',
      repairStrategy: 'Collect the new points round the vertex in order and fill the hole (Step 4).',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Bevel an edge by hand: slid points, curve points, strip faces and corner patches, with face counts.',
    explainVerbally: 'Explain the three corner cases, why the Bézier meets the faces smoothly, and why bevels catch highlights.',
    detectIncorrectApplication: 'Recognise overlapping bevels, missing patches and corners left behind from their symptoms.',
    transferToUnfamiliar: 'Choose segments and width for a model\'s scale and viewing distance.',
  },
};
