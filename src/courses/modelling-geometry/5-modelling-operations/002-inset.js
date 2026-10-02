// Lesson 5.2: inset. Per face: each corner slides a fraction of the way to the face's centre. As a region: the
// outline moves in a distance t, each edge along its own inward direction, with corners mitred (t / sin(φ/2)) so
// the frame is t wide all round. A ring of quads joins the old outline to the new one.
import { withPicture } from '../notebookScene.js';

const HELPERS = `const r = (x) => +(Math.abs(x) < 1e-9 ? 0 : x).toFixed(4)
const f3 = (v) => v.map(r).join(', ')
const sub = (a, b) => a.map((x, i) => x - b[i]), add = (a, b) => a.map((x, i) => x + b[i]), mul = (a, s) => a.map((x) => x * s)
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l) }
const up = [0, 1, 0]   // every face here lies flat and faces up
`;

const INDIVIDUAL = `${HELPERS}
// A face 2 wide (x) and 1 deep (z), corners counter-clockwise seen from above.
const rect = [[-1, 0, -0.5], [-1, 0, 0.5], [1, 0, 0.5], [1, 0, -0.5]]
const centre = mul(rect.reduce(add), 1 / 4)
// Inset individual faces: each corner slides the fraction t of the way to the centre.
const t = 0.25
const inner = rect.map((p) => add(p, mul(sub(centre, p), t)))
inner.forEach((p, i) => console.log('corner ' + f3(rect[i]) + ' → ' + f3(p)))
// Predict first: is the frame the same width all round?
console.log('frame at the ends (x): ' + r(inner[0][0] - rect[0][0]) + ', along the sides (z): ' + r(inner[0][2] - rect[0][2]))`;

const INWARD = `${HELPERS}
const rect = [[-1, 0, -0.5], [-1, 0, 0.5], [1, 0, 0.5], [1, 0, -0.5]]
// Each edge a → b, walked the way the face walks it. Its inward direction, across the face, is normal × edge.
const inward = (a, b) => unit(cross(up, sub(b, a)))
for (let i = 0; i < 4; i++) {
  const a = rect[i], b = rect[(i + 1) % 4]
  console.log('edge ' + f3(a) + ' → ' + f3(b) + ': inward ' + f3(inward(a, b)))
}
// Move every edge in by the same distance t: at a right-angled corner, the two moved edges meet at corner + t·(i1 + i2).
const t = 0.2, i1 = inward(rect[3], rect[0]), i2 = inward(rect[0], rect[1])
console.log('the corner ' + f3(rect[0]) + ' moves to ' + f3(add(rect[0], mul(add(i1, i2), t))) + ': ' + t + ' from both edges')`;

const MITRE = `${HELPERS}
// A corner at the origin with interior angle phi: the outline arrives along +x and turns left by 180° − phi.
// It moves along the average of its edges' inward directions, by t / sin(phi / 2), capped at 5t.
const t = 0.2
for (const phi of [90, 60, 120, 270, 20]) {
  const turn = (180 - phi) * Math.PI / 180
  const e1 = [1, 0, 0], e2 = [Math.cos(turn), 0, -Math.sin(turn)]
  const i1 = unit(cross(up, e1)), i2 = unit(cross(up, e2))
  const dir = unit(add(i1, i2)), half = dot(dir, i1)              // half = sin(phi / 2)
  const dist = t / Math.max(0.2, half)
  const p = mul(dir, dist)
  // How far is the new corner from each edge's line? The component of p along that edge's inward direction.
  console.log(phi + '°: moves ' + r(dist) + (half < 0.2 ? ' (capped)' : '') + ', from the two edges ' + r(dot(p, i1)) + ' and ' + r(dot(p, i2)))
}`;

// An L of three unit squares, flat, facing up: the region the next two cells inset.
const L = `${HELPERS}
const verts = [[0, 0, 0], [0, 0, 1], [0, 0, 2], [1, 0, 0], [1, 0, 1], [1, 0, 2], [2, 0, 0], [2, 0, 1]]
const faces = [[0, 1, 4, 3], [1, 2, 5, 4], [3, 4, 7, 6]]
// The outline: each directed edge a → b of a face whose reverse b → a is not also in the region.
function outlineOf(region) {
  const directed = new Set()
  for (const fi of region) faces[fi].forEach((a, i) => directed.add(a + '>' + faces[fi][(i + 1) % faces[fi].length]))
  return [...directed].map((k) => k.split('>').map(Number)).filter(([a, b]) => !directed.has(b + '>' + a))
}
function insetRegion(region, t) {
  const outline = outlineOf(region)
  const into = new Map(), outOf = new Map()
  for (const e of outline) { outOf.set(e[0], e); into.set(e[1], e) }
  const inward = ([a, b]) => unit(cross(up, sub(verts[b], verts[a])))
  const copy = new Map(), moves = []
  for (const [v, eo] of outOf) {
    const i1 = inward(into.get(v)), i2 = inward(eo)
    const dir = unit(add(i1, i2)), dist = t / Math.max(0.2, dot(dir, i1))
    copy.set(v, verts.length)
    verts.push(add(verts[v], mul(dir, dist)))
    moves.push({ v, dist })
  }
  for (const fi of region) faces[fi] = faces[fi].map((v) => copy.has(v) ? copy.get(v) : v)
  const bridges = outline.map(([a, b]) => faces.push([a, b, copy.get(b), copy.get(a)]) - 1)
  return { outline, moves, bridges, copy }
}
`;

