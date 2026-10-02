// Lesson 4.5: the knife. A line drawn on the screen is a plane through the eye; the cut is where that plane meets
// the faces facing the viewer (or all faces, through X-ray), kept between the rays through the line's two ends.
// Each crossed edge gets one new vertex, shared by the faces on both sides, so no crack opens.
import { withPicture } from '../notebookScene.js';

// The slab: a cube 2 wide at the origin. Corners numbered x·4 + y·2 + z with 0 for −1 and 1 for +1.
const BASE = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const f3 = (v) => v.map(r).join(', ')
const sub = (a, b) => a.map((x, i) => x - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const verts = []
for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) verts.push([x, y, z])
// Faces wound so their normals point out; the front face (z = 1) is [1, 5, 7, 3].
let faces = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]
// The knife line, as MeshLab records it: the eye, and a point on the ray through each end of the line.
const eye = [0, 0, 6], from = [-2, 0.5, 0], to = [2, -0.5, 0]
const n = cross(sub(from, eye), sub(to, eye))
const d = (p) => dot(sub(p, eye), n)                 // signed distance from the knife plane, times |n|
`;

const PLANE = `${BASE}
console.log('n = (from − eye) × (to − eye) = (' + f3(n) + ')')
// The plane: every p with (p − eye) · n = 0. Here n has no z part and the eye has x = y = 0, so it is x + 4y = 0.
for (const v of [1, 5, 7, 3]) console.log('corner ' + v + ' (' + verts[v].join(', ') + '): d = ' + r(d(verts[v])) + (d(verts[v]) > 0 ? '  (one side)' : '  (the other side)'))`;

const CROSS = `${BASE}
// Walk the front face's edges. Ends on opposite sides of the plane: crossed at t = d(a) / (d(a) − d(b)).
const front = [1, 5, 7, 3]
front.forEach((a, i) => {
  const b = front[(i + 1) % 4], da = d(verts[a]), db = d(verts[b])
  if ((da < 0) === (db < 0)) { console.log('edge ' + a + '–' + b + ': not crossed (both ends on one side)'); return }
  const t = da / (da - db), p = verts[a].map((x, k) => x + t * (verts[b][k] - x))
  console.log('edge ' + a + '–' + b + ': crossed at t = ' + r(t) + ', the point (' + f3(p) + ')')
})`;

const SPLIT = `${BASE}
// Two crossings, on edges 5–7 and 3–1: new vertices 8 and 9. The face splits along 8–9.
verts.push([1, -0.25, 1], [-1, 0.25, 1])
const ring = [1, 5, 8, 7, 3, 9]                     // the front face with the new vertices put in order
const i = ring.indexOf(8), j = ring.indexOf(9)
const halves = [ring.slice(i, j + 1), [...ring.slice(j), ...ring.slice(0, i + 1)]]
console.log('front face [1, 5, 7, 3] becomes ' + JSON.stringify(halves[0]) + ' and ' + JSON.stringify(halves[1]))
// The side face on edge 5–7 is not cut, but vertex 8 goes into its ring too: no crack along the edge.
console.log('right side [4, 6, 7, 5] becomes [4, 6, 7, 8, 5]: still one face, now with 5 corners')
// Check: every edge is still on exactly two faces (a closed mesh, lesson 1.3).
// The left side face [0, 1, 3, 2] likewise takes vertex 9 on its edge 1–3.
const fixed = [[0, 1, 9, 3, 2], [4, 6, 7, 8, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], ...halves]
const count = new Map()
for (const f of fixed) f.forEach((a, k) => { const b = f[(k + 1) % f.length], key = a < b ? a + '-' + b : b + '-' + a; count.set(key, (count.get(key) || 0) + 1) })
console.log(fixed.length + ' faces; every edge on two faces: ' + [...count.values()].every((c) => c === 2))`;

const WEDGE = `${BASE}
// The line on the screen has ends; the plane does not. Only crossings between the two end rays count.
const u = sub(from, eye), w = sub(to, eye)
const inWedge = (p) => { const q = sub(p, eye); return dot(cross(u, q), n) >= 0 && dot(cross(q, w), n) >= 0 }
console.log('the crossing (1, -0.25, 1): inside the wedge ' + inWedge([1, -0.25, 1]))
// A short line, from x = -0.3 to x = 0.3 on the same slant: the same plane, but both crossings are outside it.
const u2 = sub([-0.3, 0.075, 0], eye), w2 = sub([0.3, -0.075, 0], eye)
const inShort = (p) => { const q = sub(p, eye); return dot(cross(u2, q), n) >= 0 && dot(cross(q, w2), n) >= 0 }
console.log('short line: (1, -0.25, 1) inside ' + inShort([1, -0.25, 1]) + ', (-1, 0.25, 1) inside ' + inShort([-1, 0.25, 1]) + ': nothing is cut')`;

const PICTURE_CODE = `${BASE}
// The slab after the cut: the two halves of the front face in two colours.
verts.push([1, -0.25, 1], [-1, 0.25, 1])
const cutFaces = [[0, 1, 9, 3, 2], [4, 6, 7, 8, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [8, 7, 3, 9], [9, 1, 5, 8]]
console.log(cutFaces.length + ' faces: the front split in two (amber and green)')
show({ verts, faces: cutFaces, groups: [7, 7, 7, 7, 7, 1, 2] })`;

const CHALLENGE = `// An edge from a = (1, 0, 0) to b = (1, 2, 0). Its ends' signed distances from a knife plane are
// d(a) = 2 and d(b) = -6. Where is it crossed? Give [t, x, y, z]: t along a→b, and the point.
const crossing = [0, 0, 0, 0]

console.log('t = ' + crossing[0] + ', point (' + crossing.slice(1).join(', ') + ')')`;

const SOLVED = CHALLENGE.replace('const crossing = [0, 0, 0, 0]', 'const crossing = [0.25, 1, 0.5, 0]');

/** The challenge's check: the crossing parameter and point. */
export function checkCrossing(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/^\s*const\s+crossing\s*=\s*\[([^\]\n]*)\]/m);
  const parts = m ? m[1].split(',').map((s) => s.trim()) : [];
  if (parts.length !== 4 || !parts.every((s) => /^-?[\d.]+(\s*\/\s*[\d.]+)?$/.test(s))) return no('Keep const crossing = [t, x, y, z] with four numbers or fractions.');
  const [t, x, y, z] = parts.map((s) => s.split('/').map(Number).reduce((a, b) => a / b));
  const near = (p, q) => Math.abs(p - q) < 0.005;
  if (near(t, 0.25) && near(x, 1) && near(y, 0.5) && near(z, 0)) return { pass: true, message: 't = d(a) / (d(a) − d(b)) = 2 / 8 = 0.25: a quarter of the way, where the signed distance falls from 2 through 0 on its way to −6. The point is a + 0.25 (b − a) = (1, 0.5, 0).' };
  if ([t, x, y, z].every((v) => v === 0)) return no('t = d(a) / (d(a) − d(b)); then the point is a + t (b − a).');
  if (near(t, 0.75)) return no('t = 0.75 measures from b. From a, the distance changes by 8 in all and must fall by 2 to reach 0: t = 2 / 8.');
  if (near(t, -1 / 3)) return no('d(a) / d(b) is not the crossing. Use d(a) / (d(a) − d(b)): the fraction of the total change, 2 − (−6) = 8.');
  if (near(t, 0.25)) return no(`t = 0.25 is right. The point is a + 0.25 (b − a) = (1, 0, 0) + 0.25 × (0, 2, 0).`);
  return no(`t = ${t} is not where the edge crosses. t = d(a) / (d(a) − d(b)).`);
}

export default {
  id: 'modelling-geometry-4-005',
  slug: 'the-knife',
  chapter: 'modelling-geometry',
  order: 5,
  title: 'The knife',
  subtitle: 'A line on the screen is a plane through the eye: cut the faces where it meets them, and share every new vertex so no crack opens.',
  tags: ['knife', 'plane intersection', 'mesh editing', 'topology', 'X-ray'],
  coreConcept: 'A knife line drawn on screen defines the plane through the eye and its two ends, n = (from − eye) × (to − eye); each edge whose ends have signed distances d = (p − eye)·n of opposite sign is crossed at t = d(a)/(d(a) − d(b)), crossings are kept between the rays through the line\'s ends, faces crossed twice are split, and each new vertex is put into the faces on both sides of its edge so the mesh stays closed.',
  prerequisites: ['modelling-geometry-4-004', 'modelling-geometry-4-001', 'modelling-geometry-1-003'],
  timeToComplete: 45,
  nextLesson: 'modelling-geometry-4-006',

  hook: {
    question: 'You draw a line across a model on the screen and the faces underneath are cut along it. But the screen is flat and the model is not. Where, in 3D, is that line?',
    realWorldContext: 'The knife is how modellers add edges exactly where they want them: around a window, along a panel line, across a face to fix its topology. The same plane-through-the-eye idea is used for lasso selection, slicing models for 3D printing and clipping in every renderer.',
  },

  intuition: {
    prose: [
      'Draw a slanted line across a slab on the screen. Every 3D point that lands on that line lies on one surface: the fan of pick rays (lesson 4.1) through all its pixels. Those rays all pass through the eye and through the line, so they fill a **plane** through the eye.',
      'Take the eye $e = (0, 0, 6)$ and a point on the ray through each end of the line: $f = (-2, 0.5, 0)$ and $g = (2, -0.5, 0)$. The plane\'s normal is the cross product of two directions in it (lesson 2.1): $n = (f - e) \\times (g - e) = (-6, -24, 0)$. Its equation: $(p - e) \\cdot n = 0$, here $x + 4y = 0$.',
      'For a point $p$, $d(p) = (p - e) \\cdot n$ is its **signed distance** from the plane, times $|n|$: positive on one side, negative on the other. Before running cell 2, predict: which edges of the slab\'s front face does the plane cross?',
      'An edge crosses the plane when its two ends have opposite signs. The front face\'s right edge goes from $(1, -1, 1)$ to $(1, 1, 1)$; the plane meets it where $d$ passes through $0$: at $t = \\frac{d(a)}{d(a) - d(b)} = 0.375$ of the way along, the point $(1, -0.25, 1)$. The left edge is crossed at $(-1, 0.25, 1)$. The top and bottom edges are not crossed.',
      'A face crossed in exactly two places is **split** in two along the segment between them. Each crossed edge gets one new vertex. The face beside that edge (here the right side of the slab) is not split, but the new vertex goes into its ring of corners too. Otherwise the two faces would meet along the edge with different vertices, and a **crack** would open.',
      'The line drawn has ends; the plane does not. A crossing only counts if it lies between the two rays through the ends: the **wedge**. And by default the knife cuts only faces facing the eye. With **X-ray** on it cuts through, to the faces behind as well.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Cut with the knife',
        body: 'Step 1. Take the eye $e$ and a point $f$, $g$ on the ray through each end of the screen line; $n = (f - e) \\times (g - e)$.\nStep 2. For each face to cut (facing the eye, or all with X-ray), walk its edges: $d(a) = (a - e)\\cdot n$, $d(b)$ likewise.\nStep 3. If $d(a)$ and $d(b)$ have opposite signs, the edge is crossed at $t = d(a)/(d(a) - d(b))$, the point $a + t(b - a)$; keep it only if it lies between the two end rays.\nStep 4. A face crossed exactly twice is planned for a split.\nStep 5. Give each crossed edge one new vertex; put it into the ring of every face on that edge.\nStep 6. Split each planned face along the segment between its two new vertices.',
      },
      {
        type: 'warning',
        title: 'Share the new vertex, or the mesh cracks',
        body: 'If the split face gets a new vertex on an edge but its neighbour does not, the two faces no longer share that edge: the mesh is open there (lesson 1.6), and a thin gap can show. Step 5 puts the vertex into both.',
      },
      {
        type: 'warning',
        title: 'The cut follows the plane, not the surface\'s shape',
        body: 'On a curved surface, the cut is where the plane through the eye meets it, so it looks straight only from where you drew it. Orbit after cutting and it bends with the surface.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: front faces only, or through',
        body: 'Without X-ray, the knife cuts only faces whose normals face the eye (the same test as back-face culling, lesson 1.2), so the back of the model is left whole. With X-ray the faces are drawn see-through and the knife cuts everything in the wedge, front and back.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "the knife draws a line on the surface". It cuts faces: the front of the slab is now two faces (amber and green) with a real edge between them. Invariant: the slab is still closed; every edge is on exactly two faces.',
      },
      { type: 'insight', title: 'Bridge: from the chain rule to code', body: 'n and d() in cell 1 are Steps 1 and 2; cell 2 is Step 3; cell 3 is Steps 5 and 6; cell 4 is the wedge test of Step 3.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'The knife changes the mesh on the CPU; the GPU then draws the new faces. MeshLab logs the cut as mesh.knife({ eye, from, to }), so it can be replayed exactly.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'In edit mode, K arms the knife; drag a line. Record traces shows the plane, the crossings and the split (core/knife.ts). X-ray makes it cut through.' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: a knife',
        caption: 'The plane through the eye, the crossed edges, the split, the wedge, and the cut slab.',
        props: {
          lesson: {
            title: 'The knife',
            subtitle: 'Turn a screen line into a plane, find where it crosses edges, and split faces without cracks.',
            cells: [
              { type: 'js', instruction: '### 1. The plane\nThe normal from two rays, and the signed distance of each front corner.', startCode: PLANE },
              { type: 'js', instruction: '### 2. Which edges are crossed\nPredict first: which edges of the front face does the plane cross?', startCode: CROSS },
              { type: 'js', instruction: '### 3. Split, and share\nThe front face splits in two; its neighbour takes the new vertex too.', startCode: SPLIT },
              { type: 'js', instruction: '### 4. The wedge\nThe line has ends: crossings outside the two end rays do not count.', startCode: WEDGE },
              { type: 'js', instruction: '### 5. See the cut\nThe slab after the cut. Drag to turn the picture.', startCode: withPicture(PICTURE_CODE), showPreviewByDefault: true, outputHeight: 340 },
              { type: 'challenge', instruction: '### 6. Challenge: one crossing\nWhere does an edge cross the knife plane? The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkCrossing },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "The knife" in MeshLab](#/lab/mesh-lab?project=knife-cut). With **Record traces** on, the script cuts a slab along the same line as these cells: the plane, the crossings, the split. In **Predict** mode, predict the first crossing\'s t and the number of faces cut. Compare with cell 2.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Edit mode, K:** arm the knife, then drag a line across the mesh. The new edges are selected.\n- **X-ray** on: the knife cuts through to the back faces too.\n- In a script: mesh.knife({ eye, from, to, through }).\n- **In Blender:** K for the knife (click points, Enter to confirm), C for straight cuts through X-ray; Bisect cuts with a plane you place.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Why a screen line is a plane.** A pixel is a ray from the eye (lesson 4.1). The pixels of a straight screen line give rays whose directions are blends of the two end rays\' directions, $(1 - s)(f - e) + s(g - e)$. All of them lie in the plane through $e$ spanned by $f - e$ and $g - e$.',
      '**Why $d$ is a signed distance.** $(p - e) \\cdot n$ is $|n|$ times the length of $p - e$\'s shadow on $n$ (lesson 2.1): the distance from the plane, positive on $n$\'s side. Points on the plane give $0$.',
      '**Why $t = d(a)/(d(a) - d(b))$.** Along the edge, $d(a + t(b - a)) = d(a) + t\\,(d(b) - d(a))$, because $d$ is linear. Setting it to $0$ gives the formula; opposite signs make $t$ fall between $0$ and $1$.',
      '**Why sharing keeps the mesh closed.** An edge is closed when exactly two faces have it (lesson 1.3). After the cut, the old edge $a$–$b$ is replaced by $a$–$v$ and $v$–$b$. If both faces beside it have $v$ in their rings, each of the two new edges is on both faces: still two each.',
    ],
    equations: [
      { label: 'The knife plane', latex: 'n = (f - e) \\times (g - e), \\qquad d(p) = (p - e) \\cdot n' },
      { label: 'An edge crossing', latex: 't = \\frac{d(a)}{d(a) - d(b)}, \\qquad p = a + t\\,(b - a)' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** For a planar polygon and a plane, the intersection is a set of segments whose endpoints are edge crossings. A convex face crossed transversally is crossed at exactly two points and the plane splits it into two convex pieces; a concave face may be crossed at four or more points, which MeshLab leaves uncut.',
      '**Invariant viewpoint.** The cut is determined by the plane, which is determined by the eye and the drawn line: the same drag from another camera position gives a different cut. MeshLab therefore stores the eye and the two end points, in the mesh\'s own coordinates, so a cut replays identically.',
      '**Geometric picture.** The knife sweeps a flat sheet out from the eye, bounded by the two end rays: a wedge. Where the sheet passes through the mesh, it leaves a polyline of new edges on the surface.',
      '**Where this goes.** Loop cuts (lesson 5.3) cut along a ring of quads instead of a plane. Boolean operations and 3D-print slicing intersect whole meshes or stacks of planes the same way, edge by edge.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-4-005-ex1',
      title: 'A horizontal cut',
      problem: 'Eye $(0, 0, 5)$, end points $f = (-1, 0, 0)$, $g = (1, 0, 0)$. Find the plane and where it crosses the edge from $(0.5, -1, 1)$ to $(0.5, 1, 1)$.',
      steps: [
        { expression: 'n = (-1, 0, -5) \\times (1, 0, -5) = (0, -10, 0)', annotation: 'Step 1: the plane y = 0.' },
        { expression: 'd(a) = 10, \\; d(b) = -10', annotation: 'Step 2: (a − e)·n for each end.' },
        { expression: 't = 10 / 20 = 0.5, \\; p = (0.5, 0, 1)', annotation: 'Step 3: halfway, at y = 0.' },
      ],
      conclusion: 'A horizontal line on the screen through the middle is the plane $y = 0$, and it cuts the edge at its midpoint.',
    },
    {
      id: 'modelling-geometry-4-005-ex2',
      title: 'The lesson\'s slanted cut',
      problem: 'Eye $(0, 0, 6)$, $f = (-2, 0.5, 0)$, $g = (2, -0.5, 0)$. Where is the slab\'s right front edge, $(1, -1, 1)$ to $(1, 1, 1)$, crossed?',
      steps: [
        { expression: 'n = (-6, -24, 0) \\Rightarrow x + 4y = 0', annotation: 'Step 1.' },
        { expression: 'd(a) = -6 + 24 = 18, \\; d(b) = -6 - 24 = -30', annotation: 'Step 2: (a − e)·n with a − e = (1, −1, −5).' },
        { expression: 't = 18 / 48 = 0.375', annotation: 'Step 3.' },
        { expression: 'p = (1, -1 + 0.375 \\times 2, 1) = (1, -0.25, 1)', annotation: 'On the plane: 1 + 4 × (−0.25) = 0.' },
      ],
      conclusion: 'The edge is crossed at $t = 0.375$, the point $(1, -0.25, 1)$, as MeshLab\'s trace reports.',
    },
    {
      id: 'modelling-geometry-4-005-ex3',
      title: 'Why the neighbour changes too',
      problem: 'After the cut, the right side face $[4, 6, 7, 5]$ still uses the edge $7$–$5$, which now has the new vertex $8$ on it. What must happen to it?',
      steps: [
        { expression: '\\text{front halves use } 5\\text{–}8 \\text{ and } 8\\text{–}7', annotation: 'The split replaced 5–7 by two edges.' },
        { expression: '[4, 6, 7, 5] \\text{ still uses } 7\\text{–}5', annotation: 'Without a change, 7–5 is on one face and 5–8, 8–7 on one face each: three open edges.' },
        { expression: '[4, 6, 7, 8, 5]', annotation: 'Step 5: insert 8. Now every edge is on two faces again.' },
      ],
      conclusion: 'The side face gains a fifth corner; the slab stays closed, with no crack along the cut edge.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-4-005-ch1',
      difficulty: 'easy',
      problem: 'An edge has $d(a) = 3$ and $d(b) = 1$. Is it crossed?',
      walkthrough: [{ expression: '3 > 0, \\; 1 > 0', annotation: 'Same sign: both ends on one side.' }],
      answer: 'No: both ends are on the same side of the plane, so the edge does not cross it.',
    },
    {
      id: 'modelling-geometry-4-005-ch2',
      difficulty: 'medium',
      problem: 'You knife across the front of a closed box with X-ray off. How many faces are cut, and does the back change?',
      walkthrough: [
        { expression: '\\text{only faces facing the eye}', annotation: 'Without X-ray the back faces are not candidates.' },
        { expression: '\\text{the front face (and any side face the line crosses and that faces you)}', annotation: 'Those crossed twice inside the wedge are split.' },
        { expression: '\\text{the back is untouched}', annotation: 'Its faces never get crossings.' },
      ],
      answer: 'Only the faces facing you that the line crosses twice (here the front face) are split; the back is left whole. Turn X-ray on to cut through it too.',
    },
    {
      id: 'modelling-geometry-4-005-ch3',
      difficulty: 'hard',
      problem: 'A knife cut on a curved character leaves thin dark slits along the cut in some places. What went wrong, and how is it fixed in the algorithm?',
      walkthrough: [
        { expression: '\\text{a new vertex on an edge, missing from the neighbour}', annotation: 'The neighbour was not split, so it was not updated.' },
        { expression: '\\text{open edges} \\Rightarrow \\text{gaps the background shows through}', annotation: 'Lesson 1.6: cracks and double edges show on screen.' },
        { expression: '\\text{Step 5: insert each new vertex into every face on its edge}', annotation: 'Even faces that are not cut.' },
      ],
      answer: 'New vertices were added only to the faces being split, so their unsplit neighbours kept the old edge and the mesh opened along the cut; insert each new vertex into every face that has its edge (Step 5), cut or not.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'e, \\; f, \\; g', meaning: 'The eye, and a point on the ray through each end of the screen line.' },
      { symbol: 'n = (f - e) \\times (g - e)', meaning: 'The knife plane\'s normal.' },
      { symbol: 'd(p) = (p - e) \\cdot n', meaning: 'Signed distance from the plane, times |n|: its sign says which side.' },
      { symbol: 't = d(a)/(d(a) - d(b))', meaning: 'Where along an edge the plane crosses it.' },
      { symbol: '\\text{wedge}', meaning: 'The part of the plane between the two end rays; crossings outside it are ignored.' },
      { symbol: '\\text{shared vertex}', meaning: 'A new vertex inserted into every face on its edge, so no crack opens.' },
    ],
    rulesOfThumb: [
      'A screen line is a plane through the eye.',
      'Opposite signs of d at an edge\'s ends: it is crossed.',
      'Every new vertex goes into both faces on its edge.',
      'X-ray off: front faces only; on: through.',
      'Store the eye with the cut, or it cannot be replayed.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-4-001', label: 'Picking by ray', note: 'Each pixel of the screen line is a ray; together they fill the knife plane.' },
      { lessonId: 'modelling-geometry-4-004', label: 'Dragging with a gizmo', note: 'A horizontal drag\'s rays also form a plane through the eye.' },
      { lessonId: 'modelling-geometry-1-006', label: 'Welding, cleaning and filling holes', note: 'Cracks and open edges: what sharing the new vertex prevents.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-4-006', label: 'Undo and redo', note: 'A cut is one undoable step.' },
      { lessonId: 'modelling-geometry-5-003', label: 'Edge rings and loop cuts', note: 'Another way to add edges: across a ring of quads.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-4-005-1', label: 'Read why a screen line is a plane through the eye', type: 'read' },
    { id: 'cp-modelling-geometry-4-005-2', label: 'Read how signed distances find crossed edges', type: 'read' },
    { id: 'cp-modelling-geometry-4-005-3', label: 'Read why new vertices are shared', type: 'read' },
    { id: 'cp-modelling-geometry-4-005-4', label: 'Run cells 1 to 4: the plane, the crossings, the split, the wedge', type: 'lab' },
    { id: 'cp-modelling-geometry-4-005-5', label: 'Trace a knife cut in MeshLab in Predict mode, and cut with K', type: 'lab' },
    { id: 'cp-modelling-geometry-4-005-6', label: 'Work through example 2, the slanted cut', type: 'example' },
    { id: 'cp-modelling-geometry-4-005-7', label: 'Work through example 3, why the neighbour changes', type: 'example' },
    { id: 'cp-modelling-geometry-4-005-8', label: 'Complete the challenge: one crossing', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-4-005-assess-1',
        type: 'choice',
        text: 'An edge has d(a) = 4 and d(b) = −12. Where is it crossed?',
        options: ['t = 0.25', 't = 0.75', 't = −0.33', 'It is not crossed'],
        answer: 't = 0.25',
        hint: 't = 4 / (4 + 12).',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-4-005-quiz-1',
      type: 'choice',
      text: 'What, in 3D, is a line drawn on the screen?',
      options: ['A plane through the eye', 'A line on the near plane', 'A line on the surface', 'A ray from the eye'],
      answer: 'A plane through the eye',
      hints: ['Each pixel is a ray from the eye.', 'All those rays together fill a plane.'],
      reviewSection: 'Intuition: the first paragraph',
    },
    {
      id: 'modelling-geometry-4-005-quiz-2',
      type: 'choice',
      text: 'How is the knife plane\'s normal found?',
      options: ['(from − eye) × (to − eye)', '(from − eye) · (to − eye)', 'from × to', 'The view direction'],
      answer: '(from − eye) × (to − eye)',
      hints: ['Two directions in the plane.', 'Their cross product is perpendicular to both.'],
      reviewSection: 'Procedure step 1',
    },
    {
      id: 'modelling-geometry-4-005-quiz-3',
      type: 'choice',
      text: 'An edge\'s ends have d = 5 and d = 2. What happens to it?',
      options: ['Nothing: it is not crossed', 'It is crossed at t = 0.71', 'It is crossed at its middle', 'It is deleted'],
      answer: 'Nothing: it is not crossed',
      hints: ['Same sign: same side.', 'Challenge 1.'],
      reviewSection: 'Procedure step 3',
    },
    {
      id: 'modelling-geometry-4-005-quiz-4',
      type: 'choice',
      text: 'Which of these is NOT part of a correct knife cut?',
      options: ['Adding the new vertex only to the face being split', 'Splitting faces crossed twice', 'Ignoring crossings outside the wedge', 'Using the eye in the plane'],
      answer: 'Adding the new vertex only to the face being split',
      hints: ['The neighbour on that edge must take the vertex too.', 'Otherwise a crack opens.'],
      reviewSection: 'Warning "Share the new vertex, or the mesh cracks"',
    },
    {
      id: 'modelling-geometry-4-005-quiz-5',
      type: 'choice',
      text: 'With X-ray off, which faces can the knife cut?',
      options: ['Faces facing the eye', 'All faces', 'Only selected faces', 'Back faces'],
      answer: 'Faces facing the eye',
      hints: ['The same test as back-face culling.', 'X-ray cuts through.'],
      reviewSection: 'Callout "The graphics strand: front faces only, or through"',
    },
    {
      id: 'modelling-geometry-4-005-quiz-6',
      type: 'choice',
      text: 'Why does MeshLab record the eye with every knife cut?',
      options: ['The plane depends on it, so the cut could not be replayed without it', 'For the undo stack only', 'To draw the knife line', 'It does not'],
      answer: 'The plane depends on it, so the cut could not be replayed without it',
      hints: ['The same screen line from elsewhere is a different plane.', 'Rigor: invariant viewpoint.'],
      reviewSection: 'Rigor: invariant viewpoint',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'The knife cuts along a line in 3D.',
      whyStudentsThinkIt: 'You draw a line.',
      correctionExample: 'The line becomes the plane x + 4y = 0 through the eye; on the slab it leaves edges on the front face only where the plane meets it.',
      contrastCase: 'Seen from where it was drawn, the cut does look like the line you drew.',
    },
    {
      falseBelief: 'Splitting a face never changes its neighbours.',
      whyStudentsThinkIt: 'Only the cut face looks different.',
      correctionExample: 'The right side face [4, 6, 7, 5] becomes [4, 6, 7, 8, 5]: it gains the new vertex on the shared edge.',
      contrastCase: 'A cut that runs from corner to corner of a face adds no vertex on any edge, so no neighbour changes.',
    },
    {
      falseBelief: 'A knife line that crosses the plane of a face always cuts it.',
      whyStudentsThinkIt: 'The plane is infinite.',
      correctionExample: 'A short line from x = −0.3 to 0.3 lies on the same plane, but its wedge misses both edge crossings: nothing is cut.',
      contrastCase: 'The full line reaches past both edges, so both crossings are inside its wedge.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A 3D-printing slicer must find the outline of a model at each height, every 0.2 mm.',
      competingTechniques: ['Test every pixel of a rendered image', 'Intersect each horizontal plane with every triangle edge using signed distances'],
      whyThisTechniqueWins: 'Signed distances find exact edge crossings and join them into outlines; images are limited to pixel precision.',
    },
    {
      situation: 'A modeller wants a panel line running exactly round a car door.',
      competingTechniques: ['Knife it freehand in a few strokes', 'Draw the knife strokes from the side view, where each stroke is a plane through the door\'s outline'],
      whyThisTechniqueWins: 'Each stroke is a plane through the eye, so drawing from a view where the door\'s outline is a line places the cut exactly on it.',
    },
  ],

  debugging: [
    {
      commonError: 'Adding new vertices only to the split faces.',
      symptom: 'Thin gaps along the cut; the mesh reports open edges.',
      whyItHappened: 'Neighbours kept the old edge, which now has no partner.',
      repairStrategy: 'Insert each new vertex into every face on its edge (Step 5).',
    },
    {
      commonError: 'Computing t as d(a)/d(b).',
      symptom: 'New vertices land outside the edge, or at wrong places along it.',
      whyItHappened: 'The crossing is the fraction of the total change, d(a)/(d(a) − d(b)).',
      repairStrategy: 'Use d(a)/(d(a) − d(b)) and check that the new point has d = 0.',
    },
    {
      commonError: 'Recording the cut without the eye.',
      symptom: 'Replaying a script gives a different cut from the one made by hand.',
      whyItHappened: 'The plane depends on the eye as well as the line.',
      repairStrategy: 'Store eye, from and to, in the mesh\'s own coordinates.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Build the knife plane, find edge crossings with signed distances, split faces and share new vertices.',
    explainVerbally: 'Explain why a screen line is a plane, why t = d(a)/(d(a) − d(b)), and why neighbours change.',
    detectIncorrectApplication: 'Recognise cracks from unshared vertices, wrong t formulas and missing wedge tests.',
    transferToUnfamiliar: 'Apply plane–edge crossings to slicing for 3D printing or placing panel lines from a chosen view.',
  },
};
