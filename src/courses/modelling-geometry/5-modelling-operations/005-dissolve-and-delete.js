// Lesson 5.5: dissolve and delete. Dissolve merges faces into one by dropping the edges between them and walking
// their outline; it keeps the surface closed and, if the faces were flat together, the shape. Delete removes faces
// and leaves a hole. A merged face can be concave, and then it must be drawn by ear clipping, not a fan.
import { withPicture } from '../notebookScene.js';

const HELPERS = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
// The outline of a group of faces: directed edges a → b whose reverse b → a is not in the group, walked in order.
function outline(faces, group) {
  const directed = new Set(), next = new Map()
  for (const fi of group) faces[fi].forEach((a, i) => directed.add(a + '>' + faces[fi][(i + 1) % faces[fi].length]))
  const shared = [...directed].filter((d) => { const [a, b] = d.split('>'); return directed.has(b + '>' + a) })
  for (const d of directed) { const [a, b] = d.split('>').map(Number); if (!directed.has(b + '>' + a)) next.set(a, b) }
  const start = next.keys().next().value, loop = [start]
  for (let v = next.get(start); v !== start; v = next.get(v)) loop.push(v)
  return { loop, shared: shared.length / 2 }
}
function counts(verts, faces) {
  const E = new Map()
  faces.forEach((f) => f.forEach((a, i) => { const b = f[(i + 1) % f.length], k = Math.min(a, b) + '-' + Math.max(a, b); E.set(k, (E.get(k) || 0) + 1) }))
  const V = new Set(faces.flat()).size, open = [...E.values()].filter((c) => c === 1).length
  return 'V ' + V + ', E ' + E.size + ', F ' + faces.length + ', V − E + F = ' + (V - E.size + faces.length) + ', open edges ' + open
}
`;

const EDGE = `${HELPERS}
// Two unit squares side by side, both facing up: [0, 3, 4, 1] and [1, 4, 5, 2], sharing the edge 1–4.
const verts = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 0, 1], [1, 0, 1], [2, 0, 1]]
let faces = [[0, 3, 4, 1], [1, 4, 5, 2]]
console.log('before: ' + counts(verts, faces))
// Dissolve the shared edge. Predict first: how many corners does the merged face have?
const { loop, shared } = outline(faces, [0, 1])
faces = [loop]
console.log(shared + ' shared edge goes; the outline [' + loop.join(', ') + '] is one face with ' + loop.length + ' corners')
console.log('after:  ' + counts(verts, faces))`;

const VERTS = `${HELPERS}
// The merged face from cell 1. Vertices 1 and 4 sit in the middle of straight sides: two edges, in a line.
const verts = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 0, 1], [1, 0, 1], [2, 0, 1]]
let faces = [[0, 3, 4, 5, 2, 1]]
// Dissolving such a vertex takes it out of every face that uses it: the shape is the same, with fewer corners.
faces = faces.map((f) => f.filter((v) => v !== 1 && v !== 4))
console.log('without 1 and 4: [' + faces[0].join(', ') + '], ' + counts(verts, faces))
// A vertex with four faces round it (the middle of a 2 × 2 grid): dissolving it merges those four faces.
const g = [], gf = []
for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) g.push([i, 0, j])
for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) gf.push([i * 3 + j, i * 3 + j + 1, (i + 1) * 3 + j + 1, (i + 1) * 3 + j])
const { loop } = outline(gf, [0, 1, 2, 3])
console.log('the 2 × 2 grid\\'s middle vertex 4 dissolved: one face [' + loop.join(', ') + '], ' + loop.length + ' corners, 4 of them on straight sides')`;

const CLOSED = `${HELPERS}
// A cube, closed: 8 vertices, 12 edges, 6 faces.
const verts = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]
const cube = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [0, 4, 7, 3], [1, 2, 6, 5]]
console.log('cube:               ' + counts(verts, cube))
// Delete the top face (y = 1): it goes, and its four edges are left with one face each.
console.log('top deleted:        ' + counts(verts, cube.filter((_, i) => i !== 3)))
// Dissolve the edge between the top and the front: one face, still closed. Predict first: is it flat?
const { loop } = outline(cube, [3, 1])
const merged = [...cube.filter((_, i) => i !== 3 && i !== 1), loop]
console.log('top + front merged: ' + counts(verts, merged))
// How flat is the merged face? The distance of its corners from the plane through their centre, along its normal.
const n = [0, 0, 0]
loop.forEach((a, i) => { const p = verts[a], q = verts[loop[(i + 1) % loop.length]]; n[0] += (p[1] - q[1]) * (p[2] + q[2]); n[1] += (p[2] - q[2]) * (p[0] + q[0]); n[2] += (p[0] - q[0]) * (p[1] + q[1]) })
const l = Math.hypot(...n), c = [0, 1, 2].map((k) => loop.reduce((s, a) => s + verts[a][k], 0) / loop.length)
const off = loop.map((a) => Math.abs([0, 1, 2].reduce((s, k) => s + (verts[a][k] - c[k]) * n[k] / l, 0)))
console.log('its corners are up to ' + r(Math.max(...off)) + ' off its own plane: bent, not flat')`;

// An L of three unit squares, merged into one face: six corners, counter-clockwise seen from above.
const L_SHAPE = `${HELPERS}
const L = [[1, 0, 1], [2, 0, 1], [2, 0, 0], [0, 0, 0], [0, 0, 2], [1, 0, 2]]
// Twice the signed area of triangle a, b, c seen from above (+y): positive if it turns the same way as the face.
const area2 = (a, b, c) => (L[b][2] - L[a][2]) * (L[c][0] - L[a][0]) - (L[b][0] - L[a][0]) * (L[c][2] - L[a][2])
const fanFrom = (s) => [1, 2, 3, 4].map((i) => [s, (s + i) % 6, (s + i + 1) % 6])
// Ear clipping: cut off a corner whose triangle turns the right way and holds no other corner; repeat.
function earClip() {
  const left = [0, 1, 2, 3, 4, 5], out = []
  const inside = (x, a, b, c) => area2(a, b, x) >= 0 && area2(b, c, x) >= 0 && area2(c, a, x) >= 0
  while (left.length > 3) {
    for (let j = 0; j < left.length; j++) {
      const a = left[(j + left.length - 1) % left.length], b = left[j], c = left[(j + 1) % left.length]
      if (area2(a, b, c) > 0 && !left.some((x) => x !== a && x !== b && x !== c && inside(x, a, b, c))) { out.push([a, b, c]); left.splice(j, 1); break }
    }
  }
  return [...out, left]
}
`;

const DRAW = `${L_SHAPE}
// The L has area 3. A fan covers it exactly only if all its triangles turn the same way as the face.
for (let s = 0; s < 6; s++) {
  const tris = fanFrom(s), signed = tris.map(([a, b, c]) => area2(a, b, c) / 2)
  const covered = signed.reduce((t, x) => t + Math.abs(x), 0)
  console.log('fan from corner ' + s + ': areas ' + signed.map(r).join(', ') + (signed.every((x) => x >= 0) ? ' → covers the L exactly' : ' → ' + r(covered) + ' painted: wrong'))
}
const ears = earClip()
console.log('ear clipping: ' + ears.map((t) => '[' + t.join(', ') + ']').join(' ') + ', areas ' + ears.map(([a, b, c]) => r(area2(a, b, c) / 2)).join(', '))`;

const PICTURE = withPicture(`${L_SHAPE}
// Left: the fan from corner 2, which paints into the notch. Right: ear clipping. Each triangle its own colour,
// raised a little in turn so overlaps are visible.
const verts = [], faces = [], groups = []
function draw(tris, dx) {
  tris.forEach((t, i) => {
    const base = verts.length
    // Each triangle wound to face up, whatever its signed area, so all are visible from above.
    const tt = area2(...t) >= 0 ? t : [t[0], t[2], t[1]]
    for (const k of tt) verts.push([L[k][0] + dx, 0.02 * i, L[k][2]])
    faces.push([base, base + 1, base + 2]); groups.push(i)
  })
}
draw(fanFrom(2), -1.6)
draw(earClip(), 1.6)
console.log('left: fan from corner 2, ' + fanFrom(2).length + ' triangles; right: ear clipping, ' + earClip().length + ' triangles; the notch, the missing square of each L, must stay empty')
show({ verts, faces, groups, normals: false, zoom: 2 })`);

const CHALLENGE = `// A flat 3 × 3 grid of square faces. You select all 9 faces and dissolve them into one.
// How many corners does that face have? Then you dissolve every vertex that sits in the middle of a straight side.
// How many corners are left?
const answer = { corners: 0, after: 0 }
console.log(answer)`;

const SOLVED = CHALLENGE.replace('const answer = { corners: 0, after: 0 }', 'const answer = { corners: 12, after: 4 }');

/** The challenge's check: a 3 × 3 grid dissolved into one face has 12 corners; without the 8 straight-side vertices, 4. */
export function checkGridDissolve(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+answer\s*=\s*\{([^}]*)\}/);
  if (!m) return no('Keep the line const answer = { corners: …, after: … }.');
  const get = (k) => { const g = m[1].match(new RegExp(k + '\\s*:\\s*(-?\\d+(?:\\.\\d+)?)')); return g ? Number(g[1]) : NaN; };
  const corners = get('corners'), after = get('after');
  if ([corners, after].some(Number.isNaN)) return no('Give both as numbers: corners and after.');
  if (corners === 16) return no('16 is every vertex of the grid. The 4 inside it are on no outline edge: once the shared edges go, they belong to no face.');
  if (corners === 4) return no('4 is the shape\'s corners, but dissolving faces keeps every outline vertex, including those in the middle of the sides.');
  if (corners === 9) return no('9 is the number of faces. Count the vertices round the outside of the grid instead.');
  if (corners !== 12) return no(`The outline of a 3 × 3 grid has 3 edges per side; ${corners} is not its number of vertices.`);
  if (after === 12) return no('Dissolving a vertex in the middle of a straight side takes it out of the face: 8 of the 12 are such vertices.');
  if (after !== 4) return no(`${after} is not 12 minus the 8 vertices in the middle of the sides.`);
  return { pass: true, message: '12, then 4. The dissolve drops the 12 inner edges and walks the 12 outline edges into one face; the 4 inner vertices are left with no face and go. Two vertices sit in the middle of each side, in a straight line; dissolving those 8 leaves a 4-cornered square of the same shape.' };
}