const REGION = `${L}
const { outline, moves, bridges, copy } = insetRegion([0, 1, 2], 0.2)
console.log('outline edges (' + outline.length + '): ' + outline.map(([a, b]) => a + '→' + b).join(', '))
console.log('no outline edge between faces: 1→4 and 4→1 are both in the region, as are 3→4 and 4→3')
for (const { v, dist } of moves) console.log('v' + v + ' ' + f3(verts[v]) + ' moves ' + r(dist) + ' to ' + f3(verts[copy.get(v)]))
// Check: each new outline edge is exactly 0.2 from the old one.
const gaps = outline.map(([a, b]) => r(dot(sub(verts[copy.get(a)], verts[a]), unit(cross(up, sub(verts[b], verts[a]))))))
console.log('distance of each new edge from its old one: ' + gaps.join(', '))
console.log('faces: 3 → ' + faces.length + ' (' + bridges.length + ' bridge quads)')`;

const PICTURE = withPicture(`${L}
const { bridges } = insetRegion([0, 1, 2], 0.2)
// Beside it, a 2 × 1 face inset on its own by the fraction 0.25.
const base = verts.length
verts.push([3, 0, 0], [3, 0, 1], [5, 0, 1], [5, 0, 0])
const rect = [base, base + 1, base + 2, base + 3]
const centre = [4, 0, 0.5]
const inner = rect.map((v) => { verts.push(add(verts[v], mul(sub(centre, verts[v]), 0.25))); return verts.length - 1 })
faces.push(inner)
const ring = rect.map((v, i) => faces.push([v, rect[(i + 1) % 4], inner[(i + 1) % 4], inner[i]]) - 1)
// The inset faces amber, the region's frame green, the single face's frame pink.
const groups = faces.map((f, i) => bridges.includes(i) ? 2 : ring.includes(i) ? 3 : 1)
console.log('the L\\'s frame is 0.2 wide all round; the 2 × 1 face\\'s frame is 0.25 at its ends and 0.125 along its sides')
show({ verts, faces, groups, normals: false, zoom: 2.2 })`);

const CHALLENGE = `// An outline has a 120° corner (the angle inside the region). You inset the region by t = 0.1.
// How far does the corner's vertex move?
const distance = 0
console.log(distance)`;

const SOLVED = CHALLENGE.replace('const distance = 0', 'const distance = 0.1 / Math.sin(Math.PI / 3)');

