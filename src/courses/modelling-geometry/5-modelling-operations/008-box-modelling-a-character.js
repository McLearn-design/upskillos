// Lesson 5.8: box modelling a character. A whole model as a short program of the chapter's operations on a small
// cage: plan the topology (count what each step adds), let the mirror and subdivision make the body, and judge the
// shape by its silhouette, the edges where front-facing and back-facing faces meet.
import { withPicture } from '../notebookScene.js';

const PLAN = `// The character in MeshLab's "Box modelling a character" project, step by step. Predict each step's counts
// from the chapter's rules before reading MeshLab's numbers below.
let V = 8, F = 5
const step = (name, dv, df, meshlab) => { V += dv; F += df; console.log(name + ': +' + dv + ' vertices, +' + df + ' faces → ' + V + ', ' + F + (V === meshlab[0] && F === meshlab[1] ? '  (MeshLab: the same)' : '  (MeshLab: ' + meshlab + ')')) }
console.log('1. half a torso, open on the mirror plane: ' + V + ' vertices, ' + F + ' faces')
// A closed ring of k quads: k new vertices, k more faces (lesson 5.3). Round the torso: 4 quads.
step('2a. loop cut round the torso (closed, 4 quads)', 4, 4, [12, 9])
// An open ring of k quads has k + 1 ring edges: k + 1 vertices, k faces. Across the front, side and back: 5 quads.
step('2b. loop cut across the chest (open, 5 quads)', 6, 5, [18, 14])
// Extruding one quad: 4 copies, 4 walls (lesson 5.1). Twice for the arm.
step('3. arm: one quad extruded twice', 8, 8, [26, 22])
step('4. leg: one quad extruded once', 4, 4, [30, 26])
// The top's inner half touches the mirror plane: with clipping, no wall there, so 3 walls a time (lesson 5.7).
step('5. neck and head: one quad on the plane, twice', 8, 6, [38, 32])`;

const DRAWN = `// What is drawn: the cage mirrored, then subdivided twice (Catmull–Clark, chapter 6).
const Vc = 38, Fc = 32
// Vertices on the plane: 4 from the box, 2 from the chest's loop cut, 2 from each neck/head extrude.
const Vp = 4 + 2 + 2 * 2
let V = 2 * Vc - Vp, F = 2 * Fc
let E = V + F - 2             // closed and in one piece: V − E + F = 2 (lesson 1.5)
console.log('mirrored: ' + V + ' vertices, ' + E + ' edges, ' + F + ' faces')
// One Catmull–Clark level adds a point per edge and per face, and splits each quad into 4.
for (let level = 1; level <= 2; level++) {
  ;[V, E, F] = [V + E + F, 2 * E + 4 * F, 4 * F]
  console.log('subdivided ×' + level + ': ' + V + ' vertices, ' + E + ' edges, ' + F + ' faces, V − E + F = ' + (V - E + F))
}
console.log('MeshLab draws 1026 vertices and 1024 faces: the same, from a 32-face cage')`;

const HELPERS = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const sub = (a, b) => a.map((x, i) => x - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
// Front-facing faces, and silhouette edges: a front face on one side, a back face (or nothing) on the other.
function silhouette(verts, faces, eye) {
  const centre = (f) => [0, 1, 2].map((k) => f.reduce((s, v) => s + verts[v][k], 0) / f.length)
  const normal = (f) => cross(sub(verts[f[1]], verts[f[0]]), sub(verts[f[2]], verts[f[0]]))
  const front = faces.map((f) => dot(sub(eye, centre(f)), normal(f)) > 1e-9)
  const edges = new Map()
  faces.forEach((f, fi) => f.forEach((a, i) => { const b = f[(i + 1) % f.length], k = Math.min(a, b) + '-' + Math.max(a, b); if (!edges.has(k)) edges.set(k, []); edges.get(k).push(fi) }))
  const sil = [...edges].filter(([, fs]) => (fs.length === 2 && front[fs[0]] !== front[fs[1]]) || (fs.length === 1 && front[fs[0]])).map(([k]) => k)
  return { front, sil }
}
`;

const CUBE = `const cube = { verts: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
  faces: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [0, 4, 7, 3], [1, 2, 6, 5]] }