export default {
  id: 'modelling-geometry-5-005',
  slug: 'dissolve-and-delete',
  chapter: 'modelling-geometry',
  order: 5,
  title: 'Dissolve and delete',
  subtitle: 'Merge faces by dropping the edges between them, or remove them and leave a hole; and draw the n-gons that result.',
  tags: ['dissolve', 'delete', 'n-gon', 'triangulation', 'ear clipping', 'topology'],
  coreConcept: 'Dissolve merges a group of faces into one: the edges the group walks both ways are inside it and go; the outline edges, walked one way, are followed round into the new face, which keeps the group\'s direction. Dissolving a vertex in a straight line removes it from its faces; dissolving one with more faces merges them. The surface stays closed and V − E + F is unchanged, and if the faces were flat together the shape is too. Delete removes faces and leaves open edges. A merged face can be concave or bent, and the GPU can only draw triangles: a concave face must be ear-clipped, because a fan from the wrong corner paints outside it.',
  prerequisites: ['modelling-geometry-5-004', 'modelling-geometry-1-005'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-5-006',

  hook: {
    question: 'Select some faces and press Ctrl+X: the lines between them vanish but nothing moves. Press X instead, and they vanish with a hole where they were. What is the difference, and how does the screen draw a face with eight corners?',
    realWorldContext: 'Cleaning up a model is mostly dissolving: removing loops that add no shape, merging flat areas into one face, clearing vertices in the middle of straight edges. Every engine then has to cut the resulting n-gons into triangles, and a concave one cut wrongly is a classic rendering bug.',
  },

  intuition: {
    prose: [
      'Two squares side by side share an edge. **Dissolve** that edge: the two faces become one. Which corners does it have? Walk the group\'s directed edges: the shared edge is walked $1 \\to 4$ by one face and $4 \\to 1$ by the other, so it is inside the group and goes (lesson 5.2 found an inset\'s outline the same way). The six edges walked one way only are the outline; each vertex has exactly one leaving it, so following them goes round once.',
      'Before running cell 1, predict: how many corners does the merged face have? Six, not four: vertices $1$ and $4$ are still on the outline, in the middle of its long sides. The shape is unchanged; only the division into faces changed. $V - E + F$: $6 - 7 + 2 = 1$ before, $6 - 6 + 1 = 1$ after.',
      '**Dissolving a vertex** that sits between two edges in a straight line takes it out of every face that uses it (cell 2): the face keeps its shape with fewer corners. Dissolving a vertex with more faces round it merges those faces, like dissolving all its edges at once.',
      '**Delete** is different: the faces go, and nothing replaces them. On a closed cube, deleting the top face leaves its four edges with one face each: a hole, $V - E + F$ drops from $2$ to $1$, and the mesh is no longer closed (lesson 1.5).',
      'Before running cell 3, predict: dissolve the edge between the cube\'s top and front faces. Is the merged face flat? No: its corners are up to $0.94$ off its own plane. It is still one face, bent along the old edge, and the renderer must decide how to cut it into triangles: different cuts give different shapes. Dissolve keeps the shape only when the faces were flat together.',
      'That is the drawing problem. The GPU draws triangles only, so every face with more than three corners is cut. A **fan** from corner $0$, triangles $[0, i, i + 1]$, is right for a convex face. The L of three squares is **concave**: its inside corner turns the other way. Cell 4 tries a fan from each corner: some cover the L exactly, but a fan from a corner that cannot see the whole face paints into the notch.',
      '**Ear clipping** always works on a simple polygon: find a corner whose triangle with its two neighbours turns the right way and holds no other corner (an **ear**), cut it off, and repeat. A $k$-cornered face always gives $k - 2$ triangles. MeshLab now fans convex faces and ear-clips concave ones.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Dissolve a group of faces',
        body: 'Step 1. Collect the group\'s directed edges a → b, each face walked in its own order.\nStep 2. An edge whose reverse b → a is also there is inside the group: drop it.\nStep 3. The rest is the outline: each vertex has one outline edge leaving it. Follow them from any vertex until you return: that is the new face.\nStep 4. Replace the group by the new face; vertices left in no face are removed.\nStep 5 (optional). Dissolve vertices with two edges in a straight line: take them out of their faces.',
      },
      {
        type: 'procedure',
        title: 'Procedure: Ear clipping',
        body: 'Step 1. Work in the face\'s plane, its outline counter-clockwise.\nStep 2. For each corner b, with neighbours a and c: it is an ear if triangle a, b, c turns counter-clockwise and no other remaining corner lies inside it.\nStep 3. Output the ear\'s triangle and remove b.\nStep 4. Repeat until three corners are left: the last triangle.',
      },
      {
        type: 'warning',
        title: 'Dissolve can bend a face',
        body: 'Merging faces that are not in one plane makes a non-planar face: it has no single normal, and its triangles depend on how it is cut. Dissolve only across edges between flat neighbours, or triangulate deliberately.',
      },
      {
        type: 'warning',
        title: 'Delete leaves holes',
        body: 'Deleting a face from a closed mesh opens it: open edges appear, V − E + F drops, volume and inside/outside stop making sense. Use Fill (lesson 1.6) to close a hole on purpose, or dissolve instead of deleting when you only want fewer faces.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: n-gons and how they are drawn',
        body: 'Every face reaches the GPU as triangles. A fan is the cheapest cut and right for convex faces; concave faces need ear clipping (or a smarter triangulator), and non-planar faces have no right answer at all. That is why game exports triangulate on purpose, and why modellers keep n-gons flat and convex or avoid them (lesson 5.9).',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "the screen draws a face as it is". Both Ls are the same face. On the left, cut as a fan from corner 2, triangles cover the notch and overlap; on the right, ear clipping gives four triangles that fill the L and nothing else.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'outline() in the cells is Steps 1 to 3 of dissolving; the filter in cell 2 is Step 5; earClip() in cell 4 is the ear-clipping procedure, and area2() is its turn test.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'MeshLab\'s triangulate() (core/triangulate.ts) sends each face as a fan if every corner turns the same way, and ear-clips it otherwise; picking and the heat-map contours use the same triangles, so what you click is what is drawn.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Ctrl+X dissolves the selection (faces, edges or vertices); X deletes it. With Record traces on, dissolving faces traces the shared edges and the outline walk (predict the next vertex). Mesh › Trace drawing the face shows the convexity test and every ear test for the one selected face. Scripts call mesh.dissolve({ faces }) and mesh.delete({ faces }).' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: dissolve, delete, and draw an n-gon',
        caption: 'Merging across an edge, removing vertices, delete versus dissolve, fans versus ear clipping, and both drawn.',
        props: {
          lesson: {
            title: 'Dissolve and delete',
            subtitle: 'Fewer faces, the same surface; and how n-gons are drawn.',
            cells: [
              { type: 'js', instruction: '### 1. Dissolve an edge\nPredict first: two squares merged. How many corners?', startCode: EDGE },
              { type: 'js', instruction: '### 2. Dissolve vertices\nOne in a straight line, and one with four faces round it.', startCode: VERTS },
              { type: 'js', instruction: '### 3. Delete versus dissolve on a cube\nPredict first: is the merged top and front flat?', startCode: CLOSED },
              { type: 'js', instruction: '### 4. Drawing a concave face\nA fan from each corner of the L, and ear clipping.', startCode: DRAW },
              { type: 'js', instruction: '### 5. See it\nLeft: a fan from corner 2. Right: ear clipping. Each triangle its own colour. Drag to turn.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 360 },
              { type: 'challenge', instruction: '### 6. Challenge: dissolve a whole grid\nCount the corners, before and after dissolving the straight-side vertices. The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkGridDissolve },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Dissolve and delete" in MeshLab](#/lab/mesh-lab?project=dissolve). An L is dissolved with **Record traces** on: press Play, and predict the vertex after the first round the merged face. Then select the L and use **Mesh › Trace drawing the face**: it is concave, so watch the ear tests.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Edit mode, Ctrl+X:** dissolve the selected faces, edges or vertices.\n- **X:** delete the selection, leaving a hole; the status bar\'s open-edge count goes up.\n- **Mesh › Trace drawing the face (one face):** the fan or the ear clipping it is drawn with.\n- In a script: `mesh.dissolve({ faces: [...] })`, `mesh.dissolve({ verts: [...] })`, `mesh.delete({ faces: [...] })`.\n- **In Blender:** X offers Delete and Dissolve; Ctrl+X dissolves; Limited Dissolve merges faces flatter than an angle; Triangulate Faces (Ctrl+T) cuts n-gons deliberately.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Why the outline is one loop.** In a group whose faces are consistently oriented and form a disc, each vertex on the outline has exactly one outline edge entering and one leaving: the faces round it walk their edges into and out of it in turn, and only the first and last of those edges are unmatched. So following "the edge leaving" goes round the outline once and closes.',
      '**Euler characteristic.** Merging a group of $F_g$ faces with $E_{in}$ inner edges and $V_{in}$ inner vertices (in no outline edge) changes $V - E + F$ by $-V_{in} + E_{in} - (F_g - 1)$. For a disc-shaped group, $V_{in} - E_{in} + F_g = 1$, so the change is $0$. Deleting a face from a closed surface removes 1 face and nothing else: $\\Delta = -1$.',
      '**The turn test.** For corners $a, b, c$ in the plane, $\\text{area2}(a, b, c) = (b - a) \\times (c - a)$ (the 2D cross product) is twice the signed area of the triangle: positive if $a \\to b \\to c$ turns counter-clockwise. A corner of a counter-clockwise face is convex when its turn is positive and reflex when negative.',
      '**Two ears theorem.** Every simple polygon with more than three corners has at least two ears that do not overlap (Meisters, 1975). So ear clipping never gets stuck, and it ends after $k - 3$ cuts with $k - 2$ triangles. Checking every corner each time costs $O(k^2)$ per face, which is fast for the faces a modeller makes.',
    ],
    equations: [
      { label: 'Inner edge', latex: 'a \\to b \\in G \\;\\text{and}\\; b \\to a \\in G' },
      { label: 'Turn test', latex: '\\text{area2}(a, b, c) = (b_x - a_x)(c_y - a_y) - (c_x - a_x)(b_y - a_y)' },
      { label: 'Triangles of a k-gon', latex: 'k - 2' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** Dissolving a connected, disc-shaped group of consistently oriented faces replaces it with one face whose boundary is the group\'s boundary, oriented the same way; the mesh\'s connectivity elsewhere, its orientation and its Euler characteristic are unchanged, and its geometry is unchanged if the group was planar.',
      '**Invariant viewpoint.** Dissolve and delete are purely combinatorial: they change which faces there are, never where vertices are. What changes visually is only what the faces imply: their normals and how they are cut into triangles.',
      '**Geometric picture.** A dissolve is erasing the pencil lines between tiles that lie flat together; a delete is lifting the tiles out. Ear clipping is cutting a paper L into triangles with scissors, one corner at a time, never cutting across the notch.',
      '**Where this goes.** Lesson 5.6 merges vertices themselves (moving them together); lesson 5.9 measures when n-gons are acceptable, and why quads are preferred.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-5-005-ex1',
      title: 'Which edges go?',
      problem: 'Faces $[0, 1, 4, 3]$ and $[1, 2, 5, 4]$ are dissolved together. Which edge goes, and what is the new face?',
      steps: [
        { expression: '1 \\to 4 \\text{ (second face)},\\; 4 \\to 1 \\text{ (first)}', annotation: 'Step 2: walked both ways.' },
        { expression: '0 \\to 1 \\to 2 \\to 5 \\to 4 \\to 3 \\to 0', annotation: 'Step 3: the outline, followed.' },
      ],
      conclusion: 'Edge 1–4 goes; the new face is [0, 1, 2, 5, 4, 3].',
    },
    {
      id: 'modelling-geometry-5-005-ex2',
      title: 'Delete on a closed mesh',
      problem: 'A closed mesh has $V - E + F = 2$. You delete two faces that share an edge. What is $V - E + F$, and how many open edges are there, if the two faces were quads?',
      steps: [
        { expression: 'F \\to F - 2', annotation: 'Delete removes faces only (their vertices and edges stay if still used).' },
        { expression: '\\text{the shared edge is now on no face: it goes}', annotation: 'E → E − 1.' },
        { expression: '\\Delta(V - E + F) = 0 - (-1) + (-2) = -1', annotation: 'So V − E + F = 2 − 1 = 1.' },
        { expression: '\\text{open edges: } 3 + 3 = 6', annotation: 'Each quad\'s other three edges.' },
      ],
      conclusion: 'V − E + F = 1 and 6 open edges: one hole.',
    },
    {
      id: 'modelling-geometry-5-005-ex3',
      title: 'Is it an ear?',
      problem: 'A counter-clockwise face has corners $a = (0, 0)$, $b = (2, 0)$, $c = (2, 2)$, and another corner $d = (1.5, 0.5)$. Is $b$ an ear?',
      steps: [
        { expression: '\\text{area2}(a, b, c) = 2 \\cdot 2 - 2 \\cdot 0 = 4 > 0', annotation: 'It turns the right way.' },
        { expression: 'd \\text{ is inside triangle } a, b, c', annotation: 'All three turn tests on d are positive.' },
      ],
      conclusion: 'No: d lies inside its triangle, so cutting it off would cut across the face.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-5-005-ch1',
      difficulty: 'easy',
      problem: 'Why does dissolving keep a closed mesh closed, while deleting does not?',
      walkthrough: [{ expression: '\\text{dissolve replaces faces by one with the same outline}', annotation: 'Every outline edge still has its face on each side.' }],
      answer: 'Dissolve replaces the group by one face with the same outline, so every edge that had two faces still has two. Delete removes faces, so their outline edges are left with one face each: open edges.',
    },
    {
      id: 'modelling-geometry-5-005-ch2',
      difficulty: 'medium',
      problem: 'From which corners of the L in cell 4 does a fan work, and what do those corners have in common?',
      walkthrough: [
        { expression: '\\text{cell 4: corners 0 and 3}', annotation: 'The fans with no negative areas.' },
        { expression: '\\text{each can see every other corner}', annotation: 'No line from it to another corner leaves the face.' },
      ],
      answer: 'A fan works from exactly the corners that can see the whole face: every segment from that corner to another corner stays inside the L. For the L these are corner 0, the inside corner, which sees both arms, and corner 3, the outer corner opposite it; a fan from any other corner cuts across the notch.',
    },
    {
      id: 'modelling-geometry-5-005-ch3',
      difficulty: 'hard',
      problem: 'A polygon has $k$ corners, $r$ of them reflex. Show that the angles of its $k - 2$ triangles add up to its interior angles, $(k - 2) \\cdot 180°$, and use this to say why a polygon must have at least 3 convex corners.',
      walkthrough: [
        { expression: '\\text{each triangle: } 180°', annotation: 'Ear clipping uses only corners, so its triangles\' angles fill the corners exactly.' },
        { expression: '\\text{reflex corners are each} > 180°', annotation: 'r of them.' },
        { expression: 'r \\cdot 180° < (k - 2) \\cdot 180° \\Rightarrow r \\le k - 3', annotation: 'So at least 3 corners are convex.' },
      ],
      answer: 'The triangles use only the polygon\'s corners and fill it, so their angles together are exactly the interior angles: (k − 2) · 180°. Reflex corners are each over 180°, so r · 180° < (k − 2) · 180° and r ≤ k − 3: at least three corners are convex.',
    },
  ],

  semantics: {
    core: [
      { symbol: '\\text{dissolve}', meaning: 'Merge faces into one by dropping the edges between them; the shape is kept if they were flat together.' },
      { symbol: '\\text{delete}', meaning: 'Remove faces; their outline edges become open.' },
      { symbol: '\\text{outline}', meaning: 'A group\'s directed edges whose reverse is not in the group, followed in order.' },
      { symbol: '\\text{n-gon}', meaning: 'A face with more than four corners.' },
      { symbol: '\\text{reflex corner}', meaning: 'A corner where the outline turns the other way (interior angle over 180°): the face is concave there.' },
      { symbol: '\\text{ear}', meaning: 'A corner whose triangle with its neighbours turns the right way and holds no other corner.' },
    ],
    rulesOfThumb: [
      'Dissolve for fewer faces; delete for holes.',
      'Dissolve only across flat edges, or the face bends.',
      'Fans are for convex faces; concave faces need ear clipping.',
      'A k-gon is k − 2 triangles, however it is cut.',
      'Clean up straight-line vertices after dissolving.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-1-005', label: 'Euler\'s formula', note: 'V − E + F, and how delete changes it.' },
      { lessonId: 'modelling-geometry-5-004', label: 'Bevel', note: 'Bevels add many faces; dissolve removes the ones that add no shape.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-5-006', label: 'Merge and smooth vertices', note: 'Merging vertices rather than faces.' },
      { lessonId: 'modelling-geometry-5-009', label: 'Clean topology', note: 'When n-gons are acceptable, and why quads are preferred.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-5-005-1', label: 'Read how a dissolve finds and walks the outline', type: 'read' },
    { id: 'cp-modelling-geometry-5-005-2', label: 'Read the difference between dissolve and delete', type: 'read' },
    { id: 'cp-modelling-geometry-5-005-3', label: 'Read why a concave face needs ear clipping', type: 'read' },
    { id: 'cp-modelling-geometry-5-005-4', label: 'Run cells 1 to 4: edge, vertices, cube, drawing', type: 'lab' },
    { id: 'cp-modelling-geometry-5-005-5', label: 'Trace a dissolve and the L\'s ear clipping in MeshLab', type: 'lab' },
    { id: 'cp-modelling-geometry-5-005-6', label: 'Work through example 2, delete on a closed mesh', type: 'example' },
    { id: 'cp-modelling-geometry-5-005-7', label: 'Work through example 3, is it an ear', type: 'example' },
    { id: 'cp-modelling-geometry-5-005-8', label: 'Complete the challenge: dissolve a whole grid', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-5-005-assess-1',
        type: 'choice',
        text: 'Two quads sharing an edge are dissolved into one face. How many corners does it have?',
        options: ['6', '4', '8', '7'],
        answer: '6',
        hint: 'The shared edge\'s two vertices stay, in the middle of the long sides.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-5-005-quiz-1',
      type: 'choice',
      text: 'Which edges does a dissolve remove?',
      options: ['Edges walked both ways by the group', 'Every edge of the group', 'The outline edges', 'The longest edges'],
      answer: 'Edges walked both ways by the group',
      hints: ['Cell 1.', 'Step 2.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-5-005-quiz-2',
      type: 'choice',
      text: 'You delete one face of a closed cube. What is V − E + F?',
      options: ['1', '2', '0', '3'],
      answer: '1',
      hints: ['One face fewer, nothing else.', 'Cell 3.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-5-005-quiz-3',
      type: 'choice',
      text: 'You dissolve the edge between a cube\'s top and front faces. What is true of the merged face?',
      options: ['It is bent: not flat', 'It is flat', 'It has 4 corners', 'It leaves a hole'],
      answer: 'It is bent: not flat',
      hints: ['Cell 3: up to 0.94 off its plane.', 'Warning "Dissolve can bend a face".'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-5-005-quiz-4',
      type: 'choice',
      text: 'How many triangles does any 8-cornered face become?',
      options: ['6', '8', '7', '4'],
      answer: '6',
      hints: ['k − 2.', 'However it is cut.'],
      reviewSection: 'Maths: two ears theorem',
    },
    {
      id: 'modelling-geometry-5-005-quiz-5',
      type: 'choice',
      text: 'Why can a fan draw a concave face wrongly?',
      options: ['A fan triangle can lie partly outside the face', 'Fans need more triangles', 'Fans flip the normal', 'The GPU cannot draw fans'],
      answer: 'A fan triangle can lie partly outside the face',
      hints: ['Cell 4.', 'The picture.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-5-005-quiz-6',
      type: 'choice',
      text: 'What makes a corner an ear?',
      options: ['Its triangle turns the right way and holds no other corner', 'It is the sharpest corner', 'It is the first corner', 'It is reflex'],
      answer: 'Its triangle turns the right way and holds no other corner',
      hints: ['Ear clipping, Step 2.', 'Example 3.'],
      reviewSection: 'Procedure: Ear clipping',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'Dissolve and delete do the same thing.',
      whyStudentsThinkIt: 'Both make the selected lines disappear.',
      correctionExample: 'Cell 3: deleting the cube\'s top leaves 4 open edges; dissolving the top and front leaves none.',
      contrastCase: 'On an open grid\'s border faces both can look similar, since there is no inside to expose.',
    },
    {
      falseBelief: 'A merged face has only the shape\'s corners.',
      whyStudentsThinkIt: 'You see a rectangle.',
      correctionExample: 'Cell 1: two squares merge into a 6-cornered face; the extra two lie on straight sides.',
      contrastCase: 'Dissolving those straight-line vertices too (cell 2) leaves 4.',
    },
    {
      falseBelief: 'The screen draws an n-gon directly.',
      whyStudentsThinkIt: 'You select and see one face.',
      correctionExample: 'Cell 5: the same L drawn from two triangulations looks different, one wrong.',
      contrastCase: 'Selection and the wireframe use the face; shading and picking use its triangles.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A flat floor made of 400 quads needs to be one face for a game engine\'s collision.',
      competingTechniques: ['Delete and rebuild it', 'Dissolve all its faces, then dissolve the straight-line vertices'],
      whyThisTechniqueWins: 'Dissolve keeps it attached to the walls and keeps its outline exactly; the vertex clean-up leaves just the corners.',
    },
    {
      situation: 'An exported model shows triangles poking out of a concave sign in the game.',
      competingTechniques: ['Add more faces', 'Triangulate the n-gons deliberately (ear clipping) before export'],
      whyThisTechniqueWins: 'The game fan-triangulated the concave face; triangulating it correctly first leaves nothing to guess.',
    },
  ],

  debugging: [
    {
      commonError: 'Dropping every edge of the group, outline included.',
      symptom: 'The new face has no corners, or the mesh opens up.',
      whyItHappened: 'Only edges walked both ways are inside.',
      repairStrategy: 'Keep edges walked one way only; follow them round (Steps 2–3).',
    },
    {
      commonError: 'Fan-triangulating a concave face.',
      symptom: 'Triangles appear outside the face, across a notch; picking hits empty space.',
      whyItHappened: 'The fan\'s first corner cannot see the whole face.',
      repairStrategy: 'Test convexity; ear-clip if any corner is reflex.',
    },
    {
      commonError: 'Dissolving across a sharp edge.',
      symptom: 'A face shades strangely, or its shape changes when triangulated differently.',
      whyItHappened: 'The merged face is not planar.',
      repairStrategy: 'Dissolve only flat regions; Blender\'s Limited Dissolve does this by angle.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Dissolve faces and vertices by hand, count the result, and ear-clip a concave face.',
    explainVerbally: 'Explain dissolve versus delete, why the outline is one loop, and why concave faces need ear clipping.',
    detectIncorrectApplication: 'Recognise holes from deletes, bent faces from dissolves, and wrong fans from concave faces.',
    transferToUnfamiliar: 'Clean up a model with dissolves, and triangulate n-gons safely for export.',
  },
};