/** The challenge's check: a 120° corner inset by 0.1 moves 0.1 / sin 60° = 0.11547. */
export function checkCorner120(code) {
  const no = (message) => ({ pass: false, message });
  const m = code.match(/const\s+distance\s*=\s*([^\n]+)/);
  if (!m) return no('Keep the line const distance = …, with the distance as a number or an expression.');
  // Only arithmetic and a few Math functions are evaluated: this runs in the page, not the cell's sandbox.
  const expr = m[1].replace(/\/\/.*$/, '').trim().replace(/;$/, '');
  if (!/^[\d.\s+\-*/()]*$/.test(expr.replace(/Math\.(sin|cos|tan|sqrt|PI|SQRT2)/g, ''))) return no('Write the distance as a number, or arithmetic with Math.sin, Math.cos, Math.sqrt and Math.PI.');
  let d;
  try { d = Number(new Function('return (' + expr + ')')()); } catch { return no('That expression did not run: write a number, or something like 0.1 / Math.sin(…).'); }
  if (!Number.isFinite(d)) return no('The distance must be a number.');
  const right = 0.1 / Math.sin(Math.PI / 3);
  if (Math.abs(d - right) <= 5e-4) return { pass: true, message: `${+d.toFixed(5)}: the corner moves t / sin(φ/2) = 0.1 / sin 60° = 0.11547, a little more than t, so both edges end up exactly 0.1 away. A 90° corner would move 0.1414; a straight run, 0.1.` };
  if (d === 0) return no('Work out the distance: the corner moves along the average inward direction, by t / sin(φ/2).');
  if (Math.abs(d - 0.1) < 1e-6) return no('0.1 is right for a straight run of the outline, but at a corner the vertex must move further, so that both edges end up 0.1 away: t / sin(φ/2).');
  if (Math.abs(d - 0.1 * Math.sin(Math.PI / 3)) < 5e-4) return no('That is t × sin(φ/2): the corner would end up closer than t to its edges. Divide by sin(φ/2) instead.');
  if (Math.abs(d - 0.2) < 5e-4) return no('0.2 is t / cos 60°. The half-angle is φ/2 = 60°, and the distance is t / sin(φ/2).');
  if (Math.abs(d - 0.1 * Math.SQRT2) < 5e-4) return no('0.1414 is the distance for a 90° corner (t / sin 45°). This corner is 120°.');
  if (Math.abs(d - 0.1 / Math.sin(120)) < 5e-3 || Math.abs(d - 0.1 / Math.sin(60)) < 5e-3) return no('Math.sin takes radians: 60° is Math.PI / 3.');
  return no(`${+d.toFixed(5)} is not t / sin(φ/2) for φ = 120° and t = 0.1.`);
}

