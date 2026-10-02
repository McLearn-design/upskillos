// Lesson 5.7: mirror and modifiers. A reflection negates one coordinate (determinant −1), so mirrored faces must be
// wound the other way to face out. Vertices on the mirror plane are shared, so the halves join. A modifier is not
// applied to the mesh you edit (the cage): the stack is evaluated from the cage every time it is drawn, until you
// apply it.
import { withPicture } from '../notebookScene.js';

const HELPERS = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const f3 = (v) => v.map(r).join(', ')
const sub = (a, b) => a.map((x, i) => x - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l) }
`;

// Half a box, x from 0 to 1, open where it meets the x = 0 plane: 8 vertices, 5 faces, all facing out.
const HALF = `${HELPERS}
const cage = {
  verts: [[0, -1, -1], [1, -1, -1], [1, 1, -1], [0, 1, -1], [0, -1, 1], [1, -1, 1], [1, 1, 1], [0, 1, 1]],
  faces: [[1, 2, 6, 5], [0, 1, 5, 4], [2, 3, 7, 6], [0, 3, 2, 1], [4, 5, 6, 7]],
}
// The mirror modifier: reflect in x = 0, share vertices within 'merge' of the plane, reverse mirrored faces.
function mirror({ verts, faces }, merge = 0.001, reverse = true) {
  const out = verts.map((v) => [...v]), map = []
  verts.forEach((v, i) => { if (Math.abs(v[0]) <= merge) map[i] = i; else { map[i] = out.length; out.push([-v[0], v[1], v[2]]) } })
  const mirrored = faces.map((f) => { const g = f.map((v) => map[v]); return reverse ? g.reverse() : g })
  return { verts: out, faces: [...faces.map((f) => [...f]), ...mirrored] }
}
function counts({ verts, faces }) {
  const E = new Map()
  faces.forEach((f) => f.forEach((a, i) => { const b = f[(i + 1) % f.length], k = Math.min(a, b) + '-' + Math.max(a, b); E.set(k, (E.get(k) || 0) + 1) }))
  const open = [...E.values()].filter((c) => c === 1).length
  return 'V ' + verts.length + ', E ' + E.size + ', F ' + faces.length + ', V − E + F = ' + (verts.length - E.size + faces.length) + ', open edges ' + open
}
`;

const REFLECT = `${HELPERS}
// Reflection in the x = 0 plane: negate x. As a matrix, the identity with −1 in the x place.
const R = [[-1, 0, 0], [0, 1, 0], [0, 0, 1]]
const apply = (M, v) => M.map((row) => dot(row, v))
const det = (M) => dot(M[0], cross(M[1], M[2]))
// Predict first: where does (0.7, 0.2, -0.4) go, and what is the determinant?
console.log('R (0.7, 0.2, -0.4) = (' + f3(apply(R, [0.7, 0.2, -0.4])) + '), det R = ' + det(R))
// Reflection in any plane through the origin with unit normal n: R = I − 2 n nᵀ. Here n = unit(1, 1, 0).
const n = unit([1, 1, 0])
const Rn = [0, 1, 2].map((i) => [0, 1, 2].map((j) => (i === j ? 1 : 0) - 2 * n[i] * n[j]))
console.log('in the plane x + y = 0: (1, 0, 0) → (' + f3(apply(Rn, [1, 0, 0])) + '), det = ' + r(det(Rn)))
// Reflecting twice gives back the point: R R = I.
console.log('twice: (0.7, 0.2, -0.4) → (' + f3(apply(Rn, apply(Rn, [0.7, 0.2, -0.4]))) + ')')`;

const WINDING = `${HELPERS}
// A triangle on the +x side, facing +z: corners counter-clockwise seen from +z.
const tri = [[0.5, 0, 1], [1, 0, 1], [0.75, 0.5, 1]]
const normal = (t) => unit(cross(sub(t[1], t[0]), sub(t[2], t[0])))
console.log('original normal: (' + f3(normal(tri)) + ')')
// Reflect its corners in x = 0. The mirror image of a face facing +z should still face +z.
const refl = tri.map(([x, y, z]) => [-x, y, z])
console.log('reflected, same order: (' + f3(normal(refl)) + '): facing in, the wrong way')
console.log('reflected, order reversed: (' + f3(normal([...refl].reverse())) + '): facing out')`;

const WELD = `${HALF}
console.log('the cage:              ' + counts(cage))
// Predict first: with no sharing on the plane, how many open edges does the mirrored mesh have?
console.log('mirrored, no sharing:  ' + counts(mirror(cage, -1)))
console.log('mirrored, shared:      ' + counts(mirror(cage)))
// A plane vertex nudged 0.01 off the plane is not within 0.001, so it is copied, not shared.
const nudged = { verts: cage.verts.map((v, i) => i === 7 ? [0.01, 1, 1] : v), faces: cage.faces }
console.log('one vertex 0.01 off:   ' + counts(mirror(nudged)))`;

const STACK = `${HALF}
// A modifier stack is a list of operations, evaluated from the cage every time the mesh is drawn.
const stack = [(m) => mirror(m)]
const evaluate = (cage) => stack.reduce((m, mod) => mod(m), cage)
const find = (m, p) => m.verts.findIndex((v) => v.every((x, k) => Math.abs(x - p[k]) < 1e-9))
// Move a corner of the cage. The drawn mesh is recomputed, so its mirror image moves with it.
cage.verts[6] = [1.3, 1, 1]
let shown = evaluate(cage)
console.log('cage corner moved to (1.3, 1, 1); drawn mesh has (-1.3, 1, 1): ' + (find(shown, [-1.3, 1, 1]) >= 0))
// Apply: the evaluated mesh becomes the cage, and the stack is emptied. Now the halves are independent.
const applied = evaluate(cage); stack.length = 0
applied.verts[6] = [1.6, 1, 1]
shown = evaluate(applied)
console.log('after apply, moving (1.3, 1, 1) to (1.6, 1, 1): the other side is still at (-1.3, 1, 1): ' + (find(shown, [-1.3, 1, 1]) >= 0) + '; ' + counts(shown))`;

const PICTURE = withPicture(`${HALF}
// Left: mirrored with each mirrored face reversed. Right: mirrored without reversing. Faces whose normal points
// away from the middle are blue; faces pointing inward are red.
const good = mirror(cage), bad = mirror(cage, 0.001, false)
const verts = [], faces = []
for (const [m, dx] of [[good, -1.6], [bad, 1.6]]) {
  const base = verts.length
  m.verts.forEach(([x, y, z]) => verts.push([x + dx, y, z]))
  m.faces.forEach((f) => faces.push(f.map((v) => v + base)))
}
console.log('left: ' + good.faces.length + ' faces, all facing out; right: the 5 mirrored faces face in')
show({ verts, faces, zoom: 1.3 })`);

const CHALLENGE = `// Half a character's cage has 40 vertices, 6 of them on the x = 0 plane, and 36 faces (none lying in the plane).
// A mirror modifier (merge 0.001) is added. How many vertices and faces does the drawn, mirrored mesh have?
const answer = { verts: 0, faces: 0 }
console.log(answer)`;

const SOLVED = CHALLENGE.replace('const answer = { verts: 0, faces: 0 }', 'const answer = { verts: 74, faces: 72 }');

/** The challenge's check: 40 + (40 − 6) = 74 vertices, 36 × 2 = 72 faces. */
export function checkMirrorCounts(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+answer\s*=\s*\{([^}]*)\}/);
  if (!m) return no('Keep the line const answer = { verts: …, faces: … }.');
  const get = (k) => { const g = m[1].match(new RegExp(k + '\\s*:\\s*(-?\\d+(?:\\.\\d+)?)')); return g ? Number(g[1]) : NaN; };
  const verts = get('verts'), faces = get('faces');
  if ([verts, faces].some(Number.isNaN)) return no('Give both as numbers: verts and faces.');
  if (verts === 80) return no('80 copies every vertex. The 6 on the plane are shared by both halves, not copied: that is what joins them.');
  if (verts === 68) return no('68 leaves out the 6 shared vertices altogether. They stay, once: 40 cage vertices plus a copy of each of the other 34.');
  if (verts === 34) return no('34 is only the copies. The drawn mesh has the cage\'s 40 as well.');
  if (verts !== 74) return no(`${verts} is not 40 plus a copy of each vertex off the plane.`);
  if (faces === 36) return no('Every face of the cage gets a mirror image, so the faces double.');
  if (faces === 66 || faces === 70) return no('No face lies in the plane, so none mirrors onto itself: every one of the 36 is copied.');
  if (faces !== 72) return no(`${faces} is not 36 faces and their 36 mirror images.`);
  return { pass: true, message: '74 vertices and 72 faces. The 6 plane vertices are shared (40 + 34 = 74), which joins the halves with no seam; every face gets a reversed mirror image (36 × 2 = 72). A face lying in the plane would mirror onto itself and be skipped.' };
}

export default {
  id: 'modelling-geometry-5-007',
  slug: 'mirror-and-modifiers',
  chapter: 'modelling-geometry',
  order: 7,
  title: 'Mirror and modifiers',
  subtitle: 'Model half, reflect the rest: reflection matrices, shared plane vertices, reversed winding, and a stack evaluated from the cage.',
  tags: ['mirror', 'reflection', 'modifiers', 'non-destructive', 'determinant', 'modelling'],
  coreConcept: 'Reflection in the x = 0 plane negates x: the matrix diag(−1, 1, 1), with determinant −1. A reflection turns a counter-clockwise face clockwise, so each mirrored face has its corner order reversed to keep facing out. Vertices within the merge distance of the plane are shared by both halves rather than copied, so the result is one closed surface instead of two halves touching. A modifier is non-destructive: the mesh you edit (the cage) stays as it is, and the stack is evaluated from it every time it is drawn, so editing one side updates both; applying the stack bakes it into the cage. The order of the stack matters.',
  prerequisites: ['modelling-geometry-5-006', 'modelling-geometry-2-004'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-5-008',

  hook: {
    question: 'Faces, cars and chairs are symmetric, so modellers build half and let the computer make the other. How does a mirror keep the two halves joined, and why does every mirrored face need flipping?',
    realWorldContext: 'Almost every character and vehicle is modelled with a mirror modifier, often with subdivision after it. The same non-destructive idea runs through Blender\'s modifier stack, Houdini\'s node graphs and parametric CAD: keep the inputs editable and recompute the result.',
  },

  intuition: {
    prose: [
      'A **reflection** in the plane $x = 0$ sends $(x, y, z)$ to $(-x, y, z)$. As a matrix it is the identity with $-1$ in the $x$ place. Before running cell 1, predict its determinant: $-1$. Lesson 2.4 said what that means: it turns space inside out, so orientation flips.',
      'That is why the mirror must **reverse each mirrored face**. A face wound counter-clockwise seen from outside becomes clockwise after reflecting, so its normal points in. Writing its corners in reverse order puts the normal back outside (cell 2). Skip that step and the mirrored half is drawn inside out.',
      '**Sharing the plane.** Vertices on the mirror plane would land on themselves. The mirror does not copy them; both halves use the same vertex, so the edges along the plane have a face on each side and the surface is closed. Before running cell 3, predict: copy every vertex instead, and how many open edges are there? Eight: the four edges where each half met the plane, twice.',
      'The **merge distance** (0.001 by default) decides which vertices count as on the plane. A vertex $0.01$ off it is copied, and a slit opens next to it. Mirror **clipping** prevents that: vertices that start on the plane stay on it while you move them, and extrude builds no wall on the plane (it would sit inside the mirrored solid).',
      'A **modifier** is not applied to the mesh you edit. The mesh you edit is the **cage**; what is drawn is the stack of modifiers evaluated from the cage, top to bottom, every time anything changes. Move a cage vertex and its mirror image moves with it (cell 4). **Apply** replaces the cage by the evaluated mesh and empties the stack: the halves become separate geometry.',
      'Because each modifier works on the output of the one above it, **order matters**. Mirror then subdivide smooths across the plane as one surface. Subdivide then mirror smooths each half alone, treating the plane edge as a border, and joins two creased halves: on a lopsided half box, the top of the seam lands at $1.089$ one way and $0.938$ the other. Mirror goes first.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: The mirror modifier (plane x = 0)',
        body: 'Step 1. For each cage vertex: if |x| ≤ merge, it is shared (maps to itself); otherwise add a copy (−x, y, z).\nStep 2. Keep every cage face.\nStep 3. For each cage face, add its image, the corners mapped by Step 1, in reverse order. Skip it if it is the same face (one lying in the plane).\nStep 4. With clipping on, keep plane vertices on the plane while editing, and skip extrude walls on the plane.',
      },
      {
        type: 'procedure',
        title: 'Procedure: A modifier stack',
        body: 'Step 1. Keep the cage unchanged.\nStep 2. To draw: m = cage; for each enabled modifier, top to bottom, m = modifier(m).\nStep 3. Edit the cage, never the result; redraw re-evaluates.\nStep 4. Apply: cage = the evaluated mesh, stack emptied.',
      },
      {
        type: 'warning',
        title: 'Mirror before subdivision',
        body: 'Subdividing each half before mirroring treats the mirror plane as an open border: the smoothing stops there and the halves meet in a crease. Put the mirror above subdivision in the stack.',
      },
      {
        type: 'warning',
        title: 'Vertices off the plane open a slit',
        body: 'A vertex meant to be on the plane but a little off it (0.01, say) is copied instead of shared, and a slit opens along the seam. Keep clipping on, or snap stray vertices back to x = 0 before applying.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: the cage versus the evaluated mesh',
        body: 'In edit mode MeshLab draws the cage as a black wireframe over the evaluated surface: what you click and move is the cage; what is shaded is the stack\'s result. Only the evaluated mesh reaches the GPU as triangles; the cage is an overlay.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "a mirror only copies positions". Both meshes have the right shape. On the left every face is blue (facing out). On the right, the mirrored faces were not reversed: their normals point in, and they show red.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'In cell 1, R and Rn are reflection matrices and det() checks −1. In mirror(), map is Step 1 and the reversed images Step 3; evaluate() in cell 4 is the stack\'s Step 2.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'The GPU culls or shades by winding: a mirrored face left unreversed is back-facing from outside, so with back-face culling it vanishes, and without it it is lit from the wrong side.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'Add a mirror in the Inspector\'s Modifiers section (axis, merge distance, clipping); switch it off and on, or Object › Apply modifiers. Object › Trace the mirror modifier traces the reflection, the shared vertices and the reversed winding, and asks you to predict a reflected vertex. Scripts call obj.modifiers.add(\'mirror\', { axis: \'x\' }) and obj.traceMirror().' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: a mirror modifier',
        caption: 'Reflection matrices, why winding is reversed, sharing the plane, the stack, and a mirrored half with and without the reversal.',
        props: {
          lesson: {
            title: 'Mirror and modifiers',
            subtitle: 'Model half; compute the rest.',
            cells: [
              { type: 'js', instruction: '### 1. Reflection matrices\nPredict first: the determinant of a reflection.', startCode: REFLECT },
              { type: 'js', instruction: '### 2. Why mirrored faces are reversed\nA triangle reflected, with and without reversing its corners.', startCode: WINDING },
              { type: 'js', instruction: '### 3. Sharing the plane\nPredict first: how many open edges with no sharing?', startCode: WELD },
              { type: 'js', instruction: '### 4. The stack and the cage\nEdit the cage; then apply.', startCode: STACK },
              { type: 'js', instruction: '### 5. See it\nLeft: mirrored faces reversed. Right: not reversed. Blue faces out, red faces in. Drag to turn.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 360 },
              { type: 'challenge', instruction: '### 6. Challenge: count a mirrored character\nVertices and faces drawn. The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkMirrorCounts },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Mirror and modifiers" in MeshLab](#/lab/mesh-lab?project=mirror). Half a box with a mirror modifier and a clipped extrusion; the mirror is traced: press Play and predict where a vertex reflects to. Then switch the modifier off and on, and apply it.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Inspector › Modifiers:** add a Mirror (axis, merge distance, clipping) and a Subdivision; the order is top to bottom.\n- **Object › Apply modifiers** bakes the stack into the mesh.\n- **Object › Trace the mirror modifier** traces it on the cage.\n- In a script: `obj.modifiers.add(\'mirror\', { axis: \'x\' })`, `obj.modifiers.apply()`, `obj.traceMirror()`.\n- [Open "Box-modelled character" in MeshLab](#/lab/mesh-lab?project=character-model): half a body, mirrored, then subdivided.\n- **In Blender:** the Mirror modifier (Clipping, Merge), above Subdivision Surface in the stack; Ctrl+A › Apply.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Reflection matrices.** The reflection in the plane through the origin with unit normal $n$ is $R = I - 2nn^{\\mathrm{T}}$: it subtracts twice the component of a point along $n$. It is symmetric, $R^2 = I$ (reflecting twice changes nothing), and $\\det R = -1$, since $n$ is an eigenvector with eigenvalue $-1$ and the plane\'s two directions have eigenvalue $1$. For $n = (1, 0, 0)$ it is $\\operatorname{diag}(-1, 1, 1)$.',
      '**Winding.** A face\'s normal is $(b - a) \\times (c - a)$. Under a linear map $M$, $(Mu) \\times (Mv) = \\det(M)\\, M^{-\\mathrm{T}}(u \\times v)$. With $\\det R = -1$ the reflected corners give the mirror image of the normal, negated: pointing in. Reversing the corner order negates the cross product again.',
      '**Closing the seam.** In the cage, an edge on the plane has one face (the cage is open there). Sharing its two vertices makes the mirrored copy of that face use the same edge, walked the opposite way: two faces, consistently oriented. With $V_p$ shared vertices and $E_p$ edges on the plane, the mirrored mesh has $V = 2V_c - V_p$, $E = 2E_c - E_p$ and $F = 2F_c$, so $V - E + F = 2(V_c - E_c + F_c) - (V_p - E_p)$. For the half box: $2 \\times 1 - 0 = 2$, a closed sphere-like surface.',
      '**Non-destructive.** The drawn mesh is a function of the cage: $M = m_k(\\cdots m_2(m_1(\\text{cage})))$. Composition does not commute in general, so changing the order changes $M$: mirror then subdivide is $S(\\text{Mir}(c))$, subdivide then mirror $\\text{Mir}(S(c))$, and they agree only when $S$ treats the plane the same way in both, which a boundary rule does not.',
    ],
    equations: [
      { label: 'Reflection in x = 0', latex: 'R_x = \\begin{pmatrix} -1 & 0 & 0 \\\\ 0 & 1 & 0 \\\\ 0 & 0 & 1 \\end{pmatrix}, \\quad \\det R_x = -1' },
      { label: 'Any plane', latex: 'R = I - 2\\,n\\,n^{\\mathrm{T}}, \\quad R^2 = I' },
      { label: 'Counts', latex: 'V = 2V_c - V_p, \\quad E = 2E_c - E_p, \\quad F = 2F_c' },
      { label: 'The stack', latex: 'M = m_k \\circ \\cdots \\circ m_1(\\text{cage})' },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** Given a consistently oriented cage whose boundary lies in the mirror plane (within the merge distance) and with no face in the plane, the mirror modifier produces a consistently oriented mesh, symmetric under $R$, with the cage\'s boundary edges on the plane each shared by two faces; if the cage was a disc-like half of a closed surface, the result is closed.',
      '**Invariant viewpoint.** The result is symmetric by construction: $R$ maps it onto itself, sending each cage face to its mirror image. Editing the cage and re-evaluating preserves the symmetry exactly, which applying and then editing does not.',
      '**Geometric picture.** The mirror plane is a two-way glass: everything on one side is seen again on the other, and things touching the glass are seen once. The stack is a recipe: change an ingredient and the dish is remade.',
      '**Where this goes.** Lesson 5.8 box-models a character with this stack; chapter 6 is the subdivision modifier itself.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-5-007-ex1',
      title: 'A reflected point',
      problem: 'Reflect $(2, -1, 3)$ in the plane $z = 0$.',
      steps: [
        { expression: 'R_z = \\operatorname{diag}(1, 1, -1)', annotation: 'Negate z.' },
        { expression: '(2, -1, -3)', annotation: 'The image.' },
      ],
      conclusion: '(2, −1, −3).',
    },
    {
      id: 'modelling-geometry-5-007-ex2',
      title: 'A mirrored face',
      problem: 'A cage face is $[3, 7, 8, 4]$. Vertices $3$ and $4$ are on the plane; $7$ and $8$ are copied to $17$ and $18$. What is its mirror image?',
      steps: [
        { expression: '[3, 7, 8, 4] \\mapsto [3, 17, 18, 4]', annotation: 'Step 1: map each corner.' },
        { expression: '\\text{reverse: } [4, 18, 17, 3]', annotation: 'Step 3: reverse the order.' },
      ],
      conclusion: '[4, 18, 17, 3]. It shares the edge 3–4 with the cage face, walked the other way.',
    },
    {
      id: 'modelling-geometry-5-007-ex3',
      title: 'Counting a mirrored box',
      problem: 'The half box of cell 3 has $V_c = 8$, $E_c = 12$, $F_c = 5$, with $V_p = 4$ vertices and $E_p = 4$ edges on the plane. Count the mirrored mesh.',
      steps: [
        { expression: 'V = 16 - 4 = 12', annotation: 'Shared vertices counted once.' },
        { expression: 'E = 24 - 4 = 20', annotation: 'Shared edges counted once.' },
        { expression: 'F = 10, \\quad V - E + F = 2', annotation: 'Closed.' },
      ],
      conclusion: 'V 12, E 20, F 10: a closed box (lesson 1.5).',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-5-007-ch1',
      difficulty: 'easy',
      problem: 'Why does the mirror reverse each mirrored face\'s corners?',
      walkthrough: [{ expression: '\\det R = -1', annotation: 'Reflection flips orientation.' }],
      answer: 'A reflection has determinant −1, so it turns counter-clockwise rings clockwise and the normals would point in; reversing the corner order turns them back out.',
    },
    {
      id: 'modelling-geometry-5-007-ch2',
      difficulty: 'medium',
      problem: 'Your mirrored character has a thin slit down the middle of its chin. What happened, and how do you fix it?',
      walkthrough: [
        { expression: '\\text{a chin vertex is a little off } x = 0', annotation: 'Beyond the merge distance.' },
        { expression: '\\text{it was copied, not shared}', annotation: 'So the seam is open there.' },
      ],
      answer: 'One or more vertices on the seam drifted off the plane by more than the merge distance, so they were copied instead of shared and the seam opened. Snap them back to x = 0 (and turn clipping on so they stay), or raise the merge distance slightly.',
    },
    {
      id: 'modelling-geometry-5-007-ch3',
      difficulty: 'hard',
      problem: 'Show that $R = I - 2nn^{\\mathrm{T}}$ has determinant $-1$ for any unit $n$, and say what it does to a face\'s normal.',
      walkthrough: [
        { expression: 'Rn = n - 2n(n^{\\mathrm{T}}n) = -n', annotation: 'Eigenvalue −1 along n.' },
        { expression: 'Ru = u \\text{ for } u \\perp n', annotation: 'Eigenvalue 1, twice.' },
        { expression: '\\det R = (-1)(1)(1) = -1', annotation: 'The product of the eigenvalues.' },
      ],
      answer: 'R sends n to −n and fixes the plane perpendicular to n, so its eigenvalues are −1, 1, 1 and det R = −1. A reflected face\'s cross-product normal is the mirror image of the old normal, negated, so it points in until the corners are reversed.',
    },
  ],

  semantics: {
    core: [
      { symbol: 'R', meaning: 'A reflection matrix: I − 2nnᵀ, determinant −1.' },
      { symbol: '\\text{cage}', meaning: 'The mesh you edit; the modifier stack is evaluated from it.' },
      { symbol: '\\text{merge}', meaning: 'Vertices within this distance of the plane are shared by both halves.' },
      { symbol: '\\text{clipping}', meaning: 'Keeps plane vertices on the plane while editing; no extrude walls on the plane.' },
      { symbol: 'm_k \\circ \\cdots \\circ m_1', meaning: 'The modifier stack, applied top to bottom.' },
      { symbol: '\\text{apply}', meaning: 'Bake the evaluated mesh into the cage and empty the stack.' },
    ],
    rulesOfThumb: [
      'Reflections flip winding: reverse the mirrored faces.',
      'Keep seam vertices exactly on the plane; turn clipping on.',
      'Edit the cage, not the result.',
      'Mirror above subdivision.',
      'Apply only when you need the halves to differ.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-2-004', label: 'The determinant', note: 'A negative determinant flips orientation.' },
      { lessonId: 'modelling-geometry-5-006', label: 'Merge and smooth vertices', note: 'Sharing plane vertices is merging them before they are ever copied.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-5-008', label: 'Box modelling a character', note: 'Half a body, mirrored and subdivided.' },
      { lessonId: 'modelling-geometry-6-002', label: 'Catmull–Clark', note: 'The subdivision modifier below the mirror.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-5-007-1', label: 'Read why reflection flips winding', type: 'read' },
    { id: 'cp-modelling-geometry-5-007-2', label: 'Read how sharing the plane closes the seam', type: 'read' },
    { id: 'cp-modelling-geometry-5-007-3', label: 'Read what the cage and the stack are, and why order matters', type: 'read' },
    { id: 'cp-modelling-geometry-5-007-4', label: 'Run cells 1 to 4: reflection, winding, sharing, the stack', type: 'lab' },
    { id: 'cp-modelling-geometry-5-007-5', label: 'Trace the mirror modifier in MeshLab and apply it', type: 'lab' },
    { id: 'cp-modelling-geometry-5-007-6', label: 'Work through example 2, a mirrored face', type: 'example' },
    { id: 'cp-modelling-geometry-5-007-7', label: 'Work through example 3, counting a mirrored box', type: 'example' },
    { id: 'cp-modelling-geometry-5-007-8', label: 'Complete the challenge: count a mirrored character', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-5-007-assess-1',
        type: 'choice',
        text: 'A cage has 20 vertices, 4 on the mirror plane. How many vertices does the mirrored mesh have?',
        options: ['36', '40', '24', '32'],
        answer: '36',
        hint: '20 + (20 − 4).',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-5-007-quiz-1',
      type: 'choice',
      text: 'What is the determinant of a reflection?',
      options: ['−1', '1', '0', '2'],
      answer: '−1',
      hints: ['Cell 1.', 'It flips orientation.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-5-007-quiz-2',
      type: 'choice',
      text: 'A half box is mirrored with no sharing on the plane. How many open edges?',
      options: ['8', '0', '4', '16'],
      answer: '8',
      hints: ['Cell 3.', 'Each half keeps its 4 plane edges open.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-5-007-quiz-3',
      type: 'choice',
      text: 'You move a cage vertex with a mirror modifier on. What happens to its mirror image?',
      options: ['It moves too: the stack is re-evaluated from the cage', 'Nothing until you apply', 'It is deleted', 'It moves the same way, not mirrored'],
      answer: 'It moves too: the stack is re-evaluated from the cage',
      hints: ['Cell 4.', 'Non-destructive.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-5-007-quiz-4',
      type: 'choice',
      text: 'Which order of modifiers gives a smooth seam?',
      options: ['Mirror, then subdivision', 'Subdivision, then mirror', 'Either', 'Neither'],
      answer: 'Mirror, then subdivision',
      hints: ['Subdividing a half treats the plane as a border.', 'Warning "Mirror before subdivision".'],
      reviewSection: 'Warning "Mirror before subdivision"',
    },
    {
      id: 'modelling-geometry-5-007-quiz-5',
      type: 'choice',
      text: 'What does mirror clipping do?',
      options: ['Keeps plane vertices on the plane, and skips extrude walls there', 'Cuts the mesh in half', 'Hides the mirrored half', 'Merges every vertex'],
      answer: 'Keeps plane vertices on the plane, and skips extrude walls there',
      hints: ['Procedure, Step 4.', 'The project\'s extrusion.'],
      reviewSection: 'Procedure: The mirror modifier',
    },
    {
      id: 'modelling-geometry-5-007-quiz-6',
      type: 'choice',
      text: 'After Apply modifiers, what is true?',
      options: ['The mirrored half is real geometry; editing one side no longer changes the other', 'The mirror is still live', 'The cage is unchanged', 'The mesh is subdivided'],
      answer: 'The mirrored half is real geometry; editing one side no longer changes the other',
      hints: ['Cell 4, after apply.', 'The stack is emptied.'],
      reviewSection: 'Cell 4',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'A mirror just copies the vertices to the other side.',
      whyStudentsThinkIt: 'The positions are simply reflected.',
      correctionExample: 'Cell 5: without reversing the corners, the mirrored faces face inward.',
      contrastCase: 'A rotation by 180° about the y axis would move the half to the other side without flipping winding, but it would not be a mirror image.',
    },
    {
      falseBelief: 'The two halves are joined by merging them afterwards.',
      whyStudentsThinkIt: 'Merge by distance joins things.',
      correctionExample: 'Cell 3: the plane vertices are never copied; both halves use the same ones.',
      contrastCase: 'Without the merge distance (no sharing), cell 3 shows 8 open edges along the seam.',
    },
    {
      falseBelief: 'Modifiers change the mesh you edit.',
      whyStudentsThinkIt: 'You see the mirrored result while editing.',
      correctionExample: 'Cell 4 and the project: the cage keeps 12 vertices while 18 are drawn; switching the modifier off shows the cage alone.',
      contrastCase: 'Apply does change it: the evaluated mesh replaces the cage.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A car body is symmetric, but its steering wheel is on one side.',
      competingTechniques: ['Model the whole body by hand', 'Mirror the body; model the steering wheel as a separate object, or apply the mirror late'],
      whyThisTechniqueWins: 'The mirror halves the modelling work and keeps the body exactly symmetric; the asymmetric part lives outside it, or the mirror is applied only once the symmetric work is done.',
    },
    {
      situation: 'A smoothed character shows a faint crease down its middle.',
      competingTechniques: ['Smooth the crease by hand', 'Move the mirror above the subdivision in the stack'],
      whyThisTechniqueWins: 'The crease comes from subdividing each half on its own; in the right order the subdivision sees one surface.',
    },
  ],

  debugging: [
    {
      commonError: 'Not reversing mirrored faces.',
      symptom: 'The mirrored half looks dark or vanishes (back-face culling); normals show red.',
      whyItHappened: 'The reflection flipped the winding.',
      repairStrategy: 'Reverse each mirrored face\'s corner order (Step 3).',
    },
    {
      commonError: 'Seam vertices off the plane.',
      symptom: 'A slit or a doubled edge along the middle.',
      whyItHappened: 'They were copied instead of shared.',
      repairStrategy: 'Snap them to the plane; keep clipping on.',
    },
    {
      commonError: 'Subdivision above the mirror.',
      symptom: 'A crease down the middle of a smooth model.',
      whyItHappened: 'Each half was smoothed with the plane as a border.',
      repairStrategy: 'Move the mirror above subdivision.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Mirror a cage by hand: shared vertices, copies, reversed faces, and the counts.',
    explainVerbally: 'Explain why reflections flip winding, how sharing closes the seam, and why stacks are non-destructive and ordered.',
    detectIncorrectApplication: 'Recognise inverted halves, slits on the seam and creases from the wrong order.',
    transferToUnfamiliar: 'Plan a symmetric model with a stack, and decide when to apply it.',
  },
};