`;

const BOX = `${HELPERS}${CUBE}
// Predict first: from straight in front, and from a corner, how many faces face the eye, and how many edges
// make the outline?
for (const [name, eye] of [['in front, (0, 0, 5)', [0, 0, 5]], ['a corner, (5, 4, 3)', [5, 4, 3]]]) {
  const { front, sil } = silhouette(cube.verts, cube.faces, eye)
  console.log(name + ': ' + front.filter(Boolean).length + ' front faces, ' + sil.length + ' silhouette edges: ' + sil.join(', '))
}`;

// A UV sphere: 16 around, 8 rings, quads between rings and triangles at the poles, all facing out.
const SPHERE = `const S = 16, R = 8, sverts = [[0, 1, 0]], sfaces = []
for (let i = 1; i < R; i++) for (let j = 0; j < S; j++) { const t = Math.PI * i / R, p = 2 * Math.PI * j / S; sverts.push([Math.sin(t) * Math.cos(p), Math.cos(t), Math.sin(t) * Math.sin(p)]) }
sverts.push([0, -1, 0])
const at = (i, j) => 1 + (i - 1) * S + (j % S), south = sverts.length - 1
for (let j = 0; j < S; j++) sfaces.push([0, at(1, j + 1), at(1, j)])
for (let i = 1; i < R - 1; i++) for (let j = 0; j < S; j++) sfaces.push([at(i, j), at(i, j + 1), at(i + 1, j + 1), at(i + 1, j)])
for (let j = 0; j < S; j++) sfaces.push([at(R - 1, j), at(R - 1, j + 1), south])
`;

const ROUND = `${HELPERS}${SPHERE}
// A round shape: the silhouette is a ring of edges round the middle, and it moves when the eye moves.
for (const eye of [[0, 0, 5], [0, 5, 0], [3, 3, 3]]) {
  const { front, sil } = silhouette(sverts, sfaces, eye)
  console.log('eye (' + eye + '): ' + front.filter(Boolean).length + ' of ' + sfaces.length + ' faces face it, ' + sil.length + ' silhouette edges')
}`;

const PICTURE = withPicture(`${HELPERS}${SPHERE}
// Faces that face an eye straight in front, at (0, 0, 5), amber; the rest blue. You look from the side, so the
// border between the colours is the outline the front eye would see.
const { front, sil } = silhouette(sverts, sfaces, [0, 0, 5])
console.log(front.filter(Boolean).length + ' amber faces; the ' + sil.length + ' edges between amber and blue are the front view\\'s silhouette')
show({ verts: sverts, faces: sfaces, groups: front.map((f) => f ? 1 : 0), normals: false })`);

const CHALLENGE = `// The same character, but the arm is extruded three times instead of twice, and the leg twice instead of once.
// Everything else is the same (the two loop cuts, the neck and head extruded twice).
// How many vertices and faces does the cage have at the end?
const answer = { verts: 0, faces: 0 }
console.log(answer)`;

const SOLVED = CHALLENGE.replace('const answer = { verts: 0, faces: 0 }', 'const answer = { verts: 46, faces: 40 }');

/** The challenge's check: 18 + 12 + 8 + 8 = 46 vertices; 14 + 12 + 8 + 6 = 40 faces. */
export function checkCage(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+answer\s*=\s*\{([^}]*)\}/);
  if (!m) return no('Keep the line const answer = { verts: …, faces: … }.');
  const get = (k) => { const g = m[1].match(new RegExp(k + '\\s*:\\s*(-?\\d+(?:\\.\\d+)?)')); return g ? Number(g[1]) : NaN; };
  const verts = get('verts'), faces = get('faces');
  if ([verts, faces].some(Number.isNaN)) return no('Give both as numbers: verts and faces.');
  if (verts === 38 && faces === 32) return no('Those are the original counts. The arm gets one more extrude and the leg one more: each adds 4 vertices and 4 walls.');
  if (verts !== 46) return no(`After the loop cuts the cage has 18 vertices; each of the 3 + 2 + 2 extrudes adds 4. ${verts} is not that.`);
  if (faces === 42) return no('The neck and head extrudes touch the mirror plane: with clipping, no wall is built there, so they add 3 faces each, not 4.');
  if (faces === 44) return no('Each extrude of one quad adds its walls only; the extruded face moves, it is not added again.');
  if (faces !== 40) return no(`After the loop cuts the cage has 14 faces; the arm and leg extrudes add 4 each, the neck and head 3 each. ${faces} is not that.`);
  return { pass: true, message: '46 vertices and 40 faces: 18 and 14 after the loop cuts; 3 arm and 2 leg extrudes add 4 and 4 each (+20, +20); the 2 neck and head extrudes add 4 vertices and 3 walls each, the fourth wall skipped on the mirror plane (+8, +6).' };
}

export default {
  id: 'modelling-geometry-5-008',
  slug: 'box-modelling-a-character',
  chapter: 'modelling-geometry',
  order: 8,
  title: 'Box modelling a character',
  subtitle: 'A whole model as a short sequence of operations on a small cage, planned by counting and judged by its silhouette.',
  tags: ['box modelling', 'topology', 'planning', 'silhouette', 'character', 'modelling'],
  coreConcept: 'Box modelling builds a model as a short program of the chapter\'s operations on a small cage: start from half a box, loop cut where limbs will branch, extrude limbs and head, and let a mirror and subdivision make the full, smooth body. Each operation adds a predictable number of vertices and faces, so the cage can be planned by counting before it is built, and the drawn mesh follows from the cage (mirror, then four faces per face per subdivision level). The shape is judged by its silhouette: the edges where faces facing the eye meet faces facing away.',
  prerequisites: ['modelling-geometry-5-007', 'modelling-geometry-5-003'],
  timeToComplete: 45,
  nextLesson: 'modelling-geometry-5-009',

  hook: {
    question: 'A whole figure from one box, in five operations and 32 faces you ever touch. How do you plan where to cut and what to extrude, and how do you know the shape is right?',
    realWorldContext: 'Box modelling is how characters, creatures and props have been blocked out in games and film for decades: a low cage that is quick to change, smoothed by subdivision. Artists judge the blockout by its silhouette first, because that is what reads from a distance and in motion.',
  },

  intuition: {
    prose: [
      'The character in MeshLab\'s project is five operations on half a box. Each is one of this chapter\'s lessons: a loop cut (5.3) wherever a limb will branch, extrudes (5.1) for the arm, leg, neck and head, a mirror (5.7) for the other half, and subdivision (chapter 6) for the smooth body.',
      '**Topology planning** is knowing what each step adds before you do it. A closed loop cut of $k$ quads adds $k$ vertices and $k$ faces; an open one adds $k + 1$ vertices and $k$ faces. Extruding one quad adds $4$ vertices and $4$ walls, or $3$ walls if one of its edges lies on a clipped mirror plane. Before running cell 1, predict the cage after all five steps: $38$ vertices, $32$ faces.',
      'The cage is all you ever edit. The drawn mesh follows from it (cell 2): the mirror shares the $10$ vertices on the plane, giving $66$ vertices and $64$ faces; each subdivision level makes $4$ faces of each, so two levels give $1024$. Thirty-two faces control a thousand.',
      'Plan the cuts by where things branch. The arm comes out of the side, so the side must have a face just where the shoulder is: that is what the chest loop cut is for. The leg comes out of the bottom\'s outer half: the first loop cut splits the bottom in two. Cut first, then extrude: an extrude can only start from faces that exist.',
      'How do you judge the result? By its **silhouette**: the outline seen from a viewpoint. A face is **front-facing** if its normal points towards the eye, $(\\text{eye} - \\text{centre}) \\cdot n > 0$ (lesson 2.1). A silhouette edge has a front-facing face on one side and a back-facing one on the other (or none, on an open edge). Before running cell 3, predict: a cube seen from a corner. How many silhouette edges? Six: three faces face you, and the outline is a hexagon.',
      'Silhouettes move with the eye (cell 4): on a round shape, a ring of edges round the middle from in front, a ring round the equator from above. Modellers check the front and side silhouettes first, because a shape that reads in silhouette reads everywhere.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Box model a character',
        body: 'Step 1. Half a box for the torso, its face on the mirror plane deleted; add a mirror modifier with clipping.\nStep 2. Loop cut where limbs branch: one down the half for the leg, one round the chest for the arm.\nStep 3. Extrude the limbs and the head from the faces the cuts made, a segment at a time.\nStep 4. Add subdivision below the mirror; adjust cage vertices while watching the smooth result.\nStep 5. Check the front and side silhouettes; fix the cage, not the result.',
      },
      {
        type: 'procedure',
        title: 'Procedure: Find the silhouette from an eye',
        body: 'Step 1. For each face, front-facing if (eye − centre) · n > 0.\nStep 2. For each edge with two faces: on the silhouette if one is front-facing and the other is not.\nStep 3. An edge with one face is on the silhouette if that face is front-facing.',
      },
      {
        type: 'warning',
        title: 'Plan cuts before extrudes',
        body: 'An extrude starts from existing faces. If the side of the torso is one big face, extruding it makes an arm as tall as the torso. Loop cut first so a shoulder-sized face exists, then extrude it.',
      },
      {
        type: 'warning',
        title: 'Keep the cage low',
        body: 'Every cage face becomes 4ⁿ faces after n subdivision levels. Adding detail to the cage early multiplies the work of every later change; block out the silhouette first, add loops only where the shape needs them.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: silhouette',
        body: 'The silhouette is where shading changes from lit to unlit on a smooth shape and where outlines are drawn (lesson 3.6): an outline renderer finds exactly these front/back edges. Shadows are cast by the silhouette as seen from the light. MeshLab\'s Object › Trace the silhouette (scene camera) finds them on the drawn mesh.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "the outline is a fixed set of edges on the model". Faces facing an eye in front are amber; seen from the side, the border between amber and blue is the front eye\'s outline: a ring round the sphere\'s middle. Move the eye and the ring moves.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'In cell 1, step() applies the counting rules of lessons 5.1, 5.3 and 5.7; cell 2 applies the mirror\'s and Catmull–Clark\'s counts; silhouette() in cells 3–5 is the silhouette procedure.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'The GPU only ever sees the drawn mesh: 1024 quads as 2048 triangles. Back-face culling drops the back-facing ones before shading; the silhouette is where culled and kept faces meet.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'The project logs the cage after each step and traces the silhouette from a front camera (predict whether a face faces it). Turn the subdivision modifier off to see the cage; extrude an arm further yourself. Object › Trace the silhouette (scene camera) works on any object; scripts call obj.traceSilhouette().' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: plan a cage and read its silhouette',
        caption: 'Counting the cage step by step, what is drawn from it, a cube\'s and a sphere\'s silhouettes, and the outline seen from the side.',
        props: {
          lesson: {
            title: 'Box modelling a character',
            subtitle: 'Plan by counting; judge by silhouette.',
            cells: [
              { type: 'js', instruction: '### 1. Plan the cage\nPredict first: the counts after each step. Then compare with MeshLab\'s.', startCode: PLAN },
              { type: 'js', instruction: '### 2. What is drawn\nThe mirror, then two levels of subdivision.', startCode: DRAWN },
              { type: 'js', instruction: '### 3. A cube\'s silhouette\nPredict first: seen from a corner, how many outline edges?', startCode: BOX },
              { type: 'js', instruction: '### 4. A round shape\nThe silhouette moves with the eye.', startCode: ROUND },
              { type: 'js', instruction: '### 5. See it\nFaces facing a front eye amber, the rest blue, seen from the side. Drag to turn.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 360 },
              { type: 'challenge', instruction: '### 6. Challenge: a longer arm and leg\nCount the cage. The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkCage },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Box modelling a character" in MeshLab](#/lab/mesh-lab?project=box-character). The log counts the cage after each step; the silhouette from the front camera is traced: press Play and predict whether the marked face faces the camera. Then turn subdivision off, and extrude an arm further.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Tab, then 3, then E:** extrude limbs from the faces a loop cut made; **Ctrl+R** for the cuts.\n- **Inspector › Modifiers:** mirror above subdivision; switch subdivision off to work on the cage.\n- **Object › Trace the silhouette (scene camera):** the outline from the active camera.\n- [Open "Box-modelled character" in MeshLab](#/lab/mesh-lab?project=character-model) for the finished figure, which later lessons rig and animate.\n- **In Blender:** the same workflow (Mirror and Subdivision Surface modifiers, Ctrl+R, E); Front (1) and Side (3) orthographic views to check silhouettes.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Counting is additive.** Every operation in the sequence changes $V$ and $F$ by an amount that depends only on the local topology it touches (lessons 5.1–5.7), so the cage after $n$ steps is the start plus the sum of the steps\' changes. That is why a cage can be planned on paper.',
      '**The Euler characteristic as a check.** The half cage is a disc (open on the plane): $V - E + F = 1$ throughout, since every operation keeps it. The mirrored cage is closed and in one piece: $V - E + F = 2$, which gives $E = V + F - 2$ without counting edges.',
      '**Catmull–Clark counts.** One level adds a vertex per face and per edge and splits each $k$-sided face into $k$ quads; for a quad mesh, $V\' = V + E + F$, $E\' = 2E + 4F$, $F\' = 4F$, and $V\' - E\' + F\' = V - E + F$: subdivision keeps the topology.',
      '**Silhouettes.** For a closed mesh and an eye outside it, the silhouette edges separate the front-facing faces from the back-facing ones, so they form closed loops. On a convex shape there is exactly one loop; on a figure with limbs there can be several, one round each part that overlaps another.',
    ],
    equations: [
      { label: 'Front-facing', latex: '(\\text{eye} - c_f) \\cdot n_f > 0' },
      { label: 'Mirrored, closed', latex: 'E = V + F - 2' },
      { label: 'One Catmull–Clark level (quads)', latex: "V' = V + E + F, \\quad E' = 2E + 4F, \\quad F' = 4F" },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** A box-modelling sequence is a composition of topology-preserving operations on a disc-like half cage; with a clipped mirror and subdivision, the drawn surface is closed, symmetric and of genus 0, its counts determined by the cage\'s counts, the number of plane vertices and the subdivision level.',
      '**Invariant viewpoint.** The plan (which faces are cut and extruded) is independent of the exact positions: the same program builds a short or a tall figure. The silhouette, by contrast, depends on positions and on the eye.',
      '**Geometric picture.** The cage is a puppet with few strings; the subdivided body is the cloth draped on it. You shape the cloth only by moving the strings, and you check it against the light.',
      '**Where this goes.** Lesson 5.9 measures whether this topology is clean (valence, poles, n-gons); chapter 6 subdivides it; chapter 9 rigs this same character.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-5-008-ex1',
      title: 'An open loop cut',
      problem: 'A loop cut crosses 5 quads and stops at the mirror plane at both ends. What does it add?',
      steps: [
        { expression: '\\text{open ring of } k = 5\\text{ quads: } 6\\text{ ring edges}', annotation: 'One more edge than quads.' },
        { expression: '+6\\text{ vertices}, \\; +5\\text{ faces}', annotation: 'Each quad becomes two.' },
      ],
      conclusion: '6 vertices and 5 faces.',
    },
    {
      id: 'modelling-geometry-5-008-ex2',
      title: 'A face on the mirror plane',
      problem: 'A quad with one edge on a clipped mirror plane is extruded. What does it add?',
      steps: [
        { expression: '+4\\text{ copies}', annotation: 'Every corner, including the two on the plane.' },
        { expression: '+3\\text{ walls}', annotation: 'No wall on the plane edge.' },
      ],
      conclusion: '4 vertices and 3 faces.',
    },
    {
      id: 'modelling-geometry-5-008-ex3',
      title: 'A cube from a corner',
      problem: 'How many silhouette edges does a cube have from the eye $(5, 4, 3)$?',
      steps: [
        { expression: '\\text{front faces: } x = 1, \\; y = 1, \\; z = 1', annotation: 'Their normals point towards the eye.' },
        { expression: '\\text{edges between one of these and a back face}', annotation: 'Two per front face, round the outside.' },
      ],
      conclusion: '6: the outline is a hexagon.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-5-008-ch1',
      difficulty: 'easy',
      problem: 'Why is the chest loop cut made before the arm is extruded?',
      walkthrough: [{ expression: '\\text{the arm needs a shoulder-sized face}', annotation: 'Extrude starts from existing faces.' }],
      answer: 'Without the cut, the side of the torso is one face as tall as the torso; extruding it would make an arm that tall. The cut makes a face the size of a shoulder to extrude.',
    },
    {
      id: 'modelling-geometry-5-008-ch2',
      difficulty: 'medium',
      problem: 'The cage has 32 faces. How many faces are drawn with the mirror and three subdivision levels?',
      walkthrough: [
        { expression: '64\\text{ mirrored}', annotation: 'No face lies in the plane.' },
        { expression: '64 \\times 4^3 = 4096', annotation: 'Each level multiplies by 4.' },
      ],
      answer: '4096 faces.',
    },
    {
      id: 'modelling-geometry-5-008-ch3',
      difficulty: 'hard',
      problem: 'Show that on a closed mesh seen from outside, every vertex touches an even number of silhouette edges.',
      walkthrough: [
        { expression: '\\text{go round the faces at a vertex}', annotation: 'They alternate front and back in runs.' },
        { expression: '\\text{each change of run crosses a silhouette edge}', annotation: 'Going round once, the changes come in pairs.' },
      ],
      answer: 'Walking once round the faces at a vertex, you cross from front-facing to back-facing and back again; each crossing is a silhouette edge at that vertex, and you must return to where you started, so the crossings are even. Hence silhouette edges form closed loops.',
    },
  ],

  semantics: {
    core: [
      { symbol: '\\text{cage}', meaning: 'The small mesh you edit; the modifiers make the drawn body from it.' },
      { symbol: '\\text{blockout}', meaning: 'The first, low version of a model: the silhouette before detail.' },
      { symbol: 'V_p', meaning: 'Vertices on the mirror plane, shared by both halves.' },
      { symbol: '4^n', meaning: 'Faces per cage quad after n subdivision levels.' },
      { symbol: '(\\text{eye} - c) \\cdot n > 0', meaning: 'The front-facing test.' },
      { symbol: '\\text{silhouette edge}', meaning: 'An edge between a front-facing and a back-facing face (or an open edge of a front-facing face).' },
    ],
    rulesOfThumb: [
      'Cut where things branch; extrude from what the cuts made.',
      'Count each step before doing it.',
      'Edit the cage; judge the result.',
      'Check the front and side silhouettes first.',
      'Add loops only where the shape needs them.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-5-007', label: 'Mirror and modifiers', note: 'The mirror and the stack the character is drawn through.' },
      { lessonId: 'modelling-geometry-5-003', label: 'Edge rings and loop cuts', note: 'Where the limbs branch from.' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-5-009', label: 'Clean topology', note: 'Measuring the cage\'s poles and valences.' },
      { lessonId: 'modelling-geometry-6-002', label: 'Catmull–Clark', note: 'The subdivision that smooths the cage.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-5-008-1', label: 'Read how each operation\'s counts plan the cage', type: 'read' },
    { id: 'cp-modelling-geometry-5-008-2', label: 'Read how the drawn mesh follows from the cage', type: 'read' },
    { id: 'cp-modelling-geometry-5-008-3', label: 'Read what a silhouette is and how it is found', type: 'read' },
    { id: 'cp-modelling-geometry-5-008-4', label: 'Run cells 1 to 4: plan, drawn mesh, cube and sphere silhouettes', type: 'lab' },
    { id: 'cp-modelling-geometry-5-008-5', label: 'Build the character in MeshLab and trace its silhouette', type: 'lab' },
    { id: 'cp-modelling-geometry-5-008-6', label: 'Work through example 2, a face on the mirror plane', type: 'example' },
    { id: 'cp-modelling-geometry-5-008-7', label: 'Work through example 3, a cube from a corner', type: 'example' },
    { id: 'cp-modelling-geometry-5-008-8', label: 'Complete the challenge: a longer arm and leg', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-5-008-assess-1',
        type: 'choice',
        text: 'A cage of 20 quads is mirrored (no face in the plane) and subdivided twice. How many faces are drawn?',
        options: ['640', '320', '160', '1280'],
        answer: '640',
        hint: '40 × 16.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-5-008-quiz-1',
      type: 'choice',
      text: 'How many faces does extruding one quad add?',
      options: ['4, or 3 if an edge is on a clipped mirror plane', 'Always 4', '5', '1'],
      answer: '4, or 3 if an edge is on a clipped mirror plane',
      hints: ['Walls only.', 'Cell 1, step 5.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-5-008-quiz-2',
      type: 'choice',
      text: 'Why does the drawn body have 1024 faces when the cage has 32?',
      options: ['Mirror doubles to 64; two subdivision levels multiply by 16', 'The GPU adds faces', 'Subdivision multiplies by 32', 'The loop cuts'],
      answer: 'Mirror doubles to 64; two subdivision levels multiply by 16',
      hints: ['Cell 2.', '4 per level.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-5-008-quiz-3',
      type: 'choice',
      text: 'When is a face front-facing?',
      options: ['When (eye − centre) · n > 0', 'When it is nearest the eye', 'When its normal points up', 'When it is lit'],
      answer: 'When (eye − centre) · n > 0',
      hints: ['Cell 3.', 'Lesson 2.1: the dot product\'s sign.'],
      reviewSection: 'Procedure: Find the silhouette',
    },
    {
      id: 'modelling-geometry-5-008-quiz-4',
      type: 'choice',
      text: 'How many silhouette edges does a cube have seen from straight in front?',
      options: ['4', '6', '8', '12'],
      answer: '4',
      hints: ['One face faces you.', 'Cell 3.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-5-008-quiz-5',
      type: 'choice',
      text: 'What happens to the silhouette when the eye moves?',
      options: ['Different edges become the silhouette', 'Nothing: it is part of the model', 'It disappears', 'It doubles'],
      answer: 'Different edges become the silhouette',
      hints: ['Cell 4.', 'The picture.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-5-008-quiz-6',
      type: 'choice',
      text: 'What must exist before an arm can be extruded from the side of the torso?',
      options: ['A shoulder-sized face, made by a loop cut', 'A bone', 'A subdivision level', 'A mirror modifier'],
      answer: 'A shoulder-sized face, made by a loop cut',
      hints: ['Warning "Plan cuts before extrudes".', 'Challenge 1.'],
      reviewSection: 'Warning "Plan cuts before extrudes"',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'A detailed model needs a detailed cage from the start.',
      whyStudentsThinkIt: 'Detail has to come from somewhere.',
      correctionExample: 'Cell 2: a 32-face cage draws 1024 faces; the body\'s smoothness comes from subdivision.',
      contrastCase: 'Fine detail (fingers, facial features) does need cage loops, added late and only where needed.',
    },
    {
      falseBelief: 'The silhouette is a fixed outline drawn on the model.',
      whyStudentsThinkIt: 'In one view the outline looks like part of the shape.',
      correctionExample: 'Cell 4 and the picture: the sphere\'s silhouette is a different ring of edges from each eye.',
      contrastCase: 'Sharp creases (a box\'s edges) are silhouette candidates from many views, but which of them are on it still depends on the eye.',
    },
    {
      falseBelief: 'You plan topology by trial and error.',
      whyStudentsThinkIt: 'Modelling looks like sculpting.',
      correctionExample: 'Cell 1 predicts every step\'s counts exactly from the chapter\'s rules.',
      contrastCase: 'Shape is adjusted by eye; topology (what is connected to what) can be planned.',
    },
  ],

  transferPrompts: [
    {
      situation: 'A game needs ten creatures with the same skeleton but different proportions.',
      competingTechniques: ['Model each from scratch', 'One box-modelling program, with lengths as parameters'],
      whyThisTechniqueWins: 'The operations are relative, so the same program (and the same topology, ready for one rig) builds every variant.',
    },
    {
      situation: 'A blockout looks wrong but you cannot say why.',
      competingTechniques: ['Add detail and hope', 'Compare the front and side silhouettes with reference'],
      whyThisTechniqueWins: 'Proportion errors show first in silhouette; detail added to a wrong silhouette is wasted.',
    },
  ],

  debugging: [
    {
      commonError: 'Extruding before cutting.',
      symptom: 'A limb as wide as the whole torso side.',
      whyItHappened: 'There was no smaller face to extrude.',
      repairStrategy: 'Undo; loop cut to make the right-sized face; extrude that.',
    },
    {
      commonError: 'Editing the subdivided result (after applying) instead of the cage.',
      symptom: 'Every change takes hundreds of vertex moves; the surface goes lumpy.',
      whyItHappened: 'The modifiers were applied too early.',
      repairStrategy: 'Keep modifiers live; edit the cage until the shape is final.',
    },
    {
      commonError: 'Walls on the mirror plane.',
      symptom: 'A wall inside the body along the middle; dark seams after subdivision.',
      whyItHappened: 'Clipping was off when the neck was extruded.',
      repairStrategy: 'Turn clipping on before extruding faces that touch the plane, and delete stray inner walls.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Plan a box-modelling sequence, predict the cage and drawn counts, and find silhouettes from an eye.',
    explainVerbally: 'Explain why cuts come before extrudes, how the drawn mesh follows from the cage, and what a silhouette is.',
    detectIncorrectApplication: 'Recognise oversized extrudes, early applying and walls on the plane.',
    transferToUnfamiliar: 'Block out a new model as a short program, and judge it by silhouette.',
  },
};