export default {
  id: 'modelling-geometry-5-002',
  slug: 'inset',
  chapter: 'modelling-geometry',
  order: 2,
  title: 'Inset',
  subtitle: 'Shrink a face or a region inside itself and join the two outlines with a ring of quads.',
  tags: ['inset', 'offset', 'mitre', 'polygon', 'modelling', 'hard-surface'],
  coreConcept: 'Inset makes a smaller copy of a face or region inside itself and joins the old outline to the new with a ring of quads. Per face, each corner slides a fraction t towards the face\'s centre, so a long face gets an uneven frame. As a region, the outline moves in a distance t: each edge along its inward direction (normal × edge), and each corner along the average of its two edges\' inward directions by t / sin(φ/2), the mitre, so the frame is exactly t wide all round. Faces inside the region keep their shape.',
  prerequisites: ['modelling-geometry-5-001', 'modelling-geometry-2-001'],
  timeToComplete: 40,
  nextLesson: 'modelling-geometry-5-003',

  hook: {
    question: 'Press I on a face and a smaller face appears inside it, with a frame round it. Why is the frame the same width at a corner as along an edge, when the corner had to move further?',
    realWorldContext: 'Inset is how panels, windows, screens and trims start: inset a face, then extrude the new one in or out. The same offsetting of an outline is used in CNC tool paths, font outlines and 3D printers\' walls.',
  },

  intuition: {
    prose: [
      'Inset has two forms. **Inset individual faces** treats each face on its own: every corner slides a fraction $t$ of the way to the face\'s centre. **Inset as a region** (the I key) treats the selection as one piece and moves its outline in by a distance $t$.',
      'Before running cell 1, predict: a face 2 wide and 1 deep, inset individually by $t = 0.25$. Is the frame the same width all round?',
      'No. Each corner moves a quarter of the way to the centre: $0.25$ in $x$ but only $0.125$ in $z$, because the centre is $1$ away along $x$ and $0.5$ along $z$. A fraction gives an even frame only on a square.',
      'To get an even frame, move each **edge** in by the same distance $t$. Which way is "in"? The face walks its edge $a \\to b$ counter-clockwise seen from its normal $n$, so the face is on the left, and $n \\times (b - a)$, made unit length, points across the face, inward (lesson 2.1). Cell 2 prints it for each edge of the rectangle.',
      'At a corner the two moved edges meet. The vertex moves along the **average** of its two edges\' inward directions, and further than $t$: at a $90°$ corner, $t\\sqrt{2}$. In general, for an interior angle $\\varphi$, the distance is $t / \\sin(\\varphi/2)$: the **mitre**, named after the angled joint of a picture frame.',
      'Before running cell 3, predict: at a $60°$ corner, how far does the vertex move? $t / \\sin 30° = 2t$. Sharp corners move a long way; at $20°$, nearly $6t$. MeshLab caps the distance at $5t$, so a needle-sharp corner does not shoot off, and cell 3 shows the price: the edges there end up closer than $t$.',
      'A **region** is inset by its outline: every directed edge $a \\to b$ of a selected face whose reverse $b \\to a$ is not in the selection. Edges between selected faces appear in both directions and are skipped, so the faces inside keep their shape and get no frame. Cell 4 insets an L of three squares: $8$ outline edges, $8$ copies, $8$ bridge quads, and every new edge exactly $0.2$ from its old one, even at the L\'s inside corner ($270°$).',
      'The bridge on outline edge $a \\to b$ is $[a, b, b\', a\']$, the same pattern as extrude\'s walls (lesson 5.1), lying flat in the surface instead of standing up.',
    ],
    callouts: [
      {
        type: 'procedure',
        title: 'Procedure: Inset a region',
        body: 'Step 1. The outline: each directed edge a → b of a selected face whose reverse b → a is not in the selection.\nStep 2. Each outline edge\'s inward direction: unit(n × (b − a)), n its face\'s normal.\nStep 3. Each outline vertex, with incoming direction i₁ and outgoing i₂: v′ = v + (t / sin(φ/2)) · unit(i₁ + i₂), where sin(φ/2) = unit(i₁ + i₂) · i₁, capped below at 0.2.\nStep 4. Selected faces use v′ in place of v.\nStep 5. A bridge [a, b, b′, a′] on each outline edge.',
      },
      {
        type: 'procedure',
        title: 'Procedure: Inset individual faces',
        body: 'Step 1. For each selected face, its centre c (the average of its corners).\nStep 2. Each corner p gets an inner copy p + t (c − p), t a fraction from 0 to 1.\nStep 3. The face uses the inner copies; a quad [pᵢ, pᵢ₊₁, p′ᵢ₊₁, p′ᵢ] joins each edge to its copy.',
      },
      {
        type: 'warning',
        title: 'Sharp corners and thick insets',
        body: 'At a corner of φ, the vertex moves t / sin(φ/2): 2t at 60°, 5.8t at 20°. If t is more than about half the region\'s narrowest width, the moved edges cross each other and the inset folds over itself. MeshLab caps the corner distance at 5t; Blender clamps the thickness. Inset thinner, or inset in steps.',
      },
      {
        type: 'insight',
        title: 'The graphics strand: support for bevels and panels',
        body: 'The ring of bridge quads is a frame a known width from the old outline. Extrude the inset face down and you have a recessed panel whose edges are crisp because the frame holds them; subdivide later (lesson 6.4) and that frame acts as a support loop, keeping the panel edge sharp. The crate project is built this way.',
      },
      {
        type: 'insight',
        title: 'What the picture shows (cell 5)',
        body: 'Misconception it contradicts: "inset is just a scale toward the centre". The L (amber, green frame) has a frame 0.2 wide all round, even at its inside corner, and none between its faces. The 2 × 1 face beside it, inset as a fraction (pink frame), has a frame 0.25 at its ends and 0.125 along its sides.',
      },
      { type: 'insight', title: 'Bridge: from the maths to code', body: 'In cell 4, outlineOf() is Step 1; inward() is Step 2; dir and dist are Step 3 (dot(dir, i1) is sin(φ/2)); the face rewrite is Step 4; bridges is Step 5.' },
      { type: 'insight', title: 'Bridge: from code to the GPU', body: 'An inset adds no new shape, only faces in the same plane: until the inner face is moved, the picture looks the same except for the wireframe, because every new quad has the old face\'s normal.' },
      { type: 'insight', title: 'Bridge: from the GPU to MeshLab', body: 'I insets the selection as a region by 0.1; change Thickness in the Adjust panel. Mesh › Inset individual faces uses a fraction. With Record traces on, the region trace shows the outline, then each vertex\'s mitre (φ, sin(φ/2), distance), and asks you to predict a corner. Scripts call mesh.insetRegion(faces, t) or mesh.inset(faces, fraction).' },
    ],
    visualizations: [
      {
        id: 'JSNotebook',
        title: 'Build it: inset a face and a region',
        caption: 'A fraction toward the centre, inward directions, the mitre, a region\'s outline, and both kinds side by side.',
        props: {
          lesson: {
            title: 'Inset',
            subtitle: 'Move the outline in, mitred at the corners.',
            cells: [
              { type: 'js', instruction: '### 1. Inset by a fraction\nPredict first: a 2 × 1 face inset by 0.25. Is the frame even?', startCode: INDIVIDUAL },
              { type: 'js', instruction: '### 2. Inward directions\nnormal × edge points across the face.', startCode: INWARD },
              { type: 'js', instruction: '### 3. The mitre\nPredict first: how far does a 60° corner move? Each new corner is checked against both its edges.', startCode: MITRE },
              { type: 'js', instruction: '### 4. A region: an L of three squares\nThe outline from directed edges, the mitred copies, and the new edges checked.', startCode: REGION },
              { type: 'js', instruction: '### 5. See both\nThe L inset as a region (green frame) and a 2 × 1 face inset by a fraction (pink frame). Drag to turn.', startCode: PICTURE, showPreviewByDefault: true, outputHeight: 360 },
              { type: 'challenge', instruction: '### 6. Challenge: a 120° corner\nHow far does the corner move? The check names any slip.', startCode: CHALLENGE, solutionCode: SOLVED, check: checkCorner120 },
              { type: 'markdown', instruction: '### Watch MeshLab do it\n[Open "Inset" in MeshLab](#/lab/mesh-lab?project=inset). An L of three faces is inset as a region with **Record traces** on: press Play in the Algorithm trace, predict where the first corner goes, and compare the 90° and 270° corners with the straight ones. Then select a face and press I.' },
              { type: 'markdown', instruction: '### Use the tool\n- **Edit mode, faces selected, I:** inset as a region by 0.1; change **Thickness** in the Adjust panel.\n- **Mesh › Inset individual faces:** each face on its own, by a fraction.\n- Follow an inset with **E** and a negative distance for a recessed panel, or a positive one for a raised one.\n- [Open "Crate" in MeshLab](#/lab/mesh-lab?project=crate): every side is inset as a region, then pushed in.\n- **In Blender:** I insets the selection as a region (by a distance); press I twice for individual faces. Its Offset Even option is the mitre.' },
            ],
          },
        },
      },
    ],
  },

  math: {
    prose: [
      '**Inward direction.** A face with unit normal $n$ walks its edges counter-clockwise seen from $n$. For edge direction $e = (b - a)/\\|b - a\\|$, the vector $n \\times e$ is perpendicular to both, so it lies in the face and at right angles to the edge, and by the right-hand rule it points to the left of $e$: into the face.',
      '**The mitre.** Let $i_1, i_2$ be the unit inward directions of the edges meeting at $v$, with interior angle $\\varphi$. The angle between $i_1$ and $i_2$ is $\\pi - \\varphi$, so the bisector $d = (i_1 + i_2)/\\|i_1 + i_2\\|$ makes the angle $(\\pi - \\varphi)/2$ with each, and $d \\cdot i_1 = \\cos\\frac{\\pi - \\varphi}{2} = \\sin\\frac{\\varphi}{2}$. Moving $v$ by $s\\,d$ puts it $s \\sin(\\varphi/2)$ from each edge\'s line. Setting that to $t$ gives $s = t / \\sin(\\varphi/2)$.',
      '**Reflex corners.** At the inside corner of an L, $\\varphi = 270°$ and $\\sin 135° = \\sin 45°$: the vertex moves $t\\sqrt{2}$, as at a $90°$ corner, but into the region\'s material diagonally between the two arms. The same formula covers both, because it only uses $i_1 + i_2$.',
      '**A fraction is a scale.** Inset individual faces maps each corner $p$ to $c + (1 - t)(p - c)$: a uniform scale about the centre by $1 - t$ (lesson 2.2). The frame width along a direction is $t$ times the distance from the centre to the edge in that direction, so it is even only if every edge is the same distance from the centre: a regular polygon.',
    ],
    equations: [
      { label: 'Inward direction', latex: 'i = \\frac{n \\times (b - a)}{\\|b - a\\|}' },
      { label: 'Mitre', latex: "v' = v + \\frac{t}{\\sin(\\varphi/2)}\\,\\frac{i_1 + i_2}{\\|i_1 + i_2\\|}, \\qquad \\sin\\frac{\\varphi}{2} = \\frac{i_1 + i_2}{\\|i_1 + i_2\\|} \\cdot i_1" },
      { label: 'Individual inset', latex: "p' = p + t\\,(c - p) = c + (1 - t)(p - c)" },
    ],
  },

  rigor: {
    prose: [
      '**Formal statement.** For a planar region with a simple outline and thickness $t$ less than its inradius-like limit (no two moved edges cross), the region inset moves every outline edge parallel to itself a distance $t$ into the region; the new outline is the inner offset curve of the old one, sampled at its vertices, and each bridge quad is a trapezium of height $t$.',
      '**Invariant viewpoint.** The region inset does not depend on how the outline is numbered or where it starts; it commutes with rotations and translations; and it does not depend on how the region is divided into faces, because only the outline moves. Individual inset, by contrast, depends on each face\'s centre, so it changes with the division.',
      '**Geometric picture.** Offsetting is "every point of the edge at distance t": a strip along each edge, cut at the bisectors at its corners. On a curved (non-planar) region, MeshLab uses each edge\'s own face normal, so the strip follows the surface locally.',
      '**Where this goes.** The bevel of lesson 5.4 also slides points along a surface by a width. CAD and CNC use exact offset curves, with arcs at convex corners instead of mitres.',
    ],
  },

  examples: [
    {
      id: 'modelling-geometry-5-002-ex1',
      title: 'A square face, both ways',
      problem: 'A square face of side $2$ is inset individually by the fraction $t = 0.1$, and as a region by the distance $0.1$. Do the two agree?',
      steps: [
        { expression: '\\text{individual: } 0.1 \\times 1 = 0.1\\text{ from each edge}', annotation: 'The centre is 1 from every edge.' },
        { expression: '\\text{region: } 0.1\\text{ from each edge}', annotation: 'By construction.' },
      ],
      conclusion: 'Yes, for a square of side 2: both frames are 0.1 wide. On any other size or shape they differ.',
    },
    {
      id: 'modelling-geometry-5-002-ex2',
      title: 'Where does a corner go?',
      problem: 'A $90°$ corner at $(0, 0, 0)$ has inward directions $(0,0,1)$ and $(1,0,0)$. Inset by $0.2$.',
      steps: [
        { expression: 'i_1 + i_2 = (1, 0, 1), \\quad d = (0.7071, 0, 0.7071)', annotation: 'Step 3: the average direction.' },
        { expression: '\\sin 45° = 0.7071, \\quad s = 0.2 / 0.7071 = 0.2828', annotation: 'The mitre.' },
        { expression: "v' = 0.2828\\,(0.7071, 0, 0.7071) = (0.2, 0, 0.2)", annotation: '0.2 from both edges.' },
      ],
      conclusion: "v′ = (0.2, 0, 0.2).",
    },
    {
      id: 'modelling-geometry-5-002-ex3',
      title: 'How many bridges?',
      problem: 'A $2 \\times 3$ block of faces on a grid is inset as a region. How many bridge quads?',
      steps: [
        { expression: '\\text{outline} = 2(2 + 3) = 10\\text{ edges}', annotation: 'Step 1: round the outside.' },
        { expression: '\\text{one bridge per outline edge}', annotation: 'Step 5.' },
      ],
      conclusion: '10 bridges; inset individually, the same 6 faces would get 24.',
    },
  ],

  challenges: [
    {
      id: 'modelling-geometry-5-002-ch1',
      difficulty: 'easy',
      problem: 'Why does an inset region get no frame between its own faces?',
      walkthrough: [{ expression: 'a \\to b \\text{ and } b \\to a \\text{ both in the selection}', annotation: 'Such edges are not on the outline.' }],
      answer: 'An edge between two selected faces is walked once in each direction by them, so it is not on the outline; only outline edges move and get bridges.',
    },
    {
      id: 'modelling-geometry-5-002-ch2',
      difficulty: 'medium',
      problem: 'A long thin face, $4 \\times 0.5$, is inset as a region by $0.3$. What goes wrong?',
      walkthrough: [
        { expression: '0.5 / 2 = 0.25 < 0.3', annotation: 'The two long edges each move 0.3 inward.' },
        { expression: '\\text{they pass each other}', annotation: 'The inner face turns inside out.' },
      ],
      answer: 'The face is only 0.5 wide, so moving both long edges in by 0.3 makes them cross: the inner face folds over with its winding reversed. The thickness must stay below half the narrowest width (0.25).',
    },
    {
      id: 'modelling-geometry-5-002-ch3',
      difficulty: 'hard',
      problem: 'Show that at an interior angle $\\varphi$, the bridge quad\'s corner edge (from $v$ to $v\'$) bisects the angle, and find its length for $\\varphi = 120°$, $t = 0.1$.',
      walkthrough: [
        { expression: 'd = \\frac{i_1 + i_2}{\\|i_1 + i_2\\|}', annotation: 'The sum of two unit vectors bisects the angle between them.' },
        { expression: '\\text{and the angle between } i_1, i_2 \\text{ is } \\pi - \\varphi', annotation: 'So d bisects the corner too.' },
        { expression: 's = 0.1 / \\sin 60° = 0.1155', annotation: 'The mitre.' },
      ],
      answer: 'The unit sum of i₁ and i₂ bisects the angle between them, and each is perpendicular to its edge, so d bisects the corner. For 120° and t = 0.1, the corner edge is 0.1 / sin 60° = 0.1155 long.',
    },
  ],

  semantics: {
    core: [
      { symbol: 't', meaning: 'Region inset: the distance each outline edge moves in. Individual inset: the fraction of the way to the centre.' },
      { symbol: 'n \\times (b - a)', meaning: 'An outline edge\'s inward direction, across its face (made unit length).' },
      { symbol: '\\varphi', meaning: 'The interior angle at an outline corner: the angle inside the region.' },
      { symbol: 't / \\sin(\\varphi/2)', meaning: 'The mitre: how far a corner moves so both its edges end up t away.' },
      { symbol: "[a, b, b', a']", meaning: 'The bridge quad on outline edge a → b.' },
      { symbol: 'c', meaning: 'A face\'s centre, the average of its corners, used by individual inset.' },
    ],
    rulesOfThumb: [
      'Region inset: even frame, by distance. Individual inset: by fraction, even only on regular faces.',
      'The outline is the directed edges whose reverse is not selected.',
      'Corners move t / sin(φ/2): √2 t at 90°, 2t at 60°.',
      'Keep t below half the narrowest width.',
      'Inset, then extrude: panels.',
    ],
  },

  spiral: {
    recoveryPoints: [
      { lessonId: 'modelling-geometry-5-001', label: 'Extrude', note: 'The same copy-and-bridge pattern, [a, b, b′, a′], standing up instead of lying flat.' },
      { lessonId: 'modelling-geometry-2-001', label: 'Vectors, dot and cross', note: 'n × edge points across the face; the dot product gives sin(φ/2).' },
    ],
    futureLinks: [
      { lessonId: 'modelling-geometry-5-003', label: 'Edge rings and loop cuts', note: 'Adding loops across a mesh instead of round a region.' },
      { lessonId: 'modelling-geometry-6-004', label: 'Keeping edges sharp', note: 'An inset frame acts as a support loop under subdivision.' },
    ],
  },

  checkpoints: [
    { id: 'cp-modelling-geometry-5-002-1', label: 'Read the two kinds of inset, by fraction and by distance', type: 'read' },
    { id: 'cp-modelling-geometry-5-002-2', label: 'Read why a corner moves t / sin(φ/2)', type: 'read' },
    { id: 'cp-modelling-geometry-5-002-3', label: 'Read how a region\'s outline is found from directed edges', type: 'read' },
    { id: 'cp-modelling-geometry-5-002-4', label: 'Run cells 1 to 4: fraction, inward directions, mitre, region', type: 'lab' },
    { id: 'cp-modelling-geometry-5-002-5', label: 'Trace a region inset in MeshLab and predict a corner', type: 'lab' },
    { id: 'cp-modelling-geometry-5-002-6', label: 'Work through example 2, where a corner goes', type: 'example' },
    { id: 'cp-modelling-geometry-5-002-7', label: 'Work through example 3, how many bridges', type: 'example' },
    { id: 'cp-modelling-geometry-5-002-8', label: 'Complete the challenge: a 120° corner', type: 'challenge' },
  ],

  assessment: {
    questions: [
      {
        id: 'modelling-geometry-5-002-assess-1',
        type: 'choice',
        text: 'A region\'s outline has a 90° corner. It is inset by 0.3. How far does the corner vertex move?',
        options: ['0.4243', '0.3', '0.6', '0.2121'],
        answer: '0.4243',
        hint: 't / sin 45° = 0.3 √2.',
      },
    ],
  },

  quiz: [
    {
      id: 'modelling-geometry-5-002-quiz-1',
      type: 'choice',
      text: 'A 2 × 1 face is inset individually by 0.25. How wide is the frame along its long sides?',
      options: ['0.125', '0.25', '0.5', '0.0625'],
      answer: '0.125',
      hints: ['The centre is 0.5 from the long sides.', 'Cell 1.'],
      reviewSection: 'Cell 1',
    },
    {
      id: 'modelling-geometry-5-002-quiz-2',
      type: 'choice',
      text: 'Which way does n × (b − a) point, for an edge a → b of a face with normal n?',
      options: ['Across the face, inward', 'Out of the face, away from it', 'Along the edge', 'Along the normal'],
      answer: 'Across the face, inward',
      hints: ['The face is to the left of its edges.', 'Cell 2.'],
      reviewSection: 'Cell 2',
    },
    {
      id: 'modelling-geometry-5-002-quiz-3',
      type: 'choice',
      text: 'How far does a 60° corner move when inset by t?',
      options: ['2t', 't', '√2 t', 't / 2'],
      answer: '2t',
      hints: ['t / sin 30°.', 'Cell 3.'],
      reviewSection: 'Cell 3',
    },
    {
      id: 'modelling-geometry-5-002-quiz-4',
      type: 'choice',
      text: 'Which edges are on a region\'s outline?',
      options: ['Directed edges whose reverse is not in the region', 'Every edge of every selected face', 'Edges with two selected faces', 'The longest edges'],
      answer: 'Directed edges whose reverse is not in the region',
      hints: ['Cell 4.', 'Step 1.'],
      reviewSection: 'Cell 4',
    },
    {
      id: 'modelling-geometry-5-002-quiz-5',
      type: 'choice',
      text: 'At the inside corner of an L (270°), how far does the vertex move for thickness t?',
      options: ['√2 t', 't', '0', '2t'],
      answer: '√2 t',
      hints: ['sin 135° = sin 45°.', 'Cell 4.'],
      reviewSection: 'Maths: reflex corners',
    },
    {
      id: 'modelling-geometry-5-002-quiz-6',
      type: 'choice',
      text: 'Right after an inset, before moving anything, how does the shaded model look?',
      options: ['The same: every new face lies in the old face\'s plane', 'Darker round the frame', 'The inner face is raised', 'The frame faces are invisible'],
      answer: 'The same: every new face lies in the old face\'s plane',
      hints: ['Same plane, same normal.', 'Bridge: from code to the GPU.'],
      reviewSection: 'Insight "Bridge: from code to the GPU"',
    },
  ],

  misconceptions: [
    {
      falseBelief: 'Inset is a scale of the face toward its centre.',
      whyStudentsThinkIt: 'On a square it looks like one.',
      correctionExample: 'Cell 1: a 2 × 1 face scaled toward its centre gets a frame 0.25 wide at the ends and 0.125 along the sides; the region inset gives 0.2 everywhere.',
      contrastCase: 'Inset individual faces really is a scale about each face\'s centre; that is why it is uneven.',
    },
    {
      falseBelief: 'Every corner moves the inset distance.',
      whyStudentsThinkIt: 'The thickness is one number.',
      correctionExample: 'Cell 3: a 90° corner moves 0.283 for t = 0.2; a 60° corner, 0.4.',
      contrastCase: 'Along a straight run of the outline (180°), a vertex does move exactly t.',
    },
    {
      falseBelief: 'Insetting several faces as a region frames each of them.',
      whyStudentsThinkIt: 'Individual inset does.',
      correctionExample: 'Cell 4: the L of three faces gets 8 bridges round its outline and none between its faces.',
      contrastCase: 'Inset individual faces on the same three faces gives 12 bridges, a frame round each.',
    },
  ],

  transferPrompts: [
    {
      situation: 'You need a window with an even 5 cm frame in a 2 m × 1 m wall face.',
      competingTechniques: ['Inset individual faces by a fraction', 'Inset as a region by 0.05'],
      whyThisTechniqueWins: 'The region inset moves every edge exactly 0.05; a fraction would give a frame twice as wide at the ends as along the top and bottom.',
    },
    {
      situation: 'A laser cutter must follow a path 1 mm inside a shape\'s outline.',
      competingTechniques: ['Scale the shape down', 'Offset each edge 1 mm inward with mitred corners'],
      whyThisTechniqueWins: 'Scaling changes the gap with the distance from the centre; the offset keeps it 1 mm everywhere.',
    },
  ],

  debugging: [
    {
      commonError: 'Using b − a × n (the wrong order) for the inward direction.',
      symptom: 'The outline moves outward: the inner face grows over its neighbours.',
      whyItHappened: 'The cross product changes sign when its factors swap.',
      repairStrategy: 'n × (b − a), with a → b in the face\'s own order.',
    },
    {
      commonError: 'Moving corners by t without the mitre.',
      symptom: 'The frame is thinner at the corners than along the edges.',
      whyItHappened: 'At a corner, distance t along the bisector leaves both edges only t sin(φ/2) away.',
      repairStrategy: 'Divide by sin(φ/2), which is unit(i₁ + i₂) · i₁.',
    },
    {
      commonError: 'An inset thicker than half the region\'s width.',
      symptom: 'The inner face flips (its normal points down) and the frame overlaps.',
      whyItHappened: 'Opposite edges moved past each other.',
      repairStrategy: 'Use a smaller thickness, or several thinner insets.',
    },
  ],

  mastery: {
    targetLevel: 3,
    solveIndependently: 'Inset a face by a fraction and a region by a distance by hand, including mitred corners.',
    explainVerbally: 'Explain why the corner moves t / sin(φ/2), why region inset gives an even frame, and how the outline is found.',
    detectIncorrectApplication: 'Recognise uneven frames, outward insets, unmitred corners and folded insets from their symptoms.',
    transferToUnfamiliar: 'Use offsetting for panels, tool paths and frames, choosing between a fraction and a distance.',
  },
};
